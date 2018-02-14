import {
  Cpu
} from '../cpu/index';
import {
  eightBitStoreIntoGBMemorySkipTraps
} from '../memory/store';
import {
  eightBitLoadFromGBMemorySkipTraps
} from '../memory/load';
import {
  requestJoypadInterrupt
} from '../interrupts/index';
import {
  consoleLog,
  consoleLogTwo,
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte
} from '../helpers/index';

// http://www.codeslinger.co.uk/pages/projects/gameboy/joypad.html
// Joypad Register
// Taken from pandocs
// Bit 7 - Not used
// Bit 6 - Not used
// Bit 5 - P15 Select Button Keys (0=Select)
// Bit 4 - P14 Select Direction Keys (0=Select)
// Bit 3 - P13 Input Down or Start (0=Pressed) (Read Only)
// Bit 2 - P12 Input Up or Select (0=Pressed) (Read Only)
// Bit 1 - P11 Input Left or Button B (0=Pressed) (Read Only)
// Bit 0 - P10 Input Right or Button A (0=Pressed) (Read Only)

// Button Ids will be the following:
// UP - 0
// RIGHT - 1
// DOWN - 2
// LEFT - 3
// A - 4
// B - 5
// SELECT - 6
// START - 7

class Joypad {
  static up: boolean = false;
  static down: boolean = false;
  static left: boolean = false;
  static right: boolean = false;
  static a: boolean = false;
  static b: boolean = false;
  static select: boolean = false;
  static start: boolean = false;

  static memoryLocationJoypadRegister: u16 = 0xFF00;
}

export function getJoypadState(): u8 {

  // Get the joypad register
  let joypadRegister: u8 = eightBitLoadFromGBMemorySkipTraps(Joypad.memoryLocationJoypadRegister);

  // Flip all the bits, so that 0 does not mean pressed
  joypadRegister = joypadRegister ^ 0xFF;

  // Check the button type buttons
  if(!checkBitOnByte(4, joypadRegister)) {
    // A
    if (Joypad.a) {
      setBitOnByte(0, joypadRegister);
    } else {
      resetBitOnByte(0, joypadRegister);
    }

    // B
    if (Joypad.b) {
      setBitOnByte(1, joypadRegister);
    } else {
      resetBitOnByte(1, joypadRegister);
    }

    // Select
    if (Joypad.select) {
      setBitOnByte(2, joypadRegister);
    } else {
      resetBitOnByte(2, joypadRegister);
    }

    // Start
    if (Joypad.start) {
      setBitOnByte(3, joypadRegister);
    } else {
      resetBitOnByte(3, joypadRegister);
    }
  } else if (!checkBitOnByte(5, joypadRegister)) {
    // D-pad buttons

    // Up
    if (Joypad.up) {
      setBitOnByte(2, joypadRegister);
    } else {
      resetBitOnByte(2, joypadRegister);
    }

    // Right
    if (Joypad.right) {
      setBitOnByte(1, joypadRegister);
    } else {
      resetBitOnByte(1, joypadRegister);
    }

    // Down
    if (Joypad.down) {
      setBitOnByte(3, joypadRegister);
    } else {
      resetBitOnByte(3, joypadRegister);
    }

    // Left
    if (Joypad.left) {
      setBitOnByte(0, joypadRegister);
    } else {
      resetBitOnByte(0, joypadRegister);
    }
  }

  return joypadRegister;
}

export function setJoypadState(up: i8, right: i8, down: i8, left: i8, a: i8, b: i8, select: i8, start: i8): void {
  if (up > 0) {
    _pressJoypadButton(0);
  } else {
    _releaseJoypadButton(0);
  }

  if (right > 0) {
    _pressJoypadButton(1);
  } else {
    _releaseJoypadButton(1);
  }

  if (down > 0) {
    _pressJoypadButton(2);
  } else {
    _releaseJoypadButton(2);
  }

  if (left > 0) {
    _pressJoypadButton(3);
  } else {
    _releaseJoypadButton(3);
  }

  if (a > 0) {
    _pressJoypadButton(4);
  } else {
    _releaseJoypadButton(4);
  }

  if (b > 0) {
    _pressJoypadButton(5);
  } else {
    _releaseJoypadButton(5);
  }

  if (select > 0) {
    _pressJoypadButton(6);
  } else {
    _releaseJoypadButton(6);
  }

  if (start > 0) {
    _pressJoypadButton(7);
  } else {
    _releaseJoypadButton(7);
  }
}

function _pressJoypadButton(buttonId: u8): void {

  // Un stop the CPU
  Cpu.isStopped = false;

  // Check if the button state changed from not pressed
  let isButtonStateChanging: boolean = false;
  if(!_getJoypadButtonStateFromButtonId(buttonId)) {
    isButtonStateChanging = true;
  }

  // If the button state is changing, check for an interrupt
  if (isButtonStateChanging) {
    // Set our joypad state
    _setJoypadButtonStateFromButtonId(buttonId, true);

    // Determine if it is a button or a dpad button
    let isDpadTypeButton = false;
    if (buttonId <= 3) {
      isDpadTypeButton = true;
    }

    // Determine if we should request an interrupt
    let joypadRegister: u8 = eightBitLoadFromGBMemorySkipTraps(Joypad.memoryLocationJoypadRegister);
    let shouldRequestInterrupt = false;

    // Check if the game is looking for a dpad type button press
    if(checkBitOnByte(4, joypadRegister) && isDpadTypeButton) {
      shouldRequestInterrupt = true;
    }

    // Check if the game is looking for a button type button press
    if(checkBitOnByte(5, joypadRegister) && !isDpadTypeButton) {
      shouldRequestInterrupt = true;
    }

    // Finally, request the interrupt, if the button state actually changed
    if (shouldRequestInterrupt) {
      requestJoypadInterrupt();
    }
  }
}

function _releaseJoypadButton(buttonId: u8): void {
  // Set our joypad state
  _setJoypadButtonStateFromButtonId(buttonId, false);
}

function _getBitNumberForButtonId(buttonId: u8): u8 {
  if (buttonId === 1 || buttonId === 4) {
    return 0;
  } else if (buttonId === 3 || buttonId === 5) {
    return 1;
  } else if (buttonId === 0 || buttonId === 6) {
    return 2;
  } else if (buttonId === 2 || buttonId === 7) {
    return 3;
  }

  return 0;
}

function _getJoypadButtonStateFromButtonId(buttonId: u8): boolean {
  if(buttonId === 0) {
    return Joypad.up;
  } else if (buttonId === 1) {
    return Joypad.right;
  } else if (buttonId === 2) {
    return Joypad.down;
  } else if (buttonId === 3) {
    return Joypad.left;
  } else if (buttonId === 4) {
    return Joypad.a;
  } else if (buttonId === 5) {
    return Joypad.b;
  } else if (buttonId === 6) {
    return Joypad.select;
  } else if (buttonId === 7) {
    return Joypad.start;
  }

  return false;
}

function _setJoypadButtonStateFromButtonId(buttonId: u8, isPressed: boolean):  void {
  if(buttonId === 0) {
    Joypad.up = isPressed;
  } else if (buttonId === 1) {
    Joypad.right = isPressed;
  } else if (buttonId === 2) {
    Joypad.down = isPressed;
  } else if (buttonId === 3) {
    Joypad.left = isPressed;
  } else if (buttonId === 4) {
    Joypad.a = isPressed;
  } else if (buttonId === 5) {
    Joypad.b = isPressed;
  } else if (buttonId === 6) {
    Joypad.select = isPressed;
  } else if (buttonId === 7) {
    Joypad.start = isPressed;
  }
}
