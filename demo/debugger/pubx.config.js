import { Pubx } from 'pubx';

export const PUBX_KEYS = {
  OVERLAY: 'OVERLAY',
  NOTIFICATION: 'NOTIFICATION'
};

export function PUBX_INITIALIZE() {
  // OVERLAY
  Pubx.publish(PUBX_KEYS.OVERLAY, {
    captureInput: false,
    showMask: false
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
