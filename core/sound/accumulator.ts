import { Sound, mixChannelSamples, setLeftAndRightOutputForAudioQueue } from './sound';
import { Channel1 } from './channel1';
import { Channel2 } from './channel2';
import { Channel3 } from './channel3';
import { Channel4 } from './channel4';

// Another class simply for accumulating samples
// Default everything to silence
export class SoundAccumulator {
  static channel1Sample: i32 = 15;
  static channel2Sample: i32 = 15;
  static channel3Sample: i32 = 15;
  static channel4Sample: i32 = 15;
  static channel1DacEnabled: boolean = false;
  static channel2DacEnabled: boolean = false;
  static channel3DacEnabled: boolean = false;
  static channel4DacEnabled: boolean = false;
  static leftChannelSampleUnsignedByte: i32 = 127;
  static rightChannelSampleUnsignedByte: i32 = 127;
  static mixerVolumeChanged: boolean = false;
  static mixerEnabledChanged: boolean = false;

  //If a channel was updated, need to also track if we need to need to mix them again
  static needToRemixSamples: boolean = false;
}

export function accumulateSound(numberOfCycles: i32): void {
  // Check if any of the individual channels will update
  let channel1WillUpdate: boolean = Channel1.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel1.channelNumber);
  let channel2WillUpdate: boolean = Channel2.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel2.channelNumber);
  let channel3WillUpdate: boolean = Channel3.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel3.channelNumber);
  let channel4WillUpdate: boolean = Channel4.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel4.channelNumber);

  if (channel1WillUpdate) {
    SoundAccumulator.channel1Sample = Channel1.getSampleFromCycleCounter();
  }
  if (channel2WillUpdate) {
    SoundAccumulator.channel2Sample = Channel2.getSampleFromCycleCounter();
  }
  if (channel3WillUpdate) {
    SoundAccumulator.channel3Sample = Channel3.getSampleFromCycleCounter();
  }
  if (channel4WillUpdate) {
    SoundAccumulator.channel4Sample = Channel4.getSampleFromCycleCounter();
  }

  // If any channel updated, we need to re-mix our samples
  if (channel1WillUpdate || channel2WillUpdate || channel3WillUpdate || channel4WillUpdate) {
    SoundAccumulator.needToRemixSamples = true;
  }

  // Do Some downsampling magic
  Sound.downSampleCycleCounter += numberOfCycles * Sound.downSampleCycleMultiplier;
  if (Sound.downSampleCycleCounter >= Sound.maxDownSampleCycles()) {
    // Reset the downsample counter
    // Don't set to zero to catch overflowed cycles
    Sound.downSampleCycleCounter -= Sound.maxDownSampleCycles();

    if (SoundAccumulator.needToRemixSamples || SoundAccumulator.mixerVolumeChanged || SoundAccumulator.mixerEnabledChanged) {
      mixChannelSamples(
        SoundAccumulator.channel1Sample,
        SoundAccumulator.channel2Sample,
        SoundAccumulator.channel3Sample,
        SoundAccumulator.channel4Sample
      );
    }

    // Finally Simply place the accumulated sample in memory
    // Set our volumes in memory
    // +1 so it can not be zero
    setLeftAndRightOutputForAudioQueue(
      SoundAccumulator.leftChannelSampleUnsignedByte + 1,
      SoundAccumulator.rightChannelSampleUnsignedByte + 1,
      Sound.audioQueueIndex
    );
    Sound.audioQueueIndex += 1;

    // Don't allow our audioQueueIndex to overflow into other parts of the wasmBoy memory map
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0
    // Not 0xFFFF because we need half of 64kb since we store left and right channel
    if (Sound.audioQueueIndex >= Sound.wasmBoyMemoryMaxBufferSize / 2 - 1) {
      Sound.audioQueueIndex -= 1;
    }
  }
}

// Function used by SoundAccumulator to find out if a channel Dac Changed
function didChannelDacChange(channelNumber: i32): boolean {
  switch (channelNumber) {
    case Channel1.channelNumber:
      if (SoundAccumulator.channel1DacEnabled !== Channel1.isDacEnabled) {
        SoundAccumulator.channel1DacEnabled = Channel1.isDacEnabled;
        return true;
      }
      return false;
    case Channel2.channelNumber:
      if (SoundAccumulator.channel2DacEnabled !== Channel2.isDacEnabled) {
        SoundAccumulator.channel2DacEnabled = Channel2.isDacEnabled;
        return true;
      }
      return false;
    case Channel3.channelNumber:
      if (SoundAccumulator.channel3DacEnabled !== Channel3.isDacEnabled) {
        SoundAccumulator.channel3DacEnabled = Channel3.isDacEnabled;
        return true;
      }
      return false;
    case Channel4.channelNumber:
      if (SoundAccumulator.channel4DacEnabled !== Channel4.isDacEnabled) {
        SoundAccumulator.channel4DacEnabled = Channel4.isDacEnabled;
        return true;
      }
      return false;
  }
  return false;
}
