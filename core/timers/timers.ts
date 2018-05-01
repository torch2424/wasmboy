import { Cpu } from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { requestTimerInterrupt } from '../interrupts/index';
import { checkBitOnByte, hexLog } from '../helpers/index';

export class Timers {
  // Current cycles
  // This will be used for batch processing
  static currentCycles: i32 = 0;

  // Number of cycles to run in each batch process
  static batchProcessCycles(): i32 {
    return 256;
  }

  static readonly memoryLocationDividerRegister: i32 = 0xff04; // DIV
  static dividerRegister: i32 = 0;
  static updateDividerRegister(value: i32): void {
    Timers.dividerRegister = 0;
    eightBitStoreIntoGBMemory(Timers.memoryLocationDividerRegister, 0);

    // Also, mooneye tests, resetting DIV resets the timer
    Timers.cycleCounter = 0;
    Timers.timerCounter = Timers.timerModulo;
  }
  static readonly memoryLocationTimerCounter: i32 = 0xff05; // TIMA
  static timerCounter: i32 = 0;
  static updateTimerCounter(value: i32): void {
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
    Timers.timerEnabled = checkBitOnByte(2, value);
    if (!Timers.timerEnabled) {
      return;
    }

    Timers.timerInputClock = value & 0x03;

    // Set our new current max, and reset the cycle counter
    Timers.cycleCounter = 0;
    Timers.currentMaxCycleCount = getFrequencyFromInputClockSelect();
  }

  // Cycle counter. This is used to determine if we should increment the REAL timer
  // I know this is weird, but it's all to make sure the emulation is in sync :p
  static cycleCounter: i32 = 0x00;
  static currentMaxCycleCount: i32 = 256;

  // Another timer, that doesn't fire intterupts, but jsut counts to 255, and back to zero :p
  // In Cgb mode, this still counts at the same rate since the CPU doubles and so does this counter
  // RealBoy Blog Post:
  // we also know that we have to increment the DIV register 16384 times per second.
  // Recall that the CPU frequency is 4194304 Hz, which means that every second the CPU produces 4194304 cycles.
  // We want to know the amount of cycles required for the DIV register to be incremented;
  // we get that 4194304/16384=256 CPU cycles are required before incrementing the DIV register.
  static dividerRegisterCycleCounter: i32 = 0x00;
  static dividerRegisterMaxCycleCount(): i32 {
    return 256;
  }

  // Save States

  static readonly saveStateSlot: i32 = 5;

  // Function to save the state of the class
  // TODO: Save state for new properties on Timers
  static saveState(): void {
    store<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot), Timers.cycleCounter);
    store<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot), Timers.currentMaxCycleCount);
    store<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot), Timers.dividerRegisterCycleCounter);

    eightBitStoreIntoGBMemory(Timers.memoryLocationDividerRegister, Timers.dividerRegister);
    eightBitStoreIntoGBMemory(Timers.memoryLocationTimerCounter, Timers.timerCounter);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Timers.cycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot));
    Timers.currentMaxCycleCount = load<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot));
    Timers.dividerRegisterCycleCounter = load<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot));

    Timers.dividerRegister = eightBitLoadFromGBMemory(Timers.memoryLocationDividerRegister);
    Timers.updateTimerCounter(eightBitLoadFromGBMemory(Timers.memoryLocationTimerCounter));
    Timers.updateTimerModulo(eightBitLoadFromGBMemory(Timers.memoryLocationTimerModulo));
    Timers.updateTimerControl(eightBitLoadFromGBMemory(Timers.memoryLocationTimerControl));
  }
}

export function initializeTimers(): void {
  if (Cpu.GBCEnabled) {
    eightBitStoreIntoGBMemory(0xff04, 0x2f);
    Timers.dividerRegister = 0x2f;
    // 0xFF05 -> 0xFF06 = 0x00
    eightBitStoreIntoGBMemory(0xff07, 0xf8);
    Timers.updateTimerControl(0xf8);
  } else {
    eightBitStoreIntoGBMemory(0xff04, 0xab);
    Timers.dividerRegister = 0xab;
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

  // Add our cycles our cycle counter
  Timers.cycleCounter += numberOfCycles;

  while (Timers.cycleCounter >= Timers.currentMaxCycleCount) {
    // Reset our cycle counters
    // Not setting to zero as we do not want to drop cycles
    Timers.cycleCounter -= Timers.currentMaxCycleCount;

    if (Timers.timerCounter >= 255) {
      // Store Timer Modulator inside of TIMA
      Timers.timerCounter = Timers.timerModulo;

      // Fire off timer interrupt
      requestTimerInterrupt();
    } else {
      Timers.timerCounter += 1;
    }
  }
}

// Function to update our divider register
function _checkDividerRegister(numberOfCycles: i32): void {
  // Every 256 clock cycles need to increment
  Timers.dividerRegisterCycleCounter += numberOfCycles;

  if (Timers.dividerRegisterCycleCounter >= Timers.dividerRegisterMaxCycleCount()) {
    // Reset the cycle counter
    // - 255 to catch any overflow with the cycles
    Timers.dividerRegisterCycleCounter -= Timers.dividerRegisterMaxCycleCount();

    Timers.dividerRegister += 1;

    if (Timers.dividerRegister > 0xff) {
      Timers.dividerRegister = 0;
    }
  }
}

// Function to get a cycle count froma  passed Timer clock
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
      // TODO: Fix tests involving the 16 cycle timer mode. This is the reason why blargg tests break
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
