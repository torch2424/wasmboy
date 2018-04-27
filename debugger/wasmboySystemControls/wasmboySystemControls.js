import { Component } from 'preact';
import Portal from 'preact-portal';
import './wasmBoySystemControls.css';

export class WasmBoySystemControls extends Component {

  constructor(props) {
		super(props);
		// set our state to if we are initialized or not
		this.state = {
      showSaveStates: false,
      currentFileName: 'Choose a file...',
      saveStates: [],
      saveStateError: false
    };

    let fpsCounter;
    fpsCounter = () => {
      this.setState({
        fps: props.wasmboy.getFps()
      });
      setTimeout(() => {
        fpsCounter();
      }, 500);
    }
    fpsCounter();
	}

  // Toggle showing all save states
  openSaveStates() {

    if(this.state.showSaveStates) {
      return;
    }

    const newState = Object.assign({}, this.state);
    newState.showSaveStates = true;
    this.setState(newState);

    // Get our save states
    this.props.wasmboyMemory.getCartridgeObject().then((cartridgeObject) => {
      newState.saveStates = cartridgeObject.saveStates;
      this.setState(newState);
    }).catch(() => {
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

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513
  loadGame(wasmboy, event) {
    wasmboy.loadGame(event.target.files[0])
    .then(() => {
			console.log('Wasmboy Ready!');
			this.props.showNotification('Game Loaded! 🎉');
		}).catch((error) => {
			console.log('Load Game Error:', error);
			this.props.showNotification('Game Load Error! 😞');
		});

    // Set our file name
    const newState = Object.assign({}, this.state);
    newState.currentFileName = event.target.files[0].name;
    this.setState(newState);
  }

  startGame() {
    if(!this.props.wasmboy.ready) {
      this.props.showNotification('Please load a game. ⏏️');
    } else {
      this.props.wasmboy.startGame();
    }
  }

  saveState() {
    this.props.wasmboy.saveState();
    this.props.showNotification('State Saved! 💾');
  }

  loadState(saveState) {
    this.closeSaveStates();
    this.props.wasmboy.loadState(saveState);
    this.props.showNotification('State Loaded! 😀');
  }

  getStartButtonClass() {
    if(this.props.wasmboy && this.props.wasmboy.ready) {
      return "is-success";
    }

    return "is-danger"
  }

  render(props) {

    let saveStateElements = (
      <div class="donut"></div>
    )
    if (this.state.showSaveStates) {
      if (this.state.saveStates.length > 0) {
        // Loop through save states
        saveStateElements = [];
        this.state.saveStates.forEach((saveState) => {
          let saveStateDateString = new Date(saveState.date);
          saveStateDateString = saveStateDateString.toLocaleString();
          saveStateElements.unshift((
            <div class="saveState" onClick={() => {this.loadState(saveState)}}>
              <img src={saveState.screenshotCanvasDataURL} />
              <h3>Date:</h3>
              {saveStateDateString}
              <h3>Auto:</h3>
              {saveState.isAuto ? "true" : "false"}
            </div>
          ))
        });
      }

      if(this.state.saveStateError) {
        saveStateElements = (
          <h1>No Save States Found 😞</h1>
        )
      }
    }

    return (
      <div className="wasmboy__systemControls system-controls">

        {/* Bulma file picker */}
        <div class="system-controls__file-input file is-centered has-name is-boxed">
          <label class="file-label">
            <input class="file-input" type="file" accept=".gb, .gbc, .zip" name="resume" onChange={(event) => {this.loadGame(props.wasmboy, event)}} />
            <span class="file-cta">
              <span class="file-icon">
                {/* Material file svg https://material.io/icons/#ic_insert_drive_file */}
                <svg fill="#020202" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
                    <path d="M0 0h24v24H0z" fill="none"/>
                </svg>
              </span>
              <span class="file-label">
                ".gb", ".gbc", ".zip"
              </span>
            </span>
            <span class="file-name">
              {this.state.currentFileName}
            </span>
          </label>
        </div>


        <button className={ this.getStartButtonClass() + " button" } onclick={() => {this.startGame()}}>Start Game</button>
        <button class="button" onclick={() => {props.wasmboy.pauseGame();}}>Pause Game</button>
        <button class="button" onclick={() => {props.wasmboy.resumeGame();}}>Resume Game</button>
        <button class="button" onclick={() => {this.saveState();}}>Save State</button>
        <button class="button" onclick={() => {this.openSaveStates();}}>Load State</button>
        <div>Gameboy FPS: {this.state.fps}</div>

        { this.state.showSaveStates ? (
          <Portal into="body">
            <div class="modal is-active">
              <div class="modal-background" onClick={() => {this.closeSaveStates();}}>
                <div class="modal-content">
                  <h1>Load Save State For Current Game</h1>
                  <div class="saveStateContainer">
                    {saveStateElements}
                  </div>
                </div>
                <button class="modal-close is-large" aria-label="close" onClick={() => {this.closeSaveStates();}}></button>
              </div>
            </div>
          </Portal>
        ) : null }
      </div>
    )
  }

}
