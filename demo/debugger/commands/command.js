// Base Class for all of out other commands
export default class Command {
  constructor(id) {
    this.id = id;

    // http://phosphorjs.github.io/phosphor/api/commands/interfaces/commandregistry.icommandoptions.html
    this.options = {
      label: 'Command',
      execute: () => this.execute()
    };
  }

  execute() {
    console.log('Command Executed!');
  }
}
