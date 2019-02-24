// Imports
import { Cpu } from './index';
import {
  rotateRegisterLeft,
  rotateRegisterRight,
  rotateRegisterLeftThroughCarry,
  rotateRegisterRightThroughCarry,
  shiftLeftRegister,
  shiftRightArithmeticRegister,
  swapNibblesOnRegister,
  shiftRightLogicalRegister,
  testBitOnRegister,
  setBitOnRegister
} from './instructions';
import { eightBitLoadSyncCycles, eightBitStoreSyncCycles } from './opcodes';
import { concatenateBytes } from '../helpers/index';

// Handle CB Opcodes
// NOTE: Program stpes and cycles are standardized depending on the register type
// NOTE: Doing some funny stuff to get around not having arrays or objects
// Inlined because closure compiler inlines.
export function handleCbOpcode(cbOpcode: i32): i32 {
  let numberOfCycles = -1;
  let handledOpcode = false;

  // The result of our cb logic instruction
  let instructionRegisterValue: u8 = 0;
  let instructionRegisterResult: u8 = 0;

  // Get our register number by modulo 0x08 (number of registers)
  // cbOpcode % 0x08
  let registerNumber = cbOpcode & 0x07;

  // NOTE: registerNumber = register on CB table. Cpu.registerB = 0, Cpu.registerC = 1....Cpu.registerA = 7
  switch (registerNumber) {
    case 0:
      instructionRegisterValue = Cpu.registerB;
      break;
    case 1:
      instructionRegisterValue = Cpu.registerC;
      break;
    case 2:
      instructionRegisterValue = Cpu.registerD;
      break;
    case 3:
      instructionRegisterValue = Cpu.registerE;
      break;
    case 4:
      instructionRegisterValue = Cpu.registerH;
      break;
    case 5:
      instructionRegisterValue = Cpu.registerL;
      break;
    case 6:
      // Value at register HL
      // 4 cycles
      instructionRegisterValue = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      break;
    case 7:
      instructionRegisterValue = Cpu.registerA;
      break;
  }

  // Grab the high nibble to perform skips to speed up performance
  let opcodeHighNibble = cbOpcode & 0xf0;
  opcodeHighNibble = opcodeHighNibble >> 4;

  // Send to the correct function
  switch (opcodeHighNibble) {
    case 0x00:
      if (cbOpcode <= 0x07) {
        // RLC register 8-bit
        // Z 0 0 C
        instructionRegisterResult = rotateRegisterLeft(instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x0f) {
        // RRC register 8-bit
        // Z 0 0 C
        instructionRegisterResult = rotateRegisterRight(instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x01:
      if (cbOpcode <= 0x17) {
        // RL register 8-bit
        // Z 0 0 C
        instructionRegisterResult = rotateRegisterLeftThroughCarry(instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x1f) {
        // RR register 8-bit
        // Z 0 0 C
        instructionRegisterResult = rotateRegisterRightThroughCarry(instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x02:
      if (cbOpcode <= 0x27) {
        // SLA register 8-bit
        // Z 0 0 C
        instructionRegisterResult = shiftLeftRegister(instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x2f) {
        // SRA register 8-bit
        // Z 0 0 0
        instructionRegisterResult = shiftRightArithmeticRegister(instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x03:
      if (cbOpcode <= 0x37) {
        // SWAP register 8-bit
        // Z 0 0 0
        instructionRegisterResult = swapNibblesOnRegister(instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x3f) {
        // SRL B
        // Z 0 0 C
        instructionRegisterResult = shiftRightLogicalRegister(instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x04:
      if (cbOpcode <= 0x47) {
        // BIT 0,register 8-bit
        // Z 0 1 -
        //TODO: Optimize this not to do logic of setting register back
        instructionRegisterResult = testBitOnRegister(0, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x4f) {
        // BIT 1,register 8-bit
        // Z 0 1 -
        instructionRegisterResult = testBitOnRegister(1, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x05:
      if (cbOpcode <= 0x57) {
        // BIT 2,register 8-bit
        // Z 0 1 -
        instructionRegisterResult = testBitOnRegister(2, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x5f) {
        // BIT 3,register 8-bit
        // Z 0 1 -
        instructionRegisterResult = testBitOnRegister(3, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x06:
      if (cbOpcode <= 0x67) {
        // BIT 4,register 8-bit
        // Z 0 1 -
        instructionRegisterResult = testBitOnRegister(4, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x6f) {
        // BIT 5,register 8-bit
        // Z 0 1 -
        instructionRegisterResult = testBitOnRegister(5, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x07:
      if (cbOpcode <= 0x77) {
        // BIT 6,register 8-bit
        // Z 0 1 -
        instructionRegisterResult = testBitOnRegister(6, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x7f) {
        // BIT 7,register 8-bit
        // Z 0 1 -
        instructionRegisterResult = testBitOnRegister(7, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x08:
      if (cbOpcode <= 0x87) {
        // Res 0,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(0, 0, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x8f) {
        // Res 1,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(1, 0, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x09:
      if (cbOpcode <= 0x97) {
        // Res 2,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(2, 0, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0x9f) {
        // Res 3,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(3, 0, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x0a:
      if (cbOpcode <= 0xa7) {
        // Res 4,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(4, 0, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0xaf) {
        // Res 5,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(5, 0, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x0b:
      if (cbOpcode <= 0xb7) {
        // Res 6,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(6, 0, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0xbf) {
        // Res 7,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(7, 0, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x0c:
      if (cbOpcode <= 0xc7) {
        // SET 0,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(0, 1, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0xcf) {
        // SET 1,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(1, 1, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x0d:
      if (cbOpcode <= 0xd7) {
        // SET 2,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(2, 1, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0xdf) {
        // SET 3,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(3, 1, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x0e:
      if (cbOpcode <= 0xe7) {
        // SET 4,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(4, 1, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0xef) {
        // SET 5,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(5, 1, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
    case 0x0f:
      if (cbOpcode <= 0xf7) {
        // SET 6,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(6, 1, instructionRegisterValue);
        handledOpcode = true;
      } else if (cbOpcode <= 0xff) {
        // SET 7,register 8-bit
        // - - - -
        instructionRegisterResult = setBitOnRegister(7, 1, instructionRegisterValue);
        handledOpcode = true;
      }
      break;
  }

  // Finally Pass back into the correct register
  switch (registerNumber) {
    case 0:
      Cpu.registerB = instructionRegisterResult;
      break;
    case 1:
      Cpu.registerC = instructionRegisterResult;
      break;
    case 2:
      Cpu.registerD = instructionRegisterResult;
      break;
    case 3:
      Cpu.registerE = instructionRegisterResult;
      break;
    case 4:
      Cpu.registerH = instructionRegisterResult;
      break;
    case 5:
      Cpu.registerL = instructionRegisterResult;
      break;
    case 6:
      // Value at register HL

      // Opcodes 0x40 -> 0x7F only do simple
      // Bit test, and don't need to be stored back in memory
      // Thus they take 4 less cycles to run
      if (opcodeHighNibble < 0x04 || opcodeHighNibble > 0x07) {
        // Store the result back
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), instructionRegisterResult);
      }
      break;
    case 7:
      Cpu.registerA = instructionRegisterResult;
      break;
  }

  // Finally our number of cycles
  // Set if we handled the opcode
  if (handledOpcode) {
    numberOfCycles = 4;
  }

  // Return our number of cycles
  return numberOfCycles;
}
