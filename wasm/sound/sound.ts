// https://emu-docs.org/Game%20Boy/gb_sound.txt
// https://www.youtube.com/watch?v=HyzD8pNlpwI
// https://gist.github.com/drhelius/3652407

// TODO: Memory management for Sound registers

import {
  updateSquareChannel,
  updateSquareChannelSweep,
  updateSquareChannelsLengths,
  updateSquareChannelsEnvelopes
} from './square';
import {
  isChannelEnabledOnLeftOutput,
  isChannelEnabledOnRightOutput
} from './register';
import {
  Cpu
} from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  setLeftAndRightOutputForAudioQueue
} from '../memory/index';
import {
  consoleLog,
  consoleLogTwo
} from '../helpers/index';

export class Sound {
  //Channel 1
  // Squarewave channel with volume envelope and frequency sweep functions.
  // NR10 -> Sweep Register R/W
  static memoryLocationNR10: u16 = 0xFF10;
  // NR11 -> Sound length/Wave pattern duty (R/W)
  static memoryLocationNR11: u16 = 0xFF11;
  // NR12 -> Volume Envelope (R/W)
  static memoryLocationNR12: u16 = 0xFF12;
  // NR13 -> Frequency lo (W)
  static memoryLocationNR13: u16 = 0xFF13;
  // NR14 -> Frequency hi (R/W)
  static memoryLocationNR14: u16 = 0xFF14;

  // Channel 2
  // Squarewave channel with volume envelope functions only.
  // NR21 -> Sound length/Wave pattern duty (R/W)
  static memoryLocationNR21: u16 = 0xFF16;
  // NR22 -> Volume Envelope (R/W)
  static memoryLocationNR22: u16 = 0xFF17;
  // NR23 -> Frequency lo (W)
  static memoryLocationNR23: u16 = 0xFF18;
  // NR24 -> Frequency hi (R/W)
  static memoryLocationNR24: u16 = 0xFF19;

  // Channel 3
  // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
  // NR30 -> Sound on/off (R/W)
  static memoryLocationNR30: u16 = 0xFF1A;
  // NR31 -> Sound length (R/W)
  static memoryLocationNR31: u16 = 0xFF1B;
  // NR32 -> Select ouput level (R/W)
  static memoryLocationNR32: u16 = 0xFF1C;
  // NR33 -> Frequency lower data (W)
  static memoryLocationNR33: u16 = 0xFF1D;
  // NR34 -> Frequency higher data (R/W)
  static memoryLocationNR34: u16 = 0xFF1E;

  // Channel 4
  // 'white noise' channel with volume envelope functions.
  // NR41 -> Sound length (R/W)
  static memoryLocationNR41: u16 = 0xFF20;
  // NR42 -> Volume Envelope (R/W)
  static memoryLocationNR42: u16 = 0xFF21;
  // NR43 -> Polynomial Counter (R/W)
  static memoryLocationNR43: u16 = 0xFF22;
  // NR43 -> Counter/consecutive; initial (R/W)
  static memoryLocationNR44: u16 = 0xFF23;

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
  static frameSequenceCycleCounter: u16 = 0x0000;
  static maxFrameSequenceCycles: u16 = 8192;

  // Also need to downsample our audio to average audio qualty
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
  // Want to do 48000hz, so CpuRate / Sound Rate ~ 87 cycles
  static downSampleCycleCounter: u8 = 0x00;
  static maxDownSampleCycles: u8 = 87;

  // Frame sequencer controls what should be updated and and ticked
  // Everyt time the sound is updated :) It is updated everytime the
  // Cycle counter reaches the max cycle
  static frameSequencer: u8 = 0x00;

  // Our current sample umber we are passing back to the wasmboy memory map
  static audioQueueIndex: u8 = 0x00;
}

// Function for updating sound
export function updateSound(numberOfCycles: u8): void {
  // APU runs at 4194304 / 512
  // Or Cpu.clockSpeed / 512
  // Which means, we need to update once every 8192 cycles :)
  Sound.frameSequenceCycleCounter += <u16>numberOfCycles;
  if(Sound.frameSequenceCycleCounter >= Sound.maxFrameSequenceCycles) {
    Sound.frameSequenceCycleCounter = 0;

    // Check our frame sequencer
    // https://gist.github.com/drhelius/3652407
    if (Sound.frameSequencer === 0) {
      // Update Length on Channels
      updateSquareChannelsLengths();
    } /* Do Nothing on one */ else if(Sound.frameSequencer === 2) {
      // Update Sweep and Length on Channels
      updateSquareChannelSweep();
      updateSquareChannelsLengths();
    } /* Do Nothing on three */ else if(Sound.frameSequencer === 4) {
      // Update Length on Channels
      updateSquareChannelsLengths();
    } /* Do Nothing on three */ else if(Sound.frameSequencer === 6) {
      // Update Sweep and Length on Channels
      updateSquareChannelSweep();
      updateSquareChannelsLengths();
    } else if(Sound.frameSequencer === 7) {
      // Update Envelope on channels
      updateSquareChannelsEnvelopes();
    }

    // Update our frame sequencer
    Sound.frameSequencer += 1;
    if(Sound.frameSequencer >= 8) {
      Sound.frameSequencer = 0;
    }
  }

  // Update all of our channels
  // Volume is a value between 0 (super negative and loud af) and 15 (super positive and loud af)
  // Setting to an i8, that way  we can do some fun stuff like sub tract 7 to get the actual volume modifier
  let channel1Sample: i8 = updateSquareChannel(1);
  let channel2Sample: i8 = updateSquareChannel(2);

  // Do Some downsampling magic
  Sound.downSampleCycleCounter += numberOfCycles;
  if(Sound.downSampleCycleCounter >= Sound.maxDownSampleCycles) {
    Sound.downSampleCycleCounter = 0;

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
    let leftChannelSample: i8 = 0;
    let rightChannelSample: i8 = 0;

    // Find the channel for the left volume
    // TODO: Other Channels
    if (isChannelEnabledOnLeftOutput(1)) {
      leftChannelSample += channel1Sample;
    }
    if(isChannelEnabledOnLeftOutput(2)) {
      // TODO
      //leftChannelVolume += channel2OutputVolumeModifier;
    }

    // Find the channel for the right volume
    // TODO: Other Channels
    if (isChannelEnabledOnRightOutput(1)) {
      rightChannelSample += channel1Sample;
    }
    if(isChannelEnabledOnRightOutput(2)) {
      rightChannelSample += channel2Sample;
    }

    // TODO: Clip our volumes to -7 and 7, or something like that

    // Finally multiple our volumes by the mixer volume
    //TODO

    // Set our volumes in memory
    // TODO: Right CHannel
    setLeftAndRightOutputForAudioQueue(<u8>leftChannelSample + 7, 7, Sound.audioQueueIndex);
    Sound.audioQueueIndex += 1;

    // We want out audio queue to be as large as a frame, therefore reset the audioQueueIndex when Cpu.current cycles exceeds the max cycles
    if((Cpu.currentCycles + numberOfCycles) >= Cpu.MAX_CYCLES_PER_FRAME) {
      Sound.audioQueueIndex = 0;
    }
  }
}
