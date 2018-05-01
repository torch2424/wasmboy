import { Memory } from "./memory";
import { Graphics, batchProcessGraphics } from "../graphics/graphics";
import { Palette, Lcd } from "../graphics/index";
import { batchProcessAudio, SoundRegisterReadTraps } from "../sound/index";
import { eightBitStoreIntoGBMemory } from "./store";
import { eightBitLoadFromGBMemory } from "./load";
import { Joypad, getJoypadState } from "../joypad/index";
import { Timers } from "../timers/index";
import { hexLog } from "../helpers/index";

// Returns -1 if no trap found, otherwise returns a value that should be fed for the address
export function checkReadTraps(offset: i32): i32 {
  // Cache globals used multiple times for performance
  let videoRamLocation: i32 = Memory.videoRamLocation;

  // Try to break early for most common scenario
  if (offset < videoRamLocation) {
    return -1;
  }

  // Check the graphics mode to see if we can read VRAM
  // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
  if (offset >= videoRamLocation && offset < Memory.cartridgeRamLocation) {
    // Can only read/write from VRAM During Modes 0 - 2
    // See graphics/lcd.ts
    // TODO: This can do more harm than good in a beta emulator,
    // requres precise timing, disabling for now
    // if (Graphics.currentLcdMode > 2) {
    //   return 0xFF;
    // }

    return -1;
  }

  // ECHO Ram, E000	FDFF	Mirror of C000~DDFF (ECHO RAM)
  // http://gbdev.gg8.se/wiki/articles/Memory_Map
  if (
    offset >= Memory.echoRamLocation &&
    offset < Memory.spriteInformationTableLocation
  ) {
    // Simply return the mirror'd value
    return eightBitLoadFromGBMemory(offset - 0x2000);
  }

  // Check for individal writes
  // Can only read/write from OAM During Modes 0 - 1
  // See graphics/lcd.ts
  if (
    offset >= Memory.spriteInformationTableLocation &&
    offset <= Memory.spriteInformationTableLocationEnd
  ) {
    // Can only read/write from OAM During Mode 2
    // See graphics/lcd.ts
    if (Lcd.currentLcdMode < 2) {
      return 0xff;
    }

    // Not batch processing here for performance
    // batchProcessGraphics();

    return -1;
  }

  // Graphics
  // Not batch processing here for performance
  // batchProcessGraphics();
  if (offset === Graphics.memoryLocationScanlineRegister) {
    eightBitStoreIntoGBMemory(offset, Graphics.scanlineRegister);
    return Graphics.scanlineRegister;
  }

  // Sound
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
  // TODO: Put these bounds on the Sound Class
  if (offset >= 0xff10 && offset <= 0xff26) {
    batchProcessAudio();
    return SoundRegisterReadTraps(offset);
  }
  // FF27 - FF2F not used
  // Final Wave Table for Channel 3
  if (offset >= 0xff30 && offset <= 0xff3f) {
    batchProcessAudio();
    return -1;
  }

  // Timers
  if (offset === Timers.memoryLocationDividerRegister) {
    eightBitStoreIntoGBMemory(offset, Timers.dividerRegister);
    return Timers.dividerRegister;
  }
  if (offset === Timers.memoryLocationTimerCounter) {
    eightBitStoreIntoGBMemory(offset, Timers.timerCounter);
    return Timers.timerCounter;
  }

  // Joypad
  if (offset === Joypad.memoryLocationJoypadRegister) {
    return getJoypadState();
  }

  return -1;
}
