import { WasmBoy as WasmBoyWasm } from '../../dist/wasmboy.wasm.esm';
import { WasmBoy as WasmBoyTs } from '../../dist/wasmboy.ts.esm';

import backToColor from '../performance/testroms/back-to-color/back-to-color.gbc';
import tobuTobuGirl from '../performance/testroms/tobutobugirl/tobutobugirl.gb';

const WasmBoyLibs = {
  wasm: WasmBoyWasm,
  ts: WasmBoyTs,
  roms: {
    backToColor,
    tobuTobuGirl
  }
};

export default WasmBoyLibs;
