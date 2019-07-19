// Functions for handling sprite logic (OAM)
import { OAM_VISIBLE_SPRITES_LOCATION } from '../constants';
import { Graphics } from './graphics';
import { Lcd } from './lcd';
import { eightBitLoadFromGBMemory } from '../memory/load';
import { eightBitStoreIntoGBMemory } from '../memory/store';

export class Sprites {
  // The number of currently visible Sprites
  static numberOfVisibleSprites: i32 = 0;

  // Function to get a visible sprite index
  static getVisibleSpriteIndex(visibileSpriteIndex: i32): i32 {
    return eightBitLoadFromGBMemory(OAM_VISIBLE_SPRITES_LOCATION + visibileSpriteIndex);
  }

  // Function to do our OAM Search
  // Known as OAM Scan in PanDocs
  // http://gbdev.gg8.se/wiki/articles/Video_Display#Sprite_Priorities_and_Conflicts
  static oamSearchForVisibleSprites(): void {
    // Record how many sprites we have found
    Sprites.numberOfVisibleSprites = 0;

    // Get our sprite height from the LCD Control
    let spriteHeight: i32 = Lcd.tallSpriteSize ? 16 : 8;

    // Cycle through the sprite attribute table, and fill our visible sprites
    // Need to loop through all 40 sprites to check their status
    // Going backwards since lower sprites draw over higher ones
    // Will fix dragon warrior 3 intro
    for (let i = 39; i >= 0 && Sprites.numberOfVisibleSprites < 10; --i) {
      // Sprites occupy 4 bytes in the sprite attribute table
      // Byte0 - Y Position
      // Byte1 - X Position
      // Byte2 - Tile/Pattern Number
      // Byte3 - Attributes/Flags
      let spriteTableIndex: i32 = i * 4;

      let spriteMemoryIndex: i32 = Graphics.memoryLocationSpriteAttributesTable + spriteTableIndex;

      let spriteYPosition: i32 = eightBitLoadFromGBMemory(spriteMemoryIndex + 0);
      let spriteXPosition: i32 = eightBitLoadFromGBMemory(spriteMemoryIndex + 1);

      // X is offset by 8. An off-screen value (X=0 or X>=168) hides the sprite
      spriteXPosition -= 8;
      // Y is offset by 16. An off-screen value (for example, Y=0 or Y>=160) hides the sprite.
      spriteYPosition -= 16;

      // DEBUG: Tile line is wrong, both here and the fetcher.

      // Find if the sprite is visible
      // spriteXPosition > -8 because:
      // X is minus 8 pixels, and since sprites can only be 8 pixels wide, it would be not visible.
      // Y position is explanable by the Y position of our scanline, being in our sprite vertical area
      if (
        spriteXPosition > -8 &&
        Graphics.scanlineRegister >= spriteYPosition &&
        Graphics.scanlineRegister < spriteYPosition + spriteHeight
      ) {
        // Store the index of the sprite in the sprite attribute table
        // + 1, because the first element is the number of sprite found
        eightBitStoreIntoGBMemory(OAM_VISIBLE_SPRITES_LOCATION + Sprites.numberOfVisibleSprites, i);

        // Lastly, increase our visible sprites found
        Sprites.numberOfVisibleSprites++;
      }
    }
  }
}
