// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Simple Square Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
import { getSaveStateMemoryOffset } from '../core';
import { Sound } from './sound';
import { isDutyCycleClockPositiveOrNegativeForWaveform } from './duty';
import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { checkBitOnByte, log, logTimeout } from '../helpers/index';

export class Channel2 {
  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Max Length of our Length Load
  static MAX_LENGTH: i32 = 64;

  // Squarewave channel with volume envelope functions only.

  // Only used by register reading
  static readonly memoryLocationNRx0: i32 = 0xff15;

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
    Channel2.lengthCounter = Channel2.MAX_LENGTH - Channel2.NRx1LengthLoad;
  }

  // NR22 -> Volume Envelope (R/W)
  static readonly memoryLocationNRx2: i32 = 0xff17;
  // VVVV APPP Starting volume, Envelope add mode, period
  static NRx2StartingVolume: i32 = 0;
  static NRx2EnvelopeAddMode: boolean = false;
  static NRx2EnvelopePeriod: i32 = 0;
  static updateNRx2(value: i32): void {
    // Handle "Zombie Mode" Obscure behavior
    // https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
    if (Channel2.isEnabled) {
      // If the old envelope period was zero and the envelope is still doing automatic updates,
      // volume is incremented by 1, otherwise if the envelope was in subtract mode,
      // volume is incremented by 2.
      // NOTE: However, from my testing, it ALWAYS increments by one. This was determined
      // by my testing for prehistoric man
      if (Channel2.NRx2EnvelopePeriod === 0 && Channel2.isEnvelopeAutomaticUpdating) {
        // Volume can't be more than 4 bits
        Channel2.volume = (Channel2.volume + 1) & 0x0f;
      }

      // If the mode was changed (add to subtract or subtract to add),
      // volume is set to 16-volume. But volume cant be more than 4 bits
      if (Channel2.NRx2EnvelopeAddMode !== checkBitOnByte(3, value)) {
        Channel2.volume = (16 - Channel2.volume) & 0x0f;
      }
    }

    Channel2.NRx2StartingVolume = (value >> 4) & 0x0f;
    Channel2.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
    Channel2.NRx2EnvelopePeriod = value & 0x07;

    // Also, get our channel is dac enabled
    let isDacEnabled = (value & 0xf8) > 0;
    Channel2.isDacEnabled = isDacEnabled;

    // Blargg length test
    // Disabling DAC should disable channel immediately
    if (!isDacEnabled) {
      Channel2.isEnabled = isDacEnabled;
    }
  }

  // NR23 -> Frequency lo (W)
  static readonly memoryLocationNRx3: i32 = 0xff18;
  // FFFF FFFF Frequency LSB
  static NRx3FrequencyLSB: i32 = 0;
  static updateNRx3(value: i32): void {
    Channel2.NRx3FrequencyLSB = value;

    // Update Channel Frequency
    Channel2.frequency = (Channel2.NRx4FrequencyMSB << 8) | value;
  }

  // NR24 -> Frequency hi (R/W)
  static readonly memoryLocationNRx4: i32 = 0xff19;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  static NRx4LengthEnabled: boolean = false;
  static NRx4FrequencyMSB: i32 = 0;
  static updateNRx4(value: i32): void {
    // Handle our Channel frequency first
    // As this is modified if we trigger for length.
    let frequencyMSB = value & 0x07;
    Channel2.NRx4FrequencyMSB = frequencyMSB;
    Channel2.frequency = (frequencyMSB << 8) | Channel2.NRx3FrequencyLSB;

    // Obscure behavior
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
    // Also see blargg's cgb sound test
    // Extra length clocking occurs when writing to NRx4,
    // when the frame sequencer's next step is one that,
    // doesn't clock the length counter.
    let frameSequencer = Sound.frameSequencer;
    let doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
    let isBeingLengthEnabled = !Channel2.NRx4LengthEnabled && checkBitOnByte(6, value);
    if (!doesNextFrameSequencerUpdateLength) {
      if (Channel2.lengthCounter > 0 && isBeingLengthEnabled) {
        Channel2.lengthCounter -= 1;

        if (!checkBitOnByte(7, value) && Channel2.lengthCounter === 0) {
          Channel2.isEnabled = false;
        }
      }
    }

    // Set the length enabled from the value
    Channel2.NRx4LengthEnabled = checkBitOnByte(6, value);

    // Trigger out channel, unfreeze length if frozen
    // Triggers should happen after obscure behavior
    // See test 11 for trigger
    if (checkBitOnByte(7, value)) {
      Channel2.trigger();

      // When we trigger on the obscure behavior, and we reset the length Counter to max
      // We need to clock
      if (!doesNextFrameSequencerUpdateLength && Channel2.lengthCounter === Channel2.MAX_LENGTH && Channel2.NRx4LengthEnabled) {
        Channel2.lengthCounter -= 1;
      }
    }
  }

  // Channel Properties
  static readonly channelNumber: i32 = 2;
  static isEnabled: boolean = false;
  static isDacEnabled: boolean = false;
  static frequency: i32 = 0;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static isEnvelopeAutomaticUpdating: boolean = false;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  // Square Wave properties
  static dutyCycle: i32 = 0x00;
  static waveFormPositionOnDuty: i32 = 0x00;

  // Save States

  static readonly saveStateSlot: i32 = 8;

  // Function to save the state of the class
  static saveState(): void {
    // Cycle Counter
    store<i32>(getSaveStateMemoryOffset(0x00, Channel2.saveStateSlot), Channel2.cycleCounter);

    // NRx0
    // No NRx0 Properties

    // NRx1
    store<u8>(getSaveStateMemoryOffset(0x07, Channel2.saveStateSlot), <u8>Channel2.NRx1Duty);
    store<u16>(getSaveStateMemoryOffset(0x08, Channel2.saveStateSlot), <u16>Channel2.NRx1LengthLoad);

    // NRx2
    store<u8>(getSaveStateMemoryOffset(0x0a, Channel2.saveStateSlot), <u8>Channel2.NRx2StartingVolume);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Channel2.saveStateSlot), Channel2.NRx2EnvelopeAddMode);
    store<u8>(getSaveStateMemoryOffset(0x0c, Channel2.saveStateSlot), <u8>Channel2.NRx2EnvelopePeriod);

    // NRx3
    store<u8>(getSaveStateMemoryOffset(0x0d, Channel2.saveStateSlot), <u8>Channel2.NRx3FrequencyLSB);

    // NRx4
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot), Channel2.NRx4LengthEnabled);
    store<u8>(getSaveStateMemoryOffset(0x0f, Channel2.saveStateSlot), <u8>Channel2.NRx4FrequencyMSB);

    // Channel Properties
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel2.saveStateSlot), Channel2.isEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Channel2.saveStateSlot), Channel2.isDacEnabled);
    store<i32>(getSaveStateMemoryOffset(0x12, Channel2.saveStateSlot), Channel2.frequency);
    store<i32>(getSaveStateMemoryOffset(0x16, Channel2.saveStateSlot), Channel2.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x1a, Channel2.saveStateSlot), Channel2.envelopeCounter);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1e, Channel2.saveStateSlot), Channel2.isEnvelopeAutomaticUpdating);
    store<i32>(getSaveStateMemoryOffset(0x1f, Channel2.saveStateSlot), Channel2.lengthCounter);
    store<i32>(getSaveStateMemoryOffset(0x23, Channel2.saveStateSlot), Channel2.volume);

    // Square Duty
    store<u8>(getSaveStateMemoryOffset(0x27, Channel2.saveStateSlot), Channel2.dutyCycle);
    store<u8>(getSaveStateMemoryOffset(0x28, Channel2.saveStateSlot), <u8>Channel2.waveFormPositionOnDuty);
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Cycle Counter
    Channel2.cycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Channel2.cycleCounter));

    // NRx0
    // No NRx0

    // NRx1
    Channel2.NRx1Duty = load<u8>(getSaveStateMemoryOffset(0x07, Channel2.saveStateSlot));
    Channel2.NRx1LengthLoad = load<u16>(getSaveStateMemoryOffset(0x08, Channel2.saveStateSlot));

    // NRx2
    Channel2.NRx2StartingVolume = load<u8>(getSaveStateMemoryOffset(0xa, Channel2.saveStateSlot));
    Channel2.NRx2EnvelopeAddMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Channel2.saveStateSlot));
    Channel2.NRx2EnvelopePeriod = load<u8>(getSaveStateMemoryOffset(0x0c, Channel2.saveStateSlot));

    // NRx3
    Channel2.NRx3FrequencyLSB = load<u8>(getSaveStateMemoryOffset(0x0d, Channel2.saveStateSlot));

    // NRx4
    Channel2.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot));
    Channel2.NRx4FrequencyMSB = load<u8>(getSaveStateMemoryOffset(0x0f, Channel2.saveStateSlot));

    // Channel Properties
    Channel2.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel2.saveStateSlot));
    Channel2.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Channel2.saveStateSlot));
    Channel2.frequency = load<i32>(getSaveStateMemoryOffset(0x12, Channel2.saveStateSlot));
    Channel2.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x16, Channel2.saveStateSlot));
    Channel2.envelopeCounter = load<i32>(getSaveStateMemoryOffset(0x1a, Channel2.saveStateSlot));
    Channel2.isEnvelopeAutomaticUpdating = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1e, Channel2.saveStateSlot));
    Channel2.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x1f, Channel2.saveStateSlot));
    Channel2.volume = load<i32>(getSaveStateMemoryOffset(0x23, Channel2.saveStateSlot));

    // Square Duty
    Channel2.dutyCycle = load<u8>(getSaveStateMemoryOffset(0x27, Channel2.saveStateSlot));
    Channel2.waveFormPositionOnDuty = load<u8>(getSaveStateMemoryOffset(0x28, Channel2.saveStateSlot));
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
    let frequencyTimer = Channel2.frequencyTimer;
    frequencyTimer -= numberOfCycles;
    while (frequencyTimer <= 0) {
      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount = abs(frequencyTimer);

      // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
      Channel2.resetTimer();
      frequencyTimer = Channel2.frequencyTimer;
      frequencyTimer -= overflowAmount;

      // Also increment our duty cycle
      // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
      // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
      Channel2.waveFormPositionOnDuty = (Channel2.waveFormPositionOnDuty + 1) & 7;
    }

    Channel2.frequencyTimer = frequencyTimer;

    // Get our ourput volume
    let outputVolume = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if (Channel2.isEnabled && Channel2.isDacEnabled) {
      // Volume can't be more than 4 bits.
      // Volume should never be more than 4 bits, but doing a check here
      outputVolume = Channel2.volume & 0x0f;
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
    sample += 15;
    return sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel2.isEnabled = true;
    // Set length to maximum done in write
    if (Channel2.lengthCounter === 0) {
      Channel2.lengthCounter = Channel2.MAX_LENGTH;
    }

    // Reset our timer
    // A square channel's frequency timer period is set to (2048-frequency)*4.
    // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
    Channel2.resetTimer();

    // The volume envelope and sweep timers treat a period of 0 as 8.
    // Meaning, if the period is zero, set it to the max (8).
    if (Channel2.NRx2EnvelopePeriod === 0) {
      Channel2.envelopeCounter = 8;
    } else {
      Channel2.envelopeCounter = Channel2.NRx2EnvelopePeriod;
    }
    Channel2.isEnvelopeAutomaticUpdating = true;

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
    let envelopeCounter = Channel2.envelopeCounter - 1;
    if (envelopeCounter <= 0) {
      // Reset back to the sweep period
      // Obscure behavior
      // Envelopes treat a period of 0 as 8 (They reset back to the max)
      if (Channel2.NRx2EnvelopePeriod === 0) {
        envelopeCounter = 8;
      } else {
        envelopeCounter = Channel2.NRx2EnvelopePeriod;

        // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
        // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
        if (envelopeCounter !== 0 && Channel2.isEnvelopeAutomaticUpdating) {
          let volume = Channel2.volume;

          // Increment the volume
          if (Channel2.NRx2EnvelopeAddMode) {
            volume += 1;
          } else {
            volume -= 1;
          }

          // Don't allow the volume to go above 4 bits.
          volume = volume & 0x0f;

          // Check if we are below the max
          if (volume < 15) {
            Channel2.volume = volume;
          } else {
            Channel2.isEnvelopeAutomaticUpdating = false;
          }
        }
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
