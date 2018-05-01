// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Wave Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel

import { isDutyCycleClockPositiveOrNegativeForWaveform } from "./duty";
import { Cpu } from "../cpu/cpu";
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from "../memory/index";
import { checkBitOnByte, hexLog } from "../helpers/index";

export class Channel3 {
  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
  // NR30 -> Sound on/off (R/W)
  static readonly memoryLocationNRx0: i32 = 0xff1a;
  // E--- ---- DAC power
  static updateNRx0(value: i32): void {
    Channel3.isDacEnabled = checkBitOnByte(7, value);
  }

  // NR31 -> Sound length (R/W)
  static readonly memoryLocationNRx1: i32 = 0xff1b;
  // LLLL LLLL Length load (256-L)
  static NRx1LengthLoad: i32 = 0;
  static updateNRx1(value: i32): void {
    Channel3.NRx1LengthLoad = value;

    // Also need to set our length counter. Taken from the old, setChannelLengthCounter
    // Channel length is determined by 64 (or 256 if channel 3), - the length load
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
    // Note, this will be different for channel 3
    // Supposed to be 256, so subtracting 255 and then adding 1 if that makes sense
    Channel3.lengthCounter = 256 - Channel3.NRx1LengthLoad;
  }

  // NR32 -> Select ouput level (R/W)
  static readonly memoryLocationNRx2: i32 = 0xff1c;
  // -VV- ---- Volume code (00=0%, 01=100%, 10=50%, 11=25%)
  static NRx2VolumeCode: i32 = 0;
  static updateNRx2(value: i32): void {
    Channel3.NRx2VolumeCode = (value >> 5) & 0x0f;
  }

  // NR33 -> Frequency lower data (W)
  static readonly memoryLocationNRx3: i32 = 0xff1d;
  // FFFF FFFF Frequency LSB
  static NRx3FrequencyLSB: i32 = 0;
  static updateNRx3(value: i32): void {
    Channel3.NRx3FrequencyLSB = value;

    // Update Channel Frequency
    let frequency: i32 =
      (Channel3.NRx4FrequencyMSB << 8) | Channel3.NRx3FrequencyLSB;
    Channel3.frequency = frequency;
  }

  // NR34 -> Frequency higher data (R/W)
  static readonly memoryLocationNRx4: i32 = 0xff1e;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  static NRx4LengthEnabled: boolean = false;
  static NRx4FrequencyMSB: i32 = 0;
  static updateNRx4(value: i32): void {
    Channel3.NRx4LengthEnabled = checkBitOnByte(6, value);
    Channel3.NRx4FrequencyMSB = value & 0x07;

    // Update Channel Frequency
    let frequency: i32 =
      (Channel3.NRx4FrequencyMSB << 8) | Channel3.NRx3FrequencyLSB;
    Channel3.frequency = frequency;
  }

  // Our wave table location
  static readonly memoryLocationWaveTable: i32 = 0xff30;

  // Channel Properties
  static readonly channelNumber: i32 = 3;
  static isEnabled: boolean = false;
  static isDacEnabled: boolean = false;
  static frequency: i32 = 0;
  static frequencyTimer: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static waveTablePosition: i32 = 0x00;
  static volumeCode: i32 = 0x00;
  static volumeCodeChanged: boolean = false;

  // Save States

  static readonly saveStateSlot: i32 = 9;

  // Function to save the state of the class
  static saveState(): void {
    storeBooleanDirectlyToWasmMemory(
      getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot),
      Channel3.isEnabled
    );
    store<i32>(
      getSaveStateMemoryOffset(0x01, Channel3.saveStateSlot),
      Channel3.frequencyTimer
    );
    store<i32>(
      getSaveStateMemoryOffset(0x05, Channel3.saveStateSlot),
      Channel3.lengthCounter
    );
    store<u16>(
      getSaveStateMemoryOffset(0x09, Channel3.saveStateSlot),
      Channel3.waveTablePosition
    );
  }

  // Function to load the save state from memory
  static loadState(): void {
    Channel3.isEnabled = loadBooleanDirectlyFromWasmMemory(
      getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot)
    );
    Channel3.frequencyTimer = load<i32>(
      getSaveStateMemoryOffset(0x01, Channel3.saveStateSlot)
    );
    Channel3.lengthCounter = load<i32>(
      getSaveStateMemoryOffset(0x05, Channel3.saveStateSlot)
    );
    Channel3.waveTablePosition = load<u16>(
      getSaveStateMemoryOffset(0x09, Channel3.saveStateSlot)
    );
  }

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx0, 0x7f);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx1, 0xff);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx2, 0x9f);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx3, 0x00);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx4, 0xb8);

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
    Channel3.frequencyTimer = (2048 - Channel3.frequency) * 2;

    // TODO: Ensure this is correct for GBC Double Speed Mode
    if (Cpu.GBCDoubleSpeed) {
      Channel3.frequencyTimer = Channel3.frequencyTimer * 2;
    }
  }

  static getSample(numberOfCycles: i32): i32 {
    // Decrement our channel timer
    Channel3.frequencyTimer -= numberOfCycles;
    if (Channel3.frequencyTimer <= 0) {
      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount: i32 = abs(Channel3.frequencyTimer);

      // Reset our timer
      // A wave channel's frequency timer period is set to (2048-frequency) * 2.
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
      Channel3.resetTimer();
      Channel3.frequencyTimer -= overflowAmount;

      // Advance the wave table position, and loop back if needed
      Channel3.waveTablePosition += 1;
      if (Channel3.waveTablePosition >= 32) {
        Channel3.waveTablePosition = 0;
      }
    }

    // Get our ourput volume
    let outputVolume: i32 = 0;
    let volumeCode: i32 = Channel3.volumeCode;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if (Channel3.isEnabled && Channel3.isDacEnabled) {
      // Get our volume code
      if (Channel3.volumeCodeChanged) {
        volumeCode = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
        volumeCode = volumeCode >> 5;
        volumeCode = volumeCode & 0x0f;
        Channel3.volumeCode = volumeCode;
        Channel3.volumeCodeChanged = false;
      }
    } else {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Get the current sample
    let sample: i32 = 0;

    // Will Find the position, and knock off any remainder
    let positionIndexToAdd: i32 = Channel3.waveTablePosition / 2;
    let memoryLocationWaveSample: i32 =
      Channel3.memoryLocationWaveTable + positionIndexToAdd;

    sample = eightBitLoadFromGBMemory(memoryLocationWaveSample);

    // Need to grab the top or lower half for the correct sample
    if (Channel3.waveTablePosition % 2 === 0) {
      // First sample
      sample = sample >> 4;
      sample = sample & 0x0f;
    } else {
      // Second Samples
      sample = sample & 0x0f;
    }

    // Shift our sample and set our volume depending on the volume code
    // Since we can't multiply by float, simply divide by 4, 2, 1
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
    switch (volumeCode) {
      case 0:
        sample = sample >> 4;
        break;
      case 1:
        // Dont Shift sample
        outputVolume = 1;
        break;
      case 2:
        sample = sample >> 1;
        outputVolume = 2;
        break;
      default:
        sample = sample >> 2;
        outputVolume = 4;
        break;
    }

    // Spply out output volume
    if (outputVolume > 0) {
      sample = sample / outputVolume;
    } else {
      sample = 0;
    }

    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample = sample + 15;
    return sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel3.isEnabled = true;
    if (Channel3.lengthCounter === 0) {
      Channel3.lengthCounter = 256;
    }

    // Reset our timer
    // A wave channel's frequency timer period is set to (2048-frequency)*2.
    Channel3.resetTimer();

    // Reset our wave table position
    Channel3.waveTablePosition = 0;

    // Finally if DAC is off, channel is still disabled
    if (!Channel3.isDacEnabled) {
      Channel3.isEnabled = false;
    }
  }

  // Function to determine if the current channel would update when getting the sample
  // This is used to accumulate samples
  static willChannelUpdate(numberOfCycles: i32): boolean {
    //Increment our cycle counter
    Channel3.cycleCounter += numberOfCycles;

    // Dac enabled status cached by accumulator
    if (
      Channel3.frequencyTimer - Channel3.cycleCounter > 0 &&
      !Channel3.volumeCodeChanged
    ) {
      return false;
    }

    return true;
  }

  static updateLength(): void {
    if (Channel3.lengthCounter > 0 && Channel3.NRx4LengthEnabled) {
      Channel3.lengthCounter -= 1;
    }

    if (Channel3.lengthCounter === 0) {
      Channel3.isEnabled = false;
    }
  }
}
