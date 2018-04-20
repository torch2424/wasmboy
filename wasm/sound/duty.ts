// Functions to help with Handling Duty on Square Channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave

import {
  getRegister1OfChannel
} from './registers';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelDuty(channelNumber: i32): i32 {
  //let duty = getRegister1OfChannel(channelNumber);
  //duty = (getRegister1OfChannel(channelNumber) >> 6);
  return ((getRegister1OfChannel(channelNumber) >> 6) & 0x03);
}

// Since there are no 2d arrays, we will use a byte to represent duty cycles (wave form from percentages)
// TODO: Pass in Channel Duty
export function isDutyCycleClockPositiveOrNegativeForWaveform(channelDuty: i32, waveFormPositionOnDuty: i32): boolean {
  // Get our Wave Form According to the Duty
  // Default to a duty of 1
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
  switch(channelDuty) {
    case 0x01:
      // 1000 0001
      return checkBitOnByte(waveFormPositionOnDuty, 0x81);
    case 0x02:
      // 1000 0111
      return checkBitOnByte(waveFormPositionOnDuty, 0x87);
    case 0x03:
      // 0111 1110
      return checkBitOnByte(waveFormPositionOnDuty, 0x7E);
    default:
      // 0000 0001
      return checkBitOnByte(waveFormPositionOnDuty, 0x01);
  }
}
