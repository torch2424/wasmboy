import { Pubx } from 'pubx';

export const PUBX_KEYS = {
  MODAL: 'MODAL',
  NOTIFICATION: 'NOTIFICATION'
};

export function PUBX_INITIALIZE() {
  // MODAL
  Pubx.publish(PUBX_KEYS.MODAL, {
    visible: false,
    component: false,
    showModal: component => {
      Pubx.pubblish(PUBX_KEYS.MODAL, {
        visible: 'modal--visible',
        component
      });
    },
    closeModal: () => {
      Pubx.pubblish(PUBX_KEYS.MODAL, {
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
}
