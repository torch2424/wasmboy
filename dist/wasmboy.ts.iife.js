var WasmBoy = (function (exports) {
  'use strict';

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

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var idb = createCommonjsModule(function (module) {

  (function() {
    function toArray(arr) {
      return Array.prototype.slice.call(arr);
    }

    function promisifyRequest(request) {
      return new Promise(function(resolve, reject) {
        request.onsuccess = function() {
          resolve(request.result);
        };

        request.onerror = function() {
          reject(request.error);
        };
      });
    }

    function promisifyRequestCall(obj, method, args) {
      var request;
      var p = new Promise(function(resolve, reject) {
        request = obj[method].apply(obj, args);
        promisifyRequest(request).then(resolve, reject);
      });

      p.request = request;
      return p;
    }

    function promisifyCursorRequestCall(obj, method, args) {
      var p = promisifyRequestCall(obj, method, args);
      return p.then(function(value) {
        if (!value) return;
        return new Cursor(value, p.request);
      });
    }

    function proxyProperties(ProxyClass, targetProp, properties) {
      properties.forEach(function(prop) {
        Object.defineProperty(ProxyClass.prototype, prop, {
          get: function() {
            return this[targetProp][prop];
          },
          set: function(val) {
            this[targetProp][prop] = val;
          }
        });
      });
    }

    function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
      properties.forEach(function(prop) {
        if (!(prop in Constructor.prototype)) return;
        ProxyClass.prototype[prop] = function() {
          return promisifyRequestCall(this[targetProp], prop, arguments);
        };
      });
    }

    function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
      properties.forEach(function(prop) {
        if (!(prop in Constructor.prototype)) return;
        ProxyClass.prototype[prop] = function() {
          return this[targetProp][prop].apply(this[targetProp], arguments);
        };
      });
    }

    function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
      properties.forEach(function(prop) {
        if (!(prop in Constructor.prototype)) return;
        ProxyClass.prototype[prop] = function() {
          return promisifyCursorRequestCall(this[targetProp], prop, arguments);
        };
      });
    }

    function Index(index) {
      this._index = index;
    }

    proxyProperties(Index, '_index', [
      'name',
      'keyPath',
      'multiEntry',
      'unique'
    ]);

    proxyRequestMethods(Index, '_index', IDBIndex, [
      'get',
      'getKey',
      'getAll',
      'getAllKeys',
      'count'
    ]);

    proxyCursorRequestMethods(Index, '_index', IDBIndex, [
      'openCursor',
      'openKeyCursor'
    ]);

    function Cursor(cursor, request) {
      this._cursor = cursor;
      this._request = request;
    }

    proxyProperties(Cursor, '_cursor', [
      'direction',
      'key',
      'primaryKey',
      'value'
    ]);

    proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
      'update',
      'delete'
    ]);

    // proxy 'next' methods
    ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
      if (!(methodName in IDBCursor.prototype)) return;
      Cursor.prototype[methodName] = function() {
        var cursor = this;
        var args = arguments;
        return Promise.resolve().then(function() {
          cursor._cursor[methodName].apply(cursor._cursor, args);
          return promisifyRequest(cursor._request).then(function(value) {
            if (!value) return;
            return new Cursor(value, cursor._request);
          });
        });
      };
    });

    function ObjectStore(store) {
      this._store = store;
    }

    ObjectStore.prototype.createIndex = function() {
      return new Index(this._store.createIndex.apply(this._store, arguments));
    };

    ObjectStore.prototype.index = function() {
      return new Index(this._store.index.apply(this._store, arguments));
    };

    proxyProperties(ObjectStore, '_store', [
      'name',
      'keyPath',
      'indexNames',
      'autoIncrement'
    ]);

    proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
      'put',
      'add',
      'delete',
      'clear',
      'get',
      'getAll',
      'getKey',
      'getAllKeys',
      'count'
    ]);

    proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
      'openCursor',
      'openKeyCursor'
    ]);

    proxyMethods(ObjectStore, '_store', IDBObjectStore, [
      'deleteIndex'
    ]);

    function Transaction(idbTransaction) {
      this._tx = idbTransaction;
      this.complete = new Promise(function(resolve, reject) {
        idbTransaction.oncomplete = function() {
          resolve();
        };
        idbTransaction.onerror = function() {
          reject(idbTransaction.error);
        };
        idbTransaction.onabort = function() {
          reject(idbTransaction.error);
        };
      });
    }

    Transaction.prototype.objectStore = function() {
      return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
    };

    proxyProperties(Transaction, '_tx', [
      'objectStoreNames',
      'mode'
    ]);

    proxyMethods(Transaction, '_tx', IDBTransaction, [
      'abort'
    ]);

    function UpgradeDB(db, oldVersion, transaction) {
      this._db = db;
      this.oldVersion = oldVersion;
      this.transaction = new Transaction(transaction);
    }

    UpgradeDB.prototype.createObjectStore = function() {
      return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
    };

    proxyProperties(UpgradeDB, '_db', [
      'name',
      'version',
      'objectStoreNames'
    ]);

    proxyMethods(UpgradeDB, '_db', IDBDatabase, [
      'deleteObjectStore',
      'close'
    ]);

    function DB(db) {
      this._db = db;
    }

    DB.prototype.transaction = function() {
      return new Transaction(this._db.transaction.apply(this._db, arguments));
    };

    proxyProperties(DB, '_db', [
      'name',
      'version',
      'objectStoreNames'
    ]);

    proxyMethods(DB, '_db', IDBDatabase, [
      'close'
    ]);

    // Add cursor iterators
    // TODO: remove this once browsers do the right thing with promises
    ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
      [ObjectStore, Index].forEach(function(Constructor) {
        // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
        if (!(funcName in Constructor.prototype)) return;

        Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
          var args = toArray(arguments);
          var callback = args[args.length - 1];
          var nativeObject = this._store || this._index;
          var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
          request.onsuccess = function() {
            callback(request.result);
          };
        };
      });
    });

    // polyfill getAll
    [Index, ObjectStore].forEach(function(Constructor) {
      if (Constructor.prototype.getAll) return;
      Constructor.prototype.getAll = function(query, count) {
        var instance = this;
        var items = [];

        return new Promise(function(resolve) {
          instance.iterateCursor(query, function(cursor) {
            if (!cursor) {
              resolve(items);
              return;
            }
            items.push(cursor.value);

            if (count !== undefined && items.length == count) {
              resolve(items);
              return;
            }
            cursor.continue();
          });
        });
      };
    });

    var exp = {
      open: function(name, version, upgradeCallback) {
        var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
        var request = p.request;

        if (request) {
          request.onupgradeneeded = function(event) {
            if (upgradeCallback) {
              upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
            }
          };
        }

        return p.then(function(db) {
          return new DB(db);
        });
      },
      delete: function(name) {
        return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
      }
    };

    {
      module.exports = exp;
      module.exports.default = module.exports;
    }
  }());
  });

  var node = createCommonjsModule(function (module) {
  if (typeof indexedDB != 'undefined') {
    module.exports = idb;
  }
  else {
    module.exports = {
      open: function () {
        return Promise.reject('IDB requires a browser environment');
      },
      delete: function () {
        return Promise.reject('IDB requires a browser environment');
      }
    };
  }
  });
  var node_1 = node.open;

  // Get our idb instance, and initialize to asn idb-keyval
  let keyval = false; // Get our idb dPromise

  if (typeof window !== 'undefined') {
    const dbPromise = node.open('wasmboy', 1, upgradeDB => {
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

  var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGViKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gZWEoYSxjKXtuYj9zZWxmLnBvc3RNZXNzYWdlKGEsYyk6QmIucG9zdE1lc3NhZ2UoYSxjKX1mdW5jdGlvbiBmYihhLGMpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihjKWlmKG5iKWMub25tZXNzYWdlPWE7ZWxzZSBjLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKG5iKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBCYi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTyhhLGMsYil7Y3x8KGM9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksb2IrKyxjPWAke2N9LSR7b2J9YCwxRTU8b2ImJihvYj0wKSk7cmV0dXJue3dvcmtlcklkOmIsbWVzc2FnZUlkOmMsbWVzc2FnZTphfX1mdW5jdGlvbiB4YyhhLGMpe2M9ZWIoYyk7CnN3aXRjaChjLm1lc3NhZ2UudHlwZSl7Y2FzZSBCLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShPKHt0eXBlOkIuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9MT0NBVElPTi52YWx1ZU9mKCl9LGMubWVzc2FnZUlkKSl9fWZ1bmN0aW9uIHljKGEsYyl7Yz1lYihjKTtzd2l0Y2goYy5tZXNzYWdlLnR5cGUpe2Nhc2UgQi5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5BVURJT19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpOwphLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfMV9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8yX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzNfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfNF9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oe3R5cGU6Qi5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5BVURJT19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpfSwKYy5tZXNzYWdlSWQpKTticmVhaztjYXNlIEIuQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yy5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIHpjKGEsYyl7Yz1lYihjKTtzd2l0Y2goYy5tZXNzYWdlLnR5cGUpe2Nhc2UgQi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxjLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gJGIoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5O2xldCBjPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XSxiPXZvaWQgMDtpZigwPT09YylyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7MTw9YyYmMz49Yz9iPTMyNzY4OjU8PWMmJjY+PWM/Yj0yMDQ4OjE1PD1jJiYxOT49Yz9iPTMyNzY4OjI1PD1jJiYzMD49YyYmKGI9MTMxMDcyKTtyZXR1cm4gYj9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2IpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIGFjKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gQWMoYSxjKXtjPWViKGMpO3N3aXRjaChjLm1lc3NhZ2UudHlwZSl7Y2FzZSBCLkNMRUFSX01FTU9SWTpmb3IodmFyIGI9MDtiPD1hLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiKyspYS53YXNtQnl0ZU1lbW9yeVtiXT0wO2I9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTyh7dHlwZTpCLkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmIuYnVmZmVyfSxjLm1lc3NhZ2VJZCksW2IuYnVmZmVyXSk7CmJyZWFrO2Nhc2UgQi5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9CT09UX1JPTV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9TSVpFLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTyh7dHlwZTpCLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9ST01fTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DQVJUUklER0VfUkFNX0xPQ0FUSU9OLnZhbHVlT2YoKSwKV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9TSVpFLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQkNfUEFMRVRURV9MT0NBVElPTi52YWx1ZU9mKCl9LApjLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQi5TRVRfTUVNT1JZOmI9T2JqZWN0LmtleXMoYy5tZXNzYWdlKTtiLmluY2x1ZGVzKEMuQk9PVF9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2VbQy5CT09UX1JPTV0pLGEuV0FTTUJPWV9CT09UX1JPTV9MT0NBVElPTik7Yi5pbmNsdWRlcyhDLkNBUlRSSURHRV9ST00pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2VbQy5DQVJUUklER0VfUk9NXSksYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04pO2IuaW5jbHVkZXMoQy5DQVJUUklER0VfUkFNKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYy5tZXNzYWdlW0MuQ0FSVFJJREdFX1JBTV0pLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTik7Yi5pbmNsdWRlcyhDLkdBTUVCT1lfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYy5tZXNzYWdlW0MuR0FNRUJPWV9NRU1PUlldKSwKYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7Yi5pbmNsdWRlcyhDLlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYy5tZXNzYWdlW0MuUEFMRVRURV9NRU1PUlldKSxhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pO2IuaW5jbHVkZXMoQy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2VbQy5JTlRFUk5BTF9TVEFURV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTiksYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5sb2FkU3RhdGUoKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oe3R5cGU6Qi5TRVRfTUVNT1JZX0RPTkV9LGMubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBCLkdFVF9NRU1PUlk6e2I9e3R5cGU6Qi5HRVRfTUVNT1JZfTtsZXQgVz1bXTt2YXIgZD1jLm1lc3NhZ2UubWVtb3J5VHlwZXM7aWYoZC5pbmNsdWRlcyhDLkJPT1RfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7dmFyIGU9CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShlLGUrYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9TSVpFLnZhbHVlT2YoKSl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7YltDLkJPT1RfUk9NXT1lO1cucHVzaChlKX1pZihkLmluY2x1ZGVzKEMuQ0FSVFJJREdFX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe2U9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddO3ZhciBnPXZvaWQgMDswPT09ZT9nPTMyNzY4OjE8PWUmJjM+PWU/Zz0yMDk3MTUyOjU8PWUmJjY+PWU/Zz0yNjIxNDQ6MTU8PWUmJjE5Pj1lP2c9MjA5NzE1MjoyNTw9ZSYmMzA+PWUmJihnPTgzODg2MDgpO2U9Zz9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK2cpOgpuZXcgVWludDhBcnJheX1lbHNlIGU9bmV3IFVpbnQ4QXJyYXk7ZT1lLmJ1ZmZlcjtiW0MuQ0FSVFJJREdFX1JPTV09ZTtXLnB1c2goZSl9ZC5pbmNsdWRlcyhDLkNBUlRSSURHRV9SQU0pJiYoZT0kYihhKS5idWZmZXIsYltDLkNBUlRSSURHRV9SQU1dPWUsVy5wdXNoKGUpKTtkLmluY2x1ZGVzKEMuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGJbQy5DQVJUUklER0VfSEVBREVSXT1lLFcucHVzaChlKSk7ZC5pbmNsdWRlcyhDLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmJbQy5HQU1FQk9ZX01FTU9SWV09ZSxXLnB1c2goZSkpO2QuaW5jbHVkZXMoQy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGJbQy5QQUxFVFRFX01FTU9SWV09ZSxXLnB1c2goZSkpO2QuaW5jbHVkZXMoQy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGQ9YWMoYSkuYnVmZmVyLGJbQy5JTlRFUk5BTF9TVEFURV09ZCxXLnB1c2goZCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShPKGIsYy5tZXNzYWdlSWQpLFcpfX19ZnVuY3Rpb24gcGIoYSxjKXthPTE8PGEmMjU1O2IucmVnaXN0ZXJGPTA8Yz9iLnJlZ2lzdGVyRnxhOmIucmVnaXN0ZXJGJigyNTVeYSk7cmV0dXJuIGIucmVnaXN0ZXJGfWZ1bmN0aW9uIEEoYSl7cGIoNywKYSl9ZnVuY3Rpb24geChhKXtwYig2LGEpfWZ1bmN0aW9uIEsoYSl7cGIoNSxhKX1mdW5jdGlvbiBNKGEpe3BiKDQsYSl9ZnVuY3Rpb24gU2EoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjcmMX1mdW5jdGlvbiBUKCl7cmV0dXJuIGIucmVnaXN0ZXJGPj40JjF9ZnVuY3Rpb24gUihhLGMpezA8PWM/SygwIT09KChhJjE1KSsoYyYxNSkmMTYpKTpLKChNYXRoLmFicyhjKSYxNSk+KGEmMTUpKX1mdW5jdGlvbiBEYihhLGMpezA8PWM/TShhPihhK2MmMjU1KSk6TShNYXRoLmFicyhjKT5hKX1mdW5jdGlvbiBXYShhLGMsYil7Yj8oYT1hXmNeYStjLEsoMCE9PShhJjE2KSksTSgwIT09KGEmMjU2KSkpOihiPWErYyY2NTUzNSxNKGI8YSksSygwIT09KChhXmNeYikmNDA5NikpKX1mdW5jdGlvbiBiYyhhKXtzd2l0Y2goYSl7Y2FzZSAwOmQuYmdXaGl0ZT1OLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1OLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1OLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPU4uYmdCbGFjazsKZC5vYmowV2hpdGU9Ti5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PU4ub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1OLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1OLm9iajBCbGFjaztkLm9iajFXaGl0ZT1OLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9Ti5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PU4ub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPU4ub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMTpkLmJnV2hpdGU9aWEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PWlhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1pYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1pYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPWlhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9aWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1pYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9aWEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPWlhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9aWEub2JqMUxpZ2h0R3JleTsKZC5vYmoxRGFya0dyZXk9aWEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPWlhLm9iajFCbGFjazticmVhaztjYXNlIDI6ZC5iZ1doaXRlPWphLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1qYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9amEuYmdEYXJrR3JleTtkLmJnQmxhY2s9amEuYmdCbGFjaztkLm9iajBXaGl0ZT1qYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PWphLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9amEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPWphLm9iajBCbGFjaztkLm9iajFXaGl0ZT1qYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PWphLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9amEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPWphLm9iajFCbGFjazticmVhaztjYXNlIDM6ZC5iZ1doaXRlPWthLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1rYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9a2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9a2EuYmdCbGFjazsKZC5vYmowV2hpdGU9a2Eub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1rYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PWthLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1rYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9a2Eub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1rYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PWthLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1rYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA0OmQuYmdXaGl0ZT1sYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9bGEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PWxhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPWxhLmJnQmxhY2s7ZC5vYmowV2hpdGU9bGEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1sYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PWxhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1sYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9bGEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1sYS5vYmoxTGlnaHRHcmV5OwpkLm9iajFEYXJrR3JleT1sYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9bGEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgNTpkLmJnV2hpdGU9bWEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PW1hLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1tYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1tYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPW1hLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9bWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1tYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9bWEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPW1hLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9bWEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1tYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9bWEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgNjpkLmJnV2hpdGU9bmEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PW5hLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1uYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1uYS5iZ0JsYWNrOwpkLm9iajBXaGl0ZT1uYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PW5hLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9bmEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPW5hLm9iajBCbGFjaztkLm9iajFXaGl0ZT1uYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PW5hLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9bmEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPW5hLm9iajFCbGFjazticmVhaztjYXNlIDc6ZC5iZ1doaXRlPW9hLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1vYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9b2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9b2EuYmdCbGFjaztkLm9iajBXaGl0ZT1vYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PW9hLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9b2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPW9hLm9iajBCbGFjaztkLm9iajFXaGl0ZT1vYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PW9hLm9iajFMaWdodEdyZXk7CmQub2JqMURhcmtHcmV5PW9hLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1vYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA4OmQuYmdXaGl0ZT1wYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9cGEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXBhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXBhLmJnQmxhY2s7ZC5vYmowV2hpdGU9cGEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1wYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXBhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1wYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9cGEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1wYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXBhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1wYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA5OmQuYmdXaGl0ZT1xYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9cWEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXFhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXFhLmJnQmxhY2s7CmQub2JqMFdoaXRlPXFhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9cWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1xYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9cWEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXFhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9cWEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1xYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9cWEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMTA6ZC5iZ1doaXRlPXJhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1yYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9cmEuYmdEYXJrR3JleTtkLmJnQmxhY2s9cmEuYmdCbGFjaztkLm9iajBXaGl0ZT1yYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PXJhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9cmEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPXJhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1yYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PXJhLm9iajFMaWdodEdyZXk7CmQub2JqMURhcmtHcmV5PXJhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1yYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxMTpkLmJnV2hpdGU9c2EuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXNhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1zYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1zYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXNhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9c2Eub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1zYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9c2Eub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXNhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9c2Eub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1zYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9c2Eub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMTI6ZC5iZ1doaXRlPXRhLmJnV2hpdGUsZC5iZ0xpZ2h0R3JleT10YS5iZ0xpZ2h0R3JleSxkLmJnRGFya0dyZXk9dGEuYmdEYXJrR3JleSxkLmJnQmxhY2s9dGEuYmdCbGFjaywKZC5vYmowV2hpdGU9dGEub2JqMFdoaXRlLGQub2JqMExpZ2h0R3JleT10YS5vYmowTGlnaHRHcmV5LGQub2JqMERhcmtHcmV5PXRhLm9iajBEYXJrR3JleSxkLm9iajBCbGFjaz10YS5vYmowQmxhY2ssZC5vYmoxV2hpdGU9dGEub2JqMVdoaXRlLGQub2JqMUxpZ2h0R3JleT10YS5vYmoxTGlnaHRHcmV5LGQub2JqMURhcmtHcmV5PXRhLm9iajFEYXJrR3JleSxkLm9iajFCbGFjaz10YS5vYmoxQmxhY2t9fWZ1bmN0aW9uIGwoYSxjKXtyZXR1cm4oYSYyNTUpPDw4fGMmMjU1fWZ1bmN0aW9uIEkoYSl7cmV0dXJuKGEmNjUyODApPj44fWZ1bmN0aW9uIEgoYSxjKXtyZXR1cm4gYyZ+KDE8PGEpfWZ1bmN0aW9uIGcoYSxjKXtyZXR1cm4gMCE9KGMmMTw8YSl9ZnVuY3Rpb24gcWIoYSxjKXthPXYoYyk+PjIqYSYzO2lmKGM9PT1YYS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVPbmUpc3dpdGNoKGM9ZC5vYmowV2hpdGUsYSl7Y2FzZSAxOmM9ZC5vYmowTGlnaHRHcmV5O2JyZWFrO2Nhc2UgMjpjPQpkLm9iajBEYXJrR3JleTticmVhaztjYXNlIDM6Yz1kLm9iajBCbGFja31lbHNlIGlmKGM9PT1YYS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd28pc3dpdGNoKGM9ZC5vYmoxV2hpdGUsYSl7Y2FzZSAxOmM9ZC5vYmoxTGlnaHRHcmV5O2JyZWFrO2Nhc2UgMjpjPWQub2JqMURhcmtHcmV5O2JyZWFrO2Nhc2UgMzpjPWQub2JqMUJsYWNrfWVsc2Ugc3dpdGNoKGM9ZC5iZ1doaXRlLGEpe2Nhc2UgMTpjPWQuYmdMaWdodEdyZXk7YnJlYWs7Y2FzZSAyOmM9ZC5iZ0RhcmtHcmV5O2JyZWFrO2Nhc2UgMzpjPWQuYmdCbGFja31yZXR1cm4gY31mdW5jdGlvbiByYihhLGMsYil7Yz04KmErMipjO2E9Y2MoYysxLGIpO2I9Y2MoYyxiKTtyZXR1cm4gbChhLGIpfWZ1bmN0aW9uIHVhKGEsYyl7YSo9NTtyZXR1cm4gOCooKGMmMzE8PGEpPj5hKX1mdW5jdGlvbiBjYyhhLGMpe2EmPTYzO2MmJihhKz02NCk7cmV0dXJuIGVbWWErYV19ZnVuY3Rpb24gc2IoYSxjLGIsZCl7dm9pZCAwPT09YiYmKGI9CjApO3ZvaWQgMD09PWQmJihkPSExKTtiJj0zO2QmJihifD00KTtlW1phKygxNjAqYythKV09Yn1mdW5jdGlvbiBFYihhLGMsVyxkLHosZixuLGgsayxwLG0scSxsLHcpe3ZhciBHPTA7Yz1nYihjLGEpO2E9WChjKzIqZixXKTtXPVgoYysyKmYrMSxXKTtmb3IoZj1kO2Y8PXo7KytmKWlmKGM9bisoZi1kKSxjPGspe3ZhciBQPWY7aWYoMD5sfHwhZyg1LGwpKVA9Ny1QO3ZhciBWYT0wO2coUCxXKSYmKFZhKz0xLFZhPDw9MSk7ZyhQLGEpJiYoVmErPTEpO2lmKGIuR0JDRW5hYmxlZCYmKDA8PWx8fDA8PXcpKXtQPTA8PXc7dmFyIGZhPWwmNztQJiYoZmE9dyY3KTt2YXIgaGE9cmIoZmEsVmEsUCk7UD11YSgwLGhhKTtmYT11YSgxLGhhKTtoYT11YSgyLGhhKX1lbHNlIGlmKDA+PXEmJihxPXIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksbSl7ZmE9VmE7aGE9bTt2b2lkIDA9PT1oYSYmKGhhPSExKTtQPWZhO2hhfHwoUD12KHEpPj4oZmE8PDEpJjMpO2ZhPTI0Mjtzd2l0Y2goUCl7Y2FzZSAxOmZhPQoxNjA7YnJlYWs7Y2FzZSAyOmZhPTg4O2JyZWFrO2Nhc2UgMzpmYT04fWZhPVA9aGE9ZmF9ZWxzZSBoYT1xYihWYSxxKSxQPShoYSYxNjcxMTY4MCk+PjE2LGZhPShoYSY2NTI4MCk+PjgsaGEmPTI1NTt2YXIgQ2I9MyooaCprK2MpO2VbcCtDYiswXT1QO2VbcCtDYisxXT1mYTtlW3ArQ2IrMl09aGE7UD0hMTswPD1sJiYoUD1nKDcsbCkpO3NiKGMsaCxWYSxQKTtHKyt9cmV0dXJuIEd9ZnVuY3Rpb24gZ2IoYSxjKXthPT09ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0JiYoYz1nKDcsYyk/Yy0xMjg6YysxMjgpO3JldHVybiBhKzE2KmN9ZnVuY3Rpb24gZGMoYSxjKXtzd2l0Y2goYSl7Y2FzZSAxOnJldHVybiBnKGMsMTI5KTtjYXNlIDI6cmV0dXJuIGcoYywxMzUpO2Nhc2UgMzpyZXR1cm4gZyhjLDEyNik7ZGVmYXVsdDpyZXR1cm4gZyhjLDEpfX1mdW5jdGlvbiBGYigpe3ZhciBhPXkuc3dlZXBTaGFkb3dGcmVxdWVuY3ksYz1hPj55Lk5SeDBTd2VlcFNoaWZ0O3kuTlJ4ME5lZ2F0ZT8KKHkuc3dlZXBOZWdhdGVTaG91bGREaXNhYmxlQ2hhbm5lbE9uQ2xlYXI9ITAsYz1hLWMpOmM9YStjO3JldHVybiBjfWZ1bmN0aW9uIHRiKGEpe3N3aXRjaChhKXtjYXNlIHkuY2hhbm5lbE51bWJlcjphPXkuaXNEYWNFbmFibGVkO3ZhciBjPXAuY2hhbm5lbDFEYWNFbmFibGVkIT09YTtwLmNoYW5uZWwxRGFjRW5hYmxlZD1hO3JldHVybiBjO2Nhc2UgRC5jaGFubmVsTnVtYmVyOnJldHVybiBhPUQuaXNEYWNFbmFibGVkLGM9cC5jaGFubmVsMkRhY0VuYWJsZWQhPT1hLHAuY2hhbm5lbDJEYWNFbmFibGVkPWEsYztjYXNlIHQuY2hhbm5lbE51bWJlcjpyZXR1cm4gYT10LmlzRGFjRW5hYmxlZCxjPXAuY2hhbm5lbDNEYWNFbmFibGVkIT09YSxwLmNoYW5uZWwzRGFjRW5hYmxlZD1hLGM7Y2FzZSBGLmNoYW5uZWxOdW1iZXI6cmV0dXJuIGE9Ri5pc0RhY0VuYWJsZWQsYz1wLmNoYW5uZWw0RGFjRW5hYmxlZCE9PWEscC5jaGFubmVsNERhY0VuYWJsZWQ9YSxjfXJldHVybiExfWZ1bmN0aW9uIGhiKCl7Zm9yKHZhciBhPQpoLmJhdGNoUHJvY2Vzc0N5Y2xlcygpLGM9aC5jdXJyZW50Q3ljbGVzO2M+PWE7KWVjKGEpLGMtPWE7aC5jdXJyZW50Q3ljbGVzPWN9ZnVuY3Rpb24gZWMoYSl7dmFyIGM9aC5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCk7dmFyIGI9aC5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyK2E7aWYoYj49Yyl7aC5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWItYztjPWguZnJhbWVTZXF1ZW5jZXIrMSY3O3N3aXRjaChjKXtjYXNlIDA6eS51cGRhdGVMZW5ndGgoKTtELnVwZGF0ZUxlbmd0aCgpO3QudXBkYXRlTGVuZ3RoKCk7Ri51cGRhdGVMZW5ndGgoKTticmVhaztjYXNlIDI6eS51cGRhdGVMZW5ndGgoKTtELnVwZGF0ZUxlbmd0aCgpO3QudXBkYXRlTGVuZ3RoKCk7Ri51cGRhdGVMZW5ndGgoKTt5LnVwZGF0ZVN3ZWVwKCk7YnJlYWs7Y2FzZSA0OnkudXBkYXRlTGVuZ3RoKCk7RC51cGRhdGVMZW5ndGgoKTt0LnVwZGF0ZUxlbmd0aCgpO0YudXBkYXRlTGVuZ3RoKCk7YnJlYWs7Y2FzZSA2OnkudXBkYXRlTGVuZ3RoKCk7CkQudXBkYXRlTGVuZ3RoKCk7dC51cGRhdGVMZW5ndGgoKTtGLnVwZGF0ZUxlbmd0aCgpO3kudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDc6eS51cGRhdGVFbnZlbG9wZSgpLEQudXBkYXRlRW52ZWxvcGUoKSxGLnVwZGF0ZUVudmVsb3BlKCl9aC5mcmFtZVNlcXVlbmNlcj1jO2M9ITB9ZWxzZSBoLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9YixjPSExO2lmKFEuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcyYmIWMpe2M9eS53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8dGIoeS5jaGFubmVsTnVtYmVyKTtiPUQud2lsbENoYW5uZWxVcGRhdGUoYSl8fHRiKEQuY2hhbm5lbE51bWJlcik7dmFyIGU9dC53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8dGIodC5jaGFubmVsTnVtYmVyKSxkPUYud2lsbENoYW5uZWxVcGRhdGUoYSl8fHRiKEYuY2hhbm5lbE51bWJlcik7YyYmKHAuY2hhbm5lbDFTYW1wbGU9eS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2ImJihwLmNoYW5uZWwyU2FtcGxlPUQuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTsKZSYmKHAuY2hhbm5lbDNTYW1wbGU9dC5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2QmJihwLmNoYW5uZWw0U2FtcGxlPUYuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtpZihjfHxifHxlfHxkKXAubmVlZFRvUmVtaXhTYW1wbGVzPSEwO2M9aC5kb3duU2FtcGxlQ3ljbGVDb3VudGVyO2MrPWE7YT1oLm1heERvd25TYW1wbGVDeWNsZXMoKTtjPj1hJiYoYy09YSxwLm5lZWRUb1JlbWl4U2FtcGxlc3x8cC5taXhlclZvbHVtZUNoYW5nZWR8fHAubWl4ZXJFbmFibGVkQ2hhbmdlZD8kYShwLmNoYW5uZWwxU2FtcGxlLHAuY2hhbm5lbDJTYW1wbGUscC5jaGFubmVsM1NhbXBsZSxwLmNoYW5uZWw0U2FtcGxlKTpoLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9YyxhYihwLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlKzEscC5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGUrMSx1YiksYT1oLmF1ZGlvUXVldWVJbmRleCsxLGE+PShoLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplPj4KMXwwKS0xJiYtLWEsaC5hdWRpb1F1ZXVlSW5kZXg9YSk7aC5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPWN9ZWxzZXtjPXkuZ2V0U2FtcGxlKGEpfDA7Yj1ELmdldFNhbXBsZShhKXwwO2U9dC5nZXRTYW1wbGUoYSl8MDtkPUYuZ2V0U2FtcGxlKGEpfDA7cC5jaGFubmVsMVNhbXBsZT1jO3AuY2hhbm5lbDJTYW1wbGU9YjtwLmNoYW5uZWwzU2FtcGxlPWU7cC5jaGFubmVsNFNhbXBsZT1kO2E9aC5kb3duU2FtcGxlQ3ljbGVDb3VudGVyK2E7aWYoYT49aC5tYXhEb3duU2FtcGxlQ3ljbGVzKCkpe2EtPWgubWF4RG93blNhbXBsZUN5Y2xlcygpO3ZhciBnPSRhKGMsYixlLGQpLGY9SShnKTthYihmKzEsKGcmMjU1KSsxLHViKTtRLmVuYWJsZUF1ZGlvRGVidWdnaW5nJiYoZz0kYShjLDE1LDE1LDE1KSxmPUkoZyksYWIoZisxLChnJjI1NSkrMSxHYiksZz0kYSgxNSxiLDE1LDE1KSxmPUkoZyksYWIoZisxLChnJjI1NSkrMSxIYiksZz0kYSgxNSwxNSxlLDE1KSxmPUkoZyksYWIoZisxLChnJjI1NSkrCjEsSWIpLGc9JGEoMTUsMTUsMTUsZCksZj1JKGcpLGFiKGYrMSwoZyYyNTUpKzEsSmIpKTtjPWguYXVkaW9RdWV1ZUluZGV4KzE7Yz49KGgud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemU+PjF8MCktMSYmLS1jO2guYXVkaW9RdWV1ZUluZGV4PWN9aC5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPWF9fWZ1bmN0aW9uIGZjKCl7cmV0dXJuIGguYXVkaW9RdWV1ZUluZGV4fWZ1bmN0aW9uIGdjKCl7aC5hdWRpb1F1ZXVlSW5kZXg9MH1mdW5jdGlvbiAkYShhLGMsYixlKXt2b2lkIDA9PT1hJiYoYT0xNSk7dm9pZCAwPT09YyYmKGM9MTUpO3ZvaWQgMD09PWImJihiPTE1KTt2b2lkIDA9PT1lJiYoZT0xNSk7cC5taXhlclZvbHVtZUNoYW5nZWQ9ITE7dmFyIGQ9MCsoaC5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ/YToxNSk7ZCs9aC5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ/YzoxNTtkKz1oLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD9iOjE1OwpkKz1oLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD9lOjE1O2E9MCsoaC5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0P2E6MTUpO2ErPWguTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD9jOjE1O2ErPWguTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD9iOjE1O2ErPWguTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD9lOjE1O3AubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTtwLm5lZWRUb1JlbWl4U2FtcGxlcz0hMTtjPWhjKGQsaC5OUjUwTGVmdE1peGVyVm9sdW1lKzEpO2I9aGMoYSxoLk5SNTBSaWdodE1peGVyVm9sdW1lKzEpO3AubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9YztwLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT1iO3JldHVybiBsKGMsYil9ZnVuY3Rpb24gaGMoYSxjKXtpZig2MD09PWEpcmV0dXJuIDEyNzthPTFFNSooYS02MCkqYz4+MzthPShhLzFFNXwwKSs2MDthPTFFNSoKYS8oMTJFNi8yNTR8MCl8MDtyZXR1cm4gYXw9MH1mdW5jdGlvbiBhYihhLGMsYil7Yis9aC5hdWRpb1F1ZXVlSW5kZXg8PDE7ZVtiKzBdPWErMTtlW2IrMV09YysxfWZ1bmN0aW9uIEJjKGEpe3N3aXRjaChhKXtjYXNlIHkubWVtb3J5TG9jYXRpb25OUngwOnJldHVybiBhPXYoeS5tZW1vcnlMb2NhdGlvbk5SeDApLGF8MTI4O2Nhc2UgRC5tZW1vcnlMb2NhdGlvbk5SeDA6cmV0dXJuIGE9dihELm1lbW9yeUxvY2F0aW9uTlJ4MCksYXwyNTU7Y2FzZSB0Lm1lbW9yeUxvY2F0aW9uTlJ4MDpyZXR1cm4gYT12KHQubWVtb3J5TG9jYXRpb25OUngwKSxhfDEyNztjYXNlIEYubWVtb3J5TG9jYXRpb25OUngwOnJldHVybiBhPXYoRi5tZW1vcnlMb2NhdGlvbk5SeDApLGF8MjU1O2Nhc2UgaC5tZW1vcnlMb2NhdGlvbk5SNTA6cmV0dXJuIGE9dihoLm1lbW9yeUxvY2F0aW9uTlI1MCksYXwwO2Nhc2UgeS5tZW1vcnlMb2NhdGlvbk5SeDE6cmV0dXJuIGE9dih5Lm1lbW9yeUxvY2F0aW9uTlJ4MSksCmF8NjM7Y2FzZSBELm1lbW9yeUxvY2F0aW9uTlJ4MTpyZXR1cm4gYT12KEQubWVtb3J5TG9jYXRpb25OUngxKSxhfDYzO2Nhc2UgdC5tZW1vcnlMb2NhdGlvbk5SeDE6cmV0dXJuIGE9dih0Lm1lbW9yeUxvY2F0aW9uTlJ4MSksYXwyNTU7Y2FzZSBGLm1lbW9yeUxvY2F0aW9uTlJ4MTpyZXR1cm4gYT12KEYubWVtb3J5TG9jYXRpb25OUngxKSxhfDI1NTtjYXNlIGgubWVtb3J5TG9jYXRpb25OUjUxOnJldHVybiBhPXYoaC5tZW1vcnlMb2NhdGlvbk5SNTEpLGF8MDtjYXNlIHkubWVtb3J5TG9jYXRpb25OUngyOnJldHVybiBhPXYoeS5tZW1vcnlMb2NhdGlvbk5SeDIpLGF8MDtjYXNlIEQubWVtb3J5TG9jYXRpb25OUngyOnJldHVybiBhPXYoRC5tZW1vcnlMb2NhdGlvbk5SeDIpLGF8MDtjYXNlIHQubWVtb3J5TG9jYXRpb25OUngyOnJldHVybiBhPXYodC5tZW1vcnlMb2NhdGlvbk5SeDIpLGF8MTU5O2Nhc2UgRi5tZW1vcnlMb2NhdGlvbk5SeDI6cmV0dXJuIGE9dihGLm1lbW9yeUxvY2F0aW9uTlJ4MiksCmF8MDtjYXNlIGgubWVtb3J5TG9jYXRpb25OUjUyOnJldHVybiBhPTAsYT1oLk5SNTJJc1NvdW5kRW5hYmxlZD9hfDEyODpIKDcsYSksYT15LmlzRW5hYmxlZD9hfDE6SCgwLGEpLGE9RC5pc0VuYWJsZWQ/YXwyOkgoMSxhKSxhPXQuaXNFbmFibGVkP2F8NDpIKDIsYSksYT1GLmlzRW5hYmxlZD9hfDg6SCgzLGEpLGF8MTEyO2Nhc2UgeS5tZW1vcnlMb2NhdGlvbk5SeDM6cmV0dXJuIGE9dih5Lm1lbW9yeUxvY2F0aW9uTlJ4MyksYXwyNTU7Y2FzZSBELm1lbW9yeUxvY2F0aW9uTlJ4MzpyZXR1cm4gYT12KEQubWVtb3J5TG9jYXRpb25OUngzKSxhfDI1NTtjYXNlIHQubWVtb3J5TG9jYXRpb25OUngzOnJldHVybiBhPXYodC5tZW1vcnlMb2NhdGlvbk5SeDMpLGF8MjU1O2Nhc2UgRi5tZW1vcnlMb2NhdGlvbk5SeDM6cmV0dXJuIGE9dihGLm1lbW9yeUxvY2F0aW9uTlJ4MyksYXwwO2Nhc2UgeS5tZW1vcnlMb2NhdGlvbk5SeDQ6cmV0dXJuIGE9dih5Lm1lbW9yeUxvY2F0aW9uTlJ4NCksYXwKMTkxO2Nhc2UgRC5tZW1vcnlMb2NhdGlvbk5SeDQ6cmV0dXJuIGE9dihELm1lbW9yeUxvY2F0aW9uTlJ4NCksYXwxOTE7Y2FzZSB0Lm1lbW9yeUxvY2F0aW9uTlJ4NDpyZXR1cm4gYT12KHQubWVtb3J5TG9jYXRpb25OUng0KSxhfDE5MTtjYXNlIEYubWVtb3J5TG9jYXRpb25OUng0OnJldHVybiBhPXYoRi5tZW1vcnlMb2NhdGlvbk5SeDQpLGF8MTkxfXJldHVybi0xfWZ1bmN0aW9uIGliKGEpe3ZiKCExKTt2YXIgYz12KG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KTtjPUgoYSxjKTttLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1jO2YobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsYyk7Yi5zdGFja1BvaW50ZXItPTI7Yi5pc0hhbHRlZCgpO2M9Yi5zdGFja1BvaW50ZXI7dmFyIGU9Yi5wcm9ncmFtQ291bnRlcixkPUkoZSk7ZihjKzAsZSYyNTUpO2YoYysxLGQpO3N3aXRjaChhKXtjYXNlIG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ6bS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0KITE7Yi5wcm9ncmFtQ291bnRlcj02NDticmVhaztjYXNlIG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ6bS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTcyO2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0Om0uaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTgwO2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdDptLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9ODg7YnJlYWs7Y2FzZSBtLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0Om0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITEsYi5wcm9ncmFtQ291bnRlcj05Nn19ZnVuY3Rpb24gYmIoYSl7dmFyIGM9dihtLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7Y3w9MTw8YTttLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1jO2YobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsCmMpfWZ1bmN0aW9uIHZiKGEpe2E/bS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMDptLm1hc3RlckludGVycnVwdFN3aXRjaD0hMX1mdW5jdGlvbiBLYihhKXtmb3IodmFyIGM9MDtjPGE7KXt2YXIgYj13LmRpdmlkZXJSZWdpc3RlcixlPWI7Yys9NDtlKz00O2UmPTY1NTM1O3cuZGl2aWRlclJlZ2lzdGVyPWU7aWYody50aW1lckVuYWJsZWQpe3ZhciBkPXcudGltZXJDb3VudGVyV2FzUmVzZXQ7dy50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5Pyh3LnRpbWVyQ291bnRlcj13LnRpbWVyTW9kdWxvLG0uaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMCxiYihtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLHcudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMSx3LnRpbWVyQ291bnRlcldhc1Jlc2V0PSEwKTpkJiYody50aW1lckNvdW50ZXJXYXNSZXNldD0hMSk7aWMoYixlKSYmTGIoKX19fWZ1bmN0aW9uIExiKCl7dmFyIGE9dy50aW1lckNvdW50ZXI7MjU1PCsrYSYmKHcudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0KITAsYT0wKTt3LnRpbWVyQ291bnRlcj1hfWZ1bmN0aW9uIGljKGEsYyl7dmFyIGI9TWIody50aW1lcklucHV0Q2xvY2spO3JldHVybiBnKGIsYSkmJiFnKGIsYyl9ZnVuY3Rpb24gTWIoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gOTtjYXNlIDE6cmV0dXJuIDM7Y2FzZSAyOnJldHVybiA1O2Nhc2UgMzpyZXR1cm4gN31yZXR1cm4gMH1mdW5jdGlvbiBUYShhKXt2YXIgYz1iLmlzU3RvcHBlZD0hMTtDYyhhKXx8KGM9ITApO0lhKGEsITApO2MmJihjPSExLDM+PWEmJihjPSEwKSxhPSExLEUuaXNEcGFkVHlwZSYmYyYmKGE9ITApLEUuaXNCdXR0b25UeXBlJiYhYyYmKGE9ITApLGEmJihtLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQpKSl9ZnVuY3Rpb24gQ2MoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gRS51cDtjYXNlIDE6cmV0dXJuIEUucmlnaHQ7Y2FzZSAyOnJldHVybiBFLmRvd247Y2FzZSAzOnJldHVybiBFLmxlZnQ7CmNhc2UgNDpyZXR1cm4gRS5hO2Nhc2UgNTpyZXR1cm4gRS5iO2Nhc2UgNjpyZXR1cm4gRS5zZWxlY3Q7Y2FzZSA3OnJldHVybiBFLnN0YXJ0O2RlZmF1bHQ6cmV0dXJuITF9fWZ1bmN0aW9uIElhKGEsYyl7c3dpdGNoKGEpe2Nhc2UgMDpFLnVwPWM7YnJlYWs7Y2FzZSAxOkUucmlnaHQ9YzticmVhaztjYXNlIDI6RS5kb3duPWM7YnJlYWs7Y2FzZSAzOkUubGVmdD1jO2JyZWFrO2Nhc2UgNDpFLmE9YzticmVhaztjYXNlIDU6RS5iPWM7YnJlYWs7Y2FzZSA2OkUuc2VsZWN0PWM7YnJlYWs7Y2FzZSA3OkUuc3RhcnQ9Y319ZnVuY3Rpb24gamMoYSxjLGUpe2Zvcih2YXIgZD0wO2Q8ZTsrK2Qpe2Zvcih2YXIgVz1OYihhK2QpLGc9YytkOzQwOTU5PGc7KWctPTgxOTI7T2IoZyxXKX1uLkRNQUN5Y2xlcys9KDMyPDxiLkdCQ0RvdWJsZVNwZWVkKSooZT4+NCl9ZnVuY3Rpb24gUGIoYSxjKXtpZihhPT09Yi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoKXJldHVybiBmKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCwKYyYxKSwhMTtpZihiLkJvb3RST01FbmFibGVkJiZhPT09Yi5tZW1vcnlMb2NhdGlvbkJvb3RST01Td2l0Y2gpcmV0dXJuIGIuQm9vdFJPTUVuYWJsZWQ9ITEsYi5wcm9ncmFtQ291bnRlcj0yNTUsITA7dmFyIGQ9bi52aWRlb1JhbUxvY2F0aW9uLEc9bi5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb247aWYoYTxkKXtpZighbi5pc1JvbU9ubHkpe2Q9bi5pc01CQzE7dmFyIHo9bi5pc01CQzI7aWYoODE5MT49YSl7aWYoIXp8fGcoNCxjKSljJj0xNSwwPT09Yz9uLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE6MTA9PT1jJiYobi5pc1JhbUJhbmtpbmdFbmFibGVkPSEwKX1lbHNlIDE2MzgzPj1hPyhHPW4uaXNNQkM1LCFHfHwxMjI4Nz49YT8oYT1uLmN1cnJlbnRSb21CYW5rLHomJihhPWMmMTUpLGQ/KGMmPTMxLGEmPTIyNCk6bi5pc01CQzM/KGMmPTEyNyxhJj0xMjgpOkcmJihhJj0wKSxuLmN1cnJlbnRSb21CYW5rPWF8Yyk6bi5jdXJyZW50Um9tQmFuaz1sKDA8YyxuLmN1cnJlbnRSb21CYW5rJgoyNTUpKToheiYmMjQ1NzU+PWE/ZCYmbi5pc01CQzFSb21Nb2RlRW5hYmxlZD8oYT1uLmN1cnJlbnRSb21CYW5rJjMxLG4uY3VycmVudFJvbUJhbms9YXxjJjIyNCk6KGM9bi5pc01CQzU/YyYxNTpjJjMsbi5jdXJyZW50UmFtQmFuaz1jKToheiYmMzI3Njc+PWEmJmQmJihuLmlzTUJDMVJvbU1vZGVFbmFibGVkPWcoMCxjKSl9cmV0dXJuITF9aWYoYT49ZCYmYTxuLmNhcnRyaWRnZVJhbUxvY2F0aW9uKXJldHVybiEwO2lmKGE+PW4uZWNob1JhbUxvY2F0aW9uJiZhPEcpcmV0dXJuIGYoYS04MTkyLGMpLCEwO2lmKGE+PUcmJmE8PW4uc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uRW5kKXJldHVybiAyPD11LmN1cnJlbnRMY2RNb2RlO2lmKGE+PW4udW51c2FibGVNZW1vcnlMb2NhdGlvbiYmYTw9bi51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uKXJldHVybiExO2lmKGE9PT1aLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sKXJldHVybiBaLnVwZGF0ZVRyYW5zZmVyQ29udHJvbChjKTsKaWYoNjUyOTY8PWEmJjY1MzE4Pj1hKXtoYigpO2lmKGE9PT1oLm1lbW9yeUxvY2F0aW9uTlI1Mnx8aC5OUjUySXNTb3VuZEVuYWJsZWQpe3N3aXRjaChhKXtjYXNlIHkubWVtb3J5TG9jYXRpb25OUngwOnkudXBkYXRlTlJ4MChjKTticmVhaztjYXNlIHQubWVtb3J5TG9jYXRpb25OUngwOnQudXBkYXRlTlJ4MChjKTticmVhaztjYXNlIHkubWVtb3J5TG9jYXRpb25OUngxOnkudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEQubWVtb3J5TG9jYXRpb25OUngxOkQudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIHQubWVtb3J5TG9jYXRpb25OUngxOnQudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEYubWVtb3J5TG9jYXRpb25OUngxOkYudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIHkubWVtb3J5TG9jYXRpb25OUngyOnkudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEQubWVtb3J5TG9jYXRpb25OUngyOkQudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIHQubWVtb3J5TG9jYXRpb25OUngyOnQudm9sdW1lQ29kZUNoYW5nZWQ9CiEwO3QudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEYubWVtb3J5TG9jYXRpb25OUngyOkYudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIHkubWVtb3J5TG9jYXRpb25OUngzOnkudXBkYXRlTlJ4MyhjKTticmVhaztjYXNlIEQubWVtb3J5TG9jYXRpb25OUngzOkQudXBkYXRlTlJ4MyhjKTticmVhaztjYXNlIHQubWVtb3J5TG9jYXRpb25OUngzOnQudXBkYXRlTlJ4MyhjKTticmVhaztjYXNlIEYubWVtb3J5TG9jYXRpb25OUngzOkYudXBkYXRlTlJ4MyhjKTticmVhaztjYXNlIHkubWVtb3J5TG9jYXRpb25OUng0OnkudXBkYXRlTlJ4NChjKTticmVhaztjYXNlIEQubWVtb3J5TG9jYXRpb25OUng0OkQudXBkYXRlTlJ4NChjKTticmVhaztjYXNlIHQubWVtb3J5TG9jYXRpb25OUng0OnQudXBkYXRlTlJ4NChjKTticmVhaztjYXNlIEYubWVtb3J5TG9jYXRpb25OUng0OkYudXBkYXRlTlJ4NChjKTticmVhaztjYXNlIGgubWVtb3J5TG9jYXRpb25OUjUwOmgudXBkYXRlTlI1MChjKTtwLm1peGVyVm9sdW1lQ2hhbmdlZD0KITA7YnJlYWs7Y2FzZSBoLm1lbW9yeUxvY2F0aW9uTlI1MTpoLnVwZGF0ZU5SNTEoYyk7cC5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO2JyZWFrO2Nhc2UgaC5tZW1vcnlMb2NhdGlvbk5SNTI6YT1oLk5SNTJJc1NvdW5kRW5hYmxlZDshYSYmZyg3LGMpJiYoaC5mcmFtZVNlcXVlbmNlcj03LHkud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wLEQud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wKTtpZihhJiYhZyg3LGMpKWZvcihhPTY1Mjk2OzY1MzE4PmE7KythKU9iKGEsMCk7aC51cGRhdGVOUjUyKGMpfWM9ITB9ZWxzZSBjPSExO3JldHVybiBjfWlmKDY1MzI4PD1hJiY2NTM0Mz49YSlyZXR1cm4gaGIoKSx0LmlzRW5hYmxlZD8odC5oYW5kbGVXYXZlUmFtV3JpdGUoYyksITEpOiEwO2lmKGE+PXUubWVtb3J5TG9jYXRpb25MY2RDb250cm9sJiZhPD1yLm1lbW9yeUxvY2F0aW9uV2luZG93WCl7aWYoYT09PXUubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKXJldHVybiB1LnVwZGF0ZUxjZENvbnRyb2woYyksCiEwO2lmKGE9PT11Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKXJldHVybiB1LnVwZGF0ZUxjZFN0YXR1cyhjKSwhMTtpZihhPT09ci5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpcmV0dXJuIHIuc2NhbmxpbmVSZWdpc3Rlcj0wLGYoYSwwKSwhMTtpZihhPT09dS5tZW1vcnlMb2NhdGlvbkNvaW5jaWRlbmNlQ29tcGFyZSlyZXR1cm4gdS5jb2luY2lkZW5jZUNvbXBhcmU9YywhMDtpZihhPT09ci5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyKXtjPDw9ODtmb3IoYT0wOzE1OT49YTsrK2EpZD12KGMrYSksZihuLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbithLGQpO24uRE1BQ3ljbGVzPTY0NDtyZXR1cm4hMH1zd2l0Y2goYSl7Y2FzZSByLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWDpyLnNjcm9sbFg9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25TY3JvbGxZOnIuc2Nyb2xsWT1jO2JyZWFrO2Nhc2Ugci5tZW1vcnlMb2NhdGlvbldpbmRvd1g6ci53aW5kb3dYPWM7YnJlYWs7CmNhc2Ugci5tZW1vcnlMb2NhdGlvbldpbmRvd1k6ci53aW5kb3dZPWN9cmV0dXJuITB9aWYoYT09PW4ubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcilyZXR1cm4gYi5HQkNFbmFibGVkJiYobi5pc0hibGFua0hkbWFBY3RpdmUmJiFnKDcsYyk/KG4uaXNIYmxhbmtIZG1hQWN0aXZlPSExLGM9dihuLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpLGYobi5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLGN8MTI4KSk6KGE9dihuLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUhpZ2gpLGQ9dihuLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdyksYT1sKGEsZCkmNjU1MjAsZD12KG4ubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25IaWdoKSxHPXYobi5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkxvdyksZD1sKGQsRyksZD0oZCY4MTc2KStuLnZpZGVvUmFtTG9jYXRpb24sRz1IKDcsYyksRz1HKzE8PDQsZyg3LGMpPyhuLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMCxuLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz0KRyxuLmhibGFua0hkbWFTb3VyY2U9YSxuLmhibGFua0hkbWFEZXN0aW5hdGlvbj1kLGYobi5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLEgoNyxjKSkpOihqYyhhLGQsRyksZihuLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMjU1KSkpKSwhMTtpZigoYT09PW4ubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFua3x8YT09PW4ubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmJm4uaXNIYmxhbmtIZG1hQWN0aXZlJiYoZD1uLmhibGFua0hkbWFTb3VyY2UsMTYzODQ8PWQmJjMyNzY3Pj1kfHw1MzI0ODw9ZCYmNTczNDM+PWQpKXJldHVybiExO2lmKGE+PVhhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVJbmRleCYmYTw9WGEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7ZD1YYS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhO2lmKGE9PT1YYS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlRGF0YXx8YT09PWQpRz12KGEtMSksRz1IKDYsRyksej1HJgo2MyxhPT09ZCYmKHorPTY0KSxlW1lhK3pdPWMsYz1HLC0tYSxnKDcsYykmJmYoYSxjKzF8MTI4KTtyZXR1cm4hMH1pZihhPj13Lm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyJiZhPD13Lm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKXtLYih3LmN1cnJlbnRDeWNsZXMpO3cuY3VycmVudEN5Y2xlcz0wO3N3aXRjaChhKXtjYXNlIHcubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI6cmV0dXJuIHcudXBkYXRlRGl2aWRlclJlZ2lzdGVyKCksITE7Y2FzZSB3Lm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyOncudXBkYXRlVGltZXJDb3VudGVyKGMpO2JyZWFrO2Nhc2Ugdy5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvOncudXBkYXRlVGltZXJNb2R1bG8oYyk7YnJlYWs7Y2FzZSB3Lm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sOncudXBkYXRlVGltZXJDb250cm9sKGMpfXJldHVybiEwfWE9PT1FLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXImJkUudXBkYXRlSm95cGFkKGMpOwppZihhPT09bS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpcmV0dXJuIG0udXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKGMpLCEwO2E9PT1tLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCYmbS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKGMpO3JldHVybiEwfWZ1bmN0aW9uIFFiKGEpe3N3aXRjaChhPj4xMil7Y2FzZSAwOmlmKGIuQm9vdFJPTUVuYWJsZWQpaWYoYi5HQkNFbmFibGVkKXtpZigyNTY+YXx8NTExPGEmJjIzMDQ+YSlyZXR1cm4gYSt3Yn1lbHNlIGlmKCFiLkdCQ0VuYWJsZWQmJjI1Nj5hKXJldHVybiBhK3diO2Nhc2UgMTpjYXNlIDI6Y2FzZSAzOnJldHVybiBhK3hiO2Nhc2UgNDpjYXNlIDU6Y2FzZSA2OmNhc2UgNzp2YXIgYz1uLmN1cnJlbnRSb21CYW5rO24uaXNNQkM1fHwwIT09Y3x8KGM9MSk7cmV0dXJuIDE2Mzg0KmMrKGEtbi5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb24pK3hiO2Nhc2UgODpjYXNlIDk6cmV0dXJuIGM9MCxiLkdCQ0VuYWJsZWQmJgooYz12KG4ubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmMSksYS1uLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKmM7Y2FzZSAxMDpjYXNlIDExOnJldHVybiA4MTkyKm4uY3VycmVudFJhbUJhbmsrKGEtbi5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbikrUmI7Y2FzZSAxMjpyZXR1cm4gYS1uLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisxODQzMjtjYXNlIDEzOnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz12KG4ubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaykmNyksYS1uLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisxODQzMis0MDk2KigoMT5jPzE6YyktMSk7ZGVmYXVsdDpyZXR1cm4gYS1uLmVjaG9SYW1Mb2NhdGlvbis1MTIwMH19ZnVuY3Rpb24gZihhLGMpe2E9UWIoYSk7ZVthXT1jfWZ1bmN0aW9uIE9iKGEsYyl7YT09PWFhLndyaXRlR2JNZW1vcnkmJihhYS5yZWFjaGVkQnJlYWtwb2ludD0hMCk7UGIoYSxjKSYmZihhLGMpfWZ1bmN0aW9uIGtjKGEpe3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI9CjA7ci5zY2FubGluZVJlZ2lzdGVyPTA7ZihyLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlciwwKTt2YXIgYz12KHUubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO2M9SCgxLGMpO2M9SCgwLGMpO3UuY3VycmVudExjZE1vZGU9MDtmKHUubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsYyk7aWYoYSlmb3IoYT0wOzkzMTg0PmE7KythKWVbY2IrYV09MjU1fWZ1bmN0aW9uIGxjKGEsYyl7MCE9PWEmJjEhPT1hfHxyLnNjYW5saW5lUmVnaXN0ZXIhPT11LmNvaW5jaWRlbmNlQ29tcGFyZT9jPUgoMixjKTooY3w9NCxnKDYsYykmJihtLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpKSk7cmV0dXJuIGN9ZnVuY3Rpb24gbWMoYSxjLGQsRyxmLG4pe2Zvcih2YXIgVz1HPj4zOzE2MD5mOysrZil7dmFyIHo9ZituOzI1Njw9eiYmKHotPTI1Nik7dmFyIGg9ZCsoVzw8NSkrKHo+PjMpLGs9WChoLDApLHA9ITE7aWYoUS50aWxlQ2FjaGluZyl7dmFyIG09CmY7dmFyIGw9YSxxPXosUD1oLHc9ayx1PTAsdD1kYi5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaztpZigwPGwmJjg8bSYmdz09PWRiLnRpbGVJZCYmbT09PXQpe3c9Zyg1LHYoUC0xKSk7UD1nKDUsdihQKSk7Zm9yKHZhciB4PTA7OD54OysreCl7dyE9PVAmJih4PTcteCk7dmFyIHk9bSt4O2lmKDE2MD49eSl7dmFyIEE9bS0oOC14KSxCPWNiKzMqKDE2MCpsK3kpO2NhKHksbCwwLGVbQl0pO2NhKHksbCwxLGVbQl0pO2NhKHksbCwyLGVbQl0pO0E9ZVtaYSsoMTYwKmwrQSldO3NiKHksbCxIKDIsQSksZygyLEEpKTt1Kyt9fX1lbHNlIGRiLnRpbGVJZD13O20+PXQmJih0PW0rOCxsPXEmN3wwLG08bCYmKHQrPWwpKTtkYi5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz10O209dTswPG0mJihmKz1tLTEscD0hMCl9US50aWxlUmVuZGVyaW5nJiYhcD8ocD1mLG09YSxsPXosej1jLHU9RyY3fDAsdD0wLDA9PXAmJih0PWwtKGw+PjM8PDMpKSxsPTcsMTYwPHArOCYmKGw9MTYwLQpwKSxxPS0xLHc9MCxiLkdCQ0VuYWJsZWQmJihxPVgoaCwxKSx3PWcoMyxxKXwwLGcoNixxKSYmKHU9Ny11KSksbT1FYihrLHosdyx0LGwsdSxwLG0sMTYwLGNiLCExLDAscSwtMSksMDxtJiYoZis9bS0xKSk6cHx8KGIuR0JDRW5hYmxlZD8ocD1mLG09YSx0PUcsdT1nYihjLGspLGs9WChoLDEpLHQ9dCY3fDAsZyg2LGspJiYodD03LXQpLGw9ZygzLGspfDAsaD1YKHUrMip0LGwpLHU9WCh1KzIqdCsxLGwpLHQ9eiY3fDAsZyg1LGspfHwodD03LXQpLHo9MCxnKHQsdSkmJih6PXorMTw8MSksZyh0LGgpJiYoeis9MSksdD1yYihrJjcseiwhMSksaD11YSgwLHQpLHU9dWEoMSx0KSx0PXVhKDIsdCksY2EocCxtLDAsaCksY2EocCxtLDEsdSksY2EocCxtLDIsdCksc2IocCxtLHosZyg3LGspKSk6KGg9ZixwPWEsdT1HLG09Z2IoYyxrKSx1PXUmN3wwLGs9WChtKzIqdSwwKSxtPVgobSsyKnUrMSwwKSx1PXomN3wwLHU9Ny11LHo9MCxnKHUsbSkmJih6PXorMTw8MSksZyh1LGspJiYoeis9MSksCms9cWIoeixyLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLGNhKGgscCwwLChrJjE2NzExNjgwKT4+MTYpLGNhKGgscCwxLChrJjY1MjgwKT4+OCksY2EoaCxwLDIsayYyNTUpLHNiKGgscCx6KSkpfX1mdW5jdGlvbiBuYyhhKXtpZih1LmVuYWJsZWQpZm9yKHIuc2NhbmxpbmVDeWNsZUNvdW50ZXIrPWEsYT1RLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nO3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI+PXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTspe3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXItPXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTt2YXIgYz1yLnNjYW5saW5lUmVnaXN0ZXI7aWYoMTQ0PT09Yyl7aWYoYSlmb3IodmFyIGI9MDsxNDQ+PWI7KytiKVNiKGIpO2Vsc2UgU2IoYyk7Zm9yKGI9MDsxNDQ+YjsrK2IpZm9yKHZhciBkPTA7MTYwPmQ7KytkKWVbWmErKDE2MCpiK2QpXT0wO2RiLnRpbGVJZD0tMTtkYi5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0KLTF9ZWxzZSAxNDQ+YyYmKGF8fFNiKGMpKTtjPTE1MzxjPzA6YysxO3Iuc2NhbmxpbmVSZWdpc3Rlcj1jfWlmKHUuZW5hYmxlZCl7Yz1yLnNjYW5saW5lUmVnaXN0ZXI7Yj11LmN1cnJlbnRMY2RNb2RlO2E9MDtpZigxNDQ8PWMpYT0xO2Vsc2V7ZD1yLnNjYW5saW5lQ3ljbGVDb3VudGVyO3ZhciB6PXIuTUlOX0NZQ0xFU19TUFJJVEVTX0xDRF9NT0RFKCk7ZD49ej9hPTI6ZD49eiYmKGE9Myl9aWYoYiE9PWEpe2M9dih1Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTt1LmN1cnJlbnRMY2RNb2RlPWE7Yj0hMTtzd2l0Y2goYSl7Y2FzZSAwOmM9SCgwLGMpO2M9SCgxLGMpO2I9ZygzLGMpO2JyZWFrO2Nhc2UgMTpjPUgoMSxjKTtjfD0xO2I9Zyg0LGMpO2JyZWFrO2Nhc2UgMjpjPUgoMCxjKTtjfD0yO2I9Zyg1LGMpO2JyZWFrO2Nhc2UgMzpjfD0zfWImJihtLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpKTswPT09YSYmbi5pc0hibGFua0hkbWFBY3RpdmUmJgooZD0xNixiPW4uaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nLGI8ZCYmKGQ9YiksamMobi5oYmxhbmtIZG1hU291cmNlLG4uaGJsYW5rSGRtYURlc3RpbmF0aW9uLGQpLG4uaGJsYW5rSGRtYVNvdXJjZSs9ZCxuLmhibGFua0hkbWFEZXN0aW5hdGlvbis9ZCxiLT1kLG4uaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPWIsZD1uLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMD49Yj8obi5pc0hibGFua0hkbWFBY3RpdmU9ITEsZihkLDI1NSkpOmYoZCxIKDcsKGI+PjQpLTEpKSk7MT09PWEmJihtLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpKTtjPWxjKGEsYyk7Zih1Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGMpfWVsc2UgMTUzPT09YyYmKGM9dih1Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKSxjPWxjKGEsYyksZih1Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGMpKX19ZnVuY3Rpb24gU2IoYSl7dmFyIGM9CnIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydDt1LmJnV2luZG93VGlsZURhdGFTZWxlY3QmJihjPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0KTtpZihiLkdCQ0VuYWJsZWR8fHUuYmdEaXNwbGF5RW5hYmxlZCl7dmFyIGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7dS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTttYyhhLGMsZCxhK3Iuc2Nyb2xsWSYyNTUsMCxyLnNjcm9sbFgpfWlmKHUud2luZG93RGlzcGxheUVuYWJsZWQpe2Q9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7dS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7dmFyIEc9ci53aW5kb3dYLHo9ci53aW5kb3dZO2E8enx8KEctPTcsbWMoYSxjLGQsYS16LEcsLUd8MCkpfWlmKHUuc3ByaXRlRGlzcGxheUVuYWJsZSlmb3IoYz0KdS50YWxsU3ByaXRlU2l6ZSxkPTM5OzA8PWQ7LS1kKXt6PTQqZDt2YXIgZj1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK3osaD12KGYrMCk7Rz12KGYrMSk7dmFyIG49dihmKzIpO2gtPTE2O0ctPTg7dmFyIGs9ODtjJiYoaz0xNixuLT1uJjEpO2lmKGE+PWgmJmE8aCtrKXt6PXYoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZSt6KzMpO2Y9Zyg3LHopO3ZhciBtPWcoNix6KSxwPWcoNSx6KTtoPWEtaDttJiYoaD1rLWgsLS1oKTtoPDw9MTtuPWdiKHIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0LG4pO24rPWg7az1iLkdCQ0VuYWJsZWQmJmcoMyx6KTtoPVgobiswLGspO249WChuKzEsayk7Zm9yKGs9NzswPD1rOy0tayl7bT1rO3AmJihtLT03LG09LW0pO3ZhciBsPTA7ZyhtLG4pJiYobD1sKzE8PDEpO2cobSxoKSYmKGwrPTEpO2lmKDAhPT1sJiYobT1HKyg3LWspLDA8PW0mJjE2MD49bSkpe3ZhciB0PWIuR0JDRW5hYmxlZCYmCiF1LmJnRGlzcGxheUVuYWJsZWQscT0hMSx3PSExO2lmKCF0KXt2YXIgeD1lW1phKygxNjAqYSttKV0seT14JjM7ZiYmMDx5P3E9ITA6Yi5HQkNFbmFibGVkJiZnKDIseCkmJjA8eSYmKHc9ITApfWlmKHR8fCFxJiYhdyliLkdCQ0VuYWJsZWQ/KHE9cmIoeiY3LGwsITApLGw9dWEoMCxxKSx0PXVhKDEscSkscT11YSgyLHEpLGNhKG0sYSwwLGwpLGNhKG0sYSwxLHQpLGNhKG0sYSwyLHEpKToodD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSxnKDQseikmJih0PXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKSxsPXFiKGwsdCksY2EobSxhLDAsKGwmMTY3MTE2ODApPj4xNiksY2EobSxhLDEsKGwmNjUyODApPj44KSxjYShtLGEsMixsJjI1NSkpfX19fX1mdW5jdGlvbiBjYShhLGMsYixkKXtlW2NiKzMqKDE2MCpjK2EpK2JdPWR9ZnVuY3Rpb24gWChhLGMpe3JldHVybiBlW2Etbi52aWRlb1JhbUxvY2F0aW9uKzIwNDgrODE5MiooYyYxKV19ZnVuY3Rpb24gVGIoYSl7dmFyIGM9Cm4udmlkZW9SYW1Mb2NhdGlvbjtyZXR1cm4gYTxjfHxhPj1jJiZhPG4uY2FydHJpZGdlUmFtTG9jYXRpb24/LTE6YT49bi5lY2hvUmFtTG9jYXRpb24mJmE8bi5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24/dihhLTgxOTIpOmE+PW4uc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uJiZhPD1uLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD8yPnUuY3VycmVudExjZE1vZGU/MjU1Oi0xOmE9PT1iLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2g/KGE9MjU1LGM9dihiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLGcoMCxjKXx8KGE9SCgwLGEpKSxiLkdCQ0RvdWJsZVNwZWVkfHwoYT1IKDcsYSkpLGEpOmE9PT1yLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj8oZihhLHIuc2NhbmxpbmVSZWdpc3Rlciksci5zY2FubGluZVJlZ2lzdGVyKTo2NTI5Njw9YSYmNjUzMTg+PWE/KGhiKCksQmMoYSkpOjY1MzE5PD1hJiY2NTMyNz49YT8yNTU6NjUzMjg8PQphJiY2NTM0Mz49YT8oaGIoKSx0LmlzRW5hYmxlZD90LmhhbmRsZVdhdmVSYW1SZWFkKCk6LTEpOmE9PT13Lm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPyhjPUkody5kaXZpZGVyUmVnaXN0ZXIpLGYoYSxjKSxjKTphPT09dy5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcj8oZihhLHcudGltZXJDb3VudGVyKSx3LnRpbWVyQ291bnRlcik6YT09PW0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0PzIyNHxtLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZTphPT09RS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyPyhhPUUuam95cGFkUmVnaXN0ZXJGbGlwcGVkLEUuaXNEcGFkVHlwZT8oYT1FLnVwP0goMixhKTphfDQsYT1FLnJpZ2h0P0goMCxhKTphfDEsYT1FLmRvd24/SCgzLGEpOmF8OCxhPUUubGVmdD9IKDEsYSk6YXwyKTpFLmlzQnV0dG9uVHlwZSYmKGE9RS5hP0goMCxhKTphfDEsYT1FLmI/SCgxLGEpOmF8MixhPUUuc2VsZWN0P0goMixhKTphfDQsYT1FLnN0YXJ0PwpIKDMsYSk6YXw4KSxhfDI0MCk6LTF9ZnVuY3Rpb24gdihhKXtyZXR1cm4gZVtRYihhKV19ZnVuY3Rpb24gTmIoYSl7YT09PWFhLnJlYWRHYk1lbW9yeSYmKGFhLnJlYWNoZWRCcmVha3BvaW50PSEwKTt2YXIgYz1UYihhKTtyZXR1cm4tMT09PWM/dihhKTpjfWZ1bmN0aW9uIGsoYSl7cmV0dXJuIDA8ZVthXX1mdW5jdGlvbiBKYShhKXt2YXIgYz1iLnJlZ2lzdGVyQTtSKGMsYSk7RGIoYyxhKTtjPWMrYSYyNTU7Yi5yZWdpc3RlckE9YztBKDA9PT1jKTt4KDApfWZ1bmN0aW9uIEthKGEpe3ZhciBjPWIucmVnaXN0ZXJBLGQ9YythK1QoKSYyNTU7SygwIT0oKGNeYV5kKSYxNikpO2E9YythK1QoKSY2NTUzNTtNKDA8KGEmMjU2KSk7Yi5yZWdpc3RlckE9ZDtBKDA9PT1kKTt4KDApfWZ1bmN0aW9uIExhKGEpe3ZhciBjPS0xKmE7dmFyIGQ9Yi5yZWdpc3RlckE7UihkLGMpO0RiKGQsYyk7ZD1kLWEmMjU1O2IucmVnaXN0ZXJBPWQ7QSgwPT09ZCk7eCgxKX1mdW5jdGlvbiBNYShhKXt2YXIgYz0KYi5yZWdpc3RlckEsZD1jLWEtVCgpJjI1NTtLKDAhPSgoY15hXmQpJjE2KSk7YT1jLWEtVCgpJjY1NTM1O00oMDwoYSYyNTYpKTtiLnJlZ2lzdGVyQT1kO0EoMD09PWQpO3goMSl9ZnVuY3Rpb24gTmEoYSl7YSY9Yi5yZWdpc3RlckE7Yi5yZWdpc3RlckE9YTtBKDA9PT1hKTt4KDApO0soMSk7TSgwKX1mdW5jdGlvbiBPYShhKXthPShiLnJlZ2lzdGVyQV5hKSYyNTU7Yi5yZWdpc3RlckE9YTtBKDA9PT1hKTt4KDApO0soMCk7TSgwKX1mdW5jdGlvbiBQYShhKXthfD1iLnJlZ2lzdGVyQTtiLnJlZ2lzdGVyQT1hO0EoMD09PWEpO3goMCk7SygwKTtNKDApfWZ1bmN0aW9uIFFhKGEpe3ZhciBjPWIucmVnaXN0ZXJBO2EqPS0xO1IoYyxhKTtEYihjLGEpO0EoMD09PWMrYSk7eCgxKX1mdW5jdGlvbiBVYShhLGMpe0EoMD09PShjJjE8PGEpKTt4KDApO0soMSk7cmV0dXJuIGN9ZnVuY3Rpb24gYmEoYSxjLGIpe3JldHVybiAwPGM/YnwxPDxhOmImfigxPDxhKX1mdW5jdGlvbiBqYihhKXt2YXIgYz0KYi5wcm9ncmFtQ291bnRlcjtjPShjKyhhPDwyND4+MjQpJjY1NTM1KSsxJjY1NTM1O2IucHJvZ3JhbUNvdW50ZXI9Y31mdW5jdGlvbiBvYyhhKXt2YXIgYz1iLnByb2dyYW1Db3VudGVyO2M9YysxJjY1NTM1O2IuaXNIYWx0QnVnJiYoYz1jLTEmNjU1MzUpO2IucHJvZ3JhbUNvdW50ZXI9Yztzd2l0Y2goKGEmMjQwKT4+NCl7Y2FzZSAwOnJldHVybiBEYyhhKTtjYXNlIDE6cmV0dXJuIEVjKGEpO2Nhc2UgMjpyZXR1cm4gRmMoYSk7Y2FzZSAzOnJldHVybiBHYyhhKTtjYXNlIDQ6cmV0dXJuIEhjKGEpO2Nhc2UgNTpyZXR1cm4gSWMoYSk7Y2FzZSA2OnJldHVybiBKYyhhKTtjYXNlIDc6cmV0dXJuIEtjKGEpO2Nhc2UgODpyZXR1cm4gTGMoYSk7Y2FzZSA5OnJldHVybiBNYyhhKTtjYXNlIDEwOnJldHVybiBOYyhhKTtjYXNlIDExOnJldHVybiBPYyhhKTtjYXNlIDEyOnJldHVybiBQYyhhKTtjYXNlIDEzOnJldHVybiBRYyhhKTtjYXNlIDE0OnJldHVybiBSYyhhKTtkZWZhdWx0OnJldHVybiBTYyhhKX19CmZ1bmN0aW9uIEwoYSl7UmEoNCk7cmV0dXJuIE5iKGEpfWZ1bmN0aW9uIFMoYSxjKXtSYSg0KTtPYihhLGMpfWZ1bmN0aW9uIEhhKGEpe1JhKDgpO3ZhciBjPVRiKGEpO2M9LTE9PT1jP3YoYSk6YzthKz0xO3ZhciBiPVRiKGEpO2E9LTE9PT1iP3YoYSk6YjtyZXR1cm4gbChhLGMpfWZ1bmN0aW9uIFUoYSxjKXtSYSg4KTt2YXIgYj1JKGMpO2MmPTI1NTtQYihhLGMpJiZmKGEsYyk7YSs9MTtQYihhLGIpJiZmKGEsYil9ZnVuY3Rpb24gSigpe1JhKDQpO3JldHVybiB2KGIucHJvZ3JhbUNvdW50ZXIpfWZ1bmN0aW9uIFkoKXtSYSg0KTt2YXIgYT12KGIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSk7cmV0dXJuIGwoYSxKKCkpfWZ1bmN0aW9uIERjKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIDQ7Y2FzZSAxOnJldHVybiBhPVkoKSxiLnJlZ2lzdGVyQj1JKGEpLGIucmVnaXN0ZXJDPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAyOnJldHVybiBTKGwoYi5yZWdpc3RlckIsCmIucmVnaXN0ZXJDKSxiLnJlZ2lzdGVyQSksNDtjYXNlIDM6cmV0dXJuIGE9bChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYSsrLGIucmVnaXN0ZXJCPUkoYSksYi5yZWdpc3RlckM9YSYyNTUsODtjYXNlIDQ6cmV0dXJuIGE9Yi5yZWdpc3RlckIsUihhLDEpLGE9YSsxJjI1NSxiLnJlZ2lzdGVyQj1hLEEoMD09PWEpLHgoMCksNDtjYXNlIDU6cmV0dXJuIGE9Yi5yZWdpc3RlckIsUihhLC0xKSxhPWEtMSYyNTUsYi5yZWdpc3RlckI9YSxBKDA9PT1hKSx4KDEpLDQ7Y2FzZSA2OnJldHVybiBiLnJlZ2lzdGVyQj1KKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDc6cmV0dXJuIGE9Yi5yZWdpc3RlckEsTSgxMjg9PT0oYSYxMjgpKSxiLnJlZ2lzdGVyQT0oYTw8MXxhPj43KSYyNTUsQSgwKSx4KDApLEsoMCksNDtjYXNlIDg6cmV0dXJuIFUoWSgpLGIuc3RhY2tQb2ludGVyKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSwKNDtjYXNlIDk6YT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKTt2YXIgYz1sKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKTtXYShhLGMsITEpO2E9YStjJjY1NTM1O2IucmVnaXN0ZXJIPUkoYSk7Yi5yZWdpc3Rlckw9YSYyNTU7eCgwKTtyZXR1cm4gODtjYXNlIDEwOnJldHVybiBiLnJlZ2lzdGVyQT1MKGwoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw0O2Nhc2UgMTE6cmV0dXJuIGE9bChiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYT1hLTEmNjU1MzUsYi5yZWdpc3RlckI9SShhKSxiLnJlZ2lzdGVyQz1hJjI1NSw4O2Nhc2UgMTI6cmV0dXJuIGE9Yi5yZWdpc3RlckMsUihhLDEpLGE9YSsxJjI1NSxiLnJlZ2lzdGVyQz1hLEEoMD09PWEpLHgoMCksNDtjYXNlIDEzOnJldHVybiBhPWIucmVnaXN0ZXJDLFIoYSwtMSksYT1hLTEmMjU1LGIucmVnaXN0ZXJDPWEsQSgwPT09YSkseCgxKSw0O2Nhc2UgMTQ6cmV0dXJuIGIucmVnaXN0ZXJDPUooKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrCjEmNjU1MzUsNDtjYXNlIDE1OnJldHVybiBhPWIucmVnaXN0ZXJBLE0oMDwoYSYxKSksYi5yZWdpc3RlckE9KGE+PjF8YTw8NykmMjU1LEEoMCkseCgwKSxLKDApLDR9cmV0dXJuLTF9ZnVuY3Rpb24gRWMoYSl7c3dpdGNoKGEpe2Nhc2UgMTY6aWYoYi5HQkNFbmFibGVkJiYoYT1MKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCksZygwLGEpKSlyZXR1cm4gYT1IKDAsYSksZyg3LGEpPyhiLkdCQ0RvdWJsZVNwZWVkPSExLGE9SCg3LGEpKTooYi5HQkNEb3VibGVTcGVlZD0hMCxhfD0xMjgpLFMoYi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoLGEpLDY4O2IuaXNTdG9wcGVkPSEwO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1O3JldHVybiA0O2Nhc2UgMTc6cmV0dXJuIGE9WSgpLGIucmVnaXN0ZXJEPUkoYSksYi5yZWdpc3RlckU9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDE4OnJldHVybiBTKGwoYi5yZWdpc3RlckQsCmIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQSksNDtjYXNlIDE5OnJldHVybiBhPWwoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJEPUkoYSksYi5yZWdpc3RlckU9YSYyNTUsODtjYXNlIDIwOnJldHVybiBhPWIucmVnaXN0ZXJELFIoYSwxKSxiLnJlZ2lzdGVyRD1hKzEmMjU1LEEoMD09PWIucmVnaXN0ZXJEKSx4KDApLDQ7Y2FzZSAyMTpyZXR1cm4gYT1iLnJlZ2lzdGVyRCxSKGEsLTEpLGIucmVnaXN0ZXJEPWEtMSYyNTUsQSgwPT09Yi5yZWdpc3RlckQpLHgoMSksNDtjYXNlIDIyOnJldHVybiBiLnJlZ2lzdGVyRD1KKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzOnJldHVybiBhPTEyOD09PShiLnJlZ2lzdGVyQSYxMjgpLGIucmVnaXN0ZXJBPShiLnJlZ2lzdGVyQTw8MXxUKCkpJjI1NSxNKGEpLEEoMCkseCgwKSxLKDApLDQ7Y2FzZSAyNDpyZXR1cm4gamIoSigpKSw4O2Nhc2UgMjU6YT1sKGIucmVnaXN0ZXJILApiLnJlZ2lzdGVyTCk7dmFyIGM9bChiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSk7V2EoYSxjLCExKTthPWErYyY2NTUzNTtiLnJlZ2lzdGVySD1JKGEpO2IucmVnaXN0ZXJMPWEmMjU1O3goMCk7cmV0dXJuIDg7Y2FzZSAyNjpyZXR1cm4gYT1sKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQT1MKGEpLDQ7Y2FzZSAyNzpyZXR1cm4gYT1sKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyRD1JKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyODpyZXR1cm4gYT1iLnJlZ2lzdGVyRSxSKGEsMSksYT1hKzEmMjU1LGIucmVnaXN0ZXJFPWEsQSgwPT09YSkseCgwKSw0O2Nhc2UgMjk6cmV0dXJuIGE9Yi5yZWdpc3RlckUsUihhLC0xKSxhPWEtMSYyNTUsYi5yZWdpc3RlckU9YSxBKDA9PT1hKSx4KDEpLDQ7Y2FzZSAzMDpyZXR1cm4gYi5yZWdpc3RlckU9SigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7CmNhc2UgMzE6cmV0dXJuIGE9MT09PShiLnJlZ2lzdGVyQSYxKSxiLnJlZ2lzdGVyQT0oYi5yZWdpc3RlckE+PjF8VCgpPDw3KSYyNTUsTShhKSxBKDApLHgoMCksSygwKSw0fXJldHVybi0xfWZ1bmN0aW9uIEZjKGEpe3N3aXRjaChhKXtjYXNlIDMyOnJldHVybiAwPT09U2EoKT9qYihKKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAzMzpyZXR1cm4gYT1ZKCksYi5yZWdpc3Rlckg9SShhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMzQ6cmV0dXJuIGE9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksUyhhLGIucmVnaXN0ZXJBKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1JKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSAzNTpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1JKGEpLGIucmVnaXN0ZXJMPQphJjI1NSw4O2Nhc2UgMzY6cmV0dXJuIGE9Yi5yZWdpc3RlckgsUihhLDEpLGE9YSsxJjI1NSxiLnJlZ2lzdGVySD1hLEEoMD09PWEpLHgoMCksNDtjYXNlIDM3OnJldHVybiBhPWIucmVnaXN0ZXJILFIoYSwtMSksYT1hLTEmMjU1LGIucmVnaXN0ZXJIPWEsQSgwPT09YSkseCgxKSw0O2Nhc2UgMzg6cmV0dXJuIGIucmVnaXN0ZXJIPUooKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMzk6YT0wOzA8KGIucmVnaXN0ZXJGPj41JjEpJiYoYXw9Nik7MDxUKCkmJihhfD05Nik7dmFyIGM9Yi5yZWdpc3RlckE7MDwoYi5yZWdpc3RlckY+PjYmMSk/Yz1jLWEmMjU1Oig5PChjJjE1KSYmKGF8PTYpLDE1MzxjJiYoYXw9OTYpLGM9YythJjI1NSk7QSgwPT09Yyk7TSgwIT09KGEmOTYpKTtLKDApO2IucmVnaXN0ZXJBPWM7cmV0dXJuIDQ7Y2FzZSA0MDpyZXR1cm4gMDxTYSgpP2piKEooKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmCjY1NTM1LDg7Y2FzZSA0MTpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxXYShhLGEsITEpLGE9MiphJjY1NTM1LGIucmVnaXN0ZXJIPUkoYSksYi5yZWdpc3Rlckw9YSYyNTUseCgwKSw4O2Nhc2UgNDI6cmV0dXJuIGE9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckE9TChhKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1JKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSA0MzpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1JKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSA0NDpyZXR1cm4gYT1iLnJlZ2lzdGVyTCxSKGEsMSksYT1hKzEmMjU1LGIucmVnaXN0ZXJMPWEsQSgwPT09YSkseCgwKSw0O2Nhc2UgNDU6cmV0dXJuIGE9Yi5yZWdpc3RlckwsUihhLC0xKSxhPWEtMSYyNTUsYi5yZWdpc3Rlckw9YSxBKDA9PT1hKSx4KDEpLDQ7Y2FzZSA0NjpyZXR1cm4gYi5yZWdpc3Rlckw9SigpLApiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNDc6cmV0dXJuIGIucmVnaXN0ZXJBPX5iLnJlZ2lzdGVyQSx4KDEpLEsoMSksNH1yZXR1cm4tMX1mdW5jdGlvbiBHYyhhKXtzd2l0Y2goYSl7Y2FzZSA0ODpyZXR1cm4gMD09PVQoKT9qYihKKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9WSgpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSA1MDpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxTKGEsYi5yZWdpc3RlckEpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJIPUkoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDUxOnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisxJjY1NTM1LDg7Y2FzZSA1MjphPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpO3ZhciBjPUwoYSk7UihjLDEpOwpjPWMrMSYyNTU7QSgwPT09Yyk7eCgwKTtTKGEsYyk7cmV0dXJuIDQ7Y2FzZSA1MzpyZXR1cm4gYT1sKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxjPUwoYSksUihjLC0xKSxjPWMtMSYyNTUsQSgwPT09YykseCgxKSxTKGEsYyksNDtjYXNlIDU0OnJldHVybiBTKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLEooKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDU1OnJldHVybiB4KDApLEsoMCksTSgxKSw0O2Nhc2UgNTY6cmV0dXJuIDE9PT1UKCk/amIoSigpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgNTc6cmV0dXJuIGE9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksV2EoYSxiLnN0YWNrUG9pbnRlciwhMSksYT1hK2Iuc3RhY2tQb2ludGVyJjY1NTM1LGIucmVnaXN0ZXJIPUkoYSksYi5yZWdpc3Rlckw9YSYyNTUseCgwKSw4O2Nhc2UgNTg6cmV0dXJuIGE9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksCmIucmVnaXN0ZXJBPUwoYSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9SShhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTEmNjU1MzUsODtjYXNlIDYwOnJldHVybiBhPWIucmVnaXN0ZXJBLFIoYSwxKSxhPWErMSYyNTUsYi5yZWdpc3RlckE9YSxBKDA9PT1hKSx4KDApLDQ7Y2FzZSA2MTpyZXR1cm4gYT1iLnJlZ2lzdGVyQSxSKGEsLTEpLGE9YS0xJjI1NSxiLnJlZ2lzdGVyQT1hLEEoMD09PWEpLHgoMSksNDtjYXNlIDYyOnJldHVybiBiLnJlZ2lzdGVyQT1KKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDYzOnJldHVybiB4KDApLEsoMCksTSgwPj1UKCkpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSGMoYSl7c3dpdGNoKGEpe2Nhc2UgNjQ6cmV0dXJuIDQ7Y2FzZSA2NTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckMsNDtjYXNlIDY2OnJldHVybiBiLnJlZ2lzdGVyQj0KYi5yZWdpc3RlckQsNDtjYXNlIDY3OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRSw0O2Nhc2UgNjg6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJILDQ7Y2FzZSA2OTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckwsNDtjYXNlIDcwOnJldHVybiBiLnJlZ2lzdGVyQj1MKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgNzE6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJBLDQ7Y2FzZSA3MjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckIsNDtjYXNlIDczOnJldHVybiA0O2Nhc2UgNzQ6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJELDQ7Y2FzZSA3NTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckUsNDtjYXNlIDc2OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVySCw0O2Nhc2UgNzc6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3ODpyZXR1cm4gYi5yZWdpc3RlckM9TChsKGIucmVnaXN0ZXJILApiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA3OTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckEsNH1yZXR1cm4tMX1mdW5jdGlvbiBJYyhhKXtzd2l0Y2goYSl7Y2FzZSA4MDpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckIsNDtjYXNlIDgxOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQyw0O2Nhc2UgODI6cmV0dXJuIDQ7Y2FzZSA4MzpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckUsNDtjYXNlIDg0OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVySCw0O2Nhc2UgODU6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJMLDQ7Y2FzZSA4NjpyZXR1cm4gYi5yZWdpc3RlckQ9TChsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDg3OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQSw0O2Nhc2UgODg6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJCLDQ7Y2FzZSA4OTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckMsNDtjYXNlIDkwOnJldHVybiBiLnJlZ2lzdGVyRT0KYi5yZWdpc3RlckQsNDtjYXNlIDkxOnJldHVybiA0O2Nhc2UgOTI6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJILDQ7Y2FzZSA5MzpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckwsNDtjYXNlIDk0OnJldHVybiBiLnJlZ2lzdGVyRT1MKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgOTU6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gSmMoYSl7c3dpdGNoKGEpe2Nhc2UgOTY6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJCLDQ7Y2FzZSA5NzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckMsNDtjYXNlIDk4OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRCw0O2Nhc2UgOTk6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMDA6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMDE6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMDI6cmV0dXJuIGIucmVnaXN0ZXJIPQpMKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTAzOnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQSw0O2Nhc2UgMTA0OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTA1OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQyw0O2Nhc2UgMTA2OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRCw0O2Nhc2UgMTA3OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTA4OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVySCw0O2Nhc2UgMTA5OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTEwOnJldHVybiBiLnJlZ2lzdGVyTD1MKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTExOnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIEtjKGEpe3N3aXRjaChhKXtjYXNlIDExMjpyZXR1cm4gUyhsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSwKYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMTM6cmV0dXJuIFMobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMTQ6cmV0dXJuIFMobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMTU6cmV0dXJuIFMobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckUpLDQ7Y2FzZSAxMTY6cmV0dXJuIFMobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckgpLDQ7Y2FzZSAxMTc6cmV0dXJuIFMobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMTg6cmV0dXJuIG4uaXNIYmxhbmtIZG1hQWN0aXZlfHxiLmVuYWJsZUhhbHQoKSw0O2Nhc2UgMTE5OnJldHVybiBTKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTIwOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTIxOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQywKNDtjYXNlIDEyMjpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckQsNDtjYXNlIDEyMzpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckUsNDtjYXNlIDEyNDpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckgsNDtjYXNlIDEyNTpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckwsNDtjYXNlIDEyNjpyZXR1cm4gYi5yZWdpc3RlckE9TChsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDEyNzpyZXR1cm4gNH1yZXR1cm4tMX1mdW5jdGlvbiBMYyhhKXtzd2l0Y2goYSl7Y2FzZSAxMjg6cmV0dXJuIEphKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTI5OnJldHVybiBKYShiLnJlZ2lzdGVyQyksNDtjYXNlIDEzMDpyZXR1cm4gSmEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzE6cmV0dXJuIEphKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTMyOnJldHVybiBKYShiLnJlZ2lzdGVySCksNDtjYXNlIDEzMzpyZXR1cm4gSmEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMzQ6cmV0dXJuIGE9CkwobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLEphKGEpLDQ7Y2FzZSAxMzU6cmV0dXJuIEphKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTM2OnJldHVybiBLYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEzNzpyZXR1cm4gS2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMzg6cmV0dXJuIEthKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTM5OnJldHVybiBLYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE0MDpyZXR1cm4gS2EoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNDE6cmV0dXJuIEthKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTQyOnJldHVybiBhPUwobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLEthKGEpLDQ7Y2FzZSAxNDM6cmV0dXJuIEthKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIE1jKGEpe3N3aXRjaChhKXtjYXNlIDE0NDpyZXR1cm4gTGEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNDU6cmV0dXJuIExhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTQ2OnJldHVybiBMYShiLnJlZ2lzdGVyRCksNDsKY2FzZSAxNDc6cmV0dXJuIExhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQ4OnJldHVybiBMYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0OTpyZXR1cm4gTGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTA6cmV0dXJuIGE9TChsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksTGEoYSksNDtjYXNlIDE1MTpyZXR1cm4gTGEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxNTI6cmV0dXJuIE1hKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTUzOnJldHVybiBNYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE1NDpyZXR1cm4gTWEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNTU6cmV0dXJuIE1hKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTU2OnJldHVybiBNYShiLnJlZ2lzdGVySCksNDtjYXNlIDE1NzpyZXR1cm4gTWEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTg6cmV0dXJuIGE9TChsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksTWEoYSksNDtjYXNlIDE1OTpyZXR1cm4gTWEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gTmMoYSl7c3dpdGNoKGEpe2Nhc2UgMTYwOnJldHVybiBOYShiLnJlZ2lzdGVyQiksCjQ7Y2FzZSAxNjE6cmV0dXJuIE5hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTYyOnJldHVybiBOYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE2MzpyZXR1cm4gTmEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNjQ6cmV0dXJuIE5hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTY1OnJldHVybiBOYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE2NjpyZXR1cm4gYT1MKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxOYShhKSw0O2Nhc2UgMTY3OnJldHVybiBOYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE2ODpyZXR1cm4gT2EoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNjk6cmV0dXJuIE9hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTcwOnJldHVybiBPYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE3MTpyZXR1cm4gT2EoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNzI6cmV0dXJuIE9hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTczOnJldHVybiBPYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE3NDpyZXR1cm4gYT1MKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSwKT2EoYSksNDtjYXNlIDE3NTpyZXR1cm4gT2EoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gT2MoYSl7c3dpdGNoKGEpe2Nhc2UgMTc2OnJldHVybiBQYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE3NzpyZXR1cm4gUGEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNzg6cmV0dXJuIFBhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTc5OnJldHVybiBQYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE4MDpyZXR1cm4gUGEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxODE6cmV0dXJuIFBhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTgyOnJldHVybiBhPUwobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLFBhKGEpLDQ7Y2FzZSAxODM6cmV0dXJuIFBhKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTg0OnJldHVybiBRYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE4NTpyZXR1cm4gUWEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxODY6cmV0dXJuIFFhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTg3OnJldHVybiBRYShiLnJlZ2lzdGVyRSksCjQ7Y2FzZSAxODg6cmV0dXJuIFFhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTg5OnJldHVybiBRYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE5MDpyZXR1cm4gYT1MKGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxRYShhKSw0O2Nhc2UgMTkxOnJldHVybiBRYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBQYyhhKXtzd2l0Y2goYSl7Y2FzZSAxOTI6cmV0dXJuIDA9PT1TYSgpPyhhPWIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9SGEoYSksYi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1LDEyKTo4O2Nhc2UgMTkzOnJldHVybiBhPUhhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJCPUkoYSksYi5yZWdpc3RlckM9YSYyNTUsNDtjYXNlIDE5NDppZigwPT09U2EoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7CmNhc2UgMTk1OnJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2Nhc2UgMTk2OmlmKDA9PT1TYSgpKXJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxVKGEsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDE5NzpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVShhLGwoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw4O2Nhc2UgMTk4OnJldHVybiBKYShKKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAxOTk6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFUoYSxiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTAsODtjYXNlIDIwMDpyZXR1cm4gMT09PVNhKCk/KGE9CmIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9SGEoYSksYi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1LDEyKTo4O2Nhc2UgMjAxOnJldHVybiBhPWIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9SGEoYSksYi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1LDg7Y2FzZSAyMDI6aWYoMT09PVNhKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjAzOnZhciBjPUooKTthPS0xO3ZhciBkPSExLGU9MCxmPTAsZz1jJjc7c3dpdGNoKGcpe2Nhc2UgMDplPWIucmVnaXN0ZXJCO2JyZWFrO2Nhc2UgMTplPWIucmVnaXN0ZXJDO2JyZWFrO2Nhc2UgMjplPWIucmVnaXN0ZXJEO2JyZWFrO2Nhc2UgMzplPWIucmVnaXN0ZXJFO2JyZWFrO2Nhc2UgNDplPWIucmVnaXN0ZXJIO2JyZWFrO2Nhc2UgNTplPWIucmVnaXN0ZXJMO2JyZWFrO2Nhc2UgNjplPUwobChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpOwpicmVhaztjYXNlIDc6ZT1iLnJlZ2lzdGVyQX12YXIgaD0oYyYyNDApPj40O3N3aXRjaChoKXtjYXNlIDA6Nz49Yz8oYz1lLE0oMTI4PT09KGMmMTI4KSksYz0oYzw8MXxjPj43KSYyNTUsQSgwPT09YykseCgwKSxLKDApLGY9YyxkPSEwKToxNT49YyYmKGM9ZSxNKDA8KGMmMSkpLGM9KGM+PjF8Yzw8NykmMjU1LEEoMD09PWMpLHgoMCksSygwKSxmPWMsZD0hMCk7YnJlYWs7Y2FzZSAxOjIzPj1jPyhjPWUsZD0xMjg9PT0oYyYxMjgpLGM9KGM8PDF8VCgpKSYyNTUsTShkKSxBKDA9PT1jKSx4KDApLEsoMCksZj1jLGQ9ITApOjMxPj1jJiYoYz1lLGQ9MT09PShjJjEpLGM9KGM+PjF8VCgpPDw3KSYyNTUsTShkKSxBKDA9PT1jKSx4KDApLEsoMCksZj1jLGQ9ITApO2JyZWFrO2Nhc2UgMjozOT49Yz8oYz1lLGQ9MTI4PT09KGMmMTI4KSxjPWM8PDEmMjU1LE0oZCksQSgwPT09YykseCgwKSxLKDApLGY9YyxkPSEwKTo0Nz49YyYmKGM9ZSxkPTEyOD09PShjJjEyOCksZT0xPT09KGMmMSksYz0KYz4+MSYyNTUsZCYmKGN8PTEyOCksQSgwPT09YykseCgwKSxLKDApLE0oZSksZj1jLGQ9ITApO2JyZWFrO2Nhc2UgMzo1NT49Yz8oYz1lLGM9KChjJjE1KTw8NHwoYyYyNDApPj40KSYyNTUsQSgwPT09YykseCgwKSxLKDApLE0oMCksZj1jLGQ9ITApOjYzPj1jJiYoYz1lLGQ9MT09PShjJjEpLGM9Yz4+MSYyNTUsQSgwPT09YykseCgwKSxLKDApLE0oZCksZj1jLGQ9ITApO2JyZWFrO2Nhc2UgNDo3MT49Yz8oZj1VYSgwLGUpLGQ9ITApOjc5Pj1jJiYoZj1VYSgxLGUpLGQ9ITApO2JyZWFrO2Nhc2UgNTo4Nz49Yz8oZj1VYSgyLGUpLGQ9ITApOjk1Pj1jJiYoZj1VYSgzLGUpLGQ9ITApO2JyZWFrO2Nhc2UgNjoxMDM+PWM/KGY9VWEoNCxlKSxkPSEwKToxMTE+PWMmJihmPVVhKDUsZSksZD0hMCk7YnJlYWs7Y2FzZSA3OjExOT49Yz8oZj1VYSg2LGUpLGQ9ITApOjEyNz49YyYmKGY9VWEoNyxlKSxkPSEwKTticmVhaztjYXNlIDg6MTM1Pj1jPyhmPWJhKDAsMCxlKSxkPSEwKToxNDM+PWMmJgooZj1iYSgxLDAsZSksZD0hMCk7YnJlYWs7Y2FzZSA5OjE1MT49Yz8oZj1iYSgyLDAsZSksZD0hMCk6MTU5Pj1jJiYoZj1iYSgzLDAsZSksZD0hMCk7YnJlYWs7Y2FzZSAxMDoxNjc+PWM/KGY9YmEoNCwwLGUpLGQ9ITApOjE3NT49YyYmKGY9YmEoNSwwLGUpLGQ9ITApO2JyZWFrO2Nhc2UgMTE6MTgzPj1jPyhmPWJhKDYsMCxlKSxkPSEwKToxOTE+PWMmJihmPWJhKDcsMCxlKSxkPSEwKTticmVhaztjYXNlIDEyOjE5OT49Yz8oZj1iYSgwLDEsZSksZD0hMCk6MjA3Pj1jJiYoZj1iYSgxLDEsZSksZD0hMCk7YnJlYWs7Y2FzZSAxMzoyMTU+PWM/KGY9YmEoMiwxLGUpLGQ9ITApOjIyMz49YyYmKGY9YmEoMywxLGUpLGQ9ITApO2JyZWFrO2Nhc2UgMTQ6MjMxPj1jPyhmPWJhKDQsMSxlKSxkPSEwKToyMzk+PWMmJihmPWJhKDUsMSxlKSxkPSEwKTticmVhaztjYXNlIDE1OjI0Nz49Yz8oZj1iYSg2LDEsZSksZD0hMCk6MjU1Pj1jJiYoZj1iYSg3LDEsZSksZD0hMCl9c3dpdGNoKGcpe2Nhc2UgMDpiLnJlZ2lzdGVyQj0KZjticmVhaztjYXNlIDE6Yi5yZWdpc3RlckM9ZjticmVhaztjYXNlIDI6Yi5yZWdpc3RlckQ9ZjticmVhaztjYXNlIDM6Yi5yZWdpc3RlckU9ZjticmVhaztjYXNlIDQ6Yi5yZWdpc3Rlckg9ZjticmVhaztjYXNlIDU6Yi5yZWdpc3Rlckw9ZjticmVhaztjYXNlIDY6KDQ+aHx8NzxoKSYmUyhsKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxmKTticmVhaztjYXNlIDc6Yi5yZWdpc3RlckE9Zn1kJiYoYT00KTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtyZXR1cm4gYTtjYXNlIDIwNDppZigxPT09U2EoKSlyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVShhLGIucHJvZ3JhbUNvdW50ZXIrMiksYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMDU6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj0KYSxVKGEsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2Nhc2UgMjA2OnJldHVybiBLYShKKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMDc6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFUoYSxiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTh9cmV0dXJuLTF9ZnVuY3Rpb24gUWMoYSl7c3dpdGNoKGEpe2Nhc2UgMjA4OnJldHVybiAwPT09VCgpPyhhPWIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9SGEoYSksYi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1LDEyKTo4O2Nhc2UgMjA5OmE9Yi5zdGFja1BvaW50ZXI7dmFyIGM9SGEoYSk7Yi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1O2IucmVnaXN0ZXJEPUkoYyk7Yi5yZWdpc3RlckU9YyYyNTU7cmV0dXJuIDQ7Y2FzZSAyMTA6aWYoMD09PVQoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj0KWSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEyOmlmKDA9PT1UKCkpcmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFUoYSxiLnByb2dyYW1Db3VudGVyKzIpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEzOnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxVKGEsbChiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSkpLDg7Y2FzZSAyMTQ6cmV0dXJuIExhKEooKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIxNTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVShhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MTYsODtjYXNlIDIxNjpyZXR1cm4gMT09PQpUKCk/KGE9Yi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcj1IYShhKSxiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzUsMTIpOjg7Y2FzZSAyMTc6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcj1IYShhKSx2YighMCksYi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1LDg7Y2FzZSAyMTg6aWYoMT09PVQoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjA6aWYoMT09PVQoKSlyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVShhLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjI6cmV0dXJuIE1hKEooKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmCjY1NTM1LDQ7Y2FzZSAyMjM6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFUoYSxiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTI0LDh9cmV0dXJuLTF9ZnVuY3Rpb24gUmMoYSl7c3dpdGNoKGEpe2Nhc2UgMjI0OnJldHVybiBhPUooKSxTKDY1MjgwK2EsYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMjU6YT1iLnN0YWNrUG9pbnRlcjt2YXIgYz1IYShhKTtiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzU7Yi5yZWdpc3Rlckg9SShjKTtiLnJlZ2lzdGVyTD1jJjI1NTtyZXR1cm4gNDtjYXNlIDIyNjpyZXR1cm4gUyg2NTI4MCtiLnJlZ2lzdGVyQyxiLnJlZ2lzdGVyQSksNDtjYXNlIDIyOTpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVShhLGwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw4O2Nhc2UgMjMwOnJldHVybiBOYShKKCkpLApiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjMxOnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxVKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0zMiw4O2Nhc2UgMjMyOnJldHVybiBhPUooKTw8MjQ+PjI0LFdhKGIuc3RhY2tQb2ludGVyLGEsITApLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyK2EmNjU1MzUsQSgwKSx4KDApLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDEyO2Nhc2UgMjMzOnJldHVybiBiLnByb2dyYW1Db3VudGVyPWwoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLDQ7Y2FzZSAyMzQ6cmV0dXJuIFMoWSgpLGIucmVnaXN0ZXJBKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjM4OnJldHVybiBPYShKKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7CmNhc2UgMjM5OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxVKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj00MCw4fXJldHVybi0xfWZ1bmN0aW9uIFNjKGEpe3N3aXRjaChhKXtjYXNlIDI0MDpyZXR1cm4gYT1KKCksYi5yZWdpc3RlckE9TCg2NTI4MCthKSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDI0MTphPWIuc3RhY2tQb2ludGVyO3ZhciBjPUhhKGEpO2Iuc3RhY2tQb2ludGVyPWErMiY2NTUzNTtiLnJlZ2lzdGVyQT1JKGMpO2IucmVnaXN0ZXJGPWMmMjU1O3JldHVybiA0O2Nhc2UgMjQyOnJldHVybiBiLnJlZ2lzdGVyQT1MKDY1MjgwK2IucmVnaXN0ZXJDKSYyNTUsNDtjYXNlIDI0MzpyZXR1cm4gdmIoITEpLDQ7Y2FzZSAyNDU6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFUoYSxsKGIucmVnaXN0ZXJBLGIucmVnaXN0ZXJGKSksCjg7Y2FzZSAyNDY6cmV0dXJuIFBhKEooKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDI0NzpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVShhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9NDgsODtjYXNlIDI0ODpyZXR1cm4gYz1KKCk8PDI0Pj4yNCxhPWIuc3RhY2tQb2ludGVyLEEoMCkseCgwKSxXYShhLGMsITApLGE9YStjJjY1NTM1LGIucmVnaXN0ZXJIPUkoYSksYi5yZWdpc3Rlckw9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDI0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9bChiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksODtjYXNlIDI1MDpyZXR1cm4gYi5yZWdpc3RlckE9TChZKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAyNTE6cmV0dXJuIHZiKCEwKSw0O2Nhc2UgMjU0OnJldHVybiBRYShKKCkpLApiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjU1OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxVKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj01Niw4fXJldHVybi0xfWZ1bmN0aW9uIFJhKGEpezA8bi5ETUFDeWNsZXMmJihhKz1uLkRNQUN5Y2xlcyxuLkRNQUN5Y2xlcz0wKTtiLmN1cnJlbnRDeWNsZXMrPWE7aWYoIWIuaXNTdG9wcGVkKXtpZihRLmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nKXtyLmN1cnJlbnRDeWNsZXMrPWE7Zm9yKHZhciBjPXIuYmF0Y2hQcm9jZXNzQ3ljbGVzKCk7ci5jdXJyZW50Q3ljbGVzPj1jOyluYyhjKSxyLmN1cnJlbnRDeWNsZXMtPWN9ZWxzZSBuYyhhKTtRLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nPyhoLmN1cnJlbnRDeWNsZXMrPWEsaGIoKSk6ZWMoYSk7Yz1hO2lmKFoudHJhbnNmZXJTdGFydEZsYWcpZm9yKHZhciBkPTA7ZDxjOyl7dmFyIGU9Wi5jdXJyZW50Q3ljbGVzLAprPWU7ZCs9NDtrKz00OzY1NTM1PGsmJihrLT02NTUzNik7Wi5jdXJyZW50Q3ljbGVzPWs7dmFyIGw9Wi5pc0Nsb2NrU3BlZWRGYXN0PzI6NztnKGwsZSkmJiFnKGwsaykmJihlPVoubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckRhdGEsaz12KGUpLGs9KGs8PDEpKzEsayY9MjU1LGYoZSxrKSxlPVoubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQsOD09PSsrZT8oWi5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZD0wLG0uaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsYmIobS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCksZT1aLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sLGs9dihlKSxmKGUsSCg3LGspKSxaLnRyYW5zZmVyU3RhcnRGbGFnPSExKTpaLm51bWJlck9mQml0c1RyYW5zZmVycmVkPWUpfX1RLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz8ody5jdXJyZW50Q3ljbGVzKz1hLEtiKHcuY3VycmVudEN5Y2xlcyksdy5jdXJyZW50Q3ljbGVzPTApOktiKGEpO2M9CmRhLmN5Y2xlcztjKz1hO2M+PWRhLmN5Y2xlc1BlckN5Y2xlU2V0JiYoZGEuY3ljbGVTZXRzKz0xLGMtPWRhLmN5Y2xlc1BlckN5Y2xlU2V0KTtkYS5jeWNsZXM9Y31mdW5jdGlvbiBwYygpe3JldHVybiBVYighMCwtMSl9ZnVuY3Rpb24gVWIoYSxjKXt2b2lkIDA9PT1jJiYoYz0tMSk7YT0xMDI0OzA8Yz9hPWM6MD5jJiYoYT0tMSk7Zm9yKHZhciBkPSExLGU9ITEsZj0hMTshKGR8fGV8fGZ8fGFhLnJlYWNoZWRCcmVha3BvaW50KTspYz1xYygpLDA+Yz9kPSEwOmIuY3VycmVudEN5Y2xlcz49Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpP2U9ITA6LTE8YSYmZmMoKT49YSYmKGY9ITApO2lmKGUpcmV0dXJuIGIuY3VycmVudEN5Y2xlcy09Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpLFYuUkVTUE9OU0VfQ09ORElUSU9OX0ZSQU1FO2lmKGYpcmV0dXJuIFYuUkVTUE9OU0VfQ09ORElUSU9OX0FVRElPO2lmKGFhLnJlYWNoZWRCcmVha3BvaW50KXJldHVybiBhYS5yZWFjaGVkQnJlYWtwb2ludD0KITEsVi5SRVNQT05TRV9DT05ESVRJT05fQlJFQUtQT0lOVDtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNTtyZXR1cm4tMX1mdW5jdGlvbiBxYygpe2tiPSEwO2lmKGIuaXNIYWx0QnVnKXt2YXIgYT12KGIucHJvZ3JhbUNvdW50ZXIpO2E9b2MoYSk7UmEoYSk7Yi5leGl0SGFsdEFuZFN0b3AoKX1tLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5JiYobS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITAsbS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMSk7aWYoMDwobS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJm0uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlJjMxKSl7YT0hMTttLm1hc3RlckludGVycnVwdFN3aXRjaCYmIWIuaXNIYWx0Tm9KdW1wJiYobS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQmJm0uaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KGliKG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpLGE9ITApOm0uaXNMY2RJbnRlcnJ1cHRFbmFibGVkJiYKbS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD8oaWIobS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCksYT0hMCk6bS5pc1RpbWVySW50ZXJydXB0RW5hYmxlZCYmbS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPyhpYihtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLGE9ITApOm0uaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkJiZtLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPyhpYihtLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0KSxhPSEwKTptLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZCYmbS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZCYmKGliKG0uYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQpLGE9ITApKTt2YXIgYz0wO2EmJihjPTIwLGIuaXNIYWx0ZWQoKSYmKGIuZXhpdEhhbHRBbmRTdG9wKCksYys9NCkpO2IuaXNIYWx0ZWQoKSYmYi5leGl0SGFsdEFuZFN0b3AoKTthPWN9ZWxzZSBhPTA7MDxhJiZSYShhKTthPTQ7Yi5pc0hhbHRlZCgpfHxiLmlzU3RvcHBlZHx8CihhPXYoYi5wcm9ncmFtQ291bnRlciksYT1vYyhhKSk7Yi5yZWdpc3RlckYmPTI0MDtpZigwPj1hKXJldHVybiBhO1JhKGEpO2M9Vi5zdGVwcztjKz0xO2M+PVYuc3RlcHNQZXJTdGVwU2V0JiYoVi5zdGVwU2V0cys9MSxjLT1WLnN0ZXBzUGVyU3RlcFNldCk7Vi5zdGVwcz1jO2IucHJvZ3JhbUNvdW50ZXI9PT1hYS5wcm9ncmFtQ291bnRlciYmKGFhLnJlYWNoZWRCcmVha3BvaW50PSEwKTtyZXR1cm4gYX1mdW5jdGlvbiBUYyhhKXtsZXQgYz0idW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKTtmb3IoO2EuZnBzVGltZVN0YW1wc1swXTxjLTFFMzspYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCk7YS5mcHNUaW1lU3RhbXBzLnB1c2goYyk7YS50aW1lU3RhbXBzVW50aWxSZWFkeS0tOzA+YS50aW1lU3RhbXBzVW50aWxSZWFkeSYmKGEudGltZVN0YW1wc1VudGlsUmVhZHk9MCk7cmV0dXJuIGN9ZnVuY3Rpb24gVmIoYSl7YS50aW1lU3RhbXBzVW50aWxSZWFkeT0KOTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIHJjKGEpe2xldCBjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTithLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFKS5idWZmZXI7YS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTyh7dHlwZTpCLlVQREFURUQsZ3JhcGhpY3NGcmFtZUJ1ZmZlcjpjfSksW2NdKX1mdW5jdGlvbiBzYyhhKXt2YXIgYz0oInVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCkpLWEuZnBzVGltZVN0YW1wc1thLmZwc1RpbWVTdGFtcHMubGVuZ3RoLTFdO2M9dGMtYzswPmMmJihjPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGMvPWEuc3BlZWQpO2EudXBkYXRlSWQ9CnNldFRpbWVvdXQoKCk9Pnt1YyhhKX0sTWF0aC5mbG9vcihjKSl9ZnVuY3Rpb24gdWMoYSxjKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1jJiYodGM9Yyk7bGI9YS5nZXRGUFMoKTt5Yj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHliKj1hLnNwZWVkKTtpZihsYj55YilyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksc2MoYSksITA7VGMoYSk7bGV0IGI9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZShjPT57bGV0IGQ7Yj9XYihhLGMpOihkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksYyhkKSl9KSkudGhlbihjPT57aWYoMDw9Yyl7ZWEoTyh7dHlwZTpCLlVQREFURUQsZnBzOmxifSkpO2xldCBiPSExO2Eub3B0aW9ucy5mcmFtZVNraXAmJjA8YS5vcHRpb25zLmZyYW1lU2tpcCYmKGEuZnJhbWVTa2lwQ291bnRlcisrLAphLmZyYW1lU2tpcENvdW50ZXI8PWEub3B0aW9ucy5mcmFtZVNraXA/Yj0hMDphLmZyYW1lU2tpcENvdW50ZXI9MCk7Ynx8cmMoYSk7bGV0IGQ9e3R5cGU6Qi5VUERBVEVEfTtkW0MuQ0FSVFJJREdFX1JBTV09JGIoYSkuYnVmZmVyO2RbQy5HQU1FQk9ZX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXI7ZFtDLlBBTEVUVEVfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW0MuSU5URVJOQUxfU1RBVEVdPWFjKGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhkKS5mb3JFYWNoKGE9Pnt2b2lkIDA9PT0KZFthXSYmKGRbYV09KG5ldyBVaW50OEFycmF5KS5idWZmZXIpfSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oZCksW2RbQy5DQVJUUklER0VfUkFNXSxkW0MuR0FNRUJPWV9NRU1PUlldLGRbQy5QQUxFVFRFX01FTU9SWV0sZFtDLklOVEVSTkFMX1NUQVRFXV0pOzI9PT1jP2VhKE8oe3R5cGU6Qi5CUkVBS1BPSU5UfSkpOnNjKGEpfWVsc2UgZWEoTyh7dHlwZTpCLkNSQVNIRUR9KSksYS5wYXVzZWQ9ITB9KX1mdW5jdGlvbiBXYihhLGMpe3ZhciBiPS0xO2I9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvKDEwMjQpOzEhPT1iJiZjKGIpO2lmKDE9PT1iKXtiPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0TnVtYmVyT2ZTYW1wbGVzSW5BdWRpb0J1ZmZlcigpO2xldCBkPWxiPj15YjsuMjU8YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzJiZkPyh2YyhhLGIpLHNldFRpbWVvdXQoKCk9PntWYihhKTtXYihhLGMpfSxNYXRoLmZsb29yKE1hdGguZmxvb3IoMUUzKgooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOih2YyhhLGIpLFdiKGEsYykpfX1mdW5jdGlvbiB2YyhhLGMpe3ZhciBiPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYykuYnVmZmVyO2xldCBkPXt0eXBlOkIuVVBEQVRFRCxhdWRpb0J1ZmZlcjpiLG51bWJlck9mU2FtcGxlczpjLGZwczpsYixhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6NjA8YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9O2I9W2JdO2lmKGEub3B0aW9ucyYmYS5vcHRpb25zLmVuYWJsZUF1ZGlvRGVidWdnaW5nKXt2YXIgZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYykuYnVmZmVyO2QuY2hhbm5lbDFCdWZmZXI9ZTtiLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtkLmNoYW5uZWwyQnVmZmVyPWU7Yi5wdXNoKGUpO2U9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtkLmNoYW5uZWwzQnVmZmVyPWU7Yi5wdXNoKGUpO2M9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtkLmNoYW5uZWw0QnVmZmVyPWM7Yi5wdXNoKGMpfWEuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE8oZCksYik7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCl9bGV0IG5iPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsQmI7bmJ8fChCYj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgQj17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIiwKR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQiLEZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxDPXtCT09UX1JPTToiQk9PVF9ST00iLENBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifSxvYj0wLGU9bmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDkxMDk1MDQpLG1iPXtzaXplOigpPT45MTA5NTA0LGdyb3c6KCk9Pnt9LHdhc21CeXRlTWVtb3J5OmV9O3ZhciBVYz02NTUzNixZYT02NzU4NCxaYT1ZYSsxMjgsCmNiPVphKzIzNTUyLHpiPWNiKzkzMTg0LFhiPXpiKzE5NjYwOCxBYj1YYisxNDc0NTYsVmM9WWEsV2M9QWItWWErMTUzNjAsR2I9QWIrMTUzNjAsSGI9R2IrMTMxMDcyLEliPUhiKzEzMTA3MixKYj1JYisxMzEwNzIsdWI9SmIrMTMxMDcyLFJiPXViKzEzMTA3Mix3Yj1SYisxMzEwNzIseGI9d2IrMjU2MCxZYj14Yis4MjU4NTYwLHdjPVliKzY1NTM1KzEsWmI9TWF0aC5jZWlsKHdjLzEwMjQvNjQpKzEsUT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5lbmFibGVCb290Um9tPSExO2EudXNlR2JjV2hlbkF2YWlsYWJsZT0hMDthLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nPSExO2EuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmc9ITE7YS50aW1lcnNCYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZz0hMTthLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXM9ITE7YS50aWxlUmVuZGVyaW5nPSExO2EudGlsZUNhY2hpbmc9ITE7YS5lbmFibGVBdWRpb0RlYnVnZ2luZz0KITE7cmV0dXJuIGF9KCksTj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE1OTIxOTA2O2EuYmdMaWdodEdyZXk9MTA1MjY4ODA7YS5iZ0RhcmtHcmV5PTU3ODk3ODQ7YS5iZ0JsYWNrPTUyNjM0NDthLm9iajBXaGl0ZT0xNTkyMTkwNjthLm9iajBMaWdodEdyZXk9MTA1MjY4ODA7YS5vYmowRGFya0dyZXk9NTc4OTc4NDthLm9iajBCbGFjaz01MjYzNDQ7YS5vYmoxV2hpdGU9MTU5MjE5MDY7YS5vYmoxTGlnaHRHcmV5PTEwNTI2ODgwO2Eub2JqMURhcmtHcmV5PTU3ODk3ODQ7YS5vYmoxQmxhY2s9NTI2MzQ0O3JldHVybiBhfSgpLGxhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT01NDM5MjMyO2EuYmdEYXJrR3JleT0xNjcyODU3NjthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9NTQzOTIzMjthLm9iajBEYXJrR3JleT0xNjcyODU3NjthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPQoxNjc3NzIxNTthLm9iajFMaWdodEdyZXk9NTQzOTIzMjthLm9iajFEYXJrR3JleT0xNjcyODU3NjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHBhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xNjc3Njk2MDthLmJnRGFya0dyZXk9MTY3MTE2ODA7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2Nzc2OTYwO2Eub2JqMERhcmtHcmV5PTE2NzExNjgwO2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTE2Nzc2OTYwO2Eub2JqMURhcmtHcmV5PTE2NzExNjgwO2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksaWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTE2NzU2MDY3O2EuYmdEYXJrR3JleT04NjYzMjk2O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0KMTY3NTYwNjc7YS5vYmowRGFya0dyZXk9ODY2MzI5NjthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc1NjA2NzthLm9iajFEYXJrR3JleT04NjYzMjk2O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksbmE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0wO2EuYmdMaWdodEdyZXk9MzM5MjQ7YS5iZ0RhcmtHcmV5PTE2NzY4NTEyO2EuYmdCbGFjaz0xNjc3NzIxNTthLm9iajBXaGl0ZT0wO2Eub2JqMExpZ2h0R3JleT0zMzkyNDthLm9iajBEYXJrR3JleT0xNjc2ODUxMjthLm9iajBCbGFjaz0xNjc3NzIxNTthLm9iajFXaGl0ZT0wO2Eub2JqMUxpZ2h0R3JleT0zMzkyNDthLm9iajFEYXJrR3JleT0xNjc2ODUxMjthLm9iajFCbGFjaz0xNjc3NzIxNTtyZXR1cm4gYX0oKSx0YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTA4NTU4NDU7YS5iZ0RhcmtHcmV5PTUzOTUwMjY7CmEuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xMDg1NTg0NTthLm9iajBEYXJrR3JleT01Mzk1MDI2O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTEwODU1ODQ1O2Eub2JqMURhcmtHcmV5PTUzOTUwMjY7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxvYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MTI1O2EuYmdMaWdodEdyZXk9MTY3NDk3MTY7YS5iZ0RhcmtHcmV5PTk3Mzc0NzE7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcxMjU7YS5vYmowTGlnaHRHcmV5PTE2NzQ5NzE2O2Eub2JqMERhcmtHcmV5PTk3Mzc0NzE7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzEyNTthLm9iajFMaWdodEdyZXk9MTY3NDk3MTY7YS5vYmoxRGFya0dyZXk9OTczNzQ3MTthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLGthPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9CjE2NzcwNzU3O2EuYmdMaWdodEdyZXk9MTM1NDA0ODQ7YS5iZ0RhcmtHcmV5PTg2NzgxODU7YS5iZ0JsYWNrPTU5MTA3OTI7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzU2MDY3O2Eub2JqMERhcmtHcmV5PTg2NjMyOTY7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NTYwNjc7YS5vYmoxRGFya0dyZXk9ODY2MzI5NjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLG1hPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT04MTI2MjU3O2EuYmdEYXJrR3JleT0yNTU0MTthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NDU2MDQ7YS5vYmowRGFya0dyZXk9OTcxNDIzNDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc0NTYwNDthLm9iajFEYXJrR3JleT05NzE0MjM0OwphLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHNhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT05MjExMTAyO2EuYmdEYXJrR3JleT01Mzk1MDg0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc0NTYwNDthLm9iajBEYXJrR3JleT05NzE0MjM0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTE2NzU2MDY3O2Eub2JqMURhcmtHcmV5PTg2NjMyOTY7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxqYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTY3NDU2MDQ7YS5iZ0RhcmtHcmV5PTk3MTQyMzQ7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTgxMjYyNTc7YS5vYmowRGFya0dyZXk9MzM3OTI7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0KMTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCkscmE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTY1MzA1NTk7YS5iZ0RhcmtHcmV5PTI1NTthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NDU2MDQ7YS5vYmowRGFya0dyZXk9OTcxNDIzNDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT04MTI2MjU3O2Eub2JqMURhcmtHcmV5PTMzNzkyO2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCkscWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTE2Nzc2OTYwO2EuYmdEYXJrR3JleT04MDc5ODcyO2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT02NTMwNTU5O2Eub2JqMERhcmtHcmV5PQoyNTU7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9ODEyNjI1NzthLm9iajFEYXJrR3JleT0zMzc5MjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHZhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTA4NTM2MzE7YS5iZ0xpZ2h0R3JleT0xNjc3Njk2MDthLmJnRGFya0dyZXk9MjUzNDQ7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTA4NTM2MzE7YS5vYmowTGlnaHRHcmV5PTE2Nzc2OTYwO2Eub2JqMERhcmtHcmV5PTI1MzQ0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTA4NTM2MzE7YS5vYmoxTGlnaHRHcmV5PTE2Nzc2OTYwO2Eub2JqMURhcmtHcmV5PTI1MzQ0O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksd2E9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTY1MzA1NTk7YS5iZ0RhcmtHcmV5PTI1NTthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTsKYS5vYmowTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMERhcmtHcmV5PTk3MTQyMzQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9NjUzMDU1OTthLm9iajFEYXJrR3JleT0yNTU7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSx4YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTY3NDU2MDQ7YS5iZ0RhcmtHcmV5PTk3MTQyMzQ7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTgxMjYyNTc7YS5vYmowRGFya0dyZXk9MzM3OTI7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NDU2MDQ7YS5vYmoxRGFya0dyZXk9OTcxNDIzNDthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHlhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTE5MDg2MDc7YS5iZ0xpZ2h0R3JleT0xNjc3NzEwODthLmJnRGFya0dyZXk9CjExMzYwODM0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTA7YS5vYmowTGlnaHRHcmV5PTE2Nzc3MjE1O2Eub2JqMERhcmtHcmV5PTE2NzQ1NjA0O2Eub2JqMEJsYWNrPTk3MTQyMzQ7YS5vYmoxV2hpdGU9MDthLm9iajFMaWdodEdyZXk9MTY3NzcyMTU7YS5vYmoxRGFya0dyZXk9MTY3NDU2MDQ7YS5vYmoxQmxhY2s9OTcxNDIzNDtyZXR1cm4gYX0oKSx6YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTEzODIxNDg7YS5iZ0RhcmtHcmV5PTQzNTQ5Mzk7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzQxMTIwO2Eub2JqMERhcmtHcmV5PTk3MTYyMjQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9NTk0Njg3OTthLm9iajFEYXJrR3JleT0xNjcxMTY4MDthLm9iajFCbGFjaz0yNTU7cmV0dXJuIGF9KCksQWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLmJnV2hpdGU9MTY3NzcxMTY7YS5iZ0xpZ2h0R3JleT05NzQ1OTE5O2EuYmdEYXJrR3JleT02NTI2MDY3O2EuYmdCbGFjaz0xNDkwNjthLm9iajBXaGl0ZT0xNjc2MjE3ODthLm9iajBMaWdodEdyZXk9MTY3NjY0NjQ7YS5vYmowRGFya0dyZXk9OTcxNDE3NjthLm9iajBCbGFjaz00ODQ5NjY0O2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc0NTYwNDthLm9iajFEYXJrR3JleT05NzE0MjM0O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksQmE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT03MDc3NjMyO2EuYmdMaWdodEdyZXk9MTY3NzcyMTU7YS5iZ0RhcmtHcmV5PTE2NzMyNzQ2O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc3NzIxNTthLm9iajBEYXJrR3JleT02NTMwNTU5O2Eub2JqMEJsYWNrPTI1NTthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NTYwNjc7YS5vYmoxRGFya0dyZXk9Cjg2NjMyOTY7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxDYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTEwODUzNjMxO2EuYmdMaWdodEdyZXk9MTY3NzY5NjA7YS5iZ0RhcmtHcmV5PTI1MzQ0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2NzM3MTA2O2Eub2JqMExpZ2h0R3JleT0xNDAyNDcwNDthLm9iajBEYXJrR3JleT02NDg4MDY0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MjU1O2Eub2JqMUxpZ2h0R3JleT0xNjc3NzIxNTthLm9iajFEYXJrR3JleT0xNjc3NzA4MzthLm9iajFCbGFjaz0zNDA0NztyZXR1cm4gYX0oKSxEYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MTY2O2EuYmdMaWdodEdyZXk9NjU0OTQ4NzthLmJnRGFya0dyZXk9MTAyNTc0NTc7YS5iZ0JsYWNrPTU5MjEzNzA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzQxMTIwO2Eub2JqMERhcmtHcmV5PTk3MTYyMjQ7YS5vYmowQmxhY2s9CjA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksRWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTE2NzQ1NjA0O2EuYmdEYXJrR3JleT05NzE0MjM0O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT02NTI4MDthLm9iajBEYXJrR3JleT0zMjQ1MDU2O2Eub2JqMEJsYWNrPTE4OTQ0O2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT02NTMwNTU5O2Eub2JqMURhcmtHcmV5PTI1NTthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLEZhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT02NTMwNTU5O2EuYmdEYXJrR3JleT0yNTU7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzY5NjA7YS5vYmowTGlnaHRHcmV5PQoxNjcxMTY4MDthLm9iajBEYXJrR3JleT02NDg4MDY0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTgxMjYyNTc7YS5vYmoxRGFya0dyZXk9MzM3OTI7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxHYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTEzODIxNDg7YS5iZ0RhcmtHcmV5PTQzNTQ5Mzk7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzU2MDY3O2Eub2JqMERhcmtHcmV5PTE2NzU2MDY3O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksZD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPU4uYmdXaGl0ZTthLmJnTGlnaHRHcmV5PU4uYmdMaWdodEdyZXk7YS5iZ0RhcmtHcmV5PQpOLmJnRGFya0dyZXk7YS5iZ0JsYWNrPU4uYmdCbGFjazthLm9iajBXaGl0ZT1OLm9iajBXaGl0ZTthLm9iajBMaWdodEdyZXk9Ti5vYmowTGlnaHRHcmV5O2Eub2JqMERhcmtHcmV5PU4ub2JqMERhcmtHcmV5O2Eub2JqMEJsYWNrPU4ub2JqMEJsYWNrO2Eub2JqMVdoaXRlPU4ub2JqMVdoaXRlO2Eub2JqMUxpZ2h0R3JleT1OLm9iajFMaWdodEdyZXk7YS5vYmoxRGFya0dyZXk9Ti5vYmoxRGFya0dyZXk7YS5vYmoxQmxhY2s9Ti5vYmoxQmxhY2s7cmV0dXJuIGF9KCksWGE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZUluZGV4PTY1Mzg0O2EubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZURhdGE9NjUzODU7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVJbmRleD02NTM4NjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZURhdGE9NjUzODc7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlPTY1MzUxOwphLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZT02NTM1MjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bz02NTM1MztyZXR1cm4gYX0oKSxkYj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS50aWxlSWQ9LTE7YS5ob3Jpem9udGFsRmxpcD0hMTthLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPS0xO3JldHVybiBhfSgpLHk9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihjKXt2YXIgYj1hLk5SeDBOZWdhdGU7YS5OUngwU3dlZXBQZXJpb2Q9KGMmMTEyKT4+NDthLk5SeDBOZWdhdGU9ZygzLGMpO2EuTlJ4MFN3ZWVwU2hpZnQ9YyY3O2ImJiFhLk5SeDBOZWdhdGUmJmEuc3dlZXBOZWdhdGVTaG91bGREaXNhYmxlQ2hhbm5lbE9uQ2xlYXImJihhLmlzRW5hYmxlZD0hMSl9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihjKXthLk5SeDFEdXR5PWM+PjYmMzthLk5SeDFMZW5ndGhMb2FkPWMmNjM7YS5sZW5ndGhDb3VudGVyPWEuTUFYX0xFTkdUSC0KYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGMpe2EuaXNFbmFibGVkJiYoMD09PWEuTlJ4MkVudmVsb3BlUGVyaW9kJiZhLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZyYmKGEudm9sdW1lPWEudm9sdW1lKzEmMTUpLGEuTlJ4MkVudmVsb3BlQWRkTW9kZSE9PWcoMyxjKSYmKGEudm9sdW1lPTE2LWEudm9sdW1lJjE1KSk7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yz4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ZygzLGMpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWMmNztjPTA8KGMmMjQ4KTthLmlzRGFjRW5hYmxlZD1jO2N8fChhLmlzRW5hYmxlZD0hMSl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihjKXthLk5SeDNGcmVxdWVuY3lMU0I9YzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8Y307YS51cGRhdGVOUng0PWZ1bmN0aW9uKGMpe3ZhciBiPWMmNzthLk5SeDRGcmVxdWVuY3lNU0I9YjthLmZyZXF1ZW5jeT1iPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQjsKYj0xPT09KGguZnJhbWVTZXF1ZW5jZXImMSk7dmFyIGQ9IWEuTlJ4NExlbmd0aEVuYWJsZWQmJmcoNixjKTshYiYmMDxhLmxlbmd0aENvdW50ZXImJmQmJigtLWEubGVuZ3RoQ291bnRlcixnKDcsYyl8fDAhPT1hLmxlbmd0aENvdW50ZXJ8fChhLmlzRW5hYmxlZD0hMSkpO2EuTlJ4NExlbmd0aEVuYWJsZWQ9Zyg2LGMpO2coNyxjKSYmKGEudHJpZ2dlcigpLCFiJiZhLmxlbmd0aENvdW50ZXI9PT1hLk1BWF9MRU5HVEgmJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYS5sZW5ndGhDb3VudGVyKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN5Y2xlQ291bnRlcjtlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDBTd2VlcFBlcmlvZDtlWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDBOZWdhdGU7ZVsxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUngwU3dlZXBTaGlmdDtlWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDFEdXR5OwplWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDFMZW5ndGhMb2FkO2VbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2VbMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4MkVudmVsb3BlQWRkTW9kZTtlWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDJFbnZlbG9wZVBlcmlvZDtlWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDNGcmVxdWVuY3lMU0I7ZVsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUng0TGVuZ3RoRW5hYmxlZDtlWzEwMzkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDRGcmVxdWVuY3lNU0I7ZVsxMDQwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0VuYWJsZWQ7ZVsxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0RhY0VuYWJsZWQ7ZVsxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3k7ZVsxMDQ2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtlWzEwNTArNTAqCmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7ZVsxMDU0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmc7ZVsxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2VbMTA1OSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2VbMTA2Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZHV0eUN5Y2xlO2VbMTA2NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eTtlWzEwNjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzU3dlZXBFbmFibGVkO2VbMTA2Nis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuc3dlZXBDb3VudGVyO2VbMTA3MCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuc3dlZXBTaGFkb3dGcmVxdWVuY3k7ZVsxMDczKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcE5lZ2F0ZVNob3VsZERpc2FibGVDaGFubmVsT25DbGVhcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN5Y2xlQ291bnRlcj0KZVsxMDI0KzUwKmEuY3ljbGVDb3VudGVyXTthLk5SeDBTd2VlcFBlcmlvZD1lWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLk5SeDBOZWdhdGU9aygxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5OUngwU3dlZXBTaGlmdD1lWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XTthLk5SeDFEdXR5PWVbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlJ4MUxlbmd0aExvYWQ9ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5OUngyU3RhcnRpbmdWb2x1bWU9ZVsxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5OUngyRW52ZWxvcGVBZGRNb2RlPWsoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWVbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1lWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XTthLk5SeDRMZW5ndGhFbmFibGVkPWsoMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1lWzEwMzkrCjUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc0VuYWJsZWQ9aygxMDQwKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc0RhY0VuYWJsZWQ9aygxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3k9ZVsxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5mcmVxdWVuY3lUaW1lcj1lWzEwNDYrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1lWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZz1rKDEwNTQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmxlbmd0aENvdW50ZXI9ZVsxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9ZVsxMDU5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kdXR5Q3ljbGU9ZVsxMDYzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PWVbMTA2NCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNTd2VlcEVuYWJsZWQ9aygxMDY1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5zd2VlcENvdW50ZXI9CmVbMTA2Nis1MCphLnNhdmVTdGF0ZVNsb3RdO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9ZVsxMDcwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zd2VlcE5lZ2F0ZVNob3VsZERpc2FibGVDaGFubmVsT25DbGVhcj1rKDEwNzMrNTAqYS5zYXZlU3RhdGVTbG90KX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjgpO2YoYS5tZW1vcnlMb2NhdGlvbk5SeDEsMTkxKTtmKGEubWVtb3J5TG9jYXRpb25OUngyLDI0Myk7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MywxOTMpO2YoYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKTtiLkJvb3RST01FbmFibGVkJiYoZihhLm1lbW9yeUxvY2F0aW9uTlJ4MSw2MyksZihhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKSxmKGEubWVtb3J5TG9jYXRpb25OUngzLDApLGYoYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KSl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBjPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPQowO3JldHVybiBhLmdldFNhbXBsZShjKX07YS5yZXNldFRpbWVyPWZ1bmN0aW9uKCl7dmFyIGM9MjA0OC1hLmZyZXF1ZW5jeTw8MjtiLkdCQ0RvdWJsZVNwZWVkJiYoYzw8PTIpO2EuZnJlcXVlbmN5VGltZXI9Y307YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYyl7dmFyIGI9YS5mcmVxdWVuY3lUaW1lcjtmb3IoYi09YzswPj1iOyljPU1hdGguYWJzKGIpLGEucmVzZXRUaW1lcigpLGI9YS5mcmVxdWVuY3lUaW1lcixiLT1jLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkrMSY3O2EuZnJlcXVlbmN5VGltZXI9YjtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZSYxNTtlbHNlIHJldHVybiAxNTtjPTE7ZGMoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYz0tYyk7cmV0dXJuIGMqYisxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj0KYS5NQVhfTEVOR1RIKTthLnJlc2V0VGltZXIoKTthLmVudmVsb3BlQ291bnRlcj0wPT09YS5OUngyRW52ZWxvcGVQZXJpb2Q/ODphLk5SeDJFbnZlbG9wZVBlcmlvZDthLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZz0hMDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PWEuZnJlcXVlbmN5O2Euc3dlZXBDb3VudGVyPTA9PT1hLk5SeDBTd2VlcFBlcmlvZD84OmEuTlJ4MFN3ZWVwUGVyaW9kO2EuaXNTd2VlcEVuYWJsZWQ9MDxhLk5SeDBTd2VlcFBlcmlvZHx8MDxhLk5SeDBTd2VlcFNoaWZ0O2Euc3dlZXBOZWdhdGVTaG91bGREaXNhYmxlQ2hhbm5lbE9uQ2xlYXI9ITE7dmFyIGM7aWYoYz0wPGEuTlJ4MFN3ZWVwU2hpZnQpYz0yMDQ3PEZiKCk/ITA6ITE7YyYmKGEuaXNFbmFibGVkPSExKTthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihjKXtjPWEuY3ljbGVDb3VudGVyKwpjO2EuY3ljbGVDb3VudGVyPWM7cmV0dXJuISgwPGEuZnJlcXVlbmN5VGltZXItYyl9O2EudXBkYXRlU3dlZXA9ZnVuY3Rpb24oKXtpZihhLmlzRW5hYmxlZCYmYS5pc1N3ZWVwRW5hYmxlZCl7dmFyIGM9YS5zd2VlcENvdW50ZXItMTswPj1jPzA9PT1hLk5SeDBTd2VlcFBlcmlvZD9hLnN3ZWVwQ291bnRlcj04OihhLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZCxjPUZiKCksMjA0NzxjJiYoYS5pc0VuYWJsZWQ9ITEpLDA8YS5OUngwU3dlZXBTaGlmdCYmKGEuc2V0RnJlcXVlbmN5KGMpLDIwNDc8RmIoKSYmKGEuaXNFbmFibGVkPSExKSkpOmEuc3dlZXBDb3VudGVyPWN9fTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpe3ZhciBjPWEubGVuZ3RoQ291bnRlcjswPGMmJmEuTlJ4NExlbmd0aEVuYWJsZWQmJigtLWMsMD09PWMmJihhLmlzRW5hYmxlZD0hMSkpO2EubGVuZ3RoQ291bnRlcj1jfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7dmFyIGM9YS5lbnZlbG9wZUNvdW50ZXItCjE7aWYoMD49YylpZigwPT09YS5OUngyRW52ZWxvcGVQZXJpb2QpYz04O2Vsc2UgaWYoYz1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YyYmYS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmcpe3ZhciBiPWEudm9sdW1lO2I9YS5OUngyRW52ZWxvcGVBZGRNb2RlP2IrMTpiLTE7YiY9MTU7MTU+Yj9hLnZvbHVtZT1iOmEuaXNFbnZlbG9wZUF1dG9tYXRpY1VwZGF0aW5nPSExfWEuZW52ZWxvcGVDb3VudGVyPWN9O2Euc2V0RnJlcXVlbmN5PWZ1bmN0aW9uKGMpe2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9Yzt2YXIgYj1jPj44Jjc7YyY9MjU1O3ZhciBkPXYoYS5tZW1vcnlMb2NhdGlvbk5SeDQpJjI0OHxiO2YoYS5tZW1vcnlMb2NhdGlvbk5SeDMsYyk7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4NCxkKTthLk5SeDNGcmVxdWVuY3lMU0I9YzthLk5SeDRGcmVxdWVuY3lNU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLmN5Y2xlQ291bnRlcj0KMDthLk1BWF9MRU5HVEg9NjQ7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUyOTY7YS5OUngwU3dlZXBQZXJpb2Q9MDthLk5SeDBOZWdhdGU9ITE7YS5OUngwU3dlZXBTaGlmdD0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1Mjk3O2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUyOTg7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTI5OTthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMwMDthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EuY2hhbm5lbE51bWJlcj0xO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmc9CiExO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kdXR5Q3ljbGU9MDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MDthLmlzU3dlZXBFbmFibGVkPSExO2Euc3dlZXBDb3VudGVyPTA7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT0wO2Euc3dlZXBOZWdhdGVTaG91bGREaXNhYmxlQ2hhbm5lbE9uQ2xlYXI9ITE7YS5zYXZlU3RhdGVTbG90PTc7cmV0dXJuIGF9KCksRD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngxPWZ1bmN0aW9uKGMpe2EuTlJ4MUR1dHk9Yz4+NiYzO2EuTlJ4MUxlbmd0aExvYWQ9YyY2MzthLmxlbmd0aENvdW50ZXI9YS5NQVhfTEVOR1RILWEuTlJ4MUxlbmd0aExvYWR9O2EudXBkYXRlTlJ4Mj1mdW5jdGlvbihjKXthLmlzRW5hYmxlZCYmKDA9PT1hLk5SeDJFbnZlbG9wZVBlcmlvZCYmYS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmcmJihhLnZvbHVtZT1hLnZvbHVtZSsxJjE1KSxhLk5SeDJFbnZlbG9wZUFkZE1vZGUhPT1nKDMsYykmJgooYS52b2x1bWU9MTYtYS52b2x1bWUmMTUpKTthLk5SeDJTdGFydGluZ1ZvbHVtZT1jPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1nKDMsYyk7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YyY3O2M9MDwoYyYyNDgpO2EuaXNEYWNFbmFibGVkPWM7Y3x8KGEuaXNFbmFibGVkPWMpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYyl7YS5OUngzRnJlcXVlbmN5TFNCPWM7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGN9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihjKXt2YXIgYj1jJjc7YS5OUng0RnJlcXVlbmN5TVNCPWI7YS5mcmVxdWVuY3k9Yjw8OHxhLk5SeDNGcmVxdWVuY3lMU0I7Yj0xPT09KGguZnJhbWVTZXF1ZW5jZXImMSk7dmFyIGQ9IWEuTlJ4NExlbmd0aEVuYWJsZWQmJmcoNixjKTshYiYmMDxhLmxlbmd0aENvdW50ZXImJmQmJigtLWEubGVuZ3RoQ291bnRlcixnKDcsYyl8fDAhPT1hLmxlbmd0aENvdW50ZXJ8fChhLmlzRW5hYmxlZD0hMSkpO2EuTlJ4NExlbmd0aEVuYWJsZWQ9CmcoNixjKTtnKDcsYykmJihhLnRyaWdnZXIoKSwhYiYmYS5sZW5ndGhDb3VudGVyPT09YS5NQVhfTEVOR1RIJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcil9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jeWNsZUNvdW50ZXI7ZVsxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUngxRHV0eTtlWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDFMZW5ndGhMb2FkO2VbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2VbMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4MkVudmVsb3BlQWRkTW9kZTtlWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDJFbnZlbG9wZVBlcmlvZDtlWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDNGcmVxdWVuY3lMU0I7ZVsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUng0TGVuZ3RoRW5hYmxlZDtlWzEwMzkrNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5OUng0RnJlcXVlbmN5TVNCO2VbMTA0MCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNFbmFibGVkO2VbMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNEYWNFbmFibGVkO2VbMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5O2VbMTA0Nis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7ZVsxMDUwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7ZVsxMDU0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmc7ZVsxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2VbMTA1OSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2VbMTA2Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZHV0eUN5Y2xlO2VbMTA2NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN5Y2xlQ291bnRlcj1lWzEwMjQrCjUwKmEuY3ljbGVDb3VudGVyXTthLk5SeDFEdXR5PWVbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlJ4MUxlbmd0aExvYWQ9ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5OUngyU3RhcnRpbmdWb2x1bWU9ZVsxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5OUngyRW52ZWxvcGVBZGRNb2RlPWsoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWVbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1lWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XTthLk5SeDRMZW5ndGhFbmFibGVkPWsoMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1lWzEwMzkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzRW5hYmxlZD1rKDEwNDArNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzRGFjRW5hYmxlZD1rKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeT1lWzEwNDIrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS5mcmVxdWVuY3lUaW1lcj1lWzEwNDYrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1lWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XTthLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZz1rKDEwNTQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmxlbmd0aENvdW50ZXI9ZVsxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9ZVsxMDU5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kdXR5Q3ljbGU9ZVsxMDYzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PWVbMTA2NCs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtmKGEubWVtb3J5TG9jYXRpb25OUngxLTEsMjU1KTtmKGEubWVtb3J5TG9jYXRpb25OUngxLDYzKTtmKGEubWVtb3J5TG9jYXRpb25OUngyLDApO2YoYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxODQpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9CmZ1bmN0aW9uKCl7dmFyIGM9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYyl9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9MjA0OC1hLmZyZXF1ZW5jeTw8Mjw8Yi5HQkNEb3VibGVTcGVlZH07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYyl7dmFyIGI9YS5mcmVxdWVuY3lUaW1lcjtmb3IoYi09YzswPj1iOyljPU1hdGguYWJzKGIpLGEucmVzZXRUaW1lcigpLGI9YS5mcmVxdWVuY3lUaW1lcixiLT1jLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkrMSY3O2EuZnJlcXVlbmN5VGltZXI9YjtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZSYxNTtlbHNlIHJldHVybiAxNTtjPTE7ZGMoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYz0tYyk7cmV0dXJuIGMqYisxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7CjA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9YS5NQVhfTEVOR1RIKTthLnJlc2V0VGltZXIoKTthLmVudmVsb3BlQ291bnRlcj0wPT09YS5OUngyRW52ZWxvcGVQZXJpb2Q/ODphLk5SeDJFbnZlbG9wZVBlcmlvZDthLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZz0hMDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihjKXtjPWEuY3ljbGVDb3VudGVyK2M7YS5jeWNsZUNvdW50ZXI9YztyZXR1cm4hKDA8YS5mcmVxdWVuY3lUaW1lci1jKX07YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXt2YXIgYz1hLmxlbmd0aENvdW50ZXI7MDxjJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWM7MD09PWMmJihhLmlzRW5hYmxlZD0hMSk7YS5sZW5ndGhDb3VudGVyPWN9O2EudXBkYXRlRW52ZWxvcGU9ZnVuY3Rpb24oKXt2YXIgYz1hLmVudmVsb3BlQ291bnRlci0KMTtpZigwPj1jKWlmKDA9PT1hLk5SeDJFbnZlbG9wZVBlcmlvZCljPTg7ZWxzZSBpZihjPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1jJiZhLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZyl7dmFyIGI9YS52b2x1bWU7Yj1hLk5SeDJFbnZlbG9wZUFkZE1vZGU/YisxOmItMTtiJj0xNTsxNT5iP2Eudm9sdW1lPWI6YS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmc9ITF9YS5lbnZlbG9wZUNvdW50ZXI9Y307YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYyl7dmFyIGI9Yz4+ODtjJj0yNTU7dmFyIGQ9dihhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGI7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MyxjKTtmKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1jO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iO2EuZnJlcXVlbmN5PWI8PDh8Y307YS5jeWNsZUNvdW50ZXI9MDthLk1BWF9MRU5HVEg9NjQ7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUzMDE7YS5tZW1vcnlMb2NhdGlvbk5SeDE9CjY1MzAyO2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDM7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMwNDthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMwNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EuY2hhbm5lbE51bWJlcj0yO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmc9ITE7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2Euc2F2ZVN0YXRlU2xvdD04O3JldHVybiBhfSgpLHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYyl7Yz1nKDcsYyk7IWEuaXNEYWNFbmFibGVkJiZjJiYoYS5zYW1wbGVCdWZmZXI9MCk7YS5pc0RhY0VuYWJsZWQ9YztjfHwoYS5pc0VuYWJsZWQ9Yyl9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihjKXthLk5SeDFMZW5ndGhMb2FkPWM7YS5sZW5ndGhDb3VudGVyPWEuTUFYX0xFTkdUSC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYyl7YS5OUngyVm9sdW1lQ29kZT1jPj41JjE1fTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYyl7YS5OUngzRnJlcXVlbmN5TFNCPWM7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGN9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihjKXt2YXIgYj1jJjc7YS5OUng0RnJlcXVlbmN5TVNCPWI7YS5mcmVxdWVuY3k9Yjw8OHxhLk5SeDNGcmVxdWVuY3lMU0I7Yj0xPT09KGguZnJhbWVTZXF1ZW5jZXImMSk7aWYoIWIpe3ZhciBkPSFhLk5SeDRMZW5ndGhFbmFibGVkJiZnKDYsYyk7MDxhLmxlbmd0aENvdW50ZXImJgpkJiYoLS1hLmxlbmd0aENvdW50ZXIsZyg3LGMpfHwwIT09YS5sZW5ndGhDb3VudGVyfHwoYS5pc0VuYWJsZWQ9ITEpKX1hLk5SeDRMZW5ndGhFbmFibGVkPWcoNixjKTtnKDcsYykmJihhLnRyaWdnZXIoKSwhYiYmYS5sZW5ndGhDb3VudGVyPT09YS5NQVhfTEVOR1RIJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcil9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jeWNsZUNvdW50ZXI7ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUngxTGVuZ3RoTG9hZDtlWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDJWb2x1bWVDb2RlO2VbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4M0ZyZXF1ZW5jeUxTQjtlWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDRMZW5ndGhFbmFibGVkO2VbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4NEZyZXF1ZW5jeU1TQjtlWzEwMzkrNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5pc0VuYWJsZWQ7ZVsxMDQwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0RhY0VuYWJsZWQ7ZVsxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3k7ZVsxMDQ1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtlWzEwNDkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7ZVsxMDU3KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlVGFibGVQb3NpdGlvbjtlWzEwNjErNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZUNvZGU7ZVsxMDYyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS52b2x1bWVDb2RlQ2hhbmdlZDtlWzEwNjMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnNhbXBsZUJ1ZmZlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN5Y2xlQ291bnRlcj1lWzEwMjQrNTAqYS5jeWNsZUNvdW50ZXJdO2EuTlJ4MUxlbmd0aExvYWQ9ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5OUngyVm9sdW1lQ29kZT1lWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS5OUngzRnJlcXVlbmN5TFNCPWVbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlJ4NExlbmd0aEVuYWJsZWQ9aygxMDM3KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5OUng0RnJlcXVlbmN5TVNCPWVbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNFbmFibGVkPWsoMTAzOSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNEYWNFbmFibGVkPWsoMTA0MCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5PWVbMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZnJlcXVlbmN5VGltZXI9ZVsxMDQ1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWVbMTA0OSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZVRhYmxlUG9zaXRpb249ZVsxMDU3KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWVDb2RlPWVbMTA2MSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lQ29kZUNoYW5nZWQ9aygxMDYyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5zYW1wbGVCdWZmZXI9ZVsxMDYzKwo1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmhhbmRsZVdhdmVSYW1SZWFkPWZ1bmN0aW9uKCl7cmV0dXJuIHYodC5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZSsodC53YXZlVGFibGVQb3NpdGlvbj4+MXwwKSl9O2EuaGFuZGxlV2F2ZVJhbVdyaXRlPWZ1bmN0aW9uKGMpe2YoYS5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZSsoYS53YXZlVGFibGVQb3NpdGlvbj4+MXwwKSxjKX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjcpO2YoYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtmKGEubWVtb3J5TG9jYXRpb25OUngyLDE1OSk7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtmKGEubWVtb3J5TG9jYXRpb25OUng0LDE4NCk7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMH07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGM9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYyl9O2EucmVzZXRUaW1lcj0KZnVuY3Rpb24oKXthLmZyZXF1ZW5jeVRpbWVyPTIwNDgtYS5mcmVxdWVuY3k8PDE8PGIuR0JDRG91YmxlU3BlZWR9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGMpe2lmKCFhLmlzRW5hYmxlZHx8IWEuaXNEYWNFbmFibGVkKXJldHVybiAxNTt2YXIgYj1hLnZvbHVtZUNvZGU7YS52b2x1bWVDb2RlQ2hhbmdlZCYmKGI9dihhLm1lbW9yeUxvY2F0aW9uTlJ4MiksYj1iPj41JjE1LGEudm9sdW1lQ29kZT1iLGEudm9sdW1lQ29kZUNoYW5nZWQ9ITEpO3ZhciBkPXQuc2FtcGxlQnVmZmVyO2Q+Pj0oMD09PSh0LndhdmVUYWJsZVBvc2l0aW9uJjEpKTw8MjtkJj0xNTt2YXIgZT0wO3N3aXRjaChiKXtjYXNlIDA6ZD4+PTQ7YnJlYWs7Y2FzZSAxOmU9MTticmVhaztjYXNlIDI6ZD4+PTE7ZT0yO2JyZWFrO2RlZmF1bHQ6ZD4+PTIsZT00fWQ9KDA8ZT9kL2U6MCkrMTU7Yj1hLmZyZXF1ZW5jeVRpbWVyO2ZvcihiLT1jOzA+PWI7KXtjPU1hdGguYWJzKGIpO2EucmVzZXRUaW1lcigpO2I9YS5mcmVxdWVuY3lUaW1lcjsKYi09YztjPXQud2F2ZVRhYmxlUG9zaXRpb247Zm9yKGMrPTE7MzI8PWM7KWMtPTMyO3Qud2F2ZVRhYmxlUG9zaXRpb249Yzt0LnNhbXBsZUJ1ZmZlcj12KHQubWVtb3J5TG9jYXRpb25XYXZlVGFibGUrKHQud2F2ZVRhYmxlUG9zaXRpb24+PjF8MCkpfWEuZnJlcXVlbmN5VGltZXI9YjtyZXR1cm4gZH07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj1hLk1BWF9MRU5HVEgpO2EucmVzZXRUaW1lcigpO2EuZnJlcXVlbmN5VGltZXIrPTY7YS53YXZlVGFibGVQb3NpdGlvbj0wO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiEoIWEudm9sdW1lQ29kZUNoYW5nZWQmJjA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcil9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7dmFyIGI9YS5sZW5ndGhDb3VudGVyOwowPGImJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYjswPT09YiYmKGEuaXNFbmFibGVkPSExKTthLmxlbmd0aENvdW50ZXI9Yn07YS5jeWNsZUNvdW50ZXI9MDthLk1BWF9MRU5HVEg9MjU2O2EubWVtb3J5TG9jYXRpb25OUngwPTY1MzA2O2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzA3O2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwODthLk5SeDJWb2x1bWVDb2RlPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMDk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMTA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLm1lbW9yeUxvY2F0aW9uV2F2ZVRhYmxlPTY1MzI4O2EuY2hhbm5lbE51bWJlcj0zO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eud2F2ZVRhYmxlUG9zaXRpb249MDsKYS52b2x1bWVDb2RlPTA7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMTthLnNhbXBsZUJ1ZmZlcj0wO2Euc2F2ZVN0YXRlU2xvdD05O3JldHVybiBhfSgpLEY9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWImNjM7YS5sZW5ndGhDb3VudGVyPWEuTUFYX0xFTkdUSC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5pc0VuYWJsZWQmJigwPT09YS5OUngyRW52ZWxvcGVQZXJpb2QmJmEuaXNFbnZlbG9wZUF1dG9tYXRpY1VwZGF0aW5nJiYoYS52b2x1bWU9YS52b2x1bWUrMSYxNSksYS5OUngyRW52ZWxvcGVBZGRNb2RlIT09ZygzLGIpJiYoYS52b2x1bWU9MTYtYS52b2x1bWUmMTUpKTthLk5SeDJTdGFydGluZ1ZvbHVtZT1iPj40JjE1O2EuTlJ4MkVudmVsb3BlQWRkTW9kZT1nKDMsYik7YS5OUngyRW52ZWxvcGVQZXJpb2Q9YiY3O2I9MDwoYiYyNDgpO2EuaXNEYWNFbmFibGVkPWI7Ynx8CihhLmlzRW5hYmxlZD1iKX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe3ZhciBjPWImNzthLk5SeDNDbG9ja1NoaWZ0PWI+PjQ7YS5OUngzV2lkdGhNb2RlPWcoMyxiKTthLk5SeDNEaXZpc29yQ29kZT1jO2M8PD0xOzE+YyYmKGM9MSk7YS5kaXZpc29yPWM8PDN9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXt2YXIgYz0xPT09KGguZnJhbWVTZXF1ZW5jZXImMSksZD0hYS5OUng0TGVuZ3RoRW5hYmxlZCYmZyg2LGIpOyFjJiYwPGEubGVuZ3RoQ291bnRlciYmZCYmKC0tYS5sZW5ndGhDb3VudGVyLGcoNyxiKXx8MCE9PWEubGVuZ3RoQ291bnRlcnx8KGEuaXNFbmFibGVkPSExKSk7YS5OUng0TGVuZ3RoRW5hYmxlZD1nKDYsYik7Zyg3LGIpJiYoYS50cmlnZ2VyKCksIWMmJmEubGVuZ3RoQ291bnRlcj09PWEuTUFYX0xFTkdUSCYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXIpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPQphLmN5Y2xlQ291bnRlcjtlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDFMZW5ndGhMb2FkO2VbMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2VbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4MkVudmVsb3BlQWRkTW9kZTtlWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDJFbnZlbG9wZVBlcmlvZDtlWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDNDbG9ja1NoaWZ0O2VbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlJ4M1dpZHRoTW9kZTtlWzEwMzUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDNEaXZpc29yQ29kZTtlWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SeDRMZW5ndGhFbmFibGVkO2VbMTAzOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNFbmFibGVkO2VbMTA0MCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNEYWNFbmFibGVkO2VbMTA0NSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7CmVbMTA0OSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2VbMTA1Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNFbnZlbG9wZUF1dG9tYXRpY1VwZGF0aW5nO2VbMTA1NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtlWzEwNTgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtlWzEwNjIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN5Y2xlQ291bnRlcj1lWzEwMjQrNTAqYS5jeWNsZUNvdW50ZXJdO2EuTlJ4MUxlbmd0aExvYWQ9ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5OUngyU3RhcnRpbmdWb2x1bWU9ZVsxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5OUngyRW52ZWxvcGVBZGRNb2RlPWsoMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWVbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlJ4M0Nsb2NrU2hpZnQ9CmVbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlJ4M1dpZHRoTW9kZT1rKDEwMzQrNTAqYS5zYXZlU3RhdGVTbG90KTthLk5SeDNEaXZpc29yQ29kZT1lWzEwMzUrNTAqYS5zYXZlU3RhdGVTbG90XTthLk5SeDRMZW5ndGhFbmFibGVkPWsoMTAzNys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNFbmFibGVkPWsoMTAzOSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNEYWNFbmFibGVkPWsoMTA0MCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9ZVsxMDQ1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5lbnZlbG9wZUNvdW50ZXI9ZVsxMDQ5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc0VudmVsb3BlQXV0b21hdGljVXBkYXRpbmc9aygxMDUzKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5sZW5ndGhDb3VudGVyPWVbMTA1NCs1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lPWVbMTA1OCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPWVbMTA2MisKNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MS0xLDI1NSk7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MSwyNTUpO2YoYS5tZW1vcnlMb2NhdGlvbk5SeDIsMCk7ZihhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtmKGEubWVtb3J5TG9jYXRpb25OUng0LDE5MSl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXt2YXIgYz1hLmZyZXF1ZW5jeVRpbWVyO2MtPWI7aWYoMD49Yyl7Yj1NYXRoLmFicyhjKTtjPWEuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kKCk7Yy09YjtiPWEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyO3ZhciBkPWImMV5iPj4xJjE7Yj1iPj4xfGQ8PDE0O2EuTlJ4M1dpZHRoTW9kZSYmKGI9YiYtNjV8ZDw8Nik7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9CmJ9MD5jJiYoYz0wKTthLmZyZXF1ZW5jeVRpbWVyPWM7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWM9YS52b2x1bWUmMTU7ZWxzZSByZXR1cm4gMTU7Yj1nKDAsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXIpPy0xOjE7cmV0dXJuIGIqYysxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj1hLk1BWF9MRU5HVEgpO2EuZnJlcXVlbmN5VGltZXI9YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2QoKTthLmVudmVsb3BlQ291bnRlcj0wPT09YS5OUngyRW52ZWxvcGVQZXJpb2Q/ODphLk5SeDJFbnZlbG9wZVBlcmlvZDthLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZz0hMDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj0zMjc2NzthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT0KZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuISgwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXIpfTthLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZD1mdW5jdGlvbigpe3JldHVybiBhLmRpdmlzb3I8PGEuTlJ4M0Nsb2NrU2hpZnQ8PGIuR0JDRG91YmxlU3BlZWR9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7dmFyIGI9YS5sZW5ndGhDb3VudGVyOzA8YiYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1iOzA9PT1iJiYoYS5pc0VuYWJsZWQ9ITEpO2EubGVuZ3RoQ291bnRlcj1ifTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7dmFyIGI9YS5lbnZlbG9wZUNvdW50ZXItMTtpZigwPj1iKWlmKDA9PT1hLk5SeDJFbnZlbG9wZVBlcmlvZCliPTg7ZWxzZSBpZihiPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1iJiZhLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZyl7dmFyIGQ9YS52b2x1bWU7ZD1hLk5SeDJFbnZlbG9wZUFkZE1vZGU/ZCsxOmQtCjE7ZCY9MTU7MTU+ZD9hLnZvbHVtZT1kOmEuaXNFbnZlbG9wZUF1dG9tYXRpY1VwZGF0aW5nPSExfWEuZW52ZWxvcGVDb3VudGVyPWJ9O2EuY3ljbGVDb3VudGVyPTA7YS5NQVhfTEVOR1RIPTY0O2EubWVtb3J5TG9jYXRpb25OUngwPTY1MzExO2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzEyO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMxMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzE0O2EuTlJ4M0Nsb2NrU2hpZnQ9MDthLk5SeDNXaWR0aE1vZGU9ITE7YS5OUngzRGl2aXNvckNvZGU9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMxNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuY2hhbm5lbE51bWJlcj00O2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0KMDthLmlzRW52ZWxvcGVBdXRvbWF0aWNVcGRhdGluZz0hMTthLmxlbmd0aENvdW50ZXI9MDthLnZvbHVtZT0wO2EuZGl2aXNvcj0wO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPTA7YS5zYXZlU3RhdGVTbG90PTEwO3JldHVybiBhfSgpLHA9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuY2hhbm5lbDFTYW1wbGU9MTU7YS5jaGFubmVsMlNhbXBsZT0xNTthLmNoYW5uZWwzU2FtcGxlPTE1O2EuY2hhbm5lbDRTYW1wbGU9MTU7YS5jaGFubmVsMURhY0VuYWJsZWQ9ITE7YS5jaGFubmVsMkRhY0VuYWJsZWQ9ITE7YS5jaGFubmVsM0RhY0VuYWJsZWQ9ITE7YS5jaGFubmVsNERhY0VuYWJsZWQ9ITE7YS5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7YS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O2EubWl4ZXJWb2x1bWVDaGFuZ2VkPSExO2EubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTthLm5lZWRUb1JlbWl4U2FtcGxlcz0hMTtyZXR1cm4gYX0oKSxoPQpmdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gODc8PGIuR0JDRG91YmxlU3BlZWR9O2EudXBkYXRlTlI1MD1mdW5jdGlvbihiKXthLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9Yj4+NCY3O2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9YiY3fTthLnVwZGF0ZU5SNTE9ZnVuY3Rpb24oYil7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9Zyg3LGIpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PWcoNixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD1nKDUsYik7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9Zyg0LGIpO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD1nKDMsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PWcoMixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ZygxLGIpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0KZygwLGIpfTthLnVwZGF0ZU5SNTI9ZnVuY3Rpb24oYil7YS5OUjUySXNTb3VuZEVuYWJsZWQ9Zyg3LGIpfTthLm1heEZyYW1lU2VxdWVuY2VDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gODE5Mjw8Yi5HQkNEb3VibGVTcGVlZH07YS5tYXhEb3duU2FtcGxlQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuQ0xPQ0tfU1BFRUQoKS9hLnNhbXBsZVJhdGV9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUjUwTGVmdE1peGVyVm9sdW1lO2VbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU7ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ7ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ7ZVsxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ7CmVbMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0O2VbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dDtlWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ7ZVsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0O2VbMTAzOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dDtlWzEwNDArNTAqYS5zYXZlU3RhdGVTbG90XT1hLk5SNTJJc1NvdW5kRW5hYmxlZDtlWzEwNDErNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI7ZVsxMDQ2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmFtZVNlcXVlbmNlcjtlWzEwNDcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI7CmVbMTA0OCs1MCphLnNhdmVTdGF0ZVNsb3RdPXAuY2hhbm5lbDFTYW1wbGU7ZVsxMDQ5KzUwKmEuc2F2ZVN0YXRlU2xvdF09cC5jaGFubmVsMlNhbXBsZTtlWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XT1wLmNoYW5uZWwzU2FtcGxlO2VbMTA1MSs1MCphLnNhdmVTdGF0ZVNsb3RdPXAuY2hhbm5lbDRTYW1wbGU7ZVsxMDUyKzUwKmEuc2F2ZVN0YXRlU2xvdF09cC5jaGFubmVsMURhY0VuYWJsZWQ7ZVsxMDUzKzUwKmEuc2F2ZVN0YXRlU2xvdF09cC5jaGFubmVsMkRhY0VuYWJsZWQ7ZVsxMDU0KzUwKmEuc2F2ZVN0YXRlU2xvdF09cC5jaGFubmVsM0RhY0VuYWJsZWQ7ZVsxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF09cC5jaGFubmVsNERhY0VuYWJsZWQ7ZVsxMDU2KzUwKmEuc2F2ZVN0YXRlU2xvdF09cC5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZTtlWzEwNTcrNTAqYS5zYXZlU3RhdGVTbG90XT1wLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZTtlWzEwNTgrNTAqYS5zYXZlU3RhdGVTbG90XT0KcC5taXhlclZvbHVtZUNoYW5nZWQ7ZVsxMDU5KzUwKmEuc2F2ZVN0YXRlU2xvdF09cC5taXhlckVuYWJsZWRDaGFuZ2VkfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuTlI1MExlZnRNaXhlclZvbHVtZT1lWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLk5SNTBSaWdodE1peGVyVm9sdW1lPWVbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PWsoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PWsoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PWsoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PWsoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD1rKDEwMzYrNTAqYS5zYXZlU3RhdGVTbG90KTsKYS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PWsoMTAzNys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD1rKDEwMzgrNTAqYS5zYXZlU3RhdGVTbG90KTthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9aygxMDM5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5OUjUySXNTb3VuZEVuYWJsZWQ9aygxMDQwKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWVbMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZnJhbWVTZXF1ZW5jZXI9ZVsxMDQ2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPWVbMTA0Nys1MCphLnNhdmVTdGF0ZVNsb3RdO3AuY2hhbm5lbDFTYW1wbGU9ZVsxMDQ4KzUwKmEuc2F2ZVN0YXRlU2xvdF07cC5jaGFubmVsMlNhbXBsZT1lWzEwNDkrNTAqYS5zYXZlU3RhdGVTbG90XTtwLmNoYW5uZWwzU2FtcGxlPWVbMTA1MCsKNTAqYS5zYXZlU3RhdGVTbG90XTtwLmNoYW5uZWw0U2FtcGxlPWVbMTA1MSs1MCphLnNhdmVTdGF0ZVNsb3RdO3AuY2hhbm5lbDFEYWNFbmFibGVkPWsoMTA1Mis1MCphLnNhdmVTdGF0ZVNsb3QpO3AuY2hhbm5lbDJEYWNFbmFibGVkPWsoMTA1Mys1MCphLnNhdmVTdGF0ZVNsb3QpO3AuY2hhbm5lbDNEYWNFbmFibGVkPWsoMTA1NCs1MCphLnNhdmVTdGF0ZVNsb3QpO3AuY2hhbm5lbDREYWNFbmFibGVkPWsoMTA1NSs1MCphLnNhdmVTdGF0ZVNsb3QpO3AubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9ZVsxMDU2KzUwKmEuc2F2ZVN0YXRlU2xvdF07cC5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9ZVsxMDU3KzUwKmEuc2F2ZVN0YXRlU2xvdF07cC5taXhlclZvbHVtZUNoYW5nZWQ9aygxMDU4KzUwKmEuc2F2ZVN0YXRlU2xvdCk7cC5taXhlckVuYWJsZWRDaGFuZ2VkPWsoMTA1OSs1MCphLnNhdmVTdGF0ZVNsb3QpO2djKCl9O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25OUjUwPQo2NTMxNjthLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9MDthLk5SNTBSaWdodE1peGVyVm9sdW1lPTA7YS5tZW1vcnlMb2NhdGlvbk5SNTE9NjUzMTc7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EubWVtb3J5TG9jYXRpb25OUjUyPTY1MzE4O2EuTlI1MklzU291bmRFbmFibGVkPSEwO2EubWVtb3J5TG9jYXRpb25DaGFubmVsM0xvYWRSZWdpc3RlclN0YXJ0PTY1MzI4O2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0KMDthLmZyYW1lU2VxdWVuY2VyPTA7YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyPTA7YS5zYW1wbGVSYXRlPTQ0MTAwO2EuYXVkaW9RdWV1ZUluZGV4PTA7YS53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZT0xMzEwNzI7YS5zYXZlU3RhdGVTbG90PTY7cmV0dXJuIGF9KCksbT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkPWZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPWcoYS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCxiKTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD1nKGEuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQsYik7YS5pc1RpbWVySW50ZXJydXB0RW5hYmxlZD1nKGEuYml0UG9zaXRpb25UaW1lckludGVycnVwdCxiKTthLmlzU2VyaWFsSW50ZXJydXB0RW5hYmxlZD1nKGEuYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9ZyhhLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0LApiKTthLmludGVycnVwdHNFbmFibGVkVmFsdWU9Yn07YS51cGRhdGVJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ZnVuY3Rpb24oYil7YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD1nKGEuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQsYik7YS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD1nKGEuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQsYik7YS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPWcoYS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0LGIpO2EuaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ZyhhLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0LGIpO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ZyhhLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0LGIpO2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWJ9O2EuYXJlSW50ZXJydXB0c1BlbmRpbmc9ZnVuY3Rpb24oKXtyZXR1cm4gMDwoYS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmYS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJgozMSl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g7ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheTtlWzEwNDArNTAqYS5zYXZlU3RhdGVTbG90XT1hLmludGVycnVwdHNFbmFibGVkVmFsdWU7ZVsxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQ7ZVsxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0xjZEludGVycnVwdEVuYWJsZWQ7ZVsxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc1RpbWVySW50ZXJydXB0RW5hYmxlZDtlWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzU2VyaWFsSW50ZXJydXB0RW5hYmxlZDtlWzEwNDUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZDtlWzEwNTYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZTsKZVsxMDU3KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZDtlWzEwNTgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkO2VbMTA1OSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZDtlWzEwNjArNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkO2VbMTA2MSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWR9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9aygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT1rKDEwMjUrNTAqYS5zYXZlU3RhdGVTbG90KTthLmludGVycnVwdHNFbmFibGVkVmFsdWU9ZVsxMDQwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQ9aygxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7CmEuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPWsoMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9aygxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc1NlcmlhbEludGVycnVwdEVuYWJsZWQ9aygxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9aygxMDQ1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9ZVsxMDU2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD1rKDEwNTcrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPWsoMTA1OCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD1rKDEwNTkrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPWsoMTA2MCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9CmsoMTA2MSs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLm1hc3RlckludGVycnVwdFN3aXRjaD0hMTthLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSExO2EuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ9MDthLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0PTE7YS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0PTI7YS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdD0zO2EuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQ9NDthLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZD02NTUzNTthLmludGVycnVwdHNFbmFibGVkVmFsdWU9MDthLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkPSExO2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0PTY1Mjk1O2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPQowO2EuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0yO3JldHVybiBhfSgpLHc9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIDI1Nn07YS51cGRhdGVEaXZpZGVyUmVnaXN0ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmRpdmlkZXJSZWdpc3RlcjthLmRpdmlkZXJSZWdpc3Rlcj0wO2YoYS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlciwwKTthLnRpbWVyRW5hYmxlZCYmaWMoYiwwKSYmTGIoKX07YS51cGRhdGVUaW1lckNvdW50ZXI9ZnVuY3Rpb24oYil7aWYoYS50aW1lckVuYWJsZWQpe2lmKGEudGltZXJDb3VudGVyV2FzUmVzZXQpcmV0dXJuO2EudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheSYmCihhLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITEpfWEudGltZXJDb3VudGVyPWJ9O2EudXBkYXRlVGltZXJNb2R1bG89ZnVuY3Rpb24oYil7YS50aW1lck1vZHVsbz1iO2EudGltZXJFbmFibGVkJiZhLnRpbWVyQ291bnRlcldhc1Jlc2V0JiYoYS50aW1lckNvdW50ZXI9YixhLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExKX07YS51cGRhdGVUaW1lckNvbnRyb2w9ZnVuY3Rpb24oYil7dmFyIGM9YS50aW1lckVuYWJsZWQ7YS50aW1lckVuYWJsZWQ9ZygyLGIpO2ImPTM7aWYoIWMpe2M9TWIoYS50aW1lcklucHV0Q2xvY2spO3ZhciBkPU1iKGIpLGU9YS5kaXZpZGVyUmVnaXN0ZXI7KGEudGltZXJFbmFibGVkP2coYyxlKTpnKGMsZSkmJmcoZCxlKSkmJkxiKCl9YS50aW1lcklucHV0Q2xvY2s9Yn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRDeWNsZXM7ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kaXZpZGVyUmVnaXN0ZXI7CmVbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdPWEudGltZXJDb3VudGVyO2VbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheTtlWzEwMzcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnRpbWVyQ291bnRlcldhc1Jlc2V0O2VbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudGltZXJDb3VudGVyTWFzaztlWzEwNDIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnRpbWVyTW9kdWxvO2VbMTA0Nis1MCphLnNhdmVTdGF0ZVNsb3RdPWEudGltZXJFbmFibGVkO2VbMTA0Nys1MCphLnNhdmVTdGF0ZVNsb3RdPWEudGltZXJJbnB1dENsb2NrfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuY3VycmVudEN5Y2xlcz1lWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmRpdmlkZXJSZWdpc3Rlcj1lWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLnRpbWVyQ291bnRlcj1lWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XTthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9CmsoMTAzNis1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyV2FzUmVzZXQ9aygxMDM3KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS50aW1lckNvdW50ZXJNYXNrPWVbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EudGltZXJNb2R1bG89ZVsxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS50aW1lckVuYWJsZWQ9aygxMDQ2KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS50aW1lcklucHV0Q2xvY2s9ZVsxMDQ3KzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXI9NjUyODQ7YS5kaXZpZGVyUmVnaXN0ZXI9MDthLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyPTY1Mjg1O2EudGltZXJDb3VudGVyPTA7YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExO2EudGltZXJDb3VudGVyV2FzUmVzZXQ9ITE7YS50aW1lckNvdW50ZXJNYXNrPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvPTY1Mjg2O2EudGltZXJNb2R1bG89CjA7YS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbD02NTI4NzthLnRpbWVyRW5hYmxlZD0hMTthLnRpbWVySW5wdXRDbG9jaz0wO2Euc2F2ZVN0YXRlU2xvdD01O3JldHVybiBhfSgpLFo9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlVHJhbnNmZXJDb250cm9sPWZ1bmN0aW9uKGIpe2EuaXNTaGlmdENsb2NrSW50ZXJuYWw9ZygwLGIpO2EuaXNDbG9ja1NwZWVkRmFzdD1nKDEsYik7YS50cmFuc2ZlclN0YXJ0RmxhZz1nKDcsYik7cmV0dXJuITB9O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckRhdGE9NjUyODE7YS5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyQ29udHJvbD02NTI4MjthLm51bWJlck9mQml0c1RyYW5zZmVycmVkPTA7YS5pc1NoaWZ0Q2xvY2tJbnRlcm5hbD0hMTthLmlzQ2xvY2tTcGVlZEZhc3Q9ITE7YS50cmFuc2ZlclN0YXJ0RmxhZz0hMTtyZXR1cm4gYX0oKSxFPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe30KYS51cGRhdGVKb3lwYWQ9ZnVuY3Rpb24oYil7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9Yl4yNTU7YS5pc0RwYWRUeXBlPWcoNCxhLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCk7YS5pc0J1dHRvblR5cGU9Zyg1LGEuam95cGFkUmVnaXN0ZXJGbGlwcGVkKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmpveXBhZFJlZ2lzdGVyRmxpcHBlZDtlWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzRHBhZFR5cGU7ZVsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0J1dHRvblR5cGV9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc0RwYWRUeXBlPWsoMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNCdXR0b25UeXBlPWsoMTAyNis1MCphLnNhdmVTdGF0ZVNsb3QpfTthLnVwPSExO2EuZG93bj0hMTthLmxlZnQ9ITE7YS5yaWdodD0hMTthLmE9CiExO2EuYj0hMTthLnNlbGVjdD0hMTthLnN0YXJ0PSExO2EubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3Rlcj02NTI4MDthLmpveXBhZFJlZ2lzdGVyRmxpcHBlZD0wO2EuaXNEcGFkVHlwZT0hMTthLmlzQnV0dG9uVHlwZT0hMTthLnNhdmVTdGF0ZVNsb3Q9MztyZXR1cm4gYX0oKSxhYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5wcm9ncmFtQ291bnRlcj0tMTthLnJlYWRHYk1lbW9yeT0tMTthLndyaXRlR2JNZW1vcnk9LTE7YS5yZWFjaGVkQnJlYWtwb2ludD0hMTtyZXR1cm4gYX0oKSx1PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZUxjZFN0YXR1cz1mdW5jdGlvbihiKXt2YXIgYz12KGEubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO2I9YiYyNDh8YyY3fDEyODtmKGEubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsYil9O2EudXBkYXRlTGNkQ29udHJvbD1mdW5jdGlvbihiKXt2YXIgYz1hLmVuYWJsZWQ7YS5lbmFibGVkPWcoNyxiKTthLndpbmRvd1RpbGVNYXBEaXNwbGF5U2VsZWN0PQpnKDYsYik7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD1nKDUsYik7YS5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0PWcoNCxiKTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9ZygzLGIpO2EudGFsbFNwcml0ZVNpemU9ZygyLGIpO2Euc3ByaXRlRGlzcGxheUVuYWJsZT1nKDEsYik7YS5iZ0Rpc3BsYXlFbmFibGVkPWcoMCxiKTtjJiYhYS5lbmFibGVkJiZrYyghMCk7IWMmJmEuZW5hYmxlZCYma2MoITEpfTthLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzPTY1MzQ1O2EuY3VycmVudExjZE1vZGU9MDthLm1lbW9yeUxvY2F0aW9uQ29pbmNpZGVuY2VDb21wYXJlPTY1MzQ5O2EuY29pbmNpZGVuY2VDb21wYXJlPTA7YS5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2w9NjUzNDQ7YS5lbmFibGVkPSEwO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD0hMTthLmJnV2luZG93VGlsZURhdGFTZWxlY3Q9ITE7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PSExO2EudGFsbFNwcml0ZVNpemU9CiExO2Euc3ByaXRlRGlzcGxheUVuYWJsZT0hMTthLmJnRGlzcGxheUVuYWJsZWQ9ITE7cmV0dXJuIGF9KCkscj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYS5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORSgpfTthLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FPWZ1bmN0aW9uKCl7cmV0dXJuIDE1Mz09PWEuc2NhbmxpbmVSZWdpc3Rlcj80PDxiLkdCQ0RvdWJsZVNwZWVkOjQ1Njw8Yi5HQkNEb3VibGVTcGVlZH07YS5NSU5fQ1lDTEVTX1NQUklURVNfTENEX01PREU9ZnVuY3Rpb24oKXtyZXR1cm4gMzc2PDxiLkdCQ0RvdWJsZVNwZWVkfTthLk1JTl9DWUNMRVNfVFJBTlNGRVJfREFUQV9MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiAyNDk8PGIuR0JDRG91YmxlU3BlZWR9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zY2FubGluZUN5Y2xlQ291bnRlcjtlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5zY2FubGluZVJlZ2lzdGVyO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuc2Nyb2xsWDtlWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnNjcm9sbFk7ZVsxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53aW5kb3dYO2VbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2luZG93WTtlWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT11LmN1cnJlbnRMY2RNb2RlO2VbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdPXUuY29pbmNpZGVuY2VDb21wYXJlO2VbMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3RdPXUuZW5hYmxlZDtlWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XT11LndpbmRvd1RpbGVNYXBEaXNwbGF5U2VsZWN0O2VbMTAzNys1MCphLnNhdmVTdGF0ZVNsb3RdPXUud2luZG93RGlzcGxheUVuYWJsZWQ7ZVsxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09dS5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0O2VbMTAzOSs1MCphLnNhdmVTdGF0ZVNsb3RdPXUuYmdUaWxlTWFwRGlzcGxheVNlbGVjdDsKZVsxMDQwKzUwKmEuc2F2ZVN0YXRlU2xvdF09dS50YWxsU3ByaXRlU2l6ZTtlWzEwNDErNTAqYS5zYXZlU3RhdGVTbG90XT11LnNwcml0ZURpc3BsYXlFbmFibGU7ZVsxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdF09dS5iZ0Rpc3BsYXlFbmFibGVkfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zY2FubGluZVJlZ2lzdGVyPWVbMTAyOCs1MCphLnNjYW5saW5lUmVnaXN0ZXJdO2Euc2Nyb2xsWD1lWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLnNjcm9sbFk9ZVsxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53aW5kb3dYPWVbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2luZG93WT1lWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XTt1LmN1cnJlbnRMY2RNb2RlPWVbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO3UuY29pbmNpZGVuY2VDb21wYXJlPWVbMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3RdOwp1LmVuYWJsZWQ9aygxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7dS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD1rKDEwMzYrNTAqYS5zYXZlU3RhdGVTbG90KTt1LndpbmRvd0Rpc3BsYXlFbmFibGVkPWsoMTAzNys1MCphLnNhdmVTdGF0ZVNsb3QpO3UuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD1rKDEwMzgrNTAqYS5zYXZlU3RhdGVTbG90KTt1LmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9aygxMDM5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7dS50YWxsU3ByaXRlU2l6ZT1rKDEwNDArNTAqYS5zYXZlU3RhdGVTbG90KTt1LnNwcml0ZURpc3BsYXlFbmFibGU9aygxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7dS5iZ0Rpc3BsYXlFbmFibGVkPWsoMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QpfTthLmN1cnJlbnRDeWNsZXM9MDthLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXI9NjUzNDg7YS5zY2FubGluZVJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyPQo2NTM1MDthLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWD02NTM0NzthLnNjcm9sbFg9MDthLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWT02NTM0NjthLnNjcm9sbFk9MDthLm1lbW9yeUxvY2F0aW9uV2luZG93WD02NTM1NTthLndpbmRvd1g9MDthLm1lbW9yeUxvY2F0aW9uV2luZG93WT02NTM1NDthLndpbmRvd1k9MDthLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydD0zODkxMjthLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0PTM5OTM2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydD0zNDgxNjthLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydD0zMjc2ODthLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlPTY1MDI0O2EubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZT02NTM1MTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZT02NTM1MjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bz0KNjUzNTM7YS5zYXZlU3RhdGVTbG90PTE7cmV0dXJuIGF9KCksbj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRSb21CYW5rO2VbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudFJhbUJhbms7ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc1JhbUJhbmtpbmdFbmFibGVkO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNNQkMxUm9tTW9kZUVuYWJsZWQ7ZVsxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc1JvbU9ubHk7ZVsxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzE7ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzI7ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzM7ZVsxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzU7ZVsxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5ETUFDeWNsZXM7ZVsxMDM5Kwo1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNIYmxhbmtIZG1hQWN0aXZlO2VbMTA0MCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nO2VbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaGJsYW5rSGRtYVNvdXJjZTtlWzEwNDgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmhibGFua0hkbWFEZXN0aW5hdGlvbn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRSb21CYW5rPWVbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudFJhbUJhbms9ZVsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1JhbUJhbmtpbmdFbmFibGVkPWsoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9aygxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc1JvbU9ubHk9aygxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzE9aygxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzI9aygxMDMyKwo1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMzPWsoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkM1PWsoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuRE1BQ3ljbGVzPWVbMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNIYmxhbmtIZG1hQWN0aXZlPWsoMTAzOSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPWVbMTA0MCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaGJsYW5rSGRtYVNvdXJjZT1lWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmhibGFua0hkbWFEZXN0aW5hdGlvbj1lWzEwNDgrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5jYXJ0cmlkZ2VSb21Mb2NhdGlvbj0wO2Euc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uPTE2Mzg0O2EudmlkZW9SYW1Mb2NhdGlvbj0zMjc2ODthLmNhcnRyaWRnZVJhbUxvY2F0aW9uPTQwOTYwO2EuaW50ZXJuYWxSYW1CYW5rWmVyb0xvY2F0aW9uPTQ5MTUyO2EuaW50ZXJuYWxSYW1CYW5rT25lTG9jYXRpb249CjUzMjQ4O2EuZWNob1JhbUxvY2F0aW9uPTU3MzQ0O2Euc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uPTY1MDI0O2Euc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uRW5kPTY1MTgzO2EudW51c2FibGVNZW1vcnlMb2NhdGlvbj02NTE4NDthLnVudXNhYmxlTWVtb3J5RW5kTG9jYXRpb249NjUyNzk7YS5jdXJyZW50Um9tQmFuaz0wO2EuY3VycmVudFJhbUJhbms9MDthLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE7YS5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMDthLmlzUm9tT25seT0hMDthLmlzTUJDMT0hMTthLmlzTUJDMj0hMTthLmlzTUJDMz0hMTthLmlzTUJDNT0hMTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUhpZ2g9NjUzNjE7YS5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VMb3c9NjUzNjI7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkhpZ2g9NjUzNjM7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkxvdz02NTM2NDthLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXI9CjY1MzY1O2EuRE1BQ3ljbGVzPTA7YS5pc0hibGFua0hkbWFBY3RpdmU9ITE7YS5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc9MDthLmhibGFua0hkbWFTb3VyY2U9MDthLmhibGFua0hkbWFEZXN0aW5hdGlvbj0wO2EubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaz02NTM1OTthLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbms9NjUzOTI7YS5zYXZlU3RhdGVTbG90PTQ7cmV0dXJuIGF9KCksYj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5DTE9DS19TUEVFRD1mdW5jdGlvbigpe3JldHVybiA0MTk0MzA0PDxhLkdCQ0RvdWJsZVNwZWVkfTthLk1BWF9DWUNMRVNfUEVSX0ZSQU1FPWZ1bmN0aW9uKCl7cmV0dXJuIDcwMjI0PDxhLkdCQ0RvdWJsZVNwZWVkfTthLmVuYWJsZUhhbHQ9ZnVuY3Rpb24oKXttLm1hc3RlckludGVycnVwdFN3aXRjaD9hLmlzSGFsdE5vcm1hbD0hMDowPT09KG0uaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSZtLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYKMzEpP2EuaXNIYWx0Tm9KdW1wPSEwOmEuaXNIYWx0QnVnPSEwfTthLmV4aXRIYWx0QW5kU3RvcD1mdW5jdGlvbigpe2EuaXNIYWx0Tm9KdW1wPSExO2EuaXNIYWx0Tm9ybWFsPSExO2EuaXNIYWx0QnVnPSExO2EuaXNTdG9wcGVkPSExfTthLmlzSGFsdGVkPWZ1bmN0aW9uKCl7cmV0dXJuIGEuaXNIYWx0Tm9ybWFsfHxhLmlzSGFsdE5vSnVtcH07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQTtlWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQjtlWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQztlWzEwMjcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRDtlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRTtlWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVySDtlWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyTDtlWzEwMzErNTAqCmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckY7ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zdGFja1BvaW50ZXI7ZVsxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5wcm9ncmFtQ291bnRlcjtlWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRDeWNsZXM7ZVsxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0hhbHROb3JtYWw7ZVsxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0hhbHROb0p1bXA7ZVsxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0hhbHRCdWc7ZVsxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc1N0b3BwZWQ7ZVsxMDQ1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5Cb290Uk9NRW5hYmxlZDtlWzEwNDYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLkdCQ0VuYWJsZWQ7ZVsxMDQ3KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5HQkNEb3VibGVTcGVlZH07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnJlZ2lzdGVyQT1lWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS5yZWdpc3RlckI9ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckM9ZVsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckQ9ZVsxMDI3KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckU9ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckg9ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckw9ZVsxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckY9ZVsxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zdGFja1BvaW50ZXI9ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5wcm9ncmFtQ291bnRlcj1lWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRDeWNsZXM9ZVsxMDM2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc0hhbHROb3JtYWw9aygxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc0hhbHROb0p1bXA9aygxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc0hhbHRCdWc9aygxMDQzKwo1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNTdG9wcGVkPWsoMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuQm9vdFJPTUVuYWJsZWQ9aygxMDQ1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5HQkNFbmFibGVkPWsoMTA0Nis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuR0JDRG91YmxlU3BlZWQ9aygxMDQ3KzUwKmEuc2F2ZVN0YXRlU2xvdCl9O2EubWVtb3J5TG9jYXRpb25Cb290Uk9NU3dpdGNoPTY1MzYwO2EuQm9vdFJPTUVuYWJsZWQ9ITE7YS5HQkNFbmFibGVkPSExO2EubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaD02NTM1NzthLkdCQ0RvdWJsZVNwZWVkPSExO2EucmVnaXN0ZXJBPTA7YS5yZWdpc3RlckI9MDthLnJlZ2lzdGVyQz0wO2EucmVnaXN0ZXJEPTA7YS5yZWdpc3RlckU9MDthLnJlZ2lzdGVySD0wO2EucmVnaXN0ZXJMPTA7YS5yZWdpc3RlckY9MDthLnN0YWNrUG9pbnRlcj0wO2EucHJvZ3JhbUNvdW50ZXI9MDthLmN1cnJlbnRDeWNsZXM9MDthLmlzSGFsdE5vcm1hbD0hMTthLmlzSGFsdE5vSnVtcD0KITE7YS5pc0hhbHRCdWc9ITE7YS5pc1N0b3BwZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTA7cmV0dXJuIGF9KCksZGE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O2EuY3ljbGVTZXRzPTA7YS5jeWNsZXM9MDtyZXR1cm4gYX0oKSxWPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnN0ZXBzUGVyU3RlcFNldD0yRTk7YS5zdGVwU2V0cz0wO2Euc3RlcHM9MDthLlJFU1BPTlNFX0NPTkRJVElPTl9FUlJPUj0tMTthLlJFU1BPTlNFX0NPTkRJVElPTl9GUkFNRT0wO2EuUkVTUE9OU0VfQ09ORElUSU9OX0FVRElPPTE7YS5SRVNQT05TRV9DT05ESVRJT05fQlJFQUtQT0lOVD0yO3JldHVybiBhfSgpO21iLnNpemUoKTxaYiYmbWIuZ3JvdyhaYi1tYi5zaXplKCkpO3ZhciBrYj0hMSxYYz1PYmplY3QuZnJlZXplKHttZW1vcnk6bWIsY29uZmlnOmZ1bmN0aW9uKGEsYyxlLGcsayxsLHEsdSx4LEEpe1EuZW5hYmxlQm9vdFJvbT0wPGE7US51c2VHYmNXaGVuQXZhaWxhYmxlPQowPGM7US5hdWRpb0JhdGNoUHJvY2Vzc2luZz0wPGU7US5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0wPGc7US50aW1lcnNCYXRjaFByb2Nlc3Npbmc9MDxrO1EuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmc9MDxsO1EuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0wPHE7US50aWxlUmVuZGVyaW5nPTA8dTtRLnRpbGVDYWNoaW5nPTA8eDtRLmVuYWJsZUF1ZGlvRGVidWdnaW5nPTA8QTthPXYoMzIzKTtiLkdCQ0VuYWJsZWQ9MTkyPT09YXx8US51c2VHYmNXaGVuQXZhaWxhYmxlJiYxMjg9PT1hPyEwOiExO2tiPSExO2RhLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTtkYS5jeWNsZVNldHM9MDtkYS5jeWNsZXM9MDtWLnN0ZXBzUGVyU3RlcFNldD0yRTk7Vi5zdGVwU2V0cz0wO1Yuc3RlcHM9MDtiLkJvb3RST01FbmFibGVkPVEuZW5hYmxlQm9vdFJvbT8hMDohMTtiLkdCQ0RvdWJsZVNwZWVkPSExO2IucmVnaXN0ZXJBPTA7Yi5yZWdpc3RlckI9MDtiLnJlZ2lzdGVyQz0wO2IucmVnaXN0ZXJEPQowO2IucmVnaXN0ZXJFPTA7Yi5yZWdpc3Rlckg9MDtiLnJlZ2lzdGVyTD0wO2IucmVnaXN0ZXJGPTA7Yi5zdGFja1BvaW50ZXI9MDtiLnByb2dyYW1Db3VudGVyPTA7Yi5jdXJyZW50Q3ljbGVzPTA7Yi5pc0hhbHROb3JtYWw9ITE7Yi5pc0hhbHROb0p1bXA9ITE7Yi5pc0hhbHRCdWc9ITE7Yi5pc1N0b3BwZWQ9ITE7Yi5Cb290Uk9NRW5hYmxlZHx8KGIuR0JDRW5hYmxlZD8oYi5yZWdpc3RlckE9MTcsYi5yZWdpc3RlckY9MTI4LGIucmVnaXN0ZXJCPTAsYi5yZWdpc3RlckM9MCxiLnJlZ2lzdGVyRD0yNTUsYi5yZWdpc3RlckU9ODYsYi5yZWdpc3Rlckg9MCxiLnJlZ2lzdGVyTD0xMyk6KGIucmVnaXN0ZXJBPTEsYi5yZWdpc3RlckY9MTc2LGIucmVnaXN0ZXJCPTAsYi5yZWdpc3RlckM9MTksYi5yZWdpc3RlckQ9MCxiLnJlZ2lzdGVyRT0yMTYsYi5yZWdpc3Rlckg9MSxiLnJlZ2lzdGVyTD03NyksYi5wcm9ncmFtQ291bnRlcj0yNTYsYi5zdGFja1BvaW50ZXI9NjU1MzQpO24uaXNSYW1CYW5raW5nRW5hYmxlZD0KITE7bi5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMDthPXYoMzI3KTtuLmlzUm9tT25seT0wPT09YTtuLmlzTUJDMT0xPD1hJiYzPj1hO24uaXNNQkMyPTU8PWEmJjY+PWE7bi5pc01CQzM9MTU8PWEmJjE5Pj1hO24uaXNNQkM1PTI1PD1hJiYzMD49YTtuLmN1cnJlbnRSb21CYW5rPTE7bi5jdXJyZW50UmFtQmFuaz0wO2Yobi5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rLDApO2Yobi5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rLDEpO2YoNjUzNjEsMjU1KTtmKDY1MzYyLDI1NSk7Zig2NTM2MywyNTUpO2YoNjUzNjQsMjU1KTtmKDY1MzY1LDI1NSk7ci5jdXJyZW50Q3ljbGVzPTA7ci5zY2FubGluZUN5Y2xlQ291bnRlcj0wO3Iuc2NhbmxpbmVSZWdpc3Rlcj0wO3Iuc2Nyb2xsWD0wO3Iuc2Nyb2xsWT0wO3Iud2luZG93WD0wO3Iud2luZG93WT0wO3Iuc2NhbmxpbmVSZWdpc3Rlcj0xNDQ7Yi5HQkNFbmFibGVkPyhmKDY1MzQ1LDEyOSksZig2NTM0OCwxNDQpLGYoNjUzNTEsMjUyKSk6KGYoNjUzNDUsCjEzMyksZig2NTM1MCwyNTUpLGYoNjUzNTEsMjUyKSxmKDY1MzUyLDI1NSksZig2NTM1MywyNTUpKTtyLnNjYW5saW5lUmVnaXN0ZXI9MTQ0O2YoNjUzNDQsMTQ1KTtmKDY1MzU5LDApO2YoNjUzOTIsMSk7Yi5Cb290Uk9NRW5hYmxlZCYmKGIuR0JDRW5hYmxlZD8oci5zY2FubGluZVJlZ2lzdGVyPTAsZig2NTM0NCwwKSxmKDY1MzQ1LDEyOCksZig2NTM0OCwwKSk6KHIuc2NhbmxpbmVSZWdpc3Rlcj0wLGYoNjUzNDQsMCksZig2NTM0NSwxMzIpKSk7YmMoMCk7aWYoIWIuR0JDRW5hYmxlZCYmKCFiLkJvb3RST01FbmFibGVkfHxiLkdCQ0VuYWJsZWQpKXthPTA7Zm9yKGM9MzA4OzMyMz49YztjKyspYSs9dihjKTtzd2l0Y2goYSYyNTUpe2Nhc2UgMTM2OmQuYmdXaGl0ZT12YS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9dmEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXZhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXZhLmJnQmxhY2s7ZC5vYmowV2hpdGU9dmEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT0KdmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT12YS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9dmEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXZhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9dmEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT12YS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9dmEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgOTc6ZC5iZ1doaXRlPXdhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT13YS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9d2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9d2EuYmdCbGFjaztkLm9iajBXaGl0ZT13YS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PXdhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9d2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPXdhLm9iajBCbGFjaztkLm9iajFXaGl0ZT13YS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PXdhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9d2Eub2JqMURhcmtHcmV5OwpkLm9iajFCbGFjaz13YS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAyMDpkLmJnV2hpdGU9eGEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXhhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT14YS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz14YS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXhhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9eGEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT14YS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9eGEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXhhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9eGEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT14YS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9eGEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgNzA6ZC5iZ1doaXRlPXlhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT15YS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9eWEuYmdEYXJrR3JleTtkLmJnQmxhY2s9eWEuYmdCbGFjaztkLm9iajBXaGl0ZT15YS5vYmowV2hpdGU7CmQub2JqMExpZ2h0R3JleT15YS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXlhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz15YS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9eWEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT15YS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXlhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz15YS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA4OTpjYXNlIDE5ODpkLmJnV2hpdGU9emEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXphLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT16YS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz16YS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXphLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9emEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT16YS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9emEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXphLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9emEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT0KemEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPXphLm9iajFCbGFjazticmVhaztjYXNlIDEzNDpjYXNlIDE2ODpkLmJnV2hpdGU9QWEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PUFhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1BYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1BYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPUFhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9QWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1BYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9QWEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPUFhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9QWEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1BYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9QWEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMTkxOmNhc2UgMjA2OmNhc2UgMjA5OmNhc2UgMjQwOmQuYmdXaGl0ZT1CYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9QmEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PUJhLmJnRGFya0dyZXk7CmQuYmdCbGFjaz1CYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPUJhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9QmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1CYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9QmEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPUJhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9QmEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1CYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9QmEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMzk6Y2FzZSA3MzpjYXNlIDkyOmNhc2UgMTc5OmQuYmdXaGl0ZT1DYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9Q2EuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PUNhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPUNhLmJnQmxhY2s7ZC5vYmowV2hpdGU9Q2Eub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1DYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PUNhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1DYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9CkNhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9Q2Eub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1DYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9Q2Eub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMjAxOmQuYmdXaGl0ZT1EYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9RGEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PURhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPURhLmJnQmxhY2s7ZC5vYmowV2hpdGU9RGEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1EYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PURhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1EYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9RGEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1EYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PURhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1EYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxMTI6ZC5iZ1doaXRlPUVhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1FYS5iZ0xpZ2h0R3JleTsKZC5iZ0RhcmtHcmV5PUVhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPUVhLmJnQmxhY2s7ZC5vYmowV2hpdGU9RWEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1FYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PUVhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1FYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9RWEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1FYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PUVhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1FYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA3MDpkLmJnV2hpdGU9RmEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PUZhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1GYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1GYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPUZhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9RmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1GYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9RmEub2JqMEJsYWNrOwpkLm9iajFXaGl0ZT1GYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PUZhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9RmEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPUZhLm9iajFCbGFjazticmVhaztjYXNlIDIxMTpkLmJnV2hpdGU9R2EuYmdXaGl0ZSxkLmJnTGlnaHRHcmV5PUdhLmJnTGlnaHRHcmV5LGQuYmdEYXJrR3JleT1HYS5iZ0RhcmtHcmV5LGQuYmdCbGFjaz1HYS5iZ0JsYWNrLGQub2JqMFdoaXRlPUdhLm9iajBXaGl0ZSxkLm9iajBMaWdodEdyZXk9R2Eub2JqMExpZ2h0R3JleSxkLm9iajBEYXJrR3JleT1HYS5vYmowRGFya0dyZXksZC5vYmowQmxhY2s9R2Eub2JqMEJsYWNrLGQub2JqMVdoaXRlPUdhLm9iajFXaGl0ZSxkLm9iajFMaWdodEdyZXk9R2Eub2JqMUxpZ2h0R3JleSxkLm9iajFEYXJrR3JleT1HYS5vYmoxRGFya0dyZXksZC5vYmoxQmxhY2s9R2Eub2JqMUJsYWNrfX1iLkdCQ0VuYWJsZWQ/KGYoNjUzODQsMTkyKSxmKDY1Mzg1LDI1NSksZig2NTM4NiwKMTkzKSxmKDY1Mzg3LDEzKSk6KGYoNjUzODQsMjU1KSxmKDY1Mzg1LDI1NSksZig2NTM4NiwyNTUpLGYoNjUzODcsMjU1KSk7Yi5Cb290Uk9NRW5hYmxlZCYmYi5HQkNFbmFibGVkJiYoZig2NTM4NSwzMiksZig2NTM4NywxMzgpKTtoLmN1cnJlbnRDeWNsZXM9MDtoLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9MDtoLk5SNTBSaWdodE1peGVyVm9sdW1lPTA7aC5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7aC5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7aC5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7aC5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7aC5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2guTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDtoLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7aC5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PQohMDtoLk5SNTJJc1NvdW5kRW5hYmxlZD0hMDtoLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9MDtoLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9MDtoLmZyYW1lU2VxdWVuY2VyPTA7aC5hdWRpb1F1ZXVlSW5kZXg9MDt5LmluaXRpYWxpemUoKTtELmluaXRpYWxpemUoKTt0LmluaXRpYWxpemUoKTtGLmluaXRpYWxpemUoKTtmKGgubWVtb3J5TG9jYXRpb25OUjUwLDExOSk7aC51cGRhdGVOUjUwKDExOSk7ZihoLm1lbW9yeUxvY2F0aW9uTlI1MSwyNDMpO2gudXBkYXRlTlI1MSgyNDMpO2YoaC5tZW1vcnlMb2NhdGlvbk5SNTIsMjQxKTtoLnVwZGF0ZU5SNTIoMjQxKTtiLkJvb3RST01FbmFibGVkJiYoZihoLm1lbW9yeUxvY2F0aW9uTlI1MCwwKSxoLnVwZGF0ZU5SNTAoMCksZihoLm1lbW9yeUxvY2F0aW9uTlI1MSwwKSxoLnVwZGF0ZU5SNTEoMCksZihoLm1lbW9yeUxvY2F0aW9uTlI1MiwxMTIpLGgudXBkYXRlTlI1MigxMTIpKTtwLmNoYW5uZWwxU2FtcGxlPTE1O3AuY2hhbm5lbDJTYW1wbGU9CjE1O3AuY2hhbm5lbDNTYW1wbGU9MTU7cC5jaGFubmVsNFNhbXBsZT0xNTtwLmNoYW5uZWwxRGFjRW5hYmxlZD0hMTtwLmNoYW5uZWwyRGFjRW5hYmxlZD0hMTtwLmNoYW5uZWwzRGFjRW5hYmxlZD0hMTtwLmNoYW5uZWw0RGFjRW5hYmxlZD0hMTtwLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNztwLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7cC5taXhlclZvbHVtZUNoYW5nZWQ9ITA7cC5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO3AubmVlZFRvUmVtaXhTYW1wbGVzPSExO20udXBkYXRlSW50ZXJydXB0RW5hYmxlZCgwKTtmKG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkLG0uaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSk7bS51cGRhdGVJbnRlcnJ1cHRSZXF1ZXN0ZWQoMjI1KTtmKG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LG0uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlKTt3LmN1cnJlbnRDeWNsZXM9MDt3LmRpdmlkZXJSZWdpc3Rlcj0KMDt3LnRpbWVyQ291bnRlcj0wO3cudGltZXJNb2R1bG89MDt3LnRpbWVyRW5hYmxlZD0hMTt3LnRpbWVySW5wdXRDbG9jaz0wO3cudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMTt3LnRpbWVyQ291bnRlcldhc1Jlc2V0PSExO2IuR0JDRW5hYmxlZD8oZig2NTI4NCwzMCksdy5kaXZpZGVyUmVnaXN0ZXI9Nzg0MCk6KGYoNjUyODQsMTcxKSx3LmRpdmlkZXJSZWdpc3Rlcj00Mzk4MCk7Zig2NTI4NywyNDgpO3cudGltZXJJbnB1dENsb2NrPTI0ODtiLkJvb3RST01FbmFibGVkJiYhYi5HQkNFbmFibGVkJiYoZig2NTI4NCwwKSx3LmRpdmlkZXJSZWdpc3Rlcj00KTtaLmN1cnJlbnRDeWNsZXM9MDtaLm51bWJlck9mQml0c1RyYW5zZmVycmVkPTA7Yi5HQkNFbmFibGVkPyhmKDY1MjgyLDEyNCksWi51cGRhdGVUcmFuc2ZlckNvbnRyb2woMTI0KSk6KGYoNjUyODIsMTI2KSxaLnVwZGF0ZVRyYW5zZmVyQ29udHJvbCgxMjYpKTtiLkdCQ0VuYWJsZWQ/KGYoNjUzOTIsMjQ4KSxmKDY1MzU5LAoyNTQpLGYoNjUzNTcsMTI2KSxmKDY1MjgwLDIwNyksZig2NTI5NSwyMjUpLGYoNjUzODgsMjU0KSxmKDY1Mzk3LDE0MykpOihmKDY1MzkyLDI1NSksZig2NTM1OSwyNTUpLGYoNjUzNTcsMjU1KSxmKDY1MjgwLDIwNyksZig2NTI5NSwyMjUpKX0saGFzQ29yZVN0YXJ0ZWQ6ZnVuY3Rpb24oKXtyZXR1cm4ga2J9LHNhdmVTdGF0ZTpmdW5jdGlvbigpe2Iuc2F2ZVN0YXRlKCk7ci5zYXZlU3RhdGUoKTttLnNhdmVTdGF0ZSgpO0Uuc2F2ZVN0YXRlKCk7bi5zYXZlU3RhdGUoKTt3LnNhdmVTdGF0ZSgpO2guc2F2ZVN0YXRlKCk7eS5zYXZlU3RhdGUoKTtELnNhdmVTdGF0ZSgpO3Quc2F2ZVN0YXRlKCk7Ri5zYXZlU3RhdGUoKTtrYj0hMX0sbG9hZFN0YXRlOmZ1bmN0aW9uKCl7Yi5sb2FkU3RhdGUoKTtyLmxvYWRTdGF0ZSgpO20ubG9hZFN0YXRlKCk7RS5sb2FkU3RhdGUoKTtuLmxvYWRTdGF0ZSgpO3cubG9hZFN0YXRlKCk7aC5sb2FkU3RhdGUoKTt5LmxvYWRTdGF0ZSgpO0QubG9hZFN0YXRlKCk7CnQubG9hZFN0YXRlKCk7Ri5sb2FkU3RhdGUoKTtrYj0hMTtkYS5jeWNsZXNQZXJDeWNsZVNldD0yRTk7ZGEuY3ljbGVTZXRzPTA7ZGEuY3ljbGVzPTA7Vi5zdGVwc1BlclN0ZXBTZXQ9MkU5O1Yuc3RlcFNldHM9MDtWLnN0ZXBzPTB9LGlzR0JDOmZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRW5hYmxlZH0sZ2V0U3RlcHNQZXJTdGVwU2V0OmZ1bmN0aW9uKCl7cmV0dXJuIFYuc3RlcHNQZXJTdGVwU2V0fSxnZXRTdGVwU2V0czpmdW5jdGlvbigpe3JldHVybiBWLnN0ZXBTZXRzfSxnZXRTdGVwczpmdW5jdGlvbigpe3JldHVybiBWLnN0ZXBzfSxleGVjdXRlTXVsdGlwbGVGcmFtZXM6ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPTAsZD0wO2Q8YSYmMDw9YjspYj1wYygpLGQrPTE7cmV0dXJuIDA+Yj9iOjB9LGV4ZWN1dGVGcmFtZTpwYyxleGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvOmZ1bmN0aW9uKGEpe3ZvaWQgMD09PWEmJihhPTApO3JldHVybiBVYighMCxhKX0sZXhlY3V0ZVVudGlsQ29uZGl0aW9uOlViLApleGVjdXRlU3RlcDpxYyxnZXRDeWNsZXNQZXJDeWNsZVNldDpmdW5jdGlvbigpe3JldHVybiBkYS5jeWNsZXNQZXJDeWNsZVNldH0sZ2V0Q3ljbGVTZXRzOmZ1bmN0aW9uKCl7cmV0dXJuIGRhLmN5Y2xlU2V0c30sZ2V0Q3ljbGVzOmZ1bmN0aW9uKCl7cmV0dXJuIGRhLmN5Y2xlc30sc2V0Sm95cGFkU3RhdGU6ZnVuY3Rpb24oYSxiLGQsZSxmLGcsayxoKXswPGE/VGEoMCk6SWEoMCwhMSk7MDxiP1RhKDEpOklhKDEsITEpOzA8ZD9UYSgyKTpJYSgyLCExKTswPGU/VGEoMyk6SWEoMywhMSk7MDxmP1RhKDQpOklhKDQsITEpOzA8Zz9UYSg1KTpJYSg1LCExKTswPGs/VGEoNik6SWEoNiwhMSk7MDxoP1RhKDcpOklhKDcsITEpfSxnZXROdW1iZXJPZlNhbXBsZXNJbkF1ZGlvQnVmZmVyOmZjLGNsZWFyQXVkaW9CdWZmZXI6Z2Msc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZTpiYyxXQVNNQk9ZX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfTUVNT1JZX1NJWkU6d2MsV0FTTUJPWV9XQVNNX1BBR0VTOlpiLApBU1NFTUJMWVNDUklQVF9NRU1PUllfTE9DQVRJT046MCxBU1NFTUJMWVNDUklQVF9NRU1PUllfU0laRToxMDI0LFdBU01CT1lfU1RBVEVfTE9DQVRJT046MTAyNCxXQVNNQk9ZX1NUQVRFX1NJWkU6MTAyNCxHQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjoyMDQ4LEdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6VWMsVklERU9fUkFNX0xPQ0FUSU9OOjIwNDgsVklERU9fUkFNX1NJWkU6MTYzODQsV09SS19SQU1fTE9DQVRJT046MTg0MzIsV09SS19SQU1fU0laRTozMjc2OCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjo1MTIwMCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjE2Mzg0LEdSQVBISUNTX09VVFBVVF9MT0NBVElPTjpWYyxHUkFQSElDU19PVVRQVVRfU0laRTpXYyxHQkNfUEFMRVRURV9MT0NBVElPTjpZYSxHQkNfUEFMRVRURV9TSVpFOjEyOCxCR19QUklPUklUWV9NQVBfTE9DQVRJT046WmEsQkdfUFJJT1JJVFlfTUFQX1NJWkU6MjM1NTIsCkZSQU1FX0xPQ0FUSU9OOmNiLEZSQU1FX1NJWkU6OTMxODQsQkFDS0dST1VORF9NQVBfTE9DQVRJT046emIsQkFDS0dST1VORF9NQVBfU0laRToxOTY2MDgsVElMRV9EQVRBX0xPQ0FUSU9OOlhiLFRJTEVfREFUQV9TSVpFOjE0NzQ1NixPQU1fVElMRVNfTE9DQVRJT046QWIsT0FNX1RJTEVTX1NJWkU6MTUzNjAsQVVESU9fQlVGRkVSX0xPQ0FUSU9OOnViLEFVRElPX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OOkdiLENIQU5ORUxfMV9CVUZGRVJfU0laRToxMzEwNzIsQ0hBTk5FTF8yX0JVRkZFUl9MT0NBVElPTjpIYixDSEFOTkVMXzJfQlVGRkVSX1NJWkU6MTMxMDcyLENIQU5ORUxfM19CVUZGRVJfTE9DQVRJT046SWIsQ0hBTk5FTF8zX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzRfQlVGRkVSX0xPQ0FUSU9OOkpiLENIQU5ORUxfNF9CVUZGRVJfU0laRToxMzEwNzIsQ0FSVFJJREdFX1JBTV9MT0NBVElPTjpSYixDQVJUUklER0VfUkFNX1NJWkU6MTMxMDcyLApCT09UX1JPTV9MT0NBVElPTjp3YixCT09UX1JPTV9TSVpFOjI1NjAsQ0FSVFJJREdFX1JPTV9MT0NBVElPTjp4YixDQVJUUklER0VfUk9NX1NJWkU6ODI1ODU2MCxERUJVR19HQU1FQk9ZX01FTU9SWV9MT0NBVElPTjpZYixERUJVR19HQU1FQk9ZX01FTU9SWV9TSVpFOjY1NTM1LGdldFdhc21Cb3lPZmZzZXRGcm9tR2FtZUJveU9mZnNldDpRYixzZXRQcm9ncmFtQ291bnRlckJyZWFrcG9pbnQ6ZnVuY3Rpb24oYSl7YWEucHJvZ3JhbUNvdW50ZXI9YX0scmVzZXRQcm9ncmFtQ291bnRlckJyZWFrcG9pbnQ6ZnVuY3Rpb24oKXthYS5wcm9ncmFtQ291bnRlcj0tMX0sc2V0UmVhZEdiTWVtb3J5QnJlYWtwb2ludDpmdW5jdGlvbihhKXthYS5yZWFkR2JNZW1vcnk9YX0scmVzZXRSZWFkR2JNZW1vcnlCcmVha3BvaW50OmZ1bmN0aW9uKCl7YWEucmVhZEdiTWVtb3J5PS0xfSxzZXRXcml0ZUdiTWVtb3J5QnJlYWtwb2ludDpmdW5jdGlvbihhKXthYS53cml0ZUdiTWVtb3J5PWF9LHJlc2V0V3JpdGVHYk1lbW9yeUJyZWFrcG9pbnQ6ZnVuY3Rpb24oKXthYS53cml0ZUdiTWVtb3J5PQotMX0sZ2V0UmVnaXN0ZXJBOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJBfSxnZXRSZWdpc3RlckI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckJ9LGdldFJlZ2lzdGVyQzpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQ30sZ2V0UmVnaXN0ZXJEOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJEfSxnZXRSZWdpc3RlckU6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckV9LGdldFJlZ2lzdGVySDpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVySH0sZ2V0UmVnaXN0ZXJMOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJMfSxnZXRSZWdpc3RlckY6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckZ9LGdldFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXJ9LGdldFN0YWNrUG9pbnRlcjpmdW5jdGlvbigpe3JldHVybiBiLnN0YWNrUG9pbnRlcn0sZ2V0T3Bjb2RlQXRQcm9ncmFtQ291bnRlcjpmdW5jdGlvbigpe3JldHVybiB2KGIucHJvZ3JhbUNvdW50ZXIpfSwKZ2V0TFk6ZnVuY3Rpb24oKXtyZXR1cm4gci5zY2FubGluZVJlZ2lzdGVyfSxnZXRTY3JvbGxYOmZ1bmN0aW9uKCl7cmV0dXJuIHIuc2Nyb2xsWH0sZ2V0U2Nyb2xsWTpmdW5jdGlvbigpe3JldHVybiByLnNjcm9sbFl9LGdldFdpbmRvd1g6ZnVuY3Rpb24oKXtyZXR1cm4gci53aW5kb3dYfSxnZXRXaW5kb3dZOmZ1bmN0aW9uKCl7cmV0dXJuIHIud2luZG93WX0sZHJhd0JhY2tncm91bmRNYXBUb1dhc21NZW1vcnk6ZnVuY3Rpb24oYSl7dmFyIGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0O3UuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdCYmKGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQpO3ZhciBkPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O3UuYmdUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7Zm9yKHZhciBmPTA7MjU2PmY7ZisrKWZvcih2YXIgaz0KMDsyNTY+aztrKyspe3ZhciBoPWYsbT1rLG49ZCszMiooaD4+MykrKG0+PjMpLGw9WChuLDApO2w9Z2IoYyxsKTt2YXIgcD1oJTg7aD1tJTg7aD03LWg7bT0wO2IuR0JDRW5hYmxlZCYmMDxhJiYobT1YKG4sMSkpO2coNixtKSYmKHA9Ny1wKTt2YXIgcT0wO2coMyxtKSYmKHE9MSk7bj1YKGwrMipwLHEpO2w9WChsKzIqcCsxLHEpO3A9MDtnKGgsbCkmJihwKz0xLHA8PD0xKTtnKGgsbikmJihwKz0xKTtsPTMqKDI1NipmK2spO2IuR0JDRW5hYmxlZCYmMDxhPyhuPXJiKG0mNyxwLCExKSxtPXVhKDAsbiksaD11YSgxLG4pLG49dWEoMixuKSxsPXpiK2wsZVtsXT1tLGVbbCsxXT1oLGVbbCsyXT1uKToobT1xYihwLHIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksbD16YitsLGVbbCswXT0obSYxNjcxMTY4MCk+PjE2LGVbbCsxXT0obSY2NTI4MCk+PjgsZVtsKzJdPW0mMjU1KX19LGRyYXdUaWxlRGF0YVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzIzPmE7YSsrKWZvcih2YXIgYz0KMDszMT5jO2MrKyl7dmFyIGQ9MDsxNTxjJiYoZD0xKTt2YXIgZT1hOzE1PGEmJihlLT0xNSk7ZTw8PTQ7ZT0xNTxjP2UrKGMtMTUpOmUrYzt2YXIgZj1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydDsxNTxhJiYoZj1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQpO2Zvcih2YXIgaD1yLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUsaz0tMSxtPS0xLGw9MDs4Pmw7bCsrKWZvcih2YXIgbj0wOzU+bjtuKyspe3ZhciBwPTQqKDgqbitsKSxxPXYoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStwKzIpO2U9PT1xJiYocD12KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrcCszKSxxPTAsYi5HQkNFbmFibGVkJiZnKDMscCkmJihxPTEpLHE9PT1kJiYobT1wLGw9OCxuPTUsaD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSxnKDQsbSkmJihoPXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKSkpfWlmKGIuR0JDRW5hYmxlZCYmCjA+bSl7bD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDt1LmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJihsPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO249LTE7Zm9yKHA9MDszMj5wO3ArKylmb3IocT0wOzMyPnE7cSsrKXt2YXIgdD1sKzMyKnErcCx3PVgodCwwKTtlPT09dyYmKG49dCxxPXA9MzIpfTA8PW4mJihrPVgobiwxKSl9Zm9yKGw9MDs4Pmw7bCsrKUViKGUsZixkLDAsNyxsLDgqYyw4KmErbCwyNDgsWGIsITEsaCxrLG0pfX0sZHJhd09hbVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzg+YTthKyspZm9yKHZhciBjPTA7NT5jO2MrKyl7dmFyIGQ9NCooOCpjK2EpO3Yoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKTt2KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCsxKTt2YXIgZT12KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCsyKSwKZj0xO3UudGFsbFNwcml0ZVNpemUmJigxPT09ZSUyJiYtLWUsZis9MSk7ZD12KHIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCszKTt2YXIgaD0wO2IuR0JDRW5hYmxlZCYmZygzLGQpJiYoaD0xKTt2YXIgbD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZTtnKDQsZCkmJihsPXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKTtmb3IodmFyIGs9MDtrPGY7aysrKWZvcih2YXIgbT0wOzg+bTttKyspRWIoZStrLHIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0LGgsMCw3LG0sOCphLDE2KmMrbSs4KmssNjQsQWIsITEsbCwtMSxkKX19LGdldERJVjpmdW5jdGlvbigpe3JldHVybiB3LmRpdmlkZXJSZWdpc3Rlcn0sZ2V0VElNQTpmdW5jdGlvbigpe3JldHVybiB3LnRpbWVyQ291bnRlcn0sZ2V0VE1BOmZ1bmN0aW9uKCl7cmV0dXJuIHcudGltZXJNb2R1bG99LGdldFRBQzpmdW5jdGlvbigpe3ZhciBhPXcudGltZXJJbnB1dENsb2NrOwp3LnRpbWVyRW5hYmxlZCYmKGF8PTQpO3JldHVybiBhfSx1cGRhdGVEZWJ1Z0dCTWVtb3J5OmZ1bmN0aW9uKCl7Zm9yKHZhciBhPTA7NjU1MzU+YTthKyspe3ZhciBiPU5iKGEpO2VbWWIrYV09Yn1hYS5yZWFjaGVkQnJlYWtwb2ludD0hMX19KTtsZXQgWWM9YXN5bmMoKT0+KHtpbnN0YW5jZTp7ZXhwb3J0czpYY30sYnl0ZU1lbW9yeTptYi53YXNtQnl0ZU1lbW9yeSx0eXBlOiJUeXBlU2NyaXB0In0pLGxiLHliLHRjLHE7cT17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOjAsV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRTowLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOjAsV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRTowLFdBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OOjAscGF1c2VkOiEwLHVwZGF0ZUlkOnZvaWQgMCx0aW1lU3RhbXBzVW50aWxSZWFkeTowLGZwc1RpbWVTdGFtcHM6W10sc3BlZWQ6MCxmcmFtZVNraXBDb3VudGVyOjAsCmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjphPT57bGV0IGI9ZWIoYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIEIuQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhxLmdyYXBoaWNzV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sZmIoeGMuYmluZCh2b2lkIDAscSkscS5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8ocS5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxmYihBYy5iaW5kKHZvaWQgMCxxKSxxLm1lbW9yeVdvcmtlclBvcnQpKToiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KHEuY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLGZiKHpjLmJpbmQodm9pZCAwLHEpLHEuY29udHJvbGxlcldvcmtlclBvcnQpKToiQVVESU8iPT09Yi5tZXNzYWdlLndvcmtlcklkJiYocS5hdWRpb1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLApmYih5Yy5iaW5kKHZvaWQgMCxxKSxxLmF1ZGlvV29ya2VyUG9ydCkpO2VhKE8odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBCLklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9PntsZXQgYTthPWF3YWl0IFljKCk7cS53YXNtSW5zdGFuY2U9YS5pbnN0YW5jZTtxLndhc21CeXRlTWVtb3J5PWEuYnl0ZU1lbW9yeTtlYShPKHt0eXBlOmEudHlwZX0sYi5tZXNzYWdlSWQpKX0pKCk7YnJlYWs7Y2FzZSBCLkNPTkZJRzpxLndhc21JbnN0YW5jZS5leHBvcnRzLmNvbmZpZy5hcHBseShxLGIubWVzc2FnZS5jb25maWcpO3Eub3B0aW9ucz1iLm1lc3NhZ2Uub3B0aW9ucztlYShPKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQi5SRVNFVF9BVURJT19RVUVVRTpxLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTtlYShPKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQi5QTEFZOmlmKCFxLnBhdXNlZHx8IXEud2FzbUluc3RhbmNlfHwhcS53YXNtQnl0ZU1lbW9yeSl7ZWEoTyh7ZXJyb3I6ITB9LApiLm1lc3NhZ2VJZCkpO2JyZWFrfXEucGF1c2VkPSExO3EuZnBzVGltZVN0YW1wcz1bXTtWYihxKTtxLmZyYW1lU2tpcENvdW50ZXI9MDtxLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtxLm9wdGlvbnMuaXNHYmNDb2xvcml6YXRpb25FbmFibGVkP3Eub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlJiZxLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoIndhc21ib3lnYiBicm93biByZWQgZGFya2Jyb3duIGdyZWVuIGRhcmtncmVlbiBpbnZlcnRlZCBwYXN0ZWxtaXggb3JhbmdlIHllbGxvdyBibHVlIGRhcmtibHVlIGdyYXlzY2FsZSIuc3BsaXQoIiAiKS5pbmRleE9mKHEub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlLnRvTG93ZXJDYXNlKCkpKTpxLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoMCk7dWMocSwxRTMvcS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpO2VhKE8odm9pZCAwLApiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQi5QQVVTRTpxLnBhdXNlZD0hMDtxLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KHEudXBkYXRlSWQpLHEudXBkYXRlSWQ9dm9pZCAwKTtlYShPKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgQi5SVU5fV0FTTV9FWFBPUlQ6YT1iLm1lc3NhZ2UucGFyYW1ldGVycz9xLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6cS53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO2VhKE8oe3R5cGU6Qi5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEIuR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046e2E9MDtsZXQgYz1xLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiLm1lc3NhZ2Uuc3RhcnQmJihhPWIubWVzc2FnZS5zdGFydCk7Yi5tZXNzYWdlLmVuZCYmKGM9Yi5tZXNzYWdlLmVuZCk7YT1xLndhc21CeXRlTWVtb3J5LnNsaWNlKGEsCmMpLmJ1ZmZlcjtlYShPKHt0eXBlOkIuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgQi5HRVRfV0FTTV9DT05TVEFOVDplYShPKHt0eXBlOkIuR0VUX1dBU01fQ09OU1RBTlQscmVzcG9uc2U6cS53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIEIuRk9SQ0VfT1VUUFVUX0ZSQU1FOnJjKHEpO2JyZWFrO2Nhc2UgQi5TRVRfU1BFRUQ6cS5zcGVlZD1iLm1lc3NhZ2Uuc3BlZWQ7cS5mcHNUaW1lU3RhbXBzPVtdO3EudGltZVN0YW1wc1VudGlsUmVhZHk9NjA7VmIocSk7cS5mcmFtZVNraXBDb3VudGVyPTA7cS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7cS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCk7YnJlYWs7Y2FzZSBCLklTX0dCQzphPTA8cS53YXNtSW5zdGFuY2UuZXhwb3J0cy5pc0dCQygpO2VhKE8oe3R5cGU6Qi5JU19HQkMsCnJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZygiVW5rbm93biBXYXNtQm95IFdvcmtlciBtZXNzYWdlOiIsYil9fSxnZXRGUFM6KCk9PjA8cS50aW1lU3RhbXBzVW50aWxSZWFkeT9xLnNwZWVkJiYwPHEuc3BlZWQ/cS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqcS5zcGVlZDpxLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpxLmZwc1RpbWVTdGFtcHM/cS5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtmYihxLm1lc3NhZ2VIYW5kbGVyKX0pKCkK";

  var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGgoYSxiKXtlP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTprLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGUpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZSlzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugay5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZihhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZCsrLGI9YCR7Yn0tJHtkfWAsMUU1PGQmJihkPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWxldCBlPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsaztlfHwoaz1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZD0wLGwsbj1hPT57YT1hLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJHRVRfQ09OU1RBTlRTX0RPTkUiOmgoZihhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJVUERBVEVEIjp7YT1uZXcgVWludDhDbGFtcGVkQXJyYXkoYS5tZXNzYWdlLmdyYXBoaWNzRnJhbWVCdWZmZXIpO2xldCBiPW5ldyBVaW50OENsYW1wZWRBcnJheSg5MjE2MCk7Zm9yKGxldCBjPTA7MTQ0PmM7KytjKXtsZXQgZT00ODAqYyxmPTY0MCpjO2ZvcihsZXQgYz0wOzE2MD5jOysrYyl7bGV0IGQ9ZSszKmMsZz1mKyhjPDwyKTtiW2crMF09YVtkKzBdO2JbZysxXT1hW2QrMV07YltnKzJdPWFbZCsyXTtiW2crM109MjU1fX1hPWJ9aChmKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bShhPT57YT1hLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpsPWEubWVzc2FnZS5wb3J0c1swXTsKbShuLGwpO2goZih2b2lkIDAsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTIjpsLnBvc3RNZXNzYWdlKGYoe3R5cGU6IkdFVF9DT05TVEFOVFMifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYSl9fSl9KSgpCg==";

  var wasmboyAudioWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSxiKXtjP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpuLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gcChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGMpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoYylzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugbi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZChhLGIscil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksaysrLGI9YCR7Yn0tJHtrfWAsMUU1PGsmJihrPTApKTtyZXR1cm57d29ya2VySWQ6cixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWxldCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsbjtjfHwobj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgaz0wLHE9YT0+e2E9KGEtMSkvMTI3LTE7LjAwOD5NYXRoLmFicyhhKSYmKGE9MCk7cmV0dXJuIGEvMi41fSxsLHQ9YT0+e2NvbnN0IGI9YS5kYXRhP2EuZGF0YTphO2lmKGIubWVzc2FnZSlzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6bShkKGIubWVzc2FnZSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOntjb25zdCBhPXt0eXBlOiJVUERBVEVEIixudW1iZXJPZlNhbXBsZXM6Yi5tZXNzYWdlLm51bWJlck9mU2FtcGxlcyxmcHM6Yi5tZXNzYWdlLmZwcyxhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6Yi5tZXNzYWdlLmFsbG93RmFzdFNwZWVkU3RyZXRjaGluZ30sYz1bXTtbImF1ZGlvQnVmZmVyIiwiY2hhbm5lbDFCdWZmZXIiLCJjaGFubmVsMkJ1ZmZlciIsImNoYW5uZWwzQnVmZmVyIiwiY2hhbm5lbDRCdWZmZXIiXS5mb3JFYWNoKGQ9PntpZihiLm1lc3NhZ2VbZF0pe3t2YXIgZj1uZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZF0pOwp2YXIgZz1iLm1lc3NhZ2UubnVtYmVyT2ZTYW1wbGVzO2NvbnN0IGE9bmV3IEZsb2F0MzJBcnJheShnKTt2YXIgaD1uZXcgRmxvYXQzMkFycmF5KGcpO2xldCBjPTA7Zyo9Mjtmb3IodmFyIGU9MDtlPGc7ZSs9MilhW2NdPXEoZltlXSksYysrO2M9MDtmb3IoZT0xO2U8ZztlKz0yKWhbY109cShmW2VdKSxjKys7Zj1hLmJ1ZmZlcjtoPWguYnVmZmVyfWFbZF09e307YVtkXS5sZWZ0PWY7YVtkXS5yaWdodD1oO2MucHVzaChmKTtjLnB1c2goaCl9fSk7bShkKGEpLGMpfX19O3AoYT0+e2E9YS5kYXRhP2EuZGF0YTphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6bD1hLm1lc3NhZ2UucG9ydHNbMF07cCh0LGwpO20oZCh2b2lkIDAsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTIjpsLnBvc3RNZXNzYWdlKGQoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiQVVESU9fTEFURU5DWSI6bC5wb3N0TWVzc2FnZShkKGEubWVzc2FnZSwKYS5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGEpfX0pfSkoKQo=";

  var wasmboyControllerWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihjKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKGMpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIGUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLGQrKyxiPWAke2J9LSR7ZH1gLDFFNTxkJiYoZD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1sZXQgYz0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmLGU7Y3x8KGU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtsZXQgZD0wLGYsaz1hPT57fTtnKGE9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNPTk5FQ1QiOmY9CmEubWVzc2FnZS5wb3J0c1swXTtnKGssZik7YT1oKHZvaWQgMCxhLm1lc3NhZ2VJZCk7Yz9zZWxmLnBvc3RNZXNzYWdlKGEsdm9pZCAwKTplLnBvc3RNZXNzYWdlKGEsdm9pZCAwKTticmVhaztjYXNlICJTRVRfSk9ZUEFEX1NUQVRFIjpmLnBvc3RNZXNzYWdlKGgoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCkK";

  var wasmboyMemoryWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWxldCBkPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGYsaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGYsaz0oYSxiKT0+e2NvbnN0IGQ9W107T2JqZWN0LmtleXMoYi5tZXNzYWdlKS5mb3JFYWNoKGE9PnsidHlwZSIhPT1hJiZkLnB1c2goYi5tZXNzYWdlW2FdKX0pO2NvbnN0IGU9YyhiLm1lc3NhZ2UsYi5tZXNzYWdlSWQpO2E/Zi5wb3N0TWVzc2FnZShlLGQpOmcoZSxkKX0sbT1hPT57YT1hLmRhdGE/YS5kYXRhOmE7aWYoYS5tZXNzYWdlKXN3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ0xFQVJfTUVNT1JZX0RPTkUiOmcoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpLFthLm1lc3NhZ2Uud2FzbUJ5dGVNZW1vcnldKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTX0RPTkUiOmcoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJTRVRfTUVNT1JZX0RPTkUiOmcoYyhhLm1lc3NhZ2UsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfTUVNT1JZIjprKCExLGEpO2JyZWFrO2Nhc2UgIlVQREFURUQiOmsoITEsYSl9fTtsKGE9PnthPWEuZGF0YT9hLmRhdGE6CmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpmPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sZik7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkNMRUFSX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKHt0eXBlOiJDTEVBUl9NRU1PUlkifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmYucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlNFVF9NRU1PUlkiOmsoITAsYSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCkK";

  // Smarter workers.

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

      this.messageListeners = []; // Can't load base63 data string directly because safari
      // https://stackoverflow.com/questions/10343913/how-to-create-a-web-worker-from-a-string

      let workerJs = atob(workerUrl.split(',')[1]);
      let blob;

      try {
        blob = new Blob([workerJs], {
          type: 'application/javascript'
        });
      } catch (e) {
        // Legacy
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(workerJs);
        blob = blob.getBlob();
      }

      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = this._onMessageHandler.bind(this);
      /*ROLLUP_REPLACE_DEV_BROWSER
       this.worker = new Worker(workerUrl);
      this.worker.onmessage = this._onMessageHandler.bind(this);
       ROLLUP_REPLACE_DEV_BROWSER*/

      /*ROLLUP_REPLACE_NODE
       // Split by Comma, to remove the file header from the base 64 string
      const workerAsString = readBase64String(workerUrl);
      this.worker = new Worker(workerAsString, {
        eval: true
      });
      this.worker.on('message', this._onMessageHandler.bind(this))
       ROLLUP_REPLACE_NODE*/
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
  /*ROLLUP_REPLACE_NODE
  const { MessageChannel } = require('worker_threads');
  ROLLUP_REPLACE_NODE*/

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

  return exports;

}({}));
//# sourceMappingURL=wasmboy.ts.iife.js.map
