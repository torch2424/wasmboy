// https://emu-docs.org/Game%20Boy/gb_sound.txt
// https://www.youtube.com/watch?v=HyzD8pNlpwI
// https://gist.github.com/drhelius/3652407

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
  setLeftAndRightOutputForAudioQueue
} from '../memory/index';
import {
  hexLog
} from '../helpers/index';

export class Sound {

  // Channel control / On-OFF / Volume (RW)
  static memoryLocationNR50: u16 = 0xFF24;

  // 0xFF25 selects which output each channel goes to, Referred to as NR51
  static memoryLocationNR51: u16 = 0xFF25;

  // Sound on/off
  static memoryLocationNR52: u16 = 0xFF26;

  // $FF30 -- $FF3F is the load register space for the 4-bit samples for channel 3
  static memoryLocationChannel3LoadRegisterStart: u16 = 0xFF30;

  // Need to count how often we need to increment our frame sequencer
  // Which you can read about below
  static frameSequenceCycleCounter: i16 = 0x0000;
  static maxFrameSequenceCycles: i16 = 8192;

  // Also need to downsample our audio to average audio qualty
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
  // Want to do 48000hz, so CpuRate / Sound Rate, 4194304 / 48000 ~ 87 cycles
  static downSampleCycleCounter: u8 = 0x00;
  static maxDownSampleCycles: u8 = 87;

  // Frame sequencer controls what should be updated and and ticked
  // Everyt time the sound is updated :) It is updated everytime the
  // Cycle counter reaches the max cycle
  static frameSequencer: u8 = 0x00;

  // Our current sample umber we are passing back to the wasmboy memory map
  // Going to pass back 4096 samples and then reset
  static audioQueueIndex: u32 = 0x0000;
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
  Sound.frameSequenceCycleCounter += <i16>numberOfCycles;
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
  let channel1Sample: u32 = Channel1.getSample(numberOfCycles);
  let channel2Sample: u32 = Channel2.getSample(numberOfCycles);
  let channel3Sample: u32 = Channel3.getSample(numberOfCycles);
  let channel4Sample: u32 = Channel4.getSample(numberOfCycles);

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
    let leftMixerVolume: u8 = (registerNR50 >> 4);
    leftMixerVolume = leftMixerVolume & 0x07;
    // Want bits 0-2
    let rightMixerVolume: u8 = registerNR50;
    rightMixerVolume = rightMixerVolume & 0x07;

    // Get our channel volume for left/right
    let leftChannelSample: u32 = 0;
    let rightChannelSample: u32 = 0;

    // Find the channel for the left volume
    if (isChannelEnabledOnLeftOutput(Channel1.channelNumber)) {
      leftChannelSample += channel1Sample;
    }
    if (isChannelEnabledOnLeftOutput(Channel2.channelNumber)) {
      leftChannelSample += channel2Sample;
    }
    if (isChannelEnabledOnLeftOutput(Channel3.channelNumber)) {
      leftChannelSample += channel3Sample;
    }
    if (isChannelEnabledOnLeftOutput(Channel4.channelNumber)) {
      leftChannelSample += channel4Sample;
    }


    // Find the channel for the right volume
    // TODO: Other Channels
    if (isChannelEnabledOnRightOutput(Channel1.channelNumber)) {
      rightChannelSample += channel1Sample;
    }
    if (isChannelEnabledOnRightOutput(Channel2.channelNumber)) {
      rightChannelSample += channel2Sample;
    }
    if (isChannelEnabledOnRightOutput(Channel3.channelNumber)) {
      rightChannelSample += channel3Sample;
    }
    if (isChannelEnabledOnRightOutput(Channel4.channelNumber)) {
      rightChannelSample += channel4Sample;
    }

    // Finally multiple our volumes by the mixer volume
    // Mixer volume can be at most 7 + 1
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Mixer
    // TODO: Came out wrong and sounds weird
    //leftChannelSample = leftChannelSample * (leftMixerVolume + 1);
    //rightChannelSample = rightChannelSample * (rightMixerVolume + 1);

    // Convert our samples from unsigned 32 to unsigned byte
    // Reason being, We want to be able to pass in wasm memory as usigned byte. Javascript will handle the conversion back
    let leftChannelSampleUnsignedByte: u8 = getSampleAsUnsignedByte(leftChannelSample);
    let rightChannelSampleUnsignedByte: u8 = getSampleAsUnsignedByte(rightChannelSample);

    // Set our volumes in memory
    // +1 so it can not be zero
    setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, Sound.audioQueueIndex);
    Sound.audioQueueIndex += 1;
  }
}

// Funciton to get the current Audio Queue index
export function getAudioQueueIndex(): u32 {
  return Sound.audioQueueIndex;
}

// Function to reset the audio queue
export function resetAudioQueue(): void {
  Sound.audioQueueIndex = 0;
}

function getSampleAsUnsignedByte(sample: u32): u8 {
  // With Four Channels (0 to 30) and no global volume. Max is 120, goal is 254. 120 * 2.1167 should give approximate answer
  let adjustedSample: u32 = sample * 21 / 10;
  let convertedSample: u8 = <u8>adjustedSample;
  return convertedSample;
}

function getSampleAsUnsignedByteForSingleChannel(sample: u32): u8 {
  // With One Channels (0 to 30) and no global volume. Max is 30, goal is 254. 30 * 8.4 should give approximate answer
  let adjustedSample: u32 = sample * 84 / 10;
  let convertedSample: u8 = <u8>adjustedSample;
  return convertedSample;
}
