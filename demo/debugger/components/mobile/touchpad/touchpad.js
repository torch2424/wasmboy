// Base Component to handle showing mobile UIs

import { h, Component } from 'preact';
import { WasmBoy } from '../../../wasmboy';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import {
  vaporboyExpandedDpad,
  vaporboyExpandedAButton,
  vaporboyExpandedBButton,
  vaporboyExpandedStartButton,
  vaporboyExpandedSelectButton
} from './vaporboyButtons';

import './touchpad.css';

export default class Touchpad extends Component {
  constructor() {
    super();
  }

  componentDidMount() {}

  render() {
    return (
      <div class="touchpad-container">
        <div class="gameboy-input">
          <div class="gameboy-input__dpad">{vaporboyExpandedDpad}</div>

          <div class="gameboy-input__b">{vaporboyExpandedBButton}</div>
          <div class="gameboy-input__a">{vaporboyExpandedAButton}</div>

          <div class="gameboy-input__select">{vaporboyExpandedSelectButton}</div>
          <div class="gameboy-input__start">{vaporboyExpandedStartButton}</div>
        </div>

        <div class="debugger-input" />
      </div>
    );
  }
}
