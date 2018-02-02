import { Cpu } from '../cpu/index';
import { eightBitLoadFromGBMemory, eightBitStoreIntoGBMemory } from '../memory/index';
import { requestTimerInterrupt } from '../interrupts/index';

class Timers {
  static memoryLocationTIMA: u16 = 0xFF05; // Timer Modulator
  static memoryLocationTMA: u16 = 0xFF06; // Timer Counter (Actual Time Value)
  static memoryLocationTIMC: u16 = 0xFF07; // Timer Controller
  static memoryLocationDividerRegister: u16 = 0xFF04; // DividerRegister likes to count

  // Cycle counter. This is used to determine if we should increment the REAL timer
  // I know this is weird, but it's all to make sure the emulation is in sync :p
  static cycleCounter: i16 = 0x00;
  static currentMaxCycleCount: i16 = 1024;

  // Another timer, that doesn't fire intterupts, but jsut counts to 255, and back to zero :p
  static dividerRegisterCycleCounter: i16 = 0x00;
}

export function updateTimers(numberOfCycles: u8): void {

  _checkDividerRegister(numberOfCycles);

  if(_isTimerEnabled()) {

    // Add our cycles our cycle counter
    Timers.cycleCounter += numberOfCycles;

    if(Timers.cycleCounter < _getCurrentCycleCounterFrequency()) {
      // Reset our cycle counters
      Timers.cycleCounter = 0;

      // Update the actual timer counter
      let tima = eightBitLoadFromGBMemory(Timers.memoryLocationTIMA);
      if(tima == 255) {
        // Store Timer Modulator inside of TIMA
        eightBitStoreIntoGBMemory(Timers.memoryLocationTIMA, eightBitLoadFromGBMemory(Timers.memoryLocationTMA));
        // Fire off timer interrupt
        requestTimerInterrupt();
      } else {
        eightBitStoreIntoGBMemory(Timers.memoryLocationTIMA, tima + 1);
      }
    }
  }
}

// Function to update our divider register
function _checkDividerRegister(numberOfCycles: u8):void {
  // CLOCK_SPEED / 16382

  // Every 256 clock cycles need to increment
  Timers.dividerRegisterCycleCounter += numberOfCycles;

  if(Timers.dividerRegisterCycleCounter >= 256) {
    let dividerRegister = eightBitLoadFromGBMemory(Timers.memoryLocationDividerRegister);
    if(dividerRegister === 255) {
      dividerRegister = 0;
    } else {
      dividerRegister += 1;
    }
    eightBitStoreIntoGBMemory(Timers.memoryLocationDividerRegister, dividerRegister);
  }
}

function _isTimerEnabled(): boolean {
  // second bit, e.g 000 0100, will be set if the timer is enabled
  let timc = eightBitLoadFromGBMemory(Timers.memoryLocationTIMC);
  if((timc & 0x04) > 0) {
    return true;
  } else {
    return false;
  }
}

// NOTE: This can be sped up by intercepting writes to memory
// And handling this there
function _getCurrentCycleCounterFrequency(): i16 {

  // Get TIMC
  let timc = eightBitLoadFromGBMemory(Timers.memoryLocationTIMC);

  // Clear the top byte
  timc = timc & 0x03;

  // Returns value equivalent to
  // Cpu.CLOCK_SPEED / timc frequency
  let cycleCount = 0;
  if(timc === 0x00) {
    // TIMC -> 4096
    cycleCount = 1024;
  } else if (timc === 0x01) {
    // TIMC -> 262144
    cycleCount = 16;
  } else if (timc === 0x02) {
    // TIMC -> 65536
    cycleCount = 64;
  } else {
    // TIMC -> 16382
    cycleCount = 256
  }

  // If we notice the current max cycle count changes, reset the cyclecounter
  if(cycleCount != Timers.currentMaxCycleCount) {
    Timers.cycleCounter = 0;
    Timers.currentMaxCycleCount = <i16>cycleCount;
  }

  return <i16>cycleCount;
}
