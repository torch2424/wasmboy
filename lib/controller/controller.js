import Promise from 'promise-polyfill';
// https://github.com/torch2424/responsive-gamepad
import { ResponsiveGamepad } from 'responsive-gamepad'

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.wasmInstance = undefined;
  }

  initialize(wasmInstance) {
    this.wasmInstance = wasmInstance;

    ResponsiveGamepad.initialize();

    return Promise.resolve();
  }

  addTouchInput(keyMapKey, element, type, direction) {
    ResponsiveGamepad.addTouchInput(keyMapKey, element, type, direction);
  }

  updateController() {

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
}

export const WasmBoyController = new WasmBoyControllerService();
