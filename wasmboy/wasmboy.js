import fetch from 'unfetch'
import Promise from 'promise-polyfill';

class WasmBoyLib {

  // Start the request to our wasm module
  constructor() {
    //TODO: Don't hardcode our module path
    this.wasmModuleRequest = fetch('../dist/wasm/index.untouched.wasm')
    .then(response => response.arrayBuffer());
    this.wasmInstance = undefined;
    this.wasmByteMemory = undefined;
    this.gameBytes = undefined;
    this.paused = false;
    this.ready = false;
  }

  // Finish request for wasm module, and fetch game
  loadGame(canvasElement, pathToGame) {
    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    this.ready = false;
    return new Promise((resolve, reject) => {

      // Attempt to bind and get the canvas element context
      try {
        this.canvasElement = canvasElement;
        this.canvasContext = this.canvasElement.getContext('2d');
        this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasContext.scale(this.canvasElement.width / 160, this.canvasElement.height / 144);
      } catch(error) {
        reject(error);
      }

      Promise.all([
        this._getWasmInstance(),
        this._fetchGameAsByteArray('DMG_ROM.gb'),
        this._fetchGameAsByteArray(pathToGame)
      ]).then((responses) => {
        // Responses already bound to this, simple resolve parent promise
        // Set our gamebytes
        const biosBytes = responses[1];
        this.gameBytes = responses[2];

        // Load the game data into actual memory
        for(let i = 0; i < 0x7FFF; i++) {
          // Load the bios, then the game
          if(i < 0x100) {
            this.wasmByteMemory[i] = biosBytes[i];
          } else if(this.gameBytes[i]) {
              this.wasmByteMemory[i] = this.gameBytes[i];
          }
        }
        this.ready = true;
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }

  pauseGame() {
    this.paused = true;
  }

  resumeGame() {
    // Simply offload to start game
    this.startGame();
  }

  // Function to start the game
  startGame() {
    if (!this.ready) {
      return false;
    }

    // Un-pause the game
    this.paused = false;

    requestAnimationFrame(() => {
      this._emulationLoop();
    });

    return true;
  }

  render() {
    // Draw the pixels
    // 160x144
    // TODO: Maybe set y back to 144?, works with 143
    for(let y = 0; y < 143; y++) {
      for (let x = 0; x < 160; x++) {

        const pixelIndex = 0x10000 + (y * 160) + x;
        const color = this.wasmByteMemory[pixelIndex];
        if (color) {
          let fillStyle = false;
          if(color === 1) {
            fillStyle = "#FFFFFF";
          } else if (color === 2) {
            fillStyle = "#D3D3D3";
          } else if (color === 3) {
            fillStyle = "#A9A9A9";
          } else {
            fillStyle = "#000000";
          }
          this.canvasContext.fillStyle = fillStyle;
          this.canvasContext.fillRect(x, y, 1, 1);
        } else {
          // TODO: Remove this testing code:
          this.canvasContext.fillStyle = "#f30000";
          this.canvasContext.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // Private funciton to returna promise to our wasmModule
  _getWasmInstance() {
    return new Promise((resolve, reject) => {

      if (this.wasmInstance) {
        resolve(this.wasmInstance);
      }

      // Get our wasm instance from our request
      this.wasmInstance = this.wasmModuleRequest.then((binary) => {
        WebAssembly.instantiate(binary, {}).then((instantiatedWasm) => {

          const instance = instantiatedWasm.instance;
          const module = instantiatedWasm.module;
          // Log we got the wasm module loaded
          console.log('wasmboy wasm module instance instantiated', instance);

          // Get our memory from our wasm instance
          const memory = instance.exports.memory;

          // Grow our wasm memory to what we need if not already
          console.log('Growing Memory if needed...');
          console.log('Current memory size:', memory.buffer.byteLength);
          // Gameboy has a memory size of 0xFFFF
          // + (256 * 256) bits of data for graphics another 0xFFFF
          if (memory.buffer.byteLength < 0xFFFF + 0xFFFF) {
            console.log('Growing memory...');
            memory.grow(2);
            console.log('New memory size:', memory.buffer.byteLength);
          } else {
            console.log('Not growing memory...');
          }

          this.wasmInstance = instance;
          // Will stay in sync
          this.wasmByteMemory = new Uint8Array(this.wasmInstance.exports.memory.buffer);

          resolve(this.wasmInstance);

        });
      });
    });
  }

  // Private function to fetch a game
  _fetchGameAsByteArray(pathToGame) {
    return new Promise((resolve, reject) => {
      // Load our backup file
      fetch(pathToGame)
      .then(blob => {
        return blob.arrayBuffer();
      }).then(bytes => {
        const byteArray = new Uint8Array(bytes);
        resolve(byteArray);
      });
    });
  }

  _emulationLoop() {

    // TODO: Don't initialize if running boot rom
    // this.wasmInstance.exports.initialize();

    // Offload as much of this as possible to WASM
    // Feeding wasm bytes is probably going to slow things down, would be nice to just place the game in wasm memory
    // And read from there

    // Update (Execute a frame)
    const response = this.wasmInstance.exports.update();

    if(response > 0) {
      // Render the display
      this.render();

      // Run another frame
      if(!this.paused) {
        requestAnimationFrame(() => {
            this._emulationLoop();
        });
      }
      return true;
    } else {
      console.log('Wasmboy Crashed! Unknown upcode...');
    }
  }
}

export const WasmBoy = new WasmBoyLib();
