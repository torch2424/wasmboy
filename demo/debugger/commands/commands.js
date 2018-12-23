import phosphorCommands from '@phosphor/commands';

// Commands
import openCommands from './open';
const importedCommands = [openCommands];

// Commands that will be execute by click actions and things
const commands = new phosphorCommands.CommandRegistry();

importedCommands.forEach(importedCommand => {
  importedCommand.forEach(command => {
    commands.addCommand(command.id, command.options);
  });
});

export default commands;
