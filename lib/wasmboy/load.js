// Functions here are depedent on WasmBoyMemory state.
// Thus me bound using .bind() on functions

import { WasmBoyPlugins } from '../plugins/plugins';

// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyController } from '../controller/controller';
import { WasmBoyMemory } from '../memory/memory';

// Fetch our rom
import { fetchROMAsByteArray } from './fetchrom';

// Get our worker message types
import { WORKER_MESSAGE_TYPE } from '../worker/constants';

// Function to initialize the workers / set up wasm module
// Getting started with wasm
// http://webassembly.org/getting-started/js-api/
async function initialize() {
  if (this.initialized) {
    return;
  }

  this.ready = false;
  this.loadedAndStarted = false;

  // Instantiate our workers
  await this._instantiateWorkers();

  // Now tell the wasm module to instantiate wasm
  const response = await this.worker.postMessage({
    type: WORKER_MESSAGE_TYPE.INSTANTIATE_WASM
  });

  this.coreType = response.message.type;

  // Set up Memory
  await WasmBoyMemory.initialize(this.options.headless, this.options.maxNumberOfAutoSaveStates, this.options.saveStateCallback);

  // Clear what is currently in memory, then load the cartridge memory
  await WasmBoyMemory.clearMemory();

  this.initialized = true;
}

// Finish request for wasm module, and fetch game
// NOTE: **Should bind the wasmboy this here**
export function loadROMToWasmBoy(ROM, fetchHeaders) {
  const loadROMAndConfigTask = async () => {
    // Save cartridge RAM if have it
    if (!this.options.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
      await WasmBoyMemory.saveCartridgeRam();
    }

    // Get our fetch rom object
    const fetchROMObject = await fetchROMAsByteArray(ROM, fetchHeaders);

    await WasmBoyMemory.loadCartridgeRom(fetchROMObject.ROM, fetchROMObject.name);

    // Load a Boot ROM
    if (this.options.enableBootROMIfAvailable) {
      // Get the cartridge info
      const cartridgeInfo = await WasmBoyMemory.getCartridgeInfo();

      if (cartridgeInfo.CGBFlag) {
        await WasmBoyMemory.loadBootROMIfAvailable(WasmBoyMemory.SUPPORTED_BOOT_ROM_TYPES.GBC);
      } else {
        await WasmBoyMemory.loadBootROMIfAvailable(WasmBoyMemory.SUPPORTED_BOOT_ROM_TYPES.GB);
      }
    }

    // Save the game that we loaded if we need to reload the game
    this.loadedROM = ROM;

    // Run our initialization on the core
    await this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.CONFIG,
      config: [
        WasmBoyMemory.loadedCartridgeMemoryState.BOOT ? 1 : 0, // Loaded Boot Rom
        this.options.isGbcEnabled ? 1 : 0,
        this.options.audioBatchProcessing ? 1 : 0,
        this.options.graphicsBatchProcessing ? 1 : 0,
        this.options.timersBatchProcessing ? 1 : 0,
        this.options.graphicsDisableScanlineRendering ? 1 : 0,
        this.options.audioAccumulateSamples ? 1 : 0,
        this.options.tileRendering ? 1 : 0,
        this.options.tileCaching ? 1 : 0,
        this.options.enableAudioDebugging ? 1 : 0
      ],
      options: {
        gameboyFrameRate: this.options.gameboyFrameRate,
        headless: this.options.headless,
        isAudioEnabled: this.options.isAudioEnabled,
        isGbcColorizationEnabled: this.options.isGbcColorizationEnabled,
        gbcColorizationPalette: this.options.gbcColorizationPalette,
        enableAudioDebugging: this.options.enableAudioDebugging,
        frameSkip: this.options.frameSkip
      }
    });
  };

  const loadROMTask = async () => {
    // Pause wasmBoy
    await this.pause();

    await initialize.bind(this)();

    // Check if we are running headless
    if (this.options.headless) {
      await loadROMAndConfigTask();

      this.ready = true;
      if (this.options.onReady) {
        this.options.onReady();
      }
      WasmBoyPlugins.runHook({
        key: 'ready'
      });
    } else {
      // Finally intialize all of our services
      // Initialize our services
      // Except memory, which would already be initialized
      await Promise.all([
        WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback),
        WasmBoyAudio.initialize(this.options.updateAudioCallback),
        WasmBoyController.initialize()
      ]);

      await loadROMAndConfigTask();

      // Load the game's cartridge ram
      await WasmBoyMemory.loadCartridgeRam();

      this.ready = true;
      if (this.options.onReady) {
        this.options.onReady();
      }
      WasmBoyPlugins.runHook({
        key: 'ready'
      });
    }
  };

  return loadROMTask();
}
