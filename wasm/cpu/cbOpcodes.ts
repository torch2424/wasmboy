// Imports
import { Cpu } from './index';
import {
  setZeroFlag,
  getZeroFlag,
  setSubtractFlag,
  getSubtractFlag,
  setHalfCarryFlag,
  getHalfCarryFlag,
  setCarryFlag,
  getCarryFlag,
  checkAndSetEightBitCarryFlag,
  checkAndSetEightBitHalfCarryFlag,
  checkAndSetSixteenBitFlagsAddOverflow
} from './flags'
import {
  rotateByteLeft,
  rotateByteRight,
  concatenateBytes
} from '../helpers/index';
import {
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  eightBitLoadFromGBMemory,
  sixteenBitLoadFromGBMemory
} from '../memory/index';


// Logic Instructions
// NOTE: Only CB table uses these for now, was mostly me realizing that I messed up, trying to be all cute and verbose :p
// NOTE: TODO: Refactor honestly shouldn't take that long, and may happen once assembly script is improved
function rotateRegisterLeft(register: u8): u8 {

  // RLC register 8-bit
  // Z 0 0 C
  if((register & 0x80) === 0x80) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }
  register = rotateByteLeft(register);
  if(register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  // Set all other flags to zero
  setSubtractFlag(0);
  setHalfCarryFlag(0);

  // Return the register
  return register;
}

function rotateRegisterRight(register: u8): u8 {

  // RLC register 8-bit
  // Z 0 0 C
  // Check for the last bit, to see if it will be carried
  if ((register & 0x01) > 0) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }
  register = rotateByteRight(register);

  if (register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  // Return the register
  return register;
}

function rotateRegisterLeftThroughCarry(register: u8): u8 {

  // RL register 8-bit
  // Z 0 0 C
  // setting has first bit since we need to use carry
  let hasHighbit = false;
  if((register & 0x80) === 0x80) {
    hasHighbit = true;
  }
  register = rotateByteLeft(register);
  // OR the carry flag to the end
  register = register | getCarryFlag();

  if(hasHighbit) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  if (register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  return register;
}

function rotateRegisterRightThroughCarry(register: u8): u8 {

  // RR register 8-bit
  // Z 0 0 C
  let hasLowBit = false;
  if((register & 0x01) === 0x01) {
    hasLowBit = true;
  }
  register = rotateByteRight(register);
  // OR the carry flag to the end
  register = register | (getCarryFlag() << 7);

  if(hasLowBit) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  if (register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  return register;
}

function shiftLeftRegister(register: u8): u8 {

  // SLA register 8-bit
  // Z 0 0 C
  let hasHighbit = false;
  if((register & 0x80) === 0x80) {
    hasHighbit = true;
  }

  register = register << 1;

  if(hasHighbit) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  if (register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  return register;
}

function shiftRightArithmeticRegister(register: u8): u8 {

  // SRA register 8-bit
  // Z 0 0 C
  // NOTE: This C flag may need to be set to 0;
  // This preserves the MSB (Most significant bit)
  let hasHighbit = false;
  if((register & 0x80) === 0x80) {
    hasHighbit = true;
  }

  let hasLowbit = false;
  if((register & 0x01) === 0x01) {
    hasLowbit = true;
  }

  register = register >> 1;

  if(hasHighbit) {
    register = (register | 0x80);
  }

  if (register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  if(hasLowbit) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  return register;
}

function swapNibblesOnRegister(register: u8): u8 {
  // SWAP register 8-bit
  // Z 0 0 0
  let highNibble = register & 0xF0;
  let lowNibble = register & 0x0F;
  register = (lowNibble << 4) | (highNibble >> 4)

  if (register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(0);

  return register;
}

function shiftRightLogicalRegister(register: u8): u8 {

  // SRA register 8-bit
  // Z 0 0 C
  // NOTE: This C flag may need to be set to 0;
  // This does NOT preserve MSB (most significant bit)

  let hasLowbit = false;
  if((register & 0x01) === 0x01) {
    hasLowbit = true;
  }

  register = register >> 1;

  if (register === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  if(hasLowbit) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  return register;
}

function testBitOnRegister(bitPosition: u8, register: u8): u8 {
  // BIT bitPosition ,register 8-bit
  // Z 0 1 -

  let testByte: u8 = (0x01 << bitPosition);
  let result = (register & testByte);
  if(result === 0x00) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }

  setSubtractFlag(0);
  setHalfCarryFlag(1);

  return register;
}

function setBitOnRegister(bitPosition: u8, bitValue: u8, register: u8): u8 {

  // RES 0,B or SET 0,B depending on bit value

  if(bitValue > 0) {
   let setByte: u8 = (0x01 << bitPosition);
   register = register | setByte;
  } else {
   // NOT (byte we want)
   // 0000 0100 becomes 1111 1011
   let setByte: u8 = ~(0x01 << bitPosition);
   register = register & setByte;
  }

  return register;
}

// Handle CB Opcodes
// NOTE: Program stpes and cycles are standardized depending on the register type
// NOTE: Doing some funny stuff to get around not having arrays or objects
export function handleCbOpcode(cbOpcode: u8): i8 {

  let numberOfCycles: i8 = -1;
  let handledOpcode = false;

  // The result of our cb logic instruction
  let instructionRegisterValue: u8 = 0;
  let instructionRegisterResult: u8 = 0;

  // Get our register number by subtracting 0x07 while cb opcode is above 0x07
  let registerNumber = cbOpcode;
  while (registerNumber > 0x07) {
    registerNumber -= 0x07;
  }

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
    instructionRegisterResult = setBitOnRegister(0, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x8F) {
    // Res 1,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(1, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x97) {
    // Res 2,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(2, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0x9F) {
    // Res 3,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(3, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xA7) {
    // Res 4,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(4, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xAF) {
    // Res 5,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(5, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xB7) {
    // Res 6,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(6, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xBF) {
    // Res 7,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(7, 1, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xC7) {
    // SET 0,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(0, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xCF) {
    // SET 1,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(1, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xD7) {
    // SET 2,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(2, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xDF) {
    // SET 3,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(3, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xE7) {
    // SET 4,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(4, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xEF) {
    // SET 5,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(5, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xF7) {
    // SET 6,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(6, 0, instructionRegisterValue);
    handledOpcode = true;
  } else if (cbOpcode <= 0xFF) {
    // SET 7,register 8-bit
    // - - - -
    instructionRegisterResult = setBitOnRegister(7, 0, instructionRegisterValue);
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
  Cpu.programCounter += 2;

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
