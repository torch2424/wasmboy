// Imports
import {
  Cpu 
} from './index';
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
import {
  consoleLog,
  concatenateBytes
} from '../helpers/index';
import {
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  eightBitLoadFromGBMemory,
  sixteenBitLoadFromGBMemory
} from '../memory/index';




// Handle CB Opcodes
// NOTE: Program stpes and cycles are standardized depending on the register type
// NOTE: Doing some funny stuff to get around not having arrays or objects
export function handleCbOpcode(cbOpcode: u8): i8 {

  let numberOfCycles: i8 = -1;
  let handledOpcode = false;

  // The result of our cb logic instruction
  let instructionRegisterValue: u8 = 0;
  let instructionRegisterResult: u8 = 0;

  // Get our register number by modulo 0x08 (number of registers)
  // cbOpcode % 0x08
  let registerNumber = cbOpcode % 0x08;

  // NOTE: registerNumber = register on CB table. Cpu.registerB = 0, Cpu.registerC = 1....Cpu.registerA = 7
  if(registerNumber === 0) {
    instructionRegisterValue = Cpu.registerB;
  } else if (registerNumber === 1) {
    instructionRegisterValue = Cpu.registerC;
  } else if (registerNumber === 2) {
    instructionRegisterValue = Cpu.registerD;
  } else if (registerNumber === 3) {
    instructionRegisterValue = Cpu.registerE;
  } else if (registerNumber === 4) {
    instructionRegisterValue = Cpu.registerH;
  } else if (registerNumber === 5) {
    instructionRegisterValue = Cpu.registerL;
  } else if (registerNumber === 6) {
    // Value at register HL
    instructionRegisterValue = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
  } else if (registerNumber === 7) {
    instructionRegisterValue = Cpu.registerA;
  }

  // Send to the correct function
  if (cbOpcode <= 0x07) {
    // RLC register 8-bit
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterLeft(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x0F) {
    // RRC register 8-bit
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterRight(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x17) {
    // RL register 8-bit
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterLeftThroughCarry(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x1F) {
    // RR register 8-bit
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterRightThroughCarry(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x27) {
    // SLA register 8-bit
    // Z 0 0 C
    instructionRegisterResult = shiftLeftRegister(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x2F) {
    // SRA register 8-bit
    // Z 0 0 0
    instructionRegisterResult = shiftRightArithmeticRegister(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x37) {
    // SWAP register 8-bit
    // Z 0 0 0
    instructionRegisterResult = swapNibblesOnRegister(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x3F) {
    // SRL B
    // Z 0 0 C
    instructionRegisterResult = shiftRightLogicalRegister(instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x47) {
    // BIT 0,register 8-bit
    // Z 0 1 -
    //TODO: Optimize this not to do logic of setting register back
    instructionRegisterResult = testBitOnRegister(0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x4F) {
    // BIT 1,register 8-bit
    // Z 0 1 -
    instructionRegisterResult = testBitOnRegister(1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x57) {
    // BIT 2,register 8-bit
    // Z 0 1 -
    instructionRegisterResult = testBitOnRegister(2, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x5F) {
    // BIT 3,register 8-bit
    // Z 0 1 -
    instructionRegisterResult = testBitOnRegister(3, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x67) {
    // BIT 4,register 8-bit
    // Z 0 1 -
    instructionRegisterResult = testBitOnRegister(4, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x6F) {
    // BIT 5,register 8-bit
    // Z 0 1 -
    instructionRegisterResult = testBitOnRegister(5, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x77) {
    // BIT 6,register 8-bit
    // Z 0 1 -
    instructionRegisterResult = testBitOnRegister(6, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x7F) {
    // BIT 7,register 8-bit
    // Z 0 1 -
    instructionRegisterResult = testBitOnRegister(7, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x87) {
    // Res 0,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(0, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x8F) {
    // Res 1,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(1, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x97) {
    // Res 2,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(2, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x9F) {
    // Res 3,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(3, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xA7) {
    // Res 4,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(4, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xAF) {
    // Res 5,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(5, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xB7) {
    // Res 6,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(6, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xBF) {
    // Res 7,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(7, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xC7) {
    // SET 0,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(0, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xCF) {
    // SET 1,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(1, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xD7) {
    // SET 2,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(2, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xDF) {
    // SET 3,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(3, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xE7) {
    // SET 4,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(4, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xEF) {
    // SET 5,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(5, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xF7) {
    // SET 6,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(6, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xFF) {
    // SET 7,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(7, 1, instructionRegisterValue);
    handledOpcode = true;
  }

  // Finally Pass back into the correct register
  if(registerNumber === 0) {
    Cpu.registerB = instructionRegisterResult;
  } else if (registerNumber === 1) {
    Cpu.registerC = instructionRegisterResult;
  } else if (registerNumber === 2) {
    Cpu.registerD = instructionRegisterResult;
  } else if (registerNumber === 3) {
    Cpu.registerE = instructionRegisterResult;
  } else if (registerNumber === 4) {
    Cpu.registerH = instructionRegisterResult;
  } else if (registerNumber === 5) {
    Cpu.registerL = instructionRegisterResult;
  } else if (registerNumber === 6) {
    // Value at register HL
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), instructionRegisterResult);
  } else if (registerNumber === 7) {
    Cpu.registerA = instructionRegisterResult;
  }

  // Increase program counter, as all CB codes take two bytes
  // Program counter will really increase by two since opcodes handles the other
  Cpu.programCounter += 1;

  // Finally our number of cycles
  // Set if we handled the opcode
  if (handledOpcode) {
    // Next if register number was 6 (HL), number of cycles is 16
    if(registerNumber === 6) {
      numberOfCycles = 16
    } else {
      numberOfCycles = 8;
    }
  }

  // Return our number of cycles
  return numberOfCycles;
}
