import { WasmBoy } from './wasmboy';
import { WASMBOY_CONTROLLER_STATE } from './wasmboyControllerState';

// Helpers for accessing gamepad
// Similar to: https://github.com/torch2424/picoDeploy/blob/master/src/assets/3pLibs/pico8gamepad/pico8gamepad.js
function getAnalogStickAxis(gamePad, axisId) {
  return gamePad.axes[axisId] || 0.0;
}

function isButtonPressed(gamePad, buttonId) {
  return gamePad.buttons[buttonId] ? gamePad.buttons[buttonId].pressed : false;
}

class WasmBoyControls {
  constructor() {
    // Our settings
    this.gamepadAnalogStickDeadZone = 0.25;
    this.wasmboyControllerStateKeys = Object.keys(WASMBOY_CONTROLLER_STATE);
  }

  initialize() {
    // Add our key event listeners
    window.addEventListener('keyup', (event) => {
      this.updateKeyboard(event);
    });
    window.addEventListener('keydown', (event) => {
      this.updateKeyboard(event);
    });
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
      controlsState[key] = WASMBOY_CONTROLLER_STATE[key].KEYBOARD.IS_PRESSED ||
        WASMBOY_CONTROLLER_STATE[key].GAMEPAD.IS_PRESSED ||
        WASMBOY_CONTROLLER_STATE[key].VIRTUAL_GAMEPAD.IS_PRESSED;
    });

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

    gamepads.forEach((gamepad) => {
      // Left
      WASMBOY_CONTROLLER_STATE.LEFT.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamePad, 0) < -this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamePad, 2) < -this.gamepadAnalogStickDeadZone || isButtonPressed(gamePad, 14)) {
        WASMBOY_CONTROLLER_STATE.LEFT.GAMEPAD.IS_PRESSED = true;
      }

      // Right
      WASMBOY_CONTROLLER_STATE.RIGHT.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamePad, 0) > +this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamePad, 2) > +this.gamepadAnalogStickDeadZone || isButtonPressed(gamePad, 15)) {
        WASMBOY_CONTROLLER_STATE.RIGHT.GAMEPAD.IS_PRESSED = true;
      }

      // Up
      WASMBOY_CONTROLLER_STATE.UP.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamePad, 1) < -this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamePad, 3) < -this.gamepadAnalogStickDeadZone || isButtonPressed(gamePad, 12)) {
        WASMBOY_CONTROLLER_STATE.UP.GAMEPAD.IS_PRESSED = true;
      }

      // Down
      WASMBOY_CONTROLLER_STATE.DOWN.GAMEPAD.IS_PRESSED = false;
      if (getAnalogStickAxis(gamePad, 1) > +this.gamepadAnalogStickDeadZone || getAnalogStickAxis(gamePad, 3) > +this.gamepadAnalogStickDeadZone || isButtonPressed(gamePad, 13)) {
        WASMBOY_CONTROLLER_STATE.DOWN.GAMEPAD.IS_PRESSED = true;
      }

      // A
      WASMBOY_CONTROLLER_STATE.A.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamePad, 0) || isButtonPressed(gamePad, 1)) {
        WASMBOY_CONTROLLER_STATE.A.GAMEPAD.IS_PRESSED = true;
      }

      // B
      WASMBOY_CONTROLLER_STATE.B.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamePad, 2) || isButtonPressed(gamePad, 3)) {
        WASMBOY_CONTROLLER_STATE.B.GAMEPAD.IS_PRESSED = true;
      }

      // Select
      WASMBOY_CONTROLLER_STATE.SELECT.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamePad, 8)) {
        WASMBOY_CONTROLLER_STATE.SELECT.GAMEPAD.IS_PRESSED = false;
      }

      // Start
      WASMBOY_CONTROLLER_STATE.START.GAMEPAD.IS_PRESSED = false;
      if (isButtonPressed(gamePad, 9)) {
        WASMBOY_CONTROLLER_STATE.START.GAMEPAD.IS_PRESSED = false;
      }
    });
  }

  updateVirtualGamepad() {
    // TODO:
  }
}

export const WasmBoyController = new WasmBoyControls();
