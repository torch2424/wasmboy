import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import VirtualList from 'preact-virtual-list';

let unsubLoading = false;

export default class Disassembler extends Component {
  constructor() {
    super();

    // 30 px rows
    this.rowHeight = 30;
  }

  componentDidMount() {
    unsubLoading = Pubx.subscribe(PUBX_KEYS.LOADING, newState => this.checkControlLoading(newState));
    this.checkControlLoading(Pubx.get(PUBX_KEYS.LOADING));
  }

  componentWillUnmount() {
    if (unsubLoading) {
      unsubLoading();
    }
  }

  checkControlLoading(newState) {
    if (newState.controlLoading) {
      this.base.classList.add('disassembler--control-loading');
    } else {
      this.base.classList.remove('disassembler--control-loading');
    }
  }

  renderRow() {}

  render() {
    return (
      <div class="disassembler">
        <h1>Disassembler</h1>
        <VirtualList class="disassembler__list" data={DATA} rowHeight={this.rowHeight} renderRow={this.renderRow} />
      </div>
    );
  }
}
