import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import './backgroundMap.css';

export default class BackgroundMap extends Component {
  constructor() {
    super();
  }

  render() {
    return (
      <div>
        <h1>Background Map</h1>
        <canvas />
      </div>
    );
  }
}
