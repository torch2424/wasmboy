// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Noise Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel
import { getSaveStateMemoryOffset } from '../core';
import { Sound } from './sound';
import { Cpu } from '../cpu/index';
import { eightBitStoreIntoGBMemory, loadBooleanDirectlyFromWasmMemory, storeBooleanDirectlyToWasmMemory } from '../memory/index';
import { checkBitOnByte } from '../helpers/index';

export class Channel4 {
  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Max Length of our Length Load
  static MAX_LENGTH: i32 = 64;

  // Channel 4
  // 'white noise' channel with volume envelope functions.

  // Only used by register reading
  static readonly memoryLocationNRx0: i32 = 0xff1f;

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
    Channel4.lengthCounter = Channel4.MAX_LENGTH - Channel4.NRx1LengthLoad;
  }

  // NR42 -> Volume Envelope (R/W)
  static readonly memoryLocationNRx2: i32 = 0xff21;
  // VVVV APPP Starting volume, Envelope add mode, period
  static NRx2StartingVolume: i32 = 0;
  static NRx2EnvelopeAddMode: boolean = false;
  static NRx2EnvelopePeriod: i32 = 0;
  static updateNRx2(value: i32): void {
    // Handle "Zombie Mode" Obscure behavior
    // https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
    if (Channel4.isEnabled) {
      // If the old envelope period was zero and the envelope is still doing automatic updates,
      // volume is incremented by 1, otherwise if the envelope was in subtract mode,
      // volume is incremented by 2.
      // NOTE: However, from my testing, it ALWAYS increments by one. This was determined
      // by my testing for prehistoric man
      if (Channel4.NRx2EnvelopePeriod === 0 && Channel4.isEnvelopeAutomaticUpdating) {
        // Volume can't be more than 4 bits
        Channel4.volume = (Channel4.volume + 1) & 0x0f;
      }

      // If the mode was changed (add to subtract or subtract to add),
      // volume is set to 16-volume. But volume cant be more than 4 bits
      if (Channel4.NRx2EnvelopeAddMode !== checkBitOnByte(3, value)) {
        Channel4.volume = (16 - Channel4.volume) & 0x0f;
      }
    }

    Channel4.NRx2StartingVolume = (value >> 4) & 0x0f;
    Channel4.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
    Channel4.NRx2EnvelopePeriod = value & 0x07;

    // Also, get our channel is dac enabled
    let isDacEnabled = (value & 0xf8) > 0;
    Channel4.isDacEnabled = isDacEnabled;

    // Blargg length test
    // Disabling DAC should disable channel immediately
    if (!isDacEnabled) {
      Channel4.isEnabled = isDacEnabled;
    }
  }

  // NR43 -> Polynomial Counter (R/W)
  static readonly memoryLocationNRx3: i32 = 0xff22;
  // SSSS WDDD Clock shift, Width mode of LFSR, Divisor code
  static NRx3ClockShift: i32 = 0;
  static NRx3WidthMode: boolean = false;
  static NRx3DivisorCode: i32 = 0;
  static updateNRx3(value: i32): void {
    let divisorCode = value & 0x07;
    Channel4.NRx3ClockShift = value >> 4;
    Channel4.NRx3WidthMode = checkBitOnByte(3, value);
    Channel4.NRx3DivisorCode = divisorCode;
    // Also, get our divisor
    divisorCode <<= 1;
    if (divisorCode < 1) divisorCode = 1;
    Channel4.divisor = divisorCode << 3;
  }

  // NR44 -> Trigger, Length Enable
  static readonly memoryLocationNRx4: i32 = 0xff23;
  // TL-- ---- Trigger, Length enable
  static NRx4LengthEnabled: boolean = false;
  static updateNRx4(value: i32): void {
    // Obscure behavior
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
    // Also see blargg's cgb sound test
    // Extra length clocking occurs when writing to NRx4,
    // when the frame sequencer's next step is one that,
    // doesn't clock the length counter.
    let frameSequencer = Sound.frameSequencer;
    let doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
    let isBeingLengthEnabled = !Channel4.NRx4LengthEnabled && checkBitOnByte(6, value);
    if (!doesNextFrameSequencerUpdateLength) {
      if (Channel4.lengthCounter > 0 && isBeingLengthEnabled) {
        Channel4.lengthCounter -= 1;

        if (!checkBitOnByte(7, value) && Channel4.lengthCounter === 0) {
          Channel4.isEnabled = false;
        }
      }
    }

    // Set the length enabled from the value
    Channel4.NRx4LengthEnabled = checkBitOnByte(6, value);

    // Trigger out channel, unfreeze length if frozen
    // Triggers should happen after obscure behavior
    // See test 11 for trigger
    if (checkBitOnByte(7, value)) {
      Channel4.trigger();

      // When we trigger on the obscure behavior, and we reset the length Counter to max
      // We need to clock
      if (!doesNextFrameSequencerUpdateLength && Channel4.lengthCounter === Channel4.MAX_LENGTH && Channel4.NRx4LengthEnabled) {
        Channel4.lengthCounter -= 1;
      }
    }
  }

  // Channel Properties
  static readonly channelNumber: i32 = 4;
  static isEnabled: boolean = false;
  static isDacEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static isEnvelopeAutomaticUpdating: boolean = false;
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
    // Cycle Counter
    store<i32>(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot), Channel4.cycleCounter);

    // NRx0
    // No NRx0 Properties

    // NRx1
    store<u16>(getSaveStateMemoryOffset(0x04, Channel4.saveStateSlot), <u16>Channel4.NRx1LengthLoad);

    // NRx2
    store<u8>(getSaveStateMemoryOffset(0x06, Channel4.saveStateSlot), <u8>Channel4.NRx2StartingVolume);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x07, Channel4.saveStateSlot), Channel4.NRx2EnvelopeAddMode);
    store<u8>(getSaveStateMemoryOffset(0x08, Channel4.saveStateSlot), <u8>Channel4.NRx2EnvelopePeriod);

    // NRx3
    store<u8>(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot), <u8>Channel4.NRx3ClockShift);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0a, Channel4.saveStateSlot), Channel4.NRx3WidthMode);
    store<u8>(getSaveStateMemoryOffset(0x0b, Channel4.saveStateSlot), <u8>Channel4.NRx3DivisorCode);

    // NRx4
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Channel4.saveStateSlot), Channel4.NRx4LengthEnabled);

    // Channel Properties
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Channel4.saveStateSlot), Channel4.isEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel4.saveStateSlot), Channel4.isDacEnabled);
    store<i32>(getSaveStateMemoryOffset(0x15, Channel4.saveStateSlot), Channel4.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x19, Channel4.saveStateSlot), Channel4.envelopeCounter);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1d, Channel4.saveStateSlot), Channel4.isEnvelopeAutomaticUpdating);
    store<i32>(getSaveStateMemoryOffset(0x1e, Channel4.saveStateSlot), Channel4.lengthCounter);
    store<i32>(getSaveStateMemoryOffset(0x22, Channel4.saveStateSlot), Channel4.volume);

    // LSFR
    store<u16>(getSaveStateMemoryOffset(0x26, Channel4.saveStateSlot), <u16>Channel4.linearFeedbackShiftRegister);
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Cycle Counter
    Channel4.cycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Channel4.cycleCounter));

    // NRx0
    // No NRx0

    // NRx1
    Channel4.NRx1LengthLoad = load<u8>(getSaveStateMemoryOffset(0x04, Channel4.saveStateSlot));

    // NRx2
    Channel4.NRx2StartingVolume = load<u8>(getSaveStateMemoryOffset(0x06, Channel4.saveStateSlot));
    Channel4.NRx2EnvelopeAddMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x07, Channel4.saveStateSlot));
    Channel4.NRx2EnvelopePeriod = load<u8>(getSaveStateMemoryOffset(0x08, Channel4.saveStateSlot));

    // NRx3
    Channel4.NRx3ClockShift = load<u8>(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot));
    Channel4.NRx3WidthMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0a, Channel4.saveStateSlot));
    Channel4.NRx3DivisorCode = load<u8>(getSaveStateMemoryOffset(0x0b, Channel4.saveStateSlot));

    // NRx4
    Channel4.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Channel4.saveStateSlot));

    // Channel Properties
    Channel4.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Channel4.saveStateSlot));
    Channel4.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel4.saveStateSlot));
    Channel4.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x15, Channel4.saveStateSlot));
    Channel4.envelopeCounter = load<i32>(getSaveStateMemoryOffset(0x19, Channel4.saveStateSlot));
    Channel4.isEnvelopeAutomaticUpdating = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1d, Channel4.saveStateSlot));
    Channel4.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x1e, Channel4.saveStateSlot));
    Channel4.volume = load<i32>(getSaveStateMemoryOffset(0x22, Channel4.saveStateSlot));

    // LSFR
    Channel4.linearFeedbackShiftRegister = load<u16>(getSaveStateMemoryOffset(0x26, Channel4.saveStateSlot));
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
    let accumulatedCycles = Channel4.cycleCounter;
    Channel4.cycleCounter = 0;
    return Channel4.getSample(accumulatedCycles);
  }

  static getSample(numberOfCycles: i32): i32 {
    // Decrement our channel timer
    let frequencyTimer = Channel4.frequencyTimer;
    frequencyTimer -= numberOfCycles;

    // TODO: This can't be a while loop to use up all the cycles,
    // Since noise is psuedo random and the period can be anything
    if (frequencyTimer <= 0) {
      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount = abs(frequencyTimer);

      // Reset our timer
      frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();
      frequencyTimer -= overflowAmount;

      // Do some cool stuff with lfsr
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel

      // First XOR bit zero and one
      let linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister;
      let lfsrBitZero = linearFeedbackShiftRegister & 0x01;
      let lfsrBitOne = linearFeedbackShiftRegister >> 1;
      lfsrBitOne = lfsrBitOne & 0x01;
      let xorLfsrBitZeroOne = lfsrBitZero ^ lfsrBitOne;

      // Shift all lsfr bits by one
      linearFeedbackShiftRegister = linearFeedbackShiftRegister >> 1;

      // Place the XOR result on bit 15
      linearFeedbackShiftRegister = linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 14);

      // If the width mode is set, set xor on bit 6, and make lfsr 7 bit
      if (Channel4.NRx3WidthMode) {
        // Make 7 bit, by knocking off lower bits. Want to keeps bits 8 - 16, and then or on 7
        linearFeedbackShiftRegister = linearFeedbackShiftRegister & ~0x40;
        linearFeedbackShiftRegister = linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 6);
      }
      Channel4.linearFeedbackShiftRegister = linearFeedbackShiftRegister;
    }

    // Make sure period never becomes negative
    if (frequencyTimer < 0) {
      frequencyTimer = 0;
    }

    Channel4.frequencyTimer = frequencyTimer;

    // Get our ourput volume, set to zero for silence
    let outputVolume = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if (Channel4.isEnabled && Channel4.isDacEnabled) {
      // Volume can't be more than 4 bits.
      // Volume should never be more than 4 bits, but doing a check here
      outputVolume = Channel4.volume & 0x0f;
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Declare our sample
    let sample = 0;

    // Wave form output is bit zero of lfsr, INVERTED
    sample = !checkBitOnByte(0, Channel4.linearFeedbackShiftRegister) ? 1 : -1;
    sample = sample * outputVolume;

    // Noise Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return <i32>sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel4.isEnabled = true;
    // Length counter maximum handled by write
    if (Channel4.lengthCounter === 0) {
      Channel4.lengthCounter = Channel4.MAX_LENGTH;
    }

    // Reset our timers
    Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();

    // The volume envelope and sweep timers treat a period of 0 as 8.
    // Meaning, if the period is zero, set it to the max (8).
    if (Channel4.NRx2EnvelopePeriod === 0) {
      Channel4.envelopeCounter = 8;
    } else {
      Channel4.envelopeCounter = Channel4.NRx2EnvelopePeriod;
    }
    Channel4.isEnvelopeAutomaticUpdating = true;

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
    return !(Channel4.frequencyTimer - Channel4.cycleCounter > 0);
  }

  static getNoiseChannelFrequencyPeriod(): i32 {
    // Get our divisor from the divisor code, and shift by the clock shift
    let response = Channel4.divisor << Channel4.NRx3ClockShift;
    return response << (<i32>Cpu.GBCDoubleSpeed);
  }

  static updateLength(): void {
    let lengthCounter = Channel4.lengthCounter;
    if (lengthCounter > 0 && Channel4.NRx4LengthEnabled) {
      lengthCounter -= 1;
    }

    if (lengthCounter === 0) {
      Channel4.isEnabled = false;
    }
    Channel4.lengthCounter = lengthCounter;
  }

  static updateEnvelope(): void {
    let envelopeCounter = Channel4.envelopeCounter - 1;
    if (envelopeCounter <= 0) {
      // Reset back to the sweep period
      // Obscure behavior
      // Envelopes treat a period of 0 as 8 (They reset back to the max)
      if (Channel4.NRx2EnvelopePeriod === 0) {
        envelopeCounter = 8;
      } else {
        envelopeCounter = Channel4.NRx2EnvelopePeriod;

        // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
        // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
        if (envelopeCounter !== 0 && Channel4.isEnvelopeAutomaticUpdating) {
          let volume = Channel4.volume;

          // Increment the volume
          if (Channel4.NRx2EnvelopeAddMode) {
            volume += 1;
          } else {
            volume -= 1;
          }

          // Don't allow the volume to go above 4 bits.
          volume = volume & 0x0f;

          // Check if we are below the max
          if (volume < 15) {
            Channel4.volume = volume;
          } else {
            Channel4.isEnvelopeAutomaticUpdating = false;
          }
        }
      }
    }
    Channel4.envelopeCounter = envelopeCounter;
  }
  // Done!
}
