import { Cpu } from './index';
import { consoleLog } from '../helpers/index';

// TODO: Improve this with a modern bitshifting way:
// https://stackoverflow.com/questions/101439/the-most-efficient-way-to-implement-an-integer-based-power-function-powint-int
// TODO: Make a lookup table from bit -> byte representation
function _exponent(numberValue: u8, exponentValue: u8): u8 {
  let result: u8 = numberValue;
  for (let i: u8 = 1; i < exponentValue; i++) {
    result = result * numberValue;
  }
  return result;
}


// Set flag bit on on register F. For instance set zero flag to zero -> (7, 0)
function setFlagBit(flagBit: u8, flagValue: u8): u8 {

  let bitwiseOperand: u8 = 0x00;
  if(flagValue > 0) {
    bitwiseOperand += _exponent(2, flagBit);
    Cpu.registerF = Cpu.registerF | bitwiseOperand;
  } else {
    bitwiseOperand = 0xFF;
    bitwiseOperand -= _exponent(2, flagBit);
    Cpu.registerF = Cpu.registerF & bitwiseOperand;
  }

  return Cpu.registerF;
}

// Overload the set flag bit for ease of use
export function setZeroFlag(value: u8): void {
  setFlagBit(7, value);
}

export function setSubtractFlag(value: u8): void {
  setFlagBit(6, value)
}

export function setHalfCarryFlag(value: u8): void {
  setFlagBit(5, value);
}

export function setCarryFlag(value: u8): void {
  setFlagBit(4, value)
}

// Getters for flags
export function getZeroFlag(): u8 {
  return Cpu.registerF & _exponent(2, 7);
}

export function getSubtractFlag(): u8 {
  return Cpu.registerF & _exponent(2, 6);
}

export function getHalfCarryFlag(): u8 {
  return Cpu.registerF & _exponent(2, 5);
}

export function getCarryFlag(): u8 {
  return Cpu.registerF & _exponent(2, 4);
}

// Must be run before the register actually performs the add
// amountToAdd i16, since max number can be an u8
export function checkAndSetEightBitHalfCarryFlag(value: u8, amountToAdd: i16): void {
  let result: i16 = <i16>value + amountToAdd;
  if(amountToAdd > 0) {
    // https://robdor.com/2016/08/10/gameboy-emulator-half-carry-flag/
    if((result & 0x10) === 0x10) {
      setHalfCarryFlag(1);
    } else {
      setHalfCarryFlag(0);
    }
  } else if (amountToAdd < 0) {
    // Taken from Sub of https://github.com/nakardo/node-gameboy/blob/master/lib/Cpu/opcodes.js
    if (((<i16>value ^ amountToAdd ^ result) & 0x10) != 0) {
      setHalfCarryFlag(1);
    } else {
      setHalfCarryFlag(0);
    }
  }
}

export function checkAndSetEightBitCarryFlag(value: u8, amountToAdd: i16): void {
  let result: i16 = <i16>value + amountToAdd;
  if (amountToAdd > 0) {
    if ((result >> 8) > 0) {
      setCarryFlag(1);
    } else {
      setCarryFlag(0);
    }
  } else {
    if(abs(amountToAdd) > result) {
      setCarryFlag(1);
    } else {
      setCarryFlag(0);
    }
  }
}

// Function to handle 16 bit addition overflow, and set the carry flags accordingly
// i32 to support passing signed immedita values
export function checkAndSetSixteenBitFlagsAddOverflow(valueOne: i32, valueTwo: i32): void {
  // To check for Carry flag (bit 16), knock off all bits below
  let result: i32 = valueOne + valueTwo;
  if((result >> 15) > 0) {
    setCarryFlag(1);
  } else {
    setCarryFlag(0);
  }

  // To check for half carry flag (bit 15), by XOR'ing valyes, and and'ing the bit in question
  if ( ((result ^ valueOne ^ valueTwo) & 0x1000) === 0x1000 ) {
    setHalfCarryFlag(1);
  } else {
    setHalfCarryFlag(0);
  }
}
