// Functions in volved in R/W of sound registers

// Information of bits on every register can be found at: https://gist.github.com/drhelius/3652407

// Passing channel number to make things simpler than passing around memory addresses, to avoid bugs in choosing the wrong address
import {
  Sound
} from './sound';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory
} from '../memory/index';
import {
  checkBitOnByte
} from '../helpers/index';

export function getChannelFrequency(channelNumber: i8): u16 {
  // Need to get the 3rd and 4th register.
  // 3rd register is the bottom 8 bits.
  // 4th register contains bits 9-11.
  let frequencyHighBits: u16 = getRegister4OfChannel(channelNumber) & 0x07;
  frequencyHighBits = (frequencyHighBits << 8);
  let frequencyLowBits: u16 = getRegister3OfChannel(channelNumber);
  let frequency = frequencyHighBits | frequencyLowBits;
  return frequency;
}

export function setChannelFrequency(channelNumber: i8, frequency: u16): void {
  // Get the high and low bits
  let passedFrequencyHighBits: u8 = <u8>(frequency >> 8);
  let passedFrequencyLowBits: u8 = <u8>(frequency & 0xFF);

  // Get the new register 4
  let register4: u8 = getRegister4OfChannel(channelNumber);
  // Knock off lower 3 bits, and Or on our high bits
  let newRegister4: u8 = (register4 & 0xF8);
  newRegister4 = newRegister4 | passedFrequencyHighBits;

  // Finally set the registers
  setRegister3OfChannel(channelNumber, passedFrequencyLowBits);
  setRegister4OfChannel(channelNumber, newRegister4);
}

export function getChannelDuty(channelNumber: i8): u8 {
  let duty = getRegister1OfChannel(channelNumber);
  duty = (duty >> 6);
  return (duty & 0x03);
}

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

export function getChannelEnvelopePeriod(channelNumber: i8): u8 {
  let soundRegister: u8 = getRegister2OfChannel(channelNumber);
  // Get the bottom 3 bits for the period
  let channelPeriod: u8 = soundRegister & 0x07;
  return channelPeriod;
}

export function getChannelEnvelopeAddMode(channelNumber: i8): boolean {
  let soundRegister: u8 = getRegister2OfChannel(channelNumber);
  return checkBitOnByte(3, soundRegister)
}

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
    let dacStatus = register2 & 0xF8;
    if (dacStatus > 0) {
      return true;
    } else {
      return false;
    }
  } else {
    let register3 = getRegister3OfChannel(channelNumber);
    return checkBitOnByte(7, register3);
  }
}

// Function to get 1st register of a channel
// Contains Duty and Length
function getRegister1OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR11);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR21);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR31);
  } else {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR41);
  }
}

// Function to get 2nd register of a channel
// Contains Envelope Information
function getRegister2OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR12);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR22);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR32);
  } else {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR42);
  }
}

// Function to get 3rd register of a channel
// Contains Fequency LSB (lower 8 bits)
function getRegister3OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR13);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR23);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR33);
  } else {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR43);
  }
}

function setRegister3OfChannel(channelNumber: i8, value: u8): void {
  if (channelNumber === 1) {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR13, value);
  } else if (channelNumber === 2) {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR23, value);
  } else if (channelNumber === 3) {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR33, value);
  } else {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR43, value);
  }
}

// Function to get 4th register of a channel
// Contains Fequency MSB (higher 3 bits), and Length Information
function getRegister4OfChannel(channelNumber: i8): u8 {
  if (channelNumber === 1) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR14);
  } else if (channelNumber === 2) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR24);
  } else if (channelNumber === 3) {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR34);
  } else {
    return eightBitLoadFromGBMemory(Sound.memoryLocationNR44);
  }
}

function setRegister4OfChannel(channelNumber: i8, value: u8): void {
  if (channelNumber === 1) {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR14, value);
  } else if (channelNumber === 2) {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR24, value);
  } else if (channelNumber === 3) {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR34, value);
  } else {
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR44, value);
  }
}
