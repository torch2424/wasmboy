import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory } from '../memory/index';
import { requestVBlankInterrupt, requestLcdInterrupt } from '../interrupts/index';
import { checkBitOnByte, setBitOnByte, resetBitOnByte } from '../helpers/index';

class Graphics {
  // Count the number of cycles to keep synced with cpu cycles
  static scanlineCycleCounter: i16 = 0x00;
  static MAX_CYCLES_PER_SCANLINE: i16 = 456;
  static MIN_CYCLES_SPRITES_LCD_MODE: i16 = 376;
  static MIN_CYCLES_TRANSFER_DATA_LCD_MODE: i16 = 376;

  static memoryLocationScanlineRegister: u16 = 0xFF44;
  static memoryLocationCoincidenceCompare: u16 = 0xFF45;
  static memoryLocationLcdStatus: u16 = 0xFF41;
  static memoryLocationLcdControl: u16 = 0xFF40;
}

function _isLcdEnabled(): boolean {
  return checkBitOnByte(7, eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl));
}

function _setLcdStatus(): void {
  // LCD bits Explanation
  // 0                0                    000                    0             00
  //      |Coicedence Interrupt|     |Mode Interrupts|  |coincidence flag|    | Mode |
  // Modes:
  // 0 or 00: H-Blank
  // 1 or 01: V-Blank
  // 2 or 10: Searching Sprites Atts
  // 3 or 11: Transfering Data to LCD Driver

  let lcdStatus: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdStatus);
  if(!_isLcdEnabled()) {
    // Reset scanline cycle counter
    Graphics.scanlineCycleCounter = 0;
    eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, 0);

    // Set to mode 1
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = setBitOnByte(0, lcdStatus);

    // Store the status in memory
    eightBitStoreIntoGBMemory(Graphics.memoryLocationLcdStatus, lcdStatus);
  }

  // Get our current scanline, and lcd mode
  let scanlineRegister: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
  let lcdMode: u8 = lcdStatus & 0x03;

  let newLcdMode: u8 = 0;
  let shouldRequestInterrupt = false;

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
      newLcdMode = 2;
      lcdStatus = resetBitOnByte(0, lcdStatus);
      lcdStatus = resetBitOnByte(1, lcdStatus);
      shouldRequestInterrupt = checkBitOnByte(3, lcdStatus);
    }
  }

  // Check if we want to request an interrupt, and we JUST changed modes
  if(shouldRequestInterrupt && (lcdMode !== newLcdMode)) {
    requestLcdInterrupt();
  }

  // Check for the coincidence flag
  if(eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister) === eightBitLoadFromGBMemory(Graphics.memoryLocationCoincidenceCompare)) {
    lcdStatus = setBitOnByte(2, lcdStatus);
    if(checkBitOnByte(6, lcdStatus)) {
      requestLcdInterrupt();
    }
  } else {
    lcdStatus = resetBitOnByte(3, lcdStatus);
  }

  // Finally, save our status
  eightBitStoreIntoGBMemory(Graphics.memoryLocationLcdStatus, lcdStatus);
}

export function updateGraphics(numberOfCycles: u8): void {

  _setLcdStatus();

  if(_isLcdEnabled()) {
    Graphics.scanlineCycleCounter += numberOfCycles;
  } else {
    return;
  }

  if(Graphics.scanlineCycleCounter >= Graphics.MAX_CYCLES_PER_SCANLINE) {

    // Reset our cycle counter
    Graphics.scanlineCycleCounter = 0;

    // Move to next scanline
    let scanlineRegister: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
    scanlineRegister += 1;

    // Check if we've reached the last scanline
    if(scanlineRegister === 144) {
      // Request a VBlank interrupt
      requestVBlankInterrupt();
    } else if (scanlineRegister > 153) {
      // Check if we overflowed scanlines
      // if so, reset our scanline number
      scanlineRegister = 0;
    } else if (scanlineRegister < 144) {
      // Draw the scanline
      // TODO:
    }

    // Store our scanline
    eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, scanlineRegister);
  }
}
