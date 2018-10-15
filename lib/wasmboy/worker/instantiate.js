// Function to instantiate our wasm module

import { postMessage } from '../../worker/workerapi';
import importObject from './importobject';

// Function to instantiate our wasm and respond back
export const instantiateWasm = async (wasmModuleUrl, wasmInstance, wasmByteMemory) => {
  let response = undefined;

  // Safari does not support .instantiateStreaming()
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/instantiateStreaming
  if (WebAssembly.instantiateStreaming) {
    response = await WebAssembly.instantiateStreaming(fetch(wasmModuleUrl), importObject);
  } else {
    const fetchAndInstantiateTask = async () => {
      const wasmArrayBuffer = await fetch(wasmModuleUrl).then(response => response.arrayBuffer());
      return WebAssembly.instantiate(wasmArrayBuffer, importObject);
    };
    response = await fetchAndInstantiateTask();
  }

  // Set our wasmInstance and byte memory in the main thread
  wasmInstance = response.instance;
  wasmByteMemory = new Uint8Array(wasmInstance.exports.memory.buffer);

  postMessage('Instantiated Wasm!');
};
