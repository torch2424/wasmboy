// NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript

// Noise Channel
// http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel

import {
  eightBitStoreIntoGBMemory
} from '../memory/index';

export class Channel4 {

  // Channel 4
  // 'white noise' channel with volume envelope functions.
  // NR41 -> Sound length (R/W)
  static memoryLocationNRx1: u16 = 0xFF20;
  // NR42 -> Volume Envelope (R/W)
  static memoryLocationNRx2: u16 = 0xFF21;
  // NR43 -> Polynomial Counter (R/W)
  static memoryLocationNRx3: u16 = 0xFF22;
  // NR43 -> Counter/consecutive; initial (R/W)
  static memoryLocationNRx4: u16 = 0xFF23;

  // Channel Properties
  static channelNumber: i8 = 4;
  static isEnabled: boolean = false;
  static frequencyTimer: i32 = 0x00;
  static envelopeCounter: i32 = 0x00;
  static lengthCounter: i32 = 0x00;
  static volume: i32 = 0x00;

  static initialize(): void {
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1 - 1, 0xFF);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1, 0xFF);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx2, 0x00);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx3, 0x00);
    eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx4, 0xBF);
  }
}
