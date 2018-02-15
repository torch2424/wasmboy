const Key = {

  BACKSPACE: 8,
  TAB: 9,
  RETURN: 13,
  SHIFT: 16,
  CTRL: 17,
  ALT: 18,
  ESCAPE: 27,
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  END: 35,
  HOME: 36,

  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,

  W: 87,
  A: 65,
  S: 83,
  D: 68,
  Q: 81,
  E: 69,

  NUMPAD_0: 96,
  NUMPAD_1: 97,
  NUMPAD_2: 98,
  NUMPAD_3: 99,
  NUMPAD_4: 100,
  NUMPAD_5: 101,
  NUMPAD_6: 102,
  NUMPAD_7: 103,
  NUMPAD_8: 104,
  NUMPAD_9: 105
};

// Define our Keys here
export const WASMBOY_CONTROLLER_STATE = {
  UP: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        Key.ARROW_UP,
        Key.W,
        Key.NUMPAD_8
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  },
  RIGHT: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        Key.ARROW_RIGHT,
        Key.D,
        Key.NUMPAD_6
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  },
  DOWN: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        Key.ARROW_DOWN,
        Key.S,
        Key.NUMPAD_5,
        Key.NUMPAD_2
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  },
  LEFT: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        Key.ARROW_LEFT,
        Key.A,
        Key.NUMPAD_4
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  },
  A: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        90,
        186,
        Key.NUMPAD_7
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  },
  B: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        88,
        Key.ESCAPE,
        222,
        Key.BACKSPACE,
        Key.NUMPAD_9
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  },
  SELECT: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        Key.SHIFT,
        220,
        Key.TAB,
        Key.NUMPAD_1
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  },
  START: {
    KEYBOARD: {
      IS_PRESSED: false,
      EVENT_KEY_CODES: [
        Key.RETURN,
        Key.SPACE,
        Key.NUMPAD_3
      ]
    },
    GAMEPAD: {
      IS_PRESSED: false
    },
    VIRTUAL_GAMEPAD: {
      IS_PRESSED: false
    }
  }
}
