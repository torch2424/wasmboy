import {
  Memory
} from './memory';
import {
  Graphics
} from '../graphics/graphics';
import {
    Channel1
} from '../sound/index';
import {
    Channel2
} from '../sound/index';
import {
    Channel3
} from '../sound/index';
import {
    Channel4
} from '../sound/index';
import {
  handleBanking
} from './banking';
import {
  eightBitStoreIntoGBMemorySkipTraps,
  sixteenBitStoreIntoGBMemorySkipTraps
} from './store';
import {
  eightBitLoadFromGBMemory,
  eightBitLoadFromGBMemorySkipTraps,
  sixteenBitLoadFromGBMemory
} from './load';
import {
  checkBitOnByte
} from '../helpers/index';

// Internal function to trap any modify data trying to be written to Gameboy memory
// Follows the Gameboy memory map
export function checkWriteTraps(offset: u16, value: u16, isEightBitStore: boolean): boolean {

  // Handle banking
  if(offset < Memory.videoRamLocation) {
    handleBanking(offset, value);
    return false;
  }

  // Check the graphics mode to see if we can write to VRAM
  // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
  if(offset >= Memory.videoRamLocation && offset < Memory.cartridgeRamLocation) {
    // Can only read/write from VRAM During Modes 0 - 2
    // See graphics/lcd.ts
    if (Graphics.currentLcdMode > 2) {
      return false;
    }
  }

  // Be sure to copy everything in EchoRam to Work Ram
  if(offset >= Memory.echoRamLocation && offset < Memory.spriteInformationTableLocation) {
    // TODO: Also write to Work Ram
    if(isEightBitStore) {
      eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    } else {
      sixteenBitStoreIntoGBMemorySkipTraps(offset, value);
    }
  }

  // Also check for individal writes
  // Can only read/write from OAM During Modes 0 - 1
  // See graphics/lcd.ts
  if(offset >= Memory.spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
    // Can only read/write from OAM During Mode 2
    // See graphics/lcd.ts
    if (Graphics.currentLcdMode !== 2) {
      return false;
    }
  }

  if(offset >= Memory.unusableMemoryLocation && offset <= Memory.unusableMemoryEndLocation) {
    return false;
  }

  // Trap our divider register from our timers
  if(offset === 0xFF04) {
    eightBitStoreIntoGBMemorySkipTraps(offset, 0);
    return false;
  }

  // Check our NRx4 registers to trap our trigger bits
  if(offset === Channel1.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    // Write the value skipping traps, and then trigger
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    Channel1.trigger();
    return false;
  } else if(offset === Channel2.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    // TODO: Trigger Channel 2
    return false;
  } else if(offset === Channel3.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    // TODO: Trigger the wave channel
    return false;
  } else if(offset === Channel4.memoryLocationNRx4 && checkBitOnByte(7, <u8>value)) {
    eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    // TODO: Trigger the noise channel
    return false;
  }

  // reset the current scanline if the game tries to write to it
  if (offset === 0xFF44) {
    eightBitStoreIntoGBMemorySkipTraps(offset, 0);
    return false;
  }

  // Do the direct memory access transfer for spriteInformationTable
  // Check the graphics mode to see if we can write to VRAM
  // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
  if (offset === 0xFF46) {
    // otherwise, performa the DMA transfer
    _dmaTransfer(<u8>value) ;
  }

  return true;
}

function _dmaTransfer(sourceAddressOffset: u8): void {

  let sourceAddress: u16 = <u16>sourceAddressOffset;
  sourceAddress = (sourceAddress << 8);

  for(let i: u16 = 0; i < 0xA0; i++) {
    let spriteInformationByte: u8 = eightBitLoadFromGBMemorySkipTraps(sourceAddress + i);
    let spriteInformationAddress: u16 = Memory.spriteInformationTableLocation + i;
    eightBitStoreIntoGBMemorySkipTraps(spriteInformationAddress, spriteInformationByte);
  }
}
