(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.WasmBoyTsCore = factory());
}(this, (function () { 'use strict';

  // Banner placed by rollup to mock out some items on our esm build
  // This is useful for things like wasmmemory

  const wasmboyMemorySize = 0x8b0000;

  // Simply initialized to the size we need
  const wasmByteMemory = new Uint8ClampedArray(wasmboyMemorySize);

  // Memory mock
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

  // Constants that will be shared by the wasm core of the emulator
  // And libraries built around the wasm (such as the official JS), or @CryZe wasmboy-rs
  // ----------------------------------
  // Wasmboy Memory Map
  // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
  // ----------------------------------
  // WasmBoy
  const WASMBOY_MEMORY_LOCATION = 0x000000;
  const WASMBOY_MEMORY_SIZE = 0x8b0000;
  const WASMBOY_WASM_PAGES = WASMBOY_MEMORY_SIZE / 1024 / 64;
  // AssemblyScript
  const ASSEMBLYSCRIPT_MEMORY_LOCATION = 0x000000;
  const ASSEMBLYSCRIPT_MEMORY_SIZE = 0x000400;
  // WasmBoy States
  const WASMBOY_STATE_LOCATION = 0x000400;
  const WASMBOY_STATE_SIZE = 0x000400;
  // Gameboy Internal Memory
  const GAMEBOY_INTERNAL_MEMORY_LOCATION = 0x000800;
  const GAMEBOY_INTERNAL_MEMORY_SIZE = 0x00ffff;
  const VIDEO_RAM_LOCATION = 0x000800;
  const VIDEO_RAM_SIZE = 0x004000;
  const WORK_RAM_LOCATION = 0x004800;
  const WORK_RAM_SIZE = 0x008000;
  const OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION = 0x00c800;
  const OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE = 0x004000;
  // Graphics Output
  const GRAPHICS_OUTPUT_LOCATION = 0x010800;
  const GRAPHICS_OUTPUT_SIZE = 0x07f400;
  const GBC_PALETTE_LOCATION = 0x010800;
  const GBC_PALETTE_SIZE = 0x000200;
  const BG_PRIORITY_MAP_LOCATION = 0x011000;
  const BG_PRIORITY_MAP_SIZE = 0x005c00;
  const FRAME_LOCATION = 0x016c00;
  const FRAME_SIZE = 0x016c00;
  const BACKGROUND_MAP_LOCATION = 0x038c00;
  const BACKGROUND_MAP_SIZE = 0x030000;
  const TILE_DATA_LOCATION = 0x068c00;
  const TILE_DATA_SIZE = 0x024000;
  const OAM_TILES_LOCATION = 0x08cc00;
  const OAM_TILES_SIZE = 0x003000;
  // Audio Output
  const AUDIO_BUFFER_LOCATION = 0x08fc00;
  const AUDIO_BUFFER_SIZE = 0x020000;
  // Catridge Memory
  const CARTRIDGE_RAM_LOCATION = 0x0afc00;
  const CARTRIDGE_RAM_SIZE = 0x020000;
  const CARTRIDGE_ROM_LOCATION = 0x0cfc00;
  const CARTRIDGE_ROM_SIZE = 0x7e0400;

  class Config {
  }
  // Boot Rom
  Config.enableBootRom = false;
  // GBC Preference
  Config.useGbcWhenAvailable = true;
  // Batch Processing
  Config.audioBatchProcessing = false;
  Config.graphicsBatchProcessing = false;
  Config.timersBatchProcessing = false;
  // Scanline Rendering
  Config.graphicsDisableScanlineRendering = false;
  // Acumulate Sound Samples
  Config.audioAccumulateSamples = false;
  // Tile Rednering
  Config.tileRendering = false;
  Config.tileCaching = false;

  // Grouped registers
  // possible overload these later to performace actions
  // AF, BC, DE, HL
  function concatenateBytes(highByte, lowByte) {
      //https://stackoverflow.com/questions/38298412/convert-two-bytes-into-signed-16-bit-integer-in-javascript
      return ((highByte & 0xff) << 8) | (lowByte & 0xff);
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
      return u8Portable((value << 1) | (value >> 7));
  }
  function rotateByteLeftThroughCarry(value) {
      // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
      // Through carry meaning, instead of raotating the bit that gets dropped off, but the carry there instead
      return u8Portable((value << 1) | getCarryFlag$$1());
  }
  function rotateByteRight(value) {
      // Rotate right
      // 4-bit example:
      // 1010 -> 0101 | 0000
      return u8Portable((value >> 1) | (value << 7));
  }
  function rotateByteRightThroughCarry(value) {
      // Example: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
      // Through carry meaning, instead of raotating the bit that gets dropped off, put the carry there instead
      return u8Portable((value >> 1) | (getCarryFlag$$1() << 7));
  }
  function setBitOnByte(bitPosition, byte) {
      return byte | (0x01 << bitPosition);
  }
  function resetBitOnByte(bitPosition, byte) {
      return byte & ~(0x01 << bitPosition);
  }
  function checkBitOnByte(bitPosition, byte) {
      // Perforamnce improvements
      // https://github.com/AssemblyScript/assemblyscript/issues/40
      return (byte & (1 << bitPosition)) != 0;
  }

  // Portable Code for JS Wasm Benchmarking
  function u8Portable(param) {
      return param & 0xff;
  }
  function u16Portable(param) {
      return param & 0xffff;
  }
  function i8Portable(param) {
      // JS ints are all i32, therefore, get the sign bit, and then convert accordingly
      // Example: https://blog.michaelyin.info/convert-8bit-byte-to-signed-int/
      let response = param;
      if (checkBitOnByte(7, response)) {
          response = (256 - param) * -1;
      }
      return response;
  }
  function i32Portable(param) {
      return param | 0;
  }

  // Set flag bit on on register F. For instance set zero flag to zero -> (7, 0)
  function setFlagBit(flagBit, flagValue) {
      let bitwiseOperand = u8Portable(1 << flagBit);
      if (flagValue > 0) {
          Cpu.registerF = Cpu.registerF | bitwiseOperand;
      }
      else {
          // XOR out the two ones
          bitwiseOperand = 0xff ^ bitwiseOperand;
          Cpu.registerF = Cpu.registerF & bitwiseOperand;
      }
      return Cpu.registerF;
  }
  // Overload the set flag bit for ease of use
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
  }
  // Getters for flags
  function getZeroFlag$$1() {
      return (Cpu.registerF >> 7) & 0x01;
  }
  function getSubtractFlag() {
      return (Cpu.registerF >> 6) & 0x01;
  }
  function getHalfCarryFlag() {
      return (Cpu.registerF >> 5) & 0x01;
  }
  function getCarryFlag$$1() {
      return (Cpu.registerF >> 4) & 0x01;
  }
  // Must be run before the register actually performs the add
  // amountToAdd i16, since max number can be an u8
  function checkAndSetEightBitHalfCarryFlag(value, amountToAdd) {
      if (amountToAdd >= 0) {
          // https://robdor.com/2016/08/10/gameboy-emulator-half-carry-flag/
          let result = u8Portable((value & 0x0f) + (amountToAdd & 0x0f)) & 0x10;
          if (result !== 0x00) {
              setHalfCarryFlag(1);
          }
          else {
              setHalfCarryFlag(0);
          }
      }
      else {
          // From: https://github.com/djhworld/gomeboycolor/blob/master/src/cpu/index.go
          // CTRL+F "subBytes(a, b byte)"
          if ((abs(amountToAdd) & 0x0f) > (value & 0x0f)) {
              setHalfCarryFlag(1);
          }
          else {
              setHalfCarryFlag(0);
          }
      }
  }
  function checkAndSetEightBitCarryFlag(value, amountToAdd) {
      if (amountToAdd >= 0) {
          let result = u8Portable(value + amountToAdd);
          if (value > result) {
              setCarryFlag(1);
          }
          else {
              setCarryFlag(0);
          }
      }
      else {
          if (abs(amountToAdd) > value) {
              setCarryFlag(1);
          }
          else {
              setCarryFlag(0);
          }
      }
  }
  // Function to handle 16 bit addition overflow, and set the carry flags accordingly
  // i32 on valueTwo to support passing signed immedaite values
  function checkAndSetSixteenBitFlagsAddOverflow(valueOne, valueTwo, useStackPointerBits) {
      // need to differentiate between HL and SP
      // HL carries are at 11 and 15, SP carries are at 3 and 7 :p
      if (useStackPointerBits) {
          // Logic from : https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
          // CTRL+F add_sp_n
          // using the stack pointer bits means we can safely assume the value is signed
          let signedValueOne = valueOne;
          let result = signedValueOne + valueTwo;
          let flagXor = signedValueOne ^ valueTwo ^ result;
          if ((flagXor & 0x10) !== 0) {
              setHalfCarryFlag(1);
          }
          else {
              setHalfCarryFlag(0);
          }
          if ((flagXor & 0x100) !== 0) {
              setCarryFlag(1);
          }
          else {
              setCarryFlag(0);
          }
      }
      else {
          // Logic from: https://github.com/djhworld/gomeboycolor/blob/master/src/cpu/index.go
          // CTRL+F addWords
          // Value two is not signed
          let result = u16Portable(valueOne + valueTwo);
          // Check the carry flag by allowing the overflow
          if (result < valueOne) {
              setCarryFlag(1);
          }
          else {
              setCarryFlag(0);
          }
          // To check for half carry flag (bit 15), by XOR'ing valyes, and and'ing the bit in question
          let halfCarryXor = valueOne ^ valueTwo ^ result;
          let halfCarryAnd = u16Portable(halfCarryXor & 0x1000);
          if (halfCarryAnd !== 0x00) {
              setHalfCarryFlag(1);
          }
          else {
              setHalfCarryFlag(0);
          }
      }
  }

  // Class for GBC Color palletes
  // http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
  class Palette {
  }
  Palette.memoryLocationBackgroundPaletteIndex = 0xff68;
  Palette.memoryLocationBackgroundPaletteData = 0xff69;
  Palette.memoryLocationSpritePaletteIndex = 0xff6a;
  Palette.memoryLocationSpritePaletteData = 0xff6b;
  function initializePalette() {
      if (Cpu.GBCEnabled) {
          // GBC Palettes
          eightBitStoreIntoGBMemory(0xff68, 0xc0);
          eightBitStoreIntoGBMemory(0xff69, 0xff);
          eightBitStoreIntoGBMemory(0xff6a, 0xc1);
          eightBitStoreIntoGBMemory(0xff6b, 0x0d);
      }
      else {
          // GBC Palettes
          eightBitStoreIntoGBMemory(0xff68, 0xff);
          eightBitStoreIntoGBMemory(0xff69, 0xff);
          eightBitStoreIntoGBMemory(0xff6a, 0xff);
          eightBitStoreIntoGBMemory(0xff6b, 0xff);
      }
  }
  // Simple get pallete color or monochroime GB
  // shouldRepresentColorByColorId is good for debugging tile data for GBC games that don't have
  // monochromePalettes
  function getMonochromeColorFromPalette(colorId, paletteMemoryLocation, shouldRepresentColorByColorId = false) {
      // Shift our paletteByte, 2 times for each color ID
      // And off any extra bytes
      // Return our Color (00 - white, 01 - light grey, 10 Dark grey, or 11 - Black)
      let color = colorId;
      if (!shouldRepresentColorByColorId) {
          color = (eightBitLoadFromGBMemory(paletteMemoryLocation) >> (colorId * 2)) & 0x03;
      }
      // Since our max is 254, and max is 3.
      // monochrome color palette is modified from bgb
      // TODO: Make these colors into a constant
      let rgbColor = 242;
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
  }
  function writeColorPaletteToMemory(offset, value) {
      // FF68
      //  Bit 0-5   Index (00-3F)
      if (offset === Palette.memoryLocationBackgroundPaletteData || offset === Palette.memoryLocationSpritePaletteData) {
          // Get the palette index
          let paletteIndex = eightBitLoadFromGBMemory(offset - 1);
          // Clear the 6th bit, as it does nothing
          paletteIndex = resetBitOnByte(6, paletteIndex);
          // Check if we are changing the sprite pallete data
          let isSprite = false;
          if (offset === Palette.memoryLocationSpritePaletteData) {
              isSprite = true;
          }
          storePaletteByteInWasmMemory(paletteIndex, value, isSprite);
          incrementPaletteIndexIfSet(paletteIndex, offset - 1);
      }
  }
  // Functions to Handle Write to pallete data registers
  // http://gbdev.gg8.se/wiki/articles/Video_Display#FF68_-_BCPS.2FBGPI_-_CGB_Mode_Only_-_Background_Palette_Index
  // Function to handle incrementing the pallete index if required
  function incrementPaletteIndexIfSet(paletteIndex, offset) {
      // Check ther auto increment box
      if (checkBitOnByte(7, paletteIndex)) {
          // Increment the index, and return the value before the increment
          // Ensure we don't ouverflow our auto increment bit
          paletteIndex += 1;
          paletteIndex = setBitOnByte(7, paletteIndex);
          eightBitStoreIntoGBMemory(offset, paletteIndex);
      }
  }
  // FF68
  // Bit 0-5   Index (00-3F)
  // Bit 7     Auto Increment  (0=Disabled, 1=Increment after Writing)
  // Index is 00-0x3F because the means 0 - 63 (64),
  // and apparently there are 8 bytes per pallete to describe Color 0-3 (4 colors),
  // and 0-7 (8 palltetes). Therefore, 64!
  function getRgbColorFromPalette(paletteId, colorId, isSprite) {
      // Each Pallete takes 8 bytes, so multiply by 8 to get the pallete
      // And Each color takes 2 bytes, therefore, multiple by 2 for the correct color bytes in the palette
      let paletteIndex = paletteId * 8 + colorId * 2;
      // Load the Color that is seperated into two bytes
      let paletteHighByte = loadPaletteByteFromWasmMemory(paletteIndex + 1, isSprite);
      let paletteLowByte = loadPaletteByteFromWasmMemory(paletteIndex, isSprite);
      // Return the concatenated color byte
      return concatenateBytes(paletteHighByte, paletteLowByte);
  }
  // Function to return the color from a passed 16 bit color pallette
  function getColorComponentFromRgb(colorId, colorRgb) {
      // Get our bitmask for the color ID
      // bit mask tested good :)
      let bitMask = 0x1f << (colorId * 5);
      let colorValue = (colorRgb & bitMask) >> (colorId * 5);
      // Goal is to reach 254 for each color, so 255 / 31 (0x1F) ~8 TODO: Make exact
      // Want 5 bits for each
      return colorValue * 8;
  }
  // Function to load a byte from our Gbc Palette memory
  function loadPaletteByteFromWasmMemory(paletteIndexByte, isSprite) {
      // Clear the top two bits to just get the bottom palette Index
      let paletteIndex = paletteIndexByte & 0x3f;
      // Move over the palette index to not overlap the background has 0x3F, so Zero for Sprites is 0x40)
      if (isSprite) {
          paletteIndex += 0x40;
      }
      return load(GBC_PALETTE_LOCATION + paletteIndex);
  }
  // Function to store a byte to our Gbc Palette memory
  function storePaletteByteInWasmMemory(paletteIndexByte, value, isSprite) {
      // Clear the top two bits to just get the bottom palette Index
      let paletteIndex = paletteIndexByte & 0x3f;
      // Move over the palette index to not overlap the background (has 0x3F, so Zero for Sprites is 0x40)
      if (isSprite) {
          paletteIndex += 0x40;
      }
      store(GBC_PALETTE_LOCATION + paletteIndex, value);
  }

  // https://github.com/torch2424/wasmBoy/issues/51
  function addPriorityforPixel(x, y, colorId = 0, hasGbcBgPriority = false) {
      let bgPriorityByte = colorId & 0x03;
      if (hasGbcBgPriority) {
          bgPriorityByte = setBitOnByte(2, bgPriorityByte);
      }
      store(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y), bgPriorityByte);
  }
  function getPriorityforPixel(x, y) {
      return load(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y));
  }
  function clearPriorityMap() {
      for (let y = 0; y < 144; y++) {
          for (let x = 0; x < 160; x++) {
              store(BG_PRIORITY_MAP_LOCATION + getPixelStart(x, y), 0);
          }
      }
  }
  function getPixelStart(x, y) {
      // Get the pixel number
      return y * 160 + x;
  }

  // Functions for performance hacks, and debugging tiles
  class TileCache {
  }
  TileCache.tileId = -1;
  TileCache.horizontalFlip = false;
  TileCache.nextXIndexToPerformCacheCheck = -1;
  function resetTileCache() {
      TileCache.tileId = -1;
      TileCache.nextXIndexToPerformCacheCheck = -1;
  }
  function drawPixelsFromLineOfTile(tileId, tileDataMemoryLocation, vramBankId, tileLineXStart, tileLineXEnd, tileLineY, outputLineX, outputLineY, outputWidth, wasmMemoryStart, shouldRepresentMonochromeColorByColorId = false, paletteLocation = 0, bgMapAttributes = -1) {
      // Get our number of pixels drawn
      let pixelsDrawn = 0;
      // Get our tile data address
      let tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileId);
      // Get the bytes for our tile
      let byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + tileLineY * 2, vramBankId);
      let byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + tileLineY * 2 + 1, vramBankId);
      // Loop through our X values to draw
      for (let x = tileLineXStart; x <= tileLineXEnd; x++) {
          // First find where we are going to do our final output x
          // And don't allow any width overflow
          let iteratedOutputX = outputLineX + (x - tileLineXStart);
          if (iteratedOutputX < outputWidth) {
              // However, We need to reverse our byte (if not horizontally flipped),
              // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
              // Therefore, is pixelX was 2, then really is need to be 5
              // So 2 - 7 = -5, * 1 = 5
              // Or to simplify, 7 - 2 = 5 haha!
              let pixelXInTile = x;
              if (bgMapAttributes < 0 || !checkBitOnByte(5, bgMapAttributes)) {
                  pixelXInTile = 7 - pixelXInTile;
              }
              // Get our pallete colors for the tile
              let paletteColorId = 0;
              if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
                  // Byte one represents the second bit in our color id, so bit shift
                  paletteColorId += 1;
                  paletteColorId = paletteColorId << 1;
              }
              if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
                  paletteColorId += 1;
              }
              // Get the pallete
              let red = 0;
              let green = 0;
              let blue = 0;
              // Check if we should draw color or not
              if (bgMapAttributes >= 0) {
                  // Call the helper function to grab the correct color from the palette
                  // Get the palette index byte
                  let bgPalette = bgMapAttributes & 0x07;
                  let rgbColorPalette = getRgbColorFromPalette(bgPalette, paletteColorId, false);
                  // Split off into red green and blue
                  red = getColorComponentFromRgb(0, rgbColorPalette);
                  green = getColorComponentFromRgb(1, rgbColorPalette);
                  blue = getColorComponentFromRgb(2, rgbColorPalette);
              }
              else {
                  if (paletteLocation <= 0) {
                      paletteLocation = Graphics.memoryLocationBackgroundPalette;
                  }
                  let monochromeColor = getMonochromeColorFromPalette(paletteColorId, paletteLocation, shouldRepresentMonochromeColorByColorId);
                  red = monochromeColor;
                  green = monochromeColor;
                  blue = monochromeColor;
              }
              // Finally Lets place a pixel in memory
              // Find where our tile line would start
              let pixelStart = getTilePixelStart(iteratedOutputX, outputLineY, outputWidth);
              store(wasmMemoryStart + pixelStart, red);
              store(wasmMemoryStart + pixelStart + 1, green);
              store(wasmMemoryStart + pixelStart + 2, blue);
              let gbcBgPriority = false;
              if (bgMapAttributes >= 0) {
                  gbcBgPriority = checkBitOnByte(7, bgMapAttributes);
              }
              // Lastly, add the pixel to our background priority map
              // https://github.com/torch2424/wasmBoy/issues/51
              // Bits 0 & 1 will represent the color Id drawn by the BG/Window
              // Bit 2 will represent if the Bg/Window has GBC priority.
              addPriorityforPixel(iteratedOutputX, outputLineY, paletteColorId, gbcBgPriority);
              pixelsDrawn++;
          }
      }
      return pixelsDrawn;
  }
  function getTilePixelStart(outputLineX, outputLineY, outputWidth) {
      // Finally Lets place a pixel in memory
      let pixelStart = outputLineY * outputWidth + outputLineX;
      // Each pixel takes 3 slots, therefore, multiply by 3!
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
          // NOTE: Assemblyscript, Can't cast to i16, need to make negative manually
          let signedTileId = tileIdFromTileMap + 128;
          if (checkBitOnByte(7, tileIdFromTileMap)) {
              signedTileId = tileIdFromTileMap - 128;
          }
          return tileDataMemoryLocation + signedTileId * 16;
      }
      // if the background layout gave us the tileId 0, then the tile data would be between 0x8000-0x800F.
      return tileDataMemoryLocation + tileIdFromTileMap * 16;
  }

  // Functions to help with Handling Duty on Square Channels
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
  }

  // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript
  class Channel1 {
      static updateNRx0(value) {
          Channel1.NRx0SweepPeriod = (value & 0x70) >> 4;
          Channel1.NRx0Negate = checkBitOnByte(3, value);
          Channel1.NRx0SweepShift = value & 0x07;
      }
      static updateNRx1(value) {
          Channel1.NRx1Duty = (value >> 6) & 0x03;
          Channel1.NRx1LengthLoad = value & 0x3f;
          // Also need to set our length counter. Taken from the old, setChannelLengthCounter
          // Channel length is determined by 64 (or 256 if channel 3), - the length load
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
          // Note, this will be different for channel 3
          Channel1.lengthCounter = 64 - Channel1.NRx1LengthLoad;
      }
      static updateNRx2(value) {
          Channel1.NRx2StartingVolume = (value >> 4) & 0x0f;
          Channel1.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
          Channel1.NRx2EnvelopePeriod = value & 0x07;
          // Also, get our channel is dac enabled
          Channel1.isDacEnabled = (value & 0xf8) > 0;
      }
      static updateNRx3(value) {
          Channel1.NRx3FrequencyLSB = value;
          // Update Channel Frequency
          let frequency = (Channel1.NRx4FrequencyMSB << 8) | Channel1.NRx3FrequencyLSB;
          Channel1.frequency = frequency;
      }
      static updateNRx4(value) {
          Channel1.NRx4LengthEnabled = checkBitOnByte(6, value);
          Channel1.NRx4FrequencyMSB = value & 0x07;
          // Update Channel Frequency
          let frequency = (Channel1.NRx4FrequencyMSB << 8) | Channel1.NRx3FrequencyLSB;
          Channel1.frequency = frequency;
      }
      // Function to save the state of the class
      static saveState() {
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel1.saveStateSlot), Channel1.isEnabled);
          store(getSaveStateMemoryOffset(0x01, Channel1.saveStateSlot), Channel1.frequencyTimer);
          store(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot), Channel1.envelopeCounter);
          store(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot), Channel1.lengthCounter);
          store(getSaveStateMemoryOffset(0x0e, Channel1.saveStateSlot), Channel1.volume);
          store(getSaveStateMemoryOffset(0x13, Channel1.saveStateSlot), Channel1.dutyCycle);
          store(getSaveStateMemoryOffset(0x14, Channel1.saveStateSlot), Channel1.waveFormPositionOnDuty);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x19, Channel1.saveStateSlot), Channel1.isSweepEnabled);
          store(getSaveStateMemoryOffset(0x1a, Channel1.saveStateSlot), Channel1.sweepCounter);
          store(getSaveStateMemoryOffset(0x1f, Channel1.saveStateSlot), Channel1.sweepShadowFrequency);
      }
      // Function to load the save state from memory
      static loadState() {
          Channel1.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel1.saveStateSlot));
          Channel1.frequencyTimer = load(getSaveStateMemoryOffset(0x01, Channel1.saveStateSlot));
          Channel1.envelopeCounter = load(getSaveStateMemoryOffset(0x05, Channel1.saveStateSlot));
          Channel1.lengthCounter = load(getSaveStateMemoryOffset(0x09, Channel1.saveStateSlot));
          Channel1.volume = load(getSaveStateMemoryOffset(0x0e, Channel1.saveStateSlot));
          Channel1.dutyCycle = load(getSaveStateMemoryOffset(0x13, Channel1.saveStateSlot));
          Channel1.waveFormPositionOnDuty = load(getSaveStateMemoryOffset(0x14, Channel1.saveStateSlot));
          Channel1.isSweepEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x19, Channel1.saveStateSlot));
          Channel1.sweepCounter = load(getSaveStateMemoryOffset(0x1a, Channel1.saveStateSlot));
          Channel1.sweepShadowFrequency = load(getSaveStateMemoryOffset(0x1f, Channel1.saveStateSlot));
      }
      static initialize() {
          eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx0, 0x80);
          eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx1, 0xbf);
          eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx2, 0xf3);
          eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, 0xc1);
          eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, 0xbf);
      }
      // Function to get a sample using the cycle counter on the channel
      static getSampleFromCycleCounter() {
          let accumulatedCycles = Channel1.cycleCounter;
          Channel1.cycleCounter = 0;
          return Channel1.getSample(accumulatedCycles);
      }
      // Function to reset our timer, useful for GBC double speed mode
      static resetTimer() {
          Channel1.frequencyTimer = (2048 - Channel1.frequency) * 4;
          // TODO: Ensure this is correct for GBC Double Speed Mode
          if (Cpu.GBCDoubleSpeed) {
              Channel1.frequencyTimer = Channel1.frequencyTimer * 2;
          }
      }
      static getSample(numberOfCycles) {
          // Decrement our channel timer
          Channel1.frequencyTimer -= numberOfCycles;
          if (Channel1.frequencyTimer <= 0) {
              // Get the amount that overflowed so we don't drop cycles
              let overflowAmount = abs(Channel1.frequencyTimer);
              // Reset our timer
              // A square channel's frequency timer period is set to (2048-frequency)*4.
              // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
              Channel1.resetTimer();
              Channel1.frequencyTimer -= overflowAmount;
              // Also increment our duty cycle
              // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
              // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
              Channel1.waveFormPositionOnDuty += 1;
              if (Channel1.waveFormPositionOnDuty >= 8) {
                  Channel1.waveFormPositionOnDuty = 0;
              }
          }
          // Get our ourput volume
          let outputVolume = 0;
          // Finally to set our output volume, the channel must be enabled,
          // Our channel DAC must be enabled, and we must be in an active state
          // Of our duty cycle
          if (Channel1.isEnabled && Channel1.isDacEnabled) {
              outputVolume = Channel1.volume;
          }
          else {
              // Return silence
              // Since range from -15 - 15, or 0 to 30 for our unsigned
              return 15;
          }
          // Get the current sampleValue
          let sample = 1;
          if (!isDutyCycleClockPositiveOrNegativeForWaveform(Channel1.NRx1Duty, Channel1.waveFormPositionOnDuty)) {
              sample = sample * -1;
          }
          sample = sample * outputVolume;
          // Square Waves Can range from -15 - 15. Therefore simply add 15
          sample = sample + 15;
          return sample;
      }
      //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
      static trigger() {
          Channel1.isEnabled = true;
          if (Channel1.lengthCounter === 0) {
              Channel1.lengthCounter = 64;
          }
          // Reset our timer
          // A square channel's frequency timer period is set to (2048-frequency)*4.
          // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
          Channel1.resetTimer();
          Channel1.envelopeCounter = Channel1.NRx2EnvelopePeriod;
          Channel1.volume = Channel1.NRx2StartingVolume;
          // Handle Channel Sweep
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
          Channel1.sweepShadowFrequency = Channel1.frequency;
          // Reset back to the sweep period
          Channel1.sweepCounter = Channel1.NRx0SweepPeriod;
          // The internal enabled flag is set if either the sweep period or shift are non-zero, cleared otherwise.
          if (Channel1.NRx0SweepPeriod > 0 && Channel1.NRx0SweepShift > 0) {
              Channel1.isSweepEnabled = true;
          }
          else {
              Channel1.isSweepEnabled = false;
          }
          // If the sweep shift is non-zero, frequency calculation and the overflow check are performed immediately.
          if (Channel1.NRx0SweepShift > 0) {
              calculateSweepAndCheckOverflow();
          }
          // Finally if DAC is off, channel is still disabled
          if (!Channel1.isDacEnabled) {
              Channel1.isEnabled = false;
          }
      }
      // Function to determine if the current channel would update when getting the sample
      // This is used to accumulate samples
      static willChannelUpdate(numberOfCycles) {
          //Increment our cycle counter
          Channel1.cycleCounter += numberOfCycles;
          // Dac enabled status cached by accumulator
          if (Channel1.frequencyTimer - Channel1.cycleCounter > 0) {
              return false;
          }
          return true;
      }
      static updateSweep() {
          // Obscure behavior
          // TODO: The volume envelope and sweep timers treat a period of 0 as 8.
          // Decrement the sweep counter
          Channel1.sweepCounter -= 1;
          if (Channel1.sweepCounter <= 0) {
              // Reset back to the sweep period
              Channel1.sweepCounter = Channel1.NRx0SweepPeriod;
              // Calculate our sweep
              // When it generates a clock and the sweep's internal enabled flag is set and the sweep period is not zero,
              // a new frequency is calculated and the overflow check is performed.
              if (Channel1.isSweepEnabled && Channel1.NRx0SweepPeriod > 0) {
                  calculateSweepAndCheckOverflow();
              }
          }
      }
      static updateLength() {
          if (Channel1.lengthCounter > 0 && Channel1.NRx4LengthEnabled) {
              Channel1.lengthCounter -= 1;
          }
          if (Channel1.lengthCounter === 0) {
              Channel1.isEnabled = false;
          }
      }
      static updateEnvelope() {
          // Obscure behavior
          // TODO: The volume envelope and sweep timers treat a period of 0 as 8.
          Channel1.envelopeCounter -= 1;
          if (Channel1.envelopeCounter <= 0) {
              Channel1.envelopeCounter = Channel1.NRx2EnvelopePeriod;
              // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
              // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
              // If notes are sustained for too long, this is probably why
              if (Channel1.envelopeCounter !== 0) {
                  if (Channel1.NRx2EnvelopeAddMode && Channel1.volume < 15) {
                      Channel1.volume += 1;
                  }
                  else if (!Channel1.NRx2EnvelopeAddMode && Channel1.volume > 0) {
                      Channel1.volume -= 1;
                  }
              }
          }
      }
      static setFrequency(frequency) {
          // Get the high and low bits
          let passedFrequencyHighBits = frequency >> 8;
          let passedFrequencyLowBits = frequency & 0xff;
          // Get the new register 4
          let register4 = eightBitLoadFromGBMemory(Channel1.memoryLocationNRx4);
          // Knock off lower 3 bits, and Or on our high bits
          let newRegister4 = register4 & 0xf8;
          newRegister4 = newRegister4 | passedFrequencyHighBits;
          // Set the registers
          eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx3, passedFrequencyLowBits);
          eightBitStoreIntoGBMemory(Channel1.memoryLocationNRx4, newRegister4);
          // Save the frequency for ourselves without triggering memory traps
          Channel1.NRx3FrequencyLSB = passedFrequencyLowBits;
          Channel1.NRx4FrequencyMSB = passedFrequencyHighBits;
          Channel1.frequency = (Channel1.NRx4FrequencyMSB << 8) | Channel1.NRx3FrequencyLSB;
      }
  }
  // Cycle Counter for our sound accumulator
  Channel1.cycleCounter = 0;
  // Squarewave channel with volume envelope and frequency sweep functions.
  // NR10 -> Sweep Register R/W
  Channel1.memoryLocationNRx0 = 0xff10;
  // -PPP NSSS Sweep period, negate, shift
  Channel1.NRx0SweepPeriod = 0;
  Channel1.NRx0Negate = false;
  Channel1.NRx0SweepShift = 0;
  // NR11 -> Sound length/Wave pattern duty (R/W)
  Channel1.memoryLocationNRx1 = 0xff11;
  // DDLL LLLL Duty, Length load (64-L)
  Channel1.NRx1Duty = 0;
  Channel1.NRx1LengthLoad = 0;
  // NR12 -> Volume Envelope (R/W)
  Channel1.memoryLocationNRx2 = 0xff12;
  // VVVV APPP Starting volume, Envelope add mode, period
  Channel1.NRx2StartingVolume = 0;
  Channel1.NRx2EnvelopeAddMode = false;
  Channel1.NRx2EnvelopePeriod = 0;
  // NR13 -> Frequency lo (W)
  Channel1.memoryLocationNRx3 = 0xff13;
  // FFFF FFFF Frequency LSB
  Channel1.NRx3FrequencyLSB = 0;
  // NR14 -> Frequency hi (R/W)
  Channel1.memoryLocationNRx4 = 0xff14;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  Channel1.NRx4LengthEnabled = false;
  Channel1.NRx4FrequencyMSB = 0;
  // Channel Properties
  Channel1.channelNumber = 1;
  Channel1.isEnabled = false;
  Channel1.isDacEnabled = false;
  Channel1.frequency = 0;
  Channel1.frequencyTimer = 0x00;
  Channel1.envelopeCounter = 0x00;
  Channel1.lengthCounter = 0x00;
  Channel1.volume = 0x00;
  // Square Wave properties
  Channel1.dutyCycle = 0x00;
  Channel1.waveFormPositionOnDuty = 0x00;
  // Channel 1 Sweep
  Channel1.isSweepEnabled = false;
  Channel1.sweepCounter = 0x00;
  Channel1.sweepShadowFrequency = 0x00;
  // Save States
  Channel1.saveStateSlot = 7;
  // Sweep Specific functions
  function calculateSweepAndCheckOverflow() {
      let newFrequency = getNewFrequencyFromSweep();
      // 7FF is the highest value of the frequency: 111 1111 1111
      if (newFrequency <= 0x7ff && Channel1.NRx0SweepShift > 0) {
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware
          // If the new frequency is 2047 or less and the sweep shift is not zero,
          // this new frequency is written back to the shadow frequency and square 1's frequency in NR13 and NR14,
          // then frequency calculation and overflow check are run AGAIN immediately using this new value,
          // but this second new frequency is not written back.
          Channel1.sweepShadowFrequency = newFrequency;
          Channel1.setFrequency(newFrequency);
          // Re calculate the new frequency
          newFrequency = getNewFrequencyFromSweep();
      }
      // Next check if the new Frequency is above 0x7FF
      // if So, disable our sweep
      if (newFrequency > 0x7ff) {
          Channel1.isEnabled = false;
      }
  }
  // Function to determing a new sweep in the current context
  function getNewFrequencyFromSweep() {
      // Start our new frequency, by making it equal to the "shadow frequency"
      let newFrequency = Channel1.sweepShadowFrequency;
      newFrequency = newFrequency >> Channel1.NRx0SweepShift;
      // Check for sweep negation
      if (Channel1.NRx0Negate) {
          newFrequency = Channel1.sweepShadowFrequency - newFrequency;
      }
      else {
          newFrequency = Channel1.sweepShadowFrequency + newFrequency;
      }
      return newFrequency;
  }

  // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript
  class Channel2 {
      static updateNRx1(value) {
          Channel2.NRx1Duty = (value >> 6) & 0x03;
          Channel2.NRx1LengthLoad = value & 0x3f;
          // Also need to set our length counter. Taken from the old, setChannelLengthCounter
          // Channel length is determined by 64 (or 256 if channel 3), - the length load
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
          // Note, this will be different for channel 3
          Channel2.lengthCounter = 64 - Channel2.NRx1LengthLoad;
      }
      static updateNRx2(value) {
          Channel2.NRx2StartingVolume = (value >> 4) & 0x0f;
          Channel2.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
          Channel2.NRx2EnvelopePeriod = value & 0x07;
          // Also, get our channel is dac enabled
          Channel2.isDacEnabled = (value & 0xf8) > 0;
      }
      static updateNRx3(value) {
          Channel2.NRx3FrequencyLSB = value;
          // Update Channel Frequency
          let frequency = (Channel2.NRx4FrequencyMSB << 8) | Channel2.NRx3FrequencyLSB;
          Channel2.frequency = frequency;
      }
      static updateNRx4(value) {
          Channel2.NRx4LengthEnabled = checkBitOnByte(6, value);
          Channel2.NRx4FrequencyMSB = value & 0x07;
          // Update Channel Frequency
          let frequency = (Channel2.NRx4FrequencyMSB << 8) | Channel2.NRx3FrequencyLSB;
          Channel2.frequency = frequency;
      }
      // Function to save the state of the class
      static saveState() {
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel2.saveStateSlot), Channel2.isEnabled);
          store(getSaveStateMemoryOffset(0x01, Channel2.saveStateSlot), Channel2.frequencyTimer);
          store(getSaveStateMemoryOffset(0x05, Channel2.saveStateSlot), Channel2.envelopeCounter);
          store(getSaveStateMemoryOffset(0x09, Channel2.saveStateSlot), Channel2.lengthCounter);
          store(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot), Channel2.volume);
          store(getSaveStateMemoryOffset(0x13, Channel2.saveStateSlot), Channel2.dutyCycle);
          store(getSaveStateMemoryOffset(0x14, Channel2.saveStateSlot), Channel2.waveFormPositionOnDuty);
      }
      // Function to load the save state from memory
      static loadState() {
          Channel2.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel2.saveStateSlot));
          Channel2.frequencyTimer = load(getSaveStateMemoryOffset(0x01, Channel2.saveStateSlot));
          Channel2.envelopeCounter = load(getSaveStateMemoryOffset(0x05, Channel2.saveStateSlot));
          Channel2.lengthCounter = load(getSaveStateMemoryOffset(0x09, Channel2.saveStateSlot));
          Channel2.volume = load(getSaveStateMemoryOffset(0x0e, Channel2.saveStateSlot));
          Channel2.dutyCycle = load(getSaveStateMemoryOffset(0x13, Channel2.saveStateSlot));
          Channel2.waveFormPositionOnDuty = load(getSaveStateMemoryOffset(0x14, Channel2.saveStateSlot));
      }
      static initialize() {
          eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1 - 1, 0xff);
          eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx1, 0x3f);
          eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx2, 0x00);
          eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, 0x00);
          eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, 0xb8);
      }
      // Function to get a sample using the cycle counter on the channel
      static getSampleFromCycleCounter() {
          let accumulatedCycles = Channel2.cycleCounter;
          Channel2.cycleCounter = 0;
          return Channel2.getSample(accumulatedCycles);
      }
      // Function to reset our timer, useful for GBC double speed mode
      static resetTimer() {
          Channel2.frequencyTimer = (2048 - Channel2.frequency) * 4;
          // TODO: Ensure this is correct for GBC Double Speed Mode
          if (Cpu.GBCDoubleSpeed) {
              Channel2.frequencyTimer = Channel2.frequencyTimer * 2;
          }
      }
      static getSample(numberOfCycles) {
          // Decrement our channel timer
          Channel2.frequencyTimer -= numberOfCycles;
          if (Channel2.frequencyTimer <= 0) {
              // Get the amount that overflowed so we don't drop cycles
              let overflowAmount = abs(Channel2.frequencyTimer);
              // Reset our timer
              // A square channel's frequency timer period is set to (2048-frequency)*4.
              // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
              Channel2.resetTimer();
              Channel2.frequencyTimer -= overflowAmount;
              // Also increment our duty cycle
              // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
              // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
              Channel2.waveFormPositionOnDuty += 1;
              if (Channel2.waveFormPositionOnDuty >= 8) {
                  Channel2.waveFormPositionOnDuty = 0;
              }
          }
          // Get our ourput volume
          let outputVolume = 0;
          // Finally to set our output volume, the channel must be enabled,
          // Our channel DAC must be enabled, and we must be in an active state
          // Of our duty cycle
          if (Channel2.isEnabled && Channel2.isDacEnabled) {
              outputVolume = Channel2.volume;
          }
          else {
              // Return silence
              // Since range from -15 - 15, or 0 to 30 for our unsigned
              return 15;
          }
          // Get the current sampleValue
          let sample = 1;
          if (!isDutyCycleClockPositiveOrNegativeForWaveform(Channel2.NRx1Duty, Channel2.waveFormPositionOnDuty)) {
              sample = sample * -1;
          }
          sample = sample * outputVolume;
          // Square Waves Can range from -15 - 15. Therefore simply add 15
          sample = sample + 15;
          return sample;
      }
      //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
      static trigger() {
          Channel2.isEnabled = true;
          if (Channel2.lengthCounter === 0) {
              Channel2.lengthCounter = 64;
          }
          // Reset our timer
          // A square channel's frequency timer period is set to (2048-frequency)*4.
          // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
          Channel2.resetTimer();
          Channel2.envelopeCounter = Channel2.NRx2EnvelopePeriod;
          Channel2.volume = Channel2.NRx2StartingVolume;
          // Finally if DAC is off, channel is still disabled
          if (!Channel2.isDacEnabled) {
              Channel2.isEnabled = false;
          }
      }
      // Function to determine if the current channel would update when getting the sample
      // This is used to accumulate samples
      static willChannelUpdate(numberOfCycles) {
          //Increment our cycle counter
          Channel2.cycleCounter += numberOfCycles;
          // Dac enabled status cached by accumulator
          if (Channel2.frequencyTimer - Channel2.cycleCounter > 0) {
              return false;
          }
          return true;
      }
      static updateLength() {
          if (Channel2.lengthCounter > 0 && Channel2.NRx4LengthEnabled) {
              Channel2.lengthCounter -= 1;
          }
          if (Channel2.lengthCounter === 0) {
              Channel2.isEnabled = false;
          }
      }
      static updateEnvelope() {
          // Obscure behavior
          // TODO: The volume envelope and sweep timers treat a period of 0 as 8.
          Channel2.envelopeCounter -= 1;
          if (Channel2.envelopeCounter <= 0) {
              Channel2.envelopeCounter = Channel2.NRx2EnvelopePeriod;
              // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
              // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
              if (Channel2.envelopeCounter !== 0) {
                  if (Channel2.NRx2EnvelopeAddMode && Channel2.volume < 15) {
                      Channel2.volume += 1;
                  }
                  else if (!Channel2.NRx2EnvelopeAddMode && Channel2.volume > 0) {
                      Channel2.volume -= 1;
                  }
              }
          }
      }
      static setFrequency(frequency) {
          // Get the high and low bits
          let passedFrequencyHighBits = frequency >> 8;
          let passedFrequencyLowBits = frequency & 0xff;
          // Get the new register 4
          let register4 = eightBitLoadFromGBMemory(Channel2.memoryLocationNRx4);
          // Knock off lower 3 bits, and Or on our high bits
          let newRegister4 = register4 & 0xf8;
          newRegister4 = newRegister4 | passedFrequencyHighBits;
          // Set the registers
          eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx3, passedFrequencyLowBits);
          eightBitStoreIntoGBMemory(Channel2.memoryLocationNRx4, newRegister4);
          // Save the frequency for ourselves without triggering memory traps
          Channel2.NRx3FrequencyLSB = passedFrequencyLowBits;
          Channel2.NRx4FrequencyMSB = passedFrequencyHighBits;
          Channel2.frequency = (Channel2.NRx4FrequencyMSB << 8) | Channel2.NRx3FrequencyLSB;
      }
  }
  // Cycle Counter for our sound accumulator
  Channel2.cycleCounter = 0;
  // Squarewave channel with volume envelope functions only.
  // NR21 -> Sound length/Wave pattern duty (R/W)
  Channel2.memoryLocationNRx1 = 0xff16;
  // DDLL LLLL Duty, Length load (64-L)
  Channel2.NRx1Duty = 0;
  Channel2.NRx1LengthLoad = 0;
  // NR22 -> Volume Envelope (R/W)
  Channel2.memoryLocationNRx2 = 0xff17;
  // VVVV APPP Starting volume, Envelope add mode, period
  Channel2.NRx2StartingVolume = 0;
  Channel2.NRx2EnvelopeAddMode = false;
  Channel2.NRx2EnvelopePeriod = 0;
  // NR23 -> Frequency lo (W)
  Channel2.memoryLocationNRx3 = 0xff18;
  // FFFF FFFF Frequency LSB
  Channel2.NRx3FrequencyLSB = 0;
  // NR24 -> Frequency hi (R/W)
  Channel2.memoryLocationNRx4 = 0xff19;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  Channel2.NRx4LengthEnabled = false;
  Channel2.NRx4FrequencyMSB = 0;
  // Channel Properties
  Channel2.channelNumber = 2;
  Channel2.isEnabled = false;
  Channel2.isDacEnabled = false;
  Channel2.frequency = 0;
  Channel2.frequencyTimer = 0x00;
  Channel2.envelopeCounter = 0x00;
  Channel2.lengthCounter = 0x00;
  Channel2.volume = 0x00;
  // Square Wave properties
  Channel2.dutyCycle = 0x00;
  Channel2.waveFormPositionOnDuty = 0x00;
  // Save States
  Channel2.saveStateSlot = 8;

  // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript
  class Channel3 {
      // E--- ---- DAC power
      static updateNRx0(value) {
          Channel3.isDacEnabled = checkBitOnByte(7, value);
      }
      static updateNRx1(value) {
          Channel3.NRx1LengthLoad = value;
          // Also need to set our length counter. Taken from the old, setChannelLengthCounter
          // Channel length is determined by 64 (or 256 if channel 3), - the length load
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
          // Note, this will be different for channel 3
          // Supposed to be 256, so subtracting 255 and then adding 1 if that makes sense
          Channel3.lengthCounter = 256 - Channel3.NRx1LengthLoad;
      }
      static updateNRx2(value) {
          Channel3.NRx2VolumeCode = (value >> 5) & 0x0f;
      }
      static updateNRx3(value) {
          Channel3.NRx3FrequencyLSB = value;
          // Update Channel Frequency
          let frequency = (Channel3.NRx4FrequencyMSB << 8) | Channel3.NRx3FrequencyLSB;
          Channel3.frequency = frequency;
      }
      static updateNRx4(value) {
          Channel3.NRx4LengthEnabled = checkBitOnByte(6, value);
          Channel3.NRx4FrequencyMSB = value & 0x07;
          // Update Channel Frequency
          let frequency = (Channel3.NRx4FrequencyMSB << 8) | Channel3.NRx3FrequencyLSB;
          Channel3.frequency = frequency;
      }
      // Function to save the state of the class
      static saveState() {
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot), Channel3.isEnabled);
          store(getSaveStateMemoryOffset(0x01, Channel3.saveStateSlot), Channel3.frequencyTimer);
          store(getSaveStateMemoryOffset(0x05, Channel3.saveStateSlot), Channel3.lengthCounter);
          store(getSaveStateMemoryOffset(0x09, Channel3.saveStateSlot), Channel3.waveTablePosition);
      }
      // Function to load the save state from memory
      static loadState() {
          Channel3.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel3.saveStateSlot));
          Channel3.frequencyTimer = load(getSaveStateMemoryOffset(0x01, Channel3.saveStateSlot));
          Channel3.lengthCounter = load(getSaveStateMemoryOffset(0x05, Channel3.saveStateSlot));
          Channel3.waveTablePosition = load(getSaveStateMemoryOffset(0x09, Channel3.saveStateSlot));
      }
      static initialize() {
          eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx0, 0x7f);
          eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx1, 0xff);
          eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx2, 0x9f);
          eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx3, 0x00);
          eightBitStoreIntoGBMemory(Channel3.memoryLocationNRx4, 0xb8);
          // The volume code changed
          Channel3.volumeCodeChanged = true;
      }
      // Function to get a sample using the cycle counter on the channel
      static getSampleFromCycleCounter() {
          let accumulatedCycles = Channel3.cycleCounter;
          Channel3.cycleCounter = 0;
          return Channel3.getSample(accumulatedCycles);
      }
      // Function to reset our timer, useful for GBC double speed mode
      static resetTimer() {
          Channel3.frequencyTimer = (2048 - Channel3.frequency) * 2;
          // TODO: Ensure this is correct for GBC Double Speed Mode
          if (Cpu.GBCDoubleSpeed) {
              Channel3.frequencyTimer = Channel3.frequencyTimer * 2;
          }
      }
      static getSample(numberOfCycles) {
          // Decrement our channel timer
          Channel3.frequencyTimer -= numberOfCycles;
          if (Channel3.frequencyTimer <= 0) {
              // Get the amount that overflowed so we don't drop cycles
              let overflowAmount = abs(Channel3.frequencyTimer);
              // Reset our timer
              // A wave channel's frequency timer period is set to (2048-frequency) * 2.
              // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
              Channel3.resetTimer();
              Channel3.frequencyTimer -= overflowAmount;
              // Advance the wave table position, and loop back if needed
              Channel3.waveTablePosition += 1;
              if (Channel3.waveTablePosition >= 32) {
                  Channel3.waveTablePosition = 0;
              }
          }
          // Get our ourput volume
          let outputVolume = 0;
          let volumeCode = Channel3.volumeCode;
          // Finally to set our output volume, the channel must be enabled,
          // Our channel DAC must be enabled, and we must be in an active state
          // Of our duty cycle
          if (Channel3.isEnabled && Channel3.isDacEnabled) {
              // Get our volume code
              if (Channel3.volumeCodeChanged) {
                  volumeCode = eightBitLoadFromGBMemory(Channel3.memoryLocationNRx2);
                  volumeCode = volumeCode >> 5;
                  volumeCode = volumeCode & 0x0f;
                  Channel3.volumeCode = volumeCode;
                  Channel3.volumeCodeChanged = false;
              }
          }
          else {
              // Return silence
              // Since range from -15 - 15, or 0 to 30 for our unsigned
              return 15;
          }
          // Get the current sample
          let sample = 0;
          // Will Find the position, and knock off any remainder
          let positionIndexToAdd = Channel3.waveTablePosition / 2;
          let memoryLocationWaveSample = Channel3.memoryLocationWaveTable + positionIndexToAdd;
          sample = eightBitLoadFromGBMemory(memoryLocationWaveSample);
          // Need to grab the top or lower half for the correct sample
          if (Channel3.waveTablePosition % 2 === 0) {
              // First sample
              sample = sample >> 4;
              sample = sample & 0x0f;
          }
          else {
              // Second Samples
              sample = sample & 0x0f;
          }
          // Shift our sample and set our volume depending on the volume code
          // Since we can't multiply by float, simply divide by 4, 2, 1
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Wave_Channel
          switch (volumeCode) {
              case 0:
                  sample = sample >> 4;
                  break;
              case 1:
                  // Dont Shift sample
                  outputVolume = 1;
                  break;
              case 2:
                  sample = sample >> 1;
                  outputVolume = 2;
                  break;
              default:
                  sample = sample >> 2;
                  outputVolume = 4;
                  break;
          }
          // Spply out output volume
          if (outputVolume > 0) {
              sample = sample / outputVolume;
          }
          else {
              sample = 0;
          }
          // Square Waves Can range from -15 - 15. Therefore simply add 15
          sample = sample + 15;
          return sample;
      }
      //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
      static trigger() {
          Channel3.isEnabled = true;
          if (Channel3.lengthCounter === 0) {
              Channel3.lengthCounter = 256;
          }
          // Reset our timer
          // A wave channel's frequency timer period is set to (2048-frequency)*2.
          Channel3.resetTimer();
          // Reset our wave table position
          Channel3.waveTablePosition = 0;
          // Finally if DAC is off, channel is still disabled
          if (!Channel3.isDacEnabled) {
              Channel3.isEnabled = false;
          }
      }
      // Function to determine if the current channel would update when getting the sample
      // This is used to accumulate samples
      static willChannelUpdate(numberOfCycles) {
          //Increment our cycle counter
          Channel3.cycleCounter += numberOfCycles;
          // Dac enabled status cached by accumulator
          if (Channel3.frequencyTimer - Channel3.cycleCounter > 0 && !Channel3.volumeCodeChanged) {
              return false;
          }
          return true;
      }
      static updateLength() {
          if (Channel3.lengthCounter > 0 && Channel3.NRx4LengthEnabled) {
              Channel3.lengthCounter -= 1;
          }
          if (Channel3.lengthCounter === 0) {
              Channel3.isEnabled = false;
          }
      }
  }
  // Cycle Counter for our sound accumulator
  Channel3.cycleCounter = 0;
  // Voluntary Wave channel with 32 4-bit programmable samples, played in sequence.
  // NR30 -> Sound on/off (R/W)
  Channel3.memoryLocationNRx0 = 0xff1a;
  // NR31 -> Sound length (R/W)
  Channel3.memoryLocationNRx1 = 0xff1b;
  // LLLL LLLL Length load (256-L)
  Channel3.NRx1LengthLoad = 0;
  // NR32 -> Select ouput level (R/W)
  Channel3.memoryLocationNRx2 = 0xff1c;
  // -VV- ---- Volume code (00=0%, 01=100%, 10=50%, 11=25%)
  Channel3.NRx2VolumeCode = 0;
  // NR33 -> Frequency lower data (W)
  Channel3.memoryLocationNRx3 = 0xff1d;
  // FFFF FFFF Frequency LSB
  Channel3.NRx3FrequencyLSB = 0;
  // NR34 -> Frequency higher data (R/W)
  Channel3.memoryLocationNRx4 = 0xff1e;
  // TL-- -FFF Trigger, Length enable, Frequency MSB
  Channel3.NRx4LengthEnabled = false;
  Channel3.NRx4FrequencyMSB = 0;
  // Our wave table location
  Channel3.memoryLocationWaveTable = 0xff30;
  // Channel Properties
  Channel3.channelNumber = 3;
  Channel3.isEnabled = false;
  Channel3.isDacEnabled = false;
  Channel3.frequency = 0;
  Channel3.frequencyTimer = 0x00;
  Channel3.lengthCounter = 0x00;
  Channel3.waveTablePosition = 0x00;
  Channel3.volumeCode = 0x00;
  Channel3.volumeCodeChanged = false;
  // Save States
  Channel3.saveStateSlot = 9;

  // NOTE: Tons of Copy-pasta btween channels, because Classes cannot be instantiated yet in assemblyscript
  class Channel4 {
      static updateNRx1(value) {
          Channel4.NRx1LengthLoad = value & 0x3f;
          // Also need to set our length counter. Taken from the old, setChannelLengthCounter
          // Channel length is determined by 64 (or 256 if channel 3), - the length load
          // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
          // Note, this will be different for channel 3
          Channel4.lengthCounter = 64 - Channel4.NRx1LengthLoad;
      }
      static updateNRx2(value) {
          Channel4.NRx2StartingVolume = (value >> 4) & 0x0f;
          Channel4.NRx2EnvelopeAddMode = checkBitOnByte(3, value);
          Channel4.NRx2EnvelopePeriod = value & 0x07;
          // Also, get our channel is dac enabled
          Channel4.isDacEnabled = (value & 0xf8) > 0;
      }
      static updateNRx3(value) {
          Channel4.NRx3ClockShift = value >> 4;
          Channel4.NRx3WidthMode = checkBitOnByte(3, value);
          Channel4.NRx3DivisorCode = value & 0x07;
          // Also, get our divisor
          switch (Channel4.NRx3DivisorCode) {
              case 0:
                  Channel4.divisor = 8;
                  return;
              case 1:
                  Channel4.divisor = 16;
                  return;
              case 2:
                  Channel4.divisor = 32;
                  return;
              case 3:
                  Channel4.divisor = 48;
                  return;
              case 4:
                  Channel4.divisor = 64;
                  return;
              case 5:
                  Channel4.divisor = 80;
                  return;
              case 6:
                  Channel4.divisor = 96;
                  return;
              case 7:
                  Channel4.divisor = 112;
                  return;
          }
      }
      static updateNRx4(value) {
          Channel4.NRx4LengthEnabled = checkBitOnByte(6, value);
      }
      // Function to save the state of the class
      static saveState() {
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot), Channel4.isEnabled);
          store(getSaveStateMemoryOffset(0x01, Channel4.saveStateSlot), Channel4.frequencyTimer);
          store(getSaveStateMemoryOffset(0x05, Channel4.saveStateSlot), Channel4.envelopeCounter);
          store(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot), Channel4.lengthCounter);
          store(getSaveStateMemoryOffset(0x0e, Channel4.saveStateSlot), Channel4.volume);
          store(getSaveStateMemoryOffset(0x13, Channel4.saveStateSlot), Channel4.linearFeedbackShiftRegister);
      }
      // Function to load the save state from memory
      static loadState() {
          Channel4.isEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Channel4.saveStateSlot));
          Channel4.frequencyTimer = load(getSaveStateMemoryOffset(0x01, Channel4.saveStateSlot));
          Channel4.envelopeCounter = load(getSaveStateMemoryOffset(0x05, Channel4.saveStateSlot));
          Channel4.lengthCounter = load(getSaveStateMemoryOffset(0x09, Channel4.saveStateSlot));
          Channel4.volume = load(getSaveStateMemoryOffset(0x0e, Channel4.saveStateSlot));
          Channel4.linearFeedbackShiftRegister = load(getSaveStateMemoryOffset(0x13, Channel4.saveStateSlot));
      }
      static initialize() {
          eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1 - 1, 0xff);
          eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx1, 0xff);
          eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx2, 0x00);
          eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx3, 0x00);
          eightBitStoreIntoGBMemory(Channel4.memoryLocationNRx4, 0xbf);
      }
      // Function to get a sample using the cycle counter on the channel
      static getSampleFromCycleCounter() {
          let accumulatedCycles = Channel4.cycleCounter;
          Channel4.cycleCounter = 0;
          return Channel4.getSample(accumulatedCycles);
      }
      static getSample(numberOfCycles) {
          // Decrement our channel timer
          Channel4.frequencyTimer -= numberOfCycles;
          if (Channel4.frequencyTimer <= 0) {
              // Get the amount that overflowed so we don't drop cycles
              let overflowAmount = abs(Channel4.frequencyTimer);
              // Reset our timer
              Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();
              Channel4.frequencyTimer -= overflowAmount;
              // Do some cool stuff with lfsr
              // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Noise_Channel
              // First XOR bit zero and one
              let lfsrBitZero = Channel4.linearFeedbackShiftRegister & 0x01;
              let lfsrBitOne = Channel4.linearFeedbackShiftRegister >> 1;
              lfsrBitOne = lfsrBitOne & 0x01;
              let xorLfsrBitZeroOne = lfsrBitZero ^ lfsrBitOne;
              // Shift all lsfr bits by one
              Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister >> 1;
              // Place the XOR result on bit 15
              Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 14);
              // If the width mode is set, set xor on bit 6, and make lfsr 7 bit
              if (Channel4.NRx3WidthMode) {
                  // Make 7 bit, by knocking off lower bits. Want to keeps bits 8 - 16, and then or on 7
                  Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister & ~0x40;
                  Channel4.linearFeedbackShiftRegister = Channel4.linearFeedbackShiftRegister | (xorLfsrBitZeroOne << 6);
              }
          }
          // Get our ourput volume, set to zero for silence
          let outputVolume = 0;
          // Finally to set our output volume, the channel must be enabled,
          // Our channel DAC must be enabled, and we must be in an active state
          // Of our duty cycle
          if (Channel4.isEnabled && Channel4.isDacEnabled) {
              outputVolume = Channel4.volume;
          }
          else {
              // Return silence
              // Since range from -15 - 15, or 0 to 30 for our unsigned
              return 15;
          }
          // Declare our sample
          let sample = 0;
          // Wave form output is bit zero of lfsr, INVERTED
          if (!checkBitOnByte(0, Channel4.linearFeedbackShiftRegister)) {
              sample = 1;
          }
          else {
              sample = -1;
          }
          sample = sample * outputVolume;
          // Noise Can range from -15 - 15. Therefore simply add 15
          sample = sample + 15;
          return sample;
      }
      //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event
      static trigger() {
          Channel4.isEnabled = true;
          if (Channel4.lengthCounter === 0) {
              Channel4.lengthCounter = 64;
          }
          // Reset our timers
          Channel4.frequencyTimer = Channel4.getNoiseChannelFrequencyPeriod();
          Channel4.envelopeCounter = Channel4.NRx2EnvelopePeriod;
          Channel4.volume = Channel4.NRx2StartingVolume;
          // Noise channel's LFSR bits are all set to 1.
          Channel4.linearFeedbackShiftRegister = 0x7fff;
          // Finally if DAC is off, channel is still disabled
          if (!Channel4.isDacEnabled) {
              Channel4.isEnabled = false;
          }
      }
      // Function to determine if the current channel would update when getting the sample
      // This is used to accumulate samples
      static willChannelUpdate(numberOfCycles) {
          //Increment our cycle counter
          Channel4.cycleCounter += numberOfCycles;
          // Dac enabled status cached by accumulator
          if (Channel4.frequencyTimer - Channel4.cycleCounter > 0) {
              return false;
          }
          return true;
      }
      static getNoiseChannelFrequencyPeriod() {
          // Get our divisor from the divisor code, and shift by the clock shift
          let response = Channel4.divisor << Channel4.NRx3ClockShift;
          if (Cpu.GBCDoubleSpeed) {
              response = response * 2;
          }
          return response;
      }
      static updateLength() {
          if (Channel4.lengthCounter > 0 && Channel4.NRx4LengthEnabled) {
              Channel4.lengthCounter -= 1;
          }
          if (Channel4.lengthCounter === 0) {
              Channel4.isEnabled = false;
          }
      }
      static updateEnvelope() {
          // Obscure behavior
          // TODO: The volume envelope and sweep timers treat a period of 0 as 8.
          Channel4.envelopeCounter -= 1;
          if (Channel4.envelopeCounter <= 0) {
              Channel4.envelopeCounter = Channel4.NRx2EnvelopePeriod;
              // When the timer generates a clock and the envelope period is NOT zero, a new volume is calculated
              // NOTE: There is some weiirrdd obscure behavior where zero can equal 8, so watch out for that
              if (Channel4.envelopeCounter !== 0) {
                  if (Channel4.NRx2EnvelopeAddMode && Channel4.volume < 15) {
                      Channel4.volume += 1;
                  }
                  else if (!Channel4.NRx2EnvelopeAddMode && Channel4.volume > 0) {
                      Channel4.volume -= 1;
                  }
              }
          }
      }
  }
  // Cycle Counter for our sound accumulator
  Channel4.cycleCounter = 0;
  // Channel 4
  // 'white noise' channel with volume envelope functions.
  // NR41 -> Sound length (R/W)
  Channel4.memoryLocationNRx1 = 0xff20;
  // --LL LLLL Length load (64-L)
  Channel4.NRx1LengthLoad = 0;
  // NR42 -> Volume Envelope (R/W)
  Channel4.memoryLocationNRx2 = 0xff21;
  // VVVV APPP Starting volume, Envelope add mode, period
  Channel4.NRx2StartingVolume = 0;
  Channel4.NRx2EnvelopeAddMode = false;
  Channel4.NRx2EnvelopePeriod = 0;
  // NR43 -> Polynomial Counter (R/W)
  Channel4.memoryLocationNRx3 = 0xff22;
  // SSSS WDDD Clock shift, Width mode of LFSR, Divisor code
  Channel4.NRx3ClockShift = 0;
  Channel4.NRx3WidthMode = false;
  Channel4.NRx3DivisorCode = 0;
  // NR44 -> Trigger, Length Enable
  Channel4.memoryLocationNRx4 = 0xff23;
  // TL-- ---- Trigger, Length enable
  Channel4.NRx4LengthEnabled = false;
  // Channel Properties
  Channel4.channelNumber = 4;
  Channel4.isEnabled = false;
  Channel4.isDacEnabled = false;
  Channel4.frequencyTimer = 0x00;
  Channel4.envelopeCounter = 0x00;
  Channel4.lengthCounter = 0x00;
  Channel4.volume = 0x00;
  Channel4.divisor = 0;
  // Noise properties
  // NOTE: Is only 15 bits
  Channel4.linearFeedbackShiftRegister = 0x00;
  // Save States
  Channel4.saveStateSlot = 10;

  // Another class simply for accumulating samples
  // Default everything to silence
  class SoundAccumulator {
  }
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
  SoundAccumulator.mixerEnabledChanged = false;
  //If a channel was updated, need to also track if we need to need to mix them again
  SoundAccumulator.needToRemixSamples = false;
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
  }
  function accumulateSound(numberOfCycles) {
      // Check if any of the individual channels will update
      let channel1WillUpdate = Channel1.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel1.channelNumber);
      let channel2WillUpdate = Channel2.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel2.channelNumber);
      let channel3WillUpdate = Channel3.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel3.channelNumber);
      let channel4WillUpdate = Channel4.willChannelUpdate(numberOfCycles) || didChannelDacChange(Channel4.channelNumber);
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
      }
      // If any channel updated, we need to re-mix our samples
      if (channel1WillUpdate || channel2WillUpdate || channel3WillUpdate || channel4WillUpdate) {
          SoundAccumulator.needToRemixSamples = true;
      }
      // Do Some downsampling magic
      Sound.downSampleCycleCounter += numberOfCycles * Sound.downSampleCycleMultiplier;
      if (Sound.downSampleCycleCounter >= Sound.maxDownSampleCycles()) {
          // Reset the downsample counter
          // Don't set to zero to catch overflowed cycles
          Sound.downSampleCycleCounter -= Sound.maxDownSampleCycles();
          if (SoundAccumulator.needToRemixSamples || SoundAccumulator.mixerVolumeChanged || SoundAccumulator.mixerEnabledChanged) {
              mixChannelSamples(SoundAccumulator.channel1Sample, SoundAccumulator.channel2Sample, SoundAccumulator.channel3Sample, SoundAccumulator.channel4Sample);
          }
          // Finally Simply place the accumulated sample in memory
          // Set our volumes in memory
          // +1 so it can not be zero
          setLeftAndRightOutputForAudioQueue(SoundAccumulator.leftChannelSampleUnsignedByte + 1, SoundAccumulator.rightChannelSampleUnsignedByte + 1, Sound.audioQueueIndex);
          Sound.audioQueueIndex += 1;
          // Don't allow our audioQueueIndex to overflow into other parts of the wasmBoy memory map
          // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0
          // Not 0xFFFF because we need half of 64kb since we store left and right channel
          if (Sound.audioQueueIndex >= Sound.wasmBoyMemoryMaxBufferSize / 2 - 1) {
              Sound.audioQueueIndex -= 1;
          }
      }
  }
  // Function used by SoundAccumulator to find out if a channel Dac Changed
  function didChannelDacChange(channelNumber) {
      switch (channelNumber) {
          case Channel1.channelNumber:
              if (SoundAccumulator.channel1DacEnabled !== Channel1.isDacEnabled) {
                  SoundAccumulator.channel1DacEnabled = Channel1.isDacEnabled;
                  return true;
              }
              return false;
          case Channel2.channelNumber:
              if (SoundAccumulator.channel2DacEnabled !== Channel2.isDacEnabled) {
                  SoundAccumulator.channel2DacEnabled = Channel2.isDacEnabled;
                  return true;
              }
              return false;
          case Channel3.channelNumber:
              if (SoundAccumulator.channel3DacEnabled !== Channel3.isDacEnabled) {
                  SoundAccumulator.channel3DacEnabled = Channel3.isDacEnabled;
                  return true;
              }
              return false;
          case Channel4.channelNumber:
              if (SoundAccumulator.channel4DacEnabled !== Channel4.isDacEnabled) {
                  SoundAccumulator.channel4DacEnabled = Channel4.isDacEnabled;
                  return true;
              }
              return false;
      }
      return false;
  }

  // https://emu-docs.org/Game%20Boy/gb_sound.txt
  class Sound {
      // Number of cycles to run in each batch process
      // This number should be in sync so that sound doesn't run too many cyles at once
      // and does not exceed the minimum number of cyles for either down sampling, or
      // How often we change the frame, or a channel's update process
      static batchProcessCycles() {
          if (Cpu.GBCDoubleSpeed) {
              return 174;
          }
          return 87;
      }
      static updateNR50(value) {
          Sound.NR50LeftMixerVolume = (value >> 4) & 0x07;
          Sound.NR50RightMixerVolume = value & 0x07;
      }
      static updateNR51(value) {
          Sound.NR51IsChannel4EnabledOnLeftOutput = checkBitOnByte(7, value);
          Sound.NR51IsChannel3EnabledOnLeftOutput = checkBitOnByte(6, value);
          Sound.NR51IsChannel2EnabledOnLeftOutput = checkBitOnByte(5, value);
          Sound.NR51IsChannel1EnabledOnLeftOutput = checkBitOnByte(4, value);
          Sound.NR51IsChannel4EnabledOnRightOutput = checkBitOnByte(3, value);
          Sound.NR51IsChannel3EnabledOnRightOutput = checkBitOnByte(2, value);
          Sound.NR51IsChannel2EnabledOnRightOutput = checkBitOnByte(1, value);
          Sound.NR51IsChannel1EnabledOnRightOutput = checkBitOnByte(0, value);
      }
      static updateNR52(value) {
          Sound.NR52IsSoundEnabled = checkBitOnByte(7, value);
      }
      static maxFrameSequenceCycles() {
          if (Cpu.GBCDoubleSpeed) {
              return 16384;
          }
          return 8192;
      }
      static maxDownSampleCycles() {
          return Cpu.CLOCK_SPEED();
      }
      // Function to save the state of the class
      static saveState() {
          store(getSaveStateMemoryOffset(0x00, Sound.saveStateSlot), Sound.frameSequenceCycleCounter);
          store(getSaveStateMemoryOffset(0x04, Sound.saveStateSlot), Sound.downSampleCycleCounter);
          store(getSaveStateMemoryOffset(0x05, Sound.saveStateSlot), Sound.frameSequencer);
      }
      // Function to load the save state from memory
      static loadState() {
          Sound.frameSequenceCycleCounter = load(getSaveStateMemoryOffset(0x00, Sound.saveStateSlot));
          Sound.downSampleCycleCounter = load(getSaveStateMemoryOffset(0x04, Sound.saveStateSlot));
          Sound.frameSequencer = load(getSaveStateMemoryOffset(0x05, Sound.saveStateSlot));
          clearAudioBuffer();
      }
  }
  // Current cycles
  // This will be used for batch processing
  // https://github.com/binji/binjgb/commit/e028f45e805bc0b0aa4697224a209f9ae514c954
  // TODO: May Also need to do this for Reads
  Sound.currentCycles = 0;
  // Channel control / On-OFF / Volume (RW)
  Sound.memoryLocationNR50 = 0xff24;
  Sound.NR50LeftMixerVolume = 0;
  Sound.NR50RightMixerVolume = 0;
  // 0xFF25 selects which output each channel goes to, Referred to as NR51
  Sound.memoryLocationNR51 = 0xff25;
  Sound.NR51IsChannel1EnabledOnLeftOutput = true;
  Sound.NR51IsChannel2EnabledOnLeftOutput = true;
  Sound.NR51IsChannel3EnabledOnLeftOutput = true;
  Sound.NR51IsChannel4EnabledOnLeftOutput = true;
  Sound.NR51IsChannel1EnabledOnRightOutput = true;
  Sound.NR51IsChannel2EnabledOnRightOutput = true;
  Sound.NR51IsChannel3EnabledOnRightOutput = true;
  Sound.NR51IsChannel4EnabledOnRightOutput = true;
  // Sound on/off
  Sound.memoryLocationNR52 = 0xff26;
  Sound.NR52IsSoundEnabled = true;
  // $FF30 -- $FF3F is the load register space for the 4-bit samples for channel 3
  Sound.memoryLocationChannel3LoadRegisterStart = 0xff30;
  // Need to count how often we need to increment our frame sequencer
  // Which you can read about below
  Sound.frameSequenceCycleCounter = 0x0000;
  // Also need to downsample our audio to average audio qualty
  // https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/
  // Want to do 48000hz, so CpuRate / Sound Rate, 4194304 / 48000 ~ 87 cycles
  Sound.downSampleCycleCounter = 0x00;
  Sound.downSampleCycleMultiplier = 48000;
  // Frame sequencer controls what should be updated and and ticked
  // Everyt time the sound is updated :) It is updated everytime the
  // Cycle counter reaches the max cycle
  Sound.frameSequencer = 0x00;
  // Our current sample number we are passing back to the wasmboy memory map
  // Found that a static number of samples doesn't work well on mobile
  // Will just update the queue index, grab as much as we can whenever we need more audio, then reset
  // NOTE: Giving a really large sample rate gives more latency, but less pops!
  //static readonly MAX_NUMBER_OF_SAMPLES: i32 = 4096;
  Sound.audioQueueIndex = 0x0000;
  Sound.wasmBoyMemoryMaxBufferSize = 0x20000;
  // Save States
  Sound.saveStateSlot = 6;
  // Initialize sound registers
  // From: https://emu-docs.org/Game%20Boy/gb_sound.txt
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
      Sound.audioQueueIndex = 0x0000;
      // intiialize our channels
      Channel1.initialize();
      Channel2.initialize();
      Channel3.initialize();
      Channel4.initialize();
      // Other Sound Registers
      eightBitStoreIntoGBMemory(Sound.memoryLocationNR50, 0x77);
      eightBitStoreIntoGBMemory(Sound.memoryLocationNR51, 0xf3);
      eightBitStoreIntoGBMemory(Sound.memoryLocationNR52, 0xf1);
      initializeSoundAccumulator();
  }
  // Function to batch process our audio after we skipped so many cycles
  function batchProcessAudio() {
      if (Sound.currentCycles < Sound.batchProcessCycles()) {
          return;
      }
      while (Sound.currentCycles >= Sound.batchProcessCycles()) {
          updateSound(Sound.batchProcessCycles());
          Sound.currentCycles = Sound.currentCycles - Sound.batchProcessCycles();
      }
  }
  // Function for updating sound
  function updateSound(numberOfCycles) {
      // Check if our frameSequencer updated
      let frameSequencerUpdated = updateFrameSequencer(numberOfCycles);
      if (Config.audioAccumulateSamples && !frameSequencerUpdated) {
          accumulateSound(numberOfCycles);
      }
      else {
          calculateSound(numberOfCycles);
      }
  }
  // Funciton to get the current Audio Queue index
  function getNumberOfSamplesInAudioBuffer() {
      return Sound.audioQueueIndex;
  }
  // Function to reset the audio queue
  function clearAudioBuffer() {
      Sound.audioQueueIndex = 0;
  }
  function calculateSound(numberOfCycles) {
      // Update all of our channels
      // All samples will be returned as 0 to 30
      // 0 being -1.0, and 30 being 1.0
      // (see blurb at top)
      let channel1Sample = Channel1.getSample(numberOfCycles);
      let channel2Sample = Channel2.getSample(numberOfCycles);
      let channel3Sample = Channel3.getSample(numberOfCycles);
      let channel4Sample = Channel4.getSample(numberOfCycles);
      // TODO: Allow individual channels to be muted
      // let channel1Sample: i32 = 15;
      // let channel2Sample: i32 = 15;
      // let channel3Sample: i32 = 15;
      // let channel4Sample: i32 = 15;
      // Save the samples in the accumulator
      SoundAccumulator.channel1Sample = channel1Sample;
      SoundAccumulator.channel2Sample = channel2Sample;
      SoundAccumulator.channel3Sample = channel3Sample;
      SoundAccumulator.channel4Sample = channel4Sample;
      // Do Some downsampling magic
      Sound.downSampleCycleCounter += numberOfCycles * Sound.downSampleCycleMultiplier;
      if (Sound.downSampleCycleCounter >= Sound.maxDownSampleCycles()) {
          // Reset the downsample counter
          // Don't set to zero to catch overflowed cycles
          Sound.downSampleCycleCounter -= Sound.maxDownSampleCycles();
          // Mixe our samples
          let mixedSample = mixChannelSamples(channel1Sample, channel2Sample, channel3Sample, channel4Sample);
          let leftChannelSampleUnsignedByte = splitHighByte(mixedSample);
          let rightChannelSampleUnsignedByte = splitLowByte(mixedSample);
          // Set our volumes in memory
          // +1 so it can not be zero
          setLeftAndRightOutputForAudioQueue(leftChannelSampleUnsignedByte + 1, rightChannelSampleUnsignedByte + 1, Sound.audioQueueIndex);
          Sound.audioQueueIndex += 1;
          // Don't allow our audioQueueIndex to overflow into other parts of the wasmBoy memory map
          // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit#gid=0
          // Not 0xFFFF because we need half of 64kb since we store left and right channel
          if (Sound.audioQueueIndex >= Sound.wasmBoyMemoryMaxBufferSize / 2 - 1) {
              Sound.audioQueueIndex -= 1;
          }
      }
  }
  function updateFrameSequencer(numberOfCycles) {
      // APU runs at 4194304 / 512
      // Or Cpu.clockSpeed / 512
      // Which means, we need to update once every 8192 cycles :)
      Sound.frameSequenceCycleCounter += numberOfCycles;
      if (Sound.frameSequenceCycleCounter >= Sound.maxFrameSequenceCycles()) {
          // Reset the frameSequenceCycleCounter
          // Not setting to zero as we do not want to drop cycles
          Sound.frameSequenceCycleCounter -= Sound.maxFrameSequenceCycles();
          // Check our frame sequencer
          // https://gist.github.com/drhelius/3652407
          switch (Sound.frameSequencer) {
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
          }
          // Update our frame sequencer
          Sound.frameSequencer += 1;
          if (Sound.frameSequencer >= 8) {
              Sound.frameSequencer = 0;
          }
          return true;
      }
      return false;
  }
  function mixChannelSamples(channel1Sample = 15, channel2Sample = 15, channel3Sample = 15, channel4Sample = 15) {
      // Do Some Cool mixing
      // NR50 FF24 ALLL BRRR Vin L enable, Left vol, Vin R enable, Right vol
      // NR51 FF25 NW21 NW21 Left enables, Right enables
      // NR52 FF26 P--- NW21 Power control/status, Channel length statuses
      // NW21 = 4 bits on byte
      // 3 -> Channel 4, 2 -> Channel 3, 1 -> Channel 2, 0 -> Channel 1
      // Matt's Proccess
      // I push out 1024 samples at a time and use 96000 hz sampling rate, so I guess i'm a bit less than one frame,
      // but I let the queue fill up with 4 x 1024 samples before I start waiting for the audio
      // TODO: Vin Mixing
      SoundAccumulator.mixerVolumeChanged = false;
      // Get our channel volume for left/right
      let leftChannelSample = 0;
      let rightChannelSample = 0;
      // Find the sample for the left if enabled
      // other wise add silence (15) for the channel
      if (Sound.NR51IsChannel1EnabledOnLeftOutput) {
          leftChannelSample += channel1Sample;
      }
      else {
          leftChannelSample += 15;
      }
      if (Sound.NR51IsChannel2EnabledOnLeftOutput) {
          leftChannelSample += channel2Sample;
      }
      else {
          leftChannelSample += 15;
      }
      if (Sound.NR51IsChannel3EnabledOnLeftOutput) {
          leftChannelSample += channel3Sample;
      }
      else {
          leftChannelSample += 15;
      }
      if (Sound.NR51IsChannel4EnabledOnLeftOutput) {
          leftChannelSample += channel4Sample;
      }
      else {
          leftChannelSample += 15;
      }
      // Find the sample for the right if enabled
      // other wise add silence (15) for the channel
      if (Sound.NR51IsChannel1EnabledOnRightOutput) {
          rightChannelSample += channel1Sample;
      }
      else {
          rightChannelSample += 15;
      }
      if (Sound.NR51IsChannel2EnabledOnRightOutput) {
          rightChannelSample += channel2Sample;
      }
      else {
          rightChannelSample += 15;
      }
      if (Sound.NR51IsChannel3EnabledOnRightOutput) {
          rightChannelSample += channel3Sample;
      }
      else {
          rightChannelSample += 15;
      }
      if (Sound.NR51IsChannel4EnabledOnRightOutput) {
          rightChannelSample += channel4Sample;
      }
      else {
          rightChannelSample += 15;
      }
      // Update our accumulator
      SoundAccumulator.mixerEnabledChanged = false;
      SoundAccumulator.needToRemixSamples = false;
      // Finally multiply our volumes by the mixer volume
      // Mixer volume can be at most 7 + 1
      // Can be at most 7, because we only have 3 bits, 111 = 7
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Mixer
      // Done in the getSampleAsUnsignedByte(), since we are doing some weirdness there :)
      // Convert our samples from unsigned 32 to unsigned byte
      // Reason being, We want to be able to pass in wasm memory as usigned byte. Javascript will handle the conversion back
      let leftChannelSampleUnsignedByte = getSampleAsUnsignedByte(leftChannelSample, Sound.NR50LeftMixerVolume + 1);
      let rightChannelSampleUnsignedByte = getSampleAsUnsignedByte(rightChannelSample, Sound.NR50RightMixerVolume + 1);
      // Save these samples in the accumulator
      SoundAccumulator.leftChannelSampleUnsignedByte = leftChannelSampleUnsignedByte;
      SoundAccumulator.rightChannelSampleUnsignedByte = rightChannelSampleUnsignedByte;
      return concatenateBytes(leftChannelSampleUnsignedByte, rightChannelSampleUnsignedByte);
  }
  function getSampleAsUnsignedByte(sample, mixerVolume) {
      // If the sample is silence, return silence as unsigned byte
      // Silence is common, and should be checked for performance
      if (sample === 60) {
          return 127;
      }
      // convert to a signed, precise scale of -6000 to 6000 (cheap way of -1.0 to 1.0)
      // Multiply by the mixer volume fraction (to find the actual volume)
      let precision = 100000;
      let convertedSample = sample - 60;
      convertedSample = convertedSample * precision;
      // Multiply by the mixer volume fraction (to find the actual volume)
      convertedSample = (convertedSample * mixerVolume) / 8;
      // Convert back to scale of 0 to 120
      convertedSample = convertedSample / precision;
      convertedSample = convertedSample + 60;
      // Finally, convert to an unsigned byte scale
      // With Four Channels (0 to 30) and no global volume. Max is 120
      // max unsigned byte goal is 254 (see blurb at top).
      // 120 / 254 should give the correct conversion
      // For example, 120 / 254 = 0.47244094488188976
      // Multiply by 1000 to increase the float into an int
      // so, 120 * 1000 / (0.47244094488188976 * 1000) should give approximate answer for max mixer volume
      let maxDivider = (120 * precision) / 254;
      convertedSample = (convertedSample * precision) / maxDivider;
      // Ensure we have an i32 and not a float for JS builds
      convertedSample = i32Portable(convertedSample);
      return convertedSample;
  }
  // Function to set our left and right channels at the correct queue index
  function setLeftAndRightOutputForAudioQueue(leftVolume, rightVolume, audioQueueIndex) {
      // Get our stereo index
      let audioQueueOffset = AUDIO_BUFFER_LOCATION + audioQueueIndex * 2;
      // Store our volumes
      // +1 that way we don't have empty data to ensure that the value is set
      store(audioQueueOffset, (leftVolume + 1));
      store(audioQueueOffset + 1, (rightVolume + 1));
  }

  // Functions involved in R/W of sound registers
  // Function to check and handle writes to sound registers
  function SoundRegisterWriteTraps(offset, value) {
      if (offset !== Sound.memoryLocationNR52 && !Sound.NR52IsSoundEnabled) {
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
              if (checkBitOnByte(7, value)) {
                  Channel1.updateNRx4(value);
                  Channel1.trigger();
              }
              return true;
          case Channel2.memoryLocationNRx4:
              if (checkBitOnByte(7, value)) {
                  Channel2.updateNRx4(value);
                  Channel2.trigger();
              }
              return true;
          case Channel3.memoryLocationNRx4:
              if (checkBitOnByte(7, value)) {
                  Channel3.updateNRx4(value);
                  Channel3.trigger();
              }
              return true;
          case Channel4.memoryLocationNRx4:
              if (checkBitOnByte(7, value)) {
                  Channel4.updateNRx4(value);
                  Channel4.trigger();
              }
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
              Sound.updateNR52(value);
              if (!checkBitOnByte(7, value)) {
                  for (let i = 0xff10; i < 0xff26; i++) {
                      eightBitStoreIntoGBMemory(i, 0x00);
                  }
              }
              return true;
      }
      // We did not handle the write, Allow the write
      return true;
  }
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
  function SoundRegisterReadTraps(offset) {
      // TODO: OR All Registers
      // This will fix bugs in orcale of ages :)
      if (offset === Sound.memoryLocationNR52) {
          // Get our registerNR52
          let registerNR52 = eightBitLoadFromGBMemory(Sound.memoryLocationNR52);
          // Knock off lower 7 bits
          registerNR52 = registerNR52 & 0x80;
          // Or from the table
          registerNR52 = registerNR52 | 0x70;
          return registerNR52;
      }
      return -1;
  }

  class Interrupts {
      static updateInterruptEnabled(value) {
          Interrupts.isVBlankInterruptEnabled = checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, value);
          Interrupts.isLcdInterruptEnabled = checkBitOnByte(Interrupts.bitPositionLcdInterrupt, value);
          Interrupts.isTimerInterruptEnabled = checkBitOnByte(Interrupts.bitPositionTimerInterrupt, value);
          Interrupts.isJoypadInterruptEnabled = checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, value);
          Interrupts.interruptsEnabledValue = value;
      }
      static updateInterruptRequested(value) {
          Interrupts.isVBlankInterruptRequested = checkBitOnByte(Interrupts.bitPositionVBlankInterrupt, value);
          Interrupts.isLcdInterruptRequested = checkBitOnByte(Interrupts.bitPositionLcdInterrupt, value);
          Interrupts.isTimerInterruptRequested = checkBitOnByte(Interrupts.bitPositionTimerInterrupt, value);
          Interrupts.isJoypadInterruptRequested = checkBitOnByte(Interrupts.bitPositionJoypadInterrupt, value);
          Interrupts.interruptsRequestedValue = value;
      }
      // Function to return if we have any pending interrupts
      static areInterruptsPending() {
          return (Interrupts.interruptsRequestedValue & Interrupts.interruptsEnabledValue & 0x1f) > 0;
      }
      // Function to save the state of the class
      static saveState() {
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x00, Interrupts.saveStateSlot), Interrupts.masterInterruptSwitch);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x01, Interrupts.saveStateSlot), Interrupts.masterInterruptSwitchDelay);
          // Interrupts enabled and requested are stored in actual GB memory, thus, don't need to be saved
      }
      // Function to load the save state from memory
      static loadState() {
          Interrupts.masterInterruptSwitch = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x00, Interrupts.saveStateSlot));
          Interrupts.masterInterruptSwitchDelay = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x01, Interrupts.saveStateSlot));
          Interrupts.updateInterruptEnabled(eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptEnabled));
          Interrupts.updateInterruptRequested(eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest));
      }
  }
  Interrupts.masterInterruptSwitch = false;
  // According to mooneye, interrupts are not handled until AFTER
  // Next instruction
  // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown
  Interrupts.masterInterruptSwitchDelay = false;
  // Biut position for each part of the interrupts HW registers
  Interrupts.bitPositionVBlankInterrupt = 0;
  Interrupts.bitPositionLcdInterrupt = 1;
  Interrupts.bitPositionTimerInterrupt = 2;
  Interrupts.bitPositionJoypadInterrupt = 4;
  Interrupts.memoryLocationInterruptEnabled = 0xffff; // A.K.A interrupt Flag (IE)
  // Cache which Interrupts are enabled
  Interrupts.interruptsEnabledValue = 0;
  Interrupts.isVBlankInterruptEnabled = false;
  Interrupts.isLcdInterruptEnabled = false;
  Interrupts.isTimerInterruptEnabled = false;
  Interrupts.isJoypadInterruptEnabled = false;
  Interrupts.memoryLocationInterruptRequest = 0xff0f; // A.K.A interrupt Flag (IF)
  // Cache which Interrupts are requested
  Interrupts.interruptsRequestedValue = 0;
  Interrupts.isVBlankInterruptRequested = false;
  Interrupts.isLcdInterruptRequested = false;
  Interrupts.isTimerInterruptRequested = false;
  Interrupts.isJoypadInterruptRequested = false;
  // Save States
  Interrupts.saveStateSlot = 2;
  function initializeInterrupts() {
      // Values from BGB
      // IE
      Interrupts.updateInterruptEnabled(0x00);
      eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptEnabled, Interrupts.interruptsEnabledValue);
      // IF
      Interrupts.updateInterruptRequested(0xe1);
      eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, Interrupts.interruptsRequestedValue);
  }
  // NOTE: Interrupts should be handled before reading an opcode
  function checkInterrupts() {
      // First check for our delay was enabled
      if (Interrupts.masterInterruptSwitchDelay) {
          Interrupts.masterInterruptSwitch = true;
          Interrupts.masterInterruptSwitchDelay = false;
      }
      // Check if we have an enabled and requested interrupt
      let isAnInterruptRequestedAndEnabledValue = Interrupts.interruptsEnabledValue & Interrupts.interruptsRequestedValue & 0x1f;
      if (isAnInterruptRequestedAndEnabledValue > 0) {
          // Boolean to track if interrupts were handled
          // Interrupt handling requires 20 cycles
          // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
          let wasInterruptHandled = false;
          // Service our interrupts, if we have the master switch enabled
          // https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/
          if (Interrupts.masterInterruptSwitch && !Cpu.isHaltNoJump) {
              if (Interrupts.isVBlankInterruptEnabled && Interrupts.isVBlankInterruptRequested) {
                  _handleInterrupt(Interrupts.bitPositionVBlankInterrupt);
                  wasInterruptHandled = true;
              }
              else if (Interrupts.isLcdInterruptEnabled && Interrupts.isLcdInterruptRequested) {
                  _handleInterrupt(Interrupts.bitPositionLcdInterrupt);
                  wasInterruptHandled = true;
              }
              else if (Interrupts.isTimerInterruptEnabled && Interrupts.isTimerInterruptRequested) {
                  _handleInterrupt(Interrupts.bitPositionTimerInterrupt);
                  wasInterruptHandled = true;
              }
              else if (Interrupts.isJoypadInterruptEnabled && Interrupts.isJoypadInterruptRequested) {
                  _handleInterrupt(Interrupts.bitPositionJoypadInterrupt);
                  wasInterruptHandled = true;
              }
          }
          let interuptHandlerCycles = 0;
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
      setInterrupts(false);
      // Disable the bit on the interruptRequest
      let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);
      interruptRequest = resetBitOnByte(bitPosition, interruptRequest);
      Interrupts.interruptsRequestedValue = interruptRequest;
      eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, interruptRequest);
      // Push the programCounter onto the stacks
      // Push the next instruction, not the halt itself (TCAGBD).
      Cpu.stackPointer = Cpu.stackPointer - 2;
      if (Cpu.isHalted()) {
          // TODO: This breaks Pokemon Yellow, And OG Link's awakening. Find out why...
          // sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter + 1);
          sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      }
      else {
          sixteenBitStoreIntoGBMemory(Cpu.stackPointer, Cpu.programCounter);
      }
      // Jump to the correct interrupt location
      // Also puiggyback off of the switch to reset our HW Register caching
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
          case Interrupts.bitPositionJoypadInterrupt:
              Interrupts.isJoypadInterruptRequested = false;
              Cpu.programCounter = 0x60;
              break;
      }
  }
  function _requestInterrupt(bitPosition) {
      let interruptRequest = eightBitLoadFromGBMemory(Interrupts.memoryLocationInterruptRequest);
      // Pass to set the correct interrupt bit on interruptRequest
      interruptRequest = setBitOnByte(bitPosition, interruptRequest);
      Interrupts.interruptsRequestedValue = interruptRequest;
      eightBitStoreIntoGBMemory(Interrupts.memoryLocationInterruptRequest, interruptRequest);
  }
  function setInterrupts(value) {
      // If we are enabling interrupts,
      // we want to wait 4 cycles before enabling
      if (value) {
          Interrupts.masterInterruptSwitchDelay = true;
      }
      else {
          Interrupts.masterInterruptSwitch = false;
      }
  }
  function requestVBlankInterrupt() {
      Interrupts.isVBlankInterruptRequested = true;
      _requestInterrupt(Interrupts.bitPositionVBlankInterrupt);
  }
  function requestLcdInterrupt() {
      Interrupts.isLcdInterruptRequested = true;
      _requestInterrupt(Interrupts.bitPositionLcdInterrupt);
  }
  function requestTimerInterrupt() {
      Interrupts.isTimerInterruptRequested = true;
      _requestInterrupt(Interrupts.bitPositionTimerInterrupt);
  }
  function requestJoypadInterrupt() {
      Interrupts.isJoypadInterruptRequested = true;
      _requestInterrupt(Interrupts.bitPositionJoypadInterrupt);
  }

  class Timers {
      // Number of cycles to run in each batch process
      static batchProcessCycles() {
          return 256;
      }
      static updateDividerRegister(value) {
          let oldDividerRegister = Timers.dividerRegister;
          Timers.dividerRegister = 0;
          eightBitStoreIntoGBMemory(Timers.memoryLocationDividerRegister, 0);
          if (Timers.timerEnabled && _checkDividerRegisterFallingEdgeDetector(oldDividerRegister, Timers.dividerRegister)) {
              _incrementTimerCounter();
          }
      }
      static updateTimerCounter(value) {
          if (Timers.timerEnabled) {
              // From binjgb, dont write TIMA if we were just reset
              if (Timers.timerCounterWasReset) {
                  return;
              }
              // Mooneye Test, tima_write_reloading
              // Writing in this strange delay cycle, will cancel
              // Both the interrupt and the TMA reload
              if (Timers.timerCounterOverflowDelay) {
                  Timers.timerCounterOverflowDelay = false;
              }
          }
          Timers.timerCounter = value;
      }
      static updateTimerModulo(value) {
          Timers.timerModulo = value;
          // Mooneye Test, tma_write_reloading
          // Don't update if we were reloading
          if (Timers.timerEnabled && Timers.timerCounterWasReset) {
              Timers.timerCounter = Timers.timerModulo;
              Timers.timerCounterWasReset = false;
          }
      }
      static updateTimerControl(value) {
          // Get some initial values
          let oldTimerEnabled = Timers.timerEnabled;
          Timers.timerEnabled = checkBitOnByte(2, value);
          let newTimerInputClock = value & 0x03;
          // Do some obscure behavior for if we should increment TIMA
          // This does the timer increments from rapid_toggle mooneye tests
          if (!oldTimerEnabled) {
              let oldTimerCounterMaskBit = _getTimerCounterMaskBit(Timers.timerInputClock);
              let newTimerCounterMaskBit = _getTimerCounterMaskBit(newTimerInputClock);
              let shouldIncrementTimerCounter = false;
              if (Timers.timerEnabled) {
                  shouldIncrementTimerCounter = checkBitOnByte(oldTimerCounterMaskBit, Timers.dividerRegister);
              }
              else {
                  shouldIncrementTimerCounter =
                      checkBitOnByte(oldTimerCounterMaskBit, Timers.dividerRegister) && checkBitOnByte(newTimerCounterMaskBit, Timers.dividerRegister);
              }
              if (shouldIncrementTimerCounter) {
                  _incrementTimerCounter();
              }
          }
          Timers.timerInputClock = newTimerInputClock;
      }
      // Function to save the state of the class
      // TODO: Save state for new properties on Timers
      static saveState() {
          store(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot), Timers.currentCycles);
          store(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot), Timers.dividerRegister);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot), Timers.timerCounterOverflowDelay);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0b, Timers.saveStateSlot), Timers.timerCounterWasReset);
          eightBitStoreIntoGBMemory(Timers.memoryLocationTimerCounter, Timers.timerCounter);
      }
      // Function to load the save state from memory
      static loadState() {
          Timers.currentCycles = load(getSaveStateMemoryOffset(0x00, Timers.saveStateSlot));
          Timers.dividerRegister = load(getSaveStateMemoryOffset(0x04, Timers.saveStateSlot));
          Timers.timerCounterOverflowDelay = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x08, Timers.saveStateSlot));
          Timers.timerCounterWasReset = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0b, Timers.saveStateSlot));
          Timers.timerCounter = eightBitLoadFromGBMemory(Timers.memoryLocationTimerCounter);
          Timers.timerModulo = eightBitLoadFromGBMemory(Timers.memoryLocationTimerModulo);
          Timers.timerInputClock = eightBitLoadFromGBMemory(Timers.memoryLocationTimerControl);
      }
  }
  // Current cycles
  // This will be used for batch processing
  Timers.currentCycles = 0;
  // Divider Register = DIV
  // Divider Register is 16 bits.
  // Divider Register when read is just the upper 8 bits
  // But internally is used as the full 16
  // Essentially dividerRegister is an always counting clock
  // DIV Drives everything, it is the heart of the timer.
  // All other timing registers base them selves relative to the DIV register
  // Think of the div register as like a cycle counter :)
  // DIV will increment TIMA, whenever there is a falling edge, see below for that.
  Timers.memoryLocationDividerRegister = 0xff04; // DIV
  Timers.dividerRegister = 0;
  // timerCounter = TIMA
  // TIMA is the actual counter.
  // Whenever the DIV gets the falling edge, and other obscure cases,
  // This is incremented. When this overflows, we need to fire an interrupt.
  Timers.memoryLocationTimerCounter = 0xff05;
  Timers.timerCounter = 0;
  Timers.timerCounterOverflowDelay = false;
  Timers.timerCounterWasReset = false;
  Timers.timerCounterMask = 0;
  // Timer Modulo = TMA
  // TMA is what TIMA (Notice the I :p) is counting from, and TIMA will load
  // Whenever TIMA overflow.
  // For instance, we count like 1,2,3,4,5,6,7,8,9, and then overflow to 10.
  // TMA would be like "Hey, start counting from 5 whenever we reset"
  // Then we would be like 5,6,7,8,9...5,6,7,8,9...etc...
  Timers.memoryLocationTimerModulo = 0xff06;
  Timers.timerModulo = 0;
  // Timer Control = TAC
  // TAC Says how fast we are counting.
  // TAC controls which bit we are watching for the falling edge on the DIV register
  // And whenever the bit has the falling edge, we increment TIMA (The thing counting).
  // Therefore, depending on the value, we will either count faster or slower.
  Timers.memoryLocationTimerControl = 0xff07;
  // Bit 2    - Timer Stop  (0=Stop, 1=Start)
  // Bits 1-0 - Input Clock Select
  //            00:   4096 Hz    (~4194 Hz SGB) (1024 cycles)
  //            01: 262144 Hz  (~268400 Hz SGB) (16 cycles)
  //            10:  65536 Hz   (~67110 Hz SGB) (64 cycles)
  //            11:  16384 Hz   (~16780 Hz SGB) (256 cycles)
  Timers.timerEnabled = false;
  Timers.timerInputClock = 0;
  // Save States
  Timers.saveStateSlot = 5;
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
          Timers.dividerRegister = 0x1ea0;
          // 0xFF05 -> 0xFF06 = 0x00
          // TAC
          eightBitStoreIntoGBMemory(0xff07, 0xf8);
          Timers.timerInputClock = 0xf8;
      }
      else {
          // DIV
          eightBitStoreIntoGBMemory(0xff04, 0xab);
          Timers.dividerRegister = 0xabcc;
          // 0xFF05 -> 0xFF06 = 0x00
          // TAC
          eightBitStoreIntoGBMemory(0xff07, 0xf8);
          Timers.timerInputClock = 0xf8;
      }
  }
  // Batch Process Timers
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
      let cyclesIncreased = 0;
      while (cyclesIncreased < numberOfCycles) {
          let oldDividerRegister = Timers.dividerRegister;
          cyclesIncreased += 4;
          Timers.dividerRegister += 4;
          if (Timers.dividerRegister > 0xffff) {
              Timers.dividerRegister -= 0x10000;
          }
          if (Timers.timerEnabled) {
              if (Timers.timerCounterOverflowDelay) {
                  Timers.timerCounter = Timers.timerModulo;
                  // Fire off timer interrupt
                  requestTimerInterrupt();
                  Timers.timerCounterOverflowDelay = false;
                  Timers.timerCounterWasReset = true;
              }
              else if (Timers.timerCounterWasReset) {
                  Timers.timerCounterWasReset = false;
              }
              if (_checkDividerRegisterFallingEdgeDetector(oldDividerRegister, Timers.dividerRegister)) {
                  _incrementTimerCounter();
              }
          }
      }
  }
  // Function to increment our Timer Counter
  // This fires off interrupts once we overflow
  function _incrementTimerCounter() {
      Timers.timerCounter += 1;
      if (Timers.timerCounter > 255) {
          // Whenever the timer overflows, there is a slight delay (4 cycles)
          // Of when TIMA gets TMA's value, and the interrupt is fired.
          // Thus we will set the delay, which can be handled in the update timer or write trap
          Timers.timerCounterOverflowDelay = true;
          Timers.timerCounter = 0;
      }
  }
  // Function to act as our falling edge detector
  // Whenever we have a falling edge, we need to increment TIMA
  // http://gbdev.gg8.se/wiki/articles/Timer_Obscure_Behaviour
  // https://github.com/binji/binjgb/blob/master/src/emulator.c#L1944
  function _checkDividerRegisterFallingEdgeDetector(oldDividerRegister, newDividerRegister) {
      // Get our mask
      let timerCounterMaskBit = _getTimerCounterMaskBit(Timers.timerInputClock);
      // If the old register's watched bit was zero,
      // but after adding the new registers wastch bit is now 1
      if (checkBitOnByte(timerCounterMaskBit, oldDividerRegister) && !checkBitOnByte(timerCounterMaskBit, newDividerRegister)) {
          return true;
      }
      return false;
  }
  // Function to get our current tima mask bit
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
  }

  // http://www.codeslinger.co.uk/pages/projects/gameboy/joypad.html
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
  class Joypad {
      static updateJoypad(value) {
          Joypad.joypadRegisterFlipped = value ^ 0xff;
          Joypad.isDpadType = checkBitOnByte(4, Joypad.joypadRegisterFlipped);
          Joypad.isButtonType = checkBitOnByte(5, Joypad.joypadRegisterFlipped);
      }
      // Function to save the state of the class
      static saveState() { }
      // Function to load the save state from memory
      static loadState() {
          Joypad.updateJoypad(eightBitLoadFromGBMemory(Joypad.memoryLocationJoypadRegister));
      }
  }
  Joypad.up = false;
  Joypad.down = false;
  Joypad.left = false;
  Joypad.right = false;
  Joypad.a = false;
  Joypad.b = false;
  Joypad.select = false;
  Joypad.start = false;
  Joypad.memoryLocationJoypadRegister = 0xff00;
  // Cache some values on the Joypad register
  Joypad.joypadRegisterFlipped = 0;
  Joypad.isDpadType = false;
  Joypad.isButtonType = false;
  // Save States
  // Not doing anything for Joypad for now
  Joypad.saveStateSlot = 3;
  function getJoypadState() {
      // Get the joypad register
      let joypadRegister = Joypad.joypadRegisterFlipped;
      if (Joypad.isDpadType) {
          // D-pad buttons
          // Up
          if (Joypad.up) {
              joypadRegister = resetBitOnByte(2, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(2, joypadRegister);
          }
          // Right
          if (Joypad.right) {
              joypadRegister = resetBitOnByte(0, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(0, joypadRegister);
          }
          // Down
          if (Joypad.down) {
              joypadRegister = resetBitOnByte(3, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(3, joypadRegister);
          }
          // Left
          if (Joypad.left) {
              joypadRegister = resetBitOnByte(1, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(1, joypadRegister);
          }
      }
      else if (Joypad.isButtonType) {
          // A
          if (Joypad.a) {
              joypadRegister = resetBitOnByte(0, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(0, joypadRegister);
          }
          // B
          if (Joypad.b) {
              joypadRegister = resetBitOnByte(1, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(1, joypadRegister);
          }
          // Select
          if (Joypad.select) {
              joypadRegister = resetBitOnByte(2, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(2, joypadRegister);
          }
          // Start
          if (Joypad.start) {
              joypadRegister = resetBitOnByte(3, joypadRegister);
          }
          else {
              joypadRegister = setBitOnByte(3, joypadRegister);
          }
      }
      // Set the top 4 bits to on
      joypadRegister = joypadRegister | 0xf0;
      return joypadRegister;
  }
  function setJoypadState(up, right, down, left, a, b, select, start) {
      if (up > 0) {
          _pressJoypadButton(0);
      }
      else {
          _releaseJoypadButton(0);
      }
      if (right > 0) {
          _pressJoypadButton(1);
      }
      else {
          _releaseJoypadButton(1);
      }
      if (down > 0) {
          _pressJoypadButton(2);
      }
      else {
          _releaseJoypadButton(2);
      }
      if (left > 0) {
          _pressJoypadButton(3);
      }
      else {
          _releaseJoypadButton(3);
      }
      if (a > 0) {
          _pressJoypadButton(4);
      }
      else {
          _releaseJoypadButton(4);
      }
      if (b > 0) {
          _pressJoypadButton(5);
      }
      else {
          _releaseJoypadButton(5);
      }
      if (select > 0) {
          _pressJoypadButton(6);
      }
      else {
          _releaseJoypadButton(6);
      }
      if (start > 0) {
          _pressJoypadButton(7);
      }
      else {
          _releaseJoypadButton(7);
      }
  }
  function _pressJoypadButton(buttonId) {
      // Un stop the CPU
      Cpu.isStopped = false;
      // Check if the button state changed from not pressed
      let isButtonStateChanging = false;
      if (!_getJoypadButtonStateFromButtonId(buttonId)) {
          isButtonStateChanging = true;
      }
      // Set our joypad state
      _setJoypadButtonStateFromButtonId(buttonId, true);
      // If the button state is changing, check for an interrupt
      if (isButtonStateChanging) {
          // Determine if it is a button or a dpad button
          let isDpadTypeButton = false;
          if (buttonId <= 3) {
              isDpadTypeButton = true;
          }
          let shouldRequestInterrupt = false;
          // Check if the game is looking for a dpad type button press
          if (Joypad.isDpadType && isDpadTypeButton) {
              shouldRequestInterrupt = true;
          }
          // Check if the game is looking for a button type button press
          if (Joypad.isButtonType && !isDpadTypeButton) {
              shouldRequestInterrupt = true;
          }
          // Finally, request the interrupt, if the button state actually changed
          if (shouldRequestInterrupt) {
              requestJoypadInterrupt();
          }
      }
  }
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
  }

  // Function to handle rom/rambanking
  function handleBanking(offset, value) {
      // Is rom Only does not bank
      if (Memory.isRomOnly) {
          return;
      }
      // Enable Ram Banking
      if (offset <= 0x1fff) {
          if (Memory.isMBC2 && !checkBitOnByte(4, value)) {
              // Do Nothing
              return;
          }
          else {
              let romEnableByte = value & 0x0f;
              if (romEnableByte === 0x00) {
                  Memory.isRamBankingEnabled = false;
              }
              else if (romEnableByte === 0x0a) {
                  Memory.isRamBankingEnabled = true;
              }
          }
      }
      else if (offset <= 0x3fff) {
          if (!Memory.isMBC5 || offset <= 0x2fff) {
              // Change Low Bits on the Current Rom Bank
              if (Memory.isMBC2) {
                  Memory.currentRomBank = value & 0x0f;
              }
              // Set the number of bottom bytes from the MBC type
              let romBankLowerBits = value;
              if (Memory.isMBC1) {
                  // Only want the bottom 5
                  romBankLowerBits = romBankLowerBits & 0x1f;
                  Memory.currentRomBank = Memory.currentRomBank & 0xe0;
              }
              else if (Memory.isMBC3) {
                  // Only Want the bottom 7
                  romBankLowerBits = romBankLowerBits & 0x7f;
                  Memory.currentRomBank = Memory.currentRomBank & 0x80;
              }
              else if (Memory.isMBC5) {
                  // Going to switch the whole thing
                  Memory.currentRomBank = Memory.currentRomBank & 0x00;
              }
              // Set the lower bytes
              Memory.currentRomBank = Memory.currentRomBank | romBankLowerBits;
              return;
          }
          else {
              // TODO: MBC5 High bits Rom bank, check if this works, not sure about the value
              let highByte = 0;
              let lowByte = splitLowByte(Memory.currentRomBank);
              if (value > 0) {
                  highByte = 1;
              }
              Memory.currentRomBank = concatenateBytes(highByte, lowByte);
          }
      }
      else if (!Memory.isMBC2 && offset <= 0x5fff) {
          // ROM / RAM Banking, MBC2 doesn't do this
          if (Memory.isMBC1 && Memory.isMBC1RomModeEnabled) {
              // Do an upper bit rom bank for MBC 1
              // Remove upper bits of currentRomBank
              Memory.currentRomBank = Memory.currentRomBank & 0x1f;
              let romBankHigherBits = value & 0xe0;
              Memory.currentRomBank = Memory.currentRomBank | romBankHigherBits;
              return;
          }
          let ramBankBits = value;
          if (!Memory.isMBC5) {
              // Get the bottom 2 bits
              ramBankBits = ramBankBits & 0x03;
          }
          else {
              // Get the bottom nibble
              ramBankBits = ramBankBits & 0x0f;
          }
          // Set our ram bank
          Memory.currentRamBank = ramBankBits;
          return;
      }
      else if (!Memory.isMBC2 && offset <= 0x7fff) {
          if (Memory.isMBC1) {
              if (checkBitOnByte(0, value)) {
                  Memory.isMBC1RomModeEnabled = true;
              }
              else {
                  Memory.isMBC1RomModeEnabled = false;
              }
          }
          // TODO: MBC3 Latch Clock Data
      }
  }
  function getRomBankAddress(gameboyOffset) {
      let currentRomBank = Memory.currentRomBank;
      if (!Memory.isMBC5 && currentRomBank === 0) {
          currentRomBank = 1;
      }
      // Adjust our gameboy offset relative to zero for the gameboy memory map
      return (0x4000 * currentRomBank + (gameboyOffset - Memory.switchableCartridgeRomLocation));
  }
  function getRamBankAddress(gameboyOffset) {
      // Adjust our gameboy offset relative to zero for the gameboy memory map
      return (0x2000 * Memory.currentRamBank + (gameboyOffset - Memory.cartridgeRamLocation));
  }

  function initializeDma() {
      if (Cpu.GBCEnabled) {
          // GBC DMA
          eightBitStoreIntoGBMemory(0xff51, 0xff);
          eightBitStoreIntoGBMemory(0xff52, 0xff);
          eightBitStoreIntoGBMemory(0xff53, 0xff);
          eightBitStoreIntoGBMemory(0xff54, 0xff);
          eightBitStoreIntoGBMemory(0xff55, 0xff);
      }
      else {
          // GBC DMA
          eightBitStoreIntoGBMemory(0xff51, 0xff);
          eightBitStoreIntoGBMemory(0xff52, 0xff);
          eightBitStoreIntoGBMemory(0xff53, 0xff);
          eightBitStoreIntoGBMemory(0xff54, 0xff);
          eightBitStoreIntoGBMemory(0xff55, 0xff);
      }
  }
  function startDmaTransfer(sourceAddressOffset) {
      let sourceAddress = sourceAddressOffset;
      sourceAddress = sourceAddress << 8;
      for (let i = 0; i <= 0x9f; i++) {
          let spriteInformationByte = eightBitLoadFromGBMemory(sourceAddress + i);
          let spriteInformationAddress = Memory.spriteInformationTableLocation + i;
          eightBitStoreIntoGBMemory(spriteInformationAddress, spriteInformationByte);
      }
      // TCAGBD:  This copy (DMA) needs 160 × 4 + 4 clocks to complete in both double speed and single speeds modes
      // Increment all of our Cycle coiunters in ../cpu/opcodes
      Memory.DMACycles = 644;
  }
  // https://gist.github.com/drhelius/3394856
  // http://bgb.bircd.org/pandocs.htm
  function startHdmaTransfer(hdmaTriggerByteToBeWritten) {
      // Check if we are Gbc
      if (!Cpu.GBCEnabled) {
          return;
      }
      // Check if we are trying to terminate an already active HBLANK HDMA
      if (Memory.isHblankHdmaActive && !checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {
          // Don't reset anything, just set bit 7 to 1 on the trigger byte
          Memory.isHblankHdmaActive = false;
          let hdmaTriggerByte = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaTrigger);
          eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, setBitOnByte(7, hdmaTriggerByte));
          return;
      }
      // Get our source and destination for the HDMA
      let hdmaSource = getHdmaSourceFromMemory();
      let hdmaDestination = getHdmaDestinationFromMemory();
      // Get the length from the trigger
      // Lower 7 bits, Add 1, times 16
      // https://gist.github.com/drhelius/3394856
      let transferLength = resetBitOnByte(7, hdmaTriggerByteToBeWritten);
      transferLength = (transferLength + 1) * 16;
      // Get bit 7 of the trigger for the HDMA type
      if (checkBitOnByte(7, hdmaTriggerByteToBeWritten)) {
          // H-Blank DMA
          Memory.isHblankHdmaActive = true;
          Memory.hblankHdmaTransferLengthRemaining = transferLength;
          Memory.hblankHdmaSource = hdmaSource;
          Memory.hblankHdmaDestination = hdmaDestination;
          // This will be handled in updateHblankHdma()
          // Since we return false in write traps, we need to now write the byte
          // Be sure to reset bit 7, to show that the hdma is active
          eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, resetBitOnByte(7, hdmaTriggerByteToBeWritten));
      }
      else {
          // General DMA
          hdmaTransfer(hdmaSource, hdmaDestination, transferLength);
          // Stop the DMA
          eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, 0xff);
      }
  }
  function updateHblankHdma() {
      if (!Memory.isHblankHdmaActive) {
          return;
      }
      // Get our amount of bytes to transfer (Only 0x10 bytes at a time)
      let bytesToTransfer = 0x10;
      if (Memory.hblankHdmaTransferLengthRemaining < bytesToTransfer) {
          // Set to the difference
          bytesToTransfer = Memory.hblankHdmaTransferLengthRemaining;
      }
      // Do the transfer (Only 0x10 bytes at a time)
      hdmaTransfer(Memory.hblankHdmaSource, Memory.hblankHdmaDestination, bytesToTransfer);
      // Update our source and destination
      Memory.hblankHdmaSource += bytesToTransfer;
      Memory.hblankHdmaDestination += bytesToTransfer;
      Memory.hblankHdmaTransferLengthRemaining -= bytesToTransfer;
      if (Memory.hblankHdmaTransferLengthRemaining <= 0) {
          // End the transfer
          Memory.isHblankHdmaActive = false;
          // Need to clear the HDMA with 0xFF, which sets bit 7 to 1 to show the HDMA has ended
          eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, 0xff);
      }
      else {
          // Set our new transfer length, make sure it is in the weird format,
          // and make sure bit 7 is 0, to show that the HDMA is Active
          let remainingTransferLength = Memory.hblankHdmaTransferLengthRemaining;
          let transferLengthAsByte = remainingTransferLength / 16 - 1;
          eightBitStoreIntoGBMemory(Memory.memoryLocationHdmaTrigger, resetBitOnByte(7, transferLengthAsByte));
      }
  }
  // Simple Function to transfer the bytes from a destination to a source for a general pourpose or Hblank HDMA
  function hdmaTransfer(hdmaSource, hdmaDestination, transferLength) {
      for (let i = 0; i < transferLength; i++) {
          let sourceByte = eightBitLoadFromGBMemoryWithTraps(hdmaSource + i);
          // get the hdmaDestination with wrapping
          // See issue #61: https://github.com/torch2424/wasmBoy/issues/61
          let hdmaDestinationWithWrapping = hdmaDestination + i;
          while (hdmaDestinationWithWrapping > 0x9fff) {
              // Simply clear the top 3 bits
              hdmaDestinationWithWrapping = hdmaDestinationWithWrapping - 0x2000;
          }
          eightBitStoreIntoGBMemoryWithTraps(hdmaDestinationWithWrapping, sourceByte);
      }
      // Set our Cycles used for the HDMA
      // Since DMA in GBC Double Speed Mode takes 80 micro seconds,
      // And HDMA takes 8 micro seconds per 0x10 bytes in GBC Double Speed mode (and GBC Normal Mode)
      // Will assume (644 / 10) cycles for GBC Double Speed Mode,
      // and (644 / 10 / 2) for GBC Normal Mode
      let hdmaCycles = 32;
      if (Cpu.GBCDoubleSpeed) {
          hdmaCycles = 64;
      }
      hdmaCycles = hdmaCycles * (transferLength / 0x10);
      Memory.DMACycles += hdmaCycles;
  }
  // Function to get our HDMA Source
  // Follows the poan docs
  function getHdmaSourceFromMemory() {
      // Get our source for the HDMA
      let hdmaSourceHigh = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceHigh);
      let hdmaSourceLow = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaSourceLow);
      let hdmaSource = concatenateBytes(hdmaSourceHigh, hdmaSourceLow);
      // And off the appopriate bits for the source and destination
      // And off the bottom 4 bits
      hdmaSource = hdmaSource & 0xfff0;
      return hdmaSource;
  }
  // Function to get our HDMA Destination
  // Follows the poan docs
  function getHdmaDestinationFromMemory() {
      let hdmaDestinationHigh = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationHigh);
      let hdmaDestinationLow = eightBitLoadFromGBMemory(Memory.memoryLocationHdmaDestinationLow);
      let hdmaDestination = concatenateBytes(hdmaDestinationHigh, hdmaDestinationLow);
      // Can only be in VRAM, 0x8000 -> 0x9FF0
      // Pan docs says to knock off upper 3 bits, and lower 4 bits
      // Which gives us: 0001111111110000 or 0x1FF0
      // Meaning we must add 0x8000
      hdmaDestination = hdmaDestination & 0x1ff0;
      hdmaDestination += Memory.videoRamLocation;
      return hdmaDestination;
  }

  // Internal function to trap any modify data trying to be written to Gameboy memory
  // Follows the Gameboy memory map
  // Return true if you want to continue the write, return false to end it here
  function checkWriteTraps(offset, value) {
      // Cpu
      if (offset === Cpu.memoryLocationSpeedSwitch) {
          // TCAGBD, only Bit 0 is writable
          eightBitStoreIntoGBMemory(Cpu.memoryLocationSpeedSwitch, value & 0x01);
          // We did the write, dont need to
          return false;
      }
      // Graphics
      // Cache globals used multiple times for performance
      let videoRamLocation = Memory.videoRamLocation;
      let spriteInformationTableLocation = Memory.spriteInformationTableLocation;
      // Handle banking
      if (offset < videoRamLocation) {
          handleBanking(offset, value);
          return false;
      }
      // Check the graphics mode to see if we can write to VRAM
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
      }
      // Be sure to copy everything in EchoRam to Work Ram
      // Codeslinger: The ECHO memory region (0xE000-0xFDFF) is quite different because any data written here is also written in the equivelent ram memory region 0xC000-0xDDFF.
      // Hence why it is called echo
      if (offset >= Memory.echoRamLocation && offset < spriteInformationTableLocation) {
          let wramOffset = offset - 0x2000;
          eightBitStoreIntoGBMemory(wramOffset, value);
          // Allow the original write, and return since we dont need to look anymore
          return true;
      }
      // Also check for individal writes
      // Can only read/write from OAM During Modes 0 - 1
      // See graphics/lcd.ts
      if (offset >= spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
          // Can only read/write from OAM During Mode 2
          // See graphics/lcd.ts
          if (Lcd.currentLcdMode < 2) {
              return false;
          }
          // Not batch processing here for performance
          // batchProcessGraphics();
          // Allow the original write, and return since we dont need to look anymore
          return true;
      }
      if (offset >= Memory.unusableMemoryLocation && offset <= Memory.unusableMemoryEndLocation) {
          return false;
      }
      // Sound
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
      if (offset >= 0xff10 && offset <= 0xff26) {
          batchProcessAudio();
          return SoundRegisterWriteTraps(offset, value);
      }
      // FF27 - FF2F not used
      // Final Wave Table for Channel 3
      if (offset >= 0xff30 && offset <= 0xff3f) {
          batchProcessAudio();
      }
      // Other Memory effects fomr read/write to Lcd/Graphics
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
          }
          // reset the current scanline if the game tries to write to it
          if (offset === Graphics.memoryLocationScanlineRegister) {
              Graphics.scanlineRegister = 0;
              eightBitStoreIntoGBMemory(offset, 0);
              return false;
          }
          // Cache our coincidence compare
          if (offset === Lcd.memoryLocationCoincidenceCompare) {
              Lcd.coincidenceCompare = value;
              return true;
          }
          // Do the direct memory access transfer for spriteInformationTable
          // Check the graphics mode to see if we can write to VRAM
          // http://gbdev.gg8.se/wiki/articles/Video_Display#Accessing_VRAM_and_OAM
          if (offset === Graphics.memoryLocationDmaTransfer) {
              // otherwise, perform a DMA transfer
              // And allow the original write
              startDmaTransfer(value);
              return true;
          }
          // Scroll and Window XY
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
          }
          // Allow the original write, and return since we dont need to look anymore
          return true;
      }
      // Do an HDMA
      if (offset === Memory.memoryLocationHdmaTrigger) {
          startHdmaTransfer(value);
          return false;
      }
      // Don't allow banking if we are doing an Hblank HDM transfer
      // https://gist.github.com/drhelius/3394856
      if (offset === Memory.memoryLocationGBCWRAMBank || offset === Memory.memoryLocationGBCVRAMBank) {
          if (Memory.isHblankHdmaActive) {
              if ((Memory.hblankHdmaSource >= 0x4000 && Memory.hblankHdmaSource <= 0x7fff) ||
                  (Memory.hblankHdmaSource >= 0xd000 && Memory.hblankHdmaSource <= 0xdfff)) {
                  return false;
              }
          }
      }
      // Handle GBC Pallete Write
      if (offset >= Palette.memoryLocationBackgroundPaletteIndex && offset <= Palette.memoryLocationSpritePaletteData) {
          // Incremeenting the palette handled by the write
          writeColorPaletteToMemory(offset, value);
          return true;
      }
      // Handle timer writes
      if (offset >= Timers.memoryLocationDividerRegister && offset <= Timers.memoryLocationTimerControl) {
          // Batch Process
          batchProcessTimers();
          switch (offset) {
              case Timers.memoryLocationDividerRegister:
                  Timers.updateDividerRegister(value);
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
      }
      // Handle Joypad writes for HW reg caching
      if (offset === Joypad.memoryLocationJoypadRegister) {
          Joypad.updateJoypad(value);
      }
      // Handle Interrupt writes
      if (offset === Interrupts.memoryLocationInterruptRequest) {
          Interrupts.updateInterruptRequested(value);
          return true;
      }
      if (offset === Interrupts.memoryLocationInterruptEnabled) {
          Interrupts.updateInterruptEnabled(value);
          return true;
      }
      // Allow the original write
      return true;
  }

  // WasmBoy memory map:
  // Private function to translate a offset meant for the gameboy memory map
  // To the wasmboy memory map
  // Following: http://gameboy.mongenel.com/dmg/asmmemmap.html
  // And https://github.com/Dooskington/GameLad/wiki/Part-11---Memory-Bank-Controllers
  // Performance help from @dcodeIO, and awesome-gbdev
  function getWasmBoyOffsetFromGameBoyOffset(gameboyOffset) {
      // Get the top byte and switch
      let gameboyOffsetHighByte = gameboyOffset >> 12;
      switch (gameboyOffsetHighByte) {
          case 0x00:
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
              let vramBankId = 0;
              if (Cpu.GBCEnabled) {
                  // Find our current VRAM Bank
                  vramBankId = eightBitLoadFromGBMemory(Memory.memoryLocationGBCVRAMBank) & 0x01;
                  // Even though We added another 0x2000, the Cartridge ram is pulled out of our Internal Memory Space
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
              let wramBankId = 0;
              if (Cpu.GBCEnabled) {
                  wramBankId = eightBitLoadFromGBMemory(Memory.memoryLocationGBCWRAMBank) & 0x07;
              }
              if (wramBankId < 1) {
                  wramBankId = 1;
              }
              // (0x1000 * (wramBankId - 1)) -> To find the correct wram bank.
              // wramBankId - 1, because we alreayd have the space for wramBank 1, and are currently in it
              // So need to address space for 6 OTHER banks
              return gameboyOffset - Memory.internalRamBankZeroLocation + WORK_RAM_LOCATION + 0x1000 * (wramBankId - 1);
          default:
              // Everything Else after Gameboy Ram Banks
              // 0xE000 -> 0x000400
              // 0x6000 For the Extra WRAM Banks
              return gameboyOffset - Memory.echoRamLocation + OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION;
      }
  }

  // Store / Write memory access
  function eightBitStoreIntoGBMemory(gameboyOffset, value) {
      store(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset), value);
  }
  function eightBitStoreIntoGBMemoryWithTraps(offset, value) {
      if (checkWriteTraps(offset, value)) {
          eightBitStoreIntoGBMemory(offset, value);
      }
  }
  function sixteenBitStoreIntoGBMemoryWithTraps(offset, value) {
      // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
      // Split the value into two seperate bytes
      let highByte = splitHighByte(value);
      let lowByte = splitLowByte(value);
      let nextOffset = offset + 1;
      if (checkWriteTraps(offset, lowByte)) {
          eightBitStoreIntoGBMemory(offset, lowByte);
      }
      if (checkWriteTraps(nextOffset, highByte)) {
          eightBitStoreIntoGBMemory(nextOffset, highByte);
      }
  }
  function sixteenBitStoreIntoGBMemory(offset, value) {
      // Dividing into two seperate eight bit calls to help with debugging tilemap overwrites
      // Split the value into two seperate bytes
      let highByte = splitHighByte(value);
      let lowByte = splitLowByte(value);
      let nextOffset = offset + 1;
      eightBitStoreIntoGBMemory(offset, lowByte);
      eightBitStoreIntoGBMemory(nextOffset, highByte);
  }
  function storeBooleanDirectlyToWasmMemory(offset, value) {
      if (value) {
          store(offset, 0x01);
      }
      else {
          store(offset, 0x00);
      }
  }

  // Funcitons for setting and checking the LCD
  class Lcd {
      // Function called in write traps to update our hardware registers
      static updateLcdStatus(value) {
          // Bottom three bits are read only
          let currentLcdStatus = eightBitLoadFromGBMemory(Lcd.memoryLocationLcdStatus);
          let valueNoBottomBits = value & 0xf8;
          let lcdStatusOnlyBottomBits = currentLcdStatus & 0x07;
          value = valueNoBottomBits | lcdStatusOnlyBottomBits;
          // Top bit is always 1
          value = setBitOnByte(7, value);
          eightBitStoreIntoGBMemory(Lcd.memoryLocationLcdStatus, value);
      }
      // Function called in write traps to update our hardware registers
      static updateLcdControl(value) {
          Lcd.enabled = checkBitOnByte(7, value);
          Lcd.windowTileMapDisplaySelect = checkBitOnByte(6, value);
          Lcd.windowDisplayEnabled = checkBitOnByte(5, value);
          Lcd.bgWindowTileDataSelect = checkBitOnByte(4, value);
          Lcd.bgTileMapDisplaySelect = checkBitOnByte(3, value);
          Lcd.tallSpriteSize = checkBitOnByte(2, value);
          Lcd.spriteDisplayEnable = checkBitOnByte(1, value);
          Lcd.bgDisplayEnabled = checkBitOnByte(0, value);
      }
  }
  // Memory Locations
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
  Lcd.coincidenceCompare = 0;
  // Also known as LCDC
  // http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
  // Bit 7 - LCD Display Enable (0=Off, 1=On)
  // Bit 6 - Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
  // Bit 5 - Window Display Enable (0=Off, 1=On)
  // Bit 4 - BG & Window Tile Data Select (0=8800-97FF, 1=8000-8FFF)
  // Bit 3 - BG Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
  // Bit 2 - OBJ (Sprite) Size (0=8x8, 1=8x16)
  // Bit 1 - OBJ (Sprite) Display Enable (0=Off, 1=On)
  // Bit 0 - BG Display (for CGB see below) (0=Off, 1=On
  Lcd.memoryLocationLcdControl = 0xff40;
  // Decoupled LCDC for caching
  Lcd.enabled = true;
  Lcd.windowTileMapDisplaySelect = false;
  Lcd.windowDisplayEnabled = false;
  Lcd.bgWindowTileDataSelect = false;
  Lcd.bgTileMapDisplaySelect = false;
  Lcd.tallSpriteSize = false;
  Lcd.spriteDisplayEnable = false;
  Lcd.bgDisplayEnabled = false;
  // Pass in the lcd status for performance
  function setLcdStatus() {
      // Check if the Lcd was disabled
      if (!Lcd.enabled) {
          // Reset scanline cycle counter
          Graphics.scanlineCycleCounter = 0;
          Graphics.scanlineRegister = 0;
          eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, 0);
          // Set to mode 0
          // https://www.reddit.com/r/EmuDev/comments/4w6479/gb_dr_mario_level_generation_issues/
          let lcdStatus = eightBitLoadFromGBMemory(Lcd.memoryLocationLcdStatus);
          lcdStatus = resetBitOnByte(1, lcdStatus);
          lcdStatus = resetBitOnByte(0, lcdStatus);
          Lcd.currentLcdMode = 0;
          // Store the status in memory
          eightBitStoreIntoGBMemory(Lcd.memoryLocationLcdStatus, lcdStatus);
          return;
      }
      // Get our current scanline, and lcd mode
      let scanlineRegister = Graphics.scanlineRegister;
      let lcdMode = Lcd.currentLcdMode;
      // Default to  H-Blank
      let newLcdMode = 0;
      // Find our newLcd mode
      if (scanlineRegister >= 144) {
          // VBlank mode
          newLcdMode = 1;
      }
      else {
          if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_SPRITES_LCD_MODE()) {
              // Searching Sprites Atts
              newLcdMode = 2;
          }
          else if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE()) {
              // Transferring data to lcd
              newLcdMode = 3;
          }
      }
      if (lcdMode !== newLcdMode) {
          // Get our lcd status
          let lcdStatus = eightBitLoadFromGBMemory(Lcd.memoryLocationLcdStatus);
          // Save our lcd mode
          Lcd.currentLcdMode = newLcdMode;
          let shouldRequestInterrupt = false;
          // Set our LCD Statuc accordingly
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
          }
          // Check if we want to request an interrupt, and we JUST changed modes
          if (shouldRequestInterrupt) {
              requestLcdInterrupt();
          }
          // Check for updating the Hblank HDMA
          if (newLcdMode === 0) {
              // Update the Hblank DMA, will simply return if not active
              updateHblankHdma();
          }
          // Check for requesting a VBLANK interrupt
          if (newLcdMode === 1) {
              requestVBlankInterrupt();
          }
          // Check for the coincidence flag
          // Need to check on every mode, and not just HBLANK, as checking on hblank breaks shantae, which checks on vblank
          let coincidenceCompare = Lcd.coincidenceCompare;
          if ((newLcdMode === 0 || newLcdMode === 1) && scanlineRegister === coincidenceCompare) {
              lcdStatus = setBitOnByte(2, lcdStatus);
              if (checkBitOnByte(6, lcdStatus)) {
                  requestLcdInterrupt();
              }
          }
          else {
              lcdStatus = resetBitOnByte(2, lcdStatus);
          }
          // Finally, save our status
          eightBitStoreIntoGBMemory(Lcd.memoryLocationLcdStatus, lcdStatus);
      }
  }

  // Functions for rendering the background
  function renderBackground(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation) {
      // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.
      // Get our scrollX and scrollY (u16 to play nice with assemblyscript)
      // let scrollX: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollX);
      // let scrollY: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScrollY);
      let scrollX = Graphics.scrollX;
      let scrollY = Graphics.scrollY;
      // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)
      // this is done by getting the current scroll Y position,
      // and adding it do what Y Value the scanline is drawing on the camera.
      let pixelYPositionInMap = scanlineRegister + scrollY;
      // Gameboy camera will "wrap" around the background map,
      // meaning that if the pixelValue is 350, then we need to subtract 256 (decimal) to get it's actual value
      // pixel values (scrollX and scrollY) range from 0x00 - 0xFF
      if (pixelYPositionInMap >= 0x100) {
          pixelYPositionInMap -= 0x100;
      }
      // Draw the Background scanline
      drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, 0, scrollX);
  }
  function renderWindow(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation) {
      // Get our windowX and windowY
      // let windowX: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowX);
      // let windowY: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationWindowY);
      let windowX = Graphics.windowX;
      let windowY = Graphics.windowY;
      // NOTE: Camera is reffering to what you can see inside the 160x144 viewport of the entire rendered 256x256 map.
      // First ensure that the scanline is greater than our window
      if (scanlineRegister < windowY) {
          // Window is not within the current camera view
          return;
      }
      // WindowX is offset by 7
      windowX = windowX - 7;
      // Get our current pixel y positon on the 160x144 camera (Row that the scanline draws across)
      let pixelYPositionInMap = scanlineRegister - windowY;
      // xOffset is simply a neagative window x
      let xOffset = -1 * windowX;
      // Draw the Background scanline
      drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, windowX, xOffset);
  }
  // Function frankenstein'd together to allow background and window to share the same draw scanline function
  function drawBackgroundWindowScanline(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation, pixelYPositionInMap, iStart, xOffset) {
      // Get our tile Y position in the map
      let tileYPositionInMap = pixelYPositionInMap >> 3;
      // Loop through x to draw the line like a CRT
      for (let i = iStart; i < 160; i++) {
          // Get our Current X position of our pixel on the on the 160x144 camera
          // this is done by getting the current scroll X position,
          // and adding it do what X Value the scanline is drawing on the camera.
          let pixelXPositionInMap = i + xOffset;
          // This is to compensate wrapping, same as pixelY
          if (pixelXPositionInMap >= 0x100) {
              pixelXPositionInMap -= 0x100;
          }
          // Divide our pixel position by 8 to get our tile.
          // Since, there are 256x256 pixels, and 32x32 tiles.
          // 256 / 8 = 32.
          // Also, bitshifting by 3, do do a division by 8
          // Need to use u16s, as they will be used to compute an address, which will cause weird errors and overflows
          let tileXPositionInMap = pixelXPositionInMap >> 3;
          // Get our tile address on the tileMap
          // NOTE: (tileMap represents where each tile is displayed on the screen)
          // NOTE: (tile map represents the entire map, now just what is within the "camera")
          // For instance, if we have y pixel 144. 144 / 8 = 18. 18 * 32 = line address in map memory.
          // And we have x pixel 160. 160 / 8 = 20.
          // * 32, because remember, this is NOT only for the camera, the actual map is 32x32. Therefore, the next tile line of the map, is 32 byte offset.
          // Think like indexing a 2d array, as a 1d array and it make sense :)
          let tileMapAddress = tileMapMemoryLocation + tileYPositionInMap * 32 + tileXPositionInMap;
          // Get the tile Id on the Tile Map
          let tileIdFromTileMap = loadFromVramBank(tileMapAddress, 0);
          // Now that we have our Tile Id, let's check our Tile Cache
          let usedTileCache = false;
          if (Config.tileCaching) {
              let pixelsDrawn = drawLineOfTileFromTileCache(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap);
              // Increment i by 7, not 8 because i will be incremented at end of for loop
              if (pixelsDrawn > 0) {
                  i += pixelsDrawn - 1;
                  usedTileCache = true;
              }
          }
          if (Config.tileRendering && !usedTileCache) {
              let pixelsDrawn = drawLineOfTileFromTileId(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap);
              // A line of a tile is 8 pixels wide, therefore increase i by (pixelsDrawn - 1), and then the for loop will increment by 1
              // For a net increment for 8
              if (pixelsDrawn > 0) {
                  i += pixelsDrawn - 1;
              }
          }
          else if (!usedTileCache) {
              if (Cpu.GBCEnabled) {
                  // Draw the individual pixel
                  drawColorPixelFromTileId(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap);
              }
              else {
                  // Draw the individual pixel
                  drawMonochromePixelFromTileId(i, scanlineRegister, pixelXPositionInMap, pixelYPositionInMap, tileDataMemoryLocation, tileIdFromTileMap);
              }
          }
      }
  }
  // Function to draw a pixel for the standard GB
  function drawMonochromePixelFromTileId(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileDataMemoryLocation, tileIdFromTileMap) {
      // Now we can process the the individual bytes that represent the pixel on a tile
      // Now get our tileDataAddress for the corresponding tileID we found in the map
      // Read the comments in _getTileDataAddress() to see what's going on.
      // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
      // This funcitons returns the start of memory locaiton for the tile 'c'.
      let tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);
      // Get the y pixel of the 8 by 8 tile.
      // Simply modulo the scanline.
      // For instance, let's say we are printing the first line of pixels on our camera,
      // And the first line of pixels on our tile.
      // yPixel = 1. 1 % 8 = 1.
      // And for the last line
      // yPixel = 144. 144 % 8 = 0.
      // 0 Represents last line of pixels in a tile, 1 represents first. 1 2 3 4 5 6 7 0.
      // Because remember, we are counting lines on the display NOT including zero
      let pixelYInTile = pixelYPositionInMap % 8;
      // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
      // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
      // Again, think like you had to map a 2d array as a 1d.
      let byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2, 0);
      let byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, 0);
      // Same logic as pixelYInTile.
      // However, We need to reverse our byte,
      // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
      // Therefore, is pixelX was 2, then really is need to be 5
      // So 2 - 7 = -5, * 1 = 5
      // Or to simplify, 7 - 2 = 5 haha!
      let pixelXInTile = pixelXPositionInMap % 8;
      pixelXInTile = 7 - pixelXInTile;
      // Now we can get the color for that pixel
      // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
      // To Get the color Id.
      // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
      // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
      let paletteColorId = 0;
      if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
          // Byte one represents the second bit in our color id, so bit shift
          paletteColorId += 1;
          paletteColorId = paletteColorId << 1;
      }
      if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
          paletteColorId += 1;
      }
      // Not checking u8 Portability overflow here, since it can't be greater than i32 over :p
      // Now get the colorId from the pallete, to get our final color
      // Developers could change colorIds to represents different colors
      // in their palette, thus we need to grab the color from there
      //let pixelColorInTileFromPalette: u8 = getColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
      // Moved below for perofrmance
      // FINALLY, RENDER THAT PIXEL!
      // Only rendering camera for now, so coordinates are for the camera.
      // Get the rgb value for the color Id, will be repeated into R, G, B
      let monochromeColor = getMonochromeColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
      setPixelOnFrame(xPixel, yPixel, 0, monochromeColor);
      setPixelOnFrame(xPixel, yPixel, 1, monochromeColor);
      setPixelOnFrame(xPixel, yPixel, 2, monochromeColor);
      // Lastly, add the pixel to our background priority map
      // https://github.com/torch2424/wasmBoy/issues/51
      // Bits 0 & 1 will represent the color Id drawn by the BG/Window
      // Bit 2 will represent if the Bg/Window has GBC priority.
      addPriorityforPixel(xPixel, yPixel, paletteColorId);
  }
  // Function to draw a pixel from a tile in C O L O R
  // See above for more context on some variables
  function drawColorPixelFromTileId(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap) {
      // Now get our tileDataAddress for the corresponding tileID we found in the map
      // Read the comments in _getTileDataAddress() to see what's going on.
      // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
      // This funcitons returns the start of memory locaiton for the tile 'c'.
      let tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);
      // Get the GB Map Attributes
      // Bit 0-2  Background Palette number  (BGP0-7)
      // Bit 3    Tile VRAM Bank number      (0=Bank 0, 1=Bank 1)
      // Bit 4    Not used
      // Bit 5    Horizontal Flip            (0=Normal, 1=Mirror horizontally)
      // Bit 6    Vertical Flip              (0=Normal, 1=Mirror vertically)
      // Bit 7    BG-to-OAM Priority         (0=Use OAM priority bit, 1=BG Priority)
      let bgMapAttributes = loadFromVramBank(tileMapAddress, 1);
      // See above for explanation
      let pixelYInTile = pixelYPositionInMap % 8;
      if (checkBitOnByte(6, bgMapAttributes)) {
          // We are mirroring the tile, therefore, we need to opposite byte
          // So if our pixel was 0 our of 8, it wild become 7 :)
          pixelYInTile = 7 - pixelYInTile;
      }
      // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
      // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
      // But we need to load the time from a specific Vram bank
      let vramBankId = 0;
      if (checkBitOnByte(3, bgMapAttributes)) {
          vramBankId = 1;
      }
      let byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2, vramBankId);
      let byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, vramBankId);
      // Get our X pixel. Need to NOT reverse it if it was flipped.
      // See above, you have to reverse this normally
      let pixelXInTile = pixelXPositionInMap % 8;
      if (!checkBitOnByte(5, bgMapAttributes)) {
          pixelXInTile = 7 - pixelXInTile;
      }
      // Now we can get the color for that pixel
      // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
      // To Get the color Id.
      // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
      // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
      let paletteColorId = 0;
      if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
          // Byte one represents the second bit in our color id, so bit shift
          paletteColorId += 1;
          paletteColorId = paletteColorId << 1;
      }
      if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
          paletteColorId += 1;
      }
      // Finally lets add some, C O L O R
      // Want the botom 3 bits
      let bgPalette = bgMapAttributes & 0x07;
      // Call the helper function to grab the correct color from the palette
      let rgbColorPalette = getRgbColorFromPalette(bgPalette, paletteColorId, false);
      // Split off into red green and blue
      let red = getColorComponentFromRgb(0, rgbColorPalette);
      let green = getColorComponentFromRgb(1, rgbColorPalette);
      let blue = getColorComponentFromRgb(2, rgbColorPalette);
      // Finally Place our colors on the things
      setPixelOnFrame(xPixel, yPixel, 0, red);
      setPixelOnFrame(xPixel, yPixel, 1, green);
      setPixelOnFrame(xPixel, yPixel, 2, blue);
      // Lastly, add the pixel to our background priority map
      // https://github.com/torch2424/wasmBoy/issues/51
      // Bits 0 & 1 will represent the color Id drawn by the BG/Window
      // Bit 2 will represent if the Bg/Window has GBC priority.
      addPriorityforPixel(xPixel, yPixel, paletteColorId, checkBitOnByte(7, bgMapAttributes));
  }
  // Function to attempt to draw the tile from the tile cache
  function drawLineOfTileFromTileCache(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap) {
      // First, initialize how many pixels we have drawn
      let pixelsDrawn = 0;
      // Check if the current tile matches our tileId
      // TODO: Allow the first line to use the tile cache, for some odd reason it doesn't work when scanline is 0
      if (yPixel > 0 && xPixel > 8 && tileIdFromTileMap === TileCache.tileId && xPixel === TileCache.nextXIndexToPerformCacheCheck) {
          // Was last tile flipped
          let wasLastTileHorizontallyFlipped = false;
          let isCurrentTileHorizontallyFlipped = false;
          if (checkBitOnByte(5, eightBitLoadFromGBMemory(tileMapAddress - 1))) {
              wasLastTileHorizontallyFlipped = true;
          }
          if (checkBitOnByte(5, eightBitLoadFromGBMemory(tileMapAddress))) {
              isCurrentTileHorizontallyFlipped = true;
          }
          // Simply copy the last 8 pixels from memory to copy the line from the tile
          for (let tileCacheIndex = 0; tileCacheIndex < 8; tileCacheIndex++) {
              // Check if we need to render backwards for flipping
              if (wasLastTileHorizontallyFlipped !== isCurrentTileHorizontallyFlipped) {
                  tileCacheIndex = 7 - tileCacheIndex;
              }
              // First check for overflow
              if (xPixel + tileCacheIndex <= 160) {
                  // Get the pixel location in memory of the tile
                  let previousXPixel = xPixel - (8 - tileCacheIndex);
                  let previousTilePixelLocation = FRAME_LOCATION + getRgbPixelStart(xPixel + tileCacheIndex, yPixel);
                  // Cycle through the RGB
                  for (let tileCacheRgb = 0; tileCacheRgb < 3; tileCacheRgb++) {
                      setPixelOnFrame(xPixel + tileCacheIndex, yPixel, tileCacheRgb, load(previousTilePixelLocation + tileCacheRgb));
                  }
                  // Copy the priority for the pixel
                  let pixelPriority = getPriorityforPixel(previousXPixel, yPixel);
                  addPriorityforPixel(xPixel + tileCacheIndex, yPixel, resetBitOnByte(2, pixelPriority), checkBitOnByte(2, pixelPriority));
                  pixelsDrawn++;
              }
          }
      }
      else {
          // Save our current tile Id, and the next x value we should check the x index
          TileCache.tileId = tileIdFromTileMap;
      }
      // Calculate when we should do the tileCache calculation again
      if (xPixel >= TileCache.nextXIndexToPerformCacheCheck) {
          TileCache.nextXIndexToPerformCacheCheck = xPixel + 8;
          let xOffsetTileWidthRemainder = pixelXPositionInMap % 8;
          if (xPixel < xOffsetTileWidthRemainder) {
              TileCache.nextXIndexToPerformCacheCheck += xOffsetTileWidthRemainder;
          }
      }
      return pixelsDrawn;
  }
  // Function to draw a line of a tile in Color
  // This is for tile rendering shortcuts
  function drawLineOfTileFromTileId(xPixel, yPixel, pixelXPositionInMap, pixelYPositionInMap, tileMapAddress, tileDataMemoryLocation, tileIdFromTileMap) {
      // Get the which line of the tile we are rendering
      let tileLineY = pixelYPositionInMap % 8;
      // Now lets find our tileX start and end
      // This is for the case where i = 0, but scroll X was 3.
      // Or i is 157, and our camera is only 160 pixels wide
      let tileXStart = 0;
      if (xPixel == 0) {
          tileXStart = pixelXPositionInMap - (pixelXPositionInMap / 8) * 8;
      }
      let tileXEnd = 7;
      if (xPixel + 8 > 160) {
          tileXEnd = 160 - xPixel;
      }
      // initialize some variables for GBC
      let bgMapAttributes = -1;
      let vramBankId = 0;
      if (Cpu.GBCEnabled) {
          // Get Our GBC properties
          bgMapAttributes = loadFromVramBank(tileMapAddress, 1);
          if (checkBitOnByte(3, bgMapAttributes)) {
              vramBankId = 1;
          }
          if (checkBitOnByte(6, bgMapAttributes)) {
              // We are mirroring the tile, therefore, we need to opposite byte
              // So if our pixel was 0 our of 8, it wild become 7 :)
              tileLineY = 7 - tileLineY;
          }
      }
      // Return the number of pixels drawn
      return drawPixelsFromLineOfTile(tileIdFromTileMap, tileDataMemoryLocation, vramBankId, tileXStart, tileXEnd, tileLineY, xPixel, yPixel, 160, FRAME_LOCATION, false, 0, bgMapAttributes);
  }

  // Functions for rendering the sprites
  function renderSprites(scanlineRegister, useLargerSprites) {
      // Need to loop through all 40 sprites to check their status
      // Going backwards since lower sprites draw over higher ones
      // Will fix dragon warrior 3 intro
      for (let i = 39; i >= 0; i--) {
          // Sprites occupy 4 bytes in the sprite attribute table
          let spriteTableIndex = i * 4;
          // Y positon is offset by 16, X position is offset by 8
          let spriteYPosition = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex);
          let spriteXPosition = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 1);
          let spriteTileId = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 2);
          // Pan docs of sprite attirbute table
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
          spriteXPosition -= 8;
          // Find our sprite height
          let spriteHeight = 8;
          if (useLargerSprites) {
              spriteHeight = 16;
              // @binji says in 8x16 mode, even tileId always drawn first
              // This will fix shantae sprites which always uses odd numbered indexes
              // TODO: Do the actual Pandocs thing:
              // "In 8x16 mode, the lower bit of the tile number is ignored. Ie. the upper 8x8 tile is "NN AND FEh", and the lower 8x8 tile is "NN OR 01h"."
              // So just knock off the last bit? :)
              if (spriteTileId % 2 === 1) {
                  spriteTileId -= 1;
              }
          }
          // Find if our sprite is on the current scanline
          if (scanlineRegister >= spriteYPosition && scanlineRegister < spriteYPosition + spriteHeight) {
              // Then we need to draw the current sprite
              // Get our sprite attributes since we know we shall be drawing the tile
              let spriteAttributes = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 3);
              // Check sprite Priority
              let isSpritePriorityBehindWindowAndBackground = checkBitOnByte(7, spriteAttributes);
              // Check if we should flip the sprite on the x or y axis
              let flipSpriteY = checkBitOnByte(6, spriteAttributes);
              let flipSpriteX = checkBitOnByte(5, spriteAttributes);
              // Find which line on the sprite we are on
              let currentSpriteLine = scanlineRegister - spriteYPosition;
              // If we fliiped the Y axis on our sprite, need to read from memory backwards to acheive the same effect
              if (flipSpriteY) {
                  currentSpriteLine -= spriteHeight;
                  currentSpriteLine = currentSpriteLine * -1;
                  // Bug fix for the flipped flies in link's awakening
                  currentSpriteLine -= 1;
              }
              // Each line of a tile takes two bytes of memory
              currentSpriteLine = currentSpriteLine * 2;
              // Get our sprite tile address, need to also add the current sprite line to get the correct bytes
              let spriteTileAddressStart = getTileDataAddress(Graphics.memoryLocationTileDataSelectOneStart, spriteTileId);
              spriteTileAddressStart = spriteTileAddressStart + currentSpriteLine;
              let spriteTileAddress = spriteTileAddressStart;
              // Find which VRAM Bank to load from
              let vramBankId = 0;
              if (Cpu.GBCEnabled && checkBitOnByte(3, spriteAttributes)) {
                  vramBankId = 1;
              }
              let spriteDataByteOneForLineOfTilePixels = loadFromVramBank(spriteTileAddress, vramBankId);
              let spriteDataByteTwoForLineOfTilePixels = loadFromVramBank(spriteTileAddress + 1, vramBankId);
              // Iterate over the width of our sprite to find our individual pixels
              for (let tilePixel = 7; tilePixel >= 0; tilePixel--) {
                  // Get our spritePixel, and check for flipping
                  let spritePixelXInTile = tilePixel;
                  if (flipSpriteX) {
                      spritePixelXInTile -= 7;
                      spritePixelXInTile = spritePixelXInTile * -1;
                  }
                  // Get the color Id of our sprite, similar to renderBackground()
                  // With the first byte, and second byte lined up method thing
                  // Yes, the second byte comes before the first, see ./background.ts
                  let spriteColorId = 0;
                  if (checkBitOnByte(spritePixelXInTile, spriteDataByteTwoForLineOfTilePixels)) {
                      // Byte one represents the second bit in our color id, so bit shift
                      spriteColorId += 1;
                      spriteColorId = spriteColorId << 1;
                  }
                  if (checkBitOnByte(spritePixelXInTile, spriteDataByteOneForLineOfTilePixels)) {
                      spriteColorId += 1;
                  }
                  // ColorId zero (last two bits of pallette) are transparent
                  // http://gbdev.gg8.se/wiki/articles/Video_Display
                  if (spriteColorId !== 0) {
                      // Find our actual X pixel location on the gameboy "camera" view
                      // This cannot be less than zero, i32 will overflow
                      let spriteXPixelLocationInCameraView = spriteXPosition + (7 - tilePixel);
                      if (spriteXPixelLocationInCameraView >= 0 && spriteXPixelLocationInCameraView <= 160) {
                          // There are two cases where wouldnt draw the pixel on top of the Bg/window
                          // 1. if isSpritePriorityBehindWindowAndBackground, sprite can only draw over color 0
                          // 2. if bit 2 of our priority is set, then BG-to-OAM Priority from pandoc
                          //  is active, meaning BG tile will have priority above all OBJs
                          //  (regardless of the priority bits in OAM memory)
                          // But if GBC and Bit 0 of LCDC is set, we always draw the object
                          let shouldShowFromLcdcPriority = false;
                          let shouldHideFromOamPriority = false;
                          let shouldHideFromBgPriority = false;
                          // LCDC Priority
                          if (Cpu.GBCEnabled && !Lcd.bgDisplayEnabled) {
                              shouldShowFromLcdcPriority = true;
                          }
                          if (!shouldShowFromLcdcPriority) {
                              // Now that we have our coordinates, check for sprite priority
                              // Lets get the priority byte we put in memory
                              let bgPriorityByte = getPriorityforPixel(spriteXPixelLocationInCameraView, scanlineRegister);
                              let bgColorFromPriorityByte = bgPriorityByte & 0x03;
                              // Doing an else if, since either will automatically stop drawing the pixel
                              if (isSpritePriorityBehindWindowAndBackground && bgColorFromPriorityByte > 0) {
                                  // OAM Priority
                                  shouldHideFromOamPriority = true;
                              }
                              else if (Cpu.GBCEnabled && checkBitOnByte(2, bgPriorityByte) && bgColorFromPriorityByte > 0) {
                                  // Bg priority
                                  shouldHideFromBgPriority = true;
                              }
                          }
                          if (shouldShowFromLcdcPriority || (!shouldHideFromOamPriority && !shouldHideFromBgPriority)) {
                              if (!Cpu.GBCEnabled) {
                                  // Get our monochrome color RGB from the current sprite pallete
                                  // Get our sprite pallete
                                  let spritePaletteLocation = Graphics.memoryLocationSpritePaletteOne;
                                  if (checkBitOnByte(4, spriteAttributes)) {
                                      spritePaletteLocation = Graphics.memoryLocationSpritePaletteTwo;
                                  }
                                  let spritePixelColorFromPalette = getMonochromeColorFromPalette(spriteColorId, spritePaletteLocation);
                                  // Finally set the pixel!
                                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 0, spritePixelColorFromPalette);
                                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 1, spritePixelColorFromPalette);
                                  setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 2, spritePixelColorFromPalette);
                              }
                              else {
                                  // Get our RGB Color
                                  // Finally lets add some, C O L O R
                                  // Want the botom 3 bits
                                  let bgPalette = spriteAttributes & 0x07;
                                  // Call the helper function to grab the correct color from the palette
                                  let rgbColorPalette = getRgbColorFromPalette(bgPalette, spriteColorId, true);
                                  // Split off into red green and blue
                                  let red = getColorComponentFromRgb(0, rgbColorPalette);
                                  let green = getColorComponentFromRgb(1, rgbColorPalette);
                                  let blue = getColorComponentFromRgb(2, rgbColorPalette);
                                  // Finally Place our colors on the things
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
  }

  // Main Class and funcitons for rendering the gameboy display
  class Graphics {
      // Number of cycles to run in each batch process
      // This number should be in sync so that graphics doesn't run too many cyles at once
      // and does not exceed the minimum number of cyles for either scanlines, or
      // How often we change the frame, or a channel's update process
      static batchProcessCycles() {
          return Graphics.MAX_CYCLES_PER_SCANLINE();
      }
      // TCAGBD says 456 per scanline, but 153 only a handful
      static MAX_CYCLES_PER_SCANLINE() {
          if (Cpu.GBCDoubleSpeed) {
              if (Graphics.scanlineRegister === 153) {
                  return 8;
              }
              return 912;
          }
          if (Graphics.scanlineRegister === 153) {
              return 4;
          }
          return 456;
      }
      static MIN_CYCLES_SPRITES_LCD_MODE() {
          if (Cpu.GBCDoubleSpeed) {
              // TODO: Confirm these clock cyles, double similar to scanline, which TCAGBD did
              return 752;
          }
          return 376;
      }
      static MIN_CYCLES_TRANSFER_DATA_LCD_MODE() {
          if (Cpu.GBCDoubleSpeed) {
              // TODO: Confirm these clock cyles, double similar to scanline, which TCAGBD did
              return 498;
          }
          return 249;
      }
      // Function to save the state of the class
      static saveState() {
          store(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot), Graphics.scanlineCycleCounter);
          store(getSaveStateMemoryOffset(0x04, Graphics.saveStateSlot), Lcd.currentLcdMode);
          eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, Graphics.scanlineRegister);
      }
      // Function to load the save state from memory
      static loadState() {
          Graphics.scanlineCycleCounter = load(getSaveStateMemoryOffset(0x00, Graphics.saveStateSlot));
          Lcd.currentLcdMode = load(getSaveStateMemoryOffset(0x04, Graphics.saveStateSlot));
          Graphics.scanlineRegister = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
          Lcd.updateLcdControl(eightBitLoadFromGBMemory(Lcd.memoryLocationLcdControl));
      }
  }
  // Current cycles
  // This will be used for batch processing
  Graphics.currentCycles = 0;
  // Count the number of cycles to keep synced with cpu cycles
  // Found GBC cycles by finding clock speed from Gb Cycles
  // See TCAGBD For cycles
  Graphics.scanlineCycleCounter = 0x00;
  // LCD
  // scanlineRegister also known as LY
  // See: http://bgb.bircd.org/pandocs.txt , and search " LY "
  Graphics.memoryLocationScanlineRegister = 0xff44;
  Graphics.scanlineRegister = 0;
  Graphics.memoryLocationDmaTransfer = 0xff46;
  // Scroll and Window
  Graphics.memoryLocationScrollX = 0xff43;
  Graphics.scrollX = 0;
  Graphics.memoryLocationScrollY = 0xff42;
  Graphics.scrollY = 0;
  Graphics.memoryLocationWindowX = 0xff4b;
  Graphics.windowX = 0;
  Graphics.memoryLocationWindowY = 0xff4a;
  Graphics.windowY = 0;
  // Tile Maps And Data
  Graphics.memoryLocationTileMapSelectZeroStart = 0x9800;
  Graphics.memoryLocationTileMapSelectOneStart = 0x9c00;
  Graphics.memoryLocationTileDataSelectZeroStart = 0x8800;
  Graphics.memoryLocationTileDataSelectOneStart = 0x8000;
  // Sprites
  Graphics.memoryLocationSpriteAttributesTable = 0xfe00;
  // Palettes
  Graphics.memoryLocationBackgroundPalette = 0xff47;
  Graphics.memoryLocationSpritePaletteOne = 0xff48;
  Graphics.memoryLocationSpritePaletteTwo = 0xff49;
  // Screen data needs to be stored in wasm memory
  // Save States
  Graphics.saveStateSlot = 1;
  // Batch Process Graphics
  // http://gameboy.mongenel.com/dmg/asmmemmap.html and http://gbdev.gg8.se/wiki/articles/Video_Display
  // Function to batch process our graphics after we skipped so many cycles
  // This is not currently checked in memory read/write
  function batchProcessGraphics() {
      if (Graphics.currentCycles < Graphics.batchProcessCycles()) {
          return;
      }
      while (Graphics.currentCycles >= Graphics.batchProcessCycles()) {
          updateGraphics(Graphics.batchProcessCycles());
          Graphics.currentCycles = Graphics.currentCycles - Graphics.batchProcessCycles();
      }
  }
  function initializeGraphics() {
      // Reset Stateful Variables
      Graphics.currentCycles = 0;
      Graphics.scanlineCycleCounter = 0x00;
      Graphics.scanlineRegister = 0;
      Graphics.scrollX = 0;
      Graphics.scrollY = 0;
      Graphics.windowX = 0;
      Graphics.windowY = 0;
      if (Cpu.GBCEnabled) {
          // Bgb says LY is 90 on boot
          Graphics.scanlineRegister = 0x90;
          eightBitStoreIntoGBMemory(0xff40, 0x91);
          eightBitStoreIntoGBMemory(0xff41, 0x81);
          // 0xFF42 -> 0xFF43 = 0x00
          eightBitStoreIntoGBMemory(0xff44, 0x90);
          // 0xFF45 -> 0xFF46 = 0x00
          eightBitStoreIntoGBMemory(0xff47, 0xfc);
          // 0xFF48 -> 0xFF4B = 0x00
          // GBC VRAM Banks
          eightBitStoreIntoGBMemory(0xff4f, 0x00);
          eightBitStoreIntoGBMemory(0xff70, 0x01);
      }
      else {
          Graphics.scanlineRegister = 0x90;
          eightBitStoreIntoGBMemory(0xff40, 0x91);
          eightBitStoreIntoGBMemory(0xff41, 0x85);
          // 0xFF42 -> 0xFF45 = 0x00
          eightBitStoreIntoGBMemory(0xff46, 0xff);
          eightBitStoreIntoGBMemory(0xff47, 0xfc);
          eightBitStoreIntoGBMemory(0xff48, 0xff);
          eightBitStoreIntoGBMemory(0xff49, 0xff);
          // 0xFF4A -> 0xFF4B = 0x00
          // GBC VRAM Banks
          eightBitStoreIntoGBMemory(0xff4f, 0x00);
          eightBitStoreIntoGBMemory(0xff70, 0x01);
      }
  }
  function updateGraphics(numberOfCycles) {
      if (Lcd.enabled) {
          Graphics.scanlineCycleCounter += numberOfCycles;
          while (Graphics.scanlineCycleCounter >= Graphics.MAX_CYCLES_PER_SCANLINE()) {
              // Reset the scanlineCycleCounter
              // Don't set to zero to catch extra cycles
              Graphics.scanlineCycleCounter -= Graphics.MAX_CYCLES_PER_SCANLINE();
              // Move to next scanline
              // let scanlineRegister: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
              let scanlineRegister = Graphics.scanlineRegister;
              // Check if we've reached the last scanline
              if (scanlineRegister === 144) {
                  // Draw the scanline
                  if (!Config.graphicsDisableScanlineRendering) {
                      _drawScanline(scanlineRegister);
                  }
                  else {
                      _renderEntireFrame();
                  }
                  // Clear the priority map
                  clearPriorityMap();
                  // Reset the tile cache
                  resetTileCache();
              }
              else if (scanlineRegister < 144) {
                  // Draw the scanline
                  if (!Config.graphicsDisableScanlineRendering) {
                      _drawScanline(scanlineRegister);
                  }
              }
              // Post increment the scanline register after drawing
              // TODO: Need to fix graphics timing
              if (scanlineRegister > 153) {
                  // Check if we overflowed scanlines
                  // if so, reset our scanline number
                  scanlineRegister = 0;
              }
              else {
                  scanlineRegister += 1;
              }
              // Store our new scanline value
              Graphics.scanlineRegister = scanlineRegister;
              // eightBitStoreIntoGBMemory(Graphics.memoryLocationScanlineRegister, scanlineRegister);
          }
      }
      // Games like Pokemon crystal want the vblank right as it turns to the value, and not have it increment after
      // It will break and lead to an infinite loop in crystal
      // Therefore, we want to be checking/Setting our LCD status after the scanline updates
      setLcdStatus();
  }
  // TODO: Make this a _drawPixelOnScanline, as values can be updated while drawing a scanline
  function _drawScanline(scanlineRegister) {
      // Get our seleted tile data memory location
      let tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;
      if (Lcd.bgWindowTileDataSelect) {
          tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
      }
      // Check if the background is enabled
      // NOTE: On Gameboy color, Pandocs says this does something completely different
      // LCDC.0 - 2) CGB in CGB Mode: BG and Window Master Priority
      // When Bit 0 is cleared, the background and window lose their priority -
      // the sprites will be always displayed on top of background and window,
      // independently of the priority flags in OAM and BG Map attributes.
      // TODO: Enable this different feature for GBC
      if (Cpu.GBCEnabled || Lcd.bgDisplayEnabled) {
          // Get our map memory location
          let tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;
          if (Lcd.bgTileMapDisplaySelect) {
              tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
          }
          // Finally, pass everything to draw the background
          renderBackground(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
      }
      // Check if the window is enabled, and we are currently
      // Drawing lines on the window
      if (Lcd.windowDisplayEnabled) {
          // Get our map memory location
          let tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;
          if (Lcd.windowTileMapDisplaySelect) {
              tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
          }
          // Finally, pass everything to draw the background
          renderWindow(scanlineRegister, tileDataMemoryLocation, tileMapMemoryLocation);
      }
      if (Lcd.spriteDisplayEnable) {
          // Sprites are enabled, render them!
          renderSprites(scanlineRegister, Lcd.tallSpriteSize);
      }
  }
  // Function to render everything for a frame at once
  // This is to improve performance
  // See above for comments on how things are donw
  function _renderEntireFrame() {
      // Scanline needs to be in sync while we draw, thus, we can't shortcut anymore than here
      for (let i = 0; i <= 144; i++) {
          _drawScanline(i);
      }
  }
  // Function to get the start of a RGB pixel (R, G, B)
  function getRgbPixelStart(x, y) {
      // Get the pixel number
      // let pixelNumber: i32 = (y * 160) + x;
      // Each pixel takes 3 slots, therefore, multiply by 3!
      return (y * 160 + x) * 3;
  }
  // Also need to store current frame in memory to be read by JS
  function setPixelOnFrame(x, y, colorId, color) {
      // Currently only supports 160x144
      // Storing in X, then y
      // So need an offset
      store(FRAME_LOCATION + getRgbPixelStart(x, y) + colorId, color);
  }
  // Function to shortcut the memory map, and load directly from the VRAM Bank
  function loadFromVramBank(gameboyOffset, vramBankId) {
      let wasmBoyAddress = gameboyOffset - Memory.videoRamLocation + GAMEBOY_INTERNAL_MEMORY_LOCATION + 0x2000 * (vramBankId & 0x01);
      return load(wasmBoyAddress);
  }

  // Returns -1 if no trap found, otherwise returns a value that should be fed for the address
  function checkReadTraps(offset) {
      // Cache globals used multiple times for performance
      let videoRamLocation = Memory.videoRamLocation;
      // Try to break early for most common scenario
      if (offset < videoRamLocation) {
          return -1;
      }
      // Check the graphics mode to see if we can read VRAM
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
      }
      // ECHO Ram, E000	FDFF	Mirror of C000~DDFF (ECHO RAM)
      // http://gbdev.gg8.se/wiki/articles/Memory_Map
      if (offset >= Memory.echoRamLocation && offset < Memory.spriteInformationTableLocation) {
          // Simply return the mirror'd value
          return eightBitLoadFromGBMemory(offset - 0x2000);
      }
      // Check for individal writes
      // Can only read/write from OAM During Modes 0 - 1
      // See graphics/lcd.ts
      if (offset >= Memory.spriteInformationTableLocation && offset <= Memory.spriteInformationTableLocationEnd) {
          // Can only read/write from OAM During Mode 2
          // See graphics/lcd.ts
          if (Lcd.currentLcdMode < 2) {
              return 0xff;
          }
          // Not batch processing here for performance
          // batchProcessGraphics();
          return -1;
      }
      // CPU
      if (offset === Cpu.memoryLocationSpeedSwitch) {
          // TCAGBD, only Bit 7 and 0 are readable, all others are 1
          let response = 0xff;
          let currentSpeedSwitchRegister = eightBitLoadFromGBMemory(Cpu.memoryLocationSpeedSwitch);
          if (!checkBitOnByte(0, currentSpeedSwitchRegister)) {
              response = resetBitOnByte(0, response);
          }
          if (!Cpu.GBCDoubleSpeed) {
              response = resetBitOnByte(7, response);
          }
          return response;
      }
      // Graphics
      // Not batch processing here for performance
      // batchProcessGraphics();
      if (offset === Graphics.memoryLocationScanlineRegister) {
          eightBitStoreIntoGBMemory(offset, Graphics.scanlineRegister);
          return Graphics.scanlineRegister;
      }
      // Sound
      // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Registers
      // TODO: Put these bounds on the Sound Class
      if (offset >= 0xff10 && offset <= 0xff26) {
          batchProcessAudio();
          return SoundRegisterReadTraps(offset);
      }
      // FF27 - FF2F not used
      // Final Wave Table for Channel 3
      if (offset >= 0xff30 && offset <= 0xff3f) {
          batchProcessAudio();
          return -1;
      }
      // Timers
      if (offset === Timers.memoryLocationDividerRegister) {
          // Divider register in memory is just the upper 8 bits
          // http://gbdev.gg8.se/wiki/articles/Timer_Obscure_Behaviour
          let upperDividerRegisterBits = splitHighByte(Timers.dividerRegister);
          eightBitStoreIntoGBMemory(offset, upperDividerRegisterBits);
          return upperDividerRegisterBits;
      }
      if (offset === Timers.memoryLocationTimerCounter) {
          eightBitStoreIntoGBMemory(offset, Timers.timerCounter);
          return Timers.timerCounter;
      }
      // Interrupts
      if (offset === Interrupts.memoryLocationInterruptRequest) {
          // TCAGB and BGB say the top 5 bits are always 1.
          return 0xe0 | Interrupts.interruptsRequestedValue;
      }
      // Joypad
      if (offset === Joypad.memoryLocationJoypadRegister) {
          return getJoypadState();
      }
      return -1;
  }

  // Load/Read functionality for memory
  function eightBitLoadFromGBMemory(gameboyOffset) {
      return load(getWasmBoyOffsetFromGameBoyOffset(gameboyOffset));
  }
  function eightBitLoadFromGBMemoryWithTraps(offset) {
      let readTrapResult = checkReadTraps(offset);
      switch (readTrapResult) {
          case -1:
              return eightBitLoadFromGBMemory(offset);
          default:
              return readTrapResult;
      }
  }
  // TODO: Rename this to sixteenBitLoadFromGBMemoryWithTraps
  function sixteenBitLoadFromGBMemory(offset) {
      // Get our low byte
      let lowByte = 0;
      let lowByteReadTrapResult = checkReadTraps(offset);
      switch (lowByteReadTrapResult) {
          case -1:
              lowByte = eightBitLoadFromGBMemory(offset);
              break;
          default:
              lowByte = lowByteReadTrapResult;
              break;
      }
      // Get the next offset for the second byte
      let nextOffset = offset + 1;
      // Get our high byte
      let highByte = 0;
      let highByteReadTrapResult = checkReadTraps(nextOffset);
      switch (highByteReadTrapResult) {
          case -1:
              highByte = eightBitLoadFromGBMemory(nextOffset);
              break;
          default:
              highByte = highByteReadTrapResult;
              break;
      }
      // Concatenate the bytes and return
      return concatenateBytes(highByte, lowByte);
  }
  function loadBooleanDirectlyFromWasmMemory(offset) {
      let booleanAsInt = load(offset);
      if (booleanAsInt > 0) {
          return true;
      }
      return false;
  }

  class Memory {
      // Function to save the state of the class
      static saveState() {
          store(getSaveStateMemoryOffset(0x00, Memory.saveStateSlot), Memory.currentRomBank);
          store(getSaveStateMemoryOffset(0x02, Memory.saveStateSlot), Memory.currentRamBank);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x04, Memory.saveStateSlot), Memory.isRamBankingEnabled);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x05, Memory.saveStateSlot), Memory.isMBC1RomModeEnabled);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x06, Memory.saveStateSlot), Memory.isRomOnly);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x07, Memory.saveStateSlot), Memory.isMBC1);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x08, Memory.saveStateSlot), Memory.isMBC2);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x09, Memory.saveStateSlot), Memory.isMBC3);
          storeBooleanDirectlyToWasmMemory(getSaveStateMemoryOffset(0x0a, Memory.saveStateSlot), Memory.isMBC5);
      }
      // Function to load the save state from memory
      static loadState() {
          Memory.currentRomBank = load(getSaveStateMemoryOffset(0x00, Memory.saveStateSlot));
          Memory.currentRamBank = load(getSaveStateMemoryOffset(0x02, Memory.saveStateSlot));
          Memory.isRamBankingEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x04, Memory.saveStateSlot));
          Memory.isMBC1RomModeEnabled = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x05, Memory.saveStateSlot));
          Memory.isRomOnly = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x06, Memory.saveStateSlot));
          Memory.isMBC1 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x07, Memory.saveStateSlot));
          Memory.isMBC2 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x08, Memory.saveStateSlot));
          Memory.isMBC3 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x09, Memory.saveStateSlot));
          Memory.isMBC5 = loadBooleanDirectlyFromWasmMemory(getSaveStateMemoryOffset(0x0a, Memory.saveStateSlot));
      }
  }
  // ----------------------------------
  // Gameboy Memory Map
  // ----------------------------------
  // https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
  // http://gameboy.mongenel.com/dmg/asmmemmap.html
  // using Arrays, first index is start, second is end
  Memory.cartridgeRomLocation = 0x0000;
  Memory.switchableCartridgeRomLocation = 0x4000;
  Memory.videoRamLocation = 0x8000;
  Memory.cartridgeRamLocation = 0xa000;
  Memory.internalRamBankZeroLocation = 0xc000;
  // This ram bank is switchable
  Memory.internalRamBankOneLocation = 0xd000;
  Memory.echoRamLocation = 0xe000;
  Memory.spriteInformationTableLocation = 0xfe00;
  Memory.spriteInformationTableLocationEnd = 0xfe9f;
  Memory.unusableMemoryLocation = 0xfea0;
  Memory.unusableMemoryEndLocation = 0xfeff;
  // Hardware I/O, 0xFF00 -> 0xFF7F
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
  Memory.isMBC1RomModeEnabled = true;
  // Cartridge Types
  // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
  Memory.isRomOnly = true;
  Memory.isMBC1 = false;
  Memory.isMBC2 = false;
  Memory.isMBC3 = false;
  Memory.isMBC5 = false;
  // DMA
  Memory.memoryLocationHdmaSourceHigh = 0xff51;
  Memory.memoryLocationHdmaSourceLow = 0xff52;
  Memory.memoryLocationHdmaDestinationHigh = 0xff53;
  Memory.memoryLocationHdmaDestinationLow = 0xff54;
  Memory.memoryLocationHdmaTrigger = 0xff55;
  // Cycles accumulated for DMA
  Memory.DMACycles = 0;
  // Boolean we will mirror to indicate if Hdma is active
  Memory.isHblankHdmaActive = false;
  Memory.hblankHdmaTransferLengthRemaining = 0x00;
  // Store the source and destination for performance, and update as needed
  Memory.hblankHdmaSource = 0x00;
  Memory.hblankHdmaDestination = 0x00;
  // GBC Registers
  Memory.memoryLocationGBCVRAMBank = 0xff4f;
  Memory.memoryLocationGBCWRAMBank = 0xff70;
  // Save States
  Memory.saveStateSlot = 4;
  function initializeCartridge() {
      // Reset stateful variables
      Memory.isRamBankingEnabled = false;
      Memory.isMBC1RomModeEnabled = true;
      // Get our game MBC type from the cartridge header
      // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
      let cartridgeType = eightBitLoadFromGBMemory(0x0147);
      // Reset our Cartridge types
      Memory.isRomOnly = false;
      Memory.isMBC1 = false;
      Memory.isMBC2 = false;
      Memory.isMBC3 = false;
      Memory.isMBC5 = false;
      if (cartridgeType === 0x00) {
          Memory.isRomOnly = true;
      }
      else if (cartridgeType >= 0x01 && cartridgeType <= 0x03) {
          Memory.isMBC1 = true;
      }
      else if (cartridgeType >= 0x05 && cartridgeType <= 0x06) {
          Memory.isMBC2 = true;
      }
      else if (cartridgeType >= 0x0f && cartridgeType <= 0x13) {
          Memory.isMBC3 = true;
      }
      else if (cartridgeType >= 0x19 && cartridgeType <= 0x1e) {
          Memory.isMBC5 = true;
      }
      Memory.currentRomBank = 0x01;
      Memory.currentRamBank = 0x00;
  }

  // WasmBoy memory map:

  // Everything Static as class instances just aren't quite there yet
  // https://github.com/AssemblyScript/assemblyscript/blob/master/tests/compiler/showcase.ts
  class Cpu {
      static CLOCK_SPEED() {
          if (Cpu.GBCDoubleSpeed) {
              // 2^23, thanks binji!
              return 8388608;
          }
          return 4194304;
      }
      // Cycles Per Frame = Clock Speed / fps
      // So: 4194304 / 59.73
      static MAX_CYCLES_PER_FRAME() {
          if (Cpu.GBCDoubleSpeed) {
              return 140448;
          }
          return 70224;
      }
      // See section 4.10 of TCAGBD
      // Cpu Halting explained: https://www.reddit.com/r/EmuDev/comments/5ie3k7/infinite_loop_trying_to_pass_blarggs_interrupt/db7xnbe/
      static enableHalt() {
          if (Interrupts.masterInterruptSwitch) {
              Cpu.isHaltNormal = true;
              return;
          }
          let haltTypeValue = Interrupts.interruptsEnabledValue & Interrupts.interruptsRequestedValue & 0x1f;
          if (haltTypeValue === 0) {
              Cpu.isHaltNoJump = true;
              return;
          }
          Cpu.isHaltBug = true;
      }
      static exitHaltAndStop() {
          Cpu.isHaltNoJump = false;
          Cpu.isHaltNormal = false;
          Cpu.isHaltBug = false;
          Cpu.isStopped = false;
      }
      static isHalted() {
          if (Cpu.isHaltNormal || Cpu.isHaltNoJump) {
              return true;
          }
          return false;
      }
      // Function to save the state of the class
      static saveState() {
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
      }
      // Function to load the save state from memory
      static loadState() {
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
      }
  }
  // Status to track if we are in Gameboy Color Mode, and GBC State
  Cpu.GBCEnabled = false;
  // Memory Location for the GBC Speed switch
  // And the current status
  Cpu.memoryLocationSpeedSwitch = 0xff4d;
  Cpu.GBCDoubleSpeed = false;
  // 8-bit Cpu.registers
  Cpu.registerA = 0;
  Cpu.registerB = 0;
  Cpu.registerC = 0;
  Cpu.registerD = 0;
  Cpu.registerE = 0;
  Cpu.registerH = 0;
  Cpu.registerL = 0;
  Cpu.registerF = 0;
  // 16-bit Cpu.registers
  Cpu.stackPointer = 0;
  // Boot rom from 0x00 to 0x99, all games start at 0x100
  Cpu.programCounter = 0x00;
  // Current number of cycles, shouldn't execeed max number of cycles
  Cpu.currentCycles = 0;
  // HALT and STOP instructions need to stop running opcodes, but simply check timers
  // https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
  // Matt said is should work to, so it must work!
  // TCAGBD shows three different HALT states. Therefore, we need to handle each
  Cpu.isHaltNormal = false;
  Cpu.isHaltNoJump = false;
  Cpu.isHaltBug = false;
  Cpu.isStopped = false;
  // Save States
  Cpu.saveStateSlot = 0;
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
      Cpu.isStopped = false;
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
          // Cpu Control Flow
          Cpu.programCounter = 0x100;
          Cpu.stackPointer = 0xfffe;
      }
      else {
          // Cpu Registers
          Cpu.registerA = 0x01;
          Cpu.registerF = 0xb0;
          Cpu.registerB = 0x00;
          Cpu.registerC = 0x13;
          Cpu.registerD = 0x00;
          Cpu.registerE = 0xd8;
          Cpu.registerH = 0x01;
          Cpu.registerL = 0x4d;
          // Cpu Control Flow
          Cpu.programCounter = 0x100;
          Cpu.stackPointer = 0xfffe;
      }
  }

  // Imports
  // General Logic Instructions
  // Such as the ones found on the CB table and 0x40 - 0xBF
  // NOTE: Only CB table uses these for now, was mostly me realizing that I messed up, trying to be all cute and verbose :p
  // NOTE: TODO: Refactor honestly shouldn't take that long, and may happen once assembly script is improved
  function addARegister(register) {
      checkAndSetEightBitHalfCarryFlag(Cpu.registerA, register);
      checkAndSetEightBitCarryFlag(Cpu.registerA, register);
      Cpu.registerA = u8Portable(Cpu.registerA + register);
      if (Cpu.registerA === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
  }
  function addAThroughCarryRegister(register) {
      // Handling flags manually as they require some special overflow
      // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
      // CTRL+F adc
      let result = u8Portable(Cpu.registerA + register + getCarryFlag$$1());
      if ((u8Portable(Cpu.registerA ^ register ^ result) & 0x10) != 0) {
          setHalfCarryFlag(1);
      }
      else {
          setHalfCarryFlag(0);
      }
      let overflowedResult = u16Portable(Cpu.registerA + register + getCarryFlag$$1());
      if ((overflowedResult & 0x100) > 0) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      Cpu.registerA = result;
      if (Cpu.registerA === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
  }
  function subARegister(register) {
      // Need to convert the register on one line, and flip the sign on another
      let negativeRegister = register;
      negativeRegister = negativeRegister * -1;
      checkAndSetEightBitHalfCarryFlag(Cpu.registerA, negativeRegister);
      checkAndSetEightBitCarryFlag(Cpu.registerA, negativeRegister);
      Cpu.registerA = u8Portable(Cpu.registerA - register);
      if (Cpu.registerA === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(1);
  }
  function subAThroughCarryRegister(register) {
      // Handling flags manually as they require some special overflow
      // From: https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js
      // CTRL+F adc
      let result = u8Portable(Cpu.registerA - register - getCarryFlag$$1());
      let carryRegisterCheck = u8Portable((Cpu.registerA ^ register ^ result) & 0x10);
      if (carryRegisterCheck != 0) {
          setHalfCarryFlag(1);
      }
      else {
          setHalfCarryFlag(0);
      }
      let overflowedResult = u16Portable(Cpu.registerA - register - getCarryFlag$$1());
      if ((overflowedResult & 0x100) > 0) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      Cpu.registerA = result;
      if (Cpu.registerA === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(1);
  }
  function andARegister(register) {
      Cpu.registerA = Cpu.registerA & register;
      if (Cpu.registerA === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(1);
      setCarryFlag(0);
  }
  function xorARegister(register) {
      Cpu.registerA = u8Portable(Cpu.registerA ^ register);
      if (Cpu.registerA === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      setCarryFlag(0);
  }
  function orARegister(register) {
      Cpu.registerA = Cpu.registerA | register;
      if (Cpu.registerA === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      setCarryFlag(0);
  }
  function cpARegister(register) {
      // 0xB8 - 0xBF
      // CP B
      // 1  4
      // Z 1 H C
      let negativeRegister = register;
      negativeRegister = negativeRegister * -1;
      checkAndSetEightBitHalfCarryFlag(Cpu.registerA, negativeRegister);
      checkAndSetEightBitCarryFlag(Cpu.registerA, negativeRegister);
      let tempResult = Cpu.registerA + negativeRegister;
      if (tempResult === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(1);
  }
  function rotateRegisterLeft(register) {
      // RLC register 8-bit
      // Z 0 0 C
      if ((register & 0x80) === 0x80) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      register = rotateByteLeft(register);
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      // Set all other flags to zero
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      // Return the register
      return register;
  }
  function rotateRegisterRight(register) {
      // RLC register 8-bit
      // Z 0 0 C
      // Check for the last bit, to see if it will be carried
      if ((register & 0x01) > 0) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      register = rotateByteRight(register);
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      // Return the register
      return register;
  }
  function rotateRegisterLeftThroughCarry(register) {
      // RL register 8-bit
      // Z 0 0 C
      // setting has first bit since we need to use carry
      let hasHighbit = false;
      if ((register & 0x80) === 0x80) {
          hasHighbit = true;
      }
      register = rotateByteLeftThroughCarry(register);
      if (hasHighbit) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return register;
  }
  function rotateRegisterRightThroughCarry(register) {
      // RR register 8-bit
      // Z 0 0 C
      let hasLowBit = false;
      if ((register & 0x01) === 0x01) {
          hasLowBit = true;
      }
      register = rotateByteRightThroughCarry(register);
      if (hasLowBit) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return register;
  }
  function shiftLeftRegister(register) {
      // SLA register 8-bit
      // Z 0 0 C
      let hasHighbit = false;
      if ((register & 0x80) === 0x80) {
          hasHighbit = true;
      }
      register = u8Portable(register << 1);
      if (hasHighbit) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      return register;
  }
  function shiftRightArithmeticRegister(register) {
      // SRA register 8-bit
      // Z 0 0 C
      // NOTE: This C flag may need to be set to 0;
      // This preserves the MSB (Most significant bit)
      let hasHighbit = false;
      if ((register & 0x80) === 0x80) {
          hasHighbit = true;
      }
      let hasLowbit = false;
      if ((register & 0x01) === 0x01) {
          hasLowbit = true;
      }
      register = u8Portable(register >> 1);
      if (hasHighbit) {
          register = register | 0x80;
      }
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      if (hasLowbit) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      return register;
  }
  function swapNibblesOnRegister(register) {
      // SWAP register 8-bit
      // Z 0 0 0
      let highNibble = register & 0xf0;
      let lowNibble = register & 0x0f;
      register = u8Portable((lowNibble << 4) | (highNibble >> 4));
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      setCarryFlag(0);
      return register;
  }
  function shiftRightLogicalRegister(register) {
      // SRA register 8-bit
      // Z 0 0 C
      // NOTE: This C flag may need to be set to 0;
      // This does NOT preserve MSB (most significant bit)
      let hasLowbit = false;
      if ((register & 0x01) === 0x01) {
          hasLowbit = true;
      }
      register = u8Portable(register >> 1);
      if (register === 0) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(0);
      if (hasLowbit) {
          setCarryFlag(1);
      }
      else {
          setCarryFlag(0);
      }
      return register;
  }
  function testBitOnRegister(bitPosition, register) {
      // BIT bitPosition ,register 8-bit
      // Z 0 1 -
      let testByte = 0x01 << bitPosition;
      let result = register & testByte;
      if (result === 0x00) {
          setZeroFlag$$1(1);
      }
      else {
          setZeroFlag$$1(0);
      }
      setSubtractFlag(0);
      setHalfCarryFlag(1);
      return register;
  }
  function setBitOnRegister(bitPosition, bitValue, register) {
      // RES 0,B or SET 0,B depending on bit value
      if (bitValue > 0) {
          let setByte = 0x01 << bitPosition;
          register = register | setByte;
      }
      else {
          // NOT (byte we want)
          // 0000 0100 becomes 1111 1011
          let setByte = ~(0x01 << bitPosition);
          register = register & setByte;
      }
      return register;
  }
  // Private function for our relative jumps
  function relativeJump(value) {
      // Need to convert the value to i8, since in this case, u8 can be negative
      let relativeJumpOffset = i8Portable(value);
      Cpu.programCounter = u16Portable(Cpu.programCounter + relativeJumpOffset);
      // Realtive jump, using bgb debugger
      // and my debugger shows,
      // on JR you need to jump to the relative jump offset,
      // However, if the jump fails (such as conditional), only jump +2 in total
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
  }

  // Imports
  // Handle CB Opcodes
  // NOTE: Program stpes and cycles are standardized depending on the register type
  // NOTE: Doing some funny stuff to get around not having arrays or objects
  function handleCbOpcode(cbOpcode) {
      let numberOfCycles = -1;
      let handledOpcode = false;
      // The result of our cb logic instruction
      let instructionRegisterValue = 0;
      let instructionRegisterResult = 0;
      // Get our register number by modulo 0x08 (number of registers)
      // cbOpcode % 0x08
      let registerNumber = cbOpcode % 0x08;
      // NOTE: registerNumber = register on CB table. Cpu.registerB = 0, Cpu.registerC = 1....Cpu.registerA = 7
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
      }
      // Grab the high nibble to perform skips to speed up performance
      let opcodeHighNibble = cbOpcode & 0xf0;
      opcodeHighNibble = opcodeHighNibble >> 4;
      // Send to the correct function
      switch (opcodeHighNibble) {
          case 0x00:
              if (cbOpcode <= 0x07) {
                  // RLC register 8-bit
                  // Z 0 0 C
                  instructionRegisterResult = rotateRegisterLeft(instructionRegisterValue);
                  handledOpcode = true;
              }
              else if (cbOpcode <= 0x0f) {
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
              }
              else if (cbOpcode <= 0x1f) {
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
              }
              else if (cbOpcode <= 0x2f) {
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
              }
              else if (cbOpcode <= 0x3f) {
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
              }
              else if (cbOpcode <= 0x4f) {
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
              }
              else if (cbOpcode <= 0x5f) {
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
              }
              else if (cbOpcode <= 0x6f) {
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
              }
              else if (cbOpcode <= 0x7f) {
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
              }
              else if (cbOpcode <= 0x8f) {
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
              }
              else if (cbOpcode <= 0x9f) {
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
              }
              else if (cbOpcode <= 0xaf) {
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
              }
              else if (cbOpcode <= 0xbf) {
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
              }
              else if (cbOpcode <= 0xcf) {
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
              }
              else if (cbOpcode <= 0xdf) {
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
              }
              else if (cbOpcode <= 0xef) {
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
              }
              else if (cbOpcode <= 0xff) {
                  // SET 7,register 8-bit
                  // - - - -
                  instructionRegisterResult = setBitOnRegister(7, 1, instructionRegisterValue);
                  handledOpcode = true;
              }
              break;
      }
      // Finally Pass back into the correct register
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
      }
      // Finally our number of cycles
      // Set if we handled the opcode
      if (handledOpcode) {
          numberOfCycles = 4;
      }
      // Return our number of cycles
      return numberOfCycles;
  }

  // Imports
  // Take in any opcode, and decode it, and return the number of cycles
  // Program counter can be gotten from getProgramCounter();
  // Setting return value to i32 instead of u16, as we want to return a negative number on error
  // https://rednex.github.io/rgbds/gbz80.7.html
  // http://pastraiser.com/cpu/gameboy/gameboyopcodes.html
  function executeOpcode$$1(opcode) {
      // Always implement the program counter by one
      // Any other value can just subtract or add however much offset before reaching this line
      Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
      // Check if we are in the halt bug
      if (Cpu.isHaltBug) {
          // Need to not increment program counter,
          // thus, running the next opcode twice
          // E.g
          // 0x76 - halt
          // FA 34 12 - ld a,(1234)
          // Becomes
          // FA FA 34 ld a,(34FA)
          // 12 ld (de),a
          Cpu.programCounter = u16Portable(Cpu.programCounter - 1);
      }
      // Split our opcode into a high nibble to speed up performance
      // Running 255 if statements is slow, even in wasm haha!
      let opcodeHighNibble = opcode & 0xf0;
      opcodeHighNibble = opcodeHighNibble >> 4;
      // NOTE: @binji rule of thumb: it takes 4 cpu cycles to read one byte
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
  }
  // Wrapper functions around loading and storing memory, and syncing those cycles
  function eightBitLoadSyncCycles(gameboyOffset) {
      syncCycles(4);
      return eightBitLoadFromGBMemoryWithTraps(gameboyOffset);
  }
  function eightBitStoreSyncCycles(gameboyOffset, value) {
      syncCycles(4);
      eightBitStoreIntoGBMemoryWithTraps(gameboyOffset, value);
  }
  function sixteenBitLoadSyncCycles(gameboyOffset) {
      syncCycles(8);
      // sixteen bit load has traps even though it has no label
      return sixteenBitLoadFromGBMemory(gameboyOffset);
  }
  function sixteenBitStoreSyncCycles(gameboyOffset, value) {
      syncCycles(8);
      sixteenBitStoreIntoGBMemoryWithTraps(gameboyOffset, value);
  }
  // Functions to access the next operands of a opcode, reffering to them as "dataBytes"
  function getDataByteOne() {
      syncCycles(4);
      return eightBitLoadFromGBMemory(Cpu.programCounter);
  }
  function getDataByteTwo() {
      syncCycles(4);
      return eightBitLoadFromGBMemory(u16Portable(Cpu.programCounter + 1));
  }
  // Get our concatenated databyte one and getDataByteTwo()
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
              // LD BC,d16
              // 3  12
              // 8 cycles
              let concatenatedDataByte = getConcatenatedDataByte();
              Cpu.registerB = splitHighByte(concatenatedDataByte);
              Cpu.registerC = splitLowByte(concatenatedDataByte);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
              return 4;
          case 0x02:
              // LD (BC),A
              // 1  8
              // () means load into address pointed by BC
              // 4 cycles
              eightBitStoreSyncCycles(concatenateBytes(Cpu.registerB, Cpu.registerC), Cpu.registerA);
              return 4;
          case 0x03:
              // INC BC
              // 1  8
              let registerBC3 = concatenateBytes(Cpu.registerB, Cpu.registerC);
              registerBC3++;
              Cpu.registerB = splitHighByte(registerBC3);
              Cpu.registerC = splitLowByte(registerBC3);
              return 8;
          case 0x04:
              // INC B
              // 1  4
              // Z 0 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerB, 1);
              Cpu.registerB = u8Portable(Cpu.registerB + 1);
              if (Cpu.registerB === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              return 4;
          case 0x05:
              // DEC B
              // 1  4
              // Z 1 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerB, -1);
              Cpu.registerB = u8Portable(Cpu.registerB - 1);
              if (Cpu.registerB === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              return 4;
          case 0x06:
              // LD B,d8
              // 2  8
              // 4 cycles
              Cpu.registerB = getDataByteOne();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x07:
              // RLCA
              // 1  4
              // 0 0 0 C
              // Check for the carry
              if ((Cpu.registerA & 0x80) === 0x80) {
                  setCarryFlag(1);
              }
              else {
                  setCarryFlag(0);
              }
              Cpu.registerA = rotateByteLeft(Cpu.registerA);
              // Set all other flags to zero
              setZeroFlag$$1(0);
              setSubtractFlag(0);
              setHalfCarryFlag(0);
              return 4;
          case 0x08:
              // LD (a16),SP
              // 3  20
              // Load the stack pointer into the 16 bit address represented by the two data bytes
              // 16 cycles, 8 from data byte, 8 from sixteenbit store
              sixteenBitStoreSyncCycles(getConcatenatedDataByte(), Cpu.stackPointer);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
              return 4;
          case 0x09:
              // ADD HL,BC
              // 1 8
              // - 0 H C
              let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
              let registerBC9 = concatenateBytes(Cpu.registerB, Cpu.registerC);
              checkAndSetSixteenBitFlagsAddOverflow(registerHL, registerBC9, false);
              let result = u16Portable((registerHL + registerBC9));
              Cpu.registerH = splitHighByte(result);
              Cpu.registerL = splitLowByte(result);
              setSubtractFlag(0);
              return 8;
          case 0x0a:
              // LD A,(BC)
              // 1 8
              // 4 cycles from load
              Cpu.registerA = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerB, Cpu.registerC));
              return 4;
          case 0x0b:
              // DEC BC
              // 1  8
              let registerBCB = concatenateBytes(Cpu.registerB, Cpu.registerC);
              registerBCB = u16Portable(registerBCB - 1);
              Cpu.registerB = splitHighByte(registerBCB);
              Cpu.registerC = splitLowByte(registerBCB);
              return 8;
          case 0x0c:
              // INC C
              // 1  4
              // Z 0 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerC, 1);
              Cpu.registerC = u8Portable(Cpu.registerC + 1);
              if (Cpu.registerC === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              return 4;
          case 0x0d:
              // DEC C
              // 1  4
              // Z 1 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerC, -1);
              Cpu.registerC = u8Portable(Cpu.registerC - 1);
              if (Cpu.registerC === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              return 4;
          case 0x0e:
              // LD C,d8
              // 2 8
              // 4 cycles
              Cpu.registerC = getDataByteOne();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x0f:
              // RRCA
              // 1 4
              // 0 0 0 C
              // Check for the last bit, to see if it will be carried
              if ((Cpu.registerA & 0x01) > 0) {
                  setCarryFlag(1);
              }
              else {
                  setCarryFlag(0);
              }
              Cpu.registerA = rotateByteRight(Cpu.registerA);
              // Set all other flags to zero
              setZeroFlag$$1(0);
              setSubtractFlag(0);
              setHalfCarryFlag(0);
              return 4;
      }
      return -1;
  }
  function handleOpcode1x(opcode) {
      switch (opcode) {
          case 0x10:
              // STOP 0
              // 2 4
              // Enter CPU very low power mode. Also used to switch between double and normal speed CPU modes in GBC.
              // Meaning Don't Decode anymore opcodes , or updated the LCD until joypad interrupt (or when button is pressed if I am wrong)
              // See HALT
              // If we are in gameboy color mode, set the new speed
              if (Cpu.GBCEnabled) {
                  // 4 cycles
                  let speedSwitch = eightBitLoadSyncCycles(Cpu.memoryLocationSpeedSwitch);
                  if (checkBitOnByte(0, speedSwitch)) {
                      // Reset the prepare bit
                      speedSwitch = resetBitOnByte(0, speedSwitch);
                      // Switch to the new mode, and set the speed switch to the OTHER speed, to represent our new speed
                      if (!checkBitOnByte(7, speedSwitch)) {
                          Cpu.GBCDoubleSpeed = true;
                          speedSwitch = setBitOnByte(7, speedSwitch);
                      }
                      else {
                          Cpu.GBCDoubleSpeed = false;
                          speedSwitch = resetBitOnByte(7, speedSwitch);
                      }
                      // Store the final speed switch
                      // 4 cycles
                      eightBitStoreSyncCycles(Cpu.memoryLocationSpeedSwitch, speedSwitch);
                      // Cycle accurate gameboy docs says this takes 76 clocks
                      // 76 - 8 cycles (from load/store) = 68
                      return 68;
                  }
              }
              // NOTE: This breaks Blarggs CPU tests if CGB Stop is not implemented
              Cpu.isStopped = true;
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x11:
              // LD DE,d16
              // 3  12
              // 8 cycles
              let concatenatedDataByte = getConcatenatedDataByte();
              Cpu.registerD = splitHighByte(concatenatedDataByte);
              Cpu.registerE = splitLowByte(concatenatedDataByte);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
              return 4;
          case 0x12:
              // LD (DE),A
              // 1 8
              // 4 cycles
              eightBitStoreSyncCycles(concatenateBytes(Cpu.registerD, Cpu.registerE), Cpu.registerA);
              return 4;
          case 0x13:
              // INC DE
              // 1 8
              let registerDE3 = concatenateBytes(Cpu.registerD, Cpu.registerE);
              registerDE3 = u16Portable(registerDE3 + 1);
              Cpu.registerD = splitHighByte(registerDE3);
              Cpu.registerE = splitLowByte(registerDE3);
              return 8;
          case 0x14:
              // INC D
              // 1  4
              // Z 0 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerD, 1);
              Cpu.registerD = u8Portable(Cpu.registerD + 1);
              if (Cpu.registerD === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              return 4;
          case 0x15:
              // DEC D
              // 1  4
              // Z 1 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerD, -1);
              Cpu.registerD = u8Portable(Cpu.registerD - 1);
              if (Cpu.registerD === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              return 4;
          case 0x16:
              // LD D,d8
              // 2 8
              // 4 cycles
              Cpu.registerD = getDataByteOne();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x17:
              // RLA
              // 1 4
              // 0 0 0 C
              // Check for the carry
              // setting has first bit since we need to use carry
              let hasHighbit = false;
              if ((Cpu.registerA & 0x80) === 0x80) {
                  hasHighbit = true;
              }
              Cpu.registerA = rotateByteLeftThroughCarry(Cpu.registerA);
              // OR the carry flag to the end
              if (hasHighbit) {
                  setCarryFlag(1);
              }
              else {
                  setCarryFlag(0);
              }
              // Set all other flags to zero
              setZeroFlag$$1(0);
              setSubtractFlag(0);
              setHalfCarryFlag(0);
              return 4;
          case 0x18:
              // JR r8
              // 2  12
              // NOTE: Discoved dataByte is signed
              // However the relative Jump Function handles this
              // 4 cycles
              relativeJump(getDataByteOne());
              return 8;
          // Relative Jump Function Handles program counter
          case 0x19:
              // ADD HL,DE
              // 1  8
              // - 0 H C
              let registerHL = concatenateBytes(Cpu.registerH, Cpu.registerL);
              let registerDE9 = concatenateBytes(Cpu.registerD, Cpu.registerE);
              checkAndSetSixteenBitFlagsAddOverflow(registerHL, registerDE9, false);
              let result = u16Portable((registerHL + registerDE9));
              Cpu.registerH = splitHighByte(result);
              Cpu.registerL = splitLowByte(result);
              setSubtractFlag(0);
              return 8;
          case 0x1a:
              // LD A,(DE)
              // 1 8
              let registerDEA = concatenateBytes(Cpu.registerD, Cpu.registerE);
              // 4 cycles
              Cpu.registerA = eightBitLoadSyncCycles(registerDEA);
              return 4;
          case 0x1b:
              // DEC DE
              // 1 8
              let registerDEB = concatenateBytes(Cpu.registerD, Cpu.registerE);
              registerDEB = u16Portable(registerDEB - 1);
              Cpu.registerD = splitHighByte(registerDEB);
              Cpu.registerE = splitLowByte(registerDEB);
              return 8;
          case 0x1c:
              // INC E
              // 1  4
              // Z 0 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerE, 1);
              Cpu.registerE = u8Portable(Cpu.registerE + 1);
              if (Cpu.registerE === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              return 4;
          case 0x1d:
              // DEC E
              // 1  4
              // Z 1 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerE, -1);
              Cpu.registerE = u8Portable(Cpu.registerE - 1);
              if (Cpu.registerE === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              return 4;
          case 0x1e:
              // LD E,d8
              // 2 8
              // 4 cycles
              Cpu.registerE = getDataByteOne();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x1f:
              // RRA
              // 1 4
              // 0 0 0 C
              // Check for the carry
              // setting has low bit since we need to use carry
              let hasLowBit = false;
              if ((Cpu.registerA & 0x01) === 0x01) {
                  hasLowBit = true;
              }
              Cpu.registerA = rotateByteRightThroughCarry(Cpu.registerA);
              if (hasLowBit) {
                  setCarryFlag(1);
              }
              else {
                  setCarryFlag(0);
              }
              // Set all other flags to zero
              setZeroFlag$$1(0);
              setSubtractFlag(0);
              setHalfCarryFlag(0);
              return 4;
      }
      return -1;
  }
  function handleOpcode2x(opcode) {
      switch (opcode) {
          case 0x20:
              // JR NZ,r8
              // 2  12/8
              // NOTE: NZ stands for not [flag], so in this case, not zero flag
              // Also, / means, if condition. so if met, 12 cycles, otherwise 8 cycles
              if (getZeroFlag$$1() === 0) {
                  // 4 cycles
                  relativeJump(getDataByteOne());
                  // Relative Jump Funciton handles program counter
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              }
              return 8;
          case 0x21:
              // LD HL,d16
              // 3  12
              // 8 cycles
              let sixteenBitDataByte = getConcatenatedDataByte();
              Cpu.registerH = splitHighByte(sixteenBitDataByte);
              Cpu.registerL = splitLowByte(sixteenBitDataByte);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
              return 4;
          case 0x22:
              // LD (HL+),A
              // 1 8
              let registerHL2 = concatenateBytes(Cpu.registerH, Cpu.registerL);
              // 4 cycles
              eightBitStoreSyncCycles(registerHL2, Cpu.registerA);
              registerHL2 = u16Portable(registerHL2 + 1);
              Cpu.registerH = splitHighByte(registerHL2);
              Cpu.registerL = splitLowByte(registerHL2);
              return 4;
          case 0x23:
              // INC HL
              // 1  8
              let registerHL3 = concatenateBytes(Cpu.registerH, Cpu.registerL);
              registerHL3 = u16Portable(registerHL3 + 1);
              Cpu.registerH = splitHighByte(registerHL3);
              Cpu.registerL = splitLowByte(registerHL3);
              return 8;
          case 0x24:
              // INC H
              // 1  4
              // Z 0 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerH, 1);
              Cpu.registerH = u8Portable(Cpu.registerH + 1);
              if (Cpu.registerH === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              return 4;
          case 0x25:
              // DEC H
              // 1  4
              // Z 1 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerH, -1);
              Cpu.registerH = u8Portable(Cpu.registerH - 1);
              if (Cpu.registerH === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              return 4;
          case 0x26:
              // LD H,d8
              // 2 8
              // 4 cycles
              Cpu.registerH = getDataByteOne();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x27:
              // DAA
              // 1 4
              // Z - 0 C
              let adjustedRegister = 0;
              let adjustment = 0;
              if (getHalfCarryFlag() > 0) {
                  adjustment = adjustment | 0x06;
              }
              if (getCarryFlag$$1() > 0) {
                  adjustment = adjustment | 0x60;
              }
              if (getSubtractFlag() > 0) {
                  adjustedRegister = u8Portable(Cpu.registerA - adjustment);
              }
              else {
                  if ((Cpu.registerA & 0x0f) > 0x09) {
                      adjustment = adjustment | 0x06;
                  }
                  if (Cpu.registerA > 0x99) {
                      adjustment = adjustment | 0x60;
                  }
                  adjustedRegister = u8Portable(Cpu.registerA + adjustment);
              }
              // Now set our flags to the correct values
              if (adjustedRegister === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              if ((adjustment & 0x60) !== 0) {
                  setCarryFlag(1);
              }
              else {
                  setCarryFlag(0);
              }
              setHalfCarryFlag(0);
              Cpu.registerA = adjustedRegister;
              return 4;
          case 0x28:
              // JR Z,r8
              // 2  12/8
              if (getZeroFlag$$1() > 0) {
                  // 4 cycles
                  relativeJump(getDataByteOne());
                  // Relative Jump funciton handles pogram counter
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              }
              return 8;
          case 0x29:
              // ADD HL,HL
              // 1  8
              // - 0 H C
              let registerHL9 = concatenateBytes(Cpu.registerH, Cpu.registerL);
              checkAndSetSixteenBitFlagsAddOverflow(registerHL9, registerHL9, false);
              registerHL9 = u16Portable(registerHL9 * 2);
              Cpu.registerH = splitHighByte(registerHL9);
              Cpu.registerL = splitLowByte(registerHL9);
              setSubtractFlag(0);
              return 8;
          case 0x2a:
              // LD A,(HL+)
              // 1  8
              let registerHLA = concatenateBytes(Cpu.registerH, Cpu.registerL);
              // 4 cycles
              Cpu.registerA = eightBitLoadSyncCycles(registerHLA);
              registerHLA = u16Portable(registerHLA + 1);
              Cpu.registerH = splitHighByte(registerHLA);
              Cpu.registerL = splitLowByte(registerHLA);
              return 4;
          case 0x2b:
              // DEC HL
              // 1 8
              let registerHLB = concatenateBytes(Cpu.registerH, Cpu.registerL);
              registerHLB = u16Portable(registerHLB - 1);
              Cpu.registerH = splitHighByte(registerHLB);
              Cpu.registerL = splitLowByte(registerHLB);
              return 8;
          case 0x2c:
              // INC L
              // 1  4
              // Z 0 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerL, 1);
              Cpu.registerL = u8Portable(Cpu.registerL + 1);
              if (Cpu.registerL === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              return 4;
          case 0x2d:
              // DEC L
              // 1  4
              // Z 1 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerL, -1);
              Cpu.registerL = u8Portable(Cpu.registerL - 1);
              if (Cpu.registerL === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              return 4;
          case 0x2e:
              // LD L,d8
              // 2  8
              // 4 cycles
              Cpu.registerL = getDataByteOne();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x2f:
              // CPL
              // 1 4
              // - 1 1 -
              Cpu.registerA = ~Cpu.registerA;
              setSubtractFlag(1);
              setHalfCarryFlag(1);
              return 4;
      }
      return -1;
  }
  function handleOpcode3x(opcode) {
      switch (opcode) {
          case 0x30:
              // JR NC,r8
              // 2 12 / 8
              if (getCarryFlag$$1() === 0) {
                  // 4 cycles
                  relativeJump(getDataByteOne());
                  // Relative Jump function handles program counter
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              }
              return 8;
          case 0x31:
              // LD SP,d16
              // 3 12
              // 8 cycles
              Cpu.stackPointer = getConcatenatedDataByte();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
              return 4;
          case 0x32:
              // LD (HL-),A
              // 1 8
              let registerHL2 = concatenateBytes(Cpu.registerH, Cpu.registerL);
              // 4 cycles
              eightBitStoreSyncCycles(registerHL2, Cpu.registerA);
              registerHL2 = u16Portable(registerHL2 - 1);
              Cpu.registerH = splitHighByte(registerHL2);
              Cpu.registerL = splitLowByte(registerHL2);
              return 4;
          case 0x33:
              // INC SP
              // 1 8
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + 1);
              return 8;
          case 0x34:
              // INC (HL)
              // 1  12
              // Z 0 H -
              let registerHL4 = concatenateBytes(Cpu.registerH, Cpu.registerL);
              // 4 cycles
              let valueAtHL4 = eightBitLoadSyncCycles(registerHL4);
              // Creating a varible for this to fix assemblyscript overflow bug
              // Requires explicit casting
              // https://github.com/AssemblyScript/assemblyscript/issues/26
              let incrementer = 1;
              checkAndSetEightBitHalfCarryFlag(valueAtHL4, incrementer);
              valueAtHL4 = u8Portable(valueAtHL4 + incrementer);
              if (valueAtHL4 === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              // 4 cycles
              eightBitStoreSyncCycles(registerHL4, valueAtHL4);
              return 4;
          case 0x35:
              // DEC (HL)
              // 1  12
              // Z 1 H -
              let registerHL5 = concatenateBytes(Cpu.registerH, Cpu.registerL);
              // 4 cycles
              let valueAtHL5 = eightBitLoadSyncCycles(registerHL5);
              // NOTE: This opcode may not overflow correctly,
              // Please see previous opcode
              checkAndSetEightBitHalfCarryFlag(valueAtHL5, -1);
              valueAtHL5 = u8Portable(valueAtHL5 - 1);
              if (valueAtHL5 === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              // 4 cycles
              eightBitStoreSyncCycles(registerHL5, valueAtHL5);
              return 4;
          case 0x36:
              // LD (HL),d8
              // 2  12
              // 8 cycles, 4 from store, 4 from data byte
              eightBitStoreSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL), getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x37:
              // SCF
              // 1  4
              // - 0 0 1
              // Simply set the carry flag
              setSubtractFlag(0);
              setHalfCarryFlag(0);
              setCarryFlag(1);
              return 4;
          case 0x38:
              // JR C,r8
              // 2 12/8
              if (getCarryFlag$$1() === 1) {
                  // 4 cycles
                  relativeJump(getDataByteOne());
                  // Relative Jump Funciton handles program counter
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              }
              return 8;
          case 0x39:
              // ADD HL,SP
              // 1 8
              // - 0 H C
              let registerHL9 = concatenateBytes(Cpu.registerH, Cpu.registerL);
              checkAndSetSixteenBitFlagsAddOverflow(registerHL9, Cpu.stackPointer, false);
              let result = u16Portable((registerHL9 + Cpu.stackPointer));
              Cpu.registerH = splitHighByte(result);
              Cpu.registerL = splitLowByte(result);
              setSubtractFlag(0);
              return 8;
          case 0x3a:
              // LD A,(HL-)
              // 1 8
              let registerHLA = concatenateBytes(Cpu.registerH, Cpu.registerL);
              // 4 cycles
              Cpu.registerA = eightBitLoadSyncCycles(registerHLA);
              registerHLA = u16Portable(registerHLA - 1);
              Cpu.registerH = splitHighByte(registerHLA);
              Cpu.registerL = splitLowByte(registerHLA);
              return 4;
          case 0x3b:
              // DEC SP
              // 1 8
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 1);
              return 8;
          case 0x3c:
              // INC A
              // 1  4
              // Z 0 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerA, 1);
              Cpu.registerA = u8Portable(Cpu.registerA + 1);
              if (Cpu.registerA === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(0);
              return 4;
          case 0x3d:
              // DEC A
              // 1  4
              // Z 1 H -
              checkAndSetEightBitHalfCarryFlag(Cpu.registerA, -1);
              Cpu.registerA = u8Portable(Cpu.registerA - 1);
              if (Cpu.registerA === 0) {
                  setZeroFlag$$1(1);
              }
              else {
                  setZeroFlag$$1(0);
              }
              setSubtractFlag(1);
              return 4;
          case 0x3e:
              // LD A,d8
              // 2 8
              // 4 cycles
              Cpu.registerA = getDataByteOne();
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0x3f:
              // CCF
              // 1 4
              // - 0 0 C
              setSubtractFlag(0);
              setHalfCarryFlag(0);
              if (getCarryFlag$$1() > 0) {
                  setCarryFlag(0);
              }
              else {
                  setCarryFlag(1);
              }
              return 4;
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
              let valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              let valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              let valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              let valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              let valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              let valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              let valueAtHL6 = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              let valueAtHLE = eightBitLoadSyncCycles(concatenateBytes(Cpu.registerH, Cpu.registerL));
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
              // RET NZ
              // 1  20/8
              if (getZeroFlag$$1() === 0) {
                  // 8 cycles
                  Cpu.programCounter = sixteenBitLoadSyncCycles(Cpu.stackPointer);
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
                  return 12;
              }
              else {
                  return 8;
              }
          case 0xc1:
              // POP BC
              // 1  12
              // 8 cycles
              let registerBC1 = sixteenBitLoadSyncCycles(Cpu.stackPointer);
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
              Cpu.registerB = splitHighByte(registerBC1);
              Cpu.registerC = splitLowByte(registerBC1);
              return 4;
          case 0xc2:
              // JP NZ,a16
              // 3  16/12
              if (getZeroFlag$$1() === 0) {
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          case 0xc3:
              // JP a16
              // 3  16
              // 8 cycles
              Cpu.programCounter = getConcatenatedDataByte();
              return 8;
          case 0xc4:
              // CALL NZ,a16
              // 3  24/12
              if (getZeroFlag$$1() === 0) {
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
                  // 8 cycles
                  sixteenBitStoreSyncCycles(Cpu.stackPointer, u16Portable(Cpu.programCounter + 2));
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          case 0xc5:
              // PUSH BC
              // 1  16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, concatenateBytes(Cpu.registerB, Cpu.registerC));
              return 8;
          case 0xc6:
              // ADD A,d8
              // 2 8
              // Z 0 H C
              // 4 cycles
              addARegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xc7:
              // RST 00H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x00;
              return 8;
          case 0xc8:
              // RET Z
              // 1  20/8
              if (getZeroFlag$$1() === 1) {
                  // 8 cycles
                  Cpu.programCounter = sixteenBitLoadSyncCycles(Cpu.stackPointer);
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
                  return 12;
              }
              else {
                  return 8;
              }
          case 0xc9:
              // RET
              // 1 16
              // 8 cycles
              Cpu.programCounter = sixteenBitLoadSyncCycles(Cpu.stackPointer);
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
              return 8;
          case 0xca:
              // JP Z,a16
              // 3 16/12
              if (getZeroFlag$$1() === 1) {
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          case 0xcb:
              // PREFIX CB
              // 1  4
              // 4 cycles
              let cbCycles = handleCbOpcode(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return cbCycles;
          case 0xcc:
              // CALL Z,a16
              // 3  24/12
              if (getZeroFlag$$1() === 1) {
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
                  // 8 cycles
                  sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter + 2);
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          case 0xcd:
              // CALL a16
              // 3  24
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, u16Portable(Cpu.programCounter + 2));
              // 8 cycles
              Cpu.programCounter = getConcatenatedDataByte();
              return 8;
          case 0xce:
              // ADC A,d8
              // 2  8
              // Z 0 H C
              // 4 cycles
              addAThroughCarryRegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xcf:
              // RST 08H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x08;
              return 8;
      }
      return -1;
  }
  function handleOpcodeDx(opcode) {
      switch (opcode) {
          case 0xd0:
              // RET NC
              // 1  20/8
              if (getCarryFlag$$1() === 0) {
                  // 8 cycles
                  Cpu.programCounter = sixteenBitLoadSyncCycles(Cpu.stackPointer);
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
                  return 12;
              }
              else {
                  return 8;
              }
          case 0xd1:
              // POP DE
              // 1  12
              // 8 cycles
              let registerDE1 = sixteenBitLoadSyncCycles(Cpu.stackPointer);
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
              Cpu.registerD = splitHighByte(registerDE1);
              Cpu.registerE = splitLowByte(registerDE1);
              return 4;
          case 0xd2:
              // JP NC,a16
              // 3  16/12
              if (getCarryFlag$$1() === 0) {
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          /* No Opcode for: 0xD3 */
          case 0xd4:
              // CALL NC,a16
              // 3  24/12
              if (getCarryFlag$$1() === 0) {
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
                  // 8 cycles
                  sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter + 2);
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          case 0xd5:
              // PUSH DE
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, concatenateBytes(Cpu.registerD, Cpu.registerE));
              return 8;
          case 0xd6:
              // SUB d8
              // 2  8
              // Z 1 H C
              // 4 cycles
              subARegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xd7:
              // RST 10H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x10;
              return 8;
          case 0xd8:
              // RET C
              // 1  20/8
              if (getCarryFlag$$1() === 1) {
                  // 8 cycles
                  Cpu.programCounter = sixteenBitLoadSyncCycles(Cpu.stackPointer);
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
                  return 12;
              }
              else {
                  return 8;
              }
          case 0xd9:
              // RETI
              // 1  16
              // 8 cycles
              Cpu.programCounter = sixteenBitLoadSyncCycles(Cpu.stackPointer);
              // Enable interrupts
              setInterrupts(true);
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
              return 8;
          case 0xda:
              // JP C,a16
              // 3 16/12
              if (getCarryFlag$$1() === 1) {
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          /* No Opcode for: 0xDB */
          case 0xdc:
              // CALL C,a16
              // 3  24/12
              if (getCarryFlag$$1() === 1) {
                  Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
                  // 8 cycles
                  sixteenBitStoreSyncCycles(Cpu.stackPointer, u16Portable(Cpu.programCounter + 2));
                  // 8 cycles
                  Cpu.programCounter = getConcatenatedDataByte();
                  return 8;
              }
              else {
                  Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
                  return 12;
              }
          /* No Opcode for: 0xDD */
          case 0xde:
              // SBC A,d8
              // 2 8
              // Z 1 H C
              // 4 cycles
              subAThroughCarryRegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xdf:
              // RST 18H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x18;
              return 8;
      }
      return -1;
  }
  function handleOpcodeEx(opcode) {
      switch (opcode) {
          case 0xe0:
              // LDH (a8),A
              // 2  12
              // Store value in high RAM ($FF00 + a8)
              // 4 cycles
              let largeDataByteOne = getDataByteOne();
              // 4 cycles
              eightBitStoreSyncCycles(0xff00 + largeDataByteOne, Cpu.registerA);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xe1:
              // POP HL
              // 1  12
              // 8 cycles
              let registerHL1 = sixteenBitLoadSyncCycles(Cpu.stackPointer);
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
              Cpu.registerH = splitHighByte(registerHL1);
              Cpu.registerL = splitLowByte(registerHL1);
              return 4;
          case 0xe2:
              // LD (C),A
              // 1  8
              // NOTE: Table says 2 Program counter,
              // But stepping through the boot rom, should be one
              // Also should change 0xF2
              // Store value in high RAM ($FF00 + register c)
              // 4 cycles
              eightBitStoreSyncCycles(0xff00 + Cpu.registerC, Cpu.registerA);
              return 4;
          /* No Opcode for: 0xE3, 0xE4 */
          case 0xe5:
              // PUSH HL
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, concatenateBytes(Cpu.registerH, Cpu.registerL));
              return 8;
          case 0xe6:
              // AND d8
              // 2  8
              // Z 0 1 0
              // 4 cycles
              andARegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xe7:
              // RST 20H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x20;
              return 8;
          case 0xe8:
              // ADD SP, r8
              // 2 16
              // 0 0 H C
              // NOTE: Discoved dataByte is signed
              // 4 cycles
              let signedDataByteOne = i8Portable(getDataByteOne());
              checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, signedDataByteOne, true);
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + signedDataByteOne);
              setZeroFlag$$1(0);
              setSubtractFlag(0);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 12;
          case 0xe9:
              // JP HL
              // 1 4
              Cpu.programCounter = concatenateBytes(Cpu.registerH, Cpu.registerL);
              return 4;
          case 0xea:
              // LD (a16),A
              // 3 16
              // 12 cycles, 4 from store, 8 from concatenated data byte
              eightBitStoreSyncCycles(getConcatenatedDataByte(), Cpu.registerA);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
              return 4;
          /* No Opcode for: 0xEB, 0xEC, 0xED */
          case 0xee:
              // XOR d8
              // 2 8
              // Z 0 0 0
              // 4 cycles
              xorARegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xef:
              // RST 28H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x28;
              return 8;
      }
      return -1;
  }
  function handleOpcodeFx(opcode) {
      switch (opcode) {
          case 0xf0:
              // LDH A,(a8)
              // 2 12
              // 4 cycles
              let largeDataByteOne = getDataByteOne();
              // 4 cycles
              Cpu.registerA = u8Portable(eightBitLoadSyncCycles(0xff00 + largeDataByteOne));
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xf1:
              // POP AF
              // 1 12
              // Z N H C (But No work require, flags are already set)
              // 8 cycles
              let registerAF1 = sixteenBitLoadSyncCycles(Cpu.stackPointer);
              Cpu.stackPointer = u16Portable(Cpu.stackPointer + 2);
              Cpu.registerA = splitHighByte(registerAF1);
              Cpu.registerF = splitLowByte(registerAF1);
              return 4;
          case 0xf2:
              // LD A,(C)
              // 1 8
              // 4 cycles
              Cpu.registerA = u8Portable(eightBitLoadSyncCycles(0xff00 + Cpu.registerC));
              return 4;
          case 0xf3:
              // DI
              // 1 4
              setInterrupts(false);
              return 4;
          /* No Opcode for: 0xF4 */
          case 0xf5:
              // PUSH AF
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, concatenateBytes(Cpu.registerA, Cpu.registerF));
              return 8;
          case 0xf6:
              // OR d8
              // 2 8
              // Z 0 0 0
              // 4 cycles
              orARegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xf7:
              // RST 30H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x30;
              return 8;
          case 0xf8:
              // LD HL,SP+r8
              // 2 12
              // 0 0 H C
              // NOTE: Discoved dataByte is signed
              // 4 cycles
              let signedDataByteOne = i8Portable(getDataByteOne());
              // First, let's handle flags
              setZeroFlag$$1(0);
              setSubtractFlag(0);
              checkAndSetSixteenBitFlagsAddOverflow(Cpu.stackPointer, signedDataByteOne, true);
              let registerHL = u16Portable(Cpu.stackPointer + signedDataByteOne);
              Cpu.registerH = splitHighByte(registerHL);
              Cpu.registerL = splitLowByte(registerHL);
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 8;
          case 0xf9:
              // LD SP,HL
              // 1 8
              Cpu.stackPointer = concatenateBytes(Cpu.registerH, Cpu.registerL);
              return 8;
          case 0xfa:
              // LD A,(a16)
              // 3 16
              // 12 cycles, 4 from load, 8 from concatenated data byte
              Cpu.registerA = eightBitLoadSyncCycles(getConcatenatedDataByte());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 2);
              return 4;
          case 0xfb:
              // EI
              // 1 4
              setInterrupts(true);
              return 4;
          /* No Opcode for: 0xFC, 0xFD */
          case 0xfe:
              // CP d8
              // 2 8
              // Z 1 H C
              // 4 cycles
              cpARegister(getDataByteOne());
              Cpu.programCounter = u16Portable(Cpu.programCounter + 1);
              return 4;
          case 0xff:
              // RST 38H
              // 1 16
              Cpu.stackPointer = u16Portable(Cpu.stackPointer - 2);
              // 8 cycles
              sixteenBitStoreSyncCycles(Cpu.stackPointer, Cpu.programCounter);
              Cpu.programCounter = 0x38;
              return 8;
      }
      return -1;
  }

  // NOTE: Code is very verbose, and will have some copy pasta'd lines.

  // Syncing and Tracking executed cycles
  class Cycles {
  }
  // An even number below the max 32 bit integer
  Cycles.cyclesPerCycleSet = 2000000000;
  Cycles.cycleSets = 0;
  Cycles.cycles = 0;
  function getCyclesPerCycleSet() {
      return Cycles.cyclesPerCycleSet;
  }
  function getCycleSets() {
      return Cycles.cycleSets;
  }
  function getCycles() {
      return Cycles.cycles;
  }
  function trackCyclesRan(numberOfCycles) {
      Cycles.cycles += numberOfCycles;
      if (Cycles.cycles >= Cycles.cyclesPerCycleSet) {
          Cycles.cycleSets += 1;
          Cycles.cycles -= Cycles.cyclesPerCycleSet;
      }
  }
  function resetCycles() {
      Cycles.cyclesPerCycleSet = 2000000000;
      Cycles.cycleSets = 0;
      Cycles.cycles = 0;
  }
  // Sync other GB Components with the number of cycles
  function syncCycles(numberOfCycles) {
      // Check if we did a DMA TRansfer, if we did add the cycles
      if (Memory.DMACycles > 0) {
          numberOfCycles += Memory.DMACycles;
          Memory.DMACycles = 0;
      }
      // Finally, Add our number of cycles to the CPU Cycles
      Cpu.currentCycles += numberOfCycles;
      // Check other Gameboy components
      if (!Cpu.isStopped) {
          if (Config.graphicsBatchProcessing) {
              // Need to do this, since a lot of things depend on the scanline
              // Batch processing will simply return if the number of cycles is too low
              Graphics.currentCycles += numberOfCycles;
              batchProcessGraphics();
          }
          else {
              updateGraphics(numberOfCycles);
          }
          if (Config.audioBatchProcessing) {
              Sound.currentCycles += numberOfCycles;
          }
          else {
              updateSound(numberOfCycles);
          }
      }
      if (Config.timersBatchProcessing) {
          // Batch processing will simply return if the number of cycles is too low
          Timers.currentCycles += numberOfCycles;
          batchProcessTimers();
      }
      else {
          updateTimers(numberOfCycles);
      }
      trackCyclesRan(numberOfCycles);
  }

  // Functions involving executing/running the emulator after initializtion
  class Execute {
  }
  // An even number bewlow the max 32 bit integer
  Execute.stepsPerStepSet = 2000000000;
  Execute.stepSets = 0;
  Execute.steps = 0;
  function getStepsPerStepSet() {
      return Execute.stepsPerStepSet;
  }
  function getStepSets() {
      return Execute.stepSets;
  }
  function getSteps() {
      return Execute.steps;
  }
  function trackStepsRan(steps) {
      Execute.steps += steps;
      if (Execute.steps >= Execute.stepsPerStepSet) {
          Execute.stepSets += 1;
          Execute.steps -= Execute.stepsPerStepSet;
      }
  }
  function resetSteps() {
      Execute.stepsPerStepSet = 2000000000;
      Execute.stepSets = 0;
      Execute.steps = 0;
  }
  // // Public funciton to run frames until,
  // the specified number of frames have run or error.
  // Return values:
  // -1 = error
  // 0 = render a frame
  function executeMultipleFrames(numberOfFrames) {
      let frameResponse = 0;
      let framesRun = 0;
      while (framesRun < numberOfFrames && frameResponse >= 0) {
          frameResponse = executeFrame();
          framesRun += 1;
      }
      if (frameResponse < 0) {
          return frameResponse;
      }
      return 0;
  }
  // Public funciton to run opcodes until,
  // a frame is ready, or error.
  // Return values:
  // -1 = error
  // 0 = render a frame
  function executeFrame() {
      return executeUntilCondition(true, -1, -1);
  }
  // Public Function to run opcodes until,
  // a frame is ready, audio bufer is filled, or error
  // -1 = error
  // 0 = render a frame
  // 1 = output audio
  function executeFrameAndCheckAudio(maxAudioBuffer = 0) {
      return executeUntilCondition(true, maxAudioBuffer, -1);
  }
  // Public function to run opcodes until,
  // a breakpoint is reached
  // -1 = error
  // 0 = frame executed
  // 1 = reached breakpoint
  function executeFrameUntilBreakpoint(breakpoint) {
      let response = executeUntilCondition(true, -1, breakpoint);
      // Break point response will be 1 in our case
      if (response === 2) {
          return 1;
      }
      return response;
  }
  // Base function that executes steps, and checks conditions
  // Return values:
  // -1 = error
  // 0 = render a frame
  // 1 = audio buffer reached
  // 2 = reached breakpoint
  function executeUntilCondition(checkMaxCyclesPerFrame = true, maxAudioBuffer = -1, breakpoint = -1) {
      // Common tracking variables
      let numberOfCycles = -1;
      let audioBufferSize = 1024;
      if (maxAudioBuffer > 0) {
          audioBufferSize = maxAudioBuffer;
      }
      else if (maxAudioBuffer < 0) {
          audioBufferSize = -1;
      }
      let errorCondition = false;
      let frameCondition = false;
      let audioBufferCondition = false;
      let breakpointCondition = false;
      while (!errorCondition && !frameCondition && !audioBufferCondition && !breakpointCondition) {
          numberOfCycles = executeStep();
          // Error Condition
          if (numberOfCycles < 0) {
              errorCondition = true;
          }
          else if (Cpu.currentCycles >= Cpu.MAX_CYCLES_PER_FRAME()) {
              frameCondition = true;
          }
          else if (audioBufferSize > -1 && getNumberOfSamplesInAudioBuffer() >= audioBufferSize) {
              audioBufferCondition = true;
          }
          else if (breakpoint > -1 && Cpu.programCounter === breakpoint) {
              breakpointCondition = true;
          }
      }
      // Find our exit reason
      if (frameCondition) {
          // Render a frame
          // Reset our currentCycles
          Cpu.currentCycles -= Cpu.MAX_CYCLES_PER_FRAME();
          return 0;
      }
      if (audioBufferCondition) {
          return 1;
      }
      if (breakpointCondition) {
          // breakpoint
          return 2;
      }
      // TODO: Boot ROM handling
      // There was an error, return -1, and push the program counter back to grab the error opcode
      Cpu.programCounter = u16Portable(Cpu.programCounter - 1);
      return -1;
  }
  // Function to execute an opcode, and update other gameboy hardware.
  // http://www.codeslinger.co.uk/pages/projects/gameboy/beginning.html
  function executeStep() {
      // Set has started to 1 since we ran a emulation step
      setHasCoreStarted(true);
      // Check if we are in the halt bug
      if (Cpu.isHaltBug) {
          // Need to not increment program counter,
          // thus, running the next opcode twice
          // E.g
          // 0x76 - halt
          // FA 34 12 - ld a,(1234)
          // Becomes
          // FA FA 34 ld a,(34FA)
          // 12 ld (de),a
          let haltBugOpcode = eightBitLoadFromGBMemory(Cpu.programCounter);
          // Execute opcode will handle the actual PC behavior
          let haltBugCycles = executeOpcode$$1(haltBugOpcode);
          syncCycles(haltBugCycles);
          Cpu.exitHaltAndStop();
      }
      // Interrupts should be handled before reading an opcode
      // https://github.com/Gekkio/mooneye-gb/blob/master/docs/accuracy.markdown#what-is-the-exact-timing-of-cpu-servicing-an-interrupt
      let interruptCycles = checkInterrupts();
      if (interruptCycles > 0) {
          syncCycles(interruptCycles);
      }
      // Get the opcode, and additional bytes to be handled
      // Number of cycles defaults to 4, because while we're halted, we run 4 cycles (according to matt :))
      let numberOfCycles = 4;
      let opcode = 0;
      // If we are not halted or stopped, run instructions
      // If we are halted, this will be skipped and just sync the 4 cycles
      if (!Cpu.isHalted() && !Cpu.isStopped) {
          opcode = eightBitLoadFromGBMemory(Cpu.programCounter);
          numberOfCycles = executeOpcode$$1(opcode);
      }
      // blarggFixes, don't allow register F to have the bottom nibble
      Cpu.registerF = Cpu.registerF & 0xf0;
      // Check if there was an error decoding the opcode
      if (numberOfCycles <= 0) {
          return numberOfCycles;
      }
      // Sync other GB Components with the number of cycles
      syncCycles(numberOfCycles);
      // Update our steps
      trackStepsRan(1);
      return numberOfCycles;
  }

  // Imports
  // Grow our memory to the specified size
  if (memory.size() < WASMBOY_WASM_PAGES) {
      memory.grow(WASMBOY_WASM_PAGES - memory.size());
  }
  // Function to track if the core has started
  let hasStarted = false;
  function setHasCoreStarted(value) {
      hasStarted = value;
  }
  function hasCoreStarted() {
      if (hasStarted) {
          return 1;
      }
      return 0;
  }
  // Function to configure & initialize wasmboy
  function config(enableBootRom, useGbcWhenAvailable, audioBatchProcessing, graphicsBatchProcessing, timersBatchProcessing, graphicsDisableScanlineRendering, audioAccumulateSamples, tileRendering, tileCaching) {
      // TODO: depending on the boot rom, initialization may be different
      // From: http://www.codeslinger.co.uk/pages/projects/gameboy/hardware.html
      // All values default to zero in memory, so not setting them yet
      // log('initializing (includeBootRom=$0)', 1, enableBootRom);
      if (enableBootRom > 0) {
          Config.enableBootRom = true;
      }
      else {
          Config.enableBootRom = false;
      }
      if (useGbcWhenAvailable > 0) {
          Config.useGbcWhenAvailable = true;
      }
      else {
          Config.useGbcWhenAvailable = false;
      }
      if (audioBatchProcessing > 0) {
          Config.audioBatchProcessing = true;
      }
      else {
          Config.audioBatchProcessing = false;
      }
      if (graphicsBatchProcessing > 0) {
          Config.graphicsBatchProcessing = true;
      }
      else {
          Config.graphicsBatchProcessing = false;
      }
      if (timersBatchProcessing > 0) {
          Config.timersBatchProcessing = true;
      }
      else {
          Config.timersBatchProcessing = false;
      }
      if (graphicsDisableScanlineRendering > 0) {
          Config.graphicsDisableScanlineRendering = true;
      }
      else {
          Config.graphicsDisableScanlineRendering = false;
      }
      if (audioAccumulateSamples > 0) {
          Config.audioAccumulateSamples = true;
      }
      else {
          Config.audioAccumulateSamples = false;
      }
      if (tileRendering > 0) {
          Config.tileRendering = true;
      }
      else {
          Config.tileRendering = false;
      }
      if (tileCaching > 0) {
          Config.tileCaching = true;
      }
      else {
          Config.tileCaching = false;
      }
      initialize();
  }
  // Function to initiialize the core
  function initialize() {
      // Initialization variables from BGB
      // First, try to switch to Gameboy Color Mode
      // Get our GBC support from the cartridge header
      // http://gbdev.gg8.se/wiki/articles/The_Cartridge_Header
      let gbcType = eightBitLoadFromGBMemory(0x0143);
      // Detecting GBC http://bgb.bircd.org/pandocs.htm#cgbregisters
      if (gbcType === 0xc0 || (Config.useGbcWhenAvailable && gbcType === 0x80)) {
          Cpu.GBCEnabled = true;
      }
      else {
          Cpu.GBCEnabled = false;
      }
      // Call our respective classes intialization
      initializeCpu();
      initializeCartridge();
      initializeDma();
      initializeGraphics();
      initializePalette();
      initializeSound();
      initializeInterrupts();
      initializeTimers();
      // Various Other Registers
      if (Cpu.GBCEnabled) {
          // Various other registers
          eightBitStoreIntoGBMemory(0xff70, 0xf8);
          eightBitStoreIntoGBMemory(0xff4f, 0xfe);
          eightBitStoreIntoGBMemory(0xff4d, 0x7e);
          eightBitStoreIntoGBMemory(0xff00, 0xcf);
          // FF01 = 0x00
          eightBitStoreIntoGBMemory(0xff02, 0x7c);
          eightBitStoreIntoGBMemory(0xff0f, 0xe1);
          // 0xFFFF = 0x00
          // Undocumented from Pandocs
          eightBitStoreIntoGBMemory(0xff6c, 0xfe);
          eightBitStoreIntoGBMemory(0xff75, 0x8f);
      }
      else {
          eightBitStoreIntoGBMemory(0xff70, 0xff);
          eightBitStoreIntoGBMemory(0xff4f, 0xff);
          eightBitStoreIntoGBMemory(0xff4d, 0xff);
          eightBitStoreIntoGBMemory(0xff00, 0xcf);
          // FF01 = 0x00
          eightBitStoreIntoGBMemory(0xff02, 0x7e);
          eightBitStoreIntoGBMemory(0xff0f, 0xe1);
          // 0xFFFF = 0x00
      }
      // Reset hasStarted, since we are now reset
      setHasCoreStarted(false);
      // Reset our cycles ran
      resetCycles();
      resetSteps();
  }
  // Function to return an address to store into save state memory
  // this is to regulate our 20 slots
  // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
  function getSaveStateMemoryOffset(offset, saveStateSlot) {
      // 50 bytes per save state memory partiton sli32
      return WASMBOY_STATE_LOCATION + offset + 50 * saveStateSlot;
  }
  // Function to save state to memory for all of our classes
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
      Channel4.saveState();
      // Reset hasStarted, since we are now reset
      setHasCoreStarted(false);
      // Don't want to reset cycles here, as this does not reset the emulator
  }
  // Function to load state from memory for all of our classes
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
      Channel4.loadState();
      // Reset hasStarted, since we are now reset
      setHasCoreStarted(false);
      // Reset our cycles ran
      resetCycles();
      resetSteps();
  }

  // Functions to get information about the emulator for debugging purposes
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
  }

  // Functions to debug graphical output
  // Some Simple internal getters
  function getLY() {
      return Graphics.scanlineRegister;
  }
  function drawBackgroundMapToWasmMemory(showColor = 0) {
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
      let tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;
      if (Lcd.bgWindowTileDataSelect) {
          tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
      }
      let tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectZeroStart;
      if (Lcd.bgTileMapDisplaySelect) {
          tileMapMemoryLocation = Graphics.memoryLocationTileMapSelectOneStart;
      }
      for (let y = 0; y < 256; y++) {
          for (let x = 0; x < 256; x++) {
              // Get our current Y
              let pixelYPositionInMap = y;
              // Get our Current X position of our pixel on the on the 160x144 camera
              // this is done by getting the current scroll X position,
              // and adding it do what X Value the scanline is drawing on the camera.
              let pixelXPositionInMap = x;
              // Divide our pixel position by 8 to get our tile.
              // Since, there are 256x256 pixels, and 32x32 tiles.
              // 256 / 8 = 32.
              // Also, bitshifting by 3, do do a division by 8
              // Need to use u16s, as they will be used to compute an address, which will cause weird errors and overflows
              let tileXPositionInMap = pixelXPositionInMap >> 3;
              let tileYPositionInMap = pixelYPositionInMap >> 3;
              // Get our tile address on the tileMap
              // NOTE: (tileMap represents where each tile is displayed on the screen)
              // NOTE: (tile map represents the entire map, now just what is within the "camera")
              // For instance, if we have y pixel 144. 144 / 8 = 18. 18 * 32 = line address in map memory.
              // And we have x pixel 160. 160 / 8 = 20.
              // * 32, because remember, this is NOT only for the camera, the actual map is 32x32. Therefore, the next tile line of the map, is 32 byte offset.
              // Think like indexing a 2d array, as a 1d array and it make sense :)
              let tileMapAddress = tileMapMemoryLocation + tileYPositionInMap * 32 + tileXPositionInMap;
              // Get the tile Id on the Tile Map
              let tileIdFromTileMap = loadFromVramBank(tileMapAddress, 0);
              // Now get our tileDataAddress for the corresponding tileID we found in the map
              // Read the comments in _getTileDataAddress() to see what's going on.
              // tl;dr if we had the tile map of "a b c d", and wanted tileId 2.
              // This funcitons returns the start of memory locaiton for the tile 'c'.
              let tileDataAddress = getTileDataAddress(tileDataMemoryLocation, tileIdFromTileMap);
              // Now we can process the the individual bytes that represent the pixel on a tile
              // Get the y pixel of the 8 by 8 tile.
              // Simply modulo the scanline.
              // For instance, let's say we are printing the first line of pixels on our camera,
              // And the first line of pixels on our tile.
              // yPixel = 1. 1 % 8 = 1.
              // And for the last line
              // yPixel = 144. 144 % 8 = 0.
              // 0 Represents last line of pixels in a tile, 1 represents first. 1 2 3 4 5 6 7 0.
              // Because remember, we are counting lines on the display NOT including zero
              let pixelYInTile = pixelYPositionInMap % 8;
              // Same logic as pixelYInTile.
              // However, We need to reverse our byte,
              // As pixel 0 is on byte 7, and pixel 1 is on byte 6, etc...
              // Therefore, is pixelX was 2, then really is need to be 5
              // So 2 - 7 = -5, * 1 = 5
              // Or to simplify, 7 - 2 = 5 haha!
              let pixelXInTile = pixelXPositionInMap % 8;
              pixelXInTile = 7 - pixelXInTile;
              // Get the GB Map Attributes
              // Bit 0-2  Background Palette number  (BGP0-7)
              // Bit 3    Tile VRAM Bank number      (0=Bank 0, 1=Bank 1)
              // Bit 4    Not used
              // Bit 5    Horizontal Flip            (0=Normal, 1=Mirror horizontally)
              // Bit 6    Vertical Flip              (0=Normal, 1=Mirror vertically)
              // Bit 7    BG-to-OAM Priority         (0=Use OAM priority bit, 1=BG Priority)
              let bgMapAttributes = 0;
              if (Cpu.GBCEnabled && showColor > 0) {
                  bgMapAttributes = loadFromVramBank(tileMapAddress, 1);
              }
              if (checkBitOnByte(6, bgMapAttributes)) {
                  // We are mirroring the tile, therefore, we need to opposite byte
                  // So if our pizel was 0 our of 8, it wild become 7 :)
                  // TODO: This may be wrong :p
                  pixelYInTile = 7 - pixelYInTile;
              }
              // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
              // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
              // But we need to load the time from a specific Vram bank
              let vramBankId = 0;
              if (checkBitOnByte(3, bgMapAttributes)) {
                  vramBankId = 1;
              }
              // Remember to represent a single line of 8 pixels on a tile, we need two bytes.
              // Therefore, we need to times our modulo by 2, to get the correct line of pixels on the tile.
              // Again, think like you had to map a 2d array as a 1d.
              let byteOneForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2, vramBankId);
              let byteTwoForLineOfTilePixels = loadFromVramBank(tileDataAddress + pixelYInTile * 2 + 1, vramBankId);
              // Now we can get the color for that pixel
              // Colors are represented by getting X position of ByteTwo, and X positon of Byte One
              // To Get the color Id.
              // For example, the result of the color id is 0000 00[xPixelByteTwo][xPixelByteOne]
              // See: How to draw a tile/sprite from memory: http://www.codeslinger.co.uk/pages/projects/gameboy/graphics.html
              let paletteColorId = 0;
              if (checkBitOnByte(pixelXInTile, byteTwoForLineOfTilePixels)) {
                  // Byte one represents the second bit in our color id, so bit shift
                  paletteColorId += 1;
                  paletteColorId = paletteColorId << 1;
              }
              if (checkBitOnByte(pixelXInTile, byteOneForLineOfTilePixels)) {
                  paletteColorId += 1;
              }
              // FINALLY, RENDER THAT PIXEL!
              let pixelStart = (y * 256 + x) * 3;
              if (Cpu.GBCEnabled && showColor > 0) {
                  // Finally lets add some, C O L O R
                  // Want the botom 3 bits
                  let bgPalette = bgMapAttributes & 0x07;
                  // Call the helper function to grab the correct color from the palette
                  let rgbColorPalette = getRgbColorFromPalette(bgPalette, paletteColorId, false);
                  // Split off into red green and blue
                  let red = getColorComponentFromRgb(0, rgbColorPalette);
                  let green = getColorComponentFromRgb(1, rgbColorPalette);
                  let blue = getColorComponentFromRgb(2, rgbColorPalette);
                  let offset = BACKGROUND_MAP_LOCATION + pixelStart;
                  store(offset, red);
                  store(offset + 1, green);
                  store(offset + 2, blue);
              }
              else {
                  // Only rendering camera for now, so coordinates are for the camera.
                  // Get the rgb value for the color Id, will be repeated into R, G, B
                  let monochromeColor = getMonochromeColorFromPalette(paletteColorId, Graphics.memoryLocationBackgroundPalette);
                  for (let i = 0; i < 3; i++) {
                      let offset = BACKGROUND_MAP_LOCATION + pixelStart + i;
                      store(offset, monochromeColor);
                  }
              }
          }
      }
  }
  function drawTileDataToWasmMemory() {
      for (let tileDataMapGridY = 0; tileDataMapGridY < 0x17; tileDataMapGridY++) {
          for (let tileDataMapGridX = 0; tileDataMapGridX < 0x1f; tileDataMapGridX++) {
              // Get Our VramBankID
              let vramBankId = 0;
              if (tileDataMapGridX > 0x0f) {
                  vramBankId = 1;
              }
              // Get our tile ID
              let tileId = tileDataMapGridY;
              if (tileDataMapGridY > 0x0f) {
                  tileId -= 0x0f;
              }
              tileId = tileId << 4;
              if (tileDataMapGridX > 0x0f) {
                  tileId = tileId + (tileDataMapGridX - 0x0f);
              }
              else {
                  tileId = tileId + tileDataMapGridX;
              }
              // Finally get our tile Data location
              let tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectOneStart;
              if (tileDataMapGridY > 0x0f) {
                  tileDataMemoryLocation = Graphics.memoryLocationTileDataSelectZeroStart;
              }
              // Draw each Y line of the tile
              for (let tileLineY = 0; tileLineY < 8; tileLineY++) {
                  drawPixelsFromLineOfTile(tileId, tileDataMemoryLocation, vramBankId, 0, 7, tileLineY, tileDataMapGridX * 8, tileDataMapGridY * 8 + tileLineY, 0x1f * 8, TILE_DATA_LOCATION, true);
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
      let response = Timers.timerInputClock;
      if (Timers.timerEnabled) {
          response = setBitOnByte(2, response);
      }
      return response;
  }

  // These are legacy aliases for the original WasmBoy api
  // WasmBoy
  const wasmMemorySize = WASMBOY_MEMORY_SIZE;
  const wasmBoyInternalStateLocation = WASMBOY_STATE_LOCATION;
  const wasmBoyInternalStateSize = WASMBOY_STATE_SIZE;
  // Gameboy
  const gameBoyInternalMemoryLocation = GAMEBOY_INTERNAL_MEMORY_LOCATION;
  const gameBoyInternalMemorySize = GAMEBOY_INTERNAL_MEMORY_SIZE;
  // Video output
  const videoOutputLocation = GRAPHICS_OUTPUT_LOCATION;
  const gameboyColorPaletteLocation = GBC_PALETTE_LOCATION;
  const gameboyColorPaletteSize = GBC_PALETTE_SIZE;
  const frameInProgressVideoOutputLocation = FRAME_LOCATION;
  const backgroundMapLocation = BACKGROUND_MAP_LOCATION;
  const tileDataMap = TILE_DATA_LOCATION;
  // Sound output
  const soundOutputLocation = AUDIO_BUFFER_LOCATION;
  // Game Cartridge
  const gameRamBanksLocation = CARTRIDGE_RAM_LOCATION;
  // Passed in Game backup or ROM from the user
  const gameBytesLocation = CARTRIDGE_ROM_LOCATION;

  var WasmBoyCore = /*#__PURE__*/Object.freeze({
    memory: memory,
    config: config,
    hasCoreStarted: hasCoreStarted,
    saveState: saveState,
    loadState: loadState,
    getStepsPerStepSet: getStepsPerStepSet,
    getStepSets: getStepSets,
    getSteps: getSteps,
    executeMultipleFrames: executeMultipleFrames,
    executeFrame: executeFrame,
    executeFrameAndCheckAudio: executeFrameAndCheckAudio,
    executeFrameUntilBreakpoint: executeFrameUntilBreakpoint,
    executeUntilCondition: executeUntilCondition,
    executeStep: executeStep,
    getCyclesPerCycleSet: getCyclesPerCycleSet,
    getCycleSets: getCycleSets,
    getCycles: getCycles,
    setJoypadState: setJoypadState,
    getNumberOfSamplesInAudioBuffer: getNumberOfSamplesInAudioBuffer,
    clearAudioBuffer: clearAudioBuffer,
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
    CARTRIDGE_RAM_LOCATION: CARTRIDGE_RAM_LOCATION,
    CARTRIDGE_RAM_SIZE: CARTRIDGE_RAM_SIZE,
    CARTRIDGE_ROM_LOCATION: CARTRIDGE_ROM_LOCATION,
    CARTRIDGE_ROM_SIZE: CARTRIDGE_ROM_SIZE,
    getWasmBoyOffsetFromGameBoyOffset: getWasmBoyOffsetFromGameBoyOffset,
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
    drawBackgroundMapToWasmMemory: drawBackgroundMapToWasmMemory,
    drawTileDataToWasmMemory: drawTileDataToWasmMemory,
    getDIV: getDIV,
    getTIMA: getTIMA,
    getTMA: getTMA,
    getTAC: getTAC,
    update: executeFrame,
    emulationStep: executeStep,
    getAudioQueueIndex: getNumberOfSamplesInAudioBuffer,
    resetAudioQueue: clearAudioBuffer,
    wasmMemorySize: wasmMemorySize,
    wasmBoyInternalStateLocation: wasmBoyInternalStateLocation,
    wasmBoyInternalStateSize: wasmBoyInternalStateSize,
    gameBoyInternalMemoryLocation: gameBoyInternalMemoryLocation,
    gameBoyInternalMemorySize: gameBoyInternalMemorySize,
    videoOutputLocation: videoOutputLocation,
    frameInProgressVideoOutputLocation: frameInProgressVideoOutputLocation,
    gameboyColorPaletteLocation: gameboyColorPaletteLocation,
    gameboyColorPaletteSize: gameboyColorPaletteSize,
    backgroundMapLocation: backgroundMapLocation,
    tileDataMap: tileDataMap,
    soundOutputLocation: soundOutputLocation,
    gameBytesLocation: gameBytesLocation,
    gameRamBanksLocation: gameRamBanksLocation
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
