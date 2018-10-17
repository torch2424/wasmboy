// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyController } from '../controller/controller';
import { WasmBoyMemory } from '../memory/memory';

// Fetch our rom
import { fetchROMAsByteArray } from './fetchrom';

// Get our worker message types
import { WORKER_MESSAGE_TYPE } from '../worker/constants';

// Import our web assembly module
import wasmModuleUrl from '../../dist/core/index.untouched.wasm';

// Finish request for wasm module, and fetch game
// Should bind the wasmboy this here
export function loadROMToWasmBoy(ROM, fetchHeaders) {
  // Getting started with wasm
  // http://webassembly.org/getting-started/js-api/
  this.ready = false;
  this.loadedAndStarted = false;

  const initializeTask = async () => {
    // Get our promises
    const initPromises = [fetchROMAsByteArray(ROM, fetchHeaders), this._instantiateWorkers()];

    if (!this.options.headless && WasmBoyMemory.getLoadedCartridgeMemoryState().RAM) {
      initPromises.push(WasmBoyMemory.saveCartridgeRam());
    }

    await Promise.all(initPromises);

    // Now tell the wasm module to instantiate wasm
    return this.worker.postMessage({
      type: WORKER_MESSAGE_TYPE.INSTANTIATE_WASM,
      wasmModuleUrl
    });
  };

  const loadROMAndConfigTask = async responses => {
    // Clear what is currently in memory, then load the cartridge memory
    await WasmBoyMemory.clearMemory();
    WasmBoyMemory.resetState();

    // TODO: Handle passing a boot rom
    WasmBoyMemory.loadCartridgeRom(responses[0]);

    // Save the game that we loaded if we need to reload the game
    this.loadedROM = responses[0];

    // Run our initialization on the core
    this.wasmInstance.exports.config(
      0, // TODO: Include Boot Rom
      this.options.isGbcEnabled ? 1 : 0,
      this.options.audioBatchProcessing ? 1 : 0,
      this.options.graphicsBatchProcessing ? 1 : 0,
      this.options.timersBatchProcessing ? 1 : 0,
      this.options.graphicsDisableScanlineRendering ? 1 : 0,
      this.options.audioAccumulateSamples ? 1 : 0,
      this.options.tileRendering ? 1 : 0,
      this.options.tileCaching ? 1 : 0
    );
  };

  const loadROMTask = async () => {
    // Pause wasmBoy
    await this.pause();

    // Initialize any needed parts of wasmboy
    let responses = await initializeTask();

    // Check if we are running headless
    if (this.options.headless) {
      await WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback);

      await loadROMAndConfigTask(responses);

      this.ready = true;
      if (this.options.onReady) {
        this.options.onReady();
      }
    } else {
      // Finally intialize all of our services
      // Initialize our services
      await Promise.all([
        WasmBoyGraphics.initialize(this.canvasElement, this.options.updateGraphicsCallback),
        WasmBoyAudio.initialize(this.options.updateAudioCallback),
        WasmBoyController.initialize(),
        WasmBoyMemory.initialize(this.options.headless, this.options.saveStateCallback)
      ]);

      await loadROMAndConfigTask(responses);

      // Load the game's cartridge ram
      await WasmBoyMemory.loadCartridgeRam();

      this.ready = true;
      if (this.options.onReady) {
        this.options.onReady();
      }
    }
  };

  return loadROMTask();
}
