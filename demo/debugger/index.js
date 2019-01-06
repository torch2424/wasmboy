import { h, render, Component } from 'preact';

import { WasmBoy } from './wasmboy';

import loadScript from 'load-script';

import phosphorWidgets from '@phosphor/widgets';

import packageJson from '../../package.json';

import './index.css';

import WidgetManager from './widgetManager';

import menus from './menus';

import { Pubx } from 'pubx';
import { PUBX_KEYS, PUBX_INITIALIZE } from './pubx.config';

import Overlay from './components/overlay/overlay';
import Mobile from './components/mobile/mobile';

// Setup Google Analytics
if (typeof window !== 'undefined') {
  // TODO: Uncomment this once we put into PROD
  /*
  loadScript('https://www.googletagmanager.com/gtag/js?id=UA-125276735-1', function(err, script) {
    if (!err) {
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', 'UA-125276735-1');
      // Attach Analytics to window
      window.gtag = gtag;
    }
  });
  */
}

// Setup from:
// https://github.com/phosphorjs/phosphor/blob/master/examples/example-dockpanel/src/index.ts

// Create our dockPanel
const dockPanel = new phosphorWidgets.DockPanel();
dockPanel.id = 'dock';

// Create our top menu bar
let menuBar = new phosphorWidgets.MenuBar();
menus.forEach(menu => {
  menuBar.addMenu(menu);
});
menuBar.id = 'menuBar';

phosphorWidgets.BoxPanel.setStretch(dockPanel, 1);

let main = new phosphorWidgets.BoxPanel({ direction: 'left-to-right', spacing: 0 });
main.id = 'main';
main.addWidget(dockPanel);

window.onresize = () => {
  main.update();
};

// Initialize Pubx for State Management
PUBX_INITIALIZE();

// Set up our Widget Manager
const widgetManager = new WidgetManager(dockPanel);
Pubx.publish(PUBX_KEYS.WIDGET, {
  widgetManager
});

// Bind phosphor to DOM
const phosphorContainer = document.getElementById('phosphor-container');
phosphorWidgets.Widget.attach(menuBar, phosphorContainer);
phosphorWidgets.Widget.attach(main, phosphorContainer);

// Bind Preact Overlay to DOM
const overlayContainer = document.getElementById('overlay-container');
render(<Overlay />, overlayContainer);

// Bind the Mobile UI to DOM
const mobileContainer = document.getElementById('mobile-container');
render(<Mobile />, mobileContainer);

// Show a nice welcome message
setTimeout(() => {
  Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Welcome to the WasmBoy Debugger!');
}, 100);
