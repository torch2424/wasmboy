// Commands for playback

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import WasmBoyControls from '../../components/wasmboyControls/wasmboyControls';
import WasmBoyInfo from '../../components/wasmboyInfo/wasmboyInfo';

class PlaybackControls extends Command {
  constructor() {
    super('playback:controls');
    this.options.label = 'Controls';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <WasmBoyControls />,
      label: 'Playback Controls'
    });
  }
}

class PlaybackInfo extends Command {
  constructor() {
    super('playback:info');
    this.options.label = 'Info';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <WasmBoyInfo />,
      label: 'Playback Info'
    });
  }
}

const exportedCommands = [new PlaybackControls(), new PlaybackInfo()];
export default exportedCommands;
