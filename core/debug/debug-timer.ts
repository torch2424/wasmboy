import { Timers } from '../timers/timers';
import { setBitOnByte } from '../helpers/index';

export function getDIV(): i32 {
  return Timers.dividerRegister;
}

export function getTIMA(): i32 {
  return Timers.timerCounter;
}

export function getTMA(): i32 {
  return Timers.timerModulo;
}

export function getTAC(): i32 {
  let response: i32 = Timers.timerInputClock;

  if (Timers.timerEnabled) {
    response = setBitOnByte(2, response);
  }

  return response;
}
