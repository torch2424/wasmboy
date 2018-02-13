// Functions for rendering the sprites
import {
  Graphics
} from './graphics';
import {
  getTileDataAddress,
  getColorFromPalette
} from './renderUtils'
// Assembly script really not feeling the reexport
import {
  eightBitLoadFromGBMemory
} from '../memory/load';
import {
  setPixelOnFrame
} from '../memory/memory';
import {
  consoleLog,
  consoleLogTwo,
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte
} from '../helpers/index';

export function renderSprites(scanlineRegister: u8, useLargerSprites: boolean): void {

  // Need to loop through all 40 sprites to check their status
  for(let i: u16 = 0; i < 40; i++) {

    // Sprites occupy 4 bytes in the sprite attribute table
    let spriteTableIndex: u16 = i * 4;
    // Y positon is offset by 16, X position is offset by 8
    let spriteYPosition: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex) - 16;
    let spriteXPosition: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 1) - 8;
    let spriteTileLocation: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 2);
    let spriteAttributes: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex + 3);

    // TODO: Check sprite Priority

    // Check if we should flip the sprite on the x or y axis
    let flipSpriteY: boolean = checkBitOnByte(6, spriteAttributes);
    let flipSpriteX: boolean = checkBitOnByte(5, spriteAttributes);

    // Get our sprite pallete
    let spritePaletteLocation: u16 = Graphics.memoryLocationSpritePaletteOne;
    if (checkBitOnByte(4, spriteAttributes)) {
      spritePaletteLocation = Graphics.memoryLocationSpritePaletteTwo;
    }

    // Find our sprite height
    let spriteHeight: u8 = 8;
    if(useLargerSprites) {
      spriteHeight = 16;
    }

    // Find if our sprite is on the current scanline
    if(scanlineRegister >= spriteYPosition && scanlineRegister <= (spriteYPosition + spriteHeight)) {
      // Then we need to draw the current sprite

      // Find which line on the sprite we are on
      let currentSpriteLine: i16 = scanlineRegister - spriteYPosition;

      // If we fliiped the Y axis on our sprite, need to read from memory backwards to acheive the same effect
      if(flipSpriteY) {
        currentSpriteLine -= <i16>spriteHeight;
        currentSpriteLine = currentSpriteLine * -1;
      }

      // Get our sprite tile address
      let spriteTileAddress: u16 = (Graphics.memoryLocationTileDataSelectOneStart + (spriteTileLocation * 16));
      spriteTileAddress = <u16>(<i16>spriteTileAddress + currentSpriteLine);
      let spriteDataByteOneForLineOfTilePixels: u8 = eightBitLoadFromGBMemory(spriteTileAddress);
      let spriteDataByteTwoForLineOfTilePixels: u8 = eightBitLoadFromGBMemory(spriteTileAddress + 1);

      // Iterate over the width of our sprite to found our individual pixels
      for(let tilePixel: i8 = 7; tilePixel >= 0; tilePixel--) {

        // Get our spritePixel, and check for flipping
        let spritePixelXInTile: i8 = tilePixel;
        if(flipSpriteX) {
          spritePixelXInTile -= 7;
          spritePixelXInTile = spritePixelXInTile * -1;
        }

        // Get the color Id of our sprite, similar to renderBackground()
        // With the first byte, and second byte lined up method thing
        let spriteColorId: u8 = 0;
        if (checkBitOnByte(<u8>spritePixelXInTile, spriteDataByteOneForLineOfTilePixels)) {
          // Byte one represents the second bit in our color id, so bit shift
          spriteColorId += 1;
          spriteColorId = (spriteColorId << 1);
        }
        if (checkBitOnByte(<u8>spritePixelXInTile, spriteDataByteTwoForLineOfTilePixels)) {
          spriteColorId += 1;
        }

        // Get our color ID from the current sprite pallete
        let spritePixelColorFromPalette: u8 = getColorFromPalette(spriteColorId, spritePaletteLocation);

        // Find our actual X pixel location on the gameboy "camera" view
        let spriteXPixelLocationInCameraView: u8 = spriteXPosition + (7 - <u8>tilePixel);

        // Finally set the pixel!
        setPixelOnFrame(spriteXPixelLocationInCameraView, scanlineRegister, spritePixelColorFromPalette);
      }
    }
  }
}
