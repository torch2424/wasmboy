// All of our top bar menus

import phosphorWidgets from '@phosphor/widgets';

import commands from './commands/commands';
import openCommands from './commands/open';

const menus = [];

// Open
let openMenu = new phosphorWidgets.Menu({ commands });
openMenu.title.label = 'Open';
openCommands.forEach(command => {
  openMenu.addItem({ command: command.id });
});
menus.push(openMenu);

export default menus;
