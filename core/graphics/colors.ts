// File for all of the logic of setting gameboy color plaettes

import {
  DefaultColors,
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
  GrayscaleColors
} from './colors.constants';

// Current / exported color
export class Colors {
  //Bg
  static bgWhite: i32 = DefaultColors.bgWhite;
  static bgLightGrey: i32 = DefaultColors.bgLightGrey;
  static bgDarkGrey: i32 = DefaultColors.bgDarkGrey;
  static bgBlack: i32 = DefaultColors.bgBlack;

  // Obj 0
  static obj0White: i32 = DefaultColors.obj0White;
  static obj0LightGrey: i32 = DefaultColors.obj0LightGrey;
  static obj0DarkGrey: i32 = DefaultColors.obj0DarkGrey;
  static obj0Black: i32 = DefaultColors.obj0Black;

  // Obj1
  static obj1White: i32 = DefaultColors.obj1White;
  static obj1LightGrey: i32 = DefaultColors.obj1LightGrey;
  static obj1DarkGrey: i32 = DefaultColors.obj1DarkGrey;
  static obj1Black: i32 = DefaultColors.obj1Black;
}

export function initializeColors(): void {
  Colors.bgWhite = DefaultColors.bgWhite;
  Colors.bgLightGrey = DefaultColors.bgLightGrey;
  Colors.bgDarkGrey = DefaultColors.bgDarkGrey;
  Colors.bgBlack = DefaultColors.bgBlack;

  Colors.obj0White = DefaultColors.obj0White;
  Colors.obj0LightGrey = DefaultColors.obj0LightGrey;
  Colors.obj0DarkGrey = DefaultColors.obj0DarkGrey;
  Colors.obj0Black = DefaultColors.obj0Black;

  Colors.obj1White = DefaultColors.obj1White;
  Colors.obj1LightGrey = DefaultColors.obj1LightGrey;
  Colors.obj1DarkGrey = DefaultColors.obj1DarkGrey;
  Colors.obj1Black = DefaultColors.obj1Black;

  // setColorizationPalette(2);
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
export function setColorizationPalette(colorizationId: i32): void {
  // Set the colorizationId clockwise according to:
  // https://en.wikipedia.org/wiki/Game_Boy_Color
  switch (colorizationId) {
    case 0:
      initializeColors();
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
  }
}
