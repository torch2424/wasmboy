// Imports
import {
  Cpu,
  initializeCpu,
  executeOpcode
} from './cpu/index';
import {
  Graphics,
  updateGraphics,
  batchProcessGraphics
} from './graphics/index';
import {
  Interrupts,
  checkInterrupts
} from './interrupts/index';
import {
  Joypad
} from './joypad/index';
import {
  Memory,
  eightBitLoadFromGBMemory
} from './memory/index';
import {
  Timers,
  updateTimers,
  batchProcessTimers
} from './timers/index';
import {
  Sound,
  Channel1,
  Channel2,
  Channel3,
  Channel4,
  updateSound
} from './sound/index';
import {
  wasmPages
} from './constants/constants';
import {
  Config
} from './config';

// Public Exports
export {
  config
} from './config';
export {
  setJoypadState
} from './joypad/index';
export {
  getAudioQueueIndex,
  resetAudioQueue
} from './sound/index';
export {
  wasmMemorySize,
  wasmBoyInternalStateLocation,
  wasmBoyInternalStateSize,
  gameBoyInternalMemoryLocation,
  gameBoyInternalMemorySize,
  videoOutputLocation,
  currentFrameVideoOutputLocation,
  frameInProgressVideoOutputLocation,
  gameboyColorPaletteLocation,
  backgroundMapLocation,
  tileDataMap,
  soundOutputLocation,
  gameBytesLocation,
  gameRamBanksLocation
} from './constants/constants';
export {
  getWasmBoyOffsetFromGameBoyOffset
} from './memory/memoryMap';
export {
  getRegisterA,
  getRegisterB,
  getRegisterC,
  getRegisterD,
  getRegisterE,
  getRegisterH,
  getRegisterL,
  getRegisterF,
  getProgramCounter,
  getStackPointer,
  getOpcodeAtProgramCounter,
  drawBackgroundMapToWasmMemory,
  drawTileDataToWasmMemory
} from './debug/debug';

// Grow our memory to the specified size
if(current_memory() < wasmPages) {
  grow_memory(wasmPages - current_memory());
}

export function initialize(useGBCMode: i32 = 1, includeBootRom: i32 = 0): void {
  initializeCpu(useGBCMode, includeBootRom);
}

// Public funciton to run opcodes until an event occurs.
// Return values:
// -1 = error
// 1 = render a frame
// 2 = replace boot rom
export function update(): i32 {

  let error: boolean = false;
  let numberOfCycles: i32 = -1;

  while(!error &&
    Cpu.currentCycles < Cpu.MAX_CYCLES_PER_FRAME()) {
    numberOfCycles = emulationStep();
    if (numberOfCycles < 0) {
      error = true;
    }
  }

  // Find our exit reason
  if (Cpu.currentCycles >= Cpu.MAX_CYCLES_PER_FRAME()) {
    // Render a frame

    // Reset our currentCycles
    Cpu.currentCycles -= Cpu.MAX_CYCLES_PER_FRAME();

    return 1;
  }
  // TODO: Boot ROM handling

  // There was an error, return -1, and push the program counter back to grab the error opcode
  Cpu.programCounter -= 1;
  return -1;
}

// Function to execute an opcode, and update other gameboy hardware.
// http://www.codeslinger.co.uk/pages/projects/gameboy/beginning.html
export function emulationStep(): i32 {
  // Get the opcode, and additional bytes to be handled
  // Number of cycles defaults to 4, because while we're halted, we run 4 cycles (according to matt :))
  let numberOfCycles: i32 = 4;
  let opcode: i32 = 0;

  // Cpu Halting best explained: https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/db7xnbe/
  if(!Cpu.isHalted && !Cpu.isStopped) {
    opcode = <u8>eightBitLoadFromGBMemory(Cpu.programCounter);
    numberOfCycles = executeOpcode(opcode);
  } else {
    // if we were halted, and interrupts were disabled but interrupts are pending, stop waiting
    if(Cpu.isHalted && !Interrupts.masterInterruptSwitch && Interrupts.areInterruptsPending()) {
      Cpu.isHalted = false;
      Cpu.isStopped = false;

      // Need to run the next opcode twice, it's a bug menitoned in
      // The reddit comment mentioned above

      // CTRL+F "low-power" on gameboy cpu manual
      // http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf
      // E.g
      // 0x76 - halt
      // FA 34 12 - ld a,(1234)
      // Becomes
      // FA FA 34 ld a,(34FA)
      // 12 ld (de),a
      opcode = <u8>eightBitLoadFromGBMemory(Cpu.programCounter);
      numberOfCycles = executeOpcode(opcode);
      Cpu.programCounter -= 1;
    }
  }

  // blarggFixes, don't allow register F to have the bottom nibble
  Cpu.registerF = Cpu.registerF & 0xF0;

  // Check if there was an error decoding the opcode
  if(numberOfCycles <= 0) {
    return numberOfCycles;
  }

  // Check if we did a DMA TRansfer, if we did add the cycles
  if (Memory.DMACycles > 0) {
    numberOfCycles += Memory.DMACycles;
    Memory.DMACycles = 0;
  }

  // Interrupt Handling requires 20 cycles
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
  numberOfCycles += checkInterrupts();

  // Finally, Add our number of cycles to the CPU Cycles
  Cpu.currentCycles += numberOfCycles;

  if(!Cpu.isStopped) {
    if(Config.graphicsBatchProcessing) {
      // Need to do this, since a lot of things depend on the scanline
      // Batch processing will simply return if the number of cycles is too low
      Graphics.currentCycles += numberOfCycles;
      batchProcessGraphics();
    } else {
      updateGraphics(numberOfCycles);
    }

    if(Config.audioBatchProcessing) {
      Sound.currentCycles += numberOfCycles;
    } else {
      updateSound(numberOfCycles);
    }
  }

  // Check other Gameboy components
  if (Config.timersBatchProcessing) {
    // Batch processing will simply return if the number of cycles is too low
    Timers.currentCycles += numberOfCycles;
    batchProcessTimers();
  } else {
    updateTimers(numberOfCycles);
  }

  return numberOfCycles;
}

// Function to save state to memory for all of our classes
export function saveState(): void {
  Cpu.saveState();
  Graphics.saveState();
  Interrupts.saveState();
  Joypad.saveState();
  Memory.saveState();
  Timers.saveState();
  Sound.saveState();
  Channel1.saveState();
  Channel2.saveState();
  Channel3.saveState();
  Channel4.saveState();
}

// Function to load state from memory for all of our classes
export function loadState(): void {
  Cpu.loadState();
  Graphics.loadState();
  Interrupts.loadState();
  Joypad.loadState();
  Memory.loadState();
  Timers.loadState();
  Sound.loadState();
  Channel1.loadState();
  Channel2.loadState();
  Channel3.loadState();
  Channel4.loadState();
}
