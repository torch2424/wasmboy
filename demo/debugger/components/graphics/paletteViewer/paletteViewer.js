import { Component, h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import './paletteViewer.css';

let updateInterval = undefined;

export default class PaletteViewer extends Component {
  componentDidMount() {
    // Update at ~30fps
    updateInterval = setInterval(() => this.update(), 32);
  }

  componentWillUnmount() {
    clearInterval(updateInterval);
  }

  update() {
    if (!WasmBoy.isPlaying()) {
      return;
    }
  }

  render() {
    return (
      <div class="palette-viewer">
        <h1>Palette Viewer</h1>
      </div>
    );
  }
}
