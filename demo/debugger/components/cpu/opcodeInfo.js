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

  if (typeof flag === 'boolean') {
    flag.shorthand = symbol;
    if (symbol === 'Z') {
      flag.description = 'Set if result is 0';
    } else if (symbol === 'N') {
      flag.description = 'Usually set by the operation itself';
    } else if (symbol === 'H') {
      flag.description = 'Set if overflow from bit 3.';
    } else if (symbol === 'C') {
      flag.description = 'Set if overflow from bit 7.';
    }

    return flag;
  }
};

const generateFlags = (zeroFlag, subtractFlag, halfCarryFlag, carryFlag) => {
  const flags = [getFlag(zeroFlag, 'Z'), getFlag(subtractFlag, 'N'), getFlag(halfCarryFlag, 'H'), getFlag(carryFlag, 'C')];
};

generateInstruction('ADC', 'Adds the parameters, plus the carry flag', generateFlags(true, 0, true, true));
