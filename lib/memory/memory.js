import Promise from 'promise-polyfill';
import { idbKeyval } from './idb';

// import Functions involving GB and WasmBoy memory
import { getCartridgeHeader } from './header.js';
import { getCartridgeRam } from './ram.js';
import { getSaveState, loadSaveState } from './state.js';
import { initializeAutoSave } from './autosave.js';

class WasmBoyMemoryService {
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.saveStateCallback = undefined;
    this.loadedCartridgeMemoryState = {
      ROM: false,
      RAM: false
    };

    // Going to set the key for idbKeyval as the cartridge header.
    // Then, for each cartridge, it will return an object.
    // there will be a cartridgeRam Key, settings Key, and a saveState key
    // Not going to make one giant object, as we want to keep idb transactions light and fast
    this.WASMBOY_UNLOAD_STORAGE = 'WASMBOY_UNLOAD_STORAGE';

    // Define some constants since calls to wasm are expensive
    this.WASMBOY_GAME_BYTES_LOCATION = 0;
    this.WASMBOY_GAME_RAM_BANKS_LOCATION = 0;
    this.WASMBOY_INTERNAL_STATE_SIZE = 0;
    this.WASMBOY_INTERNAL_STATE_LOCATION = 0;
    this.WASMBOY_INTERNAL_MEMORY_SIZE = 0;
    this.WASMBOY_INTERNAL_MEMORY_LOCATION = 0;
    this.WASMBOY_PALETTE_MEMORY_SIZE = 0;
    this.WASMBOY_PALETTE_MEMORY_LOCATION = 0;
  }

  initialize(headless, wasmInstance, wasmByteMemory, saveStateCallback) {
    if (headless) {
      this.wasmInstance = wasmInstance;
      this.wasmByteMemory = wasmByteMemory;
      this.saveStateCallback = saveStateCallback;

      this._initializeConstants();

      return Promise.resolve();
    } else {
      this.wasmInstance = wasmInstance;
      this.wasmByteMemory = wasmByteMemory;
      this.saveStateCallback = saveStateCallback;

      this._initializeConstants();

      // initialize the autosave feature
      return initializeAutoSave(this);
    }
  }

  _initializeConstants() {
    // Initialiuze our cached wasm constants
    this.WASMBOY_GAME_BYTES_LOCATION = this.wasmInstance.exports.gameBytesLocation;
    this.WASMBOY_GAME_RAM_BANKS_LOCATION = this.wasmInstance.exports.gameRamBanksLocation;
    this.WASMBOY_INTERNAL_STATE_SIZE = this.wasmInstance.exports.wasmBoyInternalStateSize;
    this.WASMBOY_INTERNAL_STATE_LOCATION = this.wasmInstance.exports.wasmBoyInternalStateLocation;
    this.WASMBOY_INTERNAL_MEMORY_SIZE = this.wasmInstance.exports.gameBoyInternalMemorySize;
    this.WASMBOY_INTERNAL_MEMORY_LOCATION = this.wasmInstance.exports.gameBoyInternalMemoryLocation;
    this.WASMBOY_PALETTE_MEMORY_SIZE = this.wasmInstance.exports.gameboyColorPaletteSize;
    this.WASMBOY_PALETTE_MEMORY_LOCATION = this.wasmInstance.exports.gameboyColorPaletteLocation;
  }

  getLoadedCartridgeMemoryState() {
    return this.loadedCartridgeMemoryState;
  }

  clearMemory() {
    // Clear Wasm memory
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
    for (let i = 0; i <= this.wasmByteMemory.length; i++) {
      this.wasmByteMemory[i] = 0;
    }

    this.loadedCartridgeMemoryState.ROM = false;
    this.loadedCartridgeMemoryState.RAM = false;
  }

  // Function to reset stateful sections of memory
  resetState() {
    for (let i = 0; i <= this.WASMBOY_GAME_BYTES_LOCATION; i++) {
      this.wasmByteMemory[i] = 0;
    }

    this.loadedCartridgeMemoryState.RAM = false;
  }

  loadCartridgeRom(gameBytes, isGbcEnabled, bootRom) {
    // Load the game data into actual memory
    for (let i = 0; i < gameBytes.length; i++) {
      if (gameBytes[i]) {
        this.wasmByteMemory[this.WASMBOY_GAME_BYTES_LOCATION + i] = gameBytes[i];
      }
    }

    this.loadedCartridgeMemoryState.ROM = true;
  }

  // Function to save the cartridge ram
  // This emulates the cartridge having a battery to
  // Keep things like Pokemon Save data in memory
  // Also allows passing in a a Uint8Array header and ram to be set manually
  saveCartridgeRam(passedHeader, passedCartridgeRam) {

    const saveCartridgeRamTask = async () => {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      let header;
      let cartridgeRam;
      if (passedHeader && passedCartridgeRam) {
        header = passedHeader;
        cartridgeRam = passedCartridgeRam;
      } else {
        header = getCartridgeHeader(this);
        cartridgeRam = getCartridgeRam(this);
      }

      if (!header || !cartridgeRam) {
        throw new Error('Error parsing the cartridgeRam or cartridge header');
      }

      // Get our cartridge object
      let cartridgeObject = await idbKeyval.get(header)
      if (!cartridgeObject) {
        cartridgeObject = {};
      }

      // Set the cartridgeRam to our cartridgeObject
      cartridgeObject.cartridgeRam = cartridgeRam;

      await idbKeyval.set(header, cartridgeObject)
    }

    return saveCartridgeRamTask();
  }

  // function to load the cartridge ram
  // opposite of above
  loadCartridgeRam() {

    const loadCartridgeRamTask = async () => {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      const header = getCartridgeHeader(this);

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      const cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject || !cartridgeObject.cartridgeRam) {
        return;
      }

      // Set the cartridgeRam
      for (let i = 0; i < cartridgeObject.cartridgeRam.length; i++) {
        this.wasmByteMemory[this.WASMBOY_GAME_RAM_BANKS_LOCATION + i] = cartridgeObject.cartridgeRam[i];
      }
      this.loadedCartridgeMemoryState.RAM = true;
    }

    return loadCartridgeRamTask();
  }

  // Function to save the state to the indexeddb
  saveState(passedHeader, passedSaveState) {

    const saveStateTask = async () => {
      // Get our save state
      let saveState;
      let header;
      if (passedHeader && passedSaveState) {
        saveState = passedSaveState;
        header = passedHeader;
      } else {
        saveState = getSaveState(this);
        header = getCartridgeHeader(this);
      }

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      let cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject) {
        cartridgeObject = {};
      }
      if (!cartridgeObject.saveStates) {
        cartridgeObject.saveStates = [];
      }

      cartridgeObject.saveStates.push(saveState);

      await idbKeyval.set(header, cartridgeObject);
    }

    return saveStateTask();
  }

  loadState(saveState) {

    const loadStateTask = async () => {
      const header = getCartridgeHeader(this);

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      if (saveState) {
        loadSaveState(this, saveState);

        // Load back out internal wasmboy state from memory
        this.wasmInstance.exports.loadState();

        return;
      }

      const cartridgeObject = await idbKeyval.get(header);
      if (!cartridgeObject || !cartridgeObject.saveStates) {
        throw new Error('No Save State passed, and no cartridge object found');
        return;
      }

      // Load the last save state
      loadSaveState(this, cartridgeObject.saveStates[0]);

      // Load back out internal wasmboy state from memory
      this.wasmInstance.exports.loadState();
    }

    return loadStateTask();
  }

  // Function to return the current cartridge object
  getCartridgeObject() {
    const header = getCartridgeHeader(this);
    return idbKeyval.get(header);
  }
}

// Create a singleton to export
export const WasmBoyMemory = new WasmBoyMemoryService();
