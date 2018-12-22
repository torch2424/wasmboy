import { h, render, Component } from 'preact';

import './index.css';

import packageJson from '../../package.json';

console.log('Hello worlddddd!');

class WasmBoyDebuggerApp extends Component {
  constructor() {
    super();
  }

  render() {
    return <div>Hello Debugger!</div>;
  }
}

render(<WasmBoyDebuggerApp />, document.body);
