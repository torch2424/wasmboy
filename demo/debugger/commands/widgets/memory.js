// Commands for memory

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import MemoryViewer from '../../components/memory/viewer/viewer';

class MemoryViewerCommand extends Command {
  constructor() {
    super('memory:viewer');
    this.options.label = 'Viewer';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <MemoryViewer />,
      label: 'Memory Viewer'
    });
  }
}

const exportedCommands = [new MemoryViewerCommand()];
export default exportedCommands;
