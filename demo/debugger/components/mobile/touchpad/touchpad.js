// Base Component to handle showing mobile UIs

import { h, Component } from 'preact';
import { WasmBoy } from '../../../wasmboy';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import loadROM from '../../../loadROM';
import { getOpenSourceROMElements } from '../../../../openSourceROMsPreact';

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
          <button onClick={() => this.openLocalFile()}>
            <div>⬆️ </div>
            <div>Upload Local File</div>
          </button>
          <button onClick={() => this.openOpenSourceROMViewer()}>
            <div>🍺</div>
            <div>Open Source Homebrew</div>
          </button>
          <button onClick={() => this.openGoogleDriveROM()}>
            <div>☁️</div>
            <div>Google Drive</div>
          </button>
        </div>
      );
    });
  }

  openLocalFile() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

    // Close the modal
    Pubx.get(PUBX_KEYS.MODAL).closeModal();

    // Use the hidden input from the desktop open command
    // Will handle loading the rom for us as well!
    document.querySelector('.hidden-rom-input').click();
  }

  openOpenSourceROMViewer() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

    // Close the modal
    Pubx.get(PUBX_KEYS.MODAL).closeModal();

    // Using a stateless functional component
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      return (
        <div class="open-source-rom-container">
          {getOpenSourceROMElements(ROMObject => {
            loadROM(ROMObject.url, ROMObject.title);
            Pubx.get(PUBX_KEYS.MODAL).closeModal();
          })}
        </div>
      );
    });
  }

  openGoogleDriveROM() {}

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
