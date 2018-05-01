// utility funcitons to help in rendering
import { Graphics } from "./graphics";
import { checkBitOnByte, setBitOnByte, resetBitOnByte } from "../helpers/index";

export function getTileDataAddress(
  tileDataMemoryLocation: i32,
  tileIdFromTileMap: i32
): i32 {
  // Watch this part of The ultimate gameboy talk: https://youtu.be/HyzD8pNlpwI?t=30m50s
  // A line of 8 pixels on a single tile, is represented by 2 bytes.
  // since a single tile is 8x8 pixels, 8 * 2 = 16 bytes

  // Get the tile ID's tile addess from tile data.
  // For instance, let's say our first line of tile data represents tiles for letters:
  // a b c d e f g
  // And we have tileId 0x02. That means we want the tile for the 'c' character
  // Since each tile is 16 bytes, it would be the starting tileDataAddress + (tileId * tileSize), to skip over tiles we dont want
  // The whole signed thing is weird, and has something to do how the second set of tile data is stored :p
  if (
    tileDataMemoryLocation === Graphics.memoryLocationTileDataSelectZeroStart
  ) {
    // Treat the tile Id as a signed int, subtract an offset of 128
    // if the tileId was 0 then the tile would be in memory region 0x9000-0x900F
    // NOTE: Assemblyscript, Can't cast to i16, need to make negative manually
    let signedTileId: i32 = tileIdFromTileMap + 128;
    if (checkBitOnByte(7, tileIdFromTileMap)) {
      signedTileId = tileIdFromTileMap - 128;
    }
    return tileDataMemoryLocation + signedTileId * 16;
  }

  // if the background layout gave us the tileId 0, then the tile data would be between 0x8000-0x800F.
  return tileDataMemoryLocation + tileIdFromTileMap * 16;
}
