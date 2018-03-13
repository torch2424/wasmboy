// Functions to help with Handling Duty on Square Channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave

import {
  getRegister1OfChannel
} from './registers';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelDuty(channelNumber: i8): u8 {
  let duty = getRegister1OfChannel(channelNumber);
  duty = (duty >> 6);
  return (duty & 0x03);
}

// Since there are no 2d arrays, we will use a byte to represent duty cycles (wave form from percentages)
export function isDutyCycleClockPositiveOrNegativeForWaveform(channelNumber: i8, waveFormPositionOnDuty: u8): boolean {
  // Get our current Duty
  let duty: u8 = getChannelDuty(channelNumber);

  // Get our Wave Form According to the Duty
  // Default to a duty of 1
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
  if (duty === 0x01) {
    // 1000 0001
    return checkBitOnByte(waveFormPositionOnDuty, 0x81);
  } else if (duty === 0x02) {
    // 1000 0111
    return checkBitOnByte(waveFormPositionOnDuty, 0x87);
  } else if (duty === 0x03) {
    // 0111 1110
    return checkBitOnByte(waveFormPositionOnDuty, 0x7E);
  } else {
    // 0000 0001
    return checkBitOnByte(waveFormPositionOnDuty, 0x01);
  }
}
