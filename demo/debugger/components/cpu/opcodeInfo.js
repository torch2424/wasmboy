// Information about all the opcodes for the GB
// Built with: https://rednex.github.io/rgbds/gbz80.7.html
// http://pastraiser.com/cpu/gameboy/gameboy_opcodes.html

const getFlag = (flag, symbol) => {
  let response = {};

  if (flag === undefined) {
    response = {
      shorthand: '-',
      description: 'The flag is not affected.'
    };
    return response;
  }

  if (typeof flag === 'number') {
    response = {
      shorthand: `${flag}`,
      description: `The flag is set to ${flag}.`
    };

    return response;
  }

  if (typeof flag === 'boolean' || typeof flag === 'string') {
    response.shorthand = symbol;

    if (typeof flag === 'boolean') {
      if (symbol === 'Z') {
        response.description = 'Set if result is 0';
      } else if (symbol === 'N') {
        response.description = 'Usually set by the operation itself';
      } else if (symbol === 'H') {
        response.description = 'Set if overflow from bit 3.';
      } else if (symbol === 'C') {
        response.description = 'Set if overflow from bit 7.';
      }
    } else {
      response.description = flag;
    }

    return response;
  }
};

const generateFlags = (zeroFlag, subtractFlag, halfCarryFlag, carryFlag) => {
  return [getFlag(zeroFlag, 'Z'), getFlag(subtractFlag, 'N'), getFlag(halfCarryFlag, 'H'), getFlag(carryFlag, 'C')];
};

const instructions = {};
const generateInstruction = (mnemonic, description, flags) => {
  const instruction = {};
  if (mnemonic) {
    instruction.mnemonic = mnemonic;
  }
  if (description) {
    instruction.description = description;
  }
  if (flags) {
    instruction.flags = flags;
  }

  instructions[mnemonic] = instruction;
};

// Now we can generate our individual opcodes
const opcodes = {};
const cbOpcodes = {};
const hexToString = hex => `0x${hex.toString(16).toUpperCase()}`;
const generateOpcode = (hex, mnemonic, params, cycles, flagOverrides, isCB) => {
  const instruction = instructions[mnemonic];
  const opcode = {
    value: hexToString(hex),
    params,
    cycles,
    isConditional: typeof cylces === 'array',
    instruction: {
      ...instruction
    }
  };

  if (flagOverrides) {
    opcode.instruction.flags = [flagOverrides];
  }

  if (isCB) {
    cbOpcodes[hexToString(hex)] = opcode;
  } else {
    opcodes[hexToString(hex)] = opcode;
  }
};

// For instructions like 0x80 -> 0x87
const generateSimpleArithmeticOpcodeSet = (startHex, mnemonic) => {
  generateOpcode(startHex + 0, mnemonic, ['A', 'B'], 4);
  generateOpcode(startHex + 1, mnemonic, ['A', 'C'], 4);
  generateOpcode(startHex + 2, mnemonic, ['A', 'D'], 4);
  generateOpcode(startHex + 3, mnemonic, ['A', 'E'], 4);
  generateOpcode(startHex + 4, mnemonic, ['A', 'H'], 4);
  generateOpcode(startHex + 5, mnemonic, ['A', 'L'], 4);
  generateOpcode(startHex + 6, mnemonic, ['A', '[HL]'], 8);
  generateOpcode(startHex + 7, mnemonic, ['A', 'A'], 4);
};

// For our Simple CB Opcodes
const generateSimpleCBOpcodeSet = (startHex, mnemonic, constantNumberedParam) => {
  generateOpcode(startHex + 0, mnemonic, ['B'], 8, undefined, true);
  generateOpcode(startHex + 1, mnemonic, ['C'], 8, undefined, true);
  generateOpcode(startHex + 2, mnemonic, ['D'], 8, undefined, true);
  generateOpcode(startHex + 3, mnemonic, ['E'], 8, undefined, true);
  generateOpcode(startHex + 4, mnemonic, ['H'], 8, undefined, true);
  generateOpcode(startHex + 5, mnemonic, ['L'], 8, undefined, true);
  generateOpcode(startHex + 6, mnemonic, ['[HL]'], 16, undefined, true);
  generateOpcode(startHex + 7, mnemonic, ['A'], 8, undefined, true);

  if (constantNumberedParam !== undefined) {
    for (let i = 0; i < 8; i++) {
      cbOpcodes[hexToString(startHex + i)].params.unshift(constantNumberedParam);
    }
  }
};

// Generate our numbered CB params
const generateNumberedCBOpcodeSet = (startHex, mnemonic) => {
  for (let i = 0; i < 8; i++) {
    generateSimpleCBOpcodeSet(startHex + i * 8, mnemonic, i);
  }
};

// ADC
generateInstruction('ADC', 'Adds the parameters, plus the carry flag', generateFlags(true, 0, true, true));
generateSimpleArithmeticOpcodeSet(0x88, 'ADC');
generateOpcode(0xce, 'ADC', ['A', 'n8'], 8);

// ADD
generateInstruction('ADD', 'Adds the parameters', generateFlags(true, 0, true, true));
generateSimpleArithmeticOpcodeSet(0x80, 'ADD');
generateOpcode(0xc6, 'ADD', ['A', 'n8'], 8);

// AND
generateInstruction('AND', 'Bitwise AND between the parameters', generateFlags(true, 0, 1, 0));
generateSimpleArithmeticOpcodeSet(0xa0, 'AND');
generateOpcode(0xe6, 'AND', ['A', 'n8'], 8);

// BIT
generateInstruction('BIT', 'Test bit, set the zero flag if bit not set.', generateFlags(true, 0, 1, undefined));
generateNumberedCBOpcodeSet(0x40, 'BIT');

// CALL
generateInstruction('CALL', 'Calls address. Old address pushed onto the stack', generateFlags(true, 0, 1, undefined));
generateOpcode(0xc4, 'CALL', ['NZ', 'n16'], [24, 12]);
generateOpcode(0xd4, 'CALL', ['NC', 'n16'], [24, 12]);
generateOpcode(0xcc, 'CALL', ['Z', 'n16'], [24, 12]);
generateOpcode(0xdc, 'CALL', ['C', 'n16'], [24, 12]);
generateOpcode(0xcd, 'CALL', ['n16'], 24);

// CCF
generateInstruction('CCF', 'Complement Carry Flag', generateFlags(undefined, 0, 0, 'Complemented'));
generateOpcode(0x3f, 'CCF', [], 4);

// CP
generateInstruction(
  'CP',
  "Subtract the value, set flags accordingly, but don't store the result.",
  generateFlags(true, 1, 'Set if no borrow from bit 4.', 'Set if no borrow (set if r8 > A).')
);
generateSimpleArithmeticOpcodeSet(0xb8, 'CP');
generateOpcode(0xfe, 'CP', ['A', 'n8'], 8);

// CPL
generateInstruction('CPL', 'Complement accumulator.', generateFlags(undefined, 1, 1, undefined));
generateOpcode(0x2f, 'CPL', [], 4);

// DAA
generateInstruction(
  'DAA',
  'Decimal adjust register A (accumulator) to get a correct BCD representation after an arithmetic instruction.',
  generateFlags(true, undefined, true, 'Set or reset depending on the operation.')
);
generateOpcode(0x27, 'DAA', [], 4);

// DEC
generateInstruction('DEC', 'Decrement the value pointed by HL by 1.', generateFlags(true, 1, 'Set if no borrow from bit 4.', undefined));
generateOpcode(0x05, 'DEC', ['B'], 4);
generateOpcode(0x15, 'DEC', ['D'], 4);
generateOpcode(0x25, 'DEC', ['H'], 4);
generateOpcode(0x35, 'DEC', ['[HL]'], 12);
generateOpcode(0x0b, 'DEC', ['BC'], 8);
generateOpcode(0x1b, 'DEC', ['DE'], 8);
generateOpcode(0x2b, 'DEC', ['HL'], 8);
generateOpcode(0x3b, 'DEC', ['SP'], 8);
generateOpcode(0x0d, 'DEC', ['C'], 4);
generateOpcode(0x1d, 'DEC', ['E'], 4);
generateOpcode(0x2d, 'DEC', ['L'], 4);
generateOpcode(0x3d, 'DEC', ['A'], 4);

// DI
generateInstruction('DI', 'Disable interrupts', generateFlags(undefined, undefined, undefined, undefined));
generateOpcode(0xf3, 'DI', [], 4);

// EI
generateInstruction('EI', 'Enabled interrupts', generateFlags(undefined, undefined, undefined, undefined));
generateOpcode(0xfb, 'EI', [], 4);

// HALT
generateInstruction(
  'HALT',
  'Enter CPU low power mode. Or Double Speed mode for CGB',
  generateFlags(undefined, undefined, undefined, undefined)
);
generateOpcode(0x76, 'HALT', [], 4);

// INC
generateInstruction('INC', 'Increment value.', generateFlags(true, 0, true, undefined));
generateOpcode(0x03, 'INC', ['BC'], 8);
generateOpcode(0x13, 'INC', ['DE'], 8);
generateOpcode(0x23, 'INC', ['HL'], 8);
generateOpcode(0x33, 'INC', ['SP'], 8);
generateOpcode(0x04, 'INC', ['B'], 4);
generateOpcode(0x14, 'INC', ['D'], 4);
generateOpcode(0x24, 'INC', ['H'], 4);
generateOpcode(0x34, 'INC', ['[HL]'], 12);
generateOpcode(0x0c, 'INC', ['C'], 4);
generateOpcode(0x1c, 'INC', ['E'], 4);
generateOpcode(0x2c, 'INC', ['L'], 4);
generateOpcode(0x3c, 'INC', ['A'], 4);

// JP
generateInstruction('JP', 'Jump to address.', generateFlags(undefined, undefined, undefined, undefined));
generateOpcode(0xc2, 'JP', ['NZ', 'n16'], [16, 12]);
generateOpcode(0xd2, 'JP', ['NC', 'n16'], [16, 12]);
generateOpcode(0xca, 'JP', ['Z', 'n16'], [16, 12]);
generateOpcode(0xda, 'JP', ['C', 'n16'], [16, 12]);
generateOpcode(0xc3, 'JP', ['n16'], 16);
generateOpcode(0xe9, 'JP', ['[HL]'], 16);

// JR
generateInstruction('JR', 'Jump to address relative to the current address.', generateFlags(undefined, undefined, undefined, undefined));
generateOpcode(0x20, 'JR', ['NZ', 'n8'], [12, 8]);
generateOpcode(0x30, 'JR', ['NC', 'n8'], [12, 8]);
generateOpcode(0x28, 'JR', ['Z', 'n8'], [12, 8]);
generateOpcode(0x38, 'JR', ['C', 'n8'], [12, 8]);
generateOpcode(0x18, 'JR', ['n16'], 12);

// LD
generateInstruction('LD', 'Load value into destination.', generateFlags(undefined, undefined, undefined, undefined));
//TODO:

// NOP
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
// Left
generateInstruction('RL', 'Rotate value left through carry. (C <- [7 <- 0] <- C)', generateFlags(true, 0, 0, true));
generateInstruction('RLA', 'Rotate register A left through carry. (C <- [7 <- 0] <- C)', generateFlags(0, 0, 0, true));
generateInstruction('RLC', 'Rotate value left. (C <- [7 <- 0] <- [7])', generateFlags(true, 0, 0, true));
generateInstruction('RLCA', 'Rotate register A left. (C <- [7 <- 0] <- [7])', generateFlags(0, 0, 0, true));
// Right
generateInstruction('RR', 'Rotate value right through carry. (C -> [7 -> 0] -> C)', generateFlags(true, 0, 0, true));
generateInstruction('RRA', 'Rotate register A right through carry. (C -> [7 -> 0] -> C)', generateFlags(0, 0, 0, true));
generateInstruction('RRC', 'Rotate value right. (C -> [7 -> 0] -> [7])', generateFlags(true, 0, 0, true));
generateInstruction('RRCA', 'Rotate register A right. (C -> [7 -> 0] -> [7])', generateFlags(0, 0, 0, true));
generateInstruction('RST', 'Call restart vector.', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction(
  'SBC',
  'Subtract the value and the carry flag from A.',
  generateFlags(true, 1, 'Set if no borrow from bit 4.', 'Set if no borrow (set if r8 > A).')
);
generateInstruction('SCF', 'Set Carry Flag.', generateFlags(undefined, 0, 0, 1));
generateInstruction('SET', 'Set bit on value.', generateFlags(undefined, undefined, undefined, undefined));
generateInstruction('SLA', 'Shift left arithmetic. (C <- [7 <- 0] <- 0)', generateFlags(true, 0, 0, true));
generateInstruction('SRA', 'Shift right arithmetic. ([7] -> [7 -> 0] -> C)', generateFlags(true, 0, 0, true));
generateInstruction('SRL', 'Shift right logic. (0 -> [7 -> 0] -> C)', generateFlags(true, 0, 0, true));
generateInstruction(
  'STOP',
  'GB: Enter CPU Very Low Power Mode. GBC: Enter Double Speed Mode.',
  generateFlags(undefined, undefined, undefined)
);
generateInstruction(
  'SUB',
  'Subtract the values',
  generateFlags(true, 1, 'Set if no borrow from bit 4.', 'Set if no borrow (set if r8 > A).')
);
generateInstruction('SWAP', 'Swap upper 4 bits in the value with the lower ones.', generateFlags(true, 0, 0, 0));
generateInstruction('XOR', 'Bitwise XOR between the values.', generateFlags(true, 0, 0, 0));

console.log(instructions);
console.log(opcodes);
console.log(cbOpcodes);
console.log('test', instructions.ADC);
