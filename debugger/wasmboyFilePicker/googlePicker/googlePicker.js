// Taken & Preact-ified from: https://github.com/sdoomz/react-google-picker
// And only using OAuth: https://stackoverflow.com/questions/22435410/google-drive-picker-developer-key-is-invalid-error?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa
// Picker API is super out of date :p

import { Component } from 'preact';
import loadScript from 'load-script';

const GOOGLE_SDK_URL = 'https://apis.google.com/js/api.js';

let scriptLoadingStarted = false;

export default class GooglePicker extends Component {

  static defaultProps = {
    onChange: () => {},
    onAuthenticate: () => {},
    scope:['https://www.googleapis.com/auth/drive.readonly'],
    viewId: 'DOCS',
    authImmediate: false,
    multiselect: false,
    navHidden: false,
    disabled: false
  };

  constructor(props) {
    super(props);

    this.onApiLoad = this.onApiLoad.bind(this);
    this.onChoose = this.onChoose.bind(this);
  }

  componentDidMount() {
    if(this.isGoogleReady()) {
      // google api is already exists
      // init immediately
      this.onApiLoad();
    } else if (!scriptLoadingStarted) {
      // load google api and the init
      scriptLoadingStarted = true;
      loadScript(GOOGLE_SDK_URL, this.onApiLoad)
    } else {
      // is loading
    }
  }

  isGoogleReady() {
    return !!window.gapi;
  }

  isGoogleAuthReady() {
    return !!window.gapi.auth;
  }

  isGooglePickerReady() {
    return !!window.google.picker;
  }

  onApiLoad() {
    window.gapi.load('auth');
    window.gapi.load('picker');
  }

  doAuth(callback) {
    window.gapi.auth.authorize({
        client_id: this.props.clientId,
        scope: this.props.scope,
        immediate: this.props.authImmediate
      },
      callback
    );
  }

  onChoose(event) {
    if (!this.isGoogleReady() || !this.isGoogleAuthReady() || !this.isGooglePickerReady() || this.props.disabled) {
      return null;
    }

    const token = window.gapi.auth.getToken();
    const oauthToken = token && token.access_token;

    if (oauthToken) {
      this.createPicker(oauthToken);
    } else {
      this.doAuth(({ access_token }) => this.createPicker(access_token));
    }
  }

  createPicker(oauthToken) {

    this.props.onAuthenticate(oauthToken);

    if(this.props.createPicker){
      return this.props.createPicker(google, oauthToken)
    }

    const googleViewId = google.picker.ViewId[this.props.viewId];
    const view = new window.google.picker.View(googleViewId);

    if (this.props.mimeTypes) {
      view.setMimeTypes(this.props.mimeTypes.join(','))
    }

    if (!view) {
      throw new Error('Can\'t find view by viewId');
    }

    const picker = new window.google.picker.PickerBuilder()
                             .addView(view)
                             .setOAuthToken(oauthToken)
                             .setCallback(this.props.onChange);

    if (this.props.origin) {
      picker.setOrigin(this.props.origin);
    }

    if (this.props.navHidden) {
      picker.enableFeature(window.google.picker.Feature.NAV_HIDDEN)
    }

    if (this.props.multiselect) {
      picker.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
    }

    picker.build()
          .setVisible(true);
  }

  render() {
    return (
      <div onClick={this.onChoose}>
        {
          this.props.children ?
            this.props.children :
            <button>Open google chooser</button>
        }
      </div>
    );
  }
}
