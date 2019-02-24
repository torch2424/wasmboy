import { idbKeyval } from './idb';

// Import worker stuff
import { WORKER_MESSAGE_TYPE, MEMORY_TYPE } from '../worker/constants';
import { getEventData } from '../worker/util';

// Fetch rom
import { fetchROMAsByteArray } from '../wasmboy/fetchrom';

// import Functions involving GB and WasmBoy memory
import { getSaveState } from './state.js';
import { initializeAutoSave } from './autosave.js';

const BOOT_ROM_KEY = 'boot-rom-';

class WasmBoyMemoryService {
  constructor() {
    this.worker = undefined;
    this.maxNumberOfAutoSaveStates = undefined;
    this.saveStateCallback = undefined;
    this.loadedCartridgeMemoryState = {
      ROM: false,
      RAM: false,
      BOOT: false
    };

    // Our different types of memory
    this.bootRom = undefined;
    this.cartridgeRom = undefined;
    this.cartridgeRomFileName = undefined;
    this.cartridgeHeader = undefined;
    this.cartridgeRam = undefined;
    this.gameboyMemory = undefined;
    this.paletteMemory = undefined;
    this.internalState = undefined;

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

    // Define some other constants
    this.SUPPORTED_BOOT_ROM_TYPES = {
      GB: 'GB',
      GBC: 'GBC'
    };
  }

  initialize(headless, maxNumberOfAutoSaveStates, saveStateCallback) {
    this.maxNumberOfAutoSaveStates = maxNumberOfAutoSaveStates;
    this.saveStateCallback = saveStateCallback;

    const initializeTask = async () => {
      await this._initializeConstants();

      if (!headless) {
        await initializeAutoSave.call(this);
      }
    };

    return initializeTask();
  }

  setWorker(worker) {
    this.worker = worker;

    // Also set our handler
    this.worker.addMessageListener(event => {
      const eventData = getEventData(event);

      switch (eventData.message.type) {
        case WORKER_MESSAGE_TYPE.UPDATED: {
          // Simply set our memory
          const memoryTypes = Object.keys(eventData.message);
          delete memoryTypes.type;

          if (memoryTypes.includes(MEMORY_TYPE.BOOT_ROM)) {
            this.bootRom = new Uint8Array(eventData.message[MEMORY_TYPE.BOOT_ROM]);
          }
          if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_ROM)) {
            this.cartridgeRom = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_ROM]);
          }
          if (memoryTypes.includes(MEMORY_TYPE.CARTRIDGE_RAM)) {
            this.cartridgeRam = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_RAM]);
          }
          if (memoryTypes.includes(MEMORY_TYPE.GAMEBOY_MEMORY)) {
            this.gameboyMemory = new Uint8Array(eventData.message[MEMORY_TYPE.GAMEBOY_MEMORY]);
          }
          if (memoryTypes.includes(MEMORY_TYPE.PALETTE_MEMORY)) {
            this.paletteMemory = new Uint8Array(eventData.message[MEMORY_TYPE.PALETTE_MEMORY]);
          }
          if (memoryTypes.includes(MEMORY_TYPE.INTERNAL_STATE)) {
            this.internalState = new Uint8Array(eventData.message[MEMORY_TYPE.INTERNAL_STATE]);
          }

          return;
        }
      }
    });
  }

  // Function to get all cartridge objects
  // Saved in our indexed db
  getSavedMemory() {
    const getSavedMemoryTask = async () => {
      const memory = [];
      const keys = await idbKeyval.keys();

      for (let i = 0; i < keys.length; i++) {
        const cartridgeObject = await idbKeyval.get(keys[i]);
        memory.push(cartridgeObject);
      }

      return memory;
    };
    return getSavedMemoryTask();
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

        // Reset everything
        this.cartridgeRom = undefined;
        this.cartridgeHeader = undefined;
        this.cartridgeRam = undefined;
        this.gameboyMemory = undefined;
        this.paletteMemory = undefined;
        this.internalState = undefined;
      });
  }

  isValidBootROMType(type) {
    return Object.keys(this.SUPPORTED_BOOT_ROM_TYPES).some(bootROMTypeKey => {
      return this.SUPPORTED_BOOT_ROM_TYPES[bootROMTypeKey] === type;
    });
  }

  async addBootROM(type, file, fetchHeaders, additionalInfo) {
    type = type.toUpperCase();

    if (!this.isValidBootROMType(type)) {
      throw new Error('Invalid Boot ROM type');
    }

    // Get our fetch rom object
    const fetchROMObject = await fetchROMAsByteArray(file, fetchHeaders);

    // Remove any keys we don't want to allow
    // Overriding in the additionalInfo
    if (additionalInfo) {
      delete additionalInfo.name;
      delete additionalInfo.ROM;
    }

    let name = 'Game Boy';
    if (this.SUPPORTED_BOOT_ROM_TYPES.GBC === type) {
      name = 'Game Boy Color';
    }

    const bootROMObject = {
      ROM: fetchROMObject.ROM,
      name,
      type,
      date: Date.now(),
      ...additionalInfo
    };

    await idbKeyval.set(BOOT_ROM_KEY + type, bootROMObject);
  }

  async getBootROMs() {
    const bootROMs = [];

    for (let bootROMType in this.SUPPORTED_BOOT_ROM_TYPES) {
      const bootROMObject = await idbKeyval.get(BOOT_ROM_KEY + bootROMType);

      if (bootROMObject) {
        bootROMs.push(bootROMObject);
      }
    }

    return bootROMs;
  }

  async loadBootROMIfAvailable(type) {
    if (!idbKeyval) {
      // TODO: Allow headless Boot ROMs
      return;
    }

    type = type.toUpperCase();

    if (!this.isValidBootROMType(type)) {
      throw new Error('Invalid Boot ROM type');
    }

    // Try to get the boot rom object
    const bootROMObject = await idbKeyval.get(BOOT_ROM_KEY + type);

    if (!bootROMObject) {
      // Return silently
      return;
    }

    const workerMemoryObject = {};
    workerMemoryObject[MEMORY_TYPE.BOOT_ROM] = bootROMObject.ROM.buffer;

    // Don't pass the rom as a transferrable, since,
    // We want to keep a copy of it for reset
    await this.worker
      .postMessage({
        type: WORKER_MESSAGE_TYPE.SET_MEMORY,
        ...workerMemoryObject
      })
      .then(event => {
        this.loadedCartridgeMemoryState.BOOT = true;
      });

    // Also get our cartridge header
    await this.worker
      .postMessage({
        type: WORKER_MESSAGE_TYPE.GET_MEMORY,
        memoryTypes: [MEMORY_TYPE.BOOT_ROM]
      })
      .then(event => {
        const eventData = getEventData(event);
        this.bootRom = new Uint8Array(eventData.message[MEMORY_TYPE.BOOT_ROM]);
      });
  }

  loadCartridgeRom(ROM, fileName) {
    const loadTask = async () => {
      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_ROM] = ROM.buffer;

      // Don't pass the rom as a transferrable, since,
      // We want to keep a copy of it for reset
      await this.worker
        .postMessage({
          type: WORKER_MESSAGE_TYPE.SET_MEMORY,
          ...workerMemoryObject
        })
        .then(event => {
          this.loadedCartridgeMemoryState.ROM = true;
        });

      // Also get our cartridge header
      await this.worker
        .postMessage({
          type: WORKER_MESSAGE_TYPE.GET_MEMORY,
          memoryTypes: [MEMORY_TYPE.CARTRIDGE_ROM, MEMORY_TYPE.CARTRIDGE_HEADER]
        })
        .then(event => {
          const eventData = getEventData(event);
          this.cartridgeRom = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_ROM]);
          this.cartridgeRomFileName = fileName;
          this.cartridgeHeader = new Uint8Array(eventData.message[MEMORY_TYPE.CARTRIDGE_HEADER]);
        });
    };

    return loadTask();
  }

  saveLoadedCartridge(additionalInfo) {
    const saveLoadedCartridgeRomTask = async () => {
      if (!this.cartridgeHeader) {
        throw new Error('Error parsing the cartridge header');
      }

      let cartridgeObject = await idbKeyval.get(this.cartridgeHeader);

      if (!cartridgeObject) {
        cartridgeObject = {};
      }

      const cartridgeInfo = await this.getCartridgeInfo();

      // Remove any keys we don't want to allow
      // Overriding in the additionalInfo
      if (additionalInfo) {
        delete additionalInfo.ROM;
        delete additionalInfo.header;
      }

      // In the rare chance we don't know the name, set to unkown.
      let fileName = this.cartridgeRomFileName || 'Unknown';

      cartridgeObject.cartridgeRom = {
        ROM: this.cartridgeRom,
        header: this.cartridgeHeader,
        fileName: fileName,
        date: Date.now(),
        ...additionalInfo
      };

      cartridgeObject.cartridgeInfo = cartridgeInfo;

      if (this.cartridgeRam) {
        await this.saveCartridgeRam();
      }

      await idbKeyval.set(this.cartridgeHeader, cartridgeObject);

      return cartridgeObject;
    };
    return saveLoadedCartridgeRomTask();
  }

  deleteSavedCartridge(cartridge) {
    const deleteLoadedCartridgeTask = async () => {
      const cartridgeHeader = cartridge.cartridgeInfo.header;

      if (!cartridgeHeader) {
        throw new Error('Error parsing the cartridge header');
      }

      let cartridgeObject = await idbKeyval.get(cartridgeHeader);

      if (!cartridgeObject) {
        throw new Error('Could not find the passed cartridge');
      }

      delete cartridgeObject.cartridgeRom;

      await idbKeyval.set(cartridgeHeader, cartridgeObject);

      return cartridgeObject;
    };

    return deleteLoadedCartridgeTask();
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
        header = this.cartridgeHeader;
        cartridgeRam = this.cartridgeRam;
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
      const header = this.cartridgeHeader;

      if (!header) {
        throw new Error('Error parsing the cartridge header');
      }

      const cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject || !cartridgeObject.cartridgeRam) {
        return;
      }

      // Set the cartridgeRam
      // Don't transfer, because we want to keep a reference to it
      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM] = cartridgeObject.cartridgeRam.buffer;
      await this.worker
        .postMessage({
          type: WORKER_MESSAGE_TYPE.SET_MEMORY,
          ...workerMemoryObject
        })
        .then(event => {
          this.loadedCartridgeMemoryState.RAM = true;
          this.cartridgeRam = cartridgeObject.cartridgeRam;
        });
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
        header = this.cartridgeHeader;
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

      // Check if we are auto
      if (saveState.isAuto && this.maxNumberOfAutoSaveStates && this.maxNumberOfAutoSaveStates > 0) {
        // Make sure we are not exceeding the max number of auto save states
        const autoSaveStates = [];
        cartridgeObject.saveStates.forEach(savedState => {
          if (savedState.isAuto) {
            autoSaveStates.push(savedState);
          }
        });

        // Sort auto save states by date
        autoSaveStates.sort((a, b) => {
          if (a.date < b.date) {
            return -1;
          }

          if (a.date > b.date) {
            return 1;
          }

          return 0;
        });

        while (autoSaveStates.length > 0 && autoSaveStates.length + 1 > this.maxNumberOfAutoSaveStates) {
          const autoSaveState = autoSaveStates.shift();
          // Find the save state
          const saveStateIndex = this._indexOfSaveStateIndexInSaveStates(autoSaveState, cartridgeObject.saveStates);
          cartridgeObject.saveStates.splice(saveStateIndex, 1);
        }

        if (this.maxNumberOfAutoSaveStates > 0) {
          cartridgeObject.saveStates.push(saveState);
        }
      } else {
        cartridgeObject.saveStates.push(saveState);
      }

      await idbKeyval.set(header, cartridgeObject);

      return saveState;
    };

    return saveStateTask();
  }

  loadState(saveState) {
    const loadStateTask = async () => {
      const header = this.cartridgeHeader;

      if (!header) {
        throw new Error('Error getting the cartridge header');
      }

      if (!saveState) {
        const cartridgeObject = await idbKeyval.get(header);
        if (!cartridgeObject || !cartridgeObject.saveStates) {
          throw new Error('No Save State passed, and no cartridge object found');
          return;
        }
        saverState = cartridgeObject.saveStates[0];
      }

      const workerMemoryObject = {};
      workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM] = saveState.wasmboyMemory.cartridgeRam.buffer;
      workerMemoryObject[MEMORY_TYPE.GAMEBOY_MEMORY] = saveState.wasmboyMemory.gameBoyMemory.buffer;
      workerMemoryObject[MEMORY_TYPE.PALETTE_MEMORY] = saveState.wasmboyMemory.wasmBoyPaletteMemory.buffer;
      workerMemoryObject[MEMORY_TYPE.INTERNAL_STATE] = saveState.wasmboyMemory.wasmBoyInternalState.buffer;

      await this.worker.postMessage(
        {
          type: WORKER_MESSAGE_TYPE.SET_MEMORY,
          ...workerMemoryObject
        },
        [
          workerMemoryObject[MEMORY_TYPE.CARTRIDGE_RAM],
          workerMemoryObject[MEMORY_TYPE.GAMEBOY_MEMORY],
          workerMemoryObject[MEMORY_TYPE.PALETTE_MEMORY],
          workerMemoryObject[MEMORY_TYPE.INTERNAL_STATE]
        ]
      );

      await this.worker
        .postMessage({
          type: WORKER_MESSAGE_TYPE.GET_MEMORY,
          memoryTypes: [MEMORY_TYPE.CARTRIDGE_RAM, MEMORY_TYPE.GAMEBOY_MEMORY, MEMORY_TYPE.PALETTE_MEMORY, MEMORY_TYPE.INTERNAL_STATE]
        })
        .then(event => {
          const eventData = getEventData(event);
          this.cartridgeRam = eventData.message[MEMORY_TYPE.CARTRIDGE_RAM];
          this.gameboyMemory = eventData.message[MEMORY_TYPE.GAMEBOY_MEMORY];
          this.paletteMemory = eventData.message[MEMORY_TYPE.PALETTE_MEMORY];
          this.internalState = eventData.message[MEMORY_TYPE.INTERNAL_STATE];
        });
    };

    return loadStateTask();
  }

  deleteState(saveState, passedHeader) {
    const deleteStateTask = async () => {
      if (!saveState) {
        throw new Error('You must provide a save state to delete');
        return;
      }

      let header;
      if (passedHeader) {
        header = passedHeader;
      } else if (this.cartridgeHeader) {
        header = this.cartridgeHeader;
      }

      if (!header) {
        throw new Error('Please load a ROM, or pass a Cartridge header...');
        return;
      }

      let cartridgeObject = await idbKeyval.get(header);

      if (!cartridgeObject || !cartridgeObject.saveStates) {
        throw new Error('No save states found for the Cartridge...');
        return;
      }

      // Find the save state
      const saveStateIndex = this._indexOfSaveStateIndexInSaveStates(saveState, cartridgeObject.saveStates);

      // If not found, throw an error
      if (saveStateIndex < 0) {
        throw new Error('Could not find the passed save state for the related cartridge...');
        return;
      }

      cartridgeObject.saveStates.splice(saveStateIndex, 1);

      await idbKeyval.set(header, cartridgeObject);

      return saveState;
    };

    return deleteStateTask();
  }

  // Function to return the current cartridge object
  getCartridgeObject() {
    return idbKeyval.get(this.cartridgeHeader);
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

      cartridgeInfo.header = this.cartridgeHeader;
      cartridgeInfo.ROM = this.cartridgeRom;
      cartridgeInfo.RAM = this.cartridgeRam;

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

  _indexOfSaveStateIndexInSaveStates(saveState, saveStates) {
    // Find the save state
    let saveStateIndex = saveStates.indexOf(saveState);
    if (saveStateIndex < 0) {
      const keysCheck = (a, b) => {
        return JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b));
      };

      const dateCheck = (a, b) => {
        return a.date === b.date;
      };

      const autoCheck = (a, b) => {
        return a.isAuto === b.isAuto;
      };

      saveStates.some((savedState, index) => {
        if (keysCheck(saveState, savedState) && dateCheck(saveState, savedState) && autoCheck(saveState, savedState)) {
          saveStateIndex = index;
          return true;
        }

        return false;
      });
    }

    return saveStateIndex;
  }
}

// Create a singleton to export
export const WasmBoyMemory = new WasmBoyMemoryService();
