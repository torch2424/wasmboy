import { getCartridgeRam } from './ram.js';

//  Will save the state in parts, to easy memory map changes:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
const WASMBOY_SAVE_STATE_SCHEMA = {
  wasmboyMemory: {
    wasmBoyInternalState: [],
    wasmBoyPaletteMemory: [],
    gameBoyMemory: [],
    cartridgeRam: []
  },
  date: undefined,
  isAuto: undefined
};

// Function to return a save state of the current memory
export const getSaveState = wasmboyMemory => {
  // Save our internal wasmboy state to memory
  wasmboyMemory.wasmInstance.exports.saveState();

  const cartridgeRam = getCartridgeRam(wasmboyMemory.wasmInstance, wasmboyMemory.wasmByteMemory);

  const wasmBoyInternalState = new Uint8Array(wasmboyMemory.WASMBOY_INTERNAL_STATE_SIZE);
  const wasmBoyPaletteMemory = new Uint8Array(wasmboyMemory.WASMBOY_PALETTE_MEMORY_SIZE);
  const gameBoyMemory = new Uint8Array(wasmboyMemory.WASMBOY_INTERNAL_MEMORY_SIZE);

  for (let i = 0; i < wasmboyMemory.WASMBOY_INTERNAL_STATE_SIZE; i++) {
    wasmBoyInternalState[i] = wasmboyMemory.wasmByteMemory[i + wasmboyMemory.WASMBOY_INTERNAL_STATE_LOCATION];
  }

  for (let i = 0; i < wasmboyMemory.WASMBOY_PALETTE_MEMORY_SIZE; i++) {
    wasmBoyPaletteMemory[i] = wasmboyMemory.wasmByteMemory[i + wasmboyMemory.WASMBOY_PALETTE_MEMORY_LOCATION];
  }

  for (let i = 0; i < wasmboyMemory.WASMBOY_INTERNAL_MEMORY_SIZE; i++) {
    gameBoyMemory[i] = wasmboyMemory.wasmByteMemory[i + wasmboyMemory.WASMBOY_INTERNAL_MEMORY_LOCATION];
  }

  let saveState = Object.assign({}, WASMBOY_SAVE_STATE_SCHEMA);

  saveState.wasmboyMemory.wasmBoyInternalState = wasmBoyInternalState;
  saveState.wasmboyMemory.wasmBoyPaletteMemory = wasmBoyPaletteMemory;
  saveState.wasmboyMemory.gameBoyMemory = gameBoyMemory;
  saveState.wasmboyMemory.cartridgeRam = cartridgeRam;
  saveState.date = Date.now();
  saveState.isAuto = false;

  if (wasmboyMemory.saveStateCallback) {
    wasmboyMemory.saveStateCallback(saveState);
  }

  return saveState;
};

export const loadSaveState = (wasmboyMemory, saveState) => {
  for (let i = 0; i < wasmboyMemory.WASMBOY_INTERNAL_STATE_SIZE; i++) {
    wasmboyMemory.wasmByteMemory[i + wasmboyMemory.WASMBOY_INTERNAL_STATE_LOCATION] = saveState.wasmboyMemory.wasmBoyInternalState[i];
  }

  for (let i = 0; i < wasmboyMemory.WASMBOY_PALETTE_MEMORY_SIZE; i++) {
    wasmboyMemory.wasmByteMemory[i + wasmboyMemory.WASMBOY_PALETTE_MEMORY_LOCATION] = saveState.wasmboyMemory.wasmBoyPaletteMemory[i];
  }

  for (let i = 0; i < wasmboyMemory.WASMBOY_INTERNAL_MEMORY_SIZE; i++) {
    wasmboyMemory.wasmByteMemory[i + wasmboyMemory.WASMBOY_INTERNAL_MEMORY_LOCATION] = saveState.wasmboyMemory.gameBoyMemory[i];
  }

  for (let i = 0; i < saveState.wasmboyMemory.cartridgeRam.length; i++) {
    wasmboyMemory.wasmByteMemory[i + wasmboyMemory.WASMBOY_GAME_RAM_BANKS_LOCATION] = saveState.wasmboyMemory.cartridgeRam[i];
  }

  return true;
};
