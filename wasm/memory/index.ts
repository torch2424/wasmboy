// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
// Public exports for our memory "class"

export {
  initializeCartridge,
  setPixelOnFrame,
  getPixelOnFrame
} from './memory';

export {
  eightBitLoadFromGBMemory,
  sixteenBitLoadFromGBMemory
} from './load';

export {
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  eightBitStoreIntoGBMemorySkipTraps,
  sixteenBitStoreIntoGBMemorySkipTraps
} from './store';
