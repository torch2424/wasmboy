// Import WasmBoy
import { config, executeFrame, clearAudioBuffer, setJoypadState, CARTRIDGE_ROM_LOCATION, FRAME_LOCATION } from '../../core/index';

// Import all of our utils and things
import { showHelp } from './cli/cli';

// Import our CommandLine for grabbing args
import { CommandLine, FileSystem, Descriptor, Console, Time, Date } from 'as-wasi';

import {
  openFrameBufferWindow,
  drawRgbaArrayToFrameBuffer,
  updateInput,
  isKeyPressed
} from '../../node_modules/@wasmer/io-devices-lib-assemblyscript/assemblyscript/lib/lib';

let GAMEBOY_CAMERA_WIDTH = 160;
let GAMEBOY_CAMERA_HEIGHT = 144;
let whence: u8 = 2;

function update(): void {
  // Update the input from the io-devices
  updateInput();

  // Get the keys we care about
  let dpadUp: bool = isKeyPressed('KeyUp');
  let dpadRight: bool = isKeyPressed('KeyRight');
  let dpadDown: bool = isKeyPressed('KeyDown');
  let dpadLeft: bool = isKeyPressed('KeyLeft');
  let buttonA: bool = isKeyPressed('KeyX');
  let buttonB: bool = isKeyPressed('KeyZ');
  let buttonSelect: bool = isKeyPressed('KeyShift');
  let buttonStart: bool = isKeyPressed('KeySpace');

  Console.log('Dpad Left! ' + dpadLeft.toString());

  setJoypadState(
    dpadUp ? 1 : 0, // up
    dpadRight ? 1 : 0, // right
    dpadDown ? 1 : 0, // down
    dpadLeft ? 1 : 0, // left
    buttonA ? 1 : 0, // a
    buttonB ? 1 : 0, // b
    buttonSelect ? 1 : 0, // select
    buttonStart ? 1 : 0 // start
  );

  // Run a frame a wasmboy
  executeFrame();
  clearAudioBuffer();
}

function draw(frameBuffer: Descriptor): void {
  let imageDataArray = new Array<u8>(160 * 144 * 4);

  for (let y = 0; y < GAMEBOY_CAMERA_HEIGHT; ++y) {
    let stride1 = y * (GAMEBOY_CAMERA_WIDTH * 3);
    let stride2 = y * (GAMEBOY_CAMERA_WIDTH * 4);
    for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; ++x) {
      // Each color has an R G B component
      const pixelStart = stride1 + x * 3;

      const imageDataIndex = stride2 + (x << 2);

      imageDataArray[imageDataIndex + 2] = load<u8>(FRAME_LOCATION + pixelStart + 0);
      imageDataArray[imageDataIndex + 1] = load<u8>(FRAME_LOCATION + pixelStart + 1);
      imageDataArray[imageDataIndex + 0] = load<u8>(FRAME_LOCATION + pixelStart + 2);

      // Alpha, no transparency
      imageDataArray[imageDataIndex + 3] = 255;
    }
  }

  drawRgbaArrayToFrameBuffer(imageDataArray, frameBuffer, 0);
}

// Entry point into WASI Module
export function _start(): void {
  // Parse command line arguments
  let commandLine = new CommandLine();
  let args: Array<string> = commandLine.all();

  if (args.length <= 1) {
    showHelp();
    return;
  }

  let arg: string = args[1];

  Console.log('Loading Rom: ' + arg);

  // Read the ROM, place into memory
  let rom: Descriptor = FileSystem.open(arg) as Descriptor;
  Console.log('Rom Fd: ' + rom.rawfd.toString());
  let romBytes = rom.readAll() as Array<u8>;
  for (let i: i32 = 0; i < romBytes.length; i++) {
    store<u8>(CARTRIDGE_ROM_LOCATION + i, romBytes[i]);
  }

  Console.log('Configuring WasmBoy...');

  // Configure the core
  config(
    0, // enableBootRom: i32,
    1, // useGbcWhenAvailable: i32,
    0, // audioBatchProcessing: i32,
    0, // graphicsBatchProcessing: i32,
    0, // timersBatchProcessing: i32,
    0, // graphicsDisableScanlineRendering: i32,
    0, // audioAccumulateSamples: i32,
    0, // tileRendering: i32,
    0, // tileCaching: i32,
    0 // enableAudioDebugging: i32
  );

  Console.log('Starting!');

  // Open a framebuffer
  let frameBuffer: Descriptor = openFrameBufferWindow(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT, 0);

  while (true) {
    let startTime = Date.now();

    // Update Input and things
    update();

    // Draw the frame from wasmboy
    draw(frameBuffer);

    let loopTime: i32 = <i32>(Date.now() - startTime) / 1000;
    let millisecondsToWaitForNextLoop: i32 = 16 - loopTime;
    if (millisecondsToWaitForNextLoop > 0) {
      Time.sleep(millisecondsToWaitForNextLoop * Time.MILLISECOND);
      // Time.sleep(1 * Time.MILLISECOND);
    }
  }
}
