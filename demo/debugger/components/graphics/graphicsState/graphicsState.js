import { WasmBoy } from '../../../wasmboy';

import ValueTable from '../../valueTable.js';
import './graphicsState.css';

export default class GraphicsState extends ValueTable {
  constructor() {
    super();

    this.state.title = 'Graphics';
  }

  intervalUpdate() {
    if (!WasmBoy.isReady()) {
      return;
    }

    const updateTask = async () => {
      const valueTable = {};

      // Get all of the gameboy 0xffXX memory
      const debugMemoryStart = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff00]);
      const debugMemoryEnd = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xffff]);
      const debugMemory = await WasmBoy._getWasmMemorySection(debugMemoryStart, debugMemoryEnd + 1);

      // Update CPU valueTable
      valueTable['Scanline Register (LY) - 0xFF44'] = await WasmBoy._runWasmExport('getLY');
      valueTable['LCD Status (STAT) - 0xFF41'] = debugMemory[0x0041];
      valueTable['LCD Control (LCDC) - 0xFF40'] = debugMemory[0x0040];
      valueTable['LCD Coincidence Compare - 0xFF45'] = debugMemory[0x0045];
      valueTable['Scroll X - 0xFF43'] = debugMemory[0x0043];
      valueTable['Scroll Y - 0xFF42'] = debugMemory[0x0042];
      valueTable['Window X - 0xFF4B'] = debugMemory[0x004b];
      valueTable['Window Y - 0xFF4A'] = debugMemory[0x004a];

      this.setState({
        ...this.state,
        object: valueTable
      });
    };
    updateTask();
  }
}
