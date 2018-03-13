// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Square Channel with Frequency Sweep
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Frequency_Sweep

import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import {
  getChannelStartingVolume,
  isChannelDacEnabled
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

export class Channel1 {

  // Squarewave channel with volume envelope and frequency sweep functions.
  // NR10 -> Sweep Register R/W
  static readonly memoryLocationNRx0: u16 = 0xFF10;
  // NR11 -> Sound length/Wave pattern duty (R/W)
  static readonly memoryLocationNRx1: u16 = 0xFF11;
  // NR12 -> Volume Envelope (R/W)
  static readonly memoryLocationNRx2: u16 = 0xFF12;
  // NR13 -> Frequency lo (W)
  static readonly memoryLocationNRx3: u16 = 0xFF13;
  // NR14 -> Frequency hi (R/W)
  static readonly memoryLocationNRx4: u16 = 0xFF14;

  // Channel Properties
  static readonly channelNumber: i32 = 1;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  // Square Wave properties
  static dutyCycle: u8 = 0x00;
  static waveFormPositionOnDuty: u8 = 0x00;

  // Channel 1 Sweep
  static isSweepEnabled: boolean = false;
  static sweepCounter: i32 = 0x00;
  static sweepShadowFrequency: u16 = 0x00;

  // Save States

  static readonly saveStateSlot: u16 = 7;

  // Function to save the state of the class
  static saveState(): void {
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel1.saveStateSlot), Channel1.isEnabled);
    store<i32>(getSaveStateMemoryOffset(0x01, Channel1.saveStateSlot), Channel1.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot), Channel1.envelopeCounter);
    store<i32>(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot), Channel1.lengthCounter);
    store<i32>(getSaveStateMemoryOffset(0x0E, Channel1.saveStateSlot), Channel1.volume);

    store<u8>(getSaveStateMemoryOffset(0x13, Channel1.saveStateSlot), Channel1.dutyCycle);
    store<u8>(getSaveStateMemoryOffset(0x14, Channel1.saveStateSlot), Channel1.waveFormPositionOnDuty);

    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x19, Channel1.saveStateSlot), Channel1.isSweepEnabled);
    store<i32>(getSaveStateMemoryOffset(0x1A, Channel1.saveStateSlot), Channel1.sweepCounter);
    store<u16>(getSaveStateMemoryOffset(0x1F, Channel1.saveStateSlot), Channel1.sweepShadowFrequency);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Channel1.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel1.saveStateSlot));
    Channel1.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x01, Channel1.saveStateSlot));
    Channel1.envelopeCounter = load<i32>(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot));
    Channel1.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot));
    Channel1.volume = load<i32>(getSaveStateMemoryOffset(0x0E, Channel1.saveStateSlot));

    Channel1.dutyCycle = load<u8>(getSaveStateMemoryOffset(0x13, Channel1.saveStateSlot));
    Channel1.waveFormPositionOnDuty = load<u8>(getSaveStateMemoryOffset(0x14, Channel1.saveStateSlot));

    Channel1.isSweepEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x19, Channel1.saveStateSlot));
    Channel1.sweepCounter = load<i32>(getSaveStateMemoryOffset(0x1A, Channel1.saveStateSlot));
    Channel1.sweepShadowFrequency = load<u16>(getSaveStateMemoryOffset(0x1F, Channel1.saveStateSlot));
  }


  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx0, 0x80);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx1, 0xBF);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx2, 0xF3);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, 0xFF);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, 0xBF);
  }

  static getSample(numberOfCycles: u8): i32 {

    // Decrement our channel timer
    Channel1.frequencyTimer -= <i32>numberOfCycles;
    if(Channel1.frequencyTimer <= 0) {

      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount: i32 = abs(Channel1.frequencyTimer);

      // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
      Channel1.frequencyTimer = (2048 - getChannelFrequency(Channel1.channelNumber)) * 4;
      Channel1.frequencyTimer -= overflowAmount;

      // Also increment our duty cycle
      // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
      // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
      Channel1.waveFormPositionOnDuty += 1;
      if (Channel1.waveFormPositionOnDuty >= 8) {
        Channel1.waveFormPositionOnDuty = 0;
      }
    }

    // Get our ourput volume
    let outputVolume: i32 = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if(Channel1.isEnabled &&
    isChannelDacEnabled(Channel1.channelNumber)) {
      outputVolume = Channel1.volume;
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Get the current sampleValue
    let sample: i32 = 1;
    if (!isDutyCycleClockPositiveOrNegativeForWaveform(1, Channel1.waveFormPositionOnDuty)) {
      sample = sample * -1;
    }

    sample = sample * outputVolume;

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return <i32>sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel1.isEnabled = true;
    if(Channel1.lengthCounter === 0) {
      Channel1.lengthCounter = 64;
    }

    // Reset our timer
    // A square channel's frequency timer period is set to (2048-frequency)*4.
    // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
    Channel1.frequencyTimer = (2048 - getChannelFrequency(Channel1.channelNumber)) * 4;

    Channel1.envelopeCounter = getChannelEnvelopePeriod(Channel1.channelNumber);

    Channel1.volume = getChannelStartingVolume(Channel1.channelNumber);

    // Handle Channel Sweep
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
    Channel1.sweepShadowFrequency = getChannelFrequency(Channel1.channelNumber);

    // Reset back to the sweep period
    Channel1.sweepCounter = getSweepPeriod();

    // The internal enabled flag is set if either the sweep period or shift are non-zero, cleared otherwise.
    if(getSweepPeriod() > 0 && getSweepShift() > 0) {
      Channel1.isSweepEnabled = true;
    } else {
      Channel1.isSweepEnabled = false;
    }

    // If the sweep shift is non-zero, frequency calculation and the overflow check are performed immediately.
    if(getSweepShift() > 0) {
        calculateSweepAndCheckOverflow();
    }

    // Finally if DAC is off, channel is still disabled
    if(!isChannelDacEnabled(Channel1.channelNumber)) {
      Channel1.isEnabled = false;
    }
  }

  static updateSweep(): void {
    // Obscure behavior
    // TODO: The volume envelope and sweep timers treat a period of 0 as 8.
    // Decrement the sweep counter
    Channel1.sweepCounter -= 1;

    if (Channel1.sweepCounter <= 0) {

      // Reset back to the sweep period
      Channel1.sweepCounter = getSweepPeriod();

      // Calculate our sweep
      // When it generates a clock and the sweep's internal enabled flag is set and the sweep period is not zero,
      // a new frequency is calculated and the overflow check is performed.
      if(Channel1.isSweepEnabled && getSweepPeriod() > 0) {
        calculateSweepAndCheckOverflow();
      }
    }
  }

  static updateLength(): void {

    if(Channel1.lengthCounter > 0 && isChannelLengthEnabled(Channel1.channelNumber)) {
      Channel1.lengthCounter -= 1;
    }

    if(Channel1.lengthCounter === 0) {
      Channel1.isEnabled = false;
    }
  }

  static updateEnvelope(): void {

    // Obscure behavior
    // TODO: The volume envelope and sweep timers treat a period of 0 as 8.

    Channel1.envelopeCounter -= 1;
    if (Channel1.envelopeCounter <= 0) {
      Channel1.envelopeCounter = getChannelEnvelopePeriod(Channel1.channelNumber);

      // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
      // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
      // If notes are sustained for too long, this is probably why
      if(Channel1.envelopeCounter !== 0) {
        if(getChannelEnvelopeAddMode(Channel1.channelNumber) && Channel1.volume < 15) {
          Channel1.volume += 1;
        } else if (!getChannelEnvelopeAddMode(Channel1.channelNumber) && Channel1.volume > 0) {
          Channel1.volume -= 1;
        }
      }
    }
  }
  // Done!
}


// Sweep Specific functions

function getSweepPeriod(): u8 {
  let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
  // Get bits 4-6
  let sweepPeriod: u8 = sweepRegister & 0x70;
  sweepPeriod = (sweepPeriod >> 4);
  return sweepPeriod;
}

function getSweepShift(): u8 {
  let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
  // Get bits 0-2
  let sweepShift: u8 = sweepRegister & 0x07;

  return sweepShift;
}

function calculateSweepAndCheckOverflow(): void {

  let newFrequency: u16 = getNewFrequencyFromSweep();
  // 7FF is the highest value of the frequency: 111 1111 1111
  if (newFrequency <= 0x7FF && getSweepShift() > 0) {
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
    // If the new frequency is 2047 or less and the sweep shift is not zero,
    // this new frequency is written back to the shadow frequency and square 1's frequency in NR13 and NR14,
    // then frequency calculation and overflow check are run AGAIN immediately using this new value,
    // but this second new frequency is not written back.
    Channel1.sweepShadowFrequency = newFrequency;
    setChannelFrequency(Channel1.channelNumber, newFrequency);
    // Re calculate the new frequency
    newFrequency = getNewFrequencyFromSweep();
  }

  // Next check if the new Frequency is above 0x7FF
  // if So, disable our sweep
  if (newFrequency > 0x7FF) {
    Channel1.isEnabled = false;
  }
}

// Function to determing a new sweep in the current context
function getNewFrequencyFromSweep(): u16 {

  // Start our new frequency, by making it equal to the "shadow frequency"
  let newFrequency: u16 = Channel1.sweepShadowFrequency;
  newFrequency = (newFrequency >> getSweepShift());

  // Check for sweep negation
  let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
  if (checkBitOnByte(3, sweepRegister)) {
    newFrequency = Channel1.sweepShadowFrequency - newFrequency;
  } else {
    newFrequency = Channel1.sweepShadowFrequency + newFrequency;
  }

  return newFrequency;
}
