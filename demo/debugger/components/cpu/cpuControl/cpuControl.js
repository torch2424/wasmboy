import { h, Component } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import ValueTable from '../../valueTable.js';
import './cpuControl.css';

import { stepOpcode } from '../opcode.js';

export default class CpuControl extends Component {
  constructor() {
    super();
  }

  stepOpcode() {
    stepOpcode();
  }

  render() {
    return (
      <div class="cpu-control">
        <h1>CPU Control</h1>

        {/* Single Stepping */}
        <button onclick={() => this.stepOpcode()}>Step Opcode</button>

        {/* Run a specified number */}

        {/* Break Points */}
      </div>
    );
  }
}
