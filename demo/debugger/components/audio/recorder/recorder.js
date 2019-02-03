import { Component, h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import './recorder.css';

const audioChannels = WasmBoy._getAudioChannels();

let updateInterval = undefined;

export default class AudioRecorder extends Component {
  componentDidMount() {
    updateInterval = setInterval(() => this.setState({}), 50);
  }

  componentWillUnmount() {
    if (updateInerval) {
      clearInterval(updateInterval);
    }
  }

  getAudioChannelRecordingElement(audioChannel, label) {
    return (
      <div class="audio-control__channel">
        <h3>{label}</h3>
        <div>{audioChannel.recording ? 'Recording...' : 'Not recording'}</div>
        <button onClick={() => audioChannel.startRecording()}>Start</button>
        <button onClick={() => audioChannel.stopRecording()}>Stop</button>
      </div>
    );
  }

  render() {
    return (
      <div class="audio-recorder">
        <h1>Audio Recorder</h1>
        {this.getAudioChannelRecordingElement(audioChannels.master, 'Master')}
        {this.getAudioChannelRecordingElement(audioChannels.channel1, 'Channel 1')}
        {this.getAudioChannelRecordingElement(audioChannels.channel2, 'Channel 2')}
        {this.getAudioChannelRecordingElement(audioChannels.channel3, 'Channel 3')}
        {this.getAudioChannelRecordingElement(audioChannels.channel4, 'Channel 4')}
      </div>
    );
  }
}
