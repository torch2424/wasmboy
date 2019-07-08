// File for all of the logic of setting gameboy color plaettes

import {
  WasmBoyGBColors,
  BrownColors,
  RedColors,
  DarkBrownColors,
  GreenColors,
  DarkGreenColors,
  InvertedColors,
  PastelMixColors,
  OrangeColors,
  YellowColors,
  BlueColors,
  DarkBlueColors,
  GrayscaleColors,
  Table00Entry08Colors,
  Table01Entry0BColors,
  Table01Entry10Colors,
  Table03Entry0AColors,
  Table05Entry00Colors,
  Table05Entry01Colors,
  Table05Entry02Colors,
  Table05Entry08Colors,
  Table05Entry09Colors,
  Table05Entry11Colors,
  Table05Entry14Colors,
  Table05Entry15Colors
} from './colors.constants';
import { Cpu } from '../cpu/cpu';
import { eightBitLoadFromGBMemory } from '../memory/index';

// Current / exported color
export class Colors {
  //Bg
  static bgWhite: i32 = WasmBoyGBColors.bgWhite;
  static bgLightGrey: i32 = WasmBoyGBColors.bgLightGrey;
  static bgDarkGrey: i32 = WasmBoyGBColors.bgDarkGrey;
  static bgBlack: i32 = WasmBoyGBColors.bgBlack;

  // Obj 0
  static obj0White: i32 = WasmBoyGBColors.obj0White;
  static obj0LightGrey: i32 = WasmBoyGBColors.obj0LightGrey;
  static obj0DarkGrey: i32 = WasmBoyGBColors.obj0DarkGrey;
  static obj0Black: i32 = WasmBoyGBColors.obj0Black;

  // Obj1
  static obj1White: i32 = WasmBoyGBColors.obj1White;
  static obj1LightGrey: i32 = WasmBoyGBColors.obj1LightGrey;
  static obj1DarkGrey: i32 = WasmBoyGBColors.obj1DarkGrey;
  static obj1Black: i32 = WasmBoyGBColors.obj1Black;
}

// Inlined because closure compiler inlines
export function initializeColors(): void {
  setManualColorizationPalette(0);

  if (Cpu.GBCEnabled) {
    // Don't need to continue this if a GBC game
    return;
  }

  if (Cpu.BootROMEnabled) {
    if (!Cpu.GBCEnabled) {
      // GB
      return;
    }
  }

  // Do some automatic color palette swapping if we have a loaded ROM
  let titleChecksum: i32 = 0x00;
  for (let i: i32 = 0x0134; i <= 0x0143; i++) {
    titleChecksum += eightBitLoadFromGBMemory(i);
  }

  // Set the colorization for the game automatically if assigned
  // https://tcrf.net/Notes:Game_Boy_Color_Bootstrap_ROM
  let hash: i32 = titleChecksum & 0xff;
  setHashColorizationPalette(hash);
}

export function getRedFromHexColor(color: i32): i32 {
  return (color & 0xff0000) >> 16;
}

export function getGreenFromHexColor(color: i32): i32 {
  return (color & 0x00ff00) >> 8;
}

export function getBlueFromHexColor(color: i32): i32 {
  return color & 0x0000ff;
}

// Function to set the colorization
// By manually pressing buttons
export function setManualColorizationPalette(colorizationId: i32): void {
  // Set the colorizationId clockwise according to:
  // https://en.wikipedia.org/wiki/Game_Boy_Color
  switch (colorizationId) {
    case 0:
      Colors.bgWhite = WasmBoyGBColors.bgWhite;
      Colors.bgLightGrey = WasmBoyGBColors.bgLightGrey;
      Colors.bgDarkGrey = WasmBoyGBColors.bgDarkGrey;
      Colors.bgBlack = WasmBoyGBColors.bgBlack;

      Colors.obj0White = WasmBoyGBColors.obj0White;
      Colors.obj0LightGrey = WasmBoyGBColors.obj0LightGrey;
      Colors.obj0DarkGrey = WasmBoyGBColors.obj0DarkGrey;
      Colors.obj0Black = WasmBoyGBColors.obj0Black;

      Colors.obj1White = WasmBoyGBColors.obj1White;
      Colors.obj1LightGrey = WasmBoyGBColors.obj1LightGrey;
      Colors.obj1DarkGrey = WasmBoyGBColors.obj1DarkGrey;
      Colors.obj1Black = WasmBoyGBColors.obj1Black;
      break;
    case 1:
      // Up, Brown
      Colors.bgWhite = BrownColors.bgWhite;
      Colors.bgLightGrey = BrownColors.bgLightGrey;
      Colors.bgDarkGrey = BrownColors.bgDarkGrey;
      Colors.bgBlack = BrownColors.bgBlack;

      Colors.obj0White = BrownColors.obj0White;
      Colors.obj0LightGrey = BrownColors.obj0LightGrey;
      Colors.obj0DarkGrey = BrownColors.obj0DarkGrey;
      Colors.obj0Black = BrownColors.obj0Black;

      Colors.obj1White = BrownColors.obj1White;
      Colors.obj1LightGrey = BrownColors.obj1LightGrey;
      Colors.obj1DarkGrey = BrownColors.obj1DarkGrey;
      Colors.obj1Black = BrownColors.obj1Black;
      break;
    case 2:
      // Up + A, Red
      Colors.bgWhite = RedColors.bgWhite;
      Colors.bgLightGrey = RedColors.bgLightGrey;
      Colors.bgDarkGrey = RedColors.bgDarkGrey;
      Colors.bgBlack = RedColors.bgBlack;

      Colors.obj0White = RedColors.obj0White;
      Colors.obj0LightGrey = RedColors.obj0LightGrey;
      Colors.obj0DarkGrey = RedColors.obj0DarkGrey;
      Colors.obj0Black = RedColors.obj0Black;

      Colors.obj1White = RedColors.obj1White;
      Colors.obj1LightGrey = RedColors.obj1LightGrey;
      Colors.obj1DarkGrey = RedColors.obj1DarkGrey;
      Colors.obj1Black = RedColors.obj1Black;
      break;
    case 3:
      // Up + B, DarkBrown
      Colors.bgWhite = DarkBrownColors.bgWhite;
      Colors.bgLightGrey = DarkBrownColors.bgLightGrey;
      Colors.bgDarkGrey = DarkBrownColors.bgDarkGrey;
      Colors.bgBlack = DarkBrownColors.bgBlack;

      Colors.obj0White = DarkBrownColors.obj0White;
      Colors.obj0LightGrey = DarkBrownColors.obj0LightGrey;
      Colors.obj0DarkGrey = DarkBrownColors.obj0DarkGrey;
      Colors.obj0Black = DarkBrownColors.obj0Black;

      Colors.obj1White = DarkBrownColors.obj1White;
      Colors.obj1LightGrey = DarkBrownColors.obj1LightGrey;
      Colors.obj1DarkGrey = DarkBrownColors.obj1DarkGrey;
      Colors.obj1Black = DarkBrownColors.obj1Black;
      break;
    case 4:
      // Right, Green
      Colors.bgWhite = GreenColors.bgWhite;
      Colors.bgLightGrey = GreenColors.bgLightGrey;
      Colors.bgDarkGrey = GreenColors.bgDarkGrey;
      Colors.bgBlack = GreenColors.bgBlack;

      Colors.obj0White = GreenColors.obj0White;
      Colors.obj0LightGrey = GreenColors.obj0LightGrey;
      Colors.obj0DarkGrey = GreenColors.obj0DarkGrey;
      Colors.obj0Black = GreenColors.obj0Black;

      Colors.obj1White = GreenColors.obj1White;
      Colors.obj1LightGrey = GreenColors.obj1LightGrey;
      Colors.obj1DarkGrey = GreenColors.obj1DarkGrey;
      Colors.obj1Black = GreenColors.obj1Black;
      break;
    case 5:
      // Right + A, DarkGreenColors
      Colors.bgWhite = DarkGreenColors.bgWhite;
      Colors.bgLightGrey = DarkGreenColors.bgLightGrey;
      Colors.bgDarkGrey = DarkGreenColors.bgDarkGrey;
      Colors.bgBlack = DarkGreenColors.bgBlack;

      Colors.obj0White = DarkGreenColors.obj0White;
      Colors.obj0LightGrey = DarkGreenColors.obj0LightGrey;
      Colors.obj0DarkGrey = DarkGreenColors.obj0DarkGrey;
      Colors.obj0Black = DarkGreenColors.obj0Black;

      Colors.obj1White = DarkGreenColors.obj1White;
      Colors.obj1LightGrey = DarkGreenColors.obj1LightGrey;
      Colors.obj1DarkGrey = DarkGreenColors.obj1DarkGrey;
      Colors.obj1Black = DarkGreenColors.obj1Black;
      break;
    case 6:
      // Right + B, InvertedColors
      Colors.bgWhite = InvertedColors.bgWhite;
      Colors.bgLightGrey = InvertedColors.bgLightGrey;
      Colors.bgDarkGrey = InvertedColors.bgDarkGrey;
      Colors.bgBlack = InvertedColors.bgBlack;

      Colors.obj0White = InvertedColors.obj0White;
      Colors.obj0LightGrey = InvertedColors.obj0LightGrey;
      Colors.obj0DarkGrey = InvertedColors.obj0DarkGrey;
      Colors.obj0Black = InvertedColors.obj0Black;

      Colors.obj1White = InvertedColors.obj1White;
      Colors.obj1LightGrey = InvertedColors.obj1LightGrey;
      Colors.obj1DarkGrey = InvertedColors.obj1DarkGrey;
      Colors.obj1Black = InvertedColors.obj1Black;
      break;
    case 7:
      // Down, PastelMixColors
      Colors.bgWhite = PastelMixColors.bgWhite;
      Colors.bgLightGrey = PastelMixColors.bgLightGrey;
      Colors.bgDarkGrey = PastelMixColors.bgDarkGrey;
      Colors.bgBlack = PastelMixColors.bgBlack;

      Colors.obj0White = PastelMixColors.obj0White;
      Colors.obj0LightGrey = PastelMixColors.obj0LightGrey;
      Colors.obj0DarkGrey = PastelMixColors.obj0DarkGrey;
      Colors.obj0Black = PastelMixColors.obj0Black;

      Colors.obj1White = PastelMixColors.obj1White;
      Colors.obj1LightGrey = PastelMixColors.obj1LightGrey;
      Colors.obj1DarkGrey = PastelMixColors.obj1DarkGrey;
      Colors.obj1Black = PastelMixColors.obj1Black;
      break;
    case 8:
      // Down + A, Orange
      Colors.bgWhite = OrangeColors.bgWhite;
      Colors.bgLightGrey = OrangeColors.bgLightGrey;
      Colors.bgDarkGrey = OrangeColors.bgDarkGrey;
      Colors.bgBlack = OrangeColors.bgBlack;

      Colors.obj0White = OrangeColors.obj0White;
      Colors.obj0LightGrey = OrangeColors.obj0LightGrey;
      Colors.obj0DarkGrey = OrangeColors.obj0DarkGrey;
      Colors.obj0Black = OrangeColors.obj0Black;

      Colors.obj1White = OrangeColors.obj1White;
      Colors.obj1LightGrey = OrangeColors.obj1LightGrey;
      Colors.obj1DarkGrey = OrangeColors.obj1DarkGrey;
      Colors.obj1Black = OrangeColors.obj1Black;
      break;
    case 9:
      // Down + B, Yellow
      Colors.bgWhite = YellowColors.bgWhite;
      Colors.bgLightGrey = YellowColors.bgLightGrey;
      Colors.bgDarkGrey = YellowColors.bgDarkGrey;
      Colors.bgBlack = YellowColors.bgBlack;

      Colors.obj0White = YellowColors.obj0White;
      Colors.obj0LightGrey = YellowColors.obj0LightGrey;
      Colors.obj0DarkGrey = YellowColors.obj0DarkGrey;
      Colors.obj0Black = YellowColors.obj0Black;

      Colors.obj1White = YellowColors.obj1White;
      Colors.obj1LightGrey = YellowColors.obj1LightGrey;
      Colors.obj1DarkGrey = YellowColors.obj1DarkGrey;
      Colors.obj1Black = YellowColors.obj1Black;
      break;
    case 10:
      // Left, Blue
      Colors.bgWhite = BlueColors.bgWhite;
      Colors.bgLightGrey = BlueColors.bgLightGrey;
      Colors.bgDarkGrey = BlueColors.bgDarkGrey;
      Colors.bgBlack = BlueColors.bgBlack;

      Colors.obj0White = BlueColors.obj0White;
      Colors.obj0LightGrey = BlueColors.obj0LightGrey;
      Colors.obj0DarkGrey = BlueColors.obj0DarkGrey;
      Colors.obj0Black = BlueColors.obj0Black;

      Colors.obj1White = BlueColors.obj1White;
      Colors.obj1LightGrey = BlueColors.obj1LightGrey;
      Colors.obj1DarkGrey = BlueColors.obj1DarkGrey;
      Colors.obj1Black = BlueColors.obj1Black;
      break;
    case 11:
      // Left + A, Dark Blue
      Colors.bgWhite = DarkBlueColors.bgWhite;
      Colors.bgLightGrey = DarkBlueColors.bgLightGrey;
      Colors.bgDarkGrey = DarkBlueColors.bgDarkGrey;
      Colors.bgBlack = DarkBlueColors.bgBlack;

      Colors.obj0White = DarkBlueColors.obj0White;
      Colors.obj0LightGrey = DarkBlueColors.obj0LightGrey;
      Colors.obj0DarkGrey = DarkBlueColors.obj0DarkGrey;
      Colors.obj0Black = DarkBlueColors.obj0Black;

      Colors.obj1White = DarkBlueColors.obj1White;
      Colors.obj1LightGrey = DarkBlueColors.obj1LightGrey;
      Colors.obj1DarkGrey = DarkBlueColors.obj1DarkGrey;
      Colors.obj1Black = DarkBlueColors.obj1Black;
      break;
    case 12:
      // Left + B, GrayScale
      Colors.bgWhite = GrayscaleColors.bgWhite;
      Colors.bgLightGrey = GrayscaleColors.bgLightGrey;
      Colors.bgDarkGrey = GrayscaleColors.bgDarkGrey;
      Colors.bgBlack = GrayscaleColors.bgBlack;

      Colors.obj0White = GrayscaleColors.obj0White;
      Colors.obj0LightGrey = GrayscaleColors.obj0LightGrey;
      Colors.obj0DarkGrey = GrayscaleColors.obj0DarkGrey;
      Colors.obj0Black = GrayscaleColors.obj0Black;

      Colors.obj1White = GrayscaleColors.obj1White;
      Colors.obj1LightGrey = GrayscaleColors.obj1LightGrey;
      Colors.obj1DarkGrey = GrayscaleColors.obj1DarkGrey;
      Colors.obj1Black = GrayscaleColors.obj1Black;
      break;
  }
}

// Function to set the colorization
// By checksum of the title
// https://forums.nesdev.com/viewtopic.php?f=20&t=10226
// TODO: torch2424 need to find how to get the "disambiguation"
// Inlined because closure compiler inlines
export function setHashColorizationPalette(hash: i32): void {
  switch (hash) {
    case 0x88:
      Colors.bgWhite = Table00Entry08Colors.bgWhite;
      Colors.bgLightGrey = Table00Entry08Colors.bgLightGrey;
      Colors.bgDarkGrey = Table00Entry08Colors.bgDarkGrey;
      Colors.bgBlack = Table00Entry08Colors.bgBlack;

      Colors.obj0White = Table00Entry08Colors.obj0White;
      Colors.obj0LightGrey = Table00Entry08Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table00Entry08Colors.obj0DarkGrey;
      Colors.obj0Black = Table00Entry08Colors.obj0Black;

      Colors.obj1White = Table00Entry08Colors.obj1White;
      Colors.obj1LightGrey = Table00Entry08Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table00Entry08Colors.obj1DarkGrey;
      Colors.obj1Black = Table00Entry08Colors.obj1Black;
      break;
    case 0x61:
      Colors.bgWhite = Table01Entry0BColors.bgWhite;
      Colors.bgLightGrey = Table01Entry0BColors.bgLightGrey;
      Colors.bgDarkGrey = Table01Entry0BColors.bgDarkGrey;
      Colors.bgBlack = Table01Entry0BColors.bgBlack;

      Colors.obj0White = Table01Entry0BColors.obj0White;
      Colors.obj0LightGrey = Table01Entry0BColors.obj0LightGrey;
      Colors.obj0DarkGrey = Table01Entry0BColors.obj0DarkGrey;
      Colors.obj0Black = Table01Entry0BColors.obj0Black;

      Colors.obj1White = Table01Entry0BColors.obj1White;
      Colors.obj1LightGrey = Table01Entry0BColors.obj1LightGrey;
      Colors.obj1DarkGrey = Table01Entry0BColors.obj1DarkGrey;
      Colors.obj1Black = Table01Entry0BColors.obj1Black;
      break;
    case 0x14:
      Colors.bgWhite = Table01Entry10Colors.bgWhite;
      Colors.bgLightGrey = Table01Entry10Colors.bgLightGrey;
      Colors.bgDarkGrey = Table01Entry10Colors.bgDarkGrey;
      Colors.bgBlack = Table01Entry10Colors.bgBlack;

      Colors.obj0White = Table01Entry10Colors.obj0White;
      Colors.obj0LightGrey = Table01Entry10Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table01Entry10Colors.obj0DarkGrey;
      Colors.obj0Black = Table01Entry10Colors.obj0Black;

      Colors.obj1White = Table01Entry10Colors.obj1White;
      Colors.obj1LightGrey = Table01Entry10Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table01Entry10Colors.obj1DarkGrey;
      Colors.obj1Black = Table01Entry10Colors.obj1Black;
      break;
    case 0x46:
      Colors.bgWhite = Table03Entry0AColors.bgWhite;
      Colors.bgLightGrey = Table03Entry0AColors.bgLightGrey;
      Colors.bgDarkGrey = Table03Entry0AColors.bgDarkGrey;
      Colors.bgBlack = Table03Entry0AColors.bgBlack;

      Colors.obj0White = Table03Entry0AColors.obj0White;
      Colors.obj0LightGrey = Table03Entry0AColors.obj0LightGrey;
      Colors.obj0DarkGrey = Table03Entry0AColors.obj0DarkGrey;
      Colors.obj0Black = Table03Entry0AColors.obj0Black;

      Colors.obj1White = Table03Entry0AColors.obj1White;
      Colors.obj1LightGrey = Table03Entry0AColors.obj1LightGrey;
      Colors.obj1DarkGrey = Table03Entry0AColors.obj1DarkGrey;
      Colors.obj1Black = Table03Entry0AColors.obj1Black;
      break;
    case 0x59:
    case 0xc6:
      Colors.bgWhite = Table05Entry00Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry00Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry00Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry00Colors.bgBlack;

      Colors.obj0White = Table05Entry00Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry00Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry00Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry00Colors.obj0Black;

      Colors.obj1White = Table05Entry00Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry00Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry00Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry00Colors.obj1Black;
      break;
    case 0x86:
    case 0xa8:
      Colors.bgWhite = Table05Entry01Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry01Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry01Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry01Colors.bgBlack;

      Colors.obj0White = Table05Entry01Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry01Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry01Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry01Colors.obj0Black;

      Colors.obj1White = Table05Entry01Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry01Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry01Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry01Colors.obj1Black;
      break;
    case 0xbf:
    case 0xce:
    case 0xd1:
    case 0xf0:
      Colors.bgWhite = Table05Entry02Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry02Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry02Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry02Colors.bgBlack;

      Colors.obj0White = Table05Entry02Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry02Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry02Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry02Colors.obj0Black;

      Colors.obj1White = Table05Entry02Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry02Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry02Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry02Colors.obj1Black;
      break;
    case 0x27:
    case 0x49:
    case 0x5c:
    case 0xb3:
      Colors.bgWhite = Table05Entry08Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry08Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry08Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry08Colors.bgBlack;

      Colors.obj0White = Table05Entry08Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry08Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry08Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry08Colors.obj0Black;

      Colors.obj1White = Table05Entry08Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry08Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry08Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry08Colors.obj1Black;
      break;
    case 0xc9:
      Colors.bgWhite = Table05Entry09Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry09Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry09Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry09Colors.bgBlack;

      Colors.obj0White = Table05Entry09Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry09Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry09Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry09Colors.obj0Black;

      Colors.obj1White = Table05Entry09Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry09Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry09Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry09Colors.obj1Black;
      break;
    case 0x70:
      Colors.bgWhite = Table05Entry11Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry11Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry11Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry11Colors.bgBlack;

      Colors.obj0White = Table05Entry11Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry11Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry11Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry11Colors.obj0Black;

      Colors.obj1White = Table05Entry11Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry11Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry11Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry11Colors.obj1Black;
      break;
    case 0x46:
      Colors.bgWhite = Table05Entry14Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry14Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry14Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry14Colors.bgBlack;

      Colors.obj0White = Table05Entry14Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry14Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry14Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry14Colors.obj0Black;

      Colors.obj1White = Table05Entry14Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry14Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry14Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry14Colors.obj1Black;
      break;
    case 0xd3:
      Colors.bgWhite = Table05Entry15Colors.bgWhite;
      Colors.bgLightGrey = Table05Entry15Colors.bgLightGrey;
      Colors.bgDarkGrey = Table05Entry15Colors.bgDarkGrey;
      Colors.bgBlack = Table05Entry15Colors.bgBlack;

      Colors.obj0White = Table05Entry15Colors.obj0White;
      Colors.obj0LightGrey = Table05Entry15Colors.obj0LightGrey;
      Colors.obj0DarkGrey = Table05Entry15Colors.obj0DarkGrey;
      Colors.obj0Black = Table05Entry15Colors.obj0Black;

      Colors.obj1White = Table05Entry15Colors.obj1White;
      Colors.obj1LightGrey = Table05Entry15Colors.obj1LightGrey;
      Colors.obj1DarkGrey = Table05Entry15Colors.obj1DarkGrey;
      Colors.obj1Black = Table05Entry15Colors.obj1Black;
      break;
  }
}
