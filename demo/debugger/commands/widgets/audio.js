// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import AudioState from '../../components/audio/audioState/audioState';
import AudioControl from '../../components/audio/audioControl/audioControl';
import AudioWaveform from '../../components/audio/waveform/waveform';
import AudioRecorder from '../../components/audio/recorder/recorder';

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

class AudioControlCommand extends Command {
  constructor() {
    super('audio:control');
    this.options.label = 'Control';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <AudioControl />,
      label: 'Audio Control'
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

class AudioRecorderCommand extends Command {
  constructor() {
    super('audio:recorder');
    this.options.label = 'Recorder';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <AudioRecorder />,
      label: 'Recorder'
    });
  }
}

const exportedCommands = [new AudioStateCommand(), new AudioControlCommand(), new AudioWaveformCommand(), new AudioRecorderCommand()];
export default exportedCommands;
