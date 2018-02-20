import fetch from 'unfetch'
import Promise from 'promise-polyfill';
import { WasmBoyController } from './wasmboyController';

const GAMEBOY_CAMERA_WIDTH = 160;
const GAMEBOY_CAMERA_HEIGHT = 144;

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

    this.currentFrame = 0;
    this.logThrottle = false;
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

      // Attempt to bind and get the canvas element context
      try {
        this.canvasElement = canvasElement;
        this.canvasContext = this.canvasElement.getContext('2d');
        this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasContext.fillStyle = '#000000';
        this.canvasContext.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasImageData = this.canvasContext.createImageData(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT);

        // Scale the canvas
        // https://stackoverflow.com/questions/18547042/resizing-a-canvas-image-without-blurring-it
        this.canvasContext.imageSmoothingEnabled = false;
        this.canvasContext.scale(this.canvasElement.width / GAMEBOY_CAMERA_WIDTH, this.canvasElement.height / GAMEBOY_CAMERA_HEIGHT);

        // Get our audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch(error) {
        reject(error);
        return;
      }

      // Iniitialize our controller
      WasmBoyController.initialize();
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
              if(!this.logThrottle) {
                this.logThrottle = true;
                console.log("[WasmBoy] " + str);
                setTimeout(() => {
                  this.logThrottle = false;
                }, 1000)
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

  _emulationLoop() {
    // Offload as much of this as possible to WASM
    // Feeding wasm bytes is probably going to slow things down, would be nice to just place the game in wasm memory
    // And read from there

    // Update (Execute a frame)
    const response = this.wasmInstance.exports.update();

    if(response > 0) {
      // Render the display
      this._render();

      // Play the audio
      this._audio();

      // Get the controller state, and pass to wasm
      const controllerState = WasmBoyController.updateController();
      this.wasmInstance.exports.setJoypadState(
        controllerState.UP ? 1 : 0,
        controllerState.RIGHT ? 1 : 0,
        controllerState.DOWN ? 1 : 0,
        controllerState.LEFT ? 1 : 0,
        controllerState.A ? 1 : 0,
        controllerState.B ? 1 : 0,
        controllerState.SELECT ? 1 : 0,
        controllerState.START ? 1 : 0
      );

      // Run another frame
      if(!this.paused) {

        // increment our frame
        this.currentFrame++;
        if(this.currentFrame > 60) {
          this.currentFrame = 0;
        }

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

  _render() {
    // Draw the pixels
    // 160x144
    // Split off our image Data
    const imageDataArray = [];

    for(let y = 0; y < GAMEBOY_CAMERA_HEIGHT; y++) {
      for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; x++) {

        // Wasm Memory Mapping
        // See: https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
        const pixelIndex = 0x008000 + x + (y * GAMEBOY_CAMERA_WIDTH);
        const color = this.wasmByteMemory[pixelIndex];

        // Doing graphics using second answer on:
        // https://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
        // Image Data mapping
        const imageDataIndex = (x + (y * GAMEBOY_CAMERA_WIDTH)) * 4;
        let rgba = [];
        const alpha = 255;

        if (color) {
          if(color === 1) {
            rgba = [255, 255, 255, alpha];
          } else if (color === 2) {
            rgba = [211, 211, 211, alpha];
          } else if (color === 3) {
            rgba = [169, 169, 169, alpha];
          } else {
            rgba = [0, 0, 0, alpha];
          }
        } else {
          // TODO: Remove this testing code:
          rgba = [255, 0, 0, 1];
        }

        for(let i = 0; i < rgba.length; i++) {
          imageDataArray[imageDataIndex + i] = rgba[i];
        }
      }
    }

    // Add our new imageData
    for(let i = 0; i < imageDataArray.length; i++) {
      this.canvasImageData.data[i] = imageDataArray[i];
    }
    this.canvasContext.putImageData(this.canvasImageData, 0, 0);
    // drawImage to apply our canvas scale
    this.canvasContext.drawImage(this.canvasElement, 0, 0);
  }

  _audio() {
    // Function to do stuff with audio

    // Create an empty buffer with a the length of one second (once current frame is 60)
    let wasmBoySampleRate = 48000;
    let audioBuffer = this.audioContext.createBuffer(2, wasmBoySampleRate / 60, wasmBoySampleRate);

    // Set our soundIndex in wasmboy memory
    let soundIndex = 0x033400;

    this.currentFrame = 1;

    // Get the left channel from memory
    let leftChannelBuffer = audioBuffer.getChannelData(0);
    for (let i = soundIndex; this.wasmByteMemory[i] !== 0; i += 2) {

      // Get our audio sample
      let audioSample = this.wasmByteMemory[i];

      // Subtract 1 as it is added so the value is not empty
      audioSample -= 1;
      // Subtract 7 as that is our 0 value, since we want -1.0 to 1.0
      audioSample -= 7;
      // Divide by 7 to get our sample as a decimal
      audioSample = audioSample / 7;

      let bufferIndex = (i - soundIndex) * this.currentFrame;

      leftChannelBuffer[bufferIndex] = audioSample;

      // Clear the value
      this.wasmByteMemory[i] = 0;
    }

    // Get the right channel from memory
    let rightChannelBuffer = audioBuffer.getChannelData(1);
    for (let i = soundIndex + 1; this.wasmByteMemory[i] !== 0; i += 2) {
      // Get our audio sample
      let audioSample = this.wasmByteMemory[i];

      // Subtract 1 as it is added so the value is not empty
      audioSample -= 1;
      // Subtract 7 as that is our 0 value, since we want -1.0 to 1.0
      audioSample -= 7;
      // Divide by 7 to get our final volume
      audioSample = audioSample / 7;

      let bufferIndex = (i - soundIndex - 1) * this.currentFrame;
      rightChannelBuffer[bufferIndex] = audioSample;

      // Clear the value
      this.wasmByteMemory[i] = 0;
    }

    // Check if our buffer is filled and we should play it
    if(this.currentFrame === 1) {
      // Get an AudioBufferSourceNode.
      // This is the AudioNode to use when we want to play an AudioBuffer
      let source = this.audioContext.createBufferSource();

      // set the buffer in the AudioBufferSourceNode
      source.buffer = audioBuffer;

      // connect the AudioBufferSourceNode to the
      // destination so we can hear the sound
      source.connect(this.audioContext.destination);

      // start the source playing
      source.start();
    }
  }
}

export const WasmBoy = new WasmBoyLib();
