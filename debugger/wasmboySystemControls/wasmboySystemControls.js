import { Component } from 'preact';
import Portal from 'preact-portal';
import './wasmBoySystemControls.css';

export class WasmBoySystemControls extends Component {

  constructor(props) {
		super(props);
		// set our state to if we are initialized or not
		this.state = {
      showSaveStates: false,
      currentFileName: 'No File Chosen...',
      saveStates: []
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
    });
  }

  closeSaveStates() {
    const newState = Object.assign({}, this.state);
    newState.showSaveStates = false;
    this.setState(newState);
  }

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513
  loadGame(wasmboy, event) {
    wasmboy.loadGame(event.target.files[0])
    .then(() => {
      console.log('wasmboy Ready!');
    });

    // Set our file name
    const newState = Object.assign({}, this.state);
    newState.currentFileName = event.target.files[0].name;
    this.setState(newState);
  }

  render(props) {

    let saveStateElements = (
      <div class="donut"></div>
    )
    if (this.state.showSaveStates && this.state.saveStates.length > 0) {
      // Loop through save states
      saveStateElements = [];
      this.state.saveStates.forEach((saveState) => {
        let saveStateDateString = new Date(saveState.date);
        saveStateDateString = saveStateDateString.toLocaleString();
        saveStateElements.unshift((
          <div class="saveState" onClick={() => {props.wasmboy.loadState(saveState); this.closeSaveStates();}}>
            <img src={saveState.screenshotCanvasDataURL} />
            <h3>Date:</h3>
            {saveStateDateString}
            <h3>Auto:</h3>
            {saveState.isAuto ? "true" : "false"}
          </div>
        ))
      });
    }

    return (
      <div className="wasmboy__systemControls system-controls">

        {/* Bulma file picker */}
        <div class="system-controls__file-input file is-centered has-name is-boxed">
          <label class="file-label">
            <input class="file-input" type="file" name="resume" onChange={(event) => {this.loadGame(props.wasmboy, event)}} />
            <span class="file-cta">
              <span class="file-icon">
                <i class="fas fa-upload"></i>
              </span>
              <span class="file-label">
                Choose a file…
              </span>
            </span>
            <span class="file-name">
              {this.state.currentFileName}
            </span>
          </label>
        </div>


        <button class="button" onclick={() => {props.wasmboy.startGame();}}>Start Game</button>
        <button class="button" onclick={() => {props.wasmboy.pauseGame();}}>Pause Game</button>
        <button class="button" onclick={() => {props.wasmboy.resumeGame();}}>Resume Game</button>
        <button class="button" onclick={() => {props.wasmboy.saveState();}}>Save State</button>
        <button class="button" onclick={() => {this.openSaveStates();}}>Load State</button>
        <div>Gameboy FPS: {this.state.fps}</div>

        { this.state.showSaveStates ? (
          <Portal into="body">
            <div class="popup-shadow-container" onClick={() => {this.closeSaveStates();}}>
              <div class="popup">
                <h1>Load Save State For Current Game</h1>
                <div class="saveStateContainer">
                  {saveStateElements}
                </div>
              </div>
            </div>
          </Portal>
        ) : null }
      </div>
    )
  }

}
