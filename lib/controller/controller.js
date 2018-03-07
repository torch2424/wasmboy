import Promise from 'promise-polyfill';
import { WASMBOY_CONTROLLER_STATE } from './controllerState';

// Helpers for accessing gamepad
// Similar to: https://github.com/torch2424/picoDeploy/blob/master/src/assets/3pLibs/pico8gamepad/pico8gamepad.js
function getAnalogStickAxis(gamepad, axisId) {
  return gamepad.axes[axisId] || 0.0;
}

function isButtonPressed(gamepad, buttonId) {
  return gamepad.buttons[buttonId] ? gamepad.buttons[buttonId].pressed : false;
}

class WasmBoyControllerService {
  constructor() {
    // Our wasm instance
    this.wasmInstance = undefined;

    // Our settings
    this.gamepadAnalogStickDeadZone = 0.25;
    this.wasmboyControllerStateKeys = Object.keys(WASMBOY_CONTROLLER_STATE);
  }

  initialize(wasmInstance) {
    this.wasmInstance = wasmInstance;

    // Add our key event listeners
    window.addEventListener('keyup', (event) => {
      this.updateKeyboard(event);
    });
    window.addEventListener('keydown', (event) => {
      this.updateKeyboard(event);
    });
    return Promise.resolve();
  }

  updateController() {
    // Keyboard handled by listeners on window

    // Update the gamepad state
    this.updateGamepad();

    // TODO: Update the virtual keyboard state

    // Create an abstracted controller state
    const controllerState = {};

    // Loop through our Keys, and quickly build our controller state
    this.wasmboyControllerStateKeys.forEach((key) => {
      controllerState[key] = WASMBOY_CONTROLLER_STATE[key].KEYBOARD.IS_PRESSED ||
        WASMBOY_CONTROLLER_STATE[key].GAMEPAD.IS_PRESSED ||
        WASMBOY_CONTROLLER_STATE[key].VIRTUAL_GAMEPAD.IS_PRESSED;
    });

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

  // May have to throttle changing keys so that it is a per frame type deal so they don't desync
  updateKeyboard(keyEvent) {
    // Get the new state of the key
    let isPressed = false;
    if (keyEvent.type === 'keydown') {
      isPressed = true;
    }

    this.wasmboyControllerStateKeys.some((key) => {
      if(WASMBOY_CONTROLLER_STATE[key].KEYBOARD.EVENT_KEY_CODES.includes(keyEvent.keyCode)) {
        WASMBOY_CONTROLLER_STATE[key].KEYBOARD.IS_PRESSED = isPressed;
        return true;
      }
      return false;
    });
  }

  updateGamepad() {
    // Similar to: https://github.com/torch2424/picoDeploy/blob/master/src/assets/3pLibs/pico8gamepad/pico8gamepad.js
    // Gampad Diagram: https://www.html5rocks.com/en/tutorials/doodles/gamepad/#toc-gamepadinfo
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    for(let i = 0; i < gamepads.length; i++) {

      // Get our current gamepad
      let gamepad = gamepads[i];

      if(!gamepad) {
        continue;
      }

      // Left
      WASMBOY_CONTROLLER_STATE.LEFT.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamepad, 0) < -this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamepad, 2) < -this.gamepadAnalogStickDeadZone || isButtonPressed(gamepad, 14)) {
        WASMBOY_CONTROLLER_STATE.LEFT.GAMEPAD.IS_PRESSED = true;
      }

      // Right
      WASMBOY_CONTROLLER_STATE.RIGHT.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamepad, 0) > +this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamepad, 2) > +this.gamepadAnalogStickDeadZone || isButtonPressed(gamepad, 15)) {
        WASMBOY_CONTROLLER_STATE.RIGHT.GAMEPAD.IS_PRESSED = true;
      }

      // Up
      WASMBOY_CONTROLLER_STATE.UP.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamepad, 1) < -this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamepad, 3) < -this.gamepadAnalogStickDeadZone || isButtonPressed(gamepad, 12)) {
        WASMBOY_CONTROLLER_STATE.UP.GAMEPAD.IS_PRESSED = true;
      }

      // Down
      WASMBOY_CONTROLLER_STATE.DOWN.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamepad, 1) > +this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamepad, 3) > +this.gamepadAnalogStickDeadZone || isButtonPressed(gamepad, 13)) {
        WASMBOY_CONTROLLER_STATE.DOWN.GAMEPAD.IS_PRESSED = true;
      }

      // A
      WASMBOY_CONTROLLER_STATE.A.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamepad, 0) || isButtonPressed(gamepad, 1)) {
        WASMBOY_CONTROLLER_STATE.A.GAMEPAD.IS_PRESSED = true;
      }

      // B
      WASMBOY_CONTROLLER_STATE.B.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamepad, 2) || isButtonPressed(gamepad, 3)) {
        WASMBOY_CONTROLLER_STATE.B.GAMEPAD.IS_PRESSED = true;
      }

      // Select
      WASMBOY_CONTROLLER_STATE.SELECT.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamepad, 8)) {
        WASMBOY_CONTROLLER_STATE.SELECT.GAMEPAD.IS_PRESSED = false;
      }

      // Start
      WASMBOY_CONTROLLER_STATE.START.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamepad, 9)) {
        WASMBOY_CONTROLLER_STATE.START.GAMEPAD.IS_PRESSED = false;
      }
    }
  }

  updateVirtualGamepad() {
    // TODO:
  }
}

export const WasmBoyController = new WasmBoyControllerService();
