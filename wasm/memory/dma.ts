import {
  Cpu
} from '../cpu/cpu';
import {
  Memory
} from './memory';
import {
  eightBitLoadFromGBMemoryWithTraps,
  eightBitLoadFromGBMemory
} from './load';
import {
  eightBitStoreIntoGBMemoryWithTraps,
  eightBitStoreIntoGBMemory
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

  for(let i: u16 = 0; i <= 0x9F; i++) {
    let spriteInformationByte: u8 = eightBitLoadFromGBMemory(sourceAddress + i);
    let spriteInformationAddress: u16 = Memory.spriteInformationTableLocation + i;
    eightBitStoreIntoGBMemory(spriteInformationAddress, spriteInformationByte);
  }

  // TCAGBD:  This copy (DMA) needs 160 × 4 + 4 clocks to complete in both double speed and single speeds modes
  // Increment all of our Cycle coiunters in ../cpu/opcodes
  Memory.DMACycles = 644;
}


// https://gist.github.com/drhelius/3394856
// http://bgb.bircd.org/pandocs.htm
export function startHdmaTransfer(hdmaTriggerByteToBeWritten: u8): void {

  // Check if we are Gbc
  if(!Cpu.GBCEnabled) {
    return;
  }

  // Check if we are trying to terminate an already active HBLANK HDMA
  if (Memory.isHblankHdmaActive && !checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {
    // Don't reset anything, just set bit 7 to 1 on the trigger byte
    Memory.isHblankHdmaActive = false;
    let hdmaTriggerByte = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaTrigger);
    eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, setBitOnByte(7, hdmaTriggerByte));
    return;
  }

  // Get our source and destination for the HDMA
  let hdmaSource: u16 = getHdmaSourceFromMemory();
  let hdmaDestination: u16 = getHdmaDestinationFromMemory();

  // Get the length from the trigger
  // Lower 7 bits, Add 1, times 16
  // https://gist.github.com/drhelius/3394856
  let transferLength: i32 = resetBitOnByte(7, hdmaTriggerByteToBeWritten);
  transferLength = (transferLength + 1) * 16;

  // Get bit 7 of the trigger for the HDMA type
  if (checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {

    // H-Blank DMA
    Memory.isHblankHdmaActive = true;
    Memory.hblankHdmaTransferLengthRemaining = transferLength;
    Memory.hblankHdmaSource = hdmaSource;
    Memory.hblankHdmaDestination = hdmaDestination;

    // This will be handled in updateHblankHdma()

    // Since we return false in write traps, we need to now write the byte
    // Be sure to reset bit 7, to show that the hdma is active
    eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, resetBitOnByte(7, hdmaTriggerByteToBeWritten));
  } else {

    // General DMA
    hdmaTransfer(hdmaSource, hdmaDestination, transferLength);

    // Stop the DMA
    eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, 0xFF);
  }
}

export function updateHblankHdma(): void {

  if(!Memory.isHblankHdmaActive) {
    return;
  }

  // Get our amount of bytes to transfer (Only 0x10 bytes at a time)
  let bytesToTransfer: i32 = 0x10;
  if (Memory.hblankHdmaTransferLengthRemaining < bytesToTransfer) {
    // Set to the difference
    bytesToTransfer = Memory.hblankHdmaTransferLengthRemaining;
  }

  // Do the transfer (Only 0x10 bytes at a time)
  hdmaTransfer(Memory.hblankHdmaSource, Memory.hblankHdmaDestination, bytesToTransfer);

  // Update our source and destination
  Memory.hblankHdmaSource += <u16>bytesToTransfer;
  Memory.hblankHdmaDestination += <u16>bytesToTransfer;
  Memory.hblankHdmaTransferLengthRemaining -= bytesToTransfer;

  if(Memory.hblankHdmaTransferLengthRemaining <= 0) {

    // End the transfer
    Memory.isHblankHdmaActive = false;

    // Need to clear the HDMA with 0xFF, which sets bit 7 to 1 to show the HDMA has ended
    eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, 0xFF);
  } else {
    // Set our new transfer length, make sure it is in the weird format,
    // and make sure bit 7 is 0, to show that the HDMA is Active
    let remainingTransferLength: i32 = Memory.hblankHdmaTransferLengthRemaining;
    let transferLengthAsByte: u8 = <u8>((remainingTransferLength / 16) - 1);
    eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, resetBitOnByte(7, transferLengthAsByte));
  }
}

// Simple Function to transfer the bytes from a destination to a source for a general pourpose or Hblank HDMA
function hdmaTransfer(hdmaSource: u16, hdmaDestination: u16, transferLength: i32): void {
  for(let i: u16 = 0; i < <u16>transferLength; i++) {
    let sourceByte: u8 = eightBitLoadFromGBMemoryWithTraps(hdmaSource + i);
    // get the hdmaDestination with wrapping
    // See issue #61: https://github.com/torch2424/wasmBoy/issues/61
    let hdmaDestinationWithWrapping = hdmaDestination + i;
    while (hdmaDestinationWithWrapping > 0x9FFF) {
      // Simply clear the top 3 bits
      hdmaDestinationWithWrapping = (hdmaDestinationWithWrapping - 0x2000);
    }
    eightBitStoreIntoGBMemoryWithTraps(hdmaDestinationWithWrapping, sourceByte);
  }

  // Set our Cycles used for the HDMA
  // Since DMA in GBC Double Speed Mode takes 80 micro seconds,
  // And HDMA takes 8 micro seconds per 0x10 bytes in GBC Double Speed mode (and GBC Normal Mode)
  // Will assume (644 / 10) cycles for GBC Double Speed Mode,
  // and (644 / 10 / 2) for GBC Normal Mode
  let hdmaCycles: i32 = 32;
  if(Cpu.GBCDoubleSpeed) {
    hdmaCycles = 64;
  }
  hdmaCycles = hdmaCycles * (transferLength / 0x10);
  Memory.DMACycles += hdmaCycles;
}

// Function to get our HDMA Source
// Follows the poan docs
function getHdmaSourceFromMemory(): u16 {
  // Get our source for the HDMA
  let hdmaSourceHigh: u8 = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceHigh);
  let hdmaSourceLow: u8 = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceLow);

  let hdmaSource: u16 = concatenateBytes(hdmaSourceHigh, hdmaSourceLow);

  // And off the appopriate bits for the source and destination
  // And off the bottom 4 bits
  hdmaSource = (hdmaSource & 0xFFF0);

  return hdmaSource;
}

// Function to get our HDMA Destination
// Follows the poan docs
function getHdmaDestinationFromMemory(): u16 {
  let hdmaDestinationHigh: u8 = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationHigh);
  let hdmaDestinationLow: u8 = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationLow);

  let hdmaDestination: u16 = concatenateBytes(hdmaDestinationHigh, hdmaDestinationLow);

  // Can only be in VRAM, 0x8000 -> 0x9FF0
  // Pan docs says to knock off upper 3 bits, and lower 4 bits
  // Which gives us: 0001111111110000 or 0x1FF0
  // Meaning we must add 0x8000
  hdmaDestination = (hdmaDestination & 0x1FF0);
  hdmaDestination += Memory.videoRamLocation;

  return hdmaDestination;
}
