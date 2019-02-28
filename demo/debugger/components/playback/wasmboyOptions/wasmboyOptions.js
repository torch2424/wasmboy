// Allow configuring the wasmboy options

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import DebuggerAnalytics from '../../../analytics';
import { WasmBoy, WasmBoyDefaultDesktopOptions } from '../../../wasmboy';
import loadBootROM from '../../../loadBootROM';

import './wasmboyOptions.css';

export default class WasmBoyOptions extends Component {
  constructor(props) {
    super(props);

    this.state = {
      bootROMs: []
    };

    this.bootRomType = 'gb';

    // Create a hidden input on the page for opening files
    const hiddenInput = document.createElement('input');
    hiddenInput.id = 'hidden-boot-rom-input';
    hiddenInput.classList.add('hidden-rom-input');
    hiddenInput.setAttribute('type', 'file');
    hiddenInput.setAttribute('accept', '.bin, .zip');
    hiddenInput.setAttribute('hidden', true);
    hiddenInput.addEventListener('change', this.onBootRomChange.bind(this));
    document.body.appendChild(hiddenInput);

    this.hiddenInput = hiddenInput;

    // Exerytime WasmBoy gets updated, simply re-render
    Pubx.subscribe(PUBX_KEYS.WASMBOY, () => this.update());
    Pubx.subscribe(PUBX_KEYS.MOBILE, () => this.update());
  }

  componentDidMount() {
    this.update();
  }

  update() {
    // Set timeout to allow dependant state to change
    setTimeout(() => {
      // Add all of our default options from the props to our component state
      const newState = Object.assign({}, this.state);
      const wasmboyConfig = WasmBoy.getConfig();
      Object.keys(WasmBoyDefaultDesktopOptions).forEach(optionKey => {
        newState[optionKey] = wasmboyConfig[optionKey];
      });
      this.setState(newState);

      this.updateBootROMs();
    }, 50);
  }

  setStateKey(stateKey, value) {
    const newState = Object.assign({}, this.state);
    newState[stateKey] = value;
    this.setState(newState);
  }

  // Simply resets wasmboy with the current options
  applyOptions() {
    WasmBoy.reset(this.state)
      .then(() => {
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Applied Options! 🛠️');

        // Fire off Analytics
        DebuggerAnalytics.appliedOptions();
      })
      .catch(error => {
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Options Error! 😞');
      });
  }

  async updateBootROMs() {
    const bootROMs = await WasmBoy.getBootROMs();
    this.setState({
      bootROMs
    });
  }

  getBootROMOfType(type) {
    if (!this.state.bootROMs) {
      return;
    }

    let bootROM;
    this.state.bootROMs.some(bootROMObject => {
      if (bootROMObject.type === type.toUpperCase()) {
        bootROM = bootROMObject;
        return true;
      }

      return false;
    });

    return bootROM;
  }

  clickBootRom(bootRomType) {
    this.bootRomType = bootRomType;
    this.hiddenInput.click();
  }

  async onBootRomChange(event) {
    const file = event.target.files[0];
    const name = event.target.files[0].name;

    await loadBootROM(file, this.bootRomType, name);

    this.updateBootROMs();
  }

  render() {
    // Create an array of all of our configurable options
    let options = [];
    Object.keys(this.state).forEach(stateOptionKey => {
      // Boolean Checkboxes
      if (typeof this.state[stateOptionKey] === 'boolean') {
        options.push(
          <div>
            <label class="checkbox" for={stateOptionKey}>
              {stateOptionKey}
              <input
                id={stateOptionKey}
                type="checkbox"
                checked={this.state[stateOptionKey]}
                onChange={() => {
                  this.setStateKey(stateOptionKey, !this.state[stateOptionKey]);
                }}
              />
            </label>
          </div>
        );
      }

      // Number Input Fields
      if (typeof this.state[stateOptionKey] === 'number') {
        options.push(
          <div>
            <label class="checkbox">
              {stateOptionKey}
              <input
                type="number"
                class="input"
                name={stateOptionKey}
                value={this.state[stateOptionKey]}
                onChange={event => {
                  this.setStateKey(stateOptionKey, parseFloat(event.target.value));
                }}
              />
            </label>
          </div>
        );
      }
    });

    return (
      <div class="wasmboy__options animated fadeIn">
        <h1>WasmBoy Options:</h1>
        <div class="wasmboy__options__info">
          <i>
            Applying options will reset any currently running game without saving. It is reccomended you apply your options before loading
            your game. Information on the{' '}
            <a href="https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md" target="_blank">
              effectiveness of performance improving options can be found here
            </a>
          </i>
        </div>

        <div class="wasmboy__options__inputs">{options}</div>

        {/* Colorization Select*/}
        <div>
          <label>
            <a href="https://i.redd.it/0rl8fp5qkz2z.png" target="_blank">
              GB Colorization Palette
            </a>
            :
            <select
              value={this.state['gbcColorizationPalette']}
              onChange={() => this.setStateKey('gbcColorizationPalette', event.target.value)}
            >
              <option value="wasmboygb">WasmBoy GB</option>
              <option value="brown">Brown</option>
              <option value="red">Red</option>
              <option value="darkbrown">Dark Brown</option>
              <option value="pastelmix">Pastel Mix</option>
              <option value="orange">Orange</option>
              <option value="yellow">Yellow</option>
              <option value="blue">Blue</option>
              <option value="darkblue">Dark Blue</option>
              <option value="grayscale">Grayscale</option>
              <option value="green">Green</option>
              <option value="darkgreen">Dark Green</option>
              <option value="inverted">Inverted</option>
            </select>
          </label>
        </div>

        <button
          class="wasmboy__options__apply button"
          onClick={() => {
            this.applyOptions();
          }}
        >
          Apply Options
        </button>

        {/* Upload a Boot ROM */}
        <h2>Add Boot ROM:</h2>
        {[{ name: 'Game Boy', type: 'GB' }, { name: 'Game Boy Color', type: 'GBC' }].map(bootRomRenderObject => {
          const bootRom = this.getBootROMOfType(bootRomRenderObject.type);

          return (
            <div class="wasmboy-options__boot-rom-select">
              <div>{bootRomRenderObject.name}</div>
              {bootRom ? (
                <div>
                  <div>File name: {bootRom.filename}</div>
                  <div>Added: {new Date(bootRom.date).toLocaleDateString()}</div>
                </div>
              ) : (
                <div>None Uploaded</div>
              )}
              <button onClick={() => this.clickBootRom(bootRomRenderObject.type)}>Upload {bootRomRenderObject.name} Boot ROM</button>
            </div>
          );
        })}
      </div>
    );
  }
}
