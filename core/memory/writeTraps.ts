import { Memory } from './memory';
import { Cpu } from '../cpu/index';
import { Graphics } from '../graphics/graphics';
import { Palette, writeColorPaletteToMemory, Lcd } from '../graphics/index';
import { batchProcessAudio, SoundRegisterWriteTraps, Channel3 } from '../sound/index';
import { Timers, batchProcessTimers } from '../timers/index';
import { Serial } from '../serial/serial';
import { Interrupts } from '../interrupts/index';
import { Joypad } from '../joypad/index';
import { handleBanking } from './banking';
import { eightBitStoreIntoGBMemory } from './store';
import { startDmaTransfer, startHdmaTransfer } from './dma';

// Internal function to trap any modify data trying to be written to Gameboy memory
// Follows the Gameboy memory map
// Return true if you want to continue the write, return false to end it here
export function checkWriteTraps(offset: i32, value: i32): boolean {
  // Cpu
  if (offset === Cpu.memoryLocationSpeedSwitch) {
    // TCAGBD, only Bit 0 is writable
    eightBitStoreIntoGBMemory(Cpu.memoryLocationSpeedSwitch, value & 0x01);
    // We did the write, dont need to
    return false;
  }

  // Handle Boot ROM Switch
  if (Cpu.BootROMEnabled && offset === Cpu.memoryLocationBootROMSwitch) {
    // Disable the boot rom
    Cpu.BootROMEnabled = false;

    // Set the program counter to be incremented after this command
    Cpu.programCounter = 0x00ff;

    // Allow the write
    return true;
  }

  // Graphics
  // Cache globals used multiple times for performance
  let videoRamLocation = Memory.videoRamLocation;
  let spriteInformationTableLocation = Memory.spriteInformationTableLocation;

  // Handle banking
  if (offset < videoRamLocation) {
    handleBanking(offset, value);
    return false;
  }

  // Check the graphics mode to see if we can write to VRAM
  // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
  if (offset >= videoRamLocation && offset < Memory.cartridgeRamLocation) {
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
  if (offset >= Memory.echoRamLocation && offset < spriteInformationTableLocation) {
    let wramOffset = offset - 0x2000;
    eightBitStoreIntoGBMemory(wramOffset, value);

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  // Also check for individal writes
  // Can only read/write from OAM During Modes 0 - 1
  // See graphics/lcd.ts
  if (offset >= spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
    // Can only read/write from OAM During Mode 2
    // See graphics/lcd.ts
    // if (Lcd.currentLcdMode < 2) {
    // return false;
    // }
    // Not batch processing here for performance
    // batchProcessGraphics();

    // Allow the original write, and return since we dont need to look anymore
    // return true;
    return Lcd.currentLcdMode >= 2;
  }

  if (offset >= Memory.unusableMemoryLocation && offset <= Memory.unusableMemoryEndLocation) {
    return false;
  }

  // Serial
  if (offset === Serial.memoryLocationSerialTransferControl) {
    // SC
    return Serial.updateTransferControl(value);
  }

  // Sound
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
  if (offset >= 0xff10 && offset <= 0xff26) {
    batchProcessAudio();
    return SoundRegisterWriteTraps(offset, value);
  }

  // FF27 - FF2F not used

  // Final Wave Table for Channel 3
  if (offset >= 0xff30 && offset <= 0xff3f) {
    batchProcessAudio();

    // Need to handle the write if channel 3 is enabled
    if (Channel3.isEnabled) {
      Channel3.handleWaveRamWrite(value);
      return false;
    }
    return true;
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

    if (offset === Lcd.memoryLocationLcdStatus) {
      // We are handling the write here
      Lcd.updateLcdStatus(value);
      return false;
    }

    // reset the current scanline if the game tries to write to it
    if (offset === Graphics.memoryLocationScanlineRegister) {
      Graphics.scanlineRegister = 0;
      eightBitStoreIntoGBMemory(offset, 0);
      return false;
    }

    // Cache our coincidence compare
    if (offset === Lcd.memoryLocationCoincidenceCompare) {
      Lcd.coincidenceCompare = value;
      return true;
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

    // Scroll and Window XY
    switch (offset) {
      case Graphics.memoryLocationScrollX:
        Graphics.scrollX = value;
        return true;
      case Graphics.memoryLocationScrollY:
        Graphics.scrollY = value;
        return true;
      case Graphics.memoryLocationWindowX:
        Graphics.windowX = value;
        return true;
      case Graphics.memoryLocationWindowY:
        Graphics.windowY = value;
        return true;
    }

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }

  // Do an HDMA
  if (offset === Memory.memoryLocationHdmaTrigger) {
    startHdmaTransfer(value);
    return false;
  }

  // Don't allow banking if we are doing an Hblank HDM transfer
  // https://gist.github.com/drhelius/3394856
  if (offset === Memory.memoryLocationGBCWRAMBank || offset === Memory.memoryLocationGBCVRAMBank) {
    if (Memory.isHblankHdmaActive) {
      let hblankHdmaSource = Memory.hblankHdmaSource;
      if ((hblankHdmaSource >= 0x4000 && hblankHdmaSource <= 0x7fff) || (hblankHdmaSource >= 0xd000 && hblankHdmaSource <= 0xdfff)) {
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

  // Handle timer writes
  if (offset >= Timers.memoryLocationDividerRegister && offset <= Timers.memoryLocationTimerControl) {
    // Batch Process
    batchProcessTimers();

    switch (offset) {
      case Timers.memoryLocationDividerRegister:
        Timers.updateDividerRegister();
        return false;
      case Timers.memoryLocationTimerCounter:
        Timers.updateTimerCounter(value);
        return true;
      case Timers.memoryLocationTimerModulo:
        Timers.updateTimerModulo(value);
        return true;
      case Timers.memoryLocationTimerControl:
        Timers.updateTimerControl(value);
        return true;
    }

    return true;
  }

  // Handle Joypad writes for HW reg caching
  if (offset === Joypad.memoryLocationJoypadRegister) {
    Joypad.updateJoypad(value);
  }

  // Handle Interrupt writes
  if (offset === Interrupts.memoryLocationInterruptRequest) {
    Interrupts.updateInterruptRequested(value);
    return true;
  }
  if (offset === Interrupts.memoryLocationInterruptEnabled) {
    Interrupts.updateInterruptEnabled(value);
    return true;
  }

  // Allow the original write
  return true;
}
