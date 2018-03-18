// Imports
import {
  Cpu,
  relativeJump
} from './index';
import {
  handleCbOpcode
} from './cbOpcodes';
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
  addARegister,
  addAThroughCarryRegister,
  subARegister,
  subAThroughCarryRegister,
  andARegister,
  xorARegister,
  orARegister,
  cpARegister
} from './instructions';
import {
  log,
  hexLog,
  performanceTimestamp,
  rotateByteLeft,
  rotateByteLeftThroughCarry,
  rotateByteRight,
  rotateByteRightThroughCarry,
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
  checkInterrupts,
  areInterruptsEnabled,
  areInterruptsPending
} from '../interrupts/index';
import {
  Graphics,
  updateGraphics,
  batchProcessGraphics
} from '../graphics/index';
import {
  Sound,
  updateSound
} from '../sound/index'

// Public funciton to run opcodes until an event occurs.
// Return values:
// -1 = error
// 1 = render a frame
// 2 = replace boot rom
export function update(): i32 {

  let error: boolean = false;
  let numberOfCycles: i8 = -1;
  while(!error &&
      Cpu.currentCycles < Cpu.MAX_CYCLES_PER_FRAME) {
    numberOfCycles = emulationStep();
    if (numberOfCycles >= 0) {
      Cpu.currentCycles += numberOfCycles;
      Sound.currentCycles += numberOfCycles;
      Graphics.currentCycles += numberOfCycles;
      
      // Need to do this, since a lot of things depend on the scanline
      // Batch processing will simply return if the number of cycles is too low
      batchProcessGraphics();
    } else {
      error = true;
    }
  }

  // Find our exit reason
  if (Cpu.currentCycles >= Cpu.MAX_CYCLES_PER_FRAME) {
    // Render a frame
    // Reset our currentCycles
    Cpu.currentCycles = 0;

    return 1;
  }
  // TODO: Boot ROM handling

  // There was an error, return -1, and push the program counter back to grab the error opcode
  Cpu.programCounter -= 1;
  return -1;
}

// Function to execute an opcode, and update other gameboy hardware.
// http://www.codeslinger.co.uk/pages/projects/gameboy/beginning.html
export function emulationStep(): i8 {
  // Get the opcode, and additional bytes to be handled
  // Number of cycles defaults to 4, because while we're halted, we run 4 cycles (according to matt :))
  let numberOfCycles: i8 = 4;
  let opcode: u8 = 0;

  // Cpu Halting best explained: https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/db7xnbe/
  if(!Cpu.isHalted && !Cpu.isStopped) {
    opcode = eightBitLoadFromGBMemory(Cpu.programCounter);
    let dataByteOne: u8 = eightBitLoadFromGBMemory(Cpu.programCounter + 1);
    let dataByteTwo: u8 = eightBitLoadFromGBMemory(Cpu.programCounter + 2);
    numberOfCycles = executeOpcode(opcode, dataByteOne, dataByteTwo);
    //Cpu.previousOpcode = opcode;
  } else {
    // if we were halted, and interrupts were disabled but interrupts are pending, stop waiting
    if(Cpu.isHalted && !areInterruptsEnabled() && areInterruptsPending()) {
      Cpu.isHalted = false;
      Cpu.isStopped = false;

      // Need to run the next opcode twice, it's a bug menitoned in
      // The reddit comment mentioned above, HOWEVER, TODO: This does not happen in GBC mode, see cpu manual
      // CTRL+F "low-power" on gameboy cpu manual
      // http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf
      // E.g
      // 0x76 - halt
      // FA 34 12 - ld a,(1234)
      // Becomes
      // FA FA 34 ld a,(34FA)
      // 12 ld (de),a
      opcode = eightBitLoadFromGBMemory(Cpu.programCounter);
      let dataByteOne: u8 = eightBitLoadFromGBMemory(Cpu.programCounter);
      let dataByteTwo: u8 = eightBitLoadFromGBMemory(Cpu.programCounter + 1);
      numberOfCycles = executeOpcode(opcode, dataByteOne, dataByteTwo);
      Cpu.programCounter -= 1;
    }
  }


  // blarggFixes, don't allow register F to have the bottom nibble
  Cpu.registerF = Cpu.registerF & 0xF0;

  // Check other Gameboy components
  updateTimers(<u8>numberOfCycles);

  if(!Cpu.isStopped) {
    // Now Batch Processing Graphics based on memory read/writes
    // updateGraphics(<u8>numberOfCycles);

    // Update Sound
    // Now Batch Processing Audio based on memory read/writes
    // updateSound(<u8>numberOfCycles);
  }

  // Interrupt Handling requires 20 cycles
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
  numberOfCycles += checkInterrupts();

  if(numberOfCycles <= 0) {
    log("Opcode at crash: $0", 1, opcode);
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

  // Always implement the program counter by one
  // Any other value can just subtract or add however much offset before reaching this line
  Cpu.programCounter += 1;

  // Get our concatenated databyte one and dataByteTwo
  // Doing this here, because for some odd reason, these are swapped ONLY
  // When concatenated :p
  // Find and replace with : concatenatedDataByte
  let concatenatedDataByte: u16 = concatenateBytes(dataByteTwo, dataByteOne);

  // Split our opcode into a high nibble to speed up performance
  // Running 255 if statements is slow, even in wasm haha!
  let opcodeHighNibble = (opcode & 0xF0);
  opcodeHighNibble = opcodeHighNibble >> 4;

  // Not using a switch statement to avoid cannot redeclare this variable errors
  // And it would be a ton of work :p

  switch(opcodeHighNibble) {
    case 0x00:
      return handleOpcode0x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x01:
      return handleOpcode1x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x02:
      return handleOpcode2x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x03:
      return handleOpcode3x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x04:
      return handleOpcode4x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x05:
      return handleOpcode5x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x06:
      return handleOpcode6x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x07:
      return handleOpcode7x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x08:
      return handleOpcode8x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x09:
      return handleOpcode9x(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x0A:
      return handleOpcodeAx(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x0B:
      return handleOpcodeBx(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x0C:
      return handleOpcodeCx(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x0D:
      return handleOpcodeDx(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    case 0x0E:
      return handleOpcodeEx(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
    default:
      return handleOpcodeFx(opcode, dataByteOne, dataByteTwo, concatenatedDataByte);
  }
}

function handleOpcode0x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch(opcode) {
    case 0x00:
      // NOP
      // 1  4
      // No Operation
      return 4;
    case 0x01:
      // LD BC,d16
      // 3  12

      Cpu.registerB = splitHighByte(concatenatedDataByte);
      Cpu.registerC = splitLowByte(concatenatedDataByte);
      Cpu.programCounter += 2;
      return 12;
    case 0x02:
      // LD (BC),A
      // 1  8
      // () means load into address pointed by BC
      let registerBC2: u16 = concatenateBytes(Cpu.registerB, Cpu.registerC)
      eightBitStoreIntoGBMemory(registerBC2, Cpu.registerA);
      return 8;
    case 0x03:
      // INC BC
      // 1  8
      let registerBC3: u16 = concatenateBytes(Cpu.registerB, Cpu.registerC);
      registerBC3++;
      Cpu.registerB = splitHighByte((<u16>registerBC3));
      Cpu.registerC = splitLowByte((<u16>registerBC3));
      return 8;
    case 0x04:
      // INC B
      // 1  4
      // Z 0 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerB, 1);
      Cpu.registerB += 1;
      if (Cpu.registerB === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      return 4;
    case 0x05:
      // DEC B
      // 1  4
      // Z 1 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerB, -1);
      Cpu.registerB -= 1;
      if (Cpu.registerB === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      return 4;
    case 0x06:
      // LD B,d8
      // 2  8
      Cpu.registerB = dataByteOne;
      Cpu.programCounter += 1;
      return 8;
    case 0x07:
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
      return 4;
    case 0x08:
      // LD (a16),SP
      // 3  20
      // Load the stack pointer into the 16 bit address represented by the two data bytes
      sixteenBitStoreIntoGBMemory(concatenatedDataByte, Cpu.stackPointer);
      Cpu.programCounter += 2;
      return 20;
    case 0x09:
      // ADD HL,BC
      // 1 8
      // - 0 H C
      let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      let registerBC9: u16 = concatenateBytes(Cpu.registerB, Cpu.registerC);
      checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerBC9, false);
      let result: u16 = <u16>(registerHL + registerBC9);
      Cpu.registerH = splitHighByte(<u16>result);
      Cpu.registerL = splitLowByte(<u16>result);
      setSubtractFlag(0);
      return 8;
    case 0x0A:
      // LD A,(BC)
      // 1 8
      let registerBCA: u16 = concatenateBytes(Cpu.registerB, Cpu.registerC)
      Cpu.registerA = eightBitLoadFromGBMemory(registerBCA);
      return 8;
    case 0x0B:
      // DEC BC
      // 1  8
      let registerBCB: u16 = concatenateBytes(Cpu.registerB, Cpu.registerC);
      registerBCB -= 1;
      Cpu.registerB = splitHighByte(registerBCB);
      Cpu.registerC = splitLowByte(registerBCB);
      return 8;
    case 0x0C:
      // INC C
      // 1  4
      // Z 0 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerC, 1);
      Cpu.registerC += 1;
      if (Cpu.registerC === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      return 4;
    case 0x0D:
      // DEC C
      // 1  4
      // Z 1 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerC, -1);
      Cpu.registerC -= 1;
      if (Cpu.registerC === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      return 4;
    case 0x0E:
      // LD C,d8
      // 2 8
      Cpu.registerC = dataByteOne;
      Cpu.programCounter += 1;
      return 8;
    case 0x0F:
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
      return 4;
  }
  return -1;
}

function handleOpcode1x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {

  switch (opcode) {
    case 0x10:
      // STOP 0
      // 2 4
      // Enter CPU very low power mode. Also used to switch between double and normal speed CPU modes in GBC.
      // Meaning Don't Decode anymore opcodes , or updated the LCD until joypad interrupt (or when button is pressed if I am wrong)
      // See HALT
      // TODO: This breaks Blarggs CPU tests, find out what should end a STOP
      //Cpu.isStopped = true;
      Cpu.programCounter += 1;
      return 4;
    case 0x11:
      // LD DE,d16
      // 3  12
      Cpu.registerD = splitHighByte(concatenatedDataByte);
      Cpu.registerE = splitLowByte(concatenatedDataByte);
      Cpu.programCounter += 2;
      return 12;
    case 0x12:
      // LD (DE),A
      // 1 8
      let registerDE2: u16 = concatenateBytes(Cpu.registerD, Cpu.registerE);
      eightBitStoreIntoGBMemory(registerDE2, Cpu.registerA);
      return 8;
    case 0x13:
      // INC DE
      // 1 8
      let registerDE3 = concatenateBytes(Cpu.registerD, Cpu.registerE);
      registerDE3 += 1;
      Cpu.registerD = splitHighByte(registerDE3);
      Cpu.registerE = splitLowByte(registerDE3);
      return 8;
    case 0x14:
      // INC D
      // 1  4
      // Z 0 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerD, 1);
      Cpu.registerD += 1;
      if (Cpu.registerD === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      return 4;
    case 0x15:
      // DEC D
      // 1  4
      // Z 1 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerD, -1);
      Cpu.registerD -= 1;
      if (Cpu.registerD === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      return 4;
    case 0x16:
      // LD D,d8
      // 2 8
      Cpu.registerD = dataByteOne;
      Cpu.programCounter += 1;
      return 8;
    case 0x17:
      // RLA
      // 1 4
      // 0 0 0 C
      // Check for the carry
      // setting has first bit since we need to use carry
      let hasHighbit = false;
      if((Cpu.registerA & 0x80) === 0x80) {
        hasHighbit = true;
      }
      Cpu.registerA = rotateByteLeftThroughCarry(Cpu.registerA);
      // OR the carry flag to the end
      if(hasHighbit) {
        setCarryFlag(1);
      } else {
        setCarryFlag(0);
      }
      // Set all other flags to zero
      setZeroFlag(0);
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return 4;
    case 0x18:
      // JR r8
      // 2  12
      // NOTE: Discoved dataByte is signed
      // However the relative Jump Function handles this

      relativeJump(dataByteOne);
      return 12;
      // Relative Jump Function Handles program counter
    case 0x19:
      // ADD HL,DE
      // 1  8
      // - 0 H C
      let registerHL: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      let registerDE9: u16 = concatenateBytes(Cpu.registerD, Cpu.registerE);
      checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL, <u16>registerDE9, false);
      let result: u16 = <u16>(registerHL + registerDE9);
      Cpu.registerH = splitHighByte(<u16>result);
      Cpu.registerL = splitLowByte(<u16>result);
      setSubtractFlag(0);
      return 8;
    case 0x1A:
      // LD A,(DE)
      // 1 8
      let registerDEA: u16 = concatenateBytes(Cpu.registerD, Cpu.registerE);
      Cpu.registerA = eightBitLoadFromGBMemory(registerDEA);
      return 8;
    case 0x1B:
      // DEC DE
      // 1 8
      let registerDEB: u16 = concatenateBytes(Cpu.registerD, Cpu.registerE);
      registerDEB -= 1;
      Cpu.registerD = splitHighByte(registerDEB);
      Cpu.registerE = splitLowByte(registerDEB);
      return 8;
    case 0x1C:
      // INC E
      // 1  4
      // Z 0 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerE, 1);
      Cpu.registerE += 1;
      if (Cpu.registerE === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      return 4;
    case 0x1D:
      // DEC E
      // 1  4
      // Z 1 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerE, -1);
      Cpu.registerE -= 1;
      if (Cpu.registerE === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      return 4;
    case 0x1E:
      // LD E,d8
      // 2 8
      Cpu.registerE = dataByteOne;
      Cpu.programCounter += 1;
      return 8;
    case 0x1F:
      // RRA
      // 1 4
      // 0 0 0 C
      // Check for the carry
      // setting has low bit since we need to use carry
      let hasLowBit = false;
      if((Cpu.registerA & 0x01) === 0x01) {
        hasLowBit = true;
      }
      Cpu.registerA = rotateByteRightThroughCarry(Cpu.registerA);

      if(hasLowBit) {
        setCarryFlag(1);
      } else {
        setCarryFlag(0);
      }
      // Set all other flags to zero
      setZeroFlag(0);
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return 4;
  }

  return -1;
}

function handleOpcode2x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {

  switch(opcode) {
    case 0x20:

      // JR NZ,r8
      // 2  12/8
      // NOTE: NZ stands for not [flag], so in this case, not zero flag
      // Also, / means, if condition. so if met, 12 cycles, otherwise 8 cycles
      if (getZeroFlag() === 0) {
        relativeJump(dataByteOne);
        return 12;
        // Relative Jump Funciton handles program counter
      } else {
        Cpu.programCounter += 1;
        return 8;
      }
    case 0x21:

      // LD HL,d16
      // 3  12
      let sixeteenBitDataByte = concatenatedDataByte;
      Cpu.registerH = splitHighByte(sixeteenBitDataByte);
      Cpu.registerL = splitLowByte(sixeteenBitDataByte);
      Cpu.programCounter += 2;
      return 12;
    case 0x22:

      // LD (HL+),A
      // 1 8
      let registerHL2: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      eightBitStoreIntoGBMemory(registerHL2, Cpu.registerA);
      registerHL2 += 1;
      Cpu.registerH = splitHighByte(registerHL2);
      Cpu.registerL = splitLowByte(registerHL2);
      return 8;
    case 0x23:

      // INC HL
      // 1  8
      let registerHL3 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      registerHL3 += 1;
      Cpu.registerH = splitHighByte(registerHL3);
      Cpu.registerL = splitLowByte(registerHL3);
      return 8;
    case 0x24:

      // INC H
      // 1  4
      // Z 0 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerH, 1);
      Cpu.registerH += 1;
      if (Cpu.registerH === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      return 4;
    case 0x25:

      // DEC H
      // 1  4
      // Z 1 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerH, -1);
      Cpu.registerH -= 1;
      if (Cpu.registerH === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      return 4;
    case 0x26:

      // LD H,d8
      // 2 8
      Cpu.registerH = dataByteOne;
      Cpu.programCounter += 1;
      return 8;
    case 0x27:

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
        if ((Cpu.registerA & 0x0F) > 0x09) {
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
      if((adjustment & 0x60) !== 0) {
        setCarryFlag(1);
      } else {
        setCarryFlag(0);
      }
      setHalfCarryFlag(0);

      Cpu.registerA = <u8>adjustedRegister;
      return 4;
    case 0x28:

      // JR Z,r8
      // 2  12/8
      if(getZeroFlag() > 0) {
        relativeJump(dataByteOne);
        return 12;
        // Relative Jump funciton handles pogram counter
      } else {
        Cpu.programCounter += 1;
        return 8;
      }
    case 0x29:

      // ADD HL,HL
      // 1  8
      // - 0 H C
      let registerHL9: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      checkAndSetSixteenBitFlagsAddOverflow(registerHL9, registerHL9, false);
      registerHL9 = registerHL9 * 2;
      Cpu.registerH = splitHighByte(registerHL9);
      Cpu.registerL = splitLowByte(registerHL9);
      setSubtractFlag(0);
      return 8;
    case 0x2A:

      // LD A,(HL+)
      // 1  8
      let registerHLA: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      Cpu.registerA = eightBitLoadFromGBMemory(registerHLA);
      registerHLA += 1;
      Cpu.registerH = splitHighByte(registerHLA);
      Cpu.registerL = splitLowByte(registerHLA);
      return 8;
    case 0x2B:

      // DEC HL
      // 1 8
      let registerHLB = concatenateBytes(Cpu.registerH, Cpu.registerL);
      registerHLB -= 1;
      Cpu.registerH = splitHighByte(registerHLB);
      Cpu.registerL = splitLowByte(registerHLB);
      return 8;
    case 0x2C:

      // INC L
      // 1  4
      // Z 0 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerL, 1);
      Cpu.registerL += 1;
      if (Cpu.registerL === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      return 4;
    case 0x2D:

      // DEC L
      // 1  4
      // Z 1 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerL, -1);
      Cpu.registerL -= 1;
      if (Cpu.registerL === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      return 4;
    case 0x2E:
      // LD L,d8
      // 2  8
      Cpu.registerL = dataByteOne;
      Cpu.programCounter += 1;
      return 8;
    case 0x2F:

      // CPL
      // 1 4
      // - 1 1 -
      Cpu.registerA = ~Cpu.registerA;
      setSubtractFlag(1);
      setHalfCarryFlag(1);
      return 4;
  }
  return -1;
}

function handleOpcode3x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0x30:

      // JR NC,r8
      // 2 12 / 8
      if (getCarryFlag() === 0) {
        relativeJump(dataByteOne);
        return 12;
        // Relative Jump function handles program counter
      } else {
        Cpu.programCounter += 1;
        return 8;
      }
    case 0x31:
      // LD SP,d16
      // 3 12
      Cpu.stackPointer = concatenatedDataByte;
      Cpu.programCounter += 2;
      return 12;
    case 0x32:
      // LD (HL-),A
      // 1 8
      let registerHL2: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      eightBitStoreIntoGBMemory(registerHL2, Cpu.registerA);
      registerHL2 -= 1;
      Cpu.registerH = splitHighByte(registerHL2);
      Cpu.registerL = splitLowByte(registerHL2);
      return 8;
    case 0x33:
      // INC SP
      // 1 8
      Cpu.stackPointer += 1;
      return 8;
    case 0x34:

      // INC (HL)
      // 1  12
      // Z 0 H -
      let registerHL4: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      let valueAtHL4: u8 = <u8>eightBitLoadFromGBMemory(registerHL4);
      // Creating a varible for this to fix assemblyscript overflow bug
      // Requires explicit casting
      // https://github.com/AssemblyScript/assemblyscript/issues/26
      let incrementer: u8 = 1;
      checkAndSetEightBitHalfCarryFlag(<u8>valueAtHL4, <i16>incrementer);
      valueAtHL4 = <u8>valueAtHL4 + <u8>incrementer;

      if (valueAtHL4 === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      eightBitStoreIntoGBMemory(registerHL4, <u8>valueAtHL4);
      return 12;
    case 0x35:

      // DEC (HL)
      // 1  12
      // Z 1 H -
      let registerHL5: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      let valueAtHL5: u8 = eightBitLoadFromGBMemory(registerHL5);
      // NOTE: This opcode may not overflow correctly,
      // Please see previous opcode
      checkAndSetEightBitHalfCarryFlag(<u8>valueAtHL5, -1);
      valueAtHL5 -= <u8>1;
      if (valueAtHL5 === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      eightBitStoreIntoGBMemory(registerHL5, <u8>valueAtHL5);
      return 12;
    case 0x36:
      // LD (HL),d8
      // 2  12
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), dataByteOne);
      Cpu.programCounter += 1;
      return 12;
    case 0x37:
      // SCF
      // 1  4
      // - 0 0 1
      // Simply set the carry flag
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      setCarryFlag(1);
      return 4;
    case 0x38:

      // JR C,r8
      // 2 12/8
      if (getCarryFlag() === 1) {
        relativeJump(dataByteOne);
        return 12;
        // Relative Jump Funciton handles program counter
      } else {
      Cpu.programCounter += 1;
        return 8;
      }
    case 0x39:

      // ADD HL,SP
      // 1 8
      // - 0 H C
      let registerHL9: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      checkAndSetSixteenBitFlagsAddOverflow(<u16>registerHL9, Cpu.stackPointer, false);
      let result: u16 = <u16>(registerHL9 + Cpu.stackPointer);
      Cpu.registerH = splitHighByte(<u16>result);
      Cpu.registerL = splitLowByte(<u16>result);
      setSubtractFlag(0);
      return 8;
    case 0x3A:

      // LD A,(HL-)
      // 1 8
      let registerHLA: u16 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      Cpu.registerA = eightBitLoadFromGBMemory(registerHLA);
      registerHLA -= 1;
      Cpu.registerH = splitHighByte(registerHLA);
      Cpu.registerL = splitLowByte(registerHLA);
      return 8;
    case 0x3B:
      // DEC SP
      // 1 8
      Cpu.stackPointer -= 1;
      return 8;
    case 0x3C:

      // INC A
      // 1  4
      // Z 0 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerA, 1);
      Cpu.registerA += 1;
      if (Cpu.registerA === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(0);
      return 4;
    case 0x3D:

      // DEC A
      // 1  4
      // Z 1 H -
      checkAndSetEightBitHalfCarryFlag(Cpu.registerA, -1);
      Cpu.registerA -= 1;
      if (Cpu.registerA === 0) {
        setZeroFlag(1);
      } else {
        setZeroFlag(0);
      }
      setSubtractFlag(1);
      return 4;
    case 0x3E:

      // LD A,d8
      // 2 8
      Cpu.registerA = dataByteOne;
      Cpu.programCounter += 1;
      return 8;
    case 0x3F:

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
      return 4;
  }
  return -1;
}

function handleOpcode4x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
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
      Cpu.registerB = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 8;
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
    case 0x4A:

      // LD C,D
      // 1 4
      Cpu.registerC = Cpu.registerD;
      return 4;
    case 0x4B:

      // LD C,E
      // 1 4
      Cpu.registerC = Cpu.registerE;
      return 4;
    case 0x4C:

      // LD C,H
      // 1 4
      Cpu.registerC = Cpu.registerH;
      return 4;
    case 0x4D:

      // LD C,L
      // 1 4
      Cpu.registerC = Cpu.registerL;
      return 4;
    case 0x4E:

      // LD C,(HL)
      // 1 8
      Cpu.registerC = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 8;
    case 0x4F:

      // LD C,A
      // 1 4
      Cpu.registerC = Cpu.registerA;
      return 4;
  }
  return -1;
}

function handleOpcode5x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
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
      Cpu.registerD = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 8;
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
    case 0x5A:

      // LD E,D
      // 1 4
      Cpu.registerE = Cpu.registerD;
      return 4;
    case 0x5B:

      // LD E,E
      // 1 4
      // Do Nothing
      return 4;
    case 0x5C:

      // LD E,H
      // 1 4
      Cpu.registerE = Cpu.registerH;
      return 4;
    case 0x5D:

      // LD E,L
      // 1 4
      Cpu.registerE = Cpu.registerL;
      return 4;
    case 0x5E:

      // LD E,(HL)
      // 1 4
      Cpu.registerE = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x5F:

      // LD E,A
      // 1 4
      Cpu.registerE = Cpu.registerA;
      return 4;
  }
  return -1;
}

function handleOpcode6x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
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
      Cpu.registerH = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 8;
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
    case 0x6A:

      // LD L,D
      // 1 4
      Cpu.registerL = Cpu.registerD;
      return 4;
    case 0x6B:

      // LD L,E
      // 1 4
      Cpu.registerL = Cpu.registerE;
      return 4;
    case 0x6C:

      // LD L,H
      // 1 4
      Cpu.registerL = Cpu.registerH;
      return 4;
    case 0x6D:

      // LD L,L
      // 1 4
      Cpu.registerL = Cpu.registerL;
      return 4;
    case 0x6E:

      // LD L,(HL)
      // 1 8
      Cpu.registerL = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 8;
    case 0x6F:

      // LD L,A
      // 1 4
      Cpu.registerL = Cpu.registerA;
      return 4;
  }
  return -1;
}

function handleOpcode7x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0x70:

      // LD (HL),B
      // 1 8
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerB);
      return 8;
    case 0x71:

      // LD (HL),C
      // 1 8
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerC);
      return 8;
    case 0x72:

      // LD (HL),D
      // 1 8
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerD);
      return 8;
    case 0x73:

      // LD (HL),E
      // 1 8
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerE);
      return 8;
    case 0x74:

      // LD (HL),H
      // 1 8
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerH);
      return 8;
    case 0x75:

      // LD (HL),L
      // 1 8
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerL);
      return 8;
    case 0x76:

      // HALT
      // 1 4
      // Enter CPU very low power mode
      // Meaning Don't Decode anymore opcodes until an interrupt occurs
      // Still need to do timers and things
      Cpu.isHalted = true;
      return 4;
    case 0x77:

      // LD (HL),A
      // 1 8
      eightBitStoreIntoGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerA);
      return 8;
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
    case 0x7A:

      // LD A,D
      // 1 4
      Cpu.registerA = Cpu.registerD;
      return 4;
    case 0x7B:

      // LD A,E
      // 1 4
      Cpu.registerA = Cpu.registerE;
      return 4;
    case 0x7C:

      // LD A,H
      // 1 4
      Cpu.registerA = Cpu.registerH;
      return 4;
    case 0x7D:

      // LD A,L
      // 1 4
      Cpu.registerA = Cpu.registerL;
      return 4;
    case 0x7E:

      // LD A,(HL)
      // 1 4
      Cpu.registerA = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      return 4;
    case 0x7F:

      // LD A,A
      // 1 4
      // Do Nothing
      return 4;
  }
  return -1;
}

function handleOpcode8x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
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
      let valueAtHL6: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      addARegister(<u8>valueAtHL6);
      return 8;
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
    case 0x8A:
      // ADC A,D
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerD);
      return 4;
    case 0x8B:
      // ADC A,E
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerE);
      return 4;
    case 0x8C:
      // ADC A,H
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerH);
      return 4;
    case 0x8D:
      // ADC A,L
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerL);
      return 4;
    case 0x8E:
      // ADC A,(HL)
      // 1 8
      // Z 0 H C
      let valueAtHLE: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      addAThroughCarryRegister(<u8>valueAtHLE);
      return 8;
    case 0x8F:
      // ADC A,A
      // 1 4
      // Z 0 H C
      addAThroughCarryRegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcode9x(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
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
      let valueAtHL6: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      subARegister(<u8>valueAtHL6);
      return 8;
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
    case 0x9A:

      // SBC A,D
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerD);
      return 4;
    case 0x9B:

      // SBC A,E
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerE);
      return 4;
    case 0x9C:

      // SBC A,H
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerH);
      return 4;
    case 0x9D:

      // SBC A,L
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerL);
      return 4;
    case 0x9E:

      // SBC A,(HL)
      // 1  8
      // Z 1 H C
      let valueAtHLE: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      subAThroughCarryRegister(<u8>valueAtHLE);
      return 8;
    case 0x9F:

      // SBC A,A
      // 1  4
      // Z 1 H C
      subAThroughCarryRegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcodeAx(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0xA0:

      // AND B
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerB);
      return 4;
    case 0xA1:

      // AND C
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerC);
      return 4;
    case 0xA2:

      // AND D
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerD);
      return 4;
    case 0xA3:

      // AND E
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerE);
      return 4;
    case 0xA4:

      // AND H
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerH);
      return 4;
    case 0xA5:

      // AND L
      // 1  4
      // Z 0 1 0
      andARegister(Cpu.registerL);
      return 4;
    case 0xA6:

      // AND (HL)
      // 1  8
      // Z 0 1 0
      let valueAtHL6: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      andARegister(<u8>valueAtHL6);
      return 8;
    case 0xA7:

      // AND A
      // 1  4
      // Z 0 1 0
      // NOTE: & Yourself, does nothing
      andARegister(Cpu.registerA);
      return 4;
    case 0xA8:

      // XOR B
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerB);
      return 4;
    case 0xA9:

      // XOR C
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerC);
      return 4;
    case 0xAA:

      // XOR D
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerD);
      return 4;
    case 0xAB:

      // XOR E
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerE);
      return 4;
    case 0xAC:

      // XOR H
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerH);
      return 4;
    case 0xAD:

      // XOR L
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerL);
      return 4;
    case 0xAE:

      // XOR (HL)
      // 1  8
      // Z 0 0 0
      let valueAtHLE: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      xorARegister(<u8>valueAtHLE);
      return 8;
    case 0xAF:

      // XOR A
      // 1  4
      // Z 0 0 0
      xorARegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcodeBx(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0xB0:

      // OR B
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerB);
      return 4;
    case 0xB1:

      // OR C
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerC);
      return 4;
    case 0xB2:

      // OR D
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerD);
      return 4;
    case 0xB3:

      // OR E
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerE);
      return 4;
    case 0xB4:

      // OR H
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerH);
      return 4;
    case 0xB5:

      // OR L
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerL);
      return 4;
    case 0xB6:

      // OR (HL)
      // 1  8
      // Z 0 0 0
      let valueAtHL6: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      orARegister(<u8>valueAtHL6);
      return 8;
    case 0xB7:

      // OR A
      // 1  4
      // Z 0 0 0
      orARegister(Cpu.registerA);
      return 4;
    case 0xB8:

      // CP B
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerB);
      return 4;
    case 0xB9:

      // CP C
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerC);
      return 4;
    case 0xBA:

      // CP D
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerD);
      return 4;
    case 0xBB:

      // CP E
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerE);
      return 4;
    case 0xBC:

      // CP H
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerH);
      return 4;
    case 0xBD:

      // CP L
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerL);
      return 4;
    case 0xBE:

      // CP (HL)
      // 1  8
      // Z 1 H C
      let valueAtHLE: u8 = eightBitLoadFromGBMemory(concatenateBytes(Cpu.registerH, Cpu.registerL));
      cpARegister(<u8>valueAtHLE);
      return 8;
    case 0xBF:

      // CP A
      // 1  4
      // Z 1 H C
      cpARegister(Cpu.registerA);
      return 4;
  }
  return -1;
}

function handleOpcodeCx(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0xC0:

      // RET NZ
      // 1  20/8
      if (getZeroFlag() === 0) {
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
        Cpu.stackPointer += 2;
        return 20;
      } else {
        return 8;
      }
    case 0xC1:

      // POP BC
      // 1  12
      let registerBC1 = concatenateBytes(Cpu.registerB, Cpu.registerC);
      registerBC1 = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      Cpu.registerB = splitHighByte(registerBC1);
      Cpu.registerC = splitLowByte(registerBC1);
      return 12;
    case 0xC2:

      // JP NZ,a16
      // 3  16/12
      if (getZeroFlag() === 0) {
        Cpu.programCounter = concatenatedDataByte;
        return 16;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    case 0xC3:

      // JP a16
      // 3  16
      Cpu.programCounter = concatenatedDataByte;
      return 16;
    case 0xC4:

      // CALL NZ,a16
      // 3  24/12
      if (getZeroFlag() === 0) {
        Cpu.stackPointer -= 2;
        sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 2);
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter);
        return 24;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    case 0xC5:

      // PUSH BC
      // 1  16
      let registerBC5 = concatenateBytes(Cpu.registerB, Cpu.registerC);
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerBC5);
      return 16;
    case 0xC6:

      // ADD A,d8
      // 2 8
      // Z 0 H C
      addARegister(dataByteOne);
      Cpu.programCounter += 1;
      return 4;
    case 0xC7:

      // RST 00H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x00;
      return 16;
    case 0xC8:

      // RET Z
      // 1  20/8
      if (getZeroFlag() === 1) {
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
        Cpu.stackPointer += 2;
        return 20;
      } else {
        return 8;
      }
    case 0xC9:

      // RET
      // 1 16
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      return 16;
    case 0xCA:

      // JP Z,a16
      // 3 16/12
      if (getZeroFlag() === 1) {
        Cpu.programCounter = concatenatedDataByte;
        return 16;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    case 0xCB:
      // PREFIX CB
      // 1  4
      let cbCycles = handleCbOpcode(dataByteOne)
      if(cbCycles > 0) {
        cbCycles += 4;
      }
      return cbCycles;
    case 0xCC:

      // CALL Z,a16
      // 3  24/12
      if (getZeroFlag() === 1) {
        Cpu.stackPointer -= 2;
        sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 2);
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter);
        return 24;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    case 0xCD:

      // CALL a16
      // 3  24
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 2);
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter);
      return 24;
    case 0xCE:

      // ADC A,d8
      // 2  8
      // Z 0 H C
      addAThroughCarryRegister(dataByteOne);
      Cpu.programCounter += 1;
      return 4;
    case 0xCF:

      // RST 08H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x08;
      return 16;
  }
  return -1;
}

function handleOpcodeDx(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0xD0:

      // RET NC
      // 1  20/8
      if (getCarryFlag() === 0) {
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
        Cpu.stackPointer += 2;
        return 20;
      } else {
        return 8;
      }
    case 0xD1:

      // POP DE
      // 1  12
      let registerDE1 = concatenateBytes(Cpu.registerD, Cpu.registerE);
      registerDE1 = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      Cpu.registerD = splitHighByte(registerDE1);
      Cpu.registerE = splitLowByte(registerDE1);
      return 12;
    case 0xD2:

      // JP NC,a16
      // 3  16/12
      if (getCarryFlag() === 0) {
        Cpu.programCounter = concatenatedDataByte;
        return 16;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    /* No Opcode for: 0xD3 */
    case 0xD4:

      // CALL NC,a16
      // 3  24/12
      if (getCarryFlag() === 0) {
        Cpu.stackPointer -= 2;
        sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 2);
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter);
        return 24;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    case 0xD5:

      // PUSH DE
      // 1 16
      let registerDE5 = concatenateBytes(Cpu.registerD, Cpu.registerE);
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerDE5);
      return 16;
    case 0xD6:

      // SUB d8
      // 2  8
      // Z 1 H C
      subARegister(dataByteOne);
      Cpu.programCounter += 1;
      return 8;
    case 0xD7:

      // RST 10H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x10;
      return 16;
    case 0xD8:

      // RET C
      // 1  20/8
      if (getCarryFlag() === 1) {
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
        Cpu.stackPointer += 2;
        return 20;
      } else {
        return 8;
      }
    case 0xD9:

      // RETI
      // 1  16
      Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      // Enable interrupts
      setInterrupts(true);
      Cpu.stackPointer += 2;
      return 16;
    case 0xDA:

      // JP C,a16
      // 3 16/12
      if (getCarryFlag() === 1) {
        Cpu.programCounter = concatenatedDataByte;
        return 16;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    /* No Opcode for: 0xDB */
    case 0xDC:

      // CALL C,a16
      // 3  24/12
      if (getCarryFlag() === 1) {
        Cpu.stackPointer -= 2;
        sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 2);
        Cpu.programCounter = sixteenBitLoadFromGBMemory(Cpu.programCounter);
        return 24;
      } else {
        Cpu.programCounter += 2;
        return 12;
      }
    /* No Opcode for: 0xDD */
    case 0xDE:

      // SBC A,d8
      // 2 8
      // Z 1 H C
      subAThroughCarryRegister(dataByteOne);
      Cpu.programCounter += 1;
      return 8;
    case 0xDF:
      // RST 18H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x18;
      return 16;
  }
  return -1;
}

function handleOpcodeEx(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0xE0:

      // LDH (a8),A
      // 2  12

      // Store value in high RAM ($FF00 + a8)
      let largeDataByteOne: u16 = dataByteOne;
      eightBitStoreIntoGBMemory(0xFF00 + largeDataByteOne, Cpu.registerA);
      Cpu.programCounter += 1;
      return 12;
    case 0xE1:

      // POP HL
      // 1  12
      let registerHL1 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      registerHL1 = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      Cpu.registerH = splitHighByte(registerHL1);
      Cpu.registerL = splitLowByte(registerHL1);
      return 12;
    case 0xE2:

      // LD (C),A
      // 2  8
      // NOTE: Table says 2 Program counter,
      // But stepping through the boot rom, should be one

      // Store value in high RAM ($FF00 + register c)
      eightBitStoreIntoGBMemory(0xFF00 + Cpu.registerC, Cpu.registerA);
      return 8;
    /* No Opcode for: 0xE3, 0xE4 */
    case 0xE5:

      // PUSH HL
      // 1 16
      let registerHL5 = concatenateBytes(Cpu.registerH, Cpu.registerL);
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerHL5);
      return 16;
    case 0xE6:

      // AND d8
      // 2  8
      // Z 0 1 0
      andARegister(dataByteOne);
      Cpu.programCounter += 1;
      return 8;
    case 0xE7:

      // RST 20H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x20;
      return 16;
    case 0xE8:

      // ADD SP, r8
      // 2 16
      // 0 0 H C
      // NOTE: Discoved dataByte is signed
      let signedDataByteOne: i8 = <i8>dataByteOne;

      checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, signedDataByteOne, true);
      Cpu.stackPointer += signedDataByteOne;
      setZeroFlag(0);
      setSubtractFlag(0);
      Cpu.programCounter += 1;
      return 16;
    case 0xE9:

      // JP (HL)
      // 1 4
      Cpu.programCounter = concatenateBytes(Cpu.registerH, Cpu.registerL);
      return 4;
    case 0xEA:

      // LD (a16),A
      // 3 16
      eightBitStoreIntoGBMemory(concatenatedDataByte, Cpu.registerA);
      Cpu.programCounter += 2;
      return 16;
    /* No Opcode for: 0xEB, 0xEC, 0xED */
    case 0xEE:

      // XOR d8
      // 2 8
      // Z 0 0 0
      xorARegister(dataByteOne);
      Cpu.programCounter += 1;
      return 8;
    case 0xEF:

      // RST 28H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x28;
      return 16;
  }
  return -1;
}

function handleOpcodeFx(opcode: u8, dataByteOne: u8, dataByteTwo: u8, concatenatedDataByte: u16): i8 {
  switch (opcode) {
    case 0xF0:

      // LDH A,(a8)
      // 2 12
      let largeDataByteOne: u16 = dataByteOne;
      Cpu.registerA = eightBitLoadFromGBMemory(0xFF00 + largeDataByteOne);
      Cpu.programCounter += 1;
      return 12;
    case 0xF1:

      // POP AF
      // 1 12
      // Z N H C (But No work require, flags are already set)
      let registerAF1 = concatenateBytes(Cpu.registerA, Cpu.registerF);
      registerAF1 = sixteenBitLoadFromGBMemory(Cpu.stackPointer);
      Cpu.stackPointer += 2;
      Cpu.registerA = splitHighByte(registerAF1);
      Cpu.registerF = splitLowByte(registerAF1);
      return 12;
    case 0xF2:

      // LD A,(C)
      // 2 8
      Cpu.registerA = eightBitLoadFromGBMemory(0xFF00 + Cpu.registerC);
      Cpu.programCounter += 1;
      return 8;
    case 0xF3:

      // DI
      // 1 4
      setInterrupts(false);
      return 4;
    /* No Opcode for: 0xF4 */
    case 0xF5:

      // PUSH AF
      // 1 16
      let registerAF5 = concatenateBytes(Cpu.registerA, Cpu.registerF);
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, registerAF5);
      return 16;
    case 0xF6:

      // OR d8
      // 2 8
      // Z 0 0 0
      orARegister(dataByteOne);
      Cpu.programCounter += 1;
      return 8;
    case 0xF7:

      // RST 30H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x30;
      return 16;
    case 0xF8:

      // LD HL,SP+r8
      // 2 12
      // 0 0 H C
      // NOTE: Discoved dataByte is signed
      let signedDataByteOne: i8 = <i8>dataByteOne;

      // First, let's handle flags
      setZeroFlag(0);
      setSubtractFlag(0);
      checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, signedDataByteOne, true);
      let registerHL = Cpu.stackPointer + signedDataByteOne;
      Cpu.registerH = splitHighByte(registerHL);
      Cpu.registerL = splitLowByte(registerHL);
      Cpu.programCounter += 1;
      return 12;
    case 0xF9:

      // LD SP,HL
      // 1 8
      Cpu.stackPointer = concatenateBytes(Cpu.registerH, Cpu.registerL);
      return 8;
    case 0xFA:

      // LD A,(a16)
      // 3 16
      Cpu.registerA = eightBitLoadFromGBMemory(concatenatedDataByte);
      Cpu.programCounter += 2;
      return 16;
    case 0xFB:

      // EI
      // 1 4
      setInterrupts(true);
      return 4;
    /* No Opcode for: 0xFC, 0xFD */
    case 0xFE:

      // CP d8
      // 2 8
      // Z 1 H C
      cpARegister(dataByteOne);
      Cpu.programCounter += 1;
      return 8;
    case 0xFF:

      // RST 38H
      // 1 16
      Cpu.stackPointer -= 2;
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      Cpu.programCounter = 0x38;
      return 16;
  }
  return -1;
}
