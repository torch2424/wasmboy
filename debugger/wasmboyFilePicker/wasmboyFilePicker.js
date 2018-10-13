import { Component } from 'preact';
import Portal from 'preact-portal';
import fetch from 'unfetch';
import GooglePicker from './googlePicker/googlePicker';
import { WasmBoy } from '../../dist/wasmboy.esm';
import './wasmboyFilePicker.css';

// Import our demo roms
import blarggsCpuROM from '../../test/accuracy/testroms/blargg/cpu_instrs.gb';
import tobuTobuGirlROM from '../../test/performance/testroms/tobutobugirl/tobutobugirl.gb';
import backToColorDemoROM from '../../test/performance/testroms/back-to-color/back-to-color.gbc';

const openSourceROMs = {
  tobutobugirl: {
    title: 'tobu tobu girl',
    url: tobuTobuGirlROM,
    image: 'assets/tobutobugirl.png',
    link: 'http://tangramgames.dk/tobutobugirl/',
    infoElement: (
      <div>
        <p>
          Tobu Tobu Girl is a fun and challenging arcade platformer developed by Tangram Games featuring an original soundtrack by
          potato-tan. Licensed under MIT/CC-BY.
        </p>
      </div>
    )
  },
  blarggsCpu: {
    title: "Blargg's CPU Test",
    url: blarggsCpuROM,
    image: 'assets/cpu_instrs.golden.png',
    link: 'http://gbdev.gg8.se/wiki/articles/Test_ROMs',
    infoElement: (
      <div>
        <p>Test ROM for testing CPU instructions. Made by Blargg.</p>
      </div>
    )
  },
  backToColor: {
    title: 'Back to Color',
    url: backToColorDemoROM,
    image: 'assets/back-to-color.gbc.noPerformanceOptions.png',
    link: 'https://github.com/AntonioND/back-to-color',
    infoElement: (
      <div>
        <p>Back to Color, a GBC demo for the GBDev 2014 compo. Made by AntonioND.</p>
      </div>
    )
  }
};

// Public Keys for Google Drive API
const WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID = '427833658710-bntpbmf6pimh8trt0n4c36gteomseg61.apps.googleusercontent.com';

// OAuth Key for Google Drive
let googlePickerOAuthToken = '';

export class WasmBoyFilePicker extends Component {
  constructor(props) {
    super(props);
    // set our state to if we are initialized or not
    this.state = {
      currentFileName: 'No Game Selected...',
      isFileLoading: false,
      showOpenSourceROMs: false
    };

    this.openSourceROMElements = [];
    Object.keys(openSourceROMs).forEach(romKey => {
      const openSourceROM = openSourceROMs[romKey];
      this.openSourceROMElements.push(
        <div class="open-source-rom">
          <button class="open-source-rom__button" onClick={() => this.loadOpenSourceROM(openSourceROM)}>
            <div class="open-source-rom__left">
              <img src={openSourceROM.image} />
            </div>
            <div class="open-source-rom__right">
              <h3>{openSourceROM.title}</h3>
              <div class="open-source-rom__info">{openSourceROM.infoElement}</div>
            </div>
          </button>
          <a href={openSourceROM.link} target="blank_" class="open-source-rom__link">
            {/*Google Material Link Icon*/}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
            </svg>
          </a>
        </div>
      );
    });
  }

  loadROM(file, fileName) {
    this.setFileLoadingStatus(true);
    WasmBoy.loadROM(file)
      .then(() => {
        console.log('Wasmboy Ready!');
        this.props.showNotification('Game Loaded! 🎉');
        this.setFileLoadingStatus(false);

        // Fire off Analytics
        if (window !== undefined && window.gtag) {
          gtag('event', 'load_rom_success');
        }
      })
      .catch(error => {
        console.log('Load Game Error:', error);
        this.props.showNotification('Game Load Error! 😞');
        this.setFileLoadingStatus(false);

        // Fire off Analytics
        if (window !== undefined && window.gtag) {
          gtag('event', 'load_rom_fail');
        }
      });

    // Set our file name
    const newState = Object.assign({}, this.state);
    newState.currentFileName = fileName;
    this.setState(newState);
  }

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513
  loadLocalFile(event) {
    this.loadROM(event.target.files[0], event.target.files[0].name);
  }

  loadGoogleDriveFile(data) {
    if (data.action === 'picked') {
      // Fetch from the drive api to download the file
      // https://developers.google.com/drive/v3/web/picker
      // https://developers.google.com/drive/v2/reference/files/get

      const googlePickerFileObject = data.docs[0];
      const oAuthHeaders = new Headers({
        Authorization: 'Bearer ' + googlePickerOAuthToken
      });

      this.setFileLoadingStatus(true);

      // First Fetch the Information about the file
      fetch('https://www.googleapis.com/drive/v2/files/' + googlePickerFileObject.id, {
        headers: oAuthHeaders
      })
        .then(response => {
          return response.json();
        })
        .then(responseJson => {
          const lowercaseTitle = responseJson.title.toLowerCase();
          if (lowercaseTitle.includes('.zip') || lowercaseTitle.includes('.gb') || lowercaseTitle.includes('.gbc')) {
            // Finally load the file using the oAuthHeaders
            WasmBoy.loadROM(responseJson.downloadUrl, {
              headers: oAuthHeaders,
              fileName: responseJson.title
            })
              .then(() => {
                console.log('Wasmboy Ready!');
                this.props.showNotification('Game Loaded! 🎉');
                this.setFileLoadingStatus(false);

                // Set our file name
                const newState = Object.assign({}, this.state);
                newState.currentFileName = responseJson.title;
                this.setState(newState);

                // Fire off Analytics
                if (window !== undefined && window.gtag) {
                  gtag('event', 'load_rom_success');
                }
              })
              .catch(error => {
                console.log('Load Game Error:', error);
                this.props.showNotification('Game Load Error! 😞');
                this.setFileLoadingStatus(false);

                // Fire off Analytics
                if (window !== undefined && window.gtag) {
                  gtag('event', 'load_rom_fail');
                }
              });
          } else {
            this.props.showNotification('Invalid file type. 😞');
            this.setFileLoadingStatus(false);
          }
        })
        .catch(error => {
          this.props.showNotification('Error getting file from google drive 💔');
          this.setFileLoadingStatus(false);
        });
    }
  }

  loadOpenSourceROM(openSourceROM) {
    this.loadROM(openSourceROM.url, openSourceROM.title);
    this.setState({ ...this.state, showOpenSourceROMs: false });
  }

  setFileLoadingStatus(isLoading) {
    const newState = Object.assign({}, this.state);
    newState.isFileLoading = isLoading;
    this.setState(newState);
  }

  render() {
    let fileInput = (
      <div class="wasmboy__filePicker__services">
        <div class="donut" />
      </div>
    );
    if (!this.state.isFileLoading) {
      fileInput = (
        <div class="wasmboy__filePicker__services">
          {/* Upload ROM from device */}
          <div class="file">
            <label class="file-label">
              <input
                class="file-input"
                type="file"
                accept=".gb, .gbc, .zip"
                name="resume"
                onChange={event => {
                  this.loadLocalFile(event);
                }}
              />
              <span class="file-cta">
                <span class="file-icon">
                  {/* Material file svg https://material.io/icons/#ic_insert_drive_file */}
                  <svg fill="#020202" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z" />
                    <path d="M0 0h24v24H0z" fill="none" />
                  </svg>
                </span>
                <span class="file-label">Upload from Device</span>
              </span>
            </label>
          </div>

          {/* Google Drive Picker */}
          <GooglePicker
            clientId={WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID}
            scope={['https://www.googleapis.com/auth/drive.readonly']}
            onChange={data => {
              this.loadGoogleDriveFile(data);
            }}
            onAuthenticate={token => {
              googlePickerOAuthToken = token;
            }}
            multiselect={false}
            navHidden={true}
            authImmediate={false}
            viewId={'DOCS'}
          >
            <div class="file">
              <label class="file-label">
                <span class="file-cta">
                  <span class="file-icon">
                    {/* Material file svg https://material.io/icons/#ic_insert_drive_file */}
                    <svg fill="#020202" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 0h24v24H0z" fill="none" />
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                    </svg>
                  </span>
                  <span class="file-label">Get from Google Drive</span>
                </span>
              </label>
            </div>
          </GooglePicker>

          {/* Open Source ROMs Button */}
          <a class="button is-medium is-light file-button" onClick={() => this.setState({ ...this.state, showOpenSourceROMs: true })}>
            <span class="icon">
              {/* Material open lock svg https://material.io/tools/icons/static/icons/baseline-lock_open-24px.svg */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none" />
                <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" />
              </svg>
            </span>
            <span>Open Source ROMs (Play Now)</span>
          </a>

          {/*Open Source ROMs Modal*/}
          {this.state.showOpenSourceROMs ? (
            <Portal into="body">
              <div class="modal is-active">
                <div class="modal-background">
                  <div class="modal-content">
                    <h1>Load Open Source ROM</h1>
                    <div class="open-source-ROM-container">{this.openSourceROMElements}</div>
                  </div>
                  <button
                    class="modal-close is-large"
                    aria-label="close"
                    onClick={() => this.setState({ ...this.state, showOpenSourceROMs: false })}
                  />
                </div>
              </div>
            </Portal>
          ) : null}
        </div>
      );
    }

    return (
      <div class="wasmboy__filePicker">
        <h1>Load Game</h1>
        <h2>Supported file types: ".gb", ".gbc", ".zip"</h2>
        <h2>{this.state.currentFileName}</h2>
        {fileInput}
      </div>
    );
  }
}
