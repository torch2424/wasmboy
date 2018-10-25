import '../style';
import 'bulma/css/bulma.css';
import { Component } from 'preact';
// The following line can be changed to './dist/wasmboy.esm.js', to test the built lib
import { WasmBoy } from '../dist/wasmboy.esm';
import { WasmBoyDebugger } from './wasmboyDebugger/wasmboyDebugger';
import { WasmBoySystemControls } from './wasmboySystemControls/wasmboySystemControls';
import { WasmBoyFilePicker } from './wasmboyFilePicker/wasmboyFilePicker';
import { WasmBoyOptions } from './wasmboyOptions/wasmboyOptions';
import { WasmBoyGamepad } from './wasmboyGamepad/wasmboyGamepad';

// Log the wasmboy lib
console.log('WasmBoy', WasmBoy);

// Our current canvas object.
// Up here for the saveStateCallback
const getCanvasElement = () => {
  const canvasElement = document.querySelector('.wasmboy__canvas-container__canvas');
  return canvasElement;
};

// Our notification timeout
let notificationTimeout = undefined;

// Variables to tell if our callbacks were ever run
let saveStateCallbackCalled = false;
let graphicsCallbackCalled = false;
let audioCallbackCalled = false;

// WasmBoy Options
const WasmBoyDefaultOptions = {
  isGbcEnabled: true,
  isAudioEnabled: true,
  frameSkip: 0,
  audioBatchProcessing: true,
  timersBatchProcessing: false,
  audioAccumulateSamples: true,
  graphicsBatchProcessing: false,
  graphicsDisableScanlineRendering: false,
  tileRendering: true,
  tileCaching: true,
  gameboyFrameRate: 60,
  updateGraphicsCallback: imageDataArray => {
    if (!graphicsCallbackCalled) {
      console.log('Graphics Callback Called! Only Logging this once... imageDataArray:', imageDataArray);
      graphicsCallbackCalled = true;
    }
  },
  updateAudioCallback: (audioContext, audioBufferSourceNode) => {
    if (!audioCallbackCalled) {
      console.log(
        'Audio Callback Called! Only Logging this once... audioContext, audioBufferSourceNode:',
        audioContext,
        audioBufferSourceNode
      );
      audioCallbackCalled = true;
    }
  },
  saveStateCallback: saveStateObject => {
    if (!saveStateCallbackCalled) {
      console.log('Save State Callback Called! Only Logging this once... saveStateObject:', saveStateObject);
      saveStateCallbackCalled = true;
    }

    // Function called everytime a savestate occurs
    // Used by the WasmBoySystemControls to show screenshots on save states
    saveStateObject.screenshotCanvasDataURL = getCanvasElement().toDataURL();
  },
  onReady: () => {
    console.log('onReady Callback Called!');
  },
  onPlay: () => {
    console.log('onPlay Callback Called!');
  },
  onPause: () => {
    console.log('onPause Callback Called!');
  },
  onLoadedAndStarted: () => {
    console.log('onLoadedAndStarted Callback Called!');
  }
};

// Setup Google Analytics
if (typeof window !== 'undefined') {
  const loadScript = require('load-script');
  loadScript('https://www.googletagmanager.com/gtag/js?id=UA-125276735-1', function(err, script) {
    if (!err) {
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', 'UA-125276735-1');
      // Attach Analytics to window
      window.gtag = gtag;
    }
  });
}

export default class App extends Component {
  constructor() {
    super();

    this.state = {
      showDebugger: false,
      showOptions: false,
      showGamepad: false,
      notification: <div />
    };
  }

  // Using componentDidMount to wait for the canvas element to be inserted in DOM
  componentDidMount() {
    // Config our WasmBoy instance
    WasmBoy.config(WasmBoyDefaultOptions)
      .then(() => {
        // Wait for input
        this.setWasmBoyCanvas();
      })
      .catch(error => {
        console.error(error);
      });
  }

  setWasmBoyCanvas() {
    const setCanvasTask = async () => {
      // Get our canvas element
      await WasmBoy.setCanvas(getCanvasElement());
      await WasmBoy.play();
    };

    return setCanvasTask();
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
          <b>WasmBoy Lib Version: {WasmBoy.getVersion()}</b>
        </div>
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

                // Fire off Analytics
                if (window !== undefined && window.gtag) {
                  gtag('event', 'opened_debugger');
                }
              }}
            />
          </label>
        </div>

        <div style="text-align: center">
          <label class="checkbox">
            Show Touchpad
            <input
              type="checkbox"
              checked={this.state.showGamepad}
              onChange={() => {
                const newState = Object.assign({}, this.state);
                newState.showGamepad = !newState.showGamepad;
                this.setState(newState);

                // Fire off Analytics
                if (window !== undefined && window.gtag) {
                  gtag('event', 'showed_gamepad');
                }
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

        {this.state.showGamepad ? <WasmBoyGamepad /> : ''}

        {this.state.notification}
      </div>
    );
  }
}
