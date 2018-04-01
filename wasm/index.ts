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
  config
} from './config';
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
export {
  getRegisterA,
  getRegisterB,
  getRegisterC,
  getRegisterD,
  getRegisterE,
  getRegisterH,
  getRegisterL,
  getRegisterF,
  getOpcodeAtProgramCounter
} from './debug/debug';

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
