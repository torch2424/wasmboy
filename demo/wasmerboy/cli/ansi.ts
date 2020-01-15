// Ansi Sequences and convenience functions

import { Console } from 'as-wasi';

// ANSI Escape
const ESC: string = '\u001b[';

// Ansi Color Codes
export const GREEN: string = ESC + '32m';
export const WHITE: string = ESC + '37m';
export const RED: string = ESC + '31m';
export const CYAN: string = ESC + '36m';
export const RESET: string = ESC + '0m';

// Ansi Cursor Codes
export const HIDE_CURSOR: string = ESC + '?25h';

export function printColor(value: string, color: string): void {
  Console.write(color + value + RESET, false);
}

export function flushConsole(): void {
  Console.write(ESC + '2J', false);
}

// https://github.com/nojvek/matrix-rain/blob/master/ansi.js
export function moveCursorToPosition(column: i32, row: i32): void {
  let cursorPosition: string = ESC + row.toString() + ';' + column.toString() + 'H';
  Console.write(cursorPosition, false);

  // Hide the cursor
  Console.write(HIDE_CURSOR, false);
}
