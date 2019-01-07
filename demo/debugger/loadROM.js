import { Pubx } from 'pubx';
import { PUBX_KEYS } from './pubx.config';
import { WasmBoy } from './wasmboy';

export default function(file, fileName) {
  const loadROMTask = async () => {
    await WasmBoy.pause();
    await WasmBoy.loadROM(file);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Loaded! 🎉');
    Pubx.publish(PUBX_KEYS.WASMBOY, {
      filename: fileName
    });

    // Check if the Playback Control or CPU Control is open , if not, let's autoplay
    if (!Pubx.get(PUBX_KEYS.WIDGET).isControlWidgetsOpen()) {
      await WasmBoy.play();
    }

    Pubx.get(PUBX_KEYS.WASMBOY).update();

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_success');
    }
  };

  const loadROMPromise = loadROMTask();

  loadROMPromise.catch(error => {
    console.log('Load Game Error:', error);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Load Error! 😞');

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_fail');
    }
  });

  Pubx.get(PUBX_KEYS.LOADING).addControlPromise(loadROMPromise);
}
