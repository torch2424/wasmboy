// Breakpoints for memory / cpu
export class Breakpoints {
  static programCounter: i32 = -1;
  static readGbMemory: i32 = -1;
  static writeGbMemory: i32 = -1;
  static reachedBreakpoint: boolean = false;
}

export function breakpoint(): void {
  Breakpoints.reachedBreakpoint = true;
}

export function setProgramCounterBreakpoint(breakpoint: i32): void {
  Breakpoints.programCounter = breakpoint;
}

export function resetProgramCounterBreakpoint(): void {
  Breakpoints.programCounter = -1;
}

export function setReadGbMemoryBreakpoint(breakpoint: i32): void {
  Breakpoints.readGbMemory = breakpoint;
}

export function resetReadGbMemoryBreakpoint(): void {
  Breakpoints.readGbMemory = -1;
}

export function setWriteGbMemoryBreakpoint(breakpoint: i32): void {
  Breakpoints.writeGbMemory = breakpoint;
}

export function resetWriteGbMemoryBreakpoint(): void {
  Breakpoints.writeGbMemory = -1;
}
