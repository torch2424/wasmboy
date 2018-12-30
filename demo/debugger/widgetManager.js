// Organize and hnadle which widgets are currently active

import { h } from 'preact';
import { parse, stringify } from 'flatted/esm';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from './pubx.config';

import PreactWidget from './preactWidget';

import WasmBoyPlayer from './components/wasmboyPlayer/wasmboyPlayer';
import WasmBoyControls from './components/wasmboyControls/wasmboyControls';
import WasmBoyInfo from './components/wasmboyInfo/wasmboyInfo';

const LOCALSTORAGE_KEY = 'WASMBOY_DEBUGGER_WIDGET_MANAGER';

export default class WidgetManager {
  constructor(dockPanel) {
    this.dockPanel = dockPanel;
    this.widgets = [];

    this.state = {};

    this._restore();

    if (this.state.layout) {
      this._restoreLayout();
    } else {
      this._createDefaultLayout();
    }
  }

  addPreactWidget(preactWidgetConfig, splitConfig) {
    if (!splitConfig) {
      splitConfig = {
        mode: 'split-right',
        ref: this.widgets[this.widgets.length - 1]
      };
    }

    if (splitConfig.refIndex) {
      splitConfig.ref = this.widgets[refIndex];
      delete splitConfig.refIndex;
    }

    const widget = new PreactWidget(preactWidgetConfig);
    this.widgets.push(widget);

    this.dockPanel.addWidget(widget, splitConfig);

    this._saveLayout();
  }

  handlePreactWidgetClosed(widget) {
    this.widgets.splice(this.widgets.indexOf(widget), 1);
  }

  _saveLayout() {
    // TODO:
    // this.state.layout = this.dockPanel.saveLayout();
    // this._save();
  }

  _restoreLayout() {
    // TODO:
    // this.dockPanel.restoreLayout(this.state.layout);

    this._createDefaultLayout();
  }

  _createDefaultLayout() {
    this.addPreactWidget({
      component: <WasmBoyPlayer />,
      label: 'Player',
      closable: false
    });
    this.addPreactWidget(
      {
        component: <WasmBoyControls />,
        label: 'Playback Controls'
      },
      {
        mode: 'split-bottom',
        refIndex: 0
      }
    );
    this.addPreactWidget(
      {
        component: <WasmBoyInfo />,
        label: 'Playback Info'
      },
      {
        mode: 'split-right',
        refIndex: 0
      }
    );
  }

  _save() {
    localStorage.setItem(LOCALSTORAGE_KEY, stringify(this.state));
  }

  _restore() {
    const restoredState = localStorage.getItem(LOCALSTORAGE_KEY);

    if (restoredState) {
      this.state = parse(restoredState);
    }
  }
}
