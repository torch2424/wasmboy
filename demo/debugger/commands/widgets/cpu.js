// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import CpuState from '../../components/cpu/cpuState/cpuState';

class CpuStateCommand extends Command {
  constructor() {
    super('cpu:state');
    this.options.label = 'State';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <CpuState />,
      label: 'CPU State'
    });
  }
}

const exportedCommands = [new CpuStateCommand()];
export default exportedCommands;
