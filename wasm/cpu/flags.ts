import { Cpu } from './index';
import { consoleLog } from '../helpers/index';


// Set flag bit on on register F. For instance set zero flag to zero -> (7, 0)
function setFlagBit(flagBit: u8, flagValue: u8): u8 {

  let bitwiseOperand: u8 = 0x01 << flagBit;
  if(flagValue > 0) {
    Cpu.registerF = Cpu.registerF | bitwiseOperand;
  } else {
    // XOR out the two ones
    bitwiseOperand = 0xFF ^ bitwiseOperand;
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
  return (Cpu.registerF >> 7) & 0x01;
}

export function getSubtractFlag(): u8 {
  return (Cpu.registerF >> 6) & 0x01;
}

export function getHalfCarryFlag(): u8 {
  return (Cpu.registerF >> 5) & 0x01;
}

export function getCarryFlag(): u8 {
  return (Cpu.registerF >> 4) & 0x01;
}

// Must be run before the register actually performs the add
// amountToAdd i16, since max number can be an u8
export function checkAndSetEightBitHalfCarryFlag(value: u8, amountToAdd: i16): void {
  if(amountToAdd > 0) {
    // https://robdor.com/2016/08/10/gameboy-emulator-half-carry-flag/
    let result = (((value & 0xf) + (<u8>amountToAdd & 0xf)) & 0x10)
    if(result === 0x10) {
      setHalfCarryFlag(1);
    } else {
      setHalfCarryFlag(0);
    }
  } else {
    // From: https://github.com/djhworld/gomeboycolor/blob/master/src/cpu/cpu.go
    // CTRL+F "subBytes(a, b byte)"
    if((value & 0x0F) < <u8>(abs(amountToAdd) & 0x0F)) {
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
    if(abs(amountToAdd) > value) {
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
