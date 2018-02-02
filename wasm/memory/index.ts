// TODO: Use and ENUM https://github.com/AssemblyScript/assemblyscript/blob/master/examples/pson/assembly/pson.ts

// https://github.com/AntonioND/giibiiadvance/blob/master/docs/TCAGBD.pdf
// http://gameboy.mongenel.com/dmg/asmmemmap.html
// using Arrays, first index is start, second is end
const memoryCartridgeRomLocationStart = 0x0000;
const memoryCartridgeRomLocationEnd = 0x3FFF;
const memorySwitchableCartridgeRomLocationStart = 0x4000;
const memorySwitchableCartridgeRomLocationEnd = 0x7FFF;
const memoryVideoRamStart = 0x8000;
const memoryVideoRamEnd = 0x9FFF;
const memoryCartridgeRamLocationStart = 0xA000;
const memoryCartridgeRamLocationEnd = 0xBFFF;
const memoryInternalRamBankZeroLocationStart = 0xC000;
const memoryInternalRamBankZeroLocationEnd = 0xCFFF;
const memoryInternalRamBankOneThroughSevenStart = 0xD000;
const memoryInternalRamBankOneThroughSevenEnd = 0xDFFF;
// Echo Ram, Do not use, 0xE000 -> 0xFDFF
const memorySpriteInformationTableStart = 0xFE00;
const memorySpriteInformationTableEnd = 0xFE9F;
// Unusable memory, 0xFEA0 -> 0xFEFF
// Hardware I/O, 0xFF00 -> 0xFF7F
// Zero Page, 0xFF80 -> 0xFFFE
// Intterupt Enable Flag, 0xFFFF


// also need to store current frame in memory to be read by JS
const memoryFrameDataStart = 0x10000;
export function setPixelOnFrame(x: u8, y: u8, color: u8): void {
  // Currently only supports 160x144
  // Storing in X, then y
  // So need an offset
  let offset = memoryFrameDataStart + (x * (y + 1));
  store<u8>(offset, color);
}


// Wrapper funcstions around load/store for assemblyscript offset to gb mem offset
// NOTE: Confirmed that memory is working with both Eight and sixteenbit store :), tested in CPU initialize
export function eightBitStoreIntoGBMemory(offset: u16, value: u8): void {
  store<u8>(offset, value);
}

export function sixteenBitStoreIntoGBMemory(offset: u16, value: u16): void {
  store<u16>(offset, value);
}

export function eightBitLoadFromGBMemory(offset: u16): u8 {
  return load<u8>(offset);
}

export function sixteenBitLoadFromGBMemory(offset: u16): u16 {
  return load<u16>(offset);
}
