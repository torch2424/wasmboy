import AudioVisualizer from '../visualizer';

import './frequency.css';

export default class AudioFrequency extends AudioVisualizer {
  constructor() {
    super('Frequency', 'frequency', 'getByteFrequencyData');
  }

  drawVisualization(visualizationChannels) {
    Object.keys(visualizationChannels).forEach(channelKey => {
      const visualizationChannel = visualizationChannels[channelKey];

      visualizationChannel.canvasContext.clearRect(
        0,
        0,
        visualizationChannel.canvasElement.width,
        visualizationChannel.canvasElement.height
      );

      // Check if we are muted
      // If we are, draw a straight line
      if (visualizationChannel.muted) {
        visualizationChannel.canvasContext.beginPath();
        visualizationChannel.canvasContext.moveTo(0, visualizationChannel.canvasElement.height / 2);
        visualizationChannel.canvasContext.lineTo(visualizationChannel.canvasElement.width, visualizationChannel.canvasElement.height / 2);
        visualizationChannel.canvasContext.stroke();
        return;
      }

      // Update our waveform
      // https://stackoverflow.com/questions/44502536/determining-frequencies-in-js-audiocontext-analysernode
      visualizationChannel.analyser.getByteFrequencyData(visualizationChannel.visualization);

      // Get our bar info
      const barWidth = visualizationChannel.canvasElement.width / visualizationChannel.analyser.frequencyBinCount;

      visualizationChannel.canvasContext.beginPath();
      for (let i = 0; i < visualizationChannel.visualization.length; i++) {
        // Get the frequency as a percentage
        const value = visualizationChannel.visualization[i];
        const percent = value / 256;

        const height = visualizationChannel.canvasElement.height * percent;
        const offset = visualizationChannel.canvasElement.height - height - 1;

        // Get our color for our frequency
        const hue = (i / visualizationChannel.analyser.frequencyBinCount) * 360;

        visualizationChannel.canvasContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
        visualizationChannel.canvasContext.fillRect(i * barWidth, offset, barWidth, height);
      }
    });
  }
}
