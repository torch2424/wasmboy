// Functions involved in R/W of sound registers
// Information of bits on every register can be found at: https://gist.github.com/drhelius/3652407
// Passing channel number to make things simpler than passing around memory addresses, to avoid bugs in choosing the wrong address

import {
  Sound
} from './sound';
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
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory
} from '../memory/index';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelStartingVolume(channelNumber: i8): u8 {
  // Simply need to get the top 4 bits of register 2
  let startingVolume: u8 = getRegister2OfChannel(channelNumber);
  startingVolume = (startingVolume >> 4);
  return (startingVolume & 0x0F);
}

export function isChannelDacEnabled(channelNumber: i8): boolean {
  // DAC power is controlled by the upper 5 bits of NRx2 (top bit of NR30 for wave channel).
  // If these bits are not all clear, the DAC is on, otherwise it's off and outputs 0 volts.
  if(channelNumber !== 3) {
    let register2 = getRegister2OfChannel(channelNumber);
    // Clear bottom 3 bits
    let dacStatus = (register2 & 0xF8);
    if (dacStatus > 0) {
      return true;
    } else {
      return false;
    }
  } else {
    let register3 = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx0);
    return checkBitOnByte(7, register3);
  }
}

export function isChannelEnabledOnLeftOutput(channelNumber: i8): boolean {
  let registerNR51: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR51);
  // Left channel in the higher bits
  let bitNumberOfChannel: u8 = (<u8>channelNumber - 1) + 4;
  return checkBitOnByte(bitNumberOfChannel, registerNR51);
}

export function isChannelEnabledOnRightOutput(channelNumber: i8): boolean {
  let registerNR51: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR51);
  // Left channel in the higher bits
  let bitNumberOfChannel: u8 = (<u8>channelNumber - 1);
  return checkBitOnByte(bitNumberOfChannel, registerNR51);
}

// Function to get 1st register of a channel
// Contains Duty and Length
export function getRegister1OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Channel1.memoryLocationNRx1);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Channel2.memoryLocationNRx1);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Channel3.memoryLocationNRx1);
  } else {
    return eightBitLoadFromGBMemory(Channel4.memoryLocationNRx1);
  }
}

// Function to get 2nd register of a channel
// Contains Envelope Information
export function getRegister2OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Channel1.memoryLocationNRx2);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Channel2.memoryLocationNRx2);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
  } else {
    return eightBitLoadFromGBMemory(Channel4.memoryLocationNRx2);
  }
}

// Function to get 3rd register of a channel
// Contains Fequency LSB (lower 8 bits)
export function getRegister3OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Channel1.memoryLocationNRx3);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Channel2.memoryLocationNRx3);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Channel3.memoryLocationNRx3);
  } else {
    return eightBitLoadFromGBMemory(Channel4.memoryLocationNRx3);
  }
}

export function setRegister3OfChannel(channelNumber: i8, value: u8): void {
  if (channelNumber === 1) {
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, value);
  } else if (channelNumber === 2) {
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, value);
  } else if (channelNumber === 3) {
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx3, value);
  } else {
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx3, value);
  }
}

// Function to get 4th register of a channel
// Contains Fequency MSB (higher 3 bits), and Length Information
export function getRegister4OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Channel1.memoryLocationNRx4);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Channel2.memoryLocationNRx4);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Channel3.memoryLocationNRx4);
  } else {
    return eightBitLoadFromGBMemory(Channel4.memoryLocationNRx4);
  }
}

export function setRegister4OfChannel(channelNumber: i8, value: u8): void {
  if (channelNumber === 1) {
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, value);
  } else if (channelNumber === 2) {
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, value);
  } else if (channelNumber === 3) {
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx4, value);
  } else {
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx4, value);
  }
}
