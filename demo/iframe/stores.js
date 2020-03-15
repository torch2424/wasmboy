import { writable, readable } from 'svelte/store';

export const isStarted = writable(false);
export const isLoaded = writable(false);
export const isPlaying = writable(false);

export const modalStore = writable(0);
export const hideModal = () => modalStore.set(0);
export const showLoadState = () => modalStore.set(1);
export const showAbout = () => modalStore.set(2);

export const saveState = writable(0);
export const triggerSaveState = () => saveState.update(value => value + 1);

// Set the current status message
let statusMessage;
let statusTimeout;
let statusReadableSet;
export const status = readable(
  {
    message: statusMessage,
    timeout: statusTimeout
  },
  set => {
    statusReadableSet = set;
    return () => {};
  }
);
export const setStatus = (message, timeout) => {
  if (!timeout) {
    timeout = 2000;
  }

  if (statusReadableSet) {
    statusReadableSet({
      message,
      timeout
    });
  }
};

// Get our search params
const params = new URLSearchParams(document.location.search.substring(1));
export const playPoster = writable(params.get('play-poster'));
export const romUrl = writable(params.get('rom-url'));
export const romName = writable(params.get('rom-name'));

// Handle showing and hiding the mobile controls
const isUserAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
export const isTouchPadVisible = writable(!!isUserAgentMobile);

export const isFullScreen = writable(false);
