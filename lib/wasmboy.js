import fetch from 'unfetch'
import Promise from 'promise-polyfill';
import { WasmBoyGraphics } from './wasmboyGraphics';
import { WasmBoyAudio } from './wasmboyAudio';
import { WasmBoyController } from './wasmboyController';

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

    // TODO: Remove this debug code
    this.logRequest = false;
  }

  // Function to initialize our Wasmboy
  initialize(canvasElement, pathToWasmModule) {
    return new Promise((resolve, reject) => {

      // Start a request to the passed wasmboy wasm module
      this.wasmModuleRequest = fetch(pathToWasmModule)
      .then((response) => {
        resolve();
        return response.arrayBuffer();
      }).catch((error) => {
        reject(error);
        return;
      });

      // Initialize our services
      Promise.all([
        WasmBoyGraphics.initialize(canvasElement),
        WasmBoyAudio.initialize(),
        WasmBoyController.initialize()
      ]).then(() => {
        resolve();
      }).catch((error) => {
        reject(error);
      })
    });
  }

  // Finish request for wasm module, and fetch game
  loadGame(pathToGame) {
    // Getting started with wasm
    // http://webassembly.org/getting-started/js-api/
    this.ready = false;
    return new Promise((resolve, reject) => {
      Promise.all([
        this._getWasmInstance(),
        this._fetchGameAsByteArray(pathToGame)
      ]).then((responses) => {
        // Responses already bound to this, simple resolve parent promise
        // Set our gamebytes
        this.gameBytes = responses[1];

        // Load the game data into actual memory
        // In our wasmboy memory map, game data starts at:
        // 0x043400
        for(let i = 0; i < this.gameBytes.length; i++) {
          if (this.gameBytes[i]) {
            this.wasmByteMemory[0x043400 + i] = this.gameBytes[i];
          }
        }

        console.log(this.wasmByteMemory);

        // TODO: Pass in if we are using the boot rom
        this.wasmInstance.exports.initialize(0);

        this.ready = true;
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }

  // Function to start the game
  startGame() {
    return this.resumeGame();
  }

  resumeGame() {
    if (!this.ready) {
      return false;
    }

    // Un-pause the game
    this.paused = false;

    // Clear the display
    //this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    requestAnimationFrame(() => {
      this._emulationLoop();
    });
  }

  pauseGame() {
    this.paused = true;
  }

  // Loop performed to keep the emulator continuosly running
  _emulationLoop() {
    // Offload as much of this as possible to WASM
    // Feeding wasm bytes is probably going to slow things down, would be nice to just place the game in wasm memory
    // And read from there

    // Update (Execute a frame)
    const response = this.wasmInstance.exports.update();

    if(response > 0) {

      // Play the audio
      WasmBoyAudio.playAudio();
      // Render the display
      WasmBoyGraphics.renderFrame();
      // Get the controller state, and pass to wasm
      // NOTE: Sets the joypad state on the wasm instance for us
      WasmBoyController.updateController();

      // Run another frame
      if(!this.paused) {

        requestAnimationFrame(() => {
            this._emulationLoop();
        });
      }
      return true;
    } else {
      console.log('Wasmboy Crashed!');
        console.log(`Program Counter: 0x${this.wasmInstance.exports.getProgramCounter().toString(16)}`)
        console.log(`Opcode: 0x${this.wasmByteMemory[this.wasmInstance.exports.getProgramCounter()].toString(16)}`);
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
        WebAssembly.instantiate(binary, {
          env: {
            log: (message, numArgs, arg0, arg1, arg2, arg3, arg4, arg5) => {
              // Grab our string
              var len = new Uint32Array(this.wasmInstance.exports.memory.buffer, message, 1)[0];
              var str = String.fromCharCode.apply(null, new Uint16Array(this.wasmInstance.exports.memory.buffer, message + 4, len));
              if (numArgs > 0) str = str.replace("$0", arg0);
              if (numArgs > 1) str = str.replace("$1", arg1);
              if (numArgs > 2) str = str.replace("$2", arg2);
              if (numArgs > 3) str = str.replace("$3", arg3);
              if (numArgs > 4) str = str.replace("$4", arg4);
              if (numArgs > 5) str = str.replace("$5", arg5);

              // Log the string if no throttle
              console.log("[WasmBoy] " + str);
            },
            hexLog: (numArgs, arg0, arg1, arg2, arg3, arg4, arg5) => {

              if(!this.logRequest) {

                // Comment this line to disable throttle
                this.logRequest = true;

                // Grab our arguments, and log as hex
                let logString = '[WasmBoy]';
                if (numArgs > 0) logString += ` 0x${arg0.toString(16)} `;
                if (numArgs > 1) logString += ` 0x${arg1.toString(16)} `;
                if (numArgs > 2) logString += ` 0x${arg2.toString(16)} `;
                if (numArgs > 3) logString += ` 0x${arg3.toString(16)} `;
                if (numArgs > 4) logString += ` 0x${arg4.toString(16)} `;
                if (numArgs > 5) logString += ` 0x${arg5.toString(16)} `;

                setTimeout(() => {
                  console.log(logString);
                  this.logRequest = false;
                }, 250);
              }
            }
          }
        }).then((instantiatedWasm) => {

          const instance = this.wasmInstance = instantiatedWasm.instance;
          const module = instantiatedWasm.module;
          // Log we got the wasm module loaded
          console.log('wasmboy wasm module instance instantiated', instance);

          // Get our memory from our wasm instance
          const memory = instance.exports.memory;

          // Grow memory to wasmboy memory map
          // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
          // TODO: Scale Memory as needed
          if (memory.buffer.byteLength < 0x86FFFF) {
            console.log('Growing memory...');
            memory.grow(135);
            console.log('New memory size:', memory.buffer.byteLength);
          } else {
            console.log('Not growing memory...');
          }

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
}

export const WasmBoy = new WasmBoyLib();
