// Base Component to handle showing mobile UIs

import { h, Component } from 'preact';
import { WasmBoy } from '../../../wasmboy';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import AboutComponent from '../../other/about/about';

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

  openROM() {
    // Using a stateless functional component
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      return (
        <div class="mobile-rom-source">
          <button>
            <div>⬆️ </div>
            <div>Upload Local File</div>
          </button>
          <button>
            <div>🍺</div>
            <div>Open Source Homebrew</div>
          </button>
          <button>
            <div>☁️</div>
            <div>Google Drive</div>
          </button>
        </div>
      );
    });
  }

  togglePlayPause() {
    if (!WasmBoy.isLoadedAndStarted()) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please load a ROM first. 💾');
      return;
    }

    if (WasmBoy.isPlaying()) {
      WasmBoy.pause();
    } else {
      WasmBoy.play();
    }
  }

  showAbout() {
    // Using a stateless functional component
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      return <AboutComponent />;
    });
  }

  reload() {
    if (window !== undefined && window.gtag) {
      gtag('event', 'reload');
    }
    window.location.reload(true);
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

        <div class="debugger-input">
          <button class="remove-default-button" onClick={() => this.openROM()}>
            💾
          </button>
          <button class="remove-default-button" onClick={() => this.togglePlayPause()}>
            ⏯️
          </button>
          <button class="remove-default-button" onClick={() => this.showAbout()}>
            ℹ️
          </button>
          <button class="remove-default-button" onClick={() => this.reload()}>
            ♻️
          </button>
        </div>
      </div>
    );
  }
}
