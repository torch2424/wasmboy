import Promise from "promise-polyfill";
import { idbKeyval } from "./idb";

// Going to set the key for idbKeyval as the cartridge header.
// Then, for each cartridge, it will return an object.
// there will be a cartridgeRam Key, settings Key, and a saveState key
// Not going to make one giant object, as we want to keep idb transactions light and fast

const WASMBOY_UNLOAD_STORAGE = "WASMBOY_UNLOAD_STORAGE";

//  Will save the state in parts, to easy memory map changes:
// https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
const WASMBOY_SAVE_STATE_SCHEMA = {
  wasmBoyMemory: {
    wasmBoyInternalState: [],
    wasmBoyPaletteMemory: [],
    gameBoyMemory: [],
    cartridgeRam: []
  },
  date: undefined,
  name: undefined,
  isAuto: undefined
};

// Define some constants since calls to wasm are expensive
let WASMBOY_GAME_BYTES_LOCATION = 0;
let WASMBOY_GAME_RAM_BANKS_LOCATION = 0;
let WASMBOY_INTERNAL_STATE_SIZE = 0;
let WASMBOY_INTERNAL_STATE_LOCATION = 0;
let WASMBOY_INTERNAL_MEMORY_SIZE = 0;
let WASMBOY_INTERNAL_MEMORY_LOCATION = 0;
let WASMBOY_PALETTE_MEMORY_SIZE = 0;
let WASMBOY_PALETTE_MEMORY_LOCATION = 0;

// Private function to get the cartridge header
const getCartridgeHeader = (wasmInstance, wasmByteMemory) => {
  if (!wasmByteMemory) {
    return false;
  }

  // Header is at 0x0134 - 0x014F
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  const headerLength = 0x014f - 0x0134;
  const headerArray = new Uint8Array(headerLength);
  for (let i = 0; i <= headerLength; i++) {
    // Get the CARTRIDGE_ROM + the offset to point us at the header, plus the current byte
    headerArray[i] = wasmByteMemory[WASMBOY_GAME_BYTES_LOCATION + 0x0134 + i];
  }

  return headerArray;
};

// Private function to get the caretridge ram
const getCartridgeRam = (wasmInstance, wasmByteMemory) => {
  if (!wasmByteMemory) {
    return false;
  }

  // Depening on the rom type, we will have different ram sizes.
  // Due memory restrictions described in:
  // https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/offline-for-pwa
  // We will make sure to only store as much as we need per ROM :)

  // Similar to `initializeCartridgeType()` in `wasm/memory/memory.ts`
  // We will determine our cartridge type
  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let cartridgeType = wasmByteMemory[WASMBOY_GAME_BYTES_LOCATION + 0x0147];

  let ramSize = undefined;
  if (cartridgeType === 0x00) {
    // No memory for this rom type
    return false;
  } else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
    // MBC1 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
    // MBC2 512X4 Bytes, 2KB
    ramSize = 0x800;
  } else if (cartridgeType >= 0x0f && cartridgeType <= 0x13) {
    // MBC3 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x19 && cartridgeType <= 0x1e) {
    // MBC5 128KB of Ram
    ramSize = 0x20000;
  }

  if (!ramSize) {
    return false;
  }

  // Finally fill our cartridgeRam from the ram in memory
  const cartridgeRam = new Uint8Array(ramSize);

  for (let i = 0; i < ramSize; i++) {
    cartridgeRam[i] = wasmByteMemory[WASMBOY_GAME_RAM_BANKS_LOCATION + i];
  }

  return cartridgeRam;
};

// Function to return a save state of the current memory
const getSaveState = (
  wasmInstance,
  wasmByteMemory,
  saveStateCallback,
  saveStateName
) => {
  const cartridgeRam = getCartridgeRam(wasmInstance, wasmByteMemory);

  const wasmBoyInternalState = new Uint8Array(WASMBOY_INTERNAL_STATE_SIZE);
  const wasmBoyPaletteMemory = new Uint8Array(WASMBOY_PALETTE_MEMORY_SIZE);
  const gameBoyMemory = new Uint8Array(WASMBOY_INTERNAL_MEMORY_SIZE);

  for (let i = 0; i < WASMBOY_INTERNAL_STATE_SIZE; i++) {
    wasmBoyInternalState[i] =
      wasmByteMemory[i + WASMBOY_INTERNAL_STATE_LOCATION];
  }

  for (let i = 0; i < WASMBOY_PALETTE_MEMORY_SIZE; i++) {
    wasmBoyPaletteMemory[i] =
      wasmByteMemory[i + WASMBOY_PALETTE_MEMORY_LOCATION];
  }

  for (let i = 0; i < WASMBOY_INTERNAL_MEMORY_SIZE; i++) {
    gameBoyMemory[i] = wasmByteMemory[i + WASMBOY_INTERNAL_MEMORY_LOCATION];
  }

  let saveState = Object.assign({}, WASMBOY_SAVE_STATE_SCHEMA);

  saveState.wasmBoyMemory.wasmBoyInternalState = wasmBoyInternalState;
  saveState.wasmBoyMemory.wasmBoyPaletteMemory = wasmBoyPaletteMemory;
  saveState.wasmBoyMemory.gameBoyMemory = gameBoyMemory;
  saveState.wasmBoyMemory.cartridgeRam = cartridgeRam;
  saveState.date = Date.now();
  saveState.isAuto = false;
  saveState.name = saveStateName;

  if (saveStateCallback) {
    saveState = saveStateCallback(saveState);
  }

  return saveState;
};

const loadSaveState = (wasmInstance, wasmByteMemory, saveState) => {
  for (let i = 0; i < WASMBOY_INTERNAL_STATE_SIZE; i++) {
    wasmByteMemory[i + WASMBOY_INTERNAL_STATE_LOCATION] =
      saveState.wasmBoyMemory.wasmBoyInternalState[i];
  }

  for (let i = 0; i < WASMBOY_PALETTE_MEMORY_SIZE; i++) {
    wasmByteMemory[i + WASMBOY_PALETTE_MEMORY_LOCATION] =
      saveState.wasmBoyMemory.wasmBoyPaletteMemory[i];
  }

  for (let i = 0; i < WASMBOY_INTERNAL_MEMORY_SIZE; i++) {
    wasmByteMemory[i + WASMBOY_INTERNAL_MEMORY_LOCATION] =
      saveState.wasmBoyMemory.gameBoyMemory[i];
  }

  for (let i = 0; i < saveState.wasmBoyMemory.cartridgeRam.length; i++) {
    wasmByteMemory[i + WASMBOY_GAME_RAM_BANKS_LOCATION] =
      saveState.wasmBoyMemory.cartridgeRam[i];
  }

  return true;
};

class WasmBoyMemoryService {
  constructor() {
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.saveStateCallback = undefined;
    this.loadedCartridgeMemoryState = {
      ROM: false,
      RAM: false
    };
  }

  initialize(wasmInstance, wasmByteMemory, saveStateCallback) {
    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;
    this.saveStateCallback = saveStateCallback;

    this._initializeConstants();

    const unloadHandler = () => {
      // Need to add a retrun value, and force all code in the block to be sync
      // https://stackoverflow.com/questions/7255649/window-onbeforeunload-not-working
      // http://vaughnroyko.com/idbonbeforeunload/
      // https://bugzilla.mozilla.org/show_bug.cgi?id=870645

      // Solution:
      // ~~Try to force sync: https://www.npmjs.com/package/deasync~~ Didn't work, requires fs
      // Save to local storage, and pick it back up in init: https://bugs.chromium.org/p/chromium/issues/detail?id=144862

      // Check if the game is currently playing
      if (this.wasmInstance.exports.hasCoreStarted() <= 0) {
        return null;
      }

      // Get our cartridge ram and header
      const header = getCartridgeHeader(this.wasmInstance, this.wasmByteMemory);
      const cartridgeRam = getCartridgeRam(
        this.wasmInstance,
        this.wasmByteMemory
      );

      // Get our save state, and un type our arrays
      const saveState = getSaveState(
        this.wasmInstance,
        this.wasmByteMemory,
        this.saveStateCallback
      );
      const saveStateMemoryKeys = Object.keys(saveState.wasmBoyMemory);
      for (let i = 0; i < saveStateMemoryKeys.length; i++) {
        saveState.wasmBoyMemory[
          saveStateMemoryKeys[i]
        ] = Array.prototype.slice.call(
          saveState.wasmBoyMemory[saveStateMemoryKeys[i]]
        );
      }

      // Set isAuto
      saveState.isAuto = true;

      // Need to vonert types arrays, and back, or selse wll get indexed JSON
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
      localStorage.setItem(
        WASMBOY_UNLOAD_STORAGE,
        JSON.stringify({
          header: Array.prototype.slice.call(header),
          cartridgeRam: Array.prototype.slice.call(cartridgeRam),
          saveState: saveState
        })
      );

      return null;
    };

    // Set listeners to ensure we save our cartridge ram before closing
    window.addEventListener(
      "beforeunload",
      () => {
        unloadHandler();
      },
      false
    );
    window.addEventListener(
      "unload",
      () => {
        unloadHandler();
      },
      false
    );
    window.addEventListener(
      "pagehide",
      () => {
        unloadHandler();
      },
      false
    );

    return new Promise((resolve, reject) => {
      // Load any unloaded storage in our localStorage
      const unloadStorage = localStorage.getItem(WASMBOY_UNLOAD_STORAGE);
      if (unloadStorage) {
        const unloadStorageObject = JSON.parse(unloadStorage);
        localStorage.removeItem(WASMBOY_UNLOAD_STORAGE);

        const header = new Uint8Array(unloadStorageObject.header);
        const cartridgeRam = new Uint8Array(unloadStorageObject.cartridgeRam);

        // Get our save state, and re-type our array
        const saveState = unloadStorageObject.saveState;
        if (saveState) {
          const saveStateMemoryKeys = Object.keys(saveState.wasmBoyMemory);
          for (let i = 0; i < saveStateMemoryKeys.length; i++) {
            saveState.wasmBoyMemory[saveStateMemoryKeys[i]] = new Uint8Array(
              saveState.wasmBoyMemory[saveStateMemoryKeys[i]]
            );
          }
        }

        this.saveCartridgeRam(header, cartridgeRam)
          .then(() => {
            this.saveState(header, saveState)
              .then(() => {
                return resolve();
              })
              .catch(error => {
                return reject(error);
              });
          })
          .catch(error => {
            return reject(error);
          });
      } else {
        return resolve();
      }
    });
  }

  initializeHeadless(wasmInstance, wasmByteMemory, saveStateCallback) {
    this.wasmInstance = wasmInstance;
    this.wasmByteMemory = wasmByteMemory;
    this.saveStateCallback = saveStateCallback;

    this._initializeConstants();
  }

  _initializeConstants() {
    // Initialiuze our cached wasm constants
    WASMBOY_GAME_BYTES_LOCATION = this.wasmInstance.exports.gameBytesLocation;
    WASMBOY_GAME_RAM_BANKS_LOCATION = this.wasmInstance.exports
      .gameRamBanksLocation;
    WASMBOY_INTERNAL_STATE_SIZE = this.wasmInstance.exports
      .wasmBoyInternalStateSize;
    WASMBOY_INTERNAL_STATE_LOCATION = this.wasmInstance.exports
      .wasmBoyInternalStateLocation;
    WASMBOY_INTERNAL_MEMORY_SIZE = this.wasmInstance.exports
      .gameBoyInternalMemorySize;
    WASMBOY_INTERNAL_MEMORY_LOCATION = this.wasmInstance.exports
      .gameBoyInternalMemoryLocation;
    WASMBOY_PALETTE_MEMORY_SIZE = this.wasmInstance.exports
      .gameboyColorPaletteSize;
    WASMBOY_PALETTE_MEMORY_LOCATION = this.wasmInstance.exports
      .gameboyColorPaletteLocation;
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
  resetMemory() {
    for (let i = 0; i <= WASMBOY_GAME_BYTES_LOCATION; i++) {
      this.wasmByteMemory[i] = 0;
    }

    this.loadedCartridgeMemoryState.RAM = false;
  }

  loadCartridgeRom(gameBytes, isGbcEnabled, bootRom) {
    // Load the game data into actual memory
    for (let i = 0; i < gameBytes.length; i++) {
      if (gameBytes[i]) {
        this.wasmByteMemory[WASMBOY_GAME_BYTES_LOCATION + i] = gameBytes[i];
      }
    }

    // TODO: Handle getting a boot rom
    this.wasmInstance.exports.initialize(isGbcEnabled ? 1 : 0, 0);

    this.loadedCartridgeMemoryState.ROM = true;
  }

  // Function to save the cartridge ram
  // This emulates the cartridge having a battery to
  // Keep things like Pokemon Save data in memory
  // Also allows passing in a a Uint8Array header and ram to be set manually
  saveCartridgeRam(passedHeader, passedCartridgeRam) {
    return new Promise((resolve, reject) => {
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
        header = getCartridgeHeader(this.wasmInstance, this.wasmByteMemory);
        cartridgeRam = getCartridgeRam(this.wasmInstance, this.wasmByteMemory);
      }

      if (!header || !cartridgeRam) {
        console.error(
          "Error parsing the cartridgeRam or cartridge header",
          header,
          cartridgeRam
        );
        reject("Error parsing the cartridgeRam or cartridge header");
      }

      // Get our cartridge object
      idbKeyval
        .get(header)
        .then(cartridgeObject => {
          if (!cartridgeObject) {
            cartridgeObject = {};
          }

          // Set the cartridgeRam to our cartridgeObject
          cartridgeObject.cartridgeRam = cartridgeRam;

          idbKeyval
            .set(header, cartridgeObject)
            .then(() => {
              resolve();
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  // function to load the cartridge ram
  // opposite of above
  loadCartridgeRam() {
    return new Promise((resolve, reject) => {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      const header = getCartridgeHeader(this.wasmInstance, this.wasmByteMemory);

      if (!header) {
        reject("Error parsing the cartridge header");
      }

      idbKeyval
        .get(header)
        .then(cartridgeObject => {
          if (!cartridgeObject || !cartridgeObject.cartridgeRam) {
            resolve();
            return;
          }

          // Set the cartridgeRam
          for (let i = 0; i < cartridgeObject.cartridgeRam.length; i++) {
            this.wasmByteMemory[WASMBOY_GAME_RAM_BANKS_LOCATION + i] =
              cartridgeObject.cartridgeRam[i];
          }
          this.loadedCartridgeMemoryState.RAM = true;
          resolve();
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  // Function to save the state to the indexeddb
  saveState(passedHeader, passedSaveState) {
    return new Promise((resolve, reject) => {
      // Save our internal wasmboy state to memory
      this.wasmInstance.exports.saveState();

      // Get our save state
      let saveState;
      let header;
      if (passedHeader && passedSaveState) {
        saveState = passedSaveState;
        header = passedHeader;
      } else {
        saveState = getSaveState(
          this.wasmInstance,
          this.wasmByteMemory,
          this.saveStateCallback
        );
        header = getCartridgeHeader(this.wasmInstance, this.wasmByteMemory);
      }

      if (!header) {
        reject("Error parsing the cartridge header");
      }

      idbKeyval
        .get(header)
        .then(cartridgeObject => {
          if (!cartridgeObject) {
            cartridgeObject = {};
          }

          if (!cartridgeObject.saveStates) {
            cartridgeObject.saveStates = [];
          }

          cartridgeObject.saveStates.push(saveState);

          idbKeyval
            .set(header, cartridgeObject)
            .then(() => {
              resolve();
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  loadState(saveState) {
    return new Promise((resolve, reject) => {
      const header = getCartridgeHeader(this.wasmInstance, this.wasmByteMemory);

      if (!header) {
        reject("Error parsing the cartridge header");
      }

      if (saveState) {
        loadSaveState(this.wasmInstance, this.wasmByteMemory, saveState);

        // Load back out internal wasmboy state from memory
        this.wasmInstance.exports.loadState();

        resolve();
      } else {
        idbKeyval
          .get(header)
          .then(cartridgeObject => {
            if (!cartridgeObject || !cartridgeObject.saveStates) {
              reject("No Save State passed, and no cartridge object found");
              return;
            }

            // Load the last save state
            loadSaveState(
              this.wasmInstance,
              this.wasmByteMemory,
              cartridgeObject.saveStates[0]
            );

            // Load back out internal wasmboy state from memory
            this.wasmInstance.exports.loadState();

            resolve();
          })
          .catch(error => {
            reject(error);
          });
      }
    });
  }

  // Function to reset the state of the wasm core
  resetState(isGbcEnabled, bootRom) {
    this.resetMemory();

    // TODO: Handle getting a boot rom
    this.wasmInstance.exports.initialize(isGbcEnabled ? 1 : 0, 0);
  }

  // Function to return the current cartridge object
  getCartridgeObject() {
    const header = getCartridgeHeader(this.wasmInstance, this.wasmByteMemory);
    return idbKeyval.get(header);
  }
}

// Create a singleton to export
export const WasmBoyMemory = new WasmBoyMemoryService();
