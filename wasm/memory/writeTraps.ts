import {
  Memory
} from './memory';
import {
  Graphics,
  batchProcessGraphics
} from '../graphics/graphics';
import {
  Palette,
  writeColorPaletteToMemory,
  Lcd
} from '../graphics/index';
import {
  batchProcessAudio,
  SoundRegisterWriteTraps
} from '../sound/index';
import {
  Timers,
  batchProcessTimers,
  handleTIMCWrite
} from '../timers/index'
import {
  handleBanking
} from './banking';
import {
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory
} from './store';
import {
  eightBitLoadFromGBMemoryWithTraps,
  eightBitLoadFromGBMemory,
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
export function checkWriteTraps(offset: i32, value: i32): boolean {

  // Cache globals used multiple times for performance
  let videoRamLocation: i32 = Memory.videoRamLocation;
  let spriteInformationTableLocation: i32 = Memory.spriteInformationTableLocation;

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
    // TODO: This can do more harm than good in a beta emulator,
    // requires precise timing disabling for now
    // if (Graphics.currentLcdMode > 2) {
    //   return false;
    // }

    // Not batch processing here for performance
    // batchProcessGraphics();

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  // Be sure to copy everything in EchoRam to Work Ram
  // Codeslinger: The ECHO memory region (0xE000-0xFDFF) is quite different because any data written here is also written in the equivelent ram memory region 0xC000-0xDDFF.
  // Hence why it is called echo
  if(offset >= Memory.echoRamLocation && offset < spriteInformationTableLocation) {
    let wramOffset: i32 = offset - 0x2000;
    eightBitStoreIntoGBMemory(wramOffset, value);

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  // Also check for individal writes
  // Can only read/write from OAM During Modes 0 - 1
  // See graphics/lcd.ts
  if(offset >= spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
    // Can only read/write from OAM During Mode 2
    // See graphics/lcd.ts
    if (Lcd.currentLcdMode < 2) {
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
      eightBitStoreIntoGBMemory(offset, 0);
      return false;
    }

    // Trap our TIMC writes
    if(offset === Timers.memoryLocationTIMC) {
      handleTIMCWrite(value);
      return true;
    }

    // Allow the original Write
    return true;
  }

  // Sound
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
  if(offset >= 0xFF10 && offset <= 0xFF26) {
    batchProcessAudio();
    return SoundRegisterWriteTraps(offset, value);
  }
  // FF27 - FF2F not used
  // Final Wave Table for Channel 3
  if(offset >= 0xFF30 && offset <= 0xFF3F) {
    batchProcessAudio();
  }

  // Other Memory effects fomr read/write to Lcd/Graphics
  if (offset >= Lcd.memoryLocationLcdControl && offset <= Graphics.memoryLocationWindowX) {

    // Not batch processing here for performance
    // batchProcessGraphics();

    if (offset === Lcd.memoryLocationLcdControl) {
      // Shorcut for isLCD Enabled since it gets "hot"
      Lcd.updateLcdControl(value);
      return true;
    }

    // reset the current scanline if the game tries to write to it
    if (offset === Graphics.memoryLocationScanlineRegister) {
      eightBitStoreIntoGBMemory(offset, 0);
      return false;
    }

    // Do the direct memory access transfer for spriteInformationTable
    // Check the graphics mode to see if we can write to VRAM
    // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
    if (offset === Graphics.memoryLocationDmaTransfer) {
      // otherwise, perform a DMA transfer
      // And allow the original write
      startDmaTransfer(value);
      return true;
    }


    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  // Do an HDMA
  if(offset === Memory.memoryLocationHdmaTrigger) {
    startHdmaTransfer(value);
    return false;
  }

  // Don't allow banking if we are doing an Hblank HDM transfer
  // https://gist.github.com/drhelius/3394856
  if(offset === Memory.memoryLocationGBCWRAMBank || offset === Memory.memoryLocationGBCVRAMBank) {
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
