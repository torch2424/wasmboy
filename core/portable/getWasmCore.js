// JS Implementation of Instantiating the Wasm Build

// Import our web assembly module
import wasmModuleUrl from '../../dist/core/core.untouched.wasm';

// Import our wasm import object
import importObject from './importObject';

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

const readBase64Buffer = base64String => {
  return Buffer.from(base64String.split(',')[1], 'base64');
};

const wasmNodeInstantiate = async wasmModuleUrl => {
  const wasmBuffer = readBase64Buffer(wasmModuleUrl);
  return await WebAssembly.instantiate(wasmBuffer, importObject);
};

// Function to instantiate our wasm and respond back
const getWasmBoyWasmCore = async () => {
  let response = undefined;

  /*ROLLUP_REPLACE_BROWSER
  response = await wasmBrowserInstantiate(wasmModuleUrl);
  ROLLUP_REPLACE_BROWSER*/

  /*ROLLUP_REPLACE_NODE
  response = await wasmNodeInstantiate(wasmModuleUrl);
  ROLLUP_REPLACE_NODE*/

  // Set our wasmInstance and byte memory in the main thread
  const instance = response.instance;
  const byteMemory = new Uint8Array(instance.exports.memory.buffer);
  return {
    instance,
    byteMemory,
    type: 'wasm'
  };
};

export default getWasmBoyWasmCore;
