// Top Bar Menu to open files to be played

import { h } from 'preact';

import { Pubx } from 'pubx';

import loadScript from 'load-script';

import Command from './command';
import { WasmBoy } from '../wasmboy';
import DebuggerAnalytics from '../analytics';
import loadROM from '../loadROM';
import loadBootROM from '../loadBootROM';
import { PUBX_KEYS } from '../pubx.config';

import { getOpenSourceROMElements } from 'shared-gb/openSourceROMs/preactComponents';
import GoogleDrivePicker from 'shared-gb/googleDrivePicker';
import 'shared-gb/openSourceROMs/preactComponents.css';

class OpenLocalFile extends Command {
  constructor() {
    super('open:local');
    this.options.label = 'Local File';

    // Create a hidden input on the page for opening files
    const hiddenInput = document.createElement('input');
    hiddenInput.id = 'hidden-rom-input';
    hiddenInput.classList.add('hidden-rom-input');
    hiddenInput.setAttribute('type', 'file');
    hiddenInput.setAttribute('accept', '.gb, .gbc, .zip');
    hiddenInput.setAttribute('hidden', true);
    hiddenInput.addEventListener('change', this.onChange.bind(this));
    document.body.appendChild(hiddenInput);

    this.hiddenInput = hiddenInput;
  }

  execute() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();
    this.hiddenInput.click();
  }

  onChange(event) {
    const file = event.target.files[0];
    const name = event.target.files[0].name;

    loadROM(file, name);
  }
}

// Recently Uploaded ROMs
class OpenRecentROM extends Command {
  constructor() {
    super('open:recent');
    this.options.label = 'Recently Added';
  }

  loadROM(cartridge) {
    loadROM(cartridge.cartridgeRom.ROM, cartridge.cartridgeRom.fileName);
    Pubx.get(PUBX_KEYS.MODAL).closeModal();
  }

  showLoader() {
    // Show a loading spinner
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      return (
        <div class="recent-rom-container">
          <h1>Recently Added</h1>
          <div class="donut" />
        </div>
      );
    }, true);
  }

  showDeleteROM(cartridge) {
    const deleteROM = async () => {
      this.showLoader();
      await WasmBoy.deleteSavedCartridge(cartridge);
      this.execute();
    };

    Pubx.get(PUBX_KEYS.MODAL).closeModal();
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      const ROMdate = new Date(cartridge.cartridgeRom.date).toLocaleDateString();
      return (
        <div class="recent-rom-container__delete">
          <h1>Delete ROM</h1>
          <h3>{cartridge.cartridgeRom.fileName}</h3>
          <h4>{ROMdate}</h4>
          <h3>Are you sure you want to do this?</h3>
          <button onClick={() => this.execute()}>Cancel</button>
          <button onClick={() => deleteROM()}>Delete</button>
        </div>
      );
    });
  }

  execute() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

    Pubx.get(PUBX_KEYS.MODAL).closeModal();

    // Show a loading spinner
    this.showLoader();

    const recentROMTask = async () => {
      const wasmboyCartridges = await WasmBoy.getSavedMemory();

      Pubx.get(PUBX_KEYS.MODAL).closeModal();

      // Using a stateless functional component
      Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
        const ROMListItems = [];
        wasmboyCartridges.forEach(cartridge => {
          if (!cartridge.cartridgeRom) {
            return;
          }

          const ROMdate = new Date(cartridge.cartridgeRom.date).toLocaleDateString();

          ROMListItems.push(
            <li>
              <button class="remove-default-button" onClick={() => this.loadROM(cartridge)}>
                <b>{cartridge.cartridgeRom.fileName}</b> - {ROMdate}
              </button>
              <button class="remove-default-button recent-rom-container__delete-rom" onClick={() => this.showDeleteROM(cartridge)}>
                🚮
              </button>
            </li>
          );
        });

        if (ROMListItems.length === 0) {
          return <h1>No Recently Added Local File ROMs.</h1>;
        }

        return (
          <div class="recent-rom-container">
            <h1>Recently Added</h1>
            <ul>{ROMListItems}</ul>
          </div>
        );
      });
    };
    recentROMTask();
  }
}

// Open Source Roms
class OpenOpenSourceROM extends Command {
  constructor() {
    super('open:opensource');
    this.options.label = 'Open Source ROMs';
  }

  execute() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

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
}

// TODO: This is for testing for now
// https://gbhh.avivace.com/developers
class OpenHomebrewHubROM extends Command {
  constructor() {
    super('open:homebrewhub');
    this.options.label = 'Homebrew Hub ROMs';
  }

  execute() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

    // Just fetch and run 2048 for testing
    const homebrewHubTask = async () => {
      // Test making a request for the ROMS
      const json = await fetch('https://gbhh.avivace.com/api/homebrews').then(response => response.json());
      console.log('Homebrews response', json);

      // Fetch using Wasmboy
      await WasmBoy.loadROM('https://gbhh.avivace.com/database/entries/2048gb/2048.gb');
      await WasmBoy.play();
    };
    homebrewHubTask();
  }
}

// Public Keys for Google Drive API
const WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID = '427833658710-bntpbmf6pimh8trt0n4c36gteomseg61.apps.googleusercontent.com';

class OpenGoogleDriveROM extends Command {
  constructor() {
    super('open:googledrive');
    this.options.label = 'Google Drive';

    GoogleDrivePicker.initialize(WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID);
  }

  execute() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

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
}

const exportedCommands = [
  new OpenLocalFile(),
  new OpenRecentROM(),
  new OpenOpenSourceROM(),
  // new OpenHomebrewHubROM(),
  new OpenGoogleDriveROM()
];
export default exportedCommands;
