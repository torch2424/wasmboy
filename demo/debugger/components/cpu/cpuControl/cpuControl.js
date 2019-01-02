import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import ValueTable from '../../valueTable.js';
import './cpuControl.css';

import { stepOpcode, runNumberOfOpcodes, runUntilBreakPoint } from '../opcode.js';

export default class CpuControl extends Component {
  constructor() {
    super();

    this.state.isBusy = false;
  }

  stepOpcode() {
    if (!WasmBoy.isReady()) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please load a ROM. 💾');
      return;
    }

    stepOpcode();
  }

  runNumberOfOpcodes() {
    if (!WasmBoy.isReady()) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please load a ROM. 💾');
      return;
    }

    const numberOfOpcodes = Math.floor(this.state.numberOfOpcodes);

    if (!numberOfOpcodes || numberOfOpcodes < 1) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please enter a valid value. 😄');
      return;
    }

    this.setState({
      isBusy: true
    });
    runNumberOfOpcodes(numberOfOpcodes).then(() => {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification(`Ran ${numberOfOpcodes} opcodes! 😄`);

      this.setState({
        isBusy: false
      });
    });
  }

  runUntilBreakPoint() {
    if (!WasmBoy.isReady()) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please load a ROM. 💾');
      return;
    }

    const breakPoint = Math.floor(this.state.breakPoint);

    if (!breakPoint || breakPoint < 0) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please enter a valid value. 😄');
      return;
    }

    this.setState({
      isBusy: true
    });

    runUntilBreakPoint(breakPoint).then(() => {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification(`Ran until the 0x${breakPoint} break point! 😄`);

      this.setState({
        isBusy: false
      });
    });
  }

  render() {
    if (this.state.isBusy) {
      // TODO:
      return <div>Running...</div>;
    }

    return (
      <div class="cpu-control">
        <h1>CPU Control</h1>

        {/* Single Stepping */}
        <div>
          <button onClick={() => this.stepOpcode()}>Step Opcode</button>
        </div>

        {/* Run a specified number */}
        <div>
          <label for="runNumberOfOpcodes">Number of Opcodes to run:</label>
          <input
            type="number"
            step="1"
            min="1"
            value={this.state.numberOfOpcodes}
            onChange={event => this.setState({ numberOfOpcodes: event.target.value })}
          />
          <button onClick={() => this.runNumberOfOpcodes()}>Run Number of Opcodes</button>
        </div>

        {/* Break Points */}
        <div>
          <label for="runNumberOfOpcodes">Run until breakpoint (In Hex): 0x</label>
          <input
            type="number"
            step="1"
            min="0"
            value={this.state.breakPoint}
            onChange={event => this.setState({ breakPoint: event.target.value })}
          />
          <button onClick={() => this.runUntilBreakPoint()}>Run Until Break Point</button>
        </div>
      </div>
    );
  }
}
