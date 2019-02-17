import { Pubx } from 'pubx';
import { PUBX_KEYS } from './pubx.config';
import { WasmBoy } from './wasmboy';
import DebuggerAnalytics from './analytics';

export default function(file, fileName) {
  const loadROMTask = async () => {
    await WasmBoy.pause();
    await WasmBoy.loadROM(file);
    // Save the loaded cartridge
    await WasmBoy.saveLoadedCartridge({
      fileName
    });

    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Loaded! 🎉');
    Pubx.publish(PUBX_KEYS.WASMBOY, {
      filename: fileName
    });

    // Check if the Playback Control or CPU Control is open , if not, let's autoplay
    if (Pubx.get(PUBX_KEYS.MOBILE).isMobile || !Pubx.get(PUBX_KEYS.WIDGET).isControlWidgetsOpen()) {
      await WasmBoy.play();
    }

    Pubx.get(PUBX_KEYS.WASMBOY).update();

    // Fire off Analytics
    DebuggerAnalytics.loadROMSuccess();
  };

  const loadROMPromise = loadROMTask();

  loadROMPromise.catch(error => {
    console.log('Load Game Error:', error);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Load Error! 😞');

    // Fire off Analytics
    DebuggerAnalytics.loadROMFail();
  });

  Pubx.get(PUBX_KEYS.LOADING).addControlPromise(loadROMPromise, true);
}
