import { Component, h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import './audioControl.css';

const audioChannels = WasmBoy._getAudioChannels();

let updateInterval = undefined;

export default class AudioControl extends Component {
  componentDidMount() {
    updateInterval = setInterval(() => this.setState({}), 50);
  }

  componentWillUnmount() {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  }

  getAudioControl(audioChannel, label) {
    return (
      <div class="audio-control__control">
        <h3>{label}</h3>
        <div>
          <b>Muted:</b> {audioChannel.muted ? 'true' : 'false'}
        </div>
        <button onClick={() => audioChannel.mute()}>Mute</button>
        <button onClick={() => audioChannel.unmute()}>Unmute</button>
      </div>
    );
  }

  render() {
    return (
      <div class="audio-control__control">
        <h1>Audio Control</h1>
        {this.getAudioControl(audioChannels.channel1, 'Channel 1')}
        {this.getAudioControl(audioChannels.channel2, 'Channel 2')}
        {this.getAudioControl(audioChannels.channel3, 'Channel 3')}
        {this.getAudioControl(audioChannels.channel4, 'Channel 4')}
      </div>
    );
  }
}
