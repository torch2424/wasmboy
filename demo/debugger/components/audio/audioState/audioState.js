import { WasmBoy } from '../../../wasmboy';

import ValueTable from '../../valueTable.js';
import './audioState.css';

export default class AudioState extends ValueTable {
  constructor() {
    super();

    this.state.title = 'Audio';
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

      // Update APU valueTable
      // Add the register valueTable for our 4 channels
      for (let channelNum = 1; channelNum <= 4; channelNum++) {
        for (let registerNum = 0; registerNum < 5; registerNum++) {
          let registerAddress = 0xff10 + 5 * (channelNum - 1) + registerNum;
          valueTable[`Channel ${channelNum} - NR${channelNum}${registerNum} - 0x${registerAddress.toString(16).toUpperCase()}`] =
            debugMemory[registerAddress & 0x00ff];
        }
      }

      this.setState({
        ...this.state,
        object: valueTable
      });
    };
    updateTask();
  }
}
