import { Pubx } from 'pubx';
import { WasmBoy } from './wasmboy';

export const PUBX_KEYS = {
  MODAL: 'MODAL',
  NOTIFICATION: 'NOTIFICATION',
  WASMBOY: 'WASMBOY',
  WIDGET: 'WIDGET'
};

export function PUBX_INITIALIZE() {
  // MODAL
  Pubx.publish(PUBX_KEYS.MODAL, {
    visible: false,
    component: false,
    showModal: component => {
      Pubx.publish(PUBX_KEYS.MODAL, {
        visible: 'modal--visible',
        component
      });
    },
    closeModal: () => {
      Pubx.publish(PUBX_KEYS.MODAL, {
        visible: false
      });
    }
  });

  // NOTIFICATION
  const defaultTimeout = 5000;
  Pubx.publish(PUBX_KEYS.NOTIFICATION, {
    text: '',
    timeout: defaultTimeout,
    showNotification: (text, timeout) => {
      if (!timeout) {
        timeout = defaultTimeout;
      }

      Pubx.publish(PUBX_KEYS.NOTIFICATION, {
        text,
        timeout
      });
    }
  });

  // WASMBOY
  Pubx.publish(PUBX_KEYS.WASMBOY, {
    filename: '',
    version: WasmBoy.getVersion(),
    core: 'Please Load a ROM for the Core Type',
    cartridge: {},
    update: () => {
      const updateTask = async () => {
        let cartridgeInfo = {};
        if (WasmBoy.isLoadedAndStarted()) {
          cartridgeInfo = await WasmBoy._getCartridgeInfo();
        }

        Pubx.publish(PUBX_KEYS.WASMBOY, {
          playing: WasmBoy.isPlaying(),
          paused: WasmBoy.isPaused(),
          ready: WasmBoy.isReady(),
          loadedAndStarted: WasmBoy.isLoadedAndStarted(),
          core: WasmBoy.getCoreType(),
          cartridge: cartridgeInfo
        });
      };
      updateTask();
    }
  });

  // WIDGET
  Pubx.publish(PUBX_KEYS.WIDGET, {
    widgetManager: undefined,
    addWidget: (preactWidgetConfig, splitConfig) => {
      const widgetManager = Pubx.get(PUBX_KEYS.WIDGET).widgetManager;

      if (widgetManager) {
        widgetManager.addPreactWidget(preactWidgetConfig, splitConfig);
      } else {
        throw new Error('Widget Manager not Created!');
      }
    },
    widgetClosed: widget => {
      const widgetManager = Pubx.get(PUBX_KEYS.WIDGET).widgetManager;

      if (widgetManager) {
        widgetManager.handlePreactWidgetClosed(widget);
      } else {
        throw new Error('Widget Manager not Created!');
      }
    },
    widgetResized: widget => {
      const widgetManager = Pubx.get(PUBX_KEYS.WIDGET).widgetManager;

      if (widgetManager) {
        widgetManager.handlePreactWidgetResized(widget);
      } else {
        throw new Error('Widget Manager not Created!');
      }
    },
    isWidgetOpen: widgetComponentName => {
      const widgetManager = Pubx.get(PUBX_KEYS.WIDGET).widgetManager;

      if (widgetManager) {
        return widgetManager.widgets.some(widget => {
          const widgetJson = JSON.parse(widget.toJSON());

          if (widgetJson.widgetConfig.component === widgetComponentName) {
            return true;
          }

          return false;
        });
      }

      return false;
    },
    isControlWidgetsOpen: () => {
      // Check if the Playback Control or CPU Control is open , if not, let's autoplay
      const pubxWidget = Pubx.get(PUBX_KEYS.WIDGET);

      const controlWidgetComponentNames = ['WasmBoyControls', 'CpuControl'];
      return controlWidgetComponentNames.some(componentName => pubxWidget.isWidgetOpen(componentName));
    }
  });
}
