// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import CpuState from '../../components/cpu/cpuState/cpuState';
import CpuControl from '../../components/cpu/cpuControl/cpuControl';
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

class CpuControlCommand extends Command {
  constructor() {
    super('cpu:control');
    this.options.label = 'Control';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <CpuControl />,
      label: 'CPU Control'
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

const exportedCommands = [new CpuStateCommand(), new CpuControlCommand(), new DisassemblerCommand()];
export default exportedCommands;
