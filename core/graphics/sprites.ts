// Functions for rendering the sprites
import { Graphics, loadFromVramBank, setPixelOnFrame } from './graphics';
import { Lcd } from './lcd';
import { Cpu } from '../cpu/index';
import { getTileDataAddress } from './tiles';
import {
  getMonochromeColorFromPalette,
  getColorizedGbHexColorFromPalette,
  getRgbColorFromPalette,
  getColorComponentFromRgb
} from './palette';
import { getRedFromHexColor, getGreenFromHexColor, getBlueFromHexColor } from './colors';
import { getPriorityforPixel } from './priority';
// Assembly script really not feeling the reexport
// using Skip Traps, because LCD has unrestricted access
// http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_OAM_DMA_Transfers
import { eightBitLoadFromGBMemory } from '../memory/load';
import { checkBitOnByte, setBitOnByte, resetBitOnByte, hexLog } from '../helpers/index';

export function renderSprites(scanlineRegister: i32, useLargerSprites: boolean): void {
  // Need to loop through all 40 sprites to check their status
  // Going backwards since lower sprites draw over higher ones
  // Will fix dragon warrior 3 intro
  for (let i: i32 = 39; i >= 0; i--) {
    // Sprites occupy 4 bytes in the sprite attribute table
    let spriteTableIndex: i32 = i * 4;
    // Y positon is offset by 16, X position is offset by 8

    let spriteYPosition: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex);
    let spriteXPosition: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 1);
    let spriteTileId: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 2);

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
    let spriteHeight: i32 = 8;
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
      let spriteAttributes: i32 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 3);

      // Check sprite Priority
      let isSpritePriorityBehindWindowAndBackground: boolean = checkBitOnByte(7, spriteAttributes);

      // Check if we should flip the sprite on the x or y axis
      let flipSpriteY: boolean = checkBitOnByte(6, spriteAttributes);
      let flipSpriteX: boolean = checkBitOnByte(5, spriteAttributes);

      // TODO: Torch2424 continue here.

      // Find which line on the sprite we are on
      let currentSpriteLine: i32 = scanlineRegister - spriteYPosition;

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
      let spriteTileAddressStart: i32 = getTileDataAddress(Graphics.memoryLocationTileDataSelectOneStart, spriteTileId);
      spriteTileAddressStart = spriteTileAddressStart + currentSpriteLine;
      let spriteTileAddress: i32 = spriteTileAddressStart;

      // Find which VRAM Bank to load from
      let vramBankId: i32 = 0;
      if (Cpu.GBCEnabled && checkBitOnByte(3, spriteAttributes)) {
        vramBankId = 1;
      }
      let spriteDataByteOneForLineOfTilePixels: i32 = loadFromVramBank(spriteTileAddress, vramBankId);
      let spriteDataByteTwoForLineOfTilePixels: i32 = loadFromVramBank(spriteTileAddress + 1, vramBankId);

      // Iterate over the width of our sprite to find our individual pixels
      for (let tilePixel: i32 = 7; tilePixel >= 0; tilePixel--) {
        // Get our spritePixel, and check for flipping
        let spritePixelXInTile: i32 = tilePixel;
        if (flipSpriteX) {
          spritePixelXInTile -= 7;
          spritePixelXInTile = spritePixelXInTile * -1;
        }

        // Get the color Id of our sprite, similar to renderBackground()
        // With the first byte, and second byte lined up method thing
        // Yes, the second byte comes before the first, see ./background.ts
        let spriteColorId: i32 = 0;
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
          let spriteXPixelLocationInCameraView: i32 = spriteXPosition + (7 - tilePixel);
          if (spriteXPixelLocationInCameraView >= 0 && spriteXPixelLocationInCameraView <= 160) {
            // There are two cases where wouldnt draw the pixel on top of the Bg/window
            // 1. if isSpritePriorityBehindWindowAndBackground, sprite can only draw over color 0
            // 2. if bit 2 of our priority is set, then BG-to-OAM Priority from pandoc
            //  is active, meaning BG tile will have priority above all OBJs
            //  (regardless of the priority bits in OAM memory)
            // But if GBC and Bit 0 of LCDC is set, we always draw the object
            let shouldShowFromLcdcPriority: boolean = false;
            let shouldHideFromOamPriority: boolean = false;
            let shouldHideFromBgPriority: boolean = false;
            // LCDC Priority
            if (Cpu.GBCEnabled && !Lcd.bgDisplayEnabled) {
              shouldShowFromLcdcPriority = true;
            }

            if (!shouldShowFromLcdcPriority) {
              // Now that we have our coordinates, check for sprite priority
              // Lets get the priority byte we put in memory
              let bgPriorityByte: i32 = getPriorityforPixel(spriteXPixelLocationInCameraView, scanlineRegister);

              let bgColorFromPriorityByte: i32 = bgPriorityByte & 0x03;

              // Doing an else if, since either will automatically stop drawing the pixel
              if (isSpritePriorityBehindWindowAndBackground && bgColorFromPriorityByte > 0) {
                // OAM Priority
                shouldHideFromOamPriority = true;
              } else if (Cpu.GBCEnabled && checkBitOnByte(2, bgPriorityByte) && bgColorFromPriorityByte > 0) {
                // Bg priority
                shouldHideFromBgPriority = true;
              }
            }

            if (shouldShowFromLcdcPriority || (!shouldHideFromOamPriority && !shouldHideFromBgPriority)) {
              if (!Cpu.GBCEnabled) {
                // Get our monochrome color RGB from the current sprite pallete
                // Get our sprite pallete
                let spritePaletteLocation: i32 = Graphics.memoryLocationSpritePaletteOne;
                if (checkBitOnByte(4, spriteAttributes)) {
                  spritePaletteLocation = Graphics.memoryLocationSpritePaletteTwo;
                }

                let hexColor: i32 = getColorizedGbHexColorFromPalette(spriteColorId, spritePaletteLocation);

                // Finally set the pixel!
                setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 0, getRedFromHexColor(hexColor));
                setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 1, getGreenFromHexColor(hexColor));
                setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, 2, getBlueFromHexColor(hexColor));
              } else {
                // Get our RGB Color

                // Finally lets add some, C O L O R
                // Want the botom 3 bits
                let bgPalette: i32 = spriteAttributes & 0x07;

                // Call the helper function to grab the correct color from the palette
                let rgbColorPalette: i32 = getRgbColorFromPalette(bgPalette, spriteColorId, true);

                // Split off into red green and blue
                let red: i32 = getColorComponentFromRgb(0, rgbColorPalette);
                let green: i32 = getColorComponentFromRgb(1, rgbColorPalette);
                let blue: i32 = getColorComponentFromRgb(2, rgbColorPalette);

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
