// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// How to Search for similar things in binjgb
// Wave channel trigger : APU_NR34_ADDR
// Wave Channel getSample : update_wave

// Wave Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
import { getSaveStateMemoryOffset } from '../core';
import { Sound } from './sound';
import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { checkBitOnByte, log } from '../helpers/index';
import { i32Portable } from '../portable/portable';

export class Channel3 {
  // Cycle Counter for our sound accumulator
  static cycleCounter: i32 = 0;

  // Max Length of our Length Load
  static MAX_LENGTH: i32 = 256;

  // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
  // NR30 -> Sound on/off (R/W)
  static readonly memoryLocationNRx0: i32 = 0xff1a;
  // E--- ---- DAC power
  static updateNRx0(value: i32): void {
    let isDacEnabled = checkBitOnByte(7, value);

    // Sample buffer reset to zero when powered on
    if (!Channel3.isDacEnabled && isDacEnabled) {
      Channel3.sampleBuffer = 0x00;
    }

    Channel3.isDacEnabled = isDacEnabled;

    // Blargg length test
    // Disabling DAC should disable channel immediately
    if (!isDacEnabled) {
      Channel3.isEnabled = isDacEnabled;
    }
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
    Channel3.lengthCounter = Channel3.MAX_LENGTH - Channel3.NRx1LengthLoad;
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
    Channel3.frequency = (Channel3.NRx4FrequencyMSB << 8) | value;
  }

  // NR34 -> Frequency higher data (R/W)
  static readonly memoryLocationNRx4: i32 = 0xff1e;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  static NRx4LengthEnabled: boolean = false;
  static NRx4FrequencyMSB: i32 = 0;
  static updateNRx4(value: i32): void {
    // Handle our frequency
    // Must be done first for our upcoming trigger
    // To correctly reset timing
    let frequencyMSB = value & 0x07;
    Channel3.NRx4FrequencyMSB = frequencyMSB;
    Channel3.frequency = (frequencyMSB << 8) | Channel3.NRx3FrequencyLSB;

    // Obscure behavior
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
    // Also see blargg's cgb sound test
    // Extra length clocking occurs when writing to NRx4,
    // when the frame sequencer's next step is one that,
    // doesn't clock the length counter.
    let frameSequencer = Sound.frameSequencer;
    let doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
    let isBeingLengthEnabled = false;
    if (!doesNextFrameSequencerUpdateLength) {
      // Check lengthEnable
      isBeingLengthEnabled = !Channel3.NRx4LengthEnabled && checkBitOnByte(6, value);
      if (Channel3.lengthCounter > 0 && isBeingLengthEnabled) {
        Channel3.lengthCounter -= 1;

        if (!checkBitOnByte(7, value) && Channel3.lengthCounter === 0) {
          Channel3.isEnabled = false;
        }
      }
    }

    // Set the length enabled from the value
    Channel3.NRx4LengthEnabled = checkBitOnByte(6, value);

    // Trigger our channel, unfreeze length if frozen
    // Triggers should happen after obscure behavior
    // See test 11 for trigger
    if (checkBitOnByte(7, value)) {
      Channel3.trigger();

      // When we trigger on the obscure behavior, and we reset the length Counter to max
      // We need to clock
      if (!doesNextFrameSequencerUpdateLength && Channel3.lengthCounter === Channel3.MAX_LENGTH && Channel3.NRx4LengthEnabled) {
        Channel3.lengthCounter -= 1;
      }
    }
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

  // WaveTable Properties
  static waveTablePosition: i32 = 0x00;
  static volumeCode: i32 = 0x00;
  static volumeCodeChanged: boolean = false;
  static sampleBuffer: i32 = 0x00;

  // Save States

  static readonly saveStateSlot: i32 = 9;

  // Function to save the state of the class
  static saveState(): void {
    // Cycle Counter
    store<i32>(getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot), Channel3.cycleCounter);

    // NRx0
    // No NRx0 Properties

    // NRx1
    store<u16>(getSaveStateMemoryOffset(0x08, Channel3.saveStateSlot), <u16>Channel3.NRx1LengthLoad);

    // NRx2
    store<u8>(getSaveStateMemoryOffset(0x0a, Channel3.saveStateSlot), <u8>Channel3.NRx2VolumeCode);

    // NRx3
    store<u8>(getSaveStateMemoryOffset(0x0c, Channel3.saveStateSlot), <u8>Channel3.NRx3FrequencyLSB);

    // NRx4
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Channel3.saveStateSlot), Channel3.NRx4LengthEnabled);
    store<u8>(getSaveStateMemoryOffset(0x0e, Channel3.saveStateSlot), <u8>Channel3.NRx4FrequencyMSB);

    // Channel Properties
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Channel3.saveStateSlot), Channel3.isEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel3.saveStateSlot), Channel3.isDacEnabled);
    store<i32>(getSaveStateMemoryOffset(0x11, Channel3.saveStateSlot), Channel3.frequency);
    store<i32>(getSaveStateMemoryOffset(0x15, Channel3.saveStateSlot), Channel3.frequencyTimer);
    // No Envelope
    store<i32>(getSaveStateMemoryOffset(0x19, Channel3.saveStateSlot), Channel3.lengthCounter);

    // WaveTable Properties
    store<i32>(getSaveStateMemoryOffset(0x21, Channel3.saveStateSlot), Channel3.waveTablePosition);
    store<u8>(getSaveStateMemoryOffset(0x25, Channel3.saveStateSlot), Channel3.volumeCode);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x26, Channel3.saveStateSlot), Channel3.volumeCodeChanged);
    store<i32>(getSaveStateMemoryOffset(0x27, Channel3.saveStateSlot), Channel3.sampleBuffer);
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Cycle Counter
    Channel3.cycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Channel3.cycleCounter));

    // NRx0
    // No NRx0

    // NRx1
    Channel3.NRx1LengthLoad = load<u16>(getSaveStateMemoryOffset(0x08, Channel3.saveStateSlot));

    // NRx2
    Channel3.NRx2VolumeCode = load<u8>(getSaveStateMemoryOffset(0x0a, Channel3.saveStateSlot));

    // NRx3
    Channel3.NRx3FrequencyLSB = load<u8>(getSaveStateMemoryOffset(0x0c, Channel3.saveStateSlot));

    // NRx4
    Channel3.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Channel3.saveStateSlot));
    Channel3.NRx4FrequencyMSB = load<u8>(getSaveStateMemoryOffset(0x0e, Channel3.saveStateSlot));

    // Channel Properties
    Channel3.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Channel3.saveStateSlot));
    Channel3.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel3.saveStateSlot));
    Channel3.frequency = load<i32>(getSaveStateMemoryOffset(0x11, Channel3.saveStateSlot));
    Channel3.frequencyTimer = load<i32>(getSaveStateMemoryOffset(0x15, Channel3.saveStateSlot));
    // No Envelope
    Channel3.lengthCounter = load<i32>(getSaveStateMemoryOffset(0x19, Channel3.saveStateSlot));

    // Wave Table Properties
    Channel3.waveTablePosition = load<i32>(getSaveStateMemoryOffset(0x21, Channel3.saveStateSlot));
    Channel3.volumeCode = load<i32>(getSaveStateMemoryOffset(0x25, Channel3.saveStateSlot));
    Channel3.volumeCodeChanged = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x26, Channel3.saveStateSlot));
    Channel3.sampleBuffer = load<i32>(getSaveStateMemoryOffset(0x27, Channel3.saveStateSlot));
  }

  // Memory Read Trap
  static handleWaveRamRead(): i32 {
    // Obscure behavior
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
    // If the wave channel is enabled, accessing any byte from $FF30-$FF3F is equivalent to,
    // accessing the current byte selected by the waveform position. Further, on the DMG accesses will only work in this manner,
    // if made within a couple of clocks of the wave channel accessing wave RAM;
    // if made at any other time, reads return $FF and writes have no effect.

    // TODO: Handle DMG case

    return readCurrentSampleByteFromWaveRam();
  }

  // Memory Write Trap
  static handleWaveRamWrite(value: i32): void {
    // Obscure behavior
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
    // If the wave channel is enabled, accessing any byte from $FF30-$FF3F is equivalent to,
    // accessing the current byte selected by the waveform position. Further, on the DMG accesses will only work in this manner,
    // if made within a couple of clocks of the wave channel accessing wave RAM;
    // if made at any other time, reads return $FF and writes have no effect.

    // Thus we want to write the value to the current sample position
    // Will Find the position, and knock off any remainder
    let positionIndexToAdd = i32Portable(Channel3.waveTablePosition >> 1);
    let memoryLocationWaveSample = Channel3.memoryLocationWaveTable + positionIndexToAdd;

    eightBitStoreIntoGBMemory(memoryLocationWaveSample, value);
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
    let accumulatedCycles = Channel3.cycleCounter;
    Channel3.cycleCounter = 0;
    return Channel3.getSample(accumulatedCycles);
  }

  // Function to reset our timer, useful for GBC double speed mode
  static resetTimer(): void {
    let frequencyTimer = (2048 - Channel3.frequency) << 1;

    // TODO: Ensure this is correct for GBC Double Speed Mode
    Channel3.frequencyTimer = frequencyTimer << (<i32>Cpu.GBCDoubleSpeed);
  }

  static getSample(numberOfCycles: i32): i32 {
    // Check if we are enabled
    if (!Channel3.isEnabled || !Channel3.isDacEnabled) {
      // Return silence
      // Since range from -15 - 15, or 0 to 30 for our unsigned
      return 15;
    }

    // Get our volume code
    // Need this to compute the sample
    let volumeCode = Channel3.volumeCode;
    if (Channel3.volumeCodeChanged) {
      volumeCode = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
      volumeCode = volumeCode >> 5;
      volumeCode = volumeCode & 0x0f;
      Channel3.volumeCode = volumeCode;
      Channel3.volumeCodeChanged = false;
    }

    // Get the current sample
    let sample = getSampleFromSampleBufferForWaveTablePosition();

    // Shift our sample and set our volume depending on the volume code
    // Since we can't multiply by float, simply divide by 4, 2, 1
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
    let outputVolume = 0;
    switch (volumeCode) {
      case 0:
        sample >>= 4;
        break;
      case 1:
        // Dont Shift sample
        outputVolume = 1;
        break;
      case 2:
        sample >>= 1;
        outputVolume = 2;
        break;
      default:
        sample >>= 2;
        outputVolume = 4;
        break;
    }

    // Apply out output volume
    sample = outputVolume > 0 ? sample / outputVolume : 0;
    // Square Waves Can range from -15 - 15. Therefore simply add 15
    sample += 15;

    // Update the sample based on our timer
    let frequencyTimer = Channel3.frequencyTimer;
    frequencyTimer -= numberOfCycles;
    while (frequencyTimer <= 0) {
      // Get the amount that overflowed so we don't drop cycles
      let overflowAmount = abs(frequencyTimer);

      // Reset our timer
      // A wave channel's frequency timer period is set to (2048-frequency) * 2.
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
      Channel3.resetTimer();
      frequencyTimer = Channel3.frequencyTimer;
      frequencyTimer -= overflowAmount;

      // Update our sample buffer
      advanceWavePositionAndSampleBuffer();
    }

    Channel3.frequencyTimer = frequencyTimer;

    // Finally return the sample
    return sample;
  }

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
  static trigger(): void {
    Channel3.isEnabled = true;
    // Length counter maximum handled by write
    if (Channel3.lengthCounter === 0) {
      Channel3.lengthCounter = Channel3.MAX_LENGTH;
    }

    // Reset our timer
    // A wave channel's frequency timer period is set to (2048-frequency)*2.
    Channel3.resetTimer();

    // Add some delay to our frequency timer
    // So Honestly, lifted this from binjgb
    // https://github.com/binji/binjgb/blob/68eb4b2f6d5d7a98d270e12c4b8ff065c07f5e94/src/emulator.c#L2625
    // I have no clue why this is, but it passes 09-wave read while on.s
    // blargg test.
    // I think this has to do with obscure behavior?
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
    // When triggering the wave channel,
    // the first sample to play is the previous one still in the high nibble of the sample buffer,
    // and the next sample is the second nibble from the wave table.
    // This is because it doesn't load the first byte on trigger like it "should".
    // The first nibble from the wave table is thus not played until the waveform loops.
    Channel3.frequencyTimer += 6;

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
    return !(!Channel3.volumeCodeChanged && Channel3.frequencyTimer - Channel3.cycleCounter > 0);
  }

  static updateLength(): void {
    let lengthCounter = Channel3.lengthCounter;
    if (lengthCounter > 0 && Channel3.NRx4LengthEnabled) {
      lengthCounter -= 1;
    }

    if (lengthCounter === 0) {
      Channel3.isEnabled = false;
    }
    Channel3.lengthCounter = lengthCounter;
  }
}

// Functions specific to wave memory
function advanceWavePositionAndSampleBuffer(): void {
  // Advance the wave table position, and loop back if needed
  let waveTablePosition = Channel3.waveTablePosition;
  waveTablePosition += 1;
  while (waveTablePosition >= 32) {
    waveTablePosition -= 32;
  }
  Channel3.waveTablePosition = waveTablePosition;

  // Load the next sample byte from wave ram,
  // into the sample buffer
  Channel3.sampleBuffer = readCurrentSampleByteFromWaveRam();
}

function readCurrentSampleByteFromWaveRam(): i32 {
  // Will Find the position, and knock off any remainder
  let positionIndexToAdd = i32Portable(Channel3.waveTablePosition >> 1);
  let memoryLocationWaveSample = Channel3.memoryLocationWaveTable + positionIndexToAdd;

  return eightBitLoadFromGBMemory(memoryLocationWaveSample);
}

function getSampleFromSampleBufferForWaveTablePosition(): i32 {
  let sample = Channel3.sampleBuffer;

  // Need to grab the top or lower half for the correct sample
  sample >>= (<i32>((Channel3.waveTablePosition & 1) === 0)) << 2;
  sample &= 0x0f;

  return sample;
}
