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

  componentDidMount() {
    // Add our touch inputs
    const dpadElement = document.querySelector('.gameboy-input__dpad');
    const startElement = document.querySelector('.gameboy-input__start');
    const selectElement = document.querySelector('.gameboy-input__select');
    const aElement = document.querySelector('.gameboy-input__a');
    const bElement = document.querySelector('.gameboy-input__b');

    WasmBoy.addTouchInput('UP', dpadElement, 'DPAD', 'UP');
    WasmBoy.addTouchInput('RIGHT', dpadElement, 'DPAD', 'RIGHT');
    WasmBoy.addTouchInput('DOWN', dpadElement, 'DPAD', 'DOWN');
    WasmBoy.addTouchInput('LEFT', dpadElement, 'DPAD', 'LEFT');
    WasmBoy.addTouchInput('A', aElement, 'BUTTON');
    WasmBoy.addTouchInput('B', bElement, 'BUTTON');
    WasmBoy.addTouchInput('START', startElement, 'BUTTON');
    WasmBoy.addTouchInput('SELECT', selectElement, 'BUTTON');
  }

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
