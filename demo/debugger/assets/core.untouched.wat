(module
 (type $iiiiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $v (func))
 (type $ii (func (param i32) (result i32)))
 (type $iiv (func (param i32 i32)))
 (type $i (func (result i32)))
 (type $iv (func (param i32)))
 (type $iiiv (func (param i32 i32 i32)))
 (type $iiiiiiv (func (param i32 i32 i32 i32 i32 i32)))
 (type $iii (func (param i32 i32) (result i32)))
 (type $iiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $iiiiv (func (param i32 i32 i32 i32)))
 (type $iiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $iiii (func (param i32 i32 i32) (result i32)))
 (type $iiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32)))
 (type $iiiii (func (param i32 i32 i32 i32) (result i32)))
 (type $iiiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
 (global $core/constants/WASMBOY_MEMORY_LOCATION i32 (i32.const 0))
 (global $core/constants/WASMBOY_MEMORY_SIZE i32 (i32.const 9109504))
 (global $core/constants/WASMBOY_WASM_PAGES i32 (i32.const 139))
 (global $core/constants/ASSEMBLYSCRIPT_MEMORY_LOCATION i32 (i32.const 0))
 (global $core/constants/ASSEMBLYSCRIPT_MEMORY_SIZE i32 (i32.const 1024))
 (global $core/constants/WASMBOY_STATE_LOCATION i32 (i32.const 1024))
 (global $core/constants/WASMBOY_STATE_SIZE i32 (i32.const 1024))
 (global $core/constants/GAMEBOY_INTERNAL_MEMORY_LOCATION i32 (i32.const 2048))
 (global $core/constants/GAMEBOY_INTERNAL_MEMORY_SIZE i32 (i32.const 65535))
 (global $core/constants/VIDEO_RAM_LOCATION i32 (i32.const 2048))
 (global $core/constants/VIDEO_RAM_SIZE i32 (i32.const 16384))
 (global $core/constants/WORK_RAM_LOCATION i32 (i32.const 18432))
 (global $core/constants/WORK_RAM_SIZE i32 (i32.const 32768))
 (global $core/constants/OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION i32 (i32.const 51200))
 (global $core/constants/OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE i32 (i32.const 16384))
 (global $core/constants/GRAPHICS_OUTPUT_LOCATION i32 (i32.const 67584))
 (global $core/constants/GRAPHICS_OUTPUT_SIZE i32 (i32.const 521216))
 (global $core/constants/GBC_PALETTE_LOCATION i32 (i32.const 67584))
 (global $core/constants/GBC_PALETTE_SIZE i32 (i32.const 512))
 (global $core/constants/BG_PRIORITY_MAP_LOCATION i32 (i32.const 69632))
 (global $core/constants/BG_PRIORITY_MAP_SIZE i32 (i32.const 23552))
 (global $core/constants/FRAME_LOCATION i32 (i32.const 93184))
 (global $core/constants/FRAME_SIZE i32 (i32.const 93184))
 (global $core/constants/BACKGROUND_MAP_LOCATION i32 (i32.const 232448))
 (global $core/constants/BACKGROUND_MAP_SIZE i32 (i32.const 196608))
 (global $core/constants/TILE_DATA_LOCATION i32 (i32.const 429056))
 (global $core/constants/TILE_DATA_SIZE i32 (i32.const 147456))
 (global $core/constants/OAM_TILES_LOCATION i32 (i32.const 576512))
 (global $core/constants/OAM_TILES_SIZE i32 (i32.const 12288))
 (global $core/constants/AUDIO_BUFFER_LOCATION i32 (i32.const 588800))
 (global $core/constants/AUDIO_BUFFER_SIZE i32 (i32.const 131072))
 (global $core/constants/CARTRIDGE_RAM_LOCATION i32 (i32.const 719872))
 (global $core/constants/CARTRIDGE_RAM_SIZE i32 (i32.const 131072))
 (global $core/constants/CARTRIDGE_ROM_LOCATION i32 (i32.const 850944))
 (global $core/constants/CARTRIDGE_ROM_SIZE i32 (i32.const 8258560))
 (global $core/core/hasStarted (mut i32) (i32.const 0))
 (global $core/config/Config.enableBootRom (mut i32) (i32.const 0))
 (global $core/config/Config.useGbcWhenAvailable (mut i32) (i32.const 1))
 (global $core/config/Config.audioBatchProcessing (mut i32) (i32.const 0))
 (global $core/config/Config.graphicsBatchProcessing (mut i32) (i32.const 0))
 (global $core/config/Config.timersBatchProcessing (mut i32) (i32.const 0))
 (global $core/config/Config.graphicsDisableScanlineRendering (mut i32) (i32.const 0))
 (global $core/config/Config.audioAccumulateSamples (mut i32) (i32.const 0))
 (global $core/config/Config.tileRendering (mut i32) (i32.const 0))
 (global $core/config/Config.tileCaching (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.currentRomBank (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC5 (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.GBCEnabled (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.memoryLocationGBCVRAMBank (mut i32) (i32.const 65359))
 (global $core/memory/memory/Memory.currentRamBank (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.memoryLocationGBCWRAMBank (mut i32) (i32.const 65392))
 (global $core/cpu/cpu/Cpu.GBCDoubleSpeed (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerA (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerB (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerC (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerD (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerE (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerH (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerL (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.registerF (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.stackPointer (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.programCounter (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.currentCycles (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.isHalted (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.isStopped (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isRamBankingEnabled (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC1RomModeEnabled (mut i32) (i32.const 1))
 (global $core/memory/memory/Memory.isRomOnly (mut i32) (i32.const 1))
 (global $core/memory/memory/Memory.isMBC1 (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC2 (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC3 (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.currentCycles (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scanlineCycleCounter (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scanlineRegister (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scrollX (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scrollY (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.windowX (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.windowY (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.currentCycles (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.NR50LeftMixerVolume (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.NR50RightMixerVolume (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.NR52IsSoundEnabled (mut i32) (i32.const 1))
 (global $core/sound/sound/Sound.frameSequenceCycleCounter (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.downSampleCycleCounter (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.frameSequencer (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.audioQueueIndex (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.volumeCodeChanged (mut i32) (i32.const 0))
 (global $core/sound/accumulator/SoundAccumulator.channel1Sample (mut i32) (i32.const 15))
 (global $core/sound/accumulator/SoundAccumulator.channel2Sample (mut i32) (i32.const 15))
 (global $core/sound/accumulator/SoundAccumulator.channel3Sample (mut i32) (i32.const 15))
 (global $core/sound/accumulator/SoundAccumulator.channel4Sample (mut i32) (i32.const 15))
 (global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled (mut i32) (i32.const 0))
 (global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled (mut i32) (i32.const 0))
 (global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled (mut i32) (i32.const 0))
 (global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled (mut i32) (i32.const 0))
 (global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte (mut i32) (i32.const 127))
 (global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte (mut i32) (i32.const 127))
 (global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged (mut i32) (i32.const 0))
 (global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged (mut i32) (i32.const 0))
 (global $core/sound/accumulator/SoundAccumulator.needToRemixSamples (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.currentCycles (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.dividerRegister (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounter (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerModulo (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerEnabled (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerInputClock (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounterOverflowDelay (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounterWasReset (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.DMACycles (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.enabled (mut i32) (i32.const 1))
 (global $core/graphics/lcd/Lcd.bgWindowTileDataSelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgDisplayEnabled (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect (mut i32) (i32.const 0))
 (global $core/graphics/tiles/TileCache.tileId (mut i32) (i32.const -1))
 (global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck (mut i32) (i32.const -1))
 (global $core/graphics/lcd/Lcd.windowDisplayEnabled (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.spriteDisplayEnable (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.tallSpriteSize (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.currentLcdMode (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isHblankHdmaActive (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaSource (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaDestination (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.sweepCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0SweepPeriod (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isSweepEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.sweepShadowFrequency (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0SweepShift (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0Negate (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx3FrequencyLSB (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx4FrequencyMSB (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.volume (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.volume (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.volume (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.waveFormPositionOnDuty (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx1Duty (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.waveFormPositionOnDuty (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx1Duty (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.waveTablePosition (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.volumeCode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.divisor (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3ClockShift (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.linearFeedbackShiftRegister (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3WidthMode (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.downSampleCycleMultiplier (mut i32) (i32.const 48000))
 (global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize (mut i32) (i32.const 131072))
 (global $core/joypad/joypad/Joypad.joypadRegisterFlipped (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.isDpadType (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.up (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.right (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.down (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.left (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.isButtonType (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.a (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.b (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.select (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.start (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2StartingVolume (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2StartingVolume (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx2VolumeCode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2StartingVolume (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx3FrequencyLSB (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx4FrequencyMSB (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx3FrequencyLSB (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx4FrequencyMSB (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3DivisorCode (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.coincidenceCompare (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.memoryLocationHdmaTrigger (mut i32) (i32.const 65365))
 (global $core/memory/memory/Memory.memoryLocationHdmaSourceHigh (mut i32) (i32.const 65361))
 (global $core/memory/memory/Memory.memoryLocationHdmaSourceLow (mut i32) (i32.const 65362))
 (global $core/memory/memory/Memory.memoryLocationHdmaDestinationHigh (mut i32) (i32.const 65363))
 (global $core/memory/memory/Memory.memoryLocationHdmaDestinationLow (mut i32) (i32.const 65364))
 (global $core/graphics/palette/Palette.memoryLocationBackgroundPaletteIndex (mut i32) (i32.const 65384))
 (global $core/graphics/palette/Palette.memoryLocationSpritePaletteData (mut i32) (i32.const 65387))
 (global $core/graphics/palette/Palette.memoryLocationBackgroundPaletteData (mut i32) (i32.const 65385))
 (global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.dutyCycle (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.dutyCycle (mut i32) (i32.const 0))
 (global $~argc (mut i32) (i32.const 0))
 (global $core/legacy/wasmMemorySize i32 (i32.const 9109504))
 (global $core/legacy/wasmBoyInternalStateLocation i32 (i32.const 1024))
 (global $core/legacy/wasmBoyInternalStateSize i32 (i32.const 1024))
 (global $core/legacy/gameBoyInternalMemoryLocation i32 (i32.const 2048))
 (global $core/legacy/gameBoyInternalMemorySize i32 (i32.const 65535))
 (global $core/legacy/videoOutputLocation i32 (i32.const 67584))
 (global $core/legacy/gameboyColorPaletteLocation i32 (i32.const 67584))
 (global $core/legacy/gameboyColorPaletteSize i32 (i32.const 512))
 (global $core/legacy/frameInProgressVideoOutputLocation i32 (i32.const 93184))
 (global $core/legacy/backgroundMapLocation i32 (i32.const 232448))
 (global $core/legacy/tileDataMap i32 (i32.const 429056))
 (global $core/legacy/soundOutputLocation i32 (i32.const 588800))
 (global $core/legacy/gameRamBanksLocation i32 (i32.const 719872))
 (global $core/legacy/gameBytesLocation i32 (i32.const 850944))
 (memory $0 0)
 (export "memory" (memory $0))
 (export "config" (func $core/core/config))
 (export "executeFrame" (func $core/core/executeFrame))
 (export "executeFrameAndCheckAudio" (func $core/core/executeFrameAndCheckAudio))
 (export "executeFrameUntilBreakpoint" (func $core/core/executeFrameUntilBreakpoint))
 (export "executeStep" (func $core/core/executeStep))
 (export "saveState" (func $core/core/saveState))
 (export "loadState" (func $core/core/loadState))
 (export "hasCoreStarted" (func $core/core/hasCoreStarted))
 (export "setJoypadState" (func $core/joypad/joypad/setJoypadState))
 (export "getNumberOfSamplesInAudioBuffer" (func $core/sound/sound/getNumberOfSamplesInAudioBuffer))
 (export "clearAudioBuffer" (func $core/sound/sound/clearAudioBuffer))
 (export "WASMBOY_MEMORY_LOCATION" (global $core/constants/WASMBOY_MEMORY_LOCATION))
 (export "WASMBOY_MEMORY_SIZE" (global $core/constants/WASMBOY_MEMORY_SIZE))
 (export "WASMBOY_WASM_PAGES" (global $core/constants/WASMBOY_WASM_PAGES))
 (export "ASSEMBLYSCRIPT_MEMORY_LOCATION" (global $core/constants/ASSEMBLYSCRIPT_MEMORY_LOCATION))
 (export "ASSEMBLYSCRIPT_MEMORY_SIZE" (global $core/constants/ASSEMBLYSCRIPT_MEMORY_SIZE))
 (export "WASMBOY_STATE_LOCATION" (global $core/constants/WASMBOY_STATE_LOCATION))
 (export "WASMBOY_STATE_SIZE" (global $core/constants/WASMBOY_STATE_SIZE))
 (export "GAMEBOY_INTERNAL_MEMORY_LOCATION" (global $core/constants/GAMEBOY_INTERNAL_MEMORY_LOCATION))
 (export "GAMEBOY_INTERNAL_MEMORY_SIZE" (global $core/constants/GAMEBOY_INTERNAL_MEMORY_SIZE))
 (export "VIDEO_RAM_LOCATION" (global $core/constants/VIDEO_RAM_LOCATION))
 (export "VIDEO_RAM_SIZE" (global $core/constants/VIDEO_RAM_SIZE))
 (export "WORK_RAM_LOCATION" (global $core/constants/WORK_RAM_LOCATION))
 (export "WORK_RAM_SIZE" (global $core/constants/WORK_RAM_SIZE))
 (export "OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION" (global $core/constants/OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION))
 (export "OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE" (global $core/constants/OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE))
 (export "GRAPHICS_OUTPUT_LOCATION" (global $core/constants/GRAPHICS_OUTPUT_LOCATION))
 (export "GRAPHICS_OUTPUT_SIZE" (global $core/constants/GRAPHICS_OUTPUT_SIZE))
 (export "GBC_PALETTE_LOCATION" (global $core/constants/GBC_PALETTE_LOCATION))
 (export "GBC_PALETTE_SIZE" (global $core/constants/GBC_PALETTE_SIZE))
 (export "BG_PRIORITY_MAP_LOCATION" (global $core/constants/BG_PRIORITY_MAP_LOCATION))
 (export "BG_PRIORITY_MAP_SIZE" (global $core/constants/BG_PRIORITY_MAP_SIZE))
 (export "FRAME_LOCATION" (global $core/constants/FRAME_LOCATION))
 (export "FRAME_SIZE" (global $core/constants/FRAME_SIZE))
 (export "BACKGROUND_MAP_LOCATION" (global $core/constants/BACKGROUND_MAP_LOCATION))
 (export "BACKGROUND_MAP_SIZE" (global $core/constants/BACKGROUND_MAP_SIZE))
 (export "TILE_DATA_LOCATION" (global $core/constants/TILE_DATA_LOCATION))
 (export "TILE_DATA_SIZE" (global $core/constants/TILE_DATA_SIZE))
 (export "OAM_TILES_LOCATION" (global $core/constants/OAM_TILES_LOCATION))
 (export "OAM_TILES_SIZE" (global $core/constants/OAM_TILES_SIZE))
 (export "AUDIO_BUFFER_LOCATION" (global $core/constants/AUDIO_BUFFER_LOCATION))
 (export "AUDIO_BUFFER_SIZE" (global $core/constants/AUDIO_BUFFER_SIZE))
 (export "CARTRIDGE_RAM_LOCATION" (global $core/constants/CARTRIDGE_RAM_LOCATION))
 (export "CARTRIDGE_RAM_SIZE" (global $core/constants/CARTRIDGE_RAM_SIZE))
 (export "CARTRIDGE_ROM_LOCATION" (global $core/constants/CARTRIDGE_ROM_LOCATION))
 (export "CARTRIDGE_ROM_SIZE" (global $core/constants/CARTRIDGE_ROM_SIZE))
 (export "getWasmBoyOffsetFromGameBoyOffset" (func $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset))
 (export "getRegisterA" (func $core/debug/debug-cpu/getRegisterA))
 (export "getRegisterB" (func $core/debug/debug-cpu/getRegisterB))
 (export "getRegisterC" (func $core/debug/debug-cpu/getRegisterC))
 (export "getRegisterD" (func $core/debug/debug-cpu/getRegisterD))
 (export "getRegisterE" (func $core/debug/debug-cpu/getRegisterE))
 (export "getRegisterH" (func $core/debug/debug-cpu/getRegisterH))
 (export "getRegisterL" (func $core/debug/debug-cpu/getRegisterL))
 (export "getRegisterF" (func $core/debug/debug-cpu/getRegisterF))
 (export "getProgramCounter" (func $core/debug/debug-cpu/getProgramCounter))
 (export "getStackPointer" (func $core/debug/debug-cpu/getStackPointer))
 (export "getOpcodeAtProgramCounter" (func $core/debug/debug-cpu/getOpcodeAtProgramCounter))
 (export "getLY" (func $core/debug/debug-graphics/getLY))
 (export "_setargc" (func $~setargc))
 (export "drawBackgroundMapToWasmMemory" (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory|trampoline))
 (export "drawTileDataToWasmMemory" (func $core/debug/debug-graphics/drawTileDataToWasmMemory))
 (export "getDIV" (func $core/debug/debug-timer/getDIV))
 (export "getTIMA" (func $core/debug/debug-timer/getTIMA))
 (export "getTMA" (func $core/debug/debug-timer/getTMA))
 (export "getTAC" (func $core/debug/debug-timer/getTAC))
 (export "update" (func $core/core/executeFrame))
 (export "emulationStep" (func $core/core/executeStep))
 (export "getAudioQueueIndex" (func $core/sound/sound/getNumberOfSamplesInAudioBuffer))
 (export "resetAudioQueue" (func $core/sound/sound/clearAudioBuffer))
 (export "wasmMemorySize" (global $core/legacy/wasmMemorySize))
 (export "wasmBoyInternalStateLocation" (global $core/legacy/wasmBoyInternalStateLocation))
 (export "wasmBoyInternalStateSize" (global $core/legacy/wasmBoyInternalStateSize))
 (export "gameBoyInternalMemoryLocation" (global $core/legacy/gameBoyInternalMemoryLocation))
 (export "gameBoyInternalMemorySize" (global $core/legacy/gameBoyInternalMemorySize))
 (export "videoOutputLocation" (global $core/legacy/videoOutputLocation))
 (export "frameInProgressVideoOutputLocation" (global $core/legacy/frameInProgressVideoOutputLocation))
 (export "gameboyColorPaletteLocation" (global $core/legacy/gameboyColorPaletteLocation))
 (export "gameboyColorPaletteSize" (global $core/legacy/gameboyColorPaletteSize))
 (export "backgroundMapLocation" (global $core/legacy/backgroundMapLocation))
 (export "tileDataMap" (global $core/legacy/tileDataMap))
 (export "soundOutputLocation" (global $core/legacy/soundOutputLocation))
 (export "gameBytesLocation" (global $core/legacy/gameBytesLocation))
 (export "gameRamBanksLocation" (global $core/legacy/gameRamBanksLocation))
 (start $start)
 (func $core/memory/banking/getRomBankAddress (; 0 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/memory/banking.ts:103:2
  (set_local $1
   ;;@ core/memory/banking.ts:103:28
   (get_global $core/memory/memory/Memory.currentRomBank)
  )
  ;;@ core/memory/banking.ts:104:6
  (if
   (tee_local $2
    (i32.eqz
     ;;@ core/memory/banking.ts:104:7
     (get_global $core/memory/memory/Memory.isMBC5)
    )
   )
   (set_local $2
    (i32.eqz
     (get_local $1)
    )
   )
  )
  ;;@ core/memory/banking.ts:104:2
  (if
   (get_local $2)
   ;;@ core/memory/banking.ts:104:46
   (set_local $1
    ;;@ core/memory/banking.ts:105:21
    (i32.const 1)
   )
  )
  ;;@ core/memory/banking.ts:109:96
  (i32.add
   ;;@ core/memory/banking.ts:109:15
   (i32.shl
    (get_local $1)
    (i32.const 14)
   )
   ;;@ core/memory/banking.ts:109:41
   (i32.sub
    (get_local $0)
    (i32.const 16384)
   )
  )
 )
 (func $core/memory/banking/getRamBankAddress (; 1 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/memory/banking.ts:114:93
  (i32.add
   ;;@ core/memory/banking.ts:114:15
   (i32.shl
    ;;@ core/memory/banking.ts:114:24
    (get_global $core/memory/memory/Memory.currentRamBank)
    ;;@ core/memory/banking.ts:114:15
    (i32.const 13)
   )
   ;;@ core/memory/banking.ts:114:48
   (i32.sub
    (get_local $0)
    (i32.const 40960)
   )
  )
 )
 (func $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset (; 2 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (block $case14|0
   (block $case13|0
    (block $case12|0
     (block $case11|0
      (block $case9|0
       (block $case7|0
        (block $case3|0
         (set_local $1
          ;;@ core/memory/memoryMap.ts:35:2
          (tee_local $2
           ;;@ core/memory/memoryMap.ts:35:35
           (i32.shr_s
            (get_local $0)
            ;;@ core/memory/memoryMap.ts:35:52
            (i32.const 12)
           )
          )
         )
         (br_if $case3|0
          (i32.eqz
           (get_local $2)
          )
         )
         (block $tablify|0
          (br_table $case3|0 $case3|0 $case3|0 $case7|0 $case7|0 $case7|0 $case7|0 $case9|0 $case9|0 $case11|0 $case11|0 $case12|0 $case13|0 $tablify|0
           (i32.sub
            (get_local $1)
            (i32.const 1)
           )
          )
         )
         (br $case14|0)
        )
        ;;@ core/memory/memoryMap.ts:43:29
        (return
         ;;@ core/memory/memoryMap.ts:43:13
         (i32.add
          (get_local $0)
          (i32.const 850944)
         )
        )
       )
       ;;@ core/memory/memoryMap.ts:50:48
       (return
        ;;@ core/memory/memoryMap.ts:50:13
        (i32.add
         (call $core/memory/banking/getRomBankAddress
          (get_local $0)
         )
         (i32.const 850944)
        )
       )
      )
      ;;@ core/memory/memoryMap.ts:55:6
      (set_local $1
       ;;@ core/memory/memoryMap.ts:55:28
       (i32.const 0)
      )
      ;;@ core/memory/memoryMap.ts:56:6
      (if
       ;;@ core/memory/memoryMap.ts:56:10
       (get_global $core/cpu/cpu/Cpu.GBCEnabled)
       ;;@ core/memory/memoryMap.ts:56:26
       (set_local $1
        ;;@ core/memory/memoryMap.ts:58:21
        (i32.and
         (call $core/memory/load/eightBitLoadFromGBMemory
          ;;@ core/memory/memoryMap.ts:58:46
          (get_global $core/memory/memory/Memory.memoryLocationGBCVRAMBank)
         )
         ;;@ core/memory/memoryMap.ts:58:82
         (i32.const 1)
        )
       )
      )
      ;;@ core/memory/memoryMap.ts:63:85
      (return
       ;;@ core/memory/memoryMap.ts:63:13
       (i32.add
        (i32.add
         (get_local $0)
         (i32.const -30720)
        )
        ;;@ core/memory/memoryMap.ts:63:76
        (i32.shl
         (get_local $1)
         (i32.const 13)
        )
       )
      )
     )
     ;;@ core/memory/memoryMap.ts:68:48
     (return
      ;;@ core/memory/memoryMap.ts:68:13
      (i32.add
       (call $core/memory/banking/getRamBankAddress
        (get_local $0)
       )
       (i32.const 719872)
      )
     )
    )
    ;;@ core/memory/memoryMap.ts:73:66
    (return
     (i32.add
      (get_local $0)
      (i32.const -30720)
     )
    )
   )
   ;;@ core/memory/memoryMap.ts:83:6
   (set_local $1
    ;;@ core/memory/memoryMap.ts:83:28
    (i32.const 0)
   )
   ;;@ core/memory/memoryMap.ts:84:6
   (if
    ;;@ core/memory/memoryMap.ts:84:10
    (get_global $core/cpu/cpu/Cpu.GBCEnabled)
    ;;@ core/memory/memoryMap.ts:84:26
    (set_local $1
     ;;@ core/memory/memoryMap.ts:85:21
     (i32.and
      (call $core/memory/load/eightBitLoadFromGBMemory
       ;;@ core/memory/memoryMap.ts:85:46
       (get_global $core/memory/memory/Memory.memoryLocationGBCWRAMBank)
      )
      ;;@ core/memory/memoryMap.ts:85:82
      (i32.const 7)
     )
    )
   )
   ;;@ core/memory/memoryMap.ts:87:6
   (if
    ;;@ core/memory/memoryMap.ts:87:10
    (i32.lt_s
     (get_local $1)
     ;;@ core/memory/memoryMap.ts:87:23
     (i32.const 1)
    )
    ;;@ core/memory/memoryMap.ts:87:26
    (set_local $1
     ;;@ core/memory/memoryMap.ts:88:21
     (i32.const 1)
    )
   )
   ;;@ core/memory/memoryMap.ts:93:110
   (return
    (i32.add
     ;;@ core/memory/memoryMap.ts:93:13
     (i32.add
      (get_local $0)
      ;;@ core/memory/memoryMap.ts:93:86
      (i32.shl
       (get_local $1)
       (i32.const 12)
      )
     )
     (i32.const -34816)
    )
   )
  )
  (i32.add
   (get_local $0)
   (i32.const -6144)
  )
 )
 (func $core/memory/load/eightBitLoadFromGBMemory (; 3 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/memory/load.ts:7:71
  (i32.load8_u
   ;;@ core/memory/load.ts:7:23
   (call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    (get_local $0)
   )
  )
 )
 (func $core/cpu/cpu/initializeCpu (; 4 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cpu/cpu.ts:117:2
  (set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   ;;@ core/cpu/cpu.ts:117:23
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:118:2
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/cpu.ts:118:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:119:2
  (set_global $core/cpu/cpu/Cpu.registerB
   ;;@ core/cpu/cpu.ts:119:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:120:2
  (set_global $core/cpu/cpu/Cpu.registerC
   ;;@ core/cpu/cpu.ts:120:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:121:2
  (set_global $core/cpu/cpu/Cpu.registerD
   ;;@ core/cpu/cpu.ts:121:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:122:2
  (set_global $core/cpu/cpu/Cpu.registerE
   ;;@ core/cpu/cpu.ts:122:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:123:2
  (set_global $core/cpu/cpu/Cpu.registerH
   ;;@ core/cpu/cpu.ts:123:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:124:2
  (set_global $core/cpu/cpu/Cpu.registerL
   ;;@ core/cpu/cpu.ts:124:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:125:2
  (set_global $core/cpu/cpu/Cpu.registerF
   ;;@ core/cpu/cpu.ts:125:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:126:2
  (set_global $core/cpu/cpu/Cpu.stackPointer
   ;;@ core/cpu/cpu.ts:126:21
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:127:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/cpu.ts:127:23
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:128:2
  (set_global $core/cpu/cpu/Cpu.currentCycles
   ;;@ core/cpu/cpu.ts:128:22
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:129:2
  (set_global $core/cpu/cpu/Cpu.isHalted
   ;;@ core/cpu/cpu.ts:129:17
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:130:2
  (set_global $core/cpu/cpu/Cpu.isStopped
   ;;@ core/cpu/cpu.ts:130:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:132:2
  (if
   ;;@ core/cpu/cpu.ts:132:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/cpu/cpu.ts:132:22
   (block
    ;;@ core/cpu/cpu.ts:134:4
    (set_global $core/cpu/cpu/Cpu.registerA
     ;;@ core/cpu/cpu.ts:134:20
     (i32.const 17)
    )
    ;;@ core/cpu/cpu.ts:135:4
    (set_global $core/cpu/cpu/Cpu.registerF
     ;;@ core/cpu/cpu.ts:135:20
     (i32.const 128)
    )
    ;;@ core/cpu/cpu.ts:136:4
    (set_global $core/cpu/cpu/Cpu.registerB
     ;;@ core/cpu/cpu.ts:136:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:137:4
    (set_global $core/cpu/cpu/Cpu.registerC
     ;;@ core/cpu/cpu.ts:137:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:138:4
    (set_global $core/cpu/cpu/Cpu.registerD
     ;;@ core/cpu/cpu.ts:138:20
     (i32.const 255)
    )
    ;;@ core/cpu/cpu.ts:139:4
    (set_global $core/cpu/cpu/Cpu.registerE
     ;;@ core/cpu/cpu.ts:139:20
     (i32.const 86)
    )
    ;;@ core/cpu/cpu.ts:140:4
    (set_global $core/cpu/cpu/Cpu.registerH
     ;;@ core/cpu/cpu.ts:140:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:141:4
    (set_global $core/cpu/cpu/Cpu.registerL
     ;;@ core/cpu/cpu.ts:141:20
     (i32.const 13)
    )
   )
   ;;@ core/cpu/cpu.ts:146:9
   (block
    ;;@ core/cpu/cpu.ts:148:4
    (set_global $core/cpu/cpu/Cpu.registerA
     ;;@ core/cpu/cpu.ts:148:20
     (i32.const 1)
    )
    ;;@ core/cpu/cpu.ts:149:4
    (set_global $core/cpu/cpu/Cpu.registerF
     ;;@ core/cpu/cpu.ts:149:20
     (i32.const 176)
    )
    ;;@ core/cpu/cpu.ts:150:4
    (set_global $core/cpu/cpu/Cpu.registerB
     ;;@ core/cpu/cpu.ts:150:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:151:4
    (set_global $core/cpu/cpu/Cpu.registerC
     ;;@ core/cpu/cpu.ts:151:20
     (i32.const 19)
    )
    ;;@ core/cpu/cpu.ts:152:4
    (set_global $core/cpu/cpu/Cpu.registerD
     ;;@ core/cpu/cpu.ts:152:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:153:4
    (set_global $core/cpu/cpu/Cpu.registerE
     ;;@ core/cpu/cpu.ts:153:20
     (i32.const 216)
    )
    ;;@ core/cpu/cpu.ts:154:4
    (set_global $core/cpu/cpu/Cpu.registerH
     ;;@ core/cpu/cpu.ts:154:20
     (i32.const 1)
    )
    ;;@ core/cpu/cpu.ts:155:4
    (set_global $core/cpu/cpu/Cpu.registerL
     ;;@ core/cpu/cpu.ts:155:20
     (i32.const 77)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:144:4
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/cpu.ts:144:25
   (i32.const 256)
  )
  ;;@ core/cpu/cpu.ts:145:4
  (set_global $core/cpu/cpu/Cpu.stackPointer
   ;;@ core/cpu/cpu.ts:145:23
   (i32.const 65534)
  )
 )
 (func $core/memory/memory/initializeCartridge (; 5 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/memory/memory.ts:135:2
  (set_global $core/memory/memory/Memory.isRamBankingEnabled
   ;;@ core/memory/memory.ts:135:31
   (i32.const 0)
  )
  ;;@ core/memory/memory.ts:136:2
  (set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
   ;;@ core/memory/memory.ts:136:32
   (i32.const 1)
  )
  ;;@ core/memory/memory.ts:140:2
  (set_local $1
   ;;@ core/memory/memory.ts:140:27
   (call $core/memory/load/eightBitLoadFromGBMemory
    ;;@ core/memory/memory.ts:140:52
    (i32.const 327)
   )
  )
  ;;@ core/memory/memory.ts:143:2
  (set_global $core/memory/memory/Memory.isRomOnly
   ;;@ core/memory/memory.ts:143:21
   (i32.const 0)
  )
  ;;@ core/memory/memory.ts:144:2
  (set_global $core/memory/memory/Memory.isMBC1
   ;;@ core/memory/memory.ts:144:18
   (i32.const 0)
  )
  ;;@ core/memory/memory.ts:145:2
  (set_global $core/memory/memory/Memory.isMBC2
   ;;@ core/memory/memory.ts:145:18
   (i32.const 0)
  )
  ;;@ core/memory/memory.ts:146:2
  (set_global $core/memory/memory/Memory.isMBC3
   ;;@ core/memory/memory.ts:146:18
   (i32.const 0)
  )
  ;;@ core/memory/memory.ts:147:2
  (set_global $core/memory/memory/Memory.isMBC5
   ;;@ core/memory/memory.ts:147:18
   (i32.const 0)
  )
  ;;@ core/memory/memory.ts:149:2
  (if
   (get_local $1)
   (block
    ;;@ core/memory/memory.ts:151:13
    (if
     (tee_local $0
      (i32.ge_s
       (get_local $1)
       ;;@ core/memory/memory.ts:151:30
       (i32.const 1)
      )
     )
     (set_local $0
      ;;@ core/memory/memory.ts:151:38
      (i32.le_s
       (get_local $1)
       ;;@ core/memory/memory.ts:151:55
       (i32.const 3)
      )
     )
    )
    ;;@ core/memory/memory.ts:151:9
    (if
     (get_local $0)
     ;;@ core/memory/memory.ts:151:61
     (set_global $core/memory/memory/Memory.isMBC1
      ;;@ core/memory/memory.ts:152:20
      (i32.const 1)
     )
     (block
      ;;@ core/memory/memory.ts:153:13
      (if
       (tee_local $0
        (i32.ge_s
         (get_local $1)
         ;;@ core/memory/memory.ts:153:30
         (i32.const 5)
        )
       )
       (set_local $0
        ;;@ core/memory/memory.ts:153:38
        (i32.le_s
         (get_local $1)
         ;;@ core/memory/memory.ts:153:55
         (i32.const 6)
        )
       )
      )
      ;;@ core/memory/memory.ts:153:9
      (if
       (get_local $0)
       ;;@ core/memory/memory.ts:153:61
       (set_global $core/memory/memory/Memory.isMBC2
        ;;@ core/memory/memory.ts:154:20
        (i32.const 1)
       )
       (block
        ;;@ core/memory/memory.ts:155:13
        (if
         (tee_local $0
          (i32.ge_s
           (get_local $1)
           ;;@ core/memory/memory.ts:155:30
           (i32.const 15)
          )
         )
         (set_local $0
          ;;@ core/memory/memory.ts:155:38
          (i32.le_s
           (get_local $1)
           ;;@ core/memory/memory.ts:155:55
           (i32.const 19)
          )
         )
        )
        ;;@ core/memory/memory.ts:155:9
        (if
         (get_local $0)
         ;;@ core/memory/memory.ts:155:61
         (set_global $core/memory/memory/Memory.isMBC3
          ;;@ core/memory/memory.ts:156:20
          (i32.const 1)
         )
         (block
          ;;@ core/memory/memory.ts:157:13
          (if
           (tee_local $0
            (i32.ge_s
             (get_local $1)
             ;;@ core/memory/memory.ts:157:30
             (i32.const 25)
            )
           )
           (set_local $0
            ;;@ core/memory/memory.ts:157:38
            (i32.le_s
             (get_local $1)
             ;;@ core/memory/memory.ts:157:55
             (i32.const 30)
            )
           )
          )
          ;;@ core/memory/memory.ts:157:9
          (if
           (get_local $0)
           ;;@ core/memory/memory.ts:157:61
           (set_global $core/memory/memory/Memory.isMBC5
            ;;@ core/memory/memory.ts:158:20
            (i32.const 1)
           )
          )
         )
        )
       )
      )
     )
    )
   )
   ;;@ core/memory/memory.ts:149:30
   (set_global $core/memory/memory/Memory.isRomOnly
    ;;@ core/memory/memory.ts:150:23
    (i32.const 1)
   )
  )
  ;;@ core/memory/memory.ts:161:2
  (set_global $core/memory/memory/Memory.currentRomBank
   ;;@ core/memory/memory.ts:161:26
   (i32.const 1)
  )
  ;;@ core/memory/memory.ts:162:2
  (set_global $core/memory/memory/Memory.currentRamBank
   ;;@ core/memory/memory.ts:162:26
   (i32.const 0)
  )
 )
 (func $core/memory/store/eightBitStoreIntoGBMemory (; 6 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/memory/store.ts:7:2
  (i32.store8
   ;;@ core/memory/store.ts:7:12
   (call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    (get_local $0)
   )
   (get_local $1)
  )
 )
 (func $core/memory/dma/initializeDma (; 7 ;) (; has Stack IR ;) (type $v)
  ;;@ core/memory/dma.ts:10:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/memory/dma.ts:10:30
   (i32.const 65361)
   ;;@ core/memory/dma.ts:10:38
   (i32.const 255)
  )
  ;;@ core/memory/dma.ts:11:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/memory/dma.ts:11:30
   (i32.const 65362)
   ;;@ core/memory/dma.ts:11:38
   (i32.const 255)
  )
  ;;@ core/memory/dma.ts:12:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/memory/dma.ts:12:30
   (i32.const 65363)
   ;;@ core/memory/dma.ts:12:38
   (i32.const 255)
  )
  ;;@ core/memory/dma.ts:13:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/memory/dma.ts:13:30
   (i32.const 65364)
   ;;@ core/memory/dma.ts:13:38
   (i32.const 255)
  )
  ;;@ core/memory/dma.ts:14:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/memory/dma.ts:14:30
   (i32.const 65365)
   ;;@ core/memory/dma.ts:14:38
   (i32.const 255)
  )
 )
 (func $core/graphics/graphics/initializeGraphics (; 8 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/graphics.ts:135:2
  (set_global $core/graphics/graphics/Graphics.currentCycles
   ;;@ core/graphics/graphics.ts:135:27
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:136:2
  (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   ;;@ core/graphics/graphics.ts:136:34
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:137:2
  (set_global $core/graphics/graphics/Graphics.scanlineRegister
   ;;@ core/graphics/graphics.ts:137:30
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:138:2
  (set_global $core/graphics/graphics/Graphics.scrollX
   ;;@ core/graphics/graphics.ts:138:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:139:2
  (set_global $core/graphics/graphics/Graphics.scrollY
   ;;@ core/graphics/graphics.ts:139:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:140:2
  (set_global $core/graphics/graphics/Graphics.windowX
   ;;@ core/graphics/graphics.ts:140:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:141:2
  (set_global $core/graphics/graphics/Graphics.windowY
   ;;@ core/graphics/graphics.ts:141:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:143:2
  (if
   ;;@ core/graphics/graphics.ts:143:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/graphics/graphics.ts:143:22
   (block
    ;;@ core/graphics/graphics.ts:145:4
    (set_global $core/graphics/graphics/Graphics.scanlineRegister
     ;;@ core/graphics/graphics.ts:145:32
     (i32.const 144)
    )
    ;;@ core/graphics/graphics.ts:146:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:146:30
     (i32.const 65344)
     ;;@ core/graphics/graphics.ts:146:38
     (i32.const 145)
    )
    ;;@ core/graphics/graphics.ts:147:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:147:30
     (i32.const 65345)
     ;;@ core/graphics/graphics.ts:147:38
     (i32.const 129)
    )
    ;;@ core/graphics/graphics.ts:149:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:149:30
     (i32.const 65348)
     ;;@ core/graphics/graphics.ts:149:38
     (i32.const 144)
    )
    ;;@ core/graphics/graphics.ts:151:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:151:30
     (i32.const 65351)
     ;;@ core/graphics/graphics.ts:151:38
     (i32.const 252)
    )
   )
   ;;@ core/graphics/graphics.ts:157:9
   (block
    ;;@ core/graphics/graphics.ts:158:4
    (set_global $core/graphics/graphics/Graphics.scanlineRegister
     ;;@ core/graphics/graphics.ts:158:32
     (i32.const 144)
    )
    ;;@ core/graphics/graphics.ts:159:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:159:30
     (i32.const 65344)
     ;;@ core/graphics/graphics.ts:159:38
     (i32.const 145)
    )
    ;;@ core/graphics/graphics.ts:160:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:160:30
     (i32.const 65345)
     ;;@ core/graphics/graphics.ts:160:38
     (i32.const 133)
    )
    ;;@ core/graphics/graphics.ts:162:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:162:30
     (i32.const 65350)
     ;;@ core/graphics/graphics.ts:162:38
     (i32.const 255)
    )
    ;;@ core/graphics/graphics.ts:163:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:163:30
     (i32.const 65351)
     ;;@ core/graphics/graphics.ts:163:38
     (i32.const 252)
    )
    ;;@ core/graphics/graphics.ts:164:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:164:30
     (i32.const 65352)
     ;;@ core/graphics/graphics.ts:164:38
     (i32.const 255)
    )
    ;;@ core/graphics/graphics.ts:165:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:165:30
     (i32.const 65353)
     ;;@ core/graphics/graphics.ts:165:38
     (i32.const 255)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:155:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/graphics/graphics.ts:155:30
   (i32.const 65359)
   ;;@ core/graphics/graphics.ts:155:38
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:156:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/graphics/graphics.ts:156:30
   (i32.const 65392)
   ;;@ core/graphics/graphics.ts:156:38
   (i32.const 1)
  )
 )
 (func $core/graphics/palette/initializePalette (; 9 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/palette.ts:16:2
  (if
   ;;@ core/graphics/palette.ts:16:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/graphics/palette.ts:16:22
   (block
    ;;@ core/graphics/palette.ts:18:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:18:30
     (i32.const 65384)
     ;;@ core/graphics/palette.ts:18:38
     (i32.const 192)
    )
    ;;@ core/graphics/palette.ts:19:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:19:30
     (i32.const 65385)
     ;;@ core/graphics/palette.ts:19:38
     (i32.const 255)
    )
    ;;@ core/graphics/palette.ts:20:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:20:30
     (i32.const 65386)
     ;;@ core/graphics/palette.ts:20:38
     (i32.const 193)
    )
    ;;@ core/graphics/palette.ts:21:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:21:30
     (i32.const 65387)
     ;;@ core/graphics/palette.ts:21:38
     (i32.const 13)
    )
   )
   ;;@ core/graphics/palette.ts:22:9
   (block
    ;;@ core/graphics/palette.ts:24:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:24:30
     (i32.const 65384)
     ;;@ core/graphics/palette.ts:24:38
     (i32.const 255)
    )
    ;;@ core/graphics/palette.ts:25:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:25:30
     (i32.const 65385)
     ;;@ core/graphics/palette.ts:25:38
     (i32.const 255)
    )
    ;;@ core/graphics/palette.ts:26:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:26:30
     (i32.const 65386)
     ;;@ core/graphics/palette.ts:26:38
     (i32.const 255)
    )
    ;;@ core/graphics/palette.ts:27:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/palette.ts:27:30
     (i32.const 65387)
     ;;@ core/graphics/palette.ts:27:38
     (i32.const 255)
    )
   )
  )
 )
 (func $core/sound/channel1/Channel1.initialize (; 10 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel1.ts:146:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65296)
   ;;@ core/sound/channel1.ts:146:59
   (i32.const 128)
  )
  ;;@ core/sound/channel1.ts:147:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65297)
   ;;@ core/sound/channel1.ts:147:59
   (i32.const 191)
  )
  ;;@ core/sound/channel1.ts:148:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65298)
   ;;@ core/sound/channel1.ts:148:59
   (i32.const 243)
  )
  ;;@ core/sound/channel1.ts:149:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65299)
   ;;@ core/sound/channel1.ts:149:59
   (i32.const 193)
  )
  ;;@ core/sound/channel1.ts:150:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65300)
   ;;@ core/sound/channel1.ts:150:59
   (i32.const 191)
  )
 )
 (func $core/sound/channel2/Channel2.initialize (; 11 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel2.ts:122:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65301)
   ;;@ core/sound/channel2.ts:122:63
   (i32.const 255)
  )
  ;;@ core/sound/channel2.ts:123:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65302)
   ;;@ core/sound/channel2.ts:123:59
   (i32.const 63)
  )
  ;;@ core/sound/channel2.ts:124:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65303)
   ;;@ core/sound/channel2.ts:124:59
   (i32.const 0)
  )
  ;;@ core/sound/channel2.ts:125:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65304)
   ;;@ core/sound/channel2.ts:125:59
   (i32.const 0)
  )
  ;;@ core/sound/channel2.ts:126:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65305)
   ;;@ core/sound/channel2.ts:126:59
   (i32.const 184)
  )
 )
 (func $core/sound/channel3/Channel3.initialize (; 12 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:112:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65306)
   ;;@ core/sound/channel3.ts:112:59
   (i32.const 127)
  )
  ;;@ core/sound/channel3.ts:113:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65307)
   ;;@ core/sound/channel3.ts:113:59
   (i32.const 255)
  )
  ;;@ core/sound/channel3.ts:114:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65308)
   ;;@ core/sound/channel3.ts:114:59
   (i32.const 159)
  )
  ;;@ core/sound/channel3.ts:115:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65309)
   ;;@ core/sound/channel3.ts:115:59
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:116:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65310)
   ;;@ core/sound/channel3.ts:116:59
   (i32.const 184)
  )
  ;;@ core/sound/channel3.ts:119:4
  (set_global $core/sound/channel3/Channel3.volumeCodeChanged
   ;;@ core/sound/channel3.ts:119:33
   (i32.const 1)
  )
 )
 (func $core/sound/channel4/Channel4.initialize (; 13 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel4.ts:139:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65311)
   ;;@ core/sound/channel4.ts:139:63
   (i32.const 255)
  )
  ;;@ core/sound/channel4.ts:140:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65312)
   ;;@ core/sound/channel4.ts:140:59
   (i32.const 255)
  )
  ;;@ core/sound/channel4.ts:141:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65313)
   ;;@ core/sound/channel4.ts:141:59
   (i32.const 0)
  )
  ;;@ core/sound/channel4.ts:142:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65314)
   ;;@ core/sound/channel4.ts:142:59
   (i32.const 0)
  )
  ;;@ core/sound/channel4.ts:143:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65315)
   ;;@ core/sound/channel4.ts:143:59
   (i32.const 191)
  )
 )
 (func $core/sound/accumulator/initializeSoundAccumulator (; 14 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/accumulator.ts:28:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
   ;;@ core/sound/accumulator.ts:28:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:29:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
   ;;@ core/sound/accumulator.ts:29:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:30:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
   ;;@ core/sound/accumulator.ts:30:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:31:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
   ;;@ core/sound/accumulator.ts:31:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:32:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
   ;;@ core/sound/accumulator.ts:32:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:33:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
   ;;@ core/sound/accumulator.ts:33:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:34:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
   ;;@ core/sound/accumulator.ts:34:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:35:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
   ;;@ core/sound/accumulator.ts:35:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:36:2
  (set_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
   ;;@ core/sound/accumulator.ts:36:51
   (i32.const 127)
  )
  ;;@ core/sound/accumulator.ts:37:2
  (set_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
   ;;@ core/sound/accumulator.ts:37:52
   (i32.const 127)
  )
  ;;@ core/sound/accumulator.ts:38:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
   ;;@ core/sound/accumulator.ts:38:40
   (i32.const 1)
  )
  ;;@ core/sound/accumulator.ts:39:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
   ;;@ core/sound/accumulator.ts:39:41
   (i32.const 1)
  )
  ;;@ core/sound/accumulator.ts:40:2
  (set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
   ;;@ core/sound/accumulator.ts:40:40
   (i32.const 0)
  )
 )
 (func $core/sound/sound/initializeSound (; 15 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/sound.ts:145:2
  (set_global $core/sound/sound/Sound.currentCycles
   ;;@ core/sound/sound.ts:145:24
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:146:2
  (set_global $core/sound/sound/Sound.NR50LeftMixerVolume
   ;;@ core/sound/sound.ts:146:30
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:147:2
  (set_global $core/sound/sound/Sound.NR50RightMixerVolume
   ;;@ core/sound/sound.ts:147:31
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:148:2
  (set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:148:44
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:149:2
  (set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:149:44
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:150:2
  (set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:150:44
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:151:2
  (set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:151:44
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:152:2
  (set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
   ;;@ core/sound/sound.ts:152:45
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:153:2
  (set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
   ;;@ core/sound/sound.ts:153:45
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:154:2
  (set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
   ;;@ core/sound/sound.ts:154:45
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:155:2
  (set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
   ;;@ core/sound/sound.ts:155:45
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:156:2
  (set_global $core/sound/sound/Sound.NR52IsSoundEnabled
   ;;@ core/sound/sound.ts:156:29
   (i32.const 1)
  )
  ;;@ core/sound/sound.ts:157:2
  (set_global $core/sound/sound/Sound.frameSequenceCycleCounter
   ;;@ core/sound/sound.ts:157:36
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:158:2
  (set_global $core/sound/sound/Sound.downSampleCycleCounter
   ;;@ core/sound/sound.ts:158:33
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:159:2
  (set_global $core/sound/sound/Sound.frameSequencer
   ;;@ core/sound/sound.ts:159:25
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:160:2
  (set_global $core/sound/sound/Sound.audioQueueIndex
   ;;@ core/sound/sound.ts:160:26
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:163:11
  (call $core/sound/channel1/Channel1.initialize)
  ;;@ core/sound/sound.ts:164:11
  (call $core/sound/channel2/Channel2.initialize)
  ;;@ core/sound/sound.ts:165:11
  (call $core/sound/channel3/Channel3.initialize)
  ;;@ core/sound/sound.ts:166:11
  (call $core/sound/channel4/Channel4.initialize)
  ;;@ core/sound/sound.ts:169:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65316)
   ;;@ core/sound/sound.ts:169:54
   (i32.const 119)
  )
  ;;@ core/sound/sound.ts:170:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65317)
   ;;@ core/sound/sound.ts:170:54
   (i32.const 243)
  )
  ;;@ core/sound/sound.ts:171:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65318)
   ;;@ core/sound/sound.ts:171:54
   (i32.const 241)
  )
  ;;@ core/sound/sound.ts:173:2
  (call $core/sound/accumulator/initializeSoundAccumulator)
 )
 (func $core/timers/timers/initializeTimers (; 16 ;) (; has Stack IR ;) (type $v)
  ;;@ core/timers/timers.ts:161:2
  (set_global $core/timers/timers/Timers.currentCycles
   ;;@ core/timers/timers.ts:161:25
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:162:2
  (set_global $core/timers/timers/Timers.dividerRegister
   ;;@ core/timers/timers.ts:162:27
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:163:2
  (set_global $core/timers/timers/Timers.timerCounter
   ;;@ core/timers/timers.ts:163:24
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:164:2
  (set_global $core/timers/timers/Timers.timerModulo
   ;;@ core/timers/timers.ts:164:23
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:165:2
  (set_global $core/timers/timers/Timers.timerEnabled
   ;;@ core/timers/timers.ts:165:24
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:166:2
  (set_global $core/timers/timers/Timers.timerInputClock
   ;;@ core/timers/timers.ts:166:27
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:167:2
  (set_global $core/timers/timers/Timers.timerCounterOverflowDelay
   ;;@ core/timers/timers.ts:167:37
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:168:2
  (set_global $core/timers/timers/Timers.timerCounterWasReset
   ;;@ core/timers/timers.ts:168:32
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:170:2
  (if
   ;;@ core/timers/timers.ts:170:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/timers/timers.ts:170:22
   (block
    ;;@ core/timers/timers.ts:172:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/timers/timers.ts:172:30
     (i32.const 65284)
     ;;@ core/timers/timers.ts:172:38
     (i32.const 30)
    )
    ;;@ core/timers/timers.ts:173:4
    (set_global $core/timers/timers/Timers.dividerRegister
     ;;@ core/timers/timers.ts:173:29
     (i32.const 7840)
    )
   )
   ;;@ core/timers/timers.ts:180:9
   (block
    ;;@ core/timers/timers.ts:182:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/timers/timers.ts:182:30
     (i32.const 65284)
     ;;@ core/timers/timers.ts:182:38
     (i32.const 171)
    )
    ;;@ core/timers/timers.ts:183:4
    (set_global $core/timers/timers/Timers.dividerRegister
     ;;@ core/timers/timers.ts:183:29
     (i32.const 43980)
    )
   )
  )
  ;;@ core/timers/timers.ts:178:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/timers/timers.ts:178:30
   (i32.const 65287)
   ;;@ core/timers/timers.ts:178:38
   (i32.const 248)
  )
  ;;@ core/timers/timers.ts:179:4
  (set_global $core/timers/timers/Timers.timerInputClock
   ;;@ core/timers/timers.ts:179:29
   (i32.const 248)
  )
 )
 (func $core/core/initialize (; 17 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/core.ts:123:6
  (if
   (i32.eqz
    (tee_local $0
     (i32.eq
      ;;@ core/core.ts:120:2
      (tee_local $1
       ;;@ core/core.ts:120:21
       (call $core/memory/load/eightBitLoadFromGBMemory
        ;;@ core/core.ts:120:46
        (i32.const 323)
       )
      )
      ;;@ core/core.ts:123:18
      (i32.const 192)
     )
    )
   )
   (set_local $0
    ;;@ core/core.ts:123:26
    (if (result i32)
     ;;@ core/core.ts:123:27
     (get_global $core/config/Config.useGbcWhenAvailable)
     ;;@ core/core.ts:123:57
     (i32.eq
      (get_local $1)
      ;;@ core/core.ts:123:69
      (i32.const 128)
     )
     (get_global $core/config/Config.useGbcWhenAvailable)
    )
   )
  )
  ;;@ core/core.ts:123:2
  (if
   (get_local $0)
   ;;@ core/core.ts:123:76
   (set_global $core/cpu/cpu/Cpu.GBCEnabled
    ;;@ core/core.ts:124:21
    (i32.const 1)
   )
   ;;@ core/core.ts:125:9
   (set_global $core/cpu/cpu/Cpu.GBCEnabled
    ;;@ core/core.ts:126:21
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:130:2
  (call $core/cpu/cpu/initializeCpu)
  ;;@ core/core.ts:131:2
  (call $core/memory/memory/initializeCartridge)
  ;;@ core/core.ts:132:2
  (call $core/memory/dma/initializeDma)
  ;;@ core/core.ts:133:2
  (call $core/graphics/graphics/initializeGraphics)
  ;;@ core/core.ts:134:2
  (call $core/graphics/palette/initializePalette)
  ;;@ core/core.ts:135:2
  (call $core/sound/sound/initializeSound)
  ;;@ core/core.ts:136:2
  (call $core/timers/timers/initializeTimers)
  ;;@ core/core.ts:139:2
  (if
   ;;@ core/core.ts:139:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/core.ts:139:22
   (block
    ;;@ core/core.ts:141:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:141:30
     (i32.const 65392)
     ;;@ core/core.ts:141:38
     (i32.const 248)
    )
    ;;@ core/core.ts:142:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:142:30
     (i32.const 65359)
     ;;@ core/core.ts:142:38
     (i32.const 254)
    )
    ;;@ core/core.ts:143:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:143:30
     (i32.const 65357)
     ;;@ core/core.ts:143:38
     (i32.const 126)
    )
    ;;@ core/core.ts:144:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:144:30
     (i32.const 65280)
     ;;@ core/core.ts:144:38
     (i32.const 207)
    )
    ;;@ core/core.ts:146:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:146:30
     (i32.const 65282)
     ;;@ core/core.ts:146:38
     (i32.const 124)
    )
    ;;@ core/core.ts:148:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:148:30
     (i32.const 65295)
     ;;@ core/core.ts:148:38
     (i32.const 225)
    )
    ;;@ core/core.ts:152:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:152:30
     (i32.const 65388)
     ;;@ core/core.ts:152:38
     (i32.const 254)
    )
    ;;@ core/core.ts:153:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:153:30
     (i32.const 65397)
     ;;@ core/core.ts:153:38
     (i32.const 143)
    )
   )
   ;;@ core/core.ts:154:9
   (block
    ;;@ core/core.ts:155:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:155:30
     (i32.const 65392)
     ;;@ core/core.ts:155:38
     (i32.const 255)
    )
    ;;@ core/core.ts:156:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:156:30
     (i32.const 65359)
     ;;@ core/core.ts:156:38
     (i32.const 255)
    )
    ;;@ core/core.ts:157:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:157:30
     (i32.const 65357)
     ;;@ core/core.ts:157:38
     (i32.const 255)
    )
    ;;@ core/core.ts:158:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:158:30
     (i32.const 65280)
     ;;@ core/core.ts:158:38
     (i32.const 207)
    )
    ;;@ core/core.ts:160:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:160:30
     (i32.const 65282)
     ;;@ core/core.ts:160:38
     (i32.const 126)
    )
    ;;@ core/core.ts:162:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:162:30
     (i32.const 65295)
     ;;@ core/core.ts:162:38
     (i32.const 225)
    )
   )
  )
  ;;@ core/core.ts:167:2
  (set_global $core/core/hasStarted
   ;;@ core/core.ts:167:15
   (i32.const 0)
  )
 )
 (func $core/core/config (; 18 ;) (; has Stack IR ;) (type $iiiiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32)
  ;;@ core/core.ts:56:2
  (if
   ;;@ core/core.ts:56:6
   (i32.gt_s
    (get_local $0)
    ;;@ core/core.ts:56:22
    (i32.const 0)
   )
   ;;@ core/core.ts:56:25
   (set_global $core/config/Config.enableBootRom
    ;;@ core/core.ts:57:27
    (i32.const 1)
   )
   ;;@ core/core.ts:58:9
   (set_global $core/config/Config.enableBootRom
    ;;@ core/core.ts:59:27
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:62:2
  (if
   ;;@ core/core.ts:62:6
   (i32.gt_s
    (get_local $1)
    ;;@ core/core.ts:62:28
    (i32.const 0)
   )
   ;;@ core/core.ts:62:31
   (set_global $core/config/Config.useGbcWhenAvailable
    ;;@ core/core.ts:63:33
    (i32.const 1)
   )
   ;;@ core/core.ts:64:9
   (set_global $core/config/Config.useGbcWhenAvailable
    ;;@ core/core.ts:65:33
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:68:2
  (if
   ;;@ core/core.ts:68:6
   (i32.gt_s
    (get_local $2)
    ;;@ core/core.ts:68:29
    (i32.const 0)
   )
   ;;@ core/core.ts:68:32
   (set_global $core/config/Config.audioBatchProcessing
    ;;@ core/core.ts:69:34
    (i32.const 1)
   )
   ;;@ core/core.ts:70:9
   (set_global $core/config/Config.audioBatchProcessing
    ;;@ core/core.ts:71:34
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:74:2
  (if
   ;;@ core/core.ts:74:6
   (i32.gt_s
    (get_local $3)
    ;;@ core/core.ts:74:32
    (i32.const 0)
   )
   ;;@ core/core.ts:74:35
   (set_global $core/config/Config.graphicsBatchProcessing
    ;;@ core/core.ts:75:37
    (i32.const 1)
   )
   ;;@ core/core.ts:76:9
   (set_global $core/config/Config.graphicsBatchProcessing
    ;;@ core/core.ts:77:37
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:80:2
  (if
   ;;@ core/core.ts:80:6
   (i32.gt_s
    (get_local $4)
    ;;@ core/core.ts:80:30
    (i32.const 0)
   )
   ;;@ core/core.ts:80:33
   (set_global $core/config/Config.timersBatchProcessing
    ;;@ core/core.ts:81:35
    (i32.const 1)
   )
   ;;@ core/core.ts:82:9
   (set_global $core/config/Config.timersBatchProcessing
    ;;@ core/core.ts:83:35
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:86:2
  (if
   ;;@ core/core.ts:86:6
   (i32.gt_s
    (get_local $5)
    ;;@ core/core.ts:86:41
    (i32.const 0)
   )
   ;;@ core/core.ts:86:44
   (set_global $core/config/Config.graphicsDisableScanlineRendering
    ;;@ core/core.ts:87:46
    (i32.const 1)
   )
   ;;@ core/core.ts:88:9
   (set_global $core/config/Config.graphicsDisableScanlineRendering
    ;;@ core/core.ts:89:46
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:92:2
  (if
   ;;@ core/core.ts:92:6
   (i32.gt_s
    (get_local $6)
    ;;@ core/core.ts:92:31
    (i32.const 0)
   )
   ;;@ core/core.ts:92:34
   (set_global $core/config/Config.audioAccumulateSamples
    ;;@ core/core.ts:93:36
    (i32.const 1)
   )
   ;;@ core/core.ts:94:9
   (set_global $core/config/Config.audioAccumulateSamples
    ;;@ core/core.ts:95:36
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:98:2
  (if
   ;;@ core/core.ts:98:6
   (i32.gt_s
    (get_local $7)
    ;;@ core/core.ts:98:22
    (i32.const 0)
   )
   ;;@ core/core.ts:98:25
   (set_global $core/config/Config.tileRendering
    ;;@ core/core.ts:99:27
    (i32.const 1)
   )
   ;;@ core/core.ts:100:9
   (set_global $core/config/Config.tileRendering
    ;;@ core/core.ts:101:27
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:104:2
  (if
   ;;@ core/core.ts:104:6
   (i32.gt_s
    (get_local $8)
    ;;@ core/core.ts:104:20
    (i32.const 0)
   )
   ;;@ core/core.ts:104:23
   (set_global $core/config/Config.tileCaching
    ;;@ core/core.ts:105:25
    (i32.const 1)
   )
   ;;@ core/core.ts:106:9
   (set_global $core/config/Config.tileCaching
    ;;@ core/core.ts:107:25
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:110:2
  (call $core/core/initialize)
 )
 (func $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME (; 19 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/cpu.ts:52:4
  (if
   ;;@ core/cpu/cpu.ts:52:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 140448)
   )
  )
  (i32.const 70224)
 )
 (func $core/portable/portable/u16Portable (; 20 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/portable/portable.ts:12:17
  (i32.and
   (get_local $0)
   (i32.const 65535)
  )
 )
 (func $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE (; 21 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:39:4
  (if
   ;;@ core/graphics/graphics.ts:39:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 912)
   )
  )
  (i32.const 456)
 )
 (func $core/graphics/graphics/Graphics.batchProcessCycles (; 22 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:30:44
  (call $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE)
 )
 (func $core/graphics/graphics/loadFromVramBank (; 23 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/graphics/graphics.ts:303:32
  (i32.load8_u
   ;;@ core/graphics/graphics.ts:302:28
   (i32.add
    (i32.add
     (get_local $0)
     (i32.const -30720)
    )
    ;;@ core/graphics/graphics.ts:302:105
    (i32.shl
     ;;@ core/graphics/graphics.ts:302:114
     (i32.and
      (get_local $1)
      ;;@ core/graphics/graphics.ts:302:128
      (i32.const 1)
     )
     ;;@ core/graphics/graphics.ts:302:105
     (i32.const 13)
    )
   )
  )
 )
 (func $core/helpers/index/checkBitOnByte (; 24 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/helpers/index.ts:58:40
  (i32.ne
   ;;@ core/helpers/index.ts:58:9
   (i32.and
    (get_local $1)
    ;;@ core/helpers/index.ts:58:17
    (i32.shl
     ;;@ core/helpers/index.ts:58:18
     (i32.const 1)
     (get_local $0)
    )
   )
   ;;@ core/helpers/index.ts:58:40
   (i32.const 0)
  )
 )
 (func $core/graphics/graphics/getRgbPixelStart (; 25 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/graphics/graphics.ts:289:25
  (i32.mul
   ;;@ core/graphics/graphics.ts:289:9
   (i32.add
    ;;@ core/graphics/graphics.ts:289:10
    (i32.mul
     (get_local $1)
     ;;@ core/graphics/graphics.ts:289:14
     (i32.const 160)
    )
    (get_local $0)
   )
   ;;@ core/graphics/graphics.ts:289:25
   (i32.const 3)
  )
 )
 (func $core/graphics/graphics/setPixelOnFrame (; 26 ;) (; has Stack IR ;) (type $iiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  ;;@ core/graphics/graphics.ts:297:2
  (i32.store8
   ;;@ core/graphics/graphics.ts:297:12
   (i32.add
    (i32.add
     ;;@ core/graphics/graphics.ts:297:29
     (call $core/graphics/graphics/getRgbPixelStart
      (get_local $0)
      (get_local $1)
     )
     (i32.const 93184)
    )
    (get_local $2)
   )
   (get_local $3)
  )
 )
 (func $core/graphics/priority/getPixelStart (; 27 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/graphics/priority.ts:31:19
  (i32.add
   ;;@ core/graphics/priority.ts:31:9
   (i32.mul
    (get_local $1)
    ;;@ core/graphics/priority.ts:31:13
    (i32.const 160)
   )
   (get_local $0)
  )
 )
 (func $core/graphics/priority/getPriorityforPixel (; 28 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/graphics/priority.ts:18:64
  (i32.load8_u
   ;;@ core/graphics/priority.ts:18:18
   (i32.add
    ;;@ core/graphics/priority.ts:18:45
    (call $core/graphics/priority/getPixelStart
     (get_local $0)
     (get_local $1)
    )
    (i32.const 69632)
   )
  )
 )
 (func $core/helpers/index/resetBitOnByte (; 29 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/helpers/index.ts:52:37
  (i32.and
   (get_local $1)
   ;;@ core/helpers/index.ts:52:16
   (i32.xor
    ;;@ core/helpers/index.ts:52:17
    (i32.shl
     ;;@ core/helpers/index.ts:52:18
     (i32.const 1)
     (get_local $0)
    )
    (i32.const -1)
   )
  )
 )
 (func $core/helpers/index/setBitOnByte (; 30 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/helpers/index.ts:48:36
  (i32.or
   (get_local $1)
   ;;@ core/helpers/index.ts:48:16
   (i32.shl
    ;;@ core/helpers/index.ts:48:17
    (i32.const 1)
    (get_local $0)
   )
  )
 )
 (func $core/graphics/priority/addPriorityforPixel (; 31 ;) (; has Stack IR ;) (type $iiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  (local $4 i32)
  ;;@ core/graphics/priority.ts:9:2
  (set_local $4
   ;;@ core/graphics/priority.ts:9:28
   (i32.and
    (get_local $2)
    ;;@ core/graphics/priority.ts:9:38
    (i32.const 3)
   )
  )
  ;;@ core/graphics/priority.ts:10:2
  (if
   (i32.and
    (get_local $3)
    (i32.const 1)
   )
   ;;@ core/graphics/priority.ts:10:24
   (set_local $4
    ;;@ core/graphics/priority.ts:11:21
    (call $core/helpers/index/setBitOnByte
     ;;@ core/graphics/priority.ts:11:34
     (i32.const 2)
     (get_local $4)
    )
   )
  )
  ;;@ core/graphics/priority.ts:14:2
  (i32.store8
   ;;@ core/graphics/priority.ts:14:12
   (i32.add
    ;;@ core/graphics/priority.ts:14:39
    (call $core/graphics/priority/getPixelStart
     (get_local $0)
     (get_local $1)
    )
    (i32.const 69632)
   )
   (get_local $4)
  )
 )
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileCache (; 32 ;) (; has Stack IR ;) (type $iiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (result i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  ;;@ core/graphics/backgroundWindow.ts:359:6
  (if
   (tee_local $3
    (i32.gt_s
     (get_local $1)
     ;;@ core/graphics/backgroundWindow.ts:359:15
     (i32.const 0)
    )
   )
   (set_local $3
    ;;@ core/graphics/backgroundWindow.ts:359:20
    (i32.gt_s
     (get_local $0)
     ;;@ core/graphics/backgroundWindow.ts:359:29
     (i32.const 8)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:359:6
  (if
   (get_local $3)
   (set_local $3
    ;;@ core/graphics/backgroundWindow.ts:359:34
    (i32.eq
     (get_local $6)
     ;;@ core/graphics/backgroundWindow.ts:359:61
     (get_global $core/graphics/tiles/TileCache.tileId)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:359:6
  (if
   (get_local $3)
   (set_local $3
    ;;@ core/graphics/backgroundWindow.ts:359:81
    (i32.eq
     (get_local $0)
     ;;@ core/graphics/backgroundWindow.ts:359:92
     (get_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:359:2
  (if
   (get_local $3)
   ;;@ core/graphics/backgroundWindow.ts:359:133
   (block
    ;;@ core/graphics/backgroundWindow.ts:361:4
    (set_local $3
     ;;@ core/graphics/backgroundWindow.ts:361:50
     (i32.const 0)
    )
    ;;@ core/graphics/backgroundWindow.ts:362:4
    (set_local $6
     ;;@ core/graphics/backgroundWindow.ts:362:52
     (i32.const 0)
    )
    ;;@ core/graphics/backgroundWindow.ts:363:4
    (if
     ;;@ core/graphics/backgroundWindow.ts:363:8
     (call $core/helpers/index/checkBitOnByte
      ;;@ core/graphics/backgroundWindow.ts:363:23
      (i32.const 5)
      ;;@ core/graphics/backgroundWindow.ts:363:26
      (call $core/memory/load/eightBitLoadFromGBMemory
       ;;@ core/graphics/backgroundWindow.ts:363:51
       (i32.sub
        (get_local $4)
        ;;@ core/graphics/backgroundWindow.ts:363:68
        (i32.const 1)
       )
      )
     )
     ;;@ core/graphics/backgroundWindow.ts:363:73
     (set_local $3
      ;;@ core/graphics/backgroundWindow.ts:364:39
      (i32.const 1)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:366:4
    (if
     ;;@ core/graphics/backgroundWindow.ts:366:8
     (call $core/helpers/index/checkBitOnByte
      ;;@ core/graphics/backgroundWindow.ts:366:23
      (i32.const 5)
      ;;@ core/graphics/backgroundWindow.ts:366:26
      (call $core/memory/load/eightBitLoadFromGBMemory
       (get_local $4)
      )
     )
     ;;@ core/graphics/backgroundWindow.ts:366:69
     (set_local $6
      ;;@ core/graphics/backgroundWindow.ts:367:41
      (i32.const 1)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:371:4
    (block $break|0
     ;;@ core/graphics/backgroundWindow.ts:371:9
     (set_local $4
      ;;@ core/graphics/backgroundWindow.ts:371:30
      (i32.const 0)
     )
     (loop $repeat|0
      (br_if $break|0
       ;;@ core/graphics/backgroundWindow.ts:371:33
       (i32.ge_s
        (get_local $4)
        ;;@ core/graphics/backgroundWindow.ts:371:50
        (i32.const 8)
       )
      )
      ;;@ core/graphics/backgroundWindow.ts:373:6
      (if
       ;;@ core/graphics/backgroundWindow.ts:373:10
       (i32.ne
        (get_local $3)
        (get_local $6)
       )
       ;;@ core/graphics/backgroundWindow.ts:373:79
       (set_local $4
        ;;@ core/graphics/backgroundWindow.ts:374:25
        (i32.sub
         (i32.const 7)
         (get_local $4)
        )
       )
      )
      ;;@ core/graphics/backgroundWindow.ts:378:6
      (if
       ;;@ core/graphics/backgroundWindow.ts:378:10
       (i32.le_s
        (i32.add
         (get_local $0)
         (get_local $4)
        )
        ;;@ core/graphics/backgroundWindow.ts:378:37
        (i32.const 160)
       )
       ;;@ core/graphics/backgroundWindow.ts:378:42
       (block
        ;;@ core/graphics/backgroundWindow.ts:380:8
        (set_local $8
         ;;@ core/graphics/backgroundWindow.ts:380:29
         (i32.sub
          (get_local $0)
          ;;@ core/graphics/backgroundWindow.ts:380:38
          (i32.sub
           ;;@ core/graphics/backgroundWindow.ts:380:39
           (i32.const 8)
           (get_local $4)
          )
         )
        )
        ;;@ core/graphics/backgroundWindow.ts:381:8
        (set_local $9
         ;;@ core/graphics/backgroundWindow.ts:381:40
         (i32.add
          ;;@ core/graphics/backgroundWindow.ts:381:57
          (call $core/graphics/graphics/getRgbPixelStart
           ;;@ core/graphics/backgroundWindow.ts:381:74
           (i32.add
            (get_local $0)
            (get_local $4)
           )
           (get_local $1)
          )
          (i32.const 93184)
         )
        )
        ;;@ core/graphics/backgroundWindow.ts:384:8
        (block $break|1
         ;;@ core/graphics/backgroundWindow.ts:384:13
         (set_local $5
          ;;@ core/graphics/backgroundWindow.ts:384:32
          (i32.const 0)
         )
         (loop $repeat|1
          (br_if $break|1
           ;;@ core/graphics/backgroundWindow.ts:384:35
           (i32.ge_s
            (get_local $5)
            ;;@ core/graphics/backgroundWindow.ts:384:50
            (i32.const 3)
           )
          )
          ;;@ core/graphics/backgroundWindow.ts:385:10
          (call $core/graphics/graphics/setPixelOnFrame
           ;;@ core/graphics/backgroundWindow.ts:385:26
           (i32.add
            (get_local $0)
            (get_local $4)
           )
           (get_local $1)
           (get_local $5)
           ;;@ core/graphics/backgroundWindow.ts:385:73
           (i32.load8_u
            ;;@ core/graphics/backgroundWindow.ts:385:82
            (i32.add
             (get_local $9)
             (get_local $5)
            )
           )
          )
          ;;@ core/graphics/backgroundWindow.ts:384:53
          (set_local $5
           (i32.add
            (get_local $5)
            (i32.const 1)
           )
          )
          (br $repeat|1)
         )
        )
        ;;@ core/graphics/backgroundWindow.ts:390:8
        (call $core/graphics/priority/addPriorityforPixel
         ;;@ core/graphics/backgroundWindow.ts:390:28
         (i32.add
          (get_local $0)
          (get_local $4)
         )
         (get_local $1)
         ;;@ core/graphics/backgroundWindow.ts:390:61
         (call $core/helpers/index/resetBitOnByte
          ;;@ core/graphics/backgroundWindow.ts:390:76
          (i32.const 2)
          ;;@ core/graphics/backgroundWindow.ts:389:8
          (tee_local $5
           ;;@ core/graphics/backgroundWindow.ts:389:33
           (call $core/graphics/priority/getPriorityforPixel
            (get_local $8)
            (get_local $1)
           )
          )
         )
         ;;@ core/graphics/backgroundWindow.ts:390:95
         (call $core/helpers/index/checkBitOnByte
          ;;@ core/graphics/backgroundWindow.ts:390:110
          (i32.const 2)
          (get_local $5)
         )
        )
        ;;@ core/graphics/backgroundWindow.ts:392:8
        (set_local $7
         (i32.add
          (get_local $7)
          (i32.const 1)
         )
        )
       )
      )
      ;;@ core/graphics/backgroundWindow.ts:371:53
      (set_local $4
       (i32.add
        (get_local $4)
        (i32.const 1)
       )
      )
      (br $repeat|0)
     )
    )
   )
   ;;@ core/graphics/backgroundWindow.ts:395:9
   (set_global $core/graphics/tiles/TileCache.tileId
    (get_local $6)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:401:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:401:6
   (i32.ge_s
    (get_local $0)
    ;;@ core/graphics/backgroundWindow.ts:401:16
    (get_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck)
   )
   ;;@ core/graphics/backgroundWindow.ts:401:57
   (block
    ;;@ core/graphics/backgroundWindow.ts:402:4
    (set_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
     ;;@ core/graphics/backgroundWindow.ts:402:46
     (i32.add
      (get_local $0)
      ;;@ core/graphics/backgroundWindow.ts:402:55
      (i32.const 8)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:404:4
    (if
     ;;@ core/graphics/backgroundWindow.ts:404:8
     (i32.lt_s
      (get_local $0)
      ;;@ core/graphics/backgroundWindow.ts:403:4
      (tee_local $6
       ;;@ core/graphics/backgroundWindow.ts:403:41
       (i32.rem_s
        (get_local $2)
        ;;@ core/graphics/backgroundWindow.ts:403:63
        (i32.const 8)
       )
      )
     )
     ;;@ core/graphics/backgroundWindow.ts:404:44
     (set_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
      (i32.add
       ;;@ core/graphics/backgroundWindow.ts:405:6
       (get_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck)
       (get_local $6)
      )
     )
    )
   )
  )
  (get_local $7)
 )
 (func $core/graphics/tiles/getTileDataAddress (; 33 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  ;;@ core/graphics/tiles.ts:148:2
  (if
   ;;@ core/graphics/tiles.ts:148:6
   (i32.eq
    (get_local $0)
    (i32.const 34816)
   )
   ;;@ core/graphics/tiles.ts:148:81
   (block
    ;;@ core/graphics/tiles.ts:152:4
    (set_local $2
     ;;@ core/graphics/tiles.ts:152:28
     (i32.add
      (get_local $1)
      ;;@ core/graphics/tiles.ts:152:48
      (i32.const 128)
     )
    )
    ;;@ core/graphics/tiles.ts:153:4
    (if
     ;;@ core/graphics/tiles.ts:153:8
     (call $core/helpers/index/checkBitOnByte
      ;;@ core/graphics/tiles.ts:153:23
      (i32.const 7)
      (get_local $1)
     )
     ;;@ core/graphics/tiles.ts:153:46
     (set_local $2
      ;;@ core/graphics/tiles.ts:154:21
      (i32.sub
       (get_local $1)
       ;;@ core/graphics/tiles.ts:154:41
       (i32.const 128)
      )
     )
    )
    ;;@ core/graphics/tiles.ts:156:51
    (return
     ;;@ core/graphics/tiles.ts:156:11
     (i32.add
      (get_local $0)
      ;;@ core/graphics/tiles.ts:156:36
      (i32.shl
       (get_local $2)
       ;;@ core/graphics/tiles.ts:156:51
       (i32.const 4)
      )
     )
    )
   )
  )
  ;;@ core/graphics/tiles.ts:160:54
  (i32.add
   (get_local $0)
   ;;@ core/graphics/tiles.ts:160:34
   (i32.shl
    (get_local $1)
    ;;@ core/graphics/tiles.ts:160:54
    (i32.const 4)
   )
  )
 )
 (func $core/graphics/palette/loadPaletteByteFromWasmMemory (; 34 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  ;;@ core/graphics/palette.ts:140:2
  (set_local $2
   ;;@ core/graphics/palette.ts:140:26
   (i32.and
    (get_local $0)
    ;;@ core/graphics/palette.ts:140:45
    (i32.const 63)
   )
  )
  ;;@ core/graphics/palette.ts:143:2
  (if
   (i32.and
    (get_local $1)
    (i32.const 1)
   )
   ;;@ core/graphics/palette.ts:143:16
   (set_local $2
    (i32.sub
     (get_local $2)
     ;;@ core/graphics/palette.ts:144:20
     (i32.const -64)
    )
   )
  )
  ;;@ core/graphics/palette.ts:147:53
  (i32.load8_u
   ;;@ core/graphics/palette.ts:147:18
   (i32.add
    (get_local $2)
    (i32.const 67584)
   )
  )
 )
 (func $core/helpers/index/concatenateBytes (; 35 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/helpers/index.ts:9:51
  (i32.or
   ;;@ core/helpers/index.ts:9:9
   (i32.shl
    ;;@ core/helpers/index.ts:9:10
    (i32.and
     (get_local $0)
     ;;@ core/helpers/index.ts:9:22
     (i32.const 255)
    )
    ;;@ core/helpers/index.ts:9:31
    (i32.const 8)
   )
   ;;@ core/helpers/index.ts:9:36
   (i32.and
    (get_local $1)
    ;;@ core/helpers/index.ts:9:47
    (i32.const 255)
   )
  )
 )
 (func $core/graphics/palette/getRgbColorFromPalette (; 36 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  ;;@ core/graphics/palette.ts:122:62
  (call $core/helpers/index/concatenateBytes
   ;;@ core/graphics/palette.ts:118:29
   (call $core/graphics/palette/loadPaletteByteFromWasmMemory
    ;;@ core/graphics/palette.ts:118:59
    (i32.add
     ;;@ core/graphics/palette.ts:115:2
     (tee_local $3
      ;;@ core/graphics/palette.ts:115:26
      (i32.add
       (i32.shl
        (get_local $0)
        ;;@ core/graphics/palette.ts:115:38
        (i32.const 3)
       )
       ;;@ core/graphics/palette.ts:115:42
       (i32.shl
        (get_local $1)
        ;;@ core/graphics/palette.ts:115:52
        (i32.const 1)
       )
      )
     )
     ;;@ core/graphics/palette.ts:118:74
     (i32.const 1)
    )
    (get_local $2)
   )
   ;;@ core/graphics/palette.ts:119:28
   (call $core/graphics/palette/loadPaletteByteFromWasmMemory
    (get_local $3)
    (get_local $2)
   )
  )
 )
 (func $core/graphics/palette/getColorComponentFromRgb (; 37 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/graphics/palette.ts:134:22
  (i32.shl
   ;;@ core/graphics/palette.ts:130:24
   (i32.shr_s
    (i32.and
     (get_local $1)
     ;;@ core/graphics/palette.ts:129:21
     (i32.shl
      (i32.const 31)
      (tee_local $0
       ;;@ core/graphics/palette.ts:129:29
       (i32.mul
        (get_local $0)
        ;;@ core/graphics/palette.ts:129:40
        (i32.const 5)
       )
      )
     )
    )
    (get_local $0)
   )
   ;;@ core/graphics/palette.ts:134:22
   (i32.const 3)
  )
 )
 (func $core/graphics/palette/getMonochromeColorFromPalette (; 38 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  ;;@ core/graphics/palette.ts:43:2
  (if
   ;;@ core/graphics/palette.ts:43:6
   (i32.eqz
    (i32.and
     (get_local $2)
     (i32.const 1)
    )
   )
   ;;@ core/graphics/palette.ts:43:38
   (set_local $0
    ;;@ core/graphics/palette.ts:44:12
    (i32.and
     (i32.shr_s
      ;;@ core/graphics/palette.ts:44:13
      (call $core/memory/load/eightBitLoadFromGBMemory
       (get_local $1)
      )
      ;;@ core/graphics/palette.ts:44:71
      (i32.shl
       (get_local $0)
       ;;@ core/graphics/palette.ts:44:82
       (i32.const 1)
      )
     )
     ;;@ core/graphics/palette.ts:44:88
     (i32.const 3)
    )
   )
  )
  ;;@ core/graphics/palette.ts:50:2
  (set_local $1
   ;;@ core/graphics/palette.ts:50:22
   (i32.const 242)
  )
  ;;@ core/graphics/palette.ts:52:2
  (block $break|0
   (block $case3|0
    (block $case2|0
     (block $case1|0
      (block $case0|0
       (br_if $break|0
        (i32.eqz
         (get_local $0)
        )
       )
       (block $tablify|0
        (br_table $case1|0 $case2|0 $case3|0 $tablify|0
         (i32.sub
          (get_local $0)
          (i32.const 1)
         )
        )
       )
       (br $break|0)
      )
     )
     ;;@ core/graphics/palette.ts:56:6
     (set_local $1
      ;;@ core/graphics/palette.ts:56:17
      (i32.const 160)
     )
     ;;@ core/graphics/palette.ts:57:6
     (br $break|0)
    )
    ;;@ core/graphics/palette.ts:59:6
    (set_local $1
     ;;@ core/graphics/palette.ts:59:17
     (i32.const 88)
    )
    ;;@ core/graphics/palette.ts:60:6
    (br $break|0)
   )
   ;;@ core/graphics/palette.ts:62:6
   (set_local $1
    ;;@ core/graphics/palette.ts:62:17
    (i32.const 8)
   )
  )
  (get_local $1)
 )
 (func $core/graphics/tiles/getTilePixelStart (; 39 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  ;;@ core/graphics/tiles.ts:134:22
  (i32.mul
   ;;@ core/graphics/tiles.ts:131:24
   (i32.add
    (i32.mul
     (get_local $1)
     (get_local $2)
    )
    (get_local $0)
   )
   ;;@ core/graphics/tiles.ts:134:22
   (i32.const 3)
  )
 )
 (func $core/graphics/tiles/drawPixelsFromLineOfTile (; 40 ;) (; has Stack IR ;) (type $iiiiiiiiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (param $12 i32) (result i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  ;;@ core/graphics/tiles.ts:47:2
  (set_local $17
   ;;@ core/graphics/tiles.ts:47:40
   (call $core/graphics/graphics/loadFromVramBank
    (tee_local $0
     ;;@ core/graphics/tiles.ts:47:57
     (i32.add
      ;;@ core/graphics/tiles.ts:44:29
      (call $core/graphics/tiles/getTileDataAddress
       (get_local $1)
       (get_local $0)
      )
      ;;@ core/graphics/tiles.ts:47:75
      (i32.shl
       (get_local $5)
       ;;@ core/graphics/tiles.ts:47:87
       (i32.const 1)
      )
     )
    )
    (get_local $2)
   )
  )
  ;;@ core/graphics/tiles.ts:48:2
  (set_local $18
   ;;@ core/graphics/tiles.ts:48:40
   (call $core/graphics/graphics/loadFromVramBank
    ;;@ core/graphics/tiles.ts:48:57
    (i32.add
     (get_local $0)
     ;;@ core/graphics/tiles.ts:48:91
     (i32.const 1)
    )
    (get_local $2)
   )
  )
  ;;@ core/graphics/tiles.ts:51:2
  (block $break|0
   ;;@ core/graphics/tiles.ts:51:7
   (set_local $0
    (get_local $3)
   )
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/graphics/tiles.ts:51:36
     (i32.gt_s
      (get_local $0)
      (get_local $4)
     )
    )
    ;;@ core/graphics/tiles.ts:55:4
    (if
     ;;@ core/graphics/tiles.ts:55:8
     (i32.lt_s
      ;;@ core/graphics/tiles.ts:54:4
      (tee_local $14
       ;;@ core/graphics/tiles.ts:54:26
       (i32.add
        (get_local $6)
        ;;@ core/graphics/tiles.ts:54:40
        (i32.sub
         (get_local $0)
         (get_local $3)
        )
       )
      )
      (get_local $8)
     )
     ;;@ core/graphics/tiles.ts:55:39
     (block
      ;;@ core/graphics/tiles.ts:61:6
      (set_local $1
       (get_local $0)
      )
      ;;@ core/graphics/tiles.ts:62:10
      (if
       (i32.eqz
        (tee_local $2
         (i32.lt_s
          (get_local $12)
          ;;@ core/graphics/tiles.ts:62:28
          (i32.const 0)
         )
        )
       )
       (set_local $2
        ;;@ core/graphics/tiles.ts:62:33
        (i32.eqz
         ;;@ core/graphics/tiles.ts:62:34
         (call $core/helpers/index/checkBitOnByte
          ;;@ core/graphics/tiles.ts:62:49
          (i32.const 5)
          (get_local $12)
         )
        )
       )
      )
      ;;@ core/graphics/tiles.ts:62:6
      (if
       (get_local $2)
       ;;@ core/graphics/tiles.ts:62:70
       (set_local $1
        ;;@ core/graphics/tiles.ts:63:23
        (i32.sub
         (i32.const 7)
         (get_local $1)
        )
       )
      )
      ;;@ core/graphics/tiles.ts:67:6
      (set_local $2
       ;;@ core/graphics/tiles.ts:67:32
       (i32.const 0)
      )
      ;;@ core/graphics/tiles.ts:68:6
      (if
       ;;@ core/graphics/tiles.ts:68:10
       (call $core/helpers/index/checkBitOnByte
        (get_local $1)
        (get_local $18)
       )
       ;;@ core/graphics/tiles.ts:71:8
       (set_local $2
        (i32.const 2)
       )
      )
      ;;@ core/graphics/tiles.ts:73:6
      (if
       ;;@ core/graphics/tiles.ts:73:10
       (call $core/helpers/index/checkBitOnByte
        (get_local $1)
        (get_local $17)
       )
       ;;@ core/graphics/tiles.ts:73:68
       (set_local $2
        (i32.add
         (get_local $2)
         ;;@ core/graphics/tiles.ts:74:26
         (i32.const 1)
        )
       )
      )
      (set_local $5
       ;;@ core/graphics/tiles.ts:83:6
       (if (result i32)
        ;;@ core/graphics/tiles.ts:83:10
        (i32.ge_s
         (get_local $12)
         ;;@ core/graphics/tiles.ts:83:29
         (i32.const 0)
        )
        ;;@ core/graphics/tiles.ts:83:32
        (block (result i32)
         ;;@ core/graphics/tiles.ts:90:8
         (set_local $15
          ;;@ core/graphics/tiles.ts:90:14
          (call $core/graphics/palette/getColorComponentFromRgb
           ;;@ core/graphics/tiles.ts:90:39
           (i32.const 0)
           ;;@ core/graphics/tiles.ts:87:8
           (tee_local $5
            ;;@ core/graphics/tiles.ts:87:35
            (call $core/graphics/palette/getRgbColorFromPalette
             ;;@ core/graphics/tiles.ts:86:29
             (i32.and
              (get_local $12)
              ;;@ core/graphics/tiles.ts:86:47
              (i32.const 7)
             )
             (get_local $2)
             ;;@ core/graphics/tiles.ts:87:85
             (i32.const 0)
            )
           )
          )
         )
         ;;@ core/graphics/tiles.ts:91:8
         (set_local $1
          ;;@ core/graphics/tiles.ts:91:16
          (call $core/graphics/palette/getColorComponentFromRgb
           ;;@ core/graphics/tiles.ts:91:41
           (i32.const 1)
           (get_local $5)
          )
         )
         ;;@ core/graphics/tiles.ts:92:15
         (call $core/graphics/palette/getColorComponentFromRgb
          ;;@ core/graphics/tiles.ts:92:40
          (i32.const 2)
          (get_local $5)
         )
        )
        ;;@ core/graphics/tiles.ts:93:13
        (block (result i32)
         ;;@ core/graphics/tiles.ts:94:8
         (if
          ;;@ core/graphics/tiles.ts:94:12
          (i32.le_s
           (get_local $11)
           ;;@ core/graphics/tiles.ts:94:31
           (i32.const 0)
          )
          ;;@ core/graphics/tiles.ts:94:34
          (set_local $11
           (i32.const 65351)
          )
         )
         ;;@ core/graphics/tiles.ts:98:8
         (set_local $15
          ;;@ core/graphics/tiles.ts:97:8
          (tee_local $5
           ;;@ core/graphics/tiles.ts:97:35
           (call $core/graphics/palette/getMonochromeColorFromPalette
            (get_local $2)
            (get_local $11)
            (get_local $10)
           )
          )
         )
         ;;@ core/graphics/tiles.ts:99:8
         (tee_local $1
          (get_local $5)
         )
        )
       )
      )
      ;;@ core/graphics/tiles.ts:107:6
      (i32.store8
       (tee_local $16
        ;;@ core/graphics/tiles.ts:107:16
        (i32.add
         (get_local $9)
         ;;@ core/graphics/tiles.ts:105:28
         (call $core/graphics/tiles/getTilePixelStart
          (get_local $14)
          (get_local $7)
          (get_local $8)
         )
        )
       )
       (get_local $15)
      )
      ;;@ core/graphics/tiles.ts:108:6
      (i32.store8
       ;;@ core/graphics/tiles.ts:108:16
       (i32.add
        (get_local $16)
        ;;@ core/graphics/tiles.ts:108:47
        (i32.const 1)
       )
       (get_local $1)
      )
      ;;@ core/graphics/tiles.ts:109:6
      (i32.store8
       ;;@ core/graphics/tiles.ts:109:16
       (i32.add
        (get_local $16)
        ;;@ core/graphics/tiles.ts:109:47
        (i32.const 2)
       )
       (get_local $5)
      )
      ;;@ core/graphics/tiles.ts:111:6
      (set_local $1
       ;;@ core/graphics/tiles.ts:111:35
       (i32.const 0)
      )
      ;;@ core/graphics/tiles.ts:112:6
      (if
       ;;@ core/graphics/tiles.ts:112:10
       (i32.ge_s
        (get_local $12)
        ;;@ core/graphics/tiles.ts:112:29
        (i32.const 0)
       )
       ;;@ core/graphics/tiles.ts:112:32
       (set_local $1
        ;;@ core/graphics/tiles.ts:113:24
        (call $core/helpers/index/checkBitOnByte
         ;;@ core/graphics/tiles.ts:113:39
         (i32.const 7)
         (get_local $12)
        )
       )
      )
      ;;@ core/graphics/tiles.ts:120:6
      (call $core/graphics/priority/addPriorityforPixel
       (get_local $14)
       (get_local $7)
       (get_local $2)
       (get_local $1)
      )
      ;;@ core/graphics/tiles.ts:122:6
      (set_local $13
       (i32.add
        (get_local $13)
        (i32.const 1)
       )
      )
     )
    )
    ;;@ core/graphics/tiles.ts:51:55
    (set_local $0
     (i32.add
      (get_local $0)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
  (get_local $13)
 )
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileId (; 41 ;) (; has Stack IR ;) (type $iiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (result i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  ;;@ core/graphics/backgroundWindow.ts:424:2
  (set_local $3
   ;;@ core/graphics/backgroundWindow.ts:424:23
   (i32.rem_s
    (get_local $3)
    ;;@ core/graphics/backgroundWindow.ts:424:45
    (i32.const 8)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:430:2
  (if
   (i32.eqz
    (get_local $0)
   )
   ;;@ core/graphics/backgroundWindow.ts:430:19
   (set_local $7
    ;;@ core/graphics/backgroundWindow.ts:431:17
    (i32.sub
     (get_local $2)
     ;;@ core/graphics/backgroundWindow.ts:431:39
     (i32.shl
      (i32.div_s
       (get_local $2)
       ;;@ core/graphics/backgroundWindow.ts:431:62
       (i32.const 8)
      )
      ;;@ core/graphics/backgroundWindow.ts:431:67
      (i32.const 3)
     )
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:433:2
  (set_local $8
   ;;@ core/graphics/backgroundWindow.ts:433:22
   (i32.const 7)
  )
  ;;@ core/graphics/backgroundWindow.ts:434:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:434:6
   (i32.gt_s
    (i32.add
     (get_local $0)
     ;;@ core/graphics/backgroundWindow.ts:434:15
     (i32.const 8)
    )
    ;;@ core/graphics/backgroundWindow.ts:434:19
    (i32.const 160)
   )
   ;;@ core/graphics/backgroundWindow.ts:434:24
   (set_local $8
    ;;@ core/graphics/backgroundWindow.ts:435:15
    (i32.sub
     (i32.const 160)
     (get_local $0)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:439:2
  (set_local $2
   ;;@ core/graphics/backgroundWindow.ts:439:29
   (i32.const -1)
  )
  ;;@ core/graphics/backgroundWindow.ts:441:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:441:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/graphics/backgroundWindow.ts:441:22
   (block
    ;;@ core/graphics/backgroundWindow.ts:444:4
    (if
     ;;@ core/graphics/backgroundWindow.ts:444:8
     (call $core/helpers/index/checkBitOnByte
      ;;@ core/graphics/backgroundWindow.ts:444:23
      (i32.const 3)
      ;;@ core/graphics/backgroundWindow.ts:444:26
      (i32.and
       ;;@ core/graphics/backgroundWindow.ts:443:4
       (tee_local $2
        ;;@ core/graphics/backgroundWindow.ts:443:22
        (call $core/graphics/graphics/loadFromVramBank
         (get_local $4)
         ;;@ core/graphics/backgroundWindow.ts:443:55
         (i32.const 1)
        )
       )
       (i32.const 255)
      )
     )
     ;;@ core/graphics/backgroundWindow.ts:444:48
     (set_local $9
      ;;@ core/graphics/backgroundWindow.ts:445:19
      (i32.const 1)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:448:4
    (if
     ;;@ core/graphics/backgroundWindow.ts:448:8
     (call $core/helpers/index/checkBitOnByte
      ;;@ core/graphics/backgroundWindow.ts:448:23
      (i32.const 6)
      (get_local $2)
     )
     ;;@ core/graphics/backgroundWindow.ts:448:44
     (set_local $3
      ;;@ core/graphics/backgroundWindow.ts:451:18
      (i32.sub
       (i32.const 7)
       (get_local $3)
      )
     )
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:470:2
  (call $core/graphics/tiles/drawPixelsFromLineOfTile
   (get_local $6)
   (get_local $5)
   (get_local $9)
   (get_local $7)
   (get_local $8)
   (get_local $3)
   (get_local $0)
   (get_local $1)
   ;;@ core/graphics/backgroundWindow.ts:465:4
   (i32.const 160)
   (i32.const 93184)
   ;;@ core/graphics/backgroundWindow.ts:467:4
   (i32.const 0)
   ;;@ core/graphics/backgroundWindow.ts:468:4
   (i32.const 0)
   (get_local $2)
  )
 )
 (func $core/graphics/backgroundWindow/drawColorPixelFromTileId (; 42 ;) (; has Stack IR ;) (type $iiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  ;;@ core/graphics/backgroundWindow.ts:269:2
  (set_local $6
   ;;@ core/graphics/backgroundWindow.ts:269:29
   (call $core/graphics/tiles/getTileDataAddress
    (get_local $5)
    (get_local $6)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:278:2
  (set_local $4
   ;;@ core/graphics/backgroundWindow.ts:278:29
   (call $core/graphics/graphics/loadFromVramBank
    (get_local $4)
    ;;@ core/graphics/backgroundWindow.ts:278:62
    (i32.const 1)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:281:2
  (set_local $3
   ;;@ core/graphics/backgroundWindow.ts:281:26
   (i32.rem_s
    (get_local $3)
    ;;@ core/graphics/backgroundWindow.ts:281:48
    (i32.const 8)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:282:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:282:6
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/backgroundWindow.ts:282:21
    (i32.const 6)
    (get_local $4)
   )
   ;;@ core/graphics/backgroundWindow.ts:282:42
   (set_local $3
    ;;@ core/graphics/backgroundWindow.ts:285:19
    (i32.sub
     (i32.const 7)
     (get_local $3)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:291:2
  (set_local $5
   ;;@ core/graphics/backgroundWindow.ts:291:24
   (i32.const 0)
  )
  ;;@ core/graphics/backgroundWindow.ts:292:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:292:6
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/backgroundWindow.ts:292:21
    (i32.const 3)
    (get_local $4)
   )
   ;;@ core/graphics/backgroundWindow.ts:292:42
   (set_local $5
    ;;@ core/graphics/backgroundWindow.ts:293:17
    (i32.const 1)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:295:2
  (set_local $6
   ;;@ core/graphics/backgroundWindow.ts:295:40
   (call $core/graphics/graphics/loadFromVramBank
    (tee_local $3
     ;;@ core/graphics/backgroundWindow.ts:295:57
     (i32.add
      (get_local $6)
      ;;@ core/graphics/backgroundWindow.ts:295:75
      (i32.shl
       (get_local $3)
       ;;@ core/graphics/backgroundWindow.ts:295:90
       (i32.const 1)
      )
     )
    )
    (get_local $5)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:296:2
  (set_local $5
   ;;@ core/graphics/backgroundWindow.ts:296:40
   (call $core/graphics/graphics/loadFromVramBank
    ;;@ core/graphics/backgroundWindow.ts:296:57
    (i32.add
     (get_local $3)
     ;;@ core/graphics/backgroundWindow.ts:296:94
     (i32.const 1)
    )
    (get_local $5)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:300:2
  (set_local $3
   ;;@ core/graphics/backgroundWindow.ts:300:26
   (i32.rem_s
    (get_local $2)
    ;;@ core/graphics/backgroundWindow.ts:300:48
    (i32.const 8)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:301:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:301:6
   (i32.eqz
    ;;@ core/graphics/backgroundWindow.ts:301:7
    (call $core/helpers/index/checkBitOnByte
     ;;@ core/graphics/backgroundWindow.ts:301:22
     (i32.const 5)
     (get_local $4)
    )
   )
   ;;@ core/graphics/backgroundWindow.ts:301:43
   (set_local $3
    ;;@ core/graphics/backgroundWindow.ts:302:19
    (i32.sub
     (i32.const 7)
     (get_local $3)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:310:2
  (set_local $2
   ;;@ core/graphics/backgroundWindow.ts:310:28
   (i32.const 0)
  )
  ;;@ core/graphics/backgroundWindow.ts:311:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:311:6
   (call $core/helpers/index/checkBitOnByte
    (get_local $3)
    (get_local $5)
   )
   ;;@ core/graphics/backgroundWindow.ts:314:4
   (set_local $2
    (i32.const 2)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:316:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:316:6
   (call $core/helpers/index/checkBitOnByte
    (get_local $3)
    (get_local $6)
   )
   ;;@ core/graphics/backgroundWindow.ts:316:64
   (set_local $2
    (i32.add
     (get_local $2)
     ;;@ core/graphics/backgroundWindow.ts:317:22
     (i32.const 1)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:328:2
  (set_local $5
   ;;@ core/graphics/backgroundWindow.ts:328:17
   (call $core/graphics/palette/getColorComponentFromRgb
    ;;@ core/graphics/backgroundWindow.ts:328:42
    (i32.const 0)
    ;;@ core/graphics/backgroundWindow.ts:325:2
    (tee_local $3
     ;;@ core/graphics/backgroundWindow.ts:325:29
     (call $core/graphics/palette/getRgbColorFromPalette
      ;;@ core/graphics/backgroundWindow.ts:322:23
      (i32.and
       (get_local $4)
       ;;@ core/graphics/backgroundWindow.ts:322:41
       (i32.const 7)
      )
      (get_local $2)
      ;;@ core/graphics/backgroundWindow.ts:325:79
      (i32.const 0)
     )
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:329:2
  (set_local $6
   ;;@ core/graphics/backgroundWindow.ts:329:19
   (call $core/graphics/palette/getColorComponentFromRgb
    ;;@ core/graphics/backgroundWindow.ts:329:44
    (i32.const 1)
    (get_local $3)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:330:2
  (set_local $3
   ;;@ core/graphics/backgroundWindow.ts:330:18
   (call $core/graphics/palette/getColorComponentFromRgb
    ;;@ core/graphics/backgroundWindow.ts:330:43
    (i32.const 2)
    (get_local $3)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:333:2
  (call $core/graphics/graphics/setPixelOnFrame
   (get_local $0)
   (get_local $1)
   ;;@ core/graphics/backgroundWindow.ts:333:34
   (i32.const 0)
   (get_local $5)
  )
  ;;@ core/graphics/backgroundWindow.ts:334:2
  (call $core/graphics/graphics/setPixelOnFrame
   (get_local $0)
   (get_local $1)
   ;;@ core/graphics/backgroundWindow.ts:334:34
   (i32.const 1)
   (get_local $6)
  )
  ;;@ core/graphics/backgroundWindow.ts:335:2
  (call $core/graphics/graphics/setPixelOnFrame
   (get_local $0)
   (get_local $1)
   ;;@ core/graphics/backgroundWindow.ts:335:34
   (i32.const 2)
   (get_local $3)
  )
  ;;@ core/graphics/backgroundWindow.ts:341:2
  (call $core/graphics/priority/addPriorityforPixel
   (get_local $0)
   (get_local $1)
   (get_local $2)
   ;;@ core/graphics/backgroundWindow.ts:341:54
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/backgroundWindow.ts:341:69
    (i32.const 7)
    (get_local $4)
   )
  )
 )
 (func $core/graphics/backgroundWindow/drawMonochromePixelFromTileId (; 43 ;) (; has Stack IR ;) (type $iiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  ;;@ core/graphics/backgroundWindow.ts:205:2
  (set_local $5
   ;;@ core/graphics/backgroundWindow.ts:205:40
   (call $core/graphics/graphics/loadFromVramBank
    (tee_local $4
     ;;@ core/graphics/backgroundWindow.ts:205:57
     (i32.add
      ;;@ core/graphics/backgroundWindow.ts:189:29
      (call $core/graphics/tiles/getTileDataAddress
       (get_local $4)
       (get_local $5)
      )
      ;;@ core/graphics/backgroundWindow.ts:205:75
      (i32.shl
       ;;@ core/graphics/backgroundWindow.ts:200:26
       (i32.rem_s
        (get_local $3)
        ;;@ core/graphics/backgroundWindow.ts:200:48
        (i32.const 8)
       )
       ;;@ core/graphics/backgroundWindow.ts:205:90
       (i32.const 1)
      )
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:205:93
    (i32.const 0)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:222:2
  (set_local $3
   ;;@ core/graphics/backgroundWindow.ts:222:27
   (i32.const 0)
  )
  ;;@ core/graphics/backgroundWindow.ts:206:2
  (set_local $4
   ;;@ core/graphics/backgroundWindow.ts:206:40
   (call $core/graphics/graphics/loadFromVramBank
    ;;@ core/graphics/backgroundWindow.ts:206:57
    (i32.add
     (get_local $4)
     ;;@ core/graphics/backgroundWindow.ts:206:94
     (i32.const 1)
    )
    ;;@ core/graphics/backgroundWindow.ts:206:97
    (i32.const 0)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:223:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:223:6
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/backgroundWindow.ts:215:2
    (tee_local $2
     ;;@ core/graphics/backgroundWindow.ts:215:17
     (i32.sub
      (i32.const 7)
      ;;@ core/graphics/backgroundWindow.ts:214:26
      (i32.rem_s
       (get_local $2)
       ;;@ core/graphics/backgroundWindow.ts:214:48
       (i32.const 8)
      )
     )
    )
    (get_local $4)
   )
   ;;@ core/graphics/backgroundWindow.ts:226:4
   (set_local $3
    (i32.const 2)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:228:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:228:6
   (call $core/helpers/index/checkBitOnByte
    (get_local $2)
    (get_local $5)
   )
   ;;@ core/graphics/backgroundWindow.ts:228:64
   (set_local $3
    (i32.add
     (get_local $3)
     ;;@ core/graphics/backgroundWindow.ts:229:22
     (i32.const 1)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:243:2
  (call $core/graphics/graphics/setPixelOnFrame
   (get_local $0)
   (get_local $1)
   ;;@ core/graphics/backgroundWindow.ts:243:34
   (i32.const 0)
   ;;@ core/graphics/backgroundWindow.ts:242:2
   (tee_local $2
    ;;@ core/graphics/backgroundWindow.ts:242:29
    (call $core/graphics/palette/getMonochromeColorFromPalette
     (get_local $3)
     (i32.const 65351)
     ;;@ core/graphics/palette.ts:37:43
     (i32.const 0)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:244:2
  (call $core/graphics/graphics/setPixelOnFrame
   (get_local $0)
   (get_local $1)
   ;;@ core/graphics/backgroundWindow.ts:244:34
   (i32.const 1)
   (get_local $2)
  )
  ;;@ core/graphics/backgroundWindow.ts:245:2
  (call $core/graphics/graphics/setPixelOnFrame
   (get_local $0)
   (get_local $1)
   ;;@ core/graphics/backgroundWindow.ts:245:34
   (i32.const 2)
   (get_local $2)
  )
  ;;@ core/graphics/backgroundWindow.ts:251:2
  (call $core/graphics/priority/addPriorityforPixel
   (get_local $0)
   (get_local $1)
   (get_local $3)
   ;;@ core/graphics/priority.ts:8:98
   (i32.const 0)
  )
 )
 (func $core/graphics/backgroundWindow/drawBackgroundWindowScanline (; 44 ;) (; has Stack IR ;) (type $iiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  ;;@ core/graphics/backgroundWindow.ts:80:2
  (set_local $11
   ;;@ core/graphics/backgroundWindow.ts:80:32
   (i32.shr_s
    (get_local $3)
    ;;@ core/graphics/backgroundWindow.ts:80:55
    (i32.const 3)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:83:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/graphics/backgroundWindow.ts:83:28
     (i32.ge_s
      (get_local $4)
      ;;@ core/graphics/backgroundWindow.ts:83:32
      (i32.const 160)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:90:4
    (if
     ;;@ core/graphics/backgroundWindow.ts:90:8
     (i32.ge_s
      ;;@ core/graphics/backgroundWindow.ts:87:4
      (tee_local $6
       ;;@ core/graphics/backgroundWindow.ts:87:35
       (i32.add
        (get_local $4)
        (get_local $5)
       )
      )
      ;;@ core/graphics/backgroundWindow.ts:90:31
      (i32.const 256)
     )
     ;;@ core/graphics/backgroundWindow.ts:90:38
     (set_local $6
      (i32.sub
       (get_local $6)
       ;;@ core/graphics/backgroundWindow.ts:91:29
       (i32.const 256)
      )
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:111:4
    (set_local $7
     ;;@ core/graphics/backgroundWindow.ts:111:33
     (call $core/graphics/graphics/loadFromVramBank
      ;;@ core/graphics/backgroundWindow.ts:108:4
      (tee_local $9
       ;;@ core/graphics/backgroundWindow.ts:108:30
       (i32.add
        (i32.add
         (get_local $2)
         ;;@ core/graphics/backgroundWindow.ts:108:54
         (i32.shl
          (get_local $11)
          ;;@ core/graphics/backgroundWindow.ts:108:75
          (i32.const 5)
         )
        )
        ;;@ core/graphics/backgroundWindow.ts:99:34
        (i32.shr_s
         (get_local $6)
         ;;@ core/graphics/backgroundWindow.ts:99:57
         (i32.const 3)
        )
       )
      )
      ;;@ core/graphics/backgroundWindow.ts:111:66
      (i32.const 0)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:114:4
    (set_local $10
     ;;@ core/graphics/backgroundWindow.ts:114:33
     (i32.const 0)
    )
    ;;@ core/graphics/backgroundWindow.ts:115:4
    (if
     ;;@ core/graphics/backgroundWindow.ts:115:8
     (get_global $core/config/Config.tileCaching)
     ;;@ core/graphics/backgroundWindow.ts:126:6
     (if
      ;;@ core/graphics/backgroundWindow.ts:126:10
      (i32.gt_s
       ;;@ core/graphics/backgroundWindow.ts:116:6
       (tee_local $8
        ;;@ core/graphics/backgroundWindow.ts:116:29
        (call $core/graphics/backgroundWindow/drawLineOfTileFromTileCache
         (get_local $4)
         (get_local $0)
         (get_local $6)
         (get_local $3)
         (get_local $9)
         (get_local $1)
         (get_local $7)
        )
       )
       ;;@ core/graphics/backgroundWindow.ts:126:24
       (i32.const 0)
      )
      ;;@ core/graphics/backgroundWindow.ts:126:27
      (block
       ;;@ core/graphics/backgroundWindow.ts:127:8
       (set_local $4
        (i32.add
         (get_local $4)
         ;;@ core/graphics/backgroundWindow.ts:127:13
         (i32.sub
          (get_local $8)
          ;;@ core/graphics/backgroundWindow.ts:127:27
          (i32.const 1)
         )
        )
       )
       ;;@ core/graphics/backgroundWindow.ts:128:8
       (set_local $10
        ;;@ core/graphics/backgroundWindow.ts:128:24
        (i32.const 1)
       )
      )
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:132:4
    (if
     (tee_local $8
      ;;@ core/graphics/backgroundWindow.ts:132:8
      (if (result i32)
       (get_global $core/config/Config.tileRendering)
       ;;@ core/graphics/backgroundWindow.ts:132:32
       (i32.eqz
        (get_local $10)
       )
       (get_global $core/config/Config.tileRendering)
      )
     )
     ;;@ core/graphics/backgroundWindow.ts:144:6
     (if
      ;;@ core/graphics/backgroundWindow.ts:144:10
      (i32.gt_s
       ;;@ core/graphics/backgroundWindow.ts:133:6
       (tee_local $8
        ;;@ core/graphics/backgroundWindow.ts:133:29
        (call $core/graphics/backgroundWindow/drawLineOfTileFromTileId
         (get_local $4)
         (get_local $0)
         (get_local $6)
         (get_local $3)
         (get_local $9)
         (get_local $1)
         (get_local $7)
        )
       )
       ;;@ core/graphics/backgroundWindow.ts:144:24
       (i32.const 0)
      )
      ;;@ core/graphics/backgroundWindow.ts:144:27
      (set_local $4
       (i32.add
        (get_local $4)
        ;;@ core/graphics/backgroundWindow.ts:145:13
        (i32.sub
         (get_local $8)
         ;;@ core/graphics/backgroundWindow.ts:145:27
         (i32.const 1)
        )
       )
      )
     )
     ;;@ core/graphics/backgroundWindow.ts:147:11
     (if
      ;;@ core/graphics/backgroundWindow.ts:147:15
      (i32.eqz
       (get_local $10)
      )
      ;;@ core/graphics/backgroundWindow.ts:147:31
      (if
       ;;@ core/graphics/backgroundWindow.ts:148:10
       (get_global $core/cpu/cpu/Cpu.GBCEnabled)
       ;;@ core/graphics/backgroundWindow.ts:148:26
       (call $core/graphics/backgroundWindow/drawColorPixelFromTileId
        (get_local $4)
        (get_local $0)
        (get_local $6)
        (get_local $3)
        (get_local $9)
        (get_local $1)
        (get_local $7)
       )
       ;;@ core/graphics/backgroundWindow.ts:159:13
       (call $core/graphics/backgroundWindow/drawMonochromePixelFromTileId
        (get_local $4)
        (get_local $0)
        (get_local $6)
        (get_local $3)
        (get_local $1)
        (get_local $7)
       )
      )
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:83:37
    (set_local $4
     (i32.add
      (get_local $4)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
 )
 (func $core/graphics/backgroundWindow/renderBackground (; 45 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  ;;@ core/graphics/backgroundWindow.ts:23:2
  (set_local $4
   ;;@ core/graphics/backgroundWindow.ts:23:21
   (get_global $core/graphics/graphics/Graphics.scrollX)
  )
  ;;@ core/graphics/backgroundWindow.ts:34:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:34:6
   (i32.ge_s
    ;;@ core/graphics/backgroundWindow.ts:29:2
    (tee_local $3
     ;;@ core/graphics/backgroundWindow.ts:29:33
     (i32.add
      (get_local $0)
      ;;@ core/graphics/backgroundWindow.ts:24:21
      (get_global $core/graphics/graphics/Graphics.scrollY)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:34:29
    (i32.const 256)
   )
   ;;@ core/graphics/backgroundWindow.ts:34:36
   (set_local $3
    (i32.sub
     (get_local $3)
     ;;@ core/graphics/backgroundWindow.ts:35:27
     (i32.const 256)
    )
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:39:2
  (call $core/graphics/backgroundWindow/drawBackgroundWindowScanline
   (get_local $0)
   (get_local $1)
   (get_local $2)
   (get_local $3)
   ;;@ core/graphics/backgroundWindow.ts:39:117
   (i32.const 0)
   (get_local $4)
  )
 )
 (func $core/graphics/backgroundWindow/renderWindow (; 46 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  ;;@ core/graphics/backgroundWindow.ts:46:2
  (set_local $3
   ;;@ core/graphics/backgroundWindow.ts:46:21
   (get_global $core/graphics/graphics/Graphics.windowX)
  )
  ;;@ core/graphics/backgroundWindow.ts:52:2
  (if
   ;;@ core/graphics/backgroundWindow.ts:52:6
   (i32.lt_s
    (get_local $0)
    ;;@ core/graphics/backgroundWindow.ts:47:2
    (tee_local $4
     ;;@ core/graphics/backgroundWindow.ts:47:21
     (get_global $core/graphics/graphics/Graphics.windowY)
    )
   )
   (return)
  )
  ;;@ core/graphics/backgroundWindow.ts:64:2
  (set_local $5
   ;;@ core/graphics/backgroundWindow.ts:64:21
   (i32.mul
    ;;@ core/graphics/backgroundWindow.ts:58:2
    (tee_local $3
     ;;@ core/graphics/backgroundWindow.ts:58:12
     (i32.sub
      (get_local $3)
      ;;@ core/graphics/backgroundWindow.ts:58:22
      (i32.const 7)
     )
    )
    ;;@ core/graphics/backgroundWindow.ts:64:21
    (i32.const -1)
   )
  )
  ;;@ core/graphics/backgroundWindow.ts:67:2
  (call $core/graphics/backgroundWindow/drawBackgroundWindowScanline
   (get_local $0)
   (get_local $1)
   (get_local $2)
   ;;@ core/graphics/backgroundWindow.ts:61:33
   (i32.sub
    (get_local $0)
    (get_local $4)
   )
   (get_local $3)
   (get_local $5)
  )
 )
 (func $core/graphics/sprites/renderSprites (; 47 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  ;;@ core/graphics/sprites.ts:18:2
  (block $break|0
   ;;@ core/graphics/sprites.ts:18:7
   (set_local $9
    ;;@ core/graphics/sprites.ts:18:20
    (i32.const 39)
   )
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/graphics/sprites.ts:18:24
     (i32.lt_s
      (get_local $9)
      ;;@ core/graphics/sprites.ts:18:29
      (i32.const 0)
     )
    )
    ;;@ core/graphics/sprites.ts:23:4
    (set_local $2
     ;;@ core/graphics/sprites.ts:23:31
     (call $core/memory/load/eightBitLoadFromGBMemory
      ;;@ core/graphics/sprites.ts:23:56
      (i32.add
       ;;@ core/graphics/sprites.ts:20:4
       (tee_local $3
        ;;@ core/graphics/sprites.ts:20:32
        (i32.shl
         (get_local $9)
         ;;@ core/graphics/sprites.ts:20:36
         (i32.const 2)
        )
       )
       (i32.const 65024)
      )
     )
    )
    ;;@ core/graphics/sprites.ts:24:4
    (set_local $11
     ;;@ core/graphics/sprites.ts:24:31
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.add
       (get_local $3)
       (i32.const 65025)
      )
     )
    )
    ;;@ core/graphics/sprites.ts:25:4
    (set_local $4
     ;;@ core/graphics/sprites.ts:25:28
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.add
       (get_local $3)
       (i32.const 65026)
      )
     )
    )
    ;;@ core/graphics/sprites.ts:38:4
    (set_local $2
     (i32.sub
      (get_local $2)
      ;;@ core/graphics/sprites.ts:38:23
      (i32.const 16)
     )
    )
    ;;@ core/graphics/sprites.ts:39:4
    (set_local $11
     (i32.sub
      (get_local $11)
      ;;@ core/graphics/sprites.ts:39:23
      (i32.const 8)
     )
    )
    ;;@ core/graphics/sprites.ts:42:4
    (set_local $5
     ;;@ core/graphics/sprites.ts:42:28
     (i32.const 8)
    )
    ;;@ core/graphics/sprites.ts:43:4
    (if
     (i32.and
      (get_local $1)
      (i32.const 1)
     )
     ;;@ core/graphics/sprites.ts:43:26
     (block
      ;;@ core/graphics/sprites.ts:44:6
      (set_local $5
       ;;@ core/graphics/sprites.ts:44:21
       (i32.const 16)
      )
      ;;@ core/graphics/sprites.ts:51:6
      (if
       ;;@ core/graphics/sprites.ts:51:10
       (i32.eq
        (i32.rem_s
         (get_local $4)
         ;;@ core/graphics/sprites.ts:51:25
         (i32.const 2)
        )
        ;;@ core/graphics/sprites.ts:51:31
        (i32.const 1)
       )
       ;;@ core/graphics/sprites.ts:51:34
       (set_local $4
        (i32.sub
         (get_local $4)
         ;;@ core/graphics/sprites.ts:52:24
         (i32.const 1)
        )
       )
      )
     )
    )
    ;;@ core/graphics/sprites.ts:57:8
    (if
     (tee_local $6
      (i32.ge_s
       (get_local $0)
       (get_local $2)
      )
     )
     (set_local $6
      ;;@ core/graphics/sprites.ts:57:47
      (i32.lt_s
       (get_local $0)
       ;;@ core/graphics/sprites.ts:57:66
       (i32.add
        (get_local $2)
        (get_local $5)
       )
      )
     )
    )
    ;;@ core/graphics/sprites.ts:57:4
    (if
     (get_local $6)
     ;;@ core/graphics/sprites.ts:57:98
     (block
      ;;@ core/graphics/sprites.ts:64:6
      (set_local $12
       ;;@ core/graphics/sprites.ts:64:63
       (call $core/helpers/index/checkBitOnByte
        ;;@ core/graphics/sprites.ts:64:78
        (i32.const 7)
        ;;@ core/graphics/sprites.ts:61:6
        (tee_local $6
         ;;@ core/graphics/sprites.ts:61:34
         (call $core/memory/load/eightBitLoadFromGBMemory
          (i32.add
           (get_local $3)
           (i32.const 65027)
          )
         )
        )
       )
      )
      ;;@ core/graphics/sprites.ts:67:6
      (set_local $3
       ;;@ core/graphics/sprites.ts:67:33
       (call $core/helpers/index/checkBitOnByte
        ;;@ core/graphics/sprites.ts:67:48
        (i32.const 6)
        (get_local $6)
       )
      )
      ;;@ core/graphics/sprites.ts:68:6
      (set_local $15
       ;;@ core/graphics/sprites.ts:68:33
       (call $core/helpers/index/checkBitOnByte
        ;;@ core/graphics/sprites.ts:68:48
        (i32.const 5)
        (get_local $6)
       )
      )
      ;;@ core/graphics/sprites.ts:71:6
      (set_local $2
       ;;@ core/graphics/sprites.ts:71:35
       (i32.sub
        (get_local $0)
        (get_local $2)
       )
      )
      ;;@ core/graphics/sprites.ts:74:6
      (if
       (get_local $3)
       ;;@ core/graphics/sprites.ts:79:8
       (set_local $2
        (i32.sub
         ;;@ core/graphics/sprites.ts:76:28
         (i32.mul
          (i32.sub
           (get_local $2)
           (get_local $5)
          )
          ;;@ core/graphics/sprites.ts:76:48
          (i32.const -1)
         )
         ;;@ core/graphics/sprites.ts:79:29
         (i32.const 1)
        )
       )
      )
      ;;@ core/graphics/sprites.ts:88:6
      (set_local $4
       ;;@ core/graphics/sprites.ts:87:31
       (i32.add
        ;;@ core/graphics/sprites.ts:86:40
        (call $core/graphics/tiles/getTileDataAddress
         (i32.const 32768)
         (get_local $4)
        )
        ;;@ core/graphics/sprites.ts:83:26
        (i32.shl
         (get_local $2)
         ;;@ core/graphics/sprites.ts:83:46
         (i32.const 1)
        )
       )
      )
      ;;@ core/graphics/sprites.ts:91:6
      (set_local $2
       ;;@ core/graphics/sprites.ts:91:28
       (i32.const 0)
      )
      ;;@ core/graphics/sprites.ts:92:6
      (if
       (tee_local $3
        ;;@ core/graphics/sprites.ts:92:10
        (if (result i32)
         (get_global $core/cpu/cpu/Cpu.GBCEnabled)
         ;;@ core/graphics/sprites.ts:92:28
         (call $core/helpers/index/checkBitOnByte
          ;;@ core/graphics/sprites.ts:92:43
          (i32.const 3)
          (get_local $6)
         )
         (get_global $core/cpu/cpu/Cpu.GBCEnabled)
        )
       )
       ;;@ core/graphics/sprites.ts:92:65
       (set_local $2
        ;;@ core/graphics/sprites.ts:93:21
        (i32.const 1)
       )
      )
      ;;@ core/graphics/sprites.ts:95:6
      (set_local $16
       ;;@ core/graphics/sprites.ts:95:54
       (call $core/graphics/graphics/loadFromVramBank
        (get_local $4)
        (get_local $2)
       )
      )
      ;;@ core/graphics/sprites.ts:96:6
      (set_local $17
       ;;@ core/graphics/sprites.ts:96:54
       (call $core/graphics/graphics/loadFromVramBank
        ;;@ core/graphics/sprites.ts:96:71
        (i32.add
         (get_local $4)
         ;;@ core/graphics/sprites.ts:96:91
         (i32.const 1)
        )
        (get_local $2)
       )
      )
      ;;@ core/graphics/sprites.ts:99:6
      (block $break|1
       ;;@ core/graphics/sprites.ts:99:11
       (set_local $5
        ;;@ core/graphics/sprites.ts:99:32
        (i32.const 7)
       )
       (loop $repeat|1
        (br_if $break|1
         ;;@ core/graphics/sprites.ts:99:35
         (i32.lt_s
          (get_local $5)
          ;;@ core/graphics/sprites.ts:99:48
          (i32.const 0)
         )
        )
        ;;@ core/graphics/sprites.ts:101:8
        (set_local $2
         (get_local $5)
        )
        ;;@ core/graphics/sprites.ts:102:8
        (if
         (get_local $15)
         ;;@ core/graphics/sprites.ts:104:10
         (set_local $2
          ;;@ core/graphics/sprites.ts:104:31
          (i32.mul
           (i32.sub
            (get_local $2)
            ;;@ core/graphics/sprites.ts:103:32
            (i32.const 7)
           )
           ;;@ core/graphics/sprites.ts:104:52
           (i32.const -1)
          )
         )
        )
        ;;@ core/graphics/sprites.ts:110:8
        (set_local $8
         ;;@ core/graphics/sprites.ts:110:33
         (i32.const 0)
        )
        ;;@ core/graphics/sprites.ts:111:8
        (if
         ;;@ core/graphics/sprites.ts:111:12
         (call $core/helpers/index/checkBitOnByte
          (get_local $2)
          (get_local $17)
         )
         ;;@ core/graphics/sprites.ts:114:10
         (set_local $8
          (i32.const 2)
         )
        )
        ;;@ core/graphics/sprites.ts:116:8
        (if
         ;;@ core/graphics/sprites.ts:116:12
         (call $core/helpers/index/checkBitOnByte
          (get_local $2)
          (get_local $16)
         )
         ;;@ core/graphics/sprites.ts:116:86
         (set_local $8
          (i32.add
           (get_local $8)
           ;;@ core/graphics/sprites.ts:117:27
           (i32.const 1)
          )
         )
        )
        ;;@ core/graphics/sprites.ts:122:8
        (if
         (get_local $8)
         (block
          ;;@ core/graphics/sprites.ts:126:14
          (if
           (tee_local $2
            (i32.ge_s
             ;;@ core/graphics/sprites.ts:125:10
             (tee_local $7
              ;;@ core/graphics/sprites.ts:125:54
              (i32.add
               (get_local $11)
               ;;@ core/graphics/sprites.ts:125:72
               (i32.sub
                ;;@ core/graphics/sprites.ts:125:73
                (i32.const 7)
                (get_local $5)
               )
              )
             )
             ;;@ core/graphics/sprites.ts:126:50
             (i32.const 0)
            )
           )
           (set_local $2
            ;;@ core/graphics/sprites.ts:126:55
            (i32.le_s
             (get_local $7)
             ;;@ core/graphics/sprites.ts:126:91
             (i32.const 160)
            )
           )
          )
          ;;@ core/graphics/sprites.ts:126:10
          (if
           (get_local $2)
           ;;@ core/graphics/sprites.ts:126:96
           (block
            ;;@ core/graphics/sprites.ts:133:12
            (set_local $2
             ;;@ core/graphics/sprites.ts:133:54
             (i32.const 0)
            )
            ;;@ core/graphics/sprites.ts:134:12
            (set_local $13
             ;;@ core/graphics/sprites.ts:134:53
             (i32.const 0)
            )
            ;;@ core/graphics/sprites.ts:135:12
            (set_local $14
             ;;@ core/graphics/sprites.ts:135:52
             (i32.const 0)
            )
            ;;@ core/graphics/sprites.ts:137:12
            (if
             (tee_local $4
              ;;@ core/graphics/sprites.ts:137:16
              (if (result i32)
               (get_global $core/cpu/cpu/Cpu.GBCEnabled)
               ;;@ core/graphics/sprites.ts:137:34
               (i32.eqz
                ;;@ core/graphics/sprites.ts:137:35
                (get_global $core/graphics/lcd/Lcd.bgDisplayEnabled)
               )
               (get_global $core/cpu/cpu/Cpu.GBCEnabled)
              )
             )
             ;;@ core/graphics/sprites.ts:137:57
             (set_local $2
              ;;@ core/graphics/sprites.ts:138:43
              (i32.const 1)
             )
            )
            ;;@ core/graphics/sprites.ts:141:12
            (if
             ;;@ core/graphics/sprites.ts:141:16
             (i32.eqz
              (get_local $2)
             )
             ;;@ core/graphics/sprites.ts:141:45
             (block
              ;;@ core/graphics/sprites.ts:146:14
              (set_local $3
               ;;@ core/graphics/sprites.ts:146:49
               (i32.and
                ;;@ core/graphics/sprites.ts:144:14
                (tee_local $10
                 ;;@ core/graphics/sprites.ts:144:40
                 (call $core/graphics/priority/getPriorityforPixel
                  (get_local $7)
                  (get_local $0)
                 )
                )
                ;;@ core/graphics/sprites.ts:146:66
                (i32.const 3)
               )
              )
              ;;@ core/graphics/sprites.ts:149:14
              (if
               (tee_local $4
                ;;@ core/graphics/sprites.ts:149:18
                (if (result i32)
                 (get_local $12)
                 ;;@ core/graphics/sprites.ts:149:63
                 (i32.gt_s
                  (get_local $3)
                  ;;@ core/graphics/sprites.ts:149:89
                  (i32.const 0)
                 )
                 (get_local $12)
                )
               )
               ;;@ core/graphics/sprites.ts:149:92
               (set_local $13
                ;;@ core/graphics/sprites.ts:151:44
                (i32.const 1)
               )
               (block
                ;;@ core/graphics/sprites.ts:152:25
                (if
                 (tee_local $4
                  (if (result i32)
                   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
                   ;;@ core/graphics/sprites.ts:152:43
                   (call $core/helpers/index/checkBitOnByte
                    ;;@ core/graphics/sprites.ts:152:58
                    (i32.const 2)
                    (get_local $10)
                   )
                   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
                  )
                 )
                 (set_local $4
                  ;;@ core/graphics/sprites.ts:152:80
                  (i32.gt_s
                   (get_local $3)
                   ;;@ core/graphics/sprites.ts:152:106
                   (i32.const 0)
                  )
                 )
                )
                ;;@ core/graphics/sprites.ts:152:21
                (if
                 (get_local $4)
                 ;;@ core/graphics/sprites.ts:152:109
                 (set_local $14
                  ;;@ core/graphics/sprites.ts:154:43
                  (i32.const 1)
                 )
                )
               )
              )
             )
            )
            ;;@ core/graphics/sprites.ts:158:16
            (if
             (i32.eqz
              (get_local $2)
             )
             (set_local $2
              ;;@ core/graphics/sprites.ts:158:46
              (if (result i32)
               (tee_local $3
                ;;@ core/graphics/sprites.ts:158:47
                (i32.eqz
                 (get_local $13)
                )
               )
               ;;@ core/graphics/sprites.ts:158:77
               (i32.eqz
                (get_local $14)
               )
               (get_local $3)
              )
             )
            )
            ;;@ core/graphics/sprites.ts:158:12
            (if
             (get_local $2)
             ;;@ core/graphics/sprites.ts:158:105
             (if
              ;;@ core/graphics/sprites.ts:159:19
              (get_global $core/cpu/cpu/Cpu.GBCEnabled)
              ;;@ core/graphics/sprites.ts:172:21
              (block
               ;;@ core/graphics/sprites.ts:183:16
               (set_local $4
                ;;@ core/graphics/sprites.ts:183:31
                (call $core/graphics/palette/getColorComponentFromRgb
                 ;;@ core/graphics/sprites.ts:183:56
                 (i32.const 0)
                 ;;@ core/graphics/sprites.ts:180:16
                 (tee_local $3
                  ;;@ core/graphics/sprites.ts:180:43
                  (call $core/graphics/palette/getRgbColorFromPalette
                   ;;@ core/graphics/sprites.ts:177:37
                   (i32.and
                    (get_local $6)
                    ;;@ core/graphics/sprites.ts:177:56
                    (i32.const 7)
                   )
                   (get_local $8)
                   ;;@ core/graphics/sprites.ts:180:92
                   (i32.const 1)
                  )
                 )
                )
               )
               ;;@ core/graphics/sprites.ts:184:16
               (set_local $2
                ;;@ core/graphics/sprites.ts:184:33
                (call $core/graphics/palette/getColorComponentFromRgb
                 ;;@ core/graphics/sprites.ts:184:58
                 (i32.const 1)
                 (get_local $3)
                )
               )
               ;;@ core/graphics/sprites.ts:185:16
               (set_local $3
                ;;@ core/graphics/sprites.ts:185:32
                (call $core/graphics/palette/getColorComponentFromRgb
                 ;;@ core/graphics/sprites.ts:185:57
                 (i32.const 2)
                 (get_local $3)
                )
               )
               ;;@ core/graphics/sprites.ts:188:16
               (call $core/graphics/graphics/setPixelOnFrame
                (get_local $7)
                (get_local $0)
                ;;@ core/graphics/sprites.ts:188:84
                (i32.const 0)
                (get_local $4)
               )
               ;;@ core/graphics/sprites.ts:189:16
               (call $core/graphics/graphics/setPixelOnFrame
                (get_local $7)
                (get_local $0)
                ;;@ core/graphics/sprites.ts:189:84
                (i32.const 1)
                (get_local $2)
               )
               ;;@ core/graphics/sprites.ts:190:16
               (call $core/graphics/graphics/setPixelOnFrame
                (get_local $7)
                (get_local $0)
                ;;@ core/graphics/sprites.ts:190:84
                (i32.const 2)
                (get_local $3)
               )
              )
              ;;@ core/graphics/sprites.ts:159:35
              (block
               ;;@ core/graphics/sprites.ts:162:16
               (set_local $3
                (i32.const 65352)
               )
               ;;@ core/graphics/sprites.ts:163:16
               (if
                ;;@ core/graphics/sprites.ts:163:20
                (call $core/helpers/index/checkBitOnByte
                 ;;@ core/graphics/sprites.ts:163:35
                 (i32.const 4)
                 (get_local $6)
                )
                ;;@ core/graphics/sprites.ts:163:57
                (set_local $3
                 (i32.const 65353)
                )
               )
               ;;@ core/graphics/sprites.ts:169:16
               (call $core/graphics/graphics/setPixelOnFrame
                (get_local $7)
                (get_local $0)
                ;;@ core/graphics/sprites.ts:169:84
                (i32.const 0)
                ;;@ core/graphics/sprites.ts:166:16
                (tee_local $10
                 ;;@ core/graphics/sprites.ts:166:55
                 (call $core/graphics/palette/getMonochromeColorFromPalette
                  (get_local $8)
                  (get_local $3)
                  ;;@ core/graphics/palette.ts:37:43
                  (i32.const 0)
                 )
                )
               )
               ;;@ core/graphics/sprites.ts:170:16
               (call $core/graphics/graphics/setPixelOnFrame
                (get_local $7)
                (get_local $0)
                ;;@ core/graphics/sprites.ts:170:84
                (i32.const 1)
                (get_local $10)
               )
               ;;@ core/graphics/sprites.ts:171:16
               (call $core/graphics/graphics/setPixelOnFrame
                (get_local $7)
                (get_local $0)
                ;;@ core/graphics/sprites.ts:171:84
                (i32.const 2)
                (get_local $10)
               )
              )
             )
            )
           )
          )
         )
        )
        ;;@ core/graphics/sprites.ts:99:51
        (set_local $5
         (i32.sub
          (get_local $5)
          (i32.const 1)
         )
        )
        (br $repeat|1)
       )
      )
     )
    )
    ;;@ core/graphics/sprites.ts:18:32
    (set_local $9
     (i32.sub
      (get_local $9)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
 )
 (func $core/graphics/graphics/_drawScanline (; 48 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/graphics/graphics.ts:232:2
  (set_local $2
   (i32.const 34816)
  )
  ;;@ core/graphics/graphics.ts:233:2
  (if
   ;;@ core/graphics/graphics.ts:233:6
   (get_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect)
   ;;@ core/graphics/graphics.ts:233:34
   (set_local $2
    (i32.const 32768)
   )
  )
  ;;@ core/graphics/graphics.ts:244:2
  (if
   (tee_local $1
    ;;@ core/graphics/graphics.ts:244:6
    (if (result i32)
     (get_global $core/cpu/cpu/Cpu.GBCEnabled)
     (get_global $core/cpu/cpu/Cpu.GBCEnabled)
     ;;@ core/graphics/graphics.ts:244:24
     (get_global $core/graphics/lcd/Lcd.bgDisplayEnabled)
    )
   )
   ;;@ core/graphics/graphics.ts:244:46
   (block
    ;;@ core/graphics/graphics.ts:246:4
    (set_local $1
     (i32.const 38912)
    )
    ;;@ core/graphics/graphics.ts:247:4
    (if
     ;;@ core/graphics/graphics.ts:247:8
     (get_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect)
     ;;@ core/graphics/graphics.ts:247:36
     (set_local $1
      (i32.const 39936)
     )
    )
    ;;@ core/graphics/graphics.ts:252:4
    (call $core/graphics/backgroundWindow/renderBackground
     (get_local $0)
     (get_local $2)
     (get_local $1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:257:2
  (if
   ;;@ core/graphics/graphics.ts:257:6
   (get_global $core/graphics/lcd/Lcd.windowDisplayEnabled)
   ;;@ core/graphics/graphics.ts:257:32
   (block
    ;;@ core/graphics/graphics.ts:259:4
    (set_local $1
     (i32.const 38912)
    )
    ;;@ core/graphics/graphics.ts:260:4
    (if
     ;;@ core/graphics/graphics.ts:260:8
     (get_global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect)
     ;;@ core/graphics/graphics.ts:260:40
     (set_local $1
      (i32.const 39936)
     )
    )
    ;;@ core/graphics/graphics.ts:265:4
    (call $core/graphics/backgroundWindow/renderWindow
     (get_local $0)
     (get_local $2)
     (get_local $1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:268:2
  (if
   ;;@ core/graphics/graphics.ts:268:6
   (get_global $core/graphics/lcd/Lcd.spriteDisplayEnable)
   ;;@ core/graphics/graphics.ts:268:31
   (call $core/graphics/sprites/renderSprites
    (get_local $0)
    ;;@ core/graphics/graphics.ts:270:36
    (get_global $core/graphics/lcd/Lcd.tallSpriteSize)
   )
  )
 )
 (func $core/graphics/graphics/_renderEntireFrame (; 49 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/graphics/graphics.ts:279:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/graphics/graphics.ts:279:22
     (i32.gt_u
      (get_local $0)
      ;;@ core/graphics/graphics.ts:279:27
      (i32.const 144)
     )
    )
    ;;@ core/graphics/graphics.ts:280:4
    (call $core/graphics/graphics/_drawScanline
     ;;@ core/graphics/graphics.ts:280:18
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
    )
    ;;@ core/graphics/graphics.ts:279:32
    (set_local $0
     (i32.add
      (get_local $0)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
 )
 (func $core/graphics/priority/clearPriorityMap (; 50 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/graphics/priority.ts:22:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/graphics/priority.ts:22:23
     (i32.ge_s
      (get_local $0)
      ;;@ core/graphics/priority.ts:22:27
      (i32.const 144)
     )
    )
    ;;@ core/graphics/priority.ts:23:4
    (block $break|1
     ;;@ core/graphics/priority.ts:23:9
     (set_local $1
      ;;@ core/graphics/priority.ts:23:22
      (i32.const 0)
     )
     (loop $repeat|1
      (br_if $break|1
       ;;@ core/graphics/priority.ts:23:25
       (i32.ge_s
        (get_local $1)
        ;;@ core/graphics/priority.ts:23:29
        (i32.const 160)
       )
      )
      ;;@ core/graphics/priority.ts:24:6
      (i32.store8
       ;;@ core/graphics/priority.ts:24:16
       (i32.add
        ;;@ core/graphics/priority.ts:24:43
        (call $core/graphics/priority/getPixelStart
         (get_local $1)
         (get_local $0)
        )
        (i32.const 69632)
       )
       ;;@ core/graphics/priority.ts:24:64
       (i32.const 0)
      )
      ;;@ core/graphics/priority.ts:23:34
      (set_local $1
       (i32.add
        (get_local $1)
        (i32.const 1)
       )
      )
      (br $repeat|1)
     )
    )
    ;;@ core/graphics/priority.ts:22:32
    (set_local $0
     (i32.add
      (get_local $0)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
 )
 (func $core/graphics/tiles/resetTileCache (; 51 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/tiles.ts:21:2
  (set_global $core/graphics/tiles/TileCache.tileId
   ;;@ core/graphics/tiles.ts:21:21
   (i32.const -1)
  )
  ;;@ core/graphics/tiles.ts:22:2
  (set_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
   ;;@ core/graphics/tiles.ts:22:44
   (i32.const -1)
  )
 )
 (func $core/graphics/graphics/Graphics.MIN_CYCLES_SPRITES_LCD_MODE (; 52 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:47:4
  (if
   ;;@ core/graphics/graphics.ts:47:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 752)
   )
  )
  (i32.const 376)
 )
 (func $core/graphics/graphics/Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE (; 53 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:55:4
  (if
   ;;@ core/graphics/graphics.ts:55:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 498)
   )
  )
  (i32.const 249)
 )
 (func $core/interrupts/interrupts/_requestInterrupt (; 54 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/interrupts/interrupts.ts:163:2
  (set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   ;;@ core/interrupts/interrupts.ts:161:2
   (tee_local $1
    ;;@ core/interrupts/interrupts.ts:161:21
    (call $core/helpers/index/setBitOnByte
     (get_local $0)
     ;;@ core/interrupts/interrupts.ts:158:25
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.const 65295)
     )
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:165:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65295)
   (get_local $1)
  )
 )
 (func $core/interrupts/interrupts/requestLcdInterrupt (; 55 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:178:2
  (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
   ;;@ core/interrupts/interrupts.ts:178:39
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:179:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 1)
  )
 )
 (func $core/sound/sound/Sound.batchProcessCycles (; 56 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/sound/sound.ts:41:4
  (if
   ;;@ core/sound/sound.ts:41:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 174)
   )
  )
  (i32.const 87)
 )
 (func $core/sound/sound/Sound.maxFrameSequenceCycles (; 57 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/sound/sound.ts:92:4
  (if
   ;;@ core/sound/sound.ts:92:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 16384)
   )
  )
  (i32.const 8192)
 )
 (func $core/sound/channel1/Channel1.updateLength (; 58 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel1.ts:294:8
  (if
   (tee_local $0
    (i32.gt_s
     (get_global $core/sound/channel1/Channel1.lengthCounter)
     ;;@ core/sound/channel1.ts:294:33
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel1.ts:294:38
    (get_global $core/sound/channel1/Channel1.NRx4LengthEnabled)
   )
  )
  ;;@ core/sound/channel1.ts:294:4
  (if
   (get_local $0)
   ;;@ core/sound/channel1.ts:294:66
   (set_global $core/sound/channel1/Channel1.lengthCounter
    (i32.sub
     ;;@ core/sound/channel1.ts:295:6
     (get_global $core/sound/channel1/Channel1.lengthCounter)
     ;;@ core/sound/channel1.ts:295:32
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/channel1.ts:298:4
  (if
   (i32.eqz
    ;;@ core/sound/channel1.ts:298:8
    (get_global $core/sound/channel1/Channel1.lengthCounter)
   )
   ;;@ core/sound/channel1.ts:298:38
   (set_global $core/sound/channel1/Channel1.isEnabled
    ;;@ core/sound/channel1.ts:299:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel2/Channel2.updateLength (; 59 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel2.ts:232:8
  (if
   (tee_local $0
    (i32.gt_s
     (get_global $core/sound/channel2/Channel2.lengthCounter)
     ;;@ core/sound/channel2.ts:232:33
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel2.ts:232:38
    (get_global $core/sound/channel2/Channel2.NRx4LengthEnabled)
   )
  )
  ;;@ core/sound/channel2.ts:232:4
  (if
   (get_local $0)
   ;;@ core/sound/channel2.ts:232:66
   (set_global $core/sound/channel2/Channel2.lengthCounter
    (i32.sub
     ;;@ core/sound/channel2.ts:233:6
     (get_global $core/sound/channel2/Channel2.lengthCounter)
     ;;@ core/sound/channel2.ts:233:32
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/channel2.ts:236:4
  (if
   (i32.eqz
    ;;@ core/sound/channel2.ts:236:8
    (get_global $core/sound/channel2/Channel2.lengthCounter)
   )
   ;;@ core/sound/channel2.ts:236:38
   (set_global $core/sound/channel2/Channel2.isEnabled
    ;;@ core/sound/channel2.ts:237:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel3/Channel3.updateLength (; 60 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel3.ts:268:8
  (if
   (tee_local $0
    (i32.gt_s
     (get_global $core/sound/channel3/Channel3.lengthCounter)
     ;;@ core/sound/channel3.ts:268:33
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel3.ts:268:38
    (get_global $core/sound/channel3/Channel3.NRx4LengthEnabled)
   )
  )
  ;;@ core/sound/channel3.ts:268:4
  (if
   (get_local $0)
   ;;@ core/sound/channel3.ts:268:66
   (set_global $core/sound/channel3/Channel3.lengthCounter
    (i32.sub
     ;;@ core/sound/channel3.ts:269:6
     (get_global $core/sound/channel3/Channel3.lengthCounter)
     ;;@ core/sound/channel3.ts:269:32
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/channel3.ts:272:4
  (if
   (i32.eqz
    ;;@ core/sound/channel3.ts:272:8
    (get_global $core/sound/channel3/Channel3.lengthCounter)
   )
   ;;@ core/sound/channel3.ts:272:38
   (set_global $core/sound/channel3/Channel3.isEnabled
    ;;@ core/sound/channel3.ts:273:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateLength (; 61 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel4.ts:266:8
  (if
   (tee_local $0
    (i32.gt_s
     (get_global $core/sound/channel4/Channel4.lengthCounter)
     ;;@ core/sound/channel4.ts:266:33
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel4.ts:266:38
    (get_global $core/sound/channel4/Channel4.NRx4LengthEnabled)
   )
  )
  ;;@ core/sound/channel4.ts:266:4
  (if
   (get_local $0)
   ;;@ core/sound/channel4.ts:266:66
   (set_global $core/sound/channel4/Channel4.lengthCounter
    (i32.sub
     ;;@ core/sound/channel4.ts:267:6
     (get_global $core/sound/channel4/Channel4.lengthCounter)
     ;;@ core/sound/channel4.ts:267:32
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/channel4.ts:270:4
  (if
   (i32.eqz
    ;;@ core/sound/channel4.ts:270:8
    (get_global $core/sound/channel4/Channel4.lengthCounter)
   )
   ;;@ core/sound/channel4.ts:270:38
   (set_global $core/sound/channel4/Channel4.isEnabled
    ;;@ core/sound/channel4.ts:271:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel1/getNewFrequencyFromSweep (; 62 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/sound/channel1.ts:375:2
  (set_local $0
   ;;@ core/sound/channel1.ts:375:17
   (i32.shr_s
    ;;@ core/sound/channel1.ts:374:26
    (get_global $core/sound/channel1/Channel1.sweepShadowFrequency)
    ;;@ core/sound/channel1.ts:375:33
    (get_global $core/sound/channel1/Channel1.NRx0SweepShift)
   )
  )
  (tee_local $0
   ;;@ core/sound/channel1.ts:378:2
   (if (result i32)
    ;;@ core/sound/channel1.ts:378:6
    (get_global $core/sound/channel1/Channel1.NRx0Negate)
    ;;@ core/sound/channel1.ts:379:19
    (i32.sub
     (get_global $core/sound/channel1/Channel1.sweepShadowFrequency)
     (get_local $0)
    )
    ;;@ core/sound/channel1.ts:381:19
    (i32.add
     (get_global $core/sound/channel1/Channel1.sweepShadowFrequency)
     (get_local $0)
    )
   )
  )
 )
 (func $core/sound/channel1/Channel1.setFrequency (; 63 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/sound/channel1.ts:332:4
  (set_local $1
   ;;@ core/sound/channel1.ts:332:28
   (i32.and
    ;;@ core/sound/channel1.ts:330:25
    (call $core/memory/load/eightBitLoadFromGBMemory
     (i32.const 65300)
    )
    ;;@ core/sound/channel1.ts:332:40
    (i32.const 248)
   )
  )
  ;;@ core/sound/channel1.ts:336:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65299)
   ;;@ core/sound/channel1.ts:327:4
   (tee_local $2
    ;;@ core/sound/channel1.ts:327:38
    (i32.and
     (get_local $0)
     ;;@ core/sound/channel1.ts:327:50
     (i32.const 255)
    )
   )
  )
  ;;@ core/sound/channel1.ts:337:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65300)
   ;;@ core/sound/channel1.ts:333:19
   (i32.or
    (get_local $1)
    ;;@ core/sound/channel1.ts:326:4
    (tee_local $0
     ;;@ core/sound/channel1.ts:326:39
     (i32.shr_s
      (get_local $0)
      ;;@ core/sound/channel1.ts:326:52
      (i32.const 8)
     )
    )
   )
  )
  ;;@ core/sound/channel1.ts:340:4
  (set_global $core/sound/channel1/Channel1.NRx3FrequencyLSB
   (get_local $2)
  )
  ;;@ core/sound/channel1.ts:341:4
  (set_global $core/sound/channel1/Channel1.NRx4FrequencyMSB
   (get_local $0)
  )
  ;;@ core/sound/channel1.ts:342:4
  (set_global $core/sound/channel1/Channel1.frequency
   ;;@ core/sound/channel1.ts:342:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel1.ts:342:26
     (get_global $core/sound/channel1/Channel1.NRx4FrequencyMSB)
     ;;@ core/sound/channel1.ts:342:55
     (i32.const 8)
    )
    ;;@ core/sound/channel1.ts:342:60
    (get_global $core/sound/channel1/Channel1.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel1/calculateSweepAndCheckOverflow (; 64 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/sound/channel1.ts:351:6
  (if
   (tee_local $1
    (i32.le_s
     ;;@ core/sound/channel1.ts:349:2
     (tee_local $0
      ;;@ core/sound/channel1.ts:349:26
      (call $core/sound/channel1/getNewFrequencyFromSweep)
     )
     ;;@ core/sound/channel1.ts:351:22
     (i32.const 2047)
    )
   )
   (set_local $1
    ;;@ core/sound/channel1.ts:351:31
    (i32.gt_s
     (get_global $core/sound/channel1/Channel1.NRx0SweepShift)
     ;;@ core/sound/channel1.ts:351:57
     (i32.const 0)
    )
   )
  )
  ;;@ core/sound/channel1.ts:351:2
  (if
   (get_local $1)
   ;;@ core/sound/channel1.ts:351:60
   (block
    ;;@ core/sound/channel1.ts:357:4
    (set_global $core/sound/channel1/Channel1.sweepShadowFrequency
     (get_local $0)
    )
    ;;@ core/sound/channel1.ts:358:13
    (call $core/sound/channel1/Channel1.setFrequency
     (get_local $0)
    )
    ;;@ core/sound/channel1.ts:361:4
    (set_local $0
     ;;@ core/sound/channel1.ts:361:19
     (call $core/sound/channel1/getNewFrequencyFromSweep)
    )
   )
  )
  ;;@ core/sound/channel1.ts:366:2
  (if
   ;;@ core/sound/channel1.ts:366:6
   (i32.gt_s
    (get_local $0)
    ;;@ core/sound/channel1.ts:366:21
    (i32.const 2047)
   )
   ;;@ core/sound/channel1.ts:366:28
   (set_global $core/sound/channel1/Channel1.isEnabled
    ;;@ core/sound/channel1.ts:367:25
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateSweep (; 65 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel1.ts:278:4
  (set_global $core/sound/channel1/Channel1.sweepCounter
   (i32.sub
    (get_global $core/sound/channel1/Channel1.sweepCounter)
    ;;@ core/sound/channel1.ts:278:29
    (i32.const 1)
   )
  )
  ;;@ core/sound/channel1.ts:280:4
  (if
   ;;@ core/sound/channel1.ts:280:8
   (i32.le_s
    (get_global $core/sound/channel1/Channel1.sweepCounter)
    ;;@ core/sound/channel1.ts:280:33
    (i32.const 0)
   )
   ;;@ core/sound/channel1.ts:280:36
   (block
    ;;@ core/sound/channel1.ts:282:6
    (set_global $core/sound/channel1/Channel1.sweepCounter
     ;;@ core/sound/channel1.ts:282:30
     (get_global $core/sound/channel1/Channel1.NRx0SweepPeriod)
    )
    ;;@ core/sound/channel1.ts:287:6
    (if
     ;;@ core/sound/channel1.ts:287:10
     (if (result i32)
      (get_global $core/sound/channel1/Channel1.isSweepEnabled)
      ;;@ core/sound/channel1.ts:287:37
      (i32.gt_s
       (get_global $core/sound/channel1/Channel1.NRx0SweepPeriod)
       ;;@ core/sound/channel1.ts:287:64
       (i32.const 0)
      )
      (get_global $core/sound/channel1/Channel1.isSweepEnabled)
     )
     ;;@ core/sound/channel1.ts:287:67
     (call $core/sound/channel1/calculateSweepAndCheckOverflow)
    )
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateEnvelope (; 66 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel1.ts:307:4
  (set_global $core/sound/channel1/Channel1.envelopeCounter
   (i32.sub
    (get_global $core/sound/channel1/Channel1.envelopeCounter)
    ;;@ core/sound/channel1.ts:307:32
    (i32.const 1)
   )
  )
  ;;@ core/sound/channel1.ts:308:4
  (if
   ;;@ core/sound/channel1.ts:308:8
   (i32.le_s
    (get_global $core/sound/channel1/Channel1.envelopeCounter)
    ;;@ core/sound/channel1.ts:308:36
    (i32.const 0)
   )
   ;;@ core/sound/channel1.ts:308:39
   (block
    ;;@ core/sound/channel1.ts:309:6
    (set_global $core/sound/channel1/Channel1.envelopeCounter
     ;;@ core/sound/channel1.ts:309:33
     (get_global $core/sound/channel1/Channel1.NRx2EnvelopePeriod)
    )
    ;;@ core/sound/channel1.ts:314:6
    (if
     ;;@ core/sound/channel1.ts:314:10
     (get_global $core/sound/channel1/Channel1.envelopeCounter)
     ;;@ core/sound/channel1.ts:314:42
     (if
      (tee_local $0
       ;;@ core/sound/channel1.ts:315:12
       (if (result i32)
        (get_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode)
        ;;@ core/sound/channel1.ts:315:44
        (i32.lt_s
         (get_global $core/sound/channel1/Channel1.volume)
         ;;@ core/sound/channel1.ts:315:62
         (i32.const 15)
        )
        (get_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode)
       )
      )
      ;;@ core/sound/channel1.ts:315:66
      (set_global $core/sound/channel1/Channel1.volume
       (i32.add
        ;;@ core/sound/channel1.ts:316:10
        (get_global $core/sound/channel1/Channel1.volume)
        ;;@ core/sound/channel1.ts:316:29
        (i32.const 1)
       )
      )
      (block
       ;;@ core/sound/channel1.ts:317:19
       (if
        (tee_local $0
         (i32.eqz
          ;;@ core/sound/channel1.ts:317:20
          (get_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode)
         )
        )
        (set_local $0
         ;;@ core/sound/channel1.ts:317:52
         (i32.gt_s
          (get_global $core/sound/channel1/Channel1.volume)
          ;;@ core/sound/channel1.ts:317:70
          (i32.const 0)
         )
        )
       )
       ;;@ core/sound/channel1.ts:317:15
       (if
        (get_local $0)
        ;;@ core/sound/channel1.ts:317:73
        (set_global $core/sound/channel1/Channel1.volume
         (i32.sub
          ;;@ core/sound/channel1.ts:318:10
          (get_global $core/sound/channel1/Channel1.volume)
          ;;@ core/sound/channel1.ts:318:29
          (i32.const 1)
         )
        )
       )
      )
     )
    )
   )
  )
 )
 (func $core/sound/channel2/Channel2.updateEnvelope (; 67 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel2.ts:245:4
  (set_global $core/sound/channel2/Channel2.envelopeCounter
   (i32.sub
    (get_global $core/sound/channel2/Channel2.envelopeCounter)
    ;;@ core/sound/channel2.ts:245:32
    (i32.const 1)
   )
  )
  ;;@ core/sound/channel2.ts:246:4
  (if
   ;;@ core/sound/channel2.ts:246:8
   (i32.le_s
    (get_global $core/sound/channel2/Channel2.envelopeCounter)
    ;;@ core/sound/channel2.ts:246:36
    (i32.const 0)
   )
   ;;@ core/sound/channel2.ts:246:39
   (block
    ;;@ core/sound/channel2.ts:247:6
    (set_global $core/sound/channel2/Channel2.envelopeCounter
     ;;@ core/sound/channel2.ts:247:33
     (get_global $core/sound/channel2/Channel2.NRx2EnvelopePeriod)
    )
    ;;@ core/sound/channel2.ts:251:6
    (if
     ;;@ core/sound/channel2.ts:251:10
     (get_global $core/sound/channel2/Channel2.envelopeCounter)
     ;;@ core/sound/channel2.ts:251:42
     (if
      (tee_local $0
       ;;@ core/sound/channel2.ts:252:12
       (if (result i32)
        (get_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode)
        ;;@ core/sound/channel2.ts:252:44
        (i32.lt_s
         (get_global $core/sound/channel2/Channel2.volume)
         ;;@ core/sound/channel2.ts:252:62
         (i32.const 15)
        )
        (get_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode)
       )
      )
      ;;@ core/sound/channel2.ts:252:66
      (set_global $core/sound/channel2/Channel2.volume
       (i32.add
        ;;@ core/sound/channel2.ts:253:10
        (get_global $core/sound/channel2/Channel2.volume)
        ;;@ core/sound/channel2.ts:253:29
        (i32.const 1)
       )
      )
      (block
       ;;@ core/sound/channel2.ts:254:19
       (if
        (tee_local $0
         (i32.eqz
          ;;@ core/sound/channel2.ts:254:20
          (get_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode)
         )
        )
        (set_local $0
         ;;@ core/sound/channel2.ts:254:52
         (i32.gt_s
          (get_global $core/sound/channel2/Channel2.volume)
          ;;@ core/sound/channel2.ts:254:70
          (i32.const 0)
         )
        )
       )
       ;;@ core/sound/channel2.ts:254:15
       (if
        (get_local $0)
        ;;@ core/sound/channel2.ts:254:73
        (set_global $core/sound/channel2/Channel2.volume
         (i32.sub
          ;;@ core/sound/channel2.ts:255:10
          (get_global $core/sound/channel2/Channel2.volume)
          ;;@ core/sound/channel2.ts:255:29
          (i32.const 1)
         )
        )
       )
      )
     )
    )
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateEnvelope (; 68 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel4.ts:279:4
  (set_global $core/sound/channel4/Channel4.envelopeCounter
   (i32.sub
    (get_global $core/sound/channel4/Channel4.envelopeCounter)
    ;;@ core/sound/channel4.ts:279:32
    (i32.const 1)
   )
  )
  ;;@ core/sound/channel4.ts:280:4
  (if
   ;;@ core/sound/channel4.ts:280:8
   (i32.le_s
    (get_global $core/sound/channel4/Channel4.envelopeCounter)
    ;;@ core/sound/channel4.ts:280:36
    (i32.const 0)
   )
   ;;@ core/sound/channel4.ts:280:39
   (block
    ;;@ core/sound/channel4.ts:281:6
    (set_global $core/sound/channel4/Channel4.envelopeCounter
     ;;@ core/sound/channel4.ts:281:33
     (get_global $core/sound/channel4/Channel4.NRx2EnvelopePeriod)
    )
    ;;@ core/sound/channel4.ts:285:6
    (if
     ;;@ core/sound/channel4.ts:285:10
     (get_global $core/sound/channel4/Channel4.envelopeCounter)
     ;;@ core/sound/channel4.ts:285:42
     (if
      (tee_local $0
       ;;@ core/sound/channel4.ts:286:12
       (if (result i32)
        (get_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode)
        ;;@ core/sound/channel4.ts:286:44
        (i32.lt_s
         (get_global $core/sound/channel4/Channel4.volume)
         ;;@ core/sound/channel4.ts:286:62
         (i32.const 15)
        )
        (get_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode)
       )
      )
      ;;@ core/sound/channel4.ts:286:66
      (set_global $core/sound/channel4/Channel4.volume
       (i32.add
        ;;@ core/sound/channel4.ts:287:10
        (get_global $core/sound/channel4/Channel4.volume)
        ;;@ core/sound/channel4.ts:287:29
        (i32.const 1)
       )
      )
      (block
       ;;@ core/sound/channel4.ts:288:19
       (if
        (tee_local $0
         (i32.eqz
          ;;@ core/sound/channel4.ts:288:20
          (get_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode)
         )
        )
        (set_local $0
         ;;@ core/sound/channel4.ts:288:52
         (i32.gt_s
          (get_global $core/sound/channel4/Channel4.volume)
          ;;@ core/sound/channel4.ts:288:70
          (i32.const 0)
         )
        )
       )
       ;;@ core/sound/channel4.ts:288:15
       (if
        (get_local $0)
        ;;@ core/sound/channel4.ts:288:73
        (set_global $core/sound/channel4/Channel4.volume
         (i32.sub
          ;;@ core/sound/channel4.ts:289:10
          (get_global $core/sound/channel4/Channel4.volume)
          ;;@ core/sound/channel4.ts:289:29
          (i32.const 1)
         )
        )
       )
      )
     )
    )
   )
  )
 )
 (func $core/sound/sound/updateFrameSequencer (; 69 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/sound.ts:261:2
  (set_global $core/sound/sound/Sound.frameSequenceCycleCounter
   (i32.add
    (get_global $core/sound/sound/Sound.frameSequenceCycleCounter)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:262:2
  (if
   ;;@ core/sound/sound.ts:262:6
   (i32.ge_s
    (get_global $core/sound/sound/Sound.frameSequenceCycleCounter)
    ;;@ core/sound/sound.ts:262:47
    (call $core/sound/sound/Sound.maxFrameSequenceCycles)
   )
   ;;@ core/sound/sound.ts:262:73
   (block
    ;;@ core/sound/sound.ts:265:4
    (set_global $core/sound/sound/Sound.frameSequenceCycleCounter
     (i32.sub
      (get_global $core/sound/sound/Sound.frameSequenceCycleCounter)
      ;;@ core/sound/sound.ts:265:45
      (call $core/sound/sound/Sound.maxFrameSequenceCycles)
     )
    )
    ;;@ core/sound/sound.ts:269:4
    (block $break|0
     (block $case4|0
      (block $case3|0
       (block $case2|0
        (block $case1|0
         (if
          (tee_local $1
           ;;@ core/sound/sound.ts:269:12
           (get_global $core/sound/sound/Sound.frameSequencer)
          )
          (block
           (block $tablify|0
            (br_table $case1|0 $tablify|0 $case2|0 $tablify|0 $case3|0 $case4|0 $tablify|0
             (i32.sub
              (get_local $1)
              (i32.const 2)
             )
            )
           )
           (br $break|0)
          )
         )
         ;;@ core/sound/sound.ts:272:17
         (call $core/sound/channel1/Channel1.updateLength)
         ;;@ core/sound/sound.ts:273:17
         (call $core/sound/channel2/Channel2.updateLength)
         ;;@ core/sound/sound.ts:274:17
         (call $core/sound/channel3/Channel3.updateLength)
         ;;@ core/sound/sound.ts:275:17
         (call $core/sound/channel4/Channel4.updateLength)
         ;;@ core/sound/sound.ts:276:8
         (br $break|0)
        )
        ;;@ core/sound/sound.ts:280:17
        (call $core/sound/channel1/Channel1.updateLength)
        ;;@ core/sound/sound.ts:281:17
        (call $core/sound/channel2/Channel2.updateLength)
        ;;@ core/sound/sound.ts:282:17
        (call $core/sound/channel3/Channel3.updateLength)
        ;;@ core/sound/sound.ts:283:17
        (call $core/sound/channel4/Channel4.updateLength)
        ;;@ core/sound/sound.ts:285:17
        (call $core/sound/channel1/Channel1.updateSweep)
        ;;@ core/sound/sound.ts:286:8
        (br $break|0)
       )
       ;;@ core/sound/sound.ts:290:17
       (call $core/sound/channel1/Channel1.updateLength)
       ;;@ core/sound/sound.ts:291:17
       (call $core/sound/channel2/Channel2.updateLength)
       ;;@ core/sound/sound.ts:292:17
       (call $core/sound/channel3/Channel3.updateLength)
       ;;@ core/sound/sound.ts:293:17
       (call $core/sound/channel4/Channel4.updateLength)
       ;;@ core/sound/sound.ts:294:8
       (br $break|0)
      )
      ;;@ core/sound/sound.ts:298:17
      (call $core/sound/channel1/Channel1.updateLength)
      ;;@ core/sound/sound.ts:299:17
      (call $core/sound/channel2/Channel2.updateLength)
      ;;@ core/sound/sound.ts:300:17
      (call $core/sound/channel3/Channel3.updateLength)
      ;;@ core/sound/sound.ts:301:17
      (call $core/sound/channel4/Channel4.updateLength)
      ;;@ core/sound/sound.ts:303:17
      (call $core/sound/channel1/Channel1.updateSweep)
      ;;@ core/sound/sound.ts:304:8
      (br $break|0)
     )
     ;;@ core/sound/sound.ts:307:17
     (call $core/sound/channel1/Channel1.updateEnvelope)
     ;;@ core/sound/sound.ts:308:17
     (call $core/sound/channel2/Channel2.updateEnvelope)
     ;;@ core/sound/sound.ts:309:17
     (call $core/sound/channel4/Channel4.updateEnvelope)
    )
    ;;@ core/sound/sound.ts:314:4
    (set_global $core/sound/sound/Sound.frameSequencer
     (i32.add
      (get_global $core/sound/sound/Sound.frameSequencer)
      ;;@ core/sound/sound.ts:314:28
      (i32.const 1)
     )
    )
    ;;@ core/sound/sound.ts:315:4
    (if
     ;;@ core/sound/sound.ts:315:8
     (i32.ge_s
      (get_global $core/sound/sound/Sound.frameSequencer)
      ;;@ core/sound/sound.ts:315:32
      (i32.const 8)
     )
     ;;@ core/sound/sound.ts:315:35
     (set_global $core/sound/sound/Sound.frameSequencer
      ;;@ core/sound/sound.ts:316:29
      (i32.const 0)
     )
    )
    ;;@ core/sound/sound.ts:319:11
    (return
     (i32.const 1)
    )
   )
  )
  (i32.const 0)
 )
 (func $core/sound/channel1/Channel1.willChannelUpdate (; 70 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/sound/channel1.ts:264:4
  (set_global $core/sound/channel1/Channel1.cycleCounter
   (i32.add
    (get_global $core/sound/channel1/Channel1.cycleCounter)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel1.ts:267:4
  (if
   ;;@ core/sound/channel1.ts:267:8
   (i32.gt_s
    (i32.sub
     (get_global $core/sound/channel1/Channel1.frequencyTimer)
     ;;@ core/sound/channel1.ts:267:34
     (get_global $core/sound/channel1/Channel1.cycleCounter)
    )
    ;;@ core/sound/channel1.ts:267:58
    (i32.const 0)
   )
   (return
    (i32.const 0)
   )
  )
  (i32.const 1)
 )
 (func $core/sound/accumulator/didChannelDacChange (; 71 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/accumulator.ts:105:2
  (block $break|0
   (block $case3|0
    (block $case2|0
     (block $case1|0
      (if
       (i32.ne
        (get_local $0)
        (i32.const 1)
       )
       (block
        (br_if $case1|0
         (i32.eq
          (tee_local $1
           (get_local $0)
          )
          (i32.const 2)
         )
        )
        (br_if $case2|0
         (i32.eq
          (get_local $1)
          (i32.const 3)
         )
        )
        (br_if $case3|0
         (i32.eq
          (get_local $1)
          (i32.const 4)
         )
        )
        (br $break|0)
       )
      )
      ;;@ core/sound/accumulator.ts:107:6
      (if
       ;;@ core/sound/accumulator.ts:107:10
       (i32.ne
        (get_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled)
        ;;@ core/sound/accumulator.ts:107:50
        (get_global $core/sound/channel1/Channel1.isDacEnabled)
       )
       ;;@ core/sound/accumulator.ts:107:73
       (block
        ;;@ core/sound/accumulator.ts:108:8
        (set_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
         ;;@ core/sound/accumulator.ts:108:46
         (get_global $core/sound/channel1/Channel1.isDacEnabled)
        )
        ;;@ core/sound/accumulator.ts:109:15
        (return
         (i32.const 1)
        )
       )
      )
      ;;@ core/sound/accumulator.ts:111:13
      (return
       (i32.const 0)
      )
     )
     ;;@ core/sound/accumulator.ts:113:6
     (if
      ;;@ core/sound/accumulator.ts:113:10
      (i32.ne
       (get_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled)
       ;;@ core/sound/accumulator.ts:113:50
       (get_global $core/sound/channel2/Channel2.isDacEnabled)
      )
      ;;@ core/sound/accumulator.ts:113:73
      (block
       ;;@ core/sound/accumulator.ts:114:8
       (set_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
        ;;@ core/sound/accumulator.ts:114:46
        (get_global $core/sound/channel2/Channel2.isDacEnabled)
       )
       ;;@ core/sound/accumulator.ts:115:15
       (return
        (i32.const 1)
       )
      )
     )
     ;;@ core/sound/accumulator.ts:117:13
     (return
      (i32.const 0)
     )
    )
    ;;@ core/sound/accumulator.ts:119:6
    (if
     ;;@ core/sound/accumulator.ts:119:10
     (i32.ne
      (get_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled)
      ;;@ core/sound/accumulator.ts:119:50
      (get_global $core/sound/channel3/Channel3.isDacEnabled)
     )
     ;;@ core/sound/accumulator.ts:119:73
     (block
      ;;@ core/sound/accumulator.ts:120:8
      (set_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
       ;;@ core/sound/accumulator.ts:120:46
       (get_global $core/sound/channel3/Channel3.isDacEnabled)
      )
      ;;@ core/sound/accumulator.ts:121:15
      (return
       (i32.const 1)
      )
     )
    )
    ;;@ core/sound/accumulator.ts:123:13
    (return
     (i32.const 0)
    )
   )
   ;;@ core/sound/accumulator.ts:125:6
   (if
    ;;@ core/sound/accumulator.ts:125:10
    (i32.ne
     (get_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled)
     ;;@ core/sound/accumulator.ts:125:50
     (get_global $core/sound/channel4/Channel4.isDacEnabled)
    )
    ;;@ core/sound/accumulator.ts:125:73
    (block
     ;;@ core/sound/accumulator.ts:126:8
     (set_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
      ;;@ core/sound/accumulator.ts:126:46
      (get_global $core/sound/channel4/Channel4.isDacEnabled)
     )
     ;;@ core/sound/accumulator.ts:127:15
     (return
      (i32.const 1)
     )
    )
   )
   ;;@ core/sound/accumulator.ts:129:13
   (return
    (i32.const 0)
   )
  )
  (i32.const 0)
 )
 (func $core/sound/channel2/Channel2.willChannelUpdate (; 72 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/sound/channel2.ts:221:4
  (set_global $core/sound/channel2/Channel2.cycleCounter
   (i32.add
    (get_global $core/sound/channel2/Channel2.cycleCounter)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel2.ts:224:4
  (if
   ;;@ core/sound/channel2.ts:224:8
   (i32.gt_s
    (i32.sub
     (get_global $core/sound/channel2/Channel2.frequencyTimer)
     ;;@ core/sound/channel2.ts:224:34
     (get_global $core/sound/channel2/Channel2.cycleCounter)
    )
    ;;@ core/sound/channel2.ts:224:58
    (i32.const 0)
   )
   (return
    (i32.const 0)
   )
  )
  (i32.const 1)
 )
 (func $core/sound/channel3/Channel3.willChannelUpdate (; 73 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/sound/channel3.ts:257:4
  (set_global $core/sound/channel3/Channel3.cycleCounter
   (i32.add
    (get_global $core/sound/channel3/Channel3.cycleCounter)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel3.ts:260:8
  (if
   (tee_local $0
    (i32.gt_s
     (i32.sub
      (get_global $core/sound/channel3/Channel3.frequencyTimer)
      ;;@ core/sound/channel3.ts:260:34
      (get_global $core/sound/channel3/Channel3.cycleCounter)
     )
     ;;@ core/sound/channel3.ts:260:58
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel3.ts:260:63
    (i32.eqz
     ;;@ core/sound/channel3.ts:260:64
     (get_global $core/sound/channel3/Channel3.volumeCodeChanged)
    )
   )
  )
  ;;@ core/sound/channel3.ts:260:4
  (if
   (get_local $0)
   (return
    (i32.const 0)
   )
  )
  (i32.const 1)
 )
 (func $core/sound/channel4/Channel4.willChannelUpdate (; 74 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/sound/channel4.ts:246:4
  (set_global $core/sound/channel4/Channel4.cycleCounter
   (i32.add
    (get_global $core/sound/channel4/Channel4.cycleCounter)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel4.ts:249:4
  (if
   ;;@ core/sound/channel4.ts:249:8
   (i32.gt_s
    (i32.sub
     (get_global $core/sound/channel4/Channel4.frequencyTimer)
     ;;@ core/sound/channel4.ts:249:34
     (get_global $core/sound/channel4/Channel4.cycleCounter)
    )
    ;;@ core/sound/channel4.ts:249:58
    (i32.const 0)
   )
   (return
    (i32.const 0)
   )
  )
  (i32.const 1)
 )
 (func $core/sound/channel1/Channel1.resetTimer (; 75 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel1.ts:162:4
  (set_global $core/sound/channel1/Channel1.frequencyTimer
   ;;@ core/sound/channel1.ts:162:30
   (i32.shl
    (i32.sub
     ;;@ core/sound/channel1.ts:162:31
     (i32.const 2048)
     ;;@ core/sound/channel1.ts:162:38
     (get_global $core/sound/channel1/Channel1.frequency)
    )
    ;;@ core/sound/channel1.ts:162:60
    (i32.const 2)
   )
  )
  ;;@ core/sound/channel1.ts:165:4
  (if
   ;;@ core/sound/channel1.ts:165:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   ;;@ core/sound/channel1.ts:165:28
   (set_global $core/sound/channel1/Channel1.frequencyTimer
    ;;@ core/sound/channel1.ts:166:32
    (i32.shl
     (get_global $core/sound/channel1/Channel1.frequencyTimer)
     ;;@ core/sound/channel1.ts:166:58
     (i32.const 1)
    )
   )
  )
 )
 (func $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform (; 76 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (block $case3|0
   (block $case2|0
    (block $case1|0
     (if
      (i32.ne
       (get_local $0)
       ;;@ core/sound/duty.ts:12:9
       (i32.const 1)
      )
      (block
       (br_if $case1|0
        (i32.eq
         (tee_local $2
          (get_local $0)
         )
         ;;@ core/sound/duty.ts:15:9
         (i32.const 2)
        )
       )
       (br_if $case2|0
        (i32.eq
         (get_local $2)
         ;;@ core/sound/duty.ts:18:9
         (i32.const 3)
        )
       )
       (br $case3|0)
      )
     )
     ;;@ core/sound/duty.ts:14:56
     (return
      ;;@ core/sound/duty.ts:14:13
      (call $core/helpers/index/checkBitOnByte
       (get_local $1)
       ;;@ core/sound/duty.ts:14:52
       (i32.const 129)
      )
     )
    )
    ;;@ core/sound/duty.ts:17:56
    (return
     ;;@ core/sound/duty.ts:17:13
     (call $core/helpers/index/checkBitOnByte
      (get_local $1)
      ;;@ core/sound/duty.ts:17:52
      (i32.const 135)
     )
    )
   )
   ;;@ core/sound/duty.ts:20:56
   (return
    ;;@ core/sound/duty.ts:20:13
    (call $core/helpers/index/checkBitOnByte
     (get_local $1)
     ;;@ core/sound/duty.ts:20:52
     (i32.const 126)
    )
   )
  )
  ;;@ core/sound/duty.ts:23:13
  (call $core/helpers/index/checkBitOnByte
   (get_local $1)
   ;;@ core/sound/duty.ts:23:52
   (i32.const 1)
  )
 )
 (func $core/sound/channel1/Channel1.getSample (; 77 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/channel1.ts:172:4
  (set_global $core/sound/channel1/Channel1.frequencyTimer
   (i32.sub
    (get_global $core/sound/channel1/Channel1.frequencyTimer)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel1.ts:173:4
  (if
   ;;@ core/sound/channel1.ts:173:8
   (i32.le_s
    (get_global $core/sound/channel1/Channel1.frequencyTimer)
    ;;@ core/sound/channel1.ts:173:35
    (i32.const 0)
   )
   ;;@ core/sound/channel1.ts:173:38
   (block
    (set_local $0
     ;;@ core/sound/channel1.ts:175:36
     (get_global $core/sound/channel1/Channel1.frequencyTimer)
    )
    ;;@ core/sound/channel1.ts:180:15
    (call $core/sound/channel1/Channel1.resetTimer)
    ;;@ core/sound/channel1.ts:181:6
    (set_global $core/sound/channel1/Channel1.frequencyTimer
     (i32.sub
      (get_global $core/sound/channel1/Channel1.frequencyTimer)
      ;;@ core/sound/channel1.ts:175:32
      (select
       (get_local $0)
       (i32.sub
        (i32.const 0)
        (get_local $0)
       )
       (i32.gt_s
        (get_local $0)
        (i32.const 0)
       )
      )
     )
    )
    ;;@ core/sound/channel1.ts:186:6
    (set_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
     (i32.add
      (get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty)
      ;;@ core/sound/channel1.ts:186:41
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel1.ts:187:6
    (if
     ;;@ core/sound/channel1.ts:187:10
     (i32.ge_s
      (get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty)
      ;;@ core/sound/channel1.ts:187:45
      (i32.const 8)
     )
     ;;@ core/sound/channel1.ts:187:48
     (set_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
      ;;@ core/sound/channel1.ts:188:42
      (i32.const 0)
     )
    )
   )
  )
  (set_local $0
   ;;@ core/sound/channel1.ts:198:4
   (if (result i32)
    (tee_local $0
     ;;@ core/sound/channel1.ts:198:8
     (if (result i32)
      (get_global $core/sound/channel1/Channel1.isEnabled)
      ;;@ core/sound/channel1.ts:198:30
      (get_global $core/sound/channel1/Channel1.isDacEnabled)
      (get_global $core/sound/channel1/Channel1.isEnabled)
     )
    )
    ;;@ core/sound/channel1.ts:199:21
    (get_global $core/sound/channel1/Channel1.volume)
    (return
     (i32.const 15)
    )
   )
  )
  ;;@ core/sound/channel1.ts:207:4
  (set_local $1
   ;;@ core/sound/channel1.ts:207:22
   (i32.const 1)
  )
  ;;@ core/sound/channel1.ts:208:4
  (if
   ;;@ core/sound/channel1.ts:208:8
   (i32.eqz
    ;;@ core/sound/channel1.ts:208:9
    (call $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
     ;;@ core/sound/channel1.ts:208:55
     (get_global $core/sound/channel1/Channel1.NRx1Duty)
     ;;@ core/sound/channel1.ts:208:74
     (get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty)
    )
   )
   ;;@ core/sound/channel1.ts:208:108
   (set_local $1
    (i32.const -1)
   )
  )
  ;;@ core/sound/channel1.ts:215:13
  (i32.add
   ;;@ core/sound/channel1.ts:212:13
   (i32.mul
    (get_local $1)
    (get_local $0)
   )
   ;;@ core/sound/channel1.ts:215:22
   (i32.const 15)
  )
 )
 (func $core/sound/channel1/Channel1.getSampleFromCycleCounter (; 78 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/sound/channel1.ts:155:4
  (set_local $0
   ;;@ core/sound/channel1.ts:155:33
   (get_global $core/sound/channel1/Channel1.cycleCounter)
  )
  ;;@ core/sound/channel1.ts:156:4
  (set_global $core/sound/channel1/Channel1.cycleCounter
   ;;@ core/sound/channel1.ts:156:28
   (i32.const 0)
  )
  ;;@ core/sound/channel1.ts:157:47
  (call $core/sound/channel1/Channel1.getSample
   (get_local $0)
  )
 )
 (func $core/sound/channel2/Channel2.resetTimer (; 79 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel2.ts:138:4
  (set_global $core/sound/channel2/Channel2.frequencyTimer
   ;;@ core/sound/channel2.ts:138:30
   (i32.shl
    (i32.sub
     ;;@ core/sound/channel2.ts:138:31
     (i32.const 2048)
     ;;@ core/sound/channel2.ts:138:38
     (get_global $core/sound/channel2/Channel2.frequency)
    )
    ;;@ core/sound/channel2.ts:138:60
    (i32.const 2)
   )
  )
  ;;@ core/sound/channel2.ts:141:4
  (if
   ;;@ core/sound/channel2.ts:141:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   ;;@ core/sound/channel2.ts:141:28
   (set_global $core/sound/channel2/Channel2.frequencyTimer
    ;;@ core/sound/channel2.ts:142:32
    (i32.shl
     (get_global $core/sound/channel2/Channel2.frequencyTimer)
     ;;@ core/sound/channel2.ts:142:58
     (i32.const 1)
    )
   )
  )
 )
 (func $core/sound/channel2/Channel2.getSample (; 80 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/channel2.ts:148:4
  (set_global $core/sound/channel2/Channel2.frequencyTimer
   (i32.sub
    (get_global $core/sound/channel2/Channel2.frequencyTimer)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel2.ts:149:4
  (if
   ;;@ core/sound/channel2.ts:149:8
   (i32.le_s
    (get_global $core/sound/channel2/Channel2.frequencyTimer)
    ;;@ core/sound/channel2.ts:149:35
    (i32.const 0)
   )
   ;;@ core/sound/channel2.ts:149:38
   (block
    (set_local $0
     ;;@ core/sound/channel2.ts:151:36
     (get_global $core/sound/channel2/Channel2.frequencyTimer)
    )
    ;;@ core/sound/channel2.ts:156:15
    (call $core/sound/channel2/Channel2.resetTimer)
    ;;@ core/sound/channel2.ts:157:6
    (set_global $core/sound/channel2/Channel2.frequencyTimer
     (i32.sub
      (get_global $core/sound/channel2/Channel2.frequencyTimer)
      ;;@ core/sound/channel2.ts:151:32
      (select
       (get_local $0)
       (i32.sub
        (i32.const 0)
        (get_local $0)
       )
       (i32.gt_s
        (get_local $0)
        (i32.const 0)
       )
      )
     )
    )
    ;;@ core/sound/channel2.ts:162:6
    (set_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
     (i32.add
      (get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty)
      ;;@ core/sound/channel2.ts:162:41
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel2.ts:163:6
    (if
     ;;@ core/sound/channel2.ts:163:10
     (i32.ge_s
      (get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty)
      ;;@ core/sound/channel2.ts:163:45
      (i32.const 8)
     )
     ;;@ core/sound/channel2.ts:163:48
     (set_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
      ;;@ core/sound/channel2.ts:164:42
      (i32.const 0)
     )
    )
   )
  )
  (set_local $0
   ;;@ core/sound/channel2.ts:174:4
   (if (result i32)
    (tee_local $0
     ;;@ core/sound/channel2.ts:174:8
     (if (result i32)
      (get_global $core/sound/channel2/Channel2.isEnabled)
      ;;@ core/sound/channel2.ts:174:30
      (get_global $core/sound/channel2/Channel2.isDacEnabled)
      (get_global $core/sound/channel2/Channel2.isEnabled)
     )
    )
    ;;@ core/sound/channel2.ts:175:21
    (get_global $core/sound/channel2/Channel2.volume)
    (return
     (i32.const 15)
    )
   )
  )
  ;;@ core/sound/channel2.ts:183:4
  (set_local $1
   ;;@ core/sound/channel2.ts:183:22
   (i32.const 1)
  )
  ;;@ core/sound/channel2.ts:184:4
  (if
   ;;@ core/sound/channel2.ts:184:8
   (i32.eqz
    ;;@ core/sound/channel2.ts:184:9
    (call $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
     ;;@ core/sound/channel2.ts:184:55
     (get_global $core/sound/channel2/Channel2.NRx1Duty)
     ;;@ core/sound/channel2.ts:184:74
     (get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty)
    )
   )
   ;;@ core/sound/channel2.ts:184:108
   (set_local $1
    (i32.const -1)
   )
  )
  ;;@ core/sound/channel2.ts:191:13
  (i32.add
   ;;@ core/sound/channel2.ts:188:13
   (i32.mul
    (get_local $1)
    (get_local $0)
   )
   ;;@ core/sound/channel2.ts:191:22
   (i32.const 15)
  )
 )
 (func $core/sound/channel2/Channel2.getSampleFromCycleCounter (; 81 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/sound/channel2.ts:131:4
  (set_local $0
   ;;@ core/sound/channel2.ts:131:33
   (get_global $core/sound/channel2/Channel2.cycleCounter)
  )
  ;;@ core/sound/channel2.ts:132:4
  (set_global $core/sound/channel2/Channel2.cycleCounter
   ;;@ core/sound/channel2.ts:132:28
   (i32.const 0)
  )
  ;;@ core/sound/channel2.ts:133:47
  (call $core/sound/channel2/Channel2.getSample
   (get_local $0)
  )
 )
 (func $core/sound/channel3/Channel3.resetTimer (; 82 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:131:4
  (set_global $core/sound/channel3/Channel3.frequencyTimer
   ;;@ core/sound/channel3.ts:131:30
   (i32.shl
    (i32.sub
     ;;@ core/sound/channel3.ts:131:31
     (i32.const 2048)
     ;;@ core/sound/channel3.ts:131:38
     (get_global $core/sound/channel3/Channel3.frequency)
    )
    ;;@ core/sound/channel3.ts:131:60
    (i32.const 1)
   )
  )
  ;;@ core/sound/channel3.ts:134:4
  (if
   ;;@ core/sound/channel3.ts:134:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   ;;@ core/sound/channel3.ts:134:28
   (set_global $core/sound/channel3/Channel3.frequencyTimer
    ;;@ core/sound/channel3.ts:135:32
    (i32.shl
     (get_global $core/sound/channel3/Channel3.frequencyTimer)
     ;;@ core/sound/channel3.ts:135:58
     (i32.const 1)
    )
   )
  )
 )
 (func $core/sound/channel3/Channel3.getSample (; 83 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/sound/channel3.ts:141:4
  (set_global $core/sound/channel3/Channel3.frequencyTimer
   (i32.sub
    (get_global $core/sound/channel3/Channel3.frequencyTimer)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel3.ts:142:4
  (if
   ;;@ core/sound/channel3.ts:142:8
   (i32.le_s
    (get_global $core/sound/channel3/Channel3.frequencyTimer)
    ;;@ core/sound/channel3.ts:142:35
    (i32.const 0)
   )
   ;;@ core/sound/channel3.ts:142:38
   (block
    (set_local $2
     ;;@ core/sound/channel3.ts:144:36
     (get_global $core/sound/channel3/Channel3.frequencyTimer)
    )
    ;;@ core/sound/channel3.ts:149:15
    (call $core/sound/channel3/Channel3.resetTimer)
    ;;@ core/sound/channel3.ts:150:6
    (set_global $core/sound/channel3/Channel3.frequencyTimer
     (i32.sub
      (get_global $core/sound/channel3/Channel3.frequencyTimer)
      ;;@ core/sound/channel3.ts:144:32
      (select
       (get_local $2)
       (i32.sub
        (i32.const 0)
        (get_local $2)
       )
       (i32.gt_s
        (get_local $2)
        (i32.const 0)
       )
      )
     )
    )
    ;;@ core/sound/channel3.ts:153:6
    (set_global $core/sound/channel3/Channel3.waveTablePosition
     (i32.add
      (get_global $core/sound/channel3/Channel3.waveTablePosition)
      ;;@ core/sound/channel3.ts:153:36
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel3.ts:154:6
    (if
     ;;@ core/sound/channel3.ts:154:10
     (i32.ge_s
      (get_global $core/sound/channel3/Channel3.waveTablePosition)
      ;;@ core/sound/channel3.ts:154:40
      (i32.const 32)
     )
     ;;@ core/sound/channel3.ts:154:44
     (set_global $core/sound/channel3/Channel3.waveTablePosition
      ;;@ core/sound/channel3.ts:155:37
      (i32.const 0)
     )
    )
   )
  )
  ;;@ core/sound/channel3.ts:160:4
  (set_local $2
   ;;@ core/sound/channel3.ts:160:28
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:161:4
  (set_local $0
   ;;@ core/sound/channel3.ts:161:26
   (get_global $core/sound/channel3/Channel3.volumeCode)
  )
  ;;@ core/sound/channel3.ts:166:4
  (if
   (tee_local $1
    ;;@ core/sound/channel3.ts:166:8
    (if (result i32)
     (get_global $core/sound/channel3/Channel3.isEnabled)
     ;;@ core/sound/channel3.ts:166:30
     (get_global $core/sound/channel3/Channel3.isDacEnabled)
     (get_global $core/sound/channel3/Channel3.isEnabled)
    )
   )
   ;;@ core/sound/channel3.ts:166:53
   (if
    ;;@ core/sound/channel3.ts:168:10
    (get_global $core/sound/channel3/Channel3.volumeCodeChanged)
    ;;@ core/sound/channel3.ts:168:38
    (block
     ;;@ core/sound/channel3.ts:172:8
     (set_global $core/sound/channel3/Channel3.volumeCode
      ;;@ core/sound/channel3.ts:171:8
      (tee_local $0
       ;;@ core/sound/channel3.ts:171:21
       (i32.and
        ;;@ core/sound/channel3.ts:170:21
        (i32.shr_s
         ;;@ core/sound/channel3.ts:169:21
         (call $core/memory/load/eightBitLoadFromGBMemory
          (i32.const 65308)
         )
         ;;@ core/sound/channel3.ts:170:35
         (i32.const 5)
        )
        ;;@ core/sound/channel3.ts:171:34
        (i32.const 15)
       )
      )
     )
     ;;@ core/sound/channel3.ts:173:8
     (set_global $core/sound/channel3/Channel3.volumeCodeChanged
      ;;@ core/sound/channel3.ts:173:37
      (i32.const 0)
     )
    )
   )
   (return
    (i32.const 15)
   )
  )
  ;;@ core/sound/channel3.ts:188:4
  (set_local $1
   ;;@ core/sound/channel3.ts:188:13
   (call $core/memory/load/eightBitLoadFromGBMemory
    ;;@ core/sound/channel3.ts:186:40
    (i32.add
     ;;@ core/sound/channel3.ts:185:34
     (i32.div_s
      (get_global $core/sound/channel3/Channel3.waveTablePosition)
      ;;@ core/sound/channel3.ts:185:63
      (i32.const 2)
     )
     (i32.const 65328)
    )
   )
  )
  (set_local $1
   ;;@ core/sound/channel3.ts:191:4
   (if (result i32)
    ;;@ core/sound/channel3.ts:191:8
    (i32.rem_s
     (get_global $core/sound/channel3/Channel3.waveTablePosition)
     ;;@ core/sound/channel3.ts:191:37
     (i32.const 2)
    )
    ;;@ core/sound/channel3.ts:197:15
    (i32.and
     (get_local $1)
     ;;@ core/sound/channel3.ts:197:24
     (i32.const 15)
    )
    ;;@ core/sound/channel3.ts:194:15
    (i32.and
     ;;@ core/sound/channel3.ts:193:15
     (i32.shr_s
      (get_local $1)
      ;;@ core/sound/channel3.ts:193:25
      (i32.const 4)
     )
     ;;@ core/sound/channel3.ts:194:24
     (i32.const 15)
    )
   )
  )
  ;;@ core/sound/channel3.ts:203:4
  (block $break|0
   (block $case3|0
    (block $case2|0
     (block $case1|0
      (if
       (get_local $0)
       (block
        (br_if $case1|0
         (i32.eq
          (get_local $0)
          ;;@ core/sound/channel3.ts:207:11
          (i32.const 1)
         )
        )
        (br_if $case2|0
         (i32.eq
          (get_local $0)
          ;;@ core/sound/channel3.ts:211:11
          (i32.const 2)
         )
        )
        (br $case3|0)
       )
      )
      ;;@ core/sound/channel3.ts:205:8
      (set_local $1
       ;;@ core/sound/channel3.ts:205:17
       (i32.shr_s
        (get_local $1)
        ;;@ core/sound/channel3.ts:205:27
        (i32.const 4)
       )
      )
      ;;@ core/sound/channel3.ts:206:8
      (br $break|0)
     )
     ;;@ core/sound/channel3.ts:209:8
     (set_local $2
      ;;@ core/sound/channel3.ts:209:23
      (i32.const 1)
     )
     ;;@ core/sound/channel3.ts:210:8
     (br $break|0)
    )
    ;;@ core/sound/channel3.ts:212:8
    (set_local $1
     ;;@ core/sound/channel3.ts:212:17
     (i32.shr_s
      (get_local $1)
      ;;@ core/sound/channel3.ts:212:27
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel3.ts:213:8
    (set_local $2
     ;;@ core/sound/channel3.ts:213:23
     (i32.const 2)
    )
    ;;@ core/sound/channel3.ts:214:8
    (br $break|0)
   )
   ;;@ core/sound/channel3.ts:216:8
   (set_local $1
    ;;@ core/sound/channel3.ts:216:17
    (i32.shr_s
     (get_local $1)
     ;;@ core/sound/channel3.ts:216:27
     (i32.const 2)
    )
   )
   ;;@ core/sound/channel3.ts:217:8
   (set_local $2
    ;;@ core/sound/channel3.ts:217:23
    (i32.const 4)
   )
  )
  ;;@ core/sound/channel3.ts:229:13
  (i32.add
   (tee_local $1
    ;;@ core/sound/channel3.ts:222:4
    (if (result i32)
     ;;@ core/sound/channel3.ts:222:8
     (i32.gt_s
      (get_local $2)
      ;;@ core/sound/channel3.ts:222:23
      (i32.const 0)
     )
     ;;@ core/sound/channel3.ts:223:15
     (i32.div_s
      (get_local $1)
      (get_local $2)
     )
     ;;@ core/sound/channel3.ts:225:15
     (i32.const 0)
    )
   )
   ;;@ core/sound/channel3.ts:229:22
   (i32.const 15)
  )
 )
 (func $core/sound/channel3/Channel3.getSampleFromCycleCounter (; 84 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/sound/channel3.ts:124:4
  (set_local $0
   ;;@ core/sound/channel3.ts:124:33
   (get_global $core/sound/channel3/Channel3.cycleCounter)
  )
  ;;@ core/sound/channel3.ts:125:4
  (set_global $core/sound/channel3/Channel3.cycleCounter
   ;;@ core/sound/channel3.ts:125:28
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:126:47
  (call $core/sound/channel3/Channel3.getSample
   (get_local $0)
  )
 )
 (func $core/sound/channel4/Channel4.getNoiseChannelFrequencyPeriod (; 85 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/sound/channel4.ts:258:4
  (set_local $0
   ;;@ core/sound/channel4.ts:258:24
   (i32.shl
    (get_global $core/sound/channel4/Channel4.divisor)
    ;;@ core/sound/channel4.ts:258:44
    (get_global $core/sound/channel4/Channel4.NRx3ClockShift)
   )
  )
  ;;@ core/sound/channel4.ts:259:4
  (if
   ;;@ core/sound/channel4.ts:259:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   ;;@ core/sound/channel4.ts:259:28
   (set_local $0
    ;;@ core/sound/channel4.ts:260:17
    (i32.shl
     (get_local $0)
     ;;@ core/sound/channel4.ts:260:28
     (i32.const 1)
    )
   )
  )
  (get_local $0)
 )
 (func $core/sound/channel4/Channel4.getSample (; 86 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/channel4.ts:155:4
  (set_global $core/sound/channel4/Channel4.frequencyTimer
   (i32.sub
    (get_global $core/sound/channel4/Channel4.frequencyTimer)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel4.ts:157:4
  (if
   ;;@ core/sound/channel4.ts:157:8
   (i32.le_s
    (get_global $core/sound/channel4/Channel4.frequencyTimer)
    ;;@ core/sound/channel4.ts:157:35
    (i32.const 0)
   )
   ;;@ core/sound/channel4.ts:157:38
   (block
    (set_local $0
     ;;@ core/sound/channel4.ts:159:36
     (get_global $core/sound/channel4/Channel4.frequencyTimer)
    )
    ;;@ core/sound/channel4.ts:162:6
    (set_global $core/sound/channel4/Channel4.frequencyTimer
     ;;@ core/sound/channel4.ts:162:41
     (call $core/sound/channel4/Channel4.getNoiseChannelFrequencyPeriod)
    )
    ;;@ core/sound/channel4.ts:163:6
    (set_global $core/sound/channel4/Channel4.frequencyTimer
     (i32.sub
      (get_global $core/sound/channel4/Channel4.frequencyTimer)
      ;;@ core/sound/channel4.ts:159:32
      (select
       (get_local $0)
       (i32.sub
        (i32.const 0)
        (get_local $0)
       )
       (i32.gt_s
        (get_local $0)
        (i32.const 0)
       )
      )
     )
    )
    ;;@ core/sound/channel4.ts:169:6
    (set_local $1
     ;;@ core/sound/channel4.ts:169:29
     (i32.and
      (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
      ;;@ core/sound/channel4.ts:169:68
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel4.ts:171:6
    (set_local $0
     ;;@ core/sound/channel4.ts:171:19
     (i32.and
      ;;@ core/sound/channel4.ts:170:28
      (i32.shr_s
       (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
       ;;@ core/sound/channel4.ts:170:68
       (i32.const 1)
      )
      ;;@ core/sound/channel4.ts:171:32
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel4.ts:175:6
    (set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
     ;;@ core/sound/channel4.ts:175:45
     (i32.shr_s
      (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
      ;;@ core/sound/channel4.ts:175:85
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel4.ts:178:6
    (set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
     ;;@ core/sound/channel4.ts:178:45
     (i32.or
      (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
      ;;@ core/sound/channel4.ts:178:84
      (i32.shl
       ;;@ core/sound/channel4.ts:172:6
       (tee_local $1
        ;;@ core/sound/channel4.ts:172:30
        (i32.xor
         (get_local $1)
         (get_local $0)
        )
       )
       ;;@ core/sound/channel4.ts:178:106
       (i32.const 14)
      )
     )
    )
    ;;@ core/sound/channel4.ts:181:6
    (if
     ;;@ core/sound/channel4.ts:181:10
     (get_global $core/sound/channel4/Channel4.NRx3WidthMode)
     ;;@ core/sound/channel4.ts:181:34
     (block
      ;;@ core/sound/channel4.ts:183:8
      (set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
       ;;@ core/sound/channel4.ts:183:47
       (i32.and
        (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
        (i32.const -65)
       )
      )
      ;;@ core/sound/channel4.ts:184:8
      (set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
       ;;@ core/sound/channel4.ts:184:47
       (i32.or
        (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
        ;;@ core/sound/channel4.ts:184:86
        (i32.shl
         (get_local $1)
         ;;@ core/sound/channel4.ts:184:108
         (i32.const 6)
        )
       )
      )
     )
    )
   )
  )
  (set_local $1
   ;;@ core/sound/channel4.ts:194:4
   (if (result i32)
    (tee_local $0
     ;;@ core/sound/channel4.ts:194:8
     (if (result i32)
      (get_global $core/sound/channel4/Channel4.isEnabled)
      ;;@ core/sound/channel4.ts:194:30
      (get_global $core/sound/channel4/Channel4.isDacEnabled)
      (get_global $core/sound/channel4/Channel4.isEnabled)
     )
    )
    ;;@ core/sound/channel4.ts:195:21
    (get_global $core/sound/channel4/Channel4.volume)
    (return
     (i32.const 15)
    )
   )
  )
  ;;@ core/sound/channel4.ts:215:13
  (i32.add
   ;;@ core/sound/channel4.ts:212:13
   (i32.mul
    (tee_local $0
     ;;@ core/sound/channel4.ts:206:4
     (if (result i32)
      ;;@ core/sound/channel4.ts:206:9
      (call $core/helpers/index/checkBitOnByte
       ;;@ core/sound/channel4.ts:206:24
       (i32.const 0)
       ;;@ core/sound/channel4.ts:206:27
       (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
      )
      ;;@ core/sound/channel4.ts:209:15
      (i32.const -1)
      ;;@ core/sound/channel4.ts:207:15
      (i32.const 1)
     )
    )
    (get_local $1)
   )
   ;;@ core/sound/channel4.ts:215:22
   (i32.const 15)
  )
 )
 (func $core/sound/channel4/Channel4.getSampleFromCycleCounter (; 87 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/sound/channel4.ts:148:4
  (set_local $0
   ;;@ core/sound/channel4.ts:148:33
   (get_global $core/sound/channel4/Channel4.cycleCounter)
  )
  ;;@ core/sound/channel4.ts:149:4
  (set_global $core/sound/channel4/Channel4.cycleCounter
   ;;@ core/sound/channel4.ts:149:28
   (i32.const 0)
  )
  ;;@ core/sound/channel4.ts:150:47
  (call $core/sound/channel4/Channel4.getSample
   (get_local $0)
  )
 )
 (func $core/cpu/cpu/Cpu.CLOCK_SPEED (; 88 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/cpu.ts:41:4
  (if
   ;;@ core/cpu/cpu.ts:41:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 8388608)
   )
  )
  (i32.const 4194304)
 )
 (func $core/sound/sound/Sound.maxDownSampleCycles (; 89 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/sound/sound.ts:105:27
  (call $core/cpu/cpu/Cpu.CLOCK_SPEED)
 )
 (func $core/portable/portable/i32Portable (; 90 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (get_local $0)
 )
 (func $core/sound/sound/getSampleAsUnsignedByte (; 91 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/sound/sound.ts:421:2
  (if
   ;;@ core/sound/sound.ts:421:6
   (i32.eq
    (get_local $0)
    ;;@ core/sound/sound.ts:421:17
    (i32.const 60)
   )
   (return
    (i32.const 127)
   )
  )
  ;;@ core/sound/sound.ts:449:20
  (call $core/portable/portable/i32Portable
   ;;@ core/sound/sound.ts:446:20
   (i32.div_s
    (i32.mul
     ;;@ core/sound/sound.ts:436:20
     (i32.add
      ;;@ core/sound/sound.ts:435:20
      (i32.div_s
       ;;@ core/sound/sound.ts:432:20
       (i32.div_s
        (i32.mul
         ;;@ core/sound/sound.ts:429:20
         (i32.mul
          ;;@ core/sound/sound.ts:428:29
          (i32.sub
           (get_local $0)
           ;;@ core/sound/sound.ts:428:38
           (i32.const 60)
          )
          (i32.const 100000)
         )
         (get_local $1)
        )
        ;;@ core/sound/sound.ts:432:54
        (i32.const 8)
       )
       (i32.const 100000)
      )
      ;;@ core/sound/sound.ts:436:38
      (i32.const 60)
     )
     (i32.const 100000)
    )
    (i32.const 47244)
   )
  )
 )
 (func $core/sound/sound/mixChannelSamples (; 92 ;) (; has Stack IR ;) (type $iiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  ;;@ core/sound/sound.ts:344:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
   ;;@ core/sound/sound.ts:344:40
   (i32.const 0)
  )
  (set_local $4
   ;;@ core/sound/sound.ts:352:2
   (if (result i32)
    ;;@ core/sound/sound.ts:352:6
    (get_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput)
    (get_local $0)
    (i32.const 15)
   )
  )
  (set_local $4
   ;;@ core/sound/sound.ts:357:2
   (if (result i32)
    ;;@ core/sound/sound.ts:357:6
    (get_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput)
    (i32.add
     (get_local $4)
     (get_local $1)
    )
    (i32.add
     (get_local $4)
     ;;@ core/sound/sound.ts:360:25
     (i32.const 15)
    )
   )
  )
  (set_local $4
   ;;@ core/sound/sound.ts:362:2
   (if (result i32)
    ;;@ core/sound/sound.ts:362:6
    (get_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput)
    (i32.add
     (get_local $4)
     (get_local $2)
    )
    (i32.add
     (get_local $4)
     ;;@ core/sound/sound.ts:365:25
     (i32.const 15)
    )
   )
  )
  (set_local $4
   ;;@ core/sound/sound.ts:367:2
   (if (result i32)
    ;;@ core/sound/sound.ts:367:6
    (get_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput)
    (i32.add
     (get_local $4)
     (get_local $3)
    )
    (i32.add
     (get_local $4)
     ;;@ core/sound/sound.ts:370:25
     (i32.const 15)
    )
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:375:2
   (if (result i32)
    ;;@ core/sound/sound.ts:375:6
    (get_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput)
    (get_local $0)
    (i32.const 15)
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:380:2
   (if (result i32)
    ;;@ core/sound/sound.ts:380:6
    (get_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput)
    (i32.add
     (get_local $0)
     (get_local $1)
    )
    (i32.add
     (get_local $0)
     ;;@ core/sound/sound.ts:383:26
     (i32.const 15)
    )
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:385:2
   (if (result i32)
    ;;@ core/sound/sound.ts:385:6
    (get_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput)
    (i32.add
     (get_local $0)
     (get_local $2)
    )
    (i32.add
     (get_local $0)
     ;;@ core/sound/sound.ts:388:26
     (i32.const 15)
    )
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:390:2
   (if (result i32)
    ;;@ core/sound/sound.ts:390:6
    (get_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput)
    (i32.add
     (get_local $0)
     (get_local $3)
    )
    (i32.add
     (get_local $0)
     ;;@ core/sound/sound.ts:393:26
     (i32.const 15)
    )
   )
  )
  ;;@ core/sound/sound.ts:397:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
   ;;@ core/sound/sound.ts:397:41
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:398:2
  (set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
   ;;@ core/sound/sound.ts:398:40
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:408:2
  (set_local $1
   ;;@ core/sound/sound.ts:408:43
   (call $core/sound/sound/getSampleAsUnsignedByte
    (get_local $4)
    ;;@ core/sound/sound.ts:408:86
    (i32.add
     (get_global $core/sound/sound/Sound.NR50LeftMixerVolume)
     ;;@ core/sound/sound.ts:408:114
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/sound.ts:409:2
  (set_local $0
   ;;@ core/sound/sound.ts:409:44
   (call $core/sound/sound/getSampleAsUnsignedByte
    (get_local $0)
    ;;@ core/sound/sound.ts:409:88
    (i32.add
     (get_global $core/sound/sound/Sound.NR50RightMixerVolume)
     ;;@ core/sound/sound.ts:409:117
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/sound.ts:412:2
  (set_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
   (get_local $1)
  )
  ;;@ core/sound/sound.ts:413:2
  (set_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
   (get_local $0)
  )
  ;;@ core/sound/sound.ts:415:87
  (call $core/helpers/index/concatenateBytes
   (get_local $1)
   (get_local $0)
  )
 )
 (func $core/sound/sound/setLeftAndRightOutputForAudioQueue (; 93 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  ;;@ core/sound/sound.ts:461:2
  (i32.store8
   ;;@ core/sound/sound.ts:457:2
   (tee_local $3
    ;;@ core/sound/sound.ts:457:25
    (i32.add
     ;;@ core/sound/sound.ts:457:49
     (i32.shl
      (get_local $2)
      ;;@ core/sound/sound.ts:457:67
      (i32.const 1)
     )
     (i32.const 588800)
    )
   )
   ;;@ core/sound/sound.ts:461:30
   (i32.add
    (get_local $0)
    ;;@ core/sound/sound.ts:461:48
    (i32.const 1)
   )
  )
  ;;@ core/sound/sound.ts:462:2
  (i32.store8
   ;;@ core/sound/sound.ts:462:12
   (i32.add
    (get_local $3)
    ;;@ core/sound/sound.ts:462:31
    (i32.const 1)
   )
   ;;@ core/sound/sound.ts:462:34
   (i32.add
    (get_local $1)
    ;;@ core/sound/sound.ts:462:53
    (i32.const 1)
   )
  )
 )
 (func $core/sound/accumulator/accumulateSound (; 94 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  ;;@ core/sound/accumulator.ts:45:36
  (if
   (i32.eqz
    (tee_local $1
     ;;@ core/sound/accumulator.ts:45:45
     (call $core/sound/channel1/Channel1.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $1
    ;;@ core/sound/accumulator.ts:45:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:46:36
  (if
   (i32.eqz
    (tee_local $2
     ;;@ core/sound/accumulator.ts:46:45
     (call $core/sound/channel2/Channel2.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $2
    ;;@ core/sound/accumulator.ts:46:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 2)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:47:36
  (if
   (i32.eqz
    (tee_local $3
     ;;@ core/sound/accumulator.ts:47:45
     (call $core/sound/channel3/Channel3.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $3
    ;;@ core/sound/accumulator.ts:47:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 3)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:48:36
  (if
   (i32.eqz
    (tee_local $4
     ;;@ core/sound/accumulator.ts:48:45
     (call $core/sound/channel4/Channel4.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $4
    ;;@ core/sound/accumulator.ts:48:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 4)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:50:2
  (if
   (i32.and
    (get_local $1)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:50:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
    ;;@ core/sound/accumulator.ts:51:47
    (call $core/sound/channel1/Channel1.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:53:2
  (if
   (i32.and
    (get_local $2)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:53:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
    ;;@ core/sound/accumulator.ts:54:47
    (call $core/sound/channel2/Channel2.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:56:2
  (if
   (i32.and
    (get_local $3)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:56:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
    ;;@ core/sound/accumulator.ts:57:47
    (call $core/sound/channel3/Channel3.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:59:2
  (if
   (i32.and
    (get_local $4)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:59:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
    ;;@ core/sound/accumulator.ts:60:47
    (call $core/sound/channel4/Channel4.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:64:6
  (if
   (i32.eqz
    (i32.and
     (get_local $1)
     (i32.const 1)
    )
   )
   (set_local $1
    (get_local $2)
   )
  )
  (if
   (i32.eqz
    (i32.and
     (get_local $1)
     (i32.const 1)
    )
   )
   (set_local $1
    (get_local $3)
   )
  )
  (if
   (i32.eqz
    (i32.and
     (get_local $1)
     (i32.const 1)
    )
   )
   (set_local $1
    (get_local $4)
   )
  )
  ;;@ core/sound/accumulator.ts:64:2
  (if
   (i32.and
    (get_local $1)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:64:92
   (set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
    ;;@ core/sound/accumulator.ts:65:42
    (i32.const 1)
   )
  )
  ;;@ core/sound/accumulator.ts:69:2
  (set_global $core/sound/sound/Sound.downSampleCycleCounter
   (i32.add
    (get_global $core/sound/sound/Sound.downSampleCycleCounter)
    ;;@ core/sound/accumulator.ts:69:34
    (i32.mul
     (get_local $0)
     ;;@ core/sound/accumulator.ts:69:51
     (get_global $core/sound/sound/Sound.downSampleCycleMultiplier)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:70:2
  (if
   ;;@ core/sound/accumulator.ts:70:6
   (i32.ge_s
    (get_global $core/sound/sound/Sound.downSampleCycleCounter)
    ;;@ core/sound/accumulator.ts:70:44
    (call $core/sound/sound/Sound.maxDownSampleCycles)
   )
   ;;@ core/sound/accumulator.ts:70:67
   (block
    ;;@ core/sound/accumulator.ts:73:4
    (set_global $core/sound/sound/Sound.downSampleCycleCounter
     (i32.sub
      (get_global $core/sound/sound/Sound.downSampleCycleCounter)
      ;;@ core/sound/accumulator.ts:73:42
      (call $core/sound/sound/Sound.maxDownSampleCycles)
     )
    )
    ;;@ core/sound/accumulator.ts:75:8
    (if
     (i32.eqz
      (tee_local $1
       (if (result i32)
        (get_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples)
        (get_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples)
        ;;@ core/sound/accumulator.ts:75:47
        (get_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged)
       )
      )
     )
     (set_local $1
      ;;@ core/sound/accumulator.ts:75:86
      (get_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged)
     )
    )
    ;;@ core/sound/accumulator.ts:75:4
    (if
     (get_local $1)
     ;;@ core/sound/accumulator.ts:75:124
     (drop
      (call $core/sound/sound/mixChannelSamples
       ;;@ core/sound/accumulator.ts:77:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel1Sample)
       ;;@ core/sound/accumulator.ts:78:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel2Sample)
       ;;@ core/sound/accumulator.ts:79:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel3Sample)
       ;;@ core/sound/accumulator.ts:80:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel4Sample)
      )
     )
    )
    ;;@ core/sound/accumulator.ts:87:4
    (call $core/sound/sound/setLeftAndRightOutputForAudioQueue
     ;;@ core/sound/accumulator.ts:88:6
     (i32.add
      (get_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte)
      ;;@ core/sound/accumulator.ts:88:55
      (i32.const 1)
     )
     ;;@ core/sound/accumulator.ts:89:6
     (i32.add
      (get_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte)
      ;;@ core/sound/accumulator.ts:89:56
      (i32.const 1)
     )
     ;;@ core/sound/accumulator.ts:90:6
     (get_global $core/sound/sound/Sound.audioQueueIndex)
    )
    ;;@ core/sound/accumulator.ts:92:4
    (set_global $core/sound/sound/Sound.audioQueueIndex
     (i32.add
      (get_global $core/sound/sound/Sound.audioQueueIndex)
      ;;@ core/sound/accumulator.ts:92:29
      (i32.const 1)
     )
    )
    ;;@ core/sound/accumulator.ts:97:4
    (if
     ;;@ core/sound/accumulator.ts:97:8
     (i32.ge_s
      (get_global $core/sound/sound/Sound.audioQueueIndex)
      ;;@ core/sound/accumulator.ts:97:33
      (i32.sub
       (i32.div_s
        (get_global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize)
        ;;@ core/sound/accumulator.ts:97:68
        (i32.const 2)
       )
       ;;@ core/sound/accumulator.ts:97:72
       (i32.const 1)
      )
     )
     ;;@ core/sound/accumulator.ts:97:75
     (set_global $core/sound/sound/Sound.audioQueueIndex
      (i32.sub
       ;;@ core/sound/accumulator.ts:98:6
       (get_global $core/sound/sound/Sound.audioQueueIndex)
       ;;@ core/sound/accumulator.ts:98:31
       (i32.const 1)
      )
     )
    )
   )
  )
 )
 (func $core/helpers/index/splitHighByte (; 95 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/helpers/index.ts:13:35
  (i32.shr_s
   ;;@ core/helpers/index.ts:13:9
   (i32.and
    (get_local $0)
    ;;@ core/helpers/index.ts:13:24
    (i32.const 65280)
   )
   ;;@ core/helpers/index.ts:13:35
   (i32.const 8)
  )
 )
 (func $core/helpers/index/splitLowByte (; 96 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/helpers/index.ts:17:23
  (i32.and
   (get_local $0)
   (i32.const 255)
  )
 )
 (func $core/sound/sound/calculateSound (; 97 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  ;;@ core/sound/sound.ts:215:2
  (set_local $1
   ;;@ core/sound/sound.ts:215:37
   (call $core/sound/channel1/Channel1.getSample
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:216:2
  (set_local $2
   ;;@ core/sound/sound.ts:216:37
   (call $core/sound/channel2/Channel2.getSample
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:217:2
  (set_local $3
   ;;@ core/sound/sound.ts:217:37
   (call $core/sound/channel3/Channel3.getSample
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:218:2
  (set_local $4
   ;;@ core/sound/sound.ts:218:37
   (call $core/sound/channel4/Channel4.getSample
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:226:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
   (get_local $1)
  )
  ;;@ core/sound/sound.ts:227:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
   (get_local $2)
  )
  ;;@ core/sound/sound.ts:228:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
   (get_local $3)
  )
  ;;@ core/sound/sound.ts:229:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
   (get_local $4)
  )
  ;;@ core/sound/sound.ts:232:2
  (set_global $core/sound/sound/Sound.downSampleCycleCounter
   (i32.add
    (get_global $core/sound/sound/Sound.downSampleCycleCounter)
    ;;@ core/sound/sound.ts:232:34
    (i32.mul
     (get_local $0)
     ;;@ core/sound/sound.ts:232:51
     (get_global $core/sound/sound/Sound.downSampleCycleMultiplier)
    )
   )
  )
  ;;@ core/sound/sound.ts:233:2
  (if
   ;;@ core/sound/sound.ts:233:6
   (i32.ge_s
    (get_global $core/sound/sound/Sound.downSampleCycleCounter)
    ;;@ core/sound/sound.ts:233:44
    (call $core/sound/sound/Sound.maxDownSampleCycles)
   )
   ;;@ core/sound/sound.ts:233:67
   (block
    ;;@ core/sound/sound.ts:236:4
    (set_global $core/sound/sound/Sound.downSampleCycleCounter
     (i32.sub
      (get_global $core/sound/sound/Sound.downSampleCycleCounter)
      ;;@ core/sound/sound.ts:236:42
      (call $core/sound/sound/Sound.maxDownSampleCycles)
     )
    )
    ;;@ core/sound/sound.ts:245:4
    (call $core/sound/sound/setLeftAndRightOutputForAudioQueue
     ;;@ core/sound/sound.ts:245:39
     (i32.add
      ;;@ core/sound/sound.ts:240:45
      (call $core/helpers/index/splitHighByte
       ;;@ core/sound/sound.ts:239:4
       (tee_local $0
        ;;@ core/sound/sound.ts:239:27
        (call $core/sound/sound/mixChannelSamples
         (get_local $1)
         (get_local $2)
         (get_local $3)
         (get_local $4)
        )
       )
      )
      ;;@ core/sound/sound.ts:245:71
      (i32.const 1)
     )
     ;;@ core/sound/sound.ts:245:74
     (i32.add
      ;;@ core/sound/sound.ts:241:46
      (call $core/helpers/index/splitLowByte
       (get_local $0)
      )
      ;;@ core/sound/sound.ts:245:107
      (i32.const 1)
     )
     ;;@ core/sound/sound.ts:245:110
     (get_global $core/sound/sound/Sound.audioQueueIndex)
    )
    ;;@ core/sound/sound.ts:246:4
    (set_global $core/sound/sound/Sound.audioQueueIndex
     (i32.add
      (get_global $core/sound/sound/Sound.audioQueueIndex)
      ;;@ core/sound/sound.ts:246:29
      (i32.const 1)
     )
    )
    ;;@ core/sound/sound.ts:251:4
    (if
     ;;@ core/sound/sound.ts:251:8
     (i32.ge_s
      (get_global $core/sound/sound/Sound.audioQueueIndex)
      ;;@ core/sound/sound.ts:251:33
      (i32.sub
       (i32.div_s
        (get_global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize)
        ;;@ core/sound/sound.ts:251:68
        (i32.const 2)
       )
       ;;@ core/sound/sound.ts:251:72
       (i32.const 1)
      )
     )
     ;;@ core/sound/sound.ts:251:75
     (set_global $core/sound/sound/Sound.audioQueueIndex
      (i32.sub
       ;;@ core/sound/sound.ts:252:6
       (get_global $core/sound/sound/Sound.audioQueueIndex)
       ;;@ core/sound/sound.ts:252:31
       (i32.const 1)
      )
     )
    )
   )
  )
 )
 (func $core/sound/sound/updateSound (; 98 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/sound/sound.ts:191:2
  (set_local $1
   ;;@ core/sound/sound.ts:191:39
   (call $core/sound/sound/updateFrameSequencer
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:193:2
  (if
   (tee_local $1
    ;;@ core/sound/sound.ts:193:6
    (if (result i32)
     (get_global $core/config/Config.audioAccumulateSamples)
     ;;@ core/sound/sound.ts:193:39
     (i32.eqz
      (get_local $1)
     )
     (get_global $core/config/Config.audioAccumulateSamples)
    )
   )
   ;;@ core/sound/sound.ts:193:63
   (call $core/sound/accumulator/accumulateSound
    (get_local $0)
   )
   ;;@ core/sound/sound.ts:195:9
   (call $core/sound/sound/calculateSound
    (get_local $0)
   )
  )
 )
 (func $core/sound/sound/batchProcessAudio (; 99 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/sound.ts:178:2
  (if
   ;;@ core/sound/sound.ts:178:6
   (i32.lt_s
    (get_global $core/sound/sound/Sound.currentCycles)
    ;;@ core/sound/sound.ts:178:34
    (call $core/sound/sound/Sound.batchProcessCycles)
   )
   (return)
  )
  (loop $continue|0
   (if
    ;;@ core/sound/sound.ts:182:9
    (i32.ge_s
     (get_global $core/sound/sound/Sound.currentCycles)
     ;;@ core/sound/sound.ts:182:38
     (call $core/sound/sound/Sound.batchProcessCycles)
    )
    (block
     ;;@ core/sound/sound.ts:183:4
     (call $core/sound/sound/updateSound
      ;;@ core/sound/sound.ts:183:22
      (call $core/sound/sound/Sound.batchProcessCycles)
     )
     ;;@ core/sound/sound.ts:184:4
     (set_global $core/sound/sound/Sound.currentCycles
      ;;@ core/sound/sound.ts:184:26
      (i32.sub
       (get_global $core/sound/sound/Sound.currentCycles)
       ;;@ core/sound/sound.ts:184:54
       (call $core/sound/sound/Sound.batchProcessCycles)
      )
     )
     (br $continue|0)
    )
   )
  )
 )
 (func $core/sound/registers/SoundRegisterReadTraps (; 100 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/registers.ts:130:2
  (if
   ;;@ core/sound/registers.ts:130:6
   (i32.eq
    (get_local $0)
    (i32.const 65318)
   )
   ;;@ core/sound/registers.ts:130:43
   (block
    ;;@ core/sound/registers.ts:135:4
    (set_local $1
     ;;@ core/sound/registers.ts:135:19
     (i32.and
      ;;@ core/sound/registers.ts:132:28
      (call $core/memory/load/eightBitLoadFromGBMemory
       (i32.const 65318)
      )
      ;;@ core/sound/registers.ts:135:34
      (i32.const 128)
     )
    )
    (drop
     ;;@ core/sound/registers.ts:138:4
     (if (result i32)
      ;;@ core/sound/registers.ts:138:8
      (get_global $core/sound/channel1/Channel1.isEnabled)
      (call $core/helpers/index/setBitOnByte
       ;;@ core/sound/registers.ts:139:19
       (i32.const 0)
       (get_local $1)
      )
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/sound/registers.ts:141:21
       (i32.const 0)
       (get_local $1)
      )
     )
    )
    (drop
     ;;@ core/sound/registers.ts:144:4
     (if (result i32)
      ;;@ core/sound/registers.ts:144:8
      (get_global $core/sound/channel2/Channel2.isEnabled)
      (call $core/helpers/index/setBitOnByte
       ;;@ core/sound/registers.ts:145:19
       (i32.const 1)
       (get_local $1)
      )
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/sound/registers.ts:147:21
       (i32.const 1)
       (get_local $1)
      )
     )
    )
    (drop
     ;;@ core/sound/registers.ts:150:4
     (if (result i32)
      ;;@ core/sound/registers.ts:150:8
      (get_global $core/sound/channel3/Channel3.isEnabled)
      (call $core/helpers/index/setBitOnByte
       ;;@ core/sound/registers.ts:151:19
       (i32.const 2)
       (get_local $1)
      )
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/sound/registers.ts:153:21
       (i32.const 2)
       (get_local $1)
      )
     )
    )
    (drop
     ;;@ core/sound/registers.ts:156:4
     (if (result i32)
      ;;@ core/sound/registers.ts:156:8
      (get_global $core/sound/channel4/Channel4.isEnabled)
      (call $core/helpers/index/setBitOnByte
       ;;@ core/sound/registers.ts:157:19
       (i32.const 3)
       (get_local $1)
      )
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/sound/registers.ts:159:21
       (i32.const 3)
       (get_local $1)
      )
     )
    )
    ;;@ core/sound/registers.ts:165:11
    (return
     ;;@ core/sound/registers.ts:163:19
     (i32.or
      (get_local $1)
      ;;@ core/sound/registers.ts:163:34
      (i32.const 112)
     )
    )
   )
  )
  (i32.const -1)
 )
 (func $core/joypad/joypad/getJoypadState (; 101 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/joypad/joypad.ts:66:2
  (set_local $0
   ;;@ core/joypad/joypad.ts:66:28
   (get_global $core/joypad/joypad/Joypad.joypadRegisterFlipped)
  )
  ;;@ core/joypad/joypad.ts:68:2
  (if
   ;;@ core/joypad/joypad.ts:68:6
   (get_global $core/joypad/joypad/Joypad.isDpadType)
   ;;@ core/joypad/joypad.ts:68:25
   (block
    (set_local $0
     ;;@ core/joypad/joypad.ts:72:4
     (if (result i32)
      ;;@ core/joypad/joypad.ts:72:8
      (get_global $core/joypad/joypad/Joypad.up)
      ;;@ core/joypad/joypad.ts:73:23
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/joypad/joypad.ts:73:38
       (i32.const 2)
       (get_local $0)
      )
      ;;@ core/joypad/joypad.ts:75:23
      (call $core/helpers/index/setBitOnByte
       ;;@ core/joypad/joypad.ts:75:36
       (i32.const 2)
       (get_local $0)
      )
     )
    )
    (set_local $0
     ;;@ core/joypad/joypad.ts:79:4
     (if (result i32)
      ;;@ core/joypad/joypad.ts:79:8
      (get_global $core/joypad/joypad/Joypad.right)
      ;;@ core/joypad/joypad.ts:80:23
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/joypad/joypad.ts:80:38
       (i32.const 0)
       (get_local $0)
      )
      ;;@ core/joypad/joypad.ts:82:23
      (call $core/helpers/index/setBitOnByte
       ;;@ core/joypad/joypad.ts:82:36
       (i32.const 0)
       (get_local $0)
      )
     )
    )
    (set_local $0
     ;;@ core/joypad/joypad.ts:86:4
     (if (result i32)
      ;;@ core/joypad/joypad.ts:86:8
      (get_global $core/joypad/joypad/Joypad.down)
      ;;@ core/joypad/joypad.ts:87:23
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/joypad/joypad.ts:87:38
       (i32.const 3)
       (get_local $0)
      )
      ;;@ core/joypad/joypad.ts:89:23
      (call $core/helpers/index/setBitOnByte
       ;;@ core/joypad/joypad.ts:89:36
       (i32.const 3)
       (get_local $0)
      )
     )
    )
    (set_local $0
     ;;@ core/joypad/joypad.ts:93:4
     (if (result i32)
      ;;@ core/joypad/joypad.ts:93:8
      (get_global $core/joypad/joypad/Joypad.left)
      ;;@ core/joypad/joypad.ts:94:23
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/joypad/joypad.ts:94:38
       (i32.const 1)
       (get_local $0)
      )
      ;;@ core/joypad/joypad.ts:96:23
      (call $core/helpers/index/setBitOnByte
       ;;@ core/joypad/joypad.ts:96:36
       (i32.const 1)
       (get_local $0)
      )
     )
    )
   )
   ;;@ core/joypad/joypad.ts:98:9
   (if
    ;;@ core/joypad/joypad.ts:98:13
    (get_global $core/joypad/joypad/Joypad.isButtonType)
    ;;@ core/joypad/joypad.ts:98:34
    (block
     (set_local $0
      ;;@ core/joypad/joypad.ts:100:4
      (if (result i32)
       ;;@ core/joypad/joypad.ts:100:8
       (get_global $core/joypad/joypad/Joypad.a)
       ;;@ core/joypad/joypad.ts:101:23
       (call $core/helpers/index/resetBitOnByte
        ;;@ core/joypad/joypad.ts:101:38
        (i32.const 0)
        (get_local $0)
       )
       ;;@ core/joypad/joypad.ts:103:23
       (call $core/helpers/index/setBitOnByte
        ;;@ core/joypad/joypad.ts:103:36
        (i32.const 0)
        (get_local $0)
       )
      )
     )
     (set_local $0
      ;;@ core/joypad/joypad.ts:107:4
      (if (result i32)
       ;;@ core/joypad/joypad.ts:107:8
       (get_global $core/joypad/joypad/Joypad.b)
       ;;@ core/joypad/joypad.ts:108:23
       (call $core/helpers/index/resetBitOnByte
        ;;@ core/joypad/joypad.ts:108:38
        (i32.const 1)
        (get_local $0)
       )
       ;;@ core/joypad/joypad.ts:110:23
       (call $core/helpers/index/setBitOnByte
        ;;@ core/joypad/joypad.ts:110:36
        (i32.const 1)
        (get_local $0)
       )
      )
     )
     (set_local $0
      ;;@ core/joypad/joypad.ts:114:4
      (if (result i32)
       ;;@ core/joypad/joypad.ts:114:8
       (get_global $core/joypad/joypad/Joypad.select)
       ;;@ core/joypad/joypad.ts:115:23
       (call $core/helpers/index/resetBitOnByte
        ;;@ core/joypad/joypad.ts:115:38
        (i32.const 2)
        (get_local $0)
       )
       ;;@ core/joypad/joypad.ts:117:23
       (call $core/helpers/index/setBitOnByte
        ;;@ core/joypad/joypad.ts:117:36
        (i32.const 2)
        (get_local $0)
       )
      )
     )
     (set_local $0
      ;;@ core/joypad/joypad.ts:121:4
      (if (result i32)
       ;;@ core/joypad/joypad.ts:121:8
       (get_global $core/joypad/joypad/Joypad.start)
       ;;@ core/joypad/joypad.ts:122:23
       (call $core/helpers/index/resetBitOnByte
        ;;@ core/joypad/joypad.ts:122:38
        (i32.const 3)
        (get_local $0)
       )
       ;;@ core/joypad/joypad.ts:124:23
       (call $core/helpers/index/setBitOnByte
        ;;@ core/joypad/joypad.ts:124:36
        (i32.const 3)
        (get_local $0)
       )
      )
     )
    )
   )
  )
  ;;@ core/joypad/joypad.ts:129:19
  (i32.or
   (get_local $0)
   ;;@ core/joypad/joypad.ts:129:36
   (i32.const 240)
  )
 )
 (func $core/memory/readTraps/checkReadTraps (; 102 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/memory/readTraps.ts:17:2
  (if
   ;;@ core/memory/readTraps.ts:17:6
   (i32.lt_s
    (get_local $0)
    (i32.const 32768)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/memory/readTraps.ts:23:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     (i32.const 32768)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:23:36
    (i32.lt_s
     (get_local $0)
     (i32.const 40960)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:23:2
  (if
   (get_local $1)
   (return
    (i32.const -1)
   )
  )
  ;;@ core/memory/readTraps.ts:37:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     (i32.const 57344)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:37:42
    (i32.lt_s
     (get_local $0)
     (i32.const 65024)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:37:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:37:90
   (return
    ;;@ core/memory/readTraps.ts:39:11
    (call $core/memory/load/eightBitLoadFromGBMemory
     ;;@ core/memory/readTraps.ts:39:36
     (i32.add
      (get_local $0)
      ;;@ core/memory/readTraps.ts:39:45
      (i32.const -8192)
     )
    )
   )
  )
  ;;@ core/memory/readTraps.ts:45:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     (i32.const 65024)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:45:57
    (i32.le_s
     (get_local $0)
     (i32.const 65183)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:45:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:45:109
   (block
    ;;@ core/memory/readTraps.ts:48:4
    (if
     ;;@ core/memory/readTraps.ts:48:8
     (i32.lt_s
      (get_global $core/graphics/lcd/Lcd.currentLcdMode)
      ;;@ core/memory/readTraps.ts:48:29
      (i32.const 2)
     )
     (return
      (i32.const 255)
     )
    )
    ;;@ core/memory/readTraps.ts:55:12
    (return
     ;;@ core/memory/readTraps.ts:55:11
     (i32.const -1)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:61:2
  (if
   ;;@ core/memory/readTraps.ts:61:6
   (i32.eq
    (get_local $0)
    (i32.const 65348)
   )
   ;;@ core/memory/readTraps.ts:61:58
   (block
    ;;@ core/memory/readTraps.ts:62:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (get_local $0)
     ;;@ core/memory/readTraps.ts:62:38
     (get_global $core/graphics/graphics/Graphics.scanlineRegister)
    )
    ;;@ core/memory/readTraps.ts:63:20
    (return
     ;;@ core/memory/readTraps.ts:63:11
     (get_global $core/graphics/graphics/Graphics.scanlineRegister)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:69:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:69:16
     (i32.const 65296)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:69:26
    (i32.le_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:69:36
     (i32.const 65318)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:69:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:69:44
   (block
    ;;@ core/memory/readTraps.ts:70:4
    (call $core/sound/sound/batchProcessAudio)
    ;;@ core/memory/readTraps.ts:71:40
    (return
     ;;@ core/memory/readTraps.ts:71:11
     (call $core/sound/registers/SoundRegisterReadTraps
      (get_local $0)
     )
    )
   )
  )
  ;;@ core/memory/readTraps.ts:75:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:75:16
     (i32.const 65328)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:75:26
    (i32.le_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:75:36
     (i32.const 65343)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:75:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:75:44
   (block
    ;;@ core/memory/readTraps.ts:76:4
    (call $core/sound/sound/batchProcessAudio)
    ;;@ core/memory/readTraps.ts:77:12
    (return
     ;;@ core/memory/readTraps.ts:77:11
     (i32.const -1)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:81:2
  (if
   ;;@ core/memory/readTraps.ts:81:6
   (i32.eq
    (get_local $0)
    (i32.const 65284)
   )
   ;;@ core/memory/readTraps.ts:81:55
   (block
    ;;@ core/memory/readTraps.ts:85:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (get_local $0)
     ;;@ core/memory/readTraps.ts:84:4
     (tee_local $1
      ;;@ core/memory/readTraps.ts:84:35
      (call $core/helpers/index/splitHighByte
       ;;@ core/memory/readTraps.ts:84:49
       (get_global $core/timers/timers/Timers.dividerRegister)
      )
     )
    )
    ;;@ core/memory/readTraps.ts:86:11
    (return
     (get_local $1)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:88:2
  (if
   ;;@ core/memory/readTraps.ts:88:6
   (i32.eq
    (get_local $0)
    (i32.const 65285)
   )
   ;;@ core/memory/readTraps.ts:88:52
   (block
    ;;@ core/memory/readTraps.ts:89:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (get_local $0)
     ;;@ core/memory/readTraps.ts:89:38
     (get_global $core/timers/timers/Timers.timerCounter)
    )
    ;;@ core/memory/readTraps.ts:90:18
    (return
     ;;@ core/memory/readTraps.ts:90:11
     (get_global $core/timers/timers/Timers.timerCounter)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:94:2
  (if
   ;;@ core/memory/readTraps.ts:94:6
   (i32.eq
    (get_local $0)
    (i32.const 65280)
   )
   ;;@ core/memory/readTraps.ts:94:54
   (return
    ;;@ core/memory/readTraps.ts:95:11
    (call $core/joypad/joypad/getJoypadState)
   )
  )
  (i32.const -1)
 )
 (func $core/memory/load/eightBitLoadFromGBMemoryWithTraps (; 103 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (if
   (i32.eq
    ;;@ core/memory/load.ts:11:2
    (tee_local $1
     ;;@ core/memory/load.ts:11:28
     (call $core/memory/readTraps/checkReadTraps
      (get_local $0)
     )
    )
    ;;@ core/memory/load.ts:13:9
    (i32.const -1)
   )
   ;;@ core/memory/load.ts:14:44
   (return
    ;;@ core/memory/load.ts:14:13
    (call $core/memory/load/eightBitLoadFromGBMemory
     (get_local $0)
    )
   )
  )
  ;;@ core/memory/load.ts:16:13
  (i32.and
   (get_local $1)
   (i32.const 255)
  )
 )
 (func $core/memory/banking/handleBanking (; 104 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  ;;@ core/memory/banking.ts:7:2
  (if
   ;;@ core/memory/banking.ts:7:6
   (get_global $core/memory/memory/Memory.isRomOnly)
   (return)
  )
  ;;@ core/memory/banking.ts:12:2
  (if
   ;;@ core/memory/banking.ts:12:6
   (i32.le_s
    (get_local $0)
    ;;@ core/memory/banking.ts:12:16
    (i32.const 8191)
   )
   ;;@ core/memory/banking.ts:12:24
   (if
    (i32.eqz
     (tee_local $0
      ;;@ core/memory/banking.ts:13:8
      (if (result i32)
       (get_global $core/memory/memory/Memory.isMBC2)
       ;;@ core/memory/banking.ts:13:25
       (i32.eqz
        ;;@ core/memory/banking.ts:13:26
        (call $core/helpers/index/checkBitOnByte
         ;;@ core/memory/banking.ts:13:41
         (i32.const 4)
         ;;@ core/memory/banking.ts:13:44
         (i32.and
          (get_local $1)
          (i32.const 255)
         )
        )
       )
       (get_global $core/memory/memory/Memory.isMBC2)
      )
     )
    )
    ;;@ core/memory/banking.ts:18:6
    (if
     ;;@ core/memory/banking.ts:17:6
     (tee_local $2
      ;;@ core/memory/banking.ts:17:26
      (i32.and
       (get_local $1)
       ;;@ core/memory/banking.ts:17:34
       (i32.const 15)
      )
     )
     ;;@ core/memory/banking.ts:20:13
     (if
      ;;@ core/memory/banking.ts:20:17
      (i32.eq
       (get_local $2)
       ;;@ core/memory/banking.ts:20:35
       (i32.const 10)
      )
      ;;@ core/memory/banking.ts:20:41
      (set_global $core/memory/memory/Memory.isRamBankingEnabled
       ;;@ core/memory/banking.ts:21:37
       (i32.const 1)
      )
     )
     ;;@ core/memory/banking.ts:18:34
     (set_global $core/memory/memory/Memory.isRamBankingEnabled
      ;;@ core/memory/banking.ts:19:37
      (i32.const 0)
     )
    )
   )
   ;;@ core/memory/banking.ts:24:9
   (if
    ;;@ core/memory/banking.ts:24:13
    (i32.le_s
     (get_local $0)
     ;;@ core/memory/banking.ts:24:23
     (i32.const 16383)
    )
    (block
     ;;@ core/memory/banking.ts:25:8
     (if
      (i32.eqz
       (tee_local $2
        (i32.eqz
         ;;@ core/memory/banking.ts:25:9
         (get_global $core/memory/memory/Memory.isMBC5)
        )
       )
      )
      (set_local $2
       ;;@ core/memory/banking.ts:25:26
       (i32.le_s
        (get_local $0)
        ;;@ core/memory/banking.ts:25:36
        (i32.const 12287)
       )
      )
     )
     ;;@ core/memory/banking.ts:24:31
     (if
      (get_local $2)
      ;;@ core/memory/banking.ts:25:44
      (block
       ;;@ core/memory/banking.ts:27:6
       (if
        ;;@ core/memory/banking.ts:27:10
        (get_global $core/memory/memory/Memory.isMBC2)
        ;;@ core/memory/banking.ts:27:25
        (set_global $core/memory/memory/Memory.currentRomBank
         ;;@ core/memory/banking.ts:28:32
         (i32.and
          (get_local $1)
          ;;@ core/memory/banking.ts:28:40
          (i32.const 15)
         )
        )
       )
       ;;@ core/memory/banking.ts:32:6
       (set_local $2
        (get_local $1)
       )
       ;;@ core/memory/banking.ts:33:6
       (if
        ;;@ core/memory/banking.ts:33:10
        (get_global $core/memory/memory/Memory.isMBC1)
        ;;@ core/memory/banking.ts:33:25
        (block
         ;;@ core/memory/banking.ts:35:8
         (set_local $2
          ;;@ core/memory/banking.ts:35:27
          (i32.and
           (get_local $2)
           ;;@ core/memory/banking.ts:35:46
           (i32.const 31)
          )
         )
         ;;@ core/memory/banking.ts:36:8
         (set_global $core/memory/memory/Memory.currentRomBank
          ;;@ core/memory/banking.ts:36:32
          (i32.and
           (get_global $core/memory/memory/Memory.currentRomBank)
           ;;@ core/memory/banking.ts:36:56
           (i32.const 224)
          )
         )
        )
        ;;@ core/memory/banking.ts:37:13
        (if
         ;;@ core/memory/banking.ts:37:17
         (get_global $core/memory/memory/Memory.isMBC3)
         ;;@ core/memory/banking.ts:37:32
         (block
          ;;@ core/memory/banking.ts:39:8
          (set_local $2
           ;;@ core/memory/banking.ts:39:27
           (i32.and
            (get_local $2)
            ;;@ core/memory/banking.ts:39:46
            (i32.const 127)
           )
          )
          ;;@ core/memory/banking.ts:40:8
          (set_global $core/memory/memory/Memory.currentRomBank
           ;;@ core/memory/banking.ts:40:32
           (i32.and
            (get_global $core/memory/memory/Memory.currentRomBank)
            ;;@ core/memory/banking.ts:40:56
            (i32.const 128)
           )
          )
         )
         ;;@ core/memory/banking.ts:41:13
         (if
          ;;@ core/memory/banking.ts:41:17
          (get_global $core/memory/memory/Memory.isMBC5)
          ;;@ core/memory/banking.ts:41:32
          (set_global $core/memory/memory/Memory.currentRomBank
           (i32.const 0)
          )
         )
        )
       )
       ;;@ core/memory/banking.ts:47:6
       (set_global $core/memory/memory/Memory.currentRomBank
        ;;@ core/memory/banking.ts:47:30
        (i32.or
         (get_global $core/memory/memory/Memory.currentRomBank)
         (get_local $2)
        )
       )
      )
      ;;@ core/memory/banking.ts:49:11
      (block
       ;;@ core/memory/banking.ts:51:6
       (set_local $2
        ;;@ core/memory/banking.ts:51:26
        (i32.const 0)
       )
       ;;@ core/memory/banking.ts:52:6
       (set_local $3
        ;;@ core/memory/banking.ts:52:25
        (call $core/helpers/index/splitLowByte
         ;;@ core/memory/banking.ts:52:38
         (get_global $core/memory/memory/Memory.currentRomBank)
        )
       )
       ;;@ core/memory/banking.ts:53:6
       (if
        ;;@ core/memory/banking.ts:53:10
        (i32.gt_s
         (get_local $1)
         ;;@ core/memory/banking.ts:53:18
         (i32.const 0)
        )
        ;;@ core/memory/banking.ts:53:21
        (set_local $2
         ;;@ core/memory/banking.ts:54:19
         (i32.const 1)
        )
       )
       ;;@ core/memory/banking.ts:56:6
       (set_global $core/memory/memory/Memory.currentRomBank
        ;;@ core/memory/banking.ts:56:30
        (call $core/helpers/index/concatenateBytes
         (get_local $2)
         (get_local $3)
        )
       )
      )
     )
    )
    (block
     ;;@ core/memory/banking.ts:58:13
     (if
      (tee_local $3
       (i32.eqz
        ;;@ core/memory/banking.ts:58:14
        (get_global $core/memory/memory/Memory.isMBC2)
       )
      )
      (set_local $3
       ;;@ core/memory/banking.ts:58:31
       (i32.le_s
        (get_local $0)
        ;;@ core/memory/banking.ts:58:41
        (i32.const 24575)
       )
      )
     )
     ;;@ core/memory/banking.ts:58:9
     (if
      (get_local $3)
      ;;@ core/memory/banking.ts:58:49
      (block
       ;;@ core/memory/banking.ts:60:4
       (if
        (tee_local $0
         ;;@ core/memory/banking.ts:60:8
         (if (result i32)
          (get_global $core/memory/memory/Memory.isMBC1)
          ;;@ core/memory/banking.ts:60:25
          (get_global $core/memory/memory/Memory.isMBC1RomModeEnabled)
          (get_global $core/memory/memory/Memory.isMBC1)
         )
        )
        ;;@ core/memory/banking.ts:60:54
        (block
         ;;@ core/memory/banking.ts:63:6
         (set_global $core/memory/memory/Memory.currentRomBank
          ;;@ core/memory/banking.ts:63:30
          (i32.and
           (get_global $core/memory/memory/Memory.currentRomBank)
           ;;@ core/memory/banking.ts:63:54
           (i32.const 31)
          )
         )
         ;;@ core/memory/banking.ts:67:6
         (set_global $core/memory/memory/Memory.currentRomBank
          ;;@ core/memory/banking.ts:67:30
          (i32.or
           (get_global $core/memory/memory/Memory.currentRomBank)
           ;;@ core/memory/banking.ts:65:30
           (i32.and
            (get_local $1)
            ;;@ core/memory/banking.ts:65:38
            (i32.const 224)
           )
          )
         )
         ;;@ core/memory/banking.ts:68:6
         (return)
        )
       )
       ;;@ core/memory/banking.ts:71:4
       (if
        ;;@ core/memory/banking.ts:71:8
        (get_global $core/memory/memory/Memory.isMBC3)
        ;;@ core/memory/banking.ts:72:10
        (if
         (tee_local $3
          (i32.ge_s
           (get_local $1)
           ;;@ core/memory/banking.ts:72:19
           (i32.const 8)
          )
         )
         (set_local $3
          ;;@ core/memory/banking.ts:72:27
          (i32.le_s
           (get_local $1)
           ;;@ core/memory/banking.ts:72:36
           (i32.const 12)
          )
         )
        )
       )
       ;;@ core/memory/banking.ts:77:4
       (set_local $3
        (get_local $1)
       )
       ;;@ core/memory/banking.ts:88:4
       (set_global $core/memory/memory/Memory.currentRamBank
        (tee_local $3
         ;;@ core/memory/banking.ts:79:4
         (if (result i32)
          ;;@ core/memory/banking.ts:79:9
          (get_global $core/memory/memory/Memory.isMBC5)
          ;;@ core/memory/banking.ts:84:20
          (i32.and
           (get_local $3)
           ;;@ core/memory/banking.ts:84:34
           (i32.const 15)
          )
          ;;@ core/memory/banking.ts:81:20
          (i32.and
           (get_local $3)
           ;;@ core/memory/banking.ts:81:34
           (i32.const 3)
          )
         )
        )
       )
      )
      (block
       ;;@ core/memory/banking.ts:90:13
       (if
        (tee_local $3
         (i32.eqz
          ;;@ core/memory/banking.ts:90:14
          (get_global $core/memory/memory/Memory.isMBC2)
         )
        )
        (set_local $3
         ;;@ core/memory/banking.ts:90:31
         (i32.le_s
          (get_local $0)
          ;;@ core/memory/banking.ts:90:41
          (i32.const 32767)
         )
        )
       )
       ;;@ core/memory/banking.ts:90:9
       (if
        (get_local $3)
        ;;@ core/memory/banking.ts:90:49
        (if
         ;;@ core/memory/banking.ts:91:8
         (get_global $core/memory/memory/Memory.isMBC1)
         ;;@ core/memory/banking.ts:91:23
         (if
          ;;@ core/memory/banking.ts:92:10
          (call $core/helpers/index/checkBitOnByte
           ;;@ core/memory/banking.ts:92:25
           (i32.const 0)
           ;;@ core/memory/banking.ts:92:28
           (i32.and
            (get_local $1)
            (i32.const 255)
           )
          )
          ;;@ core/memory/banking.ts:92:40
          (set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
           ;;@ core/memory/banking.ts:93:38
           (i32.const 1)
          )
          ;;@ core/memory/banking.ts:94:13
          (set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
           ;;@ core/memory/banking.ts:95:38
           (i32.const 0)
          )
         )
        )
       )
      )
     )
    )
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateNRx0 (; 105 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel1.ts:29:4
  (set_global $core/sound/channel1/Channel1.NRx0SweepPeriod
   ;;@ core/sound/channel1.ts:29:31
   (i32.shr_s
    (i32.and
     (get_local $0)
     ;;@ core/sound/channel1.ts:29:40
     (i32.const 112)
    )
    ;;@ core/sound/channel1.ts:29:49
    (i32.const 4)
   )
  )
  ;;@ core/sound/channel1.ts:30:4
  (set_global $core/sound/channel1/Channel1.NRx0Negate
   ;;@ core/sound/channel1.ts:30:26
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel1.ts:30:41
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel1.ts:31:4
  (set_global $core/sound/channel1/Channel1.NRx0SweepShift
   ;;@ core/sound/channel1.ts:31:30
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel1.ts:31:38
    (i32.const 7)
   )
  )
 )
 (func $core/sound/channel3/Channel3.updateNRx0 (; 106 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:25:4
  (set_global $core/sound/channel3/Channel3.isDacEnabled
   ;;@ core/sound/channel3.ts:25:28
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel3.ts:25:43
    (i32.const 7)
    (get_local $0)
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateNRx1 (; 107 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel1.ts:40:4
  (set_global $core/sound/channel1/Channel1.NRx1Duty
   ;;@ core/sound/channel1.ts:40:24
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/channel1.ts:40:34
     (i32.const 6)
    )
    ;;@ core/sound/channel1.ts:40:39
    (i32.const 3)
   )
  )
  ;;@ core/sound/channel1.ts:41:4
  (set_global $core/sound/channel1/Channel1.NRx1LengthLoad
   ;;@ core/sound/channel1.ts:41:30
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel1.ts:41:38
    (i32.const 63)
   )
  )
  ;;@ core/sound/channel1.ts:47:4
  (set_global $core/sound/channel1/Channel1.lengthCounter
   ;;@ core/sound/channel1.ts:47:29
   (i32.sub
    (i32.const 64)
    ;;@ core/sound/channel1.ts:47:34
    (get_global $core/sound/channel1/Channel1.NRx1LengthLoad)
   )
  )
 )
 (func $core/sound/channel2/Channel2.updateNRx1 (; 108 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel2.ts:28:4
  (set_global $core/sound/channel2/Channel2.NRx1Duty
   ;;@ core/sound/channel2.ts:28:24
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/channel2.ts:28:34
     (i32.const 6)
    )
    ;;@ core/sound/channel2.ts:28:39
    (i32.const 3)
   )
  )
  ;;@ core/sound/channel2.ts:29:4
  (set_global $core/sound/channel2/Channel2.NRx1LengthLoad
   ;;@ core/sound/channel2.ts:29:30
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel2.ts:29:38
    (i32.const 63)
   )
  )
  ;;@ core/sound/channel2.ts:35:4
  (set_global $core/sound/channel2/Channel2.lengthCounter
   ;;@ core/sound/channel2.ts:35:29
   (i32.sub
    (i32.const 64)
    ;;@ core/sound/channel2.ts:35:34
    (get_global $core/sound/channel2/Channel2.NRx1LengthLoad)
   )
  )
 )
 (func $core/sound/channel3/Channel3.updateNRx1 (; 109 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:33:4
  (set_global $core/sound/channel3/Channel3.NRx1LengthLoad
   (get_local $0)
  )
  ;;@ core/sound/channel3.ts:40:4
  (set_global $core/sound/channel3/Channel3.lengthCounter
   ;;@ core/sound/channel3.ts:40:29
   (i32.sub
    (i32.const 256)
    ;;@ core/sound/channel3.ts:40:35
    (get_global $core/sound/channel3/Channel3.NRx1LengthLoad)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx1 (; 110 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel4.ts:28:4
  (set_global $core/sound/channel4/Channel4.NRx1LengthLoad
   ;;@ core/sound/channel4.ts:28:30
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel4.ts:28:38
    (i32.const 63)
   )
  )
  ;;@ core/sound/channel4.ts:34:4
  (set_global $core/sound/channel4/Channel4.lengthCounter
   ;;@ core/sound/channel4.ts:34:29
   (i32.sub
    (i32.const 64)
    ;;@ core/sound/channel4.ts:34:34
    (get_global $core/sound/channel4/Channel4.NRx1LengthLoad)
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateNRx2 (; 111 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel1.ts:57:4
  (set_global $core/sound/channel1/Channel1.NRx2StartingVolume
   ;;@ core/sound/channel1.ts:57:34
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/channel1.ts:57:44
     (i32.const 4)
    )
    ;;@ core/sound/channel1.ts:57:49
    (i32.const 15)
   )
  )
  ;;@ core/sound/channel1.ts:58:4
  (set_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
   ;;@ core/sound/channel1.ts:58:35
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel1.ts:58:50
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel1.ts:59:4
  (set_global $core/sound/channel1/Channel1.NRx2EnvelopePeriod
   ;;@ core/sound/channel1.ts:59:34
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel1.ts:59:42
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel1.ts:62:4
  (set_global $core/sound/channel1/Channel1.isDacEnabled
   ;;@ core/sound/channel1.ts:62:28
   (i32.gt_s
    (i32.and
     (get_local $0)
     ;;@ core/sound/channel1.ts:62:37
     (i32.const 248)
    )
    ;;@ core/sound/channel1.ts:62:45
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel2/Channel2.updateNRx2 (; 112 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel2.ts:45:4
  (set_global $core/sound/channel2/Channel2.NRx2StartingVolume
   ;;@ core/sound/channel2.ts:45:34
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/channel2.ts:45:44
     (i32.const 4)
    )
    ;;@ core/sound/channel2.ts:45:49
    (i32.const 15)
   )
  )
  ;;@ core/sound/channel2.ts:46:4
  (set_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
   ;;@ core/sound/channel2.ts:46:35
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel2.ts:46:50
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel2.ts:47:4
  (set_global $core/sound/channel2/Channel2.NRx2EnvelopePeriod
   ;;@ core/sound/channel2.ts:47:34
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel2.ts:47:42
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel2.ts:50:4
  (set_global $core/sound/channel2/Channel2.isDacEnabled
   ;;@ core/sound/channel2.ts:50:28
   (i32.gt_s
    (i32.and
     (get_local $0)
     ;;@ core/sound/channel2.ts:50:37
     (i32.const 248)
    )
    ;;@ core/sound/channel2.ts:50:45
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel3/Channel3.updateNRx2 (; 113 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:48:4
  (set_global $core/sound/channel3/Channel3.NRx2VolumeCode
   ;;@ core/sound/channel3.ts:48:30
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/channel3.ts:48:40
     (i32.const 5)
    )
    ;;@ core/sound/channel3.ts:48:45
    (i32.const 15)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx2 (; 114 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel4.ts:44:4
  (set_global $core/sound/channel4/Channel4.NRx2StartingVolume
   ;;@ core/sound/channel4.ts:44:34
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/channel4.ts:44:44
     (i32.const 4)
    )
    ;;@ core/sound/channel4.ts:44:49
    (i32.const 15)
   )
  )
  ;;@ core/sound/channel4.ts:45:4
  (set_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
   ;;@ core/sound/channel4.ts:45:35
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel4.ts:45:50
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel4.ts:46:4
  (set_global $core/sound/channel4/Channel4.NRx2EnvelopePeriod
   ;;@ core/sound/channel4.ts:46:34
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel4.ts:46:42
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel4.ts:49:4
  (set_global $core/sound/channel4/Channel4.isDacEnabled
   ;;@ core/sound/channel4.ts:49:28
   (i32.gt_s
    (i32.and
     (get_local $0)
     ;;@ core/sound/channel4.ts:49:37
     (i32.const 248)
    )
    ;;@ core/sound/channel4.ts:49:45
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateNRx3 (; 115 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel1.ts:70:4
  (set_global $core/sound/channel1/Channel1.NRx3FrequencyLSB
   (get_local $0)
  )
  ;;@ core/sound/channel1.ts:74:4
  (set_global $core/sound/channel1/Channel1.frequency
   ;;@ core/sound/channel1.ts:73:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel1.ts:73:26
     (get_global $core/sound/channel1/Channel1.NRx4FrequencyMSB)
     ;;@ core/sound/channel1.ts:73:55
     (i32.const 8)
    )
    ;;@ core/sound/channel1.ts:73:60
    (get_global $core/sound/channel1/Channel1.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel2/Channel2.updateNRx3 (; 116 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel2.ts:58:4
  (set_global $core/sound/channel2/Channel2.NRx3FrequencyLSB
   (get_local $0)
  )
  ;;@ core/sound/channel2.ts:62:4
  (set_global $core/sound/channel2/Channel2.frequency
   ;;@ core/sound/channel2.ts:61:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel2.ts:61:26
     (get_global $core/sound/channel2/Channel2.NRx4FrequencyMSB)
     ;;@ core/sound/channel2.ts:61:55
     (i32.const 8)
    )
    ;;@ core/sound/channel2.ts:61:60
    (get_global $core/sound/channel2/Channel2.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel3/Channel3.updateNRx3 (; 117 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:56:4
  (set_global $core/sound/channel3/Channel3.NRx3FrequencyLSB
   (get_local $0)
  )
  ;;@ core/sound/channel3.ts:60:4
  (set_global $core/sound/channel3/Channel3.frequency
   ;;@ core/sound/channel3.ts:59:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel3.ts:59:26
     (get_global $core/sound/channel3/Channel3.NRx4FrequencyMSB)
     ;;@ core/sound/channel3.ts:59:55
     (i32.const 8)
    )
    ;;@ core/sound/channel3.ts:59:60
    (get_global $core/sound/channel3/Channel3.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx3 (; 118 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/sound/channel4.ts:59:4
  (set_global $core/sound/channel4/Channel4.NRx3ClockShift
   ;;@ core/sound/channel4.ts:59:30
   (i32.shr_s
    (get_local $0)
    ;;@ core/sound/channel4.ts:59:39
    (i32.const 4)
   )
  )
  ;;@ core/sound/channel4.ts:60:4
  (set_global $core/sound/channel4/Channel4.NRx3WidthMode
   ;;@ core/sound/channel4.ts:60:29
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel4.ts:60:44
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel4.ts:61:4
  (set_global $core/sound/channel4/Channel4.NRx3DivisorCode
   ;;@ core/sound/channel4.ts:61:31
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel4.ts:61:39
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel4.ts:64:4
  (block $break|0
   (block $case7|0
    (block $case6|0
     (block $case5|0
      (block $case4|0
       (block $case3|0
        (block $case2|0
         (block $case1|0
          (if
           (tee_local $1
            ;;@ core/sound/channel4.ts:64:12
            (get_global $core/sound/channel4/Channel4.NRx3DivisorCode)
           )
           (block
            (block $tablify|0
             (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
              (i32.sub
               (get_local $1)
               (i32.const 1)
              )
             )
            )
            (br $break|0)
           )
          )
          ;;@ core/sound/channel4.ts:66:8
          (set_global $core/sound/channel4/Channel4.divisor
           ;;@ core/sound/channel4.ts:66:27
           (i32.const 8)
          )
          ;;@ core/sound/channel4.ts:67:8
          (return)
         )
         ;;@ core/sound/channel4.ts:69:8
         (set_global $core/sound/channel4/Channel4.divisor
          ;;@ core/sound/channel4.ts:69:27
          (i32.const 16)
         )
         ;;@ core/sound/channel4.ts:70:8
         (return)
        )
        ;;@ core/sound/channel4.ts:72:8
        (set_global $core/sound/channel4/Channel4.divisor
         ;;@ core/sound/channel4.ts:72:27
         (i32.const 32)
        )
        ;;@ core/sound/channel4.ts:73:8
        (return)
       )
       ;;@ core/sound/channel4.ts:75:8
       (set_global $core/sound/channel4/Channel4.divisor
        ;;@ core/sound/channel4.ts:75:27
        (i32.const 48)
       )
       ;;@ core/sound/channel4.ts:76:8
       (return)
      )
      ;;@ core/sound/channel4.ts:78:8
      (set_global $core/sound/channel4/Channel4.divisor
       ;;@ core/sound/channel4.ts:78:27
       (i32.const 64)
      )
      ;;@ core/sound/channel4.ts:79:8
      (return)
     )
     ;;@ core/sound/channel4.ts:81:8
     (set_global $core/sound/channel4/Channel4.divisor
      ;;@ core/sound/channel4.ts:81:27
      (i32.const 80)
     )
     ;;@ core/sound/channel4.ts:82:8
     (return)
    )
    ;;@ core/sound/channel4.ts:84:8
    (set_global $core/sound/channel4/Channel4.divisor
     ;;@ core/sound/channel4.ts:84:27
     (i32.const 96)
    )
    ;;@ core/sound/channel4.ts:85:8
    (return)
   )
   ;;@ core/sound/channel4.ts:87:8
   (set_global $core/sound/channel4/Channel4.divisor
    ;;@ core/sound/channel4.ts:87:27
    (i32.const 112)
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateNRx4 (; 119 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel1.ts:83:4
  (set_global $core/sound/channel1/Channel1.NRx4LengthEnabled
   ;;@ core/sound/channel1.ts:83:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel1.ts:83:48
    (i32.const 6)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel1.ts:84:4
  (set_global $core/sound/channel1/Channel1.NRx4FrequencyMSB
   ;;@ core/sound/channel1.ts:84:32
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel1.ts:84:40
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel1.ts:88:4
  (set_global $core/sound/channel1/Channel1.frequency
   ;;@ core/sound/channel1.ts:87:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel1.ts:87:26
     (get_global $core/sound/channel1/Channel1.NRx4FrequencyMSB)
     ;;@ core/sound/channel1.ts:87:55
     (i32.const 8)
    )
    ;;@ core/sound/channel1.ts:87:60
    (get_global $core/sound/channel1/Channel1.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel1/Channel1.trigger (; 120 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel1.ts:221:4
  (set_global $core/sound/channel1/Channel1.isEnabled
   ;;@ core/sound/channel1.ts:221:25
   (i32.const 1)
  )
  ;;@ core/sound/channel1.ts:222:4
  (if
   (i32.eqz
    ;;@ core/sound/channel1.ts:222:8
    (get_global $core/sound/channel1/Channel1.lengthCounter)
   )
   ;;@ core/sound/channel1.ts:222:38
   (set_global $core/sound/channel1/Channel1.lengthCounter
    ;;@ core/sound/channel1.ts:223:31
    (i32.const 64)
   )
  )
  ;;@ core/sound/channel1.ts:229:13
  (call $core/sound/channel1/Channel1.resetTimer)
  ;;@ core/sound/channel1.ts:231:4
  (set_global $core/sound/channel1/Channel1.envelopeCounter
   ;;@ core/sound/channel1.ts:231:31
   (get_global $core/sound/channel1/Channel1.NRx2EnvelopePeriod)
  )
  ;;@ core/sound/channel1.ts:233:4
  (set_global $core/sound/channel1/Channel1.volume
   ;;@ core/sound/channel1.ts:233:22
   (get_global $core/sound/channel1/Channel1.NRx2StartingVolume)
  )
  ;;@ core/sound/channel1.ts:237:4
  (set_global $core/sound/channel1/Channel1.sweepShadowFrequency
   ;;@ core/sound/channel1.ts:237:36
   (get_global $core/sound/channel1/Channel1.frequency)
  )
  ;;@ core/sound/channel1.ts:240:4
  (set_global $core/sound/channel1/Channel1.sweepCounter
   ;;@ core/sound/channel1.ts:240:28
   (get_global $core/sound/channel1/Channel1.NRx0SweepPeriod)
  )
  ;;@ core/sound/channel1.ts:243:8
  (if
   (tee_local $0
    (i32.gt_s
     (get_global $core/sound/channel1/Channel1.NRx0SweepPeriod)
     ;;@ core/sound/channel1.ts:243:35
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel1.ts:243:40
    (i32.gt_s
     (get_global $core/sound/channel1/Channel1.NRx0SweepShift)
     ;;@ core/sound/channel1.ts:243:66
     (i32.const 0)
    )
   )
  )
  ;;@ core/sound/channel1.ts:243:4
  (if
   (get_local $0)
   ;;@ core/sound/channel1.ts:243:69
   (set_global $core/sound/channel1/Channel1.isSweepEnabled
    ;;@ core/sound/channel1.ts:244:32
    (i32.const 1)
   )
   ;;@ core/sound/channel1.ts:245:11
   (set_global $core/sound/channel1/Channel1.isSweepEnabled
    ;;@ core/sound/channel1.ts:246:32
    (i32.const 0)
   )
  )
  ;;@ core/sound/channel1.ts:250:4
  (if
   ;;@ core/sound/channel1.ts:250:8
   (i32.gt_s
    (get_global $core/sound/channel1/Channel1.NRx0SweepShift)
    ;;@ core/sound/channel1.ts:250:34
    (i32.const 0)
   )
   ;;@ core/sound/channel1.ts:250:37
   (call $core/sound/channel1/calculateSweepAndCheckOverflow)
  )
  ;;@ core/sound/channel1.ts:255:4
  (if
   ;;@ core/sound/channel1.ts:255:8
   (i32.eqz
    ;;@ core/sound/channel1.ts:255:9
    (get_global $core/sound/channel1/Channel1.isDacEnabled)
   )
   ;;@ core/sound/channel1.ts:255:32
   (set_global $core/sound/channel1/Channel1.isEnabled
    ;;@ core/sound/channel1.ts:256:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel2/Channel2.updateNRx4 (; 121 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel2.ts:71:4
  (set_global $core/sound/channel2/Channel2.NRx4LengthEnabled
   ;;@ core/sound/channel2.ts:71:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel2.ts:71:48
    (i32.const 6)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel2.ts:72:4
  (set_global $core/sound/channel2/Channel2.NRx4FrequencyMSB
   ;;@ core/sound/channel2.ts:72:32
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel2.ts:72:40
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel2.ts:76:4
  (set_global $core/sound/channel2/Channel2.frequency
   ;;@ core/sound/channel2.ts:75:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel2.ts:75:26
     (get_global $core/sound/channel2/Channel2.NRx4FrequencyMSB)
     ;;@ core/sound/channel2.ts:75:55
     (i32.const 8)
    )
    ;;@ core/sound/channel2.ts:75:60
    (get_global $core/sound/channel2/Channel2.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel2/Channel2.trigger (; 122 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel2.ts:197:4
  (set_global $core/sound/channel2/Channel2.isEnabled
   ;;@ core/sound/channel2.ts:197:25
   (i32.const 1)
  )
  ;;@ core/sound/channel2.ts:198:4
  (if
   (i32.eqz
    ;;@ core/sound/channel2.ts:198:8
    (get_global $core/sound/channel2/Channel2.lengthCounter)
   )
   ;;@ core/sound/channel2.ts:198:38
   (set_global $core/sound/channel2/Channel2.lengthCounter
    ;;@ core/sound/channel2.ts:199:31
    (i32.const 64)
   )
  )
  ;;@ core/sound/channel2.ts:205:13
  (call $core/sound/channel2/Channel2.resetTimer)
  ;;@ core/sound/channel2.ts:207:4
  (set_global $core/sound/channel2/Channel2.envelopeCounter
   ;;@ core/sound/channel2.ts:207:31
   (get_global $core/sound/channel2/Channel2.NRx2EnvelopePeriod)
  )
  ;;@ core/sound/channel2.ts:209:4
  (set_global $core/sound/channel2/Channel2.volume
   ;;@ core/sound/channel2.ts:209:22
   (get_global $core/sound/channel2/Channel2.NRx2StartingVolume)
  )
  ;;@ core/sound/channel2.ts:212:4
  (if
   ;;@ core/sound/channel2.ts:212:8
   (i32.eqz
    ;;@ core/sound/channel2.ts:212:9
    (get_global $core/sound/channel2/Channel2.isDacEnabled)
   )
   ;;@ core/sound/channel2.ts:212:32
   (set_global $core/sound/channel2/Channel2.isEnabled
    ;;@ core/sound/channel2.ts:213:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel3/Channel3.updateNRx4 (; 123 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:69:4
  (set_global $core/sound/channel3/Channel3.NRx4LengthEnabled
   ;;@ core/sound/channel3.ts:69:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel3.ts:69:48
    (i32.const 6)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel3.ts:70:4
  (set_global $core/sound/channel3/Channel3.NRx4FrequencyMSB
   ;;@ core/sound/channel3.ts:70:32
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel3.ts:70:40
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel3.ts:74:4
  (set_global $core/sound/channel3/Channel3.frequency
   ;;@ core/sound/channel3.ts:73:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel3.ts:73:26
     (get_global $core/sound/channel3/Channel3.NRx4FrequencyMSB)
     ;;@ core/sound/channel3.ts:73:55
     (i32.const 8)
    )
    ;;@ core/sound/channel3.ts:73:60
    (get_global $core/sound/channel3/Channel3.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel3/Channel3.trigger (; 124 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:235:4
  (set_global $core/sound/channel3/Channel3.isEnabled
   ;;@ core/sound/channel3.ts:235:25
   (i32.const 1)
  )
  ;;@ core/sound/channel3.ts:236:4
  (if
   (i32.eqz
    ;;@ core/sound/channel3.ts:236:8
    (get_global $core/sound/channel3/Channel3.lengthCounter)
   )
   ;;@ core/sound/channel3.ts:236:38
   (set_global $core/sound/channel3/Channel3.lengthCounter
    ;;@ core/sound/channel3.ts:237:31
    (i32.const 256)
   )
  )
  ;;@ core/sound/channel3.ts:242:13
  (call $core/sound/channel3/Channel3.resetTimer)
  ;;@ core/sound/channel3.ts:245:4
  (set_global $core/sound/channel3/Channel3.waveTablePosition
   ;;@ core/sound/channel3.ts:245:33
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:248:4
  (if
   ;;@ core/sound/channel3.ts:248:8
   (i32.eqz
    ;;@ core/sound/channel3.ts:248:9
    (get_global $core/sound/channel3/Channel3.isDacEnabled)
   )
   ;;@ core/sound/channel3.ts:248:32
   (set_global $core/sound/channel3/Channel3.isEnabled
    ;;@ core/sound/channel3.ts:249:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx4 (; 125 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel4.ts:97:4
  (set_global $core/sound/channel4/Channel4.NRx4LengthEnabled
   ;;@ core/sound/channel4.ts:97:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel4.ts:97:48
    (i32.const 6)
    (get_local $0)
   )
  )
 )
 (func $core/sound/channel4/Channel4.trigger (; 126 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel4.ts:221:4
  (set_global $core/sound/channel4/Channel4.isEnabled
   ;;@ core/sound/channel4.ts:221:25
   (i32.const 1)
  )
  ;;@ core/sound/channel4.ts:222:4
  (if
   (i32.eqz
    ;;@ core/sound/channel4.ts:222:8
    (get_global $core/sound/channel4/Channel4.lengthCounter)
   )
   ;;@ core/sound/channel4.ts:222:38
   (set_global $core/sound/channel4/Channel4.lengthCounter
    ;;@ core/sound/channel4.ts:223:31
    (i32.const 64)
   )
  )
  ;;@ core/sound/channel4.ts:227:4
  (set_global $core/sound/channel4/Channel4.frequencyTimer
   ;;@ core/sound/channel4.ts:227:39
   (call $core/sound/channel4/Channel4.getNoiseChannelFrequencyPeriod)
  )
  ;;@ core/sound/channel4.ts:229:4
  (set_global $core/sound/channel4/Channel4.envelopeCounter
   ;;@ core/sound/channel4.ts:229:31
   (get_global $core/sound/channel4/Channel4.NRx2EnvelopePeriod)
  )
  ;;@ core/sound/channel4.ts:231:4
  (set_global $core/sound/channel4/Channel4.volume
   ;;@ core/sound/channel4.ts:231:22
   (get_global $core/sound/channel4/Channel4.NRx2StartingVolume)
  )
  ;;@ core/sound/channel4.ts:234:4
  (set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   ;;@ core/sound/channel4.ts:234:43
   (i32.const 32767)
  )
  ;;@ core/sound/channel4.ts:237:4
  (if
   ;;@ core/sound/channel4.ts:237:8
   (i32.eqz
    ;;@ core/sound/channel4.ts:237:9
    (get_global $core/sound/channel4/Channel4.isDacEnabled)
   )
   ;;@ core/sound/channel4.ts:237:32
   (set_global $core/sound/channel4/Channel4.isEnabled
    ;;@ core/sound/channel4.ts:238:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/sound/Sound.updateNR50 (; 127 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/sound.ts:53:4
  (set_global $core/sound/sound/Sound.NR50LeftMixerVolume
   ;;@ core/sound/sound.ts:53:32
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/sound.ts:53:42
     (i32.const 4)
    )
    ;;@ core/sound/sound.ts:53:47
    (i32.const 7)
   )
  )
  ;;@ core/sound/sound.ts:54:4
  (set_global $core/sound/sound/Sound.NR50RightMixerVolume
   ;;@ core/sound/sound.ts:54:33
   (i32.and
    (get_local $0)
    ;;@ core/sound/sound.ts:54:41
    (i32.const 7)
   )
  )
 )
 (func $core/sound/sound/Sound.updateNR51 (; 128 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/sound.ts:68:4
  (set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:68:46
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:68:61
    (i32.const 7)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:69:4
  (set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:69:46
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:69:61
    (i32.const 6)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:70:4
  (set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:70:46
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:70:61
    (i32.const 5)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:71:4
  (set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
   ;;@ core/sound/sound.ts:71:46
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:71:61
    (i32.const 4)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:72:4
  (set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
   ;;@ core/sound/sound.ts:72:47
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:72:62
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:73:4
  (set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
   ;;@ core/sound/sound.ts:73:47
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:73:62
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:74:4
  (set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
   ;;@ core/sound/sound.ts:74:47
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:74:62
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:75:4
  (set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
   ;;@ core/sound/sound.ts:75:47
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:75:62
    (i32.const 0)
    (get_local $0)
   )
  )
 )
 (func $core/sound/sound/Sound.updateNR52 (; 129 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/sound.ts:82:4
  (set_global $core/sound/sound/Sound.NR52IsSoundEnabled
   ;;@ core/sound/sound.ts:82:31
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/sound.ts:82:46
    (i32.const 7)
    (get_local $0)
   )
  )
 )
 (func $core/sound/registers/SoundRegisterWriteTraps (; 130 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (block $folding-inner0
   ;;@ core/sound/registers.ts:16:6
   (if
    (tee_local $2
     (i32.ne
      (get_local $0)
      (i32.const 65318)
     )
    )
    (set_local $2
     ;;@ core/sound/registers.ts:16:45
     (i32.eqz
      ;;@ core/sound/registers.ts:16:46
      (get_global $core/sound/sound/Sound.NR52IsSoundEnabled)
     )
    )
   )
   ;;@ core/sound/registers.ts:16:2
   (if
    (get_local $2)
    (return
     (i32.const 0)
    )
   )
   ;;@ core/sound/registers.ts:25:2
   (block $break|0
    (block $case20|0
     (block $case19|0
      (block $case18|0
       (block $case17|0
        (block $case16|0
         (block $case15|0
          (block $case14|0
           (block $case13|0
            (block $case12|0
             (block $case11|0
              (block $case10|0
               (block $case9|0
                (block $case8|0
                 (block $case7|0
                  (block $case6|0
                   (block $case5|0
                    (block $case4|0
                     (block $case3|0
                      (block $case2|0
                       (block $case1|0
                        (if
                         (i32.ne
                          (tee_local $2
                           (get_local $0)
                          )
                          (i32.const 65296)
                         )
                         (block
                          (block $tablify|0
                           (br_table $case2|0 $case6|0 $case10|0 $case14|0 $tablify|0 $case3|0 $case7|0 $case11|0 $case15|0 $case1|0 $case4|0 $case8|0 $case12|0 $case16|0 $tablify|0 $case5|0 $case9|0 $case13|0 $case17|0 $case18|0 $case19|0 $case20|0 $tablify|0
                            (i32.sub
                             (get_local $2)
                             (i32.const 65297)
                            )
                           )
                          )
                          (br $break|0)
                         )
                        )
                        ;;@ core/sound/registers.ts:28:15
                        (call $core/sound/channel1/Channel1.updateNRx0
                         (get_local $1)
                        )
                        (br $folding-inner0)
                       )
                       ;;@ core/sound/registers.ts:31:15
                       (call $core/sound/channel3/Channel3.updateNRx0
                        (get_local $1)
                       )
                       (br $folding-inner0)
                      )
                      ;;@ core/sound/registers.ts:35:15
                      (call $core/sound/channel1/Channel1.updateNRx1
                       (get_local $1)
                      )
                      (br $folding-inner0)
                     )
                     ;;@ core/sound/registers.ts:38:15
                     (call $core/sound/channel2/Channel2.updateNRx1
                      (get_local $1)
                     )
                     (br $folding-inner0)
                    )
                    ;;@ core/sound/registers.ts:41:15
                    (call $core/sound/channel3/Channel3.updateNRx1
                     (get_local $1)
                    )
                    (br $folding-inner0)
                   )
                   ;;@ core/sound/registers.ts:44:15
                   (call $core/sound/channel4/Channel4.updateNRx1
                    (get_local $1)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/sound/registers.ts:48:15
                  (call $core/sound/channel1/Channel1.updateNRx2
                   (get_local $1)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/sound/registers.ts:51:15
                 (call $core/sound/channel2/Channel2.updateNRx2
                  (get_local $1)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/sound/registers.ts:56:6
                (set_global $core/sound/channel3/Channel3.volumeCodeChanged
                 ;;@ core/sound/registers.ts:56:35
                 (i32.const 1)
                )
                ;;@ core/sound/registers.ts:57:15
                (call $core/sound/channel3/Channel3.updateNRx2
                 (get_local $1)
                )
                (br $folding-inner0)
               )
               ;;@ core/sound/registers.ts:60:15
               (call $core/sound/channel4/Channel4.updateNRx2
                (get_local $1)
               )
               (br $folding-inner0)
              )
              ;;@ core/sound/registers.ts:64:15
              (call $core/sound/channel1/Channel1.updateNRx3
               (get_local $1)
              )
              (br $folding-inner0)
             )
             ;;@ core/sound/registers.ts:67:15
             (call $core/sound/channel2/Channel2.updateNRx3
              (get_local $1)
             )
             (br $folding-inner0)
            )
            ;;@ core/sound/registers.ts:70:15
            (call $core/sound/channel3/Channel3.updateNRx3
             (get_local $1)
            )
            (br $folding-inner0)
           )
           ;;@ core/sound/registers.ts:73:15
           (call $core/sound/channel4/Channel4.updateNRx3
            (get_local $1)
           )
           (br $folding-inner0)
          )
          ;;@ core/sound/registers.ts:77:6
          (if
           ;;@ core/sound/registers.ts:77:10
           (call $core/helpers/index/checkBitOnByte
            ;;@ core/sound/registers.ts:77:25
            (i32.const 7)
            (get_local $1)
           )
           ;;@ core/sound/registers.ts:77:36
           (block
            ;;@ core/sound/registers.ts:78:17
            (call $core/sound/channel1/Channel1.updateNRx4
             (get_local $1)
            )
            ;;@ core/sound/registers.ts:79:17
            (call $core/sound/channel1/Channel1.trigger)
           )
          )
          (br $folding-inner0)
         )
         ;;@ core/sound/registers.ts:83:6
         (if
          ;;@ core/sound/registers.ts:83:10
          (call $core/helpers/index/checkBitOnByte
           ;;@ core/sound/registers.ts:83:25
           (i32.const 7)
           (get_local $1)
          )
          ;;@ core/sound/registers.ts:83:36
          (block
           ;;@ core/sound/registers.ts:84:17
           (call $core/sound/channel2/Channel2.updateNRx4
            (get_local $1)
           )
           ;;@ core/sound/registers.ts:85:17
           (call $core/sound/channel2/Channel2.trigger)
          )
         )
         (br $folding-inner0)
        )
        ;;@ core/sound/registers.ts:89:6
        (if
         ;;@ core/sound/registers.ts:89:10
         (call $core/helpers/index/checkBitOnByte
          ;;@ core/sound/registers.ts:89:25
          (i32.const 7)
          (get_local $1)
         )
         ;;@ core/sound/registers.ts:89:36
         (block
          ;;@ core/sound/registers.ts:90:17
          (call $core/sound/channel3/Channel3.updateNRx4
           (get_local $1)
          )
          ;;@ core/sound/registers.ts:91:17
          (call $core/sound/channel3/Channel3.trigger)
         )
        )
        (br $folding-inner0)
       )
       ;;@ core/sound/registers.ts:95:6
       (if
        ;;@ core/sound/registers.ts:95:10
        (call $core/helpers/index/checkBitOnByte
         ;;@ core/sound/registers.ts:95:25
         (i32.const 7)
         (get_local $1)
        )
        ;;@ core/sound/registers.ts:95:36
        (block
         ;;@ core/sound/registers.ts:96:17
         (call $core/sound/channel4/Channel4.updateNRx4
          (get_local $1)
         )
         ;;@ core/sound/registers.ts:97:17
         (call $core/sound/channel4/Channel4.trigger)
        )
       )
       (br $folding-inner0)
      )
      ;;@ core/sound/registers.ts:102:12
      (call $core/sound/sound/Sound.updateNR50
       (get_local $1)
      )
      ;;@ core/sound/registers.ts:103:6
      (set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
       ;;@ core/sound/registers.ts:103:44
       (i32.const 1)
      )
      (br $folding-inner0)
     )
     ;;@ core/sound/registers.ts:107:12
     (call $core/sound/sound/Sound.updateNR51
      (get_local $1)
     )
     ;;@ core/sound/registers.ts:108:6
     (set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
      ;;@ core/sound/registers.ts:108:45
      (i32.const 1)
     )
     (br $folding-inner0)
    )
    ;;@ core/sound/registers.ts:112:12
    (call $core/sound/sound/Sound.updateNR52
     (get_local $1)
    )
    ;;@ core/sound/registers.ts:113:6
    (if
     ;;@ core/sound/registers.ts:113:10
     (i32.eqz
      ;;@ core/sound/registers.ts:113:11
      (call $core/helpers/index/checkBitOnByte
       ;;@ core/sound/registers.ts:113:26
       (i32.const 7)
       (get_local $1)
      )
     )
     ;;@ core/sound/registers.ts:113:37
     (block $break|1
      ;;@ core/sound/registers.ts:114:13
      (set_local $2
       ;;@ core/sound/registers.ts:114:26
       (i32.const 65296)
      )
      (loop $repeat|1
       (br_if $break|1
        ;;@ core/sound/registers.ts:114:34
        (i32.ge_s
         (get_local $2)
         ;;@ core/sound/registers.ts:114:38
         (i32.const 65318)
        )
       )
       ;;@ core/sound/registers.ts:115:10
       (call $core/memory/store/eightBitStoreIntoGBMemory
        (get_local $2)
        ;;@ core/sound/registers.ts:115:39
        (i32.const 0)
       )
       ;;@ core/sound/registers.ts:114:46
       (set_local $2
        (i32.add
         (get_local $2)
         (i32.const 1)
        )
       )
       (br $repeat|1)
      )
     )
    )
    (br $folding-inner0)
   )
   (return
    (i32.const 1)
   )
  )
  ;;@ core/sound/registers.ts:29:13
  (i32.const 1)
 )
 (func $core/graphics/lcd/Lcd.updateLcdControl (; 131 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/graphics/lcd.ts:50:4
  (set_global $core/graphics/lcd/Lcd.enabled
   ;;@ core/graphics/lcd.ts:50:18
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:50:33
    (i32.const 7)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:51:4
  (set_global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
   ;;@ core/graphics/lcd.ts:51:37
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:51:52
    (i32.const 6)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:52:4
  (set_global $core/graphics/lcd/Lcd.windowDisplayEnabled
   ;;@ core/graphics/lcd.ts:52:31
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:52:46
    (i32.const 5)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:53:4
  (set_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect
   ;;@ core/graphics/lcd.ts:53:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:53:48
    (i32.const 4)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:54:4
  (set_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
   ;;@ core/graphics/lcd.ts:54:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:54:48
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:55:4
  (set_global $core/graphics/lcd/Lcd.tallSpriteSize
   ;;@ core/graphics/lcd.ts:55:25
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:55:40
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:56:4
  (set_global $core/graphics/lcd/Lcd.spriteDisplayEnable
   ;;@ core/graphics/lcd.ts:56:30
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:56:45
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:57:4
  (set_global $core/graphics/lcd/Lcd.bgDisplayEnabled
   ;;@ core/graphics/lcd.ts:57:27
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:57:42
    (i32.const 0)
    (get_local $0)
   )
  )
 )
 (func $core/memory/dma/startDmaTransfer (; 132 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/memory/dma.ts:27:2
  (set_local $1
   ;;@ core/memory/dma.ts:27:18
   (i32.shl
    (get_local $0)
    ;;@ core/memory/dma.ts:27:35
    (i32.const 8)
   )
  )
  ;;@ core/memory/dma.ts:29:2
  (block $break|0
   ;;@ core/memory/dma.ts:29:7
   (set_local $0
    ;;@ core/memory/dma.ts:29:20
    (i32.const 0)
   )
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/memory/dma.ts:29:23
     (i32.gt_s
      (get_local $0)
      ;;@ core/memory/dma.ts:29:28
      (i32.const 159)
     )
    )
    ;;@ core/memory/dma.ts:32:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/memory/dma.ts:31:40
     (i32.add
      (get_local $0)
      (i32.const 65024)
     )
     ;;@ core/memory/dma.ts:30:37
     (call $core/memory/load/eightBitLoadFromGBMemory
      ;;@ core/memory/dma.ts:30:62
      (i32.add
       (get_local $1)
       (get_local $0)
      )
     )
    )
    ;;@ core/memory/dma.ts:29:34
    (set_local $0
     (i32.add
      (get_local $0)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
  ;;@ core/memory/dma.ts:37:2
  (set_global $core/memory/memory/Memory.DMACycles
   ;;@ core/memory/dma.ts:37:21
   (i32.const 644)
  )
 )
 (func $core/memory/dma/getHdmaSourceFromMemory (; 133 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/memory/dma.ts:162:15
  (i32.and
   ;;@ core/memory/dma.ts:158:24
   (call $core/helpers/index/concatenateBytes
    ;;@ core/memory/dma.ts:155:28
    (call $core/memory/load/eightBitLoadFromGBMemory
     ;;@ core/memory/dma.ts:155:53
     (get_global $core/memory/memory/Memory.memoryLocationHdmaSourceHigh)
    )
    ;;@ core/memory/dma.ts:156:27
    (call $core/memory/load/eightBitLoadFromGBMemory
     ;;@ core/memory/dma.ts:156:52
     (get_global $core/memory/memory/Memory.memoryLocationHdmaSourceLow)
    )
   )
   ;;@ core/memory/dma.ts:162:28
   (i32.const 65520)
  )
 )
 (func $core/memory/dma/getHdmaDestinationFromMemory (; 134 ;) (; has Stack IR ;) (type $i) (result i32)
  (i32.add
   ;;@ core/memory/dma.ts:179:20
   (i32.and
    ;;@ core/memory/dma.ts:173:29
    (call $core/helpers/index/concatenateBytes
     ;;@ core/memory/dma.ts:170:33
     (call $core/memory/load/eightBitLoadFromGBMemory
      ;;@ core/memory/dma.ts:170:58
      (get_global $core/memory/memory/Memory.memoryLocationHdmaDestinationHigh)
     )
     ;;@ core/memory/dma.ts:171:32
     (call $core/memory/load/eightBitLoadFromGBMemory
      ;;@ core/memory/dma.ts:171:57
      (get_global $core/memory/memory/Memory.memoryLocationHdmaDestinationLow)
     )
    )
    ;;@ core/memory/dma.ts:179:38
    (i32.const 8176)
   )
   (i32.const 32768)
  )
 )
 (func $core/memory/dma/startHdmaTransfer (; 135 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  ;;@ core/memory/dma.ts:44:2
  (if
   ;;@ core/memory/dma.ts:44:6
   (i32.eqz
    ;;@ core/memory/dma.ts:44:7
    (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   )
   (return)
  )
  ;;@ core/memory/dma.ts:49:2
  (if
   (tee_local $1
    ;;@ core/memory/dma.ts:49:6
    (if (result i32)
     (get_global $core/memory/memory/Memory.isHblankHdmaActive)
     ;;@ core/memory/dma.ts:49:35
     (i32.eqz
      ;;@ core/memory/dma.ts:49:36
      (call $core/helpers/index/checkBitOnByte
       ;;@ core/memory/dma.ts:49:51
       (i32.const 7)
       (get_local $0)
      )
     )
     (get_global $core/memory/memory/Memory.isHblankHdmaActive)
    )
   )
   ;;@ core/memory/dma.ts:49:83
   (block
    ;;@ core/memory/dma.ts:51:4
    (set_global $core/memory/memory/Memory.isHblankHdmaActive
     ;;@ core/memory/dma.ts:51:32
     (i32.const 0)
    )
    ;;@ core/memory/dma.ts:52:4
    (set_local $1
     ;;@ core/memory/dma.ts:52:26
     (call $core/memory/load/eightBitLoadFromGBMemory
      ;;@ core/memory/dma.ts:52:51
      (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
     )
    )
    ;;@ core/memory/dma.ts:53:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/memory/dma.ts:53:30
     (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
     ;;@ core/memory/dma.ts:53:64
     (call $core/helpers/index/setBitOnByte
      ;;@ core/memory/dma.ts:53:77
      (i32.const 7)
      (get_local $1)
     )
    )
    ;;@ core/memory/dma.ts:54:4
    (return)
   )
  )
  ;;@ core/memory/dma.ts:58:2
  (set_local $1
   ;;@ core/memory/dma.ts:58:24
   (call $core/memory/dma/getHdmaSourceFromMemory)
  )
  ;;@ core/memory/dma.ts:59:2
  (set_local $2
   ;;@ core/memory/dma.ts:59:29
   (call $core/memory/dma/getHdmaDestinationFromMemory)
  )
  ;;@ core/memory/dma.ts:65:2
  (set_local $3
   ;;@ core/memory/dma.ts:65:19
   (i32.shl
    (i32.add
     ;;@ core/memory/dma.ts:64:28
     (call $core/helpers/index/resetBitOnByte
      ;;@ core/memory/dma.ts:64:43
      (i32.const 7)
      (get_local $0)
     )
     ;;@ core/memory/dma.ts:65:37
     (i32.const 1)
    )
    ;;@ core/memory/dma.ts:65:42
    (i32.const 4)
   )
  )
  ;;@ core/memory/dma.ts:68:2
  (if
   ;;@ core/memory/dma.ts:68:6
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/memory/dma.ts:68:21
    (i32.const 7)
    (get_local $0)
   )
   ;;@ core/memory/dma.ts:68:53
   (block
    ;;@ core/memory/dma.ts:70:4
    (set_global $core/memory/memory/Memory.isHblankHdmaActive
     ;;@ core/memory/dma.ts:70:32
     (i32.const 1)
    )
    ;;@ core/memory/dma.ts:71:4
    (set_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
     (get_local $3)
    )
    ;;@ core/memory/dma.ts:72:4
    (set_global $core/memory/memory/Memory.hblankHdmaSource
     (get_local $1)
    )
    ;;@ core/memory/dma.ts:73:4
    (set_global $core/memory/memory/Memory.hblankHdmaDestination
     (get_local $2)
    )
    ;;@ core/memory/dma.ts:79:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/memory/dma.ts:79:30
     (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
     ;;@ core/memory/dma.ts:79:64
     (call $core/helpers/index/resetBitOnByte
      ;;@ core/memory/dma.ts:79:79
      (i32.const 7)
      (get_local $0)
     )
    )
   )
   ;;@ core/memory/dma.ts:80:9
   (block
    ;;@ core/memory/dma.ts:82:4
    (call $core/memory/dma/hdmaTransfer
     (get_local $1)
     (get_local $2)
     (get_local $3)
    )
    ;;@ core/memory/dma.ts:85:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/memory/dma.ts:85:30
     (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
     ;;@ core/memory/dma.ts:85:64
     (i32.const 255)
    )
   )
  )
 )
 (func $core/graphics/palette/storePaletteByteInWasmMemory (; 136 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  ;;@ core/graphics/palette.ts:153:2
  (set_local $3
   ;;@ core/graphics/palette.ts:153:26
   (i32.and
    (get_local $0)
    ;;@ core/graphics/palette.ts:153:45
    (i32.const 63)
   )
  )
  ;;@ core/graphics/palette.ts:156:2
  (if
   (i32.and
    (get_local $2)
    (i32.const 1)
   )
   ;;@ core/graphics/palette.ts:156:16
   (set_local $3
    (i32.sub
     (get_local $3)
     ;;@ core/graphics/palette.ts:157:20
     (i32.const -64)
    )
   )
  )
  ;;@ core/graphics/palette.ts:160:2
  (i32.store8
   ;;@ core/graphics/palette.ts:160:12
   (i32.add
    (get_local $3)
    (i32.const 67584)
   )
   (get_local $1)
  )
 )
 (func $core/graphics/palette/incrementPaletteIndexIfSet (; 137 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/graphics/palette.ts:96:2
  (if
   ;;@ core/graphics/palette.ts:96:6
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/palette.ts:96:21
    (i32.const 7)
    (get_local $0)
   )
   ;;@ core/graphics/palette.ts:102:4
   (call $core/memory/store/eightBitStoreIntoGBMemory
    (get_local $1)
    ;;@ core/graphics/palette.ts:100:19
    (call $core/helpers/index/setBitOnByte
     ;;@ core/graphics/palette.ts:100:32
     (i32.const 7)
     (i32.add
      (get_local $0)
      ;;@ core/graphics/palette.ts:99:20
      (i32.const 1)
     )
    )
   )
  )
 )
 (func $core/graphics/palette/writeColorPaletteToMemory (; 138 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  ;;@ core/graphics/palette.ts:72:6
  (if
   (i32.eqz
    (tee_local $2
     (i32.eq
      (get_local $0)
      ;;@ core/graphics/palette.ts:72:17
      (get_global $core/graphics/palette/Palette.memoryLocationBackgroundPaletteData)
     )
    )
   )
   (set_local $2
    ;;@ core/graphics/palette.ts:72:64
    (i32.eq
     (get_local $0)
     ;;@ core/graphics/palette.ts:72:75
     (get_global $core/graphics/palette/Palette.memoryLocationSpritePaletteData)
    )
   )
  )
  ;;@ core/graphics/palette.ts:72:2
  (if
   (get_local $2)
   ;;@ core/graphics/palette.ts:72:116
   (block
    ;;@ core/graphics/palette.ts:77:4
    (set_local $2
     ;;@ core/graphics/palette.ts:77:19
     (call $core/helpers/index/resetBitOnByte
      ;;@ core/graphics/palette.ts:77:34
      (i32.const 6)
      ;;@ core/graphics/palette.ts:74:28
      (call $core/memory/load/eightBitLoadFromGBMemory
       ;;@ core/graphics/palette.ts:74:53
       (i32.sub
        (get_local $0)
        ;;@ core/graphics/palette.ts:74:62
        (i32.const 1)
       )
      )
     )
    )
    ;;@ core/graphics/palette.ts:81:4
    (if
     ;;@ core/graphics/palette.ts:81:8
     (i32.eq
      (get_local $0)
      ;;@ core/graphics/palette.ts:81:19
      (get_global $core/graphics/palette/Palette.memoryLocationSpritePaletteData)
     )
     ;;@ core/graphics/palette.ts:81:60
     (set_local $3
      ;;@ core/graphics/palette.ts:82:17
      (i32.const 1)
     )
    )
    ;;@ core/graphics/palette.ts:85:4
    (call $core/graphics/palette/storePaletteByteInWasmMemory
     (get_local $2)
     (get_local $1)
     (get_local $3)
    )
    ;;@ core/graphics/palette.ts:87:4
    (call $core/graphics/palette/incrementPaletteIndexIfSet
     (get_local $2)
     ;;@ core/graphics/palette.ts:87:45
     (i32.sub
      (get_local $0)
      ;;@ core/graphics/palette.ts:87:54
      (i32.const 1)
     )
    )
   )
  )
 )
 (func $core/interrupts/interrupts/requestTimerInterrupt (; 139 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:183:2
  (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
   ;;@ core/interrupts/interrupts.ts:183:41
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:184:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 2)
  )
 )
 (func $core/timers/timers/_getTimerCounterMaskBit (; 140 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/timers/timers.ts:267:2
  (block $break|0
   (block $case3|0
    (block $case2|0
     (block $case1|0
      (if
       (get_local $0)
       (block
        (br_if $case1|0
         (i32.eq
          (tee_local $1
           (get_local $0)
          )
          ;;@ core/timers/timers.ts:270:9
          (i32.const 1)
         )
        )
        (br_if $case2|0
         (i32.eq
          (get_local $1)
          ;;@ core/timers/timers.ts:272:9
          (i32.const 2)
         )
        )
        (br_if $case3|0
         (i32.eq
          (get_local $1)
          ;;@ core/timers/timers.ts:274:9
          (i32.const 3)
         )
        )
        (br $break|0)
       )
      )
      ;;@ core/timers/timers.ts:269:13
      (return
       (i32.const 9)
      )
     )
     ;;@ core/timers/timers.ts:271:13
     (return
      (i32.const 3)
     )
    )
    ;;@ core/timers/timers.ts:273:13
    (return
     (i32.const 5)
    )
   )
   ;;@ core/timers/timers.ts:275:13
   (return
    (i32.const 7)
   )
  )
  (i32.const 0)
 )
 (func $core/timers/timers/_checkDividerRegisterFallingEdgeDetector (; 141 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  ;;@ core/timers/timers.ts:256:6
  (if
   (tee_local $0
    (call $core/helpers/index/checkBitOnByte
     ;;@ core/timers/timers.ts:252:2
     (tee_local $2
      ;;@ core/timers/timers.ts:252:28
      (call $core/timers/timers/_getTimerCounterMaskBit
       ;;@ core/timers/timers.ts:252:52
       (get_global $core/timers/timers/Timers.timerInputClock)
      )
     )
     (get_local $0)
    )
   )
   (set_local $0
    ;;@ core/timers/timers.ts:256:65
    (i32.eqz
     ;;@ core/timers/timers.ts:256:66
     (call $core/helpers/index/checkBitOnByte
      (get_local $2)
      (get_local $1)
     )
    )
   )
  )
  ;;@ core/timers/timers.ts:256:2
  (if
   (get_local $0)
   (return
    (i32.const 1)
   )
  )
  (i32.const 0)
 )
 (func $core/timers/timers/_incrementTimerCounter (; 142 ;) (; has Stack IR ;) (type $v)
  ;;@ core/timers/timers.ts:236:2
  (set_global $core/timers/timers/Timers.timerCounter
   (i32.add
    (get_global $core/timers/timers/Timers.timerCounter)
    ;;@ core/timers/timers.ts:236:25
    (i32.const 1)
   )
  )
  ;;@ core/timers/timers.ts:237:2
  (if
   ;;@ core/timers/timers.ts:237:6
   (i32.gt_s
    (get_global $core/timers/timers/Timers.timerCounter)
    ;;@ core/timers/timers.ts:237:28
    (i32.const 255)
   )
   ;;@ core/timers/timers.ts:237:33
   (block
    ;;@ core/timers/timers.ts:241:4
    (set_global $core/timers/timers/Timers.timerCounterOverflowDelay
     ;;@ core/timers/timers.ts:241:39
     (i32.const 1)
    )
    ;;@ core/timers/timers.ts:242:4
    (set_global $core/timers/timers/Timers.timerCounter
     ;;@ core/timers/timers.ts:242:26
     (i32.const 0)
    )
   )
  )
 )
 (func $core/timers/timers/updateTimers (; 143 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (loop $continue|0
   (if
    ;;@ core/timers/timers.ts:206:9
    (i32.lt_s
     (get_local $1)
     (get_local $0)
    )
    (block
     ;;@ core/timers/timers.ts:207:4
     (set_local $2
      ;;@ core/timers/timers.ts:207:34
      (get_global $core/timers/timers/Timers.dividerRegister)
     )
     ;;@ core/timers/timers.ts:208:4
     (set_local $1
      (i32.add
       (get_local $1)
       ;;@ core/timers/timers.ts:208:23
       (i32.const 4)
      )
     )
     ;;@ core/timers/timers.ts:209:4
     (set_global $core/timers/timers/Timers.dividerRegister
      (i32.add
       (get_global $core/timers/timers/Timers.dividerRegister)
       ;;@ core/timers/timers.ts:209:30
       (i32.const 4)
      )
     )
     ;;@ core/timers/timers.ts:211:4
     (if
      ;;@ core/timers/timers.ts:211:8
      (i32.gt_s
       (get_global $core/timers/timers/Timers.dividerRegister)
       ;;@ core/timers/timers.ts:211:33
       (i32.const 65535)
      )
      ;;@ core/timers/timers.ts:211:41
      (set_global $core/timers/timers/Timers.dividerRegister
       (i32.sub
        ;;@ core/timers/timers.ts:212:6
        (get_global $core/timers/timers/Timers.dividerRegister)
        ;;@ core/timers/timers.ts:212:32
        (i32.const 65536)
       )
      )
     )
     ;;@ core/timers/timers.ts:215:4
     (if
      ;;@ core/timers/timers.ts:215:8
      (get_global $core/timers/timers/Timers.timerEnabled)
      ;;@ core/timers/timers.ts:215:29
      (block
       ;;@ core/timers/timers.ts:216:6
       (if
        ;;@ core/timers/timers.ts:216:10
        (get_global $core/timers/timers/Timers.timerCounterOverflowDelay)
        ;;@ core/timers/timers.ts:216:44
        (block
         ;;@ core/timers/timers.ts:217:8
         (set_global $core/timers/timers/Timers.timerCounter
          ;;@ core/timers/timers.ts:217:30
          (get_global $core/timers/timers/Timers.timerModulo)
         )
         ;;@ core/timers/timers.ts:219:8
         (call $core/interrupts/interrupts/requestTimerInterrupt)
         ;;@ core/timers/timers.ts:220:8
         (set_global $core/timers/timers/Timers.timerCounterOverflowDelay
          ;;@ core/timers/timers.ts:220:43
          (i32.const 0)
         )
         ;;@ core/timers/timers.ts:221:8
         (set_global $core/timers/timers/Timers.timerCounterWasReset
          ;;@ core/timers/timers.ts:221:38
          (i32.const 1)
         )
        )
        ;;@ core/timers/timers.ts:222:13
        (if
         ;;@ core/timers/timers.ts:222:17
         (get_global $core/timers/timers/Timers.timerCounterWasReset)
         ;;@ core/timers/timers.ts:222:46
         (set_global $core/timers/timers/Timers.timerCounterWasReset
          ;;@ core/timers/timers.ts:223:38
          (i32.const 0)
         )
        )
       )
       ;;@ core/timers/timers.ts:226:6
       (if
        ;;@ core/timers/timers.ts:226:10
        (call $core/timers/timers/_checkDividerRegisterFallingEdgeDetector
         (get_local $2)
         ;;@ core/timers/timers.ts:226:71
         (get_global $core/timers/timers/Timers.dividerRegister)
        )
        ;;@ core/timers/timers.ts:226:96
        (call $core/timers/timers/_incrementTimerCounter)
       )
      )
     )
     (br $continue|0)
    )
   )
  )
 )
 (func $core/timers/timers/batchProcessTimers (; 144 ;) (; has Stack IR ;) (type $v)
  ;;@ core/timers/timers.ts:199:2
  (call $core/timers/timers/updateTimers
   ;;@ core/timers/timers.ts:199:15
   (get_global $core/timers/timers/Timers.currentCycles)
  )
  ;;@ core/timers/timers.ts:200:2
  (set_global $core/timers/timers/Timers.currentCycles
   ;;@ core/timers/timers.ts:200:25
   (i32.const 0)
  )
 )
 (func $core/timers/timers/Timers.updateDividerRegister (; 145 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/timers/timers.ts:34:4
  (set_local $0
   ;;@ core/timers/timers.ts:34:34
   (get_global $core/timers/timers/Timers.dividerRegister)
  )
  ;;@ core/timers/timers.ts:36:4
  (set_global $core/timers/timers/Timers.dividerRegister
   ;;@ core/timers/timers.ts:36:29
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:37:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65284)
   ;;@ core/timers/timers.ts:37:68
   (i32.const 0)
  )
  ;;@ core/timers/timers.ts:39:4
  (if
   (tee_local $0
    ;;@ core/timers/timers.ts:39:8
    (if (result i32)
     (get_global $core/timers/timers/Timers.timerEnabled)
     ;;@ core/timers/timers.ts:39:31
     (call $core/timers/timers/_checkDividerRegisterFallingEdgeDetector
      (get_local $0)
      ;;@ core/timers/timers.ts:39:92
      (get_global $core/timers/timers/Timers.dividerRegister)
     )
     (get_global $core/timers/timers/Timers.timerEnabled)
    )
   )
   ;;@ core/timers/timers.ts:39:117
   (call $core/timers/timers/_incrementTimerCounter)
  )
 )
 (func $core/timers/timers/Timers.updateTimerCounter (; 146 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/timers/timers.ts:54:4
  (if
   ;;@ core/timers/timers.ts:54:8
   (get_global $core/timers/timers/Timers.timerEnabled)
   ;;@ core/timers/timers.ts:54:29
   (block
    ;;@ core/timers/timers.ts:56:6
    (if
     ;;@ core/timers/timers.ts:56:10
     (get_global $core/timers/timers/Timers.timerCounterWasReset)
     (return)
    )
    ;;@ core/timers/timers.ts:63:6
    (if
     ;;@ core/timers/timers.ts:63:10
     (get_global $core/timers/timers/Timers.timerCounterOverflowDelay)
     ;;@ core/timers/timers.ts:63:44
     (set_global $core/timers/timers/Timers.timerCounterOverflowDelay
      ;;@ core/timers/timers.ts:64:43
      (i32.const 0)
     )
    )
   )
  )
  ;;@ core/timers/timers.ts:68:4
  (set_global $core/timers/timers/Timers.timerCounter
   (get_local $0)
  )
 )
 (func $core/timers/timers/Timers.updateTimerModulo (; 147 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/timers/timers.ts:80:4
  (set_global $core/timers/timers/Timers.timerModulo
   (get_local $0)
  )
  ;;@ core/timers/timers.ts:84:4
  (if
   ;;@ core/timers/timers.ts:84:8
   (if (result i32)
    (get_global $core/timers/timers/Timers.timerEnabled)
    ;;@ core/timers/timers.ts:84:31
    (get_global $core/timers/timers/Timers.timerCounterWasReset)
    (get_global $core/timers/timers/Timers.timerEnabled)
   )
   ;;@ core/timers/timers.ts:84:60
   (block
    ;;@ core/timers/timers.ts:85:6
    (set_global $core/timers/timers/Timers.timerCounter
     ;;@ core/timers/timers.ts:85:28
     (get_global $core/timers/timers/Timers.timerModulo)
    )
    ;;@ core/timers/timers.ts:86:6
    (set_global $core/timers/timers/Timers.timerCounterWasReset
     ;;@ core/timers/timers.ts:86:36
     (i32.const 0)
    )
   )
  )
 )
 (func $core/timers/timers/Timers.updateTimerControl (; 148 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/timers/timers.ts:106:4
  (set_local $1
   ;;@ core/timers/timers.ts:106:35
   (get_global $core/timers/timers/Timers.timerEnabled)
  )
  ;;@ core/timers/timers.ts:107:4
  (set_global $core/timers/timers/Timers.timerEnabled
   ;;@ core/timers/timers.ts:107:26
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/timers/timers.ts:107:41
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/timers/timers.ts:108:4
  (set_local $2
   ;;@ core/timers/timers.ts:108:34
   (i32.and
    (get_local $0)
    ;;@ core/timers/timers.ts:108:42
    (i32.const 3)
   )
  )
  ;;@ core/timers/timers.ts:112:4
  (if
   ;;@ core/timers/timers.ts:112:8
   (i32.eqz
    (get_local $1)
   )
   ;;@ core/timers/timers.ts:112:26
   (block
    ;;@ core/timers/timers.ts:113:6
    (set_local $0
     ;;@ core/timers/timers.ts:113:40
     (call $core/timers/timers/_getTimerCounterMaskBit
      ;;@ core/timers/timers.ts:113:64
      (get_global $core/timers/timers/Timers.timerInputClock)
     )
    )
    ;;@ core/timers/timers.ts:114:6
    (set_local $1
     ;;@ core/timers/timers.ts:114:40
     (call $core/timers/timers/_getTimerCounterMaskBit
      (get_local $2)
     )
    )
    ;;@ core/timers/timers.ts:117:6
    (if
     ;;@ core/timers/timers.ts:117:10
     (get_global $core/timers/timers/Timers.timerEnabled)
     ;;@ core/timers/timers.ts:117:31
     (set_local $0
      ;;@ core/timers/timers.ts:118:38
      (call $core/helpers/index/checkBitOnByte
       (get_local $0)
       ;;@ core/timers/timers.ts:118:77
       (get_global $core/timers/timers/Timers.dividerRegister)
      )
     )
     ;;@ core/timers/timers.ts:121:10
     (if
      (tee_local $0
       (call $core/helpers/index/checkBitOnByte
        (get_local $0)
        ;;@ core/timers/timers.ts:121:49
        (get_global $core/timers/timers/Timers.dividerRegister)
       )
      )
      (set_local $0
       ;;@ core/timers/timers.ts:121:76
       (call $core/helpers/index/checkBitOnByte
        (get_local $1)
        ;;@ core/timers/timers.ts:121:115
        (get_global $core/timers/timers/Timers.dividerRegister)
       )
      )
     )
    )
    ;;@ core/timers/timers.ts:124:6
    (if
     (get_local $0)
     ;;@ core/timers/timers.ts:124:39
     (call $core/timers/timers/_incrementTimerCounter)
    )
   )
  )
  ;;@ core/timers/timers.ts:129:4
  (set_global $core/timers/timers/Timers.timerInputClock
   (get_local $2)
  )
 )
 (func $core/joypad/joypad/Joypad.updateJoypad (; 149 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/joypad/joypad.ts:45:4
  (set_global $core/joypad/joypad/Joypad.joypadRegisterFlipped
   ;;@ core/joypad/joypad.ts:45:35
   (i32.xor
    (get_local $0)
    ;;@ core/joypad/joypad.ts:45:43
    (i32.const 255)
   )
  )
  ;;@ core/joypad/joypad.ts:46:4
  (set_global $core/joypad/joypad/Joypad.isDpadType
   ;;@ core/joypad/joypad.ts:46:24
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/joypad/joypad.ts:46:39
    (i32.const 4)
    ;;@ core/joypad/joypad.ts:46:42
    (get_global $core/joypad/joypad/Joypad.joypadRegisterFlipped)
   )
  )
  ;;@ core/joypad/joypad.ts:47:4
  (set_global $core/joypad/joypad/Joypad.isButtonType
   ;;@ core/joypad/joypad.ts:47:26
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/joypad/joypad.ts:47:41
    (i32.const 5)
    ;;@ core/joypad/joypad.ts:47:44
    (get_global $core/joypad/joypad/Joypad.joypadRegisterFlipped)
   )
  )
 )
 (func $core/interrupts/interrupts/Interrupts.updateInterruptRequested (; 150 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/interrupts/interrupts.ts:49:4
  (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
   ;;@ core/interrupts/interrupts.ts:49:44
   (call $core/helpers/index/checkBitOnByte
    (i32.const 0)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:50:4
  (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
   ;;@ core/interrupts/interrupts.ts:50:41
   (call $core/helpers/index/checkBitOnByte
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:51:4
  (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
   ;;@ core/interrupts/interrupts.ts:51:43
   (call $core/helpers/index/checkBitOnByte
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:52:4
  (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
   ;;@ core/interrupts/interrupts.ts:52:44
   (call $core/helpers/index/checkBitOnByte
    (i32.const 4)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:54:4
  (set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   (get_local $0)
  )
 )
 (func $core/interrupts/interrupts/Interrupts.updateInterruptEnabled (; 151 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/interrupts/interrupts.ts:33:4
  (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:33:42
   (call $core/helpers/index/checkBitOnByte
    (i32.const 0)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:34:4
  (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:34:39
   (call $core/helpers/index/checkBitOnByte
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:35:4
  (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:35:41
   (call $core/helpers/index/checkBitOnByte
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:36:4
  (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:36:42
   (call $core/helpers/index/checkBitOnByte
    (i32.const 4)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:38:4
  (set_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
   (get_local $0)
  )
 )
 (func $core/memory/writeTraps/checkWriteTraps (; 152 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (block $folding-inner1
   (block $folding-inner0
    ;;@ core/memory/writeTraps.ts:22:2
    (if
     ;;@ core/memory/writeTraps.ts:22:6
     (i32.lt_s
      (get_local $0)
      (i32.const 32768)
     )
     ;;@ core/memory/writeTraps.ts:22:33
     (block
      ;;@ core/memory/writeTraps.ts:23:4
      (call $core/memory/banking/handleBanking
       (get_local $0)
       (get_local $1)
      )
      (br $folding-inner1)
     )
    )
    ;;@ core/memory/writeTraps.ts:29:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 32768)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:29:36
      (i32.lt_s
       (get_local $0)
       (i32.const 40960)
      )
     )
    )
    (br_if $folding-inner0
     (get_local $2)
    )
    ;;@ core/memory/writeTraps.ts:48:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 57344)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:48:42
      (i32.lt_s
       (get_local $0)
       (i32.const 65024)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:48:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:48:83
     (block
      ;;@ core/memory/writeTraps.ts:50:4
      (call $core/memory/store/eightBitStoreIntoGBMemory
       ;;@ core/memory/writeTraps.ts:49:26
       (i32.add
        (get_local $0)
        ;;@ core/memory/writeTraps.ts:49:35
        (i32.const -8192)
       )
       (get_local $1)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:59:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65024)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:59:50
      (i32.le_s
       (get_local $0)
       (i32.const 65183)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:59:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:59:102
     (block
      (br_if $folding-inner1
       ;;@ core/memory/writeTraps.ts:62:8
       (i32.lt_s
        (get_global $core/graphics/lcd/Lcd.currentLcdMode)
        ;;@ core/memory/writeTraps.ts:62:29
        (i32.const 2)
       )
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:72:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65184)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:72:49
      (i32.le_s
       (get_local $0)
       (i32.const 65279)
      )
     )
    )
    (br_if $folding-inner1
     (get_local $2)
    )
    ;;@ core/memory/writeTraps.ts:78:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:78:16
       (i32.const 65296)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:78:26
      (i32.le_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:78:36
       (i32.const 65318)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:78:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:78:44
     (block
      ;;@ core/memory/writeTraps.ts:79:4
      (call $core/sound/sound/batchProcessAudio)
      ;;@ core/memory/writeTraps.ts:80:48
      (return
       ;;@ core/memory/writeTraps.ts:80:11
       (call $core/sound/registers/SoundRegisterWriteTraps
        (get_local $0)
        (get_local $1)
       )
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:85:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:85:16
       (i32.const 65328)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:85:26
      (i32.le_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:85:36
       (i32.const 65343)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:85:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:85:44
     (call $core/sound/sound/batchProcessAudio)
    )
    ;;@ core/memory/writeTraps.ts:90:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65344)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:90:48
      (i32.le_s
       (get_local $0)
       (i32.const 65355)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:90:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:90:90
     (block
      ;;@ core/memory/writeTraps.ts:94:4
      (if
       ;;@ core/memory/writeTraps.ts:94:8
       (i32.eq
        (get_local $0)
        (i32.const 65344)
       )
       ;;@ core/memory/writeTraps.ts:94:49
       (block
        ;;@ core/memory/writeTraps.ts:96:10
        (call $core/graphics/lcd/Lcd.updateLcdControl
         (get_local $1)
        )
        (br $folding-inner0)
       )
      )
      ;;@ core/memory/writeTraps.ts:101:4
      (if
       ;;@ core/memory/writeTraps.ts:101:8
       (i32.eq
        (get_local $0)
        (i32.const 65348)
       )
       ;;@ core/memory/writeTraps.ts:101:60
       (block
        ;;@ core/memory/writeTraps.ts:102:6
        (set_global $core/graphics/graphics/Graphics.scanlineRegister
         ;;@ core/memory/writeTraps.ts:102:34
         (i32.const 0)
        )
        ;;@ core/memory/writeTraps.ts:103:6
        (call $core/memory/store/eightBitStoreIntoGBMemory
         (get_local $0)
         ;;@ core/memory/writeTraps.ts:103:40
         (i32.const 0)
        )
        (br $folding-inner1)
       )
      )
      ;;@ core/memory/writeTraps.ts:108:4
      (if
       ;;@ core/memory/writeTraps.ts:108:8
       (i32.eq
        (get_local $0)
        (i32.const 65349)
       )
       ;;@ core/memory/writeTraps.ts:108:57
       (block
        ;;@ core/memory/writeTraps.ts:109:6
        (set_global $core/graphics/lcd/Lcd.coincidenceCompare
         (get_local $1)
        )
        (br $folding-inner0)
       )
      )
      ;;@ core/memory/writeTraps.ts:116:4
      (if
       ;;@ core/memory/writeTraps.ts:116:8
       (i32.eq
        (get_local $0)
        (i32.const 65350)
       )
       ;;@ core/memory/writeTraps.ts:116:55
       (block
        ;;@ core/memory/writeTraps.ts:119:6
        (call $core/memory/dma/startDmaTransfer
         (get_local $1)
        )
        (br $folding-inner0)
       )
      )
      ;;@ core/memory/writeTraps.ts:124:4
      (block $break|0
       (block $case3|0
        (block $case2|0
         (block $case1|0
          (if
           (i32.ne
            (tee_local $2
             (get_local $0)
            )
            (i32.const 65347)
           )
           (block
            (block $tablify|0
             (br_table $case1|0 $tablify|0 $tablify|0 $tablify|0 $tablify|0 $tablify|0 $tablify|0 $tablify|0 $case3|0 $case2|0 $tablify|0
              (i32.sub
               (get_local $2)
               (i32.const 65346)
              )
             )
            )
            (br $break|0)
           )
          )
          ;;@ core/memory/writeTraps.ts:126:8
          (set_global $core/graphics/graphics/Graphics.scrollX
           (get_local $1)
          )
          (br $folding-inner0)
         )
         ;;@ core/memory/writeTraps.ts:129:8
         (set_global $core/graphics/graphics/Graphics.scrollY
          (get_local $1)
         )
         (br $folding-inner0)
        )
        ;;@ core/memory/writeTraps.ts:132:8
        (set_global $core/graphics/graphics/Graphics.windowX
         (get_local $1)
        )
        (br $folding-inner0)
       )
       ;;@ core/memory/writeTraps.ts:135:8
       (set_global $core/graphics/graphics/Graphics.windowY
        (get_local $1)
       )
       (br $folding-inner0)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:144:2
    (if
     ;;@ core/memory/writeTraps.ts:144:6
     (i32.eq
      (get_local $0)
      ;;@ core/memory/writeTraps.ts:144:17
      (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
     )
     ;;@ core/memory/writeTraps.ts:144:51
     (block
      ;;@ core/memory/writeTraps.ts:145:4
      (call $core/memory/dma/startHdmaTransfer
       (get_local $1)
      )
      (br $folding-inner1)
     )
    )
    ;;@ core/memory/writeTraps.ts:151:6
    (if
     (i32.eqz
      (tee_local $2
       (i32.eq
        (get_local $0)
        ;;@ core/memory/writeTraps.ts:151:17
        (get_global $core/memory/memory/Memory.memoryLocationGBCWRAMBank)
       )
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:151:53
      (i32.eq
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:151:64
       (get_global $core/memory/memory/Memory.memoryLocationGBCVRAMBank)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:151:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:151:98
     (if
      ;;@ core/memory/writeTraps.ts:152:8
      (get_global $core/memory/memory/Memory.isHblankHdmaActive)
      (block
       ;;@ core/memory/writeTraps.ts:154:8
       (if
        (tee_local $2
         ;;@ core/memory/writeTraps.ts:154:9
         (i32.ge_s
          (get_global $core/memory/memory/Memory.hblankHdmaSource)
          ;;@ core/memory/writeTraps.ts:154:36
          (i32.const 16384)
         )
        )
        (set_local $2
         ;;@ core/memory/writeTraps.ts:154:46
         (i32.le_s
          (get_global $core/memory/memory/Memory.hblankHdmaSource)
          ;;@ core/memory/writeTraps.ts:154:73
          (i32.const 32767)
         )
        )
       )
       ;;@ core/memory/writeTraps.ts:154:8
       (if
        (i32.eqz
         (get_local $2)
        )
        ;;@ core/memory/writeTraps.ts:155:8
        (if
         (tee_local $2
          ;;@ core/memory/writeTraps.ts:155:9
          (i32.ge_s
           (get_global $core/memory/memory/Memory.hblankHdmaSource)
           ;;@ core/memory/writeTraps.ts:155:36
           (i32.const 53248)
          )
         )
         (set_local $2
          ;;@ core/memory/writeTraps.ts:155:46
          (i32.le_s
           (get_global $core/memory/memory/Memory.hblankHdmaSource)
           ;;@ core/memory/writeTraps.ts:155:73
           (i32.const 57343)
          )
         )
        )
       )
       (br_if $folding-inner1
        (get_local $2)
       )
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:163:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:163:16
       (get_global $core/graphics/palette/Palette.memoryLocationBackgroundPaletteIndex)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:163:64
      (i32.le_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:163:74
       (get_global $core/graphics/palette/Palette.memoryLocationSpritePaletteData)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:163:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:163:115
     (block
      ;;@ core/memory/writeTraps.ts:165:4
      (call $core/graphics/palette/writeColorPaletteToMemory
       (get_local $0)
       (get_local $1)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:170:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65284)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:170:56
      (i32.le_s
       (get_local $0)
       (i32.const 65287)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:170:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:170:101
     (block
      ;;@ core/memory/writeTraps.ts:172:4
      (call $core/timers/timers/batchProcessTimers)
      ;;@ core/memory/writeTraps.ts:174:4
      (block $break|1
       (block $case3|1
        (block $case2|1
         (block $case1|1
          (if
           (i32.ne
            (tee_local $2
             (get_local $0)
            )
            (i32.const 65284)
           )
           (block
            (block $tablify|00
             (br_table $case1|1 $case2|1 $case3|1 $tablify|00
              (i32.sub
               (get_local $2)
               (i32.const 65285)
              )
             )
            )
            (br $break|1)
           )
          )
          ;;@ core/memory/writeTraps.ts:176:15
          (call $core/timers/timers/Timers.updateDividerRegister
           (get_local $1)
          )
          (br $folding-inner1)
         )
         ;;@ core/memory/writeTraps.ts:179:15
         (call $core/timers/timers/Timers.updateTimerCounter
          (get_local $1)
         )
         (br $folding-inner0)
        )
        ;;@ core/memory/writeTraps.ts:182:15
        (call $core/timers/timers/Timers.updateTimerModulo
         (get_local $1)
        )
        (br $folding-inner0)
       )
       ;;@ core/memory/writeTraps.ts:185:15
       (call $core/timers/timers/Timers.updateTimerControl
        (get_local $1)
       )
       (br $folding-inner0)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:193:2
    (if
     ;;@ core/memory/writeTraps.ts:193:6
     (i32.eq
      (get_local $0)
      (i32.const 65280)
     )
     ;;@ core/memory/writeTraps.ts:193:54
     (call $core/joypad/joypad/Joypad.updateJoypad
      (get_local $1)
     )
    )
    ;;@ core/memory/writeTraps.ts:198:2
    (if
     ;;@ core/memory/writeTraps.ts:198:6
     (i32.eq
      (get_local $0)
      (i32.const 65295)
     )
     ;;@ core/memory/writeTraps.ts:198:60
     (block
      ;;@ core/memory/writeTraps.ts:199:15
      (call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
       (get_local $1)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:202:2
    (if
     ;;@ core/memory/writeTraps.ts:202:6
     (i32.eq
      (get_local $0)
      (i32.const 65535)
     )
     ;;@ core/memory/writeTraps.ts:202:60
     (block
      ;;@ core/memory/writeTraps.ts:203:15
      (call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
       (get_local $1)
      )
      (br $folding-inner0)
     )
    )
    (return
     (i32.const 1)
    )
   )
   (return
    (i32.const 1)
   )
  )
  ;;@ core/memory/writeTraps.ts:24:11
  (i32.const 0)
 )
 (func $core/memory/store/eightBitStoreIntoGBMemoryWithTraps (; 153 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/memory/store.ts:11:2
  (if
   ;;@ core/memory/store.ts:11:6
   (call $core/memory/writeTraps/checkWriteTraps
    (get_local $0)
    (get_local $1)
   )
   ;;@ core/memory/store.ts:11:38
   (call $core/memory/store/eightBitStoreIntoGBMemory
    (get_local $0)
    (get_local $1)
   )
  )
 )
 (func $core/memory/dma/hdmaTransfer (; 154 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  ;;@ core/memory/dma.ts:126:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/memory/dma.ts:126:23
     (i32.ge_s
      (get_local $3)
      (get_local $2)
     )
    )
    ;;@ core/memory/dma.ts:127:4
    (set_local $5
     ;;@ core/memory/dma.ts:127:26
     (call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
      ;;@ core/memory/dma.ts:127:60
      (i32.add
       (get_local $0)
       (get_local $3)
      )
     )
    )
    ;;@ core/memory/dma.ts:130:4
    (set_local $4
     ;;@ core/memory/dma.ts:130:38
     (i32.add
      (get_local $1)
      (get_local $3)
     )
    )
    (loop $continue|1
     (if
      ;;@ core/memory/dma.ts:131:11
      (i32.gt_s
       (get_local $4)
       ;;@ core/memory/dma.ts:131:41
       (i32.const 40959)
      )
      (block
       ;;@ core/memory/dma.ts:131:49
       (set_local $4
        ;;@ core/memory/dma.ts:133:36
        (i32.add
         (get_local $4)
         ;;@ core/memory/dma.ts:133:66
         (i32.const -8192)
        )
       )
       (br $continue|1)
      )
     )
    )
    ;;@ core/memory/dma.ts:135:4
    (call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
     (get_local $4)
     (get_local $5)
    )
    ;;@ core/memory/dma.ts:126:43
    (set_local $3
     (i32.add
      (get_local $3)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
  ;;@ core/memory/dma.ts:143:2
  (set_local $3
   ;;@ core/memory/dma.ts:143:24
   (i32.const 32)
  )
  ;;@ core/memory/dma.ts:144:2
  (if
   ;;@ core/memory/dma.ts:144:6
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   ;;@ core/memory/dma.ts:144:26
   (set_local $3
    ;;@ core/memory/dma.ts:145:17
    (i32.const 64)
   )
  )
  ;;@ core/memory/dma.ts:148:2
  (set_global $core/memory/memory/Memory.DMACycles
   (i32.add
    (get_global $core/memory/memory/Memory.DMACycles)
    ;;@ core/memory/dma.ts:147:15
    (i32.mul
     (get_local $3)
     ;;@ core/memory/dma.ts:147:28
     (i32.div_s
      (get_local $2)
      ;;@ core/memory/dma.ts:147:46
      (i32.const 16)
     )
    )
   )
  )
 )
 (func $core/memory/dma/updateHblankHdma (; 155 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/memory/dma.ts:90:2
  (if
   ;;@ core/memory/dma.ts:90:6
   (i32.eqz
    ;;@ core/memory/dma.ts:90:7
    (get_global $core/memory/memory/Memory.isHblankHdmaActive)
   )
   (return)
  )
  ;;@ core/memory/dma.ts:95:2
  (set_local $0
   ;;@ core/memory/dma.ts:95:29
   (i32.const 16)
  )
  ;;@ core/memory/dma.ts:96:2
  (if
   ;;@ core/memory/dma.ts:96:6
   (i32.lt_s
    (get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining)
    (i32.const 16)
   )
   ;;@ core/memory/dma.ts:96:66
   (set_local $0
    ;;@ core/memory/dma.ts:98:22
    (get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining)
   )
  )
  ;;@ core/memory/dma.ts:102:2
  (call $core/memory/dma/hdmaTransfer
   ;;@ core/memory/dma.ts:102:15
   (get_global $core/memory/memory/Memory.hblankHdmaSource)
   ;;@ core/memory/dma.ts:102:40
   (get_global $core/memory/memory/Memory.hblankHdmaDestination)
   (get_local $0)
  )
  ;;@ core/memory/dma.ts:105:2
  (set_global $core/memory/memory/Memory.hblankHdmaSource
   (i32.add
    (get_global $core/memory/memory/Memory.hblankHdmaSource)
    (get_local $0)
   )
  )
  ;;@ core/memory/dma.ts:106:2
  (set_global $core/memory/memory/Memory.hblankHdmaDestination
   (i32.add
    (get_global $core/memory/memory/Memory.hblankHdmaDestination)
    (get_local $0)
   )
  )
  ;;@ core/memory/dma.ts:107:2
  (set_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
   (i32.sub
    (get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining)
    (get_local $0)
   )
  )
  ;;@ core/memory/dma.ts:109:2
  (if
   ;;@ core/memory/dma.ts:109:6
   (i32.le_s
    (get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining)
    ;;@ core/memory/dma.ts:109:50
    (i32.const 0)
   )
   ;;@ core/memory/dma.ts:109:53
   (block
    ;;@ core/memory/dma.ts:111:4
    (set_global $core/memory/memory/Memory.isHblankHdmaActive
     ;;@ core/memory/dma.ts:111:32
     (i32.const 0)
    )
    ;;@ core/memory/dma.ts:114:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/memory/dma.ts:114:30
     (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
     ;;@ core/memory/dma.ts:114:64
     (i32.const 255)
    )
   )
   ;;@ core/memory/dma.ts:120:4
   (call $core/memory/store/eightBitStoreIntoGBMemory
    ;;@ core/memory/dma.ts:120:30
    (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
    ;;@ core/memory/dma.ts:120:64
    (call $core/helpers/index/resetBitOnByte
     ;;@ core/memory/dma.ts:120:79
     (i32.const 7)
     ;;@ core/memory/dma.ts:119:36
     (i32.sub
      (i32.div_s
       ;;@ core/memory/dma.ts:118:39
       (get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining)
       ;;@ core/memory/dma.ts:119:62
       (i32.const 16)
      )
      ;;@ core/memory/dma.ts:119:67
      (i32.const 1)
     )
    )
   )
  )
 )
 (func $core/interrupts/interrupts/requestVBlankInterrupt (; 156 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:173:2
  (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
   ;;@ core/interrupts/interrupts.ts:173:42
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:174:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 0)
  )
 )
 (func $core/graphics/lcd/setLcdStatus (; 157 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  ;;@ core/graphics/lcd.ts:64:2
  (if
   ;;@ core/graphics/lcd.ts:64:6
   (i32.eqz
    ;;@ core/graphics/lcd.ts:64:7
    (get_global $core/graphics/lcd/Lcd.enabled)
   )
   ;;@ core/graphics/lcd.ts:64:20
   (block
    ;;@ core/graphics/lcd.ts:66:4
    (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
     ;;@ core/graphics/lcd.ts:66:36
     (i32.const 0)
    )
    ;;@ core/graphics/lcd.ts:67:4
    (set_global $core/graphics/graphics/Graphics.scanlineRegister
     ;;@ core/graphics/lcd.ts:67:32
     (i32.const 0)
    )
    ;;@ core/graphics/lcd.ts:68:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (i32.const 65348)
     ;;@ core/graphics/lcd.ts:68:71
     (i32.const 0)
    )
    ;;@ core/graphics/lcd.ts:74:4
    (set_local $3
     ;;@ core/graphics/lcd.ts:74:16
     (call $core/helpers/index/resetBitOnByte
      ;;@ core/graphics/lcd.ts:74:31
      (i32.const 0)
      ;;@ core/graphics/lcd.ts:73:16
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/graphics/lcd.ts:73:31
       (i32.const 1)
       ;;@ core/graphics/lcd.ts:72:25
       (call $core/memory/load/eightBitLoadFromGBMemory
        (i32.const 65345)
       )
      )
     )
    )
    ;;@ core/graphics/lcd.ts:75:4
    (set_global $core/graphics/lcd/Lcd.currentLcdMode
     ;;@ core/graphics/lcd.ts:75:25
     (i32.const 0)
    )
    ;;@ core/graphics/lcd.ts:78:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (i32.const 65345)
     (get_local $3)
    )
    ;;@ core/graphics/lcd.ts:79:4
    (return)
   )
  )
  ;;@ core/graphics/lcd.ts:84:2
  (set_local $1
   ;;@ core/graphics/lcd.ts:84:21
   (get_global $core/graphics/lcd/Lcd.currentLcdMode)
  )
  ;;@ core/graphics/lcd.ts:90:2
  (if
   ;;@ core/graphics/lcd.ts:90:6
   (i32.ge_s
    ;;@ core/graphics/lcd.ts:83:2
    (tee_local $3
     ;;@ core/graphics/lcd.ts:83:30
     (get_global $core/graphics/graphics/Graphics.scanlineRegister)
    )
    ;;@ core/graphics/lcd.ts:90:26
    (i32.const 144)
   )
   ;;@ core/graphics/lcd.ts:90:31
   (set_local $2
    ;;@ core/graphics/lcd.ts:92:17
    (i32.const 1)
   )
   ;;@ core/graphics/lcd.ts:93:9
   (if
    ;;@ core/graphics/lcd.ts:94:8
    (i32.ge_s
     (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
     ;;@ core/graphics/lcd.ts:94:50
     (call $core/graphics/graphics/Graphics.MIN_CYCLES_SPRITES_LCD_MODE)
    )
    ;;@ core/graphics/lcd.ts:94:81
    (set_local $2
     ;;@ core/graphics/lcd.ts:96:19
     (i32.const 2)
    )
    ;;@ core/graphics/lcd.ts:97:11
    (if
     ;;@ core/graphics/lcd.ts:97:15
     (i32.ge_s
      (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
      ;;@ core/graphics/lcd.ts:97:57
      (call $core/graphics/graphics/Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE)
     )
     ;;@ core/graphics/lcd.ts:97:94
     (set_local $2
      ;;@ core/graphics/lcd.ts:99:19
      (i32.const 3)
     )
    )
   )
  )
  ;;@ core/graphics/lcd.ts:103:2
  (if
   ;;@ core/graphics/lcd.ts:103:6
   (i32.ne
    (get_local $1)
    (get_local $2)
   )
   ;;@ core/graphics/lcd.ts:103:30
   (block
    ;;@ core/graphics/lcd.ts:105:4
    (set_local $0
     ;;@ core/graphics/lcd.ts:105:25
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.const 65345)
     )
    )
    ;;@ core/graphics/lcd.ts:108:4
    (set_global $core/graphics/lcd/Lcd.currentLcdMode
     (get_local $2)
    )
    ;;@ core/graphics/lcd.ts:110:4
    (set_local $1
     ;;@ core/graphics/lcd.ts:110:42
     (i32.const 0)
    )
    ;;@ core/graphics/lcd.ts:113:4
    (block $break|0
     (block $case3|0
      (block $case2|0
       (block $case1|0
        (block $case0|0
         (set_local $4
          (get_local $2)
         )
         (br_if $case0|0
          (i32.eqz
           (get_local $2)
          )
         )
         (block $tablify|0
          (br_table $case1|0 $case2|0 $case3|0 $tablify|0
           (i32.sub
            (get_local $4)
            (i32.const 1)
           )
          )
         )
         (br $break|0)
        )
        ;;@ core/graphics/lcd.ts:117:8
        (set_local $1
         ;;@ core/graphics/lcd.ts:117:33
         (call $core/helpers/index/checkBitOnByte
          ;;@ core/graphics/lcd.ts:117:48
          (i32.const 3)
          ;;@ core/graphics/lcd.ts:116:8
          (tee_local $0
           ;;@ core/graphics/lcd.ts:116:20
           (call $core/helpers/index/resetBitOnByte
            ;;@ core/graphics/lcd.ts:116:35
            (i32.const 1)
            ;;@ core/graphics/lcd.ts:115:20
            (call $core/helpers/index/resetBitOnByte
             ;;@ core/graphics/lcd.ts:115:35
             (i32.const 0)
             (get_local $0)
            )
           )
          )
         )
        )
        ;;@ core/graphics/lcd.ts:118:8
        (br $break|0)
       )
       ;;@ core/graphics/lcd.ts:122:8
       (set_local $1
        ;;@ core/graphics/lcd.ts:122:33
        (call $core/helpers/index/checkBitOnByte
         ;;@ core/graphics/lcd.ts:122:48
         (i32.const 4)
         ;;@ core/graphics/lcd.ts:121:8
         (tee_local $0
          ;;@ core/graphics/lcd.ts:121:20
          (call $core/helpers/index/setBitOnByte
           ;;@ core/graphics/lcd.ts:121:33
           (i32.const 0)
           ;;@ core/graphics/lcd.ts:120:20
           (call $core/helpers/index/resetBitOnByte
            ;;@ core/graphics/lcd.ts:120:35
            (i32.const 1)
            (get_local $0)
           )
          )
         )
        )
       )
       ;;@ core/graphics/lcd.ts:123:8
       (br $break|0)
      )
      ;;@ core/graphics/lcd.ts:127:8
      (set_local $1
       ;;@ core/graphics/lcd.ts:127:33
       (call $core/helpers/index/checkBitOnByte
        ;;@ core/graphics/lcd.ts:127:48
        (i32.const 5)
        ;;@ core/graphics/lcd.ts:126:8
        (tee_local $0
         ;;@ core/graphics/lcd.ts:126:20
         (call $core/helpers/index/setBitOnByte
          ;;@ core/graphics/lcd.ts:126:33
          (i32.const 1)
          ;;@ core/graphics/lcd.ts:125:20
          (call $core/helpers/index/resetBitOnByte
           ;;@ core/graphics/lcd.ts:125:35
           (i32.const 0)
           (get_local $0)
          )
         )
        )
       )
      )
      ;;@ core/graphics/lcd.ts:128:8
      (br $break|0)
     )
     ;;@ core/graphics/lcd.ts:131:8
     (set_local $0
      ;;@ core/graphics/lcd.ts:131:20
      (call $core/helpers/index/setBitOnByte
       ;;@ core/graphics/lcd.ts:131:33
       (i32.const 1)
       ;;@ core/graphics/lcd.ts:130:20
       (call $core/helpers/index/setBitOnByte
        ;;@ core/graphics/lcd.ts:130:33
        (i32.const 0)
        (get_local $0)
       )
      )
     )
    )
    ;;@ core/graphics/lcd.ts:136:4
    (if
     (get_local $1)
     ;;@ core/graphics/lcd.ts:136:32
     (call $core/interrupts/interrupts/requestLcdInterrupt)
    )
    ;;@ core/graphics/lcd.ts:141:4
    (if
     (i32.eqz
      (get_local $2)
     )
     ;;@ core/graphics/lcd.ts:141:26
     (call $core/memory/dma/updateHblankHdma)
    )
    ;;@ core/graphics/lcd.ts:147:4
    (if
     ;;@ core/graphics/lcd.ts:147:8
     (i32.eq
      (get_local $2)
      ;;@ core/graphics/lcd.ts:147:23
      (i32.const 1)
     )
     ;;@ core/graphics/lcd.ts:147:26
     (call $core/interrupts/interrupts/requestVBlankInterrupt)
    )
    ;;@ core/graphics/lcd.ts:153:4
    (set_local $4
     ;;@ core/graphics/lcd.ts:153:34
     (get_global $core/graphics/lcd/Lcd.coincidenceCompare)
    )
    ;;@ core/graphics/lcd.ts:154:8
    (if
     (i32.eqz
      (tee_local $1
       (i32.eqz
        (get_local $2)
       )
      )
     )
     (set_local $1
      ;;@ core/graphics/lcd.ts:154:29
      (i32.eq
       (get_local $2)
       ;;@ core/graphics/lcd.ts:154:44
       (i32.const 1)
      )
     )
    )
    ;;@ core/graphics/lcd.ts:154:8
    (if
     (get_local $1)
     (set_local $1
      ;;@ core/graphics/lcd.ts:154:50
      (i32.eq
       (get_local $3)
       (get_local $4)
      )
     )
    )
    ;;@ core/graphics/lcd.ts:154:4
    (if
     (get_local $1)
     ;;@ core/graphics/lcd.ts:156:6
     (if
      ;;@ core/graphics/lcd.ts:156:10
      (call $core/helpers/index/checkBitOnByte
       ;;@ core/graphics/lcd.ts:156:25
       (i32.const 6)
       ;;@ core/graphics/lcd.ts:155:6
       (tee_local $0
        ;;@ core/graphics/lcd.ts:155:18
        (call $core/helpers/index/setBitOnByte
         ;;@ core/graphics/lcd.ts:155:31
         (i32.const 2)
         (get_local $0)
        )
       )
      )
      ;;@ core/graphics/lcd.ts:156:40
      (call $core/interrupts/interrupts/requestLcdInterrupt)
     )
     ;;@ core/graphics/lcd.ts:159:11
     (set_local $0
      ;;@ core/graphics/lcd.ts:160:18
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/graphics/lcd.ts:160:33
       (i32.const 2)
       (get_local $0)
      )
     )
    )
    ;;@ core/graphics/lcd.ts:164:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (i32.const 65345)
     (get_local $0)
    )
   )
  )
 )
 (func $core/graphics/graphics/updateGraphics (; 158 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/graphics/graphics.ts:175:2
  (if
   ;;@ core/graphics/graphics.ts:175:6
   (get_global $core/graphics/lcd/Lcd.enabled)
   ;;@ core/graphics/graphics.ts:175:19
   (block
    ;;@ core/graphics/graphics.ts:176:4
    (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
     (i32.add
      (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
      (get_local $0)
     )
    )
    (loop $continue|0
     (if
      ;;@ core/graphics/graphics.ts:178:11
      (i32.ge_s
       (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
       ;;@ core/graphics/graphics.ts:178:53
       (call $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE)
      )
      (block
       ;;@ core/graphics/graphics.ts:181:6
       (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
        (i32.sub
         (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
         ;;@ core/graphics/graphics.ts:181:48
         (call $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE)
        )
       )
       ;;@ core/graphics/graphics.ts:188:6
       (if
        ;;@ core/graphics/graphics.ts:188:10
        (i32.eq
         ;;@ core/graphics/graphics.ts:185:6
         (tee_local $1
          ;;@ core/graphics/graphics.ts:185:34
          (get_global $core/graphics/graphics/Graphics.scanlineRegister)
         )
         ;;@ core/graphics/graphics.ts:188:31
         (i32.const 144)
        )
        ;;@ core/graphics/graphics.ts:188:36
        (block
         ;;@ core/graphics/graphics.ts:190:8
         (if
          ;;@ core/graphics/graphics.ts:190:13
          (get_global $core/config/Config.graphicsDisableScanlineRendering)
          ;;@ core/graphics/graphics.ts:192:15
          (call $core/graphics/graphics/_renderEntireFrame)
          ;;@ core/graphics/graphics.ts:190:54
          (call $core/graphics/graphics/_drawScanline
           (get_local $1)
          )
         )
         ;;@ core/graphics/graphics.ts:197:8
         (call $core/graphics/priority/clearPriorityMap)
         ;;@ core/graphics/graphics.ts:200:8
         (call $core/graphics/tiles/resetTileCache)
        )
        ;;@ core/graphics/graphics.ts:201:13
        (if
         ;;@ core/graphics/graphics.ts:201:17
         (i32.lt_s
          (get_local $1)
          ;;@ core/graphics/graphics.ts:201:36
          (i32.const 144)
         )
         ;;@ core/graphics/graphics.ts:201:41
         (if
          ;;@ core/graphics/graphics.ts:203:12
          (i32.eqz
           ;;@ core/graphics/graphics.ts:203:13
           (get_global $core/config/Config.graphicsDisableScanlineRendering)
          )
          ;;@ core/graphics/graphics.ts:203:54
          (call $core/graphics/graphics/_drawScanline
           (get_local $1)
          )
         )
        )
       )
       ;;@ core/graphics/graphics.ts:218:6
       (set_global $core/graphics/graphics/Graphics.scanlineRegister
        (tee_local $1
         ;;@ core/graphics/graphics.ts:209:6
         (if (result i32)
          ;;@ core/graphics/graphics.ts:209:10
          (i32.gt_s
           (get_local $1)
           ;;@ core/graphics/graphics.ts:209:29
           (i32.const 153)
          )
          ;;@ core/graphics/graphics.ts:212:27
          (i32.const 0)
          (i32.add
           (get_local $1)
           ;;@ core/graphics/graphics.ts:214:28
           (i32.const 1)
          )
         )
        )
       )
       (br $continue|0)
      )
     )
    )
   )
  )
  ;;@ core/graphics/graphics.ts:226:2
  (call $core/graphics/lcd/setLcdStatus)
 )
 (func $core/graphics/graphics/batchProcessGraphics (; 159 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/graphics.ts:123:2
  (if
   ;;@ core/graphics/graphics.ts:123:6
   (i32.lt_s
    (get_global $core/graphics/graphics/Graphics.currentCycles)
    ;;@ core/graphics/graphics.ts:123:40
    (call $core/graphics/graphics/Graphics.batchProcessCycles)
   )
   (return)
  )
  (loop $continue|0
   (if
    ;;@ core/graphics/graphics.ts:127:9
    (i32.ge_s
     (get_global $core/graphics/graphics/Graphics.currentCycles)
     ;;@ core/graphics/graphics.ts:127:44
     (call $core/graphics/graphics/Graphics.batchProcessCycles)
    )
    (block
     ;;@ core/graphics/graphics.ts:128:4
     (call $core/graphics/graphics/updateGraphics
      ;;@ core/graphics/graphics.ts:128:28
      (call $core/graphics/graphics/Graphics.batchProcessCycles)
     )
     ;;@ core/graphics/graphics.ts:129:4
     (set_global $core/graphics/graphics/Graphics.currentCycles
      ;;@ core/graphics/graphics.ts:129:29
      (i32.sub
       (get_global $core/graphics/graphics/Graphics.currentCycles)
       ;;@ core/graphics/graphics.ts:129:63
       (call $core/graphics/graphics/Graphics.batchProcessCycles)
      )
     )
     (br $continue|0)
    )
   )
  )
 )
 (func $core/core/syncCycles (; 160 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/core.ts:342:2
  (if
   ;;@ core/core.ts:342:6
   (i32.gt_s
    (get_global $core/memory/memory/Memory.DMACycles)
    ;;@ core/core.ts:342:25
    (i32.const 0)
   )
   ;;@ core/core.ts:342:28
   (block
    ;;@ core/core.ts:343:4
    (set_local $0
     (i32.add
      (get_local $0)
      ;;@ core/core.ts:343:22
      (get_global $core/memory/memory/Memory.DMACycles)
     )
    )
    ;;@ core/core.ts:344:4
    (set_global $core/memory/memory/Memory.DMACycles
     ;;@ core/core.ts:344:23
     (i32.const 0)
    )
   )
  )
  ;;@ core/core.ts:348:2
  (set_global $core/cpu/cpu/Cpu.currentCycles
   (i32.add
    (get_global $core/cpu/cpu/Cpu.currentCycles)
    (get_local $0)
   )
  )
  ;;@ core/core.ts:351:2
  (if
   ;;@ core/core.ts:351:6
   (i32.eqz
    ;;@ core/core.ts:351:7
    (get_global $core/cpu/cpu/Cpu.isStopped)
   )
   ;;@ core/core.ts:351:22
   (block
    ;;@ core/core.ts:352:4
    (if
     ;;@ core/core.ts:352:8
     (get_global $core/config/Config.graphicsBatchProcessing)
     ;;@ core/core.ts:352:40
     (block
      ;;@ core/core.ts:355:6
      (set_global $core/graphics/graphics/Graphics.currentCycles
       (i32.add
        (get_global $core/graphics/graphics/Graphics.currentCycles)
        (get_local $0)
       )
      )
      ;;@ core/core.ts:356:6
      (call $core/graphics/graphics/batchProcessGraphics)
     )
     ;;@ core/core.ts:357:11
     (call $core/graphics/graphics/updateGraphics
      (get_local $0)
     )
    )
    ;;@ core/core.ts:361:4
    (if
     ;;@ core/core.ts:361:8
     (get_global $core/config/Config.audioBatchProcessing)
     ;;@ core/core.ts:361:37
     (set_global $core/sound/sound/Sound.currentCycles
      (i32.add
       ;;@ core/core.ts:362:6
       (get_global $core/sound/sound/Sound.currentCycles)
       (get_local $0)
      )
     )
     ;;@ core/core.ts:363:11
     (call $core/sound/sound/updateSound
      (get_local $0)
     )
    )
   )
  )
  ;;@ core/core.ts:368:2
  (if
   ;;@ core/core.ts:368:6
   (get_global $core/config/Config.timersBatchProcessing)
   ;;@ core/core.ts:368:36
   (block
    ;;@ core/core.ts:370:4
    (set_global $core/timers/timers/Timers.currentCycles
     (i32.add
      (get_global $core/timers/timers/Timers.currentCycles)
      (get_local $0)
     )
    )
    ;;@ core/core.ts:371:4
    (call $core/timers/timers/batchProcessTimers)
   )
   ;;@ core/core.ts:372:9
   (call $core/timers/timers/updateTimers
    (get_local $0)
   )
  )
 )
 (func $core/cpu/opcodes/getDataByteTwo (; 161 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/opcodes.ts:150:2
  (call $core/core/syncCycles
   ;;@ core/cpu/opcodes.ts:150:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:151:73
  (call $core/memory/load/eightBitLoadFromGBMemory
   ;;@ core/cpu/opcodes.ts:151:38
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:151:50
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:151:71
     (i32.const 1)
    )
   )
  )
 )
 (func $core/cpu/opcodes/getDataByteOne (; 162 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/opcodes.ts:145:2
  (call $core/core/syncCycles
   ;;@ core/cpu/opcodes.ts:145:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:146:56
  (call $core/memory/load/eightBitLoadFromGBMemory
   ;;@ core/cpu/opcodes.ts:146:38
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
 )
 (func $core/cpu/opcodes/getConcatenatedDataByte (; 163 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/opcodes.ts:156:65
  (call $core/helpers/index/concatenateBytes
   ;;@ core/cpu/opcodes.ts:156:31
   (i32.and
    (call $core/cpu/opcodes/getDataByteTwo)
    (i32.const 255)
   )
   ;;@ core/cpu/opcodes.ts:156:49
   (i32.and
    (call $core/cpu/opcodes/getDataByteOne)
    (i32.const 255)
   )
  )
 )
 (func $core/cpu/opcodes/eightBitStoreSyncCycles (; 164 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/cpu/opcodes.ts:128:2
  (call $core/core/syncCycles
   ;;@ core/cpu/opcodes.ts:128:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:129:2
  (call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
   (get_local $0)
   (get_local $1)
  )
 )
 (func $core/cpu/flags/setFlagBit (; 165 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  ;;@ core/cpu/flags.ts:6:2
  (set_local $2
   ;;@ core/cpu/flags.ts:6:27
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/flags.ts:6:38
    (i32.shl
     (i32.const 1)
     (get_local $0)
    )
   )
  )
  ;;@ core/cpu/flags.ts:7:2
  (if
   ;;@ core/cpu/flags.ts:7:6
   (i32.gt_s
    (get_local $1)
    ;;@ core/cpu/flags.ts:7:18
    (i32.const 0)
   )
   ;;@ core/cpu/flags.ts:7:21
   (set_global $core/cpu/cpu/Cpu.registerF
    (i32.and
     ;;@ core/cpu/flags.ts:8:20
     (i32.or
      (get_global $core/cpu/cpu/Cpu.registerF)
      (get_local $2)
     )
     (i32.const 255)
    )
   )
   ;;@ core/cpu/flags.ts:12:4
   (set_global $core/cpu/cpu/Cpu.registerF
    ;;@ core/cpu/flags.ts:12:20
    (i32.and
     (get_global $core/cpu/cpu/Cpu.registerF)
     ;;@ core/cpu/flags.ts:11:21
     (i32.xor
      (get_local $2)
      (i32.const 255)
     )
    )
   )
  )
  ;;@ core/cpu/flags.ts:15:13
  (get_global $core/cpu/cpu/Cpu.registerF)
 )
 (func $core/cpu/flags/setHalfCarryFlag (; 166 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:28:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:28:13
    (i32.const 5)
    (get_local $0)
   )
  )
 )
 (func $core/cpu/flags/checkAndSetEightBitHalfCarryFlag (; 167 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/cpu/flags.ts:55:2
  (if
   ;;@ core/cpu/flags.ts:55:6
   (i32.ge_s
    (get_local $1)
    ;;@ core/cpu/flags.ts:55:21
    (i32.const 0)
   )
   ;;@ core/cpu/flags.ts:58:4
   (if
    ;;@ core/cpu/flags.ts:57:21
    (i32.and
     (call $core/helpers/index/splitLowByte
      ;;@ core/cpu/flags.ts:57:32
      (i32.add
       (i32.and
        (get_local $0)
        ;;@ core/cpu/flags.ts:57:47
        (i32.const 15)
       )
       ;;@ core/cpu/flags.ts:57:55
       (i32.and
        (get_local $1)
        ;;@ core/cpu/flags.ts:57:76
        (i32.const 15)
       )
      )
     )
     ;;@ core/cpu/flags.ts:57:85
     (i32.const 16)
    )
    ;;@ core/cpu/flags.ts:58:25
    (call $core/cpu/flags/setHalfCarryFlag
     ;;@ core/cpu/flags.ts:59:23
     (i32.const 1)
    )
    ;;@ core/cpu/flags.ts:60:11
    (call $core/cpu/flags/setHalfCarryFlag
     ;;@ core/cpu/flags.ts:61:23
     (i32.const 0)
    )
   )
   ;;@ core/cpu/flags.ts:63:9
   (if
    ;;@ core/cpu/flags.ts:66:8
    (i32.gt_u
     (i32.and
      ;;@ core/cpu/flags.ts:66:13
      (select
       (get_local $1)
       (i32.sub
        (i32.const 0)
        (get_local $1)
       )
       (i32.gt_s
        (get_local $1)
        (i32.const 0)
       )
      )
      ;;@ core/cpu/flags.ts:66:32
      (i32.const 15)
     )
     ;;@ core/cpu/flags.ts:66:40
     (i32.and
      (get_local $0)
      ;;@ core/cpu/flags.ts:66:49
      (i32.const 15)
     )
    )
    ;;@ core/cpu/flags.ts:66:56
    (call $core/cpu/flags/setHalfCarryFlag
     ;;@ core/cpu/flags.ts:67:23
     (i32.const 1)
    )
    ;;@ core/cpu/flags.ts:68:11
    (call $core/cpu/flags/setHalfCarryFlag
     ;;@ core/cpu/flags.ts:69:23
     (i32.const 0)
    )
   )
  )
 )
 (func $core/cpu/flags/setZeroFlag (; 168 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:20:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:20:13
    (i32.const 7)
    (get_local $0)
   )
  )
 )
 (func $core/cpu/flags/setSubtractFlag (; 169 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:24:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:24:13
    (i32.const 6)
    (get_local $0)
   )
  )
 )
 (func $core/cpu/flags/setCarryFlag (; 170 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:32:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:32:13
    (i32.const 4)
    (get_local $0)
   )
  )
 )
 (func $core/helpers/index/rotateByteLeft (; 171 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/helpers/index.ts:25:47
  (call $core/helpers/index/splitLowByte
   ;;@ core/helpers/index.ts:25:20
   (i32.or
    (i32.shl
     (get_local $0)
     ;;@ core/helpers/index.ts:25:30
     (i32.const 1)
    )
    ;;@ core/helpers/index.ts:25:35
    (i32.shr_u
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
     ;;@ core/helpers/index.ts:25:45
     (i32.const 7)
    )
   )
  )
 )
 (func $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps (; 172 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  ;;@ core/memory/store.ts:19:2
  (set_local $2
   ;;@ core/memory/store.ts:19:22
   (call $core/helpers/index/splitHighByte
    (get_local $1)
   )
  )
  ;;@ core/memory/store.ts:21:2
  (set_local $3
   ;;@ core/memory/store.ts:21:24
   (i32.add
    (get_local $0)
    ;;@ core/memory/store.ts:21:33
    (i32.const 1)
   )
  )
  ;;@ core/memory/store.ts:23:2
  (if
   ;;@ core/memory/store.ts:23:6
   (call $core/memory/writeTraps/checkWriteTraps
    (get_local $0)
    ;;@ core/memory/store.ts:20:2
    (tee_local $1
     ;;@ core/memory/store.ts:20:21
     (call $core/helpers/index/splitLowByte
      (get_local $1)
     )
    )
   )
   ;;@ core/memory/store.ts:23:40
   (call $core/memory/store/eightBitStoreIntoGBMemory
    (get_local $0)
    (get_local $1)
   )
  )
  ;;@ core/memory/store.ts:27:2
  (if
   ;;@ core/memory/store.ts:27:6
   (call $core/memory/writeTraps/checkWriteTraps
    (get_local $3)
    (get_local $2)
   )
   ;;@ core/memory/store.ts:27:45
   (call $core/memory/store/eightBitStoreIntoGBMemory
    (get_local $3)
    (get_local $2)
   )
  )
 )
 (func $core/cpu/opcodes/sixteenBitStoreSyncCycles (; 173 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/cpu/opcodes.ts:139:2
  (call $core/core/syncCycles
   ;;@ core/cpu/opcodes.ts:139:13
   (i32.const 8)
  )
  ;;@ core/cpu/opcodes.ts:140:2
  (call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
   (get_local $0)
   (get_local $1)
  )
 )
 (func $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow (; 174 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  ;;@ core/cpu/flags.ts:96:2
  (if
   (i32.and
    (get_local $2)
    (i32.const 1)
   )
   ;;@ core/cpu/flags.ts:96:27
   (block
    ;;@ core/cpu/flags.ts:101:4
    (set_local $2
     ;;@ core/cpu/flags.ts:101:22
     (i32.add
      ;;@ core/cpu/flags.ts:100:4
      (tee_local $0
       ;;@ core/cpu/flags.ts:100:30
       (i32.and
        (get_local $0)
        (i32.const 65535)
       )
      )
      (get_local $1)
     )
    )
    ;;@ core/cpu/flags.ts:105:4
    (if
     ;;@ core/cpu/flags.ts:105:8
     (i32.and
      ;;@ core/cpu/flags.ts:103:4
      (tee_local $2
       ;;@ core/cpu/flags.ts:103:23
       (i32.xor
        (i32.xor
         (get_local $0)
         (get_local $1)
        )
        (get_local $2)
       )
      )
      ;;@ core/cpu/flags.ts:105:19
      (i32.const 16)
     )
     ;;@ core/cpu/flags.ts:105:32
     (call $core/cpu/flags/setHalfCarryFlag
      ;;@ core/cpu/flags.ts:106:23
      (i32.const 1)
     )
     ;;@ core/cpu/flags.ts:107:11
     (call $core/cpu/flags/setHalfCarryFlag
      ;;@ core/cpu/flags.ts:108:23
      (i32.const 0)
     )
    )
    ;;@ core/cpu/flags.ts:111:4
    (if
     ;;@ core/cpu/flags.ts:111:8
     (i32.and
      (get_local $2)
      ;;@ core/cpu/flags.ts:111:19
      (i32.const 256)
     )
     ;;@ core/cpu/flags.ts:111:33
     (call $core/cpu/flags/setCarryFlag
      ;;@ core/cpu/flags.ts:112:19
      (i32.const 1)
     )
     ;;@ core/cpu/flags.ts:113:11
     (call $core/cpu/flags/setCarryFlag
      ;;@ core/cpu/flags.ts:114:19
      (i32.const 0)
     )
    )
   )
   ;;@ core/cpu/flags.ts:116:9
   (block
    ;;@ core/cpu/flags.ts:123:4
    (if
     ;;@ core/cpu/flags.ts:123:8
     (i32.lt_u
      ;;@ core/cpu/flags.ts:120:4
      (tee_local $2
       ;;@ core/cpu/flags.ts:120:22
       (call $core/portable/portable/u16Portable
        ;;@ core/cpu/flags.ts:120:34
        (i32.add
         (get_local $0)
         (get_local $1)
        )
       )
      )
      (i32.and
       (get_local $0)
       (i32.const 65535)
      )
     )
     ;;@ core/cpu/flags.ts:123:27
     (call $core/cpu/flags/setCarryFlag
      ;;@ core/cpu/flags.ts:124:19
      (i32.const 1)
     )
     ;;@ core/cpu/flags.ts:125:11
     (call $core/cpu/flags/setCarryFlag
      ;;@ core/cpu/flags.ts:126:19
      (i32.const 0)
     )
    )
    ;;@ core/cpu/flags.ts:132:4
    (if
     ;;@ core/cpu/flags.ts:131:28
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/flags.ts:131:40
      (i32.and
       ;;@ core/cpu/flags.ts:130:28
       (i32.xor
        (i32.xor
         (get_local $0)
         (get_local $1)
        )
        (get_local $2)
       )
       ;;@ core/cpu/flags.ts:131:55
       (i32.const 4096)
      )
     )
     ;;@ core/cpu/flags.ts:132:31
     (call $core/cpu/flags/setHalfCarryFlag
      ;;@ core/cpu/flags.ts:133:23
      (i32.const 1)
     )
     ;;@ core/cpu/flags.ts:134:11
     (call $core/cpu/flags/setHalfCarryFlag
      ;;@ core/cpu/flags.ts:135:23
      (i32.const 0)
     )
    )
   )
  )
 )
 (func $core/cpu/opcodes/eightBitLoadSyncCycles (; 175 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/cpu/opcodes.ts:123:2
  (call $core/core/syncCycles
   ;;@ core/cpu/opcodes.ts:123:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:124:60
  (call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
   (get_local $0)
  )
 )
 (func $core/helpers/index/rotateByteRight (; 176 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/helpers/index.ts:38:47
  (call $core/helpers/index/splitLowByte
   ;;@ core/helpers/index.ts:38:20
   (i32.or
    (i32.shr_u
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
     ;;@ core/helpers/index.ts:38:30
     (i32.const 1)
    )
    ;;@ core/helpers/index.ts:38:35
    (i32.shl
     (get_local $0)
     ;;@ core/helpers/index.ts:38:45
     (i32.const 7)
    )
   )
  )
 )
 (func $core/cpu/opcodes/handleOpcode0x (; 177 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner4
   (block $folding-inner3
    (block $folding-inner2
     (block $folding-inner1
      (block $folding-inner0
       (block $break|0
        (block $case15|0
         (block $case14|0
          (block $case13|0
           (block $case12|0
            (block $case11|0
             (block $case10|0
              (block $case9|0
               (block $case8|0
                (block $case7|0
                 (block $case6|0
                  (block $case5|0
                   (block $case4|0
                    (block $case3|0
                     (block $case2|0
                      (block $case1|0
                       (if
                        (get_local $0)
                        (block
                         (block $tablify|0
                          (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                           (i32.sub
                            (get_local $0)
                            (i32.const 1)
                           )
                          )
                         )
                         (br $break|0)
                        )
                       )
                       (br $folding-inner4)
                      )
                      ;;@ core/cpu/opcodes.ts:173:6
                      (set_global $core/cpu/cpu/Cpu.registerB
                       (i32.and
                        ;;@ core/cpu/opcodes.ts:173:22
                        (call $core/helpers/index/splitHighByte
                         ;;@ core/cpu/opcodes.ts:171:6
                         (tee_local $0
                          ;;@ core/cpu/opcodes.ts:171:38
                          (i32.and
                           (call $core/cpu/opcodes/getConcatenatedDataByte)
                           (i32.const 65535)
                          )
                         )
                        )
                        (i32.const 255)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:174:6
                      (set_global $core/cpu/cpu/Cpu.registerC
                       (i32.and
                        ;;@ core/cpu/opcodes.ts:174:22
                        (call $core/helpers/index/splitLowByte
                         (get_local $0)
                        )
                        (i32.const 255)
                       )
                      )
                      (br $folding-inner1)
                     )
                     ;;@ core/cpu/opcodes.ts:184:6
                     (call $core/cpu/opcodes/eightBitStoreSyncCycles
                      ;;@ core/cpu/opcodes.ts:184:30
                      (call $core/helpers/index/concatenateBytes
                       ;;@ core/cpu/opcodes.ts:184:47
                       (get_global $core/cpu/cpu/Cpu.registerB)
                       ;;@ core/cpu/opcodes.ts:184:62
                       (get_global $core/cpu/cpu/Cpu.registerC)
                      )
                      ;;@ core/cpu/opcodes.ts:184:78
                      (get_global $core/cpu/cpu/Cpu.registerA)
                     )
                     (br $folding-inner4)
                    )
                    ;;@ core/cpu/opcodes.ts:192:6
                    (set_global $core/cpu/cpu/Cpu.registerB
                     (i32.and
                      ;;@ core/cpu/opcodes.ts:192:22
                      (call $core/helpers/index/splitHighByte
                       (tee_local $0
                        ;;@ core/cpu/opcodes.ts:192:40
                        (i32.and
                         (i32.add
                          ;;@ core/cpu/opcodes.ts:190:29
                          (call $core/helpers/index/concatenateBytes
                           ;;@ core/cpu/opcodes.ts:190:51
                           (get_global $core/cpu/cpu/Cpu.registerB)
                           ;;@ core/cpu/opcodes.ts:190:66
                           (get_global $core/cpu/cpu/Cpu.registerC)
                          )
                          (i32.const 1)
                         )
                         (i32.const 65535)
                        )
                       )
                      )
                      (i32.const 255)
                     )
                    )
                    (br $folding-inner0)
                   )
                   ;;@ core/cpu/opcodes.ts:199:6
                   (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                    ;;@ core/cpu/opcodes.ts:199:39
                    (get_global $core/cpu/cpu/Cpu.registerB)
                    ;;@ core/cpu/opcodes.ts:199:54
                    (i32.const 1)
                   )
                   ;;@ core/cpu/opcodes.ts:200:6
                   (set_global $core/cpu/cpu/Cpu.registerB
                    ;;@ core/cpu/opcodes.ts:200:22
                    (call $core/helpers/index/splitLowByte
                     ;;@ core/cpu/opcodes.ts:200:33
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.registerB)
                      ;;@ core/cpu/opcodes.ts:200:49
                      (i32.const 1)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:201:6
                   (if
                    ;;@ core/cpu/opcodes.ts:201:10
                    (get_global $core/cpu/cpu/Cpu.registerB)
                    ;;@ core/cpu/opcodes.ts:203:13
                    (call $core/cpu/flags/setZeroFlag
                     ;;@ core/cpu/opcodes.ts:204:20
                     (i32.const 0)
                    )
                    ;;@ core/cpu/opcodes.ts:201:31
                    (call $core/cpu/flags/setZeroFlag
                     ;;@ core/cpu/opcodes.ts:202:20
                     (i32.const 1)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:206:6
                   (call $core/cpu/flags/setSubtractFlag
                    ;;@ core/cpu/opcodes.ts:206:22
                    (i32.const 0)
                   )
                   (br $folding-inner4)
                  )
                  ;;@ core/cpu/opcodes.ts:212:6
                  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   ;;@ core/cpu/opcodes.ts:212:39
                   (get_global $core/cpu/cpu/Cpu.registerB)
                   ;;@ core/cpu/opcodes.ts:212:54
                   (i32.const -1)
                  )
                  ;;@ core/cpu/opcodes.ts:213:6
                  (set_global $core/cpu/cpu/Cpu.registerB
                   ;;@ core/cpu/opcodes.ts:213:22
                   (call $core/helpers/index/splitLowByte
                    ;;@ core/cpu/opcodes.ts:213:33
                    (i32.sub
                     (get_global $core/cpu/cpu/Cpu.registerB)
                     ;;@ core/cpu/opcodes.ts:213:49
                     (i32.const 1)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:214:6
                  (if
                   ;;@ core/cpu/opcodes.ts:214:10
                   (get_global $core/cpu/cpu/Cpu.registerB)
                   ;;@ core/cpu/opcodes.ts:216:13
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:217:20
                    (i32.const 0)
                   )
                   ;;@ core/cpu/opcodes.ts:214:31
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:215:20
                    (i32.const 1)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:219:6
                  (call $core/cpu/flags/setSubtractFlag
                   ;;@ core/cpu/opcodes.ts:219:22
                   (i32.const 1)
                  )
                  (br $folding-inner4)
                 )
                 ;;@ core/cpu/opcodes.ts:226:6
                 (set_global $core/cpu/cpu/Cpu.registerB
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:226:22
                   (call $core/cpu/opcodes/getDataByteOne)
                   (i32.const 255)
                  )
                 )
                 (br $folding-inner2)
                )
                ;;@ core/cpu/opcodes.ts:235:6
                (if
                 ;;@ core/cpu/opcodes.ts:235:10
                 (i32.eq
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:235:11
                   (get_global $core/cpu/cpu/Cpu.registerA)
                   ;;@ core/cpu/opcodes.ts:235:27
                   (i32.const 128)
                  )
                  ;;@ core/cpu/opcodes.ts:235:37
                  (i32.const 128)
                 )
                 ;;@ core/cpu/opcodes.ts:235:43
                 (call $core/cpu/flags/setCarryFlag
                  ;;@ core/cpu/opcodes.ts:236:21
                  (i32.const 1)
                 )
                 ;;@ core/cpu/opcodes.ts:237:13
                 (call $core/cpu/flags/setCarryFlag
                  ;;@ core/cpu/opcodes.ts:238:21
                  (i32.const 0)
                 )
                )
                ;;@ core/cpu/opcodes.ts:240:6
                (set_global $core/cpu/cpu/Cpu.registerA
                 ;;@ core/cpu/opcodes.ts:240:22
                 (call $core/helpers/index/rotateByteLeft
                  ;;@ core/cpu/opcodes.ts:240:37
                  (get_global $core/cpu/cpu/Cpu.registerA)
                 )
                )
                (br $folding-inner3)
               )
               ;;@ core/cpu/opcodes.ts:252:6
               (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                ;;@ core/cpu/opcodes.ts:252:32
                (i32.and
                 (call $core/cpu/opcodes/getConcatenatedDataByte)
                 (i32.const 65535)
                )
                ;;@ core/cpu/opcodes.ts:252:59
                (get_global $core/cpu/cpu/Cpu.stackPointer)
               )
               (br $folding-inner1)
              )
              ;;@ core/cpu/opcodes.ts:262:6
              (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
               ;;@ core/cpu/opcodes.ts:260:6
               (tee_local $0
                ;;@ core/cpu/opcodes.ts:260:28
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:260:50
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:260:65
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               ;;@ core/cpu/opcodes.ts:262:61
               (i32.and
                ;;@ core/cpu/opcodes.ts:261:6
                (tee_local $1
                 ;;@ core/cpu/opcodes.ts:261:29
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:261:51
                  (get_global $core/cpu/cpu/Cpu.registerB)
                  ;;@ core/cpu/opcodes.ts:261:66
                  (get_global $core/cpu/cpu/Cpu.registerC)
                 )
                )
                (i32.const 65535)
               )
               ;;@ core/cpu/opcodes.ts:262:79
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:264:6
              (set_global $core/cpu/cpu/Cpu.registerH
               (i32.and
                ;;@ core/cpu/opcodes.ts:264:22
                (call $core/helpers/index/splitHighByte
                 ;;@ core/cpu/opcodes.ts:263:6
                 (tee_local $0
                  ;;@ core/cpu/opcodes.ts:263:24
                  (call $core/portable/portable/u16Portable
                   ;;@ core/cpu/opcodes.ts:263:36
                   (i32.add
                    (get_local $0)
                    (get_local $1)
                   )
                  )
                 )
                )
                (i32.const 255)
               )
              )
              ;;@ core/cpu/opcodes.ts:265:6
              (set_global $core/cpu/cpu/Cpu.registerL
               (i32.and
                ;;@ core/cpu/opcodes.ts:265:22
                (call $core/helpers/index/splitLowByte
                 (get_local $0)
                )
                (i32.const 255)
               )
              )
              ;;@ core/cpu/opcodes.ts:266:6
              (call $core/cpu/flags/setSubtractFlag
               ;;@ core/cpu/opcodes.ts:266:22
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:267:13
              (return
               (i32.const 8)
              )
             )
             ;;@ core/cpu/opcodes.ts:273:6
             (set_global $core/cpu/cpu/Cpu.registerA
              (i32.and
               ;;@ core/cpu/opcodes.ts:273:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:273:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:273:66
                 (get_global $core/cpu/cpu/Cpu.registerB)
                 ;;@ core/cpu/opcodes.ts:273:81
                 (get_global $core/cpu/cpu/Cpu.registerC)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner4)
            )
            ;;@ core/cpu/opcodes.ts:281:6
            (set_global $core/cpu/cpu/Cpu.registerB
             (i32.and
              ;;@ core/cpu/opcodes.ts:281:22
              (call $core/helpers/index/splitHighByte
               ;;@ core/cpu/opcodes.ts:280:6
               (tee_local $0
                ;;@ core/cpu/opcodes.ts:280:20
                (call $core/portable/portable/u16Portable
                 ;;@ core/cpu/opcodes.ts:280:32
                 (i32.sub
                  ;;@ core/cpu/opcodes.ts:279:29
                  (call $core/helpers/index/concatenateBytes
                   ;;@ core/cpu/opcodes.ts:279:51
                   (get_global $core/cpu/cpu/Cpu.registerB)
                   ;;@ core/cpu/opcodes.ts:279:66
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  ;;@ core/cpu/opcodes.ts:280:46
                  (i32.const 1)
                 )
                )
               )
              )
              (i32.const 255)
             )
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:288:6
           (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
            ;;@ core/cpu/opcodes.ts:288:39
            (get_global $core/cpu/cpu/Cpu.registerC)
            ;;@ core/cpu/opcodes.ts:288:54
            (i32.const 1)
           )
           ;;@ core/cpu/opcodes.ts:289:6
           (set_global $core/cpu/cpu/Cpu.registerC
            ;;@ core/cpu/opcodes.ts:289:22
            (call $core/helpers/index/splitLowByte
             ;;@ core/cpu/opcodes.ts:289:33
             (i32.add
              (get_global $core/cpu/cpu/Cpu.registerC)
              ;;@ core/cpu/opcodes.ts:289:49
              (i32.const 1)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:290:6
           (if
            ;;@ core/cpu/opcodes.ts:290:10
            (get_global $core/cpu/cpu/Cpu.registerC)
            ;;@ core/cpu/opcodes.ts:292:13
            (call $core/cpu/flags/setZeroFlag
             ;;@ core/cpu/opcodes.ts:293:20
             (i32.const 0)
            )
            ;;@ core/cpu/opcodes.ts:290:31
            (call $core/cpu/flags/setZeroFlag
             ;;@ core/cpu/opcodes.ts:291:20
             (i32.const 1)
            )
           )
           ;;@ core/cpu/opcodes.ts:295:6
           (call $core/cpu/flags/setSubtractFlag
            ;;@ core/cpu/opcodes.ts:295:22
            (i32.const 0)
           )
           (br $folding-inner4)
          )
          ;;@ core/cpu/opcodes.ts:301:6
          (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           ;;@ core/cpu/opcodes.ts:301:39
           (get_global $core/cpu/cpu/Cpu.registerC)
           ;;@ core/cpu/opcodes.ts:301:54
           (i32.const -1)
          )
          ;;@ core/cpu/opcodes.ts:302:6
          (set_global $core/cpu/cpu/Cpu.registerC
           ;;@ core/cpu/opcodes.ts:302:22
           (call $core/helpers/index/splitLowByte
            ;;@ core/cpu/opcodes.ts:302:33
            (i32.sub
             (get_global $core/cpu/cpu/Cpu.registerC)
             ;;@ core/cpu/opcodes.ts:302:49
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:303:6
          (if
           ;;@ core/cpu/opcodes.ts:303:10
           (get_global $core/cpu/cpu/Cpu.registerC)
           ;;@ core/cpu/opcodes.ts:305:13
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:306:20
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:303:31
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:304:20
            (i32.const 1)
           )
          )
          ;;@ core/cpu/opcodes.ts:308:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:308:22
           (i32.const 1)
          )
          (br $folding-inner4)
         )
         ;;@ core/cpu/opcodes.ts:315:6
         (set_global $core/cpu/cpu/Cpu.registerC
          (i32.and
           ;;@ core/cpu/opcodes.ts:315:22
           (call $core/cpu/opcodes/getDataByteOne)
           (i32.const 255)
          )
         )
         (br $folding-inner2)
        )
        ;;@ core/cpu/opcodes.ts:324:6
        (if
         ;;@ core/cpu/opcodes.ts:324:10
         (i32.gt_u
          (i32.and
           ;;@ core/cpu/opcodes.ts:324:11
           (get_global $core/cpu/cpu/Cpu.registerA)
           ;;@ core/cpu/opcodes.ts:324:27
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:324:35
          (i32.const 0)
         )
         ;;@ core/cpu/opcodes.ts:324:38
         (call $core/cpu/flags/setCarryFlag
          ;;@ core/cpu/opcodes.ts:325:21
          (i32.const 1)
         )
         ;;@ core/cpu/opcodes.ts:326:13
         (call $core/cpu/flags/setCarryFlag
          ;;@ core/cpu/opcodes.ts:327:21
          (i32.const 0)
         )
        )
        ;;@ core/cpu/opcodes.ts:329:6
        (set_global $core/cpu/cpu/Cpu.registerA
         ;;@ core/cpu/opcodes.ts:329:22
         (call $core/helpers/index/rotateByteRight
          ;;@ core/cpu/opcodes.ts:329:38
          (get_global $core/cpu/cpu/Cpu.registerA)
         )
        )
        (br $folding-inner3)
       )
       (return
        (i32.const -1)
       )
      )
      ;;@ core/cpu/opcodes.ts:193:6
      (set_global $core/cpu/cpu/Cpu.registerC
       (i32.and
        ;;@ core/cpu/opcodes.ts:193:22
        (call $core/helpers/index/splitLowByte
         (get_local $0)
        )
        (i32.const 255)
       )
      )
      ;;@ core/cpu/opcodes.ts:194:13
      (return
       (i32.const 8)
      )
     )
     ;;@ core/cpu/opcodes.ts:175:6
     (set_global $core/cpu/cpu/Cpu.programCounter
      ;;@ core/cpu/opcodes.ts:175:27
      (call $core/portable/portable/u16Portable
       ;;@ core/cpu/opcodes.ts:175:39
       (i32.add
        (get_global $core/cpu/cpu/Cpu.programCounter)
        ;;@ core/cpu/opcodes.ts:175:60
        (i32.const 2)
       )
      )
     )
     (br $folding-inner4)
    )
    ;;@ core/cpu/opcodes.ts:227:6
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/cpu/opcodes.ts:227:27
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:227:39
      (i32.add
       (get_global $core/cpu/cpu/Cpu.programCounter)
       ;;@ core/cpu/opcodes.ts:227:60
       (i32.const 1)
      )
     )
    )
    (br $folding-inner4)
   )
   ;;@ core/cpu/opcodes.ts:242:6
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/opcodes.ts:242:18
    (i32.const 0)
   )
   ;;@ core/cpu/opcodes.ts:243:6
   (call $core/cpu/flags/setSubtractFlag
    ;;@ core/cpu/opcodes.ts:243:22
    (i32.const 0)
   )
   ;;@ core/cpu/opcodes.ts:244:6
   (call $core/cpu/flags/setHalfCarryFlag
    ;;@ core/cpu/opcodes.ts:244:23
    (i32.const 0)
   )
  )
  ;;@ core/cpu/opcodes.ts:165:13
  (i32.const 4)
 )
 (func $core/cpu/flags/getCarryFlag (; 178 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/flags.ts:49:32
  (i32.and
   ;;@ core/cpu/flags.ts:49:9
   (i32.shr_u
    ;;@ core/cpu/flags.ts:49:10
    (get_global $core/cpu/cpu/Cpu.registerF)
    ;;@ core/cpu/flags.ts:49:27
    (i32.const 4)
   )
   ;;@ core/cpu/flags.ts:49:32
   (i32.const 1)
  )
 )
 (func $core/helpers/index/rotateByteLeftThroughCarry (; 179 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/helpers/index.ts:31:49
  (call $core/helpers/index/splitLowByte
   ;;@ core/helpers/index.ts:31:20
   (i32.or
    (i32.shl
     (get_local $0)
     ;;@ core/helpers/index.ts:31:30
     (i32.const 1)
    )
    ;;@ core/helpers/index.ts:31:35
    (call $core/cpu/flags/getCarryFlag)
   )
  )
 )
 (func $core/portable/portable/i8Portable (; 180 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/portable/portable.ts:19:2
  (if
   ;;@ core/portable/portable.ts:19:6
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/portable/portable.ts:19:21
    (i32.const 7)
    ;;@ core/portable/portable.ts:18:2
    (tee_local $1
     ;;@ core/portable/portable.ts:18:22
     (i32.shr_s
      (i32.shl
       (get_local $0)
       (i32.const 24)
      )
      (i32.const 24)
     )
    )
   )
   ;;@ core/portable/portable.ts:19:35
   (set_local $1
    ;;@ core/portable/portable.ts:20:15
    (i32.mul
     (i32.sub
      ;;@ core/portable/portable.ts:20:16
      (i32.const 256)
      ;;@ core/portable/portable.ts:20:22
      (i32.shr_s
       (i32.shl
        (get_local $0)
        (i32.const 24)
       )
       (i32.const 24)
      )
     )
     ;;@ core/portable/portable.ts:20:36
     (i32.const -1)
    )
   )
  )
  (get_local $1)
 )
 (func $core/cpu/instructions/relativeJump (; 181 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:425:2
  (set_local $1
   ;;@ core/cpu/instructions.ts:425:31
   (call $core/portable/portable/i8Portable
    (get_local $0)
   )
  )
  ;;@ core/cpu/instructions.ts:427:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/instructions.ts:427:23
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/instructions.ts:427:35
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     (i32.shr_s
      (i32.shl
       (get_local $1)
       (i32.const 24)
      )
      (i32.const 24)
     )
    )
   )
  )
  ;;@ core/cpu/instructions.ts:433:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/instructions.ts:433:23
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/instructions.ts:433:35
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/instructions.ts:433:56
     (i32.const 1)
    )
   )
  )
 )
 (func $core/helpers/index/rotateByteRightThroughCarry (; 182 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/helpers/index.ts:44:56
  (call $core/helpers/index/splitLowByte
   ;;@ core/helpers/index.ts:44:20
   (i32.or
    (i32.shr_u
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
     ;;@ core/helpers/index.ts:44:30
     (i32.const 1)
    )
    ;;@ core/helpers/index.ts:44:35
    (i32.shl
     ;;@ core/helpers/index.ts:44:36
     (call $core/cpu/flags/getCarryFlag)
     ;;@ core/helpers/index.ts:44:54
     (i32.const 7)
    )
   )
  )
 )
 (func $core/cpu/opcodes/handleOpcode1x (; 183 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner3
   (block $folding-inner2
    (block $folding-inner1
     (block $folding-inner0
      (block $break|0
       (block $case15|0
        (block $case14|0
         (block $case13|0
          (block $case12|0
           (block $case11|0
            (block $case10|0
             (block $case9|0
              (block $case8|0
               (block $case7|0
                (block $case6|0
                 (block $case5|0
                  (block $case4|0
                   (block $case3|0
                    (block $case2|0
                     (block $case1|0
                      (if
                       (i32.ne
                        (get_local $0)
                        ;;@ core/cpu/opcodes.ts:341:9
                        (i32.const 16)
                       )
                       (block
                        (block $tablify|0
                         (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                          (i32.sub
                           (get_local $0)
                           (i32.const 17)
                          )
                         )
                        )
                        (br $break|0)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:349:6
                      (if
                       ;;@ core/cpu/opcodes.ts:349:10
                       (get_global $core/cpu/cpu/Cpu.GBCEnabled)
                       ;;@ core/cpu/opcodes.ts:352:8
                       (if
                        ;;@ core/cpu/opcodes.ts:352:12
                        (call $core/helpers/index/checkBitOnByte
                         ;;@ core/cpu/opcodes.ts:352:27
                         (i32.const 0)
                         ;;@ core/cpu/opcodes.ts:351:8
                         (tee_local $0
                          ;;@ core/cpu/opcodes.ts:351:31
                          (i32.and
                           (call $core/cpu/opcodes/eightBitLoadSyncCycles
                            (i32.const 65357)
                           )
                           (i32.const 255)
                          )
                         )
                        )
                        ;;@ core/cpu/opcodes.ts:352:44
                        (block
                         ;;@ core/cpu/opcodes.ts:367:10
                         (call $core/cpu/opcodes/eightBitStoreSyncCycles
                          (i32.const 65357)
                          (tee_local $0
                           ;;@ core/cpu/opcodes.ts:357:10
                           (if (result i32)
                            ;;@ core/cpu/opcodes.ts:357:15
                            (call $core/helpers/index/checkBitOnByte
                             ;;@ core/cpu/opcodes.ts:357:30
                             (i32.const 7)
                             ;;@ core/cpu/opcodes.ts:354:10
                             (tee_local $0
                              ;;@ core/cpu/opcodes.ts:354:24
                              (call $core/helpers/index/resetBitOnByte
                               ;;@ core/cpu/opcodes.ts:354:39
                               (i32.const 0)
                               (get_local $0)
                              )
                             )
                            )
                            ;;@ core/cpu/opcodes.ts:360:17
                            (block (result i32)
                             ;;@ core/cpu/opcodes.ts:361:12
                             (set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
                              ;;@ core/cpu/opcodes.ts:361:33
                              (i32.const 0)
                             )
                             ;;@ core/cpu/opcodes.ts:362:26
                             (call $core/helpers/index/resetBitOnByte
                              ;;@ core/cpu/opcodes.ts:362:41
                              (i32.const 7)
                              (get_local $0)
                             )
                            )
                            ;;@ core/cpu/opcodes.ts:357:47
                            (block (result i32)
                             ;;@ core/cpu/opcodes.ts:358:12
                             (set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
                              ;;@ core/cpu/opcodes.ts:358:33
                              (i32.const 1)
                             )
                             ;;@ core/cpu/opcodes.ts:359:26
                             (call $core/helpers/index/setBitOnByte
                              ;;@ core/cpu/opcodes.ts:359:39
                              (i32.const 7)
                              (get_local $0)
                             )
                            )
                           )
                          )
                         )
                         ;;@ core/cpu/opcodes.ts:371:17
                         (return
                          (i32.const 68)
                         )
                        )
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:376:6
                      (set_global $core/cpu/cpu/Cpu.isStopped
                       ;;@ core/cpu/opcodes.ts:376:22
                       (i32.const 1)
                      )
                      (br $folding-inner1)
                     )
                     ;;@ core/cpu/opcodes.ts:386:6
                     (set_global $core/cpu/cpu/Cpu.registerD
                      (i32.and
                       ;;@ core/cpu/opcodes.ts:386:22
                       (call $core/helpers/index/splitHighByte
                        ;;@ core/cpu/opcodes.ts:384:6
                        (tee_local $0
                         ;;@ core/cpu/opcodes.ts:384:38
                         (i32.and
                          (call $core/cpu/opcodes/getConcatenatedDataByte)
                          (i32.const 65535)
                         )
                        )
                       )
                       (i32.const 255)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:387:6
                     (set_global $core/cpu/cpu/Cpu.registerE
                      (i32.and
                       ;;@ core/cpu/opcodes.ts:387:22
                       (call $core/helpers/index/splitLowByte
                        (get_local $0)
                       )
                       (i32.const 255)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:388:6
                     (set_global $core/cpu/cpu/Cpu.programCounter
                      ;;@ core/cpu/opcodes.ts:388:27
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:388:39
                       (i32.add
                        (get_global $core/cpu/cpu/Cpu.programCounter)
                        ;;@ core/cpu/opcodes.ts:388:60
                        (i32.const 2)
                       )
                      )
                     )
                     (br $folding-inner3)
                    )
                    ;;@ core/cpu/opcodes.ts:395:6
                    (call $core/cpu/opcodes/eightBitStoreSyncCycles
                     ;;@ core/cpu/opcodes.ts:395:30
                     (call $core/helpers/index/concatenateBytes
                      ;;@ core/cpu/opcodes.ts:395:47
                      (get_global $core/cpu/cpu/Cpu.registerD)
                      ;;@ core/cpu/opcodes.ts:395:62
                      (get_global $core/cpu/cpu/Cpu.registerE)
                     )
                     ;;@ core/cpu/opcodes.ts:395:78
                     (get_global $core/cpu/cpu/Cpu.registerA)
                    )
                    (br $folding-inner3)
                   )
                   ;;@ core/cpu/opcodes.ts:402:6
                   (set_global $core/cpu/cpu/Cpu.registerD
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:402:22
                     (call $core/helpers/index/splitHighByte
                      ;;@ core/cpu/opcodes.ts:401:6
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:401:20
                       (call $core/portable/portable/u16Portable
                        ;;@ core/cpu/opcodes.ts:401:32
                        (i32.add
                         ;;@ core/cpu/opcodes.ts:400:24
                         (call $core/helpers/index/concatenateBytes
                          ;;@ core/cpu/opcodes.ts:400:46
                          (get_global $core/cpu/cpu/Cpu.registerD)
                          ;;@ core/cpu/opcodes.ts:400:61
                          (get_global $core/cpu/cpu/Cpu.registerE)
                         )
                         ;;@ core/cpu/opcodes.ts:401:46
                         (i32.const 1)
                        )
                       )
                      )
                     )
                     (i32.const 255)
                    )
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:409:6
                  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   ;;@ core/cpu/opcodes.ts:409:39
                   (get_global $core/cpu/cpu/Cpu.registerD)
                   ;;@ core/cpu/opcodes.ts:409:54
                   (i32.const 1)
                  )
                  ;;@ core/cpu/opcodes.ts:410:6
                  (set_global $core/cpu/cpu/Cpu.registerD
                   ;;@ core/cpu/opcodes.ts:410:22
                   (call $core/helpers/index/splitLowByte
                    ;;@ core/cpu/opcodes.ts:410:33
                    (i32.add
                     (get_global $core/cpu/cpu/Cpu.registerD)
                     ;;@ core/cpu/opcodes.ts:410:49
                     (i32.const 1)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:411:6
                  (if
                   ;;@ core/cpu/opcodes.ts:411:10
                   (get_global $core/cpu/cpu/Cpu.registerD)
                   ;;@ core/cpu/opcodes.ts:413:13
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:414:20
                    (i32.const 0)
                   )
                   ;;@ core/cpu/opcodes.ts:411:31
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:412:20
                    (i32.const 1)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:416:6
                  (call $core/cpu/flags/setSubtractFlag
                   ;;@ core/cpu/opcodes.ts:416:22
                   (i32.const 0)
                  )
                  (br $folding-inner3)
                 )
                 ;;@ core/cpu/opcodes.ts:422:6
                 (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  ;;@ core/cpu/opcodes.ts:422:39
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:422:54
                  (i32.const -1)
                 )
                 ;;@ core/cpu/opcodes.ts:423:6
                 (set_global $core/cpu/cpu/Cpu.registerD
                  ;;@ core/cpu/opcodes.ts:423:22
                  (call $core/helpers/index/splitLowByte
                   ;;@ core/cpu/opcodes.ts:423:33
                   (i32.sub
                    (get_global $core/cpu/cpu/Cpu.registerD)
                    ;;@ core/cpu/opcodes.ts:423:49
                    (i32.const 1)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:424:6
                 (if
                  ;;@ core/cpu/opcodes.ts:424:10
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:426:13
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:427:20
                   (i32.const 0)
                  )
                  ;;@ core/cpu/opcodes.ts:424:31
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:425:20
                   (i32.const 1)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:429:6
                 (call $core/cpu/flags/setSubtractFlag
                  ;;@ core/cpu/opcodes.ts:429:22
                  (i32.const 1)
                 )
                 (br $folding-inner3)
                )
                ;;@ core/cpu/opcodes.ts:436:6
                (set_global $core/cpu/cpu/Cpu.registerD
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:436:22
                  (call $core/cpu/opcodes/getDataByteOne)
                  (i32.const 255)
                 )
                )
                (br $folding-inner1)
               )
               ;;@ core/cpu/opcodes.ts:445:6
               (set_local $0
                ;;@ core/cpu/opcodes.ts:445:23
                (i32.const 0)
               )
               ;;@ core/cpu/opcodes.ts:446:6
               (if
                ;;@ core/cpu/opcodes.ts:446:10
                (i32.eq
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:446:11
                  (get_global $core/cpu/cpu/Cpu.registerA)
                  ;;@ core/cpu/opcodes.ts:446:27
                  (i32.const 128)
                 )
                 ;;@ core/cpu/opcodes.ts:446:37
                 (i32.const 128)
                )
                ;;@ core/cpu/opcodes.ts:446:43
                (set_local $0
                 ;;@ core/cpu/opcodes.ts:447:21
                 (i32.const 1)
                )
               )
               ;;@ core/cpu/opcodes.ts:449:6
               (set_global $core/cpu/cpu/Cpu.registerA
                ;;@ core/cpu/opcodes.ts:449:22
                (call $core/helpers/index/rotateByteLeftThroughCarry
                 ;;@ core/cpu/opcodes.ts:449:49
                 (get_global $core/cpu/cpu/Cpu.registerA)
                )
               )
               (br $folding-inner2)
              )
              ;;@ core/cpu/opcodes.ts:468:6
              (call $core/cpu/instructions/relativeJump
               ;;@ core/cpu/opcodes.ts:468:19
               (call $core/cpu/opcodes/getDataByteOne)
              )
              ;;@ core/cpu/opcodes.ts:469:13
              (return
               (i32.const 8)
              )
             )
             ;;@ core/cpu/opcodes.ts:477:6
             (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
              ;;@ core/cpu/opcodes.ts:475:6
              (tee_local $0
               ;;@ core/cpu/opcodes.ts:475:28
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:475:50
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:475:65
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
              ;;@ core/cpu/opcodes.ts:477:61
              (i32.and
               ;;@ core/cpu/opcodes.ts:476:6
               (tee_local $1
                ;;@ core/cpu/opcodes.ts:476:29
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:476:51
                 (get_global $core/cpu/cpu/Cpu.registerD)
                 ;;@ core/cpu/opcodes.ts:476:66
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
               )
               (i32.const 65535)
              )
              ;;@ core/cpu/opcodes.ts:477:79
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:479:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:479:22
               (call $core/helpers/index/splitHighByte
                ;;@ core/cpu/opcodes.ts:478:6
                (tee_local $0
                 ;;@ core/cpu/opcodes.ts:478:24
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:478:36
                  (i32.add
                   (get_local $0)
                   (get_local $1)
                  )
                 )
                )
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:480:6
             (set_global $core/cpu/cpu/Cpu.registerL
              (i32.and
               ;;@ core/cpu/opcodes.ts:480:22
               (call $core/helpers/index/splitLowByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:481:6
             (call $core/cpu/flags/setSubtractFlag
              ;;@ core/cpu/opcodes.ts:481:22
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:482:13
             (return
              (i32.const 8)
             )
            )
            ;;@ core/cpu/opcodes.ts:488:6
            (set_global $core/cpu/cpu/Cpu.registerA
             (i32.and
              ;;@ core/cpu/opcodes.ts:488:22
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:488:49
               (i32.and
                ;;@ core/cpu/opcodes.ts:486:29
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:486:51
                 (get_global $core/cpu/cpu/Cpu.registerD)
                 ;;@ core/cpu/opcodes.ts:486:66
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (i32.const 65535)
               )
              )
              (i32.const 255)
             )
            )
            (br $folding-inner3)
           )
           ;;@ core/cpu/opcodes.ts:495:6
           (set_global $core/cpu/cpu/Cpu.registerD
            (i32.and
             ;;@ core/cpu/opcodes.ts:495:22
             (call $core/helpers/index/splitHighByte
              ;;@ core/cpu/opcodes.ts:494:6
              (tee_local $0
               ;;@ core/cpu/opcodes.ts:494:20
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:494:32
                (i32.sub
                 ;;@ core/cpu/opcodes.ts:493:29
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:493:51
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:493:66
                  (get_global $core/cpu/cpu/Cpu.registerE)
                 )
                 ;;@ core/cpu/opcodes.ts:494:46
                 (i32.const 1)
                )
               )
              )
             )
             (i32.const 255)
            )
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:502:6
          (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           ;;@ core/cpu/opcodes.ts:502:39
           (get_global $core/cpu/cpu/Cpu.registerE)
           ;;@ core/cpu/opcodes.ts:502:54
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:503:6
          (set_global $core/cpu/cpu/Cpu.registerE
           ;;@ core/cpu/opcodes.ts:503:22
           (call $core/helpers/index/splitLowByte
            ;;@ core/cpu/opcodes.ts:503:33
            (i32.add
             (get_global $core/cpu/cpu/Cpu.registerE)
             ;;@ core/cpu/opcodes.ts:503:49
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:504:6
          (if
           ;;@ core/cpu/opcodes.ts:504:10
           (get_global $core/cpu/cpu/Cpu.registerE)
           ;;@ core/cpu/opcodes.ts:506:13
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:507:20
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:504:31
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:505:20
            (i32.const 1)
           )
          )
          ;;@ core/cpu/opcodes.ts:509:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:509:22
           (i32.const 0)
          )
          (br $folding-inner3)
         )
         ;;@ core/cpu/opcodes.ts:515:6
         (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          ;;@ core/cpu/opcodes.ts:515:39
          (get_global $core/cpu/cpu/Cpu.registerE)
          ;;@ core/cpu/opcodes.ts:515:54
          (i32.const -1)
         )
         ;;@ core/cpu/opcodes.ts:516:6
         (set_global $core/cpu/cpu/Cpu.registerE
          ;;@ core/cpu/opcodes.ts:516:22
          (call $core/helpers/index/splitLowByte
           ;;@ core/cpu/opcodes.ts:516:33
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.registerE)
            ;;@ core/cpu/opcodes.ts:516:49
            (i32.const 1)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:517:6
         (if
          ;;@ core/cpu/opcodes.ts:517:10
          (get_global $core/cpu/cpu/Cpu.registerE)
          ;;@ core/cpu/opcodes.ts:519:13
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:520:20
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:517:31
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:518:20
           (i32.const 1)
          )
         )
         ;;@ core/cpu/opcodes.ts:522:6
         (call $core/cpu/flags/setSubtractFlag
          ;;@ core/cpu/opcodes.ts:522:22
          (i32.const 1)
         )
         (br $folding-inner3)
        )
        ;;@ core/cpu/opcodes.ts:529:6
        (set_global $core/cpu/cpu/Cpu.registerE
         (i32.and
          ;;@ core/cpu/opcodes.ts:529:22
          (call $core/cpu/opcodes/getDataByteOne)
          (i32.const 255)
         )
        )
        (br $folding-inner1)
       )
       ;;@ core/cpu/opcodes.ts:538:6
       (set_local $0
        ;;@ core/cpu/opcodes.ts:538:22
        (i32.const 0)
       )
       ;;@ core/cpu/opcodes.ts:539:6
       (if
        ;;@ core/cpu/opcodes.ts:539:10
        (i32.eq
         (i32.and
          ;;@ core/cpu/opcodes.ts:539:11
          (get_global $core/cpu/cpu/Cpu.registerA)
          ;;@ core/cpu/opcodes.ts:539:27
          (i32.const 1)
         )
         ;;@ core/cpu/opcodes.ts:539:37
         (i32.const 1)
        )
        ;;@ core/cpu/opcodes.ts:539:43
        (set_local $0
         ;;@ core/cpu/opcodes.ts:540:20
         (i32.const 1)
        )
       )
       ;;@ core/cpu/opcodes.ts:542:6
       (set_global $core/cpu/cpu/Cpu.registerA
        ;;@ core/cpu/opcodes.ts:542:22
        (call $core/helpers/index/rotateByteRightThroughCarry
         ;;@ core/cpu/opcodes.ts:542:50
         (get_global $core/cpu/cpu/Cpu.registerA)
        )
       )
       (br $folding-inner2)
      )
      (return
       (i32.const -1)
      )
     )
     ;;@ core/cpu/opcodes.ts:403:6
     (set_global $core/cpu/cpu/Cpu.registerE
      (i32.and
       ;;@ core/cpu/opcodes.ts:403:22
       (call $core/helpers/index/splitLowByte
        (get_local $0)
       )
       (i32.const 255)
      )
     )
     ;;@ core/cpu/opcodes.ts:404:13
     (return
      (i32.const 8)
     )
    )
    ;;@ core/cpu/opcodes.ts:377:6
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/cpu/opcodes.ts:377:27
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:377:39
      (i32.add
       (get_global $core/cpu/cpu/Cpu.programCounter)
       ;;@ core/cpu/opcodes.ts:377:60
       (i32.const 1)
      )
     )
    )
    (br $folding-inner3)
   )
   ;;@ core/cpu/opcodes.ts:451:6
   (if
    (get_local $0)
    ;;@ core/cpu/opcodes.ts:451:22
    (call $core/cpu/flags/setCarryFlag
     ;;@ core/cpu/opcodes.ts:452:21
     (i32.const 1)
    )
    ;;@ core/cpu/opcodes.ts:453:13
    (call $core/cpu/flags/setCarryFlag
     ;;@ core/cpu/opcodes.ts:454:21
     (i32.const 0)
    )
   )
   ;;@ core/cpu/opcodes.ts:457:6
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/opcodes.ts:457:18
    (i32.const 0)
   )
   ;;@ core/cpu/opcodes.ts:458:6
   (call $core/cpu/flags/setSubtractFlag
    ;;@ core/cpu/opcodes.ts:458:22
    (i32.const 0)
   )
   ;;@ core/cpu/opcodes.ts:459:6
   (call $core/cpu/flags/setHalfCarryFlag
    ;;@ core/cpu/opcodes.ts:459:23
    (i32.const 0)
   )
  )
  ;;@ core/cpu/opcodes.ts:389:13
  (i32.const 4)
 )
 (func $core/cpu/flags/getZeroFlag (; 184 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/flags.ts:37:32
  (i32.and
   ;;@ core/cpu/flags.ts:37:9
   (i32.shr_u
    ;;@ core/cpu/flags.ts:37:10
    (get_global $core/cpu/cpu/Cpu.registerF)
    ;;@ core/cpu/flags.ts:37:27
    (i32.const 7)
   )
   ;;@ core/cpu/flags.ts:37:32
   (i32.const 1)
  )
 )
 (func $core/cpu/flags/getHalfCarryFlag (; 185 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/flags.ts:45:32
  (i32.and
   ;;@ core/cpu/flags.ts:45:9
   (i32.shr_u
    ;;@ core/cpu/flags.ts:45:10
    (get_global $core/cpu/cpu/Cpu.registerF)
    ;;@ core/cpu/flags.ts:45:27
    (i32.const 5)
   )
   ;;@ core/cpu/flags.ts:45:32
   (i32.const 1)
  )
 )
 (func $core/cpu/flags/getSubtractFlag (; 186 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/flags.ts:41:32
  (i32.and
   ;;@ core/cpu/flags.ts:41:9
   (i32.shr_u
    ;;@ core/cpu/flags.ts:41:10
    (get_global $core/cpu/cpu/Cpu.registerF)
    ;;@ core/cpu/flags.ts:41:27
    (i32.const 6)
   )
   ;;@ core/cpu/flags.ts:41:32
   (i32.const 1)
  )
 )
 (func $core/cpu/opcodes/handleOpcode2x (; 187 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner1
   (block $folding-inner0
    (block $break|0
     (block $case15|0
      (block $case14|0
       (block $case13|0
        (block $case12|0
         (block $case11|0
          (block $case10|0
           (block $case9|0
            (block $case8|0
             (block $case7|0
              (block $case6|0
               (block $case5|0
                (block $case4|0
                 (block $case3|0
                  (block $case2|0
                   (block $case1|0
                    (if
                     (i32.ne
                      (get_local $0)
                      ;;@ core/cpu/opcodes.ts:561:9
                      (i32.const 32)
                     )
                     (block
                      (block $tablify|0
                       (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                        (i32.sub
                         (get_local $0)
                         (i32.const 33)
                        )
                       )
                      )
                      (br $break|0)
                     )
                    )
                    ;;@ core/cpu/opcodes.ts:566:6
                    (if
                     ;;@ core/cpu/opcodes.ts:566:10
                     (call $core/cpu/flags/getZeroFlag)
                     ;;@ core/cpu/opcodes.ts:570:13
                     (set_global $core/cpu/cpu/Cpu.programCounter
                      ;;@ core/cpu/opcodes.ts:571:29
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:571:41
                       (i32.add
                        (get_global $core/cpu/cpu/Cpu.programCounter)
                        ;;@ core/cpu/opcodes.ts:571:62
                        (i32.const 1)
                       )
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:566:31
                     (call $core/cpu/instructions/relativeJump
                      ;;@ core/cpu/opcodes.ts:568:21
                      (call $core/cpu/opcodes/getDataByteOne)
                     )
                    )
                    ;;@ core/cpu/opcodes.ts:573:13
                    (return
                     (i32.const 8)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:579:6
                   (set_global $core/cpu/cpu/Cpu.registerH
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:579:22
                     (call $core/helpers/index/splitHighByte
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:579:40
                       (i32.and
                        ;;@ core/cpu/opcodes.ts:578:31
                        (call $core/cpu/opcodes/getConcatenatedDataByte)
                        (i32.const 65535)
                       )
                      )
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:580:6
                   (set_global $core/cpu/cpu/Cpu.registerL
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:580:22
                     (call $core/helpers/index/splitLowByte
                      (get_local $0)
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:581:6
                   (set_global $core/cpu/cpu/Cpu.programCounter
                    ;;@ core/cpu/opcodes.ts:581:27
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:581:39
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.programCounter)
                      ;;@ core/cpu/opcodes.ts:581:60
                      (i32.const 2)
                     )
                    )
                   )
                   (br $folding-inner1)
                  )
                  ;;@ core/cpu/opcodes.ts:588:6
                  (call $core/cpu/opcodes/eightBitStoreSyncCycles
                   ;;@ core/cpu/opcodes.ts:588:30
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:586:6
                    (tee_local $0
                     ;;@ core/cpu/opcodes.ts:586:29
                     (call $core/helpers/index/concatenateBytes
                      ;;@ core/cpu/opcodes.ts:586:51
                      (get_global $core/cpu/cpu/Cpu.registerH)
                      ;;@ core/cpu/opcodes.ts:586:66
                      (get_global $core/cpu/cpu/Cpu.registerL)
                     )
                    )
                    (i32.const 65535)
                   )
                   ;;@ core/cpu/opcodes.ts:588:43
                   (get_global $core/cpu/cpu/Cpu.registerA)
                  )
                  ;;@ core/cpu/opcodes.ts:590:6
                  (set_global $core/cpu/cpu/Cpu.registerH
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:590:22
                    (call $core/helpers/index/splitHighByte
                     ;;@ core/cpu/opcodes.ts:589:6
                     (tee_local $0
                      ;;@ core/cpu/opcodes.ts:589:20
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:589:32
                       (i32.add
                        (get_local $0)
                        ;;@ core/cpu/opcodes.ts:589:46
                        (i32.const 1)
                       )
                      )
                     )
                    )
                    (i32.const 255)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:591:6
                  (set_global $core/cpu/cpu/Cpu.registerL
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:591:22
                    (call $core/helpers/index/splitLowByte
                     (get_local $0)
                    )
                    (i32.const 255)
                   )
                  )
                  (br $folding-inner1)
                 )
                 ;;@ core/cpu/opcodes.ts:598:6
                 (set_global $core/cpu/cpu/Cpu.registerH
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:598:22
                   (call $core/helpers/index/splitHighByte
                    ;;@ core/cpu/opcodes.ts:597:6
                    (tee_local $0
                     ;;@ core/cpu/opcodes.ts:597:20
                     (call $core/portable/portable/u16Portable
                      ;;@ core/cpu/opcodes.ts:597:32
                      (i32.add
                       ;;@ core/cpu/opcodes.ts:596:24
                       (call $core/helpers/index/concatenateBytes
                        ;;@ core/cpu/opcodes.ts:596:46
                        (get_global $core/cpu/cpu/Cpu.registerH)
                        ;;@ core/cpu/opcodes.ts:596:61
                        (get_global $core/cpu/cpu/Cpu.registerL)
                       )
                       ;;@ core/cpu/opcodes.ts:597:46
                       (i32.const 1)
                      )
                     )
                    )
                   )
                   (i32.const 255)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:599:6
                 (set_global $core/cpu/cpu/Cpu.registerL
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:599:22
                   (call $core/helpers/index/splitLowByte
                    (get_local $0)
                   )
                   (i32.const 255)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:600:13
                 (return
                  (i32.const 8)
                 )
                )
                ;;@ core/cpu/opcodes.ts:605:6
                (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                 ;;@ core/cpu/opcodes.ts:605:39
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:605:54
                 (i32.const 1)
                )
                ;;@ core/cpu/opcodes.ts:606:6
                (set_global $core/cpu/cpu/Cpu.registerH
                 ;;@ core/cpu/opcodes.ts:606:22
                 (call $core/helpers/index/splitLowByte
                  ;;@ core/cpu/opcodes.ts:606:33
                  (i32.add
                   (get_global $core/cpu/cpu/Cpu.registerH)
                   ;;@ core/cpu/opcodes.ts:606:49
                   (i32.const 1)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:607:6
                (if
                 ;;@ core/cpu/opcodes.ts:607:10
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:609:13
                 (call $core/cpu/flags/setZeroFlag
                  ;;@ core/cpu/opcodes.ts:610:20
                  (i32.const 0)
                 )
                 ;;@ core/cpu/opcodes.ts:607:31
                 (call $core/cpu/flags/setZeroFlag
                  ;;@ core/cpu/opcodes.ts:608:20
                  (i32.const 1)
                 )
                )
                ;;@ core/cpu/opcodes.ts:612:6
                (call $core/cpu/flags/setSubtractFlag
                 ;;@ core/cpu/opcodes.ts:612:22
                 (i32.const 0)
                )
                (br $folding-inner1)
               )
               ;;@ core/cpu/opcodes.ts:618:6
               (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                ;;@ core/cpu/opcodes.ts:618:39
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:618:54
                (i32.const -1)
               )
               ;;@ core/cpu/opcodes.ts:619:6
               (set_global $core/cpu/cpu/Cpu.registerH
                ;;@ core/cpu/opcodes.ts:619:22
                (call $core/helpers/index/splitLowByte
                 ;;@ core/cpu/opcodes.ts:619:33
                 (i32.sub
                  (get_global $core/cpu/cpu/Cpu.registerH)
                  ;;@ core/cpu/opcodes.ts:619:49
                  (i32.const 1)
                 )
                )
               )
               ;;@ core/cpu/opcodes.ts:620:6
               (if
                ;;@ core/cpu/opcodes.ts:620:10
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:622:13
                (call $core/cpu/flags/setZeroFlag
                 ;;@ core/cpu/opcodes.ts:623:20
                 (i32.const 0)
                )
                ;;@ core/cpu/opcodes.ts:620:31
                (call $core/cpu/flags/setZeroFlag
                 ;;@ core/cpu/opcodes.ts:621:20
                 (i32.const 1)
                )
               )
               ;;@ core/cpu/opcodes.ts:625:6
               (call $core/cpu/flags/setSubtractFlag
                ;;@ core/cpu/opcodes.ts:625:22
                (i32.const 1)
               )
               (br $folding-inner1)
              )
              ;;@ core/cpu/opcodes.ts:632:6
              (set_global $core/cpu/cpu/Cpu.registerH
               (i32.and
                ;;@ core/cpu/opcodes.ts:632:22
                (call $core/cpu/opcodes/getDataByteOne)
                (i32.const 255)
               )
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:642:6
             (if
              ;;@ core/cpu/opcodes.ts:642:10
              (i32.gt_u
               (call $core/cpu/flags/getHalfCarryFlag)
               ;;@ core/cpu/opcodes.ts:642:31
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:642:34
              (set_local $1
               (i32.const 6)
              )
             )
             ;;@ core/cpu/opcodes.ts:645:6
             (if
              ;;@ core/cpu/opcodes.ts:645:10
              (i32.gt_u
               (call $core/cpu/flags/getCarryFlag)
               ;;@ core/cpu/opcodes.ts:645:27
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:645:30
              (set_local $1
               ;;@ core/cpu/opcodes.ts:646:21
               (i32.or
                (get_local $1)
                ;;@ core/cpu/opcodes.ts:646:34
                (i32.const 96)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:662:6
             (if
              (tee_local $0
               ;;@ core/cpu/opcodes.ts:649:6
               (if (result i32)
                ;;@ core/cpu/opcodes.ts:649:10
                (i32.gt_u
                 (call $core/cpu/flags/getSubtractFlag)
                 ;;@ core/cpu/opcodes.ts:649:30
                 (i32.const 0)
                )
                ;;@ core/cpu/opcodes.ts:650:27
                (call $core/helpers/index/splitLowByte
                 ;;@ core/cpu/opcodes.ts:650:38
                 (i32.sub
                  (get_global $core/cpu/cpu/Cpu.registerA)
                  (get_local $1)
                 )
                )
                ;;@ core/cpu/opcodes.ts:651:13
                (block (result i32)
                 ;;@ core/cpu/opcodes.ts:652:8
                 (if
                  ;;@ core/cpu/opcodes.ts:652:12
                  (i32.gt_u
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:652:13
                    (get_global $core/cpu/cpu/Cpu.registerA)
                    ;;@ core/cpu/opcodes.ts:652:29
                    (i32.const 15)
                   )
                   ;;@ core/cpu/opcodes.ts:652:37
                   (i32.const 9)
                  )
                  ;;@ core/cpu/opcodes.ts:652:43
                  (set_local $1
                   ;;@ core/cpu/opcodes.ts:653:23
                   (i32.or
                    (get_local $1)
                    ;;@ core/cpu/opcodes.ts:653:36
                    (i32.const 6)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:655:8
                 (if
                  ;;@ core/cpu/opcodes.ts:655:12
                  (i32.gt_u
                   (get_global $core/cpu/cpu/Cpu.registerA)
                   ;;@ core/cpu/opcodes.ts:655:28
                   (i32.const 153)
                  )
                  ;;@ core/cpu/opcodes.ts:655:34
                  (set_local $1
                   ;;@ core/cpu/opcodes.ts:656:23
                   (i32.or
                    (get_local $1)
                    ;;@ core/cpu/opcodes.ts:656:36
                    (i32.const 96)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:658:27
                 (call $core/helpers/index/splitLowByte
                  ;;@ core/cpu/opcodes.ts:658:38
                  (i32.add
                   (get_global $core/cpu/cpu/Cpu.registerA)
                   (get_local $1)
                  )
                 )
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:664:13
              (call $core/cpu/flags/setZeroFlag
               ;;@ core/cpu/opcodes.ts:665:20
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:662:34
              (call $core/cpu/flags/setZeroFlag
               ;;@ core/cpu/opcodes.ts:663:20
               (i32.const 1)
              )
             )
             ;;@ core/cpu/opcodes.ts:667:6
             (if
              ;;@ core/cpu/opcodes.ts:667:10
              (i32.and
               (get_local $1)
               ;;@ core/cpu/opcodes.ts:667:24
               (i32.const 96)
              )
              ;;@ core/cpu/opcodes.ts:667:37
              (call $core/cpu/flags/setCarryFlag
               ;;@ core/cpu/opcodes.ts:668:21
               (i32.const 1)
              )
              ;;@ core/cpu/opcodes.ts:669:13
              (call $core/cpu/flags/setCarryFlag
               ;;@ core/cpu/opcodes.ts:670:21
               (i32.const 0)
              )
             )
             ;;@ core/cpu/opcodes.ts:672:6
             (call $core/cpu/flags/setHalfCarryFlag
              ;;@ core/cpu/opcodes.ts:672:23
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:674:6
             (set_global $core/cpu/cpu/Cpu.registerA
              (get_local $0)
             )
             (br $folding-inner1)
            )
            ;;@ core/cpu/opcodes.ts:679:6
            (if
             ;;@ core/cpu/opcodes.ts:679:10
             (i32.gt_u
              (call $core/cpu/flags/getZeroFlag)
              ;;@ core/cpu/opcodes.ts:679:26
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:679:29
             (call $core/cpu/instructions/relativeJump
              ;;@ core/cpu/opcodes.ts:681:21
              (call $core/cpu/opcodes/getDataByteOne)
             )
             ;;@ core/cpu/opcodes.ts:683:13
             (set_global $core/cpu/cpu/Cpu.programCounter
              ;;@ core/cpu/opcodes.ts:684:29
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:684:41
               (i32.add
                (get_global $core/cpu/cpu/Cpu.programCounter)
                ;;@ core/cpu/opcodes.ts:684:62
                (i32.const 1)
               )
              )
             )
            )
            ;;@ core/cpu/opcodes.ts:686:13
            (return
             (i32.const 8)
            )
           )
           ;;@ core/cpu/opcodes.ts:692:6
           (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
            ;;@ core/cpu/opcodes.ts:691:6
            (tee_local $1
             ;;@ core/cpu/opcodes.ts:691:29
             (call $core/helpers/index/concatenateBytes
              ;;@ core/cpu/opcodes.ts:691:51
              (get_global $core/cpu/cpu/Cpu.registerH)
              ;;@ core/cpu/opcodes.ts:691:66
              (get_global $core/cpu/cpu/Cpu.registerL)
             )
            )
            ;;@ core/cpu/opcodes.ts:692:57
            (i32.and
             (get_local $1)
             (i32.const 65535)
            )
            ;;@ core/cpu/opcodes.ts:692:70
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:694:6
           (set_global $core/cpu/cpu/Cpu.registerH
            (i32.and
             ;;@ core/cpu/opcodes.ts:694:22
             (call $core/helpers/index/splitHighByte
              ;;@ core/cpu/opcodes.ts:693:6
              (tee_local $1
               ;;@ core/cpu/opcodes.ts:693:20
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:693:32
                (i32.shl
                 (get_local $1)
                 ;;@ core/cpu/opcodes.ts:693:46
                 (i32.const 1)
                )
               )
              )
             )
             (i32.const 255)
            )
           )
           ;;@ core/cpu/opcodes.ts:695:6
           (set_global $core/cpu/cpu/Cpu.registerL
            (i32.and
             ;;@ core/cpu/opcodes.ts:695:22
             (call $core/helpers/index/splitLowByte
              (get_local $1)
             )
             (i32.const 255)
            )
           )
           ;;@ core/cpu/opcodes.ts:696:6
           (call $core/cpu/flags/setSubtractFlag
            ;;@ core/cpu/opcodes.ts:696:22
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:697:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:703:6
          (set_global $core/cpu/cpu/Cpu.registerA
           (i32.and
            ;;@ core/cpu/opcodes.ts:703:22
            (call $core/cpu/opcodes/eightBitLoadSyncCycles
             ;;@ core/cpu/opcodes.ts:703:49
             (i32.and
              ;;@ core/cpu/opcodes.ts:701:6
              (tee_local $1
               ;;@ core/cpu/opcodes.ts:701:29
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:701:51
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:701:66
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
              (i32.const 65535)
             )
            )
            (i32.const 255)
           )
          )
          ;;@ core/cpu/opcodes.ts:705:6
          (set_global $core/cpu/cpu/Cpu.registerH
           (i32.and
            ;;@ core/cpu/opcodes.ts:705:22
            (call $core/helpers/index/splitHighByte
             ;;@ core/cpu/opcodes.ts:704:6
             (tee_local $1
              ;;@ core/cpu/opcodes.ts:704:20
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:704:32
               (i32.add
                (get_local $1)
                ;;@ core/cpu/opcodes.ts:704:46
                (i32.const 1)
               )
              )
             )
            )
            (i32.const 255)
           )
          )
          ;;@ core/cpu/opcodes.ts:706:6
          (set_global $core/cpu/cpu/Cpu.registerL
           (i32.and
            ;;@ core/cpu/opcodes.ts:706:22
            (call $core/helpers/index/splitLowByte
             (get_local $1)
            )
            (i32.const 255)
           )
          )
          (br $folding-inner1)
         )
         ;;@ core/cpu/opcodes.ts:713:6
         (set_global $core/cpu/cpu/Cpu.registerH
          (i32.and
           ;;@ core/cpu/opcodes.ts:713:22
           (call $core/helpers/index/splitHighByte
            ;;@ core/cpu/opcodes.ts:712:6
            (tee_local $1
             ;;@ core/cpu/opcodes.ts:712:20
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:712:32
              (i32.sub
               ;;@ core/cpu/opcodes.ts:711:24
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:711:46
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:711:61
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
               ;;@ core/cpu/opcodes.ts:712:46
               (i32.const 1)
              )
             )
            )
           )
           (i32.const 255)
          )
         )
         ;;@ core/cpu/opcodes.ts:714:6
         (set_global $core/cpu/cpu/Cpu.registerL
          (i32.and
           ;;@ core/cpu/opcodes.ts:714:22
           (call $core/helpers/index/splitLowByte
            (get_local $1)
           )
           (i32.const 255)
          )
         )
         ;;@ core/cpu/opcodes.ts:715:13
         (return
          (i32.const 8)
         )
        )
        ;;@ core/cpu/opcodes.ts:720:6
        (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
         ;;@ core/cpu/opcodes.ts:720:39
         (get_global $core/cpu/cpu/Cpu.registerL)
         ;;@ core/cpu/opcodes.ts:720:54
         (i32.const 1)
        )
        ;;@ core/cpu/opcodes.ts:721:6
        (set_global $core/cpu/cpu/Cpu.registerL
         ;;@ core/cpu/opcodes.ts:721:22
         (call $core/helpers/index/splitLowByte
          ;;@ core/cpu/opcodes.ts:721:33
          (i32.add
           (get_global $core/cpu/cpu/Cpu.registerL)
           ;;@ core/cpu/opcodes.ts:721:49
           (i32.const 1)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:722:6
        (if
         ;;@ core/cpu/opcodes.ts:722:10
         (get_global $core/cpu/cpu/Cpu.registerL)
         ;;@ core/cpu/opcodes.ts:724:13
         (call $core/cpu/flags/setZeroFlag
          ;;@ core/cpu/opcodes.ts:725:20
          (i32.const 0)
         )
         ;;@ core/cpu/opcodes.ts:722:31
         (call $core/cpu/flags/setZeroFlag
          ;;@ core/cpu/opcodes.ts:723:20
          (i32.const 1)
         )
        )
        ;;@ core/cpu/opcodes.ts:727:6
        (call $core/cpu/flags/setSubtractFlag
         ;;@ core/cpu/opcodes.ts:727:22
         (i32.const 0)
        )
        (br $folding-inner1)
       )
       ;;@ core/cpu/opcodes.ts:733:6
       (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
        ;;@ core/cpu/opcodes.ts:733:39
        (get_global $core/cpu/cpu/Cpu.registerL)
        ;;@ core/cpu/opcodes.ts:733:54
        (i32.const -1)
       )
       ;;@ core/cpu/opcodes.ts:734:6
       (set_global $core/cpu/cpu/Cpu.registerL
        ;;@ core/cpu/opcodes.ts:734:22
        (call $core/helpers/index/splitLowByte
         ;;@ core/cpu/opcodes.ts:734:33
         (i32.sub
          (get_global $core/cpu/cpu/Cpu.registerL)
          ;;@ core/cpu/opcodes.ts:734:49
          (i32.const 1)
         )
        )
       )
       ;;@ core/cpu/opcodes.ts:735:6
       (if
        ;;@ core/cpu/opcodes.ts:735:10
        (get_global $core/cpu/cpu/Cpu.registerL)
        ;;@ core/cpu/opcodes.ts:737:13
        (call $core/cpu/flags/setZeroFlag
         ;;@ core/cpu/opcodes.ts:738:20
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:735:31
        (call $core/cpu/flags/setZeroFlag
         ;;@ core/cpu/opcodes.ts:736:20
         (i32.const 1)
        )
       )
       ;;@ core/cpu/opcodes.ts:740:6
       (call $core/cpu/flags/setSubtractFlag
        ;;@ core/cpu/opcodes.ts:740:22
        (i32.const 1)
       )
       (br $folding-inner1)
      )
      ;;@ core/cpu/opcodes.ts:746:6
      (set_global $core/cpu/cpu/Cpu.registerL
       (i32.and
        ;;@ core/cpu/opcodes.ts:746:22
        (call $core/cpu/opcodes/getDataByteOne)
        (i32.const 255)
       )
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:753:6
     (set_global $core/cpu/cpu/Cpu.registerA
      (i32.and
       ;;@ core/cpu/opcodes.ts:753:22
       (i32.xor
        ;;@ core/cpu/opcodes.ts:753:23
        (get_global $core/cpu/cpu/Cpu.registerA)
        (i32.const -1)
       )
       (i32.const 255)
      )
     )
     ;;@ core/cpu/opcodes.ts:754:6
     (call $core/cpu/flags/setSubtractFlag
      ;;@ core/cpu/opcodes.ts:754:22
      (i32.const 1)
     )
     ;;@ core/cpu/opcodes.ts:755:6
     (call $core/cpu/flags/setHalfCarryFlag
      ;;@ core/cpu/opcodes.ts:755:23
      (i32.const 1)
     )
     (br $folding-inner1)
    )
    (return
     (i32.const -1)
    )
   )
   ;;@ core/cpu/opcodes.ts:633:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:633:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:633:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:633:60
      (i32.const 1)
     )
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:582:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode3x (; 188 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner3
   (block $folding-inner2
    (block $folding-inner1
     (block $folding-inner0
      (block $break|0
       (block $case15|0
        (block $case14|0
         (block $case13|0
          (block $case12|0
           (block $case11|0
            (block $case10|0
             (block $case9|0
              (block $case8|0
               (block $case7|0
                (block $case6|0
                 (block $case5|0
                  (block $case4|0
                   (block $case3|0
                    (block $case2|0
                     (block $case1|0
                      (if
                       (i32.ne
                        (get_local $0)
                        ;;@ core/cpu/opcodes.ts:763:9
                        (i32.const 48)
                       )
                       (block
                        (block $tablify|0
                         (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                          (i32.sub
                           (get_local $0)
                           (i32.const 49)
                          )
                         )
                        )
                        (br $break|0)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:766:6
                      (if
                       ;;@ core/cpu/opcodes.ts:766:10
                       (call $core/cpu/flags/getCarryFlag)
                       ;;@ core/cpu/opcodes.ts:770:13
                       (set_global $core/cpu/cpu/Cpu.programCounter
                        ;;@ core/cpu/opcodes.ts:771:29
                        (call $core/portable/portable/u16Portable
                         ;;@ core/cpu/opcodes.ts:771:41
                         (i32.add
                          (get_global $core/cpu/cpu/Cpu.programCounter)
                          ;;@ core/cpu/opcodes.ts:771:62
                          (i32.const 1)
                         )
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:766:32
                       (call $core/cpu/instructions/relativeJump
                        ;;@ core/cpu/opcodes.ts:768:21
                        (call $core/cpu/opcodes/getDataByteOne)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:773:13
                      (return
                       (i32.const 8)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:778:6
                     (set_global $core/cpu/cpu/Cpu.stackPointer
                      (i32.and
                       ;;@ core/cpu/opcodes.ts:778:25
                       (call $core/cpu/opcodes/getConcatenatedDataByte)
                       (i32.const 65535)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:779:6
                     (set_global $core/cpu/cpu/Cpu.programCounter
                      ;;@ core/cpu/opcodes.ts:779:27
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:779:39
                       (i32.add
                        (get_global $core/cpu/cpu/Cpu.programCounter)
                        ;;@ core/cpu/opcodes.ts:779:60
                        (i32.const 2)
                       )
                      )
                     )
                     (br $folding-inner3)
                    )
                    ;;@ core/cpu/opcodes.ts:786:6
                    (call $core/cpu/opcodes/eightBitStoreSyncCycles
                     ;;@ core/cpu/opcodes.ts:786:30
                     (i32.and
                      ;;@ core/cpu/opcodes.ts:784:6
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:784:29
                       (call $core/helpers/index/concatenateBytes
                        ;;@ core/cpu/opcodes.ts:784:51
                        (get_global $core/cpu/cpu/Cpu.registerH)
                        ;;@ core/cpu/opcodes.ts:784:66
                        (get_global $core/cpu/cpu/Cpu.registerL)
                       )
                      )
                      (i32.const 65535)
                     )
                     ;;@ core/cpu/opcodes.ts:786:43
                     (get_global $core/cpu/cpu/Cpu.registerA)
                    )
                    (br $folding-inner2)
                   )
                   ;;@ core/cpu/opcodes.ts:794:6
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:794:25
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:794:37
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:794:56
                      (i32.const 1)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:795:13
                   (return
                    (i32.const 8)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:807:6
                  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   ;;@ core/cpu/opcodes.ts:802:6
                   (tee_local $1
                    ;;@ core/cpu/opcodes.ts:802:27
                    (call $core/cpu/opcodes/eightBitLoadSyncCycles
                     ;;@ core/cpu/opcodes.ts:802:54
                     (i32.and
                      ;;@ core/cpu/opcodes.ts:800:6
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:800:29
                       (call $core/helpers/index/concatenateBytes
                        ;;@ core/cpu/opcodes.ts:800:51
                        (get_global $core/cpu/cpu/Cpu.registerH)
                        ;;@ core/cpu/opcodes.ts:800:66
                        (get_global $core/cpu/cpu/Cpu.registerL)
                       )
                      )
                      (i32.const 65535)
                     )
                    )
                   )
                   (i32.const 1)
                  )
                  ;;@ core/cpu/opcodes.ts:810:6
                  (if
                   ;;@ core/cpu/opcodes.ts:808:6
                   (tee_local $1
                    ;;@ core/cpu/opcodes.ts:808:19
                    (call $core/helpers/index/splitLowByte
                     ;;@ core/cpu/opcodes.ts:808:30
                     (i32.add
                      (get_local $1)
                      (i32.const 1)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:812:13
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:813:20
                    (i32.const 0)
                   )
                   ;;@ core/cpu/opcodes.ts:810:28
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:811:20
                    (i32.const 1)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:815:6
                  (call $core/cpu/flags/setSubtractFlag
                   ;;@ core/cpu/opcodes.ts:815:22
                   (i32.const 0)
                  )
                  (br $folding-inner1)
                 )
                 ;;@ core/cpu/opcodes.ts:828:6
                 (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  ;;@ core/cpu/opcodes.ts:825:6
                  (tee_local $1
                   ;;@ core/cpu/opcodes.ts:825:27
                   (call $core/cpu/opcodes/eightBitLoadSyncCycles
                    ;;@ core/cpu/opcodes.ts:825:54
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:823:6
                     (tee_local $0
                      ;;@ core/cpu/opcodes.ts:823:29
                      (call $core/helpers/index/concatenateBytes
                       ;;@ core/cpu/opcodes.ts:823:51
                       (get_global $core/cpu/cpu/Cpu.registerH)
                       ;;@ core/cpu/opcodes.ts:823:66
                       (get_global $core/cpu/cpu/Cpu.registerL)
                      )
                     )
                     (i32.const 65535)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:828:55
                  (i32.const -1)
                 )
                 ;;@ core/cpu/opcodes.ts:830:6
                 (if
                  ;;@ core/cpu/opcodes.ts:829:6
                  (tee_local $1
                   ;;@ core/cpu/opcodes.ts:829:19
                   (call $core/helpers/index/splitLowByte
                    ;;@ core/cpu/opcodes.ts:829:30
                    (i32.sub
                     (get_local $1)
                     ;;@ core/cpu/opcodes.ts:829:43
                     (i32.const 1)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:832:13
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:833:20
                   (i32.const 0)
                  )
                  ;;@ core/cpu/opcodes.ts:830:28
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:831:20
                   (i32.const 1)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:835:6
                 (call $core/cpu/flags/setSubtractFlag
                  ;;@ core/cpu/opcodes.ts:835:22
                  (i32.const 1)
                 )
                 (br $folding-inner1)
                )
                ;;@ core/cpu/opcodes.ts:843:6
                (call $core/cpu/opcodes/eightBitStoreSyncCycles
                 ;;@ core/cpu/opcodes.ts:843:30
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:843:35
                  (call $core/helpers/index/concatenateBytes
                   ;;@ core/cpu/opcodes.ts:843:52
                   (get_global $core/cpu/cpu/Cpu.registerH)
                   ;;@ core/cpu/opcodes.ts:843:67
                   (get_global $core/cpu/cpu/Cpu.registerL)
                  )
                  (i32.const 65535)
                 )
                 ;;@ core/cpu/opcodes.ts:843:83
                 (i32.and
                  (call $core/cpu/opcodes/getDataByteOne)
                  (i32.const 255)
                 )
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:851:6
               (call $core/cpu/flags/setSubtractFlag
                ;;@ core/cpu/opcodes.ts:851:22
                (i32.const 0)
               )
               ;;@ core/cpu/opcodes.ts:852:6
               (call $core/cpu/flags/setHalfCarryFlag
                ;;@ core/cpu/opcodes.ts:852:23
                (i32.const 0)
               )
               ;;@ core/cpu/opcodes.ts:853:6
               (call $core/cpu/flags/setCarryFlag
                ;;@ core/cpu/opcodes.ts:853:19
                (i32.const 1)
               )
               (br $folding-inner3)
              )
              ;;@ core/cpu/opcodes.ts:858:6
              (if
               ;;@ core/cpu/opcodes.ts:858:10
               (i32.eq
                (call $core/cpu/flags/getCarryFlag)
                ;;@ core/cpu/opcodes.ts:858:29
                (i32.const 1)
               )
               ;;@ core/cpu/opcodes.ts:858:32
               (call $core/cpu/instructions/relativeJump
                ;;@ core/cpu/opcodes.ts:860:21
                (call $core/cpu/opcodes/getDataByteOne)
               )
               ;;@ core/cpu/opcodes.ts:862:13
               (set_global $core/cpu/cpu/Cpu.programCounter
                ;;@ core/cpu/opcodes.ts:863:29
                (call $core/portable/portable/u16Portable
                 ;;@ core/cpu/opcodes.ts:863:41
                 (i32.add
                  (get_global $core/cpu/cpu/Cpu.programCounter)
                  ;;@ core/cpu/opcodes.ts:863:62
                  (i32.const 1)
                 )
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:865:13
              (return
               (i32.const 8)
              )
             )
             ;;@ core/cpu/opcodes.ts:871:6
             (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
              ;;@ core/cpu/opcodes.ts:870:6
              (tee_local $1
               ;;@ core/cpu/opcodes.ts:870:29
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:870:51
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:870:66
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
              ;;@ core/cpu/opcodes.ts:871:62
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:871:80
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:873:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:873:22
               (call $core/helpers/index/splitHighByte
                ;;@ core/cpu/opcodes.ts:872:6
                (tee_local $0
                 ;;@ core/cpu/opcodes.ts:872:24
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:872:36
                  (i32.add
                   (get_local $1)
                   ;;@ core/cpu/opcodes.ts:872:56
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                  )
                 )
                )
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:874:6
             (set_global $core/cpu/cpu/Cpu.registerL
              (i32.and
               ;;@ core/cpu/opcodes.ts:874:22
               (call $core/helpers/index/splitLowByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:875:6
             (call $core/cpu/flags/setSubtractFlag
              ;;@ core/cpu/opcodes.ts:875:22
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:876:13
             (return
              (i32.const 8)
             )
            )
            ;;@ core/cpu/opcodes.ts:882:6
            (set_global $core/cpu/cpu/Cpu.registerA
             (i32.and
              ;;@ core/cpu/opcodes.ts:882:22
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:882:49
               (i32.and
                ;;@ core/cpu/opcodes.ts:880:6
                (tee_local $0
                 ;;@ core/cpu/opcodes.ts:880:29
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:880:51
                  (get_global $core/cpu/cpu/Cpu.registerH)
                  ;;@ core/cpu/opcodes.ts:880:66
                  (get_global $core/cpu/cpu/Cpu.registerL)
                 )
                )
                (i32.const 65535)
               )
              )
              (i32.const 255)
             )
            )
            (br $folding-inner2)
           )
           ;;@ core/cpu/opcodes.ts:890:6
           (set_global $core/cpu/cpu/Cpu.stackPointer
            ;;@ core/cpu/opcodes.ts:890:25
            (call $core/portable/portable/u16Portable
             ;;@ core/cpu/opcodes.ts:890:37
             (i32.sub
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:890:56
              (i32.const 1)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:891:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:896:6
          (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           ;;@ core/cpu/opcodes.ts:896:39
           (get_global $core/cpu/cpu/Cpu.registerA)
           ;;@ core/cpu/opcodes.ts:896:54
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:897:6
          (set_global $core/cpu/cpu/Cpu.registerA
           ;;@ core/cpu/opcodes.ts:897:22
           (call $core/helpers/index/splitLowByte
            ;;@ core/cpu/opcodes.ts:897:33
            (i32.add
             (get_global $core/cpu/cpu/Cpu.registerA)
             ;;@ core/cpu/opcodes.ts:897:49
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:898:6
          (if
           ;;@ core/cpu/opcodes.ts:898:10
           (get_global $core/cpu/cpu/Cpu.registerA)
           ;;@ core/cpu/opcodes.ts:900:13
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:901:20
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:898:31
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:899:20
            (i32.const 1)
           )
          )
          ;;@ core/cpu/opcodes.ts:903:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:903:22
           (i32.const 0)
          )
          (br $folding-inner3)
         )
         ;;@ core/cpu/opcodes.ts:909:6
         (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          ;;@ core/cpu/opcodes.ts:909:39
          (get_global $core/cpu/cpu/Cpu.registerA)
          ;;@ core/cpu/opcodes.ts:909:54
          (i32.const -1)
         )
         ;;@ core/cpu/opcodes.ts:910:6
         (set_global $core/cpu/cpu/Cpu.registerA
          ;;@ core/cpu/opcodes.ts:910:22
          (call $core/helpers/index/splitLowByte
           ;;@ core/cpu/opcodes.ts:910:33
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.registerA)
            ;;@ core/cpu/opcodes.ts:910:49
            (i32.const 1)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:911:6
         (if
          ;;@ core/cpu/opcodes.ts:911:10
          (get_global $core/cpu/cpu/Cpu.registerA)
          ;;@ core/cpu/opcodes.ts:913:13
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:914:20
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:911:31
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:912:20
           (i32.const 1)
          )
         )
         ;;@ core/cpu/opcodes.ts:916:6
         (call $core/cpu/flags/setSubtractFlag
          ;;@ core/cpu/opcodes.ts:916:22
          (i32.const 1)
         )
         (br $folding-inner3)
        )
        ;;@ core/cpu/opcodes.ts:922:6
        (set_global $core/cpu/cpu/Cpu.registerA
         (i32.and
          ;;@ core/cpu/opcodes.ts:922:22
          (call $core/cpu/opcodes/getDataByteOne)
          (i32.const 255)
         )
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:929:6
       (call $core/cpu/flags/setSubtractFlag
        ;;@ core/cpu/opcodes.ts:929:22
        (i32.const 0)
       )
       ;;@ core/cpu/opcodes.ts:930:6
       (call $core/cpu/flags/setHalfCarryFlag
        ;;@ core/cpu/opcodes.ts:930:23
        (i32.const 0)
       )
       ;;@ core/cpu/opcodes.ts:931:6
       (if
        ;;@ core/cpu/opcodes.ts:931:10
        (i32.gt_u
         (call $core/cpu/flags/getCarryFlag)
         ;;@ core/cpu/opcodes.ts:931:27
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:931:30
        (call $core/cpu/flags/setCarryFlag
         ;;@ core/cpu/opcodes.ts:932:21
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:933:13
        (call $core/cpu/flags/setCarryFlag
         ;;@ core/cpu/opcodes.ts:934:21
         (i32.const 1)
        )
       )
       (br $folding-inner3)
      )
      (return
       (i32.const -1)
      )
     )
     ;;@ core/cpu/opcodes.ts:844:6
     (set_global $core/cpu/cpu/Cpu.programCounter
      ;;@ core/cpu/opcodes.ts:844:27
      (call $core/portable/portable/u16Portable
       ;;@ core/cpu/opcodes.ts:844:39
       (i32.add
        (get_global $core/cpu/cpu/Cpu.programCounter)
        ;;@ core/cpu/opcodes.ts:844:60
        (i32.const 1)
       )
      )
     )
     (br $folding-inner3)
    )
    ;;@ core/cpu/opcodes.ts:817:6
    (call $core/cpu/opcodes/eightBitStoreSyncCycles
     ;;@ core/cpu/opcodes.ts:817:30
     (i32.and
      (get_local $0)
      (i32.const 65535)
     )
     (get_local $1)
    )
    (br $folding-inner3)
   )
   ;;@ core/cpu/opcodes.ts:788:6
   (set_global $core/cpu/cpu/Cpu.registerH
    (i32.and
     ;;@ core/cpu/opcodes.ts:788:22
     (call $core/helpers/index/splitHighByte
      ;;@ core/cpu/opcodes.ts:787:6
      (tee_local $0
       ;;@ core/cpu/opcodes.ts:787:20
       (call $core/portable/portable/u16Portable
        ;;@ core/cpu/opcodes.ts:787:32
        (i32.sub
         (get_local $0)
         ;;@ core/cpu/opcodes.ts:787:46
         (i32.const 1)
        )
       )
      )
     )
     (i32.const 255)
    )
   )
   ;;@ core/cpu/opcodes.ts:789:6
   (set_global $core/cpu/cpu/Cpu.registerL
    (i32.and
     ;;@ core/cpu/opcodes.ts:789:22
     (call $core/helpers/index/splitLowByte
      (get_local $0)
     )
     (i32.const 255)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:780:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode4x (; 189 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (get_local $0)
                     ;;@ core/cpu/opcodes.ts:943:9
                     (i32.const 64)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:948:9
                       (i32.const 65)
                      )
                     )
                     (block $tablify|0
                      (br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 66)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:951:6
                  (set_global $core/cpu/cpu/Cpu.registerB
                   ;;@ core/cpu/opcodes.ts:951:22
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:956:6
                 (set_global $core/cpu/cpu/Cpu.registerB
                  ;;@ core/cpu/opcodes.ts:956:22
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:961:6
                (set_global $core/cpu/cpu/Cpu.registerB
                 ;;@ core/cpu/opcodes.ts:961:22
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:966:6
               (set_global $core/cpu/cpu/Cpu.registerB
                ;;@ core/cpu/opcodes.ts:966:22
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:971:6
              (set_global $core/cpu/cpu/Cpu.registerB
               ;;@ core/cpu/opcodes.ts:971:22
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:977:6
             (set_global $core/cpu/cpu/Cpu.registerB
              (i32.and
               ;;@ core/cpu/opcodes.ts:977:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:977:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:977:66
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:977:81
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:982:6
            (set_global $core/cpu/cpu/Cpu.registerB
             ;;@ core/cpu/opcodes.ts:982:22
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:987:6
           (set_global $core/cpu/cpu/Cpu.registerC
            ;;@ core/cpu/opcodes.ts:987:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:997:6
         (set_global $core/cpu/cpu/Cpu.registerC
          ;;@ core/cpu/opcodes.ts:997:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1002:6
        (set_global $core/cpu/cpu/Cpu.registerC
         ;;@ core/cpu/opcodes.ts:1002:22
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1007:6
       (set_global $core/cpu/cpu/Cpu.registerC
        ;;@ core/cpu/opcodes.ts:1007:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1012:6
      (set_global $core/cpu/cpu/Cpu.registerC
       ;;@ core/cpu/opcodes.ts:1012:22
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1018:6
     (set_global $core/cpu/cpu/Cpu.registerC
      (i32.and
       ;;@ core/cpu/opcodes.ts:1018:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1018:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1018:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1018:81
         (get_global $core/cpu/cpu/Cpu.registerL)
        )
       )
       (i32.const 255)
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1023:6
    (set_global $core/cpu/cpu/Cpu.registerC
     ;;@ core/cpu/opcodes.ts:1023:22
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:947:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode5x (; 190 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (get_local $0)
                     ;;@ core/cpu/opcodes.ts:1031:9
                     (i32.const 80)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:1036:9
                       (i32.const 81)
                      )
                     )
                     (block $tablify|0
                      (br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 82)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1034:6
                   (set_global $core/cpu/cpu/Cpu.registerD
                    ;;@ core/cpu/opcodes.ts:1034:22
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1039:6
                  (set_global $core/cpu/cpu/Cpu.registerD
                   ;;@ core/cpu/opcodes.ts:1039:22
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1049:6
                (set_global $core/cpu/cpu/Cpu.registerD
                 ;;@ core/cpu/opcodes.ts:1049:22
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1054:6
               (set_global $core/cpu/cpu/Cpu.registerD
                ;;@ core/cpu/opcodes.ts:1054:22
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1059:6
              (set_global $core/cpu/cpu/Cpu.registerD
               ;;@ core/cpu/opcodes.ts:1059:22
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1065:6
             (set_global $core/cpu/cpu/Cpu.registerD
              (i32.and
               ;;@ core/cpu/opcodes.ts:1065:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:1065:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:1065:66
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:1065:81
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1070:6
            (set_global $core/cpu/cpu/Cpu.registerD
             ;;@ core/cpu/opcodes.ts:1070:22
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1075:6
           (set_global $core/cpu/cpu/Cpu.registerE
            ;;@ core/cpu/opcodes.ts:1075:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1080:6
          (set_global $core/cpu/cpu/Cpu.registerE
           ;;@ core/cpu/opcodes.ts:1080:22
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1085:6
         (set_global $core/cpu/cpu/Cpu.registerE
          ;;@ core/cpu/opcodes.ts:1085:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1095:6
       (set_global $core/cpu/cpu/Cpu.registerE
        ;;@ core/cpu/opcodes.ts:1095:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1100:6
      (set_global $core/cpu/cpu/Cpu.registerE
       ;;@ core/cpu/opcodes.ts:1100:22
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1106:6
     (set_global $core/cpu/cpu/Cpu.registerE
      (i32.and
       ;;@ core/cpu/opcodes.ts:1106:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1106:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1106:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1106:81
         (get_global $core/cpu/cpu/Cpu.registerL)
        )
       )
       (i32.const 255)
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1111:6
    (set_global $core/cpu/cpu/Cpu.registerE
     ;;@ core/cpu/opcodes.ts:1111:22
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1035:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode6x (; 191 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (get_local $0)
                     ;;@ core/cpu/opcodes.ts:1119:9
                     (i32.const 96)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:1124:9
                       (i32.const 97)
                      )
                     )
                     (block $tablify|0
                      (br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 98)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1122:6
                   (set_global $core/cpu/cpu/Cpu.registerH
                    ;;@ core/cpu/opcodes.ts:1122:22
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1127:6
                  (set_global $core/cpu/cpu/Cpu.registerH
                   ;;@ core/cpu/opcodes.ts:1127:22
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1132:6
                 (set_global $core/cpu/cpu/Cpu.registerH
                  ;;@ core/cpu/opcodes.ts:1132:22
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1137:6
                (set_global $core/cpu/cpu/Cpu.registerH
                 ;;@ core/cpu/opcodes.ts:1137:22
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1147:6
              (set_global $core/cpu/cpu/Cpu.registerH
               ;;@ core/cpu/opcodes.ts:1147:22
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1153:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:1153:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:1153:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:1153:66
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:1153:81
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1158:6
            (set_global $core/cpu/cpu/Cpu.registerH
             ;;@ core/cpu/opcodes.ts:1158:22
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1163:6
           (set_global $core/cpu/cpu/Cpu.registerL
            ;;@ core/cpu/opcodes.ts:1163:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1168:6
          (set_global $core/cpu/cpu/Cpu.registerL
           ;;@ core/cpu/opcodes.ts:1168:22
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1173:6
         (set_global $core/cpu/cpu/Cpu.registerL
          ;;@ core/cpu/opcodes.ts:1173:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1178:6
        (set_global $core/cpu/cpu/Cpu.registerL
         ;;@ core/cpu/opcodes.ts:1178:22
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1183:6
       (set_global $core/cpu/cpu/Cpu.registerL
        ;;@ core/cpu/opcodes.ts:1183:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1194:6
     (set_global $core/cpu/cpu/Cpu.registerL
      (i32.and
       ;;@ core/cpu/opcodes.ts:1194:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1194:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1194:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1194:81
         (get_global $core/cpu/cpu/Cpu.registerL)
        )
       )
       (i32.const 255)
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1199:6
    (set_global $core/cpu/cpu/Cpu.registerL
     ;;@ core/cpu/opcodes.ts:1199:22
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1123:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode7x (; 192 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (get_local $0)
                     ;;@ core/cpu/opcodes.ts:1207:9
                     (i32.const 112)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:1213:9
                       (i32.const 113)
                      )
                     )
                     (block $tablify|0
                      (br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 114)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1211:6
                   (call $core/cpu/opcodes/eightBitStoreSyncCycles
                    ;;@ core/cpu/opcodes.ts:1211:30
                    (call $core/helpers/index/concatenateBytes
                     ;;@ core/cpu/opcodes.ts:1211:47
                     (get_global $core/cpu/cpu/Cpu.registerH)
                     ;;@ core/cpu/opcodes.ts:1211:62
                     (get_global $core/cpu/cpu/Cpu.registerL)
                    )
                    ;;@ core/cpu/opcodes.ts:1211:78
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1217:6
                  (call $core/cpu/opcodes/eightBitStoreSyncCycles
                   ;;@ core/cpu/opcodes.ts:1217:30
                   (call $core/helpers/index/concatenateBytes
                    ;;@ core/cpu/opcodes.ts:1217:47
                    (get_global $core/cpu/cpu/Cpu.registerH)
                    ;;@ core/cpu/opcodes.ts:1217:62
                    (get_global $core/cpu/cpu/Cpu.registerL)
                   )
                   ;;@ core/cpu/opcodes.ts:1217:78
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1223:6
                 (call $core/cpu/opcodes/eightBitStoreSyncCycles
                  ;;@ core/cpu/opcodes.ts:1223:30
                  (call $core/helpers/index/concatenateBytes
                   ;;@ core/cpu/opcodes.ts:1223:47
                   (get_global $core/cpu/cpu/Cpu.registerH)
                   ;;@ core/cpu/opcodes.ts:1223:62
                   (get_global $core/cpu/cpu/Cpu.registerL)
                  )
                  ;;@ core/cpu/opcodes.ts:1223:78
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1229:6
                (call $core/cpu/opcodes/eightBitStoreSyncCycles
                 ;;@ core/cpu/opcodes.ts:1229:30
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:1229:47
                  (get_global $core/cpu/cpu/Cpu.registerH)
                  ;;@ core/cpu/opcodes.ts:1229:62
                  (get_global $core/cpu/cpu/Cpu.registerL)
                 )
                 ;;@ core/cpu/opcodes.ts:1229:78
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1235:6
               (call $core/cpu/opcodes/eightBitStoreSyncCycles
                ;;@ core/cpu/opcodes.ts:1235:30
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:1235:47
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:1235:62
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
                ;;@ core/cpu/opcodes.ts:1235:78
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1241:6
              (call $core/cpu/opcodes/eightBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:1241:30
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1241:47
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1241:62
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
               ;;@ core/cpu/opcodes.ts:1241:78
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1252:6
             (if
              ;;@ core/cpu/opcodes.ts:1252:10
              (i32.eqz
               ;;@ core/cpu/opcodes.ts:1252:11
               (get_global $core/memory/memory/Memory.isHblankHdmaActive)
              )
              ;;@ core/cpu/opcodes.ts:1252:38
              (set_global $core/cpu/cpu/Cpu.isHalted
               ;;@ core/cpu/opcodes.ts:1253:23
               (i32.const 1)
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1260:6
            (call $core/cpu/opcodes/eightBitStoreSyncCycles
             ;;@ core/cpu/opcodes.ts:1260:30
             (call $core/helpers/index/concatenateBytes
              ;;@ core/cpu/opcodes.ts:1260:47
              (get_global $core/cpu/cpu/Cpu.registerH)
              ;;@ core/cpu/opcodes.ts:1260:62
              (get_global $core/cpu/cpu/Cpu.registerL)
             )
             ;;@ core/cpu/opcodes.ts:1260:78
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1265:6
           (set_global $core/cpu/cpu/Cpu.registerA
            ;;@ core/cpu/opcodes.ts:1265:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1270:6
          (set_global $core/cpu/cpu/Cpu.registerA
           ;;@ core/cpu/opcodes.ts:1270:22
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1275:6
         (set_global $core/cpu/cpu/Cpu.registerA
          ;;@ core/cpu/opcodes.ts:1275:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1280:6
        (set_global $core/cpu/cpu/Cpu.registerA
         ;;@ core/cpu/opcodes.ts:1280:22
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1285:6
       (set_global $core/cpu/cpu/Cpu.registerA
        ;;@ core/cpu/opcodes.ts:1285:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1290:6
      (set_global $core/cpu/cpu/Cpu.registerA
       ;;@ core/cpu/opcodes.ts:1290:22
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1297:6
     (set_global $core/cpu/cpu/Cpu.registerA
      (i32.and
       ;;@ core/cpu/opcodes.ts:1297:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1297:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1297:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1297:81
         (get_global $core/cpu/cpu/Cpu.registerL)
        )
       )
       (i32.const 255)
      )
     )
     (br $folding-inner0)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1212:13
  (i32.const 4)
 )
 (func $core/cpu/flags/checkAndSetEightBitCarryFlag (; 193 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/cpu/flags.ts:75:2
  (if
   ;;@ core/cpu/flags.ts:75:6
   (i32.ge_s
    (get_local $1)
    ;;@ core/cpu/flags.ts:75:21
    (i32.const 0)
   )
   ;;@ core/cpu/flags.ts:77:4
   (if
    ;;@ core/cpu/flags.ts:77:8
    (i32.gt_u
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
     ;;@ core/cpu/flags.ts:76:21
     (call $core/helpers/index/splitLowByte
      ;;@ core/cpu/flags.ts:76:32
      (i32.add
       (get_local $0)
       (get_local $1)
      )
     )
    )
    ;;@ core/cpu/flags.ts:77:24
    (call $core/cpu/flags/setCarryFlag
     ;;@ core/cpu/flags.ts:78:19
     (i32.const 1)
    )
    ;;@ core/cpu/flags.ts:79:11
    (call $core/cpu/flags/setCarryFlag
     ;;@ core/cpu/flags.ts:80:19
     (i32.const 0)
    )
   )
   ;;@ core/cpu/flags.ts:82:9
   (if
    ;;@ core/cpu/flags.ts:83:8
    (i32.gt_s
     (select
      (get_local $1)
      (i32.sub
       (i32.const 0)
       (get_local $1)
      )
      (i32.gt_s
       (get_local $1)
       (i32.const 0)
      )
     )
     ;;@ core/cpu/flags.ts:83:27
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
    )
    ;;@ core/cpu/flags.ts:83:39
    (call $core/cpu/flags/setCarryFlag
     ;;@ core/cpu/flags.ts:84:19
     (i32.const 1)
    )
    ;;@ core/cpu/flags.ts:85:11
    (call $core/cpu/flags/setCarryFlag
     ;;@ core/cpu/flags.ts:86:19
     (i32.const 0)
    )
   )
  )
 )
 (func $core/cpu/instructions/addARegister (; 194 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:31:2
  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
   ;;@ core/cpu/instructions.ts:31:35
   (get_global $core/cpu/cpu/Cpu.registerA)
   (tee_local $1
    ;;@ core/cpu/instructions.ts:31:50
    (i32.and
     (get_local $0)
     (i32.const 255)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:32:2
  (call $core/cpu/flags/checkAndSetEightBitCarryFlag
   ;;@ core/cpu/instructions.ts:32:31
   (get_global $core/cpu/cpu/Cpu.registerA)
   (get_local $1)
  )
  ;;@ core/cpu/instructions.ts:33:2
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/instructions.ts:33:18
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:33:29
    (i32.add
     (get_global $core/cpu/cpu/Cpu.registerA)
     (get_local $0)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:34:2
  (if
   ;;@ core/cpu/instructions.ts:34:6
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:36:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:37:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:34:27
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:35:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:39:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:39:18
   (i32.const 0)
  )
 )
 (func $core/cpu/instructions/addAThroughCarryRegister (; 195 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:46:2
  (set_local $1
   ;;@ core/cpu/instructions.ts:46:19
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:46:30
    (i32.add
     (i32.add
      (get_global $core/cpu/cpu/Cpu.registerA)
      (get_local $0)
     )
     ;;@ core/cpu/instructions.ts:46:57
     (call $core/cpu/flags/getCarryFlag)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:47:2
  (if
   ;;@ core/cpu/instructions.ts:47:6
   (i32.and
    ;;@ core/cpu/instructions.ts:47:7
    (call $core/helpers/index/splitLowByte
     ;;@ core/cpu/instructions.ts:47:18
     (i32.xor
      (i32.xor
       (get_global $core/cpu/cpu/Cpu.registerA)
       (get_local $0)
      )
      (get_local $1)
     )
    )
    ;;@ core/cpu/instructions.ts:47:55
    (i32.const 16)
   )
   ;;@ core/cpu/instructions.ts:47:67
   (call $core/cpu/flags/setHalfCarryFlag
    ;;@ core/cpu/instructions.ts:48:21
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:49:9
   (call $core/cpu/flags/setHalfCarryFlag
    ;;@ core/cpu/instructions.ts:50:21
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:54:2
  (if
   ;;@ core/cpu/instructions.ts:54:6
   (i32.gt_u
    (i32.and
     ;;@ core/cpu/instructions.ts:53:30
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/instructions.ts:53:42
      (i32.add
       (i32.add
        (get_global $core/cpu/cpu/Cpu.registerA)
        ;;@ core/cpu/instructions.ts:53:63
        (i32.and
         (get_local $0)
         (i32.const 255)
        )
       )
       ;;@ core/cpu/instructions.ts:53:79
       (call $core/cpu/flags/getCarryFlag)
      )
     )
     ;;@ core/cpu/instructions.ts:54:26
     (i32.const 256)
    )
    ;;@ core/cpu/instructions.ts:54:35
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:54:38
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:55:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:56:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:57:17
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:60:2
  (set_global $core/cpu/cpu/Cpu.registerA
   (get_local $1)
  )
  ;;@ core/cpu/instructions.ts:61:2
  (if
   ;;@ core/cpu/instructions.ts:61:6
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:63:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:64:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:61:27
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:62:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:66:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:66:18
   (i32.const 0)
  )
 )
 (func $core/cpu/opcodes/handleOpcode8x (; 196 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (tee_local $1
                      (get_local $0)
                     )
                     ;;@ core/cpu/opcodes.ts:1310:9
                     (i32.const 128)
                    )
                    (block
                     (block $tablify|0
                      (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 129)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1314:6
                   (call $core/cpu/instructions/addARegister
                    ;;@ core/cpu/opcodes.ts:1314:19
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1320:6
                  (call $core/cpu/instructions/addARegister
                   ;;@ core/cpu/opcodes.ts:1320:19
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1326:6
                 (call $core/cpu/instructions/addARegister
                  ;;@ core/cpu/opcodes.ts:1326:19
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1332:6
                (call $core/cpu/instructions/addARegister
                 ;;@ core/cpu/opcodes.ts:1332:19
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1338:6
               (call $core/cpu/instructions/addARegister
                ;;@ core/cpu/opcodes.ts:1338:19
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1344:6
              (call $core/cpu/instructions/addARegister
               ;;@ core/cpu/opcodes.ts:1344:19
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1352:6
             (call $core/cpu/instructions/addARegister
              ;;@ core/cpu/opcodes.ts:1351:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1351:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1351:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1351:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1358:6
            (call $core/cpu/instructions/addARegister
             ;;@ core/cpu/opcodes.ts:1358:19
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1364:6
           (call $core/cpu/instructions/addAThroughCarryRegister
            ;;@ core/cpu/opcodes.ts:1364:31
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1370:6
          (call $core/cpu/instructions/addAThroughCarryRegister
           ;;@ core/cpu/opcodes.ts:1370:31
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1376:6
         (call $core/cpu/instructions/addAThroughCarryRegister
          ;;@ core/cpu/opcodes.ts:1376:31
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1382:6
        (call $core/cpu/instructions/addAThroughCarryRegister
         ;;@ core/cpu/opcodes.ts:1382:31
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1388:6
       (call $core/cpu/instructions/addAThroughCarryRegister
        ;;@ core/cpu/opcodes.ts:1388:31
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1394:6
      (call $core/cpu/instructions/addAThroughCarryRegister
       ;;@ core/cpu/opcodes.ts:1394:31
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1402:6
     (call $core/cpu/instructions/addAThroughCarryRegister
      ;;@ core/cpu/opcodes.ts:1401:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1401:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1401:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1401:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1408:6
    (call $core/cpu/instructions/addAThroughCarryRegister
     ;;@ core/cpu/opcodes.ts:1408:31
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1315:13
  (i32.const 4)
 )
 (func $core/cpu/instructions/subARegister (; 197 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:74:2
  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
   ;;@ core/cpu/instructions.ts:74:35
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:72:2
   (tee_local $1
    ;;@ core/cpu/instructions.ts:72:21
    (i32.mul
     ;;@ core/cpu/instructions.ts:71:30
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
     ;;@ core/cpu/instructions.ts:72:40
     (i32.const -1)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:75:2
  (call $core/cpu/flags/checkAndSetEightBitCarryFlag
   ;;@ core/cpu/instructions.ts:75:31
   (get_global $core/cpu/cpu/Cpu.registerA)
   (get_local $1)
  )
  ;;@ core/cpu/instructions.ts:76:2
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/instructions.ts:76:18
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:76:29
    (i32.sub
     (get_global $core/cpu/cpu/Cpu.registerA)
     (get_local $0)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:77:2
  (if
   ;;@ core/cpu/instructions.ts:77:6
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:79:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:80:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:77:27
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:78:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:82:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:82:18
   (i32.const 1)
  )
 )
 (func $core/cpu/instructions/subAThroughCarryRegister (; 198 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:89:2
  (set_local $1
   ;;@ core/cpu/instructions.ts:89:19
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:89:30
    (i32.sub
     (i32.sub
      (get_global $core/cpu/cpu/Cpu.registerA)
      (get_local $0)
     )
     ;;@ core/cpu/instructions.ts:89:57
     (call $core/cpu/flags/getCarryFlag)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:92:2
  (if
   ;;@ core/cpu/instructions.ts:91:27
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:91:38
    (i32.and
     (i32.xor
      ;;@ core/cpu/instructions.ts:91:39
      (i32.xor
       (get_global $core/cpu/cpu/Cpu.registerA)
       (get_local $0)
      )
      (get_local $1)
     )
     ;;@ core/cpu/instructions.ts:91:76
     (i32.const 16)
    )
   )
   ;;@ core/cpu/instructions.ts:92:31
   (call $core/cpu/flags/setHalfCarryFlag
    ;;@ core/cpu/instructions.ts:93:21
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:94:9
   (call $core/cpu/flags/setHalfCarryFlag
    ;;@ core/cpu/instructions.ts:95:21
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:99:2
  (if
   ;;@ core/cpu/instructions.ts:99:6
   (i32.gt_u
    (i32.and
     ;;@ core/cpu/instructions.ts:98:30
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/instructions.ts:98:42
      (i32.sub
       (i32.sub
        (get_global $core/cpu/cpu/Cpu.registerA)
        ;;@ core/cpu/instructions.ts:98:63
        (i32.and
         (get_local $0)
         (i32.const 255)
        )
       )
       ;;@ core/cpu/instructions.ts:98:79
       (call $core/cpu/flags/getCarryFlag)
      )
     )
     ;;@ core/cpu/instructions.ts:99:26
     (i32.const 256)
    )
    ;;@ core/cpu/instructions.ts:99:35
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:99:38
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:100:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:101:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:102:17
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:105:2
  (set_global $core/cpu/cpu/Cpu.registerA
   (get_local $1)
  )
  ;;@ core/cpu/instructions.ts:106:2
  (if
   ;;@ core/cpu/instructions.ts:106:6
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:108:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:109:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:106:27
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:107:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:111:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:111:18
   (i32.const 1)
  )
 )
 (func $core/cpu/opcodes/handleOpcode9x (; 199 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (tee_local $1
                      (get_local $0)
                     )
                     ;;@ core/cpu/opcodes.ts:1416:9
                     (i32.const 144)
                    )
                    (block
                     (block $tablify|0
                      (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 145)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1420:6
                   (call $core/cpu/instructions/subARegister
                    ;;@ core/cpu/opcodes.ts:1420:19
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1426:6
                  (call $core/cpu/instructions/subARegister
                   ;;@ core/cpu/opcodes.ts:1426:19
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1432:6
                 (call $core/cpu/instructions/subARegister
                  ;;@ core/cpu/opcodes.ts:1432:19
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1438:6
                (call $core/cpu/instructions/subARegister
                 ;;@ core/cpu/opcodes.ts:1438:19
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1444:6
               (call $core/cpu/instructions/subARegister
                ;;@ core/cpu/opcodes.ts:1444:19
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1450:6
              (call $core/cpu/instructions/subARegister
               ;;@ core/cpu/opcodes.ts:1450:19
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1458:6
             (call $core/cpu/instructions/subARegister
              ;;@ core/cpu/opcodes.ts:1457:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1457:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1457:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1457:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1464:6
            (call $core/cpu/instructions/subARegister
             ;;@ core/cpu/opcodes.ts:1464:19
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1470:6
           (call $core/cpu/instructions/subAThroughCarryRegister
            ;;@ core/cpu/opcodes.ts:1470:31
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1476:6
          (call $core/cpu/instructions/subAThroughCarryRegister
           ;;@ core/cpu/opcodes.ts:1476:31
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1482:6
         (call $core/cpu/instructions/subAThroughCarryRegister
          ;;@ core/cpu/opcodes.ts:1482:31
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1488:6
        (call $core/cpu/instructions/subAThroughCarryRegister
         ;;@ core/cpu/opcodes.ts:1488:31
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1494:6
       (call $core/cpu/instructions/subAThroughCarryRegister
        ;;@ core/cpu/opcodes.ts:1494:31
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1500:6
      (call $core/cpu/instructions/subAThroughCarryRegister
       ;;@ core/cpu/opcodes.ts:1500:31
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1508:6
     (call $core/cpu/instructions/subAThroughCarryRegister
      ;;@ core/cpu/opcodes.ts:1507:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1507:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1507:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1507:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1514:6
    (call $core/cpu/instructions/subAThroughCarryRegister
     ;;@ core/cpu/opcodes.ts:1514:31
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1421:13
  (i32.const 4)
 )
 (func $core/cpu/instructions/andARegister (; 200 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/instructions.ts:115:2
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/instructions.ts:115:18
   (i32.and
    (get_global $core/cpu/cpu/Cpu.registerA)
    (get_local $0)
   )
  )
  ;;@ core/cpu/instructions.ts:116:2
  (if
   ;;@ core/cpu/instructions.ts:116:6
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:118:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:119:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:116:27
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:117:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:121:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:121:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:122:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:122:19
   (i32.const 1)
  )
  ;;@ core/cpu/instructions.ts:123:2
  (call $core/cpu/flags/setCarryFlag
   ;;@ core/cpu/instructions.ts:123:15
   (i32.const 0)
  )
 )
 (func $core/cpu/instructions/xorARegister (; 201 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/instructions.ts:127:2
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/instructions.ts:127:18
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:127:29
    (i32.xor
     (get_global $core/cpu/cpu/Cpu.registerA)
     (get_local $0)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:128:2
  (if
   ;;@ core/cpu/instructions.ts:128:6
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:130:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:131:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:128:27
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:129:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:133:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:133:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:134:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:134:19
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:135:2
  (call $core/cpu/flags/setCarryFlag
   ;;@ core/cpu/instructions.ts:135:15
   (i32.const 0)
  )
 )
 (func $core/cpu/opcodes/handleOpcodeAx (; 202 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (tee_local $1
                      (get_local $0)
                     )
                     ;;@ core/cpu/opcodes.ts:1522:9
                     (i32.const 160)
                    )
                    (block
                     (block $tablify|0
                      (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 161)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1526:6
                   (call $core/cpu/instructions/andARegister
                    ;;@ core/cpu/opcodes.ts:1526:19
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1532:6
                  (call $core/cpu/instructions/andARegister
                   ;;@ core/cpu/opcodes.ts:1532:19
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1538:6
                 (call $core/cpu/instructions/andARegister
                  ;;@ core/cpu/opcodes.ts:1538:19
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1544:6
                (call $core/cpu/instructions/andARegister
                 ;;@ core/cpu/opcodes.ts:1544:19
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1550:6
               (call $core/cpu/instructions/andARegister
                ;;@ core/cpu/opcodes.ts:1550:19
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1556:6
              (call $core/cpu/instructions/andARegister
               ;;@ core/cpu/opcodes.ts:1556:19
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1564:6
             (call $core/cpu/instructions/andARegister
              ;;@ core/cpu/opcodes.ts:1563:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1563:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1563:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1563:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1571:6
            (call $core/cpu/instructions/andARegister
             ;;@ core/cpu/opcodes.ts:1571:19
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1577:6
           (call $core/cpu/instructions/xorARegister
            ;;@ core/cpu/opcodes.ts:1577:19
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1583:6
          (call $core/cpu/instructions/xorARegister
           ;;@ core/cpu/opcodes.ts:1583:19
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1589:6
         (call $core/cpu/instructions/xorARegister
          ;;@ core/cpu/opcodes.ts:1589:19
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1595:6
        (call $core/cpu/instructions/xorARegister
         ;;@ core/cpu/opcodes.ts:1595:19
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1601:6
       (call $core/cpu/instructions/xorARegister
        ;;@ core/cpu/opcodes.ts:1601:19
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1607:6
      (call $core/cpu/instructions/xorARegister
       ;;@ core/cpu/opcodes.ts:1607:19
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1615:6
     (call $core/cpu/instructions/xorARegister
      ;;@ core/cpu/opcodes.ts:1614:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1614:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1614:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1614:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1621:6
    (call $core/cpu/instructions/xorARegister
     ;;@ core/cpu/opcodes.ts:1621:19
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1527:13
  (i32.const 4)
 )
 (func $core/cpu/instructions/orARegister (; 203 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/instructions.ts:139:2
  (set_global $core/cpu/cpu/Cpu.registerA
   (i32.and
    ;;@ core/cpu/instructions.ts:139:18
    (i32.or
     (get_global $core/cpu/cpu/Cpu.registerA)
     (get_local $0)
    )
    (i32.const 255)
   )
  )
  ;;@ core/cpu/instructions.ts:140:2
  (if
   ;;@ core/cpu/instructions.ts:140:6
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:142:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:143:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:140:27
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:141:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:145:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:145:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:146:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:146:19
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:147:2
  (call $core/cpu/flags/setCarryFlag
   ;;@ core/cpu/instructions.ts:147:15
   (i32.const 0)
  )
 )
 (func $core/cpu/instructions/cpARegister (; 204 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:157:2
  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
   ;;@ core/cpu/instructions.ts:157:35
   (get_global $core/cpu/cpu/Cpu.registerA)
   ;;@ core/cpu/instructions.ts:156:2
   (tee_local $1
    ;;@ core/cpu/instructions.ts:156:21
    (i32.mul
     ;;@ core/cpu/instructions.ts:155:30
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
     ;;@ core/cpu/instructions.ts:156:40
     (i32.const -1)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:158:2
  (call $core/cpu/flags/checkAndSetEightBitCarryFlag
   ;;@ core/cpu/instructions.ts:158:31
   (get_global $core/cpu/cpu/Cpu.registerA)
   (get_local $1)
  )
  ;;@ core/cpu/instructions.ts:160:2
  (if
   ;;@ core/cpu/instructions.ts:159:24
   (i32.add
    (get_global $core/cpu/cpu/Cpu.registerA)
    (get_local $1)
   )
   ;;@ core/cpu/instructions.ts:162:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:163:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:160:24
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:161:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:165:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:165:18
   (i32.const 1)
  )
 )
 (func $core/cpu/opcodes/handleOpcodeBx (; 205 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner0
   (block $break|0
    (block $case15|0
     (block $case14|0
      (block $case13|0
       (block $case12|0
        (block $case11|0
         (block $case10|0
          (block $case9|0
           (block $case8|0
            (block $case7|0
             (block $case6|0
              (block $case5|0
               (block $case4|0
                (block $case3|0
                 (block $case2|0
                  (block $case1|0
                   (if
                    (i32.ne
                     (tee_local $1
                      (get_local $0)
                     )
                     ;;@ core/cpu/opcodes.ts:1629:9
                     (i32.const 176)
                    )
                    (block
                     (block $tablify|0
                      (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       (i32.sub
                        (get_local $1)
                        (i32.const 177)
                       )
                      )
                     )
                     (br $break|0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1633:6
                   (call $core/cpu/instructions/orARegister
                    ;;@ core/cpu/opcodes.ts:1633:18
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1639:6
                  (call $core/cpu/instructions/orARegister
                   ;;@ core/cpu/opcodes.ts:1639:18
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1645:6
                 (call $core/cpu/instructions/orARegister
                  ;;@ core/cpu/opcodes.ts:1645:18
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1651:6
                (call $core/cpu/instructions/orARegister
                 ;;@ core/cpu/opcodes.ts:1651:18
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1657:6
               (call $core/cpu/instructions/orARegister
                ;;@ core/cpu/opcodes.ts:1657:18
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1663:6
              (call $core/cpu/instructions/orARegister
               ;;@ core/cpu/opcodes.ts:1663:18
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1671:6
             (call $core/cpu/instructions/orARegister
              ;;@ core/cpu/opcodes.ts:1670:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1670:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1670:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1670:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1677:6
            (call $core/cpu/instructions/orARegister
             ;;@ core/cpu/opcodes.ts:1677:18
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1683:6
           (call $core/cpu/instructions/cpARegister
            ;;@ core/cpu/opcodes.ts:1683:18
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1689:6
          (call $core/cpu/instructions/cpARegister
           ;;@ core/cpu/opcodes.ts:1689:18
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1695:6
         (call $core/cpu/instructions/cpARegister
          ;;@ core/cpu/opcodes.ts:1695:18
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1701:6
        (call $core/cpu/instructions/cpARegister
         ;;@ core/cpu/opcodes.ts:1701:18
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1707:6
       (call $core/cpu/instructions/cpARegister
        ;;@ core/cpu/opcodes.ts:1707:18
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1713:6
      (call $core/cpu/instructions/cpARegister
       ;;@ core/cpu/opcodes.ts:1713:18
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1721:6
     (call $core/cpu/instructions/cpARegister
      ;;@ core/cpu/opcodes.ts:1720:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1720:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1720:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1720:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1727:6
    (call $core/cpu/instructions/cpARegister
     ;;@ core/cpu/opcodes.ts:1727:18
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1634:13
  (i32.const 4)
 )
 (func $core/memory/load/sixteenBitLoadFromGBMemory (; 206 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/memory/load.ts:25:2
  (block $break|0
   (block $case1|0
    (if
     (i32.ne
      ;;@ core/memory/load.ts:24:2
      (tee_local $1
       ;;@ core/memory/load.ts:24:35
       (call $core/memory/readTraps/checkReadTraps
        (get_local $0)
       )
      )
      ;;@ core/memory/load.ts:26:9
      (i32.const -1)
     )
     (br $break|0)
    )
    ;;@ core/memory/load.ts:27:6
    (set_local $1
     ;;@ core/memory/load.ts:27:16
     (call $core/memory/load/eightBitLoadFromGBMemory
      (get_local $0)
     )
    )
   )
  )
  ;;@ core/memory/load.ts:40:2
  (block $break|1
   (block $case1|1
    (br_if $break|1
     (i32.ne
      ;;@ core/memory/load.ts:39:2
      (tee_local $0
       ;;@ core/memory/load.ts:39:36
       (call $core/memory/readTraps/checkReadTraps
        ;;@ core/memory/load.ts:35:2
        (tee_local $2
         ;;@ core/memory/load.ts:35:24
         (i32.add
          (get_local $0)
          ;;@ core/memory/load.ts:35:33
          (i32.const 1)
         )
        )
       )
      )
      ;;@ core/memory/load.ts:41:9
      (i32.const -1)
     )
    )
    ;;@ core/memory/load.ts:42:6
    (set_local $0
     ;;@ core/memory/load.ts:42:17
     (call $core/memory/load/eightBitLoadFromGBMemory
      (get_local $2)
     )
    )
   )
  )
  ;;@ core/memory/load.ts:50:43
  (call $core/helpers/index/concatenateBytes
   (get_local $0)
   (get_local $1)
  )
 )
 (func $core/cpu/opcodes/sixteenBitLoadSyncCycles (; 207 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/cpu/opcodes.ts:133:2
  (call $core/core/syncCycles
   ;;@ core/cpu/opcodes.ts:133:13
   (i32.const 8)
  )
  ;;@ core/cpu/opcodes.ts:135:54
  (call $core/memory/load/sixteenBitLoadFromGBMemory
   (get_local $0)
  )
 )
 (func $core/cpu/instructions/rotateRegisterLeft (; 208 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/cpu/instructions.ts:171:2
  (if
   ;;@ core/cpu/instructions.ts:171:6
   (i32.eq
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:171:18
     (i32.const 128)
    )
    ;;@ core/cpu/instructions.ts:171:28
    (i32.const 128)
   )
   ;;@ core/cpu/instructions.ts:171:34
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:172:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:173:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:174:17
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:177:2
  (if
   ;;@ core/cpu/instructions.ts:176:2
   (tee_local $0
    ;;@ core/cpu/instructions.ts:176:13
    (call $core/helpers/index/rotateByteLeft
     (get_local $0)
    )
   )
   ;;@ core/cpu/instructions.ts:179:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:180:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:177:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:178:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:184:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:184:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:185:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:185:19
   (i32.const 0)
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/rotateRegisterRight (; 209 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/cpu/instructions.ts:195:2
  (if
   ;;@ core/cpu/instructions.ts:195:6
   (i32.gt_u
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:195:18
     (i32.const 1)
    )
    ;;@ core/cpu/instructions.ts:195:26
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:195:29
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:196:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:197:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:198:17
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:202:2
  (if
   ;;@ core/cpu/instructions.ts:200:2
   (tee_local $0
    ;;@ core/cpu/instructions.ts:200:13
    (call $core/helpers/index/rotateByteRight
     (get_local $0)
    )
   )
   ;;@ core/cpu/instructions.ts:204:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:205:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:202:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:203:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:208:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:208:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:209:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:209:19
   (i32.const 0)
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/rotateRegisterLeftThroughCarry (; 210 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:220:2
  (if
   ;;@ core/cpu/instructions.ts:220:6
   (i32.eq
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:220:18
     (i32.const 128)
    )
    ;;@ core/cpu/instructions.ts:220:28
    (i32.const 128)
   )
   ;;@ core/cpu/instructions.ts:220:34
   (set_local $1
    ;;@ core/cpu/instructions.ts:221:17
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:223:2
  (set_local $0
   ;;@ core/cpu/instructions.ts:223:13
   (call $core/helpers/index/rotateByteLeftThroughCarry
    (get_local $0)
   )
  )
  ;;@ core/cpu/instructions.ts:225:2
  (if
   (get_local $1)
   ;;@ core/cpu/instructions.ts:225:18
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:226:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:227:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:228:17
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:231:2
  (if
   (get_local $0)
   ;;@ core/cpu/instructions.ts:233:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:234:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:231:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:232:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:237:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:237:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:238:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:238:19
   (i32.const 0)
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/rotateRegisterRightThroughCarry (; 211 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:247:2
  (if
   ;;@ core/cpu/instructions.ts:247:6
   (i32.eq
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:247:18
     (i32.const 1)
    )
    ;;@ core/cpu/instructions.ts:247:28
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:247:34
   (set_local $1
    ;;@ core/cpu/instructions.ts:248:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:250:2
  (set_local $0
   ;;@ core/cpu/instructions.ts:250:13
   (call $core/helpers/index/rotateByteRightThroughCarry
    (get_local $0)
   )
  )
  ;;@ core/cpu/instructions.ts:252:2
  (if
   (get_local $1)
   ;;@ core/cpu/instructions.ts:252:17
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:253:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:254:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:255:17
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:258:2
  (if
   (get_local $0)
   ;;@ core/cpu/instructions.ts:260:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:261:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:258:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:259:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:264:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:264:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:265:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:265:19
   (i32.const 0)
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/shiftLeftRegister (; 212 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:274:2
  (if
   ;;@ core/cpu/instructions.ts:274:6
   (i32.eq
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:274:18
     (i32.const 128)
    )
    ;;@ core/cpu/instructions.ts:274:28
    (i32.const 128)
   )
   ;;@ core/cpu/instructions.ts:274:34
   (set_local $1
    ;;@ core/cpu/instructions.ts:275:17
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:278:2
  (set_local $0
   ;;@ core/cpu/instructions.ts:278:13
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:278:24
    (i32.shl
     (get_local $0)
     ;;@ core/cpu/instructions.ts:278:36
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:280:2
  (if
   (get_local $1)
   ;;@ core/cpu/instructions.ts:280:18
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:281:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:282:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:283:17
    (i32.const 0)
   )
  )
  ;;@ core/cpu/instructions.ts:286:2
  (if
   (get_local $0)
   ;;@ core/cpu/instructions.ts:288:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:289:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:286:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:287:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:292:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:292:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:293:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:293:19
   (i32.const 0)
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/shiftRightArithmeticRegister (; 213 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/cpu/instructions.ts:304:2
  (if
   ;;@ core/cpu/instructions.ts:304:6
   (i32.eq
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:304:18
     (i32.const 128)
    )
    ;;@ core/cpu/instructions.ts:304:28
    (i32.const 128)
   )
   ;;@ core/cpu/instructions.ts:304:34
   (set_local $1
    ;;@ core/cpu/instructions.ts:305:17
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:309:2
  (if
   ;;@ core/cpu/instructions.ts:309:6
   (i32.eq
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:309:18
     (i32.const 1)
    )
    ;;@ core/cpu/instructions.ts:309:28
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:309:34
   (set_local $2
    ;;@ core/cpu/instructions.ts:310:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:313:2
  (set_local $0
   ;;@ core/cpu/instructions.ts:313:13
   (call $core/helpers/index/splitLowByte
    ;;@ core/cpu/instructions.ts:313:24
    (i32.shr_u
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
     ;;@ core/cpu/instructions.ts:313:36
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:315:2
  (if
   (get_local $1)
   ;;@ core/cpu/instructions.ts:315:18
   (set_local $0
    ;;@ core/cpu/instructions.ts:316:15
    (i32.or
     (get_local $0)
     ;;@ core/cpu/instructions.ts:316:26
     (i32.const 128)
    )
   )
  )
  ;;@ core/cpu/instructions.ts:319:2
  (if
   (get_local $0)
   ;;@ core/cpu/instructions.ts:321:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:322:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:319:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:320:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:325:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:325:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:326:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:326:19
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:328:2
  (if
   (get_local $2)
   ;;@ core/cpu/instructions.ts:328:17
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:329:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:330:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:331:17
    (i32.const 0)
   )
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/swapNibblesOnRegister (; 214 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/cpu/instructions.ts:344:2
  (if
   ;;@ core/cpu/instructions.ts:342:2
   (tee_local $0
    ;;@ core/cpu/instructions.ts:342:13
    (call $core/helpers/index/splitLowByte
     ;;@ core/cpu/instructions.ts:342:24
     (i32.or
      (i32.shl
       ;;@ core/cpu/instructions.ts:341:18
       (i32.and
        (get_local $0)
        ;;@ core/cpu/instructions.ts:341:29
        (i32.const 15)
       )
       ;;@ core/cpu/instructions.ts:342:38
       (i32.const 4)
      )
      ;;@ core/cpu/instructions.ts:342:43
      (i32.shr_u
       ;;@ core/cpu/instructions.ts:340:19
       (i32.and
        (get_local $0)
        ;;@ core/cpu/instructions.ts:340:30
        (i32.const 240)
       )
       ;;@ core/cpu/instructions.ts:342:58
       (i32.const 4)
      )
     )
    )
   )
   ;;@ core/cpu/instructions.ts:346:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:347:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:344:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:345:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:350:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:350:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:351:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:351:19
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:352:2
  (call $core/cpu/flags/setCarryFlag
   ;;@ core/cpu/instructions.ts:352:15
   (i32.const 0)
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/shiftRightLogicalRegister (; 215 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/cpu/instructions.ts:364:2
  (if
   ;;@ core/cpu/instructions.ts:364:6
   (i32.eq
    (i32.and
     (get_local $0)
     ;;@ core/cpu/instructions.ts:364:18
     (i32.const 1)
    )
    ;;@ core/cpu/instructions.ts:364:28
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:364:34
   (set_local $1
    ;;@ core/cpu/instructions.ts:365:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:370:2
  (if
   ;;@ core/cpu/instructions.ts:368:2
   (tee_local $0
    ;;@ core/cpu/instructions.ts:368:13
    (call $core/helpers/index/splitLowByte
     ;;@ core/cpu/instructions.ts:368:24
     (i32.shr_u
      (i32.and
       (get_local $0)
       (i32.const 255)
      )
      ;;@ core/cpu/instructions.ts:368:36
      (i32.const 1)
     )
    )
   )
   ;;@ core/cpu/instructions.ts:372:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:373:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:370:22
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:371:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:376:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:376:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:377:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:377:19
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:379:2
  (if
   (get_local $1)
   ;;@ core/cpu/instructions.ts:379:17
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:380:17
    (i32.const 1)
   )
   ;;@ core/cpu/instructions.ts:381:9
   (call $core/cpu/flags/setCarryFlag
    ;;@ core/cpu/instructions.ts:382:17
    (i32.const 0)
   )
  )
  (get_local $0)
 )
 (func $core/cpu/instructions/testBitOnRegister (; 216 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/cpu/instructions.ts:394:2
  (if
   (i32.and
    ;;@ core/cpu/instructions.ts:393:15
    (i32.and
     (get_local $1)
     ;;@ core/cpu/instructions.ts:392:21
     (i32.shl
      (i32.const 1)
      (get_local $0)
     )
    )
    (i32.const 255)
   )
   ;;@ core/cpu/instructions.ts:396:9
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:397:16
    (i32.const 0)
   )
   ;;@ core/cpu/instructions.ts:394:23
   (call $core/cpu/flags/setZeroFlag
    ;;@ core/cpu/instructions.ts:395:16
    (i32.const 1)
   )
  )
  ;;@ core/cpu/instructions.ts:400:2
  (call $core/cpu/flags/setSubtractFlag
   ;;@ core/cpu/instructions.ts:400:18
   (i32.const 0)
  )
  ;;@ core/cpu/instructions.ts:401:2
  (call $core/cpu/flags/setHalfCarryFlag
   ;;@ core/cpu/instructions.ts:401:19
   (i32.const 1)
  )
  (get_local $1)
 )
 (func $core/cpu/instructions/setBitOnRegister (; 217 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (tee_local $2
   ;;@ core/cpu/instructions.ts:409:2
   (if (result i32)
    ;;@ core/cpu/instructions.ts:409:6
    (i32.gt_s
     (get_local $1)
     ;;@ core/cpu/instructions.ts:409:17
     (i32.const 0)
    )
    ;;@ core/cpu/instructions.ts:411:15
    (i32.or
     (get_local $2)
     ;;@ core/cpu/instructions.ts:410:22
     (i32.shl
      (i32.const 1)
      (get_local $0)
     )
    )
    ;;@ core/cpu/instructions.ts:416:15
    (i32.and
     (get_local $2)
     ;;@ core/cpu/instructions.ts:415:22
     (i32.xor
      ;;@ core/cpu/instructions.ts:415:23
      (i32.shl
       ;;@ core/cpu/instructions.ts:415:24
       (i32.const 1)
       (get_local $0)
      )
      (i32.const -1)
     )
    )
   )
  )
 )
 (func $core/cpu/cbOpcodes/handleCbOpcode (; 218 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  ;;@ core/cpu/cbOpcodes.ts:23:2
  (set_local $6
   ;;@ core/cpu/cbOpcodes.ts:23:28
   (i32.const -1)
  )
  ;;@ core/cpu/cbOpcodes.ts:35:2
  (block $break|0
   (block $case7|0
    (block $case6|0
     (block $case5|0
      (block $case4|0
       (block $case3|0
        (block $case2|0
         (block $case1|0
          (block $case0|0
           (set_local $5
            ;;@ core/cpu/cbOpcodes.ts:32:2
            (tee_local $7
             ;;@ core/cpu/cbOpcodes.ts:32:23
             (i32.rem_s
              (get_local $0)
              ;;@ core/cpu/cbOpcodes.ts:32:34
              (i32.const 8)
             )
            )
           )
           (br_if $case0|0
            (i32.eqz
             (get_local $7)
            )
           )
           (block $tablify|0
            (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
             (i32.sub
              (get_local $5)
              (i32.const 1)
             )
            )
           )
           (br $break|0)
          )
          ;;@ core/cpu/cbOpcodes.ts:37:6
          (set_local $1
           ;;@ core/cpu/cbOpcodes.ts:37:33
           (get_global $core/cpu/cpu/Cpu.registerB)
          )
          ;;@ core/cpu/cbOpcodes.ts:38:6
          (br $break|0)
         )
         ;;@ core/cpu/cbOpcodes.ts:40:6
         (set_local $1
          ;;@ core/cpu/cbOpcodes.ts:40:33
          (get_global $core/cpu/cpu/Cpu.registerC)
         )
         ;;@ core/cpu/cbOpcodes.ts:41:6
         (br $break|0)
        )
        ;;@ core/cpu/cbOpcodes.ts:43:6
        (set_local $1
         ;;@ core/cpu/cbOpcodes.ts:43:33
         (get_global $core/cpu/cpu/Cpu.registerD)
        )
        ;;@ core/cpu/cbOpcodes.ts:44:6
        (br $break|0)
       )
       ;;@ core/cpu/cbOpcodes.ts:46:6
       (set_local $1
        ;;@ core/cpu/cbOpcodes.ts:46:33
        (get_global $core/cpu/cpu/Cpu.registerE)
       )
       ;;@ core/cpu/cbOpcodes.ts:47:6
       (br $break|0)
      )
      ;;@ core/cpu/cbOpcodes.ts:49:6
      (set_local $1
       ;;@ core/cpu/cbOpcodes.ts:49:33
       (get_global $core/cpu/cpu/Cpu.registerH)
      )
      ;;@ core/cpu/cbOpcodes.ts:50:6
      (br $break|0)
     )
     ;;@ core/cpu/cbOpcodes.ts:52:6
     (set_local $1
      ;;@ core/cpu/cbOpcodes.ts:52:33
      (get_global $core/cpu/cpu/Cpu.registerL)
     )
     ;;@ core/cpu/cbOpcodes.ts:53:6
     (br $break|0)
    )
    ;;@ core/cpu/cbOpcodes.ts:57:6
    (set_local $1
     ;;@ core/cpu/cbOpcodes.ts:57:33
     (call $core/cpu/opcodes/eightBitLoadSyncCycles
      ;;@ core/cpu/cbOpcodes.ts:57:60
      (call $core/helpers/index/concatenateBytes
       ;;@ core/cpu/cbOpcodes.ts:57:77
       (get_global $core/cpu/cpu/Cpu.registerH)
       ;;@ core/cpu/cbOpcodes.ts:57:92
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
     )
    )
    ;;@ core/cpu/cbOpcodes.ts:58:6
    (br $break|0)
   )
   ;;@ core/cpu/cbOpcodes.ts:60:6
   (set_local $1
    ;;@ core/cpu/cbOpcodes.ts:60:33
    (get_global $core/cpu/cpu/Cpu.registerA)
   )
  )
  ;;@ core/cpu/cbOpcodes.ts:69:2
  (block $break|1
   (block $case15|1
    (block $case14|1
     (block $case13|1
      (block $case12|1
       (block $case11|1
        (block $case10|1
         (block $case9|1
          (block $case8|1
           (block $case7|1
            (block $case6|1
             (block $case5|1
              (block $case4|1
               (block $case3|1
                (block $case2|1
                 (block $case1|1
                  (block $case0|1
                   (set_local $4
                    ;;@ core/cpu/cbOpcodes.ts:66:2
                    (tee_local $5
                     ;;@ core/cpu/cbOpcodes.ts:66:21
                     (i32.shr_s
                      ;;@ core/cpu/cbOpcodes.ts:65:25
                      (i32.and
                       (get_local $0)
                       ;;@ core/cpu/cbOpcodes.ts:65:36
                       (i32.const 240)
                      )
                      ;;@ core/cpu/cbOpcodes.ts:66:41
                      (i32.const 4)
                     )
                    )
                   )
                   (br_if $case0|1
                    (i32.eqz
                     (get_local $5)
                    )
                   )
                   (block $tablify|00
                    (br_table $case1|1 $case2|1 $case3|1 $case4|1 $case5|1 $case6|1 $case7|1 $case8|1 $case9|1 $case10|1 $case11|1 $case12|1 $case13|1 $case14|1 $case15|1 $tablify|00
                     (i32.sub
                      (get_local $4)
                      (i32.const 1)
                     )
                    )
                   )
                   (br $break|1)
                  )
                  ;;@ core/cpu/cbOpcodes.ts:71:6
                  (if
                   ;;@ core/cpu/cbOpcodes.ts:71:10
                   (i32.le_s
                    (get_local $0)
                    ;;@ core/cpu/cbOpcodes.ts:71:22
                    (i32.const 7)
                   )
                   ;;@ core/cpu/cbOpcodes.ts:71:28
                   (block
                    ;;@ core/cpu/cbOpcodes.ts:74:8
                    (set_local $2
                     ;;@ core/cpu/cbOpcodes.ts:74:36
                     (call $core/cpu/instructions/rotateRegisterLeft
                      (get_local $1)
                     )
                    )
                    ;;@ core/cpu/cbOpcodes.ts:75:8
                    (set_local $3
                     ;;@ core/cpu/cbOpcodes.ts:75:24
                     (i32.const 1)
                    )
                   )
                   ;;@ core/cpu/cbOpcodes.ts:76:13
                   (if
                    ;;@ core/cpu/cbOpcodes.ts:76:17
                    (i32.le_s
                     (get_local $0)
                     ;;@ core/cpu/cbOpcodes.ts:76:29
                     (i32.const 15)
                    )
                    ;;@ core/cpu/cbOpcodes.ts:76:35
                    (block
                     ;;@ core/cpu/cbOpcodes.ts:79:8
                     (set_local $2
                      ;;@ core/cpu/cbOpcodes.ts:79:36
                      (call $core/cpu/instructions/rotateRegisterRight
                       (get_local $1)
                      )
                     )
                     ;;@ core/cpu/cbOpcodes.ts:80:8
                     (set_local $3
                      ;;@ core/cpu/cbOpcodes.ts:80:24
                      (i32.const 1)
                     )
                    )
                   )
                  )
                  ;;@ core/cpu/cbOpcodes.ts:82:6
                  (br $break|1)
                 )
                 ;;@ core/cpu/cbOpcodes.ts:84:6
                 (if
                  ;;@ core/cpu/cbOpcodes.ts:84:10
                  (i32.le_s
                   (get_local $0)
                   ;;@ core/cpu/cbOpcodes.ts:84:22
                   (i32.const 23)
                  )
                  ;;@ core/cpu/cbOpcodes.ts:84:28
                  (block
                   ;;@ core/cpu/cbOpcodes.ts:87:8
                   (set_local $2
                    ;;@ core/cpu/cbOpcodes.ts:87:36
                    (call $core/cpu/instructions/rotateRegisterLeftThroughCarry
                     (get_local $1)
                    )
                   )
                   ;;@ core/cpu/cbOpcodes.ts:88:8
                   (set_local $3
                    ;;@ core/cpu/cbOpcodes.ts:88:24
                    (i32.const 1)
                   )
                  )
                  ;;@ core/cpu/cbOpcodes.ts:89:13
                  (if
                   ;;@ core/cpu/cbOpcodes.ts:89:17
                   (i32.le_s
                    (get_local $0)
                    ;;@ core/cpu/cbOpcodes.ts:89:29
                    (i32.const 31)
                   )
                   ;;@ core/cpu/cbOpcodes.ts:89:35
                   (block
                    ;;@ core/cpu/cbOpcodes.ts:92:8
                    (set_local $2
                     ;;@ core/cpu/cbOpcodes.ts:92:36
                     (call $core/cpu/instructions/rotateRegisterRightThroughCarry
                      (get_local $1)
                     )
                    )
                    ;;@ core/cpu/cbOpcodes.ts:93:8
                    (set_local $3
                     ;;@ core/cpu/cbOpcodes.ts:93:24
                     (i32.const 1)
                    )
                   )
                  )
                 )
                 ;;@ core/cpu/cbOpcodes.ts:95:6
                 (br $break|1)
                )
                ;;@ core/cpu/cbOpcodes.ts:97:6
                (if
                 ;;@ core/cpu/cbOpcodes.ts:97:10
                 (i32.le_s
                  (get_local $0)
                  ;;@ core/cpu/cbOpcodes.ts:97:22
                  (i32.const 39)
                 )
                 ;;@ core/cpu/cbOpcodes.ts:97:28
                 (block
                  ;;@ core/cpu/cbOpcodes.ts:100:8
                  (set_local $2
                   ;;@ core/cpu/cbOpcodes.ts:100:36
                   (call $core/cpu/instructions/shiftLeftRegister
                    (get_local $1)
                   )
                  )
                  ;;@ core/cpu/cbOpcodes.ts:101:8
                  (set_local $3
                   ;;@ core/cpu/cbOpcodes.ts:101:24
                   (i32.const 1)
                  )
                 )
                 ;;@ core/cpu/cbOpcodes.ts:102:13
                 (if
                  ;;@ core/cpu/cbOpcodes.ts:102:17
                  (i32.le_s
                   (get_local $0)
                   ;;@ core/cpu/cbOpcodes.ts:102:29
                   (i32.const 47)
                  )
                  ;;@ core/cpu/cbOpcodes.ts:102:35
                  (block
                   ;;@ core/cpu/cbOpcodes.ts:105:8
                   (set_local $2
                    ;;@ core/cpu/cbOpcodes.ts:105:36
                    (call $core/cpu/instructions/shiftRightArithmeticRegister
                     (get_local $1)
                    )
                   )
                   ;;@ core/cpu/cbOpcodes.ts:106:8
                   (set_local $3
                    ;;@ core/cpu/cbOpcodes.ts:106:24
                    (i32.const 1)
                   )
                  )
                 )
                )
                ;;@ core/cpu/cbOpcodes.ts:108:6
                (br $break|1)
               )
               ;;@ core/cpu/cbOpcodes.ts:110:6
               (if
                ;;@ core/cpu/cbOpcodes.ts:110:10
                (i32.le_s
                 (get_local $0)
                 ;;@ core/cpu/cbOpcodes.ts:110:22
                 (i32.const 55)
                )
                ;;@ core/cpu/cbOpcodes.ts:110:28
                (block
                 ;;@ core/cpu/cbOpcodes.ts:113:8
                 (set_local $2
                  ;;@ core/cpu/cbOpcodes.ts:113:36
                  (call $core/cpu/instructions/swapNibblesOnRegister
                   (get_local $1)
                  )
                 )
                 ;;@ core/cpu/cbOpcodes.ts:114:8
                 (set_local $3
                  ;;@ core/cpu/cbOpcodes.ts:114:24
                  (i32.const 1)
                 )
                )
                ;;@ core/cpu/cbOpcodes.ts:115:13
                (if
                 ;;@ core/cpu/cbOpcodes.ts:115:17
                 (i32.le_s
                  (get_local $0)
                  ;;@ core/cpu/cbOpcodes.ts:115:29
                  (i32.const 63)
                 )
                 ;;@ core/cpu/cbOpcodes.ts:115:35
                 (block
                  ;;@ core/cpu/cbOpcodes.ts:118:8
                  (set_local $2
                   ;;@ core/cpu/cbOpcodes.ts:118:36
                   (call $core/cpu/instructions/shiftRightLogicalRegister
                    (get_local $1)
                   )
                  )
                  ;;@ core/cpu/cbOpcodes.ts:119:8
                  (set_local $3
                   ;;@ core/cpu/cbOpcodes.ts:119:24
                   (i32.const 1)
                  )
                 )
                )
               )
               ;;@ core/cpu/cbOpcodes.ts:121:6
               (br $break|1)
              )
              ;;@ core/cpu/cbOpcodes.ts:123:6
              (if
               ;;@ core/cpu/cbOpcodes.ts:123:10
               (i32.le_s
                (get_local $0)
                ;;@ core/cpu/cbOpcodes.ts:123:22
                (i32.const 71)
               )
               ;;@ core/cpu/cbOpcodes.ts:123:28
               (block
                ;;@ core/cpu/cbOpcodes.ts:127:8
                (set_local $2
                 ;;@ core/cpu/cbOpcodes.ts:127:36
                 (call $core/cpu/instructions/testBitOnRegister
                  ;;@ core/cpu/cbOpcodes.ts:127:54
                  (i32.const 0)
                  (get_local $1)
                 )
                )
                ;;@ core/cpu/cbOpcodes.ts:128:8
                (set_local $3
                 ;;@ core/cpu/cbOpcodes.ts:128:24
                 (i32.const 1)
                )
               )
               ;;@ core/cpu/cbOpcodes.ts:129:13
               (if
                ;;@ core/cpu/cbOpcodes.ts:129:17
                (i32.le_s
                 (get_local $0)
                 ;;@ core/cpu/cbOpcodes.ts:129:29
                 (i32.const 79)
                )
                ;;@ core/cpu/cbOpcodes.ts:129:35
                (block
                 ;;@ core/cpu/cbOpcodes.ts:132:8
                 (set_local $2
                  ;;@ core/cpu/cbOpcodes.ts:132:36
                  (call $core/cpu/instructions/testBitOnRegister
                   ;;@ core/cpu/cbOpcodes.ts:132:54
                   (i32.const 1)
                   (get_local $1)
                  )
                 )
                 ;;@ core/cpu/cbOpcodes.ts:133:8
                 (set_local $3
                  ;;@ core/cpu/cbOpcodes.ts:133:24
                  (i32.const 1)
                 )
                )
               )
              )
              ;;@ core/cpu/cbOpcodes.ts:135:6
              (br $break|1)
             )
             ;;@ core/cpu/cbOpcodes.ts:137:6
             (if
              ;;@ core/cpu/cbOpcodes.ts:137:10
              (i32.le_s
               (get_local $0)
               ;;@ core/cpu/cbOpcodes.ts:137:22
               (i32.const 87)
              )
              ;;@ core/cpu/cbOpcodes.ts:137:28
              (block
               ;;@ core/cpu/cbOpcodes.ts:140:8
               (set_local $2
                ;;@ core/cpu/cbOpcodes.ts:140:36
                (call $core/cpu/instructions/testBitOnRegister
                 ;;@ core/cpu/cbOpcodes.ts:140:54
                 (i32.const 2)
                 (get_local $1)
                )
               )
               ;;@ core/cpu/cbOpcodes.ts:141:8
               (set_local $3
                ;;@ core/cpu/cbOpcodes.ts:141:24
                (i32.const 1)
               )
              )
              ;;@ core/cpu/cbOpcodes.ts:142:13
              (if
               ;;@ core/cpu/cbOpcodes.ts:142:17
               (i32.le_s
                (get_local $0)
                ;;@ core/cpu/cbOpcodes.ts:142:29
                (i32.const 95)
               )
               ;;@ core/cpu/cbOpcodes.ts:142:35
               (block
                ;;@ core/cpu/cbOpcodes.ts:145:8
                (set_local $2
                 ;;@ core/cpu/cbOpcodes.ts:145:36
                 (call $core/cpu/instructions/testBitOnRegister
                  ;;@ core/cpu/cbOpcodes.ts:145:54
                  (i32.const 3)
                  (get_local $1)
                 )
                )
                ;;@ core/cpu/cbOpcodes.ts:146:8
                (set_local $3
                 ;;@ core/cpu/cbOpcodes.ts:146:24
                 (i32.const 1)
                )
               )
              )
             )
             ;;@ core/cpu/cbOpcodes.ts:148:6
             (br $break|1)
            )
            ;;@ core/cpu/cbOpcodes.ts:150:6
            (if
             ;;@ core/cpu/cbOpcodes.ts:150:10
             (i32.le_s
              (get_local $0)
              ;;@ core/cpu/cbOpcodes.ts:150:22
              (i32.const 103)
             )
             ;;@ core/cpu/cbOpcodes.ts:150:28
             (block
              ;;@ core/cpu/cbOpcodes.ts:153:8
              (set_local $2
               ;;@ core/cpu/cbOpcodes.ts:153:36
               (call $core/cpu/instructions/testBitOnRegister
                ;;@ core/cpu/cbOpcodes.ts:153:54
                (i32.const 4)
                (get_local $1)
               )
              )
              ;;@ core/cpu/cbOpcodes.ts:154:8
              (set_local $3
               ;;@ core/cpu/cbOpcodes.ts:154:24
               (i32.const 1)
              )
             )
             ;;@ core/cpu/cbOpcodes.ts:155:13
             (if
              ;;@ core/cpu/cbOpcodes.ts:155:17
              (i32.le_s
               (get_local $0)
               ;;@ core/cpu/cbOpcodes.ts:155:29
               (i32.const 111)
              )
              ;;@ core/cpu/cbOpcodes.ts:155:35
              (block
               ;;@ core/cpu/cbOpcodes.ts:158:8
               (set_local $2
                ;;@ core/cpu/cbOpcodes.ts:158:36
                (call $core/cpu/instructions/testBitOnRegister
                 ;;@ core/cpu/cbOpcodes.ts:158:54
                 (i32.const 5)
                 (get_local $1)
                )
               )
               ;;@ core/cpu/cbOpcodes.ts:159:8
               (set_local $3
                ;;@ core/cpu/cbOpcodes.ts:159:24
                (i32.const 1)
               )
              )
             )
            )
            ;;@ core/cpu/cbOpcodes.ts:161:6
            (br $break|1)
           )
           ;;@ core/cpu/cbOpcodes.ts:163:6
           (if
            ;;@ core/cpu/cbOpcodes.ts:163:10
            (i32.le_s
             (get_local $0)
             ;;@ core/cpu/cbOpcodes.ts:163:22
             (i32.const 119)
            )
            ;;@ core/cpu/cbOpcodes.ts:163:28
            (block
             ;;@ core/cpu/cbOpcodes.ts:166:8
             (set_local $2
              ;;@ core/cpu/cbOpcodes.ts:166:36
              (call $core/cpu/instructions/testBitOnRegister
               ;;@ core/cpu/cbOpcodes.ts:166:54
               (i32.const 6)
               (get_local $1)
              )
             )
             ;;@ core/cpu/cbOpcodes.ts:167:8
             (set_local $3
              ;;@ core/cpu/cbOpcodes.ts:167:24
              (i32.const 1)
             )
            )
            ;;@ core/cpu/cbOpcodes.ts:168:13
            (if
             ;;@ core/cpu/cbOpcodes.ts:168:17
             (i32.le_s
              (get_local $0)
              ;;@ core/cpu/cbOpcodes.ts:168:29
              (i32.const 127)
             )
             ;;@ core/cpu/cbOpcodes.ts:168:35
             (block
              ;;@ core/cpu/cbOpcodes.ts:171:8
              (set_local $2
               ;;@ core/cpu/cbOpcodes.ts:171:36
               (call $core/cpu/instructions/testBitOnRegister
                ;;@ core/cpu/cbOpcodes.ts:171:54
                (i32.const 7)
                (get_local $1)
               )
              )
              ;;@ core/cpu/cbOpcodes.ts:172:8
              (set_local $3
               ;;@ core/cpu/cbOpcodes.ts:172:24
               (i32.const 1)
              )
             )
            )
           )
           ;;@ core/cpu/cbOpcodes.ts:174:6
           (br $break|1)
          )
          ;;@ core/cpu/cbOpcodes.ts:176:6
          (if
           ;;@ core/cpu/cbOpcodes.ts:176:10
           (i32.le_s
            (get_local $0)
            ;;@ core/cpu/cbOpcodes.ts:176:22
            (i32.const 135)
           )
           ;;@ core/cpu/cbOpcodes.ts:176:28
           (block
            ;;@ core/cpu/cbOpcodes.ts:179:8
            (set_local $2
             ;;@ core/cpu/cbOpcodes.ts:179:36
             (call $core/cpu/instructions/setBitOnRegister
              ;;@ core/cpu/cbOpcodes.ts:179:53
              (i32.const 0)
              ;;@ core/cpu/cbOpcodes.ts:179:56
              (i32.const 0)
              (get_local $1)
             )
            )
            ;;@ core/cpu/cbOpcodes.ts:180:8
            (set_local $3
             ;;@ core/cpu/cbOpcodes.ts:180:24
             (i32.const 1)
            )
           )
           ;;@ core/cpu/cbOpcodes.ts:181:13
           (if
            ;;@ core/cpu/cbOpcodes.ts:181:17
            (i32.le_s
             (get_local $0)
             ;;@ core/cpu/cbOpcodes.ts:181:29
             (i32.const 143)
            )
            ;;@ core/cpu/cbOpcodes.ts:181:35
            (block
             ;;@ core/cpu/cbOpcodes.ts:184:8
             (set_local $2
              ;;@ core/cpu/cbOpcodes.ts:184:36
              (call $core/cpu/instructions/setBitOnRegister
               ;;@ core/cpu/cbOpcodes.ts:184:53
               (i32.const 1)
               ;;@ core/cpu/cbOpcodes.ts:184:56
               (i32.const 0)
               (get_local $1)
              )
             )
             ;;@ core/cpu/cbOpcodes.ts:185:8
             (set_local $3
              ;;@ core/cpu/cbOpcodes.ts:185:24
              (i32.const 1)
             )
            )
           )
          )
          ;;@ core/cpu/cbOpcodes.ts:187:6
          (br $break|1)
         )
         ;;@ core/cpu/cbOpcodes.ts:189:6
         (if
          ;;@ core/cpu/cbOpcodes.ts:189:10
          (i32.le_s
           (get_local $0)
           ;;@ core/cpu/cbOpcodes.ts:189:22
           (i32.const 151)
          )
          ;;@ core/cpu/cbOpcodes.ts:189:28
          (block
           ;;@ core/cpu/cbOpcodes.ts:192:8
           (set_local $2
            ;;@ core/cpu/cbOpcodes.ts:192:36
            (call $core/cpu/instructions/setBitOnRegister
             ;;@ core/cpu/cbOpcodes.ts:192:53
             (i32.const 2)
             ;;@ core/cpu/cbOpcodes.ts:192:56
             (i32.const 0)
             (get_local $1)
            )
           )
           ;;@ core/cpu/cbOpcodes.ts:193:8
           (set_local $3
            ;;@ core/cpu/cbOpcodes.ts:193:24
            (i32.const 1)
           )
          )
          ;;@ core/cpu/cbOpcodes.ts:194:13
          (if
           ;;@ core/cpu/cbOpcodes.ts:194:17
           (i32.le_s
            (get_local $0)
            ;;@ core/cpu/cbOpcodes.ts:194:29
            (i32.const 159)
           )
           ;;@ core/cpu/cbOpcodes.ts:194:35
           (block
            ;;@ core/cpu/cbOpcodes.ts:197:8
            (set_local $2
             ;;@ core/cpu/cbOpcodes.ts:197:36
             (call $core/cpu/instructions/setBitOnRegister
              ;;@ core/cpu/cbOpcodes.ts:197:53
              (i32.const 3)
              ;;@ core/cpu/cbOpcodes.ts:197:56
              (i32.const 0)
              (get_local $1)
             )
            )
            ;;@ core/cpu/cbOpcodes.ts:198:8
            (set_local $3
             ;;@ core/cpu/cbOpcodes.ts:198:24
             (i32.const 1)
            )
           )
          )
         )
         ;;@ core/cpu/cbOpcodes.ts:200:6
         (br $break|1)
        )
        ;;@ core/cpu/cbOpcodes.ts:202:6
        (if
         ;;@ core/cpu/cbOpcodes.ts:202:10
         (i32.le_s
          (get_local $0)
          ;;@ core/cpu/cbOpcodes.ts:202:22
          (i32.const 167)
         )
         ;;@ core/cpu/cbOpcodes.ts:202:28
         (block
          ;;@ core/cpu/cbOpcodes.ts:205:8
          (set_local $2
           ;;@ core/cpu/cbOpcodes.ts:205:36
           (call $core/cpu/instructions/setBitOnRegister
            ;;@ core/cpu/cbOpcodes.ts:205:53
            (i32.const 4)
            ;;@ core/cpu/cbOpcodes.ts:205:56
            (i32.const 0)
            (get_local $1)
           )
          )
          ;;@ core/cpu/cbOpcodes.ts:206:8
          (set_local $3
           ;;@ core/cpu/cbOpcodes.ts:206:24
           (i32.const 1)
          )
         )
         ;;@ core/cpu/cbOpcodes.ts:207:13
         (if
          ;;@ core/cpu/cbOpcodes.ts:207:17
          (i32.le_s
           (get_local $0)
           ;;@ core/cpu/cbOpcodes.ts:207:29
           (i32.const 175)
          )
          ;;@ core/cpu/cbOpcodes.ts:207:35
          (block
           ;;@ core/cpu/cbOpcodes.ts:210:8
           (set_local $2
            ;;@ core/cpu/cbOpcodes.ts:210:36
            (call $core/cpu/instructions/setBitOnRegister
             ;;@ core/cpu/cbOpcodes.ts:210:53
             (i32.const 5)
             ;;@ core/cpu/cbOpcodes.ts:210:56
             (i32.const 0)
             (get_local $1)
            )
           )
           ;;@ core/cpu/cbOpcodes.ts:211:8
           (set_local $3
            ;;@ core/cpu/cbOpcodes.ts:211:24
            (i32.const 1)
           )
          )
         )
        )
        ;;@ core/cpu/cbOpcodes.ts:213:6
        (br $break|1)
       )
       ;;@ core/cpu/cbOpcodes.ts:215:6
       (if
        ;;@ core/cpu/cbOpcodes.ts:215:10
        (i32.le_s
         (get_local $0)
         ;;@ core/cpu/cbOpcodes.ts:215:22
         (i32.const 183)
        )
        ;;@ core/cpu/cbOpcodes.ts:215:28
        (block
         ;;@ core/cpu/cbOpcodes.ts:218:8
         (set_local $2
          ;;@ core/cpu/cbOpcodes.ts:218:36
          (call $core/cpu/instructions/setBitOnRegister
           ;;@ core/cpu/cbOpcodes.ts:218:53
           (i32.const 6)
           ;;@ core/cpu/cbOpcodes.ts:218:56
           (i32.const 0)
           (get_local $1)
          )
         )
         ;;@ core/cpu/cbOpcodes.ts:219:8
         (set_local $3
          ;;@ core/cpu/cbOpcodes.ts:219:24
          (i32.const 1)
         )
        )
        ;;@ core/cpu/cbOpcodes.ts:220:13
        (if
         ;;@ core/cpu/cbOpcodes.ts:220:17
         (i32.le_s
          (get_local $0)
          ;;@ core/cpu/cbOpcodes.ts:220:29
          (i32.const 191)
         )
         ;;@ core/cpu/cbOpcodes.ts:220:35
         (block
          ;;@ core/cpu/cbOpcodes.ts:223:8
          (set_local $2
           ;;@ core/cpu/cbOpcodes.ts:223:36
           (call $core/cpu/instructions/setBitOnRegister
            ;;@ core/cpu/cbOpcodes.ts:223:53
            (i32.const 7)
            ;;@ core/cpu/cbOpcodes.ts:223:56
            (i32.const 0)
            (get_local $1)
           )
          )
          ;;@ core/cpu/cbOpcodes.ts:224:8
          (set_local $3
           ;;@ core/cpu/cbOpcodes.ts:224:24
           (i32.const 1)
          )
         )
        )
       )
       ;;@ core/cpu/cbOpcodes.ts:226:6
       (br $break|1)
      )
      ;;@ core/cpu/cbOpcodes.ts:228:6
      (if
       ;;@ core/cpu/cbOpcodes.ts:228:10
       (i32.le_s
        (get_local $0)
        ;;@ core/cpu/cbOpcodes.ts:228:22
        (i32.const 199)
       )
       ;;@ core/cpu/cbOpcodes.ts:228:28
       (block
        ;;@ core/cpu/cbOpcodes.ts:231:8
        (set_local $2
         ;;@ core/cpu/cbOpcodes.ts:231:36
         (call $core/cpu/instructions/setBitOnRegister
          ;;@ core/cpu/cbOpcodes.ts:231:53
          (i32.const 0)
          ;;@ core/cpu/cbOpcodes.ts:231:56
          (i32.const 1)
          (get_local $1)
         )
        )
        ;;@ core/cpu/cbOpcodes.ts:232:8
        (set_local $3
         ;;@ core/cpu/cbOpcodes.ts:232:24
         (i32.const 1)
        )
       )
       ;;@ core/cpu/cbOpcodes.ts:233:13
       (if
        ;;@ core/cpu/cbOpcodes.ts:233:17
        (i32.le_s
         (get_local $0)
         ;;@ core/cpu/cbOpcodes.ts:233:29
         (i32.const 207)
        )
        ;;@ core/cpu/cbOpcodes.ts:233:35
        (block
         ;;@ core/cpu/cbOpcodes.ts:236:8
         (set_local $2
          ;;@ core/cpu/cbOpcodes.ts:236:36
          (call $core/cpu/instructions/setBitOnRegister
           ;;@ core/cpu/cbOpcodes.ts:236:53
           (i32.const 1)
           ;;@ core/cpu/cbOpcodes.ts:236:56
           (i32.const 1)
           (get_local $1)
          )
         )
         ;;@ core/cpu/cbOpcodes.ts:237:8
         (set_local $3
          ;;@ core/cpu/cbOpcodes.ts:237:24
          (i32.const 1)
         )
        )
       )
      )
      ;;@ core/cpu/cbOpcodes.ts:239:6
      (br $break|1)
     )
     ;;@ core/cpu/cbOpcodes.ts:241:6
     (if
      ;;@ core/cpu/cbOpcodes.ts:241:10
      (i32.le_s
       (get_local $0)
       ;;@ core/cpu/cbOpcodes.ts:241:22
       (i32.const 215)
      )
      ;;@ core/cpu/cbOpcodes.ts:241:28
      (block
       ;;@ core/cpu/cbOpcodes.ts:244:8
       (set_local $2
        ;;@ core/cpu/cbOpcodes.ts:244:36
        (call $core/cpu/instructions/setBitOnRegister
         ;;@ core/cpu/cbOpcodes.ts:244:53
         (i32.const 2)
         ;;@ core/cpu/cbOpcodes.ts:244:56
         (i32.const 1)
         (get_local $1)
        )
       )
       ;;@ core/cpu/cbOpcodes.ts:245:8
       (set_local $3
        ;;@ core/cpu/cbOpcodes.ts:245:24
        (i32.const 1)
       )
      )
      ;;@ core/cpu/cbOpcodes.ts:246:13
      (if
       ;;@ core/cpu/cbOpcodes.ts:246:17
       (i32.le_s
        (get_local $0)
        ;;@ core/cpu/cbOpcodes.ts:246:29
        (i32.const 223)
       )
       ;;@ core/cpu/cbOpcodes.ts:246:35
       (block
        ;;@ core/cpu/cbOpcodes.ts:249:8
        (set_local $2
         ;;@ core/cpu/cbOpcodes.ts:249:36
         (call $core/cpu/instructions/setBitOnRegister
          ;;@ core/cpu/cbOpcodes.ts:249:53
          (i32.const 3)
          ;;@ core/cpu/cbOpcodes.ts:249:56
          (i32.const 1)
          (get_local $1)
         )
        )
        ;;@ core/cpu/cbOpcodes.ts:250:8
        (set_local $3
         ;;@ core/cpu/cbOpcodes.ts:250:24
         (i32.const 1)
        )
       )
      )
     )
     ;;@ core/cpu/cbOpcodes.ts:252:6
     (br $break|1)
    )
    ;;@ core/cpu/cbOpcodes.ts:254:6
    (if
     ;;@ core/cpu/cbOpcodes.ts:254:10
     (i32.le_s
      (get_local $0)
      ;;@ core/cpu/cbOpcodes.ts:254:22
      (i32.const 231)
     )
     ;;@ core/cpu/cbOpcodes.ts:254:28
     (block
      ;;@ core/cpu/cbOpcodes.ts:257:8
      (set_local $2
       ;;@ core/cpu/cbOpcodes.ts:257:36
       (call $core/cpu/instructions/setBitOnRegister
        ;;@ core/cpu/cbOpcodes.ts:257:53
        (i32.const 4)
        ;;@ core/cpu/cbOpcodes.ts:257:56
        (i32.const 1)
        (get_local $1)
       )
      )
      ;;@ core/cpu/cbOpcodes.ts:258:8
      (set_local $3
       ;;@ core/cpu/cbOpcodes.ts:258:24
       (i32.const 1)
      )
     )
     ;;@ core/cpu/cbOpcodes.ts:259:13
     (if
      ;;@ core/cpu/cbOpcodes.ts:259:17
      (i32.le_s
       (get_local $0)
       ;;@ core/cpu/cbOpcodes.ts:259:29
       (i32.const 239)
      )
      ;;@ core/cpu/cbOpcodes.ts:259:35
      (block
       ;;@ core/cpu/cbOpcodes.ts:262:8
       (set_local $2
        ;;@ core/cpu/cbOpcodes.ts:262:36
        (call $core/cpu/instructions/setBitOnRegister
         ;;@ core/cpu/cbOpcodes.ts:262:53
         (i32.const 5)
         ;;@ core/cpu/cbOpcodes.ts:262:56
         (i32.const 1)
         (get_local $1)
        )
       )
       ;;@ core/cpu/cbOpcodes.ts:263:8
       (set_local $3
        ;;@ core/cpu/cbOpcodes.ts:263:24
        (i32.const 1)
       )
      )
     )
    )
    ;;@ core/cpu/cbOpcodes.ts:265:6
    (br $break|1)
   )
   ;;@ core/cpu/cbOpcodes.ts:267:6
   (if
    ;;@ core/cpu/cbOpcodes.ts:267:10
    (i32.le_s
     (get_local $0)
     ;;@ core/cpu/cbOpcodes.ts:267:22
     (i32.const 247)
    )
    ;;@ core/cpu/cbOpcodes.ts:267:28
    (block
     ;;@ core/cpu/cbOpcodes.ts:270:8
     (set_local $2
      ;;@ core/cpu/cbOpcodes.ts:270:36
      (call $core/cpu/instructions/setBitOnRegister
       ;;@ core/cpu/cbOpcodes.ts:270:53
       (i32.const 6)
       ;;@ core/cpu/cbOpcodes.ts:270:56
       (i32.const 1)
       (get_local $1)
      )
     )
     ;;@ core/cpu/cbOpcodes.ts:271:8
     (set_local $3
      ;;@ core/cpu/cbOpcodes.ts:271:24
      (i32.const 1)
     )
    )
    ;;@ core/cpu/cbOpcodes.ts:272:13
    (if
     ;;@ core/cpu/cbOpcodes.ts:272:17
     (i32.le_s
      (get_local $0)
      ;;@ core/cpu/cbOpcodes.ts:272:29
      (i32.const 255)
     )
     ;;@ core/cpu/cbOpcodes.ts:272:35
     (block
      ;;@ core/cpu/cbOpcodes.ts:275:8
      (set_local $2
       ;;@ core/cpu/cbOpcodes.ts:275:36
       (call $core/cpu/instructions/setBitOnRegister
        ;;@ core/cpu/cbOpcodes.ts:275:53
        (i32.const 7)
        ;;@ core/cpu/cbOpcodes.ts:275:56
        (i32.const 1)
        (get_local $1)
       )
      )
      ;;@ core/cpu/cbOpcodes.ts:276:8
      (set_local $3
       ;;@ core/cpu/cbOpcodes.ts:276:24
       (i32.const 1)
      )
     )
    )
   )
  )
  ;;@ core/cpu/cbOpcodes.ts:282:2
  (block $break|2
   (block $case7|2
    (block $case6|2
     (block $case5|2
      (block $case4|2
       (block $case3|2
        (block $case2|2
         (block $case1|2
          (if
           (tee_local $4
            (get_local $7)
           )
           (block
            (block $tablify|01
             (br_table $case1|2 $case2|2 $case3|2 $case4|2 $case5|2 $case6|2 $case7|2 $tablify|01
              (i32.sub
               (get_local $4)
               (i32.const 1)
              )
             )
            )
            (br $break|2)
           )
          )
          ;;@ core/cpu/cbOpcodes.ts:284:6
          (set_global $core/cpu/cpu/Cpu.registerB
           (get_local $2)
          )
          ;;@ core/cpu/cbOpcodes.ts:285:6
          (br $break|2)
         )
         ;;@ core/cpu/cbOpcodes.ts:287:6
         (set_global $core/cpu/cpu/Cpu.registerC
          (get_local $2)
         )
         ;;@ core/cpu/cbOpcodes.ts:288:6
         (br $break|2)
        )
        ;;@ core/cpu/cbOpcodes.ts:290:6
        (set_global $core/cpu/cpu/Cpu.registerD
         (get_local $2)
        )
        ;;@ core/cpu/cbOpcodes.ts:291:6
        (br $break|2)
       )
       ;;@ core/cpu/cbOpcodes.ts:293:6
       (set_global $core/cpu/cpu/Cpu.registerE
        (get_local $2)
       )
       ;;@ core/cpu/cbOpcodes.ts:294:6
       (br $break|2)
      )
      ;;@ core/cpu/cbOpcodes.ts:296:6
      (set_global $core/cpu/cpu/Cpu.registerH
       (get_local $2)
      )
      ;;@ core/cpu/cbOpcodes.ts:297:6
      (br $break|2)
     )
     ;;@ core/cpu/cbOpcodes.ts:299:6
     (set_global $core/cpu/cpu/Cpu.registerL
      (get_local $2)
     )
     ;;@ core/cpu/cbOpcodes.ts:300:6
     (br $break|2)
    )
    ;;@ core/cpu/cbOpcodes.ts:307:10
    (if
     (i32.eqz
      (tee_local $4
       (i32.lt_s
        (get_local $5)
        ;;@ core/cpu/cbOpcodes.ts:307:29
        (i32.const 4)
       )
      )
     )
     (set_local $4
      ;;@ core/cpu/cbOpcodes.ts:307:37
      (i32.gt_s
       (get_local $5)
       ;;@ core/cpu/cbOpcodes.ts:307:56
       (i32.const 7)
      )
     )
    )
    ;;@ core/cpu/cbOpcodes.ts:307:6
    (if
     (get_local $4)
     ;;@ core/cpu/cbOpcodes.ts:307:62
     (call $core/cpu/opcodes/eightBitStoreSyncCycles
      ;;@ core/cpu/cbOpcodes.ts:310:32
      (call $core/helpers/index/concatenateBytes
       ;;@ core/cpu/cbOpcodes.ts:310:49
       (get_global $core/cpu/cpu/Cpu.registerH)
       ;;@ core/cpu/cbOpcodes.ts:310:64
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (get_local $2)
     )
    )
    ;;@ core/cpu/cbOpcodes.ts:312:6
    (br $break|2)
   )
   ;;@ core/cpu/cbOpcodes.ts:314:6
   (set_global $core/cpu/cpu/Cpu.registerA
    (get_local $2)
   )
  )
  ;;@ core/cpu/cbOpcodes.ts:320:2
  (if
   (get_local $3)
   ;;@ core/cpu/cbOpcodes.ts:320:21
   (set_local $6
    ;;@ core/cpu/cbOpcodes.ts:321:21
    (i32.const 4)
   )
  )
  (get_local $6)
 )
 (func $core/cpu/opcodes/handleOpcodeCx (; 219 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner5
   (block $folding-inner4
    (block $folding-inner3
     (block $folding-inner2
      (block $folding-inner1
       (block $folding-inner0
        (block $break|0
         (block $case15|0
          (block $case14|0
           (block $case13|0
            (block $case12|0
             (block $case11|0
              (block $case10|0
               (block $case9|0
                (block $case8|0
                 (block $case7|0
                  (block $case6|0
                   (block $case5|0
                    (block $case4|0
                     (block $case3|0
                      (block $case2|0
                       (block $case1|0
                        (if
                         (i32.ne
                          (tee_local $1
                           (get_local $0)
                          )
                          ;;@ core/cpu/opcodes.ts:1735:9
                          (i32.const 192)
                         )
                         (block
                          (block $tablify|0
                           (br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                            (i32.sub
                             (get_local $1)
                             (i32.const 193)
                            )
                           )
                          )
                          (br $break|0)
                         )
                        )
                        (br_if $folding-inner2
                         ;;@ core/cpu/opcodes.ts:1738:10
                         (call $core/cpu/flags/getZeroFlag)
                        )
                        (br $folding-inner3)
                       )
                       ;;@ core/cpu/opcodes.ts:1750:6
                       (set_local $1
                        ;;@ core/cpu/opcodes.ts:1750:29
                        (i32.and
                         (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                          ;;@ core/cpu/opcodes.ts:1750:54
                          (get_global $core/cpu/cpu/Cpu.stackPointer)
                         )
                         (i32.const 65535)
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1751:6
                       (set_global $core/cpu/cpu/Cpu.stackPointer
                        ;;@ core/cpu/opcodes.ts:1751:25
                        (call $core/portable/portable/u16Portable
                         ;;@ core/cpu/opcodes.ts:1751:37
                         (i32.add
                          (get_global $core/cpu/cpu/Cpu.stackPointer)
                          ;;@ core/cpu/opcodes.ts:1751:56
                          (i32.const 2)
                         )
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1752:6
                       (set_global $core/cpu/cpu/Cpu.registerB
                        (i32.and
                         ;;@ core/cpu/opcodes.ts:1752:22
                         (call $core/helpers/index/splitHighByte
                          (get_local $1)
                         )
                         (i32.const 255)
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1753:6
                       (set_global $core/cpu/cpu/Cpu.registerC
                        (i32.and
                         ;;@ core/cpu/opcodes.ts:1753:22
                         (call $core/helpers/index/splitLowByte
                          (get_local $1)
                         )
                         (i32.const 255)
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1754:13
                       (return
                        (i32.const 4)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:1758:6
                      (if
                       ;;@ core/cpu/opcodes.ts:1758:10
                       (call $core/cpu/flags/getZeroFlag)
                       (br $folding-inner4)
                       (br $folding-inner1)
                      )
                     )
                     (br $folding-inner1)
                    )
                    ;;@ core/cpu/opcodes.ts:1775:6
                    (if
                     ;;@ core/cpu/opcodes.ts:1775:10
                     (call $core/cpu/flags/getZeroFlag)
                     (br $folding-inner4)
                     (br $folding-inner0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1789:6
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:1789:25
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:1789:37
                     (i32.sub
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:1789:56
                      (i32.const 2)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1791:6
                   (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                    ;;@ core/cpu/opcodes.ts:1791:32
                    (get_global $core/cpu/cpu/Cpu.stackPointer)
                    ;;@ core/cpu/opcodes.ts:1791:50
                    (call $core/helpers/index/concatenateBytes
                     ;;@ core/cpu/opcodes.ts:1791:67
                     (get_global $core/cpu/cpu/Cpu.registerB)
                     ;;@ core/cpu/opcodes.ts:1791:82
                     (get_global $core/cpu/cpu/Cpu.registerC)
                    )
                   )
                   (br $folding-inner2)
                  )
                  ;;@ core/cpu/opcodes.ts:1798:6
                  (call $core/cpu/instructions/addARegister
                   ;;@ core/cpu/opcodes.ts:1798:19
                   (call $core/cpu/opcodes/getDataByteOne)
                  )
                  (br $folding-inner5)
                 )
                 ;;@ core/cpu/opcodes.ts:1804:6
                 (set_global $core/cpu/cpu/Cpu.stackPointer
                  ;;@ core/cpu/opcodes.ts:1804:25
                  (call $core/portable/portable/u16Portable
                   ;;@ core/cpu/opcodes.ts:1804:37
                   (i32.sub
                    (get_global $core/cpu/cpu/Cpu.stackPointer)
                    ;;@ core/cpu/opcodes.ts:1804:56
                    (i32.const 2)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:1806:6
                 (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                  ;;@ core/cpu/opcodes.ts:1806:32
                  (get_global $core/cpu/cpu/Cpu.stackPointer)
                  ;;@ core/cpu/opcodes.ts:1806:50
                  (get_global $core/cpu/cpu/Cpu.programCounter)
                 )
                 ;;@ core/cpu/opcodes.ts:1807:6
                 (set_global $core/cpu/cpu/Cpu.programCounter
                  ;;@ core/cpu/opcodes.ts:1807:27
                  (i32.const 0)
                 )
                 (br $folding-inner2)
                )
                (br_if $folding-inner2
                 ;;@ core/cpu/opcodes.ts:1812:10
                 (i32.ne
                  (call $core/cpu/flags/getZeroFlag)
                  ;;@ core/cpu/opcodes.ts:1812:28
                  (i32.const 1)
                 )
                )
                (br $folding-inner3)
               )
               ;;@ core/cpu/opcodes.ts:1824:6
               (set_global $core/cpu/cpu/Cpu.programCounter
                (i32.and
                 ;;@ core/cpu/opcodes.ts:1824:27
                 (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                  ;;@ core/cpu/opcodes.ts:1824:57
                  (get_global $core/cpu/cpu/Cpu.stackPointer)
                 )
                 (i32.const 65535)
                )
               )
               ;;@ core/cpu/opcodes.ts:1825:6
               (set_global $core/cpu/cpu/Cpu.stackPointer
                ;;@ core/cpu/opcodes.ts:1825:25
                (call $core/portable/portable/u16Portable
                 ;;@ core/cpu/opcodes.ts:1825:37
                 (i32.add
                  (get_global $core/cpu/cpu/Cpu.stackPointer)
                  ;;@ core/cpu/opcodes.ts:1825:56
                  (i32.const 2)
                 )
                )
               )
               (br $folding-inner2)
              )
              ;;@ core/cpu/opcodes.ts:1830:6
              (if
               ;;@ core/cpu/opcodes.ts:1830:10
               (i32.eq
                (call $core/cpu/flags/getZeroFlag)
                ;;@ core/cpu/opcodes.ts:1830:28
                (i32.const 1)
               )
               (br $folding-inner1)
               (br $folding-inner4)
              )
             )
             ;;@ core/cpu/opcodes.ts:1842:6
             (set_local $1
              ;;@ core/cpu/opcodes.ts:1842:26
              (call $core/cpu/cbOpcodes/handleCbOpcode
               ;;@ core/cpu/opcodes.ts:1842:41
               (i32.and
                (call $core/cpu/opcodes/getDataByteOne)
                (i32.const 255)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:1843:6
             (set_global $core/cpu/cpu/Cpu.programCounter
              ;;@ core/cpu/opcodes.ts:1843:27
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:1843:39
               (i32.add
                (get_global $core/cpu/cpu/Cpu.programCounter)
                ;;@ core/cpu/opcodes.ts:1843:60
                (i32.const 1)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:1844:13
             (return
              (get_local $1)
             )
            )
            ;;@ core/cpu/opcodes.ts:1848:6
            (if
             ;;@ core/cpu/opcodes.ts:1848:10
             (i32.eq
              (call $core/cpu/flags/getZeroFlag)
              ;;@ core/cpu/opcodes.ts:1848:28
              (i32.const 1)
             )
             ;;@ core/cpu/opcodes.ts:1848:31
             (block
              ;;@ core/cpu/opcodes.ts:1849:8
              (set_global $core/cpu/cpu/Cpu.stackPointer
               ;;@ core/cpu/opcodes.ts:1849:27
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:1849:39
                (i32.sub
                 (get_global $core/cpu/cpu/Cpu.stackPointer)
                 ;;@ core/cpu/opcodes.ts:1849:58
                 (i32.const 2)
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:1851:8
              (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:1851:34
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:1851:52
               (i32.and
                (i32.add
                 (get_global $core/cpu/cpu/Cpu.programCounter)
                 ;;@ core/cpu/opcodes.ts:1851:73
                 (i32.const 2)
                )
                (i32.const 65535)
               )
              )
              (br $folding-inner1)
             )
             (br $folding-inner4)
            )
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1873:6
          (call $core/cpu/instructions/addAThroughCarryRegister
           ;;@ core/cpu/opcodes.ts:1873:31
           (call $core/cpu/opcodes/getDataByteOne)
          )
          (br $folding-inner5)
         )
         ;;@ core/cpu/opcodes.ts:1879:6
         (set_global $core/cpu/cpu/Cpu.stackPointer
          ;;@ core/cpu/opcodes.ts:1879:25
          (call $core/portable/portable/u16Portable
           ;;@ core/cpu/opcodes.ts:1879:37
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.stackPointer)
            ;;@ core/cpu/opcodes.ts:1879:56
            (i32.const 2)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:1881:6
         (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
          ;;@ core/cpu/opcodes.ts:1881:32
          (get_global $core/cpu/cpu/Cpu.stackPointer)
          ;;@ core/cpu/opcodes.ts:1881:50
          (get_global $core/cpu/cpu/Cpu.programCounter)
         )
         ;;@ core/cpu/opcodes.ts:1882:6
         (set_global $core/cpu/cpu/Cpu.programCounter
          ;;@ core/cpu/opcodes.ts:1882:27
          (i32.const 8)
         )
         (br $folding-inner2)
        )
        (return
         (i32.const -1)
        )
       )
       ;;@ core/cpu/opcodes.ts:1776:8
       (set_global $core/cpu/cpu/Cpu.stackPointer
        ;;@ core/cpu/opcodes.ts:1776:27
        (call $core/portable/portable/u16Portable
         ;;@ core/cpu/opcodes.ts:1776:39
         (i32.sub
          (get_global $core/cpu/cpu/Cpu.stackPointer)
          ;;@ core/cpu/opcodes.ts:1776:58
          (i32.const 2)
         )
        )
       )
       ;;@ core/cpu/opcodes.ts:1778:8
       (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
        ;;@ core/cpu/opcodes.ts:1778:34
        (get_global $core/cpu/cpu/Cpu.stackPointer)
        ;;@ core/cpu/opcodes.ts:1778:52
        (call $core/portable/portable/u16Portable
         ;;@ core/cpu/opcodes.ts:1778:64
         (i32.add
          (get_global $core/cpu/cpu/Cpu.programCounter)
          ;;@ core/cpu/opcodes.ts:1778:85
          (i32.const 2)
         )
        )
       )
      )
      ;;@ core/cpu/opcodes.ts:1760:8
      (set_global $core/cpu/cpu/Cpu.programCounter
       (i32.and
        ;;@ core/cpu/opcodes.ts:1760:29
        (call $core/cpu/opcodes/getConcatenatedDataByte)
        (i32.const 65535)
       )
      )
     )
     (return
      (i32.const 8)
     )
    )
    ;;@ core/cpu/opcodes.ts:1740:8
    (set_global $core/cpu/cpu/Cpu.programCounter
     (i32.and
      ;;@ core/cpu/opcodes.ts:1740:29
      (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1740:59
       (get_global $core/cpu/cpu/Cpu.stackPointer)
      )
      (i32.const 65535)
     )
    )
    ;;@ core/cpu/opcodes.ts:1741:8
    (set_global $core/cpu/cpu/Cpu.stackPointer
     ;;@ core/cpu/opcodes.ts:1741:27
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:1741:39
      (i32.add
       (get_global $core/cpu/cpu/Cpu.stackPointer)
       ;;@ core/cpu/opcodes.ts:1741:58
       (i32.const 2)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:1742:15
    (return
     (i32.const 12)
    )
   )
   ;;@ core/cpu/opcodes.ts:1763:8
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:1763:29
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:1763:41
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:1763:62
      (i32.const 2)
     )
    )
   )
   ;;@ core/cpu/opcodes.ts:1764:15
   (return
    (i32.const 12)
   )
  )
  ;;@ core/cpu/opcodes.ts:1799:6
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/opcodes.ts:1799:27
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:1799:39
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:1799:60
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:1800:13
  (i32.const 4)
 )
 (func $core/interrupts/interrupts/setInterrupts (; 220 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/interrupts/interrupts.ts:169:2
  (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
   (i32.and
    (get_local $0)
    (i32.const 1)
   )
  )
 )
 (func $core/cpu/opcodes/handleOpcodeDx (; 221 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $folding-inner4
   (block $folding-inner3
    (block $folding-inner2
     (block $folding-inner1
      (block $folding-inner0
       (block $break|0
        (block $case12|0
         (block $case11|0
          (block $case10|0
           (block $case9|0
            (block $case8|0
             (block $case7|0
              (block $case6|0
               (block $case5|0
                (block $case4|0
                 (block $case3|0
                  (block $case2|0
                   (block $case1|0
                    (if
                     (i32.ne
                      (tee_local $1
                       (get_local $0)
                      )
                      ;;@ core/cpu/opcodes.ts:1890:9
                      (i32.const 208)
                     )
                     (block
                      (block $tablify|0
                       (br_table $case1|0 $case2|0 $tablify|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $tablify|0 $case10|0 $tablify|0 $case11|0 $case12|0 $tablify|0
                        (i32.sub
                         (get_local $1)
                         (i32.const 209)
                        )
                       )
                      )
                      (br $break|0)
                     )
                    )
                    (br_if $folding-inner1
                     ;;@ core/cpu/opcodes.ts:1893:10
                     (call $core/cpu/flags/getCarryFlag)
                    )
                    (br $folding-inner2)
                   )
                   ;;@ core/cpu/opcodes.ts:1905:6
                   (set_local $1
                    ;;@ core/cpu/opcodes.ts:1905:29
                    (i32.and
                     (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                      ;;@ core/cpu/opcodes.ts:1905:54
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                     )
                     (i32.const 65535)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1906:6
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:1906:25
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:1906:37
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:1906:56
                      (i32.const 2)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1907:6
                   (set_global $core/cpu/cpu/Cpu.registerD
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:1907:22
                     (call $core/helpers/index/splitHighByte
                      (get_local $1)
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1908:6
                   (set_global $core/cpu/cpu/Cpu.registerE
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:1908:22
                     (call $core/helpers/index/splitLowByte
                      (get_local $1)
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1909:13
                   (return
                    (i32.const 4)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:1913:6
                  (if
                   ;;@ core/cpu/opcodes.ts:1913:10
                   (call $core/cpu/flags/getCarryFlag)
                   (br $folding-inner3)
                   (br $folding-inner0)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:1925:6
                 (if
                  ;;@ core/cpu/opcodes.ts:1925:10
                  (call $core/cpu/flags/getCarryFlag)
                  (br $folding-inner3)
                  ;;@ core/cpu/opcodes.ts:1925:32
                  (block
                   ;;@ core/cpu/opcodes.ts:1926:8
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:1926:27
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:1926:39
                     (i32.sub
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:1926:58
                      (i32.const 2)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1928:8
                   (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                    ;;@ core/cpu/opcodes.ts:1928:34
                    (get_global $core/cpu/cpu/Cpu.stackPointer)
                    ;;@ core/cpu/opcodes.ts:1928:52
                    (i32.and
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.programCounter)
                      ;;@ core/cpu/opcodes.ts:1928:73
                      (i32.const 2)
                     )
                     (i32.const 65535)
                    )
                   )
                   (br $folding-inner0)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:1939:6
                (set_global $core/cpu/cpu/Cpu.stackPointer
                 ;;@ core/cpu/opcodes.ts:1939:25
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:1939:37
                  (i32.sub
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                   ;;@ core/cpu/opcodes.ts:1939:56
                   (i32.const 2)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:1941:6
                (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                 ;;@ core/cpu/opcodes.ts:1941:32
                 (get_global $core/cpu/cpu/Cpu.stackPointer)
                 ;;@ core/cpu/opcodes.ts:1941:50
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:1941:67
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:1941:82
                  (get_global $core/cpu/cpu/Cpu.registerE)
                 )
                )
                (br $folding-inner1)
               )
               ;;@ core/cpu/opcodes.ts:1948:6
               (call $core/cpu/instructions/subARegister
                ;;@ core/cpu/opcodes.ts:1948:19
                (call $core/cpu/opcodes/getDataByteOne)
               )
               (br $folding-inner4)
              )
              ;;@ core/cpu/opcodes.ts:1954:6
              (set_global $core/cpu/cpu/Cpu.stackPointer
               ;;@ core/cpu/opcodes.ts:1954:25
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:1954:37
                (i32.sub
                 (get_global $core/cpu/cpu/Cpu.stackPointer)
                 ;;@ core/cpu/opcodes.ts:1954:56
                 (i32.const 2)
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:1956:6
              (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:1956:32
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:1956:50
               (get_global $core/cpu/cpu/Cpu.programCounter)
              )
              ;;@ core/cpu/opcodes.ts:1957:6
              (set_global $core/cpu/cpu/Cpu.programCounter
               ;;@ core/cpu/opcodes.ts:1957:27
               (i32.const 16)
              )
              (br $folding-inner1)
             )
             (br_if $folding-inner1
              ;;@ core/cpu/opcodes.ts:1962:10
              (i32.ne
               (call $core/cpu/flags/getCarryFlag)
               ;;@ core/cpu/opcodes.ts:1962:29
               (i32.const 1)
              )
             )
             (br $folding-inner2)
            )
            ;;@ core/cpu/opcodes.ts:1974:6
            (set_global $core/cpu/cpu/Cpu.programCounter
             (i32.and
              ;;@ core/cpu/opcodes.ts:1974:27
              (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1974:57
               (get_global $core/cpu/cpu/Cpu.stackPointer)
              )
              (i32.const 65535)
             )
            )
            ;;@ core/cpu/opcodes.ts:1976:6
            (call $core/interrupts/interrupts/setInterrupts
             ;;@ core/cpu/opcodes.ts:1976:20
             (i32.const 1)
            )
            ;;@ core/cpu/opcodes.ts:1977:6
            (set_global $core/cpu/cpu/Cpu.stackPointer
             ;;@ core/cpu/opcodes.ts:1977:25
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:1977:37
              (i32.add
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:1977:56
               (i32.const 2)
              )
             )
            )
            (br $folding-inner1)
           )
           ;;@ core/cpu/opcodes.ts:1982:6
           (if
            ;;@ core/cpu/opcodes.ts:1982:10
            (i32.eq
             (call $core/cpu/flags/getCarryFlag)
             ;;@ core/cpu/opcodes.ts:1982:29
             (i32.const 1)
            )
            (br $folding-inner0)
            (br $folding-inner3)
           )
          )
          ;;@ core/cpu/opcodes.ts:1994:6
          (if
           ;;@ core/cpu/opcodes.ts:1994:10
           (i32.eq
            (call $core/cpu/flags/getCarryFlag)
            ;;@ core/cpu/opcodes.ts:1994:29
            (i32.const 1)
           )
           ;;@ core/cpu/opcodes.ts:1994:32
           (block
            ;;@ core/cpu/opcodes.ts:1995:8
            (set_global $core/cpu/cpu/Cpu.stackPointer
             ;;@ core/cpu/opcodes.ts:1995:27
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:1995:39
              (i32.sub
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:1995:58
               (i32.const 2)
              )
             )
            )
            ;;@ core/cpu/opcodes.ts:1997:8
            (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
             ;;@ core/cpu/opcodes.ts:1997:34
             (get_global $core/cpu/cpu/Cpu.stackPointer)
             ;;@ core/cpu/opcodes.ts:1997:52
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:1997:64
              (i32.add
               (get_global $core/cpu/cpu/Cpu.programCounter)
               ;;@ core/cpu/opcodes.ts:1997:85
               (i32.const 2)
              )
             )
            )
            (br $folding-inner0)
           )
           (br $folding-inner3)
          )
         )
         ;;@ core/cpu/opcodes.ts:2011:6
         (call $core/cpu/instructions/subAThroughCarryRegister
          ;;@ core/cpu/opcodes.ts:2011:31
          (call $core/cpu/opcodes/getDataByteOne)
         )
         (br $folding-inner4)
        )
        ;;@ core/cpu/opcodes.ts:2017:6
        (set_global $core/cpu/cpu/Cpu.stackPointer
         ;;@ core/cpu/opcodes.ts:2017:25
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2017:37
          (i32.sub
           (get_global $core/cpu/cpu/Cpu.stackPointer)
           ;;@ core/cpu/opcodes.ts:2017:56
           (i32.const 2)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:2019:6
        (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
         ;;@ core/cpu/opcodes.ts:2019:32
         (get_global $core/cpu/cpu/Cpu.stackPointer)
         ;;@ core/cpu/opcodes.ts:2019:50
         (get_global $core/cpu/cpu/Cpu.programCounter)
        )
        ;;@ core/cpu/opcodes.ts:2020:6
        (set_global $core/cpu/cpu/Cpu.programCounter
         ;;@ core/cpu/opcodes.ts:2020:27
         (i32.const 24)
        )
        (br $folding-inner1)
       )
       (return
        (i32.const -1)
       )
      )
      ;;@ core/cpu/opcodes.ts:1915:8
      (set_global $core/cpu/cpu/Cpu.programCounter
       (i32.and
        ;;@ core/cpu/opcodes.ts:1915:29
        (call $core/cpu/opcodes/getConcatenatedDataByte)
        (i32.const 65535)
       )
      )
     )
     (return
      (i32.const 8)
     )
    )
    ;;@ core/cpu/opcodes.ts:1895:8
    (set_global $core/cpu/cpu/Cpu.programCounter
     (i32.and
      ;;@ core/cpu/opcodes.ts:1895:29
      (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1895:59
       (get_global $core/cpu/cpu/Cpu.stackPointer)
      )
      (i32.const 65535)
     )
    )
    ;;@ core/cpu/opcodes.ts:1896:8
    (set_global $core/cpu/cpu/Cpu.stackPointer
     ;;@ core/cpu/opcodes.ts:1896:27
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:1896:39
      (i32.add
       (get_global $core/cpu/cpu/Cpu.stackPointer)
       ;;@ core/cpu/opcodes.ts:1896:58
       (i32.const 2)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:1897:15
    (return
     (i32.const 12)
    )
   )
   ;;@ core/cpu/opcodes.ts:1918:8
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:1918:29
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:1918:41
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:1918:62
      (i32.const 2)
     )
    )
   )
   ;;@ core/cpu/opcodes.ts:1919:15
   (return
    (i32.const 12)
   )
  )
  ;;@ core/cpu/opcodes.ts:1949:6
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/opcodes.ts:1949:27
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:1949:39
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:1949:60
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:1950:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcodeEx (; 222 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (block $folding-inner0
   (block $break|0
    (block $case10|0
     (block $case9|0
      (block $case8|0
       (block $case7|0
        (block $case6|0
         (block $case5|0
          (block $case4|0
           (block $case3|0
            (block $case2|0
             (block $case1|0
              (if
               (i32.ne
                (get_local $0)
                ;;@ core/cpu/opcodes.ts:2028:9
                (i32.const 224)
               )
               (block
                (block $tablify|0
                 (br_table $case1|0 $case2|0 $tablify|0 $tablify|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $tablify|0 $tablify|0 $tablify|0 $case9|0 $case10|0 $tablify|0
                  (i32.sub
                   (get_local $0)
                   (i32.const 225)
                  )
                 )
                )
                (br $break|0)
               )
              )
              ;;@ core/cpu/opcodes.ts:2036:6
              (call $core/cpu/opcodes/eightBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:2036:30
               (i32.add
                ;;@ core/cpu/opcodes.ts:2034:34
                (i32.and
                 (call $core/cpu/opcodes/getDataByteOne)
                 (i32.const 255)
                )
                ;;@ core/cpu/opcodes.ts:2036:30
                (i32.const 65280)
               )
               ;;@ core/cpu/opcodes.ts:2036:57
               (get_global $core/cpu/cpu/Cpu.registerA)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:2043:6
             (set_local $0
              ;;@ core/cpu/opcodes.ts:2043:29
              (i32.and
               (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:2043:54
                (get_global $core/cpu/cpu/Cpu.stackPointer)
               )
               (i32.const 65535)
              )
             )
             ;;@ core/cpu/opcodes.ts:2044:6
             (set_global $core/cpu/cpu/Cpu.stackPointer
              ;;@ core/cpu/opcodes.ts:2044:25
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:2044:37
               (i32.add
                (get_global $core/cpu/cpu/Cpu.stackPointer)
                ;;@ core/cpu/opcodes.ts:2044:56
                (i32.const 2)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:2045:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:2045:22
               (call $core/helpers/index/splitHighByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:2046:6
             (set_global $core/cpu/cpu/Cpu.registerL
              (i32.and
               ;;@ core/cpu/opcodes.ts:2046:22
               (call $core/helpers/index/splitLowByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:2047:13
             (return
              (i32.const 4)
             )
            )
            ;;@ core/cpu/opcodes.ts:2057:6
            (call $core/cpu/opcodes/eightBitStoreSyncCycles
             ;;@ core/cpu/opcodes.ts:2057:30
             (i32.add
              ;;@ core/cpu/opcodes.ts:2057:39
              (get_global $core/cpu/cpu/Cpu.registerC)
              ;;@ core/cpu/opcodes.ts:2057:30
              (i32.const 65280)
             )
             ;;@ core/cpu/opcodes.ts:2057:59
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            ;;@ core/cpu/opcodes.ts:2058:13
            (return
             (i32.const 4)
            )
           )
           ;;@ core/cpu/opcodes.ts:2063:6
           (set_global $core/cpu/cpu/Cpu.stackPointer
            ;;@ core/cpu/opcodes.ts:2063:25
            (call $core/portable/portable/u16Portable
             ;;@ core/cpu/opcodes.ts:2063:37
             (i32.sub
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:2063:56
              (i32.const 2)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:2065:6
           (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
            ;;@ core/cpu/opcodes.ts:2065:32
            (get_global $core/cpu/cpu/Cpu.stackPointer)
            ;;@ core/cpu/opcodes.ts:2065:50
            (call $core/helpers/index/concatenateBytes
             ;;@ core/cpu/opcodes.ts:2065:67
             (get_global $core/cpu/cpu/Cpu.registerH)
             ;;@ core/cpu/opcodes.ts:2065:82
             (get_global $core/cpu/cpu/Cpu.registerL)
            )
           )
           ;;@ core/cpu/opcodes.ts:2066:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:2072:6
          (call $core/cpu/instructions/andARegister
           ;;@ core/cpu/opcodes.ts:2072:19
           (call $core/cpu/opcodes/getDataByteOne)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:2078:6
         (set_global $core/cpu/cpu/Cpu.stackPointer
          ;;@ core/cpu/opcodes.ts:2078:25
          (call $core/portable/portable/u16Portable
           ;;@ core/cpu/opcodes.ts:2078:37
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.stackPointer)
            ;;@ core/cpu/opcodes.ts:2078:56
            (i32.const 2)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:2080:6
         (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
          ;;@ core/cpu/opcodes.ts:2080:32
          (get_global $core/cpu/cpu/Cpu.stackPointer)
          ;;@ core/cpu/opcodes.ts:2080:50
          (get_global $core/cpu/cpu/Cpu.programCounter)
         )
         ;;@ core/cpu/opcodes.ts:2081:6
         (set_global $core/cpu/cpu/Cpu.programCounter
          ;;@ core/cpu/opcodes.ts:2081:27
          (i32.const 32)
         )
         ;;@ core/cpu/opcodes.ts:2082:13
         (return
          (i32.const 8)
         )
        )
        ;;@ core/cpu/opcodes.ts:2089:6
        (set_local $0
         ;;@ core/cpu/opcodes.ts:2089:34
         (call $core/portable/portable/i8Portable
          ;;@ core/cpu/opcodes.ts:2089:45
          (call $core/cpu/opcodes/getDataByteOne)
         )
        )
        ;;@ core/cpu/opcodes.ts:2091:6
        (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
         ;;@ core/cpu/opcodes.ts:2091:44
         (get_global $core/cpu/cpu/Cpu.stackPointer)
         (tee_local $0
          ;;@ core/cpu/opcodes.ts:2091:62
          (i32.shr_s
           (i32.shl
            (get_local $0)
            (i32.const 24)
           )
           (i32.const 24)
          )
         )
         ;;@ core/cpu/opcodes.ts:2091:81
         (i32.const 1)
        )
        ;;@ core/cpu/opcodes.ts:2092:6
        (set_global $core/cpu/cpu/Cpu.stackPointer
         ;;@ core/cpu/opcodes.ts:2092:25
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2092:37
          (i32.add
           (get_global $core/cpu/cpu/Cpu.stackPointer)
           (get_local $0)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:2093:6
        (call $core/cpu/flags/setZeroFlag
         ;;@ core/cpu/opcodes.ts:2093:18
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:2094:6
        (call $core/cpu/flags/setSubtractFlag
         ;;@ core/cpu/opcodes.ts:2094:22
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:2095:6
        (set_global $core/cpu/cpu/Cpu.programCounter
         ;;@ core/cpu/opcodes.ts:2095:27
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2095:39
          (i32.add
           (get_global $core/cpu/cpu/Cpu.programCounter)
           ;;@ core/cpu/opcodes.ts:2095:60
           (i32.const 1)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:2096:13
        (return
         (i32.const 12)
        )
       )
       ;;@ core/cpu/opcodes.ts:2100:6
       (set_global $core/cpu/cpu/Cpu.programCounter
        (i32.and
         ;;@ core/cpu/opcodes.ts:2100:27
         (call $core/helpers/index/concatenateBytes
          ;;@ core/cpu/opcodes.ts:2100:49
          (get_global $core/cpu/cpu/Cpu.registerH)
          ;;@ core/cpu/opcodes.ts:2100:64
          (get_global $core/cpu/cpu/Cpu.registerL)
         )
         (i32.const 65535)
        )
       )
       ;;@ core/cpu/opcodes.ts:2101:13
       (return
        (i32.const 4)
       )
      )
      ;;@ core/cpu/opcodes.ts:2106:6
      (call $core/cpu/opcodes/eightBitStoreSyncCycles
       ;;@ core/cpu/opcodes.ts:2106:30
       (i32.and
        (call $core/cpu/opcodes/getConcatenatedDataByte)
        (i32.const 65535)
       )
       ;;@ core/cpu/opcodes.ts:2106:57
       (get_global $core/cpu/cpu/Cpu.registerA)
      )
      ;;@ core/cpu/opcodes.ts:2107:6
      (set_global $core/cpu/cpu/Cpu.programCounter
       ;;@ core/cpu/opcodes.ts:2107:27
       (call $core/portable/portable/u16Portable
        ;;@ core/cpu/opcodes.ts:2107:39
        (i32.add
         (get_global $core/cpu/cpu/Cpu.programCounter)
         ;;@ core/cpu/opcodes.ts:2107:60
         (i32.const 2)
        )
       )
      )
      ;;@ core/cpu/opcodes.ts:2108:13
      (return
       (i32.const 4)
      )
     )
     ;;@ core/cpu/opcodes.ts:2115:6
     (call $core/cpu/instructions/xorARegister
      ;;@ core/cpu/opcodes.ts:2115:19
      (call $core/cpu/opcodes/getDataByteOne)
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:2121:6
    (set_global $core/cpu/cpu/Cpu.stackPointer
     ;;@ core/cpu/opcodes.ts:2121:25
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:2121:37
      (i32.sub
       (get_global $core/cpu/cpu/Cpu.stackPointer)
       ;;@ core/cpu/opcodes.ts:2121:56
       (i32.const 2)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:2123:6
    (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
     ;;@ core/cpu/opcodes.ts:2123:32
     (get_global $core/cpu/cpu/Cpu.stackPointer)
     ;;@ core/cpu/opcodes.ts:2123:50
     (get_global $core/cpu/cpu/Cpu.programCounter)
    )
    ;;@ core/cpu/opcodes.ts:2124:6
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/cpu/opcodes.ts:2124:27
     (i32.const 40)
    )
    ;;@ core/cpu/opcodes.ts:2125:13
    (return
     (i32.const 8)
    )
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:2037:6
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/opcodes.ts:2037:27
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:2037:39
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:2037:60
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:2038:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcodeFx (; 223 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (block $folding-inner1
   (block $folding-inner0
    (block $break|0
     (block $case12|0
      (block $case11|0
       (block $case10|0
        (block $case9|0
         (block $case8|0
          (block $case7|0
           (block $case6|0
            (block $case5|0
             (block $case4|0
              (block $case3|0
               (block $case2|0
                (block $case1|0
                 (if
                  (i32.ne
                   (get_local $0)
                   ;;@ core/cpu/opcodes.ts:2132:9
                   (i32.const 240)
                  )
                  (block
                   (block $tablify|0
                    (br_table $case1|0 $case2|0 $case3|0 $tablify|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $tablify|0 $tablify|0 $case11|0 $case12|0 $tablify|0
                     (i32.sub
                      (get_local $0)
                      (i32.const 241)
                     )
                    )
                   )
                   (br $break|0)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:2138:6
                 (set_global $core/cpu/cpu/Cpu.registerA
                  ;;@ core/cpu/opcodes.ts:2138:22
                  (call $core/helpers/index/splitLowByte
                   ;;@ core/cpu/opcodes.ts:2138:33
                   (call $core/cpu/opcodes/eightBitLoadSyncCycles
                    ;;@ core/cpu/opcodes.ts:2138:60
                    (i32.add
                     ;;@ core/cpu/opcodes.ts:2136:34
                     (i32.and
                      (call $core/cpu/opcodes/getDataByteOne)
                      (i32.const 255)
                     )
                     ;;@ core/cpu/opcodes.ts:2138:60
                     (i32.const 65280)
                    )
                   )
                  )
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:2146:6
                (set_local $0
                 ;;@ core/cpu/opcodes.ts:2146:29
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:2146:34
                  (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                   ;;@ core/cpu/opcodes.ts:2146:59
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                  )
                  (i32.const 65535)
                 )
                )
                ;;@ core/cpu/opcodes.ts:2147:6
                (set_global $core/cpu/cpu/Cpu.stackPointer
                 ;;@ core/cpu/opcodes.ts:2147:25
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:2147:37
                  (i32.add
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                   ;;@ core/cpu/opcodes.ts:2147:56
                   (i32.const 2)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:2148:6
                (set_global $core/cpu/cpu/Cpu.registerA
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:2148:22
                  (call $core/helpers/index/splitHighByte
                   (get_local $0)
                  )
                  (i32.const 255)
                 )
                )
                ;;@ core/cpu/opcodes.ts:2149:6
                (set_global $core/cpu/cpu/Cpu.registerF
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:2149:22
                  (call $core/helpers/index/splitLowByte
                   (get_local $0)
                  )
                  (i32.const 255)
                 )
                )
                (br $folding-inner1)
               )
               ;;@ core/cpu/opcodes.ts:2155:6
               (set_global $core/cpu/cpu/Cpu.registerA
                ;;@ core/cpu/opcodes.ts:2155:22
                (call $core/helpers/index/splitLowByte
                 ;;@ core/cpu/opcodes.ts:2155:33
                 (call $core/cpu/opcodes/eightBitLoadSyncCycles
                  ;;@ core/cpu/opcodes.ts:2155:60
                  (i32.add
                   ;;@ core/cpu/opcodes.ts:2155:69
                   (get_global $core/cpu/cpu/Cpu.registerC)
                   ;;@ core/cpu/opcodes.ts:2155:60
                   (i32.const 65280)
                  )
                 )
                )
               )
               (br $folding-inner1)
              )
              ;;@ core/cpu/opcodes.ts:2160:6
              (call $core/interrupts/interrupts/setInterrupts
               ;;@ core/cpu/opcodes.ts:2160:20
               (i32.const 0)
              )
              (br $folding-inner1)
             )
             ;;@ core/cpu/opcodes.ts:2166:6
             (set_global $core/cpu/cpu/Cpu.stackPointer
              ;;@ core/cpu/opcodes.ts:2166:25
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:2166:37
               (i32.sub
                (get_global $core/cpu/cpu/Cpu.stackPointer)
                ;;@ core/cpu/opcodes.ts:2166:56
                (i32.const 2)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:2168:6
             (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
              ;;@ core/cpu/opcodes.ts:2168:32
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:2168:50
              (call $core/helpers/index/concatenateBytes
               ;;@ core/cpu/opcodes.ts:2168:67
               (get_global $core/cpu/cpu/Cpu.registerA)
               ;;@ core/cpu/opcodes.ts:2168:82
               (get_global $core/cpu/cpu/Cpu.registerF)
              )
             )
             ;;@ core/cpu/opcodes.ts:2169:13
             (return
              (i32.const 8)
             )
            )
            ;;@ core/cpu/opcodes.ts:2175:6
            (call $core/cpu/instructions/orARegister
             ;;@ core/cpu/opcodes.ts:2175:18
             (call $core/cpu/opcodes/getDataByteOne)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:2181:6
           (set_global $core/cpu/cpu/Cpu.stackPointer
            ;;@ core/cpu/opcodes.ts:2181:25
            (call $core/portable/portable/u16Portable
             ;;@ core/cpu/opcodes.ts:2181:37
             (i32.sub
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:2181:56
              (i32.const 2)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:2183:6
           (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
            ;;@ core/cpu/opcodes.ts:2183:32
            (get_global $core/cpu/cpu/Cpu.stackPointer)
            ;;@ core/cpu/opcodes.ts:2183:50
            (get_global $core/cpu/cpu/Cpu.programCounter)
           )
           ;;@ core/cpu/opcodes.ts:2184:6
           (set_global $core/cpu/cpu/Cpu.programCounter
            ;;@ core/cpu/opcodes.ts:2184:27
            (i32.const 48)
           )
           ;;@ core/cpu/opcodes.ts:2185:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:2192:6
          (set_local $0
           ;;@ core/cpu/opcodes.ts:2192:34
           (call $core/portable/portable/i8Portable
            ;;@ core/cpu/opcodes.ts:2192:45
            (call $core/cpu/opcodes/getDataByteOne)
           )
          )
          ;;@ core/cpu/opcodes.ts:2195:6
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:2195:18
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:2196:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:2196:22
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:2197:6
          (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
           ;;@ core/cpu/opcodes.ts:2197:44
           (get_global $core/cpu/cpu/Cpu.stackPointer)
           (tee_local $0
            ;;@ core/cpu/opcodes.ts:2197:62
            (i32.shr_s
             (i32.shl
              (get_local $0)
              (i32.const 24)
             )
             (i32.const 24)
            )
           )
           ;;@ core/cpu/opcodes.ts:2197:81
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:2199:6
          (set_global $core/cpu/cpu/Cpu.registerH
           (i32.and
            ;;@ core/cpu/opcodes.ts:2199:22
            (call $core/helpers/index/splitHighByte
             ;;@ core/cpu/opcodes.ts:2198:6
             (tee_local $0
              ;;@ core/cpu/opcodes.ts:2198:23
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:2198:35
               (i32.add
                (get_global $core/cpu/cpu/Cpu.stackPointer)
                (get_local $0)
               )
              )
             )
            )
            (i32.const 255)
           )
          )
          ;;@ core/cpu/opcodes.ts:2200:6
          (set_global $core/cpu/cpu/Cpu.registerL
           (i32.and
            ;;@ core/cpu/opcodes.ts:2200:22
            (call $core/helpers/index/splitLowByte
             (get_local $0)
            )
            (i32.const 255)
           )
          )
          ;;@ core/cpu/opcodes.ts:2201:6
          (set_global $core/cpu/cpu/Cpu.programCounter
           ;;@ core/cpu/opcodes.ts:2201:27
           (call $core/portable/portable/u16Portable
            ;;@ core/cpu/opcodes.ts:2201:39
            (i32.add
             (get_global $core/cpu/cpu/Cpu.programCounter)
             ;;@ core/cpu/opcodes.ts:2201:60
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:2202:13
          (return
           (i32.const 8)
          )
         )
         ;;@ core/cpu/opcodes.ts:2206:6
         (set_global $core/cpu/cpu/Cpu.stackPointer
          (i32.and
           ;;@ core/cpu/opcodes.ts:2206:25
           (call $core/helpers/index/concatenateBytes
            ;;@ core/cpu/opcodes.ts:2206:47
            (get_global $core/cpu/cpu/Cpu.registerH)
            ;;@ core/cpu/opcodes.ts:2206:62
            (get_global $core/cpu/cpu/Cpu.registerL)
           )
           (i32.const 65535)
          )
         )
         ;;@ core/cpu/opcodes.ts:2207:13
         (return
          (i32.const 8)
         )
        )
        ;;@ core/cpu/opcodes.ts:2212:6
        (set_global $core/cpu/cpu/Cpu.registerA
         (i32.and
          ;;@ core/cpu/opcodes.ts:2212:22
          (call $core/cpu/opcodes/eightBitLoadSyncCycles
           ;;@ core/cpu/opcodes.ts:2212:49
           (i32.and
            (call $core/cpu/opcodes/getConcatenatedDataByte)
            (i32.const 65535)
           )
          )
          (i32.const 255)
         )
        )
        ;;@ core/cpu/opcodes.ts:2213:6
        (set_global $core/cpu/cpu/Cpu.programCounter
         ;;@ core/cpu/opcodes.ts:2213:27
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2213:39
          (i32.add
           (get_global $core/cpu/cpu/Cpu.programCounter)
           ;;@ core/cpu/opcodes.ts:2213:60
           (i32.const 2)
          )
         )
        )
        (br $folding-inner1)
       )
       ;;@ core/cpu/opcodes.ts:2218:6
       (call $core/interrupts/interrupts/setInterrupts
        ;;@ core/cpu/opcodes.ts:2218:20
        (i32.const 1)
       )
       (br $folding-inner1)
      )
      ;;@ core/cpu/opcodes.ts:2226:6
      (call $core/cpu/instructions/cpARegister
       ;;@ core/cpu/opcodes.ts:2226:18
       (call $core/cpu/opcodes/getDataByteOne)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:2232:6
     (set_global $core/cpu/cpu/Cpu.stackPointer
      ;;@ core/cpu/opcodes.ts:2232:25
      (call $core/portable/portable/u16Portable
       ;;@ core/cpu/opcodes.ts:2232:37
       (i32.sub
        (get_global $core/cpu/cpu/Cpu.stackPointer)
        ;;@ core/cpu/opcodes.ts:2232:56
        (i32.const 2)
       )
      )
     )
     ;;@ core/cpu/opcodes.ts:2234:6
     (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
      ;;@ core/cpu/opcodes.ts:2234:32
      (get_global $core/cpu/cpu/Cpu.stackPointer)
      ;;@ core/cpu/opcodes.ts:2234:50
      (get_global $core/cpu/cpu/Cpu.programCounter)
     )
     ;;@ core/cpu/opcodes.ts:2235:6
     (set_global $core/cpu/cpu/Cpu.programCounter
      ;;@ core/cpu/opcodes.ts:2235:27
      (i32.const 56)
     )
     ;;@ core/cpu/opcodes.ts:2236:13
     (return
      (i32.const 8)
     )
    )
    (return
     (i32.const -1)
    )
   )
   ;;@ core/cpu/opcodes.ts:2139:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:2139:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:2139:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:2139:60
      (i32.const 1)
     )
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:2150:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/executeOpcode (; 224 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/cpu/opcodes.ts:71:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/opcodes.ts:71:23
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:71:35
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:71:56
     (i32.const 1)
    )
   )
  )
  (block $case15|0
   (block $case14|0
    (block $case13|0
     (block $case12|0
      (block $case11|0
       (block $case10|0
        (block $case9|0
         (block $case8|0
          (block $case7|0
           (block $case6|0
            (block $case5|0
             (block $case4|0
              (block $case3|0
               (block $case2|0
                (block $case1|0
                 (if
                  ;;@ core/cpu/opcodes.ts:76:2
                  (tee_local $1
                   ;;@ core/cpu/opcodes.ts:76:21
                   (i32.shr_s
                    ;;@ core/cpu/opcodes.ts:75:30
                    (i32.and
                     (get_local $0)
                     ;;@ core/cpu/opcodes.ts:75:39
                     (i32.const 240)
                    )
                    ;;@ core/cpu/opcodes.ts:76:41
                    (i32.const 4)
                   )
                  )
                  (block
                   (br_if $case1|0
                    (i32.eq
                     (get_local $1)
                     ;;@ core/cpu/opcodes.ts:88:9
                     (i32.const 1)
                    )
                   )
                   (block $tablify|0
                    (br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $tablify|0
                     (i32.sub
                      (get_local $1)
                      (i32.const 2)
                     )
                    )
                   )
                   (br $case15|0)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:87:34
                 (return
                  ;;@ core/cpu/opcodes.ts:87:13
                  (call $core/cpu/opcodes/handleOpcode0x
                   (get_local $0)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:89:34
                (return
                 ;;@ core/cpu/opcodes.ts:89:13
                 (call $core/cpu/opcodes/handleOpcode1x
                  (get_local $0)
                 )
                )
               )
               ;;@ core/cpu/opcodes.ts:91:34
               (return
                ;;@ core/cpu/opcodes.ts:91:13
                (call $core/cpu/opcodes/handleOpcode2x
                 (get_local $0)
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:93:34
              (return
               ;;@ core/cpu/opcodes.ts:93:13
               (call $core/cpu/opcodes/handleOpcode3x
                (get_local $0)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:95:34
             (return
              ;;@ core/cpu/opcodes.ts:95:13
              (call $core/cpu/opcodes/handleOpcode4x
               (get_local $0)
              )
             )
            )
            ;;@ core/cpu/opcodes.ts:97:34
            (return
             ;;@ core/cpu/opcodes.ts:97:13
             (call $core/cpu/opcodes/handleOpcode5x
              (get_local $0)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:99:34
           (return
            ;;@ core/cpu/opcodes.ts:99:13
            (call $core/cpu/opcodes/handleOpcode6x
             (get_local $0)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:101:34
          (return
           ;;@ core/cpu/opcodes.ts:101:13
           (call $core/cpu/opcodes/handleOpcode7x
            (get_local $0)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:103:34
         (return
          ;;@ core/cpu/opcodes.ts:103:13
          (call $core/cpu/opcodes/handleOpcode8x
           (get_local $0)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:105:34
        (return
         ;;@ core/cpu/opcodes.ts:105:13
         (call $core/cpu/opcodes/handleOpcode9x
          (get_local $0)
         )
        )
       )
       ;;@ core/cpu/opcodes.ts:107:34
       (return
        ;;@ core/cpu/opcodes.ts:107:13
        (call $core/cpu/opcodes/handleOpcodeAx
         (get_local $0)
        )
       )
      )
      ;;@ core/cpu/opcodes.ts:109:34
      (return
       ;;@ core/cpu/opcodes.ts:109:13
       (call $core/cpu/opcodes/handleOpcodeBx
        (get_local $0)
       )
      )
     )
     ;;@ core/cpu/opcodes.ts:111:34
     (return
      ;;@ core/cpu/opcodes.ts:111:13
      (call $core/cpu/opcodes/handleOpcodeCx
       (get_local $0)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:113:34
    (return
     ;;@ core/cpu/opcodes.ts:113:13
     (call $core/cpu/opcodes/handleOpcodeDx
      (get_local $0)
     )
    )
   )
   ;;@ core/cpu/opcodes.ts:115:34
   (return
    ;;@ core/cpu/opcodes.ts:115:13
    (call $core/cpu/opcodes/handleOpcodeEx
     (get_local $0)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:117:13
  (call $core/cpu/opcodes/handleOpcodeFx
   (get_local $0)
  )
 )
 (func $core/interrupts/interrupts/Interrupts.areInterruptsPending (; 225 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/interrupts/interrupts.ts:59:87
  (i32.gt_s
   ;;@ core/interrupts/interrupts.ts:59:11
   (i32.and
    ;;@ core/interrupts/interrupts.ts:59:12
    (get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue)
    ;;@ core/interrupts/interrupts.ts:59:50
    (get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue)
   )
   ;;@ core/interrupts/interrupts.ts:59:87
   (i32.const 0)
  )
 )
 (func $core/memory/store/sixteenBitStoreIntoGBMemory (; 226 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  ;;@ core/memory/store.ts:35:2
  (set_local $2
   ;;@ core/memory/store.ts:35:22
   (call $core/helpers/index/splitHighByte
    (get_local $1)
   )
  )
  ;;@ core/memory/store.ts:39:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (get_local $0)
   ;;@ core/memory/store.ts:36:21
   (call $core/helpers/index/splitLowByte
    (get_local $1)
   )
  )
  ;;@ core/memory/store.ts:40:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/memory/store.ts:37:24
   (i32.add
    (get_local $0)
    ;;@ core/memory/store.ts:37:33
    (i32.const 1)
   )
   (get_local $2)
  )
 )
 (func $core/interrupts/interrupts/_handleInterrupt (; 227 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/interrupts/interrupts.ts:122:2
  (call $core/interrupts/interrupts/setInterrupts
   ;;@ core/interrupts/interrupts.ts:122:16
   (i32.const 0)
  )
  ;;@ core/interrupts/interrupts.ts:127:2
  (set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   ;;@ core/interrupts/interrupts.ts:126:2
   (tee_local $1
    ;;@ core/interrupts/interrupts.ts:126:21
    (call $core/helpers/index/resetBitOnByte
     (get_local $0)
     ;;@ core/interrupts/interrupts.ts:125:25
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.const 65295)
     )
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:128:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65295)
   (get_local $1)
  )
  ;;@ core/interrupts/interrupts.ts:131:2
  (set_global $core/cpu/cpu/Cpu.stackPointer
   (i32.and
    ;;@ core/interrupts/interrupts.ts:131:21
    (i32.sub
     (get_global $core/cpu/cpu/Cpu.stackPointer)
     ;;@ core/interrupts/interrupts.ts:131:40
     (i32.const 2)
    )
    (i32.const 65535)
   )
  )
  ;;@ core/interrupts/interrupts.ts:132:2
  (call $core/memory/store/sixteenBitStoreIntoGBMemory
   ;;@ core/interrupts/interrupts.ts:132:30
   (get_global $core/cpu/cpu/Cpu.stackPointer)
   ;;@ core/interrupts/interrupts.ts:132:48
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
  ;;@ core/interrupts/interrupts.ts:137:2
  (block $break|0
   (block $case3|0
    (block $case2|0
     (block $case1|0
      (if
       (get_local $0)
       (block
        (block $tablify|0
         (br_table $case1|0 $case2|0 $tablify|0 $case3|0 $tablify|0
          (i32.sub
           (get_local $0)
           (i32.const 1)
          )
         )
        )
        (br $break|0)
       )
      )
      ;;@ core/interrupts/interrupts.ts:139:6
      (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
       ;;@ core/interrupts/interrupts.ts:139:46
       (i32.const 0)
      )
      ;;@ core/interrupts/interrupts.ts:140:6
      (set_global $core/cpu/cpu/Cpu.programCounter
       ;;@ core/interrupts/interrupts.ts:140:27
       (i32.const 64)
      )
      ;;@ core/interrupts/interrupts.ts:141:6
      (br $break|0)
     )
     ;;@ core/interrupts/interrupts.ts:143:6
     (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
      ;;@ core/interrupts/interrupts.ts:143:43
      (i32.const 0)
     )
     ;;@ core/interrupts/interrupts.ts:144:6
     (set_global $core/cpu/cpu/Cpu.programCounter
      ;;@ core/interrupts/interrupts.ts:144:27
      (i32.const 72)
     )
     ;;@ core/interrupts/interrupts.ts:145:6
     (br $break|0)
    )
    ;;@ core/interrupts/interrupts.ts:147:6
    (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
     ;;@ core/interrupts/interrupts.ts:147:45
     (i32.const 0)
    )
    ;;@ core/interrupts/interrupts.ts:148:6
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/interrupts/interrupts.ts:148:27
     (i32.const 80)
    )
    ;;@ core/interrupts/interrupts.ts:149:6
    (br $break|0)
   )
   ;;@ core/interrupts/interrupts.ts:151:6
   (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
    ;;@ core/interrupts/interrupts.ts:151:46
    (i32.const 0)
   )
   ;;@ core/interrupts/interrupts.ts:152:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/interrupts/interrupts.ts:152:27
    (i32.const 96)
   )
  )
 )
 (func $core/interrupts/interrupts/checkInterrupts (; 228 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/interrupts/interrupts.ts:82:6
  (if
   (tee_local $0
    (if (result i32)
     (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
     ;;@ core/interrupts/interrupts.ts:82:42
     (i32.gt_s
      (get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue)
      ;;@ core/interrupts/interrupts.ts:82:78
      (i32.const 0)
     )
     (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
    )
   )
   (set_local $0
    ;;@ core/interrupts/interrupts.ts:82:83
    (i32.gt_s
     (get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue)
     ;;@ core/interrupts/interrupts.ts:82:121
     (i32.const 0)
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:82:2
  (if
   (get_local $0)
   ;;@ core/interrupts/interrupts.ts:82:124
   (block
    ;;@ core/interrupts/interrupts.ts:86:4
    (set_local $0
     ;;@ core/interrupts/interrupts.ts:86:39
     (i32.const 0)
    )
    ;;@ core/interrupts/interrupts.ts:89:4
    (if
     ;;@ core/interrupts/interrupts.ts:89:8
     (if (result i32)
      (get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled)
      ;;@ core/interrupts/interrupts.ts:89:47
      (get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested)
      (get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled)
     )
     ;;@ core/interrupts/interrupts.ts:89:86
     (block
      ;;@ core/interrupts/interrupts.ts:90:6
      (call $core/interrupts/interrupts/_handleInterrupt
       (i32.const 0)
      )
      ;;@ core/interrupts/interrupts.ts:91:6
      (set_local $0
       ;;@ core/interrupts/interrupts.ts:91:28
       (i32.const 1)
      )
     )
     ;;@ core/interrupts/interrupts.ts:92:11
     (if
      ;;@ core/interrupts/interrupts.ts:92:15
      (if (result i32)
       (get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled)
       ;;@ core/interrupts/interrupts.ts:92:51
       (get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested)
       (get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled)
      )
      ;;@ core/interrupts/interrupts.ts:92:87
      (block
       ;;@ core/interrupts/interrupts.ts:93:6
       (call $core/interrupts/interrupts/_handleInterrupt
        (i32.const 1)
       )
       ;;@ core/interrupts/interrupts.ts:94:6
       (set_local $0
        ;;@ core/interrupts/interrupts.ts:94:28
        (i32.const 1)
       )
      )
      ;;@ core/interrupts/interrupts.ts:95:11
      (if
       ;;@ core/interrupts/interrupts.ts:95:15
       (if (result i32)
        (get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled)
        ;;@ core/interrupts/interrupts.ts:95:53
        (get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested)
        (get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled)
       )
       ;;@ core/interrupts/interrupts.ts:95:91
       (block
        ;;@ core/interrupts/interrupts.ts:96:6
        (call $core/interrupts/interrupts/_handleInterrupt
         (i32.const 2)
        )
        ;;@ core/interrupts/interrupts.ts:97:6
        (set_local $0
         ;;@ core/interrupts/interrupts.ts:97:28
         (i32.const 1)
        )
       )
       ;;@ core/interrupts/interrupts.ts:98:11
       (if
        ;;@ core/interrupts/interrupts.ts:98:15
        (if (result i32)
         (get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled)
         ;;@ core/interrupts/interrupts.ts:98:54
         (get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested)
         (get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled)
        )
        ;;@ core/interrupts/interrupts.ts:98:93
        (block
         ;;@ core/interrupts/interrupts.ts:99:6
         (call $core/interrupts/interrupts/_handleInterrupt
          (i32.const 4)
         )
         ;;@ core/interrupts/interrupts.ts:100:6
         (set_local $0
          ;;@ core/interrupts/interrupts.ts:100:28
          (i32.const 1)
         )
        )
       )
      )
     )
    )
    ;;@ core/interrupts/interrupts.ts:104:4
    (if
     (get_local $0)
     ;;@ core/interrupts/interrupts.ts:104:29
     (block
      ;;@ core/interrupts/interrupts.ts:105:6
      (set_local $0
       ;;@ core/interrupts/interrupts.ts:105:40
       (i32.const 20)
      )
      ;;@ core/interrupts/interrupts.ts:106:6
      (if
       ;;@ core/interrupts/interrupts.ts:106:10
       (get_global $core/cpu/cpu/Cpu.isHalted)
       ;;@ core/interrupts/interrupts.ts:106:24
       (block
        ;;@ core/interrupts/interrupts.ts:110:8
        (set_global $core/cpu/cpu/Cpu.isHalted
         ;;@ core/interrupts/interrupts.ts:110:23
         (i32.const 0)
        )
        ;;@ core/interrupts/interrupts.ts:111:8
        (set_local $0
         (i32.const 24)
        )
       )
      )
      ;;@ core/interrupts/interrupts.ts:113:13
      (return
       (get_local $0)
      )
     )
    )
   )
  )
  (i32.const 0)
 )
 (func $core/core/executeStep (; 229 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/core.ts:285:2
  (set_global $core/core/hasStarted
   ;;@ core/core.ts:285:15
   (i32.const 1)
  )
  ;;@ core/core.ts:289:2
  (set_local $0
   ;;@ core/core.ts:289:28
   (i32.const 4)
  )
  ;;@ core/core.ts:293:6
  (if
   (tee_local $1
    (i32.eqz
     ;;@ core/core.ts:293:7
     (get_global $core/cpu/cpu/Cpu.isHalted)
    )
   )
   (set_local $1
    ;;@ core/core.ts:293:23
    (i32.eqz
     ;;@ core/core.ts:293:24
     (get_global $core/cpu/cpu/Cpu.isStopped)
    )
   )
  )
  ;;@ core/core.ts:293:2
  (if
   (get_local $1)
   ;;@ core/core.ts:295:4
   (set_local $0
    ;;@ core/core.ts:295:21
    (call $core/cpu/opcodes/executeOpcode
     ;;@ core/core.ts:294:13
     (i32.and
      ;;@ core/core.ts:294:17
      (call $core/memory/load/eightBitLoadFromGBMemory
       ;;@ core/core.ts:294:42
       (get_global $core/cpu/cpu/Cpu.programCounter)
      )
      (i32.const 255)
     )
    )
   )
   (block
    ;;@ core/core.ts:298:8
    (if
     (tee_local $1
      (if (result i32)
       (get_global $core/cpu/cpu/Cpu.isHalted)
       ;;@ core/core.ts:298:24
       (i32.eqz
        ;;@ core/core.ts:298:25
        (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
       )
       (get_global $core/cpu/cpu/Cpu.isHalted)
      )
     )
     (set_local $1
      ;;@ core/core.ts:298:72
      (call $core/interrupts/interrupts/Interrupts.areInterruptsPending)
     )
    )
    ;;@ core/core.ts:296:9
    (if
     (get_local $1)
     ;;@ core/core.ts:298:96
     (block
      ;;@ core/core.ts:299:6
      (set_global $core/cpu/cpu/Cpu.isHalted
       ;;@ core/core.ts:299:21
       (i32.const 0)
      )
      ;;@ core/core.ts:300:6
      (set_global $core/cpu/cpu/Cpu.isStopped
       ;;@ core/core.ts:300:22
       (i32.const 0)
      )
      ;;@ core/core.ts:314:6
      (set_local $0
       ;;@ core/core.ts:314:23
       (call $core/cpu/opcodes/executeOpcode
        ;;@ core/core.ts:313:15
        (i32.and
         ;;@ core/core.ts:313:19
         (call $core/memory/load/eightBitLoadFromGBMemory
          ;;@ core/core.ts:313:44
          (get_global $core/cpu/cpu/Cpu.programCounter)
         )
         (i32.const 255)
        )
       )
      )
      ;;@ core/core.ts:315:6
      (set_global $core/cpu/cpu/Cpu.programCounter
       ;;@ core/core.ts:315:27
       (call $core/portable/portable/u16Portable
        ;;@ core/core.ts:315:39
        (i32.sub
         (get_global $core/cpu/cpu/Cpu.programCounter)
         ;;@ core/core.ts:315:60
         (i32.const 1)
        )
       )
      )
     )
    )
   )
  )
  ;;@ core/core.ts:320:2
  (set_global $core/cpu/cpu/Cpu.registerF
   ;;@ core/core.ts:320:18
   (i32.and
    (get_global $core/cpu/cpu/Cpu.registerF)
    ;;@ core/core.ts:320:34
    (i32.const 240)
   )
  )
  ;;@ core/core.ts:323:2
  (if
   ;;@ core/core.ts:323:6
   (i32.le_s
    (get_local $0)
    ;;@ core/core.ts:323:24
    (i32.const 0)
   )
   ;;@ core/core.ts:323:27
   (return
    (get_local $0)
   )
  )
  ;;@ core/core.ts:334:2
  (call $core/core/syncCycles
   ;;@ core/core.ts:331:2
   (tee_local $0
    (i32.add
     (get_local $0)
     ;;@ core/core.ts:331:20
     (call $core/interrupts/interrupts/checkInterrupts)
    )
   )
  )
  (get_local $0)
 )
 (func $core/core/executeFrame (; 230 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  (local $1 i32)
  (loop $continue|0
   ;;@ core/core.ts:179:9
   (if
    (tee_local $1
     (i32.eqz
      (get_local $0)
     )
    )
    (set_local $1
     ;;@ core/core.ts:179:19
     (i32.lt_s
      (get_global $core/cpu/cpu/Cpu.currentCycles)
      ;;@ core/core.ts:179:43
      (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
     )
    )
   )
   (if
    (get_local $1)
    (block
     ;;@ core/core.ts:181:4
     (if
      ;;@ core/core.ts:181:8
      (i32.lt_s
       ;;@ core/core.ts:180:21
       (call $core/core/executeStep)
       ;;@ core/core.ts:181:25
       (i32.const 0)
      )
      ;;@ core/core.ts:181:28
      (set_local $0
       ;;@ core/core.ts:182:14
       (i32.const 1)
      )
     )
     (br $continue|0)
    )
   )
  )
  ;;@ core/core.ts:187:2
  (if
   ;;@ core/core.ts:187:6
   (i32.ge_s
    (get_global $core/cpu/cpu/Cpu.currentCycles)
    ;;@ core/core.ts:187:31
    (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
   )
   ;;@ core/core.ts:187:55
   (block
    ;;@ core/core.ts:191:4
    (set_global $core/cpu/cpu/Cpu.currentCycles
     (i32.sub
      (get_global $core/cpu/cpu/Cpu.currentCycles)
      ;;@ core/core.ts:191:29
      (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
     )
    )
    ;;@ core/core.ts:193:11
    (return
     (i32.const 0)
    )
   )
  )
  ;;@ core/core.ts:198:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/core.ts:198:23
   (call $core/portable/portable/u16Portable
    ;;@ core/core.ts:198:35
    (i32.sub
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/core.ts:198:56
     (i32.const 1)
    )
   )
  )
  (i32.const -1)
 )
 (func $core/sound/sound/getNumberOfSamplesInAudioBuffer (; 231 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/sound/sound.ts:202:15
  (get_global $core/sound/sound/Sound.audioQueueIndex)
 )
 (func $core/core/executeFrameAndCheckAudio (; 232 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/core.ts:210:2
  (set_local $1
   ;;@ core/core.ts:210:29
   (i32.const 1024)
  )
  ;;@ core/core.ts:212:2
  (if
   ;;@ core/core.ts:212:6
   (if (result i32)
    (get_local $0)
    ;;@ core/core.ts:212:24
    (i32.gt_s
     (get_local $0)
     ;;@ core/core.ts:212:41
     (i32.const 0)
    )
    (get_local $0)
   )
   ;;@ core/core.ts:212:44
   (set_local $1
    (get_local $0)
   )
  )
  (loop $continue|0
   ;;@ core/core.ts:216:9
   (if
    (tee_local $0
     (i32.eqz
      (get_local $2)
     )
    )
    (set_local $0
     ;;@ core/core.ts:216:19
     (i32.lt_s
      (get_global $core/cpu/cpu/Cpu.currentCycles)
      ;;@ core/core.ts:216:43
      (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
     )
    )
   )
   ;;@ core/core.ts:216:9
   (if
    (get_local $0)
    (set_local $0
     ;;@ core/core.ts:216:69
     (i32.lt_s
      (call $core/sound/sound/getNumberOfSamplesInAudioBuffer)
      (get_local $1)
     )
    )
   )
   (if
    (get_local $0)
    (block
     ;;@ core/core.ts:218:4
     (if
      ;;@ core/core.ts:218:8
      (i32.lt_s
       ;;@ core/core.ts:217:21
       (call $core/core/executeStep)
       ;;@ core/core.ts:218:25
       (i32.const 0)
      )
      ;;@ core/core.ts:218:28
      (set_local $2
       ;;@ core/core.ts:219:14
       (i32.const 1)
      )
     )
     (br $continue|0)
    )
   )
  )
  ;;@ core/core.ts:224:2
  (if
   ;;@ core/core.ts:224:6
   (i32.ge_s
    (get_global $core/cpu/cpu/Cpu.currentCycles)
    ;;@ core/core.ts:224:31
    (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
   )
   ;;@ core/core.ts:224:55
   (block
    ;;@ core/core.ts:228:4
    (set_global $core/cpu/cpu/Cpu.currentCycles
     (i32.sub
      (get_global $core/cpu/cpu/Cpu.currentCycles)
      ;;@ core/core.ts:228:29
      (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
     )
    )
    ;;@ core/core.ts:230:11
    (return
     (i32.const 0)
    )
   )
  )
  ;;@ core/core.ts:232:2
  (if
   ;;@ core/core.ts:232:6
   (i32.ge_s
    (call $core/sound/sound/getNumberOfSamplesInAudioBuffer)
    (get_local $1)
   )
   (return
    (i32.const 1)
   )
  )
  ;;@ core/core.ts:240:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/core.ts:240:23
   (call $core/portable/portable/u16Portable
    ;;@ core/core.ts:240:35
    (i32.sub
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/core.ts:240:56
     (i32.const 1)
    )
   )
  )
  (i32.const -1)
 )
 (func $core/core/executeFrameUntilBreakpoint (; 233 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (loop $continue|0
   ;;@ core/core.ts:253:9
   (if
    (tee_local $1
     (i32.eqz
      (get_local $2)
     )
    )
    (set_local $1
     ;;@ core/core.ts:253:19
     (i32.lt_s
      (get_global $core/cpu/cpu/Cpu.currentCycles)
      ;;@ core/core.ts:253:43
      (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
     )
    )
   )
   ;;@ core/core.ts:253:9
   (if
    (get_local $1)
    (set_local $1
     ;;@ core/core.ts:253:69
     (i32.ne
      (get_global $core/cpu/cpu/Cpu.programCounter)
      (get_local $0)
     )
    )
   )
   (if
    (get_local $1)
    (block
     ;;@ core/core.ts:255:4
     (if
      ;;@ core/core.ts:255:8
      (i32.lt_s
       ;;@ core/core.ts:254:21
       (call $core/core/executeStep)
       ;;@ core/core.ts:255:25
       (i32.const 0)
      )
      ;;@ core/core.ts:255:28
      (set_local $2
       ;;@ core/core.ts:256:14
       (i32.const 1)
      )
     )
     (br $continue|0)
    )
   )
  )
  ;;@ core/core.ts:261:2
  (if
   ;;@ core/core.ts:261:6
   (i32.ge_s
    (get_global $core/cpu/cpu/Cpu.currentCycles)
    ;;@ core/core.ts:261:31
    (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
   )
   ;;@ core/core.ts:261:55
   (block
    ;;@ core/core.ts:265:4
    (set_global $core/cpu/cpu/Cpu.currentCycles
     (i32.sub
      (get_global $core/cpu/cpu/Cpu.currentCycles)
      ;;@ core/core.ts:265:29
      (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
     )
    )
    ;;@ core/core.ts:267:11
    (return
     (i32.const 0)
    )
   )
  )
  ;;@ core/core.ts:269:2
  (if
   ;;@ core/core.ts:269:6
   (i32.eq
    (get_global $core/cpu/cpu/Cpu.programCounter)
    (get_local $0)
   )
   (return
    (i32.const 1)
   )
  )
  ;;@ core/core.ts:277:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/core.ts:277:23
   (call $core/portable/portable/u16Portable
    ;;@ core/core.ts:277:35
    (i32.sub
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/core.ts:277:56
     (i32.const 1)
    )
   )
  )
  (i32.const -1)
 )
 (func $core/core/getSaveStateMemoryOffset (; 234 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/core.ts:382:48
  (i32.add
   ;;@ core/core.ts:382:9
   (i32.add
    (get_local $0)
    (i32.const 1024)
   )
   ;;@ core/core.ts:382:43
   (i32.mul
    (get_local $1)
    (i32.const 50)
   )
  )
 )
 (func $core/memory/store/storeBooleanDirectlyToWasmMemory (; 235 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/memory/store.ts:44:2
  (if
   (i32.and
    (get_local $1)
    (i32.const 1)
   )
   ;;@ core/memory/store.ts:44:13
   (i32.store8
    (get_local $0)
    ;;@ core/memory/store.ts:45:22
    (i32.const 1)
   )
   ;;@ core/memory/store.ts:46:9
   (i32.store8
    (get_local $0)
    ;;@ core/memory/store.ts:47:22
    (i32.const 0)
   )
  )
 )
 (func $core/cpu/cpu/Cpu.saveState (; 236 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cpu/cpu.ts:74:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:74:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:74:39
    (i32.const 0)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:74:65
   (get_global $core/cpu/cpu/Cpu.registerA)
  )
  ;;@ core/cpu/cpu.ts:75:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:75:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:75:39
    (i32.const 1)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:75:65
   (get_global $core/cpu/cpu/Cpu.registerB)
  )
  ;;@ core/cpu/cpu.ts:76:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:76:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:76:39
    (i32.const 2)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:76:65
   (get_global $core/cpu/cpu/Cpu.registerC)
  )
  ;;@ core/cpu/cpu.ts:77:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:77:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:77:39
    (i32.const 3)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:77:65
   (get_global $core/cpu/cpu/Cpu.registerD)
  )
  ;;@ core/cpu/cpu.ts:78:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:78:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:78:39
    (i32.const 4)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:78:65
   (get_global $core/cpu/cpu/Cpu.registerE)
  )
  ;;@ core/cpu/cpu.ts:79:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:79:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:79:39
    (i32.const 5)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:79:65
   (get_global $core/cpu/cpu/Cpu.registerH)
  )
  ;;@ core/cpu/cpu.ts:80:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:80:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:80:39
    (i32.const 6)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:80:65
   (get_global $core/cpu/cpu/Cpu.registerL)
  )
  ;;@ core/cpu/cpu.ts:81:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:81:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:81:39
    (i32.const 7)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:81:65
   (get_global $core/cpu/cpu/Cpu.registerF)
  )
  ;;@ core/cpu/cpu.ts:83:4
  (i32.store16
   ;;@ core/cpu/cpu.ts:83:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:83:40
    (i32.const 8)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:83:66
   (get_global $core/cpu/cpu/Cpu.stackPointer)
  )
  ;;@ core/cpu/cpu.ts:84:4
  (i32.store16
   ;;@ core/cpu/cpu.ts:84:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:84:40
    (i32.const 10)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:84:66
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
  ;;@ core/cpu/cpu.ts:86:4
  (i32.store
   ;;@ core/cpu/cpu.ts:86:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:86:40
    (i32.const 12)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:86:66
   (get_global $core/cpu/cpu/Cpu.currentCycles)
  )
  ;;@ core/cpu/cpu.ts:88:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/cpu/cpu.ts:88:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:88:62
    (i32.const 17)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:88:88
   (get_global $core/cpu/cpu/Cpu.isHalted)
  )
  ;;@ core/cpu/cpu.ts:89:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/cpu/cpu.ts:89:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:89:62
    (i32.const 18)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:89:88
   (get_global $core/cpu/cpu/Cpu.isStopped)
  )
 )
 (func $core/graphics/graphics/Graphics.saveState (; 237 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/graphics.ts:102:4
  (i32.store
   ;;@ core/graphics/graphics.ts:102:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/graphics/graphics.ts:102:40
    (i32.const 0)
    (i32.const 1)
   )
   ;;@ core/graphics/graphics.ts:102:71
   (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
  )
  ;;@ core/graphics/graphics.ts:103:4
  (i32.store8
   ;;@ core/graphics/graphics.ts:103:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/graphics/graphics.ts:103:39
    (i32.const 4)
    (i32.const 1)
   )
   ;;@ core/graphics/graphics.ts:103:70
   (get_global $core/graphics/lcd/Lcd.currentLcdMode)
  )
  ;;@ core/graphics/graphics.ts:105:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65348)
   ;;@ core/graphics/graphics.ts:105:71
   (get_global $core/graphics/graphics/Graphics.scanlineRegister)
  )
 )
 (func $core/interrupts/interrupts/Interrupts.saveState (; 238 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:67:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/interrupts/interrupts.ts:67:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/interrupts/interrupts.ts:67:62
    (i32.const 0)
    (i32.const 2)
   )
   ;;@ core/interrupts/interrupts.ts:67:95
   (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
  )
  ;;@ core/interrupts/interrupts.ts:68:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/interrupts/interrupts.ts:68:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/interrupts/interrupts.ts:68:62
    (i32.const 1)
    (i32.const 2)
   )
   ;;@ core/interrupts/interrupts.ts:68:95
   (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay)
  )
 )
 (func $core/joypad/joypad/Joypad.saveState (; 239 ;) (; has Stack IR ;) (type $v)
  (nop)
 )
 (func $core/memory/memory/Memory.saveState (; 240 ;) (; has Stack IR ;) (type $v)
  ;;@ core/memory/memory.ts:104:4
  (i32.store16
   ;;@ core/memory/memory.ts:104:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:104:40
    (i32.const 0)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:104:69
   (get_global $core/memory/memory/Memory.currentRomBank)
  )
  ;;@ core/memory/memory.ts:105:4
  (i32.store16
   ;;@ core/memory/memory.ts:105:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:105:40
    (i32.const 2)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:105:69
   (get_global $core/memory/memory/Memory.currentRamBank)
  )
  ;;@ core/memory/memory.ts:107:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/memory/memory.ts:107:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:107:62
    (i32.const 4)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:107:91
   (get_global $core/memory/memory/Memory.isRamBankingEnabled)
  )
  ;;@ core/memory/memory.ts:108:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/memory/memory.ts:108:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:108:62
    (i32.const 5)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:108:91
   (get_global $core/memory/memory/Memory.isMBC1RomModeEnabled)
  )
  ;;@ core/memory/memory.ts:110:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/memory/memory.ts:110:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:110:62
    (i32.const 6)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:110:91
   (get_global $core/memory/memory/Memory.isRomOnly)
  )
  ;;@ core/memory/memory.ts:111:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/memory/memory.ts:111:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:111:62
    (i32.const 7)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:111:91
   (get_global $core/memory/memory/Memory.isMBC1)
  )
  ;;@ core/memory/memory.ts:112:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/memory/memory.ts:112:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:112:62
    (i32.const 8)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:112:91
   (get_global $core/memory/memory/Memory.isMBC2)
  )
  ;;@ core/memory/memory.ts:113:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/memory/memory.ts:113:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:113:62
    (i32.const 9)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:113:91
   (get_global $core/memory/memory/Memory.isMBC3)
  )
  ;;@ core/memory/memory.ts:114:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/memory/memory.ts:114:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/memory/memory.ts:114:62
    (i32.const 10)
    (i32.const 4)
   )
   ;;@ core/memory/memory.ts:114:91
   (get_global $core/memory/memory/Memory.isMBC5)
  )
 )
 (func $core/timers/timers/Timers.saveState (; 241 ;) (; has Stack IR ;) (type $v)
  ;;@ core/timers/timers.ts:138:4
  (i32.store
   ;;@ core/timers/timers.ts:138:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/timers/timers.ts:138:40
    (i32.const 0)
    (i32.const 5)
   )
   ;;@ core/timers/timers.ts:138:69
   (get_global $core/timers/timers/Timers.currentCycles)
  )
  ;;@ core/timers/timers.ts:139:4
  (i32.store
   ;;@ core/timers/timers.ts:139:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/timers/timers.ts:139:40
    (i32.const 4)
    (i32.const 5)
   )
   ;;@ core/timers/timers.ts:139:69
   (get_global $core/timers/timers/Timers.dividerRegister)
  )
  ;;@ core/timers/timers.ts:140:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/timers/timers.ts:140:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/timers/timers.ts:140:62
    (i32.const 8)
    (i32.const 5)
   )
   ;;@ core/timers/timers.ts:140:91
   (get_global $core/timers/timers/Timers.timerCounterOverflowDelay)
  )
  ;;@ core/timers/timers.ts:141:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/timers/timers.ts:141:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/timers/timers.ts:141:62
    (i32.const 11)
    (i32.const 5)
   )
   ;;@ core/timers/timers.ts:141:91
   (get_global $core/timers/timers/Timers.timerCounterWasReset)
  )
  ;;@ core/timers/timers.ts:143:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65285)
   ;;@ core/timers/timers.ts:143:65
   (get_global $core/timers/timers/Timers.timerCounter)
  )
 )
 (func $core/sound/sound/Sound.saveState (; 242 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/sound.ts:126:4
  (i32.store
   ;;@ core/sound/sound.ts:126:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/sound.ts:126:40
    (i32.const 0)
    (i32.const 6)
   )
   ;;@ core/sound/sound.ts:126:68
   (get_global $core/sound/sound/Sound.frameSequenceCycleCounter)
  )
  ;;@ core/sound/sound.ts:127:4
  (i32.store8
   ;;@ core/sound/sound.ts:127:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/sound.ts:127:39
    (i32.const 4)
    (i32.const 6)
   )
   ;;@ core/sound/sound.ts:127:67
   (get_global $core/sound/sound/Sound.downSampleCycleCounter)
  )
  ;;@ core/sound/sound.ts:128:4
  (i32.store8
   ;;@ core/sound/sound.ts:128:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/sound.ts:128:39
    (i32.const 5)
    (i32.const 6)
   )
   ;;@ core/sound/sound.ts:128:67
   (get_global $core/sound/sound/Sound.frameSequencer)
  )
 )
 (func $core/sound/channel1/Channel1.saveState (; 243 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel1.ts:115:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/sound/channel1.ts:115:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:115:62
    (i32.const 0)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:115:93
   (get_global $core/sound/channel1/Channel1.isEnabled)
  )
  ;;@ core/sound/channel1.ts:116:4
  (i32.store
   ;;@ core/sound/channel1.ts:116:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:116:40
    (i32.const 1)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:116:71
   (get_global $core/sound/channel1/Channel1.frequencyTimer)
  )
  ;;@ core/sound/channel1.ts:117:4
  (i32.store
   ;;@ core/sound/channel1.ts:117:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:117:40
    (i32.const 5)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:117:71
   (get_global $core/sound/channel1/Channel1.envelopeCounter)
  )
  ;;@ core/sound/channel1.ts:118:4
  (i32.store
   ;;@ core/sound/channel1.ts:118:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:118:40
    (i32.const 9)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:118:71
   (get_global $core/sound/channel1/Channel1.lengthCounter)
  )
  ;;@ core/sound/channel1.ts:119:4
  (i32.store
   ;;@ core/sound/channel1.ts:119:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:119:40
    (i32.const 14)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:119:71
   (get_global $core/sound/channel1/Channel1.volume)
  )
  ;;@ core/sound/channel1.ts:121:4
  (i32.store8
   ;;@ core/sound/channel1.ts:121:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:121:39
    (i32.const 19)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:121:70
   (get_global $core/sound/channel1/Channel1.dutyCycle)
  )
  ;;@ core/sound/channel1.ts:122:4
  (i32.store8
   ;;@ core/sound/channel1.ts:122:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:122:39
    (i32.const 20)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:122:70
   (get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty)
  )
  ;;@ core/sound/channel1.ts:124:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/sound/channel1.ts:124:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:124:62
    (i32.const 25)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:124:93
   (get_global $core/sound/channel1/Channel1.isSweepEnabled)
  )
  ;;@ core/sound/channel1.ts:125:4
  (i32.store
   ;;@ core/sound/channel1.ts:125:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:125:40
    (i32.const 26)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:125:71
   (get_global $core/sound/channel1/Channel1.sweepCounter)
  )
  ;;@ core/sound/channel1.ts:126:4
  (i32.store16
   ;;@ core/sound/channel1.ts:126:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel1.ts:126:40
    (i32.const 31)
    (i32.const 7)
   )
   ;;@ core/sound/channel1.ts:126:71
   (get_global $core/sound/channel1/Channel1.sweepShadowFrequency)
  )
 )
 (func $core/sound/channel2/Channel2.saveState (; 244 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel2.ts:99:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/sound/channel2.ts:99:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel2.ts:99:62
    (i32.const 0)
    (i32.const 8)
   )
   ;;@ core/sound/channel2.ts:99:93
   (get_global $core/sound/channel2/Channel2.isEnabled)
  )
  ;;@ core/sound/channel2.ts:100:4
  (i32.store
   ;;@ core/sound/channel2.ts:100:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel2.ts:100:40
    (i32.const 1)
    (i32.const 8)
   )
   ;;@ core/sound/channel2.ts:100:71
   (get_global $core/sound/channel2/Channel2.frequencyTimer)
  )
  ;;@ core/sound/channel2.ts:101:4
  (i32.store
   ;;@ core/sound/channel2.ts:101:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel2.ts:101:40
    (i32.const 5)
    (i32.const 8)
   )
   ;;@ core/sound/channel2.ts:101:71
   (get_global $core/sound/channel2/Channel2.envelopeCounter)
  )
  ;;@ core/sound/channel2.ts:102:4
  (i32.store
   ;;@ core/sound/channel2.ts:102:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel2.ts:102:40
    (i32.const 9)
    (i32.const 8)
   )
   ;;@ core/sound/channel2.ts:102:71
   (get_global $core/sound/channel2/Channel2.lengthCounter)
  )
  ;;@ core/sound/channel2.ts:103:4
  (i32.store
   ;;@ core/sound/channel2.ts:103:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel2.ts:103:40
    (i32.const 14)
    (i32.const 8)
   )
   ;;@ core/sound/channel2.ts:103:71
   (get_global $core/sound/channel2/Channel2.volume)
  )
  ;;@ core/sound/channel2.ts:105:4
  (i32.store8
   ;;@ core/sound/channel2.ts:105:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel2.ts:105:39
    (i32.const 19)
    (i32.const 8)
   )
   ;;@ core/sound/channel2.ts:105:70
   (get_global $core/sound/channel2/Channel2.dutyCycle)
  )
  ;;@ core/sound/channel2.ts:106:4
  (i32.store8
   ;;@ core/sound/channel2.ts:106:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel2.ts:106:39
    (i32.const 20)
    (i32.const 8)
   )
   ;;@ core/sound/channel2.ts:106:70
   (get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty)
  )
 )
 (func $core/sound/channel3/Channel3.saveState (; 245 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:97:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/sound/channel3.ts:97:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:97:62
    (i32.const 0)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:97:93
   (get_global $core/sound/channel3/Channel3.isEnabled)
  )
  ;;@ core/sound/channel3.ts:98:4
  (i32.store
   ;;@ core/sound/channel3.ts:98:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:98:40
    (i32.const 1)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:98:71
   (get_global $core/sound/channel3/Channel3.frequencyTimer)
  )
  ;;@ core/sound/channel3.ts:99:4
  (i32.store
   ;;@ core/sound/channel3.ts:99:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:99:40
    (i32.const 5)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:99:71
   (get_global $core/sound/channel3/Channel3.lengthCounter)
  )
  ;;@ core/sound/channel3.ts:100:4
  (i32.store16
   ;;@ core/sound/channel3.ts:100:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:100:40
    (i32.const 9)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:100:71
   (get_global $core/sound/channel3/Channel3.waveTablePosition)
  )
 )
 (func $core/sound/channel4/Channel4.saveState (; 246 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel4.ts:120:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/sound/channel4.ts:120:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel4.ts:120:62
    (i32.const 0)
    (i32.const 10)
   )
   ;;@ core/sound/channel4.ts:120:93
   (get_global $core/sound/channel4/Channel4.isEnabled)
  )
  ;;@ core/sound/channel4.ts:121:4
  (i32.store
   ;;@ core/sound/channel4.ts:121:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel4.ts:121:40
    (i32.const 1)
    (i32.const 10)
   )
   ;;@ core/sound/channel4.ts:121:71
   (get_global $core/sound/channel4/Channel4.frequencyTimer)
  )
  ;;@ core/sound/channel4.ts:122:4
  (i32.store
   ;;@ core/sound/channel4.ts:122:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel4.ts:122:40
    (i32.const 5)
    (i32.const 10)
   )
   ;;@ core/sound/channel4.ts:122:71
   (get_global $core/sound/channel4/Channel4.envelopeCounter)
  )
  ;;@ core/sound/channel4.ts:123:4
  (i32.store
   ;;@ core/sound/channel4.ts:123:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel4.ts:123:40
    (i32.const 9)
    (i32.const 10)
   )
   ;;@ core/sound/channel4.ts:123:71
   (get_global $core/sound/channel4/Channel4.lengthCounter)
  )
  ;;@ core/sound/channel4.ts:124:4
  (i32.store
   ;;@ core/sound/channel4.ts:124:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel4.ts:124:40
    (i32.const 14)
    (i32.const 10)
   )
   ;;@ core/sound/channel4.ts:124:71
   (get_global $core/sound/channel4/Channel4.volume)
  )
  ;;@ core/sound/channel4.ts:125:4
  (i32.store16
   ;;@ core/sound/channel4.ts:125:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel4.ts:125:40
    (i32.const 19)
    (i32.const 10)
   )
   ;;@ core/sound/channel4.ts:125:71
   (get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister)
  )
 )
 (func $core/core/saveState (; 247 ;) (; has Stack IR ;) (type $v)
  ;;@ core/core.ts:387:6
  (call $core/cpu/cpu/Cpu.saveState)
  ;;@ core/core.ts:388:11
  (call $core/graphics/graphics/Graphics.saveState)
  ;;@ core/core.ts:389:13
  (call $core/interrupts/interrupts/Interrupts.saveState)
  ;;@ core/core.ts:390:9
  (call $core/joypad/joypad/Joypad.saveState)
  ;;@ core/core.ts:391:9
  (call $core/memory/memory/Memory.saveState)
  ;;@ core/core.ts:392:9
  (call $core/timers/timers/Timers.saveState)
  ;;@ core/core.ts:393:8
  (call $core/sound/sound/Sound.saveState)
  ;;@ core/core.ts:394:11
  (call $core/sound/channel1/Channel1.saveState)
  ;;@ core/core.ts:395:11
  (call $core/sound/channel2/Channel2.saveState)
  ;;@ core/core.ts:396:11
  (call $core/sound/channel3/Channel3.saveState)
  ;;@ core/core.ts:397:11
  (call $core/sound/channel4/Channel4.saveState)
  ;;@ core/core.ts:400:2
  (set_global $core/core/hasStarted
   ;;@ core/core.ts:400:15
   (i32.const 0)
  )
 )
 (func $core/memory/load/loadBooleanDirectlyFromWasmMemory (; 248 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/memory/load.ts:55:2
  (if
   ;;@ core/memory/load.ts:55:6
   (i32.gt_s
    ;;@ core/memory/load.ts:54:26
    (i32.load8_u
     (get_local $0)
    )
    ;;@ core/memory/load.ts:55:21
    (i32.const 0)
   )
   (return
    (i32.const 1)
   )
  )
  (i32.const 0)
 )
 (func $core/cpu/cpu/Cpu.loadState (; 249 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cpu/cpu.ts:95:4
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/cpu.ts:95:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:95:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:95:54
     (i32.const 0)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:96:4
  (set_global $core/cpu/cpu/Cpu.registerB
   ;;@ core/cpu/cpu.ts:96:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:96:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:96:54
     (i32.const 1)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:97:4
  (set_global $core/cpu/cpu/Cpu.registerC
   ;;@ core/cpu/cpu.ts:97:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:97:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:97:54
     (i32.const 2)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:98:4
  (set_global $core/cpu/cpu/Cpu.registerD
   ;;@ core/cpu/cpu.ts:98:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:98:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:98:54
     (i32.const 3)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:99:4
  (set_global $core/cpu/cpu/Cpu.registerE
   ;;@ core/cpu/cpu.ts:99:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:99:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:99:54
     (i32.const 4)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:100:4
  (set_global $core/cpu/cpu/Cpu.registerH
   ;;@ core/cpu/cpu.ts:100:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:100:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:100:54
     (i32.const 5)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:101:4
  (set_global $core/cpu/cpu/Cpu.registerL
   ;;@ core/cpu/cpu.ts:101:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:101:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:101:54
     (i32.const 6)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:102:4
  (set_global $core/cpu/cpu/Cpu.registerF
   ;;@ core/cpu/cpu.ts:102:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:102:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:102:54
     (i32.const 7)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:104:4
  (set_global $core/cpu/cpu/Cpu.stackPointer
   ;;@ core/cpu/cpu.ts:104:23
   (i32.load16_u
    ;;@ core/cpu/cpu.ts:104:33
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:104:58
     (i32.const 8)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:105:4
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/cpu.ts:105:25
   (i32.load16_u
    ;;@ core/cpu/cpu.ts:105:35
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:105:60
     (i32.const 10)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:107:4
  (set_global $core/cpu/cpu/Cpu.currentCycles
   ;;@ core/cpu/cpu.ts:107:24
   (i32.load
    ;;@ core/cpu/cpu.ts:107:34
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:107:59
     (i32.const 12)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:109:4
  (set_global $core/cpu/cpu/Cpu.isHalted
   ;;@ core/cpu/cpu.ts:109:19
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/cpu/cpu.ts:109:53
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:109:78
     (i32.const 17)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:110:4
  (set_global $core/cpu/cpu/Cpu.isStopped
   ;;@ core/cpu/cpu.ts:110:20
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/cpu/cpu.ts:110:54
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:110:79
     (i32.const 18)
     (i32.const 0)
    )
   )
  )
 )
 (func $core/graphics/graphics/Graphics.loadState (; 250 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/graphics.ts:110:4
  (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   ;;@ core/graphics/graphics.ts:110:36
   (i32.load
    ;;@ core/graphics/graphics.ts:110:46
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/graphics/graphics.ts:110:71
     (i32.const 0)
     (i32.const 1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:111:4
  (set_global $core/graphics/lcd/Lcd.currentLcdMode
   ;;@ core/graphics/graphics.ts:111:25
   (i32.load8_u
    ;;@ core/graphics/graphics.ts:111:34
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/graphics/graphics.ts:111:59
     (i32.const 4)
     (i32.const 1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:113:4
  (set_global $core/graphics/graphics/Graphics.scanlineRegister
   ;;@ core/graphics/graphics.ts:113:32
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65348)
   )
  )
  ;;@ core/graphics/graphics.ts:114:8
  (call $core/graphics/lcd/Lcd.updateLcdControl
   ;;@ core/graphics/graphics.ts:114:25
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65344)
   )
  )
 )
 (func $core/interrupts/interrupts/Interrupts.loadState (; 251 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:73:4
  (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
   ;;@ core/interrupts/interrupts.ts:73:39
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/interrupts/interrupts.ts:73:73
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/interrupts/interrupts.ts:73:98
     (i32.const 0)
     (i32.const 2)
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:74:4
  (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
   ;;@ core/interrupts/interrupts.ts:74:44
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/interrupts/interrupts.ts:74:78
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/interrupts/interrupts.ts:74:103
     (i32.const 1)
     (i32.const 2)
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:76:15
  (call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:76:38
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65535)
   )
  )
  ;;@ core/interrupts/interrupts.ts:77:15
  (call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
   ;;@ core/interrupts/interrupts.ts:77:40
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65295)
   )
  )
 )
 (func $core/joypad/joypad/Joypad.loadState (; 252 ;) (; has Stack IR ;) (type $v)
  ;;@ core/joypad/joypad.ts:60:11
  (call $core/joypad/joypad/Joypad.updateJoypad
   ;;@ core/joypad/joypad.ts:60:24
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65280)
   )
  )
 )
 (func $core/memory/memory/Memory.loadState (; 253 ;) (; has Stack IR ;) (type $v)
  ;;@ core/memory/memory.ts:119:4
  (set_global $core/memory/memory/Memory.currentRomBank
   ;;@ core/memory/memory.ts:119:28
   (i32.load16_u
    ;;@ core/memory/memory.ts:119:38
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:119:63
     (i32.const 0)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:120:4
  (set_global $core/memory/memory/Memory.currentRamBank
   ;;@ core/memory/memory.ts:120:28
   (i32.load16_u
    ;;@ core/memory/memory.ts:120:38
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:120:63
     (i32.const 2)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:122:4
  (set_global $core/memory/memory/Memory.isRamBankingEnabled
   ;;@ core/memory/memory.ts:122:33
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/memory/memory.ts:122:67
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:122:92
     (i32.const 4)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:123:4
  (set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
   ;;@ core/memory/memory.ts:123:34
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/memory/memory.ts:123:68
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:123:93
     (i32.const 5)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:125:4
  (set_global $core/memory/memory/Memory.isRomOnly
   ;;@ core/memory/memory.ts:125:23
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/memory/memory.ts:125:57
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:125:82
     (i32.const 6)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:126:4
  (set_global $core/memory/memory/Memory.isMBC1
   ;;@ core/memory/memory.ts:126:20
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/memory/memory.ts:126:54
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:126:79
     (i32.const 7)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:127:4
  (set_global $core/memory/memory/Memory.isMBC2
   ;;@ core/memory/memory.ts:127:20
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/memory/memory.ts:127:54
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:127:79
     (i32.const 8)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:128:4
  (set_global $core/memory/memory/Memory.isMBC3
   ;;@ core/memory/memory.ts:128:20
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/memory/memory.ts:128:54
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:128:79
     (i32.const 9)
     (i32.const 4)
    )
   )
  )
  ;;@ core/memory/memory.ts:129:4
  (set_global $core/memory/memory/Memory.isMBC5
   ;;@ core/memory/memory.ts:129:20
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/memory/memory.ts:129:54
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/memory/memory.ts:129:79
     (i32.const 10)
     (i32.const 4)
    )
   )
  )
 )
 (func $core/timers/timers/Timers.loadState (; 254 ;) (; has Stack IR ;) (type $v)
  ;;@ core/timers/timers.ts:148:4
  (set_global $core/timers/timers/Timers.currentCycles
   ;;@ core/timers/timers.ts:148:27
   (i32.load
    ;;@ core/timers/timers.ts:148:37
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/timers/timers.ts:148:62
     (i32.const 0)
     (i32.const 5)
    )
   )
  )
  ;;@ core/timers/timers.ts:149:4
  (set_global $core/timers/timers/Timers.dividerRegister
   ;;@ core/timers/timers.ts:149:29
   (i32.load
    ;;@ core/timers/timers.ts:149:39
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/timers/timers.ts:149:64
     (i32.const 4)
     (i32.const 5)
    )
   )
  )
  ;;@ core/timers/timers.ts:150:4
  (set_global $core/timers/timers/Timers.timerCounterOverflowDelay
   ;;@ core/timers/timers.ts:150:39
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/timers/timers.ts:150:73
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/timers/timers.ts:150:98
     (i32.const 8)
     (i32.const 5)
    )
   )
  )
  ;;@ core/timers/timers.ts:151:4
  (set_global $core/timers/timers/Timers.timerCounterWasReset
   ;;@ core/timers/timers.ts:151:34
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/timers/timers.ts:151:68
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/timers/timers.ts:151:93
     (i32.const 11)
     (i32.const 5)
    )
   )
  )
  ;;@ core/timers/timers.ts:153:4
  (set_global $core/timers/timers/Timers.timerCounter
   ;;@ core/timers/timers.ts:153:26
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65285)
   )
  )
  ;;@ core/timers/timers.ts:154:4
  (set_global $core/timers/timers/Timers.timerModulo
   ;;@ core/timers/timers.ts:154:25
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65286)
   )
  )
  ;;@ core/timers/timers.ts:155:4
  (set_global $core/timers/timers/Timers.timerInputClock
   ;;@ core/timers/timers.ts:155:29
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65287)
   )
  )
 )
 (func $core/sound/sound/clearAudioBuffer (; 255 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/sound.ts:207:2
  (set_global $core/sound/sound/Sound.audioQueueIndex
   ;;@ core/sound/sound.ts:207:26
   (i32.const 0)
  )
 )
 (func $core/sound/sound/Sound.loadState (; 256 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/sound.ts:133:4
  (set_global $core/sound/sound/Sound.frameSequenceCycleCounter
   ;;@ core/sound/sound.ts:133:38
   (i32.load
    ;;@ core/sound/sound.ts:133:48
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/sound.ts:133:73
     (i32.const 0)
     (i32.const 6)
    )
   )
  )
  ;;@ core/sound/sound.ts:134:4
  (set_global $core/sound/sound/Sound.downSampleCycleCounter
   ;;@ core/sound/sound.ts:134:35
   (i32.load8_u
    ;;@ core/sound/sound.ts:134:44
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/sound.ts:134:69
     (i32.const 4)
     (i32.const 6)
    )
   )
  )
  ;;@ core/sound/sound.ts:135:4
  (set_global $core/sound/sound/Sound.frameSequencer
   ;;@ core/sound/sound.ts:135:27
   (i32.load8_u
    ;;@ core/sound/sound.ts:135:36
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/sound.ts:135:61
     (i32.const 5)
     (i32.const 6)
    )
   )
  )
  ;;@ core/sound/sound.ts:137:4
  (call $core/sound/sound/clearAudioBuffer)
 )
 (func $core/sound/channel1/Channel1.loadState (; 257 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel1.ts:131:4
  (set_global $core/sound/channel1/Channel1.isEnabled
   ;;@ core/sound/channel1.ts:131:25
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/sound/channel1.ts:131:59
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:131:84
     (i32.const 0)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:132:4
  (set_global $core/sound/channel1/Channel1.frequencyTimer
   ;;@ core/sound/channel1.ts:132:30
   (i32.load
    ;;@ core/sound/channel1.ts:132:40
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:132:65
     (i32.const 1)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:133:4
  (set_global $core/sound/channel1/Channel1.envelopeCounter
   ;;@ core/sound/channel1.ts:133:31
   (i32.load
    ;;@ core/sound/channel1.ts:133:41
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:133:66
     (i32.const 5)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:134:4
  (set_global $core/sound/channel1/Channel1.lengthCounter
   ;;@ core/sound/channel1.ts:134:29
   (i32.load
    ;;@ core/sound/channel1.ts:134:39
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:134:64
     (i32.const 9)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:135:4
  (set_global $core/sound/channel1/Channel1.volume
   ;;@ core/sound/channel1.ts:135:22
   (i32.load
    ;;@ core/sound/channel1.ts:135:32
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:135:57
     (i32.const 14)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:137:4
  (set_global $core/sound/channel1/Channel1.dutyCycle
   ;;@ core/sound/channel1.ts:137:25
   (i32.load8_u
    ;;@ core/sound/channel1.ts:137:34
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:137:59
     (i32.const 19)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:138:4
  (set_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
   ;;@ core/sound/channel1.ts:138:38
   (i32.load8_u
    ;;@ core/sound/channel1.ts:138:47
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:138:72
     (i32.const 20)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:140:4
  (set_global $core/sound/channel1/Channel1.isSweepEnabled
   ;;@ core/sound/channel1.ts:140:30
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/sound/channel1.ts:140:64
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:140:89
     (i32.const 25)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:141:4
  (set_global $core/sound/channel1/Channel1.sweepCounter
   ;;@ core/sound/channel1.ts:141:28
   (i32.load
    ;;@ core/sound/channel1.ts:141:38
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:141:63
     (i32.const 26)
     (i32.const 7)
    )
   )
  )
  ;;@ core/sound/channel1.ts:142:4
  (set_global $core/sound/channel1/Channel1.sweepShadowFrequency
   ;;@ core/sound/channel1.ts:142:36
   (i32.load16_u
    ;;@ core/sound/channel1.ts:142:46
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel1.ts:142:71
     (i32.const 31)
     (i32.const 7)
    )
   )
  )
 )
 (func $core/sound/channel2/Channel2.loadState (; 258 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel2.ts:111:4
  (set_global $core/sound/channel2/Channel2.isEnabled
   ;;@ core/sound/channel2.ts:111:25
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/sound/channel2.ts:111:59
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel2.ts:111:84
     (i32.const 0)
     (i32.const 8)
    )
   )
  )
  ;;@ core/sound/channel2.ts:112:4
  (set_global $core/sound/channel2/Channel2.frequencyTimer
   ;;@ core/sound/channel2.ts:112:30
   (i32.load
    ;;@ core/sound/channel2.ts:112:40
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel2.ts:112:65
     (i32.const 1)
     (i32.const 8)
    )
   )
  )
  ;;@ core/sound/channel2.ts:113:4
  (set_global $core/sound/channel2/Channel2.envelopeCounter
   ;;@ core/sound/channel2.ts:113:31
   (i32.load
    ;;@ core/sound/channel2.ts:113:41
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel2.ts:113:66
     (i32.const 5)
     (i32.const 8)
    )
   )
  )
  ;;@ core/sound/channel2.ts:114:4
  (set_global $core/sound/channel2/Channel2.lengthCounter
   ;;@ core/sound/channel2.ts:114:29
   (i32.load
    ;;@ core/sound/channel2.ts:114:39
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel2.ts:114:64
     (i32.const 9)
     (i32.const 8)
    )
   )
  )
  ;;@ core/sound/channel2.ts:115:4
  (set_global $core/sound/channel2/Channel2.volume
   ;;@ core/sound/channel2.ts:115:22
   (i32.load
    ;;@ core/sound/channel2.ts:115:32
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel2.ts:115:57
     (i32.const 14)
     (i32.const 8)
    )
   )
  )
  ;;@ core/sound/channel2.ts:117:4
  (set_global $core/sound/channel2/Channel2.dutyCycle
   ;;@ core/sound/channel2.ts:117:25
   (i32.load8_u
    ;;@ core/sound/channel2.ts:117:34
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel2.ts:117:59
     (i32.const 19)
     (i32.const 8)
    )
   )
  )
  ;;@ core/sound/channel2.ts:118:4
  (set_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
   ;;@ core/sound/channel2.ts:118:38
   (i32.load8_u
    ;;@ core/sound/channel2.ts:118:47
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel2.ts:118:72
     (i32.const 20)
     (i32.const 8)
    )
   )
  )
 )
 (func $core/sound/channel3/Channel3.loadState (; 259 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:105:4
  (set_global $core/sound/channel3/Channel3.isEnabled
   ;;@ core/sound/channel3.ts:105:25
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/sound/channel3.ts:105:59
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:105:84
     (i32.const 0)
     (i32.const 9)
    )
   )
  )
  ;;@ core/sound/channel3.ts:106:4
  (set_global $core/sound/channel3/Channel3.frequencyTimer
   ;;@ core/sound/channel3.ts:106:30
   (i32.load
    ;;@ core/sound/channel3.ts:106:40
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:106:65
     (i32.const 1)
     (i32.const 9)
    )
   )
  )
  ;;@ core/sound/channel3.ts:107:4
  (set_global $core/sound/channel3/Channel3.lengthCounter
   ;;@ core/sound/channel3.ts:107:29
   (i32.load
    ;;@ core/sound/channel3.ts:107:39
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:107:64
     (i32.const 5)
     (i32.const 9)
    )
   )
  )
  ;;@ core/sound/channel3.ts:108:4
  (set_global $core/sound/channel3/Channel3.waveTablePosition
   ;;@ core/sound/channel3.ts:108:33
   (i32.load16_u
    ;;@ core/sound/channel3.ts:108:43
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:108:68
     (i32.const 9)
     (i32.const 9)
    )
   )
  )
 )
 (func $core/sound/channel4/Channel4.loadState (; 260 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel4.ts:130:4
  (set_global $core/sound/channel4/Channel4.isEnabled
   ;;@ core/sound/channel4.ts:130:25
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/sound/channel4.ts:130:59
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel4.ts:130:84
     (i32.const 0)
     (i32.const 10)
    )
   )
  )
  ;;@ core/sound/channel4.ts:131:4
  (set_global $core/sound/channel4/Channel4.frequencyTimer
   ;;@ core/sound/channel4.ts:131:30
   (i32.load
    ;;@ core/sound/channel4.ts:131:40
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel4.ts:131:65
     (i32.const 1)
     (i32.const 10)
    )
   )
  )
  ;;@ core/sound/channel4.ts:132:4
  (set_global $core/sound/channel4/Channel4.envelopeCounter
   ;;@ core/sound/channel4.ts:132:31
   (i32.load
    ;;@ core/sound/channel4.ts:132:41
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel4.ts:132:66
     (i32.const 5)
     (i32.const 10)
    )
   )
  )
  ;;@ core/sound/channel4.ts:133:4
  (set_global $core/sound/channel4/Channel4.lengthCounter
   ;;@ core/sound/channel4.ts:133:29
   (i32.load
    ;;@ core/sound/channel4.ts:133:39
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel4.ts:133:64
     (i32.const 9)
     (i32.const 10)
    )
   )
  )
  ;;@ core/sound/channel4.ts:134:4
  (set_global $core/sound/channel4/Channel4.volume
   ;;@ core/sound/channel4.ts:134:22
   (i32.load
    ;;@ core/sound/channel4.ts:134:32
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel4.ts:134:57
     (i32.const 14)
     (i32.const 10)
    )
   )
  )
  ;;@ core/sound/channel4.ts:135:4
  (set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   ;;@ core/sound/channel4.ts:135:43
   (i32.load16_u
    ;;@ core/sound/channel4.ts:135:53
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel4.ts:135:78
     (i32.const 19)
     (i32.const 10)
    )
   )
  )
 )
 (func $core/core/loadState (; 261 ;) (; has Stack IR ;) (type $v)
  ;;@ core/core.ts:405:6
  (call $core/cpu/cpu/Cpu.loadState)
  ;;@ core/core.ts:406:11
  (call $core/graphics/graphics/Graphics.loadState)
  ;;@ core/core.ts:407:13
  (call $core/interrupts/interrupts/Interrupts.loadState)
  ;;@ core/core.ts:408:9
  (call $core/joypad/joypad/Joypad.loadState)
  ;;@ core/core.ts:409:9
  (call $core/memory/memory/Memory.loadState)
  ;;@ core/core.ts:410:9
  (call $core/timers/timers/Timers.loadState)
  ;;@ core/core.ts:411:8
  (call $core/sound/sound/Sound.loadState)
  ;;@ core/core.ts:412:11
  (call $core/sound/channel1/Channel1.loadState)
  ;;@ core/core.ts:413:11
  (call $core/sound/channel2/Channel2.loadState)
  ;;@ core/core.ts:414:11
  (call $core/sound/channel3/Channel3.loadState)
  ;;@ core/core.ts:415:11
  (call $core/sound/channel4/Channel4.loadState)
  ;;@ core/core.ts:418:2
  (set_global $core/core/hasStarted
   ;;@ core/core.ts:418:15
   (i32.const 0)
  )
 )
 (func $core/core/hasCoreStarted (; 262 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/core.ts:32:2
  (if
   ;;@ core/core.ts:32:6
   (get_global $core/core/hasStarted)
   (return
    (i32.const 1)
   )
  )
  (i32.const 0)
 )
 (func $core/joypad/joypad/_getJoypadButtonStateFromButtonId (; 263 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (block $case8|0
   (block $case7|0
    (block $case6|0
     (block $case5|0
      (block $case4|0
       (block $case3|0
        (block $case2|0
         (block $case1|0
          (if
           (get_local $0)
           (block
            (br_if $case1|0
             (i32.eq
              (tee_local $1
               (get_local $0)
              )
              ;;@ core/joypad/joypad.ts:236:9
              (i32.const 1)
             )
            )
            (block $tablify|0
             (br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
              (i32.sub
               (get_local $1)
               (i32.const 2)
              )
             )
            )
            (br $case8|0)
           )
          )
          ;;@ core/joypad/joypad.ts:235:20
          (return
           ;;@ core/joypad/joypad.ts:235:13
           (get_global $core/joypad/joypad/Joypad.up)
          )
         )
         ;;@ core/joypad/joypad.ts:237:20
         (return
          ;;@ core/joypad/joypad.ts:237:13
          (get_global $core/joypad/joypad/Joypad.right)
         )
        )
        ;;@ core/joypad/joypad.ts:239:20
        (return
         ;;@ core/joypad/joypad.ts:239:13
         (get_global $core/joypad/joypad/Joypad.down)
        )
       )
       ;;@ core/joypad/joypad.ts:241:20
       (return
        ;;@ core/joypad/joypad.ts:241:13
        (get_global $core/joypad/joypad/Joypad.left)
       )
      )
      ;;@ core/joypad/joypad.ts:243:20
      (return
       ;;@ core/joypad/joypad.ts:243:13
       (get_global $core/joypad/joypad/Joypad.a)
      )
     )
     ;;@ core/joypad/joypad.ts:245:20
     (return
      ;;@ core/joypad/joypad.ts:245:13
      (get_global $core/joypad/joypad/Joypad.b)
     )
    )
    ;;@ core/joypad/joypad.ts:247:20
    (return
     ;;@ core/joypad/joypad.ts:247:13
     (get_global $core/joypad/joypad/Joypad.select)
    )
   )
   ;;@ core/joypad/joypad.ts:249:20
   (return
    ;;@ core/joypad/joypad.ts:249:13
    (get_global $core/joypad/joypad/Joypad.start)
   )
  )
  ;;@ core/joypad/joypad.ts:251:13
  (i32.const 0)
 )
 (func $core/joypad/joypad/_setJoypadButtonStateFromButtonId (; 264 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  ;;@ core/joypad/joypad.ts:256:2
  (block $break|0
   (block $case7|0
    (block $case6|0
     (block $case5|0
      (block $case4|0
       (block $case3|0
        (block $case2|0
         (block $case1|0
          (if
           (get_local $0)
           (block
            (br_if $case1|0
             (i32.eq
              (tee_local $2
               (get_local $0)
              )
              ;;@ core/joypad/joypad.ts:260:9
              (i32.const 1)
             )
            )
            (block $tablify|0
             (br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
              (i32.sub
               (get_local $2)
               (i32.const 2)
              )
             )
            )
            (br $break|0)
           )
          )
          ;;@ core/joypad/joypad.ts:258:6
          (set_global $core/joypad/joypad/Joypad.up
           (i32.and
            (get_local $1)
            (i32.const 1)
           )
          )
          ;;@ core/joypad/joypad.ts:259:6
          (br $break|0)
         )
         ;;@ core/joypad/joypad.ts:261:6
         (set_global $core/joypad/joypad/Joypad.right
          (i32.and
           (get_local $1)
           (i32.const 1)
          )
         )
         ;;@ core/joypad/joypad.ts:262:6
         (br $break|0)
        )
        ;;@ core/joypad/joypad.ts:264:6
        (set_global $core/joypad/joypad/Joypad.down
         (i32.and
          (get_local $1)
          (i32.const 1)
         )
        )
        ;;@ core/joypad/joypad.ts:265:6
        (br $break|0)
       )
       ;;@ core/joypad/joypad.ts:267:6
       (set_global $core/joypad/joypad/Joypad.left
        (i32.and
         (get_local $1)
         (i32.const 1)
        )
       )
       ;;@ core/joypad/joypad.ts:268:6
       (br $break|0)
      )
      ;;@ core/joypad/joypad.ts:270:6
      (set_global $core/joypad/joypad/Joypad.a
       (i32.and
        (get_local $1)
        (i32.const 1)
       )
      )
      ;;@ core/joypad/joypad.ts:271:6
      (br $break|0)
     )
     ;;@ core/joypad/joypad.ts:273:6
     (set_global $core/joypad/joypad/Joypad.b
      (i32.and
       (get_local $1)
       (i32.const 1)
      )
     )
     ;;@ core/joypad/joypad.ts:274:6
     (br $break|0)
    )
    ;;@ core/joypad/joypad.ts:276:6
    (set_global $core/joypad/joypad/Joypad.select
     (i32.and
      (get_local $1)
      (i32.const 1)
     )
    )
    ;;@ core/joypad/joypad.ts:277:6
    (br $break|0)
   )
   ;;@ core/joypad/joypad.ts:279:6
   (set_global $core/joypad/joypad/Joypad.start
    (i32.and
     (get_local $1)
     (i32.const 1)
    )
   )
  )
 )
 (func $core/interrupts/interrupts/requestJoypadInterrupt (; 265 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:188:2
  (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
   ;;@ core/interrupts/interrupts.ts:188:42
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:189:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 4)
  )
 )
 (func $core/joypad/joypad/_pressJoypadButton (; 266 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/joypad/joypad.ts:186:2
  (set_global $core/cpu/cpu/Cpu.isStopped
   ;;@ core/joypad/joypad.ts:186:18
   (i32.const 0)
  )
  ;;@ core/joypad/joypad.ts:190:2
  (if
   ;;@ core/joypad/joypad.ts:190:6
   (i32.eqz
    ;;@ core/joypad/joypad.ts:190:7
    (call $core/joypad/joypad/_getJoypadButtonStateFromButtonId
     (get_local $0)
    )
   )
   ;;@ core/joypad/joypad.ts:190:52
   (set_local $1
    ;;@ core/joypad/joypad.ts:191:28
    (i32.const 1)
   )
  )
  ;;@ core/joypad/joypad.ts:195:2
  (call $core/joypad/joypad/_setJoypadButtonStateFromButtonId
   (get_local $0)
   ;;@ core/joypad/joypad.ts:195:46
   (i32.const 1)
  )
  ;;@ core/joypad/joypad.ts:198:2
  (if
   (get_local $1)
   ;;@ core/joypad/joypad.ts:198:29
   (block
    ;;@ core/joypad/joypad.ts:200:4
    (set_local $1
     ;;@ core/joypad/joypad.ts:200:27
     (i32.const 0)
    )
    ;;@ core/joypad/joypad.ts:201:4
    (if
     ;;@ core/joypad/joypad.ts:201:8
     (i32.le_s
      (get_local $0)
      ;;@ core/joypad/joypad.ts:201:20
      (i32.const 3)
     )
     ;;@ core/joypad/joypad.ts:201:23
     (set_local $1
      ;;@ core/joypad/joypad.ts:202:25
      (i32.const 1)
     )
    )
    ;;@ core/joypad/joypad.ts:211:4
    (if
     (tee_local $0
      ;;@ core/joypad/joypad.ts:211:8
      (if (result i32)
       (get_global $core/joypad/joypad/Joypad.isDpadType)
       (get_local $1)
       (get_global $core/joypad/joypad/Joypad.isDpadType)
      )
     )
     ;;@ core/joypad/joypad.ts:211:47
     (set_local $2
      ;;@ core/joypad/joypad.ts:212:31
      (i32.const 1)
     )
    )
    ;;@ core/joypad/joypad.ts:216:4
    (if
     (tee_local $0
      ;;@ core/joypad/joypad.ts:216:8
      (if (result i32)
       (get_global $core/joypad/joypad/Joypad.isButtonType)
       ;;@ core/joypad/joypad.ts:216:31
       (i32.eqz
        (get_local $1)
       )
       (get_global $core/joypad/joypad/Joypad.isButtonType)
      )
     )
     ;;@ core/joypad/joypad.ts:216:50
     (set_local $2
      ;;@ core/joypad/joypad.ts:217:31
      (i32.const 1)
     )
    )
    ;;@ core/joypad/joypad.ts:221:4
    (if
     (get_local $2)
     ;;@ core/joypad/joypad.ts:221:32
     (call $core/interrupts/interrupts/requestJoypadInterrupt)
    )
   )
  )
 )
 (func $core/joypad/joypad/_releaseJoypadButton (; 267 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/joypad/joypad.ts:229:2
  (call $core/joypad/joypad/_setJoypadButtonStateFromButtonId
   (get_local $0)
   ;;@ core/joypad/joypad.ts:229:46
   (i32.const 0)
  )
 )
 (func $core/joypad/joypad/setJoypadState (; 268 ;) (; has Stack IR ;) (type $iiiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32)
  ;;@ core/joypad/joypad.ts:135:2
  (if
   ;;@ core/joypad/joypad.ts:135:6
   (i32.gt_s
    (get_local $0)
    ;;@ core/joypad/joypad.ts:135:11
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:135:14
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:136:23
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:137:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:138:25
    (i32.const 0)
   )
  )
  ;;@ core/joypad/joypad.ts:141:2
  (if
   ;;@ core/joypad/joypad.ts:141:6
   (i32.gt_s
    (get_local $1)
    ;;@ core/joypad/joypad.ts:141:14
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:141:17
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:142:23
    (i32.const 1)
   )
   ;;@ core/joypad/joypad.ts:143:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:144:25
    (i32.const 1)
   )
  )
  ;;@ core/joypad/joypad.ts:147:2
  (if
   ;;@ core/joypad/joypad.ts:147:6
   (i32.gt_s
    (get_local $2)
    ;;@ core/joypad/joypad.ts:147:13
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:147:16
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:148:23
    (i32.const 2)
   )
   ;;@ core/joypad/joypad.ts:149:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:150:25
    (i32.const 2)
   )
  )
  ;;@ core/joypad/joypad.ts:153:2
  (if
   ;;@ core/joypad/joypad.ts:153:6
   (i32.gt_s
    (get_local $3)
    ;;@ core/joypad/joypad.ts:153:13
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:153:16
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:154:23
    (i32.const 3)
   )
   ;;@ core/joypad/joypad.ts:155:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:156:25
    (i32.const 3)
   )
  )
  ;;@ core/joypad/joypad.ts:159:2
  (if
   ;;@ core/joypad/joypad.ts:159:6
   (i32.gt_s
    (get_local $4)
    ;;@ core/joypad/joypad.ts:159:10
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:159:13
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:160:23
    (i32.const 4)
   )
   ;;@ core/joypad/joypad.ts:161:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:162:25
    (i32.const 4)
   )
  )
  ;;@ core/joypad/joypad.ts:165:2
  (if
   ;;@ core/joypad/joypad.ts:165:6
   (i32.gt_s
    (get_local $5)
    ;;@ core/joypad/joypad.ts:165:10
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:165:13
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:166:23
    (i32.const 5)
   )
   ;;@ core/joypad/joypad.ts:167:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:168:25
    (i32.const 5)
   )
  )
  ;;@ core/joypad/joypad.ts:171:2
  (if
   ;;@ core/joypad/joypad.ts:171:6
   (i32.gt_s
    (get_local $6)
    ;;@ core/joypad/joypad.ts:171:15
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:171:18
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:172:23
    (i32.const 6)
   )
   ;;@ core/joypad/joypad.ts:173:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:174:25
    (i32.const 6)
   )
  )
  ;;@ core/joypad/joypad.ts:177:2
  (if
   ;;@ core/joypad/joypad.ts:177:6
   (i32.gt_s
    (get_local $7)
    ;;@ core/joypad/joypad.ts:177:14
    (i32.const 0)
   )
   ;;@ core/joypad/joypad.ts:177:17
   (call $core/joypad/joypad/_pressJoypadButton
    ;;@ core/joypad/joypad.ts:178:23
    (i32.const 7)
   )
   ;;@ core/joypad/joypad.ts:179:9
   (call $core/joypad/joypad/_releaseJoypadButton
    ;;@ core/joypad/joypad.ts:180:25
    (i32.const 7)
   )
  )
 )
 (func $core/debug/debug-cpu/getRegisterA (; 269 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:6:13
  (get_global $core/cpu/cpu/Cpu.registerA)
 )
 (func $core/debug/debug-cpu/getRegisterB (; 270 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:10:13
  (get_global $core/cpu/cpu/Cpu.registerB)
 )
 (func $core/debug/debug-cpu/getRegisterC (; 271 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:14:13
  (get_global $core/cpu/cpu/Cpu.registerC)
 )
 (func $core/debug/debug-cpu/getRegisterD (; 272 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:18:13
  (get_global $core/cpu/cpu/Cpu.registerD)
 )
 (func $core/debug/debug-cpu/getRegisterE (; 273 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:22:13
  (get_global $core/cpu/cpu/Cpu.registerE)
 )
 (func $core/debug/debug-cpu/getRegisterH (; 274 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:26:13
  (get_global $core/cpu/cpu/Cpu.registerH)
 )
 (func $core/debug/debug-cpu/getRegisterL (; 275 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:30:13
  (get_global $core/cpu/cpu/Cpu.registerL)
 )
 (func $core/debug/debug-cpu/getRegisterF (; 276 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:34:13
  (get_global $core/cpu/cpu/Cpu.registerF)
 )
 (func $core/debug/debug-cpu/getProgramCounter (; 277 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:38:13
  (get_global $core/cpu/cpu/Cpu.programCounter)
 )
 (func $core/debug/debug-cpu/getStackPointer (; 278 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:42:13
  (get_global $core/cpu/cpu/Cpu.stackPointer)
 )
 (func $core/debug/debug-cpu/getOpcodeAtProgramCounter (; 279 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:46:56
  (call $core/memory/load/eightBitLoadFromGBMemory
   ;;@ core/debug/debug-cpu.ts:46:38
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
 )
 (func $core/debug/debug-graphics/getLY (; 280 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-graphics.ts:19:18
  (get_global $core/graphics/graphics/Graphics.scanlineRegister)
 )
 (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory (; 281 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  ;;@ core/debug/debug-graphics.ts:34:2
  (set_local $9
   (i32.const 34816)
  )
  ;;@ core/debug/debug-graphics.ts:35:2
  (if
   ;;@ core/debug/debug-graphics.ts:35:6
   (get_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect)
   ;;@ core/debug/debug-graphics.ts:35:34
   (set_local $9
    (i32.const 32768)
   )
  )
  ;;@ core/debug/debug-graphics.ts:39:2
  (set_local $10
   (i32.const 38912)
  )
  ;;@ core/debug/debug-graphics.ts:40:2
  (if
   ;;@ core/debug/debug-graphics.ts:40:6
   (get_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect)
   ;;@ core/debug/debug-graphics.ts:40:34
   (set_local $10
    (i32.const 39936)
   )
  )
  ;;@ core/debug/debug-graphics.ts:44:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/debug/debug-graphics.ts:44:23
     (i32.ge_s
      (get_local $4)
      ;;@ core/debug/debug-graphics.ts:44:27
      (i32.const 256)
     )
    )
    ;;@ core/debug/debug-graphics.ts:45:4
    (block $break|1
     ;;@ core/debug/debug-graphics.ts:45:9
     (set_local $5
      ;;@ core/debug/debug-graphics.ts:45:22
      (i32.const 0)
     )
     (loop $repeat|1
      (br_if $break|1
       ;;@ core/debug/debug-graphics.ts:45:25
       (i32.ge_s
        (get_local $5)
        ;;@ core/debug/debug-graphics.ts:45:29
        (i32.const 256)
       )
      )
      ;;@ core/debug/debug-graphics.ts:78:6
      (set_local $8
       ;;@ core/debug/debug-graphics.ts:78:33
       (call $core/graphics/tiles/getTileDataAddress
        (get_local $9)
        ;;@ core/debug/debug-graphics.ts:72:35
        (call $core/graphics/graphics/loadFromVramBank
         ;;@ core/debug/debug-graphics.ts:69:6
         (tee_local $6
          ;;@ core/debug/debug-graphics.ts:69:32
          (i32.add
           (i32.add
            (get_local $10)
            ;;@ core/debug/debug-graphics.ts:69:56
            (i32.shl
             ;;@ core/debug/debug-graphics.ts:60:36
             (i32.shr_s
              (get_local $4)
              ;;@ core/debug/debug-graphics.ts:60:59
              (i32.const 3)
             )
             ;;@ core/debug/debug-graphics.ts:69:77
             (i32.const 5)
            )
           )
           ;;@ core/debug/debug-graphics.ts:59:36
           (i32.shr_s
            (get_local $5)
            ;;@ core/debug/debug-graphics.ts:59:59
            (i32.const 3)
           )
          )
         )
         ;;@ core/debug/debug-graphics.ts:72:68
         (i32.const 0)
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:91:6
      (set_local $1
       ;;@ core/debug/debug-graphics.ts:91:30
       (i32.rem_s
        (get_local $4)
        ;;@ core/debug/debug-graphics.ts:91:52
        (i32.const 8)
       )
      )
      ;;@ core/debug/debug-graphics.ts:100:6
      (set_local $7
       ;;@ core/debug/debug-graphics.ts:100:21
       (i32.sub
        (i32.const 7)
        ;;@ core/debug/debug-graphics.ts:99:30
        (i32.rem_s
         (get_local $5)
         ;;@ core/debug/debug-graphics.ts:99:52
         (i32.const 8)
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:109:6
      (set_local $2
       ;;@ core/debug/debug-graphics.ts:109:33
       (i32.const 0)
      )
      ;;@ core/debug/debug-graphics.ts:110:6
      (if
       (tee_local $3
        ;;@ core/debug/debug-graphics.ts:110:10
        (if (result i32)
         (get_global $core/cpu/cpu/Cpu.GBCEnabled)
         ;;@ core/debug/debug-graphics.ts:110:28
         (i32.gt_s
          (get_local $0)
          ;;@ core/debug/debug-graphics.ts:110:40
          (i32.const 0)
         )
         (get_global $core/cpu/cpu/Cpu.GBCEnabled)
        )
       )
       ;;@ core/debug/debug-graphics.ts:110:43
       (set_local $2
        ;;@ core/debug/debug-graphics.ts:111:26
        (call $core/graphics/graphics/loadFromVramBank
         (get_local $6)
         ;;@ core/debug/debug-graphics.ts:111:59
         (i32.const 1)
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:114:6
      (if
       ;;@ core/debug/debug-graphics.ts:114:10
       (call $core/helpers/index/checkBitOnByte
        ;;@ core/debug/debug-graphics.ts:114:25
        (i32.const 6)
        (get_local $2)
       )
       ;;@ core/debug/debug-graphics.ts:114:46
       (set_local $1
        ;;@ core/debug/debug-graphics.ts:118:23
        (i32.sub
         (i32.const 7)
         (get_local $1)
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:124:6
      (set_local $3
       ;;@ core/debug/debug-graphics.ts:124:28
       (i32.const 0)
      )
      ;;@ core/debug/debug-graphics.ts:125:6
      (if
       ;;@ core/debug/debug-graphics.ts:125:10
       (call $core/helpers/index/checkBitOnByte
        ;;@ core/debug/debug-graphics.ts:125:25
        (i32.const 3)
        (get_local $2)
       )
       ;;@ core/debug/debug-graphics.ts:125:46
       (set_local $3
        ;;@ core/debug/debug-graphics.ts:126:21
        (i32.const 1)
       )
      )
      ;;@ core/debug/debug-graphics.ts:132:6
      (set_local $8
       ;;@ core/debug/debug-graphics.ts:132:44
       (call $core/graphics/graphics/loadFromVramBank
        (tee_local $6
         ;;@ core/debug/debug-graphics.ts:132:61
         (i32.add
          (get_local $8)
          ;;@ core/debug/debug-graphics.ts:132:79
          (i32.shl
           (get_local $1)
           ;;@ core/debug/debug-graphics.ts:132:94
           (i32.const 1)
          )
         )
        )
        (get_local $3)
       )
      )
      ;;@ core/debug/debug-graphics.ts:140:6
      (set_local $1
       ;;@ core/debug/debug-graphics.ts:140:32
       (i32.const 0)
      )
      ;;@ core/debug/debug-graphics.ts:141:6
      (if
       ;;@ core/debug/debug-graphics.ts:141:10
       (call $core/helpers/index/checkBitOnByte
        (get_local $7)
        ;;@ core/debug/debug-graphics.ts:133:44
        (call $core/graphics/graphics/loadFromVramBank
         ;;@ core/debug/debug-graphics.ts:133:61
         (i32.add
          (get_local $6)
          ;;@ core/debug/debug-graphics.ts:133:98
          (i32.const 1)
         )
         (get_local $3)
        )
       )
       ;;@ core/debug/debug-graphics.ts:144:8
       (set_local $1
        (i32.const 2)
       )
      )
      ;;@ core/debug/debug-graphics.ts:146:6
      (if
       ;;@ core/debug/debug-graphics.ts:146:10
       (call $core/helpers/index/checkBitOnByte
        (get_local $7)
        (get_local $8)
       )
       ;;@ core/debug/debug-graphics.ts:146:68
       (set_local $1
        (i32.add
         (get_local $1)
         ;;@ core/debug/debug-graphics.ts:147:26
         (i32.const 1)
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:151:6
      (set_local $7
       ;;@ core/debug/debug-graphics.ts:151:28
       (i32.mul
        (i32.add
         ;;@ core/debug/debug-graphics.ts:151:29
         (i32.shl
          (get_local $4)
          ;;@ core/debug/debug-graphics.ts:151:33
          (i32.const 8)
         )
         (get_local $5)
        )
        ;;@ core/debug/debug-graphics.ts:151:44
        (i32.const 3)
       )
      )
      ;;@ core/debug/debug-graphics.ts:153:6
      (if
       (tee_local $3
        ;;@ core/debug/debug-graphics.ts:153:10
        (if (result i32)
         (get_global $core/cpu/cpu/Cpu.GBCEnabled)
         ;;@ core/debug/debug-graphics.ts:153:28
         (i32.gt_s
          (get_local $0)
          ;;@ core/debug/debug-graphics.ts:153:40
          (i32.const 0)
         )
         (get_global $core/cpu/cpu/Cpu.GBCEnabled)
        )
       )
       ;;@ core/debug/debug-graphics.ts:153:43
       (block
        ;;@ core/debug/debug-graphics.ts:162:8
        (set_local $6
         ;;@ core/debug/debug-graphics.ts:162:23
         (call $core/graphics/palette/getColorComponentFromRgb
          ;;@ core/debug/debug-graphics.ts:162:48
          (i32.const 0)
          ;;@ core/debug/debug-graphics.ts:159:8
          (tee_local $1
           ;;@ core/debug/debug-graphics.ts:159:35
           (call $core/graphics/palette/getRgbColorFromPalette
            ;;@ core/debug/debug-graphics.ts:156:29
            (i32.and
             (get_local $2)
             ;;@ core/debug/debug-graphics.ts:156:47
             (i32.const 7)
            )
            (get_local $1)
            ;;@ core/debug/debug-graphics.ts:159:85
            (i32.const 0)
           )
          )
         )
        )
        ;;@ core/debug/debug-graphics.ts:163:8
        (set_local $3
         ;;@ core/debug/debug-graphics.ts:163:25
         (call $core/graphics/palette/getColorComponentFromRgb
          ;;@ core/debug/debug-graphics.ts:163:50
          (i32.const 1)
          (get_local $1)
         )
        )
        ;;@ core/debug/debug-graphics.ts:164:8
        (set_local $1
         ;;@ core/debug/debug-graphics.ts:164:24
         (call $core/graphics/palette/getColorComponentFromRgb
          ;;@ core/debug/debug-graphics.ts:164:49
          (i32.const 2)
          (get_local $1)
         )
        )
        ;;@ core/debug/debug-graphics.ts:167:8
        (i32.store8
         ;;@ core/debug/debug-graphics.ts:166:8
         (tee_local $2
          ;;@ core/debug/debug-graphics.ts:166:26
          (i32.add
           (get_local $7)
           (i32.const 232448)
          )
         )
         (get_local $6)
        )
        ;;@ core/debug/debug-graphics.ts:168:8
        (i32.store8
         ;;@ core/debug/debug-graphics.ts:168:18
         (i32.add
          (get_local $2)
          ;;@ core/debug/debug-graphics.ts:168:27
          (i32.const 1)
         )
         (get_local $3)
        )
        ;;@ core/debug/debug-graphics.ts:169:8
        (i32.store8
         ;;@ core/debug/debug-graphics.ts:169:18
         (i32.add
          (get_local $2)
          ;;@ core/debug/debug-graphics.ts:169:27
          (i32.const 2)
         )
         (get_local $1)
        )
       )
       ;;@ core/debug/debug-graphics.ts:170:13
       (block
        ;;@ core/debug/debug-graphics.ts:173:8
        (set_local $2
         ;;@ core/debug/debug-graphics.ts:173:35
         (call $core/graphics/palette/getMonochromeColorFromPalette
          (get_local $1)
          (i32.const 65351)
          ;;@ core/graphics/palette.ts:37:43
          (i32.const 0)
         )
        )
        ;;@ core/debug/debug-graphics.ts:175:8
        (block $break|2
         ;;@ core/debug/debug-graphics.ts:175:13
         (set_local $1
          ;;@ core/debug/debug-graphics.ts:175:26
          (i32.const 0)
         )
         (loop $repeat|2
          (br_if $break|2
           ;;@ core/debug/debug-graphics.ts:175:29
           (i32.ge_s
            (get_local $1)
            ;;@ core/debug/debug-graphics.ts:175:33
            (i32.const 3)
           )
          )
          ;;@ core/debug/debug-graphics.ts:177:10
          (i32.store8
           ;;@ core/debug/debug-graphics.ts:176:28
           (i32.add
            (i32.add
             (get_local $7)
             (i32.const 232448)
            )
            (get_local $1)
           )
           (get_local $2)
          )
          ;;@ core/debug/debug-graphics.ts:175:36
          (set_local $1
           (i32.add
            (get_local $1)
            (i32.const 1)
           )
          )
          (br $repeat|2)
         )
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:45:34
      (set_local $5
       (i32.add
        (get_local $5)
        (i32.const 1)
       )
      )
      (br $repeat|1)
     )
    )
    ;;@ core/debug/debug-graphics.ts:44:32
    (set_local $4
     (i32.add
      (get_local $4)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
 )
 (func $core/graphics/tiles/drawPixelsFromLineOfTile|trampoline (; 282 ;) (; has Stack IR ;) (type $iiiiiiiiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (param $12 i32) (result i32)
  (block $3of3
   (block $2of3
    (block $1of3
     (block $0of3
      (block $outOfRange
       (br_table $0of3 $1of3 $2of3 $3of3 $outOfRange
        (i32.sub
         (get_global $~argc)
         (i32.const 10)
        )
       )
      )
      (unreachable)
     )
     (set_local $10
      ;;@ core/graphics/tiles.ts:36:53
      (i32.const 0)
     )
    )
    (set_local $11
     ;;@ core/graphics/tiles.ts:37:25
     (i32.const 0)
    )
   )
   (set_local $12
    ;;@ core/graphics/tiles.ts:38:25
    (i32.const -1)
   )
  )
  (call $core/graphics/tiles/drawPixelsFromLineOfTile
   (get_local $0)
   (get_local $1)
   (get_local $2)
   (get_local $3)
   (get_local $4)
   (get_local $5)
   (get_local $6)
   (get_local $7)
   (get_local $8)
   (get_local $9)
   (get_local $10)
   (get_local $11)
   (get_local $12)
  )
 )
 (func $core/debug/debug-graphics/drawTileDataToWasmMemory (; 283 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  ;;@ core/debug/debug-graphics.ts:185:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/debug/debug-graphics.ts:185:38
     (i32.ge_s
      (get_local $2)
      ;;@ core/debug/debug-graphics.ts:185:57
      (i32.const 23)
     )
    )
    ;;@ core/debug/debug-graphics.ts:186:4
    (block $break|1
     ;;@ core/debug/debug-graphics.ts:186:9
     (set_local $0
      ;;@ core/debug/debug-graphics.ts:186:37
      (i32.const 0)
     )
     (loop $repeat|1
      (br_if $break|1
       ;;@ core/debug/debug-graphics.ts:186:40
       (i32.ge_s
        (get_local $0)
        ;;@ core/debug/debug-graphics.ts:186:59
        (i32.const 31)
       )
      )
      ;;@ core/debug/debug-graphics.ts:188:6
      (set_local $4
       ;;@ core/debug/debug-graphics.ts:188:28
       (i32.const 0)
      )
      ;;@ core/debug/debug-graphics.ts:189:6
      (if
       ;;@ core/debug/debug-graphics.ts:189:10
       (i32.gt_s
        (get_local $0)
        ;;@ core/debug/debug-graphics.ts:189:29
        (i32.const 15)
       )
       ;;@ core/debug/debug-graphics.ts:189:35
       (set_local $4
        ;;@ core/debug/debug-graphics.ts:190:21
        (i32.const 1)
       )
      )
      ;;@ core/debug/debug-graphics.ts:194:6
      (set_local $1
       (get_local $2)
      )
      ;;@ core/debug/debug-graphics.ts:195:6
      (if
       ;;@ core/debug/debug-graphics.ts:195:10
       (i32.gt_s
        (get_local $2)
        ;;@ core/debug/debug-graphics.ts:195:29
        (i32.const 15)
       )
       ;;@ core/debug/debug-graphics.ts:195:35
       (set_local $1
        (i32.sub
         (get_local $1)
         ;;@ core/debug/debug-graphics.ts:196:18
         (i32.const 15)
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:198:6
      (set_local $1
       ;;@ core/debug/debug-graphics.ts:198:15
       (i32.shl
        (get_local $1)
        ;;@ core/debug/debug-graphics.ts:198:25
        (i32.const 4)
       )
      )
      (set_local $1
       ;;@ core/debug/debug-graphics.ts:199:6
       (if (result i32)
        ;;@ core/debug/debug-graphics.ts:199:10
        (i32.gt_s
         (get_local $0)
         ;;@ core/debug/debug-graphics.ts:199:29
         (i32.const 15)
        )
        ;;@ core/debug/debug-graphics.ts:200:17
        (i32.add
         (get_local $1)
         ;;@ core/debug/debug-graphics.ts:200:26
         (i32.sub
          (get_local $0)
          ;;@ core/debug/debug-graphics.ts:200:46
          (i32.const 15)
         )
        )
        ;;@ core/debug/debug-graphics.ts:202:17
        (i32.add
         (get_local $1)
         (get_local $0)
        )
       )
      )
      ;;@ core/debug/debug-graphics.ts:206:6
      (set_local $5
       (i32.const 32768)
      )
      ;;@ core/debug/debug-graphics.ts:207:6
      (if
       ;;@ core/debug/debug-graphics.ts:207:10
       (i32.gt_s
        (get_local $2)
        ;;@ core/debug/debug-graphics.ts:207:29
        (i32.const 15)
       )
       ;;@ core/debug/debug-graphics.ts:207:35
       (set_local $5
        (i32.const 34816)
       )
      )
      ;;@ core/debug/debug-graphics.ts:212:6
      (block $break|2
       ;;@ core/debug/debug-graphics.ts:212:11
       (set_local $3
        ;;@ core/debug/debug-graphics.ts:212:32
        (i32.const 0)
       )
       (loop $repeat|2
        (br_if $break|2
         ;;@ core/debug/debug-graphics.ts:212:35
         (i32.ge_s
          (get_local $3)
          ;;@ core/debug/debug-graphics.ts:212:47
          (i32.const 8)
         )
        )
        (set_global $~argc
         (i32.const 11)
        )
        (drop
         (call $core/graphics/tiles/drawPixelsFromLineOfTile|trampoline
          (get_local $1)
          (get_local $5)
          (get_local $4)
          ;;@ core/debug/debug-graphics.ts:217:10
          (i32.const 0)
          ;;@ core/debug/debug-graphics.ts:218:10
          (i32.const 7)
          (get_local $3)
          ;;@ core/debug/debug-graphics.ts:220:10
          (i32.shl
           (get_local $0)
           ;;@ core/debug/debug-graphics.ts:220:29
           (i32.const 3)
          )
          ;;@ core/debug/debug-graphics.ts:221:10
          (i32.add
           (i32.shl
            (get_local $2)
            ;;@ core/debug/debug-graphics.ts:221:29
            (i32.const 3)
           )
           (get_local $3)
          )
          (i32.const 248)
          (i32.const 429056)
          ;;@ core/debug/debug-graphics.ts:224:10
          (i32.const 1)
          (i32.const 0)
          (i32.const 0)
         )
        )
        ;;@ core/debug/debug-graphics.ts:212:50
        (set_local $3
         (i32.add
          (get_local $3)
          (i32.const 1)
         )
        )
        (br $repeat|2)
       )
      )
      ;;@ core/debug/debug-graphics.ts:186:65
      (set_local $0
       (i32.add
        (get_local $0)
        (i32.const 1)
       )
      )
      (br $repeat|1)
     )
    )
    ;;@ core/debug/debug-graphics.ts:185:63
    (set_local $2
     (i32.add
      (get_local $2)
      (i32.const 1)
     )
    )
    (br $repeat|0)
   )
  )
 )
 (func $core/debug/debug-timer/getDIV (; 284 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-timer.ts:5:16
  (get_global $core/timers/timers/Timers.dividerRegister)
 )
 (func $core/debug/debug-timer/getTIMA (; 285 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-timer.ts:9:16
  (get_global $core/timers/timers/Timers.timerCounter)
 )
 (func $core/debug/debug-timer/getTMA (; 286 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-timer.ts:13:16
  (get_global $core/timers/timers/Timers.timerModulo)
 )
 (func $core/debug/debug-timer/getTAC (; 287 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/debug/debug-timer.ts:17:2
  (set_local $0
   ;;@ core/debug/debug-timer.ts:17:22
   (get_global $core/timers/timers/Timers.timerInputClock)
  )
  ;;@ core/debug/debug-timer.ts:19:2
  (if
   ;;@ core/debug/debug-timer.ts:19:6
   (get_global $core/timers/timers/Timers.timerEnabled)
   ;;@ core/debug/debug-timer.ts:19:27
   (set_local $0
    ;;@ core/debug/debug-timer.ts:20:15
    (call $core/helpers/index/setBitOnByte
     ;;@ core/debug/debug-timer.ts:20:28
     (i32.const 2)
     (get_local $0)
    )
   )
  )
  (get_local $0)
 )
 (func $start (; 288 ;) (; has Stack IR ;) (type $v)
  ;;@ core/core.ts:25:0
  (if
   ;;@ core/core.ts:25:4
   (i32.lt_s
    ;;@ core/core.ts:25:11
    (current_memory)
    (i32.const 139)
   )
   ;;@ core/core.ts:25:40
   (drop
    (grow_memory
     ;;@ core/core.ts:26:14
     (i32.sub
      (i32.const 139)
      ;;@ core/core.ts:26:42
      (current_memory)
     )
    )
   )
  )
 )
 (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory|trampoline (; 289 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (block $1of1
   (block $0of1
    (block $outOfRange
     (br_table $0of1 $1of1 $outOfRange
      (get_global $~argc)
     )
    )
    (unreachable)
   )
   (set_local $0
    ;;@ core/debug/debug-graphics.ts:22:63
    (i32.const 0)
   )
  )
  (call $core/debug/debug-graphics/drawBackgroundMapToWasmMemory
   (get_local $0)
  )
 )
 (func $~setargc (; 290 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (set_global $~argc
   (get_local $0)
  )
 )
)
