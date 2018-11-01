// https://emu-docs.org/Game%20Boy/gb_sound.txt
// https://www.youtube.com/watch?v=HyzD8pNlpwI
// https://gist.github.com/drhelius/3652407

// For our wasm -> JS, we will be passing in our -1.0 to 1.0 volume
// As an unsigned byte. Each channel will give 0 (representing -1.0), to
// 30 (representing 1.0), and will be added together. in the fucntion
// getSampleAsUnsignedByte() will do the conversion of getting the total
// of all the channels, times the (mixer volume + 1), to give us an unsigned
// byte from 0 (-1.0) to 254 (1.0)
import { AUDIO_BUFFER_LOCATION } from '../constants';
import { getSaveStateMemoryOffset } from '../core';
import { SoundAccumulator, initializeSoundAccumulator, accumulateSound } from './accumulator';
import { Channel1 } from './channel1';
import { Channel2 } from './channel2';
import { Channel3 } from './channel3';
import { Channel4 } from './channel4';
import { Cpu } from '../cpu/index';
import { Config } from '../config';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { checkBitOnByte, concatenateBytes, splitLowByte, splitHighByte, hexLog, performanceTimestamp } from '../helpers/index';
import { i32Portable } from '../portable/portable';

export class Sound {
  // Current cycles
  // This will be used for batch processing
  // https://github.com/binji/binjgb/commit/e028f45e805bc0b0aa4697224a209f9ae514c954
  // TODO: May Also need to do this for Reads
  static currentCycles: i32 = 0;

  // Number of cycles to run in each batch process
  // This number should be in sync so that sound doesn't run too many cyles at once
  // and does not exceed the minimum number of cyles for either down sampling, or
  // How often we change the frame, or a channel's update process
  static batchProcessCycles(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      return 174;
    }

    return 87;
  }

  // Channel control / On-OFF / Volume (RW)
  static readonly memoryLocationNR50: i32 = 0xff24;
  static NR50LeftMixerVolume: i32 = 0;
  static NR50RightMixerVolume: i32 = 0;
  static updateNR50(value: i32): void {
    Sound.NR50LeftMixerVolume = (value >> 4) & 0x07;
    Sound.NR50RightMixerVolume = value & 0x07;
  }

  // 0xFF25 selects which output each channel goes to, Referred to as NR51
  static readonly memoryLocationNR51: i32 = 0xff25;
  static NR51IsChannel1EnabledOnLeftOutput: boolean = true;
  static NR51IsChannel2EnabledOnLeftOutput: boolean = true;
  static NR51IsChannel3EnabledOnLeftOutput: boolean = true;
  static NR51IsChannel4EnabledOnLeftOutput: boolean = true;
  static NR51IsChannel1EnabledOnRightOutput: boolean = true;
  static NR51IsChannel2EnabledOnRightOutput: boolean = true;
  static NR51IsChannel3EnabledOnRightOutput: boolean = true;
  static NR51IsChannel4EnabledOnRightOutput: boolean = true;
  static updateNR51(value: i32): void {
    Sound.NR51IsChannel4EnabledOnLeftOutput = checkBitOnByte(7, value);
    Sound.NR51IsChannel3EnabledOnLeftOutput = checkBitOnByte(6, value);
    Sound.NR51IsChannel2EnabledOnLeftOutput = checkBitOnByte(5, value);
    Sound.NR51IsChannel1EnabledOnLeftOutput = checkBitOnByte(4, value);
    Sound.NR51IsChannel4EnabledOnRightOutput = checkBitOnByte(3, value);
    Sound.NR51IsChannel3EnabledOnRightOutput = checkBitOnByte(2, value);
    Sound.NR51IsChannel2EnabledOnRightOutput = checkBitOnByte(1, value);
    Sound.NR51IsChannel1EnabledOnRightOutput = checkBitOnByte(0, value);
  }

  // Sound on/off
  static readonly memoryLocationNR52: i32 = 0xff26;
  static NR52IsSoundEnabled: boolean = true;
  static updateNR52(value: i32): void {
    Sound.NR52IsSoundEnabled = checkBitOnByte(7, value);
  }

  // $FF30 -- $FF3F is the load register space for the 4-bit samples for channel 3
  static readonly memoryLocationChannel3LoadRegisterStart: i32 = 0xff30;

  // Need to count how often we need to increment our frame sequencer
  // Which you can read about below
  static frameSequenceCycleCounter: i32 = 0x0000;
  static maxFrameSequenceCycles(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      return 16384;
    }

    return 8192;
  }

  // Also need to downsample our audio to average audio qualty
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
  // Want to do 48000hz, so CpuRate / Sound Rate, 4194304 / 48000 ~ 87 cycles
  static downSampleCycleCounter: i32 = 0x00;
  static downSampleCycleMultiplier: i32 = 48000;
  static maxDownSampleCycles(): i32 {
    return Cpu.CLOCK_SPEED();
  }

  // Frame sequencer controls what should be updated and and ticked
  // Everyt time the sound is updated :) It is updated everytime the
  // Cycle counter reaches the max cycle
  static frameSequencer: i32 = 0x00;

  // Our current sample number we are passing back to the wasmboy memory map
  // Found that a static number of samples doesn't work well on mobile
  // Will just update the queue index, grab as much as we can whenever we need more audio, then reset
  // NOTE: Giving a really large sample rate gives more latency, but less pops!
  //static readonly MAX_NUMBER_OF_SAMPLES: i32 = 4096;
  static audioQueueIndex: i32 = 0x0000;
  static wasmBoyMemoryMaxBufferSize: i32 = 0x20000;

  // Save States
  static readonly saveStateSlot: i32 = 6;

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

    clearAudioBuffer();
  }
}

// Initialize sound registers
// From: https://emu-docs.org/Game%20Boy/gb_sound.txt
export function initializeSound(): void {
  // Reset Stateful variables
  Sound.currentCycles = 0;
  Sound.NR50LeftMixerVolume = 0;
  Sound.NR50RightMixerVolume = 0;
  Sound.NR51IsChannel1EnabledOnLeftOutput = true;
  Sound.NR51IsChannel2EnabledOnLeftOutput = true;
  Sound.NR51IsChannel3EnabledOnLeftOutput = true;
  Sound.NR51IsChannel4EnabledOnLeftOutput = true;
  Sound.NR51IsChannel1EnabledOnRightOutput = true;
  Sound.NR51IsChannel2EnabledOnRightOutput = true;
  Sound.NR51IsChannel3EnabledOnRightOutput = true;
  Sound.NR51IsChannel4EnabledOnRightOutput = true;
  Sound.NR52IsSoundEnabled = true;
  Sound.frameSequenceCycleCounter = 0x0000;
  Sound.downSampleCycleCounter = 0x00;
  Sound.frameSequencer = 0x00;
  Sound.audioQueueIndex = 0x0000;

  // intiialize our channels
  Channel1.initialize();
  Channel2.initialize();
  Channel3.initialize();
  Channel4.initialize();

  // Other Sound Registers
  eightBitStoreIntoGBMemory(Sound.memoryLocationNR50, 0x77);
  eightBitStoreIntoGBMemory(Sound.memoryLocationNR51, 0xf3);
  eightBitStoreIntoGBMemory(Sound.memoryLocationNR52, 0xf1);

  initializeSoundAccumulator();
}

// Function to batch process our audio after we skipped so many cycles
export function batchProcessAudio(): void {
  if (Sound.currentCycles < Sound.batchProcessCycles()) {
    return;
  }

  while (Sound.currentCycles >= Sound.batchProcessCycles()) {
    updateSound(Sound.batchProcessCycles());
    Sound.currentCycles = Sound.currentCycles - Sound.batchProcessCycles();
  }
}

// Function for updating sound
export function updateSound(numberOfCycles: i32): void {
  // Check if our frameSequencer updated
  let frameSequencerUpdated: boolean = updateFrameSequencer(numberOfCycles);

  if (Config.audioAccumulateSamples && !frameSequencerUpdated) {
    accumulateSound(numberOfCycles);
  } else {
    calculateSound(numberOfCycles);
  }
}

// Funciton to get the current Audio Queue index
export function getNumberOfSamplesInAudioBuffer(): i32 {
  return Sound.audioQueueIndex;
}

// Function to reset the audio queue
export function clearAudioBuffer(): void {
  Sound.audioQueueIndex = 0;
}

function calculateSound(numberOfCycles: i32): void {
  // Update all of our channels
  // All samples will be returned as 0 to 30
  // 0 being -1.0, and 30 being 1.0
  // (see blurb at top)
  let channel1Sample: i32 = Channel1.getSample(numberOfCycles);
  let channel2Sample: i32 = Channel2.getSample(numberOfCycles);
  let channel3Sample: i32 = Channel3.getSample(numberOfCycles);
  let channel4Sample: i32 = Channel4.getSample(numberOfCycles);
  // TODO: Allow individual channels to be muted
  // let channel1Sample: i32 = 15;
  // let channel2Sample: i32 = 15;
  // let channel3Sample: i32 = 15;
  // let channel4Sample: i32 = 15;

  // Save the samples in the accumulator
  SoundAccumulator.channel1Sample = channel1Sample;
  SoundAccumulator.channel2Sample = channel2Sample;
  SoundAccumulator.channel3Sample = channel3Sample;
  SoundAccumulator.channel4Sample = channel4Sample;

  // Do Some downsampling magic
  Sound.downSampleCycleCounter += numberOfCycles * Sound.downSampleCycleMultiplier;
  if (Sound.downSampleCycleCounter >= Sound.maxDownSampleCycles()) {
    // Reset the downsample counter
    // Don't set to zero to catch overflowed cycles
    Sound.downSampleCycleCounter -= Sound.maxDownSampleCycles();

    // Mixe our samples
    let mixedSample: i32 = mixChannelSamples(channel1Sample, channel2Sample, channel3Sample, channel4Sample);
    let leftChannelSampleUnsignedByte: i32 = splitHighByte(mixedSample);
    let rightChannelSampleUnsignedByte: i32 = splitLowByte(mixedSample);

    // Set our volumes in memory
    // +1 so it can not be zero
    setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, Sound.audioQueueIndex);
    Sound.audioQueueIndex += 1;

    // Don't allow our audioQueueIndex to overflow into other parts of the wasmBoy memory map
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0
    // Not 0xFFFF because we need half of 64kb since we store left and right channel
    if (Sound.audioQueueIndex >= Sound.wasmBoyMemoryMaxBufferSize / 2 - 1) {
      Sound.audioQueueIndex -= 1;
    }
  }
}

function updateFrameSequencer(numberOfCycles: i32): boolean {
  // APU runs at 4194304 / 512
  // Or Cpu.clockSpeed / 512
  // Which means, we need to update once every 8192 cycles :)
  Sound.frameSequenceCycleCounter += numberOfCycles;
  if (Sound.frameSequenceCycleCounter >= Sound.maxFrameSequenceCycles()) {
    // Reset the frameSequenceCycleCounter
    // Not setting to zero as we do not want to drop cycles
    Sound.frameSequenceCycleCounter -= Sound.maxFrameSequenceCycles();

    // Check our frame sequencer
    // https://gist.github.com/drhelius/3652407
    switch (Sound.frameSequencer) {
      case 0:
        // Update Length on Channels
        Channel1.updateLength();
        Channel2.updateLength();
        Channel3.updateLength();
        Channel4.updateLength();
        break;
      /* Do Nothing on one */
      case 2:
        // Update Sweep and Length on Channels
        Channel1.updateLength();
        Channel2.updateLength();
        Channel3.updateLength();
        Channel4.updateLength();

        Channel1.updateSweep();
        break;
      /* Do Nothing on three */
      case 4:
        // Update Length on Channels
        Channel1.updateLength();
        Channel2.updateLength();
        Channel3.updateLength();
        Channel4.updateLength();
        break;
      /* Do Nothing on five */
      case 6:
        // Update Sweep and Length on Channels
        Channel1.updateLength();
        Channel2.updateLength();
        Channel3.updateLength();
        Channel4.updateLength();

        Channel1.updateSweep();
        break;
      case 7:
        // Update Envelope on channels
        Channel1.updateEnvelope();
        Channel2.updateEnvelope();
        Channel4.updateEnvelope();
        break;
    }

    // Update our frame sequencer
    Sound.frameSequencer += 1;
    if (Sound.frameSequencer >= 8) {
      Sound.frameSequencer = 0;
    }

    return true;
  }

  return false;
}

export function mixChannelSamples(
  channel1Sample: i32 = 15,
  channel2Sample: i32 = 15,
  channel3Sample: i32 = 15,
  channel4Sample: i32 = 15
): i32 {
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

  SoundAccumulator.mixerVolumeChanged = false;

  // Get our channel volume for left/right
  let leftChannelSample: i32 = 0;
  let rightChannelSample: i32 = 0;

  // Find the sample for the left if enabled
  // other wise add silence (15) for the channel
  if (Sound.NR51IsChannel1EnabledOnLeftOutput) {
    leftChannelSample += channel1Sample;
  } else {
    leftChannelSample += 15;
  }
  if (Sound.NR51IsChannel2EnabledOnLeftOutput) {
    leftChannelSample += channel2Sample;
  } else {
    leftChannelSample += 15;
  }
  if (Sound.NR51IsChannel3EnabledOnLeftOutput) {
    leftChannelSample += channel3Sample;
  } else {
    leftChannelSample += 15;
  }
  if (Sound.NR51IsChannel4EnabledOnLeftOutput) {
    leftChannelSample += channel4Sample;
  } else {
    leftChannelSample += 15;
  }

  // Find the sample for the right if enabled
  // other wise add silence (15) for the channel
  if (Sound.NR51IsChannel1EnabledOnRightOutput) {
    rightChannelSample += channel1Sample;
  } else {
    rightChannelSample += 15;
  }
  if (Sound.NR51IsChannel2EnabledOnRightOutput) {
    rightChannelSample += channel2Sample;
  } else {
    rightChannelSample += 15;
  }
  if (Sound.NR51IsChannel3EnabledOnRightOutput) {
    rightChannelSample += channel3Sample;
  } else {
    rightChannelSample += 15;
  }
  if (Sound.NR51IsChannel4EnabledOnRightOutput) {
    rightChannelSample += channel4Sample;
  } else {
    rightChannelSample += 15;
  }

  // Update our accumulator
  SoundAccumulator.mixerEnabledChanged = false;
  SoundAccumulator.needToRemixSamples = false;

  // Finally multiply our volumes by the mixer volume
  // Mixer volume can be at most 7 + 1
  // Can be at most 7, because we only have 3 bits, 111 = 7
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Mixer
  // Done in the getSampleAsUnsignedByte(), since we are doing some weirdness there :)

  // Convert our samples from unsigned 32 to unsigned byte
  // Reason being, We want to be able to pass in wasm memory as usigned byte. Javascript will handle the conversion back
  let leftChannelSampleUnsignedByte: i32 = getSampleAsUnsignedByte(leftChannelSample, Sound.NR50LeftMixerVolume + 1);
  let rightChannelSampleUnsignedByte: i32 = getSampleAsUnsignedByte(rightChannelSample, Sound.NR50RightMixerVolume + 1);

  // Save these samples in the accumulator
  SoundAccumulator.leftChannelSampleUnsignedByte = leftChannelSampleUnsignedByte;
  SoundAccumulator.rightChannelSampleUnsignedByte = rightChannelSampleUnsignedByte;

  return concatenateBytes(leftChannelSampleUnsignedByte, rightChannelSampleUnsignedByte);
}

function getSampleAsUnsignedByte(sample: i32, mixerVolume: i32): i32 {
  // If the sample is silence, return silence as unsigned byte
  // Silence is common, and should be checked for performance
  if (sample === 60) {
    return 127;
  }

  // convert to a signed, precise scale of -6000 to 6000 (cheap way of -1.0 to 1.0)
  // Multiply by the mixer volume fraction (to find the actual volume)
  let precision: i32 = 100000;
  let convertedSample: i32 = sample - 60;
  convertedSample = convertedSample * precision;

  // Multiply by the mixer volume fraction (to find the actual volume)
  convertedSample = (convertedSample * mixerVolume) / 8;

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

  // Ensure we have an i32 and not a float for JS builds
  convertedSample = i32Portable(convertedSample);

  return convertedSample;
}

// Function to set our left and right channels at the correct queue index
export function setLeftAndRightOutputForAudioQueue(leftVolume: i32, rightVolume: i32, audioQueueIndex: i32): void {
  // Get our stereo index
  let audioQueueOffset = AUDIO_BUFFER_LOCATION + audioQueueIndex * 2;

  // Store our volumes
  // +1 that way we don't have empty data to ensure that the value is set
  store<u8>(audioQueueOffset, <u8>(leftVolume + 1));
  store<u8>(audioQueueOffset + 1, <u8>(rightVolume + 1));
}
