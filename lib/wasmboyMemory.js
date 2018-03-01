import Promise from 'promise-polyfill';


// Get our idb-keyval instance
const idbKeyval = require('idb-keyval');

// Declare some memory constants
const MEMORY_ADDRESSES = {
  CARTRIDGE_RAM: 0x843400,
  CARTRIDGE_ROM: 0x043400
};

// Private function to get the cartridge header
const getCartridgeHeader = (wasmByteMemory) => {
  // Header is at 0x0134 - 0x014F
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  const headerLength = 0x014F - 0x0134;
  const headerArray = new Uint8Array(headerLength);
  for(let i = 0; i <= headerLength; i++) {
    // Get the CARTRIDGE_ROM + the offset to point us at the header, plus the current byte
    headerArray[i] = wasmByteMemory[MEMORY_ADDRESSES.CARTRIDGE_ROM + 0x0134 + i];
  }

  return headerArray;
}

// Private function to get the caretridge ram
const getCartridgeRam = (wasmByteMemory) => {
  // Depening on the rom type, we will have different ram sizes.
  // Due memory restrictions described in:
  // https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/offline-for-pwa
  // We will make sure to only store as much as we need per ROM :)

  // Similar to `initializeCartridgeType()` in `wasm/memory/memory.ts`
  // We will determine our cartridge type
  // Get our game MBC type from the cartridge header
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  let cartridgeType = wasmByteMemory[0x043400 + 0x0147];

  let ramSize = undefined;
  if(cartridgeType === 0x00) {
    // No memory for this rom type
    return false;
  } else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
    // MBC1 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
    // MBC2 512X4 Bytes, 2KB
    ramSize = 0x800;
  } else if (cartridgeType >= 0x0F && cartridgeType <= 0x13) {
    // MBC3 32KB of Ram
    ramSize = 0x8000;
  } else if (cartridgeType >= 0x19 && cartridgeType <= 0x1E) {
    // MBC5 128KB of Ram
    ramSize = 0x20000;
  }

  if(!ramSize) {
    return false;
  }

  // Finally fill our cartridgeRam from the ram in memory
  const cartridgeRam = new Uint8Array(ramSize);

  for(let i = 0; i < (ramSize); i++) {
    cartridgeRam[i] = wasmByteMemory[MEMORY_ADDRESSES.CARTRIDGE_RAM + i];
  }

  return cartridgeRam;
}

class WasmBoyMemoryService {

  constructor() {
    this.wasmByteMemory = undefined;
  }

  initialize(wasmByteMemory) {
    this.wasmByteMemory = wasmByteMemory;

    // Set listeners to ensure we save our cartridge ram before closing
    window.addEventListener("beforeunload", () => {
      this.saveCartridgeRam();
    }, false);


    return Promise.resolve();
  }

  // Function to save the cartridge ram
  // This emulates the cartridge having a battery to
  // Keep things like Pokemon Save data in memory
  saveCartridgeRam() {
    return new Promise((resolve, reject) => {
      // Get the entire header in byte memory
      // Each version of a rom can have similar title and checksums
      // Therefore comparing all of it should help with this :)
      // https://drive.google.com/file/d/0B7y-o-Uytiv9OThXWXFCM1FPbGs/view
      const header = getCartridgeHeader(this.wasmByteMemory);
      const cartridgeRam = getCartridgeRam(this.wasmByteMemory);

      if(!header || !cartridgeRam) {
        reject('Error parsing the cartridgeRam or cartridge header');
      }

      idbKeyval.set(header, cartridgeRam).then(() => {
        resolve();
      }).catch((error) => {
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
      const header = getCartridgeHeader(this.wasmByteMemory);

      if(!header) {
        reject('Error parsing the cartridge header');
      }

      idbKeyval.get(header).then((cartridgeRam) => {

        if(!cartridgeRam) {
          resolve();
          return;
        }

        // Set the cartridgeRam
        for(let i = 0; i < cartridgeRam.length; i++) {
           this.wasmByteMemory[MEMORY_ADDRESSES.CARTRIDGE_RAM + i] = cartridgeRam[i];
        }
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }
}

// Create a singleton to export
export const WasmBoyMemory = new WasmBoyMemoryService();