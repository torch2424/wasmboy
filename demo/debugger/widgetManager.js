// Organize and hnadle which widgets are currently active

import { h } from 'preact';
import { Pubx } from 'pubx';
import traverse from 'traverse';
import { PUBX_KEYS } from './pubx.config';

import PreactWidget from './preactWidget';

// Add all available widgets so they can serialized and restored
import WasmBoyPlayer from './components/playback/wasmboyPlayer/wasmboyPlayer';
import WasmBoyControls from './components/playback/wasmboyControls/wasmboyControls';
import WasmBoyInfo from './components/playback/wasmboyInfo/wasmboyInfo';
import WasmBoyOptions from './components/playback/wasmboyOptions/wasmboyOptions';
import CpuState from './components/cpu/cpuState/cpuState';
import CpuControl from './components/cpu/cpuControl/cpuControl';
const components = {
  WasmBoyPlayer: <WasmBoyPlayer />,
  WasmBoyControls: <WasmBoyControls />,
  WasmBoyInfo: <WasmBoyInfo />,
  WasmBoyOptions: <WasmBoyOptions />,
  CpuState: <CpuState />,
  CpuControl: <CpuControl />
};

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

    // Some event throttlers
    this.eventThrottle = false;
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
    this._saveLayout();
  }

  handlePreactWidgetResized(widget) {
    if (this.eventThrottle) {
      return;
    }

    this.eventThrottle = setTimeout(() => {
      this._saveLayout();
      this.eventThrottle = false;
    }, 100);
  }

  _saveLayout() {
    setTimeout(() => {
      this.state.layout = this.dockPanel.saveLayout();
      this._save();
    });
  }

  _restoreLayout() {
    if (this.state.layout) {
      // Try to create all of the appropriate preact widgets
      const hadError = false;
      traverse(this.state.layout).forEach(function(value) {
        if (this.parent && this.parent.key === 'widgets') {
          const widgetJson = JSON.parse(value);

          if (widgetJson.type === 'PreactWidget') {
            const preactWidgetConfig = widgetJson.widgetConfig;

            preactWidgetConfig.component = components[preactWidgetConfig.component];

            this.update(new PreactWidget(preactWidgetConfig));
          } else {
            console.error('Could not restore widget', widgetJson);
            hadError = true;
          }
        }
      });

      // Finally restore the layout
      if (!hadError) {
        this.dockPanel.restoreLayout(this.state.layout);
        return;
      }
    }

    // If could not restore, use the default
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
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(this.state));
  }

  _restore() {
    const restoredState = localStorage.getItem(LOCALSTORAGE_KEY);

    if (restoredState) {
      this.state = JSON.parse(restoredState);
    }
  }
}
