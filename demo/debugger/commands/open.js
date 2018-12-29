import { h } from 'preact';

import { Pubx } from 'pubx';

import loadScript from 'load-script';

import Command from './command';
import WasmBoy from '../wasmboy';
import { PUBX_KEYS } from '../pubx.config';

import { getOpenSourceROMElements } from '../../openSourceROMsPreact';

const loadROM = (file, fileName) => {
  // this.setFileLoadingStatus(true);

  const loadROMTask = async () => {
    await WasmBoy.pause();
    await WasmBoy.loadROM(file);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Loaded! 🎉');
    Pubx.publish(PUBX_KEYS.WASMBOY, {
      filename: fileName
    });
    // this.setFileLoadingStatus(false);

    // To test the new autoplay in safari
    // and in chrome
    // TODO
    /*
    if (this.props.autoplay) {
      WasmBoy.play();
    }
    */
    WasmBoy.play();

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_success');
    }
  };

  loadROMTask().catch(error => {
    console.log('Load Game Error:', error);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Load Error! 😞');
    // this.setFileLoadingStatus(false);

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_fail');
    }
  });

  // TODO: Set our file name
};

class OpenLocalFile extends Command {
  constructor() {
    super('open:local');
    this.options.label = 'Local File';

    // Create a hidden input on the page for opening files
    const hiddenInput = document.createElement('input');
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
    loadROM(event.target.files[0], event.target.files[0].name);
    // TODO: autoplay
  }
}

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

// Google drive
const GOOGLE_SDK_URL = 'https://apis.google.com/js/api.js';
// Public Keys for Google Drive API
const WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID = '427833658710-bntpbmf6pimh8trt0n4c36gteomseg61.apps.googleusercontent.com';
// OAuth Key for Google Drive
let googlePickerOAuthToken = '';
class OpenGoogleDriveROM extends Command {
  constructor() {
    super('open:googledrive');
    this.options.label = 'Google Drive';

    loadScript(GOOGLE_SDK_URL, () => {
      window.gapi.load('auth');
      window.gapi.load('picker');
    });
  }

  execute() {
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();

    if (!this._isGoogleReady() || !this._isGoogleAuthReady() || !this._isGooglePickerReady()) {
      // TODO:
      console.error('Google Drive not ready');
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Google Drive Still Loading, Please Try Again ♻️');
      return;
    }

    const token = window.gapi.auth.getToken();
    const oauthToken = token && token.access_token;

    if (oauthToken) {
      this._createPicker(oauthToken);
    } else {
      this._doAuth(({ access_token }) => this._createPicker(access_token));
    }
  }

  _isGoogleReady() {
    return !!window.gapi;
  }

  _isGoogleAuthReady() {
    return !!window.gapi.auth;
  }

  _isGooglePickerReady() {
    return !!window.google.picker;
  }

  _doAuth(callback) {
    window.gapi.auth.authorize(
      {
        client_id: WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID,
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        immediate: false
      },
      callback
    );
  }

  _createPicker(oauthToken) {
    googlePickerOAuthToken = oauthToken;

    const googleViewId = google.picker.ViewId['DOCS'];
    const view = new window.google.picker.DocsView(googleViewId);

    view.setMimeTypes(['application/zip', 'application/octet-stream'].join(','));

    if (!view) {
      throw new Error("Can't find view by viewId");
    }

    view.setMode(window.google.picker.DocsViewMode.LIST);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(oauthToken)
      .setCallback(data => this._pickerCallback(data));

    picker.enableFeature(window.google.picker.Feature.NAV_HIDDEN);

    // Calculate our picker size
    // https://stackoverflow.com/questions/1248081/get-the-browser-viewport-dimensions-with-javascript
    // https://developers.google.com/picker/docs/reference#PickerBuilder
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    picker.setSize(parseInt(viewportWidth, 10), parseInt(viewportHeight, 10));

    picker.build().setVisible(true);
  }

  _pickerCallback(data) {
    const loadGoogleDriveROMTask = async () => {
      // We only want the picked action
      if (data.action !== 'picked') {
        return;
      }

      // TODO:
      /*
      if (window !== undefined && window.gtag) {
        gtag("event", "google_drive_load");
      }
      */

      // Fetch from the drive api to download the file
      // https://developers.google.com/drive/v3/web/picker
      // https://developers.google.com/drive/v2/reference/files/get

      const googlePickerFileObject = data.docs[0];
      const oAuthHeaders = new Headers({
        Authorization: 'Bearer ' + googlePickerOAuthToken
      });

      // First Fetch the Information about the file
      const responseJson = await fetch('https://www.googleapis.com/drive/v2/files/' + googlePickerFileObject.id, {
        headers: oAuthHeaders
      }).then(response => {
        return response.json();
      });

      if (responseJson.title.endsWith('.zip') || responseJson.title.endsWith('.gb') || responseJson.title.endsWith('.gbc')) {
        await WasmBoy.pause();
        await WasmBoy.loadROM(responseJson.downloadUrl, {
          headers: oAuthHeaders,
          fileName: responseJson.title
        });
        await WasmBoy.play();
        Pubx.publish(PUBX_KEYS.WASMBOY, {
          filename: responseJson.title
        });
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Loaded! 🎉');
      } else {
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Invalid file type. 😞');
      }
    };

    loadGoogleDriveROMTask();
  }
}

const exportedCommands = [new OpenLocalFile(), new OpenOpenSourceROM(), new OpenGoogleDriveROM()];
export default exportedCommands;
