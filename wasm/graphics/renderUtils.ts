// utility funcitons to help in rendering
import {
  Graphics
} from './graphics';
// Assembly script really not feeling the reexport
// using Skip Traps, because LCD has unrestricted access
// http://gbdev.gg8.se/wiki/articles/Video_Display#LCD_OAM_DMA_Transfers
import {
  eightBitLoadFromGBMemorySkipTraps
} from '../memory/load';
import {
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte
} from '../helpers/index';

export function getTileDataAddress(tileDataMemoryLocation: u16, tileIdFromTileMap: u8): u16 {

  // Watch this part of The ultimate gameboy talk: https://youtu.be/HyzD8pNlpwI?t=30m50s
  // A line of 8 pixels on a single tile, is represented by 2 bytes.
  // since a single tile is 8x8 pixels, 8 * 2 = 16 bytes
  let sizeOfTileInMemory: u8 = 16;
  let tileDataAddress: u16 = 0;

  // Get the tile ID's tile addess from tile data.
  // For instance, let's say our first line of tile data represents tiles for letters:
  // a b c d e f g
  // And we have tileId 0x02. That means we want the tile for the 'c' character
  // Since each tile is 16 bytes, it would be the starting tileDataAddress + (tileId * tileSize), to skip over tiles we dont want
  // The whole signed thing is weird, and has something to do how the second set of tile data is stored :p
  if(tileDataMemoryLocation === Graphics.memoryLocationTileDataSelectZeroStart) {
    // Treat the tile Id as a signed int, subtract an offset of 128
    // if the tileId was 0 then the tile would be in memory region 0x9000-0x900F
    // NOTE: Assemblyscript, Can't cast to i16, need to make negative manually
    let convertedTileIdFromTileMap = <i16>tileIdFromTileMap;
    let signedTileId: i16 = tileIdFromTileMap + 128;
    if (checkBitOnByte(7, tileIdFromTileMap)) {
      signedTileId = convertedTileIdFromTileMap - 128;
    }
    let tileIdAddress: i16 = signedTileId * sizeOfTileInMemory;
    tileDataAddress = tileDataMemoryLocation + <u16>tileIdAddress;
  } else {
    // if the background layout gave us the tileId 0, then the tile data would be between 0x8000-0x800F.
    let sixteenBitTileIdFromTileMap: u16 = <u16>tileIdFromTileMap;
    tileDataAddress = tileDataMemoryLocation + <u16>(sixteenBitTileIdFromTileMap * sizeOfTileInMemory);
  }

  return tileDataAddress;
}


export function getColorFromPalette(colorId: u8, paletteMemoryLocation: u16): u8 {
  // Shift our paletteByte, 2 times for each color ID
  // And off any extra bytes
  // Return our Color (00, 01, 10, or 11)
  return (eightBitLoadFromGBMemorySkipTraps(paletteMemoryLocation) >> (colorId * 2)) & 0x03;
}
