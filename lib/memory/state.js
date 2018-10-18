// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions

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
export function getSaveState() {
  // Save our internal wasmboy state to memory
  // Should be done whenever we send back memory
  // this.wasmInstance.exports.saveState();

  const cartridgeRam = getCartridgeRam.bind(this)();

  const wasmBoytInternalState = this.wasmByteMemory.slice(
    this.WASMBOY_INTERNAL_STATE_LOCATION,
    this.WASMBOY_INTERNAL_STATE_LOCATION + this.WASMBOY_INTERNAL_STATE_SIZE
  );
  const wasmBoyPalettememory = this.wasmByteMemory.slice(
    this.WASMBOY_PALETTE_MEMORY_LOCATION,
    this.WASMBOY_PALETTE_MEMORY_LOCATION + this.WASMBOY_PALETTE_MEMORY_SIZE
  );
  const gameBoyMemory = this.wasmByteMemory.slice(
    this.WASMBOY_INTERNAL_MEMORY_LOCATION,
    this.WASMBOY_INTERNAL_MEMORY_LOCATION + this.WASMBOY_INTERNAL_MEMORY_SIZE
  );

  let saveState = Object.assign({}, WASMBOY_SAVE_STATE_SCHEMA);

  saveState.wasmboyMemory.wasmBoyInternalState = wasmBoyInternalState;
  saveState.wasmboyMemory.wasmBoyPaletteMemory = wasmBoyPaletteMemory;
  saveState.wasmboyMemory.gameBoyMemory = gameBoyMemory;
  saveState.wasmboyMemory.cartridgeRam = cartridgeRam;
  saveState.date = Date.now();
  saveState.isAuto = false;

  if (this.saveStateCallback) {
    this.saveStateCallback(saveState);
  }

  return saveState;
}

export function loadSaveState(saveState) {
  this.wasmByteMemory.set(saveState.wasmboyMemory.wasmBoyInternalState, this.WASMBOY_INTERNAL_STATE_LOCATION);

  this.wasmByteMemory.set(saveState.wasmboyMemory.wasmBoyPaletteMemory, this.WASMBOY_PALETTE_MEMORY_LOCATION);

  this.wasmByteMemory.set(saveState.wasmboyMemory.gameBoyMemory, this.WASMBOY_INTERNAL_MEMORY_LOCATION);

  this.wasmByteMemory.set(saveState.wasmboyMemory.cartridgeRam, this.WASMBOY_GAME_RAM_BANKS_LOCATION);

  return true;
}
