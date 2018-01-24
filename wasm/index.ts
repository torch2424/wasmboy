/***********************
    Registers
***********************/

// 8-bit registers
let registerA: u8 = 0,
    registerB: u8 = 0,
    registerC: u8 = 0,
    registerD: u8 = 0,
    registerE: u8 = 0,
    registerH: u8 = 0,
    registerL: u8 = 0,
    registerF: u8 = 0;

// 16-bit registers
let programCounter: u16 = 0;
let stackPointer: u16 = 0;

// Grouped registers
// possible overload these later to performace actions
function registerAF(): void {

}


function registerBC(): void {

}

function registerDE(): void {

}

function registerHL(): void {

}


/***********************
    Memory
***********************/

// Not Exportable by Assemblyscript?


/***********************
    Decode Opcodes
***********************/

// Take in any opcode, and decode it
export function handleOpcode(opcode: u8): boolean {
  switch(opcode) {
    case 10:
      break;
    default:
      // Return false, error handling the opcode
      return false;
  }

  // Reutrn true, opcode is handled correctly!
  return true;
}


// Testing code below: //

// https://github.com/AssemblyScript/assemblyscript/wiki/Built-in-functions

// Global variable bound to module
let test: u32;

// Export a funciton to initialize the module variables
export function init(passedVar: u32): void {
  test = passedVar;
}

// Funny function to just text storing memory
export function storeTest(): u32 {
  // store the value test, with 0 offset from the first word of memory?
  store<u32>(0, test);
  return test + 10;
}

// Funny function to just text loading memory
export function loadTest(): u32 {
  // load the value test, in memory location 1 of the index.
  // 1 in index = 4 bytes. Because, our memory is divided into unsigned 32 bit (4 bytes) integers.
  return load<u32>(4);
}
