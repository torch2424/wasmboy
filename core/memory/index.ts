// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
// Public exports for our memory "class"

export { Memory, initializeCartridge } from './memory';

export {
  eightBitLoadFromGBMemoryWithTraps,
  eightBitLoadFromGBMemory,
  sixteenBitLoadFromGBMemory,
  loadBooleanDirectlyFromWasmMemory
} from './load';

export {
  eightBitStoreIntoGBMemoryWithTraps,
  sixteenBitStoreIntoGBMemoryWithTraps,
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  storeBooleanDirectlyToWasmMemory
} from './store';

export { initializeDma, updateHblankHdma } from './dma';
