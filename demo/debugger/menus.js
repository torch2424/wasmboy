// All of our top bar menus

import phosphorWidgets from '@phosphor/widgets';

import commands from './commands/commands';

import openCommands from './commands/open';
import playbackCommands from './commands/widgets/playback';
import cpuCommands from './commands/widgets/cpu';
import graphicsCommands from './commands/widgets/graphics';
import audioCommands from './commands/widgets/audio';
import interruptCommands from './commands/widgets/interrupt';
import timerCommands from './commands/widgets/timer';

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

// CPU
let cpuSubMenu = new phosphorWidgets.Menu({ commands });
cpuSubMenu.title.label = 'CPU';
addCommandsToMenu(cpuCommands, cpuSubMenu);
widgetMenu.addItem({ type: 'submenu', submenu: cpuSubMenu });

// Graphics
let graphicsSubMenu = new phosphorWidgets.Menu({ commands });
graphicsSubMenu.title.label = 'Graphics';
addCommandsToMenu(graphicsCommands, graphicsSubMenu);
widgetMenu.addItem({ type: 'submenu', submenu: graphicsSubMenu });

// Audio
let audioSubMenu = new phosphorWidgets.Menu({ commands });
audioSubMenu.title.label = 'Audio';
addCommandsToMenu(audioCommands, audioSubMenu);
widgetMenu.addItem({ type: 'submenu', submenu: audioSubMenu });

// Interrupt
let interruptSubMenu = new phosphorWidgets.Menu({ commands });
interruptSubMenu.title.label = 'Interrupt';
addCommandsToMenu(interruptCommands, interruptSubMenu);
widgetMenu.addItem({ type: 'submenu', submenu: interruptSubMenu });

// Timer
let timerSubMenu = new phosphorWidgets.Menu({ commands });
timerSubMenu.title.label = 'Timer';
addCommandsToMenu(timerCommands, timerSubMenu);
widgetMenu.addItem({ type: 'submenu', submenu: timerSubMenu });

menus.push(widgetMenu);

export default menus;
