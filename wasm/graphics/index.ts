import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory } from '../memory/index';
import { requestVBlankInterrupt } from '../interrupts/index';
import { checkBitOnByte } from '../helpers/index';

class Graphics {
  // Count the number of cycles to keep synced with cpu cycles
  static scanlineCycleCounter: i16 = 0x00;
  static MAX_CYCLES_PER_SCANLINE: i16 = 456;

  static memoryLocationScanlineRegister: u16 = 0xFF44;
  static memoryLocationLcdStatus: u16 = 0xFF41;
  static memoryLocationLcdControl: u16 = 0xFF40;
}

function _isLcdEnabled(): boolean {
  return checkBitOnByte(7, eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl));
}

export function updateGraphics(numberOfCycles: u8): void {
  // TODO: Set lcd status?

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
