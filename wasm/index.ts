// https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
// https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js


// NOTE: Code is very verbose, and will have some copy pasta'd lines.
// Reason being, I want the code to be very accessible for errors later on.
// Also, the benefit on splitting into functions is organizarion, and keeping things DRY.
// But since I highly doubt the GB CPU will be changing, DRY is no longer an issue
// And the verbosity / ease of use is more important, imo.

// NOTE: Commands like SUB B, or AND C, without a second parameter, actually refer SUB A, B or AND A, C

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
function _eightBitStoreIntoGBMemory(offset: u16, value: u8): void {
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
  let result: i16 = <i16>value + amountToAdd;
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
  } else if(_isOpcode(opcode, 0x31)) {
    // LD SP,d16
    // 3 12
    stackPointer = _concatenateBytes(dataByteOne, dataByteTwo);
    programCounter += 2;
    numberOfCycles = 12;
  } else if(_isOpcode(opcode, 0x32)) {
    // LD (HL-),A
    // 1 8
    let registerHL = _concatenateBytes(registerH, registerL);
    _eightBitStoreIntoGBMemory(registerHL, registerA);
    registerHL -= 1;
    _splitBytes(registerHL, registerH, registerL);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x33)) {
    // INC SP
    // 1 8
    stackPointer += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x34)) {

    // INC (HL)
    // 1  12
    // Z 0 H -
    let registerHL: u16 = _concatenateBytes(registerH, registerL);
    let valueAtHL: u8 = _eightBitLoadFromGBMemory(registerHL);
    _checkAndSetEightBitHalfCarryFlag(<u8>valueAtHL, -1);
    valueAtHL += 1;
    if (valueAtHL === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    _eightBitStoreIntoGBMemory(registerHL, <u8>valueAtHL);
    numberOfCycles = 12;
  } else if(_isOpcode(opcode, 0x35)) {

    // DEC (HL)
    // 1  12
    // Z 1 H -
    let registerHL: u16 = _concatenateBytes(registerH, registerL);
    let valueAtHL: u8 = _eightBitLoadFromGBMemory(registerHL);
    _checkAndSetEightBitHalfCarryFlag(<u8>valueAtHL, -1);
    valueAtHL -= 1;
    if (valueAtHL === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    _eightBitStoreIntoGBMemory(registerHL, <u8>valueAtHL);
    numberOfCycles = 12;
  } else if(_isOpcode(opcode, 0x36)) {
    // LD (HL),d8
    // 2  12
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), dataByteOne);
    programCounter += 1;
    numberOfCycles = 12;
  } else if(_isOpcode(opcode, 0x37)) {
    // SCF
    // 1  4
    // - 0 0 1
    // Simply set the carry flag
    _setSubtractFlag(0);
    _setHalfCarryFlag(0);
    _setCarryFlag(1);
  } else if(_isOpcode(opcode, 0x38)) {

    // JR C,r8
    // 2 12/8
    if (_getCarryFlag() === 1) {
      _relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No programCounter on relative jump
  } else if(_isOpcode(opcode, 0x39)) {

    // ADD HL,SP
    // 1 8
    // - 0 H C
    let registerHL: u16 = _concatenateBytes(registerH, registerL);
    _checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, stackPointer);
    let result: u16 = <u16>(registerHL + stackPointer);
    _splitBytes(<u16>result, registerH, registerL);
    _setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x3A)) {

    // LD A,(HL-)
    // 1 8
    let registerHL: u16 = _concatenateBytes(registerH, registerL);
    registerA = _eightBitLoadFromGBMemory(registerHL);
    registerHL -= 1;
    _splitBytes(registerHL, registerH, registerL);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x3B)) {
    // DEC SP
    // 1 8
    stackPointer -= 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x3C)) {

    // INC A
    // 1  4
    // Z 0 H -
    _checkAndSetEightBitHalfCarryFlag(registerA, 1);
    registerA += 1;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x3D)) {

    // DEC A
    // 1  4
    // Z 1 H -
    _checkAndSetEightBitHalfCarryFlag(registerA, -1);
    registerA -= 1;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x3E)) {

    // LD A,d8
    // 2 8
    registerA = dataByteOne;
    programCounter += 1;
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x3F)) {

    // CCF
    // 1 4
    // - 0 0 C
    _setSubtractFlag(0);
    _setHalfCarryFlag(0);
    if(_getCarryFlag() > 0) {
      _setCarryFlag(0);
    } else {
      _setCarryFlag(1);
    }
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x40)) {
    // LD B,B
    // 1 4
    // Load B into B, Do nothing
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x41)) {

    // LD B,C
    // 1 4
    registerB = registerC;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x42)) {

    // LD B,D
    // 1 4
    registerB = registerD;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x43)) {

    // LD B,E
    // 1 4
    registerB = registerE;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x44)) {

    // LD B,H
    // 1 4
    registerB = registerH;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x45)) {

    // LD B,L
    // 1 4
    registerB = registerL;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x46)) {

    // LD B,(HL)
    // 1 8
    registerB = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x47)) {

    // LD B,A
    // 1 4
    registerB = registerA;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x48)) {

    // LD C,B
    // 1 4
    registerC = registerB;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x49)) {

    // LD C,C
    // 1 4
    // Do nothing
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x4A)) {

    // LD C,D
    // 1 4
    registerC = registerD;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x4B)) {

    // LD C,E
    // 1 4
    registerC = registerE;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x4C)) {

    // LD C,H
    // 1 4
    registerC = registerH;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x4D)) {

    // LD C,L
    // 1 4
    registerC = registerL;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x4E)) {

    // LD C,(HL)
    // 1 8
    registerC = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x4F)) {

    // LD C,A
    // 1 4
    registerC = registerA;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x50)) {

    // LD D,B
    // 1 4
    registerD = registerB;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x51)) {

    // LD D,C
    // 1 4
    registerD = registerC;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x52)) {

    // LD D,D
    // 1 4
    // Do Nothing
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x53)) {

    // LD D,E
    // 1 4
    registerD = registerE;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x54)) {

    // LD D,H
    // 1 4
    registerD = registerH;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x55)) {

    // LD D,L
    // 1 4
    registerD = registerL;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x56)) {

    // LD D,(HL)
    // 1 8
    registerD = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x57)) {

    // LD D,A
    // 1 4
    registerD = registerA;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x58)) {

    // LD E,B
    // 1 4
    registerE = registerB;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x59)) {

    // LD E,C
    // 1 4
    registerE = registerC;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x5A)) {

    // LD E,D
    // 1 4
    registerE = registerD;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x5B)) {

    // LD E,E
    // 1 4
    // Do Nothing
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x5C)) {

    // LD E,H
    // 1 4
    registerE = registerH;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x5D)) {

    // LD E,L
    // 1 4
    registerE = registerL;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x5E)) {

    // LD E,(HL)
    // 1 4
    registerE = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x5F)) {

    // LD E,A
    // 1 4
    registerE = registerA;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x60)) {

    // LD H,B
    // 1 4
    registerH = registerB;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x61)) {

    // LD H,C
    // 1 4
    registerH = registerC;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x62)) {

    // LD H,D
    // 1 4
    registerH = registerD;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x63)) {

    // LD H,E
    // 1 4
    registerH = registerE;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x64)) {

    // LD H,H
    // 1 4
    registerH = registerH;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x65)) {

    // LD H,L
    // 1 4
    registerH = registerL;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x66)) {

    // LD H,(HL)
    // 1 8
    registerH = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x67)) {

    // LD H,A
    // 1 4
    registerH = registerA;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x68)) {

    // LD L,B
    // 1 4
    registerL = registerB;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x69)) {

    // LD L,C
    // 1 4
    registerL = registerC;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x6A)) {

    // LD L,D
    // 1 4
    registerL = registerD;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x6B)) {

    // LD L,E
    // 1 4
    registerL = registerE;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x6C)) {

    // LD L,H
    // 1 4
    registerL = registerH;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x6D)) {

    // LD L,L
    // 1 4
    registerL = registerL;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x6E)) {

    // LD L,(HL)
    // 1 8
    registerL = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x6F)) {

    // LD L,A
    // 1 4
    registerL = registerA;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x70)) {

    // LD (HL),B
    // 1 8
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), registerB);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x71)) {

    // LD (HL),C
    // 1 8
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), registerC);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x72)) {

    // LD (HL),D
    // 1 8
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), registerD);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x73)) {

    // LD (HL),E
    // 1 8
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), registerE);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x74)) {

    // LD (HL),H
    // 1 8
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), registerH);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x75)) {

    // LD (HL),L
    // 1 8
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), registerL);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x76)) {

    // HALT
    // 1 4
    // Enter CPU very low power mode?
    // TODO
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x77)) {

    // LD (HL),A
    // 1 8
    _eightBitStoreIntoGBMemory(_concatenateBytes(registerH, registerL), registerA);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x78)) {

    // LD A,B
    // 1 4
    registerA = registerB;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x79)) {

    // LD A,C
    // 1 4
    registerA = registerC;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x7A)) {

    // LD A,D
    // 1 4
    registerA = registerD;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x7B)) {

    // LD A,E
    // 1 4
    registerA = registerE;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x7C)) {

    // LD A,H
    // 1 4
    registerA = registerH;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x7D)) {

    // LD A,L
    // 1 4
    registerA = registerL;
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x7E)) {

    // LD A,(HL)
    // 1 4
    registerA = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x7F)) {

    // LD A,A
    // 1 4
    // Do Nothing
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x80)) {
    // ADD A,B
    // 1 4
    // Z 0 H C
    _checkAndSetEightBitHalfCarryFlag(registerA, registerB);
    _checkAndSetEightBitCarryFlag(registerA, registerB);
    registerA += registerB;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x81)) {
    // ADD A,C
    // 1 4
    // Z 0 H C
    _checkAndSetEightBitHalfCarryFlag(registerA, registerC);
    _checkAndSetEightBitCarryFlag(registerA, registerC);
    registerA += registerC;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x82)) {
    // ADD A,D
    // 1 4
    // Z 0 H C
    _checkAndSetEightBitHalfCarryFlag(registerA, registerD);
    _checkAndSetEightBitCarryFlag(registerA, registerD);
    registerA += registerD;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x83)) {
    // ADD A,E
    // 1 4
    // Z 0 H C
    _checkAndSetEightBitHalfCarryFlag(registerA, registerE);
    _checkAndSetEightBitCarryFlag(registerA, registerE);
    registerA += registerE;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x84)) {
    // ADD A,H
    // 1 4
    // Z 0 H C
    _checkAndSetEightBitHalfCarryFlag(registerA, registerH);
    _checkAndSetEightBitCarryFlag(registerA, registerH);
    registerA += registerH;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x85)) {
    // ADD A,L
    // 1 4
    // Z 0 H C
    _checkAndSetEightBitHalfCarryFlag(registerA, registerL);
    _checkAndSetEightBitCarryFlag(registerA, registerL);
    registerA += registerL;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x86)) {
    // ADD A,(HL)
    // 1 8
    // Z 0 H C
    let valueAtHL: u8 = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>valueAtHL);
    _checkAndSetEightBitCarryFlag(registerA, <i16>valueAtHL);
    registerA += <u8>valueAtHL;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x87)) {
    // ADD A,A
    // 1 4
    // Z 0 H C
    _checkAndSetEightBitHalfCarryFlag(registerA, registerA);
    _checkAndSetEightBitCarryFlag(registerA, registerA);
    registerA += registerA;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x88)) {
    // ADC A,B
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = _getCarryFlag() + registerB;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x89)) {
    // ADC A,C
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = _getCarryFlag() + registerC;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x8A)) {
    // ADC A,D
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = _getCarryFlag() + registerD;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x8B)) {
    // ADC A,E
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = _getCarryFlag() + registerE;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x8C)) {
    // ADC A,H
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = _getCarryFlag() + registerH;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x8D)) {
    // ADC A,L
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = _getCarryFlag() + registerL;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x8E)) {
    // ADC A,(HL)
    // 1 8
    // Z 0 H C
    let valueAtHL: u8 = _eightBitLoadFromGBMemory(_concatenateBytes(registerH, registerL));
    let totalToAdd: u8 = _getCarryFlag() + <u8>valueAtHL;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(_isOpcode(opcode, 0x8F)) {
    // ADC A,A
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = _getCarryFlag() + registerB;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>totalToAdd);
    _checkAndSetEightBitCarryFlag(registerA, <i16>totalToAdd);
    registerA += <u8>totalToAdd;
    if (registerA === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(_isOpcode(opcode, 0x90)) {

    // SUB B
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = registerB * -1;
    _checkAndSetEightBitHalfCarryFlag(registerA, <i16>negativeRegister);
    _checkAndSetEightBitCarryFlag(registerA, <i16>negativeRegister);
    registerC -= registerB;
    if (registerC === 0) {
      // User parseint and radix to get correct bits
      _setZeroFlag(0);
    }
    _setSubtractFlag(1);
    numberOfCycles = 4;
  }


  // Always implement the program counter by one
  // Any other value can just subtract or add however much offset before reaching this line
  programCounter += 1;

  // Return the number of cycles
  return numberOfCycles;
}

// TODO: Handle CB Opcodes
function handleCbOpcode(cbOpcode: u8): void {
  // Increase program counter, as all CB codes take two bytes
  programCounter += 1;
}
