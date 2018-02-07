// Fixes for the blargg cpu_instrs rom

import { Cpu } from './index';

export function clearBottomBitsOfFlagRegister(): void {
  Cpu.registerF = Cpu.registerF & 0xF0;
}
