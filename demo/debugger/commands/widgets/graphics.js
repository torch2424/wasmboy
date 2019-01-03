// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import GraphicsState from '../../components/graphics/graphicsState/graphicsState';
import BackgroundMap from '../../components/graphics/backgroundMap/backgroundMap';

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

class BackgroundMapCommand extends Command {
  constructor() {
    super('graphics:backgroundmap');
    this.options.label = 'Background Map';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <BackgroundMap />,
      label: 'Background Map'
    });
  }
}

const exportedCommands = [new GraphicsStateCommand(), new BackgroundMapCommand()];
export default exportedCommands;
