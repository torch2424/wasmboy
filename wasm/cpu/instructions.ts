// Imports
import {
  Cpu
} from './index';
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
} from './flags';
import {
  rotateByteLeft,
  rotateByteLeftThroughCarry,
  rotateByteRight,
  rotateByteRightThroughCarry,
  concatenateBytes,
  hexLog
} from '../helpers/index';

// General Logic Instructions
// Such as the ones found on the CB table and 0x40 - 0xBF
// NOTE: Only CB table uses these for now, was mostly me realizing that I messed up, trying to be all cute and verbose :p
// NOTE: TODO: Refactor honestly shouldn't take that long, and may happen once assembly script is improved
export function addARegister(register: u8): void {
  checkAndSetEightBitHalfCarryFlag(Cpu.registerA, register);
  checkAndSetEightBitCarryFlag(Cpu.registerA, register);
  Cpu.registerA += register;
  if (Cpu.registerA === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(0);
}

export function addAThroughCarryRegister(register: u8): void {
  // Handling flags manually as they require some special overflow
  // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // CTRL+F adc
  let result: u8 = Cpu.registerA + register + getCarryFlag();
  if (((Cpu.registerA ^ register ^ result) & 0x10) != 0) {
    setHalfCarryFlag(1);
  } else {
    setHalfCarryFlag(0);
  }

  let overflowedResult: u16 = <u16>Cpu.registerA + <u16>register + <u16>getCarryFlag();
  if((overflowedResult & 0x100) > 0) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  Cpu.registerA = result;
  if (Cpu.registerA === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(0);
}

export function subARegister(register: u8): void {
  // Need to convert the register on one line, and flip the sign on another
  let negativeRegister: i16 = <i16>register;
  negativeRegister = negativeRegister * -1;

  checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
  checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
  Cpu.registerA -= register;
  if (Cpu.registerA === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(1);
}

export function subAThroughCarryRegister(register: u8): void {

  // Handling flags manually as they require some special overflow
  // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // CTRL+F adc
  let result: u8 = Cpu.registerA - register - getCarryFlag();

  if (((Cpu.registerA ^ register ^ result) & 0x10) != 0) {
    setHalfCarryFlag(1);
  } else {
    setHalfCarryFlag(0);
  }

  let overflowedResult: u16 = <u16>Cpu.registerA - <u16>register - <u16>getCarryFlag();
  if((overflowedResult & 0x100) > 0) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  Cpu.registerA = result;
  if (Cpu.registerA === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(1);
}

export function andARegister(register: u8): void {
  Cpu.registerA = (Cpu.registerA & register);
  if (Cpu.registerA === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(0);
  setHalfCarryFlag(1);
  setCarryFlag(0);
}

export function xorARegister(register: u8): void {
  Cpu.registerA = Cpu.registerA ^ register;
  if (Cpu.registerA === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(0);
}

export function orARegister(register: u8): void {
  Cpu.registerA = Cpu.registerA | register;
  if (Cpu.registerA === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(0);
}

export function cpARegister(register: u8): void {
  // 0xB8 - 0xBF
  // CP B
  // 1  4
  // Z 1 H C
  let negativeRegister: i16 = <i16>register;
  negativeRegister = negativeRegister * -1;
  checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
  checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
  let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
  if (tempResult === 0) {
    setZeroFlag(1);
  } else {
    setZeroFlag(0);
  }
  setSubtractFlag(1);
}

export function rotateRegisterLeft(register: u8): u8 {

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

export function rotateRegisterRight(register: u8): u8 {

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

export function rotateRegisterLeftThroughCarry(register: u8): u8 {

  // RL register 8-bit
  // Z 0 0 C
  // setting has first bit since we need to use carry
  let hasHighbit = false;
  if((register & 0x80) === 0x80) {
    hasHighbit = true;
  }
  register = rotateByteLeftThroughCarry(register);

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

export function rotateRegisterRightThroughCarry(register: u8): u8 {

  // RR register 8-bit
  // Z 0 0 C
  let hasLowBit = false;
  if((register & 0x01) === 0x01) {
    hasLowBit = true;
  }
  register = rotateByteRightThroughCarry(register);

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

export function shiftLeftRegister(register: u8): u8 {

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

export function shiftRightArithmeticRegister(register: u8): u8 {

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

export function swapNibblesOnRegister(register: u8): u8 {
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

export function shiftRightLogicalRegister(register: u8): u8 {

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

export function testBitOnRegister(bitPosition: u8, register: u8): u8 {
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

export function setBitOnRegister(bitPosition: u8, bitValue: u8, register: u8): u8 {

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

// Private function for our relative jumps
export function relativeJump(value: u8): void {
  // Need to convert the value to i8, since in this case, u8 can be negative
  let relativeJumpOffset: i8 = <i8>value;

  Cpu.programCounter += relativeJumpOffset;
  // Realtive jump, using bgb debugger
  // and my debugger shows,
  // on JR you need to jump to the relative jump offset,
  // However, if the jump fails (such as conditional), only jump +2 in total

  Cpu.programCounter += 1;
}
