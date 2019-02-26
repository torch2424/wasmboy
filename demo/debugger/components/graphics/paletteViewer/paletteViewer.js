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

const getColorTableCell = (highByte, lowByte) => {
  // Combine into a 16 bit value
  const paletteBytes = (highByte << 8) + lowByte;

  // From core/graphics/palette
  // Goal is to reach 254 for each color, so 255 / 31 (0x1F) ~8 TODO: Make exact
  // Want 5 bits for each
  const redByte = paletteBytes & 0x1f;
  const greenByte = (paletteBytes >> 5) & 0x1f;
  const blueByte = (paletteBytes >> 10) & 0x1f;
  const red = redByte * 8;
  const green = greenByte * 8;
  const blue = blueByte * 8;

  return (
    <td class="palette-table__color">
      <div style={`background-color: rgb(${red}, ${green}, ${blue})`} class="palette-table__color__rendered" />
      <div class="palette-table__color__text">R: {`0x${redByte.toString(16).toUpperCase()}`}</div>
      <div class="palette-table__color__text">G: {`0x${greenByte.toString(16).toUpperCase()}`}</div>
      <div class="palette-table__color__text">B: {`0x${blueByte.toString(16).toUpperCase()}`}</div>
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
    if (!WasmBoy.isReady()) {
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
      // Get the palette memory registers
      const memoryStart = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff47]);
      const memoryEnd = await WasmBoy._runWasmExport('getWasmBoyOffsetFromGameBoyOffset', [0xff49]);
      const memory = await WasmBoy._getWasmMemorySection(memoryStart, memoryEnd + 1);

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
    const updateTask = async () => {
      // Get the CGB palette memory
      const memoryStart = await WasmBoy._getWasmConstant('GBC_PALETTE_LOCATION');
      const memoryEnd = memoryStart + (await WasmBoy._getWasmConstant('GBC_PALETTE_SIZE'));
      const memory = await WasmBoy._getWasmMemorySection(memoryStart, memoryEnd + 1);

      // Create our rows
      const paletteRows = [];

      // Function to generate our monochrome row
      const generateRow = (title, paletteBytes) => {
        paletteRows.push(
          <tr>
            <th>{title}</th>
            {getColorTableCell(paletteBytes[1], paletteBytes[0])}
            {getColorTableCell(paletteBytes[3], paletteBytes[2])}
            {getColorTableCell(paletteBytes[5], paletteBytes[4])}
            {getColorTableCell(paletteBytes[7], paletteBytes[6])}
          </tr>
        );
      };

      // Generate palette rows
      // Background
      for (let i = 0; i < 8; i++) {
        const title = `BG ${i}`;
        // 8 bytes per palette
        const memoryIndex = i * 8;
        const paletteBytes = memory.slice(memoryIndex, memoryIndex + 8);
        generateRow(title, paletteBytes);
      }
      // Sprites
      for (let i = 0; i < 8; i++) {
        const title = `OBJ ${i}`;
        // 8 bytes per palette
        // Add 64 for the background palettes
        const memoryIndex = 64 + i * 8;
        const paletteBytes = memory.slice(memoryIndex, memoryIndex + 8);
        generateRow(title, paletteBytes);
      }

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

  render() {
    return (
      <div class="palette-viewer">
        <h1>Palette Viewer</h1>
        <div>
          <b>NOTE:</b>
          <i>
            Color 0 is Transparent for Object Palettes. RGB is Red, Green, Blue.{' '}
            <a href="http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_Monochrome_Palettes" target="_blank">
              Game Boy Palette Documentation
            </a>
            .
          </i>
        </div>
        {this.state.paletteTable}
      </div>
    );
  }
}
