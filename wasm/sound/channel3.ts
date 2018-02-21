// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Wave Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel

import {
  eightBitStoreIntoGBMemory
} from '../memory/index';

export class Channel3 {

  // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
  // NR30 -> Sound on/off (R/W)
  static memoryLocationNRx0: u16 = 0xFF1A;
  // NR31 -> Sound length (R/W)
  static memoryLocationNRx1: u16 = 0xFF1B;
  // NR32 -> Select ouput level (R/W)
  static memoryLocationNRx2: u16 = 0xFF1C;
  // NR33 -> Frequency lower data (W)
  static memoryLocationNRx3: u16 = 0xFF1D;
  // NR34 -> Frequency higher data (R/W)
  static memoryLocationNRx4: u16 = 0xFF1E;

  // Channel Properties
  static channelNumber: i8 = 3;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx0, 0x7F);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx1, 0xFF);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx2, 0x9F);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx3, 0xBF);
    eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx4, 0xFF);
  }
}
