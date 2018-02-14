import {
  eightBitStoreIntoGBMemorySkipTraps
} from './store';
import {
  getJoypadState
} from '../joypad/index'
import {
  consoleLog,
  consoleLogTwo
} from '../helpers/index';

// Returns -1 if no trap found, otherwise returns a value that should be fed for the address
export function checkReadTraps(offset: u16): i32 {
  if(offset === 0xFF00) {
    return getJoypadState();
  }

  return -1;
}
