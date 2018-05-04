// Extend the index.js
import { WasmBoyAudio } from '../audio/audio.js';

export const saveCurrentAudioBufferToWav = () => {
  if (!WasmBoyAudio.audioBuffer) {
    return;
  }

  // https://www.npmjs.com/package/audiobuffer-to-wav
  const toWav = require('audiobuffer-to-wav');
  // https://github.com/Jam3/audiobuffer-to-wav/blob/master/demo/index.js

  const wav = toWav(WasmBoyAudio.audioBuffer);
  const blob = new window.Blob([new DataView(wav)], {
    type: 'audio/wav'
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  document.body.appendChild(anchor);
  anchor.style = 'display: none';
  anchor.href = url;
  anchor.download = 'audio.wav';
  anchor.click();
  window.URL.revokeObjectURL(url);
};
