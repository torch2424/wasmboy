// Import WasmBoy
import { config, executeFrame, CARTRIDGE_ROM_LOCATION, FRAME_LOCATION } from '../../core/index';

// Import all of our utils and things
import { showHelp } from './cli/cli';

// Import our CommandLine for grabbing args
import { CommandLine, FileSystem, Descriptor, Performance, Console } from './wasa';

function sleep(sleepTicks: f64): void {
  let lastTime: f64 = Performance.now();

  let shouldLoop: boolean = true;

  while (shouldLoop) {
    let currentTime: f64 = Performance.now();

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

  let arg: string = args[0];

  // Read the ROM, place into memory
  let rom: Descriptor = FileSystem.open(arg) as Descriptor;
  let romBytes = rom.readAll() as Array<u8>;
  for (let i: i32 = 0; i < romBytes.length; i++) {
    store<u8>(CARTRIDGE_ROM_LOCATION + i, romBytes[i]);
  }

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
  let fb: Descriptor = FileSystem.open('/dev/wasmerfb0') as Descriptor;
  let size: Descriptor = FileSystem.open('/dev/wasmerfb0') as Descriptor;
  let draw: Descriptor = FileSystem.open('/sys/class/graphics/wasmerfb/buffer_index_display') as Descriptor;

  size.writeString('160x144');

  while (true) {
    Console.log('Running!');

    executeFrame();

    let frame = new Array<u8>(160 * 144);
    for (let x = 0; x < 160; x++) {
      for (let y = 0; y < 144; y++) {
        let pixelIndex = y * 160 + x;
        frame[pixelIndex] = load<u8>(FRAME_LOCATION + pixelIndex);
      }
    }

    // Draw into the framebuffer
    fb.write(frame);

    // Tell the framebuffer to draw
    draw.writeString('1');

    sleep(20.0);

    // Done!
  }
}
