import { Pubx } from 'pubx';
import { PUBX_KEYS } from './pubx.config';
import { WasmBoy } from './wasmboy';
import DebuggerAnalytics from './analytics';

export default function(file) {
  const loadROMTask = async () => {
    await WasmBoy.pause();
    await WasmBoy.loadBootROM(file);

    // Save the loaded cartridge
    await WasmBoy.saveLoadedBootROM();

    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Boot ROM Loaded! 🎉');

    // Fire off Analytics
    //DebuggerAnalytics.loadROMSuccess();
  };

  const loadROMPromise = loadROMTask();

  loadROMPromise.catch(error => {
    console.log('Boot ROM Game Error:', error);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Boot ROM Load Error! 😞');

    // Fire off Analytics
    // DebuggerAnalytics.loadROMFail();
  });

  Pubx.get(PUBX_KEYS.LOADING).addControlPromise(loadROMPromise, true);
}
