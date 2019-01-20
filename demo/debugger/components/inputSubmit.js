import { h, Component } from 'preact';
import './inputSubmit.css';

// Component that simply has an input field, with a button at the end to run a function

export default class InputSubmit extends Component {
  componentDidMount() {
    this.setState({
      value: this.props.initialValue
    });
  }

  handleKeyDown(event, pattern) {
    if (pattern && !event.key.match(pattern)) {
      event.preventDefault();
    }
  }

  render({ buttonText, label, onSubmit, initialValue, pattern, ...props }) {
    return (
      <div class="input-submit">
        <label>{label}</label>
        <input
          {...props}
          value={this.state.value}
          onKeyDown={event => this.handleKeyDown(event, pattern)}
          onChange={event => this.setState({ value: event.target.value })}
        />
        <button onClick={() => onSubmit(this.state.value)}>{buttonText || 'Submit'}</button>
      </div>
    );
  }
}
