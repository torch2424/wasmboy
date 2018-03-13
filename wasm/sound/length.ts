// Functions to update Length Counters on Channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Length_Counter

import {
    Channel1
} from './channel1';
import {
    Channel2
} from './channel2';
import {
    Channel3
} from './channel3';
import {
    Channel4
} from './channel4';
import {
  getRegister1OfChannel,
  getRegister4OfChannel
} from './registers';
import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';

export function setChannelLengthCounter(channelNumber: i32): void {

  let lengthLoad = getRegister1OfChannel(channelNumber);

  // Clear the top 2 bits
  lengthLoad = (lengthLoad & 0x3F);
  // Channel length is determined by 64 (or 256 if channel 3), - the length load
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
  let length: u8 = 64;
  let result: u8 = 0;
  if (channelNumber === 3) {
    length = 255;
    // Supposed to be 256, so subtracting 255 and then adding 1 if that makes sense
    result = length - lengthLoad;
    result += 1;
  } else {
    result = length - lengthLoad;
  }

  // Set the Channel Length Counter
  if (channelNumber === Channel1.channelNumber) {
    Channel1.lengthCounter = result;
  } else if (channelNumber === Channel2.channelNumber) {
    Channel2.lengthCounter = result;
  } else if (channelNumber === Channel3.channelNumber) {
    Channel3.lengthCounter = result;
  } else if (channelNumber === Channel4.channelNumber) {
    Channel4.lengthCounter = result;
  }

}

export function isChannelLengthEnabled(channelNumber: i32): boolean {
  return checkBitOnByte(6, getRegister4OfChannel(channelNumber))
}
