import { Component, h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import './recorder.css';

const audioChannels = WasmBoy._getAudioChannels();

export default class AudioRecorder extends Component {
  startRecording(audioChannel) {
    audioChannel.startRecording();
    this.setState();
  }

  stopRecording(audioChannel) {
    audioChannel.stopRecording();
    this.setState();
  }

  getAudioChannelRecordingElement(audioChannel, label) {
    let recordingPlayback = '';
    let saveRecording = '';
    if (audioChannel.hasRecording()) {
      const url = audioChannel.getRecordingAsWavBase64EncodedString();
      recordingPlayback = (
        <div>
          <audio controls src={url}>
            Your browser does not support the <code>audio</code> element.
          </audio>
        </div>
      );

      saveRecording = <button onClick={() => audioChannel.downloadRecordingAsWav()}>Download</button>;
    }

    return (
      <div class="audio-control__channel">
        <h3>{label}</h3>
        <div>{audioChannel.recording ? 'Recording...' : 'Not recording'}</div>
        {recordingPlayback}
        <button onClick={() => this.startRecording(audioChannel)}>Start</button>
        <button onClick={() => this.stopRecording(audioChannel)}>Stop</button>
        {saveRecording}
      </div>
    );
  }

  render() {
    return (
      <div class="audio-recorder">
        <h1>Audio Recorder</h1>
        <div>
          <i>
            The recorder works by copying the buffer given by the core emulation into a memory object. Thus, any stuttering, slowdows, audio
            effects, or muting will not be in the recording.
          </i>
        </div>
        {this.getAudioChannelRecordingElement(audioChannels.master, 'Master')}
        {this.getAudioChannelRecordingElement(audioChannels.channel1, 'Channel 1')}
        {this.getAudioChannelRecordingElement(audioChannels.channel2, 'Channel 2')}
        {this.getAudioChannelRecordingElement(audioChannels.channel3, 'Channel 3')}
        {this.getAudioChannelRecordingElement(audioChannels.channel4, 'Channel 4')}
      </div>
    );
  }
}
