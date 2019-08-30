// Import WasmBoy
import { config, executeFrame, clearAudioBuffer, CARTRIDGE_ROM_LOCATION, FRAME_LOCATION } from '../../core/index';

// Import all of our utils and things
import { showHelp } from './cli/cli';

// Import our CommandLine for grabbing args
import { CommandLine, FileSystem, Descriptor, Date, Console } from './wasa';

function sleep(sleepTicks: f64): void {
  let lastTime: f64 = Date.now();

  let shouldLoop: boolean = true;

  while (shouldLoop) {
    let currentTime: f64 = Date.now();

    // See if it is time to update
    if (abs(lastTime - currentTime) > sleepTicks) {
      shouldLoop = false;
    }
  }
}

// Entry point into WASI Module
export function _start(): void {
  // Grow a little more
  memory.grow(20);

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
    1, // audioBatchProcessing: i32,
    0, // graphicsBatchProcessing: i32,
    0, // timersBatchProcessing: i32,
    0, // graphicsDisableScanlineRendering: i32,
    1, // audioAccumulateSamples: i32,
    0, // tileRendering: i32,
    0, // tileCaching: i32,
    0 // enableAudioDebugging: i32
  );

  // Get the wasmer framebuffer stuff
  Console.log('Opening files!');

  // TODO: Should have a leading /
  let fb: Descriptor = FileSystem.open('dev/wasmerfb0') as Descriptor;
  Console.log('fb Fd: ' + fb.rawfd.toString());
  let size: Descriptor = FileSystem.open('sys/class/graphics/wasmerfb/virtual_size') as Descriptor;
  Console.log('size Fd: ' + size.rawfd.toString());
  let draw: Descriptor = FileSystem.open('sys/class/graphics/wasmerfb/buffer_index_display') as Descriptor;
  Console.log('draw Fd: ' + draw.rawfd.toString());

  Console.log('Setting display size!');
  size.writeString('160x144');

  Console.log('Starting!');

  while (true) {
    executeFrame();
    clearAudioBuffer();

    let GAMEBOY_CAMERA_WIDTH = 160;
    let GAMEBOY_CAMERA_HEIGHT = 144;

    let imageDataArray = new Array<u8>(160 * 144 * 4);

    for (let y = 0; y < GAMEBOY_CAMERA_HEIGHT; ++y) {
      let stride1 = y * (GAMEBOY_CAMERA_WIDTH * 3);
      let stride2 = y * (GAMEBOY_CAMERA_WIDTH * 4);
      for (let x = 0; x < GAMEBOY_CAMERA_WIDTH; ++x) {
        // Each color has an R G B component
        const pixelStart = stride1 + x * 3;

        const imageDataIndex = stride2 + (x << 2);

        imageDataArray[imageDataIndex + 2] = load<u8>(CARTRIDGE_ROM_LOCATION + pixelStart + 0);
        imageDataArray[imageDataIndex + 1] = load<u8>(CARTRIDGE_ROM_LOCATION + pixelStart + 1);
        imageDataArray[imageDataIndex + 0] = load<u8>(CARTRIDGE_ROM_LOCATION + pixelStart + 2);

        // Alpha, no transparency
        imageDataArray[imageDataIndex + 3] = 255;
      }
    }

    // Draw into the framebuffer
    fb.write(imageDataArray);

    // Tell the framebuffer to draw
    let drawArray = new Array<u8>(1);
    drawArray[0] = 0;
    draw.write(drawArray);

    sleep(1.0);

    // Done!
  }
}
