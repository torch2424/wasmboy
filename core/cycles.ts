// Syncing and Tracking executed cycles

import { Config } from './config';
import { Cpu } from './cpu/index';
import { Graphics, updateGraphics, batchProcessGraphics } from './graphics/index';
import { Memory } from './memory/index';
import { Timers, updateTimers, batchProcessTimers } from './timers/index';
import { Sound, updateSound, batchProcessAudio } from './sound/index';
import { updateSerial } from './serial/serial';

export class Cycles {
  // An even number below the max 32 bit integer
  static cyclesPerCycleSet: i32 = 2000000000;
  static cycleSets: i32 = 0;
  static cycles: i32 = 0;
}

export function getCyclesPerCycleSet(): i32 {
  return Cycles.cyclesPerCycleSet;
}

export function getCycleSets(): i32 {
  return Cycles.cycleSets;
}

export function getCycles(): i32 {
  return Cycles.cycles;
}

// Inlined because closure compiler inlines
function trackCyclesRan(numberOfCycles: i32): void {
  let cycles = Cycles.cycles;
  cycles += numberOfCycles;
  if (cycles >= Cycles.cyclesPerCycleSet) {
    Cycles.cycleSets += 1;
    cycles -= Cycles.cyclesPerCycleSet;
  }
  Cycles.cycles = cycles;
}

// Inlined because closure compiler inlines
export function resetCycles(): void {
  Cycles.cyclesPerCycleSet = 2000000000;
  Cycles.cycleSets = 0;
  Cycles.cycles = 0;
}

// Sync other GB Components with the number of cycles
export function syncCycles(numberOfCycles: i32): void {
  // Check if we did a DMA TRansfer, if we did add the cycles
  if (Memory.DMACycles > 0) {
    numberOfCycles += Memory.DMACycles;
    Memory.DMACycles = 0;
  }

  // Finally, Add our number of cycles to the CPU Cycles
  Cpu.currentCycles += numberOfCycles;

  // Check other Gameboy components
  if (!Cpu.isStopped) {
    if (Config.graphicsBatchProcessing) {
      // Need to do this, since a lot of things depend on the scanline
      // Batch processing will simply return if the number of cycles is too low
      Graphics.currentCycles += numberOfCycles;
      batchProcessGraphics();
    } else {
      updateGraphics(numberOfCycles);
    }

    if (Config.audioBatchProcessing) {
      Sound.currentCycles += numberOfCycles;
      batchProcessAudio();
    } else {
      updateSound(numberOfCycles);
    }

    updateSerial(numberOfCycles);
  }

  if (Config.timersBatchProcessing) {
    // Batch processing will simply return if the number of cycles is too low
    Timers.currentCycles += numberOfCycles;
    batchProcessTimers();
  } else {
    updateTimers(numberOfCycles);
  }

  trackCyclesRan(numberOfCycles);
}
