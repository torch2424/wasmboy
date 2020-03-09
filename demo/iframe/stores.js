import { writable } from 'svelte/store';

export const isStarted = writable(false);
export const isPlaying = writable(false);

// Get our search params
const params = new URLSearchParams(document.location.search.substring(1));
export const playPoster = writable(params.get('play-poster'));
export const romUrl = writable(params.get('rom-url'));
export const romName = writable(params.get('rom-name'));
