import {
  Cpu
} from '../cpu/index';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemorySkipTraps,
  sixteenBitStoreIntoGBMemorySkipTraps
} from '../memory/index';
import {
  consoleLogTwo,
  setBitOnByte,
  resetBitOnByte,
  checkBitOnByte
} from '../helpers/index';

class Interrupts {
  static memoryLocationInterruptEnabled: u16 = 0xFFFF;
  static memoryLocationInterruptRequest: u16 = 0xFF0F; // A.K.A interrupt Flag (IF)

  static masterInterruptSwitch: boolean = false;
  // According to mooneye, interrupts are not handled until AFTER
  // Next instruction
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown
  static masterInterruptSwitchDelay: boolean = false;

  static bitPositionVBlankInterrupt: u8 = 0;
  static bitPositionLcdInterrupt: u8 = 1;
  static bitPositionTimerInterrupt: u8 = 2;
  static bitPositionJoypadInterrupt: u8 = 4;
}

function _handleInterrupt(bitPosition: u8): void {

  // Disable the master switch
  setInterrupts(false);

  // Disable the bit on the interruptRequest
  let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);
  interruptRequest = resetBitOnByte(bitPosition, interruptRequest);
  eightBitStoreIntoGBMemorySkipTraps(Interrupts.memoryLocationInterruptRequest, interruptRequest);

  // Push the programCounter onto the stacks
  Cpu.stackPointer = Cpu.stackPointer - 2;
  sixteenBitStoreIntoGBMemorySkipTraps(Cpu.stackPointer, Cpu.programCounter);

  // Jump to the correct interrupt location
  // http://www.codeslinger.co.uk/pages/projects/gameboy/interupts.html
  if (bitPosition === Interrupts.bitPositionVBlankInterrupt) {
    Cpu.programCounter = 0x40;
  } else if(bitPosition === Interrupts.bitPositionLcdInterrupt) {
    Cpu.programCounter = 0x48;
  } else if(bitPosition === Interrupts.bitPositionTimerInterrupt) {
    Cpu.programCounter = 0x50;
  } else {
    // JoyPad
    Cpu.programCounter = 0x60;
  }

  // If the CPU was halted, now is the time to un-halt
  // Should be done here when the jump occurs according to:
  // https://www.reddit.com/r/EmuDev/comments/6fmjch/gb_glitches_in_links_awakening_and_pok%C3%A9mon_gold/
  Cpu.isHalted = false;
}

function _requestInterrupt(bitPosition: u8): void {

  let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);

  // Pass to set the correct interrupt bit on interruptRequest
  interruptRequest = setBitOnByte(bitPosition, interruptRequest);

  eightBitStoreIntoGBMemorySkipTraps(Interrupts.memoryLocationInterruptRequest, interruptRequest);
}

export function setInterrupts(value: boolean): void {
  Interrupts.masterInterruptSwitch = value;
}

// Helper function to check if interrupts are enabled
export function areInterruptsEnabled(): boolean {
  return Interrupts.masterInterruptSwitch;
}

// Useful fo determining the HALT bug
export function areInterruptsPending(): boolean {
  let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);
  let interruptEnabled = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptEnabled);

  if((interruptRequest & interruptEnabled) !== 0) {
    return true;
  } else {
    return false;
  }
}

// Helper function to get if interrupts are pending but the switch is not set

export function checkInterrupts(): i8 {

  // Boolean to track if interrupts were handled
  // Interrupt handling requires 20 cycles
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
  let wasInterruptHandled: boolean = false;

  if(Interrupts.masterInterruptSwitch) {

    let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);
    let interruptEnabled = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptEnabled);

    if(interruptRequest > 0) {

      // Check our interrupts
      if (checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, interruptRequest) &&
        checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, interruptEnabled)) {

        _handleInterrupt(Interrupts.bitPositionVBlankInterrupt);
        wasInterruptHandled = true;
      } else if (checkBitOnByte(Interrupts.bitPositionLcdInterrupt, interruptRequest) &&
        checkBitOnByte(Interrupts.bitPositionLcdInterrupt, interruptEnabled)) {

          _handleInterrupt(Interrupts.bitPositionLcdInterrupt);
          wasInterruptHandled = true;
      } else if (checkBitOnByte(Interrupts.bitPositionTimerInterrupt, interruptRequest) &&
        checkBitOnByte(Interrupts.bitPositionTimerInterrupt, interruptEnabled)) {

          _handleInterrupt(Interrupts.bitPositionTimerInterrupt);
          wasInterruptHandled = true;
      } else if (checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, interruptRequest) &&
        checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, interruptEnabled)) {

          _handleInterrupt(Interrupts.bitPositionJoypadInterrupt);
          wasInterruptHandled = true;
      }
    }
  }

  // Interrupt handling requires 20 cycles
  if(wasInterruptHandled) {
    return 20;
  } else {
    return 0;
  }
}

export function requestVBlankInterrupt(): void {
  _requestInterrupt(Interrupts.bitPositionVBlankInterrupt);
}

export function requestLcdInterrupt(): void {
  _requestInterrupt(Interrupts.bitPositionLcdInterrupt);
}

export function requestTimerInterrupt(): void {
  _requestInterrupt(Interrupts.bitPositionTimerInterrupt);
}

export function requestJoypadInterrupt(): void {
  _requestInterrupt(Interrupts.bitPositionJoypadInterrupt);
}
