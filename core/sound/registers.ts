// Functions involved in R/W of sound registers
// Information of bits on every register can be found at: https://gist.github.com/drhelius/3652407
// Passing channel number to make things simpler than passing around memory addresses, to avoid bugs in choosing the wrong address

import { Sound } from './sound';
import { SoundAccumulator } from './accumulator';
import { Channel1 } from './channel1';
import { Channel2 } from './channel2';
import { Channel3 } from './channel3';
import { Channel4 } from './channel4';
import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory } from '../memory/index';
import { checkBitOnByte, setBitOnByte, resetBitOnByte } from '../helpers/index';

// Function to check and handle writes to sound registers
// Inlined because closure compiler inlines
export function SoundRegisterWriteTraps(offset: i32, value: i32): boolean {
  if (offset !== Sound.memoryLocationNR52 && !Sound.NR52IsSoundEnabled) {
    // Block all writes to any sound register EXCEPT NR52!
    // This is under the assumption that the check for
    // offset >= 0xFF10 && offset <= 0xFF26
    // is done in writeTraps.ts (which it is)
    // NOTE: Except on DMG, length can still be written (whatever that means)
    return false;
  }

  switch (offset) {
    // Handle NRx0 on Channels
    case Channel1.memoryLocationNRx0:
      Channel1.updateNRx0(value);
      return true;
    case Channel3.memoryLocationNRx0:
      Channel3.updateNRx0(value);
      return true;
    // Handle NRx1 (Length Counter) on Channels
    case Channel1.memoryLocationNRx1:
      Channel1.updateNRx1(value);
      return true;
    case Channel2.memoryLocationNRx1:
      Channel2.updateNRx1(value);
      return true;
    case Channel3.memoryLocationNRx1:
      Channel3.updateNRx1(value);
      return true;
    case Channel4.memoryLocationNRx1:
      Channel4.updateNRx1(value);
      return true;
    // Handle NRx2 (Envelope / Volume) on Channels
    case Channel1.memoryLocationNRx2:
      Channel1.updateNRx2(value);
      return true;
    case Channel2.memoryLocationNRx2:
      Channel2.updateNRx2(value);
      return true;
    case Channel3.memoryLocationNRx2:
      // Check if channel 3's volume code was written too
      // This is handcy to know for accumulation of samples
      Channel3.volumeCodeChanged = true;
      Channel3.updateNRx2(value);
      return true;
    case Channel4.memoryLocationNRx2:
      Channel4.updateNRx2(value);
      return true;
    // Handle NRx3 (Frequency / Noise Properties) on Channels
    case Channel1.memoryLocationNRx3:
      Channel1.updateNRx3(value);
      return true;
    case Channel2.memoryLocationNRx3:
      Channel2.updateNRx3(value);
      return true;
    case Channel3.memoryLocationNRx3:
      Channel3.updateNRx3(value);
      return true;
    case Channel4.memoryLocationNRx3:
      Channel4.updateNRx3(value);
      return true;
    // Check our NRx4 registers to trap our trigger bits
    case Channel1.memoryLocationNRx4:
      if (checkBitOnByte(7, value)) {
        Channel1.updateNRx4(value);
        Channel1.trigger();
      }
      return true;
    case Channel2.memoryLocationNRx4:
      if (checkBitOnByte(7, value)) {
        Channel2.updateNRx4(value);
        Channel2.trigger();
      }
      return true;
    case Channel3.memoryLocationNRx4:
      if (checkBitOnByte(7, value)) {
        Channel3.updateNRx4(value);
        Channel3.trigger();
      }
      return true;
    case Channel4.memoryLocationNRx4:
      if (checkBitOnByte(7, value)) {
        Channel4.updateNRx4(value);
        Channel4.trigger();
      }
      return true;
    // Tell the sound accumulator if volumes changes
    case Sound.memoryLocationNR50:
      Sound.updateNR50(value);
      SoundAccumulator.mixerVolumeChanged = true;
      return true;
    // Tell the sound accumulator if volumes changes
    case Sound.memoryLocationNR51:
      Sound.updateNR51(value);
      SoundAccumulator.mixerEnabledChanged = true;
      return true;
    case Sound.memoryLocationNR52:
      // Reset all registers except NR52
      Sound.updateNR52(value);
      if (!checkBitOnByte(7, value)) {
        for (let i = 0xff10; i < 0xff26; ++i) {
          eightBitStoreIntoGBMemory(i, 0x00);
        }
      }
      return true;
  }

  // We did not handle the write, Allow the write
  return true;
}

// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
// Inlined because closure compiler inlines
export function SoundRegisterReadTraps(offset: i32): i32 {
  // TODO: OR All Registers

  // This will fix bugs in orcale of ages :)
  if (offset === Sound.memoryLocationNR52) {
    // Get our registerNR52
    let registerNR52: i32 = eightBitLoadFromGBMemory(Sound.memoryLocationNR52);

    // Knock off lower 7 bits
    registerNR52 = registerNR52 & 0x80;

    // Set our lower 4 bits to our channel isEnabled statuses
    if (Channel1.isEnabled) {
      setBitOnByte(0, registerNR52);
    } else {
      resetBitOnByte(0, registerNR52);
    }

    if (Channel2.isEnabled) {
      setBitOnByte(1, registerNR52);
    } else {
      resetBitOnByte(1, registerNR52);
    }

    if (Channel3.isEnabled) {
      setBitOnByte(2, registerNR52);
    } else {
      resetBitOnByte(2, registerNR52);
    }

    if (Channel4.isEnabled) {
      setBitOnByte(3, registerNR52);
    } else {
      resetBitOnByte(3, registerNR52);
    }

    // Or from the table
    registerNR52 = registerNR52 | 0x70;

    return registerNR52;
  }

  return -1;
}
