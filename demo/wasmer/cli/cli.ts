// Convinience functions for our CLI

import { Console } from 'as-wasi';
import { GREEN, CYAN, RED, RESET, printColor } from './ansi';

export function showHelp(): void {
  Console.log('');
  printColor('wasm(er)boy', GREEN);
  Console.log('');

  printColor('USAGE:', CYAN);
  Console.log('');

  Console.log('[wapm run] wasmboy [my-rom.gb]');
  Console.log('');

  printColor('FLAGS:', CYAN);
  Console.log('');

  Console.log('-s, --speed');
  Console.log('Speed in frames per second to run the emulation');
  Console.log('Suggested: 60, Default: 60');
  Console.log('');

  Console.log('-h, --help');
  Console.log('Show this help message.');
  Console.log('');

  printColor('Controls:', CYAN);
  Console.log('');

  Console.log('Dpad:');
  Console.log('Up: Up Arrow, W');
  Console.log('Right: Right Arrow, D');
  Console.log('Down: Down Arrow, S');
  Console.log('Left: Left Arrow, A');
  Console.log('');

  Console.log('Button:');
  Console.log('A: X, Semicolon');
  Console.log('B: Z, Backspace');
  Console.log('Select: Shift, Tab');
  Console.log('Start: Enter, Space');
  Console.log('');
}
