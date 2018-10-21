import Promise from 'promise-polyfill';
import { idbKeyval } from './idb';

// Import worker stuff
import { WORKER_MESSAGE_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';

// import Functions involving GB and WasmBoy memory
import { getCartridgeHeader } from './header.js';
import { getCartridgeRom } from './rom.js';
import { getCartridgeRam } from './ram.js';
import { getSaveState, loadSaveState } from './state.js';
import { initializeAutoSave } from './autosave.js';

class WasmBoyMemoryService {
  constructor() {
    this.worker = undefined;
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

  initialize(headless, saveStateCallback) {
    const initializeTask = async () => {
      if (headless) {
        this.saveStateCallback = saveStateCallback;

        await this._initializeConstants();
      } else {
        this.saveStateCallback = saveStateCallback;

        await this._initializeConstants();

        // initialize the autosave feature
        await initializeAutoSave.call(this);
      }
    };

    return initializeTask();
  }

  setWorker(worker) {
    this.worker = worker;
  }

  _initializeConstants() {
    // Initialize our cached wasm constants
    return this.worker
      .postMessage({
        type: WORKER_MESSAGE_TYPE.GET_CONSTANTS
      })
      .then(event => {
        const eventData = getEventData(event);
        Object.keys(this).forEach(key => {
          if (eventData.message[key] !== undefined) {
            this[key] = eventData.message[key];
          }
        });
      });
  }

  getLoadedCartridgeMemoryState() {
    return this.loadedCartridgeMemoryState;
  }

  clearMemory() {
    // Clear Wasm memory
    // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
    return this.worker
      .postMessage({
        type: WORKER_MESSAGE_TYPE.CLEAR_MEMORY
      })
      .then(event => {
        this.loadedCartridgeMemoryState.ROM = false;
        this.loadedCartridgeMemoryState.RAM = false;
      });
  }

  loadCartridgeRom(ROM) {
    const loadTask = async () => {
      await this.worker
        .postMessage(
          {
            type: WORKER_MESSAGE_TYPE.LOAD_ROM,
            ROM: ROM.buffer
          },
          [ROM.buffer]
        )
        .then(event => {
          this.loadedCartridgeMemoryState.ROM = true;
        });
    };

    return loadTask();
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
        header = getCartridgeHeader.call(this);
        cartridgeRam = getCartridgeRam.call(this);
      }

      if (!header || !cartridgeRam) {
        throw new Error('Error parsing the cartridgeRam or cartridge header');
      }

      // Get our cartridge object
      let cartridgeObject = await idbKeyval.get(header);
      if (!cartridgeObject) {
        cartridgeObject = {};
      }

      // Set the cartridgeRam to our cartridgeObject
      cartridgeObject.cartridgeRam = cartridgeRam;

      await idbKeyval.set(header, cartridgeObject);
    };

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
      const header = getCartridgeHeader.call(this);

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
    };

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
        saveState = getSaveState.call(this);
        header = getCartridgeHeader.call(this);
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

      return saveState;
    };

    return saveStateTask();
  }

  loadState(saveState) {
    const loadStateTask = async () => {
      const header = getCartridgeHeader.call(this);

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      if (saveState) {
        loadSaveState.call(this, saveState);

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
      loadSaveState.call(this, cartridgeObject.saveStates[0]);

      // Load back out internal wasmboy state from memory
      this.wasmInstance.exports.loadState();
    };

    return loadStateTask();
  }

  // Function to return the current cartridge object
  getCartridgeObject() {
    const header = getCartridgeHeader.call(this);
    return idbKeyval.get(header);
  }

  // Function to return all informationh aboyut the currently loaded cart.
  // This will include, the ROM, the RAM, the header, and the indivudal pieces of the header
  // See: http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  getCartridgeInfo() {
    if (!this.loadedCartridgeMemoryState.ROM) {
      return Promise.reject('No ROM has been loaded');
    }

    let getCartridgeInfoTask = async () => {
      const cartridgeInfo = {};

      cartridgeInfo.header = getCartridgeHeader.call(this);
      cartridgeInfo.ROM = getCartridgeRom.call(this);
      cartridgeInfo.RAM = getCartridgeRam.call(this);

      // Now parse our header for additional information
      cartridgeInfo.nintendoLogo = cartridgeInfo.ROM.slice(0x104, 0x134);

      cartridgeInfo.title = cartridgeInfo.ROM.slice(0x134, 0x144);
      cartridgeInfo.titleAsString = String.fromCharCode.apply(null, cartridgeInfo.title);

      cartridgeInfo.manufacturerCode = cartridgeInfo.ROM.slice(0x13f, 0x143);

      cartridgeInfo.CGBFlag = cartridgeInfo.ROM[0x143];

      cartridgeInfo.newLicenseeCode = cartridgeInfo.ROM.slice(0x144, 0x146);

      cartridgeInfo.SGBFlag = cartridgeInfo.ROM[0x146];

      cartridgeInfo.cartridgeType = cartridgeInfo.ROM[0x147];

      cartridgeInfo.ROMSize = cartridgeInfo.ROM[0x148];

      cartridgeInfo.RAMSize = cartridgeInfo.ROM[0x149];

      cartridgeInfo.destinationCode = cartridgeInfo.ROM[0x14a];

      cartridgeInfo.oldLicenseeCode = cartridgeInfo.ROM[0x14b];

      cartridgeInfo.maskROMVersionNumber = cartridgeInfo.ROM[0x14c];

      cartridgeInfo.headerChecksum = cartridgeInfo.ROM[0x14d];

      cartridgeInfo.globalChecksum = cartridgeInfo.ROM.slice(0x14e, 0x150);

      return cartridgeInfo;
    };

    return getCartridgeInfoTask();
  }
}

// Create a singleton to export
export const WasmBoyMemory = new WasmBoyMemoryService();
