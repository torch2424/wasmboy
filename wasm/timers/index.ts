import {
  Cpu
} from '../cpu/index';
import {
  eightBitLoadFromGBMemorySkipTraps,
  eightBitStoreIntoGBMemorySkipTraps,
  getSaveStateMemoryOffset,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import {
  requestTimerInterrupt
} from '../interrupts/index';

export class Timers {

  // Current cycles
  // This will be used for batch processing
  static currentCycles: i32 = 0;

  // Number of cycles to run in each batch process
  static batchProcessCycles: i32 = 255;

  static readonly memoryLocationTIMA: u16 = 0xFF05; // Timer Modulator
  static readonly memoryLocationTMA: u16 = 0xFF06; // Timer Counter (Actual Time Value)
  static readonly memoryLocationTIMC: u16 = 0xFF07; // Timer Controller (A.K.A TAC)
  static readonly memoryLocationDividerRegister: u16 = 0xFF04; // DividerRegister likes to count

  // Cycle counter. This is used to determine if we should increment the REAL timer
  // I know this is weird, but it's all to make sure the emulation is in sync :p
  static cycleCounter: i32 = 0x00;
  static currentMaxCycleCount: i32 = 1024;

  // Another timer, that doesn't fire intterupts, but jsut counts to 255, and back to zero :p
  static dividerRegisterCycleCounter: i32 = 0x00;

  // Save States

  static readonly saveStateSlot: u16 = 5;

  // Function to save the state of the class
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
  let batchProcessCycles: i32 = Timers.batchProcessCycles;
  if (_isTimerEnabled() && Timers.currentMaxCycleCount < batchProcessCycles) {
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

  if(_isTimerEnabled()) {

    // Add our cycles our cycle counter
    Timers.cycleCounter += numberOfCycles;

    if(Timers.cycleCounter > _getCurrentCycleCounterFrequency()) {

      // Reset our cycle counters
      // Not setting to zero as we do not want to drop cycles
      Timers.cycleCounter -= _getCurrentCycleCounterFrequency();

      // Update the actual timer counter
      let tima: u8 = eightBitLoadFromGBMemorySkipTraps(Timers.memoryLocationTIMA);
      if(tima == 255) {
        // Store Timer Modulator inside of TIMA
        eightBitStoreIntoGBMemorySkipTraps(Timers.memoryLocationTIMA, eightBitLoadFromGBMemorySkipTraps(Timers.memoryLocationTMA));

        // Fire off timer interrupt
        requestTimerInterrupt();
      } else {
        eightBitStoreIntoGBMemorySkipTraps(Timers.memoryLocationTIMA, tima + 1);
      }
    }
  }
}

// Function to update our divider register
function _checkDividerRegister(numberOfCycles: i32): void {
  // CLOCK_SPEED / 16382

  // Every 256 clock cycles need to increment
  Timers.dividerRegisterCycleCounter += numberOfCycles;

  if(Timers.dividerRegisterCycleCounter >= 255) {

    // Reset the cycle counter
    // - 255 to catch any overflow with the cycles
    Timers.dividerRegisterCycleCounter -= 255;

    let dividerRegister = eightBitLoadFromGBMemorySkipTraps(Timers.memoryLocationDividerRegister);
    // TODO: Hoping that the overflow will occur correctly here, see this for any weird errors
    dividerRegister += 1;
    eightBitStoreIntoGBMemorySkipTraps(Timers.memoryLocationDividerRegister, dividerRegister);
  }
}

function _isTimerEnabled(): boolean {
  // second bit, e.g 000 0100, will be set if the timer is enabled
  return (eightBitLoadFromGBMemorySkipTraps(Timers.memoryLocationTIMC) & 0x04) > 0;
}

// NOTE: This can be sped up by intercepting writes to memory
// And handling this there
function _getCurrentCycleCounterFrequency(): i32 {

  // Get TIMC
  let timc = eightBitLoadFromGBMemorySkipTraps(Timers.memoryLocationTIMC);

  // Clear the top byte
  timc = timc & 0x03;

  // Returns value equivalent to
  // Cpu.CLOCK_SPEED / timc frequency
  // TIMC -> 16382
  let cycleCount: i32 = 256;
  switch(timc) {
    case 0x00:
      // TIMC -> 4096
      cycleCount = 1024;
      break;
    case 0x01:
      // TIMC -> 262144
      cycleCount = 16;
      break;
    case 0x02:
      // TIMC -> 65536
      cycleCount = 64;
      break;
  }

  // If we notice the current max cycle count changes, reset the cyclecounter
  if(cycleCount != Timers.currentMaxCycleCount) {
    Timers.cycleCounter = 0;
    Timers.currentMaxCycleCount = cycleCount;
  }

  return cycleCount;
}
