// Functions to update envelopes on Channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Volume_Envelope

import {
  getRegister2OfChannel
} from './registers';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelEnvelopePeriod(channelNumber: i32): i32 {
  // Get the bottom 3 bits for the period
  return getRegister2OfChannel(channelNumber) & 0x07;
}

export function getChannelEnvelopeAddMode(channelNumber: i32): boolean {
  return checkBitOnByte(3, getRegister2OfChannel(channelNumber))
}
