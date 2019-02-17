import { Pubx } from 'pubx';

// re-export our keys
import PUBX_KEYS_IMPORT from './pubx.keys';
export const PUBX_KEYS = PUBX_KEYS_IMPORT;

import { WasmBoy, WasmBoyUpdateCanvas } from './wasmboy';

import devtoolsDetect from 'devtools-detect';

// devtools change for mobile
window.addEventListener('devtoolschange', e => {
  Pubx.get(PUBX_KEYS.MOBILE).update(e.detail.open);
});

export function PUBX_INITIALIZE() {
  // LOADING
  Pubx.publish(PUBX_KEYS.LOADING, {
    controlLoading: false,
    loadPlayer: false,
    controlPromises: [],
    loadPlayerPromises: [],
    addControlPromise: (promise, loadPlayer) => {
      const newLoadingState = {
        controlLoading: true,
        controlPromises: [...Pubx.get(PUBX_KEYS.LOADING).controlPromises, promise]
      };

      if (loadPlayer) {
        newLoadingState.loadPlayer = true;
        newLoadingState.loadPlayerPromises = [...Pubx.get(PUBX_KEYS.LOADING).loadPlayerPromises, promise];
      }

      Pubx.publish(PUBX_KEYS.LOADING, newLoadingState);

      const finallyCallback = () => {
        const controlPromises = Pubx.get(PUBX_KEYS.LOADING).controlPromises;
        const loadPlayerPromises = Pubx.get(PUBX_KEYS.LOADING).loadPlayerPromises;

        controlPromises.splice(controlPromises.indexOf(promise), 1);
        if (loadPlayer) {
          loadPlayerPromises.splice(loadPlayerPromises.indexOf(promise), 1);
        }

        Pubx.publish(PUBX_KEYS.LOADING, {
          controlLoading: controlPromises.length > 0,
          loadPlayer: loadPlayerPromises.length > 0,
          controlPromises,
          loadPlayerPromises
        });
      };

      promise.then(finallyCallback).catch(finallyCallback);
    }
  });

  // MOBILE
  let updatedCanvas = false;
  Pubx.publish(PUBX_KEYS.MOBILE, {
    isMobile: false,
    isLandscape: false,
    isPortrait: false,
    update: isDevtoolsOpen => {
      if (isDevtoolsOpen === undefined) {
        isDevtoolsOpen = devtoolsDetect.open;
      }

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
        updatedCanvas = false;
      }

      if (!updatedCanvas) {
        updatedCanvas = WasmBoyUpdateCanvas(mobile, Pubx.get(PUBX_KEYS.WASMBOY).update);
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
    blockClosing: false,
    showModal: (component, blockClosing) => {
      Pubx.publish(PUBX_KEYS.MODAL, {
        visible: 'modal--visible',
        component,
        blockClosing: !!blockClosing
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
