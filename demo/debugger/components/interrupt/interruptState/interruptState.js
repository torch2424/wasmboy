import { WasmBoy } from '../../../wasmboy';

import ValueTable from '../../valueTable.js';
import './interruptState.css';

export default class InterruptState extends ValueTable {
  constructor() {
    super();

    this.state.title = 'Interrupt';
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

      // Update interrupts valueTable
      // TODO: Interrupot master switch
      // if(WasmBoy._getWasmInstance().exports.areInterruptsEnabled()) {
      //   valueTable.interrupts['Interrupt Master Switch'] = 0x01;
      // } else {
      //   valueTable.interrupts['Interrupt Master Switch'] = 0x00;
      // }
      valueTable['IE/Interrupt Enabled - 0xFFFF'] = debugMemory[0x00ff];
      valueTable['IF/Interrupt Request - 0xFF0F'] = debugMemory[0x000f];

      this.setState({
        ...this.state,
        object: valueTable
      });
    };
    updateTask();
  }
}
