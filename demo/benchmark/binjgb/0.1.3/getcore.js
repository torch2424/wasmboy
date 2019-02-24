// File to export a final wasmboy-like core

// Alot of logic taken from: https://github.com/binji/binjgb/blob/master/demo/demo.js

const RESULT_OK = 0;
const RESULT_ERROR = 1;
const SCREEN_WIDTH = 160;
const SCREEN_HEIGHT = 144;
const AUDIO_FRAMES = 4096;
const AUDIO_LATENCY_SEC = 0.1;
const MAX_UPDATE_SEC = 5 / 60;
const CPU_TICKS_PER_SECOND = 4194304;
const EVENT_NEW_FRAME = 1;
const EVENT_AUDIO_BUFFER_FULL = 2;
const EVENT_UNTIL_TICKS = 4;
const REWIND_FRAMES_PER_BASE_STATE = 45;
const REWIND_BUFFER_CAPACITY = 4 * 1024 * 1024;
const REWIND_FACTOR = 1.5;
const REWIND_UPDATE_MS = 16;
const BUILTIN_PALETTES = 83; // See builtin-palettes.def.

import Binjgb from './binjgb';

function makeWasmBuffer(module, ptr, size) {
  return new Uint8Array(module.buffer, ptr, size);
}

export default async function getBinjgbCore() {
  // Get our binjgb module
  const module = await Binjgb();

  // Create our byteMemory

  // Let's assume 8MB ROM
  const romBufferByteLength = 262144;
  const romDataPtr = module._malloc(romBufferByteLength);
  const romByteMemory = makeWasmBuffer(module, romDataPtr, romBufferByteLength);

  // set a placeholder for our emulator
  let e;

  // set a placehodler for our graphics memory
  let graphicsByteMemory;
  let rewindBufferPtr;
  let audioBufferPtr;

  // Create an array for our RGB buffer, that wasmboy will convert to rgba
  const rgbMemory = new Uint8ClampedArray(SCREEN_HEIGHT * SCREEN_WIDTH * 3);

  let core = {};
  core = {
    byteMemory: romByteMemory,
    instance: {
      exports: {
        CARTRIDGE_ROM_LOCATION: 0,
        FRAME_LOCATION: 0,
        FRAME_SIZE: 0x016c00,
        config: () => {
          // Rom is now loaded.

          // Create a new simple emulator?
          e = module._emulator_new_simple(romDataPtr, romBufferByteLength, 44100, AUDIO_FRAMES);
          if (e == 0) {
            throw new Error('Invalid ROM.');
          }

          graphicsByteMemory = makeWasmBuffer(module, module._get_frame_buffer_ptr(e), module._get_frame_buffer_size(e));

          // Need to create all other buffer
          rewindBufferPtr = module._rewind_new_simple(e, REWIND_FRAMES_PER_BASE_STATE, REWIND_BUFFER_CAPACITY);
          audioBufferPtr = makeWasmBuffer(module, module._get_audio_buffer_ptr(e), module._get_audio_buffer_capacity(e));

          // Now that we have our rom loaded, simply swap the byte memory for our purposes ;)
          core.byteMemory = rgbMemory;
        },
        executeFrame: () => {
          // console.log('EXECUTE');
          while (true) {
            const event = module._emulator_run_until_f64(e, CPU_TICKS_PER_SECOND);
            if (event & EVENT_NEW_FRAME) {
              // console.log('new frame');

              // Push Rewind Buffer
              module._rewind_append(rewindBufferPtr, e);

              // Output Graphics (normally here, but doing later for perf)
              // Convert the graphics memory to our rgb Memory
              for (let i = 0; i < SCREEN_HEIGHT * SCREEN_WIDTH; i++) {
                let rgbIndex = i * 3;
                let rgbaIndex = i * 4;

                rgbMemory[rgbIndex + 0] = graphicsByteMemory[rgbaIndex + 0];
                rgbMemory[rgbIndex + 1] = graphicsByteMemory[rgbaIndex + 1];
                rgbMemory[rgbIndex + 2] = graphicsByteMemory[rgbaIndex + 2];
              }
            }
            if (event & EVENT_AUDIO_BUFFER_FULL) {
              // Push the audio buffer
              // this.audio.pushBuffer();
              // console.log('audio')
            }
            if (event & EVENT_UNTIL_TICKS) {
              // console.log('ticks');
              break;
            }
          }
        }
      }
    }
  };

  return core;
}
