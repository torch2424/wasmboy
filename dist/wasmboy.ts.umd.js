(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.WasmBoy = {})));
}(this, (function (exports) { 'use strict';

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

  var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

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

  var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGViKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gZWEoYSxjKXttYj9zZWxmLnBvc3RNZXNzYWdlKGEsYyk6QWIucG9zdE1lc3NhZ2UoYSxjKX1mdW5jdGlvbiBmYihhLGMpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihjKWlmKG1iKWMub25tZXNzYWdlPWE7ZWxzZSBjLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKG1iKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBBYi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTShhLGMsYil7Y3x8KGM9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksbmIrKyxjPWAke2N9LSR7bmJ9YCwxRTU8bmImJihuYj0wKSk7cmV0dXJue3dvcmtlcklkOmIsbWVzc2FnZUlkOmMsbWVzc2FnZTphfX1mdW5jdGlvbiB3YyhhLGMpe2M9ZWIoYyk7CnN3aXRjaChjLm1lc3NhZ2UudHlwZSl7Y2FzZSB4LkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpLGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9TSVpFLnZhbHVlT2YoKSxhLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShNKHt0eXBlOnguR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5GUkFNRV9MT0NBVElPTi52YWx1ZU9mKCl9LGMubWVzc2FnZUlkKSl9fWZ1bmN0aW9uIHhjKGEsYyl7Yz1lYihjKTtzd2l0Y2goYy5tZXNzYWdlLnR5cGUpe2Nhc2UgeC5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5BVURJT19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpOwphLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfMV9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8yX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzNfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfNF9CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE0oe3R5cGU6eC5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5BVURJT19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpfSwKYy5tZXNzYWdlSWQpKTticmVhaztjYXNlIHguQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yy5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIHljKGEsYyl7Yz1lYihjKTtzd2l0Y2goYy5tZXNzYWdlLnR5cGUpe2Nhc2UgeC5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxjLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gV2IoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5O2xldCBjPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XSxiPXZvaWQgMDtpZigwPT09YylyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7MTw9YyYmMz49Yz9iPTMyNzY4OjU8PWMmJjY+PWM/Yj0yMDQ4OjE1PD1jJiYxOT49Yz9iPTMyNzY4OjI1PD1jJiYzMD49YyYmKGI9MTMxMDcyKTtyZXR1cm4gYj9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2IpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIFhiKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gemMoYSxjKXtjPWViKGMpO3N3aXRjaChjLm1lc3NhZ2UudHlwZSl7Y2FzZSB4LkNMRUFSX01FTU9SWTpmb3IodmFyIGI9MDtiPD1hLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiKyspYS53YXNtQnl0ZU1lbW9yeVtiXT0wO2I9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTSh7dHlwZTp4LkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmIuYnVmZmVyfSxjLm1lc3NhZ2VJZCksW2IuYnVmZmVyXSk7CmJyZWFrO2Nhc2UgeC5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShNKHt0eXBlOnguR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9ST01fTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DQVJUUklER0VfUkFNX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuV0FTTUJPWV9TVEFURV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQkNfUEFMRVRURV9MT0NBVElPTi52YWx1ZU9mKCl9LGMubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB4LlNFVF9NRU1PUlk6Yj1PYmplY3Qua2V5cyhjLm1lc3NhZ2UpOwpiLmluY2x1ZGVzKEQuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGMubWVzc2FnZVtELkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7Yi5pbmNsdWRlcyhELkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2VbRC5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtiLmluY2x1ZGVzKEQuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShjLm1lc3NhZ2VbRC5HQU1FQk9ZX01FTU9SWV0pLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04pO2IuaW5jbHVkZXMoRC5QQUxFVFRFX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGMubWVzc2FnZVtELlBBTEVUVEVfTUVNT1JZXSksYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKTsKYi5pbmNsdWRlcyhELklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGMubWVzc2FnZVtELklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTSh7dHlwZTp4LlNFVF9NRU1PUllfRE9ORX0sYy5tZXNzYWdlSWQpKTticmVhaztjYXNlIHguR0VUX01FTU9SWTp7Yj17dHlwZTp4LkdFVF9NRU1PUll9O2NvbnN0IFA9W107dmFyIGQ9Yy5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKGQuaW5jbHVkZXMoRC5DQVJUUklER0VfUk9NKSl7aWYoYS53YXNtQnl0ZU1lbW9yeSl7dmFyIGY9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddO3ZhciBlPXZvaWQgMDswPT09Zj9lPTMyNzY4OjE8PWYmJjM+PWY/ZT0yMDk3MTUyOjU8PWYmJjY+PWY/ZT0yNjIxNDQ6CjE1PD1mJiYxOT49Zj9lPTIwOTcxNTI6MjU8PWYmJjMwPj1mJiYoZT04Mzg4NjA4KTtmPWU/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTitlKTpuZXcgVWludDhBcnJheX1lbHNlIGY9bmV3IFVpbnQ4QXJyYXk7Zj1mLmJ1ZmZlcjtiW0QuQ0FSVFJJREdFX1JPTV09ZjtQLnB1c2goZil9ZC5pbmNsdWRlcyhELkNBUlRSSURHRV9SQU0pJiYoZj1XYihhKS5idWZmZXIsYltELkNBUlRSSURHRV9SQU1dPWYsUC5wdXNoKGYpKTtkLmluY2x1ZGVzKEQuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhmPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxmPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZixmKzI3KSk6Zj1uZXcgVWludDhBcnJheSxmPWYuYnVmZmVyLGJbRC5DQVJUUklER0VfSEVBREVSXT1mLFAucHVzaChmKSk7ZC5pbmNsdWRlcyhELkdBTUVCT1lfTUVNT1JZKSYmCihmPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyLGJbRC5HQU1FQk9ZX01FTU9SWV09ZixQLnB1c2goZikpO2QuaW5jbHVkZXMoRC5QQUxFVFRFX01FTU9SWSkmJihmPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGJbRC5QQUxFVFRFX01FTU9SWV09ZixQLnB1c2goZikpO2QuaW5jbHVkZXMoRC5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGQ9WGIoYSkuYnVmZmVyLGJbRC5JTlRFUk5BTF9TVEFURV09ZCxQLnB1c2goZCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShNKGIsCmMubWVzc2FnZUlkKSxQKX19fWZ1bmN0aW9uIG9iKGEsYyl7YT0xPDxhJjI1NTtiLnJlZ2lzdGVyRj0wPGM/Yi5yZWdpc3RlckZ8YTpiLnJlZ2lzdGVyRiYoMjU1XmEpO3JldHVybiBiLnJlZ2lzdGVyRn1mdW5jdGlvbiB0KGEpe29iKDcsYSl9ZnVuY3Rpb24gdihhKXtvYig2LGEpfWZ1bmN0aW9uIEcoYSl7b2IoNSxhKX1mdW5jdGlvbiBLKGEpe29iKDQsYSl9ZnVuY3Rpb24gVGEoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjcmMX1mdW5jdGlvbiBVKCl7cmV0dXJuIGIucmVnaXN0ZXJGPj40JjF9ZnVuY3Rpb24gUihhLGMpezA8PWM/RygwIT09KChhJjE1KSsoYyYxNSkmMTYpKTpHKChNYXRoLmFicyhjKSYxNSk+KGEmMTUpKX1mdW5jdGlvbiBCYihhLGMpezA8PWM/SyhhPihhK2MmMjU1KSk6SyhNYXRoLmFicyhjKT5hKX1mdW5jdGlvbiBXYShhLGMsYil7Yj8oYT1hXmNeYStjLEcoMCE9PShhJjE2KSksSygwIT09KGEmMjU2KSkpOihiPWErYyY2NTUzNSxLKGI8YSksRygwIT09KChhXmNeYikmCjQwOTYpKSl9ZnVuY3Rpb24gWWIoYSl7c3dpdGNoKGEpe2Nhc2UgMDpkLmJnV2hpdGU9TC5iZ1doaXRlO2QuYmdMaWdodEdyZXk9TC5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9TC5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1MLmJnQmxhY2s7ZC5vYmowV2hpdGU9TC5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PUwub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1MLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1MLm9iajBCbGFjaztkLm9iajFXaGl0ZT1MLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9TC5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PUwub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPUwub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMTpkLmJnV2hpdGU9amEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PWphLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1qYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1qYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPWphLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9CmphLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9amEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPWphLm9iajBCbGFjaztkLm9iajFXaGl0ZT1qYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PWphLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9amEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPWphLm9iajFCbGFjazticmVhaztjYXNlIDI6ZC5iZ1doaXRlPWthLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1rYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9a2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9a2EuYmdCbGFjaztkLm9iajBXaGl0ZT1rYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PWthLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9a2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPWthLm9iajBCbGFjaztkLm9iajFXaGl0ZT1rYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PWthLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9a2Eub2JqMURhcmtHcmV5OwpkLm9iajFCbGFjaz1rYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAzOmQuYmdXaGl0ZT1sYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9bGEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PWxhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPWxhLmJnQmxhY2s7ZC5vYmowV2hpdGU9bGEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1sYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PWxhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1sYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9bGEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1sYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PWxhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1sYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA0OmQuYmdXaGl0ZT1tYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9bWEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PW1hLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPW1hLmJnQmxhY2s7ZC5vYmowV2hpdGU9bWEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT0KbWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1tYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9bWEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPW1hLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9bWEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1tYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9bWEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgNTpkLmJnV2hpdGU9bmEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PW5hLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1uYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1uYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPW5hLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9bmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1uYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9bmEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPW5hLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9bmEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1uYS5vYmoxRGFya0dyZXk7CmQub2JqMUJsYWNrPW5hLm9iajFCbGFjazticmVhaztjYXNlIDY6ZC5iZ1doaXRlPW9hLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1vYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9b2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9b2EuYmdCbGFjaztkLm9iajBXaGl0ZT1vYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PW9hLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9b2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPW9hLm9iajBCbGFjaztkLm9iajFXaGl0ZT1vYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PW9hLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9b2Eub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPW9hLm9iajFCbGFjazticmVhaztjYXNlIDc6ZC5iZ1doaXRlPXBhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1wYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9cGEuYmdEYXJrR3JleTtkLmJnQmxhY2s9cGEuYmdCbGFjaztkLm9iajBXaGl0ZT1wYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PQpwYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXBhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1wYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9cGEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1wYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXBhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1wYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSA4OmQuYmdXaGl0ZT1xYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9cWEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXFhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXFhLmJnQmxhY2s7ZC5vYmowV2hpdGU9cWEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT1xYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXFhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1xYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9cWEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1xYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXFhLm9iajFEYXJrR3JleTsKZC5vYmoxQmxhY2s9cWEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgOTpkLmJnV2hpdGU9cmEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXJhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1yYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1yYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXJhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9cmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1yYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9cmEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXJhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9cmEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1yYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9cmEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMTA6ZC5iZ1doaXRlPXNhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1zYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9c2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9c2EuYmdCbGFjaztkLm9iajBXaGl0ZT1zYS5vYmowV2hpdGU7CmQub2JqMExpZ2h0R3JleT1zYS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXNhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz1zYS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9c2Eub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT1zYS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXNhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1zYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAxMTpkLmJnV2hpdGU9dGEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXRhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT10YS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz10YS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXRhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9dGEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT10YS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9dGEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXRhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9dGEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT0KdGEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPXRhLm9iajFCbGFjazticmVhaztjYXNlIDEyOmQuYmdXaGl0ZT11YS5iZ1doaXRlLGQuYmdMaWdodEdyZXk9dWEuYmdMaWdodEdyZXksZC5iZ0RhcmtHcmV5PXVhLmJnRGFya0dyZXksZC5iZ0JsYWNrPXVhLmJnQmxhY2ssZC5vYmowV2hpdGU9dWEub2JqMFdoaXRlLGQub2JqMExpZ2h0R3JleT11YS5vYmowTGlnaHRHcmV5LGQub2JqMERhcmtHcmV5PXVhLm9iajBEYXJrR3JleSxkLm9iajBCbGFjaz11YS5vYmowQmxhY2ssZC5vYmoxV2hpdGU9dWEub2JqMVdoaXRlLGQub2JqMUxpZ2h0R3JleT11YS5vYmoxTGlnaHRHcmV5LGQub2JqMURhcmtHcmV5PXVhLm9iajFEYXJrR3JleSxkLm9iajFCbGFjaz11YS5vYmoxQmxhY2t9fWZ1bmN0aW9uIG4oYSxjKXtyZXR1cm4oYSYyNTUpPDw4fGMmMjU1fWZ1bmN0aW9uIEUoYSl7cmV0dXJuKGEmNjUyODApPj44fWZ1bmN0aW9uIEgoYSxjKXtyZXR1cm4gYyZ+KDE8PGEpfWZ1bmN0aW9uIHAoYSxjKXtyZXR1cm4gMCE9CihjJjE8PGEpfWZ1bmN0aW9uIHBiKGEsYyl7YT13KGMpPj4yKmEmMztpZihjPT09WGEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lKXN3aXRjaChjPWQub2JqMFdoaXRlLGEpe2Nhc2UgMTpjPWQub2JqMExpZ2h0R3JleTticmVhaztjYXNlIDI6Yz1kLm9iajBEYXJrR3JleTticmVhaztjYXNlIDM6Yz1kLm9iajBCbGFja31lbHNlIGlmKGM9PT1YYS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd28pc3dpdGNoKGM9ZC5vYmoxV2hpdGUsYSl7Y2FzZSAxOmM9ZC5vYmoxTGlnaHRHcmV5O2JyZWFrO2Nhc2UgMjpjPWQub2JqMURhcmtHcmV5O2JyZWFrO2Nhc2UgMzpjPWQub2JqMUJsYWNrfWVsc2Ugc3dpdGNoKGM9ZC5iZ1doaXRlLGEpe2Nhc2UgMTpjPWQuYmdMaWdodEdyZXk7YnJlYWs7Y2FzZSAyOmM9ZC5iZ0RhcmtHcmV5O2JyZWFrO2Nhc2UgMzpjPWQuYmdCbGFja31yZXR1cm4gY31mdW5jdGlvbiBxYihhLGMsYil7Yz04KmErMipjO2E9WmIoYysxLGIpO2I9WmIoYyxiKTsKcmV0dXJuIG4oYSxiKX1mdW5jdGlvbiB2YShhLGMpe2EqPTU7cmV0dXJuIDgqKChjJjMxPDxhKT4+YSl9ZnVuY3Rpb24gWmIoYSxjKXthJj02MztjJiYoYSs9NjQpO3JldHVybiBlW1lhK2FdfWZ1bmN0aW9uIHJiKGEsYyxiLGQpe3ZvaWQgMD09PWImJihiPTApO3ZvaWQgMD09PWQmJihkPSExKTtiJj0zO2QmJihifD00KTtlW1phKygxNjAqYythKV09Yn1mdW5jdGlvbiBDYihhLGMsZCxCLGYsaCxnLGssbSxsLG4sdSx2LHEpe3ZhciBQPTA7Yz1nYihjLGEpO2E9WChjKzIqaCxkKTtkPVgoYysyKmgrMSxkKTtmb3IoaD1CO2g8PWY7KytoKWlmKGM9ZysoaC1CKSxjPG0pe3ZhciBDPWg7aWYoMD52fHwhcCg1LHYpKUM9Ny1DO3ZhciBpYT0wO3AoQyxkKSYmKGlhKz0xLGlhPDw9MSk7cChDLGEpJiYoaWErPTEpO2lmKGIuR0JDRW5hYmxlZCYmKDA8PXZ8fDA8PXEpKXtDPTA8PXE7dmFyIGZhPXYmNztDJiYoZmE9cSY3KTt2YXIgaGE9cWIoZmEsaWEsQyk7Qz12YSgwLGhhKTtmYT12YSgxLGhhKTsKaGE9dmEoMixoYSl9ZWxzZSBpZigwPj11JiYodT1yLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLG4pe2ZhPWlhO2hhPW47dm9pZCAwPT09aGEmJihoYT0hMSk7Qz1mYTtoYXx8KEM9dyh1KT4+KGZhPDwxKSYzKTtmYT0yNDI7c3dpdGNoKEMpe2Nhc2UgMTpmYT0xNjA7YnJlYWs7Y2FzZSAyOmZhPTg4O2JyZWFrO2Nhc2UgMzpmYT04fWZhPUM9aGE9ZmF9ZWxzZSBoYT1wYihpYSx1KSxDPShoYSYxNjcxMTY4MCk+PjE2LGZhPShoYSY2NTI4MCk+PjgsaGEmPTI1NTtsKz0zKihrKm0rYyk7ZVtsKzBdPUM7ZVtsKzFdPWZhO2VbbCsyXT1oYTtDPSExOzA8PXYmJihDPXAoNyx2KSk7cmIoYyxrLGlhLEMpO1ArK31yZXR1cm4gUH1mdW5jdGlvbiBnYihhLGMpe2E9PT1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQmJihjPXAoNyxjKT9jLTEyODpjKzEyOCk7cmV0dXJuIGErMTYqY31mdW5jdGlvbiAkYihhLGMpe3N3aXRjaChhKXtjYXNlIDE6cmV0dXJuIHAoYywKMTI5KTtjYXNlIDI6cmV0dXJuIHAoYywxMzUpO2Nhc2UgMzpyZXR1cm4gcChjLDEyNik7ZGVmYXVsdDpyZXR1cm4gcChjLDEpfX1mdW5jdGlvbiBhYygpe3ZhciBhPWJjKCk7MjA0Nz49YSYmMDx6Lk5SeDBTd2VlcFNoaWZ0JiYoei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1hLHouc2V0RnJlcXVlbmN5KGEpLGE9YmMoKSk7MjA0NzxhJiYoei5pc0VuYWJsZWQ9ITEpfWZ1bmN0aW9uIGJjKCl7dmFyIGE9ei5zd2VlcFNoYWRvd0ZyZXF1ZW5jeTt2YXIgYz1hPj56Lk5SeDBTd2VlcFNoaWZ0O3JldHVybiBjPXouTlJ4ME5lZ2F0ZT9hLWM6YStjfWZ1bmN0aW9uIHNiKGEpe3N3aXRjaChhKXtjYXNlIHouY2hhbm5lbE51bWJlcjphPXouaXNEYWNFbmFibGVkO3ZhciBjPXEuY2hhbm5lbDFEYWNFbmFibGVkIT09YTtxLmNoYW5uZWwxRGFjRW5hYmxlZD1hO3JldHVybiBjO2Nhc2UgTi5jaGFubmVsTnVtYmVyOnJldHVybiBhPU4uaXNEYWNFbmFibGVkLGM9cS5jaGFubmVsMkRhY0VuYWJsZWQhPT1hLApxLmNoYW5uZWwyRGFjRW5hYmxlZD1hLGM7Y2FzZSBKLmNoYW5uZWxOdW1iZXI6cmV0dXJuIGE9Si5pc0RhY0VuYWJsZWQsYz1xLmNoYW5uZWwzRGFjRW5hYmxlZCE9PWEscS5jaGFubmVsM0RhY0VuYWJsZWQ9YSxjO2Nhc2UgTy5jaGFubmVsTnVtYmVyOnJldHVybiBhPU8uaXNEYWNFbmFibGVkLGM9cS5jaGFubmVsNERhY0VuYWJsZWQhPT1hLHEuY2hhbm5lbDREYWNFbmFibGVkPWEsY31yZXR1cm4hMX1mdW5jdGlvbiB0Yigpe2Zvcih2YXIgYT1rLmJhdGNoUHJvY2Vzc0N5Y2xlcygpO2suY3VycmVudEN5Y2xlcz49YTspY2MoYSksay5jdXJyZW50Q3ljbGVzLT1hfWZ1bmN0aW9uIGNjKGEpe3ZhciBjPWsubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcygpO3ZhciBiPWsuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcithO2lmKGI+PWMpe2suZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj1iLWM7Yz1rLmZyYW1lU2VxdWVuY2VyO3N3aXRjaChjKXtjYXNlIDA6ei51cGRhdGVMZW5ndGgoKTtOLnVwZGF0ZUxlbmd0aCgpOwpKLnVwZGF0ZUxlbmd0aCgpO08udXBkYXRlTGVuZ3RoKCk7YnJlYWs7Y2FzZSAyOnoudXBkYXRlTGVuZ3RoKCk7Ti51cGRhdGVMZW5ndGgoKTtKLnVwZGF0ZUxlbmd0aCgpO08udXBkYXRlTGVuZ3RoKCk7ei51cGRhdGVTd2VlcCgpO2JyZWFrO2Nhc2UgNDp6LnVwZGF0ZUxlbmd0aCgpO04udXBkYXRlTGVuZ3RoKCk7Si51cGRhdGVMZW5ndGgoKTtPLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgNjp6LnVwZGF0ZUxlbmd0aCgpO04udXBkYXRlTGVuZ3RoKCk7Si51cGRhdGVMZW5ndGgoKTtPLnVwZGF0ZUxlbmd0aCgpO3oudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDc6ei51cGRhdGVFbnZlbG9wZSgpLE4udXBkYXRlRW52ZWxvcGUoKSxPLnVwZGF0ZUVudmVsb3BlKCl9ay5mcmFtZVNlcXVlbmNlcj1jKzEmNztjPSEwfWVsc2Ugay5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWIsYz0hMTtpZihTLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXMmJiFjKXtjPXoud2lsbENoYW5uZWxVcGRhdGUoYSl8fApzYih6LmNoYW5uZWxOdW1iZXIpO2I9Ti53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8c2IoTi5jaGFubmVsTnVtYmVyKTt2YXIgZD1KLndpbGxDaGFubmVsVXBkYXRlKGEpfHxzYihKLmNoYW5uZWxOdW1iZXIpLGY9Ty53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8c2IoTy5jaGFubmVsTnVtYmVyKTtjJiYocS5jaGFubmVsMVNhbXBsZT16LmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7YiYmKHEuY2hhbm5lbDJTYW1wbGU9Ti5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2QmJihxLmNoYW5uZWwzU2FtcGxlPUouZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtmJiYocS5jaGFubmVsNFNhbXBsZT1PLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7aWYoY3x8Ynx8ZHx8ZilxLm5lZWRUb1JlbWl4U2FtcGxlcz0hMDtjPWsuZG93blNhbXBsZUN5Y2xlQ291bnRlcjtjKz1hKmsuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcjthPWsubWF4RG93blNhbXBsZUN5Y2xlcygpO2M+PWEmJihjLT0KYSxrLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9YyxxLm5lZWRUb1JlbWl4U2FtcGxlc3x8cS5taXhlclZvbHVtZUNoYW5nZWR8fHEubWl4ZXJFbmFibGVkQ2hhbmdlZD8kYShxLmNoYW5uZWwxU2FtcGxlLHEuY2hhbm5lbDJTYW1wbGUscS5jaGFubmVsM1NhbXBsZSxxLmNoYW5uZWw0U2FtcGxlKTprLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9YyxhYihxLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlKzEscS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGUrMSx1YiksYT1rLmF1ZGlvUXVldWVJbmRleCsxLGE+PShrLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplPj4xfDApLTEmJi0tYSxrLmF1ZGlvUXVldWVJbmRleD1hKX1lbHNlIGlmKGM9ei5nZXRTYW1wbGUoYSl8MCxiPU4uZ2V0U2FtcGxlKGEpfDAsZD1KLmdldFNhbXBsZShhKXwwLGY9Ty5nZXRTYW1wbGUoYSl8MCxxLmNoYW5uZWwxU2FtcGxlPWMscS5jaGFubmVsMlNhbXBsZT1iLHEuY2hhbm5lbDNTYW1wbGU9ZCxxLmNoYW5uZWw0U2FtcGxlPQpmLGE9ay5kb3duU2FtcGxlQ3ljbGVDb3VudGVyK2Eqay5kb3duU2FtcGxlQ3ljbGVNdWx0aXBsaWVyLGE+PWsubWF4RG93blNhbXBsZUN5Y2xlcygpKXthLT1rLm1heERvd25TYW1wbGVDeWNsZXMoKTtrLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9YTthPSRhKGMsYixkLGYpO3ZhciBlPUUoYSk7YWIoZSsxLChhJjI1NSkrMSx1Yik7Uy5lbmFibGVBdWRpb0RlYnVnZ2luZyYmKGE9JGEoYywxNSwxNSwxNSksZT1FKGEpLGFiKGUrMSwoYSYyNTUpKzEsRGIpLGE9JGEoMTUsYiwxNSwxNSksZT1FKGEpLGFiKGUrMSwoYSYyNTUpKzEsRWIpLGE9JGEoMTUsMTUsZCwxNSksZT1FKGEpLGFiKGUrMSwoYSYyNTUpKzEsRmIpLGE9JGEoMTUsMTUsMTUsZiksZT1FKGEpLGFiKGUrMSwoYSYyNTUpKzEsR2IpKTthPWsuYXVkaW9RdWV1ZUluZGV4KzE7YT49KGsud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemU+PjF8MCktMSYmLS1hO2suYXVkaW9RdWV1ZUluZGV4PWF9fWZ1bmN0aW9uIGRjKCl7cmV0dXJuIGsuYXVkaW9RdWV1ZUluZGV4fQpmdW5jdGlvbiBlYygpe2suYXVkaW9RdWV1ZUluZGV4PTB9ZnVuY3Rpb24gJGEoYSxjLGIsZCl7dm9pZCAwPT09YSYmKGE9MTUpO3ZvaWQgMD09PWMmJihjPTE1KTt2b2lkIDA9PT1iJiYoYj0xNSk7dm9pZCAwPT09ZCYmKGQ9MTUpO3EubWl4ZXJWb2x1bWVDaGFuZ2VkPSExO3ZhciBQPTArKGsuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0P2E6MTUpO1ArPWsuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0P2M6MTU7UCs9ay5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ/YjoxNTtQKz1rLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD9kOjE1O2E9MCsoay5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0P2E6MTUpO2ErPWsuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD9jOjE1O2ErPWsuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD9iOjE1O2ErPWsuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD8KZDoxNTtxLm1peGVyRW5hYmxlZENoYW5nZWQ9ITE7cS5uZWVkVG9SZW1peFNhbXBsZXM9ITE7Yz1mYyhQLGsuTlI1MExlZnRNaXhlclZvbHVtZSsxKTtiPWZjKGEsay5OUjUwUmlnaHRNaXhlclZvbHVtZSsxKTtxLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPWM7cS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9YjtyZXR1cm4gbihjLGIpfWZ1bmN0aW9uIGZjKGEsYyl7aWYoNjA9PT1hKXJldHVybiAxMjc7YT0xRTUqKGEtNjApKmM+PjM7YT0oYS8xRTV8MCkrNjA7YT0xRTUqYS8oMTJFNi8yNTR8MCl8MDtyZXR1cm4gYXw9MH1mdW5jdGlvbiBhYihhLGMsYil7Yis9ay5hdWRpb1F1ZXVlSW5kZXg8PDE7ZVtiKzBdPWErMTtlW2IrMV09YysxfWZ1bmN0aW9uIGhiKGEpe3ZiKCExKTt2YXIgYz13KG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KTtjPUgoYSxjKTttLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1jO2gobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsCmMpO2Iuc3RhY2tQb2ludGVyLT0yO2IuaXNIYWx0ZWQoKTtjPWIuc3RhY2tQb2ludGVyO3ZhciBkPWIucHJvZ3JhbUNvdW50ZXIsQj1FKGQpO2goYyswLGQmMjU1KTtoKGMrMSxCKTtzd2l0Y2goYSl7Y2FzZSBtLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0Om0uaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7Yi5wcm9ncmFtQ291bnRlcj02NDticmVhaztjYXNlIG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ6bS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTcyO2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0Om0uaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTgwO2JyZWFrO2Nhc2UgbS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdDptLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9ODg7YnJlYWs7Y2FzZSBtLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0Om0uaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9CiExLGIucHJvZ3JhbUNvdW50ZXI9OTZ9fWZ1bmN0aW9uIGJiKGEpe3ZhciBjPXcobS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpO2N8PTE8PGE7bS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9YztoKG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGMpfWZ1bmN0aW9uIHZiKGEpe2E/bS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMDptLm1hc3RlckludGVycnVwdFN3aXRjaD0hMX1mdW5jdGlvbiBIYihhKXtmb3IodmFyIGM9MDtjPGE7KXt2YXIgYj11LmRpdmlkZXJSZWdpc3RlcixkPWI7Yys9NDtkKz00O2QmPTY1NTM1O3UuZGl2aWRlclJlZ2lzdGVyPWQ7aWYodS50aW1lckVuYWJsZWQpe3ZhciBmPXUudGltZXJDb3VudGVyV2FzUmVzZXQ7dS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5Pyh1LnRpbWVyQ291bnRlcj11LnRpbWVyTW9kdWxvLG0uaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMCxiYihtLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLAp1LnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITEsdS50aW1lckNvdW50ZXJXYXNSZXNldD0hMCk6ZiYmKHUudGltZXJDb3VudGVyV2FzUmVzZXQ9ITEpO2djKGIsZCkmJkliKCl9fX1mdW5jdGlvbiBJYigpe3ZhciBhPXUudGltZXJDb3VudGVyOzI1NTwrK2EmJih1LnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITAsYT0wKTt1LnRpbWVyQ291bnRlcj1hfWZ1bmN0aW9uIGdjKGEsYyl7dmFyIGI9SmIodS50aW1lcklucHV0Q2xvY2spO3JldHVybiBwKGIsYSkmJiFwKGIsYyl9ZnVuY3Rpb24gSmIoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gOTtjYXNlIDE6cmV0dXJuIDM7Y2FzZSAyOnJldHVybiA1O2Nhc2UgMzpyZXR1cm4gN31yZXR1cm4gMH1mdW5jdGlvbiBVYShhKXt2YXIgYz1iLmlzU3RvcHBlZD0hMTtBYyhhKXx8KGM9ITApO0phKGEsITApO2MmJihjPSExLDM+PWEmJihjPSEwKSxhPSExLEEuaXNEcGFkVHlwZSYmYyYmKGE9ITApLEEuaXNCdXR0b25UeXBlJiYhYyYmKGE9CiEwKSxhJiYobS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD0hMCxiYihtLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSkpfWZ1bmN0aW9uIEFjKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIEEudXA7Y2FzZSAxOnJldHVybiBBLnJpZ2h0O2Nhc2UgMjpyZXR1cm4gQS5kb3duO2Nhc2UgMzpyZXR1cm4gQS5sZWZ0O2Nhc2UgNDpyZXR1cm4gQS5hO2Nhc2UgNTpyZXR1cm4gQS5iO2Nhc2UgNjpyZXR1cm4gQS5zZWxlY3Q7Y2FzZSA3OnJldHVybiBBLnN0YXJ0O2RlZmF1bHQ6cmV0dXJuITF9fWZ1bmN0aW9uIEphKGEsYyl7c3dpdGNoKGEpe2Nhc2UgMDpBLnVwPWM7YnJlYWs7Y2FzZSAxOkEucmlnaHQ9YzticmVhaztjYXNlIDI6QS5kb3duPWM7YnJlYWs7Y2FzZSAzOkEubGVmdD1jO2JyZWFrO2Nhc2UgNDpBLmE9YzticmVhaztjYXNlIDU6QS5iPWM7YnJlYWs7Y2FzZSA2OkEuc2VsZWN0PWM7YnJlYWs7Y2FzZSA3OkEuc3RhcnQ9Y319ZnVuY3Rpb24gaGMoYSxjLGQpe2Zvcih2YXIgUD0KMDtQPGQ7KytQKXtmb3IodmFyIGY9S2IoYStQKSxlPWMrUDs0MDk1OTxlOyllLT04MTkyO2ljKGUsZil9Zy5ETUFDeWNsZXMrPSgzMjw8Yi5HQkNEb3VibGVTcGVlZCkqKGQ+PjQpfWZ1bmN0aW9uIExiKGEsYyl7aWYoYT09PWIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaClyZXR1cm4gaChiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gsYyYxKSwhMTt2YXIgZD1nLnZpZGVvUmFtTG9jYXRpb24sQj1nLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbjtpZihhPGQpe2lmKCFnLmlzUm9tT25seSl7ZD1nLmlzTUJDMTt2YXIgZj1nLmlzTUJDMjtpZig4MTkxPj1hKXtpZighZnx8cCg0LGMpKWMmPTE1LDA9PT1jP2cuaXNSYW1CYW5raW5nRW5hYmxlZD0hMToxMD09PWMmJihnLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITApfWVsc2UgMTYzODM+PWE/KEI9Zy5pc01CQzUsIUJ8fDEyMjg3Pj1hPyhhPWcuY3VycmVudFJvbUJhbmssZiYmKGE9YyYxNSksZD8oYyY9MzEsYSY9MjI0KTpnLmlzTUJDMz8KKGMmPTEyNyxhJj0xMjgpOkImJihhJj0wKSxnLmN1cnJlbnRSb21CYW5rPWF8Yyk6Zy5jdXJyZW50Um9tQmFuaz1uKDA8YyxnLmN1cnJlbnRSb21CYW5rJjI1NSkpOiFmJiYyNDU3NT49YT9kJiZnLmlzTUJDMVJvbU1vZGVFbmFibGVkPyhhPWcuY3VycmVudFJvbUJhbmsmMzEsZy5jdXJyZW50Um9tQmFuaz1hfGMmMjI0KTooYz1nLmlzTUJDNT9jJjE1OmMmMyxnLmN1cnJlbnRSYW1CYW5rPWMpOiFmJiYzMjc2Nz49YSYmZCYmKGcuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9cCgwLGMpKX1yZXR1cm4hMX1pZihhPj1kJiZhPGcuY2FydHJpZGdlUmFtTG9jYXRpb24pcmV0dXJuITA7aWYoYT49Zy5lY2hvUmFtTG9jYXRpb24mJmE8QilyZXR1cm4gaChhLTgxOTIsYyksITA7aWYoYT49QiYmYTw9Zy5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQpcmV0dXJuIDI8PXkuY3VycmVudExjZE1vZGU7aWYoYT49Zy51bnVzYWJsZU1lbW9yeUxvY2F0aW9uJiZhPD1nLnVudXNhYmxlTWVtb3J5RW5kTG9jYXRpb24pcmV0dXJuITE7CmlmKGE9PT1aLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sKXJldHVybiBaLnVwZGF0ZVRyYW5zZmVyQ29udHJvbChjKTtpZig2NTI5Njw9YSYmNjUzMTg+PWEpe3RiKCk7aWYoYT09PWsubWVtb3J5TG9jYXRpb25OUjUyfHxrLk5SNTJJc1NvdW5kRW5hYmxlZCl7c3dpdGNoKGEpe2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDA6ei51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2UgSi5tZW1vcnlMb2NhdGlvbk5SeDA6Si51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDE6ei51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgTi5tZW1vcnlMb2NhdGlvbk5SeDE6Ti51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgSi5tZW1vcnlMb2NhdGlvbk5SeDE6Si51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgTy5tZW1vcnlMb2NhdGlvbk5SeDE6Ty51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDI6ei51cGRhdGVOUngyKGMpO2JyZWFrOwpjYXNlIE4ubWVtb3J5TG9jYXRpb25OUngyOk4udXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEoubWVtb3J5TG9jYXRpb25OUngyOkoudm9sdW1lQ29kZUNoYW5nZWQ9ITA7Si51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgTy5tZW1vcnlMb2NhdGlvbk5SeDI6Ty51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDM6ei51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgTi5tZW1vcnlMb2NhdGlvbk5SeDM6Ti51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgSi5tZW1vcnlMb2NhdGlvbk5SeDM6Si51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgTy5tZW1vcnlMb2NhdGlvbk5SeDM6Ty51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2Ugei5tZW1vcnlMb2NhdGlvbk5SeDQ6cCg3LGMpJiYoei51cGRhdGVOUng0KGMpLHoudHJpZ2dlcigpKTticmVhaztjYXNlIE4ubWVtb3J5TG9jYXRpb25OUng0OnAoNyxjKSYmKE4udXBkYXRlTlJ4NChjKSxOLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBKLm1lbW9yeUxvY2F0aW9uTlJ4NDpwKDcsCmMpJiYoSi51cGRhdGVOUng0KGMpLEoudHJpZ2dlcigpKTticmVhaztjYXNlIE8ubWVtb3J5TG9jYXRpb25OUng0OnAoNyxjKSYmKE8udXBkYXRlTlJ4NChjKSxPLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBrLm1lbW9yeUxvY2F0aW9uTlI1MDprLnVwZGF0ZU5SNTAoYyk7cS5taXhlclZvbHVtZUNoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBrLm1lbW9yeUxvY2F0aW9uTlI1MTprLnVwZGF0ZU5SNTEoYyk7cS5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO2JyZWFrO2Nhc2Ugay5tZW1vcnlMb2NhdGlvbk5SNTI6aWYoay51cGRhdGVOUjUyKGMpLCFwKDcsYykpZm9yKGM9NjUyOTY7NjUzMTg+YzsrK2MpaChjLDApfWM9ITB9ZWxzZSBjPSExO3JldHVybiBjfTY1MzI4PD1hJiY2NTM0Mz49YSYmdGIoKTtpZihhPj15Lm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbCYmYTw9ci5tZW1vcnlMb2NhdGlvbldpbmRvd1gpe2lmKGE9PT15Lm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbClyZXR1cm4geS51cGRhdGVMY2RDb250cm9sKGMpLAohMDtpZihhPT09eS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cylyZXR1cm4geS51cGRhdGVMY2RTdGF0dXMoYyksITE7aWYoYT09PXIubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyKXJldHVybiByLnNjYW5saW5lUmVnaXN0ZXI9MCxoKGEsMCksITE7aWYoYT09PXkubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmUpcmV0dXJuIHkuY29pbmNpZGVuY2VDb21wYXJlPWMsITA7aWYoYT09PXIubWVtb3J5TG9jYXRpb25EbWFUcmFuc2Zlcil7Yzw8PTg7Zm9yKGE9MDsxNTk+PWE7KythKWQ9dyhjK2EpLGgoZy5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24rYSxkKTtnLkRNQUN5Y2xlcz02NDQ7cmV0dXJuITB9c3dpdGNoKGEpe2Nhc2Ugci5tZW1vcnlMb2NhdGlvblNjcm9sbFg6ci5zY3JvbGxYPWM7YnJlYWs7Y2FzZSByLm1lbW9yeUxvY2F0aW9uU2Nyb2xsWTpyLnNjcm9sbFk9YzticmVhaztjYXNlIHIubWVtb3J5TG9jYXRpb25XaW5kb3dYOnIud2luZG93WD1jO2JyZWFrOwpjYXNlIHIubWVtb3J5TG9jYXRpb25XaW5kb3dZOnIud2luZG93WT1jfXJldHVybiEwfWlmKGE9PT1nLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpcmV0dXJuIGIuR0JDRW5hYmxlZCYmKGcuaXNIYmxhbmtIZG1hQWN0aXZlJiYhcCg3LGMpPyhnLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMSxjPXcoZy5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyKSxoKGcubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixjfDEyOCkpOihhPXcoZy5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoKSxkPXcoZy5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VMb3cpLGE9bihhLGQpJjY1NTIwLGQ9dyhnLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaCksQj13KGcubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25Mb3cpLGQ9bihkLEIpLGQ9KGQmODE3NikrZy52aWRlb1JhbUxvY2F0aW9uLEI9SCg3LGMpLEI9QisxPDw0LHAoNyxjKT8oZy5pc0hibGFua0hkbWFBY3RpdmU9ITAsZy5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc9CkIsZy5oYmxhbmtIZG1hU291cmNlPWEsZy5oYmxhbmtIZG1hRGVzdGluYXRpb249ZCxoKGcubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixIKDcsYykpKTooaGMoYSxkLEIpLGgoZy5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLDI1NSkpKSksITE7aWYoKGE9PT1nLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmt8fGE9PT1nLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbmspJiZnLmlzSGJsYW5rSGRtYUFjdGl2ZSYmKGQ9Zy5oYmxhbmtIZG1hU291cmNlLDE2Mzg0PD1kJiYzMjc2Nz49ZHx8NTMyNDg8PWQmJjU3MzQzPj1kKSlyZXR1cm4hMTtpZihhPj1YYS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXgmJmE8PVhhLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZURhdGEpe2Q9WGEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YTtpZihhPT09WGEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZURhdGF8fGE9PT1kKUI9dyhhLTEpLEI9SCg2LEIpLGY9QiYKNjMsYT09PWQmJihmKz02NCksZVtZYStmXT1jLGM9QiwtLWEscCg3LGMpJiZoKGEsYysxfDEyOCk7cmV0dXJuITB9aWYoYT49dS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlciYmYTw9dS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbCl7SGIodS5jdXJyZW50Q3ljbGVzKTt1LmN1cnJlbnRDeWNsZXM9MDtzd2l0Y2goYSl7Y2FzZSB1Lm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyOnJldHVybiB1LnVwZGF0ZURpdmlkZXJSZWdpc3RlcigpLCExO2Nhc2UgdS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcjp1LnVwZGF0ZVRpbWVyQ291bnRlcihjKTticmVhaztjYXNlIHUubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbzp1LnVwZGF0ZVRpbWVyTW9kdWxvKGMpO2JyZWFrO2Nhc2UgdS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbDp1LnVwZGF0ZVRpbWVyQ29udHJvbChjKX1yZXR1cm4hMH1hPT09QS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyJiZBLnVwZGF0ZUpveXBhZChjKTsKaWYoYT09PW0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KXJldHVybiBtLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZChjKSwhMDthPT09bS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQmJm0udXBkYXRlSW50ZXJydXB0RW5hYmxlZChjKTtyZXR1cm4hMH1mdW5jdGlvbiBNYihhKXtzd2l0Y2goYT4+MTIpe2Nhc2UgMDpjYXNlIDE6Y2FzZSAyOmNhc2UgMzpyZXR1cm4gYSt3YjtjYXNlIDQ6Y2FzZSA1OmNhc2UgNjpjYXNlIDc6dmFyIGM9Zy5jdXJyZW50Um9tQmFuaztnLmlzTUJDNXx8MCE9PWN8fChjPTEpO3JldHVybiAxNjM4NCpjKyhhLWcuc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uKSt3YjtjYXNlIDg6Y2FzZSA5OnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz13KGcubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmMSksYS1nLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKmM7Y2FzZSAxMDpjYXNlIDExOnJldHVybiA4MTkyKmcuY3VycmVudFJhbUJhbmsrCihhLWcuY2FydHJpZGdlUmFtTG9jYXRpb24pK05iO2Nhc2UgMTI6cmV0dXJuIGEtZy5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzI7Y2FzZSAxMzpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9dyhnLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmspJjcpLGEtZy5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzIrNDA5NiooKDE+Yz8xOmMpLTEpO2RlZmF1bHQ6cmV0dXJuIGEtZy5lY2hvUmFtTG9jYXRpb24rNTEyMDB9fWZ1bmN0aW9uIGgoYSxjKXthPU1iKGEpO2VbYV09Y31mdW5jdGlvbiBpYyhhLGMpe2E9PT1hYS53cml0ZUdiTWVtb3J5JiYoYWEucmVhY2hlZEJyZWFrcG9pbnQ9ITApO0xiKGEsYykmJmgoYSxjKX1mdW5jdGlvbiBqYyhhKXtyLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7ci5zY2FubGluZVJlZ2lzdGVyPTA7aChyLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlciwwKTt2YXIgYz13KHkubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO2M9SCgxLApjKTtjPUgoMCxjKTt5LmN1cnJlbnRMY2RNb2RlPTA7aCh5Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGMpO2lmKGEpZm9yKGE9MDs5MzE4ND5hOysrYSllW2NiK2FdPTI1NX1mdW5jdGlvbiBrYyhhLGMpezAhPT1hJiYxIT09YXx8ci5zY2FubGluZVJlZ2lzdGVyIT09eS5jb2luY2lkZW5jZUNvbXBhcmU/Yz1IKDIsYyk6KGN8PTQscCg2LGMpJiYobS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCxiYihtLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSkpO3JldHVybiBjfWZ1bmN0aW9uIGxjKGEsYyxkLEIsZixoKXtmb3IodmFyIFA9Qj4+MzsxNjA+ZjsrK2Ype3ZhciBnPWYraDsyNTY8PWcmJihnLT0yNTYpO3ZhciBDPWQrKFA8PDUpKyhnPj4zKSxrPVgoQywwKSxtPSExO2lmKFMudGlsZUNhY2hpbmcpe3ZhciBsPWY7dmFyIG49YSx1PWcsaWE9Qyx2PWsscT0wLHQ9ZGIubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s7aWYoMDxuJiY4PGwmJnY9PT1kYi50aWxlSWQmJmw9PT10KXt2PQpwKDUsdyhpYS0xKSk7aWE9cCg1LHcoaWEpKTtmb3IodmFyIHk9MDs4Pnk7Kyt5KXt2IT09aWEmJih5PTcteSk7dmFyIHg9bCt5O2lmKDE2MD49eCl7dmFyIHo9bC0oOC15KSxBPWNiKzMqKDE2MCpuK3gpO2NhKHgsbiwwLGVbQV0pO2NhKHgsbiwxLGVbQV0pO2NhKHgsbiwyLGVbQV0pO3o9ZVtaYSsoMTYwKm4reildO3JiKHgsbixIKDIseikscCgyLHopKTtxKyt9fX1lbHNlIGRiLnRpbGVJZD12O2w+PXQmJih0PWwrOCxuPXUmN3wwLGw8biYmKHQrPW4pKTtkYi5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz10O2w9cTswPGwmJihmKz1sLTEsbT0hMCl9Uy50aWxlUmVuZGVyaW5nJiYhbT8obT1mLGw9YSxuPWcsZz1jLHE9QiY3fDAsdD0wLDA9PW0mJih0PW4tKG4+PjM8PDMpKSxuPTcsMTYwPG0rOCYmKG49MTYwLW0pLHU9LTEsdj0wLGIuR0JDRW5hYmxlZCYmKHU9WChDLDEpLHY9cCgzLHUpfDAscCg2LHUpJiYocT03LXEpKSxsPUNiKGssZyx2LHQsbixxLG0sbCwxNjAsY2IsITEsCjAsdSwtMSksMDxsJiYoZis9bC0xKSk6bXx8KGIuR0JDRW5hYmxlZD8obT1mLGw9YSx0PUIscT1nYihjLGspLGs9WChDLDEpLHQ9dCY3fDAscCg2LGspJiYodD03LXQpLG49cCgzLGspfDAsQz1YKHErMip0LG4pLHE9WChxKzIqdCsxLG4pLHQ9ZyY3fDAscCg1LGspfHwodD03LXQpLGc9MCxwKHQscSkmJihnPWcrMTw8MSkscCh0LEMpJiYoZys9MSksdD1xYihrJjcsZywhMSksQz12YSgwLHQpLHE9dmEoMSx0KSx0PXZhKDIsdCksY2EobSxsLDAsQyksY2EobSxsLDEscSksY2EobSxsLDIsdCkscmIobSxsLGcscCg3LGspKSk6KEM9ZixtPWEscT1CLGw9Z2IoYyxrKSxxPXEmN3wwLGs9WChsKzIqcSwwKSxsPVgobCsyKnErMSwwKSxxPWcmN3wwLHE9Ny1xLGc9MCxwKHEsbCkmJihnPWcrMTw8MSkscChxLGspJiYoZys9MSksaz1wYihnLHIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksY2EoQyxtLDAsKGsmMTY3MTE2ODApPj4xNiksY2EoQyxtLDEsKGsmNjUyODApPj44KSxjYShDLAptLDIsayYyNTUpLHJiKEMsbSxnKSkpfX1mdW5jdGlvbiBtYyhhKXtpZih5LmVuYWJsZWQpZm9yKHIuc2NhbmxpbmVDeWNsZUNvdW50ZXIrPWEsYT1TLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nO3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI+PXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTspe3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXItPXIuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKTt2YXIgYz1yLnNjYW5saW5lUmVnaXN0ZXI7aWYoMTQ0PT09Yyl7aWYoYSlmb3IodmFyIGI9MDsxNDQ+PWI7KytiKU9iKGIpO2Vsc2UgT2IoYyk7Zm9yKGI9MDsxNDQ+YjsrK2IpZm9yKHZhciBkPTA7MTYwPmQ7KytkKWVbWmErKDE2MCpiK2QpXT0wO2RiLnRpbGVJZD0tMTtkYi5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0tMX1lbHNlIDE0ND5jJiYoYXx8T2IoYykpO2M9MTUzPGM/MDpjKzE7ci5zY2FubGluZVJlZ2lzdGVyPWN9aWYoeS5lbmFibGVkKXtjPXIuc2NhbmxpbmVSZWdpc3RlcjsKYj15LmN1cnJlbnRMY2RNb2RlO2E9MDtpZigxNDQ8PWMpYT0xO2Vsc2V7ZD1yLnNjYW5saW5lQ3ljbGVDb3VudGVyO3ZhciBmPXIuTUlOX0NZQ0xFU19TUFJJVEVTX0xDRF9NT0RFKCk7ZD49Zj9hPTI6ZD49ZiYmKGE9Myl9aWYoYiE9PWEpe2M9dyh5Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTt5LmN1cnJlbnRMY2RNb2RlPWE7Yj0hMTtzd2l0Y2goYSl7Y2FzZSAwOmM9SCgwLGMpO2M9SCgxLGMpO2I9cCgzLGMpO2JyZWFrO2Nhc2UgMTpjPUgoMSxjKTtjfD0xO2I9cCg0LGMpO2JyZWFrO2Nhc2UgMjpjPUgoMCxjKTtjfD0yO2I9cCg1LGMpO2JyZWFrO2Nhc2UgMzpjfD0zfWImJihtLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpKTswPT09YSYmZy5pc0hibGFua0hkbWFBY3RpdmUmJihkPTE2LGI9Zy5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmcsYjxkJiYoZD1iKSxoYyhnLmhibGFua0hkbWFTb3VyY2UsZy5oYmxhbmtIZG1hRGVzdGluYXRpb24sCmQpLGcuaGJsYW5rSGRtYVNvdXJjZSs9ZCxnLmhibGFua0hkbWFEZXN0aW5hdGlvbis9ZCxiLT1kLGcuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPWIsZD1nLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMD49Yj8oZy5pc0hibGFua0hkbWFBY3RpdmU9ITEsaChkLDI1NSkpOmgoZCxIKDcsKGI+PjQpLTEpKSk7MT09PWEmJihtLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPSEwLGJiKG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpKTtjPWtjKGEsYyk7aCh5Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGMpfWVsc2UgMTUzPT09YyYmKGM9dyh5Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKSxjPWtjKGEsYyksaCh5Lm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGMpKX19ZnVuY3Rpb24gT2IoYSl7dmFyIGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0O3kuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdCYmKGM9ci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQpOwppZihiLkdCQ0VuYWJsZWR8fHkuYmdEaXNwbGF5RW5hYmxlZCl7dmFyIGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7eS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTtsYyhhLGMsZCxhK3Iuc2Nyb2xsWSYyNTUsMCxyLnNjcm9sbFgpfWlmKHkud2luZG93RGlzcGxheUVuYWJsZWQpe2Q9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7eS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7dmFyIEI9ci53aW5kb3dYLGY9ci53aW5kb3dZO2E8Znx8KEItPTcsbGMoYSxjLGQsYS1mLEIsLUJ8MCkpfWlmKHkuc3ByaXRlRGlzcGxheUVuYWJsZSlmb3IoYz15LnRhbGxTcHJpdGVTaXplLGQ9Mzk7MDw9ZDstLWQpe2Y9NCpkO3ZhciBnPXIubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrCmYsaD13KGcrMCk7Qj13KGcrMSk7dmFyIGs9dyhnKzIpO2gtPTE2O0ItPTg7dmFyIGw9ODtjJiYobD0xNixrLT1rJjEpO2lmKGE+PWgmJmE8aCtsKXtmPXcoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStmKzMpO2c9cCg3LGYpO3ZhciBtPXAoNixmKSxuPXAoNSxmKTtoPWEtaDttJiYoaD1sLWgsLS1oKTtoPDw9MTtrPWdiKHIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0LGspO2srPWg7bD1iLkdCQ0VuYWJsZWQmJnAoMyxmKTtoPVgoayswLGwpO2s9WChrKzEsbCk7Zm9yKGw9NzswPD1sOy0tbCl7bT1sO24mJihtLT03LG09LW0pO3ZhciBxPTA7cChtLGspJiYocT1xKzE8PDEpO3AobSxoKSYmKHErPTEpO2lmKDAhPT1xJiYobT1CKyg3LWwpLDA8PW0mJjE2MD49bSkpe3ZhciB0PWIuR0JDRW5hYmxlZCYmIXkuYmdEaXNwbGF5RW5hYmxlZCx1PSExLHY9ITE7aWYoIXQpe3ZhciB4PWVbWmErKDE2MCphK20pXSx6PXgmMztnJiYwPHo/dT0hMDpiLkdCQ0VuYWJsZWQmJgpwKDIseCkmJjA8eiYmKHY9ITApfWlmKHR8fCF1JiYhdiliLkdCQ0VuYWJsZWQ/KHU9cWIoZiY3LHEsITApLHE9dmEoMCx1KSx0PXZhKDEsdSksdT12YSgyLHUpLGNhKG0sYSwwLHEpLGNhKG0sYSwxLHQpLGNhKG0sYSwyLHUpKToodD1yLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSxwKDQsZikmJih0PXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKSxxPXBiKHEsdCksY2EobSxhLDAsKHEmMTY3MTE2ODApPj4xNiksY2EobSxhLDEsKHEmNjUyODApPj44KSxjYShtLGEsMixxJjI1NSkpfX19fX1mdW5jdGlvbiBjYShhLGMsYixkKXtlW2NiKzMqKDE2MCpjK2EpK2JdPWR9ZnVuY3Rpb24gWChhLGMpe3JldHVybiBlW2EtZy52aWRlb1JhbUxvY2F0aW9uKzIwNDgrODE5MiooYyYxKV19ZnVuY3Rpb24gUGIoYSl7dmFyIGM9Zy52aWRlb1JhbUxvY2F0aW9uO3JldHVybiBhPGN8fGE+PWMmJmE8Zy5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbj8tMTphPj1nLmVjaG9SYW1Mb2NhdGlvbiYmCmE8Zy5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb24/dyhhLTgxOTIpOmE+PWcuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uJiZhPD1nLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD8yPnkuY3VycmVudExjZE1vZGU/MjU1Oi0xOmE9PT1iLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2g/KGE9MjU1LGM9dyhiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLHAoMCxjKXx8KGE9SCgwLGEpKSxiLkdCQ0RvdWJsZVNwZWVkfHwoYT1IKDcsYSkpLGEpOmE9PT1yLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj8oaChhLHIuc2NhbmxpbmVSZWdpc3Rlciksci5zY2FubGluZVJlZ2lzdGVyKTo2NTI5Njw9YSYmNjUzMTg+PWE/KHRiKCksYT1hPT09ay5tZW1vcnlMb2NhdGlvbk5SNTI/dyhrLm1lbW9yeUxvY2F0aW9uTlI1MikmMTI4fDExMjotMSxhKTo2NTMyODw9YSYmNjUzNDM+PWE/KHRiKCksLTEpOmE9PT11Lm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPwooYz1FKHUuZGl2aWRlclJlZ2lzdGVyKSxoKGEsYyksYyk6YT09PXUubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI/KGgoYSx1LnRpbWVyQ291bnRlciksdS50aW1lckNvdW50ZXIpOmE9PT1tLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdD8yMjR8bS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU6YT09PUEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3Rlcj8oYT1BLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCxBLmlzRHBhZFR5cGU/KGE9QS51cD9IKDIsYSk6YXw0LGE9QS5yaWdodD9IKDAsYSk6YXwxLGE9QS5kb3duP0goMyxhKTphfDgsYT1BLmxlZnQ/SCgxLGEpOmF8Mik6QS5pc0J1dHRvblR5cGUmJihhPUEuYT9IKDAsYSk6YXwxLGE9QS5iP0goMSxhKTphfDIsYT1BLnNlbGVjdD9IKDIsYSk6YXw0LGE9QS5zdGFydD9IKDMsYSk6YXw4KSxhfDI0MCk6LTF9ZnVuY3Rpb24gdyhhKXtyZXR1cm4gZVtNYihhKV19ZnVuY3Rpb24gS2IoYSl7YT09PWFhLnJlYWRHYk1lbW9yeSYmKGFhLnJlYWNoZWRCcmVha3BvaW50PQohMCk7dmFyIGM9UGIoYSk7cmV0dXJuLTE9PT1jP3coYSk6Y31mdW5jdGlvbiBRKGEpe3JldHVybiAwPGVbYV19ZnVuY3Rpb24gS2EoYSl7dmFyIGM9Yi5yZWdpc3RlckE7UihjLGEpO0JiKGMsYSk7Yz1jK2EmMjU1O2IucmVnaXN0ZXJBPWM7dCgwPT09Yyk7digwKX1mdW5jdGlvbiBMYShhKXt2YXIgYz1iLnJlZ2lzdGVyQSxkPWMrYStVKCkmMjU1O0coMCE9KChjXmFeZCkmMTYpKTthPWMrYStVKCkmNjU1MzU7SygwPChhJjI1NikpO2IucmVnaXN0ZXJBPWQ7dCgwPT09ZCk7digwKX1mdW5jdGlvbiBNYShhKXt2YXIgYz0tMSphO3ZhciBkPWIucmVnaXN0ZXJBO1IoZCxjKTtCYihkLGMpO2Q9ZC1hJjI1NTtiLnJlZ2lzdGVyQT1kO3QoMD09PWQpO3YoMSl9ZnVuY3Rpb24gTmEoYSl7dmFyIGM9Yi5yZWdpc3RlckEsZD1jLWEtVSgpJjI1NTtHKDAhPSgoY15hXmQpJjE2KSk7YT1jLWEtVSgpJjY1NTM1O0soMDwoYSYyNTYpKTtiLnJlZ2lzdGVyQT1kO3QoMD09PWQpO3YoMSl9ZnVuY3Rpb24gT2EoYSl7YSY9CmIucmVnaXN0ZXJBO2IucmVnaXN0ZXJBPWE7dCgwPT09YSk7digwKTtHKDEpO0soMCl9ZnVuY3Rpb24gUGEoYSl7YT0oYi5yZWdpc3RlckFeYSkmMjU1O2IucmVnaXN0ZXJBPWE7dCgwPT09YSk7digwKTtHKDApO0soMCl9ZnVuY3Rpb24gUWEoYSl7YXw9Yi5yZWdpc3RlckE7Yi5yZWdpc3RlckE9YTt0KDA9PT1hKTt2KDApO0coMCk7SygwKX1mdW5jdGlvbiBSYShhKXt2YXIgYz1iLnJlZ2lzdGVyQTthKj0tMTtSKGMsYSk7QmIoYyxhKTt0KDA9PT1jK2EpO3YoMSl9ZnVuY3Rpb24gVmEoYSxjKXt0KDA9PT0oYyYxPDxhKSk7digwKTtHKDEpO3JldHVybiBjfWZ1bmN0aW9uIGJhKGEsYyxiKXtyZXR1cm4gMDxjP2J8MTw8YTpiJn4oMTw8YSl9ZnVuY3Rpb24gaWIoYSl7dmFyIGM9Yi5wcm9ncmFtQ291bnRlcjtjPShjKyhhPDwyND4+MjQpJjY1NTM1KSsxJjY1NTM1O2IucHJvZ3JhbUNvdW50ZXI9Y31mdW5jdGlvbiBuYyhhKXt2YXIgYz1iLnByb2dyYW1Db3VudGVyO2M9YysxJjY1NTM1OwpiLmlzSGFsdEJ1ZyYmKGM9Yy0xJjY1NTM1KTtiLnByb2dyYW1Db3VudGVyPWM7c3dpdGNoKChhJjI0MCk+PjQpe2Nhc2UgMDpyZXR1cm4gQmMoYSk7Y2FzZSAxOnJldHVybiBDYyhhKTtjYXNlIDI6cmV0dXJuIERjKGEpO2Nhc2UgMzpyZXR1cm4gRWMoYSk7Y2FzZSA0OnJldHVybiBGYyhhKTtjYXNlIDU6cmV0dXJuIEdjKGEpO2Nhc2UgNjpyZXR1cm4gSGMoYSk7Y2FzZSA3OnJldHVybiBJYyhhKTtjYXNlIDg6cmV0dXJuIEpjKGEpO2Nhc2UgOTpyZXR1cm4gS2MoYSk7Y2FzZSAxMDpyZXR1cm4gTGMoYSk7Y2FzZSAxMTpyZXR1cm4gTWMoYSk7Y2FzZSAxMjpyZXR1cm4gTmMoYSk7Y2FzZSAxMzpyZXR1cm4gT2MoYSk7Y2FzZSAxNDpyZXR1cm4gUGMoYSk7ZGVmYXVsdDpyZXR1cm4gUWMoYSl9fWZ1bmN0aW9uIEkoYSl7U2EoNCk7cmV0dXJuIEtiKGEpfWZ1bmN0aW9uIFQoYSxjKXtTYSg0KTtpYyhhLGMpfWZ1bmN0aW9uIElhKGEpe1NhKDgpO3ZhciBjPVBiKGEpO2M9LTE9PT1jP3coYSk6CmM7YSs9MTt2YXIgYj1QYihhKTthPS0xPT09Yj93KGEpOmI7cmV0dXJuIG4oYSxjKX1mdW5jdGlvbiBWKGEsYyl7U2EoOCk7dmFyIGI9RShjKTtjJj0yNTU7TGIoYSxjKSYmaChhLGMpO2ErPTE7TGIoYSxiKSYmaChhLGIpfWZ1bmN0aW9uIEYoKXtTYSg0KTtyZXR1cm4gdyhiLnByb2dyYW1Db3VudGVyKX1mdW5jdGlvbiBZKCl7U2EoNCk7dmFyIGE9dyhiLnByb2dyYW1Db3VudGVyKzEmNjU1MzUpO3JldHVybiBuKGEsRigpKX1mdW5jdGlvbiBCYyhhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiA0O2Nhc2UgMTpyZXR1cm4gYT1ZKCksYi5yZWdpc3RlckI9RShhKSxiLnJlZ2lzdGVyQz1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjpyZXR1cm4gVChuKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxiLnJlZ2lzdGVyQSksNDtjYXNlIDM6cmV0dXJuIGE9bihiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYSsrLGIucmVnaXN0ZXJCPUUoYSksCmIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSA0OnJldHVybiBhPWIucmVnaXN0ZXJCLFIoYSwxKSxhPWErMSYyNTUsYi5yZWdpc3RlckI9YSx0KDA9PT1hKSx2KDApLDQ7Y2FzZSA1OnJldHVybiBhPWIucmVnaXN0ZXJCLFIoYSwtMSksYT1hLTEmMjU1LGIucmVnaXN0ZXJCPWEsdCgwPT09YSksdigxKSw0O2Nhc2UgNjpyZXR1cm4gYi5yZWdpc3RlckI9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA3OnJldHVybiBhPWIucmVnaXN0ZXJBLEsoMTI4PT09KGEmMTI4KSksYi5yZWdpc3RlckE9KGE8PDF8YT4+NykmMjU1LHQoMCksdigwKSxHKDApLDQ7Y2FzZSA4OnJldHVybiBWKFkoKSxiLnN0YWNrUG9pbnRlciksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDk6YT1uKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKTt2YXIgYz1uKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKTtXYShhLGMsITEpO2E9YStjJgo2NTUzNTtiLnJlZ2lzdGVySD1FKGEpO2IucmVnaXN0ZXJMPWEmMjU1O3YoMCk7cmV0dXJuIDg7Y2FzZSAxMDpyZXR1cm4gYi5yZWdpc3RlckE9SShuKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSksNDtjYXNlIDExOnJldHVybiBhPW4oYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJCPUUoYSksYi5yZWdpc3RlckM9YSYyNTUsODtjYXNlIDEyOnJldHVybiBhPWIucmVnaXN0ZXJDLFIoYSwxKSxhPWErMSYyNTUsYi5yZWdpc3RlckM9YSx0KDA9PT1hKSx2KDApLDQ7Y2FzZSAxMzpyZXR1cm4gYT1iLnJlZ2lzdGVyQyxSKGEsLTEpLGE9YS0xJjI1NSxiLnJlZ2lzdGVyQz1hLHQoMD09PWEpLHYoMSksNDtjYXNlIDE0OnJldHVybiBiLnJlZ2lzdGVyQz1GKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDE1OnJldHVybiBhPWIucmVnaXN0ZXJBLEsoMDwoYSYxKSksYi5yZWdpc3RlckE9KGE+PjF8YTw8NykmMjU1LAp0KDApLHYoMCksRygwKSw0fXJldHVybi0xfWZ1bmN0aW9uIENjKGEpe3N3aXRjaChhKXtjYXNlIDE2OmlmKGIuR0JDRW5hYmxlZCYmKGE9SShiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLHAoMCxhKSkpcmV0dXJuIGE9SCgwLGEpLHAoNyxhKT8oYi5HQkNEb3VibGVTcGVlZD0hMSxhPUgoNyxhKSk6KGIuR0JDRG91YmxlU3BlZWQ9ITAsYXw9MTI4KSxUKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCxhKSw2ODtiLmlzU3RvcHBlZD0hMDtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtyZXR1cm4gNDtjYXNlIDE3OnJldHVybiBhPVkoKSxiLnJlZ2lzdGVyRD1FKGEpLGIucmVnaXN0ZXJFPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAxODpyZXR1cm4gVChuKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQSksNDtjYXNlIDE5OnJldHVybiBhPW4oYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLAphPWErMSY2NTUzNSxiLnJlZ2lzdGVyRD1FKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyMDpyZXR1cm4gYT1iLnJlZ2lzdGVyRCxSKGEsMSksYi5yZWdpc3RlckQ9YSsxJjI1NSx0KDA9PT1iLnJlZ2lzdGVyRCksdigwKSw0O2Nhc2UgMjE6cmV0dXJuIGE9Yi5yZWdpc3RlckQsUihhLC0xKSxiLnJlZ2lzdGVyRD1hLTEmMjU1LHQoMD09PWIucmVnaXN0ZXJEKSx2KDEpLDQ7Y2FzZSAyMjpyZXR1cm4gYi5yZWdpc3RlckQ9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMzpyZXR1cm4gYT0xMjg9PT0oYi5yZWdpc3RlckEmMTI4KSxiLnJlZ2lzdGVyQT0oYi5yZWdpc3RlckE8PDF8VSgpKSYyNTUsSyhhKSx0KDApLHYoMCksRygwKSw0O2Nhc2UgMjQ6cmV0dXJuIGliKEYoKSksODtjYXNlIDI1OmE9bihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9bihiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSk7V2EoYSxjLCExKTthPWErYyYKNjU1MzU7Yi5yZWdpc3Rlckg9RShhKTtiLnJlZ2lzdGVyTD1hJjI1NTt2KDApO3JldHVybiA4O2Nhc2UgMjY6cmV0dXJuIGE9bihiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYi5yZWdpc3RlckE9SShhKSw0O2Nhc2UgMjc6cmV0dXJuIGE9bihiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYT1hLTEmNjU1MzUsYi5yZWdpc3RlckQ9RShhKSxiLnJlZ2lzdGVyRT1hJjI1NSw4O2Nhc2UgMjg6cmV0dXJuIGE9Yi5yZWdpc3RlckUsUihhLDEpLGE9YSsxJjI1NSxiLnJlZ2lzdGVyRT1hLHQoMD09PWEpLHYoMCksNDtjYXNlIDI5OnJldHVybiBhPWIucmVnaXN0ZXJFLFIoYSwtMSksYT1hLTEmMjU1LGIucmVnaXN0ZXJFPWEsdCgwPT09YSksdigxKSw0O2Nhc2UgMzA6cmV0dXJuIGIucmVnaXN0ZXJFPUYoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMzE6cmV0dXJuIGE9MT09PShiLnJlZ2lzdGVyQSYxKSxiLnJlZ2lzdGVyQT0oYi5yZWdpc3RlckE+PgoxfFUoKTw8NykmMjU1LEsoYSksdCgwKSx2KDApLEcoMCksNH1yZXR1cm4tMX1mdW5jdGlvbiBEYyhhKXtzd2l0Y2goYSl7Y2FzZSAzMjpyZXR1cm4gMD09PVRhKCk/aWIoRigpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMzM6cmV0dXJuIGE9WSgpLGIucmVnaXN0ZXJIPUUoYSksYi5yZWdpc3Rlckw9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDM0OnJldHVybiBhPW4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFQoYSxiLnJlZ2lzdGVyQSksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgMzU6cmV0dXJuIGE9bihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSw4O2Nhc2UgMzY6cmV0dXJuIGE9Yi5yZWdpc3RlckgsUihhLDEpLGE9YSsxJjI1NSxiLnJlZ2lzdGVySD0KYSx0KDA9PT1hKSx2KDApLDQ7Y2FzZSAzNzpyZXR1cm4gYT1iLnJlZ2lzdGVySCxSKGEsLTEpLGE9YS0xJjI1NSxiLnJlZ2lzdGVySD1hLHQoMD09PWEpLHYoMSksNDtjYXNlIDM4OnJldHVybiBiLnJlZ2lzdGVySD1GKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDM5OmE9MDswPChiLnJlZ2lzdGVyRj4+NSYxKSYmKGF8PTYpOzA8VSgpJiYoYXw9OTYpO3ZhciBjPWIucmVnaXN0ZXJBOzA8KGIucmVnaXN0ZXJGPj42JjEpP2M9Yy1hJjI1NTooOTwoYyYxNSkmJihhfD02KSwxNTM8YyYmKGF8PTk2KSxjPWMrYSYyNTUpO3QoMD09PWMpO0soMCE9PShhJjk2KSk7RygwKTtiLnJlZ2lzdGVyQT1jO3JldHVybiA0O2Nhc2UgNDA6cmV0dXJuIDA8VGEoKT9pYihGKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSA0MTpyZXR1cm4gYT1uKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxXYShhLGEsITEpLGE9CjIqYSY2NTUzNSxiLnJlZ2lzdGVySD1FKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHYoMCksODtjYXNlIDQyOnJldHVybiBhPW4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUkoYSksYT1hKzEmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNDM6cmV0dXJuIGE9bihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSw4O2Nhc2UgNDQ6cmV0dXJuIGE9Yi5yZWdpc3RlckwsUihhLDEpLGE9YSsxJjI1NSxiLnJlZ2lzdGVyTD1hLHQoMD09PWEpLHYoMCksNDtjYXNlIDQ1OnJldHVybiBhPWIucmVnaXN0ZXJMLFIoYSwtMSksYT1hLTEmMjU1LGIucmVnaXN0ZXJMPWEsdCgwPT09YSksdigxKSw0O2Nhc2UgNDY6cmV0dXJuIGIucmVnaXN0ZXJMPUYoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNDc6cmV0dXJuIGIucmVnaXN0ZXJBPQp+Yi5yZWdpc3RlckEsdigxKSxHKDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gRWMoYSl7c3dpdGNoKGEpe2Nhc2UgNDg6cmV0dXJuIDA9PT1VKCk/aWIoRigpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgNDk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPVkoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgNTA6cmV0dXJuIGE9bihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksVChhLGIucmVnaXN0ZXJBKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1FKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSA1MTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMSY2NTUzNSw4O2Nhc2UgNTI6YT1uKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKTt2YXIgYz1JKGEpO1IoYywxKTtjPWMrMSYyNTU7dCgwPT09Yyk7digwKTtUKGEsYyk7cmV0dXJuIDQ7Y2FzZSA1MzpyZXR1cm4gYT1uKGIucmVnaXN0ZXJILApiLnJlZ2lzdGVyTCksYz1JKGEpLFIoYywtMSksYz1jLTEmMjU1LHQoMD09PWMpLHYoMSksVChhLGMpLDQ7Y2FzZSA1NDpyZXR1cm4gVChuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA1NTpyZXR1cm4gdigwKSxHKDApLEsoMSksNDtjYXNlIDU2OnJldHVybiAxPT09VSgpP2liKEYoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDU3OnJldHVybiBhPW4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFdhKGEsYi5zdGFja1BvaW50ZXIsITEpLGE9YStiLnN0YWNrUG9pbnRlciY2NTUzNSxiLnJlZ2lzdGVySD1FKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHYoMCksODtjYXNlIDU4OnJldHVybiBhPW4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUkoYSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9RShhKSxiLnJlZ2lzdGVyTD1hJjI1NSwKNDtjYXNlIDU5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0xJjY1NTM1LDg7Y2FzZSA2MDpyZXR1cm4gYT1iLnJlZ2lzdGVyQSxSKGEsMSksYT1hKzEmMjU1LGIucmVnaXN0ZXJBPWEsdCgwPT09YSksdigwKSw0O2Nhc2UgNjE6cmV0dXJuIGE9Yi5yZWdpc3RlckEsUihhLC0xKSxhPWEtMSYyNTUsYi5yZWdpc3RlckE9YSx0KDA9PT1hKSx2KDEpLDQ7Y2FzZSA2MjpyZXR1cm4gYi5yZWdpc3RlckE9RigpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA2MzpyZXR1cm4gdigwKSxHKDApLEsoMD49VSgpKSw0fXJldHVybi0xfWZ1bmN0aW9uIEZjKGEpe3N3aXRjaChhKXtjYXNlIDY0OnJldHVybiA0O2Nhc2UgNjU6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJDLDQ7Y2FzZSA2NjpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckQsNDtjYXNlIDY3OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRSw0O2Nhc2UgNjg6cmV0dXJuIGIucmVnaXN0ZXJCPQpiLnJlZ2lzdGVySCw0O2Nhc2UgNjk6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3MDpyZXR1cm4gYi5yZWdpc3RlckI9SShuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDcxOnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQSw0O2Nhc2UgNzI6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJCLDQ7Y2FzZSA3MzpyZXR1cm4gNDtjYXNlIDc0OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyRCw0O2Nhc2UgNzU6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJFLDQ7Y2FzZSA3NjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckgsNDtjYXNlIDc3OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyTCw0O2Nhc2UgNzg6cmV0dXJuIGIucmVnaXN0ZXJDPUkobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA3OTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckEsNH1yZXR1cm4tMX1mdW5jdGlvbiBHYyhhKXtzd2l0Y2goYSl7Y2FzZSA4MDpyZXR1cm4gYi5yZWdpc3RlckQ9CmIucmVnaXN0ZXJCLDQ7Y2FzZSA4MTpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckMsNDtjYXNlIDgyOnJldHVybiA0O2Nhc2UgODM6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJFLDQ7Y2FzZSA4NDpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckgsNDtjYXNlIDg1OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyTCw0O2Nhc2UgODY6cmV0dXJuIGIucmVnaXN0ZXJEPUkobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA4NzpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckEsNDtjYXNlIDg4OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQiw0O2Nhc2UgODk6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJDLDQ7Y2FzZSA5MDpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckQsNDtjYXNlIDkxOnJldHVybiA0O2Nhc2UgOTI6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJILDQ7Y2FzZSA5MzpyZXR1cm4gYi5yZWdpc3RlckU9CmIucmVnaXN0ZXJMLDQ7Y2FzZSA5NDpyZXR1cm4gYi5yZWdpc3RlckU9SShuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDk1OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIEhjKGEpe3N3aXRjaChhKXtjYXNlIDk2OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQiw0O2Nhc2UgOTc6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJDLDQ7Y2FzZSA5ODpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckQsNDtjYXNlIDk5OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTAwOnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVySCw0O2Nhc2UgMTAxOnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTAyOnJldHVybiBiLnJlZ2lzdGVySD1JKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTAzOnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQSw0O2Nhc2UgMTA0OnJldHVybiBiLnJlZ2lzdGVyTD0KYi5yZWdpc3RlckIsNDtjYXNlIDEwNTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckMsNDtjYXNlIDEwNjpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckQsNDtjYXNlIDEwNzpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckUsNDtjYXNlIDEwODpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckgsNDtjYXNlIDEwOTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckwsNDtjYXNlIDExMDpyZXR1cm4gYi5yZWdpc3Rlckw9SShuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDExMTpyZXR1cm4gYi5yZWdpc3Rlckw9Yi5yZWdpc3RlckEsNH1yZXR1cm4tMX1mdW5jdGlvbiBJYyhhKXtzd2l0Y2goYSl7Y2FzZSAxMTI6cmV0dXJuIFQobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMTM6cmV0dXJuIFQobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMTQ6cmV0dXJuIFQobihiLnJlZ2lzdGVySCwKYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTE1OnJldHVybiBUKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTE2OnJldHVybiBUKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTE3OnJldHVybiBUKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTE4OnJldHVybiBnLmlzSGJsYW5rSGRtYUFjdGl2ZXx8Yi5lbmFibGVIYWx0KCksNDtjYXNlIDExOTpyZXR1cm4gVChuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQSksNDtjYXNlIDEyMDpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckIsNDtjYXNlIDEyMTpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckMsNDtjYXNlIDEyMjpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckQsNDtjYXNlIDEyMzpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckUsNDtjYXNlIDEyNDpyZXR1cm4gYi5yZWdpc3RlckE9CmIucmVnaXN0ZXJILDQ7Y2FzZSAxMjU6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMjY6cmV0dXJuIGIucmVnaXN0ZXJBPUkobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSAxMjc6cmV0dXJuIDR9cmV0dXJuLTF9ZnVuY3Rpb24gSmMoYSl7c3dpdGNoKGEpe2Nhc2UgMTI4OnJldHVybiBLYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEyOTpyZXR1cm4gS2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMzA6cmV0dXJuIEthKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTMxOnJldHVybiBLYShiLnJlZ2lzdGVyRSksNDtjYXNlIDEzMjpyZXR1cm4gS2EoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxMzM6cmV0dXJuIEthKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTM0OnJldHVybiBhPUkobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLEthKGEpLDQ7Y2FzZSAxMzU6cmV0dXJuIEthKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTM2OnJldHVybiBMYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEzNzpyZXR1cm4gTGEoYi5yZWdpc3RlckMpLAo0O2Nhc2UgMTM4OnJldHVybiBMYShiLnJlZ2lzdGVyRCksNDtjYXNlIDEzOTpyZXR1cm4gTGEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNDA6cmV0dXJuIExhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTQxOnJldHVybiBMYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE0MjpyZXR1cm4gYT1JKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxMYShhKSw0O2Nhc2UgMTQzOnJldHVybiBMYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBLYyhhKXtzd2l0Y2goYSl7Y2FzZSAxNDQ6cmV0dXJuIE1hKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTQ1OnJldHVybiBNYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE0NjpyZXR1cm4gTWEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNDc6cmV0dXJuIE1hKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQ4OnJldHVybiBNYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0OTpyZXR1cm4gTWEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTA6cmV0dXJuIGE9SShuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksCk1hKGEpLDQ7Y2FzZSAxNTE6cmV0dXJuIE1hKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTUyOnJldHVybiBOYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE1MzpyZXR1cm4gTmEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNTQ6cmV0dXJuIE5hKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTU1OnJldHVybiBOYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE1NjpyZXR1cm4gTmEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNTc6cmV0dXJuIE5hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTU4OnJldHVybiBhPUkobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLE5hKGEpLDQ7Y2FzZSAxNTk6cmV0dXJuIE5hKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIExjKGEpe3N3aXRjaChhKXtjYXNlIDE2MDpyZXR1cm4gT2EoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNjE6cmV0dXJuIE9hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTYyOnJldHVybiBPYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE2MzpyZXR1cm4gT2EoYi5yZWdpc3RlckUpLAo0O2Nhc2UgMTY0OnJldHVybiBPYShiLnJlZ2lzdGVySCksNDtjYXNlIDE2NTpyZXR1cm4gT2EoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNjY6cmV0dXJuIGE9SShuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksT2EoYSksNDtjYXNlIDE2NzpyZXR1cm4gT2EoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxNjg6cmV0dXJuIFBhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTY5OnJldHVybiBQYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE3MDpyZXR1cm4gUGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNzE6cmV0dXJuIFBhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTcyOnJldHVybiBQYShiLnJlZ2lzdGVySCksNDtjYXNlIDE3MzpyZXR1cm4gUGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNzQ6cmV0dXJuIGE9SShuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksUGEoYSksNDtjYXNlIDE3NTpyZXR1cm4gUGEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gTWMoYSl7c3dpdGNoKGEpe2Nhc2UgMTc2OnJldHVybiBRYShiLnJlZ2lzdGVyQiksCjQ7Y2FzZSAxNzc6cmV0dXJuIFFhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTc4OnJldHVybiBRYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE3OTpyZXR1cm4gUWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxODA6cmV0dXJuIFFhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTgxOnJldHVybiBRYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE4MjpyZXR1cm4gYT1JKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxRYShhKSw0O2Nhc2UgMTgzOnJldHVybiBRYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE4NDpyZXR1cm4gUmEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxODU6cmV0dXJuIFJhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTg2OnJldHVybiBSYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE4NzpyZXR1cm4gUmEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxODg6cmV0dXJuIFJhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTg5OnJldHVybiBSYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE5MDpyZXR1cm4gYT1JKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSwKUmEoYSksNDtjYXNlIDE5MTpyZXR1cm4gUmEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gTmMoYSl7c3dpdGNoKGEpe2Nhc2UgMTkyOnJldHVybiAwPT09VGEoKT8oYT1iLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyPUlhKGEpLGIuc3RhY2tQb2ludGVyPWErMiY2NTUzNSwxMik6ODtjYXNlIDE5MzpyZXR1cm4gYT1JYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSxiLnJlZ2lzdGVyQj1FKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDQ7Y2FzZSAxOTQ6aWYoMD09PVRhKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMTk1OnJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2Nhc2UgMTk2OmlmKDA9PT1UYSgpKXJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsCmIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAxOTc6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxuKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSksODtjYXNlIDE5ODpyZXR1cm4gS2EoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMTk5OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0wLDg7Y2FzZSAyMDA6cmV0dXJuIDE9PT1UYSgpPyhhPWIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9SWEoYSksYi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1LDEyKTo4O2Nhc2UgMjAxOnJldHVybiBhPWIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXI9CklhKGEpLGIuc3RhY2tQb2ludGVyPWErMiY2NTUzNSw4O2Nhc2UgMjAyOmlmKDE9PT1UYSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIwMzp2YXIgYz1GKCk7YT0tMTt2YXIgZD0hMSxlPTAsZj0wLGg9YyY3O3N3aXRjaChoKXtjYXNlIDA6ZT1iLnJlZ2lzdGVyQjticmVhaztjYXNlIDE6ZT1iLnJlZ2lzdGVyQzticmVhaztjYXNlIDI6ZT1iLnJlZ2lzdGVyRDticmVhaztjYXNlIDM6ZT1iLnJlZ2lzdGVyRTticmVhaztjYXNlIDQ6ZT1iLnJlZ2lzdGVySDticmVhaztjYXNlIDU6ZT1iLnJlZ2lzdGVyTDticmVhaztjYXNlIDY6ZT1JKG4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKTticmVhaztjYXNlIDc6ZT1iLnJlZ2lzdGVyQX12YXIgZz0oYyYyNDApPj40O3N3aXRjaChnKXtjYXNlIDA6Nz49Yz8oYz1lLEsoMTI4PT09KGMmMTI4KSksYz0oYzw8MXxjPj43KSYyNTUsdCgwPT09CmMpLHYoMCksRygwKSxmPWMsZD0hMCk6MTU+PWMmJihjPWUsSygwPChjJjEpKSxjPShjPj4xfGM8PDcpJjI1NSx0KDA9PT1jKSx2KDApLEcoMCksZj1jLGQ9ITApO2JyZWFrO2Nhc2UgMToyMz49Yz8oYz1lLGQ9MTI4PT09KGMmMTI4KSxjPShjPDwxfFUoKSkmMjU1LEsoZCksdCgwPT09YyksdigwKSxHKDApLGY9YyxkPSEwKTozMT49YyYmKGM9ZSxkPTE9PT0oYyYxKSxjPShjPj4xfFUoKTw8NykmMjU1LEsoZCksdCgwPT09YyksdigwKSxHKDApLGY9YyxkPSEwKTticmVhaztjYXNlIDI6Mzk+PWM/KGM9ZSxkPTEyOD09PShjJjEyOCksYz1jPDwxJjI1NSxLKGQpLHQoMD09PWMpLHYoMCksRygwKSxmPWMsZD0hMCk6NDc+PWMmJihjPWUsZD0xMjg9PT0oYyYxMjgpLGU9MT09PShjJjEpLGM9Yz4+MSYyNTUsZCYmKGN8PTEyOCksdCgwPT09YyksdigwKSxHKDApLEsoZSksZj1jLGQ9ITApO2JyZWFrO2Nhc2UgMzo1NT49Yz8oYz1lLGM9KChjJjE1KTw8NHwoYyYyNDApPj40KSYyNTUsdCgwPT09CmMpLHYoMCksRygwKSxLKDApLGY9YyxkPSEwKTo2Mz49YyYmKGM9ZSxkPTE9PT0oYyYxKSxjPWM+PjEmMjU1LHQoMD09PWMpLHYoMCksRygwKSxLKGQpLGY9YyxkPSEwKTticmVhaztjYXNlIDQ6NzE+PWM/KGY9VmEoMCxlKSxkPSEwKTo3OT49YyYmKGY9VmEoMSxlKSxkPSEwKTticmVhaztjYXNlIDU6ODc+PWM/KGY9VmEoMixlKSxkPSEwKTo5NT49YyYmKGY9VmEoMyxlKSxkPSEwKTticmVhaztjYXNlIDY6MTAzPj1jPyhmPVZhKDQsZSksZD0hMCk6MTExPj1jJiYoZj1WYSg1LGUpLGQ9ITApO2JyZWFrO2Nhc2UgNzoxMTk+PWM/KGY9VmEoNixlKSxkPSEwKToxMjc+PWMmJihmPVZhKDcsZSksZD0hMCk7YnJlYWs7Y2FzZSA4OjEzNT49Yz8oZj1iYSgwLDAsZSksZD0hMCk6MTQzPj1jJiYoZj1iYSgxLDAsZSksZD0hMCk7YnJlYWs7Y2FzZSA5OjE1MT49Yz8oZj1iYSgyLDAsZSksZD0hMCk6MTU5Pj1jJiYoZj1iYSgzLDAsZSksZD0hMCk7YnJlYWs7Y2FzZSAxMDoxNjc+PWM/KGY9YmEoNCwKMCxlKSxkPSEwKToxNzU+PWMmJihmPWJhKDUsMCxlKSxkPSEwKTticmVhaztjYXNlIDExOjE4Mz49Yz8oZj1iYSg2LDAsZSksZD0hMCk6MTkxPj1jJiYoZj1iYSg3LDAsZSksZD0hMCk7YnJlYWs7Y2FzZSAxMjoxOTk+PWM/KGY9YmEoMCwxLGUpLGQ9ITApOjIwNz49YyYmKGY9YmEoMSwxLGUpLGQ9ITApO2JyZWFrO2Nhc2UgMTM6MjE1Pj1jPyhmPWJhKDIsMSxlKSxkPSEwKToyMjM+PWMmJihmPWJhKDMsMSxlKSxkPSEwKTticmVhaztjYXNlIDE0OjIzMT49Yz8oZj1iYSg0LDEsZSksZD0hMCk6MjM5Pj1jJiYoZj1iYSg1LDEsZSksZD0hMCk7YnJlYWs7Y2FzZSAxNToyNDc+PWM/KGY9YmEoNiwxLGUpLGQ9ITApOjI1NT49YyYmKGY9YmEoNywxLGUpLGQ9ITApfXN3aXRjaChoKXtjYXNlIDA6Yi5yZWdpc3RlckI9ZjticmVhaztjYXNlIDE6Yi5yZWdpc3RlckM9ZjticmVhaztjYXNlIDI6Yi5yZWdpc3RlckQ9ZjticmVhaztjYXNlIDM6Yi5yZWdpc3RlckU9ZjticmVhaztjYXNlIDQ6Yi5yZWdpc3Rlckg9CmY7YnJlYWs7Y2FzZSA1OmIucmVnaXN0ZXJMPWY7YnJlYWs7Y2FzZSA2Oig0Pmd8fDc8ZykmJlQobihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksZik7YnJlYWs7Y2FzZSA3OmIucmVnaXN0ZXJBPWZ9ZCYmKGE9NCk7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIGE7Y2FzZSAyMDQ6aWYoMT09PVRhKCkpcmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxiLnByb2dyYW1Db3VudGVyKzIpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjA1OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2Nhc2UgMjA2OnJldHVybiBMYShGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisKMSY2NTUzNSw0O2Nhc2UgMjA3OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj04fXJldHVybi0xfWZ1bmN0aW9uIE9jKGEpe3N3aXRjaChhKXtjYXNlIDIwODpyZXR1cm4gMD09PVUoKT8oYT1iLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyPUlhKGEpLGIuc3RhY2tQb2ludGVyPWErMiY2NTUzNSwxMik6ODtjYXNlIDIwOTphPWIuc3RhY2tQb2ludGVyO3ZhciBjPUlhKGEpO2Iuc3RhY2tQb2ludGVyPWErMiY2NTUzNTtiLnJlZ2lzdGVyRD1FKGMpO2IucmVnaXN0ZXJFPWMmMjU1O3JldHVybiA0O2Nhc2UgMjEwOmlmKDA9PT1VKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEyOmlmKDA9PT1VKCkpcmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj0KYSxWKGEsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIxMzpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLG4oYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpKSw4O2Nhc2UgMjE0OnJldHVybiBNYShGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMTU6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTE2LDg7Y2FzZSAyMTY6cmV0dXJuIDE9PT1VKCk/KGE9Yi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcj1JYShhKSxiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzUsMTIpOjg7Y2FzZSAyMTc6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcj0KSWEoYSksdmIoITApLGIuc3RhY2tQb2ludGVyPWErMiY2NTUzNSw4O2Nhc2UgMjE4OmlmKDE9PT1VKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjIwOmlmKDE9PT1VKCkpcmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjIyOnJldHVybiBOYShGKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMjM6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTI0LDh9cmV0dXJuLTF9ZnVuY3Rpb24gUGMoYSl7c3dpdGNoKGEpe2Nhc2UgMjI0OnJldHVybiBhPQpGKCksVCg2NTI4MCthLGIucmVnaXN0ZXJBKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjI1OmE9Yi5zdGFja1BvaW50ZXI7dmFyIGM9SWEoYSk7Yi5zdGFja1BvaW50ZXI9YSsyJjY1NTM1O2IucmVnaXN0ZXJIPUUoYyk7Yi5yZWdpc3Rlckw9YyYyNTU7cmV0dXJuIDQ7Y2FzZSAyMjY6cmV0dXJuIFQoNjUyODArYi5yZWdpc3RlckMsYi5yZWdpc3RlckEpLDQ7Y2FzZSAyMjk6cmV0dXJuIGE9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxiLnN0YWNrUG9pbnRlcj1hLFYoYSxuKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksODtjYXNlIDIzMDpyZXR1cm4gT2EoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjMxOnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0zMiw4O2Nhc2UgMjMyOnJldHVybiBhPQpGKCk8PDI0Pj4yNCxXYShiLnN0YWNrUG9pbnRlcixhLCEwKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcithJjY1NTM1LHQoMCksdigwKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwxMjtjYXNlIDIzMzpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1uKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSw0O2Nhc2UgMjM0OnJldHVybiBUKFkoKSxiLnJlZ2lzdGVyQSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDIzODpyZXR1cm4gUGEoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjM5OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj00MCw4fXJldHVybi0xfWZ1bmN0aW9uIFFjKGEpe3N3aXRjaChhKXtjYXNlIDI0MDpyZXR1cm4gYT1GKCksYi5yZWdpc3RlckE9CkkoNjUyODArYSkmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNDE6YT1iLnN0YWNrUG9pbnRlcjt2YXIgYz1JYShhKTtiLnN0YWNrUG9pbnRlcj1hKzImNjU1MzU7Yi5yZWdpc3RlckE9RShjKTtiLnJlZ2lzdGVyRj1jJjI1NTtyZXR1cm4gNDtjYXNlIDI0MjpyZXR1cm4gYi5yZWdpc3RlckE9SSg2NTI4MCtiLnJlZ2lzdGVyQykmMjU1LDQ7Y2FzZSAyNDM6cmV0dXJuIHZiKCExKSw0O2Nhc2UgMjQ1OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsbihiLnJlZ2lzdGVyQSxiLnJlZ2lzdGVyRikpLDg7Y2FzZSAyNDY6cmV0dXJuIFFhKEYoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDI0NzpyZXR1cm4gYT1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LGIuc3RhY2tQb2ludGVyPWEsVihhLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9CjQ4LDg7Y2FzZSAyNDg6cmV0dXJuIGM9RigpPDwyND4+MjQsYT1iLnN0YWNrUG9pbnRlcix0KDApLHYoMCksV2EoYSxjLCEwKSxhPWErYyY2NTUzNSxiLnJlZ2lzdGVySD1FKGEpLGIucmVnaXN0ZXJMPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAyNDk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPW4oYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLDg7Y2FzZSAyNTA6cmV0dXJuIGIucmVnaXN0ZXJBPUkoWSgpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMjUxOnJldHVybiB2YighMCksNDtjYXNlIDI1NDpyZXR1cm4gUmEoRigpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjU1OnJldHVybiBhPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsYi5zdGFja1BvaW50ZXI9YSxWKGEsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj01Niw4fXJldHVybi0xfQpmdW5jdGlvbiBTYShhKXswPGcuRE1BQ3ljbGVzJiYoYSs9Zy5ETUFDeWNsZXMsZy5ETUFDeWNsZXM9MCk7Yi5jdXJyZW50Q3ljbGVzKz1hO2lmKCFiLmlzU3RvcHBlZCl7aWYoUy5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZyl7ci5jdXJyZW50Q3ljbGVzKz1hO2Zvcih2YXIgYz1yLmJhdGNoUHJvY2Vzc0N5Y2xlcygpO3IuY3VycmVudEN5Y2xlcz49YzspbWMoYyksci5jdXJyZW50Q3ljbGVzLT1jfWVsc2UgbWMoYSk7Uy5hdWRpb0JhdGNoUHJvY2Vzc2luZz9rLmN1cnJlbnRDeWNsZXMrPWE6Y2MoYSk7Yz1hO2lmKFoudHJhbnNmZXJTdGFydEZsYWcpZm9yKHZhciBkPTA7ZDxjOyl7dmFyIGU9Wi5jdXJyZW50Q3ljbGVzLGY9ZTtkKz00O2YrPTQ7NjU1MzU8ZiYmKGYtPTY1NTM2KTtaLmN1cnJlbnRDeWNsZXM9Zjt2YXIgbD1aLmlzQ2xvY2tTcGVlZEZhc3Q/Mjo3O3AobCxlKSYmIXAobCxmKSYmKGU9Wi5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyRGF0YSxmPXcoZSksZj0oZjw8MSkrCjEsZiY9MjU1LGgoZSxmKSxlPVoubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQsOD09PSsrZT8oWi5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZD0wLG0uaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsYmIobS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCksZT1aLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sLGY9dyhlKSxoKGUsSCg3LGYpKSxaLnRyYW5zZmVyU3RhcnRGbGFnPSExKTpaLm51bWJlck9mQml0c1RyYW5zZmVycmVkPWUpfX1TLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz8odS5jdXJyZW50Q3ljbGVzKz1hLEhiKHUuY3VycmVudEN5Y2xlcyksdS5jdXJyZW50Q3ljbGVzPTApOkhiKGEpO2M9ZGEuY3ljbGVzO2MrPWE7Yz49ZGEuY3ljbGVzUGVyQ3ljbGVTZXQmJihkYS5jeWNsZVNldHMrPTEsYy09ZGEuY3ljbGVzUGVyQ3ljbGVTZXQpO2RhLmN5Y2xlcz1jfWZ1bmN0aW9uIG9jKCl7cmV0dXJuIFFiKCEwLC0xKX1mdW5jdGlvbiBRYihhLGMpe3ZvaWQgMD09PQpjJiYoYz0tMSk7YT0xMDI0OzA8Yz9hPWM6MD5jJiYoYT0tMSk7Zm9yKHZhciBkPSExLGU9ITEsZj0hMTshKGR8fGV8fGZ8fGFhLnJlYWNoZWRCcmVha3BvaW50KTspYz1wYygpLDA+Yz9kPSEwOmIuY3VycmVudEN5Y2xlcz49Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpP2U9ITA6LTE8YSYmZGMoKT49YSYmKGY9ITApO2lmKGUpcmV0dXJuIGIuY3VycmVudEN5Y2xlcy09Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpLFcuUkVTUE9OU0VfQ09ORElUSU9OX0ZSQU1FO2lmKGYpcmV0dXJuIFcuUkVTUE9OU0VfQ09ORElUSU9OX0FVRElPO2lmKGFhLnJlYWNoZWRCcmVha3BvaW50KXJldHVybiBhYS5yZWFjaGVkQnJlYWtwb2ludD0hMSxXLlJFU1BPTlNFX0NPTkRJVElPTl9CUkVBS1BPSU5UO2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlci0xJjY1NTM1O3JldHVybi0xfWZ1bmN0aW9uIHBjKCl7amI9ITA7aWYoYi5pc0hhbHRCdWcpe3ZhciBhPXcoYi5wcm9ncmFtQ291bnRlcik7YT0KbmMoYSk7U2EoYSk7Yi5leGl0SGFsdEFuZFN0b3AoKX1tLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5JiYobS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITAsbS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMSk7aWYoMDwobS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJm0uaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlJjMxKSl7YT0hMTttLm1hc3RlckludGVycnVwdFN3aXRjaCYmIWIuaXNIYWx0Tm9KdW1wJiYobS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQmJm0uaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KGhiKG0uYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpLGE9ITApOm0uaXNMY2RJbnRlcnJ1cHRFbmFibGVkJiZtLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPyhoYihtLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSxhPSEwKTptLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkJiZtLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KGhiKG0uYml0UG9zaXRpb25UaW1lckludGVycnVwdCksCmE9ITApOm0uaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkJiZtLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPyhoYihtLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0KSxhPSEwKTptLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZCYmbS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZCYmKGhiKG0uYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQpLGE9ITApKTt2YXIgYz0wO2EmJihjPTIwLGIuaXNIYWx0ZWQoKSYmKGIuZXhpdEhhbHRBbmRTdG9wKCksYys9NCkpO2IuaXNIYWx0ZWQoKSYmYi5leGl0SGFsdEFuZFN0b3AoKTthPWN9ZWxzZSBhPTA7MDxhJiZTYShhKTthPTQ7Yi5pc0hhbHRlZCgpfHxiLmlzU3RvcHBlZHx8KGE9dyhiLnByb2dyYW1Db3VudGVyKSxhPW5jKGEpKTtiLnJlZ2lzdGVyRiY9MjQwO2lmKDA+PWEpcmV0dXJuIGE7U2EoYSk7Yz1XLnN0ZXBzO2MrPTE7Yz49Vy5zdGVwc1BlclN0ZXBTZXQmJihXLnN0ZXBTZXRzKz0xLGMtPVcuc3RlcHNQZXJTdGVwU2V0KTtXLnN0ZXBzPQpjO2IucHJvZ3JhbUNvdW50ZXI9PT1hYS5wcm9ncmFtQ291bnRlciYmKGFhLnJlYWNoZWRCcmVha3BvaW50PSEwKTtyZXR1cm4gYX1mdW5jdGlvbiBSYyhhKXtjb25zdCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGMtMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChjKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gY31mdW5jdGlvbiBSYihhKXthLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTkwPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZT8xLjI1Kk1hdGguZmxvb3IoYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOjEyMH1mdW5jdGlvbiBxYyhhKXtjb25zdCBjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE0oe3R5cGU6eC5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Y30pLFtjXSl9ZnVuY3Rpb24gcmMoYSl7dmFyIGM9KCJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtjPXNjLWM7MD5jJiYoYz0wKTthLnNwZWVkJiYwPGEuc3BlZWQmJihjLz1hLnNwZWVkKTthLnVwZGF0ZUlkPXNldFRpbWVvdXQoKCk9Pnt0YyhhKX0sTWF0aC5mbG9vcihjKSl9ZnVuY3Rpb24gdGMoYSxjKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1jJiYoc2M9Yyk7a2I9YS5nZXRGUFMoKTt4Yj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmCih4Yio9YS5zcGVlZCk7aWYoa2I+eGIpcmV0dXJuIGEuZnBzVGltZVN0YW1wcy5zaGlmdCgpLHJjKGEpLCEwO1JjKGEpO2NvbnN0IGI9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYyk9PntsZXQgZDtiP1NiKGEsYyk6KGQ9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWUoKSxjKGQpKX0pKS50aGVuKChjKT0+e2lmKDA8PWMpe2VhKE0oe3R5cGU6eC5VUERBVEVELGZwczprYn0pKTtsZXQgYj0hMTthLm9wdGlvbnMuZnJhbWVTa2lwJiYwPGEub3B0aW9ucy5mcmFtZVNraXAmJihhLmZyYW1lU2tpcENvdW50ZXIrKyxhLmZyYW1lU2tpcENvdW50ZXI8PWEub3B0aW9ucy5mcmFtZVNraXA/Yj0hMDphLmZyYW1lU2tpcENvdW50ZXI9MCk7Ynx8cWMoYSk7Y29uc3QgZD17dHlwZTp4LlVQREFURUR9O2RbRC5DQVJUUklER0VfUkFNXT1XYihhKS5idWZmZXI7ZFtELkdBTUVCT1lfTUVNT1JZXT0KYS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXI7ZFtELlBBTEVUVEVfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtkW0QuSU5URVJOQUxfU1RBVEVdPVhiKGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhkKS5mb3JFYWNoKChhKT0+e3ZvaWQgMD09PWRbYV0mJihkW2FdPShuZXcgVWludDhBcnJheSkuYnVmZmVyKX0pO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShNKGQpLFtkW0QuQ0FSVFJJREdFX1JBTV0sZFtELkdBTUVCT1lfTUVNT1JZXSxkW0QuUEFMRVRURV9NRU1PUlldLGRbRC5JTlRFUk5BTF9TVEFURV1dKTsKMj09PWM/ZWEoTSh7dHlwZTp4LkJSRUFLUE9JTlR9KSk6cmMoYSl9ZWxzZSBlYShNKHt0eXBlOnguQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIFNiKGEsYyl7dmFyIGI9LTE7Yj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PWImJmMoYik7aWYoMT09PWIpe2I9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nZXROdW1iZXJPZlNhbXBsZXNJbkF1ZGlvQnVmZmVyKCk7Y29uc3QgZD1rYj49eGI7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmZD8odWMoYSxiKSxzZXRUaW1lb3V0KCgpPT57UmIoYSk7U2IoYSxjKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOih1YyhhLGIpLFNiKGEsYykpfX1mdW5jdGlvbiB1YyhhLGMpe3ZhciBiPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTiwKYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtjb25zdCBkPXt0eXBlOnguVVBEQVRFRCxhdWRpb0J1ZmZlcjpiLG51bWJlck9mU2FtcGxlczpjLGZwczprYixhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6NjA8YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9O2I9W2JdO2lmKGEub3B0aW9ucyYmYS5vcHRpb25zLmVuYWJsZUF1ZGlvRGVidWdnaW5nKXt2YXIgZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYykuYnVmZmVyO2QuY2hhbm5lbDFCdWZmZXI9ZTtiLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OKzIqYykuYnVmZmVyO2QuY2hhbm5lbDJCdWZmZXI9ZTtiLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtkLmNoYW5uZWwzQnVmZmVyPWU7Yi5wdXNoKGUpO2M9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTisyKmMpLmJ1ZmZlcjtkLmNoYW5uZWw0QnVmZmVyPWM7Yi5wdXNoKGMpfWEuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE0oZCksYik7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCl9Y29uc3QgbWI9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgQWI7bWJ8fChBYj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IHg9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLApHRVRfTUVNT1JZOiJHRVRfTUVNT1JZIixTRVRfTUVNT1JZOiJTRVRfTUVNT1JZIixTRVRfTUVNT1JZX0RPTkU6IlNFVF9NRU1PUllfRE9ORSIsR0VUX0NPTlNUQU5UUzoiR0VUX0NPTlNUQU5UUyIsR0VUX0NPTlNUQU5UU19ET05FOiJHRVRfQ09OU1RBTlRTX0RPTkUiLENPTkZJRzoiQ09ORklHIixSRVNFVF9BVURJT19RVUVVRToiUkVTRVRfQVVESU9fUVVFVUUiLFBMQVk6IlBMQVkiLEJSRUFLUE9JTlQ6IkJSRUFLUE9JTlQiLFBBVVNFOiJQQVVTRSIsVVBEQVRFRDoiVVBEQVRFRCIsQ1JBU0hFRDoiQ1JBU0hFRCIsU0VUX0pPWVBBRF9TVEFURToiU0VUX0pPWVBBRF9TVEFURSIsQVVESU9fTEFURU5DWToiQVVESU9fTEFURU5DWSIsUlVOX1dBU01fRVhQT1JUOiJSVU5fV0FTTV9FWFBPUlQiLEdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOiJHRVRfV0FTTV9NRU1PUllfU0VDVElPTiIsR0VUX1dBU01fQ09OU1RBTlQ6IkdFVF9XQVNNX0NPTlNUQU5UIixGT1JDRV9PVVRQVVRfRlJBTUU6IkZPUkNFX09VVFBVVF9GUkFNRSIsClNFVF9TUEVFRDoiU0VUX1NQRUVEIixJU19HQkM6IklTX0dCQyJ9LEQ9e0NBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTtsZXQgbmI9MDtjb25zdCBlPW5ldyBVaW50OENsYW1wZWRBcnJheSg5MTA5NTA0KSxsYj17c2l6ZTooKT0+OTEwOTUwNCxncm93OigpPT57fSx3YXNtQnl0ZU1lbW9yeTplfTt2YXIgU2M9NjU1MzYsWWE9Njc1ODQsWmE9WWErMTI4LGNiPVphKzIzNTUyLHliPWNiKzkzMTg0LFRiPXliKzE5NjYwOCx6Yj1UYisxNDc0NTYsVGM9WWEsVWM9emItWWErMTUzNjAsRGI9emIrMTUzNjAsRWI9RGIrMTMxMDcyLEZiPUViKzEzMTA3MixHYj1GYisxMzEwNzIsdWI9R2IrMTMxMDcyLApOYj11YisxMzEwNzIsd2I9TmIrMTMxMDcyLFViPXdiKzgyNTg1NjAsdmM9VWIrNjU1MzUrMSxWYj1NYXRoLmNlaWwodmMvMTAyNC82NCkrMSxTPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmVuYWJsZUJvb3RSb209ITE7YS51c2VHYmNXaGVuQXZhaWxhYmxlPSEwO2EuYXVkaW9CYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0hMTthLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPSExO2EuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0hMTthLnRpbGVSZW5kZXJpbmc9ITE7YS50aWxlQ2FjaGluZz0hMTthLmVuYWJsZUF1ZGlvRGVidWdnaW5nPSExO3JldHVybiBhfSgpLEw9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNTkyMTkwNjthLmJnTGlnaHRHcmV5PTEwNTI2ODgwO2EuYmdEYXJrR3JleT01Nzg5Nzg0O2EuYmdCbGFjaz01MjYzNDQ7YS5vYmowV2hpdGU9MTU5MjE5MDY7CmEub2JqMExpZ2h0R3JleT0xMDUyNjg4MDthLm9iajBEYXJrR3JleT01Nzg5Nzg0O2Eub2JqMEJsYWNrPTUyNjM0NDthLm9iajFXaGl0ZT0xNTkyMTkwNjthLm9iajFMaWdodEdyZXk9MTA1MjY4ODA7YS5vYmoxRGFya0dyZXk9NTc4OTc4NDthLm9iajFCbGFjaz01MjYzNDQ7cmV0dXJuIGF9KCksbWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTU0MzkyMzI7YS5iZ0RhcmtHcmV5PTE2NzI4NTc2O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT01NDM5MjMyO2Eub2JqMERhcmtHcmV5PTE2NzI4NTc2O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTU0MzkyMzI7YS5vYmoxRGFya0dyZXk9MTY3Mjg1NzY7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxxYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9CjE2Nzc2OTYwO2EuYmdEYXJrR3JleT0xNjcxMTY4MDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NzY5NjA7YS5vYmowRGFya0dyZXk9MTY3MTE2ODA7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NzY5NjA7YS5vYmoxRGFya0dyZXk9MTY3MTE2ODA7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxqYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTY3NTYwNjc7YS5iZ0RhcmtHcmV5PTg2NjMyOTY7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzU2MDY3O2Eub2JqMERhcmtHcmV5PTg2NjMyOTY7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NTYwNjc7YS5vYmoxRGFya0dyZXk9ODY2MzI5NjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLApvYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTA7YS5iZ0xpZ2h0R3JleT0zMzkyNDthLmJnRGFya0dyZXk9MTY3Njg1MTI7YS5iZ0JsYWNrPTE2Nzc3MjE1O2Eub2JqMFdoaXRlPTA7YS5vYmowTGlnaHRHcmV5PTMzOTI0O2Eub2JqMERhcmtHcmV5PTE2NzY4NTEyO2Eub2JqMEJsYWNrPTE2Nzc3MjE1O2Eub2JqMVdoaXRlPTA7YS5vYmoxTGlnaHRHcmV5PTMzOTI0O2Eub2JqMURhcmtHcmV5PTE2NzY4NTEyO2Eub2JqMUJsYWNrPTE2Nzc3MjE1O3JldHVybiBhfSgpLHVhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xMDg1NTg0NTthLmJnRGFya0dyZXk9NTM5NTAyNjthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTA4NTU4NDU7YS5vYmowRGFya0dyZXk9NTM5NTAyNjthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xMDg1NTg0NTsKYS5vYmoxRGFya0dyZXk9NTM5NTAyNjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHBhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcxMjU7YS5iZ0xpZ2h0R3JleT0xNjc0OTcxNjthLmJnRGFya0dyZXk9OTczNzQ3MTthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzEyNTthLm9iajBMaWdodEdyZXk9MTY3NDk3MTY7YS5vYmowRGFya0dyZXk9OTczNzQ3MTthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MTI1O2Eub2JqMUxpZ2h0R3JleT0xNjc0OTcxNjthLm9iajFEYXJrR3JleT05NzM3NDcxO2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksbGE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3MDc1NzthLmJnTGlnaHRHcmV5PTEzNTQwNDg0O2EuYmdEYXJrR3JleT04Njc4MTg1O2EuYmdCbGFjaz01OTEwNzkyO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc1NjA2NzthLm9iajBEYXJrR3JleT04NjYzMjk2OwphLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc1NjA2NzthLm9iajFEYXJrR3JleT04NjYzMjk2O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksbmE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTgxMjYyNTc7YS5iZ0RhcmtHcmV5PTI1NTQxO2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc0NTYwNDthLm9iajBEYXJrR3JleT05NzE0MjM0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMURhcmtHcmV5PTk3MTQyMzQ7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSx0YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9OTIxMTEwMjthLmJnRGFya0dyZXk9NTM5NTA4NDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0KMTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMERhcmtHcmV5PTk3MTQyMzQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9MTY3NTYwNjc7YS5vYmoxRGFya0dyZXk9ODY2MzI5NjthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLGthPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xNjc0NTYwNDthLmJnRGFya0dyZXk9OTcxNDIzNDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9ODEyNjI1NzthLm9iajBEYXJrR3JleT0zMzc5MjthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT02NTMwNTU5O2Eub2JqMURhcmtHcmV5PTI1NTthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLHNhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT02NTMwNTU5OwphLmJnRGFya0dyZXk9MjU1O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc0NTYwNDthLm9iajBEYXJrR3JleT05NzE0MjM0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTgxMjYyNTc7YS5vYmoxRGFya0dyZXk9MzM3OTI7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxyYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9MTY3NzY5NjA7YS5iZ0RhcmtHcmV5PTgwNzk4NzI7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmowRGFya0dyZXk9MjU1O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTgxMjYyNTc7YS5vYmoxRGFya0dyZXk9MzM3OTI7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSx3YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9CmEuYmdXaGl0ZT0xMDg1MzYzMTthLmJnTGlnaHRHcmV5PTE2Nzc2OTYwO2EuYmdEYXJrR3JleT0yNTM0NDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xMDg1MzYzMTthLm9iajBMaWdodEdyZXk9MTY3NzY5NjA7YS5vYmowRGFya0dyZXk9MjUzNDQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xMDg1MzYzMTthLm9iajFMaWdodEdyZXk9MTY3NzY5NjA7YS5vYmoxRGFya0dyZXk9MjUzNDQ7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSx4YT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MjE1O2EuYmdMaWdodEdyZXk9NjUzMDU1OTthLmJnRGFya0dyZXk9MjU1O2EuYmdCbGFjaz0wO2Eub2JqMFdoaXRlPTE2Nzc3MjE1O2Eub2JqMExpZ2h0R3JleT0xNjc0NTYwNDthLm9iajBEYXJrR3JleT05NzE0MjM0O2Eub2JqMEJsYWNrPTA7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPQowO3JldHVybiBhfSgpLHlhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xNjc0NTYwNDthLmJnRGFya0dyZXk9OTcxNDIzNDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9ODEyNjI1NzthLm9iajBEYXJrR3JleT0zMzc5MjthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc0NTYwNDthLm9iajFEYXJrR3JleT05NzE0MjM0O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksemE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xMTkwODYwNzthLmJnTGlnaHRHcmV5PTE2Nzc3MTA4O2EuYmdEYXJrR3JleT0xMTM2MDgzNDthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0wO2Eub2JqMExpZ2h0R3JleT0xNjc3NzIxNTthLm9iajBEYXJrR3JleT0xNjc0NTYwNDthLm9iajBCbGFjaz05NzE0MjM0O2Eub2JqMVdoaXRlPTA7YS5vYmoxTGlnaHRHcmV5PQoxNjc3NzIxNTthLm9iajFEYXJrR3JleT0xNjc0NTYwNDthLm9iajFCbGFjaz05NzE0MjM0O3JldHVybiBhfSgpLEFhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xMTM4MjE0ODthLmJnRGFya0dyZXk9NDM1NDkzOTthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NDExMjA7YS5vYmowRGFya0dyZXk9OTcxNjIyNDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT01OTQ2ODc5O2Eub2JqMURhcmtHcmV5PTE2NzExNjgwO2Eub2JqMUJsYWNrPTI1NTtyZXR1cm4gYX0oKSxCYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTE2Nzc3MTE2O2EuYmdMaWdodEdyZXk9OTc0NTkxOTthLmJnRGFya0dyZXk9NjUyNjA2NzthLmJnQmxhY2s9MTQ5MDY7YS5vYmowV2hpdGU9MTY3NjIxNzg7YS5vYmowTGlnaHRHcmV5PTE2NzY2NDY0O2Eub2JqMERhcmtHcmV5PQo5NzE0MTc2O2Eub2JqMEJsYWNrPTQ4NDk2NjQ7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTE2NzQ1NjA0O2Eub2JqMURhcmtHcmV5PTk3MTQyMzQ7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxDYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iZ1doaXRlPTcwNzc2MzI7YS5iZ0xpZ2h0R3JleT0xNjc3NzIxNTthLmJnRGFya0dyZXk9MTY3MzI3NDY7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTE2Nzc3MjE1O2Eub2JqMERhcmtHcmV5PTY1MzA1NTk7YS5vYmowQmxhY2s9MjU1O2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT0xNjc1NjA2NzthLm9iajFEYXJrR3JleT04NjYzMjk2O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksRGE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xMDg1MzYzMTthLmJnTGlnaHRHcmV5PTE2Nzc2OTYwO2EuYmdEYXJrR3JleT0yNTM0NDthLmJnQmxhY2s9CjA7YS5vYmowV2hpdGU9MTY3MzcxMDY7YS5vYmowTGlnaHRHcmV5PTE0MDI0NzA0O2Eub2JqMERhcmtHcmV5PTY0ODgwNjQ7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0yNTU7YS5vYmoxTGlnaHRHcmV5PTE2Nzc3MjE1O2Eub2JqMURhcmtHcmV5PTE2Nzc3MDgzO2Eub2JqMUJsYWNrPTM0MDQ3O3JldHVybiBhfSgpLEVhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcxNjY7YS5iZ0xpZ2h0R3JleT02NTQ5NDg3O2EuYmdEYXJrR3JleT0xMDI1NzQ1NzthLmJnQmxhY2s9NTkyMTM3MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NDExMjA7YS5vYmowRGFya0dyZXk9OTcxNjIyNDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT02NTMwNTU5O2Eub2JqMURhcmtHcmV5PTI1NTthLm9iajFCbGFjaz0wO3JldHVybiBhfSgpLEZhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7CmEuYmdMaWdodEdyZXk9MTY3NDU2MDQ7YS5iZ0RhcmtHcmV5PTk3MTQyMzQ7YS5iZ0JsYWNrPTA7YS5vYmowV2hpdGU9MTY3NzcyMTU7YS5vYmowTGlnaHRHcmV5PTY1MjgwO2Eub2JqMERhcmtHcmV5PTMyNDUwNTY7YS5vYmowQmxhY2s9MTg5NDQ7YS5vYmoxV2hpdGU9MTY3NzcyMTU7YS5vYmoxTGlnaHRHcmV5PTY1MzA1NTk7YS5vYmoxRGFya0dyZXk9MjU1O2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksR2E9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmdXaGl0ZT0xNjc3NzIxNTthLmJnTGlnaHRHcmV5PTY1MzA1NTk7YS5iZ0RhcmtHcmV5PTI1NTthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3Njk2MDthLm9iajBMaWdodEdyZXk9MTY3MTE2ODA7YS5vYmowRGFya0dyZXk9NjQ4ODA2NDthLm9iajBCbGFjaz0wO2Eub2JqMVdoaXRlPTE2Nzc3MjE1O2Eub2JqMUxpZ2h0R3JleT04MTI2MjU3O2Eub2JqMURhcmtHcmV5PTMzNzkyO2Eub2JqMUJsYWNrPTA7cmV0dXJuIGF9KCksCkhhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9MTY3NzcyMTU7YS5iZ0xpZ2h0R3JleT0xMTM4MjE0ODthLmJnRGFya0dyZXk9NDM1NDkzOTthLmJnQmxhY2s9MDthLm9iajBXaGl0ZT0xNjc3NzIxNTthLm9iajBMaWdodEdyZXk9MTY3NTYwNjc7YS5vYmowRGFya0dyZXk9MTY3NTYwNjc7YS5vYmowQmxhY2s9MDthLm9iajFXaGl0ZT0xNjc3NzIxNTthLm9iajFMaWdodEdyZXk9NjUzMDU1OTthLm9iajFEYXJrR3JleT0yNTU7YS5vYmoxQmxhY2s9MDtyZXR1cm4gYX0oKSxkPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJnV2hpdGU9TC5iZ1doaXRlO2EuYmdMaWdodEdyZXk9TC5iZ0xpZ2h0R3JleTthLmJnRGFya0dyZXk9TC5iZ0RhcmtHcmV5O2EuYmdCbGFjaz1MLmJnQmxhY2s7YS5vYmowV2hpdGU9TC5vYmowV2hpdGU7YS5vYmowTGlnaHRHcmV5PUwub2JqMExpZ2h0R3JleTthLm9iajBEYXJrR3JleT1MLm9iajBEYXJrR3JleTthLm9iajBCbGFjaz1MLm9iajBCbGFjazsKYS5vYmoxV2hpdGU9TC5vYmoxV2hpdGU7YS5vYmoxTGlnaHRHcmV5PUwub2JqMUxpZ2h0R3JleTthLm9iajFEYXJrR3JleT1MLm9iajFEYXJrR3JleTthLm9iajFCbGFjaz1MLm9iajFCbGFjaztyZXR1cm4gYX0oKSxYYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXg9NjUzODQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlRGF0YT02NTM4NTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZUluZGV4PTY1Mzg2O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YT02NTM4NzthLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGU9NjUzNTE7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVPbmU9NjUzNTI7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd289NjUzNTM7cmV0dXJuIGF9KCksZGI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudGlsZUlkPS0xO2EuaG9yaXpvbnRhbEZsaXA9CiExO2EubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9LTE7cmV0dXJuIGF9KCksej1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngwPWZ1bmN0aW9uKGMpe2EuTlJ4MFN3ZWVwUGVyaW9kPShjJjExMik+PjQ7YS5OUngwTmVnYXRlPXAoMyxjKTthLk5SeDBTd2VlcFNoaWZ0PWMmN307YS51cGRhdGVOUngxPWZ1bmN0aW9uKGMpe2EuTlJ4MUR1dHk9Yz4+NiYzO2EuTlJ4MUxlbmd0aExvYWQ9YyY2MzthLmxlbmd0aENvdW50ZXI9NjQtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGMpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWM+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPXAoMyxjKTthLk5SeDJFbnZlbG9wZVBlcmlvZD1jJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYyYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYyl7YS5OUngzRnJlcXVlbmN5TFNCPWM7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGN9O2EudXBkYXRlTlJ4ND0KZnVuY3Rpb24oYyl7YS5OUng0TGVuZ3RoRW5hYmxlZD1wKDYsYyk7YyY9NzthLk5SeDRGcmVxdWVuY3lNU0I9YzthLmZyZXF1ZW5jeT1jPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzRW5hYmxlZDtlWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2VbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtlWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtlWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtlWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHk7ZVsxMDQ5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc1N3ZWVwRW5hYmxlZDtlWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwQ291bnRlcjsKZVsxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1RKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWVbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWVbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1lWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1lWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1lWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9ZVsxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1N3ZWVwRW5hYmxlZD1RKDEwNDkrNTAqYS5zYXZlU3RhdGVTbG90KTthLnN3ZWVwQ291bnRlcj1lWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XTthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PWVbMTA1NSs1MCphLnNhdmVTdGF0ZVNsb3RdfTsKYS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjgpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMTkxKTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDI0Myk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywxOTMpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGM9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYyl9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe3ZhciBjPTIwNDgtYS5mcmVxdWVuY3k8PDI7Yi5HQkNEb3VibGVTcGVlZCYmKGM8PD0yKTthLmZyZXF1ZW5jeVRpbWVyPWN9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGMpe2M9YS5mcmVxdWVuY3lUaW1lci1jO2lmKDA+PWMpe3ZhciBiPU1hdGguYWJzKGMpO2EuZnJlcXVlbmN5VGltZXI9YzthLnJlc2V0VGltZXIoKTthLmZyZXF1ZW5jeVRpbWVyLT1iO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0KYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5KzEmN31lbHNlIGEuZnJlcXVlbmN5VGltZXI9YztpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYz1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTtiPTE7JGIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYj0tYik7cmV0dXJuIGIqYysxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj02NCk7YS5yZXNldFRpbWVyKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1hLmZyZXF1ZW5jeTthLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZDthLmlzU3dlZXBFbmFibGVkPTA8YS5OUngwU3dlZXBQZXJpb2QmJjA8YS5OUngwU3dlZXBTaGlmdDswPGEuTlJ4MFN3ZWVwU2hpZnQmJmFjKCk7YS5pc0RhY0VuYWJsZWR8fAooYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGMpe2M9YS5jeWNsZUNvdW50ZXIrYzthLmN5Y2xlQ291bnRlcj1jO3JldHVybiEoMDxhLmZyZXF1ZW5jeVRpbWVyLWMpfTthLnVwZGF0ZVN3ZWVwPWZ1bmN0aW9uKCl7dmFyIGM9YS5zd2VlcENvdW50ZXItMTswPj1jPyhhLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZCxhLmlzU3dlZXBFbmFibGVkJiYwPGEuTlJ4MFN3ZWVwUGVyaW9kJiZhYygpKTphLnN3ZWVwQ291bnRlcj1jfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpe3ZhciBjPWEubGVuZ3RoQ291bnRlcjswPGMmJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYzswPT09YyYmKGEuaXNFbmFibGVkPSExKTthLmxlbmd0aENvdW50ZXI9Y307YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpe3ZhciBjPWEuZW52ZWxvcGVDb3VudGVyLTE7MD49Yz8oYS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWMmJihjPWEudm9sdW1lLAphLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmM/Yys9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGMmJi0tYyxhLnZvbHVtZT1jKSk6YS5lbnZlbG9wZUNvdW50ZXI9Y307YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYyl7dmFyIGI9Yz4+ODtjJj0yNTU7dmFyIGQ9dyhhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGI7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MyxjKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1jO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUyOTY7YS5OUngwU3dlZXBQZXJpb2Q9MDthLk5SeDBOZWdhdGU9ITE7YS5OUngwU3dlZXBTaGlmdD0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1Mjk3O2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9CjY1Mjk4O2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUyOTk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMDA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLmNoYW5uZWxOdW1iZXI9MTthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kdXR5Q3ljbGU9MDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MDthLmlzU3dlZXBFbmFibGVkPSExO2Euc3dlZXBDb3VudGVyPTA7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT0wO2Euc2F2ZVN0YXRlU2xvdD03O3JldHVybiBhfSgpLE49ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MT0KZnVuY3Rpb24oYyl7YS5OUngxRHV0eT1jPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1jJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYyl7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yz4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9cCgzLGMpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWMmNzthLmlzRGFjRW5hYmxlZD0wPChjJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihjKXthLk5SeDNGcmVxdWVuY3lMU0I9YzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8Y307YS51cGRhdGVOUng0PWZ1bmN0aW9uKGMpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9cCg2LGMpO2MmPTc7YS5OUng0RnJlcXVlbmN5TVNCPWM7YS5mcmVxdWVuY3k9Yzw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc0VuYWJsZWQ7ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09CmEuZnJlcXVlbmN5VGltZXI7ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2VbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2VbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZHV0eUN5Y2xlO2VbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1RKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWVbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWVbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1lWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1lWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1lWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTsKYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PWVbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtoKGEubWVtb3J5TG9jYXRpb25OUngxLTEsMjU1KTtoKGEubWVtb3J5TG9jYXRpb25OUngxLDYzKTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxODQpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYz1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShjKX07YS5yZXNldFRpbWVyPWZ1bmN0aW9uKCl7YS5mcmVxdWVuY3lUaW1lcj0yMDQ4LWEuZnJlcXVlbmN5PDwyPDxiLkdCQ0RvdWJsZVNwZWVkfTthLmdldFNhbXBsZT1mdW5jdGlvbihjKXtjPWEuZnJlcXVlbmN5VGltZXItYzthLmZyZXF1ZW5jeVRpbWVyPWM7MD49YyYmKGM9TWF0aC5hYnMoYyksYS5yZXNldFRpbWVyKCksYS5mcmVxdWVuY3lUaW1lci09CmMsYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSsxJjcpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCljPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBiPTE7JGIoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYj0tYik7cmV0dXJuIGIqYysxNX07YS50cmlnZ2VyPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9ITA7MD09PWEubGVuZ3RoQ291bnRlciYmKGEubGVuZ3RoQ291bnRlcj02NCk7YS5yZXNldFRpbWVyKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYyl7Yz1hLmN5Y2xlQ291bnRlcitjO2EuY3ljbGVDb3VudGVyPWM7cmV0dXJuISgwPGEuZnJlcXVlbmN5VGltZXItYyl9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7dmFyIGM9CmEubGVuZ3RoQ291bnRlcjswPGMmJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYzswPT09YyYmKGEuaXNFbmFibGVkPSExKTthLmxlbmd0aENvdW50ZXI9Y307YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpe3ZhciBjPWEuZW52ZWxvcGVDb3VudGVyLTE7aWYoMD49YyYmKGM9YS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWMpKXt2YXIgYj1hLnZvbHVtZTthLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmI/Yis9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGImJi0tYjthLnZvbHVtZT1ifWEuZW52ZWxvcGVDb3VudGVyPWN9O2Euc2V0RnJlcXVlbmN5PWZ1bmN0aW9uKGMpe3ZhciBiPWM+Pjg7YyY9MjU1O3ZhciBkPXcoYS5tZW1vcnlMb2NhdGlvbk5SeDQpJjI0OHxiO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsYyk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCxkKTthLk5SeDNGcmVxdWVuY3lMU0I9YzthLk5SeDRGcmVxdWVuY3lNU0I9YjthLmZyZXF1ZW5jeT1iPDw4fGN9O2EuY3ljbGVDb3VudGVyPQowO2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzAyO2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDM7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMwNDthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMwNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EuY2hhbm5lbE51bWJlcj0yO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wO2Euc2F2ZVN0YXRlU2xvdD04O3JldHVybiBhfSgpLEo9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYyl7YS5pc0RhY0VuYWJsZWQ9cCg3LGMpfTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYyl7YS5OUngxTGVuZ3RoTG9hZD1jO2EubGVuZ3RoQ291bnRlcj0yNTYtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGMpe2EuTlJ4MlZvbHVtZUNvZGU9Yz4+NSYxNX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGMpe2EuTlJ4M0ZyZXF1ZW5jeUxTQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxjfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYyl7YS5OUng0TGVuZ3RoRW5hYmxlZD1wKDYsYyk7YyY9NzthLk5SeDRGcmVxdWVuY3lNU0I9YzthLmZyZXF1ZW5jeT1jPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzRW5hYmxlZDtlWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPQphLmxlbmd0aENvdW50ZXI7ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlVGFibGVQb3NpdGlvbn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1RKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWVbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1lWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVUYWJsZVBvc2l0aW9uPWVbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtoKGEubWVtb3J5TG9jYXRpb25OUngwLDEyNyk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MSwyNTUpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDIsMTU5KTtoKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KTthLnZvbHVtZUNvZGVDaGFuZ2VkPSEwfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYz1hLmN5Y2xlQ291bnRlcjsKYS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYyl9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9MjA0OC1hLmZyZXF1ZW5jeTw8MTw8Yi5HQkNEb3VibGVTcGVlZH07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYyl7dmFyIGI9YS5mcmVxdWVuY3lUaW1lcjtiLT1jOzA+PWI/KGM9TWF0aC5hYnMoYiksYS5mcmVxdWVuY3lUaW1lcj1iLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPWMsYS53YXZlVGFibGVQb3NpdGlvbj1hLndhdmVUYWJsZVBvc2l0aW9uKzEmMzEpOmEuZnJlcXVlbmN5VGltZXI9YjtiPWEudm9sdW1lQ29kZTtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYS52b2x1bWVDb2RlQ2hhbmdlZCYmKGI9dyhhLm1lbW9yeUxvY2F0aW9uTlJ4MiksYj1iPj41JjE1LGEudm9sdW1lQ29kZT1iLGEudm9sdW1lQ29kZUNoYW5nZWQ9ITEpO2Vsc2UgcmV0dXJuIDE1O3ZhciBkPWEud2F2ZVRhYmxlUG9zaXRpb247Yz13KGEubWVtb3J5TG9jYXRpb25XYXZlVGFibGUrCihkPj4xfDApKTtjPWM+PigoMD09PShkJjEpKTw8MikmMTU7ZD0wO3N3aXRjaChiKXtjYXNlIDA6Yz4+PTQ7YnJlYWs7Y2FzZSAxOmQ9MTticmVhaztjYXNlIDI6Yz4+PTE7ZD0yO2JyZWFrO2RlZmF1bHQ6Yz4+PTIsZD00fXJldHVybiBjPSgwPGQ/Yy9kOjApKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTI1Nik7YS5yZXNldFRpbWVyKCk7YS53YXZlVGFibGVQb3NpdGlvbj0wO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGMpe2EuY3ljbGVDb3VudGVyKz1jO3JldHVybiEoIWEudm9sdW1lQ29kZUNoYW5nZWQmJjA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcil9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7dmFyIGM9YS5sZW5ndGhDb3VudGVyOzA8YyYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1jOzA9PT1jJiYKKGEuaXNFbmFibGVkPSExKTthLmxlbmd0aENvdW50ZXI9Y307YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MD02NTMwNjthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTMwNzthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDg7YS5OUngyVm9sdW1lQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA5O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzEwO2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZT02NTMyODthLmNoYW5uZWxOdW1iZXI9MzthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLndhdmVUYWJsZVBvc2l0aW9uPTA7YS52b2x1bWVDb2RlPTA7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9Cjk7cmV0dXJuIGF9KCksTz1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngxPWZ1bmN0aW9uKGMpe2EuTlJ4MUxlbmd0aExvYWQ9YyY2MzthLmxlbmd0aENvdW50ZXI9NjQtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGMpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWM+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPXAoMyxjKTthLk5SeDJFbnZlbG9wZVBlcmlvZD1jJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYyYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYyl7dmFyIGI9YyY3O2EuTlJ4M0Nsb2NrU2hpZnQ9Yz4+NDthLk5SeDNXaWR0aE1vZGU9cCgzLGMpO2EuTlJ4M0Rpdmlzb3JDb2RlPWI7Yjw8PTE7MT5iJiYoYj0xKTthLmRpdmlzb3I9Yjw8M307YS51cGRhdGVOUng0PWZ1bmN0aW9uKGMpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9cCg2LGMpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuaXNFbmFibGVkOwplWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2VbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtlWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtlWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1RKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWVbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWVbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1lWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1lWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj1lWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XX07CmEuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2goYS5tZW1vcnlMb2NhdGlvbk5SeDEtMSwyNTUpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtoKGEubWVtb3J5TG9jYXRpb25OUngyLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxOTEpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYz1hLmN5Y2xlQ291bnRlcjthLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShjKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYyl7dmFyIGI9YS5mcmVxdWVuY3lUaW1lcjtiLT1jO2lmKDA+PWIpe2M9TWF0aC5hYnMoYik7Yj1hLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZCgpO2ItPWM7Yz1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcjt2YXIgZD1jJjFeYz4+MSYxO2M9Yz4+MXxkPDwxNDthLk5SeDNXaWR0aE1vZGUmJihjPWMmLTY1fGQ8PDYpO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPQpjfWEuZnJlcXVlbmN5VGltZXI9YjtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTtjPXAoMCxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcik/LTE6MTtyZXR1cm4gYypiKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLmZyZXF1ZW5jeVRpbWVyPWEuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MzI3Njc7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYyl7YS5jeWNsZUNvdW50ZXIrPWM7cmV0dXJuISgwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXIpfTthLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZD0KZnVuY3Rpb24oKXtyZXR1cm4gYS5kaXZpc29yPDxhLk5SeDNDbG9ja1NoaWZ0PDxiLkdCQ0RvdWJsZVNwZWVkfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpe3ZhciBjPWEubGVuZ3RoQ291bnRlcjswPGMmJmEuTlJ4NExlbmd0aEVuYWJsZWQmJi0tYzswPT09YyYmKGEuaXNFbmFibGVkPSExKTthLmxlbmd0aENvdW50ZXI9Y307YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpe3ZhciBjPWEuZW52ZWxvcGVDb3VudGVyLTE7aWYoMD49YyYmKGM9YS5OUngyRW52ZWxvcGVQZXJpb2QsMCE9PWMpKXt2YXIgYj1hLnZvbHVtZTthLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmI/Yis9MTohYS5OUngyRW52ZWxvcGVBZGRNb2RlJiYwPGImJi0tYjthLnZvbHVtZT1ifWEuZW52ZWxvcGVDb3VudGVyPWN9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMTI7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1MzEzO2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPQowO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzE0O2EuTlJ4M0Nsb2NrU2hpZnQ9MDthLk5SeDNXaWR0aE1vZGU9ITE7YS5OUngzRGl2aXNvckNvZGU9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMxNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuY2hhbm5lbE51bWJlcj00O2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kaXZpc29yPTA7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MDthLnNhdmVTdGF0ZVNsb3Q9MTA7cmV0dXJuIGF9KCkscT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5jaGFubmVsMVNhbXBsZT0xNTthLmNoYW5uZWwyU2FtcGxlPTE1O2EuY2hhbm5lbDNTYW1wbGU9MTU7YS5jaGFubmVsNFNhbXBsZT0xNTthLmNoYW5uZWwxRGFjRW5hYmxlZD0KITE7YS5jaGFubmVsMkRhY0VuYWJsZWQ9ITE7YS5jaGFubmVsM0RhY0VuYWJsZWQ9ITE7YS5jaGFubmVsNERhY0VuYWJsZWQ9ITE7YS5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7YS5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O2EubWl4ZXJWb2x1bWVDaGFuZ2VkPSExO2EubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTthLm5lZWRUb1JlbWl4U2FtcGxlcz0hMTtyZXR1cm4gYX0oKSxrPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiA4Nzw8Yi5HQkNEb3VibGVTcGVlZH07YS51cGRhdGVOUjUwPWZ1bmN0aW9uKGIpe2EuTlI1MExlZnRNaXhlclZvbHVtZT1iPj40Jjc7YS5OUjUwUmlnaHRNaXhlclZvbHVtZT1iJjd9O2EudXBkYXRlTlI1MT1mdW5jdGlvbihiKXthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD1wKDcsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9CnAoNixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD1wKDUsYik7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9cCg0LGIpO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD1wKDMsYik7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PXAoMixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9cCgxLGIpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD1wKDAsYil9O2EudXBkYXRlTlI1Mj1mdW5jdGlvbihiKXthLk5SNTJJc1NvdW5kRW5hYmxlZD1wKDcsYil9O2EubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcz1mdW5jdGlvbigpe3JldHVybiA4MTkyPDxiLkdCQ0RvdWJsZVNwZWVkfTthLm1heERvd25TYW1wbGVDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5DTE9DS19TUEVFRCgpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcjsKZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyO2VbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZXJ9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWVbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj1lWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmZyYW1lU2VxdWVuY2VyPWVbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2VjKCl9O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25OUjUwPTY1MzE2O2EuTlI1MExlZnRNaXhlclZvbHVtZT0wO2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9MDthLm1lbW9yeUxvY2F0aW9uTlI1MT02NTMxNzthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD0KITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EubWVtb3J5TG9jYXRpb25OUjUyPTY1MzE4O2EuTlI1MklzU291bmRFbmFibGVkPSEwO2EubWVtb3J5TG9jYXRpb25DaGFubmVsM0xvYWRSZWdpc3RlclN0YXJ0PTY1MzI4O2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcj00OEUzO2EuZnJhbWVTZXF1ZW5jZXI9MDthLmF1ZGlvUXVldWVJbmRleD0wO2Eud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemU9MTMxMDcyO2Euc2F2ZVN0YXRlU2xvdD02O3JldHVybiBhfSgpLG09ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fQphLnVwZGF0ZUludGVycnVwdEVuYWJsZWQ9ZnVuY3Rpb24oYil7YS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQ9cChhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPXAoYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPXAoYS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0LGIpO2EuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkPXAoYS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCxiKTthLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZD1wKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlPWJ9O2EudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkPWZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cChhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cChhLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0LApiKTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cChhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD1wKGEuYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD1wKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9Yn07YS5hcmVJbnRlcnJ1cHRzUGVuZGluZz1mdW5jdGlvbigpe3JldHVybiAwPChhLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSZhLmludGVycnVwdHNFbmFibGVkVmFsdWUmMzEpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEubWFzdGVySW50ZXJydXB0U3dpdGNoO2VbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9USgxMDI0Kwo1MCphLnNhdmVTdGF0ZVNsb3QpO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9USgxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKHcoYS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQpKTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCh3KGEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KSl9O2EubWFzdGVySW50ZXJydXB0U3dpdGNoPSExO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ITE7YS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdD0wO2EuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ9MTthLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ9MjthLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0PTM7YS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdD00O2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkPTY1NTM1O2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT0wO2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPQohMTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkPSExO2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0PTY1Mjk1O2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPTA7YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTI7cmV0dXJuIGF9KCksdT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gMjU2fTthLnVwZGF0ZURpdmlkZXJSZWdpc3Rlcj1mdW5jdGlvbigpe3ZhciBiPWEuZGl2aWRlclJlZ2lzdGVyOwphLmRpdmlkZXJSZWdpc3Rlcj0wO2goYS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlciwwKTthLnRpbWVyRW5hYmxlZCYmZ2MoYiwwKSYmSWIoKX07YS51cGRhdGVUaW1lckNvdW50ZXI9ZnVuY3Rpb24oYil7aWYoYS50aW1lckVuYWJsZWQpe2lmKGEudGltZXJDb3VudGVyV2FzUmVzZXQpcmV0dXJuO2EudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheSYmKGEudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMSl9YS50aW1lckNvdW50ZXI9Yn07YS51cGRhdGVUaW1lck1vZHVsbz1mdW5jdGlvbihiKXthLnRpbWVyTW9kdWxvPWI7YS50aW1lckVuYWJsZWQmJmEudGltZXJDb3VudGVyV2FzUmVzZXQmJihhLnRpbWVyQ291bnRlcj1iLGEudGltZXJDb3VudGVyV2FzUmVzZXQ9ITEpfTthLnVwZGF0ZVRpbWVyQ29udHJvbD1mdW5jdGlvbihiKXt2YXIgYz1hLnRpbWVyRW5hYmxlZDthLnRpbWVyRW5hYmxlZD1wKDIsYik7YiY9MztpZighYyl7Yz1KYihhLnRpbWVySW5wdXRDbG9jayk7dmFyIGQ9CkpiKGIpLGU9YS5kaXZpZGVyUmVnaXN0ZXI7KGEudGltZXJFbmFibGVkP3AoYyxlKTpwKGMsZSkmJnAoZCxlKSkmJkliKCl9YS50aW1lcklucHV0Q2xvY2s9Yn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtlWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRDeWNsZXM7ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kaXZpZGVyUmVnaXN0ZXI7ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5O2VbMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudGltZXJDb3VudGVyV2FzUmVzZXQ7aChhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyLGEudGltZXJDb3VudGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRDeWNsZXM9ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kaXZpZGVyUmVnaXN0ZXI9ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PVEoMTAzMisKNTAqYS5zYXZlU3RhdGVTbG90KTthLnRpbWVyQ291bnRlcldhc1Jlc2V0PVEoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyPXcoYS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcik7YS50aW1lck1vZHVsbz13KGEubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbyk7YS50aW1lcklucHV0Q2xvY2s9dyhhLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKX07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3Rlcj02NTI4NDthLmRpdmlkZXJSZWdpc3Rlcj0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI9NjUyODU7YS50aW1lckNvdW50ZXI9MDthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7YS50aW1lckNvdW50ZXJXYXNSZXNldD0hMTthLnRpbWVyQ291bnRlck1hc2s9MDthLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG89NjUyODY7YS50aW1lck1vZHVsbz0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w9NjUyODc7CmEudGltZXJFbmFibGVkPSExO2EudGltZXJJbnB1dENsb2NrPTA7YS5zYXZlU3RhdGVTbG90PTU7cmV0dXJuIGF9KCksWj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVUcmFuc2ZlckNvbnRyb2w9ZnVuY3Rpb24oYil7YS5pc1NoaWZ0Q2xvY2tJbnRlcm5hbD1wKDAsYik7YS5pc0Nsb2NrU3BlZWRGYXN0PXAoMSxiKTthLnRyYW5zZmVyU3RhcnRGbGFnPXAoNyxiKTtyZXR1cm4hMH07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyRGF0YT02NTI4MTthLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sPTY1MjgyO2EubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9MDthLmlzU2hpZnRDbG9ja0ludGVybmFsPSExO2EuaXNDbG9ja1NwZWVkRmFzdD0hMTthLnRyYW5zZmVyU3RhcnRGbGFnPSExO3JldHVybiBhfSgpLEE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSm95cGFkPWZ1bmN0aW9uKGIpe2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPQpiXjI1NTthLmlzRHBhZFR5cGU9cCg0LGEuam95cGFkUmVnaXN0ZXJGbGlwcGVkKTthLmlzQnV0dG9uVHlwZT1wKDUsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe307YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnVwZGF0ZUpveXBhZCh3KGEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3RlcikpfTthLnVwPSExO2EuZG93bj0hMTthLmxlZnQ9ITE7YS5yaWdodD0hMTthLmE9ITE7YS5iPSExO2Euc2VsZWN0PSExO2Euc3RhcnQ9ITE7YS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyPTY1MjgwO2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPTA7YS5pc0RwYWRUeXBlPSExO2EuaXNCdXR0b25UeXBlPSExO2Euc2F2ZVN0YXRlU2xvdD0zO3JldHVybiBhfSgpLGFhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnByb2dyYW1Db3VudGVyPS0xO2EucmVhZEdiTWVtb3J5PS0xO2Eud3JpdGVHYk1lbW9yeT0tMTthLnJlYWNoZWRCcmVha3BvaW50PSExOwpyZXR1cm4gYX0oKSx5PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZUxjZFN0YXR1cz1mdW5jdGlvbihiKXt2YXIgYz13KGEubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO2I9YiYyNDh8YyY3fDEyODtoKGEubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsYil9O2EudXBkYXRlTGNkQ29udHJvbD1mdW5jdGlvbihiKXt2YXIgYz1hLmVuYWJsZWQ7YS5lbmFibGVkPXAoNyxiKTthLndpbmRvd1RpbGVNYXBEaXNwbGF5U2VsZWN0PXAoNixiKTthLndpbmRvd0Rpc3BsYXlFbmFibGVkPXAoNSxiKTthLmJnV2luZG93VGlsZURhdGFTZWxlY3Q9cCg0LGIpO2EuYmdUaWxlTWFwRGlzcGxheVNlbGVjdD1wKDMsYik7YS50YWxsU3ByaXRlU2l6ZT1wKDIsYik7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPXAoMSxiKTthLmJnRGlzcGxheUVuYWJsZWQ9cCgwLGIpO2MmJiFhLmVuYWJsZWQmJmpjKCEwKTshYyYmYS5lbmFibGVkJiZqYyghMSl9O2EubWVtb3J5TG9jYXRpb25MY2RTdGF0dXM9NjUzNDU7CmEuY3VycmVudExjZE1vZGU9MDthLm1lbW9yeUxvY2F0aW9uQ29pbmNpZGVuY2VDb21wYXJlPTY1MzQ5O2EuY29pbmNpZGVuY2VDb21wYXJlPTA7YS5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2w9NjUzNDQ7YS5lbmFibGVkPSEwO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD0hMTthLmJnV2luZG93VGlsZURhdGFTZWxlY3Q9ITE7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PSExO2EudGFsbFNwcml0ZVNpemU9ITE7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPSExO2EuYmdEaXNwbGF5RW5hYmxlZD0hMTtyZXR1cm4gYX0oKSxyPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBhLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCl9O2EuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkU9ZnVuY3Rpb24oKXtyZXR1cm4gMTUzPT09YS5zY2FubGluZVJlZ2lzdGVyPzQ8PGIuR0JDRG91YmxlU3BlZWQ6CjQ1Njw8Yi5HQkNEb3VibGVTcGVlZH07YS5NSU5fQ1lDTEVTX1NQUklURVNfTENEX01PREU9ZnVuY3Rpb24oKXtyZXR1cm4gMzc2PDxiLkdCQ0RvdWJsZVNwZWVkfTthLk1JTl9DWUNMRVNfVFJBTlNGRVJfREFUQV9MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiAyNDk8PGIuR0JDRG91YmxlU3BlZWR9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7ZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zY2FubGluZUN5Y2xlQ291bnRlcjtlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT15LmN1cnJlbnRMY2RNb2RlO2goYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsYS5zY2FubGluZVJlZ2lzdGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnNjYW5saW5lQ3ljbGVDb3VudGVyPWVbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO3kuY3VycmVudExjZE1vZGU9ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zY2FubGluZVJlZ2lzdGVyPXcoYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpOwp5LnVwZGF0ZUxjZENvbnRyb2wodyh5Lm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbCkpfTthLmN1cnJlbnRDeWNsZXM9MDthLnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXI9NjUzNDg7YS5zY2FubGluZVJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyPTY1MzUwO2EubWVtb3J5TG9jYXRpb25TY3JvbGxYPTY1MzQ3O2Euc2Nyb2xsWD0wO2EubWVtb3J5TG9jYXRpb25TY3JvbGxZPTY1MzQ2O2Euc2Nyb2xsWT0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dYPTY1MzU1O2Eud2luZG93WD0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dZPTY1MzU0O2Eud2luZG93WT0wO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0PTM4OTEyO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQ9Mzk5MzY7YS5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0PTM0ODE2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0PQozMjc2ODthLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlPTY1MDI0O2EubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZT02NTM1MTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZT02NTM1MjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bz02NTM1MzthLnNhdmVTdGF0ZVNsb3Q9MTtyZXR1cm4gYX0oKSxnPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudFJvbUJhbms7ZVsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50UmFtQmFuaztlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzUmFtQmFua2luZ0VuYWJsZWQ7ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzFSb21Nb2RlRW5hYmxlZDtlWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzUm9tT25seTtlWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5pc01CQzE7ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzI7ZVsxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzM7ZVsxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5pc01CQzV9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5jdXJyZW50Um9tQmFuaz1lWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRSYW1CYW5rPWVbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNSYW1CYW5raW5nRW5hYmxlZD1RKDEwMjgrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPVEoMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNSb21Pbmx5PVEoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxPVEoMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMyPVEoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMzPVEoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkM1PVEoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpfTsKYS5jYXJ0cmlkZ2VSb21Mb2NhdGlvbj0wO2Euc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uPTE2Mzg0O2EudmlkZW9SYW1Mb2NhdGlvbj0zMjc2ODthLmNhcnRyaWRnZVJhbUxvY2F0aW9uPTQwOTYwO2EuaW50ZXJuYWxSYW1CYW5rWmVyb0xvY2F0aW9uPTQ5MTUyO2EuaW50ZXJuYWxSYW1CYW5rT25lTG9jYXRpb249NTMyNDg7YS5lY2hvUmFtTG9jYXRpb249NTczNDQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb249NjUwMjQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQ9NjUxODM7YS51bnVzYWJsZU1lbW9yeUxvY2F0aW9uPTY1MTg0O2EudW51c2FibGVNZW1vcnlFbmRMb2NhdGlvbj02NTI3OTthLmN1cnJlbnRSb21CYW5rPTA7YS5jdXJyZW50UmFtQmFuaz0wO2EuaXNSYW1CYW5raW5nRW5hYmxlZD0hMTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPSEwO2EuaXNSb21Pbmx5PSEwO2EuaXNNQkMxPSExO2EuaXNNQkMyPSExO2EuaXNNQkMzPSExO2EuaXNNQkM1PQohMTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUhpZ2g9NjUzNjE7YS5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VMb3c9NjUzNjI7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkhpZ2g9NjUzNjM7YS5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkxvdz02NTM2NDthLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXI9NjUzNjU7YS5ETUFDeWNsZXM9MDthLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMTthLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz0wO2EuaGJsYW5rSGRtYVNvdXJjZT0wO2EuaGJsYW5rSGRtYURlc3RpbmF0aW9uPTA7YS5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rPTY1MzU5O2EubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaz02NTM5MjthLnNhdmVTdGF0ZVNsb3Q9NDtyZXR1cm4gYX0oKSxiPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLkNMT0NLX1NQRUVEPWZ1bmN0aW9uKCl7cmV0dXJuIDQxOTQzMDQ8PGEuR0JDRG91YmxlU3BlZWR9O2EuTUFYX0NZQ0xFU19QRVJfRlJBTUU9CmZ1bmN0aW9uKCl7cmV0dXJuIDcwMjI0PDxhLkdCQ0RvdWJsZVNwZWVkfTthLmVuYWJsZUhhbHQ9ZnVuY3Rpb24oKXttLm1hc3RlckludGVycnVwdFN3aXRjaD9hLmlzSGFsdE5vcm1hbD0hMDowPT09KG0uaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSZtLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYzMSk/YS5pc0hhbHROb0p1bXA9ITA6YS5pc0hhbHRCdWc9ITB9O2EuZXhpdEhhbHRBbmRTdG9wPWZ1bmN0aW9uKCl7YS5pc0hhbHROb0p1bXA9ITE7YS5pc0hhbHROb3JtYWw9ITE7YS5pc0hhbHRCdWc9ITE7YS5pc1N0b3BwZWQ9ITF9O2EuaXNIYWx0ZWQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5pc0hhbHROb3JtYWx8fGEuaXNIYWx0Tm9KdW1wfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2VbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJBO2VbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJCO2VbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJDOwplWzEwMjcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRDtlWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRTtlWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVySDtlWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyTDtlWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRjtlWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN0YWNrUG9pbnRlcjtlWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnByb2dyYW1Db3VudGVyO2VbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztlWzEwNDErNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzSGFsdE5vcm1hbDtlWzEwNDIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzSGFsdE5vSnVtcDtlWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzSGFsdEJ1ZztlWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmlzU3RvcHBlZH07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnJlZ2lzdGVyQT0KZVsxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckI9ZVsxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckM9ZVsxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckQ9ZVsxMDI3KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckU9ZVsxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckg9ZVsxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckw9ZVsxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckY9ZVsxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zdGFja1BvaW50ZXI9ZVsxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5wcm9ncmFtQ291bnRlcj1lWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRDeWNsZXM9ZVsxMDM2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc0hhbHROb3JtYWw9USgxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc0hhbHROb0p1bXA9USgxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7CmEuaXNIYWx0QnVnPVEoMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNTdG9wcGVkPVEoMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLkdCQ0VuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPTY1MzU3O2EuR0JDRG91YmxlU3BlZWQ9ITE7YS5yZWdpc3RlckE9MDthLnJlZ2lzdGVyQj0wO2EucmVnaXN0ZXJDPTA7YS5yZWdpc3RlckQ9MDthLnJlZ2lzdGVyRT0wO2EucmVnaXN0ZXJIPTA7YS5yZWdpc3Rlckw9MDthLnJlZ2lzdGVyRj0wO2Euc3RhY2tQb2ludGVyPTA7YS5wcm9ncmFtQ291bnRlcj0wO2EuY3VycmVudEN5Y2xlcz0wO2EuaXNIYWx0Tm9ybWFsPSExO2EuaXNIYWx0Tm9KdW1wPSExO2EuaXNIYWx0QnVnPSExO2EuaXNTdG9wcGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0wO3JldHVybiBhfSgpLGRhPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTthLmN5Y2xlU2V0cz0wO2EuY3ljbGVzPTA7cmV0dXJuIGF9KCksVz0KZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc3RlcHNQZXJTdGVwU2V0PTJFOTthLnN0ZXBTZXRzPTA7YS5zdGVwcz0wO2EuUkVTUE9OU0VfQ09ORElUSU9OX0VSUk9SPS0xO2EuUkVTUE9OU0VfQ09ORElUSU9OX0ZSQU1FPTA7YS5SRVNQT05TRV9DT05ESVRJT05fQVVESU89MTthLlJFU1BPTlNFX0NPTkRJVElPTl9CUkVBS1BPSU5UPTI7cmV0dXJuIGF9KCk7bGIuc2l6ZSgpPFZiJiZsYi5ncm93KFZiLWxiLnNpemUoKSk7dmFyIGpiPSExLFZjPU9iamVjdC5mcmVlemUoe21lbW9yeTpsYixjb25maWc6ZnVuY3Rpb24oYSxjLGUsbCxmLHAsbix0LEMsdil7Uy5lbmFibGVCb290Um9tPTA8YTtTLnVzZUdiY1doZW5BdmFpbGFibGU9MDxjO1MuYXVkaW9CYXRjaFByb2Nlc3Npbmc9MDxlO1MuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmc9MDxsO1MudGltZXJzQmF0Y2hQcm9jZXNzaW5nPTA8ZjtTLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPTA8cDtTLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXM9CjA8bjtTLnRpbGVSZW5kZXJpbmc9MDx0O1MudGlsZUNhY2hpbmc9MDxDO1MuZW5hYmxlQXVkaW9EZWJ1Z2dpbmc9MDx2O2E9dygzMjMpO2IuR0JDRW5hYmxlZD0xOTI9PT1hfHxTLnVzZUdiY1doZW5BdmFpbGFibGUmJjEyOD09PWE/ITA6ITE7Yi5HQkNEb3VibGVTcGVlZD0hMTtiLnJlZ2lzdGVyQT0wO2IucmVnaXN0ZXJCPTA7Yi5yZWdpc3RlckM9MDtiLnJlZ2lzdGVyRD0wO2IucmVnaXN0ZXJFPTA7Yi5yZWdpc3Rlckg9MDtiLnJlZ2lzdGVyTD0wO2IucmVnaXN0ZXJGPTA7Yi5zdGFja1BvaW50ZXI9MDtiLnByb2dyYW1Db3VudGVyPTA7Yi5jdXJyZW50Q3ljbGVzPTA7Yi5pc0hhbHROb3JtYWw9ITE7Yi5pc0hhbHROb0p1bXA9ITE7Yi5pc0hhbHRCdWc9ITE7Yi5pc1N0b3BwZWQ9ITE7Yi5HQkNFbmFibGVkPyhiLnJlZ2lzdGVyQT0xNyxiLnJlZ2lzdGVyRj0xMjgsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0wLGIucmVnaXN0ZXJEPTI1NSxiLnJlZ2lzdGVyRT04NixiLnJlZ2lzdGVySD0KMCxiLnJlZ2lzdGVyTD0xMyk6KGIucmVnaXN0ZXJBPTEsYi5yZWdpc3RlckY9MTc2LGIucmVnaXN0ZXJCPTAsYi5yZWdpc3RlckM9MTksYi5yZWdpc3RlckQ9MCxiLnJlZ2lzdGVyRT0yMTYsYi5yZWdpc3Rlckg9MSxiLnJlZ2lzdGVyTD03Nyk7Yi5wcm9ncmFtQ291bnRlcj0yNTY7Yi5zdGFja1BvaW50ZXI9NjU1MzQ7Zy5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2cuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YT13KDMyNyk7Zy5pc1JvbU9ubHk9MD09PWE7Zy5pc01CQzE9MTw9YSYmMz49YTtnLmlzTUJDMj01PD1hJiY2Pj1hO2cuaXNNQkMzPTE1PD1hJiYxOT49YTtnLmlzTUJDNT0yNTw9YSYmMzA+PWE7Zy5jdXJyZW50Um9tQmFuaz0xO2cuY3VycmVudFJhbUJhbms9MDtoKDY1MzYxLDI1NSk7aCg2NTM2MiwyNTUpO2goNjUzNjMsMjU1KTtoKDY1MzY0LDI1NSk7aCg2NTM2NSwyNTUpO3IuY3VycmVudEN5Y2xlcz0wO3Iuc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDtyLnNjYW5saW5lUmVnaXN0ZXI9CjA7ci5zY3JvbGxYPTA7ci5zY3JvbGxZPTA7ci53aW5kb3dYPTA7ci53aW5kb3dZPTA7ci5zY2FubGluZVJlZ2lzdGVyPTE0NDtiLkdCQ0VuYWJsZWQ/KGgoNjUzNDQsMTQ1KSxoKDY1MzQ1LDEyOSksaCg2NTM0OCwxNDQpLGgoNjUzNTEsMjUyKSk6KGgoNjUzNDQsMTQ1KSxoKDY1MzQ1LDEzMyksaCg2NTM1MCwyNTUpLGgoNjUzNTEsMjUyKSxoKDY1MzUyLDI1NSksaCg2NTM1MywyNTUpKTtoKDY1MzU5LDApO2goNjUzOTIsMSk7WWIoMCk7YT0wO2ZvcihjPTMwODszMjM+PWM7YysrKWErPXcoYyk7c3dpdGNoKGEmMjU1KXtjYXNlIDEzNjpkLmJnV2hpdGU9d2EuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PXdhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT13YS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz13YS5iZ0JsYWNrO2Qub2JqMFdoaXRlPXdhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9d2Eub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT13YS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9CndhLm9iajBCbGFjaztkLm9iajFXaGl0ZT13YS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PXdhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9d2Eub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPXdhLm9iajFCbGFjazticmVhaztjYXNlIDk3OmQuYmdXaGl0ZT14YS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9eGEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXhhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXhhLmJnQmxhY2s7ZC5vYmowV2hpdGU9eGEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT14YS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXhhLm9iajBEYXJrR3JleTtkLm9iajBCbGFjaz14YS5vYmowQmxhY2s7ZC5vYmoxV2hpdGU9eGEub2JqMVdoaXRlO2Qub2JqMUxpZ2h0R3JleT14YS5vYmoxTGlnaHRHcmV5O2Qub2JqMURhcmtHcmV5PXhhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz14YS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAyMDpkLmJnV2hpdGU9eWEuYmdXaGl0ZTsKZC5iZ0xpZ2h0R3JleT15YS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9eWEuYmdEYXJrR3JleTtkLmJnQmxhY2s9eWEuYmdCbGFjaztkLm9iajBXaGl0ZT15YS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PXlhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9eWEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPXlhLm9iajBCbGFjaztkLm9iajFXaGl0ZT15YS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PXlhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9eWEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPXlhLm9iajFCbGFjazticmVhaztjYXNlIDcwOmQuYmdXaGl0ZT16YS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9emEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PXphLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPXphLmJnQmxhY2s7ZC5vYmowV2hpdGU9emEub2JqMFdoaXRlO2Qub2JqMExpZ2h0R3JleT16YS5vYmowTGlnaHRHcmV5O2Qub2JqMERhcmtHcmV5PXphLm9iajBEYXJrR3JleTsKZC5vYmowQmxhY2s9emEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPXphLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9emEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT16YS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9emEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgODk6Y2FzZSAxOTg6ZC5iZ1doaXRlPUFhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1BYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9QWEuYmdEYXJrR3JleTtkLmJnQmxhY2s9QWEuYmdCbGFjaztkLm9iajBXaGl0ZT1BYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PUFhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9QWEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPUFhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1BYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PUFhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9QWEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPUFhLm9iajFCbGFjazticmVhaztjYXNlIDEzNDpjYXNlIDE2ODpkLmJnV2hpdGU9CkJhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1CYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9QmEuYmdEYXJrR3JleTtkLmJnQmxhY2s9QmEuYmdCbGFjaztkLm9iajBXaGl0ZT1CYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PUJhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9QmEub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPUJhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1CYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PUJhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9QmEub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPUJhLm9iajFCbGFjazticmVhaztjYXNlIDE5MTpjYXNlIDIwNjpjYXNlIDIwOTpjYXNlIDI0MDpkLmJnV2hpdGU9Q2EuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PUNhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1DYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1DYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPUNhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9Q2Eub2JqMExpZ2h0R3JleTsKZC5vYmowRGFya0dyZXk9Q2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPUNhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1DYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PUNhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9Q2Eub2JqMURhcmtHcmV5O2Qub2JqMUJsYWNrPUNhLm9iajFCbGFjazticmVhaztjYXNlIDM5OmNhc2UgNzM6Y2FzZSA5MjpjYXNlIDE3OTpkLmJnV2hpdGU9RGEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PURhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1EYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1EYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPURhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9RGEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1EYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9RGEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPURhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9RGEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1EYS5vYmoxRGFya0dyZXk7CmQub2JqMUJsYWNrPURhLm9iajFCbGFjazticmVhaztjYXNlIDIwMTpkLmJnV2hpdGU9RWEuYmdXaGl0ZTtkLmJnTGlnaHRHcmV5PUVhLmJnTGlnaHRHcmV5O2QuYmdEYXJrR3JleT1FYS5iZ0RhcmtHcmV5O2QuYmdCbGFjaz1FYS5iZ0JsYWNrO2Qub2JqMFdoaXRlPUVhLm9iajBXaGl0ZTtkLm9iajBMaWdodEdyZXk9RWEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1FYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9RWEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPUVhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9RWEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1FYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9RWEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgMTEyOmQuYmdXaGl0ZT1GYS5iZ1doaXRlO2QuYmdMaWdodEdyZXk9RmEuYmdMaWdodEdyZXk7ZC5iZ0RhcmtHcmV5PUZhLmJnRGFya0dyZXk7ZC5iZ0JsYWNrPUZhLmJnQmxhY2s7ZC5vYmowV2hpdGU9RmEub2JqMFdoaXRlOwpkLm9iajBMaWdodEdyZXk9RmEub2JqMExpZ2h0R3JleTtkLm9iajBEYXJrR3JleT1GYS5vYmowRGFya0dyZXk7ZC5vYmowQmxhY2s9RmEub2JqMEJsYWNrO2Qub2JqMVdoaXRlPUZhLm9iajFXaGl0ZTtkLm9iajFMaWdodEdyZXk9RmEub2JqMUxpZ2h0R3JleTtkLm9iajFEYXJrR3JleT1GYS5vYmoxRGFya0dyZXk7ZC5vYmoxQmxhY2s9RmEub2JqMUJsYWNrO2JyZWFrO2Nhc2UgNzA6ZC5iZ1doaXRlPUdhLmJnV2hpdGU7ZC5iZ0xpZ2h0R3JleT1HYS5iZ0xpZ2h0R3JleTtkLmJnRGFya0dyZXk9R2EuYmdEYXJrR3JleTtkLmJnQmxhY2s9R2EuYmdCbGFjaztkLm9iajBXaGl0ZT1HYS5vYmowV2hpdGU7ZC5vYmowTGlnaHRHcmV5PUdhLm9iajBMaWdodEdyZXk7ZC5vYmowRGFya0dyZXk9R2Eub2JqMERhcmtHcmV5O2Qub2JqMEJsYWNrPUdhLm9iajBCbGFjaztkLm9iajFXaGl0ZT1HYS5vYmoxV2hpdGU7ZC5vYmoxTGlnaHRHcmV5PUdhLm9iajFMaWdodEdyZXk7ZC5vYmoxRGFya0dyZXk9CkdhLm9iajFEYXJrR3JleTtkLm9iajFCbGFjaz1HYS5vYmoxQmxhY2s7YnJlYWs7Y2FzZSAyMTE6ZC5iZ1doaXRlPUhhLmJnV2hpdGUsZC5iZ0xpZ2h0R3JleT1IYS5iZ0xpZ2h0R3JleSxkLmJnRGFya0dyZXk9SGEuYmdEYXJrR3JleSxkLmJnQmxhY2s9SGEuYmdCbGFjayxkLm9iajBXaGl0ZT1IYS5vYmowV2hpdGUsZC5vYmowTGlnaHRHcmV5PUhhLm9iajBMaWdodEdyZXksZC5vYmowRGFya0dyZXk9SGEub2JqMERhcmtHcmV5LGQub2JqMEJsYWNrPUhhLm9iajBCbGFjayxkLm9iajFXaGl0ZT1IYS5vYmoxV2hpdGUsZC5vYmoxTGlnaHRHcmV5PUhhLm9iajFMaWdodEdyZXksZC5vYmoxRGFya0dyZXk9SGEub2JqMURhcmtHcmV5LGQub2JqMUJsYWNrPUhhLm9iajFCbGFja31iLkdCQ0VuYWJsZWQ/KGgoNjUzODQsMTkyKSxoKDY1Mzg1LDI1NSksaCg2NTM4NiwxOTMpLGgoNjUzODcsMTMpKTooaCg2NTM4NCwyNTUpLGgoNjUzODUsMjU1KSxoKDY1Mzg2LDI1NSksaCg2NTM4NywyNTUpKTsKay5jdXJyZW50Q3ljbGVzPTA7ay5OUjUwTGVmdE1peGVyVm9sdW1lPTA7ay5OUjUwUmlnaHRNaXhlclZvbHVtZT0wO2suTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2suTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2suTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2suTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2suTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0hMDtrLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7ay5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2suTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD0hMDtrLk5SNTJJc1NvdW5kRW5hYmxlZD0hMDtrLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9MDtrLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9MDtrLmZyYW1lU2VxdWVuY2VyPTA7ay5hdWRpb1F1ZXVlSW5kZXg9CjA7ei5pbml0aWFsaXplKCk7Ti5pbml0aWFsaXplKCk7Si5pbml0aWFsaXplKCk7Ty5pbml0aWFsaXplKCk7aChrLm1lbW9yeUxvY2F0aW9uTlI1MCwxMTkpO2goay5tZW1vcnlMb2NhdGlvbk5SNTEsMjQzKTtoKGsubWVtb3J5TG9jYXRpb25OUjUyLDI0MSk7cS5jaGFubmVsMVNhbXBsZT0xNTtxLmNoYW5uZWwyU2FtcGxlPTE1O3EuY2hhbm5lbDNTYW1wbGU9MTU7cS5jaGFubmVsNFNhbXBsZT0xNTtxLmNoYW5uZWwxRGFjRW5hYmxlZD0hMTtxLmNoYW5uZWwyRGFjRW5hYmxlZD0hMTtxLmNoYW5uZWwzRGFjRW5hYmxlZD0hMTtxLmNoYW5uZWw0RGFjRW5hYmxlZD0hMTtxLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNztxLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7cS5taXhlclZvbHVtZUNoYW5nZWQ9ITA7cS5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO3EubmVlZFRvUmVtaXhTYW1wbGVzPSExO20udXBkYXRlSW50ZXJydXB0RW5hYmxlZCgwKTtoKG0ubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkLAptLmludGVycnVwdHNFbmFibGVkVmFsdWUpO20udXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKDIyNSk7aChtLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCxtLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSk7dS5jdXJyZW50Q3ljbGVzPTA7dS5kaXZpZGVyUmVnaXN0ZXI9MDt1LnRpbWVyQ291bnRlcj0wO3UudGltZXJNb2R1bG89MDt1LnRpbWVyRW5hYmxlZD0hMTt1LnRpbWVySW5wdXRDbG9jaz0wO3UudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMTt1LnRpbWVyQ291bnRlcldhc1Jlc2V0PSExO2IuR0JDRW5hYmxlZD8oaCg2NTI4NCwzMCksdS5kaXZpZGVyUmVnaXN0ZXI9Nzg0MCk6KGgoNjUyODQsMTcxKSx1LmRpdmlkZXJSZWdpc3Rlcj00Mzk4MCk7aCg2NTI4NywyNDgpO3UudGltZXJJbnB1dENsb2NrPTI0ODtaLmN1cnJlbnRDeWNsZXM9MDtaLm51bWJlck9mQml0c1RyYW5zZmVycmVkPTA7Yi5HQkNFbmFibGVkPyhoKDY1MjgyLDEyNCksWi51cGRhdGVUcmFuc2ZlckNvbnRyb2woMTI0KSk6CihoKDY1MjgyLDEyNiksWi51cGRhdGVUcmFuc2ZlckNvbnRyb2woMTI2KSk7Yi5HQkNFbmFibGVkPyhoKDY1MzkyLDI0OCksaCg2NTM1OSwyNTQpLGgoNjUzNTcsMTI2KSxoKDY1MjgwLDIwNyksaCg2NTI5NSwyMjUpLGgoNjUzODgsMjU0KSxoKDY1Mzk3LDE0MykpOihoKDY1MzkyLDI1NSksaCg2NTM1OSwyNTUpLGgoNjUzNTcsMjU1KSxoKDY1MjgwLDIwNyksaCg2NTI5NSwyMjUpKTtqYj0hMTtkYS5jeWNsZXNQZXJDeWNsZVNldD0yRTk7ZGEuY3ljbGVTZXRzPTA7ZGEuY3ljbGVzPTA7Vy5zdGVwc1BlclN0ZXBTZXQ9MkU5O1cuc3RlcFNldHM9MDtXLnN0ZXBzPTB9LGhhc0NvcmVTdGFydGVkOmZ1bmN0aW9uKCl7cmV0dXJuIGpifSxzYXZlU3RhdGU6ZnVuY3Rpb24oKXtiLnNhdmVTdGF0ZSgpO3Iuc2F2ZVN0YXRlKCk7bS5zYXZlU3RhdGUoKTtBLnNhdmVTdGF0ZSgpO2cuc2F2ZVN0YXRlKCk7dS5zYXZlU3RhdGUoKTtrLnNhdmVTdGF0ZSgpO3ouc2F2ZVN0YXRlKCk7Ti5zYXZlU3RhdGUoKTsKSi5zYXZlU3RhdGUoKTtPLnNhdmVTdGF0ZSgpO2piPSExfSxsb2FkU3RhdGU6ZnVuY3Rpb24oKXtiLmxvYWRTdGF0ZSgpO3IubG9hZFN0YXRlKCk7bS5sb2FkU3RhdGUoKTtBLmxvYWRTdGF0ZSgpO2cubG9hZFN0YXRlKCk7dS5sb2FkU3RhdGUoKTtrLmxvYWRTdGF0ZSgpO3oubG9hZFN0YXRlKCk7Ti5sb2FkU3RhdGUoKTtKLmxvYWRTdGF0ZSgpO08ubG9hZFN0YXRlKCk7amI9ITE7ZGEuY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O2RhLmN5Y2xlU2V0cz0wO2RhLmN5Y2xlcz0wO1cuc3RlcHNQZXJTdGVwU2V0PTJFOTtXLnN0ZXBTZXRzPTA7Vy5zdGVwcz0wfSxpc0dCQzpmdW5jdGlvbigpe3JldHVybiBiLkdCQ0VuYWJsZWR9LGdldFN0ZXBzUGVyU3RlcFNldDpmdW5jdGlvbigpe3JldHVybiBXLnN0ZXBzUGVyU3RlcFNldH0sZ2V0U3RlcFNldHM6ZnVuY3Rpb24oKXtyZXR1cm4gVy5zdGVwU2V0c30sZ2V0U3RlcHM6ZnVuY3Rpb24oKXtyZXR1cm4gVy5zdGVwc30sZXhlY3V0ZU11bHRpcGxlRnJhbWVzOmZ1bmN0aW9uKGEpe2Zvcih2YXIgYj0KMCxkPTA7ZDxhJiYwPD1iOyliPW9jKCksZCs9MTtyZXR1cm4gMD5iP2I6MH0sZXhlY3V0ZUZyYW1lOm9jLGV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW86ZnVuY3Rpb24oYSl7dm9pZCAwPT09YSYmKGE9MCk7cmV0dXJuIFFiKCEwLGEpfSxleGVjdXRlVW50aWxDb25kaXRpb246UWIsZXhlY3V0ZVN0ZXA6cGMsZ2V0Q3ljbGVzUGVyQ3ljbGVTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gZGEuY3ljbGVzUGVyQ3ljbGVTZXR9LGdldEN5Y2xlU2V0czpmdW5jdGlvbigpe3JldHVybiBkYS5jeWNsZVNldHN9LGdldEN5Y2xlczpmdW5jdGlvbigpe3JldHVybiBkYS5jeWNsZXN9LHNldEpveXBhZFN0YXRlOmZ1bmN0aW9uKGEsYixkLGUsZixoLGcsbCl7MDxhP1VhKDApOkphKDAsITEpOzA8Yj9VYSgxKTpKYSgxLCExKTswPGQ/VWEoMik6SmEoMiwhMSk7MDxlP1VhKDMpOkphKDMsITEpOzA8Zj9VYSg0KTpKYSg0LCExKTswPGg/VWEoNSk6SmEoNSwhMSk7MDxnP1VhKDYpOkphKDYsITEpOzA8bD9VYSg3KToKSmEoNywhMSl9LGdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXI6ZGMsY2xlYXJBdWRpb0J1ZmZlcjplYyxzZXRNYW51YWxDb2xvcml6YXRpb25QYWxldHRlOlliLFdBU01CT1lfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9NRU1PUllfU0laRTp2YyxXQVNNQk9ZX1dBU01fUEFHRVM6VmIsQVNTRU1CTFlTQ1JJUFRfTUVNT1JZX0xPQ0FUSU9OOjAsQVNTRU1CTFlTQ1JJUFRfTUVNT1JZX1NJWkU6MTAyNCxXQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OOjEwMjQsV0FTTUJPWV9TVEFURV9TSVpFOjEwMjQsR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MjA0OCxHQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOlNjLFZJREVPX1JBTV9MT0NBVElPTjoyMDQ4LFZJREVPX1JBTV9TSVpFOjE2Mzg0LFdPUktfUkFNX0xPQ0FUSU9OOjE4NDMyLFdPUktfUkFNX1NJWkU6MzI3NjgsT1RIRVJfR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046NTEyMDAsT1RIRVJfR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRToxNjM4NCwKR1JBUEhJQ1NfT1VUUFVUX0xPQ0FUSU9OOlRjLEdSQVBISUNTX09VVFBVVF9TSVpFOlVjLEdCQ19QQUxFVFRFX0xPQ0FUSU9OOllhLEdCQ19QQUxFVFRFX1NJWkU6MTI4LEJHX1BSSU9SSVRZX01BUF9MT0NBVElPTjpaYSxCR19QUklPUklUWV9NQVBfU0laRToyMzU1MixGUkFNRV9MT0NBVElPTjpjYixGUkFNRV9TSVpFOjkzMTg0LEJBQ0tHUk9VTkRfTUFQX0xPQ0FUSU9OOnliLEJBQ0tHUk9VTkRfTUFQX1NJWkU6MTk2NjA4LFRJTEVfREFUQV9MT0NBVElPTjpUYixUSUxFX0RBVEFfU0laRToxNDc0NTYsT0FNX1RJTEVTX0xPQ0FUSU9OOnpiLE9BTV9USUxFU19TSVpFOjE1MzYwLEFVRElPX0JVRkZFUl9MT0NBVElPTjp1YixBVURJT19CVUZGRVJfU0laRToxMzEwNzIsQ0hBTk5FTF8xX0JVRkZFUl9MT0NBVElPTjpEYixDSEFOTkVMXzFfQlVGRkVSX1NJWkU6MTMxMDcyLENIQU5ORUxfMl9CVUZGRVJfTE9DQVRJT046RWIsQ0hBTk5FTF8yX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzNfQlVGRkVSX0xPQ0FUSU9OOkZiLApDSEFOTkVMXzNfQlVGRkVSX1NJWkU6MTMxMDcyLENIQU5ORUxfNF9CVUZGRVJfTE9DQVRJT046R2IsQ0hBTk5FTF80X0JVRkZFUl9TSVpFOjEzMTA3MixDQVJUUklER0VfUkFNX0xPQ0FUSU9OOk5iLENBUlRSSURHRV9SQU1fU0laRToxMzEwNzIsQ0FSVFJJREdFX1JPTV9MT0NBVElPTjp3YixDQVJUUklER0VfUk9NX1NJWkU6ODI1ODU2MCxERUJVR19HQU1FQk9ZX01FTU9SWV9MT0NBVElPTjpVYixERUJVR19HQU1FQk9ZX01FTU9SWV9TSVpFOjY1NTM1LGdldFdhc21Cb3lPZmZzZXRGcm9tR2FtZUJveU9mZnNldDpNYixzZXRQcm9ncmFtQ291bnRlckJyZWFrcG9pbnQ6ZnVuY3Rpb24oYSl7YWEucHJvZ3JhbUNvdW50ZXI9YX0scmVzZXRQcm9ncmFtQ291bnRlckJyZWFrcG9pbnQ6ZnVuY3Rpb24oKXthYS5wcm9ncmFtQ291bnRlcj0tMX0sc2V0UmVhZEdiTWVtb3J5QnJlYWtwb2ludDpmdW5jdGlvbihhKXthYS5yZWFkR2JNZW1vcnk9YX0scmVzZXRSZWFkR2JNZW1vcnlCcmVha3BvaW50OmZ1bmN0aW9uKCl7YWEucmVhZEdiTWVtb3J5PQotMX0sc2V0V3JpdGVHYk1lbW9yeUJyZWFrcG9pbnQ6ZnVuY3Rpb24oYSl7YWEud3JpdGVHYk1lbW9yeT1hfSxyZXNldFdyaXRlR2JNZW1vcnlCcmVha3BvaW50OmZ1bmN0aW9uKCl7YWEud3JpdGVHYk1lbW9yeT0tMX0sZ2V0UmVnaXN0ZXJBOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJBfSxnZXRSZWdpc3RlckI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckJ9LGdldFJlZ2lzdGVyQzpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQ30sZ2V0UmVnaXN0ZXJEOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJEfSxnZXRSZWdpc3RlckU6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckV9LGdldFJlZ2lzdGVySDpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVySH0sZ2V0UmVnaXN0ZXJMOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJMfSxnZXRSZWdpc3RlckY6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckZ9LGdldFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXJ9LApnZXRTdGFja1BvaW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5zdGFja1BvaW50ZXJ9LGdldE9wY29kZUF0UHJvZ3JhbUNvdW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gdyhiLnByb2dyYW1Db3VudGVyKX0sZ2V0TFk6ZnVuY3Rpb24oKXtyZXR1cm4gci5zY2FubGluZVJlZ2lzdGVyfSxkcmF3QmFja2dyb3VuZE1hcFRvV2FzbU1lbW9yeTpmdW5jdGlvbihhKXt2YXIgYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ7eS5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0JiYoYz1yLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCk7dmFyIGQ9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ7eS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZD1yLm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTtmb3IodmFyIGg9MDsyNTY+aDtoKyspZm9yKHZhciBmPTA7MjU2PmY7ZisrKXt2YXIgZz1oLGw9ZixtPWQrMzIqKGc+PjMpKyhsPj4KMyksaz1YKG0sMCk7az1nYihjLGspO3ZhciBuPWclODtnPWwlODtnPTctZztsPTA7Yi5HQkNFbmFibGVkJiYwPGEmJihsPVgobSwxKSk7cCg2LGwpJiYobj03LW4pO3ZhciBxPTA7cCgzLGwpJiYocT0xKTttPVgoaysyKm4scSk7az1YKGsrMipuKzEscSk7bj0wO3AoZyxrKSYmKG4rPTEsbjw8PTEpO3AoZyxtKSYmKG4rPTEpO2s9MyooMjU2KmgrZik7Yi5HQkNFbmFibGVkJiYwPGE/KG09cWIobCY3LG4sITEpLGw9dmEoMCxtKSxnPXZhKDEsbSksbT12YSgyLG0pLGs9eWIrayxlW2tdPWwsZVtrKzFdPWcsZVtrKzJdPW0pOihsPXBiKG4sci5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSxrPXliK2ssZVtrKzBdPShsJjE2NzExNjgwKT4+MTYsZVtrKzFdPShsJjY1MjgwKT4+OCxlW2srMl09bCYyNTUpfX0sZHJhd1RpbGVEYXRhVG9XYXNtTWVtb3J5OmZ1bmN0aW9uKCl7Zm9yKHZhciBhPTA7MjM+YTthKyspZm9yKHZhciBjPTA7MzE+YztjKyspe3ZhciBkPTA7MTU8YyYmKGQ9CjEpO3ZhciBlPWE7MTU8YSYmKGUtPTE1KTtlPDw9NDtlPTE1PGM/ZSsoYy0xNSk6ZStjO3ZhciBmPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0OzE1PGEmJihmPXIubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCk7Zm9yKHZhciBnPXIubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSxoPS0xLGw9LTEsaz0wOzg+aztrKyspZm9yKHZhciBtPTA7NT5tO20rKyl7dmFyIG49NCooOCptK2spLHE9dyhyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK24rMik7ZT09PXEmJihuPXcoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStuKzMpLHE9MCxiLkdCQ0VuYWJsZWQmJnAoMyxuKSYmKHE9MSkscT09PWQmJihsPW4saz04LG09NSxnPXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lLHAoNCxsKSYmKGc9ci5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd28pKSl9aWYoYi5HQkNFbmFibGVkJiYKMD5sKXtrPXIubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O3kuYmdUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGs9ci5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7bT0tMTtmb3Iobj0wOzMyPm47bisrKWZvcihxPTA7MzI+cTtxKyspe3ZhciB0PWsrMzIqcStuLHU9WCh0LDApO2U9PT11JiYobT10LHE9bj0zMil9MDw9bSYmKGg9WChtLDEpKX1mb3Ioaz0wOzg+aztrKyspQ2IoZSxmLGQsMCw3LGssOCpjLDgqYStrLDI0OCxUYiwhMSxnLGgsbCl9fSxkcmF3T2FtVG9XYXNtTWVtb3J5OmZ1bmN0aW9uKCl7Zm9yKHZhciBhPTA7OD5hO2ErKylmb3IodmFyIGM9MDs1PmM7YysrKXt2YXIgZD00Kig4KmMrYSk7dyhyLm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QpO3coci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzEpO3ZhciBlPXcoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzIpLApmPTE7eS50YWxsU3ByaXRlU2l6ZSYmKDE9PT1lJTImJi0tZSxmKz0xKTtkPXcoci5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzMpO3ZhciBnPTA7Yi5HQkNFbmFibGVkJiZwKDMsZCkmJihnPTEpO3ZhciBoPXIubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lO3AoNCxkKSYmKGg9ci5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd28pO2Zvcih2YXIgaz0wO2s8ZjtrKyspZm9yKHZhciBsPTA7OD5sO2wrKylDYihlK2ssci5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQsZywwLDcsbCw4KmEsMTYqYytsKzgqayw2NCx6YiwhMSxoLC0xLGQpfX0sZ2V0RElWOmZ1bmN0aW9uKCl7cmV0dXJuIHUuZGl2aWRlclJlZ2lzdGVyfSxnZXRUSU1BOmZ1bmN0aW9uKCl7cmV0dXJuIHUudGltZXJDb3VudGVyfSxnZXRUTUE6ZnVuY3Rpb24oKXtyZXR1cm4gdS50aW1lck1vZHVsb30sZ2V0VEFDOmZ1bmN0aW9uKCl7dmFyIGE9dS50aW1lcklucHV0Q2xvY2s7CnUudGltZXJFbmFibGVkJiYoYXw9NCk7cmV0dXJuIGF9LHVwZGF0ZURlYnVnR0JNZW1vcnk6ZnVuY3Rpb24oKXtmb3IodmFyIGE9MDs2NTUzNT5hO2ErKyl7dmFyIGI9S2IoYSk7ZVtVYithXT1ifWFhLnJlYWNoZWRCcmVha3BvaW50PSExfX0pO2NvbnN0IFdjPWFzeW5jKCk9Pih7aW5zdGFuY2U6e2V4cG9ydHM6VmN9LGJ5dGVNZW1vcnk6bGIud2FzbUJ5dGVNZW1vcnksdHlwZToiVHlwZVNjcmlwdCJ9KTtsZXQga2IseGIsc2MsbDtsPXtncmFwaGljc1dvcmtlclBvcnQ6dm9pZCAwLG1lbW9yeVdvcmtlclBvcnQ6dm9pZCAwLGNvbnRyb2xsZXJXb3JrZXJQb3J0OnZvaWQgMCxhdWRpb1dvcmtlclBvcnQ6dm9pZCAwLHdhc21JbnN0YW5jZTp2b2lkIDAsd2FzbUJ5dGVNZW1vcnk6dm9pZCAwLG9wdGlvbnM6dm9pZCAwLFdBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTjowLFdBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT046MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOjAsCldBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU6MCxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTjowLHBhdXNlZDohMCx1cGRhdGVJZDp2b2lkIDAsdGltZVN0YW1wc1VudGlsUmVhZHk6MCxmcHNUaW1lU3RhbXBzOltdLHNwZWVkOjAsZnJhbWVTa2lwQ291bnRlcjowLGN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM6MCxtZXNzYWdlSGFuZGxlcjooYSk9Pgp7Y29uc3QgYj1lYihhKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgeC5DT05ORUNUOiJHUkFQSElDUyI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGwuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxmYih3Yy5iaW5kKHZvaWQgMCxsKSxsLmdyYXBoaWNzV29ya2VyUG9ydCkpOiJNRU1PUlkiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhsLm1lbW9yeVdvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLGZiKHpjLmJpbmQodm9pZCAwLGwpLGwubWVtb3J5V29ya2VyUG9ydCkpOiJDT05UUk9MTEVSIj09PWIubWVzc2FnZS53b3JrZXJJZD8obC5jb250cm9sbGVyV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sZmIoeWMuYmluZCh2b2lkIDAsbCksbC5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihsLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sZmIoeGMuYmluZCh2b2lkIDAsbCksbC5hdWRpb1dvcmtlclBvcnQpKTsKZWEoTSh2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHguSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgV2MoKTtsLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2wud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2VhKE0oe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIHguQ09ORklHOmwud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGwsYi5tZXNzYWdlLmNvbmZpZyk7bC5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zO2VhKE0odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB4LlJFU0VUX0FVRElPX1FVRVVFOmwud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2VhKE0odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB4LlBMQVk6aWYoIWwucGF1c2VkfHwhbC53YXNtSW5zdGFuY2V8fCFsLndhc21CeXRlTWVtb3J5KXtlYShNKHtlcnJvcjohMH0sYi5tZXNzYWdlSWQpKTsKYnJlYWt9bC5wYXVzZWQ9ITE7bC5mcHNUaW1lU3RhbXBzPVtdO1JiKGwpO2wuZnJhbWVTa2lwQ291bnRlcj0wO2wuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0wO2wub3B0aW9ucy5pc0diY0NvbG9yaXphdGlvbkVuYWJsZWQ/bC5vcHRpb25zLmdiY0NvbG9yaXphdGlvblBhbGV0dGUmJmwud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZSgid2FzbWJveWdiIGJyb3duIHJlZCBkYXJrYnJvd24gZ3JlZW4gZGFya2dyZWVuIGludmVydGVkIHBhc3RlbG1peCBvcmFuZ2UgeWVsbG93IGJsdWUgZGFya2JsdWUgZ3JheXNjYWxlIi5zcGxpdCgiICIpLmluZGV4T2YobC5vcHRpb25zLmdiY0NvbG9yaXphdGlvblBhbGV0dGUudG9Mb3dlckNhc2UoKSkpOmwud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0TWFudWFsQ29sb3JpemF0aW9uUGFsZXR0ZSgwKTt0YyhsLDFFMy9sLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ZWEoTSh2b2lkIDAsYi5tZXNzYWdlSWQpKTsKYnJlYWs7Y2FzZSB4LlBBVVNFOmwucGF1c2VkPSEwO2wudXBkYXRlSWQmJihjbGVhclRpbWVvdXQobC51cGRhdGVJZCksbC51cGRhdGVJZD12b2lkIDApO2VhKE0odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB4LlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP2wud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpsLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7ZWEoTSh7dHlwZTp4LlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgeC5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBjPWwud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoYz1iLm1lc3NhZ2UuZW5kKTthPWwud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSwKYykuYnVmZmVyO2VhKE0oe3R5cGU6eC5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSB4LkdFVF9XQVNNX0NPTlNUQU5UOmVhKE0oe3R5cGU6eC5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTpsLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgeC5GT1JDRV9PVVRQVVRfRlJBTUU6cWMobCk7YnJlYWs7Y2FzZSB4LlNFVF9TUEVFRDpsLnNwZWVkPWIubWVzc2FnZS5zcGVlZDtsLmZwc1RpbWVTdGFtcHM9W107bC50aW1lU3RhbXBzVW50aWxSZWFkeT02MDtSYihsKTtsLmZyYW1lU2tpcENvdW50ZXI9MDtsLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtsLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTticmVhaztjYXNlIHguSVNfR0JDOmE9MDxsLndhc21JbnN0YW5jZS5leHBvcnRzLmlzR0JDKCk7ZWEoTSh7dHlwZTp4LklTX0dCQywKcmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKCJVbmtub3duIFdhc21Cb3kgV29ya2VyIG1lc3NhZ2U6IixiKX19LGdldEZQUzooKT0+MDxsLnRpbWVTdGFtcHNVbnRpbFJlYWR5P2wuc3BlZWQmJjA8bC5zcGVlZD9sLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSpsLnNwZWVkOmwub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlOmwuZnBzVGltZVN0YW1wcz9sLmZwc1RpbWVTdGFtcHMubGVuZ3RoOjB9O2ZiKGwubWVzc2FnZUhhbmRsZXIpfSkoKTsK";

  var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGgoYSxiKXtlP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTprLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGUpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZSlzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugay5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZihhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZCsrLGI9YCR7Yn0tJHtkfWAsMUU1PGQmJihkPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGU9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaztlfHwoaz1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZD0wLGw7Y29uc3Qgbj0oYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6aChmKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOnthPW5ldyBVaW50OENsYW1wZWRBcnJheShhLm1lc3NhZ2UuZ3JhcGhpY3NGcmFtZUJ1ZmZlcik7Y29uc3QgYj1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTIxNjApO2ZvcihsZXQgYz0wOzE0ND5jOysrYyl7bGV0IGU9NDgwKmMsZj02NDAqYztmb3IobGV0IGM9MDsxNjA+YzsrK2Mpe2NvbnN0IGQ9ZSszKmMsZz1mKyhjPDwyKTtiW2crMF09YVtkKzBdO2JbZysxXT1hW2QrMV07YltnKzJdPWFbZCsyXTtiW2crM109MjU1fX1hPWJ9aChmKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bSgoYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNPTk5FQ1QiOmw9CmEubWVzc2FnZS5wb3J0c1swXTttKG4sbCk7aChmKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmwucG9zdE1lc3NhZ2UoZih7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

  var wasmboyAudioWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSxiKXtjP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpuLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gcChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGMpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoYylzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugbi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZChhLGIscil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksaysrLGI9YCR7Yn0tJHtrfWAsMUU1PGsmJihrPTApKTtyZXR1cm57d29ya2VySWQ6cixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGM9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgbjtjfHwobj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgaz0wO2NvbnN0IHE9KGEpPT57YT0oYS0xKS8xMjctMTsuMDA4Pk1hdGguYWJzKGEpJiYoYT0wKTtyZXR1cm4gYS8yLjV9O2xldCBsO2NvbnN0IHQ9KGEpPT57Y29uc3QgYj1hLmRhdGE/YS5kYXRhOmE7aWYoYi5tZXNzYWdlKXN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjptKGQoYi5tZXNzYWdlLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiVVBEQVRFRCI6e2NvbnN0IGE9e3R5cGU6IlVQREFURUQiLG51bWJlck9mU2FtcGxlczpiLm1lc3NhZ2UubnVtYmVyT2ZTYW1wbGVzLGZwczpiLm1lc3NhZ2UuZnBzLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzpiLm1lc3NhZ2UuYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nfSxjPVtdO1siYXVkaW9CdWZmZXIiLCJjaGFubmVsMUJ1ZmZlciIsImNoYW5uZWwyQnVmZmVyIiwiY2hhbm5lbDNCdWZmZXIiLCJjaGFubmVsNEJ1ZmZlciJdLmZvckVhY2goKGQpPT57aWYoYi5tZXNzYWdlW2RdKXt7dmFyIGY9Cm5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtkXSk7dmFyIGc9Yi5tZXNzYWdlLm51bWJlck9mU2FtcGxlcztjb25zdCBhPW5ldyBGbG9hdDMyQXJyYXkoZyk7dmFyIGg9bmV3IEZsb2F0MzJBcnJheShnKTtsZXQgYz0wO2cqPTI7Zm9yKHZhciBlPTA7ZTxnO2UrPTIpYVtjXT1xKGZbZV0pLGMrKztjPTA7Zm9yKGU9MTtlPGc7ZSs9MiloW2NdPXEoZltlXSksYysrO2Y9YS5idWZmZXI7aD1oLmJ1ZmZlcn1hW2RdPXt9O2FbZF0ubGVmdD1mO2FbZF0ucmlnaHQ9aDtjLnB1c2goZik7Yy5wdXNoKGgpfX0pO20oZChhKSxjKX19fTtwKChhKT0+e2E9YS5kYXRhP2EuZGF0YTphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6bD1hLm1lc3NhZ2UucG9ydHNbMF07cCh0LGwpO20oZCh2b2lkIDAsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTIjpsLnBvc3RNZXNzYWdlKGQoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiQVVESU9fTEFURU5DWSI6bC5wb3N0TWVzc2FnZShkKGEubWVzc2FnZSwKYS5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGEpfX0pfSkoKTsK";

  var wasmboyControllerWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihjKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKGMpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIGUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLGQrKyxiPWAke2J9LSR7ZH1gLDFFNTxkJiYoZD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1jb25zdCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IGU7Y3x8KGU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtsZXQgZD0wLGY7Y29uc3Qgaz0oYSk9Pnt9O2coKGEpPT57YT1hLmRhdGE/YS5kYXRhOgphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6Zj1hLm1lc3NhZ2UucG9ydHNbMF07ZyhrLGYpO2E9aCh2b2lkIDAsYS5tZXNzYWdlSWQpO2M/c2VsZi5wb3N0TWVzc2FnZShhLHZvaWQgMCk6ZS5wb3N0TWVzc2FnZShhLHZvaWQgMCk7YnJlYWs7Y2FzZSAiU0VUX0pPWVBBRF9TVEFURSI6Zi5wb3N0TWVzc2FnZShoKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYSl9fSl9KSgpOwo=";

  var wasmboyMemoryWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGY7Y29uc3Qgaz0oYSxiKT0+e2NvbnN0IGQ9W107T2JqZWN0LmtleXMoYi5tZXNzYWdlKS5mb3JFYWNoKChhKT0+eyJ0eXBlIiE9PWEmJmQucHVzaChiLm1lc3NhZ2VbYV0pfSk7Y29uc3QgZT1jKGIubWVzc2FnZSxiLm1lc3NhZ2VJZCk7YT9mLnBvc3RNZXNzYWdlKGUsZCk6ZyhlLGQpfSxtPShhKT0+e2E9YS5kYXRhP2EuZGF0YTphO2lmKGEubWVzc2FnZSlzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNMRUFSX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSxbYS5tZXNzYWdlLndhc21CeXRlTWVtb3J5XSk7YnJlYWs7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiU0VUX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6ayghMSxhKTticmVhaztjYXNlICJVUERBVEVEIjprKCExLGEpfX07bCgoYSk9PnthPQphLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpmPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sZik7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkNMRUFSX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKHt0eXBlOiJDTEVBUl9NRU1PUlkifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmYucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlNFVF9NRU1PUlkiOmsoITAsYSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

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
          isGbcColorizationEnabled: this.options.isGbcColorizationEnabled,
          gbcColorizationPalette: this.options.gbcColorizationPalette,
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
        includeBootROM: false,
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

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=wasmboy.ts.umd.js.map
