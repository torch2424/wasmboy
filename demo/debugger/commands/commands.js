import phosphorCommands from '@phosphor/commands';

// Commands
import openCommands from './open';
import playbackCommands from './widgets/playback';
import cpuCommands from './widgets/cpu';
import memoryCommands from './widgets/memory';
import graphicsCommands from './widgets/graphics';
import audioCommands from './widgets/audio';
import interruptCommands from './widgets/interrupt';
import timerCommands from './widgets/timer';
import otherCommands from './widgets/other';

const importedCommands = [
  openCommands,
  playbackCommands,
  cpuCommands,
  memoryCommands,
  graphicsCommands,
  audioCommands,
  interruptCommands,
  timerCommands,
  otherCommands
];

// Commands that will be execute by click actions and things
const commands = new phosphorCommands.CommandRegistry();

importedCommands.forEach(importedCommand => {
  importedCommand.forEach(command => {
    commands.addCommand(command.id, command.options);
  });
});

export default commands;
