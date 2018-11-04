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
const getWasmBoyWasmCore = async isInBrowser => {
  let response = undefined;

  // Allow forcing the browser mode, but also check manually
  if (isInBrowser) {
    response = await wasmBrowserInstantiate(wasmModuleUrl);
  } else {
    if (typeof window !== 'undefined' || typeof self !== 'undefined') {
      response = await wasmBrowserInstantiate(wasmModuleUrl);
    } else {
      response = await wasmNodeInstantiate(wasmModuleUrl);
    }
  }

  // Set our wasmInstance and byte memory in the main thread
  const instance = response.instance;
  const byteMemory = new Uint8Array(instance.exports.memory.buffer);
  return {
    instance,
    byteMemory,
    type: 'Web Assembly'
  };
};

export default getWasmBoyWasmCore;
