import Promise from 'promise-polyfill';
// https://github.com/torch2424/responsive-gamepad
import { ResponsiveGamepad, KEYMAP_GAMEBOY } from 'responsive-gamepad';

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.wasmInstance = undefined;
    this.isEnabled = true;
  }

  initialize(wasmInstance) {
    this.wasmInstance = wasmInstance;
    this.enableDefaultJoypad();
    return Promise.resolve();
  }

  updateController() {
    if (!this.isEnabled) {
      return {};
    }

    // Create an abstracted controller state
    const controllerState = ResponsiveGamepad.getState();

    // Set the new controller state on the instance
    this.wasmInstance.exports.setJoypadState(
      controllerState.UP ? 1 : 0,
      controllerState.RIGHT ? 1 : 0,
      controllerState.DOWN ? 1 : 0,
      controllerState.LEFT ? 1 : 0,
      controllerState.A ? 1 : 0,
      controllerState.B ? 1 : 0,
      controllerState.SELECT ? 1 : 0,
      controllerState.START ? 1 : 0
    );

    // Return the controller state in case we need something from it
    return controllerState;
  }

  setJoypadState(controllerState) {
    if (!this.wasmInstance) {
      return;
    }

    // Set the new controller state on the instance
    this.wasmInstance.exports.setJoypadState(
      controllerState.UP ? 1 : 0,
      controllerState.RIGHT ? 1 : 0,
      controllerState.DOWN ? 1 : 0,
      controllerState.LEFT ? 1 : 0,
      controllerState.A ? 1 : 0,
      controllerState.B ? 1 : 0,
      controllerState.SELECT ? 1 : 0,
      controllerState.START ? 1 : 0
    );
  }

  enableDefaultJoypad() {
    this.isEnabled = true;

    ResponsiveGamepad.enable(KEYMAP_GAMEBOY());

    return Promise.resolve();
  }

  disableDefaultJoypad() {
    this.isEnabled = false;

    ResponsiveGamepad.disable(KEYMAP_GAMEBOY());

    return Promise.resolve();
  }

  addTouchInput(keyMapKey, element, type, direction) {
    const touchInputId = ResponsiveGamepad.addTouchInput(keyMapKey, element, type, direction);
    return Promise.resolve(touchInputId);
  }

  removeTouchInput(keyMapKey, touchInputId) {
    ResponsiveGamepad.removeTouchInput(keyMapKey, touchInputId);
    return Promise.resolve();
  }
}

export const WasmBoyController = new WasmBoyControllerService();
