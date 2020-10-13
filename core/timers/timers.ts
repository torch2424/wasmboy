import { getSaveStateMemoryOffset } from '../core';
import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { requestTimerInterrupt } from '../interrupts/index';
import { checkBitOnByte } from '../helpers/index';

export class Timers {
  // Current cycles
  // This will be used for batch processing
  static currentCycles: i32 = 0;

  // Number of cycles to run in each batch process
  static batchProcessCycles(): i32 {
    return 256;
  }

  // Divider Register = DIV
  // Divider Register is 16 bits.
  // Divider Register when read is just the upper 8 bits
  // But internally is used as the full 16
  // Essentially dividerRegister is an always counting clock
  // DIV Drives everything, it is the heart of the timer.
  // All other timing registers base them selves relative to the DIV register
  // Think of the div register as like a cycle counter :)
  // DIV will increment TIMA, whenever there is a falling edge, see below for that.
  static readonly memoryLocationDividerRegister: i32 = 0xff04; // DIV
  static dividerRegister: i32 = 0;
  static updateDividerRegister(): void {
    let oldDividerRegister = Timers.dividerRegister;
    Timers.dividerRegister = 0;
    eightBitStoreIntoGBMemory(Timers.memoryLocationDividerRegister, 0);

    if (Timers.timerEnabled && _checkDividerRegisterFallingEdgeDetector(oldDividerRegister, 0)) {
      _incrementTimerCounter();
    }
  }

  // timerCounter = TIMA
  // TIMA is the actual counter.
  // Whenever the DIV gets the falling edge, and other obscure cases,
  // This is incremented. When this overflows, we need to fire an interrupt.
  static readonly memoryLocationTimerCounter: i32 = 0xff05;
  static timerCounter: i32 = 0;
  static timerCounterOverflowDelay: boolean = false;
  static timerCounterWasReset: boolean = false;
  static timerCounterMask: i32 = 0;

  static updateTimerCounter(value: i32): void {
    if (Timers.timerEnabled) {
      // From binjgb, dont write TIMA if we were just reset
      if (Timers.timerCounterWasReset) {
        return;
      }

      // Mooneye Test, tima_write_reloading
      // Writing in this strange delay cycle, will cancel
      // Both the interrupt and the TMA reload
      if (Timers.timerCounterOverflowDelay) {
        Timers.timerCounterOverflowDelay = false;
      }
    }

    Timers.timerCounter = value;
  }

  // Timer Modulo = TMA
  // TMA is what TIMA (Notice the I :p) is counting from, and TIMA will load
  // Whenever TIMA overflow.
  // For instance, we count like 1,2,3,4,5,6,7,8,9, and then overflow to 10.
  // TMA would be like "Hey, start counting from 5 whenever we reset"
  // Then we would be like 5,6,7,8,9...5,6,7,8,9...etc...
  static readonly memoryLocationTimerModulo: i32 = 0xff06;
  static timerModulo: i32 = 0;
  static updateTimerModulo(value: i32): void {
    Timers.timerModulo = value;

    // Mooneye Test, tma_write_reloading
    // Don't update if we were reloading
    if (Timers.timerEnabled && Timers.timerCounterWasReset) {
      Timers.timerCounter = value;
      Timers.timerCounterWasReset = false;
    }
  }

  // Timer Control = TAC
  // TAC Says how fast we are counting.
  // TAC controls which bit we are watching for the falling edge on the DIV register
  // And whenever the bit has the falling edge, we increment TIMA (The thing counting).
  // Therefore, depending on the value, we will either count faster or slower.
  static readonly memoryLocationTimerControl: i32 = 0xff07;
  // Bit 2    - Timer Stop  (0=Stop, 1=Start)
  // Bits 1-0 - Input Clock Select
  //            00:   4096 Hz    (~4194 Hz SGB) (1024 cycles)
  //            01: 262144 Hz  (~268400 Hz SGB) (16 cycles)
  //            10:  65536 Hz   (~67110 Hz SGB) (64 cycles)
  //            11:  16384 Hz   (~16780 Hz SGB) (256 cycles)
  static timerEnabled: boolean = false;
  static timerInputClock: i32 = 0;

  static updateTimerControl(value: i32): void {
    // Get some initial values
    let oldTimerEnabled = Timers.timerEnabled;
    Timers.timerEnabled = checkBitOnByte(2, value);
    let newTimerInputClock = value & 0x03;

    // Do some obscure behavior for if we should increment TIMA
    // This does the timer increments from rapid_toggle mooneye tests
    if (!oldTimerEnabled) {
      let oldTimerCounterMaskBit = _getTimerCounterMaskBit(Timers.timerInputClock);
      let newTimerCounterMaskBit = _getTimerCounterMaskBit(newTimerInputClock);
      let shouldIncrementTimerCounter = false;
      let dividerRegister = Timers.dividerRegister;

      if (Timers.timerEnabled) {
        shouldIncrementTimerCounter = checkBitOnByte(oldTimerCounterMaskBit, dividerRegister);
      } else {
        shouldIncrementTimerCounter =
          checkBitOnByte(oldTimerCounterMaskBit, dividerRegister) && checkBitOnByte(newTimerCounterMaskBit, dividerRegister);
      }

      if (shouldIncrementTimerCounter) {
        _incrementTimerCounter();
      }
    }

    Timers.timerInputClock = newTimerInputClock;
  }

  // Save States
  static readonly saveStateSlot: i32 = 5;

  // Function to save the state of the class
  // TODO: Save state for new properties on Timers
  static saveState(): void {
    // Batch Processing
    store<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot), Timers.currentCycles);

    // Divider Register
    store<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot), Timers.dividerRegister);

    // Timer Counter
    store<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot), Timers.timerCounter);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0c, Timers.saveStateSlot), Timers.timerCounterOverflowDelay);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Timers.saveStateSlot), Timers.timerCounterWasReset);
    store<i32>(getSaveStateMemoryOffset(0x0e, Timers.saveStateSlot), Timers.timerCounterMask);

    // Timer Modulo
    store<i32>(getSaveStateMemoryOffset(0x12, Timers.saveStateSlot), Timers.timerModulo);

    // Timer Control
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x16, Timers.saveStateSlot), Timers.timerEnabled);
    store<i32>(getSaveStateMemoryOffset(0x17, Timers.saveStateSlot), Timers.timerInputClock);
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Batch Processing
    Timers.currentCycles = load<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot));

    // Divider Register
    Timers.dividerRegister = load<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot));

    // Timer Counter
    Timers.timerCounter = load<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot));
    Timers.timerCounterOverflowDelay = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0c, Timers.saveStateSlot));
    Timers.timerCounterWasReset = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Timers.saveStateSlot));
    Timers.timerCounterMask = load<i32>(getSaveStateMemoryOffset(0x0e, Timers.saveStateSlot));

    // Timer Modulo
    Timers.timerModulo = load<i32>(getSaveStateMemoryOffset(0x12, Timers.saveStateSlot));

    // Timer Control
    Timers.timerEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x16, Timers.saveStateSlot));
    Timers.timerInputClock = load<i32>(getSaveStateMemoryOffset(0x17, Timers.saveStateSlot));
  }
}

// Inlined because closure compiler inlines
export function initializeTimers(): void {
  // Reset stateful Variables
  Timers.currentCycles = 0;
  Timers.dividerRegister = 0;
  Timers.timerCounter = 0;
  Timers.timerModulo = 0;
  Timers.timerEnabled = false;
  Timers.timerInputClock = 0;
  Timers.timerCounterOverflowDelay = false;
  Timers.timerCounterWasReset = false;

  if (Cpu.GBCEnabled) {
    // DIV
    eightBitStoreIntoGBMemory(0xff04, 0x1e);
    Timers.dividerRegister = 0x1ea0;

    // 0xFF05 -> 0xFF06 = 0x00

    // TAC
    eightBitStoreIntoGBMemory(0xff07, 0xf8);
    Timers.timerInputClock = 0xf8;
  } else {
    // DIV
    eightBitStoreIntoGBMemory(0xff04, 0xab);
    Timers.dividerRegister = 0xabcc;

    // 0xFF05 -> 0xFF06 = 0x00

    // TAC
    eightBitStoreIntoGBMemory(0xff07, 0xf8);
    Timers.timerInputClock = 0xf8;
  }

  // Override/reset some variables if the boot ROM is enabled
  if (Cpu.BootROMEnabled) {
    if (Cpu.GBCEnabled) {
      // GBC
    } else {
      // GB
      // DIV
      eightBitStoreIntoGBMemory(0xff04, 0x00);
      Timers.dividerRegister = 0x0004;
    }
  }
}

// Batch Process Timers
// Only checked on writes
// Function to batch process our Timers after we skipped so many cycles
export function batchProcessTimers(): void {
  // TODO: Did a timer rewrite, make a proper batch processing
  // For timers
  updateTimers(Timers.currentCycles);
  Timers.currentCycles = 0;
}

export function updateTimers(numberOfCycles: i32): void {
  // Want to increment 4 cycles at a time like an actual GB would
  let cyclesIncreased = 0;
  while (cyclesIncreased < numberOfCycles) {
    let oldDividerRegister = Timers.dividerRegister;
    let curDividerRegister = oldDividerRegister;

    cyclesIncreased += 4;
    curDividerRegister += 4;
    curDividerRegister &= 0xffff;

    Timers.dividerRegister = curDividerRegister;

    if (Timers.timerEnabled) {
      let timerCounterWasReset = Timers.timerCounterWasReset;
      if (Timers.timerCounterOverflowDelay) {
        Timers.timerCounter = Timers.timerModulo;
        // Fire off timer interrupt
        requestTimerInterrupt();
        Timers.timerCounterOverflowDelay = false;
        Timers.timerCounterWasReset = true;
      } else if (timerCounterWasReset) {
        Timers.timerCounterWasReset = false;
      }

      if (_checkDividerRegisterFallingEdgeDetector(oldDividerRegister, curDividerRegister)) {
        _incrementTimerCounter();
      }
    }
  }
}

// Function to increment our Timer Counter
// This fires off interrupts once we overflow
function _incrementTimerCounter(): void {
  var counter = Timers.timerCounter;
  if (++counter > 255) {
    // Whenever the timer overflows, there is a slight delay (4 cycles)
    // Of when TIMA gets TMA's value, and the interrupt is fired.
    // Thus we will set the delay, which can be handled in the update timer or write trap
    Timers.timerCounterOverflowDelay = true;
    counter = 0;
  }
  Timers.timerCounter = counter;
}

// Function to act as our falling edge detector
// Whenever we have a falling edge, we need to increment TIMA
// http://gbdev.gg8.se/wiki/articles/Timer_Obscure_Behaviour
// https://github.com/binji/binjgb/blob/master/src/emulator.c#L1944
function _checkDividerRegisterFallingEdgeDetector(oldDividerRegister: i32, newDividerRegister: i32): boolean {
  // Get our mask
  let timerCounterMaskBit = _getTimerCounterMaskBit(Timers.timerInputClock);

  // If the old register's watched bit was zero,
  // but after adding the new registers wastch bit is now 1
  return checkBitOnByte(timerCounterMaskBit, oldDividerRegister) && !checkBitOnByte(timerCounterMaskBit, newDividerRegister);
}

// Function to get our current tima mask bit
// used for our falling edge detector
// See The docs linked above, or TCAGB for this bit mapping
function _getTimerCounterMaskBit(timerInputClock: i32): i32 {
  switch (timerInputClock) {
    case 0x00:
      return 9;
    case 0x01:
      return 3;
    case 0x02:
      return 5;
    case 0x03:
      return 7;
  }
  return 0;
}
