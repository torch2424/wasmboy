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

var wasmboyLibWasmWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBLKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gTChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIE0oYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfQk9PVF9ST01fTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5CT09UX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkJPT1RfUk9NXSksYS5XQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5HQU1FQk9ZX01FTU9SWV0pLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlNFVF9NRU1PUllfRE9ORX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX01FTU9SWTp7ZD17dHlwZTpmLkdFVF9NRU1PUll9O2NvbnN0IGw9W107dmFyIGM9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKGMuaW5jbHVkZXMoZy5CT09UX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlK2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fU0laRS52YWx1ZU9mKCkpfWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5CT09UX1JPTV09ZTtsLnB1c2goZSl9aWYoYy5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXtlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTittKToKbmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9QShhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QihhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBOKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEMoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gRChhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUUtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0YoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEYoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRT1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksRChhKSwhMDtOKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLApiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEMoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT1BKGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QihhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpEKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09ZCYmYihkKTtpZigxPT09ZCl7ZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXIoKTsKY29uc3QgYz1yPj11Oy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEcoYSxkKSxzZXRUaW1lb3V0KCgpPT57dyhhKTt4KGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooRyhhLGQpLHgoYSxiKSl9fWZ1bmN0aW9uIEcoYSxiKXt2YXIgZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjb25zdCBjPXt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpkLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07ZD1bZF07aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDFCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDJCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDNCdWZmZXI9ZTtkLnB1c2goZSk7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDRCdWZmZXI9YjtkLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChjKSwKZCk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB2O3B8fCh2PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZj17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLApVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQiLEZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxnPXtCT09UX1JPTToiQk9PVF9ST00iLENBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTsKbGV0IHQ9MCx5PXt9O2NvbnN0IEg9KGEsYik9PntsZXQgYz0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihjKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoYys9YCAweCR7Yi50b1N0cmluZygxNil9IGApO2NvbnNvbGUubG9nKGMpfSx6PXtpbmRleDp7Y29uc29sZUxvZzpILGNvbnNvbGVMb2dUaW1lb3V0OihhLGIsYyk9Pnt5W2FdfHwoeVthXT0hMCxIKGEsYiksc2V0VGltZW91dCgoKT0+e2RlbGV0ZSB5W2FdfSxjKSl9fSxlbnY6e2Fib3J0OigpPT57Y29uc29sZS5lcnJvcigiQXNzZW1ibHlTY3JpcHQgSW1wb3J0IE9iamVjdCBBYm9ydGVkISIpfX19LEk9YXN5bmMoYSk9PntsZXQgYj12b2lkIDA7cmV0dXJuIGI9V2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmc/YXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcoZmV0Y2goYSkseik6YXdhaXQgKGFzeW5jKCk9Pntjb25zdCBiPWF3YWl0IGZldGNoKGEpLnRoZW4oKGEpPT5hLmFycmF5QnVmZmVyKCkpOwpyZXR1cm4gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYix6KX0pKCl9LE89YXN5bmMoYSk9PnthPUJ1ZmZlci5mcm9tKGEuc3BsaXQoIiwiKVsxXSwiYmFzZTY0Iik7cmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGEseil9LFA9YXN5bmMoYSk9PnthPShhP2F3YWl0IEkoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCaUFFUllBSi9md0YvWUFBQVlBTi9mMzhCZjJBRWYzOS9md0JnQW45L0FHQUJmd0YvWUFGL0FHQURmMzkvQUdBS2YzOS9mMzkvZjM5L2Z3QmdBQUYvWUFaL2YzOS9mMzhBWUFkL2YzOS9mMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FHQUZmMzkvZjM4QmYyQU5mMzkvZjM5L2YzOS9mMzkvZndGL0FnMEJBMlZ1ZGdWaFltOXlkQUFEQS84Qi9RRUVCQWNCQlFBR0JBWUdCZ0VFQndBQUJnVUZCd2NHQVFZR0JnRUZCUUVFQVFFR0JnRUJBUUVCQVFFR0FRRUdCZ0VCQVFFSUNRRUJBUUVCQVFFQkJnWUJBUUVCQVFFQkFRa0pDUWtQQUFJQUVBc01DZ29IQkFZQkFRWUJBUUVCQmdFQkFRRUZCUUFGQlFrQkJRVUFEUVlHQmdFRkNRVUZCQVlHQmdZR0FRWUJCZ0VHQVFZQUJna0pCZ1FGQUFZQkFRWUFCQWNCQUFFR0FRWUdDUWtFQkFZRUJnWUdCQVFIQlFVRkJRVUZCUVVGQkFZR0JRWUdCUVlHQlFZR0JRVUZCUVVGQlFVRkJRVUFCUVVGQlFVRkJna0pDUVVKQlFrSkNRVUVCZ1lPQmdFR0FRWUJDUWtKQ1FrSkNRa0pDUWtKQmdFQkNRa0pDUUVCQkFRQkJRWUFCUU1CQUFFRzdRdWJBbjhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0JBTGZ3QkJnSUFFQzM4QVFZQ1FCQXQvQUVHQUFRdC9BRUdBa1FRTGZ3QkJnTGdCQzM4QVFZREpCUXQvQUVHQTJBVUxmd0JCZ0tFTEMzOEFRWUNBREF0L0FFR0FvUmNMZndCQmdJQUpDMzhBUVlDaElBdC9BRUdBK0FBTGZ3QkJnSkFFQzM4QVFZQ0pIUXQvQUVHQW1TRUxmd0JCZ0lBSUMzOEFRWUNaS1F0L0FFR0FnQWdMZndCQmdKa3hDMzhBUVlDQUNBdC9BRUdBbVRrTGZ3QkJnSUFJQzM4QVFZQ1p3UUFMZndCQmdJQUlDMzhBUVlDWnlRQUxmd0JCZ0lBSUMzOEFRWUNaMFFBTGZ3QkJnQlFMZndCQmdLM1JBQXQvQUVHQWlQZ0RDMzhBUVlDMXlRUUxmd0JCLy84REMzOEFRUUFMZndCQmdMWE5CQXQvQUVHVUFRdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVg4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHQUFndC9BVUVBQ3dmd0VHVUdiV1Z0YjNKNUFnQUhYMTloYkd4dll3QVFDRjlmY21WMFlXbHVBQklKWDE5eVpXeGxZWE5sQUJvSlgxOWpiMnhzWldOMEFBd0xYMTl5ZEhScFgySmhjMlVEbVFJR1kyOXVabWxuQURRT2FHRnpRMjl5WlZOMFlYSjBaV1FBTlFsellYWmxVM1JoZEdVQVBBbHNiMkZrVTNSaGRHVUFSd1ZwYzBkQ1F3QklFbWRsZEZOMFpYQnpVR1Z5VTNSbGNGTmxkQUJKQzJkbGRGTjBaWEJUWlhSekFFb0laMlYwVTNSbGNITUFTeFZsZUdWamRYUmxUWFZzZEdsd2JHVkdjbUZ0WlhNQTFBRU1aWGhsWTNWMFpVWnlZVzFsQU5NQkNWOWZjMlYwWVhKbll3RDhBUmxsZUdWamRYUmxSbkpoYldWQmJtUkRhR1ZqYTBGMVpHbHZBUHNCRldWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJnRDlBUXRsZUdWamRYUmxVM1JsY0FEUUFSUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQURWQVF4blpYUkRlV05zWlZObGRITUExZ0VKWjJWMFEzbGpiR1Z6QU5jQkRuTmxkRXB2ZVhCaFpGTjBZWFJsQU53QkgyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWElBMFFFUVkyeGxZWEpCZFdScGIwSjFabVpsY2dCREhITmxkRTFoYm5WaGJFTnZiRzl5YVhwaGRHbHZibEJoYkdWMGRHVUFJaGRYUVZOTlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXhFMWRCVTAxQ1QxbGZUVVZOVDFKWlgxTkpXa1VETWhKWFFWTk5RazlaWDFkQlUwMWZVRUZIUlZNRE14NUJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQlJwQlUxTkZUVUpNV1ZORFVrbFFWRjlOUlUxUFVsbGZVMGxhUlFNR0ZsZEJVMDFDVDFsZlUxUkJWRVZmVEU5RFFWUkpUMDREQnhKWFFWTk5RazlaWDFOVVFWUkZYMU5KV2tVRENDQkhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNUEhFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURFQkpXU1VSRlQxOVNRVTFmVEU5RFFWUkpUMDREQ1E1V1NVUkZUMTlTUVUxZlUwbGFSUU1LRVZkUFVrdGZVa0ZOWDB4UFEwRlVTVTlPQXdzTlYwOVNTMTlTUVUxZlUwbGFSUU1NSms5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3MGlUMVJJUlZKZlIwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTU9HRWRTUVZCSVNVTlRYMDlWVkZCVlZGOU1UME5CVkVsUFRnTWRGRWRTUVZCSVNVTlRYMDlWVkZCVlZGOVRTVnBGQXg0VVIwSkRYMUJCVEVWVVZFVmZURTlEUVZSSlQwNERFUkJIUWtOZlVFRk1SVlJVUlY5VFNWcEZBeElZUWtkZlVGSkpUMUpKVkZsZlRVRlFYMHhQUTBGVVNVOU9BeE1VUWtkZlVGSkpUMUpKVkZsZlRVRlFYMU5KV2tVREZBNUdVa0ZOUlY5TVQwTkJWRWxQVGdNVkNrWlNRVTFGWDFOSldrVURGaGRDUVVOTFIxSlBWVTVFWDAxQlVGOU1UME5CVkVsUFRnTVhFMEpCUTB0SFVrOVZUa1JmVFVGUVgxTkpXa1VER0JKVVNVeEZYMFJCVkVGZlRFOURRVlJKVDA0REdRNVVTVXhGWDBSQlZFRmZVMGxhUlFNYUVrOUJUVjlVU1V4RlUxOU1UME5CVkVsUFRnTWJEazlCVFY5VVNVeEZVMTlUU1ZwRkF4d1ZRVlZFU1U5ZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXljUlFWVkVTVTlmUWxWR1JrVlNYMU5KV2tVREtCbERTRUZPVGtWTVh6RmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4OFZRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOVRTVnBGQXlBWlEwaEJUazVGVEY4eVgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNaEZVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlUwbGFSUU1pR1VOSVFVNU9SVXhmTTE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESXhWRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDFOSldrVURKQmxEU0VGT1RrVk1YelJmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeVVWUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlUU1ZwRkF5WVdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNcEVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTXFFVUpQVDFSZlVrOU5YMHhQUTBGVVNVOU9BeXNOUWs5UFZGOVNUMDFmVTBsYVJRTXNGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RExSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURMaDFFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNdkdVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMU5KV2tVRE1DRm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUhCdHpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUEzUUVkY21WelpYUlFjbTluY21GdFEyOTFiblJsY2tKeVpXRnJjRzlwYm5RQTNnRVpjMlYwVW1WaFpFZGlUV1Z0YjNKNVFuSmxZV3R3YjJsdWRBRGZBUnR5WlhObGRGSmxZV1JIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBNEFFYWMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTRRRWNjbVZ6WlhSWGNtbDBaVWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURpQVF4blpYUlNaV2RwYzNSbGNrRUE0d0VNWjJWMFVtVm5hWE4wWlhKQ0FPUUJER2RsZEZKbFoybHpkR1Z5UXdEbEFReG5aWFJTWldkcGMzUmxja1FBNWdFTVoyVjBVbVZuYVhOMFpYSkZBT2NCREdkbGRGSmxaMmx6ZEdWeVNBRG9BUXhuWlhSU1pXZHBjM1JsY2t3QTZRRU1aMlYwVW1WbmFYTjBaWEpHQU9vQkVXZGxkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFPc0JEMmRsZEZOMFlXTnJVRzlwYm5SbGNnRHNBUmxuWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnlBTzBCQldkbGRFeFpBTzRCSFdSeVlYZENZV05yWjNKdmRXNWtUV0Z3Vkc5WFlYTnRUV1Z0YjNKNUFPOEJHR1J5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVRRHdBUk5rY21GM1QyRnRWRzlYWVhOdFRXVnRiM0o1QVBFQkJtZGxkRVJKVmdEeUFRZG5aWFJVU1UxQkFQTUJCbWRsZEZSTlFRRDBBUVpuWlhSVVFVTUE5UUVUZFhCa1lYUmxSR1ZpZFdkSFFrMWxiVzl5ZVFEMkFRZ0M5d0VLaFpzQy9RR2dBZ0VFZnlBQktBSUFJZ05CQVhGRkJFQkJBRUVZUVpVQ1FRMFFBQUFMSUFOQmZIRWlBa0VRVHdSL0lBSkI4UC8vL3dOSkJVRUFDMFVFUUVFQVFSaEJsd0pCRFJBQUFBc2dBa0dBQWtrRWZ5QUNRUVIySVFKQkFBVWdBa0VmSUFKbmF5SURRUVJyZGtFUWN5RUNJQU5CQjJzTElnTkJGMGtFZnlBQ1FSQkpCVUVBQzBVRVFFRUFRUmhCcEFKQkRSQUFBQXNnQVNnQ0ZDRUVJQUVvQWhBaUJRUkFJQVVnQkRZQ0ZBc2dCQVJBSUFRZ0JUWUNFQXNnQTBFRWRDQUNha0VDZENBQWFpZ0NZQ0FCUmdSQUlBTkJCSFFnQW1wQkFuUWdBR29nQkRZQ1lDQUVSUVJBSUFOQkFuUWdBR29nQTBFQ2RDQUFhaWdDQkVFQklBSjBRWDl6Y1NJQk5nSUVJQUZGQkVBZ0FDQUFLQUlBUVFFZ0EzUkJmM054TmdJQUN3c0xDLzBEQVFaL0lBRkZCRUJCQUVFWVFjMEJRUTBRQUFBTElBRW9BZ0FpQTBFQmNVVUVRRUVBUVJoQnp3RkJEUkFBQUFzZ0FVRVFhaUFCS0FJQVFYeHhhaUlFS0FJQUlnVkJBWEVFUUNBRFFYeHhRUkJxSUFWQmZIRnFJZ0pCOFAvLy93TkpCRUFnQUNBRUVBRWdBU0FEUVFOeElBSnlJZ00yQWdBZ0FVRVFhaUFCS0FJQVFYeHhhaUlFS0FJQUlRVUxDeUFEUVFKeEJFQWdBVUVFYXlnQ0FDSUNLQUlBSWdaQkFYRkZCRUJCQUVFWVFlUUJRUThRQUFBTElBWkJmSEZCRUdvZ0EwRjhjV29pQjBIdy8vLy9BMGtFZnlBQUlBSVFBU0FDSUFaQkEzRWdCM0lpQXpZQ0FDQUNCU0FCQ3lFQkN5QUVJQVZCQW5JMkFnQWdBMEY4Y1NJQ1FSQlBCSDhnQWtIdy8vLy9BMGtGUVFBTFJRUkFRUUJCR0VIekFVRU5FQUFBQ3lBRUlBRkJFR29nQW1wSEJFQkJBRUVZUWZRQlFRMFFBQUFMSUFSQkJHc2dBVFlDQUNBQ1FZQUNTUVIvSUFKQkJIWWhCRUVBQlNBQ1FSOGdBbWRySWdKQkJHdDJRUkJ6SVFRZ0FrRUhhd3NpQTBFWFNRUi9JQVJCRUVrRlFRQUxSUVJBUVFCQkdFR0VBa0VORUFBQUN5QURRUVIwSUFScVFRSjBJQUJxS0FKZ0lRSWdBVUVBTmdJUUlBRWdBallDRkNBQ0JFQWdBaUFCTmdJUUN5QURRUVIwSUFScVFRSjBJQUJxSUFFMkFtQWdBQ0FBS0FJQVFRRWdBM1J5TmdJQUlBTkJBblFnQUdvZ0EwRUNkQ0FBYWlnQ0JFRUJJQVIwY2pZQ0JBdkxBUUVDZnlBQ1FROXhSVUVBSUFGQkQzRkZRUUFnQVNBQ1RSc2JSUVJBUVFCQkdFR0NBMEVFRUFBQUN5QUFLQUtnRENJREJFQWdBU0FEUVJCcVNRUkFRUUJCR0VHTUEwRVBFQUFBQ3lBQlFSQnJJQU5HQkVBZ0F5Z0NBQ0VFSUFGQkVHc2hBUXNGSUFFZ0FFR2tER3BKQkVCQkFFRVlRWmdEUVFRUUFBQUxDeUFDSUFGcklnSkJNRWtFUUE4TElBRWdCRUVDY1NBQ1FTQnJRUUZ5Y2pZQ0FDQUJRUUEyQWhBZ0FVRUFOZ0lVSUFFZ0FtcEJFR3NpQWtFQ05nSUFJQUFnQWpZQ29Bd2dBQ0FCRUFJTGx3RUJBbjlCQVQ4QUlnQktCSDlCQVNBQWEwQUFRUUJJQlVFQUN3UkFBQXRCb0FKQkFEWUNBRUhBRGtFQU5nSUFRUUFoQUFOQUFrQWdBRUVYVHcwQUlBQkJBblJCb0FKcVFRQTJBZ1JCQUNFQkEwQUNRQ0FCUVJCUERRQWdBRUVFZENBQmFrRUNkRUdnQW1wQkFEWUNZQ0FCUVFGcUlRRU1BUXNMSUFCQkFXb2hBQXdCQ3d0Qm9BSkIwQTQvQUVFUWRCQURRYUFDSkFBTExRQWdBRUh3Ly8vL0EwOEVRRUhJQUVFWVFja0RRUjBRQUFBTElBQkJEMnBCY0hFaUFFRVFJQUJCRUVzYkM5MEJBUUYvSUFGQmdBSkpCSDhnQVVFRWRpRUJRUUFGSUFGQitQLy8vd0ZKQkVCQkFVRWJJQUZuYTNRZ0FXcEJBV3NoQVFzZ0FVRWZJQUZuYXlJQ1FRUnJka0VRY3lFQklBSkJCMnNMSWdKQkYwa0VmeUFCUVJCSkJVRUFDMFVFUUVFQVFSaEIwZ0pCRFJBQUFBc2dBa0VDZENBQWFpZ0NCRUYvSUFGMGNTSUJCSDhnQVdnZ0FrRUVkR3BCQW5RZ0FHb29BbUFGSUFBb0FnQkJmeUFDUVFGcWRIRWlBUVIvSUFGb0lnRkJBblFnQUdvb0FnUWlBa1VFUUVFQVFSaEIzd0pCRVJBQUFBc2dBbWdnQVVFRWRHcEJBblFnQUdvb0FtQUZRUUFMQ3dzN0FRRi9JQUFvQWdRaUFVR0FnSUNBQjNGQmdJQ0FnQUZIQkVBZ0FDQUJRZi8vLy85NGNVR0FnSUNBQVhJMkFnUWdBRUVRYWtFQ0VQa0JDd3N0QVFGL0lBRW9BZ0FpQWtFQmNRUkFRUUJCR0VHekJFRUNFQUFBQ3lBQklBSkJBWEkyQWdBZ0FDQUJFQUlMSFFBZ0FDQUFLQUlFUWYvLy8vOTRjVFlDQkNBQVFSQnFRUVFRK1FFTFR3RUJmeUFBS0FJRUlnRkJnSUNBZ0FkeFFZQ0FnSUFCUmdSQUlBRkIvLy8vL3dCeFFRQkxCRUFnQUJBSkJTQUFJQUZCLy8vLy8zaHhRWUNBZ0lBQ2NqWUNCQ0FBUVJCcVFRTVErUUVMQ3d0S0FRRi9JQUFvQWdRaUFVR0FnSUNBQjNGQmdJQ0FnQUpHQkg4Z0FVR0FnSUNBZUhGRkJVRUFDd1JBSUFBZ0FVSC8vLy8vZUhFMkFnUWdBRUVRYWtFRkVQa0JJd0FnQUJBSUN3dnpBUUVHZnlNQ0lnVWlBaUVESXdNaEFBTkFBa0FnQXlBQVR3MEFJQU1vQWdBaUJDZ0NCQ0lCUVlDQWdJQUhjVUdBZ0lDQUEwWUVmeUFCUWYvLy8vOEFjVUVBU3dWQkFBc0VRQ0FFRUFjZ0FpQUVOZ0lBSUFKQkJHb2hBZ1ZCQUNBQlFmLy8vLzhBY1VVZ0FVR0FnSUNBQjNFYkJFQWpBQ0FFRUFnRklBUWdBVUgvLy8vL0IzRTJBZ1FMQ3lBRFFRUnFJUU1NQVFzTElBSWtBeUFGSVFBRFFBSkFJQUFnQWs4TkFDQUFLQUlBRUFvZ0FFRUVhaUVBREFFTEN5QUZJUUFEUUFKQUlBQWdBazhOQUNBQUtBSUFJZ0VnQVNnQ0JFSC8vLy8vQjNFMkFnUWdBUkFMSUFCQkJHb2hBQXdCQ3dzZ0JTUURDMjhCQVg4L0FDSUNJQUZCK1AvLy93RkpCSDlCQVVFYklBRm5hM1JCQVdzZ0FXb0ZJQUVMUVJBZ0FDZ0NvQXdnQWtFUWRFRVFhMGQwYWtILy93TnFRWUNBZkhGQkVIWWlBU0FDSUFGS0cwQUFRUUJJQkVBZ0FVQUFRUUJJQkVBQUN3c2dBQ0FDUVJCMFB3QkJFSFFRQXd1SEFRRUNmeUFCS0FJQUlRTWdBa0VQY1FSQVFRQkJHRUh0QWtFTkVBQUFDeUFEUVh4eElBSnJJZ1JCSUU4RVFDQUJJQU5CQW5FZ0FuSTJBZ0FnQVVFUWFpQUNhaUlCSUFSQkVHdEJBWEkyQWdBZ0FDQUJFQUlGSUFFZ0EwRitjVFlDQUNBQlFSQnFJQUVvQWdCQmZIRnFJQUZCRUdvZ0FTZ0NBRUY4Y1dvb0FnQkJmWEUyQWdBTEM1RUJBUUovSXdFRVFFRUFRUmhCNWdOQkRSQUFBQXNnQUNBQkVBVWlBeEFHSWdKRkJFQkJBU1FCRUF4QkFDUUJJQUFnQXhBR0lnSkZCRUFnQUNBREVBMGdBQ0FERUFZaUFrVUVRRUVBUVJoQjhnTkJFeEFBQUFzTEN5QUNLQUlBUVh4eElBTkpCRUJCQUVFWVFmb0RRUTBRQUFBTElBSkJBRFlDQkNBQ0lBRTJBZ3dnQUNBQ0VBRWdBQ0FDSUFNUURpQUNDeUlCQVg4akFDSUNCSDhnQWdVUUJDTUFDeUFBRUE4aUFDQUJOZ0lJSUFCQkVHb0xVUUVCZnlBQUtBSUVJZ0ZCZ0lDQWdIOXhJQUZCQVdwQmdJQ0FnSDl4UndSQVFRQkJnQUZCNkFCQkFoQUFBQXNnQUNBQlFRRnFOZ0lFSUFBb0FnQkJBWEVFUUVFQVFZQUJRZXNBUVEwUUFBQUxDeFFBSUFCQm5BSkxCRUFnQUVFUWF4QVJDeUFBQ3ljQUlBQkJnQUlvQWdCTEJFQkJzQUZCNkFGQkZrRWJFQUFBQ3lBQVFRTjBRWVFDYWlnQ0FBdkVEQUVEZndOQUlBRkJBM0ZCQUNBQ0d3UkFJQUFpQTBFQmFpRUFJQUVpQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFGcklRSU1BUXNMSUFCQkEzRkZCRUFEUUNBQ1FSQkpSUVJBSUFBZ0FTZ0NBRFlDQUNBQVFRUnFJQUZCQkdvb0FnQTJBZ0FnQUVFSWFpQUJRUWhxS0FJQU5nSUFJQUJCREdvZ0FVRU1haWdDQURZQ0FDQUJRUkJxSVFFZ0FFRVFhaUVBSUFKQkVHc2hBZ3dCQ3dzZ0FrRUljUVJBSUFBZ0FTZ0NBRFlDQUNBQVFRUnFJQUZCQkdvb0FnQTJBZ0FnQVVFSWFpRUJJQUJCQ0dvaEFBc2dBa0VFY1FSQUlBQWdBU2dDQURZQ0FDQUJRUVJxSVFFZ0FFRUVhaUVBQ3lBQ1FRSnhCRUFnQUNBQkx3RUFPd0VBSUFGQkFtb2hBU0FBUVFKcUlRQUxJQUpCQVhFRVFDQUFJQUV0QUFBNkFBQUxEd3NnQWtFZ1R3UkFBa0FDUUFKQUlBQkJBM0VpQTBFQlJ3UkFJQU5CQWtZTkFTQURRUU5HRFFJTUF3c2dBU2dDQUNFRklBQWdBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFDQUNRUU5ySVFJRFFDQUNRUkZKUlFSQUlBQWdBVUVCYWlnQ0FDSURRUWgwSUFWQkdIWnlOZ0lBSUFCQkJHb2dBMEVZZGlBQlFRVnFLQUlBSWdOQkNIUnlOZ0lBSUFCQkNHb2dBMEVZZGlBQlFRbHFLQUlBSWdOQkNIUnlOZ0lBSUFCQkRHb2dBVUVOYWlnQ0FDSUZRUWgwSUFOQkdIWnlOZ0lBSUFGQkVHb2hBU0FBUVJCcUlRQWdBa0VRYXlFQ0RBRUxDd3dDQ3lBQktBSUFJUVVnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFKcklRSURRQ0FDUVJKSlJRUkFJQUFnQVVFQ2FpZ0NBQ0lEUVJCMElBVkJFSFp5TmdJQUlBQkJCR29nQTBFUWRpQUJRUVpxS0FJQUlnTkJFSFJ5TmdJQUlBQkJDR29nQTBFUWRpQUJRUXBxS0FJQUlnTkJFSFJ5TmdJQUlBQkJER29nQVVFT2FpZ0NBQ0lGUVJCMElBTkJFSFp5TmdJQUlBRkJFR29oQVNBQVFSQnFJUUFnQWtFUWF5RUNEQUVMQ3d3QkN5QUJLQUlBSVFVZ0FDSURRUUZxSVFBZ0FTSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUlBSkJBV3NoQWdOQUlBSkJFMGxGQkVBZ0FDQUJRUU5xS0FJQUlnTkJHSFFnQlVFSWRuSTJBZ0FnQUVFRWFpQURRUWgySUFGQkIyb29BZ0FpQTBFWWRISTJBZ0FnQUVFSWFpQURRUWgySUFGQkMyb29BZ0FpQTBFWWRISTJBZ0FnQUVFTWFpQUJRUTlxS0FJQUlnVkJHSFFnQTBFSWRuSTJBZ0FnQVVFUWFpRUJJQUJCRUdvaEFDQUNRUkJySVFJTUFRc0xDd3NnQWtFUWNRUkFJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSURRUUZxSVFBZ0FVRUJhaUlFUVFGcUlRRWdBeUFFTFFBQU9nQUFDeUFDUVFoeEJFQWdBQ0FCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQXNnQWtFRWNRUkFJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlEUVFGcUlRQWdBVUVCYWlJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBQ3lBQ1FRSnhCRUFnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQXNnQWtFQmNRUkFJQUFnQVMwQUFEb0FBQXNMMGdJQkFuOENRQ0FDSVFNZ0FDQUJSZzBBUVFFZ0FDQURhaUFCVFNBQklBTnFJQUJOR3dSQUlBQWdBU0FERUJRTUFRc2dBQ0FCU1FSQUlBRkJCM0VnQUVFSGNVWUVRQU5BSUFCQkIzRUVRQ0FEUlEwRUlBTkJBV3NoQXlBQUlnSkJBV29oQUNBQklnUkJBV29oQVNBQ0lBUXRBQUE2QUFBTUFRc0xBMEFnQTBFSVNVVUVRQ0FBSUFFcEF3QTNBd0FnQTBFSWF5RURJQUJCQ0dvaEFDQUJRUWhxSVFFTUFRc0xDd05BSUFNRVFDQUFJZ0pCQVdvaEFDQUJJZ1JCQVdvaEFTQUNJQVF0QUFBNkFBQWdBMEVCYXlFRERBRUxDd1VnQVVFSGNTQUFRUWR4UmdSQUEwQWdBQ0FEYWtFSGNRUkFJQU5GRFFRZ0FDQURRUUZySWdOcUlBRWdBMm90QUFBNkFBQU1BUXNMQTBBZ0EwRUlTVVVFUUNBQUlBTkJDR3NpQTJvZ0FTQURhaWtEQURjREFBd0JDd3NMQTBBZ0F3UkFJQUFnQTBFQmF5SURhaUFCSUFOcUxRQUFPZ0FBREFFTEN3c0xDemdBSXdCRkJFQkJBRUVZUWRFRVFRMFFBQUFMSUFCQkQzRkZRUUFnQUJ0RkJFQkJBRUVZUWRJRVFRSVFBQUFMSXdBZ0FFRVFheEFJQzBVQkJIOGpBeU1DSWdGcklnSkJBWFFpQUVHQUFpQUFRWUFDU3hzaUEwRUFFQkFpQUNBQklBSVFGU0FCQkVBZ0FSQVdDeUFBSkFJZ0FDQUNhaVFESUFBZ0Eyb2tCQXNpQVFGL0l3TWlBU01FVHdSQUVCY2pBeUVCQ3lBQklBQTJBZ0FnQVVFRWFpUURDN1lCQVFKL0lBQW9BZ1FpQWtILy8vLy9BSEVoQVNBQUtBSUFRUUZ4QkVCQkFFR0FBVUh6QUVFTkVBQUFDeUFCUVFGR0JFQWdBRUVRYWtFQkVQa0JJQUpCZ0lDQWdIaHhCRUFnQUVHQWdJQ0FlRFlDQkFVakFDQUFFQWdMQlNBQlFRQk5CRUJCQUVHQUFVSDhBRUVQRUFBQUN5QUFLQUlJRUJOQkVIRUVRQ0FBSUFGQkFXc2dBa0dBZ0lDQWYzRnlOZ0lFQlNBQUlBRkJBV3RCZ0lDQWdIdHlOZ0lFSUFKQmdJQ0FnSGh4UlFSQUlBQVFHQXNMQ3dzU0FDQUFRWndDU3dSQUlBQkJFR3NRR1FzTFV3QkI4dVhMQnlRK1FhREJnZ1VrUDBIWXNPRUNKRUJCaUpBZ0pFRkI4dVhMQnlSQ1FhREJnZ1VrUTBIWXNPRUNKRVJCaUpBZ0pFVkI4dVhMQnlSR1FhREJnZ1VrUjBIWXNPRUNKRWhCaUpBZ0pFa0xsd0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkRIVWlBUVJBSUFGQkFVWU5BUUpBSUFGQkFtc09EQUlDQXdNREF3UUVCUVVHQndBTERBY0xJNEFDQkVBamdRSUVRQ0FBUVlBQ1NBMEpJQUJCZ0JKSVFRQWdBRUgvQTBvYkRRa0ZRUUFnQUVHQUFrZ2pnUUliRFFrTEN3c2dBRUdBcmRFQWFnOExJQUJCQVNQeUFTSUFRUUFnQUVVaitnRWJHMEVPZEdwQmdLM1FBR29QQ3lBQVFZQ1FmbW9qZ1FJRWYwSFAvZ01RSFVFQmNRVkJBQXRCRFhScUR3c2dBQ1B6QVVFTmRHcEJnTm5HQUdvUEN5QUFRWUNRZm1vUEMwRUFJUUVDZnlPQkFnUkFRZkQrQXhBZFFRZHhJUUVMSUFGQkFVZ0xCSDlCQVFVZ0FRdEJESFFnQUdwQmdQQjlhZzhMSUFCQmdGQnFEd3NnQUVHQW1kRUFhZ3NKQUNBQUVCd3RBQUFMd3dFQVFRQWtnZ0pCQUNTREFrRUFKSVFDUVFBa2hRSkJBQ1NHQWtFQUpJY0NRUUFraUFKQkFDU0pBa0VBSklvQ1FRQWtpd0pCQUNTTUFrRUFKSTBDUVFBa2pnSkJBQ1NQQWtFQUpKQUNRUUFra1FJamdBSUVRQThMSTRFQ0JFQkJFU1NEQWtHQUFTU0tBa0VBSklRQ1FRQWtoUUpCL3dFa2hnSkIxZ0FraHdKQkFDU0lBa0VOSklrQ0JVRUJKSU1DUWJBQkpJb0NRUUFraEFKQkV5U0ZBa0VBSklZQ1FkZ0JKSWNDUVFFa2lBSkJ6UUFraVFJTFFZQUNKSXdDUWY3L0F5U0xBZ3NMQUNBQUVCd2dBVG9BQUF0ekFRRi9RUUFrOUFGQkFTVDFBVUhIQWhBZElnQkZKUFlCSUFCQkEweEJBQ0FBUVFGT0d5VDNBU0FBUVFaTVFRQWdBRUVGVGhzaytBRWdBRUVUVEVFQUlBQkJEMDRiSlBrQklBQkJIa3hCQUNBQVFSbE9HeVQ2QVVFQkpQSUJRUUFrOHdGQnovNERRUUFRSDBIdy9nTkJBUkFmQ3k4QVFkSCtBMEgvQVJBZlFkTCtBMEgvQVJBZlFkUCtBMEgvQVJBZlFkVCtBMEgvQVJBZlFkWCtBMEgvQVJBZkM3QUlBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZ3NEQkFVR0J3Z0pDZ3NNRFFBTERBMExRZkxseXdja1BrR2d3WUlGSkQ5QjJMRGhBaVJBUVlpUUlDUkJRZkxseXdja1FrR2d3WUlGSkVOQjJMRGhBaVJFUVlpUUlDUkZRZkxseXdja1JrR2d3WUlGSkVkQjJMRGhBaVJJUVlpUUlDUkpEQXdMUWYvLy93Y2tQa0hqMnY0SEpEOUJnT0tRQkNSQVFRQWtRVUgvLy84SEpFSkI0OXIrQnlSRFFZRGlrQVFrUkVFQUpFVkIvLy8vQnlSR1FlUGEvZ2NrUjBHQTRwQUVKRWhCQUNSSkRBc0xRZi8vL3dja1BrR0VpZjRISkQ5QnV2VFFCQ1JBUVFBa1FVSC8vLzhISkVKQnNmN3ZBeVJEUVlDSUFpUkVRUUFrUlVILy8vOEhKRVpCLzh1T0F5UkhRZjhCSkVoQkFDUkpEQW9MUWNYTi93Y2tQa0dFdWJvR0pEOUJxZGFSQkNSQVFZamk2QUlrUVVILy8vOEhKRUpCNDlyK0J5UkRRWURpa0FRa1JFRUFKRVZCLy8vL0J5UkdRZVBhL2dja1IwR0E0cEFFSkVoQkFDUkpEQWtMUWYvLy93Y2tQa0dBL3NzQ0pEOUJnSVQ5QnlSQVFRQWtRVUgvLy84SEpFSkJnUDdMQWlSRFFZQ0UvUWNrUkVFQUpFVkIvLy8vQnlSR1FZRCt5d0lrUjBHQWhQMEhKRWhCQUNSSkRBZ0xRZi8vL3dja1BrR3gvdThESkQ5QnhjY0JKRUJCQUNSQlFmLy8vd2NrUWtHRWlmNEhKRU5CdXZUUUJDUkVRUUFrUlVILy8vOEhKRVpCaEluK0J5UkhRYnIwMEFRa1NFRUFKRWtNQnd0QkFDUStRWVNKQWlRL1FZQzgvd2NrUUVILy8vOEhKRUZCQUNSQ1FZU0pBaVJEUVlDOC93Y2tSRUgvLy84SEpFVkJBQ1JHUVlTSkFpUkhRWUM4L3dja1NFSC8vLzhISkVrTUJndEJwZi8vQnlRK1FaU3AvZ2NrUDBIL3FkSUVKRUJCQUNSQlFhWC8vd2NrUWtHVXFmNEhKRU5CLzZuU0JDUkVRUUFrUlVHbC8vOEhKRVpCbEtuK0J5UkhRZitwMGdRa1NFRUFKRWtNQlF0Qi8vLy9CeVErUVlEKy93Y2tQMEdBZ1B3SEpFQkJBQ1JCUWYvLy93Y2tRa0dBL3Y4SEpFTkJnSUQ4QnlSRVFRQWtSVUgvLy84SEpFWkJnUDcvQnlSSFFZQ0EvQWNrU0VFQUpFa01CQXRCLy8vL0J5UStRWUQrL3dja1AwR0FsTzBESkVCQkFDUkJRZi8vL3dja1FrSC95NDRESkVOQi93RWtSRUVBSkVWQi8vLy9CeVJHUWJIKzd3TWtSMEdBaUFJa1NFRUFKRWtNQXd0Qi8vLy9CeVErUWYvTGpnTWtQMEgvQVNSQVFRQWtRVUgvLy84SEpFSkJoSW4rQnlSRFFicjAwQVFrUkVFQUpFVkIvLy8vQnlSR1FiSCs3d01rUjBHQWlBSWtTRUVBSkVrTUFndEIvLy8vQnlRK1FkNlpzZ1FrUDBHTXBja0NKRUJCQUNSQlFmLy8vd2NrUWtHRWlmNEhKRU5CdXZUUUJDUkVRUUFrUlVILy8vOEhKRVpCNDlyK0J5UkhRWURpa0FRa1NFRUFKRWtNQVF0Qi8vLy9CeVErUWFYTGxnVWtQMEhTcE1rQ0pFQkJBQ1JCUWYvLy93Y2tRa0dseTVZRkpFTkIwcVRKQWlSRVFRQWtSVUgvLy84SEpFWkJwY3VXQlNSSFFkS2t5UUlrU0VFQUpFa0xDOW9JQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlnQlJ3UkFJQUJCNFFCR0RRRWdBRUVVUmcwQ0lBQkJ4Z0JHRFFNZ0FFSFpBRVlOQkNBQVFjWUJSZzBFSUFCQmhnRkdEUVVnQUVHb0FVWU5CU0FBUWI4QlJnMEdJQUJCemdGR0RRWWdBRUhSQVVZTkJpQUFRZkFCUmcwR0lBQkJKMFlOQnlBQVFja0FSZzBISUFCQjNBQkdEUWNnQUVHekFVWU5CeUFBUWNrQlJnMElJQUJCOEFCR0RRa2dBRUhHQUVZTkNpQUFRZE1CUmcwTERBd0xRZis1bGdVa1BrR0EvdjhISkQ5QmdNWUJKRUJCQUNSQlFmKzVsZ1VrUWtHQS92OEhKRU5CZ01ZQkpFUkJBQ1JGUWYrNWxnVWtSa0dBL3Y4SEpFZEJnTVlCSkVoQkFDUkpEQXNMUWYvLy93Y2tQa0gveTQ0REpEOUIvd0VrUUVFQUpFRkIvLy8vQnlSQ1FZU0ovZ2NrUTBHNjlOQUVKRVJCQUNSRlFmLy8vd2NrUmtIL3k0NERKRWRCL3dFa1NFRUFKRWtNQ2d0Qi8vLy9CeVErUVlTSi9nY2tQMEc2OU5BRUpFQkJBQ1JCUWYvLy93Y2tRa0d4L3U4REpFTkJnSWdDSkVSQkFDUkZRZi8vL3dja1JrR0VpZjRISkVkQnV2VFFCQ1JJUVFBa1NRd0pDMEgvNjlZRkpENUJsUC8vQnlRL1FjSzB0UVVrUUVFQUpFRkJBQ1JDUWYvLy93Y2tRMEdFaWY0SEpFUkJ1dlRRQkNSRlFRQWtSa0gvLy84SEpFZEJoSW4rQnlSSVFicjAwQVFrU1F3SUMwSC8vLzhISkQ1QmhOdTJCU1EvUWZ2bWlRSWtRRUVBSkVGQi8vLy9CeVJDUVlEbS9RY2tRMEdBaE5FRUpFUkJBQ1JGUWYvLy93Y2tSa0gvKytvQ0pFZEJnSUQ4QnlSSVFmOEJKRWtNQnd0Qm5QLy9CeVErUWYvcjBnUWtQMEh6cUk0REpFQkJ1dlFBSkVGQndvci9CeVJDUVlDcy93Y2tRMEdBOU5BRUpFUkJnSUNvQWlSRlFmLy8vd2NrUmtHRWlmNEhKRWRCdXZUUUJDUklRUUFrU1F3R0MwR0EvcThESkQ1Qi8vLy9CeVEvUWNxay9RY2tRRUVBSkVGQi8vLy9CeVJDUWYvLy93Y2tRMEgveTQ0REpFUkIvd0VrUlVILy8vOEhKRVpCNDlyK0J5UkhRWURpa0FRa1NFRUFKRWtNQlF0Qi83bVdCU1ErUVlEKy93Y2tQMEdBeGdFa1FFRUFKRUZCMHNiOUJ5UkNRWUNBMkFZa1EwR0FnSXdESkVSQkFDUkZRZjhCSkVaQi8vLy9CeVJIUWZ2Ky93Y2tTRUgvaVFJa1NRd0VDMEhPLy84SEpENUI3OStQQXlRL1FiR0k4Z1FrUUVIYXRPa0NKRUZCLy8vL0J5UkNRWURtL1Fja1EwR0FoTkVFSkVSQkFDUkZRZi8vL3dja1JrSC95NDRESkVkQi93RWtTRUVBSkVrTUF3dEIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHQS9nTWtRMEdBaU1ZQkpFUkJnSlFCSkVWQi8vLy9CeVJHUWYvTGpnTWtSMEgvQVNSSVFRQWtTUXdDQzBILy8vOEhKRDVCLzh1T0F5US9RZjhCSkVCQkFDUkJRWUQrL3dja1FrR0FnUHdISkVOQmdJQ01BeVJFUVFBa1JVSC8vLzhISkVaQnNmN3ZBeVJIUVlDSUFpUklRUUFrU1F3QkMwSC8vLzhISkQ1QmhOdTJCU1EvUWZ2bWlRSWtRRUVBSkVGQi8vLy9CeVJDUWVQYS9nY2tRMEhqMnY0SEpFUkJBQ1JGUWYvLy93Y2tSa0gveTQ0REpFZEIvd0VrU0VFQUpFa0xDMG9CQW45QkFCQWlJNEVDQkVBUEN5T0FBZ1JBSTRFQ1JRUkFEd3NMUWJRQ0lRQURRQUpBSUFCQnd3SktEUUFnQUJBZElBRnFJUUVnQUVFQmFpRUFEQUVMQ3lBQlFmOEJjUkFqQzl3QkFFRUFKT3NCUVFBazdBRkJBQ1R0QVVFQUpPNEJRUUFrN3dGQkFDVHdBVUVBSlBFQlFaQUJKTzBCSTRFQ0JFQkJ3ZjREUVlFQkVCOUJ4UDREUVpBQkVCOUJ4LzREUWZ3QkVCOEZRY0grQTBHRkFSQWZRY2IrQTBIL0FSQWZRY2YrQTBIOEFSQWZRY2orQTBIL0FSQWZRY24rQTBIL0FSQWZDMEdRQVNUdEFVSEEvZ05Ca0FFUUgwSFAvZ05CQUJBZlFmRCtBMEVCRUI4amdBSUVRQ09CQWdSQVFRQWs3UUZCd1A0RFFRQVFIMEhCL2dOQmdBRVFIMEhFL2dOQkFCQWZCVUVBSk8wQlFjRCtBMEVBRUI5QndmNERRWVFCRUI4TEN4QWtDMjBBSTRFQ0JFQkI2UDREUWNBQkVCOUI2ZjREUWY4QkVCOUI2djREUWNFQkVCOUI2LzREUVEwUUh3VkI2UDREUWY4QkVCOUI2ZjREUWY4QkVCOUI2djREUWY4QkVCOUI2LzREUWY4QkVCOExJNEVDUVFBamdBSWJCRUJCNmY0RFFTQVFIMEhyL2dOQmlnRVFId3NMVmdCQmtQNERRWUFCRUI5QmtmNERRYjhCRUI5Qmt2NERRZk1CRUI5QmsvNERRY0VCRUI5QmxQNERRYjhCRUI4amdBSUVRRUdSL2dOQlB4QWZRWkwrQTBFQUVCOUJrLzREUVFBUUgwR1UvZ05CdUFFUUh3c0xMQUJCbGY0RFFmOEJFQjlCbHY0RFFUOFFIMEdYL2dOQkFCQWZRWmorQTBFQUVCOUJtZjREUWJnQkVCOExNd0JCbXY0RFFmOEFFQjlCbS80RFFmOEJFQjlCblA0RFFaOEJFQjlCbmY0RFFRQVFIMEdlL2dOQnVBRVFIMEVCSklZQkN5MEFRWi8rQTBIL0FSQWZRYUQrQTBIL0FSQWZRYUgrQTBFQUVCOUJvdjREUVFBUUgwR2ovZ05CdndFUUh3dGNBQ0FBUVlBQmNVRUFSeVN0QVNBQVFjQUFjVUVBUnlTc0FTQUFRU0J4UVFCSEpLc0JJQUJCRUhGQkFFY2txZ0VnQUVFSWNVRUFSeVN4QVNBQVFRUnhRUUJISkxBQklBQkJBbkZCQUVja3J3RWdBRUVCY1VFQVJ5U3VBUXRGQUVFUEpKb0JRUThrbXdGQkR5U2NBVUVQSkowQlFRQWtuZ0ZCQUNTZkFVRUFKS0FCUVFBa29RRkIvd0Frb2dGQi93QWtvd0ZCQVNTa0FVRUJKS1VCUVFBa3BnRUx2UUVBUVFBa3B3RkJBQ1NvQVVFQUpLa0JRUUVrcWdGQkFTU3JBVUVCSkt3QlFRRWtyUUZCQVNTdUFVRUJKSzhCUVFFa3NBRkJBU1N4QVVFQkpMSUJRUUFrc3dGQkFDUzBBVUVBSkxVQlFRQWt0Z0VRSnhBb0VDa1FLa0drL2dOQjl3QVFIMEVISktnQlFRY2txUUZCcGY0RFFmTUJFQjlCOHdFUUswR20vZ05COFFFUUgwRUJKTElCSTRBQ0JFQkJwUDREUVFBUUgwRUFKS2dCUVFBa3FRRkJwZjREUVFBUUgwRUFFQ3RCcHY0RFFmQUFFQjlCQUNTeUFRc1FMQXMrQUNBQVFRRnhRUUJISkxvQklBQkJBbkZCQUVja3V3RWdBRUVFY1VFQVJ5UzhBU0FBUVFoeFFRQkhKTDBCSUFCQkVIRkJBRWNrdmdFZ0FDUzVBUXMrQUNBQVFRRnhRUUJISk1BQklBQkJBbkZCQUVja3dRRWdBRUVFY1VFQVJ5VENBU0FBUVFoeFFRQkhKTU1CSUFCQkVIRkJBRWNreEFFZ0FDUy9BUXQ0QUVFQUpNVUJRUUFreGdGQkFDVEhBVUVBSk1vQlFRQWt5d0ZCQUNUTUFVRUFKTWdCUVFBa3lRRWpnUUlFUUVHRS9nTkJIaEFmUWFBOUpNWUJCVUdFL2dOQnF3RVFIMEhNMXdJa3hnRUxRWWYrQTBINEFSQWZRZmdCSk13Qkk0QUNCRUFqZ1FKRkJFQkJoUDREUVFBUUgwRUVKTVlCQ3dzTFF3QkJBQ1ROQVVFQUpNNEJJNEVDQkVCQmd2NERRZndBRUI5QkFDVFBBVUVBSk5BQlFRQWswUUVGUVlMK0EwSCtBQkFmUVFBa3p3RkJBU1RRQVVFQUpORUJDd3QxQUNPQkFnUkFRZkQrQTBINEFSQWZRYy8rQTBIK0FSQWZRYzMrQTBIK0FCQWZRWUQrQTBIUEFSQWZRWS8rQTBIaEFSQWZRZXorQTBIK0FSQWZRZlgrQTBHUEFSQWZCVUh3L2dOQi93RVFIMEhQL2dOQi93RVFIMEhOL2dOQi93RVFIMEdBL2dOQnp3RVFIMEdQL2dOQjRRRVFId3NMbGdFQkFYOUJ3d0lRSFNJQVFjQUJSZ1IvUVFFRklBQkJnQUZHUVFBak5Sc0xCRUJCQVNTQkFnVkJBQ1NCQWd0QkFDU1lBa0dBcU5hNUJ5U1NBa0VBSkpNQ1FRQWtsQUpCZ0tqV3VRY2tsUUpCQUNTV0FrRUFKSmNDSXpRRVFFRUJKSUFDQlVFQUpJQUNDeEFlRUNBUUlSQWxFQ1lRTFVFQUVDNUIvLzhESTdrQkVCOUI0UUVRTDBHUC9nTWp2d0VRSHhBd0VERVFNZ3RLQUNBQVFRQktKRFFnQVVFQVNpUTFJQUpCQUVva05pQURRUUJLSkRjZ0JFRUFTaVE0SUFWQkFFb2tPU0FHUVFCS0pEb2dCMEVBU2lRN0lBaEJBRW9rUENBSlFRQktKRDBRTXdzRkFDT1lBZ3U1QVFCQmdBZ2pnd0k2QUFCQmdRZ2poQUk2QUFCQmdnZ2poUUk2QUFCQmd3Z2poZ0k2QUFCQmhBZ2pod0k2QUFCQmhRZ2ppQUk2QUFCQmhnZ2ppUUk2QUFCQmh3Z2ppZ0k2QUFCQmlBZ2ppd0k3QVFCQmlnZ2pqQUk3QVFCQmpBZ2pqUUkyQWdCQmtRZ2pqZ0pCQUVjNkFBQkJrZ2dqandKQkFFYzZBQUJCa3dnamtBSkJBRWM2QUFCQmxBZ2prUUpCQUVjNkFBQkJsUWdqZ0FKQkFFYzZBQUJCbGdnamdRSkJBRWM2QUFCQmx3Z2pnZ0pCQUVjNkFBQUxhQUJCeUFrajhnRTdBUUJCeWdrajh3RTdBUUJCekFrajlBRkJBRWM2QUFCQnpRa2o5UUZCQUVjNkFBQkJ6Z2tqOWdGQkFFYzZBQUJCendrajl3RkJBRWM2QUFCQjBBa2orQUZCQUVjNkFBQkIwUWtqK1FGQkFFYzZBQUJCMGdraitnRkJBRWM2QUFBTE5RQkIrZ2tqeFFFMkFnQkIvZ2tqeGdFMkFnQkJnZ29qeUFGQkFFYzZBQUJCaFFvanlRRkJBRWM2QUFCQmhmNERJOGNCRUI4TFl3QkIzZ29qV0VFQVJ6b0FBRUhmQ2lOYk5nSUFRZU1LSTF3MkFnQkI1d29qWGpZQ0FFSHNDaU5mTmdJQVFmRUtJMkE2QUFCQjhnb2pZVG9BQUVIM0NpTmlRUUJIT2dBQVFmZ0tJMk0yQWdCQi9Rb2paRHNCQUVIL0NpTmRRUUJIT2dBQUMwZ0FRWkFMSTI5QkFFYzZBQUJCa1FzamNqWUNBRUdWQ3lOek5nSUFRWmtMSTNVMkFnQkJuZ3NqZGpZQ0FFR2pDeU4zT2dBQVFhUUxJM2c2QUFCQnBRc2pkRUVBUnpvQUFBdEhBRUgwQ3lPUkFVRUFSem9BQUVIMUN5T1RBVFlDQUVINUN5T1VBVFlDQUVIOUN5T1dBVFlDQUVHQ0RDT1hBVFlDQUVHSERDT1pBVHNCQUVHSkRDT1ZBVUVBUnpvQUFBdUhBUUFRTmtHeUNDUHNBVFlDQUVHMkNDUGhBVG9BQUVIRS9nTWo3UUVRSDBIa0NDTzNBVUVBUnpvQUFFSGxDQ080QVVFQVJ6b0FBQkEzRURoQnJBb2pzd0UyQWdCQnNBb2p0QUU2QUFCQnNRb2p0UUU2QUFBUU9SQTZRY0lMSTM5QkFFYzZBQUJCd3dzamdnRTJBZ0JCeHdzamd3RTJBZ0JCeXdzamhBRTdBUUFRTzBFQUpKZ0NDN2tCQUVHQUNDMEFBQ1NEQWtHQkNDMEFBQ1NFQWtHQ0NDMEFBQ1NGQWtHRENDMEFBQ1NHQWtHRUNDMEFBQ1NIQWtHRkNDMEFBQ1NJQWtHR0NDMEFBQ1NKQWtHSENDMEFBQ1NLQWtHSUNDOEJBQ1NMQWtHS0NDOEJBQ1NNQWtHTUNDZ0NBQ1NOQWtHUkNDMEFBRUVBU2lTT0FrR1NDQzBBQUVFQVNpU1BBa0dUQ0MwQUFFRUFTaVNRQWtHVUNDMEFBRUVBU2lTUkFrR1ZDQzBBQUVFQVNpU0FBa0dXQ0MwQUFFRUFTaVNCQWtHWENDMEFBRUVBU2lTQ0FndGVBUUYvUVFBazdBRkJBQ1R0QVVIRS9nTkJBQkFmUWNIK0F4QWRRWHh4SVFGQkFDVGhBVUhCL2dNZ0FSQWZJQUFFUUFKQVFRQWhBQU5BSUFCQmdOZ0ZUZzBCSUFCQmdNa0Zha0gvQVRvQUFDQUFRUUZxSVFBTUFBQUxBQXNMQzRJQkFRRi9JK01CSVFFZ0FFR0FBWEZCQUVjazR3RWdBRUhBQUhGQkFFY2s1QUVnQUVFZ2NVRUFSeVRsQVNBQVFSQnhRUUJISk9ZQklBQkJDSEZCQUVjazV3RWdBRUVFY1VFQVJ5VG9BU0FBUVFKeFFRQkhKT2tCSUFCQkFYRkJBRWNrNmdFajR3RkZRUUFnQVJzRVFFRUJFRDRMUVFBajR3RWdBUnNFUUVFQUVENExDeW9BUWVRSUxRQUFRUUJLSkxjQlFlVUlMUUFBUVFCS0pMZ0JRZi8vQXhBZEVDNUJqLzRERUIwUUx3dG9BRUhJQ1M4QkFDVHlBVUhLQ1M4QkFDVHpBVUhNQ1MwQUFFRUFTaVQwQVVITkNTMEFBRUVBU2lUMUFVSE9DUzBBQUVFQVNpVDJBVUhQQ1MwQUFFRUFTaVQzQVVIUUNTMEFBRUVBU2lUNEFVSFJDUzBBQUVFQVNpVDVBVUhTQ1MwQUFFRUFTaVQ2QVF0SEFFSDZDU2dDQUNURkFVSCtDU2dDQUNUR0FVR0NDaTBBQUVFQVNpVElBVUdGQ2kwQUFFRUFTaVRKQVVHRi9nTVFIU1RIQVVHRy9nTVFIU1RLQVVHSC9nTVFIU1RNQVFzSEFFRUFKTFlCQzJNQVFkNEtMUUFBUVFCS0pGaEIzd29vQWdBa1cwSGpDaWdDQUNSY1FlY0tLQUlBSkY1QjdBb29BZ0FrWDBIeENpMEFBQ1JnUWZJS0xRQUFKR0ZCOXdvdEFBQkJBRW9rWWtINENpZ0NBQ1JqUWYwS0x3RUFKR1JCL3dvdEFBQkJBRW9rWFF0SUFFR1FDeTBBQUVFQVNpUnZRWkVMS0FJQUpISkJsUXNvQWdBa2MwR1pDeWdDQUNSMVFaNExLQUlBSkhaQm93c3RBQUFrZDBHa0N5MEFBQ1I0UWJFTExRQUFRUUJLSkhRTFJ3QkI5QXN0QUFCQkFFb2trUUZCOVFzb0FnQWtrd0ZCK1Fzb0FnQWtsQUZCL1Fzb0FnQWtsZ0ZCZ2d3b0FnQWtsd0ZCaHd3dkFRQWttUUZCaVF3dEFBQkJBRW9rbFFFTHpBRUJBWDhRUFVHeUNDZ0NBQ1RzQVVHMkNDMEFBQ1RoQVVIRS9nTVFIU1R0QVVIQS9nTVFIUkEvRUVCQmdQNERFQjFCL3dGekpOb0JJOW9CSWdCQkVIRkJBRWNrMndFZ0FFRWdjVUVBUnlUY0FSQkJFRUpCckFvb0FnQWtzd0ZCc0FvdEFBQWt0QUZCc1FvdEFBQWt0UUZCQUNTMkFSQkVFRVZCd2dzdEFBQkJBRW9rZjBIREN5Z0NBQ1NDQVVISEN5Z0NBQ1NEQVVITEN5OEJBQ1NFQVJCR1FRQWttQUpCZ0tqV3VRY2trZ0pCQUNTVEFrRUFKSlFDUVlDbzFya0hKSlVDUVFBa2xnSkJBQ1NYQWdzRkFDT0JBZ3NGQUNPVkFnc0ZBQ09XQWdzRkFDT1hBZ3V5QWdFR2Z5TkxJZ1VnQUVaQkFDTktJQVJHUVFBZ0FFRUlTa0VBSUFGQkFFb2JHeHNFUUNBRFFRRnJFQjFCSUhGQkFFY2hDQ0FERUIxQklIRkJBRWNoQ1VFQUlRTURRQ0FEUVFoSUJFQkJCeUFEYXlBRElBZ2dDVWNiSWdjZ0FHb2lBMEdnQVV3RVFDQUJRYUFCYkNBRGFrRURiRUdBeVFWcUlnUXRBQUFoQ2lBRUlBbzZBQUFnQVVHZ0FXd2dBMnBCQTJ4Qmdja0ZhaUFFTFFBQk9nQUFJQUZCb0FGc0lBTnFRUU5zUVlMSkJXb2dCQzBBQWpvQUFDQUJRYUFCYkNBRGFrR0FrUVJxSUFCQkFDQUhhMnNnQVVHZ0FXeHFRZmlRQkdvdEFBQWlBMEVEY1NJRVFRUnlJQVFnQTBFRWNSczZBQUFnQmtFQmFpRUdDeUFIUVFGcUlRTU1BUXNMQlNBRUpFb0xJQUFnQlU0RVFDQUFRUWhxSWdFZ0FrRUhjU0lDYWlBQklBQWdBa2diSVFVTElBVWtTeUFHQ3lrQUlBQkJnSkFDUmdSQUlBRkJnQUZySUFGQmdBRnFJQUZCZ0FGeEd5RUJDeUFCUVFSMElBQnFDMG9BSUFCQkEzUWdBVUVCZEdvaUFFRUJha0UvY1NJQlFVQnJJQUVnQWh0QmdKQUVhaTBBQUNFQklBQkJQM0VpQUVGQWF5QUFJQUliUVlDUUJHb3RBQUFnQVVIL0FYRkJDSFJ5QzhnQkFDQUJFQjBnQUVFQmRIVkJBM0VoQUNBQlFjaitBMFlFUUNOQ0lRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUXlFQkRBSUxJMFFoQVF3QkN5TkZJUUVMQlNBQlFjbitBMFlFUUNOR0lRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUnlFQkRBSUxJMGdoQVF3QkN5TkpJUUVMQlNNK0lRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUHlFQkRBSUxJMEFoQVF3QkN5TkJJUUVMQ3dzZ0FRdU1Bd0VHZnlBQklBQVFUU0FGUVFGMGFpSUFRWUNRZm1vZ0FrRUJjVUVOZENJQmFpMEFBQ0VSSUFCQmdaQithaUFCYWkwQUFDRVNJQU1oQUFOQUlBQWdCRXdFUUNBQUlBTnJJQVpxSWc0Z0NFZ0VRRUVBSVFVQ2YwRUJRUWNnQUdzZ0FFRUJJQXRCSUhGRklBdEJBRWdiR3lJQmRDQVNjUVJBUVFJaEJRc2dCVUVCYWdzZ0JVRUJJQUYwSUJGeEd5RUNJNEVDQkg5QkFTQU1RUUJPSUF0QkFFNGJCVUVBQ3dSL0lBdEJCM0VoQVNBTVFRQk9JZ1VFUUNBTVFRZHhJUUVMSUFFZ0FpQUZFRTRpQlVFZmNVRURkQ0VCSUFWQjRBZHhRUVYxUVFOMElROGdCVUdBK0FGeFFRcDFRUU4wQlNBQ1FjZitBeUFLSUFwQkFFd2JJZ29RVHlJRlFZQ0EvQWR4UVJCMUlRRWdCVUdBL2dOeFFRaDFJUThnQlVIL0FYRUxJUVVnQnlBSWJDQU9ha0VEYkNBSmFpSVFJQUU2QUFBZ0VFRUJhaUFQT2dBQUlCQkJBbW9nQlRvQUFDQUhRYUFCYkNBT2FrR0FrUVJxSUFKQkEzRWlBVUVFY2lBQklBdEJnQUZ4UVFBZ0MwRUFUaHNiT2dBQUlBMUJBV29oRFFzZ0FFRUJhaUVBREFFTEN5QU5DMzRCQTM4Z0EwRUhjU0VEUVFBZ0FpQUNRUU4xUVFOMGF5QUFHeUVIUWFBQklBQnJRUWNnQUVFSWFrR2dBVW9iSVFoQmZ5RUNJNEVDQkVBZ0JFR0EwSDVxTFFBQUlnSkJDSEZCQUVjaENTQUNRY0FBY1FSQVFRY2dBMnNoQXdzTElBWWdCU0FKSUFjZ0NDQURJQUFnQVVHZ0FVR0F5UVZCQUNBQ1FYOFFVQXVoQWdFQmZ5QURRUWR4SVFNZ0JTQUdFRTBnQkVHQTBINXFMUUFBSWdSQndBQnhCSDlCQnlBRGF3VWdBd3RCQVhScUlnVkJnSkIrYWlBRVFRaHhRUUJISWdaQkRYUnFMUUFBSVFjZ0FrRUhjU0VEUVFBaEFpQUJRYUFCYkNBQWFrRURiRUdBeVFWcUlBUkJCM0VDZnlBRlFZR1FmbW9nQmtFQmNVRU5kR290QUFCQkFTQURRUWNnQTJzZ0JFRWdjUnNpQTNSeEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0EzUWdCM0ViSWdOQkFCQk9JZ0pCSDNGQkEzUTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdja0ZhaUFDUWVBSGNVRUZkVUVEZERvQUFDQUJRYUFCYkNBQWFrRURiRUdDeVFWcUlBSkJnUGdCY1VFS2RVRURkRG9BQUNBQlFhQUJiQ0FBYWtHQWtRUnFJQU5CQTNFaUFFRUVjaUFBSUFSQmdBRnhHem9BQUF2RUFRQWdCQ0FGRUUwZ0EwRUhjVUVCZEdvaUJFR0FrSDVxTFFBQUlRVkJBQ0VESUFGQm9BRnNJQUJxUVFOc1FZREpCV29DZnlBRVFZR1FmbW90QUFCQkFVRUhJQUpCQjNGcklnSjBjUVJBUVFJaEF3c2dBMEVCYWdzZ0EwRUJJQUowSUFWeEd5SURRY2YrQXhCUElnSkJnSUQ4QjNGQkVIVTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdja0ZhaUFDUVlEK0EzRkJDSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnc2tGYWlBQ09nQUFJQUZCb0FGc0lBQnFRWUNSQkdvZ0EwRURjVG9BQUF2VUFRRUdmeUFEUVFOMUlRb0RRQ0FFUWFBQlNBUkFJQVFnQldvaUJrR0FBazRFUUNBR1FZQUNheUVHQ3lBS1FRVjBJQUpxSUFaQkEzVnFJZ2hCZ0pCK2FpMEFBQ0VIUVFBaENTTThCRUFnQkNBQUlBWWdDQ0FIRUV3aUMwRUFTZ1JBUVFFaENTQUxRUUZySUFScUlRUUxDeUFKUlVFQUl6c2JCRUFnQkNBQUlBWWdBeUFJSUFFZ0J4QlJJZ1pCQUVvRVFDQUdRUUZySUFScUlRUUxCU0FKUlFSQUk0RUNCRUFnQkNBQUlBWWdBeUFJSUFFZ0J4QlNCU0FFSUFBZ0JpQURJQUVnQnhCVEN3c0xJQVJCQVdvaEJBd0JDd3NMTWdFRGZ5UHdBU0VESUFBajhRRWlCRWdFUUE4TFFRQWdBMEVIYXlJRGF5RUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVGUUxvQVVCRDM4Q1FFRW5JUVlEUUNBR1FRQklEUUVnQmtFQ2RDSUZRWUQ4QTJvaUF4QWRJUUlnQTBFQmFoQWRJUWNnQTBFQ2FoQWRJUU1nQWtFUWF5RUVJQWRCQ0dzaEMwRUlJUUlnQVFSQVFSQWhBaUFESUFOQkFYRnJJUU1MSUFBZ0FpQUVha2hCQUNBQUlBUk9Hd1JBSUFWQmcvd0RhaEFkSWdWQmdBRnhRUUJISVF3Z0JVRWdjVUVBUnlFTlFZQ0FBaUFERUUwZ0FpQUFJQVJySWdOclFRRnJJQU1nQlVIQUFIRWJRUUYwYWlJRFFZQ1FmbW9nQlVFSWNVRUFSeU9CQWlJQ0lBSWJRUUZ4UVExMElnSnFMUUFBSVE0Z0EwR0JrSDVxSUFKcUxRQUFJUTlCQnlFREEwQWdBMEVBVGdSQVFRQWhBZ0ovUVFGQkFDQURRUWRyYXlBRElBMGJJZ1IwSUE5eEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0JIUWdEbkViSWdRRVFFRUhJQU5ySUF0cUlnSkJBRTRFZnlBQ1FhQUJUQVZCQUFzRVFFRUFJUWRCQUNFS0krb0JSU09CQWlJSUlBZ2JJZ2hGQkVBZ0FFR2dBV3dnQW1wQmdKRUVhaTBBQUNJSklSQWdDVUVEY1NJSlFRQkxRUUFnREJzRVFFRUJJUWNGUVFGQkFDQUpRUUJMUVFBZ0VFRUVjVUVBSTRFQ0d4c2JJUW9MQzBFQlFRQWdDa1VnQnhzZ0NCc0VRQ09CQWdSQUlBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JVRUhjU0FFUVFFUVRpSUVRUjl4UVFOME9nQUFJQUJCb0FGc0lBSnFRUU5zUVlISkJXb2dCRUhnQjNGQkJYVkJBM1E2QUFBZ0FFR2dBV3dnQW1wQkEyeEJnc2tGYWlBRVFZRDRBWEZCQ25WQkEzUTZBQUFGSUFCQm9BRnNJQUpxUVFOc1FZREpCV29nQkVISi9nTkJ5UDRESUFWQkVIRWJFRThpQkVHQWdQd0hjVUVRZFRvQUFDQUFRYUFCYkNBQ2FrRURiRUdCeVFWcUlBUkJnUDREY1VFSWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQ3lRVnFJQVE2QUFBTEN3c0xJQU5CQVdzaEF3d0JDd3NMSUFaQkFXc2hCZ3dBQUFzQUN3dGtBUUYvUVlDQUFrR0FrQUlqNWdFYklRRkJBU1BxQVNPQkFoc0VRQ0FBSUFGQmdMZ0NRWUN3QWlQbkFSc2o3d0VnQUdwQi93RnhRUUFqN2dFUVZBc2o1UUVFUUNBQUlBRkJnTGdDUVlDd0FpUGtBUnNRVlFzajZRRUVRQ0FBSStnQkVGWUxDeVVCQVg4Q1FBTkFJQUJCa0FGS0RRRWdBRUgvQVhFUVZ5QUFRUUZxSVFBTUFBQUxBQXNMUmdFQ2Z3TkFJQUZCa0FGT1JRUkFRUUFoQUFOQUlBQkJvQUZJQkVBZ0FVR2dBV3dnQUdwQmdKRUVha0VBT2dBQUlBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDd3NiQUVHUC9nTVFIVUVCSUFCMGNpSUFKTDhCUVkvK0F5QUFFQjhMQ3dCQkFTVEJBVUVCRUZvTExnRUJmd0ovSTNVaUFFRUFTZ1IvSTIwRlFRQUxCRUFnQUVFQmF5RUFDeUFBUlFzRVFFRUFKRzhMSUFBa2RRc3dBUUYvQW44amd3RWlBRUVBU2dSL0kzMEZRUUFMQkVBZ0FFRUJheUVBQ3lBQVJRc0VRRUVBSkg4TElBQWtnd0VMTWdFQmZ3Si9JNVlCSWdCQkFFb0VmeU9RQVFWQkFBc0VRQ0FBUVFGcklRQUxJQUJGQ3dSQVFRQWtrUUVMSUFBa2xnRUxSd0VDZnlBQUpHUkJsUDRERUIxQitBRnhJUUZCay80RElBQkIvd0Z4SWdJUUgwR1UvZ01nQVNBQVFRaDFRUWR4SWdCeUVCOGdBaVJWSUFBa1Z5TlZJMWRCQ0hSeUpGb0xvZ0VCQW44allrVkJBU05ZR3dSQUR3c2pZMEVCYXlJQVFRQk1CRUFqVFFSQUkwMGtZd0ovSTJRaUFTTlBkU0VBUVFFalRnUi9RUUVrWlNBQklBQnJCU0FBSUFGcUN5SUFRZjhQU2cwQUdrRUFDd1JBUVFBa1dBc2pUMEVBU2dSQUlBQVFYd0ovSTJRaUFTTlBkU0VBUVFFalRnUi9RUUVrWlNBQklBQnJCU0FBSUFGcUMwSC9EMG9OQUJwQkFBc0VRRUVBSkZnTEN3VkJDQ1JqQ3dVZ0FDUmpDd3RUQVFKL0kxeEJBV3NpQVVFQVRBUkFJMVFFUUNOVUlnRUVmeU5kQlVFQUN3UkFJMThoQUNBQVFRRnFJQUJCQVdzalV4dEJEM0VpQUVFUFNBUkFJQUFrWHdWQkFDUmRDd3NGUVFnaEFRc0xJQUVrWEF0VEFRSi9JM05CQVdzaUFVRUFUQVJBSTJzRVFDTnJJZ0VFZnlOMEJVRUFDd1JBSTNZaEFDQUFRUUZxSUFCQkFXc2phaHRCRDNFaUFFRVBTQVJBSUFBa2RnVkJBQ1IwQ3dzRlFRZ2hBUXNMSUFFa2N3dGNBUUovSTVRQlFRRnJJZ0ZCQUV3RVFDT01BUVJBSTR3QklnRUVmeU9WQVFWQkFBc0VRQ09YQVNFQUlBQkJBV29nQUVFQmF5T0xBUnRCRDNFaUFFRVBTQVJBSUFBa2x3RUZRUUFrbFFFTEN3VkJDQ0VCQ3dzZ0FTU1VBUXVwQWdFQ2YwR0F3QUFqZ2dKMElnRWhBaU96QVNBQWFpSUFJQUZPQkVBZ0FDQUNheVN6QVFKQUFrQUNRQUpBQWtBanRRRkJBV3BCQjNFaUFBUkFJQUJCQWtZTkFRSkFJQUJCQkdzT0JBTUFCQVVBQ3d3RkN5TmVJZ0ZCQUVvRWZ5TldCVUVBQ3dSQUlBRkJBV3NpQVVVRVFFRUFKRmdMQ3lBQkpGNFFYQkJkRUY0TUJBc2pYaUlCUVFCS0JIOGpWZ1ZCQUFzRVFDQUJRUUZySWdGRkJFQkJBQ1JZQ3dzZ0FTUmVFRndRWFJCZUVHQU1Bd3NqWGlJQlFRQktCSDhqVmdWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSWUN3c2dBU1JlRUZ3UVhSQmVEQUlMSTE0aUFVRUFTZ1IvSTFZRlFRQUxCRUFnQVVFQmF5SUJSUVJBUVFBa1dBc0xJQUVrWGhCY0VGMFFYaEJnREFFTEVHRVFZaEJqQ3lBQUpMVUJRUUVQQlNBQUpMTUJDMEVBQzNRQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBQ1FDQUFRUUpyRGdNQ0F3UUFDd3dFQ3lOWklnQWpuZ0ZISVFFZ0FDU2VBU0FCRHdzamNDSUFJNThCUnlFQklBQWtud0VnQVE4TEk0QUJJZ0Fqb0FGSElRRWdBQ1NnQVNBQkR3c2prZ0VpQUNPaEFVY2hBU0FBSktFQklBRVBDMEVBQzFVQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKR0RRRWdBRUVEUmcwQ0RBTUxRUUVnQVhSQmdRRnhRUUJIRHd0QkFTQUJkRUdIQVhGQkFFY1BDMEVCSUFGMFFmNEFjVUVBUnc4TFFRRWdBWFJCQVhGQkFFY0xjd0VCZnlOYklBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBaldtdEJBblFpQVVFQ2RDQUJJNElDR3lSYkkxc2dBRUVmZFNJQklBQWdBV3B6YXlFQUkyRkJBV3BCQjNFa1lRd0JDd3NnQUNSYkkxbEJBQ05ZR3dSL0kxOUJEM0VGUVE4UEN5TlFJMkVRWmdSL1FRRUZRWDhMYkVFUGFndHNBUUYvSTNJZ0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOeGEwRUNkQ09DQW5Ra2NpTnlJQUJCSDNVaUFTQUFJQUZxYzJzaEFDTjRRUUZxUVFkeEpIZ01BUXNMSUFBa2NpTndRUUFqYnhzRWZ5TjJRUTl4QlVFUER3c2paeU40RUdZRWYwRUJCVUYvQzJ4QkQyb0xEd0FqaEFGQkFYVkJzUDREYWhBZEN5c0JBWDhqaEFGQkFXb2hBQU5BSUFCQklFaEZCRUFnQUVFZ2F5RUFEQUVMQ3lBQUpJUUJFR2traHdFTDVnRUJBMzhqZ0FGRlFRRWpmeHNFUUVFUER3c2poUUVoQWlPR0FRUkFRWnorQXhBZFFRVjFRUTl4SWdJa2hRRkJBQ1NHQVFzamh3RWpoQUZCQVhGRlFRSjBkVUVQY1NFQkFrQUNRQUpBQWtBZ0FnUkFJQUpCQVVZTkFTQUNRUUpHRFFJTUF3c2dBVUVFZFNFQkRBTUxRUUVoQXd3Q0N5QUJRUUYxSVFGQkFpRUREQUVMSUFGQkFuVWhBVUVFSVFNTElBTkJBRW9FZnlBQklBTnRCVUVBQzBFUGFpRUJJNElCSUFCcklRQURRQ0FBUVFCTUJFQkJnQkFqZ1FGclFRRjBJNElDZENTQ0FTT0NBU0FBUVI5MUlnSWdBQ0FDYW5OcklRQVFhZ3dCQ3dzZ0FDU0NBU0FCQzQ4QkFRSi9JNU1CSUFCcklnQkJBRXdFUUNPWUFTT05BWFFqZ2dKMElBQkJIM1VpQVNBQUlBRnFjMnNoQUNPWkFTSUJRUUYxSWdJZ0FVRUJjU0FDUVFGeGN5SUJRUTUwY2lJQ1FiOS9jU0FCUVFaMGNpQUNJNDRCR3lTWkFRdEJBQ0FBSUFCQkFFZ2JKSk1CSTVJQlFRQWprUUViQkg4amx3RkJEM0VGUVE4UEMwRi9RUUVqbVFGQkFYRWJiRUVQYWdzd0FDQUFRVHhHQkVCQi93QVBDeUFBUVR4clFhQ05CbXdnQVd4QkEzVkJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExsd0VCQVg5QkFDU2tBU0FBUVE4anFnRWJJQUZCRHlPckFSdHFJQUpCRHlPc0FSdHFJQU5CRHlPdEFSdHFJUVFnQUVFUEk2NEJHeUFCUVE4anJ3RWJhaUVBSUFBZ0FrRVBJN0FCRzJvaEFTQURRUThqc1FFYklRTkJBQ1NsQVVFQUpLWUJJQVFqcUFGQkFXb1FiU0VBSUFFZ0Eyb2pxUUZCQVdvUWJTRUJJQUFrb2dFZ0FTU2pBU0FCUWY4QmNTQUFRZjhCY1VFSWRISUwvd0lCQlg4alRDQUFhaUlDSkV3ald5QUNhMEVBVENJQ1JRUkFRUUVRWlNFQ0N5Tm1JQUJxSWdFa1ppTnlJQUZyUVFCTUlnRkZCRUJCQWhCbElRRUxJM2tnQUdva2VVRUFJNElCSTNsclFRQktJNFlCRzBVaUJFVUVRRUVERUdVaEJBc2ppQUVnQUdva2lBRWprd0VqaUFGclFRQk1JZ1ZGQkVCQkJCQmxJUVVMSUFJRVFDTk1JUU5CQUNSTUlBTVFaeVNhQVFzZ0FRUkFJMlloQTBFQUpHWWdBeEJvSkpzQkN5QUVCRUFqZVNFRFFRQWtlU0FERUdza25BRUxJQVVFUUNPSUFTRURRUUFraUFFZ0F4QnNKSjBCQzBFQklBVkJBU0FFUVFFZ0FTQUNHeHNiQkVCQkFTU21BUXRCZ0lDQUFpT0NBblJCeE5nQ2JTSUNJUUVqdEFFZ0FHb2lBQ0FDVGdSQUlBQWdBV3NoQUVFQkk2VUJRUUVqcEFFanBnRWJHd1JBSTVvQkk1c0JJNXdCSTUwQkVHNGFCU0FBSkxRQkN5TzJBU0lDUVFGMFFZQ1p3UUJxSWdFam9nRkJBbW82QUFBZ0FVRUJhaU9qQVVFQ2Fqb0FBQ0FDUVFGcUlnRkIvLzhEVGdSL0lBRkJBV3NGSUFFTEpMWUJDeUFBSkxRQkM2VURBUVovSUFBUVp5RUJJQUFRYUNFQ0lBQVFheUVFSUFBUWJDRUZJQUVrbWdFZ0FpU2JBU0FFSkp3QklBVWtuUUVqdEFFZ0FHb2lBRUdBZ0lBQ0k0SUNkRUhFMkFKdFRnUkFJQUJCZ0lDQUFpT0NBblJCeE5nQ2JXc2hBQ0FCSUFJZ0JDQUZFRzRoQXlPMkFVRUJkRUdBbWNFQWFpSUdJQU5CZ1A0RGNVRUlkVUVDYWpvQUFDQUdRUUZxSUFOQi93RnhRUUpxT2dBQUl6MEVRQ0FCUVE5QkQwRVBFRzRoQVNPMkFVRUJkRUdBbVNGcUlnTWdBVUdBL2dOeFFRaDFRUUpxT2dBQUlBTkJBV29nQVVIL0FYRkJBbW82QUFCQkR5QUNRUTlCRHhCdUlRRWp0Z0ZCQVhSQmdKa3BhaUlDSUFGQmdQNERjVUVJZFVFQ2Fqb0FBQ0FDUVFGcUlBRkIvd0Z4UVFKcU9nQUFRUTlCRHlBRVFROFFiaUVCSTdZQlFRRjBRWUNaTVdvaUFpQUJRWUQrQTNGQkNIVkJBbW82QUFBZ0FrRUJhaUFCUWY4QmNVRUNham9BQUVFUFFROUJEeUFGRUc0aEFTTzJBVUVCZEVHQW1UbHFJZ0lnQVVHQS9nTnhRUWgxUVFKcU9nQUFJQUpCQVdvZ0FVSC9BWEZCQW1vNkFBQUxJN1lCUVFGcUlnRkIvLzhEVGdSL0lBRkJBV3NGSUFFTEpMWUJDeUFBSkxRQkN4NEJBWDhnQUJCa0lRRWdBVVZCQUNNNkd3UkFJQUFRYndVZ0FCQndDd3N2QVFKL1FkY0FJNElDZENFQkk2Y0JJUUFEUUNBQUlBRk9CRUFnQVJCeElBQWdBV3NoQUF3QkN3c2dBQ1NuQVF1a0F3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RFJ3UkFJQUJCbGY0RFJnMEJBa0FnQUVHUi9nTnJEaFlHQ3hBVUFBY01FUlVEQ0EwU0ZnUUpEaE1YQlFvUEFBc01Gd3RCa1A0REVCMUJnQUZ5RHd0QmxmNERFQjFCL3dGeUR3dEJtdjRERUIxQi93QnlEd3RCbi80REVCMUIvd0Z5RHd0QnBQNERFQjBQQzBHUi9nTVFIVUUvY2c4TFFaYitBeEFkUVQ5eUR3dEJtLzRERUIxQi93RnlEd3RCb1A0REVCMUIvd0Z5RHd0QnBmNERFQjBQQzBHUy9nTVFIUThMUVpmK0F4QWREd3RCblA0REVCMUJud0Z5RHd0Qm9mNERFQjBQQzBHQUFVRUFJN0lCR3lFQUlBQkJBWElnQUVGK2NTTllHeUVBSUFCQkFuSWdBRUY5Y1NOdkd5RUFJQUJCQkhJZ0FFRjdjU04vR3lFQUlBQkJDSElnQUVGM2NTT1JBUnRCOEFCeUR3dEJrLzRERUIxQi93RnlEd3RCbVA0REVCMUIvd0Z5RHd0Qm5mNERFQjFCL3dGeUR3dEJvdjRERUIwUEMwR1UvZ01RSFVHL0FYSVBDMEdaL2dNUUhVRy9BWElQQzBHZS9nTVFIVUcvQVhJUEMwR2ovZ01RSFVHL0FYSVBDMEYvQzV3QkFRRi9JOW9CSVFBajJ3RUVRQ0FBUVh0eElBQkJCSElqMGdFYklRQWdBRUYrY1NBQVFRRnlJOVVCR3lFQUlBQkJkM0VnQUVFSWNpUFRBUnNoQUNBQVFYMXhJQUJCQW5JajFBRWJJUUFGSTl3QkJFQWdBRUYrY1NBQVFRRnlJOVlCR3lFQUlBQkJmWEVnQUVFQ2NpUFhBUnNoQUNBQVFYdHhJQUJCQkhJajJBRWJJUUFnQUVGM2NTQUFRUWh5STlrQkd5RUFDd3NnQUVId0FYSUwxQUlBSUFCQmdJQUNTQVJBUVg4UEN5QUFRWURBQWtoQkFDQUFRWUNBQWs0YkJFQkJmdzhMSUFCQmdQd0RTRUVBSUFCQmdNQURUaHNFUUNBQVFZQkFhaEFkRHdzZ0FFR2YvUU5NUVFBZ0FFR0EvQU5PR3dSQVFmOEJRWDhqNFFGQkFrZ2JEd3NnQUVITi9nTkdCRUJCL3dFaEFFSE4vZ01RSFVFQmNVVUVRRUgrQVNFQUN5T0NBa1VFUUNBQVFmOStjU0VBQ3lBQUR3c2dBRUhFL2dOR0JFQWdBQ1B0QVJBZkkrMEJEd3NnQUVHbS9nTk1RUUFnQUVHUS9nTk9Hd1JBRUhJZ0FCQnpEd3NnQUVHdi9nTk1RUUFnQUVHbi9nTk9Hd1JBUWY4QkR3c2dBRUcvL2dOTVFRQWdBRUd3L2dOT0d3UkFFSElqZndSQUVHa1BDMEYvRHdzZ0FFR0UvZ05HQkVBZ0FDUEdBVUdBL2dOeFFRaDFJZ0FRSHlBQUR3c2dBRUdGL2dOR0JFQWdBQ1BIQVJBZkk4Y0JEd3NnQUVHUC9nTkdCRUFqdndGQjRBRnlEd3NnQUVHQS9nTkdCRUFRZEE4TFFYOExLUUVCZnlQZUFTQUFSZ1JBUVFFazRBRUxJQUFRZFNJQlFYOUdCSDhnQUJBZEJTQUJRZjhCY1FzTHBBSUJBMzhqOWdFRVFBOExJL2NCSVFNaitBRWhBaUFBUWY4L1RBUkFJQUlFZnlBQlFSQnhSUVZCQUF0RkJFQWdBVUVQY1NJQUJFQWdBRUVLUmdSQVFRRWs5QUVMQlVFQUpQUUJDd3NGSUFCQi8vOEFUQVJBSS9vQklnUUVmeUFBUWYvZkFFd0ZRUUVMQkVBZ0FVRVBjU1B5QVNBQ0d5RUFJQU1FZnlBQlFSOXhJUUVnQUVIZ0FYRUZJL2tCQkg4Z0FVSC9BSEVoQVNBQVFZQUJjUVZCQUNBQUlBUWJDd3NoQUNBQUlBRnlKUElCQlNQeUFVSC9BWEVnQVVFQVNrRUlkSElrOGdFTEJVRUFJQUJCLzc4QlRDQUNHd1JBSS9VQlFRQWdBeHNFUUNQeUFVRWZjU0FCUWVBQmNYSWs4Z0VQQ3lBQlFROXhJQUZCQTNFaitnRWJKUE1CQlVFQUlBQkIvLzhCVENBQ0d3UkFJQU1FUUNBQlFRRnhRUUJISlBVQkN3c0xDd3NMT0FFQmZ5Tk9JUUVnQUVId0FIRkJCSFVrVFNBQVFRaHhRUUJISkU0Z0FFRUhjU1JQSTJWQkFDTk9SVUVBSUFFYkd3UkFRUUFrV0FzTFpRQWpXQVJBUVFBalhTTlVHd1JBSTE5QkFXcEJEM0VrWHdzalV5QUFRUWh4UVFCSFJ3UkFRUkFqWDJ0QkQzRWtYd3NMSUFCQkJIVkJEM0VrVWlBQVFRaHhRUUJISkZNZ0FFRUhjU1JVSUFCQitBRnhRUUJLSWdBa1dTQUFSUVJBUVFBa1dBc0xaUUFqYndSQVFRQWpkQ05yR3dSQUkzWkJBV3BCRDNFa2Rnc2phaUFBUVFoeFFRQkhSd1JBUVJBamRtdEJEM0VrZGdzTElBQkJCSFZCRDNFa2FTQUFRUWh4UVFCSEpHb2dBRUVIY1NScklBQkIrQUZ4UVFCS0lnQWtjQ0FBUlFSQUlBQWtid3NMY2dBamtRRUVRRUVBSTVVQkk0d0JHd1JBSTVjQlFRRnFRUTl4SkpjQkN5T0xBU0FBUVFoeFFRQkhSd1JBUVJBamx3RnJRUTl4SkpjQkN3c2dBRUVFZFVFUGNTU0tBU0FBUVFoeFFRQkhKSXNCSUFCQkIzRWtqQUVnQUVINEFYRkJBRW9pQUNTU0FTQUFSUVJBSUFBa2tRRUxDemdBSUFCQkJIVWtqUUVnQUVFSWNVRUFSeVNPQVNBQVFRZHhJZ0FrandFZ0FFRUJkQ0lBUVFGSUJFQkJBU0VBQ3lBQVFRTjBKSmdCQzZvQkFRSi9RUUVrV0NOZVJRUkFRY0FBSkY0TFFZQVFJMXByUVFKMElnQkJBblFnQUNPQ0Foc2tXeU5VQkVBalZDUmNCVUVJSkZ3TFFRRWtYU05TSkY4aldpUmtJMDBFUUNOTkpHTUZRUWdrWXd0QkFTTlBRUUJLSWdBalRVRUFTaHNrWWtFQUpHVWdBQVIvQW44alpDSUFJMDkxSVFGQkFTTk9CSDlCQVNSbElBQWdBV3NGSUFBZ0FXb0xRZjhQU2cwQUdrRUFDd1ZCQUFzRVFFRUFKRmdMSTFsRkJFQkJBQ1JZQ3d1U0FRRUNmeUFBUVFkeElnRWtWeU5WSUFGQkNIUnlKRm9qdFFGQkFYRkJBVVloQWlOV1JTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFalhrRUFUQnNFUUNOZVFRRnJKRjVCQUNOZVJTQUFRWUFCY1JzRVFFRUFKRmdMQ3dzZ0FFSEFBSEZCQUVja1ZpQUFRWUFCY1FSQUVIMGpWa0VBUVFBalhrSEFBRVlnQWhzYkJFQWpYa0VCYXlSZUN3c0xRQUJCQVNSdkkzVkZCRUJCd0FBa2RRdEJnQkFqY1d0QkFuUWpnZ0owSkhJamF3UkFJMnNrY3dWQkNDUnpDMEVCSkhRamFTUjJJM0JGQkVCQkFDUnZDd3VTQVFFQ2Z5QUFRUWR4SWdFa2JpTnNJQUZCQ0hSeUpIRWp0UUZCQVhGQkFVWWhBaU50UlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqZFVFQVRCc0VRQ04xUVFGckpIVkJBQ04xUlNBQVFZQUJjUnNFUUVFQUpHOExDd3NnQUVIQUFIRkJBRWNrYlNBQVFZQUJjUVJBRUg4amJVRUFRUUFqZFVIQUFFWWdBaHNiQkVBamRVRUJheVIxQ3dzTFBRQkJBU1IvSTRNQlJRUkFRWUFDSklNQkMwR0FFQ09CQVd0QkFYUWpnZ0owSklJQkk0SUJRUVpxSklJQlFRQWtoQUVqZ0FGRkJFQkJBQ1IvQ3d1UEFRRUJmeUFBUVFkeElnRWtmaU44SUFGQkNIUnlKSUVCSTdVQlFRRnhRUUZHSWdGRkJFQkJBRUVBSUFCQndBQnhJMzBiSTRNQlFRQk1Hd1JBSTRNQlFRRnJKSU1CUVFBamd3RkZJQUJCZ0FGeEd3UkFRUUFrZndzTEN5QUFRY0FBY1VFQVJ5UjlJQUJCZ0FGeEJFQVFnUUVqZlVFQVFRQWpnd0ZCZ0FKR0lBRWJHd1JBSTRNQlFRRnJKSU1CQ3dzTFVnQkJBU1NSQVNPV0FVVUVRRUhBQUNTV0FRc2ptQUVqalFGMEk0SUNkQ1NUQVNPTUFRUkFJNHdCSkpRQkJVRUlKSlFCQzBFQkpKVUJJNG9CSkpjQlFmLy9BU1NaQVNPU0FVVUVRRUVBSkpFQkN3dUxBUUVDZnlPMUFVRUJjVUVCUmlFQ0k1QUJSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2dBa1VFUUVFQUlBRWpsZ0ZCQUV3YkJFQWpsZ0ZCQVdza2xnRkJBQ09XQVVVZ0FFR0FBWEViQkVCQkFDU1JBUXNMQ3lBQVFjQUFjVUVBUnlTUUFTQUFRWUFCY1FSQUVJTUJJNUFCUVFCQkFDT1dBVUhBQUVZZ0Foc2JCRUFqbGdGQkFXc2tsZ0VMQ3d1ZEJBQWpzZ0ZGUVFBZ0FFR20vZ05IR3dSQVFRQVBDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RFJ3UkFJQUJCbXY0RFJnMEJBa0FnQUVHUi9nTnJEaFlEQndzUEFBUUlEQkFBQlFrTkVRQUdDZzRTRXhRVkFBc01GUXNnQVJCNERCVUxRUUFnQVVHQUFYRkJBRWNpQUNPQUFSc0VRRUVBSkljQkN5QUFKSUFCSUFCRkJFQWdBQ1IvQ3d3VUN5QUJRUVoxUVFOeEpGQWdBVUUvY1NSUlFjQUFJMUZySkY0TUV3c2dBVUVHZFVFRGNTUm5JQUZCUDNFa2FFSEFBQ05vYXlSMURCSUxJQUVrZWtHQUFpTjZheVNEQVF3UkN5QUJRVDl4SklrQlFjQUFJNGtCYXlTV0FRd1FDeUFCRUhrTUR3c2dBUkI2REE0TFFRRWtoZ0VnQVVFRmRVRVBjU1I3REEwTElBRVFld3dNQ3lBQkpGVWpWMEVJZENBQmNpUmFEQXNMSUFFa2JDTnVRUWgwSUFGeUpIRU1DZ3NnQVNSOEkzNUJDSFFnQVhJa2dRRU1DUXNnQVJCOERBZ0xJQUVRZmd3SEN5QUJFSUFCREFZTElBRVFnZ0VNQlFzZ0FSQ0VBUXdFQ3lBQlFRUjFRUWR4SktnQklBRkJCM0VrcVFGQkFTU2tBUXdEQ3lBQkVDdEJBU1NsQVF3Q0N5T3lBU0lBQkg5QkFBVWdBVUdBQVhFTEJFQkJCeVMxQVVFQUpHRkJBQ1I0Q3lBQlFZQUJjVVZCQUNBQUd3UkFBa0JCa1A0RElRQURRQ0FBUWFiK0EwNE5BU0FBUVFBUWtnRWdBRUVCYWlFQURBQUFDd0FMQ3lBQlFZQUJjVUVBUnlTeUFRd0JDMEVCRHd0QkFRczhBUUYvSUFCQkNIUWhBVUVBSVFBRFFBSkFJQUJCbndGS0RRQWdBRUdBL0FOcUlBQWdBV29RSFJBZklBQkJBV29oQUF3QkN3dEJoQVVrK3dFTEpRRUJmMEhSL2dNUUhTRUFRZEwrQXhBZFFmOEJjU0FBUWY4QmNVRUlkSEpCOFA4RGNRc3BBUUYvUWRQK0F4QWRJUUJCMVA0REVCMUIvd0Z4SUFCQi93RnhRUWgwY2tId1AzRkJnSUFDYWd1R0FRRURmeU9CQWtVRVFBOExJQUJCZ0FGeFJVRUFJL3dCR3dSQVFRQWsvQUZCMWY0RFFkWCtBeEFkUVlBQmNoQWZEd3NRaHdFaEFSQ0lBU0VDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKUHdCSUFNay9RRWdBU1QrQVNBQ0pQOEJRZFgrQXlBQVFmOStjUkFmQlNBQklBSWdBeENUQVVIVi9nTkIvd0VRSHdzTFdRRUVmMEVCUWV2K0F5SURJQUJHSUFCQjZmNERSaHNFUUNBQVFRRnJJZ1FRSFVHL2YzRWlBa0UvY1NJRlFVQnJJQVVnQUNBRFJodEJnSkFFYWlBQk9nQUFJQUpCZ0FGeEJFQWdCQ0FDUVFGcVFZQUJjaEFmQ3dzTE1RQUNRQUpBQWtBQ1FDQUFCRUFDUUNBQVFRRnJEZ01DQXdRQUN3d0VDMEVKRHd0QkF3OExRUVVQQzBFSER3dEJBQXNmQUNBQVFRRWp6QUVRaXdFaUFIUnhCSDlCQVNBQWRDQUJjVVVGUVFBTEM0WUJBUVIvQTBBZ0FpQUFTQVJBSUFKQkJHb2hBaVBHQVNJQlFRUnFRZi8vQTNFaUF5VEdBU1BMQVFSQUk4a0JJUVFqeUFFRVFDUEtBU1RIQVVFQkpNSUJRUUlRV2tFQUpNZ0JRUUVreVFFRklBUUVRRUVBSk1rQkN3c2dBU0FERUl3QkJFQWp4d0ZCQVdvaUFVSC9BVW9FUUVFQkpNZ0JRUUFoQVFzZ0FTVEhBUXNMREFFTEN3c05BQ1BGQVJDTkFVRUFKTVVCQzBZQkFYOGp4Z0VoQUVFQUpNWUJRWVQrQTBFQUVCOGp5d0VFZnlBQVFRQVFqQUVGUVFBTEJFQWp4d0ZCQVdvaUFFSC9BVW9FUUVFQkpNZ0JRUUFoQUFzZ0FDVEhBUXNMZkFFRGZ5UExBU0VCSUFCQkJIRkJBRWNreXdFZ0FFRURjU0VDSUFGRkJFQWp6QUVRaXdFaEFTQUNFSXNCSVFNanhnRWhBQ1BMQVFSL1FRRWdBWFFnQUhFRlFRRWdBM1FnQUhGQkFFRUJJQUYwSUFCeEd3c0VRQ1BIQVVFQmFpSUFRZjhCU2dSQVFRRWt5QUZCQUNFQUN5QUFKTWNCQ3dzZ0FpVE1BUXZJQmdFQmZ3SkFBa0FnQUVITi9nTkdCRUJCemY0RElBRkJBWEVRSHd3QkN5QUFRZEQrQTBaQkFDT0FBaHNFUUVFQUpJQUNRZjhCSkl3Q0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJCM0RBRUxJQUJCZ01BQ1NFRUFJQUJCZ0lBQ1Roc05BU0FBUVlEOEEwaEJBQ0FBUVlEQUEwNGJCRUFnQUVHQVFHb2dBUkFmREFJTElBQkJuLzBEVEVFQUlBQkJnUHdEVGhzRVFDUGhBVUVDVGc4TElBQkIvLzBEVEVFQUlBQkJvUDBEVGhzTkFDQUFRWUwrQTBZRVFDQUJRUUZ4UVFCSEpNOEJJQUZCQW5GQkFFY2swQUVnQVVHQUFYRkJBRWNrMFFGQkFROExJQUJCcHY0RFRFRUFJQUJCa1A0RFRoc0VRQkJ5SUFBZ0FSQ0ZBUThMSUFCQnYvNERURUVBSUFCQnNQNERUaHNFUUJCeUkzOEVRQ09FQVVFQmRVR3cvZ05xSUFFUUh3d0NDd3dDQ3lBQVFjditBMHhCQUNBQVFjRCtBMDRiQkVBZ0FFSEEvZ05HQkVBZ0FSQS9EQU1MSUFCQndmNERSZ1JBUWNIK0F5QUJRZmdCY1VIQi9nTVFIVUVIY1hKQmdBRnlFQjhNQWdzZ0FFSEUvZ05HQkVCQkFDVHRBU0FBUVFBUUh3d0NDeUFBUWNYK0EwWUVRQ0FCSk9JQkRBTUxJQUJCeHY0RFJnUkFJQUVRaGdFTUF3c0NRQUpBQWtBQ1FDQUFRY1ArQTBjRVFDQUFRY0wrQTJzT0NnRUVCQVFFQkFRRUF3SUVDeUFCSk80QkRBWUxJQUVrN3dFTUJRc2dBU1R3QVF3RUN5QUJKUEVCREFNTERBSUxJQUJCMWY0RFJnUkFJQUVRaVFFTUFRdEJBU0FBUWMvK0EwWWdBRUh3L2dOR0d3UkFJL3dCQkVBai9nRWlBa0dBZ0FGT0JIOGdBa0gvL3dGTUJVRUFDd1IvUVFFRklBSkIvNzhEVEVFQUlBSkJnS0FEVGhzTERRSUxDeUFBUWV2K0EweEJBQ0FBUWVqK0EwNGJCRUFnQUNBQkVJb0JEQUlMSUFCQmgvNERURUVBSUFCQmhQNERUaHNFUUJDT0FRSkFBa0FDUUFKQUlBQkJoUDREUndSQUlBQkJoZjREYXc0REFRSURCQXNRandFTUJRc0NRQ1BMQVFSQUk4a0JEUUVqeUFFRVFFRUFKTWdCQ3dzZ0FTVEhBUXNNQlFzZ0FTVEtBU1BKQVVFQUk4c0JHd1JBSUFFa3h3RkJBQ1RKQVFzTUJBc2dBUkNRQVF3REN3d0NDeUFBUVlEK0EwWUVRQ0FCUWY4QmN5VGFBU1BhQVNJQ1FSQnhRUUJISk5zQklBSkJJSEZCQUVjazNBRUxJQUJCai80RFJnUkFJQUVRTHd3Q0N5QUFRZi8vQTBZRVFDQUJFQzRNQWd0QkFROExRUUFQQzBFQkN5QUFJOThCSUFCR0JFQkJBU1RnQVFzZ0FDQUJFSkVCQkVBZ0FDQUJFQjhMQzF3QkEzOERRQUpBSUFNZ0FrNE5BQ0FBSUFOcUVIWWhCU0FCSUFOcUlRUURRQ0FFUWYrL0FreEZCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFSklCSUFOQkFXb2hBd3dCQ3dzait3RkJJQ09DQW5RZ0FrRUVkV3hxSlBzQkMzUUJBbjhqL0FGRkJFQVBDMEVRSVFBai9nRWovd0VDZnlQOUFTSUJRUkJJQkVBZ0FTRUFDeUFBQ3hDVEFTUCtBU0FBYWlUK0FTUC9BU0FBYWlUL0FTQUJJQUJySWdBay9RRkIxZjRESVFFZ0FFRUFUQVJBUVFBay9BRWdBVUgvQVJBZkJTQUJJQUJCQkhWQkFXdEIvMzV4RUI4TEN6TUFJKzBCSStJQlJrRUFJQUJCQVVaQkFTQUFHeHNFUUNBQlFRUnlJZ0ZCd0FCeEJFQVFXd3NGSUFGQmUzRWhBUXNnQVF1QkFnRUZmeVBqQVVVRVFBOExJK0VCSVFBZ0FDUHRBU0lDUVpBQlRnUi9RUUVGUWZnQ0k0SUNkQ0lCSVFNajdBRWlCQ0FCVGdSL1FRSUZRUU5CQUNBRUlBTk9Hd3NMSWdGSEJFQkJ3ZjRERUIwaEFDQUJKT0VCUVFBaEFnSkFBa0FDUUFKQUlBRUVRQ0FCUVFGckRnTUJBZ01FQ3lBQVFYeHhJZ0JCQ0hGQkFFY2hBZ3dEQ3lBQVFYMXhRUUZ5SWdCQkVIRkJBRWNoQWd3Q0N5QUFRWDV4UVFKeUlnQkJJSEZCQUVjaEFnd0JDeUFBUVFOeUlRQUxJQUlFUUJCYkN5QUJSUVJBRUpRQkN5QUJRUUZHQkVCQkFTVEFBVUVBRUZvTFFjSCtBeUFCSUFBUWxRRVFId1VnQWtHWkFVWUVRRUhCL2dNZ0FVSEIvZ01RSFJDVkFSQWZDd3NMb0FFQkFYOGo0d0VFUUNQc0FTQUFhaVRzQVNNNUlRRURRQ1BzQVVFRUk0SUNJZ0IwUWNnRElBQjBJKzBCUVprQlJodE9CRUFqN0FGQkJDT0NBaUlBZEVISUF5QUFkQ1B0QVVHWkFVWWJheVRzQVNQdEFTSUFRWkFCUmdSQUlBRUVRQkJZQlNBQUVGY0xFRmxCZnlSS1FYOGtTd1VnQUVHUUFVZ0VRQ0FCUlFSQUlBQVFWd3NMQzBFQUlBQkJBV29nQUVHWkFVb2JKTzBCREFFTEN3c1FsZ0VMT0FFQmYwRUVJNElDSWdCMFFjZ0RJQUIwSSswQlFaa0JSaHNoQUFOQUkrc0JJQUJPQkVBZ0FCQ1hBU1ByQVNBQWF5VHJBUXdCQ3dzTHNnRUJBMzhqMFFGRkJFQVBDd05BSUFNZ0FFZ0VRQ0FEUVFScUlRTUNmeVBOQVNJQ1FRUnFJZ0ZCLy84RFNnUkFJQUZCZ0lBRWF5RUJDeUFCQ3lUTkFTQUNRUUZCQWtFSEk5QUJHeUlDZEhFRWYwRUJJQUowSUFGeFJRVkJBQXNFUUVHQi9nTkJnZjRERUIxQkFYUkJBV3BCL3dGeEVCOGp6Z0ZCQVdvaUFVRUlSZ1JBUVFBa3pnRkJBU1REQVVFREVGcEJndjREUVlMK0F4QWRRZjkrY1JBZlFRQWswUUVGSUFFa3pnRUxDd3dCQ3dzTGxRRUFJL3NCUVFCS0JFQWord0VnQUdvaEFFRUFKUHNCQ3lPTkFpQUFhaVNOQWlPUkFrVUVRQ00zQkVBajZ3RWdBR29rNndFUW1BRUZJQUFRbHdFTEl6WUVRQ09uQVNBQWFpU25BUkJ5QlNBQUVIRUxJQUFRbVFFTEl6Z0VRQ1BGQVNBQWFpVEZBUkNPQVFVZ0FCQ05BUXNqbEFJZ0FHb2lBQ09TQWs0RVFDT1RBa0VCYWlTVEFpQUFJNUlDYXlFQUN5QUFKSlFDQ3d3QVFRUVFtZ0VqakFJUUhRc3BBUUYvUVFRUW1nRWpqQUpCQVdwQi8vOERjUkFkSVFBUW13RkIvd0Z4SUFCQi93RnhRUWgwY2dzT0FFRUVFSm9CSUFBZ0FSQ1NBUXN3QUVFQklBQjBRZjhCY1NFQUlBRkJBRW9FUUNPS0FpQUFja0gvQVhFa2lnSUZJNG9DSUFCQi93RnpjU1NLQWdzTENRQkJCU0FBRUo0QkN6b0JBWDhnQVVFQVRnUkFJQUJCRDNFZ0FVRVBjV3BCRUhGQkFFY1Fud0VGSUFGQkgzVWlBaUFCSUFKcWMwRVBjU0FBUVE5eFN4Q2ZBUXNMQ1FCQkJ5QUFFSjRCQ3drQVFRWWdBQkNlQVFzSkFFRUVJQUFRbmdFTFB3RUNmeUFCUVlEK0EzRkJDSFVoQWlBQlFmOEJjU0lCSVFNZ0FDQUJFSkVCQkVBZ0FDQURFQjhMSUFCQkFXb2lBQ0FDRUpFQkJFQWdBQ0FDRUI4TEN3NEFRUWdRbWdFZ0FDQUJFS1FCQzFvQUlBSUVRQ0FBUWYvL0EzRWlBQ0FCYWlBQUlBRnpjeUlBUVJCeFFRQkhFSjhCSUFCQmdBSnhRUUJIRUtNQkJTQUFJQUZxUWYvL0EzRWlBaUFBUWYvL0EzRkpFS01CSUFBZ0FYTWdBbk5CZ0NCeFFRQkhFSjhCQ3dzTEFFRUVFSm9CSUFBUWRndXBCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc01GUXNRbkFGQi8vOERjU0lBUVlEK0EzRkJDSFVraEFJZ0FFSC9BWEVraFFJTUR3c2poUUpCL3dGeEk0UUNRZjhCY1VFSWRISWpnd0lRblFFTUV3c2poUUpCL3dGeEk0UUNRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtoQUlNRXdzamhBSWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtoQUlNRFFzamhBSWlBRUYvRUtBQklBQkJBV3RCL3dGeElnQWtoQUlNRFFzUW13RkIvd0Z4SklRQ0RBMExJNE1DSWdCQmdBRnhRWUFCUmhDakFTQUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWtnd0lNRFFzUW5BRkIvLzhEY1NPTEFoQ2xBUXdJQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQUk0VUNRZjhCY1NPRUFrSC9BWEZCQ0hSeUlnRkJBQkNtQVNBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJZ0NJQUJCL3dGeEpJa0NRUUFRb2dGQkNBOExJNFVDUWY4QmNTT0VBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU0RBZ3dMQ3lPRkFrSC9BWEVqaEFKQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNTRUFnd0xDeU9GQWlJQVFRRVFvQUVnQUVFQmFrSC9BWEVpQUNTRkFnd0ZDeU9GQWlJQVFYOFFvQUVnQUVFQmEwSC9BWEVpQUNTRkFnd0ZDeENiQVVIL0FYRWtoUUlNQlFzamd3SWlBRUVCY1VFQVN4Q2pBU0FBUVFkMElBQkIvd0Z4UVFGMmNrSC9BWEVrZ3dJTUJRdEJmdzhMSTR3Q1FRSnFRZi8vQTNFa2pBSU1CQXNnQUVVUW9RRkJBQkNpQVF3REN5QUFSUkNoQVVFQkVLSUJEQUlMSTR3Q1FRRnFRZi8vQTNFa2pBSU1BUXRCQUJDaEFVRUFFS0lCUVFBUW53RUxRUVFQQ3lBQVFmOEJjU1NGQWtFSUM1a0dBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUkJIQkVBZ0FFRVJSZzBCQWtBZ0FFRVNhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPQkFnUkFRYzMrQXhDbkFVSC9BWEVpQUVFQmNRUkFRYzMrQXlBQVFYNXhJZ0JCZ0FGeEJIOUJBQ1NDQWlBQVFmOStjUVZCQVNTQ0FpQUFRWUFCY2dzUW5RRkJ4QUFQQ3d0QkFTU1JBZ3dRQ3hDY0FVSC8vd054SWdCQmdQNERjVUVJZFNTR0FpQUFRZjhCY1NTSEFpT01Ba0VDYWtILy93TnhKSXdDREJFTEk0Y0NRZjhCY1NPR0FrSC9BWEZCQ0hSeUk0TUNFSjBCREJBTEk0Y0NRZjhCY1NPR0FrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJWUNEQkFMSTRZQ0lnQkJBUkNnQVNBQVFRRnFRZjhCY1NTR0FpT0dBa1VRb1FGQkFCQ2lBUXdPQ3lPR0FpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFa2hnSWpoZ0pGRUtFQlFRRVFvZ0VNRFFzUW13RkIvd0Z4SklZQ0RBb0xJNE1DSWdGQmdBRnhRWUFCUmlFQUk0b0NRUVIyUVFGeElBRkJBWFJ5UWY4QmNTU0RBZ3dLQ3hDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01Ba0VJRHdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFDT0hBa0gvQVhFamhnSkIvd0Z4UVFoMGNpSUJRUUFRcGdFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBa0VBRUtJQlFRZ1BDeU9IQWtIL0FYRWpoZ0pCL3dGeFFRaDBjaENuQVVIL0FYRWtnd0lNQ0Fzamh3SkIvd0Z4STRZQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2hnSU1DQXNqaHdJaUFFRUJFS0FCSUFCQkFXcEIvd0Z4SWdBa2h3SWdBRVVRb1FGQkFCQ2lBUXdHQ3lPSEFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0hBaUFBUlJDaEFVRUJFS0lCREFVTEVKc0JRZjhCY1NTSEFnd0NDeU9EQWlJQlFRRnhRUUZHSVFBamlnSkJCSFpCQVhGQkIzUWdBVUgvQVhGQkFYWnlKSU1DREFJTFFYOFBDeU9NQWtFQmFrSC8vd054Skl3Q0RBRUxJQUFRb3dGQkFCQ2hBVUVBRUtJQlFRQVFud0VMUVFRUEN5QUFRZjhCY1NTSEFrRUlDL1VHQVFKL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRWdSd1JBSUFCQklVWU5BUUpBSUFCQkltc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqaWdKQkIzWkJBWEVFUUNPTUFrRUJha0gvL3dOeEpJd0NCUkNiQVNFQUk0d0NJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTTUFndEJDQThMRUp3QlFmLy9BM0VpQUVHQS9nTnhRUWgxSklnQ0lBQkIvd0Z4SklrQ0k0d0NRUUpxUWYvL0EzRWtqQUlNRkFzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFDT0RBaENkQVF3UEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBZ3dOQ3lPSUFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0lBZ3dPQ3lPSUFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0lBZ3dPQ3hDYkFVSC9BWEVraUFJTURndEJCa0VBSTRvQ0lnSkJCWFpCQVhGQkFFc2JJZ0JCNEFCeUlBQWdBa0VFZGtFQmNVRUFTeHNoQUNPREFpRUJJQUpCQm5aQkFYRkJBRXNFZnlBQklBQnJRZjhCY1FVZ0FTQUFRUVp5SUFBZ0FVRVBjVUVKU3hzaUFFSGdBSElnQUNBQlFaa0JTeHNpQUdwQi93RnhDeUlCUlJDaEFTQUFRZUFBY1VFQVJ4Q2pBVUVBRUo4QklBRWtnd0lNRGdzamlnSkJCM1pCQVhGQkFFc0VRQkNiQVNFQUk0d0NJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTTUFnVWpqQUpCQVdwQi8vOERjU1NNQWd0QkNBOExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJZ0FnQUVILy93TnhRUUFRcGdFZ0FFRUJkRUgvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBa0VBRUtJQlFRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaUlBRUtjQlFmOEJjU1NEQWd3SEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0lBZ3dGQ3lPSkFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0pBZ3dHQ3lPSkFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0pBZ3dHQ3hDYkFVSC9BWEVraVFJTUJnc2pnd0pCZjNOQi93RnhKSU1DUVFFUW9nRkJBUkNmQVF3R0MwRi9Ed3NnQUVIL0FYRWtpUUpCQ0E4TElBQkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUlNQXdzZ0FFVVFvUUZCQUJDaUFRd0NDeUFBUlJDaEFVRUJFS0lCREFFTEk0d0NRUUZxUWYvL0EzRWtqQUlMUVFRTDhRVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFUQkhCRUFnQUVFeFJnMEJBa0FnQUVFeWF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9LQWtFRWRrRUJjUVJBSTR3Q1FRRnFRZi8vQTNFa2pBSUZFSnNCSVFBampBSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054Skl3Q0MwRUlEd3NRbkFGQi8vOERjU1NMQWlPTUFrRUNha0gvL3dOeEpJd0NEQkVMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5SWdBamd3SVFuUUVNRGdzaml3SkJBV3BCLy84RGNTU0xBa0VJRHdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BU0lCUVFFUW9BRWdBVUVCYWtIL0FYRWlBVVVRb1FGQkFCQ2lBU0FBSUFFUW5RRU1EZ3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElpQUJDbkFTSUJRWDhRb0FFZ0FVRUJhMEgvQVhFaUFVVVFvUUZCQVJDaUFTQUFJQUVRblFFTURRc2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFtd0ZCL3dGeEVKMEJEQXNMUVFBUW9nRkJBQkNmQVVFQkVLTUJEQXNMSTRvQ1FRUjJRUUZ4UVFGR0JFQVFtd0VoQUNPTUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrakFJRkk0d0NRUUZxUWYvL0EzRWtqQUlMUVFnUEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpSUFJNHNDUVFBUXBnRWppd0lnQUdwQi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFKQkFCQ2lBVUVJRHdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BVUgvQVhFa2d3SU1CZ3NqaXdKQkFXdEIvLzhEY1NTTEFrRUlEd3NqZ3dJaUFFRUJFS0FCSUFCQkFXcEIvd0Z4SWdBa2d3SWdBRVVRb1FGQkFCQ2lBUXdHQ3lPREFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0RBaUFBUlJDaEFVRUJFS0lCREFVTEVKc0JRZjhCY1NTREFnd0RDMEVBRUtJQlFRQVFud0VqaWdKQkJIWkJBWEZCQUUwUW93RU1Bd3RCZnc4TElBQkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUlNQVFzampBSkJBV3BCLy84RGNTU01BZ3RCQkF1Q0FnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUFSd1JBSUFCQndRQkdEUUVDUUNBQVFjSUFhdzRPQXdRRkJnY0lDUkVLQ3d3TkRnOEFDd3dQQ3d3UEN5T0ZBaVNFQWd3T0N5T0dBaVNFQWd3TkN5T0hBaVNFQWd3TUN5T0lBaVNFQWd3TEN5T0pBaVNFQWd3S0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2hBSU1DUXNqZ3dJa2hBSU1DQXNqaEFJa2hRSU1Cd3NqaGdJa2hRSU1CZ3NqaHdJa2hRSU1CUXNqaUFJa2hRSU1CQXNqaVFJa2hRSU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdGQi93RnhKSVVDREFJTEk0TUNKSVVDREFFTFFYOFBDMEVFQy8wQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQVJ3UkFJQUJCMFFCR0RRRUNRQ0FBUWRJQWF3NE9FQU1FQlFZSENBa0tFQXNNRFE0QUN3d09DeU9FQWlTR0Fnd09DeU9GQWlTR0Fnd05DeU9IQWlTR0Fnd01DeU9JQWlTR0Fnd0xDeU9KQWlTR0Fnd0tDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtoZ0lNQ1Fzamd3SWtoZ0lNQ0FzamhBSWtod0lNQndzamhRSWtod0lNQmdzamhnSWtod0lNQlFzamlBSWtod0lNQkFzamlRSWtod0lNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RkIvd0Z4SkljQ0RBSUxJNE1DSkljQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFlQUFSd1JBSUFCQjRRQkdEUUVDUUNBQVFlSUFhdzRPQXdRUUJRWUhDQWtLQ3d3UURRNEFDd3dPQ3lPRUFpU0lBZ3dPQ3lPRkFpU0lBZ3dOQ3lPR0FpU0lBZ3dNQ3lPSEFpU0lBZ3dMQ3lPSkFpU0lBZ3dLQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFVSC9BWEVraUFJTUNRc2pnd0lraUFJTUNBc2poQUlraVFJTUJ3c2poUUlraVFJTUJnc2poZ0lraVFJTUJRc2pod0lraVFJTUJBc2ppQUlraVFJTUF3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFwd0ZCL3dGeEpJa0NEQUlMSTRNQ0pJa0NEQUVMUVg4UEMwRUVDNXNEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBRUh4QUVZTkFRSkFJQUJCOGdCckRnNERCQVVHQndnSkNnc01EUTRQRVFBTERBOExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNFFDRUowQkRBOExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNFVDRUowQkRBNExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNFlDRUowQkRBMExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNGNDRUowQkRBd0xJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNGdDRUowQkRBc0xJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNGtDRUowQkRBb0xJL3dCUlFSQUFrQWp0d0VFUUVFQkpJNENEQUVMSTdrQkk3OEJjVUVmY1VVRVFFRUJKSThDREFFTFFRRWtrQUlMQ3d3SkN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpT0RBaENkQVF3SUN5T0VBaVNEQWd3SEN5T0ZBaVNEQWd3R0N5T0dBaVNEQWd3RkN5T0hBaVNEQWd3RUN5T0lBaVNEQWd3REN5T0pBaVNEQWd3Q0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2d3SU1BUXRCZnc4TFFRUUxOd0VCZnlBQlFRQk9CRUFnQUVIL0FYRWdBQ0FCYWtIL0FYRkxFS01CQlNBQlFSOTFJZ0lnQVNBQ2FuTWdBRUgvQVhGS0VLTUJDd3MwQVFKL0k0TUNJZ0VnQUVIL0FYRWlBaENnQVNBQklBSVFzQUVnQUNBQmFrSC9BWEVpQUNTREFpQUFSUkNoQVVFQUVLSUJDMWdCQW44amd3SWlBU0FBYWlPS0FrRUVka0VCY1dwQi93RnhJZ0lnQUNBQmMzTkJFSEZCQUVjUW53RWdBRUgvQVhFZ0FXb2ppZ0pCQkhaQkFYRnFRWUFDY1VFQVN4Q2pBU0FDSklNQ0lBSkZFS0VCUVFBUW9nRUxpd0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlBQlJ3UkFJQUJCZ1FGR0RRRUNRQ0FBUVlJQmF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9FQWhDeEFRd1FDeU9GQWhDeEFRd1BDeU9HQWhDeEFRd09DeU9IQWhDeEFRd05DeU9JQWhDeEFRd01DeU9KQWhDeEFRd0xDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDeEFRd0tDeU9EQWhDeEFRd0pDeU9FQWhDeUFRd0lDeU9GQWhDeUFRd0hDeU9HQWhDeUFRd0dDeU9IQWhDeUFRd0ZDeU9JQWhDeUFRd0VDeU9KQWhDeUFRd0RDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDeUFRd0NDeU9EQWhDeUFRd0JDMEYvRHd0QkJBczNBUUovSTRNQ0lnRWdBRUgvQVhGQmYyd2lBaENnQVNBQklBSVFzQUVnQVNBQWEwSC9BWEVpQUNTREFpQUFSUkNoQVVFQkVLSUJDMWdCQW44amd3SWlBU0FBYXlPS0FrRUVka0VCY1d0Qi93RnhJZ0lnQUNBQmMzTkJFSEZCQUVjUW53RWdBU0FBUWY4QmNXc2ppZ0pCQkhaQkFYRnJRWUFDY1VFQVN4Q2pBU0FDSklNQ0lBSkZFS0VCUVFFUW9nRUxpd0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVpBQlJ3UkFJQUJCa1FGR0RRRUNRQ0FBUVpJQmF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9FQWhDMEFRd1FDeU9GQWhDMEFRd1BDeU9HQWhDMEFRd09DeU9IQWhDMEFRd05DeU9JQWhDMEFRd01DeU9KQWhDMEFRd0xDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDMEFRd0tDeU9EQWhDMEFRd0pDeU9FQWhDMUFRd0lDeU9GQWhDMUFRd0hDeU9HQWhDMUFRd0dDeU9IQWhDMUFRd0ZDeU9JQWhDMUFRd0VDeU9KQWhDMUFRd0RDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDMUFRd0NDeU9EQWhDMUFRd0JDMEYvRHd0QkJBc2lBQ09EQWlBQWNTSUFKSU1DSUFCRkVLRUJRUUFRb2dGQkFSQ2ZBVUVBRUtNQkN5WUFJNE1DSUFCelFmOEJjU0lBSklNQ0lBQkZFS0VCUVFBUW9nRkJBQkNmQVVFQUVLTUJDNHNDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHZ0FVY0VRQ0FBUWFFQlJnMEJBa0FnQUVHaUFXc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqaEFJUXR3RU1FQXNqaFFJUXR3RU1Ed3NqaGdJUXR3RU1EZ3NqaHdJUXR3RU1EUXNqaUFJUXR3RU1EQXNqaVFJUXR3RU1Dd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdFUXR3RU1DZ3NqZ3dJUXR3RU1DUXNqaEFJUXVBRU1DQXNqaFFJUXVBRU1Cd3NqaGdJUXVBRU1CZ3NqaHdJUXVBRU1CUXNqaUFJUXVBRU1CQXNqaVFJUXVBRU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdFUXVBRU1BZ3NqZ3dJUXVBRU1BUXRCZnc4TFFRUUxKZ0FqZ3dJZ0FISkIvd0Z4SWdBa2d3SWdBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VMTEFFQmZ5T0RBaUlCSUFCQi93RnhRWDlzSWdBUW9BRWdBU0FBRUxBQklBQWdBV3BGRUtFQlFRRVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFiQUJSd1JBSUFCQnNRRkdEUUVDUUNBQVFiSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQzZBUXdRQ3lPRkFoQzZBUXdQQ3lPR0FoQzZBUXdPQ3lPSEFoQzZBUXdOQ3lPSUFoQzZBUXdNQ3lPSkFoQzZBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzZBUXdLQ3lPREFoQzZBUXdKQ3lPRUFoQzdBUXdJQ3lPRkFoQzdBUXdIQ3lPR0FoQzdBUXdHQ3lPSEFoQzdBUXdGQ3lPSUFoQzdBUXdFQ3lPSkFoQzdBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzdBUXdDQ3lPREFoQzdBUXdCQzBGL0R3dEJCQXM3QVFGL0lBQVFkU0lCUVg5R0JIOGdBQkFkQlNBQkMwSC9BWEVnQUVFQmFpSUJFSFVpQUVGL1JnUi9JQUVRSFFVZ0FBdEIvd0Z4UVFoMGNnc01BRUVJRUpvQklBQVF2UUVMTkFBZ0FFR0FBWEZCZ0FGR0VLTUJJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU0lBUlJDaEFVRUFFS0lCUVFBUW53RWdBQXN5QUNBQVFRRnhRUUJMRUtNQklBQkJCM1FnQUVIL0FYRkJBWFp5UWY4QmNTSUFSUkNoQVVFQUVLSUJRUUFRbndFZ0FBczRBUUYvSTRvQ1FRUjJRUUZ4SUFCQkFYUnlRZjhCY1NFQklBQkJnQUZ4UVlBQlJoQ2pBU0FCUlJDaEFVRUFFS0lCUVFBUW53RWdBUXM1QVFGL0k0b0NRUVIyUVFGeFFRZDBJQUJCL3dGeFFRRjJjaUVCSUFCQkFYRkJBVVlRb3dFZ0FVVVFvUUZCQUJDaUFVRUFFSjhCSUFFTEtnQWdBRUdBQVhGQmdBRkdFS01CSUFCQkFYUkIvd0Z4SWdCRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBQ3owQkFYOGdBRUgvQVhGQkFYWWlBVUdBQVhJZ0FTQUFRWUFCY1VHQUFVWWJJZ0ZGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFRUUZ4UVFGR0VLTUJJQUVMS3dBZ0FFRVBjVUVFZENBQVFmQUJjVUVFZG5JaUFFVVFvUUZCQUJDaUFVRUFFSjhCUVFBUW93RWdBQXNxQVFGL0lBQkIvd0Z4UVFGMklnRkZFS0VCUVFBUW9nRkJBQkNmQVNBQVFRRnhRUUZHRUtNQklBRUxIZ0JCQVNBQWRDQUJjVUgvQVhGRkVLRUJRUUFRb2dGQkFSQ2ZBU0FCQzhnSUFRVi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUWR4SWdRRVFDQUVRUUZHRFFFQ1FDQUVRUUpyRGdZREJBVUdCd2dBQ3d3SUN5T0VBaUVCREFjTEk0VUNJUUVNQmdzamhnSWhBUXdGQ3lPSEFpRUJEQVFMSTRnQ0lRRU1Bd3NqaVFJaEFRd0NDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVNFQkRBRUxJNE1DSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQlFSQUlBVkJBVVlOQVFKQUlBVkJBbXNPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzZ0FFRUhUQVIvSUFFUXZ3RWhBa0VCQlNBQVFROU1CSDhnQVJEQUFTRUNRUUVGUVFBTEN5RUREQThMSUFCQkYwd0VmeUFCRU1FQklRSkJBUVVnQUVFZlRBUi9JQUVRd2dFaEFrRUJCVUVBQ3dzaEF3d09DeUFBUVNkTUJIOGdBUkREQVNFQ1FRRUZJQUJCTDB3RWZ5QUJFTVFCSVFKQkFRVkJBQXNMSVFNTURRc2dBRUUzVEFSL0lBRVF4UUVoQWtFQkJTQUFRVDlNQkg4Z0FSREdBU0VDUVFFRlFRQUxDeUVEREF3TElBQkJ4d0JNQkg5QkFDQUJFTWNCSVFKQkFRVWdBRUhQQUV3RWYwRUJJQUVReHdFaEFrRUJCVUVBQ3dzaEF3d0xDeUFBUWRjQVRBUi9RUUlnQVJESEFTRUNRUUVGSUFCQjN3Qk1CSDlCQXlBQkVNY0JJUUpCQVFWQkFBc0xJUU1NQ2dzZ0FFSG5BRXdFZjBFRUlBRVF4d0VoQWtFQkJTQUFRZThBVEFSL1FRVWdBUkRIQVNFQ1FRRUZRUUFMQ3lFRERBa0xJQUJCOXdCTUJIOUJCaUFCRU1jQklRSkJBUVVnQUVIL0FFd0VmMEVISUFFUXh3RWhBa0VCQlVFQUN3c2hBd3dJQ3lBQVFZY0JUQVIvSUFGQmZuRWhBa0VCQlNBQVFZOEJUQVIvSUFGQmZYRWhBa0VCQlVFQUN3c2hBd3dIQ3lBQVFaY0JUQVIvSUFGQmUzRWhBa0VCQlNBQVFaOEJUQVIvSUFGQmQzRWhBa0VCQlVFQUN3c2hBd3dHQ3lBQVFhY0JUQVIvSUFGQmIzRWhBa0VCQlNBQVFhOEJUQVIvSUFGQlgzRWhBa0VCQlVFQUN3c2hBd3dGQ3lBQVFiY0JUQVIvSUFGQnYzOXhJUUpCQVFVZ0FFRy9BVXdFZnlBQlFmOStjU0VDUVFFRlFRQUxDeUVEREFRTElBQkJ4d0ZNQkg4Z0FVRUJjaUVDUVFFRklBQkJ6d0ZNQkg4Z0FVRUNjaUVDUVFFRlFRQUxDeUVEREFNTElBQkIxd0ZNQkg4Z0FVRUVjaUVDUVFFRklBQkIzd0ZNQkg4Z0FVRUljaUVDUVFFRlFRQUxDeUVEREFJTElBQkI1d0ZNQkg4Z0FVRVFjaUVDUVFFRklBQkI3d0ZNQkg4Z0FVRWdjaUVDUVFFRlFRQUxDeUVEREFFTElBQkI5d0ZNQkg4Z0FVSEFBSEloQWtFQkJTQUFRZjhCVEFSL0lBRkJnQUZ5SVFKQkFRVkJBQXNMSVFNTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBRUJFQWdCRUVCUmcwQkFrQWdCRUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBaVNFQWd3SEN5QUNKSVVDREFZTElBSWtoZ0lNQlFzZ0FpU0hBZ3dFQ3lBQ0pJZ0NEQU1MSUFJa2lRSU1BZ3RCQVNBRlFRZEtJQVZCQkVnYkJFQWppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWdBaENkQVFzTUFRc2dBaVNEQWd0QkJFRi9JQU1iQzdzRUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFVY0VRQ0FBUWNFQlJnMEJBa0FnQUVIQ0FXc09EZ01TQkFVR0J3Z0pDZ3NNRVEwT0FBc01EZ3NqaWdKQkIzWkJBWEVORVF3T0N5T0xBaEMrQVVILy93TnhJUUFqaXdKQkFtcEIvLzhEY1NTTEFpQUFRWUQrQTNGQkNIVWtoQUlnQUVIL0FYRWtoUUpCQkE4TEk0b0NRUWQyUVFGeERSRU1EZ3NqaWdKQkIzWkJBWEVORUF3TUN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT0ZBa0gvQVhFamhBSkIvd0Z4UVFoMGNoQ2xBUXdOQ3hDYkFSQ3hBUXdOQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVBSkl3Q0RBc0xJNG9DUVFkMlFRRnhRUUZIRFFvTUJ3c2ppd0lpQUJDK0FVSC8vd054Skl3Q0lBQkJBbXBCLy84RGNTU0xBZ3dKQ3lPS0FrRUhka0VCY1VFQlJnMEhEQW9MRUpzQlFmOEJjUkRJQVNFQUk0d0NRUUZxUWYvL0EzRWtqQUlnQUE4TEk0b0NRUWQyUVFGeFFRRkhEUWdqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqakFKQkFtcEIvLzhEY1JDbEFRd0ZDeENiQVJDeUFRd0dDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWhDbEFVRUlKSXdDREFRTFFYOFBDeU9MQWlJQUVMNEJRZi8vQTNFa2pBSWdBRUVDYWtILy93TnhKSXNDUVF3UEN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01Ba0VDYWtILy93TnhFS1VCQ3hDY0FVSC8vd054Skl3Q0MwRUlEd3NqakFKQkFXcEIvLzhEY1NTTUFrRUVEd3NqakFKQkFtcEIvLzhEY1NTTUFrRU1DNkFFQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUZIQkVBZ0FFSFJBVVlOQVFKQUlBQkIwZ0ZyRGc0REFBUUZCZ2NJQ1FvQUN3QU1EUUFMREEwTEk0b0NRUVIyUVFGeERROE1EUXNqaXdJaUFSQytBVUgvL3dOeElRQWdBVUVDYWtILy93TnhKSXNDSUFCQmdQNERjVUVJZFNTR0FpQUFRZjhCY1NTSEFrRUVEd3NqaWdKQkJIWkJBWEVORHd3TUN5T0tBa0VFZGtFQmNRME9JNHNDUVFKclFmLy9BM0VpQUNTTEFpQUFJNHdDUVFKcVFmLy9BM0VRcFFFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpod0pCL3dGeEk0WUNRZjhCY1VFSWRISVFwUUVNQ3dzUW13RVF0QUVNQ3dzaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSVFwUUZCRUNTTUFnd0pDeU9LQWtFRWRrRUJjVUVCUncwSURBWUxJNHNDSWdBUXZnRkIvLzhEY1NTTUFrRUJKTGdCSUFCQkFtcEIvLzhEY1NTTEFnd0hDeU9LQWtFRWRrRUJjVUVCUmcwRkRBZ0xJNG9DUVFSMlFRRnhRUUZIRFFjaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSkJBbXBCLy84RGNSQ2xBUXdFQ3hDYkFSQzFBUXdGQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVZSkl3Q0RBTUxRWDhQQ3lPTEFpSUFFTDRCUWYvL0EzRWtqQUlnQUVFQ2FrSC8vd054SklzQ1FRd1BDeENjQVVILy93TnhKSXdDQzBFSUR3c2pqQUpCQVdwQi8vOERjU1NNQWtFRUR3c2pqQUpCQW1wQi8vOERjU1NNQWtFTUM3RURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGSEJFQWdBRUhoQVVZTkFRSkFJQUJCNGdGckRnNERBQUFFQlFZSENBa0FBQUFLQ3dBTERBc0xFSnNCUWY4QmNVR0EvZ05xSTRNQ0VKMEJEQXNMSTRzQ0lnRVF2Z0ZCLy84RGNTRUFJQUZCQW1wQi8vOERjU1NMQWlBQVFZRCtBM0ZCQ0hVa2lBSWdBRUgvQVhFa2lRSkJCQThMSTRVQ1FZRCtBMm9qZ3dJUW5RRkJCQThMSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5RUtVQlFRZ1BDeENiQVJDM0FRd0hDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWhDbEFVRWdKSXdDUVFnUEN4Q2JBVUVZZEVFWWRTRUFJNHNDSUFCQkFSQ21BU09MQWlBQWFrSC8vd054SklzQ1FRQVFvUUZCQUJDaUFTT01Ba0VCYWtILy93TnhKSXdDUVF3UEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpU01Ba0VFRHdzUW5BRkIvLzhEY1NPREFoQ2RBU09NQWtFQ2FrSC8vd054Skl3Q1FRUVBDeENiQVJDNEFRd0NDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWhDbEFVRW9KSXdDUVFnUEMwRi9Ed3NqakFKQkFXcEIvLzhEY1NTTUFrRUVDK2NEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGSEJFQWdBRUh4QVVZTkFRSkFJQUJCOGdGckRnNERCQUFGQmdjSUNRb0xBQUFNRFFBTERBMExFSnNCUWY4QmNVR0EvZ05xRUtjQlFmOEJjU1NEQWd3TkN5T0xBaUlCRUw0QlFmLy9BM0VoQUNBQlFRSnFRZi8vQTNFa2l3SWdBRUdBL2dOeFFRaDFKSU1DSUFCQi93RnhKSW9DREEwTEk0VUNRWUQrQTJvUXB3RkIvd0Z4SklNQ0RBd0xRUUFrdHdFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWppZ0pCL3dGeEk0TUNRZjhCY1VFSWRISVFwUUZCQ0E4TEVKc0JFTG9CREFnTEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0d0NFS1VCUVRBa2pBSkJDQThMRUpzQlFSaDBRUmgxSVFBaml3SWhBVUVBRUtFQlFRQVFvZ0VnQVNBQVFRRVFwZ0VnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTSUFpQUFRZjhCY1NTSkFpT01Ba0VCYWtILy93TnhKSXdDUVFnUEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpU0xBa0VJRHdzUW5BRkIvLzhEY1JDbkFVSC9BWEVrZ3dJampBSkJBbXBCLy84RGNTU01BZ3dGQzBFQkpMZ0JEQVFMRUpzQkVMc0JEQUlMSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTR3Q0VLVUJRVGdrakFKQkNBOExRWDhQQ3lPTUFrRUJha0gvL3dOeEpJd0NDMEVFQzlnQkFRRi9JNHdDUVFGcVFmLy9BM0VoQVNPUUFnUkFJQUZCQVd0Qi8vOERjU0VCQ3lBQkpJd0NBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdFRVFDQUJRUUZyRGc0QkFnTUVCUVlIQ0FrS0N3d05EZzhMSUFBUXFBRVBDeUFBRUtrQkR3c2dBQkNxQVE4TElBQVFxd0VQQ3lBQUVLd0JEd3NnQUJDdEFROExJQUFRcmdFUEN5QUFFSzhCRHdzZ0FCQ3pBUThMSUFBUXRnRVBDeUFBRUxrQkR3c2dBQkM4QVE4TElBQVF5UUVQQ3lBQUVNb0JEd3NnQUJETEFROExJQUFRekFFTHZnRUJBbjlCQUNTM0FVR1AvZ01RSFVFQklBQjBRWDl6Y1NJQkpMOEJRWS8rQXlBQkVCOGppd0pCQW10Qi8vOERjU1NMQWlPTEFpSUJJNHdDSWdKQi93RnhFQjhnQVVFQmFpQUNRWUQrQTNGQkNIVVFId0pBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQXdNRUJRQUxEQVVMUVFBa3dBRkJ3QUFrakFJTUJBdEJBQ1RCQVVISUFDU01BZ3dEQzBFQUpNSUJRZEFBSkl3Q0RBSUxRUUFrd3dGQjJBQWtqQUlNQVF0QkFDVEVBVUhnQUNTTUFnc0w2UUVCQW44anVBRUVRRUVCSkxjQlFRQWt1QUVMSTdrQkk3OEJjVUVmY1VFQVNnUkFJNDhDUlVFQUk3Y0JHd1IvSThBQlFRQWp1Z0ViQkg5QkFCRE9BVUVCQlNQQkFVRUFJN3NCR3dSL1FRRVF6Z0ZCQVFVandnRkJBQ084QVJzRWYwRUNFTTRCUVFFRkk4TUJRUUFqdlFFYkJIOUJBeERPQVVFQkJTUEVBVUVBSTc0Qkd3Ui9RUVFRemdGQkFRVkJBQXNMQ3dzTEJVRUFDd1JBUVFFamp3SWpqZ0liQkg5QkFDU1BBa0VBSkk0Q1FRQWtrQUpCQUNTUkFrRVlCVUVVQ3lFQUMwRUJJNDhDSTQ0Q0d3UkFRUUFrandKQkFDU09Ba0VBSkpBQ1FRQWtrUUlMSUFBUEMwRUFDN1lCQVFKL1FRRWttQUlqa0FJRVFDT01BaEFkUWY4QmNSRE5BUkNhQVVFQUpJOENRUUFramdKQkFDU1FBa0VBSkpFQ0N4RFBBU0lBUVFCS0JFQWdBQkNhQVF0QkJDRUFRUUFqa1FKRlFRRWpqd0lqamdJYkd3UkFJNHdDRUIxQi93RnhFTTBCSVFBTEk0b0NRZkFCY1NTS0FpQUFRUUJNQkVBZ0FBOExJQUFRbWdFamx3SkJBV29pQVNPVkFrNEVmeU9XQWtFQmFpU1dBaUFCSTVVQ2F3VWdBUXNrbHdJampBSWozUUZHQkVCQkFTVGdBUXNnQUFzRkFDTzJBUXV1QVFFRGZ5QUFRWDlCZ0FnZ0FFRUFTQnNnQUVFQVNoc2hBa0VBSVFBRFFDUGdBVVZCQUNBQlJVRUFRUUFnQUVVZ0F4c2JHd1JBRU5BQlFRQklCRUJCQVNFREJTT05Ba0hRcEFRamdnSjBUZ1JBUVFFaEFBVkJBU0FCSTdZQklBSk9RUUFnQWtGL1Noc2JJUUVMQ3d3QkN3c2dBQVJBSTQwQ1FkQ2tCQ09DQW5SckpJMENRUUFQQ3lBQkJFQkJBUThMSStBQkJFQkJBQ1RnQVVFQ0R3c2pqQUpCQVd0Qi8vOERjU1NNQWtGL0N3Y0FRWDhRMGdFTE5BRUNmd05BSUFGQkFFNUJBQ0FDSUFCSUd3UkFRWDhRMGdFaEFTQUNRUUZxSVFJTUFRc0xJQUZCQUVnRVFDQUJEd3RCQUFzRkFDT1NBZ3NGQUNPVEFnc0ZBQ09VQWd0YkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJOUlCRHdzajFRRVBDeVBUQVE4TEk5UUJEd3NqMWdFUEN5UFhBUThMSTlnQkR3c2oyUUVQQzBFQUM0Y0JBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09CZ01FQlFZSENBQUxEQWdMSUFGQkFFY2swZ0VNQndzZ0FVRUFSeVRWQVF3R0N5QUJRUUJISk5NQkRBVUxJQUZCQUVjazFBRU1CQXNnQVVFQVJ5VFdBUXdEQ3lBQlFRQkhKTmNCREFJTElBRkJBRWNrMkFFTUFRc2dBVUVBUnlUWkFRc0xVUUVCZjBFQUpKRUNJQUFRMkFGRkJFQkJBU0VCQ3lBQVFRRVEyUUVnQVFSQVFRRkJBVUVBUVFGQkFDQUFRUU5NR3lJQVFRQWoyd0ViR3lBQVJVRUFJOXdCR3hzRVFFRUJKTVFCUVFRUVdnc0xDd2tBSUFCQkFCRFpBUXVhQVFBZ0FFRUFTZ1JBUVFBUTJnRUZRUUFRMndFTElBRkJBRW9FUUVFQkVOb0JCVUVCRU5zQkN5QUNRUUJLQkVCQkFoRGFBUVZCQWhEYkFRc2dBMEVBU2dSQVFRTVEyZ0VGUVFNUTJ3RUxJQVJCQUVvRVFFRUVFTm9CQlVFRUVOc0JDeUFGUVFCS0JFQkJCUkRhQVFWQkJSRGJBUXNnQmtFQVNnUkFRUVlRMmdFRlFRWVEyd0VMSUFkQkFFb0VRRUVIRU5vQkJVRUhFTnNCQ3dzSEFDQUFKTjBCQ3djQVFYOGszUUVMQndBZ0FDVGVBUXNIQUVGL0pONEJDd2NBSUFBazN3RUxCd0JCZnlUZkFRc0ZBQ09EQWdzRkFDT0VBZ3NGQUNPRkFnc0ZBQ09HQWdzRkFDT0hBZ3NGQUNPSUFnc0ZBQ09KQWdzRkFDT0tBZ3NGQUNPTUFnc0ZBQ09MQWdzTEFDT01BaEFkUWY4QmNRc0ZBQ1B0QVF1ckF3RUtmMEdBZ0FKQmdKQUNJK1lCR3lFSVFZQzRBa0dBc0FJajV3RWJJUWtEUUNBRlFZQUNTQVJBUVFBaEJBTkFJQVJCZ0FKSUJFQWdDQ0FGUVFOMVFRVjBJQWxxSUFSQkEzVnFJZ0pCZ0pCK2FpMEFBQkJOSVFZZ0JVRUlieUVCUVFjZ0JFRUliMnNoQjBFQUlRTUNmeUFBUVFCS1FRQWpnUUliQkVBZ0FrR0EwSDVxTFFBQUlRTUxJQU5Cd0FCeEN3UkFRUWNnQVdzaEFRdEJBQ0VDSUFGQkFYUWdCbW9pQmtHQWtINXFRUUZCQUNBRFFRaHhHeUlDUVExMGFpMEFBQ0VLUVFBaEFTQUdRWUdRZm1vZ0FrRU5kR290QUFCQkFTQUhkSEVFUUVFQ0lRRUxJQUZCQVdvZ0FVRUJJQWQwSUFweEd5RUJJQVZCQ0hRZ0JHcEJBMndoQWlBQVFRQktRUUFqZ1FJYkJFQWdBa0dBb1F0cUlnSWdBMEVIY1NBQlFRQVFUaUlCUVI5eFFRTjBPZ0FBSUFKQkFXb2dBVUhnQjNGQkJYVkJBM1E2QUFBZ0FrRUNhaUFCUVlENEFYRkJDblZCQTNRNkFBQUZJQUpCZ0tFTGFpSURJQUZCeC80REVFOGlBVUdBZ1B3SGNVRVFkVG9BQUNBRFFRRnFJQUZCZ1A0RGNVRUlkVG9BQUNBRFFRSnFJQUU2QUFBTElBUkJBV29oQkF3QkN3c2dCVUVCYWlFRkRBRUxDd3ZWQXdFTWZ3TkFJQVJCRjA1RkJFQkJBQ0VEQTBBZ0EwRWZTQVJBUVFGQkFDQURRUTlLSWdjYklRa2dCRUVQYXlBRUlBUkJEMG9pQUJ0QkJIUWlCU0FEUVE5cmFpQURJQVZxSUFjYklRaEJnSkFDUVlDQUFpQUFHeUVLUWNmK0F5RUhRWDhoQmtGL0lRVkJBQ0VCQTBBZ0FVRUlTQVJBUVFBaEFBTkFJQUJCQlVnRVFDQUFRUU4wSUFGcVFRSjBJZ0pCZ3Z3RGFoQWRJQWhHQkVBZ0FrR0QvQU5xRUIwaEFrRUJRUUFnQWtFSWNVRUFJNEVDR3hzZ0NVWUVRRUVJSVFGQkJTRUFJQUlpQlVFUWNRUi9RY24rQXdWQnlQNERDeUVIQ3dzZ0FFRUJhaUVBREFFTEN5QUJRUUZxSVFFTUFRc0xJQVZCQUVoQkFDT0JBaHNFUUVHQXVBSkJnTEFDSStjQkd5RUxRWDhoQUVFQUlRSURRQ0FDUVNCSUJFQkJBQ0VCQTBBZ0FVRWdTQVJBSUFGQkJYUWdDMm9nQW1vaUJrR0FrSDVxTFFBQUlBaEdCRUJCSUNFQ1FTQWhBU0FHSVFBTElBRkJBV29oQVF3QkN3c2dBa0VCYWlFQ0RBRUxDeUFBUVFCT0JIOGdBRUdBMEg1cUxRQUFCVUYvQ3lFR0MwRUFJUUFEUUNBQVFRaElCRUFnQ0NBS0lBbEJBRUVISUFBZ0EwRURkQ0FFUVFOMElBQnFRZmdCUVlDaEZ5QUhJQVlnQlJCUUdpQUFRUUZxSVFBTUFRc0xJQU5CQVdvaEF3d0JDd3NnQkVFQmFpRUVEQUVMQ3d1V0FnRUpmd05BSUFSQkNFNUZCRUJCQUNFQkEwQWdBVUVGU0FSQUlBRkJBM1FnQkdwQkFuUWlBRUdBL0FOcUVCMGFJQUJCZ2Z3RGFoQWRHaUFBUVlMOEEyb1FIU0VDUVFFaEJTUG9BUVJBSUFKQkFtOUJBVVlFUUNBQ1FRRnJJUUlMUVFJaEJRc2dBRUdEL0FOcUVCMGhCa0VBSVFkQkFVRUFJQVpCQ0hGQkFDT0JBaHNiSVFkQnlQNERJUWhCeWY0RFFjaitBeUFHUVJCeEd5RUlRUUFoQUFOQUlBQWdCVWdFUUVFQUlRTURRQ0FEUVFoSUJFQWdBQ0FDYWtHQWdBSWdCMEVBUVFjZ0F5QUVRUU4wSUFGQkJIUWdBMm9nQUVFRGRHcEJ3QUJCZ0tFZ0lBaEJmeUFHRUZBYUlBTkJBV29oQXd3QkN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFSQkFXb2hCQXdCQ3dzTEJRQWp4Z0VMQlFBanh3RUxCUUFqeWdFTEdBRUJmeVBNQVNFQUk4c0JCRUFnQUVFRWNpRUFDeUFBQ3pBQkFYOERRQUpBSUFCQi8vOERUZzBBSUFCQmdMWEpCR29nQUJCMk9nQUFJQUJCQVdvaEFBd0JDd3RCQUNUZ0FRc1dBQkFiUHdCQmxBRklCRUJCbEFFL0FHdEFBQm9MQzl3QkFDQUFRWndDU1FSQUR3c2dBRUVRYXlFQUFrQUNRQUpBQWtBQ1FBSkFJQUZCQVVjRVFDQUJRUUpHRFFFQ1FDQUJRUU5yRGdNREJBVUFDd3dGQ3lBQUVCa01CUXNnQUNnQ0JFSC8vLy8vQUhGQkFFMEVRRUVBUVlBQlFjc0FRUkVRQUFBTElBQWdBQ2dDQkVFQmF6WUNCQ0FBRUFjTUJBc2dBQkFLREFNTElBQW9BZ1FpQVVHQWdJQ0FmM0VnQVVFQmFrR0FnSUNBZjNGSEJFQkJBRUdBQVVIV0FFRUdFQUFBQ3lBQUlBRkJBV28yQWdRZ0FVR0FnSUNBQjNFRVFDQUFFQWtMREFJTElBQVFDd3dCQzBFQVFZQUJRZUVBUVJnUUFBQUxDeTBBQWtBQ1FBSkFJQUJCQ0dzb0FnQU9Bd0FBQVFJTER3c2dBQ2dDQUNJQUJFQWdBQ0FCRVBnQkN3OExBQXNEQUFFTEhRQUNRQUpBQWtBam1nSU9BZ0VDQUFzQUMwRUFJUUFMSUFBUTBnRUxCd0FnQUNTYUFnc2xBQUpBQWtBQ1FBSkFJNW9DRGdNQkFnTUFDd0FMUVFFaEFBdEJmeUVCQ3lBQkVOSUJDd3VmQWdZQVFRZ0xMUjRBQUFBQkFBQUFBUUFBQUI0QUFBQitBR3dBYVFCaUFDOEFjZ0IwQUM4QWRBQnNBSE1BWmdBdUFIUUFjd0JCT0FzM0tBQUFBQUVBQUFBQkFBQUFLQUFBQUdFQWJBQnNBRzhBWXdCaEFIUUFhUUJ2QUc0QUlBQjBBRzhBYndBZ0FHd0FZUUJ5QUdjQVpRQkI4QUFMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFjQUIxQUhJQVpRQXVBSFFBY3dCQm9BRUxNeVFBQUFBQkFBQUFBUUFBQUNRQUFBQkpBRzRBWkFCbEFIZ0FJQUJ2QUhVQWRBQWdBRzhBWmdBZ0FISUFZUUJ1QUdjQVpRQkIyQUVMSXhRQUFBQUJBQUFBQVFBQUFCUUFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDNEFkQUJ6QUVHQUFnc1ZBd0FBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFRQURNUWMyOTFjbU5sVFdGd2NHbHVaMVZTVENGamIzSmxMMlJwYzNRdlkyOXlaUzUxYm5SdmRXTm9aV1F1ZDJGemJTNXRZWEE9Iik6CiJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvd3x8InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZj9hd2FpdCBJKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlBRVJZQUovZndGL1lBQUFZQU4vZjM4QmYyQUVmMzkvZndCZ0FuOS9BR0FCZndGL1lBRi9BR0FEZjM5L0FHQUtmMzkvZjM5L2YzOS9md0JnQUFGL1lBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCMzkvZjM5L2YzOEFZQVIvZjM5L0FYOWdDSDkvZjM5L2YzOS9BR0FGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBREEvOEIvUUVFQkFjQkJRQUdCQVlHQmdFRUJ3QUFCZ1VGQndjR0FRWUdCZ0VGQlFFRUFRRUdCZ0VCQVFFQkFRRUdBUUVHQmdFQkFRRUlDUUVCQVFFQkFRRUJCZ1lCQVFFQkFRRUJBUWtKQ1FrUEFBSUFFQXNNQ2dvSEJBWUJBUVlCQVFFQkJnRUJBUUVGQlFBRkJRa0JCUVVBRFFZR0JnRUZDUVVGQkFZR0JnWUdBUVlCQmdFR0FRWUFCZ2tKQmdRRkFBWUJBUVlBQkFjQkFBRUdBUVlHQ1FrRUJBWUVCZ1lHQkFRSEJRVUZCUVVGQlFVRkJBWUdCUVlHQlFZR0JRWUdCUVVGQlFVRkJRVUZCUVVBQlFVRkJRVUZCZ2tKQ1FVSkJRa0pDUVVFQmdZT0JnRUdBUVlCQ1FrSkNRa0pDUWtKQ1FrSkJnRUJDUWtKQ1FFQkJBUUJCUVlBQlFNQkFBRUc3UXViQW44QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVFQUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FBUXQvQUVHQWtRUUxmd0JCZ0xnQkMzOEFRWURKQlF0L0FFR0EyQVVMZndCQmdLRUxDMzhBUVlDQURBdC9BRUdBb1JjTGZ3QkJnSUFKQzM4QVFZQ2hJQXQvQUVHQStBQUxmd0JCZ0pBRUMzOEFRWUNKSFF0L0FFR0FtU0VMZndCQmdJQUlDMzhBUVlDWktRdC9BRUdBZ0FnTGZ3QkJnSmt4QzM4QVFZQ0FDQXQvQUVHQW1Ua0xmd0JCZ0lBSUMzOEFRWUNad1FBTGZ3QkJnSUFJQzM4QVFZQ1p5UUFMZndCQmdJQUlDMzhBUVlDWjBRQUxmd0JCZ0JRTGZ3QkJnSzNSQUF0L0FFR0FpUGdEQzM4QVFZQzF5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnTFhOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR0FBZ3QvQVVFQUN3ZndFR1VHYldWdGIzSjVBZ0FIWDE5aGJHeHZZd0FRQ0Y5ZmNtVjBZV2x1QUJJSlgxOXlaV3hsWVhObEFCb0pYMTlqYjJ4c1pXTjBBQXdMWDE5eWRIUnBYMkpoYzJVRG1RSUdZMjl1Wm1sbkFEUU9hR0Z6UTI5eVpWTjBZWEowWldRQU5RbHpZWFpsVTNSaGRHVUFQQWxzYjJGa1UzUmhkR1VBUndWcGMwZENRd0JJRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFCSkMyZGxkRk4wWlhCVFpYUnpBRW9JWjJWMFUzUmxjSE1BU3hWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUExQUVNWlhobFkzVjBaVVp5WVcxbEFOTUJDVjlmYzJWMFlYSm5Zd0Q4QVJsbGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2QVBzQkZXVjRaV04xZEdWVmJuUnBiRU52Ym1ScGRHbHZiZ0Q5QVF0bGVHVmpkWFJsVTNSbGNBRFFBUlJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFEVkFReG5aWFJEZVdOc1pWTmxkSE1BMWdFSloyVjBRM2xqYkdWekFOY0JEbk5sZEVwdmVYQmhaRk4wWVhSbEFOd0JIMmRsZEU1MWJXSmxjazltVTJGdGNHeGxjMGx1UVhWa2FXOUNkV1ptWlhJQTBRRVFZMnhsWVhKQmRXUnBiMEoxWm1abGNnQkRISE5sZEUxaGJuVmhiRU52Ykc5eWFYcGhkR2x2YmxCaGJHVjBkR1VBSWhkWFFWTk5RazlaWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ014RTFkQlUwMUNUMWxmVFVWTlQxSlpYMU5KV2tVRE1oSlhRVk5OUWs5WlgxZEJVMDFmVUVGSFJWTURNeDVCVTFORlRVSk1XVk5EVWtsUVZGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJScEJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVTBsYVJRTUdGbGRCVTAxQ1QxbGZVMVJCVkVWZlRFOURRVlJKVDA0REJ4SlhRVk5OUWs5WlgxTlVRVlJGWDFOSldrVURDQ0JIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTVBIRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VERUJKV1NVUkZUMTlTUVUxZlRFOURRVlJKVDA0RENRNVdTVVJGVDE5U1FVMWZVMGxhUlFNS0VWZFBVa3RmVWtGTlgweFBRMEZVU1U5T0F3c05WMDlTUzE5U1FVMWZVMGxhUlFNTUprOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMHhQUTBGVVNVOU9BdzBpVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1PR0VkU1FWQklTVU5UWDA5VlZGQlZWRjlNVDBOQlZFbFBUZ01kRkVkU1FWQklTVU5UWDA5VlZGQlZWRjlUU1ZwRkF4NFVSMEpEWDFCQlRFVlVWRVZmVEU5RFFWUkpUMDRERVJCSFFrTmZVRUZNUlZSVVJWOVRTVnBGQXhJWVFrZGZVRkpKVDFKSlZGbGZUVUZRWDB4UFEwRlVTVTlPQXhNVVFrZGZVRkpKVDFKSlZGbGZUVUZRWDFOSldrVURGQTVHVWtGTlJWOU1UME5CVkVsUFRnTVZDa1pTUVUxRlgxTkpXa1VERmhkQ1FVTkxSMUpQVlU1RVgwMUJVRjlNVDBOQlZFbFBUZ01YRTBKQlEwdEhVazlWVGtSZlRVRlFYMU5KV2tVREdCSlVTVXhGWDBSQlZFRmZURTlEUVZSSlQwNERHUTVVU1V4RlgwUkJWRUZmVTBsYVJRTWFFazlCVFY5VVNVeEZVMTlNVDBOQlZFbFBUZ01iRGs5QlRWOVVTVXhGVTE5VFNWcEZBeHdWUVZWRVNVOWZRbFZHUmtWU1gweFBRMEZVU1U5T0F5Y1JRVlZFU1U5ZlFsVkdSa1ZTWDFOSldrVURLQmxEU0VGT1RrVk1YekZmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeDhWUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlUU1ZwRkF5QVpRMGhCVGs1RlRGOHlYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWhGVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZVMGxhUlFNaUdVTklRVTVPUlV4Zk0xOUNWVVpHUlZKZlRFOURRVlJKVDA0REl4VkRTRUZPVGtWTVh6TmZRbFZHUmtWU1gxTkpXa1VESkJsRFNFRk9Ua1ZNWHpSZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlVVlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5VFNWcEZBeVlXUTBGU1ZGSkpSRWRGWDFKQlRWOU1UME5CVkVsUFRnTXBFa05CVWxSU1NVUkhSVjlTUVUxZlUwbGFSUU1xRVVKUFQxUmZVazlOWDB4UFEwRlVTVTlPQXlzTlFrOVBWRjlTVDAxZlUwbGFSUU1zRmtOQlVsUlNTVVJIUlY5U1QwMWZURTlEUVZSSlQwNERMUkpEUVZKVVVrbEVSMFZmVWs5TlgxTkpXa1VETGgxRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXZHVVJGUWxWSFgwZEJUVVZDVDFsZlRVVk5UMUpaWDFOSldrVURNQ0ZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFIQnR6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBM1FFZGNtVnpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUEzZ0VaYzJWMFVtVmhaRWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURmQVJ0eVpYTmxkRkpsWVdSSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTRBRWFjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUE0UUVjY21WelpYUlhjbWwwWlVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFEaUFReG5aWFJTWldkcGMzUmxja0VBNHdFTVoyVjBVbVZuYVhOMFpYSkNBT1FCREdkbGRGSmxaMmx6ZEdWeVF3RGxBUXhuWlhSU1pXZHBjM1JsY2tRQTVnRU1aMlYwVW1WbmFYTjBaWEpGQU9jQkRHZGxkRkpsWjJsemRHVnlTQURvQVF4blpYUlNaV2RwYzNSbGNrd0E2UUVNWjJWMFVtVm5hWE4wWlhKR0FPb0JFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBT3NCRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0RzQVJsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QU8wQkJXZGxkRXhaQU80QkhXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBTzhCR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUUR3QVJOa2NtRjNUMkZ0Vkc5WFlYTnRUV1Z0YjNKNUFQRUJCbWRsZEVSSlZnRHlBUWRuWlhSVVNVMUJBUE1CQm1kbGRGUk5RUUQwQVFablpYUlVRVU1BOVFFVGRYQmtZWFJsUkdWaWRXZEhRazFsYlc5eWVRRDJBUWdDOXdFS2hac0MvUUdnQWdFRWZ5QUJLQUlBSWdOQkFYRkZCRUJCQUVFWVFaVUNRUTBRQUFBTElBTkJmSEVpQWtFUVR3Ui9JQUpCOFAvLy93TkpCVUVBQzBVRVFFRUFRUmhCbHdKQkRSQUFBQXNnQWtHQUFra0VmeUFDUVFSMklRSkJBQVVnQWtFZklBSm5heUlEUVFScmRrRVFjeUVDSUFOQkIyc0xJZ05CRjBrRWZ5QUNRUkJKQlVFQUMwVUVRRUVBUVJoQnBBSkJEUkFBQUFzZ0FTZ0NGQ0VFSUFFb0FoQWlCUVJBSUFVZ0JEWUNGQXNnQkFSQUlBUWdCVFlDRUFzZ0EwRUVkQ0FDYWtFQ2RDQUFhaWdDWUNBQlJnUkFJQU5CQkhRZ0FtcEJBblFnQUdvZ0JEWUNZQ0FFUlFSQUlBTkJBblFnQUdvZ0EwRUNkQ0FBYWlnQ0JFRUJJQUowUVg5emNTSUJOZ0lFSUFGRkJFQWdBQ0FBS0FJQVFRRWdBM1JCZjNOeE5nSUFDd3NMQy8wREFRWi9JQUZGQkVCQkFFRVlRYzBCUVEwUUFBQUxJQUVvQWdBaUEwRUJjVVVFUUVFQVFSaEJ6d0ZCRFJBQUFBc2dBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJZ1ZCQVhFRVFDQURRWHh4UVJCcUlBVkJmSEZxSWdKQjhQLy8vd05KQkVBZ0FDQUVFQUVnQVNBRFFRTnhJQUp5SWdNMkFnQWdBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJUVVMQ3lBRFFRSnhCRUFnQVVFRWF5Z0NBQ0lDS0FJQUlnWkJBWEZGQkVCQkFFRVlRZVFCUVE4UUFBQUxJQVpCZkhGQkVHb2dBMEY4Y1dvaUIwSHcvLy8vQTBrRWZ5QUFJQUlRQVNBQ0lBWkJBM0VnQjNJaUF6WUNBQ0FDQlNBQkN5RUJDeUFFSUFWQkFuSTJBZ0FnQTBGOGNTSUNRUkJQQkg4Z0FrSHcvLy8vQTBrRlFRQUxSUVJBUVFCQkdFSHpBVUVORUFBQUN5QUVJQUZCRUdvZ0FtcEhCRUJCQUVFWVFmUUJRUTBRQUFBTElBUkJCR3NnQVRZQ0FDQUNRWUFDU1FSL0lBSkJCSFloQkVFQUJTQUNRUjhnQW1kcklnSkJCR3QyUVJCeklRUWdBa0VIYXdzaUEwRVhTUVIvSUFSQkVFa0ZRUUFMUlFSQVFRQkJHRUdFQWtFTkVBQUFDeUFEUVFSMElBUnFRUUowSUFCcUtBSmdJUUlnQVVFQU5nSVFJQUVnQWpZQ0ZDQUNCRUFnQWlBQk5nSVFDeUFEUVFSMElBUnFRUUowSUFCcUlBRTJBbUFnQUNBQUtBSUFRUUVnQTNSeU5nSUFJQU5CQW5RZ0FHb2dBMEVDZENBQWFpZ0NCRUVCSUFSMGNqWUNCQXZMQVFFQ2Z5QUNRUTl4UlVFQUlBRkJEM0ZGUVFBZ0FTQUNUUnNiUlFSQVFRQkJHRUdDQTBFRUVBQUFDeUFBS0FLZ0RDSURCRUFnQVNBRFFSQnFTUVJBUVFCQkdFR01BMEVQRUFBQUN5QUJRUkJySUFOR0JFQWdBeWdDQUNFRUlBRkJFR3NoQVFzRklBRWdBRUdrREdwSkJFQkJBRUVZUVpnRFFRUVFBQUFMQ3lBQ0lBRnJJZ0pCTUVrRVFBOExJQUVnQkVFQ2NTQUNRU0JyUVFGeWNqWUNBQ0FCUVFBMkFoQWdBVUVBTmdJVUlBRWdBbXBCRUdzaUFrRUNOZ0lBSUFBZ0FqWUNvQXdnQUNBQkVBSUxsd0VCQW45QkFUOEFJZ0JLQkg5QkFTQUFhMEFBUVFCSUJVRUFDd1JBQUF0Qm9BSkJBRFlDQUVIQURrRUFOZ0lBUVFBaEFBTkFBa0FnQUVFWFR3MEFJQUJCQW5SQm9BSnFRUUEyQWdSQkFDRUJBMEFDUUNBQlFSQlBEUUFnQUVFRWRDQUJha0VDZEVHZ0FtcEJBRFlDWUNBQlFRRnFJUUVNQVFzTElBQkJBV29oQUF3QkN3dEJvQUpCMEE0L0FFRVFkQkFEUWFBQ0pBQUxMUUFnQUVIdy8vLy9BMDhFUUVISUFFRVlRY2tEUVIwUUFBQUxJQUJCRDJwQmNIRWlBRUVRSUFCQkVFc2JDOTBCQVFGL0lBRkJnQUpKQkg4Z0FVRUVkaUVCUVFBRklBRkIrUC8vL3dGSkJFQkJBVUViSUFGbmEzUWdBV3BCQVdzaEFRc2dBVUVmSUFGbmF5SUNRUVJyZGtFUWN5RUJJQUpCQjJzTElnSkJGMGtFZnlBQlFSQkpCVUVBQzBVRVFFRUFRUmhCMGdKQkRSQUFBQXNnQWtFQ2RDQUFhaWdDQkVGL0lBRjBjU0lCQkg4Z0FXZ2dBa0VFZEdwQkFuUWdBR29vQW1BRklBQW9BZ0JCZnlBQ1FRRnFkSEVpQVFSL0lBRm9JZ0ZCQW5RZ0FHb29BZ1FpQWtVRVFFRUFRUmhCM3dKQkVSQUFBQXNnQW1nZ0FVRUVkR3BCQW5RZ0FHb29BbUFGUVFBTEN3czdBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FGSEJFQWdBQ0FCUWYvLy8vOTRjVUdBZ0lDQUFYSTJBZ1FnQUVFUWFrRUNFUGtCQ3dzdEFRRi9JQUVvQWdBaUFrRUJjUVJBUVFCQkdFR3pCRUVDRUFBQUN5QUJJQUpCQVhJMkFnQWdBQ0FCRUFJTEhRQWdBQ0FBS0FJRVFmLy8vLzk0Y1RZQ0JDQUFRUkJxUVFRUStRRUxUd0VCZnlBQUtBSUVJZ0ZCZ0lDQWdBZHhRWUNBZ0lBQlJnUkFJQUZCLy8vLy93QnhRUUJMQkVBZ0FCQUpCU0FBSUFGQi8vLy8vM2h4UVlDQWdJQUNjallDQkNBQVFSQnFRUU1RK1FFTEN3dEtBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FKR0JIOGdBVUdBZ0lDQWVIRkZCVUVBQ3dSQUlBQWdBVUgvLy8vL2VIRTJBZ1FnQUVFUWFrRUZFUGtCSXdBZ0FCQUlDd3Z6QVFFR2Z5TUNJZ1VpQWlFREl3TWhBQU5BQWtBZ0F5QUFUdzBBSUFNb0FnQWlCQ2dDQkNJQlFZQ0FnSUFIY1VHQWdJQ0FBMFlFZnlBQlFmLy8vLzhBY1VFQVN3VkJBQXNFUUNBRUVBY2dBaUFFTmdJQUlBSkJCR29oQWdWQkFDQUJRZi8vLy84QWNVVWdBVUdBZ0lDQUIzRWJCRUFqQUNBRUVBZ0ZJQVFnQVVILy8vLy9CM0UyQWdRTEN5QURRUVJxSVFNTUFRc0xJQUlrQXlBRklRQURRQUpBSUFBZ0FrOE5BQ0FBS0FJQUVBb2dBRUVFYWlFQURBRUxDeUFGSVFBRFFBSkFJQUFnQWs4TkFDQUFLQUlBSWdFZ0FTZ0NCRUgvLy8vL0IzRTJBZ1FnQVJBTElBQkJCR29oQUF3QkN3c2dCU1FEQzI4QkFYOC9BQ0lDSUFGQitQLy8vd0ZKQkg5QkFVRWJJQUZuYTNSQkFXc2dBV29GSUFFTFFSQWdBQ2dDb0F3Z0FrRVFkRUVRYTBkMGFrSC8vd05xUVlDQWZIRkJFSFlpQVNBQ0lBRktHMEFBUVFCSUJFQWdBVUFBUVFCSUJFQUFDd3NnQUNBQ1FSQjBQd0JCRUhRUUF3dUhBUUVDZnlBQktBSUFJUU1nQWtFUGNRUkFRUUJCR0VIdEFrRU5FQUFBQ3lBRFFYeHhJQUpySWdSQklFOEVRQ0FCSUFOQkFuRWdBbkkyQWdBZ0FVRVFhaUFDYWlJQklBUkJFR3RCQVhJMkFnQWdBQ0FCRUFJRklBRWdBMEYrY1RZQ0FDQUJRUkJxSUFFb0FnQkJmSEZxSUFGQkVHb2dBU2dDQUVGOGNXb29BZ0JCZlhFMkFnQUxDNUVCQVFKL0l3RUVRRUVBUVJoQjVnTkJEUkFBQUFzZ0FDQUJFQVVpQXhBR0lnSkZCRUJCQVNRQkVBeEJBQ1FCSUFBZ0F4QUdJZ0pGQkVBZ0FDQURFQTBnQUNBREVBWWlBa1VFUUVFQVFSaEI4Z05CRXhBQUFBc0xDeUFDS0FJQVFYeHhJQU5KQkVCQkFFRVlRZm9EUVEwUUFBQUxJQUpCQURZQ0JDQUNJQUUyQWd3Z0FDQUNFQUVnQUNBQ0lBTVFEaUFDQ3lJQkFYOGpBQ0lDQkg4Z0FnVVFCQ01BQ3lBQUVBOGlBQ0FCTmdJSUlBQkJFR29MVVFFQmZ5QUFLQUlFSWdGQmdJQ0FnSDl4SUFGQkFXcEJnSUNBZ0g5eFJ3UkFRUUJCZ0FGQjZBQkJBaEFBQUFzZ0FDQUJRUUZxTmdJRUlBQW9BZ0JCQVhFRVFFRUFRWUFCUWVzQVFRMFFBQUFMQ3hRQUlBQkJuQUpMQkVBZ0FFRVFheEFSQ3lBQUN5Y0FJQUJCZ0FJb0FnQkxCRUJCc0FGQjZBRkJGa0ViRUFBQUN5QUFRUU4wUVlRQ2FpZ0NBQXZFREFFRGZ3TkFJQUZCQTNGQkFDQUNHd1JBSUFBaUEwRUJhaUVBSUFFaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRRnJJUUlNQVFzTElBQkJBM0ZGQkVBRFFDQUNRUkJKUlFSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FFRUlhaUFCUVFocUtBSUFOZ0lBSUFCQkRHb2dBVUVNYWlnQ0FEWUNBQ0FCUVJCcUlRRWdBRUVRYWlFQUlBSkJFR3NoQWd3QkN3c2dBa0VJY1FSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FVRUlhaUVCSUFCQkNHb2hBQXNnQWtFRWNRUkFJQUFnQVNnQ0FEWUNBQ0FCUVFScUlRRWdBRUVFYWlFQUN5QUNRUUp4QkVBZ0FDQUJMd0VBT3dFQUlBRkJBbW9oQVNBQVFRSnFJUUFMSUFKQkFYRUVRQ0FBSUFFdEFBQTZBQUFMRHdzZ0FrRWdUd1JBQWtBQ1FBSkFJQUJCQTNFaUEwRUJSd1JBSUFOQkFrWU5BU0FEUVFOR0RRSU1Bd3NnQVNnQ0FDRUZJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFOcklRSURRQ0FDUVJGSlJRUkFJQUFnQVVFQmFpZ0NBQ0lEUVFoMElBVkJHSFp5TmdJQUlBQkJCR29nQTBFWWRpQUJRUVZxS0FJQUlnTkJDSFJ5TmdJQUlBQkJDR29nQTBFWWRpQUJRUWxxS0FJQUlnTkJDSFJ5TmdJQUlBQkJER29nQVVFTmFpZ0NBQ0lGUVFoMElBTkJHSFp5TmdJQUlBRkJFR29oQVNBQVFSQnFJUUFnQWtFUWF5RUNEQUVMQ3d3Q0N5QUJLQUlBSVFVZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRSnJJUUlEUUNBQ1FSSkpSUVJBSUFBZ0FVRUNhaWdDQUNJRFFSQjBJQVZCRUhaeU5nSUFJQUJCQkdvZ0EwRVFkaUFCUVFacUtBSUFJZ05CRUhSeU5nSUFJQUJCQ0dvZ0EwRVFkaUFCUVFwcUtBSUFJZ05CRUhSeU5nSUFJQUJCREdvZ0FVRU9haWdDQUNJRlFSQjBJQU5CRUhaeU5nSUFJQUZCRUdvaEFTQUFRUkJxSVFBZ0FrRVFheUVDREFFTEN3d0JDeUFCS0FJQUlRVWdBQ0lEUVFGcUlRQWdBU0lFUVFGcUlRRWdBeUFFTFFBQU9nQUFJQUpCQVdzaEFnTkFJQUpCRTBsRkJFQWdBQ0FCUVFOcUtBSUFJZ05CR0hRZ0JVRUlkbkkyQWdBZ0FFRUVhaUFEUVFoMklBRkJCMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRUlhaUFEUVFoMklBRkJDMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRU1haUFCUVE5cUtBSUFJZ1ZCR0hRZ0EwRUlkbkkyQWdBZ0FVRVFhaUVCSUFCQkVHb2hBQ0FDUVJCcklRSU1BUXNMQ3dzZ0FrRVFjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlEUVFGcUlRQWdBVUVCYWlJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBQ3lBQ1FRaHhCRUFnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUVjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJRFFRRnFJUUFnQVVFQmFpSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUN5QUNRUUp4QkVBZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUJjUVJBSUFBZ0FTMEFBRG9BQUFzTDBnSUJBbjhDUUNBQ0lRTWdBQ0FCUmcwQVFRRWdBQ0FEYWlBQlRTQUJJQU5xSUFCTkd3UkFJQUFnQVNBREVCUU1BUXNnQUNBQlNRUkFJQUZCQjNFZ0FFRUhjVVlFUUFOQUlBQkJCM0VFUUNBRFJRMEVJQU5CQVdzaEF5QUFJZ0pCQVdvaEFDQUJJZ1JCQVdvaEFTQUNJQVF0QUFBNkFBQU1BUXNMQTBBZ0EwRUlTVVVFUUNBQUlBRXBBd0EzQXdBZ0EwRUlheUVESUFCQkNHb2hBQ0FCUVFocUlRRU1BUXNMQ3dOQUlBTUVRQ0FBSWdKQkFXb2hBQ0FCSWdSQkFXb2hBU0FDSUFRdEFBQTZBQUFnQTBFQmF5RUREQUVMQ3dVZ0FVRUhjU0FBUVFkeFJnUkFBMEFnQUNBRGFrRUhjUVJBSUFORkRRUWdBQ0FEUVFGcklnTnFJQUVnQTJvdEFBQTZBQUFNQVFzTEEwQWdBMEVJU1VVRVFDQUFJQU5CQ0dzaUEyb2dBU0FEYWlrREFEY0RBQXdCQ3dzTEEwQWdBd1JBSUFBZ0EwRUJheUlEYWlBQklBTnFMUUFBT2dBQURBRUxDd3NMQ3pnQUl3QkZCRUJCQUVFWVFkRUVRUTBRQUFBTElBQkJEM0ZGUVFBZ0FCdEZCRUJCQUVFWVFkSUVRUUlRQUFBTEl3QWdBRUVRYXhBSUMwVUJCSDhqQXlNQ0lnRnJJZ0pCQVhRaUFFR0FBaUFBUVlBQ1N4c2lBMEVBRUJBaUFDQUJJQUlRRlNBQkJFQWdBUkFXQ3lBQUpBSWdBQ0FDYWlRRElBQWdBMm9rQkFzaUFRRi9Jd01pQVNNRVR3UkFFQmNqQXlFQkN5QUJJQUEyQWdBZ0FVRUVhaVFEQzdZQkFRSi9JQUFvQWdRaUFrSC8vLy8vQUhFaEFTQUFLQUlBUVFGeEJFQkJBRUdBQVVIekFFRU5FQUFBQ3lBQlFRRkdCRUFnQUVFUWFrRUJFUGtCSUFKQmdJQ0FnSGh4QkVBZ0FFR0FnSUNBZURZQ0JBVWpBQ0FBRUFnTEJTQUJRUUJOQkVCQkFFR0FBVUg4QUVFUEVBQUFDeUFBS0FJSUVCTkJFSEVFUUNBQUlBRkJBV3NnQWtHQWdJQ0FmM0Z5TmdJRUJTQUFJQUZCQVd0QmdJQ0FnSHR5TmdJRUlBSkJnSUNBZ0hoeFJRUkFJQUFRR0FzTEN3c1NBQ0FBUVp3Q1N3UkFJQUJCRUdzUUdRc0xVd0JCOHVYTEJ5UStRYURCZ2dVa1AwSFlzT0VDSkVCQmlKQWdKRUZCOHVYTEJ5UkNRYURCZ2dVa1EwSFlzT0VDSkVSQmlKQWdKRVZCOHVYTEJ5UkdRYURCZ2dVa1IwSFlzT0VDSkVoQmlKQWdKRWtMbHdJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJESFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPREFJQ0F3TURBd1FFQlFVR0J3QUxEQWNMSTRBQ0JFQWpnUUlFUUNBQVFZQUNTQTBKSUFCQmdCSklRUUFnQUVIL0Ewb2JEUWtGUVFBZ0FFR0FBa2dqZ1FJYkRRa0xDd3NnQUVHQXJkRUFhZzhMSUFCQkFTUHlBU0lBUVFBZ0FFVWorZ0ViRzBFT2RHcEJnSzNRQUdvUEN5QUFRWUNRZm1vamdRSUVmMEhQL2dNUUhVRUJjUVZCQUF0QkRYUnFEd3NnQUNQekFVRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5T0JBZ1JBUWZEK0F4QWRRUWR4SVFFTElBRkJBVWdMQkg5QkFRVWdBUXRCREhRZ0FHcEJnUEI5YWc4TElBQkJnRkJxRHdzZ0FFR0FtZEVBYWdzSkFDQUFFQnd0QUFBTHd3RUFRUUFrZ2dKQkFDU0RBa0VBSklRQ1FRQWtoUUpCQUNTR0FrRUFKSWNDUVFBa2lBSkJBQ1NKQWtFQUpJb0NRUUFraXdKQkFDU01Ba0VBSkkwQ1FRQWtqZ0pCQUNTUEFrRUFKSkFDUVFBa2tRSWpnQUlFUUE4TEk0RUNCRUJCRVNTREFrR0FBU1NLQWtFQUpJUUNRUUFraFFKQi93RWtoZ0pCMWdBa2h3SkJBQ1NJQWtFTkpJa0NCVUVCSklNQ1FiQUJKSW9DUVFBa2hBSkJFeVNGQWtFQUpJWUNRZGdCSkljQ1FRRWtpQUpCelFBa2lRSUxRWUFDSkl3Q1FmNy9BeVNMQWdzTEFDQUFFQndnQVRvQUFBdHpBUUYvUVFBazlBRkJBU1QxQVVISEFoQWRJZ0JGSlBZQklBQkJBMHhCQUNBQVFRRk9HeVQzQVNBQVFRWk1RUUFnQUVFRlRoc2srQUVnQUVFVFRFRUFJQUJCRDA0YkpQa0JJQUJCSGt4QkFDQUFRUmxPR3lUNkFVRUJKUElCUVFBazh3RkJ6LzREUVFBUUgwSHcvZ05CQVJBZkN5OEFRZEgrQTBIL0FSQWZRZEwrQTBIL0FSQWZRZFArQTBIL0FSQWZRZFQrQTBIL0FSQWZRZFgrQTBIL0FSQWZDN0FJQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdzREJBVUdCd2dKQ2dzTURRQUxEQTBMUWZMbHl3Y2tQa0dnd1lJRkpEOUIyTERoQWlSQVFZaVFJQ1JCUWZMbHl3Y2tRa0dnd1lJRkpFTkIyTERoQWlSRVFZaVFJQ1JGUWZMbHl3Y2tSa0dnd1lJRkpFZEIyTERoQWlSSVFZaVFJQ1JKREF3TFFmLy8vd2NrUGtIajJ2NEhKRDlCZ09LUUJDUkFRUUFrUVVILy8vOEhKRUpCNDlyK0J5UkRRWURpa0FRa1JFRUFKRVZCLy8vL0J5UkdRZVBhL2dja1IwR0E0cEFFSkVoQkFDUkpEQXNMUWYvLy93Y2tQa0dFaWY0SEpEOUJ1dlRRQkNSQVFRQWtRVUgvLy84SEpFSkJzZjd2QXlSRFFZQ0lBaVJFUVFBa1JVSC8vLzhISkVaQi84dU9BeVJIUWY4QkpFaEJBQ1JKREFvTFFjWE4vd2NrUGtHRXVib0dKRDlCcWRhUkJDUkFRWWppNkFJa1FVSC8vLzhISkVKQjQ5citCeVJEUVlEaWtBUWtSRUVBSkVWQi8vLy9CeVJHUWVQYS9nY2tSMEdBNHBBRUpFaEJBQ1JKREFrTFFmLy8vd2NrUGtHQS9zc0NKRDlCZ0lUOUJ5UkFRUUFrUVVILy8vOEhKRUpCZ1A3TEFpUkRRWUNFL1Fja1JFRUFKRVZCLy8vL0J5UkdRWUQreXdJa1IwR0FoUDBISkVoQkFDUkpEQWdMUWYvLy93Y2tQa0d4L3U4REpEOUJ4Y2NCSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQmhJbitCeVJIUWJyMDBBUWtTRUVBSkVrTUJ3dEJBQ1ErUVlTSkFpUS9RWUM4L3dja1FFSC8vLzhISkVGQkFDUkNRWVNKQWlSRFFZQzgvd2NrUkVILy8vOEhKRVZCQUNSR1FZU0pBaVJIUVlDOC93Y2tTRUgvLy84SEpFa01CZ3RCcGYvL0J5UStRWlNwL2dja1AwSC9xZElFSkVCQkFDUkJRYVgvL3dja1FrR1VxZjRISkVOQi82blNCQ1JFUVFBa1JVR2wvLzhISkVaQmxLbitCeVJIUWYrcDBnUWtTRUVBSkVrTUJRdEIvLy8vQnlRK1FZRCsvd2NrUDBHQWdQd0hKRUJCQUNSQlFmLy8vd2NrUWtHQS92OEhKRU5CZ0lEOEJ5UkVRUUFrUlVILy8vOEhKRVpCZ1A3L0J5UkhRWUNBL0Fja1NFRUFKRWtNQkF0Qi8vLy9CeVErUVlEKy93Y2tQMEdBbE8wREpFQkJBQ1JCUWYvLy93Y2tRa0gveTQ0REpFTkIvd0VrUkVFQUpFVkIvLy8vQnlSR1FiSCs3d01rUjBHQWlBSWtTRUVBSkVrTUF3dEIvLy8vQnlRK1FmL0xqZ01rUDBIL0FTUkFRUUFrUVVILy8vOEhKRUpCaEluK0J5UkRRYnIwMEFRa1JFRUFKRVZCLy8vL0J5UkdRYkgrN3dNa1IwR0FpQUlrU0VFQUpFa01BZ3RCLy8vL0J5UStRZDZac2dRa1AwR01wY2tDSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUFRdEIvLy8vQnlRK1FhWExsZ1VrUDBIU3BNa0NKRUJCQUNSQlFmLy8vd2NrUWtHbHk1WUZKRU5CMHFUSkFpUkVRUUFrUlVILy8vOEhKRVpCcGN1V0JTUkhRZEtreVFJa1NFRUFKRWtMQzlvSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZZ0JSd1JBSUFCQjRRQkdEUUVnQUVFVVJnMENJQUJCeGdCR0RRTWdBRUhaQUVZTkJDQUFRY1lCUmcwRUlBQkJoZ0ZHRFFVZ0FFR29BVVlOQlNBQVFiOEJSZzBHSUFCQnpnRkdEUVlnQUVIUkFVWU5CaUFBUWZBQlJnMEdJQUJCSjBZTkJ5QUFRY2tBUmcwSElBQkIzQUJHRFFjZ0FFR3pBVVlOQnlBQVFja0JSZzBJSUFCQjhBQkdEUWtnQUVIR0FFWU5DaUFBUWRNQlJnMExEQXdMUWYrNWxnVWtQa0dBL3Y4SEpEOUJnTVlCSkVCQkFDUkJRZis1bGdVa1FrR0EvdjhISkVOQmdNWUJKRVJCQUNSRlFmKzVsZ1VrUmtHQS92OEhKRWRCZ01ZQkpFaEJBQ1JKREFzTFFmLy8vd2NrUGtIL3k0NERKRDlCL3dFa1FFRUFKRUZCLy8vL0J5UkNRWVNKL2dja1EwRzY5TkFFSkVSQkFDUkZRZi8vL3dja1JrSC95NDRESkVkQi93RWtTRUVBSkVrTUNndEIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHeC91OERKRU5CZ0lnQ0pFUkJBQ1JGUWYvLy93Y2tSa0dFaWY0SEpFZEJ1dlRRQkNSSVFRQWtTUXdKQzBILzY5WUZKRDVCbFAvL0J5US9RY0swdFFVa1FFRUFKRUZCQUNSQ1FmLy8vd2NrUTBHRWlmNEhKRVJCdXZUUUJDUkZRUUFrUmtILy8vOEhKRWRCaEluK0J5UklRYnIwMEFRa1NRd0lDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FZRG0vUWNrUTBHQWhORUVKRVJCQUNSRlFmLy8vd2NrUmtILysrb0NKRWRCZ0lEOEJ5UklRZjhCSkVrTUJ3dEJuUC8vQnlRK1FmL3IwZ1FrUDBIenFJNERKRUJCdXZRQUpFRkJ3b3IvQnlSQ1FZQ3Mvd2NrUTBHQTlOQUVKRVJCZ0lDb0FpUkZRZi8vL3dja1JrR0VpZjRISkVkQnV2VFFCQ1JJUVFBa1NRd0dDMEdBL3E4REpENUIvLy8vQnlRL1FjcWsvUWNrUUVFQUpFRkIvLy8vQnlSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUJRdEIvN21XQlNRK1FZRCsvd2NrUDBHQXhnRWtRRUVBSkVGQjBzYjlCeVJDUVlDQTJBWWtRMEdBZ0l3REpFUkJBQ1JGUWY4QkpFWkIvLy8vQnlSSFFmdisvd2NrU0VIL2lRSWtTUXdFQzBITy8vOEhKRDVCNzkrUEF5US9RYkdJOGdRa1FFSGF0T2tDSkVGQi8vLy9CeVJDUVlEbS9RY2tRMEdBaE5FRUpFUkJBQ1JGUWYvLy93Y2tSa0gveTQ0REpFZEIvd0VrU0VFQUpFa01Bd3RCLy8vL0J5UStRWVNKL2dja1AwRzY5TkFFSkVCQkFDUkJRZi8vL3dja1FrR0EvZ01rUTBHQWlNWUJKRVJCZ0pRQkpFVkIvLy8vQnlSR1FmL0xqZ01rUjBIL0FTUklRUUFrU1F3Q0MwSC8vLzhISkQ1Qi84dU9BeVEvUWY4QkpFQkJBQ1JCUVlEKy93Y2tRa0dBZ1B3SEpFTkJnSUNNQXlSRVFRQWtSVUgvLy84SEpFWkJzZjd2QXlSSFFZQ0lBaVJJUVFBa1NRd0JDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FlUGEvZ2NrUTBIajJ2NEhKRVJCQUNSRlFmLy8vd2NrUmtIL3k0NERKRWRCL3dFa1NFRUFKRWtMQzBvQkFuOUJBQkFpSTRFQ0JFQVBDeU9BQWdSQUk0RUNSUVJBRHdzTFFiUUNJUUFEUUFKQUlBQkJ3d0pLRFFBZ0FCQWRJQUZxSVFFZ0FFRUJhaUVBREFFTEN5QUJRZjhCY1JBakM5d0JBRUVBSk9zQlFRQWs3QUZCQUNUdEFVRUFKTzRCUVFBazd3RkJBQ1R3QVVFQUpQRUJRWkFCSk8wQkk0RUNCRUJCd2Y0RFFZRUJFQjlCeFA0RFFaQUJFQjlCeC80RFFmd0JFQjhGUWNIK0EwR0ZBUkFmUWNiK0EwSC9BUkFmUWNmK0EwSDhBUkFmUWNqK0EwSC9BUkFmUWNuK0EwSC9BUkFmQzBHUUFTVHRBVUhBL2dOQmtBRVFIMEhQL2dOQkFCQWZRZkQrQTBFQkVCOGpnQUlFUUNPQkFnUkFRUUFrN1FGQndQNERRUUFRSDBIQi9nTkJnQUVRSDBIRS9nTkJBQkFmQlVFQUpPMEJRY0QrQTBFQUVCOUJ3ZjREUVlRQkVCOExDeEFrQzIwQUk0RUNCRUJCNlA0RFFjQUJFQjlCNmY0RFFmOEJFQjlCNnY0RFFjRUJFQjlCNi80RFFRMFFId1ZCNlA0RFFmOEJFQjlCNmY0RFFmOEJFQjlCNnY0RFFmOEJFQjlCNi80RFFmOEJFQjhMSTRFQ1FRQWpnQUliQkVCQjZmNERRU0FRSDBIci9nTkJpZ0VRSHdzTFZnQkJrUDREUVlBQkVCOUJrZjREUWI4QkVCOUJrdjREUWZNQkVCOUJrLzREUWNFQkVCOUJsUDREUWI4QkVCOGpnQUlFUUVHUi9nTkJQeEFmUVpMK0EwRUFFQjlCay80RFFRQVFIMEdVL2dOQnVBRVFId3NMTEFCQmxmNERRZjhCRUI5Qmx2NERRVDhRSDBHWC9nTkJBQkFmUVpqK0EwRUFFQjlCbWY0RFFiZ0JFQjhMTXdCQm12NERRZjhBRUI5Qm0vNERRZjhCRUI5Qm5QNERRWjhCRUI5Qm5mNERRUUFRSDBHZS9nTkJ1QUVRSDBFQkpJWUJDeTBBUVovK0EwSC9BUkFmUWFEK0EwSC9BUkFmUWFIK0EwRUFFQjlCb3Y0RFFRQVFIMEdqL2dOQnZ3RVFId3RjQUNBQVFZQUJjVUVBUnlTdEFTQUFRY0FBY1VFQVJ5U3NBU0FBUVNCeFFRQkhKS3NCSUFCQkVIRkJBRWNrcWdFZ0FFRUljVUVBUnlTeEFTQUFRUVJ4UVFCSEpMQUJJQUJCQW5GQkFFY2tyd0VnQUVFQmNVRUFSeVN1QVF0RkFFRVBKSm9CUVE4a213RkJEeVNjQVVFUEpKMEJRUUFrbmdGQkFDU2ZBVUVBSktBQlFRQWtvUUZCL3dBa29nRkIvd0Frb3dGQkFTU2tBVUVCSktVQlFRQWtwZ0VMdlFFQVFRQWtwd0ZCQUNTb0FVRUFKS2tCUVFFa3FnRkJBU1NyQVVFQkpLd0JRUUVrclFGQkFTU3VBVUVCSks4QlFRRWtzQUZCQVNTeEFVRUJKTElCUVFBa3N3RkJBQ1MwQVVFQUpMVUJRUUFrdGdFUUp4QW9FQ2tRS2tHay9nTkI5d0FRSDBFSEpLZ0JRUWNrcVFGQnBmNERRZk1CRUI5Qjh3RVFLMEdtL2dOQjhRRVFIMEVCSkxJQkk0QUNCRUJCcFA0RFFRQVFIMEVBSktnQlFRQWtxUUZCcGY0RFFRQVFIMEVBRUN0QnB2NERRZkFBRUI5QkFDU3lBUXNRTEFzK0FDQUFRUUZ4UVFCSEpMb0JJQUJCQW5GQkFFY2t1d0VnQUVFRWNVRUFSeVM4QVNBQVFRaHhRUUJISkwwQklBQkJFSEZCQUVja3ZnRWdBQ1M1QVFzK0FDQUFRUUZ4UVFCSEpNQUJJQUJCQW5GQkFFY2t3UUVnQUVFRWNVRUFSeVRDQVNBQVFRaHhRUUJISk1NQklBQkJFSEZCQUVja3hBRWdBQ1MvQVF0NEFFRUFKTVVCUVFBa3hnRkJBQ1RIQVVFQUpNb0JRUUFreXdGQkFDVE1BVUVBSk1nQlFRQWt5UUVqZ1FJRVFFR0UvZ05CSGhBZlFhQTlKTVlCQlVHRS9nTkJxd0VRSDBITTF3SWt4Z0VMUVlmK0EwSDRBUkFmUWZnQkpNd0JJNEFDQkVBamdRSkZCRUJCaFA0RFFRQVFIMEVFSk1ZQkN3c0xRd0JCQUNUTkFVRUFKTTRCSTRFQ0JFQkJndjREUWZ3QUVCOUJBQ1RQQVVFQUpOQUJRUUFrMFFFRlFZTCtBMEgrQUJBZlFRQWt6d0ZCQVNUUUFVRUFKTkVCQ3d0MUFDT0JBZ1JBUWZEK0EwSDRBUkFmUWMvK0EwSCtBUkFmUWMzK0EwSCtBQkFmUVlEK0EwSFBBUkFmUVkvK0EwSGhBUkFmUWV6K0EwSCtBUkFmUWZYK0EwR1BBUkFmQlVIdy9nTkIvd0VRSDBIUC9nTkIvd0VRSDBITi9nTkIvd0VRSDBHQS9nTkJ6d0VRSDBHUC9nTkI0UUVRSHdzTGxnRUJBWDlCd3dJUUhTSUFRY0FCUmdSL1FRRUZJQUJCZ0FGR1FRQWpOUnNMQkVCQkFTU0JBZ1ZCQUNTQkFndEJBQ1NZQWtHQXFOYTVCeVNTQWtFQUpKTUNRUUFrbEFKQmdLald1UWNrbFFKQkFDU1dBa0VBSkpjQ0l6UUVRRUVCSklBQ0JVRUFKSUFDQ3hBZUVDQVFJUkFsRUNZUUxVRUFFQzVCLy84REk3a0JFQjlCNFFFUUwwR1AvZ01qdndFUUh4QXdFREVRTWd0S0FDQUFRUUJLSkRRZ0FVRUFTaVExSUFKQkFFb2tOaUFEUVFCS0pEY2dCRUVBU2lRNElBVkJBRW9rT1NBR1FRQktKRG9nQjBFQVNpUTdJQWhCQUVva1BDQUpRUUJLSkQwUU13c0ZBQ09ZQWd1NUFRQkJnQWdqZ3dJNkFBQkJnUWdqaEFJNkFBQkJnZ2dqaFFJNkFBQkJnd2dqaGdJNkFBQkJoQWdqaHdJNkFBQkJoUWdqaUFJNkFBQkJoZ2dqaVFJNkFBQkJod2dqaWdJNkFBQkJpQWdqaXdJN0FRQkJpZ2dqakFJN0FRQkJqQWdqalFJMkFnQkJrUWdqamdKQkFFYzZBQUJCa2dnamp3SkJBRWM2QUFCQmt3Z2prQUpCQUVjNkFBQkJsQWdqa1FKQkFFYzZBQUJCbFFnamdBSkJBRWM2QUFCQmxnZ2pnUUpCQUVjNkFBQkJsd2dqZ2dKQkFFYzZBQUFMYUFCQnlBa2o4Z0U3QVFCQnlna2o4d0U3QVFCQnpBa2o5QUZCQUVjNkFBQkJ6UWtqOVFGQkFFYzZBQUJCemdrajlnRkJBRWM2QUFCQnp3a2o5d0ZCQUVjNkFBQkIwQWtqK0FGQkFFYzZBQUJCMFFraitRRkJBRWM2QUFCQjBna2orZ0ZCQUVjNkFBQUxOUUJCK2dranhRRTJBZ0JCL2dranhnRTJBZ0JCZ2dvanlBRkJBRWM2QUFCQmhRb2p5UUZCQUVjNkFBQkJoZjRESThjQkVCOExZd0JCM2dvaldFRUFSem9BQUVIZkNpTmJOZ0lBUWVNS0kxdzJBZ0JCNXdvalhqWUNBRUhzQ2lOZk5nSUFRZkVLSTJBNkFBQkI4Z29qWVRvQUFFSDNDaU5pUVFCSE9nQUFRZmdLSTJNMkFnQkIvUW9qWkRzQkFFSC9DaU5kUVFCSE9nQUFDMGdBUVpBTEkyOUJBRWM2QUFCQmtRc2pjallDQUVHVkN5TnpOZ0lBUVprTEkzVTJBZ0JCbmdzamRqWUNBRUdqQ3lOM09nQUFRYVFMSTNnNkFBQkJwUXNqZEVFQVJ6b0FBQXRIQUVIMEN5T1JBVUVBUnpvQUFFSDFDeU9UQVRZQ0FFSDVDeU9VQVRZQ0FFSDlDeU9XQVRZQ0FFR0NEQ09YQVRZQ0FFR0hEQ09aQVRzQkFFR0pEQ09WQVVFQVJ6b0FBQXVIQVFBUU5rR3lDQ1BzQVRZQ0FFRzJDQ1BoQVRvQUFFSEUvZ01qN1FFUUgwSGtDQ08zQVVFQVJ6b0FBRUhsQ0NPNEFVRUFSem9BQUJBM0VEaEJyQW9qc3dFMkFnQkJzQW9qdEFFNkFBQkJzUW9qdFFFNkFBQVFPUkE2UWNJTEkzOUJBRWM2QUFCQnd3c2pnZ0UyQWdCQnh3c2pnd0UyQWdCQnl3c2poQUU3QVFBUU8wRUFKSmdDQzdrQkFFR0FDQzBBQUNTREFrR0JDQzBBQUNTRUFrR0NDQzBBQUNTRkFrR0RDQzBBQUNTR0FrR0VDQzBBQUNTSEFrR0ZDQzBBQUNTSUFrR0dDQzBBQUNTSkFrR0hDQzBBQUNTS0FrR0lDQzhCQUNTTEFrR0tDQzhCQUNTTUFrR01DQ2dDQUNTTkFrR1JDQzBBQUVFQVNpU09Ba0dTQ0MwQUFFRUFTaVNQQWtHVENDMEFBRUVBU2lTUUFrR1VDQzBBQUVFQVNpU1JBa0dWQ0MwQUFFRUFTaVNBQWtHV0NDMEFBRUVBU2lTQkFrR1hDQzBBQUVFQVNpU0NBZ3RlQVFGL1FRQWs3QUZCQUNUdEFVSEUvZ05CQUJBZlFjSCtBeEFkUVh4eElRRkJBQ1RoQVVIQi9nTWdBUkFmSUFBRVFBSkFRUUFoQUFOQUlBQkJnTmdGVGcwQklBQkJnTWtGYWtIL0FUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEM0SUJBUUYvSStNQklRRWdBRUdBQVhGQkFFY2s0d0VnQUVIQUFIRkJBRWNrNUFFZ0FFRWdjVUVBUnlUbEFTQUFRUkJ4UVFCSEpPWUJJQUJCQ0hGQkFFY2s1d0VnQUVFRWNVRUFSeVRvQVNBQVFRSnhRUUJISk9rQklBQkJBWEZCQUVjazZnRWo0d0ZGUVFBZ0FSc0VRRUVCRUQ0TFFRQWo0d0VnQVJzRVFFRUFFRDRMQ3lvQVFlUUlMUUFBUVFCS0pMY0JRZVVJTFFBQVFRQktKTGdCUWYvL0F4QWRFQzVCai80REVCMFFMd3RvQUVISUNTOEJBQ1R5QVVIS0NTOEJBQ1R6QVVITUNTMEFBRUVBU2lUMEFVSE5DUzBBQUVFQVNpVDFBVUhPQ1MwQUFFRUFTaVQyQVVIUENTMEFBRUVBU2lUM0FVSFFDUzBBQUVFQVNpVDRBVUhSQ1MwQUFFRUFTaVQ1QVVIU0NTMEFBRUVBU2lUNkFRdEhBRUg2Q1NnQ0FDVEZBVUgrQ1NnQ0FDVEdBVUdDQ2kwQUFFRUFTaVRJQVVHRkNpMEFBRUVBU2lUSkFVR0YvZ01RSFNUSEFVR0cvZ01RSFNUS0FVR0gvZ01RSFNUTUFRc0hBRUVBSkxZQkMyTUFRZDRLTFFBQVFRQktKRmhCM3dvb0FnQWtXMEhqQ2lnQ0FDUmNRZWNLS0FJQUpGNUI3QW9vQWdBa1gwSHhDaTBBQUNSZ1FmSUtMUUFBSkdGQjl3b3RBQUJCQUVva1lrSDRDaWdDQUNSalFmMEtMd0VBSkdSQi93b3RBQUJCQUVva1hRdElBRUdRQ3kwQUFFRUFTaVJ2UVpFTEtBSUFKSEpCbFFzb0FnQWtjMEdaQ3lnQ0FDUjFRWjRMS0FJQUpIWkJvd3N0QUFBa2QwR2tDeTBBQUNSNFFiRUxMUUFBUVFCS0pIUUxSd0JCOUFzdEFBQkJBRW9ra1FGQjlRc29BZ0Fra3dGQitRc29BZ0FrbEFGQi9Rc29BZ0FrbGdGQmdnd29BZ0FrbHdGQmh3d3ZBUUFrbVFGQmlRd3RBQUJCQUVva2xRRUx6QUVCQVg4UVBVR3lDQ2dDQUNUc0FVRzJDQzBBQUNUaEFVSEUvZ01RSFNUdEFVSEEvZ01RSFJBL0VFQkJnUDRERUIxQi93RnpKTm9CSTlvQklnQkJFSEZCQUVjazJ3RWdBRUVnY1VFQVJ5VGNBUkJCRUVKQnJBb29BZ0Frc3dGQnNBb3RBQUFrdEFGQnNRb3RBQUFrdFFGQkFDUzJBUkJFRUVWQndnc3RBQUJCQUVva2YwSERDeWdDQUNTQ0FVSEhDeWdDQUNTREFVSExDeThCQUNTRUFSQkdRUUFrbUFKQmdLald1UWNra2dKQkFDU1RBa0VBSkpRQ1FZQ28xcmtISkpVQ1FRQWtsZ0pCQUNTWEFnc0ZBQ09CQWdzRkFDT1ZBZ3NGQUNPV0Fnc0ZBQ09YQWd1eUFnRUdmeU5MSWdVZ0FFWkJBQ05LSUFSR1FRQWdBRUVJU2tFQUlBRkJBRW9iR3hzRVFDQURRUUZyRUIxQklIRkJBRWNoQ0NBREVCMUJJSEZCQUVjaENVRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQWdnQ1VjYklnY2dBR29pQTBHZ0FVd0VRQ0FCUWFBQmJDQURha0VEYkVHQXlRVnFJZ1F0QUFBaENpQUVJQW82QUFBZ0FVR2dBV3dnQTJwQkEyeEJnY2tGYWlBRUxRQUJPZ0FBSUFGQm9BRnNJQU5xUVFOc1FZTEpCV29nQkMwQUFqb0FBQ0FCUWFBQmJDQURha0dBa1FScUlBQkJBQ0FIYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQTBFRGNTSUVRUVJ5SUFRZ0EwRUVjUnM2QUFBZ0JrRUJhaUVHQ3lBSFFRRnFJUU1NQVFzTEJTQUVKRW9MSUFBZ0JVNEVRQ0FBUVFocUlnRWdBa0VIY1NJQ2FpQUJJQUFnQWtnYklRVUxJQVVrU3lBR0N5a0FJQUJCZ0pBQ1JnUkFJQUZCZ0FGcklBRkJnQUZxSUFGQmdBRnhHeUVCQ3lBQlFRUjBJQUJxQzBvQUlBQkJBM1FnQVVFQmRHb2lBRUVCYWtFL2NTSUJRVUJySUFFZ0FodEJnSkFFYWkwQUFDRUJJQUJCUDNFaUFFRkFheUFBSUFJYlFZQ1FCR290QUFBZ0FVSC9BWEZCQ0hSeUM4Z0JBQ0FCRUIwZ0FFRUJkSFZCQTNFaEFDQUJRY2orQTBZRVFDTkNJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalF5RUJEQUlMSTBRaEFRd0JDeU5GSVFFTEJTQUJRY24rQTBZRVFDTkdJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalJ5RUJEQUlMSTBnaEFRd0JDeU5KSVFFTEJTTStJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalB5RUJEQUlMSTBBaEFRd0JDeU5CSVFFTEN3c2dBUXVNQXdFR2Z5QUJJQUFRVFNBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnNGdDRWdFUUVFQUlRVUNmMEVCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUJkQ0FTY1FSQVFRSWhCUXNnQlVFQmFnc2dCVUVCSUFGMElCRnhHeUVDSTRFQ0JIOUJBU0FNUVFCT0lBdEJBRTRiQlVFQUN3Ui9JQXRCQjNFaEFTQU1RUUJPSWdVRVFDQU1RUWR4SVFFTElBRWdBaUFGRUU0aUJVRWZjVUVEZENFQklBVkI0QWR4UVFWMVFRTjBJUThnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdvUVR5SUZRWUNBL0FkeFFSQjFJUUVnQlVHQS9nTnhRUWgxSVE4Z0JVSC9BWEVMSVFVZ0J5QUliQ0FPYWtFRGJDQUphaUlRSUFFNkFBQWdFRUVCYWlBUE9nQUFJQkJCQW1vZ0JUb0FBQ0FIUWFBQmJDQU9ha0dBa1FScUlBSkJBM0VpQVVFRWNpQUJJQXRCZ0FGeFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzM0QkEzOGdBMEVIY1NFRFFRQWdBaUFDUVFOMVFRTjBheUFBR3lFSFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRaEJmeUVDSTRFQ0JFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hGQkFFY2hDU0FDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRVUF1aEFnRUJmeUFEUVFkeElRTWdCU0FHRUUwZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ1ZCZ0pCK2FpQUVRUWh4UVFCSElnWkJEWFJxTFFBQUlRY2dBa0VIY1NFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2Z5QUZRWUdRZm1vZ0JrRUJjVUVOZEdvdEFBQkJBU0FEUVFjZ0Eyc2dCRUVnY1JzaUEzUnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQjNFYklnTkJBQkJPSWdKQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQUpCZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRWlBRUVFY2lBQUlBUkJnQUZ4R3pvQUFBdkVBUUFnQkNBRkVFMGdBMEVIY1VFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURKQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0F4QlBJZ0pCZ0lEOEIzRkJFSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FZRCtBM0ZCQ0hVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBMEVEY1RvQUFBdlVBUUVHZnlBRFFRTjFJUW9EUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUtRUVYwSUFKcUlBWkJBM1ZxSWdoQmdKQithaTBBQUNFSFFRQWhDU004QkVBZ0JDQUFJQVlnQ0NBSEVFd2lDMEVBU2dSQVFRRWhDU0FMUVFGcklBUnFJUVFMQ3lBSlJVRUFJenNiQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJSSWdaQkFFb0VRQ0FHUVFGcklBUnFJUVFMQlNBSlJRUkFJNEVDQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJTQlNBRUlBQWdCaUFESUFFZ0J4QlRDd3NMSUFSQkFXb2hCQXdCQ3dzTE1nRURmeVB3QVNFRElBQWo4UUVpQkVnRVFBOExRUUFnQTBFSGF5SURheUVGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRlFMb0FVQkQzOENRRUVuSVFZRFFDQUdRUUJJRFFFZ0JrRUNkQ0lGUVlEOEEyb2lBeEFkSVFJZ0EwRUJhaEFkSVFjZ0EwRUNhaEFkSVFNZ0FrRVFheUVFSUFkQkNHc2hDMEVJSVFJZ0FRUkFRUkFoQWlBRElBTkJBWEZySVFNTElBQWdBaUFFYWtoQkFDQUFJQVJPR3dSQUlBVkJnL3dEYWhBZElnVkJnQUZ4UVFCSElRd2dCVUVnY1VFQVJ5RU5RWUNBQWlBREVFMGdBaUFBSUFScklnTnJRUUZySUFNZ0JVSEFBSEViUVFGMGFpSURRWUNRZm1vZ0JVRUljVUVBUnlPQkFpSUNJQUliUVFGeFFRMTBJZ0pxTFFBQUlRNGdBMEdCa0g1cUlBSnFMUUFBSVE5QkJ5RURBMEFnQTBFQVRnUkFRUUFoQWdKL1FRRkJBQ0FEUVFkcmF5QURJQTBiSWdSMElBOXhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdCSFFnRG5FYklnUUVRRUVISUFOcklBdHFJZ0pCQUU0RWZ5QUNRYUFCVEFWQkFBc0VRRUVBSVFkQkFDRUtJK29CUlNPQkFpSUlJQWdiSWdoRkJFQWdBRUdnQVd3Z0FtcEJnSkVFYWkwQUFDSUpJUkFnQ1VFRGNTSUpRUUJMUVFBZ0RCc0VRRUVCSVFjRlFRRkJBQ0FKUVFCTFFRQWdFRUVFY1VFQUk0RUNHeHNiSVFvTEMwRUJRUUFnQ2tVZ0J4c2dDQnNFUUNPQkFnUkFJQUJCb0FGc0lBSnFRUU5zUVlESkJXb2dCVUVIY1NBRVFRRVFUaUlFUVI5eFFRTjBPZ0FBSUFCQm9BRnNJQUpxUVFOc1FZSEpCV29nQkVIZ0IzRkJCWFZCQTNRNkFBQWdBRUdnQVd3Z0FtcEJBMnhCZ3NrRmFpQUVRWUQ0QVhGQkNuVkJBM1E2QUFBRklBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JFSEovZ05CeVA0RElBVkJFSEViRUU4aUJFR0FnUHdIY1VFUWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQnlRVnFJQVJCZ1A0RGNVRUlkVG9BQUNBQVFhQUJiQ0FDYWtFRGJFR0N5UVZxSUFRNkFBQUxDd3NMSUFOQkFXc2hBd3dCQ3dzTElBWkJBV3NoQmd3QUFBc0FDd3RrQVFGL1FZQ0FBa0dBa0FJajVnRWJJUUZCQVNQcUFTT0JBaHNFUUNBQUlBRkJnTGdDUVlDd0FpUG5BUnNqN3dFZ0FHcEIvd0Z4UVFBajdnRVFWQXNqNVFFRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBrQVJzUVZRc2o2UUVFUUNBQUkrZ0JFRllMQ3lVQkFYOENRQU5BSUFCQmtBRktEUUVnQUVIL0FYRVFWeUFBUVFGcUlRQU1BQUFMQUFzTFJnRUNmd05BSUFGQmtBRk9SUVJBUVFBaEFBTkFJQUJCb0FGSUJFQWdBVUdnQVd3Z0FHcEJnSkVFYWtFQU9nQUFJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUVMQ3dzYkFFR1AvZ01RSFVFQklBQjBjaUlBSkw4QlFZLytBeUFBRUI4TEN3QkJBU1RCQVVFQkVGb0xMZ0VCZndKL0kzVWlBRUVBU2dSL0kyMEZRUUFMQkVBZ0FFRUJheUVBQ3lBQVJRc0VRRUVBSkc4TElBQWtkUXN3QVFGL0FuOGpnd0VpQUVFQVNnUi9JMzBGUVFBTEJFQWdBRUVCYXlFQUN5QUFSUXNFUUVFQUpIOExJQUFrZ3dFTE1nRUJmd0ovSTVZQklnQkJBRW9FZnlPUUFRVkJBQXNFUUNBQVFRRnJJUUFMSUFCRkN3UkFRUUFra1FFTElBQWtsZ0VMUndFQ2Z5QUFKR1JCbFA0REVCMUIrQUZ4SVFGQmsvNERJQUJCL3dGeElnSVFIMEdVL2dNZ0FTQUFRUWgxUVFkeElnQnlFQjhnQWlSVklBQWtWeU5WSTFkQkNIUnlKRm9Mb2dFQkFuOGpZa1ZCQVNOWUd3UkFEd3NqWTBFQmF5SUFRUUJNQkVBalRRUkFJMDBrWXdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDeUlBUWY4UFNnMEFHa0VBQ3dSQVFRQWtXQXNqVDBFQVNnUkFJQUFRWHdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDMEgvRDBvTkFCcEJBQXNFUUVFQUpGZ0xDd1ZCQ0NSakN3VWdBQ1JqQ3d0VEFRSi9JMXhCQVdzaUFVRUFUQVJBSTFRRVFDTlVJZ0VFZnlOZEJVRUFDd1JBSTE4aEFDQUFRUUZxSUFCQkFXc2pVeHRCRDNFaUFFRVBTQVJBSUFBa1h3VkJBQ1JkQ3dzRlFRZ2hBUXNMSUFFa1hBdFRBUUovSTNOQkFXc2lBVUVBVEFSQUkyc0VRQ05ySWdFRWZ5TjBCVUVBQ3dSQUkzWWhBQ0FBUVFGcUlBQkJBV3NqYWh0QkQzRWlBRUVQU0FSQUlBQWtkZ1ZCQUNSMEN3c0ZRUWdoQVFzTElBRWtjd3RjQVFKL0k1UUJRUUZySWdGQkFFd0VRQ09NQVFSQUk0d0JJZ0VFZnlPVkFRVkJBQXNFUUNPWEFTRUFJQUJCQVdvZ0FFRUJheU9MQVJ0QkQzRWlBRUVQU0FSQUlBQWtsd0VGUVFBa2xRRUxDd1ZCQ0NFQkN3c2dBU1NVQVF1cEFnRUNmMEdBd0FBamdnSjBJZ0VoQWlPekFTQUFhaUlBSUFGT0JFQWdBQ0FDYXlTekFRSkFBa0FDUUFKQUFrQWp0UUZCQVdwQkIzRWlBQVJBSUFCQkFrWU5BUUpBSUFCQkJHc09CQU1BQkFVQUN3d0ZDeU5lSWdGQkFFb0VmeU5XQlVFQUN3UkFJQUZCQVdzaUFVVUVRRUVBSkZnTEN5QUJKRjRRWEJCZEVGNE1CQXNqWGlJQlFRQktCSDhqVmdWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSWUN3c2dBU1JlRUZ3UVhSQmVFR0FNQXdzalhpSUJRUUJLQkg4alZnVkJBQXNFUUNBQlFRRnJJZ0ZGQkVCQkFDUllDd3NnQVNSZUVGd1FYUkJlREFJTEkxNGlBVUVBU2dSL0kxWUZRUUFMQkVBZ0FVRUJheUlCUlFSQVFRQWtXQXNMSUFFa1hoQmNFRjBRWGhCZ0RBRUxFR0VRWWhCakN5QUFKTFVCUVFFUEJTQUFKTE1CQzBFQUMzUUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQUNRQ0FBUVFKckRnTUNBd1FBQ3d3RUN5TlpJZ0FqbmdGSElRRWdBQ1NlQVNBQkR3c2pjQ0lBSTU4QlJ5RUJJQUFrbndFZ0FROExJNEFCSWdBam9BRkhJUUVnQUNTZ0FTQUJEd3Nqa2dFaUFDT2hBVWNoQVNBQUpLRUJJQUVQQzBFQUMxVUFBa0FDUUFKQUlBQkJBVWNFUUNBQVFRSkdEUUVnQUVFRFJnMENEQU1MUVFFZ0FYUkJnUUZ4UVFCSER3dEJBU0FCZEVHSEFYRkJBRWNQQzBFQklBRjBRZjRBY1VFQVJ3OExRUUVnQVhSQkFYRkJBRWNMY3dFQmZ5TmJJQUJySVFBRFFDQUFRUUJNQkVCQmdCQWpXbXRCQW5RaUFVRUNkQ0FCSTRJQ0d5UmJJMXNnQUVFZmRTSUJJQUFnQVdwemF5RUFJMkZCQVdwQkIzRWtZUXdCQ3dzZ0FDUmJJMWxCQUNOWUd3Ui9JMTlCRDNFRlFROFBDeU5RSTJFUVpnUi9RUUVGUVg4TGJFRVBhZ3RzQVFGL0kzSWdBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTnhhMEVDZENPQ0FuUWtjaU55SUFCQkgzVWlBU0FBSUFGcWMyc2hBQ040UVFGcVFRZHhKSGdNQVFzTElBQWtjaU53UVFBamJ4c0VmeU4yUVE5eEJVRVBEd3NqWnlONEVHWUVmMEVCQlVGL0MyeEJEMm9MRHdBamhBRkJBWFZCc1A0RGFoQWRDeXNCQVg4amhBRkJBV29oQUFOQUlBQkJJRWhGQkVBZ0FFRWdheUVBREFFTEN5QUFKSVFCRUdra2h3RUw1Z0VCQTM4amdBRkZRUUVqZnhzRVFFRVBEd3NqaFFFaEFpT0dBUVJBUVp6K0F4QWRRUVYxUVE5eElnSWtoUUZCQUNTR0FRc2pod0VqaEFGQkFYRkZRUUowZFVFUGNTRUJBa0FDUUFKQUFrQWdBZ1JBSUFKQkFVWU5BU0FDUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEF3d0NDeUFCUVFGMUlRRkJBaUVEREFFTElBRkJBblVoQVVFRUlRTUxJQU5CQUVvRWZ5QUJJQU50QlVFQUMwRVBhaUVCSTRJQklBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBamdRRnJRUUYwSTRJQ2RDU0NBU09DQVNBQVFSOTFJZ0lnQUNBQ2FuTnJJUUFRYWd3QkN3c2dBQ1NDQVNBQkM0OEJBUUovSTVNQklBQnJJZ0JCQUV3RVFDT1lBU09OQVhRamdnSjBJQUJCSDNVaUFTQUFJQUZxYzJzaEFDT1pBU0lCUVFGMUlnSWdBVUVCY1NBQ1FRRnhjeUlCUVE1MGNpSUNRYjkvY1NBQlFRWjBjaUFDSTQ0Qkd5U1pBUXRCQUNBQUlBQkJBRWdiSkpNQkk1SUJRUUFqa1FFYkJIOGpsd0ZCRDNFRlFROFBDMEYvUVFFam1RRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMbHdFQkFYOUJBQ1NrQVNBQVFROGpxZ0ViSUFGQkR5T3JBUnRxSUFKQkR5T3NBUnRxSUFOQkR5T3RBUnRxSVFRZ0FFRVBJNjRCR3lBQlFROGpyd0ViYWlFQUlBQWdBa0VQSTdBQkcyb2hBU0FEUVE4anNRRWJJUU5CQUNTbEFVRUFKS1lCSUFRanFBRkJBV29RYlNFQUlBRWdBMm9qcVFGQkFXb1FiU0VCSUFBa29nRWdBU1NqQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElML3dJQkJYOGpUQ0FBYWlJQ0pFd2pXeUFDYTBFQVRDSUNSUVJBUVFFUVpTRUNDeU5tSUFCcUlnRWtaaU55SUFGclFRQk1JZ0ZGQkVCQkFoQmxJUUVMSTNrZ0FHb2tlVUVBSTRJQkkzbHJRUUJLSTRZQkcwVWlCRVVFUUVFREVHVWhCQXNqaUFFZ0FHb2tpQUVqa3dFamlBRnJRUUJNSWdWRkJFQkJCQkJsSVFVTElBSUVRQ05NSVFOQkFDUk1JQU1RWnlTYUFRc2dBUVJBSTJZaEEwRUFKR1lnQXhCb0pKc0JDeUFFQkVBamVTRURRUUFrZVNBREVHc2tuQUVMSUFVRVFDT0lBU0VEUVFBa2lBRWdBeEJzSkowQkMwRUJJQVZCQVNBRVFRRWdBU0FDR3hzYkJFQkJBU1NtQVF0QmdJQ0FBaU9DQW5SQnhOZ0NiU0lDSVFFanRBRWdBR29pQUNBQ1RnUkFJQUFnQVdzaEFFRUJJNlVCUVFFanBBRWpwZ0ViR3dSQUk1b0JJNXNCSTV3Qkk1MEJFRzRhQlNBQUpMUUJDeU8yQVNJQ1FRRjBRWUNad1FCcUlnRWpvZ0ZCQW1vNkFBQWdBVUVCYWlPakFVRUNham9BQUNBQ1FRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDNlVEQVFaL0lBQVFaeUVCSUFBUWFDRUNJQUFRYXlFRUlBQVFiQ0VGSUFFa21nRWdBaVNiQVNBRUpKd0JJQVVrblFFanRBRWdBR29pQUVHQWdJQUNJNElDZEVIRTJBSnRUZ1JBSUFCQmdJQ0FBaU9DQW5SQnhOZ0NiV3NoQUNBQklBSWdCQ0FGRUc0aEF5TzJBVUVCZEVHQW1jRUFhaUlHSUFOQmdQNERjVUVJZFVFQ2Fqb0FBQ0FHUVFGcUlBTkIvd0Z4UVFKcU9nQUFJejBFUUNBQlFROUJEMEVQRUc0aEFTTzJBVUVCZEVHQW1TRnFJZ01nQVVHQS9nTnhRUWgxUVFKcU9nQUFJQU5CQVdvZ0FVSC9BWEZCQW1vNkFBQkJEeUFDUVE5QkR4QnVJUUVqdGdGQkFYUkJnSmtwYWlJQ0lBRkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUZCL3dGeFFRSnFPZ0FBUVE5QkR5QUVRUThRYmlFQkk3WUJRUUYwUVlDWk1Xb2lBaUFCUVlEK0EzRkJDSFZCQW1vNkFBQWdBa0VCYWlBQlFmOEJjVUVDYWpvQUFFRVBRUTlCRHlBRkVHNGhBU08yQVVFQmRFR0FtVGxxSWdJZ0FVR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBVUgvQVhGQkFtbzZBQUFMSTdZQlFRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDeDRCQVg4Z0FCQmtJUUVnQVVWQkFDTTZHd1JBSUFBUWJ3VWdBQkJ3Q3dzdkFRSi9RZGNBSTRJQ2RDRUJJNmNCSVFBRFFDQUFJQUZPQkVBZ0FSQnhJQUFnQVdzaEFBd0JDd3NnQUNTbkFRdWtBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQmxmNERSZzBCQWtBZ0FFR1IvZ05yRGhZR0N4QVVBQWNNRVJVRENBMFNGZ1FKRGhNWEJRb1BBQXNNRnd0QmtQNERFQjFCZ0FGeUR3dEJsZjRERUIxQi93RnlEd3RCbXY0REVCMUIvd0J5RHd0Qm4vNERFQjFCL3dGeUR3dEJwUDRERUIwUEMwR1IvZ01RSFVFL2NnOExRWmIrQXhBZFFUOXlEd3RCbS80REVCMUIvd0Z5RHd0Qm9QNERFQjFCL3dGeUR3dEJwZjRERUIwUEMwR1MvZ01RSFE4TFFaZitBeEFkRHd0Qm5QNERFQjFCbndGeUR3dEJvZjRERUIwUEMwR0FBVUVBSTdJQkd5RUFJQUJCQVhJZ0FFRitjU05ZR3lFQUlBQkJBbklnQUVGOWNTTnZHeUVBSUFCQkJISWdBRUY3Y1NOL0d5RUFJQUJCQ0hJZ0FFRjNjU09SQVJ0QjhBQnlEd3RCay80REVCMUIvd0Z5RHd0Qm1QNERFQjFCL3dGeUR3dEJuZjRERUIxQi93RnlEd3RCb3Y0REVCMFBDMEdVL2dNUUhVRy9BWElQQzBHWi9nTVFIVUcvQVhJUEMwR2UvZ01RSFVHL0FYSVBDMEdqL2dNUUhVRy9BWElQQzBGL0M1d0JBUUYvSTlvQklRQWoyd0VFUUNBQVFYdHhJQUJCQkhJajBnRWJJUUFnQUVGK2NTQUFRUUZ5STlVQkd5RUFJQUJCZDNFZ0FFRUljaVBUQVJzaEFDQUFRWDF4SUFCQkFuSWoxQUViSVFBRkk5d0JCRUFnQUVGK2NTQUFRUUZ5STlZQkd5RUFJQUJCZlhFZ0FFRUNjaVBYQVJzaEFDQUFRWHR4SUFCQkJISWoyQUViSVFBZ0FFRjNjU0FBUVFoeUk5a0JHeUVBQ3dzZ0FFSHdBWElMMUFJQUlBQkJnSUFDU0FSQVFYOFBDeUFBUVlEQUFraEJBQ0FBUVlDQUFrNGJCRUJCZnc4TElBQkJnUHdEU0VFQUlBQkJnTUFEVGhzRVFDQUFRWUJBYWhBZER3c2dBRUdmL1FOTVFRQWdBRUdBL0FOT0d3UkFRZjhCUVg4ajRRRkJBa2diRHdzZ0FFSE4vZ05HQkVCQi93RWhBRUhOL2dNUUhVRUJjVVVFUUVIK0FTRUFDeU9DQWtVRVFDQUFRZjkrY1NFQUN5QUFEd3NnQUVIRS9nTkdCRUFnQUNQdEFSQWZJKzBCRHdzZ0FFR20vZ05NUVFBZ0FFR1EvZ05PR3dSQUVISWdBQkJ6RHdzZ0FFR3YvZ05NUVFBZ0FFR24vZ05PR3dSQVFmOEJEd3NnQUVHLy9nTk1RUUFnQUVHdy9nTk9Hd1JBRUhJamZ3UkFFR2tQQzBGL0R3c2dBRUdFL2dOR0JFQWdBQ1BHQVVHQS9nTnhRUWgxSWdBUUh5QUFEd3NnQUVHRi9nTkdCRUFnQUNQSEFSQWZJOGNCRHdzZ0FFR1AvZ05HQkVBanZ3RkI0QUZ5RHdzZ0FFR0EvZ05HQkVBUWRBOExRWDhMS1FFQmZ5UGVBU0FBUmdSQVFRRWs0QUVMSUFBUWRTSUJRWDlHQkg4Z0FCQWRCU0FCUWY4QmNRc0xwQUlCQTM4ajlnRUVRQThMSS9jQklRTWorQUVoQWlBQVFmOC9UQVJBSUFJRWZ5QUJRUkJ4UlFWQkFBdEZCRUFnQVVFUGNTSUFCRUFnQUVFS1JnUkFRUUVrOUFFTEJVRUFKUFFCQ3dzRklBQkIvLzhBVEFSQUkvb0JJZ1FFZnlBQVFmL2ZBRXdGUVFFTEJFQWdBVUVQY1NQeUFTQUNHeUVBSUFNRWZ5QUJRUjl4SVFFZ0FFSGdBWEVGSS9rQkJIOGdBVUgvQUhFaEFTQUFRWUFCY1FWQkFDQUFJQVFiQ3dzaEFDQUFJQUZ5SlBJQkJTUHlBVUgvQVhFZ0FVRUFTa0VJZEhJazhnRUxCVUVBSUFCQi83OEJUQ0FDR3dSQUkvVUJRUUFnQXhzRVFDUHlBVUVmY1NBQlFlQUJjWElrOGdFUEN5QUJRUTl4SUFGQkEzRWorZ0ViSlBNQkJVRUFJQUJCLy84QlRDQUNHd1JBSUFNRVFDQUJRUUZ4UVFCSEpQVUJDd3NMQ3dzTE9BRUJmeU5PSVFFZ0FFSHdBSEZCQkhVa1RTQUFRUWh4UVFCSEpFNGdBRUVIY1NSUEkyVkJBQ05PUlVFQUlBRWJHd1JBUVFBa1dBc0xaUUFqV0FSQVFRQWpYU05VR3dSQUkxOUJBV3BCRDNFa1h3c2pVeUFBUVFoeFFRQkhSd1JBUVJBalgydEJEM0VrWHdzTElBQkJCSFZCRDNFa1VpQUFRUWh4UVFCSEpGTWdBRUVIY1NSVUlBQkIrQUZ4UVFCS0lnQWtXU0FBUlFSQVFRQWtXQXNMWlFBamJ3UkFRUUFqZENOckd3UkFJM1pCQVdwQkQzRWtkZ3NqYWlBQVFRaHhRUUJIUndSQVFSQWpkbXRCRDNFa2Rnc0xJQUJCQkhWQkQzRWthU0FBUVFoeFFRQkhKR29nQUVFSGNTUnJJQUJCK0FGeFFRQktJZ0FrY0NBQVJRUkFJQUFrYndzTGNnQWprUUVFUUVFQUk1VUJJNHdCR3dSQUk1Y0JRUUZxUVE5eEpKY0JDeU9MQVNBQVFRaHhRUUJIUndSQVFSQWpsd0ZyUVE5eEpKY0JDd3NnQUVFRWRVRVBjU1NLQVNBQVFRaHhRUUJISklzQklBQkJCM0VrakFFZ0FFSDRBWEZCQUVvaUFDU1NBU0FBUlFSQUlBQWtrUUVMQ3pnQUlBQkJCSFVralFFZ0FFRUljVUVBUnlTT0FTQUFRUWR4SWdBa2p3RWdBRUVCZENJQVFRRklCRUJCQVNFQUN5QUFRUU4wSkpnQkM2b0JBUUovUVFFa1dDTmVSUVJBUWNBQUpGNExRWUFRSTFwclFRSjBJZ0JCQW5RZ0FDT0NBaHNrV3lOVUJFQWpWQ1JjQlVFSUpGd0xRUUVrWFNOU0pGOGpXaVJrSTAwRVFDTk5KR01GUVFna1l3dEJBU05QUVFCS0lnQWpUVUVBU2hza1lrRUFKR1VnQUFSL0FuOGpaQ0lBSTA5MUlRRkJBU05PQkg5QkFTUmxJQUFnQVdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dWQkFBc0VRRUVBSkZnTEkxbEZCRUJCQUNSWUN3dVNBUUVDZnlBQVFRZHhJZ0VrVnlOVklBRkJDSFJ5SkZvanRRRkJBWEZCQVVZaEFpTldSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2dBa1VFUUVFQUlBRWpYa0VBVEJzRVFDTmVRUUZySkY1QkFDTmVSU0FBUVlBQmNSc0VRRUVBSkZnTEN3c2dBRUhBQUhGQkFFY2tWaUFBUVlBQmNRUkFFSDBqVmtFQVFRQWpYa0hBQUVZZ0Foc2JCRUFqWGtFQmF5UmVDd3NMUUFCQkFTUnZJM1ZGQkVCQndBQWtkUXRCZ0JBamNXdEJBblFqZ2dKMEpISWphd1JBSTJza2N3VkJDQ1J6QzBFQkpIUWphU1IySTNCRkJFQkJBQ1J2Q3d1U0FRRUNmeUFBUVFkeElnRWtiaU5zSUFGQkNIUnlKSEVqdFFGQkFYRkJBVVloQWlOdFJTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFamRVRUFUQnNFUUNOMVFRRnJKSFZCQUNOMVJTQUFRWUFCY1JzRVFFRUFKRzhMQ3dzZ0FFSEFBSEZCQUVja2JTQUFRWUFCY1FSQUVIOGpiVUVBUVFBamRVSEFBRVlnQWhzYkJFQWpkVUVCYXlSMUN3c0xQUUJCQVNSL0k0TUJSUVJBUVlBQ0pJTUJDMEdBRUNPQkFXdEJBWFFqZ2dKMEpJSUJJNElCUVFacUpJSUJRUUFraEFFamdBRkZCRUJCQUNSL0N3dVBBUUVCZnlBQVFRZHhJZ0VrZmlOOElBRkJDSFJ5SklFQkk3VUJRUUZ4UVFGR0lnRkZCRUJCQUVFQUlBQkJ3QUJ4STMwYkk0TUJRUUJNR3dSQUk0TUJRUUZySklNQlFRQWpnd0ZGSUFCQmdBRnhHd1JBUVFBa2Z3c0xDeUFBUWNBQWNVRUFSeVI5SUFCQmdBRnhCRUFRZ1FFamZVRUFRUUFqZ3dGQmdBSkdJQUViR3dSQUk0TUJRUUZySklNQkN3c0xVZ0JCQVNTUkFTT1dBVVVFUUVIQUFDU1dBUXNqbUFFampRRjBJNElDZENTVEFTT01BUVJBSTR3QkpKUUJCVUVJSkpRQkMwRUJKSlVCSTRvQkpKY0JRZi8vQVNTWkFTT1NBVVVFUUVFQUpKRUJDd3VMQVFFQ2Z5TzFBVUVCY1VFQlJpRUNJNUFCUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqbGdGQkFFd2JCRUFqbGdGQkFXc2tsZ0ZCQUNPV0FVVWdBRUdBQVhFYkJFQkJBQ1NSQVFzTEN5QUFRY0FBY1VFQVJ5U1FBU0FBUVlBQmNRUkFFSU1CSTVBQlFRQkJBQ09XQVVIQUFFWWdBaHNiQkVBamxnRkJBV3NrbGdFTEN3dWRCQUFqc2dGRlFRQWdBRUdtL2dOSEd3UkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQm12NERSZzBCQWtBZ0FFR1IvZ05yRGhZREJ3c1BBQVFJREJBQUJRa05FUUFHQ2c0U0V4UVZBQXNNRlFzZ0FSQjREQlVMUVFBZ0FVR0FBWEZCQUVjaUFDT0FBUnNFUUVFQUpJY0JDeUFBSklBQklBQkZCRUFnQUNSL0N3d1VDeUFCUVFaMVFRTnhKRkFnQVVFL2NTUlJRY0FBSTFGckpGNE1Fd3NnQVVFR2RVRURjU1JuSUFGQlAzRWthRUhBQUNOb2F5UjFEQklMSUFFa2VrR0FBaU42YXlTREFRd1JDeUFCUVQ5eEpJa0JRY0FBSTRrQmF5U1dBUXdRQ3lBQkVIa01Ed3NnQVJCNkRBNExRUUVraGdFZ0FVRUZkVUVQY1NSN0RBMExJQUVRZXd3TUN5QUJKRlVqVjBFSWRDQUJjaVJhREFzTElBRWtiQ051UVFoMElBRnlKSEVNQ2dzZ0FTUjhJMzVCQ0hRZ0FYSWtnUUVNQ1FzZ0FSQjhEQWdMSUFFUWZnd0hDeUFCRUlBQkRBWUxJQUVRZ2dFTUJRc2dBUkNFQVF3RUN5QUJRUVIxUVFkeEpLZ0JJQUZCQjNFa3FRRkJBU1NrQVF3REN5QUJFQ3RCQVNTbEFRd0NDeU95QVNJQUJIOUJBQVVnQVVHQUFYRUxCRUJCQnlTMUFVRUFKR0ZCQUNSNEN5QUJRWUFCY1VWQkFDQUFHd1JBQWtCQmtQNERJUUFEUUNBQVFhYitBMDROQVNBQVFRQVFrZ0VnQUVFQmFpRUFEQUFBQ3dBTEN5QUJRWUFCY1VFQVJ5U3lBUXdCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUhSQWZJQUJCQVdvaEFBd0JDd3RCaEFVayt3RUxKUUVCZjBIUi9nTVFIU0VBUWRMK0F4QWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhQOERjUXNwQVFGL1FkUCtBeEFkSVFCQjFQNERFQjFCL3dGeElBQkIvd0Z4UVFoMGNrSHdQM0ZCZ0lBQ2FndUdBUUVEZnlPQkFrVUVRQThMSUFCQmdBRnhSVUVBSS93Qkd3UkFRUUFrL0FGQjFmNERRZFgrQXhBZFFZQUJjaEFmRHdzUWh3RWhBUkNJQVNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSlB3QklBTWsvUUVnQVNUK0FTQUNKUDhCUWRYK0F5QUFRZjkrY1JBZkJTQUJJQUlnQXhDVEFVSFYvZ05CL3dFUUh3c0xXUUVFZjBFQlFlditBeUlESUFCR0lBQkI2ZjREUmhzRVFDQUFRUUZySWdRUUhVRy9mM0VpQWtFL2NTSUZRVUJySUFVZ0FDQURSaHRCZ0pBRWFpQUJPZ0FBSUFKQmdBRnhCRUFnQkNBQ1FRRnFRWUFCY2hBZkN3c0xNUUFDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdNQ0F3UUFDd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzZkFDQUFRUUVqekFFUWl3RWlBSFJ4Qkg5QkFTQUFkQ0FCY1VVRlFRQUxDNFlCQVFSL0EwQWdBaUFBU0FSQUlBSkJCR29oQWlQR0FTSUJRUVJxUWYvL0EzRWlBeVRHQVNQTEFRUkFJOGtCSVFRanlBRUVRQ1BLQVNUSEFVRUJKTUlCUVFJUVdrRUFKTWdCUVFFa3lRRUZJQVFFUUVFQUpNa0JDd3NnQVNBREVJd0JCRUFqeHdGQkFXb2lBVUgvQVVvRVFFRUJKTWdCUVFBaEFRc2dBU1RIQVFzTERBRUxDd3NOQUNQRkFSQ05BVUVBSk1VQkMwWUJBWDhqeGdFaEFFRUFKTVlCUVlUK0EwRUFFQjhqeXdFRWZ5QUFRUUFRakFFRlFRQUxCRUFqeHdGQkFXb2lBRUgvQVVvRVFFRUJKTWdCUVFBaEFBc2dBQ1RIQVFzTGZBRURmeVBMQVNFQklBQkJCSEZCQUVja3l3RWdBRUVEY1NFQ0lBRkZCRUFqekFFUWl3RWhBU0FDRUlzQklRTWp4Z0VoQUNQTEFRUi9RUUVnQVhRZ0FIRUZRUUVnQTNRZ0FIRkJBRUVCSUFGMElBQnhHd3NFUUNQSEFVRUJhaUlBUWY4QlNnUkFRUUVreUFGQkFDRUFDeUFBSk1jQkN3c2dBaVRNQVF2SUJnRUJmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUh3d0JDeUFBUWREK0EwWkJBQ09BQWhzRVFFRUFKSUFDUWY4QkpJd0NEQUlMSUFCQmdJQUNTQVJBSUFBZ0FSQjNEQUVMSUFCQmdNQUNTRUVBSUFCQmdJQUNUaHNOQVNBQVFZRDhBMGhCQUNBQVFZREFBMDRiQkVBZ0FFR0FRR29nQVJBZkRBSUxJQUJCbi8wRFRFRUFJQUJCZ1B3RFRoc0VRQ1BoQVVFQ1RnOExJQUJCLy8wRFRFRUFJQUJCb1AwRFRoc05BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKTThCSUFGQkFuRkJBRWNrMEFFZ0FVR0FBWEZCQUVjazBRRkJBUThMSUFCQnB2NERURUVBSUFCQmtQNERUaHNFUUJCeUlBQWdBUkNGQVE4TElBQkJ2LzREVEVFQUlBQkJzUDREVGhzRVFCQnlJMzhFUUNPRUFVRUJkVUd3L2dOcUlBRVFId3dDQ3d3Q0N5QUFRY3YrQTB4QkFDQUFRY0QrQTA0YkJFQWdBRUhBL2dOR0JFQWdBUkEvREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RSFVFSGNYSkJnQUZ5RUI4TUFnc2dBRUhFL2dOR0JFQkJBQ1R0QVNBQVFRQVFId3dDQ3lBQVFjWCtBMFlFUUNBQkpPSUJEQU1MSUFCQnh2NERSZ1JBSUFFUWhnRU1Bd3NDUUFKQUFrQUNRQ0FBUWNQK0EwY0VRQ0FBUWNMK0Eyc09DZ0VFQkFRRUJBUUVBd0lFQ3lBQkpPNEJEQVlMSUFFazd3RU1CUXNnQVNUd0FRd0VDeUFCSlBFQkRBTUxEQUlMSUFCQjFmNERSZ1JBSUFFUWlRRU1BUXRCQVNBQVFjLytBMFlnQUVIdy9nTkdHd1JBSS93QkJFQWovZ0VpQWtHQWdBRk9CSDhnQWtILy93Rk1CVUVBQ3dSL1FRRUZJQUpCLzc4RFRFRUFJQUpCZ0tBRFRoc0xEUUlMQ3lBQVFlditBMHhCQUNBQVFlaitBMDRiQkVBZ0FDQUJFSW9CREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFCQ09BUUpBQWtBQ1FBSkFJQUJCaFA0RFJ3UkFJQUJCaGY0RGF3NERBUUlEQkFzUWp3RU1CUXNDUUNQTEFRUkFJOGtCRFFFanlBRUVRRUVBSk1nQkN3c2dBU1RIQVFzTUJRc2dBU1RLQVNQSkFVRUFJOHNCR3dSQUlBRWt4d0ZCQUNUSkFRc01CQXNnQVJDUUFRd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVRhQVNQYUFTSUNRUkJ4UVFCSEpOc0JJQUpCSUhGQkFFY2szQUVMSUFCQmovNERSZ1JBSUFFUUx3d0NDeUFBUWYvL0EwWUVRQ0FCRUM0TUFndEJBUThMUVFBUEMwRUJDeUFBSTk4QklBQkdCRUJCQVNUZ0FRc2dBQ0FCRUpFQkJFQWdBQ0FCRUI4TEMxd0JBMzhEUUFKQUlBTWdBazROQUNBQUlBTnFFSFloQlNBQklBTnFJUVFEUUNBRVFmKy9Ba3hGQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUpJQklBTkJBV29oQXd3QkN3c2ord0ZCSUNPQ0FuUWdBa0VFZFd4cUpQc0JDM1FCQW44ai9BRkZCRUFQQzBFUUlRQWovZ0VqL3dFQ2Z5UDlBU0lCUVJCSUJFQWdBU0VBQ3lBQUN4Q1RBU1ArQVNBQWFpVCtBU1AvQVNBQWFpVC9BU0FCSUFCcklnQWsvUUZCMWY0RElRRWdBRUVBVEFSQVFRQWsvQUVnQVVIL0FSQWZCU0FCSUFCQkJIVkJBV3RCLzM1eEVCOExDek1BSSswQkkrSUJSa0VBSUFCQkFVWkJBU0FBR3hzRVFDQUJRUVJ5SWdGQndBQnhCRUFRV3dzRklBRkJlM0VoQVFzZ0FRdUJBZ0VGZnlQakFVVUVRQThMSStFQklRQWdBQ1B0QVNJQ1FaQUJUZ1IvUVFFRlFmZ0NJNElDZENJQklRTWo3QUVpQkNBQlRnUi9RUUlGUVFOQkFDQUVJQU5PR3dzTElnRkhCRUJCd2Y0REVCMGhBQ0FCSk9FQlFRQWhBZ0pBQWtBQ1FBSkFJQUVFUUNBQlFRRnJEZ01CQWdNRUN5QUFRWHh4SWdCQkNIRkJBRWNoQWd3REN5QUFRWDF4UVFGeUlnQkJFSEZCQUVjaEFnd0NDeUFBUVg1eFFRSnlJZ0JCSUhGQkFFY2hBZ3dCQ3lBQVFRTnlJUUFMSUFJRVFCQmJDeUFCUlFSQUVKUUJDeUFCUVFGR0JFQkJBU1RBQVVFQUVGb0xRY0grQXlBQklBQVFsUUVRSHdVZ0FrR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUhSQ1ZBUkFmQ3dzTG9BRUJBWDhqNHdFRVFDUHNBU0FBYWlUc0FTTTVJUUVEUUNQc0FVRUVJNElDSWdCMFFjZ0RJQUIwSSswQlFaa0JSaHRPQkVBajdBRkJCQ09DQWlJQWRFSElBeUFBZENQdEFVR1pBVVliYXlUc0FTUHRBU0lBUVpBQlJnUkFJQUVFUUJCWUJTQUFFRmNMRUZsQmZ5UktRWDhrU3dVZ0FFR1FBVWdFUUNBQlJRUkFJQUFRVndzTEMwRUFJQUJCQVdvZ0FFR1pBVW9iSk8wQkRBRUxDd3NRbGdFTE9BRUJmMEVFSTRJQ0lnQjBRY2dESUFCMEkrMEJRWmtCUmhzaEFBTkFJK3NCSUFCT0JFQWdBQkNYQVNQckFTQUFheVRyQVF3QkN3c0xzZ0VCQTM4ajBRRkZCRUFQQ3dOQUlBTWdBRWdFUUNBRFFRUnFJUU1DZnlQTkFTSUNRUVJxSWdGQi8vOERTZ1JBSUFGQmdJQUVheUVCQ3lBQkN5VE5BU0FDUVFGQkFrRUhJOUFCR3lJQ2RIRUVmMEVCSUFKMElBRnhSUVZCQUFzRVFFR0IvZ05CZ2Y0REVCMUJBWFJCQVdwQi93RnhFQjhqemdGQkFXb2lBVUVJUmdSQVFRQWt6Z0ZCQVNUREFVRURFRnBCZ3Y0RFFZTCtBeEFkUWY5K2NSQWZRUUFrMFFFRklBRWt6Z0VMQ3d3QkN3c0xsUUVBSS9zQlFRQktCRUFqK3dFZ0FHb2hBRUVBSlBzQkN5T05BaUFBYWlTTkFpT1JBa1VFUUNNM0JFQWo2d0VnQUdvazZ3RVFtQUVGSUFBUWx3RUxJellFUUNPbkFTQUFhaVNuQVJCeUJTQUFFSEVMSUFBUW1RRUxJemdFUUNQRkFTQUFhaVRGQVJDT0FRVWdBQkNOQVFzamxBSWdBR29pQUNPU0FrNEVRQ09UQWtFQmFpU1RBaUFBSTVJQ2F5RUFDeUFBSkpRQ0N3d0FRUVFRbWdFampBSVFIUXNwQVFGL1FRUVFtZ0VqakFKQkFXcEIvLzhEY1JBZElRQVFtd0ZCL3dGeElBQkIvd0Z4UVFoMGNnc09BRUVFRUpvQklBQWdBUkNTQVFzd0FFRUJJQUIwUWY4QmNTRUFJQUZCQUVvRVFDT0tBaUFBY2tIL0FYRWtpZ0lGSTRvQ0lBQkIvd0Z6Y1NTS0Fnc0xDUUJCQlNBQUVKNEJDem9CQVg4Z0FVRUFUZ1JBSUFCQkQzRWdBVUVQY1dwQkVIRkJBRWNRbndFRklBRkJIM1VpQWlBQklBSnFjMEVQY1NBQVFROXhTeENmQVFzTENRQkJCeUFBRUo0QkN3a0FRUVlnQUJDZUFRc0pBRUVFSUFBUW5nRUxQd0VDZnlBQlFZRCtBM0ZCQ0hVaEFpQUJRZjhCY1NJQklRTWdBQ0FCRUpFQkJFQWdBQ0FERUI4TElBQkJBV29pQUNBQ0VKRUJCRUFnQUNBQ0VCOExDdzRBUVFnUW1nRWdBQ0FCRUtRQkMxb0FJQUlFUUNBQVFmLy9BM0VpQUNBQmFpQUFJQUZ6Y3lJQVFSQnhRUUJIRUo4QklBQkJnQUp4UVFCSEVLTUJCU0FBSUFGcVFmLy9BM0VpQWlBQVFmLy9BM0ZKRUtNQklBQWdBWE1nQW5OQmdDQnhRUUJIRUo4QkN3c0xBRUVFRUpvQklBQVFkZ3VwQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNNRlFzUW5BRkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2hBSWdBRUgvQVhFa2hRSU1Ed3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSElqZ3dJUW5RRU1Fd3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraEFJTUV3c2poQUlpQUVFQkVLQUJJQUJCQVdwQi93RnhJZ0FraEFJTURRc2poQUlpQUVGL0VLQUJJQUJCQVd0Qi93RnhJZ0FraEFJTURRc1Ftd0ZCL3dGeEpJUUNEQTBMSTRNQ0lnQkJnQUZ4UVlBQlJoQ2pBU0FBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVrZ3dJTURRc1FuQUZCLy84RGNTT0xBaENsQVF3SUN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpSUFJNFVDUWY4QmNTT0VBa0gvQVhGQkNIUnlJZ0ZCQUJDbUFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWdDSUFCQi93RnhKSWtDUVFBUW9nRkJDQThMSTRVQ1FmOEJjU09FQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NEQWd3TEN5T0ZBa0gvQVhFamhBSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0VBZ3dMQ3lPRkFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0ZBZ3dGQ3lPRkFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0ZBZ3dGQ3hDYkFVSC9BWEVraFFJTUJRc2pnd0lpQUVFQmNVRUFTeENqQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFa2d3SU1CUXRCZnc4TEk0d0NRUUpxUWYvL0EzRWtqQUlNQkFzZ0FFVVFvUUZCQUJDaUFRd0RDeUFBUlJDaEFVRUJFS0lCREFJTEk0d0NRUUZxUWYvL0EzRWtqQUlNQVF0QkFCQ2hBVUVBRUtJQlFRQVFud0VMUVFRUEN5QUFRZjhCY1NTRkFrRUlDNWtHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVJCSEJFQWdBRUVSUmcwQkFrQWdBRUVTYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0JBZ1JBUWMzK0F4Q25BVUgvQVhFaUFFRUJjUVJBUWMzK0F5QUFRWDV4SWdCQmdBRnhCSDlCQUNTQ0FpQUFRZjkrY1FWQkFTU0NBaUFBUVlBQmNnc1FuUUZCeEFBUEN3dEJBU1NSQWd3UUN4Q2NBVUgvL3dOeElnQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBaU9NQWtFQ2FrSC8vd054Skl3Q0RCRUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlJNE1DRUowQkRCQUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSVlDREJBTEk0WUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTU0dBaU9HQWtVUW9RRkJBQkNpQVF3T0N5T0dBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWtoZ0lqaGdKRkVLRUJRUUVRb2dFTURRc1Ftd0ZCL3dGeEpJWUNEQW9MSTRNQ0lnRkJnQUZ4UVlBQlJpRUFJNG9DUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1NEQWd3S0N4Q2JBU0VBSTR3Q0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NNQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09IQWtIL0FYRWpoZ0pCL3dGeFFRaDBjaUlCUVFBUXBnRWdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSEFrSC9BWEVqaGdKQi93RnhRUWgwY2hDbkFVSC9BWEVrZ3dJTUNBc2pod0pCL3dGeEk0WUNRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtoZ0lNQ0Fzamh3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtod0lnQUVVUW9RRkJBQkNpQVF3R0N5T0hBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NIQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0hBZ3dDQ3lPREFpSUJRUUZ4UVFGR0lRQWppZ0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SklNQ0RBSUxRWDhQQ3lPTUFrRUJha0gvL3dOeEpJd0NEQUVMSUFBUW93RkJBQkNoQVVFQUVLSUJRUUFRbndFTFFRUVBDeUFBUWY4QmNTU0hBa0VJQy9VR0FRSi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVnUndSQUlBQkJJVVlOQVFKQUlBQkJJbXNPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamlnSkJCM1pCQVhFRVFDT01Ba0VCYWtILy93TnhKSXdDQlJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ3RCQ0E4TEVKd0JRZi8vQTNFaUFFR0EvZ054UVFoMUpJZ0NJQUJCL3dGeEpJa0NJNHdDUVFKcVFmLy9BM0VrakFJTUZBc2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09EQWhDZEFRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3TkN5T0lBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NJQWd3T0N5T0lBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NJQWd3T0N4Q2JBVUgvQVhFa2lBSU1EZ3RCQmtFQUk0b0NJZ0pCQlhaQkFYRkJBRXNiSWdCQjRBQnlJQUFnQWtFRWRrRUJjVUVBU3hzaEFDT0RBaUVCSUFKQkJuWkJBWEZCQUVzRWZ5QUJJQUJyUWY4QmNRVWdBU0FBUVFaeUlBQWdBVUVQY1VFSlN4c2lBRUhnQUhJZ0FDQUJRWmtCU3hzaUFHcEIvd0Z4Q3lJQlJSQ2hBU0FBUWVBQWNVRUFSeENqQVVFQUVKOEJJQUVrZ3dJTURnc2ppZ0pCQjNaQkFYRkJBRXNFUUJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ1VqakFKQkFXcEIvLzhEY1NTTUFndEJDQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5SWdBZ0FFSC8vd054UVFBUXBnRWdBRUVCZEVILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQUVLY0JRZjhCY1NTREFnd0hDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3RkN5T0pBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NKQWd3R0N5T0pBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NKQWd3R0N4Q2JBVUgvQVhFa2lRSU1CZ3NqZ3dKQmYzTkIvd0Z4SklNQ1FRRVFvZ0ZCQVJDZkFRd0dDMEYvRHdzZ0FFSC9BWEVraVFKQkNBOExJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUF3c2dBRVVRb1FGQkFCQ2lBUXdDQ3lBQVJSQ2hBVUVCRUtJQkRBRUxJNHdDUVFGcVFmLy9BM0VrakFJTFFRUUw4UVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhSZzBCQWtBZ0FFRXlhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPS0FrRUVka0VCY1FSQUk0d0NRUUZxUWYvL0EzRWtqQUlGRUpzQklRQWpqQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJd0NDMEVJRHdzUW5BRkIvLzhEY1NTTEFpT01Ba0VDYWtILy93TnhKSXdDREJFTEk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUlnQWpnd0lRblFFTURnc2ppd0pCQVdwQi8vOERjU1NMQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVNJQlFRRVFvQUVnQVVFQmFrSC9BWEVpQVVVUW9RRkJBQkNpQVNBQUlBRVFuUUVNRGdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BU0lCUVg4UW9BRWdBVUVCYTBIL0FYRWlBVVVRb1FGQkFSQ2lBU0FBSUFFUW5RRU1EUXNqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRbXdGQi93RnhFSjBCREFzTFFRQVFvZ0ZCQUJDZkFVRUJFS01CREFzTEk0b0NRUVIyUVFGeFFRRkdCRUFRbXdFaEFDT01BaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2pBSUZJNHdDUVFGcVFmLy9BM0VrakFJTFFRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaUlBSTRzQ1FRQVFwZ0VqaXdJZ0FHcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2lBSWdBRUgvQVhFa2lRSkJBQkNpQVVFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVVIL0FYRWtnd0lNQmdzaml3SkJBV3RCLy84RGNTU0xBa0VJRHdzamd3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVF3R0N5T0RBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NEQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0RBZ3dEQzBFQUVLSUJRUUFRbndFamlnSkJCSFpCQVhGQkFFMFFvd0VNQXd0QmZ3OExJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUFRc2pqQUpCQVdwQi8vOERjU1NNQWd0QkJBdUNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQkJ3UUJHRFFFQ1FDQUFRY0lBYXc0T0F3UUZCZ2NJQ1JFS0N3d05EZzhBQ3d3UEN3d1BDeU9GQWlTRUFnd09DeU9HQWlTRUFnd05DeU9IQWlTRUFnd01DeU9JQWlTRUFnd0xDeU9KQWlTRUFnd0tDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtoQUlNQ1Fzamd3SWtoQUlNQ0FzamhBSWtoUUlNQndzamhnSWtoUUlNQmdzamh3SWtoUUlNQlFzamlBSWtoUUlNQkFzamlRSWtoUUlNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RkIvd0Z4SklVQ0RBSUxJNE1DSklVQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFSd1JBSUFCQjBRQkdEUUVDUUNBQVFkSUFhdzRPRUFNRUJRWUhDQWtLRUFzTURRNEFDd3dPQ3lPRUFpU0dBZ3dPQ3lPRkFpU0dBZ3dOQ3lPSEFpU0dBZ3dNQ3lPSUFpU0dBZ3dMQ3lPSkFpU0dBZ3dLQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFVSC9BWEVraGdJTUNRc2pnd0lraGdJTUNBc2poQUlraHdJTUJ3c2poUUlraHdJTUJnc2poZ0lraHdJTUJRc2ppQUlraHdJTUJBc2ppUUlraHdJTUF3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFwd0ZCL3dGeEpJY0NEQUlMSTRNQ0pJY0NEQUVMUVg4UEMwRUVDLzBCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFBUndSQUlBQkI0UUJHRFFFQ1FDQUFRZUlBYXc0T0F3UVFCUVlIQ0FrS0N3d1FEUTRBQ3d3T0N5T0VBaVNJQWd3T0N5T0ZBaVNJQWd3TkN5T0dBaVNJQWd3TUN5T0hBaVNJQWd3TEN5T0pBaVNJQWd3S0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2lBSU1DUXNqZ3dJa2lBSU1DQXNqaEFJa2lRSU1Cd3NqaFFJa2lRSU1CZ3NqaGdJa2lRSU1CUXNqaHdJa2lRSU1CQXNqaUFJa2lRSU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdGQi93RnhKSWtDREFJTEk0TUNKSWtDREFFTFFYOFBDMEVFQzVzREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUVIeEFFWU5BUUpBSUFCQjhnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVRQUxEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRRQ0VKMEJEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRVQ0VKMEJEQTRMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRZQ0VKMEJEQTBMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRjQ0VKMEJEQXdMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRnQ0VKMEJEQXNMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRrQ0VKMEJEQW9MSS93QlJRUkFBa0FqdHdFRVFFRUJKSTRDREFFTEk3a0JJNzhCY1VFZmNVVUVRRUVCSkk4Q0RBRUxRUUVra0FJTEN3d0pDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaU9EQWhDZEFRd0lDeU9FQWlTREFnd0hDeU9GQWlTREFnd0dDeU9HQWlTREFnd0ZDeU9IQWlTREFnd0VDeU9JQWlTREFnd0RDeU9KQWlTREFnd0NDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtnd0lNQVF0QmZ3OExRUVFMTndFQmZ5QUJRUUJPQkVBZ0FFSC9BWEVnQUNBQmFrSC9BWEZMRUtNQkJTQUJRUjkxSWdJZ0FTQUNhbk1nQUVIL0FYRktFS01CQ3dzMEFRSi9JNE1DSWdFZ0FFSC9BWEVpQWhDZ0FTQUJJQUlRc0FFZ0FDQUJha0gvQVhFaUFDU0RBaUFBUlJDaEFVRUFFS0lCQzFnQkFuOGpnd0lpQVNBQWFpT0tBa0VFZGtFQmNXcEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQUVIL0FYRWdBV29qaWdKQkJIWkJBWEZxUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRQVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZQUJSd1JBSUFCQmdRRkdEUUVDUUNBQVFZSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQ3hBUXdRQ3lPRkFoQ3hBUXdQQ3lPR0FoQ3hBUXdPQ3lPSEFoQ3hBUXdOQ3lPSUFoQ3hBUXdNQ3lPSkFoQ3hBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3hBUXdLQ3lPREFoQ3hBUXdKQ3lPRUFoQ3lBUXdJQ3lPRkFoQ3lBUXdIQ3lPR0FoQ3lBUXdHQ3lPSEFoQ3lBUXdGQ3lPSUFoQ3lBUXdFQ3lPSkFoQ3lBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3lBUXdDQ3lPREFoQ3lBUXdCQzBGL0R3dEJCQXMzQVFKL0k0TUNJZ0VnQUVIL0FYRkJmMndpQWhDZ0FTQUJJQUlRc0FFZ0FTQUFhMEgvQVhFaUFDU0RBaUFBUlJDaEFVRUJFS0lCQzFnQkFuOGpnd0lpQVNBQWF5T0tBa0VFZGtFQmNXdEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQVNBQVFmOEJjV3NqaWdKQkJIWkJBWEZyUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRRVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFaQUJSd1JBSUFCQmtRRkdEUUVDUUNBQVFaSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQzBBUXdRQ3lPRkFoQzBBUXdQQ3lPR0FoQzBBUXdPQ3lPSEFoQzBBUXdOQ3lPSUFoQzBBUXdNQ3lPSkFoQzBBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzBBUXdLQ3lPREFoQzBBUXdKQ3lPRUFoQzFBUXdJQ3lPRkFoQzFBUXdIQ3lPR0FoQzFBUXdHQ3lPSEFoQzFBUXdGQ3lPSUFoQzFBUXdFQ3lPSkFoQzFBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzFBUXdDQ3lPREFoQzFBUXdCQzBGL0R3dEJCQXNpQUNPREFpQUFjU0lBSklNQ0lBQkZFS0VCUVFBUW9nRkJBUkNmQVVFQUVLTUJDeVlBSTRNQ0lBQnpRZjhCY1NJQUpJTUNJQUJGRUtFQlFRQVFvZ0ZCQUJDZkFVRUFFS01CQzRzQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR2dBVWNFUUNBQVFhRUJSZzBCQWtBZ0FFR2lBV3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamhBSVF0d0VNRUFzamhRSVF0d0VNRHdzamhnSVF0d0VNRGdzamh3SVF0d0VNRFFzamlBSVF0d0VNREFzamlRSVF0d0VNQ3dzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF0d0VNQ2dzamd3SVF0d0VNQ1FzamhBSVF1QUVNQ0FzamhRSVF1QUVNQndzamhnSVF1QUVNQmdzamh3SVF1QUVNQlFzamlBSVF1QUVNQkFzamlRSVF1QUVNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF1QUVNQWdzamd3SVF1QUVNQVF0QmZ3OExRUVFMSmdBamd3SWdBSEpCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVVFQUVKOEJRUUFRb3dFTExBRUJmeU9EQWlJQklBQkIvd0Z4UVg5c0lnQVFvQUVnQVNBQUVMQUJJQUFnQVdwRkVLRUJRUUVRb2dFTGl3SUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRYkFCUndSQUlBQkJzUUZHRFFFQ1FDQUFRYklCYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0VBaEM2QVF3UUN5T0ZBaEM2QVF3UEN5T0dBaEM2QVF3T0N5T0hBaEM2QVF3TkN5T0lBaEM2QVF3TUN5T0pBaEM2QVF3TEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM2QVF3S0N5T0RBaEM2QVF3SkN5T0VBaEM3QVF3SUN5T0ZBaEM3QVF3SEN5T0dBaEM3QVF3R0N5T0hBaEM3QVF3RkN5T0lBaEM3QVF3RUN5T0pBaEM3QVF3REN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM3QVF3Q0N5T0RBaEM3QVF3QkMwRi9Ed3RCQkFzN0FRRi9JQUFRZFNJQlFYOUdCSDhnQUJBZEJTQUJDMEgvQVhFZ0FFRUJhaUlCRUhVaUFFRi9SZ1IvSUFFUUhRVWdBQXRCL3dGeFFRaDBjZ3NNQUVFSUVKb0JJQUFRdlFFTE5BQWdBRUdBQVhGQmdBRkdFS01CSUFCQkFYUWdBRUgvQVhGQkIzWnlRZjhCY1NJQVJSQ2hBVUVBRUtJQlFRQVFud0VnQUFzeUFDQUFRUUZ4UVFCTEVLTUJJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBUlJDaEFVRUFFS0lCUVFBUW53RWdBQXM0QVFGL0k0b0NRUVIyUVFGeElBQkJBWFJ5UWY4QmNTRUJJQUJCZ0FGeFFZQUJSaENqQVNBQlJSQ2hBVUVBRUtJQlFRQVFud0VnQVFzNUFRRi9JNG9DUVFSMlFRRnhRUWQwSUFCQi93RnhRUUYyY2lFQklBQkJBWEZCQVVZUW93RWdBVVVRb1FGQkFCQ2lBVUVBRUo4QklBRUxLZ0FnQUVHQUFYRkJnQUZHRUtNQklBQkJBWFJCL3dGeElnQkZFS0VCUVFBUW9nRkJBQkNmQVNBQUN6MEJBWDhnQUVIL0FYRkJBWFlpQVVHQUFYSWdBU0FBUVlBQmNVR0FBVVliSWdGRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBUVFGeFFRRkdFS01CSUFFTEt3QWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSWlBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VnQUFzcUFRRi9JQUJCL3dGeFFRRjJJZ0ZGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFRUUZ4UVFGR0VLTUJJQUVMSGdCQkFTQUFkQ0FCY1VIL0FYRkZFS0VCUVFBUW9nRkJBUkNmQVNBQkM4Z0lBUVYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFkeElnUUVRQ0FFUVFGR0RRRUNRQ0FFUVFKckRnWURCQVVHQndnQUN3d0lDeU9FQWlFQkRBY0xJNFVDSVFFTUJnc2poZ0loQVF3RkN5T0hBaUVCREFRTEk0Z0NJUUVNQXdzamlRSWhBUXdDQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFTRUJEQUVMSTRNQ0lRRUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUJRUkFJQVZCQVVZTkFRSkFJQVZCQW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2dBRUVIVEFSL0lBRVF2d0VoQWtFQkJTQUFRUTlNQkg4Z0FSREFBU0VDUVFFRlFRQUxDeUVEREE4TElBQkJGMHdFZnlBQkVNRUJJUUpCQVFVZ0FFRWZUQVIvSUFFUXdnRWhBa0VCQlVFQUN3c2hBd3dPQ3lBQVFTZE1CSDhnQVJEREFTRUNRUUVGSUFCQkwwd0VmeUFCRU1RQklRSkJBUVZCQUFzTElRTU1EUXNnQUVFM1RBUi9JQUVReFFFaEFrRUJCU0FBUVQ5TUJIOGdBUkRHQVNFQ1FRRUZRUUFMQ3lFRERBd0xJQUJCeHdCTUJIOUJBQ0FCRU1jQklRSkJBUVVnQUVIUEFFd0VmMEVCSUFFUXh3RWhBa0VCQlVFQUN3c2hBd3dMQ3lBQVFkY0FUQVIvUVFJZ0FSREhBU0VDUVFFRklBQkIzd0JNQkg5QkF5QUJFTWNCSVFKQkFRVkJBQXNMSVFNTUNnc2dBRUhuQUV3RWYwRUVJQUVReHdFaEFrRUJCU0FBUWU4QVRBUi9RUVVnQVJESEFTRUNRUUVGUVFBTEN5RUREQWtMSUFCQjl3Qk1CSDlCQmlBQkVNY0JJUUpCQVFVZ0FFSC9BRXdFZjBFSElBRVF4d0VoQWtFQkJVRUFDd3NoQXd3SUN5QUFRWWNCVEFSL0lBRkJmbkVoQWtFQkJTQUFRWThCVEFSL0lBRkJmWEVoQWtFQkJVRUFDd3NoQXd3SEN5QUFRWmNCVEFSL0lBRkJlM0VoQWtFQkJTQUFRWjhCVEFSL0lBRkJkM0VoQWtFQkJVRUFDd3NoQXd3R0N5QUFRYWNCVEFSL0lBRkJiM0VoQWtFQkJTQUFRYThCVEFSL0lBRkJYM0VoQWtFQkJVRUFDd3NoQXd3RkN5QUFRYmNCVEFSL0lBRkJ2Mzl4SVFKQkFRVWdBRUcvQVV3RWZ5QUJRZjkrY1NFQ1FRRUZRUUFMQ3lFRERBUUxJQUJCeHdGTUJIOGdBVUVCY2lFQ1FRRUZJQUJCendGTUJIOGdBVUVDY2lFQ1FRRUZRUUFMQ3lFRERBTUxJQUJCMXdGTUJIOGdBVUVFY2lFQ1FRRUZJQUJCM3dGTUJIOGdBVUVJY2lFQ1FRRUZRUUFMQ3lFRERBSUxJQUJCNXdGTUJIOGdBVUVRY2lFQ1FRRUZJQUJCN3dGTUJIOGdBVUVnY2lFQ1FRRUZRUUFMQ3lFRERBRUxJQUJCOXdGTUJIOGdBVUhBQUhJaEFrRUJCU0FBUWY4QlRBUi9JQUZCZ0FGeUlRSkJBUVZCQUFzTElRTUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUVCRUFnQkVFQlJnMEJBa0FnQkVFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQWlTRUFnd0hDeUFDSklVQ0RBWUxJQUlraGdJTUJRc2dBaVNIQWd3RUN5QUNKSWdDREFNTElBSWtpUUlNQWd0QkFTQUZRUWRLSUFWQkJFZ2JCRUFqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElnQWhDZEFRc01BUXNnQWlTREFndEJCRUYvSUFNYkM3c0VBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJSZzBCQWtBZ0FFSENBV3NPRGdNU0JBVUdCd2dKQ2dzTUVRME9BQXNNRGdzamlnSkJCM1pCQVhFTkVRd09DeU9MQWhDK0FVSC8vd054SVFBaml3SkJBbXBCLy84RGNTU0xBaUFBUVlEK0EzRkJDSFVraEFJZ0FFSC9BWEVraFFKQkJBOExJNG9DUVFkMlFRRnhEUkVNRGdzamlnSkJCM1pCQVhFTkVBd01DeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09GQWtIL0FYRWpoQUpCL3dGeFFRaDBjaENsQVF3TkN4Q2JBUkN4QVF3TkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFQUpJd0NEQXNMSTRvQ1FRZDJRUUZ4UVFGSERRb01Cd3NqaXdJaUFCQytBVUgvL3dOeEpJd0NJQUJCQW1wQi8vOERjU1NMQWd3SkN5T0tBa0VIZGtFQmNVRUJSZzBIREFvTEVKc0JRZjhCY1JESUFTRUFJNHdDUVFGcVFmLy9BM0VrakFJZ0FBOExJNG9DUVFkMlFRRnhRUUZIRFFnaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSkJBbXBCLy84RGNSQ2xBUXdGQ3hDYkFSQ3lBUXdHQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVJSkl3Q0RBUUxRWDhQQ3lPTEFpSUFFTDRCUWYvL0EzRWtqQUlnQUVFQ2FrSC8vd054SklzQ1FRd1BDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWtFQ2FrSC8vd054RUtVQkN4Q2NBVUgvL3dOeEpJd0NDMEVJRHdzampBSkJBV3BCLy84RGNTU01Ba0VFRHdzampBSkJBbXBCLy84RGNTU01Ba0VNQzZBRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVVZTkFRSkFJQUJCMGdGckRnNERBQVFGQmdjSUNRb0FDd0FNRFFBTERBMExJNG9DUVFSMlFRRnhEUThNRFFzaml3SWlBUkMrQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SklzQ0lBQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBa0VFRHdzamlnSkJCSFpCQVhFTkR3d01DeU9LQWtFRWRrRUJjUTBPSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTR3Q1FRSnFRZi8vQTNFUXBRRU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaHdKQi93RnhJNFlDUWY4QmNVRUlkSElRcFFFTUN3c1Ftd0VRdEFFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUlRcFFGQkVDU01BZ3dKQ3lPS0FrRUVka0VCY1VFQlJ3MElEQVlMSTRzQ0lnQVF2Z0ZCLy84RGNTU01Ba0VCSkxnQklBQkJBbXBCLy84RGNTU0xBZ3dIQ3lPS0FrRUVka0VCY1VFQlJnMEZEQWdMSTRvQ1FRUjJRUUZ4UVFGSERRY2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUpCQW1wQi8vOERjUkNsQVF3RUN4Q2JBUkMxQVF3RkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFWUpJd0NEQU1MUVg4UEN5T0xBaUlBRUw0QlFmLy9BM0VrakFJZ0FFRUNha0gvL3dOeEpJc0NRUXdQQ3hDY0FVSC8vd054Skl3Q0MwRUlEd3NqakFKQkFXcEIvLzhEY1NTTUFrRUVEd3NqakFKQkFtcEIvLzhEY1NTTUFrRU1DN0VEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFVWU5BUUpBSUFCQjRnRnJEZzREQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRUpzQlFmOEJjVUdBL2dOcUk0TUNFSjBCREFzTEk0c0NJZ0VRdmdGQi8vOERjU0VBSUFGQkFtcEIvLzhEY1NTTEFpQUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUpCQkE4TEk0VUNRWUQrQTJvamd3SVFuUUZCQkE4TEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUVLVUJRUWdQQ3hDYkFSQzNBUXdIQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVnSkl3Q1FRZ1BDeENiQVVFWWRFRVlkU0VBSTRzQ0lBQkJBUkNtQVNPTEFpQUFha0gvL3dOeEpJc0NRUUFRb1FGQkFCQ2lBU09NQWtFQmFrSC8vd054Skl3Q1FRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNNQWtFRUR3c1FuQUZCLy84RGNTT0RBaENkQVNPTUFrRUNha0gvL3dOeEpJd0NRUVFQQ3hDYkFSQzRBUXdDQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVvSkl3Q1FRZ1BDMEYvRHdzampBSkJBV3BCLy84RGNTU01Ba0VFQytjREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFnQUVIeEFVWU5BUUpBSUFCQjhnRnJEZzREQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRUpzQlFmOEJjVUdBL2dOcUVLY0JRZjhCY1NTREFnd05DeU9MQWlJQkVMNEJRZi8vQTNFaEFDQUJRUUpxUWYvL0EzRWtpd0lnQUVHQS9nTnhRUWgxSklNQ0lBQkIvd0Z4SklvQ0RBMExJNFVDUVlEK0Eyb1Fwd0ZCL3dGeEpJTUNEQXdMUVFBa3R3RU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaWdKQi93RnhJNE1DUWY4QmNVRUlkSElRcFFGQkNBOExFSnNCRUxvQkRBZ0xJNHNDUVFKclFmLy9BM0VpQUNTTEFpQUFJNHdDRUtVQlFUQWtqQUpCQ0E4TEVKc0JRUmgwUVJoMUlRQWppd0loQVVFQUVLRUJRUUFRb2dFZ0FTQUFRUUVRcGdFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBaU9NQWtFQmFrSC8vd054Skl3Q1FRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNMQWtFSUR3c1FuQUZCLy84RGNSQ25BVUgvQVhFa2d3SWpqQUpCQW1wQi8vOERjU1NNQWd3RkMwRUJKTGdCREFRTEVKc0JFTHNCREFJTEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0d0NFS1VCUVRna2pBSkJDQThMUVg4UEN5T01Ba0VCYWtILy93TnhKSXdDQzBFRUM5Z0JBUUYvSTR3Q1FRRnFRZi8vQTNFaEFTT1FBZ1JBSUFGQkFXdEIvLzhEY1NFQkN5QUJKSXdDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGckRnNEJBZ01FQlFZSENBa0tDd3dORGc4TElBQVFxQUVQQ3lBQUVLa0JEd3NnQUJDcUFROExJQUFRcXdFUEN5QUFFS3dCRHdzZ0FCQ3RBUThMSUFBUXJnRVBDeUFBRUs4QkR3c2dBQkN6QVE4TElBQVF0Z0VQQ3lBQUVMa0JEd3NnQUJDOEFROExJQUFReVFFUEN5QUFFTW9CRHdzZ0FCRExBUThMSUFBUXpBRUx2Z0VCQW45QkFDUzNBVUdQL2dNUUhVRUJJQUIwUVg5emNTSUJKTDhCUVkvK0F5QUJFQjhqaXdKQkFtdEIvLzhEY1NTTEFpT0xBaUlCSTR3Q0lnSkIvd0Z4RUI4Z0FVRUJhaUFDUVlEK0EzRkJDSFVRSHdKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0F3TUVCUUFMREFVTFFRQWt3QUZCd0FBa2pBSU1CQXRCQUNUQkFVSElBQ1NNQWd3REMwRUFKTUlCUWRBQUpJd0NEQUlMUVFBa3d3RkIyQUFrakFJTUFRdEJBQ1RFQVVIZ0FDU01BZ3NMNlFFQkFuOGp1QUVFUUVFQkpMY0JRUUFrdUFFTEk3a0JJNzhCY1VFZmNVRUFTZ1JBSTQ4Q1JVRUFJN2NCR3dSL0k4QUJRUUFqdWdFYkJIOUJBQkRPQVVFQkJTUEJBVUVBSTdzQkd3Ui9RUUVRemdGQkFRVWp3Z0ZCQUNPOEFSc0VmMEVDRU00QlFRRUZJOE1CUVFBanZRRWJCSDlCQXhET0FVRUJCU1BFQVVFQUk3NEJHd1IvUVFRUXpnRkJBUVZCQUFzTEN3c0xCVUVBQ3dSQVFRRWpqd0lqamdJYkJIOUJBQ1NQQWtFQUpJNENRUUFra0FKQkFDU1JBa0VZQlVFVUN5RUFDMEVCSTQ4Q0k0NENHd1JBUVFBa2p3SkJBQ1NPQWtFQUpKQUNRUUFra1FJTElBQVBDMEVBQzdZQkFRSi9RUUVrbUFJamtBSUVRQ09NQWhBZFFmOEJjUkROQVJDYUFVRUFKSThDUVFBa2pnSkJBQ1NRQWtFQUpKRUNDeERQQVNJQVFRQktCRUFnQUJDYUFRdEJCQ0VBUVFBamtRSkZRUUVqandJampnSWJHd1JBSTR3Q0VCMUIvd0Z4RU0wQklRQUxJNG9DUWZBQmNTU0tBaUFBUVFCTUJFQWdBQThMSUFBUW1nRWpsd0pCQVdvaUFTT1ZBazRFZnlPV0FrRUJhaVNXQWlBQkk1VUNhd1VnQVFza2x3SWpqQUlqM1FGR0JFQkJBU1RnQVFzZ0FBc0ZBQ08yQVF1dUFRRURmeUFBUVg5QmdBZ2dBRUVBU0JzZ0FFRUFTaHNoQWtFQUlRQURRQ1BnQVVWQkFDQUJSVUVBUVFBZ0FFVWdBeHNiR3dSQUVOQUJRUUJJQkVCQkFTRURCU09OQWtIUXBBUWpnZ0owVGdSQVFRRWhBQVZCQVNBQkk3WUJJQUpPUVFBZ0FrRi9TaHNiSVFFTEN3d0JDd3NnQUFSQUk0MENRZENrQkNPQ0FuUnJKSTBDUVFBUEN5QUJCRUJCQVE4TEkrQUJCRUJCQUNUZ0FVRUNEd3NqakFKQkFXdEIvLzhEY1NTTUFrRi9Dd2NBUVg4UTBnRUxOQUVDZndOQUlBRkJBRTVCQUNBQ0lBQklHd1JBUVg4UTBnRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09TQWdzRkFDT1RBZ3NGQUNPVUFndGJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09CZ01FQlFZSENBQUxEQWdMSTlJQkR3c2oxUUVQQ3lQVEFROExJOVFCRHdzajFnRVBDeVBYQVE4TEk5Z0JEd3NqMlFFUEMwRUFDNGNCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQmdNRUJRWUhDQUFMREFnTElBRkJBRWNrMGdFTUJ3c2dBVUVBUnlUVkFRd0dDeUFCUVFCSEpOTUJEQVVMSUFGQkFFY2sxQUVNQkFzZ0FVRUFSeVRXQVF3REN5QUJRUUJISk5jQkRBSUxJQUZCQUVjazJBRU1BUXNnQVVFQVJ5VFpBUXNMVVFFQmYwRUFKSkVDSUFBUTJBRkZCRUJCQVNFQkN5QUFRUUVRMlFFZ0FRUkFRUUZCQVVFQVFRRkJBQ0FBUVFOTUd5SUFRUUFqMndFYkd5QUFSVUVBSTl3Qkd4c0VRRUVCSk1RQlFRUVFXZ3NMQ3drQUlBQkJBQkRaQVF1YUFRQWdBRUVBU2dSQVFRQVEyZ0VGUVFBUTJ3RUxJQUZCQUVvRVFFRUJFTm9CQlVFQkVOc0JDeUFDUVFCS0JFQkJBaERhQVFWQkFoRGJBUXNnQTBFQVNnUkFRUU1RMmdFRlFRTVEyd0VMSUFSQkFFb0VRRUVFRU5vQkJVRUVFTnNCQ3lBRlFRQktCRUJCQlJEYUFRVkJCUkRiQVFzZ0JrRUFTZ1JBUVFZUTJnRUZRUVlRMndFTElBZEJBRW9FUUVFSEVOb0JCVUVIRU5zQkN3c0hBQ0FBSk4wQkN3Y0FRWDhrM1FFTEJ3QWdBQ1RlQVFzSEFFRi9KTjRCQ3djQUlBQWszd0VMQndCQmZ5VGZBUXNGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0lBZ3NGQUNPSkFnc0ZBQ09LQWdzRkFDT01BZ3NGQUNPTEFnc0xBQ09NQWhBZFFmOEJjUXNGQUNQdEFRdXJBd0VLZjBHQWdBSkJnSkFDSStZQkd5RUlRWUM0QWtHQXNBSWo1d0ViSVFrRFFDQUZRWUFDU0FSQVFRQWhCQU5BSUFSQmdBSklCRUFnQ0NBRlFRTjFRUVYwSUFscUlBUkJBM1ZxSWdKQmdKQithaTBBQUJCTklRWWdCVUVJYnlFQlFRY2dCRUVJYjJzaEIwRUFJUU1DZnlBQVFRQktRUUFqZ1FJYkJFQWdBa0dBMEg1cUxRQUFJUU1MSUFOQndBQnhDd1JBUVFjZ0FXc2hBUXRCQUNFQ0lBRkJBWFFnQm1vaUJrR0FrSDVxUVFGQkFDQURRUWh4R3lJQ1FRMTBhaTBBQUNFS1FRQWhBU0FHUVlHUWZtb2dBa0VOZEdvdEFBQkJBU0FIZEhFRVFFRUNJUUVMSUFGQkFXb2dBVUVCSUFkMElBcHhHeUVCSUFWQkNIUWdCR3BCQTJ3aEFpQUFRUUJLUVFBamdRSWJCRUFnQWtHQW9RdHFJZ0lnQTBFSGNTQUJRUUFRVGlJQlFSOXhRUU4wT2dBQUlBSkJBV29nQVVIZ0IzRkJCWFZCQTNRNkFBQWdBa0VDYWlBQlFZRDRBWEZCQ25WQkEzUTZBQUFGSUFKQmdLRUxhaUlESUFGQngvNERFRThpQVVHQWdQd0hjVUVRZFRvQUFDQURRUUZxSUFGQmdQNERjVUVJZFRvQUFDQURRUUpxSUFFNkFBQUxJQVJCQVdvaEJBd0JDd3NnQlVFQmFpRUZEQUVMQ3d2VkF3RU1md05BSUFSQkYwNUZCRUJCQUNFREEwQWdBMEVmU0FSQVFRRkJBQ0FEUVE5S0lnY2JJUWtnQkVFUGF5QUVJQVJCRDBvaUFCdEJCSFFpQlNBRFFROXJhaUFESUFWcUlBY2JJUWhCZ0pBQ1FZQ0FBaUFBR3lFS1FjZitBeUVIUVg4aEJrRi9JUVZCQUNFQkEwQWdBVUVJU0FSQVFRQWhBQU5BSUFCQkJVZ0VRQ0FBUVFOMElBRnFRUUowSWdKQmd2d0RhaEFkSUFoR0JFQWdBa0dEL0FOcUVCMGhBa0VCUVFBZ0FrRUljVUVBSTRFQ0d4c2dDVVlFUUVFSUlRRkJCU0VBSUFJaUJVRVFjUVIvUWNuK0F3VkJ5UDREQ3lFSEN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFWQkFFaEJBQ09CQWhzRVFFR0F1QUpCZ0xBQ0krY0JHeUVMUVg4aEFFRUFJUUlEUUNBQ1FTQklCRUJCQUNFQkEwQWdBVUVnU0FSQUlBRkJCWFFnQzJvZ0Ftb2lCa0dBa0g1cUxRQUFJQWhHQkVCQklDRUNRU0FoQVNBR0lRQUxJQUZCQVdvaEFRd0JDd3NnQWtFQmFpRUNEQUVMQ3lBQVFRQk9CSDhnQUVHQTBINXFMUUFBQlVGL0N5RUdDMEVBSVFBRFFDQUFRUWhJQkVBZ0NDQUtJQWxCQUVFSElBQWdBMEVEZENBRVFRTjBJQUJxUWZnQlFZQ2hGeUFISUFZZ0JSQlFHaUFBUVFGcUlRQU1BUXNMSUFOQkFXb2hBd3dCQ3dzZ0JFRUJhaUVFREFFTEN3dVdBZ0VKZndOQUlBUkJDRTVGQkVCQkFDRUJBMEFnQVVFRlNBUkFJQUZCQTNRZ0JHcEJBblFpQUVHQS9BTnFFQjBhSUFCQmdmd0RhaEFkR2lBQVFZTDhBMm9RSFNFQ1FRRWhCU1BvQVFSQUlBSkJBbTlCQVVZRVFDQUNRUUZySVFJTFFRSWhCUXNnQUVHRC9BTnFFQjBoQmtFQUlRZEJBVUVBSUFaQkNIRkJBQ09CQWhzYklRZEJ5UDRESVFoQnlmNERRY2orQXlBR1FSQnhHeUVJUVFBaEFBTkFJQUFnQlVnRVFFRUFJUU1EUUNBRFFRaElCRUFnQUNBQ2FrR0FnQUlnQjBFQVFRY2dBeUFFUVFOMElBRkJCSFFnQTJvZ0FFRURkR3BCd0FCQmdLRWdJQWhCZnlBR0VGQWFJQU5CQVdvaEF3d0JDd3NnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTElBUkJBV29oQkF3QkN3c0xCUUFqeGdFTEJRQWp4d0VMQlFBanlnRUxHQUVCZnlQTUFTRUFJOHNCQkVBZ0FFRUVjaUVBQ3lBQUN6QUJBWDhEUUFKQUlBQkIvLzhEVGcwQUlBQkJnTFhKQkdvZ0FCQjJPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVGdBUXNXQUJBYlB3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEM5d0JBQ0FBUVp3Q1NRUkFEd3NnQUVFUWF5RUFBa0FDUUFKQUFrQUNRQUpBSUFGQkFVY0VRQ0FCUVFKR0RRRUNRQ0FCUVFOckRnTURCQVVBQ3d3RkN5QUFFQmtNQlFzZ0FDZ0NCRUgvLy8vL0FIRkJBRTBFUUVFQVFZQUJRY3NBUVJFUUFBQUxJQUFnQUNnQ0JFRUJhellDQkNBQUVBY01CQXNnQUJBS0RBTUxJQUFvQWdRaUFVR0FnSUNBZjNFZ0FVRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUFVSFdBRUVHRUFBQUN5QUFJQUZCQVdvMkFnUWdBVUdBZ0lDQUIzRUVRQ0FBRUFrTERBSUxJQUFRQ3d3QkMwRUFRWUFCUWVFQVFSZ1FBQUFMQ3kwQUFrQUNRQUpBSUFCQkNHc29BZ0FPQXdBQUFRSUxEd3NnQUNnQ0FDSUFCRUFnQUNBQkVQZ0JDdzhMQUFzREFBRUxIUUFDUUFKQUFrQWptZ0lPQWdFQ0FBc0FDMEVBSVFBTElBQVEwZ0VMQndBZ0FDU2FBZ3NsQUFKQUFrQUNRQUpBSTVvQ0RnTUJBZ01BQ3dBTFFRRWhBQXRCZnlFQkN5QUJFTklCQ3d1ZkFnWUFRUWdMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFkQUJzQUhNQVpnQXVBSFFBY3dCQk9BczNLQUFBQUFFQUFBQUJBQUFBS0FBQUFHRUFiQUJzQUc4QVl3QmhBSFFBYVFCdkFHNEFJQUIwQUc4QWJ3QWdBR3dBWVFCeUFHY0FaUUJCOEFBTExSNEFBQUFCQUFBQUFRQUFBQjRBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzhBY0FCMUFISUFaUUF1QUhRQWN3QkJvQUVMTXlRQUFBQUJBQUFBQVFBQUFDUUFBQUJKQUc0QVpBQmxBSGdBSUFCdkFIVUFkQUFnQUc4QVpnQWdBSElBWVFCdUFHY0FaUUJCMkFFTEl4UUFBQUFCQUFBQUFRQUFBQlFBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzRBZEFCekFFR0FBZ3NWQXdBQUFCQUFBQUFBQUFBQUVBQUFBQUFBQUFBUUFETVFjMjkxY21ObFRXRndjR2x1WjFWU1RDRmpiM0psTDJScGMzUXZZMjl5WlM1MWJuUnZkV05vWldRdWQyRnpiUzV0WVhBPSIpOgphd2FpdCBPKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlBRVJZQUovZndGL1lBQUFZQU4vZjM4QmYyQUVmMzkvZndCZ0FuOS9BR0FCZndGL1lBRi9BR0FEZjM5L0FHQUtmMzkvZjM5L2YzOS9md0JnQUFGL1lBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCMzkvZjM5L2YzOEFZQVIvZjM5L0FYOWdDSDkvZjM5L2YzOS9BR0FGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBREEvOEIvUUVFQkFjQkJRQUdCQVlHQmdFRUJ3QUFCZ1VGQndjR0FRWUdCZ0VGQlFFRUFRRUdCZ0VCQVFFQkFRRUdBUUVHQmdFQkFRRUlDUUVCQVFFQkFRRUJCZ1lCQVFFQkFRRUJBUWtKQ1FrUEFBSUFFQXNNQ2dvSEJBWUJBUVlCQVFFQkJnRUJBUUVGQlFBRkJRa0JCUVVBRFFZR0JnRUZDUVVGQkFZR0JnWUdBUVlCQmdFR0FRWUFCZ2tKQmdRRkFBWUJBUVlBQkFjQkFBRUdBUVlHQ1FrRUJBWUVCZ1lHQkFRSEJRVUZCUVVGQlFVRkJBWUdCUVlHQlFZR0JRWUdCUVVGQlFVRkJRVUZCUVVBQlFVRkJRVUZCZ2tKQ1FVSkJRa0pDUVVFQmdZT0JnRUdBUVlCQ1FrSkNRa0pDUWtKQ1FrSkJnRUJDUWtKQ1FFQkJBUUJCUVlBQlFNQkFBRUc3UXViQW44QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVFQUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FBUXQvQUVHQWtRUUxmd0JCZ0xnQkMzOEFRWURKQlF0L0FFR0EyQVVMZndCQmdLRUxDMzhBUVlDQURBdC9BRUdBb1JjTGZ3QkJnSUFKQzM4QVFZQ2hJQXQvQUVHQStBQUxmd0JCZ0pBRUMzOEFRWUNKSFF0L0FFR0FtU0VMZndCQmdJQUlDMzhBUVlDWktRdC9BRUdBZ0FnTGZ3QkJnSmt4QzM4QVFZQ0FDQXQvQUVHQW1Ua0xmd0JCZ0lBSUMzOEFRWUNad1FBTGZ3QkJnSUFJQzM4QVFZQ1p5UUFMZndCQmdJQUlDMzhBUVlDWjBRQUxmd0JCZ0JRTGZ3QkJnSzNSQUF0L0FFR0FpUGdEQzM4QVFZQzF5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnTFhOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR0FBZ3QvQVVFQUN3ZndFR1VHYldWdGIzSjVBZ0FIWDE5aGJHeHZZd0FRQ0Y5ZmNtVjBZV2x1QUJJSlgxOXlaV3hsWVhObEFCb0pYMTlqYjJ4c1pXTjBBQXdMWDE5eWRIUnBYMkpoYzJVRG1RSUdZMjl1Wm1sbkFEUU9hR0Z6UTI5eVpWTjBZWEowWldRQU5RbHpZWFpsVTNSaGRHVUFQQWxzYjJGa1UzUmhkR1VBUndWcGMwZENRd0JJRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFCSkMyZGxkRk4wWlhCVFpYUnpBRW9JWjJWMFUzUmxjSE1BU3hWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUExQUVNWlhobFkzVjBaVVp5WVcxbEFOTUJDVjlmYzJWMFlYSm5Zd0Q4QVJsbGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2QVBzQkZXVjRaV04xZEdWVmJuUnBiRU52Ym1ScGRHbHZiZ0Q5QVF0bGVHVmpkWFJsVTNSbGNBRFFBUlJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFEVkFReG5aWFJEZVdOc1pWTmxkSE1BMWdFSloyVjBRM2xqYkdWekFOY0JEbk5sZEVwdmVYQmhaRk4wWVhSbEFOd0JIMmRsZEU1MWJXSmxjazltVTJGdGNHeGxjMGx1UVhWa2FXOUNkV1ptWlhJQTBRRVFZMnhsWVhKQmRXUnBiMEoxWm1abGNnQkRISE5sZEUxaGJuVmhiRU52Ykc5eWFYcGhkR2x2YmxCaGJHVjBkR1VBSWhkWFFWTk5RazlaWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ014RTFkQlUwMUNUMWxmVFVWTlQxSlpYMU5KV2tVRE1oSlhRVk5OUWs5WlgxZEJVMDFmVUVGSFJWTURNeDVCVTFORlRVSk1XVk5EVWtsUVZGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJScEJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVTBsYVJRTUdGbGRCVTAxQ1QxbGZVMVJCVkVWZlRFOURRVlJKVDA0REJ4SlhRVk5OUWs5WlgxTlVRVlJGWDFOSldrVURDQ0JIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTVBIRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VERUJKV1NVUkZUMTlTUVUxZlRFOURRVlJKVDA0RENRNVdTVVJGVDE5U1FVMWZVMGxhUlFNS0VWZFBVa3RmVWtGTlgweFBRMEZVU1U5T0F3c05WMDlTUzE5U1FVMWZVMGxhUlFNTUprOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMHhQUTBGVVNVOU9BdzBpVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1PR0VkU1FWQklTVU5UWDA5VlZGQlZWRjlNVDBOQlZFbFBUZ01kRkVkU1FWQklTVU5UWDA5VlZGQlZWRjlUU1ZwRkF4NFVSMEpEWDFCQlRFVlVWRVZmVEU5RFFWUkpUMDRERVJCSFFrTmZVRUZNUlZSVVJWOVRTVnBGQXhJWVFrZGZVRkpKVDFKSlZGbGZUVUZRWDB4UFEwRlVTVTlPQXhNVVFrZGZVRkpKVDFKSlZGbGZUVUZRWDFOSldrVURGQTVHVWtGTlJWOU1UME5CVkVsUFRnTVZDa1pTUVUxRlgxTkpXa1VERmhkQ1FVTkxSMUpQVlU1RVgwMUJVRjlNVDBOQlZFbFBUZ01YRTBKQlEwdEhVazlWVGtSZlRVRlFYMU5KV2tVREdCSlVTVXhGWDBSQlZFRmZURTlEUVZSSlQwNERHUTVVU1V4RlgwUkJWRUZmVTBsYVJRTWFFazlCVFY5VVNVeEZVMTlNVDBOQlZFbFBUZ01iRGs5QlRWOVVTVXhGVTE5VFNWcEZBeHdWUVZWRVNVOWZRbFZHUmtWU1gweFBRMEZVU1U5T0F5Y1JRVlZFU1U5ZlFsVkdSa1ZTWDFOSldrVURLQmxEU0VGT1RrVk1YekZmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeDhWUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlUU1ZwRkF5QVpRMGhCVGs1RlRGOHlYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWhGVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZVMGxhUlFNaUdVTklRVTVPUlV4Zk0xOUNWVVpHUlZKZlRFOURRVlJKVDA0REl4VkRTRUZPVGtWTVh6TmZRbFZHUmtWU1gxTkpXa1VESkJsRFNFRk9Ua1ZNWHpSZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlVVlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5VFNWcEZBeVlXUTBGU1ZGSkpSRWRGWDFKQlRWOU1UME5CVkVsUFRnTXBFa05CVWxSU1NVUkhSVjlTUVUxZlUwbGFSUU1xRVVKUFQxUmZVazlOWDB4UFEwRlVTVTlPQXlzTlFrOVBWRjlTVDAxZlUwbGFSUU1zRmtOQlVsUlNTVVJIUlY5U1QwMWZURTlEUVZSSlQwNERMUkpEUVZKVVVrbEVSMFZmVWs5TlgxTkpXa1VETGgxRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXZHVVJGUWxWSFgwZEJUVVZDVDFsZlRVVk5UMUpaWDFOSldrVURNQ0ZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFIQnR6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBM1FFZGNtVnpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUEzZ0VaYzJWMFVtVmhaRWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURmQVJ0eVpYTmxkRkpsWVdSSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTRBRWFjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUE0UUVjY21WelpYUlhjbWwwWlVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFEaUFReG5aWFJTWldkcGMzUmxja0VBNHdFTVoyVjBVbVZuYVhOMFpYSkNBT1FCREdkbGRGSmxaMmx6ZEdWeVF3RGxBUXhuWlhSU1pXZHBjM1JsY2tRQTVnRU1aMlYwVW1WbmFYTjBaWEpGQU9jQkRHZGxkRkpsWjJsemRHVnlTQURvQVF4blpYUlNaV2RwYzNSbGNrd0E2UUVNWjJWMFVtVm5hWE4wWlhKR0FPb0JFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBT3NCRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0RzQVJsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QU8wQkJXZGxkRXhaQU80QkhXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBTzhCR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUUR3QVJOa2NtRjNUMkZ0Vkc5WFlYTnRUV1Z0YjNKNUFQRUJCbWRsZEVSSlZnRHlBUWRuWlhSVVNVMUJBUE1CQm1kbGRGUk5RUUQwQVFablpYUlVRVU1BOVFFVGRYQmtZWFJsUkdWaWRXZEhRazFsYlc5eWVRRDJBUWdDOXdFS2hac0MvUUdnQWdFRWZ5QUJLQUlBSWdOQkFYRkZCRUJCQUVFWVFaVUNRUTBRQUFBTElBTkJmSEVpQWtFUVR3Ui9JQUpCOFAvLy93TkpCVUVBQzBVRVFFRUFRUmhCbHdKQkRSQUFBQXNnQWtHQUFra0VmeUFDUVFSMklRSkJBQVVnQWtFZklBSm5heUlEUVFScmRrRVFjeUVDSUFOQkIyc0xJZ05CRjBrRWZ5QUNRUkJKQlVFQUMwVUVRRUVBUVJoQnBBSkJEUkFBQUFzZ0FTZ0NGQ0VFSUFFb0FoQWlCUVJBSUFVZ0JEWUNGQXNnQkFSQUlBUWdCVFlDRUFzZ0EwRUVkQ0FDYWtFQ2RDQUFhaWdDWUNBQlJnUkFJQU5CQkhRZ0FtcEJBblFnQUdvZ0JEWUNZQ0FFUlFSQUlBTkJBblFnQUdvZ0EwRUNkQ0FBYWlnQ0JFRUJJQUowUVg5emNTSUJOZ0lFSUFGRkJFQWdBQ0FBS0FJQVFRRWdBM1JCZjNOeE5nSUFDd3NMQy8wREFRWi9JQUZGQkVCQkFFRVlRYzBCUVEwUUFBQUxJQUVvQWdBaUEwRUJjVVVFUUVFQVFSaEJ6d0ZCRFJBQUFBc2dBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJZ1ZCQVhFRVFDQURRWHh4UVJCcUlBVkJmSEZxSWdKQjhQLy8vd05KQkVBZ0FDQUVFQUVnQVNBRFFRTnhJQUp5SWdNMkFnQWdBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJUVVMQ3lBRFFRSnhCRUFnQVVFRWF5Z0NBQ0lDS0FJQUlnWkJBWEZGQkVCQkFFRVlRZVFCUVE4UUFBQUxJQVpCZkhGQkVHb2dBMEY4Y1dvaUIwSHcvLy8vQTBrRWZ5QUFJQUlRQVNBQ0lBWkJBM0VnQjNJaUF6WUNBQ0FDQlNBQkN5RUJDeUFFSUFWQkFuSTJBZ0FnQTBGOGNTSUNRUkJQQkg4Z0FrSHcvLy8vQTBrRlFRQUxSUVJBUVFCQkdFSHpBVUVORUFBQUN5QUVJQUZCRUdvZ0FtcEhCRUJCQUVFWVFmUUJRUTBRQUFBTElBUkJCR3NnQVRZQ0FDQUNRWUFDU1FSL0lBSkJCSFloQkVFQUJTQUNRUjhnQW1kcklnSkJCR3QyUVJCeklRUWdBa0VIYXdzaUEwRVhTUVIvSUFSQkVFa0ZRUUFMUlFSQVFRQkJHRUdFQWtFTkVBQUFDeUFEUVFSMElBUnFRUUowSUFCcUtBSmdJUUlnQVVFQU5nSVFJQUVnQWpZQ0ZDQUNCRUFnQWlBQk5nSVFDeUFEUVFSMElBUnFRUUowSUFCcUlBRTJBbUFnQUNBQUtBSUFRUUVnQTNSeU5nSUFJQU5CQW5RZ0FHb2dBMEVDZENBQWFpZ0NCRUVCSUFSMGNqWUNCQXZMQVFFQ2Z5QUNRUTl4UlVFQUlBRkJEM0ZGUVFBZ0FTQUNUUnNiUlFSQVFRQkJHRUdDQTBFRUVBQUFDeUFBS0FLZ0RDSURCRUFnQVNBRFFSQnFTUVJBUVFCQkdFR01BMEVQRUFBQUN5QUJRUkJySUFOR0JFQWdBeWdDQUNFRUlBRkJFR3NoQVFzRklBRWdBRUdrREdwSkJFQkJBRUVZUVpnRFFRUVFBQUFMQ3lBQ0lBRnJJZ0pCTUVrRVFBOExJQUVnQkVFQ2NTQUNRU0JyUVFGeWNqWUNBQ0FCUVFBMkFoQWdBVUVBTmdJVUlBRWdBbXBCRUdzaUFrRUNOZ0lBSUFBZ0FqWUNvQXdnQUNBQkVBSUxsd0VCQW45QkFUOEFJZ0JLQkg5QkFTQUFhMEFBUVFCSUJVRUFDd1JBQUF0Qm9BSkJBRFlDQUVIQURrRUFOZ0lBUVFBaEFBTkFBa0FnQUVFWFR3MEFJQUJCQW5SQm9BSnFRUUEyQWdSQkFDRUJBMEFDUUNBQlFSQlBEUUFnQUVFRWRDQUJha0VDZEVHZ0FtcEJBRFlDWUNBQlFRRnFJUUVNQVFzTElBQkJBV29oQUF3QkN3dEJvQUpCMEE0L0FFRVFkQkFEUWFBQ0pBQUxMUUFnQUVIdy8vLy9BMDhFUUVISUFFRVlRY2tEUVIwUUFBQUxJQUJCRDJwQmNIRWlBRUVRSUFCQkVFc2JDOTBCQVFGL0lBRkJnQUpKQkg4Z0FVRUVkaUVCUVFBRklBRkIrUC8vL3dGSkJFQkJBVUViSUFGbmEzUWdBV3BCQVdzaEFRc2dBVUVmSUFGbmF5SUNRUVJyZGtFUWN5RUJJQUpCQjJzTElnSkJGMGtFZnlBQlFSQkpCVUVBQzBVRVFFRUFRUmhCMGdKQkRSQUFBQXNnQWtFQ2RDQUFhaWdDQkVGL0lBRjBjU0lCQkg4Z0FXZ2dBa0VFZEdwQkFuUWdBR29vQW1BRklBQW9BZ0JCZnlBQ1FRRnFkSEVpQVFSL0lBRm9JZ0ZCQW5RZ0FHb29BZ1FpQWtVRVFFRUFRUmhCM3dKQkVSQUFBQXNnQW1nZ0FVRUVkR3BCQW5RZ0FHb29BbUFGUVFBTEN3czdBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FGSEJFQWdBQ0FCUWYvLy8vOTRjVUdBZ0lDQUFYSTJBZ1FnQUVFUWFrRUNFUGtCQ3dzdEFRRi9JQUVvQWdBaUFrRUJjUVJBUVFCQkdFR3pCRUVDRUFBQUN5QUJJQUpCQVhJMkFnQWdBQ0FCRUFJTEhRQWdBQ0FBS0FJRVFmLy8vLzk0Y1RZQ0JDQUFRUkJxUVFRUStRRUxUd0VCZnlBQUtBSUVJZ0ZCZ0lDQWdBZHhRWUNBZ0lBQlJnUkFJQUZCLy8vLy93QnhRUUJMQkVBZ0FCQUpCU0FBSUFGQi8vLy8vM2h4UVlDQWdJQUNjallDQkNBQVFSQnFRUU1RK1FFTEN3dEtBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FKR0JIOGdBVUdBZ0lDQWVIRkZCVUVBQ3dSQUlBQWdBVUgvLy8vL2VIRTJBZ1FnQUVFUWFrRUZFUGtCSXdBZ0FCQUlDd3Z6QVFFR2Z5TUNJZ1VpQWlFREl3TWhBQU5BQWtBZ0F5QUFUdzBBSUFNb0FnQWlCQ2dDQkNJQlFZQ0FnSUFIY1VHQWdJQ0FBMFlFZnlBQlFmLy8vLzhBY1VFQVN3VkJBQXNFUUNBRUVBY2dBaUFFTmdJQUlBSkJCR29oQWdWQkFDQUJRZi8vLy84QWNVVWdBVUdBZ0lDQUIzRWJCRUFqQUNBRUVBZ0ZJQVFnQVVILy8vLy9CM0UyQWdRTEN5QURRUVJxSVFNTUFRc0xJQUlrQXlBRklRQURRQUpBSUFBZ0FrOE5BQ0FBS0FJQUVBb2dBRUVFYWlFQURBRUxDeUFGSVFBRFFBSkFJQUFnQWs4TkFDQUFLQUlBSWdFZ0FTZ0NCRUgvLy8vL0IzRTJBZ1FnQVJBTElBQkJCR29oQUF3QkN3c2dCU1FEQzI4QkFYOC9BQ0lDSUFGQitQLy8vd0ZKQkg5QkFVRWJJQUZuYTNSQkFXc2dBV29GSUFFTFFSQWdBQ2dDb0F3Z0FrRVFkRUVRYTBkMGFrSC8vd05xUVlDQWZIRkJFSFlpQVNBQ0lBRktHMEFBUVFCSUJFQWdBVUFBUVFCSUJFQUFDd3NnQUNBQ1FSQjBQd0JCRUhRUUF3dUhBUUVDZnlBQktBSUFJUU1nQWtFUGNRUkFRUUJCR0VIdEFrRU5FQUFBQ3lBRFFYeHhJQUpySWdSQklFOEVRQ0FCSUFOQkFuRWdBbkkyQWdBZ0FVRVFhaUFDYWlJQklBUkJFR3RCQVhJMkFnQWdBQ0FCRUFJRklBRWdBMEYrY1RZQ0FDQUJRUkJxSUFFb0FnQkJmSEZxSUFGQkVHb2dBU2dDQUVGOGNXb29BZ0JCZlhFMkFnQUxDNUVCQVFKL0l3RUVRRUVBUVJoQjVnTkJEUkFBQUFzZ0FDQUJFQVVpQXhBR0lnSkZCRUJCQVNRQkVBeEJBQ1FCSUFBZ0F4QUdJZ0pGQkVBZ0FDQURFQTBnQUNBREVBWWlBa1VFUUVFQVFSaEI4Z05CRXhBQUFBc0xDeUFDS0FJQVFYeHhJQU5KQkVCQkFFRVlRZm9EUVEwUUFBQUxJQUpCQURZQ0JDQUNJQUUyQWd3Z0FDQUNFQUVnQUNBQ0lBTVFEaUFDQ3lJQkFYOGpBQ0lDQkg4Z0FnVVFCQ01BQ3lBQUVBOGlBQ0FCTmdJSUlBQkJFR29MVVFFQmZ5QUFLQUlFSWdGQmdJQ0FnSDl4SUFGQkFXcEJnSUNBZ0g5eFJ3UkFRUUJCZ0FGQjZBQkJBaEFBQUFzZ0FDQUJRUUZxTmdJRUlBQW9BZ0JCQVhFRVFFRUFRWUFCUWVzQVFRMFFBQUFMQ3hRQUlBQkJuQUpMQkVBZ0FFRVFheEFSQ3lBQUN5Y0FJQUJCZ0FJb0FnQkxCRUJCc0FGQjZBRkJGa0ViRUFBQUN5QUFRUU4wUVlRQ2FpZ0NBQXZFREFFRGZ3TkFJQUZCQTNGQkFDQUNHd1JBSUFBaUEwRUJhaUVBSUFFaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRRnJJUUlNQVFzTElBQkJBM0ZGQkVBRFFDQUNRUkJKUlFSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FFRUlhaUFCUVFocUtBSUFOZ0lBSUFCQkRHb2dBVUVNYWlnQ0FEWUNBQ0FCUVJCcUlRRWdBRUVRYWlFQUlBSkJFR3NoQWd3QkN3c2dBa0VJY1FSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FVRUlhaUVCSUFCQkNHb2hBQXNnQWtFRWNRUkFJQUFnQVNnQ0FEWUNBQ0FCUVFScUlRRWdBRUVFYWlFQUN5QUNRUUp4QkVBZ0FDQUJMd0VBT3dFQUlBRkJBbW9oQVNBQVFRSnFJUUFMSUFKQkFYRUVRQ0FBSUFFdEFBQTZBQUFMRHdzZ0FrRWdUd1JBQWtBQ1FBSkFJQUJCQTNFaUEwRUJSd1JBSUFOQkFrWU5BU0FEUVFOR0RRSU1Bd3NnQVNnQ0FDRUZJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFOcklRSURRQ0FDUVJGSlJRUkFJQUFnQVVFQmFpZ0NBQ0lEUVFoMElBVkJHSFp5TmdJQUlBQkJCR29nQTBFWWRpQUJRUVZxS0FJQUlnTkJDSFJ5TmdJQUlBQkJDR29nQTBFWWRpQUJRUWxxS0FJQUlnTkJDSFJ5TmdJQUlBQkJER29nQVVFTmFpZ0NBQ0lGUVFoMElBTkJHSFp5TmdJQUlBRkJFR29oQVNBQVFSQnFJUUFnQWtFUWF5RUNEQUVMQ3d3Q0N5QUJLQUlBSVFVZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRSnJJUUlEUUNBQ1FSSkpSUVJBSUFBZ0FVRUNhaWdDQUNJRFFSQjBJQVZCRUhaeU5nSUFJQUJCQkdvZ0EwRVFkaUFCUVFacUtBSUFJZ05CRUhSeU5nSUFJQUJCQ0dvZ0EwRVFkaUFCUVFwcUtBSUFJZ05CRUhSeU5nSUFJQUJCREdvZ0FVRU9haWdDQUNJRlFSQjBJQU5CRUhaeU5nSUFJQUZCRUdvaEFTQUFRUkJxSVFBZ0FrRVFheUVDREFFTEN3d0JDeUFCS0FJQUlRVWdBQ0lEUVFGcUlRQWdBU0lFUVFGcUlRRWdBeUFFTFFBQU9nQUFJQUpCQVdzaEFnTkFJQUpCRTBsRkJFQWdBQ0FCUVFOcUtBSUFJZ05CR0hRZ0JVRUlkbkkyQWdBZ0FFRUVhaUFEUVFoMklBRkJCMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRUlhaUFEUVFoMklBRkJDMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRU1haUFCUVE5cUtBSUFJZ1ZCR0hRZ0EwRUlkbkkyQWdBZ0FVRVFhaUVCSUFCQkVHb2hBQ0FDUVJCcklRSU1BUXNMQ3dzZ0FrRVFjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlEUVFGcUlRQWdBVUVCYWlJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBQ3lBQ1FRaHhCRUFnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUVjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJRFFRRnFJUUFnQVVFQmFpSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUN5QUNRUUp4QkVBZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUJjUVJBSUFBZ0FTMEFBRG9BQUFzTDBnSUJBbjhDUUNBQ0lRTWdBQ0FCUmcwQVFRRWdBQ0FEYWlBQlRTQUJJQU5xSUFCTkd3UkFJQUFnQVNBREVCUU1BUXNnQUNBQlNRUkFJQUZCQjNFZ0FFRUhjVVlFUUFOQUlBQkJCM0VFUUNBRFJRMEVJQU5CQVdzaEF5QUFJZ0pCQVdvaEFDQUJJZ1JCQVdvaEFTQUNJQVF0QUFBNkFBQU1BUXNMQTBBZ0EwRUlTVVVFUUNBQUlBRXBBd0EzQXdBZ0EwRUlheUVESUFCQkNHb2hBQ0FCUVFocUlRRU1BUXNMQ3dOQUlBTUVRQ0FBSWdKQkFXb2hBQ0FCSWdSQkFXb2hBU0FDSUFRdEFBQTZBQUFnQTBFQmF5RUREQUVMQ3dVZ0FVRUhjU0FBUVFkeFJnUkFBMEFnQUNBRGFrRUhjUVJBSUFORkRRUWdBQ0FEUVFGcklnTnFJQUVnQTJvdEFBQTZBQUFNQVFzTEEwQWdBMEVJU1VVRVFDQUFJQU5CQ0dzaUEyb2dBU0FEYWlrREFEY0RBQXdCQ3dzTEEwQWdBd1JBSUFBZ0EwRUJheUlEYWlBQklBTnFMUUFBT2dBQURBRUxDd3NMQ3pnQUl3QkZCRUJCQUVFWVFkRUVRUTBRQUFBTElBQkJEM0ZGUVFBZ0FCdEZCRUJCQUVFWVFkSUVRUUlRQUFBTEl3QWdBRUVRYXhBSUMwVUJCSDhqQXlNQ0lnRnJJZ0pCQVhRaUFFR0FBaUFBUVlBQ1N4c2lBMEVBRUJBaUFDQUJJQUlRRlNBQkJFQWdBUkFXQ3lBQUpBSWdBQ0FDYWlRRElBQWdBMm9rQkFzaUFRRi9Jd01pQVNNRVR3UkFFQmNqQXlFQkN5QUJJQUEyQWdBZ0FVRUVhaVFEQzdZQkFRSi9JQUFvQWdRaUFrSC8vLy8vQUhFaEFTQUFLQUlBUVFGeEJFQkJBRUdBQVVIekFFRU5FQUFBQ3lBQlFRRkdCRUFnQUVFUWFrRUJFUGtCSUFKQmdJQ0FnSGh4QkVBZ0FFR0FnSUNBZURZQ0JBVWpBQ0FBRUFnTEJTQUJRUUJOQkVCQkFFR0FBVUg4QUVFUEVBQUFDeUFBS0FJSUVCTkJFSEVFUUNBQUlBRkJBV3NnQWtHQWdJQ0FmM0Z5TmdJRUJTQUFJQUZCQVd0QmdJQ0FnSHR5TmdJRUlBSkJnSUNBZ0hoeFJRUkFJQUFRR0FzTEN3c1NBQ0FBUVp3Q1N3UkFJQUJCRUdzUUdRc0xVd0JCOHVYTEJ5UStRYURCZ2dVa1AwSFlzT0VDSkVCQmlKQWdKRUZCOHVYTEJ5UkNRYURCZ2dVa1EwSFlzT0VDSkVSQmlKQWdKRVZCOHVYTEJ5UkdRYURCZ2dVa1IwSFlzT0VDSkVoQmlKQWdKRWtMbHdJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJESFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPREFJQ0F3TURBd1FFQlFVR0J3QUxEQWNMSTRBQ0JFQWpnUUlFUUNBQVFZQUNTQTBKSUFCQmdCSklRUUFnQUVIL0Ewb2JEUWtGUVFBZ0FFR0FBa2dqZ1FJYkRRa0xDd3NnQUVHQXJkRUFhZzhMSUFCQkFTUHlBU0lBUVFBZ0FFVWorZ0ViRzBFT2RHcEJnSzNRQUdvUEN5QUFRWUNRZm1vamdRSUVmMEhQL2dNUUhVRUJjUVZCQUF0QkRYUnFEd3NnQUNQekFVRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5T0JBZ1JBUWZEK0F4QWRRUWR4SVFFTElBRkJBVWdMQkg5QkFRVWdBUXRCREhRZ0FHcEJnUEI5YWc4TElBQkJnRkJxRHdzZ0FFR0FtZEVBYWdzSkFDQUFFQnd0QUFBTHd3RUFRUUFrZ2dKQkFDU0RBa0VBSklRQ1FRQWtoUUpCQUNTR0FrRUFKSWNDUVFBa2lBSkJBQ1NKQWtFQUpJb0NRUUFraXdKQkFDU01Ba0VBSkkwQ1FRQWtqZ0pCQUNTUEFrRUFKSkFDUVFBa2tRSWpnQUlFUUE4TEk0RUNCRUJCRVNTREFrR0FBU1NLQWtFQUpJUUNRUUFraFFKQi93RWtoZ0pCMWdBa2h3SkJBQ1NJQWtFTkpJa0NCVUVCSklNQ1FiQUJKSW9DUVFBa2hBSkJFeVNGQWtFQUpJWUNRZGdCSkljQ1FRRWtpQUpCelFBa2lRSUxRWUFDSkl3Q1FmNy9BeVNMQWdzTEFDQUFFQndnQVRvQUFBdHpBUUYvUVFBazlBRkJBU1QxQVVISEFoQWRJZ0JGSlBZQklBQkJBMHhCQUNBQVFRRk9HeVQzQVNBQVFRWk1RUUFnQUVFRlRoc2srQUVnQUVFVFRFRUFJQUJCRDA0YkpQa0JJQUJCSGt4QkFDQUFRUmxPR3lUNkFVRUJKUElCUVFBazh3RkJ6LzREUVFBUUgwSHcvZ05CQVJBZkN5OEFRZEgrQTBIL0FSQWZRZEwrQTBIL0FSQWZRZFArQTBIL0FSQWZRZFQrQTBIL0FSQWZRZFgrQTBIL0FSQWZDN0FJQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdzREJBVUdCd2dKQ2dzTURRQUxEQTBMUWZMbHl3Y2tQa0dnd1lJRkpEOUIyTERoQWlSQVFZaVFJQ1JCUWZMbHl3Y2tRa0dnd1lJRkpFTkIyTERoQWlSRVFZaVFJQ1JGUWZMbHl3Y2tSa0dnd1lJRkpFZEIyTERoQWlSSVFZaVFJQ1JKREF3TFFmLy8vd2NrUGtIajJ2NEhKRDlCZ09LUUJDUkFRUUFrUVVILy8vOEhKRUpCNDlyK0J5UkRRWURpa0FRa1JFRUFKRVZCLy8vL0J5UkdRZVBhL2dja1IwR0E0cEFFSkVoQkFDUkpEQXNMUWYvLy93Y2tQa0dFaWY0SEpEOUJ1dlRRQkNSQVFRQWtRVUgvLy84SEpFSkJzZjd2QXlSRFFZQ0lBaVJFUVFBa1JVSC8vLzhISkVaQi84dU9BeVJIUWY4QkpFaEJBQ1JKREFvTFFjWE4vd2NrUGtHRXVib0dKRDlCcWRhUkJDUkFRWWppNkFJa1FVSC8vLzhISkVKQjQ5citCeVJEUVlEaWtBUWtSRUVBSkVWQi8vLy9CeVJHUWVQYS9nY2tSMEdBNHBBRUpFaEJBQ1JKREFrTFFmLy8vd2NrUGtHQS9zc0NKRDlCZ0lUOUJ5UkFRUUFrUVVILy8vOEhKRUpCZ1A3TEFpUkRRWUNFL1Fja1JFRUFKRVZCLy8vL0J5UkdRWUQreXdJa1IwR0FoUDBISkVoQkFDUkpEQWdMUWYvLy93Y2tQa0d4L3U4REpEOUJ4Y2NCSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQmhJbitCeVJIUWJyMDBBUWtTRUVBSkVrTUJ3dEJBQ1ErUVlTSkFpUS9RWUM4L3dja1FFSC8vLzhISkVGQkFDUkNRWVNKQWlSRFFZQzgvd2NrUkVILy8vOEhKRVZCQUNSR1FZU0pBaVJIUVlDOC93Y2tTRUgvLy84SEpFa01CZ3RCcGYvL0J5UStRWlNwL2dja1AwSC9xZElFSkVCQkFDUkJRYVgvL3dja1FrR1VxZjRISkVOQi82blNCQ1JFUVFBa1JVR2wvLzhISkVaQmxLbitCeVJIUWYrcDBnUWtTRUVBSkVrTUJRdEIvLy8vQnlRK1FZRCsvd2NrUDBHQWdQd0hKRUJCQUNSQlFmLy8vd2NrUWtHQS92OEhKRU5CZ0lEOEJ5UkVRUUFrUlVILy8vOEhKRVpCZ1A3L0J5UkhRWUNBL0Fja1NFRUFKRWtNQkF0Qi8vLy9CeVErUVlEKy93Y2tQMEdBbE8wREpFQkJBQ1JCUWYvLy93Y2tRa0gveTQ0REpFTkIvd0VrUkVFQUpFVkIvLy8vQnlSR1FiSCs3d01rUjBHQWlBSWtTRUVBSkVrTUF3dEIvLy8vQnlRK1FmL0xqZ01rUDBIL0FTUkFRUUFrUVVILy8vOEhKRUpCaEluK0J5UkRRYnIwMEFRa1JFRUFKRVZCLy8vL0J5UkdRYkgrN3dNa1IwR0FpQUlrU0VFQUpFa01BZ3RCLy8vL0J5UStRZDZac2dRa1AwR01wY2tDSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUFRdEIvLy8vQnlRK1FhWExsZ1VrUDBIU3BNa0NKRUJCQUNSQlFmLy8vd2NrUWtHbHk1WUZKRU5CMHFUSkFpUkVRUUFrUlVILy8vOEhKRVpCcGN1V0JTUkhRZEtreVFJa1NFRUFKRWtMQzlvSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZZ0JSd1JBSUFCQjRRQkdEUUVnQUVFVVJnMENJQUJCeGdCR0RRTWdBRUhaQUVZTkJDQUFRY1lCUmcwRUlBQkJoZ0ZHRFFVZ0FFR29BVVlOQlNBQVFiOEJSZzBHSUFCQnpnRkdEUVlnQUVIUkFVWU5CaUFBUWZBQlJnMEdJQUJCSjBZTkJ5QUFRY2tBUmcwSElBQkIzQUJHRFFjZ0FFR3pBVVlOQnlBQVFja0JSZzBJSUFCQjhBQkdEUWtnQUVIR0FFWU5DaUFBUWRNQlJnMExEQXdMUWYrNWxnVWtQa0dBL3Y4SEpEOUJnTVlCSkVCQkFDUkJRZis1bGdVa1FrR0EvdjhISkVOQmdNWUJKRVJCQUNSRlFmKzVsZ1VrUmtHQS92OEhKRWRCZ01ZQkpFaEJBQ1JKREFzTFFmLy8vd2NrUGtIL3k0NERKRDlCL3dFa1FFRUFKRUZCLy8vL0J5UkNRWVNKL2dja1EwRzY5TkFFSkVSQkFDUkZRZi8vL3dja1JrSC95NDRESkVkQi93RWtTRUVBSkVrTUNndEIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHeC91OERKRU5CZ0lnQ0pFUkJBQ1JGUWYvLy93Y2tSa0dFaWY0SEpFZEJ1dlRRQkNSSVFRQWtTUXdKQzBILzY5WUZKRDVCbFAvL0J5US9RY0swdFFVa1FFRUFKRUZCQUNSQ1FmLy8vd2NrUTBHRWlmNEhKRVJCdXZUUUJDUkZRUUFrUmtILy8vOEhKRWRCaEluK0J5UklRYnIwMEFRa1NRd0lDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FZRG0vUWNrUTBHQWhORUVKRVJCQUNSRlFmLy8vd2NrUmtILysrb0NKRWRCZ0lEOEJ5UklRZjhCSkVrTUJ3dEJuUC8vQnlRK1FmL3IwZ1FrUDBIenFJNERKRUJCdXZRQUpFRkJ3b3IvQnlSQ1FZQ3Mvd2NrUTBHQTlOQUVKRVJCZ0lDb0FpUkZRZi8vL3dja1JrR0VpZjRISkVkQnV2VFFCQ1JJUVFBa1NRd0dDMEdBL3E4REpENUIvLy8vQnlRL1FjcWsvUWNrUUVFQUpFRkIvLy8vQnlSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUJRdEIvN21XQlNRK1FZRCsvd2NrUDBHQXhnRWtRRUVBSkVGQjBzYjlCeVJDUVlDQTJBWWtRMEdBZ0l3REpFUkJBQ1JGUWY4QkpFWkIvLy8vQnlSSFFmdisvd2NrU0VIL2lRSWtTUXdFQzBITy8vOEhKRDVCNzkrUEF5US9RYkdJOGdRa1FFSGF0T2tDSkVGQi8vLy9CeVJDUVlEbS9RY2tRMEdBaE5FRUpFUkJBQ1JGUWYvLy93Y2tSa0gveTQ0REpFZEIvd0VrU0VFQUpFa01Bd3RCLy8vL0J5UStRWVNKL2dja1AwRzY5TkFFSkVCQkFDUkJRZi8vL3dja1FrR0EvZ01rUTBHQWlNWUJKRVJCZ0pRQkpFVkIvLy8vQnlSR1FmL0xqZ01rUjBIL0FTUklRUUFrU1F3Q0MwSC8vLzhISkQ1Qi84dU9BeVEvUWY4QkpFQkJBQ1JCUVlEKy93Y2tRa0dBZ1B3SEpFTkJnSUNNQXlSRVFRQWtSVUgvLy84SEpFWkJzZjd2QXlSSFFZQ0lBaVJJUVFBa1NRd0JDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FlUGEvZ2NrUTBIajJ2NEhKRVJCQUNSRlFmLy8vd2NrUmtIL3k0NERKRWRCL3dFa1NFRUFKRWtMQzBvQkFuOUJBQkFpSTRFQ0JFQVBDeU9BQWdSQUk0RUNSUVJBRHdzTFFiUUNJUUFEUUFKQUlBQkJ3d0pLRFFBZ0FCQWRJQUZxSVFFZ0FFRUJhaUVBREFFTEN5QUJRZjhCY1JBakM5d0JBRUVBSk9zQlFRQWs3QUZCQUNUdEFVRUFKTzRCUVFBazd3RkJBQ1R3QVVFQUpQRUJRWkFCSk8wQkk0RUNCRUJCd2Y0RFFZRUJFQjlCeFA0RFFaQUJFQjlCeC80RFFmd0JFQjhGUWNIK0EwR0ZBUkFmUWNiK0EwSC9BUkFmUWNmK0EwSDhBUkFmUWNqK0EwSC9BUkFmUWNuK0EwSC9BUkFmQzBHUUFTVHRBVUhBL2dOQmtBRVFIMEhQL2dOQkFCQWZRZkQrQTBFQkVCOGpnQUlFUUNPQkFnUkFRUUFrN1FGQndQNERRUUFRSDBIQi9nTkJnQUVRSDBIRS9nTkJBQkFmQlVFQUpPMEJRY0QrQTBFQUVCOUJ3ZjREUVlRQkVCOExDeEFrQzIwQUk0RUNCRUJCNlA0RFFjQUJFQjlCNmY0RFFmOEJFQjlCNnY0RFFjRUJFQjlCNi80RFFRMFFId1ZCNlA0RFFmOEJFQjlCNmY0RFFmOEJFQjlCNnY0RFFmOEJFQjlCNi80RFFmOEJFQjhMSTRFQ1FRQWpnQUliQkVCQjZmNERRU0FRSDBIci9nTkJpZ0VRSHdzTFZnQkJrUDREUVlBQkVCOUJrZjREUWI4QkVCOUJrdjREUWZNQkVCOUJrLzREUWNFQkVCOUJsUDREUWI4QkVCOGpnQUlFUUVHUi9nTkJQeEFmUVpMK0EwRUFFQjlCay80RFFRQVFIMEdVL2dOQnVBRVFId3NMTEFCQmxmNERRZjhCRUI5Qmx2NERRVDhRSDBHWC9nTkJBQkFmUVpqK0EwRUFFQjlCbWY0RFFiZ0JFQjhMTXdCQm12NERRZjhBRUI5Qm0vNERRZjhCRUI5Qm5QNERRWjhCRUI5Qm5mNERRUUFRSDBHZS9nTkJ1QUVRSDBFQkpJWUJDeTBBUVovK0EwSC9BUkFmUWFEK0EwSC9BUkFmUWFIK0EwRUFFQjlCb3Y0RFFRQVFIMEdqL2dOQnZ3RVFId3RjQUNBQVFZQUJjVUVBUnlTdEFTQUFRY0FBY1VFQVJ5U3NBU0FBUVNCeFFRQkhKS3NCSUFCQkVIRkJBRWNrcWdFZ0FFRUljVUVBUnlTeEFTQUFRUVJ4UVFCSEpMQUJJQUJCQW5GQkFFY2tyd0VnQUVFQmNVRUFSeVN1QVF0RkFFRVBKSm9CUVE4a213RkJEeVNjQVVFUEpKMEJRUUFrbmdGQkFDU2ZBVUVBSktBQlFRQWtvUUZCL3dBa29nRkIvd0Frb3dGQkFTU2tBVUVCSktVQlFRQWtwZ0VMdlFFQVFRQWtwd0ZCQUNTb0FVRUFKS2tCUVFFa3FnRkJBU1NyQVVFQkpLd0JRUUVrclFGQkFTU3VBVUVCSks4QlFRRWtzQUZCQVNTeEFVRUJKTElCUVFBa3N3RkJBQ1MwQVVFQUpMVUJRUUFrdGdFUUp4QW9FQ2tRS2tHay9nTkI5d0FRSDBFSEpLZ0JRUWNrcVFGQnBmNERRZk1CRUI5Qjh3RVFLMEdtL2dOQjhRRVFIMEVCSkxJQkk0QUNCRUJCcFA0RFFRQVFIMEVBSktnQlFRQWtxUUZCcGY0RFFRQVFIMEVBRUN0QnB2NERRZkFBRUI5QkFDU3lBUXNRTEFzK0FDQUFRUUZ4UVFCSEpMb0JJQUJCQW5GQkFFY2t1d0VnQUVFRWNVRUFSeVM4QVNBQVFRaHhRUUJISkwwQklBQkJFSEZCQUVja3ZnRWdBQ1M1QVFzK0FDQUFRUUZ4UVFCSEpNQUJJQUJCQW5GQkFFY2t3UUVnQUVFRWNVRUFSeVRDQVNBQVFRaHhRUUJISk1NQklBQkJFSEZCQUVja3hBRWdBQ1MvQVF0NEFFRUFKTVVCUVFBa3hnRkJBQ1RIQVVFQUpNb0JRUUFreXdGQkFDVE1BVUVBSk1nQlFRQWt5UUVqZ1FJRVFFR0UvZ05CSGhBZlFhQTlKTVlCQlVHRS9nTkJxd0VRSDBITTF3SWt4Z0VMUVlmK0EwSDRBUkFmUWZnQkpNd0JJNEFDQkVBamdRSkZCRUJCaFA0RFFRQVFIMEVFSk1ZQkN3c0xRd0JCQUNUTkFVRUFKTTRCSTRFQ0JFQkJndjREUWZ3QUVCOUJBQ1RQQVVFQUpOQUJRUUFrMFFFRlFZTCtBMEgrQUJBZlFRQWt6d0ZCQVNUUUFVRUFKTkVCQ3d0MUFDT0JBZ1JBUWZEK0EwSDRBUkFmUWMvK0EwSCtBUkFmUWMzK0EwSCtBQkFmUVlEK0EwSFBBUkFmUVkvK0EwSGhBUkFmUWV6K0EwSCtBUkFmUWZYK0EwR1BBUkFmQlVIdy9nTkIvd0VRSDBIUC9nTkIvd0VRSDBITi9nTkIvd0VRSDBHQS9nTkJ6d0VRSDBHUC9nTkI0UUVRSHdzTGxnRUJBWDlCd3dJUUhTSUFRY0FCUmdSL1FRRUZJQUJCZ0FGR1FRQWpOUnNMQkVCQkFTU0JBZ1ZCQUNTQkFndEJBQ1NZQWtHQXFOYTVCeVNTQWtFQUpKTUNRUUFrbEFKQmdLald1UWNrbFFKQkFDU1dBa0VBSkpjQ0l6UUVRRUVCSklBQ0JVRUFKSUFDQ3hBZUVDQVFJUkFsRUNZUUxVRUFFQzVCLy84REk3a0JFQjlCNFFFUUwwR1AvZ01qdndFUUh4QXdFREVRTWd0S0FDQUFRUUJLSkRRZ0FVRUFTaVExSUFKQkFFb2tOaUFEUVFCS0pEY2dCRUVBU2lRNElBVkJBRW9rT1NBR1FRQktKRG9nQjBFQVNpUTdJQWhCQUVva1BDQUpRUUJLSkQwUU13c0ZBQ09ZQWd1NUFRQkJnQWdqZ3dJNkFBQkJnUWdqaEFJNkFBQkJnZ2dqaFFJNkFBQkJnd2dqaGdJNkFBQkJoQWdqaHdJNkFBQkJoUWdqaUFJNkFBQkJoZ2dqaVFJNkFBQkJod2dqaWdJNkFBQkJpQWdqaXdJN0FRQkJpZ2dqakFJN0FRQkJqQWdqalFJMkFnQkJrUWdqamdKQkFFYzZBQUJCa2dnamp3SkJBRWM2QUFCQmt3Z2prQUpCQUVjNkFBQkJsQWdqa1FKQkFFYzZBQUJCbFFnamdBSkJBRWM2QUFCQmxnZ2pnUUpCQUVjNkFBQkJsd2dqZ2dKQkFFYzZBQUFMYUFCQnlBa2o4Z0U3QVFCQnlna2o4d0U3QVFCQnpBa2o5QUZCQUVjNkFBQkJ6UWtqOVFGQkFFYzZBQUJCemdrajlnRkJBRWM2QUFCQnp3a2o5d0ZCQUVjNkFBQkIwQWtqK0FGQkFFYzZBQUJCMFFraitRRkJBRWM2QUFCQjBna2orZ0ZCQUVjNkFBQUxOUUJCK2dranhRRTJBZ0JCL2dranhnRTJBZ0JCZ2dvanlBRkJBRWM2QUFCQmhRb2p5UUZCQUVjNkFBQkJoZjRESThjQkVCOExZd0JCM2dvaldFRUFSem9BQUVIZkNpTmJOZ0lBUWVNS0kxdzJBZ0JCNXdvalhqWUNBRUhzQ2lOZk5nSUFRZkVLSTJBNkFBQkI4Z29qWVRvQUFFSDNDaU5pUVFCSE9nQUFRZmdLSTJNMkFnQkIvUW9qWkRzQkFFSC9DaU5kUVFCSE9nQUFDMGdBUVpBTEkyOUJBRWM2QUFCQmtRc2pjallDQUVHVkN5TnpOZ0lBUVprTEkzVTJBZ0JCbmdzamRqWUNBRUdqQ3lOM09nQUFRYVFMSTNnNkFBQkJwUXNqZEVFQVJ6b0FBQXRIQUVIMEN5T1JBVUVBUnpvQUFFSDFDeU9UQVRZQ0FFSDVDeU9VQVRZQ0FFSDlDeU9XQVRZQ0FFR0NEQ09YQVRZQ0FFR0hEQ09aQVRzQkFFR0pEQ09WQVVFQVJ6b0FBQXVIQVFBUU5rR3lDQ1BzQVRZQ0FFRzJDQ1BoQVRvQUFFSEUvZ01qN1FFUUgwSGtDQ08zQVVFQVJ6b0FBRUhsQ0NPNEFVRUFSem9BQUJBM0VEaEJyQW9qc3dFMkFnQkJzQW9qdEFFNkFBQkJzUW9qdFFFNkFBQVFPUkE2UWNJTEkzOUJBRWM2QUFCQnd3c2pnZ0UyQWdCQnh3c2pnd0UyQWdCQnl3c2poQUU3QVFBUU8wRUFKSmdDQzdrQkFFR0FDQzBBQUNTREFrR0JDQzBBQUNTRUFrR0NDQzBBQUNTRkFrR0RDQzBBQUNTR0FrR0VDQzBBQUNTSEFrR0ZDQzBBQUNTSUFrR0dDQzBBQUNTSkFrR0hDQzBBQUNTS0FrR0lDQzhCQUNTTEFrR0tDQzhCQUNTTUFrR01DQ2dDQUNTTkFrR1JDQzBBQUVFQVNpU09Ba0dTQ0MwQUFFRUFTaVNQQWtHVENDMEFBRUVBU2lTUUFrR1VDQzBBQUVFQVNpU1JBa0dWQ0MwQUFFRUFTaVNBQWtHV0NDMEFBRUVBU2lTQkFrR1hDQzBBQUVFQVNpU0NBZ3RlQVFGL1FRQWs3QUZCQUNUdEFVSEUvZ05CQUJBZlFjSCtBeEFkUVh4eElRRkJBQ1RoQVVIQi9nTWdBUkFmSUFBRVFBSkFRUUFoQUFOQUlBQkJnTmdGVGcwQklBQkJnTWtGYWtIL0FUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEM0SUJBUUYvSStNQklRRWdBRUdBQVhGQkFFY2s0d0VnQUVIQUFIRkJBRWNrNUFFZ0FFRWdjVUVBUnlUbEFTQUFRUkJ4UVFCSEpPWUJJQUJCQ0hGQkFFY2s1d0VnQUVFRWNVRUFSeVRvQVNBQVFRSnhRUUJISk9rQklBQkJBWEZCQUVjazZnRWo0d0ZGUVFBZ0FSc0VRRUVCRUQ0TFFRQWo0d0VnQVJzRVFFRUFFRDRMQ3lvQVFlUUlMUUFBUVFCS0pMY0JRZVVJTFFBQVFRQktKTGdCUWYvL0F4QWRFQzVCai80REVCMFFMd3RvQUVISUNTOEJBQ1R5QVVIS0NTOEJBQ1R6QVVITUNTMEFBRUVBU2lUMEFVSE5DUzBBQUVFQVNpVDFBVUhPQ1MwQUFFRUFTaVQyQVVIUENTMEFBRUVBU2lUM0FVSFFDUzBBQUVFQVNpVDRBVUhSQ1MwQUFFRUFTaVQ1QVVIU0NTMEFBRUVBU2lUNkFRdEhBRUg2Q1NnQ0FDVEZBVUgrQ1NnQ0FDVEdBVUdDQ2kwQUFFRUFTaVRJQVVHRkNpMEFBRUVBU2lUSkFVR0YvZ01RSFNUSEFVR0cvZ01RSFNUS0FVR0gvZ01RSFNUTUFRc0hBRUVBSkxZQkMyTUFRZDRLTFFBQVFRQktKRmhCM3dvb0FnQWtXMEhqQ2lnQ0FDUmNRZWNLS0FJQUpGNUI3QW9vQWdBa1gwSHhDaTBBQUNSZ1FmSUtMUUFBSkdGQjl3b3RBQUJCQUVva1lrSDRDaWdDQUNSalFmMEtMd0VBSkdSQi93b3RBQUJCQUVva1hRdElBRUdRQ3kwQUFFRUFTaVJ2UVpFTEtBSUFKSEpCbFFzb0FnQWtjMEdaQ3lnQ0FDUjFRWjRMS0FJQUpIWkJvd3N0QUFBa2QwR2tDeTBBQUNSNFFiRUxMUUFBUVFCS0pIUUxSd0JCOUFzdEFBQkJBRW9ra1FGQjlRc29BZ0Fra3dGQitRc29BZ0FrbEFGQi9Rc29BZ0FrbGdGQmdnd29BZ0FrbHdGQmh3d3ZBUUFrbVFGQmlRd3RBQUJCQUVva2xRRUx6QUVCQVg4UVBVR3lDQ2dDQUNUc0FVRzJDQzBBQUNUaEFVSEUvZ01RSFNUdEFVSEEvZ01RSFJBL0VFQkJnUDRERUIxQi93RnpKTm9CSTlvQklnQkJFSEZCQUVjazJ3RWdBRUVnY1VFQVJ5VGNBUkJCRUVKQnJBb29BZ0Frc3dGQnNBb3RBQUFrdEFGQnNRb3RBQUFrdFFGQkFDUzJBUkJFRUVWQndnc3RBQUJCQUVva2YwSERDeWdDQUNTQ0FVSEhDeWdDQUNTREFVSExDeThCQUNTRUFSQkdRUUFrbUFKQmdLald1UWNra2dKQkFDU1RBa0VBSkpRQ1FZQ28xcmtISkpVQ1FRQWtsZ0pCQUNTWEFnc0ZBQ09CQWdzRkFDT1ZBZ3NGQUNPV0Fnc0ZBQ09YQWd1eUFnRUdmeU5MSWdVZ0FFWkJBQ05LSUFSR1FRQWdBRUVJU2tFQUlBRkJBRW9iR3hzRVFDQURRUUZyRUIxQklIRkJBRWNoQ0NBREVCMUJJSEZCQUVjaENVRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQWdnQ1VjYklnY2dBR29pQTBHZ0FVd0VRQ0FCUWFBQmJDQURha0VEYkVHQXlRVnFJZ1F0QUFBaENpQUVJQW82QUFBZ0FVR2dBV3dnQTJwQkEyeEJnY2tGYWlBRUxRQUJPZ0FBSUFGQm9BRnNJQU5xUVFOc1FZTEpCV29nQkMwQUFqb0FBQ0FCUWFBQmJDQURha0dBa1FScUlBQkJBQ0FIYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQTBFRGNTSUVRUVJ5SUFRZ0EwRUVjUnM2QUFBZ0JrRUJhaUVHQ3lBSFFRRnFJUU1NQVFzTEJTQUVKRW9MSUFBZ0JVNEVRQ0FBUVFocUlnRWdBa0VIY1NJQ2FpQUJJQUFnQWtnYklRVUxJQVVrU3lBR0N5a0FJQUJCZ0pBQ1JnUkFJQUZCZ0FGcklBRkJnQUZxSUFGQmdBRnhHeUVCQ3lBQlFRUjBJQUJxQzBvQUlBQkJBM1FnQVVFQmRHb2lBRUVCYWtFL2NTSUJRVUJySUFFZ0FodEJnSkFFYWkwQUFDRUJJQUJCUDNFaUFFRkFheUFBSUFJYlFZQ1FCR290QUFBZ0FVSC9BWEZCQ0hSeUM4Z0JBQ0FCRUIwZ0FFRUJkSFZCQTNFaEFDQUJRY2orQTBZRVFDTkNJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalF5RUJEQUlMSTBRaEFRd0JDeU5GSVFFTEJTQUJRY24rQTBZRVFDTkdJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalJ5RUJEQUlMSTBnaEFRd0JDeU5KSVFFTEJTTStJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalB5RUJEQUlMSTBBaEFRd0JDeU5CSVFFTEN3c2dBUXVNQXdFR2Z5QUJJQUFRVFNBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnNGdDRWdFUUVFQUlRVUNmMEVCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUJkQ0FTY1FSQVFRSWhCUXNnQlVFQmFnc2dCVUVCSUFGMElCRnhHeUVDSTRFQ0JIOUJBU0FNUVFCT0lBdEJBRTRiQlVFQUN3Ui9JQXRCQjNFaEFTQU1RUUJPSWdVRVFDQU1RUWR4SVFFTElBRWdBaUFGRUU0aUJVRWZjVUVEZENFQklBVkI0QWR4UVFWMVFRTjBJUThnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdvUVR5SUZRWUNBL0FkeFFSQjFJUUVnQlVHQS9nTnhRUWgxSVE4Z0JVSC9BWEVMSVFVZ0J5QUliQ0FPYWtFRGJDQUphaUlRSUFFNkFBQWdFRUVCYWlBUE9nQUFJQkJCQW1vZ0JUb0FBQ0FIUWFBQmJDQU9ha0dBa1FScUlBSkJBM0VpQVVFRWNpQUJJQXRCZ0FGeFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzM0QkEzOGdBMEVIY1NFRFFRQWdBaUFDUVFOMVFRTjBheUFBR3lFSFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRaEJmeUVDSTRFQ0JFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hGQkFFY2hDU0FDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRVUF1aEFnRUJmeUFEUVFkeElRTWdCU0FHRUUwZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ1ZCZ0pCK2FpQUVRUWh4UVFCSElnWkJEWFJxTFFBQUlRY2dBa0VIY1NFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2Z5QUZRWUdRZm1vZ0JrRUJjVUVOZEdvdEFBQkJBU0FEUVFjZ0Eyc2dCRUVnY1JzaUEzUnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQjNFYklnTkJBQkJPSWdKQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQUpCZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRWlBRUVFY2lBQUlBUkJnQUZ4R3pvQUFBdkVBUUFnQkNBRkVFMGdBMEVIY1VFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURKQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0F4QlBJZ0pCZ0lEOEIzRkJFSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FZRCtBM0ZCQ0hVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBMEVEY1RvQUFBdlVBUUVHZnlBRFFRTjFJUW9EUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUtRUVYwSUFKcUlBWkJBM1ZxSWdoQmdKQithaTBBQUNFSFFRQWhDU004QkVBZ0JDQUFJQVlnQ0NBSEVFd2lDMEVBU2dSQVFRRWhDU0FMUVFGcklBUnFJUVFMQ3lBSlJVRUFJenNiQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJSSWdaQkFFb0VRQ0FHUVFGcklBUnFJUVFMQlNBSlJRUkFJNEVDQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJTQlNBRUlBQWdCaUFESUFFZ0J4QlRDd3NMSUFSQkFXb2hCQXdCQ3dzTE1nRURmeVB3QVNFRElBQWo4UUVpQkVnRVFBOExRUUFnQTBFSGF5SURheUVGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRlFMb0FVQkQzOENRRUVuSVFZRFFDQUdRUUJJRFFFZ0JrRUNkQ0lGUVlEOEEyb2lBeEFkSVFJZ0EwRUJhaEFkSVFjZ0EwRUNhaEFkSVFNZ0FrRVFheUVFSUFkQkNHc2hDMEVJSVFJZ0FRUkFRUkFoQWlBRElBTkJBWEZySVFNTElBQWdBaUFFYWtoQkFDQUFJQVJPR3dSQUlBVkJnL3dEYWhBZElnVkJnQUZ4UVFCSElRd2dCVUVnY1VFQVJ5RU5RWUNBQWlBREVFMGdBaUFBSUFScklnTnJRUUZySUFNZ0JVSEFBSEViUVFGMGFpSURRWUNRZm1vZ0JVRUljVUVBUnlPQkFpSUNJQUliUVFGeFFRMTBJZ0pxTFFBQUlRNGdBMEdCa0g1cUlBSnFMUUFBSVE5QkJ5RURBMEFnQTBFQVRnUkFRUUFoQWdKL1FRRkJBQ0FEUVFkcmF5QURJQTBiSWdSMElBOXhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdCSFFnRG5FYklnUUVRRUVISUFOcklBdHFJZ0pCQUU0RWZ5QUNRYUFCVEFWQkFBc0VRRUVBSVFkQkFDRUtJK29CUlNPQkFpSUlJQWdiSWdoRkJFQWdBRUdnQVd3Z0FtcEJnSkVFYWkwQUFDSUpJUkFnQ1VFRGNTSUpRUUJMUVFBZ0RCc0VRRUVCSVFjRlFRRkJBQ0FKUVFCTFFRQWdFRUVFY1VFQUk0RUNHeHNiSVFvTEMwRUJRUUFnQ2tVZ0J4c2dDQnNFUUNPQkFnUkFJQUJCb0FGc0lBSnFRUU5zUVlESkJXb2dCVUVIY1NBRVFRRVFUaUlFUVI5eFFRTjBPZ0FBSUFCQm9BRnNJQUpxUVFOc1FZSEpCV29nQkVIZ0IzRkJCWFZCQTNRNkFBQWdBRUdnQVd3Z0FtcEJBMnhCZ3NrRmFpQUVRWUQ0QVhGQkNuVkJBM1E2QUFBRklBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JFSEovZ05CeVA0RElBVkJFSEViRUU4aUJFR0FnUHdIY1VFUWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQnlRVnFJQVJCZ1A0RGNVRUlkVG9BQUNBQVFhQUJiQ0FDYWtFRGJFR0N5UVZxSUFRNkFBQUxDd3NMSUFOQkFXc2hBd3dCQ3dzTElBWkJBV3NoQmd3QUFBc0FDd3RrQVFGL1FZQ0FBa0dBa0FJajVnRWJJUUZCQVNQcUFTT0JBaHNFUUNBQUlBRkJnTGdDUVlDd0FpUG5BUnNqN3dFZ0FHcEIvd0Z4UVFBajdnRVFWQXNqNVFFRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBrQVJzUVZRc2o2UUVFUUNBQUkrZ0JFRllMQ3lVQkFYOENRQU5BSUFCQmtBRktEUUVnQUVIL0FYRVFWeUFBUVFGcUlRQU1BQUFMQUFzTFJnRUNmd05BSUFGQmtBRk9SUVJBUVFBaEFBTkFJQUJCb0FGSUJFQWdBVUdnQVd3Z0FHcEJnSkVFYWtFQU9nQUFJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUVMQ3dzYkFFR1AvZ01RSFVFQklBQjBjaUlBSkw4QlFZLytBeUFBRUI4TEN3QkJBU1RCQVVFQkVGb0xMZ0VCZndKL0kzVWlBRUVBU2dSL0kyMEZRUUFMQkVBZ0FFRUJheUVBQ3lBQVJRc0VRRUVBSkc4TElBQWtkUXN3QVFGL0FuOGpnd0VpQUVFQVNnUi9JMzBGUVFBTEJFQWdBRUVCYXlFQUN5QUFSUXNFUUVFQUpIOExJQUFrZ3dFTE1nRUJmd0ovSTVZQklnQkJBRW9FZnlPUUFRVkJBQXNFUUNBQVFRRnJJUUFMSUFCRkN3UkFRUUFra1FFTElBQWtsZ0VMUndFQ2Z5QUFKR1JCbFA0REVCMUIrQUZ4SVFGQmsvNERJQUJCL3dGeElnSVFIMEdVL2dNZ0FTQUFRUWgxUVFkeElnQnlFQjhnQWlSVklBQWtWeU5WSTFkQkNIUnlKRm9Mb2dFQkFuOGpZa1ZCQVNOWUd3UkFEd3NqWTBFQmF5SUFRUUJNQkVBalRRUkFJMDBrWXdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDeUlBUWY4UFNnMEFHa0VBQ3dSQVFRQWtXQXNqVDBFQVNnUkFJQUFRWHdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDMEgvRDBvTkFCcEJBQXNFUUVFQUpGZ0xDd1ZCQ0NSakN3VWdBQ1JqQ3d0VEFRSi9JMXhCQVdzaUFVRUFUQVJBSTFRRVFDTlVJZ0VFZnlOZEJVRUFDd1JBSTE4aEFDQUFRUUZxSUFCQkFXc2pVeHRCRDNFaUFFRVBTQVJBSUFBa1h3VkJBQ1JkQ3dzRlFRZ2hBUXNMSUFFa1hBdFRBUUovSTNOQkFXc2lBVUVBVEFSQUkyc0VRQ05ySWdFRWZ5TjBCVUVBQ3dSQUkzWWhBQ0FBUVFGcUlBQkJBV3NqYWh0QkQzRWlBRUVQU0FSQUlBQWtkZ1ZCQUNSMEN3c0ZRUWdoQVFzTElBRWtjd3RjQVFKL0k1UUJRUUZySWdGQkFFd0VRQ09NQVFSQUk0d0JJZ0VFZnlPVkFRVkJBQXNFUUNPWEFTRUFJQUJCQVdvZ0FFRUJheU9MQVJ0QkQzRWlBRUVQU0FSQUlBQWtsd0VGUVFBa2xRRUxDd1ZCQ0NFQkN3c2dBU1NVQVF1cEFnRUNmMEdBd0FBamdnSjBJZ0VoQWlPekFTQUFhaUlBSUFGT0JFQWdBQ0FDYXlTekFRSkFBa0FDUUFKQUFrQWp0UUZCQVdwQkIzRWlBQVJBSUFCQkFrWU5BUUpBSUFCQkJHc09CQU1BQkFVQUN3d0ZDeU5lSWdGQkFFb0VmeU5XQlVFQUN3UkFJQUZCQVdzaUFVVUVRRUVBSkZnTEN5QUJKRjRRWEJCZEVGNE1CQXNqWGlJQlFRQktCSDhqVmdWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSWUN3c2dBU1JlRUZ3UVhSQmVFR0FNQXdzalhpSUJRUUJLQkg4alZnVkJBQXNFUUNBQlFRRnJJZ0ZGQkVCQkFDUllDd3NnQVNSZUVGd1FYUkJlREFJTEkxNGlBVUVBU2dSL0kxWUZRUUFMQkVBZ0FVRUJheUlCUlFSQVFRQWtXQXNMSUFFa1hoQmNFRjBRWGhCZ0RBRUxFR0VRWWhCakN5QUFKTFVCUVFFUEJTQUFKTE1CQzBFQUMzUUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQUNRQ0FBUVFKckRnTUNBd1FBQ3d3RUN5TlpJZ0FqbmdGSElRRWdBQ1NlQVNBQkR3c2pjQ0lBSTU4QlJ5RUJJQUFrbndFZ0FROExJNEFCSWdBam9BRkhJUUVnQUNTZ0FTQUJEd3Nqa2dFaUFDT2hBVWNoQVNBQUpLRUJJQUVQQzBFQUMxVUFBa0FDUUFKQUlBQkJBVWNFUUNBQVFRSkdEUUVnQUVFRFJnMENEQU1MUVFFZ0FYUkJnUUZ4UVFCSER3dEJBU0FCZEVHSEFYRkJBRWNQQzBFQklBRjBRZjRBY1VFQVJ3OExRUUVnQVhSQkFYRkJBRWNMY3dFQmZ5TmJJQUJySVFBRFFDQUFRUUJNQkVCQmdCQWpXbXRCQW5RaUFVRUNkQ0FCSTRJQ0d5UmJJMXNnQUVFZmRTSUJJQUFnQVdwemF5RUFJMkZCQVdwQkIzRWtZUXdCQ3dzZ0FDUmJJMWxCQUNOWUd3Ui9JMTlCRDNFRlFROFBDeU5RSTJFUVpnUi9RUUVGUVg4TGJFRVBhZ3RzQVFGL0kzSWdBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTnhhMEVDZENPQ0FuUWtjaU55SUFCQkgzVWlBU0FBSUFGcWMyc2hBQ040UVFGcVFRZHhKSGdNQVFzTElBQWtjaU53UVFBamJ4c0VmeU4yUVE5eEJVRVBEd3NqWnlONEVHWUVmMEVCQlVGL0MyeEJEMm9MRHdBamhBRkJBWFZCc1A0RGFoQWRDeXNCQVg4amhBRkJBV29oQUFOQUlBQkJJRWhGQkVBZ0FFRWdheUVBREFFTEN5QUFKSVFCRUdra2h3RUw1Z0VCQTM4amdBRkZRUUVqZnhzRVFFRVBEd3NqaFFFaEFpT0dBUVJBUVp6K0F4QWRRUVYxUVE5eElnSWtoUUZCQUNTR0FRc2pod0VqaEFGQkFYRkZRUUowZFVFUGNTRUJBa0FDUUFKQUFrQWdBZ1JBSUFKQkFVWU5BU0FDUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEF3d0NDeUFCUVFGMUlRRkJBaUVEREFFTElBRkJBblVoQVVFRUlRTUxJQU5CQUVvRWZ5QUJJQU50QlVFQUMwRVBhaUVCSTRJQklBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBamdRRnJRUUYwSTRJQ2RDU0NBU09DQVNBQVFSOTFJZ0lnQUNBQ2FuTnJJUUFRYWd3QkN3c2dBQ1NDQVNBQkM0OEJBUUovSTVNQklBQnJJZ0JCQUV3RVFDT1lBU09OQVhRamdnSjBJQUJCSDNVaUFTQUFJQUZxYzJzaEFDT1pBU0lCUVFGMUlnSWdBVUVCY1NBQ1FRRnhjeUlCUVE1MGNpSUNRYjkvY1NBQlFRWjBjaUFDSTQ0Qkd5U1pBUXRCQUNBQUlBQkJBRWdiSkpNQkk1SUJRUUFqa1FFYkJIOGpsd0ZCRDNFRlFROFBDMEYvUVFFam1RRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMbHdFQkFYOUJBQ1NrQVNBQVFROGpxZ0ViSUFGQkR5T3JBUnRxSUFKQkR5T3NBUnRxSUFOQkR5T3RBUnRxSVFRZ0FFRVBJNjRCR3lBQlFROGpyd0ViYWlFQUlBQWdBa0VQSTdBQkcyb2hBU0FEUVE4anNRRWJJUU5CQUNTbEFVRUFKS1lCSUFRanFBRkJBV29RYlNFQUlBRWdBMm9qcVFGQkFXb1FiU0VCSUFBa29nRWdBU1NqQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElML3dJQkJYOGpUQ0FBYWlJQ0pFd2pXeUFDYTBFQVRDSUNSUVJBUVFFUVpTRUNDeU5tSUFCcUlnRWtaaU55SUFGclFRQk1JZ0ZGQkVCQkFoQmxJUUVMSTNrZ0FHb2tlVUVBSTRJQkkzbHJRUUJLSTRZQkcwVWlCRVVFUUVFREVHVWhCQXNqaUFFZ0FHb2tpQUVqa3dFamlBRnJRUUJNSWdWRkJFQkJCQkJsSVFVTElBSUVRQ05NSVFOQkFDUk1JQU1RWnlTYUFRc2dBUVJBSTJZaEEwRUFKR1lnQXhCb0pKc0JDeUFFQkVBamVTRURRUUFrZVNBREVHc2tuQUVMSUFVRVFDT0lBU0VEUVFBa2lBRWdBeEJzSkowQkMwRUJJQVZCQVNBRVFRRWdBU0FDR3hzYkJFQkJBU1NtQVF0QmdJQ0FBaU9DQW5SQnhOZ0NiU0lDSVFFanRBRWdBR29pQUNBQ1RnUkFJQUFnQVdzaEFFRUJJNlVCUVFFanBBRWpwZ0ViR3dSQUk1b0JJNXNCSTV3Qkk1MEJFRzRhQlNBQUpMUUJDeU8yQVNJQ1FRRjBRWUNad1FCcUlnRWpvZ0ZCQW1vNkFBQWdBVUVCYWlPakFVRUNham9BQUNBQ1FRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDNlVEQVFaL0lBQVFaeUVCSUFBUWFDRUNJQUFRYXlFRUlBQVFiQ0VGSUFFa21nRWdBaVNiQVNBRUpKd0JJQVVrblFFanRBRWdBR29pQUVHQWdJQUNJNElDZEVIRTJBSnRUZ1JBSUFCQmdJQ0FBaU9DQW5SQnhOZ0NiV3NoQUNBQklBSWdCQ0FGRUc0aEF5TzJBVUVCZEVHQW1jRUFhaUlHSUFOQmdQNERjVUVJZFVFQ2Fqb0FBQ0FHUVFGcUlBTkIvd0Z4UVFKcU9nQUFJejBFUUNBQlFROUJEMEVQRUc0aEFTTzJBVUVCZEVHQW1TRnFJZ01nQVVHQS9nTnhRUWgxUVFKcU9nQUFJQU5CQVdvZ0FVSC9BWEZCQW1vNkFBQkJEeUFDUVE5QkR4QnVJUUVqdGdGQkFYUkJnSmtwYWlJQ0lBRkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUZCL3dGeFFRSnFPZ0FBUVE5QkR5QUVRUThRYmlFQkk3WUJRUUYwUVlDWk1Xb2lBaUFCUVlEK0EzRkJDSFZCQW1vNkFBQWdBa0VCYWlBQlFmOEJjVUVDYWpvQUFFRVBRUTlCRHlBRkVHNGhBU08yQVVFQmRFR0FtVGxxSWdJZ0FVR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBVUgvQVhGQkFtbzZBQUFMSTdZQlFRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDeDRCQVg4Z0FCQmtJUUVnQVVWQkFDTTZHd1JBSUFBUWJ3VWdBQkJ3Q3dzdkFRSi9RZGNBSTRJQ2RDRUJJNmNCSVFBRFFDQUFJQUZPQkVBZ0FSQnhJQUFnQVdzaEFBd0JDd3NnQUNTbkFRdWtBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQmxmNERSZzBCQWtBZ0FFR1IvZ05yRGhZR0N4QVVBQWNNRVJVRENBMFNGZ1FKRGhNWEJRb1BBQXNNRnd0QmtQNERFQjFCZ0FGeUR3dEJsZjRERUIxQi93RnlEd3RCbXY0REVCMUIvd0J5RHd0Qm4vNERFQjFCL3dGeUR3dEJwUDRERUIwUEMwR1IvZ01RSFVFL2NnOExRWmIrQXhBZFFUOXlEd3RCbS80REVCMUIvd0Z5RHd0Qm9QNERFQjFCL3dGeUR3dEJwZjRERUIwUEMwR1MvZ01RSFE4TFFaZitBeEFkRHd0Qm5QNERFQjFCbndGeUR3dEJvZjRERUIwUEMwR0FBVUVBSTdJQkd5RUFJQUJCQVhJZ0FFRitjU05ZR3lFQUlBQkJBbklnQUVGOWNTTnZHeUVBSUFCQkJISWdBRUY3Y1NOL0d5RUFJQUJCQ0hJZ0FFRjNjU09SQVJ0QjhBQnlEd3RCay80REVCMUIvd0Z5RHd0Qm1QNERFQjFCL3dGeUR3dEJuZjRERUIxQi93RnlEd3RCb3Y0REVCMFBDMEdVL2dNUUhVRy9BWElQQzBHWi9nTVFIVUcvQVhJUEMwR2UvZ01RSFVHL0FYSVBDMEdqL2dNUUhVRy9BWElQQzBGL0M1d0JBUUYvSTlvQklRQWoyd0VFUUNBQVFYdHhJQUJCQkhJajBnRWJJUUFnQUVGK2NTQUFRUUZ5STlVQkd5RUFJQUJCZDNFZ0FFRUljaVBUQVJzaEFDQUFRWDF4SUFCQkFuSWoxQUViSVFBRkk5d0JCRUFnQUVGK2NTQUFRUUZ5STlZQkd5RUFJQUJCZlhFZ0FFRUNjaVBYQVJzaEFDQUFRWHR4SUFCQkJISWoyQUViSVFBZ0FFRjNjU0FBUVFoeUk5a0JHeUVBQ3dzZ0FFSHdBWElMMUFJQUlBQkJnSUFDU0FSQVFYOFBDeUFBUVlEQUFraEJBQ0FBUVlDQUFrNGJCRUJCZnc4TElBQkJnUHdEU0VFQUlBQkJnTUFEVGhzRVFDQUFRWUJBYWhBZER3c2dBRUdmL1FOTVFRQWdBRUdBL0FOT0d3UkFRZjhCUVg4ajRRRkJBa2diRHdzZ0FFSE4vZ05HQkVCQi93RWhBRUhOL2dNUUhVRUJjVVVFUUVIK0FTRUFDeU9DQWtVRVFDQUFRZjkrY1NFQUN5QUFEd3NnQUVIRS9nTkdCRUFnQUNQdEFSQWZJKzBCRHdzZ0FFR20vZ05NUVFBZ0FFR1EvZ05PR3dSQUVISWdBQkJ6RHdzZ0FFR3YvZ05NUVFBZ0FFR24vZ05PR3dSQVFmOEJEd3NnQUVHLy9nTk1RUUFnQUVHdy9nTk9Hd1JBRUhJamZ3UkFFR2tQQzBGL0R3c2dBRUdFL2dOR0JFQWdBQ1BHQVVHQS9nTnhRUWgxSWdBUUh5QUFEd3NnQUVHRi9nTkdCRUFnQUNQSEFSQWZJOGNCRHdzZ0FFR1AvZ05HQkVBanZ3RkI0QUZ5RHdzZ0FFR0EvZ05HQkVBUWRBOExRWDhMS1FFQmZ5UGVBU0FBUmdSQVFRRWs0QUVMSUFBUWRTSUJRWDlHQkg4Z0FCQWRCU0FCUWY4QmNRc0xwQUlCQTM4ajlnRUVRQThMSS9jQklRTWorQUVoQWlBQVFmOC9UQVJBSUFJRWZ5QUJRUkJ4UlFWQkFBdEZCRUFnQVVFUGNTSUFCRUFnQUVFS1JnUkFRUUVrOUFFTEJVRUFKUFFCQ3dzRklBQkIvLzhBVEFSQUkvb0JJZ1FFZnlBQVFmL2ZBRXdGUVFFTEJFQWdBVUVQY1NQeUFTQUNHeUVBSUFNRWZ5QUJRUjl4SVFFZ0FFSGdBWEVGSS9rQkJIOGdBVUgvQUhFaEFTQUFRWUFCY1FWQkFDQUFJQVFiQ3dzaEFDQUFJQUZ5SlBJQkJTUHlBVUgvQVhFZ0FVRUFTa0VJZEhJazhnRUxCVUVBSUFCQi83OEJUQ0FDR3dSQUkvVUJRUUFnQXhzRVFDUHlBVUVmY1NBQlFlQUJjWElrOGdFUEN5QUJRUTl4SUFGQkEzRWorZ0ViSlBNQkJVRUFJQUJCLy84QlRDQUNHd1JBSUFNRVFDQUJRUUZ4UVFCSEpQVUJDd3NMQ3dzTE9BRUJmeU5PSVFFZ0FFSHdBSEZCQkhVa1RTQUFRUWh4UVFCSEpFNGdBRUVIY1NSUEkyVkJBQ05PUlVFQUlBRWJHd1JBUVFBa1dBc0xaUUFqV0FSQVFRQWpYU05VR3dSQUkxOUJBV3BCRDNFa1h3c2pVeUFBUVFoeFFRQkhSd1JBUVJBalgydEJEM0VrWHdzTElBQkJCSFZCRDNFa1VpQUFRUWh4UVFCSEpGTWdBRUVIY1NSVUlBQkIrQUZ4UVFCS0lnQWtXU0FBUlFSQVFRQWtXQXNMWlFBamJ3UkFRUUFqZENOckd3UkFJM1pCQVdwQkQzRWtkZ3NqYWlBQVFRaHhRUUJIUndSQVFSQWpkbXRCRDNFa2Rnc0xJQUJCQkhWQkQzRWthU0FBUVFoeFFRQkhKR29nQUVFSGNTUnJJQUJCK0FGeFFRQktJZ0FrY0NBQVJRUkFJQUFrYndzTGNnQWprUUVFUUVFQUk1VUJJNHdCR3dSQUk1Y0JRUUZxUVE5eEpKY0JDeU9MQVNBQVFRaHhRUUJIUndSQVFSQWpsd0ZyUVE5eEpKY0JDd3NnQUVFRWRVRVBjU1NLQVNBQVFRaHhRUUJISklzQklBQkJCM0VrakFFZ0FFSDRBWEZCQUVvaUFDU1NBU0FBUlFSQUlBQWtrUUVMQ3pnQUlBQkJCSFVralFFZ0FFRUljVUVBUnlTT0FTQUFRUWR4SWdBa2p3RWdBRUVCZENJQVFRRklCRUJCQVNFQUN5QUFRUU4wSkpnQkM2b0JBUUovUVFFa1dDTmVSUVJBUWNBQUpGNExRWUFRSTFwclFRSjBJZ0JCQW5RZ0FDT0NBaHNrV3lOVUJFQWpWQ1JjQlVFSUpGd0xRUUVrWFNOU0pGOGpXaVJrSTAwRVFDTk5KR01GUVFna1l3dEJBU05QUVFCS0lnQWpUVUVBU2hza1lrRUFKR1VnQUFSL0FuOGpaQ0lBSTA5MUlRRkJBU05PQkg5QkFTUmxJQUFnQVdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dWQkFBc0VRRUVBSkZnTEkxbEZCRUJCQUNSWUN3dVNBUUVDZnlBQVFRZHhJZ0VrVnlOVklBRkJDSFJ5SkZvanRRRkJBWEZCQVVZaEFpTldSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2dBa1VFUUVFQUlBRWpYa0VBVEJzRVFDTmVRUUZySkY1QkFDTmVSU0FBUVlBQmNSc0VRRUVBSkZnTEN3c2dBRUhBQUhGQkFFY2tWaUFBUVlBQmNRUkFFSDBqVmtFQVFRQWpYa0hBQUVZZ0Foc2JCRUFqWGtFQmF5UmVDd3NMUUFCQkFTUnZJM1ZGQkVCQndBQWtkUXRCZ0JBamNXdEJBblFqZ2dKMEpISWphd1JBSTJza2N3VkJDQ1J6QzBFQkpIUWphU1IySTNCRkJFQkJBQ1J2Q3d1U0FRRUNmeUFBUVFkeElnRWtiaU5zSUFGQkNIUnlKSEVqdFFGQkFYRkJBVVloQWlOdFJTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFamRVRUFUQnNFUUNOMVFRRnJKSFZCQUNOMVJTQUFRWUFCY1JzRVFFRUFKRzhMQ3dzZ0FFSEFBSEZCQUVja2JTQUFRWUFCY1FSQUVIOGpiVUVBUVFBamRVSEFBRVlnQWhzYkJFQWpkVUVCYXlSMUN3c0xQUUJCQVNSL0k0TUJSUVJBUVlBQ0pJTUJDMEdBRUNPQkFXdEJBWFFqZ2dKMEpJSUJJNElCUVFacUpJSUJRUUFraEFFamdBRkZCRUJCQUNSL0N3dVBBUUVCZnlBQVFRZHhJZ0VrZmlOOElBRkJDSFJ5SklFQkk3VUJRUUZ4UVFGR0lnRkZCRUJCQUVFQUlBQkJ3QUJ4STMwYkk0TUJRUUJNR3dSQUk0TUJRUUZySklNQlFRQWpnd0ZGSUFCQmdBRnhHd1JBUVFBa2Z3c0xDeUFBUWNBQWNVRUFSeVI5SUFCQmdBRnhCRUFRZ1FFamZVRUFRUUFqZ3dGQmdBSkdJQUViR3dSQUk0TUJRUUZySklNQkN3c0xVZ0JCQVNTUkFTT1dBVVVFUUVIQUFDU1dBUXNqbUFFampRRjBJNElDZENTVEFTT01BUVJBSTR3QkpKUUJCVUVJSkpRQkMwRUJKSlVCSTRvQkpKY0JRZi8vQVNTWkFTT1NBVVVFUUVFQUpKRUJDd3VMQVFFQ2Z5TzFBVUVCY1VFQlJpRUNJNUFCUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqbGdGQkFFd2JCRUFqbGdGQkFXc2tsZ0ZCQUNPV0FVVWdBRUdBQVhFYkJFQkJBQ1NSQVFzTEN5QUFRY0FBY1VFQVJ5U1FBU0FBUVlBQmNRUkFFSU1CSTVBQlFRQkJBQ09XQVVIQUFFWWdBaHNiQkVBamxnRkJBV3NrbGdFTEN3dWRCQUFqc2dGRlFRQWdBRUdtL2dOSEd3UkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQm12NERSZzBCQWtBZ0FFR1IvZ05yRGhZREJ3c1BBQVFJREJBQUJRa05FUUFHQ2c0U0V4UVZBQXNNRlFzZ0FSQjREQlVMUVFBZ0FVR0FBWEZCQUVjaUFDT0FBUnNFUUVFQUpJY0JDeUFBSklBQklBQkZCRUFnQUNSL0N3d1VDeUFCUVFaMVFRTnhKRkFnQVVFL2NTUlJRY0FBSTFGckpGNE1Fd3NnQVVFR2RVRURjU1JuSUFGQlAzRWthRUhBQUNOb2F5UjFEQklMSUFFa2VrR0FBaU42YXlTREFRd1JDeUFCUVQ5eEpJa0JRY0FBSTRrQmF5U1dBUXdRQ3lBQkVIa01Ed3NnQVJCNkRBNExRUUVraGdFZ0FVRUZkVUVQY1NSN0RBMExJQUVRZXd3TUN5QUJKRlVqVjBFSWRDQUJjaVJhREFzTElBRWtiQ051UVFoMElBRnlKSEVNQ2dzZ0FTUjhJMzVCQ0hRZ0FYSWtnUUVNQ1FzZ0FSQjhEQWdMSUFFUWZnd0hDeUFCRUlBQkRBWUxJQUVRZ2dFTUJRc2dBUkNFQVF3RUN5QUJRUVIxUVFkeEpLZ0JJQUZCQjNFa3FRRkJBU1NrQVF3REN5QUJFQ3RCQVNTbEFRd0NDeU95QVNJQUJIOUJBQVVnQVVHQUFYRUxCRUJCQnlTMUFVRUFKR0ZCQUNSNEN5QUJRWUFCY1VWQkFDQUFHd1JBQWtCQmtQNERJUUFEUUNBQVFhYitBMDROQVNBQVFRQVFrZ0VnQUVFQmFpRUFEQUFBQ3dBTEN5QUJRWUFCY1VFQVJ5U3lBUXdCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUhSQWZJQUJCQVdvaEFBd0JDd3RCaEFVayt3RUxKUUVCZjBIUi9nTVFIU0VBUWRMK0F4QWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhQOERjUXNwQVFGL1FkUCtBeEFkSVFCQjFQNERFQjFCL3dGeElBQkIvd0Z4UVFoMGNrSHdQM0ZCZ0lBQ2FndUdBUUVEZnlPQkFrVUVRQThMSUFCQmdBRnhSVUVBSS93Qkd3UkFRUUFrL0FGQjFmNERRZFgrQXhBZFFZQUJjaEFmRHdzUWh3RWhBUkNJQVNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSlB3QklBTWsvUUVnQVNUK0FTQUNKUDhCUWRYK0F5QUFRZjkrY1JBZkJTQUJJQUlnQXhDVEFVSFYvZ05CL3dFUUh3c0xXUUVFZjBFQlFlditBeUlESUFCR0lBQkI2ZjREUmhzRVFDQUFRUUZySWdRUUhVRy9mM0VpQWtFL2NTSUZRVUJySUFVZ0FDQURSaHRCZ0pBRWFpQUJPZ0FBSUFKQmdBRnhCRUFnQkNBQ1FRRnFRWUFCY2hBZkN3c0xNUUFDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdNQ0F3UUFDd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzZkFDQUFRUUVqekFFUWl3RWlBSFJ4Qkg5QkFTQUFkQ0FCY1VVRlFRQUxDNFlCQVFSL0EwQWdBaUFBU0FSQUlBSkJCR29oQWlQR0FTSUJRUVJxUWYvL0EzRWlBeVRHQVNQTEFRUkFJOGtCSVFRanlBRUVRQ1BLQVNUSEFVRUJKTUlCUVFJUVdrRUFKTWdCUVFFa3lRRUZJQVFFUUVFQUpNa0JDd3NnQVNBREVJd0JCRUFqeHdGQkFXb2lBVUgvQVVvRVFFRUJKTWdCUVFBaEFRc2dBU1RIQVFzTERBRUxDd3NOQUNQRkFSQ05BVUVBSk1VQkMwWUJBWDhqeGdFaEFFRUFKTVlCUVlUK0EwRUFFQjhqeXdFRWZ5QUFRUUFRakFFRlFRQUxCRUFqeHdGQkFXb2lBRUgvQVVvRVFFRUJKTWdCUVFBaEFBc2dBQ1RIQVFzTGZBRURmeVBMQVNFQklBQkJCSEZCQUVja3l3RWdBRUVEY1NFQ0lBRkZCRUFqekFFUWl3RWhBU0FDRUlzQklRTWp4Z0VoQUNQTEFRUi9RUUVnQVhRZ0FIRUZRUUVnQTNRZ0FIRkJBRUVCSUFGMElBQnhHd3NFUUNQSEFVRUJhaUlBUWY4QlNnUkFRUUVreUFGQkFDRUFDeUFBSk1jQkN3c2dBaVRNQVF2SUJnRUJmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUh3d0JDeUFBUWREK0EwWkJBQ09BQWhzRVFFRUFKSUFDUWY4QkpJd0NEQUlMSUFCQmdJQUNTQVJBSUFBZ0FSQjNEQUVMSUFCQmdNQUNTRUVBSUFCQmdJQUNUaHNOQVNBQVFZRDhBMGhCQUNBQVFZREFBMDRiQkVBZ0FFR0FRR29nQVJBZkRBSUxJQUJCbi8wRFRFRUFJQUJCZ1B3RFRoc0VRQ1BoQVVFQ1RnOExJQUJCLy8wRFRFRUFJQUJCb1AwRFRoc05BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKTThCSUFGQkFuRkJBRWNrMEFFZ0FVR0FBWEZCQUVjazBRRkJBUThMSUFCQnB2NERURUVBSUFCQmtQNERUaHNFUUJCeUlBQWdBUkNGQVE4TElBQkJ2LzREVEVFQUlBQkJzUDREVGhzRVFCQnlJMzhFUUNPRUFVRUJkVUd3L2dOcUlBRVFId3dDQ3d3Q0N5QUFRY3YrQTB4QkFDQUFRY0QrQTA0YkJFQWdBRUhBL2dOR0JFQWdBUkEvREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RSFVFSGNYSkJnQUZ5RUI4TUFnc2dBRUhFL2dOR0JFQkJBQ1R0QVNBQVFRQVFId3dDQ3lBQVFjWCtBMFlFUUNBQkpPSUJEQU1MSUFCQnh2NERSZ1JBSUFFUWhnRU1Bd3NDUUFKQUFrQUNRQ0FBUWNQK0EwY0VRQ0FBUWNMK0Eyc09DZ0VFQkFRRUJBUUVBd0lFQ3lBQkpPNEJEQVlMSUFFazd3RU1CUXNnQVNUd0FRd0VDeUFCSlBFQkRBTUxEQUlMSUFCQjFmNERSZ1JBSUFFUWlRRU1BUXRCQVNBQVFjLytBMFlnQUVIdy9nTkdHd1JBSS93QkJFQWovZ0VpQWtHQWdBRk9CSDhnQWtILy93Rk1CVUVBQ3dSL1FRRUZJQUpCLzc4RFRFRUFJQUpCZ0tBRFRoc0xEUUlMQ3lBQVFlditBMHhCQUNBQVFlaitBMDRiQkVBZ0FDQUJFSW9CREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFCQ09BUUpBQWtBQ1FBSkFJQUJCaFA0RFJ3UkFJQUJCaGY0RGF3NERBUUlEQkFzUWp3RU1CUXNDUUNQTEFRUkFJOGtCRFFFanlBRUVRRUVBSk1nQkN3c2dBU1RIQVFzTUJRc2dBU1RLQVNQSkFVRUFJOHNCR3dSQUlBRWt4d0ZCQUNUSkFRc01CQXNnQVJDUUFRd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVRhQVNQYUFTSUNRUkJ4UVFCSEpOc0JJQUpCSUhGQkFFY2szQUVMSUFCQmovNERSZ1JBSUFFUUx3d0NDeUFBUWYvL0EwWUVRQ0FCRUM0TUFndEJBUThMUVFBUEMwRUJDeUFBSTk4QklBQkdCRUJCQVNUZ0FRc2dBQ0FCRUpFQkJFQWdBQ0FCRUI4TEMxd0JBMzhEUUFKQUlBTWdBazROQUNBQUlBTnFFSFloQlNBQklBTnFJUVFEUUNBRVFmKy9Ba3hGQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUpJQklBTkJBV29oQXd3QkN3c2ord0ZCSUNPQ0FuUWdBa0VFZFd4cUpQc0JDM1FCQW44ai9BRkZCRUFQQzBFUUlRQWovZ0VqL3dFQ2Z5UDlBU0lCUVJCSUJFQWdBU0VBQ3lBQUN4Q1RBU1ArQVNBQWFpVCtBU1AvQVNBQWFpVC9BU0FCSUFCcklnQWsvUUZCMWY0RElRRWdBRUVBVEFSQVFRQWsvQUVnQVVIL0FSQWZCU0FCSUFCQkJIVkJBV3RCLzM1eEVCOExDek1BSSswQkkrSUJSa0VBSUFCQkFVWkJBU0FBR3hzRVFDQUJRUVJ5SWdGQndBQnhCRUFRV3dzRklBRkJlM0VoQVFzZ0FRdUJBZ0VGZnlQakFVVUVRQThMSStFQklRQWdBQ1B0QVNJQ1FaQUJUZ1IvUVFFRlFmZ0NJNElDZENJQklRTWo3QUVpQkNBQlRnUi9RUUlGUVFOQkFDQUVJQU5PR3dzTElnRkhCRUJCd2Y0REVCMGhBQ0FCSk9FQlFRQWhBZ0pBQWtBQ1FBSkFJQUVFUUNBQlFRRnJEZ01CQWdNRUN5QUFRWHh4SWdCQkNIRkJBRWNoQWd3REN5QUFRWDF4UVFGeUlnQkJFSEZCQUVjaEFnd0NDeUFBUVg1eFFRSnlJZ0JCSUhGQkFFY2hBZ3dCQ3lBQVFRTnlJUUFMSUFJRVFCQmJDeUFCUlFSQUVKUUJDeUFCUVFGR0JFQkJBU1RBQVVFQUVGb0xRY0grQXlBQklBQVFsUUVRSHdVZ0FrR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUhSQ1ZBUkFmQ3dzTG9BRUJBWDhqNHdFRVFDUHNBU0FBYWlUc0FTTTVJUUVEUUNQc0FVRUVJNElDSWdCMFFjZ0RJQUIwSSswQlFaa0JSaHRPQkVBajdBRkJCQ09DQWlJQWRFSElBeUFBZENQdEFVR1pBVVliYXlUc0FTUHRBU0lBUVpBQlJnUkFJQUVFUUJCWUJTQUFFRmNMRUZsQmZ5UktRWDhrU3dVZ0FFR1FBVWdFUUNBQlJRUkFJQUFRVndzTEMwRUFJQUJCQVdvZ0FFR1pBVW9iSk8wQkRBRUxDd3NRbGdFTE9BRUJmMEVFSTRJQ0lnQjBRY2dESUFCMEkrMEJRWmtCUmhzaEFBTkFJK3NCSUFCT0JFQWdBQkNYQVNQckFTQUFheVRyQVF3QkN3c0xzZ0VCQTM4ajBRRkZCRUFQQ3dOQUlBTWdBRWdFUUNBRFFRUnFJUU1DZnlQTkFTSUNRUVJxSWdGQi8vOERTZ1JBSUFGQmdJQUVheUVCQ3lBQkN5VE5BU0FDUVFGQkFrRUhJOUFCR3lJQ2RIRUVmMEVCSUFKMElBRnhSUVZCQUFzRVFFR0IvZ05CZ2Y0REVCMUJBWFJCQVdwQi93RnhFQjhqemdGQkFXb2lBVUVJUmdSQVFRQWt6Z0ZCQVNUREFVRURFRnBCZ3Y0RFFZTCtBeEFkUWY5K2NSQWZRUUFrMFFFRklBRWt6Z0VMQ3d3QkN3c0xsUUVBSS9zQlFRQktCRUFqK3dFZ0FHb2hBRUVBSlBzQkN5T05BaUFBYWlTTkFpT1JBa1VFUUNNM0JFQWo2d0VnQUdvazZ3RVFtQUVGSUFBUWx3RUxJellFUUNPbkFTQUFhaVNuQVJCeUJTQUFFSEVMSUFBUW1RRUxJemdFUUNQRkFTQUFhaVRGQVJDT0FRVWdBQkNOQVFzamxBSWdBR29pQUNPU0FrNEVRQ09UQWtFQmFpU1RBaUFBSTVJQ2F5RUFDeUFBSkpRQ0N3d0FRUVFRbWdFampBSVFIUXNwQVFGL1FRUVFtZ0VqakFKQkFXcEIvLzhEY1JBZElRQVFtd0ZCL3dGeElBQkIvd0Z4UVFoMGNnc09BRUVFRUpvQklBQWdBUkNTQVFzd0FFRUJJQUIwUWY4QmNTRUFJQUZCQUVvRVFDT0tBaUFBY2tIL0FYRWtpZ0lGSTRvQ0lBQkIvd0Z6Y1NTS0Fnc0xDUUJCQlNBQUVKNEJDem9CQVg4Z0FVRUFUZ1JBSUFCQkQzRWdBVUVQY1dwQkVIRkJBRWNRbndFRklBRkJIM1VpQWlBQklBSnFjMEVQY1NBQVFROXhTeENmQVFzTENRQkJCeUFBRUo0QkN3a0FRUVlnQUJDZUFRc0pBRUVFSUFBUW5nRUxQd0VDZnlBQlFZRCtBM0ZCQ0hVaEFpQUJRZjhCY1NJQklRTWdBQ0FCRUpFQkJFQWdBQ0FERUI4TElBQkJBV29pQUNBQ0VKRUJCRUFnQUNBQ0VCOExDdzRBUVFnUW1nRWdBQ0FCRUtRQkMxb0FJQUlFUUNBQVFmLy9BM0VpQUNBQmFpQUFJQUZ6Y3lJQVFSQnhRUUJIRUo4QklBQkJnQUp4UVFCSEVLTUJCU0FBSUFGcVFmLy9BM0VpQWlBQVFmLy9BM0ZKRUtNQklBQWdBWE1nQW5OQmdDQnhRUUJIRUo4QkN3c0xBRUVFRUpvQklBQVFkZ3VwQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNNRlFzUW5BRkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2hBSWdBRUgvQVhFa2hRSU1Ed3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSElqZ3dJUW5RRU1Fd3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraEFJTUV3c2poQUlpQUVFQkVLQUJJQUJCQVdwQi93RnhJZ0FraEFJTURRc2poQUlpQUVGL0VLQUJJQUJCQVd0Qi93RnhJZ0FraEFJTURRc1Ftd0ZCL3dGeEpJUUNEQTBMSTRNQ0lnQkJnQUZ4UVlBQlJoQ2pBU0FBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVrZ3dJTURRc1FuQUZCLy84RGNTT0xBaENsQVF3SUN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpSUFJNFVDUWY4QmNTT0VBa0gvQVhGQkNIUnlJZ0ZCQUJDbUFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWdDSUFCQi93RnhKSWtDUVFBUW9nRkJDQThMSTRVQ1FmOEJjU09FQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NEQWd3TEN5T0ZBa0gvQVhFamhBSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0VBZ3dMQ3lPRkFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0ZBZ3dGQ3lPRkFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0ZBZ3dGQ3hDYkFVSC9BWEVraFFJTUJRc2pnd0lpQUVFQmNVRUFTeENqQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFa2d3SU1CUXRCZnc4TEk0d0NRUUpxUWYvL0EzRWtqQUlNQkFzZ0FFVVFvUUZCQUJDaUFRd0RDeUFBUlJDaEFVRUJFS0lCREFJTEk0d0NRUUZxUWYvL0EzRWtqQUlNQVF0QkFCQ2hBVUVBRUtJQlFRQVFud0VMUVFRUEN5QUFRZjhCY1NTRkFrRUlDNWtHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVJCSEJFQWdBRUVSUmcwQkFrQWdBRUVTYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0JBZ1JBUWMzK0F4Q25BVUgvQVhFaUFFRUJjUVJBUWMzK0F5QUFRWDV4SWdCQmdBRnhCSDlCQUNTQ0FpQUFRZjkrY1FWQkFTU0NBaUFBUVlBQmNnc1FuUUZCeEFBUEN3dEJBU1NSQWd3UUN4Q2NBVUgvL3dOeElnQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBaU9NQWtFQ2FrSC8vd054Skl3Q0RCRUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlJNE1DRUowQkRCQUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSVlDREJBTEk0WUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTU0dBaU9HQWtVUW9RRkJBQkNpQVF3T0N5T0dBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWtoZ0lqaGdKRkVLRUJRUUVRb2dFTURRc1Ftd0ZCL3dGeEpJWUNEQW9MSTRNQ0lnRkJnQUZ4UVlBQlJpRUFJNG9DUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1NEQWd3S0N4Q2JBU0VBSTR3Q0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NNQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09IQWtIL0FYRWpoZ0pCL3dGeFFRaDBjaUlCUVFBUXBnRWdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSEFrSC9BWEVqaGdKQi93RnhRUWgwY2hDbkFVSC9BWEVrZ3dJTUNBc2pod0pCL3dGeEk0WUNRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtoZ0lNQ0Fzamh3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtod0lnQUVVUW9RRkJBQkNpQVF3R0N5T0hBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NIQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0hBZ3dDQ3lPREFpSUJRUUZ4UVFGR0lRQWppZ0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SklNQ0RBSUxRWDhQQ3lPTUFrRUJha0gvL3dOeEpJd0NEQUVMSUFBUW93RkJBQkNoQVVFQUVLSUJRUUFRbndFTFFRUVBDeUFBUWY4QmNTU0hBa0VJQy9VR0FRSi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVnUndSQUlBQkJJVVlOQVFKQUlBQkJJbXNPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamlnSkJCM1pCQVhFRVFDT01Ba0VCYWtILy93TnhKSXdDQlJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ3RCQ0E4TEVKd0JRZi8vQTNFaUFFR0EvZ054UVFoMUpJZ0NJQUJCL3dGeEpJa0NJNHdDUVFKcVFmLy9BM0VrakFJTUZBc2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09EQWhDZEFRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3TkN5T0lBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NJQWd3T0N5T0lBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NJQWd3T0N4Q2JBVUgvQVhFa2lBSU1EZ3RCQmtFQUk0b0NJZ0pCQlhaQkFYRkJBRXNiSWdCQjRBQnlJQUFnQWtFRWRrRUJjVUVBU3hzaEFDT0RBaUVCSUFKQkJuWkJBWEZCQUVzRWZ5QUJJQUJyUWY4QmNRVWdBU0FBUVFaeUlBQWdBVUVQY1VFSlN4c2lBRUhnQUhJZ0FDQUJRWmtCU3hzaUFHcEIvd0Z4Q3lJQlJSQ2hBU0FBUWVBQWNVRUFSeENqQVVFQUVKOEJJQUVrZ3dJTURnc2ppZ0pCQjNaQkFYRkJBRXNFUUJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ1VqakFKQkFXcEIvLzhEY1NTTUFndEJDQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5SWdBZ0FFSC8vd054UVFBUXBnRWdBRUVCZEVILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQUVLY0JRZjhCY1NTREFnd0hDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3RkN5T0pBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NKQWd3R0N5T0pBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NKQWd3R0N4Q2JBVUgvQVhFa2lRSU1CZ3NqZ3dKQmYzTkIvd0Z4SklNQ1FRRVFvZ0ZCQVJDZkFRd0dDMEYvRHdzZ0FFSC9BWEVraVFKQkNBOExJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUF3c2dBRVVRb1FGQkFCQ2lBUXdDQ3lBQVJSQ2hBVUVCRUtJQkRBRUxJNHdDUVFGcVFmLy9BM0VrakFJTFFRUUw4UVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhSZzBCQWtBZ0FFRXlhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPS0FrRUVka0VCY1FSQUk0d0NRUUZxUWYvL0EzRWtqQUlGRUpzQklRQWpqQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJd0NDMEVJRHdzUW5BRkIvLzhEY1NTTEFpT01Ba0VDYWtILy93TnhKSXdDREJFTEk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUlnQWpnd0lRblFFTURnc2ppd0pCQVdwQi8vOERjU1NMQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVNJQlFRRVFvQUVnQVVFQmFrSC9BWEVpQVVVUW9RRkJBQkNpQVNBQUlBRVFuUUVNRGdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BU0lCUVg4UW9BRWdBVUVCYTBIL0FYRWlBVVVRb1FGQkFSQ2lBU0FBSUFFUW5RRU1EUXNqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRbXdGQi93RnhFSjBCREFzTFFRQVFvZ0ZCQUJDZkFVRUJFS01CREFzTEk0b0NRUVIyUVFGeFFRRkdCRUFRbXdFaEFDT01BaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2pBSUZJNHdDUVFGcVFmLy9BM0VrakFJTFFRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaUlBSTRzQ1FRQVFwZ0VqaXdJZ0FHcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2lBSWdBRUgvQVhFa2lRSkJBQkNpQVVFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVVIL0FYRWtnd0lNQmdzaml3SkJBV3RCLy84RGNTU0xBa0VJRHdzamd3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVF3R0N5T0RBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NEQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0RBZ3dEQzBFQUVLSUJRUUFRbndFamlnSkJCSFpCQVhGQkFFMFFvd0VNQXd0QmZ3OExJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUFRc2pqQUpCQVdwQi8vOERjU1NNQWd0QkJBdUNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQkJ3UUJHRFFFQ1FDQUFRY0lBYXc0T0F3UUZCZ2NJQ1JFS0N3d05EZzhBQ3d3UEN3d1BDeU9GQWlTRUFnd09DeU9HQWlTRUFnd05DeU9IQWlTRUFnd01DeU9JQWlTRUFnd0xDeU9KQWlTRUFnd0tDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtoQUlNQ1Fzamd3SWtoQUlNQ0FzamhBSWtoUUlNQndzamhnSWtoUUlNQmdzamh3SWtoUUlNQlFzamlBSWtoUUlNQkFzamlRSWtoUUlNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RkIvd0Z4SklVQ0RBSUxJNE1DSklVQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFSd1JBSUFCQjBRQkdEUUVDUUNBQVFkSUFhdzRPRUFNRUJRWUhDQWtLRUFzTURRNEFDd3dPQ3lPRUFpU0dBZ3dPQ3lPRkFpU0dBZ3dOQ3lPSEFpU0dBZ3dNQ3lPSUFpU0dBZ3dMQ3lPSkFpU0dBZ3dLQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFVSC9BWEVraGdJTUNRc2pnd0lraGdJTUNBc2poQUlraHdJTUJ3c2poUUlraHdJTUJnc2poZ0lraHdJTUJRc2ppQUlraHdJTUJBc2ppUUlraHdJTUF3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFwd0ZCL3dGeEpJY0NEQUlMSTRNQ0pJY0NEQUVMUVg4UEMwRUVDLzBCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFBUndSQUlBQkI0UUJHRFFFQ1FDQUFRZUlBYXc0T0F3UVFCUVlIQ0FrS0N3d1FEUTRBQ3d3T0N5T0VBaVNJQWd3T0N5T0ZBaVNJQWd3TkN5T0dBaVNJQWd3TUN5T0hBaVNJQWd3TEN5T0pBaVNJQWd3S0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2lBSU1DUXNqZ3dJa2lBSU1DQXNqaEFJa2lRSU1Cd3NqaFFJa2lRSU1CZ3NqaGdJa2lRSU1CUXNqaHdJa2lRSU1CQXNqaUFJa2lRSU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdGQi93RnhKSWtDREFJTEk0TUNKSWtDREFFTFFYOFBDMEVFQzVzREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUVIeEFFWU5BUUpBSUFCQjhnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVRQUxEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRRQ0VKMEJEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRVQ0VKMEJEQTRMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRZQ0VKMEJEQTBMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRjQ0VKMEJEQXdMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRnQ0VKMEJEQXNMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRrQ0VKMEJEQW9MSS93QlJRUkFBa0FqdHdFRVFFRUJKSTRDREFFTEk3a0JJNzhCY1VFZmNVVUVRRUVCSkk4Q0RBRUxRUUVra0FJTEN3d0pDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaU9EQWhDZEFRd0lDeU9FQWlTREFnd0hDeU9GQWlTREFnd0dDeU9HQWlTREFnd0ZDeU9IQWlTREFnd0VDeU9JQWlTREFnd0RDeU9KQWlTREFnd0NDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtnd0lNQVF0QmZ3OExRUVFMTndFQmZ5QUJRUUJPQkVBZ0FFSC9BWEVnQUNBQmFrSC9BWEZMRUtNQkJTQUJRUjkxSWdJZ0FTQUNhbk1nQUVIL0FYRktFS01CQ3dzMEFRSi9JNE1DSWdFZ0FFSC9BWEVpQWhDZ0FTQUJJQUlRc0FFZ0FDQUJha0gvQVhFaUFDU0RBaUFBUlJDaEFVRUFFS0lCQzFnQkFuOGpnd0lpQVNBQWFpT0tBa0VFZGtFQmNXcEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQUVIL0FYRWdBV29qaWdKQkJIWkJBWEZxUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRQVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZQUJSd1JBSUFCQmdRRkdEUUVDUUNBQVFZSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQ3hBUXdRQ3lPRkFoQ3hBUXdQQ3lPR0FoQ3hBUXdPQ3lPSEFoQ3hBUXdOQ3lPSUFoQ3hBUXdNQ3lPSkFoQ3hBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3hBUXdLQ3lPREFoQ3hBUXdKQ3lPRUFoQ3lBUXdJQ3lPRkFoQ3lBUXdIQ3lPR0FoQ3lBUXdHQ3lPSEFoQ3lBUXdGQ3lPSUFoQ3lBUXdFQ3lPSkFoQ3lBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3lBUXdDQ3lPREFoQ3lBUXdCQzBGL0R3dEJCQXMzQVFKL0k0TUNJZ0VnQUVIL0FYRkJmMndpQWhDZ0FTQUJJQUlRc0FFZ0FTQUFhMEgvQVhFaUFDU0RBaUFBUlJDaEFVRUJFS0lCQzFnQkFuOGpnd0lpQVNBQWF5T0tBa0VFZGtFQmNXdEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQVNBQVFmOEJjV3NqaWdKQkJIWkJBWEZyUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRRVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFaQUJSd1JBSUFCQmtRRkdEUUVDUUNBQVFaSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQzBBUXdRQ3lPRkFoQzBBUXdQQ3lPR0FoQzBBUXdPQ3lPSEFoQzBBUXdOQ3lPSUFoQzBBUXdNQ3lPSkFoQzBBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzBBUXdLQ3lPREFoQzBBUXdKQ3lPRUFoQzFBUXdJQ3lPRkFoQzFBUXdIQ3lPR0FoQzFBUXdHQ3lPSEFoQzFBUXdGQ3lPSUFoQzFBUXdFQ3lPSkFoQzFBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzFBUXdDQ3lPREFoQzFBUXdCQzBGL0R3dEJCQXNpQUNPREFpQUFjU0lBSklNQ0lBQkZFS0VCUVFBUW9nRkJBUkNmQVVFQUVLTUJDeVlBSTRNQ0lBQnpRZjhCY1NJQUpJTUNJQUJGRUtFQlFRQVFvZ0ZCQUJDZkFVRUFFS01CQzRzQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR2dBVWNFUUNBQVFhRUJSZzBCQWtBZ0FFR2lBV3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamhBSVF0d0VNRUFzamhRSVF0d0VNRHdzamhnSVF0d0VNRGdzamh3SVF0d0VNRFFzamlBSVF0d0VNREFzamlRSVF0d0VNQ3dzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF0d0VNQ2dzamd3SVF0d0VNQ1FzamhBSVF1QUVNQ0FzamhRSVF1QUVNQndzamhnSVF1QUVNQmdzamh3SVF1QUVNQlFzamlBSVF1QUVNQkFzamlRSVF1QUVNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF1QUVNQWdzamd3SVF1QUVNQVF0QmZ3OExRUVFMSmdBamd3SWdBSEpCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVVFQUVKOEJRUUFRb3dFTExBRUJmeU9EQWlJQklBQkIvd0Z4UVg5c0lnQVFvQUVnQVNBQUVMQUJJQUFnQVdwRkVLRUJRUUVRb2dFTGl3SUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRYkFCUndSQUlBQkJzUUZHRFFFQ1FDQUFRYklCYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0VBaEM2QVF3UUN5T0ZBaEM2QVF3UEN5T0dBaEM2QVF3T0N5T0hBaEM2QVF3TkN5T0lBaEM2QVF3TUN5T0pBaEM2QVF3TEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM2QVF3S0N5T0RBaEM2QVF3SkN5T0VBaEM3QVF3SUN5T0ZBaEM3QVF3SEN5T0dBaEM3QVF3R0N5T0hBaEM3QVF3RkN5T0lBaEM3QVF3RUN5T0pBaEM3QVF3REN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM3QVF3Q0N5T0RBaEM3QVF3QkMwRi9Ed3RCQkFzN0FRRi9JQUFRZFNJQlFYOUdCSDhnQUJBZEJTQUJDMEgvQVhFZ0FFRUJhaUlCRUhVaUFFRi9SZ1IvSUFFUUhRVWdBQXRCL3dGeFFRaDBjZ3NNQUVFSUVKb0JJQUFRdlFFTE5BQWdBRUdBQVhGQmdBRkdFS01CSUFCQkFYUWdBRUgvQVhGQkIzWnlRZjhCY1NJQVJSQ2hBVUVBRUtJQlFRQVFud0VnQUFzeUFDQUFRUUZ4UVFCTEVLTUJJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBUlJDaEFVRUFFS0lCUVFBUW53RWdBQXM0QVFGL0k0b0NRUVIyUVFGeElBQkJBWFJ5UWY4QmNTRUJJQUJCZ0FGeFFZQUJSaENqQVNBQlJSQ2hBVUVBRUtJQlFRQVFud0VnQVFzNUFRRi9JNG9DUVFSMlFRRnhRUWQwSUFCQi93RnhRUUYyY2lFQklBQkJBWEZCQVVZUW93RWdBVVVRb1FGQkFCQ2lBVUVBRUo4QklBRUxLZ0FnQUVHQUFYRkJnQUZHRUtNQklBQkJBWFJCL3dGeElnQkZFS0VCUVFBUW9nRkJBQkNmQVNBQUN6MEJBWDhnQUVIL0FYRkJBWFlpQVVHQUFYSWdBU0FBUVlBQmNVR0FBVVliSWdGRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBUVFGeFFRRkdFS01CSUFFTEt3QWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSWlBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VnQUFzcUFRRi9JQUJCL3dGeFFRRjJJZ0ZGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFRUUZ4UVFGR0VLTUJJQUVMSGdCQkFTQUFkQ0FCY1VIL0FYRkZFS0VCUVFBUW9nRkJBUkNmQVNBQkM4Z0lBUVYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFkeElnUUVRQ0FFUVFGR0RRRUNRQ0FFUVFKckRnWURCQVVHQndnQUN3d0lDeU9FQWlFQkRBY0xJNFVDSVFFTUJnc2poZ0loQVF3RkN5T0hBaUVCREFRTEk0Z0NJUUVNQXdzamlRSWhBUXdDQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFTRUJEQUVMSTRNQ0lRRUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUJRUkFJQVZCQVVZTkFRSkFJQVZCQW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2dBRUVIVEFSL0lBRVF2d0VoQWtFQkJTQUFRUTlNQkg4Z0FSREFBU0VDUVFFRlFRQUxDeUVEREE4TElBQkJGMHdFZnlBQkVNRUJJUUpCQVFVZ0FFRWZUQVIvSUFFUXdnRWhBa0VCQlVFQUN3c2hBd3dPQ3lBQVFTZE1CSDhnQVJEREFTRUNRUUVGSUFCQkwwd0VmeUFCRU1RQklRSkJBUVZCQUFzTElRTU1EUXNnQUVFM1RBUi9JQUVReFFFaEFrRUJCU0FBUVQ5TUJIOGdBUkRHQVNFQ1FRRUZRUUFMQ3lFRERBd0xJQUJCeHdCTUJIOUJBQ0FCRU1jQklRSkJBUVVnQUVIUEFFd0VmMEVCSUFFUXh3RWhBa0VCQlVFQUN3c2hBd3dMQ3lBQVFkY0FUQVIvUVFJZ0FSREhBU0VDUVFFRklBQkIzd0JNQkg5QkF5QUJFTWNCSVFKQkFRVkJBQXNMSVFNTUNnc2dBRUhuQUV3RWYwRUVJQUVReHdFaEFrRUJCU0FBUWU4QVRBUi9RUVVnQVJESEFTRUNRUUVGUVFBTEN5RUREQWtMSUFCQjl3Qk1CSDlCQmlBQkVNY0JJUUpCQVFVZ0FFSC9BRXdFZjBFSElBRVF4d0VoQWtFQkJVRUFDd3NoQXd3SUN5QUFRWWNCVEFSL0lBRkJmbkVoQWtFQkJTQUFRWThCVEFSL0lBRkJmWEVoQWtFQkJVRUFDd3NoQXd3SEN5QUFRWmNCVEFSL0lBRkJlM0VoQWtFQkJTQUFRWjhCVEFSL0lBRkJkM0VoQWtFQkJVRUFDd3NoQXd3R0N5QUFRYWNCVEFSL0lBRkJiM0VoQWtFQkJTQUFRYThCVEFSL0lBRkJYM0VoQWtFQkJVRUFDd3NoQXd3RkN5QUFRYmNCVEFSL0lBRkJ2Mzl4SVFKQkFRVWdBRUcvQVV3RWZ5QUJRZjkrY1NFQ1FRRUZRUUFMQ3lFRERBUUxJQUJCeHdGTUJIOGdBVUVCY2lFQ1FRRUZJQUJCendGTUJIOGdBVUVDY2lFQ1FRRUZRUUFMQ3lFRERBTUxJQUJCMXdGTUJIOGdBVUVFY2lFQ1FRRUZJQUJCM3dGTUJIOGdBVUVJY2lFQ1FRRUZRUUFMQ3lFRERBSUxJQUJCNXdGTUJIOGdBVUVRY2lFQ1FRRUZJQUJCN3dGTUJIOGdBVUVnY2lFQ1FRRUZRUUFMQ3lFRERBRUxJQUJCOXdGTUJIOGdBVUhBQUhJaEFrRUJCU0FBUWY4QlRBUi9JQUZCZ0FGeUlRSkJBUVZCQUFzTElRTUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUVCRUFnQkVFQlJnMEJBa0FnQkVFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQWlTRUFnd0hDeUFDSklVQ0RBWUxJQUlraGdJTUJRc2dBaVNIQWd3RUN5QUNKSWdDREFNTElBSWtpUUlNQWd0QkFTQUZRUWRLSUFWQkJFZ2JCRUFqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElnQWhDZEFRc01BUXNnQWlTREFndEJCRUYvSUFNYkM3c0VBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJSZzBCQWtBZ0FFSENBV3NPRGdNU0JBVUdCd2dKQ2dzTUVRME9BQXNNRGdzamlnSkJCM1pCQVhFTkVRd09DeU9MQWhDK0FVSC8vd054SVFBaml3SkJBbXBCLy84RGNTU0xBaUFBUVlEK0EzRkJDSFVraEFJZ0FFSC9BWEVraFFKQkJBOExJNG9DUVFkMlFRRnhEUkVNRGdzamlnSkJCM1pCQVhFTkVBd01DeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09GQWtIL0FYRWpoQUpCL3dGeFFRaDBjaENsQVF3TkN4Q2JBUkN4QVF3TkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFQUpJd0NEQXNMSTRvQ1FRZDJRUUZ4UVFGSERRb01Cd3NqaXdJaUFCQytBVUgvL3dOeEpJd0NJQUJCQW1wQi8vOERjU1NMQWd3SkN5T0tBa0VIZGtFQmNVRUJSZzBIREFvTEVKc0JRZjhCY1JESUFTRUFJNHdDUVFGcVFmLy9BM0VrakFJZ0FBOExJNG9DUVFkMlFRRnhRUUZIRFFnaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSkJBbXBCLy84RGNSQ2xBUXdGQ3hDYkFSQ3lBUXdHQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVJSkl3Q0RBUUxRWDhQQ3lPTEFpSUFFTDRCUWYvL0EzRWtqQUlnQUVFQ2FrSC8vd054SklzQ1FRd1BDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWtFQ2FrSC8vd054RUtVQkN4Q2NBVUgvL3dOeEpJd0NDMEVJRHdzampBSkJBV3BCLy84RGNTU01Ba0VFRHdzampBSkJBbXBCLy84RGNTU01Ba0VNQzZBRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVVZTkFRSkFJQUJCMGdGckRnNERBQVFGQmdjSUNRb0FDd0FNRFFBTERBMExJNG9DUVFSMlFRRnhEUThNRFFzaml3SWlBUkMrQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SklzQ0lBQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBa0VFRHdzamlnSkJCSFpCQVhFTkR3d01DeU9LQWtFRWRrRUJjUTBPSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTR3Q1FRSnFRZi8vQTNFUXBRRU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaHdKQi93RnhJNFlDUWY4QmNVRUlkSElRcFFFTUN3c1Ftd0VRdEFFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUlRcFFGQkVDU01BZ3dKQ3lPS0FrRUVka0VCY1VFQlJ3MElEQVlMSTRzQ0lnQVF2Z0ZCLy84RGNTU01Ba0VCSkxnQklBQkJBbXBCLy84RGNTU0xBZ3dIQ3lPS0FrRUVka0VCY1VFQlJnMEZEQWdMSTRvQ1FRUjJRUUZ4UVFGSERRY2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUpCQW1wQi8vOERjUkNsQVF3RUN4Q2JBUkMxQVF3RkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFWUpJd0NEQU1MUVg4UEN5T0xBaUlBRUw0QlFmLy9BM0VrakFJZ0FFRUNha0gvL3dOeEpJc0NRUXdQQ3hDY0FVSC8vd054Skl3Q0MwRUlEd3NqakFKQkFXcEIvLzhEY1NTTUFrRUVEd3NqakFKQkFtcEIvLzhEY1NTTUFrRU1DN0VEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFVWU5BUUpBSUFCQjRnRnJEZzREQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRUpzQlFmOEJjVUdBL2dOcUk0TUNFSjBCREFzTEk0c0NJZ0VRdmdGQi8vOERjU0VBSUFGQkFtcEIvLzhEY1NTTEFpQUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUpCQkE4TEk0VUNRWUQrQTJvamd3SVFuUUZCQkE4TEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUVLVUJRUWdQQ3hDYkFSQzNBUXdIQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVnSkl3Q1FRZ1BDeENiQVVFWWRFRVlkU0VBSTRzQ0lBQkJBUkNtQVNPTEFpQUFha0gvL3dOeEpJc0NRUUFRb1FGQkFCQ2lBU09NQWtFQmFrSC8vd054Skl3Q1FRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNNQWtFRUR3c1FuQUZCLy84RGNTT0RBaENkQVNPTUFrRUNha0gvL3dOeEpJd0NRUVFQQ3hDYkFSQzRBUXdDQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVvSkl3Q1FRZ1BDMEYvRHdzampBSkJBV3BCLy84RGNTU01Ba0VFQytjREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFnQUVIeEFVWU5BUUpBSUFCQjhnRnJEZzREQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRUpzQlFmOEJjVUdBL2dOcUVLY0JRZjhCY1NTREFnd05DeU9MQWlJQkVMNEJRZi8vQTNFaEFDQUJRUUpxUWYvL0EzRWtpd0lnQUVHQS9nTnhRUWgxSklNQ0lBQkIvd0Z4SklvQ0RBMExJNFVDUVlEK0Eyb1Fwd0ZCL3dGeEpJTUNEQXdMUVFBa3R3RU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaWdKQi93RnhJNE1DUWY4QmNVRUlkSElRcFFGQkNBOExFSnNCRUxvQkRBZ0xJNHNDUVFKclFmLy9BM0VpQUNTTEFpQUFJNHdDRUtVQlFUQWtqQUpCQ0E4TEVKc0JRUmgwUVJoMUlRQWppd0loQVVFQUVLRUJRUUFRb2dFZ0FTQUFRUUVRcGdFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBaU9NQWtFQmFrSC8vd054Skl3Q1FRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNMQWtFSUR3c1FuQUZCLy84RGNSQ25BVUgvQVhFa2d3SWpqQUpCQW1wQi8vOERjU1NNQWd3RkMwRUJKTGdCREFRTEVKc0JFTHNCREFJTEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0d0NFS1VCUVRna2pBSkJDQThMUVg4UEN5T01Ba0VCYWtILy93TnhKSXdDQzBFRUM5Z0JBUUYvSTR3Q1FRRnFRZi8vQTNFaEFTT1FBZ1JBSUFGQkFXdEIvLzhEY1NFQkN5QUJKSXdDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGckRnNEJBZ01FQlFZSENBa0tDd3dORGc4TElBQVFxQUVQQ3lBQUVLa0JEd3NnQUJDcUFROExJQUFRcXdFUEN5QUFFS3dCRHdzZ0FCQ3RBUThMSUFBUXJnRVBDeUFBRUs4QkR3c2dBQkN6QVE4TElBQVF0Z0VQQ3lBQUVMa0JEd3NnQUJDOEFROExJQUFReVFFUEN5QUFFTW9CRHdzZ0FCRExBUThMSUFBUXpBRUx2Z0VCQW45QkFDUzNBVUdQL2dNUUhVRUJJQUIwUVg5emNTSUJKTDhCUVkvK0F5QUJFQjhqaXdKQkFtdEIvLzhEY1NTTEFpT0xBaUlCSTR3Q0lnSkIvd0Z4RUI4Z0FVRUJhaUFDUVlEK0EzRkJDSFVRSHdKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0F3TUVCUUFMREFVTFFRQWt3QUZCd0FBa2pBSU1CQXRCQUNUQkFVSElBQ1NNQWd3REMwRUFKTUlCUWRBQUpJd0NEQUlMUVFBa3d3RkIyQUFrakFJTUFRdEJBQ1RFQVVIZ0FDU01BZ3NMNlFFQkFuOGp1QUVFUUVFQkpMY0JRUUFrdUFFTEk3a0JJNzhCY1VFZmNVRUFTZ1JBSTQ4Q1JVRUFJN2NCR3dSL0k4QUJRUUFqdWdFYkJIOUJBQkRPQVVFQkJTUEJBVUVBSTdzQkd3Ui9RUUVRemdGQkFRVWp3Z0ZCQUNPOEFSc0VmMEVDRU00QlFRRUZJOE1CUVFBanZRRWJCSDlCQXhET0FVRUJCU1BFQVVFQUk3NEJHd1IvUVFRUXpnRkJBUVZCQUFzTEN3c0xCVUVBQ3dSQVFRRWpqd0lqamdJYkJIOUJBQ1NQQWtFQUpJNENRUUFra0FKQkFDU1JBa0VZQlVFVUN5RUFDMEVCSTQ4Q0k0NENHd1JBUVFBa2p3SkJBQ1NPQWtFQUpKQUNRUUFra1FJTElBQVBDMEVBQzdZQkFRSi9RUUVrbUFJamtBSUVRQ09NQWhBZFFmOEJjUkROQVJDYUFVRUFKSThDUVFBa2pnSkJBQ1NRQWtFQUpKRUNDeERQQVNJQVFRQktCRUFnQUJDYUFRdEJCQ0VBUVFBamtRSkZRUUVqandJampnSWJHd1JBSTR3Q0VCMUIvd0Z4RU0wQklRQUxJNG9DUWZBQmNTU0tBaUFBUVFCTUJFQWdBQThMSUFBUW1nRWpsd0pCQVdvaUFTT1ZBazRFZnlPV0FrRUJhaVNXQWlBQkk1VUNhd1VnQVFza2x3SWpqQUlqM1FGR0JFQkJBU1RnQVFzZ0FBc0ZBQ08yQVF1dUFRRURmeUFBUVg5QmdBZ2dBRUVBU0JzZ0FFRUFTaHNoQWtFQUlRQURRQ1BnQVVWQkFDQUJSVUVBUVFBZ0FFVWdBeHNiR3dSQUVOQUJRUUJJQkVCQkFTRURCU09OQWtIUXBBUWpnZ0owVGdSQVFRRWhBQVZCQVNBQkk3WUJJQUpPUVFBZ0FrRi9TaHNiSVFFTEN3d0JDd3NnQUFSQUk0MENRZENrQkNPQ0FuUnJKSTBDUVFBUEN5QUJCRUJCQVE4TEkrQUJCRUJCQUNUZ0FVRUNEd3NqakFKQkFXdEIvLzhEY1NTTUFrRi9Dd2NBUVg4UTBnRUxOQUVDZndOQUlBRkJBRTVCQUNBQ0lBQklHd1JBUVg4UTBnRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09TQWdzRkFDT1RBZ3NGQUNPVUFndGJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09CZ01FQlFZSENBQUxEQWdMSTlJQkR3c2oxUUVQQ3lQVEFROExJOVFCRHdzajFnRVBDeVBYQVE4TEk5Z0JEd3NqMlFFUEMwRUFDNGNCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQmdNRUJRWUhDQUFMREFnTElBRkJBRWNrMGdFTUJ3c2dBVUVBUnlUVkFRd0dDeUFCUVFCSEpOTUJEQVVMSUFGQkFFY2sxQUVNQkFzZ0FVRUFSeVRXQVF3REN5QUJRUUJISk5jQkRBSUxJQUZCQUVjazJBRU1BUXNnQVVFQVJ5VFpBUXNMVVFFQmYwRUFKSkVDSUFBUTJBRkZCRUJCQVNFQkN5QUFRUUVRMlFFZ0FRUkFRUUZCQVVFQVFRRkJBQ0FBUVFOTUd5SUFRUUFqMndFYkd5QUFSVUVBSTl3Qkd4c0VRRUVCSk1RQlFRUVFXZ3NMQ3drQUlBQkJBQkRaQVF1YUFRQWdBRUVBU2dSQVFRQVEyZ0VGUVFBUTJ3RUxJQUZCQUVvRVFFRUJFTm9CQlVFQkVOc0JDeUFDUVFCS0JFQkJBaERhQVFWQkFoRGJBUXNnQTBFQVNnUkFRUU1RMmdFRlFRTVEyd0VMSUFSQkFFb0VRRUVFRU5vQkJVRUVFTnNCQ3lBRlFRQktCRUJCQlJEYUFRVkJCUkRiQVFzZ0JrRUFTZ1JBUVFZUTJnRUZRUVlRMndFTElBZEJBRW9FUUVFSEVOb0JCVUVIRU5zQkN3c0hBQ0FBSk4wQkN3Y0FRWDhrM1FFTEJ3QWdBQ1RlQVFzSEFFRi9KTjRCQ3djQUlBQWszd0VMQndCQmZ5VGZBUXNGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0lBZ3NGQUNPSkFnc0ZBQ09LQWdzRkFDT01BZ3NGQUNPTEFnc0xBQ09NQWhBZFFmOEJjUXNGQUNQdEFRdXJBd0VLZjBHQWdBSkJnSkFDSStZQkd5RUlRWUM0QWtHQXNBSWo1d0ViSVFrRFFDQUZRWUFDU0FSQVFRQWhCQU5BSUFSQmdBSklCRUFnQ0NBRlFRTjFRUVYwSUFscUlBUkJBM1ZxSWdKQmdKQithaTBBQUJCTklRWWdCVUVJYnlFQlFRY2dCRUVJYjJzaEIwRUFJUU1DZnlBQVFRQktRUUFqZ1FJYkJFQWdBa0dBMEg1cUxRQUFJUU1MSUFOQndBQnhDd1JBUVFjZ0FXc2hBUXRCQUNFQ0lBRkJBWFFnQm1vaUJrR0FrSDVxUVFGQkFDQURRUWh4R3lJQ1FRMTBhaTBBQUNFS1FRQWhBU0FHUVlHUWZtb2dBa0VOZEdvdEFBQkJBU0FIZEhFRVFFRUNJUUVMSUFGQkFXb2dBVUVCSUFkMElBcHhHeUVCSUFWQkNIUWdCR3BCQTJ3aEFpQUFRUUJLUVFBamdRSWJCRUFnQWtHQW9RdHFJZ0lnQTBFSGNTQUJRUUFRVGlJQlFSOXhRUU4wT2dBQUlBSkJBV29nQVVIZ0IzRkJCWFZCQTNRNkFBQWdBa0VDYWlBQlFZRDRBWEZCQ25WQkEzUTZBQUFGSUFKQmdLRUxhaUlESUFGQngvNERFRThpQVVHQWdQd0hjVUVRZFRvQUFDQURRUUZxSUFGQmdQNERjVUVJZFRvQUFDQURRUUpxSUFFNkFBQUxJQVJCQVdvaEJBd0JDd3NnQlVFQmFpRUZEQUVMQ3d2VkF3RU1md05BSUFSQkYwNUZCRUJCQUNFREEwQWdBMEVmU0FSQVFRRkJBQ0FEUVE5S0lnY2JJUWtnQkVFUGF5QUVJQVJCRDBvaUFCdEJCSFFpQlNBRFFROXJhaUFESUFWcUlBY2JJUWhCZ0pBQ1FZQ0FBaUFBR3lFS1FjZitBeUVIUVg4aEJrRi9JUVZCQUNFQkEwQWdBVUVJU0FSQVFRQWhBQU5BSUFCQkJVZ0VRQ0FBUVFOMElBRnFRUUowSWdKQmd2d0RhaEFkSUFoR0JFQWdBa0dEL0FOcUVCMGhBa0VCUVFBZ0FrRUljVUVBSTRFQ0d4c2dDVVlFUUVFSUlRRkJCU0VBSUFJaUJVRVFjUVIvUWNuK0F3VkJ5UDREQ3lFSEN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFWQkFFaEJBQ09CQWhzRVFFR0F1QUpCZ0xBQ0krY0JHeUVMUVg4aEFFRUFJUUlEUUNBQ1FTQklCRUJCQUNFQkEwQWdBVUVnU0FSQUlBRkJCWFFnQzJvZ0Ftb2lCa0dBa0g1cUxRQUFJQWhHQkVCQklDRUNRU0FoQVNBR0lRQUxJQUZCQVdvaEFRd0JDd3NnQWtFQmFpRUNEQUVMQ3lBQVFRQk9CSDhnQUVHQTBINXFMUUFBQlVGL0N5RUdDMEVBSVFBRFFDQUFRUWhJQkVBZ0NDQUtJQWxCQUVFSElBQWdBMEVEZENBRVFRTjBJQUJxUWZnQlFZQ2hGeUFISUFZZ0JSQlFHaUFBUVFGcUlRQU1BUXNMSUFOQkFXb2hBd3dCQ3dzZ0JFRUJhaUVFREFFTEN3dVdBZ0VKZndOQUlBUkJDRTVGQkVCQkFDRUJBMEFnQVVFRlNBUkFJQUZCQTNRZ0JHcEJBblFpQUVHQS9BTnFFQjBhSUFCQmdmd0RhaEFkR2lBQVFZTDhBMm9RSFNFQ1FRRWhCU1BvQVFSQUlBSkJBbTlCQVVZRVFDQUNRUUZySVFJTFFRSWhCUXNnQUVHRC9BTnFFQjBoQmtFQUlRZEJBVUVBSUFaQkNIRkJBQ09CQWhzYklRZEJ5UDRESVFoQnlmNERRY2orQXlBR1FSQnhHeUVJUVFBaEFBTkFJQUFnQlVnRVFFRUFJUU1EUUNBRFFRaElCRUFnQUNBQ2FrR0FnQUlnQjBFQVFRY2dBeUFFUVFOMElBRkJCSFFnQTJvZ0FFRURkR3BCd0FCQmdLRWdJQWhCZnlBR0VGQWFJQU5CQVdvaEF3d0JDd3NnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTElBUkJBV29oQkF3QkN3c0xCUUFqeGdFTEJRQWp4d0VMQlFBanlnRUxHQUVCZnlQTUFTRUFJOHNCQkVBZ0FFRUVjaUVBQ3lBQUN6QUJBWDhEUUFKQUlBQkIvLzhEVGcwQUlBQkJnTFhKQkdvZ0FCQjJPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVGdBUXNXQUJBYlB3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEM5d0JBQ0FBUVp3Q1NRUkFEd3NnQUVFUWF5RUFBa0FDUUFKQUFrQUNRQUpBSUFGQkFVY0VRQ0FCUVFKR0RRRUNRQ0FCUVFOckRnTURCQVVBQ3d3RkN5QUFFQmtNQlFzZ0FDZ0NCRUgvLy8vL0FIRkJBRTBFUUVFQVFZQUJRY3NBUVJFUUFBQUxJQUFnQUNnQ0JFRUJhellDQkNBQUVBY01CQXNnQUJBS0RBTUxJQUFvQWdRaUFVR0FnSUNBZjNFZ0FVRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUFVSFdBRUVHRUFBQUN5QUFJQUZCQVdvMkFnUWdBVUdBZ0lDQUIzRUVRQ0FBRUFrTERBSUxJQUFRQ3d3QkMwRUFRWUFCUWVFQVFSZ1FBQUFMQ3kwQUFrQUNRQUpBSUFCQkNHc29BZ0FPQXdBQUFRSUxEd3NnQUNnQ0FDSUFCRUFnQUNBQkVQZ0JDdzhMQUFzREFBRUxIUUFDUUFKQUFrQWptZ0lPQWdFQ0FBc0FDMEVBSVFBTElBQVEwZ0VMQndBZ0FDU2FBZ3NsQUFKQUFrQUNRQUpBSTVvQ0RnTUJBZ01BQ3dBTFFRRWhBQXRCZnlFQkN5QUJFTklCQ3d1ZkFnWUFRUWdMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFkQUJzQUhNQVpnQXVBSFFBY3dCQk9BczNLQUFBQUFFQUFBQUJBQUFBS0FBQUFHRUFiQUJzQUc4QVl3QmhBSFFBYVFCdkFHNEFJQUIwQUc4QWJ3QWdBR3dBWVFCeUFHY0FaUUJCOEFBTExSNEFBQUFCQUFBQUFRQUFBQjRBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzhBY0FCMUFISUFaUUF1QUhRQWN3QkJvQUVMTXlRQUFBQUJBQUFBQVFBQUFDUUFBQUJKQUc0QVpBQmxBSGdBSUFCdkFIVUFkQUFnQUc4QVpnQWdBSElBWVFCdUFHY0FaUUJCMkFFTEl4UUFBQUFCQUFBQUFRQUFBQlFBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzRBZEFCekFFR0FBZ3NWQXdBQUFCQUFBQUFBQUFBQUVBQUFBQUFBQUFBUUFETVFjMjkxY21ObFRXRndjR2x1WjFWU1RDRmpiM0psTDJScGMzUXZZMjl5WlM1MWJuUnZkV05vWldRdWQyRnpiUzV0WVhBPSIpKS5pbnN0YW5jZTsKY29uc3QgYj1uZXcgVWludDhBcnJheShhLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcik7cmV0dXJue2luc3RhbmNlOmEsYnl0ZU1lbW9yeTpiLHR5cGU6IldlYiBBc3NlbWJseSJ9fTtsZXQgcix1LEUsYztjPXtncmFwaGljc1dvcmtlclBvcnQ6dm9pZCAwLG1lbW9yeVdvcmtlclBvcnQ6dm9pZCAwLGNvbnRyb2xsZXJXb3JrZXJQb3J0OnZvaWQgMCxhdWRpb1dvcmtlclBvcnQ6dm9pZCAwLHdhc21JbnN0YW5jZTp2b2lkIDAsd2FzbUJ5dGVNZW1vcnk6dm9pZCAwLG9wdGlvbnM6dm9pZCAwLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLApXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxzcGVlZDowLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj1uKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8KKGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKE0uYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEwuYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShLLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBQKHApOwpjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBMQVk6aWYoIWMucGF1c2VkfHwhYy53YXNtSW5zdGFuY2V8fCFjLndhc21CeXRlTWVtb3J5KXtrKGgoe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWMucGF1c2VkPSExO2MuZnBzVGltZVN0YW1wcz1bXTt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0KMDtjLm9wdGlvbnMuaXNHYmNDb2xvcml6YXRpb25FbmFibGVkP2Mub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlJiZjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoIndhc21ib3lnYiBicm93biByZWQgZGFya2Jyb3duIGdyZWVuIGRhcmtncmVlbiBpbnZlcnRlZCBwYXN0ZWxtaXggb3JhbmdlIHllbGxvdyBibHVlIGRhcmtibHVlIGdyYXlzY2FsZSIuc3BsaXQoIiAiKS5pbmRleE9mKGMub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlLnRvTG93ZXJDYXNlKCkpKTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoMCk7RihjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLApiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SVU5fV0FTTV9FWFBPUlQ6YT1iLm1lc3NhZ2UucGFyYW1ldGVycz9jLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO2soaCh7dHlwZTpmLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBkPWMud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoZD1iLm1lc3NhZ2UuZW5kKTthPWMud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxkKS5idWZmZXI7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZi5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6Zi5HRVRfV0FTTV9DT05TVEFOVCwKcmVzcG9uc2U6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuRk9SQ0VfT1VUUFVUX0ZSQU1FOkMoYyk7YnJlYWs7Y2FzZSBmLlNFVF9TUEVFRDpjLnNwZWVkPWIubWVzc2FnZS5zcGVlZDtjLmZwc1RpbWVTdGFtcHM9W107Yy50aW1lU3RhbXBzVW50aWxSZWFkeT02MDt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0wO2Mud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2JyZWFrO2Nhc2UgZi5JU19HQkM6YT0wPGMud2FzbUluc3RhbmNlLmV4cG9ydHMuaXNHQkMoKTtrKGgoe3R5cGU6Zi5JU19HQkMscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKCJVbmtub3duIFdhc21Cb3kgV29ya2VyIG1lc3NhZ2U6IixiKX19LGdldEZQUzooKT0+MDxjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PwpjLnNwZWVkJiYwPGMuc3BlZWQ/Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqYy5zcGVlZDpjLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpjLmZwc1RpbWVTdGFtcHM/Yy5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGMubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

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
var version = "0.5.1";
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
	"test:integration": "npx run-s build test:integration:nobuild",
	"test:integration:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/integration/integration-test.js --exit",
	"debugger:dev": "npm run debugger:watch",
	"debugger:watch": "npx rollup -c -w --environment DEBUGGER,SERVE",
	"debugger:build": "npx rollup -c --environment DEBUGGER",
	"debugger:build:skiplib": "npx rollup -c --environment DEBUGGER,SKIP_LIB",
	"benchmark:build": "npx rollup -c --environment PROD,TS,BENCHMARK",
	"benchmark:build:skiplib": "npx rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
	"benchmark:dev": "npm run benchmark:watch",
	"benchmark:watch": "npx rollup -c -w --environment BENCHMARK,SERVE",
	"amp:build": "npx rollup -c --environment PROD,TS,AMP",
	"amp:build:skiplib": "npx rollup -c --environment PROD,TS,AMP,SKIP_LIB",
	"amp:dev": "npm run amp:watch",
	"amp:watch": "npx rollup -c -w --environment AMP,SERVE",
	"iframe:dev": "npm run iframe:watch",
	"iframe:watch": "npx rollup -c -w --environment IFRAME,SERVE",
	"iframe:serve": "npx serve build/iframe -p 8080",
	"iframe:build": "npx rollup -c --environment IFRAME",
	"iframe:build:skiplib": "npx rollup -c --environment IFRAME,SKIP_LIB",
	"demo:build": "npx run-s core:build lib:build demo:build:apps",
	"demo:build:apps": "npx run-s debugger:build:skiplib benchmark:build:skiplib amp:build:skiplib iframe:build:skiplib",
	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
	"demo:dist": "cp -r dist/ build/dist",
	"demo:gh-pages": "npx gh-pages -d build",
	"demo:deploy": "npx run-s demo:build demo:dist demo:cname demo:gh-pages",
	"wasmerboy:build": "npx asc demo/wasmerboy/index.ts -b demo/wasmerboy/dist/wasmerboy.wasm -O3 --validate --use abort=wasi_abort --runtime stub --memoryBase 8324096",
	"wasmerboy:start": "cd demo/wasmerboy && wapm run wasmerboy --dir=tobutobugirl tobutobugirl/tobutobugirl.gb && cd .."
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
	"@rollup/plugin-commonjs": "^11.0.2",
	"@rollup/plugin-node-resolve": "^7.1.1",
	"@wasmer/io-devices-lib-assemblyscript": "^0.1.3",
	"as-wasi": "git+https://github.com/jedisct1/as-wasi.git",
	assemblyscript: "^0.8.1",
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
	"rollup-plugin-copy-glob": "^0.2.2",
	"rollup-plugin-delete": "^0.1.2",
	"rollup-plugin-hash": "^1.3.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-livereload": "^1.0.4",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-postcss": "^1.6.2",
	"rollup-plugin-replace": "^2.1.0",
	"rollup-plugin-serve": "^0.6.0",
	"rollup-plugin-svelte": "^5.1.1",
	"rollup-plugin-terser": "^5.2.0",
	"rollup-plugin-typescript": "^1.0.0",
	"rollup-plugin-url": "^2.1.0",
	serve: "^11.3.0",
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
