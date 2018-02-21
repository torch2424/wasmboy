// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Simple Square Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave

import {
  eightBitStoreIntoGBMemory
} from '../memory/index';

export class Channel2 {

  // Squarewave channel with volume envelope functions only.
  // NR21 -> Sound length/Wave pattern duty (R/W)
  static memoryLocationNRx1: u16 = 0xFF16;
  // NR22 -> Volume Envelope (R/W)
  static memoryLocationNRx2: u16 = 0xFF17;
  // NR23 -> Frequency lo (W)
  static memoryLocationNRx3: u16 = 0xFF18;
  // NR24 -> Frequency hi (R/W)
  static memoryLocationNRx4: u16 = 0xFF19;

  // Channel Properties
  static channelNumber: i8 = 2;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  // Square Wave properties
  static dutyCycle: u8 = 0x00;
  static waveFormPositionOnDuty: u8 = 0x00;

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1 - 1, 0xFF);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1, 0x3F);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx2, 0x00);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, 0xF3);
    eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, 0xBF);
  }
}
