import { Component, h } from 'preact';

import { WasmBoy } from '../../wasmboy';

import './visualizer.css';

let updateInterval = undefined;

const audioChannels = WasmBoy._getAudioChannels();
const audioVisualizations = {};

// https://noisehack.com/build-music-visualizer-web-audio-api/
// https://github.com/borismus/webaudioapi.com/tree/master/content/posts/visualizer
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API
// https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
export default class AudioVisualizer extends Component {
  constructor(title, analyserNodeGetDataKey) {
    super();
    this.title = title;
    this.analyserNodeGetDataKey = analyserNodeGetDataKey;
  }

  componentDidMount() {
    // Get all of our channels' canvases, and apply analyser nodes
    Object.keys(audioChannels).forEach(audioChannelKey => {
      // Add Analyser nodes
      const analyser = audioChannels[audioChannelKey].audioContext.createAnalyser();
      audioChannels[audioChannelKey].additionalAudioNodes.push(analyser);

      const visualization = new Float32Array(analyser.frequencyBinCount);
      analyser[this.analyserNodeGetDataKey](visualization);

      // Get our canvas
      const canvasElement = this.base.querySelector(`.audio-visualizer__${audioChannelKey} canvas`);
      canvasElement.width = visualization.length;
      canvasElement.height = 200;
      const canvasContext = canvasElement.getContext('2d');
      canvasContext.lineWidth = 3.0;

      audioVisualizations[audioChannelKey] = {
        canvasElement,
        canvasContext,
        analyser,
        visualization
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
        audioChannels[audioChannelKey].additionalAudioNodes.indexOf(audioVisualizations[audioChannelKey].analyser),
        1
      );
    });
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

          Object.keys(audioVisualizations[audioChannelKey]).forEach(visualizationKey => {
            visualizationChannels[audioChannelKey][visualizationKey] = audioVisualizations[audioChannelKey][visualizationKey];
          });
        });

        this.drawVisualization(visualizationChannels);
      }
    }
  }

  render() {
    const getAudioChannelElement = (id, name) => {
      return (
        <div class={'audio-visualizer__' + id + ' audio-visualizer__channel-element'}>
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
