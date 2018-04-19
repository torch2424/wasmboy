// Functions to update frequency on channels
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel

import {
  getRegister3OfChannel,
  getRegister4OfChannel,
  setRegister3OfChannel,
  setRegister4OfChannel
} from './registers';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelFrequency(channelNumber: i32): i32 {
  // Need to get the 3rd and 4th register.
  // 3rd register is the bottom 8 bits.
  // 4th register contains bits 9-11.
  let frequencyHighBits: i32 = getRegister4OfChannel(channelNumber) & 0x07;
  frequencyHighBits = (frequencyHighBits << 8);
  let frequencyLowBits: i32 = getRegister3OfChannel(channelNumber);
  let frequency = frequencyHighBits | frequencyLowBits;
  return frequency;
}

export function setChannelFrequency(channelNumber: i32, frequency: i32): void {
  // Get the high and low bits
  let passedFrequencyHighBits: i32 = (frequency >> 8);
  let passedFrequencyLowBits: i32 = (frequency & 0xFF);

  // Get the new register 4
  let register4: i32 = getRegister4OfChannel(channelNumber);
  // Knock off lower 3 bits, and Or on our high bits
  let newRegister4: i32 = (register4 & 0xF8);
  newRegister4 = newRegister4 | passedFrequencyHighBits;

  // Finally set the registers
  setRegister3OfChannel(channelNumber, passedFrequencyLowBits);
  setRegister4OfChannel(channelNumber, newRegister4);
}
