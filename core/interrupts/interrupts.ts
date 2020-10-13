import { Cpu } from '../cpu/index';
import { getSaveStateMemoryOffset } from '../core';
import {
  eightBitLoadFromGBMemory,
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  loadBooleanDirectlyFromWasmMemory,
  storeBooleanDirectlyToWasmMemory
} from '../memory/index';
import { setBitOnByte, resetBitOnByte, checkBitOnByte } from '../helpers/index';

export class Interrupts {
  static masterInterruptSwitch: boolean = false;
  // According to mooneye, interrupts are not handled until AFTER
  // Next instruction
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown
  static masterInterruptSwitchDelay: boolean = false;

  // Biut position for each part of the interrupts HW registers
  static readonly bitPositionVBlankInterrupt: i32 = 0;
  static readonly bitPositionLcdInterrupt: i32 = 1;
  static readonly bitPositionTimerInterrupt: i32 = 2;
  static readonly bitPositionSerialInterrupt: i32 = 3;
  static readonly bitPositionJoypadInterrupt: i32 = 4;

  static readonly memoryLocationInterruptEnabled: i32 = 0xffff; // A.K.A interrupt Flag (IE)
  // Cache which Interrupts are enabled
  static interruptsEnabledValue: i32 = 0;
  static isVBlankInterruptEnabled: boolean = false;
  static isLcdInterruptEnabled: boolean = false;
  static isTimerInterruptEnabled: boolean = false;
  static isSerialInterruptEnabled: boolean = false;
  static isJoypadInterruptEnabled: boolean = false;
  static updateInterruptEnabled(value: i32): void {
    Interrupts.isVBlankInterruptEnabled = checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, value);
    Interrupts.isLcdInterruptEnabled = checkBitOnByte(Interrupts.bitPositionLcdInterrupt, value);
    Interrupts.isTimerInterruptEnabled = checkBitOnByte(Interrupts.bitPositionTimerInterrupt, value);
    Interrupts.isSerialInterruptEnabled = checkBitOnByte(Interrupts.bitPositionSerialInterrupt, value);
    Interrupts.isJoypadInterruptEnabled = checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, value);

    Interrupts.interruptsEnabledValue = value;
  }

  static readonly memoryLocationInterruptRequest: i32 = 0xff0f; // A.K.A interrupt Flag (IF)
  // Cache which Interrupts are requested
  static interruptsRequestedValue: i32 = 0;
  static isVBlankInterruptRequested: boolean = false;
  static isLcdInterruptRequested: boolean = false;
  static isTimerInterruptRequested: boolean = false;
  static isSerialInterruptRequested: boolean = false;
  static isJoypadInterruptRequested: boolean = false;
  static updateInterruptRequested(value: i32): void {
    Interrupts.isVBlankInterruptRequested = checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, value);
    Interrupts.isLcdInterruptRequested = checkBitOnByte(Interrupts.bitPositionLcdInterrupt, value);
    Interrupts.isTimerInterruptRequested = checkBitOnByte(Interrupts.bitPositionTimerInterrupt, value);
    Interrupts.isSerialInterruptRequested = checkBitOnByte(Interrupts.bitPositionSerialInterrupt, value);
    Interrupts.isJoypadInterruptRequested = checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, value);

    Interrupts.interruptsRequestedValue = value;
  }

  // Function to return if we have any pending interrupts
  static areInterruptsPending(): boolean {
    return (Interrupts.interruptsRequestedValue & Interrupts.interruptsEnabledValue & 0x1f) > 0;
  }

  // Save States
  static readonly saveStateSlot: i32 = 2;

  // Function to save the state of the class
  static saveState(): void {
    // Interrupt Master Interrupt Switch
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Interrupts.saveStateSlot), Interrupts.masterInterruptSwitch);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x01, Interrupts.saveStateSlot), Interrupts.masterInterruptSwitchDelay);

    // Interrupt Enabled
    store<u8>(getSaveStateMemoryOffset(0x10, Interrupts.saveStateSlot), <u8>Interrupts.interruptsEnabledValue);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Interrupts.saveStateSlot), Interrupts.isVBlankInterruptEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x12, Interrupts.saveStateSlot), Interrupts.isLcdInterruptEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x13, Interrupts.saveStateSlot), Interrupts.isTimerInterruptEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x14, Interrupts.saveStateSlot), Interrupts.isSerialInterruptEnabled);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x15, Interrupts.saveStateSlot), Interrupts.isJoypadInterruptEnabled);

    // Interrupt Request
    store<u8>(getSaveStateMemoryOffset(0x20, Interrupts.saveStateSlot), <u8>Interrupts.interruptsRequestedValue);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x21, Interrupts.saveStateSlot), Interrupts.isVBlankInterruptRequested);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x22, Interrupts.saveStateSlot), Interrupts.isLcdInterruptRequested);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x23, Interrupts.saveStateSlot), Interrupts.isTimerInterruptRequested);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x24, Interrupts.saveStateSlot), Interrupts.isSerialInterruptRequested);
    storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x25, Interrupts.saveStateSlot), Interrupts.isJoypadInterruptRequested);
  }

  // Function to load the save state from memory
  static loadState(): void {
    // Interrupt Master Interrupt Switch
    Interrupts.masterInterruptSwitch = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Interrupts.saveStateSlot));
    Interrupts.masterInterruptSwitchDelay = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x01, Interrupts.saveStateSlot));

    // Interrupt Enabled
    Interrupts.interruptsEnabledValue = load<u8>(getSaveStateMemoryOffset(0x10, Interrupts.saveStateSlot));
    Interrupts.isVBlankInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Interrupts.saveStateSlot));
    Interrupts.isLcdInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x12, Interrupts.saveStateSlot));
    Interrupts.isTimerInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x13, Interrupts.saveStateSlot));
    Interrupts.isSerialInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x14, Interrupts.saveStateSlot));
    Interrupts.isJoypadInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x15, Interrupts.saveStateSlot));

    // Interrupt Request
    Interrupts.interruptsRequestedValue = load<u8>(getSaveStateMemoryOffset(0x20, Interrupts.saveStateSlot));
    Interrupts.isVBlankInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x21, Interrupts.saveStateSlot));
    Interrupts.isLcdInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x22, Interrupts.saveStateSlot));
    Interrupts.isTimerInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x23, Interrupts.saveStateSlot));
    Interrupts.isSerialInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x24, Interrupts.saveStateSlot));
    Interrupts.isJoypadInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x25, Interrupts.saveStateSlot));
  }
}

// Inlined because closure compiler inlines
export function initializeInterrupts(): void {
  // Values from BGB

  // IE
  Interrupts.updateInterruptEnabled(0x00);
  eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptEnabled, Interrupts.interruptsEnabledValue);

  // IF
  Interrupts.updateInterruptRequested(0xe1);
  eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, Interrupts.interruptsRequestedValue);
}

// NOTE: Interrupts should be handled before reading an opcode
// Inlined because closure compiler inlines
export function checkInterrupts(): i32 {
  // First check for our delay was enabled
  if (Interrupts.masterInterruptSwitchDelay) {
    Interrupts.masterInterruptSwitch = true;
    Interrupts.masterInterruptSwitchDelay = false;
  }

  // Check if we have an enabled and requested interrupt
  let isAnInterruptRequestedAndEnabledValue: i32 = Interrupts.interruptsEnabledValue & Interrupts.interruptsRequestedValue & 0x1f;

  if (isAnInterruptRequestedAndEnabledValue > 0) {
    // Boolean to track if interrupts were handled
    // Interrupt handling requires 20 cycles
    // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
    let wasInterruptHandled: boolean = false;

    // Service our interrupts, if we have the master switch enabled
    // https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/
    if (Interrupts.masterInterruptSwitch && !Cpu.isHaltNoJump) {
      if (Interrupts.isVBlankInterruptEnabled && Interrupts.isVBlankInterruptRequested) {
        _handleInterrupt(Interrupts.bitPositionVBlankInterrupt);
        wasInterruptHandled = true;
      } else if (Interrupts.isLcdInterruptEnabled && Interrupts.isLcdInterruptRequested) {
        _handleInterrupt(Interrupts.bitPositionLcdInterrupt);
        wasInterruptHandled = true;
      } else if (Interrupts.isTimerInterruptEnabled && Interrupts.isTimerInterruptRequested) {
        _handleInterrupt(Interrupts.bitPositionTimerInterrupt);
        wasInterruptHandled = true;
      } else if (Interrupts.isSerialInterruptEnabled && Interrupts.isSerialInterruptRequested) {
        _handleInterrupt(Interrupts.bitPositionSerialInterrupt);
        wasInterruptHandled = true;
      } else if (Interrupts.isJoypadInterruptEnabled && Interrupts.isJoypadInterruptRequested) {
        _handleInterrupt(Interrupts.bitPositionJoypadInterrupt);
        wasInterruptHandled = true;
      }
    }

    let interuptHandlerCycles: i32 = 0;
    if (wasInterruptHandled) {
      // Interrupt handling requires 20 cycles, TCAGBD
      interuptHandlerCycles = 20;
      if (Cpu.isHalted()) {
        // If the CPU was halted, now is the time to un-halt
        // Should be done here when the jump occurs according to:
        // https://www.reddit.com/r/EmuDev/comments/6fmjch/gb_glitches_in_links_awakening_and_pok%C3%A9mon_gold/
        Cpu.exitHaltAndStop();
        interuptHandlerCycles += 4;
      }
    }

    if (Cpu.isHalted()) {
      Cpu.exitHaltAndStop();
    }

    return interuptHandlerCycles;
  }

  return 0;
}

function _handleInterrupt(bitPosition: i32): void {
  // Disable the master switch
  setInterrupts(false);

  // Disable the bit on the interruptRequest
  let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);
  interruptRequest = resetBitOnByte(bitPosition, interruptRequest);
  Interrupts.interruptsRequestedValue = interruptRequest;
  eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, interruptRequest);

  // Push the programCounter onto the stacks
  // Push the next instruction, not the halt itself (TCAGBD).
  Cpu.stackPointer = Cpu.stackPointer - 2;
  if (Cpu.isHalted()) {
    // TODO: This breaks Pokemon Yellow, And OG Link's awakening. Find out why...
    // sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
  } else {
    sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
  }

  // Jump to the correct interrupt location
  // Also piggyback off of the switch to reset our HW Register caching
  // http://www.codeslinger.co.uk/pages/projects/gameboy/interupts.html
  switch (bitPosition) {
    case Interrupts.bitPositionVBlankInterrupt:
      Interrupts.isVBlankInterruptRequested = false;
      Cpu.programCounter = 0x40;
      break;
    case Interrupts.bitPositionLcdInterrupt:
      Interrupts.isLcdInterruptRequested = false;
      Cpu.programCounter = 0x48;
      break;
    case Interrupts.bitPositionTimerInterrupt:
      Interrupts.isTimerInterruptRequested = false;
      Cpu.programCounter = 0x50;
      break;
    case Interrupts.bitPositionSerialInterrupt:
      Interrupts.isSerialInterruptRequested = false;
      Cpu.programCounter = 0x58;
      break;
    case Interrupts.bitPositionJoypadInterrupt:
      Interrupts.isJoypadInterruptRequested = false;
      Cpu.programCounter = 0x60;
      break;
  }
}

function _requestInterrupt(bitPosition: i32): void {
  let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);

  // Pass to set the correct interrupt bit on interruptRequest
  interruptRequest = setBitOnByte(bitPosition, interruptRequest);

  Interrupts.interruptsRequestedValue = interruptRequest;

  eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, interruptRequest);
}

export function setInterrupts(value: boolean): void {
  // If we are enabling interrupts,
  // we want to wait 4 cycles before enabling
  if (value) {
    Interrupts.masterInterruptSwitchDelay = true;
  } else {
    Interrupts.masterInterruptSwitch = false;
  }
}

// Inlined because closure compiler inlines
export function requestVBlankInterrupt(): void {
  Interrupts.isVBlankInterruptRequested = true;
  _requestInterrupt(Interrupts.bitPositionVBlankInterrupt);
}

// Inlined because closure compiler inlines
export function requestLcdInterrupt(): void {
  Interrupts.isLcdInterruptRequested = true;
  _requestInterrupt(Interrupts.bitPositionLcdInterrupt);
}

// Inlined because closure compiler inlines
export function requestTimerInterrupt(): void {
  Interrupts.isTimerInterruptRequested = true;
  _requestInterrupt(Interrupts.bitPositionTimerInterrupt);
}

// Inlined because closure compiler inlines
export function requestJoypadInterrupt(): void {
  Interrupts.isJoypadInterruptRequested = true;
  _requestInterrupt(Interrupts.bitPositionJoypadInterrupt);
}

// Inlined because closure compiler inlines
export function requestSerialInterrupt(): void {
  Interrupts.isSerialInterruptRequested = true;
  _requestInterrupt(Interrupts.bitPositionSerialInterrupt);
}
