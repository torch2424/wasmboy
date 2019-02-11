// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import GraphicsState from '../../components/graphics/graphicsState/graphicsState';
import BackgroundMap from '../../components/graphics/backgroundMap/backgroundMap';
import TileData from '../../components/graphics/tileData/tileData';
import OamViewer from '../../components/graphics/oamViewer/oamViewer';
import PaletteViewer from '../../components/graphics/paletteViewer/paletteViewer';

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

class TileDataCommand extends Command {
  constructor() {
    super('graphics:tiledata');
    this.options.label = 'Tile Data';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <TileData />,
      label: 'Tile Data'
    });
  }
}

class OamViewerCommand extends Command {
  constructor() {
    super('graphics:oamviewer');
    this.options.label = 'Oam Viewer';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <OamViewer />,
      label: 'Oam Viewer'
    });
  }
}

class PaletteViewerCommand extends Command {
  constructor() {
    super('graphics:paletteviewer');
    this.options.label = 'Palette Viewer';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <PaletteViewer />,
      label: 'Palette Viewer'
    });
  }
}

const exportedCommands = [
  new GraphicsStateCommand(),
  new BackgroundMapCommand(),
  new TileDataCommand(),
  new OamViewerCommand(),
  new PaletteViewerCommand()
];
export default exportedCommands;
