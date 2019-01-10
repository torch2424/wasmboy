// Commands for other components

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import AboutComponent from '../../components/other/about/about';
import HelpComponent from '../../components/other/help/help';

class AboutCommand extends Command {
  constructor() {
    super('other:about');
    this.options.label = 'About';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <AboutComponent />,
      label: 'About'
    });
  }
}

class HelpCommand extends Command {
  constructor() {
    super('other:help');
    this.options.label = 'Help';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <HelpComponent />,
      label: 'Help'
    });
  }
}

const exportedCommands = [new AboutCommand(), new HelpCommand()];
export default exportedCommands;
