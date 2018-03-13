// Funcitons for setting and checking the LCD
import {
  Graphics
} from './graphics';
// Assembly script really not feeling the reexport
import {
  eightBitLoadFromGBMemory
} from '../memory/load';
import {
  eightBitStoreIntoGBMemorySkipTraps
} from '../memory/store';
import {
  requestLcdInterrupt
} from '../interrupts/index';
import {
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte,
  hexLog
} from '../helpers/index';

export function isLcdEnabled(): boolean {
  return checkBitOnByte(7, eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl));
}

// Pass in the lcd status for performance
export function setLcdStatus(lcdEnabledStatus: boolean): void {
  // LCD Status (0xFF41) bits Explanation
  // 0                0                    000                    0             00
  //       |Coicedence Interrupt|     |Mode Interrupts|  |coincidence flag|    | Mode |
  // Modes:
  // 0 or 00: H-Blank
  // 1 or 01: V-Blank
  // 2 or 10: Searching Sprites Atts
  // 3 or 11: Transfering Data to LCD Driver

  let lcdStatus: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdStatus);
  if(!lcdEnabledStatus) {
    // Reset scanline cycle counter
    Graphics.scanlineCycleCounter = 0;
    eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationScanlineRegister, 0);

    // Set to mode 0
    // https://www.reddit.com/r/EmuDev/comments/4w6479/gb_dr_mario_level_generation_issues/
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = resetBitOnByte(0, lcdStatus);
    Graphics.currentLcdMode = 0;

    // Store the status in memory
    eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationLcdStatus, lcdStatus);
    return;
  }

  // Get our current scanline, and lcd mode
  let scanlineRegister: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
  let lcdMode: u8 = lcdStatus & 0x03;

  let newLcdMode: u8 = 0;
  let shouldRequestInterrupt: boolean = false;

  // Find our newLcd mode
  if(scanlineRegister >= 144) {
    // VBlank mode
    newLcdMode = 1;
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = setBitOnByte(0, lcdStatus);
    shouldRequestInterrupt = checkBitOnByte(4, lcdStatus);
  } else {
    if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_SPRITES_LCD_MODE) {
      // Searching Sprites Atts
      newLcdMode = 2;
      lcdStatus = resetBitOnByte(0, lcdStatus);
      lcdStatus = setBitOnByte(1, lcdStatus);
      shouldRequestInterrupt = checkBitOnByte(5, lcdStatus);
    } else if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE) {
      // Transferring data to lcd
      newLcdMode = 3;
      lcdStatus = setBitOnByte(0, lcdStatus);
      lcdStatus = setBitOnByte(1, lcdStatus);
    } else {
      // H-Blank
      newLcdMode = 0;
      lcdStatus = resetBitOnByte(0, lcdStatus);
      lcdStatus = resetBitOnByte(1, lcdStatus);
      shouldRequestInterrupt = checkBitOnByte(3, lcdStatus);
    }
  }

  if (lcdMode !== newLcdMode) {
    // Check if we want to request an interrupt, and we JUST changed modes
    if(shouldRequestInterrupt) {
      requestLcdInterrupt();
    }

    // Check for the coincidence flag
    if(newLcdMode === 0 && scanlineRegister === eightBitLoadFromGBMemory(Graphics.memoryLocationCoincidenceCompare)) {
      lcdStatus = setBitOnByte(2, lcdStatus);
      if(checkBitOnByte(6, lcdStatus)) {
        requestLcdInterrupt();
      }
    } else {
      lcdStatus = resetBitOnByte(2, lcdStatus);
    }
  }

  // Save our lcd mode
  Graphics.currentLcdMode = newLcdMode;

  // Finally, save our status
  eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationLcdStatus, lcdStatus);
}
