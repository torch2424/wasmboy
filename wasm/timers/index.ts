import {
  Cpu
} from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemorySkipTraps,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import {
  requestTimerInterrupt
} from '../interrupts/index';
import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';

export class Timers {

  // Current cycles
  // This will be used for batch processing
  static currentCycles: i32 = 0;

  // Number of cycles to run in each batch process
  static batchProcessCycles(): i32 {
  if (Cpu.GBCDoubleSpeed) {
    return 140448;
  }

    return 255;
  }

  static readonly memoryLocationTIMA: u16 = 0xFF05; // Timer Modulator
  static readonly memoryLocationTMA: u16 = 0xFF06; // Timer Counter (Actual Time Value)
  static readonly memoryLocationTIMC: u16 = 0xFF07; // Timer Controller (A.K.A TAC)
  static readonly memoryLocationDividerRegister: u16 = 0xFF04; // DividerRegister likes to count

  // Check if the timer is currently enabled
  static isEnabled: boolean = false;

  // Cycle counter. This is used to determine if we should increment the REAL timer
  // I know this is weird, but it's all to make sure the emulation is in sync :p
  static cycleCounter: i32 = 0x00;
  static currentMaxCycleCount: i32 = 256;

  // Another timer, that doesn't fire intterupts, but jsut counts to 255, and back to zero :p
  static dividerRegisterCycleCounter: i32 = 0x00;
  static dividerRegisterMaxCycleCount(): i32 {
    if (Cpu.GBCDoubleSpeed) {
      return 140448;
    }

    return 255;
  }

  // Save States

  static readonly saveStateSlot: u16 = 5;

  // Function to save the state of the class
  // TODO: Save state for new properties on Timers
  static saveState(): void {
    store<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot), Timers.cycleCounter);
    store<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot), Timers.currentMaxCycleCount);
    store<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot), Timers.dividerRegisterCycleCounter);
  }

  // Function to load the save state from memory
  static loadState(): void {
    Timers.cycleCounter = load<i32>(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot));
    Timers.currentMaxCycleCount = load<i32>(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot));
    Timers.dividerRegisterCycleCounter = load<i32>(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot));
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
  if (Timers.isEnabled && Timers.currentMaxCycleCount < batchProcessCycles) {
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

  if(!Timers.isEnabled) {
    return;
  }

  // Add our cycles our cycle counter
  Timers.cycleCounter += numberOfCycles;

  while (Timers.cycleCounter >= Timers.currentMaxCycleCount) {

    // Update the actual timer counter
    let tima: u8 = eightBitLoadFromGBMemory(Timers.memoryLocationTIMA);

    // Reset our cycle counters
    // Not setting to zero as we do not want to drop cycles
    Timers.cycleCounter -= Timers.currentMaxCycleCount;

    if(tima >= 255) {
      // Store Timer Modulator inside of TIMA
      eightBitStoreIntoGBMemorySkipTraps(Timers.memoryLocationTIMA, eightBitLoadFromGBMemory(Timers.memoryLocationTMA));

      // Fire off timer interrupt
      requestTimerInterrupt();
    } else {
      eightBitStoreIntoGBMemorySkipTraps(Timers.memoryLocationTIMA, tima + 1);
    }
  }
}

// Function called on write to TIMC
export function handleTIMCWrite(timc: u8): void {

  // Set if the timer is enabled
  Timers.isEnabled = checkBitOnByte(2, timc);

  if(!Timers.isEnabled) {
    return;
  }

  // Clear the top byte
  timc = timc & 0x03;

  // Returns value equivalent to
  // Cpu.CLOCK_SPEED / timc frequency
  // TIMC -> 16382
  let cycleCount: i32 = 256;
  if (Cpu.GBCDoubleSpeed) {
    cycleCount = 512;
  }
  switch(timc) {
    case 0x00:
      // TIMC -> 4096
      cycleCount = 1024;
      if (Cpu.GBCDoubleSpeed) {
        cycleCount = 2048;
      }
      break;
    case 0x01:
      // TIMC -> 262144
      cycleCount = 16;
      if (Cpu.GBCDoubleSpeed) {
        cycleCount = 32;
      }
      break;
    case 0x02:
      // TIMC -> 65536
      cycleCount = 64;
      if (Cpu.GBCDoubleSpeed) {
        cycleCount = 126;
      }
      break;
  }

  // Set our new current max, and reset the cycle counter
  Timers.cycleCounter = 0;
  Timers.currentMaxCycleCount = cycleCount;
}

// Function to update our divider register
function _checkDividerRegister(numberOfCycles: i32): void {

  // Every 256 clock cycles need to increment
  Timers.dividerRegisterCycleCounter += numberOfCycles;

  if(Timers.dividerRegisterCycleCounter >= Timers.dividerRegisterMaxCycleCount()) {

    // Reset the cycle counter
    // - 255 to catch any overflow with the cycles
    Timers.dividerRegisterCycleCounter -= Timers.dividerRegisterMaxCycleCount();

    let dividerRegister: u8 = eightBitLoadFromGBMemory(Timers.memoryLocationDividerRegister);
    dividerRegister += 1;
    eightBitStoreIntoGBMemorySkipTraps(Timers.memoryLocationDividerRegister, dividerRegister);
  }
}
