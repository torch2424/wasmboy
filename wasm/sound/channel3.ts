// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Wave Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel

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
  Cpu
} from '../cpu/cpu';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';

export class Channel3 {

  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
  // NR30 -> Sound on/off (R/W)
  static readonly memoryLocationNRx0: u16 = 0xFF1A;
  // NR31 -> Sound length (R/W)
  static readonly memoryLocationNRx1: u16 = 0xFF1B;
  // NR32 -> Select ouput level (R/W)
  static readonly memoryLocationNRx2: u16 = 0xFF1C;
  // NR33 -> Frequency lower data (W)
  static readonly memoryLocationNRx3: u16 = 0xFF1D;
  // NR34 -> Frequency higher data (R/W)
  static readonly memoryLocationNRx4: u16 = 0xFF1E;

  // Our wave table location
  static readonly memoryLocationWaveTable: u16 = 0xFF30;

  // Channel Properties
  static readonly channelNumber: i32 = 3;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static waveTablePosition: u16 = 0x00;
  static volumeCode: u8 = 0x00;
  static volumeCodeChanged: boolean = false;

  // Save States

  static readonly saveStateSlot: u16 = 9;

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
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx3, 0x00);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx4, 0xB8);

    // The volume code changed
    Channel3.volumeCodeChanged = true;
  }

  // Function to get a sample using the cycle counter on the channel
  static getSampleFromCycleCounter(): i32 {
    let accumulatedCycles: i32 = Channel3.cycleCounter;
    Channel3.cycleCounter = 0;
    return Channel3.getSample(accumulatedCycles);
  }

  // Function to reset our timer, useful for GBC double speed mode
  static resetTimer(): void {
    Channel3.frequencyTimer = (2048 - getChannelFrequency(Channel3.channelNumber)) * 2;

    // TODO: Ensure this is correct for GBC Double Speed Mode
    if (Cpu.GBCDoubleSpeed) {
      Channel3.frequencyTimer = Channel3.frequencyTimer * 2;
    }
  }

  static getSample(numberOfCycles: i32): i32 {

    // Decrement our channel timer
    Channel3.frequencyTimer -= numberOfCycles;
    if(Channel3.frequencyTimer <= 0) {

      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount: i32 = abs(Channel3.frequencyTimer);

      // Reset our timer
      // A wave channel's frequency timer period is set to (2048-frequency) * 2.
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
      Channel3.resetTimer();
      Channel3.frequencyTimer -= overflowAmount;


      // Advance the wave table position, and loop back if needed
      Channel3.waveTablePosition += 1;
      if(Channel3.waveTablePosition >= 32) {
        Channel3.waveTablePosition = 0;
      }
    }

    // Get our ourput volume
    let outputVolume: i16 = 0;
    let volumeCode: u8 = Channel3.volumeCode;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if(Channel3.isEnabled &&
    isChannelDacEnabled(Channel3.channelNumber)) {
      // Get our volume code
      if(Channel3.volumeCodeChanged) {
        let volumeCode: u8 = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
        volumeCode = (volumeCode >> 5);
        volumeCode = (volumeCode & 0x0F);
        Channel3.volumeCode = volumeCode;
        Channel3.volumeCodeChanged = false;
      }
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
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

    // Shift our sample and set our volume depending on the volume code
    // Since we can't multiply by float, simply divide by 4, 2, 1
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
    switch(volumeCode) {
      case 0:
        sample = (sample >> 4);
        break;
      case 1:
        // Dont Shift sample
        outputVolume = 1;
        break;
      case 2:
        sample = (sample >> 1)
        outputVolume = 2;
        break;
      default:
        sample = (sample >> 2)
        outputVolume = 4;
        break;
    }

    // Spply out output volume
    if(outputVolume > 0) {
      sample = sample / outputVolume;
    } else {
      sample = 0;
    }

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return <i32>sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel3.isEnabled = true;
    if(Channel3.lengthCounter === 0) {
      Channel3.lengthCounter = 256;
    }

    // Reset our timer
    // A wave channel's frequency timer period is set to (2048-frequency)*2.
    Channel3.resetTimer();

    // Reset our wave table position
    Channel3.waveTablePosition = 0;

    // Finally if DAC is off, channel is still disabled
    if(!isChannelDacEnabled(Channel3.channelNumber)) {
      Channel3.isEnabled = false;
    }
  }

  // Function to determine if the current channel would update when getting the sample
  // This is used to accumulate samples
  static willChannelUpdate(numberOfCycles: i32): boolean {

    //Increment our cycle counter
    Channel3.cycleCounter += numberOfCycles;

    // Dac enabled status cached by accumulator
    if (Channel3.frequencyTimer - Channel3.cycleCounter > 0 &&
      !Channel3.volumeCodeChanged) {
      return false;
    }

    return true;
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
