import { Component, h } from 'preact';

import { WasmBoy } from '../../../wasmboy';

import './paletteViewer.css';

let updateInterval = undefined;

// Define our colors
const white = 'rgb(242, 242, 242)';
const lightGray = 'rgb(160, 160, 160)';
const darkGray = 'rgb(88, 88, 88)';
const black = 'rgb(8, 8, 8)';

const getMonochromeTableCell = colorId => {
  // Get our colors
  let textStyle = 'color: ';
  let bgStyle = 'background-color: ';
  let colorName;
  if (colorId === 0) {
    colorName = 'White (0b00)';
    textStyle += black;
    bgStyle += white;
  } else if (colorId === 1) {
    colorName = 'Light Gray (0b01)';
    textStyle += black;
    bgStyle += lightGray;
  } else if (colorId === 2) {
    colorName = 'Dark Gray (0b10)';
    textStyle += white;
    bgStyle += darkGray;
  } else {
    colorName = 'Black (0b11)';
    textStyle += white;
    bgStyle += black;
  }

  return (
    <td style={`${textStyle};${bgStyle}`} class="palette-table__color">
      {colorName}
    </td>
  );
};

export default class PaletteViewer extends Component {
  componentDidMount() {
    // Update at ~30fps
    updateInterval = setInterval(() => this.update(), 32);

    this.setState({
      paletteTable: ''
    });
  }

  componentWillUnmount() {
    clearInterval(updateInterval);
  }

  update() {
    if (!WasmBoy.isPlaying()) {
      return;
    }

    const updateTask = async () => {
      const isGBC = await WasmBoy.isGBC();

      if (isGBC) {
        this.updateColor();
      } else {
        this.updateMonochrome();
      }
    };
    updateTask();
  }

  updateMonochrome() {
    const updateTask = async () => {
      // Get the palette memory
      // http://gbdev.gg8.se/wiki/articles/Sound_Controller#FF30-FF3F_-_Wave_Pattern_RAM
      const memoryStart = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff47]);
      const memoryEnd = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff49]);
      const memory = await WasmBoy._getWasmMemorySection(memoryStart, memoryEnd + 1);

      console.log(memory);

      // Create our rows
      const paletteRows = [];

      // Function to generate our monochrome row
      const generateRow = (title, register) => {
        paletteRows.push(
          <tr>
            <th>{title}</th>
            {getMonochromeTableCell(register & 0x3)}
            {getMonochromeTableCell((register >> 2) & 0x3)}
            {getMonochromeTableCell((register >> 4) & 0x3)}
            {getMonochromeTableCell((register >> 6) & 0x3)}
          </tr>
        );
      };

      generateRow('BG Palette (0xFF47)', memory[0]);
      generateRow('Object Palette 0 (0xFF48)', memory[1]);
      generateRow('Object Palette 1 (0xFF49)', memory[2]);

      // Create our table
      const paletteTable = (
        <table className="palette-table">
          <tr>
            <th>Palette</th>
            <td>Color 0</td>
            <td>Color 1</td>
            <td>Color 2</td>
            <td>Color 3</td>
          </tr>

          {paletteRows}
        </table>
      );

      this.setState({
        paletteTable
      });
    };
    updateTask();
  }

  updateColor() {
    // TODO:
    const updateTask = async () => {};
    updateTask();
  }

  render() {
    return (
      <div class="palette-viewer">
        <h1>Palette Viewer</h1>
        <div>
          <i>Reminder: Color 0 is Transparent for Object Palettes.</i>
        </div>
        {this.state.paletteTable}
      </div>
    );
  }
}
