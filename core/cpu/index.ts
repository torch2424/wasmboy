// NOTE: Code is very verbose, and will have some copy pasta'd lines.
// Reason being, I want the code to be very accessible for errors later on.
// Also, the benefit on splitting into functions is organizarion, and keeping things DRY.
// But since I highly doubt the GB CPU will be changing, DRY is no longer an issue
// And the verbosity / ease of use is more important, imo.

// NOTE: Commands like SUB B, or AND C, without a second parameter, actually refer SUB A, B or AND A, C

// Resources:
// https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions
// https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js

export { setZeroFlag, getZeroFlag, getCarryFlag } from './flags';

export { Cpu, initializeCpu } from './cpu';

export { executeOpcode } from './opcodes';
