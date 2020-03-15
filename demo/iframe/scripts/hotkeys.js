import { WasmBoy } from '../../../dist/wasmboy.wasm.esm.js';
import { setStatus } from '../stores.js';

let quickSpeed = false;
export const setupHotkeys = () => {
  WasmBoy.ResponsiveGamepad.onInputsChange(
    [
      WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.LEFT_TRIGGER,
      WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.RIGHT_TRIGGER,
      WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.SPECIAL
    ],
    state => {
      // Quick Speed
      if (!quickSpeed && state.LEFT_TRIGGER) {
        WasmBoy.setSpeed(3.0);
        quickSpeed = true;
        setStatus('Quick Speed Hotkey!');
      } else if (quickSpeed && !state.LEFT_TRIGGER) {
        WasmBoy.setSpeed(1.0);
        quickSpeed = false;
      }

      // Play / Pause
      if (WasmBoy.isPlaying() && state.SPECIAL) {
        WasmBoy.pause();
      } else if (!WasmBoy.isPlaying() && state.SPECIAL) {
        WasmBoy.play();
      }
    }
  );
};
