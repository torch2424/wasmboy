import Promise from 'promise-polyfill';
// https://github.com/torch2424/responsive-gamepad
import { ResponsiveGamepad } from 'responsive-gamepad';

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.wasmInstance = undefined;
    this.isEnabled = true;
  }

  initialize(wasmInstance) {
    this.wasmInstance = wasmInstance;
    ResponsiveGamepad.initialize();

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

  enableDefaultJoypad() {
    this.isEnabled = true;

    return Promise.resolve();
  }

  disableDefaultJoypad() {
    this.isEnabled = false;

    return Promise.resolve();
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

  addTouchInput(keyMapKey, element, type, direction) {
    ResponsiveGamepad.addTouchInput(keyMapKey, element, type, direction);
    return Promise.resolve();
  }
}

export const WasmBoyController = new WasmBoyControllerService();
