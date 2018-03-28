import {
  Memory
} from './memory';
import {
  Graphics,
  batchProcessGraphics
} from '../graphics/graphics';
import {
  Palette,
  writeColorPaletteToMemory
} from '../graphics/index';
import {
  batchProcessAudio,
  handledWriteToSoundRegister
} from '../sound/index';
import {
  Timers,
  batchProcessTimers
} from '../timers/index'
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
  startDmaTransfer,
  startHdmaTransfer
} from './dma';
import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';

// Internal function to trap any modify data trying to be written to Gameboy memory
// Follows the Gameboy memory map
export function checkWriteTraps(offset: u16, value: u16, isEightBitStore: boolean): boolean {

  // Cache globals used multiple times for performance
  let videoRamLocation: u16 = Memory.videoRamLocation;
  let spriteInformationTableLocation: u16 = Memory.spriteInformationTableLocation;

  // Handle banking
  if(offset < videoRamLocation) {

    handleBanking(offset, value);
    return false;
  }

  // Check the graphics mode to see if we can write to VRAM
  // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
  if(offset >= videoRamLocation && offset < Memory.cartridgeRamLocation) {
    // Can only read/write from VRAM During Modes 0 - 2
    // See graphics/lcd.ts
    if (Graphics.currentLcdMode > 2) {
      return false;
    }

    // Not batch processing here for performance
    // batchProcessGraphics();

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  // Be sure to copy everything in EchoRam to Work Ram
  if(offset >= Memory.echoRamLocation && offset < spriteInformationTableLocation) {
    // TODO: Also write to Work Ram
    if(isEightBitStore) {
      eightBitStoreIntoGBMemorySkipTraps(offset, <u8>value);
    } else {
      sixteenBitStoreIntoGBMemorySkipTraps(offset, value);
    }

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  // Also check for individal writes
  // Can only read/write from OAM During Modes 0 - 1
  // See graphics/lcd.ts
  if(offset >= spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
    // Can only read/write from OAM During Mode 2
    // See graphics/lcd.ts
    if (Graphics.currentLcdMode < 2) {
      return false;
    }
    // Not batch processing here for performance
    // batchProcessGraphics();

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  if(offset >= Memory.unusableMemoryLocation && offset <= Memory.unusableMemoryEndLocation) {
    return false;
  }

  // Timers
  if (offset >= Timers.memoryLocationDividerRegister && offset <= Timers.memoryLocationTIMC) {

    // Batch Process
    batchProcessTimers();

    // Trap our divider register from our timers
    if(offset === Timers.memoryLocationDividerRegister) {
      eightBitStoreIntoGBMemorySkipTraps(offset, 0);
      return false;
    }

    // Allow the original Write
    return true;
  }

  // Sound
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
  if(offset >= 0xFF10 && offset <= 0xFF26) {
    batchProcessAudio();
    if(handledWriteToSoundRegister(offset, value)) {
      return false;
    }
  }
  // FF27 - FF2F not used
  // Final Wave Table for Channel 3
  if(offset >= 0xFF30 && offset <= 0xFF3F) {
    batchProcessAudio();
  }

  // Other Memory effects fomr read/write to GraphicsGraphics
  if (offset >= Graphics.memoryLocationLcdControl && offset <= Graphics.memoryLocationWindowX) {

    // Not batch processing here for performance
    // batchProcessGraphics();

    // reset the current scanline if the game tries to write to it
    if (offset === Graphics.memoryLocationScanlineRegister) {
      eightBitStoreIntoGBMemorySkipTraps(offset, 0);
      return false;
    }

    // Do the direct memory access transfer for spriteInformationTable
    // Check the graphics mode to see if we can write to VRAM
    // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
    if (offset === Graphics.memoryLocationDmaTransfer) {
      // otherwise, perform a DMA transfer
      // And allow the original write
      startDmaTransfer(<u8>value);
      return true;
    }


    // Allow the original write, and return since we dont need to look anymore
    return true;
  }


  // Check if the HDMA registers are attempting to be changed while and HDMA is active
  if(Memory.isHblankHdmaActive &&
    offset >= Memory.memoryLocationHdmaSourceHigh &&
    offset <= Memory.memoryLocationHdmaDestinationLow) {
      return false;
  }

  // Do an HDMA
  if(offset === Memory.memoryLocationHdmaTrigger) {
    startHdmaTransfer(<u8>value);
    return false;
  }

  // Don't allow banking if we are doing an Hblank HDM transfer
  // https://gist.github.com/drhelius/3394856
  if(offset === Memory.memoryLocationGBCWRAMBank || offset === Memory.memoryLocationGBCVRAMBAnk) {
    if (Memory.isHblankHdmaActive) {
      if((Memory.hblankHdmaSource >= 0x4000 && Memory.hblankHdmaSource <= 0x7FFF) ||
        (Memory.hblankHdmaSource >= 0xD000 && Memory.hblankHdmaSource <= 0xDFFF)) {
          return false;
        }
    }
  }

  // Handle GBC Pallete Write
  if (offset >= Palette.memoryLocationBackgroundPaletteIndex && offset <= Palette.memoryLocationSpritePaletteData) {
    // Incremeenting the palette handled by the write
    writeColorPaletteToMemory(offset, value);
    return true;
  }

  // Allow the original write
  return true;
}
