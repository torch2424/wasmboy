import { Component, h } from 'preact';

import { WasmBoy } from '../../wasmboy';

import './visualizer.css';

let updateInterval = undefined;

const audioChannels = WasmBoy._getAudioChannels();

// https://noisehack.com/build-music-visualizer-web-audio-api/
// https://github.com/borismus/webaudioapi.com/tree/master/content/posts/visualizer
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API
// https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
export default class AudioVisualizer extends Component {
  constructor(title, key, analyserNodeGetDataKey) {
    super();
    this.title = title;
    this.analyserNodeGetDataKey = analyserNodeGetDataKey;
    this.audioVisualizations = {};

    // Set up for our plugin
    this.pluginAnalysers = {};
    this.removePlugin = undefined;
  }

  componentDidMount() {
    // Get all of our channels' canvases, and apply analyser nodes
    Object.keys(audioChannels).forEach(audioChannelKey => {
      // Add Analyser nodes
      // And configure for a plesant looking result
      const analyser = audioChannels[audioChannelKey].audioContext.createAnalyser();
      analyser.smoothingTimeConstant = 0.4;

      this.pluginAnalysers[audioChannelKey] = analyser;

      let visualization;
      if (this.analyserNodeGetDataKey.includes('Float')) {
        visualization = new Float32Array(analyser.frequencyBinCount);
      } else {
        visualization = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser[this.analyserNodeGetDataKey](visualization);

      // Get our canvas
      const canvasElement = this.base.querySelector(`.audio-${this.key}__${audioChannelKey} canvas`);
      canvasElement.width = visualization.length;
      canvasElement.height = 200;
      const canvasContext = canvasElement.getContext('2d');
      canvasContext.lineWidth = 3.0;

      this.audioVisualizations[audioChannelKey] = {
        canvasElement,
        canvasContext,
        analyser,
        visualization
      };
    });

    // Add a plugin for our analysers
    this.removePlugin = WasmBoy.addPlugin({
      name: 'WasmBoy Debugger Visualizer',
      audio: (audioContext, audioNode, channelId) => {
        return this.pluginAnalysers[channelId];
      }
    });

    this.update();
    // Update at ~30fps
    updateInterval = setInterval(() => this.update(), 32);
  }

  componentWillUnmount() {
    clearInterval(updateInterval);
    if (this.removePlugin) {
      this.removePlugin();
      this.removePlugin = undefined;
    }
  }

  update() {
    if (WasmBoy.isPlaying()) {
      // Call the drawVisualization
      if (this.drawVisualization) {
        // Make an object with everything we need to know
        const visualizationChannels = {};
        Object.keys(audioChannels).forEach(audioChannelKey => {
          visualizationChannels[audioChannelKey] = {
            muted: audioChannels[audioChannelKey].muted
          };

          Object.keys(this.audioVisualizations[audioChannelKey]).forEach(visualizationKey => {
            visualizationChannels[audioChannelKey][visualizationKey] = this.audioVisualizations[audioChannelKey][visualizationKey];
          });
        });

        this.drawVisualization(visualizationChannels);
      }
    }
  }

  render() {
    const getAudioChannelElement = (id, name) => {
      return (
        <div class={`audio-visualizer__${id} audio-${this.key}__${id} audio-visualizer__channel-element`}>
          <h3>{name}</h3>
          <canvas />
        </div>
      );
    };

    return (
      <div class="audio-visualizer">
        <h1>{this.title}</h1>
        {getAudioChannelElement('master', 'Master')}
        {getAudioChannelElement('channel1', 'Channel 1')}
        {getAudioChannelElement('channel2', 'Channel 2')}
        {getAudioChannelElement('channel3', 'Channel 3')}
        {getAudioChannelElement('channel4', 'Channel 4')}
      </div>
    );
  }
}
