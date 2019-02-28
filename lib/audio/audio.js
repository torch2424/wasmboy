// Tons of help from:
// https://binji.github.io/2017/02/27/binjgb-on-the-web-part-2.html
// https://github.com/binji/binjgb/blob/master/demo/demo.js
// Web Audio API is tricky!

import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';

import GbChannelWebAudio from './gbchannel';

// The minimum fps we can have, before we start time stretching for slowness
const SLOW_TIME_STRETCH_MIN_FPS = 57;

class WasmBoyAudioService {
  constructor() {
    // Wasmboy instance and memory
    this.worker = undefined;
    this.updateAudioCallback = undefined;

    // Our Channels
    this.gbChannels = {
      master: new GbChannelWebAudio('master'),
      channel1: new GbChannelWebAudio('channel1'),
      channel2: new GbChannelWebAudio('channel2'),
      channel3: new GbChannelWebAudio('channel3'),
      channel4: new GbChannelWebAudio('channel4')
    };
    this._createAudioContextIfNone();

    // Mute all the child channels,
    // As we will assume all channels are enabled
    if (typeof window !== 'undefined') {
      this.gbChannels.channel1._libMute();
      this.gbChannels.channel2._libMute();
      this.gbChannels.channel3._libMute();
      this.gbChannels.channel4._libMute();
    }

    // Average fps for time stretching
    this.averageTimeStretchFps = [];

    this.speed = 1.0;

    // Our sound output Location, we will initialize this in init
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
      this.cancelAllAudio();

      // Lastly get our audio constants
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
        case WORKER_MESSAGE_TYPE.UPDATED: {
          // Dont wait for raf.
          // Audio being shown is not dependent on the browser drawing a frame :)

          // Just send the message directly
          this.playAudio(eventData.message);

          // Next, send back how much forward latency
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
  }

  // Function to queue up and audio buyffer to be played
  // Returns a promise so that we may "sync by audio"
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/dau8e2w/
  playAudio(audioMessage) {
    let currentFps = audioMessage.fps;
    let allowFastSpeedStretching = audioMessage.allowFastSpeedStretching;
    let numberOfSamples = audioMessage.numberOfSamples;

    // Find our averageFps
    let fps = currentFps || 60;

    // Check if we got a huge fps outlier.
    // If so, let's just reset our average.
    // This will fix the slow gradual ramp down
    const fpsDifference = Math.abs(currentFps - this.averageTimeStretchFps[this.averageTimeStretchFps.length - 1]);
    if (fpsDifference && fpsDifference >= 15) {
      this.resetTimeStretch();
    }

    // Find our average fps for time stretching
    this.averageTimeStretchFps.push(currentFps);
    // TODO Make the multiplier Const the timeshift speed
    if (this.averageTimeStretchFps.length > Math.floor(SLOW_TIME_STRETCH_MIN_FPS * 3)) {
      this.averageTimeStretchFps.shift();
    }

    // Make sure we have a minimum number of time stretch fps timestamps to judge the average time
    if (this.averageTimeStretchFps.length >= SLOW_TIME_STRETCH_MIN_FPS) {
      fps = this.averageTimeStretchFps.reduce((accumulator, currentValue) => {
        return accumulator + currentValue;
      });
      fps = Math.floor(fps / this.averageTimeStretchFps.length);
    }

    // Find if we should time stretch this sample or not from our current fps
    let playbackRate = 1.0;
    let shouldTimeStretch = (fps < SLOW_TIME_STRETCH_MIN_FPS || allowFastSpeedStretching) && this.speed === 1.0;
    if (shouldTimeStretch) {
      // Has to be 60 to get accurent playback regarless of fps cap
      playbackRate = playbackRate * (fps / 60);
      if (playbackRate <= 0) {
        playbackRate = 0.01;
      }
    }

    // Apply our speed to the playback rate
    playbackRate = playbackRate * this.speed;

    // Play the master channel
    this.gbChannels.master.playAudio(
      numberOfSamples,
      audioMessage.audioBuffer.left,
      audioMessage.audioBuffer.right,
      playbackRate,
      this.updateAudioCallback
    );

    // Play on all of our channels if we have buffers for them
    for (let i = 0; i < 4; i++) {
      let channelNumber = i + 1;

      if (audioMessage[`channel${channelNumber}Buffer`]) {
        this.gbChannels[`channel${channelNumber}`].playAudio(
          numberOfSamples,
          audioMessage[`channel${channelNumber}Buffer`].left,
          audioMessage[`channel${channelNumber}Buffer`].right,
          playbackRate,
          this.updateAudioCallback
        );
      }
    }

    let playingAllChannels =
      !this.gbChannels.channel1.muted &&
      !this.gbChannels.channel2.muted &&
      !this.gbChannels.channel3.muted &&
      !this.gbChannels.channel4.muted;

    // Mute and unmute accordingly
    if (this.gbChannels.master.muted && playingAllChannels) {
      this.gbChannels.master.unmute();

      // We want to "force" mute here
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
  }

  // Functions to simply run on all of our channels

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

export const WasmBoyAudio = new WasmBoyAudioService();
