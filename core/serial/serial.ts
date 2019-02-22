// Link cable / serial implementation
// http://gbdev.gg8.se/wiki/articles/Serial_Data_Transfer_(Link_Cable)
// See TCAGBD, This is like Timer with the Falling Edge detectors

import { getSaveStateMemoryOffset } from '../core';
import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { requestSerialInterrupt } from '../interrupts/index';
import { checkBitOnByte, setBitOnByte, resetBitOnByte, hexLog } from '../helpers/index';

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
    let oldCycles: i32 = Serial.currentCycles;
    cyclesIncreased += 4;
    Serial.currentCycles += 4;

    if (Serial.currentCycles > 0xffff) {
      Serial.currentCycles -= 0x10000;
    }

    if (_checkFallingEdgeDetector(oldCycles, Serial.currentCycles)) {
      // TODO: Since no actual connection, always transfer 1
      // Need to fix this
      let transferData: i32 = eightBitLoadFromGBMemory(Serial.memoryLocationSerialTransferData);
      transferData = (transferData << 1) + 1;
      transferData = transferData & 0xff;
      eightBitStoreIntoGBMemory(Serial.memoryLocationSerialTransferData, transferData);
      Serial.numberOfBitsTransferred += 1;

      if (Serial.numberOfBitsTransferred === 8) {
        Serial.numberOfBitsTransferred = 0;
        requestSerialInterrupt();

        // Disable transfer start
        let transferControl = eightBitLoadFromGBMemory(Serial.memoryLocationSerialTransferControl);
        eightBitStoreIntoGBMemory(Serial.memoryLocationSerialTransferControl, resetBitOnByte(7, transferControl));
        Serial.transferStartFlag = false;
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
  if (checkBitOnByte(maskBit, oldCycles) && !checkBitOnByte(maskBit, newCycles)) {
    return true;
  }

  return false;
}

// Function to get our current tima mask bit
// used for our falling edge detector
// See The docs linked above, or TCAGB for this bit mapping
// Inlined because closure compiler inlines
function _getFallingEdgeMaskBit(): i32 {
  if (Serial.isClockSpeedFast) {
    return 2;
  }
  return 7;
}
