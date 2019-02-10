import AudioVisualizer from '../visualizer';

import './waveform.css';

export default class AudioWaveform extends AudioVisualizer {
  constructor() {
    super('Waveform', 'waveform', 'getFloatTimeDomainData');
  }

  drawVisualization(visualizationChannels) {
    Object.keys(visualizationChannels).forEach(channelKey => {
      const visualizationChannel = visualizationChannels[channelKey];

      // Check if we are muted
      // If we are, draw a straight line
      if (visualizationChannel.muted) {
        visualizationChannel.canvasContext.clearRect(
          0,
          0,
          visualizationChannel.canvasElement.width,
          visualizationChannel.canvasElement.height
        );
        visualizationChannel.canvasContext.beginPath();
        visualizationChannel.canvasContext.moveTo(0, visualizationChannel.canvasElement.height / 2);
        visualizationChannel.canvasContext.lineTo(visualizationChannel.canvasElement.width, visualizationChannel.canvasElement.height / 2);
        visualizationChannel.canvasContext.stroke();
        return;
      }

      // Update our waveform
      visualizationChannel.analyser.getFloatTimeDomainData(visualizationChannel.visualization);

      visualizationChannel.canvasContext.clearRect(
        0,
        0,
        visualizationChannel.canvasElement.width,
        visualizationChannel.canvasElement.height
      );
      visualizationChannel.canvasContext.beginPath();
      for (let i = 0; i < visualizationChannel.visualization.length; i++) {
        const x = i;
        const y = (0.5 + visualizationChannel.visualization[i] * 2) * visualizationChannel.canvasElement.height;
        if (i == 0) {
          visualizationChannel.canvasContext.moveTo(x, y);
        } else {
          visualizationChannel.canvasContext.lineTo(x, y);
        }
      }
      visualizationChannel.canvasContext.stroke();
    });
  }
}
