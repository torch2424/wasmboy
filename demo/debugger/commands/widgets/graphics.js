// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import GraphicsState from '../../components/graphics/graphicsState/graphicsState';

class GraphicsStateCommand extends Command {
  constructor() {
    super('graphics:state');
    this.options.label = 'State';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <GraphicsState />,
      label: 'Graphics State'
    });
  }
}

const exportedCommands = [new GraphicsStateCommand()];
export default exportedCommands;
