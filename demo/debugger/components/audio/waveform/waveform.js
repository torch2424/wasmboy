import { Component, h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import './waveform.css';

let updateInterval = undefined;

const audioChannels = WasmBoy._getAudioChannels();
const audioWaveforms = {};

// https://noisehack.com/build-music-visualizer-web-audio-api/
export default class AudioWaveform extends Component {
  componentDidMount() {
    // Get all of our channels' canvases, and apply analyser nodes
    Object.keys(audioChannels).forEach(audioChannelKey => {
      // Add Analyser nodes
      const analyser = audioChannels[audioChannelKey].audioContext.createAnalyser();
      audioChannels[audioChannelKey].additionalAudioNodes.push(analyser);

      const waveform = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatTimeDomainData(waveform);

      // Get our canvas
      const canvasElement = this.base.querySelector(`.audio-waveform__${audioChannelKey} canvas`);
      canvasElement.width = waveform.length;
      canvasElement.height = 200;
      const canvasContext = canvasElement.getContext('2d');
      canvasContext.lineWidth = 3.0;

      audioWaveforms[audioChannelKey] = {
        canvasElement,
        canvasContext,
        analyser,
        waveform
      };
    });

    this.update();
    // Update at ~30fps
    setInterval(() => this.update(), 32);
  }

  componentWillUnmount() {
    clearInterval(updateInterval);

    Object.keys(audioChannels).forEach(audioChannelKey => {
      // Remove our analyser nodes
      audioChannels[audioChannelKey].additionalAudioNodes.splice(
        audioChannels[audioChannelKey].additionalAudioNodes.indexOf(audioWaveforms[audioChannelKey].analyser),
        1
      );
    });
  }

  update() {
    if (WasmBoy.isPlaying()) {
      Object.keys(audioChannels).forEach(audioChannelKey => {
        const audioWaveform = audioWaveforms[audioChannelKey];

        // Check if we are muted
        // If we are, draw a straight line
        if (audioChannels[audioChannelKey].muted) {
          audioWaveform.canvasContext.clearRect(0, 0, audioWaveform.canvasElement.width, audioWaveform.canvasElement.height);
          audioWaveform.canvasContext.beginPath();
          audioWaveform.canvasContext.moveTo(0, audioWaveform.canvasElement.height / 2);
          audioWaveform.canvasContext.lineTo(audioWaveform.canvasElement.width, audioWaveform.canvasElement.height / 2);
          audioWaveform.canvasContext.stroke();
          return;
        }

        // Update our waveform
        audioWaveform.analyser.getFloatTimeDomainData(audioWaveform.waveform);

        audioWaveform.canvasContext.clearRect(0, 0, audioWaveform.canvasElement.width, audioWaveform.canvasElement.height);
        audioWaveform.canvasContext.beginPath();
        for (let i = 0; i < audioWaveform.waveform.length; i++) {
          const x = i;
          const y = (0.5 + audioWaveform.waveform[i] * 2) * audioWaveform.canvasElement.height;
          if (i == 0) {
            audioWaveform.canvasContext.moveTo(x, y);
          } else {
            audioWaveform.canvasContext.lineTo(x, y);
          }
        }
        audioWaveform.canvasContext.stroke();
      });
    }
  }

  render() {
    const getAudioChannelElement = (id, name) => {
      return (
        <div class={'audio-waveform__' + id + ' audio-waveform__channel-element'}>
          <h3>{name}</h3>
          <canvas />
        </div>
      );
    };

    return (
      <div class="audio-waveform">
        <h1>Waveform</h1>
        {getAudioChannelElement('master', 'Master')}
        {getAudioChannelElement('channel1', 'Channel 1')}
        {getAudioChannelElement('channel2', 'Channel 2')}
        {getAudioChannelElement('channel3', 'Channel 3')}
        {getAudioChannelElement('channel4', 'Channel 4')}
      </div>
    );
  }
}
