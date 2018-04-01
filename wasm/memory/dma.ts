import {
  Cpu
} from '../cpu/cpu';
import {
  Memory
} from './memory';
import {
  eightBitLoadFromGBMemory,
  eightBitLoadFromGBMemorySkipTraps
} from './load';
import {
  eightBitStoreIntoGBMemory,
  eightBitStoreIntoGBMemorySkipTraps
} from './store';
import {
  concatenateBytes,
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte,
  hexLog
} from '../helpers/index';

export function startDmaTransfer(sourceAddressOffset: u8): void {

  let sourceAddress: u16 = <u16>sourceAddressOffset;
  sourceAddress = (sourceAddress << 8);

  for(let i: u16 = 0; i < 0xA0; i++) {
    let spriteInformationByte: u8 = eightBitLoadFromGBMemorySkipTraps(sourceAddress + i);
    let spriteInformationAddress: u16 = Memory.spriteInformationTableLocation + i;
    eightBitStoreIntoGBMemorySkipTraps(spriteInformationAddress, spriteInformationByte);
  }

  // TCAGBD:  This copy (DMA) needs 160 × 4 + 4 clocks to complete in both double speed and single speeds modes
  // Increment all of our Cycle coiunters in ../cpu/opcodes
  Memory.DMACycles += 644;
}


// https://gist.github.com/drhelius/3394856
// http://bgb.bircd.org/pandocs.htm
export function startHdmaTransfer(hdmaTriggerByteToBeWritten: u8): void {

  // Check if we are Gbc
  if(!Cpu.GBCEnabled) {
    return;
  }

  // Check if we are trying to terminate an already active HBLANK HDMA
  // TODO: Pokemon crystal is cancelling it's HDMAs, investigate
  if (Memory.isHblankHdmaActive && !checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {
    Memory.isHblankHdmaActive = false;
    Memory.hblankHdmaIndex = 0x00;
    Memory.hblankHdmaTotalBytes = 0x00;
    Memory.hblankHdmaSource = 0x00;
    Memory.hblankHdmaDestination = 0x00;
    eightBitStoreIntoGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger, 0xFF);
    return;
  }

  // Get our source and destination for the HDMA
  let hdmaSource: u16 = getHdmaSource();
  let hdmaDestination: u16 = getHdmaDestination();

  // Get the length from the trigger
  // Lower 7 bits, Add 1, times 16
  // https://gist.github.com/drhelius/3394856
  let transferLength: i32 = resetBitOnByte(7, hdmaTriggerByteToBeWritten);
  transferLength = (transferLength + 1) * 16;

  // Get bit 7 of the trigger for the HDMA type
  if (checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {

    // H-Blank DMA
    Memory.isHblankHdmaActive = true;
    Memory.hblankHdmaIndex = 0x00;
    Memory.hblankHdmaTotalBytes = transferLength;
    Memory.hblankHdmaSource = hdmaSource;
    Memory.hblankHdmaDestination = hdmaDestination;

    // This will be handled in updateHblankHdma()

    // Since we return false in write traps, we need to now write the byte
    eightBitStoreIntoGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger, hdmaTriggerByteToBeWritten);
  } else {

    // General DMA
    hdmaTransfer(hdmaSource, hdmaDestination, transferLength);

    // Stop the DMA
    eightBitStoreIntoGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger, 0xFF);

    // Set our Cycles used for the HDMA
    // Since DMA in GBC Double Speed Mode takes 80 micro seconds,
    // And HDMA takes 8 micro seconds in GBC Double Speed mode (and GBC Normal Mode)
    // Will assume (644 / 10) cycles for GBC Double Speed Mode,
    // and (644 / 10 / 2) for GBC Normal Mode
    if(Cpu.GBCDoubleSpeed) {
      Memory.DMACycles += 64;
    } else {
      Memory.DMACycles += 32;
    }
  }
}

export function updateHblankHdma(): void {

  if(!Memory.isHblankHdmaActive) {
    return;
  }

  // Get our source and destination for the HDMA
  let hdmaSource: u16 = getHdmaSource();
  let hdmaDestination: u16 = getHdmaDestination();

  // Get our amount of bytes to transfer (Only 0x10 bytes at a time)
  let bytesToTransfer: i32 = 0x10;
  if (Memory.hblankHdmaIndex + bytesToTransfer > Memory.hblankHdmaTotalBytes) {
    // Set to the difference
    bytesToTransfer = Memory.hblankHdmaTotalBytes - Memory.hblankHdmaIndex;
  }

  // Do the transfer (Only 0x10 bytes at a time)
  hdmaTransfer(hdmaSource + <u16>Memory.hblankHdmaIndex, hdmaDestination + <u16>Memory.hblankHdmaIndex, bytesToTransfer);

  // Increase our transfer index
  Memory.hblankHdmaIndex += bytesToTransfer;

  if(Memory.hblankHdmaIndex >= Memory.hblankHdmaTotalBytes) {

    //hexLog(hdmaSource, hdmaDestination, Memory.hblankHdmaIndex, Memory.hblankHdmaTotalBytes);

    // End the transfer
    Memory.isHblankHdmaActive = false;
    Memory.hblankHdmaIndex = 0x00;
    Memory.hblankHdmaTotalBytes = 0x00;
    Memory.hblankHdmaSource = 0x00;
    Memory.hblankHdmaDestination = 0x00;

    eightBitStoreIntoGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger, 0xFF);
  } else {
    // Set our new transfer length, make sure it is in the weird format, and make sure bit 7 is still 1
    let remainingTransferLength: i32 = Memory.hblankHdmaTotalBytes - Memory.hblankHdmaIndex;
    let transferLengthAsByte: u8 = <u8>((remainingTransferLength / 16) - 1);
    eightBitStoreIntoGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger, setBitOnByte(7, transferLengthAsByte));
  }
}

// Simple Function to transfer the bytes from a destination to a source for a general pourpose or Hblank HDMA
function hdmaTransfer(hdmaSource: u16, hdmaDestination: u16, transferLength: i32): void {
  for(let i: u16 = 0; i < <u16>transferLength; i++) {
    let sourceByte: u8 = eightBitLoadFromGBMemory(hdmaSource + i);
    eightBitStoreIntoGBMemory(hdmaDestination + i, sourceByte);
  }
}

// Function to get our HDMA Source
// Follows the poan docs
function getHdmaSource(): u16 {
  // Get our source for the HDMA
  let hdmaSourceHigh: u8 = eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaSourceHigh);
  let hdmaSourceLow: u8 = eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaSourceLow);

  let hdmaSource: u16 = concatenateBytes(hdmaSourceHigh, hdmaSourceLow);

  // And off the appopriate bits for the source and destination
  // And off the bottom 4 bits
  hdmaSource = (hdmaSource & 0xFFF0);

  // Also cache the result
  Memory.hblankHdmaSource = hdmaSource;

  return hdmaSource;
}

// Function to get our HDMA Destination
// Follows the poan docs
function getHdmaDestination(): u16 {
  let hdmaDestinationHigh: u8 = eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaDestinationHigh);
  let hdmaDestinationLow: u8 = eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaDestinationLow);

  let hdmaDestination: u16 = concatenateBytes(hdmaDestinationHigh, hdmaDestinationLow);

  // Can only be in VRAM, 0x8000 -> 0x9FF0
  // Pan docs says to knock off upper 3 bits, and lower 4 bits
  // Which gives us: 0001111111110000 or 0x1FF0
  // Meaning we must add 0x8000
  hdmaDestination = (hdmaDestination & 0x1FF0);
  hdmaDestination += Memory.videoRamLocation;

  // Also cache the result
  Memory.hblankHdmaDestination = hdmaDestination;

  return hdmaDestination;
}
