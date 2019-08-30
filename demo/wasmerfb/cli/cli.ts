// Convinience functions for our CLI

import { Console } from '../wasa';
import { GREEN, CYAN, RED, RESET, printColor } from './ansi';

export function showHelp(): void {
  Console.log('');
  printColor('wasiboy', GREEN);
  Console.log('');

  printColor('USAGE:', CYAN);
  Console.log('');

  Console.log('[wapm run] wasm-matrix -l $LINES -c $COLUMNS');
  Console.log('');

  printColor('FLAGS:', CYAN);
  Console.log('');

  Console.log('-l, --lines ' + RED + '(REQUIRED)' + RESET);
  Console.log('Number of lines (rows) to render the matrix');
  Console.log('Suggested: $LINES [Bash Variable], Default: 24');
  Console.log('');

  Console.log('-c, --columns ' + RED + '(REQUIRED)' + RESET);
  Console.log('Number of columns to render the matrix');
  Console.log('Suggested: $COLUMNS [Bash Variable], Default: 80');
  Console.log('');

  Console.log('-s, --speed');
  Console.log('Speed of the matrix');
  Console.log('Suggested: 1, Default: 1');
  Console.log('');
}
