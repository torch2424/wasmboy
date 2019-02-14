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

  var wasmboyLibTsWorkerUrl = "data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIENhKGEpe3JldHVybiBhLmRhdGE/YS5kYXRhOmF9ZnVuY3Rpb24gYmEoYSxiKXtRYT9zZWxmLnBvc3RNZXNzYWdlKGEsYik6ZGIucG9zdE1lc3NhZ2UoYSxiKX1mdW5jdGlvbiBEYShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKFFhKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKFFhKXNlbGYub25tZXNzYWdlPWE7ZWxzZSBkYi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gTihhLGIsZSl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksUmErKyxiPWAke2J9LSR7UmF9YCwxRTU8UmEmJihSYT0wKSk7cmV0dXJue3dvcmtlcklkOmUsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBYYihhLGIpe2I9Q2EoYik7CnN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSB6LkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZnJhbWVJblByb2dyZXNzVmlkZW9PdXRwdXRMb2NhdGlvbi52YWx1ZU9mKCksYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX1NJWkUudmFsdWVPZigpLGEuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6ei5HRVRfQ09OU1RBTlRTX0RPTkUsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBZYihhLGIpe2I9Q2EoYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIHouR0VUX0NPTlNUQU5UUzphLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF8xX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTp6LkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLnNvdW5kT3V0cHV0TG9jYXRpb24udmFsdWVPZigpfSwKYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHouQVVESU9fTEFURU5DWTphLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9Yi5tZXNzYWdlLmxhdGVuY3l9fWZ1bmN0aW9uIFpiKGEsYil7Yj1DYShiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2Ugei5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQ2IoYSl7aWYoIWEud2FzbUJ5dGVNZW1vcnkpcmV0dXJuIG5ldyBVaW50OEFycmF5O2xldCBiPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XSxlPXZvaWQgMDtpZigwPT09YilyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7MTw9YiYmMz49Yj9lPTMyNzY4OjU8PWImJjY+PWI/ZT0yMDQ4OjE1PD1iJiYxOT49Yj9lPTMyNzY4OjI1PD1iJiYzMD49YiYmKGU9MTMxMDcyKTtyZXR1cm4gZT9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTiwKYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OK2UpOm5ldyBVaW50OEFycmF5fWZ1bmN0aW9uIERiKGEpe2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCk7cmV0dXJuIGEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTithLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRSl9ZnVuY3Rpb24gJGIoYSxiKXtiPUNhKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSB6LkNMRUFSX01FTU9SWTpmb3IodmFyIGM9MDtjPD1hLndhc21CeXRlTWVtb3J5Lmxlbmd0aDtjKyspYS53YXNtQnl0ZU1lbW9yeVtjXT0wO2M9YS53YXNtQnl0ZU1lbW9yeS5zbGljZSgwKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTp6LkNMRUFSX01FTU9SWV9ET05FLHdhc21CeXRlTWVtb3J5OmMuYnVmZmVyfSxiLm1lc3NhZ2VJZCksW2MuYnVmZmVyXSk7CmJyZWFrO2Nhc2Ugei5HRVRfQ09OU1RBTlRTOmEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJ5dGVzTG9jYXRpb24udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKTthLldBU01CT1lfSU5URVJOQUxfU1RBVEVfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLndhc21Cb3lJbnRlcm5hbFN0YXRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5U2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTj0KYS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQm95SW50ZXJuYWxNZW1vcnlMb2NhdGlvbi52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lYm95Q29sb3JQYWxldHRlU2l6ZS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTih7dHlwZTp6LkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nYW1lQnl0ZXNMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVSYW1CYW5rc0xvY2F0aW9uLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy53YXNtQm95SW50ZXJuYWxTdGF0ZVNpemUudmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMud2FzbUJveUludGVybmFsU3RhdGVMb2NhdGlvbi52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVCb3lJbnRlcm5hbE1lbW9yeVNpemUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb24udmFsdWVPZigpLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTphLndhc21JbnN0YW5jZS5leHBvcnRzLmdhbWVib3lDb2xvclBhbGV0dGVTaXplLnZhbHVlT2YoKSxXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHouU0VUX01FTU9SWTpjPU9iamVjdC5rZXlzKGIubWVzc2FnZSk7CmMuaW5jbHVkZXMoRS5DQVJUUklER0VfUk9NKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuQ0FSVFJJREdFX1JPTV0pLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKTtjLmluY2x1ZGVzKEUuQ0FSVFJJREdFX1JBTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtFLkNBUlRSSURHRV9SQU1dKSxhLldBU01CT1lfR0FNRV9SQU1fQkFOS1NfTE9DQVRJT04pO2MuaW5jbHVkZXMoRS5HQU1FQk9ZX01FTU9SWSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtFLkdBTUVCT1lfTUVNT1JZXSksYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTik7Yy5pbmNsdWRlcyhFLlBBTEVUVEVfTUVNT1JZKSYmYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuUEFMRVRURV9NRU1PUlldKSxhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04pOwpjLmluY2x1ZGVzKEUuSU5URVJOQUxfU1RBVEUpJiYoYS53YXNtQnl0ZU1lbW9yeS5zZXQobmV3IFVpbnQ4QXJyYXkoYi5tZXNzYWdlW0UuSU5URVJOQUxfU1RBVEVdKSxhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04pLGEud2FzbUluc3RhbmNlLmV4cG9ydHMubG9hZFN0YXRlKCkpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShOKHt0eXBlOnouU0VUX01FTU9SWV9ET05FfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2Ugei5HRVRfTUVNT1JZOntjPXt0eXBlOnouR0VUX01FTU9SWX07Y29uc3QgZT1bXTt2YXIgdz1iLm1lc3NhZ2UubWVtb3J5VHlwZXM7aWYody5pbmNsdWRlcyhFLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXt2YXIgbT1hLndhc21CeXRlTWVtb3J5W2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMyN107dmFyIGQ9dm9pZCAwOzA9PT1tP2Q9MzI3Njg6MTw9bSYmMz49bT9kPTIwOTcxNTI6NTw9bSYmNj49bT9kPTI2MjE0NDoKMTU8PW0mJjE5Pj1tP2Q9MjA5NzE1MjoyNTw9bSYmMzA+PW0mJihkPTgzODg2MDgpO209ZD9hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OK2QpOm5ldyBVaW50OEFycmF5fWVsc2UgbT1uZXcgVWludDhBcnJheTttPW0uYnVmZmVyO2NbRS5DQVJUUklER0VfUk9NXT1tO2UucHVzaChtKX13LmluY2x1ZGVzKEUuQ0FSVFJJREdFX1JBTSkmJihtPUNiKGEpLmJ1ZmZlcixjW0UuQ0FSVFJJREdFX1JBTV09bSxlLnB1c2gobSkpO3cuaW5jbHVkZXMoRS5DQVJUUklER0VfSEVBREVSKSYmKGEud2FzbUJ5dGVNZW1vcnk/KG09YS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzA4LG09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShtLG0rMjcpKTptPW5ldyBVaW50OEFycmF5LG09bS5idWZmZXIsY1tFLkNBUlRSSURHRV9IRUFERVJdPW0sZS5wdXNoKG0pKTt3LmluY2x1ZGVzKEUuR0FNRUJPWV9NRU1PUlkpJiYKKG09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsY1tFLkdBTUVCT1lfTUVNT1JZXT1tLGUucHVzaChtKSk7dy5pbmNsdWRlcyhFLlBBTEVUVEVfTUVNT1JZKSYmKG09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFKS5idWZmZXIsY1tFLlBBTEVUVEVfTUVNT1JZXT1tLGUucHVzaChtKSk7dy5pbmNsdWRlcyhFLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2F2ZVN0YXRlKCksdz1EYihhKS5idWZmZXIsY1tFLklOVEVSTkFMX1NUQVRFXT13LGUucHVzaCh3KSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oYywKYi5tZXNzYWdlSWQpLGUpfX19ZnVuY3Rpb24gcihhLGIpe3JldHVybihhJjI1NSk8PDh8YiYyNTV9ZnVuY3Rpb24gRihhKXtyZXR1cm4oYSY2NTI4MCk+Pjh9ZnVuY3Rpb24gSChhLGIpe3JldHVybiBiJn4oMTw8YSl9ZnVuY3Rpb24gcShhLGIpe3JldHVybiAwIT0oYiYxPDxhKX1mdW5jdGlvbiBlYihhKXt2YXIgYj1hO3EoNyxiKSYmKGI9LTEqKDI1Ni1hKSk7cmV0dXJuIGJ9ZnVuY3Rpb24gU2EoYSxjKXthPTE8PGEmMjU1O2IucmVnaXN0ZXJGPTA8Yz9iLnJlZ2lzdGVyRnxhOmIucmVnaXN0ZXJGJigyNTVeYSk7cmV0dXJuIGIucmVnaXN0ZXJGfWZ1bmN0aW9uIGgoYSl7U2EoNyxhKX1mdW5jdGlvbiB2KGEpe1NhKDYsYSl9ZnVuY3Rpb24gRChhKXtTYSg1LGEpfWZ1bmN0aW9uIHUoYSl7U2EoNCxhKX1mdW5jdGlvbiBzYSgpe3JldHVybiBiLnJlZ2lzdGVyRj4+NyYxfWZ1bmN0aW9uIFYoKXtyZXR1cm4gYi5yZWdpc3RlckY+PjQmMX1mdW5jdGlvbiBUKGEsYil7MDw9Yj8wIT09KChhJgoxNSkrKGImMTUpJjE2KT9EKDEpOkQoMCk6KE1hdGguYWJzKGIpJjE1KT4oYSYxNSk/RCgxKTpEKDApfWZ1bmN0aW9uIGZiKGEsYil7MDw9Yj9hPihhK2ImMjU1KT91KDEpOnUoMCk6TWF0aC5hYnMoYik+YT91KDEpOnUoMCl9ZnVuY3Rpb24gd2EoYSxiLGUpe2U/KGE9YV5iXmErYiwwIT09KGEmMTYpP0QoMSk6RCgwKSwwIT09KGEmMjU2KT91KDEpOnUoMCkpOihlPWErYiY2NTUzNSxlPGE/dSgxKTp1KDApLDAhPT0oKGFeYl5lKSY0MDk2KT9EKDEpOkQoMCkpfWZ1bmN0aW9uIFRhKGEsYixlKXt2b2lkIDA9PT1lJiYoZT0hMSk7dmFyIGM9YTtlfHwoYz15KGIpPj4yKmEmMyk7YT0yNDI7c3dpdGNoKGMpe2Nhc2UgMTphPTE2MDticmVhaztjYXNlIDI6YT04ODticmVhaztjYXNlIDM6YT04fXJldHVybiBhfWZ1bmN0aW9uIFVhKGEsYixlKXtiPTgqYSsyKmI7YT1FYihiKzEsZSk7ZT1FYihiLGUpO3JldHVybiByKGEsZSl9ZnVuY3Rpb24gZWEoYSxiKXtyZXR1cm4gOCooKGImMzE8PDUqYSk+Pgo1KmEpfWZ1bmN0aW9uIEViKGEsYil7YSY9NjM7YiYmKGErPTY0KTtyZXR1cm4ga1s2NzU4NCthXX1mdW5jdGlvbiBWYShhLGIsZSx3KXt2b2lkIDA9PT1lJiYoZT0wKTt2b2lkIDA9PT13JiYodz0hMSk7ZSY9Mzt3JiYoZXw9NCk7a1s2NzcxMisoMTYwKmIrYSldPWV9ZnVuY3Rpb24gZ2IoYSxjLGUsdyxtLGQsZyxmLGgscCxyLG4sbCx5KXt2YXIgTz0wO2M9RmEoYyxhKTthPVkoYysyKmQsZSk7ZT1ZKGMrMipkKzEsZSk7Zm9yKGQ9dztkPD1tO2QrKylpZihjPWcrKGQtdyksYzxoKXt2YXIgY2E9ZDtpZigwPmx8fCFxKDUsbCkpY2E9Ny1jYTt2YXIgeGE9MDtxKGNhLGUpJiYoeGErPTEseGE8PD0xKTtxKGNhLGEpJiYoeGErPTEpO2lmKGIuR0JDRW5hYmxlZCYmKDA8PWx8fDA8PXkpKXtjYT0wPD15O3ZhciBFYT1sJjc7Y2EmJihFYT15JjcpO3ZhciB2YT1VYShFYSx4YSxjYSk7Y2E9ZWEoMCx2YSk7RWE9ZWEoMSx2YSk7dmE9ZWEoMix2YSl9ZWxzZSAwPj1uJiYobj10Lm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLApFYT1jYT12YT1UYSh4YSxuLHIpO3ZhciBoYj0zKihmKmgrYyk7a1twK2hiXT1jYTtrW3AraGIrMV09RWE7a1twK2hiKzJdPXZhO2NhPSExOzA8PWwmJihjYT1xKDcsbCkpO1ZhKGMsZix4YSxjYSk7TysrfXJldHVybiBPfWZ1bmN0aW9uIEZhKGEsYil7aWYoYT09PXQubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCl7dmFyIGM9YisxMjg7cSg3LGIpJiYoYz1iLTEyOCk7cmV0dXJuIGErMTYqY31yZXR1cm4gYSsxNipifWZ1bmN0aW9uIEZiKGEsYil7c3dpdGNoKGEpe2Nhc2UgMTpyZXR1cm4gcShiLDEyOSk7Y2FzZSAyOnJldHVybiBxKGIsMTM1KTtjYXNlIDM6cmV0dXJuIHEoYiwxMjYpO2RlZmF1bHQ6cmV0dXJuIHEoYiwxKX19ZnVuY3Rpb24gR2IoKXt2YXIgYT1IYigpOzIwNDc+PWEmJjA8QS5OUngwU3dlZXBTaGlmdCYmKEEuc3dlZXBTaGFkb3dGcmVxdWVuY3k9YSxBLnNldEZyZXF1ZW5jeShhKSxhPUhiKCkpOzIwNDc8YSYmKEEuaXNFbmFibGVkPSExKX1mdW5jdGlvbiBIYigpe3ZhciBhPQpBLnN3ZWVwU2hhZG93RnJlcXVlbmN5O2E+Pj1BLk5SeDBTd2VlcFNoaWZ0O3JldHVybiBhPUEuTlJ4ME5lZ2F0ZT9BLnN3ZWVwU2hhZG93RnJlcXVlbmN5LWE6QS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeSthfWZ1bmN0aW9uIFdhKGEpe3N3aXRjaChhKXtjYXNlIEEuY2hhbm5lbE51bWJlcjppZih4LmNoYW5uZWwxRGFjRW5hYmxlZCE9PUEuaXNEYWNFbmFibGVkKXJldHVybiB4LmNoYW5uZWwxRGFjRW5hYmxlZD1BLmlzRGFjRW5hYmxlZCwhMDticmVhaztjYXNlIEsuY2hhbm5lbE51bWJlcjppZih4LmNoYW5uZWwyRGFjRW5hYmxlZCE9PUsuaXNEYWNFbmFibGVkKXJldHVybiB4LmNoYW5uZWwyRGFjRW5hYmxlZD1LLmlzRGFjRW5hYmxlZCwhMDticmVhaztjYXNlIEkuY2hhbm5lbE51bWJlcjppZih4LmNoYW5uZWwzRGFjRW5hYmxlZCE9PUkuaXNEYWNFbmFibGVkKXJldHVybiB4LmNoYW5uZWwzRGFjRW5hYmxlZD1JLmlzRGFjRW5hYmxlZCwhMDticmVhaztjYXNlIEwuY2hhbm5lbE51bWJlcjppZih4LmNoYW5uZWw0RGFjRW5hYmxlZCE9PQpMLmlzRGFjRW5hYmxlZClyZXR1cm4geC5jaGFubmVsNERhY0VuYWJsZWQ9TC5pc0RhY0VuYWJsZWQsITB9cmV0dXJuITF9ZnVuY3Rpb24gWGEoKXtpZighKGYuY3VycmVudEN5Y2xlczxmLmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSlmb3IoO2YuY3VycmVudEN5Y2xlcz49Zi5iYXRjaFByb2Nlc3NDeWNsZXMoKTspSWIoZi5iYXRjaFByb2Nlc3NDeWNsZXMoKSksZi5jdXJyZW50Q3ljbGVzLT1mLmJhdGNoUHJvY2Vzc0N5Y2xlcygpfWZ1bmN0aW9uIEliKGEpe2YuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcis9YTtpZihmLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI+PWYubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcygpKXtmLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXItPWYubWF4RnJhbWVTZXF1ZW5jZUN5Y2xlcygpO3N3aXRjaChmLmZyYW1lU2VxdWVuY2VyKXtjYXNlIDA6QS51cGRhdGVMZW5ndGgoKTtLLnVwZGF0ZUxlbmd0aCgpO0kudXBkYXRlTGVuZ3RoKCk7TC51cGRhdGVMZW5ndGgoKTsKYnJlYWs7Y2FzZSAyOkEudXBkYXRlTGVuZ3RoKCk7Sy51cGRhdGVMZW5ndGgoKTtJLnVwZGF0ZUxlbmd0aCgpO0wudXBkYXRlTGVuZ3RoKCk7QS51cGRhdGVTd2VlcCgpO2JyZWFrO2Nhc2UgNDpBLnVwZGF0ZUxlbmd0aCgpO0sudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO2JyZWFrO2Nhc2UgNjpBLnVwZGF0ZUxlbmd0aCgpO0sudXBkYXRlTGVuZ3RoKCk7SS51cGRhdGVMZW5ndGgoKTtMLnVwZGF0ZUxlbmd0aCgpO0EudXBkYXRlU3dlZXAoKTticmVhaztjYXNlIDc6QS51cGRhdGVFbnZlbG9wZSgpLEsudXBkYXRlRW52ZWxvcGUoKSxMLnVwZGF0ZUVudmVsb3BlKCl9Zi5mcmFtZVNlcXVlbmNlcis9MTs4PD1mLmZyYW1lU2VxdWVuY2VyJiYoZi5mcmFtZVNlcXVlbmNlcj0wKTt2YXIgYj0hMH1lbHNlIGI9ITE7aWYoUS5hdWRpb0FjY3VtdWxhdGVTYW1wbGVzJiYhYil7Yj1BLndpbGxDaGFubmVsVXBkYXRlKGEpfHxXYShBLmNoYW5uZWxOdW1iZXIpOwp2YXIgZT1LLndpbGxDaGFubmVsVXBkYXRlKGEpfHxXYShLLmNoYW5uZWxOdW1iZXIpLHc9SS53aWxsQ2hhbm5lbFVwZGF0ZShhKXx8V2EoSS5jaGFubmVsTnVtYmVyKSxtPUwud2lsbENoYW5uZWxVcGRhdGUoYSl8fFdhKEwuY2hhbm5lbE51bWJlcik7YiYmKHguY2hhbm5lbDFTYW1wbGU9QS5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2UmJih4LmNoYW5uZWwyU2FtcGxlPUsuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcigpKTt3JiYoeC5jaGFubmVsM1NhbXBsZT1JLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXIoKSk7bSYmKHguY2hhbm5lbDRTYW1wbGU9TC5nZXRTYW1wbGVGcm9tQ3ljbGVDb3VudGVyKCkpO2lmKGJ8fGV8fHd8fG0peC5uZWVkVG9SZW1peFNhbXBsZXM9ITA7Zi5kb3duU2FtcGxlQ3ljbGVDb3VudGVyKz1hKmYuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcjtmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI+PWYubWF4RG93blNhbXBsZUN5Y2xlcygpJiYoZi5kb3duU2FtcGxlQ3ljbGVDb3VudGVyLT0KZi5tYXhEb3duU2FtcGxlQ3ljbGVzKCksKHgubmVlZFRvUmVtaXhTYW1wbGVzfHx4Lm1peGVyVm9sdW1lQ2hhbmdlZHx8eC5taXhlckVuYWJsZWRDaGFuZ2VkKSYmeWEoeC5jaGFubmVsMVNhbXBsZSx4LmNoYW5uZWwyU2FtcGxlLHguY2hhbm5lbDNTYW1wbGUseC5jaGFubmVsNFNhbXBsZSksemEoeC5sZWZ0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZSsxLHgucmlnaHRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlKzEsR2EpLGYuYXVkaW9RdWV1ZUluZGV4Kz0xLGYuYXVkaW9RdWV1ZUluZGV4Pj0oZi53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZS8yfDApLTEmJi0tZi5hdWRpb1F1ZXVlSW5kZXgpfWVsc2UgaWYoYj1BLmdldFNhbXBsZShhKXwwLGU9Sy5nZXRTYW1wbGUoYSl8MCx3PUkuZ2V0U2FtcGxlKGEpfDAsbT1MLmdldFNhbXBsZShhKXwwLHguY2hhbm5lbDFTYW1wbGU9Yix4LmNoYW5uZWwyU2FtcGxlPWUseC5jaGFubmVsM1NhbXBsZT13LHguY2hhbm5lbDRTYW1wbGU9bSxmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXIrPQphKmYuZG93blNhbXBsZUN5Y2xlTXVsdGlwbGllcixmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI+PWYubWF4RG93blNhbXBsZUN5Y2xlcygpKXtmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXItPWYubWF4RG93blNhbXBsZUN5Y2xlcygpO2E9eWEoYixlLHcsbSk7dmFyIGQ9RihhKTt6YShkKzEsKGEmMjU1KSsxLEdhKTtRLmVuYWJsZUF1ZGlvRGVidWdnaW5nJiYoYT15YShiLDE1LDE1LDE1KSxkPUYoYSksemEoZCsxLChhJjI1NSkrMSxpYiksYT15YSgxNSxlLDE1LDE1KSxkPUYoYSksemEoZCsxLChhJjI1NSkrMSxqYiksYT15YSgxNSwxNSx3LDE1KSxkPUYoYSksemEoZCsxLChhJjI1NSkrMSxrYiksYT15YSgxNSwxNSwxNSxtKSxkPUYoYSksemEoZCsxLChhJjI1NSkrMSxsYikpO2YuYXVkaW9RdWV1ZUluZGV4Kz0xO2YuYXVkaW9RdWV1ZUluZGV4Pj0oZi53YXNtQm95TWVtb3J5TWF4QnVmZmVyU2l6ZS8yfDApLTEmJi0tZi5hdWRpb1F1ZXVlSW5kZXh9fWZ1bmN0aW9uIG1iKCl7cmV0dXJuIGYuYXVkaW9RdWV1ZUluZGV4fQpmdW5jdGlvbiBuYigpe2YuYXVkaW9RdWV1ZUluZGV4PTB9ZnVuY3Rpb24geWEoYSxiLGUsdyl7dm9pZCAwPT09YSYmKGE9MTUpO3ZvaWQgMD09PWImJihiPTE1KTt2b2lkIDA9PT1lJiYoZT0xNSk7dm9pZCAwPT09dyYmKHc9MTUpO3gubWl4ZXJWb2x1bWVDaGFuZ2VkPSExO3ZhciBjPTAsZD0wO2M9Zi5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ/YythOmMrMTU7Yz1mLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uTGVmdE91dHB1dD9jK2I6YysxNTtjPWYuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0P2MrZTpjKzE1O2M9Zi5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ/Yyt3OmMrMTU7ZD1mLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCthOmQrMTU7ZD1mLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCtiOmQrMTU7ZD1mLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ/ZCtlOmQrMTU7ZD0KZi5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0P2QrdzpkKzE1O3gubWl4ZXJFbmFibGVkQ2hhbmdlZD0hMTt4Lm5lZWRUb1JlbWl4U2FtcGxlcz0hMTthPUpiKGMsZi5OUjUwTGVmdE1peGVyVm9sdW1lKzEpO2Q9SmIoZCxmLk5SNTBSaWdodE1peGVyVm9sdW1lKzEpO3gubGVmdENoYW5uZWxTYW1wbGVVbnNpZ25lZEJ5dGU9YTt4LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT1kO3JldHVybiByKGEsZCl9ZnVuY3Rpb24gSmIoYSxiKXtpZig2MD09PWEpcmV0dXJuIDEyNzthPTFFNSooYS02MCkqYi84fDA7YT1hLzFFNXwwO2ErPTYwO2E9MUU1KmEvKDEyRTYvMjU0fDApfDA7cmV0dXJuIGF8PTB9ZnVuY3Rpb24gemEoYSxiLGUpe2UrPTIqZi5hdWRpb1F1ZXVlSW5kZXg7a1tlXT1hKzE7a1tlKzFdPWIrMX1mdW5jdGlvbiBIYShhKXtZYSghMSk7dmFyIGM9eShwLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCk7Yz1IKGEsYyk7cC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9CmM7ZyhwLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCxjKTtiLnN0YWNrUG9pbnRlci09MjtiLmlzSGFsdGVkKCk7Yz1iLnN0YWNrUG9pbnRlcjt2YXIgZT1iLnByb2dyYW1Db3VudGVyLHc9RihlKSxkPWMrMTtnKGMsZSYyNTUpO2coZCx3KTtzd2l0Y2goYSl7Y2FzZSBwLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0OnAuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7Yi5wcm9ncmFtQ291bnRlcj02NDticmVhaztjYXNlIHAuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQ6cC5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTcyO2JyZWFrO2Nhc2UgcC5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0OnAuaXNUaW1lckludGVycnVwdFJlcXVlc3RlZD0hMTtiLnByb2dyYW1Db3VudGVyPTgwO2JyZWFrO2Nhc2UgcC5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdDpwLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPSExO2IucHJvZ3JhbUNvdW50ZXI9Cjg4O2JyZWFrO2Nhc2UgcC5iaXRQb3NpdGlvbkpveXBhZEludGVycnVwdDpwLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSExLGIucHJvZ3JhbUNvdW50ZXI9OTZ9fWZ1bmN0aW9uIEFhKGEpe3ZhciBiPXkocC5tZW1vcnlMb2NhdGlvbkludGVycnVwdFJlcXVlc3QpO2J8PTE8PGE7cC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU9YjtnKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LGIpfWZ1bmN0aW9uIFlhKGEpe2E/cC5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMDpwLm1hc3RlckludGVycnVwdFN3aXRjaD0hMX1mdW5jdGlvbiBvYihhKXtmb3IodmFyIGI9MDtiPGE7KXt2YXIgZT1uLmRpdmlkZXJSZWdpc3RlcjtiKz00O24uZGl2aWRlclJlZ2lzdGVyKz00OzY1NTM1PG4uZGl2aWRlclJlZ2lzdGVyJiYobi5kaXZpZGVyUmVnaXN0ZXItPTY1NTM2KTtuLnRpbWVyRW5hYmxlZCYmKG4udGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT8obi50aW1lckNvdW50ZXI9bi50aW1lck1vZHVsbywKcC5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPSEwLEFhKHAuYml0UG9zaXRpb25UaW1lckludGVycnVwdCksbi50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExLG4udGltZXJDb3VudGVyV2FzUmVzZXQ9ITApOm4udGltZXJDb3VudGVyV2FzUmVzZXQmJihuLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExKSxLYihlLG4uZGl2aWRlclJlZ2lzdGVyKSYmcGIoKSl9fWZ1bmN0aW9uIHBiKCl7bi50aW1lckNvdW50ZXIrPTE7MjU1PG4udGltZXJDb3VudGVyJiYobi50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSEwLG4udGltZXJDb3VudGVyPTApfWZ1bmN0aW9uIEtiKGEsYil7dmFyIGM9cWIobi50aW1lcklucHV0Q2xvY2spO3JldHVybiBxKGMsYSkmJiFxKGMsYik/ITA6ITF9ZnVuY3Rpb24gcWIoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gOTtjYXNlIDE6cmV0dXJuIDM7Y2FzZSAyOnJldHVybiA1O2Nhc2UgMzpyZXR1cm4gN31yZXR1cm4gMH1mdW5jdGlvbiB0YShhKXt2YXIgYz1iLmlzU3RvcHBlZD0KITE7YWMoYSl8fChjPSEwKTtoYShhLCEwKTtjJiYoYz0hMSwzPj1hJiYoYz0hMCksYT0hMSxCLmlzRHBhZFR5cGUmJmMmJihhPSEwKSxCLmlzQnV0dG9uVHlwZSYmIWMmJihhPSEwKSxhJiYocC5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZD0hMCxBYShwLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0KSkpfWZ1bmN0aW9uIGFjKGEpe3N3aXRjaChhKXtjYXNlIDA6cmV0dXJuIEIudXA7Y2FzZSAxOnJldHVybiBCLnJpZ2h0O2Nhc2UgMjpyZXR1cm4gQi5kb3duO2Nhc2UgMzpyZXR1cm4gQi5sZWZ0O2Nhc2UgNDpyZXR1cm4gQi5hO2Nhc2UgNTpyZXR1cm4gQi5iO2Nhc2UgNjpyZXR1cm4gQi5zZWxlY3Q7Y2FzZSA3OnJldHVybiBCLnN0YXJ0O2RlZmF1bHQ6cmV0dXJuITF9fWZ1bmN0aW9uIGhhKGEsYil7c3dpdGNoKGEpe2Nhc2UgMDpCLnVwPWI7YnJlYWs7Y2FzZSAxOkIucmlnaHQ9YjticmVhaztjYXNlIDI6Qi5kb3duPWI7YnJlYWs7Y2FzZSAzOkIubGVmdD1iO2JyZWFrO2Nhc2UgNDpCLmE9CmI7YnJlYWs7Y2FzZSA1OkIuYj1iO2JyZWFrO2Nhc2UgNjpCLnNlbGVjdD1iO2JyZWFrO2Nhc2UgNzpCLnN0YXJ0PWJ9fWZ1bmN0aW9uIExiKGEsYyxlKXtmb3IodmFyIHc9MDt3PGU7dysrKXtmb3IodmFyIG09cmIoYSt3KSxrPWMrdzs0MDk1OTxrOylrLT04MTkyO1phKGssbSkmJmcoayxtKX1hPTMyO2IuR0JDRG91YmxlU3BlZWQmJihhPTY0KTtkLkRNQUN5Y2xlcys9ZS8xNiphfWZ1bmN0aW9uIFphKGEsYyl7aWYoYT09PWIubWVtb3J5TG9jYXRpb25TcGVlZFN3aXRjaClyZXR1cm4gZyhiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gsYyYxKSwhMTt2YXIgZT1kLnZpZGVvUmFtTG9jYXRpb24sdz1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbjtpZihhPGUpe2lmKCFkLmlzUm9tT25seSlpZig4MTkxPj1hKXtpZighZC5pc01CQzJ8fHEoNCxjKSljJj0xNSwwPT09Yz9kLmlzUmFtQmFua2luZ0VuYWJsZWQ9ITE6MTA9PT1jJiYoZC5pc1JhbUJhbmtpbmdFbmFibGVkPSEwKX1lbHNlIDE2MzgzPj0KYT8hZC5pc01CQzV8fDEyMjg3Pj1hPyhkLmlzTUJDMiYmKGQuY3VycmVudFJvbUJhbms9YyYxNSksZC5pc01CQzE/KGMmPTMxLGQuY3VycmVudFJvbUJhbmsmPTIyNCk6ZC5pc01CQzM/KGMmPTEyNyxkLmN1cnJlbnRSb21CYW5rJj0xMjgpOmQuaXNNQkM1JiYoZC5jdXJyZW50Um9tQmFuayY9MCksZC5jdXJyZW50Um9tQmFua3w9Yyk6KGE9MCxlPWQuY3VycmVudFJvbUJhbmsmMjU1LDA8YyYmKGE9MSksZC5jdXJyZW50Um9tQmFuaz1yKGEsZSkpOiFkLmlzTUJDMiYmMjQ1NzU+PWE/ZC5pc01CQzEmJmQuaXNNQkMxUm9tTW9kZUVuYWJsZWQ/KGQuY3VycmVudFJvbUJhbmsmPTMxLGQuY3VycmVudFJvbUJhbmt8PWMmMjI0KTooYz1kLmlzTUJDNT9jJjE1OmMmMyxkLmN1cnJlbnRSYW1CYW5rPWMpOiFkLmlzTUJDMiYmMzI3Njc+PWEmJmQuaXNNQkMxJiYocSgwLGMpP2QuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA6ZC5pc01CQzFSb21Nb2RlRW5hYmxlZD0hMSk7cmV0dXJuITF9aWYoYT49CmUmJmE8ZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbilyZXR1cm4hMDtpZihhPj1kLmVjaG9SYW1Mb2NhdGlvbiYmYTx3KXJldHVybiBnKGEtODE5MixjKSwhMDtpZihhPj13JiZhPD1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZClyZXR1cm4gMj5DLmN1cnJlbnRMY2RNb2RlPyExOiEwO2lmKGE+PWQudW51c2FibGVNZW1vcnlMb2NhdGlvbiYmYTw9ZC51bnVzYWJsZU1lbW9yeUVuZExvY2F0aW9uKXJldHVybiExO2lmKGE9PT1NLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sKXJldHVybiBNLnVwZGF0ZVRyYW5zZmVyQ29udHJvbChjKTtpZig2NTI5Njw9YSYmNjUzMTg+PWEpe1hhKCk7aWYoYT09PWYubWVtb3J5TG9jYXRpb25OUjUyfHxmLk5SNTJJc1NvdW5kRW5hYmxlZCl7c3dpdGNoKGEpe2Nhc2UgQS5tZW1vcnlMb2NhdGlvbk5SeDA6QS51cGRhdGVOUngwKGMpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDA6SS51cGRhdGVOUngwKGMpO2JyZWFrOwpjYXNlIEEubWVtb3J5TG9jYXRpb25OUngxOkEudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEsubWVtb3J5TG9jYXRpb25OUngxOksudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUngxOkkudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUngxOkwudXBkYXRlTlJ4MShjKTticmVhaztjYXNlIEEubWVtb3J5TG9jYXRpb25OUngyOkEudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEsubWVtb3J5TG9jYXRpb25OUngyOksudXBkYXRlTlJ4MihjKTticmVhaztjYXNlIEkubWVtb3J5TG9jYXRpb25OUngyOkkudm9sdW1lQ29kZUNoYW5nZWQ9ITA7SS51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgTC5tZW1vcnlMb2NhdGlvbk5SeDI6TC51cGRhdGVOUngyKGMpO2JyZWFrO2Nhc2UgQS5tZW1vcnlMb2NhdGlvbk5SeDM6QS51cGRhdGVOUngzKGMpO2JyZWFrO2Nhc2UgSy5tZW1vcnlMb2NhdGlvbk5SeDM6Sy51cGRhdGVOUngzKGMpO2JyZWFrOwpjYXNlIEkubWVtb3J5TG9jYXRpb25OUngzOkkudXBkYXRlTlJ4MyhjKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUngzOkwudXBkYXRlTlJ4MyhjKTticmVhaztjYXNlIEEubWVtb3J5TG9jYXRpb25OUng0OnEoNyxjKSYmKEEudXBkYXRlTlJ4NChjKSxBLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBLLm1lbW9yeUxvY2F0aW9uTlJ4NDpxKDcsYykmJihLLnVwZGF0ZU5SeDQoYyksSy50cmlnZ2VyKCkpO2JyZWFrO2Nhc2UgSS5tZW1vcnlMb2NhdGlvbk5SeDQ6cSg3LGMpJiYoSS51cGRhdGVOUng0KGMpLEkudHJpZ2dlcigpKTticmVhaztjYXNlIEwubWVtb3J5TG9jYXRpb25OUng0OnEoNyxjKSYmKEwudXBkYXRlTlJ4NChjKSxMLnRyaWdnZXIoKSk7YnJlYWs7Y2FzZSBmLm1lbW9yeUxvY2F0aW9uTlI1MDpmLnVwZGF0ZU5SNTAoYyk7eC5taXhlclZvbHVtZUNoYW5nZWQ9ITA7YnJlYWs7Y2FzZSBmLm1lbW9yeUxvY2F0aW9uTlI1MTpmLnVwZGF0ZU5SNTEoYyk7eC5taXhlckVuYWJsZWRDaGFuZ2VkPQohMDticmVhaztjYXNlIGYubWVtb3J5TG9jYXRpb25OUjUyOmlmKGYudXBkYXRlTlI1MihjKSwhcSg3LGMpKWZvcihjPTY1Mjk2OzY1MzE4PmM7YysrKWcoYywwKX1jPSEwfWVsc2UgYz0hMTtyZXR1cm4gY302NTMyODw9YSYmNjUzNDM+PWEmJlhhKCk7aWYoYT49Qy5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wmJmE8PXQubWVtb3J5TG9jYXRpb25XaW5kb3dYKXtpZihhPT09Qy5tZW1vcnlMb2NhdGlvbkxjZENvbnRyb2wpcmV0dXJuIEMudXBkYXRlTGNkQ29udHJvbChjKSwhMDtpZihhPT09Qy5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cylyZXR1cm4gQy51cGRhdGVMY2RTdGF0dXMoYyksITE7aWYoYT09PXQubWVtb3J5TG9jYXRpb25TY2FubGluZVJlZ2lzdGVyKXJldHVybiB0LnNjYW5saW5lUmVnaXN0ZXI9MCxnKGEsMCksITE7aWYoYT09PUMubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmUpcmV0dXJuIEMuY29pbmNpZGVuY2VDb21wYXJlPWMsITA7aWYoYT09PXQubWVtb3J5TG9jYXRpb25EbWFUcmFuc2Zlcil7Yzw8PQo4O2ZvcihhPTA7MTU5Pj1hO2ErKyllPXkoYythKSxnKGQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uK2EsZSk7ZC5ETUFDeWNsZXM9NjQ0O3JldHVybiEwfXN3aXRjaChhKXtjYXNlIHQubWVtb3J5TG9jYXRpb25TY3JvbGxYOnQuc2Nyb2xsWD1jO2JyZWFrO2Nhc2UgdC5tZW1vcnlMb2NhdGlvblNjcm9sbFk6dC5zY3JvbGxZPWM7YnJlYWs7Y2FzZSB0Lm1lbW9yeUxvY2F0aW9uV2luZG93WDp0LndpbmRvd1g9YzticmVhaztjYXNlIHQubWVtb3J5TG9jYXRpb25XaW5kb3dZOnQud2luZG93WT1jfXJldHVybiEwfWlmKGE9PT1kLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIpcmV0dXJuIGIuR0JDRW5hYmxlZCYmKGQuaXNIYmxhbmtIZG1hQWN0aXZlJiYhcSg3LGMpPyhkLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMSxjPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyKSxnKGQubWVtb3J5TG9jYXRpb25IZG1hVHJpZ2dlcixjfDEyOCkpOihhPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFTb3VyY2VIaWdoKSwKZT15KGQubWVtb3J5TG9jYXRpb25IZG1hU291cmNlTG93KSxhPXIoYSxlKSY2NTUyMCxlPXkoZC5tZW1vcnlMb2NhdGlvbkhkbWFEZXN0aW5hdGlvbkhpZ2gpLHc9eShkLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93KSxlPXIoZSx3KSxlPShlJjgxNzYpK2QudmlkZW9SYW1Mb2NhdGlvbix3PUgoNyxjKSx3PTE2Kih3KzEpLHEoNyxjKT8oZC5pc0hibGFua0hkbWFBY3RpdmU9ITAsZC5oYmxhbmtIZG1hVHJhbnNmZXJMZW5ndGhSZW1haW5pbmc9dyxkLmhibGFua0hkbWFTb3VyY2U9YSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbj1lLGcoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLEgoNyxjKSkpOihMYihhLGUsdyksZyhkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsMjU1KSkpKSwhMTtpZigoYT09PWQubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFua3x8YT09PWQubWVtb3J5TG9jYXRpb25HQkNWUkFNQmFuaykmJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYoMTYzODQ8PWQuaGJsYW5rSGRtYVNvdXJjZSYmCjMyNzY3Pj1kLmhibGFua0hkbWFTb3VyY2V8fDUzMjQ4PD1kLmhibGFua0hkbWFTb3VyY2UmJjU3MzQzPj1kLmhibGFua0hkbWFTb3VyY2UpKXJldHVybiExO2lmKGE+PUlhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVJbmRleCYmYTw9SWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7aWYoYT09PUlhLm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGVEYXRhfHxhPT09SWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSl7ZT15KGEtMSk7ZT1IKDYsZSk7dz0hMTthPT09SWEubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlRGF0YSYmKHc9ITApO3ZhciBtPWUmNjM7dyYmKG0rPTY0KTtrWzY3NTg0K21dPWM7Yz1lOy0tYTtxKDcsYykmJmcoYSxjKzF8MTI4KX1yZXR1cm4hMH1pZihhPj1uLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyJiZhPD1uLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKXtvYihuLmN1cnJlbnRDeWNsZXMpO24uY3VycmVudEN5Y2xlcz0KMDtzd2l0Y2goYSl7Y2FzZSBuLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyOnJldHVybiBuLnVwZGF0ZURpdmlkZXJSZWdpc3RlcihjKSwhMTtjYXNlIG4ubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI6bi51cGRhdGVUaW1lckNvdW50ZXIoYyk7YnJlYWs7Y2FzZSBuLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG86bi51cGRhdGVUaW1lck1vZHVsbyhjKTticmVhaztjYXNlIG4ubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w6bi51cGRhdGVUaW1lckNvbnRyb2woYyl9cmV0dXJuITB9YT09PUIubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3RlciYmQi51cGRhdGVKb3lwYWQoYyk7aWYoYT09PXAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0KXJldHVybiBwLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZChjKSwhMDthPT09cC5tZW1vcnlMb2NhdGlvbkludGVycnVwdEVuYWJsZWQmJnAudXBkYXRlSW50ZXJydXB0RW5hYmxlZChjKTtyZXR1cm4hMH1mdW5jdGlvbiBzYihhKXtzd2l0Y2goYT4+CjEyKXtjYXNlIDA6Y2FzZSAxOmNhc2UgMjpjYXNlIDM6cmV0dXJuIGErSmE7Y2FzZSA0OmNhc2UgNTpjYXNlIDY6Y2FzZSA3OnZhciBjPWQuY3VycmVudFJvbUJhbms7ZC5pc01CQzV8fDAhPT1jfHwoYz0xKTtyZXR1cm4gMTYzODQqYysoYS1kLnN3aXRjaGFibGVDYXJ0cmlkZ2VSb21Mb2NhdGlvbikrSmE7Y2FzZSA4OmNhc2UgOTpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9eShkLm1lbW9yeUxvY2F0aW9uR0JDVlJBTUJhbmspJjEpLGEtZC52aWRlb1JhbUxvY2F0aW9uKzIwNDgrODE5MipjO2Nhc2UgMTA6Y2FzZSAxMTpyZXR1cm4gODE5MipkLmN1cnJlbnRSYW1CYW5rKyhhLWQuY2FydHJpZGdlUmFtTG9jYXRpb24pKyRhO2Nhc2UgMTI6cmV0dXJuIGEtZC5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb24rMTg0MzI7Y2FzZSAxMzpyZXR1cm4gYz0wLGIuR0JDRW5hYmxlZCYmKGM9eShkLm1lbW9yeUxvY2F0aW9uR0JDV1JBTUJhbmspJjcpLDE+YyYmKGM9MSksYS1kLmludGVybmFsUmFtQmFua1plcm9Mb2NhdGlvbisKMTg0MzIrNDA5NiooYy0xKTtkZWZhdWx0OnJldHVybiBhLWQuZWNob1JhbUxvY2F0aW9uKzUxMjAwfX1mdW5jdGlvbiBnKGEsYil7YT1zYihhKTtrW2FdPWJ9ZnVuY3Rpb24gUihhLGIpe2tbYV09Yj8xOjB9ZnVuY3Rpb24gTWIoYSl7dC5zY2FubGluZUN5Y2xlQ291bnRlcj0wO3Quc2NhbmxpbmVSZWdpc3Rlcj0wO2codC5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsMCk7dmFyIGI9eShDLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTtiPUgoMSxiKTtiPUgoMCxiKTtDLmN1cnJlbnRMY2RNb2RlPTA7ZyhDLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzLGIpO2lmKGEpZm9yKGE9MDthPE5iO2ErKylrWzY3NTg0K2FdPTI1NX1mdW5jdGlvbiBPYihhLGIpe3ZhciBjPUMuY29pbmNpZGVuY2VDb21wYXJlOzAhPT1hJiYxIT09YXx8dC5zY2FubGluZVJlZ2lzdGVyIT09Yz9iPUgoMixiKTooYnw9NCxxKDYsYikmJihwLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPSEwLEFhKHAuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQpKSk7CnJldHVybiBifWZ1bmN0aW9uIFBiKGEsYyxlLHcsZCxnKXtmb3IodmFyIG09dz4+MzsxNjA+ZDtkKyspe3ZhciBmPWQrZzsyNTY8PWYmJihmLT0yNTYpO3ZhciBoPWUrMzIqbSsoZj4+MykscD1ZKGgsMCksTz0hMTtpZihRLnRpbGVDYWNoaW5nKXt2YXIgbD1kO3ZhciBuPWEscj1mLHY9aCx4PXAsdT0wO2lmKDA8biYmODxsJiZ4PT09aWEudGlsZUlkJiZsPT09aWEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2spe3ZhciB6PXg9ITE7cSg1LHkodi0xKSkmJih4PSEwKTtxKDUseSh2KSkmJih6PSEwKTtmb3Iodj0wOzg+djt2KyspaWYoeCE9PXomJih2PTctdiksMTYwPj1sK3Ype2Zvcih2YXIgQT1sLSg4LXYpLEM9QmErMyooMTYwKm4rKGwrdikpLEI9MDszPkI7QisrKWRhKGwrdixuLEIsa1tDK0JdKTtBPWtbNjc3MTIrKDE2MCpuK0EpXTtWYShsK3YsbixIKDIsQSkscSgyLEEpKTt1Kyt9fWVsc2UgaWEudGlsZUlkPXg7bD49aWEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2smJgooaWEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9bCs4LG49ciU4LGw8biYmKGlhLm5leHRYSW5kZXhUb1BlcmZvcm1DYWNoZUNoZWNrKz1uKSk7bD11OzA8bCYmKGQrPWwtMSxPPSEwKX1RLnRpbGVSZW5kZXJpbmcmJiFPPyhPPWQsbD1hLHU9YyxuPXclOCxyPTAsMD09TyYmKHI9Zi1mLzgqOCksZj03LDE2MDxPKzgmJihmPTE2MC1PKSx4PS0xLHo9MCxiLkdCQ0VuYWJsZWQmJih4PVkoaCwxKSxxKDMseCkmJih6PTEpLHEoNix4KSYmKG49Ny1uKSksbD1nYihwLHUseixyLGYsbixPLGwsMTYwLEJhLCExLDAseCwtMSksMDxsJiYoZCs9bC0xKSk6T3x8KGIuR0JDRW5hYmxlZD8oTz1kLGw9YSxuPXcsdT1GYShjLHApLGg9WShoLDEpLG4lPTgscSg2LGgpJiYobj03LW4pLHI9MCxxKDMsaCkmJihyPTEpLHA9WSh1KzIqbixyKSx1PVkodSsyKm4rMSxyKSxuPWYlOCxxKDUsaCl8fChuPTctbiksZj0wLHEobix1KSYmKGY9ZisxPDwxKSxxKG4scCkmJihmKz0xKSxuPVVhKGgmNyxmLCExKSwKcD1lYSgwLG4pLHU9ZWEoMSxuKSxuPWVhKDIsbiksZGEoTyxsLDAscCksZGEoTyxsLDEsdSksZGEoTyxsLDIsbiksVmEoTyxsLGYscSg3LGgpKSk6KGg9ZCxPPWEsdT13LGw9RmEoYyxwKSx1JT04LHA9WShsKzIqdSwwKSxsPVkobCsyKnUrMSwwKSx1PTctZiU4LGY9MCxxKHUsbCkmJihmPWYrMTw8MSkscSh1LHApJiYoZis9MSkscD1UYShmLHQubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSksZGEoaCxPLDAscCksZGEoaCxPLDEscCksZGEoaCxPLDIscCksVmEoaCxPLGYpKSl9fWZ1bmN0aW9uIFFiKGEpe2lmKEMuZW5hYmxlZClmb3IodC5zY2FubGluZUN5Y2xlQ291bnRlcis9YTt0LnNjYW5saW5lQ3ljbGVDb3VudGVyPj10Lk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCk7KXt0LnNjYW5saW5lQ3ljbGVDb3VudGVyLT10Lk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCk7YT10LnNjYW5saW5lUmVnaXN0ZXI7aWYoMTQ0PT09YSl7aWYoUS5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZylmb3IodmFyIGI9CjA7MTQ0Pj1iO2IrKyl0YihiKTtlbHNlIHRiKGEpO2ZvcihiPTA7MTQ0PmI7YisrKWZvcih2YXIgZT0wOzE2MD5lO2UrKylrWzY3NzEyKygxNjAqYitlKV09MDtpYS50aWxlSWQ9LTE7aWEubmV4dFhJbmRleFRvUGVyZm9ybUNhY2hlQ2hlY2s9LTF9ZWxzZSAxNDQ+YSYmKFEuZ3JhcGhpY3NEaXNhYmxlU2NhbmxpbmVSZW5kZXJpbmd8fHRiKGEpKTthPTE1MzxhPzA6YSsxO3Quc2NhbmxpbmVSZWdpc3Rlcj1hfWlmKEMuZW5hYmxlZClpZihiPXQuc2NhbmxpbmVSZWdpc3RlcixlPUMuY3VycmVudExjZE1vZGUsYT0wLDE0NDw9Yj9hPTE6dC5zY2FubGluZUN5Y2xlQ291bnRlcj49dC5NSU5fQ1lDTEVTX1NQUklURVNfTENEX01PREUoKT9hPTI6dC5zY2FubGluZUN5Y2xlQ291bnRlcj49dC5NSU5fQ1lDTEVTX1RSQU5TRkVSX0RBVEFfTENEX01PREUoKSYmKGE9MyksZSE9PWEpe2I9eShDLm1lbW9yeUxvY2F0aW9uTGNkU3RhdHVzKTtDLmN1cnJlbnRMY2RNb2RlPWE7ZT0hMTtzd2l0Y2goYSl7Y2FzZSAwOmI9CkgoMCxiKTtiPUgoMSxiKTtlPXEoMyxiKTticmVhaztjYXNlIDE6Yj1IKDEsYik7Ynw9MTtlPXEoNCxiKTticmVhaztjYXNlIDI6Yj1IKDAsYik7Ynw9MjtlPXEoNSxiKTticmVhaztjYXNlIDM6Ynw9M31lJiYocC5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMCxBYShwLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0KSk7MD09PWEmJmQuaXNIYmxhbmtIZG1hQWN0aXZlJiYoZT0xNixkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZzxlJiYoZT1kLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZyksTGIoZC5oYmxhbmtIZG1hU291cmNlLGQuaGJsYW5rSGRtYURlc3RpbmF0aW9uLGUpLGQuaGJsYW5rSGRtYVNvdXJjZSs9ZSxkLmhibGFua0hkbWFEZXN0aW5hdGlvbis9ZSxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZy09ZSwwPj1kLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz8oZC5pc0hibGFua0hkbWFBY3RpdmU9ITEsZyhkLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXIsCjI1NSkpOmcoZC5tZW1vcnlMb2NhdGlvbkhkbWFUcmlnZ2VyLEgoNyxkLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZy8xNi0xKSkpOzE9PT1hJiYocC5pc1ZCbGFua0ludGVycnVwdFJlcXVlc3RlZD0hMCxBYShwLmJpdFBvc2l0aW9uVkJsYW5rSW50ZXJydXB0KSk7Yj1PYihhLGIpO2coQy5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKX1lbHNlIDE1Mz09PWImJihiPXkoQy5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyksYj1PYihhLGIpLGcoQy5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyxiKSl9ZnVuY3Rpb24gdGIoYSl7dmFyIGM9dC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0O0MuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdCYmKGM9dC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQpO2lmKGIuR0JDRW5hYmxlZHx8Qy5iZ0Rpc3BsYXlFbmFibGVkKXt2YXIgZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDtDLmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJgooZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KTt2YXIgZD10LnNjcm9sbFgsbT1hK3Quc2Nyb2xsWTsyNTY8PW0mJihtLT0yNTYpO1BiKGEsYyxlLG0sMCxkKX1DLndpbmRvd0Rpc3BsYXlFbmFibGVkJiYoZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydCxDLndpbmRvd1RpbGVNYXBEaXNwbGF5U2VsZWN0JiYoZT10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdE9uZVN0YXJ0KSxkPXQud2luZG93WCxtPXQud2luZG93WSxhPG18fChkLT03LFBiKGEsYyxlLGEtbSxkLC0xKmQpKSk7aWYoQy5zcHJpdGVEaXNwbGF5RW5hYmxlKWZvcihjPUMudGFsbFNwcml0ZVNpemUsZT0zOTswPD1lO2UtLSl7bT00KmU7dmFyIGY9eSh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK20pO2Q9eSh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK20rMSk7dmFyIGc9eSh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlKwptKzIpO2YtPTE2O2QtPTg7dmFyIG49ODtjJiYobj0xNiwxPT09ZyUyJiYtLWcpO2lmKGE+PWYmJmE8ZituKXttPXkodC5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZSttKzMpO3ZhciBsPXEoNyxtKSxoPXEoNixtKSxwPXEoNSxtKTtmPWEtZjtoJiYoZi09bixmKj0tMSwtLWYpO2YqPTI7Zz1GYSh0Lm1lbW9yeUxvY2F0aW9uVGlsZURhdGFTZWxlY3RPbmVTdGFydCxnKTtuPWcrPWY7Zj0wO2IuR0JDRW5hYmxlZCYmcSgzLG0pJiYoZj0xKTtnPVkobixmKTtuPVkobisxLGYpO2ZvcihmPTc7MDw9ZjtmLS0pe2g9ZjtwJiYoaC09NyxoKj0tMSk7dmFyIHI9MDtxKGgsbikmJihyKz0xLHI8PD0xKTtxKGgsZykmJihyKz0xKTtpZigwIT09ciYmKGg9ZCsoNy1mKSwwPD1oJiYxNjA+PWgpKXt2YXIgdT0hMSx2PSExLHg9ITE7Yi5HQkNFbmFibGVkJiYhQy5iZ0Rpc3BsYXlFbmFibGVkJiYodT0hMCk7aWYoIXUpe3ZhciB6PWtbNjc3MTIrKDE2MCphK2gpXSxBPXomMztsJiYwPEE/CnY9ITA6Yi5HQkNFbmFibGVkJiZxKDIseikmJjA8QSYmKHg9ITApfWlmKHV8fCF2JiYheCliLkdCQ0VuYWJsZWQ/KHY9VWEobSY3LHIsITApLHI9ZWEoMCx2KSx1PWVhKDEsdiksdj1lYSgyLHYpLGRhKGgsYSwwLHIpLGRhKGgsYSwxLHUpLGRhKGgsYSwyLHYpKToodT10Lm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSxxKDQsbSkmJih1PXQubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKSxyPVRhKHIsdSksZGEoaCxhLDAsciksZGEoaCxhLDEsciksZGEoaCxhLDIscikpfX19fX1mdW5jdGlvbiBkYShhLGIsZSxkKXtrW0JhKzMqKDE2MCpiK2EpK2VdPWR9ZnVuY3Rpb24gWShhLGIpe3JldHVybiBrW2EtZC52aWRlb1JhbUxvY2F0aW9uKzIwNDgrODE5MiooYiYxKV19ZnVuY3Rpb24gdWIoYSl7dmFyIGM9ZC52aWRlb1JhbUxvY2F0aW9uO3JldHVybiBhPGN8fGE+PWMmJmE8ZC5jYXJ0cmlkZ2VSYW1Mb2NhdGlvbj8tMTphPj1kLmVjaG9SYW1Mb2NhdGlvbiYmYTxkLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbj8KeShhLTgxOTIpOmE+PWQuc3ByaXRlSW5mb3JtYXRpb25UYWJsZUxvY2F0aW9uJiZhPD1kLnNwcml0ZUluZm9ybWF0aW9uVGFibGVMb2NhdGlvbkVuZD8yPkMuY3VycmVudExjZE1vZGU/MjU1Oi0xOmE9PT1iLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2g/KGE9MjU1LGM9eShiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLHEoMCxjKXx8KGE9SCgwLGEpKSxiLkdCQ0RvdWJsZVNwZWVkfHwoYT1IKDcsYSkpLGEpOmE9PT10Lm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj8oZyhhLHQuc2NhbmxpbmVSZWdpc3RlciksdC5zY2FubGluZVJlZ2lzdGVyKTo2NTI5Njw9YSYmNjUzMTg+PWE/KFhhKCksYT1hPT09Zi5tZW1vcnlMb2NhdGlvbk5SNTI/eShmLm1lbW9yeUxvY2F0aW9uTlI1MikmMTI4fDExMjotMSxhKTo2NTMyODw9YSYmNjUzNDM+PWE/KFhhKCksLTEpOmE9PT1uLm1lbW9yeUxvY2F0aW9uRGl2aWRlclJlZ2lzdGVyPyhjPUYobi5kaXZpZGVyUmVnaXN0ZXIpLGcoYSxjKSwKYyk6YT09PW4ubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI/KGcoYSxuLnRpbWVyQ291bnRlciksbi50aW1lckNvdW50ZXIpOmE9PT1wLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdD8yMjR8cC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWU6YT09PUIubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3Rlcj8oYT1CLmpveXBhZFJlZ2lzdGVyRmxpcHBlZCxCLmlzRHBhZFR5cGU/KGE9Qi51cD9IKDIsYSk6YXw0LGE9Qi5yaWdodD9IKDAsYSk6YXwxLGE9Qi5kb3duP0goMyxhKTphfDgsYT1CLmxlZnQ/SCgxLGEpOmF8Mik6Qi5pc0J1dHRvblR5cGUmJihhPUIuYT9IKDAsYSk6YXwxLGE9Qi5iP0goMSxhKTphfDIsYT1CLnNlbGVjdD9IKDIsYSk6YXw0LGE9Qi5zdGFydD9IKDMsYSk6YXw4KSxhfDI0MCk6LTF9ZnVuY3Rpb24geShhKXtyZXR1cm4ga1tzYihhKV19ZnVuY3Rpb24gcmIoYSl7dmFyIGI9dWIoYSk7c3dpdGNoKGIpe2Nhc2UgLTE6cmV0dXJuIHkoYSk7ZGVmYXVsdDpyZXR1cm4gYn19CmZ1bmN0aW9uIFMoYSl7cmV0dXJuIDA8a1thXT8hMDohMX1mdW5jdGlvbiBqYShhKXtUKGIucmVnaXN0ZXJBLGEpO2ZiKGIucmVnaXN0ZXJBLGEpO2IucmVnaXN0ZXJBPWIucmVnaXN0ZXJBK2EmMjU1OzA9PT1iLnJlZ2lzdGVyQT9oKDEpOmgoMCk7digwKX1mdW5jdGlvbiBrYShhKXt2YXIgYz1iLnJlZ2lzdGVyQSthK1YoKSYyNTU7MCE9KChiLnJlZ2lzdGVyQV5hXmMpJjE2KT9EKDEpOkQoMCk7MDwoYi5yZWdpc3RlckErYStWKCkmMjU2KT91KDEpOnUoMCk7Yi5yZWdpc3RlckE9YzswPT09Yi5yZWdpc3RlckE/aCgxKTpoKDApO3YoMCl9ZnVuY3Rpb24gbGEoYSl7dmFyIGM9LTEqYTtUKGIucmVnaXN0ZXJBLGMpO2ZiKGIucmVnaXN0ZXJBLGMpO2IucmVnaXN0ZXJBPWIucmVnaXN0ZXJBLWEmMjU1OzA9PT1iLnJlZ2lzdGVyQT9oKDEpOmgoMCk7digxKX1mdW5jdGlvbiBtYShhKXt2YXIgYz1iLnJlZ2lzdGVyQS1hLVYoKSYyNTU7MCE9KChiLnJlZ2lzdGVyQV5hXmMpJjE2KT9EKDEpOgpEKDApOzA8KGIucmVnaXN0ZXJBLWEtVigpJjI1Nik/dSgxKTp1KDApO2IucmVnaXN0ZXJBPWM7MD09PWIucmVnaXN0ZXJBP2goMSk6aCgwKTt2KDEpfWZ1bmN0aW9uIG5hKGEpe2IucmVnaXN0ZXJBJj1hOzA9PT1iLnJlZ2lzdGVyQT9oKDEpOmgoMCk7digwKTtEKDEpO3UoMCl9ZnVuY3Rpb24gb2EoYSl7Yi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBXmEpJjI1NTswPT09Yi5yZWdpc3RlckE/aCgxKTpoKDApO3YoMCk7RCgwKTt1KDApfWZ1bmN0aW9uIHBhKGEpe2IucmVnaXN0ZXJBfD1hOzA9PT1iLnJlZ2lzdGVyQT9oKDEpOmgoMCk7digwKTtEKDApO3UoMCl9ZnVuY3Rpb24gcWEoYSl7YSo9LTE7VChiLnJlZ2lzdGVyQSxhKTtmYihiLnJlZ2lzdGVyQSxhKTswPT09Yi5yZWdpc3RlckErYT9oKDEpOmgoMCk7digxKX1mdW5jdGlvbiB1YShhLGIpezA9PT0oYiYxPDxhKT9oKDEpOmgoMCk7digwKTtEKDEpO3JldHVybiBifWZ1bmN0aW9uIGFhKGEsYixlKXtyZXR1cm4gMDxiP2V8MTw8YToKZSZ+KDE8PGEpfWZ1bmN0aW9uIEthKGEpe2E9ZWIoYSk7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyK2EmNjU1MzU7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzV9ZnVuY3Rpb24gUmIoYSl7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7Yi5pc0hhbHRCdWcmJihiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNSk7c3dpdGNoKChhJjI0MCk+PjQpe2Nhc2UgMDpyZXR1cm4gYmMoYSk7Y2FzZSAxOnJldHVybiBjYyhhKTtjYXNlIDI6cmV0dXJuIGRjKGEpO2Nhc2UgMzpyZXR1cm4gZWMoYSk7Y2FzZSA0OnJldHVybiBmYyhhKTtjYXNlIDU6cmV0dXJuIGdjKGEpO2Nhc2UgNjpyZXR1cm4gaGMoYSk7Y2FzZSA3OnJldHVybiBpYyhhKTtjYXNlIDg6cmV0dXJuIGpjKGEpO2Nhc2UgOTpyZXR1cm4ga2MoYSk7Y2FzZSAxMDpyZXR1cm4gbGMoYSk7Y2FzZSAxMTpyZXR1cm4gbWMoYSk7Y2FzZSAxMjpyZXR1cm4gbmMoYSk7CmNhc2UgMTM6cmV0dXJuIG9jKGEpO2Nhc2UgMTQ6cmV0dXJuIHBjKGEpO2RlZmF1bHQ6cmV0dXJuIHFjKGEpfX1mdW5jdGlvbiBKKGEpe3JhKDQpO3JldHVybiByYihhKX1mdW5jdGlvbiBVKGEsYil7cmEoNCk7WmEoYSxiKSYmZyhhLGIpfWZ1bmN0aW9uIGZhKGEpe3JhKDgpO3ZhciBiPXViKGEpO3N3aXRjaChiKXtjYXNlIC0xOmI9eShhKX1hKz0xO3ZhciBlPXViKGEpO3N3aXRjaChlKXtjYXNlIC0xOmE9eShhKTticmVhaztkZWZhdWx0OmE9ZX1yZXR1cm4gcihhLGIpfWZ1bmN0aW9uIFcoYSxiKXtyYSg4KTt2YXIgYz1GKGIpO2ImPTI1NTt2YXIgZD1hKzE7WmEoYSxiKSYmZyhhLGIpO1phKGQsYykmJmcoZCxjKX1mdW5jdGlvbiBHKCl7cmEoNCk7cmV0dXJuIHkoYi5wcm9ncmFtQ291bnRlcil9ZnVuY3Rpb24gWigpe3JhKDQpO3ZhciBhPXkoYi5wcm9ncmFtQ291bnRlcisxJjY1NTM1KTtyZXR1cm4gcihhLEcoKSl9ZnVuY3Rpb24gYmMoYSl7c3dpdGNoKGEpe2Nhc2UgMDpyZXR1cm4gNDsKY2FzZSAxOnJldHVybiBhPVooKSxiLnJlZ2lzdGVyQj1GKGEpLGIucmVnaXN0ZXJDPWEmMjU1LGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1LDQ7Y2FzZSAyOnJldHVybiBVKHIoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMzpyZXR1cm4gYT1yKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKSxhKyssYi5yZWdpc3RlckI9RihhKSxiLnJlZ2lzdGVyQz1hJjI1NSw4O2Nhc2UgNDpyZXR1cm4gVChiLnJlZ2lzdGVyQiwxKSxiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyQisxJjI1NSwwPT09Yi5yZWdpc3RlckI/aCgxKTpoKDApLHYoMCksNDtjYXNlIDU6cmV0dXJuIFQoYi5yZWdpc3RlckIsLTEpLGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJCLTEmMjU1LDA9PT1iLnJlZ2lzdGVyQj9oKDEpOmgoMCksdigxKSw0O2Nhc2UgNjpyZXR1cm4gYi5yZWdpc3RlckI9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LAo0O2Nhc2UgNzpyZXR1cm4gMTI4PT09KGIucmVnaXN0ZXJBJjEyOCk/dSgxKTp1KDApLGE9Yi5yZWdpc3RlckEsYi5yZWdpc3RlckE9KGE8PDF8YT4+NykmMjU1LGgoMCksdigwKSxEKDApLDQ7Y2FzZSA4OnJldHVybiBXKFooKSxiLnN0YWNrUG9pbnRlciksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDk6YT1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKTt2YXIgYz1yKGIucmVnaXN0ZXJCLGIucmVnaXN0ZXJDKTt3YShhLGMsITEpO2E9YStjJjY1NTM1O2IucmVnaXN0ZXJIPUYoYSk7Yi5yZWdpc3Rlckw9YSYyNTU7digwKTtyZXR1cm4gODtjYXNlIDEwOnJldHVybiBiLnJlZ2lzdGVyQT1KKHIoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw0O2Nhc2UgMTE6cmV0dXJuIGE9cihiLnJlZ2lzdGVyQixiLnJlZ2lzdGVyQyksYT1hLTEmNjU1MzUsYi5yZWdpc3RlckI9RihhKSxiLnJlZ2lzdGVyQz1hJjI1NSw4O2Nhc2UgMTI6cmV0dXJuIFQoYi5yZWdpc3RlckMsCjEpLGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJDKzEmMjU1LDA9PT1iLnJlZ2lzdGVyQz9oKDEpOmgoMCksdigwKSw0O2Nhc2UgMTM6cmV0dXJuIFQoYi5yZWdpc3RlckMsLTEpLGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJDLTEmMjU1LDA9PT1iLnJlZ2lzdGVyQz9oKDEpOmgoMCksdigxKSw0O2Nhc2UgMTQ6cmV0dXJuIGIucmVnaXN0ZXJDPUcoKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMTU6cmV0dXJuIDA8KGIucmVnaXN0ZXJBJjEpP3UoMSk6dSgwKSxhPWIucmVnaXN0ZXJBLGIucmVnaXN0ZXJBPShhPj4xfGE8PDcpJjI1NSxoKDApLHYoMCksRCgwKSw0fXJldHVybi0xfWZ1bmN0aW9uIGNjKGEpe3N3aXRjaChhKXtjYXNlIDE2OmlmKGIuR0JDRW5hYmxlZCYmKGE9SihiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gpLHEoMCxhKSkpcmV0dXJuIGE9SCgwLGEpLHEoNyxhKT8oYi5HQkNEb3VibGVTcGVlZD0hMSxhPUgoNyxhKSk6KGIuR0JDRG91YmxlU3BlZWQ9CiEwLGF8PTEyOCksVShiLm1lbW9yeUxvY2F0aW9uU3BlZWRTd2l0Y2gsYSksNjg7Yi5pc1N0b3BwZWQ9ITA7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzU7cmV0dXJuIDQ7Y2FzZSAxNzpyZXR1cm4gYT1aKCksYi5yZWdpc3RlckQ9RihhKSxiLnJlZ2lzdGVyRT1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMTg6cmV0dXJuIFUocihiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSksYi5yZWdpc3RlckEpLDQ7Y2FzZSAxOTpyZXR1cm4gYT1yKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVyRD1GKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDg7Y2FzZSAyMDpyZXR1cm4gVChiLnJlZ2lzdGVyRCwxKSxiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyRCsxJjI1NSwwPT09Yi5yZWdpc3RlckQ/aCgxKTpoKDApLHYoMCksNDtjYXNlIDIxOnJldHVybiBUKGIucmVnaXN0ZXJELC0xKSxiLnJlZ2lzdGVyRD0KYi5yZWdpc3RlckQtMSYyNTUsMD09PWIucmVnaXN0ZXJEP2goMSk6aCgwKSx2KDEpLDQ7Y2FzZSAyMjpyZXR1cm4gYi5yZWdpc3RlckQ9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMzpyZXR1cm4gYT0hMSwxMjg9PT0oYi5yZWdpc3RlckEmMTI4KSYmKGE9ITApLGIucmVnaXN0ZXJBPShiLnJlZ2lzdGVyQTw8MXxWKCkpJjI1NSxhP3UoMSk6dSgwKSxoKDApLHYoMCksRCgwKSw0O2Nhc2UgMjQ6cmV0dXJuIEthKEcoKSksODtjYXNlIDI1OmE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9cihiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSk7d2EoYSxjLCExKTthPWErYyY2NTUzNTtiLnJlZ2lzdGVySD1GKGEpO2IucmVnaXN0ZXJMPWEmMjU1O3YoMCk7cmV0dXJuIDg7Y2FzZSAyNjpyZXR1cm4gYT1yKGIucmVnaXN0ZXJELGIucmVnaXN0ZXJFKSxiLnJlZ2lzdGVyQT1KKGEpLDQ7Y2FzZSAyNzpyZXR1cm4gYT1yKGIucmVnaXN0ZXJELApiLnJlZ2lzdGVyRSksYT1hLTEmNjU1MzUsYi5yZWdpc3RlckQ9RihhKSxiLnJlZ2lzdGVyRT1hJjI1NSw4O2Nhc2UgMjg6cmV0dXJuIFQoYi5yZWdpc3RlckUsMSksYi5yZWdpc3RlckU9Yi5yZWdpc3RlckUrMSYyNTUsMD09PWIucmVnaXN0ZXJFP2goMSk6aCgwKSx2KDApLDQ7Y2FzZSAyOTpyZXR1cm4gVChiLnJlZ2lzdGVyRSwtMSksYi5yZWdpc3RlckU9Yi5yZWdpc3RlckUtMSYyNTUsMD09PWIucmVnaXN0ZXJFP2goMSk6aCgwKSx2KDEpLDQ7Y2FzZSAzMDpyZXR1cm4gYi5yZWdpc3RlckU9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAzMTpyZXR1cm4gYT0hMSwxPT09KGIucmVnaXN0ZXJBJjEpJiYoYT0hMCksYi5yZWdpc3RlckE9KGIucmVnaXN0ZXJBPj4xfFYoKTw8NykmMjU1LGE/dSgxKTp1KDApLGgoMCksdigwKSxEKDApLDR9cmV0dXJuLTF9ZnVuY3Rpb24gZGMoYSl7c3dpdGNoKGEpe2Nhc2UgMzI6cmV0dXJuIDA9PT1zYSgpPwpLYShHKCkpOmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDg7Y2FzZSAzMzpyZXR1cm4gYT1aKCksYi5yZWdpc3Rlckg9RihhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSw0O2Nhc2UgMzQ6cmV0dXJuIGE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksVShhLGIucmVnaXN0ZXJBKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSAzNTpyZXR1cm4gYT1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSAzNjpyZXR1cm4gVChiLnJlZ2lzdGVySCwxKSxiLnJlZ2lzdGVySD1iLnJlZ2lzdGVySCsxJjI1NSwwPT09Yi5yZWdpc3Rlckg/aCgxKTpoKDApLHYoMCksNDtjYXNlIDM3OnJldHVybiBUKGIucmVnaXN0ZXJILC0xKSxiLnJlZ2lzdGVySD1iLnJlZ2lzdGVySC0KMSYyNTUsMD09PWIucmVnaXN0ZXJIP2goMSk6aCgwKSx2KDEpLDQ7Y2FzZSAzODpyZXR1cm4gYi5yZWdpc3Rlckg9RygpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAzOTp2YXIgYz0wOzA8KGIucmVnaXN0ZXJGPj41JjEpJiYoY3w9Nik7MDxWKCkmJihjfD05Nik7MDwoYi5yZWdpc3RlckY+PjYmMSk/YT1iLnJlZ2lzdGVyQS1jJjI1NTooOTwoYi5yZWdpc3RlckEmMTUpJiYoY3w9NiksMTUzPGIucmVnaXN0ZXJBJiYoY3w9OTYpLGE9Yi5yZWdpc3RlckErYyYyNTUpOzA9PT1hP2goMSk6aCgwKTswIT09KGMmOTYpP3UoMSk6dSgwKTtEKDApO2IucmVnaXN0ZXJBPWE7cmV0dXJuIDQ7Y2FzZSA0MDpyZXR1cm4gMDxzYSgpP0thKEcoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDQxOnJldHVybiBhPXIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHdhKGEsYSwhMSksYT0yKmEmNjU1MzUsYi5yZWdpc3Rlckg9CkYoYSksYi5yZWdpc3Rlckw9YSYyNTUsdigwKSw4O2Nhc2UgNDI6cmV0dXJuIGE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckE9SihhKSxhPWErMSY2NTUzNSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDQ7Y2FzZSA0MzpyZXR1cm4gYT1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxhPWEtMSY2NTUzNSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPWEmMjU1LDg7Y2FzZSA0NDpyZXR1cm4gVChiLnJlZ2lzdGVyTCwxKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCsxJjI1NSwwPT09Yi5yZWdpc3Rlckw/aCgxKTpoKDApLHYoMCksNDtjYXNlIDQ1OnJldHVybiBUKGIucmVnaXN0ZXJMLC0xKSxiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTC0xJjI1NSwwPT09Yi5yZWdpc3Rlckw/aCgxKTpoKDApLHYoMSksNDtjYXNlIDQ2OnJldHVybiBiLnJlZ2lzdGVyTD1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDQ3OnJldHVybiBiLnJlZ2lzdGVyQT0KfmIucmVnaXN0ZXJBLHYoMSksRCgxKSw0fXJldHVybi0xfWZ1bmN0aW9uIGVjKGEpe3N3aXRjaChhKXtjYXNlIDQ4OnJldHVybiAwPT09VigpP0thKEcoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDQ5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1aKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDUwOnJldHVybiBhPXIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLFUoYSxiLnJlZ2lzdGVyQSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9RihhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgNTE6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzEmNjU1MzUsODtjYXNlIDUyOmE9cihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCk7dmFyIGM9SihhKTtUKGMsMSk7Yz1jKzEmMjU1OzA9PT1jP2goMSk6aCgwKTt2KDApO1UoYSxjKTtyZXR1cm4gNDtjYXNlIDUzOnJldHVybiBhPXIoYi5yZWdpc3RlckgsCmIucmVnaXN0ZXJMKSxjPUooYSksVChjLC0xKSxjPWMtMSYyNTUsMD09PWM/aCgxKTpoKDApLHYoMSksVShhLGMpLDQ7Y2FzZSA1NDpyZXR1cm4gVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSA1NTpyZXR1cm4gdigwKSxEKDApLHUoMSksNDtjYXNlIDU2OnJldHVybiAxPT09VigpP0thKEcoKSk6Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsODtjYXNlIDU3OnJldHVybiBhPXIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLHdhKGEsYi5zdGFja1BvaW50ZXIsITEpLGE9YStiLnN0YWNrUG9pbnRlciY2NTUzNSxiLnJlZ2lzdGVySD1GKGEpLGIucmVnaXN0ZXJMPWEmMjU1LHYoMCksODtjYXNlIDU4OnJldHVybiBhPXIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBPUooYSksYT1hLTEmNjU1MzUsYi5yZWdpc3Rlckg9RihhKSxiLnJlZ2lzdGVyTD0KYSYyNTUsNDtjYXNlIDU5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0xJjY1NTM1LDg7Y2FzZSA2MDpyZXR1cm4gVChiLnJlZ2lzdGVyQSwxKSxiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQSsxJjI1NSwwPT09Yi5yZWdpc3RlckE/aCgxKTpoKDApLHYoMCksNDtjYXNlIDYxOnJldHVybiBUKGIucmVnaXN0ZXJBLC0xKSxiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQS0xJjI1NSwwPT09Yi5yZWdpc3RlckE/aCgxKTpoKDApLHYoMSksNDtjYXNlIDYyOnJldHVybiBiLnJlZ2lzdGVyQT1HKCksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDYzOnJldHVybiB2KDApLEQoMCksMDxWKCk/dSgwKTp1KDEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gZmMoYSl7c3dpdGNoKGEpe2Nhc2UgNjQ6cmV0dXJuIDQ7Y2FzZSA2NTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckMsNDtjYXNlIDY2OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRCwKNDtjYXNlIDY3OnJldHVybiBiLnJlZ2lzdGVyQj1iLnJlZ2lzdGVyRSw0O2Nhc2UgNjg6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJILDQ7Y2FzZSA2OTpyZXR1cm4gYi5yZWdpc3RlckI9Yi5yZWdpc3RlckwsNDtjYXNlIDcwOnJldHVybiBiLnJlZ2lzdGVyQj1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgNzE6cmV0dXJuIGIucmVnaXN0ZXJCPWIucmVnaXN0ZXJBLDQ7Y2FzZSA3MjpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckIsNDtjYXNlIDczOnJldHVybiA0O2Nhc2UgNzQ6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJELDQ7Y2FzZSA3NTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckUsNDtjYXNlIDc2OnJldHVybiBiLnJlZ2lzdGVyQz1iLnJlZ2lzdGVySCw0O2Nhc2UgNzc6cmV0dXJuIGIucmVnaXN0ZXJDPWIucmVnaXN0ZXJMLDQ7Y2FzZSA3ODpyZXR1cm4gYi5yZWdpc3RlckM9SihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksCjQ7Y2FzZSA3OTpyZXR1cm4gYi5yZWdpc3RlckM9Yi5yZWdpc3RlckEsNH1yZXR1cm4tMX1mdW5jdGlvbiBnYyhhKXtzd2l0Y2goYSl7Y2FzZSA4MDpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckIsNDtjYXNlIDgxOnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQyw0O2Nhc2UgODI6cmV0dXJuIDQ7Y2FzZSA4MzpyZXR1cm4gYi5yZWdpc3RlckQ9Yi5yZWdpc3RlckUsNDtjYXNlIDg0OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVySCw0O2Nhc2UgODU6cmV0dXJuIGIucmVnaXN0ZXJEPWIucmVnaXN0ZXJMLDQ7Y2FzZSA4NjpyZXR1cm4gYi5yZWdpc3RlckQ9SihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDg3OnJldHVybiBiLnJlZ2lzdGVyRD1iLnJlZ2lzdGVyQSw0O2Nhc2UgODg6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJCLDQ7Y2FzZSA4OTpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckMsNDtjYXNlIDkwOnJldHVybiBiLnJlZ2lzdGVyRT0KYi5yZWdpc3RlckQsNDtjYXNlIDkxOnJldHVybiA0O2Nhc2UgOTI6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJILDQ7Y2FzZSA5MzpyZXR1cm4gYi5yZWdpc3RlckU9Yi5yZWdpc3RlckwsNDtjYXNlIDk0OnJldHVybiBiLnJlZ2lzdGVyRT1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgOTU6cmV0dXJuIGIucmVnaXN0ZXJFPWIucmVnaXN0ZXJBLDR9cmV0dXJuLTF9ZnVuY3Rpb24gaGMoYSl7c3dpdGNoKGEpe2Nhc2UgOTY6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJCLDQ7Y2FzZSA5NzpyZXR1cm4gYi5yZWdpc3Rlckg9Yi5yZWdpc3RlckMsNDtjYXNlIDk4OnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyRCw0O2Nhc2UgOTk6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJFLDQ7Y2FzZSAxMDA6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJILDQ7Y2FzZSAxMDE6cmV0dXJuIGIucmVnaXN0ZXJIPWIucmVnaXN0ZXJMLDQ7Y2FzZSAxMDI6cmV0dXJuIGIucmVnaXN0ZXJIPQpKKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTAzOnJldHVybiBiLnJlZ2lzdGVySD1iLnJlZ2lzdGVyQSw0O2Nhc2UgMTA0OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTA1OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQyw0O2Nhc2UgMTA2OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRCw0O2Nhc2UgMTA3OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyRSw0O2Nhc2UgMTA4OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVySCw0O2Nhc2UgMTA5OnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyTCw0O2Nhc2UgMTEwOnJldHVybiBiLnJlZ2lzdGVyTD1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSw0O2Nhc2UgMTExOnJldHVybiBiLnJlZ2lzdGVyTD1iLnJlZ2lzdGVyQSw0fXJldHVybi0xfWZ1bmN0aW9uIGljKGEpe3N3aXRjaChhKXtjYXNlIDExMjpyZXR1cm4gVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSwKYi5yZWdpc3RlckIpLDQ7Y2FzZSAxMTM6cmV0dXJuIFUocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMTQ6cmV0dXJuIFUocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMTU6cmV0dXJuIFUocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckUpLDQ7Y2FzZSAxMTY6cmV0dXJuIFUocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckgpLDQ7Y2FzZSAxMTc6cmV0dXJuIFUocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCksYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMTg6cmV0dXJuIGQuaXNIYmxhbmtIZG1hQWN0aXZlfHxiLmVuYWJsZUhhbHQoKSw0O2Nhc2UgMTE5OnJldHVybiBVKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTIwOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQiw0O2Nhc2UgMTIxOnJldHVybiBiLnJlZ2lzdGVyQT1iLnJlZ2lzdGVyQywKNDtjYXNlIDEyMjpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckQsNDtjYXNlIDEyMzpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckUsNDtjYXNlIDEyNDpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckgsNDtjYXNlIDEyNTpyZXR1cm4gYi5yZWdpc3RlckE9Yi5yZWdpc3RlckwsNDtjYXNlIDEyNjpyZXR1cm4gYi5yZWdpc3RlckE9SihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksNDtjYXNlIDEyNzpyZXR1cm4gNH1yZXR1cm4tMX1mdW5jdGlvbiBqYyhhKXtzd2l0Y2goYSl7Y2FzZSAxMjg6cmV0dXJuIGphKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTI5OnJldHVybiBqYShiLnJlZ2lzdGVyQyksNDtjYXNlIDEzMDpyZXR1cm4gamEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxMzE6cmV0dXJuIGphKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTMyOnJldHVybiBqYShiLnJlZ2lzdGVySCksNDtjYXNlIDEzMzpyZXR1cm4gamEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxMzQ6cmV0dXJuIGE9CkoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGphKGEpLDQ7Y2FzZSAxMzU6cmV0dXJuIGphKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTM2OnJldHVybiBrYShiLnJlZ2lzdGVyQiksNDtjYXNlIDEzNzpyZXR1cm4ga2EoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxMzg6cmV0dXJuIGthKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTM5OnJldHVybiBrYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE0MDpyZXR1cm4ga2EoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxNDE6cmV0dXJuIGthKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTQyOnJldHVybiBhPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLGthKGEpLDQ7Y2FzZSAxNDM6cmV0dXJuIGthKGIucmVnaXN0ZXJBKSw0fXJldHVybi0xfWZ1bmN0aW9uIGtjKGEpe3N3aXRjaChhKXtjYXNlIDE0NDpyZXR1cm4gbGEoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNDU6cmV0dXJuIGxhKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTQ2OnJldHVybiBsYShiLnJlZ2lzdGVyRCksNDsKY2FzZSAxNDc6cmV0dXJuIGxhKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTQ4OnJldHVybiBsYShiLnJlZ2lzdGVySCksNDtjYXNlIDE0OTpyZXR1cm4gbGEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTA6cmV0dXJuIGE9SihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksbGEoYSksNDtjYXNlIDE1MTpyZXR1cm4gbGEoYi5yZWdpc3RlckEpLDQ7Y2FzZSAxNTI6cmV0dXJuIG1hKGIucmVnaXN0ZXJCKSw0O2Nhc2UgMTUzOnJldHVybiBtYShiLnJlZ2lzdGVyQyksNDtjYXNlIDE1NDpyZXR1cm4gbWEoYi5yZWdpc3RlckQpLDQ7Y2FzZSAxNTU6cmV0dXJuIG1hKGIucmVnaXN0ZXJFKSw0O2Nhc2UgMTU2OnJldHVybiBtYShiLnJlZ2lzdGVySCksNDtjYXNlIDE1NzpyZXR1cm4gbWEoYi5yZWdpc3RlckwpLDQ7Y2FzZSAxNTg6cmV0dXJuIGE9SihyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSksbWEoYSksNDtjYXNlIDE1OTpyZXR1cm4gbWEoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gbGMoYSl7c3dpdGNoKGEpe2Nhc2UgMTYwOnJldHVybiBuYShiLnJlZ2lzdGVyQiksCjQ7Y2FzZSAxNjE6cmV0dXJuIG5hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTYyOnJldHVybiBuYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE2MzpyZXR1cm4gbmEoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNjQ6cmV0dXJuIG5hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTY1OnJldHVybiBuYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE2NjpyZXR1cm4gYT1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxuYShhKSw0O2Nhc2UgMTY3OnJldHVybiBuYShiLnJlZ2lzdGVyQSksNDtjYXNlIDE2ODpyZXR1cm4gb2EoYi5yZWdpc3RlckIpLDQ7Y2FzZSAxNjk6cmV0dXJuIG9hKGIucmVnaXN0ZXJDKSw0O2Nhc2UgMTcwOnJldHVybiBvYShiLnJlZ2lzdGVyRCksNDtjYXNlIDE3MTpyZXR1cm4gb2EoYi5yZWdpc3RlckUpLDQ7Y2FzZSAxNzI6cmV0dXJuIG9hKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTczOnJldHVybiBvYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE3NDpyZXR1cm4gYT1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSwKb2EoYSksNDtjYXNlIDE3NTpyZXR1cm4gb2EoYi5yZWdpc3RlckEpLDR9cmV0dXJuLTF9ZnVuY3Rpb24gbWMoYSl7c3dpdGNoKGEpe2Nhc2UgMTc2OnJldHVybiBwYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE3NzpyZXR1cm4gcGEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxNzg6cmV0dXJuIHBhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTc5OnJldHVybiBwYShiLnJlZ2lzdGVyRSksNDtjYXNlIDE4MDpyZXR1cm4gcGEoYi5yZWdpc3RlckgpLDQ7Y2FzZSAxODE6cmV0dXJuIHBhKGIucmVnaXN0ZXJMKSw0O2Nhc2UgMTgyOnJldHVybiBhPUoocihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLHBhKGEpLDQ7Y2FzZSAxODM6cmV0dXJuIHBhKGIucmVnaXN0ZXJBKSw0O2Nhc2UgMTg0OnJldHVybiBxYShiLnJlZ2lzdGVyQiksNDtjYXNlIDE4NTpyZXR1cm4gcWEoYi5yZWdpc3RlckMpLDQ7Y2FzZSAxODY6cmV0dXJuIHFhKGIucmVnaXN0ZXJEKSw0O2Nhc2UgMTg3OnJldHVybiBxYShiLnJlZ2lzdGVyRSksCjQ7Y2FzZSAxODg6cmV0dXJuIHFhKGIucmVnaXN0ZXJIKSw0O2Nhc2UgMTg5OnJldHVybiBxYShiLnJlZ2lzdGVyTCksNDtjYXNlIDE5MDpyZXR1cm4gYT1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKSxxYShhKSw0O2Nhc2UgMTkxOnJldHVybiBxYShiLnJlZ2lzdGVyQSksNH1yZXR1cm4tMX1mdW5jdGlvbiBuYyhhKXtzd2l0Y2goYSl7Y2FzZSAxOTI6cmV0dXJuIDA9PT1zYSgpPyhiLnByb2dyYW1Db3VudGVyPWZhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMTkzOnJldHVybiBhPWZhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LGIucmVnaXN0ZXJCPUYoYSksYi5yZWdpc3RlckM9YSYyNTUsNDtjYXNlIDE5NDppZigwPT09c2EoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1aKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTsKcmV0dXJuIDEyO2Nhc2UgMTk1OnJldHVybiBiLnByb2dyYW1Db3VudGVyPVooKSw4O2Nhc2UgMTk2OmlmKDA9PT1zYSgpKXJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVooKSw4O2IucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisyJjY1NTM1O3JldHVybiAxMjtjYXNlIDE5NzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLHIoYi5yZWdpc3RlckIsYi5yZWdpc3RlckMpKSw4O2Nhc2UgMTk4OnJldHVybiBqYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAxOTk6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPQowLDg7Y2FzZSAyMDA6cmV0dXJuIDE9PT1zYSgpPyhiLnByb2dyYW1Db3VudGVyPWZhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDEyKTo4O2Nhc2UgMjAxOnJldHVybiBiLnByb2dyYW1Db3VudGVyPWZhKGIuc3RhY2tQb2ludGVyKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcisyJjY1NTM1LDg7Y2FzZSAyMDI6aWYoMT09PXNhKCkpcmV0dXJuIGIucHJvZ3JhbUNvdW50ZXI9WigpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjAzOnZhciBjPUcoKTthPS0xO3ZhciBlPSExLGQ9MCxtPTAsZj1jJTg7c3dpdGNoKGYpe2Nhc2UgMDpkPWIucmVnaXN0ZXJCO2JyZWFrO2Nhc2UgMTpkPWIucmVnaXN0ZXJDO2JyZWFrO2Nhc2UgMjpkPWIucmVnaXN0ZXJEO2JyZWFrO2Nhc2UgMzpkPWIucmVnaXN0ZXJFO2JyZWFrO2Nhc2UgNDpkPWIucmVnaXN0ZXJIO2JyZWFrO2Nhc2UgNTpkPQpiLnJlZ2lzdGVyTDticmVhaztjYXNlIDY6ZD1KKHIoYi5yZWdpc3RlckgsYi5yZWdpc3RlckwpKTticmVhaztjYXNlIDc6ZD1iLnJlZ2lzdGVyQX12YXIgZz0oYyYyNDApPj40O3N3aXRjaChnKXtjYXNlIDA6Nz49Yz8oYz1kLDEyOD09PShjJjEyOCk/dSgxKTp1KDApLGM9KGM8PDF8Yz4+NykmMjU1LDA9PT1jP2goMSk6aCgwKSx2KDApLEQoMCksbT1jLGU9ITApOjE1Pj1jJiYoYz1kLDA8KGMmMSk/dSgxKTp1KDApLGM9KGM+PjF8Yzw8NykmMjU1LDA9PT1jP2goMSk6aCgwKSx2KDApLEQoMCksbT1jLGU9ITApO2JyZWFrO2Nhc2UgMToyMz49Yz8oYz1kLGU9ITEsMTI4PT09KGMmMTI4KSYmKGU9ITApLGM9KGM8PDF8VigpKSYyNTUsZT91KDEpOnUoMCksMD09PWM/aCgxKTpoKDApLHYoMCksRCgwKSxtPWMsZT0hMCk6MzE+PWMmJihjPWQsZT0hMSwxPT09KGMmMSkmJihlPSEwKSxjPShjPj4xfFYoKTw8NykmMjU1LGU/dSgxKTp1KDApLDA9PT1jP2goMSk6aCgwKSx2KDApLEQoMCksbT0KYyxlPSEwKTticmVhaztjYXNlIDI6Mzk+PWM/KGM9ZCxlPSExLDEyOD09PShjJjEyOCkmJihlPSEwKSxjPWM8PDEmMjU1LGU/dSgxKTp1KDApLDA9PT1jP2goMSk6aCgwKSx2KDApLEQoMCksbT1jLGU9ITApOjQ3Pj1jJiYoYz1kLGU9ITEsMTI4PT09KGMmMTI4KSYmKGU9ITApLGQ9ITEsMT09PShjJjEpJiYoZD0hMCksYz1jPj4xJjI1NSxlJiYoY3w9MTI4KSwwPT09Yz9oKDEpOmgoMCksdigwKSxEKDApLGQ/dSgxKTp1KDApLG09YyxlPSEwKTticmVhaztjYXNlIDM6NTU+PWM/KGM9ZCxjPSgoYyYxNSk8PDR8KGMmMjQwKT4+NCkmMjU1LDA9PT1jP2goMSk6aCgwKSx2KDApLEQoMCksdSgwKSxtPWMsZT0hMCk6NjM+PWMmJihjPWQsZT0hMSwxPT09KGMmMSkmJihlPSEwKSxjPWM+PjEmMjU1LDA9PT1jP2goMSk6aCgwKSx2KDApLEQoMCksZT91KDEpOnUoMCksbT1jLGU9ITApO2JyZWFrO2Nhc2UgNDo3MT49Yz8obT11YSgwLGQpLGU9ITApOjc5Pj1jJiYobT11YSgxLGQpLGU9ITApO2JyZWFrOwpjYXNlIDU6ODc+PWM/KG09dWEoMixkKSxlPSEwKTo5NT49YyYmKG09dWEoMyxkKSxlPSEwKTticmVhaztjYXNlIDY6MTAzPj1jPyhtPXVhKDQsZCksZT0hMCk6MTExPj1jJiYobT11YSg1LGQpLGU9ITApO2JyZWFrO2Nhc2UgNzoxMTk+PWM/KG09dWEoNixkKSxlPSEwKToxMjc+PWMmJihtPXVhKDcsZCksZT0hMCk7YnJlYWs7Y2FzZSA4OjEzNT49Yz8obT1hYSgwLDAsZCksZT0hMCk6MTQzPj1jJiYobT1hYSgxLDAsZCksZT0hMCk7YnJlYWs7Y2FzZSA5OjE1MT49Yz8obT1hYSgyLDAsZCksZT0hMCk6MTU5Pj1jJiYobT1hYSgzLDAsZCksZT0hMCk7YnJlYWs7Y2FzZSAxMDoxNjc+PWM/KG09YWEoNCwwLGQpLGU9ITApOjE3NT49YyYmKG09YWEoNSwwLGQpLGU9ITApO2JyZWFrO2Nhc2UgMTE6MTgzPj1jPyhtPWFhKDYsMCxkKSxlPSEwKToxOTE+PWMmJihtPWFhKDcsMCxkKSxlPSEwKTticmVhaztjYXNlIDEyOjE5OT49Yz8obT1hYSgwLDEsZCksZT0hMCk6MjA3Pj1jJiYobT1hYSgxLDEsCmQpLGU9ITApO2JyZWFrO2Nhc2UgMTM6MjE1Pj1jPyhtPWFhKDIsMSxkKSxlPSEwKToyMjM+PWMmJihtPWFhKDMsMSxkKSxlPSEwKTticmVhaztjYXNlIDE0OjIzMT49Yz8obT1hYSg0LDEsZCksZT0hMCk6MjM5Pj1jJiYobT1hYSg1LDEsZCksZT0hMCk7YnJlYWs7Y2FzZSAxNToyNDc+PWM/KG09YWEoNiwxLGQpLGU9ITApOjI1NT49YyYmKG09YWEoNywxLGQpLGU9ITApfXN3aXRjaChmKXtjYXNlIDA6Yi5yZWdpc3RlckI9bTticmVhaztjYXNlIDE6Yi5yZWdpc3RlckM9bTticmVhaztjYXNlIDI6Yi5yZWdpc3RlckQ9bTticmVhaztjYXNlIDM6Yi5yZWdpc3RlckU9bTticmVhaztjYXNlIDQ6Yi5yZWdpc3Rlckg9bTticmVhaztjYXNlIDU6Yi5yZWdpc3Rlckw9bTticmVhaztjYXNlIDY6KDQ+Z3x8NzxnKSYmVShyKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSxtKTticmVhaztjYXNlIDc6Yi5yZWdpc3RlckE9bX1lJiYoYT00KTtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrCjEmNjU1MzU7cmV0dXJuIGE7Y2FzZSAyMDQ6aWYoMT09PXNhKCkpcmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKzIpLGIucHJvZ3JhbUNvdW50ZXI9WigpLDg7Yi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzU7cmV0dXJuIDEyO2Nhc2UgMjA1OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlcisyJjY1NTM1KSxiLnByb2dyYW1Db3VudGVyPVooKSw4O2Nhc2UgMjA2OnJldHVybiBrYShHKCkpLGIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMDc6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixiLnByb2dyYW1Db3VudGVyKSxiLnByb2dyYW1Db3VudGVyPTh9cmV0dXJuLTF9ZnVuY3Rpb24gb2MoYSl7c3dpdGNoKGEpe2Nhc2UgMjA4OnJldHVybiAwPT09ClYoKT8oYi5wcm9ncmFtQ291bnRlcj1mYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxMik6ODtjYXNlIDIwOTpyZXR1cm4gYT1mYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSxiLnJlZ2lzdGVyRD1GKGEpLGIucmVnaXN0ZXJFPWEmMjU1LDQ7Y2FzZSAyMTA6aWYoMD09PVYoKSlyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1aKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMTI6aWYoMD09PVYoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiksYi5wcm9ncmFtQ291bnRlcj1aKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMTM6cmV0dXJuIGIuc3RhY2tQb2ludGVyPQpiLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIscihiLnJlZ2lzdGVyRCxiLnJlZ2lzdGVyRSkpLDg7Y2FzZSAyMTQ6cmV0dXJuIGxhKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIxNTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MTYsODtjYXNlIDIxNjpyZXR1cm4gMT09PVYoKT8oYi5wcm9ncmFtQ291bnRlcj1mYShiLnN0YWNrUG9pbnRlciksYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXIrMiY2NTUzNSwxMik6ODtjYXNlIDIxNzpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1mYShiLnN0YWNrUG9pbnRlciksWWEoITApLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsODtjYXNlIDIxODppZigxPT09VigpKXJldHVybiBiLnByb2dyYW1Db3VudGVyPVooKSwKODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjA6aWYoMT09PVYoKSlyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNSksYi5wcm9ncmFtQ291bnRlcj1aKCksODtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMiY2NTUzNTtyZXR1cm4gMTI7Y2FzZSAyMjI6cmV0dXJuIG1hKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIyMzpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MjQsOH1yZXR1cm4tMX1mdW5jdGlvbiBwYyhhKXtzd2l0Y2goYSl7Y2FzZSAyMjQ6cmV0dXJuIGE9RygpLFUoNjUyODArYSxiLnJlZ2lzdGVyQSksYi5wcm9ncmFtQ291bnRlcj0KYi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyMjU6cmV0dXJuIGE9ZmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3Rlckg9RihhKSxiLnJlZ2lzdGVyTD1hJjI1NSw0O2Nhc2UgMjI2OnJldHVybiBVKDY1MjgwK2IucmVnaXN0ZXJDLGIucmVnaXN0ZXJBKSw0O2Nhc2UgMjI5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIscihiLnJlZ2lzdGVySCxiLnJlZ2lzdGVyTCkpLDg7Y2FzZSAyMzA6cmV0dXJuIG5hKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDIzMTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9MzIsODtjYXNlIDIzMjpyZXR1cm4gYT1lYihHKCkpLHdhKGIuc3RhY2tQb2ludGVyLAphLCEwKSxiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlcithJjY1NTM1LGgoMCksdigwKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSwxMjtjYXNlIDIzMzpyZXR1cm4gYi5wcm9ncmFtQ291bnRlcj1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSw0O2Nhc2UgMjM0OnJldHVybiBVKFooKSxiLnJlZ2lzdGVyQSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDIzODpyZXR1cm4gb2EoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjM5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj00MCw4fXJldHVybi0xfWZ1bmN0aW9uIHFjKGEpe3N3aXRjaChhKXtjYXNlIDI0MDpyZXR1cm4gYT1HKCksYi5yZWdpc3RlckE9Sig2NTI4MCthKSYyNTUsCmIucHJvZ3JhbUNvdW50ZXI9Yi5wcm9ncmFtQ291bnRlcisxJjY1NTM1LDQ7Y2FzZSAyNDE6cmV0dXJuIGE9ZmEoYi5zdGFja1BvaW50ZXIpLGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyKzImNjU1MzUsYi5yZWdpc3RlckE9RihhKSxiLnJlZ2lzdGVyRj1hJjI1NSw0O2Nhc2UgMjQyOnJldHVybiBiLnJlZ2lzdGVyQT1KKDY1MjgwK2IucmVnaXN0ZXJDKSYyNTUsNDtjYXNlIDI0MzpyZXR1cm4gWWEoITEpLDQ7Y2FzZSAyNDU6cmV0dXJuIGIuc3RhY2tQb2ludGVyPWIuc3RhY2tQb2ludGVyLTImNjU1MzUsVyhiLnN0YWNrUG9pbnRlcixyKGIucmVnaXN0ZXJBLGIucmVnaXN0ZXJGKSksODtjYXNlIDI0NjpyZXR1cm4gcGEoRygpKSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw0O2Nhc2UgMjQ3OnJldHVybiBiLnN0YWNrUG9pbnRlcj1iLnN0YWNrUG9pbnRlci0yJjY1NTM1LFcoYi5zdGFja1BvaW50ZXIsYi5wcm9ncmFtQ291bnRlciksYi5wcm9ncmFtQ291bnRlcj0KNDgsODtjYXNlIDI0ODpyZXR1cm4gYT1lYihHKCkpLGgoMCksdigwKSx3YShiLnN0YWNrUG9pbnRlcixhLCEwKSxhPWIuc3RhY2tQb2ludGVyK2EmNjU1MzUsYi5yZWdpc3Rlckg9RihhKSxiLnJlZ2lzdGVyTD1hJjI1NSxiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXIrMSY2NTUzNSw4O2Nhc2UgMjQ5OnJldHVybiBiLnN0YWNrUG9pbnRlcj1yKGIucmVnaXN0ZXJILGIucmVnaXN0ZXJMKSw4O2Nhc2UgMjUwOnJldHVybiBiLnJlZ2lzdGVyQT1KKFooKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzImNjU1MzUsNDtjYXNlIDI1MTpyZXR1cm4gWWEoITApLDQ7Y2FzZSAyNTQ6cmV0dXJuIHFhKEcoKSksYi5wcm9ncmFtQ291bnRlcj1iLnByb2dyYW1Db3VudGVyKzEmNjU1MzUsNDtjYXNlIDI1NTpyZXR1cm4gYi5zdGFja1BvaW50ZXI9Yi5zdGFja1BvaW50ZXItMiY2NTUzNSxXKGIuc3RhY2tQb2ludGVyLGIucHJvZ3JhbUNvdW50ZXIpLGIucHJvZ3JhbUNvdW50ZXI9CjU2LDh9cmV0dXJuLTF9ZnVuY3Rpb24gcmEoYSl7MDxkLkRNQUN5Y2xlcyYmKGErPWQuRE1BQ3ljbGVzLGQuRE1BQ3ljbGVzPTApO2IuY3VycmVudEN5Y2xlcys9YTtpZighYi5pc1N0b3BwZWQpe2lmKFEuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmcpe2lmKHQuY3VycmVudEN5Y2xlcys9YSwhKHQuY3VycmVudEN5Y2xlczx0LmJhdGNoUHJvY2Vzc0N5Y2xlcygpKSlmb3IoO3QuY3VycmVudEN5Y2xlcz49dC5iYXRjaFByb2Nlc3NDeWNsZXMoKTspUWIodC5iYXRjaFByb2Nlc3NDeWNsZXMoKSksdC5jdXJyZW50Q3ljbGVzLT10LmJhdGNoUHJvY2Vzc0N5Y2xlcygpfWVsc2UgUWIoYSk7US5hdWRpb0JhdGNoUHJvY2Vzc2luZz9mLmN1cnJlbnRDeWNsZXMrPWE6SWIoYSk7dmFyIGM9YTtpZihNLnRyYW5zZmVyU3RhcnRGbGFnKWZvcih2YXIgZT0wO2U8Yzspe3ZhciB3PU0uY3VycmVudEN5Y2xlcztlKz00O00uY3VycmVudEN5Y2xlcys9NDs2NTUzNTxNLmN1cnJlbnRDeWNsZXMmJihNLmN1cnJlbnRDeWNsZXMtPQo2NTUzNik7dmFyIG09TS5jdXJyZW50Q3ljbGVzO3ZhciBrPU0uaXNDbG9ja1NwZWVkRmFzdD8yOjc7cShrLHcpJiYhcShrLG0pJiYodz15KE0ubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckRhdGEpLHc9KHc8PDEpKzEsdyY9MjU1LGcoTS5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyRGF0YSx3KSxNLm51bWJlck9mQml0c1RyYW5zZmVycmVkKz0xLDg9PT1NLm51bWJlck9mQml0c1RyYW5zZmVycmVkJiYoTS5udW1iZXJPZkJpdHNUcmFuc2ZlcnJlZD0wLHAuaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITAsQWEocC5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdCksdz15KE0ubWVtb3J5TG9jYXRpb25TZXJpYWxUcmFuc2ZlckNvbnRyb2wpLGcoTS5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyQ29udHJvbCxIKDcsdykpLE0udHJhbnNmZXJTdGFydEZsYWc9ITEpKX19US50aW1lcnNCYXRjaFByb2Nlc3Npbmc/KG4uY3VycmVudEN5Y2xlcys9YSxvYihuLmN1cnJlbnRDeWNsZXMpLApuLmN1cnJlbnRDeWNsZXM9MCk6b2IoYSk7WC5jeWNsZXMrPWE7WC5jeWNsZXM+PVguY3ljbGVzUGVyQ3ljbGVTZXQmJihYLmN5Y2xlU2V0cys9MSxYLmN5Y2xlcy09WC5jeWNsZXNQZXJDeWNsZVNldCl9ZnVuY3Rpb24gdmIoKXtyZXR1cm4gTGEoITAsLTEsLTEpfWZ1bmN0aW9uIExhKGEsYyxlKXt2b2lkIDA9PT1jJiYoYz0tMSk7dm9pZCAwPT09ZSYmKGU9LTEpO2E9MTAyNDswPGM/YT1jOjA+YyYmKGE9LTEpO2Zvcih2YXIgZD0hMSxtPSExLGY9ITEsZz0hMTshKGR8fG18fGZ8fGcpOyljPXdiKCksMD5jP2Q9ITA6Yi5jdXJyZW50Q3ljbGVzPj1iLk1BWF9DWUNMRVNfUEVSX0ZSQU1FKCk/bT0hMDotMTxhJiZtYigpPj1hP2Y9ITA6LTE8ZSYmYi5wcm9ncmFtQ291bnRlcj09PWUmJihnPSEwKTtpZihtKXJldHVybiBiLmN1cnJlbnRDeWNsZXMtPWIuTUFYX0NZQ0xFU19QRVJfRlJBTUUoKSxQLlJFU1BPTlNFX0NPTkRJVElPTl9GUkFNRTtpZihmKXJldHVybiBQLlJFU1BPTlNFX0NPTkRJVElPTl9BVURJTzsKaWYoZylyZXR1cm4gUC5SRVNQT05TRV9DT05ESVRJT05fQlJFQUtQT0lOVDtiLnByb2dyYW1Db3VudGVyPWIucHJvZ3JhbUNvdW50ZXItMSY2NTUzNTtyZXR1cm4tMX1mdW5jdGlvbiB3Yigpe01hPSEwO2lmKGIuaXNIYWx0QnVnKXt2YXIgYT15KGIucHJvZ3JhbUNvdW50ZXIpO2E9UmIoYSk7cmEoYSk7Yi5leGl0SGFsdEFuZFN0b3AoKX1wLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5JiYocC5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2g9ITAscC5tYXN0ZXJJbnRlcnJ1cHRTd2l0Y2hEZWxheT0hMSk7aWYoMDwocC5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJnAuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlJjMxKSl7YT0hMTtwLm1hc3RlckludGVycnVwdFN3aXRjaCYmIWIuaXNIYWx0Tm9KdW1wJiYocC5pc1ZCbGFua0ludGVycnVwdEVuYWJsZWQmJnAuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ/KEhhKHAuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQpLGE9ITApOnAuaXNMY2RJbnRlcnJ1cHRFbmFibGVkJiYKcC5pc0xjZEludGVycnVwdFJlcXVlc3RlZD8oSGEocC5iaXRQb3NpdGlvbkxjZEludGVycnVwdCksYT0hMCk6cC5pc1RpbWVySW50ZXJydXB0RW5hYmxlZCYmcC5pc1RpbWVySW50ZXJydXB0UmVxdWVzdGVkPyhIYShwLmJpdFBvc2l0aW9uVGltZXJJbnRlcnJ1cHQpLGE9ITApOnAuaXNTZXJpYWxJbnRlcnJ1cHRFbmFibGVkJiZwLmlzU2VyaWFsSW50ZXJydXB0UmVxdWVzdGVkPyhIYShwLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0KSxhPSEwKTpwLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZCYmcC5pc0pveXBhZEludGVycnVwdFJlcXVlc3RlZCYmKEhhKHAuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQpLGE9ITApKTt2YXIgYz0wO2EmJihjPTIwLGIuaXNIYWx0ZWQoKSYmKGIuZXhpdEhhbHRBbmRTdG9wKCksYys9NCkpO2IuaXNIYWx0ZWQoKSYmYi5leGl0SGFsdEFuZFN0b3AoKTthPWN9ZWxzZSBhPTA7MDxhJiZyYShhKTthPTQ7Yi5pc0hhbHRlZCgpfHxiLmlzU3RvcHBlZHx8CihhPXkoYi5wcm9ncmFtQ291bnRlciksYT1SYihhKSk7Yi5yZWdpc3RlckYmPTI0MDtpZigwPj1hKXJldHVybiBhO3JhKGEpO1Auc3RlcHMrPTE7UC5zdGVwcz49UC5zdGVwc1BlclN0ZXBTZXQmJihQLnN0ZXBTZXRzKz0xLFAuc3RlcHMtPVAuc3RlcHNQZXJTdGVwU2V0KTtyZXR1cm4gYX1mdW5jdGlvbiByYyhhKXtjb25zdCBiPSJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpO2Zvcig7YS5mcHNUaW1lU3RhbXBzWzBdPGItMUUzOylhLmZwc1RpbWVTdGFtcHMuc2hpZnQoKTthLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB4YihhKXthLnRpbWVTdGFtcHNVbnRpbFJlYWR5PTkwPj1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZT8xLjI1Kk1hdGguZmxvb3IoYS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUpOgoxMjB9ZnVuY3Rpb24gU2IoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKE4oe3R5cGU6ei5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gVGIoYSl7dmFyIGI9KCJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPVViLWI7MD5iJiYoYj0wKTthLnNwZWVkJiYwPGEuc3BlZWQmJihiLz1hLnNwZWVkKTthLnVwZGF0ZUlkPXNldFRpbWVvdXQoKCk9PntWYihhKX0sTWF0aC5mbG9vcihiKSl9ZnVuY3Rpb24gVmIoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDsKdm9pZCAwIT09YiYmKFViPWIpO05hPWEuZ2V0RlBTKCk7YWI9YS5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUrMTthLnNwZWVkJiYwPGEuc3BlZWQmJihhYio9YS5zcGVlZCk7aWYoTmE+YWIpcmV0dXJuIGEuZnBzVGltZVN0YW1wcy5zaGlmdCgpLFRiKGEpLCEwO3JjKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZTtjP3liKGEsYik6KGU9dm9pZCAwIT09YS5icmVha3BvaW50P2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lVW50aWxCcmVha3BvaW50KGEuYnJlYWtwb2ludCk6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWUoKSxiKGUpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2JhKE4oe3R5cGU6ei5VUERBVEVELGZwczpOYX0pKTtsZXQgYz0hMTthLm9wdGlvbnMuZnJhbWVTa2lwJiYwPGEub3B0aW9ucy5mcmFtZVNraXAmJgooYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fFNiKGEpO2NvbnN0IGU9e3R5cGU6ei5VUERBVEVEfTtlW0UuQ0FSVFJJREdFX1JBTV09Q2IoYSkuYnVmZmVyO2VbRS5HQU1FQk9ZX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXI7ZVtFLlBBTEVUVEVfTUVNT1JZXT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX1NJWkUpLmJ1ZmZlcjtlW0UuSU5URVJOQUxfU1RBVEVdPURiKGEpLmJ1ZmZlcjtPYmplY3Qua2V5cyhlKS5mb3JFYWNoKChhKT0+Cnt2b2lkIDA9PT1lW2FdJiYoZVthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoTihlKSxbZVtFLkNBUlRSSURHRV9SQU1dLGVbRS5HQU1FQk9ZX01FTU9SWV0sZVtFLlBBTEVUVEVfTUVNT1JZXSxlW0UuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/YmEoTih7dHlwZTp6LkJSRUFLUE9JTlR9KSk6VGIoYSl9ZWxzZSBiYShOKHt0eXBlOnouQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHliKGEsYil7dmFyIGM9LTE7Yz12b2lkIDAhPT1hLmJyZWFrcG9pbnQ/YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5leGVjdXRlRnJhbWVBbmRDaGVja0F1ZGlvVW50aWxCcmVha3BvaW50KDEwMjQsYS5icmVha3BvaW50KTphLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW8oMTAyNCk7MSE9PWMmJmIoYyk7aWYoMT09PWMpe2M9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5nZXRBdWRpb1F1ZXVlSW5kZXgoKTsKY29uc3QgZT1OYT49YWI7LjI1PGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcyYmZT8oV2IoYSxjKSxzZXRUaW1lb3V0KCgpPT57eGIoYSk7eWIoYSxiKX0sTWF0aC5mbG9vcihNYXRoLmZsb29yKDFFMyooYS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzLS4yNSkpLzEwKSkpOihXYihhLGMpLHliKGEsYikpfX1mdW5jdGlvbiBXYihhLGIpe3ZhciBjPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfU09VTkRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2NvbnN0IGQ9e3R5cGU6ei5VUERBVEVELGF1ZGlvQnVmZmVyOmMsbnVtYmVyT2ZTYW1wbGVzOmIsZnBzOk5hLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07Yz1bY107aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBmPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2QuY2hhbm5lbDFCdWZmZXI9ZjtjLnB1c2goZik7Zj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2QuY2hhbm5lbDJCdWZmZXI9ZjtjLnB1c2goZik7Zj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2QuY2hhbm5lbDNCdWZmZXI9ZjtjLnB1c2goZik7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2QuY2hhbm5lbDRCdWZmZXI9YjtjLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoTihkKSwKYyk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5yZXNldEF1ZGlvUXVldWUoKX1jb25zdCBRYT0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCBkYjtRYXx8KGRiPXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3Qgej17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixQTEFZX1VOVElMX0JSRUFLUE9JTlQ6IlBMQVlfVU5USUxfQlJFQUtQT0lOVCIsCkJSRUFLUE9JTlQ6IkJSRUFLUE9JTlQiLFBBVVNFOiJQQVVTRSIsVVBEQVRFRDoiVVBEQVRFRCIsQ1JBU0hFRDoiQ1JBU0hFRCIsU0VUX0pPWVBBRF9TVEFURToiU0VUX0pPWVBBRF9TVEFURSIsQVVESU9fTEFURU5DWToiQVVESU9fTEFURU5DWSIsUlVOX1dBU01fRVhQT1JUOiJSVU5fV0FTTV9FWFBPUlQiLEdFVF9XQVNNX01FTU9SWV9TRUNUSU9OOiJHRVRfV0FTTV9NRU1PUllfU0VDVElPTiIsR0VUX1dBU01fQ09OU1RBTlQ6IkdFVF9XQVNNX0NPTlNUQU5UIixGT1JDRV9PVVRQVVRfRlJBTUU6IkZPUkNFX09VVFBVVF9GUkFNRSIsU0VUX1NQRUVEOiJTRVRfU1BFRUQiLElTX0dCQzoiSVNfR0JDIn0sRT17Q0FSVFJJREdFX1JBTToiQ0FSVFJJREdFX1JBTSIsQ0FSVFJJREdFX1JPTToiQ0FSVFJJREdFX1JPTSIsQ0FSVFJJREdFX0hFQURFUjoiQ0FSVFJJREdFX0hFQURFUiIsR0FNRUJPWV9NRU1PUlk6IkdBTUVCT1lfTUVNT1JZIixQQUxFVFRFX01FTU9SWToiUEFMRVRURV9NRU1PUlkiLApJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTtsZXQgUmE9MDtjb25zdCBrPW5ldyBVaW50OENsYW1wZWRBcnJheSg5MTA5NTA0KSxPYT17c2l6ZTooKT0+OTEwOTUwNCxncm93OigpPT57fSx3YXNtQnl0ZU1lbW9yeTprfTt2YXIgQmE9OTEyNjQsUGE9QmErOTMxODQsYmI9UGErMTk2NjA4LGNiPWJiKzE0NzQ1NixOYj1jYi02NzU4NCsxNTM2MCxpYj1jYisxNTM2MCxqYj1pYisxMzEwNzIsa2I9amIrMTMxMDcyLGxiPWtiKzEzMTA3MixHYT1sYisxMzEwNzIsJGE9R2ErMTMxMDcyLEphPSRhKzEzMTA3Mix6Yj1KYSs4MjU4NTYwLEFiPXpiKzY1NTM1KzEsQmI9TWF0aC5jZWlsKEFiLzEwMjQvNjQpKzEsUT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5lbmFibGVCb290Um9tPSExO2EudXNlR2JjV2hlbkF2YWlsYWJsZT0hMDthLmF1ZGlvQmF0Y2hQcm9jZXNzaW5nPSExO2EuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmc9ITE7YS50aW1lcnNCYXRjaFByb2Nlc3Npbmc9ITE7YS5ncmFwaGljc0Rpc2FibGVTY2FubGluZVJlbmRlcmluZz0KITE7YS5hdWRpb0FjY3VtdWxhdGVTYW1wbGVzPSExO2EudGlsZVJlbmRlcmluZz0hMTthLnRpbGVDYWNoaW5nPSExO2EuZW5hYmxlQXVkaW9EZWJ1Z2dpbmc9ITE7cmV0dXJuIGF9KCksSWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZUluZGV4PTY1Mzg0O2EubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZURhdGE9NjUzODU7YS5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVJbmRleD02NTM4NjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZURhdGE9NjUzODc7cmV0dXJuIGF9KCksaWE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudGlsZUlkPS0xO2EuaG9yaXpvbnRhbEZsaXA9ITE7YS5uZXh0WEluZGV4VG9QZXJmb3JtQ2FjaGVDaGVjaz0tMTtyZXR1cm4gYX0oKSxBPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYil7YS5OUngwU3dlZXBQZXJpb2Q9KGImMTEyKT4+CjQ7YS5OUngwTmVnYXRlPXEoMyxiKTthLk5SeDBTd2VlcFNoaWZ0PWImN307YS51cGRhdGVOUngxPWZ1bmN0aW9uKGIpe2EuTlJ4MUR1dHk9Yj4+NiYzO2EuTlJ4MUxlbmd0aExvYWQ9YiY2MzthLmxlbmd0aENvdW50ZXI9NjQtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWI+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPXEoMyxiKTthLk5SeDJFbnZlbG9wZVBlcmlvZD1iJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYiYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9cSg2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07CmEuc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7UigxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzRW5hYmxlZCk7a1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5mcmVxdWVuY3lUaW1lcjtrWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmVudmVsb3BlQ291bnRlcjtrWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7a1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS52b2x1bWU7a1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kdXR5Q3ljbGU7a1sxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5O1IoMTA0OSs1MCphLnNhdmVTdGF0ZVNsb3QsYS5pc1N3ZWVwRW5hYmxlZCk7a1sxMDUwKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcENvdW50ZXI7a1sxMDU1KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD1TKDEwMjQrNTAqCmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1rWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1rWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9a1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9a1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kdXR5Q3ljbGU9a1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PWtbMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNTd2VlcEVuYWJsZWQ9UygxMDQ5KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5zd2VlcENvdW50ZXI9a1sxMDUwKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zd2VlcFNoYWRvd0ZyZXF1ZW5jeT1rWzEwNTUrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjgpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDEsMTkxKTtnKGEubWVtb3J5TG9jYXRpb25OUngyLAoyNDMpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDMsMTkzKTtnKGEubWVtb3J5TG9jYXRpb25OUng0LDE5MSl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLnJlc2V0VGltZXI9ZnVuY3Rpb24oKXthLmZyZXF1ZW5jeVRpbWVyPTQqKDIwNDgtYS5mcmVxdWVuY3kpO2IuR0JDRG91YmxlU3BlZWQmJihhLmZyZXF1ZW5jeVRpbWVyKj0yKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSs9MSw4PD1hLndhdmVGb3JtUG9zaXRpb25PbkR1dHkmJihhLndhdmVGb3JtUG9zaXRpb25PbkR1dHk9MCkpO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZCliPQphLnZvbHVtZTtlbHNlIHJldHVybiAxNTt2YXIgYz0xO0ZiKGEuTlJ4MUR1dHksYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5KXx8KGMqPS0xKTtyZXR1cm4gYypiKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLnJlc2V0VGltZXIoKTthLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLnN3ZWVwU2hhZG93RnJlcXVlbmN5PWEuZnJlcXVlbmN5O2Euc3dlZXBDb3VudGVyPWEuTlJ4MFN3ZWVwUGVyaW9kO2EuaXNTd2VlcEVuYWJsZWQ9MDxhLk5SeDBTd2VlcFBlcmlvZCYmMDxhLk5SeDBTd2VlcFNoaWZ0PyEwOiExOzA8YS5OUngwU3dlZXBTaGlmdCYmR2IoKTthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDwKYS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcj8hMTohMH07YS51cGRhdGVTd2VlcD1mdW5jdGlvbigpey0tYS5zd2VlcENvdW50ZXI7MD49YS5zd2VlcENvdW50ZXImJihhLnN3ZWVwQ291bnRlcj1hLk5SeDBTd2VlcFBlcmlvZCxhLmlzU3dlZXBFbmFibGVkJiYwPGEuTlJ4MFN3ZWVwUGVyaW9kJiZHYigpKX07YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPSExKX07YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpey0tYS5lbnZlbG9wZUNvdW50ZXI7MD49YS5lbnZlbG9wZUNvdW50ZXImJihhLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YS5lbnZlbG9wZUNvdW50ZXImJihhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJgowPGEudm9sdW1lJiYtLWEudm9sdW1lKSl9O2Euc2V0RnJlcXVlbmN5PWZ1bmN0aW9uKGIpe3ZhciBjPWI+Pjg7YiY9MjU1O3ZhciBkPXkoYS5tZW1vcnlMb2NhdGlvbk5SeDQpJjI0OHxjO2coYS5tZW1vcnlMb2NhdGlvbk5SeDMsYik7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4NCxkKTthLk5SeDNGcmVxdWVuY3lMU0I9YjthLk5SeDRGcmVxdWVuY3lNU0I9YzthLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngwPTY1Mjk2O2EuTlJ4MFN3ZWVwUGVyaW9kPTA7YS5OUngwTmVnYXRlPSExO2EuTlJ4MFN3ZWVwU2hpZnQ9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTI5NzthLk5SeDFEdXR5PTA7YS5OUngxTGVuZ3RoTG9hZD0wO2EubWVtb3J5TG9jYXRpb25OUngyPTY1Mjk4O2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPTA7YS5OUngyRW52ZWxvcGVBZGRNb2RlPSExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPQowO2EubWVtb3J5TG9jYXRpb25OUngzPTY1Mjk5O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzAwO2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5jaGFubmVsTnVtYmVyPTE7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPTA7YS5lbnZlbG9wZUNvdW50ZXI9MDthLmxlbmd0aENvdW50ZXI9MDthLnZvbHVtZT0wO2EuZHV0eUN5Y2xlPTA7YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PTA7YS5pc1N3ZWVwRW5hYmxlZD0hMTthLnN3ZWVwQ291bnRlcj0wO2Euc3dlZXBTaGFkb3dGcmVxdWVuY3k9MDthLnNhdmVTdGF0ZVNsb3Q9NztyZXR1cm4gYX0oKSxLPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxRHV0eT1iPj42JjM7YS5OUngxTGVuZ3RoTG9hZD1iJjYzO2EubGVuZ3RoQ291bnRlcj02NC1hLk5SeDFMZW5ndGhMb2FkfTsKYS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWI+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPXEoMyxiKTthLk5SeDJFbnZlbG9wZVBlcmlvZD1iJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYiYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzRnJlcXVlbmN5TFNCPWI7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS51cGRhdGVOUng0PWZ1bmN0aW9uKGIpe2EuTlJ4NExlbmd0aEVuYWJsZWQ9cSg2LGIpO2EuTlJ4NEZyZXF1ZW5jeU1TQj1iJjc7YS5mcmVxdWVuY3k9YS5OUng0RnJlcXVlbmN5TVNCPDw4fGEuTlJ4M0ZyZXF1ZW5jeUxTQn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtSKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtrWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2tbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyOwprWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxlbmd0aENvdW50ZXI7a1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS52b2x1bWU7a1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kdXR5Q3ljbGU7a1sxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5fTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuaXNFbmFibGVkPVMoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuZnJlcXVlbmN5VGltZXI9a1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5lbnZlbG9wZUNvdW50ZXI9a1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5sZW5ndGhDb3VudGVyPWtbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eudm9sdW1lPWtbMTAzOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EuZHV0eUN5Y2xlPWtbMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3RdO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT1rWzEwNDQrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPQpmdW5jdGlvbigpe2coYS5tZW1vcnlMb2NhdGlvbk5SeDEtMSwyNTUpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDEsNjMpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDIsMCk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtnKGEubWVtb3J5TG9jYXRpb25OUng0LDE4NCl9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLnJlc2V0VGltZXI9ZnVuY3Rpb24oKXthLmZyZXF1ZW5jeVRpbWVyPTQqKDIwNDgtYS5mcmVxdWVuY3kpO2IuR0JDRG91YmxlU3BlZWQmJihhLmZyZXF1ZW5jeVRpbWVyKj0yKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eSs9CjEsODw9YS53YXZlRm9ybVBvc2l0aW9uT25EdXR5JiYoYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5PTApKTtpZihhLmlzRW5hYmxlZCYmYS5pc0RhY0VuYWJsZWQpYj1hLnZvbHVtZTtlbHNlIHJldHVybiAxNTt2YXIgYz0xO0ZiKGEuTlJ4MUR1dHksYS53YXZlRm9ybVBvc2l0aW9uT25EdXR5KXx8KGMqPS0xKTtyZXR1cm4gYypiKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLnJlc2V0VGltZXIoKTthLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZDthLnZvbHVtZT1hLk5SeDJTdGFydGluZ1ZvbHVtZTthLmlzRGFjRW5hYmxlZHx8KGEuaXNFbmFibGVkPSExKX07YS53aWxsQ2hhbm5lbFVwZGF0ZT1mdW5jdGlvbihiKXthLmN5Y2xlQ291bnRlcis9YjtyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyPyExOiEwfTthLnVwZGF0ZUxlbmd0aD1mdW5jdGlvbigpezA8CmEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPSExKX07YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpey0tYS5lbnZlbG9wZUNvdW50ZXI7MD49YS5lbnZlbG9wZUNvdW50ZXImJihhLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YS5lbnZlbG9wZUNvdW50ZXImJihhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5zZXRGcmVxdWVuY3k9ZnVuY3Rpb24oYil7dmFyIGM9Yj4+ODtiJj0yNTU7dmFyIGQ9eShhLm1lbW9yeUxvY2F0aW9uTlJ4NCkmMjQ4fGM7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MyxiKTtnKGEubWVtb3J5TG9jYXRpb25OUng0LGQpO2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuTlJ4NEZyZXF1ZW5jeU1TQj1jOwphLmZyZXF1ZW5jeT1hLk5SeDRGcmVxdWVuY3lNU0I8PDh8YS5OUngzRnJlcXVlbmN5TFNCfTthLmN5Y2xlQ291bnRlcj0wO2EubWVtb3J5TG9jYXRpb25OUngxPTY1MzAyO2EuTlJ4MUR1dHk9MDthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDM7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9ITE7YS5OUngyRW52ZWxvcGVQZXJpb2Q9MDthLm1lbW9yeUxvY2F0aW9uTlJ4Mz02NTMwNDthLk5SeDNGcmVxdWVuY3lMU0I9MDthLm1lbW9yeUxvY2F0aW9uTlJ4ND02NTMwNTthLk5SeDRMZW5ndGhFbmFibGVkPSExO2EuTlJ4NEZyZXF1ZW5jeU1TQj0wO2EuY2hhbm5lbE51bWJlcj0yO2EuaXNFbmFibGVkPSExO2EuaXNEYWNFbmFibGVkPSExO2EuZnJlcXVlbmN5PTA7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmR1dHlDeWNsZT0wO2Eud2F2ZUZvcm1Qb3NpdGlvbk9uRHV0eT0KMDthLnNhdmVTdGF0ZVNsb3Q9ODtyZXR1cm4gYX0oKSxJPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZU5SeDA9ZnVuY3Rpb24oYil7YS5pc0RhY0VuYWJsZWQ9cSg3LGIpfTthLnVwZGF0ZU5SeDE9ZnVuY3Rpb24oYil7YS5OUngxTGVuZ3RoTG9hZD1iO2EubGVuZ3RoQ291bnRlcj0yNTYtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlZvbHVtZUNvZGU9Yj4+NSYxNX07YS51cGRhdGVOUngzPWZ1bmN0aW9uKGIpe2EuTlJ4M0ZyZXF1ZW5jeUxTQj1iO2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPXEoNixiKTthLk5SeDRGcmVxdWVuY3lNU0I9YiY3O2EuZnJlcXVlbmN5PWEuTlJ4NEZyZXF1ZW5jeU1TQjw8OHxhLk5SeDNGcmVxdWVuY3lMU0J9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7UigxMDI0KzUwKgphLnNhdmVTdGF0ZVNsb3QsYS5pc0VuYWJsZWQpO2tbMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZnJlcXVlbmN5VGltZXI7a1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5sZW5ndGhDb3VudGVyO2tbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEud2F2ZVRhYmxlUG9zaXRpb259O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9UygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1rWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9a1sxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS53YXZlVGFibGVQb3NpdGlvbj1rWzEwMzMrNTAqYS5zYXZlU3RhdGVTbG90XX07YS5pbml0aWFsaXplPWZ1bmN0aW9uKCl7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MCwxMjcpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtnKGEubWVtb3J5TG9jYXRpb25OUngyLDE1OSk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4MywwKTtnKGEubWVtb3J5TG9jYXRpb25OUng0LAoxODQpO2Eudm9sdW1lQ29kZUNoYW5nZWQ9ITB9O2EuZ2V0U2FtcGxlRnJvbUN5Y2xlQ291bnRlcj1mdW5jdGlvbigpe3ZhciBiPWEuY3ljbGVDb3VudGVyO2EuY3ljbGVDb3VudGVyPTA7cmV0dXJuIGEuZ2V0U2FtcGxlKGIpfTthLnJlc2V0VGltZXI9ZnVuY3Rpb24oKXthLmZyZXF1ZW5jeVRpbWVyPTIqKDIwNDgtYS5mcmVxdWVuY3kpO2IuR0JDRG91YmxlU3BlZWQmJihhLmZyZXF1ZW5jeVRpbWVyKj0yKX07YS5nZXRTYW1wbGU9ZnVuY3Rpb24oYil7YS5mcmVxdWVuY3lUaW1lci09YjswPj1hLmZyZXF1ZW5jeVRpbWVyJiYoYj1NYXRoLmFicyhhLmZyZXF1ZW5jeVRpbWVyKSxhLnJlc2V0VGltZXIoKSxhLmZyZXF1ZW5jeVRpbWVyLT1iLGEud2F2ZVRhYmxlUG9zaXRpb24rPTEsMzI8PWEud2F2ZVRhYmxlUG9zaXRpb24mJihhLndhdmVUYWJsZVBvc2l0aW9uPTApKTtiPTA7dmFyIGM9YS52b2x1bWVDb2RlO2lmKGEuaXNFbmFibGVkJiZhLmlzRGFjRW5hYmxlZClhLnZvbHVtZUNvZGVDaGFuZ2VkJiYKKGM9eShhLm1lbW9yeUxvY2F0aW9uTlJ4MiksYz1jPj41JjE1LGEudm9sdW1lQ29kZT1jLGEudm9sdW1lQ29kZUNoYW5nZWQ9ITEpO2Vsc2UgcmV0dXJuIDE1O3ZhciBkPXkoYS5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZSsoYS53YXZlVGFibGVQb3NpdGlvbi8yfDApKTtkPTA9PT1hLndhdmVUYWJsZVBvc2l0aW9uJTI/ZD4+NCYxNTpkJjE1O3N3aXRjaChjKXtjYXNlIDA6ZD4+PTQ7YnJlYWs7Y2FzZSAxOmI9MTticmVhaztjYXNlIDI6ZD4+PTE7Yj0yO2JyZWFrO2RlZmF1bHQ6ZD4+PTIsYj00fXJldHVybigwPGI/ZC9iOjApKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTI1Nik7YS5yZXNldFRpbWVyKCk7YS53YXZlVGFibGVQb3NpdGlvbj0wO2EuaXNEYWNFbmFibGVkfHwoYS5pc0VuYWJsZWQ9ITEpfTthLndpbGxDaGFubmVsVXBkYXRlPWZ1bmN0aW9uKGIpe2EuY3ljbGVDb3VudGVyKz1iOwpyZXR1cm4gMDxhLmZyZXF1ZW5jeVRpbWVyLWEuY3ljbGVDb3VudGVyJiYhYS52b2x1bWVDb2RlQ2hhbmdlZD8hMTohMH07YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPSExKX07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MD02NTMwNjthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTMwNzthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMDg7YS5OUngyVm9sdW1lQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUngzPTY1MzA5O2EuTlJ4M0ZyZXF1ZW5jeUxTQj0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzEwO2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5OUng0RnJlcXVlbmN5TVNCPTA7YS5tZW1vcnlMb2NhdGlvbldhdmVUYWJsZT02NTMyODthLmNoYW5uZWxOdW1iZXI9MzthLmlzRW5hYmxlZD0KITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3k9MDthLmZyZXF1ZW5jeVRpbWVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS53YXZlVGFibGVQb3NpdGlvbj0wO2Eudm9sdW1lQ29kZT0wO2Eudm9sdW1lQ29kZUNoYW5nZWQ9ITE7YS5zYXZlU3RhdGVTbG90PTk7cmV0dXJuIGF9KCksTD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVOUngxPWZ1bmN0aW9uKGIpe2EuTlJ4MUxlbmd0aExvYWQ9YiY2MzthLmxlbmd0aENvdW50ZXI9NjQtYS5OUngxTGVuZ3RoTG9hZH07YS51cGRhdGVOUngyPWZ1bmN0aW9uKGIpe2EuTlJ4MlN0YXJ0aW5nVm9sdW1lPWI+PjQmMTU7YS5OUngyRW52ZWxvcGVBZGRNb2RlPXEoMyxiKTthLk5SeDJFbnZlbG9wZVBlcmlvZD1iJjc7YS5pc0RhY0VuYWJsZWQ9MDwoYiYyNDgpfTthLnVwZGF0ZU5SeDM9ZnVuY3Rpb24oYil7YS5OUngzQ2xvY2tTaGlmdD1iPj40O2EuTlJ4M1dpZHRoTW9kZT1xKDMsYik7YS5OUngzRGl2aXNvckNvZGU9YiY3O3N3aXRjaChhLk5SeDNEaXZpc29yQ29kZSl7Y2FzZSAwOmEuZGl2aXNvcj0KODticmVhaztjYXNlIDE6YS5kaXZpc29yPTE2O2JyZWFrO2Nhc2UgMjphLmRpdmlzb3I9MzI7YnJlYWs7Y2FzZSAzOmEuZGl2aXNvcj00ODticmVhaztjYXNlIDQ6YS5kaXZpc29yPTY0O2JyZWFrO2Nhc2UgNTphLmRpdmlzb3I9ODA7YnJlYWs7Y2FzZSA2OmEuZGl2aXNvcj05NjticmVhaztjYXNlIDc6YS5kaXZpc29yPTExMn19O2EudXBkYXRlTlJ4ND1mdW5jdGlvbihiKXthLk5SeDRMZW5ndGhFbmFibGVkPXEoNixiKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtSKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNFbmFibGVkKTtrWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyZXF1ZW5jeVRpbWVyO2tbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuZW52ZWxvcGVDb3VudGVyO2tbMTAzMys1MCphLnNhdmVTdGF0ZVNsb3RdPWEubGVuZ3RoQ291bnRlcjtrWzEwMzgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnZvbHVtZTtrWzEwNDMrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcn07CmEubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5pc0VuYWJsZWQ9UygxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdCk7YS5mcmVxdWVuY3lUaW1lcj1rWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XTthLmVudmVsb3BlQ291bnRlcj1rWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTthLmxlbmd0aENvdW50ZXI9a1sxMDMzKzUwKmEuc2F2ZVN0YXRlU2xvdF07YS52b2x1bWU9a1sxMDM4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9a1sxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdF19O2EuaW5pdGlhbGl6ZT1mdW5jdGlvbigpe2coYS5tZW1vcnlMb2NhdGlvbk5SeDEtMSwyNTUpO2coYS5tZW1vcnlMb2NhdGlvbk5SeDEsMjU1KTtnKGEubWVtb3J5TG9jYXRpb25OUngyLDApO2coYS5tZW1vcnlMb2NhdGlvbk5SeDMsMCk7ZyhhLm1lbW9yeUxvY2F0aW9uTlJ4NCwxOTEpfTthLmdldFNhbXBsZUZyb21DeWNsZUNvdW50ZXI9ZnVuY3Rpb24oKXt2YXIgYj1hLmN5Y2xlQ291bnRlcjsKYS5jeWNsZUNvdW50ZXI9MDtyZXR1cm4gYS5nZXRTYW1wbGUoYil9O2EuZ2V0U2FtcGxlPWZ1bmN0aW9uKGIpe2EuZnJlcXVlbmN5VGltZXItPWI7MD49YS5mcmVxdWVuY3lUaW1lciYmKGI9TWF0aC5hYnMoYS5mcmVxdWVuY3lUaW1lciksYS5mcmVxdWVuY3lUaW1lcj1hLmdldE5vaXNlQ2hhbm5lbEZyZXF1ZW5jeVBlcmlvZCgpLGEuZnJlcXVlbmN5VGltZXItPWIsYj1hLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3RlciYxXmEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyPj4xJjEsYS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI+Pj0xLGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfD1iPDwxNCxhLk5SeDNXaWR0aE1vZGUmJihhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3RlciY9LTY1LGEubGluZWFyRmVlZGJhY2tTaGlmdFJlZ2lzdGVyfD1iPDw2KSk7aWYoYS5pc0VuYWJsZWQmJmEuaXNEYWNFbmFibGVkKWI9YS52b2x1bWU7ZWxzZSByZXR1cm4gMTU7dmFyIGM9CnEoMCxhLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcik/LTE6MTtyZXR1cm4gYypiKzE1fTthLnRyaWdnZXI9ZnVuY3Rpb24oKXthLmlzRW5hYmxlZD0hMDswPT09YS5sZW5ndGhDb3VudGVyJiYoYS5sZW5ndGhDb3VudGVyPTY0KTthLmZyZXF1ZW5jeVRpbWVyPWEuZ2V0Tm9pc2VDaGFubmVsRnJlcXVlbmN5UGVyaW9kKCk7YS5lbnZlbG9wZUNvdW50ZXI9YS5OUngyRW52ZWxvcGVQZXJpb2Q7YS52b2x1bWU9YS5OUngyU3RhcnRpbmdWb2x1bWU7YS5saW5lYXJGZWVkYmFja1NoaWZ0UmVnaXN0ZXI9MzI3Njc7YS5pc0RhY0VuYWJsZWR8fChhLmlzRW5hYmxlZD0hMSl9O2Eud2lsbENoYW5uZWxVcGRhdGU9ZnVuY3Rpb24oYil7YS5jeWNsZUNvdW50ZXIrPWI7cmV0dXJuIDA8YS5mcmVxdWVuY3lUaW1lci1hLmN5Y2xlQ291bnRlcj8hMTohMH07YS5nZXROb2lzZUNoYW5uZWxGcmVxdWVuY3lQZXJpb2Q9ZnVuY3Rpb24oKXt2YXIgYz1hLmRpdmlzb3I8PGEuTlJ4M0Nsb2NrU2hpZnQ7Yi5HQkNEb3VibGVTcGVlZCYmCihjKj0yKTtyZXR1cm4gY307YS51cGRhdGVMZW5ndGg9ZnVuY3Rpb24oKXswPGEubGVuZ3RoQ291bnRlciYmYS5OUng0TGVuZ3RoRW5hYmxlZCYmLS1hLmxlbmd0aENvdW50ZXI7MD09PWEubGVuZ3RoQ291bnRlciYmKGEuaXNFbmFibGVkPSExKX07YS51cGRhdGVFbnZlbG9wZT1mdW5jdGlvbigpey0tYS5lbnZlbG9wZUNvdW50ZXI7MD49YS5lbnZlbG9wZUNvdW50ZXImJihhLmVudmVsb3BlQ291bnRlcj1hLk5SeDJFbnZlbG9wZVBlcmlvZCwwIT09YS5lbnZlbG9wZUNvdW50ZXImJihhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjE1PmEudm9sdW1lP2Eudm9sdW1lKz0xOiFhLk5SeDJFbnZlbG9wZUFkZE1vZGUmJjA8YS52b2x1bWUmJi0tYS52b2x1bWUpKX07YS5jeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uTlJ4MT02NTMxMjthLk5SeDFMZW5ndGhMb2FkPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDI9NjUzMTM7YS5OUngyU3RhcnRpbmdWb2x1bWU9MDthLk5SeDJFbnZlbG9wZUFkZE1vZGU9CiExO2EuTlJ4MkVudmVsb3BlUGVyaW9kPTA7YS5tZW1vcnlMb2NhdGlvbk5SeDM9NjUzMTQ7YS5OUngzQ2xvY2tTaGlmdD0wO2EuTlJ4M1dpZHRoTW9kZT0hMTthLk5SeDNEaXZpc29yQ29kZT0wO2EubWVtb3J5TG9jYXRpb25OUng0PTY1MzE1O2EuTlJ4NExlbmd0aEVuYWJsZWQ9ITE7YS5jaGFubmVsTnVtYmVyPTQ7YS5pc0VuYWJsZWQ9ITE7YS5pc0RhY0VuYWJsZWQ9ITE7YS5mcmVxdWVuY3lUaW1lcj0wO2EuZW52ZWxvcGVDb3VudGVyPTA7YS5sZW5ndGhDb3VudGVyPTA7YS52b2x1bWU9MDthLmRpdmlzb3I9MDthLmxpbmVhckZlZWRiYWNrU2hpZnRSZWdpc3Rlcj0wO2Euc2F2ZVN0YXRlU2xvdD0xMDtyZXR1cm4gYX0oKSx4PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmNoYW5uZWwxU2FtcGxlPTE1O2EuY2hhbm5lbDJTYW1wbGU9MTU7YS5jaGFubmVsM1NhbXBsZT0xNTthLmNoYW5uZWw0U2FtcGxlPTE1O2EuY2hhbm5lbDFEYWNFbmFibGVkPSExO2EuY2hhbm5lbDJEYWNFbmFibGVkPQohMTthLmNoYW5uZWwzRGFjRW5hYmxlZD0hMTthLmNoYW5uZWw0RGFjRW5hYmxlZD0hMTthLmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzthLnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7YS5taXhlclZvbHVtZUNoYW5nZWQ9ITE7YS5taXhlckVuYWJsZWRDaGFuZ2VkPSExO2EubmVlZFRvUmVtaXhTYW1wbGVzPSExO3JldHVybiBhfSgpLGY9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/MTc0Ojg3fTthLnVwZGF0ZU5SNTA9ZnVuY3Rpb24oYil7YS5OUjUwTGVmdE1peGVyVm9sdW1lPWI+PjQmNzthLk5SNTBSaWdodE1peGVyVm9sdW1lPWImN307YS51cGRhdGVOUjUxPWZ1bmN0aW9uKGIpe2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PXEoNyxiKTthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uTGVmdE91dHB1dD1xKDYsYik7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9CnEoNSxiKTthLk5SNTFJc0NoYW5uZWwxRW5hYmxlZE9uTGVmdE91dHB1dD1xKDQsYik7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPblJpZ2h0T3V0cHV0PXEoMyxiKTthLk5SNTFJc0NoYW5uZWwzRW5hYmxlZE9uUmlnaHRPdXRwdXQ9cSgyLGIpO2EuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25SaWdodE91dHB1dD1xKDEsYik7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPblJpZ2h0T3V0cHV0PXEoMCxiKX07YS51cGRhdGVOUjUyPWZ1bmN0aW9uKGIpe2EuTlI1MklzU291bmRFbmFibGVkPXEoNyxiKX07YS5tYXhGcmFtZVNlcXVlbmNlQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuR0JDRG91YmxlU3BlZWQ/MTYzODQ6ODE5Mn07YS5tYXhEb3duU2FtcGxlQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIGIuQ0xPQ0tfU1BFRUQoKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtrWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI7a1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09CmEuZG93blNhbXBsZUN5Y2xlQ291bnRlcjtrWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmZyYW1lU2VxdWVuY2VyfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EuZnJhbWVTZXF1ZW5jZUN5Y2xlQ291bnRlcj1rWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9a1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5mcmFtZVNlcXVlbmNlcj1rWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XTtuYigpfTthLmN1cnJlbnRDeWNsZXM9MDthLm1lbW9yeUxvY2F0aW9uTlI1MD02NTMxNjthLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9MDthLk5SNTBSaWdodE1peGVyVm9sdW1lPTA7YS5tZW1vcnlMb2NhdGlvbk5SNTE9NjUzMTc7YS5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsMkVuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPbkxlZnRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsNEVuYWJsZWRPbkxlZnRPdXRwdXQ9CiEwO2EuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0hMDthLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7YS5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2EuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD0hMDthLm1lbW9yeUxvY2F0aW9uTlI1Mj02NTMxODthLk5SNTJJc1NvdW5kRW5hYmxlZD0hMDthLm1lbW9yeUxvY2F0aW9uQ2hhbm5lbDNMb2FkUmVnaXN0ZXJTdGFydD02NTMyODthLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9MDthLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9MDthLmRvd25TYW1wbGVDeWNsZU11bHRpcGxpZXI9NDhFMzthLmZyYW1lU2VxdWVuY2VyPTA7YS5hdWRpb1F1ZXVlSW5kZXg9MDthLndhc21Cb3lNZW1vcnlNYXhCdWZmZXJTaXplPTEzMTA3MjthLnNhdmVTdGF0ZVNsb3Q9NjtyZXR1cm4gYX0oKSxwPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnVwZGF0ZUludGVycnVwdEVuYWJsZWQ9CmZ1bmN0aW9uKGIpe2EuaXNWQmxhbmtJbnRlcnJ1cHRFbmFibGVkPXEoYS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCxiKTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD1xKGEuYml0UG9zaXRpb25MY2RJbnRlcnJ1cHQsYik7YS5pc1RpbWVySW50ZXJydXB0RW5hYmxlZD1xKGEuYml0UG9zaXRpb25UaW1lckludGVycnVwdCxiKTthLmlzU2VyaWFsSW50ZXJydXB0RW5hYmxlZD1xKGEuYml0UG9zaXRpb25TZXJpYWxJbnRlcnJ1cHQsYik7YS5pc0pveXBhZEludGVycnVwdEVuYWJsZWQ9cShhLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0LGIpO2EuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZT1ifTthLnVwZGF0ZUludGVycnVwdFJlcXVlc3RlZD1mdW5jdGlvbihiKXthLmlzVkJsYW5rSW50ZXJydXB0UmVxdWVzdGVkPXEoYS5iaXRQb3NpdGlvblZCbGFua0ludGVycnVwdCxiKTthLmlzTGNkSW50ZXJydXB0UmVxdWVzdGVkPXEoYS5iaXRQb3NpdGlvbkxjZEludGVycnVwdCxiKTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9CnEoYS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0LGIpO2EuaXNTZXJpYWxJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cShhLmJpdFBvc2l0aW9uU2VyaWFsSW50ZXJydXB0LGIpO2EuaXNKb3lwYWRJbnRlcnJ1cHRSZXF1ZXN0ZWQ9cShhLmJpdFBvc2l0aW9uSm95cGFkSW50ZXJydXB0LGIpO2EuaW50ZXJydXB0c1JlcXVlc3RlZFZhbHVlPWJ9O2EuYXJlSW50ZXJydXB0c1BlbmRpbmc9ZnVuY3Rpb24oKXtyZXR1cm4gMDwoYS5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmYS5pbnRlcnJ1cHRzRW5hYmxlZFZhbHVlJjMxKX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtSKDEwMjQrNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoKTtSKDEwMjUrNTAqYS5zYXZlU3RhdGVTbG90LGEubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXkpfTthLmxvYWRTdGF0ZT1mdW5jdGlvbigpe2EubWFzdGVySW50ZXJydXB0U3dpdGNoPVMoMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EubWFzdGVySW50ZXJydXB0U3dpdGNoRGVsYXk9ClMoMTAyNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EudXBkYXRlSW50ZXJydXB0RW5hYmxlZCh5KGEubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkKSk7YS51cGRhdGVJbnRlcnJ1cHRSZXF1ZXN0ZWQoeShhLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdCkpfTthLm1hc3RlckludGVycnVwdFN3aXRjaD0hMTthLm1hc3RlckludGVycnVwdFN3aXRjaERlbGF5PSExO2EuYml0UG9zaXRpb25WQmxhbmtJbnRlcnJ1cHQ9MDthLmJpdFBvc2l0aW9uTGNkSW50ZXJydXB0PTE7YS5iaXRQb3NpdGlvblRpbWVySW50ZXJydXB0PTI7YS5iaXRQb3NpdGlvblNlcmlhbEludGVycnVwdD0zO2EuYml0UG9zaXRpb25Kb3lwYWRJbnRlcnJ1cHQ9NDthLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0RW5hYmxlZD02NTUzNTthLmludGVycnVwdHNFbmFibGVkVmFsdWU9MDthLmlzVkJsYW5rSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzTGNkSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRFbmFibGVkPQohMTthLmlzU2VyaWFsSW50ZXJydXB0RW5hYmxlZD0hMTthLmlzSm95cGFkSW50ZXJydXB0RW5hYmxlZD0hMTthLm1lbW9yeUxvY2F0aW9uSW50ZXJydXB0UmVxdWVzdD02NTI5NTthLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZT0wO2EuaXNWQmxhbmtJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc0xjZEludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzVGltZXJJbnRlcnJ1cHRSZXF1ZXN0ZWQ9ITE7YS5pc1NlcmlhbEludGVycnVwdFJlcXVlc3RlZD0hMTthLmlzSm95cGFkSW50ZXJydXB0UmVxdWVzdGVkPSExO2Euc2F2ZVN0YXRlU2xvdD0yO3JldHVybiBhfSgpLG49ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEuYmF0Y2hQcm9jZXNzQ3ljbGVzPWZ1bmN0aW9uKCl7cmV0dXJuIDI1Nn07YS51cGRhdGVEaXZpZGVyUmVnaXN0ZXI9ZnVuY3Rpb24oYil7Yj1hLmRpdmlkZXJSZWdpc3RlcjthLmRpdmlkZXJSZWdpc3Rlcj0wO2coYS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3RlciwwKTsKYS50aW1lckVuYWJsZWQmJktiKGIsYS5kaXZpZGVyUmVnaXN0ZXIpJiZwYigpfTthLnVwZGF0ZVRpbWVyQ291bnRlcj1mdW5jdGlvbihiKXtpZihhLnRpbWVyRW5hYmxlZCl7aWYoYS50aW1lckNvdW50ZXJXYXNSZXNldClyZXR1cm47YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5JiYoYS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PSExKX1hLnRpbWVyQ291bnRlcj1ifTthLnVwZGF0ZVRpbWVyTW9kdWxvPWZ1bmN0aW9uKGIpe2EudGltZXJNb2R1bG89YjthLnRpbWVyRW5hYmxlZCYmYS50aW1lckNvdW50ZXJXYXNSZXNldCYmKGEudGltZXJDb3VudGVyPWEudGltZXJNb2R1bG8sYS50aW1lckNvdW50ZXJXYXNSZXNldD0hMSl9O2EudXBkYXRlVGltZXJDb250cm9sPWZ1bmN0aW9uKGIpe3ZhciBjPWEudGltZXJFbmFibGVkO2EudGltZXJFbmFibGVkPXEoMixiKTtiJj0zO2lmKCFjKXtjPXFiKGEudGltZXJJbnB1dENsb2NrKTt2YXIgZD1xYihiKTsoYS50aW1lckVuYWJsZWQ/cShjLAphLmRpdmlkZXJSZWdpc3Rlcik6cShjLGEuZGl2aWRlclJlZ2lzdGVyKSYmcShkLGEuZGl2aWRlclJlZ2lzdGVyKSkmJnBiKCl9YS50aW1lcklucHV0Q2xvY2s9Yn07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtrWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRDeWNsZXM7a1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5kaXZpZGVyUmVnaXN0ZXI7UigxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXkpO1IoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QsYS50aW1lckNvdW50ZXJXYXNSZXNldCk7ZyhhLm1lbW9yeUxvY2F0aW9uVGltZXJDb3VudGVyLGEudGltZXJDb3VudGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLmN1cnJlbnRDeWNsZXM9a1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5kaXZpZGVyUmVnaXN0ZXI9a1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS50aW1lckNvdW50ZXJPdmVyZmxvd0RlbGF5PVMoMTAzMisKNTAqYS5zYXZlU3RhdGVTbG90KTthLnRpbWVyQ291bnRlcldhc1Jlc2V0PVMoMTAzNSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EudGltZXJDb3VudGVyPXkoYS5tZW1vcnlMb2NhdGlvblRpbWVyQ291bnRlcik7YS50aW1lck1vZHVsbz15KGEubWVtb3J5TG9jYXRpb25UaW1lck1vZHVsbyk7YS50aW1lcklucHV0Q2xvY2s9eShhLm1lbW9yeUxvY2F0aW9uVGltZXJDb250cm9sKX07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvbkRpdmlkZXJSZWdpc3Rlcj02NTI4NDthLmRpdmlkZXJSZWdpc3Rlcj0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvdW50ZXI9NjUyODU7YS50aW1lckNvdW50ZXI9MDthLnRpbWVyQ291bnRlck92ZXJmbG93RGVsYXk9ITE7YS50aW1lckNvdW50ZXJXYXNSZXNldD0hMTthLnRpbWVyQ291bnRlck1hc2s9MDthLm1lbW9yeUxvY2F0aW9uVGltZXJNb2R1bG89NjUyODY7YS50aW1lck1vZHVsbz0wO2EubWVtb3J5TG9jYXRpb25UaW1lckNvbnRyb2w9NjUyODc7CmEudGltZXJFbmFibGVkPSExO2EudGltZXJJbnB1dENsb2NrPTA7YS5zYXZlU3RhdGVTbG90PTU7cmV0dXJuIGF9KCksTT1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS51cGRhdGVUcmFuc2ZlckNvbnRyb2w9ZnVuY3Rpb24oYil7YS5pc1NoaWZ0Q2xvY2tJbnRlcm5hbD1xKDAsYik7YS5pc0Nsb2NrU3BlZWRGYXN0PXEoMSxiKTthLnRyYW5zZmVyU3RhcnRGbGFnPXEoNyxiKTtyZXR1cm4hMH07YS5jdXJyZW50Q3ljbGVzPTA7YS5tZW1vcnlMb2NhdGlvblNlcmlhbFRyYW5zZmVyRGF0YT02NTI4MTthLm1lbW9yeUxvY2F0aW9uU2VyaWFsVHJhbnNmZXJDb250cm9sPTY1MjgyO2EubnVtYmVyT2ZCaXRzVHJhbnNmZXJyZWQ9MDthLmlzU2hpZnRDbG9ja0ludGVybmFsPSExO2EuaXNDbG9ja1NwZWVkRmFzdD0hMTthLnRyYW5zZmVyU3RhcnRGbGFnPSExO3JldHVybiBhfSgpLEI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlSm95cGFkPWZ1bmN0aW9uKGIpe2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPQpiXjI1NTthLmlzRHBhZFR5cGU9cSg0LGEuam95cGFkUmVnaXN0ZXJGbGlwcGVkKTthLmlzQnV0dG9uVHlwZT1xKDUsYS5qb3lwYWRSZWdpc3RlckZsaXBwZWQpfTthLnNhdmVTdGF0ZT1mdW5jdGlvbigpe307YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnVwZGF0ZUpveXBhZCh5KGEubWVtb3J5TG9jYXRpb25Kb3lwYWRSZWdpc3RlcikpfTthLnVwPSExO2EuZG93bj0hMTthLmxlZnQ9ITE7YS5yaWdodD0hMTthLmE9ITE7YS5iPSExO2Euc2VsZWN0PSExO2Euc3RhcnQ9ITE7YS5tZW1vcnlMb2NhdGlvbkpveXBhZFJlZ2lzdGVyPTY1MjgwO2Euam95cGFkUmVnaXN0ZXJGbGlwcGVkPTA7YS5pc0RwYWRUeXBlPSExO2EuaXNCdXR0b25UeXBlPSExO2Euc2F2ZVN0YXRlU2xvdD0zO3JldHVybiBhfSgpLEM9ZnVuY3Rpb24oKXtmdW5jdGlvbiBhKCl7fWEudXBkYXRlTGNkU3RhdHVzPWZ1bmN0aW9uKGIpe3ZhciBjPXkoYS5tZW1vcnlMb2NhdGlvbkxjZFN0YXR1cyk7Yj1iJjI0OHxjJjd8MTI4OwpnKGEubWVtb3J5TG9jYXRpb25MY2RTdGF0dXMsYil9O2EudXBkYXRlTGNkQ29udHJvbD1mdW5jdGlvbihiKXt2YXIgYz1hLmVuYWJsZWQ7YS5lbmFibGVkPXEoNyxiKTthLndpbmRvd1RpbGVNYXBEaXNwbGF5U2VsZWN0PXEoNixiKTthLndpbmRvd0Rpc3BsYXlFbmFibGVkPXEoNSxiKTthLmJnV2luZG93VGlsZURhdGFTZWxlY3Q9cSg0LGIpO2EuYmdUaWxlTWFwRGlzcGxheVNlbGVjdD1xKDMsYik7YS50YWxsU3ByaXRlU2l6ZT1xKDIsYik7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPXEoMSxiKTthLmJnRGlzcGxheUVuYWJsZWQ9cSgwLGIpO2MmJiFhLmVuYWJsZWQmJk1iKCEwKTshYyYmYS5lbmFibGVkJiZNYighMSl9O2EubWVtb3J5TG9jYXRpb25MY2RTdGF0dXM9NjUzNDU7YS5jdXJyZW50TGNkTW9kZT0wO2EubWVtb3J5TG9jYXRpb25Db2luY2lkZW5jZUNvbXBhcmU9NjUzNDk7YS5jb2luY2lkZW5jZUNvbXBhcmU9MDthLm1lbW9yeUxvY2F0aW9uTGNkQ29udHJvbD02NTM0NDthLmVuYWJsZWQ9CiEwO2Eud2luZG93VGlsZU1hcERpc3BsYXlTZWxlY3Q9ITE7YS53aW5kb3dEaXNwbGF5RW5hYmxlZD0hMTthLmJnV2luZG93VGlsZURhdGFTZWxlY3Q9ITE7YS5iZ1RpbGVNYXBEaXNwbGF5U2VsZWN0PSExO2EudGFsbFNwcml0ZVNpemU9ITE7YS5zcHJpdGVEaXNwbGF5RW5hYmxlPSExO2EuYmdEaXNwbGF5RW5hYmxlZD0hMTtyZXR1cm4gYX0oKSx0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmJhdGNoUHJvY2Vzc0N5Y2xlcz1mdW5jdGlvbigpe3JldHVybiBhLk1BWF9DWUNMRVNfUEVSX1NDQU5MSU5FKCl9O2EuTUFYX0NZQ0xFU19QRVJfU0NBTkxJTkU9ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNEb3VibGVTcGVlZD8xNTM9PT1hLnNjYW5saW5lUmVnaXN0ZXI/ODo5MTI6MTUzPT09YS5zY2FubGluZVJlZ2lzdGVyPzQ6NDU2fTthLk1JTl9DWUNMRVNfU1BSSVRFU19MQ0RfTU9ERT1mdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzc1MjozNzZ9O2EuTUlOX0NZQ0xFU19UUkFOU0ZFUl9EQVRBX0xDRF9NT0RFPQpmdW5jdGlvbigpe3JldHVybiBiLkdCQ0RvdWJsZVNwZWVkPzQ5ODoyNDl9O2Euc2F2ZVN0YXRlPWZ1bmN0aW9uKCl7a1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zY2FubGluZUN5Y2xlQ291bnRlcjtrWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1DLmN1cnJlbnRMY2RNb2RlO2coYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIsYS5zY2FubGluZVJlZ2lzdGVyKX07YS5sb2FkU3RhdGU9ZnVuY3Rpb24oKXthLnNjYW5saW5lQ3ljbGVDb3VudGVyPWtbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdO0MuY3VycmVudExjZE1vZGU9a1sxMDI4KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5zY2FubGluZVJlZ2lzdGVyPXkoYS5tZW1vcnlMb2NhdGlvblNjYW5saW5lUmVnaXN0ZXIpO0MudXBkYXRlTGNkQ29udHJvbCh5KEMubWVtb3J5TG9jYXRpb25MY2RDb250cm9sKSl9O2EuY3VycmVudEN5Y2xlcz0wO2Euc2NhbmxpbmVDeWNsZUNvdW50ZXI9MDthLm1lbW9yeUxvY2F0aW9uU2NhbmxpbmVSZWdpc3Rlcj0KNjUzNDg7YS5zY2FubGluZVJlZ2lzdGVyPTA7YS5tZW1vcnlMb2NhdGlvbkRtYVRyYW5zZmVyPTY1MzUwO2EubWVtb3J5TG9jYXRpb25TY3JvbGxYPTY1MzQ3O2Euc2Nyb2xsWD0wO2EubWVtb3J5TG9jYXRpb25TY3JvbGxZPTY1MzQ2O2Euc2Nyb2xsWT0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dYPTY1MzU1O2Eud2luZG93WD0wO2EubWVtb3J5TG9jYXRpb25XaW5kb3dZPTY1MzU0O2Eud2luZG93WT0wO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0PTM4OTEyO2EubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQ9Mzk5MzY7YS5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0PTM0ODE2O2EubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0PTMyNzY4O2EubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGU9NjUwMjQ7YS5tZW1vcnlMb2NhdGlvbkJhY2tncm91bmRQYWxldHRlPTY1MzUxO2EubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lPQo2NTM1MjthLm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZVR3bz02NTM1MzthLnNhdmVTdGF0ZVNsb3Q9MTtyZXR1cm4gYX0oKSxkPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLnNhdmVTdGF0ZT1mdW5jdGlvbigpe2tbMTAyNCs1MCphLnNhdmVTdGF0ZVNsb3RdPWEuY3VycmVudFJvbUJhbms7a1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5jdXJyZW50UmFtQmFuaztSKDEwMjgrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNSYW1CYW5raW5nRW5hYmxlZCk7UigxMDI5KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzTUJDMVJvbU1vZGVFbmFibGVkKTtSKDEwMzArNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNSb21Pbmx5KTtSKDEwMzErNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMxKTtSKDEwMzIrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMyKTtSKDEwMzMrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkMzKTtSKDEwMzQrNTAqYS5zYXZlU3RhdGVTbG90LGEuaXNNQkM1KX07YS5sb2FkU3RhdGU9CmZ1bmN0aW9uKCl7YS5jdXJyZW50Um9tQmFuaz1rWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XTthLmN1cnJlbnRSYW1CYW5rPWtbMTAyNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNSYW1CYW5raW5nRW5hYmxlZD1TKDEwMjgrNTAqYS5zYXZlU3RhdGVTbG90KTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPVMoMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNSb21Pbmx5PVMoMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMxPVMoMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMyPVMoMTAzMis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkMzPVMoMTAzMys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNNQkM1PVMoMTAzNCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLmNhcnRyaWRnZVJvbUxvY2F0aW9uPTA7YS5zd2l0Y2hhYmxlQ2FydHJpZGdlUm9tTG9jYXRpb249MTYzODQ7YS52aWRlb1JhbUxvY2F0aW9uPTMyNzY4O2EuY2FydHJpZGdlUmFtTG9jYXRpb249NDA5NjA7YS5pbnRlcm5hbFJhbUJhbmtaZXJvTG9jYXRpb249CjQ5MTUyO2EuaW50ZXJuYWxSYW1CYW5rT25lTG9jYXRpb249NTMyNDg7YS5lY2hvUmFtTG9jYXRpb249NTczNDQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb249NjUwMjQ7YS5zcHJpdGVJbmZvcm1hdGlvblRhYmxlTG9jYXRpb25FbmQ9NjUxODM7YS51bnVzYWJsZU1lbW9yeUxvY2F0aW9uPTY1MTg0O2EudW51c2FibGVNZW1vcnlFbmRMb2NhdGlvbj02NTI3OTthLmN1cnJlbnRSb21CYW5rPTA7YS5jdXJyZW50UmFtQmFuaz0wO2EuaXNSYW1CYW5raW5nRW5hYmxlZD0hMTthLmlzTUJDMVJvbU1vZGVFbmFibGVkPSEwO2EuaXNSb21Pbmx5PSEwO2EuaXNNQkMxPSExO2EuaXNNQkMyPSExO2EuaXNNQkMzPSExO2EuaXNNQkM1PSExO2EubWVtb3J5TG9jYXRpb25IZG1hU291cmNlSGlnaD02NTM2MTthLm1lbW9yeUxvY2F0aW9uSGRtYVNvdXJjZUxvdz02NTM2MjthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uSGlnaD02NTM2MzthLm1lbW9yeUxvY2F0aW9uSGRtYURlc3RpbmF0aW9uTG93PQo2NTM2NDthLm1lbW9yeUxvY2F0aW9uSGRtYVRyaWdnZXI9NjUzNjU7YS5ETUFDeWNsZXM9MDthLmlzSGJsYW5rSGRtYUFjdGl2ZT0hMTthLmhibGFua0hkbWFUcmFuc2Zlckxlbmd0aFJlbWFpbmluZz0wO2EuaGJsYW5rSGRtYVNvdXJjZT0wO2EuaGJsYW5rSGRtYURlc3RpbmF0aW9uPTA7YS5tZW1vcnlMb2NhdGlvbkdCQ1ZSQU1CYW5rPTY1MzU5O2EubWVtb3J5TG9jYXRpb25HQkNXUkFNQmFuaz02NTM5MjthLnNhdmVTdGF0ZVNsb3Q9NDtyZXR1cm4gYX0oKSxiPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLkNMT0NLX1NQRUVEPWZ1bmN0aW9uKCl7cmV0dXJuIGEuR0JDRG91YmxlU3BlZWQ/ODM4ODYwODo0MTk0MzA0fTthLk1BWF9DWUNMRVNfUEVSX0ZSQU1FPWZ1bmN0aW9uKCl7cmV0dXJuIGEuR0JDRG91YmxlU3BlZWQ/MTQwNDQ4OjcwMjI0fTthLmVuYWJsZUhhbHQ9ZnVuY3Rpb24oKXtwLm1hc3RlckludGVycnVwdFN3aXRjaD9hLmlzSGFsdE5vcm1hbD0hMDowPT09KHAuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSYKcC5pbnRlcnJ1cHRzUmVxdWVzdGVkVmFsdWUmMzEpP2EuaXNIYWx0Tm9KdW1wPSEwOmEuaXNIYWx0QnVnPSEwfTthLmV4aXRIYWx0QW5kU3RvcD1mdW5jdGlvbigpe2EuaXNIYWx0Tm9KdW1wPSExO2EuaXNIYWx0Tm9ybWFsPSExO2EuaXNIYWx0QnVnPSExO2EuaXNTdG9wcGVkPSExfTthLmlzSGFsdGVkPWZ1bmN0aW9uKCl7cmV0dXJuIGEuaXNIYWx0Tm9ybWFsfHxhLmlzSGFsdE5vSnVtcD8hMDohMX07YS5zYXZlU3RhdGU9ZnVuY3Rpb24oKXtrWzEwMjQrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQTtrWzEwMjUrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQjtrWzEwMjYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyQztrWzEwMjcrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRDtrWzEwMjgrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVyRTtrWzEwMjkrNTAqYS5zYXZlU3RhdGVTbG90XT1hLnJlZ2lzdGVySDtrWzEwMzArNTAqYS5zYXZlU3RhdGVTbG90XT0KYS5yZWdpc3Rlckw7a1sxMDMxKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5yZWdpc3RlckY7a1sxMDMyKzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5zdGFja1BvaW50ZXI7a1sxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF09YS5wcm9ncmFtQ291bnRlcjtrWzEwMzYrNTAqYS5zYXZlU3RhdGVTbG90XT1hLmN1cnJlbnRDeWNsZXM7UigxMDQxKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzSGFsdE5vcm1hbCk7UigxMDQyKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzSGFsdE5vSnVtcCk7UigxMDQzKzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzSGFsdEJ1Zyk7UigxMDQ0KzUwKmEuc2F2ZVN0YXRlU2xvdCxhLmlzU3RvcHBlZCl9O2EubG9hZFN0YXRlPWZ1bmN0aW9uKCl7YS5yZWdpc3RlckE9a1sxMDI0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckI9a1sxMDI1KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckM9a1sxMDI2KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5yZWdpc3RlckQ9a1sxMDI3Kwo1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJFPWtbMTAyOCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJIPWtbMTAyOSs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJMPWtbMTAzMCs1MCphLnNhdmVTdGF0ZVNsb3RdO2EucmVnaXN0ZXJGPWtbMTAzMSs1MCphLnNhdmVTdGF0ZVNsb3RdO2Euc3RhY2tQb2ludGVyPWtbMTAzMis1MCphLnNhdmVTdGF0ZVNsb3RdO2EucHJvZ3JhbUNvdW50ZXI9a1sxMDM0KzUwKmEuc2F2ZVN0YXRlU2xvdF07YS5jdXJyZW50Q3ljbGVzPWtbMTAzNis1MCphLnNhdmVTdGF0ZVNsb3RdO2EuaXNIYWx0Tm9ybWFsPVMoMTA0MSs1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNIYWx0Tm9KdW1wPVMoMTA0Mis1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNIYWx0QnVnPVMoMTA0Mys1MCphLnNhdmVTdGF0ZVNsb3QpO2EuaXNTdG9wcGVkPVMoMTA0NCs1MCphLnNhdmVTdGF0ZVNsb3QpfTthLkdCQ0VuYWJsZWQ9ITE7YS5tZW1vcnlMb2NhdGlvblNwZWVkU3dpdGNoPQo2NTM1NzthLkdCQ0RvdWJsZVNwZWVkPSExO2EucmVnaXN0ZXJBPTA7YS5yZWdpc3RlckI9MDthLnJlZ2lzdGVyQz0wO2EucmVnaXN0ZXJEPTA7YS5yZWdpc3RlckU9MDthLnJlZ2lzdGVySD0wO2EucmVnaXN0ZXJMPTA7YS5yZWdpc3RlckY9MDthLnN0YWNrUG9pbnRlcj0wO2EucHJvZ3JhbUNvdW50ZXI9MDthLmN1cnJlbnRDeWNsZXM9MDthLmlzSGFsdE5vcm1hbD0hMTthLmlzSGFsdE5vSnVtcD0hMTthLmlzSGFsdEJ1Zz0hMTthLmlzU3RvcHBlZD0hMTthLnNhdmVTdGF0ZVNsb3Q9MDtyZXR1cm4gYX0oKSxYPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe31hLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTthLmN5Y2xlU2V0cz0wO2EuY3ljbGVzPTA7cmV0dXJuIGF9KCksUD1mdW5jdGlvbigpe2Z1bmN0aW9uIGEoKXt9YS5zdGVwc1BlclN0ZXBTZXQ9MkU5O2Euc3RlcFNldHM9MDthLnN0ZXBzPTA7YS5SRVNQT05TRV9DT05ESVRJT05fRVJST1I9LTE7YS5SRVNQT05TRV9DT05ESVRJT05fRlJBTUU9CjA7YS5SRVNQT05TRV9DT05ESVRJT05fQVVESU89MTthLlJFU1BPTlNFX0NPTkRJVElPTl9CUkVBS1BPSU5UPTI7cmV0dXJuIGF9KCk7T2Euc2l6ZSgpPEJiJiZPYS5ncm93KEJiLU9hLnNpemUoKSk7dmFyIE1hPSExLHNjPU9iamVjdC5mcmVlemUoe21lbW9yeTpPYSxjb25maWc6ZnVuY3Rpb24oYSxjLGUsayxtLGgscSxsLHIsdSl7US5lbmFibGVCb290Um9tPTA8YT8hMDohMTtRLnVzZUdiY1doZW5BdmFpbGFibGU9MDxjPyEwOiExO1EuYXVkaW9CYXRjaFByb2Nlc3Npbmc9MDxlPyEwOiExO1EuZ3JhcGhpY3NCYXRjaFByb2Nlc3Npbmc9MDxrPyEwOiExO1EudGltZXJzQmF0Y2hQcm9jZXNzaW5nPTA8bT8hMDohMTtRLmdyYXBoaWNzRGlzYWJsZVNjYW5saW5lUmVuZGVyaW5nPTA8aD8hMDohMTtRLmF1ZGlvQWNjdW11bGF0ZVNhbXBsZXM9MDxxPyEwOiExO1EudGlsZVJlbmRlcmluZz0wPGw/ITA6ITE7US50aWxlQ2FjaGluZz0wPHI/ITA6ITE7US5lbmFibGVBdWRpb0RlYnVnZ2luZz0KMDx1PyEwOiExO2E9eSgzMjMpO2IuR0JDRW5hYmxlZD0xOTI9PT1hfHxRLnVzZUdiY1doZW5BdmFpbGFibGUmJjEyOD09PWE/ITA6ITE7Yi5HQkNEb3VibGVTcGVlZD0hMTtiLnJlZ2lzdGVyQT0wO2IucmVnaXN0ZXJCPTA7Yi5yZWdpc3RlckM9MDtiLnJlZ2lzdGVyRD0wO2IucmVnaXN0ZXJFPTA7Yi5yZWdpc3Rlckg9MDtiLnJlZ2lzdGVyTD0wO2IucmVnaXN0ZXJGPTA7Yi5zdGFja1BvaW50ZXI9MDtiLnByb2dyYW1Db3VudGVyPTA7Yi5jdXJyZW50Q3ljbGVzPTA7Yi5pc0hhbHROb3JtYWw9ITE7Yi5pc0hhbHROb0p1bXA9ITE7Yi5pc0hhbHRCdWc9ITE7Yi5pc1N0b3BwZWQ9ITE7Yi5HQkNFbmFibGVkPyhiLnJlZ2lzdGVyQT0xNyxiLnJlZ2lzdGVyRj0xMjgsYi5yZWdpc3RlckI9MCxiLnJlZ2lzdGVyQz0wLGIucmVnaXN0ZXJEPTI1NSxiLnJlZ2lzdGVyRT04NixiLnJlZ2lzdGVySD0wLGIucmVnaXN0ZXJMPTEzKTooYi5yZWdpc3RlckE9MSxiLnJlZ2lzdGVyRj0xNzYsYi5yZWdpc3RlckI9CjAsYi5yZWdpc3RlckM9MTksYi5yZWdpc3RlckQ9MCxiLnJlZ2lzdGVyRT0yMTYsYi5yZWdpc3Rlckg9MSxiLnJlZ2lzdGVyTD03Nyk7Yi5wcm9ncmFtQ291bnRlcj0yNTY7Yi5zdGFja1BvaW50ZXI9NjU1MzQ7ZC5pc1JhbUJhbmtpbmdFbmFibGVkPSExO2QuaXNNQkMxUm9tTW9kZUVuYWJsZWQ9ITA7YT15KDMyNyk7ZC5pc1JvbU9ubHk9ITE7ZC5pc01CQzE9ITE7ZC5pc01CQzI9ITE7ZC5pc01CQzM9ITE7ZC5pc01CQzU9ITE7MD09PWE/ZC5pc1JvbU9ubHk9ITA6MTw9YSYmMz49YT9kLmlzTUJDMT0hMDo1PD1hJiY2Pj1hP2QuaXNNQkMyPSEwOjE1PD1hJiYxOT49YT9kLmlzTUJDMz0hMDoyNTw9YSYmMzA+PWEmJihkLmlzTUJDNT0hMCk7ZC5jdXJyZW50Um9tQmFuaz0xO2QuY3VycmVudFJhbUJhbms9MDtnKDY1MzYxLDI1NSk7Zyg2NTM2MiwyNTUpO2coNjUzNjMsMjU1KTtnKDY1MzY0LDI1NSk7Zyg2NTM2NSwyNTUpO3QuY3VycmVudEN5Y2xlcz0wO3Quc2NhbmxpbmVDeWNsZUNvdW50ZXI9CjA7dC5zY2FubGluZVJlZ2lzdGVyPTA7dC5zY3JvbGxYPTA7dC5zY3JvbGxZPTA7dC53aW5kb3dYPTA7dC53aW5kb3dZPTA7Yi5HQkNFbmFibGVkPyh0LnNjYW5saW5lUmVnaXN0ZXI9MTQ0LGcoNjUzNDQsMTQ1KSxnKDY1MzQ1LDEyOSksZyg2NTM0OCwxNDQpLGcoNjUzNTEsMjUyKSk6KHQuc2NhbmxpbmVSZWdpc3Rlcj0xNDQsZyg2NTM0NCwxNDUpLGcoNjUzNDUsMTMzKSxnKDY1MzUwLDI1NSksZyg2NTM1MSwyNTIpLGcoNjUzNTIsMjU1KSxnKDY1MzUzLDI1NSkpO2coNjUzNTksMCk7Zyg2NTM5MiwxKTtiLkdCQ0VuYWJsZWQ/KGcoNjUzODQsMTkyKSxnKDY1Mzg1LDI1NSksZyg2NTM4NiwxOTMpLGcoNjUzODcsMTMpKTooZyg2NTM4NCwyNTUpLGcoNjUzODUsMjU1KSxnKDY1Mzg2LDI1NSksZyg2NTM4NywyNTUpKTtmLmN1cnJlbnRDeWNsZXM9MDtmLk5SNTBMZWZ0TWl4ZXJWb2x1bWU9MDtmLk5SNTBSaWdodE1peGVyVm9sdW1lPTA7Zi5OUjUxSXNDaGFubmVsMUVuYWJsZWRPbkxlZnRPdXRwdXQ9CiEwO2YuTlI1MUlzQ2hhbm5lbDJFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2YuTlI1MUlzQ2hhbm5lbDNFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2YuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25MZWZ0T3V0cHV0PSEwO2YuTlI1MUlzQ2hhbm5lbDFFbmFibGVkT25SaWdodE91dHB1dD0hMDtmLk5SNTFJc0NoYW5uZWwyRW5hYmxlZE9uUmlnaHRPdXRwdXQ9ITA7Zi5OUjUxSXNDaGFubmVsM0VuYWJsZWRPblJpZ2h0T3V0cHV0PSEwO2YuTlI1MUlzQ2hhbm5lbDRFbmFibGVkT25SaWdodE91dHB1dD0hMDtmLk5SNTJJc1NvdW5kRW5hYmxlZD0hMDtmLmZyYW1lU2VxdWVuY2VDeWNsZUNvdW50ZXI9MDtmLmRvd25TYW1wbGVDeWNsZUNvdW50ZXI9MDtmLmZyYW1lU2VxdWVuY2VyPTA7Zi5hdWRpb1F1ZXVlSW5kZXg9MDtBLmluaXRpYWxpemUoKTtLLmluaXRpYWxpemUoKTtJLmluaXRpYWxpemUoKTtMLmluaXRpYWxpemUoKTtnKGYubWVtb3J5TG9jYXRpb25OUjUwLDExOSk7ZyhmLm1lbW9yeUxvY2F0aW9uTlI1MSwKMjQzKTtnKGYubWVtb3J5TG9jYXRpb25OUjUyLDI0MSk7eC5jaGFubmVsMVNhbXBsZT0xNTt4LmNoYW5uZWwyU2FtcGxlPTE1O3guY2hhbm5lbDNTYW1wbGU9MTU7eC5jaGFubmVsNFNhbXBsZT0xNTt4LmNoYW5uZWwxRGFjRW5hYmxlZD0hMTt4LmNoYW5uZWwyRGFjRW5hYmxlZD0hMTt4LmNoYW5uZWwzRGFjRW5hYmxlZD0hMTt4LmNoYW5uZWw0RGFjRW5hYmxlZD0hMTt4LmxlZnRDaGFubmVsU2FtcGxlVW5zaWduZWRCeXRlPTEyNzt4LnJpZ2h0Q2hhbm5lbFNhbXBsZVVuc2lnbmVkQnl0ZT0xMjc7eC5taXhlclZvbHVtZUNoYW5nZWQ9ITA7eC5taXhlckVuYWJsZWRDaGFuZ2VkPSEwO3gubmVlZFRvUmVtaXhTYW1wbGVzPSExO3AudXBkYXRlSW50ZXJydXB0RW5hYmxlZCgwKTtnKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRFbmFibGVkLHAuaW50ZXJydXB0c0VuYWJsZWRWYWx1ZSk7cC51cGRhdGVJbnRlcnJ1cHRSZXF1ZXN0ZWQoMjI1KTtnKHAubWVtb3J5TG9jYXRpb25JbnRlcnJ1cHRSZXF1ZXN0LApwLmludGVycnVwdHNSZXF1ZXN0ZWRWYWx1ZSk7bi5jdXJyZW50Q3ljbGVzPTA7bi5kaXZpZGVyUmVnaXN0ZXI9MDtuLnRpbWVyQ291bnRlcj0wO24udGltZXJNb2R1bG89MDtuLnRpbWVyRW5hYmxlZD0hMTtuLnRpbWVySW5wdXRDbG9jaz0wO24udGltZXJDb3VudGVyT3ZlcmZsb3dEZWxheT0hMTtuLnRpbWVyQ291bnRlcldhc1Jlc2V0PSExO2IuR0JDRW5hYmxlZD8oZyg2NTI4NCwzMCksbi5kaXZpZGVyUmVnaXN0ZXI9Nzg0MCk6KGcoNjUyODQsMTcxKSxuLmRpdmlkZXJSZWdpc3Rlcj00Mzk4MCk7Zyg2NTI4NywyNDgpO24udGltZXJJbnB1dENsb2NrPTI0ODtNLmN1cnJlbnRDeWNsZXM9MDtNLm51bWJlck9mQml0c1RyYW5zZmVycmVkPTA7Yi5HQkNFbmFibGVkPyhnKDY1MjgyLDEyNCksTS51cGRhdGVUcmFuc2ZlckNvbnRyb2woMTI0KSk6KGcoNjUyODIsMTI2KSxNLnVwZGF0ZVRyYW5zZmVyQ29udHJvbCgxMjYpKTtiLkdCQ0VuYWJsZWQ/KGcoNjUzOTIsMjQ4KSxnKDY1MzU5LDI1NCksCmcoNjUzNTcsMTI2KSxnKDY1MjgwLDIwNyksZyg2NTI5NSwyMjUpLGcoNjUzODgsMjU0KSxnKDY1Mzk3LDE0MykpOihnKDY1MzkyLDI1NSksZyg2NTM1OSwyNTUpLGcoNjUzNTcsMjU1KSxnKDY1MjgwLDIwNyksZyg2NTI5NSwyMjUpKTtNYT0hMTtYLmN5Y2xlc1BlckN5Y2xlU2V0PTJFOTtYLmN5Y2xlU2V0cz0wO1guY3ljbGVzPTA7UC5zdGVwc1BlclN0ZXBTZXQ9MkU5O1Auc3RlcFNldHM9MDtQLnN0ZXBzPTB9LGhhc0NvcmVTdGFydGVkOmZ1bmN0aW9uKCl7cmV0dXJuIE1hPzE6MH0sc2F2ZVN0YXRlOmZ1bmN0aW9uKCl7Yi5zYXZlU3RhdGUoKTt0LnNhdmVTdGF0ZSgpO3Auc2F2ZVN0YXRlKCk7Qi5zYXZlU3RhdGUoKTtkLnNhdmVTdGF0ZSgpO24uc2F2ZVN0YXRlKCk7Zi5zYXZlU3RhdGUoKTtBLnNhdmVTdGF0ZSgpO0suc2F2ZVN0YXRlKCk7SS5zYXZlU3RhdGUoKTtMLnNhdmVTdGF0ZSgpO01hPSExfSxsb2FkU3RhdGU6ZnVuY3Rpb24oKXtiLmxvYWRTdGF0ZSgpO3QubG9hZFN0YXRlKCk7CnAubG9hZFN0YXRlKCk7Qi5sb2FkU3RhdGUoKTtkLmxvYWRTdGF0ZSgpO24ubG9hZFN0YXRlKCk7Zi5sb2FkU3RhdGUoKTtBLmxvYWRTdGF0ZSgpO0subG9hZFN0YXRlKCk7SS5sb2FkU3RhdGUoKTtMLmxvYWRTdGF0ZSgpO01hPSExO1guY3ljbGVzUGVyQ3ljbGVTZXQ9MkU5O1guY3ljbGVTZXRzPTA7WC5jeWNsZXM9MDtQLnN0ZXBzUGVyU3RlcFNldD0yRTk7UC5zdGVwU2V0cz0wO1Auc3RlcHM9MH0saXNHQkM6ZnVuY3Rpb24oKXtyZXR1cm4gYi5HQkNFbmFibGVkPzE6MH0sZ2V0U3RlcHNQZXJTdGVwU2V0OmZ1bmN0aW9uKCl7cmV0dXJuIFAuc3RlcHNQZXJTdGVwU2V0fSxnZXRTdGVwU2V0czpmdW5jdGlvbigpe3JldHVybiBQLnN0ZXBTZXRzfSxnZXRTdGVwczpmdW5jdGlvbigpe3JldHVybiBQLnN0ZXBzfSxleGVjdXRlTXVsdGlwbGVGcmFtZXM6ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPTAsZD0wO2Q8YSYmMDw9YjspYj12YigpLGQrPTE7cmV0dXJuIDA+Yj9iOjB9LGV4ZWN1dGVGcmFtZTp2YiwKZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbzpmdW5jdGlvbihhKXt2b2lkIDA9PT1hJiYoYT0wKTtyZXR1cm4gTGEoITAsYSwtMSl9LGV4ZWN1dGVGcmFtZVVudGlsQnJlYWtwb2ludDpmdW5jdGlvbihhKXtyZXR1cm4gTGEoITAsLTEsYSl9LGV4ZWN1dGVGcmFtZUFuZENoZWNrQXVkaW9VbnRpbEJyZWFrcG9pbnQ6ZnVuY3Rpb24oYSxiKXtyZXR1cm4gTGEoITAsYSxiKX0sZXhlY3V0ZVVudGlsQ29uZGl0aW9uOkxhLGV4ZWN1dGVTdGVwOndiLGdldEN5Y2xlc1BlckN5Y2xlU2V0OmZ1bmN0aW9uKCl7cmV0dXJuIFguY3ljbGVzUGVyQ3ljbGVTZXR9LGdldEN5Y2xlU2V0czpmdW5jdGlvbigpe3JldHVybiBYLmN5Y2xlU2V0c30sZ2V0Q3ljbGVzOmZ1bmN0aW9uKCl7cmV0dXJuIFguY3ljbGVzfSxzZXRKb3lwYWRTdGF0ZTpmdW5jdGlvbihhLGIsZCxmLG0sZyxrLGgpezA8YT90YSgwKTpoYSgwLCExKTswPGI/dGEoMSk6aGEoMSwhMSk7MDxkP3RhKDIpOmhhKDIsITEpOzA8Zj90YSgzKTpoYSgzLAohMSk7MDxtP3RhKDQpOmhhKDQsITEpOzA8Zz90YSg1KTpoYSg1LCExKTswPGs/dGEoNik6aGEoNiwhMSk7MDxoP3RhKDcpOmhhKDcsITEpfSxnZXROdW1iZXJPZlNhbXBsZXNJbkF1ZGlvQnVmZmVyOm1iLGNsZWFyQXVkaW9CdWZmZXI6bmIsV0FTTUJPWV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX01FTU9SWV9TSVpFOkFiLFdBU01CT1lfV0FTTV9QQUdFUzpCYixBU1NFTUJMWVNDUklQVF9NRU1PUllfTE9DQVRJT046MCxBU1NFTUJMWVNDUklQVF9NRU1PUllfU0laRToxMDI0LFdBU01CT1lfU1RBVEVfTE9DQVRJT046MTAyNCxXQVNNQk9ZX1NUQVRFX1NJWkU6MTAyNCxHQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjoyMDQ4LEdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6NjU1MzYsVklERU9fUkFNX0xPQ0FUSU9OOjIwNDgsVklERU9fUkFNX1NJWkU6MTYzODQsV09SS19SQU1fTE9DQVRJT046MTg0MzIsV09SS19SQU1fU0laRTozMjc2OCxPVEhFUl9HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjo1MTIwMCwKT1RIRVJfR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRToxNjM4NCxHUkFQSElDU19PVVRQVVRfTE9DQVRJT046Njc1ODQsR1JBUEhJQ1NfT1VUUFVUX1NJWkU6TmIsR0JDX1BBTEVUVEVfTE9DQVRJT046Njc1ODQsR0JDX1BBTEVUVEVfU0laRToxMjgsQkdfUFJJT1JJVFlfTUFQX0xPQ0FUSU9OOjY3NzEyLEJHX1BSSU9SSVRZX01BUF9TSVpFOjIzNTUyLEZSQU1FX0xPQ0FUSU9OOkJhLEZSQU1FX1NJWkU6OTMxODQsQkFDS0dST1VORF9NQVBfTE9DQVRJT046UGEsQkFDS0dST1VORF9NQVBfU0laRToxOTY2MDgsVElMRV9EQVRBX0xPQ0FUSU9OOmJiLFRJTEVfREFUQV9TSVpFOjE0NzQ1NixPQU1fVElMRVNfTE9DQVRJT046Y2IsT0FNX1RJTEVTX1NJWkU6MTUzNjAsQVVESU9fQlVGRkVSX0xPQ0FUSU9OOkdhLEFVRElPX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OOmliLENIQU5ORUxfMV9CVUZGRVJfU0laRToxMzEwNzIsQ0hBTk5FTF8yX0JVRkZFUl9MT0NBVElPTjpqYiwKQ0hBTk5FTF8yX0JVRkZFUl9TSVpFOjEzMTA3MixDSEFOTkVMXzNfQlVGRkVSX0xPQ0FUSU9OOmtiLENIQU5ORUxfM19CVUZGRVJfU0laRToxMzEwNzIsQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTjpsYixDSEFOTkVMXzRfQlVGRkVSX1NJWkU6MTMxMDcyLENBUlRSSURHRV9SQU1fTE9DQVRJT046JGEsQ0FSVFJJREdFX1JBTV9TSVpFOjEzMTA3MixDQVJUUklER0VfUk9NX0xPQ0FUSU9OOkphLENBUlRSSURHRV9ST01fU0laRTo4MjU4NTYwLERFQlVHX0dBTUVCT1lfTUVNT1JZX0xPQ0FUSU9OOnpiLERFQlVHX0dBTUVCT1lfTUVNT1JZX1NJWkU6NjU1MzUsZ2V0V2FzbUJveU9mZnNldEZyb21HYW1lQm95T2Zmc2V0OnNiLGdldFJlZ2lzdGVyQTpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyQX0sZ2V0UmVnaXN0ZXJCOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJCfSxnZXRSZWdpc3RlckM6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3RlckN9LGdldFJlZ2lzdGVyRDpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRH0sCmdldFJlZ2lzdGVyRTpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRX0sZ2V0UmVnaXN0ZXJIOmZ1bmN0aW9uKCl7cmV0dXJuIGIucmVnaXN0ZXJIfSxnZXRSZWdpc3Rlckw6ZnVuY3Rpb24oKXtyZXR1cm4gYi5yZWdpc3Rlckx9LGdldFJlZ2lzdGVyRjpmdW5jdGlvbigpe3JldHVybiBiLnJlZ2lzdGVyRn0sZ2V0UHJvZ3JhbUNvdW50ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5wcm9ncmFtQ291bnRlcn0sZ2V0U3RhY2tQb2ludGVyOmZ1bmN0aW9uKCl7cmV0dXJuIGIuc3RhY2tQb2ludGVyfSxnZXRPcGNvZGVBdFByb2dyYW1Db3VudGVyOmZ1bmN0aW9uKCl7cmV0dXJuIHkoYi5wcm9ncmFtQ291bnRlcil9LGdldExZOmZ1bmN0aW9uKCl7cmV0dXJuIHQuc2NhbmxpbmVSZWdpc3Rlcn0sZHJhd0JhY2tncm91bmRNYXBUb1dhc21NZW1vcnk6ZnVuY3Rpb24oYSl7dmFyIGM9dC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0WmVyb1N0YXJ0O0MuYmdXaW5kb3dUaWxlRGF0YVNlbGVjdCYmCihjPXQubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0KTt2YXIgZD10Lm1lbW9yeUxvY2F0aW9uVGlsZU1hcFNlbGVjdFplcm9TdGFydDtDLmJnVGlsZU1hcERpc3BsYXlTZWxlY3QmJihkPXQubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0T25lU3RhcnQpO2Zvcih2YXIgZj0wOzI1Nj5mO2YrKylmb3IodmFyIG09MDsyNTY+bTttKyspe3ZhciBnPWYsaD1tLG49ZCszMiooZz4+MykrKGg+PjMpLGw9WShuLDApO2w9RmEoYyxsKTt2YXIgcD1nJTg7Zz1oJTg7Zz03LWc7aD0wO2IuR0JDRW5hYmxlZCYmMDxhJiYoaD1ZKG4sMSkpO3EoNixoKSYmKHA9Ny1wKTt2YXIgcj0wO3EoMyxoKSYmKHI9MSk7bj1ZKGwrMipwLHIpO2w9WShsKzIqcCsxLHIpO3A9MDtxKGcsbCkmJihwKz0xLHA8PD0xKTtxKGcsbikmJihwKz0xKTtsPTMqKDI1NipmK20pO2lmKGIuR0JDRW5hYmxlZCYmMDxhKWg9VWEoaCY3LHAsITEpLGc9ZWEoMCxoKSxuPWVhKDEsaCkscD1lYSgyLGgpLGg9UGErbCwKa1toXT1nLGtbaCsxXT1uLGtbaCsyXT1wO2Vsc2UgZm9yKGc9VGEocCx0Lm1lbW9yeUxvY2F0aW9uQmFja2dyb3VuZFBhbGV0dGUpLG49MDszPm47bisrKWg9UGErbCtuLGtbaF09Z319LGRyYXdUaWxlRGF0YVRvV2FzbU1lbW9yeTpmdW5jdGlvbigpe2Zvcih2YXIgYT0wOzIzPmE7YSsrKWZvcih2YXIgYz0wOzMxPmM7YysrKXt2YXIgZD0wOzE1PGMmJihkPTEpO3ZhciBmPWE7MTU8YSYmKGYtPTE1KTtmPDw9NDtmPTE1PGM/ZisoYy0xNSk6ZitjO3ZhciBnPXQubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdE9uZVN0YXJ0OzE1PGEmJihnPXQubWVtb3J5TG9jYXRpb25UaWxlRGF0YVNlbGVjdFplcm9TdGFydCk7Zm9yKHZhciBoPXQubWVtb3J5TG9jYXRpb25CYWNrZ3JvdW5kUGFsZXR0ZSxrPS0xLG49LTEsbD0wOzg+bDtsKyspZm9yKHZhciBwPTA7NT5wO3ArKyl7dmFyIHI9NCooOCpwK2wpLHU9eSh0Lm1lbW9yeUxvY2F0aW9uU3ByaXRlQXR0cmlidXRlc1RhYmxlK3IrMik7Zj09PQp1JiYocj15KHQubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrciszKSx1PTAsYi5HQkNFbmFibGVkJiZxKDMscikmJih1PTEpLHU9PT1kJiYobj1yLGw9OCxwPTUsaD10Lm1lbW9yeUxvY2F0aW9uU3ByaXRlUGFsZXR0ZU9uZSxxKDQsbikmJihoPXQubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlVHdvKSkpfWlmKGIuR0JDRW5hYmxlZCYmMD5uKXtsPXQubWVtb3J5TG9jYXRpb25UaWxlTWFwU2VsZWN0WmVyb1N0YXJ0O0MuYmdUaWxlTWFwRGlzcGxheVNlbGVjdCYmKGw9dC5tZW1vcnlMb2NhdGlvblRpbGVNYXBTZWxlY3RPbmVTdGFydCk7cD0tMTtmb3Iocj0wOzMyPnI7cisrKWZvcih1PTA7MzI+dTt1Kyspe3ZhciB2PWwrMzIqdStyLHg9WSh2LDApO2Y9PT14JiYocD12LHU9cj0zMil9MDw9cCYmKGs9WShwLDEpKX1mb3IobD0wOzg+bDtsKyspZ2IoZixnLGQsMCw3LGwsOCpjLDgqYStsLDI0OCxiYiwhMSxoLGssbil9fSxkcmF3T2FtVG9XYXNtTWVtb3J5OmZ1bmN0aW9uKCl7Zm9yKHZhciBhPQowOzg+YTthKyspZm9yKHZhciBjPTA7NT5jO2MrKyl7dmFyIGQ9NCooOCpjK2EpO3kodC5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKTt5KHQubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCsxKTt2YXIgZj15KHQubWVtb3J5TG9jYXRpb25TcHJpdGVBdHRyaWJ1dGVzVGFibGUrZCsyKSxnPTE7Qy50YWxsU3ByaXRlU2l6ZSYmKDE9PT1mJTImJi0tZixnKz0xKTtkPXkodC5tZW1vcnlMb2NhdGlvblNwcml0ZUF0dHJpYnV0ZXNUYWJsZStkKzMpO3ZhciBoPTA7Yi5HQkNFbmFibGVkJiZxKDMsZCkmJihoPTEpO3ZhciBrPXQubWVtb3J5TG9jYXRpb25TcHJpdGVQYWxldHRlT25lO3EoNCxkKSYmKGs9dC5tZW1vcnlMb2NhdGlvblNwcml0ZVBhbGV0dGVUd28pO2Zvcih2YXIgbD0wO2w8ZztsKyspZm9yKHZhciBuPTA7OD5uO24rKylnYihmK2wsdC5tZW1vcnlMb2NhdGlvblRpbGVEYXRhU2VsZWN0T25lU3RhcnQsaCwwLDcsbiw4KmEsMTYqYytuKzgqCmwsNjQsY2IsITEsaywtMSxkKX19LGdldERJVjpmdW5jdGlvbigpe3JldHVybiBuLmRpdmlkZXJSZWdpc3Rlcn0sZ2V0VElNQTpmdW5jdGlvbigpe3JldHVybiBuLnRpbWVyQ291bnRlcn0sZ2V0VE1BOmZ1bmN0aW9uKCl7cmV0dXJuIG4udGltZXJNb2R1bG99LGdldFRBQzpmdW5jdGlvbigpe3ZhciBhPW4udGltZXJJbnB1dENsb2NrO24udGltZXJFbmFibGVkJiYoYXw9NCk7cmV0dXJuIGF9LHVwZGF0ZURlYnVnR0JNZW1vcnk6ZnVuY3Rpb24oKXtmb3IodmFyIGE9MDs2NTUzNT5hO2ErKyl7dmFyIGI9cmIoYSk7a1t6YithXT1ifX0sdXBkYXRlOnZiLGVtdWxhdGlvblN0ZXA6d2IsZ2V0QXVkaW9RdWV1ZUluZGV4Om1iLHJlc2V0QXVkaW9RdWV1ZTpuYix3YXNtTWVtb3J5U2l6ZTpBYix3YXNtQm95SW50ZXJuYWxTdGF0ZUxvY2F0aW9uOjEwMjQsd2FzbUJveUludGVybmFsU3RhdGVTaXplOjEwMjQsZ2FtZUJveUludGVybmFsTWVtb3J5TG9jYXRpb246MjA0OCxnYW1lQm95SW50ZXJuYWxNZW1vcnlTaXplOjY1NTM2LAp2aWRlb091dHB1dExvY2F0aW9uOjY3NTg0LGZyYW1lSW5Qcm9ncmVzc1ZpZGVvT3V0cHV0TG9jYXRpb246QmEsZ2FtZWJveUNvbG9yUGFsZXR0ZUxvY2F0aW9uOjY3NTg0LGdhbWVib3lDb2xvclBhbGV0dGVTaXplOjEyOCxiYWNrZ3JvdW5kTWFwTG9jYXRpb246UGEsdGlsZURhdGFNYXA6YmIsc291bmRPdXRwdXRMb2NhdGlvbjpHYSxnYW1lQnl0ZXNMb2NhdGlvbjpKYSxnYW1lUmFtQmFua3NMb2NhdGlvbjokYX0pO2NvbnN0IHRjPWFzeW5jKCk9Pih7aW5zdGFuY2U6e2V4cG9ydHM6c2N9LGJ5dGVNZW1vcnk6T2Eud2FzbUJ5dGVNZW1vcnksdHlwZToiVHlwZVNjcmlwdCJ9KTtsZXQgTmEsYWIsVWIsbDtsPXtncmFwaGljc1dvcmtlclBvcnQ6dm9pZCAwLG1lbW9yeVdvcmtlclBvcnQ6dm9pZCAwLGNvbnRyb2xsZXJXb3JrZXJQb3J0OnZvaWQgMCxhdWRpb1dvcmtlclBvcnQ6dm9pZCAwLHdhc21JbnN0YW5jZTp2b2lkIDAsd2FzbUJ5dGVNZW1vcnk6dm9pZCAwLG9wdGlvbnM6dm9pZCAwLApXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT046MCxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX1NJWkU6MCxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8xX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8yX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ0hBTk5FTF80X09VVFBVVF9MT0NBVElPTjowLApwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxzcGVlZDowLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsYnJlYWtwb2ludDp2b2lkIDAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj1DYShhKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2Ugei5DT05ORUNUOiJHUkFQSElDUyI9PT1iLm1lc3NhZ2Uud29ya2VySWQ/KGwuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxEYShYYi5iaW5kKHZvaWQgMCxsKSxsLmdyYXBoaWNzV29ya2VyUG9ydCkpOiJNRU1PUlkiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhsLm1lbW9yeVdvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLERhKCRiLmJpbmQodm9pZCAwLGwpLGwubWVtb3J5V29ya2VyUG9ydCkpOiJDT05UUk9MTEVSIj09PWIubWVzc2FnZS53b3JrZXJJZD8obC5jb250cm9sbGVyV29ya2VyUG9ydD0KYi5tZXNzYWdlLnBvcnRzWzBdLERhKFpiLmJpbmQodm9pZCAwLGwpLGwuY29udHJvbGxlcldvcmtlclBvcnQpKToiQVVESU8iPT09Yi5tZXNzYWdlLndvcmtlcklkJiYobC5hdWRpb1dvcmtlclBvcnQ9Yi5tZXNzYWdlLnBvcnRzWzBdLERhKFliLmJpbmQodm9pZCAwLGwpLGwuYXVkaW9Xb3JrZXJQb3J0KSk7YmEoTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHouSU5TVEFOVElBVEVfV0FTTTooYXN5bmMoKT0+e2xldCBhO2E9YXdhaXQgdGMoKTtsLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2wud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2JhKE4oe3R5cGU6YS50eXBlfSxiLm1lc3NhZ2VJZCkpfSkoKTticmVhaztjYXNlIHouQ09ORklHOmwud2FzbUluc3RhbmNlLmV4cG9ydHMuY29uZmlnLmFwcGx5KGwsYi5tZXNzYWdlLmNvbmZpZyk7bC5vcHRpb25zPWIubWVzc2FnZS5vcHRpb25zO2JhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB6LlJFU0VUX0FVRElPX1FVRVVFOmwud2FzbUluc3RhbmNlLmV4cG9ydHMucmVzZXRBdWRpb1F1ZXVlKCk7CmJhKE4odm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSB6LlBMQVk6Y2FzZSB6LlBMQVlfVU5USUxfQlJFQUtQT0lOVDppZighbC5wYXVzZWR8fCFsLndhc21JbnN0YW5jZXx8IWwud2FzbUJ5dGVNZW1vcnkpe2JhKE4oe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWwucGF1c2VkPSExO2wuZnBzVGltZVN0YW1wcz1bXTt4YihsKTtsLmZyYW1lU2tpcENvdW50ZXI9MDtsLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtsLmJyZWFrcG9pbnQ9dm9pZCAwO2IubWVzc2FnZS5icmVha3BvaW50JiYobC5icmVha3BvaW50PWIubWVzc2FnZS5icmVha3BvaW50KTtWYihsLDFFMy9sLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7YmEoTih2b2lkIDAsYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIHouUEFVU0U6bC5wYXVzZWQ9ITA7bC51cGRhdGVJZCYmKGNsZWFyVGltZW91dChsLnVwZGF0ZUlkKSxsLnVwZGF0ZUlkPXZvaWQgMCk7YmEoTih2b2lkIDAsYi5tZXNzYWdlSWQpKTsKYnJlYWs7Y2FzZSB6LlJVTl9XQVNNX0VYUE9SVDphPWIubWVzc2FnZS5wYXJhbWV0ZXJzP2wud2FzbUluc3RhbmNlLmV4cG9ydHNbYi5tZXNzYWdlLmV4cG9ydF0uYXBwbHkodm9pZCAwLGIubWVzc2FnZS5wYXJhbWV0ZXJzKTpsLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdKCk7YmEoTih7dHlwZTp6LlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2Ugei5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBjPWwud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoYz1iLm1lc3NhZ2UuZW5kKTthPWwud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxjKS5idWZmZXI7YmEoTih7dHlwZTp6LlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCksW2FdKTticmVha31jYXNlIHouR0VUX1dBU01fQ09OU1RBTlQ6YmEoTih7dHlwZTp6LkdFVF9XQVNNX0NPTlNUQU5ULApyZXNwb25zZTpsLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5jb25zdGFudF0udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2Ugei5GT1JDRV9PVVRQVVRfRlJBTUU6U2IobCk7YnJlYWs7Y2FzZSB6LlNFVF9TUEVFRDpsLnNwZWVkPWIubWVzc2FnZS5zcGVlZDtsLmZwc1RpbWVTdGFtcHM9W107bC50aW1lU3RhbXBzVW50aWxSZWFkeT02MDt4YihsKTtsLmZyYW1lU2tpcENvdW50ZXI9MDtsLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHM9MDtsLndhc21JbnN0YW5jZS5leHBvcnRzLnJlc2V0QXVkaW9RdWV1ZSgpO2JyZWFrO2Nhc2Ugei5JU19HQkM6YT0wPGwud2FzbUluc3RhbmNlLmV4cG9ydHMuaXNHQkMoKTtiYShOKHt0eXBlOnouSVNfR0JDLHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZygiVW5rbm93biBXYXNtQm95IFdvcmtlciBtZXNzYWdlOiIsYil9fSxnZXRGUFM6KCk9PjA8bC50aW1lU3RhbXBzVW50aWxSZWFkeT8KbC5zcGVlZCYmMDxsLnNwZWVkP2wub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlKmwuc3BlZWQ6bC5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGU6bC5mcHNUaW1lU3RhbXBzP2wuZnBzVGltZVN0YW1wcy5sZW5ndGg6MH07RGEobC5tZXNzYWdlSGFuZGxlcil9KSgpOwo=";

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
