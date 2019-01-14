// Information about all the opcodes for the GB
// Built with: https://rednex.github.io/rgbds/gbz80.7.html
// http://pastraiser.com/cpu/gameboy/gameboy_opcodes.html

const mnemonicToInfo = {};
const generateInstruction = (mnemonic, description, flags) => {
  const instruction = {};
  if (mnemonic) {
    instruction.mnemonic = mnemonic;
    instruciton.description = mnemonicToDescription[mnemonic];
  }
  if (description) {
    instruction.description = description;
  }
  if (params) {
    instruction.params = params;
  }
  if (cycles) {
    instruction.cycles = cycles;
  }
  if (flags) {
    instruction.flags = flags;
  }

  mnemonicToInfo[mnemonic] = instruction;
};

const getFlag = (flag, symbol) => {
  let flag = {};

  if (flag === undefined) {
    flag = {
      shorthand: '-',
      description: 'The flag is not affected.'
    };
    return flag;
  }

  if (typeof flag === 'number') {
    flag = {
      shorthand: `${flag}`,
      description: `The flag is set to ${flag}.`
    };

    return flag;
  }

  if (typeof flag === 'boolean' || typeof flag === 'string') {
    flag.shorthand = symbol;

    if (typeof typeof flag === 'boolean') {
      if (symbol === 'Z') {
        flag.description = 'Set if result is 0';
      } else if (symbol === 'N') {
        flag.description = 'Usually set by the operation itself';
      } else if (symbol === 'H') {
        flag.description = 'Set if overflow from bit 3.';
      } else if (symbol === 'C') {
        flag.description = 'Set if overflow from bit 7.';
      }
    } else {
      flag.description = flag;
    }

    return flag;
  }
};

const generateFlags = (zeroFlag, subtractFlag, halfCarryFlag, carryFlag) => {
  const flags = [getFlag(zeroFlag, 'Z'), getFlag(subtractFlag, 'N'), getFlag(halfCarryFlag, 'H'), getFlag(carryFlag, 'C')];

  return flags;
};

generateInstruction('ADC', 'Adds the parameters, plus the carry flag', generateFlags(true, 0, true, true));
generateInstruction('ADD', 'Adds the parameters', generateFlags(true, 0, true, true));
generateInstruction('AND', 'Bitwise AND between the parameters', generateFlags(true, 0, 1, 0));
generateInstruction('BIT', 'Test bit, set the zero flag if bit not set.', generateFlags(true, 0, 1, undefined));
generateInstruction('CALL', 'Calls address. Old address pushed onto the stack', generateFlags(true, 0, 1, undefined));
generateInstruction('CCF', 'Complement Carry Flag', generateFlags(undefined, 0, 0, 'Complemented'));
generateInstruction(
  'CP',
  "Subtract the value, set flags accordingly, but don't store the result.",
  generateFlags(true, 1, 'Set if no borrow from bit 4.', 'Set if no borrow (set if r8 > A).')
);
generateInstruction('CPL', 'Complement accumulator.', generateFlags(undefined, 1, 1, undefined));
generateInstruction(
  'DAA',
  'Decimal adjust register A (accumulator) to get a correct BCD representation after an arithmetic instruction.',
  generateFlags(true, undefined, true, 'Set or reset depending on the operation.')
);
generateInstruction('DEC', 'Decrement the value pointed by HL by 1.', generateFlags(true, 1, 'Set if no borrow from bit 4.', undefined));
generateInstruction('DI', 'Disable interrupts', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('EI', 'Enabled interrupts', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction(
  'HALT',
  'Enter CPU low power mode. Or Double Speed mode for CGB',
  generateFlags(undefined, undefined, undefined, undefined)
);
generateInstruction('INC', 'Increment value.', generateFlags(true, 0, true, undefined));
generateInstruction('JP', 'Jump to address.', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('JR', 'Jump to address relative to the current address.', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('LD', 'Load value into destination.', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('NOP', 'No Operation.', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('OR', 'Bitwise OR.', generateFlags(true, 0, 0, 0));
generateInstruction(
  'POP',
  'Pop value from the stack.',
  generateFlags(
    'Set from bit 7 of the popped low byte',
    'Set from bit 6 of the popped low byte.',
    'Set from bit 5 of the popped low byte.',
    'Set from bit 4 of the popped low byte.'
  )
);
generateInstruction(
  'PUSH',
  "Push register AF into the stack. The low byte's bit 7 corresponds to the Z flag, its bit 6 to the N flag, bit 5 to the H flag, and bit 4 to the C flag. Bits 3 to 0 are reset.",
  generateFlags(undefined, undefined, undefined, undefined)
);
generateInstruction('RES', 'Set bit on value', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('RET', 'Return from subroutine', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('RETI', 'return from subroutine, and enable interrupts', generateFlags(undefined, undefined, undefined, undefined));
// TODO: Currntly at RL

const generateOpcode = (mnemonic, params, cycles, numberOfConstants, isConditional, flagOverrides) => {};
