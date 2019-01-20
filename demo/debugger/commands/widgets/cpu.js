// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import CpuState from '../../components/cpu/cpuState/cpuState';
import Disassembler from '../../components/cpu/disassembler/disassembler';

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

class DisassemblerCommand extends Command {
  constructor() {
    super('cpu:disassembler');
    this.options.label = 'Disassembler';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <Disassembler />,
      label: 'Disassembler'
    });
  }
}

const exportedCommands = [new CpuStateCommand(), new DisassemblerCommand()];
export default exportedCommands;
