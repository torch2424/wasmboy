import { Component } from 'preact';
import Portal from 'preact-portal';
import { WasmBoy } from '../../dist/wasmboy.esm';
import './wasmBoySystemControls.css';

export class WasmBoySystemControls extends Component {
  constructor(props) {
    super(props);
    // set our state to if we are initialized or not
    this.state = {
      showSaveStates: false,
      currentFileName: 'No Game Selected...',
      saveStates: [],
      saveStateError: false
    };

    let fpsCounter;
    fpsCounter = () => {
      this.setState({
        fps: WasmBoy.getFPS()
      });
      setTimeout(() => {
        fpsCounter();
      }, 1000);
    };
    fpsCounter();
  }

  // Toggle showing all save states
  openSaveStates() {
    if (this.state.showSaveStates) {
      return;
    }

    const newState = Object.assign({}, this.state);
    newState.showSaveStates = true;
    this.setState(newState);

    // Get our save states
    WasmBoy.getSaveStates()
      .then(saveStates => {
        if (saveStates) {
          newState.saveStates = saveStates;
        }
        this.setState(newState);
      })
      .catch(() => {
        newState.saveStateError = true;
        this.setState(newState);
      });
  }

  closeSaveStates() {
    const newState = Object.assign({}, this.state);
    newState.showSaveStates = false;
    newState.saveStates = [];
    newState.saveStateError = false;
    this.setState(newState);
  }

  startGame() {
    if (!WasmBoy.isReady()) {
      this.props.showNotification('Please load a game. ⏏️');
    } else {
      WasmBoy.play();

      // Fire off Analytics
      if (window !== undefined && window.gtag) {
        gtag('event', 'rom_played');
      }
    }
  }

  saveState() {
    WasmBoy.saveState()
      .then(saveState => {
        console.log('Resolved Save State from WasmBoy.saveState():', saveState);
        WasmBoy.play()
          .then(() => {
            this.props.showNotification('State Saved! 💾');
          })
          .catch(err => {
            this.props.showNotification('Error Saving State... 😞');
            console.error(err);
          });
      })
      .catch(err => {
        this.props.showNotification('Error Saving State... 😞');
        console.error(err);
      });
  }

  loadState(saveState) {
    this.closeSaveStates();
    WasmBoy.loadState(saveState)
      .then(() => {
        WasmBoy.play()
          .then(() => {
            this.props.showNotification('State Loaded! 😀');
          })
          .catch(() => {
            this.props.showNotification('Error Loading State... 😞');
          });
      })
      .catch(() => {
        this.props.showNotification('Error Loading State... 😞');
      });
  }

  getStartButtonClass() {
    if (WasmBoy.isReady()) {
      return 'is-success';
    }

    return 'is-danger';
  }

  render(props) {
    let saveStateElements = <div class="donut" />;
    if (this.state.showSaveStates) {
      if (this.state.saveStates.length > 0) {
        // Loop through save states
        saveStateElements = [];
        this.state.saveStates.forEach(saveState => {
          let saveStateDateString = new Date(saveState.date);
          saveStateDateString = saveStateDateString.toLocaleString();
          saveStateElements.unshift(
            <div
              class="saveState"
              onClick={() => {
                this.loadState(saveState);
              }}
            >
              <img src={saveState.screenshotCanvasDataURL} />
              <h3>Date:</h3>
              {saveStateDateString}
              <h3>Auto:</h3>
              {saveState.isAuto ? 'true' : 'false'}
            </div>
          );
        });
      }

      if (this.state.saveStateError || this.state.saveStates.length <= 0) {
        saveStateElements = <h1>No Save States Found 😞</h1>;
      }
    }

    return (
      <div className="wasmboy__systemControls system-controls">
        <button
          className={this.getStartButtonClass() + ' button'}
          onclick={() => {
            this.startGame();
          }}
        >
          Play
        </button>
        <button
          class="button"
          onclick={() => {
            WasmBoy.pause();
          }}
        >
          Pause
        </button>
        <button
          class="button"
          onclick={() => {
            this.saveState();
          }}
        >
          Save State
        </button>
        <button
          class="button"
          onclick={() => {
            this.openSaveStates();
          }}
        >
          Load State
        </button>
        <div>Gameboy FPS: {this.state.fps}</div>

        {this.state.showSaveStates ? (
          <Portal into="body">
            <div class="modal is-active">
              <div class="modal-background">
                <div class="modal-content">
                  <h1>Load Save State For Current Game</h1>
                  <div class="saveStateContainer">{saveStateElements}</div>
                </div>
                <button
                  class="modal-close is-large"
                  aria-label="close"
                  onClick={() => {
                    this.closeSaveStates();
                  }}
                />
              </div>
            </div>
          </Portal>
        ) : null}
      </div>
    );
  }
}
