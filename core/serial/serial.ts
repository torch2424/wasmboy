// Link cable / serial implementation
// http://gbdev.gg8.se/wiki/articles/Serial_Data_Transfer_(Link_Cable)
// See TCAGBD, This is like Timer with the Falling Edge detectors

import { Cpu } from '../cpu/index';
import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory } from '../memory/index';
import { requestSerialInterrupt } from '../interrupts/index';
import { checkBitOnByte, resetBitOnByte } from '../helpers/index';

export class Serial {
  // Cycle counter
  static currentCycles: i32 = 0x00;

  // Register locations
  static readonly memoryLocationSerialTransferData: i32 = 0xff01; // SB
  static readonly memoryLocationSerialTransferControl: i32 = 0xff02; // SC

  // Number of bits transferred
  static numberOfBitsTransferred: i32 = 0;

  // Transfer control variables
  static isShiftClockInternal: boolean = false;
  static isClockSpeedFast: boolean = false;
  static transferStartFlag: boolean = false;

  static updateTransferControl(value: i32): boolean {
    Serial.isShiftClockInternal = checkBitOnByte(0, value);
    Serial.isClockSpeedFast = checkBitOnByte(1, value);
    Serial.transferStartFlag = checkBitOnByte(7, value);

    // Allow the original write, and return since we dont need to look anymore
    return true;
  }
}

// Function to initialize our serial values
// Inlined because closure compiler inlines
export function initializeSerial(): void {
  Serial.currentCycles = 0x00;
  Serial.numberOfBitsTransferred = 0;

  if (Cpu.GBCEnabled) {
    // FF01 = 0x00
    eightBitStoreIntoGBMemory(0xff02, 0x7c);
    Serial.updateTransferControl(0x7c);
  } else {
    // FF01 = 0x00
    eightBitStoreIntoGBMemory(0xff02, 0x7e);
    Serial.updateTransferControl(0x7e);
  }
}

// TODO: Finish serial
// See minimal serial: https://github.com/binji/binjgb/commit/64dece05c4ef5a052c4b9b75eb3ddbbfc6677cbe
// Inlined because closure compiler inlines
export function updateSerial(numberOfCycles: i32): void {
  // If we aren't starting our transfer, or transferring,
  // return
  if (!Serial.transferStartFlag) {
    return;
  }

  // Want to increment 4 cycles at a time like an actual GB would
  let cyclesIncreased: i32 = 0;
  while (cyclesIncreased < numberOfCycles) {
    let oldCycles = Serial.currentCycles;
    let curCycles = oldCycles;
    cyclesIncreased += 4;
    curCycles += 4;

    if (curCycles > 0xffff) {
      curCycles -= 0x10000;
    }

    Serial.currentCycles = curCycles;
    if (_checkFallingEdgeDetector(oldCycles, curCycles)) {
      // TODO: Since no actual connection, always transfer 1
      // Need to fix this
      let memoryLocationSerialTransferData = Serial.memoryLocationSerialTransferData;
      let transferData = eightBitLoadFromGBMemory(memoryLocationSerialTransferData);
      transferData = (transferData << 1) + 1;
      transferData = transferData & 0xff;
      eightBitStoreIntoGBMemory(memoryLocationSerialTransferData, transferData);
      let numberOfBitsTransferred = Serial.numberOfBitsTransferred;

      if (++numberOfBitsTransferred === 8) {
        Serial.numberOfBitsTransferred = 0;
        requestSerialInterrupt();

        // Disable transfer start
        let memoryLocationSerialTransferControl = Serial.memoryLocationSerialTransferControl;
        let transferControl = eightBitLoadFromGBMemory(memoryLocationSerialTransferControl);
        eightBitStoreIntoGBMemory(memoryLocationSerialTransferControl, resetBitOnByte(7, transferControl));
        Serial.transferStartFlag = false;
      } else {
        Serial.numberOfBitsTransferred = numberOfBitsTransferred;
      }
    }
  }
}

// Inlined because closure compiler inlines
function _checkFallingEdgeDetector(oldCycles: i32, newCycles: i32): boolean {
  // Get our mask
  let maskBit = _getFallingEdgeMaskBit();

  // If the old register's watched bit was zero,
  // but after adding the new registers wastch bit is now 1
  return checkBitOnByte(maskBit, oldCycles) && !checkBitOnByte(maskBit, newCycles);
}

// Function to get our current tima mask bit
// used for our falling edge detector
// See The docs linked above, or TCAGB for this bit mapping
// Inlined because closure compiler inlines
function _getFallingEdgeMaskBit(): i32 {
  return Serial.isClockSpeedFast ? 2 : 7;
}
