// WasmBoy memory map:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
// Public exports for our memory "class"

export {
  initializeCartridge,
  setPixelOnFrame,
  getPixelOnFrame,
  storeFrameToBeRendered,
  setLeftAndRightOutputForAudioQueue,
  getSaveStateMemoryOffset
} from './memory';

export {
  eightBitLoadFromGBMemory,
  sixteenBitLoadFromGBMemory,
  loadBooleanDirectlyFromWasmMemory
} from './load';

export {
  eightBitStoreIntoGBMemory,
  sixteenBitStoreIntoGBMemory,
  eightBitStoreIntoGBMemorySkipTraps,
  sixteenBitStoreIntoGBMemorySkipTraps,
  storeBooleanDirectlyToWasmMemory
} from './store';
