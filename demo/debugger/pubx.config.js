import { Pubx } from 'pubx';
import WasmBoy from './wasmboy';

export const PUBX_KEYS = {
  MODAL: 'MODAL',
  NOTIFICATION: 'NOTIFICATION',
  WASMBOY: 'WASMBOY'
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
    name: '',
    version: WasmBoy.getVersion(),
    update: () => {
      setTimeout(() => {
        Pubx.publish(PUBX_KEYS.WASMBOY, {
          playing: WasmBoy.isPlaying(),
          paused: WasmBoy.isPaused(),
          ready: WasmBoy.isReady(),
          loadedAndStarted: WasmBoy.isLoadedAndStarted()
        });
      });
    }
  });
}
