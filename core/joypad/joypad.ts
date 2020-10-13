import { Cpu } from '../cpu/index';
import { eightBitLoadFromGBMemory } from '../memory/load';
import { requestJoypadInterrupt } from '../interrupts/index';
import { checkBitOnByte, setBitOnByte, resetBitOnByte } from '../helpers/index';
import { getSaveStateMemoryOffset } from '../core';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';

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

export class Joypad {
  static up: boolean = false;
  static down: boolean = false;
  static left: boolean = false;
  static right: boolean = false;
  static a: boolean = false;
  static b: boolean = false;
  static select: boolean = false;
  static start: boolean = false;

  static readonly memoryLocationJoypadRegister: i32 = 0xff00;
  // Cache some values on the Joypad register
  static joypadRegisterFlipped: i32 = 0;
  static isDpadType: boolean = false;
  static isButtonType: boolean = false;
  static updateJoypad(value: i32): void {
    Joypad.joypadRegisterFlipped = value ^ 0xff;
    Joypad.isDpadType = checkBitOnByte(4, Joypad.joypadRegisterFlipped);
    Joypad.isButtonType = checkBitOnByte(5, Joypad.joypadRegisterFlipped);
  }

  // Save States
  // Not doing anything for Joypad for now

  static readonly saveStateSlot: i32 = 3;

  // Function to save the state of the class
  static saveState(): void {
    store<i32>(getSaveStateMemoryOffset(0x00, Joypad.saveStateSlot), Joypad.joypadRegisterFlipped);

    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x01, Joypad.saveStateSlot), Joypad.isDpadType);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x02, Joypad.saveStateSlot), Joypad.isButtonType);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Joypad.joypadRegisterFlipped = load<i32>(getSaveStateMemoryOffset(0x00, Joypad.saveStateSlot));

    Joypad.isDpadType = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x01, Joypad.saveStateSlot));
    Joypad.isButtonType = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x02, Joypad.saveStateSlot));
  }
}

// Inlined because closure compiler inlines
export function getJoypadState(): i32 {
  // Get the joypad register
  let joypadRegister: i32 = Joypad.joypadRegisterFlipped;

  if (Joypad.isDpadType) {
    // D-pad buttons

    // Up
    if (Joypad.up) {
      joypadRegister = resetBitOnByte(2, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(2, joypadRegister);
    }

    // Right
    if (Joypad.right) {
      joypadRegister = resetBitOnByte(0, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(0, joypadRegister);
    }

    // Down
    if (Joypad.down) {
      joypadRegister = resetBitOnByte(3, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(3, joypadRegister);
    }

    // Left
    if (Joypad.left) {
      joypadRegister = resetBitOnByte(1, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(1, joypadRegister);
    }
  } else if (Joypad.isButtonType) {
    // A
    if (Joypad.a) {
      joypadRegister = resetBitOnByte(0, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(0, joypadRegister);
    }

    // B
    if (Joypad.b) {
      joypadRegister = resetBitOnByte(1, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(1, joypadRegister);
    }

    // Select
    if (Joypad.select) {
      joypadRegister = resetBitOnByte(2, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(2, joypadRegister);
    }

    // Start
    if (Joypad.start) {
      joypadRegister = resetBitOnByte(3, joypadRegister);
    } else {
      joypadRegister = setBitOnByte(3, joypadRegister);
    }
  }

  // Set the top 4 bits to on
  joypadRegister = joypadRegister | 0xf0;

  return joypadRegister;
}

export function setJoypadState(up: i32, right: i32, down: i32, left: i32, a: i32, b: i32, select: i32, start: i32): void {
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

function _pressJoypadButton(buttonId: i32): void {
  // Un stop the CPU
  Cpu.isStopped = false;

  // Check if the button state changed from not pressed
  let isButtonStateChanging: boolean = false;
  if (!_getJoypadButtonStateFromButtonId(buttonId)) {
    isButtonStateChanging = true;
  }

  // Set our joypad state
  _setJoypadButtonStateFromButtonId(buttonId, true);

  // If the button state is changing, check for an interrupt
  if (isButtonStateChanging) {
    // Determine if it is a button or a dpad button
    let isDpadTypeButton = false;
    if (buttonId <= 3) {
      isDpadTypeButton = true;
    }

    // Determine if we should request an interrupt
    let shouldRequestInterrupt = false;

    // Check if the game is looking for a dpad type button press
    if (Joypad.isDpadType && isDpadTypeButton) {
      shouldRequestInterrupt = true;
    }

    // Check if the game is looking for a button type button press
    if (Joypad.isButtonType && !isDpadTypeButton) {
      shouldRequestInterrupt = true;
    }

    // Finally, request the interrupt, if the button state actually changed
    if (shouldRequestInterrupt) {
      requestJoypadInterrupt();
    }
  }
}

// Inlined because closure compiler inlines
function _releaseJoypadButton(buttonId: i32): void {
  // Set our joypad state
  _setJoypadButtonStateFromButtonId(buttonId, false);
}

function _getJoypadButtonStateFromButtonId(buttonId: i32): boolean {
  switch (buttonId) {
    case 0:
      return Joypad.up;
    case 1:
      return Joypad.right;
    case 2:
      return Joypad.down;
    case 3:
      return Joypad.left;
    case 4:
      return Joypad.a;
    case 5:
      return Joypad.b;
    case 6:
      return Joypad.select;
    case 7:
      return Joypad.start;
    default:
      return false;
  }
}

function _setJoypadButtonStateFromButtonId(buttonId: i32, isPressed: boolean): void {
  switch (buttonId) {
    case 0:
      Joypad.up = isPressed;
      break;
    case 1:
      Joypad.right = isPressed;
      break;
    case 2:
      Joypad.down = isPressed;
      break;
    case 3:
      Joypad.left = isPressed;
      break;
    case 4:
      Joypad.a = isPressed;
      break;
    case 5:
      Joypad.b = isPressed;
      break;
    case 6:
      Joypad.select = isPressed;
      break;
    case 7:
      Joypad.start = isPressed;
      break;
  }
}
