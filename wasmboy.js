// Simply a ES6 version of the Assembly script game of life demo
// https://github.com/AssemblyScript/assemblyscript/tree/master/examples/game-of-life
import { Component } from 'preact';
import fetch from 'unfetch'

export class Wasmboy extends Component {

  constructor() {
		super();
		// set our state to if we are initialized or not
		this.state = {
			initialized: false
		};
	}

  componentDidMount() {
    console.clear();
    console.log('Playground componentDidMount()');
    this.initialize();
  }

  initialize() {
    // Some hack-y code to test loading the wasm module
    if(this.state.initialized) return;
    this.state.initialized = true;

    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/

    // Load wasm module with fetch
    fetch('dist/wasm/index.untouched.wasm')
    .then(response => response.arrayBuffer())
    .then(binary => {
      // Log we got the wasm module loaded
      console.log('wasmboy wasm instantiated');

      // Create the wasm module, and get it's instance
      const module = new WebAssembly.Module(binary);
      const instance = new WebAssembly.Instance(module, {});

      // Get our memory from our wasm instance
      const memory = instance.exports.memory;

      // Grow our wasm memory to what we need if not already
      console.log('Growing Memory if needed...');
      console.log('Current memory size:', memory.buffer.byteLength);
      // Gameboy has a memory size of 65536
      if (memory.buffer.byteLength < 65536) {
        console.log('Growing memory...');
        memory.grow(1);
        console.log('New memory size:', memory.buffer.byteLength);
      } else {
        console.log('Not growing memory...');
      }

      // Load our backup file
      fetch('backup.gb')
      .then(blob => {
        return blob.arrayBuffer();
      })
      .then(bytes => {
        const byteArray = new Uint8Array(bytes);
        console.log('Opcode array: ', byteArray);

        //https://gist.github.com/scottferg/3886608
        // Every gameboy cartridge has an offset of 0x134
        const startOpcode = byteArray[0x134];
        console.log('Start opcode', parseInt(byteArray[0x134], 16));

        if (!instance.exports.handleOpcode(startOpcode)) {
            console.log('Error, opcode not recognized: ', startOpcode.toString(16));
        }
      });
    });
  }

	render() {
		return (
      <div>
  			<canvas id="canvas"
          style="border: 1px solid black;"
          width="640"
          height="480">
        </canvas>
      </div>
		);
	}
}
