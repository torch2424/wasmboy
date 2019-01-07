// API For loading GB Roms from Google Drive
// Using the Picker API

import loadScript from 'load-script';

// Google drive
const GOOGLE_SDK_URL = 'https://apis.google.com/js/api.js';
// OAuth Key for Google Drive
let googlePickerOAuthToken = '';

class GoogleDrivePickerLib {
  constructor() {
    this.initialized = false;
    this.clientId = undefined;
  }

  initialize(clientId) {
    this.clientId = clientId;

    // Load the Picker SDK
    loadScript(GOOGLE_SDK_URL, () => {
      window.gapi.load('auth');
      window.gapi.load('picker');
    });
  }

  getFile(mimeTypes) {
    if (!this._isGoogleReady() || !this._isGoogleAuthReady() || !this._isGooglePickerReady()) {
      return Promise.reject('Google Drive not ready');
    }

    const token = window.gapi.auth.getToken();
    const oauthToken = token && token.access_token;

    const getFilePromiseObject = {};

    const getFilePromise = new Promise((resolve, reject) => {
      getFilePromiseObject.resolve = resolve;
      getFilePromiseObject.reject = reject;
    });

    if (oauthToken) {
      this._createPicker(oauthToken, mimeTypes, getFilePromiseObject);
    } else {
      this._doAuth(({ access_token }) => this._createPicker(access_token, mimeTypes, getFilePromiseObject));
    }

    return getFilePromise;
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
        client_id: this.clientId,
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        immediate: false
      },
      callback
    );
  }

  _createPicker(oauthToken, mimeTypes, getFilePromiseObject) {
    googlePickerOAuthToken = oauthToken;

    const googleViewId = google.picker.ViewId['DOCS'];
    const view = new window.google.picker.DocsView(googleViewId);

    if (mimeTypes) {
      view.setMimeTypes(mimeTypes.join(','));
    }

    if (!view) {
      getFilePromiseObject.reject("Can't find view by viewId");
    }

    view.setMode(window.google.picker.DocsViewMode.LIST);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(oauthToken)
      .setCallback(data => this._pickerCallback(data, getFilePromiseObject));

    picker.enableFeature(window.google.picker.Feature.NAV_HIDDEN);

    // Calculate our picker size
    // https://stackoverflow.com/questions/1248081/get-the-browser-viewport-dimensions-with-javascript
    // https://developers.google.com/picker/docs/reference#PickerBuilder
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    picker.setSize(parseInt(viewportWidth, 10), parseInt(viewportHeight, 10));

    picker.build().setVisible(true);
  }

  _pickerCallback(data, getFilePromiseObject) {
    const loadGoogleDriveFileTask = async () => {
      if (data.action === 'cancel') {
        getFilePromiseObject.resolve({ cancelled: true });
        return;
      }

      // We only want the picked action
      if (data.action !== 'picked') {
        return;
      }

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
      })
        .then(response => {
          return response.json();
        })
        .catch(error => {
          getFilePromiseObject.reject(error);
        });

      // Resolve the final downloadUrl and oAuthHeader
      getFilePromiseObject.resolve({
        response: responseJson,
        oAuthHeaders
      });
    };
    loadGoogleDriveFileTask();
  }
}

// Export a singleton
const GoogleDrivePicker = new GoogleDrivePickerLib();
export default GoogleDrivePicker;
