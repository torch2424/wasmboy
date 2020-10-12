// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Square Channel with Frequency Sweep
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Frequency_Sweep
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

export class Channel1 {
  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Max Length of our Length Load
  static MAX_LENGTH: i32 = 64;

  // Squarewave channel with volume envelope and frequency sweep functions.
  // NR10 -> Sweep Register R/W
  static readonly memoryLocationNRx0: i32 = 0xff10;
  // -PPP NSSS Sweep period, negate, shift
  static NRx0SweepPeriod: i32 = 0;
  static NRx0Negate: boolean = false;
  static NRx0SweepShift: i32 = 0;
  static updateNRx0(value: i32): void {
    let oldSweepNegate = Channel1.NRx0Negate;

    Channel1.NRx0SweepPeriod = (value & 0x70) >> 4;
    Channel1.NRx0Negate = checkBitOnByte(3, value);
    Channel1.NRx0SweepShift = value & 0x07;

    // Obscure Behavior
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
    // Clearing the sweep negate mode bit in NR10 after at least one sweep calculation has been made,
    // using the negate mode since the last trigger causes the channel to be immediately disabled.
    // This prevents you from having the sweep lower the frequency then raise the frequency without a trigger inbetween.
    if (oldSweepNegate && !Channel1.NRx0Negate && Channel1.sweepNegateShouldDisableChannelOnClear) {
      Channel1.isEnabled = false;
    }
  }

  // NR11 -> Sound length/Wave pattern duty (R/W)
  static readonly memoryLocationNRx1: i32 = 0xff11;
  // DDLL LLLL Duty, Length load (64-L)
  static NRx1Duty: i32 = 0;
  static NRx1LengthLoad: i32 = 0;
  static updateNRx1(value: i32): void {
    Channel1.NRx1Duty = (value >> 6) & 0x03;
    Channel1.NRx1LengthLoad = value & 0x3f;

    // Also need to set our length counter. Taken from the old, setChannelLengthCounter
    // Channel length is determined by 64 (or 256 if channel 3), - the length load
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
    // Note, this will be different for channel 3
    Channel1.lengthCounter = Channel1.MAX_LENGTH - Channel1.NRx1LengthLoad;
  }

  // NR12 -> Volume Envelope (R/W)
  static readonly memoryLocationNRx2: i32 = 0xff12;
  // VVVV APPP Starting volume, Envelope add mode, period
  static NRx2StartingVolume: i32 = 0;
  static NRx2EnvelopeAddMode: boolean = false;
  static NRx2EnvelopePeriod: i32 = 0;
  static updateNRx2(value: i32): void {
    // Handle "Zombie Mode" Obscure behavior
    // https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
    if (Channel1.isEnabled) {
      // If the old envelope period was zero and the envelope is still doing automatic updates,
      // volume is incremented by 1, otherwise if the envelope was in subtract mode,
      // volume is incremented by 2.
      // NOTE: However, from my testing, it ALWAYS increments by one. This was determined
      // by my testing for prehistoric man
      if (Channel1.NRx2EnvelopePeriod === 0 && Channel1.isEnvelopeAutomaticUpdating) {
        // Volume can't be more than 4 bits
        Channel1.volume = (Channel1.volume + 1) & 0x0f;
      }

      // If the mode was changed (add to subtract or subtract to add),
      // volume is set to 16-volume. But volume cant be more than 4 bits
      if (Channel1.NRx2EnvelopeAddMode !== checkBitOnByte(3, value)) {
        Channel1.volume = (16 - Channel1.volume) & 0x0f;
      }
    }

    // Handle the regular write
    Channel1.NRx2StartingVolume = (value >> 4) & 0x0f;
    Channel1.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
    Channel1.NRx2EnvelopePeriod = value & 0x07;

    // Also, get our channel is dac enabled
    let isDacEnabled = (value & 0xf8) > 0;
    Channel1.isDacEnabled = isDacEnabled;

    // Blargg length test
    // Disabling DAC should disable channel immediately
    if (!isDacEnabled) {
      Channel1.isEnabled = false;
    }
  }

  // NR13 -> Frequency lo (W)
  static readonly memoryLocationNRx3: i32 = 0xff13;
  // FFFF FFFF Frequency LSB
  static NRx3FrequencyLSB: i32 = 0;
  static updateNRx3(value: i32): void {
    Channel1.NRx3FrequencyLSB = value;

    // Update Channel Frequency
    Channel1.frequency = (Channel1.NRx4FrequencyMSB << 8) | value;
  }

  // NR14 -> Frequency hi (R/W)
  static readonly memoryLocationNRx4: i32 = 0xff14;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  static NRx4LengthEnabled: boolean = false;
  static NRx4FrequencyMSB: i32 = 0;
  // NOTE: Order in which these events happen are very particular
  // And globals can be affected by other functions
  // Thus, optimizations here should be extremely careful
  static updateNRx4(value: i32): void {
    // Handle our Channel frequency first
    // As this is modified if we trigger for length.
    let frequencyMSB = value & 0x07;
    Channel1.NRx4FrequencyMSB = frequencyMSB;
    Channel1.frequency = (frequencyMSB << 8) | Channel1.NRx3FrequencyLSB;

    // Obscure behavior
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
    // Also see blargg's cgb sound test
    // Extra length clocking occurs when writing to NRx4,
    // when the frame sequencer's next step is one that,
    // doesn't clock the length counter.
    let frameSequencer = Sound.frameSequencer;
    let doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
    let isBeingLengthEnabled = !Channel1.NRx4LengthEnabled && checkBitOnByte(6, value);
    if (!doesNextFrameSequencerUpdateLength) {
      // Check lengthEnable
      if (Channel1.lengthCounter > 0 && isBeingLengthEnabled) {
        Channel1.lengthCounter -= 1;

        if (!checkBitOnByte(7, value) && Channel1.lengthCounter === 0) {
          Channel1.isEnabled = false;
        }
      }
    }

    // Set the length enabled from the value
    Channel1.NRx4LengthEnabled = checkBitOnByte(6, value);

    // Trigger out channel, unfreeze length if frozen
    // Triggers should happen after obscure behavior
    // See test 11 for trigger
    if (checkBitOnByte(7, value)) {
      Channel1.trigger();

      // When we trigger on the obscure behavior, and we reset the length Counter to max
      // We need to clock
      if (!doesNextFrameSequencerUpdateLength && Channel1.lengthCounter === Channel1.MAX_LENGTH && Channel1.NRx4LengthEnabled) {
        Channel1.lengthCounter -= 1;
      }
    }
  }

  // Channel Properties
  static readonly channelNumber: i32 = 1;
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

  // Channel 1 Sweep
  static isSweepEnabled: boolean = false;
  static sweepCounter: i32 = 0x00;
  static sweepShadowFrequency: i32 = 0x00;
  static sweepNegateShouldDisableChannelOnClear: boolean = false;

  // Save States
  static readonly saveStateSlot: i32 = 7;

  // Function to save the state of the class
  static saveState(): void {
    // Cycle Counter
    store<i32>(getSaveStateMemoryOffset(0x00, Channel1.saveStateSlot), Channel1.cycleCounter);

    // NRx0
    store<u8>(getSaveStateMemoryOffset(0x04, Channel1.saveStateSlot), <u8>Channel1.NRx0SweepPeriod);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot), Channel1.NRx0Negate);
    store<u8>(getSaveStateMemoryOffset(0x06, Channel1.saveStateSlot), <u8>Channel1.NRx0SweepShift);

    // NRx1
    store<u8>(getSaveStateMemoryOffset(0x07, Channel1.saveStateSlot), <u8>Channel1.NRx1Duty);
    store<u16>(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot), <u16>Channel1.NRx1LengthLoad);

    // NRx2
    store<u8>(getSaveStateMemoryOffset(0x0a, Channel1.saveStateSlot), <u8>Channel1.NRx2StartingVolume);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Channel1.saveStateSlot), Channel1.NRx2EnvelopeAddMode);
    store<u8>(getSaveStateMemoryOffset(0x0c, Channel1.saveStateSlot), <u8>Channel1.NRx2EnvelopePeriod);

    // NRx3
    store<u8>(getSaveStateMemoryOffset(0x0d, Channel1.saveStateSlot), <u8>Channel1.NRx3FrequencyLSB);

    // NRx4
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0e, Channel1.saveStateSlot), Channel1.NRx4LengthEnabled);
    store<u8>(getSaveStateMemoryOffset(0x0f, Channel1.saveStateSlot), <u8>Channel1.NRx4FrequencyMSB);

    // Channel Properties
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel1.saveStateSlot), Channel1.isEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Channel1.saveStateSlot), Channel1.isDacEnabled);
    store<i32>(getSaveStateMemoryOffset(0x12, Channel1.saveStateSlot), Channel1.frequency);
    store<i32>(getSaveStateMemoryOffset(0x16, Channel1.saveStateSlot), Channel1.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x1a, Channel1.saveStateSlot), Channel1.envelopeCounter);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1e, Channel1.saveStateSlot), Channel1.isEnvelopeAutomaticUpdating);
    store<i32>(getSaveStateMemoryOffset(0x1f, Channel1.saveStateSlot), Channel1.lengthCounter);
    store<i32>(getSaveStateMemoryOffset(0x23, Channel1.saveStateSlot), Channel1.volume);

    // Square Duty
    store<u8>(getSaveStateMemoryOffset(0x27, Channel1.saveStateSlot), Channel1.dutyCycle);
    store<u8>(getSaveStateMemoryOffset(0x28, Channel1.saveStateSlot), <u8>Channel1.waveFormPositionOnDuty);

    // Square Sweep
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x29, Channel1.saveStateSlot), Channel1.isSweepEnabled);
    store<i32>(getSaveStateMemoryOffset(0x2a, Channel1.saveStateSlot), Channel1.sweepCounter);
    store<u16>(getSaveStateMemoryOffset(0x2e, Channel1.saveStateSlot), Channel1.sweepShadowFrequency);
    storeBooleanDirectlyToWasmMemory(
      getSaveStateMemoryOffset(0x31, Channel1.saveStateSlot),
      Channel1.sweepNegateShouldDisableChannelOnClear
    );
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Cycle Counter
    Channel1.cycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Channel1.cycleCounter));

    // NRx0
    Channel1.NRx0SweepPeriod = load<u8>(getSaveStateMemoryOffset(0x04, Channel1.saveStateSlot));
    Channel1.NRx0Negate = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot));
    Channel1.NRx0SweepShift = load<u8>(getSaveStateMemoryOffset(0x06, Channel1.saveStateSlot));

    // NRx1
    Channel1.NRx1Duty = load<u8>(getSaveStateMemoryOffset(0x07, Channel1.saveStateSlot));
    Channel1.NRx1LengthLoad = load<u16>(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot));

    // NRx2
    Channel1.NRx2StartingVolume = load<u8>(getSaveStateMemoryOffset(0x0a, Channel1.saveStateSlot));
    Channel1.NRx2EnvelopeAddMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Channel1.saveStateSlot));
    Channel1.NRx2EnvelopePeriod = load<u8>(getSaveStateMemoryOffset(0x0c, Channel1.saveStateSlot));

    // NRx3
    Channel1.NRx3FrequencyLSB = load<u8>(getSaveStateMemoryOffset(0x0d, Channel1.saveStateSlot));

    // NRx4
    Channel1.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0e, Channel1.saveStateSlot));
    Channel1.NRx4FrequencyMSB = load<u8>(getSaveStateMemoryOffset(0x0f, Channel1.saveStateSlot));

    // Channel Properties
    Channel1.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel1.saveStateSlot));
    Channel1.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Channel1.saveStateSlot));
    Channel1.frequency = load<i32>(getSaveStateMemoryOffset(0x12, Channel1.saveStateSlot));
    Channel1.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x16, Channel1.saveStateSlot));
    Channel1.envelopeCounter = load<i32>(getSaveStateMemoryOffset(0x1a, Channel1.saveStateSlot));
    Channel1.isEnvelopeAutomaticUpdating = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1e, Channel1.saveStateSlot));
    Channel1.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x1f, Channel1.saveStateSlot));
    Channel1.volume = load<i32>(getSaveStateMemoryOffset(0x23, Channel1.saveStateSlot));

    // Square Duty
    Channel1.dutyCycle = load<u8>(getSaveStateMemoryOffset(0x27, Channel1.saveStateSlot));
    Channel1.waveFormPositionOnDuty = load<u8>(getSaveStateMemoryOffset(0x28, Channel1.saveStateSlot));

    // Square Sweep
    Channel1.isSweepEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x29, Channel1.saveStateSlot));
    Channel1.sweepCounter = load<u8>(getSaveStateMemoryOffset(0x2a, Channel1.saveStateSlot));
    Channel1.sweepShadowFrequency = load<u8>(getSaveStateMemoryOffset(0x2e, Channel1.saveStateSlot));
    Channel1.sweepNegateShouldDisableChannelOnClear = loadBooleanDirectlyFromWasmMemory(
      getSaveStateMemoryOffset(0x31, Channel1.saveStateSlot)
    );
  }

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx0, 0x80);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx1, 0xbf);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx2, 0xf3);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, 0xc1);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, 0xbf);

    // Override/reset some variables if the boot ROM is enabled
    // For GBC and GB
    if (Cpu.BootROMEnabled) {
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx1, 0x3f);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx2, 0x00);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, 0x00);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, 0xb8);
    }
  }

  // Function to get a sample using the cycle counter on the channel
  static getSampleFromCycleCounter(): i32 {
    let accumulatedCycles = Channel1.cycleCounter;
    Channel1.cycleCounter = 0;
    return Channel1.getSample(accumulatedCycles);
  }

  // Function to reset our timer, useful for GBC double speed mode
  static resetTimer(): void {
    let frequencyTimer = (2048 - Channel1.frequency) << 2;

    // TODO: Ensure this is correct for GBC Double Speed Mode
    if (Cpu.GBCDoubleSpeed) {
      frequencyTimer = frequencyTimer << 2;
    }
    Channel1.frequencyTimer = frequencyTimer;
  }

  static getSample(numberOfCycles: i32): i32 {
    // Decrement our channel timer
    let frequencyTimer = Channel1.frequencyTimer;
    frequencyTimer -= numberOfCycles;
    while (frequencyTimer <= 0) {
      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount = abs(frequencyTimer);

      // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
      Channel1.resetTimer();
      frequencyTimer = Channel1.frequencyTimer;
      frequencyTimer -= overflowAmount;

      // Also increment our duty cycle
      // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
      // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
      Channel1.waveFormPositionOnDuty = (Channel1.waveFormPositionOnDuty + 1) & 7;
    }

    Channel1.frequencyTimer = frequencyTimer;

    // Get our ourput volume
    let outputVolume = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if (Channel1.isEnabled && Channel1.isDacEnabled) {
      // Volume can't be more than 4 bits.
      // Volume should never be more than 4 bits, but doing a check here
      outputVolume = Channel1.volume & 0x0f;
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Get the current sampleValue
    let sample = 1;
    if (!isDutyCycleClockPositiveOrNegativeForWaveform(Channel1.NRx1Duty, Channel1.waveFormPositionOnDuty)) {
      sample = -sample;
    }

    sample *= outputVolume;

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample += 15;
    return sample;
  }

  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel1.isEnabled = true;
    // Set length to maximum done in write
    if (Channel1.lengthCounter === 0) {
      Channel1.lengthCounter = Channel1.MAX_LENGTH;
    }

    // Reset our timer
    // A square channel's frequency timer period is set to (2048-frequency)*4.
    // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
    Channel1.resetTimer();

    // The volume envelope and sweep timers treat a period of 0 as 8.
    // Meaning, if the period is zero, set it to the max (8).
    if (Channel1.NRx2EnvelopePeriod === 0) {
      Channel1.envelopeCounter = 8;
    } else {
      Channel1.envelopeCounter = Channel1.NRx2EnvelopePeriod;
    }
    Channel1.isEnvelopeAutomaticUpdating = true;

    Channel1.volume = Channel1.NRx2StartingVolume;

    // Handle Channel Sweep
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
    Channel1.sweepShadowFrequency = Channel1.frequency;

    // Reset back to the sweep period
    // Obscure behavior
    // Sweep timers treat a period o 0 as 8
    if (Channel1.NRx0SweepPeriod === 0) {
      Channel1.sweepCounter = 8;
    } else {
      Channel1.sweepCounter = Channel1.NRx0SweepPeriod;
    }

    // The internal enabled flag is set if either the sweep period or shift are non-zero, cleared otherwise.
    Channel1.isSweepEnabled = Channel1.NRx0SweepPeriod > 0 || Channel1.NRx0SweepShift > 0;

    Channel1.sweepNegateShouldDisableChannelOnClear = false;

    // If the sweep shift is non-zero, frequency calculation and the overflow check are performed immediately.
    // NOTE: The double calculation thing for the sweep does not happen here.
    if (Channel1.NRx0SweepShift > 0 && didCalculatedSweepOverflow(calculateSweep())) {
      Channel1.isEnabled = false;
    }

    // Finally if DAC is off, channel is still disabled
    if (!Channel1.isDacEnabled) {
      Channel1.isEnabled = false;
    }
  }

  // Function to determine if the current channel would update when getting the sample
  // This is used to accumulate samples
  static willChannelUpdate(numberOfCycles: i32): boolean {
    //Increment our cycle counter
    let cycleCounter = Channel1.cycleCounter + numberOfCycles;
    Channel1.cycleCounter = cycleCounter;

    // Dac enabled status cached by accumulator
    return !(Channel1.frequencyTimer - cycleCounter > 0);
  }

  static updateSweep(): void {
    // Dont update period if not enabled
    if (!Channel1.isEnabled || !Channel1.isSweepEnabled) {
      return;
    }

    // Decrement the sweep counter
    let sweepCounter = Channel1.sweepCounter - 1;
    if (sweepCounter <= 0) {
      // Reset back to the sweep period
      // Obscure behavior
      // Sweep timers treat a period of 0 as 8 (They reset back to the max)
      if (Channel1.NRx0SweepPeriod === 0) {
        // Sweep isn't calculated when the period is 0
        Channel1.sweepCounter = 8;
      } else {
        // Reset our sweep counter to its period
        Channel1.sweepCounter = Channel1.NRx0SweepPeriod;

        // Calculate our sweep
        // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
        // When it generates a clock and the sweep's internal enabled flag is set and the sweep period is not zero,
        // a new frequency is calculated and the overflow check is performed. If the new frequency is 2047 or less,
        // and the sweep shift is not zero, this new frequency is written back to the shadow frequency,
        // and square 1's frequency in NR13 and NR14, then frequency calculation,
        // and overflow check are run AGAIN immediately using this new value,
        // but this second new frequency is not written back.
        let newFrequency = calculateSweep();
        if (didCalculatedSweepOverflow(newFrequency)) {
          Channel1.isEnabled = false;
        }

        if (Channel1.NRx0SweepShift > 0) {
          Channel1.setFrequency(newFrequency);

          if (didCalculatedSweepOverflow(calculateSweep())) {
            Channel1.isEnabled = false;
          }
        }
      }
    } else {
      Channel1.sweepCounter = sweepCounter;
    }
  }

  static updateLength(): void {
    let lengthCounter = Channel1.lengthCounter;
    if (lengthCounter > 0 && Channel1.NRx4LengthEnabled) {
      lengthCounter -= 1;

      if (lengthCounter === 0) {
        Channel1.isEnabled = false;
      }
    }
    Channel1.lengthCounter = lengthCounter;
  }

  static updateEnvelope(): void {
    let envelopeCounter = Channel1.envelopeCounter - 1;
    if (envelopeCounter <= 0) {
      // Reset back to the sweep period
      // Obscure behavior
      // Envelopes treat a period of 0 as 8 (They reset back to the max)
      if (Channel1.NRx2EnvelopePeriod === 0) {
        envelopeCounter = 8;
      } else {
        envelopeCounter = Channel1.NRx2EnvelopePeriod;

        // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
        // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
        // If notes are sustained for too long, this is probably why
        if (envelopeCounter !== 0 && Channel1.isEnvelopeAutomaticUpdating) {
          let volume = Channel1.volume;

          // Increment the volume
          if (Channel1.NRx2EnvelopeAddMode) {
            volume += 1;
          } else {
            volume -= 1;
          }

          // Don't allow the volume to go above 4 bits.
          volume = volume & 0x0f;

          // Check if we are below the max
          if (volume < 15) {
            Channel1.volume = volume;
          } else {
            Channel1.isEnvelopeAutomaticUpdating = false;
          }
        }
      }
    }
    Channel1.envelopeCounter = envelopeCounter;
  }

  static setFrequency(frequency: i32): void {
    // Set our shadowFrequency
    Channel1.sweepShadowFrequency = frequency;

    // Get the high and low bits
    let passedFrequencyHighBits = (frequency >> 8) & 0x07;
    let passedFrequencyLowBits = frequency & 0xff;

    // Get the new register 4
    let register4 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx4);
    // Knock off lower 3 bits, and Or on our high bits
    let newRegister4 = register4 & 0xf8;
    newRegister4 = newRegister4 | passedFrequencyHighBits;

    // Set the registers
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, passedFrequencyLowBits);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, newRegister4);

    // Save the frequency for ourselves without triggering memory traps
    Channel1.NRx3FrequencyLSB = passedFrequencyLowBits;
    Channel1.NRx4FrequencyMSB = passedFrequencyHighBits;
    Channel1.frequency = (Channel1.NRx4FrequencyMSB << 8) | Channel1.NRx3FrequencyLSB;
  }
  // Done!
}

// Sweep Specific functions
// Function to determing a new sweep in the current context
function calculateSweep(): i32 {
  // Start our new frequency, by making it equal to the "shadow frequency"
  let oldFrequency = Channel1.sweepShadowFrequency;
  let newFrequency = oldFrequency >> Channel1.NRx0SweepShift;

  // Check for sweep negation
  if (Channel1.NRx0Negate) {
    Channel1.sweepNegateShouldDisableChannelOnClear = true;
    newFrequency = oldFrequency - newFrequency;
  } else {
    newFrequency = oldFrequency + newFrequency;
  }

  return newFrequency;
}

// Function to check if a calculated sweep overflowed
function didCalculatedSweepOverflow(calculatedSweep: i32): boolean {
  // 7FF is the highest value of the frequency: 111 1111 1111
  // if it overflows, should disable the channel (handled by the caller)
  if (calculatedSweep > 0x7ff) {
    return true;
  }

  return false;
}
