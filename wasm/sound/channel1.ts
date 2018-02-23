// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Square Channel with Frequency Sweep
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Frequency_Sweep

import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory
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
  static memoryLocationNRx0: u16 = 0xFF10;
  // NR11 -> Sound length/Wave pattern duty (R/W)
  static memoryLocationNRx1: u16 = 0xFF11;
  // NR12 -> Volume Envelope (R/W)
  static memoryLocationNRx2: u16 = 0xFF12;
  // NR13 -> Frequency lo (W)
  static memoryLocationNRx3: u16 = 0xFF13;
  // NR14 -> Frequency hi (R/W)
  static memoryLocationNRx4: u16 = 0xFF14;

  // Channel Properties
  static channelNumber: i8 = 1;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  // Square Wave properties
  static dutyCycle: u8 = 0x00;
  static waveFormPositionOnDuty: u8 = 0x00;

  // Channel 1 Sweep
  static sweepCounter: i32 = 0x00;
  static sweepShadowFrequency: u16 = 0x00;

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx0, 0x80);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx1, 0xBF);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx2, 0xF3);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, 0xFF);
    eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, 0xBF);
  }

  static getSample(numberOfCycles: u8): u32 {

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

    // Get our ourput volume, set to zero for silence
    let outputVolume: i32 = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if(Channel1.isEnabled &&
    isChannelDacEnabled(Channel1.channelNumber)) {
      outputVolume = Channel1.volume;
    }

    // Get the current sampleValue
    let sample: i32 = 1;
    if (!isDutyCycleClockPositiveOrNegativeForWaveform(1, Channel1.waveFormPositionOnDuty)) {
      sample = sample * -1;
    }


    sample = sample * outputVolume;

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return <u32>sample;
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
    // Getting period and things here, as frequency sweep is specific to the channel 1 square wave
    let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
    // Get bits 4-6
    let sweepPeriod: u8 = sweepRegister & 0x70;
    // Get bits 0-2
    let sweepShift: u8 = sweepRegister & 0x07;

    // Reset back to the sweep period
    Channel1.sweepCounter = sweepPeriod;
    Channel1.sweepShadowFrequency = getChannelFrequency(Channel1.channelNumber);

    // If the sweep shift is non-zero, frequency calculation and the overflow check are performed immediately.
    if(sweepShift > 0) {
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

      // Getting period and things here, as frequency sweep is specific to the channel 1 square wave
      let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
      // Get bits 4-6
      let sweepPeriod: u8 = sweepRegister & 0x70;

      // Reset back to the sweep period
      Channel1.sweepCounter = sweepPeriod;

      // Calculate our sweep
      calculateSweepAndCheckOverflow();
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

function calculateSweepAndCheckOverflow(): void {
  if(isSweepEnabled()) {

    // Getting period and things here, as frequency sweep is specific to the channel 1 square wave
    let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
    // Get bits 0-2
    let sweepShift: u8 = sweepRegister & 0x07;

    let newFrequency: u16 = getNewFrequencyFromSweep();
    // 7FF is the highest value of the frequency: 111 1111 1111
    if (newFrequency <= 0x7FF && sweepShift > 0) {
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
}

// The internal enabled flag is set if either the sweep period or shift
// are non-zero, cleared otherwise.
function isSweepEnabled(): boolean {
  let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
  // Get bits 4-6
  let sweepPeriod: u8 = sweepRegister & 0x70;
  // Get bits 0-2
  let sweepShift: u8 = sweepRegister & 0x07;

  if ((sweepPeriod !== 0 || sweepShift !== 0) || getChannelFrequency(1) > 0x7FF) {
    return true;
  } else {
    return false;
  }
}

// Function to determing a new sweep in the current context
function getNewFrequencyFromSweep(): u16 {

  // Get our sweep register info
  let sweepRegister: u8 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
  // Get bits 4-6
  let sweepPeriod: u8 = sweepRegister & 0x70;
  // Get bits 0-2
  let sweepShift: u8 = sweepRegister & 0x07;

  // Start our new frequency, by making it equal to the "shadow frequency"
  let newFrequency: u16 = Channel1.sweepShadowFrequency;
  newFrequency = (newFrequency >> sweepShift);

  // Check for sweep negation
  if (checkBitOnByte(3, sweepRegister)) {
    newFrequency = Channel1.sweepShadowFrequency - newFrequency;
  } else {
    newFrequency = Channel1.sweepShadowFrequency + newFrequency;
  }

  return newFrequency;
}
