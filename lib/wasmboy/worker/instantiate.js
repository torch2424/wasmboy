// Function to instantiate our wasm module
import { postMessage } from '../../worker/workerapi';
import { isInBrowser, readBase64Buffer } from '../../worker/util';
import importObject from './importobject';

// Function to instantiate our wasm and respond back
export const instantiateWasm = async wasmModuleUrl => {
  let response = undefined;

  if (isInBrowser) {
    response = await wasmBrowserInstantiate(wasmModuleUrl);
  } else {
    response = await wasmNodeInstantiate(wasmModuleUrl);
  }

  // Set our wasmInstance and byte memory in the main thread
  const wasmInstance = response.instance;
  const wasmByteMemory = new Uint8Array(wasmInstance.exports.memory.buffer);
  return {
    wasmInstance,
    wasmByteMemory
  };
};

const wasmBrowserInstantiate = async wasmModuleUrl => {
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

  return response;
};

const wasmNodeInstantiate = async wasmModuleUrl => {
  const wasmBuffer = readBase64Buffer(wasmModuleUrl);
  return await WebAssembly.instantiate(wasmBuffer, {
    env: {
      log: () => {},
      hexLog: () => {},
      performanceTimestamp: () => {}
    }
  });
};
