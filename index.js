import './style';
import 'bulma/css/bulma.css';
import { Component } from 'preact';
// The following line can be changed to './dist/wasmboy.esm.js', to test the built lib
import { WasmBoy } from './lib/index.js';
import { WasmBoyDebugger, WasmBoySystemControls, WasmBoyFilePicker, WasmBoyOptions, WasmBoyGamepad } from './debugger/index';

// Our canvas element
let canvasElement = undefined;

// Our notification timeout
let notificationTimeout = undefined;

// WasmBoy Options
const WasmBoyDefaultOptions = {
  isGbcEnabled: true,
  isAudioEnabled: true,
  frameSkip: 1,
  audioBatchProcessing: true,
  timersBatchProcessing: false,
  audioAccumulateSamples: true,
  graphicsBatchProcessing: false,
  graphicsDisableScanlineRendering: false,
  tileRendering: true,
  tileCaching: true,
  gameboyFrameRate: 60,
  saveStateCallback: saveStateObject => {
    // Function called everytime a savestate occurs
    // Used by the WasmBoySystemControls to show screenshots on save states
    saveStateObject.screenshotCanvasDataURL = canvasElement.toDataURL();
    return saveStateObject;
  }
};

export default class App extends Component {
  constructor() {
    super();

    this.state = {
      showDebugger: false,
      showOptions: false,
      notification: <div />
    };
  }

  // Using componentDidMount to wait for the canvas element to be inserted in DOM
  componentDidMount() {
    // Get our canvas element
    canvasElement = document.querySelector('.wasmboy__canvas-container__canvas');

    // Config our WasmBoy instance
    WasmBoy.config(WasmBoyDefaultOptions, canvasElement)
      .then(() => {
        // Wait for input
      })
      .catch(error => {
        console.error(error);
      });
  }

  // Function to show notifications to the user
  showNotification(notificationText) {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = undefined;
    }

    const closeNotification = () => {
      const newState = Object.assign({}, this.state);
      newState.notification = <div />;
      this.setState(newState);
    };

    const newState = Object.assign({}, this.state);
    newState.notification = (
      <div class="notification animated fadeIn">
        <button
          class="delete"
          onClick={() => {
            closeNotification();
          }}
        />
        {notificationText}
      </div>
    );
    this.setState(newState);

    notificationTimeout = setTimeout(() => {
      closeNotification();
    }, 3000);
  }

  render() {
    // Optionally render the options
    let optionsComponent = <div />;
    if (this.state.showOptions) {
      optionsComponent = (
        <section>
          <WasmBoyOptions
            availableOptions={WasmBoyDefaultOptions}
            showNotification={text => {
              this.showNotification(text);
            }}
          />
        </section>
      );
    }

    // optionally render the debugger
    let debuggerComponent = <div />;
    if (this.state.showDebugger) {
      debuggerComponent = (
        <section>
          <WasmBoyDebugger />
        </section>
      );
    }

    return (
      <div class="wasmboy">
        <h1 class="wasmboy__title">WasmBoy (Debugger / Demo)</h1>
        <div style="text-align: center">
          <a href="https://github.com/torch2424/wasmBoy" target="_blank">
            Fork me on Github
          </a>
        </div>
        <div style="text-align: center">
          <label class="checkbox">
            Show Options
            <input
              id="showOptions"
              type="checkbox"
              checked={this.state.showOptions}
              onChange={() => {
                const newState = Object.assign({}, this.state);
                newState.showOptions = !newState.showOptions;
                this.setState(newState);
              }}
            />
          </label>
        </div>

        {optionsComponent}

        <div style="text-align: center">
          <label class="checkbox">
            Show Debugger
            <input
              type="checkbox"
              checked={this.state.showDebugger}
              onChange={() => {
                const newState = Object.assign({}, this.state);
                newState.showDebugger = !newState.showDebugger;
                this.setState(newState);
              }}
            />
          </label>
        </div>

        {debuggerComponent}

        <WasmBoyFilePicker
          showNotification={text => {
            this.showNotification(text);
          }}
        />

        <div>
          <WasmBoySystemControls
            showNotification={text => {
              this.showNotification(text);
            }}
          />
        </div>

        <main className="wasmboy__canvas-container">
          <canvas className="wasmboy__canvas-container__canvas" />
        </main>

        <WasmBoyGamepad />

        {this.state.notification}
      </div>
    );
  }
}
