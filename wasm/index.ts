// https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions

/***********************
    Registers
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

// TODO: Improve this with a modern bitshifting way:
// https://stackoverflow.com/questions/101439/the-most-efficient-way-to-implement-an-integer-based-power-function-powint-int
function _exponent(numberValue: u8, exponentValue: u8): u8 {
  let result: u8 = numberValue;
  for (let i: u8 = 1; i < exponentValue; i++) {
    result = result * numberValue;
  }
  return result;
}

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

function _checkAndSetHalfCarryFlag(value: u8, amountToAdd: u8): void {
  // Knock off higher bits to check for seven
  let bitwiseValueOfSeven = value | 7;
  if( bitwiseValueOfSeven === 7 && amountToAdd >= 1) {
    _setFlagBit(5, 1);
  }
}

// 16-bit registers
let programCounter: u16 = 0;
let stackPointer: u16 = 0;

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

// Take in any opcode, and decode it, and return the program counter
// Setting return value to i32 instead of u16, as we want to return a negative number on error
// https://rednex.github.io/rgbds/gbz80.7.html
// http://pastraiser.com/cpu/gameboy/gameboy_opcodes.html
export function handleOpcode(opcode: u8, dataByteOne: u8, dataByteTwo: u8): i32 {
  switch(opcode) {
    case 0x00:
      // NOP
      // No Operation
      programCounter += 1;
      break;
    case 0x01:
      // LD BC,d16
      registerB = dataByteOne;
      registerC = dataByteTwo;
      programCounter += 3;
    case 0x02:
      // LD (BC),A
      // () means load into address pointed by BC
      // TODO: Ensure store is hitting right values: https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
      store<u8>(_concatenateBytes(registerB, registerC), registerA);
      programCounter += 1;
    case 0x03:
      let BC: u16 = _concatenateBytes(registerB, registerC);
      BC++;
      _splitBytes((<u16>BC), registerB, registerC);
      programCounter += 1;
    case 0x04:
      _checkAndSetHalfCarryFlag(registerB, 1);
      registerB += 1;
      if (registerB == 0) {
        // User parseint and radix to get correct bits
        _setFlagBit(7, 0);
      }
      _setFlagBit(6, 0);
      programCounter += 1;
    default:
      // Return false, error handling the opcode
      return -1;
  }

  // Return the program counter to get the next position!
  return programCounter;
}

// TODO: Handle CB Opcodes
function handleCbOpcode(opcode: u8, dataByteOne: u8, dataByteTwo: u8): i32 {
  return 0;
}
