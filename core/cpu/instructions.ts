// Imports
import { Cpu } from './index';
import {
  setZeroFlag,
  setSubtractFlag,
  setHalfCarryFlag,
  setCarryFlag,
  getCarryFlag,
  checkAndSetEightBitCarryFlag,
  checkAndSetEightBitHalfCarryFlag
} from './flags';
import { rotateByteLeft, rotateByteLeftThroughCarry, rotateByteRight, rotateByteRightThroughCarry } from '../helpers/index';
import { u8Portable, u16Portable, i8Portable } from '../portable/portable';

// General Logic Instructions
// Such as the ones found on the CB table and 0x40 - 0xBF
// NOTE: Only CB table uses these for now, was mostly me realizing that I messed up, trying to be all cute and verbose :p
// NOTE: TODO: Refactor honestly shouldn't take that long, and may happen once assembly script is improved
export function addARegister(register: u8): void {
  let registerA = Cpu.registerA;
  checkAndSetEightBitHalfCarryFlag(registerA, register);
  checkAndSetEightBitCarryFlag(registerA, register);
  registerA = u8Portable(registerA + register);
  Cpu.registerA = registerA;
  setZeroFlag(<i32>(registerA === 0));
  setSubtractFlag(0);
}

export function addAThroughCarryRegister(register: u8): void {
  // Handling flags manually as they require some special overflow
  // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // CTRL+F adc
  let registerA = Cpu.registerA;
  let result = u8Portable(registerA + register + getCarryFlag());
  setHalfCarryFlag(<i32>((u8Portable(registerA ^ register ^ result) & 0x10) != 0));

  let overflowedResult = u16Portable(<u16>registerA + <u16>register + <u16>getCarryFlag());
  setCarryFlag(<i32>((overflowedResult & 0x100) > 0));

  Cpu.registerA = result;
  setZeroFlag(<i32>(result === 0));
  setSubtractFlag(0);
}

export function subARegister(register: u8): void {
  // Need to convert the register on one line, and flip the sign on another
  let negativeRegister: i32 = register;
  negativeRegister = negativeRegister * -1;

  let registerA = Cpu.registerA;
  checkAndSetEightBitHalfCarryFlag(registerA, negativeRegister);
  checkAndSetEightBitCarryFlag(registerA, negativeRegister);
  registerA = u8Portable(registerA - register);
  Cpu.registerA = registerA;
  setZeroFlag(<i32>(registerA === 0));
  setSubtractFlag(1);
}

export function subAThroughCarryRegister(register: u8): void {
  // Handling flags manually as they require some special overflow
  // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // CTRL+F adc
  let registerA = Cpu.registerA;
  let result = u8Portable(registerA - register - getCarryFlag());

  let carryRegisterCheck = u8Portable((registerA ^ register ^ result) & 0x10);
  setHalfCarryFlag(<i32>(carryRegisterCheck != 0));

  let overflowedResult = u16Portable(<u16>registerA - <u16>register - <u16>getCarryFlag());
  setCarryFlag(<i32>((overflowedResult & 0x100) > 0));

  Cpu.registerA = result;
  setZeroFlag(<i32>(result === 0));
  setSubtractFlag(1);
}

export function andARegister(register: u8): void {
  let registerA = Cpu.registerA & register;
  Cpu.registerA = registerA;
  setZeroFlag(<i32>(registerA === 0));
  setSubtractFlag(0);
  setHalfCarryFlag(1);
  setCarryFlag(0);
}

export function xorARegister(register: u8): void {
  let registerA = u8Portable(Cpu.registerA ^ register);
  Cpu.registerA = registerA;
  setZeroFlag(<i32>(registerA === 0));
  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(0);
}

export function orARegister(register: u8): void {
  let registerA = Cpu.registerA | register;
  Cpu.registerA = registerA;
  setZeroFlag(<i32>(registerA === 0));
  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(0);
}

export function cpARegister(register: u8): void {
  // 0xB8 - 0xBF
  // CP B
  // 1  4
  // Z 1 H C
  let registerA = Cpu.registerA;
  let negativeRegister: i32 = register;
  negativeRegister = negativeRegister * -1;
  checkAndSetEightBitHalfCarryFlag(registerA, negativeRegister);
  checkAndSetEightBitCarryFlag(registerA, negativeRegister);
  let tempResult = <i32>registerA + negativeRegister;
  setZeroFlag(<i32>(tempResult === 0));
  setSubtractFlag(1);
}

// Inlined because closure compiler inlines
export function rotateRegisterLeft(register: u8): u8 {
  // RLC register 8-bit
  // Z 0 0 C
  setCarryFlag(<i32>((register & 0x80) === 0x80));

  register = rotateByteLeft(register);
  setZeroFlag(<i32>(register === 0));

  // Set all other flags to zero
  setSubtractFlag(0);
  setHalfCarryFlag(0);

  // Return the register
  return register;
}

// Inlined because closure compiler inlines
export function rotateRegisterRight(register: u8): u8 {
  // RLC register 8-bit
  // Z 0 0 C
  // Check for the last bit, to see if it will be carried
  setCarryFlag(<i32>((register & 0x01) > 0));
  register = rotateByteRight(register);

  setZeroFlag(<i32>(register === 0));
  setSubtractFlag(0);
  setHalfCarryFlag(0);

  // Return the register
  return register;
}

// Inlined because closure compiler inlines
export function rotateRegisterLeftThroughCarry(register: u8): u8 {
  // RL register 8-bit
  // Z 0 0 C
  // setting has first bit since we need to use carry
  let hasHighbit = (register & 0x80) === 0x80;
  register = rotateByteLeftThroughCarry(register);

  setCarryFlag(<i32>hasHighbit);
  setZeroFlag(<i32>(register === 0));

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  return register;
}

// Inlined because closure compiler inlines
export function rotateRegisterRightThroughCarry(register: u8): u8 {
  // RR register 8-bit
  // Z 0 0 C
  let hasLowBit = (register & 0x01) === 0x01;
  register = rotateByteRightThroughCarry(register);

  setCarryFlag(<i32>hasLowBit);
  setZeroFlag(<i32>(register === 0));

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  return register;
}

// Inlined because closure compiler inlines
export function shiftLeftRegister(register: u8): u8 {
  // SLA register 8-bit
  // Z 0 0 C
  let hasHighbit = (register & 0x80) === 0x80;
  register = u8Portable(register << 1);

  setCarryFlag(<i32>hasHighbit);
  setZeroFlag(<i32>(register === 0));

  setSubtractFlag(0);
  setHalfCarryFlag(0);

  return register;
}

// Inlined because closure compiler inlines
export function shiftRightArithmeticRegister(register: u8): u8 {
  // SRA register 8-bit
  // Z 0 0 C
  // NOTE: This C flag may need to be set to 0;
  // This preserves the MSB (Most significant bit)
  let hasHighbit = (register & 0x80) === 0x80;
  let hasLowbit = (register & 0x01) === 0x01;

  register = u8Portable(register >> 1);

  if (hasHighbit) {
    register = register | 0x80;
  }

  setZeroFlag(<i32>(register === 0));
  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(<i32>hasLowbit);

  return register;
}

// Inlined because closure compiler inlines
export function swapNibblesOnRegister(register: u8): u8 {
  // SWAP register 8-bit
  // Z 0 0 0
  let highNibble = register & 0xf0;
  let lowNibble = register & 0x0f;
  register = u8Portable((lowNibble << 4) | (highNibble >> 4));

  setZeroFlag(<i32>(register === 0));
  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(0);

  return register;
}

// Inlined because closure compiler inlines
export function shiftRightLogicalRegister(register: u8): u8 {
  // SRA register 8-bit
  // Z 0 0 C
  // NOTE: This C flag may need to be set to 0;
  // This does NOT preserve MSB (most significant bit)

  let hasLowbit = (register & 0x01) === 0x01;
  register = u8Portable(register >> 1);

  setZeroFlag(<i32>(register === 0));
  setSubtractFlag(0);
  setHalfCarryFlag(0);
  setCarryFlag(<i32>hasLowbit);

  return register;
}

export function testBitOnRegister(bitPosition: u8, register: u8): u8 {
  // BIT bitPosition ,register 8-bit
  // Z 0 1 -

  let testByte: u8 = 0x01 << bitPosition;
  let result = register & testByte;

  setZeroFlag(<i32>(result === 0x00));
  setSubtractFlag(0);
  setHalfCarryFlag(1);

  return register;
}

export function setBitOnRegister(bitPosition: u8, bitValue: i32, register: u8): u8 {
  // RES 0,B or SET 0,B depending on bit value

  if (bitValue > 0) {
    let setByte: u8 = 0x01 << bitPosition;
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
  let relativeJumpOffset = i8Portable(<i8>value);
  let programCounter = Cpu.programCounter;
  programCounter = u16Portable(programCounter + relativeJumpOffset);
  // Realtive jump, using bgb debugger
  // and my debugger shows,
  // on JR you need to jump to the relative jump offset,
  // However, if the jump fails (such as conditional), only jump +2 in total

  programCounter = u16Portable(programCounter + 1);
  Cpu.programCounter = programCounter;
}
