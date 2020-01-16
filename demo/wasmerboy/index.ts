// Import WasmBoy
import { config, executeFrame, clearAudioBuffer, setJoypadState, CARTRIDGE_ROM_LOCATION, FRAME_LOCATION } from '../../core/index';

// Import all of our utils and things
import { showHelp } from './cli/cli';

import { GREEN, CYAN, RED, printColor } from './cli/ansi';

// Import our CommandLine for grabbing args
import { CommandLine, FileSystem, Descriptor, Console, Time, Date } from 'as-wasi';

import {
  isIoDevicesEnabled,
  openFrameBufferWindow,
  drawRgbaArrayToFrameBuffer,
  updateInput,
  isKeyPressed
} from '../../node_modules/@wasmer/io-devices-lib-assemblyscript/lib/lib';

let GAMEBOY_CAMERA_WIDTH = 160;
let GAMEBOY_CAMERA_HEIGHT = 144;
let FRAMES_PER_SECOND = 60;
let whence: u8 = 2;

function update(): void {
  // Update the input from the io-devices
  updateInput(0);

  // Get the keys we care about
  let dpadUp: bool = isKeyPressed('KeyUp') || isKeyPressed('KeyW');
  let dpadRight: bool = isKeyPressed('KeyRight') || isKeyPressed('KeyD');
  let dpadDown: bool = isKeyPressed('KeyDown') || isKeyPressed('KeyS');
  let dpadLeft: bool = isKeyPressed('KeyLeft') || isKeyPressed('KeyA');
  let buttonA: bool = isKeyPressed('KeyX') || isKeyPressed('KeySemicolon');
  let buttonB: bool = isKeyPressed('KeyZ') || isKeyPressed('KeyBackspace');
  let buttonSelect: bool = isKeyPressed('KeyShift') || isKeyPressed('KeyTab');
  let buttonStart: bool = isKeyPressed('KeySpace') || isKeyPressed('KeyEnter');

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

function draw(): void {
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

  drawRgbaArrayToFrameBuffer(imageDataArray, 0);
}

// Entry point into WASI Module
export function _start(): void {
  // Check if IO Devices is enabled. Throw if not.
  isIoDevicesEnabled(true);

  // Parse command line arguments
  let commandLine = new CommandLine();
  let args: Array<string> = commandLine.all();

  if (args.length <= 1 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // Check if we have a sleep flag
  for (let i = 1; i < args.length - 1; i++) {
    if (args[i] == '--speed' || args[i] == '-s') {
      FRAMES_PER_SECOND = I32.parseInt(args[i + 1]);
      if (FRAMES_PER_SECOND < 1) {
        FRAMES_PER_SECOND = 1;
      }

      // Remove these arguments from the args
      args.splice(i, 2);

      // Reset i
      i = 0;
    }
  }

  // Finally, we should have parsed all flags, the last remaining arg should be the rom.
  let romArg: string = args[1];

  printColor('Loading Rom: ', CYAN);
  Console.log(romArg);
  Console.log('');

  // Check if the Rom Exists
  if (!FileSystem.exists(romArg)) {
    printColor('Rom File not found', RED);
    Console.log('');
    Console.log('');

    return;
  }

  // Read the ROM, place into memory
  let rom: Descriptor = FileSystem.open(romArg) as Descriptor;
  let romBytes = rom.readAll() as Array<u8>;
  for (let i: i32 = 0; i < romBytes.length; i++) {
    store<u8>(CARTRIDGE_ROM_LOCATION + i, romBytes[i]);
  }

  printColor('Configuring WasmBoy...', CYAN);
  Console.log('');
  Console.log('');

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

  printColor('Running WasmBoy!', GREEN);
  Console.log('');
  Console.log('');

  // Get how much time we want to spend on each frame to get our frames per second
  let timePerFrame: i32 = 1000 / FRAMES_PER_SECOND;

  // Open a framebuffer
  openFrameBufferWindow(GAMEBOY_CAMERA_WIDTH, GAMEBOY_CAMERA_HEIGHT, 0);

  while (true) {
    let startTime = Date.now();

    // Update Input and things
    update();

    // Draw the frame from wasmboy
    draw();

    let loopTime: i32 = <i32>(Date.now() - startTime) / 1000;
    let millisecondsToWaitForNextLoop: i32 = timePerFrame - loopTime;
    if (millisecondsToWaitForNextLoop > 0) {
      Time.sleep(millisecondsToWaitForNextLoop * Time.MILLISECOND);
    }
  }
}
