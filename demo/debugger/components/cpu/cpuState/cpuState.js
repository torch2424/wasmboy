import { h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import ValueTable from '../../valueTable.js';
import './cpuState.css';

export default class CpuState extends ValueTable {
  constructor() {
    super();

    this.state.title = 'CPU';
  }

  intervalUpdate() {
    if (!WasmBoy.isReady()) {
      return;
    }

    const updateTask = async () => {
      const valueTable = {};

      // Update CPU valueTable
      valueTable['Program Counter (PC)'] = await WasmBoy._runWasmExport('getProgramCounter');
      valueTable['Opcode at PC'] = await WasmBoy._runWasmExport('getOpcodeAtProgramCounter');
      valueTable['Stack Pointer'] = await WasmBoy._runWasmExport('getStackPointer');
      valueTable['Register A'] = await WasmBoy._runWasmExport('getRegisterA');
      valueTable['Register F'] = await WasmBoy._runWasmExport('getRegisterF');
      valueTable['Register B'] = await WasmBoy._runWasmExport('getRegisterB');
      valueTable['Register C'] = await WasmBoy._runWasmExport('getRegisterC');
      valueTable['Register D'] = await WasmBoy._runWasmExport('getRegisterD');
      valueTable['Register E'] = await WasmBoy._runWasmExport('getRegisterE');
      valueTable['Register H'] = await WasmBoy._runWasmExport('getRegisterH');
      valueTable['Register L'] = await WasmBoy._runWasmExport('getRegisterL');

      const cyclesRan = await WasmBoy._getCyclesAsString();

      this.setState({
        ...this.state,
        object: valueTable,
        headerElement: <div>Cycles Ran: {cyclesRan}</div>
      });
    };
    updateTask();
  }
}
