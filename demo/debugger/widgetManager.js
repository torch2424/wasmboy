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
import Disassembler from './components/cpu/disassembler/disassembler';
import MemoryViewer from './components/memory/viewer/viewer';
import GraphicsState from './components/graphics/graphicsState/graphicsState';
import BackgroundMap from './components/graphics/backgroundMap/backgroundMap';
import TileData from './components/graphics/tileData/tileData';
import OamViewer from './components/graphics/oamViewer/oamViewer';
import PaletteViewer from './components/graphics/paletteViewer/paletteViewer';
import AudioState from './components/audio/audioState/audioState';
import AudioControl from './components/audio/audioControl/audioControl';
import AudioWaveform from './components/audio/waveform/waveform';
import AudioFrequency from './components/audio/frequency/frequency';
import AudioRecorder from './components/audio/recorder/recorder';
import AudioWavetable from './components/audio/wavetable/wavetable';
import InterruptState from './components/interrupt/interruptState/interruptState';
import TimerState from './components/timer/timerState/timerState';
import AboutComponent from './components/other/about/about';
import HelpComponent from './components/other/help/help';

const components = {
  WasmBoyPlayer: <WasmBoyPlayer />,
  WasmBoyControls: <WasmBoyControls />,
  WasmBoyInfo: <WasmBoyInfo />,
  WasmBoyOptions: <WasmBoyOptions />,
  CpuState: <CpuState />,
  Disassembler: <Disassembler />,
  MemoryViewer: <MemoryViewer />,
  GraphicsState: <GraphicsState />,
  BackgroundMap: <BackgroundMap />,
  TileData: <TileData />,
  OamViewer: <OamViewer />,
  PaletteViewer: <PaletteViewer />,
  AudioState: <AudioState />,
  AudioControl: <AudioControl />,
  AudioWaveform: <AudioWaveform />,
  AudioFrequency: <AudioFrequency />,
  AudioRecorder: <AudioRecorder />,
  AudioWavetable: <AudioWavetable />,
  InterruptState: <InterruptState />,
  TimerState: <TimerState />,
  AboutComponent: <AboutComponent />,
  HelpComponent: <HelpComponent />
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

    if (splitConfig.refIndex !== undefined) {
      splitConfig.ref = this.widgets[splitConfig.refIndex];
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
      let hadError = false;
      const self = this;
      const errorHandler = widgetJson => {
        console.error('Could not restore widget', widgetJson);
        hadError = true;
        self.widgets = [];
      };
      traverse(this.state.layout).forEach(function(value) {
        if (this.parent && this.parent.key === 'widgets') {
          const widgetJson = JSON.parse(value);

          if (widgetJson.type === 'PreactWidget') {
            const preactWidgetConfig = widgetJson.widgetConfig;
            preactWidgetConfig.component = components[preactWidgetConfig.component];

            if (preactWidgetConfig.component) {
              const newWidget = new PreactWidget(preactWidgetConfig);
              this.update(newWidget);
              self.widgets.push(newWidget);
            } else {
              errorHandler(widgetJson);
            }
          } else {
            errorHandler(widgetJson);
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
        component: <HelpComponent />,
        label: 'Help'
      },
      {
        mode: 'split-right',
        refIndex: 0
      }
    );
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
        component: <AboutComponent />,
        label: 'About'
      },
      {
        mode: 'split-bottom',
        refIndex: 1
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
