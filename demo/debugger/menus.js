// All of our top bar menus

import phosphorWidgets from '@phosphor/widgets';

import commands from './commands/commands';

import openCommands from './commands/open';
import playbackCommands from './commands/widgets/playback';
import cpuCommands from './commands/widgets/cpu';

const menus = [];

const addCommandsToMenu = (commands, menu) => {
  commands.forEach(command => {
    menu.addItem({ command: command.id });
  });
};

// Open
let openMenu = new phosphorWidgets.Menu({ commands });
openMenu.title.label = 'Open';
addCommandsToMenu(openCommands, openMenu);
menus.push(openMenu);

// Widgets
let widgetMenu = new phosphorWidgets.Menu({ commands });
widgetMenu.title.label = 'Widgets';

// Playback Sub Menu
let playbackSubMenu = new phosphorWidgets.Menu({ commands });
playbackSubMenu.title.label = 'Playback';
addCommandsToMenu(playbackCommands, playbackSubMenu);
widgetMenu.addItem({ type: 'submenu', submenu: playbackSubMenu });

let cpuSubMenu = new phosphorWidgets.Menu({ commands });
cpuSubMenu.title.label = 'CPU';
addCommandsToMenu(cpuCommands, cpuSubMenu);
widgetMenu.addItem({ type: 'submenu', submenu: cpuSubMenu });

menus.push(widgetMenu);

export default menus;
