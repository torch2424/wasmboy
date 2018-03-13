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
  setChannelLengthCounter
} from '../sound/length';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  eightBitStoreIntoGBMemorySkipTraps
} from '../memory/index';
import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';

// TODO: handledReadToSoundRegister
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
// binji: I have a bool per channel called status that basically keeps track of whether a channel is playing currently. I return that bool in NR52

// Function to check and handle writes to sound registers
export function handledWriteToSoundRegister(offset: u16, value: u16): boolean {

  // Get our registerNR52
  let registerNR52: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR52);

  if(offset !== Sound.memoryLocationNR52 && !checkBitOnByte(7, registerNR52)) {
    // Block all writes to any sound register EXCEPT NR52!
    // This is under the assumption that the check for
    // offset >= 0xFF10 && offset <= 0xFF26
    // is done in writeTraps.ts (which it is)
    // NOTE: Except on DMG, length can still be written (whatever that means)
    return true;
  }

  // Set length counter on channels
  if(offset === Channel1.memoryLocationNRx1) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    setChannelLengthCounter(Channel1.channelNumber);
    return true;
  } else if(offset === Channel2.memoryLocationNRx1) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    setChannelLengthCounter(Channel2.channelNumber);
    return true;
  } else if(offset === Channel3.memoryLocationNRx1) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    setChannelLengthCounter(Channel3.channelNumber);
    return true;
  } else if(offset === Channel4.memoryLocationNRx1) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    setChannelLengthCounter(Channel4.channelNumber);
    return true;
  }

  // Check our NRx4 registers to trap our trigger bits
  if(offset === Channel1.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    // Write the value skipping traps, and then trigger
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    Channel1.trigger();
    return true;
  } else if(offset === Channel2.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    Channel2.trigger();
    return true;
  } else if(offset === Channel3.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    Channel3.trigger();
    return true;
  } else if(offset === Channel4.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    Channel4.trigger();
    return true;
  }

  // Write 0 to the 7th bit of NR52, resets all sound registers, and stops them from receiving writes
  if(offset === Sound.memoryLocationNR52 && !checkBitOnByte(7, <u8>value)) {

    // Reset all registers except NR52
    for (let i: u16 = 0xFF10; i < 0xFF26; i++) {
      eightBitStoreIntoGBMemorySkipTraps(i, 0x00);
    }

    // Write our final value to NR52
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);

    return true;
  }

  // We did not handle the write, return false
  return false;
}

export function getChannelStartingVolume(channelNumber: i32): u8 {
  // Simply need to get the top 4 bits of register 2
  let startingVolume: u8 = getRegister2OfChannel(channelNumber);
  startingVolume = (startingVolume >> 4);
  return (startingVolume & 0x0F);
}

export function isChannelDacEnabled(channelNumber: i32): boolean {
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

export function isChannelEnabledOnLeftOutput(channelNumber: i32): boolean {
  let registerNR51: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR51);
  // Left channel in the higher bits
  let bitNumberOfChannel: u8 = (<u8>channelNumber - 1) + 4;
  return checkBitOnByte(bitNumberOfChannel, registerNR51);
}

export function isChannelEnabledOnRightOutput(channelNumber: i32): boolean {
  let registerNR51: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR51);
  // Left channel in the higher bits
  let bitNumberOfChannel: u8 = (<u8>channelNumber - 1);
  return checkBitOnByte(bitNumberOfChannel, registerNR51);
}

// Function to get 1st register of a channel
// Contains Duty and Length
export function getRegister1OfChannel(channelNumber: i32): u8 {
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
export function getRegister2OfChannel(channelNumber: i32): u8 {
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
export function getRegister3OfChannel(channelNumber: i32): u8 {
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

export function setRegister3OfChannel(channelNumber: i32, value: u8): void {
  if (channelNumber === 1) {
    eightBitStoreIntoGBMemorySkipTraps(Channel1.memoryLocationNRx3, value);
  } else if (channelNumber === 2) {
    eightBitStoreIntoGBMemorySkipTraps(Channel2.memoryLocationNRx3, value);
  } else if (channelNumber === 3) {
    eightBitStoreIntoGBMemorySkipTraps(Channel3.memoryLocationNRx3, value);
  } else {
    eightBitStoreIntoGBMemorySkipTraps(Channel4.memoryLocationNRx3, value);
  }
}

// Function to get 4th register of a channel
// Contains Fequency MSB (higher 3 bits), and Length Information
export function getRegister4OfChannel(channelNumber: i32): u8 {
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

export function setRegister4OfChannel(channelNumber: i32, value: u8): void {
  if (channelNumber === 1) {
    eightBitStoreIntoGBMemorySkipTraps(Channel1.memoryLocationNRx4, value);
  } else if (channelNumber === 2) {
    eightBitStoreIntoGBMemorySkipTraps(Channel2.memoryLocationNRx4, value);
  } else if (channelNumber === 3) {
    eightBitStoreIntoGBMemorySkipTraps(Channel3.memoryLocationNRx4, value);
  } else {
    eightBitStoreIntoGBMemorySkipTraps(Channel4.memoryLocationNRx4, value);
  }
}
