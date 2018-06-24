// Build our public lib api
import { WasmBoyLib } from './wasmboy/wasmboy';
import { WasmBoyController } from './controller/controller';
import { WasmBoyMemory } from './memory/memory';
import { saveCurrentAudioBufferToWav } from './debug/debug';

// Debugging properties prepended with _

// export an object that public exposes parts of the singleton
// Need to bind to preserve this
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_objects/Function/bind
export const WasmBoy = {
  config: WasmBoyLib.config.bind(WasmBoyLib),
  getConfig: WasmBoyLib.getConfig.bind(WasmBoyLib),
  setCanvas: WasmBoyLib.setCanvas.bind(WasmBoyLib),
  getCanvas: WasmBoyLib.getCanvas.bind(WasmBoyLib),
  loadROM: WasmBoyLib.loadROM.bind(WasmBoyLib),
  play: WasmBoyLib.play.bind(WasmBoyLib),
  pause: WasmBoyLib.pause.bind(WasmBoyLib),
  reset: WasmBoyLib.reset.bind(WasmBoyLib),
  isPlaying: () => {
    return !WasmBoyLib.paused;
  },
  isPaused: () => {
    return WasmBoyLib.paused;
  },
  isReady: () => {
    return WasmBoyLib.ready;
  },
  saveState: WasmBoyLib.saveState.bind(WasmBoyLib),
  getSaveStates: WasmBoyLib.getSaveStates.bind(WasmBoyLib),
  loadState: WasmBoyLib.loadState.bind(WasmBoyLib),
  getFPS: WasmBoyLib.getFPS.bind(WasmBoyLib),
  enableDefaultJoypad: WasmBoyController.enableDefaultJoypad.bind(WasmBoyController),
  disableDefaultJoypad: WasmBoyController.disableDefaultJoypad.bind(WasmBoyController),
  setJoypadState: WasmBoyController.setJoypadState.bind(WasmBoyController),
  addTouchInput: WasmBoyController.addTouchInput.bind(WasmBoyController),
  removeTouchInput: WasmBoyController.removeTouchInput.bind(WasmBoyController),
  _getWasmInstance: () => {
    return WasmBoyLib.wasmInstance;
  },
  _setWasmInstance: instance => {
    WasmBoyLib.wasmInstance = instance;
  },
  _getWasmByteMemory: () => {
    return WasmBoyLib.wasmByteMemory;
  },
  _setWasmByteMemory: wasmByteMemory => {
    WasmBoyLib.wasmByteMemory = wasmByteMemory;
  },
  _saveCurrentAudioBufferToWav: saveCurrentAudioBufferToWav,
  _getCartridgeInfo: WasmBoyMemory.getCartridgeInfo.bind(WasmBoyMemory)
};
