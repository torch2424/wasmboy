// Compoonent that contains the canvas and the actual output
// of WasmBoy

import { h, Component } from 'preact';
s;
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import InputSubmit from '../../inputSubmit';

import DebuggerAnalytics from '../../../analytics';
import { WasmBoy } from '../../../wasmboy';

import './wasmboyControls.css';

let unsubLoading = false;

export default class WasmBoyControls extends Component {
  constructor() {
    super();

    // Exerytime WasmBoy gets updated, simply re-render
    Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => this.setState(newState));
  }

  componentDidMount() {
    Pubx.get(PUBX_KEYS.WASMBOY).update();

    unsubLoading = Pubx.subscribe(PUBX_KEYS.LOADING, newState => this.checkControlLoading(newState));
    this.checkControlLoading(Pubx.get(PUBX_KEYS.LOADING));
  }

  componentWillUnmount() {
    if (unsubLoading) {
      unsubLoading();
    }
  }

  checkControlLoading(newState) {
    if (newState.controlLoading) {
      this.base.classList.add('wasmboy-controls--control-loading');
    } else {
      this.base.classList.remove('wasmboy-controls--control-loading');
    }
  }

  runNumberOfFrames(frames) {
    if (!WasmBoy.isReady()) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please load a ROM. 💾');
      return;
    }

    if (!frames || frames < 1) {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Please enter a valid value. 😄');
      return;
    }

    const runFramesPromise = WasmBoy._runNumberOfFrames(frames);
    runFramesPromise.then(() => {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification(`Ran ${frames} frame(s)! 😄`);
    });
    Pubx.get(PUBX_KEYS.LOADING).addControlPromise(runFramesPromise);
  }

  saveState() {
    WasmBoy.saveState()
      .then(saveState => {
        console.log('Resolved Save State from WasmBoy.saveState():', saveState);
        WasmBoy.play()
          .then(() => {
            Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('State Saved! 💾');
            DebuggerAnalytics.saveState();
          })
          .catch(err => {
            Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Error Saving State... 😞');
            console.error(err);
          });
      })
      .catch(err => {
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Error Saving State... 😞');
        console.error(err);
      });
  }

  showLoadStateModal() {
    // Using a stateless functional component
    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      return <div class="donut" />;
    });

    // Get our save states
    WasmBoy.getSaveStates()
      .then(saveStates => {
        if (!saveStates || saveStates.length === 0) {
          Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('No Save States For the Current ROM 🤔');
          return;
        }

        const saveStateElements = [];

        saveStates.forEach(saveState => {
          let saveStateDateString = new Date(saveState.date);
          saveStateDateString = saveStateDateString.toLocaleString();
          saveStateElements.unshift(
            <div class="load-state-container__save-state">
              <button
                class="remove-default-button"
                onClick={() => {
                  this.loadState(saveState);
                  Pubx.get(PUBX_KEYS.MODAL).closeModal();
                }}
              >
                <img src={saveState.screenshotCanvasDataURL} />
                <h3>Date:</h3>
                {saveStateDateString}
                <h3>Auto:</h3>
                {saveState.isAuto ? 'true' : 'false'}
              </button>

              <button
                onClick={() => this.showDeleteState(saveState, saveStateDateString)}
                class="load-state-container__save-state__delete remove-default-button"
              >
                🚮
              </button>
            </div>
          );
        });

        // Using a stateless functional component
        Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
          return <div class="load-state-container">{saveStateElements}</div>;
        });
      })
      .catch(err => {
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Error Getting Saving States... 😞');
        console.error(err);
      });
  }

  showDeleteState(saveState, saveStateDateString) {
    const deleteTask = async () => {
      await WasmBoy.deleteState(saveState);
      Pubx.get(PUBX_KEYS.MODAL).closeModal();
      this.showLoadStateModal();
    };

    Pubx.get(PUBX_KEYS.MODAL).showModal(() => {
      return (
        <div class="load-state-container__delete-state">
          <h1>Delete State</h1>
          <img src={saveState.screenshotCanvasDataURL} />
          <h3>Date:</h3>
          {saveStateDateString}
          <h3>Are you sure you want to do this?</h3>
          <button
            onClick={() => {
              Pubx.get(PUBX_KEYS.MODAL).closeModal();
              this.showLoadStateModal();
            }}
          >
            Cancel
          </button>
          <button onClick={() => deleteTask()}>Delete</button>
        </div>
      );
    });
  }

  loadState(saveState) {
    const loadStateTask = async () => {
      await WasmBoy.loadState(saveState);

      // Check if the Playback Control or CPU Control is open , if not, let's autoplay
      if (!Pubx.get(PUBX_KEYS.WIDGET).isControlWidgetsOpen()) {
        await WasmBoy.play();
      }

      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('State Loaded! 😀');
      DebuggerAnalytics.loadState();
    };
    loadStateTask().catch(() => {
      Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Error Loading State... 😞');
    });
  }

  render() {
    return (
      <div class="wasmboy-controls">
        <h1>Playback Controls</h1>
        <div>
          <i>ROMs will not autoplay while this widget is open.</i>
        </div>

        <div class="donut" />

        {/* Play/Pause Toggle */}
        <div class="wasmboy-controls__group">
          {this.state.playing ? (
            <button
              onClick={() => WasmBoy.pause()}
              disabled={!this.state.ready}
              class={this.state.ready ? 'button success' : 'button error'}
            >
              Pause
            </button>
          ) : (
            <button
              onClick={() => WasmBoy.play()}
              disabled={!this.state.ready}
              class={this.state.ready ? 'button success' : 'button error'}
            >
              Play
            </button>
          )}
          {/* Run Number Of Frames */}
          <InputSubmit
            class="wasmboy-controls__group__input-submit"
            type="number"
            initialValue="1"
            label="Run Number of Frames:"
            buttonText="Run"
            min="1"
            onSubmit={value => this.runNumberOfFrames(value)}
          />
        </div>

        {/* Speed Options */}
        <div class="wasmboy-controls__group">
          <button onClick={() => WasmBoy.setSpeed(0.5)} disabled={!this.state.ready}>
            0.5x
          </button>
          <button onClick={() => WasmBoy.setSpeed(1.0)} disabled={!this.state.ready}>
            1.0x
          </button>
          <button onClick={() => WasmBoy.setSpeed(2.0)} disabled={!this.state.ready}>
            2.0x
          </button>
        </div>

        {/* Save / Load States */}
        <div class="wasmboy-controls__group">
          <button disabled={!this.state.loadedAndStarted} onClick={() => this.saveState()}>
            Save State
          </button>
          <button disabled={!this.state.loadedAndStarted} onClick={() => this.showLoadStateModal()}>
            Load State
          </button>
        </div>
      </div>
    );
  }
}
