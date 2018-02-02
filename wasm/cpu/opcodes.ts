// Imports
import { Cpu, relativeJump } from './index';
import { handleCbOpcode } from './cbOpcodes';
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
  concatenateBytes,
  splitHighByte,
  splitLowByte
} from '../helpers/index';
import {
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  eightBitLoadFromGBMemory,
  sixteenBitLoadFromGBMemory
} from '../memory/index';
import {
  updateTimers
} from '../timers/index';
import {
  setInterrupts,
  checkInterrupts
} from '../interrupts/index';

// Private funciton to check if an opcode is a value
// this is to get out of switch statements, and not have the dangling break; per javascript syntax
// And allow repeated variable names, for when we are concatenating registers
function isOpcode(opcode: u8, value: u8): boolean {
  if(opcode === value) {
    return true;
  }
  return false;
}

// Public function to handle an opcode, wraps around execute opcode for timers and things
// http://www.codeslinger.co.uk/pages/projects/gameboy/beginning.html
export function handleOpcode(opcode: u8, dataByteOne: u8, dataByteTwo: u8): i8 {
  let numberOfCycles: i8 = executeOpcode(opcode, dataByteOne, dataByteTwo);
  Cpu.currentCycles += numberOfCycles;

  // Check other Gameboy components
  updateTimers(<u8>numberOfCycles);
  // Graphics
  checkInterrupts();


  if(Cpu.currentCycles > Cpu.MAX_CYCLES_PER_FRAME) {
    Cpu.currentCycles = 0;
  }
  return numberOfCycles;
}

// Take in any opcode, and decode it, and return the number of cycles
// Program counter can be gotten from getProgramCounter();
// Setting return value to i32 instead of u16, as we want to return a negative number on error
// https://rednex.github.io/rgbds/gbz80.7.html
// http://pastraiser.com/cpu/gameboy/gameboyopcodes.html
function executeOpcode(opcode: u8, dataByteOne: u8, dataByteTwo: u8): i8 {

  // Initialize our number of cycles
  // Return -1 if no opcode was found, representing an error
  let numberOfCycles: i8 = -1;

  if(isOpcode(opcode, 0x00)) {

    // NOP
    // 1  4
    // No Operation
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x01)) {

    // LD BC,d16
    // 3  12
    Cpu.registerB = dataByteOne;
    Cpu.registerC = dataByteTwo;
    Cpu.programCounter += 2;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0x02)) {

    // LD (BC),A
    // 3  12
    // () means load into address pointed by BC
    sixteenBitStoreIntoGBMemory(concatenateBytes(Cpu.registerB, Cpu.registerC), Cpu.registerA);
    Cpu.programCounter += 2;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0x03)) {

    // INC BC
    // 1  8
    let BC: u16 = concatenateBytes(Cpu.registerB, Cpu.registerC);
    BC++;
    Cpu.registerB = splitHighByte((<u16>BC));
    Cpu.registerC = splitLowByte((<u16>BC));
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x04)) {

    // INC B
    // 1  4
    // Z 0 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerB, 1);
    Cpu.registerB += 1;
    if (Cpu.registerB === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x05)) {

    // DEC B
    // 1  4
    // Z 1 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerB, -1);
    Cpu.registerB -= 1;
    if (Cpu.registerB == 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x06)) {

    // LD B,d8
    // 2  8
    Cpu.registerB = dataByteOne;
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x07)) {

    // RLCA
    // 1  4
    // 0 0 0 C
    // Check for the carry
    if((Cpu.registerA & 0x80) === 0x80) {
      setCarryFlag(1);
    } else {
      setCarryFlag(0);
    }
    Cpu.registerA = rotateByteLeft(Cpu.registerA);
    // Set all other flags to zero
    setZeroFlag(0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x08)) {

    // LD (a16),SP
    // 3  20
    // Load the stack pointer into the 16 bit address represented by the two data bytes
    sixteenBitStoreIntoGBMemory(concatenateBytes(dataByteOne, dataByteTwo), Cpu.stackPointer);
    Cpu.programCounter += 2;
    numberOfCycles = 20;
  } else if(isOpcode(opcode, 0x09)) {

    // ADD HL,BC
    // 1 8
    // - 0 H C
    let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
    let registerBC: u16 = concatenateBytes(Cpu.registerB, Cpu.registerC);
    checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerBC);
    let result: u16 = <u16>(registerHL + registerBC);
    Cpu.registerH = splitHighByte(<u16>result);
    Cpu.registerL = splitLowByte(<u16>result);
    setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x0A)) {

    // LD A,(BC)
    // 1 8
    let bytesAtBC: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerB, Cpu.registerC));
    Cpu.registerA = <u8>bytesAtBC;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x0B)) {

    // DEC BC
    // 1  8
    let registerBC = concatenateBytes(Cpu.registerB, Cpu.registerC);
    registerBC -= 1;
    Cpu.registerB = splitHighByte(registerBC);
    Cpu.registerC = splitLowByte(registerBC);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x0C)) {

    // INC C
    // 1  4
    // Z 0 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerC, 1);
    Cpu.registerC += 1;
    if (Cpu.registerC === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x0D)) {

    // DEC C
    // 1  4
    // Z 1 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerC, -1);
    Cpu.registerC -= 1;
    if (Cpu.registerC === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x0E)) {

    // LD C,d8
    // 2 8
    Cpu.registerC = dataByteOne;
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x0F)) {

    // RRCA
    // 1 4
    // 0 0 0 C
    // Check for the last bit, to see if it will be carried
    if ((Cpu.registerA & 0x01) > 0) {
      setCarryFlag(1);
    } else {
      setCarryFlag(0);
    }
    Cpu.registerA = rotateByteRight(Cpu.registerA);
    // Set all other flags to zero
    setZeroFlag(0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x10)) {

    // STOP 0
    // 2 4
    // Enter CPU very low power mode?
    // TODO
    Cpu.programCounter += 1;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x11)) {

    // LD DE,d16
    // 3  12
    Cpu.registerD = dataByteOne;
    Cpu.registerE = dataByteTwo;
    Cpu.programCounter += 2;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0x12)) {

    // LD (DE),A
    // 1 8
    sixteenBitStoreIntoGBMemory(concatenateBytes(Cpu.registerD, Cpu.registerE), Cpu.registerA);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x13)) {

    // INC DE
    // 1 8
    let registerDE = concatenateBytes(Cpu.registerD, Cpu.registerE);
    registerDE += 1;
    Cpu.registerD = splitHighByte(registerDE);
    Cpu.registerE = splitLowByte(registerDE);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x14)) {

    // INC D
    // 1  4
    // Z 0 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerD, 1);
    Cpu.registerD += 1;
    if (Cpu.registerD === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x15)) {

    // DEC D
    // 1  4
    // Z 1 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerD, -1);
    Cpu.registerD -= 1;
    if (Cpu.registerD === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x16)) {
    // LD D,d8
    // 2 8
    Cpu.registerD = dataByteOne;
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x17)) {
    // RLA
    // 1 4
    // 0 0 0 C
    // Check for the carry
    // setting has first bit since we need to use carry
    let hasHighbit = false;
    if((Cpu.registerA & 0x80) === 0x80) {
      hasHighbit = true;
    }
    Cpu.registerA = rotateByteLeft(Cpu.registerA);
    // OR the carry flag to the end
    Cpu.registerA = Cpu.registerA | getCarryFlag();
    if(hasHighbit) {
      setCarryFlag(1);
    } else {
      setCarryFlag(0);
    }
    // Set all other flags to zero
    setZeroFlag(0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x18)) {

    // JR r8
    // 2  12
    relativeJump(dataByteOne);
    numberOfCycles = 12;
    // No Cpu.programCounter on relative jump
  } else if(isOpcode(opcode, 0x19)) {

    // ADD HL,DE
    // 1  8
    // - 0 H C
    let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
    let registerDE: u16 = concatenateBytes(Cpu.registerD, Cpu.registerE);
    checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerDE);
    let result: u16 = <u16>(registerHL + registerDE);
    Cpu.registerH = splitHighByte(<u16>result);
    Cpu.registerL = splitLowByte(<u16>result);
    setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x1A)) {

    // LD A,(DE)
    // 1 8
    Cpu.registerA = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerD, Cpu.registerE));
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x1B)) {

    // DEC DE
    // 1 8
    let registerDE = concatenateBytes(Cpu.registerD, Cpu.registerE);
    registerDE -= 1;
    Cpu.registerD = splitHighByte(registerDE);
    Cpu.registerE = splitLowByte(registerDE);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x1C)) {

    // INC E
    // 1  4
    // Z 0 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerE, 1);
    Cpu.registerE += 1;
    if (Cpu.registerE === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x1D)) {

    // DEC E
    // 1  4
    // Z 1 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerE, -1);
    Cpu.registerE -= 1;
    if (Cpu.registerE === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x1E)) {

    // LD E,d8
    // 2 8
    Cpu.registerE = dataByteOne;
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x1F)) {

    // RRA
    // 1 4
    // 0 0 0 C
    // Check for the carry
    // setting has low bit since we need to use carry
    let hasLowBit = false;
    if((Cpu.registerA & 0x01) === 0x01) {
      hasLowBit = true;
    }
    Cpu.registerA = rotateByteRight(Cpu.registerA);
    // OR the carry flag to the end
    Cpu.registerA = Cpu.registerA | (getCarryFlag() << 7);
    if(hasLowBit) {
      setCarryFlag(1);
    } else {
      setCarryFlag(0);
    }
    // Set all other flags to zero
    setZeroFlag(0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x20)) {

    // JR NZ,r8
    // 2  12/8
    // NOTE: NZ stands for not [flag], so in this case, not zero flag
    // Also, / means, if condition. so if met, 12 cycles, otherwise 8 cycles
    if (getZeroFlag() === 0) {
      relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No Cpu.programCounter on relative jump
  } else if(isOpcode(opcode, 0x21)) {

    // LD HL,d16
    // 3  12
    let sixeteenBitDataByte = concatenateBytes(dataByteOne, dataByteTwo);
    Cpu.registerH = splitHighByte(sixeteenBitDataByte);
    Cpu.registerL = splitLowByte(sixeteenBitDataByte);
    numberOfCycles = 12;
    Cpu.programCounter += 1;
  } else if(isOpcode(opcode, 0x22)) {

    // LD (HL+),A
    // 1 8
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    sixteenBitStoreIntoGBMemory(registerHL, Cpu.registerA);
    registerHL += 1;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x23)) {

    // INC HL
    // 1  8
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    registerHL += 1;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x24)) {

    // INC H
    // 1  4
    // Z 0 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerH, 1);
    Cpu.registerH += 1;
    if (Cpu.registerH === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x25)) {

    // DEC H
    // 1  4
    // Z 1 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerH, -1);
    Cpu.registerH -= 1;
    if (Cpu.registerH === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x26)) {

    // LD H,d8
    // 2 8
    Cpu.registerH = dataByteOne;
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x27)) {

    // DAA
    // 1 4
    // Z - 0 C
    let adjustedRegister: u8 = 0;
    let adjustment: u8 = 0;

    if(getHalfCarryFlag() > 0) {
      adjustment = adjustment | 0x06;
    }
    if(getCarryFlag() > 0) {
      adjustment = adjustment | 0x60;
    }

    if(getSubtractFlag() > 0) {
      adjustedRegister = Cpu.registerA - <u8>adjustment;
    } else {
      if ((Cpu.registerA >> 3) > 0) {
        adjustment = adjustment | 0x06;
      }
      if(Cpu.registerA > 0x99) {
        adjustment = adjustment | 0x60;
      }
      adjustedRegister = Cpu.registerA + <u8>adjustment;
    }

    // Now set our flags to the correct values
    if(adjustedRegister === 0) {
      setZeroFlag(1);
    } else {
      setZeroFlag(0);
    }
    if( (adjustment & 0x60) !== 0) {
      setCarryFlag(1);
    } else {
      setCarryFlag(0);
    }
    setHalfCarryFlag(0);

    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x28)) {

    // JR Z,r8
    // 2  12/8
    if(getZeroFlag() > 0) {
      relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No program counter on relative jump
  } else if(isOpcode(opcode, 0x29)) {

    // ADD HL,HL
    // 1  8
    // - 0 H C
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    checkAndSetSixteenBitFlagsAddOverflow(registerHL, registerHL);
    registerHL = registerHL * 2;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x2A)) {

    // LD A,(HL+)
    // 1  8
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    Cpu.registerA = eightBitLoadFromGBMemory(registerHL);
    registerHL += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x2B)) {

    // DEC HL
    // 1 8
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    registerHL += -1;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x2C)) {

    // INC L
    // 1  4
    // Z 0 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerL, 1);
    Cpu.registerL += 1;
    if (Cpu.registerL === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x2D)) {

    // DEC L
    // 1  4
    // Z 1 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerL, -1);
    Cpu.registerL -= 1;
    if (Cpu.registerL === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x2E)) {
    // LD L,d8
    // 2  8
    Cpu.registerL = dataByteOne;
    numberOfCycles = 8;
    Cpu.programCounter += 1;
  } else if(isOpcode(opcode, 0x2F)) {

    // CPL
    // 1 4
    // - 1 1 -
    Cpu.registerA = ~Cpu.registerA;
    setSubtractFlag(1);
    setHalfCarryFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x30)) {

    // JR NC,r8
    // 2 12 / 8
    if (getCarryFlag() === 0) {
      relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No Cpu.programCounter on relative jump
  } else if(isOpcode(opcode, 0x31)) {
    // LD SP,d16
    // 3 12
    Cpu.stackPointer = concatenateBytes(dataByteOne, dataByteTwo);
    Cpu.programCounter += 2;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0x32)) {
    // LD (HL-),A
    // 1 8
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    eightBitStoreIntoGBMemory(registerHL, Cpu.registerA);
    registerHL -= 1;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x33)) {
    // INC SP
    // 1 8
    Cpu.stackPointer += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x34)) {

    // INC (HL)
    // 1  12
    // Z 0 H -
    let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
    let valueAtHL: u8 = eightBitLoadFromGBMemory(registerHL);
    checkAndSetEightBitHalfCarryFlag(<u8>valueAtHL, -1);
    valueAtHL += 1;
    if (valueAtHL === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    eightBitStoreIntoGBMemory(registerHL, <u8>valueAtHL);
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0x35)) {

    // DEC (HL)
    // 1  12
    // Z 1 H -
    let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
    let valueAtHL: u8 = eightBitLoadFromGBMemory(registerHL);
    checkAndSetEightBitHalfCarryFlag(<u8>valueAtHL, -1);
    valueAtHL -= 1;
    if (valueAtHL === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    eightBitStoreIntoGBMemory(registerHL, <u8>valueAtHL);
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0x36)) {
    // LD (HL),d8
    // 2  12
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), dataByteOne);
    Cpu.programCounter += 1;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0x37)) {
    // SCF
    // 1  4
    // - 0 0 1
    // Simply set the carry flag
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(1);
  } else if(isOpcode(opcode, 0x38)) {

    // JR C,r8
    // 2 12/8
    if (getCarryFlag() === 1) {
      relativeJump(dataByteOne);
      numberOfCycles = 12;
    } else {
      numberOfCycles = 8;
    }
    // No Cpu.programCounter on relative jump
  } else if(isOpcode(opcode, 0x39)) {

    // ADD HL,SP
    // 1 8
    // - 0 H C
    let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
    checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, Cpu.stackPointer);
    let result: u16 = <u16>(registerHL + Cpu.stackPointer);
    Cpu.registerH = splitHighByte(<u16>result);
    Cpu.registerL = splitLowByte(<u16>result);
    setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x3A)) {

    // LD A,(HL-)
    // 1 8
    let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
    Cpu.registerA = eightBitLoadFromGBMemory(registerHL);
    registerHL -= 1;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x3B)) {
    // DEC SP
    // 1 8
    Cpu.stackPointer -= 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x3C)) {

    // INC A
    // 1  4
    // Z 0 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, 1);
    Cpu.registerA += 1;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x3D)) {

    // DEC A
    // 1  4
    // Z 1 H -
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, -1);
    Cpu.registerA -= 1;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x3E)) {

    // LD A,d8
    // 2 8
    Cpu.registerA = dataByteOne;
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x3F)) {

    // CCF
    // 1 4
    // - 0 0 C
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    if(getCarryFlag() > 0) {
      setCarryFlag(0);
    } else {
      setCarryFlag(1);
    }
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x40)) {
    // LD B,B
    // 1 4
    // Load B into B, Do nothing
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x41)) {

    // LD B,C
    // 1 4
    Cpu.registerB = Cpu.registerC;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x42)) {

    // LD B,D
    // 1 4
    Cpu.registerB = Cpu.registerD;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x43)) {

    // LD B,E
    // 1 4
    Cpu.registerB = Cpu.registerE;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x44)) {

    // LD B,H
    // 1 4
    Cpu.registerB = Cpu.registerH;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x45)) {

    // LD B,L
    // 1 4
    Cpu.registerB = Cpu.registerL;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x46)) {

    // LD B,(HL)
    // 1 8
    Cpu.registerB = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x47)) {

    // LD B,A
    // 1 4
    Cpu.registerB = Cpu.registerA;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x48)) {

    // LD C,B
    // 1 4
    Cpu.registerC = Cpu.registerB;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x49)) {

    // LD C,C
    // 1 4
    // Do nothing
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x4A)) {

    // LD C,D
    // 1 4
    Cpu.registerC = Cpu.registerD;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x4B)) {

    // LD C,E
    // 1 4
    Cpu.registerC = Cpu.registerE;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x4C)) {

    // LD C,H
    // 1 4
    Cpu.registerC = Cpu.registerH;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x4D)) {

    // LD C,L
    // 1 4
    Cpu.registerC = Cpu.registerL;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x4E)) {

    // LD C,(HL)
    // 1 8
    Cpu.registerC = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x4F)) {

    // LD C,A
    // 1 4
    Cpu.registerC = Cpu.registerA;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x50)) {

    // LD D,B
    // 1 4
    Cpu.registerD = Cpu.registerB;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x51)) {

    // LD D,C
    // 1 4
    Cpu.registerD = Cpu.registerC;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x52)) {

    // LD D,D
    // 1 4
    // Do Nothing
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x53)) {

    // LD D,E
    // 1 4
    Cpu.registerD = Cpu.registerE;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x54)) {

    // LD D,H
    // 1 4
    Cpu.registerD = Cpu.registerH;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x55)) {

    // LD D,L
    // 1 4
    Cpu.registerD = Cpu.registerL;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x56)) {

    // LD D,(HL)
    // 1 8
    Cpu.registerD = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x57)) {

    // LD D,A
    // 1 4
    Cpu.registerD = Cpu.registerA;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x58)) {

    // LD E,B
    // 1 4
    Cpu.registerE = Cpu.registerB;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x59)) {

    // LD E,C
    // 1 4
    Cpu.registerE = Cpu.registerC;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x5A)) {

    // LD E,D
    // 1 4
    Cpu.registerE = Cpu.registerD;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x5B)) {

    // LD E,E
    // 1 4
    // Do Nothing
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x5C)) {

    // LD E,H
    // 1 4
    Cpu.registerE = Cpu.registerH;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x5D)) {

    // LD E,L
    // 1 4
    Cpu.registerE = Cpu.registerL;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x5E)) {

    // LD E,(HL)
    // 1 4
    Cpu.registerE = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x5F)) {

    // LD E,A
    // 1 4
    Cpu.registerE = Cpu.registerA;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x60)) {

    // LD H,B
    // 1 4
    Cpu.registerH = Cpu.registerB;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x61)) {

    // LD H,C
    // 1 4
    Cpu.registerH = Cpu.registerC;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x62)) {

    // LD H,D
    // 1 4
    Cpu.registerH = Cpu.registerD;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x63)) {

    // LD H,E
    // 1 4
    Cpu.registerH = Cpu.registerE;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x64)) {

    // LD H,H
    // 1 4
    Cpu.registerH = Cpu.registerH;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x65)) {

    // LD H,L
    // 1 4
    Cpu.registerH = Cpu.registerL;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x66)) {

    // LD H,(HL)
    // 1 8
    Cpu.registerH = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x67)) {

    // LD H,A
    // 1 4
    Cpu.registerH = Cpu.registerA;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x68)) {

    // LD L,B
    // 1 4
    Cpu.registerL = Cpu.registerB;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x69)) {

    // LD L,C
    // 1 4
    Cpu.registerL = Cpu.registerC;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x6A)) {

    // LD L,D
    // 1 4
    Cpu.registerL = Cpu.registerD;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x6B)) {

    // LD L,E
    // 1 4
    Cpu.registerL = Cpu.registerE;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x6C)) {

    // LD L,H
    // 1 4
    Cpu.registerL = Cpu.registerH;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x6D)) {

    // LD L,L
    // 1 4
    Cpu.registerL = Cpu.registerL;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x6E)) {

    // LD L,(HL)
    // 1 8
    Cpu.registerL = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x6F)) {

    // LD L,A
    // 1 4
    Cpu.registerL = Cpu.registerA;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x70)) {

    // LD (HL),B
    // 1 8
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerB);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x71)) {

    // LD (HL),C
    // 1 8
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerC);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x72)) {

    // LD (HL),D
    // 1 8
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerD);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x73)) {

    // LD (HL),E
    // 1 8
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerE);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x74)) {

    // LD (HL),H
    // 1 8
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerH);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x75)) {

    // LD (HL),L
    // 1 8
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerL);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x76)) {

    // HALT
    // 1 4
    // Enter CPU very low power mode?
    // TODO
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x77)) {

    // LD (HL),A
    // 1 8
    eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerA);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x78)) {

    // LD A,B
    // 1 4
    Cpu.registerA = Cpu.registerB;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x79)) {

    // LD A,C
    // 1 4
    Cpu.registerA = Cpu.registerC;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x7A)) {

    // LD A,D
    // 1 4
    Cpu.registerA = Cpu.registerD;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x7B)) {

    // LD A,E
    // 1 4
    Cpu.registerA = Cpu.registerE;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x7C)) {

    // LD A,H
    // 1 4
    Cpu.registerA = Cpu.registerH;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x7D)) {

    // LD A,L
    // 1 4
    Cpu.registerA = Cpu.registerL;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x7E)) {

    // LD A,(HL)
    // 1 4
    Cpu.registerA = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x7F)) {

    // LD A,A
    // 1 4
    // Do Nothing
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x80)) {
    // ADD A,B
    // 1 4
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, Cpu.registerB);
    checkAndSetEightBitCarryFlag(Cpu.registerA, Cpu.registerB);
    Cpu.registerA += Cpu.registerB;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x81)) {
    // ADD A,C
    // 1 4
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, Cpu.registerC);
    checkAndSetEightBitCarryFlag(Cpu.registerA, Cpu.registerC);
    Cpu.registerA += Cpu.registerC;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x82)) {
    // ADD A,D
    // 1 4
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, Cpu.registerD);
    checkAndSetEightBitCarryFlag(Cpu.registerA, Cpu.registerD);
    Cpu.registerA += Cpu.registerD;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x83)) {
    // ADD A,E
    // 1 4
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, Cpu.registerE);
    checkAndSetEightBitCarryFlag(Cpu.registerA, Cpu.registerE);
    Cpu.registerA += Cpu.registerE;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x84)) {
    // ADD A,H
    // 1 4
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, Cpu.registerH);
    checkAndSetEightBitCarryFlag(Cpu.registerA, Cpu.registerH);
    Cpu.registerA += Cpu.registerH;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x85)) {
    // ADD A,L
    // 1 4
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, Cpu.registerL);
    checkAndSetEightBitCarryFlag(Cpu.registerA, Cpu.registerL);
    Cpu.registerA += Cpu.registerL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x86)) {
    // ADD A,(HL)
    // 1 8
    // Z 0 H C
    let valueAtHL: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>valueAtHL);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>valueAtHL);
    Cpu.registerA += <u8>valueAtHL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x87)) {
    // ADD A,A
    // 1 4
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, Cpu.registerA);
    checkAndSetEightBitCarryFlag(Cpu.registerA, Cpu.registerA);
    Cpu.registerA += Cpu.registerA;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x88)) {
    // ADC A,B
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + Cpu.registerB;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x89)) {
    // ADC A,C
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + Cpu.registerC;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x8A)) {
    // ADC A,D
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + Cpu.registerD;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x8B)) {
    // ADC A,E
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + Cpu.registerE;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x8C)) {
    // ADC A,H
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + Cpu.registerH;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x8D)) {
    // ADC A,L
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + Cpu.registerL;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x8E)) {
    // ADC A,(HL)
    // 1 8
    // Z 0 H C
    let valueAtHL: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    let totalToAdd: u8 = getCarryFlag() + <u8>valueAtHL;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x8F)) {
    // ADC A,A
    // 1 4
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + Cpu.registerB;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x90)) {

    // SUB B
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerB * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= Cpu.registerB;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x91)) {

    // SUB C
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerC * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= Cpu.registerC;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x92)) {

    // SUB D
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerD * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= Cpu.registerD;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x93)) {

    // SUB E
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerE * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= Cpu.registerE;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x94)) {

    // SUB H
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerH * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= Cpu.registerH;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x95)) {

    // SUB L
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerL * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= Cpu.registerL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x96)) {

    // SUB (HL)
    // 1  8
    // Z 1 H C
    let valueAtHL: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    let negativeRegister: i16 = <i16>valueAtHL * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= <u8>valueAtHL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x97)) {

    // SUB A
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerA * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    Cpu.registerA -= Cpu.registerA;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x98)) {

    // SBC A,B
    // 1  4
    // Z 1 H C
    let totalValue = Cpu.registerB + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x99)) {

    // SBC A,C
    // 1  4
    // Z 1 H C
    let totalValue = Cpu.registerC + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x9A)) {

    // SBC A,D
    // 1  4
    // Z 1 H C
    let totalValue = Cpu.registerD + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x9B)) {

    // SBC A,E
    // 1  4
    // Z 1 H C
    let totalValue = Cpu.registerE + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x9C)) {

    // SBC A,H
    // 1  4
    // Z 1 H C
    let totalValue = Cpu.registerH + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x9D)) {

    // SBC A,L
    // 1  4
    // Z 1 H C
    let totalValue = Cpu.registerL + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0x9E)) {

    // SBC A,(HL)
    // 1  8
    // Z 1 H C
    let totalValue = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL)) + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0x9F)) {

    // SBC A,A
    // 1  4
    // Z 1 H C
    let totalValue = Cpu.registerA + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA0)) {

    // AND B
    // 1  4
    // Z 0 1 0
    Cpu.registerA = (Cpu.registerA & Cpu.registerB);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA1)) {

    // AND C
    // 1  4
    // Z 0 1 0
    Cpu.registerA = (Cpu.registerA & Cpu.registerC);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA2)) {

    // AND D
    // 1  4
    // Z 0 1 0
    Cpu.registerA = (Cpu.registerA & Cpu.registerD);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA3)) {

    // AND E
    // 1  4
    // Z 0 1 0
    Cpu.registerA = (Cpu.registerA & Cpu.registerE);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA4)) {

    // AND H
    // 1  4
    // Z 0 1 0
    Cpu.registerA = (Cpu.registerA & Cpu.registerH);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA5)) {

    // AND L
    // 1  4
    // Z 0 1 0
    Cpu.registerA = (Cpu.registerA & Cpu.registerL);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA6)) {

    // AND (HL)
    // 1  8
    // Z 0 1 0
    let valueAtHL: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    Cpu.registerA = (Cpu.registerA & <u8>valueAtHL);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xA7)) {

    // AND A
    // 1  4
    // Z 0 1 0
    // Don't & Yourself, does nothing
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA8)) {

    // XOR B
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ Cpu.registerB;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xA9)) {

    // XOR C
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ Cpu.registerC;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xAA)) {

    // XOR D
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ Cpu.registerD;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xAB)) {

    // XOR E
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ Cpu.registerE;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xAC)) {

    // XOR H
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ Cpu.registerH;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xAD)) {

    // XOR L
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ Cpu.registerL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xAE)) {

    // XOR (HL)
    // 1  8
    // Z 0 0 0
    let valueAtHL: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    Cpu.registerA = Cpu.registerA ^ <u8>valueAtHL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xAF)) {

    // XOR A
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ Cpu.registerA;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB0)) {

    // OR B
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA | Cpu.registerB;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB1)) {

    // OR C
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA | Cpu.registerC;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB2)) {

    // OR D
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA | Cpu.registerD;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB3)) {

    // OR E
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA | Cpu.registerE;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB4)) {

    // OR H
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA | Cpu.registerH;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB5)) {

    // OR L
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA | Cpu.registerL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB6)) {

    // OR (HL)
    // 1  8
    // Z 0 0 0
    let valueAtHL: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    Cpu.registerA = Cpu.registerA | <u8>valueAtHL;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xB7)) {

    // OR A
    // 1  4
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA | Cpu.registerA;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB8)) {

    // CP B
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerB * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xB9)) {

    // CP C
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerC * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xBA)) {

    // CP D
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerD * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xBB)) {

    // CP E
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerE * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xBC)) {

    // CP H
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerH * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xBD)) {

    // CP L
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerL * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xBE)) {

    // CP (HL)
    // 1  8
    // Z 1 H C
    let valueAtHL: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
    let negativeRegister: i16 = <i16>valueAtHL * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xBF)) {

    // CP A
    // 1  4
    // Z 1 H C
    let negativeRegister: i16 = Cpu.registerA * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeRegister);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeRegister);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeRegister;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xC0)) {

    // RET NZ
    // 1  20/8
    if (getZeroFlag() === 0) {
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      numberOfCycles = 20;
    } else {
      numberOfCycles = 8;
    }
  } else if(isOpcode(opcode, 0xC1)) {

    // POP BC
    // 1  12
    let registerBC = concatenateBytes(Cpu.registerB, Cpu.registerC);
    registerBC = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
    Cpu.stackPointer += 2;
    Cpu.registerB = splitHighByte(registerBC);
    Cpu.registerC = splitLowByte(registerBC);
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0xC2)) {

    // JP NZ,a16
    // 3  16/12
    if (getZeroFlag() === 0) {
      Cpu.programCounter = concatenateBytes(dataByteOne, dataByteTwo);
      numberOfCycles = 16;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } else if(isOpcode(opcode, 0xC3)) {

    // JP a16
    // 3  16
    Cpu.programCounter = concatenateBytes(dataByteOne, dataByteTwo);
    numberOfCycles = 16;
    Cpu.programCounter += 2;
  } else if(isOpcode(opcode, 0xC4)) {

    // CALL NZ,a16
    // 3  24/12
    if (getZeroFlag() === 0) {
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 3);
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter + 1);
      numberOfCycles = 24;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } else if(isOpcode(opcode, 0xC5)) {

    // PUSH BC
    // 1  16
    let registerBC = concatenateBytes(Cpu.registerB, Cpu.registerC);
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerBC);
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xC6)) {

    // ADD A,d8
    // 2 8
    // Z 0 H C
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, dataByteOne);
    checkAndSetEightBitCarryFlag(Cpu.registerA, dataByteOne);
    Cpu.registerA += dataByteOne;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    Cpu.programCounter += 1;
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xC7)) {

    // RST 00H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x00;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xC8)) {

    // RET Z
    // 1  20/8
    if (getZeroFlag() === 1) {
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      numberOfCycles = 20;
    } else {
      numberOfCycles = 8;
    }
  } else if(isOpcode(opcode, 0xC9)) {

    // RET
    // 1 16
    Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
    Cpu.stackPointer += 2;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xCA)) {

    // JP Z,a16
    // 3 16/12
    if (getZeroFlag() === 1) {
      Cpu.programCounter = concatenateBytes(dataByteOne, dataByteTwo);
      numberOfCycles = 16;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } else if(isOpcode(opcode, 0xCB)) {
    // PREFIX CB
    // 1  4
    numberOfCycles = handleCbOpcode(dataByteOne);
    if(numberOfCycles > 0) {
      numberOfCycles += 4;
    }
  } else if(isOpcode(opcode, 0xCC)) {

    // CALL Z,a16
    // 3  24/12
    if (getZeroFlag() === 1) {
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 3);
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter + 1);
      numberOfCycles = 24;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } else if(isOpcode(opcode, 0xCD)) {

    // CALL a16
    // 3  24
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 3);
    Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter + 1);
    numberOfCycles = 24;
    Cpu.programCounter += 2;
  } else if(isOpcode(opcode, 0xCE)) {

    // ADC A,d8
    // 2  8
    // Z 0 H C
    let totalToAdd: u8 = getCarryFlag() + dataByteOne;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalToAdd);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalToAdd);
    Cpu.registerA += <u8>totalToAdd;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xCF)) {

    // RST 08H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x08;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xD0)) {

    // RET NC
    // 1  20/8
    if (getCarryFlag() === 0) {
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      numberOfCycles = 20;
    } else {
      numberOfCycles = 8;
    }
  } else if(isOpcode(opcode, 0xD1)) {

    // POP DE
    // 1  12
    let registerDE = concatenateBytes(Cpu.registerD, Cpu.registerE);
    registerDE = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
    Cpu.stackPointer += 2;
    Cpu.registerD = splitHighByte(registerDE);
    Cpu.registerE = splitLowByte(registerDE);
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0xD2)) {

    // JP NC,a16
    // 3  16/12
    if (getCarryFlag() === 0) {
      Cpu.programCounter = concatenateBytes(dataByteOne, dataByteTwo);
      numberOfCycles = 16;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } /* No Opcode for: 0xD3 */ else if(isOpcode(opcode, 0xD4)) {

    // CALL NC,a16
    // 3  24/12
    if (getCarryFlag() === 0) {
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 3);
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter + 1);
      numberOfCycles = 24;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } else if(isOpcode(opcode, 0xD5)) {

    // PUSH DE
    // 1 16
    let registerDE = concatenateBytes(Cpu.registerD, Cpu.registerE);
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerDE);
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xD6)) {

    // SUB d8
    // 2  8
    // Z 1 H C
    let negativeDataByte: i16 = dataByteOne * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeDataByte);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeDataByte);
    Cpu.registerA -= dataByteOne;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xD7)) {

    // RST 10H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x10;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xD8)) {

    // RET C
    // 1  20/8
    if (getCarryFlag() === 1) {
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      numberOfCycles = 20;
    } else {
      numberOfCycles = 8;
    }
  } else if(isOpcode(opcode, 0xD9)) {

    // RETI
    // 1  16
    Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
    // Enable interrupts
    setInterrupts(true);
    Cpu.stackPointer += 2;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xDA)) {

    // JP C,a16
    // 3 16/12
    if (getCarryFlag() === 1) {
      Cpu.programCounter = concatenateBytes(dataByteOne, dataByteTwo);
      numberOfCycles = 16;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } /* No Opcode for: 0xDB */else if(isOpcode(opcode, 0xDC)) {

    // CALL C,a16
    // 3  24/12
    if (getCarryFlag() === 1) {
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 3);
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter + 1);
      numberOfCycles = 24;
    } else {
      numberOfCycles = 12;
    }
    Cpu.programCounter += 2;
  } /* No Opcode for: 0xDD */else if(isOpcode(opcode, 0xDE)) {

    // SBC A,d8
    // 2 8
    // Z 1 H C
    let totalValue = dataByteOne + getCarryFlag();
    let negativeTotalValue: i16 = <i16>totalValue * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>totalValue);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>totalValue);
    Cpu.registerA -= <u8>totalValue;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xDF)) {
    // RST 18H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x18;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xE0)) {

    // LDH (a8),A
    // 2  12

    // Store value in high RAM ($FF00 + a8)
    eightBitStoreIntoGBMemory(0xFF00 + dataByteOne, Cpu.registerA);
    Cpu.programCounter += 1;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0xE1)) {

    // POP HL
    // 1  12
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    registerHL = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
    Cpu.stackPointer += 2;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0xE2)) {

    // LD (C),A
    // 2  8

    // Store value in high RAM ($FF00 + register c)
    eightBitStoreIntoGBMemory(0xFF00 + Cpu.registerC, Cpu.registerA);
    Cpu.programCounter += 2;
    numberOfCycles = 8;
  } /* No Opcode for: 0xE3, 0xE4 */ else if(isOpcode(opcode, 0xE5)) {

    // PUSH HL
    // 1 16
    let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerHL);
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xE6)) {

    // AND d8
    // 2  8
    // Z 0 1 0
    Cpu.registerA = (Cpu.registerA & dataByteOne);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xE7)) {

    // RST 20H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x20;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xE8)) {

    // ADD SP, r8
    // 2 16
    // 0 0 H C
    checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, <u16>dataByteOne);
    Cpu.stackPointer += dataByteOne;
    setZeroFlag(0);
    setSubtractFlag(0);
    Cpu.programCounter += 1;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xE9)) {

    // JP (HL)
    // 1 4
    Cpu.programCounter = concatenateBytes(Cpu.registerH, Cpu.registerL);
    numberOfCycles = 4;
  } else if(isOpcode(opcode, 0xEA)) {

    // LD (a16),A
    // 3 16
    eightBitStoreIntoGBMemory(concatenateBytes(dataByteOne, dataByteTwo), Cpu.registerA);
    Cpu.programCounter += 2;
    numberOfCycles = 16;
  } /* No Opcode for: 0xEB, 0xEC, 0xED */ else if(isOpcode(opcode, 0xEE)) {

    // XOR d8
    // 2 8
    // Z 0 0 0
    Cpu.registerA = Cpu.registerA ^ dataByteOne;
    if(Cpu.registerA === 0) {
      setZeroFlag(1);
    } else {
      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
  } else if(isOpcode(opcode, 0xEF)) {

    // RST 28H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x28;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xF0)) {

    // LDH A,(a8)
    // 2 12
    Cpu.registerA = eightBitLoadFromGBMemory(0xFF00 + dataByteOne);
    Cpu.programCounter += 1;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0xF1)) {

    // POP AF
    // 1 12
    // Z N H C (But No work require, flags are already set)
    let registerAF = concatenateBytes(Cpu.registerA, Cpu.registerF);
    registerAF = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
    Cpu.stackPointer += 2;
    Cpu.registerA = splitHighByte(registerAF);
    Cpu.registerF = splitLowByte(registerAF);
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0xF2)) {

    // LD A,(C)
    // 2 8
    Cpu.registerA = eightBitLoadFromGBMemory(0xFF00 + Cpu.registerC);
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xF3)) {

    // DI
    // 1 4
    setInterrupts(false);
    numberOfCycles = 4;
  } /* No Opcode for: 0xF4 */ else if(isOpcode(opcode, 0xF5)) {

    // PUSH AF
    // 1 16
    let registerAF = concatenateBytes(Cpu.registerA, Cpu.registerF);
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerAF);
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xF6)) {

    // OR d8
    // 2 8
    // Z 0 0 0
    Cpu.registerA = (Cpu.registerA | dataByteOne);
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xF7)) {

    // RST 30H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x30;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xF8)) {

    // LD HL,SP+r8
    // 2 12
    // 0 0 H C

    // First, let's handle flags
    setZeroFlag(0);
    setSubtractFlag(0);
    checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, dataByteOne);
    let registerHL = Cpu.stackPointer + dataByteOne;
    Cpu.registerH = splitHighByte(registerHL);
    Cpu.registerL = splitLowByte(registerHL);
    Cpu.programCounter += 1;
    numberOfCycles = 12;
  } else if(isOpcode(opcode, 0xF9)) {

    // LD SP,HL
    // 1 8
    Cpu.stackPointer = concatenateBytes(Cpu.registerH, Cpu.registerL);
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xFA)) {

    // LD A,(a16)
    // 3 16
    Cpu.registerA = eightBitLoadFromGBMemory(concatenateBytes(dataByteOne, dataByteTwo));
    Cpu.programCounter += 2;
    numberOfCycles = 16;
  } else if(isOpcode(opcode, 0xFB)) {

    // EI
    // 1 4
    setInterrupts(true);
    numberOfCycles = 4;
  } /* No Opcode for: 0xFC, 0xFD */ else if(isOpcode(opcode, 0xFE)) {

    // CP d8
    // 2 8
    // Z 1 H C
    let negativeDataByte: i16 = dataByteOne * -1;
    checkAndSetEightBitHalfCarryFlag(Cpu.registerA, <i16>negativeDataByte);
    checkAndSetEightBitCarryFlag(Cpu.registerA, <i16>negativeDataByte);
    let tempResult: i16 = <i16>Cpu.registerA + <i16>negativeDataByte;
    if (Cpu.registerA === 0) {

      setZeroFlag(0);
    }
    setSubtractFlag(1);
    Cpu.programCounter += 1;
    numberOfCycles = 8;
  } else if(isOpcode(opcode, 0xFF)) {

    // RST 38H
    // 1 16
    Cpu.stackPointer -= 2;
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    Cpu.programCounter = 0x38;
    numberOfCycles = 16;
  }


  /* No Opcode for:  */


  // Always implement the program counter by one
  // Any other value can just subtract or add however much offset before reaching this line
  Cpu.programCounter += 1;

  // Return the number of cycles
  return numberOfCycles;
}
