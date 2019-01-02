import { WasmBoy } from '../../../wasmboy';

import ValueTable from '../../valueTable.js';
import './timerState.css';

export default class TimerState extends ValueTable {
  constructor() {
    super();

    this.state.title = 'Timer';
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

      // Update Timers valueTable
      valueTable['TIMA - 0xFF05'] = await WasmBoy._runWasmExport('getTIMA');
      valueTable['TMA - 0xFF06'] = await WasmBoy._runWasmExport('getTMA');
      valueTable['TIMC/TAC - 0xFF07'] = await WasmBoy._runWasmExport('getTAC');
      valueTable['DIV/Divider Register - 0xFF04'] = await WasmBoy._runWasmExport('getDIV');

      this.setState({
        ...this.state,
        object: valueTable
      });
    };
    updateTask();
  }
}
