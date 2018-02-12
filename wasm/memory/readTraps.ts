import {
  eightBitStoreIntoGBMemorySkipTraps
} from './store';
import {
  consoleLog,
  consoleLogTwo
} from '../helpers/index';

export function checkReadTraps(offset: u16): boolean {
  // TODO: Remove this joypad hack
  if(offset === 0xFF00) {
    eightBitStoreIntoGBMemorySkipTraps(0xFF00, 0xFF);
  }
  return true;
}
