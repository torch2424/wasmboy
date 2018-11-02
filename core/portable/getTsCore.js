import * as WasmBoyCore from '../../dist/core/core.esm';

const getWasmBoyTsCore = async () => {
  const response = {
    instance: {
      exports: WasmBoyCore
    },
    byteMemory: WasmBoyCore.memory.wasmByteMemory,
    type: 'js'
  };
  return response;
};

export default getWasmBoyTsCore;
