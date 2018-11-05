import { getSaveStateMemoryOffset } from '../core';
import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { requestTimerInterrupt } from '../interrupts/index';
import { checkBitOnByte, setBitOnByte, hexLog } from '../helpers/index';

export class Timers {
  // Current cycles
  // This will be used for batch processing
  static currentCycles: i32 = 0;

  // Number of cycles to run in each batch process
  static batchProcessCycles(): i32 {
    return 256;
  }

  static readonly memoryLocationDividerRegister: i32 = 0xff04; // DIV
  // Divider Regiseter is 16 bits.
  // Divider Register when read is just the upper 8 bits
  // But internally is used as the full 16
  static dividerRegister: i32 = 0;
  static dividerRegisterCleared: boolean = false;
  static updateDividerRegister(value: i32): void {
    let oldDividerRegister: i32 = Timers.dividerRegister;

    Timers.dividerRegister = 0;
    Timers.dividerRegisterCleared = true;
    eightBitStoreIntoGBMemory(Timers.memoryLocationDividerRegister, 0);

    // Also, mooneye tests, resetting DIV resets the timer
    Timers.cycleCounter = 0;
    Timers.timerCounter = Timers.timerModulo;

    if (Timers.timerEnabled && _checkDividerRegisterFallingEdgeDetector(oldDividerRegister, Timers.dividerRegister)) {
      _incrementTimerCounter();
    }
  }
  static readonly memoryLocationTimerCounter: i32 = 0xff05; // TIMA
  static timerCounter: i32 = 0;
  static timerCounterReloadDelay: boolean = false;
  static timerCounterMask: i32 = 0;
  static updateTimerCounter(value: i32): void {
    // Mooneye Test, tima_write_reloading
    // Don't update if we were reloading
    if (Timers.timerCounterReloadDelay) {
      return;
    }

    Timers.cycleCounter = 0;
    Timers.timerCounter = value;
  }
  static readonly memoryLocationTimerModulo: i32 = 0xff06; // TMA
  static timerModulo: i32 = 0;
  static updateTimerModulo(value: i32): void {
    Timers.timerModulo = value;
  }

  static readonly memoryLocationTimerControl: i32 = 0xff07; // TAC
  // Bit 2    - Timer Stop  (0=Stop, 1=Start)
  // Bits 1-0 - Input Clock Select
  //            00:   4096 Hz    (~4194 Hz SGB)
  //            01: 262144 Hz  (~268400 Hz SGB)
  //            10:  65536 Hz   (~67110 Hz SGB)
  //            11:  16384 Hz   (~16780 Hz SGB)
  static timerEnabled: boolean = false;
  static timerInputClock: i32 = 0;
  static updateTimerControl(value: i32): void {
    // Get some initial values
    let oldTimerEnabled: boolean = Timers.timerEnabled;
    Timers.timerEnabled = checkBitOnByte(2, value);
    let newTimerInputClock: i32 = value & 0x03;

    // Do some obscure behavior for if we should increment TIMA
    if (!oldTimerEnabled) {
      let oldTimerCounterMaskBit: i32 = _getTimerCounterMaskBit(Timers.timerInputClock);
      let newTimerCounterMaskBit: i32 = _getTimerCounterMaskBit(newTimerInputClock);
      let shouldIncrementTimerCounter: boolean = false;

      if (Timers.timerEnabled) {
        shouldIncrementTimerCounter = checkBitOnByte(oldTimerCounterMaskBit, Timers.dividerRegister);
      } else {
        shouldIncrementTimerCounter =
          checkBitOnByte(oldTimerCounterMaskBit, Timers.dividerRegister) && checkBitOnByte(newTimerCounterMaskBit, Timers.dividerRegister);
      }

      if (shouldIncrementTimerCounter) {
        _incrementTimerCounter();
      }
    }

    Timers.timerInputClock = newTimerInputClock;
    Timers.currentMaxCycleCount = getFrequencyFromInputClockSelect();

    // Mooneye Test, rapid_toggle
    // Starting or stopping the timer, does not reset the internal counter
    if (oldTimerEnabled !== Timers.timerEnabled) {
      return;
    }

    // Reset the cycle counter
    Timers.cycleCounter = 0;
  }

  // Cycle counter. This is used to determine if we should increment the REAL timer
  // I know this is weird, but it's all to make sure the emulation is in sync :p
  static cycleCounter: i32 = 0x00;
  static currentMaxCycleCount: i32 = 256;

  // Save States
  static readonly saveStateSlot: i32 = 5;

  // Function to save the state of the class
  // TODO: Save state for new properties on Timers
  static saveState(): void {
    store<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot), Timers.cycleCounter);
    store<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot), Timers.currentMaxCycleCount);
    store<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot), Timers.dividerRegister);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Timers.saveStateSlot), Timers.timerCounterReloadDelay);

    eightBitStoreIntoGBMemory(Timers.memoryLocationTimerCounter, Timers.timerCounter);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Timers.cycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot));
    Timers.currentMaxCycleCount = load<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot));
    Timers.dividerRegister = load<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot));
    Timers.timerCounterReloadDelay = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Timers.saveStateSlot));

    Timers.updateTimerCounter(eightBitLoadFromGBMemory(Timers.memoryLocationTimerCounter));
    Timers.updateTimerModulo(eightBitLoadFromGBMemory(Timers.memoryLocationTimerModulo));
    Timers.updateTimerControl(eightBitLoadFromGBMemory(Timers.memoryLocationTimerControl));
  }
}

export function initializeTimers(): void {
  // Reset stateful Variables
  Timers.currentCycles = 0;
  Timers.dividerRegister = 0;
  Timers.timerCounter = 0;
  Timers.timerModulo = 0;
  Timers.timerEnabled = false;
  Timers.timerInputClock = 0;
  Timers.cycleCounter = 0;

  if (Cpu.GBCEnabled) {
    eightBitStoreIntoGBMemory(0xff04, 0x2f);
    Timers.dividerRegister = 0x1ea0;
    // 0xFF05 -> 0xFF06 = 0x00
    eightBitStoreIntoGBMemory(0xff07, 0xf8);
    Timers.updateTimerControl(0xf8);
  } else {
    eightBitStoreIntoGBMemory(0xff04, 0xab);
    Timers.dividerRegister = 0xabcc;
    // 0xFF05 -> 0xFF06 = 0x00
    eightBitStoreIntoGBMemory(0xff07, 0xf8);
    Timers.updateTimerControl(0xf8);
  }
}

// Batch Process Timers
// Only checked on writes
// Function to batch process our Timers after we skipped so many cycles
export function batchProcessTimers(): void {
  // Get our current batch process cycles
  // This will depend on the least amount of cycles we need to update
  // Something
  let batchProcessCycles: i32 = Timers.batchProcessCycles();
  if (Timers.timerEnabled && Timers.currentMaxCycleCount < batchProcessCycles) {
    batchProcessCycles = Timers.currentMaxCycleCount;
  }

  if (Timers.currentCycles < batchProcessCycles) {
    return;
  }

  while (Timers.currentCycles >= batchProcessCycles) {
    updateTimers(batchProcessCycles);
    Timers.currentCycles = Timers.currentCycles - batchProcessCycles;
  }
}

export function updateTimers(numberOfCycles: i32): void {
  _checkDividerRegister(numberOfCycles);

  if (!Timers.timerEnabled) {
    return;
  }

  if (Timers.timerCounterReloadDelay) {
    Timers.timerCounter = Timers.timerModulo;
    Timers.timerCounterReloadDelay = false;
  }

  // Add our cycles our cycle counter
  Timers.cycleCounter += numberOfCycles;

  while (Timers.cycleCounter >= Timers.currentMaxCycleCount) {
    // Reset our cycle counters
    // Not setting to zero as we do not want to drop cycles
    Timers.cycleCounter -= Timers.currentMaxCycleCount;

    _incrementTimerCounter();
  }
}

// Function to update our divider register
function _checkDividerRegister(numberOfCycles: i32): void {
  // We would normally add cycles and then do the div write,
  // But since we do the write and then add the cycles,
  // we need to catch when we are cleared that way we skip said cycles
  if (Timers.dividerRegisterCleared) {
    Timers.dividerRegisterCleared = false;
    return;
  }

  let oldDividerRegister: i32 = Timers.dividerRegister;

  Timers.dividerRegister += numberOfCycles;

  if (Timers.dividerRegister > 0xffff) {
    Timers.dividerRegister -= 0x10000;
  }

  if (_checkDividerRegisterFallingEdgeDetector(oldDividerRegister, Timers.dividerRegister)) {
    _incrementTimerCounter();
  }
}

// Function to get a cycle count from a passed Timer clock
function getFrequencyFromInputClockSelect(): i32 {
  // Returns value equivalent to
  // Cpu.CLOCK_SPEED / timc frequency
  // TIMC -> 16382
  // Default to 0x03
  let cycleCount: i32 = 256;
  if (Cpu.GBCDoubleSpeed) {
    cycleCount = 512;
  }
  switch (Timers.timerInputClock) {
    case 0x00:
      // TIMC -> 4096
      cycleCount = 1024;
      if (Cpu.GBCDoubleSpeed) {
        cycleCount = 2048;
      }
      return cycleCount;
    case 0x01:
      // TIMC -> 262144
      cycleCount = 16;
      if (Cpu.GBCDoubleSpeed) {
        cycleCount = 32;
      }
      return cycleCount;
    case 0x02:
      // TIMC -> 65536
      cycleCount = 64;
      if (Cpu.GBCDoubleSpeed) {
        cycleCount = 126;
      }
      return cycleCount;
  }

  return cycleCount;
}

// Function to increment our Timer Counter
// This fires off interrupts once we overflow
function _incrementTimerCounter(): void {
  if (Timers.timerCounter >= 255) {
    // Store Timer Modulator inside of TIMA
    // However, from mooneye test tima_reload
    // This is delayed by 4 cycles
    Timers.timerCounterReloadDelay = true;
    Timers.timerCounter = Timers.timerModulo;

    // Fire off timer interrupt
    requestTimerInterrupt();
  } else {
    Timers.timerCounter += 1;
  }
}

// Function to act as our falling edge detector
// Whenever we have a falling edge, we need to increment TIMA
// This is obscure behavior of how the divider register and TIMA work together
// http://gbdev.gg8.se/wiki/articles/Timer_Obscure_Behaviour
// https://github.com/binji/binjgb/blob/master/src/emulator.c#L1944
function _checkDividerRegisterFallingEdgeDetector(oldDividerRegister: i32, newDividerRegister: i32): boolean {
  // Get our mask
  let timerCounterMaskBit = _getTimerCounterMaskBit(Timers.timerInputClock);

  if (checkBitOnByte(timerCounterMaskBit, oldDividerRegister) && !checkBitOnByte(timerCounterMaskBit, newDividerRegister)) {
    return true;
  }

  return false;
}

// Function to get our current tima mask bit
// used for our falling edge detector
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
