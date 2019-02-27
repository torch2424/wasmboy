import { getSaveStateMemoryOffset } from '../core';
import { loadBooleanDirectlyFromWasmMemory, storeBooleanDirectlyToWasmMemory } from '../memory/index';
import { Interrupts } from '../interrupts/index';

// Everything Static as class instances just aren't quite there yet
// https://github.com/AssemblyScript/assemblyscript/blob/master/tests/compiler/showcase.ts
export class Cpu {
  // Status to track if we are currently executing the boot rom
  static readonly memoryLocationBootROMSwitch: u16 = 0xff50;
  static BootROMEnabled: boolean = false;

  // Status to track if we are in Gameboy Color Mode, and GBC State
  static GBCEnabled: boolean = false;

  // Memory Location for the GBC Speed switch
  // And the current status
  static readonly memoryLocationSpeedSwitch: u16 = 0xff4d;
  static GBCDoubleSpeed: boolean = false;

  // 8-bit Cpu.registers
  static registerA: u8 = 0;
  static registerB: u8 = 0;
  static registerC: u8 = 0;
  static registerD: u8 = 0;
  static registerE: u8 = 0;
  static registerH: u8 = 0;
  static registerL: u8 = 0;
  static registerF: u8 = 0;

  // 16-bit Cpu.registers
  static stackPointer: u16 = 0;
  // Boot rom from 0x00 to 0x99, all games start at 0x100
  static programCounter: u16 = 0x00;

  // Current number of cycles, shouldn't execeed max number of cycles
  static currentCycles: i32 = 0;
  static CLOCK_SPEED(): i32 {
    // 2^23, thanks binji!
    // return Cpu.GBCDoubleSpeed ? 8388608 : 4194304;
    return 4194304 << (<i32>Cpu.GBCDoubleSpeed);
  }

  // Cycles Per Frame = Clock Speed / fps
  // So: 4194304 / 59.73
  static MAX_CYCLES_PER_FRAME(): i32 {
    // return Cpu.GBCDoubleSpeed ? 140448 : 70224;
    return 70224 << (<i32>Cpu.GBCDoubleSpeed);
  }

  // HALT and STOP instructions need to stop running opcodes, but simply check timers
  // https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Matt said is should work to, so it must work!
  // TCAGBD shows three different HALT states. Therefore, we need to handle each
  static isHaltNormal: boolean = false;
  static isHaltNoJump: boolean = false;
  static isHaltBug: boolean = false;
  static isStopped: boolean = false;

  // See section 4.10 of TCAGBD
  // Cpu Halting explained: https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/db7xnbe/
  static enableHalt(): void {
    if (Interrupts.masterInterruptSwitch) {
      Cpu.isHaltNormal = true;
      return;
    }

    let haltTypeValue = Interrupts.interruptsEnabledValue & Interrupts.interruptsRequestedValue & 0x1f;

    if (haltTypeValue === 0) {
      Cpu.isHaltNoJump = true;
      return;
    }

    Cpu.isHaltBug = true;
  }

  static exitHaltAndStop(): void {
    Cpu.isHaltNoJump = false;
    Cpu.isHaltNormal = false;
    Cpu.isHaltBug = false;
    Cpu.isStopped = false;
  }

  static isHalted(): boolean {
    return Cpu.isHaltNormal || Cpu.isHaltNoJump;
  }

  // Save States
  static readonly saveStateSlot: u16 = 0;

  // Function to save the state of the class
  static saveState(): void {
    // Registers
    store<u8>(getSaveStateMemoryOffset(0x00, Cpu.saveStateSlot), Cpu.registerA);
    store<u8>(getSaveStateMemoryOffset(0x01, Cpu.saveStateSlot), Cpu.registerB);
    store<u8>(getSaveStateMemoryOffset(0x02, Cpu.saveStateSlot), Cpu.registerC);
    store<u8>(getSaveStateMemoryOffset(0x03, Cpu.saveStateSlot), Cpu.registerD);
    store<u8>(getSaveStateMemoryOffset(0x04, Cpu.saveStateSlot), Cpu.registerE);
    store<u8>(getSaveStateMemoryOffset(0x05, Cpu.saveStateSlot), Cpu.registerH);
    store<u8>(getSaveStateMemoryOffset(0x06, Cpu.saveStateSlot), Cpu.registerL);
    store<u8>(getSaveStateMemoryOffset(0x07, Cpu.saveStateSlot), Cpu.registerF);

    store<u16>(getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot), Cpu.stackPointer);
    store<u16>(getSaveStateMemoryOffset(0x0a, Cpu.saveStateSlot), Cpu.programCounter);

    store<i32>(getSaveStateMemoryOffset(0x0c, Cpu.saveStateSlot), Cpu.currentCycles);

    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot), Cpu.isHaltNormal);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot), Cpu.isHaltNoJump);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x13, Cpu.saveStateSlot), Cpu.isHaltBug);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x14, Cpu.saveStateSlot), Cpu.isStopped);

    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x15, Cpu.saveStateSlot), Cpu.BootROMEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x16, Cpu.saveStateSlot), Cpu.GBCEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x17, Cpu.saveStateSlot), Cpu.GBCDoubleSpeed);
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Registers
    Cpu.registerA = load<u8>(getSaveStateMemoryOffset(0x00, Cpu.saveStateSlot));
    Cpu.registerB = load<u8>(getSaveStateMemoryOffset(0x01, Cpu.saveStateSlot));
    Cpu.registerC = load<u8>(getSaveStateMemoryOffset(0x02, Cpu.saveStateSlot));
    Cpu.registerD = load<u8>(getSaveStateMemoryOffset(0x03, Cpu.saveStateSlot));
    Cpu.registerE = load<u8>(getSaveStateMemoryOffset(0x04, Cpu.saveStateSlot));
    Cpu.registerH = load<u8>(getSaveStateMemoryOffset(0x05, Cpu.saveStateSlot));
    Cpu.registerL = load<u8>(getSaveStateMemoryOffset(0x06, Cpu.saveStateSlot));
    Cpu.registerF = load<u8>(getSaveStateMemoryOffset(0x07, Cpu.saveStateSlot));

    Cpu.stackPointer = load<u16>(getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot));
    Cpu.programCounter = load<u16>(getSaveStateMemoryOffset(0x0a, Cpu.saveStateSlot));

    Cpu.currentCycles = load<i32>(getSaveStateMemoryOffset(0x0c, Cpu.saveStateSlot));

    Cpu.isHaltNormal = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot));
    Cpu.isHaltNoJump = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot));
    Cpu.isHaltBug = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x13, Cpu.saveStateSlot));
    Cpu.isStopped = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x14, Cpu.saveStateSlot));

    Cpu.BootROMEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x15, Cpu.saveStateSlot));
    Cpu.GBCEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x16, Cpu.saveStateSlot));
    Cpu.GBCDoubleSpeed = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x17, Cpu.saveStateSlot));
  }
}

// Inlined because closure compiler does so
export function initializeCpu(): void {
  // Reset all stateful Cpu variables
  // Cpu.GBCEnabled is done by core/initialize
  Cpu.GBCDoubleSpeed = false;
  Cpu.registerA = 0;
  Cpu.registerB = 0;
  Cpu.registerC = 0;
  Cpu.registerD = 0;
  Cpu.registerE = 0;
  Cpu.registerH = 0;
  Cpu.registerL = 0;
  Cpu.registerF = 0;
  Cpu.stackPointer = 0;
  Cpu.programCounter = 0x00;
  Cpu.currentCycles = 0;
  Cpu.isHaltNormal = false;
  Cpu.isHaltNoJump = false;
  Cpu.isHaltBug = false;
  Cpu.isStopped = false;

  // Everything is done by Boot ROM is enabled.
  if (Cpu.BootROMEnabled) {
    return;
  }

  if (Cpu.GBCEnabled) {
    // CPU Registers
    Cpu.registerA = 0x11;
    Cpu.registerF = 0x80;
    Cpu.registerB = 0x00;
    Cpu.registerC = 0x00;
    Cpu.registerD = 0xff;
    Cpu.registerE = 0x56;
    Cpu.registerH = 0x00;
    Cpu.registerL = 0x0d;
  } else {
    // Cpu Registers
    Cpu.registerA = 0x01;
    Cpu.registerF = 0xb0;
    Cpu.registerB = 0x00;
    Cpu.registerC = 0x13;
    Cpu.registerD = 0x00;
    Cpu.registerE = 0xd8;
    Cpu.registerH = 0x01;
    Cpu.registerL = 0x4d;
  }

  // Cpu Control Flow
  Cpu.programCounter = 0x100;
  Cpu.stackPointer = 0xfffe;
}
