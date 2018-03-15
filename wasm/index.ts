// Imports
import {
  Cpu
} from './cpu/index';
import {
  Graphics
} from './graphics/index';
import {
  Interrupts
} from './interrupts/index';
import {
  Joypad
} from './joypad/index';
import {
  Memory
} from './memory/index';
import {
  Timers
} from './timers/index';
import {
  Sound,
  Channel1,
  Channel2,
  Channel3,
  Channel4
} from './sound/index';
import {
  eightBitLoadFromGBMemory
} from './memory/index';
import {
  performanceTimestamp
} from './helpers/index'

// Public Exports
export {
initialize
} from './cpu/index';
export {
  update,
  emulationStep
} from './cpu/opcodes';
export {
  areInterruptsEnabled
} from './interrupts/index';
export {
  setJoypadState
} from './joypad/index';
export {
  getAudioQueueIndex,
  resetAudioQueue
} from './sound/index';

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

export function getRegisterA(): u8 {
  return Cpu.registerA;
}

export function getRegisterB(): u8 {
  return Cpu.registerB;
}

export function getRegisterC(): u8 {
  return Cpu.registerC;
}

export function getRegisterD(): u8 {
  return Cpu.registerD;
}

export function getRegisterE(): u8 {
  return Cpu.registerE;
}

export function getRegisterH(): u8 {
  return Cpu.registerH;
}

export function getRegisterL(): u8 {
  return Cpu.registerL;
}

export function getRegisterF(): u8 {
  return Cpu.registerF;
}

export function getProgramCounter(): u16 {
  return Cpu.programCounter;
}

export function getStackPointer(): u16 {
  return Cpu.stackPointer;
}

export function getPreviousOpcode(): u8 {
  return Cpu.previousOpcode;
}

export function getOpcodeAtProgramCounter(): u8 {
  return eightBitLoadFromGBMemory(Cpu.programCounter);
}
