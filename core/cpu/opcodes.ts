// Imports
import { Cpu } from './index';
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
  checkAndSetEightBitHalfCarryFlag,
  checkAndSetSixteenBitFlagsAddOverflow
} from './flags';
import {
  addARegister,
  addAThroughCarryRegister,
  subARegister,
  subAThroughCarryRegister,
  andARegister,
  xorARegister,
  orARegister,
  cpARegister,
  relativeJump
} from './instructions';
import { syncCycles } from '../cycles';
import {
  rotateByteLeft,
  rotateByteLeftThroughCarry,
  rotateByteRight,
  rotateByteRightThroughCarry,
  concatenateBytes,
  splitHighByte,
  splitLowByte,
  checkBitOnByte,
  resetBitOnByte,
  setBitOnByte
} from '../helpers/index';
import {
  Memory,
  eightBitLoadFromGBMemoryWithTraps,
  eightBitStoreIntoGBMemoryWithTraps,
  sixteenBitStoreIntoGBMemoryWithTraps,
  eightBitLoadFromGBMemory,
  sixteenBitLoadFromGBMemory
} from '../memory/index';
import { setInterrupts } from '../interrupts/index';
import { u8Portable, u16Portable, i8Portable } from '../portable/portable';

// Take in any opcode, and decode it, and return the number of cycles
// Program counter can be gotten from getProgramCounter();
// Setting return value to i32 instead of u16, as we want to return a negative number on error
// https://rednex.github.io/rgbds/gbz80.7.html
// http://pastraiser.com/cpu/gameboy/gameboyopcodes.html
export function executeOpcode(opcode: i32): i32 {
  // Always implement the program counter by one
  // Any other value can just subtract or add however much offset before reaching this line
  let programCounter = Cpu.programCounter;
  programCounter = u16Portable(programCounter + 1);

  // Check if we are in the halt bug
  if (Cpu.isHaltBug) {
    // Need to not increment program counter,
    // thus, running the next opcode twice

    // E.g
    // 0x76 - halt
    // FA 34 12 - ld a,(1234)
    // Becomes
    // FA FA 34 ld a,(34FA)
    // 12 ld (de),a
    programCounter = u16Portable(programCounter - 1);
  }
  Cpu.programCounter = programCounter;

  // Split our opcode into a high nibble to speed up performance
  // Running 255 if statements is slow, even in wasm haha!
  let opcodeHighNibble = opcode & 0xf0;
  opcodeHighNibble = opcodeHighNibble >> 4;

  // NOTE: @binji rule of thumb: it takes 4 cpu cycles to read one byte
  // Therefore isntructions that use more than just the opcode (databyte one and two) will take at least
  // 8 cyckles to use getDataByteOne(), and two cycles to use the concatented

  // Not using a switch statement to avoid cannot redeclare this variable errors
  // And it would be a ton of work :p

  switch (opcodeHighNibble) {
    case 0x00:
      return handleOpcode0x(opcode);
    case 0x01:
      return handleOpcode1x(opcode);
    case 0x02:
      return handleOpcode2x(opcode);
    case 0x03:
      return handleOpcode3x(opcode);
    case 0x04:
      return handleOpcode4x(opcode);
    case 0x05:
      return handleOpcode5x(opcode);
    case 0x06:
      return handleOpcode6x(opcode);
    case 0x07:
      return handleOpcode7x(opcode);
    case 0x08:
      return handleOpcode8x(opcode);
    case 0x09:
      return handleOpcode9x(opcode);
    case 0x0a:
      return handleOpcodeAx(opcode);
    case 0x0b:
      return handleOpcodeBx(opcode);
    case 0x0c:
      return handleOpcodeCx(opcode);
    case 0x0d:
      return handleOpcodeDx(opcode);
    case 0x0e:
      return handleOpcodeEx(opcode);
    default:
      return handleOpcodeFx(opcode);
  }
}

// Wrapper functions around loading and storing memory, and syncing those cycles
export function eightBitLoadSyncCycles(gameboyOffset: i32): u8 {
  syncCycles(4);
  return <u8>eightBitLoadFromGBMemoryWithTraps(gameboyOffset);
}

export function eightBitStoreSyncCycles(gameboyOffset: i32, value: i32): void {
  syncCycles(4);
  eightBitStoreIntoGBMemoryWithTraps(gameboyOffset, value);
}

export function sixteenBitLoadSyncCycles(gameboyOffset: i32): u16 {
  syncCycles(8);
  // sixteen bit load has traps even though it has no label
  return <u16>sixteenBitLoadFromGBMemory(gameboyOffset);
}

export function sixteenBitStoreSyncCycles(gameboyOffset: i32, value: i32): void {
  syncCycles(8);
  sixteenBitStoreIntoGBMemoryWithTraps(gameboyOffset, value);
}

// Functions to access the next operands of a opcode, reffering to them as "dataBytes"
function getDataByteOne(): u8 {
  syncCycles(4);
  return <u8>eightBitLoadFromGBMemory(Cpu.programCounter);
}

function getDataByteTwo(): u8 {
  syncCycles(4);
  return <u8>eightBitLoadFromGBMemory(u16Portable(Cpu.programCounter + 1));
}
// Get our concatenated databyte one and getDataByteTwo()
// Find and replace with : getConcatenatedDataByte()
function getConcatenatedDataByte(): u16 {
  return <u16>concatenateBytes(getDataByteTwo(), getDataByteOne());
}

function handleOpcode0x(opcode: i32): i32 {
  switch (opcode) {
    case 0x00:
      // NOP
      // 1  4
      // No Operation
      return 4;
    case 0x01: {
      // LD BC,d16
      // 3  12

      // 8 cycles
      let concatenatedDataByte: i32 = getConcatenatedDataByte();

      Cpu.registerB = <u8>splitHighByte(concatenatedDataByte);
      Cpu.registerC = <u8>splitLowByte(concatenatedDataByte);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 2);

      return 4;
    }
    case 0x02: {
      // LD (BC),A
      // 1  8
      // () means load into address pointed by BC

      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerB, Cpu.registerC), Cpu.registerA);
      return 4;
    }
    case 0x03: {
      // INC BC
      // 1  8
      let registerBC3: u16 = <u16>concatenateBytes(Cpu.registerB, Cpu.registerC);
      registerBC3++;
      Cpu.registerB = <u8>splitHighByte(registerBC3);
      Cpu.registerC = <u8>splitLowByte(registerBC3);
      return 8;
    }
    case 0x04: {
      // INC B
      // 1  4
      // Z 0 H -
      let registerB = Cpu.registerB;
      checkAndSetEightBitHalfCarryFlag(registerB, 1);
      registerB = u8Portable(registerB + 1);
      Cpu.registerB = registerB;
      setZeroFlag(<i32>(registerB === 0));
      setSubtractFlag(0);
      return 4;
    }
    case 0x05: {
      // DEC B
      // 1  4
      // Z 1 H -
      let registerB = Cpu.registerB;
      checkAndSetEightBitHalfCarryFlag(registerB, -1);
      registerB = u8Portable(registerB - 1);
      Cpu.registerB = registerB;
      setZeroFlag(<i32>(registerB === 0));
      setSubtractFlag(1);
      return 4;
    }
    case 0x06: {
      // LD B,d8
      // 2  8

      // 4 cycles
      Cpu.registerB = getDataByteOne();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);

      return 4;
    }
    case 0x07: {
      // RLCA
      // 1  4
      // 0 0 0 C
      // Check for the carry
      let registerA = Cpu.registerA;
      setCarryFlag(<i32>((registerA & 0x80) === 0x80));
      Cpu.registerA = rotateByteLeft(registerA);
      // Set all other flags to zero
      setZeroFlag(0);
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return 4;
    }
    case 0x08: {
      // LD (a16),SP
      // 3  20
      // Load the stack pointer into the 16 bit address represented by the two data bytes

      // 16 cycles, 8 from data byte, 8 from sixteenbit store
      sixteenBitStoreSyncCycles(getConcatenatedDataByte(), Cpu.stackPointer);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 2);

      return 4;
    }
    case 0x09: {
      // ADD HL,BC
      // 1 8
      // - 0 H C
      let registerHL: u16 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      let registerBC9: u16 = <u16>concatenateBytes(Cpu.registerB, Cpu.registerC);
      checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerBC9, false);
      let result: u16 = u16Portable(<u16>(registerHL + registerBC9));
      Cpu.registerH = <u8>splitHighByte(<u16>result);
      Cpu.registerL = <u8>splitLowByte(<u16>result);
      setSubtractFlag(0);
      return 8;
    }
    case 0x0a: {
      // LD A,(BC)
      // 1 8

      // 4 cycles from load
      Cpu.registerA = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerB, Cpu.registerC));
      return 4;
    }
    case 0x0b: {
      // DEC BC
      // 1  8
      let registerBCB: u16 = <u16>concatenateBytes(Cpu.registerB, Cpu.registerC);
      registerBCB = u16Portable(registerBCB - 1);
      Cpu.registerB = <u8>splitHighByte(registerBCB);
      Cpu.registerC = <u8>splitLowByte(registerBCB);
      return 8;
    }
    case 0x0c: {
      // INC C
      // 1  4
      // Z 0 H -
      let registerC = Cpu.registerC;
      checkAndSetEightBitHalfCarryFlag(registerC, 1);
      registerC = u8Portable(registerC + 1);
      Cpu.registerC = registerC;
      setZeroFlag(<i32>(registerC === 0));
      setSubtractFlag(0);
      return 4;
    }
    case 0x0d: {
      // DEC C
      // 1  4
      // Z 1 H -
      let registerC = Cpu.registerC;
      checkAndSetEightBitHalfCarryFlag(registerC, -1);
      registerC = u8Portable(registerC - 1);
      Cpu.registerC = registerC;
      setZeroFlag(<i32>(registerC === 0));
      setSubtractFlag(1);
      return 4;
    }
    case 0x0e: {
      // LD C,d8
      // 2 8

      // 4 cycles
      Cpu.registerC = getDataByteOne();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);

      return 4;
    }
    case 0x0f: {
      // RRCA
      // 1 4
      // 0 0 0 C
      // Check for the last bit, to see if it will be carried
      let registerA = Cpu.registerA;
      setCarryFlag(<i32>((registerA & 0x01) > 0));
      Cpu.registerA = rotateByteRight(registerA);
      // Set all other flags to zero
      setZeroFlag(0);
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return 4;
    }
  }
  return -1;
}

function handleOpcode1x(opcode: i32): i32 {
  switch (opcode) {
    case 0x10: {
      // STOP 0
      // 2 4
      // Enter CPU very low power mode. Also used to switch between double and normal speed CPU modes in GBC.
      // Meaning Don't Decode anymore opcodes , or updated the LCD until joypad interrupt (or when button is pressed if I am wrong)
      // See HALT

      // If we are in gameboy color mode, set the new speed
      if (Cpu.GBCEnabled) {
        // 4 cycles
        let speedSwitch: i32 = eightBitLoadSyncCycles(Cpu.memoryLocationSpeedSwitch);
        if (checkBitOnByte(0, speedSwitch)) {
          // Reset the prepare bit
          speedSwitch = resetBitOnByte(0, speedSwitch);

          // Switch to the new mode, and set the speed switch to the OTHER speed, to represent our new speed
          if (!checkBitOnByte(7, speedSwitch)) {
            Cpu.GBCDoubleSpeed = true;
            speedSwitch = setBitOnByte(7, speedSwitch);
          } else {
            Cpu.GBCDoubleSpeed = false;
            speedSwitch = resetBitOnByte(7, speedSwitch);
          }

          // Store the final speed switch
          // 4 cycles
          eightBitStoreSyncCycles(Cpu.memoryLocationSpeedSwitch, speedSwitch);

          // Cycle accurate gameboy docs says this takes 76 clocks
          // 76 - 8 cycles (from load/store) = 68
          return 68;
        }
      }

      // NOTE: This breaks Blarggs CPU tests if CGB Stop is not implemented
      Cpu.isStopped = true;
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0x11: {
      // LD DE,d16
      // 3  12

      // 8 cycles
      let concatenatedDataByte = getConcatenatedDataByte();

      Cpu.registerD = <u8>splitHighByte(concatenatedDataByte);
      Cpu.registerE = <u8>splitLowByte(concatenatedDataByte);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
      return 4;
    }
    case 0x12: {
      // LD (DE),A
      // 1 8

      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerD, Cpu.registerE), Cpu.registerA);
      return 4;
    }
    case 0x13: {
      // INC DE
      // 1 8
      let registerDE3 = <u16>concatenateBytes(Cpu.registerD, Cpu.registerE);
      registerDE3 = u16Portable(registerDE3 + 1);
      Cpu.registerD = <u8>splitHighByte(registerDE3);
      Cpu.registerE = <u8>splitLowByte(registerDE3);
      return 8;
    }
    case 0x14: {
      // INC D
      // 1  4
      // Z 0 H -
      let registerD = Cpu.registerD;
      checkAndSetEightBitHalfCarryFlag(registerD, 1);
      registerD = u8Portable(registerD + 1);
      Cpu.registerD = registerD;
      setZeroFlag(<i32>(Cpu.registerD === 0));
      setSubtractFlag(0);
      return 4;
    }
    case 0x15: {
      // DEC D
      // 1  4
      // Z 1 H -
      let registerD = Cpu.registerD;
      checkAndSetEightBitHalfCarryFlag(registerD, -1);
      registerD = u8Portable(registerD - 1);
      Cpu.registerD = registerD;
      setZeroFlag(<i32>(Cpu.registerD === 0));
      setSubtractFlag(1);
      return 4;
    }
    case 0x16: {
      // LD D,d8
      // 2 8

      // 4 cycles
      Cpu.registerD = getDataByteOne();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0x17: {
      // RLA
      // 1 4
      // 0 0 0 C
      // Check for the carry
      // setting has first bit since we need to use carry
      let hasHighbit = (Cpu.registerA & 0x80) === 0x80;
      Cpu.registerA = rotateByteLeftThroughCarry(Cpu.registerA);
      // OR the carry flag to the end
      setCarryFlag(<i32>hasHighbit);
      // Set all other flags to zero
      setZeroFlag(0);
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return 4;
    }
    case 0x18: {
      // JR r8
      // 2  12
      // NOTE: Discoved dataByte is signed
      // However the relative Jump Function handles this

      // 4 cycles
      relativeJump(getDataByteOne());
      return 8;
    }
    // Relative Jump Function Handles program counter
    case 0x19: {
      // ADD HL,DE
      // 1  8
      // - 0 H C
      let registerHL = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      let registerDE9 = <u16>concatenateBytes(Cpu.registerD, Cpu.registerE);
      checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerDE9, false);
      let result = u16Portable(<u16>(registerHL + registerDE9));
      Cpu.registerH = <u8>splitHighByte(<u16>result);
      Cpu.registerL = <u8>splitLowByte(<u16>result);
      setSubtractFlag(0);
      return 8;
    }
    case 0x1a: {
      // LD A,(DE)
      // 1 8
      let registerDEA = <u16>concatenateBytes(Cpu.registerD, Cpu.registerE);
      // 4 cycles
      Cpu.registerA = <u8>eightBitLoadSyncCycles(registerDEA);
      return 4;
    }
    case 0x1b: {
      // DEC DE
      // 1 8
      let registerDEB = <u16>concatenateBytes(Cpu.registerD, Cpu.registerE);
      registerDEB = u16Portable(registerDEB - 1);
      Cpu.registerD = <u8>splitHighByte(registerDEB);
      Cpu.registerE = <u8>splitLowByte(registerDEB);
      return 8;
    }
    case 0x1c: {
      // INC E
      // 1  4
      // Z 0 H -
      let registerE = Cpu.registerE;
      checkAndSetEightBitHalfCarryFlag(registerE, 1);
      registerE = u8Portable(registerE + 1);
      Cpu.registerE = registerE;
      setZeroFlag(<i32>(registerE === 0));
      setSubtractFlag(0);
      return 4;
    }
    case 0x1d: {
      // DEC E
      // 1  4
      // Z 1 H -
      let registerE = Cpu.registerE;
      checkAndSetEightBitHalfCarryFlag(registerE, -1);
      registerE = u8Portable(registerE - 1);
      Cpu.registerE = registerE;
      setZeroFlag(<i32>(registerE === 0));
      setSubtractFlag(1);
      return 4;
    }
    case 0x1e: {
      // LD E,d8
      // 2 8

      // 4 cycles
      Cpu.registerE = getDataByteOne();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0x1f: {
      // RRA
      // 1 4
      // 0 0 0 C
      // Check for the carry
      // setting has low bit since we need to use carry
      let hasLowBit = (Cpu.registerA & 0x01) === 0x01;
      Cpu.registerA = rotateByteRightThroughCarry(Cpu.registerA);

      setCarryFlag(<i32>hasLowBit);
      // Set all other flags to zero
      setZeroFlag(0);
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return 4;
    }
  }

  return -1;
}

function handleOpcode2x(opcode: i32): i32 {
  switch (opcode) {
    case 0x20: {
      // JR NZ,r8
      // 2  12/8
      // NOTE: NZ stands for not [flag], so in this case, not zero flag
      // Also, / means, if condition. so if met, 12 cycles, otherwise 8 cycles
      if (getZeroFlag() === 0) {
        // 4 cycles
        relativeJump(getDataByteOne());
        // Relative Jump Funciton handles program counter
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      }
      return 8;
    }
    case 0x21: {
      // LD HL,d16
      // 3  12
      // 8 cycles
      let sixteenBitDataByte = getConcatenatedDataByte();
      Cpu.registerH = <u8>splitHighByte(sixteenBitDataByte);
      Cpu.registerL = <u8>splitLowByte(sixteenBitDataByte);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
      return 4;
    }
    case 0x22: {
      // LD (HL+),A
      // 1 8
      let registerHL2 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      // 4 cycles
      eightBitStoreSyncCycles(registerHL2, Cpu.registerA);
      registerHL2 = u16Portable(registerHL2 + 1);
      Cpu.registerH = <u8>splitHighByte(registerHL2);
      Cpu.registerL = <u8>splitLowByte(registerHL2);
      return 4;
    }
    case 0x23: {
      // INC HL
      // 1  8
      let registerHL3 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      registerHL3 = u16Portable(registerHL3 + 1);
      Cpu.registerH = <u8>splitHighByte(registerHL3);
      Cpu.registerL = <u8>splitLowByte(registerHL3);
      return 8;
    }
    case 0x24: {
      // INC H
      // 1  4
      // Z 0 H -
      let registerH = Cpu.registerH;
      checkAndSetEightBitHalfCarryFlag(registerH, 1);
      registerH = u8Portable(registerH + 1);
      Cpu.registerH = registerH;
      setZeroFlag(<i32>(registerH === 0));
      setSubtractFlag(0);
      return 4;
    }
    case 0x25: {
      // DEC H
      // 1  4
      // Z 1 H -
      let registerH = Cpu.registerH;
      checkAndSetEightBitHalfCarryFlag(registerH, -1);
      registerH = u8Portable(registerH - 1);
      Cpu.registerH = registerH;
      setZeroFlag(<i32>(registerH === 0));
      setSubtractFlag(1);
      return 4;
    }
    case 0x26: {
      // LD H,d8
      // 2 8

      // 4 cycles
      Cpu.registerH = getDataByteOne();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0x27: {
      // DAA
      // 1 4
      // Z - 0 C
      let adjustedRegister: u8 = 0;
      let adjustment: u8 = 0;

      if (getHalfCarryFlag() > 0) {
        adjustment = adjustment | 0x06;
      }
      if (getCarryFlag() > 0) {
        adjustment = adjustment | 0x60;
      }

      let registerA = Cpu.registerA;
      if (getSubtractFlag() > 0) {
        adjustedRegister = u8Portable(registerA - <u8>adjustment);
      } else {
        if ((registerA & 0x0f) > 0x09) {
          adjustment = adjustment | 0x06;
        }
        if (registerA > 0x99) {
          adjustment = adjustment | 0x60;
        }
        adjustedRegister = u8Portable(registerA + <u8>adjustment);
      }

      // Now set our flags to the correct values
      setZeroFlag(<i32>(adjustedRegister === 0));
      setCarryFlag(<i32>((adjustment & 0x60) !== 0));
      setHalfCarryFlag(0);

      Cpu.registerA = <u8>adjustedRegister;
      return 4;
    }
    case 0x28: {
      // JR Z,r8
      // 2  12/8
      if (getZeroFlag() > 0) {
        // 4 cycles
        relativeJump(getDataByteOne());
        // Relative Jump funciton handles pogram counter
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      }
      return 8;
    }
    case 0x29: {
      // ADD HL,HL
      // 1  8
      // - 0 H C
      let registerHL9 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      checkAndSetSixteenBitFlagsAddOverflow(registerHL9, registerHL9, false);
      registerHL9 = u16Portable(registerHL9 * 2);
      Cpu.registerH = <u8>splitHighByte(registerHL9);
      Cpu.registerL = <u8>splitLowByte(registerHL9);
      setSubtractFlag(0);
      return 8;
    }
    case 0x2a: {
      // LD A,(HL+)
      // 1  8
      let registerHLA = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      // 4 cycles
      Cpu.registerA = <u8>eightBitLoadSyncCycles(registerHLA);
      registerHLA = u16Portable(registerHLA + 1);
      Cpu.registerH = <u8>splitHighByte(registerHLA);
      Cpu.registerL = <u8>splitLowByte(registerHLA);
      return 4;
    }
    case 0x2b: {
      // DEC HL
      // 1 8
      let registerHLB = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      registerHLB = u16Portable(registerHLB - 1);
      Cpu.registerH = <u8>splitHighByte(registerHLB);
      Cpu.registerL = <u8>splitLowByte(registerHLB);
      return 8;
    }
    case 0x2c: {
      // INC L
      // 1  4
      // Z 0 H -
      let registerL = Cpu.registerL;
      checkAndSetEightBitHalfCarryFlag(registerL, 1);
      registerL = u8Portable(registerL + 1);
      Cpu.registerL = registerL;
      setZeroFlag(<i32>(registerL === 0));
      setSubtractFlag(0);
      return 4;
    }
    case 0x2d: {
      // DEC L
      // 1  4
      // Z 1 H -
      let registerL = Cpu.registerL;
      checkAndSetEightBitHalfCarryFlag(registerL, -1);
      registerL = u8Portable(registerL - 1);
      Cpu.registerL = registerL;
      setZeroFlag(<i32>(registerL === 0));
      setSubtractFlag(1);
      return 4;
    }
    case 0x2e: {
      // LD L,d8
      // 2  8
      // 4 cycles
      Cpu.registerL = getDataByteOne();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0x2f: {
      // CPL
      // 1 4
      // - 1 1 -
      Cpu.registerA = ~Cpu.registerA;
      setSubtractFlag(1);
      setHalfCarryFlag(1);
      return 4;
    }
  }
  return -1;
}

function handleOpcode3x(opcode: i32): i32 {
  switch (opcode) {
    case 0x30: {
      // JR NC,r8
      // 2 12 / 8
      if (getCarryFlag() === 0) {
        // 4 cycles
        relativeJump(getDataByteOne());
        // Relative Jump function handles program counter
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      }
      return 8;
    }
    case 0x31: {
      // LD SP,d16
      // 3 12
      // 8 cycles
      Cpu.stackPointer = getConcatenatedDataByte();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
      return 4;
    }
    case 0x32: {
      // LD (HL-),A
      // 1 8
      let registerHL2 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      // 4 cycles
      eightBitStoreSyncCycles(registerHL2, Cpu.registerA);
      registerHL2 = u16Portable(registerHL2 - 1);
      Cpu.registerH = <u8>splitHighByte(registerHL2);
      Cpu.registerL = <u8>splitLowByte(registerHL2);
      return 4;
    }
    case 0x33: {
      // INC SP
      // 1 8
      Cpu.stackPointer = u16Portable(Cpu.stackPointer + 1);
      return 8;
    }
    case 0x34: {
      // INC (HL)
      // 1  12
      // Z 0 H -
      let registerHL4 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      // 4 cycles
      let valueAtHL4 = <u8>eightBitLoadSyncCycles(registerHL4);
      // Creating a varible for this to fix assemblyscript overflow bug
      // Requires explicit casting
      // https://github.com/AssemblyScript/assemblyscript/issues/26
      let incrementer: u8 = 1;
      checkAndSetEightBitHalfCarryFlag(<u8>valueAtHL4, <i16>incrementer);
      valueAtHL4 = u8Portable(<u8>valueAtHL4 + <u8>incrementer);

      setZeroFlag(<i32>(valueAtHL4 === 0));
      setSubtractFlag(0);
      // 4 cycles
      eightBitStoreSyncCycles(registerHL4, <u8>valueAtHL4);
      return 4;
    }
    case 0x35: {
      // DEC (HL)
      // 1  12
      // Z 1 H -
      let registerHL5 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      // 4 cycles
      let valueAtHL5 = <u8>eightBitLoadSyncCycles(registerHL5);
      // NOTE: This opcode may not overflow correctly,
      // Please see previous opcode
      checkAndSetEightBitHalfCarryFlag(valueAtHL5, -1);
      valueAtHL5 = u8Portable(valueAtHL5 - 1);
      setZeroFlag(<i32>(valueAtHL5 === 0));
      setSubtractFlag(1);
      // 4 cycles
      eightBitStoreSyncCycles(registerHL5, valueAtHL5);
      return 4;
    }
    case 0x36: {
      // LD (HL),d8
      // 2  12
      // 8 cycles, 4 from store, 4 from data byte
      eightBitStoreSyncCycles(<u16>concatenateBytes(Cpu.registerH, Cpu.registerL), getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0x37: {
      // SCF
      // 1  4
      // - 0 0 1
      // Simply set the carry flag
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      setCarryFlag(1);
      return 4;
    }
    case 0x38: {
      // JR C,r8
      // 2 12/8
      if (getCarryFlag() === 1) {
        // 4 cycles
        relativeJump(getDataByteOne());
        // Relative Jump Funciton handles program counter
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      }
      return 8;
    }
    case 0x39: {
      // ADD HL,SP
      // 1 8
      // - 0 H C
      let registerHL9 = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL9, Cpu.stackPointer, false);
      let result = u16Portable(<u16>(registerHL9 + Cpu.stackPointer));
      Cpu.registerH = <u8>splitHighByte(<u16>result);
      Cpu.registerL = <u8>splitLowByte(<u16>result);
      setSubtractFlag(0);
      return 8;
    }
    case 0x3a: {
      // LD A,(HL-)
      // 1 8
      let registerHLA = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      // 4 cycles
      Cpu.registerA = <u8>eightBitLoadSyncCycles(registerHLA);
      registerHLA = u16Portable(registerHLA - 1);
      Cpu.registerH = <u8>splitHighByte(registerHLA);
      Cpu.registerL = <u8>splitLowByte(registerHLA);
      return 4;
    }
    case 0x3b: {
      // DEC SP
      // 1 8
      Cpu.stackPointer = u16Portable(Cpu.stackPointer - 1);
      return 8;
    }
    case 0x3c: {
      // INC A
      // 1  4
      // Z 0 H -
      let registerA = Cpu.registerA;
      checkAndSetEightBitHalfCarryFlag(registerA, 1);
      registerA = u8Portable(registerA + 1);
      Cpu.registerA = registerA;
      setZeroFlag(<i32>(registerA === 0));
      setSubtractFlag(0);
      return 4;
    }
    case 0x3d: {
      // DEC A
      // 1  4
      // Z 1 H -
      let registerA = Cpu.registerA;
      checkAndSetEightBitHalfCarryFlag(registerA, -1);
      registerA = u8Portable(registerA - 1);
      Cpu.registerA = registerA;
      setZeroFlag(<i32>(registerA === 0));
      setSubtractFlag(1);
      return 4;
    }
    case 0x3e: {
      // LD A,d8
      // 2 8
      // 4 cycles
      Cpu.registerA = getDataByteOne();
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0x3f: {
      // CCF
      // 1 4
      // - 0 0 C
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      setCarryFlag(<i32>(getCarryFlag() <= 0));
      return 4;
    }
  }
  return -1;
}

function handleOpcode4x(opcode: i32): i32 {
  switch (opcode) {
    case 0x40:
      // LD B,B
      // 1 4
      // Load B into B, Do nothing
      return 4;
    case 0x41:
      // LD B,C
      // 1 4
      Cpu.registerB = Cpu.registerC;
      return 4;
    case 0x42:
      // LD B,D
      // 1 4
      Cpu.registerB = Cpu.registerD;
      return 4;
    case 0x43:
      // LD B,E
      // 1 4
      Cpu.registerB = Cpu.registerE;
      return 4;
    case 0x44:
      // LD B,H
      // 1 4
      Cpu.registerB = Cpu.registerH;
      return 4;
    case 0x45:
      // LD B,L
      // 1 4
      Cpu.registerB = Cpu.registerL;
      return 4;
    case 0x46:
      // LD B,(HL)
      // 1 8
      // 4 cycles
      Cpu.registerB = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x47:
      // LD B,A
      // 1 4
      Cpu.registerB = Cpu.registerA;
      return 4;
    case 0x48:
      // LD C,B
      // 1 4
      Cpu.registerC = Cpu.registerB;
      return 4;
    case 0x49:
      // LD C,C
      // 1 4
      // Do nothing
      return 4;
    case 0x4a:
      // LD C,D
      // 1 4
      Cpu.registerC = Cpu.registerD;
      return 4;
    case 0x4b:
      // LD C,E
      // 1 4
      Cpu.registerC = Cpu.registerE;
      return 4;
    case 0x4c:
      // LD C,H
      // 1 4
      Cpu.registerC = Cpu.registerH;
      return 4;
    case 0x4d:
      // LD C,L
      // 1 4
      Cpu.registerC = Cpu.registerL;
      return 4;
    case 0x4e:
      // LD C,(HL)
      // 1 8
      // 4 cycles
      Cpu.registerC = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x4f:
      // LD C,A
      // 1 4
      Cpu.registerC = Cpu.registerA;
      return 4;
  }
  return -1;
}

function handleOpcode5x(opcode: i32): i32 {
  switch (opcode) {
    case 0x50:
      // LD D,B
      // 1 4
      Cpu.registerD = Cpu.registerB;
      return 4;
    case 0x51:
      // LD D,C
      // 1 4
      Cpu.registerD = Cpu.registerC;
      return 4;
    case 0x52:
      // LD D,D
      // 1 4
      // Do Nothing
      return 4;
    case 0x53:
      // LD D,E
      // 1 4
      Cpu.registerD = Cpu.registerE;
      return 4;
    case 0x54:
      // LD D,H
      // 1 4
      Cpu.registerD = Cpu.registerH;
      return 4;
    case 0x55:
      // LD D,L
      // 1 4
      Cpu.registerD = Cpu.registerL;
      return 4;
    case 0x56:
      // LD D,(HL)
      // 1 8
      // 4 cycles
      Cpu.registerD = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x57:
      // LD D,A
      // 1 4
      Cpu.registerD = Cpu.registerA;
      return 4;
    case 0x58:
      // LD E,B
      // 1 4
      Cpu.registerE = Cpu.registerB;
      return 4;
    case 0x59:
      // LD E,C
      // 1 4
      Cpu.registerE = Cpu.registerC;
      return 4;
    case 0x5a:
      // LD E,D
      // 1 4
      Cpu.registerE = Cpu.registerD;
      return 4;
    case 0x5b:
      // LD E,E
      // 1 4
      // Do Nothing
      return 4;
    case 0x5c:
      // LD E,H
      // 1 4
      Cpu.registerE = Cpu.registerH;
      return 4;
    case 0x5d:
      // LD E,L
      // 1 4
      Cpu.registerE = Cpu.registerL;
      return 4;
    case 0x5e:
      // LD E,(HL)
      // 1 8
      // 4 cycles
      Cpu.registerE = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x5f:
      // LD E,A
      // 1 4
      Cpu.registerE = Cpu.registerA;
      return 4;
  }
  return -1;
}

function handleOpcode6x(opcode: i32): i32 {
  switch (opcode) {
    case 0x60:
      // LD H,B
      // 1 4
      Cpu.registerH = Cpu.registerB;
      return 4;
    case 0x61:
      // LD H,C
      // 1 4
      Cpu.registerH = Cpu.registerC;
      return 4;
    case 0x62:
      // LD H,D
      // 1 4
      Cpu.registerH = Cpu.registerD;
      return 4;
    case 0x63:
      // LD H,E
      // 1 4
      Cpu.registerH = Cpu.registerE;
      return 4;
    case 0x64:
      // LD H,H
      // 1 4
      Cpu.registerH = Cpu.registerH;
      return 4;
    case 0x65:
      // LD H,L
      // 1 4
      Cpu.registerH = Cpu.registerL;
      return 4;
    case 0x66:
      // LD H,(HL)
      // 1 8
      // 4 cycles
      Cpu.registerH = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x67:
      // LD H,A
      // 1 4
      Cpu.registerH = Cpu.registerA;
      return 4;
    case 0x68:
      // LD L,B
      // 1 4
      Cpu.registerL = Cpu.registerB;
      return 4;
    case 0x69:
      // LD L,C
      // 1 4
      Cpu.registerL = Cpu.registerC;
      return 4;
    case 0x6a:
      // LD L,D
      // 1 4
      Cpu.registerL = Cpu.registerD;
      return 4;
    case 0x6b:
      // LD L,E
      // 1 4
      Cpu.registerL = Cpu.registerE;
      return 4;
    case 0x6c:
      // LD L,H
      // 1 4
      Cpu.registerL = Cpu.registerH;
      return 4;
    case 0x6d:
      // LD L,L
      // 1 4
      Cpu.registerL = Cpu.registerL;
      return 4;
    case 0x6e:
      // LD L,(HL)
      // 1 8
      // 4 cycles
      Cpu.registerL = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x6f:
      // LD L,A
      // 1 4
      Cpu.registerL = Cpu.registerA;
      return 4;
  }
  return -1;
}

function handleOpcode7x(opcode: i32): i32 {
  switch (opcode) {
    case 0x70:
      // LD (HL),B
      // 1 8
      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerB);
      return 4;
    case 0x71:
      // LD (HL),C
      // 1 8
      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerC);
      return 4;
    case 0x72:
      // LD (HL),D
      // 1 8
      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerD);
      return 4;
    case 0x73:
      // LD (HL),E
      // 1 8
      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerE);
      return 4;
    case 0x74:
      // LD (HL),H
      // 1 8
      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerH);
      return 4;
    case 0x75:
      // LD (HL),L
      // 1 8
      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerL);
      return 4;
    case 0x76:
      // HALT
      // 1 4
      // Enter CPU very low power mode
      // Meaning Don't Decode anymore opcodes until an interrupt occurs
      // Still need to do timers and things

      // Can't Halt during an HDMA
      // https://gist.github.com/drhelius/3394856
      if (!Memory.isHblankHdmaActive) {
        Cpu.enableHalt();
      }
      return 4;
    case 0x77:
      // LD (HL),A
      // 1 8
      // 4 cycles
      eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerA);
      return 4;
    case 0x78:
      // LD A,B
      // 1 4
      Cpu.registerA = Cpu.registerB;
      return 4;
    case 0x79:
      // LD A,C
      // 1 4
      Cpu.registerA = Cpu.registerC;
      return 4;
    case 0x7a:
      // LD A,D
      // 1 4
      Cpu.registerA = Cpu.registerD;
      return 4;
    case 0x7b:
      // LD A,E
      // 1 4
      Cpu.registerA = Cpu.registerE;
      return 4;
    case 0x7c:
      // LD A,H
      // 1 4
      Cpu.registerA = Cpu.registerH;
      return 4;
    case 0x7d:
      // LD A,L
      // 1 4
      Cpu.registerA = Cpu.registerL;
      return 4;
    case 0x7e:
      // LD A,(HL)
      // 1 8
      // NOTE: Thanks to @binji for catching that this should be 8 cycles, not 4
      // 4 cycles
      Cpu.registerA = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x7f:
      // LD A,A
      // 1 4
      // Do Nothing
      return 4;
  }
  return -1;
}

function handleOpcode8x(opcode: i32): i32 {
  switch (opcode) {
    case 0x80:
      // ADD A,B
      // 1 4
      // Z 0 H C
      addARegister(Cpu.registerB);
      return 4;
    case 0x81:
      // ADD A,C
      // 1 4
      // Z 0 H C
      addARegister(Cpu.registerC);
      return 4;
    case 0x82:
      // ADD A,D
      // 1 4
      // Z 0 H C
      addARegister(Cpu.registerD);
      return 4;
    case 0x83:
      // ADD A,E
      // 1 4
      // Z 0 H C
      addARegister(Cpu.registerE);
      return 4;
    case 0x84:
      // ADD A,H
      // 1 4
      // Z 0 H C
      addARegister(Cpu.registerH);
      return 4;
    case 0x85:
      // ADD A,L
      // 1 4
      // Z 0 H C
      addARegister(Cpu.registerL);
      return 4;
    case 0x86:
      // ADD A,(HL)
      // 1 8
      // Z 0 H C
      // 4 cycles
      let valueAtHL6: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      addARegister(<u8>valueAtHL6);
      return 4;
    case 0x87:
      // ADD A,A
      // 1 4
      // Z 0 H C
      addARegister(Cpu.registerA);
      return 4;
    case 0x88:
      // ADC A,B
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerB);
      return 4;
    case 0x89:
      // ADC A,C
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerC);
      return 4;
    case 0x8a:
      // ADC A,D
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerD);
      return 4;
    case 0x8b:
      // ADC A,E
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerE);
      return 4;
    case 0x8c:
      // ADC A,H
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerH);
      return 4;
    case 0x8d:
      // ADC A,L
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerL);
      return 4;
    case 0x8e:
      // ADC A,(HL)
      // 1 8
      // Z 0 H C
      // 4 cycles
      let valueAtHLE: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      addAThroughCarryRegister(<u8>valueAtHLE);
      return 4;
    case 0x8f:
      // ADC A,A
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcode9x(opcode: i32): i32 {
  switch (opcode) {
    case 0x90:
      // SUB B
      // 1  4
      // Z 1 H C
      subARegister(Cpu.registerB);
      return 4;
    case 0x91:
      // SUB C
      // 1  4
      // Z 1 H C
      subARegister(Cpu.registerC);
      return 4;
    case 0x92:
      // SUB D
      // 1  4
      // Z 1 H C
      subARegister(Cpu.registerD);
      return 4;
    case 0x93:
      // SUB E
      // 1  4
      // Z 1 H C
      subARegister(Cpu.registerE);
      return 4;
    case 0x94:
      // SUB H
      // 1  4
      // Z 1 H C
      subARegister(Cpu.registerH);
      return 4;
    case 0x95:
      // SUB L
      // 1  4
      // Z 1 H C
      subARegister(Cpu.registerL);
      return 4;
    case 0x96:
      // SUB (HL)
      // 1  8
      // Z 1 H C
      // 4 cycles
      let valueAtHL6: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      subARegister(<u8>valueAtHL6);
      return 4;
    case 0x97:
      // SUB A
      // 1  4
      // Z 1 H C
      subARegister(Cpu.registerA);
      return 4;
    case 0x98:
      // SBC A,B
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerB);
      return 4;
    case 0x99:
      // SBC A,C
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerC);
      return 4;
    case 0x9a:
      // SBC A,D
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerD);
      return 4;
    case 0x9b:
      // SBC A,E
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerE);
      return 4;
    case 0x9c:
      // SBC A,H
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerH);
      return 4;
    case 0x9d:
      // SBC A,L
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerL);
      return 4;
    case 0x9e:
      // SBC A,(HL)
      // 1  8
      // Z 1 H C
      // 4 cycles
      let valueAtHLE: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      subAThroughCarryRegister(<u8>valueAtHLE);
      return 4;
    case 0x9f:
      // SBC A,A
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcodeAx(opcode: i32): i32 {
  switch (opcode) {
    case 0xa0:
      // AND B
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerB);
      return 4;
    case 0xa1:
      // AND C
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerC);
      return 4;
    case 0xa2:
      // AND D
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerD);
      return 4;
    case 0xa3:
      // AND E
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerE);
      return 4;
    case 0xa4:
      // AND H
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerH);
      return 4;
    case 0xa5:
      // AND L
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerL);
      return 4;
    case 0xa6:
      // AND (HL)
      // 1  8
      // Z 0 1 0
      // 4 cycles
      let valueAtHL6: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      andARegister(<u8>valueAtHL6);
      return 4;
    case 0xa7:
      // AND A
      // 1  4
      // Z 0 1 0
      // NOTE: & Yourself, does nothing
      andARegister(Cpu.registerA);
      return 4;
    case 0xa8:
      // XOR B
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerB);
      return 4;
    case 0xa9:
      // XOR C
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerC);
      return 4;
    case 0xaa:
      // XOR D
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerD);
      return 4;
    case 0xab:
      // XOR E
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerE);
      return 4;
    case 0xac:
      // XOR H
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerH);
      return 4;
    case 0xad:
      // XOR L
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerL);
      return 4;
    case 0xae:
      // XOR (HL)
      // 1  8
      // Z 0 0 0
      // 4 cycles
      let valueAtHLE: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      xorARegister(<u8>valueAtHLE);
      return 4;
    case 0xaf:
      // XOR A
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcodeBx(opcode: i32): i32 {
  switch (opcode) {
    case 0xb0:
      // OR B
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerB);
      return 4;
    case 0xb1:
      // OR C
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerC);
      return 4;
    case 0xb2:
      // OR D
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerD);
      return 4;
    case 0xb3:
      // OR E
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerE);
      return 4;
    case 0xb4:
      // OR H
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerH);
      return 4;
    case 0xb5:
      // OR L
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerL);
      return 4;
    case 0xb6:
      // OR (HL)
      // 1  8
      // Z 0 0 0
      // 4 cycles
      let valueAtHL6: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      orARegister(<u8>valueAtHL6);
      return 4;
    case 0xb7:
      // OR A
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerA);
      return 4;
    case 0xb8:
      // CP B
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerB);
      return 4;
    case 0xb9:
      // CP C
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerC);
      return 4;
    case 0xba:
      // CP D
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerD);
      return 4;
    case 0xbb:
      // CP E
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerE);
      return 4;
    case 0xbc:
      // CP H
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerH);
      return 4;
    case 0xbd:
      // CP L
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerL);
      return 4;
    case 0xbe:
      // CP (HL)
      // 1  8
      // Z 1 H C
      // 4 cycles
      let valueAtHLE: u8 = <u8>eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
      cpARegister(<u8>valueAtHLE);
      return 4;
    case 0xbf:
      // CP A
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcodeCx(opcode: i32): i32 {
  switch (opcode) {
    case 0xc0: {
      // RET NZ
      // 1  20/8
      if (getZeroFlag() === 0) {
        // 8 cycles
        let stackPointer = Cpu.stackPointer;
        Cpu.programCounter = <u16>sixteenBitLoadSyncCycles(stackPointer);
        Cpu.stackPointer = u16Portable(stackPointer + 2);
        return 12;
      } else {
        return 8;
      }
    }
    case 0xc1: {
      // POP BC
      // 1  12
      // 8 cycles
      let registerBC1: i32 = sixteenBitLoadSyncCycles(Cpu.stackPointer);
      Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
      Cpu.registerB = <u8>splitHighByte(registerBC1);
      Cpu.registerC = <u8>splitLowByte(registerBC1);
      return 4;
    }
    case 0xc2: {
      // JP NZ,a16
      // 3  16/12
      if (getZeroFlag() === 0) {
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    case 0xc3: {
      // JP a16
      // 3  16
      // 8 cycles
      Cpu.programCounter = getConcatenatedDataByte();
      return 8;
    }
    case 0xc4: {
      // CALL NZ,a16
      // 3  24/12
      if (getZeroFlag() === 0) {
        let stackPointer = u16Portable(Cpu.stackPointer - 2);
        Cpu.stackPointer = stackPointer;
        // 8 cycles
        sixteenBitStoreSyncCycles(stackPointer, u16Portable(Cpu.programCounter + 2));
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    case 0xc5: {
      // PUSH BC
      // 1  16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerB, Cpu.registerC));
      return 8;
    }
    case 0xc6: {
      // ADD A,d8
      // 2 8
      // Z 0 H C
      // 4 cycles
      addARegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xc7: {
      // RST 00H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x00;
      return 8;
    }
    case 0xc8: {
      // RET Z
      // 1  20/8
      if (getZeroFlag() === 1) {
        // 8 cycles
        let stackPointer = Cpu.stackPointer;
        Cpu.programCounter = <u16>sixteenBitLoadSyncCycles(stackPointer);
        Cpu.stackPointer = u16Portable(stackPointer + 2);
        return 12;
      } else {
        return 8;
      }
    }
    case 0xc9: {
      // RET
      // 1 16
      // 8 cycles
      let stackPointer = Cpu.stackPointer;
      Cpu.programCounter = <u16>sixteenBitLoadSyncCycles(stackPointer);
      Cpu.stackPointer = u16Portable(stackPointer + 2);
      return 8;
    }
    case 0xca: {
      // JP Z,a16
      // 3 16/12
      if (getZeroFlag() === 1) {
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    case 0xcb: {
      // PREFIX CB
      // 1  4
      // 4 cycles
      let cbCycles: i32 = handleCbOpcode(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return cbCycles;
    }
    case 0xcc: {
      // CALL Z,a16
      // 3  24/12
      if (getZeroFlag() === 1) {
        let stackPointer = u16Portable(Cpu.stackPointer - 2);
        Cpu.stackPointer = stackPointer;
        // 8 cycles
        sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter + 2);
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    case 0xcd: {
      // CALL a16
      // 3  24
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, u16Portable(Cpu.programCounter + 2));
      // 8 cycles
      Cpu.programCounter = getConcatenatedDataByte();
      return 8;
    }
    case 0xce: {
      // ADC A,d8
      // 2  8
      // Z 0 H C
      // 4 cycles
      addAThroughCarryRegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xcf: {
      // RST 08H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x08;
      return 8;
    }
  }
  return -1;
}

function handleOpcodeDx(opcode: i32): i32 {
  switch (opcode) {
    case 0xd0: {
      // RET NC
      // 1  20/8
      if (getCarryFlag() === 0) {
        // 8 cycles
        let stackPointer = Cpu.stackPointer;
        Cpu.programCounter = <u16>sixteenBitLoadSyncCycles(stackPointer);
        Cpu.stackPointer = u16Portable(stackPointer + 2);
        return 12;
      } else {
        return 8;
      }
    }
    case 0xd1: {
      // POP DE
      // 1  12
      // 8 cycles
      let stackPointer = Cpu.stackPointer;
      let registerDE1: i32 = sixteenBitLoadSyncCycles(stackPointer);
      Cpu.stackPointer = u16Portable(stackPointer + 2);
      Cpu.registerD = <u8>splitHighByte(registerDE1);
      Cpu.registerE = <u8>splitLowByte(registerDE1);
      return 4;
    }
    case 0xd2: {
      // JP NC,a16
      // 3  16/12
      if (getCarryFlag() === 0) {
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    /* No Opcode for: 0xD3 */
    case 0xd4: {
      // CALL NC,a16
      // 3  24/12
      if (getCarryFlag() === 0) {
        let stackPointer = u16Portable(Cpu.stackPointer - 2);
        Cpu.stackPointer = stackPointer;
        // 8 cycles
        sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter + 2);
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    case 0xd5: {
      // PUSH DE
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerD, Cpu.registerE));
      return 8;
    }
    case 0xd6: {
      // SUB d8
      // 2  8
      // Z 1 H C
      // 4 cycles
      subARegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xd7: {
      // RST 10H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x10;
      return 8;
    }
    case 0xd8: {
      // RET C
      // 1  20/8
      if (getCarryFlag() === 1) {
        let stackPointer = Cpu.stackPointer;
        // 8 cycles
        Cpu.programCounter = <u16>sixteenBitLoadSyncCycles(stackPointer);
        Cpu.stackPointer = u16Portable(stackPointer + 2);
        return 12;
      } else {
        return 8;
      }
    }
    case 0xd9: {
      // RETI
      // 1  16
      let stackPointer = Cpu.stackPointer;
      // 8 cycles
      Cpu.programCounter = <u16>sixteenBitLoadSyncCycles(stackPointer);
      // Enable interrupts
      setInterrupts(true);
      Cpu.stackPointer = u16Portable(stackPointer + 2);
      return 8;
    }
    case 0xda: {
      // JP C,a16
      // 3 16/12
      if (getCarryFlag() === 1) {
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    /* No Opcode for: 0xDB */
    case 0xdc: {
      // CALL C,a16
      // 3  24/12
      if (getCarryFlag() === 1) {
        let stackPointer = u16Portable(Cpu.stackPointer - 2);
        Cpu.stackPointer = stackPointer;
        // 8 cycles
        sixteenBitStoreSyncCycles(stackPointer, u16Portable(Cpu.programCounter + 2));
        // 8 cycles
        Cpu.programCounter = getConcatenatedDataByte();
        return 8;
      } else {
        Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
        return 12;
      }
    }
    /* No Opcode for: 0xDD */
    case 0xde: {
      // SBC A,d8
      // 2 8
      // Z 1 H C
      // 4 cycles
      subAThroughCarryRegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xdf: {
      // RST 18H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x18;
      return 8;
    }
  }
  return -1;
}

function handleOpcodeEx(opcode: i32): i32 {
  switch (opcode) {
    case 0xe0: {
      // LDH (a8),A
      // 2  12

      // Store value in high RAM ($FF00 + a8)
      // 4 cycles
      let largeDataByteOne: i32 = getDataByteOne();
      // 4 cycles
      eightBitStoreSyncCycles(0xff00 + largeDataByteOne, Cpu.registerA);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xe1: {
      // POP HL
      // 1  12
      // 8 cycles
      let stackPointer = Cpu.stackPointer;
      let registerHL1: i32 = sixteenBitLoadSyncCycles(stackPointer);
      Cpu.stackPointer = u16Portable(stackPointer + 2);
      Cpu.registerH = <u8>splitHighByte(registerHL1);
      Cpu.registerL = <u8>splitLowByte(registerHL1);
      return 4;
    }
    case 0xe2: {
      // LD (C),A
      // 1  8
      // NOTE: Table says 2 Program counter,
      // But stepping through the boot rom, should be one
      // Also should change 0xF2

      // Store value in high RAM ($FF00 + register c)
      // 4 cycles
      eightBitStoreSyncCycles(0xff00 + <i32>Cpu.registerC, Cpu.registerA);
      return 4;
    }
    /* No Opcode for: 0xE3, 0xE4 */
    case 0xe5: {
      // PUSH HL
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 8;
    }
    case 0xe6: {
      // AND d8
      // 2  8
      // Z 0 1 0
      // 4 cycles
      andARegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xe7: {
      // RST 20H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x20;
      return 8;
    }
    case 0xe8: {
      // ADD SP, r8
      // 2 16
      // 0 0 H C
      // NOTE: Discoved dataByte is signed
      // 4 cycles
      let signedDataByteOne = i8Portable(<i8>getDataByteOne());

      checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, signedDataByteOne, true);
      Cpu.stackPointer = u16Portable(Cpu.stackPointer + signedDataByteOne);
      setZeroFlag(0);
      setSubtractFlag(0);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 12;
    }
    case 0xe9: {
      // JP HL
      // 1 4
      Cpu.programCounter = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      return 4;
    }
    case 0xea: {
      // LD (a16),A
      // 3 16
      // 12 cycles, 4 from store, 8 from concatenated data byte
      eightBitStoreSyncCycles(getConcatenatedDataByte(), Cpu.registerA);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
      return 4;
    }
    /* No Opcode for: 0xEB, 0xEC, 0xED */
    case 0xee: {
      // XOR d8
      // 2 8
      // Z 0 0 0
      // 4 cycles
      xorARegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xef: {
      // RST 28H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x28;
      return 8;
    }
  }
  return -1;
}

function handleOpcodeFx(opcode: i32): i32 {
  switch (opcode) {
    case 0xf0: {
      // LDH A,(a8)
      // 2 12
      // 4 cycles
      let largeDataByteOne: i32 = getDataByteOne();
      // 4 cycles
      Cpu.registerA = u8Portable(<u8>eightBitLoadSyncCycles(0xff00 + largeDataByteOne));
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xf1: {
      // POP AF
      // 1 12
      // Z N H C (But No work require, flags are already set)
      // 8 cycles
      let stackPointer = Cpu.stackPointer;
      let registerAF1: i32 = <u16>sixteenBitLoadSyncCycles(stackPointer);
      Cpu.stackPointer = u16Portable(stackPointer + 2);
      Cpu.registerA = <u8>splitHighByte(registerAF1);
      Cpu.registerF = <u8>splitLowByte(registerAF1);
      return 4;
    }
    case 0xf2: {
      // LD A,(C)
      // 1 8
      // 4 cycles
      Cpu.registerA = u8Portable(<u8>eightBitLoadSyncCycles(0xff00 + <i32>Cpu.registerC));
      return 4;
    }
    case 0xf3: {
      // DI
      // 1 4
      setInterrupts(false);
      return 4;
    }
    /* No Opcode for: 0xF4 */
    case 0xf5: {
      // PUSH AF
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerA, Cpu.registerF));
      return 8;
    }
    case 0xf6: {
      // OR d8
      // 2 8
      // Z 0 0 0
      // 4 cycles
      orARegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xf7: {
      // RST 30H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x30;
      return 8;
    }
    case 0xf8: {
      // LD HL,SP+r8
      // 2 12
      // 0 0 H C
      // NOTE: Discoved dataByte is signed
      // 4 cycles
      let signedDataByteOne = i8Portable(<i8>getDataByteOne());
      let stackPointer = Cpu.stackPointer;

      // First, let's handle flags
      setZeroFlag(0);
      setSubtractFlag(0);
      checkAndSetSixteenBitFlagsAddOverflow(stackPointer, signedDataByteOne, true);
      let registerHL = u16Portable(stackPointer + signedDataByteOne);
      Cpu.registerH = <u8>splitHighByte(registerHL);
      Cpu.registerL = <u8>splitLowByte(registerHL);
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 8;
    }
    case 0xf9: {
      // LD SP,HL
      // 1 8
      Cpu.stackPointer = <u16>concatenateBytes(Cpu.registerH, Cpu.registerL);
      return 8;
    }
    case 0xfa: {
      // LD A,(a16)
      // 3 16
      // 12 cycles, 4 from load, 8 from concatenated data byte
      Cpu.registerA = <u8>eightBitLoadSyncCycles(getConcatenatedDataByte());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
      return 4;
    }
    case 0xfb: {
      // EI
      // 1 4
      setInterrupts(true);
      return 4;
    }
    /* No Opcode for: 0xFC, 0xFD */
    case 0xfe: {
      // CP d8
      // 2 8
      // Z 1 H C
      // 4 cycles
      cpARegister(getDataByteOne());
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      return 4;
    }
    case 0xff: {
      // RST 38H
      // 1 16
      let stackPointer = u16Portable(Cpu.stackPointer - 2);
      Cpu.stackPointer = stackPointer;
      // 8 cycles
      sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x38;
      return 8;
    }
  }
  return -1;
}
