import { h, render, Component } from 'preact';
import phosphorCommands from '@phosphor/commands';
import phosphorMessaging from '@phosphor/messaging';
import phosphorWidgets from '@phosphor/widgets';
import './index.css';

import packageJson from '../../package.json';

class WasmBoyDebuggerApp extends Component {
  constructor() {
    super();
  }

  render() {
    return <div class="tall">Hello Debugger!</div>;
  }
}

const createPreactNode = () => {
  let node = document.createElement('div');
  let content = document.createElement('div');

  render(<WasmBoyDebuggerApp />, content);

  node.appendChild(content);
  return node;
};

class PhosphorPreactWidget extends phosphorWidgets.Widget {
  constructor(name, notClosable) {
    super({ node: createPreactNode() });
    this.addClass('content');
    this.addClass(name.toLowerCase());
    this.title.label = name;

    // edit this
    this.title.closable = !notClosable;
    this.title.caption = `Long description for: ${name}`;
  }

  onActivateRequest(msg) {
    if (this.isAttached) {
      // Called whenever panel is focused
    }
  }
}

// Setup from:
// https://github.com/phosphorjs/phosphor/blob/master/examples/example-dockpanel/src/index.ts

// Commands that will be execute by click actions and things
const commands = new phosphorCommands.CommandRegistry();
commands.addCommand('open:local', {
  label: 'Local File',
  mnemonic: 0,
  execute: () => {
    console.log('Open Local File');
  }
});

// Create our dockPanel
const dockPanel = new phosphorWidgets.DockPanel();
dockPanel.id = 'dock';

const panelWidgets = [
  new PhosphorPreactWidget('wasmboy1', true),
  new PhosphorPreactWidget('wasmboy2'),
  new PhosphorPreactWidget('wasmboy3')
];
dockPanel.addWidget(panelWidgets[0]);
dockPanel.addWidget(panelWidgets[1], { mode: 'split-right', ref: panelWidgets[0] });
dockPanel.addWidget(panelWidgets[2], { mode: 'split-bottom', ref: panelWidgets[1] });

// Create our top menu bar
let menuBar = new phosphorWidgets.MenuBar();
let openMenu = new phosphorWidgets.Menu({ commands });
openMenu.title.label = 'Open';
openMenu.title.mnemonic = 0;
openMenu.addItem({ command: 'open:local' });
menuBar.addMenu(openMenu);
menuBar.id = 'menuBar';

phosphorWidgets.BoxPanel.setStretch(dockPanel, 1);

let main = new phosphorWidgets.BoxPanel({ direction: 'left-to-right', spacing: 0 });
main.id = 'main';
main.addWidget(dockPanel);

window.onresize = () => {
  main.update();
};

phosphorWidgets.Widget.attach(menuBar, document.body);
phosphorWidgets.Widget.attach(main, document.body);
