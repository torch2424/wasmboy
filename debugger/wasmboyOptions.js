import { Component } from 'preact';

export class WasmBoyOptions extends Component {
  constructor(props) {
    super(props);

    this.state = {};
  }

  componentDidMount() {
    // Add all of our default options from the props to our component state
    const newState = Object.assign({}, this.state);
    Object.keys(this.props.defaultOptions).forEach((optionKey) => {
      newState[optionKey] = this.props.defaultOptions[optionKey]
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
    this.props.wasmBoy.reset(this.state);
  }

  render() {

    // Create an array of all of our configurable options
    let options = [];
    Object.keys(this.state).forEach((stateOptionKey) => {

      // Boolean Checkboxes
      if (typeof(this.state[stateOptionKey]) === typeof(true)) {
        options.push((
          <div>
            <label for={stateOptionKey}>{stateOptionKey}</label>
            <input
              id={stateOptionKey}
              type="checkbox"
              checked={ this.state[stateOptionKey] }
              onChange={ () => { this.setStateKey(stateOptionKey, !this.state[stateOptionKey]); } } />
          </div>
        ));
      }

      // Number Input Fields
      if (typeof(this.state[stateOptionKey]) === "number") {
        options.push((
          <div>
            <label>
              {stateOptionKey}
              <input type="number" name={stateOptionKey} value={this.state[stateOptionKey]} onChange={(event) => {this.setStateKey(stateOptionKey, parseFloat(event.target.value))}} />
            </label>
          </div>
        ));
      }
    });

    return (
      <div class="wasmboy__options">
        <h1>Options:</h1>
        <div class="wasmboy__options__info">
          <i>Applying options will reset any currently running game without saving. It is reccomended you apply your options before loading your game. Information on the <a href="https://github.com/torch2424/wasmBoy/blob/master/test/performance/results.md" target="_blank">effectiveness of performance improving options can be found here</a></i>
        </div>

        <div class="wasmboy__options__inputs">
          {options}
        </div>

        <button class="wasmboy__options__apply" onClick={() => {this.applyOptions()}}>Apply</button>
      </div>
    )
  }
}
