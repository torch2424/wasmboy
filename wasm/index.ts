// https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
// NOTE: Code is very verbose, and will have some copy pasta'd lines.
// Reason being, I want the code to be very accessible for errors later on.
// Also, the benefit on splitting into functions is organizarion, and keeping things DRY.
// But since I highly doubt the GB CPU will be changing, DRY is no longer an issue
// And the verbosity / ease of use is more important, imo.

/***********************
    Utility
***********************/

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

function _rotateByteLeft(value: u8): u8 {
  // Rotate left
  // https://stackoverflow.com/questions/19204750/how-do-i-perform-a-circular-rotation-of-a-byte
  // 4-bit example:
  // 1010 -> 0100 | 0001
  return (value << 1) | (value >> 7);
}

function _rotateByteRight(value: u8): u8 {
  // Rotate right
  // 4-bit example:
  // 1010 -> 0101 | 0000
  return (value >> 1) | (value << 7);
}

// Wrapper funcstions around load/store for assemblyscript offset to gb mem offset
// TODO: Ensure store is hitting right values: https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
function _eightBitStoreIntoGBMemory(offset: u8, value: u8): void {
  store<u8>(offset, value);
}

function _sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {
  store<u16>(offset, value);
}

function _eightBitLoadFromGBMemory(offset: u16): u8 {
  return load<u8>(offset);
}

function _sixteenBitLoadFromGBMemory(offset: u16): u16 {
  return load<u16>(offset);
}

/***********************
    Registers & Flags
***********************/

// 8-bit registers
let registerA: u8 = 0,
    registerB: u8 = 0,
    registerC: u8 = 0,
    registerD: u8 = 0,
    registerE: u8 = 0,
    registerH: u8 = 0,
    registerL: u8 = 0,
    registerF: u8 = 0;

// Set flag bit on on register F. For instance set zero flag to zero -> (7, 0)
function _setFlagBit(flagBit: u8, flagValue: u8): u8 {
  let bitwiseOperand: u8 = 0x00;
  if(flagValue > 0) {
    bitwiseOperand += _exponent(2, flagBit);
    registerF = registerF | bitwiseOperand;
  } else {
    bitwiseOperand = 0xFF;
    bitwiseOperand -= _exponent(2, flagBit);
    registerF = registerF & bitwiseOperand;
  }

  return registerF;
}

// Overload the set flag bit for ease of use
function _setZeroFlag(value: u8): void {
  _setFlagBit(7, value);
}

function _setSubtractFlag(value: u8): void {
  _setFlagBit(6, value)
}

function _setHalfCarryFlag(value: u8): void {
  _setFlagBit(5, value);
}

function _setCarryFlag(value: u8): void {
  _setFlagBit(4, value)
}

// Getters for flags
function _getZeroFlag(): u8 {
  return registerF & _exponent(2, 7);
}

function _getSubtractFlag(): u8 {
  return registerF & _exponent(2, 6);
}

function _getHalfCarryFlag(): u8 {
  return registerF & _exponent(2, 5);
}

function _getCarryFlag(): u8 {
  return registerF & _exponent(2, 4);
}


// Must be run before the register actually performs the add
// amountToAdd i16, since max number can be an u8
function _checkAndSetEightBitHalfCarryFlag(value: u8, amountToAdd: i16): void {
  // Knock off higher bits, then check for the value
  let lastNibbleOfAmountToAdd: i8 = <i8>(amountToAdd << 12) >> 12;
  if(amountToAdd > 0) {
    let lastThreeBitsOfValue = (value << 5) >> 5;
    // Set if going to set the 4th bit
    let result: u8 = lastThreeBitsOfValue + <u8>lastNibbleOfAmountToAdd;
    if(result > 7) {
      _setFlagBit(5, 1);
    }
  } else if (amountToAdd < 0) {
    // set if NOT going to borrow form bit 4
    let lastNibbleOfValue = (value << 4) >> 4;
    lastNibbleOfAmountToAdd = lastNibbleOfAmountToAdd * -1;
    let result: i8 = <i8>lastNibbleOfValue - lastNibbleOfAmountToAdd;
    if(result < 8) {
      _setFlagBit(5, 1);
    }
  }
}

function _checkAndSetEightBitCarryFlag(value: u8, amountToAdd: i16): void {
  const result: i16 = value + amountToAdd;
  if ((result >> 8) > 0) {
    _setCarryFlag(1);
  } else {
    _setCarryFlag(0);
  }
}

// 16-bit registers
let stackPointer: u16 = 0;
let programCounter: u16 = 0;

// Function to get the program counter externally, to get the next set of opcode/bytes
export function getProgramCounter(): u16 {
  return programCounter;
}

// Private function for our relative jumps
function _relativeJump(value: u8): void {
  // Need to convert the value to i8, since in this case, u8 can be negative
  let relativeJumpOffset: i8 = <i8> value;
  programCounter += relativeJumpOffset;
  // TODO: Increase or decrease programCounter?
  // Undo programCounter offset at end
  programCounter -= 1;
  // programCounter += 1; ?
}

// Grouped registers
// possible overload these later to performace actions
// AF, BC, DE, HL
function _concatenateBytes(highByte: u8, lowByte: u8): u16 {
  //https://stackoverflow.com/questions/38298412/convert-two-bytes-into-signed-16-bit-integer-in-javascript
  let highByteExpanded: u16 = highByte;
  return (((highByteExpanded & 0xFF) << 8) | (lowByte & 0xFF))
}

function _splitBytes(groupedByte: u16, highByte: u8, lowByte: u8): void {
  highByte = <u8>((groupedByte & 0xFF00) >> 8);
  lowByte = <u8>groupedByte & 0x00FF;
}

// Function to handle 16 bit addition overflow, and set the carry flags accordingly
function _checkAndSetSixteenBitFlagsAddOverflow(valueOne: u16, valueTwo: u16): void {
  // To check for Carry flag (bit 16), knock off all bits below
  let result: i32 = valueOne + valueTwo;
  if((result >> 15) > 0) {
    _setCarryFlag(1);
  } else {
    _setCarryFlag(0);
  }

  // To check for half carry flag (bit 15), by XOR'ing valyes, and and'ing the bit in question
  if ( ((result ^ valueOne ^ valueTwo) & 0x1000) === 0x1000 ) {
    _setHalfCarryFlag(1);
  } else {
    _setHalfCarryFlag(0);
  }
}

/***********************
    Memory
***********************/

// https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
// http://gameboy.mongenel.com/dmg/asmmemmap.html
// using Arrays, first index is start, second is end
const memoryCartridgeRomLocationStart = 0x0000;
const memoryCartridgeRomLocationEnd = 0x3FFF;
const memorySwitchableCartridgeRomLocationStart = 0x4000;
const memorySwitchableCartridgeRomLocationEnd = 0x7FFF;
const memoryVideoRamStart = 0x8000;
const memoryVideoRamEnd = 0x9FFF;
const memoryCartridgeRamLocationStart = 0xA000;
const memoryCartridgeRamLocationEnd = 0xBFFF;
const memoryInternalRamBankZeroLocationStart = 0xC000;
const memoryInternalRamBankZeroLocationEnd = 0xCFFF;
const memoryInternalRamBankOneThroughSevenStart = 0xD000;
const memoryInternalRamBankOneThroughSevenEnd = 0xDFFF;
// Echo Ram, Do not use, 0xE000 -> 0xFDFF
const memorySpriteInformationTableStart = 0xFE00;
const memorySpriteInformationTableEnd = 0xFE9F;
// Unusable memory, 0xFEA0 -> 0xFEFF
// Hardware I/O, 0xFF00 -> 0xFF7F
// Zero Page, 0xFF80 -> 0xFFFE
// Intterupt Enable Flag, 0xFFFF

/***********************
    Decode Opcodes
***********************/

// Private funciton to check if an opcode is a value
// this is to get out of switch statements, and not have the dangling break; per javascript syntax
// And allow repeated variable names, for when we are concatenating registers
function _isOpcode(opcode: u8, value: u8): boolean {
  if(opcode === value) {
    return true;
  }
  return false;
}


// Take in any opcode, and decode it, and return the number of cycles
// Program counter can be gotten from getProgramCounter();
// Setting return value to i32 instead of u16, as we want to return a negative number on error
// https://rednex.github.io/rgbds/gbz80.7.html
// http://pastraiser.com/cpu/gameboy/gameboy_opcodes.html
export function handleOpcode(opcode: u8, dataByteOne: u8, dataByteTwo: u8): i8 {

  // Initialize our number of cycles
  // Return -1 if no opcode was found, representing an error
  let numberOfCycles: i8 = -1;

  if(_isOpcode(opcode, 0x00)) {

    // NOP
    // 1  4
    // No Operation
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x01)) {

    // LD BC,d16
    // 3  12
    registerB = dataByteOne;
    registerC = dataByteTwo;
    programCounter += 2;
    numberOfCycles = 12;
  } else if(_isOpcode(opcode, 0x02)) {

    // LD (BC),A
    // 3  12
    // () means load into address pointed by BC
    _sixteenBitStoreIntoGBMemory(_concatenateBytes(registerB, registerC), registerA);
    programCounter += 2;
    numberOfCycles = 12;
  } else if(_isOpcode(opcode, 0x03)) {

    // INC BC
    // 1  8
    let BC: u16 = _concatenateBytes(registerB, registerC);
    BC++;
    _splitBytes((<u16>BC), registerB, registerC);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x04)) {

    // INC B
    // 1  4
    // Z 0 H -
    _checkAndSetEightBitHalfCarryFlag(registerB, 1);
    registerB += 1;
    if (registerB === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x05)) {

    // DEC B
    // 1  4
    // Z 1 H -
    _checkAndSetEightBitHalfCarryFlag(registerB, -1);
    registerB -= 1;
    if (registerB == 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x06)) {

    // LD B,d8
    // 2  8
    registerB = dataByteOne;
    programCounter += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x07)) {

    // RLCA
    // 1  4
    // 0 0 0 C
    // Check for the carry
    if((registerA & 0x80) === 0x80) {
      _setCarryFlag(1);
    } else {
      _setCarryFlag(0);
    }
    registerA = _rotateByteLeft(registerA);
    // Set all other flags to zero
    _setZeroFlag(0);
    _setSubtractFlag(0);
    _setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x08)) {

    // LD (a16),SP
    // 3  20
    // Load the stack pointer into the 16 bit address represented by the two data bytes
    _sixteenBitStoreIntoGBMemory(_concatenateBytes(dataByteOne, dataByteTwo), stackPointer);
    programCounter += 2;
    numberOfCycles = 20;
  } else if(_isOpcode(opcode, 0x09)) {

    // ADD HL,BC
    // 1 8
    // - 0 H C
    let registerHL: u16 = _concatenateBytes(registerH, registerL);
    let registerBC: u16 = _concatenateBytes(registerB, registerC);
    _checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerBC);
    let result: u16 = <u16>(registerHL + registerBC);
    _splitBytes(<u16>result, registerH, registerL);
    _setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x0A)) {

    // LD A,(BC)
    // 1 8
    let bytesAtBC: u8 = _eightBitLoadFromGBMemory(_concatenateBytes(registerB, registerC));
    registerA = <u8>bytesAtBC;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x0B)) {

    // DEC BC
    // 1  8
    let registerBC = _concatenateBytes(registerB, registerC);
    registerBC -= 1;
    _splitBytes(registerBC, registerB, registerC);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x0C)) {

    // INC C
    // 1  4
    // Z 0 H -
    _checkAndSetEightBitHalfCarryFlag(registerC, 1);
    registerC += 1;
    if (registerC === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x0D)) {

    // DEC C
    // 1  4
    // Z 1 H -
    _checkAndSetEightBitHalfCarryFlag(registerC, -1);
    registerC -= 1;
    if (registerC === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x0E)) {

    // LD C,d8
    // 2 8
    registerC = dataByteOne;
    programCounter += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x0F)) {

    // RRCA
    // 1 4
    // 0 0 0 C
    // Check for the last bit, to see if it will be carried
    if ((registerA & 0x01) > 0) {
      _setCarryFlag(1);
    } else {
      _setCarryFlag(0);
    }
    registerA = _rotateByteRight(registerA);
    // Set all other flags to zero
    _setZeroFlag(0);
    _setSubtractFlag(0);
    _setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x10)) {

    // STOP 0
    // 2 4
    // Enter CPU very low power mode?
    // TODO
    programCounter += 1;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x11)) {

    // LD DE,d16
    // 3  12
    registerD = dataByteOne;
    registerE = dataByteTwo;
    programCounter += 2;
    numberOfCycles = 12;
  } else if(_isOpcode(opcode, 0x12)) {

    // LD (DE),A
    // 1 8
    _sixteenBitStoreIntoGBMemory(_concatenateBytes(registerD, registerE), registerA);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x13)) {

    // INC DE
    // 1 8
    let registerDE = _concatenateBytes(registerD, registerE);
    registerDE += 1;
    _splitBytes(registerDE, registerD, registerE);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x14)) {

    // INC D
    // 1  4
    // Z 0 H -
    _checkAndSetEightBitHalfCarryFlag(registerD, 1);
    registerD += 1;
    if (registerD === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x15)) {

    // DEC D
    // 1  4
    // Z 1 H -
    _checkAndSetEightBitHalfCarryFlag(registerD, -1);
    registerD -= 1;
    if (registerD === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x16)) {
    // LD D,d8
    // 2 8
    registerD = dataByteOne;
    programCounter += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x17)) {
    // RLA
    // 1 4
    // 0 0 0 C
    // Check for the carry
    // setting has first bit since we need to use carry
    let hasHighbit = false;
    if((registerA & 0x80) === 0x80) {
      hasHighbit = true;
    }
    registerA = _rotateByteLeft(registerA);
    // OR the carry flag to the end
    registerA = registerA | _getCarryFlag();
    if(hasHighbit) {
      _setCarryFlag(1);
    } else {
      _setCarryFlag(0);
    }
    // Set all other flags to zero
    _setZeroFlag(0);
    _setSubtractFlag(0);
    _setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x18)) {

    // JR r8
    // 2  12
    _relativeJump(dataByteOne);
    numberOfCycles = 12;
    // No programCounter on relative jump
  } else if(_isOpcode(opcode, 0x19)) {

    // ADD HL,DE
    // 1  8
    // - 0 H C
    let registerHL: u16 = _concatenateBytes(registerH, registerL);
    let registerDE: u16 = _concatenateBytes(registerD, registerE);
    _checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerDE);
    let result: u16 = <u16>(registerHL + registerDE);
    _splitBytes(<u16>result, registerH, registerL);
    _setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x1A)) {

    // LD A,(DE)
    // 1 8
    registerA = _eightBitLoadFromGBMemory(_concatenateBytes(registerD, registerE));
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x1B)) {

    // DEC DE
    // 1 8
    let registerDE = _concatenateBytes(registerD, registerE);
    registerDE -= 1;
    _splitBytes(registerDE, registerD, registerE);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x1C)) {

    // INC E
    // 1  4
    // Z 0 H -
    _checkAndSetEightBitHalfCarryFlag(registerE, 1);
    registerE += 1;
    if (registerE === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x1D)) {

    // DEC E
    // 1  4
    // Z 1 H -
    _checkAndSetEightBitHalfCarryFlag(registerE, -1);
    registerE -= 1;
    if (registerE === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x1E)) {

    // LD E,d8
    // 2 8
    registerE = dataByteOne;
    programCounter += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x1F)) {

    // RRA
    // 1 4
    // 0 0 0 C
    // Check for the carry
    // setting has low bit since we need to use carry
    let hasLowBit = false;
    if((registerA & 0x01) === 0x01) {
      hasLowBit = true;
    }
    registerA = _rotateByteRight(registerA);
    // OR the carry flag to the end
    registerA = registerA | (_getCarryFlag() << 7);
    if(hasLowBit) {
      _setCarryFlag(1);
    } else {
      _setCarryFlag(0);
    }
    // Set all other flags to zero
    _setZeroFlag(0);
    _setSubtractFlag(0);
    _setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x20)) {

    // JR NZ,r8
    // 2  12/8
    // NOTE: NZ stands for not [flag], so in this case, not zero flag
    // Also, / means, if condition. so if met, 12 cycles, otherwise 8 cycles
    if (_getZeroFlag() === 0) {
      _relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No programCounter on relative jump
  } else if(_isOpcode(opcode, 0x21)) {

    // LD HL,d16
    // 3  12
    _splitBytes(_concatenateBytes(dataByteOne, dataByteTwo), registerH, registerL);
    numberOfCycles = 12;
    programCounter += 1;
  } else if(_isOpcode(opcode, 0x22)) {

    // LD (HL+),A
    // 1 8
    let registerHL = _concatenateBytes(registerH, registerL);
    _sixteenBitStoreIntoGBMemory(registerHL, registerA);
    registerHL += 1;
    _splitBytes(registerHL, registerH, registerL);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x23)) {

    // INC HL
    // 1  8
    let registerHL = _concatenateBytes(registerH, registerL);
    registerHL += 1;
    _splitBytes(registerHL, registerH, registerL);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x24)) {

    // INC H
    // 1  4
    // Z 0 H -
    _checkAndSetEightBitHalfCarryFlag(registerH, 1);
    registerH += 1;
    if (registerH === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x25)) {

    // DEC H
    // 1  4
    // Z 1 H -
    _checkAndSetEightBitHalfCarryFlag(registerH, -1);
    registerH -= 1;
    if (registerH === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x26)) {

    // LD H,d8
    // 2 8
    registerH = dataByteOne;
    programCounter += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x27)) {

    // DAA
    // 1 4
    // Z - 0 C
    let adjustedRegister: u8 = 0;
    let adjustment: u8 = 0;

    if(_getHalfCarryFlag() > 0) {
      adjustment = adjustment | 0x06;
    }
    if(_getCarryFlag() > 0) {
      adjustment = adjustment | 0x60;
    }

    if(_getSubtractFlag() > 0) {
      adjustedRegister = registerA - <u8>adjustment;
    } else {
      if ((registerA >> 3) > 0) {
        adjustment = adjustment | 0x06;
      }
      if(registerA > 0x99) {
        adjustment = adjustment | 0x60;
      }
      adjustedRegister = registerA + <u8>adjustment;
    }

    // Now set our flags to the correct values
    if(adjustedRegister === 0) {
      _setZeroFlag(1);
    } else {
      _setZeroFlag(0);
    }
    if( (adjustment & 0x60) !== 0) {
      _setCarryFlag(1);
    } else {
      _setCarryFlag(0);
    }
    _setHalfCarryFlag(0);

    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x28)) {

    // JR Z,r8
    // 2  12/8
    if(_getZeroFlag() > 0) {
      _relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No program counter on relative jump
  } else if(_isOpcode(opcode, 0x29)) {

    // ADD HL,HL
    // 1  8
    // - 0 H C
    let registerHL = _concatenateBytes(registerH, registerL);
    _checkAndSetSixteenBitFlagsAddOverflow(registerHL, registerHL);
    registerHL = registerHL * 2;
    _splitBytes(registerHL, registerH, registerL);
    _setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x2A)) {

    // LD A,(HL+)
    // 1  8
    let registerHL = _concatenateBytes(registerH, registerL);
    registerA = _eightBitLoadFromGBMemory(registerHL);
    registerHL += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x2B)) {

    // DEC HL
    // 1 8
    let registerHL = _concatenateBytes(registerH, registerL);
    registerHL += -1;
    _splitBytes(registerHL, registerH, registerL);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x2C)) {

    // INC L
    // 1  4
    // Z 0 H -
    _checkAndSetEightBitHalfCarryFlag(registerL, 1);
    registerL += 1;
    if (registerL === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x2D)) {

    // DEC L
    // 1  4
    // Z 1 H -
    _checkAndSetEightBitHalfCarryFlag(registerL, -1);
    registerL -= 1;
    if (registerL === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x2E)) {
    // LD L,d8
    // 2  8
    registerL = dataByteOne;
    numberOfCycles = 8;
    programCounter += 1;
  } else if(_isOpcode(opcode, 0x2F)) {

    // CPL
    // 1 4
    // - 1 1 -
    registerA = ~registerA;
    _setSubtractFlag(1);
    _setHalfCarryFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x30)) {

    // JR NC,r8
    // 2 12 / 8
    if (_getCarryFlag() === 0) {
      _relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No programCounter on relative jump
  }

  // Always implement the program counter by one
  // Any other value can just subtract or add however much offset before reaching this line
  programCounter += 1;

  // Return the number of cycles
  return numberOfCycles;
}

// TODO: Handle CB Opcodes
function handleCbOpcode(opcode: u8, dataByteOne: u8, dataByteTwo: u8): i32 {
  return 0;
}
