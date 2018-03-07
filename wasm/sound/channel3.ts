// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Wave Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel

import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
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

export class Channel3 {

  // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
  // NR30 -> Sound on/off (R/W)
  static memoryLocationNRx0: u16 = 0xFF1A;
  // NR31 -> Sound length (R/W)
  static memoryLocationNRx1: u16 = 0xFF1B;
  // NR32 -> Select ouput level (R/W)
  static memoryLocationNRx2: u16 = 0xFF1C;
  // NR33 -> Frequency lower data (W)
  static memoryLocationNRx3: u16 = 0xFF1D;
  // NR34 -> Frequency higher data (R/W)
  static memoryLocationNRx4: u16 = 0xFF1E;

  // Our wave table location
  static memoryLocationWaveTable: u16 = 0xFF30;

  // Channel Properties
  static channelNumber: i8 = 3;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static waveTablePosition: u16 = 0x00;

  // Save States

  static saveStateSlot: u16 = 9;

  // Function to save the state of the class
  static saveState(): void {
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot), Channel3.isEnabled);
    store<i32>(getSaveStateMemoryOffset(0x01, Channel3.saveStateSlot), Channel3.frequencyTimer);
    store<i32>(getSaveStateMemoryOffset(0x05, Channel3.saveStateSlot), Channel3.lengthCounter);
    store<u16>(getSaveStateMemoryOffset(0x09, Channel3.saveStateSlot), Channel3.waveTablePosition);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Channel3.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot));
    Channel3.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x01, Channel3.saveStateSlot));
    Channel3.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x05, Channel3.saveStateSlot));
    Channel3.waveTablePosition = load<u16>(getSaveStateMemoryOffset(0x09, Channel3.saveStateSlot));
  }

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx0, 0x7F);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx1, 0xFF);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx2, 0x9F);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx3, 0xBF);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx4, 0xFF);
  }

  static getSample(numberOfCycles: u8): u32 {

    // Decrement our channel timer
    Channel3.frequencyTimer -= <i32>numberOfCycles;
    if(Channel3.frequencyTimer <= 0) {

      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount: i32 = abs(Channel3.frequencyTimer);

      // Reset our timer
      // A wave channel's frequency timer period is set to (2048-frequency) * 2.
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
      Channel3.frequencyTimer = (2048 - getChannelFrequency(Channel3.channelNumber)) * 2;
      Channel3.frequencyTimer -= overflowAmount;


      // Advance the wave table position, and loop back if needed
      Channel3.waveTablePosition += 1;
      if(Channel3.waveTablePosition >= 32) {
        Channel3.waveTablePosition = 0;
      }
    }

    // Get the current sample
    let sample: i16 = 0;

    // Will Find the position, and knock off any remainder
    let positionIndexToAdd: u16 = Channel3.waveTablePosition / 2;
    let memoryLocationWaveSample: u16 = Channel3.memoryLocationWaveTable + positionIndexToAdd;

    sample = <i16>eightBitLoadFromGBMemory(memoryLocationWaveSample);

    // Need to grab the top or lower half for the correct sample
    if (Channel3.waveTablePosition % 2 === 0) {
      // First sample
      sample = (sample >> 4);
      sample = (sample & 0x0F);
    } else {
      // Second Samples
      sample = (sample & 0x0F);
    }

    // Get our ourput volume, set to zero for silence
    let outputVolume: i16 = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if(Channel3.isEnabled &&
    isChannelDacEnabled(Channel3.channelNumber)) {
      // Get our volume code
      let volumeCode = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
      volumeCode = (volumeCode >> 5);
      volumeCode = (volumeCode & 0x0F);

      // Shift our sample and set our volume depending on the volume code
      // Since we can't multiply by float, simply divide by 4, 2, 1
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
      if(volumeCode <= 0) {
        sample = (sample >> 4);
      } else if (volumeCode === 1) {
        // Dont Shift sample
        outputVolume = 1;
      } else if (volumeCode === 2) {
        sample = (sample >> 1)
        outputVolume = 2;
      } else {
        sample = (sample >> 2)
        outputVolume = 4;
      }
    }

    // Spply out output volume
    if(outputVolume > 0) {
      sample = sample / outputVolume;
    } else {
      sample = 0;
    }

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return <u32>sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel3.isEnabled = true;
    if(Channel3.lengthCounter === 0) {
      Channel3.lengthCounter = 256;
    }

    // Reset our timer
    // A wave channel's frequency timer period is set to (2048-frequency)*2.
    Channel3.frequencyTimer = (2048 - getChannelFrequency(Channel3.channelNumber)) * 2;

    // Reset our wave table position
    Channel3.waveTablePosition = 0;

    // Finally if DAC is off, channel is still disabled
    if(!isChannelDacEnabled(Channel3.channelNumber)) {
      Channel3.isEnabled = false;
    }
  }

  static updateLength(): void {
    if(Channel3.lengthCounter > 0 && isChannelLengthEnabled(Channel3.channelNumber)) {
      Channel3.lengthCounter -= 1;
    }

    if(Channel3.lengthCounter === 0) {
      Channel3.isEnabled = false;
    }
  }
}
