// Allow configuring the wasmboy options

import { h, Component } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';

import { WasmBoy, WasmBoyDefaultOptions } from '../../wasmboy';

import './wasmboyOptions.css';

export default class WasmBoyOptions extends Component {
  constructor(props) {
    super(props);

    this.state = {};
  }

  componentDidMount() {
    // Add all of our default options from the props to our component state
    const newState = Object.assign({}, this.state);
    const wasmboyConfig = WasmBoy.getConfig();
    Object.keys(WasmBoyDefaultOptions).forEach(optionKey => {
      newState[optionKey] = wasmboyConfig[optionKey];
    });
    this.setState(newState);
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
        // TODO
        /*
        if (window !== undefined && window.gtag) {
          gtag('event', 'applied_options');
        }
        */
      })
      .catch(error => {
        Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Options Error! 😞');
      });
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
        <h1>Options:</h1>
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

        <button
          class="wasmboy__options__apply button"
          onClick={() => {
            this.applyOptions();
          }}
        >
          Apply Options
        </button>
      </div>
    );
  }
}
