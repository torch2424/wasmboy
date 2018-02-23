// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Simple Square Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave

import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory
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

export class Channel2 {

  // Squarewave channel with volume envelope functions only.
  // NR21 -> Sound length/Wave pattern duty (R/W)
  static memoryLocationNRx1: u16 = 0xFF16;
  // NR22 -> Volume Envelope (R/W)
  static memoryLocationNRx2: u16 = 0xFF17;
  // NR23 -> Frequency lo (W)
  static memoryLocationNRx3: u16 = 0xFF18;
  // NR24 -> Frequency hi (R/W)
  static memoryLocationNRx4: u16 = 0xFF19;

  // Channel Properties
  static channelNumber: i8 = 2;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  // Square Wave properties
  static dutyCycle: u8 = 0x00;
  static waveFormPositionOnDuty: u8 = 0x00;

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1 - 1, 0xFF);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1, 0x3F);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx2, 0x00);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, 0xF3);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, 0xBF);
  }

  static getSample(numberOfCycles: u8): u32 {

    // Decrement our channel timer
    Channel2.frequencyTimer -= <i32>numberOfCycles;
    if(Channel2.frequencyTimer <= 0) {

      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount: i32 = abs(Channel2.frequencyTimer);

      // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
      Channel2.frequencyTimer = (2048 - getChannelFrequency(Channel2.channelNumber)) * 4;
      Channel2.frequencyTimer -= overflowAmount;

      // Also increment our duty cycle
      // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
      // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
      Channel2.waveFormPositionOnDuty += 1;
      if (Channel2.waveFormPositionOnDuty >= 8) {
        Channel2.waveFormPositionOnDuty = 0;
      }
    }

    // Get our ourput volume, set to zero for silence
    let outputVolume: u8 = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if(Channel2.isEnabled &&
    isChannelDacEnabled(Channel2.channelNumber)) {
      outputVolume = <u8>Channel2.volume;
    }

    // Get the current sampleValue
    let sample: i32 = 1;
    if (!isDutyCycleClockPositiveOrNegativeForWaveform(1, Channel2.waveFormPositionOnDuty)) {
      sample = sample * -1;
    }

    sample = sample * outputVolume;

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return <u32>sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel2.isEnabled = true;
    if(Channel2.lengthCounter === 0) {
      Channel2.lengthCounter = 64;
    }

    // Reset our timer
    // A square channel's frequency timer period is set to (2048-frequency)*4.
    // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
    Channel2.frequencyTimer = (2048 - getChannelFrequency(Channel2.channelNumber)) * 4;

    Channel2.envelopeCounter = getChannelEnvelopePeriod(Channel2.channelNumber);

    Channel2.volume = getChannelStartingVolume(Channel2.channelNumber);

    // Finally if DAC is off, channel is still disabled
    if(!isChannelDacEnabled(Channel2.channelNumber)) {
      Channel2.isEnabled = false;
    }
  }

  static updateLength(): void {
    if(Channel2.lengthCounter > 0 && isChannelLengthEnabled(Channel2.channelNumber)) {
      Channel2.lengthCounter -= 1;
    }

    if(Channel2.lengthCounter === 0) {
      Channel2.isEnabled = false;
    }
  }

  static updateEnvelope(): void {

    // Obscure behavior
    // TODO: The volume envelope and sweep timers treat a period of 0 as 8.

    Channel2.envelopeCounter -= 1;
    if (Channel2.envelopeCounter <= 0) {
      Channel2.envelopeCounter = getChannelEnvelopePeriod(Channel2.channelNumber);

      // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
      // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
      if(Channel2.envelopeCounter !== 0) {
        if(getChannelEnvelopeAddMode(Channel2.channelNumber) && Channel2.volume < 15) {
          Channel2.volume += 1;
        } else if (!getChannelEnvelopeAddMode(Channel2.channelNumber) && Channel2.volume > 0) {
          Channel2.volume -= 1;
        }
      }
    }
  }
  // Done!
}
