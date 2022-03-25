(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.WasmBoyTsCore = factory());
}(this, (function () { 'use strict';

  // Banner placed by rollup to mock out some items on our esm build
  // This is useful for things like wasmmemory
  const wasmboyMemorySize = 0x8b0000; // Simply initialized to the size we need

  const wasmByteMemory = new Uint8ClampedArray(wasmboyMemorySize); // Memory mock

  const memory = {
    size: () => {
      return wasmboyMemorySize;
    },
    grow: () => {},
    wasmByteMemory: wasmByteMemory
  };

  const load = offset => {
    return wasmByteMemory[offset];
  };

  const store = (offset, value) => {
    wasmByteMemory[offset] = value;
  };

  const abs = value => {
    return Math.abs(value);
  };

  const ceil = value => {
    return Math.ceil(value);
  }; // Constants that will be shared by the wasm core of the emulator
  // And libraries built around the wasm (such as the official JS), or @CryZe wasmboy-rs
  // ----------------------------------
  // Wasmboy Memory Map
  // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
  // ----------------------------------
  // AssemblyScript


  var ASSEMBLYSCRIPT_MEMORY_LOCATION = 0x000000;
  var ASSEMBLYSCRIPT_MEMORY_SIZE = 0x000400; // WasmBoy States

  var WASMBOY_STATE_LOCATION = ASSEMBLYSCRIPT_MEMORY_LOCATION + ASSEMBLYSCRIPT_MEMORY_SIZE;
  var WASMBOY_STATE_SIZE = 0x000400; // Gameboy Internal Memory

  var VIDEO_RAM_LOCATION = WASMBOY_STATE_LOCATION + WASMBOY_STATE_SIZE;
  var VIDEO_RAM_SIZE = 0x004000;
  var WORK_RAM_LOCATION = VIDEO_RAM_LOCATION + VIDEO_RAM_SIZE;
  var WORK_RAM_SIZE = 0x008000;
  var OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION = WORK_RAM_LOCATION + WORK_RAM_SIZE;
  var OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE = 0x004000; // General Gameboy Internal Memory

  var GAMEBOY_INTERNAL_MEMORY_LOCATION = VIDEO_RAM_LOCATION;
  var GAMEBOY_INTERNAL_MEMORY_SIZE = OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION - VIDEO_RAM_LOCATION + OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE; // Graphics Output

  var GBC_PALETTE_LOCATION = OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION + OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE;
  var GBC_PALETTE_SIZE = 0x000080;
  var BG_PRIORITY_MAP_LOCATION = GBC_PALETTE_LOCATION + GBC_PALETTE_SIZE;
  var BG_PRIORITY_MAP_SIZE = 0x005c00;
  var FRAME_LOCATION = BG_PRIORITY_MAP_LOCATION + BG_PRIORITY_MAP_SIZE;
  var FRAME_SIZE = 0x016c00;
  var BACKGROUND_MAP_LOCATION = FRAME_LOCATION + FRAME_SIZE;
  var BACKGROUND_MAP_SIZE = 0x030000;
  var TILE_DATA_LOCATION = BACKGROUND_MAP_LOCATION + BACKGROUND_MAP_SIZE;
  var TILE_DATA_SIZE = 0x024000;
  var OAM_TILES_LOCATION = TILE_DATA_LOCATION + TILE_DATA_SIZE;
  var OAM_TILES_SIZE = 0x003c00; // General Graphics Output

  var GRAPHICS_OUTPUT_LOCATION = GBC_PALETTE_LOCATION;
  var GRAPHICS_OUTPUT_SIZE = OAM_TILES_LOCATION - GBC_PALETTE_LOCATION + OAM_TILES_SIZE; // Audio Output

  var CHANNEL_1_BUFFER_LOCATION = OAM_TILES_LOCATION + OAM_TILES_SIZE;
  var CHANNEL_1_BUFFER_SIZE = 0x020000;
  var CHANNEL_2_BUFFER_LOCATION = CHANNEL_1_BUFFER_LOCATION + CHANNEL_1_BUFFER_SIZE;
  var CHANNEL_2_BUFFER_SIZE = 0x020000;
  var CHANNEL_3_BUFFER_LOCATION = CHANNEL_2_BUFFER_LOCATION + CHANNEL_2_BUFFER_SIZE;
  var CHANNEL_3_BUFFER_SIZE = 0x020000;
  var CHANNEL_4_BUFFER_LOCATION = CHANNEL_3_BUFFER_LOCATION + CHANNEL_3_BUFFER_SIZE;
  var CHANNEL_4_BUFFER_SIZE = 0x020000;
  var AUDIO_BUFFER_LOCATION = CHANNEL_4_BUFFER_LOCATION + CHANNEL_4_BUFFER_SIZE;
  var AUDIO_BUFFER_SIZE = 0x020000; // Catridge Ram

  var CARTRIDGE_RAM_LOCATION = AUDIO_BUFFER_LOCATION + AUDIO_BUFFER_SIZE;
  var CARTRIDGE_RAM_SIZE = 0x020000; // Boot ROM
  // http://gbdev.gg8.se/files/roms/bootroms/
  // Largest Boot rom is GBC, at 2.5KB

  var BOOT_ROM_LOCATION = CARTRIDGE_RAM_LOCATION + CARTRIDGE_RAM_SIZE;
  var BOOT_ROM_SIZE = 0x000a00; // Cartridge ROM

  var CARTRIDGE_ROM_LOCATION = BOOT_ROM_LOCATION + BOOT_ROM_SIZE;
  var CARTRIDGE_ROM_SIZE = 0x7e0400; // Debug Memory

  var DEBUG_GAMEBOY_MEMORY_LOCATION = CARTRIDGE_ROM_LOCATION + CARTRIDGE_ROM_SIZE;
  var DEBUG_GAMEBOY_MEMORY_SIZE = 0xffff; // Final General Size

  var WASMBOY_MEMORY_LOCATION = 0x000000;
  var WASMBOY_MEMORY_SIZE = DEBUG_GAMEBOY_MEMORY_LOCATION + DEBUG_GAMEBOY_MEMORY_SIZE + 1;
  var WASMBOY_WASM_PAGES = ceil(WASMBOY_MEMORY_SIZE / 1024 / 64) + 1;

  var Config =
  /** @class */
  function () {
    function Config() {} // Boot Rom


    Config.enableBootRom = false; // GBC Options

    Config.useGbcWhenAvailable = true; // Batch Processing

    Config.audioBatchProcessing = false;
    Config.graphicsBatchProcessing = false;
    Config.timersBatchProcessing = false; // Scanline Rendering

    Config.graphicsDisableScanlineRendering = false; // Acumulate Sound Samples

    Config.audioAccumulateSamples = false; // Tile Rednering

    Config.tileRendering = false;
    Config.tileCaching = false; // Audio Debugging

    Config.enableAudioDebugging = false;
    return Config;
  }(); // Portable Code for JS Wasm Benchmarking
  // https://github.com/AssemblyScript/assemblyscript/wiki/Writing-portable-code
  // https://github.com/AssemblyScript/assemblyscript/blob/master/std/portable/index.js


  function u8Portable(param) {
    return param & 0xff;
  }

  function u16Portable(param) {
    return param & 0xffff;
  }

  function i8Portable(param) {
    return param << 24 >> 24;
  }

  function i32Portable(param) {
    return param | 0;
  } // Set flag bit on on register F. For instance set zero flag to zero -> (7, 0)


  function setFlagBit(flagBit, flagValue) {
    var bitwiseOperand = u8Portable(1 << flagBit);

    if (flagValue > 0) {
      Cpu.registerF = Cpu.registerF | bitwiseOperand;
    } else {
      // XOR out the two ones
      bitwiseOperand = 0xff ^ bitwiseOperand;
      Cpu.registerF = Cpu.registerF & bitwiseOperand;
    }

    return Cpu.registerF;
  } // Overload the set flag bit for ease of use


  function setZeroFlag$$1(value) {
    setFlagBit(7, value);
  }

  function setSubtractFlag(value) {
    setFlagBit(6, value);
  }

  function setHalfCarryFlag(value) {
    setFlagBit(5, value);
  }

  function setCarryFlag(value) {
    setFlagBit(4, value);
  } // Getters for flags


  function getZeroFlag$$1() {
    return Cpu.registerF >> 7 & 0x01;
  }

  function getSubtractFlag() {
    return Cpu.registerF >> 6 & 0x01;
  }

  function getHalfCarryFlag() {
    return Cpu.registerF >> 5 & 0x01;
  }

  function getCarryFlag$$1() {
    return Cpu.registerF >> 4 & 0x01;
  } // Must be run before the register actually performs the add
  // amountToAdd i16, since max number can be an u8


  function checkAndSetEightBitHalfCarryFlag(value, amountToAdd) {
    if (amountToAdd >= 0) {
      // https://robdor.com/2016/08/10/gameboy-emulator-half-carry-flag/
      var result = u8Portable((value & 0x0f) + (amountToAdd & 0x0f)) & 0x10;
      setHalfCarryFlag(result !== 0x00);
    } else {
      // From: https://github.com/djhworld/gomeboycolor/blob/master/src/cpu/index.go
      // CTRL+F "subBytes(a, b byte)"
      setHalfCarryFlag((abs(amountToAdd) & 0x0f) > (value & 0x0f));
    }
  }

  function checkAndSetEightBitCarryFlag(value, amountToAdd) {
    if (amountToAdd >= 0) {
      var result = u8Portable(value + amountToAdd);
      setCarryFlag(value > result);
    } else {
      setCarryFlag(abs(amountToAdd) > value);
    }
  } // Function to handle 16 bit addition overflow, and set the carry flags accordingly
  // i32 on valueTwo to support passing signed immedaite values


  function checkAndSetSixteenBitFlagsAddOverflow(valueOne, valueTwo, useStackPointerBits) {
    // need to differentiate between HL and SP
    // HL carries are at 11 and 15, SP carries are at 3 and 7 :p
    if (useStackPointerBits) {
      // Logic from : https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
      // CTRL+F add_sp_n
      // using the stack pointer bits means we can safely assume the value is signed
      var signedValueOne = valueOne;
      var result = signedValueOne + valueTwo;
      var flagXor = signedValueOne ^ valueTwo ^ result;
      setHalfCarryFlag((flagXor & 0x10) !== 0);
      setCarryFlag((flagXor & 0x100) !== 0);
    } else {
      // Logic from: https://github.com/djhworld/gomeboycolor/blob/master/src/cpu/index.go
      // CTRL+F addWords
      // Value two is not signed
      var result = u16Portable(valueOne + valueTwo); // Check the carry flag by allowing the overflow

      setCarryFlag(result < valueOne); // To check for half carry flag (bit 15), by XOR'ing valyes, and and'ing the bit in question

      var halfCarryXor = valueOne ^ valueTwo ^ result;
      var halfCarryAnd = u16Portable(halfCarryXor & 0x1000);
      setHalfCarryFlag(halfCarryAnd !== 0x00);
    }
  } // File for all of the colors for different GB Palletes
  // https://i.imgur.com/HupBY.png
  // https://www.libretro.com/index.php/gambatte-progress-report/
  // https://tcrf.net/Notes:Game_Boy_Color_Bootstrap_ROM
  // Our default wasmboy gb colors


  var WasmBoyGBColors =
  /** @class */
  function () {
    function WasmBoyGBColors() {} //Bg


    WasmBoyGBColors.bgWhite = 0xf2f2f2;
    WasmBoyGBColors.bgLightGrey = 0xa0a0a0;
    WasmBoyGBColors.bgDarkGrey = 0x585858;
    WasmBoyGBColors.bgBlack = 0x080808; // Obj 0

    WasmBoyGBColors.obj0White = 0xf2f2f2;
    WasmBoyGBColors.obj0LightGrey = 0xa0a0a0;
    WasmBoyGBColors.obj0DarkGrey = 0x585858;
    WasmBoyGBColors.obj0Black = 0x080808; // Obj1

    WasmBoyGBColors.obj1White = 0xf2f2f2;
    WasmBoyGBColors.obj1LightGrey = 0xa0a0a0;
    WasmBoyGBColors.obj1DarkGrey = 0x585858;
    WasmBoyGBColors.obj1Black = 0x080808;
    return WasmBoyGBColors;
  }(); // Action Button: Right


  var GreenColors =
  /** @class */
  function () {
    function GreenColors() {} //Bg


    GreenColors.bgWhite = 0xffffff;
    GreenColors.bgLightGrey = 0x52ff00;
    GreenColors.bgDarkGrey = 0xff4200;
    GreenColors.bgBlack = 0x000000; // Obj 0

    GreenColors.obj0White = 0xffffff;
    GreenColors.obj0LightGrey = 0x52ff00;
    GreenColors.obj0DarkGrey = 0xff4200;
    GreenColors.obj0Black = 0x000000; // Obj1

    GreenColors.obj1White = 0xffffff;
    GreenColors.obj1LightGrey = 0x52ff00;
    GreenColors.obj1DarkGrey = 0xff4200;
    GreenColors.obj1Black = 0x000000;
    return GreenColors;
  }(); // Action Button: A + Down


  var OrangeColors =
  /** @class */
  function () {
    function OrangeColors() {} //Bg


    OrangeColors.bgWhite = 0xffffff;
    OrangeColors.bgLightGrey = 0xffff00;
    OrangeColors.bgDarkGrey = 0xff0000;
    OrangeColors.bgBlack = 0x000000; // Obj 0

    OrangeColors.obj0White = 0xffffff;
    OrangeColors.obj0LightGrey = 0xffff00;
    OrangeColors.obj0DarkGrey = 0xff0000;
    OrangeColors.obj0Black = 0x000000; // Obj1

    OrangeColors.obj1White = 0xffffff;
    OrangeColors.obj1LightGrey = 0xffff00;
    OrangeColors.obj1DarkGrey = 0xff0000;
    OrangeColors.obj1Black = 0x000000;
    return OrangeColors;
  }(); // Action Button: Up


  var BrownColors =
  /** @class */
  function () {
    function BrownColors() {} //Bg


    BrownColors.bgWhite = 0xffffff;
    BrownColors.bgLightGrey = 0xffad63;
    BrownColors.bgDarkGrey = 0x843100;
    BrownColors.bgBlack = 0x000000; // Obj 0

    BrownColors.obj0White = 0xffffff;
    BrownColors.obj0LightGrey = 0xffad63;
    BrownColors.obj0DarkGrey = 0x843100;
    BrownColors.obj0Black = 0x000000; // Obj1

    BrownColors.obj1White = 0xffffff;
    BrownColors.obj1LightGrey = 0xffad63;
    BrownColors.obj1DarkGrey = 0x843100;
    BrownColors.obj1Black = 0x000000;
    return BrownColors;
  }(); // Action Button: B + Right


  var InvertedColors =
  /** @class */
  function () {
    function InvertedColors() {} //Bg


    InvertedColors.bgWhite = 0x000000;
    InvertedColors.bgLightGrey = 0x008484;
    InvertedColors.bgDarkGrey = 0xffde00;
    InvertedColors.bgBlack = 0xffffff; // Obj 0

    InvertedColors.obj0White = 0x000000;
    InvertedColors.obj0LightGrey = 0x008484;
    InvertedColors.obj0DarkGrey = 0xffde00;
    InvertedColors.obj0Black = 0xffffff; // Obj1

    InvertedColors.obj1White = 0x000000;
    InvertedColors.obj1LightGrey = 0x008484;
    InvertedColors.obj1DarkGrey = 0xffde00;
    InvertedColors.obj1Black = 0xffffff;
    return InvertedColors;
  }(); // Action Button: B + Left


  var GrayscaleColors =
  /** @class */
  function () {
    function GrayscaleColors() {} //Bg


    GrayscaleColors.bgWhite = 0xffffff;
    GrayscaleColors.bgLightGrey = 0xa5a5a5;
    GrayscaleColors.bgDarkGrey = 0x525252;
    GrayscaleColors.bgBlack = 0x000000; // Obj 0

    GrayscaleColors.obj0White = 0xffffff;
    GrayscaleColors.obj0LightGrey = 0xa5a5a5;
    GrayscaleColors.obj0DarkGrey = 0x525252;
    GrayscaleColors.obj0Black = 0x000000; // Obj1

    GrayscaleColors.obj1White = 0xffffff;
    GrayscaleColors.obj1LightGrey = 0xa5a5a5;
    GrayscaleColors.obj1DarkGrey = 0x525252;
    GrayscaleColors.obj1Black = 0x000000;
    return GrayscaleColors;
  }(); // Action Button: Down


  var PastelMixColors =
  /** @class */
  function () {
    function PastelMixColors() {} //Bg


    PastelMixColors.bgWhite = 0xffffa5;
    PastelMixColors.bgLightGrey = 0xff9494;
    PastelMixColors.bgDarkGrey = 0x9494ff;
    PastelMixColors.bgBlack = 0x000000; // Obj 0

    PastelMixColors.obj0White = 0xffffa5;
    PastelMixColors.obj0LightGrey = 0xff9494;
    PastelMixColors.obj0DarkGrey = 0x9494ff;
    PastelMixColors.obj0Black = 0x000000; // Obj1

    PastelMixColors.obj1White = 0xffffa5;
    PastelMixColors.obj1LightGrey = 0xff9494;
    PastelMixColors.obj1DarkGrey = 0x9494ff;
    PastelMixColors.obj1Black = 0x000000;
    return PastelMixColors;
  }(); // Action Button: B + Up


  var DarkBrownColors =
  /** @class */
  function () {
    function DarkBrownColors() {} //Bg


    DarkBrownColors.bgWhite = 0xffe6c5;
    DarkBrownColors.bgLightGrey = 0xce9c84;
    DarkBrownColors.bgDarkGrey = 0x846b29;
    DarkBrownColors.bgBlack = 0x5a3108; // Obj 0

    DarkBrownColors.obj0White = 0xffffff;
    DarkBrownColors.obj0LightGrey = 0xffad63;
    DarkBrownColors.obj0DarkGrey = 0x843100;
    DarkBrownColors.obj0Black = 0x000000; // Obj1

    DarkBrownColors.obj1White = 0xffffff;
    DarkBrownColors.obj1LightGrey = 0xffad63;
    DarkBrownColors.obj1DarkGrey = 0x843100;
    DarkBrownColors.obj1Black = 0x000000;
    return DarkBrownColors;
  }(); // Action Button: A + Right


  var DarkGreenColors =
  /** @class */
  function () {
    function DarkGreenColors() {} //Bg


    DarkGreenColors.bgWhite = 0xffffff;
    DarkGreenColors.bgLightGrey = 0x7bff31;
    DarkGreenColors.bgDarkGrey = 0x0063c5;
    DarkGreenColors.bgBlack = 0x000000; // Obj 0

    DarkGreenColors.obj0White = 0xffffff;
    DarkGreenColors.obj0LightGrey = 0xff8484;
    DarkGreenColors.obj0DarkGrey = 0x943a3a;
    DarkGreenColors.obj0Black = 0x000000; // Obj1

    DarkGreenColors.obj1White = 0xffffff;
    DarkGreenColors.obj1LightGrey = 0xff8484;
    DarkGreenColors.obj1DarkGrey = 0x943a3a;
    DarkGreenColors.obj1Black = 0x000000;
    return DarkGreenColors;
  }(); // Action Button: A + Left


  var DarkBlueColors =
  /** @class */
  function () {
    function DarkBlueColors() {} //Bg


    DarkBlueColors.bgWhite = 0xffffff;
    DarkBlueColors.bgLightGrey = 0x8c8cde;
    DarkBlueColors.bgDarkGrey = 0x52528c;
    DarkBlueColors.bgBlack = 0x000000; // Obj 0

    DarkBlueColors.obj0White = 0xffffff;
    DarkBlueColors.obj0LightGrey = 0xff8484;
    DarkBlueColors.obj0DarkGrey = 0x943a3a;
    DarkBlueColors.obj0Black = 0x000000; // Obj1

    DarkBlueColors.obj1White = 0xffffff;
    DarkBlueColors.obj1LightGrey = 0xffad63;
    DarkBlueColors.obj1DarkGrey = 0x843100;
    DarkBlueColors.obj1Black = 0x000000;
    return DarkBlueColors;
  }(); // Action Button: A + Up


  var RedColors =
  /** @class */
  function () {
    function RedColors() {} //Bg


    RedColors.bgWhite = 0xffffff;
    RedColors.bgLightGrey = 0xff8484;
    RedColors.bgDarkGrey = 0x943a3a;
    RedColors.bgBlack = 0x000000; // Obj 0

    RedColors.obj0White = 0xffffff;
    RedColors.obj0LightGrey = 0x7bff31;
    RedColors.obj0DarkGrey = 0x008400;
    RedColors.obj0Black = 0x000000; // Obj1

    RedColors.obj1White = 0xffffff;
    RedColors.obj1LightGrey = 0x63a5ff;
    RedColors.obj1DarkGrey = 0x0000ff;
    RedColors.obj1Black = 0x000000;
    return RedColors;
  }(); // Action Button: Left


  var BlueColors =
  /** @class */
  function () {
    function BlueColors() {} //Bg


    BlueColors.bgWhite = 0xffffff;
    BlueColors.bgLightGrey = 0x63a5ff;
    BlueColors.bgDarkGrey = 0x0000ff;
    BlueColors.bgBlack = 0x000000; // Obj 0

    BlueColors.obj0White = 0xffffff;
    BlueColors.obj0LightGrey = 0xff8484;
    BlueColors.obj0DarkGrey = 0x943a3a;
    BlueColors.obj0Black = 0x000000; // Obj1

    BlueColors.obj1White = 0xffffff;
    BlueColors.obj1LightGrey = 0x7bff31;
    BlueColors.obj1DarkGrey = 0x008400;
    BlueColors.obj1Black = 0x000000;
    return BlueColors;
  }(); // Action Button: B + Down


  var YellowColors =
  /** @class */
  function () {
    function YellowColors() {} //Bg


    YellowColors.bgWhite = 0xffffff;
    YellowColors.bgLightGrey = 0xffff00;
    YellowColors.bgDarkGrey = 0x7b4a00;
    YellowColors.bgBlack = 0x000000; // Obj 0

    YellowColors.obj0White = 0xffffff;
    YellowColors.obj0LightGrey = 0x63a5ff;
    YellowColors.obj0DarkGrey = 0x0000ff;
    YellowColors.obj0Black = 0x000000; // Obj1

    YellowColors.obj1White = 0xffffff;
    YellowColors.obj1LightGrey = 0x7bff31;
    YellowColors.obj1DarkGrey = 0x008400;
    YellowColors.obj1Black = 0x000000;
    return YellowColors;
  }(); // Assigned Color Palettes
  // Alleyway


  var Table00Entry08Colors =
  /** @class */
  function () {
    function Table00Entry08Colors() {} //Bg


    Table00Entry08Colors.bgWhite = 0xa59cff;
    Table00Entry08Colors.bgLightGrey = 0xffff00;
    Table00Entry08Colors.bgDarkGrey = 0x006300;
    Table00Entry08Colors.bgBlack = 0x000000; // Obj 0

    Table00Entry08Colors.obj0White = 0xa59cff;
    Table00Entry08Colors.obj0LightGrey = 0xffff00;
    Table00Entry08Colors.obj0DarkGrey = 0x006300;
    Table00Entry08Colors.obj0Black = 0x000000; // Obj1

    Table00Entry08Colors.obj1White = 0xa59cff;
    Table00Entry08Colors.obj1LightGrey = 0xffff00;
    Table00Entry08Colors.obj1DarkGrey = 0x006300;
    Table00Entry08Colors.obj1Black = 0x000000;
    return Table00Entry08Colors;
  }(); // Pokemon Blue


  var Table01Entry0BColors =
  /** @class */
  function () {
    function Table01Entry0BColors() {} //Bg


    Table01Entry0BColors.bgWhite = 0xffffff;
    Table01Entry0BColors.bgLightGrey = 0x63a5ff;
    Table01Entry0BColors.bgDarkGrey = 0x0000ff;
    Table01Entry0BColors.bgBlack = 0x000000; // Obj 0

    Table01Entry0BColors.obj0White = 0xffffff;
    Table01Entry0BColors.obj0LightGrey = 0xff8484;
    Table01Entry0BColors.obj0DarkGrey = 0x943a3a;
    Table01Entry0BColors.obj0Black = 0x000000; // Obj1

    Table01Entry0BColors.obj1White = 0xffffff;
    Table01Entry0BColors.obj1LightGrey = 0x63a5ff;
    Table01Entry0BColors.obj1DarkGrey = 0x0000ff;
    Table01Entry0BColors.obj1Black = 0x000000;
    return Table01Entry0BColors;
  }(); // Pokemon Red


  var Table01Entry10Colors =
  /** @class */
  function () {
    function Table01Entry10Colors() {} //Bg


    Table01Entry10Colors.bgWhite = 0xffffff;
    Table01Entry10Colors.bgLightGrey = 0xff8484;
    Table01Entry10Colors.bgDarkGrey = 0x943a3a;
    Table01Entry10Colors.bgBlack = 0x000000; // Obj 0

    Table01Entry10Colors.obj0White = 0xffffff;
    Table01Entry10Colors.obj0LightGrey = 0x7bff31;
    Table01Entry10Colors.obj0DarkGrey = 0x008400;
    Table01Entry10Colors.obj0Black = 0x000000; // Obj1

    Table01Entry10Colors.obj1White = 0xffffff;
    Table01Entry10Colors.obj1LightGrey = 0xff8484;
    Table01Entry10Colors.obj1DarkGrey = 0x943a3a;
    Table01Entry10Colors.obj1Black = 0x000000;
    return Table01Entry10Colors;
  }(); // Super Mario Land


  var Table03Entry0AColors =
  /** @class */
  function () {
    function Table03Entry0AColors() {} //Bg


    Table03Entry0AColors.bgWhite = 0xb5b5ff;
    Table03Entry0AColors.bgLightGrey = 0xffff94;
    Table03Entry0AColors.bgDarkGrey = 0xad5a42;
    Table03Entry0AColors.bgBlack = 0x000000; // Obj 0

    Table03Entry0AColors.obj0White = 0x000000;
    Table03Entry0AColors.obj0LightGrey = 0xffffff;
    Table03Entry0AColors.obj0DarkGrey = 0xff8484;
    Table03Entry0AColors.obj0Black = 0x943a3a; // Obj1

    Table03Entry0AColors.obj1White = 0x000000;
    Table03Entry0AColors.obj1LightGrey = 0xffffff;
    Table03Entry0AColors.obj1DarkGrey = 0xff8484;
    Table03Entry0AColors.obj1Black = 0x943a3a;
    return Table03Entry0AColors;
  }(); // Super Mario Land 3 - WarioLand


  var Table05Entry00Colors =
  /** @class */
  function () {
    function Table05Entry00Colors() {} //Bg


    Table05Entry00Colors.bgWhite = 0xffffff;
    Table05Entry00Colors.bgLightGrey = 0xadad84;
    Table05Entry00Colors.bgDarkGrey = 0x42737b;
    Table05Entry00Colors.bgBlack = 0x000000; // Obj 0

    Table05Entry00Colors.obj0White = 0xffffff;
    Table05Entry00Colors.obj0LightGrey = 0xff7300;
    Table05Entry00Colors.obj0DarkGrey = 0x944200;
    Table05Entry00Colors.obj0Black = 0x000000; // Obj1

    Table05Entry00Colors.obj1White = 0xffffff;
    Table05Entry00Colors.obj1LightGrey = 0x5abdff;
    Table05Entry00Colors.obj1DarkGrey = 0xff0000;
    Table05Entry00Colors.obj1Black = 0x0000ff;
    return Table05Entry00Colors;
  }(); // Donkey Kong


  var Table05Entry01Colors =
  /** @class */
  function () {
    function Table05Entry01Colors() {} //Bg


    Table05Entry01Colors.bgWhite = 0xffff9c;
    Table05Entry01Colors.bgLightGrey = 0x94b5ff;
    Table05Entry01Colors.bgDarkGrey = 0x639473;
    Table05Entry01Colors.bgBlack = 0x003a3a; // Obj 0

    Table05Entry01Colors.obj0White = 0xffc542;
    Table05Entry01Colors.obj0LightGrey = 0xffd600;
    Table05Entry01Colors.obj0DarkGrey = 0x943a00;
    Table05Entry01Colors.obj0Black = 0x4a0000; // Obj1

    Table05Entry01Colors.obj1White = 0xffffff;
    Table05Entry01Colors.obj1LightGrey = 0xff8484;
    Table05Entry01Colors.obj1DarkGrey = 0x943a3a;
    Table05Entry01Colors.obj1Black = 0x000000;
    return Table05Entry01Colors;
  }(); // Tennis


  var Table05Entry02Colors =
  /** @class */
  function () {
    function Table05Entry02Colors() {} //Bg


    Table05Entry02Colors.bgWhite = 0x6bff00;
    Table05Entry02Colors.bgLightGrey = 0xffffff;
    Table05Entry02Colors.bgDarkGrey = 0xff524a;
    Table05Entry02Colors.bgBlack = 0x000000; // Obj 0

    Table05Entry02Colors.obj0White = 0xffffff;
    Table05Entry02Colors.obj0LightGrey = 0xffffff;
    Table05Entry02Colors.obj0DarkGrey = 0x63a5ff;
    Table05Entry02Colors.obj0Black = 0x0000ff; // Obj1

    Table05Entry02Colors.obj1White = 0xffffff;
    Table05Entry02Colors.obj1LightGrey = 0xffad63;
    Table05Entry02Colors.obj1DarkGrey = 0x843100;
    Table05Entry02Colors.obj1Black = 0x000000;
    return Table05Entry02Colors;
  }(); // Kirby's Dream Land


  var Table05Entry08Colors =
  /** @class */
  function () {
    function Table05Entry08Colors() {} //Bg


    Table05Entry08Colors.bgWhite = 0xa59cff;
    Table05Entry08Colors.bgLightGrey = 0xffff00;
    Table05Entry08Colors.bgDarkGrey = 0x006300;
    Table05Entry08Colors.bgBlack = 0x000000; // Obj 0

    Table05Entry08Colors.obj0White = 0xff6352;
    Table05Entry08Colors.obj0LightGrey = 0xd60000;
    Table05Entry08Colors.obj0DarkGrey = 0x630000;
    Table05Entry08Colors.obj0Black = 0x000000; // Obj1

    Table05Entry08Colors.obj1White = 0x0000ff;
    Table05Entry08Colors.obj1LightGrey = 0xffffff;
    Table05Entry08Colors.obj1DarkGrey = 0xffff7b;
    Table05Entry08Colors.obj1Black = 0x0084ff;
    return Table05Entry08Colors;
  }(); // Super Mario Land 2 BAYYYBEEE


  var Table05Entry09Colors =
  /** @class */
  function () {
    function Table05Entry09Colors() {} //Bg


    Table05Entry09Colors.bgWhite = 0xffffce;
    Table05Entry09Colors.bgLightGrey = 0x63efef;
    Table05Entry09Colors.bgDarkGrey = 0x9c8431;
    Table05Entry09Colors.bgBlack = 0x5a5a5a; // Obj 0

    Table05Entry09Colors.obj0White = 0xffffff;
    Table05Entry09Colors.obj0LightGrey = 0xff7300;
    Table05Entry09Colors.obj0DarkGrey = 0x944200;
    Table05Entry09Colors.obj0Black = 0x000000; // Obj1

    Table05Entry09Colors.obj1White = 0xffffff;
    Table05Entry09Colors.obj1LightGrey = 0x63a5ff;
    Table05Entry09Colors.obj1DarkGrey = 0x0000ff;
    Table05Entry09Colors.obj1Black = 0x000000;
    return Table05Entry09Colors;
  }(); // Link's Awakening


  var Table05Entry11Colors =
  /** @class */
  function () {
    function Table05Entry11Colors() {} // Bg


    Table05Entry11Colors.bgWhite = 0xffffff;
    Table05Entry11Colors.bgLightGrey = 0xff8484;
    Table05Entry11Colors.bgDarkGrey = 0x943a3a;
    Table05Entry11Colors.bgBlack = 0x000000; // Obj 0

    Table05Entry11Colors.obj0White = 0xffffff;
    Table05Entry11Colors.obj0LightGrey = 0x00ff00;
    Table05Entry11Colors.obj0DarkGrey = 0x318400;
    Table05Entry11Colors.obj0Black = 0x004a00; // Obj1

    Table05Entry11Colors.obj1White = 0xffffff;
    Table05Entry11Colors.obj1LightGrey = 0x63a5ff;
    Table05Entry11Colors.obj1DarkGrey = 0x0000ff;
    Table05Entry11Colors.obj1Black = 0x000000;
    return Table05Entry11Colors;
  }(); // Metroid 2


  var Table05Entry14Colors =
  /** @class */
  function () {
    function Table05Entry14Colors() {} //Bg


    Table05Entry14Colors.bgWhite = 0xffffff;
    Table05Entry14Colors.bgLightGrey = 0x63a5ff;
    Table05Entry14Colors.bgDarkGrey = 0x0000ff;
    Table05Entry14Colors.bgBlack = 0x000000; // Obj 0

    Table05Entry14Colors.obj0White = 0xffff00;
    Table05Entry14Colors.obj0LightGrey = 0xff0000;
    Table05Entry14Colors.obj0DarkGrey = 0x630000;
    Table05Entry14Colors.obj0Black = 0x000000; // Obj1

    Table05Entry14Colors.obj1White = 0xffffff;
    Table05Entry14Colors.obj1LightGrey = 0x7bff31;
    Table05Entry14Colors.obj1DarkGrey = 0x008400;
    Table05Entry14Colors.obj1Black = 0x000000;
    return Table05Entry14Colors;
  }(); // WarioLand 2


  var Table05Entry15Colors =
  /** @class */
  function () {
    function Table05Entry15Colors() {} //Bg


    Table05Entry15Colors.bgWhite = 0xffffff;
    Table05Entry15Colors.bgLightGrey = 0xadad84;
    Table05Entry15Colors.bgDarkGrey = 0x42737b;
    Table05Entry15Colors.bgBlack = 0x000000; // Obj 0

    Table05Entry15Colors.obj0White = 0xffffff;
    Table05Entry15Colors.obj0LightGrey = 0xffad63;
    Table05Entry15Colors.obj0DarkGrey = 0xffad63;
    Table05Entry15Colors.obj0Black = 0x000000; // Obj1

    Table05Entry15Colors.obj1White = 0xffffff;
    Table05Entry15Colors.obj1LightGrey = 0x63a5ff;
    Table05Entry15Colors.obj1DarkGrey = 0x0000ff;
    Table05Entry15Colors.obj1Black = 0x000000;
    return Table05Entry15Colors;
  }(); // File for all of the logic of setting gameboy color plaettes
  // Current / exported color


  var Colors =
  /** @class */
  function () {
    function Colors() {} //Bg


    Colors.bgWhite = WasmBoyGBColors.bgWhite;
    Colors.bgLightGrey = WasmBoyGBColors.bgLightGrey;
    Colors.bgDarkGrey = WasmBoyGBColors.bgDarkGrey;
    Colors.bgBlack = WasmBoyGBColors.bgBlack; // Obj 0

    Colors.obj0White = WasmBoyGBColors.obj0White;
    Colors.obj0LightGrey = WasmBoyGBColors.obj0LightGrey;
    Colors.obj0DarkGrey = WasmBoyGBColors.obj0DarkGrey;
    Colors.obj0Black = WasmBoyGBColors.obj0Black; // Obj1

    Colors.obj1White = WasmBoyGBColors.obj1White;
    Colors.obj1LightGrey = WasmBoyGBColors.obj1LightGrey;
    Colors.obj1DarkGrey = WasmBoyGBColors.obj1DarkGrey;
    Colors.obj1Black = WasmBoyGBColors.obj1Black;
    return Colors;
  }(); // Inlined because closure compiler inlines


  function initializeColors() {
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
    } // Do some automatic color palette swapping if we have a loaded ROM


    var titleChecksum = 0x00;

    for (var i = 0x0134; i <= 0x0143; i++) {
      titleChecksum += eightBitLoadFromGBMemory(i);
    } // Set the colorization for the game automatically if assigned
    // https://tcrf.net/Notes:Game_Boy_Color_Bootstrap_ROM


    var hash = titleChecksum & 0xff;
    setHashColorizationPalette(hash);
  }

  function getRedFromHexColor(color) {
    return (color & 0xff0000) >> 16;
  }

  function getGreenFromHexColor(color) {
    return (color & 0x00ff00) >> 8;
  }

  function getBlueFromHexColor(color) {
    return color & 0x0000ff;
  } // Function to set the colorization
  // By manually pressing buttons


  function setManualColorizationPalette(colorizationId) {
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
  } // Function to set the colorization
  // By checksum of the title
  // https://forums.nesdev.com/viewtopic.php?f=20&t=10226
  // TODO: torch2424 need to find how to get the "disambiguation"
  // Inlined because closure compiler inlines


  function setHashColorizationPalette(hash) {
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
  } // Grouped registers
  // possible overload these later to performace actions
  // AF, BC, DE, HL


  function concatenateBytes(highByte, lowByte) {
    //https://stackoverflow.com/questions/38298412/convert-two-bytes-into-signed-16-bit-integer-in-javascript
    return (highByte & 0xff) << 8 | lowByte & 0xff;
  }

  function splitHighByte(groupedByte) {
    return (groupedByte & 0xff00) >> 8;
  }

  function splitLowByte(groupedByte) {
    return groupedByte & 0x00ff;
  }

  function rotateByteLeft(value) {
    // Rotate left
    // https://stackoverflow.com/questions/19204750/how-do-i-perform-a-circular-rotation-of-a-byte
    // 4-bit example:
    // 1010 -> 0100 | 0001
    return u8Portable(value << 1 | value >> 7);
  }

  function rotateByteLeftThroughCarry(value) {
    // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
    // Through carry meaning, instead of raotating the bit that gets dropped off, but the carry there instead
    return u8Portable(value << 1 | getCarryFlag$$1());
  }

  function rotateByteRight(value) {
    // Rotate right
    // 4-bit example:
    // 1010 -> 0101 | 0000
    return u8Portable(value >> 1 | value << 7);
  }

  function rotateByteRightThroughCarry(value) {
    // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
    // Through carry meaning, instead of raotating the bit that gets dropped off, put the carry there instead
    return u8Portable(value >> 1 | getCarryFlag$$1() << 7);
  }

  function setBitOnByte(bitPosition, byte) {
    return byte | 0x01 << bitPosition;
  }

  function resetBitOnByte(bitPosition, byte) {
    return byte & ~(0x01 << bitPosition);
  }

  function checkBitOnByte(bitPosition, byte) {
    // Perforamnce improvements
    // https://github.com/AssemblyScript/assemblyscript/issues/40
    return (byte & 1 << bitPosition) != 0;
  } // Class for GBC Color palletes
  // http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index


  var Palette =
  /** @class */
  function () {
    function Palette() {}

    Palette.memoryLocationBackgroundPaletteIndex = 0xff68;
    Palette.memoryLocationBackgroundPaletteData = 0xff69;
    Palette.memoryLocationSpritePaletteIndex = 0xff6a;
    Palette.memoryLocationSpritePaletteData = 0xff6b; // Palettes

    Palette.memoryLocationBackgroundPalette = 0xff47;
    Palette.memoryLocationSpritePaletteOne = 0xff48;
    Palette.memoryLocationSpritePaletteTwo = 0xff49;
    return Palette;
  }(); // Inlined because closure compiler inlines


  function initializePalette() {
    if (Cpu.GBCEnabled) {
      // GBC Palettes
      eightBitStoreIntoGBMemory(0xff68, 0xc0);
      eightBitStoreIntoGBMemory(0xff69, 0xff);
      eightBitStoreIntoGBMemory(0xff6a, 0xc1);
      eightBitStoreIntoGBMemory(0xff6b, 0x0d);
    } else {
      // GBC Palettes
      eightBitStoreIntoGBMemory(0xff68, 0xff);
      eightBitStoreIntoGBMemory(0xff69, 0xff);
      eightBitStoreIntoGBMemory(0xff6a, 0xff);
      eightBitStoreIntoGBMemory(0xff6b, 0xff);
    } // Override some values if using the bootrom


    if (Cpu.BootROMEnabled && Cpu.GBCEnabled) {
      // GBC Palettes
      eightBitStoreIntoGBMemory(0xff69, 0x20);
      eightBitStoreIntoGBMemory(0xff6b, 0x8a);
    }
  } // Simple get pallete color or monochrome GB
  // shouldRepresentColorByColorId is good for debugging tile data for GBC games that don't have
  // monochromePalettes
  // Inlined because closure compiler inlines


  function getMonochromeColorFromPalette(colorId, paletteMemoryLocation, shouldRepresentColorByColorId) {
    if (shouldRepresentColorByColorId === void 0) {
      shouldRepresentColorByColorId = false;
    } // Shift our paletteByte, 2 times for each color ID
    // And off any extra bytes
    // Return our Color (00 - white, 01 - light grey, 10 Dark grey, or 11 - Black)


    var color = colorId;

    if (!shouldRepresentColorByColorId) {
      color = eightBitLoadFromGBMemory(paletteMemoryLocation) >> (colorId << 1) & 0x03;
    } // Since our max is 254, and max is 3.
    // monochrome color palette is modified from bgb
    // TODO: Make these colors into a constant


    var rgbColor = 242;

    switch (color) {
      case 0:
        break;

      case 1:
        rgbColor = 160;
        break;

      case 2:
        rgbColor = 88;
        break;

      case 3:
        rgbColor = 8;
        break;
    }

    return rgbColor;
  } // Function to returns the Colorized color for a GB games


  function getColorizedGbHexColorFromPalette(colorId, paletteMemoryLocation) {
    // Shift our paletteByte, 2 times for each color ID
    // And off any extra bytes
    // Return our Color (00 - white, 01 - light grey, 10 Dark grey, or 11 - Black)
    var color = eightBitLoadFromGBMemory(paletteMemoryLocation) >> colorId * 2 & 0x03; // Check which palette we got, to apply the right color layer

    var hexColor = 0;

    if (paletteMemoryLocation === Palette.memoryLocationSpritePaletteOne) {
      hexColor = Colors.obj0White;

      switch (color) {
        case 0:
          break;

        case 1:
          hexColor = Colors.obj0LightGrey;
          break;

        case 2:
          hexColor = Colors.obj0DarkGrey;
          break;

        case 3:
          hexColor = Colors.obj0Black;
          break;
      }
    } else if (paletteMemoryLocation === Palette.memoryLocationSpritePaletteTwo) {
      hexColor = Colors.obj1White;

      switch (color) {
        case 0:
          break;

        case 1:
          hexColor = Colors.obj1LightGrey;
          break;

        case 2:
          hexColor = Colors.obj1DarkGrey;
          break;

        case 3:
          hexColor = Colors.obj1Black;
          break;
      }
    } else {
      hexColor = Colors.bgWhite;

      switch (color) {
        case 0:
          break;

        case 1:
          hexColor = Colors.bgLightGrey;
          break;

        case 2:
          hexColor = Colors.bgDarkGrey;
          break;

        case 3:
          hexColor = Colors.bgBlack;
          break;
      }
    }

    return hexColor;
  } // Inlined because closure compiler inlines


  function writeColorPaletteToMemory(offset, value) {
    // FF68
    //  Bit 0-5   Index (00-3F)
    var memoryLocationSpritePaletteData = Palette.memoryLocationSpritePaletteData;

    if (offset === Palette.memoryLocationBackgroundPaletteData || offset === memoryLocationSpritePaletteData) {
      // Get the palette index
      var paletteIndex = eightBitLoadFromGBMemory(offset - 1); // Clear the 6th bit, as it does nothing

      paletteIndex = resetBitOnByte(6, paletteIndex); // Check if we are changing the sprite pallete data

      var isSprite = offset === memoryLocationSpritePaletteData;
      storePaletteByteInWasmMemory(paletteIndex, value, isSprite);
      incrementPaletteIndexIfSet(paletteIndex, offset - 1);
    }
  } // Functions to Handle Write to pallete data registers
  // http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
  // Function to handle incrementing the pallete index if required
  // Inlined because closure compiler inlines


  function incrementPaletteIndexIfSet(paletteIndex, offset) {
    // Check ther auto increment box
    if (checkBitOnByte(7, paletteIndex)) {
      // Increment the index, and return the value before the increment
      // Ensure we don't ouverflow our auto increment bit
      paletteIndex += 1;
      paletteIndex = setBitOnByte(7, paletteIndex);
      eightBitStoreIntoGBMemory(offset, paletteIndex);
    }
  } // FF68
  // Bit 0-5   Index (00-3F)
  // Bit 7     Auto Increment  (0=Disabled, 1=Increment after Writing)
  // Index is 00-0x3F because the means 0 - 63 (64),
  // and apparently there are 8 bytes per pallete to describe Color 0-3 (4 colors),
  // and 0-7 (8 palltetes). Therefore, 64!


  function getRgbColorFromPalette(paletteId, colorId, isSprite) {
    // Each Pallete takes 8 bytes, so multiply by 8 to get the pallete
    // And Each color takes 2 bytes, therefore, multiple by 2 for the correct color bytes in the palette
    var paletteIndex = paletteId * 8 + colorId * 2; // Load the Color that is seperated into two bytes

    var paletteHighByte = loadPaletteByteFromWasmMemory(paletteIndex + 1, isSprite);
    var paletteLowByte = loadPaletteByteFromWasmMemory(paletteIndex, isSprite); // Return the concatenated color byte

    return concatenateBytes(paletteHighByte, paletteLowByte);
  } // Function to return the color from a passed 16 bit color pallette


  function getColorComponentFromRgb(colorId, colorRgb) {
    // Get our bitmask for the color ID
    // bit mask tested good :)
    colorId *= 5;
    var bitMask = 0x1f << colorId;
    var colorValue = (colorRgb & bitMask) >> colorId; // Goal is to reach 254 for each color, so 255 / 31 (0x1F) ~8 TODO: Make exact
    // Want 5 bits for each

    return colorValue * 8;
  } // Function to load a byte from our Gbc Palette memory


  function loadPaletteByteFromWasmMemory(paletteIndexByte, isSprite) {
    // Clear the top two bits to just get the bottom palette Index
    var paletteIndex = paletteIndexByte & 0x3f; // Move over the palette index to not overlap the background has 0x3F, so Zero for Sprites is 0x40)

    if (isSprite) {
      paletteIndex += 0x40;
    }

    return load(GBC_PALETTE_LOCATION + paletteIndex);
  } // Function to store a byte to our Gbc Palette memory
  // Inlined because closure compiler inlines


  function storePaletteByteInWasmMemory(paletteIndexByte, value, isSprite) {
    // Clear the top two bits to just get the bottom palette Index
    var paletteIndex = paletteIndexByte & 0x3f; // Move over the palette index to not overlap the background (has 0x3F, so Zero for Sprites is 0x40)

    if (isSprite) {
      paletteIndex += 0x40;
    }

    store(GBC_PALETTE_LOCATION + paletteIndex, value);
  } // https://github.com/torch2424/wasmBoy/issues/51


  function addPriorityforPixel(x, y, colorId, hasGbcBgPriority) {
    if (colorId === void 0) {
      colorId = 0;
    }

    if (hasGbcBgPriority === void 0) {
      hasGbcBgPriority = false;
    }

    var bgPriorityByte = colorId & 0x03;

    if (hasGbcBgPriority) {
      bgPriorityByte = setBitOnByte(2, bgPriorityByte);
    }

    store(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y), bgPriorityByte);
  } // Inlined because closure compiler inlines


  function getPriorityforPixel(x, y) {
    return load(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y));
  } // Inlined because closure compiler inlines


  function clearPriorityMap() {
    for (var y = 0; y < 144; ++y) {
      for (var x = 0; x < 160; ++x) {
        store(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y), 0);
      }
    }
  } // Inlined because closure compiler inlines


  function getPixelStart(x, y) {
    // Get the pixel number
    return y * 160 + x;
  } // Functions for performance hacks, and debugging tiles


  var TileCache =
  /** @class */
  function () {
    function TileCache() {}

    TileCache.tileId = -1;
    TileCache.horizontalFlip = false;
    TileCache.nextXIndexToPerformCacheCheck = -1;
    return TileCache;
  }(); // Inlined because closure compiler inlines


  function resetTileCache() {
    TileCache.tileId = -1;
    TileCache.nextXIndexToPerformCacheCheck = -1;
  }

  function drawPixelsFromLineOfTile(tileId, tileDataMemoryLocation, vramBankId, tileLineXStart, tileLineXEnd, tileLineY, outputLineX, outputLineY, outputWidth, wasmMemoryStart, shouldRepresentMonochromeColorByColorId, paletteLocation, bgMapAttributes, spriteAttributes) {
    // Get our number of pixels drawn
    var pixelsDrawn = 0; // Get our tile data address

    var tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileId); // Get the bytes for our tile

    var byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + tileLineY * 2, vramBankId);
    var byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + tileLineY * 2 + 1, vramBankId); // Loop through our X values to draw

    for (var x = tileLineXStart; x <= tileLineXEnd; ++x) {
      // First find where we are going to do our final output x
      // And don't allow any width overflow
      var iteratedOutputX = outputLineX + (x - tileLineXStart);

      if (iteratedOutputX < outputWidth) {
        // However, We need to reverse our byte (if not horizontally flipped),
        // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
        // Therefore, is pixelX was 2, then really is need to be 5
        // So 2 - 7 = -5, * 1 = 5
        // Or to simplify, 7 - 2 = 5 haha!
        var pixelXInTile = x;

        if (bgMapAttributes < 0 || !checkBitOnByte(5, bgMapAttributes)) {
          pixelXInTile = 7 - pixelXInTile;
        } // Get our pallete colors for the tile


        var paletteColorId = 0;

        if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
          // Byte one represents the second bit in our color id, so bit shift
          paletteColorId += 1;
          paletteColorId = paletteColorId << 1;
        }

        if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
          paletteColorId += 1;
        } // Get the pallete


        var red = 0;
        var green = 0;
        var blue = 0; // Check if we should draw color or not

        if (Cpu.GBCEnabled && (bgMapAttributes >= 0 || spriteAttributes >= 0)) {
          // Draw C O L O R
          var isSprite = spriteAttributes >= 0; // Call the helper function to grab the correct color from the palette
          // Get the palette index byte

          var bgPalette = bgMapAttributes & 0x07;

          if (isSprite) {
            bgPalette = spriteAttributes & 0x07;
          }

          var rgbColorPalette = getRgbColorFromPalette(bgPalette, paletteColorId, isSprite); // Split off into red green and blue

          red = getColorComponentFromRgb(0, rgbColorPalette);
          green = getColorComponentFromRgb(1, rgbColorPalette);
          blue = getColorComponentFromRgb(2, rgbColorPalette);
        } else {
          // Draw Monochrome
          // Get the default palette if none
          if (paletteLocation <= 0) {
            paletteLocation = Graphics.memoryLocationBackgroundPalette;
          }

          if (shouldRepresentMonochromeColorByColorId) {
            var monochromeColor = getMonochromeColorFromPalette(paletteColorId, paletteLocation, shouldRepresentMonochromeColorByColorId);
            red = monochromeColor;
            green = monochromeColor;
            blue = monochromeColor;
          } else {
            var hexColor = getColorizedGbHexColorFromPalette(paletteColorId, paletteLocation);
            red = getRedFromHexColor(hexColor);
            green = getGreenFromHexColor(hexColor);
            blue = getBlueFromHexColor(hexColor);
          }
        } // Finally Lets place a pixel in memory
        // Find where our tile line would start


        var pixelStart = getTilePixelStart(iteratedOutputX, outputLineY, outputWidth); // Can not optimize wasmMemoryStart any further, as this is in a loop.

        store(wasmMemoryStart + pixelStart + 0, red);
        store(wasmMemoryStart + pixelStart + 1, green);
        store(wasmMemoryStart + pixelStart + 2, blue);
        var gbcBgPriority = false;

        if (bgMapAttributes >= 0) {
          gbcBgPriority = checkBitOnByte(7, bgMapAttributes);
        } // Lastly, add the pixel to our background priority map
        // https://github.com/torch2424/wasmBoy/issues/51
        // Bits 0 & 1 will represent the color Id drawn by the BG/Window
        // Bit 2 will represent if the Bg/Window has GBC priority.


        addPriorityforPixel(iteratedOutputX, outputLineY, paletteColorId, gbcBgPriority);
        pixelsDrawn++;
      }
    }

    return pixelsDrawn;
  } // Inlined because closure compiler inlines


  function getTilePixelStart(outputLineX, outputLineY, outputWidth) {
    // Finally Lets place a pixel in memory
    var pixelStart = outputLineY * outputWidth + outputLineX; // Each pixel takes 3 slots, therefore, multiply by 3!

    return pixelStart * 3;
  }

  function getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap) {
    // Watch this part of The ultimate gameboy talk: https://youtu.be/HyzD8pNlpwI?t=30m50s
    // A line of 8 pixels on a single tile, is represented by 2 bytes.
    // since a single tile is 8x8 pixels, 8 * 2 = 16 bytes
    // Get the tile ID's tile addess from tile data.
    // For instance, let's say our first line of tile data represents tiles for letters:
    // a b c d e f g
    // And we have tileId 0x02. That means we want the tile for the 'c' character
    // Since each tile is 16 bytes, it would be the starting tileDataAddress + (tileId * tileSize), to skip over tiles we dont want
    // The whole signed thing is weird, and has something to do how the second set of tile data is stored :p
    if (tileDataMemoryLocation === Graphics.memoryLocationTileDataSelectZeroStart) {
      // Treat the tile Id as a signed int, subtract an offset of 128
      // if the tileId was 0 then the tile would be in memory region 0x9000-0x900F
      if (checkBitOnByte(7, tileIdFromTileMap)) {
        tileIdFromTileMap -= 128;
      } else {
        tileIdFromTileMap += 128;
      }
    } // if the background layout gave us the tileId 0, then the tile data would be between 0x8000-0x800F.


    return tileDataMemoryLocation + tileIdFromTileMap * 16;
  } // Functions to help with Handling Duty on Square Channels
  // Since there are no 2d arrays, we will use a byte to represent duty cycles (wave form from percentages)


  function isDutyCycleClockPositiveOrNegativeForWaveform(channelDuty, waveFormPositionOnDuty) {
    // Get our Wave Form According to the Duty
    // Default to a duty of 1
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
    switch (channelDuty) {
      case 0x01:
        // 1000 0001
        return checkBitOnByte(waveFormPositionOnDuty, 0x81);

      case 0x02:
        // 1000 0111
        return checkBitOnByte(waveFormPositionOnDuty, 0x87);

      case 0x03:
        // 0111 1110
        return checkBitOnByte(waveFormPositionOnDuty, 0x7e);

      default:
        // 0000 0001
        return checkBitOnByte(waveFormPositionOnDuty, 0x01);
    }
  } // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript


  var Channel1 =
  /** @class */
  function () {
    function Channel1() {}

    Channel1.updateNRx0 = function (value) {
      var oldSweepNegate = Channel1.NRx0Negate;
      Channel1.NRx0SweepPeriod = (value & 0x70) >> 4;
      Channel1.NRx0Negate = checkBitOnByte(3, value);
      Channel1.NRx0SweepShift = value & 0x07; // Obscure Behavior
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
      // Clearing the sweep negate mode bit in NR10 after at least one sweep calculation has been made,
      // using the negate mode since the last trigger causes the channel to be immediately disabled.
      // This prevents you from having the sweep lower the frequency then raise the frequency without a trigger inbetween.

      if (oldSweepNegate && !Channel1.NRx0Negate && Channel1.sweepNegateShouldDisableChannelOnClear) {
        Channel1.isEnabled = false;
      }
    };

    Channel1.updateNRx1 = function (value) {
      Channel1.NRx1Duty = value >> 6 & 0x03;
      Channel1.NRx1LengthLoad = value & 0x3f; // Also need to set our length counter. Taken from the old, setChannelLengthCounter
      // Channel length is determined by 64 (or 256 if channel 3), - the length load
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
      // Note, this will be different for channel 3

      Channel1.lengthCounter = Channel1.MAX_LENGTH - Channel1.NRx1LengthLoad;
    };

    Channel1.updateNRx2 = function (value) {
      // Handle "Zombie Mode" Obscure behavior
      // https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
      if (Channel1.isEnabled) {
        // If the old envelope period was zero and the envelope is still doing automatic updates,
        // volume is incremented by 1, otherwise if the envelope was in subtract mode,
        // volume is incremented by 2.
        // NOTE: However, from my testing, it ALWAYS increments by one. This was determined
        // by my testing for prehistoric man
        if (Channel1.NRx2EnvelopePeriod === 0 && Channel1.isEnvelopeAutomaticUpdating) {
          // Volume can't be more than 4 bits
          Channel1.volume = Channel1.volume + 1 & 0x0f;
        } // If the mode was changed (add to subtract or subtract to add),
        // volume is set to 16-volume. But volume cant be more than 4 bits


        if (Channel1.NRx2EnvelopeAddMode !== checkBitOnByte(3, value)) {
          Channel1.volume = 16 - Channel1.volume & 0x0f;
        }
      } // Handle the regular write


      Channel1.NRx2StartingVolume = value >> 4 & 0x0f;
      Channel1.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
      Channel1.NRx2EnvelopePeriod = value & 0x07; // Also, get our channel is dac enabled

      var isDacEnabled = (value & 0xf8) > 0;
      Channel1.isDacEnabled = isDacEnabled; // Blargg length test
      // Disabling DAC should disable channel immediately

      if (!isDacEnabled) {
        Channel1.isEnabled = false;
      }
    };

    Channel1.updateNRx3 = function (value) {
      Channel1.NRx3FrequencyLSB = value; // Update Channel Frequency

      Channel1.frequency = Channel1.NRx4FrequencyMSB << 8 | value;
    }; // NOTE: Order in which these events happen are very particular
    // And globals can be affected by other functions
    // Thus, optimizations here should be extremely careful


    Channel1.updateNRx4 = function (value) {
      // Handle our Channel frequency first
      // As this is modified if we trigger for length.
      var frequencyMSB = value & 0x07;
      Channel1.NRx4FrequencyMSB = frequencyMSB;
      Channel1.frequency = frequencyMSB << 8 | Channel1.NRx3FrequencyLSB; // Obscure behavior
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
      // Also see blargg's cgb sound test
      // Extra length clocking occurs when writing to NRx4,
      // when the frame sequencer's next step is one that,
      // doesn't clock the length counter.

      var frameSequencer = Sound.frameSequencer;
      var doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
      var isBeingLengthEnabled = !Channel1.NRx4LengthEnabled && checkBitOnByte(6, value);

      if (!doesNextFrameSequencerUpdateLength) {
        // Check lengthEnable
        if (Channel1.lengthCounter > 0 && isBeingLengthEnabled) {
          Channel1.lengthCounter -= 1;

          if (!checkBitOnByte(7, value) && Channel1.lengthCounter === 0) {
            Channel1.isEnabled = false;
          }
        }
      } // Set the length enabled from the value


      Channel1.NRx4LengthEnabled = checkBitOnByte(6, value); // Trigger out channel, unfreeze length if frozen
      // Triggers should happen after obscure behavior
      // See test 11 for trigger

      if (checkBitOnByte(7, value)) {
        Channel1.trigger(); // When we trigger on the obscure behavior, and we reset the length Counter to max
        // We need to clock

        if (!doesNextFrameSequencerUpdateLength && Channel1.lengthCounter === Channel1.MAX_LENGTH && Channel1.NRx4LengthEnabled) {
          Channel1.lengthCounter -= 1;
        }
      }
    }; // Function to save the state of the class


    Channel1.saveState = function () {
      // Cycle Counter
      store(getSaveStateMemoryOffset(0x00, Channel1.saveStateSlot), Channel1.cycleCounter); // NRx0

      store(getSaveStateMemoryOffset(0x04, Channel1.saveStateSlot), Channel1.NRx0SweepPeriod);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot), Channel1.NRx0Negate);
      store(getSaveStateMemoryOffset(0x06, Channel1.saveStateSlot), Channel1.NRx0SweepShift); // NRx1

      store(getSaveStateMemoryOffset(0x07, Channel1.saveStateSlot), Channel1.NRx1Duty);
      store(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot), Channel1.NRx1LengthLoad); // NRx2

      store(getSaveStateMemoryOffset(0x0a, Channel1.saveStateSlot), Channel1.NRx2StartingVolume);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Channel1.saveStateSlot), Channel1.NRx2EnvelopeAddMode);
      store(getSaveStateMemoryOffset(0x0c, Channel1.saveStateSlot), Channel1.NRx2EnvelopePeriod); // NRx3

      store(getSaveStateMemoryOffset(0x0d, Channel1.saveStateSlot), Channel1.NRx3FrequencyLSB); // NRx4

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0e, Channel1.saveStateSlot), Channel1.NRx4LengthEnabled);
      store(getSaveStateMemoryOffset(0x0f, Channel1.saveStateSlot), Channel1.NRx4FrequencyMSB); // Channel Properties

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel1.saveStateSlot), Channel1.isEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Channel1.saveStateSlot), Channel1.isDacEnabled);
      store(getSaveStateMemoryOffset(0x12, Channel1.saveStateSlot), Channel1.frequency);
      store(getSaveStateMemoryOffset(0x16, Channel1.saveStateSlot), Channel1.frequencyTimer);
      store(getSaveStateMemoryOffset(0x1a, Channel1.saveStateSlot), Channel1.envelopeCounter);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1e, Channel1.saveStateSlot), Channel1.isEnvelopeAutomaticUpdating);
      store(getSaveStateMemoryOffset(0x1f, Channel1.saveStateSlot), Channel1.lengthCounter);
      store(getSaveStateMemoryOffset(0x23, Channel1.saveStateSlot), Channel1.volume); // Square Duty

      store(getSaveStateMemoryOffset(0x27, Channel1.saveStateSlot), Channel1.dutyCycle);
      store(getSaveStateMemoryOffset(0x28, Channel1.saveStateSlot), Channel1.waveFormPositionOnDuty); // Square Sweep

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x29, Channel1.saveStateSlot), Channel1.isSweepEnabled);
      store(getSaveStateMemoryOffset(0x2a, Channel1.saveStateSlot), Channel1.sweepCounter);
      store(getSaveStateMemoryOffset(0x2e, Channel1.saveStateSlot), Channel1.sweepShadowFrequency);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x31, Channel1.saveStateSlot), Channel1.sweepNegateShouldDisableChannelOnClear);
    }; // Function to load the save state from memory


    Channel1.loadState = function () {
      // Cycle Counter
      Channel1.cycleCounter = load(getSaveStateMemoryOffset(0x00, Channel1.cycleCounter)); // NRx0

      Channel1.NRx0SweepPeriod = load(getSaveStateMemoryOffset(0x04, Channel1.saveStateSlot));
      Channel1.NRx0Negate = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot));
      Channel1.NRx0SweepShift = load(getSaveStateMemoryOffset(0x06, Channel1.saveStateSlot)); // NRx1

      Channel1.NRx1Duty = load(getSaveStateMemoryOffset(0x07, Channel1.saveStateSlot));
      Channel1.NRx1LengthLoad = load(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot)); // NRx2

      Channel1.NRx2StartingVolume = load(getSaveStateMemoryOffset(0x0a, Channel1.saveStateSlot));
      Channel1.NRx2EnvelopeAddMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Channel1.saveStateSlot));
      Channel1.NRx2EnvelopePeriod = load(getSaveStateMemoryOffset(0x0c, Channel1.saveStateSlot)); // NRx3

      Channel1.NRx3FrequencyLSB = load(getSaveStateMemoryOffset(0x0d, Channel1.saveStateSlot)); // NRx4

      Channel1.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0e, Channel1.saveStateSlot));
      Channel1.NRx4FrequencyMSB = load(getSaveStateMemoryOffset(0x0f, Channel1.saveStateSlot)); // Channel Properties

      Channel1.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel1.saveStateSlot));
      Channel1.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Channel1.saveStateSlot));
      Channel1.frequency = load(getSaveStateMemoryOffset(0x12, Channel1.saveStateSlot));
      Channel1.frequencyTimer = load(getSaveStateMemoryOffset(0x16, Channel1.saveStateSlot));
      Channel1.envelopeCounter = load(getSaveStateMemoryOffset(0x1a, Channel1.saveStateSlot));
      Channel1.isEnvelopeAutomaticUpdating = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1e, Channel1.saveStateSlot));
      Channel1.lengthCounter = load(getSaveStateMemoryOffset(0x1f, Channel1.saveStateSlot));
      Channel1.volume = load(getSaveStateMemoryOffset(0x23, Channel1.saveStateSlot)); // Square Duty

      Channel1.dutyCycle = load(getSaveStateMemoryOffset(0x27, Channel1.saveStateSlot));
      Channel1.waveFormPositionOnDuty = load(getSaveStateMemoryOffset(0x28, Channel1.saveStateSlot)); // Square Sweep

      Channel1.isSweepEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x29, Channel1.saveStateSlot));
      Channel1.sweepCounter = load(getSaveStateMemoryOffset(0x2a, Channel1.saveStateSlot));
      Channel1.sweepShadowFrequency = load(getSaveStateMemoryOffset(0x2e, Channel1.saveStateSlot));
      Channel1.sweepNegateShouldDisableChannelOnClear = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x31, Channel1.saveStateSlot));
    };

    Channel1.initialize = function () {
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx0, 0x80);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx1, 0xbf);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx2, 0xf3);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, 0xc1);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, 0xbf); // Override/reset some variables if the boot ROM is enabled
      // For GBC and GB

      if (Cpu.BootROMEnabled) {
        eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx1, 0x3f);
        eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx2, 0x00);
        eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, 0x00);
        eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, 0xb8);
      }
    }; // Function to get a sample using the cycle counter on the channel


    Channel1.getSampleFromCycleCounter = function () {
      var accumulatedCycles = Channel1.cycleCounter;
      Channel1.cycleCounter = 0;
      return Channel1.getSample(accumulatedCycles);
    }; // Function to reset our timer, useful for GBC double speed mode


    Channel1.resetTimer = function () {
      var frequencyTimer = 2048 - Channel1.frequency << 2; // TODO: Ensure this is correct for GBC Double Speed Mode

      if (Cpu.GBCDoubleSpeed) {
        frequencyTimer = frequencyTimer << 2;
      }

      Channel1.frequencyTimer = frequencyTimer;
    };

    Channel1.getSample = function (numberOfCycles) {
      // Decrement our channel timer
      var frequencyTimer = Channel1.frequencyTimer;
      frequencyTimer -= numberOfCycles;

      while (frequencyTimer <= 0) {
        // Get the amount that overflowed so we don't drop cycles
        var overflowAmount = abs(frequencyTimer); // Reset our timer
        // A square channel's frequency timer period is set to (2048-frequency)*4.
        // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:

        Channel1.resetTimer();
        frequencyTimer = Channel1.frequencyTimer;
        frequencyTimer -= overflowAmount; // Also increment our duty cycle
        // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
        // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave

        Channel1.waveFormPositionOnDuty = Channel1.waveFormPositionOnDuty + 1 & 7;
      }

      Channel1.frequencyTimer = frequencyTimer; // Get our ourput volume

      var outputVolume = 0; // Finally to set our output volume, the channel must be enabled,
      // Our channel DAC must be enabled, and we must be in an active state
      // Of our duty cycle

      if (Channel1.isEnabled && Channel1.isDacEnabled) {
        // Volume can't be more than 4 bits.
        // Volume should never be more than 4 bits, but doing a check here
        outputVolume = Channel1.volume & 0x0f;
      } else {
        // Return silence
        // Since range from -15 - 15, or 0 to 30 for our unsigned
        return 15;
      } // Get the current sampleValue


      var sample = 1;

      if (!isDutyCycleClockPositiveOrNegativeForWaveform(Channel1.NRx1Duty, Channel1.waveFormPositionOnDuty)) {
        sample = -sample;
      }

      sample *= outputVolume; // Square Waves Can range from -15 - 15. Therefore simply add 15

      sample += 15;
      return sample;
    }; // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event


    Channel1.trigger = function () {
      Channel1.isEnabled = true; // Set length to maximum done in write

      if (Channel1.lengthCounter === 0) {
        Channel1.lengthCounter = Channel1.MAX_LENGTH;
      } // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:


      Channel1.resetTimer(); // The volume envelope and sweep timers treat a period of 0 as 8.
      // Meaning, if the period is zero, set it to the max (8).

      if (Channel1.NRx2EnvelopePeriod === 0) {
        Channel1.envelopeCounter = 8;
      } else {
        Channel1.envelopeCounter = Channel1.NRx2EnvelopePeriod;
      }

      Channel1.isEnvelopeAutomaticUpdating = true;
      Channel1.volume = Channel1.NRx2StartingVolume; // Handle Channel Sweep
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware

      Channel1.sweepShadowFrequency = Channel1.frequency; // Reset back to the sweep period
      // Obscure behavior
      // Sweep timers treat a period o 0 as 8

      if (Channel1.NRx0SweepPeriod === 0) {
        Channel1.sweepCounter = 8;
      } else {
        Channel1.sweepCounter = Channel1.NRx0SweepPeriod;
      } // The internal enabled flag is set if either the sweep period or shift are non-zero, cleared otherwise.


      Channel1.isSweepEnabled = Channel1.NRx0SweepPeriod > 0 || Channel1.NRx0SweepShift > 0;
      Channel1.sweepNegateShouldDisableChannelOnClear = false; // If the sweep shift is non-zero, frequency calculation and the overflow check are performed immediately.
      // NOTE: The double calculation thing for the sweep does not happen here.

      if (Channel1.NRx0SweepShift > 0 && didCalculatedSweepOverflow(calculateSweep())) {
        Channel1.isEnabled = false;
      } // Finally if DAC is off, channel is still disabled


      if (!Channel1.isDacEnabled) {
        Channel1.isEnabled = false;
      }
    }; // Function to determine if the current channel would update when getting the sample
    // This is used to accumulate samples


    Channel1.willChannelUpdate = function (numberOfCycles) {
      //Increment our cycle counter
      var cycleCounter = Channel1.cycleCounter + numberOfCycles;
      Channel1.cycleCounter = cycleCounter; // Dac enabled status cached by accumulator

      return !(Channel1.frequencyTimer - cycleCounter > 0);
    };

    Channel1.updateSweep = function () {
      // Dont update period if not enabled
      if (!Channel1.isEnabled || !Channel1.isSweepEnabled) {
        return;
      } // Decrement the sweep counter


      var sweepCounter = Channel1.sweepCounter - 1;

      if (sweepCounter <= 0) {
        // Reset back to the sweep period
        // Obscure behavior
        // Sweep timers treat a period of 0 as 8 (They reset back to the max)
        if (Channel1.NRx0SweepPeriod === 0) {
          // Sweep isn't calculated when the period is 0
          Channel1.sweepCounter = 8;
        } else {
          // Reset our sweep counter to its period
          Channel1.sweepCounter = Channel1.NRx0SweepPeriod; // Calculate our sweep
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
          // When it generates a clock and the sweep's internal enabled flag is set and the sweep period is not zero,
          // a new frequency is calculated and the overflow check is performed. If the new frequency is 2047 or less,
          // and the sweep shift is not zero, this new frequency is written back to the shadow frequency,
          // and square 1's frequency in NR13 and NR14, then frequency calculation,
          // and overflow check are run AGAIN immediately using this new value,
          // but this second new frequency is not written back.

          var newFrequency = calculateSweep();

          if (didCalculatedSweepOverflow(newFrequency)) {
            Channel1.isEnabled = false;
          }

          if (Channel1.NRx0SweepShift > 0) {
            Channel1.setFrequency(newFrequency);

            if (didCalculatedSweepOverflow(calculateSweep())) {
              Channel1.isEnabled = false;
            }
          }
        }
      } else {
        Channel1.sweepCounter = sweepCounter;
      }
    };

    Channel1.updateLength = function () {
      var lengthCounter = Channel1.lengthCounter;

      if (lengthCounter > 0 && Channel1.NRx4LengthEnabled) {
        lengthCounter -= 1;

        if (lengthCounter === 0) {
          Channel1.isEnabled = false;
        }
      }

      Channel1.lengthCounter = lengthCounter;
    };

    Channel1.updateEnvelope = function () {
      var envelopeCounter = Channel1.envelopeCounter - 1;

      if (envelopeCounter <= 0) {
        // Reset back to the sweep period
        // Obscure behavior
        // Envelopes treat a period of 0 as 8 (They reset back to the max)
        if (Channel1.NRx2EnvelopePeriod === 0) {
          envelopeCounter = 8;
        } else {
          envelopeCounter = Channel1.NRx2EnvelopePeriod; // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
          // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
          // If notes are sustained for too long, this is probably why

          if (envelopeCounter !== 0 && Channel1.isEnvelopeAutomaticUpdating) {
            var volume = Channel1.volume; // Increment the volume

            if (Channel1.NRx2EnvelopeAddMode) {
              volume += 1;
            } else {
              volume -= 1;
            } // Don't allow the volume to go above 4 bits.


            volume = volume & 0x0f; // Check if we are below the max

            if (volume < 15) {
              Channel1.volume = volume;
            } else {
              Channel1.isEnvelopeAutomaticUpdating = false;
            }
          }
        }
      }

      Channel1.envelopeCounter = envelopeCounter;
    };

    Channel1.setFrequency = function (frequency) {
      // Set our shadowFrequency
      Channel1.sweepShadowFrequency = frequency; // Get the high and low bits

      var passedFrequencyHighBits = frequency >> 8 & 0x07;
      var passedFrequencyLowBits = frequency & 0xff; // Get the new register 4

      var register4 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx4); // Knock off lower 3 bits, and Or on our high bits

      var newRegister4 = register4 & 0xf8;
      newRegister4 = newRegister4 | passedFrequencyHighBits; // Set the registers

      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, passedFrequencyLowBits);
      eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, newRegister4); // Save the frequency for ourselves without triggering memory traps

      Channel1.NRx3FrequencyLSB = passedFrequencyLowBits;
      Channel1.NRx4FrequencyMSB = passedFrequencyHighBits;
      Channel1.frequency = Channel1.NRx4FrequencyMSB << 8 | Channel1.NRx3FrequencyLSB;
    }; // Cycle Counter for our sound accumulator


    Channel1.cycleCounter = 0; // Max Length of our Length Load

    Channel1.MAX_LENGTH = 64; // Squarewave channel with volume envelope and frequency sweep functions.
    // NR10 -> Sweep Register R/W

    Channel1.memoryLocationNRx0 = 0xff10; // -PPP NSSS Sweep period, negate, shift

    Channel1.NRx0SweepPeriod = 0;
    Channel1.NRx0Negate = false;
    Channel1.NRx0SweepShift = 0; // NR11 -> Sound length/Wave pattern duty (R/W)

    Channel1.memoryLocationNRx1 = 0xff11; // DDLL LLLL Duty, Length load (64-L)

    Channel1.NRx1Duty = 0;
    Channel1.NRx1LengthLoad = 0; // NR12 -> Volume Envelope (R/W)

    Channel1.memoryLocationNRx2 = 0xff12; // VVVV APPP Starting volume, Envelope add mode, period

    Channel1.NRx2StartingVolume = 0;
    Channel1.NRx2EnvelopeAddMode = false;
    Channel1.NRx2EnvelopePeriod = 0; // NR13 -> Frequency lo (W)

    Channel1.memoryLocationNRx3 = 0xff13; // FFFF FFFF Frequency LSB

    Channel1.NRx3FrequencyLSB = 0; // NR14 -> Frequency hi (R/W)

    Channel1.memoryLocationNRx4 = 0xff14; // TL-- -FFF Trigger, Length enable, Frequency MSB

    Channel1.NRx4LengthEnabled = false;
    Channel1.NRx4FrequencyMSB = 0; // Channel Properties

    Channel1.channelNumber = 1;
    Channel1.isEnabled = false;
    Channel1.isDacEnabled = false;
    Channel1.frequency = 0;
    Channel1.frequencyTimer = 0x00;
    Channel1.envelopeCounter = 0x00;
    Channel1.isEnvelopeAutomaticUpdating = false;
    Channel1.lengthCounter = 0x00;
    Channel1.volume = 0x00; // Square Wave properties

    Channel1.dutyCycle = 0x00;
    Channel1.waveFormPositionOnDuty = 0x00; // Channel 1 Sweep

    Channel1.isSweepEnabled = false;
    Channel1.sweepCounter = 0x00;
    Channel1.sweepShadowFrequency = 0x00;
    Channel1.sweepNegateShouldDisableChannelOnClear = false; // Save States

    Channel1.saveStateSlot = 7;
    return Channel1;
  }(); // Sweep Specific functions
  // Function to determing a new sweep in the current context


  function calculateSweep() {
    // Start our new frequency, by making it equal to the "shadow frequency"
    var oldFrequency = Channel1.sweepShadowFrequency;
    var newFrequency = oldFrequency >> Channel1.NRx0SweepShift; // Check for sweep negation

    if (Channel1.NRx0Negate) {
      Channel1.sweepNegateShouldDisableChannelOnClear = true;
      newFrequency = oldFrequency - newFrequency;
    } else {
      newFrequency = oldFrequency + newFrequency;
    }

    return newFrequency;
  } // Function to check if a calculated sweep overflowed


  function didCalculatedSweepOverflow(calculatedSweep) {
    // 7FF is the highest value of the frequency: 111 1111 1111
    // if it overflows, should disable the channel (handled by the caller)
    if (calculatedSweep > 0x7ff) {
      return true;
    }

    return false;
  } // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript


  var Channel2 =
  /** @class */
  function () {
    function Channel2() {}

    Channel2.updateNRx1 = function (value) {
      Channel2.NRx1Duty = value >> 6 & 0x03;
      Channel2.NRx1LengthLoad = value & 0x3f; // Also need to set our length counter. Taken from the old, setChannelLengthCounter
      // Channel length is determined by 64 (or 256 if channel 3), - the length load
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
      // Note, this will be different for channel 3

      Channel2.lengthCounter = Channel2.MAX_LENGTH - Channel2.NRx1LengthLoad;
    };

    Channel2.updateNRx2 = function (value) {
      // Handle "Zombie Mode" Obscure behavior
      // https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
      if (Channel2.isEnabled) {
        // If the old envelope period was zero and the envelope is still doing automatic updates,
        // volume is incremented by 1, otherwise if the envelope was in subtract mode,
        // volume is incremented by 2.
        // NOTE: However, from my testing, it ALWAYS increments by one. This was determined
        // by my testing for prehistoric man
        if (Channel2.NRx2EnvelopePeriod === 0 && Channel2.isEnvelopeAutomaticUpdating) {
          // Volume can't be more than 4 bits
          Channel2.volume = Channel2.volume + 1 & 0x0f;
        } // If the mode was changed (add to subtract or subtract to add),
        // volume is set to 16-volume. But volume cant be more than 4 bits


        if (Channel2.NRx2EnvelopeAddMode !== checkBitOnByte(3, value)) {
          Channel2.volume = 16 - Channel2.volume & 0x0f;
        }
      }

      Channel2.NRx2StartingVolume = value >> 4 & 0x0f;
      Channel2.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
      Channel2.NRx2EnvelopePeriod = value & 0x07; // Also, get our channel is dac enabled

      var isDacEnabled = (value & 0xf8) > 0;
      Channel2.isDacEnabled = isDacEnabled; // Blargg length test
      // Disabling DAC should disable channel immediately

      if (!isDacEnabled) {
        Channel2.isEnabled = isDacEnabled;
      }
    };

    Channel2.updateNRx3 = function (value) {
      Channel2.NRx3FrequencyLSB = value; // Update Channel Frequency

      Channel2.frequency = Channel2.NRx4FrequencyMSB << 8 | value;
    };

    Channel2.updateNRx4 = function (value) {
      // Handle our Channel frequency first
      // As this is modified if we trigger for length.
      var frequencyMSB = value & 0x07;
      Channel2.NRx4FrequencyMSB = frequencyMSB;
      Channel2.frequency = frequencyMSB << 8 | Channel2.NRx3FrequencyLSB; // Obscure behavior
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
      // Also see blargg's cgb sound test
      // Extra length clocking occurs when writing to NRx4,
      // when the frame sequencer's next step is one that,
      // doesn't clock the length counter.

      var frameSequencer = Sound.frameSequencer;
      var doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
      var isBeingLengthEnabled = !Channel2.NRx4LengthEnabled && checkBitOnByte(6, value);

      if (!doesNextFrameSequencerUpdateLength) {
        if (Channel2.lengthCounter > 0 && isBeingLengthEnabled) {
          Channel2.lengthCounter -= 1;

          if (!checkBitOnByte(7, value) && Channel2.lengthCounter === 0) {
            Channel2.isEnabled = false;
          }
        }
      } // Set the length enabled from the value


      Channel2.NRx4LengthEnabled = checkBitOnByte(6, value); // Trigger out channel, unfreeze length if frozen
      // Triggers should happen after obscure behavior
      // See test 11 for trigger

      if (checkBitOnByte(7, value)) {
        Channel2.trigger(); // When we trigger on the obscure behavior, and we reset the length Counter to max
        // We need to clock

        if (!doesNextFrameSequencerUpdateLength && Channel2.lengthCounter === Channel2.MAX_LENGTH && Channel2.NRx4LengthEnabled) {
          Channel2.lengthCounter -= 1;
        }
      }
    }; // Function to save the state of the class


    Channel2.saveState = function () {
      // Cycle Counter
      store(getSaveStateMemoryOffset(0x00, Channel2.saveStateSlot), Channel2.cycleCounter); // NRx0
      // No NRx0 Properties
      // NRx1

      store(getSaveStateMemoryOffset(0x07, Channel2.saveStateSlot), Channel2.NRx1Duty);
      store(getSaveStateMemoryOffset(0x08, Channel2.saveStateSlot), Channel2.NRx1LengthLoad); // NRx2

      store(getSaveStateMemoryOffset(0x0a, Channel2.saveStateSlot), Channel2.NRx2StartingVolume);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Channel2.saveStateSlot), Channel2.NRx2EnvelopeAddMode);
      store(getSaveStateMemoryOffset(0x0c, Channel2.saveStateSlot), Channel2.NRx2EnvelopePeriod); // NRx3

      store(getSaveStateMemoryOffset(0x0d, Channel2.saveStateSlot), Channel2.NRx3FrequencyLSB); // NRx4

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot), Channel2.NRx4LengthEnabled);
      store(getSaveStateMemoryOffset(0x0f, Channel2.saveStateSlot), Channel2.NRx4FrequencyMSB); // Channel Properties

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel2.saveStateSlot), Channel2.isEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Channel2.saveStateSlot), Channel2.isDacEnabled);
      store(getSaveStateMemoryOffset(0x12, Channel2.saveStateSlot), Channel2.frequency);
      store(getSaveStateMemoryOffset(0x16, Channel2.saveStateSlot), Channel2.frequencyTimer);
      store(getSaveStateMemoryOffset(0x1a, Channel2.saveStateSlot), Channel2.envelopeCounter);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1e, Channel2.saveStateSlot), Channel2.isEnvelopeAutomaticUpdating);
      store(getSaveStateMemoryOffset(0x1f, Channel2.saveStateSlot), Channel2.lengthCounter);
      store(getSaveStateMemoryOffset(0x23, Channel2.saveStateSlot), Channel2.volume); // Square Duty

      store(getSaveStateMemoryOffset(0x27, Channel2.saveStateSlot), Channel2.dutyCycle);
      store(getSaveStateMemoryOffset(0x28, Channel2.saveStateSlot), Channel2.waveFormPositionOnDuty);
    }; // Function to load the save state from memory


    Channel2.loadState = function () {
      // Cycle Counter
      Channel2.cycleCounter = load(getSaveStateMemoryOffset(0x00, Channel2.cycleCounter)); // NRx0
      // No NRx0
      // NRx1

      Channel2.NRx1Duty = load(getSaveStateMemoryOffset(0x07, Channel2.saveStateSlot));
      Channel2.NRx1LengthLoad = load(getSaveStateMemoryOffset(0x08, Channel2.saveStateSlot)); // NRx2

      Channel2.NRx2StartingVolume = load(getSaveStateMemoryOffset(0xa, Channel2.saveStateSlot));
      Channel2.NRx2EnvelopeAddMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Channel2.saveStateSlot));
      Channel2.NRx2EnvelopePeriod = load(getSaveStateMemoryOffset(0x0c, Channel2.saveStateSlot)); // NRx3

      Channel2.NRx3FrequencyLSB = load(getSaveStateMemoryOffset(0x0d, Channel2.saveStateSlot)); // NRx4

      Channel2.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot));
      Channel2.NRx4FrequencyMSB = load(getSaveStateMemoryOffset(0x0f, Channel2.saveStateSlot)); // Channel Properties

      Channel2.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel2.saveStateSlot));
      Channel2.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Channel2.saveStateSlot));
      Channel2.frequency = load(getSaveStateMemoryOffset(0x12, Channel2.saveStateSlot));
      Channel2.frequencyTimer = load(getSaveStateMemoryOffset(0x16, Channel2.saveStateSlot));
      Channel2.envelopeCounter = load(getSaveStateMemoryOffset(0x1a, Channel2.saveStateSlot));
      Channel2.isEnvelopeAutomaticUpdating = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1e, Channel2.saveStateSlot));
      Channel2.lengthCounter = load(getSaveStateMemoryOffset(0x1f, Channel2.saveStateSlot));
      Channel2.volume = load(getSaveStateMemoryOffset(0x23, Channel2.saveStateSlot)); // Square Duty

      Channel2.dutyCycle = load(getSaveStateMemoryOffset(0x27, Channel2.saveStateSlot));
      Channel2.waveFormPositionOnDuty = load(getSaveStateMemoryOffset(0x28, Channel2.saveStateSlot));
    };

    Channel2.initialize = function () {
      eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1 - 1, 0xff);
      eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1, 0x3f);
      eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx2, 0x00);
      eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, 0x00);
      eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, 0xb8);
    }; // Function to get a sample using the cycle counter on the channel


    Channel2.getSampleFromCycleCounter = function () {
      var accumulatedCycles = Channel2.cycleCounter;
      Channel2.cycleCounter = 0;
      return Channel2.getSample(accumulatedCycles);
    }; // Function to reset our timer, useful for GBC double speed mode


    Channel2.resetTimer = function () {
      var frequencyTimer = 2048 - Channel2.frequency << 2; // TODO: Ensure this is correct for GBC Double Speed Mode

      Channel2.frequencyTimer = frequencyTimer << Cpu.GBCDoubleSpeed;
    };

    Channel2.getSample = function (numberOfCycles) {
      // Decrement our channel timer
      var frequencyTimer = Channel2.frequencyTimer;
      frequencyTimer -= numberOfCycles;

      while (frequencyTimer <= 0) {
        // Get the amount that overflowed so we don't drop cycles
        var overflowAmount = abs(frequencyTimer); // Reset our timer
        // A square channel's frequency timer period is set to (2048-frequency)*4.
        // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:

        Channel2.resetTimer();
        frequencyTimer = Channel2.frequencyTimer;
        frequencyTimer -= overflowAmount; // Also increment our duty cycle
        // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
        // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave

        Channel2.waveFormPositionOnDuty = Channel2.waveFormPositionOnDuty + 1 & 7;
      }

      Channel2.frequencyTimer = frequencyTimer; // Get our ourput volume

      var outputVolume = 0; // Finally to set our output volume, the channel must be enabled,
      // Our channel DAC must be enabled, and we must be in an active state
      // Of our duty cycle

      if (Channel2.isEnabled && Channel2.isDacEnabled) {
        // Volume can't be more than 4 bits.
        // Volume should never be more than 4 bits, but doing a check here
        outputVolume = Channel2.volume & 0x0f;
      } else {
        // Return silence
        // Since range from -15 - 15, or 0 to 30 for our unsigned
        return 15;
      } // Get the current sampleValue


      var sample = 1;

      if (!isDutyCycleClockPositiveOrNegativeForWaveform(Channel2.NRx1Duty, Channel2.waveFormPositionOnDuty)) {
        sample = -sample;
      }

      sample = sample * outputVolume; // Square Waves Can range from -15 - 15. Therefore simply add 15

      sample += 15;
      return sample;
    }; //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event


    Channel2.trigger = function () {
      Channel2.isEnabled = true; // Set length to maximum done in write

      if (Channel2.lengthCounter === 0) {
        Channel2.lengthCounter = Channel2.MAX_LENGTH;
      } // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:


      Channel2.resetTimer(); // The volume envelope and sweep timers treat a period of 0 as 8.
      // Meaning, if the period is zero, set it to the max (8).

      if (Channel2.NRx2EnvelopePeriod === 0) {
        Channel2.envelopeCounter = 8;
      } else {
        Channel2.envelopeCounter = Channel2.NRx2EnvelopePeriod;
      }

      Channel2.isEnvelopeAutomaticUpdating = true;
      Channel2.volume = Channel2.NRx2StartingVolume; // Finally if DAC is off, channel is still disabled

      if (!Channel2.isDacEnabled) {
        Channel2.isEnabled = false;
      }
    }; // Function to determine if the current channel would update when getting the sample
    // This is used to accumulate samples


    Channel2.willChannelUpdate = function (numberOfCycles) {
      //Increment our cycle counter
      var cycleCounter = Channel2.cycleCounter + numberOfCycles;
      Channel2.cycleCounter = cycleCounter; // Dac enabled status cached by accumulator

      return !(Channel2.frequencyTimer - cycleCounter > 0);
    };

    Channel2.updateLength = function () {
      var lengthCounter = Channel2.lengthCounter;

      if (lengthCounter > 0 && Channel2.NRx4LengthEnabled) {
        lengthCounter -= 1;
      }

      if (lengthCounter === 0) {
        Channel2.isEnabled = false;
      }

      Channel2.lengthCounter = lengthCounter;
    };

    Channel2.updateEnvelope = function () {
      var envelopeCounter = Channel2.envelopeCounter - 1;

      if (envelopeCounter <= 0) {
        // Reset back to the sweep period
        // Obscure behavior
        // Envelopes treat a period of 0 as 8 (They reset back to the max)
        if (Channel2.NRx2EnvelopePeriod === 0) {
          envelopeCounter = 8;
        } else {
          envelopeCounter = Channel2.NRx2EnvelopePeriod; // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
          // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that

          if (envelopeCounter !== 0 && Channel2.isEnvelopeAutomaticUpdating) {
            var volume = Channel2.volume; // Increment the volume

            if (Channel2.NRx2EnvelopeAddMode) {
              volume += 1;
            } else {
              volume -= 1;
            } // Don't allow the volume to go above 4 bits.


            volume = volume & 0x0f; // Check if we are below the max

            if (volume < 15) {
              Channel2.volume = volume;
            } else {
              Channel2.isEnvelopeAutomaticUpdating = false;
            }
          }
        }
      }

      Channel2.envelopeCounter = envelopeCounter;
    };

    Channel2.setFrequency = function (frequency) {
      // Get the high and low bits
      var passedFrequencyHighBits = frequency >> 8;
      var passedFrequencyLowBits = frequency & 0xff; // Get the new register 4

      var register4 = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx4); // Knock off lower 3 bits, and Or on our high bits

      var newRegister4 = register4 & 0xf8;
      newRegister4 = newRegister4 | passedFrequencyHighBits; // Set the registers

      eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, passedFrequencyLowBits);
      eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, newRegister4); // Save the frequency for ourselves without triggering memory traps

      Channel2.NRx3FrequencyLSB = passedFrequencyLowBits;
      Channel2.NRx4FrequencyMSB = passedFrequencyHighBits;
      Channel2.frequency = passedFrequencyHighBits << 8 | passedFrequencyLowBits;
    }; // Cycle Counter for our sound accumulator


    Channel2.cycleCounter = 0; // Max Length of our Length Load

    Channel2.MAX_LENGTH = 64; // Squarewave channel with volume envelope functions only.
    // Only used by register reading

    Channel2.memoryLocationNRx0 = 0xff15; // NR21 -> Sound length/Wave pattern duty (R/W)

    Channel2.memoryLocationNRx1 = 0xff16; // DDLL LLLL Duty, Length load (64-L)

    Channel2.NRx1Duty = 0;
    Channel2.NRx1LengthLoad = 0; // NR22 -> Volume Envelope (R/W)

    Channel2.memoryLocationNRx2 = 0xff17; // VVVV APPP Starting volume, Envelope add mode, period

    Channel2.NRx2StartingVolume = 0;
    Channel2.NRx2EnvelopeAddMode = false;
    Channel2.NRx2EnvelopePeriod = 0; // NR23 -> Frequency lo (W)

    Channel2.memoryLocationNRx3 = 0xff18; // FFFF FFFF Frequency LSB

    Channel2.NRx3FrequencyLSB = 0; // NR24 -> Frequency hi (R/W)

    Channel2.memoryLocationNRx4 = 0xff19; // TL-- -FFF Trigger, Length enable, Frequency MSB

    Channel2.NRx4LengthEnabled = false;
    Channel2.NRx4FrequencyMSB = 0; // Channel Properties

    Channel2.channelNumber = 2;
    Channel2.isEnabled = false;
    Channel2.isDacEnabled = false;
    Channel2.frequency = 0;
    Channel2.frequencyTimer = 0x00;
    Channel2.envelopeCounter = 0x00;
    Channel2.isEnvelopeAutomaticUpdating = false;
    Channel2.lengthCounter = 0x00;
    Channel2.volume = 0x00; // Square Wave properties

    Channel2.dutyCycle = 0x00;
    Channel2.waveFormPositionOnDuty = 0x00; // Save States

    Channel2.saveStateSlot = 8;
    return Channel2;
  }(); // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript


  var Channel3 =
  /** @class */
  function () {
    function Channel3() {} // E--- ---- DAC power


    Channel3.updateNRx0 = function (value) {
      var isDacEnabled = checkBitOnByte(7, value); // Sample buffer reset to zero when powered on

      if (!Channel3.isDacEnabled && isDacEnabled) {
        Channel3.sampleBuffer = 0x00;
      }

      Channel3.isDacEnabled = isDacEnabled; // Blargg length test
      // Disabling DAC should disable channel immediately

      if (!isDacEnabled) {
        Channel3.isEnabled = isDacEnabled;
      }
    };

    Channel3.updateNRx1 = function (value) {
      Channel3.NRx1LengthLoad = value; // Also need to set our length counter. Taken from the old, setChannelLengthCounter
      // Channel length is determined by 64 (or 256 if channel 3), - the length load
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
      // Note, this will be different for channel 3
      // Supposed to be 256, so subtracting 255 and then adding 1 if that makes sense

      Channel3.lengthCounter = Channel3.MAX_LENGTH - Channel3.NRx1LengthLoad;
    };

    Channel3.updateNRx2 = function (value) {
      Channel3.NRx2VolumeCode = value >> 5 & 0x0f;
    };

    Channel3.updateNRx3 = function (value) {
      Channel3.NRx3FrequencyLSB = value; // Update Channel Frequency

      Channel3.frequency = Channel3.NRx4FrequencyMSB << 8 | value;
    };

    Channel3.updateNRx4 = function (value) {
      // Handle our frequency
      // Must be done first for our upcoming trigger
      // To correctly reset timing
      var frequencyMSB = value & 0x07;
      Channel3.NRx4FrequencyMSB = frequencyMSB;
      Channel3.frequency = frequencyMSB << 8 | Channel3.NRx3FrequencyLSB; // Obscure behavior
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
      // Also see blargg's cgb sound test
      // Extra length clocking occurs when writing to NRx4,
      // when the frame sequencer's next step is one that,
      // doesn't clock the length counter.

      var frameSequencer = Sound.frameSequencer;
      var doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
      var isBeingLengthEnabled = false;

      if (!doesNextFrameSequencerUpdateLength) {
        // Check lengthEnable
        isBeingLengthEnabled = !Channel3.NRx4LengthEnabled && checkBitOnByte(6, value);

        if (Channel3.lengthCounter > 0 && isBeingLengthEnabled) {
          Channel3.lengthCounter -= 1;

          if (!checkBitOnByte(7, value) && Channel3.lengthCounter === 0) {
            Channel3.isEnabled = false;
          }
        }
      } // Set the length enabled from the value


      Channel3.NRx4LengthEnabled = checkBitOnByte(6, value); // Trigger our channel, unfreeze length if frozen
      // Triggers should happen after obscure behavior
      // See test 11 for trigger

      if (checkBitOnByte(7, value)) {
        Channel3.trigger(); // When we trigger on the obscure behavior, and we reset the length Counter to max
        // We need to clock

        if (!doesNextFrameSequencerUpdateLength && Channel3.lengthCounter === Channel3.MAX_LENGTH && Channel3.NRx4LengthEnabled) {
          Channel3.lengthCounter -= 1;
        }
      }
    }; // Function to save the state of the class


    Channel3.saveState = function () {
      // Cycle Counter
      store(getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot), Channel3.cycleCounter); // NRx0
      // No NRx0 Properties
      // NRx1

      store(getSaveStateMemoryOffset(0x08, Channel3.saveStateSlot), Channel3.NRx1LengthLoad); // NRx2

      store(getSaveStateMemoryOffset(0x0a, Channel3.saveStateSlot), Channel3.NRx2VolumeCode); // NRx3

      store(getSaveStateMemoryOffset(0x0c, Channel3.saveStateSlot), Channel3.NRx3FrequencyLSB); // NRx4

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Channel3.saveStateSlot), Channel3.NRx4LengthEnabled);
      store(getSaveStateMemoryOffset(0x0e, Channel3.saveStateSlot), Channel3.NRx4FrequencyMSB); // Channel Properties

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Channel3.saveStateSlot), Channel3.isEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel3.saveStateSlot), Channel3.isDacEnabled);
      store(getSaveStateMemoryOffset(0x11, Channel3.saveStateSlot), Channel3.frequency);
      store(getSaveStateMemoryOffset(0x15, Channel3.saveStateSlot), Channel3.frequencyTimer); // No Envelope

      store(getSaveStateMemoryOffset(0x19, Channel3.saveStateSlot), Channel3.lengthCounter); // WaveTable Properties

      store(getSaveStateMemoryOffset(0x21, Channel3.saveStateSlot), Channel3.waveTablePosition);
      store(getSaveStateMemoryOffset(0x25, Channel3.saveStateSlot), Channel3.volumeCode);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x26, Channel3.saveStateSlot), Channel3.volumeCodeChanged);
      store(getSaveStateMemoryOffset(0x27, Channel3.saveStateSlot), Channel3.sampleBuffer);
    }; // Function to load the save state from memory


    Channel3.loadState = function () {
      // Cycle Counter
      Channel3.cycleCounter = load(getSaveStateMemoryOffset(0x00, Channel3.cycleCounter)); // NRx0
      // No NRx0
      // NRx1

      Channel3.NRx1LengthLoad = load(getSaveStateMemoryOffset(0x08, Channel3.saveStateSlot)); // NRx2

      Channel3.NRx2VolumeCode = load(getSaveStateMemoryOffset(0x0a, Channel3.saveStateSlot)); // NRx3

      Channel3.NRx3FrequencyLSB = load(getSaveStateMemoryOffset(0x0c, Channel3.saveStateSlot)); // NRx4

      Channel3.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Channel3.saveStateSlot));
      Channel3.NRx4FrequencyMSB = load(getSaveStateMemoryOffset(0x0e, Channel3.saveStateSlot)); // Channel Properties

      Channel3.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Channel3.saveStateSlot));
      Channel3.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel3.saveStateSlot));
      Channel3.frequency = load(getSaveStateMemoryOffset(0x11, Channel3.saveStateSlot));
      Channel3.frequencyTimer = load(getSaveStateMemoryOffset(0x15, Channel3.saveStateSlot)); // No Envelope

      Channel3.lengthCounter = load(getSaveStateMemoryOffset(0x19, Channel3.saveStateSlot)); // Wave Table Properties

      Channel3.waveTablePosition = load(getSaveStateMemoryOffset(0x21, Channel3.saveStateSlot));
      Channel3.volumeCode = load(getSaveStateMemoryOffset(0x25, Channel3.saveStateSlot));
      Channel3.volumeCodeChanged = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x26, Channel3.saveStateSlot));
      Channel3.sampleBuffer = load(getSaveStateMemoryOffset(0x27, Channel3.saveStateSlot));
    }; // Memory Read Trap


    Channel3.handleWaveRamRead = function () {
      // Obscure behavior
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
      // If the wave channel is enabled, accessing any byte from $FF30-$FF3F is equivalent to,
      // accessing the current byte selected by the waveform position. Further, on the DMG accesses will only work in this manner,
      // if made within a couple of clocks of the wave channel accessing wave RAM;
      // if made at any other time, reads return $FF and writes have no effect.
      // TODO: Handle DMG case
      return readCurrentSampleByteFromWaveRam();
    }; // Memory Write Trap


    Channel3.handleWaveRamWrite = function (value) {
      // Obscure behavior
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
      // If the wave channel is enabled, accessing any byte from $FF30-$FF3F is equivalent to,
      // accessing the current byte selected by the waveform position. Further, on the DMG accesses will only work in this manner,
      // if made within a couple of clocks of the wave channel accessing wave RAM;
      // if made at any other time, reads return $FF and writes have no effect.
      // Thus we want to write the value to the current sample position
      // Will Find the position, and knock off any remainder
      var positionIndexToAdd = i32Portable(Channel3.waveTablePosition >> 1);
      var memoryLocationWaveSample = Channel3.memoryLocationWaveTable + positionIndexToAdd;
      eightBitStoreIntoGBMemory(memoryLocationWaveSample, value);
    };

    Channel3.initialize = function () {
      eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx0, 0x7f);
      eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx1, 0xff);
      eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx2, 0x9f);
      eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx3, 0x00);
      eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx4, 0xb8); // The volume code changed

      Channel3.volumeCodeChanged = true;
    }; // Function to get a sample using the cycle counter on the channel


    Channel3.getSampleFromCycleCounter = function () {
      var accumulatedCycles = Channel3.cycleCounter;
      Channel3.cycleCounter = 0;
      return Channel3.getSample(accumulatedCycles);
    }; // Function to reset our timer, useful for GBC double speed mode


    Channel3.resetTimer = function () {
      var frequencyTimer = 2048 - Channel3.frequency << 1; // TODO: Ensure this is correct for GBC Double Speed Mode

      Channel3.frequencyTimer = frequencyTimer << Cpu.GBCDoubleSpeed;
    };

    Channel3.getSample = function (numberOfCycles) {
      // Check if we are enabled
      if (!Channel3.isEnabled || !Channel3.isDacEnabled) {
        // Return silence
        // Since range from -15 - 15, or 0 to 30 for our unsigned
        return 15;
      } // Get our volume code
      // Need this to compute the sample


      var volumeCode = Channel3.volumeCode;

      if (Channel3.volumeCodeChanged) {
        volumeCode = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
        volumeCode = volumeCode >> 5;
        volumeCode = volumeCode & 0x0f;
        Channel3.volumeCode = volumeCode;
        Channel3.volumeCodeChanged = false;
      } // Get the current sample


      var sample = getSampleFromSampleBufferForWaveTablePosition(); // Shift our sample and set our volume depending on the volume code
      // Since we can't multiply by float, simply divide by 4, 2, 1
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel

      var outputVolume = 0;

      switch (volumeCode) {
        case 0:
          sample >>= 4;
          break;

        case 1:
          // Dont Shift sample
          outputVolume = 1;
          break;

        case 2:
          sample >>= 1;
          outputVolume = 2;
          break;

        default:
          sample >>= 2;
          outputVolume = 4;
          break;
      } // Apply out output volume


      sample = outputVolume > 0 ? sample / outputVolume : 0; // Square Waves Can range from -15 - 15. Therefore simply add 15

      sample += 15; // Update the sample based on our timer

      var frequencyTimer = Channel3.frequencyTimer;
      frequencyTimer -= numberOfCycles;

      while (frequencyTimer <= 0) {
        // Get the amount that overflowed so we don't drop cycles
        var overflowAmount = abs(frequencyTimer); // Reset our timer
        // A wave channel's frequency timer period is set to (2048-frequency) * 2.
        // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel

        Channel3.resetTimer();
        frequencyTimer = Channel3.frequencyTimer;
        frequencyTimer -= overflowAmount; // Update our sample buffer

        advanceWavePositionAndSampleBuffer();
      }

      Channel3.frequencyTimer = frequencyTimer; // Finally return the sample

      return sample;
    }; //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event


    Channel3.trigger = function () {
      Channel3.isEnabled = true; // Length counter maximum handled by write

      if (Channel3.lengthCounter === 0) {
        Channel3.lengthCounter = Channel3.MAX_LENGTH;
      } // Reset our timer
      // A wave channel's frequency timer period is set to (2048-frequency)*2.


      Channel3.resetTimer(); // Add some delay to our frequency timer
      // So Honestly, lifted this from binjgb
      // https://github.com/binji/binjgb/blob/68eb4b2f6d5d7a98d270e12c4b8ff065c07f5e94/src/emulator.c#L2625
      // I have no clue why this is, but it passes 09-wave read while on.s
      // blargg test.
      // I think this has to do with obscure behavior?
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
      // When triggering the wave channel,
      // the first sample to play is the previous one still in the high nibble of the sample buffer,
      // and the next sample is the second nibble from the wave table.
      // This is because it doesn't load the first byte on trigger like it "should".
      // The first nibble from the wave table is thus not played until the waveform loops.

      Channel3.frequencyTimer += 6; // Reset our wave table position

      Channel3.waveTablePosition = 0; // Finally if DAC is off, channel is still disabled

      if (!Channel3.isDacEnabled) {
        Channel3.isEnabled = false;
      }
    }; // Function to determine if the current channel would update when getting the sample
    // This is used to accumulate samples


    Channel3.willChannelUpdate = function (numberOfCycles) {
      //Increment our cycle counter
      Channel3.cycleCounter += numberOfCycles; // Dac enabled status cached by accumulator

      return !(!Channel3.volumeCodeChanged && Channel3.frequencyTimer - Channel3.cycleCounter > 0);
    };

    Channel3.updateLength = function () {
      var lengthCounter = Channel3.lengthCounter;

      if (lengthCounter > 0 && Channel3.NRx4LengthEnabled) {
        lengthCounter -= 1;
      }

      if (lengthCounter === 0) {
        Channel3.isEnabled = false;
      }

      Channel3.lengthCounter = lengthCounter;
    }; // Cycle Counter for our sound accumulator


    Channel3.cycleCounter = 0; // Max Length of our Length Load

    Channel3.MAX_LENGTH = 256; // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
    // NR30 -> Sound on/off (R/W)

    Channel3.memoryLocationNRx0 = 0xff1a; // NR31 -> Sound length (R/W)

    Channel3.memoryLocationNRx1 = 0xff1b; // LLLL LLLL Length load (256-L)

    Channel3.NRx1LengthLoad = 0; // NR32 -> Select ouput level (R/W)

    Channel3.memoryLocationNRx2 = 0xff1c; // -VV- ---- Volume code (00=0%, 01=100%, 10=50%, 11=25%)

    Channel3.NRx2VolumeCode = 0; // NR33 -> Frequency lower data (W)

    Channel3.memoryLocationNRx3 = 0xff1d; // FFFF FFFF Frequency LSB

    Channel3.NRx3FrequencyLSB = 0; // NR34 -> Frequency higher data (R/W)

    Channel3.memoryLocationNRx4 = 0xff1e; // TL-- -FFF Trigger, Length enable, Frequency MSB

    Channel3.NRx4LengthEnabled = false;
    Channel3.NRx4FrequencyMSB = 0; // Our wave table location

    Channel3.memoryLocationWaveTable = 0xff30; // Channel Properties

    Channel3.channelNumber = 3;
    Channel3.isEnabled = false;
    Channel3.isDacEnabled = false;
    Channel3.frequency = 0;
    Channel3.frequencyTimer = 0x00;
    Channel3.lengthCounter = 0x00; // WaveTable Properties

    Channel3.waveTablePosition = 0x00;
    Channel3.volumeCode = 0x00;
    Channel3.volumeCodeChanged = false;
    Channel3.sampleBuffer = 0x00; // Save States

    Channel3.saveStateSlot = 9;
    return Channel3;
  }(); // Functions specific to wave memory


  function advanceWavePositionAndSampleBuffer() {
    // Advance the wave table position, and loop back if needed
    var waveTablePosition = Channel3.waveTablePosition;
    waveTablePosition += 1;

    while (waveTablePosition >= 32) {
      waveTablePosition -= 32;
    }

    Channel3.waveTablePosition = waveTablePosition; // Load the next sample byte from wave ram,
    // into the sample buffer

    Channel3.sampleBuffer = readCurrentSampleByteFromWaveRam();
  }

  function readCurrentSampleByteFromWaveRam() {
    // Will Find the position, and knock off any remainder
    var positionIndexToAdd = i32Portable(Channel3.waveTablePosition >> 1);
    var memoryLocationWaveSample = Channel3.memoryLocationWaveTable + positionIndexToAdd;
    return eightBitLoadFromGBMemory(memoryLocationWaveSample);
  }

  function getSampleFromSampleBufferForWaveTablePosition() {
    var sample = Channel3.sampleBuffer; // Need to grab the top or lower half for the correct sample

    sample >>= ((Channel3.waveTablePosition & 1) === 0) << 2;
    sample &= 0x0f;
    return sample;
  } // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript


  var Channel4 =
  /** @class */
  function () {
    function Channel4() {}

    Channel4.updateNRx1 = function (value) {
      Channel4.NRx1LengthLoad = value & 0x3f; // Also need to set our length counter. Taken from the old, setChannelLengthCounter
      // Channel length is determined by 64 (or 256 if channel 3), - the length load
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
      // Note, this will be different for channel 3

      Channel4.lengthCounter = Channel4.MAX_LENGTH - Channel4.NRx1LengthLoad;
    };

    Channel4.updateNRx2 = function (value) {
      // Handle "Zombie Mode" Obscure behavior
      // https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
      if (Channel4.isEnabled) {
        // If the old envelope period was zero and the envelope is still doing automatic updates,
        // volume is incremented by 1, otherwise if the envelope was in subtract mode,
        // volume is incremented by 2.
        // NOTE: However, from my testing, it ALWAYS increments by one. This was determined
        // by my testing for prehistoric man
        if (Channel4.NRx2EnvelopePeriod === 0 && Channel4.isEnvelopeAutomaticUpdating) {
          // Volume can't be more than 4 bits
          Channel4.volume = Channel4.volume + 1 & 0x0f;
        } // If the mode was changed (add to subtract or subtract to add),
        // volume is set to 16-volume. But volume cant be more than 4 bits


        if (Channel4.NRx2EnvelopeAddMode !== checkBitOnByte(3, value)) {
          Channel4.volume = 16 - Channel4.volume & 0x0f;
        }
      }

      Channel4.NRx2StartingVolume = value >> 4 & 0x0f;
      Channel4.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
      Channel4.NRx2EnvelopePeriod = value & 0x07; // Also, get our channel is dac enabled

      var isDacEnabled = (value & 0xf8) > 0;
      Channel4.isDacEnabled = isDacEnabled; // Blargg length test
      // Disabling DAC should disable channel immediately

      if (!isDacEnabled) {
        Channel4.isEnabled = isDacEnabled;
      }
    };

    Channel4.updateNRx3 = function (value) {
      var divisorCode = value & 0x07;
      Channel4.NRx3ClockShift = value >> 4;
      Channel4.NRx3WidthMode = checkBitOnByte(3, value);
      Channel4.NRx3DivisorCode = divisorCode; // Also, get our divisor

      divisorCode <<= 1;
      if (divisorCode < 1) divisorCode = 1;
      Channel4.divisor = divisorCode << 3;
    };

    Channel4.updateNRx4 = function (value) {
      // Obscure behavior
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Obscure_Behavior
      // Also see blargg's cgb sound test
      // Extra length clocking occurs when writing to NRx4,
      // when the frame sequencer's next step is one that,
      // doesn't clock the length counter.
      var frameSequencer = Sound.frameSequencer;
      var doesNextFrameSequencerUpdateLength = (frameSequencer & 1) === 1;
      var isBeingLengthEnabled = !Channel4.NRx4LengthEnabled && checkBitOnByte(6, value);

      if (!doesNextFrameSequencerUpdateLength) {
        if (Channel4.lengthCounter > 0 && isBeingLengthEnabled) {
          Channel4.lengthCounter -= 1;

          if (!checkBitOnByte(7, value) && Channel4.lengthCounter === 0) {
            Channel4.isEnabled = false;
          }
        }
      } // Set the length enabled from the value


      Channel4.NRx4LengthEnabled = checkBitOnByte(6, value); // Trigger out channel, unfreeze length if frozen
      // Triggers should happen after obscure behavior
      // See test 11 for trigger

      if (checkBitOnByte(7, value)) {
        Channel4.trigger(); // When we trigger on the obscure behavior, and we reset the length Counter to max
        // We need to clock

        if (!doesNextFrameSequencerUpdateLength && Channel4.lengthCounter === Channel4.MAX_LENGTH && Channel4.NRx4LengthEnabled) {
          Channel4.lengthCounter -= 1;
        }
      }
    }; // Function to save the state of the class


    Channel4.saveState = function () {
      // Cycle Counter
      store(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot), Channel4.cycleCounter); // NRx0
      // No NRx0 Properties
      // NRx1

      store(getSaveStateMemoryOffset(0x04, Channel4.saveStateSlot), Channel4.NRx1LengthLoad); // NRx2

      store(getSaveStateMemoryOffset(0x06, Channel4.saveStateSlot), Channel4.NRx2StartingVolume);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x07, Channel4.saveStateSlot), Channel4.NRx2EnvelopeAddMode);
      store(getSaveStateMemoryOffset(0x08, Channel4.saveStateSlot), Channel4.NRx2EnvelopePeriod); // NRx3

      store(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot), Channel4.NRx3ClockShift);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0a, Channel4.saveStateSlot), Channel4.NRx3WidthMode);
      store(getSaveStateMemoryOffset(0x0b, Channel4.saveStateSlot), Channel4.NRx3DivisorCode); // NRx4

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Channel4.saveStateSlot), Channel4.NRx4LengthEnabled); // Channel Properties

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Channel4.saveStateSlot), Channel4.isEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Channel4.saveStateSlot), Channel4.isDacEnabled);
      store(getSaveStateMemoryOffset(0x15, Channel4.saveStateSlot), Channel4.frequencyTimer);
      store(getSaveStateMemoryOffset(0x19, Channel4.saveStateSlot), Channel4.envelopeCounter);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1d, Channel4.saveStateSlot), Channel4.isEnvelopeAutomaticUpdating);
      store(getSaveStateMemoryOffset(0x1e, Channel4.saveStateSlot), Channel4.lengthCounter);
      store(getSaveStateMemoryOffset(0x22, Channel4.saveStateSlot), Channel4.volume); // LSFR

      store(getSaveStateMemoryOffset(0x26, Channel4.saveStateSlot), Channel4.linearFeedbackShiftRegister);
    }; // Function to load the save state from memory


    Channel4.loadState = function () {
      // Cycle Counter
      Channel4.cycleCounter = load(getSaveStateMemoryOffset(0x00, Channel4.cycleCounter)); // NRx0
      // No NRx0
      // NRx1

      Channel4.NRx1LengthLoad = load(getSaveStateMemoryOffset(0x04, Channel4.saveStateSlot)); // NRx2

      Channel4.NRx2StartingVolume = load(getSaveStateMemoryOffset(0x06, Channel4.saveStateSlot));
      Channel4.NRx2EnvelopeAddMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x07, Channel4.saveStateSlot));
      Channel4.NRx2EnvelopePeriod = load(getSaveStateMemoryOffset(0x08, Channel4.saveStateSlot)); // NRx3

      Channel4.NRx3ClockShift = load(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot));
      Channel4.NRx3WidthMode = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0a, Channel4.saveStateSlot));
      Channel4.NRx3DivisorCode = load(getSaveStateMemoryOffset(0x0b, Channel4.saveStateSlot)); // NRx4

      Channel4.NRx4LengthEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Channel4.saveStateSlot)); // Channel Properties

      Channel4.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Channel4.saveStateSlot));
      Channel4.isDacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Channel4.saveStateSlot));
      Channel4.frequencyTimer = load(getSaveStateMemoryOffset(0x15, Channel4.saveStateSlot));
      Channel4.envelopeCounter = load(getSaveStateMemoryOffset(0x19, Channel4.saveStateSlot));
      Channel4.isEnvelopeAutomaticUpdating = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1d, Channel4.saveStateSlot));
      Channel4.lengthCounter = load(getSaveStateMemoryOffset(0x1e, Channel4.saveStateSlot));
      Channel4.volume = load(getSaveStateMemoryOffset(0x22, Channel4.saveStateSlot)); // LSFR

      Channel4.linearFeedbackShiftRegister = load(getSaveStateMemoryOffset(0x26, Channel4.saveStateSlot));
    };

    Channel4.initialize = function () {
      eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1 - 1, 0xff);
      eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1, 0xff);
      eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx2, 0x00);
      eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx3, 0x00);
      eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx4, 0xbf);
    }; // Function to get a sample using the cycle counter on the channel


    Channel4.getSampleFromCycleCounter = function () {
      var accumulatedCycles = Channel4.cycleCounter;
      Channel4.cycleCounter = 0;
      return Channel4.getSample(accumulatedCycles);
    };

    Channel4.getSample = function (numberOfCycles) {
      // Decrement our channel timer
      var frequencyTimer = Channel4.frequencyTimer;
      frequencyTimer -= numberOfCycles; // TODO: This can't be a while loop to use up all the cycles,
      // Since noise is psuedo random and the period can be anything

      if (frequencyTimer <= 0) {
        // Get the amount that overflowed so we don't drop cycles
        var overflowAmount = abs(frequencyTimer); // Reset our timer

        frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();
        frequencyTimer -= overflowAmount; // Do some cool stuff with lfsr
        // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel
        // First XOR bit zero and one

        var linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister;
        var lfsrBitZero = linearFeedbackShiftRegister & 0x01;
        var lfsrBitOne = linearFeedbackShiftRegister >> 1;
        lfsrBitOne = lfsrBitOne & 0x01;
        var xorLfsrBitZeroOne = lfsrBitZero ^ lfsrBitOne; // Shift all lsfr bits by one

        linearFeedbackShiftRegister = linearFeedbackShiftRegister >> 1; // Place the XOR result on bit 15

        linearFeedbackShiftRegister = linearFeedbackShiftRegister | xorLfsrBitZeroOne << 14; // If the width mode is set, set xor on bit 6, and make lfsr 7 bit

        if (Channel4.NRx3WidthMode) {
          // Make 7 bit, by knocking off lower bits. Want to keeps bits 8 - 16, and then or on 7
          linearFeedbackShiftRegister = linearFeedbackShiftRegister & ~0x40;
          linearFeedbackShiftRegister = linearFeedbackShiftRegister | xorLfsrBitZeroOne << 6;
        }

        Channel4.linearFeedbackShiftRegister = linearFeedbackShiftRegister;
      } // Make sure period never becomes negative


      if (frequencyTimer < 0) {
        frequencyTimer = 0;
      }

      Channel4.frequencyTimer = frequencyTimer; // Get our ourput volume, set to zero for silence

      var outputVolume = 0; // Finally to set our output volume, the channel must be enabled,
      // Our channel DAC must be enabled, and we must be in an active state
      // Of our duty cycle

      if (Channel4.isEnabled && Channel4.isDacEnabled) {
        // Volume can't be more than 4 bits.
        // Volume should never be more than 4 bits, but doing a check here
        outputVolume = Channel4.volume & 0x0f;
      } else {
        // Return silence
        // Since range from -15 - 15, or 0 to 30 for our unsigned
        return 15;
      } // Declare our sample


      var sample = 0; // Wave form output is bit zero of lfsr, INVERTED

      sample = !checkBitOnByte(0, Channel4.linearFeedbackShiftRegister) ? 1 : -1;
      sample = sample * outputVolume; // Noise Can range from -15 - 15. Therefore simply add 15

      sample = sample + 15;
      return sample;
    }; //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event


    Channel4.trigger = function () {
      Channel4.isEnabled = true; // Length counter maximum handled by write

      if (Channel4.lengthCounter === 0) {
        Channel4.lengthCounter = Channel4.MAX_LENGTH;
      } // Reset our timers


      Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod(); // The volume envelope and sweep timers treat a period of 0 as 8.
      // Meaning, if the period is zero, set it to the max (8).

      if (Channel4.NRx2EnvelopePeriod === 0) {
        Channel4.envelopeCounter = 8;
      } else {
        Channel4.envelopeCounter = Channel4.NRx2EnvelopePeriod;
      }

      Channel4.isEnvelopeAutomaticUpdating = true;
      Channel4.volume = Channel4.NRx2StartingVolume; // Noise channel's LFSR bits are all set to 1.

      Channel4.linearFeedbackShiftRegister = 0x7fff; // Finally if DAC is off, channel is still disabled

      if (!Channel4.isDacEnabled) {
        Channel4.isEnabled = false;
      }
    }; // Function to determine if the current channel would update when getting the sample
    // This is used to accumulate samples


    Channel4.willChannelUpdate = function (numberOfCycles) {
      //Increment our cycle counter
      Channel4.cycleCounter += numberOfCycles; // Dac enabled status cached by accumulator

      return !(Channel4.frequencyTimer - Channel4.cycleCounter > 0);
    };

    Channel4.getNoiseChannelFrequencyPeriod = function () {
      // Get our divisor from the divisor code, and shift by the clock shift
      var response = Channel4.divisor << Channel4.NRx3ClockShift;
      return response << Cpu.GBCDoubleSpeed;
    };

    Channel4.updateLength = function () {
      var lengthCounter = Channel4.lengthCounter;

      if (lengthCounter > 0 && Channel4.NRx4LengthEnabled) {
        lengthCounter -= 1;
      }

      if (lengthCounter === 0) {
        Channel4.isEnabled = false;
      }

      Channel4.lengthCounter = lengthCounter;
    };

    Channel4.updateEnvelope = function () {
      var envelopeCounter = Channel4.envelopeCounter - 1;

      if (envelopeCounter <= 0) {
        // Reset back to the sweep period
        // Obscure behavior
        // Envelopes treat a period of 0 as 8 (They reset back to the max)
        if (Channel4.NRx2EnvelopePeriod === 0) {
          envelopeCounter = 8;
        } else {
          envelopeCounter = Channel4.NRx2EnvelopePeriod; // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
          // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that

          if (envelopeCounter !== 0 && Channel4.isEnvelopeAutomaticUpdating) {
            var volume = Channel4.volume; // Increment the volume

            if (Channel4.NRx2EnvelopeAddMode) {
              volume += 1;
            } else {
              volume -= 1;
            } // Don't allow the volume to go above 4 bits.


            volume = volume & 0x0f; // Check if we are below the max

            if (volume < 15) {
              Channel4.volume = volume;
            } else {
              Channel4.isEnvelopeAutomaticUpdating = false;
            }
          }
        }
      }

      Channel4.envelopeCounter = envelopeCounter;
    }; // Cycle Counter for our sound accumulator


    Channel4.cycleCounter = 0; // Max Length of our Length Load

    Channel4.MAX_LENGTH = 64; // Channel 4
    // 'white noise' channel with volume envelope functions.
    // Only used by register reading

    Channel4.memoryLocationNRx0 = 0xff1f; // NR41 -> Sound length (R/W)

    Channel4.memoryLocationNRx1 = 0xff20; // --LL LLLL Length load (64-L)

    Channel4.NRx1LengthLoad = 0; // NR42 -> Volume Envelope (R/W)

    Channel4.memoryLocationNRx2 = 0xff21; // VVVV APPP Starting volume, Envelope add mode, period

    Channel4.NRx2StartingVolume = 0;
    Channel4.NRx2EnvelopeAddMode = false;
    Channel4.NRx2EnvelopePeriod = 0; // NR43 -> Polynomial Counter (R/W)

    Channel4.memoryLocationNRx3 = 0xff22; // SSSS WDDD Clock shift, Width mode of LFSR, Divisor code

    Channel4.NRx3ClockShift = 0;
    Channel4.NRx3WidthMode = false;
    Channel4.NRx3DivisorCode = 0; // NR44 -> Trigger, Length Enable

    Channel4.memoryLocationNRx4 = 0xff23; // TL-- ---- Trigger, Length enable

    Channel4.NRx4LengthEnabled = false; // Channel Properties

    Channel4.channelNumber = 4;
    Channel4.isEnabled = false;
    Channel4.isDacEnabled = false;
    Channel4.frequencyTimer = 0x00;
    Channel4.envelopeCounter = 0x00;
    Channel4.isEnvelopeAutomaticUpdating = false;
    Channel4.lengthCounter = 0x00;
    Channel4.volume = 0x00;
    Channel4.divisor = 0; // Noise properties
    // NOTE: Is only 15 bits

    Channel4.linearFeedbackShiftRegister = 0x00; // Save States

    Channel4.saveStateSlot = 10;
    return Channel4;
  }(); // Another class simply for accumulating samples
  // Default everything to silence


  var SoundAccumulator =
  /** @class */
  function () {
    function SoundAccumulator() {}

    SoundAccumulator.channel1Sample = 15;
    SoundAccumulator.channel2Sample = 15;
    SoundAccumulator.channel3Sample = 15;
    SoundAccumulator.channel4Sample = 15;
    SoundAccumulator.channel1DacEnabled = false;
    SoundAccumulator.channel2DacEnabled = false;
    SoundAccumulator.channel3DacEnabled = false;
    SoundAccumulator.channel4DacEnabled = false;
    SoundAccumulator.leftChannelSampleUnsignedByte = 127;
    SoundAccumulator.rightChannelSampleUnsignedByte = 127;
    SoundAccumulator.mixerVolumeChanged = false;
    SoundAccumulator.mixerEnabledChanged = false; // If a channel was updated, need to also track if we need to need to mix them again

    SoundAccumulator.needToRemixSamples = false;
    return SoundAccumulator;
  }(); // Inlined because closure compiler inlines


  function initializeSoundAccumulator() {
    SoundAccumulator.channel1Sample = 15;
    SoundAccumulator.channel2Sample = 15;
    SoundAccumulator.channel3Sample = 15;
    SoundAccumulator.channel4Sample = 15;
    SoundAccumulator.channel1DacEnabled = false;
    SoundAccumulator.channel2DacEnabled = false;
    SoundAccumulator.channel3DacEnabled = false;
    SoundAccumulator.channel4DacEnabled = false;
    SoundAccumulator.leftChannelSampleUnsignedByte = 127;
    SoundAccumulator.rightChannelSampleUnsignedByte = 127;
    SoundAccumulator.mixerVolumeChanged = true;
    SoundAccumulator.mixerEnabledChanged = true;
    SoundAccumulator.needToRemixSamples = false;
  } // Inlined because closure compiler inlines


  function accumulateSound(numberOfCycles) {
    // Check if any of the individual channels will update
    var channel1WillUpdate = Channel1.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel1.channelNumber);
    var channel2WillUpdate = Channel2.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel2.channelNumber);
    var channel3WillUpdate = Channel3.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel3.channelNumber);
    var channel4WillUpdate = Channel4.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel4.channelNumber);

    if (channel1WillUpdate) {
      SoundAccumulator.channel1Sample = Channel1.getSampleFromCycleCounter();
    }

    if (channel2WillUpdate) {
      SoundAccumulator.channel2Sample = Channel2.getSampleFromCycleCounter();
    }

    if (channel3WillUpdate) {
      SoundAccumulator.channel3Sample = Channel3.getSampleFromCycleCounter();
    }

    if (channel4WillUpdate) {
      SoundAccumulator.channel4Sample = Channel4.getSampleFromCycleCounter();
    } // If any channel updated, we need to re-mix our samples


    if (channel1WillUpdate || channel2WillUpdate || channel3WillUpdate || channel4WillUpdate) {
      SoundAccumulator.needToRemixSamples = true;
    } // Do Some downsampling magic


    var downSampleCycleCounter = Sound.downSampleCycleCounter;
    downSampleCycleCounter += numberOfCycles;
    var maxDownSampleCycles = Sound.maxDownSampleCycles();

    if (downSampleCycleCounter >= maxDownSampleCycles) {
      // Reset the downsample counter
      // Don't set to zero to catch overflowed cycles
      downSampleCycleCounter -= maxDownSampleCycles;

      if (SoundAccumulator.needToRemixSamples || SoundAccumulator.mixerVolumeChanged || SoundAccumulator.mixerEnabledChanged) {
        mixChannelSamples(SoundAccumulator.channel1Sample, SoundAccumulator.channel2Sample, SoundAccumulator.channel3Sample, SoundAccumulator.channel4Sample);
      } else {
        Sound.downSampleCycleCounter = downSampleCycleCounter;
      } // Finally Simply place the accumulated sample in memory
      // Set our volumes in memory
      // +1 so it can not be zero


      setLeftAndRightOutputForAudioQueue(SoundAccumulator.leftChannelSampleUnsignedByte + 1, SoundAccumulator.rightChannelSampleUnsignedByte + 1, AUDIO_BUFFER_LOCATION);
      var audioQueueIndex = Sound.audioQueueIndex + 1; // Don't allow our audioQueueIndex to overflow into other parts of the wasmBoy memory map
      // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0
      // Not 0xFFFF because we need half of 64kb since we store left and right channel

      var maxIndex = i32Portable(Sound.wasmBoyMemoryMaxBufferSize >> 1) - 1;

      if (audioQueueIndex >= maxIndex) {
        audioQueueIndex -= 1;
      }

      Sound.audioQueueIndex = audioQueueIndex;
    }

    Sound.downSampleCycleCounter = downSampleCycleCounter;
  } // Function used by SoundAccumulator to find out if a channel Dac Changed


  function didChannelDacChange(channelNumber) {
    switch (channelNumber) {
      case Channel1.channelNumber:
        {
          var isDacEnabled = Channel1.isDacEnabled;
          var channel1EnabledChanged = SoundAccumulator.channel1DacEnabled !== isDacEnabled;
          SoundAccumulator.channel1DacEnabled = isDacEnabled;
          return channel1EnabledChanged;
        }

      case Channel2.channelNumber:
        {
          var isDacEnabled = Channel2.isDacEnabled;
          var channel2EnabledChanged = SoundAccumulator.channel2DacEnabled !== isDacEnabled;
          SoundAccumulator.channel2DacEnabled = isDacEnabled;
          return channel2EnabledChanged;
        }

      case Channel3.channelNumber:
        {
          var isDacEnabled = Channel3.isDacEnabled;
          var channel3EnabledChanged = SoundAccumulator.channel3DacEnabled !== isDacEnabled;
          SoundAccumulator.channel3DacEnabled = isDacEnabled;
          return channel3EnabledChanged;
        }

      case Channel4.channelNumber:
        {
          var isDacEnabled = Channel4.isDacEnabled;
          var channel4EnabledChanged = SoundAccumulator.channel4DacEnabled !== isDacEnabled;
          SoundAccumulator.channel4DacEnabled = isDacEnabled;
          return channel4EnabledChanged;
        }
    }

    return false;
  } // https://emu-docs.org/Game%20Boy/gb_sound.txt


  var Sound =
  /** @class */
  function () {
    function Sound() {} // Number of cycles to run in each batch process
    // This number should be in sync so that sound doesn't run too many cyles at once
    // and does not exceed the minimum number of cyles for either down sampling, or
    // How often we change the frame, or a channel's update process
    // Number of cycles is 87, because:
    // Number of cycles before downsampling a single sample
    // TODO: Find out how to make this number bigger
    // Or, don't call this in syncCycles, and make the lib responsible.


    Sound.batchProcessCycles = function () {
      // return Cpu.GBCDoubleSpeed ? 174 : 87;
      return 87 << Cpu.GBCDoubleSpeed;
    };

    Sound.updateNR50 = function (value) {
      Sound.NR50LeftMixerVolume = value >> 4 & 0x07;
      Sound.NR50RightMixerVolume = value & 0x07;
    };

    Sound.updateNR51 = function (value) {
      Sound.NR51IsChannel4EnabledOnLeftOutput = checkBitOnByte(7, value);
      Sound.NR51IsChannel3EnabledOnLeftOutput = checkBitOnByte(6, value);
      Sound.NR51IsChannel2EnabledOnLeftOutput = checkBitOnByte(5, value);
      Sound.NR51IsChannel1EnabledOnLeftOutput = checkBitOnByte(4, value);
      Sound.NR51IsChannel4EnabledOnRightOutput = checkBitOnByte(3, value);
      Sound.NR51IsChannel3EnabledOnRightOutput = checkBitOnByte(2, value);
      Sound.NR51IsChannel2EnabledOnRightOutput = checkBitOnByte(1, value);
      Sound.NR51IsChannel1EnabledOnRightOutput = checkBitOnByte(0, value);
    };

    Sound.updateNR52 = function (value) {
      Sound.NR52IsSoundEnabled = checkBitOnByte(7, value);
    };

    Sound.maxFrameSequenceCycles = function () {
      // return Cpu.GBCDoubleSpeed ? 16384 : 8192;
      return 8192 << Cpu.GBCDoubleSpeed;
    };

    Sound.maxDownSampleCycles = function () {
      return Cpu.CLOCK_SPEED() / Sound.sampleRate;
    }; // Function to save the state of the class


    Sound.saveState = function () {
      // NR50
      store(getSaveStateMemoryOffset(0x00, Sound.saveStateSlot), Sound.NR50LeftMixerVolume);
      store(getSaveStateMemoryOffset(0x04, Sound.saveStateSlot), Sound.NR50RightMixerVolume); // NR51

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x08, Sound.saveStateSlot), Sound.NR51IsChannel1EnabledOnLeftOutput);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x09, Sound.saveStateSlot), Sound.NR51IsChannel2EnabledOnLeftOutput);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0a, Sound.saveStateSlot), Sound.NR51IsChannel3EnabledOnLeftOutput);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Sound.saveStateSlot), Sound.NR51IsChannel4EnabledOnLeftOutput);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0c, Sound.saveStateSlot), Sound.NR51IsChannel1EnabledOnRightOutput);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Sound.saveStateSlot), Sound.NR51IsChannel2EnabledOnRightOutput);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0e, Sound.saveStateSlot), Sound.NR51IsChannel3EnabledOnRightOutput);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Sound.saveStateSlot), Sound.NR51IsChannel4EnabledOnRightOutput); // NR52

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Sound.saveStateSlot), Sound.NR52IsSoundEnabled); // Frame Sequencer

      store(getSaveStateMemoryOffset(0x11, Sound.saveStateSlot), Sound.frameSequenceCycleCounter);
      store(getSaveStateMemoryOffset(0x16, Sound.saveStateSlot), Sound.frameSequencer); // Down Sampler

      store(getSaveStateMemoryOffset(0x17, Sound.saveStateSlot), Sound.downSampleCycleCounter); // Sound Accumulator

      store(getSaveStateMemoryOffset(0x18, Sound.saveStateSlot), SoundAccumulator.channel1Sample);
      store(getSaveStateMemoryOffset(0x19, Sound.saveStateSlot), SoundAccumulator.channel2Sample);
      store(getSaveStateMemoryOffset(0x1a, Sound.saveStateSlot), SoundAccumulator.channel3Sample);
      store(getSaveStateMemoryOffset(0x1b, Sound.saveStateSlot), SoundAccumulator.channel4Sample);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1c, Sound.saveStateSlot), SoundAccumulator.channel1DacEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1d, Sound.saveStateSlot), SoundAccumulator.channel2DacEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1e, Sound.saveStateSlot), SoundAccumulator.channel3DacEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x1f, Sound.saveStateSlot), SoundAccumulator.channel4DacEnabled);
      store(getSaveStateMemoryOffset(0x20, Sound.saveStateSlot), SoundAccumulator.leftChannelSampleUnsignedByte);
      store(getSaveStateMemoryOffset(0x21, Sound.saveStateSlot), SoundAccumulator.rightChannelSampleUnsignedByte);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x22, Sound.saveStateSlot), SoundAccumulator.mixerVolumeChanged);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x23, Sound.saveStateSlot), SoundAccumulator.mixerEnabledChanged);
    }; // Function to load the save state from memory


    Sound.loadState = function () {
      // NR50
      Sound.NR50LeftMixerVolume = load(getSaveStateMemoryOffset(0x00, Sound.saveStateSlot));
      Sound.NR50RightMixerVolume = load(getSaveStateMemoryOffset(0x04, Sound.saveStateSlot)); // NR51

      Sound.NR51IsChannel1EnabledOnLeftOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x08, Sound.saveStateSlot));
      Sound.NR51IsChannel2EnabledOnLeftOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x09, Sound.saveStateSlot));
      Sound.NR51IsChannel3EnabledOnLeftOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0a, Sound.saveStateSlot));
      Sound.NR51IsChannel4EnabledOnLeftOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Sound.saveStateSlot));
      Sound.NR51IsChannel1EnabledOnRightOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0c, Sound.saveStateSlot));
      Sound.NR51IsChannel2EnabledOnRightOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Sound.saveStateSlot));
      Sound.NR51IsChannel3EnabledOnRightOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0e, Sound.saveStateSlot));
      Sound.NR51IsChannel4EnabledOnRightOutput = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Sound.saveStateSlot)); // NR52

      Sound.NR52IsSoundEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Sound.saveStateSlot)); // Frame Sequencer

      Sound.frameSequenceCycleCounter = load(getSaveStateMemoryOffset(0x11, Sound.saveStateSlot));
      Sound.frameSequencer = load(getSaveStateMemoryOffset(0x16, Sound.saveStateSlot)); // DownSampler

      Sound.downSampleCycleCounter = load(getSaveStateMemoryOffset(0x17, Sound.saveStateSlot)); // Sound Accumulator

      SoundAccumulator.channel1Sample = load(getSaveStateMemoryOffset(0x18, Sound.saveStateSlot));
      SoundAccumulator.channel2Sample = load(getSaveStateMemoryOffset(0x19, Sound.saveStateSlot));
      SoundAccumulator.channel3Sample = load(getSaveStateMemoryOffset(0x1a, Sound.saveStateSlot));
      SoundAccumulator.channel4Sample = load(getSaveStateMemoryOffset(0x1b, Sound.saveStateSlot));
      SoundAccumulator.channel1DacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1c, Sound.saveStateSlot));
      SoundAccumulator.channel2DacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1d, Sound.saveStateSlot));
      SoundAccumulator.channel3DacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1e, Sound.saveStateSlot));
      SoundAccumulator.channel4DacEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x1f, Sound.saveStateSlot));
      SoundAccumulator.leftChannelSampleUnsignedByte = load(getSaveStateMemoryOffset(0x20, Sound.saveStateSlot));
      SoundAccumulator.rightChannelSampleUnsignedByte = load(getSaveStateMemoryOffset(0x21, Sound.saveStateSlot));
      SoundAccumulator.mixerVolumeChanged = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x22, Sound.saveStateSlot));
      SoundAccumulator.mixerEnabledChanged = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x23, Sound.saveStateSlot)); // Finally clear the audio buffer

      clearAudioBuffer();
    }; // Current cycles
    // This will be used for batch processing
    // https://github.com/binji/binjgb/commit/e028f45e805bc0b0aa4697224a209f9ae514c954
    // TODO: May Also need to do this for Reads


    Sound.currentCycles = 0; // Channel control / On-OFF / Volume (RW)

    Sound.memoryLocationNR50 = 0xff24;
    Sound.NR50LeftMixerVolume = 0;
    Sound.NR50RightMixerVolume = 0; // 0xFF25 selects which output each channel goes to, Referred to as NR51

    Sound.memoryLocationNR51 = 0xff25;
    Sound.NR51IsChannel1EnabledOnLeftOutput = true;
    Sound.NR51IsChannel2EnabledOnLeftOutput = true;
    Sound.NR51IsChannel3EnabledOnLeftOutput = true;
    Sound.NR51IsChannel4EnabledOnLeftOutput = true;
    Sound.NR51IsChannel1EnabledOnRightOutput = true;
    Sound.NR51IsChannel2EnabledOnRightOutput = true;
    Sound.NR51IsChannel3EnabledOnRightOutput = true;
    Sound.NR51IsChannel4EnabledOnRightOutput = true; // Sound on/off

    Sound.memoryLocationNR52 = 0xff26;
    Sound.NR52IsSoundEnabled = true; // $FF30 -- $FF3F is the load register space for the 4-bit samples for channel 3

    Sound.memoryLocationChannel3LoadRegisterStart = 0xff30; // Need to count how often we need to increment our frame sequencer
    // Which you can read about below

    Sound.frameSequenceCycleCounter = 0x0000; // Frame sequencer controls what should be updated and and ticked
    // Every time the sound is updated :) It is updated everytime the
    // Cycle counter reaches the max cycle

    Sound.frameSequencer = 0x00; // Also need to downsample our audio to average audio qualty
    // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
    // Want to do 44100hz, so CpuRate / Sound Rate, 4194304 / 44100 ~ 91 cycles

    Sound.downSampleCycleCounter = 0x00;
    Sound.sampleRate = 44100; // Our current sample number we are passing back to the wasmboy memory map
    // Found that a static number of samples doesn't work well on mobile
    // Will just update the queue index, grab as much as we can whenever we need more audio, then reset
    // NOTE: Giving a really large sample rate gives more latency, but less pops!
    //static readonly MAX_NUMBER_OF_SAMPLES: i32 = 4096;

    Sound.audioQueueIndex = 0x0000;
    Sound.wasmBoyMemoryMaxBufferSize = 0x20000; // Save States

    Sound.saveStateSlot = 6;
    return Sound;
  }(); // Initialize sound registers
  // From: https://emu-docs.org/Game%20Boy/gb_sound.txt
  // Inlined because closure compiler inlines


  function initializeSound() {
    // Reset Stateful variables
    Sound.currentCycles = 0;
    Sound.NR50LeftMixerVolume = 0;
    Sound.NR50RightMixerVolume = 0;
    Sound.NR51IsChannel1EnabledOnLeftOutput = true;
    Sound.NR51IsChannel2EnabledOnLeftOutput = true;
    Sound.NR51IsChannel3EnabledOnLeftOutput = true;
    Sound.NR51IsChannel4EnabledOnLeftOutput = true;
    Sound.NR51IsChannel1EnabledOnRightOutput = true;
    Sound.NR51IsChannel2EnabledOnRightOutput = true;
    Sound.NR51IsChannel3EnabledOnRightOutput = true;
    Sound.NR51IsChannel4EnabledOnRightOutput = true;
    Sound.NR52IsSoundEnabled = true;
    Sound.frameSequenceCycleCounter = 0x0000;
    Sound.downSampleCycleCounter = 0x00;
    Sound.frameSequencer = 0x00;
    Sound.audioQueueIndex = 0x0000; // intiialize our channels

    Channel1.initialize();
    Channel2.initialize();
    Channel3.initialize();
    Channel4.initialize(); // Other Sound Registers

    eightBitStoreIntoGBMemory(Sound.memoryLocationNR50, 0x77);
    Sound.updateNR50(0x77);
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR51, 0xf3);
    Sound.updateNR51(0xf3);
    eightBitStoreIntoGBMemory(Sound.memoryLocationNR52, 0xf1);
    Sound.updateNR52(0xf1); // Override/reset some variables if the boot ROM is enabled
    // For both GB and GBC

    if (Cpu.BootROMEnabled) {
      eightBitStoreIntoGBMemory(Sound.memoryLocationNR50, 0x00);
      Sound.updateNR50(0x00);
      eightBitStoreIntoGBMemory(Sound.memoryLocationNR51, 0x00);
      Sound.updateNR51(0x00);
      eightBitStoreIntoGBMemory(Sound.memoryLocationNR52, 0x70);
      Sound.updateNR52(0x70);
    }

    initializeSoundAccumulator();
  } // Function to batch process our audio after we skipped so many cycles


  function batchProcessAudio() {
    var batchProcessCycles = Sound.batchProcessCycles();
    var currentCycles = Sound.currentCycles;

    while (currentCycles >= batchProcessCycles) {
      updateSound(batchProcessCycles);
      currentCycles -= batchProcessCycles;
    }

    Sound.currentCycles = currentCycles;
  } // Function for updating sound


  function updateSound(numberOfCycles) {
    // Check if our frameSequencer updated
    var frameSequencerUpdated = updateFrameSequencer(numberOfCycles);

    if (Config.audioAccumulateSamples && !frameSequencerUpdated) {
      accumulateSound(numberOfCycles);
    } else {
      calculateSound(numberOfCycles);
    }
  } // Funciton to get the current Audio Queue index


  function getNumberOfSamplesInAudioBuffer() {
    return Sound.audioQueueIndex;
  } // Function to reset the audio queue


  function clearAudioBuffer() {
    Sound.audioQueueIndex = 0;
  } // Inlined because closure compiler inlines


  function calculateSound(numberOfCycles) {
    // Update all of our channels
    // All samples will be returned as 0 to 30
    // 0 being -1.0, and 30 being 1.0
    // (see blurb at top)
    var channel1Sample = i32Portable(Channel1.getSample(numberOfCycles));
    var channel2Sample = i32Portable(Channel2.getSample(numberOfCycles));
    var channel3Sample = i32Portable(Channel3.getSample(numberOfCycles));
    var channel4Sample = i32Portable(Channel4.getSample(numberOfCycles)); // TODO: Allow individual channels to be muted
    // let channel1Sample: i32 = 15;
    // let channel2Sample: i32 = 15;
    // let channel3Sample: i32 = 15;
    // let channel4Sample: i32 = 15;
    // Save the samples in the accumulator

    SoundAccumulator.channel1Sample = channel1Sample;
    SoundAccumulator.channel2Sample = channel2Sample;
    SoundAccumulator.channel3Sample = channel3Sample;
    SoundAccumulator.channel4Sample = channel4Sample; // Do Some downsampling magic

    var downSampleCycleCounter = Sound.downSampleCycleCounter + numberOfCycles;

    if (downSampleCycleCounter >= Sound.maxDownSampleCycles()) {
      // Reset the downsample counter
      // Don't set to zero to catch overflowed cycles
      downSampleCycleCounter -= Sound.maxDownSampleCycles(); // Mix our samples

      var mixedSample = mixChannelSamples(channel1Sample, channel2Sample, channel3Sample, channel4Sample);
      var leftChannelSampleUnsignedByte = splitHighByte(mixedSample);
      var rightChannelSampleUnsignedByte = splitLowByte(mixedSample); // Set our volumes in memory
      // +1 so it can not be zero

      setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, AUDIO_BUFFER_LOCATION);

      if (Config.enableAudioDebugging) {
        // Channel 1
        mixedSample = mixChannelSamples(channel1Sample, 15, 15, 15);
        leftChannelSampleUnsignedByte = splitHighByte(mixedSample);
        rightChannelSampleUnsignedByte = splitLowByte(mixedSample);
        setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, CHANNEL_1_BUFFER_LOCATION); // Channel 2

        mixedSample = mixChannelSamples(15, channel2Sample, 15, 15);
        leftChannelSampleUnsignedByte = splitHighByte(mixedSample);
        rightChannelSampleUnsignedByte = splitLowByte(mixedSample);
        setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, CHANNEL_2_BUFFER_LOCATION); // Channel 3

        mixedSample = mixChannelSamples(15, 15, channel3Sample, 15);
        leftChannelSampleUnsignedByte = splitHighByte(mixedSample);
        rightChannelSampleUnsignedByte = splitLowByte(mixedSample);
        setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, CHANNEL_3_BUFFER_LOCATION); // Channel 4

        mixedSample = mixChannelSamples(15, 15, 15, channel4Sample);
        leftChannelSampleUnsignedByte = splitHighByte(mixedSample);
        rightChannelSampleUnsignedByte = splitLowByte(mixedSample);
        setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, CHANNEL_4_BUFFER_LOCATION);
      }

      var audioQueueIndex = Sound.audioQueueIndex + 1; // Don't allow our audioQueueIndex to overflow into other parts of the wasmBoy memory map
      // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0
      // Not 0xFFFF because we need half of 64kb since we store left and right channel

      var maxIndex = i32Portable(Sound.wasmBoyMemoryMaxBufferSize >> 1) - 1;

      if (audioQueueIndex >= maxIndex) {
        audioQueueIndex -= 1;
      }

      Sound.audioQueueIndex = audioQueueIndex;
    }

    Sound.downSampleCycleCounter = downSampleCycleCounter;
  } // Inlined because closure compiler inlines


  function updateFrameSequencer(numberOfCycles) {
    // APU runs at 4194304 / 512
    // Or Cpu.clockSpeed / 512
    // Which means, we need to update once every 8192 cycles :)
    var maxFrameSequenceCycles = Sound.maxFrameSequenceCycles();
    var frameSequenceCycleCounter = Sound.frameSequenceCycleCounter + numberOfCycles;

    if (frameSequenceCycleCounter >= maxFrameSequenceCycles) {
      // Reset the frameSequenceCycleCounter
      // Not setting to zero as we do not want to drop cycles
      frameSequenceCycleCounter -= maxFrameSequenceCycles;
      Sound.frameSequenceCycleCounter = frameSequenceCycleCounter; // Update our frame sequencer
      // https://gist.github.com/drhelius/3652407

      var frameSequencer = Sound.frameSequencer + 1 & 7;

      switch (frameSequencer) {
        case 0:
          // Update Length on Channels
          Channel1.updateLength();
          Channel2.updateLength();
          Channel3.updateLength();
          Channel4.updateLength();
          break;

        /* Do Nothing on one */

        case 2:
          // Update Sweep and Length on Channels
          Channel1.updateLength();
          Channel2.updateLength();
          Channel3.updateLength();
          Channel4.updateLength();
          Channel1.updateSweep();
          break;

        /* Do Nothing on three */

        case 4:
          // Update Length on Channels
          Channel1.updateLength();
          Channel2.updateLength();
          Channel3.updateLength();
          Channel4.updateLength();
          break;

        /* Do Nothing on five */

        case 6:
          // Update Sweep and Length on Channels
          Channel1.updateLength();
          Channel2.updateLength();
          Channel3.updateLength();
          Channel4.updateLength();
          Channel1.updateSweep();
          break;

        case 7:
          // Update Envelope on channels
          Channel1.updateEnvelope();
          Channel2.updateEnvelope();
          Channel4.updateEnvelope();
          break;
      } // Save our frame sequencer


      Sound.frameSequencer = frameSequencer;
      return true;
    } else {
      Sound.frameSequenceCycleCounter = frameSequenceCycleCounter;
    }

    return false;
  }

  function mixChannelSamples(channel1Sample, channel2Sample, channel3Sample, channel4Sample) {
    // Do Some Cool mixing
    // NR50 FF24 ALLL BRRR Vin L enable, Left vol, Vin R enable, Right vol
    // NR51 FF25 NW21 NW21 Left enables, Right enables
    // NR52 FF26 P--- NW21 Power control/status, Channel length statuses
    // NW21 = 4 bits on byte
    // 3 -> Channel 4, 2 -> Channel 3, 1 -> Channel 2, 0 -> Channel 1
    if (channel1Sample === void 0) {
      channel1Sample = 15;
    }

    if (channel2Sample === void 0) {
      channel2Sample = 15;
    }

    if (channel3Sample === void 0) {
      channel3Sample = 15;
    }

    if (channel4Sample === void 0) {
      channel4Sample = 15;
    } // Matt's Proccess
    // I push out 1024 samples at a time and use 96000 hz sampling rate, so I guess i'm a bit less than one frame,
    // but I let the queue fill up with 4 x 1024 samples before I start waiting for the audio
    // TODO: Vin Mixing


    SoundAccumulator.mixerVolumeChanged = false; // Get our channel volume for left/right

    var leftChannelSample = 0;
    var rightChannelSample = 0; // Find the sample for the left if enabled
    // other wise add silence (15) for the channel

    leftChannelSample += Sound.NR51IsChannel1EnabledOnLeftOutput ? channel1Sample : 15;
    leftChannelSample += Sound.NR51IsChannel2EnabledOnLeftOutput ? channel2Sample : 15;
    leftChannelSample += Sound.NR51IsChannel3EnabledOnLeftOutput ? channel3Sample : 15;
    leftChannelSample += Sound.NR51IsChannel4EnabledOnLeftOutput ? channel4Sample : 15; // Find the sample for the right if enabled
    // other wise add silence (15) for the channel

    rightChannelSample += Sound.NR51IsChannel1EnabledOnRightOutput ? channel1Sample : 15;
    rightChannelSample += Sound.NR51IsChannel2EnabledOnRightOutput ? channel2Sample : 15;
    rightChannelSample += Sound.NR51IsChannel3EnabledOnRightOutput ? channel3Sample : 15;
    rightChannelSample += Sound.NR51IsChannel4EnabledOnRightOutput ? channel4Sample : 15; // Update our accumulator

    SoundAccumulator.mixerEnabledChanged = false;
    SoundAccumulator.needToRemixSamples = false; // Finally multiply our volumes by the mixer volume
    // Mixer volume can be at most 7 + 1
    // Can be at most 7, because we only have 3 bits, 111 = 7
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Mixer
    // Done in the getSampleAsUnsignedByte(), since we are doing some weirdness there :)
    // Convert our samples from unsigned 32 to unsigned byte
    // Reason being, We want to be able to pass in wasm memory as usigned byte. Javascript will handle the conversion back

    var leftChannelSampleUnsignedByte = getSampleAsUnsignedByte(leftChannelSample, Sound.NR50LeftMixerVolume + 1);
    var rightChannelSampleUnsignedByte = getSampleAsUnsignedByte(rightChannelSample, Sound.NR50RightMixerVolume + 1); // Save these samples in the accumulator

    SoundAccumulator.leftChannelSampleUnsignedByte = leftChannelSampleUnsignedByte;
    SoundAccumulator.rightChannelSampleUnsignedByte = rightChannelSampleUnsignedByte;
    return concatenateBytes(leftChannelSampleUnsignedByte, rightChannelSampleUnsignedByte);
  }

  function getSampleAsUnsignedByte(sample, mixerVolume) {
    // If the sample is silence, return silence as unsigned byte
    // Silence is common, and should be checked for performance
    if (sample === 60) {
      return 127;
    } // convert to a signed, precise scale of -6000 to 6000 (cheap way of -1.0 to 1.0)
    // Multiply by the mixer volume fraction (to find the actual volume)


    var precision = 100000;
    var convertedSample = sample - 60;
    convertedSample = convertedSample * precision; // Multiply by the mixer volume fraction (to find the actual volume)

    convertedSample = convertedSample * mixerVolume >> 3; // Convert back to scale of 0 to 120

    convertedSample = i32Portable(convertedSample / precision) + 60; // Finally, convert to an unsigned byte scale
    // With Four Channels (0 to 30) and no global volume. Max is 120
    // max unsigned byte goal is 254 (see blurb at top).
    // 120 / 254 should give the correct conversion
    // For example, 120 / 254 = 0.47244094488188976
    // Multiply by 1000 to increase the float into an int
    // so, 120 * 1000 / (0.47244094488188976 * 1000) should give approximate answer for max mixer volume

    var maxDivider = i32Portable(120 * precision / 254);
    convertedSample = i32Portable(convertedSample * precision / maxDivider); // Ensure we have an i32 and not a float for JS builds

    convertedSample = i32Portable(convertedSample);
    return convertedSample;
  } // Function to set our left and right channels at the correct queue index


  function setLeftAndRightOutputForAudioQueue(leftVolume, rightVolume, bufferLocation) {
    // Get our stereo index
    var audioQueueOffset = bufferLocation + (Sound.audioQueueIndex << 1); // Store our volumes
    // +1 that way we don't have empty data to ensure that the value is set

    store(audioQueueOffset + 0, leftVolume + 1);
    store(audioQueueOffset + 1, rightVolume + 1);
  } // Functions involved in R/W of sound registers
  // Function to check and handle writes to sound registers
  // Inlined because closure compiler inlines
  // NOTE: For write traps, return false = don't write to memory,
  // return true = allow the write to memory


  function SoundRegisterWriteTraps(offset, value) {
    if (offset !== Sound.memoryLocationNR52 && !Sound.NR52IsSoundEnabled) {
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Power_Control
      // When sound is turned off / enabled
      // Block all writes to any sound register EXCEPT NR52!
      // This is under the assumption that the check for
      // offset >= 0xFF10 && offset <= 0xFF26
      // is done in writeTraps.ts (which it is)
      // NOTE: Except on DMG, length can still be written (whatever that means)
      return false;
    }

    switch (offset) {
      // Handle NRx0 on Channels
      case Channel1.memoryLocationNRx0:
        Channel1.updateNRx0(value);
        return true;

      case Channel3.memoryLocationNRx0:
        Channel3.updateNRx0(value);
        return true;
      // Handle NRx1 (Length Counter) on Channels

      case Channel1.memoryLocationNRx1:
        Channel1.updateNRx1(value);
        return true;

      case Channel2.memoryLocationNRx1:
        Channel2.updateNRx1(value);
        return true;

      case Channel3.memoryLocationNRx1:
        Channel3.updateNRx1(value);
        return true;

      case Channel4.memoryLocationNRx1:
        Channel4.updateNRx1(value);
        return true;
      // Handle NRx2 (Envelope / Volume) on Channels

      case Channel1.memoryLocationNRx2:
        Channel1.updateNRx2(value);
        return true;

      case Channel2.memoryLocationNRx2:
        Channel2.updateNRx2(value);
        return true;

      case Channel3.memoryLocationNRx2:
        // Check if channel 3's volume code was written too
        // This is handcy to know for accumulation of samples
        Channel3.volumeCodeChanged = true;
        Channel3.updateNRx2(value);
        return true;

      case Channel4.memoryLocationNRx2:
        Channel4.updateNRx2(value);
        return true;
      // Handle NRx3 (Frequency / Noise Properties) on Channels

      case Channel1.memoryLocationNRx3:
        Channel1.updateNRx3(value);
        return true;

      case Channel2.memoryLocationNRx3:
        Channel2.updateNRx3(value);
        return true;

      case Channel3.memoryLocationNRx3:
        Channel3.updateNRx3(value);
        return true;

      case Channel4.memoryLocationNRx3:
        Channel4.updateNRx3(value);
        return true;
      // Check our NRx4 registers to trap our trigger bits

      case Channel1.memoryLocationNRx4:
        Channel1.updateNRx4(value);
        return true;

      case Channel2.memoryLocationNRx4:
        Channel2.updateNRx4(value);
        return true;

      case Channel3.memoryLocationNRx4:
        Channel3.updateNRx4(value);
        return true;

      case Channel4.memoryLocationNRx4:
        Channel4.updateNRx4(value);
        return true;
      // Tell the sound accumulator if volumes changes

      case Sound.memoryLocationNR50:
        Sound.updateNR50(value);
        SoundAccumulator.mixerVolumeChanged = true;
        return true;
      // Tell the sound accumulator if volumes changes

      case Sound.memoryLocationNR51:
        Sound.updateNR51(value);
        SoundAccumulator.mixerEnabledChanged = true;
        return true;

      case Sound.memoryLocationNR52:
        // Reset all registers except NR52
        // See if we were enabled, then update the register.
        var wasNR52Enabled = Sound.NR52IsSoundEnabled; // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Power_Control
        // When powered on, the frame sequencer is reset so that the next step will be 0,
        // the square duty units are reset to the first step of the waveform,
        // and the wave channel's sample buffer is reset to 0.

        if (!wasNR52Enabled && checkBitOnByte(7, value)) {
          Sound.frameSequencer = 0x07;
          Channel1.waveFormPositionOnDuty = 0x00;
          Channel2.waveFormPositionOnDuty = 0x00; // TODO: Wave Channel Sample Buffer?
          // I don't think we clear wave RAM here...
        } // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Power_Control
        // When powered off, all registers (NR10-NR51) are instantly written with zero
        // and any writes to those registers are ignored while power remains off


        if (wasNR52Enabled && !checkBitOnByte(7, value)) {
          for (var i = 0xff10; i < 0xff26; ++i) {
            eightBitStoreIntoGBMemoryWithTraps(i, 0x00);
          }
        } // Need to update our new value here, that way writes go through :p


        Sound.updateNR52(value);
        return true;
    } // We did not handle the write, Allow the write


    return true;
  } // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
  // Inlined because closure compiler inlines


  function SoundRegisterReadTraps(offset) {
    // Registers must be OR'd with values when being read
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
    switch (offset) {
      // Handle NRx0 on Channels
      case Channel1.memoryLocationNRx0:
        {
          var register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx0);
          return register | 0x80;
        }

      case Channel2.memoryLocationNRx0:
        {
          var register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx0);
          return register | 0xff;
        }

      case Channel3.memoryLocationNRx0:
        {
          var register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx0);
          return register | 0x7f;
        }

      case Channel4.memoryLocationNRx0:
        {
          var register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx0);
          return register | 0xff;
        }

      case Sound.memoryLocationNR50:
        {
          var register = eightBitLoadFromGBMemory(Sound.memoryLocationNR50);
          return register | 0x00;
        }
      // Handle NRx1 on Channels

      case Channel1.memoryLocationNRx1:
        {
          var register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx1);
          return register | 0x3f;
        }

      case Channel2.memoryLocationNRx1:
        {
          var register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx1);
          return register | 0x3f;
        }

      case Channel3.memoryLocationNRx1:
        {
          var register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx1);
          return register | 0xff;
        }

      case Channel4.memoryLocationNRx1:
        {
          var register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx1);
          return register | 0xff;
        }

      case Sound.memoryLocationNR51:
        {
          var register = eightBitLoadFromGBMemory(Sound.memoryLocationNR51);
          return register | 0x00;
        }
      // Handle NRx2 on Channels

      case Channel1.memoryLocationNRx2:
        {
          var register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx2);
          return register | 0x00;
        }

      case Channel2.memoryLocationNRx2:
        {
          var register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx2);
          return register | 0x00;
        }

      case Channel3.memoryLocationNRx2:
        {
          var register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
          return register | 0x9f;
        }

      case Channel4.memoryLocationNRx2:
        {
          var register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx2);
          return register | 0x00;
        }

      case Sound.memoryLocationNR52:
        {
          // This will fix bugs in orcale of ages :)
          // Start our registerNR52
          var registerNR52 = 0x00; // Set the first bit to the sound paower status

          if (Sound.NR52IsSoundEnabled) {
            registerNR52 = setBitOnByte(7, registerNR52);
          } else {
            registerNR52 = resetBitOnByte(7, registerNR52);
          } // Set our lower 4 bits to our channel length statuses


          if (Channel1.isEnabled) {
            registerNR52 = setBitOnByte(0, registerNR52);
          } else {
            registerNR52 = resetBitOnByte(0, registerNR52);
          }

          if (Channel2.isEnabled) {
            registerNR52 = setBitOnByte(1, registerNR52);
          } else {
            registerNR52 = resetBitOnByte(1, registerNR52);
          }

          if (Channel3.isEnabled) {
            registerNR52 = setBitOnByte(2, registerNR52);
          } else {
            registerNR52 = resetBitOnByte(2, registerNR52);
          }

          if (Channel4.isEnabled) {
            registerNR52 = setBitOnByte(3, registerNR52);
          } else {
            registerNR52 = resetBitOnByte(3, registerNR52);
          } // Or from the table


          registerNR52 |= 0x70;
          return registerNR52;
        }
      // Handle NRx3 on Channels

      case Channel1.memoryLocationNRx3:
        {
          var register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx3);
          return register | 0xff;
        }

      case Channel2.memoryLocationNRx3:
        {
          var register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx3);
          return register | 0xff;
        }

      case Channel3.memoryLocationNRx3:
        {
          var register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx3);
          return register | 0xff;
        }

      case Channel4.memoryLocationNRx3:
        {
          var register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx3);
          return register | 0x00;
        }
      // Handle NRx4 on Channels

      case Channel1.memoryLocationNRx4:
        {
          var register = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx4);
          return register | 0xbf;
        }

      case Channel2.memoryLocationNRx4:
        {
          var register = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx4);
          return register | 0xbf;
        }

      case Channel3.memoryLocationNRx4:
        {
          var register = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx4);
          return register | 0xbf;
        }

      case Channel4.memoryLocationNRx4:
        {
          var register = eightBitLoadFromGBMemory(Channel4.memoryLocationNRx4);
          return register | 0xbf;
        }
    }

    return -1;
  }

  var Interrupts =
  /** @class */
  function () {
    function Interrupts() {}

    Interrupts.updateInterruptEnabled = function (value) {
      Interrupts.isVBlankInterruptEnabled = checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, value);
      Interrupts.isLcdInterruptEnabled = checkBitOnByte(Interrupts.bitPositionLcdInterrupt, value);
      Interrupts.isTimerInterruptEnabled = checkBitOnByte(Interrupts.bitPositionTimerInterrupt, value);
      Interrupts.isSerialInterruptEnabled = checkBitOnByte(Interrupts.bitPositionSerialInterrupt, value);
      Interrupts.isJoypadInterruptEnabled = checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, value);
      Interrupts.interruptsEnabledValue = value;
    };

    Interrupts.updateInterruptRequested = function (value) {
      Interrupts.isVBlankInterruptRequested = checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, value);
      Interrupts.isLcdInterruptRequested = checkBitOnByte(Interrupts.bitPositionLcdInterrupt, value);
      Interrupts.isTimerInterruptRequested = checkBitOnByte(Interrupts.bitPositionTimerInterrupt, value);
      Interrupts.isSerialInterruptRequested = checkBitOnByte(Interrupts.bitPositionSerialInterrupt, value);
      Interrupts.isJoypadInterruptRequested = checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, value);
      Interrupts.interruptsRequestedValue = value;
    }; // Function to return if we have any pending interrupts


    Interrupts.areInterruptsPending = function () {
      return (Interrupts.interruptsRequestedValue & Interrupts.interruptsEnabledValue & 0x1f) > 0;
    }; // Function to save the state of the class


    Interrupts.saveState = function () {
      // Interrupt Master Interrupt Switch
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Interrupts.saveStateSlot), Interrupts.masterInterruptSwitch);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x01, Interrupts.saveStateSlot), Interrupts.masterInterruptSwitchDelay); // Interrupt Enabled

      store(getSaveStateMemoryOffset(0x10, Interrupts.saveStateSlot), Interrupts.interruptsEnabledValue);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Interrupts.saveStateSlot), Interrupts.isVBlankInterruptEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x12, Interrupts.saveStateSlot), Interrupts.isLcdInterruptEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x13, Interrupts.saveStateSlot), Interrupts.isTimerInterruptEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x14, Interrupts.saveStateSlot), Interrupts.isSerialInterruptEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x15, Interrupts.saveStateSlot), Interrupts.isJoypadInterruptEnabled); // Interrupt Request

      store(getSaveStateMemoryOffset(0x20, Interrupts.saveStateSlot), Interrupts.interruptsRequestedValue);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x21, Interrupts.saveStateSlot), Interrupts.isVBlankInterruptRequested);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x22, Interrupts.saveStateSlot), Interrupts.isLcdInterruptRequested);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x23, Interrupts.saveStateSlot), Interrupts.isTimerInterruptRequested);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x24, Interrupts.saveStateSlot), Interrupts.isSerialInterruptRequested);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x25, Interrupts.saveStateSlot), Interrupts.isJoypadInterruptRequested);
    }; // Function to load the save state from memory


    Interrupts.loadState = function () {
      // Interrupt Master Interrupt Switch
      Interrupts.masterInterruptSwitch = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Interrupts.saveStateSlot));
      Interrupts.masterInterruptSwitchDelay = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x01, Interrupts.saveStateSlot)); // Interrupt Enabled

      Interrupts.interruptsEnabledValue = load(getSaveStateMemoryOffset(0x10, Interrupts.saveStateSlot));
      Interrupts.isVBlankInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Interrupts.saveStateSlot));
      Interrupts.isLcdInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x12, Interrupts.saveStateSlot));
      Interrupts.isTimerInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x13, Interrupts.saveStateSlot));
      Interrupts.isSerialInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x14, Interrupts.saveStateSlot));
      Interrupts.isJoypadInterruptEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x15, Interrupts.saveStateSlot)); // Interrupt Request

      Interrupts.interruptsRequestedValue = load(getSaveStateMemoryOffset(0x20, Interrupts.saveStateSlot));
      Interrupts.isVBlankInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x21, Interrupts.saveStateSlot));
      Interrupts.isLcdInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x22, Interrupts.saveStateSlot));
      Interrupts.isTimerInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x23, Interrupts.saveStateSlot));
      Interrupts.isSerialInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x24, Interrupts.saveStateSlot));
      Interrupts.isJoypadInterruptRequested = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x25, Interrupts.saveStateSlot));
    };

    Interrupts.masterInterruptSwitch = false; // According to mooneye, interrupts are not handled until AFTER
    // Next instruction
    // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown

    Interrupts.masterInterruptSwitchDelay = false; // Biut position for each part of the interrupts HW registers

    Interrupts.bitPositionVBlankInterrupt = 0;
    Interrupts.bitPositionLcdInterrupt = 1;
    Interrupts.bitPositionTimerInterrupt = 2;
    Interrupts.bitPositionSerialInterrupt = 3;
    Interrupts.bitPositionJoypadInterrupt = 4;
    Interrupts.memoryLocationInterruptEnabled = 0xffff; // A.K.A interrupt Flag (IE)
    // Cache which Interrupts are enabled

    Interrupts.interruptsEnabledValue = 0;
    Interrupts.isVBlankInterruptEnabled = false;
    Interrupts.isLcdInterruptEnabled = false;
    Interrupts.isTimerInterruptEnabled = false;
    Interrupts.isSerialInterruptEnabled = false;
    Interrupts.isJoypadInterruptEnabled = false;
    Interrupts.memoryLocationInterruptRequest = 0xff0f; // A.K.A interrupt Flag (IF)
    // Cache which Interrupts are requested

    Interrupts.interruptsRequestedValue = 0;
    Interrupts.isVBlankInterruptRequested = false;
    Interrupts.isLcdInterruptRequested = false;
    Interrupts.isTimerInterruptRequested = false;
    Interrupts.isSerialInterruptRequested = false;
    Interrupts.isJoypadInterruptRequested = false; // Save States

    Interrupts.saveStateSlot = 2;
    return Interrupts;
  }(); // Inlined because closure compiler inlines


  function initializeInterrupts() {
    // Values from BGB
    // IE
    Interrupts.updateInterruptEnabled(0x00);
    eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptEnabled, Interrupts.interruptsEnabledValue); // IF

    Interrupts.updateInterruptRequested(0xe1);
    eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, Interrupts.interruptsRequestedValue);
  } // NOTE: Interrupts should be handled before reading an opcode
  // Inlined because closure compiler inlines


  function checkInterrupts() {
    // First check for our delay was enabled
    if (Interrupts.masterInterruptSwitchDelay) {
      Interrupts.masterInterruptSwitch = true;
      Interrupts.masterInterruptSwitchDelay = false;
    } // Check if we have an enabled and requested interrupt


    var isAnInterruptRequestedAndEnabledValue = Interrupts.interruptsEnabledValue & Interrupts.interruptsRequestedValue & 0x1f;

    if (isAnInterruptRequestedAndEnabledValue > 0) {
      // Boolean to track if interrupts were handled
      // Interrupt handling requires 20 cycles
      // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
      var wasInterruptHandled = false; // Service our interrupts, if we have the master switch enabled
      // https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/

      if (Interrupts.masterInterruptSwitch && !Cpu.isHaltNoJump) {
        if (Interrupts.isVBlankInterruptEnabled && Interrupts.isVBlankInterruptRequested) {
          _handleInterrupt(Interrupts.bitPositionVBlankInterrupt);

          wasInterruptHandled = true;
        } else if (Interrupts.isLcdInterruptEnabled && Interrupts.isLcdInterruptRequested) {
          _handleInterrupt(Interrupts.bitPositionLcdInterrupt);

          wasInterruptHandled = true;
        } else if (Interrupts.isTimerInterruptEnabled && Interrupts.isTimerInterruptRequested) {
          _handleInterrupt(Interrupts.bitPositionTimerInterrupt);

          wasInterruptHandled = true;
        } else if (Interrupts.isSerialInterruptEnabled && Interrupts.isSerialInterruptRequested) {
          _handleInterrupt(Interrupts.bitPositionSerialInterrupt);

          wasInterruptHandled = true;
        } else if (Interrupts.isJoypadInterruptEnabled && Interrupts.isJoypadInterruptRequested) {
          _handleInterrupt(Interrupts.bitPositionJoypadInterrupt);

          wasInterruptHandled = true;
        }
      }

      var interuptHandlerCycles = 0;

      if (wasInterruptHandled) {
        // Interrupt handling requires 20 cycles, TCAGBD
        interuptHandlerCycles = 20;

        if (Cpu.isHalted()) {
          // If the CPU was halted, now is the time to un-halt
          // Should be done here when the jump occurs according to:
          // https://www.reddit.com/r/EmuDev/comments/6fmjch/gb_glitches_in_links_awakening_and_pok%C3%A9mon_gold/
          Cpu.exitHaltAndStop();
          interuptHandlerCycles += 4;
        }
      }

      if (Cpu.isHalted()) {
        Cpu.exitHaltAndStop();
      }

      return interuptHandlerCycles;
    }

    return 0;
  }

  function _handleInterrupt(bitPosition) {
    // Disable the master switch
    setInterrupts(false); // Disable the bit on the interruptRequest

    var interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);
    interruptRequest = resetBitOnByte(bitPosition, interruptRequest);
    Interrupts.interruptsRequestedValue = interruptRequest;
    eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, interruptRequest); // Push the programCounter onto the stacks
    // Push the next instruction, not the halt itself (TCAGBD).

    Cpu.stackPointer = Cpu.stackPointer - 2;

    if (Cpu.isHalted()) {
      // TODO: This breaks Pokemon Yellow, And OG Link's awakening. Find out why...
      // sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
    } else {
      sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
    } // Jump to the correct interrupt location
    // Also piggyback off of the switch to reset our HW Register caching
    // http://www.codeslinger.co.uk/pages/projects/gameboy/interupts.html


    switch (bitPosition) {
      case Interrupts.bitPositionVBlankInterrupt:
        Interrupts.isVBlankInterruptRequested = false;
        Cpu.programCounter = 0x40;
        break;

      case Interrupts.bitPositionLcdInterrupt:
        Interrupts.isLcdInterruptRequested = false;
        Cpu.programCounter = 0x48;
        break;

      case Interrupts.bitPositionTimerInterrupt:
        Interrupts.isTimerInterruptRequested = false;
        Cpu.programCounter = 0x50;
        break;

      case Interrupts.bitPositionSerialInterrupt:
        Interrupts.isSerialInterruptRequested = false;
        Cpu.programCounter = 0x58;
        break;

      case Interrupts.bitPositionJoypadInterrupt:
        Interrupts.isJoypadInterruptRequested = false;
        Cpu.programCounter = 0x60;
        break;
    }
  }

  function _requestInterrupt(bitPosition) {
    var interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest); // Pass to set the correct interrupt bit on interruptRequest

    interruptRequest = setBitOnByte(bitPosition, interruptRequest);
    Interrupts.interruptsRequestedValue = interruptRequest;
    eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, interruptRequest);
  }

  function setInterrupts(value) {
    // If we are enabling interrupts,
    // we want to wait 4 cycles before enabling
    if (value) {
      Interrupts.masterInterruptSwitchDelay = true;
    } else {
      Interrupts.masterInterruptSwitch = false;
    }
  } // Inlined because closure compiler inlines


  function requestVBlankInterrupt() {
    Interrupts.isVBlankInterruptRequested = true;

    _requestInterrupt(Interrupts.bitPositionVBlankInterrupt);
  } // Inlined because closure compiler inlines


  function requestLcdInterrupt() {
    Interrupts.isLcdInterruptRequested = true;

    _requestInterrupt(Interrupts.bitPositionLcdInterrupt);
  } // Inlined because closure compiler inlines


  function requestTimerInterrupt() {
    Interrupts.isTimerInterruptRequested = true;

    _requestInterrupt(Interrupts.bitPositionTimerInterrupt);
  } // Inlined because closure compiler inlines


  function requestJoypadInterrupt() {
    Interrupts.isJoypadInterruptRequested = true;

    _requestInterrupt(Interrupts.bitPositionJoypadInterrupt);
  } // Inlined because closure compiler inlines


  function requestSerialInterrupt() {
    Interrupts.isSerialInterruptRequested = true;

    _requestInterrupt(Interrupts.bitPositionSerialInterrupt);
  }

  var Timers =
  /** @class */
  function () {
    function Timers() {} // Number of cycles to run in each batch process


    Timers.batchProcessCycles = function () {
      return 256;
    };

    Timers.updateDividerRegister = function () {
      var oldDividerRegister = Timers.dividerRegister;
      Timers.dividerRegister = 0;
      eightBitStoreIntoGBMemory(Timers.memoryLocationDividerRegister, 0);

      if (Timers.timerEnabled && _checkDividerRegisterFallingEdgeDetector(oldDividerRegister, 0)) {
        _incrementTimerCounter();
      }
    };

    Timers.updateTimerCounter = function (value) {
      if (Timers.timerEnabled) {
        // From binjgb, dont write TIMA if we were just reset
        if (Timers.timerCounterWasReset) {
          return;
        } // Mooneye Test, tima_write_reloading
        // Writing in this strange delay cycle, will cancel
        // Both the interrupt and the TMA reload


        if (Timers.timerCounterOverflowDelay) {
          Timers.timerCounterOverflowDelay = false;
        }
      }

      Timers.timerCounter = value;
    };

    Timers.updateTimerModulo = function (value) {
      Timers.timerModulo = value; // Mooneye Test, tma_write_reloading
      // Don't update if we were reloading

      if (Timers.timerEnabled && Timers.timerCounterWasReset) {
        Timers.timerCounter = value;
        Timers.timerCounterWasReset = false;
      }
    };

    Timers.updateTimerControl = function (value) {
      // Get some initial values
      var oldTimerEnabled = Timers.timerEnabled;
      Timers.timerEnabled = checkBitOnByte(2, value);
      var newTimerInputClock = value & 0x03; // Do some obscure behavior for if we should increment TIMA
      // This does the timer increments from rapid_toggle mooneye tests

      if (!oldTimerEnabled) {
        var oldTimerCounterMaskBit = _getTimerCounterMaskBit(Timers.timerInputClock);

        var newTimerCounterMaskBit = _getTimerCounterMaskBit(newTimerInputClock);

        var shouldIncrementTimerCounter = false;
        var dividerRegister = Timers.dividerRegister;

        if (Timers.timerEnabled) {
          shouldIncrementTimerCounter = checkBitOnByte(oldTimerCounterMaskBit, dividerRegister);
        } else {
          shouldIncrementTimerCounter = checkBitOnByte(oldTimerCounterMaskBit, dividerRegister) && checkBitOnByte(newTimerCounterMaskBit, dividerRegister);
        }

        if (shouldIncrementTimerCounter) {
          _incrementTimerCounter();
        }
      }

      Timers.timerInputClock = newTimerInputClock;
    }; // Function to save the state of the class
    // TODO: Save state for new properties on Timers


    Timers.saveState = function () {
      // Batch Processing
      store(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot), Timers.currentCycles); // Divider Register

      store(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot), Timers.dividerRegister); // Timer Counter

      store(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot), Timers.timerCounter);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0c, Timers.saveStateSlot), Timers.timerCounterOverflowDelay);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Timers.saveStateSlot), Timers.timerCounterWasReset);
      store(getSaveStateMemoryOffset(0x0e, Timers.saveStateSlot), Timers.timerCounterMask); // Timer Modulo

      store(getSaveStateMemoryOffset(0x12, Timers.saveStateSlot), Timers.timerModulo); // Timer Control

      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x16, Timers.saveStateSlot), Timers.timerEnabled);
      store(getSaveStateMemoryOffset(0x17, Timers.saveStateSlot), Timers.timerInputClock);
    }; // Function to load the save state from memory


    Timers.loadState = function () {
      // Batch Processing
      Timers.currentCycles = load(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot)); // Divider Register

      Timers.dividerRegister = load(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot)); // Timer Counter

      Timers.timerCounter = load(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot));
      Timers.timerCounterOverflowDelay = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0c, Timers.saveStateSlot));
      Timers.timerCounterWasReset = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Timers.saveStateSlot));
      Timers.timerCounterMask = load(getSaveStateMemoryOffset(0x0e, Timers.saveStateSlot)); // Timer Modulo

      Timers.timerModulo = load(getSaveStateMemoryOffset(0x12, Timers.saveStateSlot)); // Timer Control

      Timers.timerEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x16, Timers.saveStateSlot));
      Timers.timerInputClock = load(getSaveStateMemoryOffset(0x17, Timers.saveStateSlot));
    }; // Current cycles
    // This will be used for batch processing


    Timers.currentCycles = 0; // Divider Register = DIV
    // Divider Register is 16 bits.
    // Divider Register when read is just the upper 8 bits
    // But internally is used as the full 16
    // Essentially dividerRegister is an always counting clock
    // DIV Drives everything, it is the heart of the timer.
    // All other timing registers base them selves relative to the DIV register
    // Think of the div register as like a cycle counter :)
    // DIV will increment TIMA, whenever there is a falling edge, see below for that.

    Timers.memoryLocationDividerRegister = 0xff04; // DIV

    Timers.dividerRegister = 0; // timerCounter = TIMA
    // TIMA is the actual counter.
    // Whenever the DIV gets the falling edge, and other obscure cases,
    // This is incremented. When this overflows, we need to fire an interrupt.

    Timers.memoryLocationTimerCounter = 0xff05;
    Timers.timerCounter = 0;
    Timers.timerCounterOverflowDelay = false;
    Timers.timerCounterWasReset = false;
    Timers.timerCounterMask = 0; // Timer Modulo = TMA
    // TMA is what TIMA (Notice the I :p) is counting from, and TIMA will load
    // Whenever TIMA overflow.
    // For instance, we count like 1,2,3,4,5,6,7,8,9, and then overflow to 10.
    // TMA would be like "Hey, start counting from 5 whenever we reset"
    // Then we would be like 5,6,7,8,9...5,6,7,8,9...etc...

    Timers.memoryLocationTimerModulo = 0xff06;
    Timers.timerModulo = 0; // Timer Control = TAC
    // TAC Says how fast we are counting.
    // TAC controls which bit we are watching for the falling edge on the DIV register
    // And whenever the bit has the falling edge, we increment TIMA (The thing counting).
    // Therefore, depending on the value, we will either count faster or slower.

    Timers.memoryLocationTimerControl = 0xff07; // Bit 2    - Timer Stop  (0=Stop, 1=Start)
    // Bits 1-0 - Input Clock Select
    //            00:   4096 Hz    (~4194 Hz SGB) (1024 cycles)
    //            01: 262144 Hz  (~268400 Hz SGB) (16 cycles)
    //            10:  65536 Hz   (~67110 Hz SGB) (64 cycles)
    //            11:  16384 Hz   (~16780 Hz SGB) (256 cycles)

    Timers.timerEnabled = false;
    Timers.timerInputClock = 0; // Save States

    Timers.saveStateSlot = 5;
    return Timers;
  }(); // Inlined because closure compiler inlines


  function initializeTimers() {
    // Reset stateful Variables
    Timers.currentCycles = 0;
    Timers.dividerRegister = 0;
    Timers.timerCounter = 0;
    Timers.timerModulo = 0;
    Timers.timerEnabled = false;
    Timers.timerInputClock = 0;
    Timers.timerCounterOverflowDelay = false;
    Timers.timerCounterWasReset = false;

    if (Cpu.GBCEnabled) {
      // DIV
      eightBitStoreIntoGBMemory(0xff04, 0x1e);
      Timers.dividerRegister = 0x1ea0; // 0xFF05 -> 0xFF06 = 0x00
      // TAC

      eightBitStoreIntoGBMemory(0xff07, 0xf8);
      Timers.timerInputClock = 0xf8;
    } else {
      // DIV
      eightBitStoreIntoGBMemory(0xff04, 0xab);
      Timers.dividerRegister = 0xabcc; // 0xFF05 -> 0xFF06 = 0x00
      // TAC

      eightBitStoreIntoGBMemory(0xff07, 0xf8);
      Timers.timerInputClock = 0xf8;
    } // Override/reset some variables if the boot ROM is enabled


    if (Cpu.BootROMEnabled) {
      if (Cpu.GBCEnabled) ;else {
        // GB
        // DIV
        eightBitStoreIntoGBMemory(0xff04, 0x00);
        Timers.dividerRegister = 0x0004;
      }
    }
  } // Batch Process Timers
  // Only checked on writes
  // Function to batch process our Timers after we skipped so many cycles


  function batchProcessTimers() {
    // TODO: Did a timer rewrite, make a proper batch processing
    // For timers
    updateTimers(Timers.currentCycles);
    Timers.currentCycles = 0;
  }

  function updateTimers(numberOfCycles) {
    // Want to increment 4 cycles at a time like an actual GB would
    var cyclesIncreased = 0;

    while (cyclesIncreased < numberOfCycles) {
      var oldDividerRegister = Timers.dividerRegister;
      var curDividerRegister = oldDividerRegister;
      cyclesIncreased += 4;
      curDividerRegister += 4;
      curDividerRegister &= 0xffff;
      Timers.dividerRegister = curDividerRegister;

      if (Timers.timerEnabled) {
        var timerCounterWasReset = Timers.timerCounterWasReset;

        if (Timers.timerCounterOverflowDelay) {
          Timers.timerCounter = Timers.timerModulo; // Fire off timer interrupt

          requestTimerInterrupt();
          Timers.timerCounterOverflowDelay = false;
          Timers.timerCounterWasReset = true;
        } else if (timerCounterWasReset) {
          Timers.timerCounterWasReset = false;
        }

        if (_checkDividerRegisterFallingEdgeDetector(oldDividerRegister, curDividerRegister)) {
          _incrementTimerCounter();
        }
      }
    }
  } // Function to increment our Timer Counter
  // This fires off interrupts once we overflow


  function _incrementTimerCounter() {
    var counter = Timers.timerCounter;

    if (++counter > 255) {
      // Whenever the timer overflows, there is a slight delay (4 cycles)
      // Of when TIMA gets TMA's value, and the interrupt is fired.
      // Thus we will set the delay, which can be handled in the update timer or write trap
      Timers.timerCounterOverflowDelay = true;
      counter = 0;
    }

    Timers.timerCounter = counter;
  } // Function to act as our falling edge detector
  // Whenever we have a falling edge, we need to increment TIMA
  // http://gbdev.gg8.se/wiki/articles/Timer_Obscure_Behaviour
  // https://github.com/binji/binjgb/blob/master/src/emulator.c#L1944


  function _checkDividerRegisterFallingEdgeDetector(oldDividerRegister, newDividerRegister) {
    // Get our mask
    var timerCounterMaskBit = _getTimerCounterMaskBit(Timers.timerInputClock); // If the old register's watched bit was zero,
    // but after adding the new registers wastch bit is now 1


    return checkBitOnByte(timerCounterMaskBit, oldDividerRegister) && !checkBitOnByte(timerCounterMaskBit, newDividerRegister);
  } // Function to get our current tima mask bit
  // used for our falling edge detector
  // See The docs linked above, or TCAGB for this bit mapping


  function _getTimerCounterMaskBit(timerInputClock) {
    switch (timerInputClock) {
      case 0x00:
        return 9;

      case 0x01:
        return 3;

      case 0x02:
        return 5;

      case 0x03:
        return 7;
    }

    return 0;
  } // Link cable / serial implementation


  var Serial =
  /** @class */
  function () {
    function Serial() {}

    Serial.updateTransferControl = function (value) {
      Serial.isShiftClockInternal = checkBitOnByte(0, value);
      Serial.isClockSpeedFast = checkBitOnByte(1, value);
      Serial.transferStartFlag = checkBitOnByte(7, value); // Allow the original write, and return since we dont need to look anymore

      return true;
    }; // Cycle counter


    Serial.currentCycles = 0x00; // Register locations

    Serial.memoryLocationSerialTransferData = 0xff01; // SB

    Serial.memoryLocationSerialTransferControl = 0xff02; // SC
    // Number of bits transferred

    Serial.numberOfBitsTransferred = 0; // Transfer control variables

    Serial.isShiftClockInternal = false;
    Serial.isClockSpeedFast = false;
    Serial.transferStartFlag = false;
    return Serial;
  }(); // Function to initialize our serial values
  // Inlined because closure compiler inlines


  function initializeSerial() {
    Serial.currentCycles = 0x00;
    Serial.numberOfBitsTransferred = 0;

    if (Cpu.GBCEnabled) {
      // FF01 = 0x00
      eightBitStoreIntoGBMemory(0xff02, 0x7c);
      Serial.updateTransferControl(0x7c);
    } else {
      // FF01 = 0x00
      eightBitStoreIntoGBMemory(0xff02, 0x7e);
      Serial.updateTransferControl(0x7e);
    }
  } // TODO: Finish serial
  // See minimal serial: https://github.com/binji/binjgb/commit/64dece05c4ef5a052c4b9b75eb3ddbbfc6677cbe
  // Inlined because closure compiler inlines


  function updateSerial(numberOfCycles) {
    // If we aren't starting our transfer, or transferring,
    // return
    if (!Serial.transferStartFlag) {
      return;
    } // Want to increment 4 cycles at a time like an actual GB would


    var cyclesIncreased = 0;

    while (cyclesIncreased < numberOfCycles) {
      var oldCycles = Serial.currentCycles;
      var curCycles = oldCycles;
      cyclesIncreased += 4;
      curCycles += 4;

      if (curCycles > 0xffff) {
        curCycles -= 0x10000;
      }

      Serial.currentCycles = curCycles;

      if (_checkFallingEdgeDetector(oldCycles, curCycles)) {
        // TODO: Since no actual connection, always transfer 1
        // Need to fix this
        var memoryLocationSerialTransferData = Serial.memoryLocationSerialTransferData;
        var transferData = eightBitLoadFromGBMemory(memoryLocationSerialTransferData);
        transferData = (transferData << 1) + 1;
        transferData = transferData & 0xff;
        eightBitStoreIntoGBMemory(memoryLocationSerialTransferData, transferData);
        var numberOfBitsTransferred = Serial.numberOfBitsTransferred;

        if (++numberOfBitsTransferred === 8) {
          Serial.numberOfBitsTransferred = 0;
          requestSerialInterrupt(); // Disable transfer start

          var memoryLocationSerialTransferControl = Serial.memoryLocationSerialTransferControl;
          var transferControl = eightBitLoadFromGBMemory(memoryLocationSerialTransferControl);
          eightBitStoreIntoGBMemory(memoryLocationSerialTransferControl, resetBitOnByte(7, transferControl));
          Serial.transferStartFlag = false;
        } else {
          Serial.numberOfBitsTransferred = numberOfBitsTransferred;
        }
      }
    }
  } // Inlined because closure compiler inlines


  function _checkFallingEdgeDetector(oldCycles, newCycles) {
    // Get our mask
    var maskBit = _getFallingEdgeMaskBit(); // If the old register's watched bit was zero,
    // but after adding the new registers wastch bit is now 1


    return checkBitOnByte(maskBit, oldCycles) && !checkBitOnByte(maskBit, newCycles);
  } // Function to get our current tima mask bit
  // used for our falling edge detector
  // See The docs linked above, or TCAGB for this bit mapping
  // Inlined because closure compiler inlines


  function _getFallingEdgeMaskBit() {
    return Serial.isClockSpeedFast ? 2 : 7;
  } // http://www.codeslinger.co.uk/pages/projects/gameboy/joypad.html
  // Joypad Register
  // Taken from pandocs
  // Bit 7 - Not used
  // Bit 6 - Not used
  // Bit 5 - P15 Select Button Keys (0=Select)
  // Bit 4 - P14 Select Direction Keys (0=Select)
  // Bit 3 - P13 Input Down or Start (0=Pressed) (Read Only)
  // Bit 2 - P12 Input Up or Select (0=Pressed) (Read Only)
  // Bit 1 - P11 Input Left or Button B (0=Pressed) (Read Only)
  // Bit 0 - P10 Input Right or Button A (0=Pressed) (Read Only)
  // Button Ids will be the following:
  // UP - 0
  // RIGHT - 1
  // DOWN - 2
  // LEFT - 3
  // A - 4
  // B - 5
  // SELECT - 6
  // START - 7


  var Joypad =
  /** @class */
  function () {
    function Joypad() {}

    Joypad.updateJoypad = function (value) {
      Joypad.joypadRegisterFlipped = value ^ 0xff;
      Joypad.isDpadType = checkBitOnByte(4, Joypad.joypadRegisterFlipped);
      Joypad.isButtonType = checkBitOnByte(5, Joypad.joypadRegisterFlipped);
    }; // Function to save the state of the class


    Joypad.saveState = function () {
      store(getSaveStateMemoryOffset(0x00, Joypad.saveStateSlot), Joypad.joypadRegisterFlipped);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x01, Joypad.saveStateSlot), Joypad.isDpadType);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x02, Joypad.saveStateSlot), Joypad.isButtonType);
    }; // Function to load the save state from memory


    Joypad.loadState = function () {
      Joypad.joypadRegisterFlipped = load(getSaveStateMemoryOffset(0x00, Joypad.saveStateSlot));
      Joypad.isDpadType = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x01, Joypad.saveStateSlot));
      Joypad.isButtonType = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x02, Joypad.saveStateSlot));
    };

    Joypad.up = false;
    Joypad.down = false;
    Joypad.left = false;
    Joypad.right = false;
    Joypad.a = false;
    Joypad.b = false;
    Joypad.select = false;
    Joypad.start = false;
    Joypad.memoryLocationJoypadRegister = 0xff00; // Cache some values on the Joypad register

    Joypad.joypadRegisterFlipped = 0;
    Joypad.isDpadType = false;
    Joypad.isButtonType = false; // Save States
    // Not doing anything for Joypad for now

    Joypad.saveStateSlot = 3;
    return Joypad;
  }(); // Inlined because closure compiler inlines


  function getJoypadState() {
    // Get the joypad register
    var joypadRegister = Joypad.joypadRegisterFlipped;

    if (Joypad.isDpadType) {
      // D-pad buttons
      // Up
      if (Joypad.up) {
        joypadRegister = resetBitOnByte(2, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(2, joypadRegister);
      } // Right


      if (Joypad.right) {
        joypadRegister = resetBitOnByte(0, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(0, joypadRegister);
      } // Down


      if (Joypad.down) {
        joypadRegister = resetBitOnByte(3, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(3, joypadRegister);
      } // Left


      if (Joypad.left) {
        joypadRegister = resetBitOnByte(1, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(1, joypadRegister);
      }
    } else if (Joypad.isButtonType) {
      // A
      if (Joypad.a) {
        joypadRegister = resetBitOnByte(0, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(0, joypadRegister);
      } // B


      if (Joypad.b) {
        joypadRegister = resetBitOnByte(1, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(1, joypadRegister);
      } // Select


      if (Joypad.select) {
        joypadRegister = resetBitOnByte(2, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(2, joypadRegister);
      } // Start


      if (Joypad.start) {
        joypadRegister = resetBitOnByte(3, joypadRegister);
      } else {
        joypadRegister = setBitOnByte(3, joypadRegister);
      }
    } // Set the top 4 bits to on


    joypadRegister = joypadRegister | 0xf0;
    return joypadRegister;
  }

  function setJoypadState(up, right, down, left, a, b, select, start) {
    if (up > 0) {
      _pressJoypadButton(0);
    } else {
      _releaseJoypadButton(0);
    }

    if (right > 0) {
      _pressJoypadButton(1);
    } else {
      _releaseJoypadButton(1);
    }

    if (down > 0) {
      _pressJoypadButton(2);
    } else {
      _releaseJoypadButton(2);
    }

    if (left > 0) {
      _pressJoypadButton(3);
    } else {
      _releaseJoypadButton(3);
    }

    if (a > 0) {
      _pressJoypadButton(4);
    } else {
      _releaseJoypadButton(4);
    }

    if (b > 0) {
      _pressJoypadButton(5);
    } else {
      _releaseJoypadButton(5);
    }

    if (select > 0) {
      _pressJoypadButton(6);
    } else {
      _releaseJoypadButton(6);
    }

    if (start > 0) {
      _pressJoypadButton(7);
    } else {
      _releaseJoypadButton(7);
    }
  }

  function _pressJoypadButton(buttonId) {
    // Un stop the CPU
    Cpu.isStopped = false; // Check if the button state changed from not pressed

    var isButtonStateChanging = false;

    if (!_getJoypadButtonStateFromButtonId(buttonId)) {
      isButtonStateChanging = true;
    } // Set our joypad state


    _setJoypadButtonStateFromButtonId(buttonId, true); // If the button state is changing, check for an interrupt


    if (isButtonStateChanging) {
      // Determine if it is a button or a dpad button
      var isDpadTypeButton = false;

      if (buttonId <= 3) {
        isDpadTypeButton = true;
      } // Determine if we should request an interrupt


      var shouldRequestInterrupt = false; // Check if the game is looking for a dpad type button press

      if (Joypad.isDpadType && isDpadTypeButton) {
        shouldRequestInterrupt = true;
      } // Check if the game is looking for a button type button press


      if (Joypad.isButtonType && !isDpadTypeButton) {
        shouldRequestInterrupt = true;
      } // Finally, request the interrupt, if the button state actually changed


      if (shouldRequestInterrupt) {
        requestJoypadInterrupt();
      }
    }
  } // Inlined because closure compiler inlines


  function _releaseJoypadButton(buttonId) {
    // Set our joypad state
    _setJoypadButtonStateFromButtonId(buttonId, false);
  }

  function _getJoypadButtonStateFromButtonId(buttonId) {
    switch (buttonId) {
      case 0:
        return Joypad.up;

      case 1:
        return Joypad.right;

      case 2:
        return Joypad.down;

      case 3:
        return Joypad.left;

      case 4:
        return Joypad.a;

      case 5:
        return Joypad.b;

      case 6:
        return Joypad.select;

      case 7:
        return Joypad.start;

      default:
        return false;
    }
  }

  function _setJoypadButtonStateFromButtonId(buttonId, isPressed) {
    switch (buttonId) {
      case 0:
        Joypad.up = isPressed;
        break;

      case 1:
        Joypad.right = isPressed;
        break;

      case 2:
        Joypad.down = isPressed;
        break;

      case 3:
        Joypad.left = isPressed;
        break;

      case 4:
        Joypad.a = isPressed;
        break;

      case 5:
        Joypad.b = isPressed;
        break;

      case 6:
        Joypad.select = isPressed;
        break;

      case 7:
        Joypad.start = isPressed;
        break;
    }
  } // Function to handle rom/rambanking
  // Inlined because closure compiler inlines


  function handleBanking(offset, value) {
    // Is rom Only does not bank
    if (Memory.isRomOnly) {
      return;
    }

    var isMBC1 = Memory.isMBC1;
    var isMBC2 = Memory.isMBC2; // Enable Ram Banking

    if (offset <= 0x1fff) {
      if (isMBC2 && !checkBitOnByte(4, value)) {
        // Do Nothing
        return;
      } else {
        var romEnableByte = value & 0x0f;

        if (romEnableByte === 0x00) {
          Memory.isRamBankingEnabled = false;
        } else if (romEnableByte === 0x0a) {
          Memory.isRamBankingEnabled = true;
        }
      }
    } else if (offset <= 0x3fff) {
      var isMBC5 = Memory.isMBC5;

      if (!isMBC5 || offset <= 0x2fff) {
        // Change Low Bits on the Current Rom Bank
        var currentRomBank = Memory.currentRomBank;

        if (isMBC2) {
          currentRomBank = value & 0x0f;
        } // Set the number of bottom bytes from the MBC type


        var romBankLowerBits = value;

        if (isMBC1) {
          // Only want the bottom 5
          romBankLowerBits = romBankLowerBits & 0x1f;
          currentRomBank &= 0xe0;
        } else if (Memory.isMBC3) {
          // Only Want the bottom 7
          romBankLowerBits = romBankLowerBits & 0x7f;
          currentRomBank &= 0x80;
        } else if (isMBC5) {
          // Going to switch the whole thing
          currentRomBank &= 0x00;
        } // Set the lower bytes


        currentRomBank |= romBankLowerBits;
        Memory.currentRomBank = currentRomBank;
        return;
      } else {
        // TODO: MBC5 High bits Rom bank, check if this works, not sure about the value
        var lowByte = splitLowByte(Memory.currentRomBank);
        var highByte = value > 0;
        Memory.currentRomBank = concatenateBytes(highByte, lowByte);
      }
    } else if (!isMBC2 && offset <= 0x5fff) {
      // ROM / RAM Banking, MBC2 doesn't do this
      if (isMBC1 && Memory.isMBC1RomModeEnabled) {
        // Do an upper bit rom bank for MBC 1
        // Remove upper bits of currentRomBank
        var currentRomBank = Memory.currentRomBank & 0x1f;
        var romBankHigherBits = value & 0xe0;
        currentRomBank |= romBankHigherBits;
        Memory.currentRomBank = currentRomBank;
        return;
      }

      var ramBankBits = value;

      if (!Memory.isMBC5) {
        // Get the bottom 2 bits
        ramBankBits &= 0x03;
      } else {
        // Get the bottom nibble
        ramBankBits &= 0x0f;
      } // Set our ram bank


      Memory.currentRamBank = ramBankBits;
      return;
    } else if (!isMBC2 && offset <= 0x7fff) {
      if (isMBC1) {
        Memory.isMBC1RomModeEnabled = checkBitOnByte(0, value);
      } // TODO: MBC3 Latch Clock Data

    }
  } // Inlined because closure compiler inlines


  function getRomBankAddress(gameboyOffset) {
    var currentRomBank = Memory.currentRomBank;

    if (!Memory.isMBC5 && currentRomBank === 0) {
      currentRomBank = 1;
    } // Adjust our gameboy offset relative to zero for the gameboy memory map


    return 0x4000 * currentRomBank + (gameboyOffset - Memory.switchableCartridgeRomLocation);
  } // Inlined because closure compiler inlines


  function getRamBankAddress(gameboyOffset) {
    // Adjust our gameboy offset relative to zero for the gameboy memory map
    return 0x2000 * Memory.currentRamBank + (gameboyOffset - Memory.cartridgeRamLocation);
  } // Inlined because closure compiler inlines


  function initializeDma() {
    if (Cpu.GBCEnabled) {
      // GBC DMA
      eightBitStoreIntoGBMemory(0xff51, 0xff);
      eightBitStoreIntoGBMemory(0xff52, 0xff);
      eightBitStoreIntoGBMemory(0xff53, 0xff);
      eightBitStoreIntoGBMemory(0xff54, 0xff);
      eightBitStoreIntoGBMemory(0xff55, 0xff);
    } else {
      // GB DMA
      eightBitStoreIntoGBMemory(0xff51, 0xff);
      eightBitStoreIntoGBMemory(0xff52, 0xff);
      eightBitStoreIntoGBMemory(0xff53, 0xff);
      eightBitStoreIntoGBMemory(0xff54, 0xff);
      eightBitStoreIntoGBMemory(0xff55, 0xff);
    }
  } // Inlined because closure compiler inlines


  function startDmaTransfer(sourceAddressOffset) {
    var sourceAddress = sourceAddressOffset << 8;

    for (var i = 0; i <= 0x9f; ++i) {
      var spriteInformationByte = eightBitLoadFromGBMemory(sourceAddress + i);
      var spriteInformationAddress = Memory.spriteInformationTableLocation + i;
      eightBitStoreIntoGBMemory(spriteInformationAddress, spriteInformationByte);
    } // TCAGBD:  This copy (DMA) needs 160 × 4 + 4 clocks to complete in both double speed and single speeds modes
    // Increment all of our Cycle coiunters in ../cpu/opcodes


    Memory.DMACycles = 644;
  } // https://gist.github.com/drhelius/3394856
  // http://bgb.bircd.org/pandocs.htm
  // Inlined because closure compiler inlines


  function startHdmaTransfer(hdmaTriggerByteToBeWritten) {
    // Check if we are Gbc
    if (!Cpu.GBCEnabled) {
      return;
    } // Check if we are trying to terminate an already active HBLANK HDMA


    if (Memory.isHblankHdmaActive && !checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {
      // Don't reset anything, just set bit 7 to 1 on the trigger byte
      Memory.isHblankHdmaActive = false;
      var hdmaTriggerByte = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaTrigger);
      eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, setBitOnByte(7, hdmaTriggerByte));
      return;
    } // Get our source and destination for the HDMA


    var hdmaSource = getHdmaSourceFromMemory();
    var hdmaDestination = getHdmaDestinationFromMemory(); // Get the length from the trigger
    // Lower 7 bits, Add 1, times 16
    // https://gist.github.com/drhelius/3394856

    var transferLength = resetBitOnByte(7, hdmaTriggerByteToBeWritten);
    transferLength = transferLength + 1 << 4; // Get bit 7 of the trigger for the HDMA type

    if (checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {
      // H-Blank DMA
      Memory.isHblankHdmaActive = true;
      Memory.hblankHdmaTransferLengthRemaining = transferLength;
      Memory.hblankHdmaSource = hdmaSource;
      Memory.hblankHdmaDestination = hdmaDestination; // This will be handled in updateHblankHdma()
      // Since we return false in write traps, we need to now write the byte
      // Be sure to reset bit 7, to show that the hdma is active

      eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, resetBitOnByte(7, hdmaTriggerByteToBeWritten));
    } else {
      // General DMA
      hdmaTransfer(hdmaSource, hdmaDestination, transferLength); // Stop the DMA

      eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, 0xff);
    }
  } // Inlined because closure compiler inlines


  function updateHblankHdma() {
    if (!Memory.isHblankHdmaActive) {
      return;
    } // Get our amount of bytes to transfer (Only 0x10 bytes at a time)


    var bytesToTransfer = 0x10;
    var hblankHdmaTransferLengthRemaining = Memory.hblankHdmaTransferLengthRemaining;

    if (hblankHdmaTransferLengthRemaining < bytesToTransfer) {
      // Set to the difference
      bytesToTransfer = hblankHdmaTransferLengthRemaining;
    } // Do the transfer (Only 0x10 bytes at a time)


    hdmaTransfer(Memory.hblankHdmaSource, Memory.hblankHdmaDestination, bytesToTransfer); // Update our source and destination

    Memory.hblankHdmaSource += bytesToTransfer;
    Memory.hblankHdmaDestination += bytesToTransfer;
    hblankHdmaTransferLengthRemaining -= bytesToTransfer;
    Memory.hblankHdmaTransferLengthRemaining = hblankHdmaTransferLengthRemaining;
    var memoryLocationHdmaTrigger = Memory.memoryLocationHdmaTrigger;

    if (hblankHdmaTransferLengthRemaining <= 0) {
      // End the transfer
      Memory.isHblankHdmaActive = false; // Need to clear the HDMA with 0xFF, which sets bit 7 to 1 to show the HDMA has ended

      eightBitStoreIntoGBMemory(memoryLocationHdmaTrigger, 0xff);
    } else {
      // Set our new transfer length, make sure it is in the weird format,
      // and make sure bit 7 is 0, to show that the HDMA is Active
      var remainingTransferLength = hblankHdmaTransferLengthRemaining;
      var transferLengthAsByte = (remainingTransferLength >> 4) - 1;
      eightBitStoreIntoGBMemory(memoryLocationHdmaTrigger, resetBitOnByte(7, transferLengthAsByte));
    }
  } // Simple Function to transfer the bytes from a destination to a source for a general pourpose or Hblank HDMA


  function hdmaTransfer(hdmaSource, hdmaDestination, transferLength) {
    for (var i = 0; i < transferLength; ++i) {
      var sourceByte = eightBitLoadFromGBMemoryWithTraps(hdmaSource + i); // get the hdmaDestination with wrapping
      // See issue #61: https://github.com/torch2424/wasmBoy/issues/61

      var hdmaDestinationWithWrapping = hdmaDestination + i;

      while (hdmaDestinationWithWrapping > 0x9fff) {
        // Simply clear the top 3 bits
        hdmaDestinationWithWrapping -= 0x2000;
      }

      eightBitStoreIntoGBMemoryWithTraps(hdmaDestinationWithWrapping, sourceByte);
    } // Set our Cycles used for the HDMA
    // Since DMA in GBC Double Speed Mode takes 80 micro seconds,
    // And HDMA takes 8 micro seconds per 0x10 bytes in GBC Double Speed mode (and GBC Normal Mode)
    // Will assume (644 / 10) cycles for GBC Double Speed Mode,
    // and (644 / 10 / 2) for GBC Normal Mode


    var hdmaCycles = 32 << Cpu.GBCDoubleSpeed;
    hdmaCycles = hdmaCycles * (transferLength >> 4);
    Memory.DMACycles += hdmaCycles;
  } // Function to get our HDMA Source
  // Follows the poan docs
  // Inlined because closure compiler inlines


  function getHdmaSourceFromMemory() {
    // Get our source for the HDMA
    var hdmaSourceHigh = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceHigh);
    var hdmaSourceLow = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceLow);
    var hdmaSource = concatenateBytes(hdmaSourceHigh, hdmaSourceLow); // And off the appopriate bits for the source and destination
    // And off the bottom 4 bits

    hdmaSource = hdmaSource & 0xfff0;
    return hdmaSource;
  } // Function to get our HDMA Destination
  // Follows the poan docs
  // Inlined because closure compiler inlines


  function getHdmaDestinationFromMemory() {
    var hdmaDestinationHigh = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationHigh);
    var hdmaDestinationLow = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationLow);
    var hdmaDestination = concatenateBytes(hdmaDestinationHigh, hdmaDestinationLow); // Can only be in VRAM, 0x8000 -> 0x9FF0
    // Pan docs says to knock off upper 3 bits, and lower 4 bits
    // Which gives us: 0001111111110000 or 0x1FF0
    // Meaning we must add 0x8000

    hdmaDestination = hdmaDestination & 0x1ff0;
    hdmaDestination += Memory.videoRamLocation;
    return hdmaDestination;
  } // Internal function to trap any modify data trying to be written to Gameboy memory
  // Follows the Gameboy memory map
  // Return true if you want to continue the write, return false to end it here


  function checkWriteTraps(offset, value) {
    // Cpu
    if (offset === Cpu.memoryLocationSpeedSwitch) {
      // TCAGBD, only Bit 0 is writable
      eightBitStoreIntoGBMemory(Cpu.memoryLocationSpeedSwitch, value & 0x01); // We did the write, dont need to

      return false;
    } // Handle Boot ROM Switch


    if (Cpu.BootROMEnabled && offset === Cpu.memoryLocationBootROMSwitch) {
      // Disable the boot rom
      Cpu.BootROMEnabled = false; // Set the program counter to be incremented after this command

      Cpu.programCounter = 0x00ff; // Allow the write

      return true;
    } // Graphics
    // Cache globals used multiple times for performance


    var videoRamLocation = Memory.videoRamLocation;
    var spriteInformationTableLocation = Memory.spriteInformationTableLocation; // Handle banking

    if (offset < videoRamLocation) {
      handleBanking(offset, value);
      return false;
    } // Check the graphics mode to see if we can write to VRAM
    // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM


    if (offset >= videoRamLocation && offset < Memory.cartridgeRamLocation) {
      // Can only read/write from VRAM During Modes 0 - 2
      // See graphics/lcd.ts
      // TODO: This can do more harm than good in a beta emulator,
      // requires precise timing disabling for now
      // if (Graphics.currentLcdMode > 2) {
      //   return false;
      // }
      // Not batch processing here for performance
      // batchProcessGraphics();
      // Allow the original write, and return since we dont need to look anymore
      return true;
    } // Be sure to copy everything in EchoRam to Work Ram
    // Codeslinger: The ECHO memory region (0xE000-0xFDFF) is quite different because any data written here is also written in the equivelent ram memory region 0xC000-0xDDFF.
    // Hence why it is called echo


    if (offset >= Memory.echoRamLocation && offset < spriteInformationTableLocation) {
      var wramOffset = offset - 0x2000;
      eightBitStoreIntoGBMemory(wramOffset, value); // Allow the original write, and return since we dont need to look anymore

      return true;
    } // Also check for individal writes
    // Can only read/write from OAM During Modes 0 - 1
    // See graphics/lcd.ts


    if (offset >= spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
      // Can only read/write from OAM During Mode 2
      // See graphics/lcd.ts
      // if (Lcd.currentLcdMode < 2) {
      // return false;
      // }
      // Not batch processing here for performance
      // batchProcessGraphics();
      // Allow the original write, and return since we dont need to look anymore
      // return true;
      return Lcd.currentLcdMode >= 2;
    }

    if (offset >= Memory.unusableMemoryLocation && offset <= Memory.unusableMemoryEndLocation) {
      return false;
    } // Serial


    if (offset === Serial.memoryLocationSerialTransferControl) {
      // SC
      return Serial.updateTransferControl(value);
    } // Sound
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers


    if (offset >= 0xff10 && offset <= 0xff26) {
      batchProcessAudio();
      return SoundRegisterWriteTraps(offset, value);
    } // FF27 - FF2F not used
    // Final Wave Table for Channel 3


    if (offset >= 0xff30 && offset <= 0xff3f) {
      batchProcessAudio(); // Need to handle the write if channel 3 is enabled

      if (Channel3.isEnabled) {
        Channel3.handleWaveRamWrite(value);
        return false;
      }

      return true;
    } // Other Memory effects fomr read/write to Lcd/Graphics


    if (offset >= Lcd.memoryLocationLcdControl && offset <= Graphics.memoryLocationWindowX) {
      // Not batch processing here for performance
      // batchProcessGraphics();
      if (offset === Lcd.memoryLocationLcdControl) {
        // Shorcut for isLCD Enabled since it gets "hot"
        Lcd.updateLcdControl(value);
        return true;
      }

      if (offset === Lcd.memoryLocationLcdStatus) {
        // We are handling the write here
        Lcd.updateLcdStatus(value);
        return false;
      } // reset the current scanline if the game tries to write to it


      if (offset === Graphics.memoryLocationScanlineRegister) {
        Graphics.scanlineRegister = 0;
        eightBitStoreIntoGBMemory(offset, 0);
        return false;
      } // Cache our coincidence compare


      if (offset === Lcd.memoryLocationCoincidenceCompare) {
        Lcd.coincidenceCompare = value;
        return true;
      } // Do the direct memory access transfer for spriteInformationTable
      // Check the graphics mode to see if we can write to VRAM
      // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM


      if (offset === Graphics.memoryLocationDmaTransfer) {
        // otherwise, perform a DMA transfer
        // And allow the original write
        startDmaTransfer(value);
        return true;
      } // Scroll and Window XY


      switch (offset) {
        case Graphics.memoryLocationScrollX:
          Graphics.scrollX = value;
          return true;

        case Graphics.memoryLocationScrollY:
          Graphics.scrollY = value;
          return true;

        case Graphics.memoryLocationWindowX:
          Graphics.windowX = value;
          return true;

        case Graphics.memoryLocationWindowY:
          Graphics.windowY = value;
          return true;
      } // Allow the original write, and return since we dont need to look anymore


      return true;
    } // Do an HDMA


    if (offset === Memory.memoryLocationHdmaTrigger) {
      startHdmaTransfer(value);
      return false;
    } // Don't allow banking if we are doing an Hblank HDM transfer
    // https://gist.github.com/drhelius/3394856


    if (offset === Memory.memoryLocationGBCWRAMBank || offset === Memory.memoryLocationGBCVRAMBank) {
      if (Memory.isHblankHdmaActive) {
        var hblankHdmaSource = Memory.hblankHdmaSource;

        if (hblankHdmaSource >= 0x4000 && hblankHdmaSource <= 0x7fff || hblankHdmaSource >= 0xd000 && hblankHdmaSource <= 0xdfff) {
          return false;
        }
      }
    } // Handle GBC Pallete Write


    if (offset >= Palette.memoryLocationBackgroundPaletteIndex && offset <= Palette.memoryLocationSpritePaletteData) {
      // Incremeenting the palette handled by the write
      writeColorPaletteToMemory(offset, value);
      return true;
    } // Handle timer writes


    if (offset >= Timers.memoryLocationDividerRegister && offset <= Timers.memoryLocationTimerControl) {
      // Batch Process
      batchProcessTimers();

      switch (offset) {
        case Timers.memoryLocationDividerRegister:
          Timers.updateDividerRegister();
          return false;

        case Timers.memoryLocationTimerCounter:
          Timers.updateTimerCounter(value);
          return true;

        case Timers.memoryLocationTimerModulo:
          Timers.updateTimerModulo(value);
          return true;

        case Timers.memoryLocationTimerControl:
          Timers.updateTimerControl(value);
          return true;
      }

      return true;
    } // Handle Joypad writes for HW reg caching


    if (offset === Joypad.memoryLocationJoypadRegister) {
      Joypad.updateJoypad(value);
    } // Handle Interrupt writes


    if (offset === Interrupts.memoryLocationInterruptRequest) {
      Interrupts.updateInterruptRequested(value);
      return true;
    }

    if (offset === Interrupts.memoryLocationInterruptEnabled) {
      Interrupts.updateInterruptEnabled(value);
      return true;
    } // Allow the original write


    return true;
  } // WasmBoy memory map:
  // Private function to translate a offset meant for the gameboy memory map
  // To the wasmboy memory map
  // Following: http://gameboy.mongenel.com/dmg/asmmemmap.html
  // And https://github.com/Dooskington/GameLad/wiki/Part-11---Memory-Bank-Controllers
  // Performance help from @dcodeIO, and awesome-gbdev


  function getWasmBoyOffsetFromGameBoyOffset(gameboyOffset) {
    // Get the top byte and switch
    var gameboyOffsetHighByte = gameboyOffset >> 12;

    switch (gameboyOffsetHighByte) {
      case 0x00:
        // Check if we are currently executing the boot rom
        // Otherwise, bottom 0x0000 -> 0x03FF is Cartridge ROM Ram Bank 1
        if (Cpu.BootROMEnabled) {
          if (Cpu.GBCEnabled) {
            // See: http://gbdev.gg8.se/wiki/articles/Gameboy_Bootstrap_ROM
            // "The rom dump includes the 256 byte rom (0x0000-0x00FF) and the,
            // 1792 byte rom (0x0200-0x08FF) which Dr. Decapitator observed,
            // but not the 512 byte rom,
            // which may be cpu microcode or lcd color lookup related."
            // First 0xFF bytes are BOOT rom
            if (gameboyOffset < 0x0100) {
              return gameboyOffset + BOOT_ROM_LOCATION;
            } // 0x100 -> 0x1FF is the actual ROM
            // Everything from 0x200 -> 0x8FF is BOOT ROM Again


            if (gameboyOffset > 0x01ff && gameboyOffset < 0x0900) {
              return gameboyOffset + BOOT_ROM_LOCATION;
            }
          } else if (!Cpu.GBCEnabled && gameboyOffset < 0x0100) {
            return gameboyOffset + BOOT_ROM_LOCATION;
          }
        }

      case 0x01:
      case 0x02:
      case 0x03:
        // Cartridge ROM - Bank 0 (fixed)
        // 0x0000 -> 0x0D2400
        return gameboyOffset + CARTRIDGE_ROM_LOCATION;

      case 0x04:
      case 0x05:
      case 0x06:
      case 0x07:
        // Cartridge ROM - Switchable Banks 1-xx
        // 0x4000 -> (0x0D2400 + 0x4000)
        return getRomBankAddress(gameboyOffset) + CARTRIDGE_ROM_LOCATION;

      case 0x08:
      case 0x09:
        // Video RAM
        // 0x8000 -> 0x000400
        var vramBankId = 0;

        if (Cpu.GBCEnabled) {
          // Find our current VRAM Bank
          vramBankId = eightBitLoadFromGBMemory(Memory.memoryLocationGBCVRAMBank) & 0x01; // Even though We added another 0x2000, the Cartridge ram is pulled out of our Internal Memory Space
          // Therefore, we do not need to adjust for this extra 0x2000
        }

        return gameboyOffset - Memory.videoRamLocation + VIDEO_RAM_LOCATION + 0x2000 * vramBankId;

      case 0x0a:
      case 0x0b:
        // Cartridge RAM - A.K.A External RAM
        // 0xA000 -> 0x008400
        return getRamBankAddress(gameboyOffset) + CARTRIDGE_RAM_LOCATION;

      case 0x0c:
        // Gameboy Ram Bank 0
        // 0xC000 -> 0x000400
        // Don't need to add head, since we move out 0x200 from the cartridge ram
        return gameboyOffset - Memory.internalRamBankZeroLocation + WORK_RAM_LOCATION;

      case 0x0d:
        // Gameboy Ram Banks, Switchable in GBC Mode
        // 0xD000 -> 0x000400
        // In CGB Mode 32 KBytes internal RAM are available.
        // This memory is divided into 8 banks of 4 KBytes each.
        // Bank 0 is always available in memory at C000-CFFF,
        // Bank 1-7 can be selected into the address space at D000-DFFF.
        // http://gbdev.gg8.se/wiki/articles/CGB_Registers#FF70_-_SVBK_-_CGB_Mode_Only_-_WRAM_Bank
        // Get the last 3 bits to find our wram ID
        var wramBankId = 0;

        if (Cpu.GBCEnabled) {
          wramBankId = eightBitLoadFromGBMemory(Memory.memoryLocationGBCWRAMBank) & 0x07;
        }

        wramBankId = wramBankId < 1 ? 1 : wramBankId; // (0x1000 * (wramBankId - 1)) -> To find the correct wram bank.
        // wramBankId - 1, because we alreayd have the space for wramBank 1, and are currently in it
        // So need to address space for 6 OTHER banks

        return gameboyOffset - Memory.internalRamBankZeroLocation + WORK_RAM_LOCATION + 0x1000 * (wramBankId - 1);

      default:
        // Everything Else after Gameboy Ram Banks
        // 0xE000 -> 0x000400
        // 0x6000 For the Extra WRAM Banks
        return gameboyOffset - Memory.echoRamLocation + OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION;
    }
  } // Breakpoints for memory / cpu


  var Breakpoints =
  /** @class */
  function () {
    function Breakpoints() {}

    Breakpoints.programCounter = -1;
    Breakpoints.readGbMemory = -1;
    Breakpoints.writeGbMemory = -1;
    Breakpoints.reachedBreakpoint = false;
    return Breakpoints;
  }();

  function setProgramCounterBreakpoint(breakpoint) {
    Breakpoints.programCounter = breakpoint;
  }

  function resetProgramCounterBreakpoint() {
    Breakpoints.programCounter = -1;
  }

  function setReadGbMemoryBreakpoint(breakpoint) {
    Breakpoints.readGbMemory = breakpoint;
  }

  function resetReadGbMemoryBreakpoint() {
    Breakpoints.readGbMemory = -1;
  }

  function setWriteGbMemoryBreakpoint(breakpoint) {
    Breakpoints.writeGbMemory = breakpoint;
  }

  function resetWriteGbMemoryBreakpoint() {
    Breakpoints.writeGbMemory = -1;
  } // Store / Write memory access


  function eightBitStoreIntoGBMemory(gameboyOffset, value) {
    store(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset), value);
  }

  function eightBitStoreIntoGBMemoryWithTraps(offset, value) {
    if (offset === Breakpoints.writeGbMemory) {
      Breakpoints.reachedBreakpoint = true;
    }

    if (checkWriteTraps(offset, value)) {
      eightBitStoreIntoGBMemory(offset, value);
    }
  }

  function sixteenBitStoreIntoGBMemoryWithTraps(offset, value) {
    // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
    // Split the value into two seperate bytes
    var highByte = splitHighByte(value);
    var lowByte = splitLowByte(value);

    if (checkWriteTraps(offset, lowByte)) {
      eightBitStoreIntoGBMemory(offset, lowByte);
    }

    var nextOffset = offset + 1;

    if (checkWriteTraps(nextOffset, highByte)) {
      eightBitStoreIntoGBMemory(nextOffset, highByte);
    }
  }

  function sixteenBitStoreIntoGBMemory(offset, value) {
    // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
    // Split the value into two seperate bytes
    var highByte = splitHighByte(value);
    var lowByte = splitLowByte(value);
    eightBitStoreIntoGBMemory(offset + 0, lowByte);
    eightBitStoreIntoGBMemory(offset + 1, highByte);
  }

  function storeBooleanDirectlyToWasmMemory(offset, value) {
    store(offset, value);
  } // Funcitons for setting and checking the LCD


  var Lcd =
  /** @class */
  function () {
    function Lcd() {} // Function called in write traps to update our hardware registers


    Lcd.updateLcdStatus = function (value) {
      // Bottom three bits are read only
      var currentLcdStatus = eightBitLoadFromGBMemory(Lcd.memoryLocationLcdStatus);
      var valueNoBottomBits = value & 0xf8;
      var lcdStatusOnlyBottomBits = currentLcdStatus & 0x07;
      value = valueNoBottomBits | lcdStatusOnlyBottomBits; // Top bit is always 1

      value = setBitOnByte(7, value);
      eightBitStoreIntoGBMemory(Lcd.memoryLocationLcdStatus, value);
    }; // Function called in write traps to update our hardware registers


    Lcd.updateLcdControl = function (value) {
      var wasLcdEnabled = Lcd.enabled;
      Lcd.enabled = checkBitOnByte(7, value);
      Lcd.windowTileMapDisplaySelect = checkBitOnByte(6, value);
      Lcd.windowDisplayEnabled = checkBitOnByte(5, value);
      Lcd.bgWindowTileDataSelect = checkBitOnByte(4, value);
      Lcd.bgTileMapDisplaySelect = checkBitOnByte(3, value);
      Lcd.tallSpriteSize = checkBitOnByte(2, value);
      Lcd.spriteDisplayEnable = checkBitOnByte(1, value);
      Lcd.bgDisplayEnabled = checkBitOnByte(0, value);

      if (wasLcdEnabled && !Lcd.enabled) {
        // Disable the LCD
        resetLcd(true);
      }

      if (!wasLcdEnabled && Lcd.enabled) {
        // Re-enable the LCD
        resetLcd(false);
      }
    }; // Memory Locations
    // Also known at STAT
    // LCD Status (0xFF41) bits Explanation
    // 0                0                    000                    0             00
    //       |Coicedence Interrupt|     |Mode Interrupts|  |coincidence flag|  | Mode |
    // Modes:
    // 0 or 00: H-Blank
    // 1 or 01: V-Blank
    // 2 or 10: Searching Sprites Atts
    // 3 or 11: Transfering Data to LCD Driver


    Lcd.memoryLocationLcdStatus = 0xff41;
    Lcd.currentLcdMode = 0;
    Lcd.memoryLocationCoincidenceCompare = 0xff45;
    Lcd.coincidenceCompare = 0; // Also known as LCDC
    // http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
    // Bit 7 - LCD Display Enable (0=Off, 1=On)
    // Bit 6 - Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
    // Bit 5 - Window Display Enable (0=Off, 1=On)
    // Bit 4 - BG & Window Tile Data Select (0=8800-97FF, 1=8000-8FFF)
    // Bit 3 - BG Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
    // Bit 2 - OBJ (Sprite) Size (0=8x8, 1=8x16)
    // Bit 1 - OBJ (Sprite) Display Enable (0=Off, 1=On)
    // Bit 0 - BG Display (for CGB see below) (0=Off, 1=On

    Lcd.memoryLocationLcdControl = 0xff40; // Decoupled LCDC for caching

    Lcd.enabled = true;
    Lcd.windowTileMapDisplaySelect = false;
    Lcd.windowDisplayEnabled = false;
    Lcd.bgWindowTileDataSelect = false;
    Lcd.bgTileMapDisplaySelect = false;
    Lcd.tallSpriteSize = false;
    Lcd.spriteDisplayEnable = false;
    Lcd.bgDisplayEnabled = false;
    return Lcd;
  }();

  function resetLcd(shouldBlankScreen) {
    // Reset scanline cycle counter
    Graphics.scanlineCycleCounter = 0;
    Graphics.scanlineRegister = 0;
    eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, 0); // Set to mode 0
    // https://www.reddit.com/r/EmuDev/comments/4w6479/gb_dr_mario_level_generation_issues/

    var lcdStatus = eightBitLoadFromGBMemory(Lcd.memoryLocationLcdStatus);
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = resetBitOnByte(0, lcdStatus);
    Lcd.currentLcdMode = 0; // Store the status in memory

    eightBitStoreIntoGBMemory(Lcd.memoryLocationLcdStatus, lcdStatus); // Blank the screen

    if (shouldBlankScreen) {
      for (var i = 0; i < FRAME_SIZE; ++i) {
        store(FRAME_LOCATION + i, 255);
      }
    }
  } // Pass in the lcd status for performance
  // Inlined because closure compiler inlines


  function setLcdStatus() {
    // Check if the Lcd was disabled
    if (!Lcd.enabled) {
      return;
    } // Get our current scanline, and lcd mode


    var scanlineRegister = Graphics.scanlineRegister;
    var lcdMode = Lcd.currentLcdMode; // Default to  H-Blank

    var newLcdMode = 0; // Find our newLcd mode

    if (scanlineRegister >= 144) {
      // VBlank mode
      newLcdMode = 1;
    } else {
      var scanlineCycleCounter = Graphics.scanlineCycleCounter;
      var MIN_CYCLES_SPRITES_LCD_MODE = Graphics.MIN_CYCLES_SPRITES_LCD_MODE();

      if (scanlineCycleCounter >= MIN_CYCLES_SPRITES_LCD_MODE) {
        // Searching Sprites Atts
        newLcdMode = 2;
      } else if (scanlineCycleCounter >= MIN_CYCLES_SPRITES_LCD_MODE) {
        // Transferring data to lcd
        newLcdMode = 3;
      }
    }

    if (lcdMode !== newLcdMode) {
      // Get our lcd status
      var lcdStatus = eightBitLoadFromGBMemory(Lcd.memoryLocationLcdStatus); // Save our lcd mode

      Lcd.currentLcdMode = newLcdMode;
      var shouldRequestInterrupt = false; // Set our LCD Status accordingly

      switch (newLcdMode) {
        case 0x00:
          lcdStatus = resetBitOnByte(0, lcdStatus);
          lcdStatus = resetBitOnByte(1, lcdStatus);
          shouldRequestInterrupt = checkBitOnByte(3, lcdStatus);
          break;

        case 0x01:
          lcdStatus = resetBitOnByte(1, lcdStatus);
          lcdStatus = setBitOnByte(0, lcdStatus);
          shouldRequestInterrupt = checkBitOnByte(4, lcdStatus);
          break;

        case 0x02:
          lcdStatus = resetBitOnByte(0, lcdStatus);
          lcdStatus = setBitOnByte(1, lcdStatus);
          shouldRequestInterrupt = checkBitOnByte(5, lcdStatus);
          break;

        case 0x03:
          lcdStatus = setBitOnByte(0, lcdStatus);
          lcdStatus = setBitOnByte(1, lcdStatus);
          break;
      } // Check if we want to request an interrupt, and we JUST changed modes


      if (shouldRequestInterrupt) {
        requestLcdInterrupt();
      } // Check for updating the Hblank HDMA


      if (newLcdMode === 0) {
        // Update the Hblank DMA, will simply return if not active
        updateHblankHdma();
      } // Check for requesting a VBLANK interrupt


      if (newLcdMode === 1) {
        requestVBlankInterrupt();
      } // Check for the coincidence


      lcdStatus = checkCoincidence(newLcdMode, lcdStatus); // Finally, save our status

      eightBitStoreIntoGBMemory(Lcd.memoryLocationLcdStatus, lcdStatus);
    } else if (scanlineRegister === 153) {
      // Special Case, need to check LYC
      // Fix prehistorik man freeze
      var lcdStatus = eightBitLoadFromGBMemory(Lcd.memoryLocationLcdStatus);
      lcdStatus = checkCoincidence(newLcdMode, lcdStatus);
      eightBitStoreIntoGBMemory(Lcd.memoryLocationLcdStatus, lcdStatus);
    }
  }

  function checkCoincidence(lcdMode, lcdStatus) {
    // Check for the coincidence flag
    // Need to check on every mode, and not just HBLANK, as checking on hblank breaks shantae, which checks on vblank
    if ((lcdMode === 0 || lcdMode === 1) && Graphics.scanlineRegister === Lcd.coincidenceCompare) {
      lcdStatus = setBitOnByte(2, lcdStatus);

      if (checkBitOnByte(6, lcdStatus)) {
        requestLcdInterrupt();
      }
    } else {
      lcdStatus = resetBitOnByte(2, lcdStatus);
    }

    return lcdStatus;
  } // Functions for rendering the background
  // NOTE: i32Portable wraps modulo here as somehow it gets converted to a double:
  // https://github.com/torch2424/wasmboy/issues/216
  // Inlined because closure compiler inlines


  function renderBackground(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation) {
    // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.
    // Get our scrollX and scrollY (u16 to play nice with assemblyscript)
    // let scrollX: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollX);
    // let scrollY: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollY);
    var scrollX = Graphics.scrollX;
    var scrollY = Graphics.scrollY; // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)
    // this is done by getting the current scroll Y position,
    // and adding it do what Y Value the scanline is drawing on the camera.

    var pixelYPositionInMap = scanlineRegister + scrollY; // Gameboy camera will "wrap" around the background map,
    // meaning that if the pixelValue is 350, then we need to subtract 256 (decimal) to get it's actual value
    // pixel values (scrollX and scrollY) range from 0x00 - 0xFF

    pixelYPositionInMap &= 0x100 - 1; // Draw the Background scanline

    drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, 0, scrollX);
  } // Inlined because closure compiler inlines


  function renderWindow(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation) {
    // Get our windowX and windowY
    // let windowX: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowX);
    // let windowY: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowY);
    var windowX = Graphics.windowX;
    var windowY = Graphics.windowY; // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.
    // First ensure that the scanline is greater than our window

    if (scanlineRegister < windowY) {
      // Window is not within the current camera view
      return;
    } // WindowX is offset by 7


    windowX -= 7; // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)

    var pixelYPositionInMap = scanlineRegister - windowY; // xOffset is simply a neagative window x
    // NOTE: This can become negative zero?
    // https://github.com/torch2424/wasmboy/issues/216

    var xOffset = i32Portable(-windowX); // Draw the Background scanline

    drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, windowX, xOffset);
  } // Function frankenstein'd together to allow background and window to share the same draw scanline function


  function drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, iStart, xOffset) {
    // Get our tile Y position in the map
    var tileYPositionInMap = pixelYPositionInMap >> 3; // Loop through x to draw the line like a CRT

    for (var i = iStart; i < 160; ++i) {
      // Get our Current X position of our pixel on the on the 160x144 camera
      // this is done by getting the current scroll X position,
      // and adding it do what X Value the scanline is drawing on the camera.
      var pixelXPositionInMap = i + xOffset; // This is to compensate wrapping, same as pixelY

      if (pixelXPositionInMap >= 0x100) {
        pixelXPositionInMap -= 0x100;
      } // Divide our pixel position by 8 to get our tile.
      // Since, there are 256x256 pixels, and 32x32 tiles.
      // 256 / 8 = 32.
      // Also, bitshifting by 3, do do a division by 8
      // Need to use u16s, as they will be used to compute an address, which will cause weird errors and overflows


      var tileXPositionInMap = pixelXPositionInMap >> 3; // Get our tile address on the tileMap
      // NOTE: (tileMap represents where each tile is displayed on the screen)
      // NOTE: (tile map represents the entire map, now just what is within the "camera")
      // For instance, if we have y pixel 144. 144 / 8 = 18. 18 * 32 = line address in map memory.
      // And we have x pixel 160. 160 / 8 = 20.
      // * 32, because remember, this is NOT only for the camera, the actual map is 32x32. Therefore, the next tile line of the map, is 32 byte offset.
      // Think like indexing a 2d array, as a 1d array and it make sense :)

      var tileMapAddress = tileMapMemoryLocation + (tileYPositionInMap << 5) + tileXPositionInMap; // Get the tile Id on the Tile Map

      var tileIdFromTileMap = loadFromVramBank(tileMapAddress, 0); // Now that we have our Tile Id, let's check our Tile Cache

      var usedTileCache = false;

      if (Config.tileCaching) {
        var pixelsDrawn = drawLineOfTileFromTileCache(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap); // Increment i by 7, not 8 because i will be incremented at end of for loop

        if (pixelsDrawn > 0) {
          i += pixelsDrawn - 1;
          usedTileCache = true;
        }
      }

      if (Config.tileRendering && !usedTileCache) {
        var pixelsDrawn = drawLineOfTileFromTileId(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap); // A line of a tile is 8 pixels wide, therefore increase i by (pixelsDrawn - 1), and then the for loop will increment by 1
        // For a net increment for 8

        if (pixelsDrawn > 0) {
          i += pixelsDrawn - 1;
        }
      } else if (!usedTileCache) {
        if (Cpu.GBCEnabled) {
          // Draw the individual pixel
          drawColorPixelFromTileId(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap);
        } else {
          // Draw the individual pixel
          drawMonochromePixelFromTileId(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileDataMemoryLocation, tileIdFromTileMap);
        }
      }
    }
  } // Function to draw a pixel for the standard GB
  // Inlined because closure compiler inlines


  function drawMonochromePixelFromTileId(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileDataMemoryLocation, tileIdFromTileMap) {
    // Now we can process the the individual bytes that represent the pixel on a tile
    // Now get our tileDataAddress for the corresponding tileID we found in the map
    // Read the comments in _getTileDataAddress() to see what's going on.
    // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
    // This funcitons returns the start of memory locaiton for the tile 'c'.
    var tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap); // Get the y pixel of the 8 by 8 tile.
    // Simply modulo the scanline.
    // For instance, let's say we are printing the first line of pixels on our camera,
    // And the first line of pixels on our tile.
    // yPixel = 1. 1 % 8 = 1.
    // And for the last line
    // yPixel = 144. 144 % 8 = 0.
    // 0 Represents last line of pixels in a tile, 1 represents first. 1 2 3 4 5 6 7 0.
    // Because remember, we are counting lines on the display NOT including zero

    var pixelYInTile = i32Portable(pixelYPositionInMap & 7); // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
    // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
    // Again, think like you had to map a 2d array as a 1d.

    var byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2, 0);
    var byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, 0); // Same logic as pixelYInTile.
    // However, We need to reverse our byte,
    // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
    // Therefore, is pixelX was 2, then really is need to be 5
    // So 2 - 7 = -5, * 1 = 5
    // Or to simplify, 7 - 2 = 5 haha!

    var pixelXInTile = i32Portable(pixelXPositionInMap & 7);
    pixelXInTile = 7 - pixelXInTile; // Now we can get the color for that pixel
    // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
    // To Get the color Id.
    // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
    // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html

    var paletteColorId = 0;

    if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
      // Byte one represents the second bit in our color id, so bit shift
      paletteColorId += 1;
      paletteColorId = paletteColorId << 1;
    }

    if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
      paletteColorId += 1;
    } // Not checking u8 Portability overflow here, since it can't be greater than i32 over :p
    // Now get the colorId from the pallete, to get our final color
    // Developers could change colorIds to represents different colors
    // in their palette, thus we need to grab the color from there
    //let pixelColorInTileFromPalette: u8 = getColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
    // Moved below for perofrmance
    // FINALLY, RENDER THAT PIXEL!
    // Only rendering camera for now, so coordinates are for the camera.
    // Get the rgb value for the color Id, will be repeated into R, G, B. if not colorized


    var hexColor = getColorizedGbHexColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
    setPixelOnFrame(xPixel, yPixel, 0, getRedFromHexColor(hexColor));
    setPixelOnFrame(xPixel, yPixel, 1, getGreenFromHexColor(hexColor));
    setPixelOnFrame(xPixel, yPixel, 2, getBlueFromHexColor(hexColor)); // Lastly, add the pixel to our background priority map
    // https://github.com/torch2424/wasmBoy/issues/51
    // Bits 0 & 1 will represent the color Id drawn by the BG/Window
    // Bit 2 will represent if the Bg/Window has GBC priority.

    addPriorityforPixel(xPixel, yPixel, paletteColorId);
  } // Function to draw a pixel from a tile in C O L O R
  // See above for more context on some variables
  // Inlined because closure compiler inlines


  function drawColorPixelFromTileId(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap) {
    // Now get our tileDataAddress for the corresponding tileID we found in the map
    // Read the comments in _getTileDataAddress() to see what's going on.
    // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
    // This funcitons returns the start of memory locaiton for the tile 'c'.
    var tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap); // Get the GB Map Attributes
    // Bit 0-2  Background Palette number  (BGP0-7)
    // Bit 3    Tile VRAM Bank number      (0=Bank 0, 1=Bank 1)
    // Bit 4    Not used
    // Bit 5    Horizontal Flip            (0=Normal, 1=Mirror horizontally)
    // Bit 6    Vertical Flip              (0=Normal, 1=Mirror vertically)
    // Bit 7    BG-to-OAM Priority         (0=Use OAM priority bit, 1=BG Priority)

    var bgMapAttributes = loadFromVramBank(tileMapAddress, 1); // See above for explanation

    var pixelYInTile = i32Portable(pixelYPositionInMap & 7);

    if (checkBitOnByte(6, bgMapAttributes)) {
      // We are mirroring the tile, therefore, we need to opposite byte
      // So if our pixel was 0 our of 8, it wild become 7 :)
      pixelYInTile = 7 - pixelYInTile;
    } // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
    // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
    // But we need to load the time from a specific Vram bank


    var vramBankId = i32Portable(checkBitOnByte(3, bgMapAttributes));
    var byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2, vramBankId);
    var byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, vramBankId); // Get our X pixel. Need to NOT reverse it if it was flipped.
    // See above, you have to reverse this normally

    var pixelXInTile = i32Portable(pixelXPositionInMap & 7);

    if (!checkBitOnByte(5, bgMapAttributes)) {
      pixelXInTile = 7 - pixelXInTile;
    } // Now we can get the color for that pixel
    // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
    // To Get the color Id.
    // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
    // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html


    var paletteColorId = 0;

    if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
      // Byte one represents the second bit in our color id, so bit shift
      paletteColorId += 1;
      paletteColorId = paletteColorId << 1;
    }

    if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
      paletteColorId += 1;
    } // Finally lets add some, C O L O R
    // Want the botom 3 bits


    var bgPalette = bgMapAttributes & 0x07; // Call the helper function to grab the correct color from the palette

    var rgbColorPalette = getRgbColorFromPalette(bgPalette, paletteColorId, false); // Split off into red green and blue

    var red = getColorComponentFromRgb(0, rgbColorPalette);
    var green = getColorComponentFromRgb(1, rgbColorPalette);
    var blue = getColorComponentFromRgb(2, rgbColorPalette); // Finally Place our colors on the things

    setPixelOnFrame(xPixel, yPixel, 0, red);
    setPixelOnFrame(xPixel, yPixel, 1, green);
    setPixelOnFrame(xPixel, yPixel, 2, blue); // Lastly, add the pixel to our background priority map
    // https://github.com/torch2424/wasmBoy/issues/51
    // Bits 0 & 1 will represent the color Id drawn by the BG/Window
    // Bit 2 will represent if the Bg/Window has GBC priority.

    addPriorityforPixel(xPixel, yPixel, paletteColorId, checkBitOnByte(7, bgMapAttributes));
  } // Function to attempt to draw the tile from the tile cache
  // Inlined because closure compiler inlines


  function drawLineOfTileFromTileCache(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap) {
    // First, initialize how many pixels we have drawn
    var pixelsDrawn = 0; // Check if the current tile matches our tileId
    // TODO: Allow the first line to use the tile cache, for some odd reason it doesn't work when scanline is 0

    var nextXIndexToPerformCacheCheck = TileCache.nextXIndexToPerformCacheCheck;

    if (yPixel > 0 && xPixel > 8 && tileIdFromTileMap === TileCache.tileId && xPixel === nextXIndexToPerformCacheCheck) {
      // Was last tile flipped
      var wasLastTileHorizontallyFlipped = checkBitOnByte(5, eightBitLoadFromGBMemory(tileMapAddress - 1));
      var isCurrentTileHorizontallyFlipped = checkBitOnByte(5, eightBitLoadFromGBMemory(tileMapAddress)); // Simply copy the last 8 pixels from memory to copy the line from the tile

      for (var tileCacheIndex = 0; tileCacheIndex < 8; ++tileCacheIndex) {
        // Check if we need to render backwards for flipping
        if (wasLastTileHorizontallyFlipped !== isCurrentTileHorizontallyFlipped) {
          tileCacheIndex = 7 - tileCacheIndex;
        }

        var xPos = xPixel + tileCacheIndex; // First check for overflow

        if (xPos <= 160) {
          // Get the pixel location in memory of the tile
          var previousXPixel = xPixel - (8 - tileCacheIndex);
          var previousTilePixelLocation = FRAME_LOCATION + getRgbPixelStart(xPos, yPixel); // Cycle through the RGB
          // for (let tileCacheRgb = 0; tileCacheRgb < 3; ++tileCacheRgb) {
          //  setPixelOnFrame(xPixel + tileCacheIndex, yPixel, tileCacheRgb, load<u8>(previousTilePixelLocation + tileCacheRgb));
          // }
          // unroll

          setPixelOnFrame(xPos, yPixel, 0, load(previousTilePixelLocation, 0));
          setPixelOnFrame(xPos, yPixel, 1, load(previousTilePixelLocation, 1));
          setPixelOnFrame(xPos, yPixel, 2, load(previousTilePixelLocation, 2)); // Copy the priority for the pixel

          var pixelPriority = getPriorityforPixel(previousXPixel, yPixel);
          addPriorityforPixel(xPos, yPixel, resetBitOnByte(2, pixelPriority), checkBitOnByte(2, pixelPriority));
          pixelsDrawn++;
        }
      }
    } else {
      // Save our current tile Id, and the next x value we should check the x index
      TileCache.tileId = tileIdFromTileMap;
    } // Calculate when we should do the tileCache calculation again


    if (xPixel >= nextXIndexToPerformCacheCheck) {
      nextXIndexToPerformCacheCheck = xPixel + 8;
      var xOffsetTileWidthRemainder = i32Portable(pixelXPositionInMap & 7);

      if (xPixel < xOffsetTileWidthRemainder) {
        nextXIndexToPerformCacheCheck += xOffsetTileWidthRemainder;
      }
    }

    TileCache.nextXIndexToPerformCacheCheck = nextXIndexToPerformCacheCheck;
    return pixelsDrawn;
  } // Function to draw a line of a tile in Color
  // This is for tile rendering shortcuts
  // Inlined because closure compiler inlines


  function drawLineOfTileFromTileId(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap) {
    // Get the which line of the tile we are rendering
    var tileLineY = i32Portable(pixelYPositionInMap & 7); // Now lets find our tileX start and end
    // This is for the case where i = 0, but scroll X was 3.
    // Or i is 157, and our camera is only 160 pixels wide

    var tileXStart = 0;

    if (xPixel == 0) {
      tileXStart = pixelXPositionInMap - (pixelXPositionInMap >> 3 << 3);
    }

    var tileXEnd = 7;

    if (xPixel + 8 > 160) {
      tileXEnd = 160 - xPixel;
    } // initialize some variables for GBC


    var bgMapAttributes = -1;
    var vramBankId = 0;

    if (Cpu.GBCEnabled) {
      // Get Our GBC properties
      bgMapAttributes = loadFromVramBank(tileMapAddress, 1);
      vramBankId = i32Portable(checkBitOnByte(3, bgMapAttributes));

      if (checkBitOnByte(6, bgMapAttributes)) {
        // We are mirroring the tile, therefore, we need to opposite byte
        // So if our pixel was 0 our of 8, it wild become 7 :)
        tileLineY = 7 - tileLineY;
      }
    } // Return the number of pixels drawn


    return drawPixelsFromLineOfTile(tileIdFromTileMap, tileDataMemoryLocation, vramBankId, tileXStart, tileXEnd, tileLineY, xPixel, yPixel, 160, FRAME_LOCATION, false, 0, bgMapAttributes, -1);
  } // Functions for rendering the sprites
  // Inlined because closure compiler inlines


  function renderSprites(scanlineRegister, useLargerSprites) {
    // Need to loop through all 40 sprites to check their status
    // Going backwards since lower sprites draw over higher ones
    // Will fix dragon warrior 3 intro
    for (var i = 39; i >= 0; --i) {
      // Sprites occupy 4 bytes in the sprite attribute table
      var spriteTableIndex = i * 4; // Y positon is offset by 16, X position is offset by 8

      var index = Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex;
      var spriteYPosition = eightBitLoadFromGBMemory(index + 0);
      var spriteXPosition = eightBitLoadFromGBMemory(index + 1);
      var spriteTileId = eightBitLoadFromGBMemory(index + 2); // Pan docs of sprite attirbute table
      // Bit7   OBJ-to-BG Priority (0=OBJ Above BG, 1=OBJ Behind BG color 1-3)
      //      (Used for both BG and Window. BG color 0 is always behind OBJ)
      // Bit6   Y flip          (0=Normal, 1=Vertically mirrored)
      // Bit5   X flip          (0=Normal, 1=Horizontally mirrored)
      // Bit4   Palette number  **Non CGB Mode Only** (0=OBP0, 1=OBP1)
      // Bit3   Tile VRAM-Bank  **CGB Mode Only**     (0=Bank 0, 1=Bank 1)
      // Bit2-0 Palette number  **CGB Mode Only**     (OBP0-7)
      // Apply sprite X and Y offset
      // TODO: Sprites are overflowing on x if less than 8

      spriteYPosition -= 16;
      spriteXPosition -= 8; // Find our sprite height

      var spriteHeight = 8;

      if (useLargerSprites) {
        spriteHeight = 16; // @binji says in 8x16 mode, even tileId always drawn first
        // This will fix shantae sprites which always uses odd numbered indexes
        // TODO: Do the actual Pandocs thing:
        // "In 8x16 mode, the lower bit of the tile number is ignored. Ie. the upper 8x8 tile is "NN AND FEh", and the lower 8x8 tile is "NN OR 01h"."
        // So just knock off the last bit? :)

        spriteTileId -= spriteTileId & 1;
      } // Find if our sprite is on the current scanline


      if (scanlineRegister >= spriteYPosition && scanlineRegister < spriteYPosition + spriteHeight) {
        // Then we need to draw the current sprite
        // Get our sprite attributes since we know we shall be drawing the tile
        var spriteAttributes = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 3); // Check sprite Priority

        var isSpritePriorityBehindWindowAndBackground = checkBitOnByte(7, spriteAttributes); // Check if we should flip the sprite on the x or y axis

        var flipSpriteY = checkBitOnByte(6, spriteAttributes);
        var flipSpriteX = checkBitOnByte(5, spriteAttributes); // TODO: Torch2424 continue here.
        // Find which line on the sprite we are on

        var currentSpriteLine = scanlineRegister - spriteYPosition; // If we fliiped the Y axis on our sprite, need to read from memory backwards to acheive the same effect

        if (flipSpriteY) {
          currentSpriteLine = spriteHeight - currentSpriteLine; // Bug fix for the flipped flies in link's awakening

          currentSpriteLine -= 1;
        } // Each line of a tile takes two bytes of memory


        currentSpriteLine <<= 1; // Get our sprite tile address, need to also add the current sprite line to get the correct bytes

        var spriteTileAddressStart = getTileDataAddress(Graphics.memoryLocationTileDataSelectOneStart, spriteTileId);
        spriteTileAddressStart += currentSpriteLine;
        var spriteTileAddress = spriteTileAddressStart; // Find which VRAM Bank to load from

        var vramBankId = Cpu.GBCEnabled && checkBitOnByte(3, spriteAttributes);
        var spriteDataByteOneForLineOfTilePixels = loadFromVramBank(spriteTileAddress + 0, vramBankId);
        var spriteDataByteTwoForLineOfTilePixels = loadFromVramBank(spriteTileAddress + 1, vramBankId); // Iterate over the width of our sprite to find our individual pixels

        for (var tilePixel = 7; tilePixel >= 0; --tilePixel) {
          // Get our spritePixel, and check for flipping
          var spritePixelXInTile = tilePixel;

          if (flipSpriteX) {
            spritePixelXInTile -= 7;
            spritePixelXInTile = -spritePixelXInTile;
          } // Get the color Id of our sprite, similar to renderBackground()
          // With the first byte, and second byte lined up method thing
          // Yes, the second byte comes before the first, see ./background.ts


          var spriteColorId = 0;

          if (checkBitOnByte(spritePixelXInTile, spriteDataByteTwoForLineOfTilePixels)) {
            // Byte one represents the second bit in our color id, so bit shift
            spriteColorId = spriteColorId + 1 << 1;
          }

          if (checkBitOnByte(spritePixelXInTile, spriteDataByteOneForLineOfTilePixels)) {
            spriteColorId += 1;
          } // ColorId zero (last two bits of pallette) are transparent
          // http://gbdev.gg8.se/wiki/articles/Video_Display


          if (spriteColorId !== 0) {
            // Find our actual X pixel location on the gameboy "camera" view
            // This cannot be less than zero, i32 will overflow
            var spriteXPixelLocationInCameraView = spriteXPosition + (7 - tilePixel);

            if (spriteXPixelLocationInCameraView >= 0 && spriteXPixelLocationInCameraView <= 160) {
              // There are two cases where wouldnt draw the pixel on top of the Bg/window
              // 1. if isSpritePriorityBehindWindowAndBackground, sprite can only draw over color 0
              // 2. if bit 2 of our priority is set, then BG-to-OAM Priority from pandoc
              //  is active, meaning BG tile will have priority above all OBJs
              //  (regardless of the priority bits in OAM memory)
              // But if GBC and Bit 0 of LCDC is set, we always draw the object
              var shouldShowFromLcdcPriority = Cpu.GBCEnabled && !Lcd.bgDisplayEnabled; // LCDC Priority

              var shouldHideFromOamPriority = false;
              var shouldHideFromBgPriority = false;

              if (!shouldShowFromLcdcPriority) {
                // Now that we have our coordinates, check for sprite priority
                // Lets get the priority byte we put in memory
                var bgPriorityByte = getPriorityforPixel(spriteXPixelLocationInCameraView, scanlineRegister);
                var bgColorFromPriorityByte = bgPriorityByte & 0x03; // Doing an else if, since either will automatically stop drawing the pixel

                if (isSpritePriorityBehindWindowAndBackground && bgColorFromPriorityByte > 0) {
                  // OAM Priority
                  shouldHideFromOamPriority = true;
                } else if (Cpu.GBCEnabled && checkBitOnByte(2, bgPriorityByte) && bgColorFromPriorityByte > 0) {
                  // Bg priority
                  shouldHideFromBgPriority = true;
                }
              }

              if (shouldShowFromLcdcPriority || !shouldHideFromOamPriority && !shouldHideFromBgPriority) {
                if (!Cpu.GBCEnabled) {
                  // Get our monochrome color RGB from the current sprite pallete
                  // Get our sprite pallete
                  var spritePaletteLocation = Graphics.memoryLocationSpritePaletteOne;

                  if (checkBitOnByte(4, spriteAttributes)) {
                    spritePaletteLocation = Graphics.memoryLocationSpritePaletteTwo;
                  }

                  var hexColor = getColorizedGbHexColorFromPalette(spriteColorId, spritePaletteLocation); // Finally set the pixel!

                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 0, getRedFromHexColor(hexColor));
                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 1, getGreenFromHexColor(hexColor));
                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 2, getBlueFromHexColor(hexColor));
                } else {
                  // Get our RGB Color
                  // Finally lets add some, C O L O R
                  // Want the botom 3 bits
                  var bgPalette = spriteAttributes & 0x07; // Call the helper function to grab the correct color from the palette

                  var rgbColorPalette = getRgbColorFromPalette(bgPalette, spriteColorId, true); // Split off into red green and blue

                  var red = getColorComponentFromRgb(0, rgbColorPalette);
                  var green = getColorComponentFromRgb(1, rgbColorPalette);
                  var blue = getColorComponentFromRgb(2, rgbColorPalette); // Finally Place our colors on the things

                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 0, red);
                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 1, green);
                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 2, blue);
                }
              }
            }
          }
        }
      }
    }
  } // Main Class and funcitons for rendering the gameboy display


  var Graphics =
  /** @class */
  function () {
    function Graphics() {} // Number of cycles to run in each batch process
    // This number should be in sync so that graphics doesn't run too many cyles at once
    // and does not exceed the minimum number of cyles for either scanlines, or
    // How often we change the frame, or a channel's update process


    Graphics.batchProcessCycles = function () {
      return Graphics.MAX_CYCLES_PER_SCANLINE();
    }; // TCAGBD says 456 per scanline, but 153 only a handful


    Graphics.MAX_CYCLES_PER_SCANLINE = function () {
      if (Graphics.scanlineRegister === 153) {
        return 4 << Cpu.GBCDoubleSpeed;
      } else {
        return 456 << Cpu.GBCDoubleSpeed;
      }
    };

    Graphics.MIN_CYCLES_SPRITES_LCD_MODE = function () {
      // TODO: Confirm these clock cyles, double similar to scanline, which TCAGBD did
      return 376 << Cpu.GBCDoubleSpeed;
    };

    Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE = function () {
      // TODO: Confirm these clock cyles, double similar to scanline, which TCAGBD did
      return 249 << Cpu.GBCDoubleSpeed;
    }; // Function to save the state of the class


    Graphics.saveState = function () {
      // Graphics
      store(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot), Graphics.scanlineCycleCounter);
      store(getSaveStateMemoryOffset(0x04, Graphics.saveStateSlot), Graphics.scanlineRegister);
      store(getSaveStateMemoryOffset(0x05, Graphics.saveStateSlot), Graphics.scrollX);
      store(getSaveStateMemoryOffset(0x06, Graphics.saveStateSlot), Graphics.scrollY);
      store(getSaveStateMemoryOffset(0x07, Graphics.saveStateSlot), Graphics.windowX);
      store(getSaveStateMemoryOffset(0x08, Graphics.saveStateSlot), Graphics.windowY); // LCD

      store(getSaveStateMemoryOffset(0x09, Graphics.saveStateSlot), Lcd.currentLcdMode);
      store(getSaveStateMemoryOffset(0x0a, Graphics.saveStateSlot), Lcd.coincidenceCompare);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Graphics.saveStateSlot), Lcd.enabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0c, Graphics.saveStateSlot), Lcd.windowTileMapDisplaySelect);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0d, Graphics.saveStateSlot), Lcd.windowDisplayEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0e, Graphics.saveStateSlot), Lcd.bgWindowTileDataSelect);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Graphics.saveStateSlot), Lcd.bgTileMapDisplaySelect);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x10, Graphics.saveStateSlot), Lcd.tallSpriteSize);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Graphics.saveStateSlot), Lcd.spriteDisplayEnable);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x12, Graphics.saveStateSlot), Lcd.bgDisplayEnabled);
    }; // Function to load the save state from memory


    Graphics.loadState = function () {
      // Graphics
      Graphics.scanlineCycleCounter = load(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot));
      Graphics.scanlineRegister = load(getSaveStateMemoryOffset(0x04, Graphics.scanlineRegister));
      Graphics.scrollX = load(getSaveStateMemoryOffset(0x05, Graphics.saveStateSlot));
      Graphics.scrollY = load(getSaveStateMemoryOffset(0x06, Graphics.saveStateSlot));
      Graphics.windowX = load(getSaveStateMemoryOffset(0x07, Graphics.saveStateSlot));
      Graphics.windowY = load(getSaveStateMemoryOffset(0x08, Graphics.saveStateSlot)); // LCD

      Lcd.currentLcdMode = load(getSaveStateMemoryOffset(0x09, Graphics.saveStateSlot));
      Lcd.coincidenceCompare = load(getSaveStateMemoryOffset(0x0a, Graphics.saveStateSlot));
      Lcd.enabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Graphics.saveStateSlot));
      Lcd.windowTileMapDisplaySelect = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0c, Graphics.saveStateSlot));
      Lcd.windowDisplayEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0d, Graphics.saveStateSlot));
      Lcd.bgWindowTileDataSelect = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0e, Graphics.saveStateSlot));
      Lcd.bgTileMapDisplaySelect = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Graphics.saveStateSlot));
      Lcd.tallSpriteSize = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x10, Graphics.saveStateSlot));
      Lcd.spriteDisplayEnable = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Graphics.saveStateSlot));
      Lcd.bgDisplayEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x12, Graphics.saveStateSlot));
    }; // Current cycles
    // This will be used for batch processing


    Graphics.currentCycles = 0; // Count the number of cycles to keep synced with cpu cycles
    // Found GBC cycles by finding clock speed from Gb Cycles
    // See TCAGBD For cycles

    Graphics.scanlineCycleCounter = 0x00; // LCD
    // scanlineRegister also known as LY
    // See: http://bgb.bircd.org/pandocs.txt , and search " LY "

    Graphics.memoryLocationScanlineRegister = 0xff44;
    Graphics.scanlineRegister = 0;
    Graphics.memoryLocationDmaTransfer = 0xff46; // Scroll and Window

    Graphics.memoryLocationScrollX = 0xff43;
    Graphics.scrollX = 0;
    Graphics.memoryLocationScrollY = 0xff42;
    Graphics.scrollY = 0;
    Graphics.memoryLocationWindowX = 0xff4b;
    Graphics.windowX = 0;
    Graphics.memoryLocationWindowY = 0xff4a;
    Graphics.windowY = 0; // Tile Maps And Data

    Graphics.memoryLocationTileMapSelectZeroStart = 0x9800;
    Graphics.memoryLocationTileMapSelectOneStart = 0x9c00;
    Graphics.memoryLocationTileDataSelectZeroStart = 0x8800;
    Graphics.memoryLocationTileDataSelectOneStart = 0x8000; // Sprites

    Graphics.memoryLocationSpriteAttributesTable = 0xfe00; // Palettes

    Graphics.memoryLocationBackgroundPalette = 0xff47;
    Graphics.memoryLocationSpritePaletteOne = 0xff48;
    Graphics.memoryLocationSpritePaletteTwo = 0xff49; // Screen data needs to be stored in wasm memory
    // Save States

    Graphics.saveStateSlot = 1;
    return Graphics;
  }(); // Batch Process Graphics
  // http://gameboy.mongenel.com/dmg/asmmemmap.html and http://gbdev.gg8.se/wiki/articles/Video_Display
  // Function to batch process our graphics after we skipped so many cycles
  // This is not currently checked in memory read/write


  function batchProcessGraphics() {
    var batchProcessCycles = Graphics.batchProcessCycles();

    while (Graphics.currentCycles >= batchProcessCycles) {
      updateGraphics(batchProcessCycles);
      Graphics.currentCycles -= batchProcessCycles;
    }
  } // Inlined because closure compiler inlines


  function initializeGraphics() {
    // Reset Stateful Variables
    Graphics.currentCycles = 0;
    Graphics.scanlineCycleCounter = 0x00;
    Graphics.scanlineRegister = 0;
    Graphics.scrollX = 0;
    Graphics.scrollY = 0;
    Graphics.windowX = 0;
    Graphics.windowY = 0;
    Graphics.scanlineRegister = 0x90;

    if (Cpu.GBCEnabled) {
      eightBitStoreIntoGBMemory(0xff41, 0x81); // 0xFF42 -> 0xFF43 = 0x00

      eightBitStoreIntoGBMemory(0xff44, 0x90); // 0xFF45 -> 0xFF46 = 0x00

      eightBitStoreIntoGBMemory(0xff47, 0xfc); // 0xFF48 -> 0xFF4B = 0x00
    } else {
      eightBitStoreIntoGBMemory(0xff41, 0x85); // 0xFF42 -> 0xFF45 = 0x00

      eightBitStoreIntoGBMemory(0xff46, 0xff);
      eightBitStoreIntoGBMemory(0xff47, 0xfc);
      eightBitStoreIntoGBMemory(0xff48, 0xff);
      eightBitStoreIntoGBMemory(0xff49, 0xff); // 0xFF4A -> 0xFF4B = 0x00
      // GBC VRAM Banks (Handled by Memory, initializeCartridge)
    } // Scanline
    // Bgb says LY is 90 on boot


    Graphics.scanlineRegister = 0x90; // LCDC register

    eightBitStoreIntoGBMemory(0xff40, 0x91); // GBC VRAM Banks

    eightBitStoreIntoGBMemory(0xff4f, 0x00);
    eightBitStoreIntoGBMemory(0xff70, 0x01); // Override/reset some variables if the boot ROM is enabled

    if (Cpu.BootROMEnabled) {
      if (Cpu.GBCEnabled) {
        // GBC
        Graphics.scanlineRegister = 0x00;
        eightBitStoreIntoGBMemory(0xff40, 0x00);
        eightBitStoreIntoGBMemory(0xff41, 0x80);
        eightBitStoreIntoGBMemory(0xff44, 0x00);
      } else {
        // GB
        Graphics.scanlineRegister = 0x00;
        eightBitStoreIntoGBMemory(0xff40, 0x00);
        eightBitStoreIntoGBMemory(0xff41, 0x84);
      }
    }

    initializeColors();
  }

  function updateGraphics(numberOfCycles) {
    if (Lcd.enabled) {
      Graphics.scanlineCycleCounter += numberOfCycles;
      var graphicsDisableScanlineRendering = Config.graphicsDisableScanlineRendering;

      while (Graphics.scanlineCycleCounter >= Graphics.MAX_CYCLES_PER_SCANLINE()) {
        // Reset the scanlineCycleCounter
        // Don't set to zero to catch extra cycles
        Graphics.scanlineCycleCounter -= Graphics.MAX_CYCLES_PER_SCANLINE(); // Move to next scanline
        // let scanlineRegister: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);

        var scanlineRegister = Graphics.scanlineRegister; // Check if we've reached the last scanline

        if (scanlineRegister === 144) {
          // Draw the scanline
          if (!graphicsDisableScanlineRendering) {
            _drawScanline(scanlineRegister);
          } else {
            _renderEntireFrame();
          } // Clear the priority map


          clearPriorityMap(); // Reset the tile cache

          resetTileCache();
        } else if (scanlineRegister < 144) {
          // Draw the scanline
          if (!graphicsDisableScanlineRendering) {
            _drawScanline(scanlineRegister);
          }
        } // Post increment the scanline register after drawing
        // TODO: Need to fix graphics timing


        if (scanlineRegister > 153) {
          // Check if we overflowed scanlines
          // if so, reset our scanline number
          scanlineRegister = 0;
        } else {
          scanlineRegister += 1;
        } // Store our new scanline value


        Graphics.scanlineRegister = scanlineRegister; // eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, scanlineRegister);
      }
    } // Games like Pokemon crystal want the vblank right as it turns to the value, and not have it increment after
    // It will break and lead to an infinite loop in crystal
    // Therefore, we want to be checking/Setting our LCD status after the scanline updates


    setLcdStatus();
  } // TODO: Make this a _drawPixelOnScanline, as values can be updated while drawing a scanline


  function _drawScanline(scanlineRegister) {
    // Get our seleted tile data memory location
    var tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;

    if (Lcd.bgWindowTileDataSelect) {
      tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
    } // Check if the background is enabled
    // NOTE: On Gameboy color, Pandocs says this does something completely different
    // LCDC.0 - 2) CGB in CGB Mode: BG and Window Master Priority
    // When Bit 0 is cleared, the background and window lose their priority -
    // the sprites will be always displayed on top of background and window,
    // independently of the priority flags in OAM and BG Map attributes.
    // TODO: Enable this different feature for GBC


    if (Cpu.GBCEnabled || Lcd.bgDisplayEnabled) {
      // Get our map memory location
      var tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;

      if (Lcd.bgTileMapDisplaySelect) {
        tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
      } // Finally, pass everything to draw the background


      renderBackground(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
    } // Check if the window is enabled, and we are currently
    // Drawing lines on the window


    if (Lcd.windowDisplayEnabled) {
      // Get our map memory location
      var tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;

      if (Lcd.windowTileMapDisplaySelect) {
        tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
      } // Finally, pass everything to draw the background


      renderWindow(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
    }

    if (Lcd.spriteDisplayEnable) {
      // Sprites are enabled, render them!
      renderSprites(scanlineRegister, Lcd.tallSpriteSize);
    }
  } // Function to render everything for a frame at once
  // This is to improve performance
  // See above for comments on how things are donw


  function _renderEntireFrame() {
    // Scanline needs to be in sync while we draw, thus, we can't shortcut anymore than here
    for (var i = 0; i <= 144; ++i) {
      _drawScanline(i);
    }
  } // Function to get the start of a RGB pixel (R, G, B)
  // Inlined because closure compiler inlines


  function getRgbPixelStart(x, y) {
    // Get the pixel number
    // let pixelNumber: i32 = (y * 160) + x;
    // Each pixel takes 3 slots, therefore, multiply by 3!
    return (y * 160 + x) * 3;
  } // Also need to store current frame in memory to be read by JS


  function setPixelOnFrame(x, y, colorId, color) {
    // Currently only supports 160x144
    // Storing in X, then y
    // So need an offset
    store(FRAME_LOCATION + getRgbPixelStart(x, y) + colorId, color);
  } // Function to shortcut the memory map, and load directly from the VRAM Bank


  function loadFromVramBank(gameboyOffset, vramBankId) {
    var wasmBoyAddress = gameboyOffset - Memory.videoRamLocation + GAMEBOY_INTERNAL_MEMORY_LOCATION + 0x2000 * (vramBankId & 0x01);
    return load(wasmBoyAddress);
  } // Returns -1 if no trap found, otherwise returns a value that should be fed for the address


  function checkReadTraps(offset) {
    // Cache globals used multiple times for performance
    var videoRamLocation = Memory.videoRamLocation; // Try to break early for most common scenario

    if (offset < videoRamLocation) {
      return -1;
    } // Check the graphics mode to see if we can read VRAM
    // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM


    if (offset >= videoRamLocation && offset < Memory.cartridgeRamLocation) {
      // Can only read/write from VRAM During Modes 0 - 2
      // See graphics/lcd.ts
      // TODO: This can do more harm than good in a beta emulator,
      // requres precise timing, disabling for now
      // if (Graphics.currentLcdMode > 2) {
      //   return 0xFF;
      // }
      return -1;
    } // ECHO Ram, E000	FDFF	Mirror of C000~DDFF (ECHO RAM)
    // http://gbdev.gg8.se/wiki/articles/Memory_Map


    if (offset >= Memory.echoRamLocation && offset < Memory.spriteInformationTableLocation) {
      // Simply return the mirror'd value
      return eightBitLoadFromGBMemory(offset - 0x2000);
    } // Check for individal writes
    // Can only read/write from OAM During Modes 0 - 1
    // See graphics/lcd.ts


    if (offset >= Memory.spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
      // Can only read/write from OAM During Mode 2
      // See graphics/lcd.ts
      // if (Lcd.currentLcdMode < 2) {
      // return 0xff;
      // }
      // Not batch processing here for performance
      // batchProcessGraphics();
      // return -1;
      return Lcd.currentLcdMode < 2 ? 0xff : -1;
    } // CPU


    if (offset === Cpu.memoryLocationSpeedSwitch) {
      // TCAGBD, only Bit 7 and 0 are readable, all others are 1
      var response = 0xff;
      var currentSpeedSwitchRegister = eightBitLoadFromGBMemory(Cpu.memoryLocationSpeedSwitch);

      if (!checkBitOnByte(0, currentSpeedSwitchRegister)) {
        response = resetBitOnByte(0, response);
      }

      if (!Cpu.GBCDoubleSpeed) {
        response = resetBitOnByte(7, response);
      }

      return response;
    } // Graphics
    // Not batch processing here for performance
    // batchProcessGraphics();


    if (offset === Graphics.memoryLocationScanlineRegister) {
      eightBitStoreIntoGBMemory(offset, Graphics.scanlineRegister);
      return Graphics.scanlineRegister;
    } // Sound
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
    // TODO: Put these bounds on the Sound Class


    if (offset >= 0xff10 && offset <= 0xff26) {
      batchProcessAudio();
      return SoundRegisterReadTraps(offset);
    } // FF27 - FF2F not used
    // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Register_Reading
    // Always read as 0xFF


    if (offset >= 0xff27 && offset <= 0xff2f) {
      return 0xff;
    } // Final Wave Table for Channel 3


    if (offset >= 0xff30 && offset <= 0xff3f) {
      batchProcessAudio();

      if (Channel3.isEnabled) {
        return Channel3.handleWaveRamRead();
      }

      return -1;
    } // Timers


    if (offset === Timers.memoryLocationDividerRegister) {
      // Divider register in memory is just the upper 8 bits
      // http://gbdev.gg8.se/wiki/articles/Timer_Obscure_Behaviour
      var upperDividerRegisterBits = splitHighByte(Timers.dividerRegister);
      eightBitStoreIntoGBMemory(offset, upperDividerRegisterBits);
      return upperDividerRegisterBits;
    }

    if (offset === Timers.memoryLocationTimerCounter) {
      eightBitStoreIntoGBMemory(offset, Timers.timerCounter);
      return Timers.timerCounter;
    } // Interrupts


    if (offset === Interrupts.memoryLocationInterruptRequest) {
      // TCAGB and BGB say the top 5 bits are always 1.
      return 0xe0 | Interrupts.interruptsRequestedValue;
    } // Joypad


    if (offset === Joypad.memoryLocationJoypadRegister) {
      return getJoypadState();
    }

    return -1;
  } // Load/Read functionality for memory


  function eightBitLoadFromGBMemory(gameboyOffset) {
    return load(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset));
  }

  function eightBitLoadFromGBMemoryWithTraps(offset) {
    if (offset === Breakpoints.readGbMemory) {
      Breakpoints.reachedBreakpoint = true;
    }

    var readTrapResult = checkReadTraps(offset);
    return readTrapResult === -1 ? eightBitLoadFromGBMemory(offset) : readTrapResult;
  } // TODO: Rename this to sixteenBitLoadFromGBMemoryWithTraps
  // Inlined because closure compiler inlines


  function sixteenBitLoadFromGBMemory(offset) {
    // Get our low byte
    var lowByteReadTrapResult = checkReadTraps(offset);
    var lowByte = lowByteReadTrapResult === -1 ? eightBitLoadFromGBMemory(offset) : lowByteReadTrapResult; // Get the next offset for the second byte

    var nextOffset = offset + 1; // Get our high byte

    var highByteReadTrapResult = checkReadTraps(nextOffset);
    var highByte = highByteReadTrapResult === -1 ? eightBitLoadFromGBMemory(nextOffset) : highByteReadTrapResult; // Concatenate the bytes and return

    return concatenateBytes(highByte, lowByte);
  }

  function loadBooleanDirectlyFromWasmMemory(offset) {
    return load(offset) > 0;
  } // WasmBoy memory map:


  var Memory =
  /** @class */
  function () {
    function Memory() {} // Function to save the state of the class


    Memory.saveState = function () {
      store(getSaveStateMemoryOffset(0x00, Memory.saveStateSlot), Memory.currentRomBank);
      store(getSaveStateMemoryOffset(0x02, Memory.saveStateSlot), Memory.currentRamBank);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x04, Memory.saveStateSlot), Memory.isRamBankingEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x05, Memory.saveStateSlot), Memory.isMBC1RomModeEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x06, Memory.saveStateSlot), Memory.isRomOnly);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x07, Memory.saveStateSlot), Memory.isMBC1);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x08, Memory.saveStateSlot), Memory.isMBC2);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x09, Memory.saveStateSlot), Memory.isMBC3);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0a, Memory.saveStateSlot), Memory.isMBC5);
      store(getSaveStateMemoryOffset(0x0b, Memory.saveStateSlot), Memory.DMACycles);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0f, Memory.saveStateSlot), Memory.isHblankHdmaActive);
      store(getSaveStateMemoryOffset(0x10, Memory.saveStateSlot), Memory.hblankHdmaTransferLengthRemaining);
      store(getSaveStateMemoryOffset(0x14, Memory.saveStateSlot), Memory.hblankHdmaSource);
      store(getSaveStateMemoryOffset(0x18, Memory.saveStateSlot), Memory.hblankHdmaDestination);
    }; // Function to load the save state from memory


    Memory.loadState = function () {
      Memory.currentRomBank = load(getSaveStateMemoryOffset(0x00, Memory.saveStateSlot));
      Memory.currentRamBank = load(getSaveStateMemoryOffset(0x02, Memory.saveStateSlot));
      Memory.isRamBankingEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x04, Memory.saveStateSlot));
      Memory.isMBC1RomModeEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x05, Memory.saveStateSlot));
      Memory.isRomOnly = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x06, Memory.saveStateSlot));
      Memory.isMBC1 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x07, Memory.saveStateSlot));
      Memory.isMBC2 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x08, Memory.saveStateSlot));
      Memory.isMBC3 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x09, Memory.saveStateSlot));
      Memory.isMBC5 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0a, Memory.saveStateSlot));
      Memory.DMACycles = load(getSaveStateMemoryOffset(0x0b, Memory.saveStateSlot));
      Memory.isHblankHdmaActive = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0f, Memory.saveStateSlot));
      Memory.hblankHdmaTransferLengthRemaining = load(getSaveStateMemoryOffset(0x10, Memory.saveStateSlot));
      Memory.hblankHdmaSource = load(getSaveStateMemoryOffset(0x14, Memory.saveStateSlot));
      Memory.hblankHdmaDestination = load(getSaveStateMemoryOffset(0x18, Memory.saveStateSlot));
    }; // ----------------------------------
    // Gameboy Memory Map
    // ----------------------------------
    // https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
    // http://gameboy.mongenel.com/dmg/asmmemmap.html
    // using Arrays, first index is start, second is end


    Memory.cartridgeRomLocation = 0x0000;
    Memory.switchableCartridgeRomLocation = 0x4000;
    Memory.videoRamLocation = 0x8000;
    Memory.cartridgeRamLocation = 0xa000;
    Memory.internalRamBankZeroLocation = 0xc000; // This ram bank is switchable

    Memory.internalRamBankOneLocation = 0xd000;
    Memory.echoRamLocation = 0xe000;
    Memory.spriteInformationTableLocation = 0xfe00;
    Memory.spriteInformationTableLocationEnd = 0xfe9f;
    Memory.unusableMemoryLocation = 0xfea0;
    Memory.unusableMemoryEndLocation = 0xfeff; // Hardware I/O, 0xFF00 -> 0xFF7F
    // Zero Page, 0xFF80 -> 0xFFFE
    // Intterupt Enable Flag, 0xFFFF
    // ----------------------------------
    // Rom/Ram Banking
    // ----------------------------------
    // http://gbdev.gg8.se/wiki/articles/Memory_Bank_Controllers#MBC3_.28max_2MByte_ROM_and.2For_32KByte_RAM_and_Timer.29
    // http://www.codeslinger.co.uk/pages/projects/gameboy/banking.html

    Memory.currentRomBank = 0x00;
    Memory.currentRamBank = 0x00;
    Memory.isRamBankingEnabled = false;
    Memory.isMBC1RomModeEnabled = true; // Cartridge Types
    // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header

    Memory.isRomOnly = true;
    Memory.isMBC1 = false;
    Memory.isMBC2 = false;
    Memory.isMBC3 = false;
    Memory.isMBC5 = false; // DMA

    Memory.memoryLocationHdmaSourceHigh = 0xff51;
    Memory.memoryLocationHdmaSourceLow = 0xff52;
    Memory.memoryLocationHdmaDestinationHigh = 0xff53;
    Memory.memoryLocationHdmaDestinationLow = 0xff54;
    Memory.memoryLocationHdmaTrigger = 0xff55; // Cycles accumulated for DMA

    Memory.DMACycles = 0; // Boolean we will mirror to indicate if Hdma is active

    Memory.isHblankHdmaActive = false;
    Memory.hblankHdmaTransferLengthRemaining = 0x00; // Store the source and destination for performance, and update as needed

    Memory.hblankHdmaSource = 0x00;
    Memory.hblankHdmaDestination = 0x00; // GBC Registers

    Memory.memoryLocationGBCVRAMBank = 0xff4f;
    Memory.memoryLocationGBCWRAMBank = 0xff70; // Save States

    Memory.saveStateSlot = 4;
    return Memory;
  }(); // Inlined because closure compiler inlines


  function initializeCartridge() {
    // Reset stateful variables
    Memory.isRamBankingEnabled = false;
    Memory.isMBC1RomModeEnabled = true; // Get our game MBC type from the cartridge header
    // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header

    var cartridgeType = eightBitLoadFromGBMemory(0x0147); // Reset our Cartridge types

    Memory.isRomOnly = cartridgeType === 0x00;
    Memory.isMBC1 = cartridgeType >= 0x01 && cartridgeType <= 0x03;
    Memory.isMBC2 = cartridgeType >= 0x05 && cartridgeType <= 0x06;
    Memory.isMBC3 = cartridgeType >= 0x0f && cartridgeType <= 0x13;
    Memory.isMBC5 = cartridgeType >= 0x19 && cartridgeType <= 0x1e;
    Memory.currentRomBank = 0x01;
    Memory.currentRamBank = 0x00; // Set our GBC Banks

    eightBitStoreIntoGBMemory(Memory.memoryLocationGBCVRAMBank, 0x00);
    eightBitStoreIntoGBMemory(Memory.memoryLocationGBCWRAMBank, 0x01);
  } // WasmBoy memory map:
  // Everything Static as class instances just aren't quite there yet
  // https://github.com/AssemblyScript/assemblyscript/blob/master/tests/compiler/showcase.ts


  var Cpu =
  /** @class */
  function () {
    function Cpu() {}

    Cpu.CLOCK_SPEED = function () {
      // 2^23, thanks binji!
      // return Cpu.GBCDoubleSpeed ? 8388608 : 4194304;
      return 4194304 << Cpu.GBCDoubleSpeed;
    }; // Cycles Per Frame = Clock Speed / fps
    // So: 4194304 / 59.73


    Cpu.MAX_CYCLES_PER_FRAME = function () {
      // return Cpu.GBCDoubleSpeed ? 140448 : 70224;
      return 70224 << Cpu.GBCDoubleSpeed;
    }; // See section 4.10 of TCAGBD
    // Cpu Halting explained: https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/db7xnbe/


    Cpu.enableHalt = function () {
      if (Interrupts.masterInterruptSwitch) {
        Cpu.isHaltNormal = true;
        return;
      }

      var haltTypeValue = Interrupts.interruptsEnabledValue & Interrupts.interruptsRequestedValue & 0x1f;

      if (haltTypeValue === 0) {
        Cpu.isHaltNoJump = true;
        return;
      }

      Cpu.isHaltBug = true;
    };

    Cpu.exitHaltAndStop = function () {
      Cpu.isHaltNoJump = false;
      Cpu.isHaltNormal = false;
      Cpu.isHaltBug = false;
      Cpu.isStopped = false;
    };

    Cpu.isHalted = function () {
      return Cpu.isHaltNormal || Cpu.isHaltNoJump;
    }; // Function to save the state of the class


    Cpu.saveState = function () {
      // Registers
      store(getSaveStateMemoryOffset(0x00, Cpu.saveStateSlot), Cpu.registerA);
      store(getSaveStateMemoryOffset(0x01, Cpu.saveStateSlot), Cpu.registerB);
      store(getSaveStateMemoryOffset(0x02, Cpu.saveStateSlot), Cpu.registerC);
      store(getSaveStateMemoryOffset(0x03, Cpu.saveStateSlot), Cpu.registerD);
      store(getSaveStateMemoryOffset(0x04, Cpu.saveStateSlot), Cpu.registerE);
      store(getSaveStateMemoryOffset(0x05, Cpu.saveStateSlot), Cpu.registerH);
      store(getSaveStateMemoryOffset(0x06, Cpu.saveStateSlot), Cpu.registerL);
      store(getSaveStateMemoryOffset(0x07, Cpu.saveStateSlot), Cpu.registerF);
      store(getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot), Cpu.stackPointer);
      store(getSaveStateMemoryOffset(0x0a, Cpu.saveStateSlot), Cpu.programCounter);
      store(getSaveStateMemoryOffset(0x0c, Cpu.saveStateSlot), Cpu.currentCycles);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot), Cpu.isHaltNormal);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot), Cpu.isHaltNoJump);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x13, Cpu.saveStateSlot), Cpu.isHaltBug);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x14, Cpu.saveStateSlot), Cpu.isStopped);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x15, Cpu.saveStateSlot), Cpu.BootROMEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x16, Cpu.saveStateSlot), Cpu.GBCEnabled);
      storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x17, Cpu.saveStateSlot), Cpu.GBCDoubleSpeed);
    }; // Function to load the save state from memory


    Cpu.loadState = function () {
      // Registers
      Cpu.registerA = load(getSaveStateMemoryOffset(0x00, Cpu.saveStateSlot));
      Cpu.registerB = load(getSaveStateMemoryOffset(0x01, Cpu.saveStateSlot));
      Cpu.registerC = load(getSaveStateMemoryOffset(0x02, Cpu.saveStateSlot));
      Cpu.registerD = load(getSaveStateMemoryOffset(0x03, Cpu.saveStateSlot));
      Cpu.registerE = load(getSaveStateMemoryOffset(0x04, Cpu.saveStateSlot));
      Cpu.registerH = load(getSaveStateMemoryOffset(0x05, Cpu.saveStateSlot));
      Cpu.registerL = load(getSaveStateMemoryOffset(0x06, Cpu.saveStateSlot));
      Cpu.registerF = load(getSaveStateMemoryOffset(0x07, Cpu.saveStateSlot));
      Cpu.stackPointer = load(getSaveStateMemoryOffset(0x08, Cpu.saveStateSlot));
      Cpu.programCounter = load(getSaveStateMemoryOffset(0x0a, Cpu.saveStateSlot));
      Cpu.currentCycles = load(getSaveStateMemoryOffset(0x0c, Cpu.saveStateSlot));
      Cpu.isHaltNormal = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x11, Cpu.saveStateSlot));
      Cpu.isHaltNoJump = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x12, Cpu.saveStateSlot));
      Cpu.isHaltBug = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x13, Cpu.saveStateSlot));
      Cpu.isStopped = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x14, Cpu.saveStateSlot));
      Cpu.BootROMEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x15, Cpu.saveStateSlot));
      Cpu.GBCEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x16, Cpu.saveStateSlot));
      Cpu.GBCDoubleSpeed = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x17, Cpu.saveStateSlot));
    }; // Status to track if we are currently executing the boot rom


    Cpu.memoryLocationBootROMSwitch = 0xff50;
    Cpu.BootROMEnabled = false; // Status to track if we are in Gameboy Color Mode, and GBC State

    Cpu.GBCEnabled = false; // Memory Location for the GBC Speed switch
    // And the current status

    Cpu.memoryLocationSpeedSwitch = 0xff4d;
    Cpu.GBCDoubleSpeed = false; // 8-bit Cpu.registers

    Cpu.registerA = 0;
    Cpu.registerB = 0;
    Cpu.registerC = 0;
    Cpu.registerD = 0;
    Cpu.registerE = 0;
    Cpu.registerH = 0;
    Cpu.registerL = 0;
    Cpu.registerF = 0; // 16-bit Cpu.registers

    Cpu.stackPointer = 0; // Boot rom from 0x00 to 0x99, all games start at 0x100

    Cpu.programCounter = 0x00; // Current number of cycles, shouldn't execeed max number of cycles

    Cpu.currentCycles = 0; // HALT and STOP instructions need to stop running opcodes, but simply check timers
    // https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
    // Matt said is should work to, so it must work!
    // TCAGBD shows three different HALT states. Therefore, we need to handle each

    Cpu.isHaltNormal = false;
    Cpu.isHaltNoJump = false;
    Cpu.isHaltBug = false;
    Cpu.isStopped = false; // Save States

    Cpu.saveStateSlot = 0;
    return Cpu;
  }(); // Inlined because closure compiler does so


  function initializeCpu() {
    // Reset all stateful Cpu variables
    // Cpu.GBCEnabled is done by core/initialize
    Cpu.GBCDoubleSpeed = false;
    Cpu.registerA = 0;
    Cpu.registerB = 0;
    Cpu.registerC = 0;
    Cpu.registerD = 0;
    Cpu.registerE = 0;
    Cpu.registerH = 0;
    Cpu.registerL = 0;
    Cpu.registerF = 0;
    Cpu.stackPointer = 0;
    Cpu.programCounter = 0x00;
    Cpu.currentCycles = 0;
    Cpu.isHaltNormal = false;
    Cpu.isHaltNoJump = false;
    Cpu.isHaltBug = false;
    Cpu.isStopped = false; // Everything is done by Boot ROM is enabled.

    if (Cpu.BootROMEnabled) {
      return;
    }

    if (Cpu.GBCEnabled) {
      // CPU Registers
      Cpu.registerA = 0x11;
      Cpu.registerF = 0x80;
      Cpu.registerB = 0x00;
      Cpu.registerC = 0x00;
      Cpu.registerD = 0xff;
      Cpu.registerE = 0x56;
      Cpu.registerH = 0x00;
      Cpu.registerL = 0x0d;
    } else {
      // Cpu Registers
      Cpu.registerA = 0x01;
      Cpu.registerF = 0xb0;
      Cpu.registerB = 0x00;
      Cpu.registerC = 0x13;
      Cpu.registerD = 0x00;
      Cpu.registerE = 0xd8;
      Cpu.registerH = 0x01;
      Cpu.registerL = 0x4d;
    } // Cpu Control Flow


    Cpu.programCounter = 0x100;
    Cpu.stackPointer = 0xfffe;
  } // Imports
  // General Logic Instructions
  // Such as the ones found on the CB table and 0x40 - 0xBF
  // NOTE: Only CB table uses these for now, was mostly me realizing that I messed up, trying to be all cute and verbose :p
  // NOTE: TODO: Refactor honestly shouldn't take that long, and may happen once assembly script is improved


  function addARegister(register) {
    var registerA = Cpu.registerA;
    checkAndSetEightBitHalfCarryFlag(registerA, register);
    checkAndSetEightBitCarryFlag(registerA, register);
    registerA = u8Portable(registerA + register);
    Cpu.registerA = registerA;
    setZeroFlag$$1(registerA === 0);
    setSubtractFlag(0);
  }

  function addAThroughCarryRegister(register) {
    // Handling flags manually as they require some special overflow
    // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
    // CTRL+F adc
    var registerA = Cpu.registerA;
    var result = u8Portable(registerA + register + getCarryFlag$$1());
    setHalfCarryFlag((u8Portable(registerA ^ register ^ result) & 0x10) != 0);
    var overflowedResult = u16Portable(registerA + register + getCarryFlag$$1());
    setCarryFlag((overflowedResult & 0x100) > 0);
    Cpu.registerA = result;
    setZeroFlag$$1(result === 0);
    setSubtractFlag(0);
  }

  function subARegister(register) {
    // Need to convert the register on one line, and flip the sign on another
    var negativeRegister = register;
    negativeRegister = negativeRegister * -1;
    var registerA = Cpu.registerA;
    checkAndSetEightBitHalfCarryFlag(registerA, negativeRegister);
    checkAndSetEightBitCarryFlag(registerA, negativeRegister);
    registerA = u8Portable(registerA - register);
    Cpu.registerA = registerA;
    setZeroFlag$$1(registerA === 0);
    setSubtractFlag(1);
  }

  function subAThroughCarryRegister(register) {
    // Handling flags manually as they require some special overflow
    // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
    // CTRL+F adc
    var registerA = Cpu.registerA;
    var result = u8Portable(registerA - register - getCarryFlag$$1());
    var carryRegisterCheck = u8Portable((registerA ^ register ^ result) & 0x10);
    setHalfCarryFlag(carryRegisterCheck != 0);
    var overflowedResult = u16Portable(registerA - register - getCarryFlag$$1());
    setCarryFlag((overflowedResult & 0x100) > 0);
    Cpu.registerA = result;
    setZeroFlag$$1(result === 0);
    setSubtractFlag(1);
  }

  function andARegister(register) {
    var registerA = Cpu.registerA & register;
    Cpu.registerA = registerA;
    setZeroFlag$$1(registerA === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    setCarryFlag(0);
  }

  function xorARegister(register) {
    var registerA = u8Portable(Cpu.registerA ^ register);
    Cpu.registerA = registerA;
    setZeroFlag$$1(registerA === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
  }

  function orARegister(register) {
    var registerA = Cpu.registerA | register;
    Cpu.registerA = registerA;
    setZeroFlag$$1(registerA === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
  }

  function cpARegister(register) {
    // 0xB8 - 0xBF
    // CP B
    // 1  4
    // Z 1 H C
    var registerA = Cpu.registerA;
    var negativeRegister = register;
    negativeRegister = negativeRegister * -1;
    checkAndSetEightBitHalfCarryFlag(registerA, negativeRegister);
    checkAndSetEightBitCarryFlag(registerA, negativeRegister);
    var tempResult = registerA + negativeRegister;
    setZeroFlag$$1(tempResult === 0);
    setSubtractFlag(1);
  } // Inlined because closure compiler inlines


  function rotateRegisterLeft(register) {
    // RLC register 8-bit
    // Z 0 0 C
    setCarryFlag((register & 0x80) === 0x80);
    register = rotateByteLeft(register);
    setZeroFlag$$1(register === 0); // Set all other flags to zero

    setSubtractFlag(0);
    setHalfCarryFlag(0); // Return the register

    return register;
  } // Inlined because closure compiler inlines


  function rotateRegisterRight(register) {
    // RLC register 8-bit
    // Z 0 0 C
    // Check for the last bit, to see if it will be carried
    setCarryFlag((register & 0x01) > 0);
    register = rotateByteRight(register);
    setZeroFlag$$1(register === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0); // Return the register

    return register;
  } // Inlined because closure compiler inlines


  function rotateRegisterLeftThroughCarry(register) {
    // RL register 8-bit
    // Z 0 0 C
    // setting has first bit since we need to use carry
    var hasHighbit = (register & 0x80) === 0x80;
    register = rotateByteLeftThroughCarry(register);
    setCarryFlag(hasHighbit);
    setZeroFlag$$1(register === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    return register;
  } // Inlined because closure compiler inlines


  function rotateRegisterRightThroughCarry(register) {
    // RR register 8-bit
    // Z 0 0 C
    var hasLowBit = (register & 0x01) === 0x01;
    register = rotateByteRightThroughCarry(register);
    setCarryFlag(hasLowBit);
    setZeroFlag$$1(register === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    return register;
  } // Inlined because closure compiler inlines


  function shiftLeftRegister(register) {
    // SLA register 8-bit
    // Z 0 0 C
    var hasHighbit = (register & 0x80) === 0x80;
    register = u8Portable(register << 1);
    setCarryFlag(hasHighbit);
    setZeroFlag$$1(register === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    return register;
  } // Inlined because closure compiler inlines


  function shiftRightArithmeticRegister(register) {
    // SRA register 8-bit
    // Z 0 0 C
    // NOTE: This C flag may need to be set to 0;
    // This preserves the MSB (Most significant bit)
    var hasHighbit = (register & 0x80) === 0x80;
    var hasLowbit = (register & 0x01) === 0x01;
    register = u8Portable(register >> 1);

    if (hasHighbit) {
      register = register | 0x80;
    }

    setZeroFlag$$1(register === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(hasLowbit);
    return register;
  } // Inlined because closure compiler inlines


  function swapNibblesOnRegister(register) {
    // SWAP register 8-bit
    // Z 0 0 0
    var highNibble = register & 0xf0;
    var lowNibble = register & 0x0f;
    register = u8Portable(lowNibble << 4 | highNibble >> 4);
    setZeroFlag$$1(register === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(0);
    return register;
  } // Inlined because closure compiler inlines


  function shiftRightLogicalRegister(register) {
    // SRA register 8-bit
    // Z 0 0 C
    // NOTE: This C flag may need to be set to 0;
    // This does NOT preserve MSB (most significant bit)
    var hasLowbit = (register & 0x01) === 0x01;
    register = u8Portable(register >> 1);
    setZeroFlag$$1(register === 0);
    setSubtractFlag(0);
    setHalfCarryFlag(0);
    setCarryFlag(hasLowbit);
    return register;
  }

  function testBitOnRegister(bitPosition, register) {
    // BIT bitPosition ,register 8-bit
    // Z 0 1 -
    var testByte = 0x01 << bitPosition;
    var result = register & testByte;
    setZeroFlag$$1(result === 0x00);
    setSubtractFlag(0);
    setHalfCarryFlag(1);
    return register;
  }

  function setBitOnRegister(bitPosition, bitValue, register) {
    // RES 0,B or SET 0,B depending on bit value
    if (bitValue > 0) {
      var setByte = 0x01 << bitPosition;
      register = register | setByte;
    } else {
      // NOT (byte we want)
      // 0000 0100 becomes 1111 1011
      var setByte = ~(0x01 << bitPosition);
      register = register & setByte;
    }

    return register;
  } // Private function for our relative jumps


  function relativeJump(value) {
    // Need to convert the value to i8, since in this case, u8 can be negative
    var relativeJumpOffset = i8Portable(value);
    var programCounter = Cpu.programCounter;
    programCounter = u16Portable(programCounter + relativeJumpOffset); // Realtive jump, using bgb debugger
    // and my debugger shows,
    // on JR you need to jump to the relative jump offset,
    // However, if the jump fails (such as conditional), only jump +2 in total

    programCounter = u16Portable(programCounter + 1);
    Cpu.programCounter = programCounter;
  } // Imports
  // Handle CB Opcodes
  // NOTE: Program stpes and cycles are standardized depending on the register type
  // NOTE: Doing some funny stuff to get around not having arrays or objects
  // Inlined because closure compiler inlines.


  function handleCbOpcode(cbOpcode) {
    var numberOfCycles = -1;
    var handledOpcode = false; // The result of our cb logic instruction

    var instructionRegisterValue = 0;
    var instructionRegisterResult = 0; // Get our register number by modulo 0x08 (number of registers)
    // cbOpcode % 0x08

    var registerNumber = cbOpcode & 0x07; // NOTE: registerNumber = register on CB table. Cpu.registerB = 0, Cpu.registerC = 1....Cpu.registerA = 7

    switch (registerNumber) {
      case 0:
        instructionRegisterValue = Cpu.registerB;
        break;

      case 1:
        instructionRegisterValue = Cpu.registerC;
        break;

      case 2:
        instructionRegisterValue = Cpu.registerD;
        break;

      case 3:
        instructionRegisterValue = Cpu.registerE;
        break;

      case 4:
        instructionRegisterValue = Cpu.registerH;
        break;

      case 5:
        instructionRegisterValue = Cpu.registerL;
        break;

      case 6:
        // Value at register HL
        // 4 cycles
        instructionRegisterValue = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        break;

      case 7:
        instructionRegisterValue = Cpu.registerA;
        break;
    } // Grab the high nibble to perform skips to speed up performance


    var opcodeHighNibble = cbOpcode & 0xf0;
    opcodeHighNibble = opcodeHighNibble >> 4; // Send to the correct function

    switch (opcodeHighNibble) {
      case 0x00:
        if (cbOpcode <= 0x07) {
          // RLC register 8-bit
          // Z 0 0 C
          instructionRegisterResult = rotateRegisterLeft(instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x0f) {
          // RRC register 8-bit
          // Z 0 0 C
          instructionRegisterResult = rotateRegisterRight(instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x01:
        if (cbOpcode <= 0x17) {
          // RL register 8-bit
          // Z 0 0 C
          instructionRegisterResult = rotateRegisterLeftThroughCarry(instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x1f) {
          // RR register 8-bit
          // Z 0 0 C
          instructionRegisterResult = rotateRegisterRightThroughCarry(instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x02:
        if (cbOpcode <= 0x27) {
          // SLA register 8-bit
          // Z 0 0 C
          instructionRegisterResult = shiftLeftRegister(instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x2f) {
          // SRA register 8-bit
          // Z 0 0 0
          instructionRegisterResult = shiftRightArithmeticRegister(instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x03:
        if (cbOpcode <= 0x37) {
          // SWAP register 8-bit
          // Z 0 0 0
          instructionRegisterResult = swapNibblesOnRegister(instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x3f) {
          // SRL B
          // Z 0 0 C
          instructionRegisterResult = shiftRightLogicalRegister(instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x04:
        if (cbOpcode <= 0x47) {
          // BIT 0,register 8-bit
          // Z 0 1 -
          //TODO: Optimize this not to do logic of setting register back
          instructionRegisterResult = testBitOnRegister(0, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x4f) {
          // BIT 1,register 8-bit
          // Z 0 1 -
          instructionRegisterResult = testBitOnRegister(1, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x05:
        if (cbOpcode <= 0x57) {
          // BIT 2,register 8-bit
          // Z 0 1 -
          instructionRegisterResult = testBitOnRegister(2, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x5f) {
          // BIT 3,register 8-bit
          // Z 0 1 -
          instructionRegisterResult = testBitOnRegister(3, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x06:
        if (cbOpcode <= 0x67) {
          // BIT 4,register 8-bit
          // Z 0 1 -
          instructionRegisterResult = testBitOnRegister(4, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x6f) {
          // BIT 5,register 8-bit
          // Z 0 1 -
          instructionRegisterResult = testBitOnRegister(5, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x07:
        if (cbOpcode <= 0x77) {
          // BIT 6,register 8-bit
          // Z 0 1 -
          instructionRegisterResult = testBitOnRegister(6, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x7f) {
          // BIT 7,register 8-bit
          // Z 0 1 -
          instructionRegisterResult = testBitOnRegister(7, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x08:
        if (cbOpcode <= 0x87) {
          // Res 0,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(0, 0, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x8f) {
          // Res 1,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(1, 0, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x09:
        if (cbOpcode <= 0x97) {
          // Res 2,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(2, 0, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0x9f) {
          // Res 3,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(3, 0, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x0a:
        if (cbOpcode <= 0xa7) {
          // Res 4,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(4, 0, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0xaf) {
          // Res 5,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(5, 0, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x0b:
        if (cbOpcode <= 0xb7) {
          // Res 6,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(6, 0, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0xbf) {
          // Res 7,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(7, 0, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x0c:
        if (cbOpcode <= 0xc7) {
          // SET 0,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(0, 1, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0xcf) {
          // SET 1,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(1, 1, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x0d:
        if (cbOpcode <= 0xd7) {
          // SET 2,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(2, 1, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0xdf) {
          // SET 3,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(3, 1, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x0e:
        if (cbOpcode <= 0xe7) {
          // SET 4,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(4, 1, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0xef) {
          // SET 5,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(5, 1, instructionRegisterValue);
          handledOpcode = true;
        }

        break;

      case 0x0f:
        if (cbOpcode <= 0xf7) {
          // SET 6,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(6, 1, instructionRegisterValue);
          handledOpcode = true;
        } else if (cbOpcode <= 0xff) {
          // SET 7,register 8-bit
          // - - - -
          instructionRegisterResult = setBitOnRegister(7, 1, instructionRegisterValue);
          handledOpcode = true;
        }

        break;
    } // Finally Pass back into the correct register


    switch (registerNumber) {
      case 0:
        Cpu.registerB = instructionRegisterResult;
        break;

      case 1:
        Cpu.registerC = instructionRegisterResult;
        break;

      case 2:
        Cpu.registerD = instructionRegisterResult;
        break;

      case 3:
        Cpu.registerE = instructionRegisterResult;
        break;

      case 4:
        Cpu.registerH = instructionRegisterResult;
        break;

      case 5:
        Cpu.registerL = instructionRegisterResult;
        break;

      case 6:
        // Value at register HL
        // Opcodes 0x40 -> 0x7F only do simple
        // Bit test, and don't need to be stored back in memory
        // Thus they take 4 less cycles to run
        if (opcodeHighNibble < 0x04 || opcodeHighNibble > 0x07) {
          // Store the result back
          // 4 cycles
          eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), instructionRegisterResult);
        }

        break;

      case 7:
        Cpu.registerA = instructionRegisterResult;
        break;
    } // Finally our number of cycles
    // Set if we handled the opcode


    if (handledOpcode) {
      numberOfCycles = 4;
    } // Return our number of cycles


    return numberOfCycles;
  } // Imports
  // Take in any opcode, and decode it, and return the number of cycles
  // Program counter can be gotten from getProgramCounter();
  // Setting return value to i32 instead of u16, as we want to return a negative number on error
  // https://rednex.github.io/rgbds/gbz80.7.html
  // http://pastraiser.com/cpu/gameboy/gameboyopcodes.html


  function executeOpcode$$1(opcode) {
    // Always implement the program counter by one
    // Any other value can just subtract or add however much offset before reaching this line
    var programCounter = Cpu.programCounter;
    programCounter = u16Portable(programCounter + 1); // Check if we are in the halt bug

    if (Cpu.isHaltBug) {
      // Need to not increment program counter,
      // thus, running the next opcode twice
      // E.g
      // 0x76 - halt
      // FA 34 12 - ld a,(1234)
      // Becomes
      // FA FA 34 ld a,(34FA)
      // 12 ld (de),a
      programCounter = u16Portable(programCounter - 1);
    }

    Cpu.programCounter = programCounter; // Split our opcode into a high nibble to speed up performance
    // Running 255 if statements is slow, even in wasm haha!

    var opcodeHighNibble = opcode & 0xf0;
    opcodeHighNibble = opcodeHighNibble >> 4; // NOTE: @binji rule of thumb: it takes 4 cpu cycles to read one byte
    // Therefore isntructions that use more than just the opcode (databyte one and two) will take at least
    // 8 cyckles to use getDataByteOne(), and two cycles to use the concatented
    // Not using a switch statement to avoid cannot redeclare this variable errors
    // And it would be a ton of work :p

    switch (opcodeHighNibble) {
      case 0x00:
        return handleOpcode0x(opcode);

      case 0x01:
        return handleOpcode1x(opcode);

      case 0x02:
        return handleOpcode2x(opcode);

      case 0x03:
        return handleOpcode3x(opcode);

      case 0x04:
        return handleOpcode4x(opcode);

      case 0x05:
        return handleOpcode5x(opcode);

      case 0x06:
        return handleOpcode6x(opcode);

      case 0x07:
        return handleOpcode7x(opcode);

      case 0x08:
        return handleOpcode8x(opcode);

      case 0x09:
        return handleOpcode9x(opcode);

      case 0x0a:
        return handleOpcodeAx(opcode);

      case 0x0b:
        return handleOpcodeBx(opcode);

      case 0x0c:
        return handleOpcodeCx(opcode);

      case 0x0d:
        return handleOpcodeDx(opcode);

      case 0x0e:
        return handleOpcodeEx(opcode);

      default:
        return handleOpcodeFx(opcode);
    }
  } // Wrapper functions around loading and storing memory, and syncing those cycles


  function eightBitLoadSyncCycles(gameboyOffset) {
    syncCycles(4);
    return eightBitLoadFromGBMemoryWithTraps(gameboyOffset);
  }

  function eightBitStoreSyncCycles(gameboyOffset, value) {
    syncCycles(4);
    eightBitStoreIntoGBMemoryWithTraps(gameboyOffset, value);
  }

  function sixteenBitLoadSyncCycles(gameboyOffset) {
    syncCycles(8); // sixteen bit load has traps even though it has no label

    return sixteenBitLoadFromGBMemory(gameboyOffset);
  }

  function sixteenBitStoreSyncCycles(gameboyOffset, value) {
    syncCycles(8);
    sixteenBitStoreIntoGBMemoryWithTraps(gameboyOffset, value);
  } // Functions to access the next operands of a opcode, reffering to them as "dataBytes"


  function getDataByteOne() {
    syncCycles(4);
    return eightBitLoadFromGBMemory(Cpu.programCounter);
  }

  function getDataByteTwo() {
    syncCycles(4);
    return eightBitLoadFromGBMemory(u16Portable(Cpu.programCounter + 1));
  } // Get our concatenated databyte one and getDataByteTwo()
  // Find and replace with : getConcatenatedDataByte()


  function getConcatenatedDataByte() {
    return concatenateBytes(getDataByteTwo(), getDataByteOne());
  }

  function handleOpcode0x(opcode) {
    switch (opcode) {
      case 0x00:
        // NOP
        // 1  4
        // No Operation
        return 4;

      case 0x01:
        {
          // LD BC,d16
          // 3  12
          // 8 cycles
          var concatenatedDataByte = getConcatenatedDataByte();
          Cpu.registerB = splitHighByte(concatenatedDataByte);
          Cpu.registerC = splitLowByte(concatenatedDataByte);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
          return 4;
        }

      case 0x02:
        {
          // LD (BC),A
          // 1  8
          // () means load into address pointed by BC
          // 4 cycles
          eightBitStoreSyncCycles(concatenateBytes(Cpu.registerB, Cpu.registerC), Cpu.registerA);
          return 4;
        }

      case 0x03:
        {
          // INC BC
          // 1  8
          var registerBC3 = concatenateBytes(Cpu.registerB, Cpu.registerC);
          registerBC3++;
          Cpu.registerB = splitHighByte(registerBC3);
          Cpu.registerC = splitLowByte(registerBC3);
          return 8;
        }

      case 0x04:
        {
          // INC B
          // 1  4
          // Z 0 H -
          var registerB = Cpu.registerB;
          checkAndSetEightBitHalfCarryFlag(registerB, 1);
          registerB = u8Portable(registerB + 1);
          Cpu.registerB = registerB;
          setZeroFlag$$1(registerB === 0);
          setSubtractFlag(0);
          return 4;
        }

      case 0x05:
        {
          // DEC B
          // 1  4
          // Z 1 H -
          var registerB = Cpu.registerB;
          checkAndSetEightBitHalfCarryFlag(registerB, -1);
          registerB = u8Portable(registerB - 1);
          Cpu.registerB = registerB;
          setZeroFlag$$1(registerB === 0);
          setSubtractFlag(1);
          return 4;
        }

      case 0x06:
        {
          // LD B,d8
          // 2  8
          // 4 cycles
          Cpu.registerB = getDataByteOne();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x07:
        {
          // RLCA
          // 1  4
          // 0 0 0 C
          // Check for the carry
          var registerA = Cpu.registerA;
          setCarryFlag((registerA & 0x80) === 0x80);
          Cpu.registerA = rotateByteLeft(registerA); // Set all other flags to zero

          setZeroFlag$$1(0);
          setSubtractFlag(0);
          setHalfCarryFlag(0);
          return 4;
        }

      case 0x08:
        {
          // LD (a16),SP
          // 3  20
          // Load the stack pointer into the 16 bit address represented by the two data bytes
          // 16 cycles, 8 from data byte, 8 from sixteenbit store
          sixteenBitStoreSyncCycles(getConcatenatedDataByte(), Cpu.stackPointer);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
          return 4;
        }

      case 0x09:
        {
          // ADD HL,BC
          // 1 8
          // - 0 H C
          var registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
          var registerBC9 = concatenateBytes(Cpu.registerB, Cpu.registerC);
          checkAndSetSixteenBitFlagsAddOverflow(registerHL, registerBC9, false);
          var result = u16Portable(registerHL + registerBC9);
          Cpu.registerH = splitHighByte(result);
          Cpu.registerL = splitLowByte(result);
          setSubtractFlag(0);
          return 8;
        }

      case 0x0a:
        {
          // LD A,(BC)
          // 1 8
          // 4 cycles from load
          Cpu.registerA = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerB, Cpu.registerC));
          return 4;
        }

      case 0x0b:
        {
          // DEC BC
          // 1  8
          var registerBCB = concatenateBytes(Cpu.registerB, Cpu.registerC);
          registerBCB = u16Portable(registerBCB - 1);
          Cpu.registerB = splitHighByte(registerBCB);
          Cpu.registerC = splitLowByte(registerBCB);
          return 8;
        }

      case 0x0c:
        {
          // INC C
          // 1  4
          // Z 0 H -
          var registerC = Cpu.registerC;
          checkAndSetEightBitHalfCarryFlag(registerC, 1);
          registerC = u8Portable(registerC + 1);
          Cpu.registerC = registerC;
          setZeroFlag$$1(registerC === 0);
          setSubtractFlag(0);
          return 4;
        }

      case 0x0d:
        {
          // DEC C
          // 1  4
          // Z 1 H -
          var registerC = Cpu.registerC;
          checkAndSetEightBitHalfCarryFlag(registerC, -1);
          registerC = u8Portable(registerC - 1);
          Cpu.registerC = registerC;
          setZeroFlag$$1(registerC === 0);
          setSubtractFlag(1);
          return 4;
        }

      case 0x0e:
        {
          // LD C,d8
          // 2 8
          // 4 cycles
          Cpu.registerC = getDataByteOne();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x0f:
        {
          // RRCA
          // 1 4
          // 0 0 0 C
          // Check for the last bit, to see if it will be carried
          var registerA = Cpu.registerA;
          setCarryFlag((registerA & 0x01) > 0);
          Cpu.registerA = rotateByteRight(registerA); // Set all other flags to zero

          setZeroFlag$$1(0);
          setSubtractFlag(0);
          setHalfCarryFlag(0);
          return 4;
        }
    }

    return -1;
  }

  function handleOpcode1x(opcode) {
    switch (opcode) {
      case 0x10:
        {
          // STOP 0
          // 2 4
          // Enter CPU very low power mode. Also used to switch between double and normal speed CPU modes in GBC.
          // Meaning Don't Decode anymore opcodes , or updated the LCD until joypad interrupt (or when button is pressed if I am wrong)
          // See HALT
          // If we are in gameboy color mode, set the new speed
          if (Cpu.GBCEnabled) {
            // 4 cycles
            var speedSwitch = eightBitLoadSyncCycles(Cpu.memoryLocationSpeedSwitch);

            if (checkBitOnByte(0, speedSwitch)) {
              // Reset the prepare bit
              speedSwitch = resetBitOnByte(0, speedSwitch); // Switch to the new mode, and set the speed switch to the OTHER speed, to represent our new speed

              if (!checkBitOnByte(7, speedSwitch)) {
                Cpu.GBCDoubleSpeed = true;
                speedSwitch = setBitOnByte(7, speedSwitch);
              } else {
                Cpu.GBCDoubleSpeed = false;
                speedSwitch = resetBitOnByte(7, speedSwitch);
              } // Store the final speed switch
              // 4 cycles


              eightBitStoreSyncCycles(Cpu.memoryLocationSpeedSwitch, speedSwitch); // Cycle accurate gameboy docs says this takes 76 clocks
              // 76 - 8 cycles (from load/store) = 68

              return 68;
            }
          } // NOTE: This breaks Blarggs CPU tests if CGB Stop is not implemented


          Cpu.isStopped = true;
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x11:
        {
          // LD DE,d16
          // 3  12
          // 8 cycles
          var concatenatedDataByte = getConcatenatedDataByte();
          Cpu.registerD = splitHighByte(concatenatedDataByte);
          Cpu.registerE = splitLowByte(concatenatedDataByte);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
          return 4;
        }

      case 0x12:
        {
          // LD (DE),A
          // 1 8
          // 4 cycles
          eightBitStoreSyncCycles(concatenateBytes(Cpu.registerD, Cpu.registerE), Cpu.registerA);
          return 4;
        }

      case 0x13:
        {
          // INC DE
          // 1 8
          var registerDE3 = concatenateBytes(Cpu.registerD, Cpu.registerE);
          registerDE3 = u16Portable(registerDE3 + 1);
          Cpu.registerD = splitHighByte(registerDE3);
          Cpu.registerE = splitLowByte(registerDE3);
          return 8;
        }

      case 0x14:
        {
          // INC D
          // 1  4
          // Z 0 H -
          var registerD = Cpu.registerD;
          checkAndSetEightBitHalfCarryFlag(registerD, 1);
          registerD = u8Portable(registerD + 1);
          Cpu.registerD = registerD;
          setZeroFlag$$1(Cpu.registerD === 0);
          setSubtractFlag(0);
          return 4;
        }

      case 0x15:
        {
          // DEC D
          // 1  4
          // Z 1 H -
          var registerD = Cpu.registerD;
          checkAndSetEightBitHalfCarryFlag(registerD, -1);
          registerD = u8Portable(registerD - 1);
          Cpu.registerD = registerD;
          setZeroFlag$$1(Cpu.registerD === 0);
          setSubtractFlag(1);
          return 4;
        }

      case 0x16:
        {
          // LD D,d8
          // 2 8
          // 4 cycles
          Cpu.registerD = getDataByteOne();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x17:
        {
          // RLA
          // 1 4
          // 0 0 0 C
          // Check for the carry
          // setting has first bit since we need to use carry
          var hasHighbit = (Cpu.registerA & 0x80) === 0x80;
          Cpu.registerA = rotateByteLeftThroughCarry(Cpu.registerA); // OR the carry flag to the end

          setCarryFlag(hasHighbit); // Set all other flags to zero

          setZeroFlag$$1(0);
          setSubtractFlag(0);
          setHalfCarryFlag(0);
          return 4;
        }

      case 0x18:
        {
          // JR r8
          // 2  12
          // NOTE: Discoved dataByte is signed
          // However the relative Jump Function handles this
          // 4 cycles
          relativeJump(getDataByteOne());
          return 8;
        }
      // Relative Jump Function Handles program counter

      case 0x19:
        {
          // ADD HL,DE
          // 1  8
          // - 0 H C
          var registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
          var registerDE9 = concatenateBytes(Cpu.registerD, Cpu.registerE);
          checkAndSetSixteenBitFlagsAddOverflow(registerHL, registerDE9, false);
          var result = u16Portable(registerHL + registerDE9);
          Cpu.registerH = splitHighByte(result);
          Cpu.registerL = splitLowByte(result);
          setSubtractFlag(0);
          return 8;
        }

      case 0x1a:
        {
          // LD A,(DE)
          // 1 8
          var registerDEA = concatenateBytes(Cpu.registerD, Cpu.registerE); // 4 cycles

          Cpu.registerA = eightBitLoadSyncCycles(registerDEA);
          return 4;
        }

      case 0x1b:
        {
          // DEC DE
          // 1 8
          var registerDEB = concatenateBytes(Cpu.registerD, Cpu.registerE);
          registerDEB = u16Portable(registerDEB - 1);
          Cpu.registerD = splitHighByte(registerDEB);
          Cpu.registerE = splitLowByte(registerDEB);
          return 8;
        }

      case 0x1c:
        {
          // INC E
          // 1  4
          // Z 0 H -
          var registerE = Cpu.registerE;
          checkAndSetEightBitHalfCarryFlag(registerE, 1);
          registerE = u8Portable(registerE + 1);
          Cpu.registerE = registerE;
          setZeroFlag$$1(registerE === 0);
          setSubtractFlag(0);
          return 4;
        }

      case 0x1d:
        {
          // DEC E
          // 1  4
          // Z 1 H -
          var registerE = Cpu.registerE;
          checkAndSetEightBitHalfCarryFlag(registerE, -1);
          registerE = u8Portable(registerE - 1);
          Cpu.registerE = registerE;
          setZeroFlag$$1(registerE === 0);
          setSubtractFlag(1);
          return 4;
        }

      case 0x1e:
        {
          // LD E,d8
          // 2 8
          // 4 cycles
          Cpu.registerE = getDataByteOne();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x1f:
        {
          // RRA
          // 1 4
          // 0 0 0 C
          // Check for the carry
          // setting has low bit since we need to use carry
          var hasLowBit = (Cpu.registerA & 0x01) === 0x01;
          Cpu.registerA = rotateByteRightThroughCarry(Cpu.registerA);
          setCarryFlag(hasLowBit); // Set all other flags to zero

          setZeroFlag$$1(0);
          setSubtractFlag(0);
          setHalfCarryFlag(0);
          return 4;
        }
    }

    return -1;
  }

  function handleOpcode2x(opcode) {
    switch (opcode) {
      case 0x20:
        {
          // JR NZ,r8
          // 2  12/8
          // NOTE: NZ stands for not [flag], so in this case, not zero flag
          // Also, / means, if condition. so if met, 12 cycles, otherwise 8 cycles
          if (getZeroFlag$$1() === 0) {
            // 4 cycles
            relativeJump(getDataByteOne()); // Relative Jump Funciton handles program counter
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          }

          return 8;
        }

      case 0x21:
        {
          // LD HL,d16
          // 3  12
          // 8 cycles
          var sixteenBitDataByte = getConcatenatedDataByte();
          Cpu.registerH = splitHighByte(sixteenBitDataByte);
          Cpu.registerL = splitLowByte(sixteenBitDataByte);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
          return 4;
        }

      case 0x22:
        {
          // LD (HL+),A
          // 1 8
          var registerHL2 = concatenateBytes(Cpu.registerH, Cpu.registerL); // 4 cycles

          eightBitStoreSyncCycles(registerHL2, Cpu.registerA);
          registerHL2 = u16Portable(registerHL2 + 1);
          Cpu.registerH = splitHighByte(registerHL2);
          Cpu.registerL = splitLowByte(registerHL2);
          return 4;
        }

      case 0x23:
        {
          // INC HL
          // 1  8
          var registerHL3 = concatenateBytes(Cpu.registerH, Cpu.registerL);
          registerHL3 = u16Portable(registerHL3 + 1);
          Cpu.registerH = splitHighByte(registerHL3);
          Cpu.registerL = splitLowByte(registerHL3);
          return 8;
        }

      case 0x24:
        {
          // INC H
          // 1  4
          // Z 0 H -
          var registerH = Cpu.registerH;
          checkAndSetEightBitHalfCarryFlag(registerH, 1);
          registerH = u8Portable(registerH + 1);
          Cpu.registerH = registerH;
          setZeroFlag$$1(registerH === 0);
          setSubtractFlag(0);
          return 4;
        }

      case 0x25:
        {
          // DEC H
          // 1  4
          // Z 1 H -
          var registerH = Cpu.registerH;
          checkAndSetEightBitHalfCarryFlag(registerH, -1);
          registerH = u8Portable(registerH - 1);
          Cpu.registerH = registerH;
          setZeroFlag$$1(registerH === 0);
          setSubtractFlag(1);
          return 4;
        }

      case 0x26:
        {
          // LD H,d8
          // 2 8
          // 4 cycles
          Cpu.registerH = getDataByteOne();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x27:
        {
          // DAA
          // 1 4
          // Z - 0 C
          var adjustedRegister = 0;
          var adjustment = 0;

          if (getHalfCarryFlag() > 0) {
            adjustment = adjustment | 0x06;
          }

          if (getCarryFlag$$1() > 0) {
            adjustment = adjustment | 0x60;
          }

          var registerA = Cpu.registerA;

          if (getSubtractFlag() > 0) {
            adjustedRegister = u8Portable(registerA - adjustment);
          } else {
            if ((registerA & 0x0f) > 0x09) {
              adjustment = adjustment | 0x06;
            }

            if (registerA > 0x99) {
              adjustment = adjustment | 0x60;
            }

            adjustedRegister = u8Portable(registerA + adjustment);
          } // Now set our flags to the correct values


          setZeroFlag$$1(adjustedRegister === 0);
          setCarryFlag((adjustment & 0x60) !== 0);
          setHalfCarryFlag(0);
          Cpu.registerA = adjustedRegister;
          return 4;
        }

      case 0x28:
        {
          // JR Z,r8
          // 2  12/8
          if (getZeroFlag$$1() > 0) {
            // 4 cycles
            relativeJump(getDataByteOne()); // Relative Jump funciton handles pogram counter
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          }

          return 8;
        }

      case 0x29:
        {
          // ADD HL,HL
          // 1  8
          // - 0 H C
          var registerHL9 = concatenateBytes(Cpu.registerH, Cpu.registerL);
          checkAndSetSixteenBitFlagsAddOverflow(registerHL9, registerHL9, false);
          registerHL9 = u16Portable(registerHL9 * 2);
          Cpu.registerH = splitHighByte(registerHL9);
          Cpu.registerL = splitLowByte(registerHL9);
          setSubtractFlag(0);
          return 8;
        }

      case 0x2a:
        {
          // LD A,(HL+)
          // 1  8
          var registerHLA = concatenateBytes(Cpu.registerH, Cpu.registerL); // 4 cycles

          Cpu.registerA = eightBitLoadSyncCycles(registerHLA);
          registerHLA = u16Portable(registerHLA + 1);
          Cpu.registerH = splitHighByte(registerHLA);
          Cpu.registerL = splitLowByte(registerHLA);
          return 4;
        }

      case 0x2b:
        {
          // DEC HL
          // 1 8
          var registerHLB = concatenateBytes(Cpu.registerH, Cpu.registerL);
          registerHLB = u16Portable(registerHLB - 1);
          Cpu.registerH = splitHighByte(registerHLB);
          Cpu.registerL = splitLowByte(registerHLB);
          return 8;
        }

      case 0x2c:
        {
          // INC L
          // 1  4
          // Z 0 H -
          var registerL = Cpu.registerL;
          checkAndSetEightBitHalfCarryFlag(registerL, 1);
          registerL = u8Portable(registerL + 1);
          Cpu.registerL = registerL;
          setZeroFlag$$1(registerL === 0);
          setSubtractFlag(0);
          return 4;
        }

      case 0x2d:
        {
          // DEC L
          // 1  4
          // Z 1 H -
          var registerL = Cpu.registerL;
          checkAndSetEightBitHalfCarryFlag(registerL, -1);
          registerL = u8Portable(registerL - 1);
          Cpu.registerL = registerL;
          setZeroFlag$$1(registerL === 0);
          setSubtractFlag(1);
          return 4;
        }

      case 0x2e:
        {
          // LD L,d8
          // 2  8
          // 4 cycles
          Cpu.registerL = getDataByteOne();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x2f:
        {
          // CPL
          // 1 4
          // - 1 1 -
          Cpu.registerA = ~Cpu.registerA;
          setSubtractFlag(1);
          setHalfCarryFlag(1);
          return 4;
        }
    }

    return -1;
  }

  function handleOpcode3x(opcode) {
    switch (opcode) {
      case 0x30:
        {
          // JR NC,r8
          // 2 12 / 8
          if (getCarryFlag$$1() === 0) {
            // 4 cycles
            relativeJump(getDataByteOne()); // Relative Jump function handles program counter
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          }

          return 8;
        }

      case 0x31:
        {
          // LD SP,d16
          // 3 12
          // 8 cycles
          Cpu.stackPointer = getConcatenatedDataByte();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
          return 4;
        }

      case 0x32:
        {
          // LD (HL-),A
          // 1 8
          var registerHL2 = concatenateBytes(Cpu.registerH, Cpu.registerL); // 4 cycles

          eightBitStoreSyncCycles(registerHL2, Cpu.registerA);
          registerHL2 = u16Portable(registerHL2 - 1);
          Cpu.registerH = splitHighByte(registerHL2);
          Cpu.registerL = splitLowByte(registerHL2);
          return 4;
        }

      case 0x33:
        {
          // INC SP
          // 1 8
          Cpu.stackPointer = u16Portable(Cpu.stackPointer + 1);
          return 8;
        }

      case 0x34:
        {
          // INC (HL)
          // 1  12
          // Z 0 H -
          var registerHL4 = concatenateBytes(Cpu.registerH, Cpu.registerL); // 4 cycles

          var valueAtHL4 = eightBitLoadSyncCycles(registerHL4); // Creating a varible for this to fix assemblyscript overflow bug
          // Requires explicit casting
          // https://github.com/AssemblyScript/assemblyscript/issues/26

          var incrementer = 1;
          checkAndSetEightBitHalfCarryFlag(valueAtHL4, incrementer);
          valueAtHL4 = u8Portable(valueAtHL4 + incrementer);
          setZeroFlag$$1(valueAtHL4 === 0);
          setSubtractFlag(0); // 4 cycles

          eightBitStoreSyncCycles(registerHL4, valueAtHL4);
          return 4;
        }

      case 0x35:
        {
          // DEC (HL)
          // 1  12
          // Z 1 H -
          var registerHL5 = concatenateBytes(Cpu.registerH, Cpu.registerL); // 4 cycles

          var valueAtHL5 = eightBitLoadSyncCycles(registerHL5); // NOTE: This opcode may not overflow correctly,
          // Please see previous opcode

          checkAndSetEightBitHalfCarryFlag(valueAtHL5, -1);
          valueAtHL5 = u8Portable(valueAtHL5 - 1);
          setZeroFlag$$1(valueAtHL5 === 0);
          setSubtractFlag(1); // 4 cycles

          eightBitStoreSyncCycles(registerHL5, valueAtHL5);
          return 4;
        }

      case 0x36:
        {
          // LD (HL),d8
          // 2  12
          // 8 cycles, 4 from store, 4 from data byte
          eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x37:
        {
          // SCF
          // 1  4
          // - 0 0 1
          // Simply set the carry flag
          setSubtractFlag(0);
          setHalfCarryFlag(0);
          setCarryFlag(1);
          return 4;
        }

      case 0x38:
        {
          // JR C,r8
          // 2 12/8
          if (getCarryFlag$$1() === 1) {
            // 4 cycles
            relativeJump(getDataByteOne()); // Relative Jump Funciton handles program counter
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          }

          return 8;
        }

      case 0x39:
        {
          // ADD HL,SP
          // 1 8
          // - 0 H C
          var registerHL9 = concatenateBytes(Cpu.registerH, Cpu.registerL);
          checkAndSetSixteenBitFlagsAddOverflow(registerHL9, Cpu.stackPointer, false);
          var result = u16Portable(registerHL9 + Cpu.stackPointer);
          Cpu.registerH = splitHighByte(result);
          Cpu.registerL = splitLowByte(result);
          setSubtractFlag(0);
          return 8;
        }

      case 0x3a:
        {
          // LD A,(HL-)
          // 1 8
          var registerHLA = concatenateBytes(Cpu.registerH, Cpu.registerL); // 4 cycles

          Cpu.registerA = eightBitLoadSyncCycles(registerHLA);
          registerHLA = u16Portable(registerHLA - 1);
          Cpu.registerH = splitHighByte(registerHLA);
          Cpu.registerL = splitLowByte(registerHLA);
          return 4;
        }

      case 0x3b:
        {
          // DEC SP
          // 1 8
          Cpu.stackPointer = u16Portable(Cpu.stackPointer - 1);
          return 8;
        }

      case 0x3c:
        {
          // INC A
          // 1  4
          // Z 0 H -
          var registerA = Cpu.registerA;
          checkAndSetEightBitHalfCarryFlag(registerA, 1);
          registerA = u8Portable(registerA + 1);
          Cpu.registerA = registerA;
          setZeroFlag$$1(registerA === 0);
          setSubtractFlag(0);
          return 4;
        }

      case 0x3d:
        {
          // DEC A
          // 1  4
          // Z 1 H -
          var registerA = Cpu.registerA;
          checkAndSetEightBitHalfCarryFlag(registerA, -1);
          registerA = u8Portable(registerA - 1);
          Cpu.registerA = registerA;
          setZeroFlag$$1(registerA === 0);
          setSubtractFlag(1);
          return 4;
        }

      case 0x3e:
        {
          // LD A,d8
          // 2 8
          // 4 cycles
          Cpu.registerA = getDataByteOne();
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0x3f:
        {
          // CCF
          // 1 4
          // - 0 0 C
          setSubtractFlag(0);
          setHalfCarryFlag(0);
          setCarryFlag(getCarryFlag$$1() <= 0);
          return 4;
        }
    }

    return -1;
  }

  function handleOpcode4x(opcode) {
    switch (opcode) {
      case 0x40:
        // LD B,B
        // 1 4
        // Load B into B, Do nothing
        return 4;

      case 0x41:
        // LD B,C
        // 1 4
        Cpu.registerB = Cpu.registerC;
        return 4;

      case 0x42:
        // LD B,D
        // 1 4
        Cpu.registerB = Cpu.registerD;
        return 4;

      case 0x43:
        // LD B,E
        // 1 4
        Cpu.registerB = Cpu.registerE;
        return 4;

      case 0x44:
        // LD B,H
        // 1 4
        Cpu.registerB = Cpu.registerH;
        return 4;

      case 0x45:
        // LD B,L
        // 1 4
        Cpu.registerB = Cpu.registerL;
        return 4;

      case 0x46:
        // LD B,(HL)
        // 1 8
        // 4 cycles
        Cpu.registerB = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        return 4;

      case 0x47:
        // LD B,A
        // 1 4
        Cpu.registerB = Cpu.registerA;
        return 4;

      case 0x48:
        // LD C,B
        // 1 4
        Cpu.registerC = Cpu.registerB;
        return 4;

      case 0x49:
        // LD C,C
        // 1 4
        // Do nothing
        return 4;

      case 0x4a:
        // LD C,D
        // 1 4
        Cpu.registerC = Cpu.registerD;
        return 4;

      case 0x4b:
        // LD C,E
        // 1 4
        Cpu.registerC = Cpu.registerE;
        return 4;

      case 0x4c:
        // LD C,H
        // 1 4
        Cpu.registerC = Cpu.registerH;
        return 4;

      case 0x4d:
        // LD C,L
        // 1 4
        Cpu.registerC = Cpu.registerL;
        return 4;

      case 0x4e:
        // LD C,(HL)
        // 1 8
        // 4 cycles
        Cpu.registerC = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        return 4;

      case 0x4f:
        // LD C,A
        // 1 4
        Cpu.registerC = Cpu.registerA;
        return 4;
    }

    return -1;
  }

  function handleOpcode5x(opcode) {
    switch (opcode) {
      case 0x50:
        // LD D,B
        // 1 4
        Cpu.registerD = Cpu.registerB;
        return 4;

      case 0x51:
        // LD D,C
        // 1 4
        Cpu.registerD = Cpu.registerC;
        return 4;

      case 0x52:
        // LD D,D
        // 1 4
        // Do Nothing
        return 4;

      case 0x53:
        // LD D,E
        // 1 4
        Cpu.registerD = Cpu.registerE;
        return 4;

      case 0x54:
        // LD D,H
        // 1 4
        Cpu.registerD = Cpu.registerH;
        return 4;

      case 0x55:
        // LD D,L
        // 1 4
        Cpu.registerD = Cpu.registerL;
        return 4;

      case 0x56:
        // LD D,(HL)
        // 1 8
        // 4 cycles
        Cpu.registerD = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        return 4;

      case 0x57:
        // LD D,A
        // 1 4
        Cpu.registerD = Cpu.registerA;
        return 4;

      case 0x58:
        // LD E,B
        // 1 4
        Cpu.registerE = Cpu.registerB;
        return 4;

      case 0x59:
        // LD E,C
        // 1 4
        Cpu.registerE = Cpu.registerC;
        return 4;

      case 0x5a:
        // LD E,D
        // 1 4
        Cpu.registerE = Cpu.registerD;
        return 4;

      case 0x5b:
        // LD E,E
        // 1 4
        // Do Nothing
        return 4;

      case 0x5c:
        // LD E,H
        // 1 4
        Cpu.registerE = Cpu.registerH;
        return 4;

      case 0x5d:
        // LD E,L
        // 1 4
        Cpu.registerE = Cpu.registerL;
        return 4;

      case 0x5e:
        // LD E,(HL)
        // 1 8
        // 4 cycles
        Cpu.registerE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        return 4;

      case 0x5f:
        // LD E,A
        // 1 4
        Cpu.registerE = Cpu.registerA;
        return 4;
    }

    return -1;
  }

  function handleOpcode6x(opcode) {
    switch (opcode) {
      case 0x60:
        // LD H,B
        // 1 4
        Cpu.registerH = Cpu.registerB;
        return 4;

      case 0x61:
        // LD H,C
        // 1 4
        Cpu.registerH = Cpu.registerC;
        return 4;

      case 0x62:
        // LD H,D
        // 1 4
        Cpu.registerH = Cpu.registerD;
        return 4;

      case 0x63:
        // LD H,E
        // 1 4
        Cpu.registerH = Cpu.registerE;
        return 4;

      case 0x64:
        // LD H,H
        // 1 4
        Cpu.registerH = Cpu.registerH;
        return 4;

      case 0x65:
        // LD H,L
        // 1 4
        Cpu.registerH = Cpu.registerL;
        return 4;

      case 0x66:
        // LD H,(HL)
        // 1 8
        // 4 cycles
        Cpu.registerH = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        return 4;

      case 0x67:
        // LD H,A
        // 1 4
        Cpu.registerH = Cpu.registerA;
        return 4;

      case 0x68:
        // LD L,B
        // 1 4
        Cpu.registerL = Cpu.registerB;
        return 4;

      case 0x69:
        // LD L,C
        // 1 4
        Cpu.registerL = Cpu.registerC;
        return 4;

      case 0x6a:
        // LD L,D
        // 1 4
        Cpu.registerL = Cpu.registerD;
        return 4;

      case 0x6b:
        // LD L,E
        // 1 4
        Cpu.registerL = Cpu.registerE;
        return 4;

      case 0x6c:
        // LD L,H
        // 1 4
        Cpu.registerL = Cpu.registerH;
        return 4;

      case 0x6d:
        // LD L,L
        // 1 4
        Cpu.registerL = Cpu.registerL;
        return 4;

      case 0x6e:
        // LD L,(HL)
        // 1 8
        // 4 cycles
        Cpu.registerL = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        return 4;

      case 0x6f:
        // LD L,A
        // 1 4
        Cpu.registerL = Cpu.registerA;
        return 4;
    }

    return -1;
  }

  function handleOpcode7x(opcode) {
    switch (opcode) {
      case 0x70:
        // LD (HL),B
        // 1 8
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerB);
        return 4;

      case 0x71:
        // LD (HL),C
        // 1 8
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerC);
        return 4;

      case 0x72:
        // LD (HL),D
        // 1 8
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerD);
        return 4;

      case 0x73:
        // LD (HL),E
        // 1 8
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerE);
        return 4;

      case 0x74:
        // LD (HL),H
        // 1 8
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerH);
        return 4;

      case 0x75:
        // LD (HL),L
        // 1 8
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerL);
        return 4;

      case 0x76:
        // HALT
        // 1 4
        // Enter CPU very low power mode
        // Meaning Don't Decode anymore opcodes until an interrupt occurs
        // Still need to do timers and things
        // Can't Halt during an HDMA
        // https://gist.github.com/drhelius/3394856
        if (!Memory.isHblankHdmaActive) {
          Cpu.enableHalt();
        }

        return 4;

      case 0x77:
        // LD (HL),A
        // 1 8
        // 4 cycles
        eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), Cpu.registerA);
        return 4;

      case 0x78:
        // LD A,B
        // 1 4
        Cpu.registerA = Cpu.registerB;
        return 4;

      case 0x79:
        // LD A,C
        // 1 4
        Cpu.registerA = Cpu.registerC;
        return 4;

      case 0x7a:
        // LD A,D
        // 1 4
        Cpu.registerA = Cpu.registerD;
        return 4;

      case 0x7b:
        // LD A,E
        // 1 4
        Cpu.registerA = Cpu.registerE;
        return 4;

      case 0x7c:
        // LD A,H
        // 1 4
        Cpu.registerA = Cpu.registerH;
        return 4;

      case 0x7d:
        // LD A,L
        // 1 4
        Cpu.registerA = Cpu.registerL;
        return 4;

      case 0x7e:
        // LD A,(HL)
        // 1 8
        // NOTE: Thanks to @binji for catching that this should be 8 cycles, not 4
        // 4 cycles
        Cpu.registerA = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        return 4;

      case 0x7f:
        // LD A,A
        // 1 4
        // Do Nothing
        return 4;
    }

    return -1;
  }

  function handleOpcode8x(opcode) {
    switch (opcode) {
      case 0x80:
        // ADD A,B
        // 1 4
        // Z 0 H C
        addARegister(Cpu.registerB);
        return 4;

      case 0x81:
        // ADD A,C
        // 1 4
        // Z 0 H C
        addARegister(Cpu.registerC);
        return 4;

      case 0x82:
        // ADD A,D
        // 1 4
        // Z 0 H C
        addARegister(Cpu.registerD);
        return 4;

      case 0x83:
        // ADD A,E
        // 1 4
        // Z 0 H C
        addARegister(Cpu.registerE);
        return 4;

      case 0x84:
        // ADD A,H
        // 1 4
        // Z 0 H C
        addARegister(Cpu.registerH);
        return 4;

      case 0x85:
        // ADD A,L
        // 1 4
        // Z 0 H C
        addARegister(Cpu.registerL);
        return 4;

      case 0x86:
        // ADD A,(HL)
        // 1 8
        // Z 0 H C
        // 4 cycles
        var valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        addARegister(valueAtHL6);
        return 4;

      case 0x87:
        // ADD A,A
        // 1 4
        // Z 0 H C
        addARegister(Cpu.registerA);
        return 4;

      case 0x88:
        // ADC A,B
        // 1 4
        // Z 0 H C
        addAThroughCarryRegister(Cpu.registerB);
        return 4;

      case 0x89:
        // ADC A,C
        // 1 4
        // Z 0 H C
        addAThroughCarryRegister(Cpu.registerC);
        return 4;

      case 0x8a:
        // ADC A,D
        // 1 4
        // Z 0 H C
        addAThroughCarryRegister(Cpu.registerD);
        return 4;

      case 0x8b:
        // ADC A,E
        // 1 4
        // Z 0 H C
        addAThroughCarryRegister(Cpu.registerE);
        return 4;

      case 0x8c:
        // ADC A,H
        // 1 4
        // Z 0 H C
        addAThroughCarryRegister(Cpu.registerH);
        return 4;

      case 0x8d:
        // ADC A,L
        // 1 4
        // Z 0 H C
        addAThroughCarryRegister(Cpu.registerL);
        return 4;

      case 0x8e:
        // ADC A,(HL)
        // 1 8
        // Z 0 H C
        // 4 cycles
        var valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        addAThroughCarryRegister(valueAtHLE);
        return 4;

      case 0x8f:
        // ADC A,A
        // 1 4
        // Z 0 H C
        addAThroughCarryRegister(Cpu.registerA);
        return 4;
    }

    return -1;
  }

  function handleOpcode9x(opcode) {
    switch (opcode) {
      case 0x90:
        // SUB B
        // 1  4
        // Z 1 H C
        subARegister(Cpu.registerB);
        return 4;

      case 0x91:
        // SUB C
        // 1  4
        // Z 1 H C
        subARegister(Cpu.registerC);
        return 4;

      case 0x92:
        // SUB D
        // 1  4
        // Z 1 H C
        subARegister(Cpu.registerD);
        return 4;

      case 0x93:
        // SUB E
        // 1  4
        // Z 1 H C
        subARegister(Cpu.registerE);
        return 4;

      case 0x94:
        // SUB H
        // 1  4
        // Z 1 H C
        subARegister(Cpu.registerH);
        return 4;

      case 0x95:
        // SUB L
        // 1  4
        // Z 1 H C
        subARegister(Cpu.registerL);
        return 4;

      case 0x96:
        // SUB (HL)
        // 1  8
        // Z 1 H C
        // 4 cycles
        var valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        subARegister(valueAtHL6);
        return 4;

      case 0x97:
        // SUB A
        // 1  4
        // Z 1 H C
        subARegister(Cpu.registerA);
        return 4;

      case 0x98:
        // SBC A,B
        // 1  4
        // Z 1 H C
        subAThroughCarryRegister(Cpu.registerB);
        return 4;

      case 0x99:
        // SBC A,C
        // 1  4
        // Z 1 H C
        subAThroughCarryRegister(Cpu.registerC);
        return 4;

      case 0x9a:
        // SBC A,D
        // 1  4
        // Z 1 H C
        subAThroughCarryRegister(Cpu.registerD);
        return 4;

      case 0x9b:
        // SBC A,E
        // 1  4
        // Z 1 H C
        subAThroughCarryRegister(Cpu.registerE);
        return 4;

      case 0x9c:
        // SBC A,H
        // 1  4
        // Z 1 H C
        subAThroughCarryRegister(Cpu.registerH);
        return 4;

      case 0x9d:
        // SBC A,L
        // 1  4
        // Z 1 H C
        subAThroughCarryRegister(Cpu.registerL);
        return 4;

      case 0x9e:
        // SBC A,(HL)
        // 1  8
        // Z 1 H C
        // 4 cycles
        var valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        subAThroughCarryRegister(valueAtHLE);
        return 4;

      case 0x9f:
        // SBC A,A
        // 1  4
        // Z 1 H C
        subAThroughCarryRegister(Cpu.registerA);
        return 4;
    }

    return -1;
  }

  function handleOpcodeAx(opcode) {
    switch (opcode) {
      case 0xa0:
        // AND B
        // 1  4
        // Z 0 1 0
        andARegister(Cpu.registerB);
        return 4;

      case 0xa1:
        // AND C
        // 1  4
        // Z 0 1 0
        andARegister(Cpu.registerC);
        return 4;

      case 0xa2:
        // AND D
        // 1  4
        // Z 0 1 0
        andARegister(Cpu.registerD);
        return 4;

      case 0xa3:
        // AND E
        // 1  4
        // Z 0 1 0
        andARegister(Cpu.registerE);
        return 4;

      case 0xa4:
        // AND H
        // 1  4
        // Z 0 1 0
        andARegister(Cpu.registerH);
        return 4;

      case 0xa5:
        // AND L
        // 1  4
        // Z 0 1 0
        andARegister(Cpu.registerL);
        return 4;

      case 0xa6:
        // AND (HL)
        // 1  8
        // Z 0 1 0
        // 4 cycles
        var valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        andARegister(valueAtHL6);
        return 4;

      case 0xa7:
        // AND A
        // 1  4
        // Z 0 1 0
        // NOTE: & Yourself, does nothing
        andARegister(Cpu.registerA);
        return 4;

      case 0xa8:
        // XOR B
        // 1  4
        // Z 0 0 0
        xorARegister(Cpu.registerB);
        return 4;

      case 0xa9:
        // XOR C
        // 1  4
        // Z 0 0 0
        xorARegister(Cpu.registerC);
        return 4;

      case 0xaa:
        // XOR D
        // 1  4
        // Z 0 0 0
        xorARegister(Cpu.registerD);
        return 4;

      case 0xab:
        // XOR E
        // 1  4
        // Z 0 0 0
        xorARegister(Cpu.registerE);
        return 4;

      case 0xac:
        // XOR H
        // 1  4
        // Z 0 0 0
        xorARegister(Cpu.registerH);
        return 4;

      case 0xad:
        // XOR L
        // 1  4
        // Z 0 0 0
        xorARegister(Cpu.registerL);
        return 4;

      case 0xae:
        // XOR (HL)
        // 1  8
        // Z 0 0 0
        // 4 cycles
        var valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        xorARegister(valueAtHLE);
        return 4;

      case 0xaf:
        // XOR A
        // 1  4
        // Z 0 0 0
        xorARegister(Cpu.registerA);
        return 4;
    }

    return -1;
  }

  function handleOpcodeBx(opcode) {
    switch (opcode) {
      case 0xb0:
        // OR B
        // 1  4
        // Z 0 0 0
        orARegister(Cpu.registerB);
        return 4;

      case 0xb1:
        // OR C
        // 1  4
        // Z 0 0 0
        orARegister(Cpu.registerC);
        return 4;

      case 0xb2:
        // OR D
        // 1  4
        // Z 0 0 0
        orARegister(Cpu.registerD);
        return 4;

      case 0xb3:
        // OR E
        // 1  4
        // Z 0 0 0
        orARegister(Cpu.registerE);
        return 4;

      case 0xb4:
        // OR H
        // 1  4
        // Z 0 0 0
        orARegister(Cpu.registerH);
        return 4;

      case 0xb5:
        // OR L
        // 1  4
        // Z 0 0 0
        orARegister(Cpu.registerL);
        return 4;

      case 0xb6:
        // OR (HL)
        // 1  8
        // Z 0 0 0
        // 4 cycles
        var valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        orARegister(valueAtHL6);
        return 4;

      case 0xb7:
        // OR A
        // 1  4
        // Z 0 0 0
        orARegister(Cpu.registerA);
        return 4;

      case 0xb8:
        // CP B
        // 1  4
        // Z 1 H C
        cpARegister(Cpu.registerB);
        return 4;

      case 0xb9:
        // CP C
        // 1  4
        // Z 1 H C
        cpARegister(Cpu.registerC);
        return 4;

      case 0xba:
        // CP D
        // 1  4
        // Z 1 H C
        cpARegister(Cpu.registerD);
        return 4;

      case 0xbb:
        // CP E
        // 1  4
        // Z 1 H C
        cpARegister(Cpu.registerE);
        return 4;

      case 0xbc:
        // CP H
        // 1  4
        // Z 1 H C
        cpARegister(Cpu.registerH);
        return 4;

      case 0xbd:
        // CP L
        // 1  4
        // Z 1 H C
        cpARegister(Cpu.registerL);
        return 4;

      case 0xbe:
        // CP (HL)
        // 1  8
        // Z 1 H C
        // 4 cycles
        var valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
        cpARegister(valueAtHLE);
        return 4;

      case 0xbf:
        // CP A
        // 1  4
        // Z 1 H C
        cpARegister(Cpu.registerA);
        return 4;
    }

    return -1;
  }

  function handleOpcodeCx(opcode) {
    switch (opcode) {
      case 0xc0:
        {
          // RET NZ
          // 1  20/8
          if (getZeroFlag$$1() === 0) {
            // 8 cycles
            var stackPointer = Cpu.stackPointer;
            Cpu.programCounter = sixteenBitLoadSyncCycles(stackPointer);
            Cpu.stackPointer = u16Portable(stackPointer + 2);
            return 12;
          } else {
            return 8;
          }
        }

      case 0xc1:
        {
          // POP BC
          // 1  12
          // 8 cycles
          var registerBC1 = sixteenBitLoadSyncCycles(Cpu.stackPointer);
          Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
          Cpu.registerB = splitHighByte(registerBC1);
          Cpu.registerC = splitLowByte(registerBC1);
          return 4;
        }

      case 0xc2:
        {
          // JP NZ,a16
          // 3  16/12
          if (getZeroFlag$$1() === 0) {
            // 8 cycles
            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      case 0xc3:
        {
          // JP a16
          // 3  16
          // 8 cycles
          Cpu.programCounter = getConcatenatedDataByte();
          return 8;
        }

      case 0xc4:
        {
          // CALL NZ,a16
          // 3  24/12
          if (getZeroFlag$$1() === 0) {
            var stackPointer = u16Portable(Cpu.stackPointer - 2);
            Cpu.stackPointer = stackPointer; // 8 cycles

            sixteenBitStoreSyncCycles(stackPointer, u16Portable(Cpu.programCounter + 2)); // 8 cycles

            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      case 0xc5:
        {
          // PUSH BC
          // 1  16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerB, Cpu.registerC));
          return 8;
        }

      case 0xc6:
        {
          // ADD A,d8
          // 2 8
          // Z 0 H C
          // 4 cycles
          addARegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xc7:
        {
          // RST 00H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x00;
          return 8;
        }

      case 0xc8:
        {
          // RET Z
          // 1  20/8
          if (getZeroFlag$$1() === 1) {
            // 8 cycles
            var stackPointer = Cpu.stackPointer;
            Cpu.programCounter = sixteenBitLoadSyncCycles(stackPointer);
            Cpu.stackPointer = u16Portable(stackPointer + 2);
            return 12;
          } else {
            return 8;
          }
        }

      case 0xc9:
        {
          // RET
          // 1 16
          // 8 cycles
          var stackPointer = Cpu.stackPointer;
          Cpu.programCounter = sixteenBitLoadSyncCycles(stackPointer);
          Cpu.stackPointer = u16Portable(stackPointer + 2);
          return 8;
        }

      case 0xca:
        {
          // JP Z,a16
          // 3 16/12
          if (getZeroFlag$$1() === 1) {
            // 8 cycles
            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      case 0xcb:
        {
          // PREFIX CB
          // 1  4
          // 4 cycles
          var cbCycles = handleCbOpcode(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return cbCycles;
        }

      case 0xcc:
        {
          // CALL Z,a16
          // 3  24/12
          if (getZeroFlag$$1() === 1) {
            var stackPointer = u16Portable(Cpu.stackPointer - 2);
            Cpu.stackPointer = stackPointer; // 8 cycles

            sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter + 2); // 8 cycles

            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      case 0xcd:
        {
          // CALL a16
          // 3  24
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, u16Portable(Cpu.programCounter + 2)); // 8 cycles

          Cpu.programCounter = getConcatenatedDataByte();
          return 8;
        }

      case 0xce:
        {
          // ADC A,d8
          // 2  8
          // Z 0 H C
          // 4 cycles
          addAThroughCarryRegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xcf:
        {
          // RST 08H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x08;
          return 8;
        }
    }

    return -1;
  }

  function handleOpcodeDx(opcode) {
    switch (opcode) {
      case 0xd0:
        {
          // RET NC
          // 1  20/8
          if (getCarryFlag$$1() === 0) {
            // 8 cycles
            var stackPointer = Cpu.stackPointer;
            Cpu.programCounter = sixteenBitLoadSyncCycles(stackPointer);
            Cpu.stackPointer = u16Portable(stackPointer + 2);
            return 12;
          } else {
            return 8;
          }
        }

      case 0xd1:
        {
          // POP DE
          // 1  12
          // 8 cycles
          var stackPointer = Cpu.stackPointer;
          var registerDE1 = sixteenBitLoadSyncCycles(stackPointer);
          Cpu.stackPointer = u16Portable(stackPointer + 2);
          Cpu.registerD = splitHighByte(registerDE1);
          Cpu.registerE = splitLowByte(registerDE1);
          return 4;
        }

      case 0xd2:
        {
          // JP NC,a16
          // 3  16/12
          if (getCarryFlag$$1() === 0) {
            // 8 cycles
            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      /* No Opcode for: 0xD3 */

      case 0xd4:
        {
          // CALL NC,a16
          // 3  24/12
          if (getCarryFlag$$1() === 0) {
            var stackPointer = u16Portable(Cpu.stackPointer - 2);
            Cpu.stackPointer = stackPointer; // 8 cycles

            sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter + 2); // 8 cycles

            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      case 0xd5:
        {
          // PUSH DE
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerD, Cpu.registerE));
          return 8;
        }

      case 0xd6:
        {
          // SUB d8
          // 2  8
          // Z 1 H C
          // 4 cycles
          subARegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xd7:
        {
          // RST 10H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x10;
          return 8;
        }

      case 0xd8:
        {
          // RET C
          // 1  20/8
          if (getCarryFlag$$1() === 1) {
            var stackPointer = Cpu.stackPointer; // 8 cycles

            Cpu.programCounter = sixteenBitLoadSyncCycles(stackPointer);
            Cpu.stackPointer = u16Portable(stackPointer + 2);
            return 12;
          } else {
            return 8;
          }
        }

      case 0xd9:
        {
          // RETI
          // 1  16
          var stackPointer = Cpu.stackPointer; // 8 cycles

          Cpu.programCounter = sixteenBitLoadSyncCycles(stackPointer); // Enable interrupts

          setInterrupts(true);
          Cpu.stackPointer = u16Portable(stackPointer + 2);
          return 8;
        }

      case 0xda:
        {
          // JP C,a16
          // 3 16/12
          if (getCarryFlag$$1() === 1) {
            // 8 cycles
            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      /* No Opcode for: 0xDB */

      case 0xdc:
        {
          // CALL C,a16
          // 3  24/12
          if (getCarryFlag$$1() === 1) {
            var stackPointer = u16Portable(Cpu.stackPointer - 2);
            Cpu.stackPointer = stackPointer; // 8 cycles

            sixteenBitStoreSyncCycles(stackPointer, u16Portable(Cpu.programCounter + 2)); // 8 cycles

            Cpu.programCounter = getConcatenatedDataByte();
            return 8;
          } else {
            Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
            return 12;
          }
        }

      /* No Opcode for: 0xDD */

      case 0xde:
        {
          // SBC A,d8
          // 2 8
          // Z 1 H C
          // 4 cycles
          subAThroughCarryRegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xdf:
        {
          // RST 18H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x18;
          return 8;
        }
    }

    return -1;
  }

  function handleOpcodeEx(opcode) {
    switch (opcode) {
      case 0xe0:
        {
          // LDH (a8),A
          // 2  12
          // Store value in high RAM ($FF00 + a8)
          // 4 cycles
          var largeDataByteOne = getDataByteOne(); // 4 cycles

          eightBitStoreSyncCycles(0xff00 + largeDataByteOne, Cpu.registerA);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xe1:
        {
          // POP HL
          // 1  12
          // 8 cycles
          var stackPointer = Cpu.stackPointer;
          var registerHL1 = sixteenBitLoadSyncCycles(stackPointer);
          Cpu.stackPointer = u16Portable(stackPointer + 2);
          Cpu.registerH = splitHighByte(registerHL1);
          Cpu.registerL = splitLowByte(registerHL1);
          return 4;
        }

      case 0xe2:
        {
          // LD (C),A
          // 1  8
          // NOTE: Table says 2 Program counter,
          // But stepping through the boot rom, should be one
          // Also should change 0xF2
          // Store value in high RAM ($FF00 + register c)
          // 4 cycles
          eightBitStoreSyncCycles(0xff00 + Cpu.registerC, Cpu.registerA);
          return 4;
        }

      /* No Opcode for: 0xE3, 0xE4 */

      case 0xe5:
        {
          // PUSH HL
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerH, Cpu.registerL));
          return 8;
        }

      case 0xe6:
        {
          // AND d8
          // 2  8
          // Z 0 1 0
          // 4 cycles
          andARegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xe7:
        {
          // RST 20H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x20;
          return 8;
        }

      case 0xe8:
        {
          // ADD SP, r8
          // 2 16
          // 0 0 H C
          // NOTE: Discoved dataByte is signed
          // 4 cycles
          var signedDataByteOne = i8Portable(getDataByteOne());
          checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, signedDataByteOne, true);
          Cpu.stackPointer = u16Portable(Cpu.stackPointer + signedDataByteOne);
          setZeroFlag$$1(0);
          setSubtractFlag(0);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 12;
        }

      case 0xe9:
        {
          // JP HL
          // 1 4
          Cpu.programCounter = concatenateBytes(Cpu.registerH, Cpu.registerL);
          return 4;
        }

      case 0xea:
        {
          // LD (a16),A
          // 3 16
          // 12 cycles, 4 from store, 8 from concatenated data byte
          eightBitStoreSyncCycles(getConcatenatedDataByte(), Cpu.registerA);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
          return 4;
        }

      /* No Opcode for: 0xEB, 0xEC, 0xED */

      case 0xee:
        {
          // XOR d8
          // 2 8
          // Z 0 0 0
          // 4 cycles
          xorARegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xef:
        {
          // RST 28H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x28;
          return 8;
        }
    }

    return -1;
  }

  function handleOpcodeFx(opcode) {
    switch (opcode) {
      case 0xf0:
        {
          // LDH A,(a8)
          // 2 12
          // 4 cycles
          var largeDataByteOne = getDataByteOne(); // 4 cycles

          Cpu.registerA = u8Portable(eightBitLoadSyncCycles(0xff00 + largeDataByteOne));
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xf1:
        {
          // POP AF
          // 1 12
          // Z N H C (But No work require, flags are already set)
          // 8 cycles
          var stackPointer = Cpu.stackPointer;
          var registerAF1 = sixteenBitLoadSyncCycles(stackPointer);
          Cpu.stackPointer = u16Portable(stackPointer + 2);
          Cpu.registerA = splitHighByte(registerAF1);
          Cpu.registerF = splitLowByte(registerAF1);
          return 4;
        }

      case 0xf2:
        {
          // LD A,(C)
          // 1 8
          // 4 cycles
          Cpu.registerA = u8Portable(eightBitLoadSyncCycles(0xff00 + Cpu.registerC));
          return 4;
        }

      case 0xf3:
        {
          // DI
          // 1 4
          setInterrupts(false);
          return 4;
        }

      /* No Opcode for: 0xF4 */

      case 0xf5:
        {
          // PUSH AF
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, concatenateBytes(Cpu.registerA, Cpu.registerF));
          return 8;
        }

      case 0xf6:
        {
          // OR d8
          // 2 8
          // Z 0 0 0
          // 4 cycles
          orARegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xf7:
        {
          // RST 30H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x30;
          return 8;
        }

      case 0xf8:
        {
          // LD HL,SP+r8
          // 2 12
          // 0 0 H C
          // NOTE: Discoved dataByte is signed
          // 4 cycles
          var signedDataByteOne = i8Portable(getDataByteOne());
          var stackPointer = Cpu.stackPointer; // First, let's handle flags

          setZeroFlag$$1(0);
          setSubtractFlag(0);
          checkAndSetSixteenBitFlagsAddOverflow(stackPointer, signedDataByteOne, true);
          var registerHL = u16Portable(stackPointer + signedDataByteOne);
          Cpu.registerH = splitHighByte(registerHL);
          Cpu.registerL = splitLowByte(registerHL);
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 8;
        }

      case 0xf9:
        {
          // LD SP,HL
          // 1 8
          Cpu.stackPointer = concatenateBytes(Cpu.registerH, Cpu.registerL);
          return 8;
        }

      case 0xfa:
        {
          // LD A,(a16)
          // 3 16
          // 12 cycles, 4 from load, 8 from concatenated data byte
          Cpu.registerA = eightBitLoadSyncCycles(getConcatenatedDataByte());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
          return 4;
        }

      case 0xfb:
        {
          // EI
          // 1 4
          setInterrupts(true);
          return 4;
        }

      /* No Opcode for: 0xFC, 0xFD */

      case 0xfe:
        {
          // CP d8
          // 2 8
          // Z 1 H C
          // 4 cycles
          cpARegister(getDataByteOne());
          Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
          return 4;
        }

      case 0xff:
        {
          // RST 38H
          // 1 16
          var stackPointer = u16Portable(Cpu.stackPointer - 2);
          Cpu.stackPointer = stackPointer; // 8 cycles

          sixteenBitStoreSyncCycles(stackPointer, Cpu.programCounter);
          Cpu.programCounter = 0x38;
          return 8;
        }
    }

    return -1;
  } // NOTE: Code is very verbose, and will have some copy pasta'd lines.
  // Syncing and Tracking executed cycles


  var Cycles =
  /** @class */
  function () {
    function Cycles() {} // An even number below the max 32 bit integer


    Cycles.cyclesPerCycleSet = 2000000000;
    Cycles.cycleSets = 0;
    Cycles.cycles = 0;
    return Cycles;
  }();

  function getCyclesPerCycleSet() {
    return Cycles.cyclesPerCycleSet;
  }

  function getCycleSets() {
    return Cycles.cycleSets;
  }

  function getCycles() {
    return Cycles.cycles;
  } // Inlined because closure compiler inlines


  function trackCyclesRan(numberOfCycles) {
    var cycles = Cycles.cycles;
    cycles += numberOfCycles;

    if (cycles >= Cycles.cyclesPerCycleSet) {
      Cycles.cycleSets += 1;
      cycles -= Cycles.cyclesPerCycleSet;
    }

    Cycles.cycles = cycles;
  } // Inlined because closure compiler inlines


  function resetCycles() {
    Cycles.cyclesPerCycleSet = 2000000000;
    Cycles.cycleSets = 0;
    Cycles.cycles = 0;
  } // Sync other GB Components with the number of cycles


  function syncCycles(numberOfCycles) {
    // Check if we did a DMA TRansfer, if we did add the cycles
    if (Memory.DMACycles > 0) {
      numberOfCycles += Memory.DMACycles;
      Memory.DMACycles = 0;
    } // Finally, Add our number of cycles to the CPU Cycles


    Cpu.currentCycles += numberOfCycles; // Check other Gameboy components

    if (!Cpu.isStopped) {
      if (Config.graphicsBatchProcessing) {
        // Need to do this, since a lot of things depend on the scanline
        // Batch processing will simply return if the number of cycles is too low
        Graphics.currentCycles += numberOfCycles;
        batchProcessGraphics();
      } else {
        updateGraphics(numberOfCycles);
      }

      if (Config.audioBatchProcessing) {
        Sound.currentCycles += numberOfCycles;
        batchProcessAudio();
      } else {
        updateSound(numberOfCycles);
      }

      updateSerial(numberOfCycles);
    }

    if (Config.timersBatchProcessing) {
      // Batch processing will simply return if the number of cycles is too low
      Timers.currentCycles += numberOfCycles;
      batchProcessTimers();
    } else {
      updateTimers(numberOfCycles);
    }

    trackCyclesRan(numberOfCycles);
  } // Functions involving executing/running the emulator after initializtion


  var Execute =
  /** @class */
  function () {
    function Execute() {} // An even number bewlow the max 32 bit integer


    Execute.stepsPerStepSet = 2000000000;
    Execute.stepSets = 0;
    Execute.steps = 0; // Response Codes from Execute Conditions

    Execute.RESPONSE_CONDITION_ERROR = -1;
    Execute.RESPONSE_CONDITION_FRAME = 0;
    Execute.RESPONSE_CONDITION_AUDIO = 1;
    Execute.RESPONSE_CONDITION_BREAKPOINT = 2;
    return Execute;
  }();

  function getStepsPerStepSet() {
    return Execute.stepsPerStepSet;
  }

  function getStepSets() {
    return Execute.stepSets;
  }

  function getSteps() {
    return Execute.steps;
  } // Inlined because closure compiler inlines


  function trackStepsRan(steps) {
    var esteps = Execute.steps;
    esteps += steps;

    if (esteps >= Execute.stepsPerStepSet) {
      Execute.stepSets += 1;
      esteps -= Execute.stepsPerStepSet;
    }

    Execute.steps = esteps;
  } // Inlined because closure compiler inlines


  function resetSteps() {
    Execute.stepsPerStepSet = 2000000000;
    Execute.stepSets = 0;
    Execute.steps = 0;
  } // // Public funciton to run frames until,
  // the specified number of frames have run or error.
  // Return values:
  // -1 = error
  // 0 = render a frame


  function executeMultipleFrames(numberOfFrames) {
    var frameResponse = 0;
    var framesRun = 0;

    while (framesRun < numberOfFrames && frameResponse >= 0) {
      frameResponse = executeFrame();
      framesRun += 1;
    }

    if (frameResponse < 0) {
      return frameResponse;
    }

    return 0;
  } // Public funciton to run opcodes until,
  // a frame is ready, or error.
  // Return values:
  // -1 = error
  // 0 = render a frame


  function executeFrame() {
    return executeUntilCondition(true, -1);
  } // Public Function to run opcodes until,
  // a frame is ready, audio bufer is filled, or error


  function executeFrameAndCheckAudio(maxAudioBuffer) {
    if (maxAudioBuffer === void 0) {
      maxAudioBuffer = 0;
    }

    return executeUntilCondition(true, maxAudioBuffer);
  } // Base function that executes steps, and checks conditions
  // Return values:


  function executeUntilCondition(checkMaxCyclesPerFrame, maxAudioBuffer) {
    if (checkMaxCyclesPerFrame === void 0) {
      checkMaxCyclesPerFrame = true;
    }

    if (maxAudioBuffer === void 0) {
      maxAudioBuffer = -1;
    } // Common tracking variables


    var numberOfCycles = -1;
    var audioBufferSize = 1024;

    if (maxAudioBuffer > 0) {
      audioBufferSize = maxAudioBuffer;
    } else if (maxAudioBuffer < 0) {
      audioBufferSize = -1;
    }

    var errorCondition = false;
    var frameCondition = false;
    var audioBufferCondition = false;

    while (!errorCondition && !frameCondition && !audioBufferCondition && !Breakpoints.reachedBreakpoint) {
      numberOfCycles = executeStep(); // Error Condition

      if (numberOfCycles < 0) {
        errorCondition = true;
      } else if (Cpu.currentCycles >= Cpu.MAX_CYCLES_PER_FRAME()) {
        frameCondition = true;
      } else if (audioBufferSize > -1 && getNumberOfSamplesInAudioBuffer() >= audioBufferSize) {
        audioBufferCondition = true;
      }
    } // Find our exit reason


    if (frameCondition) {
      // Render a frame
      // Reset our currentCycles
      Cpu.currentCycles -= Cpu.MAX_CYCLES_PER_FRAME();
      return Execute.RESPONSE_CONDITION_FRAME;
    }

    if (audioBufferCondition) {
      return Execute.RESPONSE_CONDITION_AUDIO;
    }

    if (Breakpoints.reachedBreakpoint) {
      Breakpoints.reachedBreakpoint = false;
      return Execute.RESPONSE_CONDITION_BREAKPOINT;
    } // TODO: Boot ROM handling
    // There was an error, return -1, and push the program counter back to grab the error opcode


    Cpu.programCounter = u16Portable(Cpu.programCounter - 1);
    return -1;
  } // Function to execute an opcode, and update other gameboy hardware.
  // http://www.codeslinger.co.uk/pages/projects/gameboy/beginning.html


  function executeStep() {
    // Set has started to 1 since we ran a emulation step
    setHasCoreStarted(true); // Check if we are in the halt bug

    if (Cpu.isHaltBug) {
      // Need to not increment program counter,
      // thus, running the next opcode twice
      // E.g
      // 0x76 - halt
      // FA 34 12 - ld a,(1234)
      // Becomes
      // FA FA 34 ld a,(34FA)
      // 12 ld (de),a
      var haltBugOpcode = eightBitLoadFromGBMemory(Cpu.programCounter); // Execute opcode will handle the actual PC behavior

      var haltBugCycles = executeOpcode$$1(haltBugOpcode);
      syncCycles(haltBugCycles);
      Cpu.exitHaltAndStop();
    } // Interrupts should be handled before reading an opcode
    // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt


    var interruptCycles = checkInterrupts();

    if (interruptCycles > 0) {
      syncCycles(interruptCycles);
    } // Get the opcode, and additional bytes to be handled
    // Number of cycles defaults to 4, because while we're halted, we run 4 cycles (according to matt :))


    var numberOfCycles = 4;
    var opcode = 0; // If we are not halted or stopped, run instructions
    // If we are halted, this will be skipped and just sync the 4 cycles

    if (!Cpu.isHalted() && !Cpu.isStopped) {
      opcode = eightBitLoadFromGBMemory(Cpu.programCounter);
      numberOfCycles = executeOpcode$$1(opcode);
    } // blarggFixes, don't allow register F to have the bottom nibble


    Cpu.registerF = Cpu.registerF & 0xf0; // Check if there was an error decoding the opcode

    if (numberOfCycles <= 0) {
      return numberOfCycles;
    } // Sync other GB Components with the number of cycles


    syncCycles(numberOfCycles); // Update our steps

    trackStepsRan(1); // Check if we reached the CPU breakpoint

    if (Cpu.programCounter === Breakpoints.programCounter) {
      Breakpoints.reachedBreakpoint = true;
    }

    return numberOfCycles;
  } // Imports
  // Grow our memory to the specified size


  if (memory.size() < WASMBOY_WASM_PAGES) {
    memory.grow(WASMBOY_WASM_PAGES - memory.size());
  } // Function to track if the core has started


  var hasStarted = false;

  function setHasCoreStarted(value) {
    hasStarted = value;
  }

  function hasCoreStarted() {
    return hasStarted;
  } // Function to configure & initialize wasmboy


  function config(enableBootRom, useGbcWhenAvailable, audioBatchProcessing, graphicsBatchProcessing, timersBatchProcessing, graphicsDisableScanlineRendering, audioAccumulateSamples, tileRendering, tileCaching, enableAudioDebugging) {
    // TODO: depending on the boot rom, initialization may be different
    // From: http://www.codeslinger.co.uk/pages/projects/gameboy/hardware.html
    // All values default to zero in memory, so not setting them yet
    // log('initializing (includeBootRom=$0)', 1, enableBootRom);
    Config.enableBootRom = enableBootRom > 0;
    Config.useGbcWhenAvailable = useGbcWhenAvailable > 0;
    Config.audioBatchProcessing = audioBatchProcessing > 0;
    Config.graphicsBatchProcessing = graphicsBatchProcessing > 0;
    Config.timersBatchProcessing = timersBatchProcessing > 0;
    Config.graphicsDisableScanlineRendering = graphicsDisableScanlineRendering > 0;
    Config.audioAccumulateSamples = audioAccumulateSamples > 0;
    Config.tileRendering = tileRendering > 0;
    Config.tileCaching = tileCaching > 0;
    Config.enableAudioDebugging = enableAudioDebugging > 0;
    initialize();
  } // Function to initiialize the core


  function initialize() {
    // Initialization variables from BGB
    // First, try to switch to Gameboy Color Mode
    // Get our GBC support from the cartridge header
    // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
    var gbcType = eightBitLoadFromGBMemory(0x0143); // Detecting GBC http://bgb.bircd.org/pandocs.htm#cgbregisters

    if (gbcType === 0xc0 || Config.useGbcWhenAvailable && gbcType === 0x80) {
      Cpu.GBCEnabled = true;
    } else {
      Cpu.GBCEnabled = false;
    } // Reset hasStarted, since we are now reset


    setHasCoreStarted(false); // Reset our cycles ran

    resetCycles();
    resetSteps();

    if (Config.enableBootRom) {
      Cpu.BootROMEnabled = true;
    } else {
      Cpu.BootROMEnabled = false;
    } // Call our respective classes intialization
    // NOTE: Boot ROM Only handles some initialization, thus we need to check in each one
    // respecitvely :p


    initializeCpu();
    initializeCartridge();
    initializeDma();
    initializeGraphics();
    initializePalette();
    initializeSound();
    initializeInterrupts();
    initializeTimers();
    initializeSerial();
    initializeVarious();
  }

  function initializeVarious() {
    // Various Other Registers
    if (Cpu.GBCEnabled) {
      // Various other registers
      eightBitStoreIntoGBMemory(0xff70, 0xf8);
      eightBitStoreIntoGBMemory(0xff4f, 0xfe);
      eightBitStoreIntoGBMemory(0xff4d, 0x7e);
      eightBitStoreIntoGBMemory(0xff00, 0xcf);
      eightBitStoreIntoGBMemory(0xff0f, 0xe1); // 0xFFFF = 0x00
      // Undocumented from Pandocs

      eightBitStoreIntoGBMemory(0xff6c, 0xfe);
      eightBitStoreIntoGBMemory(0xff75, 0x8f);
    } else {
      eightBitStoreIntoGBMemory(0xff70, 0xff);
      eightBitStoreIntoGBMemory(0xff4f, 0xff);
      eightBitStoreIntoGBMemory(0xff4d, 0xff);
      eightBitStoreIntoGBMemory(0xff00, 0xcf);
      eightBitStoreIntoGBMemory(0xff0f, 0xe1); // 0xFFFF = 0x00
    }
  } // Function to return if we are currently playing a GBC ROM


  function isGBC() {
    return Cpu.GBCEnabled;
  } // Function to return an address to store into save state memory
  // this is to regulate our 20 slots
  // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
  // Inlined because closure compiler inlines


  function getSaveStateMemoryOffset(offset, saveStateSlot) {
    // 50 bytes per save state memory partiton sli32
    return WASMBOY_STATE_LOCATION + offset + 50 * saveStateSlot;
  } // Function to save state to memory for all of our classes


  function saveState() {
    Cpu.saveState();
    Graphics.saveState();
    Interrupts.saveState();
    Joypad.saveState();
    Memory.saveState();
    Timers.saveState();
    Sound.saveState();
    Channel1.saveState();
    Channel2.saveState();
    Channel3.saveState();
    Channel4.saveState(); // Reset hasStarted, since we are now reset

    setHasCoreStarted(false); // Don't want to reset cycles here, as this does not reset the emulator
  } // Function to load state from memory for all of our classes


  function loadState() {
    Cpu.loadState();
    Graphics.loadState();
    Interrupts.loadState();
    Joypad.loadState();
    Memory.loadState();
    Timers.loadState();
    Sound.loadState();
    Channel1.loadState();
    Channel2.loadState();
    Channel3.loadState();
    Channel4.loadState(); // Reset hasStarted, since we are now reset

    setHasCoreStarted(false); // Reset our cycles ran

    resetCycles();
    resetSteps();
  } // Functions to get information about the emulator for debugging purposes


  function getRegisterA() {
    return Cpu.registerA;
  }

  function getRegisterB() {
    return Cpu.registerB;
  }

  function getRegisterC() {
    return Cpu.registerC;
  }

  function getRegisterD() {
    return Cpu.registerD;
  }

  function getRegisterE() {
    return Cpu.registerE;
  }

  function getRegisterH() {
    return Cpu.registerH;
  }

  function getRegisterL() {
    return Cpu.registerL;
  }

  function getRegisterF() {
    return Cpu.registerF;
  }

  function getProgramCounter() {
    return Cpu.programCounter;
  }

  function getStackPointer() {
    return Cpu.stackPointer;
  }

  function getOpcodeAtProgramCounter() {
    return eightBitLoadFromGBMemory(Cpu.programCounter);
  } // Functions to debug graphical output
  // Some Simple internal getters


  function getLY() {
    return Graphics.scanlineRegister;
  }

  function getScrollX() {
    return Graphics.scrollX;
  }

  function getScrollY() {
    return Graphics.scrollY;
  }

  function getWindowX() {
    return Graphics.windowX;
  }

  function getWindowY() {
    return Graphics.windowY;
  } // TODO: Render by tile, rather than by pixel


  function drawBackgroundMapToWasmMemory(showColor) {
    // http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
    // Bit 7 - LCD Display Enable (0=Off, 1=On)
    // Bit 6 - Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
    // Bit 5 - Window Display Enable (0=Off, 1=On)
    // Bit 4 - BG & Window Tile Data Select (0=8800-97FF, 1=8000-8FFF)
    // Bit 3 - BG Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
    // Bit 2 - OBJ (Sprite) Size (0=8x8, 1=8x16)
    // Bit 1 - OBJ (Sprite) Display Enable (0=Off, 1=On)
    // Bit 0 - BG Display (for CGB see below) (0=Off, 1=On)
    // Get our seleted tile data memory location
    var tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;

    if (Lcd.bgWindowTileDataSelect) {
      tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
    }

    var tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;

    if (Lcd.bgTileMapDisplaySelect) {
      tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
    }

    for (var y = 0; y < 256; y++) {
      for (var x = 0; x < 256; x++) {
        // Get our current Y
        var pixelYPositionInMap = y; // Get our Current X position of our pixel on the on the 160x144 camera
        // this is done by getting the current scroll X position,
        // and adding it do what X Value the scanline is drawing on the camera.

        var pixelXPositionInMap = x; // Divide our pixel position by 8 to get our tile.
        // Since, there are 256x256 pixels, and 32x32 tiles.
        // 256 / 8 = 32.
        // Also, bitshifting by 3, do do a division by 8
        // Need to use u16s, as they will be used to compute an address, which will cause weird errors and overflows

        var tileXPositionInMap = pixelXPositionInMap >> 3;
        var tileYPositionInMap = pixelYPositionInMap >> 3; // Get our tile address on the tileMap
        // NOTE: (tileMap represents where each tile is displayed on the screen)
        // NOTE: (tile map represents the entire map, now just what is within the "camera")
        // For instance, if we have y pixel 144. 144 / 8 = 18. 18 * 32 = line address in map memory.
        // And we have x pixel 160. 160 / 8 = 20.
        // * 32, because remember, this is NOT only for the camera, the actual map is 32x32. Therefore, the next tile line of the map, is 32 byte offset.
        // Think like indexing a 2d array, as a 1d array and it make sense :)

        var tileMapAddress = tileMapMemoryLocation + tileYPositionInMap * 32 + tileXPositionInMap; // Get the tile Id on the Tile Map

        var tileIdFromTileMap = loadFromVramBank(tileMapAddress, 0); // Now get our tileDataAddress for the corresponding tileID we found in the map
        // Read the comments in _getTileDataAddress() to see what's going on.
        // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
        // This funcitons returns the start of memory locaiton for the tile 'c'.

        var tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap); // Now we can process the the individual bytes that represent the pixel on a tile
        // Get the y pixel of the 8 by 8 tile.
        // Simply modulo the scanline.
        // For instance, let's say we are printing the first line of pixels on our camera,
        // And the first line of pixels on our tile.
        // yPixel = 1. 1 % 8 = 1.
        // And for the last line
        // yPixel = 144. 144 % 8 = 0.
        // 0 Represents last line of pixels in a tile, 1 represents first. 1 2 3 4 5 6 7 0.
        // Because remember, we are counting lines on the display NOT including zero

        var pixelYInTile = pixelYPositionInMap % 8; // Same logic as pixelYInTile.
        // However, We need to reverse our byte,
        // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
        // Therefore, is pixelX was 2, then really is need to be 5
        // So 2 - 7 = -5, * 1 = 5
        // Or to simplify, 7 - 2 = 5 haha!

        var pixelXInTile = pixelXPositionInMap % 8;
        pixelXInTile = 7 - pixelXInTile; // Get the GB Map Attributes
        // Bit 0-2  Background Palette number  (BGP0-7)
        // Bit 3    Tile VRAM Bank number      (0=Bank 0, 1=Bank 1)
        // Bit 4    Not used
        // Bit 5    Horizontal Flip            (0=Normal, 1=Mirror horizontally)
        // Bit 6    Vertical Flip              (0=Normal, 1=Mirror vertically)
        // Bit 7    BG-to-OAM Priority         (0=Use OAM priority bit, 1=BG Priority)

        var bgMapAttributes = 0;

        if (Cpu.GBCEnabled && showColor > 0) {
          bgMapAttributes = loadFromVramBank(tileMapAddress, 1);
        }

        if (checkBitOnByte(6, bgMapAttributes)) {
          // We are mirroring the tile, therefore, we need to opposite byte
          // So if our pizel was 0 our of 8, it wild become 7 :)
          // TODO: This may be wrong :p
          pixelYInTile = 7 - pixelYInTile;
        } // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
        // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
        // But we need to load the time from a specific Vram bank


        var vramBankId = 0;

        if (checkBitOnByte(3, bgMapAttributes)) {
          vramBankId = 1;
        } // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
        // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
        // Again, think like you had to map a 2d array as a 1d.


        var byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2, vramBankId);
        var byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, vramBankId); // Now we can get the color for that pixel
        // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
        // To Get the color Id.
        // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
        // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html

        var paletteColorId = 0;

        if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
          // Byte one represents the second bit in our color id, so bit shift
          paletteColorId += 1;
          paletteColorId = paletteColorId << 1;
        }

        if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
          paletteColorId += 1;
        } // FINALLY, RENDER THAT PIXEL!


        var pixelStart = (y * 256 + x) * 3;

        if (Cpu.GBCEnabled && showColor > 0) {
          // Finally lets add some, C O L O R
          // Want the botom 3 bits
          var bgPalette = bgMapAttributes & 0x07; // Call the helper function to grab the correct color from the palette

          var rgbColorPalette = getRgbColorFromPalette(bgPalette, paletteColorId, false); // Split off into red green and blue

          var red = getColorComponentFromRgb(0, rgbColorPalette);
          var green = getColorComponentFromRgb(1, rgbColorPalette);
          var blue = getColorComponentFromRgb(2, rgbColorPalette);
          var offset = BACKGROUND_MAP_LOCATION + pixelStart;
          store(offset, red);
          store(offset + 1, green);
          store(offset + 2, blue);
        } else {
          // Only rendering camera for now, so coordinates are for the camera.
          // Get the rgb value for the color Id, will be repeated into R, G, B (if not colorized)
          var hexColor = getColorizedGbHexColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
          var offset = BACKGROUND_MAP_LOCATION + pixelStart; // Red

          store(offset + 0, getRedFromHexColor(hexColor)); // Green

          store(offset + 1, getGreenFromHexColor(hexColor)); // Blue

          store(offset + 2, getBlueFromHexColor(hexColor));
        }
      }
    }
  }

  function drawTileDataToWasmMemory() {
    for (var tileDataMapGridY = 0; tileDataMapGridY < 0x17; tileDataMapGridY++) {
      for (var tileDataMapGridX = 0; tileDataMapGridX < 0x1f; tileDataMapGridX++) {
        // Get Our VramBankID
        var vramBankId = 0;

        if (tileDataMapGridX > 0x0f) {
          vramBankId = 1;
        } // Get our tile ID


        var tileId = tileDataMapGridY;

        if (tileDataMapGridY > 0x0f) {
          tileId -= 0x0f;
        }

        tileId = tileId << 4;

        if (tileDataMapGridX > 0x0f) {
          tileId = tileId + (tileDataMapGridX - 0x0f);
        } else {
          tileId = tileId + tileDataMapGridX;
        } // Finally get our tile Data location


        var tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;

        if (tileDataMapGridY > 0x0f) {
          tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;
        } // Let's see if we have C O L O R
        // Set the map and sprite attributes to -1
        // Meaning, we will draw monochrome


        var paletteLocation = Graphics.memoryLocationBackgroundPalette;
        var bgMapAttributes = -1;
        var spriteAttributes = -1; // Let's see if the tile is being used by a sprite

        for (var spriteRow = 0; spriteRow < 8; spriteRow++) {
          for (var spriteColumn = 0; spriteColumn < 5; spriteColumn++) {
            var spriteIndex = spriteColumn * 8 + spriteRow; // Sprites occupy 4 bytes in the sprite attribute table

            var spriteTableIndex = spriteIndex * 4;
            var spriteTileId = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 2);

            if (tileId === spriteTileId) {
              var currentSpriteAttributes = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 3);
              var spriteVramBankId = 0;

              if (Cpu.GBCEnabled && checkBitOnByte(3, currentSpriteAttributes)) {
                spriteVramBankId = 1;
              }

              if (spriteVramBankId === vramBankId) {
                spriteAttributes = currentSpriteAttributes;
                spriteRow = 8;
                spriteColumn = 5; // Set our paletteLocation

                paletteLocation = Graphics.memoryLocationSpritePaletteOne;

                if (checkBitOnByte(4, spriteAttributes)) {
                  paletteLocation = Graphics.memoryLocationSpritePaletteTwo;
                }
              }
            }
          }
        } // If we didn't find a sprite,
        // Let's see if the tile is on the bg tile map
        // If so, use that bg map for attributes


        if (Cpu.GBCEnabled && spriteAttributes < 0) {
          var tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;

          if (Lcd.bgTileMapDisplaySelect) {
            tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
          } // Loop through the tileMap, and find if we have our current ID


          var foundTileMapAddress = -1;

          for (var x = 0; x < 32; x++) {
            for (var y = 0; y < 32; y++) {
              var tileMapAddress = tileMapMemoryLocation + y * 32 + x;
              var tileIdFromTileMap = loadFromVramBank(tileMapAddress, 0); // Check if we found our tileId

              if (tileId === tileIdFromTileMap) {
                foundTileMapAddress = tileMapAddress;
                x = 32;
                y = 32;
              }
            }
          }

          if (foundTileMapAddress >= 0) {
            bgMapAttributes = loadFromVramBank(foundTileMapAddress, 1);
          }
        } // Draw each Y line of the tile


        for (var tileLineY = 0; tileLineY < 8; tileLineY++) {
          drawPixelsFromLineOfTile(tileId, // tileId
          tileDataMemoryLocation, // Graphics.memoryLocationTileDataSelect
          vramBankId, // Vram Bank
          0, // Tile Line X Start
          7, // Tile Line X End
          tileLineY, // Tile Line Y
          tileDataMapGridX * 8, // Output line X
          tileDataMapGridY * 8 + tileLineY, // Output line Y
          0x1f * 8, // Output Width
          TILE_DATA_LOCATION, // Wasm Memory Start
          false, // shouldRepresentMonochromeColorByColorId
          paletteLocation, // paletteLocation
          bgMapAttributes, // bgMapAttributes
          spriteAttributes // spriteAttributes
          );
        }
      }
    }
  }

  function drawOamToWasmMemory() {
    // Draw all 40 sprites
    // Going to be like BGB and do 8 x 5 sprites
    for (var spriteRow = 0; spriteRow < 8; spriteRow++) {
      for (var spriteColumn = 0; spriteColumn < 5; spriteColumn++) {
        var spriteIndex = spriteColumn * 8 + spriteRow; // Sprites occupy 4 bytes in the sprite attribute table

        var spriteTableIndex = spriteIndex * 4; // Y positon is offset by 16, X position is offset by 8

        var spriteYPosition = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex);
        var spriteXPosition = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 1);
        var spriteTileId = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 2);
        var tilesToDraw = 1;

        if (Lcd.tallSpriteSize) {
          // @binji says in 8x16 mode, even tileId always drawn first
          // This will fix shantae sprites which always uses odd numbered indexes
          // TODO: Do the actual Pandocs thing:
          // "In 8x16 mode, the lower bit of the tile number is ignored. Ie. the upper 8x8 tile is "NN AND FEh", and the lower 8x8 tile is "NN OR 01h"."
          // So just knock off the last bit? :)
          if (spriteTileId % 2 === 1) {
            spriteTileId -= 1;
          }

          tilesToDraw += 1;
        } // Get our sprite attributes since we know we shall be drawing the tile


        var spriteAttributes = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 3); // Find which VRAM Bank to load from

        var vramBankId = 0;

        if (Cpu.GBCEnabled && checkBitOnByte(3, spriteAttributes)) {
          vramBankId = 1;
        } // Find which monochrome palette we should use


        var paletteLocation = Graphics.memoryLocationSpritePaletteOne;

        if (checkBitOnByte(4, spriteAttributes)) {
          paletteLocation = Graphics.memoryLocationSpritePaletteTwo;
        } // Start Drawing our tiles


        for (var i = 0; i < tilesToDraw; i++) {
          // Draw each Y line of the tile
          for (var tileLineY = 0; tileLineY < 8; tileLineY++) {
            drawPixelsFromLineOfTile(spriteTileId + i, // tileId
            Graphics.memoryLocationTileDataSelectOneStart, // Graphics.memoryLocationTileDataSelect
            vramBankId, // VRAM Bank
            0, // Tile Line X Start
            7, // Tile Line X End
            tileLineY, // Tile Line Y
            spriteRow * 8, // Output line X
            spriteColumn * 16 + tileLineY + i * 8, // Output line Y
            8 * 8, // Output Width
            OAM_TILES_LOCATION, // Wasm Memory Start
            false, // shouldRepresentMonochromeColorByColorId
            paletteLocation, // paletteLocation
            -1, // bgMapAttributes
            spriteAttributes // spriteAttributes
            );
          }
        }
      }
    }
  }

  function getDIV() {
    return Timers.dividerRegister;
  }

  function getTIMA() {
    return Timers.timerCounter;
  }

  function getTMA() {
    return Timers.timerModulo;
  }

  function getTAC() {
    var response = Timers.timerInputClock;

    if (Timers.timerEnabled) {
      response = setBitOnByte(2, response);
    }

    return response;
  } // Functions to debug internal gameboy memory


  function updateDebugGBMemory() {
    for (var i = 0; i < DEBUG_GAMEBOY_MEMORY_SIZE; i++) {
      store(DEBUG_GAMEBOY_MEMORY_LOCATION + i, eightBitLoadFromGBMemoryWithTraps(i));
    } // Since we are debugging, we don't want to be responsible for tripping the breakpoints


    Breakpoints.reachedBreakpoint = false;
  } // Public Exports

  var WasmBoyCore = /*#__PURE__*/Object.freeze({
    memory: memory,
    config: config,
    hasCoreStarted: hasCoreStarted,
    saveState: saveState,
    loadState: loadState,
    isGBC: isGBC,
    getStepsPerStepSet: getStepsPerStepSet,
    getStepSets: getStepSets,
    getSteps: getSteps,
    executeMultipleFrames: executeMultipleFrames,
    executeFrame: executeFrame,
    executeFrameAndCheckAudio: executeFrameAndCheckAudio,
    executeUntilCondition: executeUntilCondition,
    executeStep: executeStep,
    getCyclesPerCycleSet: getCyclesPerCycleSet,
    getCycleSets: getCycleSets,
    getCycles: getCycles,
    setJoypadState: setJoypadState,
    getNumberOfSamplesInAudioBuffer: getNumberOfSamplesInAudioBuffer,
    clearAudioBuffer: clearAudioBuffer,
    setManualColorizationPalette: setManualColorizationPalette,
    WASMBOY_MEMORY_LOCATION: WASMBOY_MEMORY_LOCATION,
    WASMBOY_MEMORY_SIZE: WASMBOY_MEMORY_SIZE,
    WASMBOY_WASM_PAGES: WASMBOY_WASM_PAGES,
    ASSEMBLYSCRIPT_MEMORY_LOCATION: ASSEMBLYSCRIPT_MEMORY_LOCATION,
    ASSEMBLYSCRIPT_MEMORY_SIZE: ASSEMBLYSCRIPT_MEMORY_SIZE,
    WASMBOY_STATE_LOCATION: WASMBOY_STATE_LOCATION,
    WASMBOY_STATE_SIZE: WASMBOY_STATE_SIZE,
    GAMEBOY_INTERNAL_MEMORY_LOCATION: GAMEBOY_INTERNAL_MEMORY_LOCATION,
    GAMEBOY_INTERNAL_MEMORY_SIZE: GAMEBOY_INTERNAL_MEMORY_SIZE,
    VIDEO_RAM_LOCATION: VIDEO_RAM_LOCATION,
    VIDEO_RAM_SIZE: VIDEO_RAM_SIZE,
    WORK_RAM_LOCATION: WORK_RAM_LOCATION,
    WORK_RAM_SIZE: WORK_RAM_SIZE,
    OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION: OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION,
    OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE: OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE,
    GRAPHICS_OUTPUT_LOCATION: GRAPHICS_OUTPUT_LOCATION,
    GRAPHICS_OUTPUT_SIZE: GRAPHICS_OUTPUT_SIZE,
    GBC_PALETTE_LOCATION: GBC_PALETTE_LOCATION,
    GBC_PALETTE_SIZE: GBC_PALETTE_SIZE,
    BG_PRIORITY_MAP_LOCATION: BG_PRIORITY_MAP_LOCATION,
    BG_PRIORITY_MAP_SIZE: BG_PRIORITY_MAP_SIZE,
    FRAME_LOCATION: FRAME_LOCATION,
    FRAME_SIZE: FRAME_SIZE,
    BACKGROUND_MAP_LOCATION: BACKGROUND_MAP_LOCATION,
    BACKGROUND_MAP_SIZE: BACKGROUND_MAP_SIZE,
    TILE_DATA_LOCATION: TILE_DATA_LOCATION,
    TILE_DATA_SIZE: TILE_DATA_SIZE,
    OAM_TILES_LOCATION: OAM_TILES_LOCATION,
    OAM_TILES_SIZE: OAM_TILES_SIZE,
    AUDIO_BUFFER_LOCATION: AUDIO_BUFFER_LOCATION,
    AUDIO_BUFFER_SIZE: AUDIO_BUFFER_SIZE,
    CHANNEL_1_BUFFER_LOCATION: CHANNEL_1_BUFFER_LOCATION,
    CHANNEL_1_BUFFER_SIZE: CHANNEL_1_BUFFER_SIZE,
    CHANNEL_2_BUFFER_LOCATION: CHANNEL_2_BUFFER_LOCATION,
    CHANNEL_2_BUFFER_SIZE: CHANNEL_2_BUFFER_SIZE,
    CHANNEL_3_BUFFER_LOCATION: CHANNEL_3_BUFFER_LOCATION,
    CHANNEL_3_BUFFER_SIZE: CHANNEL_3_BUFFER_SIZE,
    CHANNEL_4_BUFFER_LOCATION: CHANNEL_4_BUFFER_LOCATION,
    CHANNEL_4_BUFFER_SIZE: CHANNEL_4_BUFFER_SIZE,
    CARTRIDGE_RAM_LOCATION: CARTRIDGE_RAM_LOCATION,
    CARTRIDGE_RAM_SIZE: CARTRIDGE_RAM_SIZE,
    BOOT_ROM_LOCATION: BOOT_ROM_LOCATION,
    BOOT_ROM_SIZE: BOOT_ROM_SIZE,
    CARTRIDGE_ROM_LOCATION: CARTRIDGE_ROM_LOCATION,
    CARTRIDGE_ROM_SIZE: CARTRIDGE_ROM_SIZE,
    DEBUG_GAMEBOY_MEMORY_LOCATION: DEBUG_GAMEBOY_MEMORY_LOCATION,
    DEBUG_GAMEBOY_MEMORY_SIZE: DEBUG_GAMEBOY_MEMORY_SIZE,
    getWasmBoyOffsetFromGameBoyOffset: getWasmBoyOffsetFromGameBoyOffset,
    setProgramCounterBreakpoint: setProgramCounterBreakpoint,
    resetProgramCounterBreakpoint: resetProgramCounterBreakpoint,
    setReadGbMemoryBreakpoint: setReadGbMemoryBreakpoint,
    resetReadGbMemoryBreakpoint: resetReadGbMemoryBreakpoint,
    setWriteGbMemoryBreakpoint: setWriteGbMemoryBreakpoint,
    resetWriteGbMemoryBreakpoint: resetWriteGbMemoryBreakpoint,
    getRegisterA: getRegisterA,
    getRegisterB: getRegisterB,
    getRegisterC: getRegisterC,
    getRegisterD: getRegisterD,
    getRegisterE: getRegisterE,
    getRegisterH: getRegisterH,
    getRegisterL: getRegisterL,
    getRegisterF: getRegisterF,
    getProgramCounter: getProgramCounter,
    getStackPointer: getStackPointer,
    getOpcodeAtProgramCounter: getOpcodeAtProgramCounter,
    getLY: getLY,
    getScrollX: getScrollX,
    getScrollY: getScrollY,
    getWindowX: getWindowX,
    getWindowY: getWindowY,
    drawBackgroundMapToWasmMemory: drawBackgroundMapToWasmMemory,
    drawTileDataToWasmMemory: drawTileDataToWasmMemory,
    drawOamToWasmMemory: drawOamToWasmMemory,
    getDIV: getDIV,
    getTIMA: getTIMA,
    getTMA: getTMA,
    getTAC: getTAC,
    updateDebugGBMemory: updateDebugGBMemory
  });

  const getWasmBoyTsCore = async () => {
    const response = {
      instance: {
        exports: WasmBoyCore
      },
      byteMemory: memory.wasmByteMemory,
      type: 'TypeScript'
    };
    return response;
  };

  return getWasmBoyTsCore;

})));
//# sourceMappingURL=getWasmBoyTsCore.umd.js.map
