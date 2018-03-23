import {
  Cpu
} from '../cpu/cpu';
import {
  Memory
} from './memory';
import {
  eightBitLoadFromGBMemorySkipTraps
} from './load';
import {
  eightBitStoreIntoGBMemorySkipTraps
} from './store';
import {
  checkBitOnByte,
  setBitOnByte
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

  // Get whether we are in an Hblank DMA already
  // TODO: Need to be able to restart this during HBlank
  let hdmaTrigger: u8 = eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger);
  if (!checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {
    Memory.isHblankHdmaActive = false;
    Memory.hblankHdmaIndex = 0x00;
    Memory.hblankHdmaTotalBytes = 0x00;
    Memory.hblankHdmaSource = 0x00;
    Memory.hblankHdmaDestination = 0x00;
    return;
  }

  // Get our source and destination for the HDMA
  let hdmaSourceHigh: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaSourceHigh) << 8);
  // And off the lower 4 bits
  let hdmaSourceLow: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaSourceLow) & 0x0F);
  // only want the lover 5 bits (0-4). And off the upper 3
  let hdmaDestinationHigh: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaDestinationHigh) & 0x1F);
  hdmaDestinationHigh = (hdmaDestinationHigh << 8);
  // And off the lower 4 bits
  let hdmaDestinationLow: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaDestinationLow) & 0x0F);

  // Get the final destination
  let hdmaSource: u16 = (hdmaSourceHigh | hdmaSourceLow);
  let hdmaDestination: u16 = (hdmaDestinationLow | hdmaDestinationHigh);

  // Get the length from the trigger
  // Lower 7 bits, divide by 0x10, minus 1
  let transferLength: u8 = (hdmaTriggerByteToBeWritten & 0x7F);
  transferLength = (transferLength / 0x10) - 1;

  // Get bit 7 of the trigger for the HDMA type
  if (checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {

    // H-Blank DMA
    Memory.isHblankHdmaActive = true;
    Memory.hblankHdmaIndex = 0x00;
    Memory.hblankHdmaTotalBytes = transferLength;
    Memory.hblankHdmaSource = hdmaSource;
    Memory.hblankHdmaDestination = hdmaDestination;

    // This will be handled in updateHblankHdma()

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

  // Get our current Trigger Byte
  let hdmaTrigger: u8 = eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger);

  // Get our source and destination for the HDMA
  let hdmaSourceHigh: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaSourceHigh) << 8);
  // And off the lower 4 bits
  let hdmaSourceLow: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaSourceLow) & 0x0F);
  // only want the lover 5 bits (0-4). And off the upper 3
  let hdmaDestinationHigh: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaDestinationHigh) & 0x1F);
  hdmaDestinationHigh = (hdmaDestinationHigh << 8);
  // And off the lower 4 bits
  let hdmaDestinationLow: u16 = (eightBitLoadFromGBMemorySkipTraps(Memory.memoryLocationHdmaDestinationLow) & 0x0F);

  // Get the final destination
  let hdmaSource: u16 = (hdmaSourceHigh | hdmaSourceLow);
  let hdmaDestination: u16 = (hdmaDestinationLow | hdmaDestinationHigh);

  // Get our amount of bytes to transfer (Only 0x10 bytes at a time)
  let bytesToTransfer: u8 = 0x10;
  if (Memory.hblankHdmaIndex + 0x10 > Memory.hblankHdmaTotalBytes) {
    // Set to the difference
    bytesToTransfer = Memory.hblankHdmaTotalBytes - Memory.hblankHdmaIndex;
  }

  // Do the transfer (Only 0x10 bytes at a time)
  hdmaTransfer(hdmaSource + Memory.hblankHdmaIndex, hdmaDestination + Memory.hblankHdmaIndex, bytesToTransfer);

  // Increase our transfer index
  Memory.hblankHdmaIndex += 0x10;

  if(Memory.hblankHdmaIndex >= Memory.hblankHdmaTotalBytes) {
    // End the transfer
    Memory.isHblankHdmaActive = false;
    Memory.hblankHdmaIndex = 0x00;
    Memory.hblankHdmaTotalBytes = 0x00;
    Memory.hblankHdmaSource = 0x00;
    Memory.hblankHdmaDestination = 0x00;

    eightBitStoreIntoGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger, 0xFF);
  } else {
    // Set our new transfer length, make sure it is in the wird format, and make sure bit 7 is still 1
    let remainingTransferLength: u8 = Memory.hblankHdmaTotalBytes - Memory.hblankHdmaIndex;
    remainingTransferLength += 1;
    remainingTransferLength = remainingTransferLength * 10;
    remainingTransferLength = setBitOnByte(7, remainingTransferLength);
    eightBitStoreIntoGBMemorySkipTraps(Memory.memoryLocationHdmaTrigger, remainingTransferLength);
  }
}

// Simple Function to transfer the bytes from a destion to a source for HDMA
function hdmaTransfer(hdmaSource: u16, hdmaDestination: u16, transferLength: u8): void {
  for(let i: u16 = 0; i < transferLength; i++) {
    let sourceByte: u8 = eightBitLoadFromGBMemorySkipTraps(hdmaSource + i);
    eightBitStoreIntoGBMemorySkipTraps(hdmaDestination + i, sourceByte);
  }
}
