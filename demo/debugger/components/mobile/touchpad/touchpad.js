// Base Component to handle showing mobile UIs

import { h, Component } from 'preact';
import { WasmBoy } from '../../../wasmboy';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import loadROM from '../../../loadROM';
import DebuggerAnalytics from '../../../analytics';

import { getOpenSourceROMElements } from 'shared-gb/openSourceROMs/preactComponents';
import GoogleDrivePicker from 'shared-gb/googleDrivePicker';
import 'shared-gb/openSourceROMs/preactComponents.css';

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

    // Add touch controls
    WasmBoy.ResponsiveGamepad.TouchInput.addDpadInput(dpadElement, {
      allowMultipleDirections: false
    });
    WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(aElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.A);
    WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(bElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.B);
    WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(startElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.START);
    WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(selectElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.SELECT);
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

  openGoogleDriveROM() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

    // Close the modal
    Pubx.get(PUBX_KEYS.MODAL).closeModal();

    // Fire off some analytics
    DebuggerAnalytics.googleDriveLoad();

    // Get the ROM from google drive
    const loadGDriveROMTask = async () => {
      const pickerResponse = await GoogleDrivePicker.getFile(['application/zip', 'application/octet-stream']);

      if (pickerResponse.cancelled) {
        return;
      }

      const { response, oAuthHeaders } = pickerResponse;

      if (response.title.endsWith('.zip') || response.title.endsWith('.gb') || response.title.endsWith('.gbc')) {
        await WasmBoy.pause();
        await WasmBoy.loadROM(response.downloadUrl, {
          headers: oAuthHeaders,
          fileName: response.title
        });
        await WasmBoy.play();
        Pubx.publish(PUBX_KEYS.WASMBOY, {
          filename: response.title
        });
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Loaded! 🎉');
      } else {
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Invalid file type. 😞');
      }
    };
    const loadGDriveROMPromise = loadGDriveROMTask().catch(error => {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification(error);
    });
    Pubx.get(PUBX_KEYS.LOADING).addControlPromise(loadGDriveROMPromise);
  }

  togglePlayPause() {
    if (!WasmBoy.isLoadedAndStarted()) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please load a ROM first. 📁');
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
    // Fire off some analytics
    DebuggerAnalytics.reload();

    // Reload
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
            📁
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
