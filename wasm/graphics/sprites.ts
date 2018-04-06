// Functions for rendering the sprites
import {
  Graphics
} from './graphics';
import {
  Cpu
} from '../cpu/cpu';
import {
  getTileDataAddress
} from './renderUtils';
import {
  getMonochromeColorFromPalette,
  getRgbColorFromPalette,
  getColorComponentFromRgb
} from './palette';
// Assembly script really not feeling the reexport
// using Skip Traps, because LCD has unrestricted access
// http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_OAM_DMA_Transfers
import {
  eightBitLoadFromGBMemorySkipTraps
} from '../memory/load';
import {
  loadFromVramBank,
  setPixelOnFrame,
  getPixelOnFrame
} from '../memory/memory';
import {
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte,
  hexLog
} from '../helpers/index';

export function renderSprites(scanlineRegister: u8, useLargerSprites: boolean): void {

  // Need to loop through all 40 sprites to check their status
  for(let i: i32 = 0; i < 40; i++) {

    // Sprites occupy 4 bytes in the sprite attribute table
    let spriteTableIndex: u16 = <u16>(i * 4);
    // Y positon is offset by 16, X position is offset by 8

    let spriteYPosition: u8 = eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex);
    let spriteXPosition: u8 = eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 1);
    let spriteTileId: u8 = eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 2);
    let spriteAttributes: u8 = eightBitLoadFromGBMemorySkipTraps(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 3);

    // Pan docs of sprite attirbute table
    // Bit7   OBJ-to-BG Priority (0=OBJ Above BG, 1=OBJ Behind BG color 1-3)
    //      (Used for both BG and Window. BG color 0 is always behind OBJ)
    // Bit6   Y flip          (0=Normal, 1=Vertically mirrored)
    // Bit5   X flip          (0=Normal, 1=Horizontally mirrored)
    // Bit4   Palette number  **Non CGB Mode Only** (0=OBP0, 1=OBP1)
    // Bit3   Tile VRAM-Bank  **CGB Mode Only**     (0=Bank 0, 1=Bank 1)
    // Bit2-0 Palette number  **CGB Mode Only**     (OBP0-7)

    // Apply sprite X and Y offset
    spriteYPosition -= 16;
    spriteXPosition -= 8;

    // Check sprite Priority
    let isSpritePriorityBehindWindowAndBackground: boolean = checkBitOnByte(7, spriteAttributes);

    // Check if we should flip the sprite on the x or y axis
    let flipSpriteY: boolean = checkBitOnByte(6, spriteAttributes);
    let flipSpriteX: boolean = checkBitOnByte(5, spriteAttributes);

    // Find our sprite height
    let spriteHeight: u8 = 8;
    if(useLargerSprites) {
      spriteHeight = 16;
      // @binji says in 8x16 mode, even tileId always drawn first
      // This will fix shantae sprites which always uses odd numbered indexes
      if(spriteTileId % 2 === 1) {
        spriteTileId -= 1;
      }
    }

    // Find if our sprite is on the current scanline
    if(scanlineRegister >= spriteYPosition && scanlineRegister < (spriteYPosition + spriteHeight)) {
      // Then we need to draw the current sprite

      // Find which line on the sprite we are on
      let currentSpriteLine: i16 = scanlineRegister - spriteYPosition;

      // If we fliiped the Y axis on our sprite, need to read from memory backwards to acheive the same effect
      if(flipSpriteY) {
        currentSpriteLine -= <i16>spriteHeight;
        currentSpriteLine = currentSpriteLine * -1;

        // Bug fix for the flipped flies in link's awakening
        currentSpriteLine -= 1;
      }

      // Each line of a tile takes two bytes of memory
      currentSpriteLine = currentSpriteLine * 2;

      // Get our sprite tile address, need to also add the current sprite line to get the correct bytes
      let spriteTileAddressStart: i32 = <i32>getTileDataAddress(Graphics.memoryLocationTileDataSelectOneStart, spriteTileId);
      spriteTileAddressStart = spriteTileAddressStart + currentSpriteLine;
      let spriteTileAddress: u16 = <u16>spriteTileAddressStart;

      // Find which VRAM Bank to load from
      let vramBankId: i32 = 0;
      if (Cpu.GBCEnabled && checkBitOnByte(3, spriteAttributes)) {
        vramBankId = 1;
      }
      let spriteDataByteOneForLineOfTilePixels: u8 = loadFromVramBank(spriteTileAddress, vramBankId);
      let spriteDataByteTwoForLineOfTilePixels: u8 = loadFromVramBank(spriteTileAddress + 1, vramBankId);

      // Iterate over the width of our sprite to find our individual pixels
      for(let tilePixel: i8 = 7; tilePixel >= 0; tilePixel--) {

        // Get our spritePixel, and check for flipping
        let spritePixelXInTile: i8 = tilePixel;
        if(flipSpriteX) {
          spritePixelXInTile -= 7;
          spritePixelXInTile = spritePixelXInTile * -1;
        }

        // Get the color Id of our sprite, similar to renderBackground()
        // With the first byte, and second byte lined up method thing
        // Yes, the second byte comes before the first, see ./background.ts
        let spriteColorId: u8 = 0;
        if (checkBitOnByte(<u8>spritePixelXInTile, spriteDataByteTwoForLineOfTilePixels)) {
          // Byte one represents the second bit in our color id, so bit shift
          spriteColorId += 1;
          spriteColorId = (spriteColorId << 1);
        }
        if (checkBitOnByte(<u8>spritePixelXInTile, spriteDataByteOneForLineOfTilePixels)) {
          spriteColorId += 1;
        }

        // ColorId zero (last two bits of pallette) are transparent
        // http://gbdev.gg8.se/wiki/articles/Video_Display
        if (spriteColorId !== 0) {

          // Find our actual X pixel location on the gameboy "camera" view
          let spriteXPixelLocationInCameraView: u8 = spriteXPosition + (7 - <u8>tilePixel);

          // Now that we have our coordinates, check sprite priority
          // Remember, set pixel on frame increases the value by one!
          if (!isSpritePriorityBehindWindowAndBackground ||
            getPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister) >= 200) {

            if(!Cpu.GBCEnabled) {
              // Get our monochrome color RGB from the current sprite pallete
              // Get our sprite pallete
              let spritePaletteLocation: u16 = Graphics.memoryLocationSpritePaletteOne;
              if (checkBitOnByte(4, spriteAttributes)) {
                spritePaletteLocation = Graphics.memoryLocationSpritePaletteTwo;
              }
              let spritePixelColorFromPalette: u8 = getMonochromeColorFromPalette(spriteColorId, spritePaletteLocation);

              // Finally set the pixel!
              setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 0, spritePixelColorFromPalette);
              setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 1, spritePixelColorFromPalette);
              setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 2, spritePixelColorFromPalette);
            } else {

              // Get our RGB Color

              // Finally lets add some, C O L O R
              // Want the botom 3 bits
              let bgPalette: u8 = (spriteAttributes & 0x07);

              // Call the helper function to grab the correct color from the palette
              let rgbColorPalette: u16 = getRgbColorFromPalette(bgPalette, spriteColorId, true);

              // Split off into red green and blue
              let red: u8 = getColorComponentFromRgb(0, rgbColorPalette);
              let green: u8 = getColorComponentFromRgb(1, rgbColorPalette);
              let blue: u8 = getColorComponentFromRgb(2, rgbColorPalette);

              // Finally Place our colors on the things
              setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 0, red);
              setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 1, green);
              setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 2, blue);
            }
          }
        }

        // Done!
      }
    }
  }
}
