// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import AudioState from '../../components/audio/audioState/audioState';

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

const exportedCommands = [new AudioStateCommand()];
export default exportedCommands;
