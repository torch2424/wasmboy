// Functions to update envelopes on Channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Volume_Envelope

import {
  getRegister2OfChannel
} from './registers';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelEnvelopePeriod(channelNumber: i8): u8 {
  let soundRegister: u8 = getRegister2OfChannel(channelNumber);
  // Get the bottom 3 bits for the period
  return soundRegister & 0x07;
}

export function getChannelEnvelopeAddMode(channelNumber: i8): boolean {
  let soundRegister: u8 = getRegister2OfChannel(channelNumber);
  return checkBitOnByte(3, soundRegister)
}
