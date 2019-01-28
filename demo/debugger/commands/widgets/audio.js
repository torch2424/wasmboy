// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import AudioState from '../../components/audio/audioState/audioState';
import AudioWaveform from '../../components/audio/waveform/waveform';

class AudioStateCommand extends Command {
  constructor() {
    super('audio:state');
    this.options.label = 'State';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <AudioState />,
      label: 'Audio State'
    });
  }
}

class AudioWaveformCommand extends Command {
  constructor() {
    super('audio:waveform');
    this.options.label = 'Waveform';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <AudioWaveform />,
      label: 'Waveform'
    });
  }
}

const exportedCommands = [new AudioStateCommand(), new AudioWaveformCommand()];
export default exportedCommands;
