var WasmBoy = (function (exports) {
  'use strict';

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
    PLAY_UNTIL_BREAKPOINT: 'PLAY_UNTIL_BREAKPOINT',
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

              this.worker.postMessage({
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

    initialize(headless, saveStateCallback) {
      const initializeTask = async () => {
        if (headless) {
          this.saveStateCallback = saveStateCallback;
          await this._initializeConstants();
        } else {
          this.saveStateCallback = saveStateCallback;
          await this._initializeConstants(); // initialize the autosave feature

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
        }

        cartridgeObject.saveStates.push(saveState);
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
      this.worker.postMessage({
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

  var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIEFhKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gYmEoYSxiKXtOYT9zZWxmLnBvc3RNZXNzYWdlKGEsYik6YWIucG9zdE1lc3NhZ2UoYSxiKX1mdW5jdGlvbiBCYShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKE5hKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKE5hKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBhYi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTihhLGIsZSl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksT2ErKyxiPWAke2J9LSR7T2F9YCwxRTU8T2EmJihPYT0wKSk7cmV0dXJue3dvcmtlcklkOmUsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBVYihhLGIpe2I9QWEoYik7CnN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSB6LkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCksYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX1NJWkUudmFsdWVPZigpLGEuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6ei5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBWYihhLGIpe2I9QWEoYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIHouR0VUX0NPTlNUQU5UUzphLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8xX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTp6LkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSwKYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHouQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yi5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIFdiKGEsYil7Yj1BYShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2Ugei5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24geWIoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5O2xldCBiPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XSxlPXZvaWQgMDtpZigwPT09YilyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7MTw9YiYmMz49Yj9lPTMyNzY4OjU8PWImJjY+PWI/ZT0yMDQ4OjE1PD1iJiYxOT49Yj9lPTMyNzY4OjI1PD1iJiYzMD49YiYmKGU9MTMxMDcyKTtyZXR1cm4gZT9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2UpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIHpiKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gWGIoYSxiKXtiPUFhKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSB6LkNMRUFSX01FTU9SWTpmb3IodmFyIGM9MDtjPD1hLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtjKyspYS53YXNtQnl0ZU1lbW9yeVtjXT0wO2M9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTp6LkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmMuYnVmZmVyfSxiLm1lc3NhZ2VJZCksW2MuYnVmZmVyXSk7CmJyZWFrO2Nhc2Ugei5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTp6LkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZVNpemUudmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHouU0VUX01FTU9SWTpjPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7CmMuaW5jbHVkZXMoRS5DQVJUUklER0VfUk9NKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuQ0FSVFJJREdFX1JPTV0pLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEUuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtFLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2MuaW5jbHVkZXMoRS5HQU1FQk9ZX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtFLkdBTUVCT1lfTUVNT1JZXSksYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7Yy5pbmNsdWRlcyhFLlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuUEFMRVRURV9NRU1PUlldKSxhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pOwpjLmluY2x1ZGVzKEUuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuSU5URVJOQUxfU1RBVEVdKSxhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOnouU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2Ugei5HRVRfTUVNT1JZOntjPXt0eXBlOnouR0VUX01FTU9SWX07Y29uc3QgZT1bXTt2YXIgeT1iLm1lc3NhZ2UubWVtb3J5VHlwZXM7aWYoeS5pbmNsdWRlcyhFLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgbD1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIGQ9dm9pZCAwOzA9PT1sP2Q9MzI3Njg6MTw9bCYmMz49bD9kPTIwOTcxNTI6NTw9bCYmNj49bD9kPTI2MjE0NDoKMTU8PWwmJjE5Pj1sP2Q9MjA5NzE1MjoyNTw9bCYmMzA+PWwmJihkPTgzODg2MDgpO2w9ZD9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK2QpOm5ldyBVaW50OEFycmF5fWVsc2UgbD1uZXcgVWludDhBcnJheTtsPWwuYnVmZmVyO2NbRS5DQVJUUklER0VfUk9NXT1sO2UucHVzaChsKX15LmluY2x1ZGVzKEUuQ0FSVFJJREdFX1JBTSkmJihsPXliKGEpLmJ1ZmZlcixjW0UuQ0FSVFJJREdFX1JBTV09bCxlLnB1c2gobCkpO3kuaW5jbHVkZXMoRS5DQVJUUklER0VfSEVBREVSKSYmKGEud2FzbUJ5dGVNZW1vcnk/KGw9YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzA4LGw9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShsLGwrMjcpKTpsPW5ldyBVaW50OEFycmF5LGw9bC5idWZmZXIsY1tFLkNBUlRSSURHRV9IRUFERVJdPWwsZS5wdXNoKGwpKTt5LmluY2x1ZGVzKEUuR0FNRUJPWV9NRU1PUlkpJiYKKGw9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsY1tFLkdBTUVCT1lfTUVNT1JZXT1sLGUucHVzaChsKSk7eS5pbmNsdWRlcyhFLlBBTEVUVEVfTUVNT1JZKSYmKGw9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXIsY1tFLlBBTEVUVEVfTUVNT1JZXT1sLGUucHVzaChsKSk7eS5pbmNsdWRlcyhFLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCkseT16YihhKS5idWZmZXIsY1tFLklOVEVSTkFMX1NUQVRFXT15LGUucHVzaCh5KSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oYywKYi5tZXNzYWdlSWQpLGUpfX19ZnVuY3Rpb24gcihhLGIpe3JldHVybihhJjI1NSk8PDh8YiYyNTV9ZnVuY3Rpb24gRihhKXtyZXR1cm4oYSY2NTI4MCk+Pjh9ZnVuY3Rpb24gSChhLGIpe3JldHVybiBiJn4oMTw8YSl9ZnVuY3Rpb24gcChhLGIpe3JldHVybiAwIT0oYiYxPDxhKX1mdW5jdGlvbiBiYihhKXt2YXIgYj1hO3AoNyxiKSYmKGI9LTEqKDI1Ni1hKSk7cmV0dXJuIGJ9ZnVuY3Rpb24gUGEoYSxjKXthPTE8PGEmMjU1O2IucmVnaXN0ZXJGPTA8Yz9iLnJlZ2lzdGVyRnxhOmIucmVnaXN0ZXJGJigyNTVeYSk7cmV0dXJuIGIucmVnaXN0ZXJGfWZ1bmN0aW9uIGcoYSl7UGEoNyxhKX1mdW5jdGlvbiB1KGEpe1BhKDYsYSl9ZnVuY3Rpb24gRChhKXtQYSg1LGEpfWZ1bmN0aW9uIHYoYSl7UGEoNCxhKX1mdW5jdGlvbiByYSgpe3JldHVybiBiLnJlZ2lzdGVyRj4+NyYxfWZ1bmN0aW9uIFYoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjQmMX1mdW5jdGlvbiBUKGEsYil7MDw9Yj8wIT09KChhJgoxNSkrKGImMTUpJjE2KT9EKDEpOkQoMCk6KE1hdGguYWJzKGIpJjE1KT4oYSYxNSk/RCgxKTpEKDApfWZ1bmN0aW9uIGNiKGEsYil7MDw9Yj9hPihhK2ImMjU1KT92KDEpOnYoMCk6TWF0aC5hYnMoYik+YT92KDEpOnYoMCl9ZnVuY3Rpb24gdmEoYSxiLGUpe2U/KGE9YV5iXmErYiwwIT09KGEmMTYpP0QoMSk6RCgwKSwwIT09KGEmMjU2KT92KDEpOnYoMCkpOihlPWErYiY2NTUzNSxlPGE/digxKTp2KDApLDAhPT0oKGFeYl5lKSY0MDk2KT9EKDEpOkQoMCkpfWZ1bmN0aW9uIFFhKGEsYixlKXt2b2lkIDA9PT1lJiYoZT0hMSk7dmFyIGM9YTtlfHwoYz14KGIpPj4yKmEmMyk7YT0yNDI7c3dpdGNoKGMpe2Nhc2UgMTphPTE2MDticmVhaztjYXNlIDI6YT04ODticmVhaztjYXNlIDM6YT04fXJldHVybiBhfWZ1bmN0aW9uIFJhKGEsYixlKXtiPTgqYSsyKmI7YT1BYihiKzEsZSk7ZT1BYihiLGUpO3JldHVybiByKGEsZSl9ZnVuY3Rpb24gZGEoYSxiKXtyZXR1cm4gOCooKGImMzE8PDUqYSk+Pgo1KmEpfWZ1bmN0aW9uIEFiKGEsYil7YSY9NjM7YiYmKGErPTY0KTtyZXR1cm4ga1s2NzU4NCthXX1mdW5jdGlvbiBTYShhLGIsZSx5KXt2b2lkIDA9PT1lJiYoZT0wKTt2b2lkIDA9PT15JiYoeT0hMSk7ZSY9Mzt5JiYoZXw9NCk7a1s2NzcxMisoMTYwKmIrYSldPWV9ZnVuY3Rpb24gZGIoYSxiLGUseSxsLGQsaCxmLGcscSxyLG0sbix4KXt4PTA7Yj1DYShiLGEpO2E9YWEoYisyKmQsZSk7ZT1hYShiKzIqZCsxLGUpO2ZvcihkPXk7ZDw9bDtkKyspaWYoYj1oKyhkLXkpLGI8Zyl7dmFyIGM9ZDtpZigwPm58fCFwKDUsbikpYz03LWM7dmFyIE89MDtwKGMsZSkmJihPKz0xLE88PD0xKTtwKGMsYSkmJihPKz0xKTtpZigwPD1uKXt2YXIgdWE9UmEobiY3LE8sITEpO2M9ZGEoMCx1YSk7dmFyIEJiPWRhKDEsdWEpO3VhPWRhKDIsdWEpfWVsc2UgMD49bSYmKG09dC5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlKSxCYj1jPXVhPVFhKE8sbSxyKTt2YXIgdT0zKihmKmcrYik7a1txK3VdPQpjO2tbcSt1KzFdPUJiO2tbcSt1KzJdPXVhO2M9ITE7MDw9biYmKGM9cCg3LG4pKTtTYShiLGYsTyxjKTt4Kyt9cmV0dXJuIHh9ZnVuY3Rpb24gQ2EoYSxiKXtpZihhPT09dC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0KXt2YXIgYz1iKzEyODtwKDcsYikmJihjPWItMTI4KTtyZXR1cm4gYSsxNipjfXJldHVybiBhKzE2KmJ9ZnVuY3Rpb24gQ2IoYSxiKXtzd2l0Y2goYSl7Y2FzZSAxOnJldHVybiBwKGIsMTI5KTtjYXNlIDI6cmV0dXJuIHAoYiwxMzUpO2Nhc2UgMzpyZXR1cm4gcChiLDEyNik7ZGVmYXVsdDpyZXR1cm4gcChiLDEpfX1mdW5jdGlvbiBEYigpe3ZhciBhPUViKCk7MjA0Nz49YSYmMDxBLk5SeDBTd2VlcFNoaWZ0JiYoQS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1hLEEuc2V0RnJlcXVlbmN5KGEpLGE9RWIoKSk7MjA0NzxhJiYoQS5pc0VuYWJsZWQ9ITEpfWZ1bmN0aW9uIEViKCl7dmFyIGE9QS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeTthPj49QS5OUngwU3dlZXBTaGlmdDsKcmV0dXJuIGE9QS5OUngwTmVnYXRlP0Euc3dlZXBTaGFkb3dGcmVxdWVuY3ktYTpBLnN3ZWVwU2hhZG93RnJlcXVlbmN5K2F9ZnVuY3Rpb24gVGEoYSl7c3dpdGNoKGEpe2Nhc2UgQS5jaGFubmVsTnVtYmVyOmlmKHcuY2hhbm5lbDFEYWNFbmFibGVkIT09QS5pc0RhY0VuYWJsZWQpcmV0dXJuIHcuY2hhbm5lbDFEYWNFbmFibGVkPUEuaXNEYWNFbmFibGVkLCEwO2JyZWFrO2Nhc2UgSy5jaGFubmVsTnVtYmVyOmlmKHcuY2hhbm5lbDJEYWNFbmFibGVkIT09Sy5pc0RhY0VuYWJsZWQpcmV0dXJuIHcuY2hhbm5lbDJEYWNFbmFibGVkPUsuaXNEYWNFbmFibGVkLCEwO2JyZWFrO2Nhc2UgSS5jaGFubmVsTnVtYmVyOmlmKHcuY2hhbm5lbDNEYWNFbmFibGVkIT09SS5pc0RhY0VuYWJsZWQpcmV0dXJuIHcuY2hhbm5lbDNEYWNFbmFibGVkPUkuaXNEYWNFbmFibGVkLCEwO2JyZWFrO2Nhc2UgTC5jaGFubmVsTnVtYmVyOmlmKHcuY2hhbm5lbDREYWNFbmFibGVkIT09TC5pc0RhY0VuYWJsZWQpcmV0dXJuIHcuY2hhbm5lbDREYWNFbmFibGVkPQpMLmlzRGFjRW5hYmxlZCwhMH1yZXR1cm4hMX1mdW5jdGlvbiBVYSgpe2lmKCEoZi5jdXJyZW50Q3ljbGVzPGYuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpKWZvcig7Zi5jdXJyZW50Q3ljbGVzPj1mLmJhdGNoUHJvY2Vzc0N5Y2xlcygpOylGYihmLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSxmLmN1cnJlbnRDeWNsZXMtPWYuYmF0Y2hQcm9jZXNzQ3ljbGVzKCl9ZnVuY3Rpb24gRmIoYSl7Zi5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyKz1hO2lmKGYuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj49Zi5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCkpe2YuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlci09Zi5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzKCk7c3dpdGNoKGYuZnJhbWVTZXF1ZW5jZXIpe2Nhc2UgMDpBLnVwZGF0ZUxlbmd0aCgpO0sudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgMjpBLnVwZGF0ZUxlbmd0aCgpO0sudXBkYXRlTGVuZ3RoKCk7CkkudXBkYXRlTGVuZ3RoKCk7TC51cGRhdGVMZW5ndGgoKTtBLnVwZGF0ZVN3ZWVwKCk7YnJlYWs7Y2FzZSA0OkEudXBkYXRlTGVuZ3RoKCk7Sy51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7YnJlYWs7Y2FzZSA2OkEudXBkYXRlTGVuZ3RoKCk7Sy51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7QS51cGRhdGVTd2VlcCgpO2JyZWFrO2Nhc2UgNzpBLnVwZGF0ZUVudmVsb3BlKCksSy51cGRhdGVFbnZlbG9wZSgpLEwudXBkYXRlRW52ZWxvcGUoKX1mLmZyYW1lU2VxdWVuY2VyKz0xOzg8PWYuZnJhbWVTZXF1ZW5jZXImJihmLmZyYW1lU2VxdWVuY2VyPTApO3ZhciBiPSEwfWVsc2UgYj0hMTtpZihRLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXMmJiFiKXtiPUEud2lsbENoYW5uZWxVcGRhdGUoYSl8fFRhKEEuY2hhbm5lbE51bWJlcik7dmFyIGU9Sy53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8VGEoSy5jaGFubmVsTnVtYmVyKSwKeT1JLndpbGxDaGFubmVsVXBkYXRlKGEpfHxUYShJLmNoYW5uZWxOdW1iZXIpLGw9TC53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8VGEoTC5jaGFubmVsTnVtYmVyKTtiJiYody5jaGFubmVsMVNhbXBsZT1BLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7ZSYmKHcuY2hhbm5lbDJTYW1wbGU9Sy5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO3kmJih3LmNoYW5uZWwzU2FtcGxlPUkuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTtsJiYody5jaGFubmVsNFNhbXBsZT1MLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7aWYoYnx8ZXx8eXx8bCl3Lm5lZWRUb1JlbWl4U2FtcGxlcz0hMDtmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXIrPWEqZi5kb3duU2FtcGxlQ3ljbGVNdWx0aXBsaWVyO2YuZG93blNhbXBsZUN5Y2xlQ291bnRlcj49Zi5tYXhEb3duU2FtcGxlQ3ljbGVzKCkmJihmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXItPWYubWF4RG93blNhbXBsZUN5Y2xlcygpLCh3Lm5lZWRUb1JlbWl4U2FtcGxlc3x8CncubWl4ZXJWb2x1bWVDaGFuZ2VkfHx3Lm1peGVyRW5hYmxlZENoYW5nZWQpJiZ3YSh3LmNoYW5uZWwxU2FtcGxlLHcuY2hhbm5lbDJTYW1wbGUsdy5jaGFubmVsM1NhbXBsZSx3LmNoYW5uZWw0U2FtcGxlKSx4YSh3LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlKzEsdy5yaWdodENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGUrMSxEYSksZi5hdWRpb1F1ZXVlSW5kZXgrPTEsZi5hdWRpb1F1ZXVlSW5kZXg+PShmLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplLzJ8MCktMSYmLS1mLmF1ZGlvUXVldWVJbmRleCl9ZWxzZSBpZihiPUEuZ2V0U2FtcGxlKGEpfDAsZT1LLmdldFNhbXBsZShhKXwwLHk9SS5nZXRTYW1wbGUoYSl8MCxsPUwuZ2V0U2FtcGxlKGEpfDAsdy5jaGFubmVsMVNhbXBsZT1iLHcuY2hhbm5lbDJTYW1wbGU9ZSx3LmNoYW5uZWwzU2FtcGxlPXksdy5jaGFubmVsNFNhbXBsZT1sLGYuZG93blNhbXBsZUN5Y2xlQ291bnRlcis9YSpmLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXIsCmYuZG93blNhbXBsZUN5Y2xlQ291bnRlcj49Zi5tYXhEb3duU2FtcGxlQ3ljbGVzKCkpe2YuZG93blNhbXBsZUN5Y2xlQ291bnRlci09Zi5tYXhEb3duU2FtcGxlQ3ljbGVzKCk7YT13YShiLGUseSxsKTt2YXIgZD1GKGEpO3hhKGQrMSwoYSYyNTUpKzEsRGEpO1EuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcmJihhPXdhKGIsMTUsMTUsMTUpLGQ9RihhKSx4YShkKzEsKGEmMjU1KSsxLGViKSxhPXdhKDE1LGUsMTUsMTUpLGQ9RihhKSx4YShkKzEsKGEmMjU1KSsxLGZiKSxhPXdhKDE1LDE1LHksMTUpLGQ9RihhKSx4YShkKzEsKGEmMjU1KSsxLGdiKSxhPXdhKDE1LDE1LDE1LGwpLGQ9RihhKSx4YShkKzEsKGEmMjU1KSsxLGhiKSk7Zi5hdWRpb1F1ZXVlSW5kZXgrPTE7Zi5hdWRpb1F1ZXVlSW5kZXg+PShmLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplLzJ8MCktMSYmLS1mLmF1ZGlvUXVldWVJbmRleH19ZnVuY3Rpb24gaWIoKXtyZXR1cm4gZi5hdWRpb1F1ZXVlSW5kZXh9ZnVuY3Rpb24gamIoKXtmLmF1ZGlvUXVldWVJbmRleD0KMH1mdW5jdGlvbiB3YShhLGIsZSx5KXt2b2lkIDA9PT1hJiYoYT0xNSk7dm9pZCAwPT09YiYmKGI9MTUpO3ZvaWQgMD09PWUmJihlPTE1KTt2b2lkIDA9PT15JiYoeT0xNSk7dy5taXhlclZvbHVtZUNoYW5nZWQ9ITE7dmFyIGM9MCxkPTA7Yz1mLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD9jK2E6YysxNTtjPWYuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0P2MrYjpjKzE1O2M9Zi5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ/YytlOmMrMTU7Yz1mLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD9jK3k6YysxNTtkPWYuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD9kK2E6ZCsxNTtkPWYuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD9kK2I6ZCsxNTtkPWYuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD9kK2U6ZCsxNTtkPWYuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD8KZCt5OmQrMTU7dy5taXhlckVuYWJsZWRDaGFuZ2VkPSExO3cubmVlZFRvUmVtaXhTYW1wbGVzPSExO2E9R2IoYyxmLk5SNTBMZWZ0TWl4ZXJWb2x1bWUrMSk7ZD1HYihkLGYuTlI1MFJpZ2h0TWl4ZXJWb2x1bWUrMSk7dy5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT1hO3cucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPWQ7cmV0dXJuIHIoYSxkKX1mdW5jdGlvbiBHYihhLGIpe2lmKDYwPT09YSlyZXR1cm4gMTI3O2E9MUU1KihhLTYwKSpiLzh8MDthPWEvMUU1fDA7YSs9NjA7YT0xRTUqYS8oMTJFNi8yNTR8MCl8MDtyZXR1cm4gYXw9MH1mdW5jdGlvbiB4YShhLGIsZSl7ZSs9MipmLmF1ZGlvUXVldWVJbmRleDtrW2VdPWErMTtrW2UrMV09YisxfWZ1bmN0aW9uIEVhKGEpe1ZhKCExKTt2YXIgYz14KHEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KTtjPUgoYSxjKTtxLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1jO2gocS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsCmMpO2Iuc3RhY2tQb2ludGVyLT0yO2IuaXNIYWx0ZWQoKTtjPWIuc3RhY2tQb2ludGVyO3ZhciBlPWIucHJvZ3JhbUNvdW50ZXIseT1GKGUpLGQ9YysxO2goYyxlJjI1NSk7aChkLHkpO3N3aXRjaChhKXtjYXNlIHEuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ6cS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTY0O2JyZWFrO2Nhc2UgcS5iaXRQb3NpdGlvbkxjZEludGVycnVwdDpxLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9NzI7YnJlYWs7Y2FzZSBxLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ6cS5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9ODA7YnJlYWs7Y2FzZSBxLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0OnEuaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7Yi5wcm9ncmFtQ291bnRlcj04ODticmVhaztjYXNlIHEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQ6cS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD0KITEsYi5wcm9ncmFtQ291bnRlcj05Nn19ZnVuY3Rpb24geWEoYSl7dmFyIGI9eChxLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7Ynw9MTw8YTtxLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT1iO2gocS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsYil9ZnVuY3Rpb24gVmEoYSl7YT9xLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSEwOnEubWFzdGVySW50ZXJydXB0U3dpdGNoPSExfWZ1bmN0aW9uIGtiKGEpe2Zvcih2YXIgYj0wO2I8YTspe3ZhciBlPW0uZGl2aWRlclJlZ2lzdGVyO2IrPTQ7bS5kaXZpZGVyUmVnaXN0ZXIrPTQ7NjU1MzU8bS5kaXZpZGVyUmVnaXN0ZXImJihtLmRpdmlkZXJSZWdpc3Rlci09NjU1MzYpO20udGltZXJFbmFibGVkJiYobS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PyhtLnRpbWVyQ291bnRlcj1tLnRpbWVyTW9kdWxvLHEuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMCx5YShxLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLAptLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITEsbS50aW1lckNvdW50ZXJXYXNSZXNldD0hMCk6bS50aW1lckNvdW50ZXJXYXNSZXNldCYmKG0udGltZXJDb3VudGVyV2FzUmVzZXQ9ITEpLEhiKGUsbS5kaXZpZGVyUmVnaXN0ZXIpJiZsYigpKX19ZnVuY3Rpb24gbGIoKXttLnRpbWVyQ291bnRlcis9MTsyNTU8bS50aW1lckNvdW50ZXImJihtLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITAsbS50aW1lckNvdW50ZXI9MCl9ZnVuY3Rpb24gSGIoYSxiKXt2YXIgYz1tYihtLnRpbWVySW5wdXRDbG9jayk7cmV0dXJuIHAoYyxhKSYmIXAoYyxiKT8hMDohMX1mdW5jdGlvbiBtYihhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiA5O2Nhc2UgMTpyZXR1cm4gMztjYXNlIDI6cmV0dXJuIDU7Y2FzZSAzOnJldHVybiA3fXJldHVybiAwfWZ1bmN0aW9uIHNhKGEpe3ZhciBjPWIuaXNTdG9wcGVkPSExO1liKGEpfHwoYz0hMCk7ZmEoYSwhMCk7YyYmKGM9ITEsMz49YSYmKGM9ITApLGE9ITEsCkIuaXNEcGFkVHlwZSYmYyYmKGE9ITApLEIuaXNCdXR0b25UeXBlJiYhYyYmKGE9ITApLGEmJihxLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSEwLHlhKHEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQpKSl9ZnVuY3Rpb24gWWIoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gQi51cDtjYXNlIDE6cmV0dXJuIEIucmlnaHQ7Y2FzZSAyOnJldHVybiBCLmRvd247Y2FzZSAzOnJldHVybiBCLmxlZnQ7Y2FzZSA0OnJldHVybiBCLmE7Y2FzZSA1OnJldHVybiBCLmI7Y2FzZSA2OnJldHVybiBCLnNlbGVjdDtjYXNlIDc6cmV0dXJuIEIuc3RhcnQ7ZGVmYXVsdDpyZXR1cm4hMX19ZnVuY3Rpb24gZmEoYSxiKXtzd2l0Y2goYSl7Y2FzZSAwOkIudXA9YjticmVhaztjYXNlIDE6Qi5yaWdodD1iO2JyZWFrO2Nhc2UgMjpCLmRvd249YjticmVhaztjYXNlIDM6Qi5sZWZ0PWI7YnJlYWs7Y2FzZSA0OkIuYT1iO2JyZWFrO2Nhc2UgNTpCLmI9YjticmVhaztjYXNlIDY6Qi5zZWxlY3Q9YjticmVhazsKY2FzZSA3OkIuc3RhcnQ9Yn19ZnVuY3Rpb24gSWIoYSxjLGUpe2Zvcih2YXIgeT0wO3k8ZTt5Kyspe2Zvcih2YXIgbD1uYihhK3kpLGs9Yyt5OzQwOTU5PGs7KWstPTgxOTI7V2EoayxsKSYmaChrLGwpfWE9MzI7Yi5HQkNEb3VibGVTcGVlZCYmKGE9NjQpO2QuRE1BQ3ljbGVzKz1lLzE2KmF9ZnVuY3Rpb24gV2EoYSxjKXtpZihhPT09Yi5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoKXJldHVybiBoKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCxjJjEpLCExO3ZhciBlPWQudmlkZW9SYW1Mb2NhdGlvbix5PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uO2lmKGE8ZSl7aWYoIWQuaXNSb21Pbmx5KWlmKDgxOTE+PWEpe2lmKCFkLmlzTUJDMnx8cCg0LGMpKWMmPTE1LDA9PT1jP2QuaXNSYW1CYW5raW5nRW5hYmxlZD0hMToxMD09PWMmJihkLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITApfWVsc2UgMTYzODM+PWE/IWQuaXNNQkM1fHwxMjI4Nz49YT8oZC5pc01CQzImJihkLmN1cnJlbnRSb21CYW5rPQpjJjE1KSxkLmlzTUJDMT8oYyY9MzEsZC5jdXJyZW50Um9tQmFuayY9MjI0KTpkLmlzTUJDMz8oYyY9MTI3LGQuY3VycmVudFJvbUJhbmsmPTEyOCk6ZC5pc01CQzUmJihkLmN1cnJlbnRSb21CYW5rJj0wKSxkLmN1cnJlbnRSb21CYW5rfD1jKTooYT0wLGU9ZC5jdXJyZW50Um9tQmFuayYyNTUsMDxjJiYoYT0xKSxkLmN1cnJlbnRSb21CYW5rPXIoYSxlKSk6IWQuaXNNQkMyJiYyNDU3NT49YT9kLmlzTUJDMSYmZC5pc01CQzFSb21Nb2RlRW5hYmxlZD8oZC5jdXJyZW50Um9tQmFuayY9MzEsZC5jdXJyZW50Um9tQmFua3w9YyYyMjQpOihjPWQuaXNNQkM1P2MmMTU6YyYzLGQuY3VycmVudFJhbUJhbms9Yyk6IWQuaXNNQkMyJiYzMjc2Nz49YSYmZC5pc01CQzEmJihwKDAsYyk/ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMDpkLmlzTUJDMVJvbU1vZGVFbmFibGVkPSExKTtyZXR1cm4hMX1pZihhPj1lJiZhPGQuY2FydHJpZGdlUmFtTG9jYXRpb24pcmV0dXJuITA7aWYoYT49ZC5lY2hvUmFtTG9jYXRpb24mJgphPHkpcmV0dXJuIGgoYS04MTkyLGMpLCEwO2lmKGE+PXkmJmE8PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uRW5kKXJldHVybiAyPkMuY3VycmVudExjZE1vZGU/ITE6ITA7aWYoYT49ZC51bnVzYWJsZU1lbW9yeUxvY2F0aW9uJiZhPD1kLnVudXNhYmxlTWVtb3J5RW5kTG9jYXRpb24pcmV0dXJuITE7aWYoYT09PU0ubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckNvbnRyb2wpcmV0dXJuIE0udXBkYXRlVHJhbnNmZXJDb250cm9sKGMpO2lmKDY1Mjk2PD1hJiY2NTMxOD49YSl7VWEoKTtpZihhPT09Zi5tZW1vcnlMb2NhdGlvbk5SNTJ8fGYuTlI1MklzU291bmRFbmFibGVkKXtzd2l0Y2goYSl7Y2FzZSBBLm1lbW9yeUxvY2F0aW9uTlJ4MDpBLnVwZGF0ZU5SeDAoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MDpJLnVwZGF0ZU5SeDAoYyk7YnJlYWs7Y2FzZSBBLm1lbW9yeUxvY2F0aW9uTlJ4MTpBLnVwZGF0ZU5SeDEoYyk7YnJlYWs7Y2FzZSBLLm1lbW9yeUxvY2F0aW9uTlJ4MTpLLnVwZGF0ZU5SeDEoYyk7CmJyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDE6SS51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDE6TC51cGRhdGVOUngxKGMpO2JyZWFrO2Nhc2UgQS5tZW1vcnlMb2NhdGlvbk5SeDI6QS51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgSy5tZW1vcnlMb2NhdGlvbk5SeDI6Sy51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDI6SS52b2x1bWVDb2RlQ2hhbmdlZD0hMDtJLnVwZGF0ZU5SeDIoYyk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4MjpMLnVwZGF0ZU5SeDIoYyk7YnJlYWs7Y2FzZSBBLm1lbW9yeUxvY2F0aW9uTlJ4MzpBLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBLLm1lbW9yeUxvY2F0aW9uTlJ4MzpLLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4MzpJLnVwZGF0ZU5SeDMoYyk7YnJlYWs7Y2FzZSBMLm1lbW9yeUxvY2F0aW9uTlJ4MzpMLnVwZGF0ZU5SeDMoYyk7CmJyZWFrO2Nhc2UgQS5tZW1vcnlMb2NhdGlvbk5SeDQ6cCg3LGMpJiYoQS51cGRhdGVOUng0KGMpLEEudHJpZ2dlcigpKTticmVhaztjYXNlIEsubWVtb3J5TG9jYXRpb25OUng0OnAoNyxjKSYmKEsudXBkYXRlTlJ4NChjKSxLLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBJLm1lbW9yeUxvY2F0aW9uTlJ4NDpwKDcsYykmJihJLnVwZGF0ZU5SeDQoYyksSS50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDQ6cCg3LGMpJiYoTC51cGRhdGVOUng0KGMpLEwudHJpZ2dlcigpKTticmVhaztjYXNlIGYubWVtb3J5TG9jYXRpb25OUjUwOmYudXBkYXRlTlI1MChjKTt3Lm1peGVyVm9sdW1lQ2hhbmdlZD0hMDticmVhaztjYXNlIGYubWVtb3J5TG9jYXRpb25OUjUxOmYudXBkYXRlTlI1MShjKTt3Lm1peGVyRW5hYmxlZENoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBmLm1lbW9yeUxvY2F0aW9uTlI1MjppZihmLnVwZGF0ZU5SNTIoYyksIXAoNyxjKSlmb3IoYz02NTI5Njs2NTMxOD4KYztjKyspaChjLDApfWM9ITB9ZWxzZSBjPSExO3JldHVybiBjfTY1MzI4PD1hJiY2NTM0Mz49YSYmVWEoKTtpZihhPj1DLm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbCYmYTw9dC5tZW1vcnlMb2NhdGlvbldpbmRvd1gpe2lmKGE9PT1DLm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbClyZXR1cm4gQy51cGRhdGVMY2RDb250cm9sKGMpLCEwO2lmKGE9PT1DLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKXJldHVybiBDLnVwZGF0ZUxjZFN0YXR1cyhjKSwhMTtpZihhPT09dC5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpcmV0dXJuIHQuc2NhbmxpbmVSZWdpc3Rlcj0wLGgoYSwwKSwhMTtpZihhPT09Qy5tZW1vcnlMb2NhdGlvbkNvaW5jaWRlbmNlQ29tcGFyZSlyZXR1cm4gQy5jb2luY2lkZW5jZUNvbXBhcmU9YywhMDtpZihhPT09dC5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyKXtjPDw9ODtmb3IoYT0wOzE1OT49YTthKyspZT14KGMrYSksaChkLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbisKYSxlKTtkLkRNQUN5Y2xlcz02NDQ7cmV0dXJuITB9c3dpdGNoKGEpe2Nhc2UgdC5tZW1vcnlMb2NhdGlvblNjcm9sbFg6dC5zY3JvbGxYPWM7YnJlYWs7Y2FzZSB0Lm1lbW9yeUxvY2F0aW9uU2Nyb2xsWTp0LnNjcm9sbFk9YzticmVhaztjYXNlIHQubWVtb3J5TG9jYXRpb25XaW5kb3dYOnQud2luZG93WD1jO2JyZWFrO2Nhc2UgdC5tZW1vcnlMb2NhdGlvbldpbmRvd1k6dC53aW5kb3dZPWN9cmV0dXJuITB9aWYoYT09PWQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcilyZXR1cm4gYi5HQkNFbmFibGVkJiYoZC5pc0hibGFua0hkbWFBY3RpdmUmJiFwKDcsYyk/KGQuaXNIYmxhbmtIZG1hQWN0aXZlPSExLGM9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpLGgoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLGN8MTI4KSk6KGE9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUhpZ2gpLGU9eChkLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdyksYT1yKGEsZSkmNjU1MjAsCmU9eChkLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaCkseT14KGQubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25Mb3cpLGU9cihlLHkpLGU9KGUmODE3NikrZC52aWRlb1JhbUxvY2F0aW9uLHk9SCg3LGMpLHk9MTYqKHkrMSkscCg3LGMpPyhkLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMCxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz15LGQuaGJsYW5rSGRtYVNvdXJjZT1hLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uPWUsaChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsSCg3LGMpKSk6KEliKGEsZSx5KSxoKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlciwyNTUpKSkpLCExO2lmKChhPT09ZC5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rfHxhPT09ZC5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rKSYmZC5pc0hibGFua0hkbWFBY3RpdmUmJigxNjM4NDw9ZC5oYmxhbmtIZG1hU291cmNlJiYzMjc2Nz49ZC5oYmxhbmtIZG1hU291cmNlfHw1MzI0ODw9CmQuaGJsYW5rSGRtYVNvdXJjZSYmNTczNDM+PWQuaGJsYW5rSGRtYVNvdXJjZSkpcmV0dXJuITE7aWYoYT49RmEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZUluZGV4JiZhPD1GYS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhKXtpZihhPT09RmEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZURhdGF8fGE9PT1GYS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhKXtlPXgoYS0xKTtlPUgoNixlKTt5PSExO2E9PT1GYS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVEYXRhJiYoeT0hMCk7dmFyIGw9ZSY2Mzt5JiYobCs9NjQpO2tbNjc1ODQrbF09YztjPWU7LS1hO3AoNyxjKSYmaChhLGMrMXwxMjgpfXJldHVybiEwfWlmKGE+PW0ubWVtb3J5TG9jYXRpb25EaXZpZGVyUmVnaXN0ZXImJmE8PW0ubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpe2tiKG0uY3VycmVudEN5Y2xlcyk7bS5jdXJyZW50Q3ljbGVzPTA7c3dpdGNoKGEpe2Nhc2UgbS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlcjpyZXR1cm4gbS51cGRhdGVEaXZpZGVyUmVnaXN0ZXIoYyksCiExO2Nhc2UgbS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcjptLnVwZGF0ZVRpbWVyQ291bnRlcihjKTticmVhaztjYXNlIG0ubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbzptLnVwZGF0ZVRpbWVyTW9kdWxvKGMpO2JyZWFrO2Nhc2UgbS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbDptLnVwZGF0ZVRpbWVyQ29udHJvbChjKX1yZXR1cm4hMH1hPT09Qi5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyJiZCLnVwZGF0ZUpveXBhZChjKTtpZihhPT09cS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpcmV0dXJuIHEudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkKGMpLCEwO2E9PT1xLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZCYmcS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKGMpO3JldHVybiEwfWZ1bmN0aW9uIG9iKGEpe3N3aXRjaChhPj4xMil7Y2FzZSAwOmNhc2UgMTpjYXNlIDI6Y2FzZSAzOnJldHVybiBhK0dhO2Nhc2UgNDpjYXNlIDU6Y2FzZSA2OmNhc2UgNzp2YXIgYz0KZC5jdXJyZW50Um9tQmFuaztkLmlzTUJDNXx8MCE9PWN8fChjPTEpO3JldHVybiAxNjM4NCpjKyhhLWQuc3dpdGNoYWJsZUNhcnRyaWRnZVJvbUxvY2F0aW9uKStHYTtjYXNlIDg6Y2FzZSA5OnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz14KGQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmMSksYS1kLnZpZGVvUmFtTG9jYXRpb24rMjA0OCs4MTkyKmM7Y2FzZSAxMDpjYXNlIDExOnJldHVybiA4MTkyKmQuY3VycmVudFJhbUJhbmsrKGEtZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbikrWGE7Y2FzZSAxMjpyZXR1cm4gYS1kLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisxODQzMjtjYXNlIDEzOnJldHVybiBjPTAsYi5HQkNFbmFibGVkJiYoYz14KGQubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaykmNyksMT5jJiYoYz0xKSxhLWQuaW50ZXJuYWxSYW1CYW5rWmVyb0xvY2F0aW9uKzE4NDMyKzQwOTYqKGMtMSk7ZGVmYXVsdDpyZXR1cm4gYS1kLmVjaG9SYW1Mb2NhdGlvbis1MTIwMH19CmZ1bmN0aW9uIGgoYSxiKXthPW9iKGEpO2tbYV09Yn1mdW5jdGlvbiBSKGEsYil7a1thXT1iPzE6MH1mdW5jdGlvbiBKYihhKXt0LnNjYW5saW5lQ3ljbGVDb3VudGVyPTA7dC5zY2FubGluZVJlZ2lzdGVyPTA7aCh0Lm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlciwwKTt2YXIgYj14KEMubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMpO2I9SCgxLGIpO2I9SCgwLGIpO0MuY3VycmVudExjZE1vZGU9MDtoKEMubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsYik7aWYoYSlmb3IoYT0wO2E8S2I7YSsrKWtbNjc1ODQrYV09MjU1fWZ1bmN0aW9uIExiKGEsYil7dmFyIGM9Qy5jb2luY2lkZW5jZUNvbXBhcmU7MCE9PWEmJjEhPT1hfHx0LnNjYW5saW5lUmVnaXN0ZXIhPT1jP2I9SCgyLGIpOihifD00LHAoNixiKSYmKHEuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAseWEocS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCkpKTtyZXR1cm4gYn1mdW5jdGlvbiBNYihhLGMsZSx5LGQsaCl7Zm9yKHZhciBsPQp5Pj4zOzE2MD5kO2QrKyl7dmFyIGY9ZCtoOzI1Njw9ZiYmKGYtPTI1Nik7dmFyIE89ZSszMipsKyhmPj4zKSxnPWFhKE8sMCkscT0hMTtpZihRLnRpbGVDYWNoaW5nKXt2YXIgbj1kO3ZhciBtPWEscj1mLHU9Tyx3PWcsdj0wO2lmKDA8bSYmODxuJiZ3PT09aGEudGlsZUlkJiZuPT09aGEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2spe3ZhciB6PXc9ITE7cCg1LHgodS0xKSkmJih3PSEwKTtwKDUseCh1KSkmJih6PSEwKTtmb3IodT0wOzg+dTt1KyspaWYodyE9PXomJih1PTctdSksMTYwPj1uK3Upe2Zvcih2YXIgQT1uLSg4LXUpLEM9emErMyooMTYwKm0rKG4rdSkpLEI9MDszPkI7QisrKWNhKG4rdSxtLEIsa1tDK0JdKTtBPWtbNjc3MTIrKDE2MCptK0EpXTtTYShuK3UsbSxIKDIsQSkscCgyLEEpKTt2Kyt9fWVsc2UgaGEudGlsZUlkPXc7bj49aGEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2smJihoYS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz1uKzgsbT0KciU4LG48bSYmKGhhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrKz1tKSk7bj12OzA8biYmKGQrPW4tMSxxPSEwKX1RLnRpbGVSZW5kZXJpbmcmJiFxPyhxPWQsbj1hLHY9YyxtPXklOCxyPTAsMD09cSYmKHI9Zi1mLzgqOCksZj03LDE2MDxxKzgmJihmPTE2MC1xKSx3PS0xLHo9MCxiLkdCQ0VuYWJsZWQmJih3PWFhKE8sMSkscCgzLHcpJiYoej0xKSxwKDYsdykmJihtPTctbSkpLG49ZGIoZyx2LHoscixmLG0scSxuLDE2MCx6YSwhMSwwLHcsLTEpLDA8biYmKGQrPW4tMSkpOnF8fChiLkdCQ0VuYWJsZWQ/KHE9ZCxuPWEsbT15LHY9Q2EoYyxnKSxPPWFhKE8sMSksbSU9OCxwKDYsTykmJihtPTctbSkscj0wLHAoMyxPKSYmKHI9MSksZz1hYSh2KzIqbSxyKSx2PWFhKHYrMiptKzEsciksbT1mJTgscCg1LE8pfHwobT03LW0pLGY9MCxwKG0sdikmJihmPWYrMTw8MSkscChtLGcpJiYoZis9MSksbT1SYShPJjcsZiwhMSksZz1kYSgwLG0pLHY9ZGEoMSxtKSxtPWRhKDIsbSksY2EocSwKbiwwLGcpLGNhKHEsbiwxLHYpLGNhKHEsbiwyLG0pLFNhKHEsbixmLHAoNyxPKSkpOihPPWQscT1hLHY9eSxuPUNhKGMsZyksdiU9OCxnPWFhKG4rMip2LDApLG49YWEobisyKnYrMSwwKSx2PTctZiU4LGY9MCxwKHYsbikmJihmPWYrMTw8MSkscCh2LGcpJiYoZis9MSksZz1RYShmLHQubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksY2EoTyxxLDAsZyksY2EoTyxxLDEsZyksY2EoTyxxLDIsZyksU2EoTyxxLGYpKSl9fWZ1bmN0aW9uIE5iKGEpe2lmKEMuZW5hYmxlZClmb3IodC5zY2FubGluZUN5Y2xlQ291bnRlcis9YTt0LnNjYW5saW5lQ3ljbGVDb3VudGVyPj10Lk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCk7KXt0LnNjYW5saW5lQ3ljbGVDb3VudGVyLT10Lk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCk7YT10LnNjYW5saW5lUmVnaXN0ZXI7aWYoMTQ0PT09YSl7aWYoUS5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZylmb3IodmFyIGI9MDsxNDQ+PWI7YisrKXBiKGIpOwplbHNlIHBiKGEpO2ZvcihiPTA7MTQ0PmI7YisrKWZvcih2YXIgZT0wOzE2MD5lO2UrKylrWzY3NzEyKygxNjAqYitlKV09MDtoYS50aWxlSWQ9LTE7aGEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9LTF9ZWxzZSAxNDQ+YSYmKFEuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmd8fHBiKGEpKTthPTE1MzxhPzA6YSsxO3Quc2NhbmxpbmVSZWdpc3Rlcj1hfWlmKEMuZW5hYmxlZClpZihiPXQuc2NhbmxpbmVSZWdpc3RlcixlPUMuY3VycmVudExjZE1vZGUsYT0wLDE0NDw9Yj9hPTE6dC5zY2FubGluZUN5Y2xlQ291bnRlcj49dC5NSU5fQ1lDTEVTX1NQUklURVNfTENEX01PREUoKT9hPTI6dC5zY2FubGluZUN5Y2xlQ291bnRlcj49dC5NSU5fQ1lDTEVTX1RSQU5TRkVSX0RBVEFfTENEX01PREUoKSYmKGE9MyksZSE9PWEpe2I9eChDLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTtDLmN1cnJlbnRMY2RNb2RlPWE7ZT0hMTtzd2l0Y2goYSl7Y2FzZSAwOmI9SCgwLGIpO2I9CkgoMSxiKTtlPXAoMyxiKTticmVhaztjYXNlIDE6Yj1IKDEsYik7Ynw9MTtlPXAoNCxiKTticmVhaztjYXNlIDI6Yj1IKDAsYik7Ynw9MjtlPXAoNSxiKTticmVhaztjYXNlIDM6Ynw9M31lJiYocS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCx5YShxLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSk7MD09PWEmJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYoZT0xNixkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZzxlJiYoZT1kLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZyksSWIoZC5oYmxhbmtIZG1hU291cmNlLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uLGUpLGQuaGJsYW5rSGRtYVNvdXJjZSs9ZSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbis9ZSxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZy09ZSwwPj1kLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz8oZC5pc0hibGFua0hkbWFBY3RpdmU9ITEsaChkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsCjI1NSkpOmgoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLEgoNyxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZy8xNi0xKSkpOzE9PT1hJiYocS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMCx5YShxLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSk7Yj1MYihhLGIpO2goQy5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKX1lbHNlIDE1Mz09PWImJihiPXgoQy5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyksYj1MYihhLGIpLGgoQy5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKSl9ZnVuY3Rpb24gcGIoYSl7dmFyIGM9dC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0O0MuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdCYmKGM9dC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQpO2lmKGIuR0JDRW5hYmxlZHx8Qy5iZ0Rpc3BsYXlFbmFibGVkKXt2YXIgZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDtDLmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJgooZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTt2YXIgZD10LnNjcm9sbFgsbD1hK3Quc2Nyb2xsWTsyNTY8PWwmJihsLT0yNTYpO01iKGEsYyxlLGwsMCxkKX1DLndpbmRvd0Rpc3BsYXlFbmFibGVkJiYoZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydCxDLndpbmRvd1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KSxkPXQud2luZG93WCxsPXQud2luZG93WSxhPGx8fChkLT03LE1iKGEsYyxlLGEtbCxkLC0xKmQpKSk7aWYoQy5zcHJpdGVEaXNwbGF5RW5hYmxlKWZvcihjPUMudGFsbFNwcml0ZVNpemUsZT0zOTswPD1lO2UtLSl7bD00KmU7dmFyIGY9eCh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2wpO2Q9eCh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2wrMSk7dmFyIGg9eCh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlKwpsKzIpO2YtPTE2O2QtPTg7dmFyIG09ODtjJiYobT0xNiwxPT09aCUyJiYtLWgpO2lmKGE+PWYmJmE8ZittKXtsPXgodC5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStsKzMpO3ZhciBuPXAoNyxsKSxnPXAoNixsKSxxPXAoNSxsKTtmPWEtZjtnJiYoZi09bSxmKj0tMSwtLWYpO2YqPTI7aD1DYSh0Lm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCxoKTttPWgrPWY7Zj0wO2IuR0JDRW5hYmxlZCYmcCgzLGwpJiYoZj0xKTtoPWFhKG0sZik7bT1hYShtKzEsZik7Zm9yKGY9NzswPD1mO2YtLSl7Zz1mO3EmJihnLT03LGcqPS0xKTt2YXIgcj0wO3AoZyxtKSYmKHIrPTEscjw8PTEpO3AoZyxoKSYmKHIrPTEpO2lmKDAhPT1yJiYoZz1kKyg3LWYpLDA8PWcmJjE2MD49Zykpe3ZhciB1PSExLHY9ITEsdz0hMTtiLkdCQ0VuYWJsZWQmJiFDLmJnRGlzcGxheUVuYWJsZWQmJih1PSEwKTtpZighdSl7dmFyIHo9a1s2NzcxMisoMTYwKmErZyldLEE9eiYzO24mJjA8CkE/dj0hMDpiLkdCQ0VuYWJsZWQmJnAoMix6KSYmMDxBJiYodz0hMCl9aWYodXx8IXYmJiF3KWIuR0JDRW5hYmxlZD8odj1SYShsJjcsciwhMCkscj1kYSgwLHYpLHU9ZGEoMSx2KSx2PWRhKDIsdiksY2EoZyxhLDAsciksY2EoZyxhLDEsdSksY2EoZyxhLDIsdikpOih1PXQubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lLHAoNCxsKSYmKHU9dC5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd28pLHI9UWEocix1KSxjYShnLGEsMCxyKSxjYShnLGEsMSxyKSxjYShnLGEsMixyKSl9fX19fWZ1bmN0aW9uIGNhKGEsYixlLGQpe2tbemErMyooMTYwKmIrYSkrZV09ZH1mdW5jdGlvbiBhYShhLGIpe3JldHVybiBrW2EtZC52aWRlb1JhbUxvY2F0aW9uKzIwNDgrODE5MiooYiYxKV19ZnVuY3Rpb24gcWIoYSl7dmFyIGM9ZC52aWRlb1JhbUxvY2F0aW9uO3JldHVybiBhPGN8fGE+PWMmJmE8ZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbj8tMTphPj1kLmVjaG9SYW1Mb2NhdGlvbiYmYTxkLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj8KeChhLTgxOTIpOmE+PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uJiZhPD1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD8yPkMuY3VycmVudExjZE1vZGU/MjU1Oi0xOmE9PT1iLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2g/KGE9MjU1LGM9eChiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLHAoMCxjKXx8KGE9SCgwLGEpKSxiLkdCQ0RvdWJsZVNwZWVkfHwoYT1IKDcsYSkpLGEpOmE9PT10Lm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj8oaChhLHQuc2NhbmxpbmVSZWdpc3RlciksdC5zY2FubGluZVJlZ2lzdGVyKTo2NTI5Njw9YSYmNjUzMTg+PWE/KFVhKCksYT1hPT09Zi5tZW1vcnlMb2NhdGlvbk5SNTI/eChmLm1lbW9yeUxvY2F0aW9uTlI1MikmMTI4fDExMjotMSxhKTo2NTMyODw9YSYmNjUzNDM+PWE/KFVhKCksLTEpOmE9PT1tLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPyhjPUYobS5kaXZpZGVyUmVnaXN0ZXIpLGgoYSxjKSwKYyk6YT09PW0ubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI/KGgoYSxtLnRpbWVyQ291bnRlciksbS50aW1lckNvdW50ZXIpOmE9PT1xLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdD8yMjR8cS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU6YT09PUIubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3Rlcj8oYT1CLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCxCLmlzRHBhZFR5cGU/KGE9Qi51cD9IKDIsYSk6YXw0LGE9Qi5yaWdodD9IKDAsYSk6YXwxLGE9Qi5kb3duP0goMyxhKTphfDgsYT1CLmxlZnQ/SCgxLGEpOmF8Mik6Qi5pc0J1dHRvblR5cGUmJihhPUIuYT9IKDAsYSk6YXwxLGE9Qi5iP0goMSxhKTphfDIsYT1CLnNlbGVjdD9IKDIsYSk6YXw0LGE9Qi5zdGFydD9IKDMsYSk6YXw4KSxhfDI0MCk6LTF9ZnVuY3Rpb24geChhKXtyZXR1cm4ga1tvYihhKV19ZnVuY3Rpb24gbmIoYSl7dmFyIGI9cWIoYSk7c3dpdGNoKGIpe2Nhc2UgLTE6cmV0dXJuIHgoYSk7ZGVmYXVsdDpyZXR1cm4gYn19CmZ1bmN0aW9uIFMoYSl7cmV0dXJuIDA8a1thXT8hMDohMX1mdW5jdGlvbiBpYShhKXtUKGIucmVnaXN0ZXJBLGEpO2NiKGIucmVnaXN0ZXJBLGEpO2IucmVnaXN0ZXJBPWIucmVnaXN0ZXJBK2EmMjU1OzA9PT1iLnJlZ2lzdGVyQT9nKDEpOmcoMCk7dSgwKX1mdW5jdGlvbiBqYShhKXt2YXIgYz1iLnJlZ2lzdGVyQSthK1YoKSYyNTU7MCE9KChiLnJlZ2lzdGVyQV5hXmMpJjE2KT9EKDEpOkQoMCk7MDwoYi5yZWdpc3RlckErYStWKCkmMjU2KT92KDEpOnYoMCk7Yi5yZWdpc3RlckE9YzswPT09Yi5yZWdpc3RlckE/ZygxKTpnKDApO3UoMCl9ZnVuY3Rpb24ga2EoYSl7dmFyIGM9LTEqYTtUKGIucmVnaXN0ZXJBLGMpO2NiKGIucmVnaXN0ZXJBLGMpO2IucmVnaXN0ZXJBPWIucmVnaXN0ZXJBLWEmMjU1OzA9PT1iLnJlZ2lzdGVyQT9nKDEpOmcoMCk7dSgxKX1mdW5jdGlvbiBsYShhKXt2YXIgYz1iLnJlZ2lzdGVyQS1hLVYoKSYyNTU7MCE9KChiLnJlZ2lzdGVyQV5hXmMpJjE2KT9EKDEpOgpEKDApOzA8KGIucmVnaXN0ZXJBLWEtVigpJjI1Nik/digxKTp2KDApO2IucmVnaXN0ZXJBPWM7MD09PWIucmVnaXN0ZXJBP2coMSk6ZygwKTt1KDEpfWZ1bmN0aW9uIG1hKGEpe2IucmVnaXN0ZXJBJj1hOzA9PT1iLnJlZ2lzdGVyQT9nKDEpOmcoMCk7dSgwKTtEKDEpO3YoMCl9ZnVuY3Rpb24gbmEoYSl7Yi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBXmEpJjI1NTswPT09Yi5yZWdpc3RlckE/ZygxKTpnKDApO3UoMCk7RCgwKTt2KDApfWZ1bmN0aW9uIG9hKGEpe2IucmVnaXN0ZXJBfD1hOzA9PT1iLnJlZ2lzdGVyQT9nKDEpOmcoMCk7dSgwKTtEKDApO3YoMCl9ZnVuY3Rpb24gcGEoYSl7YSo9LTE7VChiLnJlZ2lzdGVyQSxhKTtjYihiLnJlZ2lzdGVyQSxhKTswPT09Yi5yZWdpc3RlckErYT9nKDEpOmcoMCk7dSgxKX1mdW5jdGlvbiB0YShhLGIpezA9PT0oYiYxPDxhKT9nKDEpOmcoMCk7dSgwKTtEKDEpO3JldHVybiBifWZ1bmN0aW9uIFooYSxiLGUpe3JldHVybiAwPGI/ZXwxPDxhOmUmCn4oMTw8YSl9ZnVuY3Rpb24gSGEoYSl7YT1iYihhKTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrYSY2NTUzNTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNX1mdW5jdGlvbiBPYihhKXtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtiLmlzSGFsdEJ1ZyYmKGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlci0xJjY1NTM1KTtzd2l0Y2goKGEmMjQwKT4+NCl7Y2FzZSAwOnJldHVybiBaYihhKTtjYXNlIDE6cmV0dXJuICRiKGEpO2Nhc2UgMjpyZXR1cm4gYWMoYSk7Y2FzZSAzOnJldHVybiBiYyhhKTtjYXNlIDQ6cmV0dXJuIGNjKGEpO2Nhc2UgNTpyZXR1cm4gZGMoYSk7Y2FzZSA2OnJldHVybiBlYyhhKTtjYXNlIDc6cmV0dXJuIGZjKGEpO2Nhc2UgODpyZXR1cm4gZ2MoYSk7Y2FzZSA5OnJldHVybiBoYyhhKTtjYXNlIDEwOnJldHVybiBpYyhhKTtjYXNlIDExOnJldHVybiBqYyhhKTtjYXNlIDEyOnJldHVybiBrYyhhKTsKY2FzZSAxMzpyZXR1cm4gbGMoYSk7Y2FzZSAxNDpyZXR1cm4gbWMoYSk7ZGVmYXVsdDpyZXR1cm4gbmMoYSl9fWZ1bmN0aW9uIEooYSl7cWEoNCk7cmV0dXJuIG5iKGEpfWZ1bmN0aW9uIFUoYSxiKXtxYSg0KTtXYShhLGIpJiZoKGEsYil9ZnVuY3Rpb24gZWEoYSl7cWEoOCk7dmFyIGI9cWIoYSk7c3dpdGNoKGIpe2Nhc2UgLTE6Yj14KGEpfWErPTE7dmFyIGU9cWIoYSk7c3dpdGNoKGUpe2Nhc2UgLTE6YT14KGEpO2JyZWFrO2RlZmF1bHQ6YT1lfXJldHVybiByKGEsYil9ZnVuY3Rpb24gVyhhLGIpe3FhKDgpO3ZhciBjPUYoYik7YiY9MjU1O3ZhciBkPWErMTtXYShhLGIpJiZoKGEsYik7V2EoZCxjKSYmaChkLGMpfWZ1bmN0aW9uIEcoKXtxYSg0KTtyZXR1cm4geChiLnByb2dyYW1Db3VudGVyKX1mdW5jdGlvbiBZKCl7cWEoNCk7dmFyIGE9eChiLnByb2dyYW1Db3VudGVyKzEmNjU1MzUpO3JldHVybiByKGEsRygpKX1mdW5jdGlvbiBaYihhKXtzd2l0Y2goYSl7Y2FzZSAwOnJldHVybiA0OwpjYXNlIDE6cmV0dXJuIGE9WSgpLGIucmVnaXN0ZXJCPUYoYSksYi5yZWdpc3RlckM9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDI6cmV0dXJuIFUocihiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYi5yZWdpc3RlckEpLDQ7Y2FzZSAzOnJldHVybiBhPXIoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpLGErKyxiLnJlZ2lzdGVyQj1GKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSA0OnJldHVybiBUKGIucmVnaXN0ZXJCLDEpLGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJCKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQj9nKDEpOmcoMCksdSgwKSw0O2Nhc2UgNTpyZXR1cm4gVChiLnJlZ2lzdGVyQiwtMSksYi5yZWdpc3RlckI9Yi5yZWdpc3RlckItMSYyNTUsMD09PWIucmVnaXN0ZXJCP2coMSk6ZygwKSx1KDEpLDQ7Y2FzZSA2OnJldHVybiBiLnJlZ2lzdGVyQj1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsCjQ7Y2FzZSA3OnJldHVybiAxMjg9PT0oYi5yZWdpc3RlckEmMTI4KT92KDEpOnYoMCksYT1iLnJlZ2lzdGVyQSxiLnJlZ2lzdGVyQT0oYTw8MXxhPj43KSYyNTUsZygwKSx1KDApLEQoMCksNDtjYXNlIDg6cmV0dXJuIFcoWSgpLGIuc3RhY2tQb2ludGVyKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgOTphPXIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpO3ZhciBjPXIoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpO3ZhKGEsYywhMSk7YT1hK2MmNjU1MzU7Yi5yZWdpc3Rlckg9RihhKTtiLnJlZ2lzdGVyTD1hJjI1NTt1KDApO3JldHVybiA4O2Nhc2UgMTA6cmV0dXJuIGIucmVnaXN0ZXJBPUoocihiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDQ7Y2FzZSAxMTpyZXR1cm4gYT1yKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyQj1GKGEpLGIucmVnaXN0ZXJDPWEmMjU1LDg7Y2FzZSAxMjpyZXR1cm4gVChiLnJlZ2lzdGVyQywKMSksYi5yZWdpc3RlckM9Yi5yZWdpc3RlckMrMSYyNTUsMD09PWIucmVnaXN0ZXJDP2coMSk6ZygwKSx1KDApLDQ7Y2FzZSAxMzpyZXR1cm4gVChiLnJlZ2lzdGVyQywtMSksYi5yZWdpc3RlckM9Yi5yZWdpc3RlckMtMSYyNTUsMD09PWIucmVnaXN0ZXJDP2coMSk6ZygwKSx1KDEpLDQ7Y2FzZSAxNDpyZXR1cm4gYi5yZWdpc3RlckM9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAxNTpyZXR1cm4gMDwoYi5yZWdpc3RlckEmMSk/digxKTp2KDApLGE9Yi5yZWdpc3RlckEsYi5yZWdpc3RlckE9KGE+PjF8YTw8NykmMjU1LGcoMCksdSgwKSxEKDApLDR9cmV0dXJuLTF9ZnVuY3Rpb24gJGIoYSl7c3dpdGNoKGEpe2Nhc2UgMTY6aWYoYi5HQkNFbmFibGVkJiYoYT1KKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCkscCgwLGEpKSlyZXR1cm4gYT1IKDAsYSkscCg3LGEpPyhiLkdCQ0RvdWJsZVNwZWVkPSExLGE9SCg3LGEpKTooYi5HQkNEb3VibGVTcGVlZD0KITAsYXw9MTI4KSxVKGIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaCxhKSw2ODtiLmlzU3RvcHBlZD0hMDtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNTtyZXR1cm4gNDtjYXNlIDE3OnJldHVybiBhPVkoKSxiLnJlZ2lzdGVyRD1GKGEpLGIucmVnaXN0ZXJFPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAxODpyZXR1cm4gVShyKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQSksNDtjYXNlIDE5OnJldHVybiBhPXIoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJEPUYoYSksYi5yZWdpc3RlckU9YSYyNTUsODtjYXNlIDIwOnJldHVybiBUKGIucmVnaXN0ZXJELDEpLGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJEKzEmMjU1LDA9PT1iLnJlZ2lzdGVyRD9nKDEpOmcoMCksdSgwKSw0O2Nhc2UgMjE6cmV0dXJuIFQoYi5yZWdpc3RlckQsLTEpLGIucmVnaXN0ZXJEPQpiLnJlZ2lzdGVyRC0xJjI1NSwwPT09Yi5yZWdpc3RlckQ/ZygxKTpnKDApLHUoMSksNDtjYXNlIDIyOnJldHVybiBiLnJlZ2lzdGVyRD1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzOnJldHVybiBhPSExLDEyOD09PShiLnJlZ2lzdGVyQSYxMjgpJiYoYT0hMCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPDwxfFYoKSkmMjU1LGE/digxKTp2KDApLGcoMCksdSgwKSxEKDApLDQ7Y2FzZSAyNDpyZXR1cm4gSGEoRygpKSw4O2Nhc2UgMjU6YT1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKTt2YXIgYz1yKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKTt2YShhLGMsITEpO2E9YStjJjY1NTM1O2IucmVnaXN0ZXJIPUYoYSk7Yi5yZWdpc3Rlckw9YSYyNTU7dSgwKTtyZXR1cm4gODtjYXNlIDI2OnJldHVybiBhPXIoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpLGIucmVnaXN0ZXJBPUooYSksNDtjYXNlIDI3OnJldHVybiBhPXIoYi5yZWdpc3RlckQsCmIucmVnaXN0ZXJFKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVyRD1GKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyODpyZXR1cm4gVChiLnJlZ2lzdGVyRSwxKSxiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyRSsxJjI1NSwwPT09Yi5yZWdpc3RlckU/ZygxKTpnKDApLHUoMCksNDtjYXNlIDI5OnJldHVybiBUKGIucmVnaXN0ZXJFLC0xKSxiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyRS0xJjI1NSwwPT09Yi5yZWdpc3RlckU/ZygxKTpnKDApLHUoMSksNDtjYXNlIDMwOnJldHVybiBiLnJlZ2lzdGVyRT1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDMxOnJldHVybiBhPSExLDE9PT0oYi5yZWdpc3RlckEmMSkmJihhPSEwKSxiLnJlZ2lzdGVyQT0oYi5yZWdpc3RlckE+PjF8VigpPDw3KSYyNTUsYT92KDEpOnYoMCksZygwKSx1KDApLEQoMCksNH1yZXR1cm4tMX1mdW5jdGlvbiBhYyhhKXtzd2l0Y2goYSl7Y2FzZSAzMjpyZXR1cm4gMD09PXJhKCk/CkhhKEcoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDMzOnJldHVybiBhPVkoKSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAzNDpyZXR1cm4gYT1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxVKGEsYi5yZWdpc3RlckEpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUYoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDM1OnJldHVybiBhPXIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUYoYSksYi5yZWdpc3Rlckw9YSYyNTUsODtjYXNlIDM2OnJldHVybiBUKGIucmVnaXN0ZXJILDEpLGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJIKzEmMjU1LDA9PT1iLnJlZ2lzdGVySD9nKDEpOmcoMCksdSgwKSw0O2Nhc2UgMzc6cmV0dXJuIFQoYi5yZWdpc3RlckgsLTEpLGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILQoxJjI1NSwwPT09Yi5yZWdpc3Rlckg/ZygxKTpnKDApLHUoMSksNDtjYXNlIDM4OnJldHVybiBiLnJlZ2lzdGVySD1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDM5OnZhciBjPTA7MDwoYi5yZWdpc3RlckY+PjUmMSkmJihjfD02KTswPFYoKSYmKGN8PTk2KTswPChiLnJlZ2lzdGVyRj4+NiYxKT9hPWIucmVnaXN0ZXJBLWMmMjU1Oig5PChiLnJlZ2lzdGVyQSYxNSkmJihjfD02KSwxNTM8Yi5yZWdpc3RlckEmJihjfD05NiksYT1iLnJlZ2lzdGVyQStjJjI1NSk7MD09PWE/ZygxKTpnKDApOzAhPT0oYyY5Nik/digxKTp2KDApO0QoMCk7Yi5yZWdpc3RlckE9YTtyZXR1cm4gNDtjYXNlIDQwOnJldHVybiAwPHJhKCk/SGEoRygpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgNDE6cmV0dXJuIGE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksdmEoYSxhLCExKSxhPTIqYSY2NTUzNSxiLnJlZ2lzdGVySD0KRihhKSxiLnJlZ2lzdGVyTD1hJjI1NSx1KDApLDg7Y2FzZSA0MjpyZXR1cm4gYT1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQT1KKGEpLGE9YSsxJjY1NTM1LGIucmVnaXN0ZXJIPUYoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDQzOnJldHVybiBhPXIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGE9YS0xJjY1NTM1LGIucmVnaXN0ZXJIPUYoYSksYi5yZWdpc3Rlckw9YSYyNTUsODtjYXNlIDQ0OnJldHVybiBUKGIucmVnaXN0ZXJMLDEpLGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJMKzEmMjU1LDA9PT1iLnJlZ2lzdGVyTD9nKDEpOmcoMCksdSgwKSw0O2Nhc2UgNDU6cmV0dXJuIFQoYi5yZWdpc3RlckwsLTEpLGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJMLTEmMjU1LDA9PT1iLnJlZ2lzdGVyTD9nKDEpOmcoMCksdSgxKSw0O2Nhc2UgNDY6cmV0dXJuIGIucmVnaXN0ZXJMPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNDc6cmV0dXJuIGIucmVnaXN0ZXJBPQp+Yi5yZWdpc3RlckEsdSgxKSxEKDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gYmMoYSl7c3dpdGNoKGEpe2Nhc2UgNDg6cmV0dXJuIDA9PT1WKCk/SGEoRygpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgNDk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPVkoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgNTA6cmV0dXJuIGE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksVShhLGIucmVnaXN0ZXJBKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSA1MTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMSY2NTUzNSw4O2Nhc2UgNTI6YT1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKTt2YXIgYz1KKGEpO1QoYywxKTtjPWMrMSYyNTU7MD09PWM/ZygxKTpnKDApO3UoMCk7VShhLGMpO3JldHVybiA0O2Nhc2UgNTM6cmV0dXJuIGE9cihiLnJlZ2lzdGVySCwKYi5yZWdpc3RlckwpLGM9SihhKSxUKGMsLTEpLGM9Yy0xJjI1NSwwPT09Yz9nKDEpOmcoMCksdSgxKSxVKGEsYyksNDtjYXNlIDU0OnJldHVybiBVKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDU1OnJldHVybiB1KDApLEQoMCksdigxKSw0O2Nhc2UgNTY6cmV0dXJuIDE9PT1WKCk/SGEoRygpKTpiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgNTc6cmV0dXJuIGE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksdmEoYSxiLnN0YWNrUG9pbnRlciwhMSksYT1hK2Iuc3RhY2tQb2ludGVyJjY1NTM1LGIucmVnaXN0ZXJIPUYoYSksYi5yZWdpc3Rlckw9YSYyNTUsdSgwKSw4O2Nhc2UgNTg6cmV0dXJuIGE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckE9SihhKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPQphJjI1NSw0O2Nhc2UgNTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTEmNjU1MzUsODtjYXNlIDYwOnJldHVybiBUKGIucmVnaXN0ZXJBLDEpLGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJBKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQT9nKDEpOmcoMCksdSgwKSw0O2Nhc2UgNjE6cmV0dXJuIFQoYi5yZWdpc3RlckEsLTEpLGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJBLTEmMjU1LDA9PT1iLnJlZ2lzdGVyQT9nKDEpOmcoMCksdSgxKSw0O2Nhc2UgNjI6cmV0dXJuIGIucmVnaXN0ZXJBPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgNjM6cmV0dXJuIHUoMCksRCgwKSwwPFYoKT92KDApOnYoMSksNH1yZXR1cm4tMX1mdW5jdGlvbiBjYyhhKXtzd2l0Y2goYSl7Y2FzZSA2NDpyZXR1cm4gNDtjYXNlIDY1OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQyw0O2Nhc2UgNjY6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJELAo0O2Nhc2UgNjc6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJFLDQ7Y2FzZSA2ODpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckgsNDtjYXNlIDY5OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyTCw0O2Nhc2UgNzA6cmV0dXJuIGIucmVnaXN0ZXJCPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA3MTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckEsNDtjYXNlIDcyOnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQiw0O2Nhc2UgNzM6cmV0dXJuIDQ7Y2FzZSA3NDpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckQsNDtjYXNlIDc1OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyRSw0O2Nhc2UgNzY6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJILDQ7Y2FzZSA3NzpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckwsNDtjYXNlIDc4OnJldHVybiBiLnJlZ2lzdGVyQz1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSwKNDtjYXNlIDc5OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIGRjKGEpe3N3aXRjaChhKXtjYXNlIDgwOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQiw0O2Nhc2UgODE6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJDLDQ7Y2FzZSA4MjpyZXR1cm4gNDtjYXNlIDgzOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyRSw0O2Nhc2UgODQ6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJILDQ7Y2FzZSA4NTpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckwsNDtjYXNlIDg2OnJldHVybiBiLnJlZ2lzdGVyRD1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgODc6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJBLDQ7Y2FzZSA4ODpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckIsNDtjYXNlIDg5OnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyQyw0O2Nhc2UgOTA6cmV0dXJuIGIucmVnaXN0ZXJFPQpiLnJlZ2lzdGVyRCw0O2Nhc2UgOTE6cmV0dXJuIDQ7Y2FzZSA5MjpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckgsNDtjYXNlIDkzOnJldHVybiBiLnJlZ2lzdGVyRT1iLnJlZ2lzdGVyTCw0O2Nhc2UgOTQ6cmV0dXJuIGIucmVnaXN0ZXJFPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSA5NTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckEsNH1yZXR1cm4tMX1mdW5jdGlvbiBlYyhhKXtzd2l0Y2goYSl7Y2FzZSA5NjpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckIsNDtjYXNlIDk3OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQyw0O2Nhc2UgOTg6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJELDQ7Y2FzZSA5OTpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckUsNDtjYXNlIDEwMDpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckgsNDtjYXNlIDEwMTpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckwsNDtjYXNlIDEwMjpyZXR1cm4gYi5yZWdpc3Rlckg9CkoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSAxMDM6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJBLDQ7Y2FzZSAxMDQ6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJCLDQ7Y2FzZSAxMDU6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJDLDQ7Y2FzZSAxMDY6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJELDQ7Y2FzZSAxMDc6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMDg6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMDk6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMTA6cmV0dXJuIGIucmVnaXN0ZXJMPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDQ7Y2FzZSAxMTE6cmV0dXJuIGIucmVnaXN0ZXJMPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gZmMoYSl7c3dpdGNoKGEpe2Nhc2UgMTEyOnJldHVybiBVKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLApiLnJlZ2lzdGVyQiksNDtjYXNlIDExMzpyZXR1cm4gVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyQyksNDtjYXNlIDExNDpyZXR1cm4gVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyRCksNDtjYXNlIDExNTpyZXR1cm4gVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyRSksNDtjYXNlIDExNjpyZXR1cm4gVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVySCksNDtjYXNlIDExNzpyZXR1cm4gVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxiLnJlZ2lzdGVyTCksNDtjYXNlIDExODpyZXR1cm4gZC5pc0hibGFua0hkbWFBY3RpdmV8fGIuZW5hYmxlSGFsdCgpLDQ7Y2FzZSAxMTk6cmV0dXJuIFUocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckEpLDQ7Y2FzZSAxMjA6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJCLDQ7Y2FzZSAxMjE6cmV0dXJuIGIucmVnaXN0ZXJBPWIucmVnaXN0ZXJDLAo0O2Nhc2UgMTIyOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyRCw0O2Nhc2UgMTIzOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTI0OnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVySCw0O2Nhc2UgMTI1OnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTI2OnJldHVybiBiLnJlZ2lzdGVyQT1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTI3OnJldHVybiA0fXJldHVybi0xfWZ1bmN0aW9uIGdjKGEpe3N3aXRjaChhKXtjYXNlIDEyODpyZXR1cm4gaWEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMjk6cmV0dXJuIGlhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTMwOnJldHVybiBpYShiLnJlZ2lzdGVyRCksNDtjYXNlIDEzMTpyZXR1cm4gaWEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxMzI6cmV0dXJuIGlhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTMzOnJldHVybiBpYShiLnJlZ2lzdGVyTCksNDtjYXNlIDEzNDpyZXR1cm4gYT0KSihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksaWEoYSksNDtjYXNlIDEzNTpyZXR1cm4gaWEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxMzY6cmV0dXJuIGphKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTM3OnJldHVybiBqYShiLnJlZ2lzdGVyQyksNDtjYXNlIDEzODpyZXR1cm4gamEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzk6cmV0dXJuIGphKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQwOnJldHVybiBqYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0MTpyZXR1cm4gamEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNDI6cmV0dXJuIGE9SihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksamEoYSksNDtjYXNlIDE0MzpyZXR1cm4gamEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gaGMoYSl7c3dpdGNoKGEpe2Nhc2UgMTQ0OnJldHVybiBrYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE0NTpyZXR1cm4ga2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNDY6cmV0dXJuIGthKGIucmVnaXN0ZXJEKSw0OwpjYXNlIDE0NzpyZXR1cm4ga2EoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNDg6cmV0dXJuIGthKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTQ5OnJldHVybiBrYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE1MDpyZXR1cm4gYT1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxrYShhKSw0O2Nhc2UgMTUxOnJldHVybiBrYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE1MjpyZXR1cm4gbGEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNTM6cmV0dXJuIGxhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTU0OnJldHVybiBsYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE1NTpyZXR1cm4gbGEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNTY6cmV0dXJuIGxhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTU3OnJldHVybiBsYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE1ODpyZXR1cm4gYT1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxsYShhKSw0O2Nhc2UgMTU5OnJldHVybiBsYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBpYyhhKXtzd2l0Y2goYSl7Y2FzZSAxNjA6cmV0dXJuIG1hKGIucmVnaXN0ZXJCKSwKNDtjYXNlIDE2MTpyZXR1cm4gbWEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNjI6cmV0dXJuIG1hKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTYzOnJldHVybiBtYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE2NDpyZXR1cm4gbWEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNjU6cmV0dXJuIG1hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTY2OnJldHVybiBhPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLG1hKGEpLDQ7Y2FzZSAxNjc6cmV0dXJuIG1hKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTY4OnJldHVybiBuYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE2OTpyZXR1cm4gbmEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNzA6cmV0dXJuIG5hKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTcxOnJldHVybiBuYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE3MjpyZXR1cm4gbmEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNzM6cmV0dXJuIG5hKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTc0OnJldHVybiBhPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLApuYShhKSw0O2Nhc2UgMTc1OnJldHVybiBuYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBqYyhhKXtzd2l0Y2goYSl7Y2FzZSAxNzY6cmV0dXJuIG9hKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTc3OnJldHVybiBvYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE3ODpyZXR1cm4gb2EoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNzk6cmV0dXJuIG9hKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTgwOnJldHVybiBvYShiLnJlZ2lzdGVySCksNDtjYXNlIDE4MTpyZXR1cm4gb2EoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxODI6cmV0dXJuIGE9SihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksb2EoYSksNDtjYXNlIDE4MzpyZXR1cm4gb2EoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxODQ6cmV0dXJuIHBhKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTg1OnJldHVybiBwYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE4NjpyZXR1cm4gcGEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxODc6cmV0dXJuIHBhKGIucmVnaXN0ZXJFKSwKNDtjYXNlIDE4ODpyZXR1cm4gcGEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxODk6cmV0dXJuIHBhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTkwOnJldHVybiBhPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLHBhKGEpLDQ7Y2FzZSAxOTE6cmV0dXJuIHBhKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIGtjKGEpe3N3aXRjaChhKXtjYXNlIDE5MjpyZXR1cm4gMD09PXJhKCk/KGIucHJvZ3JhbUNvdW50ZXI9ZWEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAxOTM6cmV0dXJuIGE9ZWEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckI9RihhKSxiLnJlZ2lzdGVyQz1hJjI1NSw0O2Nhc2UgMTk0OmlmKDA9PT1yYSgpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1OwpyZXR1cm4gMTI7Y2FzZSAxOTU6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Y2FzZSAxOTY6aWYoMD09PXJhKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMTk3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIscihiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQykpLDg7Y2FzZSAxOTg6cmV0dXJuIGlhKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDE5OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9CjAsODtjYXNlIDIwMDpyZXR1cm4gMT09PXJhKCk/KGIucHJvZ3JhbUNvdW50ZXI9ZWEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMDE6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9ZWEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsODtjYXNlIDIwMjppZigxPT09cmEoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1ZKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMDM6dmFyIGM9RygpO2E9LTE7dmFyIGU9ITEsZD0wLGw9MCxmPWMlODtzd2l0Y2goZil7Y2FzZSAwOmQ9Yi5yZWdpc3RlckI7YnJlYWs7Y2FzZSAxOmQ9Yi5yZWdpc3RlckM7YnJlYWs7Y2FzZSAyOmQ9Yi5yZWdpc3RlckQ7YnJlYWs7Y2FzZSAzOmQ9Yi5yZWdpc3RlckU7YnJlYWs7Y2FzZSA0OmQ9Yi5yZWdpc3Rlckg7YnJlYWs7Y2FzZSA1OmQ9CmIucmVnaXN0ZXJMO2JyZWFrO2Nhc2UgNjpkPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpO2JyZWFrO2Nhc2UgNzpkPWIucmVnaXN0ZXJBfXZhciBoPShjJjI0MCk+PjQ7c3dpdGNoKGgpe2Nhc2UgMDo3Pj1jPyhjPWQsMTI4PT09KGMmMTI4KT92KDEpOnYoMCksYz0oYzw8MXxjPj43KSYyNTUsMD09PWM/ZygxKTpnKDApLHUoMCksRCgwKSxsPWMsZT0hMCk6MTU+PWMmJihjPWQsMDwoYyYxKT92KDEpOnYoMCksYz0oYz4+MXxjPDw3KSYyNTUsMD09PWM/ZygxKTpnKDApLHUoMCksRCgwKSxsPWMsZT0hMCk7YnJlYWs7Y2FzZSAxOjIzPj1jPyhjPWQsZT0hMSwxMjg9PT0oYyYxMjgpJiYoZT0hMCksYz0oYzw8MXxWKCkpJjI1NSxlP3YoMSk6digwKSwwPT09Yz9nKDEpOmcoMCksdSgwKSxEKDApLGw9YyxlPSEwKTozMT49YyYmKGM9ZCxlPSExLDE9PT0oYyYxKSYmKGU9ITApLGM9KGM+PjF8VigpPDw3KSYyNTUsZT92KDEpOnYoMCksMD09PWM/ZygxKTpnKDApLHUoMCksRCgwKSxsPQpjLGU9ITApO2JyZWFrO2Nhc2UgMjozOT49Yz8oYz1kLGU9ITEsMTI4PT09KGMmMTI4KSYmKGU9ITApLGM9Yzw8MSYyNTUsZT92KDEpOnYoMCksMD09PWM/ZygxKTpnKDApLHUoMCksRCgwKSxsPWMsZT0hMCk6NDc+PWMmJihjPWQsZT0hMSwxMjg9PT0oYyYxMjgpJiYoZT0hMCksZD0hMSwxPT09KGMmMSkmJihkPSEwKSxjPWM+PjEmMjU1LGUmJihjfD0xMjgpLDA9PT1jP2coMSk6ZygwKSx1KDApLEQoMCksZD92KDEpOnYoMCksbD1jLGU9ITApO2JyZWFrO2Nhc2UgMzo1NT49Yz8oYz1kLGM9KChjJjE1KTw8NHwoYyYyNDApPj40KSYyNTUsMD09PWM/ZygxKTpnKDApLHUoMCksRCgwKSx2KDApLGw9YyxlPSEwKTo2Mz49YyYmKGM9ZCxlPSExLDE9PT0oYyYxKSYmKGU9ITApLGM9Yz4+MSYyNTUsMD09PWM/ZygxKTpnKDApLHUoMCksRCgwKSxlP3YoMSk6digwKSxsPWMsZT0hMCk7YnJlYWs7Y2FzZSA0OjcxPj1jPyhsPXRhKDAsZCksZT0hMCk6Nzk+PWMmJihsPXRhKDEsZCksZT0hMCk7YnJlYWs7CmNhc2UgNTo4Nz49Yz8obD10YSgyLGQpLGU9ITApOjk1Pj1jJiYobD10YSgzLGQpLGU9ITApO2JyZWFrO2Nhc2UgNjoxMDM+PWM/KGw9dGEoNCxkKSxlPSEwKToxMTE+PWMmJihsPXRhKDUsZCksZT0hMCk7YnJlYWs7Y2FzZSA3OjExOT49Yz8obD10YSg2LGQpLGU9ITApOjEyNz49YyYmKGw9dGEoNyxkKSxlPSEwKTticmVhaztjYXNlIDg6MTM1Pj1jPyhsPVooMCwwLGQpLGU9ITApOjE0Mz49YyYmKGw9WigxLDAsZCksZT0hMCk7YnJlYWs7Y2FzZSA5OjE1MT49Yz8obD1aKDIsMCxkKSxlPSEwKToxNTk+PWMmJihsPVooMywwLGQpLGU9ITApO2JyZWFrO2Nhc2UgMTA6MTY3Pj1jPyhsPVooNCwwLGQpLGU9ITApOjE3NT49YyYmKGw9Wig1LDAsZCksZT0hMCk7YnJlYWs7Y2FzZSAxMToxODM+PWM/KGw9Wig2LDAsZCksZT0hMCk6MTkxPj1jJiYobD1aKDcsMCxkKSxlPSEwKTticmVhaztjYXNlIDEyOjE5OT49Yz8obD1aKDAsMSxkKSxlPSEwKToyMDc+PWMmJihsPVooMSwxLGQpLGU9ITApOwpicmVhaztjYXNlIDEzOjIxNT49Yz8obD1aKDIsMSxkKSxlPSEwKToyMjM+PWMmJihsPVooMywxLGQpLGU9ITApO2JyZWFrO2Nhc2UgMTQ6MjMxPj1jPyhsPVooNCwxLGQpLGU9ITApOjIzOT49YyYmKGw9Wig1LDEsZCksZT0hMCk7YnJlYWs7Y2FzZSAxNToyNDc+PWM/KGw9Wig2LDEsZCksZT0hMCk6MjU1Pj1jJiYobD1aKDcsMSxkKSxlPSEwKX1zd2l0Y2goZil7Y2FzZSAwOmIucmVnaXN0ZXJCPWw7YnJlYWs7Y2FzZSAxOmIucmVnaXN0ZXJDPWw7YnJlYWs7Y2FzZSAyOmIucmVnaXN0ZXJEPWw7YnJlYWs7Y2FzZSAzOmIucmVnaXN0ZXJFPWw7YnJlYWs7Y2FzZSA0OmIucmVnaXN0ZXJIPWw7YnJlYWs7Y2FzZSA1OmIucmVnaXN0ZXJMPWw7YnJlYWs7Y2FzZSA2Oig0Pmh8fDc8aCkmJlUocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksbCk7YnJlYWs7Y2FzZSA3OmIucmVnaXN0ZXJBPWx9ZSYmKGE9NCk7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIGE7CmNhc2UgMjA0OmlmKDE9PT1yYSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyKSxiLnByb2dyYW1Db3VudGVyPVkoKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDIwNTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1ZKCksODtjYXNlIDIwNjpyZXR1cm4gamEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjA3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj04fXJldHVybi0xfWZ1bmN0aW9uIGxjKGEpe3N3aXRjaChhKXtjYXNlIDIwODpyZXR1cm4gMD09PQpWKCk/KGIucHJvZ3JhbUNvdW50ZXI9ZWEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMDk6cmV0dXJuIGE9ZWEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckQ9RihhKSxiLnJlZ2lzdGVyRT1hJjI1NSw0O2Nhc2UgMjEwOmlmKDA9PT1WKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEyOmlmKDA9PT1WKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzIpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjEzOnJldHVybiBiLnN0YWNrUG9pbnRlcj0KYi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLHIoYi5yZWdpc3RlckQsYi5yZWdpc3RlckUpKSw4O2Nhc2UgMjE0OnJldHVybiBrYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMTU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTE2LDg7Y2FzZSAyMTY6cmV0dXJuIDE9PT1WKCk/KGIucHJvZ3JhbUNvdW50ZXI9ZWEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsMTIpOjg7Y2FzZSAyMTc6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9ZWEoYi5zdGFja1BvaW50ZXIpLFZhKCEwKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDg7Y2FzZSAyMTg6aWYoMT09PVYoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1ZKCksCjg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjIwOmlmKDE9PT1WKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzImNjU1MzUpLGIucHJvZ3JhbUNvdW50ZXI9WSgpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjIyOnJldHVybiBsYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMjM6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTI0LDh9cmV0dXJuLTF9ZnVuY3Rpb24gbWMoYSl7c3dpdGNoKGEpe2Nhc2UgMjI0OnJldHVybiBhPUcoKSxVKDY1MjgwK2EsYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9CmIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjI1OnJldHVybiBhPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJIPUYoYSksYi5yZWdpc3Rlckw9YSYyNTUsNDtjYXNlIDIyNjpyZXR1cm4gVSg2NTI4MCtiLnJlZ2lzdGVyQyxiLnJlZ2lzdGVyQSksNDtjYXNlIDIyOTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw4O2Nhc2UgMjMwOnJldHVybiBtYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMzE6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTMyLDg7Y2FzZSAyMzI6cmV0dXJuIGE9YmIoRygpKSx2YShiLnN0YWNrUG9pbnRlciwKYSwhMCksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrYSY2NTUzNSxnKDApLHUoMCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsMTI7Y2FzZSAyMzM6cmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksNDtjYXNlIDIzNDpyZXR1cm4gVShZKCksYi5yZWdpc3RlckEpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAyMzg6cmV0dXJuIG5hKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzOTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9NDAsOH1yZXR1cm4tMX1mdW5jdGlvbiBuYyhhKXtzd2l0Y2goYSl7Y2FzZSAyNDA6cmV0dXJuIGE9RygpLGIucmVnaXN0ZXJBPUooNjUyODArYSkmMjU1LApiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjQxOnJldHVybiBhPWVhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJBPUYoYSksYi5yZWdpc3RlckY9YSYyNTUsNDtjYXNlIDI0MjpyZXR1cm4gYi5yZWdpc3RlckE9Sig2NTI4MCtiLnJlZ2lzdGVyQykmMjU1LDQ7Y2FzZSAyNDM6cmV0dXJuIFZhKCExKSw0O2Nhc2UgMjQ1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIscihiLnJlZ2lzdGVyQSxiLnJlZ2lzdGVyRikpLDg7Y2FzZSAyNDY6cmV0dXJuIG9hKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDI0NzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9CjQ4LDg7Y2FzZSAyNDg6cmV0dXJuIGE9YmIoRygpKSxnKDApLHUoMCksdmEoYi5zdGFja1BvaW50ZXIsYSwhMCksYT1iLnN0YWNrUG9pbnRlcithJjY1NTM1LGIucmVnaXN0ZXJIPUYoYSksYi5yZWdpc3Rlckw9YSYyNTUsYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDI0OTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksODtjYXNlIDI1MDpyZXR1cm4gYi5yZWdpc3RlckE9SihZKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAyNTE6cmV0dXJuIFZhKCEwKSw0O2Nhc2UgMjU0OnJldHVybiBwYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNTU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPQo1Niw4fXJldHVybi0xfWZ1bmN0aW9uIHFhKGEpezA8ZC5ETUFDeWNsZXMmJihhKz1kLkRNQUN5Y2xlcyxkLkRNQUN5Y2xlcz0wKTtiLmN1cnJlbnRDeWNsZXMrPWE7aWYoIWIuaXNTdG9wcGVkKXtpZihRLmdyYXBoaWNzQmF0Y2hQcm9jZXNzaW5nKXtpZih0LmN1cnJlbnRDeWNsZXMrPWEsISh0LmN1cnJlbnRDeWNsZXM8dC5iYXRjaFByb2Nlc3NDeWNsZXMoKSkpZm9yKDt0LmN1cnJlbnRDeWNsZXM+PXQuYmF0Y2hQcm9jZXNzQ3ljbGVzKCk7KU5iKHQuYmF0Y2hQcm9jZXNzQ3ljbGVzKCkpLHQuY3VycmVudEN5Y2xlcy09dC5iYXRjaFByb2Nlc3NDeWNsZXMoKX1lbHNlIE5iKGEpO1EuYXVkaW9CYXRjaFByb2Nlc3Npbmc/Zi5jdXJyZW50Q3ljbGVzKz1hOkZiKGEpO3ZhciBjPWE7aWYoTS50cmFuc2ZlclN0YXJ0RmxhZylmb3IodmFyIGU9MDtlPGM7KXt2YXIgaz1NLmN1cnJlbnRDeWNsZXM7ZSs9NDtNLmN1cnJlbnRDeWNsZXMrPTQ7NjU1MzU8TS5jdXJyZW50Q3ljbGVzJiYoTS5jdXJyZW50Q3ljbGVzLT0KNjU1MzYpO3ZhciBsPU0uY3VycmVudEN5Y2xlczt2YXIgZz1NLmlzQ2xvY2tTcGVlZEZhc3Q/Mjo3O3AoZyxrKSYmIXAoZyxsKSYmKGs9eChNLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJEYXRhKSxrPShrPDwxKSsxLGsmPTI1NSxoKE0ubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckRhdGEsayksTS5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZCs9MSw4PT09TS5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZCYmKE0ubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9MCxxLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSEwLHlhKHEuYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQpLGs9eChNLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sKSxoKE0ubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckNvbnRyb2wsSCg3LGspKSxNLnRyYW5zZmVyU3RhcnRGbGFnPSExKSl9fVEudGltZXJzQmF0Y2hQcm9jZXNzaW5nPyhtLmN1cnJlbnRDeWNsZXMrPWEsa2IobS5jdXJyZW50Q3ljbGVzKSwKbS5jdXJyZW50Q3ljbGVzPTApOmtiKGEpO1guY3ljbGVzKz1hO1guY3ljbGVzPj1YLmN5Y2xlc1BlckN5Y2xlU2V0JiYoWC5jeWNsZVNldHMrPTEsWC5jeWNsZXMtPVguY3ljbGVzUGVyQ3ljbGVTZXQpfWZ1bmN0aW9uIHJiKCl7cmV0dXJuIElhKCEwLC0xLC0xKX1mdW5jdGlvbiBJYShhLGMsZSl7dm9pZCAwPT09YyYmKGM9LTEpO3ZvaWQgMD09PWUmJihlPS0xKTthPTEwMjQ7MDxjP2E9YzowPmMmJihhPS0xKTtmb3IodmFyIGQ9ITEsbD0hMSxmPSExLGs9ITE7IShkfHxsfHxmfHxrKTspYz1zYigpLDA+Yz9kPSEwOmIuY3VycmVudEN5Y2xlcz49Yi5NQVhfQ1lDTEVTX1BFUl9GUkFNRSgpP2w9ITA6LTE8YSYmaWIoKT49YT9mPSEwOi0xPGUmJmIucHJvZ3JhbUNvdW50ZXI9PT1lJiYoaz0hMCk7aWYobClyZXR1cm4gYi5jdXJyZW50Q3ljbGVzLT1iLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCksUC5SRVNQT05TRV9DT05ESVRJT05fRlJBTUU7aWYoZilyZXR1cm4gUC5SRVNQT05TRV9DT05ESVRJT05fQVVESU87CmlmKGspcmV0dXJuIFAuUkVTUE9OU0VfQ09ORElUSU9OX0JSRUFLUE9JTlQ7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyLTEmNjU1MzU7cmV0dXJuLTF9ZnVuY3Rpb24gc2IoKXtKYT0hMDtpZihiLmlzSGFsdEJ1Zyl7dmFyIGE9eChiLnByb2dyYW1Db3VudGVyKTthPU9iKGEpO3FhKGEpO2IuZXhpdEhhbHRBbmRTdG9wKCl9cS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheSYmKHEubWFzdGVySW50ZXJydXB0U3dpdGNoPSEwLHEubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ITEpO2lmKDA8KHEuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSZxLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYzMSkpe2E9ITE7cS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2gmJiFiLmlzSGFsdE5vSnVtcCYmKHEuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkJiZxLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPyhFYShxLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSxhPSEwKTpxLmlzTGNkSW50ZXJydXB0RW5hYmxlZCYmCnEuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KEVhKHEuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpLGE9ITApOnEuaXNUaW1lckludGVycnVwdEVuYWJsZWQmJnEuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD8oRWEocS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0KSxhPSEwKTpxLmlzU2VyaWFsSW50ZXJydXB0RW5hYmxlZCYmcS5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD8oRWEocS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCksYT0hMCk6cS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQmJnEuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQmJihFYShxLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSxhPSEwKSk7dmFyIGM9MDthJiYoYz0yMCxiLmlzSGFsdGVkKCkmJihiLmV4aXRIYWx0QW5kU3RvcCgpLGMrPTQpKTtiLmlzSGFsdGVkKCkmJmIuZXhpdEhhbHRBbmRTdG9wKCk7YT1jfWVsc2UgYT0wOzA8YSYmcWEoYSk7YT00O2IuaXNIYWx0ZWQoKXx8Yi5pc1N0b3BwZWR8fAooYT14KGIucHJvZ3JhbUNvdW50ZXIpLGE9T2IoYSkpO2IucmVnaXN0ZXJGJj0yNDA7aWYoMD49YSlyZXR1cm4gYTtxYShhKTtQLnN0ZXBzKz0xO1Auc3RlcHM+PVAuc3RlcHNQZXJTdGVwU2V0JiYoUC5zdGVwU2V0cys9MSxQLnN0ZXBzLT1QLnN0ZXBzUGVyU3RlcFNldCk7cmV0dXJuIGF9ZnVuY3Rpb24gb2MoYSl7Y29uc3QgYj0idW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKTtmb3IoO2EuZnBzVGltZVN0YW1wc1swXTxiLTFFMzspYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCk7YS5mcHNUaW1lU3RhbXBzLnB1c2goYik7YS50aW1lU3RhbXBzVW50aWxSZWFkeS0tOzA+YS50aW1lU3RhbXBzVW50aWxSZWFkeSYmKGEudGltZVN0YW1wc1VudGlsUmVhZHk9MCk7cmV0dXJuIGJ9ZnVuY3Rpb24gdGIoYSl7YS50aW1lU3RhbXBzVW50aWxSZWFkeT05MD49YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU/MS4yNSpNYXRoLmZsb29yKGEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKToKMTIwfWZ1bmN0aW9uIFBiKGEpe2NvbnN0IGI9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OK2EuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkUpLmJ1ZmZlcjthLmdyYXBoaWNzV29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOnouVVBEQVRFRCxncmFwaGljc0ZyYW1lQnVmZmVyOmJ9KSxbYl0pfWZ1bmN0aW9uIFFiKGEpe3ZhciBiPSgidW5kZWZpbmVkIiE9PXR5cGVvZiB3aW5kb3c/cGVyZm9ybWFuY2Uubm93KCk6RGF0ZS5ub3coKSktYS5mcHNUaW1lU3RhbXBzW2EuZnBzVGltZVN0YW1wcy5sZW5ndGgtMV07Yj1SYi1iOzA+YiYmKGI9MCk7YS5zcGVlZCYmMDxhLnNwZWVkJiYoYi89YS5zcGVlZCk7YS51cGRhdGVJZD1zZXRUaW1lb3V0KCgpPT57U2IoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIFNiKGEsYil7aWYoYS5wYXVzZWQpcmV0dXJuITA7CnZvaWQgMCE9PWImJihSYj1iKTtLYT1hLmdldEZQUygpO1lhPWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKzE7YS5zcGVlZCYmMDxhLnNwZWVkJiYoWWEqPWEuc3BlZWQpO2lmKEthPllhKXJldHVybiBhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKSxRYihhKSwhMDtvYyhhKTtjb25zdCBjPSFhLm9wdGlvbnMuaGVhZGxlc3MmJiFhLnBhdXNlRnBzVGhyb3R0bGUmJmEub3B0aW9ucy5pc0F1ZGlvRW5hYmxlZDsobmV3IFByb21pc2UoKGIpPT57bGV0IGU7Yz91YihhLGIpOihlPXZvaWQgMCE9PWEuYnJlYWtwb2ludD9hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZVVudGlsQnJlYWtwb2ludChhLmJyZWFrcG9pbnQpOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lKCksYihlKSl9KSkudGhlbigoYik9PntpZigwPD1iKXtiYShOKHt0eXBlOnouVVBEQVRFRCxmcHM6S2F9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYKKGEuZnJhbWVTa2lwQ291bnRlcisrLGEuZnJhbWVTa2lwQ291bnRlcjw9YS5vcHRpb25zLmZyYW1lU2tpcD9jPSEwOmEuZnJhbWVTa2lwQ291bnRlcj0wKTtjfHxQYihhKTtjb25zdCBlPXt0eXBlOnouVVBEQVRFRH07ZVtFLkNBUlRSSURHRV9SQU1dPXliKGEpLmJ1ZmZlcjtlW0UuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2VbRS5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXI7ZVtFLklOVEVSTkFMX1NUQVRFXT16YihhKS5idWZmZXI7T2JqZWN0LmtleXMoZSkuZm9yRWFjaCgoYSk9Pgp7dm9pZCAwPT09ZVthXSYmKGVbYV09KG5ldyBVaW50OEFycmF5KS5idWZmZXIpfSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oZSksW2VbRS5DQVJUUklER0VfUkFNXSxlW0UuR0FNRUJPWV9NRU1PUlldLGVbRS5QQUxFVFRFX01FTU9SWV0sZVtFLklOVEVSTkFMX1NUQVRFXV0pOzI9PT1iP2JhKE4oe3R5cGU6ei5CUkVBS1BPSU5UfSkpOlFiKGEpfWVsc2UgYmEoTih7dHlwZTp6LkNSQVNIRUR9KSksYS5wYXVzZWQ9ITB9KX1mdW5jdGlvbiB1YihhLGIpe3ZhciBjPS0xO2M9dm9pZCAwIT09YS5icmVha3BvaW50P2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpb1VudGlsQnJlYWtwb2ludCgxMDI0LGEuYnJlYWtwb2ludCk6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvKDEwMjQpOzEhPT1jJiZiKGMpO2lmKDE9PT1jKXtjPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2V0QXVkaW9RdWV1ZUluZGV4KCk7CmNvbnN0IGU9S2E+PVlhOy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmU/KFRiKGEsYyksc2V0VGltZW91dCgoKT0+e3RiKGEpO3ViKGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooVGIoYSxjKSx1YihhLGIpKX19ZnVuY3Rpb24gVGIoYSxiKXt2YXIgYz1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjb25zdCBkPXt0eXBlOnouVVBEQVRFRCxhdWRpb0J1ZmZlcjpjLG51bWJlck9mU2FtcGxlczpiLGZwczpLYSxhbGxvd0Zhc3RTcGVlZFN0cmV0Y2hpbmc6NjA8YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGV9O2M9W2NdO2lmKGEub3B0aW9ucyYmYS5vcHRpb25zLmVuYWJsZUF1ZGlvRGVidWdnaW5nKXt2YXIgZj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OLAphLldBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtkLmNoYW5uZWwxQnVmZmVyPWY7Yy5wdXNoKGYpO2Y9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtkLmNoYW5uZWwyQnVmZmVyPWY7Yy5wdXNoKGYpO2Y9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtkLmNoYW5uZWwzQnVmZmVyPWY7Yy5wdXNoKGYpO2I9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtkLmNoYW5uZWw0QnVmZmVyPWI7Yy5wdXNoKGIpfWEuYXVkaW9Xb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oZCksCmMpO2Eud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCl9Y29uc3QgTmE9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgYWI7TmF8fChhYj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpO2NvbnN0IHo9e0NPTk5FQ1Q6IkNPTk5FQ1QiLElOU1RBTlRJQVRFX1dBU006IklOU1RBTlRJQVRFX1dBU00iLENMRUFSX01FTU9SWToiQ0xFQVJfTUVNT1JZIixDTEVBUl9NRU1PUllfRE9ORToiQ0xFQVJfTUVNT1JZX0RPTkUiLEdFVF9NRU1PUlk6IkdFVF9NRU1PUlkiLFNFVF9NRU1PUlk6IlNFVF9NRU1PUlkiLFNFVF9NRU1PUllfRE9ORToiU0VUX01FTU9SWV9ET05FIixHRVRfQ09OU1RBTlRTOiJHRVRfQ09OU1RBTlRTIixHRVRfQ09OU1RBTlRTX0RPTkU6IkdFVF9DT05TVEFOVFNfRE9ORSIsQ09ORklHOiJDT05GSUciLFJFU0VUX0FVRElPX1FVRVVFOiJSRVNFVF9BVURJT19RVUVVRSIsUExBWToiUExBWSIsUExBWV9VTlRJTF9CUkVBS1BPSU5UOiJQTEFZX1VOVElMX0JSRUFLUE9JTlQiLApCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLFVQREFURUQ6IlVQREFURUQiLENSQVNIRUQ6IkNSQVNIRUQiLFNFVF9KT1lQQURfU1RBVEU6IlNFVF9KT1lQQURfU1RBVEUiLEFVRElPX0xBVEVOQ1k6IkFVRElPX0xBVEVOQ1kiLFJVTl9XQVNNX0VYUE9SVDoiUlVOX1dBU01fRVhQT1JUIixHRVRfV0FTTV9NRU1PUllfU0VDVElPTjoiR0VUX1dBU01fTUVNT1JZX1NFQ1RJT04iLEdFVF9XQVNNX0NPTlNUQU5UOiJHRVRfV0FTTV9DT05TVEFOVCIsRk9SQ0VfT1VUUFVUX0ZSQU1FOiJGT1JDRV9PVVRQVVRfRlJBTUUiLFNFVF9TUEVFRDoiU0VUX1NQRUVEIixJU19HQkM6IklTX0dCQyJ9LEU9e0NBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIiwKSU5URVJOQUxfU1RBVEU6IklOVEVSTkFMX1NUQVRFIn07bGV0IE9hPTA7Y29uc3Qgaz1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTEwOTUwNCksTGE9e3NpemU6KCk9PjkxMDk1MDQsZ3JvdzooKT0+e30sd2FzbUJ5dGVNZW1vcnk6a307dmFyIHphPTkxMjY0LE1hPXphKzkzMTg0LFphPU1hKzE5NjYwOCwkYT1aYSsxNDc0NTYsS2I9JGEtNjc1ODQrMTUzNjAsZWI9JGErMTUzNjAsZmI9ZWIrMTMxMDcyLGdiPWZiKzEzMTA3MixoYj1nYisxMzEwNzIsRGE9aGIrMTMxMDcyLFhhPURhKzEzMTA3MixHYT1YYSsxMzEwNzIsdmI9R2ErODI1ODU2MCx3Yj12Yis2NTUzNSsxLHhiPWNlaWwod2IvMTAyNC82NCkrMSxRPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmVuYWJsZUJvb3RSb209ITE7YS51c2VHYmNXaGVuQXZhaWxhYmxlPSEwO2EuYXVkaW9CYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0hMTthLnRpbWVyc0JhdGNoUHJvY2Vzc2luZz0hMTthLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPQohMTthLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXM9ITE7YS50aWxlUmVuZGVyaW5nPSExO2EudGlsZUNhY2hpbmc9ITE7YS5lbmFibGVBdWRpb0RlYnVnZ2luZz0hMTtyZXR1cm4gYX0oKSxGYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlSW5kZXg9NjUzODQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlRGF0YT02NTM4NTthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZUluZGV4PTY1Mzg2O2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YT02NTM4NztyZXR1cm4gYX0oKSxoYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS50aWxlSWQ9LTE7YS5ob3Jpem9udGFsRmxpcD0hMTthLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrPS0xO3JldHVybiBhfSgpLEE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihiKXthLk5SeDBTd2VlcFBlcmlvZD0oYiYxMTIpPj4KNDthLk5SeDBOZWdhdGU9cCgzLGIpO2EuTlJ4MFN3ZWVwU2hpZnQ9YiY3fTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxRHV0eT1iPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9cCgzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1wKDYsYik7YS5OUng0RnJlcXVlbmN5TVNCPWImNzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTsKYS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtSKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtrWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2tbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2tbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtrWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtrWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtrWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHk7UigxMDQ5KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzU3dlZXBFbmFibGVkKTtrWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwQ291bnRlcjtrWzEwNTUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN3ZWVwU2hhZG93RnJlcXVlbmN5fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVMoMTAyNCs1MCoKYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWtbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWtbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1rWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1rWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmR1dHlDeWNsZT1rWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9a1sxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1N3ZWVwRW5hYmxlZD1TKDEwNDkrNTAqYS5zYXZlU3RhdGVTbG90KTthLnN3ZWVwQ291bnRlcj1rWzEwNTArNTAqYS5zYXZlU3RhdGVTbG90XTthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PWtbMTA1NSs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtoKGEubWVtb3J5TG9jYXRpb25OUngwLDEyOCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MSwxOTEpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDIsCjI0Myk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywxOTMpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTkxKX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9NCooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPWIsYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5Kz0xLDg8PWEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSYmKGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0wKSk7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWI9CmEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7Q2IoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9YS5mcmVxdWVuY3k7YS5zd2VlcENvdW50ZXI9YS5OUngwU3dlZXBQZXJpb2Q7YS5pc1N3ZWVwRW5hYmxlZD0wPGEuTlJ4MFN3ZWVwUGVyaW9kJiYwPGEuTlJ4MFN3ZWVwU2hpZnQ/ITA6ITE7MDxhLk5SeDBTd2VlcFNoaWZ0JiZEYigpO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPAphLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZVN3ZWVwPWZ1bmN0aW9uKCl7LS1hLnN3ZWVwQ291bnRlcjswPj1hLnN3ZWVwQ291bnRlciYmKGEuc3dlZXBDb3VudGVyPWEuTlJ4MFN3ZWVwUGVyaW9kLGEuaXNTd2VlcEVuYWJsZWQmJjA8YS5OUngwU3dlZXBQZXJpb2QmJkRiKCkpfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmCjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYil7dmFyIGM9Yj4+ODtiJj0yNTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGM7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MyxiKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDA9NjUyOTY7YS5OUngwU3dlZXBQZXJpb2Q9MDthLk5SeDBOZWdhdGU9ITE7YS5OUngwU3dlZXBTaGlmdD0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1Mjk3O2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUyOTg7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9CjA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUyOTk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMDA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLmNoYW5uZWxOdW1iZXI9MTthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmVudmVsb3BlQ291bnRlcj0wO2EubGVuZ3RoQ291bnRlcj0wO2Eudm9sdW1lPTA7YS5kdXR5Q3ljbGU9MDthLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MDthLmlzU3dlZXBFbmFibGVkPSExO2Euc3dlZXBDb3VudGVyPTA7YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT0wO2Euc2F2ZVN0YXRlU2xvdD03O3JldHVybiBhfSgpLEs9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFEdXR5PWI+PjYmMzthLk5SeDFMZW5ndGhMb2FkPWImNjM7YS5sZW5ndGhDb3VudGVyPTY0LWEuTlJ4MUxlbmd0aExvYWR9OwphLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9cCgzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNGcmVxdWVuY3lMU0I9YjthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnVwZGF0ZU5SeDQ9ZnVuY3Rpb24oYil7YS5OUng0TGVuZ3RoRW5hYmxlZD1wKDYsYik7YS5OUng0RnJlcXVlbmN5TVNCPWImNzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1IoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2tbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7a1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7CmtbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtrWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtrWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmR1dHlDeWNsZTtrWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9UygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1rWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1rWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9a1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9a1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kdXR5Q3ljbGU9a1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PWtbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9CmZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MS0xLDI1NSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MSw2Myk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MiwwKTtoKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsMTg0KX07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9NCooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPWIsYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5Kz0KMSw4PD1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkmJihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPWEudm9sdW1lO2Vsc2UgcmV0dXJuIDE1O3ZhciBjPTE7Q2IoYS5OUngxRHV0eSxhLndhdmVGb3JtUG9zaXRpb25PbkR1dHkpfHwoYyo9LTEpO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EucmVzZXRUaW1lcigpO2EuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kO2Eudm9sdW1lPWEuTlJ4MlN0YXJ0aW5nVm9sdW1lO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iO3JldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXI/ITE6ITB9O2EudXBkYXRlTGVuZ3RoPWZ1bmN0aW9uKCl7MDwKYS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMDxhLnZvbHVtZSYmLS1hLnZvbHVtZSkpfTthLnNldEZyZXF1ZW5jeT1mdW5jdGlvbihiKXt2YXIgYz1iPj44O2ImPTI1NTt2YXIgZD14KGEubWVtb3J5TG9jYXRpb25OUng0KSYyNDh8YztoKGEubWVtb3J5TG9jYXRpb25OUngzLGIpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsZCk7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5OUng0RnJlcXVlbmN5TVNCPWM7CmEuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EuY3ljbGVDb3VudGVyPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDE9NjUzMDI7YS5OUngxRHV0eT0wO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0hMTthLk5SeDJFbnZlbG9wZVBlcmlvZD0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA0O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzA1O2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5jaGFubmVsTnVtYmVyPTI7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPTA7YS5lbnZlbG9wZUNvdW50ZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLnZvbHVtZT0wO2EuZHV0eUN5Y2xlPTA7YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PQowO2Euc2F2ZVN0YXRlU2xvdD04O3JldHVybiBhfSgpLEk9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTlJ4MD1mdW5jdGlvbihiKXthLmlzRGFjRW5hYmxlZD1wKDcsYil9O2EudXBkYXRlTlJ4MT1mdW5jdGlvbihiKXthLk5SeDFMZW5ndGhMb2FkPWI7YS5sZW5ndGhDb3VudGVyPTI1Ni1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyVm9sdW1lQ29kZT1iPj41JjE1fTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9cCg2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtSKDEwMjQrNTAqCmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7a1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtrWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7a1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlVGFibGVQb3NpdGlvbn07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1TKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWtbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1rWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLndhdmVUYWJsZVBvc2l0aW9uPWtbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdfTthLmluaXRpYWxpemU9ZnVuY3Rpb24oKXtoKGEubWVtb3J5TG9jYXRpb25OUngwLDEyNyk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MSwyNTUpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDIsMTU5KTtoKGEubWVtb3J5TG9jYXRpb25OUngzLDApO2goYS5tZW1vcnlMb2NhdGlvbk5SeDQsCjE4NCk7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMH07YS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyPWZ1bmN0aW9uKCl7dmFyIGI9YS5jeWNsZUNvdW50ZXI7YS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EucmVzZXRUaW1lcj1mdW5jdGlvbigpe2EuZnJlcXVlbmN5VGltZXI9MiooMjA0OC1hLmZyZXF1ZW5jeSk7Yi5HQkNEb3VibGVTcGVlZCYmKGEuZnJlcXVlbmN5VGltZXIqPTIpfTthLmdldFNhbXBsZT1mdW5jdGlvbihiKXthLmZyZXF1ZW5jeVRpbWVyLT1iOzA+PWEuZnJlcXVlbmN5VGltZXImJihiPU1hdGguYWJzKGEuZnJlcXVlbmN5VGltZXIpLGEucmVzZXRUaW1lcigpLGEuZnJlcXVlbmN5VGltZXItPWIsYS53YXZlVGFibGVQb3NpdGlvbis9MSwzMjw9YS53YXZlVGFibGVQb3NpdGlvbiYmKGEud2F2ZVRhYmxlUG9zaXRpb249MCkpO2I9MDt2YXIgYz1hLnZvbHVtZUNvZGU7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWEudm9sdW1lQ29kZUNoYW5nZWQmJgooYz14KGEubWVtb3J5TG9jYXRpb25OUngyKSxjPWM+PjUmMTUsYS52b2x1bWVDb2RlPWMsYS52b2x1bWVDb2RlQ2hhbmdlZD0hMSk7ZWxzZSByZXR1cm4gMTU7dmFyIGQ9eChhLm1lbW9yeUxvY2F0aW9uV2F2ZVRhYmxlKyhhLndhdmVUYWJsZVBvc2l0aW9uLzJ8MCkpO2Q9MD09PWEud2F2ZVRhYmxlUG9zaXRpb24lMj9kPj40JjE1OmQmMTU7c3dpdGNoKGMpe2Nhc2UgMDpkPj49NDticmVhaztjYXNlIDE6Yj0xO2JyZWFrO2Nhc2UgMjpkPj49MTtiPTI7YnJlYWs7ZGVmYXVsdDpkPj49MixiPTR9cmV0dXJuKDA8Yj9kL2I6MCkrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9MjU2KTthLnJlc2V0VGltZXIoKTthLndhdmVUYWJsZVBvc2l0aW9uPTA7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7CnJldHVybiAwPGEuZnJlcXVlbmN5VGltZXItYS5jeWNsZUNvdW50ZXImJiFhLnZvbHVtZUNvZGVDaGFuZ2VkPyExOiEwfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngwPTY1MzA2O2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzA3O2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMwODthLk5SeDJWb2x1bWVDb2RlPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMDk7YS5OUngzRnJlcXVlbmN5TFNCPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMTA7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLk5SeDRGcmVxdWVuY3lNU0I9MDthLm1lbW9yeUxvY2F0aW9uV2F2ZVRhYmxlPTY1MzI4O2EuY2hhbm5lbE51bWJlcj0zO2EuaXNFbmFibGVkPQohMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeT0wO2EuZnJlcXVlbmN5VGltZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLndhdmVUYWJsZVBvc2l0aW9uPTA7YS52b2x1bWVDb2RlPTA7YS52b2x1bWVDb2RlQ2hhbmdlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9OTtyZXR1cm4gYX0oKSxMPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTthLnVwZGF0ZU5SeDI9ZnVuY3Rpb24oYil7YS5OUngyU3RhcnRpbmdWb2x1bWU9Yj4+NCYxNTthLk5SeDJFbnZlbG9wZUFkZE1vZGU9cCgzLGIpO2EuTlJ4MkVudmVsb3BlUGVyaW9kPWImNzthLmlzRGFjRW5hYmxlZD0wPChiJjI0OCl9O2EudXBkYXRlTlJ4Mz1mdW5jdGlvbihiKXthLk5SeDNDbG9ja1NoaWZ0PWI+PjQ7YS5OUngzV2lkdGhNb2RlPXAoMyxiKTthLk5SeDNEaXZpc29yQ29kZT1iJjc7c3dpdGNoKGEuTlJ4M0Rpdmlzb3JDb2RlKXtjYXNlIDA6YS5kaXZpc29yPQo4O2JyZWFrO2Nhc2UgMTphLmRpdmlzb3I9MTY7YnJlYWs7Y2FzZSAyOmEuZGl2aXNvcj0zMjticmVhaztjYXNlIDM6YS5kaXZpc29yPTQ4O2JyZWFrO2Nhc2UgNDphLmRpdmlzb3I9NjQ7YnJlYWs7Y2FzZSA1OmEuZGl2aXNvcj04MDticmVhaztjYXNlIDY6YS5kaXZpc29yPTk2O2JyZWFrO2Nhc2UgNzphLmRpdmlzb3I9MTEyfX07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9cCg2LGIpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1IoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2tbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7a1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5lbnZlbG9wZUNvdW50ZXI7a1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2tbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEudm9sdW1lO2tbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfTsKYS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1TKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90KTthLmZyZXF1ZW5jeVRpbWVyPWtbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZW52ZWxvcGVDb3VudGVyPWtbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EubGVuZ3RoQ291bnRlcj1rWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XTthLnZvbHVtZT1rWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj1rWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MS0xLDI1NSk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MSwyNTUpO2goYS5tZW1vcnlMb2NhdGlvbk5SeDIsMCk7aChhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtoKGEubWVtb3J5TG9jYXRpb25OUng0LDE5MSl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyOwphLmN5Y2xlQ291bnRlcj0wO3JldHVybiBhLmdldFNhbXBsZShiKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLmZyZXF1ZW5jeVRpbWVyPWEuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kKCksYS5mcmVxdWVuY3lUaW1lci09YixiPWEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyJjFeYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI+PjEmMSxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj4+PTEsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXJ8PWI8PDE0LGEuTlJ4M1dpZHRoTW9kZSYmKGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyJj0tNjUsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXJ8PWI8PDYpKTtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTt2YXIgYz0KcCgwLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyKT8tMToxO3JldHVybiBjKmIrMTV9O2EudHJpZ2dlcj1mdW5jdGlvbigpe2EuaXNFbmFibGVkPSEwOzA9PT1hLmxlbmd0aENvdW50ZXImJihhLmxlbmd0aENvdW50ZXI9NjQpO2EuZnJlcXVlbmN5VGltZXI9YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2QoKTthLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj0zMjc2NzthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZD1mdW5jdGlvbigpe3ZhciBjPWEuZGl2aXNvcjw8YS5OUngzQ2xvY2tTaGlmdDtiLkdCQ0RvdWJsZVNwZWVkJiYKKGMqPTIpO3JldHVybiBjfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8YS5sZW5ndGhDb3VudGVyJiZhLk5SeDRMZW5ndGhFbmFibGVkJiYtLWEubGVuZ3RoQ291bnRlcjswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5pc0VuYWJsZWQ9ITEpfTthLnVwZGF0ZUVudmVsb3BlPWZ1bmN0aW9uKCl7LS1hLmVudmVsb3BlQ291bnRlcjswPj1hLmVudmVsb3BlQ291bnRlciYmKGEuZW52ZWxvcGVDb3VudGVyPWEuTlJ4MkVudmVsb3BlUGVyaW9kLDAhPT1hLmVudmVsb3BlQ291bnRlciYmKGEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMTU+YS52b2x1bWU/YS52b2x1bWUrPTE6IWEuTlJ4MkVudmVsb3BlQWRkTW9kZSYmMDxhLnZvbHVtZSYmLS1hLnZvbHVtZSkpfTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzEyO2EuTlJ4MUxlbmd0aExvYWQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mj02NTMxMzthLk5SeDJTdGFydGluZ1ZvbHVtZT0wO2EuTlJ4MkVudmVsb3BlQWRkTW9kZT0KITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMxNDthLk5SeDNDbG9ja1NoaWZ0PTA7YS5OUngzV2lkdGhNb2RlPSExO2EuTlJ4M0Rpdmlzb3JDb2RlPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDQ9NjUzMTU7YS5OUng0TGVuZ3RoRW5hYmxlZD0hMTthLmNoYW5uZWxOdW1iZXI9NDthLmlzRW5hYmxlZD0hMTthLmlzRGFjRW5hYmxlZD0hMTthLmZyZXF1ZW5jeVRpbWVyPTA7YS5lbnZlbG9wZUNvdW50ZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLnZvbHVtZT0wO2EuZGl2aXNvcj0wO2EubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPTA7YS5zYXZlU3RhdGVTbG90PTEwO3JldHVybiBhfSgpLHc9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuY2hhbm5lbDFTYW1wbGU9MTU7YS5jaGFubmVsMlNhbXBsZT0xNTthLmNoYW5uZWwzU2FtcGxlPTE1O2EuY2hhbm5lbDRTYW1wbGU9MTU7YS5jaGFubmVsMURhY0VuYWJsZWQ9ITE7YS5jaGFubmVsMkRhY0VuYWJsZWQ9CiExO2EuY2hhbm5lbDNEYWNFbmFibGVkPSExO2EuY2hhbm5lbDREYWNFbmFibGVkPSExO2EubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O2EucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzthLm1peGVyVm9sdW1lQ2hhbmdlZD0hMTthLm1peGVyRW5hYmxlZENoYW5nZWQ9ITE7YS5uZWVkVG9SZW1peFNhbXBsZXM9ITE7cmV0dXJuIGF9KCksZj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8xNzQ6ODd9O2EudXBkYXRlTlI1MD1mdW5jdGlvbihiKXthLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9Yj4+NCY3O2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9YiY3fTthLnVwZGF0ZU5SNTE9ZnVuY3Rpb24oYil7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9cCg3LGIpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PXAoNixiKTthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD0KcCg1LGIpO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25MZWZ0T3V0cHV0PXAoNCxiKTthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uUmlnaHRPdXRwdXQ9cCgzLGIpO2EuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25SaWdodE91dHB1dD1wKDIsYik7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPblJpZ2h0T3V0cHV0PXAoMSxiKTthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ9cCgwLGIpfTthLnVwZGF0ZU5SNTI9ZnVuY3Rpb24oYil7YS5OUjUySXNTb3VuZEVuYWJsZWQ9cCg3LGIpfTthLm1heEZyYW1lU2VxdWVuY2VDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8xNjM4NDo4MTkyfTthLm1heERvd25TYW1wbGVDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gYi5DTE9DS19TUEVFRCgpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2tbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcjtrWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5kb3duU2FtcGxlQ3ljbGVDb3VudGVyO2tbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJhbWVTZXF1ZW5jZXJ9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5mcmFtZVNlcXVlbmNlQ3ljbGVDb3VudGVyPWtbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj1rWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLmZyYW1lU2VxdWVuY2VyPWtbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2piKCl9O2EuY3VycmVudEN5Y2xlcz0wO2EubWVtb3J5TG9jYXRpb25OUjUwPTY1MzE2O2EuTlI1MExlZnRNaXhlclZvbHVtZT0wO2EuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9MDthLm1lbW9yeUxvY2F0aW9uTlI1MT02NTMxNzthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWw0RW5hYmxlZE9uTGVmdE91dHB1dD0KITA7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EubWVtb3J5TG9jYXRpb25OUjUyPTY1MzE4O2EuTlI1MklzU291bmRFbmFibGVkPSEwO2EubWVtb3J5TG9jYXRpb25DaGFubmVsM0xvYWRSZWdpc3RlclN0YXJ0PTY1MzI4O2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0wO2EuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcj00OEUzO2EuZnJhbWVTZXF1ZW5jZXI9MDthLmF1ZGlvUXVldWVJbmRleD0wO2Eud2FzbUJveU1lbW9yeU1heEJ1ZmZlclNpemU9MTMxMDcyO2Euc2F2ZVN0YXRlU2xvdD02O3JldHVybiBhfSgpLHE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSW50ZXJydXB0RW5hYmxlZD0KZnVuY3Rpb24oYil7YS5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQ9cChhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPXAoYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPXAoYS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0LGIpO2EuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkPXAoYS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCxiKTthLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZD1wKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlPWJ9O2EudXBkYXRlSW50ZXJydXB0UmVxdWVzdGVkPWZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cChhLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0LGIpO2EuaXNMY2RJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cChhLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0LGIpO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0KcChhLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQsYik7YS5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD1wKGEuYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD1wKGEuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQsYik7YS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9Yn07YS5hcmVJbnRlcnJ1cHRzUGVuZGluZz1mdW5jdGlvbigpe3JldHVybiAwPChhLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSZhLmludGVycnVwdHNFbmFibGVkVmFsdWUmMzEpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe1IoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2gpO1IoMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheSl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9UygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0KUygxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKHgoYS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQpKTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCh4KGEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KSl9O2EubWFzdGVySW50ZXJydXB0U3dpdGNoPSExO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ITE7YS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdD0wO2EuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ9MTthLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQ9MjthLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0PTM7YS5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdD00O2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkPTY1NTM1O2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT0wO2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNMY2RJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNUaW1lckludGVycnVwdEVuYWJsZWQ9CiExO2EuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRFbmFibGVkPSExO2EubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0PTY1Mjk1O2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPTA7YS5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTI7cmV0dXJuIGF9KCksbT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5iYXRjaFByb2Nlc3NDeWNsZXM9ZnVuY3Rpb24oKXtyZXR1cm4gMjU2fTthLnVwZGF0ZURpdmlkZXJSZWdpc3Rlcj1mdW5jdGlvbihiKXtiPWEuZGl2aWRlclJlZ2lzdGVyO2EuZGl2aWRlclJlZ2lzdGVyPTA7aChhLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyLDApOwphLnRpbWVyRW5hYmxlZCYmSGIoYixhLmRpdmlkZXJSZWdpc3RlcikmJmxiKCl9O2EudXBkYXRlVGltZXJDb3VudGVyPWZ1bmN0aW9uKGIpe2lmKGEudGltZXJFbmFibGVkKXtpZihhLnRpbWVyQ291bnRlcldhc1Jlc2V0KXJldHVybjthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXkmJihhLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITEpfWEudGltZXJDb3VudGVyPWJ9O2EudXBkYXRlVGltZXJNb2R1bG89ZnVuY3Rpb24oYil7YS50aW1lck1vZHVsbz1iO2EudGltZXJFbmFibGVkJiZhLnRpbWVyQ291bnRlcldhc1Jlc2V0JiYoYS50aW1lckNvdW50ZXI9YS50aW1lck1vZHVsbyxhLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExKX07YS51cGRhdGVUaW1lckNvbnRyb2w9ZnVuY3Rpb24oYil7dmFyIGM9YS50aW1lckVuYWJsZWQ7YS50aW1lckVuYWJsZWQ9cCgyLGIpO2ImPTM7aWYoIWMpe2M9bWIoYS50aW1lcklucHV0Q2xvY2spO3ZhciBkPW1iKGIpOyhhLnRpbWVyRW5hYmxlZD9wKGMsCmEuZGl2aWRlclJlZ2lzdGVyKTpwKGMsYS5kaXZpZGVyUmVnaXN0ZXIpJiZwKGQsYS5kaXZpZGVyUmVnaXN0ZXIpKSYmbGIoKX1hLnRpbWVySW5wdXRDbG9jaz1ifTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2tbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztrWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmRpdmlkZXJSZWdpc3RlcjtSKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90LGEudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheSk7UigxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLnRpbWVyQ291bnRlcldhc1Jlc2V0KTtoKGEubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXIsYS50aW1lckNvdW50ZXIpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuY3VycmVudEN5Y2xlcz1rWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmRpdmlkZXJSZWdpc3Rlcj1rWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9UygxMDMyKwo1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyV2FzUmVzZXQ9UygxMDM1KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS50aW1lckNvdW50ZXI9eChhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyKTthLnRpbWVyTW9kdWxvPXgoYS5tZW1vcnlMb2NhdGlvblRpbWVyTW9kdWxvKTthLnRpbWVySW5wdXRDbG9jaz14KGEubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2wpfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPTY1Mjg0O2EuZGl2aWRlclJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcj02NTI4NTthLnRpbWVyQ291bnRlcj0wO2EudGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMTthLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExO2EudGltZXJDb3VudGVyTWFzaz0wO2EubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbz02NTI4NjthLnRpbWVyTW9kdWxvPTA7YS5tZW1vcnlMb2NhdGlvblRpbWVyQ29udHJvbD02NTI4NzsKYS50aW1lckVuYWJsZWQ9ITE7YS50aW1lcklucHV0Q2xvY2s9MDthLnNhdmVTdGF0ZVNsb3Q9NTtyZXR1cm4gYX0oKSxNPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZVRyYW5zZmVyQ29udHJvbD1mdW5jdGlvbihiKXthLmlzU2hpZnRDbG9ja0ludGVybmFsPXAoMCxiKTthLmlzQ2xvY2tTcGVlZEZhc3Q9cCgxLGIpO2EudHJhbnNmZXJTdGFydEZsYWc9cCg3LGIpO3JldHVybiEwfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJEYXRhPTY1MjgxO2EubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckNvbnRyb2w9NjUyODI7YS5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZD0wO2EuaXNTaGlmdENsb2NrSW50ZXJuYWw9ITE7YS5pc0Nsb2NrU3BlZWRGYXN0PSExO2EudHJhbnNmZXJTdGFydEZsYWc9ITE7cmV0dXJuIGF9KCksQj1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVKb3lwYWQ9ZnVuY3Rpb24oYil7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9CmJeMjU1O2EuaXNEcGFkVHlwZT1wKDQsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpO2EuaXNCdXR0b25UeXBlPXAoNSxhLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EudXBkYXRlSm95cGFkKHgoYS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyKSl9O2EudXA9ITE7YS5kb3duPSExO2EubGVmdD0hMTthLnJpZ2h0PSExO2EuYT0hMTthLmI9ITE7YS5zZWxlY3Q9ITE7YS5zdGFydD0hMTthLm1lbW9yeUxvY2F0aW9uSm95cGFkUmVnaXN0ZXI9NjUyODA7YS5qb3lwYWRSZWdpc3RlckZsaXBwZWQ9MDthLmlzRHBhZFR5cGU9ITE7YS5pc0J1dHRvblR5cGU9ITE7YS5zYXZlU3RhdGVTbG90PTM7cmV0dXJuIGF9KCksQz1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVMY2RTdGF0dXM9ZnVuY3Rpb24oYil7dmFyIGM9eChhLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTtiPWImMjQ4fGMmN3wxMjg7CmgoYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKX07YS51cGRhdGVMY2RDb250cm9sPWZ1bmN0aW9uKGIpe3ZhciBjPWEuZW5hYmxlZDthLmVuYWJsZWQ9cCg3LGIpO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9cCg2LGIpO2Eud2luZG93RGlzcGxheUVuYWJsZWQ9cCg1LGIpO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD1wKDQsYik7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PXAoMyxiKTthLnRhbGxTcHJpdGVTaXplPXAoMixiKTthLnNwcml0ZURpc3BsYXlFbmFibGU9cCgxLGIpO2EuYmdEaXNwbGF5RW5hYmxlZD1wKDAsYik7YyYmIWEuZW5hYmxlZCYmSmIoITApOyFjJiZhLmVuYWJsZWQmJkpiKCExKX07YS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cz02NTM0NTthLmN1cnJlbnRMY2RNb2RlPTA7YS5tZW1vcnlMb2NhdGlvbkNvaW5jaWRlbmNlQ29tcGFyZT02NTM0OTthLmNvaW5jaWRlbmNlQ29tcGFyZT0wO2EubWVtb3J5TG9jYXRpb25MY2RDb250cm9sPTY1MzQ0O2EuZW5hYmxlZD0KITA7YS53aW5kb3dUaWxlTWFwRGlzcGxheVNlbGVjdD0hMTthLndpbmRvd0Rpc3BsYXlFbmFibGVkPSExO2EuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdD0hMTthLmJnVGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS50YWxsU3ByaXRlU2l6ZT0hMTthLnNwcml0ZURpc3BsYXlFbmFibGU9ITE7YS5iZ0Rpc3BsYXlFbmFibGVkPSExO3JldHVybiBhfSgpLHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGEuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkUoKX07YS5NQVhfQ1lDTEVTX1BFUl9TQ0FOTElORT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzE1Mz09PWEuc2NhbmxpbmVSZWdpc3Rlcj84OjkxMjoxNTM9PT1hLnNjYW5saW5lUmVnaXN0ZXI/NDo0NTZ9O2EuTUlOX0NZQ0xFU19TUFJJVEVTX0xDRF9NT0RFPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/NzUyOjM3Nn07YS5NSU5fQ1lDTEVTX1RSQU5TRkVSX0RBVEFfTENEX01PREU9CmZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/NDk4OjI0OX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtrWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnNjYW5saW5lQ3ljbGVDb3VudGVyO2tbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPUMuY3VycmVudExjZE1vZGU7aChhLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3RlcixhLnNjYW5saW5lUmVnaXN0ZXIpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9a1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07Qy5jdXJyZW50TGNkTW9kZT1rWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XTthLnNjYW5saW5lUmVnaXN0ZXI9eChhLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcik7Qy51cGRhdGVMY2RDb250cm9sKHgoQy5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wpKX07YS5jdXJyZW50Q3ljbGVzPTA7YS5zY2FubGluZUN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyPQo2NTM0ODthLnNjYW5saW5lUmVnaXN0ZXI9MDthLm1lbW9yeUxvY2F0aW9uRG1hVHJhbnNmZXI9NjUzNTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFg9NjUzNDc7YS5zY3JvbGxYPTA7YS5tZW1vcnlMb2NhdGlvblNjcm9sbFk9NjUzNDY7YS5zY3JvbGxZPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1g9NjUzNTU7YS53aW5kb3dYPTA7YS5tZW1vcnlMb2NhdGlvbldpbmRvd1k9NjUzNTQ7YS53aW5kb3dZPTA7YS5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RaZXJvU3RhcnQ9Mzg5MTI7YS5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydD0zOTkzNjthLm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ9MzQ4MTY7YS5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQ9MzI3Njg7YS5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZT02NTAyNDthLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGU9NjUzNTE7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVPbmU9CjY1MzUyO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvPTY1MzUzO2Euc2F2ZVN0YXRlU2xvdD0xO3JldHVybiBhfSgpLGQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7a1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50Um9tQmFuaztrWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRSYW1CYW5rO1IoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1JhbUJhbmtpbmdFbmFibGVkKTtSKDEwMjkrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMxUm9tTW9kZUVuYWJsZWQpO1IoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1JvbU9ubHkpO1IoMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc01CQzEpO1IoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc01CQzIpO1IoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc01CQzMpO1IoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc01CQzUpfTthLmxvYWRTdGF0ZT0KZnVuY3Rpb24oKXthLmN1cnJlbnRSb21CYW5rPWtbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuY3VycmVudFJhbUJhbms9a1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc1JhbUJhbmtpbmdFbmFibGVkPVMoMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9UygxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc1JvbU9ubHk9UygxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzE9UygxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzI9UygxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzM9UygxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc01CQzU9UygxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdCl9O2EuY2FydHJpZGdlUm9tTG9jYXRpb249MDthLnN3aXRjaGFibGVDYXJ0cmlkZ2VSb21Mb2NhdGlvbj0xNjM4NDthLnZpZGVvUmFtTG9jYXRpb249MzI3Njg7YS5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbj00MDk2MDthLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbj0KNDkxNTI7YS5pbnRlcm5hbFJhbUJhbmtPbmVMb2NhdGlvbj01MzI0ODthLmVjaG9SYW1Mb2NhdGlvbj01NzM0NDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj02NTAyNDthLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD02NTE4MzthLnVudXNhYmxlTWVtb3J5TG9jYXRpb249NjUxODQ7YS51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uPTY1Mjc5O2EuY3VycmVudFJvbUJhbms9MDthLmN1cnJlbnRSYW1CYW5rPTA7YS5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2EuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YS5pc1JvbU9ubHk9ITA7YS5pc01CQzE9ITE7YS5pc01CQzI9ITE7YS5pc01CQzM9ITE7YS5pc01CQzU9ITE7YS5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoPTY1MzYxO2EubWVtb3J5TG9jYXRpb25IZG1hU291cmNlTG93PTY1MzYyO2EubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25IaWdoPTY1MzYzO2EubWVtb3J5TG9jYXRpb25IZG1hRGVzdGluYXRpb25Mb3c9CjY1MzY0O2EubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcj02NTM2NTthLkRNQUN5Y2xlcz0wO2EuaXNIYmxhbmtIZG1hQWN0aXZlPSExO2EuaGJsYW5rSGRtYVRyYW5zZmVyTGVuZ3RoUmVtYWluaW5nPTA7YS5oYmxhbmtIZG1hU291cmNlPTA7YS5oYmxhbmtIZG1hRGVzdGluYXRpb249MDthLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbms9NjUzNTk7YS5tZW1vcnlMb2NhdGlvbkdCQ1dSQU1CYW5rPTY1MzkyO2Euc2F2ZVN0YXRlU2xvdD00O3JldHVybiBhfSgpLGI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuQ0xPQ0tfU1BFRUQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5HQkNEb3VibGVTcGVlZD84Mzg4NjA4OjQxOTQzMDR9O2EuTUFYX0NZQ0xFU19QRVJfRlJBTUU9ZnVuY3Rpb24oKXtyZXR1cm4gYS5HQkNEb3VibGVTcGVlZD8xNDA0NDg6NzAyMjR9O2EuZW5hYmxlSGFsdD1mdW5jdGlvbigpe3EubWFzdGVySW50ZXJydXB0U3dpdGNoP2EuaXNIYWx0Tm9ybWFsPSEwOjA9PT0ocS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJgpxLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSYzMSk/YS5pc0hhbHROb0p1bXA9ITA6YS5pc0hhbHRCdWc9ITB9O2EuZXhpdEhhbHRBbmRTdG9wPWZ1bmN0aW9uKCl7YS5pc0hhbHROb0p1bXA9ITE7YS5pc0hhbHROb3JtYWw9ITE7YS5pc0hhbHRCdWc9ITE7YS5pc1N0b3BwZWQ9ITF9O2EuaXNIYWx0ZWQ9ZnVuY3Rpb24oKXtyZXR1cm4gYS5pc0hhbHROb3JtYWx8fGEuaXNIYWx0Tm9KdW1wPyEwOiExfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2tbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJBO2tbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJCO2tbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJDO2tbMTAyNys1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJEO2tbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJFO2tbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEucmVnaXN0ZXJIO2tbMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3RdPQphLnJlZ2lzdGVyTDtrWzEwMzErNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRjtrWzEwMzIrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnN0YWNrUG9pbnRlcjtrWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnByb2dyYW1Db3VudGVyO2tbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudEN5Y2xlcztSKDEwNDErNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNIYWx0Tm9ybWFsKTtSKDEwNDIrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNIYWx0Tm9KdW1wKTtSKDEwNDMrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNIYWx0QnVnKTtSKDEwNDQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNTdG9wcGVkKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnJlZ2lzdGVyQT1rWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyQj1rWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyQz1rWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XTthLnJlZ2lzdGVyRD1rWzEwMjcrCjUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckU9a1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckg9a1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3Rlckw9a1sxMDMwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckY9a1sxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zdGFja1BvaW50ZXI9a1sxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5wcm9ncmFtQ291bnRlcj1rWzEwMzQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRDeWNsZXM9a1sxMDM2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5pc0hhbHROb3JtYWw9UygxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc0hhbHROb0p1bXA9UygxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc0hhbHRCdWc9UygxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5pc1N0b3BwZWQ9UygxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdCl9O2EuR0JDRW5hYmxlZD0hMTthLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2g9CjY1MzU3O2EuR0JDRG91YmxlU3BlZWQ9ITE7YS5yZWdpc3RlckE9MDthLnJlZ2lzdGVyQj0wO2EucmVnaXN0ZXJDPTA7YS5yZWdpc3RlckQ9MDthLnJlZ2lzdGVyRT0wO2EucmVnaXN0ZXJIPTA7YS5yZWdpc3Rlckw9MDthLnJlZ2lzdGVyRj0wO2Euc3RhY2tQb2ludGVyPTA7YS5wcm9ncmFtQ291bnRlcj0wO2EuY3VycmVudEN5Y2xlcz0wO2EuaXNIYWx0Tm9ybWFsPSExO2EuaXNIYWx0Tm9KdW1wPSExO2EuaXNIYWx0QnVnPSExO2EuaXNTdG9wcGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0wO3JldHVybiBhfSgpLFg9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O2EuY3ljbGVTZXRzPTA7YS5jeWNsZXM9MDtyZXR1cm4gYX0oKSxQPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnN0ZXBzUGVyU3RlcFNldD0yRTk7YS5zdGVwU2V0cz0wO2Euc3RlcHM9MDthLlJFU1BPTlNFX0NPTkRJVElPTl9FUlJPUj0tMTthLlJFU1BPTlNFX0NPTkRJVElPTl9GUkFNRT0KMDthLlJFU1BPTlNFX0NPTkRJVElPTl9BVURJTz0xO2EuUkVTUE9OU0VfQ09ORElUSU9OX0JSRUFLUE9JTlQ9MjtyZXR1cm4gYX0oKTtMYS5zaXplKCk8eGImJkxhLmdyb3coeGItTGEuc2l6ZSgpKTt2YXIgSmE9ITEscGM9T2JqZWN0LmZyZWV6ZSh7bWVtb3J5OkxhLGNvbmZpZzpmdW5jdGlvbihhLGMsZSxrLGwsZyxwLG4scix1KXtRLmVuYWJsZUJvb3RSb209MDxhPyEwOiExO1EudXNlR2JjV2hlbkF2YWlsYWJsZT0wPGM/ITA6ITE7US5hdWRpb0JhdGNoUHJvY2Vzc2luZz0wPGU/ITA6ITE7US5ncmFwaGljc0JhdGNoUHJvY2Vzc2luZz0wPGs/ITA6ITE7US50aW1lcnNCYXRjaFByb2Nlc3Npbmc9MDxsPyEwOiExO1EuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmc9MDxnPyEwOiExO1EuYXVkaW9BY2N1bXVsYXRlU2FtcGxlcz0wPHA/ITA6ITE7US50aWxlUmVuZGVyaW5nPTA8bj8hMDohMTtRLnRpbGVDYWNoaW5nPTA8cj8hMDohMTtRLmVuYWJsZUF1ZGlvRGVidWdnaW5nPQowPHU/ITA6ITE7YT14KDMyMyk7Yi5HQkNFbmFibGVkPTE5Mj09PWF8fFEudXNlR2JjV2hlbkF2YWlsYWJsZSYmMTI4PT09YT8hMDohMTtiLkdCQ0RvdWJsZVNwZWVkPSExO2IucmVnaXN0ZXJBPTA7Yi5yZWdpc3RlckI9MDtiLnJlZ2lzdGVyQz0wO2IucmVnaXN0ZXJEPTA7Yi5yZWdpc3RlckU9MDtiLnJlZ2lzdGVySD0wO2IucmVnaXN0ZXJMPTA7Yi5yZWdpc3RlckY9MDtiLnN0YWNrUG9pbnRlcj0wO2IucHJvZ3JhbUNvdW50ZXI9MDtiLmN1cnJlbnRDeWNsZXM9MDtiLmlzSGFsdE5vcm1hbD0hMTtiLmlzSGFsdE5vSnVtcD0hMTtiLmlzSGFsdEJ1Zz0hMTtiLmlzU3RvcHBlZD0hMTtiLkdCQ0VuYWJsZWQ/KGIucmVnaXN0ZXJBPTE3LGIucmVnaXN0ZXJGPTEyOCxiLnJlZ2lzdGVyQj0wLGIucmVnaXN0ZXJDPTAsYi5yZWdpc3RlckQ9MjU1LGIucmVnaXN0ZXJFPTg2LGIucmVnaXN0ZXJIPTAsYi5yZWdpc3Rlckw9MTMpOihiLnJlZ2lzdGVyQT0xLGIucmVnaXN0ZXJGPTE3NixiLnJlZ2lzdGVyQj0KMCxiLnJlZ2lzdGVyQz0xOSxiLnJlZ2lzdGVyRD0wLGIucmVnaXN0ZXJFPTIxNixiLnJlZ2lzdGVySD0xLGIucmVnaXN0ZXJMPTc3KTtiLnByb2dyYW1Db3VudGVyPTI1NjtiLnN0YWNrUG9pbnRlcj02NTUzNDtkLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE7ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMDthPXgoMzI3KTtkLmlzUm9tT25seT0hMTtkLmlzTUJDMT0hMTtkLmlzTUJDMj0hMTtkLmlzTUJDMz0hMTtkLmlzTUJDNT0hMTswPT09YT9kLmlzUm9tT25seT0hMDoxPD1hJiYzPj1hP2QuaXNNQkMxPSEwOjU8PWEmJjY+PWE/ZC5pc01CQzI9ITA6MTU8PWEmJjE5Pj1hP2QuaXNNQkMzPSEwOjI1PD1hJiYzMD49YSYmKGQuaXNNQkM1PSEwKTtkLmN1cnJlbnRSb21CYW5rPTE7ZC5jdXJyZW50UmFtQmFuaz0wO2goNjUzNjEsMjU1KTtoKDY1MzYyLDI1NSk7aCg2NTM2MywyNTUpO2goNjUzNjQsMjU1KTtoKDY1MzY1LDI1NSk7dC5jdXJyZW50Q3ljbGVzPTA7dC5zY2FubGluZUN5Y2xlQ291bnRlcj0KMDt0LnNjYW5saW5lUmVnaXN0ZXI9MDt0LnNjcm9sbFg9MDt0LnNjcm9sbFk9MDt0LndpbmRvd1g9MDt0LndpbmRvd1k9MDtiLkdCQ0VuYWJsZWQ/KHQuc2NhbmxpbmVSZWdpc3Rlcj0xNDQsaCg2NTM0NCwxNDUpLGgoNjUzNDUsMTI5KSxoKDY1MzQ4LDE0NCksaCg2NTM1MSwyNTIpKToodC5zY2FubGluZVJlZ2lzdGVyPTE0NCxoKDY1MzQ0LDE0NSksaCg2NTM0NSwxMzMpLGgoNjUzNTAsMjU1KSxoKDY1MzUxLDI1MiksaCg2NTM1MiwyNTUpLGgoNjUzNTMsMjU1KSk7aCg2NTM1OSwwKTtoKDY1MzkyLDEpO2IuR0JDRW5hYmxlZD8oaCg2NTM4NCwxOTIpLGgoNjUzODUsMjU1KSxoKDY1Mzg2LDE5MyksaCg2NTM4NywxMykpOihoKDY1Mzg0LDI1NSksaCg2NTM4NSwyNTUpLGgoNjUzODYsMjU1KSxoKDY1Mzg3LDI1NSkpO2YuY3VycmVudEN5Y2xlcz0wO2YuTlI1MExlZnRNaXhlclZvbHVtZT0wO2YuTlI1MFJpZ2h0TWl4ZXJWb2x1bWU9MDtmLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD0KITA7Zi5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2YuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD0hMDtmLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2YuTlI1MklzU291bmRFbmFibGVkPSEwO2YuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj0wO2YuZG93blNhbXBsZUN5Y2xlQ291bnRlcj0wO2YuZnJhbWVTZXF1ZW5jZXI9MDtmLmF1ZGlvUXVldWVJbmRleD0wO0EuaW5pdGlhbGl6ZSgpO0suaW5pdGlhbGl6ZSgpO0kuaW5pdGlhbGl6ZSgpO0wuaW5pdGlhbGl6ZSgpO2goZi5tZW1vcnlMb2NhdGlvbk5SNTAsMTE5KTtoKGYubWVtb3J5TG9jYXRpb25OUjUxLAoyNDMpO2goZi5tZW1vcnlMb2NhdGlvbk5SNTIsMjQxKTt3LmNoYW5uZWwxU2FtcGxlPTE1O3cuY2hhbm5lbDJTYW1wbGU9MTU7dy5jaGFubmVsM1NhbXBsZT0xNTt3LmNoYW5uZWw0U2FtcGxlPTE1O3cuY2hhbm5lbDFEYWNFbmFibGVkPSExO3cuY2hhbm5lbDJEYWNFbmFibGVkPSExO3cuY2hhbm5lbDNEYWNFbmFibGVkPSExO3cuY2hhbm5lbDREYWNFbmFibGVkPSExO3cubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9MTI3O3cucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzt3Lm1peGVyVm9sdW1lQ2hhbmdlZD0hMDt3Lm1peGVyRW5hYmxlZENoYW5nZWQ9ITA7dy5uZWVkVG9SZW1peFNhbXBsZXM9ITE7cS51cGRhdGVJbnRlcnJ1cHRFbmFibGVkKDApO2gocS5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQscS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlKTtxLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZCgyMjUpO2gocS5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QsCnEuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlKTttLmN1cnJlbnRDeWNsZXM9MDttLmRpdmlkZXJSZWdpc3Rlcj0wO20udGltZXJDb3VudGVyPTA7bS50aW1lck1vZHVsbz0wO20udGltZXJFbmFibGVkPSExO20udGltZXJJbnB1dENsb2NrPTA7bS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExO20udGltZXJDb3VudGVyV2FzUmVzZXQ9ITE7Yi5HQkNFbmFibGVkPyhoKDY1Mjg0LDMwKSxtLmRpdmlkZXJSZWdpc3Rlcj03ODQwKTooaCg2NTI4NCwxNzEpLG0uZGl2aWRlclJlZ2lzdGVyPTQzOTgwKTtoKDY1Mjg3LDI0OCk7bS50aW1lcklucHV0Q2xvY2s9MjQ4O00uY3VycmVudEN5Y2xlcz0wO00ubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9MDtiLkdCQ0VuYWJsZWQ/KGgoNjUyODIsMTI0KSxNLnVwZGF0ZVRyYW5zZmVyQ29udHJvbCgxMjQpKTooaCg2NTI4MiwxMjYpLE0udXBkYXRlVHJhbnNmZXJDb250cm9sKDEyNikpO2IuR0JDRW5hYmxlZD8oaCg2NTM5MiwyNDgpLGgoNjUzNTksMjU0KSwKaCg2NTM1NywxMjYpLGgoNjUyODAsMjA3KSxoKDY1Mjk1LDIyNSksaCg2NTM4OCwyNTQpLGgoNjUzOTcsMTQzKSk6KGgoNjUzOTIsMjU1KSxoKDY1MzU5LDI1NSksaCg2NTM1NywyNTUpLGgoNjUyODAsMjA3KSxoKDY1Mjk1LDIyNSkpO0phPSExO1guY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O1guY3ljbGVTZXRzPTA7WC5jeWNsZXM9MDtQLnN0ZXBzUGVyU3RlcFNldD0yRTk7UC5zdGVwU2V0cz0wO1Auc3RlcHM9MH0saGFzQ29yZVN0YXJ0ZWQ6ZnVuY3Rpb24oKXtyZXR1cm4gSmE/MTowfSxzYXZlU3RhdGU6ZnVuY3Rpb24oKXtiLnNhdmVTdGF0ZSgpO3Quc2F2ZVN0YXRlKCk7cS5zYXZlU3RhdGUoKTtCLnNhdmVTdGF0ZSgpO2Quc2F2ZVN0YXRlKCk7bS5zYXZlU3RhdGUoKTtmLnNhdmVTdGF0ZSgpO0Euc2F2ZVN0YXRlKCk7Sy5zYXZlU3RhdGUoKTtJLnNhdmVTdGF0ZSgpO0wuc2F2ZVN0YXRlKCk7SmE9ITF9LGxvYWRTdGF0ZTpmdW5jdGlvbigpe2IubG9hZFN0YXRlKCk7dC5sb2FkU3RhdGUoKTsKcS5sb2FkU3RhdGUoKTtCLmxvYWRTdGF0ZSgpO2QubG9hZFN0YXRlKCk7bS5sb2FkU3RhdGUoKTtmLmxvYWRTdGF0ZSgpO0EubG9hZFN0YXRlKCk7Sy5sb2FkU3RhdGUoKTtJLmxvYWRTdGF0ZSgpO0wubG9hZFN0YXRlKCk7SmE9ITE7WC5jeWNsZXNQZXJDeWNsZVNldD0yRTk7WC5jeWNsZVNldHM9MDtYLmN5Y2xlcz0wO1Auc3RlcHNQZXJTdGVwU2V0PTJFOTtQLnN0ZXBTZXRzPTA7UC5zdGVwcz0wfSxpc0dCQzpmdW5jdGlvbigpe3JldHVybiBiLkdCQ0VuYWJsZWQ/MTowfSxnZXRTdGVwc1BlclN0ZXBTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gUC5zdGVwc1BlclN0ZXBTZXR9LGdldFN0ZXBTZXRzOmZ1bmN0aW9uKCl7cmV0dXJuIFAuc3RlcFNldHN9LGdldFN0ZXBzOmZ1bmN0aW9uKCl7cmV0dXJuIFAuc3RlcHN9LGV4ZWN1dGVNdWx0aXBsZUZyYW1lczpmdW5jdGlvbihhKXtmb3IodmFyIGI9MCxkPTA7ZDxhJiYwPD1iOyliPXJiKCksZCs9MTtyZXR1cm4gMD5iP2I6MH0sZXhlY3V0ZUZyYW1lOnJiLApleGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvOmZ1bmN0aW9uKGEpe3ZvaWQgMD09PWEmJihhPTApO3JldHVybiBJYSghMCxhLC0xKX0sZXhlY3V0ZUZyYW1lVW50aWxCcmVha3BvaW50OmZ1bmN0aW9uKGEpe3JldHVybiBJYSghMCwtMSxhKX0sZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpb1VudGlsQnJlYWtwb2ludDpmdW5jdGlvbihhLGIpe3JldHVybiBJYSghMCxhLGIpfSxleGVjdXRlVW50aWxDb25kaXRpb246SWEsZXhlY3V0ZVN0ZXA6c2IsZ2V0Q3ljbGVzUGVyQ3ljbGVTZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gWC5jeWNsZXNQZXJDeWNsZVNldH0sZ2V0Q3ljbGVTZXRzOmZ1bmN0aW9uKCl7cmV0dXJuIFguY3ljbGVTZXRzfSxnZXRDeWNsZXM6ZnVuY3Rpb24oKXtyZXR1cm4gWC5jeWNsZXN9LHNldEpveXBhZFN0YXRlOmZ1bmN0aW9uKGEsYixkLGYsbCxrLGgsZyl7MDxhP3NhKDApOmZhKDAsITEpOzA8Yj9zYSgxKTpmYSgxLCExKTswPGQ/c2EoMik6ZmEoMiwhMSk7MDxmP3NhKDMpOmZhKDMsCiExKTswPGw/c2EoNCk6ZmEoNCwhMSk7MDxrP3NhKDUpOmZhKDUsITEpOzA8aD9zYSg2KTpmYSg2LCExKTswPGc/c2EoNyk6ZmEoNywhMSl9LGdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXI6aWIsY2xlYXJBdWRpb0J1ZmZlcjpqYixXQVNNQk9ZX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfTUVNT1JZX1NJWkU6d2IsV0FTTUJPWV9XQVNNX1BBR0VTOnhiLEFTU0VNQkxZU0NSSVBUX01FTU9SWV9MT0NBVElPTjowLEFTU0VNQkxZU0NSSVBUX01FTU9SWV9TSVpFOjEwMjQsV0FTTUJPWV9TVEFURV9MT0NBVElPTjoxMDI0LFdBU01CT1lfU1RBVEVfU0laRToxMDI0LEdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjIwNDgsR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTo2NTUzNixWSURFT19SQU1fTE9DQVRJT046MjA0OCxWSURFT19SQU1fU0laRToxNjM4NCxXT1JLX1JBTV9MT0NBVElPTjoxODQzMixXT1JLX1JBTV9TSVpFOjMyNzY4LE9USEVSX0dBTUVCT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOjUxMjAwLApPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOjE2Mzg0LEdSQVBISUNTX09VVFBVVF9MT0NBVElPTjo2NzU4NCxHUkFQSElDU19PVVRQVVRfU0laRTpLYixHQkNfUEFMRVRURV9MT0NBVElPTjo2NzU4NCxHQkNfUEFMRVRURV9TSVpFOjEyOCxCR19QUklPUklUWV9NQVBfTE9DQVRJT046Njc3MTIsQkdfUFJJT1JJVFlfTUFQX1NJWkU6MjM1NTIsRlJBTUVfTE9DQVRJT046emEsRlJBTUVfU0laRTo5MzE4NCxCQUNLR1JPVU5EX01BUF9MT0NBVElPTjpNYSxCQUNLR1JPVU5EX01BUF9TSVpFOjE5NjYwOCxUSUxFX0RBVEFfTE9DQVRJT046WmEsVElMRV9EQVRBX1NJWkU6MTQ3NDU2LE9BTV9USUxFU19MT0NBVElPTjokYSxPQU1fVElMRVNfU0laRToxNTM2MCxBVURJT19CVUZGRVJfTE9DQVRJT046RGEsQVVESU9fQlVGRkVSX1NJWkU6MTMxMDcyLENIQU5ORUxfMV9CVUZGRVJfTE9DQVRJT046ZWIsQ0hBTk5FTF8xX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OOmZiLApDSEFOTkVMXzJfQlVGRkVSX1NJWkU6MTMxMDcyLENIQU5ORUxfM19CVUZGRVJfTE9DQVRJT046Z2IsQ0hBTk5FTF8zX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzRfQlVGRkVSX0xPQ0FUSU9OOmhiLENIQU5ORUxfNF9CVUZGRVJfU0laRToxMzEwNzIsQ0FSVFJJREdFX1JBTV9MT0NBVElPTjpYYSxDQVJUUklER0VfUkFNX1NJWkU6MTMxMDcyLENBUlRSSURHRV9ST01fTE9DQVRJT046R2EsQ0FSVFJJREdFX1JPTV9TSVpFOjgyNTg1NjAsREVCVUdfR0FNRUJPWV9NRU1PUllfTE9DQVRJT046dmIsREVCVUdfR0FNRUJPWV9NRU1PUllfU0laRTo2NTUzNSxnZXRXYXNtQm95T2Zmc2V0RnJvbUdhbWVCb3lPZmZzZXQ6b2IsZ2V0UmVnaXN0ZXJBOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJBfSxnZXRSZWdpc3RlckI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckJ9LGdldFJlZ2lzdGVyQzpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQ30sZ2V0UmVnaXN0ZXJEOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJEfSwKZ2V0UmVnaXN0ZXJFOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJFfSxnZXRSZWdpc3Rlckg6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3Rlckh9LGdldFJlZ2lzdGVyTDpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyTH0sZ2V0UmVnaXN0ZXJGOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJGfSxnZXRQcm9ncmFtQ291bnRlcjpmdW5jdGlvbigpe3JldHVybiBiLnByb2dyYW1Db3VudGVyfSxnZXRTdGFja1BvaW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5zdGFja1BvaW50ZXJ9LGdldE9wY29kZUF0UHJvZ3JhbUNvdW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4geChiLnByb2dyYW1Db3VudGVyKX0sZ2V0TFk6ZnVuY3Rpb24oKXtyZXR1cm4gdC5zY2FubGluZVJlZ2lzdGVyfSxkcmF3QmFja2dyb3VuZE1hcFRvV2FzbU1lbW9yeTpmdW5jdGlvbihhKXt2YXIgYz10Lm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RaZXJvU3RhcnQ7Qy5iZ1dpbmRvd1RpbGVEYXRhU2VsZWN0JiYKKGM9dC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQpO3ZhciBkPXQubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O0MuYmdUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGQ9dC5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7Zm9yKHZhciBmPTA7MjU2PmY7ZisrKWZvcih2YXIgbD0wOzI1Nj5sO2wrKyl7dmFyIGg9ZixnPWwsbT1kKzMyKihoPj4zKSsoZz4+Myksbj1hYShtLDApO249Q2EoYyxuKTt2YXIgcT1oJTg7aD1nJTg7aD03LWg7Zz0wO2IuR0JDRW5hYmxlZCYmMDxhJiYoZz1hYShtLDEpKTtwKDYsZykmJihxPTctcSk7dmFyIHI9MDtwKDMsZykmJihyPTEpO209YWEobisyKnEscik7bj1hYShuKzIqcSsxLHIpO3E9MDtwKGgsbikmJihxKz0xLHE8PD0xKTtwKGgsbSkmJihxKz0xKTtuPTMqKDI1NipmK2wpO2lmKGIuR0JDRW5hYmxlZCYmMDxhKWc9UmEoZyY3LHEsITEpLGg9ZGEoMCxnKSxtPWRhKDEsZykscT1kYSgyLGcpLGc9Ck1hK24sa1tnXT1oLGtbZysxXT1tLGtbZysyXT1xO2Vsc2UgZm9yKGg9UWEocSx0Lm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLG09MDszPm07bSsrKWc9TWErbittLGtbZ109aH19LGRyYXdUaWxlRGF0YVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzIzPmE7YSsrKWZvcih2YXIgYj0wOzMxPmI7YisrKXt2YXIgZD0wOzE1PGImJihkPTEpO3ZhciBmPWE7MTU8YSYmKGYtPTE1KTtmPDw9NDtmPTE1PGI/ZisoYi0xNSk6ZitiO3ZhciBnPXQubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0OzE1PGEmJihnPXQubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCk7Zm9yKHZhciBoPTA7OD5oO2grKylkYihmLGcsZCwwLDcsaCw4KmIsOCphK2gsMjQ4LFphLCEwLDAsLTEsLTEpfX0sZHJhd09hbVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzg+YTthKyspZm9yKHZhciBjPTA7NT5jO2MrKyl7dmFyIGQ9NCooOCoKYythKTt4KHQubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCk7eCh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMSk7dmFyIGY9eCh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMiksaD0xO0MudGFsbFNwcml0ZVNpemUmJigxPT09ZiUyJiYtLWYsaCs9MSk7dmFyIGc9eCh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK2QrMyk7ZD0wO2IuR0JDRW5hYmxlZCYmcCgzLGcpJiYoZD0xKTtmb3IoZz0wO2c8aDtnKyspZm9yKHZhciBrPTA7OD5rO2srKylkYihmK2csdC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQsZCwwLDcsayw4KmEsMTYqYytrKzgqZyw2NCwkYSwhMCwwLC0xLC0xKX19LGdldERJVjpmdW5jdGlvbigpe3JldHVybiBtLmRpdmlkZXJSZWdpc3Rlcn0sZ2V0VElNQTpmdW5jdGlvbigpe3JldHVybiBtLnRpbWVyQ291bnRlcn0sZ2V0VE1BOmZ1bmN0aW9uKCl7cmV0dXJuIG0udGltZXJNb2R1bG99LApnZXRUQUM6ZnVuY3Rpb24oKXt2YXIgYT1tLnRpbWVySW5wdXRDbG9jazttLnRpbWVyRW5hYmxlZCYmKGF8PTQpO3JldHVybiBhfSx1cGRhdGVEZWJ1Z0dCTWVtb3J5OmZ1bmN0aW9uKCl7Zm9yKHZhciBhPTA7NjU1MzU+YTthKyspe3ZhciBiPW5iKGEpO2tbdmIrYV09Yn19LHVwZGF0ZTpyYixlbXVsYXRpb25TdGVwOnNiLGdldEF1ZGlvUXVldWVJbmRleDppYixyZXNldEF1ZGlvUXVldWU6amIsd2FzbU1lbW9yeVNpemU6d2Isd2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbjoxMDI0LHdhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZToxMDI0LGdhbWVCb3lJbnRlcm5hbE1lbW9yeUxvY2F0aW9uOjIwNDgsZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZTo2NTUzNix2aWRlb091dHB1dExvY2F0aW9uOjY3NTg0LGZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb246emEsZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uOjY3NTg0LGdhbWVib3lDb2xvclBhbGV0dGVTaXplOjEyOCxiYWNrZ3JvdW5kTWFwTG9jYXRpb246TWEsCnRpbGVEYXRhTWFwOlphLHNvdW5kT3V0cHV0TG9jYXRpb246RGEsZ2FtZUJ5dGVzTG9jYXRpb246R2EsZ2FtZVJhbUJhbmtzTG9jYXRpb246WGF9KTtjb25zdCBxYz1hc3luYygpPT4oe2luc3RhbmNlOntleHBvcnRzOnBjfSxieXRlTWVtb3J5OkxhLndhc21CeXRlTWVtb3J5LHR5cGU6IlR5cGVTY3JpcHQifSk7bGV0IEthLFlhLFJiLG47bj17Z3JhcGhpY3NXb3JrZXJQb3J0OnZvaWQgMCxtZW1vcnlXb3JrZXJQb3J0OnZvaWQgMCxjb250cm9sbGVyV29ya2VyUG9ydDp2b2lkIDAsYXVkaW9Xb3JrZXJQb3J0OnZvaWQgMCx3YXNtSW5zdGFuY2U6dm9pZCAwLHdhc21CeXRlTWVtb3J5OnZvaWQgMCxvcHRpb25zOnZvaWQgMCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCwKV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxzcGVlZDowLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsYnJlYWtwb2ludDp2b2lkIDAsbWVzc2FnZUhhbmRsZXI6KGEpPT4Ke2NvbnN0IGI9QWEoYSk7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIHouQ09OTkVDVDoiR1JBUEhJQ1MiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhuLmdyYXBoaWNzV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0sQmEoVWIuYmluZCh2b2lkIDAsbiksbi5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8obi5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxCYShYYi5iaW5kKHZvaWQgMCxuKSxuLm1lbW9yeVdvcmtlclBvcnQpKToiQ09OVFJPTExFUiI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KG4uY29udHJvbGxlcldvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLEJhKFdiLmJpbmQodm9pZCAwLG4pLG4uY29udHJvbGxlcldvcmtlclBvcnQpKToiQVVESU8iPT09Yi5tZXNzYWdlLndvcmtlcklkJiYobi5hdWRpb1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLEJhKFZiLmJpbmQodm9pZCAwLG4pLG4uYXVkaW9Xb3JrZXJQb3J0KSk7CmJhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB6LklOU1RBTlRJQVRFX1dBU006KGFzeW5jKCk9PntsZXQgYTthPWF3YWl0IHFjKCk7bi53YXNtSW5zdGFuY2U9YS5pbnN0YW5jZTtuLndhc21CeXRlTWVtb3J5PWEuYnl0ZU1lbW9yeTtiYShOKHt0eXBlOmEudHlwZX0sYi5tZXNzYWdlSWQpKX0pKCk7YnJlYWs7Y2FzZSB6LkNPTkZJRzpuLndhc21JbnN0YW5jZS5leHBvcnRzLmNvbmZpZy5hcHBseShuLGIubWVzc2FnZS5jb25maWcpO24ub3B0aW9ucz1iLm1lc3NhZ2Uub3B0aW9ucztiYShOKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2Ugei5SRVNFVF9BVURJT19RVUVVRTpuLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB6LlBMQVk6Y2FzZSB6LlBMQVlfVU5USUxfQlJFQUtQT0lOVDppZighbi5wYXVzZWR8fCFuLndhc21JbnN0YW5jZXx8IW4ud2FzbUJ5dGVNZW1vcnkpe2JhKE4oe2Vycm9yOiEwfSwKYi5tZXNzYWdlSWQpKTticmVha31uLnBhdXNlZD0hMTtuLmZwc1RpbWVTdGFtcHM9W107dGIobik7bi5mcmFtZVNraXBDb3VudGVyPTA7bi5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7bi5icmVha3BvaW50PXZvaWQgMDtiLm1lc3NhZ2UuYnJlYWtwb2ludCYmKG4uYnJlYWtwb2ludD1iLm1lc3NhZ2UuYnJlYWtwb2ludCk7U2IobiwxRTMvbi5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB6LlBBVVNFOm4ucGF1c2VkPSEwO24udXBkYXRlSWQmJihjbGVhclRpbWVvdXQobi51cGRhdGVJZCksbi51cGRhdGVJZD12b2lkIDApO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB6LlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP24ud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpuLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7CmJhKE4oe3R5cGU6ei5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHouR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046e2E9MDtsZXQgYz1uLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtiLm1lc3NhZ2Uuc3RhcnQmJihhPWIubWVzc2FnZS5zdGFydCk7Yi5tZXNzYWdlLmVuZCYmKGM9Yi5tZXNzYWdlLmVuZCk7YT1uLndhc21CeXRlTWVtb3J5LnNsaWNlKGEsYykuYnVmZmVyO2JhKE4oe3R5cGU6ei5SVU5fV0FTTV9FWFBPUlQscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpLFthXSk7YnJlYWt9Y2FzZSB6LkdFVF9XQVNNX0NPTlNUQU5UOmJhKE4oe3R5cGU6ei5HRVRfV0FTTV9DT05TVEFOVCxyZXNwb25zZTpuLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2Ugei5GT1JDRV9PVVRQVVRfRlJBTUU6UGIobik7YnJlYWs7Y2FzZSB6LlNFVF9TUEVFRDpuLnNwZWVkPQpiLm1lc3NhZ2Uuc3BlZWQ7bi5mcHNUaW1lU3RhbXBzPVtdO24udGltZVN0YW1wc1VudGlsUmVhZHk9NjA7dGIobik7bi5mcmFtZVNraXBDb3VudGVyPTA7bi5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPTA7bi53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKTticmVhaztjYXNlIHouSVNfR0JDOmE9MDxuLndhc21JbnN0YW5jZS5leHBvcnRzLmlzR0JDKCk7YmEoTih7dHlwZTp6LklTX0dCQyxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coIlVua25vd24gV2FzbUJveSBXb3JrZXIgbWVzc2FnZToiLGIpfX0sZ2V0RlBTOigpPT4wPG4udGltZVN0YW1wc1VudGlsUmVhZHk/bi5zcGVlZCYmMDxuLnNwZWVkP24ub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKm4uc3BlZWQ6bi5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU6bi5mcHNUaW1lU3RhbXBzP24uZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07QmEobi5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

  var wasmboyGraphicsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsZil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6ZixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGs7Y29uc3QgbT0oYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6ZyhjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOnthPW5ldyBVaW50OENsYW1wZWRBcnJheShhLm1lc3NhZ2UuZ3JhcGhpY3NGcmFtZUJ1ZmZlcik7Y29uc3QgZj1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTIxNjApLGQ9bmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDMpO2ZvcihsZXQgYz0wOzE0ND5jO2MrKylmb3IobGV0IGU9MDsxNjA+ZTtlKyspe3ZhciBiPTMqKDE2MCpjK2UpO2ZvcihsZXQgYz0wOzM+YztjKyspZFtjXT1hW2IrY107Yj00KihlKzE2MCpjKTtmW2JdPWRbMF07ZltiKzFdPWRbMV07ZltiKzJdPWRbMl07ZltiKzNdPTI1NX1hPWZ9ZyhjKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bCgoYSk9PnthPWEuZGF0YT8KYS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjprPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sayk7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmsucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==";

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

    postMessage(message, transfer) {
      const messageObject = getSmartWorkerMessage(message, undefined, this.id);
      const messageId = messageObject.messageId;
      const messageIdListener = new Promise(resolve => {
        // Listen for a message with the same message id to be returned
        this.addMessageListener((responseMessage, messageListener) => {
          const eventData = getEventData(responseMessage);

          if (eventData.messageId === messageId) {
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
        await WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback);
        await loadROMAndConfigTask(fetchROMObject);
        this.ready = true;

        if (this.options.onReady) {
          this.options.onReady();
        }
      } else {
        // Finally intialize all of our services
        // Initialize our services
        await Promise.all([WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback), WasmBoyAudio.initialize(this.options.updateAudioCallback), WasmBoyController.initialize(), WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback)]);
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
  const playUntilBreakpoint = async breakpoint => {
    await WasmBoyLib.play(breakpoint);
    const message = await waitForLibWorkerMessageType(WORKER_MESSAGE_TYPE.BREAKPOINT);
    await WasmBoyLib.pause();
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
  function waitForLibWorkerMessageType(messageType) {
    if (!messageRequests[messageType]) {
      messageRequests[messageType] = [];
    }

    const promise = new Promise(resolve => {
      messageRequests[messageType].push(resolve);
    });
    return promise;
  } // Functions to handle the lib worker messages

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
        window.document.addEventListener('visibilitychange', () => {
          // fires when user switches tabs, apps, goes to homescreen, etc.
          if (document.visibilityState === 'hidden') {
            if (this.options && this.options.disablePauseOnHidden) {
              return;
            }

            this.pause();
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


    play(optionalBreakpoint) {
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
          if (optionalBreakpoint) {
            await this.worker.postMessage({
              type: WORKER_MESSAGE_TYPE.PLAY_UNTIL_BREAKPOINT,
              breakpoint: optionalBreakpoint
            });
          } else {
            await this.worker.postMessage({
              type: WORKER_MESSAGE_TYPE.PLAY
            });
          }
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
        updateGraphicsCallback: null,
        updateAudioCallback: null,
        saveStateCallback: null,
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
  var version = "0.3.4";
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
    saveState: WasmBoyLib.saveState.bind(WasmBoyLib),
    getSaveStates: WasmBoyLib.getSaveStates.bind(WasmBoyLib),
    loadState: WasmBoyLib.loadState.bind(WasmBoyLib),
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
    _playUntilBreakpoint: playUntilBreakpoint,
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
