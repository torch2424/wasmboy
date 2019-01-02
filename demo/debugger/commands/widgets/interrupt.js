// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import InterruptState from '../../components/interrupt/interruptState/interruptState';

class InterruptStateCommand extends Command {
  constructor() {
    super('interrupt:state');
    this.options.label = 'State';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <InterruptState />,
      label: 'Interrupt State'
    });
  }
}

const exportedCommands = [new InterruptStateCommand()];
export default exportedCommands;
