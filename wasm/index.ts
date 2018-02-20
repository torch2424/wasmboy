
// Imports
import {
Cpu
} from './cpu/index';

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
} from './sound/index'

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
