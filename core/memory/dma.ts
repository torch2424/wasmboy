import { Cpu } from '../cpu/index';
import { Memory } from './memory';
import { eightBitLoadFromGBMemoryWithTraps, eightBitLoadFromGBMemory } from './load';
import { eightBitStoreIntoGBMemoryWithTraps, eightBitStoreIntoGBMemory } from './store';
import { concatenateBytes, checkBitOnByte, setBitOnByte, resetBitOnByte } from '../helpers/index';

// Inlined because closure compiler inlines
export function initializeDma(): void {
  if (Cpu.GBCEnabled) {
    // GBC DMA
    eightBitStoreIntoGBMemory(0xff51, 0xff);
    eightBitStoreIntoGBMemory(0xff52, 0xff);
    eightBitStoreIntoGBMemory(0xff53, 0xff);
    eightBitStoreIntoGBMemory(0xff54, 0xff);
    eightBitStoreIntoGBMemory(0xff55, 0xff);
  } else {
    // GB DMA
    eightBitStoreIntoGBMemory(0xff51, 0xff);
    eightBitStoreIntoGBMemory(0xff52, 0xff);
    eightBitStoreIntoGBMemory(0xff53, 0xff);
    eightBitStoreIntoGBMemory(0xff54, 0xff);
    eightBitStoreIntoGBMemory(0xff55, 0xff);
  }
}

// Inlined because closure compiler inlines
export function startDmaTransfer(sourceAddressOffset: i32): void {
  let sourceAddress = sourceAddressOffset << 8;
  for (let i = 0; i <= 0x9f; ++i) {
    let spriteInformationByte = eightBitLoadFromGBMemory(sourceAddress + i);
    let spriteInformationAddress = Memory.spriteInformationTableLocation + i;
    eightBitStoreIntoGBMemory(spriteInformationAddress, spriteInformationByte);
  }

  // TCAGBD:  This copy (DMA) needs 160 × 4 + 4 clocks to complete in both double speed and single speeds modes
  // Increment all of our Cycle coiunters in ../cpu/opcodes
  Memory.DMACycles = 644;
}

// https://gist.github.com/drhelius/3394856
// http://bgb.bircd.org/pandocs.htm
// Inlined because closure compiler inlines
export function startHdmaTransfer(hdmaTriggerByteToBeWritten: i32): void {
  // Check if we are Gbc
  if (!Cpu.GBCEnabled) {
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
  let hdmaSource = getHdmaSourceFromMemory();
  let hdmaDestination = getHdmaDestinationFromMemory();

  // Get the length from the trigger
  // Lower 7 bits, Add 1, times 16
  // https://gist.github.com/drhelius/3394856
  let transferLength = resetBitOnByte(7, hdmaTriggerByteToBeWritten);
  transferLength = (transferLength + 1) << 4;

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
    eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, 0xff);
  }
}

// Inlined because closure compiler inlines
export function updateHblankHdma(): void {
  if (!Memory.isHblankHdmaActive) {
    return;
  }

  // Get our amount of bytes to transfer (Only 0x10 bytes at a time)
  let bytesToTransfer = 0x10;
  let hblankHdmaTransferLengthRemaining = Memory.hblankHdmaTransferLengthRemaining;
  if (hblankHdmaTransferLengthRemaining < bytesToTransfer) {
    // Set to the difference
    bytesToTransfer = hblankHdmaTransferLengthRemaining;
  }

  // Do the transfer (Only 0x10 bytes at a time)
  hdmaTransfer(Memory.hblankHdmaSource, Memory.hblankHdmaDestination, bytesToTransfer);

  // Update our source and destination
  Memory.hblankHdmaSource += bytesToTransfer;
  Memory.hblankHdmaDestination += bytesToTransfer;
  hblankHdmaTransferLengthRemaining -= bytesToTransfer;
  Memory.hblankHdmaTransferLengthRemaining = hblankHdmaTransferLengthRemaining;

  let memoryLocationHdmaTrigger = Memory.memoryLocationHdmaTrigger;
  if (hblankHdmaTransferLengthRemaining <= 0) {
    // End the transfer
    Memory.isHblankHdmaActive = false;
    // Need to clear the HDMA with 0xFF, which sets bit 7 to 1 to show the HDMA has ended
    eightBitStoreIntoGBMemory(memoryLocationHdmaTrigger, 0xff);
  } else {
    // Set our new transfer length, make sure it is in the weird format,
    // and make sure bit 7 is 0, to show that the HDMA is Active
    let remainingTransferLength = hblankHdmaTransferLengthRemaining;
    let transferLengthAsByte = (remainingTransferLength >> 4) - 1;
    eightBitStoreIntoGBMemory(memoryLocationHdmaTrigger, resetBitOnByte(7, transferLengthAsByte));
  }
}

// Simple Function to transfer the bytes from a destination to a source for a general pourpose or Hblank HDMA
function hdmaTransfer(hdmaSource: i32, hdmaDestination: i32, transferLength: i32): void {
  for (let i = 0; i < transferLength; ++i) {
    let sourceByte = eightBitLoadFromGBMemoryWithTraps(hdmaSource + i);
    // get the hdmaDestination with wrapping
    // See issue #61: https://github.com/torch2424/wasmBoy/issues/61
    let hdmaDestinationWithWrapping = hdmaDestination + i;
    while (hdmaDestinationWithWrapping > 0x9fff) {
      // Simply clear the top 3 bits
      hdmaDestinationWithWrapping -= 0x2000;
    }
    eightBitStoreIntoGBMemoryWithTraps(hdmaDestinationWithWrapping, sourceByte);
  }

  // Set our Cycles used for the HDMA
  // Since DMA in GBC Double Speed Mode takes 80 micro seconds,
  // And HDMA takes 8 micro seconds per 0x10 bytes in GBC Double Speed mode (and GBC Normal Mode)
  // Will assume (644 / 10) cycles for GBC Double Speed Mode,
  // and (644 / 10 / 2) for GBC Normal Mode
  let hdmaCycles = 32 << (<i32>Cpu.GBCDoubleSpeed);
  hdmaCycles = hdmaCycles * (transferLength >> 4);
  Memory.DMACycles += hdmaCycles;
}

// Function to get our HDMA Source
// Follows the poan docs
// Inlined because closure compiler inlines
function getHdmaSourceFromMemory(): i32 {
  // Get our source for the HDMA
  let hdmaSourceHigh = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceHigh);
  let hdmaSourceLow = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceLow);

  let hdmaSource = concatenateBytes(hdmaSourceHigh, hdmaSourceLow);

  // And off the appopriate bits for the source and destination
  // And off the bottom 4 bits
  hdmaSource = hdmaSource & 0xfff0;

  return hdmaSource;
}

// Function to get our HDMA Destination
// Follows the poan docs
// Inlined because closure compiler inlines
function getHdmaDestinationFromMemory(): i32 {
  let hdmaDestinationHigh = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationHigh);
  let hdmaDestinationLow = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationLow);

  let hdmaDestination = concatenateBytes(hdmaDestinationHigh, hdmaDestinationLow);

  // Can only be in VRAM, 0x8000 -> 0x9FF0
  // Pan docs says to knock off upper 3 bits, and lower 4 bits
  // Which gives us: 0001111111110000 or 0x1FF0
  // Meaning we must add 0x8000
  hdmaDestination = hdmaDestination & 0x1ff0;
  hdmaDestination += Memory.videoRamLocation;

  return hdmaDestination;
}
