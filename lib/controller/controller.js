import Promise from 'promise-polyfill';
// https://github.com/torch2424/responsive-gamepad
import { ResponsiveGamepad, KEYMAP_GAMEBOY } from 'responsive-gamepad';

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.worker = undefined;
    this.isEnabled = false;
    this.enableDefaultJoypad();
  }

  initialize(wasmInstance) {
    return Promise.resolve();
  }

  setWorker(worker) {
    this.worker = worker;
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
  }

  disableDefaultJoypad() {
    this.isEnabled = false;

    ResponsiveGamepad.disable(KEYMAP_GAMEBOY());
  }

  addTouchInput(keyMapKey, element, type, direction) {
    return ResponsiveGamepad.addTouchInput(keyMapKey, element, type, direction);
  }

  removeTouchInput(keyMapKey, touchInputId) {
    return ResponsiveGamepad.removeTouchInput(keyMapKey, touchInputId);
  }
}

export const WasmBoyController = new WasmBoyControllerService();
