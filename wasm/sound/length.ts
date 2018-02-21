// Functions to update Length Counters on Channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Length_Counter

import {
  getRegister1OfChannel,
  getRegister4OfChannel
} from './registers';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelLength(channelNumber: i8): u8 {
  let length = getRegister1OfChannel(channelNumber);
  // Clear the top 2 bits
  length = (length & 0x3F);
  return length;
}

export function isChannelLengthEnabled(channelNumber: i8): boolean {
  let soundRegister: u8 = getRegister4OfChannel(channelNumber);
  return checkBitOnByte(6, soundRegister)
}
