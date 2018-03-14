// https://emu-docs.org/Game%20Boy/gb_sound.txt
// https://www.youtube.com/watch?v=HyzD8pNlpwI
// https://gist.github.com/drhelius/3652407

// For our wasm -> JS, we will be passing in our -1.0 to 1.0 volume
// As an unsigned byte. Each channel will give 0 (representing -1.0), to
// 30 (representing 1.0), and will be added together. in the fucntion
// getSampleAsUnsignedByte() will do the conversion of getting the total
// of all the channels, times the (mixer volume + 1), to give us an unsigned
// byte from 0 (-1.0) to 254 (1.0)

import {
    Channel1
} from './channel1';
import {
    Channel2
} from './channel2';
import {
    Channel3
} from './channel3';
import {
    Channel4
} from './channel4';
import {
  isChannelEnabledOnLeftOutput,
  isChannelEnabledOnRightOutput
} from './registers';
import {
  Cpu
} from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  setLeftAndRightOutputForAudioQueue,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import {
  hexLog,
  performanceTimestamp
} from '../helpers/index';

export class Sound {

  // Channel control / On-OFF / Volume (RW)
  static readonly memoryLocationNR50: u16 = 0xFF24;

  // 0xFF25 selects which output each channel goes to, Referred to as NR51
  static readonly memoryLocationNR51: u16 = 0xFF25;

  // Sound on/off
  static readonly memoryLocationNR52: u16 = 0xFF26;

  // $FF30 -- $FF3F is the load register space for the 4-bit samples for channel 3
  static readonly memoryLocationChannel3LoadRegisterStart: u16 = 0xFF30;

  // Need to count how often we need to increment our frame sequencer
  // Which you can read about below
  static frameSequenceCycleCounter: i32 = 0x0000;
  static readonly maxFrameSequenceCycles: i32 = 8192;

  // Also need to downsample our audio to average audio qualty
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
  // Want to do 48000hz, so CpuRate / Sound Rate, 4194304 / 48000 ~ 87 cycles
  static downSampleCycleCounter: u8 = 0x00;
  static readonly maxDownSampleCycles: u8 = 87;

  // Frame sequencer controls what should be updated and and ticked
  // Everyt time the sound is updated :) It is updated everytime the
  // Cycle counter reaches the max cycle
  static frameSequencer: u8 = 0x00;

  // Our current sample number we are passing back to the wasmboy memory map
  // Going to pass back 4096 samples and then reset
  // NOTE: Giving a really large sample rate gives more latency, but less pops!
  static readonly MAX_NUMBER_OF_SAMPLES: i32 = 4096;
  static audioQueueIndex: i32 = 0x0000;

  // Save States
  static readonly saveStateSlot: u16 = 6;

  // Function to save the state of the class
  static saveState(): void {
    store<i32>(getSaveStateMemoryOffset(0x00, Sound.saveStateSlot), Sound.frameSequenceCycleCounter);
    store<u8>(getSaveStateMemoryOffset(0x04, Sound.saveStateSlot), Sound.downSampleCycleCounter);
    store<u8>(getSaveStateMemoryOffset(0x05, Sound.saveStateSlot), Sound.frameSequencer);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Sound.frameSequenceCycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Sound.saveStateSlot));
    Sound.downSampleCycleCounter = load<u8>(getSaveStateMemoryOffset(0x04, Sound.saveStateSlot));
    Sound.frameSequencer = load<u8>(getSaveStateMemoryOffset(0x05, Sound.saveStateSlot));

    resetAudioQueue();
  }
}

// Initialize sound registers
// From: https://emu-docs.org/Game%20Boy/gb_sound.txt
export function initializeSound(): void {

  // intiialize our channels
  Channel1.initialize();
  Channel2.initialize();
  Channel3.initialize();
  Channel4.initialize();

  // Other Sound Registers
  eightBitStoreIntoGBMemory(Sound.memoryLocationNR50, 0x77);
  eightBitStoreIntoGBMemory(Sound.memoryLocationNR51, 0xF3);
  eightBitStoreIntoGBMemory(Sound.memoryLocationNR52, 0xF1);
}

// Function for updating sound
export function updateSound(numberOfCycles: u8): void {
  // APU runs at 4194304 / 512
  // Or Cpu.clockSpeed / 512
  // Which means, we need to update once every 8192 cycles :)
  Sound.frameSequenceCycleCounter += <i32>numberOfCycles;
  if(Sound.frameSequenceCycleCounter >= Sound.maxFrameSequenceCycles) {
    // Reset the frameSequenceCycleCounter
    // Not setting to zero as we do not want to drop cycles
    Sound.frameSequenceCycleCounter -= Sound.maxFrameSequenceCycles;

    // Check our frame sequencer
    // TODO: uncomment
    // https://gist.github.com/drhelius/3652407
    if (Sound.frameSequencer === 0) {
      // Update Length on Channels
      Channel1.updateLength();
      Channel2.updateLength();
      Channel3.updateLength();
      Channel4.updateLength();
    } /* Do Nothing on one */ else if(Sound.frameSequencer === 2) {
      // Update Sweep and Length on Channels
      Channel1.updateLength();
      Channel2.updateLength();
      Channel3.updateLength();
      Channel4.updateLength();

      Channel1.updateSweep();
    } /* Do Nothing on three */ else if(Sound.frameSequencer === 4) {
      // Update Length on Channels
      Channel1.updateLength();
      Channel2.updateLength();
      Channel3.updateLength();
      Channel4.updateLength();
    } /* Do Nothing on three */ else if(Sound.frameSequencer === 6) {
      // Update Sweep and Length on Channels
      Channel1.updateLength();
      Channel2.updateLength();
      Channel3.updateLength();
      Channel4.updateLength();

      Channel1.updateSweep();
    } else if(Sound.frameSequencer === 7) {
      // Update Envelope on channels
      Channel1.updateEnvelope();
      Channel2.updateEnvelope();
      Channel4.updateEnvelope();
    }

    // Update our frame sequencer
    Sound.frameSequencer += 1;
    if(Sound.frameSequencer >= 8) {
      Sound.frameSequencer = 0;
    }
  }

  // Update all of our channels
  // All samples will be returned as 0 to 30
  // 0 being -1.0, and 30 being 1.0
  // (see blurb at top)
  let channel1Sample: i32 = Channel1.getSample(numberOfCycles);
  let channel2Sample: i32 = Channel2.getSample(numberOfCycles);
  let channel3Sample: i32 = Channel3.getSample(numberOfCycles);
  let channel4Sample: i32 = Channel4.getSample(numberOfCycles);

  // Do Some downsampling magic
  Sound.downSampleCycleCounter += numberOfCycles;
  if(Sound.downSampleCycleCounter >= Sound.maxDownSampleCycles) {

    // Reset the downsample counter
    // Don't set to zero to catch overflowed cycles
    Sound.downSampleCycleCounter -= Sound.maxDownSampleCycles;

    // Do Some Cool mixing
    // NR50 FF24 ALLL BRRR Vin L enable, Left vol, Vin R enable, Right vol
    // NR51 FF25 NW21 NW21 Left enables, Right enables
    // NR52 FF26 P--- NW21 Power control/status, Channel length statuses
    // NW21 = 4 bits on byte
    // 3 -> Channel 4, 2 -> Channel 3, 1 -> Channel 2, 0 -> Channel 1

    // Matt's Proccess
    // I push out 1024 samples at a time and use 96000 hz sampling rate, so I guess i'm a bit less than one frame,
    // but I let the queue fill up with 4 x 1024 samples before I start waiting for the audio

    // TODO: Vin Mixing

    // Simply get the left/right volume, add up the values, and put into memory!
    let registerNR50 = eightBitLoadFromGBMemory(Sound.memoryLocationNR50);
    // Want bits 6-4
    let leftMixerVolume: i32 = (registerNR50 >> 4);
    leftMixerVolume = leftMixerVolume & 0x07;
    // Want bits 0-2
    let rightMixerVolume: i32 = registerNR50;
    rightMixerVolume = rightMixerVolume & 0x07;

    // cache channel numbers for performance
    let channel1ChannelNumber: i32 = Channel1.channelNumber;
    let channel2ChannelNumber: i32 = Channel2.channelNumber;
    let channel3ChannelNumber: i32 = Channel3.channelNumber;
    let channel4ChannelNumber: i32 = Channel4.channelNumber;

    // Get our channel volume for left/right
    let leftChannelSample: i32 = 0;
    let rightChannelSample: i32 = 0;

    // Find the sample for the left if enabled
    // other wise add silence (15) for the channel
    if (isChannelEnabledOnLeftOutput(channel1ChannelNumber)) {
      leftChannelSample += channel1Sample;
    } else {
      leftChannelSample += 15;
    }
    if (isChannelEnabledOnLeftOutput(channel2ChannelNumber)) {
      leftChannelSample += channel2Sample;
    } else {
      leftChannelSample += 15;
    }
    if (isChannelEnabledOnLeftOutput(channel3ChannelNumber)) {
      leftChannelSample += channel3Sample;
    } else {
      leftChannelSample += 15;
    }
    if (isChannelEnabledOnLeftOutput(channel4ChannelNumber)) {
      leftChannelSample += channel4Sample;
    } else {
      leftChannelSample += 15;
    }


    // Find the sample for the right if enabled
    // other wise add silence (15) for the channel
    if (isChannelEnabledOnRightOutput(channel1ChannelNumber)) {
      rightChannelSample += channel1Sample;
    } else {
      rightChannelSample += 15;
    }
    if (isChannelEnabledOnRightOutput(channel2ChannelNumber)) {
      rightChannelSample += channel2Sample;
    } else {
      rightChannelSample += 15;
    }
    if (isChannelEnabledOnRightOutput(channel3ChannelNumber)) {
      rightChannelSample += channel3Sample;
    } else {
      rightChannelSample += 15;
    }
    if (isChannelEnabledOnRightOutput(channel4ChannelNumber)) {
      rightChannelSample += channel4Sample;
    } else {
      rightChannelSample += 15;
    }

    // Finally multiply our volumes by the mixer volume
    // Mixer volume can be at most 7 + 1
    // Can be at most 7, because we only have 3 bits, 111 = 7
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Mixer
    //leftChannelSample = leftChannelSample * (leftMixerVolume + 1);
    //rightChannelSample = rightChannelSample * (rightMixerVolume + 1);

    // Convert our samples from unsigned 32 to unsigned byte
    // Reason being, We want to be able to pass in wasm memory as usigned byte. Javascript will handle the conversion back
    let leftChannelSampleUnsignedByte: u8 = getSampleAsUnsignedByte(leftChannelSample, (leftMixerVolume + 1));
    let rightChannelSampleUnsignedByte: u8 = getSampleAsUnsignedByte(rightChannelSample, (rightMixerVolume + 1));

    // Set our volumes in memory
    // +1 so it can not be zero
    setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, Sound.audioQueueIndex);
    Sound.audioQueueIndex += 1;

    // Don't allow our audioQueueIndex to overflow into other parts of the wasmBoy memory map
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0
    // Not 0xFFFF because we need half of 64kb since we store left and right channel
    if(Sound.audioQueueIndex >= (0xFFFF / 2) - 1) {
      resetAudioQueue();
    }
  }
}

// Funciton to get the current Audio Queue index
export function getAudioQueueIndex(): i32 {
  return Sound.audioQueueIndex;
}

// Function to reset the audio queue
export function resetAudioQueue(): void {
  Sound.audioQueueIndex = 0;
}

function getSampleAsUnsignedByte(sample: i32, mixerVolume: i32): u8 {

  // If the sample is silence, return silence as unsigned byte
  // Silence is common, and should be checked for performance
  if(sample === 60) {
    return 127;
  }

  // convert to a signed, precise scale of -6000 to 6000 (cheap way of -1.0 to 1.0)
  // Multiply by the mixer volume fraction (to find the actual volume)
  let precision: i32 = 100000;
  let convertedSample: i32 = sample - 60;
  convertedSample = convertedSample * precision;

  // Multiply by the mixer volume fraction (to find the actual volume)
  convertedSample = convertedSample * mixerVolume / 8;

  // Convert back to scale of 0 to 120
  convertedSample = convertedSample / precision;
  convertedSample = convertedSample + 60;

  // Finally, convert to an unsigned byte scale
  // With Four Channels (0 to 30) and no global volume. Max is 120
  // max unsigned byte goal is 254 (see blurb at top).
  // 120 / 254 should give the correct conversion
  // For example, 120 / 254 = 0.47244094488188976
  // Multiply by 1000 to increase the float into an int
  // so, 120 * 1000 / (0.47244094488188976 * 1000) should give approximate answer for max mixer volume
  let maxDivider: i32 = (120 * precision) / 254;
  convertedSample = (convertedSample * precision) / maxDivider;

  return <u8>(convertedSample);
}
