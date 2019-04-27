import { h, Component } from 'preact';

import './help.css';

export default class HelpComponent extends Component {
  render() {
    return (
      <div class="help">
        <h1>Help</h1>
        <h2>How do I use this Debugger</h2>
        <div>
          Please see the video below on how to open a ROM, open widgets, and move around tabs. Widgets can also be resiezed, by hovering
          over their edges, and stretching to the desired size. All open widgets, and layout configurations are saved in localStorage, and
          are preserved between sessions.
          <div class="help__media-container">
            <video autoplay loop muted playsinline>
              <source src="assets/debuggerWalkthrough.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <h2>Hotkeys</h2>
        <div>
          <ul>
            <li>
              <b>Left Trigger, Right Trigger, Q</b> - Double Speed
            </li>
            <li>
              <b>Special, Space</b> - Play / Pause
            </li>
          </ul>
        </div>
        <h2>How to report bugs / suggestions</h2>
        <div>
          Please feel free to file any bugs, suggestions, issues, etc.. At the{' '}
          <a href="https://github.com/torch2424/wasmBoy/issues" target="_blank">
            WasmBoy Github repo
          </a>
          .
        </div>
      </div>
    );
  }
}
