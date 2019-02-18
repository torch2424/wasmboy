// File for all of the logic of setting gameboy color plaettes

import { DefaultColors, GreenColors } from './colors.constants';

// Current / exported color
export class Colors {
  //Bg
  static readonly bgWhite: i32 = DefaultColors.bgWhite;
  static readonly bgLightGrey: i32 = DefaultColors.bgLightGrey;
  static readonly bgDarkGrey: i32 = DefaultColors.bgDarkGrey;
  static readonly bglack: i32 = DefaultColors.bgBlack;

  // Obj 0
  static readonly obj0White: i32 = DefaultColors.obj0White;
  static readonly obj0LightGrey: i32 = DefaultColors.obj0LightGrey;
  static readonly obj0DarkGrey: i32 = DefaultColors.obj0DarkGrey;
  static readonly obj0Black: i32 = DefaultColors.obj0Black;

  // Obj1
  static readonly obj1White: i32 = DefaultColors.obj1White;
  static readonly obj1LightGrey: i32 = DefaultColors.obj1LightGrey;
  static readonly obj1DarkGrey: i32 = DefaultColors.obj1DarkGrey;
  static readonly obj1Black: i32 = DefaultColors.obj1Black;
}

export function initializeColors(): void {
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
