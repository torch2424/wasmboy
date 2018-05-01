// Functions to help with Handling Duty on Square Channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave

import { checkBitOnByte } from '../helpers/index';

// Since there are no 2d arrays, we will use a byte to represent duty cycles (wave form from percentages)
export function isDutyCycleClockPositiveOrNegativeForWaveform(channelDuty: i32, waveFormPositionOnDuty: i32): boolean {
  // Get our Wave Form According to the Duty
  // Default to a duty of 1
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
  switch (channelDuty) {
    case 0x01:
      // 1000 0001
      return checkBitOnByte(waveFormPositionOnDuty, 0x81);
    case 0x02:
      // 1000 0111
      return checkBitOnByte(waveFormPositionOnDuty, 0x87);
    case 0x03:
      // 0111 1110
      return checkBitOnByte(waveFormPositionOnDuty, 0x7e);
    default:
      // 0000 0001
      return checkBitOnByte(waveFormPositionOnDuty, 0x01);
  }
}
