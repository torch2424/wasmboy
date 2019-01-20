import { Pubx } from 'pubx';
import { WasmBoy, WasmBoyUpdateCanvas } from './wasmboy';

// devtools change for mobile
window.addEventListener('devtoolschange', e => {
  Pubx.get(PUBX_KEYS.MOBILE).update(e.detail.open);
});

export const PUBX_KEYS = {
  LOADING: 'LOADING',
  MOBILE: 'MOBILE',
  MODAL: 'MODAL',
  NOTIFICATION: 'NOTIFICATION',
  WASMBOY: 'WASMBOY',
  WIDGET: 'WIDGET'
};

export function PUBX_INITIALIZE() {
  // LOADING
  Pubx.publish(PUBX_KEYS.LOADING, {
    controlLoading: false,
    controlPromises: [],
    addControlPromise: promise => {
      Pubx.publish(PUBX_KEYS.LOADING, {
        controlLoading: true,
        controlPromises: [...Pubx.get(PUBX_KEYS.LOADING).controlPromises, promise]
      });

      const finallyCallback = () => {
        const controlPromises = Pubx.get(PUBX_KEYS.LOADING).controlPromises;
        controlPromises.splice(controlPromises.indexOf(promise), 1);

        Pubx.publish(PUBX_KEYS.LOADING, {
          controlLoading: controlPromises.length > 0,
          controlPromises
        });
      };

      promise.then(finallyCallback).catch(finallyCallback);
    }
  });

  // MOBILE
  Pubx.publish(PUBX_KEYS.MOBILE, {
    isMobile: false,
    isLandscape: false,
    isPortrait: false,
    update: isDevtoolsOpen => {
      let mobile = window.matchMedia('(max-width: 500px)').matches;

      if (!isDevtoolsOpen) {
        mobile = window.matchMedia('(max-width: 1024px)').matches;
      }

      let landscape = mobile && window.matchMedia('screen and (orientation: landscape)').matches;
      let portrait = mobile && window.matchMedia('screen and (orientation: portrait)').matches;

      // Get our document class list
      const documentClassList = document.documentElement.classList;

      // Add all Media query based on mobile vs desktop
      if (mobile) {
        documentClassList.add('mobile');
        documentClassList.remove('desktop');
      } else {
        documentClassList.remove('mobile');
        documentClassList.add('desktop');
      }
      if (landscape) {
        documentClassList.add('landscape');
      } else {
        documentClassList.remove('landscape');
      }
      if (portrait) {
        documentClassList.add('portrait');
      } else {
        documentClassList.remove('portrait');
      }

      if (Pubx.get(PUBX_KEYS.MOBILE).isMobile !== mobile) {
        WasmBoyUpdateCanvas(mobile, Pubx.get(PUBX_KEYS.WASMBOY).update);
      }

      Pubx.publish(PUBX_KEYS.MOBILE, {
        isMobile: mobile,
        isLandscape: landscape && mobile,
        isPortrait: portrait && mobile
      });
    }
  });

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
          playing: WasmBoy.isReady() && WasmBoy.isPlaying(),
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

      const controlWidgetComponentNames = ['WasmBoyControls', 'Disassembler'];
      return controlWidgetComponentNames.some(componentName => pubxWidget.isWidgetOpen(componentName));
    }
  });
}
