// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Simple Square Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
import { getSaveStateMemoryOffset } from '../core';
import { isDutyCycleClockPositiveOrNegativeForWaveform } from './duty';
import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { checkBitOnByte } from '../helpers/index';

export class Channel2 {
  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Squarewave channel with volume envelope functions only.

  // NR21 -> Sound length/Wave pattern duty (R/W)
  static readonly memoryLocationNRx1: i32 = 0xff16;
  // DDLL LLLL Duty, Length load (64-L)
  static NRx1Duty: i32 = 0;
  static NRx1LengthLoad: i32 = 0;
  static updateNRx1(value: i32): void {
    Channel2.NRx1Duty = (value >> 6) & 0x03;
    Channel2.NRx1LengthLoad = value & 0x3f;

    // Also need to set our length counter. Taken from the old, setChannelLengthCounter
    // Channel length is determined by 64 (or 256 if channel 3), - the length load
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
    // Note, this will be different for channel 3
    Channel2.lengthCounter = 64 - Channel2.NRx1LengthLoad;
  }

  // NR22 -> Volume Envelope (R/W)
  static readonly memoryLocationNRx2: i32 = 0xff17;
  // VVVV APPP Starting volume, Envelope add mode, period
  static NRx2StartingVolume: i32 = 0;
  static NRx2EnvelopeAddMode: boolean = false;
  static NRx2EnvelopePeriod: i32 = 0;
  static updateNRx2(value: i32): void {
    Channel2.NRx2StartingVolume = (value >> 4) & 0x0f;
    Channel2.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
    Channel2.NRx2EnvelopePeriod = value & 0x07;

    // Also, get our channel is dac enabled
    Channel2.isDacEnabled = (value & 0xf8) > 0;
  }

  // NR23 -> Frequency lo (W)
  static readonly memoryLocationNRx3: i32 = 0xff18;
  // FFFF FFFF Frequency LSB
  static NRx3FrequencyLSB: i32 = 0;
  static updateNRx3(value: i32): void {
    Channel2.NRx3FrequencyLSB = value;

    // Update Channel Frequency
    let frequency: i32 = (Channel2.NRx4FrequencyMSB << 8) | Channel2.NRx3FrequencyLSB;
    Channel2.frequency = frequency;
  }

  // NR24 -> Frequency hi (R/W)
  static readonly memoryLocationNRx4: i32 = 0xff19;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  static NRx4LengthEnabled: boolean = false;
  static NRx4FrequencyMSB: i32 = 0;
  static updateNRx4(value: i32): void {
    Channel2.NRx4LengthEnabled = checkBitOnByte(6, value);
    Channel2.NRx4FrequencyMSB = value & 0x07;

    // Update Channel Frequency
    let frequency: i32 = (Channel2.NRx4FrequencyMSB << 8) | Channel2.NRx3FrequencyLSB;
    Channel2.frequency = frequency;
  }

  // Channel Properties
  static readonly channelNumber: i32 = 2;
  static isEnabled: boolean = false;
  static isDacEnabled: boolean = false;
  static frequency: i32 = 0;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  // Square Wave properties
  static dutyCycle: i32 = 0x00;
  static waveFormPositionOnDuty: i32 = 0x00;

  // Save States

  static readonly saveStateSlot: i32 = 8;

  // Function to save the state of the class
  static saveState(): void {
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel2.saveStateSlot), Channel2.isEnabled);
    store<i32>(getSaveStateMemoryOffset(0x01, Channel2.saveStateSlot), Channel2.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x05, Channel2.saveStateSlot), Channel2.envelopeCounter);
    store<i32>(getSaveStateMemoryOffset(0x09, Channel2.saveStateSlot), Channel2.lengthCounter);
    store<i32>(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot), Channel2.volume);

    store<u8>(getSaveStateMemoryOffset(0x13, Channel2.saveStateSlot), Channel2.dutyCycle);
    store<u8>(getSaveStateMemoryOffset(0x14, Channel2.saveStateSlot), <u8>Channel2.waveFormPositionOnDuty);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Channel2.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel2.saveStateSlot));
    Channel2.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x01, Channel2.saveStateSlot));
    Channel2.envelopeCounter = load<i32>(getSaveStateMemoryOffset(0x05, Channel2.saveStateSlot));
    Channel2.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x09, Channel2.saveStateSlot));
    Channel2.volume = load<i32>(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot));

    Channel2.dutyCycle = load<u8>(getSaveStateMemoryOffset(0x13, Channel2.saveStateSlot));
    Channel2.waveFormPositionOnDuty = load<u8>(getSaveStateMemoryOffset(0x14, Channel2.saveStateSlot));
  }

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1 - 1, 0xff);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1, 0x3f);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx2, 0x00);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, 0x00);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, 0xb8);
  }

  // Function to get a sample using the cycle counter on the channel
  static getSampleFromCycleCounter(): i32 {
    let accumulatedCycles = Channel2.cycleCounter;
    Channel2.cycleCounter = 0;
    return Channel2.getSample(accumulatedCycles);
  }

  // Function to reset our timer, useful for GBC double speed mode
  static resetTimer(): void {
    let frequencyTimer = (2048 - Channel2.frequency) << 2;

    // TODO: Ensure this is correct for GBC Double Speed Mode
    Channel2.frequencyTimer = frequencyTimer << (<i32>Cpu.GBCDoubleSpeed);
  }

  static getSample(numberOfCycles: i32): i32 {
    // Decrement our channel timer
    let frequencyTimer = Channel2.frequencyTimer - numberOfCycles;
    Channel2.frequencyTimer = frequencyTimer;
    if (frequencyTimer <= 0) {
      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount = abs(frequencyTimer);

      // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
      Channel2.resetTimer();
      Channel2.frequencyTimer -= overflowAmount;

      // Also increment our duty cycle
      // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
      // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
      let waveFormPositionOnDuty = Channel2.waveFormPositionOnDuty;
      waveFormPositionOnDuty += 1;
      if (waveFormPositionOnDuty >= 8) {
        waveFormPositionOnDuty = 0;
      }
      Channel2.waveFormPositionOnDuty = waveFormPositionOnDuty;
    }

    // Get our ourput volume
    let outputVolume = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if (Channel2.isEnabled && Channel2.isDacEnabled) {
      outputVolume = Channel2.volume;
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Get the current sampleValue
    let sample = 1;
    if (!isDutyCycleClockPositiveOrNegativeForWaveform(Channel2.NRx1Duty, Channel2.waveFormPositionOnDuty)) {
      sample = -sample;
    }

    sample = sample * outputVolume;

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel2.isEnabled = true;
    if (Channel2.lengthCounter === 0) {
      Channel2.lengthCounter = 64;
    }

    // Reset our timer
    // A square channel's frequency timer period is set to (2048-frequency)*4.
    // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
    Channel2.resetTimer();

    Channel2.envelopeCounter = Channel2.NRx2EnvelopePeriod;

    Channel2.volume = Channel2.NRx2StartingVolume;

    // Finally if DAC is off, channel is still disabled
    if (!Channel2.isDacEnabled) {
      Channel2.isEnabled = false;
    }
  }

  // Function to determine if the current channel would update when getting the sample
  // This is used to accumulate samples
  static willChannelUpdate(numberOfCycles: i32): boolean {
    //Increment our cycle counter
    let cycleCounter = Channel2.cycleCounter + numberOfCycles;
    Channel2.cycleCounter = cycleCounter;

    // Dac enabled status cached by accumulator
    return !(Channel2.frequencyTimer - cycleCounter > 0);
  }

  static updateLength(): void {
    let lengthCounter = Channel2.lengthCounter;
    if (lengthCounter > 0 && Channel2.NRx4LengthEnabled) {
      lengthCounter -= 1;
    }

    if (lengthCounter === 0) {
      Channel2.isEnabled = false;
    }
    Channel2.lengthCounter = lengthCounter;
  }

  static updateEnvelope(): void {
    // Obscure behavior
    // TODO: The volume envelope and sweep timers treat a period of 0 as 8.
    let envelopeCounter = Channel2.envelopeCounter;
    envelopeCounter -= 1;
    if (envelopeCounter <= 0) {
      envelopeCounter = Channel2.NRx2EnvelopePeriod;

      // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
      // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
      if (envelopeCounter !== 0) {
        let volume = Channel2.volume;
        if (Channel2.NRx2EnvelopeAddMode && volume < 15) {
          volume += 1;
        } else if (!Channel2.NRx2EnvelopeAddMode && volume > 0) {
          volume -= 1;
        }
        Channel2.volume = volume;
      }
    }
    Channel2.envelopeCounter = envelopeCounter;
  }

  static setFrequency(frequency: i32): void {
    // Get the high and low bits
    let passedFrequencyHighBits = frequency >> 8;
    let passedFrequencyLowBits = frequency & 0xff;

    // Get the new register 4
    let register4 = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx4);
    // Knock off lower 3 bits, and Or on our high bits
    let newRegister4 = register4 & 0xf8;
    newRegister4 = newRegister4 | passedFrequencyHighBits;

    // Set the registers
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, passedFrequencyLowBits);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, newRegister4);

    // Save the frequency for ourselves without triggering memory traps
    Channel2.NRx3FrequencyLSB = passedFrequencyLowBits;
    Channel2.NRx4FrequencyMSB = passedFrequencyHighBits;
    Channel2.frequency = (passedFrequencyHighBits << 8) | passedFrequencyLowBits;
  }
  // Done!
}
