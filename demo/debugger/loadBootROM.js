import { Pubx } from 'pubx';
import { PUBX_KEYS } from './pubx.config';
import { WasmBoy } from './wasmboy';
import DebuggerAnalytics from './analytics';

export default function(file, type, name) {
  const loadROMTask = async () => {
    await WasmBoy.pause();
    await WasmBoy.addBootROM(type, file, undefined, {
      filename: name
    });

    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Boot ROM Added! 🎉');

    // Fire off Analytics
    DebuggerAnalytics.addBootROMSuccess();
  };

  const loadROMPromise = loadROMTask();

  loadROMPromise.catch(error => {
    console.log('Boot ROM Error:', error);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Boot ROM Add Error! 😞');

    // Fire off Analytics
    DebuggerAnalytics.addBootROMFail();
  });

  Pubx.get(PUBX_KEYS.LOADING).addControlPromise(loadROMPromise, true);

  return loadROMPromise;
}
