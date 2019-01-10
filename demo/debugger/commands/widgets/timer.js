// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import TimerState from '../../components/timer/timerState/timerState';

class TimerStateCommand extends Command {
  constructor() {
    super('timer:state');
    this.options.label = 'State';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <TimerState />,
      label: 'Timer State'
    });
  }
}

const exportedCommands = [new TimerStateCommand()];
export default exportedCommands;
