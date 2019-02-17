// Functions to get information about the emulator for debugging purposes
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
  getOpcodeAtProgramCounter
} from './debug-cpu';
export { getLY, drawBackgroundMapToWasmMemory, drawTileDataToWasmMemory, drawOamToWasmMemory } from './debug-graphics';
export { getDIV, getTIMA, getTMA, getTAC } from './debug-timer';
export {
  Breakpoints,
  setProgramCounterBreakpoint,
  resetProgramCounterBreakpoint,
  setReadGbMemoryBreakpoint,
  resetReadGbMemoryBreakpoint,
  setWriteGbMemoryBreakpoint,
  resetWriteGbMemoryBreakpoint
} from './breakpoints';
