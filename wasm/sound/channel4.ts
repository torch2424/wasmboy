// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Noise Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel

import {
  eightBitLoadFromGBMemorySkipTraps,
  eightBitStoreIntoGBMemory,
  eightBitStoreIntoGBMemorySkipTraps,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import {
  getChannelStartingVolume,
  isChannelDacEnabled,
  getRegister2OfChannel
} from './registers';
import {
  getChannelFrequency,
  setChannelFrequency
} from './frequency';
import {
  isChannelLengthEnabled
} from './length';
import {
  getChannelEnvelopePeriod,
  getChannelEnvelopeAddMode
} from './envelope';
import {
  isDutyCycleClockPositiveOrNegativeForWaveform
} from './duty';
import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';

export class Channel4 {

  // Channel 4
  // 'white noise' channel with volume envelope functions.
  // NR41 -> Sound length (R/W)
  static readonly memoryLocationNRx1: u16 = 0xFF20;
  // NR42 -> Volume Envelope (R/W)
  static readonly memoryLocationNRx2: u16 = 0xFF21;
  // NR43 -> Polynomial Counter (R/W)
  static readonly memoryLocationNRx3: u16 = 0xFF22;
  // NR43 -> Counter/consecutive; initial (R/W)
  static readonly memoryLocationNRx4: u16 = 0xFF23;

  // Channel Properties
  static readonly channelNumber: i32 = 4;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  // Noise properties
  // NOTE: Is only 15 bits
  static linearFeedbackShiftRegister: u16 = 0x00;

  // Save States

  static readonly saveStateSlot: u16 = 10;

  // Function to save the state of the class
  static saveState(): void {
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot), Channel4.isEnabled);
    store<i32>(getSaveStateMemoryOffset(0x01, Channel4.saveStateSlot), Channel4.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x05, Channel4.saveStateSlot), Channel4.envelopeCounter);
    store<i32>(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot), Channel4.lengthCounter);
    store<i32>(getSaveStateMemoryOffset(0x0E, Channel4.saveStateSlot), Channel4.volume);
    store<u16>(getSaveStateMemoryOffset(0x13, Channel4.saveStateSlot), Channel4.linearFeedbackShiftRegister);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Channel4.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot));
    Channel4.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x01, Channel4.saveStateSlot));
    Channel4.envelopeCounter = load<i32>(getSaveStateMemoryOffset(0x05, Channel4.saveStateSlot));
    Channel4.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot));
    Channel4.volume = load<i32>(getSaveStateMemoryOffset(0x0E, Channel4.saveStateSlot));
    Channel4.linearFeedbackShiftRegister = load<u16>(getSaveStateMemoryOffset(0x13, Channel4.saveStateSlot));
  }

  static initialize(): void {
    eightBitStoreIntoGBMemorySkipTraps(Channel4.memoryLocationNRx1 - 1, 0xFF);
    eightBitStoreIntoGBMemorySkipTraps(Channel4.memoryLocationNRx1, 0xFF);
    eightBitStoreIntoGBMemorySkipTraps(Channel4.memoryLocationNRx2, 0x00);
    eightBitStoreIntoGBMemorySkipTraps(Channel4.memoryLocationNRx3, 0x00);
    eightBitStoreIntoGBMemorySkipTraps(Channel4.memoryLocationNRx4, 0xBF);
  }

  static getSample(numberOfCycles: u8): i32 {

    // Decrement our channel timer
    Channel4.frequencyTimer -= <i32>numberOfCycles;

    if(Channel4.frequencyTimer <= 0) {

      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount: i32 = abs(Channel4.frequencyTimer);

      // Reset our timer
      Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();
      Channel4.frequencyTimer -= overflowAmount;

      // Do some cool stuff with lfsr
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel

      // First XOR bit zero and one
      let lfsrBitZero: u16 = (Channel4.linearFeedbackShiftRegister & 0x01);
      let lfsrBitOne: u16 = (Channel4.linearFeedbackShiftRegister >> 1);
      lfsrBitOne = (lfsrBitOne & 0x01);
      let xorLfsrBitZeroOne = lfsrBitZero ^ lfsrBitOne;

      // Shift all lsfr bits by one
      Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister >> 1;

      // Place the XOR result on bit 15
      Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 14);

      // If the width mode is set, set xor on bit 6, and make lfsr 7 bit
      if(Channel4.isNoiseChannelWidthModeSet()) {
        // Make 7 bit, by knocking off lower bits. Want to keeps bits 8 - 16, and then or on 7
        Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister & (~0x40);
        Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 6);
      }
    }

    // Get our ourput volume, set to zero for silence
    let outputVolume: i32 = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if(Channel4.isEnabled &&
    isChannelDacEnabled(Channel4.channelNumber)) {
      outputVolume = Channel4.volume;
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Declare our sample
    let sample: i32 = 0;

    // Wave form output is bit zero of lfsr, INVERTED
    if (!checkBitOnByte(0, <u8>Channel4.linearFeedbackShiftRegister)) {
      sample = 1;
    } else {
      sample = -1;
    }

    sample = sample * outputVolume;

    // Noise Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return <i32>sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel4.isEnabled = true;
    if(Channel4.lengthCounter === 0) {
      Channel4.lengthCounter = 64;
    }

    // Reset our timers
    Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();

    Channel4.envelopeCounter = getChannelEnvelopePeriod(Channel4.channelNumber);

    Channel4.volume = getChannelStartingVolume(Channel4.channelNumber);

    // Noise channel's LFSR bits are all set to 1.
    Channel4.linearFeedbackShiftRegister = 0x7FFF;

    // Finally if DAC is off, channel is still disabled
    if(!isChannelDacEnabled(Channel4.channelNumber)) {
      Channel4.isEnabled = false;
    }
  }

  static getNoiseChannelFrequencyPeriod(): u16 {
    // Get our divisor from the divisor code
    let divisor: u16 = Channel4.getNoiseChannelDivisorFromDivisorCode();
    let clockShift: u8 = Channel4.getNoiseChannelClockShift();
    return (divisor << clockShift);
  }

  static getNoiseChannelClockShift(): u8 {
    let registerNRx3: u8 = eightBitLoadFromGBMemorySkipTraps(Channel4.memoryLocationNRx3);
    // It is within the top 4 bits
    let clockShift = (registerNRx3 >> 4);
    return clockShift;
  }

  static isNoiseChannelWidthModeSet(): boolean {
    let registerNRx3: u8 = eightBitLoadFromGBMemorySkipTraps(Channel4.memoryLocationNRx3);
    return checkBitOnByte(3, registerNRx3);
  }

  static getNoiseChannelDivisorFromDivisorCode(): u8 {
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel
    // Get our divisor code
    let registerNRx3: u8 = eightBitLoadFromGBMemorySkipTraps(Channel4.memoryLocationNRx3);
    // Get the bottom 3 bits
    let divisorCode: u8 = registerNRx3 & 0x07;
    let divisor: u8 = 0;
    if(divisorCode === 0) {
      divisor = 8;
    } else if (divisorCode === 1) {
      divisor = 16;
    } else if (divisorCode === 2) {
      divisor = 32;
    } else if (divisorCode === 3) {
      divisor = 48;
    } else if (divisorCode === 4) {
      divisor = 64;
    } else if (divisorCode === 5) {
      divisor = 80;
    } else if (divisorCode === 6) {
      divisor = 96;
    } else if (divisorCode === 7) {
      divisor = 112;
    }
    return divisor;
  }

  static updateLength(): void {
    if(Channel4.lengthCounter > 0 && isChannelLengthEnabled(Channel4.channelNumber)) {
      Channel4.lengthCounter -= 1;
    }

    if(Channel4.lengthCounter === 0) {
      Channel4.isEnabled = false;
    }
  }

  static updateEnvelope(): void {

    // Obscure behavior
    // TODO: The volume envelope and sweep timers treat a period of 0 as 8.

    Channel4.envelopeCounter -= 1;
    if (Channel4.envelopeCounter <= 0) {
      Channel4.envelopeCounter = getChannelEnvelopePeriod(Channel4.channelNumber);

      // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
      // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
      if(Channel4.envelopeCounter !== 0) {
        if(getChannelEnvelopeAddMode(Channel4.channelNumber) && Channel4.volume < 15) {
          Channel4.volume += 1;
        } else if (!getChannelEnvelopeAddMode(Channel4.channelNumber) && Channel4.volume > 0) {
          Channel4.volume -= 1;
        }
      }
    }
  }
  // Done!
}
