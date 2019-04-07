// Functions involved in R/W of sound registers
// Information of bits on every register can be found at: https://gist.github.com/drhelius/3652407
// Passing channel number to make things simpler than passing around memory addresses, to avoid bugs in choosing the wrong address

import { Sound } from './sound';
import { SoundAccumulator } from './accumulator';
import { Channel1 } from './channel1';
import { Channel2 } from './channel2';
import { Channel3 } from './channel3';
import { Channel4 } from './channel4';
import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory, eightBitStoreIntoGBMemoryWithTraps } from '../memory/index';
import { checkBitOnByte, setBitOnByte, resetBitOnByte, log } from '../helpers/index';

// Function to check and handle writes to sound registers
// Inlined because closure compiler inlines
// NOTE: For write traps, return false = don't write to memory,
// return true = allow the write to memory
export function SoundRegisterWriteTraps(offset: i32, value: i32): boolean {
  if (offset !== Sound.memoryLocationNR52 && !Sound.NR52IsSoundEnabled) {
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Power_Control
    // When sound is turned off / enabled
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
      Channel1.updateNRx4(value);
      return true;
    case Channel2.memoryLocationNRx4:
      Channel2.updateNRx4(value);
      return true;
    case Channel3.memoryLocationNRx4:
      Channel3.updateNRx4(value);
      return true;
    case Channel4.memoryLocationNRx4:
      Channel4.updateNRx4(value);
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

      // See if we were enabled, then update the register.
      let wasNR52Enabled = Sound.NR52IsSoundEnabled;

      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Power_Control
      // When powered on, the frame sequencer is reset so that the next step will be 0,
      // the square duty units are reset to the first step of the waveform,
      // and the wave channel's sample buffer is reset to 0.
      if (!wasNR52Enabled && checkBitOnByte(7, value)) {
        Sound.frameSequencer = 0x07;
        Channel1.waveFormPositionOnDuty = 0x00;
        Channel2.waveFormPositionOnDuty = 0x00;

        // TODO: Wave Channel Sample Buffer?
        // I don't think we clear wave RAM here...
      }

      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Power_Control
      // When powered off, all registers (NR10-NR51) are instantly written with zero
      // and any writes to those registers are ignored while power remains off
      if (wasNR52Enabled && !checkBitOnByte(7, value)) {
        for (let i = 0xff10; i < 0xff26; ++i) {
          eightBitStoreIntoGBMemoryWithTraps(i, 0x00);
        }
      }

      // Need to update our new value here, that way writes go through :p
      Sound.updateNR52(value);
      return true;
  }

  // We did not handle the write, Allow the write
  return true;
}

// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
// Inlined because closure compiler inlines
export function SoundRegisterReadTraps(offset: i32): i32 {
  // Registers must be OR'd with values when being read
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers

  switch (offset) {
    // Handle NRx0 on Channels
    case Channel1.memoryLocationNRx0: {
      let register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
      return register | 0x80;
    }
    case Channel2.memoryLocationNRx0: {
      let register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx0);
      return register | 0xff;
    }
    case Channel3.memoryLocationNRx0: {
      let register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx0);
      return register | 0x7f;
    }
    case Channel4.memoryLocationNRx0: {
      let register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx0);
      return register | 0xff;
    }
    case Sound.memoryLocationNR50: {
      let register = eightBitLoadFromGBMemory(Sound.memoryLocationNR50);
      return register | 0x00;
    }

    // Handle NRx1 on Channels
    case Channel1.memoryLocationNRx1: {
      let register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx1);
      return register | 0x3f;
    }
    case Channel2.memoryLocationNRx1: {
      let register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx1);
      return register | 0x3f;
    }
    case Channel3.memoryLocationNRx1: {
      let register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx1);
      return register | 0xff;
    }
    case Channel4.memoryLocationNRx1: {
      let register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx1);
      return register | 0xff;
    }
    case Sound.memoryLocationNR51: {
      let register = eightBitLoadFromGBMemory(Sound.memoryLocationNR51);
      return register | 0x00;
    }

    // Handle NRx2 on Channels
    case Channel1.memoryLocationNRx2: {
      let register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx2);
      return register | 0x00;
    }
    case Channel2.memoryLocationNRx2: {
      let register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx2);
      return register | 0x00;
    }
    case Channel3.memoryLocationNRx2: {
      let register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
      return register | 0x9f;
    }
    case Channel4.memoryLocationNRx2: {
      let register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx2);
      return register | 0x00;
    }
    case Sound.memoryLocationNR52: {
      // This will fix bugs in orcale of ages :)

      // Start our registerNR52
      let registerNR52 = 0x00;

      // Set the first bit to the sound paower status
      if (Sound.NR52IsSoundEnabled) {
        registerNR52 = setBitOnByte(7, registerNR52);
      } else {
        registerNR52 = resetBitOnByte(7, registerNR52);
      }

      // Set our lower 4 bits to our channel length statuses
      if (Channel1.isEnabled) {
        registerNR52 = setBitOnByte(0, registerNR52);
      } else {
        registerNR52 = resetBitOnByte(0, registerNR52);
      }

      if (Channel2.isEnabled) {
        registerNR52 = setBitOnByte(1, registerNR52);
      } else {
        registerNR52 = resetBitOnByte(1, registerNR52);
      }

      if (Channel3.isEnabled) {
        registerNR52 = setBitOnByte(2, registerNR52);
      } else {
        registerNR52 = resetBitOnByte(2, registerNR52);
      }

      if (Channel4.isEnabled) {
        registerNR52 = setBitOnByte(3, registerNR52);
      } else {
        registerNR52 = resetBitOnByte(3, registerNR52);
      }

      // Or from the table
      registerNR52 |= 0x70;
      return registerNR52;
    }

    // Handle NRx3 on Channels
    case Channel1.memoryLocationNRx3: {
      let register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx3);
      return register | 0xff;
    }
    case Channel2.memoryLocationNRx3: {
      let register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx3);
      return register | 0xff;
    }
    case Channel3.memoryLocationNRx3: {
      let register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx3);
      return register | 0xff;
    }
    case Channel4.memoryLocationNRx3: {
      let register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx3);
      return register | 0x00;
    }

    // Handle NRx4 on Channels
    case Channel1.memoryLocationNRx4: {
      let register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx4);
      return register | 0xbf;
    }
    case Channel2.memoryLocationNRx4: {
      let register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx4);
      return register | 0xbf;
    }
    case Channel3.memoryLocationNRx4: {
      let register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx4);
      return register | 0xbf;
    }
    case Channel4.memoryLocationNRx4: {
      let register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx4);
      return register | 0xbf;
    }
  }

  return -1;
}
