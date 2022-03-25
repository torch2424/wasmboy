(function () {
  'use strict';

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

  // https://stackoverflow.com/questions/6850276/how-to-convert-dataurl-to-file-object-in-javascript
  function dataUriToArray (dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]; // write the bytes of the string to an ArrayBuffer

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return ia;
  }

  // Inspired / Forked from:
  // https://github.com/59naga/pixel-to-svg
  class Pixel {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 1;
      this.height = 1;
    }

    toPathD() {
      // 1 pixel = <path d='M0,0 h1 v1 h-1 z'>
      return 'M' + this.x + ',' + this.y + 'h' + this.width + 'v' + this.height + 'h-' + this.width + 'Z';
    }

  }

  class PixelPath {
    constructor() {
      this.lines = {};
    }

    drawPoints(points) {
      points.forEach(point => {
        // points to line
        let continualLine = this.lines[`${point.x - 1},${point.y}`];

        if (continualLine) {
          continualLine.width++;
          this.lines[`${point.x},${point.y}`] = continualLine;
        } else {
          this.lines[`${point.x},${point.y}`] = new Pixel(point.x, point.y);
        }
      });
    }

    toElement() {
      let d = '';
      let rendered = [];
      let rects = {};
      let history = {};

      for (let point in this.lines) {
        let line = this.lines[point];

        if (rendered.indexOf(line) > -1) {
          continue;
        }

        let {
          x,
          y,
          width
        } = line;
        let continualRect = history[`${x},${y - 1}`];

        if (continualRect && continualRect.width === width) {
          continualRect.height++;
          history[`${x},${y}`] = continualRect;
        } else {
          rects[`${x},${y}`] = line;
          history[`${x},${y}`] = line;
        }

        rendered.push(line);
      }

      for (let point in rects) {
        d += rects[point].toPathD();
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      return path;
    }

  }

  function rgbaArrayBufferToSvg (width, height, byteMemory, frameLocation) {
    let svg;

    const createSvg = () => {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('shape-rendering', 'crispEdges');
    };

    createSvg(); // Create our svg group

    let g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); // Assume the most common color as the background. Should help in rendering time.

    let commonBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    commonBg.setAttribute('x', '0');
    commonBg.setAttribute('y', '0');
    commonBg.setAttribute('width', '160');
    commonBg.setAttribute('height', '144');
    commonBg.setAttribute('style', 'z-index: -100'); // Organizing by colors so we can draw one at a time
    // And do some better batch processing

    let pointsSortedByColor = {};

    const loopPixels = () => {
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          // Each color has an R G B component
          // In the passed rgba component
          let pixelStart = (y * width + x) * 3; // Get the rgba fill of the pixel

          let r = byteMemory[frameLocation + pixelStart + 0];
          let g = byteMemory[frameLocation + pixelStart + 1];
          let b = byteMemory[frameLocation + pixelStart + 2];
          let rgba = `rgba(${r}, ${g}, ${b}, 255)`; // Add the color to our points if we havent seen the color before

          if (!pointsSortedByColor[rgba]) {
            pointsSortedByColor[rgba] = [];
          } // Push the point onto the color


          pointsSortedByColor[rgba].push({
            x,
            y
          });
        }
      }
    };

    loopPixels(); // Set the most popular color as our bg, and remove it from the points

    let popularRgba;
    Object.keys(pointsSortedByColor).forEach(rgba => {
      if (!popularRgba || pointsSortedByColor[rgba] > pointsSortedByColor[popularRgba]) {
        popularRgba = rgba;
      }
    });
    commonBg.setAttribute('fill', popularRgba);
    g.appendChild(commonBg);
    delete pointsSortedByColor[popularRgba]; // Get our pixel paths per color

    const pixelPathsSortedByColor = {};
    Object.keys(pointsSortedByColor).forEach(colorKey => {
      pixelPathsSortedByColor[colorKey] = new PixelPath();
      pixelPathsSortedByColor[colorKey].drawPoints(pointsSortedByColor[colorKey]);
      let pathElement = pixelPathsSortedByColor[colorKey].toElement();
      pathElement.setAttribute('fill', colorKey);
      g.appendChild(pathElement);
    });
    svg.appendChild(g);
    return svg;
  }

  // Common Static functions
  // Function to get performance timestamp
  // This is to support node vs. Browser
  const getPerformanceTimestamp = () => {
    if (typeof window !== 'undefined') {
      return performance.now();
    }

    return Date.now();
  };

  const fpsTimeStamps = []; // Our interval rate (60fps)

  const intervalRate = 1000 / 60;
  // of how fast we are running

  function addTimeStamp() {
    // Track our Fps
    // http://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
    const currentHighResTime = getPerformanceTimestamp();

    while (fpsTimeStamps && fpsTimeStamps[0] < currentHighResTime - 1000) {
      fpsTimeStamps.shift();
    }

    fpsTimeStamps.push(currentHighResTime);
    return currentHighResTime;
  }

  function run60fps(callback) {


    const highResTime = getPerformanceTimestamp(); // Find how long it has been since the last timestamp

    const timeSinceLastTimestamp = highResTime - fpsTimeStamps[fpsTimeStamps.length - 1]; // Get the next time we should update using our interval rate

    let nextUpdateTime = intervalRate - timeSinceLastTimestamp;

    if (getFPS() < 58 || nextUpdateTime < 0) {
      nextUpdateTime = 0;
    }

    setTimeout(() => {
      addTimeStamp();

      if (getFPS() <= 60) {
        callback();
      }

      run60fps(callback);
    }, Math.floor(nextUpdateTime));
  }
  function getFPS() {
    if (!fpsTimeStamps || fpsTimeStamps.length === 0) {
      return 60;
    }

    return fpsTimeStamps.length;
  }

  var romUrl = "data:null;base64,yf///////////////////4BAIBAIBAIBAQIECBAgQID//////////////////////////////////////////+UhvsHDZwD/5SHOwcNnAP/lId7Bw2cA/+Uh7sHDZwD/5SH+wcNnAPXF1Sq2KAvlOm5nzX4A4SMY8dHB8eHZ6f///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wDDUAHO7WZmzA0ACwNzAIMADAANAAgRH4iJAA7czG7m3d3Zmbu7Z2NuDuzM3dyZn7u5Mz5UT0JVAAAAAAAAAAAAAAAAAAAAAwMCAAABpLWW81evMQDgIf/fDiAGADIFIPwNIPkh//4GADIFIPwh//8GgDIFIPx66rXBzdE0r+BC4EPgQeBKPgfgSwGA/yHoNAYKKuIMBSD6Aak0zWA0AfI0zXI0PuTgR+BIPhvgST7A4ECv4A8+CeD/r+Am4AI+ZuABPoDgAq/Nmjj7zbw1BAMBAHYY/f//////////////yf/////////////////////////////////////////o/AEAAD4KAgEAQD4AAvgDNgErNgD4An7+CMpQAvgCfsZ4Tz4AgU8+oM4ARwpPEfcCbiYAGX1U+AAicl8aR3m4ykoC+AM2AMNQAvgCNMMVAvgDfrfKXgKv+Aa2yrMC+AI2APgCfv5Ayn4CEQCg+AJuJgAZTUQ+AAL4AjTDYgL4AjYA+AJ+/gjKrgL4An7GeE8+AIFPPqDOAEcR9wJuJgAZfVT4ACJyXxoCIzTDggIhOqA2ASGnwDYAIafAfv4EyuYCIafAfssnyxfLF8sX5vBPPgCBTz6gzgBHCk+3yuYCIafANMO4AgE6oAohyMB3AQAAPgAC6ATJVE9CVVRPQlUhoMA0yc0xNT4A9TPNAALoAc0KDyGgwDYAIavANgAhqsA2ACG4wDYAIcfANgEht8A2ACGywDYAIbPANgUhtMA2ACGmwDYBIajANgEhpMA2AAEAYD4AAiFnBuXNkTXoAiH/AuXNezXoAj4F9TPNOTXoAc0vNSGkwH63yuEDIaTAfv4ByjsE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D+XwQMtfIAUhAJgYAyEAnMWvsygHASAACR0g/AYASgnB0eXV8EHmAiD6CiIDFSD04VThHSgKxQEgAAnB5dUY5MnF+AtGK04rVite+ATVViNeIypuZ81QOMHJyf///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+j9zTE1zdE0AUD/+AE2QCM2/yteI1YaKyt39gQCAUj/PtACAUn/PkACAUf/PuQCITVC5SEAFOXNCjfoBCGZQ+UhFA7lzQo36AQhdUPlIQIS5SEAAOXN9jboBs3PUUJLxSGdROUhGGjlzVc36ATBxSEABOXNVzfoBCEdS+UhBBjlzVc36ASvIZrBtsoZQTYAIbTANgAhpsB+9TPNQgfoASGmwH7+AdoZQT4EltoZQX7G/09ZFgAhvEAZGRnpw8hAw91Aw/JAwwdBPgX1M81DBugBIQBA5c1LBugCwxlBPgX1M81DBugBIT1R5c1LBugCwxlBPgX1M81DBugBIXxj5c1LBugCwxlBPgb1M81DBugBIQBA5c1LBugCPgH1M82AGugBzYUGzW5fIbvANmAhvMA2VCG9wDYCIb7ANgMhwMA2ACHBwDYAIaTBNgAhpcE2AyGmwTYAIafBNgAhosA2ACGbwTYAIbrANgAhpcA2ACGiwTaAIaPBNgAhscA2ACGhwDYAIcrANgAhpsB+xv9PPqGBTz5QzgBHCiHLwHchnsE2ACGfwTZ1IaDBNgAhocE2ACGowTYAIczANgAho8A2ACGwwDYgIa7ANgAhAHDlzdk36AIhlwDlzcY26ALNUFkBQP/4ATZAIzb/K14jVhorK3f2AQIBQP8jNkAjNv8rXiNWGisrd/YgAgFA/yM2QCM2/yteI1YaKyt39gICAUD/IzZAIzb/K14jVhorK3f2gALNLzXoA8mAgICAgIDggPCA+ID4gPCADAAeAD8APwAeAAwAAAAAAICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAf//jgIeAj4CPgIeAgICDg///AACAAMAAwAAAAMDAYKCGhI2IiI3lhPaE+4L5gfGBNBBWkIvYW4g2EGzgwMBAQOGBgYGFgY2BjYGFgYGBgYFAQEBAQEBA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KBQWFxgZEhMUFRYXGBkSExQVFhcYGRcYGRITFBUWFxgZEhMUFRYXGBkSGBkSExQVFhcYGRITFBUWFxgZEhMZEhMUFRYXGBkSExQVFhcYGRITFBITFBUWFxgZEhMUFRYXGBkSExQVExQVFhcYGRITFBUWFxgZEhMUFRbN23Y+BvUzzUIF6AHNqwYhocA0fuYDT/4DwvR7GAPD9HshycBODHnmB3c+CJZPfsYSR8Uh8QvlefUzePUzzQo36AThTa8hycC2yvR7ecsnyxfLF8sX5vBPPvGBTz4LzgBHxX71Mz4S9TPNCjfoBCGqwH7mgE+vscoRfCGrwH7mgEd5uMI6fBgDwzp8IarAfuYQT6+xyi58IavAfuYQR3m4wjp8GAPDOnzNCAfNuxHNujTDknvNCAc+BvUzzZYE6AHNewYhpMA2Asn////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////o/c0xNc3RNCEAAOXN2TfoAiGKDOUhACXlzVc36AQhhDHlISUE5c1XN+gEIUpB5SEpKOXNVzfoBCFhC+UhAKDlzQo36AQhykPlIQkE5c0KN+gEIQ5E5SENFeXNFQnoBCEHReUhFBLlIQAA5c31CegGIaHANgAho8A2ACGuwDYAIcnANgAhxcA2ACHGwDYAIazBNgAhxMA2ACGtwTYAIcfAfv4CwrVAGAPDtUAhrME2ASHEwDYEAUj/PtACAUn/PrQCAUf/PrQCzYUGzTJGPgT1M81DBugBIc9f5c1LBugCAUD/+AE2QCM2/yteI1YaKyt35t8CAUD/IzZAIzb/K14jVhorK3f2AgIBQP8jNkAjNv8rXiNWGisrd/YBAgFA/yM2QCM2/yteI1YaKyt35vsCAUD/IzZAIzb/K14jVhorK3f2gALNLzXoA8kAAAAAAAAAAAAAAAAAAAAAAAAAABwcMi46Jl5mSHiI+AAAAAABAQEBAAAAAAAAAADQsPCQIOAg4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABATg4SHhIeOiY+Iiw0JDwEPABAQEBAQEBAQAAAAAAAAAA0DDgICDgIOAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQHg4CDgIOBgoOAg4CAg4CDgAQEBAQEBAQEAAAAAAAAAAOAg4CCgYCDgAAAAAAAAAAAODgkPCQ8LDAYF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gICAgICAgID//1paWlpaWlpaWltcWlpaWlpaWlpaXV1dXV1dXV5fYGFiXV1dXV1dXV1dXV1dY2RdZWZnaGldamtdXV1dXV1dXV1sbV1ub3BxcnN0dXZdXV1dXV1dd3h5ent8fXx+f4CBgoNdXV2EhISFhoeIiYqLioqMjY6Ij4SEhP///wD/AP8A/wD/AP8A/wD///8A/wD/AP8A/wD4B+QY//9/gH+Af4B/gH+A//BvnP8A/wD/AP8A/wD/AP8A/wD/B/kP8R/hP8F/gP+A/4D///////D/7//v/9//3//f///w//D/8P9w/3D/sP+w/7D/AP8A/wD/AP8A/wH+B/gP/wD/AP8O9z/Hf4f/B/8H//8A/wD/AP/g//7//4//f/f/AP8A/wD/AP8A/4D/gP+A/wD/AP8A/wD+Af4B/gH+AdcgiUB+gBKAkwB8AKQApAALdtcJIB8rBNskIB8tEi0S/wD/AP+A/4B/wP9Af8B/wID/gP+A/4D/gP+A/8B/wH/v///v//B//3//f/9//3///3D/cP/w//D/8f/x//H/+f8A/wD/AP///wD/P8BAgID4D/gP+A/4z/gv+K/4b3gvDv8O/w7/Dv8P/w//D/8P///7//v/+//7f/f/d/+O//7/AP8A/wD/AP8A/gD/AP8A/gH+Af8A/wD/AP8A/wD/AHwAkwASgIH+9knoN/sc/wdgHwvk2yTAPzXJi3ZvnP/w/0B/wP+A/4D/AP8A/wD/AP8A/wD/AN8A/wD/AP8A/wD/AP8A/wD/AP8H/x/nf4P/wH/Af8F//3///////////3//P///////////////////+//7//v/+//5//r8/Pz4gICIiM+I/4j/gP8APzAPDHg/+L/8t/S38iPyI8RHhAcP/w//H/8f/x//H/8f/x////7//v/+//z//P////////8A/wD/AP8A/wD/AP/A//D/AP8A/wD/AP8A/wD/APcA/wD/AP8A/wD/AP8AnwCfAP8A/wD/AP8A/wD/APMA8wD/AP8A/wD/AP8AfwD/AP8AA/8D/wP/A/8D/wH/Af8B/+H/3v/f/t/+3/7v8f////////////////////////////j///74/vj///j/+P/4/wcC//4PBw4E//8A/wD/AP8fD/lwwYABAP//AP8A/wD/////H/8f/x///w//D/8P//////////////////7//////D/83/z/3P/Y/9j/OP/4/wD/AP8A/wD/AP8A/wDPAP8A/wD/APwA/AD/AP8A/wD/AP8A/wD/AP8A/wC/AP8A/wD/AP8A/wD/AP8A/wDnAP8A/wD/AP8A/wD/APsA/wAB/wH/Af8A/wD/AP8A///////4//f/9//3//v8////////////f/9//3/////////4//j/+P/4//j/+P/4////AP8A/wD/AP8A/wD/AP///w//D/8P/w//D/8P/w////////7//////////f7///////h/+L/4/7j/sP9w//D///8A/wD/AP8A/wD/AP8A///PAP8A/wD+AP4A/wD/AP//9wD/AP8AfwB/AP8A/wD///8A/wD/AJ8AnwD/AP8A///nAP8A/wD/AH8A/wD/AP//WlpaWlpaWlpaWlpaWltcWlpaWlpdXl9gXWFiY2RdXV1lZmdoXV1dXV1pamtsbW5vXV1wXXFyc3R1XV1ddnd4eXp7fH1+XX9dgF1dgV2CXV2DhIWGh4iJiotdXYxdjV2Oj5BdXZGSk5SVlZaXmJmZmpuZnJmdmZmZ//8A/wD/AP8A/wD/AP8A////AP8A/wD/AP8A/wD/Af///wD/AP8A/wD/P//gwIAA//8A/wD/AP8A////AAAAAP//AP8A/wD/AP/8/wcDAQD//wD/AP8A/wD/AP8A/4D/AP8A/wD/AP8A/wD/AP8A/zzDfoFmmQb5HOMY5wD/GOcC/gb8BPwM+Aj4CPgJ+H/4AwAfD3A/QH/Af4D/gP////8A//8A/wD/AP8A/wD////AAPjwDvwC/gP+Af8B////QH9gPyA/MB8QHxAfkB/+H7/A/4D/gP+A/4D/gP+A/4D/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/gH7B/cP/w/vH/8A/wD/AH+A3+Dv8P/w9/j9A/8B/wH/Af8B/wH/Af8B/4D/gP+A/4D/gP+A/4D/gP8f/x//H/8P/wf7B/sH/wf/+P/4//j/8P/g3+Df4P/g/wH/Af8B/wH/Af8B/wH/Af+A/4C/wL/Af8Bf4Cf4H///AP8A/wD/AP8A/wD/AP//9w/3D/8P7x/vH/8A/wD//+/w7/D/8Pf49/j/AP8A////Af8B/QP9A/4D+gfkH/j/AP8A/wD/AP8A/wD/AP///1paWlpaWlpbXF1dXl9aWlpaWlpaYGBgYGFgYGJjZGRlZmBhYGBgYGBgYGBgYGBgZ2hpamhrYGBgYGFgYGBhYGBgYGBsaG1uaG9gYGBgYGBgYGBgYGBhYHBxcnNxdGBgYWBgYGB1dXV1dXV1dXV1dXV1dXV1dXV1df//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////6P3NMTXN0TQhAHDlzdk36AIBSP8+0AIBR/8+5AIhoU3lIQCu5c0VCegEIbxX5SEUIOUhAADlzfUJ6AYhzUDlIQBA5c1XN+gEzYUGPgb1M81DBugBIYJo5c1LBugCAUD/+AE2QCM2/yteI1YaKyt3f+bfAgFA/yM2QCM2/yteI1YaKyt3f/YCAgFA/yM2QCM2/yteI1YaKyt3f/YBAgFA/yM2QCM2/yteI1YaKyt3f/YEAgFA/yM2QCM2/yteI1YaKyt3f/aAAs0vNegDyQ8fQH9wb39k1/5Jfzg/S3xPeA8wHh8LDh8XDw8DAwAA4OAa+gb+H+fPP+H/kf/Ot/+J9xnm/oj40PDw8HBwMDAAABMfYH98S39u8f9ucS84T3hPeA8wHh8fFw8PDg4MDAAA4OAa+g72H+fPv2H/l/+P+de5pn7I+NDw8PDw8AAAHz9Qb3hndW7f/1h/KzxP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CfUzzUMG6AEh22PlzUsG6ALNLzUhr8F+h4f4A3chw8B+IbrAlk/FPgD1M/gGfvUzefUzIcLAfvUzzbsG6AThTfgDRgQEIcLAfsYI+AB3PgD1M3j1M3n1M371M827BugE+AN+xhx3IbzAfiG6wJZPxT4A9TP4Bn71M3n1MyG7wH71M827BugE4U34A0YEBCG7wH7GCPgAdz4A9TN49TN59TN+9TPNuwboBMMKaj4CIa/BltrVaCGhwH7mB0/+B8IPaRgDww9pIa/BNMMPaSGhwH7mD0/+D8LqaBgDw+poIa/BNCGvwX7+DMIPaRgDww9pzTE1IcNa5SEKAuUhBQ/lzfUJ6AbNLzUhr8F++AN3PgSW2iNpfoeHd8NCafgDfv4F2jZpPgeW2jZpNhTDQmn4A37mAU/GBU+Hh3chw8B+IbrAlk/FPgD1M/gGfvUzefUzIcLAfvUzzbsG6AThTfgDRgQEIcLAfsYI+AB3PgD1M3j1M3n1M371M827BugEIa/BfvgDdz4EltqZaX6Hh3fDwWn4A37+Bdq1aT4Hltq1aX7mAU8+BJFPh4d3w8Fp+AN+5gFPxgVPh4d3+AN+xhx3IbzAfiG6wJZPxT4A9TP4Bn71M3n1MyG7wH71M827BugE4U34A0YEBCG7wH7GCPgAdz4A9TN49TN59TN+9TPNuwboBOgEyc0OWSG5wDYAIbrANgAhu8A2aCG8wDYAIaXANgIhABTlzdk36AI+BvUzzUIF6AEhocA2ACG6wDYUIaXAfv4JytRqzasGIarAfuaAT6+xym5qIavAfuaAR3m4woZqGAPDhmohqsB+5hBPr7HKs2ohq8B+5hBHebjKs2ohpcB+/gjCk2o+ARgBr0+vscKiaq8huMC2wrNqr7HKrmoht8B+9gF3IaXANgnNV2IhocA0zQgHzbo0IbrAfvUzIbnAfvUzzdk36ALDRWrNCAchpMA2Bj4B9TPNgBroAc0IBz4I9TPNlgToAcn//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+j9zTE1zdE0IWcG5c1aNegCIRVS5c2RNegCIQAA5c3ZN+gCIYQx5SEABOXNVzfoBCF4TuUhBBDlzVc36AQheE/lIRQk5c1XN+gEIShM5SEAJeXNCjfoBCERQeUhJajlzRUJ6AQh9krlIRQS5SEAAOXN9QnoBgFI/z7QAgFJ/z7kAgFH/z7kAiGhwDYAIbDBNgAhqcA2ACGywTYAzdpTzYUGAUD/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BJogmRCXIJUwBIADmhAClSADmhACmiCVEJggkxCVIAOdEAKTIAOaEJwgmBCaIJwQApUgA5kQApUgA5kQniCVEJwglRAFA5cgmRCaIAIFApVABKAFBAYCAwOeEAIP9JnAC6DADAQNn8ASEQABAwQgBxEEIJoYBECaCARgmggEIJoIBGCaCJ8IBCADmggEQJoIBGCaCJ8gnxgEIAIClQgEYJUIBCADlRAEQJUIBGCVCAQgmhAEYJoIBCACmhCVCARglRAEIJUIBGCVCJUIBCCaBARgmgQEIAOaEARgmggEIAKaEJUIBGCVEAQgA5oIBGCaCJoIBCCVBARglQQEIJMQBGCTCAQgmhCTCARgkxAEIAKTBARgkwQEIJUIBGCVCAQgA5oIBGCaEAQglQgEQJUIBGCVCAQgmggEQJoIBGCaCAQgnhgEYJ4IBCACkxAEYJMIBCCTEARgkwgEIJMIBGCTCAQgA5MEBGCTBAQgApMIBGCTCAQgA5MEBGCTBAQgnggEYJ4IBCCZBARgmQQEIJgIBGCYCAQglxgEYAQgApcIA54QmgQEYJoEBCCcEARgnAgEIJwQBGCcCAQgnBCeBARgngQEIAKTCARgkwgEIJYQBGCWCAQgmgQEYJoEBCCWCARglggEIJUIBECVCARglQgEIAOVGARgBECVCAQgmhAEYJoIBCCaEARgmggEIAKVCARglQgEIAOVBARglQQEIJwIBGCcCAQglQQEYJUEBCCaEAKaBARgmgQEIAOaEARgmggEIJoQBGCaCAQgnhAEYJ4IBCACkxAEYJMIBCCTEARgkwgEIAOaEARgmggEIJoInAieCARAnggEYJ4IBCACmgQEYJoEBCADmhAEYJoIBCCcCARgnAgEIJ4QBGCeCAQgkwgEIJMeApMIBGCTCAQgA5MgBGCTEAQgkyAEYJMQBCCTIAKTCARgkwgEIAOeIJkIBGCZCAQgmBAEYJgQBCCXIARglxAEIJcIBGCXCAQgnCCeCARgnggEIAKTIARgkxAEIAOaIARgmhAEIJMgmggEYJoIBCACkxAEYJMQBCCVMARglRAEIAOcIARgnBAEIJUgBGAEIAKVEAOcEARgnBAEIJYwApYIBGCWCAQgA5YgBGCWEAQgliAClggEYJYIBCADlhAEYJYQBCCYIARgmBAEIAKYCARgmAgEIJoQBGCaEAQgmAgEYJgI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AQOdB58RBHABCJ4EnwIEYAEIngSfAgRQAQieBJ8CBDABCJ4EnwIEwAEGnhgEcAEIngSfAgRgAQieBJ8CBFABCJ4EnwIEMAEIngSfAgTQAQOdB58RBHABCJ4EnwIEYAEIngSfAgRQAQieBJ8CBDABCJ4EnwIEwAEGnhgEcAUEAQieGAUBBNABA50HnxEEcAEIngSfAgRgAQieBJ8CBFABCJ4EnwIEMAEIngSfAgTAAQaeGARwAQieBJ8CBGABCJ4EnwIEUAEIngSfAgQwAQieBJ8CBNABA50HnwUEcAEIngSfCATQAQOdB58RBMABBp4YAQYeAQYeDAILBNABA50HnxEEgAEIngSfCARwAQieBJ8IBMABBp4YBIABCJ4EnwgEcAEIngSfCASAAQieBJ8IBHABCJ4EnwgFBAEInhgFAQTAAQaeGASAAQieBJ8IBHABCJ4EnwgE0AEDnQefEQSAAQieBJ8IBNABA50HnwUEwAEGnhgEgAEIngSfCAEIngSfAgRwAQieBJ8CBIABCJ4EnwgEcAEIngSfCAUEAQieGAUBBMABBp4YBIABCJ4EnwgEUAEIngSfAgRgAQieBJ8CDAME0AEDnQefEQSAAQieBJ8IBHABCJ4EnwgEwAEGnhgEgAEIngSfCARwAQieBJ8IBIABCJ4EnwgEcAEIngSfCAUEAQieGAUBBMABBp4YBIABCJ4EnwgEYAEIngSfAgRwAQieBJ8CBMABBp4YBIABCJ4EnwgE0AEGnhgEgAEIngSfCATQAQaeGASAAQieBJ8CBHABCJ4EnwIEgAEIngSfCARwAQieBJ8IBIABCJ4EnwgEcAEGHgSAAQYeBKABBh4EwAEGHgsE0AEDnQefBQSAAQieBJ8CAQieBJ8CAQieBJ8IBNABA50HnwUEwAEGnhgEgAEIngSfCARwAQieBJ8IBIABCJ4EnwgEcAEIngSfCAUEAQieGAUBBMABBp4YBIABCJ4EnwgEcAEIngSfCAwCBNABA50HnwUEgAEIngSfAgEIngSfAgEIngSfCATQAQOdB58FBMABBp4YBIABCJ4EnwgEcAEIngSfCASAAQieBJ8IBHABCJ4EnwgFBAEInhgFAQTAAQaeGASAAQieBJ8IBGABCJ4EnwIEcAEIngSfAgTAAQaeGASAAQieBJ8IBNABBp4YBIABCJ4EnwgE0AEGnhgEgAEIngSfAgRwAQieBJ8CBIABCJ4EnwgEcAEIngSfCASAAQieBJ8IBHABBh4EgAEGHgSgAQYeBMABBh4SCABoADsBPAGfEgQwAAwFAQYCAQYHERUUFRoUExQaEwMcAhmVBZ8wnwSfAwEEHh0eAhMUFReaCwQQnQEEIB4cGpwYAxqeBgSgA5MkA5w8niQClzyZJJQ8A54kApcSBDACApcknwafMBIPugSQAAwFAQYCAQYHERUUFRoUExQaEwMcAhmVFwSAApYBBJAXlRgBBB4dHgITFBUXmgsEgJ0BBJAeHBqcGAMaHgIVAAaXDBMEMBcEkAMcBDACEwSQAxkEMJwMGQSQApcSBDAXBJCYDBkEMBgEkBUEMBkEkAMeBDACFQSQAxsEMJ4MGwSQApkSBDAZBJCaDBsEMBoEkBcEMBsEkBkEMBcEkBoEMBkEkBsEMBoEkB4EMBsEkBsEMB4EkB4EMBsEkJkSBFAeBJAZBDAZBJCXMJ8MnzASEhIYAFkBpAL6AwARKZq83e7v3Luqqqq7zM+fkA0FCARwBgEBBAAQBEAaFwRQGgRwFxoEgBcEcBoXBFAaBEAZFgRQGQRwFhkEgBYEcBkWBFAZBEAYFQRQGARwFRgEgBUEcBgVBFAYBEAYFQRQGARwFRgEgBUEcBgVBFAYBEAaFwRQGgRwFxoEgBcEcBoXBFAaBEAZFgRQGQRwFhkEgBYEcBkWBFAZBEAYFQRQGARwFRgEgBUEcBgVBFAYBECVIARwBgICmgiZCBoEQBoEcAKaCJkIBEAaBBAaHwMDBgEEQBwZBFAcBHAZHASAGQRwHBkEUBwEQBsYBFAbBHAYGwSAGARwGxgEUBsEQBoXBFAaBHAXGgSAFwRwGhcEUBoEQBkWBFAZBHAWGQSAFgRwGRYEUBkGAgUEBICYIBOYIAIFBZNABQQDlyADHgKXIAUFnkAFBwoXNJ7gCQCfQBIP1AEEBgIFAQSgAQSeAQgUAwOTHwICCAABBJoBCBQDA5MHAgIIAAEEmgEIFAMDkwcCAggAAQSUAQgUAwOTHwICCAAEoAUHBgEBBJoQApMQlRCWEA0EoAYBCiYYlzAKJhiVMAomGJMwCiYYA55QCQCcEJ4gApMQCiYYkzAKJhgDnjAKJhicMAomGJqQCiYYApcwCiYYmDAJAJogCiYYk2AJAAOeEAKTIJUKlgYKJhiXMAomGJgwCiYYlzAKJhiVkJ8wCQAFBAKTIAUDkxCTEJUQlxAFBwomGJNQCQAFA5MQkxCVEJcQBQcKJhiaMAomGJgwCiYYmiAJAJgQCiYYlzAKJhgDnSAJAAKXGAkmBQOXKAkABgIFBAMDnCCYEJwgAgUFl0AFBAObIJcQmyACBQWWQAUHCiY0leAJAAYBBQcEwAOaEAKTEJUQlhASn5ANEQAEIAEDkyACkxAEQJNQBCADmhCTIAKTEARAk1AEIAOaEJMgApMQBECTUAQgA5kQmi6fApUunwIDmi6fAgKTIAKTEARAk1AEIAOaEJMgApMQBECTUAQgA5oQmCACmBAEQJhQBCADmRCaGARAmhafAgQgApoenwKVDp8CA5oYBECaFp8CBCCZIAKZEARAmU6fAgQglxADmCACmBAEQJhOnwIEIJYQlxADngmfBJ8DmgmfBJ8DA54YBECeFJ8EBCAClxgEQJcUnwQEIJwgApwJnwSfA50YBECdEZ8EnwMEIJsYBECbEZ8EnwMEIAOcEJUQnA6fAgKTGARAkxgEIAOYHp8CmQ6fApoQlQmfBJ8DA54JnwSfA5oYBECaRZ8DBCACkyCaCJ8gnwiaGARAmhafAgQgA5oInwgCkx6fApoOnwIClRgEQJUWnwIEIAOeIARAnhASn5ANAQgFBASABwGeMAUBBHCeIASAnhAEcJ4gBICeEAUEBIAHEJ4wBQEEcJ4gBICeEARwniAEgJ4QBQQEgAcBniAFAQSAnhAEcJ4gBICeEARwniAEgJ4QBHAHEJ4gBICeEARwniAEgJ4QBQUEgJ4gBQGeEAUEBwGeMAUBBHCeIASAnhAEcJ4gBICeEAUEBIAHEJ4wBQEEcJ4gBICeEARwniAEgJ4QBQQEgAcBniAFAQSAnhAEcJ4gBICeEARwniAHEARwnggEgJ4IBJCeEARgnhAEcJ4QBICeIARwnhAFBQSAniAFAZ4QEv//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////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DARAFwRgFwRAHARgHARAHgRgHgRAApQSBGAUBEADlxIEYBcEQJUSBGAVBEAcBGAcBECVDARglQwEQBwEYBwEQAIXBGAXBEAVBGAVBEADnBIEYBwEQJ4SBGAeBEADnBIEYBwEQAIXBGAXBECcDARgnAwEQBcEYBcEQBwEYBwEQB4EYB4EQAKUEgRgFARAlxIEYBcDDQRAlRIEYBUEQBwEYBwEQJ4MBGCeDARAHARgHARAFQRgFQRAAhcEYBcEQJUSBGAVBECUEgRgFARAAwOcEgRgHARAAhUEYBUEQJcMBGCXDARAFwRgFwRAHARgHARAHgRgHgRAApQSBGAUBEADlxIEYBcEQJUSBGAVBEAcBGAcBECeDARgngwEQBwEYBwEQBUEYBUEQAIXBGAXBECVEgRgFQRAlBIEYBQEQAMDnBIEYBwEQAIVBGAVBECXDARglwwEQBcEYBcEQBwEYBwEQBcEYBcEQAKUEgRgFARAA5cSBGAXBECVEgRgFQRAHARgHARAngwEYJ4MBEAcBGAcBEAVBGAVBEACFwRgFwRAlRIEYBUEQJQSBGAUBEADA5wSBGAcBEACFQRgFQRAlwwEYJcMBEAXBGAXBEAcBGAcBEAeBGAeBEAClBIEYBQEQAOXEgRgFwRAlRIEYBUEQBwEYBwEQJ4MBGCeDARAHARgHARAFQRgFQRAHARgHARAlRIEYBUEQJYSBGAWBECXEgRgFwRAAxYEYBYEQJYMBGCWDARAlgwEYJYMBEACFARgFARAFwRgFwRAHARgHARAFwRgFwRAFARgFAsEQJUSBGAVBEAcBGAcBECeDARgngwEQBwEYBwEQBUEYBUEQAIXBGAXBECVEgRgFQRAlBIEYBQEQAMDnBIEYBwEQAIVBGAVBECXDARglwwEQBcEYBcEQBwEYBwEQB4EYB4EQAKUEgRgFARAA5cSBGAXDAMEQJUSBGAVBEAcBGAcBEAClwwEYJcMBEAVBGAVBEADHARgHARAFwRgFwRAFQRgFQRAAxwEYBwEQAIVBGAVBEAcBGAcEQEEQJUSBGAVBEAcBGAcBEAClwwEYJcMBEAVBGAVBEADHARgHARAFwRgFwRAFQRgFQRAAxwEYBwEQAIVBGAVBEAcBGAcEQAEIJcSBEAXBCAeBEAeBCACmQwEQJkMBCAXBEAXBCADHgRAHgQgGQRAGQQgFwRAFwQgHARAHAQgHgRAHgQgAhcDBEAXEQEEIJcSBEAXBCAeBEAeBCACmQwEQJkMBCAXBEAXBCADHgRAHgQgGQRAGQQgFwRAFwQgHARAHAQgHgRAHgQgAhcDBEAXEQAEIBUEQBUEIBUEQBUEIBUEQBUEIJUMBECVDAQgFQRAFQQgFwRAFwQgAxcEQBcEIBcEQBcEIJcMBECXDAQgAhcEQBcEIBwEQBwEIAMcBEAcBCAcBEAcBCCcDARAnAwEIAICFARAFAQgFQRAFQQgFARAFAQgAxwEQBwEIJ4MBECeDAQgFwRAFwQgFQRAFQQgFQRAFQQgFQRAFQQglQwEQJUMBCAVBEAVBCAXBEAXBCAXBEAXBCAXBEAXBCCXDARAlwwEIBcEQBcEIBQEQBQEIAMXBEAXBCAcBEAcBCAClAwEQJQMBCADFwRAFwQgAhcEQBcEIAMXBEAXBCAcBEAcBCAClwwEQJcMBCAWBEAWBCAVBEAVBCAVBEAVBCAVBEAVBCCVDARAlQwEIBUEQBUEIBcEQBcEIAMXBEAXBCAXBEAXBCCXDARAlwwEIAIXBEAXBCAcBEAcBCADHARAHAQgHARAHAQgnAwEQJwMBCACAhQEQBQEIBUEQBUEIBQEQBQEIAMcBEAcBCCeDARAngwEIBcEQBcEIBUEQBUEIBUEQBUEIBUEQBUEIJUMBECVDAQgFQRAFQQgAx0EQB0EIB0EQB0EIB0EQB0EIJ0MBECdDAQgHQRAHQQgHgRAHgQgHgRAHgQgHgRAHgQgngwEQJ4MBCAeBEAeBCACFwRAFwQgA5cMBECXDAQglwwEQJcMBCACFwRAFwsEQJUSBGAVBEAcBGAcBECeDARgngwEQBwEYBwEQBUEYBUEQAIXBGAXBECVEgRgFQRAlBIEYBQEQAMDnBIEYBwEQAIVBGAVBECXDARglwwEQBcEYBcEQBwEYBwEQB4EYB4EQAKUEgRgFARAA5cSBGAXDAMEQJUSBGAVBEAcBGAcBECeDARgngwEQBwEYBwEQBUEYBUEQAIXBGAXBECVEgRgFQRAlBIEYBQEQAMDnBIEYBwEQAIVBGAVBECXDARglwwEQBcEYBcEQBwEYBwEQBcEYBcEQAKUEgRgFARAA5cSBGAXEgAMCwRQBQcBCJ4CnwoEMAEIngKfCgQgAQieAp8KBBABCJ4CnwoEUAEIngKfCgQwAQieAp8KBCABCJ4CnwoEEAEIngKfCgRQAQieAp8KBDABCJ4CnwoEIB4EEAEIngKfCgwEDQsEUAEIngKfCgQwAQieAp8KBCABCJ4CnwoEEAEIngKfCgRQAQieAp8KBDABCJ4CnwoEIAEIngKfCgQQAQieAp8KBFABCJ4CnwoEMAEIngKfCgQgHgQQAQieAp8KDA0EYAEIngKfCgRAAQieAp8KBDABCJ4CnwoEEAEIngKfCgRgAQieAp8KBEABCJ4CnwoEMAEIngKfCgQQAQieAp8KBFCeAp8GBECeAp8GBGCeAp8GBFABCJ4CnwoEQAEIngKfCgQgnhgEEAEIngKfCgQQAQieAp8KBCABCJ4CnwoEEAEIngKfCgQwnhgEEAEIngKfCgQQAQieAp8KBDABCJ4CnwoEEAEIngKfCgRAnhgEEAEIngKfCgQQAQieAp8KBEABCJ4CnwoEEAEIngKfCgRQnhgEEAEIngKfCgQQAQieAp8KBFABCJ4CnwoEIAEIngKfCgRgnhgEMAEIngKfCgQQAQieAp8KBGABCJ4CnwoEQAEIngKfCgRwnhgEUAEIngKfCgQwAQieAp8KBFABCJ4CnwoEMAEIngKfCgSQnhgEYAEIngKfCgRAAQieAp8KBGABCJ4CnwoEUAEIngKfCgSgnhgEgAEIngKfCgRgAQieAp8KBKABCJ4CnwoEcAEIngKfCgsE8AUBAQMdBHAFBwEIngKfCgRQAQieAp8KBDABCJ4CnwoEsAEIngKfCgRwAQieAp8KBPAFAQEGHgQwBQcBCJ4CnwoEsAEIngKfCgRwAQieAp8KBPAFAQEGHgUHBJCeAp8EBICeAp8EBPAFAQEDHQRwBQcBCJ4CnwoEUAEIngKfCgQwAQieAp8KBLABCJ4CnwoEcAEIngKfCgTwBQEBBh4EMAUHAQieAp8KBJCeAp8EBFCeAp8EBJCeAp8EBGCeAp8EBQSeGAwDBPAFAQEDHQRwBQcBCJ4CnwoEUAEIngKfCgQwAQieAp8KBLABCJ4CnwoE8AUBAQMdAQYeBDABCJ4CnwoEsAEIngKfCgRwAQieAp8KBPAFAQEGHgRwngKfBARgngKfBATwAQMdBHABCJ4CnwoEUAEIngKfCgTwAQMdAQieAp8KBHABCJ4CnwoE8AUBAQYeBDAFBwEIngKfCgSAngKfBARAngKfBARwngKfBARAngKf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AgRwAQieBJ8CBGABCJ4EnwIE8AEDHZ8FBGABCJ4EnwgEgAEIngwE8AEDHZ8FAQYLBNCeB58BBJCeB58BBKCeB58BDAILBPABAx2fBQRgAQieBJ8IBIABCJ4YBNABBp4YBIABCJ4YBPABAx2fBQRgAQieBJ8IBIABCJ4MBPABAx2fBQTQAQaeGASAAQieGAwCBPABAx2fEQSAAQieBJ8CBIABCJ4EnwIEcAEIngSfAgRgAQieBJ8CBMABBp4YBIABCJ4EnwIEcAEIngSfAgRwAQieBJ8CBGABCJ4EnwIE8AEDHZ8FBGABCJ4EnwgEgAEIngwE8AEDHZ8FBNABBp4YBGABCJ4EnwIEgAEIngSfAgSQAQieBJ8CBKABCJ4EnwIE0AEGngwBBp4YAQaeGAEGnhgBBp4MAQaeGJ9IEv//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GAAeBOUK4REAESmavN3u79y7qqqqu8zPDQ/kBgEFCARQAAgHEQsBBxoYFQMdGhgVEwMdGhgVAx0aGBUYGh0CFRgaHQIVAh0aGBUTAx0aHBgVEwMdGhwYEwMdGhgVGBodAhMCAhwYFQMdAhMDHBgaFQMdAhMDHBgVAx0CEwMcGBUDHQIVGBwCEwICGxgVAx4bGBUYAx4bGBUDHhsYFRgbHgIVGBseAhUMBAYCAQUEYJZCBDCWBgRglnIEMJYGBGCWQgQwlgYEYJhCBDCYBgRgnSoEMJ0GBGCWQgQwlgYEYJVCBDCVBgRgA50qBDCdBgRgApNCBDCTBgRgA50qBDCdBgRQA54IBFAClAgEUJYIBFCYCARgmQgEYJsIBGCdCARwnggEcAKUCARglkIEMJYGBGCWcgQwlgYEYJZCBDCWBgRgmEIEMJgGBGCZKgQwmQYEYJxCBDCcBgRgmEIEMJgGBGAClSoEMJUGBGCTQgQwkwYEYAOdcgQwnQYAGAMOgR8EYBYfBHAaHwIVHwMaHxwfAhQfFx8DHB8VHxwfAhUfAxgfGh8eHxUfGh8THxYfHR8YHxUfFx8cHxofGB8aHwITHwMaHx0fGh8dHxwACAYBDoAEcAICAhUDHRYaFQMdFhgaFQMdFhoVAx0WHQIVGhYdAhUaFgICGAMdFhoYAx0WHRoYAx0WAgICEwMWHBMDFhwTFgMWHBMWAgICGAMVHRgDFR0YAx0VHRgDFQIYHRUCGB0VAhgdFQIYHRsYFAMdGxgUAx0CFAMbGBQDHRsYFAMdAhQYGx0CFBgbHQICGhUDFh0aFQMWAhUDHRoVAxYdGgITAxYCFhoCEwMWAhYaAhMDFgIYEwMVHRgTAxUCEwMdGBMDFR0YEwMdAhMYHRgCExgdAhMCGAMZHRgDGR0YGQMZHRgDGQIYHRkC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HQRAGAQgAx0EQAIdBCACEwRAAwMdBCACHQRAAhMEIAMYBEAdBCAdBEAYBCADHgRAAh0EIBkEQAMeBCACHgRAGQQgAx4EQAIeBCACFARAAwMeBCACHgRAAhQEIAMZBEAeBCAeBEAZBCADHgRAAh4EIBkEQAMeBCACHgRAGQQgAx4EQAIeBCACFARAAwMeBCACHgRAAhQEIAMZBEAeBCAeBEAZBCADHQRAAh4EIBgEQAMdBCACAhMEQAMYBCADHQRAAgITBCADHQRAAx0EIAIYBEAdBCATBEAYBCADGARAAhMEIAMdBEAYBCACGARAAx0EIAIdBEAYBCADHQRAAh0EIAITBEADAx0EIAIdBEACEwQgAxgEQB0EIB0EQBgEIAAYAxYCHQMWAh0DFgIdAxYCHQMcAgIUAwMcAgIUnwMDA5wVAgIUAwMUAgIUAwMVAhwDFQIcAxUCHAMcAhwDGgIeBCADAxoEIAICAhUEIAMDAxwEIAICGgMDHgICHgMTAhoDEwIdEwIWAwMTAhoDEwIdAxUCAhMDAxcCAhcDAxoCHQMYAgITAwMYAgITAwMYAhoDAxgCAh0DGAICFgMDAxgCAgIWAwMYAgITAwMXAgIVAAwEIAMDlhgCFgRAFgQgA5YYAhYEQBYEIAOWGAIWBEAWBCADlhgCFgRAFgQgA5YYAhYEQBYEIAOWGAIWBEAWBCADlhgCFgRAFgQgA5YYAhYEQBYEIAOVGAIVBEAVBCADlRgCFQRAFQQgA5UYAhUEQBUEIAOVGAIVBEAVBCADlBgCFARAFAQgA5QYAhQEQBQEIAOUGAIUBEAUBCADlBgCFARAFAQgA5MYAhMEQBMEIAOTGAITBEATBCADmhgCGgRAGgQgA5oYAhoEQBoEIAOVGAIVBEAVBCADlRgCFQRAFQQgA50YAh0EQB0EIAOdGAIdBEAdBCADmRgCGQRAGQQgA5kYAhkEQBkEIAOZGAIZBEAZBCADmRgCGQRAGQQgA5gYAhgEQBgEIAOYGAIYBEAYBCADmBgCGARAGAQgA5gYAhgEQBgEIAOWGAIWBEAWBCADlhgCFgRAFgQgA5YYAhYEQBYEIAOWGAIWBEAWBCADlhgCFgRAFgQgA5YYAhYEQBYEIAOWGAIWBEAWBCADlhgCFgRAFgQgA5UYAhUEQBUEIAOVGAIVBEAVBCADlRgCFQRAFQQgA5UY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BKABCJ4EnwgEcAEGHgSgBPABA50HnxEEcAEGHgSAAQYeBKABBh4fBNABBh4EcAEGHgTwAQOdB58RBKABCJ4EnwgfBNABBh4fBKABCJ4EnwgEcAEGHgSgAQieBJ8IHwTwAQOdB58FHwTQAQaeGASgAQieBJ8IBHABBh4E8AEDnQefBR8EoAEIngSfCATQAQYeHwSgAQieBJ8IAQYeHwEIngSfCATAAQYeBPABA50HnwUEoAEIngSfCARQAQYeBIABBh4EoAEGHgTQAQYeBPABA50HnwUfBKABCB4fBNABBh4fBKABCB4E8AEDnQefBQEDnQefBR8EoAEIHgTwAQOdB58FBNABBh4fBPAEoAEIHh8E8AEDnQefBQEDnQefBQSgAQgeBPABA50HnwUE0AEGHh8EoAEIHgTwAQOdB58FAQOdB58FHwSgAQgeBPABA50HnwUE0AEGHh8EoAEIngSfCAEIngSfCATwAQOdB58FHwSgAQgeBPABA50HnwUE0AEGHh8EoAEIHh8E8AEDnQefBR8EoAEIHgTwAQOdB58FBNABBh4fBPABA50HnwUfAQOdB58FAQOdB58FBKABCB4E8AEDnQefBQTQAQYeHwSgAQgeBPABA50HnwUBA50HnwWfGAEDnQefBQTQAQYeHwSgAQieBJ8IAQieBJ8IBPABA50HnwUfBKABCB4fBNABBh4fBKABCB4fBPABA50HnwUfBKABCB4E8AEDnQefBQTQAQYeHwSgAQgeBPABA50HnwUBA50HnwUBA50HnwUEoAEIHgTwAQOdB58FBNABBh4fBKABCB4E8AEDnQefBQEDnQefBR8EoAEIHgTwAQOdB58FBNABBh4fBKABCJ4EnwgBCJ4EnwgE8AEDnQefBQEDnQefBQSgAQgeBPABA50HnwUE0AEGHh8EoAEIHgTwAQOdB58FAQOdB58FAQOdB58FBKABCB4E8AEDnQefBQTQAQYeBPABA50HnwUEoAEIHgTwAQOdB58FBNABBh4fBKABCB4E0AEGHgEGHgTwAQOdB58FBKABCB4EgAEGngYEwJ4GBNABBh4BBh4EoAEIHgTQAQYeBJABBh4EwAEGHgSgAQgeBNABBh4E8AEDnQefBR8EoAEIHh8E0AEGHh8EoAEInhgE8AEDnQefBZ8YAQOdB58FBNABBh4fBPABA50HnwUBA50HnwUBA50HnwUfBKABCB4fBNABBh4fBKABCJ4EnwQBCJ4EnwQBCJ4EnwQE8AEDnQefBR8EoAEIngSfCATwAQOdB58FBNABBh4fBKABCB4fBPABA50HnwUfBKABCB4fBNABBh4fBKABCJ4YBPABA50HnwWfGAEDnQefBQTQAQYeHwSgAQgeHwTwAQOdB58FHwSgAQgeHwTQAQYeHwSgAQieBJ8EAQieBJ8EAQieBJ8EBPABA50HnwUfBKABCJ4EnwQBCJ4EnwQBCJ4EnwQE0AEGHh8EoAEIngSfBAEIngSfBAEIngSfBATwAQOdB58FHwSgAQgeHwTQAQYeHwSgAQieGATwAQOdB58FnxgBA50HnwUE0AEGHh8EoAEIHh8E8AEDnQefBR8EoAEIHh8E0AEGHh8EoAEIngSfBAEIngSfBAEIngSfBATwAQOdB58FHwSgAQieBJ8IBPABA50HnwUE0AEGHh8EoAEIHh8E8AEDnQefBR8EoAEIHh8E0AEGHh8EoAEInhgE8AEDnQefBZ8YAQOdB58FBNABBh4fBKABCB4fBPABA50HnwUfBKABCB4fBNABBh4fBKABCJ4EnwQBCJ4EnwQBCJ4EnwQE8AEDnQefBR8EoAEIngSfBAEIngSfBAEIngSfBATQAQYeHwEGHgEGHgTwAQOdB58FHwSgAQgeHwTQAQYeHwSgAQieGATwAQOdB58FnxgBA50HnwUE0AEGHh8E8AEDnQefBQEDnQefBQEDnQefBR8EoAEIHh8E0AEGHh8EoAEIngSfBAEIngSfBAEIngSfBATwAQOdB58FHwSgAQieBJ8IBPABA50HnwUE0AEGHh8EoAEIHh8E8AEDnQefBR8EoAEIHh8E0AEGHh8EoAEInhgE8AEDnQefBZ8YAQOdB58FBNABBh4fBKABCB4fBPABA50HnwUfBKABCB4fBNABBh4fBKABCJ4EnwQBCJ4EnwQBCJ4EnwQE8AEDnQefBR8EsAEGngYE0J4DnwMEYJ4InwQEgJ4InwQEkJ4InwQEoJ4InwQEwJ4InwQE0AEGHh8EoAEIngSfCAEIngSfCATwAQOdB58FHwTQAQYeHwSgAQieBJ8IAQieBJ8IBPABA50HnwUfBKABCB4EoAEGngYEwJ4GBNABBh4EgAEGHgRAAQYeHwTwAQOdB58FBKABCJ4EnwgE8AEDnQefBQEDnQef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nwYPdZ8GD42fDA+knzAPeJ8MD3yfBg+CnwYPjZ8GD3ifBg+NnwwPpJ8wD3ifEg+CnwYPjZ8GD3ifBg+NnwwPpJ8wD3ifEg+CnwYPjZ8wnwwPeJ8MD22fJA9fnwwPVJ+oDwANn8AS/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+j7zTE1zdE0IaHANgAhycA2ACEAAOXN2TfoAs2FBgFH/z7kAiGKDOUhACjlzQo36AQhlkHlISgY5c0VCegEId5C5SFFD+XNFQnoBCGAQuUhFBLlIQAA5c31CegGIetH5SEFAeUhCwHlzRw46AYhpsB+9TPNHgjoASGmwH7G/08+D4FPPgbOAEcKTyGuwJZPWRYAa2IpGU1EIbHAfvgBIjYAKypmbwlNRCGmwH71M3n1M82bBUvoAvgDNusjNkN5t8rRQPgDfsYAIn7OAXcNw75A+AMqZm/lIQAQ5c1XN+gEIabAXhYAa2IpGSlNRCHlBQlNRPgDcSNwKypmb+UhBgHlIQQB5c0cOOgGARr/PgACIRAA5SHwR+UhMP/lzRE26AYBQP/4ATZAIzb/K14jVhorK3fm3wIBQP8jNkAjNv8rXiNWGisrd/YBAgFA/yM2QCM2/yteI1YaKyt39gICAUD/IzZAIzb/K14jVhorK3f2BAIBSP8+0ALNhQYBQP/4ATZAIzb/K14jVhorK3f2gALNLzXoBcn/AOcAwwCBAIEAwwDnAP8A/z/AQICADP//AgAADv/8AwIBAQyAgBAAABI8PAJmZgJgYARmZgI8PAIAAARgYAp+fgIAAAR+fgJgYAJ8fAJgYAR+fgIAAAQ8PAJmZgR+fgRmZgIAAAR8fAJm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//8CAP8A/wB/gD/AD/AH+A/w+Af8A/4B/gH/AP8A/wD/AAAC/wf4H+A/wH+Af4D/AP8A/wD/AP8A/wD+Af4B/gH8A3+Af4A/wD/AH+AP8Af4AP/8A/gH8A/gH+AfwD+AfwD/D/AH+AP8Af4B/gH+Af4D/P4B/AP8A/gH8A/gH8A/wD8D/Af4D/AP8B/gP8A/wH+AgAJ/gH+Af4B/gH+Af8A/wD9/gH+A/wD/AP8A/wD/AP8AwAAAD/8APwAfAB8ADwAPAAAF/wD/AP8A/wD/AP8AfwABAMA/wD/gH/AP/AP+Af4B/wB/gD/AH+Af4A/wD/AP8B/gAAAQfwA/AB8AHwAPAA8ADwAPAP8A/wD/AP4B/gH/AP8A/wAAAv8A/wD/AP8A/wD/gH/gHx8C4B/gP8A/wH+Af4D/AP8ABwAADQ8A/wB/AA8AAwAABQEA/wD4B/8A/wD/AD8AAQD/AP8AAAL/AP8A/wD/A/wP8D/A/wAB/gf4P8D/AP8A/wD/AP8A/gD8APgA+AD4AOAAwACAAAANAwAHAAEABwAHAAcADwAfAP8A/wAH+B/gP8D/AA/wA/wA/wD//wIA/wD/AP8A/wD/AD/AD/CAAAANgAAHAA8APwB/AH8AfwAfAA8AgADAAMAAgACAAAAHBwAAD/8A/wB/AD8APwAHAAMAAQAAAv8A/x7hP8B/gH+A/wD/AAAC/wD/AP8A/55h/wD/AP8AAAL/AP8A/wD/Af6HeP8A/wD+APgA8ADgAMAAwADAAMAAAAsBAAMABwAH+D/Af4D/AP8Af4A/wB/gwADgAOAA4ADgAMAAwACAAD8AfwD/AP8AfwA/AAcAAQAf4B/gP8A/wD/Af4B/gH+AgAIAgAAADcA/4B/gH+Af8A/+Af8A/wAAAv8A/wH+B/gf4D/Af4B/gP8A/wD/AP8A/wD/AP8A/AD/AP8A/wD/AP8A/wDwAAAD/wD/AP8A/wD8AMAAAAX/AP8A/wD8AAAJ/gD8APAAAAvwD/wD/wD/AP8A/wD/AP8AAf4P8P8A/wD/AP8A/wD/AP8A/gCAAPwA/wD/AP8A/wDAAAAJ4AD4AP8A/wAfAAEAAAv/AP8A/wA/AA8ABwAHAA8AAAPAAMAA4ADwAPgA/gD/AAAPgAAABQMADwAPAB8APwB/AB8A/wD/AP8A/wD/AP8A/wDwAPwA/wD/AP8A/wD/AP8AAAeAAIAAwADwAPgAfwAfAAMAAAv/AP8A/wD/AD8AHwAPAAcA+AD4APgA/AD8AP4A/gD/AAMAAwABAAEAAQAAB4AAwADgAPAA+AD8AP4A/gD/AH8AfwB/AD8AHwAHAAAD/wD/AP8A/wD/AP8A+AAAAx8ADwAHAAMAAQABAAAF4AAACeAA+AD/AD8ABwABAAAL/wD/AP8APwAPAAMAAQAAA/8A/wD/AP8A/wD/AP4A8AD/AP8A/ADgAIAAAAf/AMAAAA8fAP8A/wD/AP8A/wD/AAMA/wD/AP8A/wD/AP8A/wDgAP8A/wD/AP8A/wD/AP8AAAP8AP8A/wD/AP8A/wD/AAAF+AD/AP8A/wD/AP8AAAfAAP4A/wD/AP8AAAvgAP4A/wAAD8AA+AD/AP8A/wD/AP8A/wD/AAAFwAD4AP4A/wD/AP8AAAuAAMAA8ADnGOcYwzzDPIF+gX6BfgD//AD+AP8A/wD/AP8A/wD/AAAHgADfAP8A/wD/AAAFAwD/AP8A/wD/AP8AAAL/AP+BfucY5xj/AP8A/wAiIgQjJCUlCiYiIgYnJSUJKCIiByklJQkqIiIHKyUlCiwiIgUtJSULLiIiBS8lJQswIjEyMyI0JSULNSI2NgM3ODklJQo6IjY2Azs8PSMkJSUGPj8iQDZBQiIiBCclJQVDRCIiAkU2RiIiBSklJQYuIiICRzZISSIiBCslJQNKS0wwIk02NgNOIiIDLSUlA08iIgVQNjYDUSIiAy8lJQNSIiIFUzY2A04iIgNUOSVVIlZXWFlaNjYEUSIiBFtcIl1eNjYKX2AiIgZhYjY2CGNkIiIHZWY2NgdnaCIiCGk2NghqIiIJazY2CGwiIgdtWDY2CW4iIgRdbzY2DHBxcnN0NjYXdXYiIgN3eHl6e3w2NgciIgp9fn82NgUiIgKAIiIFgCIiA4GCg3UiIgSEIiIFhCIiD4AiIgmAIiICgCIiBIQiIgmEIiIChCIiCIAiIhGEIiIH//8Ux/+D/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/gD/AP8A/wD/AP8A/wB/AD8AfwD/AP8A/wD/AP8A7wD/AP8A/wD/AP8A/wCfAG8AbwCfAP8A/wD/AP8A/wD9APgA/QD/AP8A/wD/AP8A+wD/AP8A/wD/AP8A/wD/AP8A/wD7AP8A/wD/AP8A/wD/AP8A9wDjAPcA/wD/AP8A/wD/AP8A/wD+AP8A/wD/AP8A/wD/AP8A9wDjAPcA/wD/AP8A/wD/AL8A/wD/AP8A/wD/AP8A/wD/AP8A7wD/AP8A/wD/AP8A/wD/APsA/wD/AP8A/wD/AP8+wX+A/wD/AP8A/wD/AH+APsEA/4B/gH+Af4B/gH8A/wD/AP8A/wD/AP8A/wD/MM94h3iHMM8A/wD/AP8A/wD/AP8A/wD/AP8A/wH+B/gP8A/wH+AA/wD/AP/wD/wD/gH+Af8AH+Af4B/gH+AP8A/wB/gB/v8A/wD/AP8A/gH+AfwD8A8A/wD/AP8O8T/Af4B/gP8AAAL/AP8A/wD/gH/AP8A/4xwA/wD/Af4D/Af4B/h/gP8APsH/AP8A/wD/AP8A/wD/AAAC/4B/wD/gH/AP8wz/AP8AAAL/AP8A/wD/P8D/AP8A/wAAAv8A/wD/AP8A//AP/AP+AQD/A/wP8B/gP8A/wH+Af4AA/8A/8A/4B/wD/AP+Af4BAP8A/wD/AP8A/wD/AP8f4AD/AP8A/wD/AP8H+A/wn2AA/wD/AP8A/wD/gH/AP+AfAP8A/wD/AP8B/gP8B/gH+AD/AP8A/3iH/gH/AP8A/wAAAv/4B/4B/wD/AP8A/wD/AP8A/wD/AH+A/wD/AP8A/wDnGP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AL8AHwC/AP8A/wCAf8A/wD/gH/AP8A/4B/gHAP8A/wH+D/Af4D/Af4B/gH+Af4D/AP8A/wD/AP8A/wD+Af8A/wD/AP8A/wD/AP8AAAL/wD/4B/0C/wD/AP8A/wA/wP8A/wD/AP8A/wD/AP8A3yD/AP8A/wD/AP8A/wD/AO8Q/wD/AP8A/wD/AP8A/wDAP+cY/wD/AP8A/wD/AP8AB/iHeMc4+wT9Av8A/wD/APgH/AP8A/0C/wD/AP8A/wAAAv8e4f8A/wD/AP8A/wD/AH+A/wD/AP8A/wD/AP8A/wD/AOcAwwDDAOcA/wD/AP8A/wD/AP8A/wD/AP8AgwABAP8A/wAfAAMAAAn/AP8A/wD/AP8APwAfAA8A/gD+AP4A/gD+AP8A/wD/AAALAQDHAO8A/wD/AP4A+ADwAOAAwACAAP8AwwAADf8A/wB/AB8ADwAHAAMAAQAAEQ8ABwAHAAMAAwADAAEAAQD/AP8A/wD/AP8A/wD/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fHwCAAAEPDwCZmYEfn4EZmYCAAAEPDwCZmYCeHgCHh4CZmYCPDwCAAAEZmYEfn4EZmYEAAAEPDwCZmYCYGAEZmYCPDwCAAAEPDwCZmYIPDwCAAAEZmYKPDwCAAAEZmYCdnYCfn4Ebm4CZmYCAAAEfn4CGBgKAAAMPDwCZmYEAAAKGBgGAAAKfn4CGBgEZmYCbGwCPj4CAAAKGBgGAAAKJicmJhYoJiYCKSYmBicmJhEqKyYmBCgmJgIqKyYmAicmJgYsLSYmAykmJgMsLSYmBCgmJhQqKyYmDCgmJgUsLSYmAicmJgQqKyYmBSkmJgwsLSYmAicmJh0qKyYmAigmJgQuLzAwBTEwMAMyMzAwBzQ1Njc4OTo7OwY6OTg3NjU0NTY3ODk6Ozw9Pj9APTs6OTg3NjU2Nzg5Ojs7AkFCQ0RFQjs7Ajo5ODc2Nzg5RkdISTtKS0xNTjs7BDk4Nzg5Ojs7BU8/UFE7OwU6OTg5Ojs7BlJEU1MCOzsGOjk6OzsSOv////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAAAAAAAAAAAAfHwMDDAwQEB8fAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcfID9Af0B/kP+Y/39AAAAAAAAAAAAAAAAAAAAAAAAA6Og83DzMf4/OvrL+k30AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMPDB4RPyA/IH9Af0B+QV9gPzAfEA0OAwMAAAAAv+O/wL/Ifv87//tu+34/wP8A/wD/AP8A/wP0jHh4AADRb9F/93+Y/51+zH/ffgD/7xD/AP8A/wD/AO/wHx8AAAAAAADAwLh49Ax+gv4C/gL+Ar5CmmbMPLBwwECAgAAAAAAHBwEBBgYHBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABx8gP0B/QH+Q/5j/f0C/4wAAAAAAAAAA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72A1IarAfuYEIAPDBGEhwMB+xv13wy9hIarAfuYIIAPDGGEhwMA0NDTDL2EhwMB+/oDSJWE0wy9hPoAhwMCW0i9hNSG7wH7+B9JKYTYHPoAhv8CWT8s5ecaAd8NiYT6ZIbvAltJiYTaZIb/AfsaAT8s5PoCRdz6MIbzAltJ6YTaMIcDAfsaAT8s5PoCRdyGlwH7+AcIFYhgDwwViPnEhvMCW0rBhIbrAfrfKsGEhvMA1IbrANX7mASADw6xhw7BhIbnANCG8wH7+HtLNYTQhusA0fuYBIAPDyWHDzWEhucA1IbrAfv5I2oxiIaXANgIhocA2KCGuwDb/IcDANoA+C/UzzUMG6AHNMTUhAEDlzUsG6ALNLzXDjGIhpcB+/gLCjGIYA8OMYiG6wH7+kMpHYiGhwH7mASADwy9iIbrANCG8wDQhocB+5gNP/gPCSmIYA8NKYiG5wDXDSmLNd1YhqsB+5hBPr7HKdGIhq8B+5hBHebjKdGLNYxhLr7HCdGI+A/UzzWoP6AEhvMB+/gfSjGI2Bz6AIcDAlk/LOXnGgHchv8B+/hDSmmI2EMOlYj7wIb/AltKlYjbwIcDAfv4Q0rNiNhDDvmI+8CHAwJbSvmI28CG6wH71Mz4H9TPNxjboAiG5wH71Mz4A9TPN2TfoAj4A9TPNXFnoAc0IB827Ec26NCGlwH7+AsKdXhgDw51eAUD/+AA2QCM2/yteI1YaI3f2BALDnV7NCAc+BvUzzZYE6AHNNA/oBMn/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////6P3NMTXN0TQBSP8+0AIBR/8+5AIBQP/4ATZAIzb/K14jVhorK3d/5t8CAUD/IzZAIzb/K14jVhorK3d/9gICAUD/IzZAIzb/K14jVhorK3d/9gECAUD/IzZAIzb/K14jVhorK3d/9gQCIbBA5SEAP+XNFQnoBCEAROUhFBLlIQAA5c31CegGIcJK5SEABuXN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BGAUBEAWBGAWBEAZBGAZnwYEQBYEYBYEQBgEYBifwA2fGBIS/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wgAHAAdAB4AAAIE8AYBAQMZCC0BBQUHBNCWBRISEhIIABkAGgAbAAECBPAFAQYCnAEILAEDnGASEhISCAA8AD0APgAAAQTwAQUGARUWBJAXBMAGAJgCBPAOfZkCHwTAnQIE8J4CHwQwAgIGARQVBFAWBIAGABcSEhISCABEAEUARgAAAQRwBQgGAgEFFQYBFgSAFwSgmAIEwAYAGQ58GQSgoAIEwKAOGASQFwSAFgRwFQRgFARQBgETBEADHhISEhIIAAkACgALABISEgUKBEABCJ4FEggACQAKAAsAEhISAAIBBwRQHgRgHgEIBMAFAZ4eEggACQAKAAsAEhISAAEFCARAAQceBJAgBEAgBCAgHxIIADgAOQA6AAACBgIBBQTwlAGVAQRAAQEILhcIAAEDBPAbBEAILgEBGwTwCAABAxYEQAguAQEWEhISEggAJgAnACgAAAIGAgTwAQUXHB4CGwMEQBweAhsDBCAcBBAeAhsSEhISCAAuAC8AMAAAAQYCBQgBAwTwBwEcBxEdBgEcBHAgBgIE8AcQHAcRHQYBHARwEhISEggAKgArACwAAAME8AYADoEBBRkCBNAGARkDBEAZAgRwGQMEIBkCBEAZEhISEggASABJAEoAnwYAAQTgBgIBBhgCFwMdnxMBBwYABMAAAh4fAhMfAx0fBGAeHwITHwMdHwQwHh8CBCAdHx4fAhMfAwQQHR8eEhISAAIE8AEDHQEHHgEFHp8QBQEABATgAQUeAhwEwJ4OBIAcHQRAng4EMBwdBBCeDhIIADUANgA3AAABBgABAwTQFAYCAhQaBgEEsAMdAhobAxsCFwSgAhUEcBMEUAMVBDAaBBAZEhISAAEfAQME0B0CHQMeBPAeBNAeA54EBLAdAwRwHQRAHQQgHRIIADAAMQAyAAABAQMEwAYCFBMWBgEEsAEHGhkCFBsTAwSgHQRwHARQGQQwFgQQExISEgABHwEDBNAdAh0DHgIeBPAeBNAeA54EBLAdAwRwHQRAHQQgHRIIADEAMgAzAAABAQIEwAYCHBseBgEEsAEHFhUcAhcDGwSgGQRwGARQFQQwAx4EEBsSEhIAAR8BAwTQHQIdAx4CHgTwHgTQHgOeBASwHQMEcB0EQB0EIB0SCAA5ADoAOwAAAQEFBOAGABoGARseBNACExQVFBMEwAMeBGAcBCACExQVFBMEMAMeBCAcGwQQGhgSEhIAAR8BAwTQHQIdAx4CHgTwHgTQHgOeBASwHQMEcB0EQB0EIB0SCABOAE8AUAAGAQACAQYE8B0cHQRgnASfAgTwHRwEYJwBBPAdHJ0BnQEEYJwBnASfAQTwHRwEYJwBBPAdHB0cHRwdnAEEYJwBHQRgnAYSEhISCAAyADMANAAFCAEGAAMGAgSQGwIbAxsCGwMEYBsCGwMbAgRAGwMLGwIbAwwLGw2fBhISEhIIAD8AQABBAAADBPAGAAEGBPATBDAXBPAcBDAYBPAcBDAYBPAcBDAYBPAcBDAYBPAcBDAYBPAcGAQwGAQQGBISEhIIAFAAUQBSAAYBAQME4AACHB0eAhMUFRYXGBkaGxwDHgITFATAFRYXGBkaGxwdHgITFBUDFxgZBHAaGxwEUB0eAhMUBDAVFhcYGQQQGhscEhISEggACQAKAAsAEhISBQIABATgAQUeAhwEwJ4gEv////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8YAG0EyAj+DgARKZq83e7v3Luqqqq7zM8PxgYABQgHEQEFBKAOgggAlwYIA5gSCACXBggDmBIIAJcGlgaUBgOdBgKUA5YJlAOVFQOdDJgMmwydDAKTDJQDlQkDnQwCCACXBggDmBIIAJcGCAOYEggAlwaWBpQGA50GApQDlgmUAwo2EpVXBFCVBgSgCQADnQwCCACXBggDmBIIAJcGCAOYEggAlwaWBpQGA50GApQDlgmUA5UVA5cMmAybDJ0MApMMlQwDnQwCCACXBggDmBIIAJcGCAOYEggAlwaWBpQGA50GApQDlgmUAwo2EpVjBFCVBgSgCQCTBggDlBIIAJMGCAOUEggAlgyUDJYMmBiUDAOXDJgMmwydDAKTDJQMCACXBggDmBIIAJcGCAOYEggAlwaWBpQGA50GApsMmwYKNhKdWgkABQgEUJ0MAwYBDoAEkJgGBFCYBgSQmAYEUJgGBJCdBgRQnQYEkJgGBFCYBgSQmAYEUJgGBJCYBgRQmAYEkJ0GBFCdBgSQmAYEUJgGBJCYBgRQmAYEkJgGBFCYBgSQnQYEUJ0GBJCYBgRQmAYEkAKTBgRQkwYEkAOYBgRQmAYEkJ0GBFCdBgSQmAYEUJgGBJCYBgRQmAYEkJgGBFCYBgSQnQYEUJ0GBJCYBgRQmAYEkJgGBFCYBgSQmAYEUJgGBJCdBgRQnQYEkJgGBFCYBgSQmAYEUJgGBJCYBgRQmAYEkJ0GBFCdBgSQmAYEUJgGBJACkwYEUJMGBJADmAYEUJgGBJCdBgRQnQYEkJgGBFCYBgSQnQYEUJ0GBJCdBgRQnQYEkAKWBgRQlgYEkAOdBgRQnQYEkJ0GBFCdBgSQnQYEUJ0GBJAClgYEUJYGBJADnQYEUJ0GBJCdBgRQnQYEkJ0GBFCdBgSQApYGBFCWBgSQA50GBFCdBgSQApgGBFCYBgSQA50GBFCdBgSQApYGBFCWBgSQA50GBFCdBgSQmAYEUJgGBJCYBgRQmAYEkJ0GBFCdBgSQmAYEUJgGBJCYBgRQmAYEkJgGBFCYBgSQnQYEUJ0GBJCYBgRQmAYEkJgGBFCYBgSQmAYEUJgGBJCdBgRQnQYEkJgGBFCYBgSQApMGBFCTBgSQA5gGBFCYBgSQnQYEUJ0GBJCYBgRQmAYEkJ0GBFCdBgSQnQYEUJ0GBJAClgYEUJYGBJADnQYEUJ0GBJCdBgRQnQYEkJ0GBFCdBgSQApYGBFCWBgSQA50GBFCdBgSQnQYEUJ0GBJCdBgRQnQYEkAKWBgRQlgYEkAOdBgRQnQYEkAKYBgRQmAYEkAOdBgRQnQYEkAKWBgRQlgYEkAOdBgRQnQYEkJgGBFCYBgSQmAYEUJgGBJCdBgRQnQYEkJgGBFCYBgSQmAYEUJgGBJCYBgRQmAYEkJ0GBFCdBgSQmAYEUJgGBJCYBgRQmAYEkJgGBFCYBgSQnQYEUJ0GBJCYBgRQmAYEkAKTBgRQkwYEkAOYBgRQmAYEkJ0GBFCdBgSQmAYEUJgGEgYABQgBBQcRBEAOgJ8MCACXBggDmBIIAJcGCAOYEggAlwaWBpQGA50GApQDlgmUA5UVA50MmAybDJ0MApMMlAOVCQOdDAIIAJcGCAOYEggAlwYIA5gSCACXBpYGlAYDnQYClAOWCZQDCjYSlVcEIJUGBEAJAAOdDAIIAJcGCAOYEggAlwYIA5gSCACXBpYGlAYDnQYClAOWCZQDlRUDlwyYDJsMnQwCkwyVDAOdDAIIAJcGCAOYEggAlwYIA5gSCACXBpYGlAYDnQYClAOWCZQDCjYSlWMEIJUGBEAJAJMGCAOUEggAkwYIA5QSCACWDJQMlgyYGJQMA5cMmAybDJ0MApMMlAwIAJcGCAOYEggAlwYIA5gSCACXBpYGlAYDnQYCmwybBp1aBgEOggEDBJCdBgRQnQYEkJ0GBFCdBgSQApgGBFCYBgSQA50GBFCdBgSQnQYEUJ0GBJCdBgRQnQYEkAKYBgRQmAYEkAOdBgRQnQYEkJ0GBFCdBgSQnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJCdBgRQnQYEkJ0GBFCdBgSQApgGBFCYBgSQA50GBFCdBgSQnQYEUJ0GBJCdBgRQnQYEkAKYBgRQmAYEkAOdBgRQnQYEkJ0GBFCdBgSQnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJAClgYEUJYGBJCWBgRQlgYEkJ0GBFCdBgSQlgYEUJYGBJCWBgRQlgYEkJYGBFCWBgSQnQYEUJ0GBJCWBgRQlgYEkJYGBFCWBgSQlgYEUJYGBJCdBgRQnQYEkJYGBFCWBgSQnQYEUJ0GBJCWBgRQlgYEkJ0GBFCdBgSQlgYEUJYGBJADnQYEUJ0GBJCdBgRQnQYEkAKYBgRQmAYEkAOdBgRQnQYEkJ0GBFCdBgSQnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJCdBgRQnQYEkJ0GBFCdBgSQApgGBFCYBgSQA50GBFCdBgSQApgGBFCYBgSQA50GBFCdBgSQApgGBFCYBgSQA50GBFCdBgSQApYGBFCWBgSQlgYEUJYGBJCdBgRQnQYEkJYGBFCWBgSQlgYEUJYGBJCWBgRQlgYEkJ0GBFCdBgSQlgYEUJYGBJCWBgRQlgYEkJYGBFCWBgSQnQYEUJ0GBJCWBgRQlgYEkJ0GBFCdBgSQlgYEUJYGBJCdBgRQnQYEkJYGBFCWBgSQA50GBFCdBgSQnQYEUJ0GBJACmAYEUJgGBJADnQYEUJ0GBJCdBgRQnQYEkJ0GBFCdBgSQApgGBFCYBgSQA50GBFCdBgSQnQYEUJ0GBJCdBgRQnQYEkAKYBgRQmAYEkAOdBgRQnQYEkAKYBgRQmAYEkAOdBgRQnQYEkAKYBgRQmAYEkAOdBgRQnQYSEQABAwcRBCCdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIJYGBECWBgQglgYEQJYGBCCWBgRAlgYEIJYGBECWBgQgA50GBECdBgQgnQYEQJ0GBCACmAYEQJgGBCCYBgRAmAYEIJYGBECWBgQglgYEQJYGBCCWBgRAlgYEIJYGBECWBgQgA50GBECdBgQgnQYEQJ0GBCACmAYEQJgGBCCYBgRAmAYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIJYGBECWBgQglgYEQJYGBCCWBgRAlgYEIJYGBECWBgQgA50GBECdBgQgnQYEQJ0GBCACmAYEQJgGBCCYBgRAmAYEIJQGBECUBgQglAYEQJQGBCCUBgRAlAYEIJQGBECUBgQgA5sGBECbBgQgmwYEQJsGBCAClgYEQJYGBCCWBgRAlgYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIJYGBECWBgQglgYEQJYGBCCWBgRAlgYEIJYGBECWBgQgA50GBECdBgQgnQYEQJ0GBCACmAYEQJgGBCCYBgRAmAYEIJYGBECWBgQglgYEQJYGBCCWBgRAlgYEIJYGBECWBgQgA50GBECdBgQgnQYEQJ0GBCACmAYEQJgGBCCYBgRAmAYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIJYGBECWBgQglgYEQJYGBCCWBgRAlgYEIJYGBECWBgQgA50GBECdBgQgnQYEQJ0GBCACmAYEQJgGBCCYBgRAmAYEIJYGBECWBgQglgYEQJYGBCCWBgRAlgYEIJYGBECWBgQgA50GBECdBgQgnQYEQJ0GBCACmAYEQJgGBCCYBgRAmAYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYEIAOdBgRAnQYEIJ0GBECdBgQgnQYEQJ0GBCCdBgRAnQYEIJgGBECYBgQgmAYEQJgGBCACkwYEQJMGBCCTBgRAkwYSBxEABwUBBOABAx2fBQEDHZ8FBNABBp4MBLABBp4MBOABAx2fBQEDHZ8FBNABBp4YBOABAx2fBQEDHZ8FBNABBp4MBLABBp4MBOABAx2fBQEDHZ8FBNABBp4YBOABAx2fBQEDHZ8FBNABBp4MBLABBp4MBOABAx2fBQEDHZ8FBNABBp4YBOABAx2fBQEDHZ8FBNABBp4MBLABBp4MBOABA50GAQOdBgEDHZ8FBNABBp4MBLABBp4GBLABBp4GBOABAx2fBQEDHZ8FBNABBp4MBLABBp4MBOABAx2fBQEDHZ8FBNABBp4YBOABAx2fBQEDHZ8FBNABBp4MBLABBp4MBOABAx2fBQEDHZ8FBNABBp4YBOABAx2fBQEDHZ8FBNABBp4MBLABBp4MBOABAx2fBQEDHZ8FBNABBp4YBOABAx2fBQEDHZ8FBNABBp4MBLABBp4GAQaeBgTgAQMdnwUBAx2fBQTQAQaeGATgAQMdnwUBAx2fBQTQAQaeDASwAQaeDATgAQMdnwUBAx2fBQTQAQaeGATgAQMdnwUBAx2fBQTQAQaeDASwAQaeDATgAQMdnwUBAx2fBQTQAQaeGATgAQMdnwUBAx2fBQTQAQaeDASwAQaeDATgAQMdnwUBAx2fBQTQAQaeGATgAQMdnwUEsAEGngYEwAEGngYE0AEGngwEgAUEAQieGAUBBLABBp4GBMABBp4GBNABBp4MBLABBp4MBNABAx2fBQEDHZ8FBMABBp4MBJABCJ4EnwgE0AEDHZ8FAQMdnwUEwAEGngwEkAEIngSfAgEIngSfAgTQAQMdnwUBAx2fBQTAAQaeDASQAQieBJ8IBNABA50GAQOdBgEDHZ8FBMABBp4MBJABCJ4EnwIBCJ4EnwIE0AEDHZ8FAQOdBgEDnQYEwAEGngwEkAEIngSfCATQAQMdnwUBAx2fBQTAAQaeGATQAQMdnwUBAx2fBQTAAQaeDASQAQieBJ8IBNABAx2fBQSQAQieBJ8IBMABBp4MBJABCJ4EnwIBCJ4EnwIE0AEDHZ8FAQMdnwUEwAEGngwEkAEIngSfCATQAQMdnwUBAx2fBQTAAQaeGATQAQMdnwUBAx2fBQTAAQaeDASQAQieBJ8IBNABA50GAQOdBgEDHZ8FBMABBp4YBNABAx2fBQEDnQYBA50GBMABBp4MBJABCJ4EnwgE0AEDHZ8FAQMdnwUEwAEGnhgE0AEDHZ8FAQMdnwUEwAEGngwEkAEIngSfCATQAQMdnwUEkAEIngSfCATAAQaeDASQAQieBJ8CAQieBJ8CBNABAx2fBQEDHZ8FBMABBp4MBJABCJ4EnwgE0AEDHZ8FAQMdnwUEwAEGnhgE0AEDHZ8FAQMdnwUEwAEGngwEkAEIngSfCATQAQOdBgEDnQYBAx2fBQTAAQaeGATQAQMdnwUBAx2fBQTAAQaeDASQAQieBJ8IBNABAx2fBQTAAQaeBgEGngYBBp4GAQaeBgTQAQMdnwUEoAEGngwBBp4GBLABBp4GBMABBp4MBIAFBAEInhgFAQSgAQaeBgSwAQaeBgTAAQaeDASwAQaeDBL//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////w==";

  // No closure, as the whole file is closure'd

  const runTask = async () => {
    const WasmBoy = await getWasmBoyTsCore();
    console.log('WasmBoy', WasmBoy); // Convert the rom Url to an array buffer

    const ROM = dataUriToArray(romUrl);
    console.log('Rom', ROM); // Clear Memory

    for (let i = 0; i <= WasmBoy.byteMemory.length; i++) {
      WasmBoy.byteMemory[i] = 0;
    } // Load the ROM into memory


    WasmBoy.byteMemory.set(ROM, WasmBoy.instance.exports.CARTRIDGE_ROM_LOCATION); // Config the core
    // Our config params

    const configParams = [0, // enableBootRom
    1, // useGbcWhenAvailable
    1, // audioBatchProcessing
    0, // graphicsBatchProcessing
    0, // timersBatchProcessing
    0, // graphicsDisableScanlineRendering
    1, // audioAccumulateSamples
    0, // tileRendering
    1, // tileCaching
    0 // enableAudioDebugging
    ];
    WasmBoy.instance.exports.config.apply(WasmBoy.instance, configParams);
    const keyMap = {
      A: {
        active: false,
        keyCodes: [90]
      },
      B: {
        active: false,
        keyCodes: [88]
      },
      UP: {
        active: false,
        keyCodes: [38, 87]
      },
      DOWN: {
        active: false,
        keyCodes: [40, 83]
      },
      LEFT: {
        active: false,
        keyCodes: [37, 65]
      },
      RIGHT: {
        active: false,
        keyCodes: [39, 68]
      },
      START: {
        active: false,
        keyCodes: [13]
      },
      SELECT: {
        active: false,
        keyCodes: [16]
      }
    };
    let isPlaying = true;

    const keyMapEventHandler = (event, shouldActivate) => {
      event.preventDefault(); // First check for play pause

      if (event.keyCode === 32 && !shouldActivate) {
        console.log('Togling Play/Pause...');
        isPlaying = !isPlaying;

        if (isPlaying) {
          play();
        }

        return;
      }

      Object.keys(keyMap).some(key => {
        if (keyMap[key].keyCodes.includes(event.keyCode)) {
          if (shouldActivate) {
            keyMap[key].active = true;
          } else {
            keyMap[key].active = false;
          }

          return true;
        }

        return false;
      });
    }; // Create an fps counter


    const fpsCounter = document.createElement('div');
    fpsCounter.id = 'fps';
    document.body.appendChild(fpsCounter); // Create an input handler

    const controlsOverlay = document.createElement('input');
    controlsOverlay.setAttribute('id', 'controls');
    controlsOverlay.addEventListener('keydown', event => keyMapEventHandler(event, true));
    controlsOverlay.addEventListener('keyup', event => keyMapEventHandler(event, false));
    document.body.appendChild(controlsOverlay);
    let frameSkip = 0;
    let maxFrameSkip = 2; // Start playing the rom

    const play = () => {
      if (!isPlaying) {
        return;
      } // Run a frame


      WasmBoy.instance.exports.executeFrame(); // Render graphics

      if (frameSkip >= maxFrameSkip) {
        // Reset the frameskip
        frameSkip = 0; // Remove the old svg element

        const oldSvg = document.getElementById('wasmboy-svg-output');

        if (oldSvg) {
          oldSvg.remove();
        }

        const imageSvg = rgbaArrayBufferToSvg(160, 144, WasmBoy.byteMemory, WasmBoy.instance.exports.FRAME_LOCATION);
        imageSvg.setAttribute('id', 'wasmboy-svg-output');
        document.body.appendChild(imageSvg);
      } else {
        frameSkip++;
      } // Handle Input


      WasmBoy.instance.exports.setJoypadState(keyMap.UP.active ? 1 : 0, keyMap.RIGHT.active ? 1 : 0, keyMap.DOWN.active ? 1 : 0, keyMap.LEFT.active ? 1 : 0, keyMap.A.active ? 1 : 0, keyMap.B.active ? 1 : 0, keyMap.SELECT.active ? 1 : 0, keyMap.START.active ? 1 : 0);
      fpsCounter.textContent = `FPS: ${getFPS()}`;
    };

    run60fps(play);
    console.log('Playing ROM...');
  };

  runTask();

}());
