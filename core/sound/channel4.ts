// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Noise Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel
import { getSaveStateMemoryOffset } from '../core';
import { isDutyCycleClockPositiveOrNegativeForWaveform } from './duty';
import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemoryWithTraps,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { checkBitOnByte, hexLog } from '../helpers/index';

export class Channel4 {
  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Channel 4
  // 'white noise' channel with volume envelope functions.
  // NR41 -> Sound length (R/W)
  static readonly memoryLocationNRx1: i32 = 0xff20;
  // --LL LLLL Length load (64-L)
  static NRx1LengthLoad: i32 = 0;
  static updateNRx1(value: i32): void {
    Channel4.NRx1LengthLoad = value & 0x3f;

    // Also need to set our length counter. Taken from the old, setChannelLengthCounter
    // Channel length is determined by 64 (or 256 if channel 3), - the length load
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
    // Note, this will be different for channel 3
    Channel4.lengthCounter = 64 - Channel4.NRx1LengthLoad;
  }

  // NR42 -> Volume Envelope (R/W)
  static readonly memoryLocationNRx2: i32 = 0xff21;
  // VVVV APPP Starting volume, Envelope add mode, period
  static NRx2StartingVolume: i32 = 0;
  static NRx2EnvelopeAddMode: boolean = false;
  static NRx2EnvelopePeriod: i32 = 0;
  static updateNRx2(value: i32): void {
    Channel4.NRx2StartingVolume = (value >> 4) & 0x0f;
    Channel4.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
    Channel4.NRx2EnvelopePeriod = value & 0x07;

    // Also, get our channel is dac enabled
    Channel4.isDacEnabled = (value & 0xf8) > 0;
  }

  // NR43 -> Polynomial Counter (R/W)
  static readonly memoryLocationNRx3: i32 = 0xff22;
  // SSSS WDDD Clock shift, Width mode of LFSR, Divisor code
  static NRx3ClockShift: i32 = 0;
  static NRx3WidthMode: boolean = false;
  static NRx3DivisorCode: i32 = 0;
  static updateNRx3(value: i32): void {
    Channel4.NRx3ClockShift = value >> 4;
    Channel4.NRx3WidthMode = checkBitOnByte(3, value);
    Channel4.NRx3DivisorCode = value & 0x07;

    // Also, get our divisor
    switch (Channel4.NRx3DivisorCode) {
      case 0:
        Channel4.divisor = 8;
        return;
      case 1:
        Channel4.divisor = 16;
        return;
      case 2:
        Channel4.divisor = 32;
        return;
      case 3:
        Channel4.divisor = 48;
        return;
      case 4:
        Channel4.divisor = 64;
        return;
      case 5:
        Channel4.divisor = 80;
        return;
      case 6:
        Channel4.divisor = 96;
        return;
      case 7:
        Channel4.divisor = 112;
        return;
    }
  }

  // NR44 -> Trigger, Length Enable
  static readonly memoryLocationNRx4: i32 = 0xff23;
  // TL-- ---- Trigger, Length enable
  static NRx4LengthEnabled: boolean = false;
  static updateNRx4(value: i32): void {
    Channel4.NRx4LengthEnabled = checkBitOnByte(6, value);
  }

  // Channel Properties
  static readonly channelNumber: i32 = 4;
  static isEnabled: boolean = false;
  static isDacEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;
  static divisor: i32 = 0;

  // Noise properties
  // NOTE: Is only 15 bits
  static linearFeedbackShiftRegister: i32 = 0x00;

  // Save States

  static readonly saveStateSlot: i32 = 10;

  // Function to save the state of the class
  static saveState(): void {
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot), Channel4.isEnabled);
    store<i32>(getSaveStateMemoryOffset(0x01, Channel4.saveStateSlot), Channel4.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x05, Channel4.saveStateSlot), Channel4.envelopeCounter);
    store<i32>(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot), Channel4.lengthCounter);
    store<i32>(getSaveStateMemoryOffset(0x0e, Channel4.saveStateSlot), Channel4.volume);
    store<u16>(getSaveStateMemoryOffset(0x13, Channel4.saveStateSlot), Channel4.linearFeedbackShiftRegister);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Channel4.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot));
    Channel4.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x01, Channel4.saveStateSlot));
    Channel4.envelopeCounter = load<i32>(getSaveStateMemoryOffset(0x05, Channel4.saveStateSlot));
    Channel4.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot));
    Channel4.volume = load<i32>(getSaveStateMemoryOffset(0x0e, Channel4.saveStateSlot));
    Channel4.linearFeedbackShiftRegister = load<u16>(getSaveStateMemoryOffset(0x13, Channel4.saveStateSlot));
  }

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1 - 1, 0xff);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1, 0xff);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx2, 0x00);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx3, 0x00);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx4, 0xbf);
  }

  // Function to get a sample using the cycle counter on the channel
  static getSampleFromCycleCounter(): i32 {
    let accumulatedCycles: i32 = Channel4.cycleCounter;
    Channel4.cycleCounter = 0;
    return Channel4.getSample(accumulatedCycles);
  }

  static getSample(numberOfCycles: i32): i32 {
    // Decrement our channel timer
    Channel4.frequencyTimer -= numberOfCycles;

    if (Channel4.frequencyTimer <= 0) {
      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount: i32 = abs(Channel4.frequencyTimer);

      // Reset our timer
      Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();
      Channel4.frequencyTimer -= overflowAmount;

      // Do some cool stuff with lfsr
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel

      // First XOR bit zero and one
      let lfsrBitZero: i32 = Channel4.linearFeedbackShiftRegister & 0x01;
      let lfsrBitOne: i32 = Channel4.linearFeedbackShiftRegister >> 1;
      lfsrBitOne = lfsrBitOne & 0x01;
      let xorLfsrBitZeroOne = lfsrBitZero ^ lfsrBitOne;

      // Shift all lsfr bits by one
      Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister >> 1;

      // Place the XOR result on bit 15
      Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 14);

      // If the width mode is set, set xor on bit 6, and make lfsr 7 bit
      if (Channel4.NRx3WidthMode) {
        // Make 7 bit, by knocking off lower bits. Want to keeps bits 8 - 16, and then or on 7
        Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister & ~0x40;
        Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 6);
      }
    }

    // Get our ourput volume, set to zero for silence
    let outputVolume: i32 = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if (Channel4.isEnabled && Channel4.isDacEnabled) {
      outputVolume = Channel4.volume;
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Declare our sample
    let sample: i32 = 0;

    // Wave form output is bit zero of lfsr, INVERTED
    if (!checkBitOnByte(0, Channel4.linearFeedbackShiftRegister)) {
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
    if (Channel4.lengthCounter === 0) {
      Channel4.lengthCounter = 64;
    }

    // Reset our timers
    Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();

    Channel4.envelopeCounter = Channel4.NRx2EnvelopePeriod;

    Channel4.volume = Channel4.NRx2StartingVolume;

    // Noise channel's LFSR bits are all set to 1.
    Channel4.linearFeedbackShiftRegister = 0x7fff;

    // Finally if DAC is off, channel is still disabled
    if (!Channel4.isDacEnabled) {
      Channel4.isEnabled = false;
    }
  }

  // Function to determine if the current channel would update when getting the sample
  // This is used to accumulate samples
  static willChannelUpdate(numberOfCycles: i32): boolean {
    //Increment our cycle counter
    Channel4.cycleCounter += numberOfCycles;

    // Dac enabled status cached by accumulator
    if (Channel4.frequencyTimer - Channel4.cycleCounter > 0) {
      return false;
    }

    return true;
  }

  static getNoiseChannelFrequencyPeriod(): i32 {
    // Get our divisor from the divisor code, and shift by the clock shift
    let response: i32 = Channel4.divisor << Channel4.NRx3ClockShift;
    if (Cpu.GBCDoubleSpeed) {
      response = response * 2;
    }
    return response;
  }

  static updateLength(): void {
    if (Channel4.lengthCounter > 0 && Channel4.NRx4LengthEnabled) {
      Channel4.lengthCounter -= 1;
    }

    if (Channel4.lengthCounter === 0) {
      Channel4.isEnabled = false;
    }
  }

  static updateEnvelope(): void {
    // Obscure behavior
    // TODO: The volume envelope and sweep timers treat a period of 0 as 8.

    Channel4.envelopeCounter -= 1;
    if (Channel4.envelopeCounter <= 0) {
      Channel4.envelopeCounter = Channel4.NRx2EnvelopePeriod;

      // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
      // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
      if (Channel4.envelopeCounter !== 0) {
        if (Channel4.NRx2EnvelopeAddMode && Channel4.volume < 15) {
          Channel4.volume += 1;
        } else if (!Channel4.NRx2EnvelopeAddMode && Channel4.volume > 0) {
          Channel4.volume -= 1;
        }
      }
    }
  }
  // Done!
}
