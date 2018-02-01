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
} from './helpers';
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
  // 2  8
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
  // 2  8
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
  // 2  8
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
  // 2  8
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
  // 2  8
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

// Handle CB Opcodes
// NOTE: Doing some funny stuff to get around not having arrays or objects
export function handleCbOpcode(cbOpcode: u8): i8 {

  let numberOfCycles: i8 = -1;

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
    // 2  8
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterLeft(instructionRegisterValue);
    numberOfCycles = 8;
  } else if (cbOpcode <= 0x0F) {
    // RRC register 8-bit
    // 2 8
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterRight(instructionRegisterValue);
    numberOfCycles = 8;
  } else if (cbOpcode <= 0x17) {
    // RL register 8-bit
    // 2  8
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterLeftThroughCarry(instructionRegisterValue);
    numberOfCycles = 8;
  } else if (cbOpcode <= 0x1F) {
    // RR register 8-bit
    // 2  8
    // Z 0 0 C
    instructionRegisterResult = rotateRegisterRightThroughCarry(instructionRegisterValue);
    numberOfCycles = 8;
  } else if (cbOpcode <= 0x27) {
    // SLA register 8-bit
    // 2  8
    // Z 0 0 C
    instructionRegisterResult = shiftLeftRegister(instructionRegisterValue);
    numberOfCycles = 8;
  } else if (cbOpcode <= 0x2F) {
    // SRA register 8-bit
    // 2  8
    // Z 0 0 0
    // TODO:
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

  // Return our number of cycles
  return numberOfCycles;
}
