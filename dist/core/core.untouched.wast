(module
 (type $iiiiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $v (func))
 (type $ii (func (param i32) (result i32)))
 (type $iiv (func (param i32 i32)))
 (type $iv (func (param i32)))
 (type $iii (func (param i32 i32) (result i32)))
 (type $i (func (result i32)))
 (type $iiii (func (param i32 i32 i32) (result i32)))
 (type $iiiv (func (param i32 i32 i32)))
 (type $iiiiiiv (func (param i32 i32 i32 i32 i32 i32)))
 (type $iiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $iiiiv (func (param i32 i32 i32 i32)))
 (type $iiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $iiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32)))
 (type $iiiii (func (param i32 i32 i32 i32) (result i32)))
 (type $iiiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
 (global $core/constants/WASMBOY_MEMORY_LOCATION i32 (i32.const 0))
 (global $core/constants/WASMBOY_MEMORY_SIZE i32 (i32.const 9175040))
 (global $core/constants/WASMBOY_WASM_PAGES i32 (i32.const 140))
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
 (global $core/constants/DEBUG_GAMEBOY_MEMORY_LOCATION i32 (i32.const 9109504))
 (global $core/constants/DEBUG_GAMEBOY_MEMORY_SIZE i32 (i32.const 65535))
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
 (global $core/cpu/cpu/Cpu.isHaltNormal (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.isHaltNoJump (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.isHaltBug (mut i32) (i32.const 0))
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
 (global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.currentCycles (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.dividerRegister (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounter (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerModulo (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerEnabled (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerInputClock (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounterOverflowDelay (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounterWasReset (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.currentCycles (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.numberOfBitsTransferred (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.isShiftClockInternal (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.isClockSpeedFast (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.transferStartFlag (mut i32) (i32.const 0))
 (global $core/cycles/Cycles.cyclesPerCycleSet (mut i32) (i32.const 2000000000))
 (global $core/cycles/Cycles.cycleSets (mut i32) (i32.const 0))
 (global $core/cycles/Cycles.cycles (mut i32) (i32.const 0))
 (global $core/execute/Execute.stepsPerStepSet (mut i32) (i32.const 2000000000))
 (global $core/execute/Execute.stepSets (mut i32) (i32.const 0))
 (global $core/execute/Execute.steps (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.currentLcdMode (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.volume (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.dutyCycle (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.waveFormPositionOnDuty (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isSweepEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.sweepCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.sweepShadowFrequency (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.volume (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.dutyCycle (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.waveFormPositionOnDuty (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.waveTablePosition (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.volume (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.linearFeedbackShiftRegister (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.enabled (mut i32) (i32.const 1))
 (global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.windowDisplayEnabled (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgWindowTileDataSelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.tallSpriteSize (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.spriteDisplayEnable (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgDisplayEnabled (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.joypadRegisterFlipped (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.isDpadType (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.isButtonType (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.DMACycles (mut i32) (i32.const 0))
 (global $core/graphics/tiles/TileCache.tileId (mut i32) (i32.const -1))
 (global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck (mut i32) (i32.const -1))
 (global $core/memory/memory/Memory.isHblankHdmaActive (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaSource (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaDestination (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0SweepPeriod (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0SweepShift (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0Negate (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx3FrequencyLSB (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx4FrequencyMSB (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx1Duty (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx1Duty (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.volumeCode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.divisor (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3ClockShift (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3WidthMode (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.downSampleCycleMultiplier (mut i32) (i32.const 48000))
 (global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize (mut i32) (i32.const 131072))
 (global $core/joypad/joypad/Joypad.up (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.right (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.down (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.left (mut i32) (i32.const 0))
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
 (global $core/legacy/wasmMemorySize i32 (i32.const 9175040))
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
 (global $~argc (mut i32) (i32.const 0))
 (memory $0 0)
 (export "memory" (memory $0))
 (export "config" (func $core/core/config))
 (export "hasCoreStarted" (func $core/core/hasCoreStarted))
 (export "saveState" (func $core/core/saveState))
 (export "loadState" (func $core/core/loadState))
 (export "getStepsPerStepSet" (func $core/execute/getStepsPerStepSet))
 (export "getStepSets" (func $core/execute/getStepSets))
 (export "getSteps" (func $core/execute/getSteps))
 (export "executeMultipleFrames" (func $core/execute/executeMultipleFrames))
 (export "executeFrame" (func $core/execute/executeFrame))
 (export "_setargc" (func $~setargc))
 (export "executeFrameAndCheckAudio" (func $core/execute/executeFrameAndCheckAudio|trampoline))
 (export "executeFrameUntilBreakpoint" (func $core/execute/executeFrameUntilBreakpoint))
 (export "executeUntilCondition" (func $core/execute/executeUntilCondition|trampoline))
 (export "executeStep" (func $core/execute/executeStep))
 (export "getCyclesPerCycleSet" (func $core/cycles/getCyclesPerCycleSet))
 (export "getCycleSets" (func $core/cycles/getCycleSets))
 (export "getCycles" (func $core/cycles/getCycles))
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
 (export "DEBUG_GAMEBOY_MEMORY_LOCATION" (global $core/constants/DEBUG_GAMEBOY_MEMORY_LOCATION))
 (export "DEBUG_GAMEBOY_MEMORY_SIZE" (global $core/constants/DEBUG_GAMEBOY_MEMORY_SIZE))
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
 (export "drawBackgroundMapToWasmMemory" (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory))
 (export "drawTileDataToWasmMemory" (func $core/debug/debug-graphics/drawTileDataToWasmMemory))
 (export "getDIV" (func $core/debug/debug-timer/getDIV))
 (export "getTIMA" (func $core/debug/debug-timer/getTIMA))
 (export "getTMA" (func $core/debug/debug-timer/getTMA))
 (export "getTAC" (func $core/debug/debug-timer/getTAC))
 (export "updateDebugGBMemory" (func $core/debug/debug-memory/updateDebugGBMemory))
 (export "update" (func $core/execute/executeFrame))
 (export "emulationStep" (func $core/execute/executeStep))
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
  ;;@ core/cpu/cpu.ts:158:2
  (set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   ;;@ core/cpu/cpu.ts:158:23
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:159:2
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/cpu.ts:159:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:160:2
  (set_global $core/cpu/cpu/Cpu.registerB
   ;;@ core/cpu/cpu.ts:160:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:161:2
  (set_global $core/cpu/cpu/Cpu.registerC
   ;;@ core/cpu/cpu.ts:161:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:162:2
  (set_global $core/cpu/cpu/Cpu.registerD
   ;;@ core/cpu/cpu.ts:162:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:163:2
  (set_global $core/cpu/cpu/Cpu.registerE
   ;;@ core/cpu/cpu.ts:163:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:164:2
  (set_global $core/cpu/cpu/Cpu.registerH
   ;;@ core/cpu/cpu.ts:164:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:165:2
  (set_global $core/cpu/cpu/Cpu.registerL
   ;;@ core/cpu/cpu.ts:165:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:166:2
  (set_global $core/cpu/cpu/Cpu.registerF
   ;;@ core/cpu/cpu.ts:166:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:167:2
  (set_global $core/cpu/cpu/Cpu.stackPointer
   ;;@ core/cpu/cpu.ts:167:21
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:168:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/cpu.ts:168:23
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:169:2
  (set_global $core/cpu/cpu/Cpu.currentCycles
   ;;@ core/cpu/cpu.ts:169:22
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:170:2
  (set_global $core/cpu/cpu/Cpu.isHaltNormal
   ;;@ core/cpu/cpu.ts:170:21
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:171:2
  (set_global $core/cpu/cpu/Cpu.isHaltNoJump
   ;;@ core/cpu/cpu.ts:171:21
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:172:2
  (set_global $core/cpu/cpu/Cpu.isHaltBug
   ;;@ core/cpu/cpu.ts:172:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:173:2
  (set_global $core/cpu/cpu/Cpu.isStopped
   ;;@ core/cpu/cpu.ts:173:18
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:175:2
  (if
   ;;@ core/cpu/cpu.ts:175:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/cpu/cpu.ts:175:22
   (block
    ;;@ core/cpu/cpu.ts:177:4
    (set_global $core/cpu/cpu/Cpu.registerA
     ;;@ core/cpu/cpu.ts:177:20
     (i32.const 17)
    )
    ;;@ core/cpu/cpu.ts:178:4
    (set_global $core/cpu/cpu/Cpu.registerF
     ;;@ core/cpu/cpu.ts:178:20
     (i32.const 128)
    )
    ;;@ core/cpu/cpu.ts:179:4
    (set_global $core/cpu/cpu/Cpu.registerB
     ;;@ core/cpu/cpu.ts:179:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:180:4
    (set_global $core/cpu/cpu/Cpu.registerC
     ;;@ core/cpu/cpu.ts:180:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:181:4
    (set_global $core/cpu/cpu/Cpu.registerD
     ;;@ core/cpu/cpu.ts:181:20
     (i32.const 255)
    )
    ;;@ core/cpu/cpu.ts:182:4
    (set_global $core/cpu/cpu/Cpu.registerE
     ;;@ core/cpu/cpu.ts:182:20
     (i32.const 86)
    )
    ;;@ core/cpu/cpu.ts:183:4
    (set_global $core/cpu/cpu/Cpu.registerH
     ;;@ core/cpu/cpu.ts:183:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:184:4
    (set_global $core/cpu/cpu/Cpu.registerL
     ;;@ core/cpu/cpu.ts:184:20
     (i32.const 13)
    )
   )
   ;;@ core/cpu/cpu.ts:189:9
   (block
    ;;@ core/cpu/cpu.ts:191:4
    (set_global $core/cpu/cpu/Cpu.registerA
     ;;@ core/cpu/cpu.ts:191:20
     (i32.const 1)
    )
    ;;@ core/cpu/cpu.ts:192:4
    (set_global $core/cpu/cpu/Cpu.registerF
     ;;@ core/cpu/cpu.ts:192:20
     (i32.const 176)
    )
    ;;@ core/cpu/cpu.ts:193:4
    (set_global $core/cpu/cpu/Cpu.registerB
     ;;@ core/cpu/cpu.ts:193:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:194:4
    (set_global $core/cpu/cpu/Cpu.registerC
     ;;@ core/cpu/cpu.ts:194:20
     (i32.const 19)
    )
    ;;@ core/cpu/cpu.ts:195:4
    (set_global $core/cpu/cpu/Cpu.registerD
     ;;@ core/cpu/cpu.ts:195:20
     (i32.const 0)
    )
    ;;@ core/cpu/cpu.ts:196:4
    (set_global $core/cpu/cpu/Cpu.registerE
     ;;@ core/cpu/cpu.ts:196:20
     (i32.const 216)
    )
    ;;@ core/cpu/cpu.ts:197:4
    (set_global $core/cpu/cpu/Cpu.registerH
     ;;@ core/cpu/cpu.ts:197:20
     (i32.const 1)
    )
    ;;@ core/cpu/cpu.ts:198:4
    (set_global $core/cpu/cpu/Cpu.registerL
     ;;@ core/cpu/cpu.ts:198:20
     (i32.const 77)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:187:4
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/cpu.ts:187:25
   (i32.const 256)
  )
  ;;@ core/cpu/cpu.ts:188:4
  (set_global $core/cpu/cpu/Cpu.stackPointer
   ;;@ core/cpu/cpu.ts:188:23
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
  ;;@ core/graphics/graphics.ts:144:2
  (set_global $core/graphics/graphics/Graphics.currentCycles
   ;;@ core/graphics/graphics.ts:144:27
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:145:2
  (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   ;;@ core/graphics/graphics.ts:145:34
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:146:2
  (set_global $core/graphics/graphics/Graphics.scanlineRegister
   ;;@ core/graphics/graphics.ts:146:30
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:147:2
  (set_global $core/graphics/graphics/Graphics.scrollX
   ;;@ core/graphics/graphics.ts:147:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:148:2
  (set_global $core/graphics/graphics/Graphics.scrollY
   ;;@ core/graphics/graphics.ts:148:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:149:2
  (set_global $core/graphics/graphics/Graphics.windowX
   ;;@ core/graphics/graphics.ts:149:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:150:2
  (set_global $core/graphics/graphics/Graphics.windowY
   ;;@ core/graphics/graphics.ts:150:21
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:152:2
  (if
   ;;@ core/graphics/graphics.ts:152:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/graphics/graphics.ts:152:22
   (block
    ;;@ core/graphics/graphics.ts:154:4
    (set_global $core/graphics/graphics/Graphics.scanlineRegister
     ;;@ core/graphics/graphics.ts:154:32
     (i32.const 144)
    )
    ;;@ core/graphics/graphics.ts:155:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:155:30
     (i32.const 65344)
     ;;@ core/graphics/graphics.ts:155:38
     (i32.const 145)
    )
    ;;@ core/graphics/graphics.ts:156:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:156:30
     (i32.const 65345)
     ;;@ core/graphics/graphics.ts:156:38
     (i32.const 129)
    )
    ;;@ core/graphics/graphics.ts:158:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:158:30
     (i32.const 65348)
     ;;@ core/graphics/graphics.ts:158:38
     (i32.const 144)
    )
    ;;@ core/graphics/graphics.ts:160:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:160:30
     (i32.const 65351)
     ;;@ core/graphics/graphics.ts:160:38
     (i32.const 252)
    )
   )
   ;;@ core/graphics/graphics.ts:166:9
   (block
    ;;@ core/graphics/graphics.ts:167:4
    (set_global $core/graphics/graphics/Graphics.scanlineRegister
     ;;@ core/graphics/graphics.ts:167:32
     (i32.const 144)
    )
    ;;@ core/graphics/graphics.ts:168:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:168:30
     (i32.const 65344)
     ;;@ core/graphics/graphics.ts:168:38
     (i32.const 145)
    )
    ;;@ core/graphics/graphics.ts:169:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:169:30
     (i32.const 65345)
     ;;@ core/graphics/graphics.ts:169:38
     (i32.const 133)
    )
    ;;@ core/graphics/graphics.ts:171:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:171:30
     (i32.const 65350)
     ;;@ core/graphics/graphics.ts:171:38
     (i32.const 255)
    )
    ;;@ core/graphics/graphics.ts:172:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:172:30
     (i32.const 65351)
     ;;@ core/graphics/graphics.ts:172:38
     (i32.const 252)
    )
    ;;@ core/graphics/graphics.ts:173:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:173:30
     (i32.const 65352)
     ;;@ core/graphics/graphics.ts:173:38
     (i32.const 255)
    )
    ;;@ core/graphics/graphics.ts:174:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/graphics/graphics.ts:174:30
     (i32.const 65353)
     ;;@ core/graphics/graphics.ts:174:38
     (i32.const 255)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:164:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/graphics/graphics.ts:164:30
   (i32.const 65359)
   ;;@ core/graphics/graphics.ts:164:38
   (i32.const 0)
  )
  ;;@ core/graphics/graphics.ts:165:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   ;;@ core/graphics/graphics.ts:165:30
   (i32.const 65392)
   ;;@ core/graphics/graphics.ts:165:38
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
  ;;@ core/sound/channel3.ts:113:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65306)
   ;;@ core/sound/channel3.ts:113:59
   (i32.const 127)
  )
  ;;@ core/sound/channel3.ts:114:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65307)
   ;;@ core/sound/channel3.ts:114:59
   (i32.const 255)
  )
  ;;@ core/sound/channel3.ts:115:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65308)
   ;;@ core/sound/channel3.ts:115:59
   (i32.const 159)
  )
  ;;@ core/sound/channel3.ts:116:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65309)
   ;;@ core/sound/channel3.ts:116:59
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:117:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65310)
   ;;@ core/sound/channel3.ts:117:59
   (i32.const 184)
  )
  ;;@ core/sound/channel3.ts:120:4
  (set_global $core/sound/channel3/Channel3.volumeCodeChanged
   ;;@ core/sound/channel3.ts:120:33
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
  ;;@ core/sound/accumulator.ts:29:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
   ;;@ core/sound/accumulator.ts:29:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:30:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
   ;;@ core/sound/accumulator.ts:30:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:31:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
   ;;@ core/sound/accumulator.ts:31:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:32:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
   ;;@ core/sound/accumulator.ts:32:36
   (i32.const 15)
  )
  ;;@ core/sound/accumulator.ts:33:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
   ;;@ core/sound/accumulator.ts:33:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:34:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
   ;;@ core/sound/accumulator.ts:34:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:35:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
   ;;@ core/sound/accumulator.ts:35:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:36:2
  (set_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
   ;;@ core/sound/accumulator.ts:36:40
   (i32.const 0)
  )
  ;;@ core/sound/accumulator.ts:37:2
  (set_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
   ;;@ core/sound/accumulator.ts:37:51
   (i32.const 127)
  )
  ;;@ core/sound/accumulator.ts:38:2
  (set_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
   ;;@ core/sound/accumulator.ts:38:52
   (i32.const 127)
  )
  ;;@ core/sound/accumulator.ts:39:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
   ;;@ core/sound/accumulator.ts:39:40
   (i32.const 1)
  )
  ;;@ core/sound/accumulator.ts:40:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
   ;;@ core/sound/accumulator.ts:40:41
   (i32.const 1)
  )
  ;;@ core/sound/accumulator.ts:41:2
  (set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
   ;;@ core/sound/accumulator.ts:41:40
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
 (func $core/helpers/index/checkBitOnByte (; 16 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/interrupts/interrupts/Interrupts.updateInterruptEnabled (; 17 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/interrupts/interrupts.ts:35:4
  (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:35:42
   (call $core/helpers/index/checkBitOnByte
    (i32.const 0)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:36:4
  (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:36:39
   (call $core/helpers/index/checkBitOnByte
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:37:4
  (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:37:41
   (call $core/helpers/index/checkBitOnByte
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:38:4
  (set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:38:42
   (call $core/helpers/index/checkBitOnByte
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:39:4
  (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:39:42
   (call $core/helpers/index/checkBitOnByte
    (i32.const 4)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:41:4
  (set_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
   (get_local $0)
  )
 )
 (func $core/interrupts/interrupts/Interrupts.updateInterruptRequested (; 18 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/interrupts/interrupts.ts:53:4
  (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
   ;;@ core/interrupts/interrupts.ts:53:44
   (call $core/helpers/index/checkBitOnByte
    (i32.const 0)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:54:4
  (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
   ;;@ core/interrupts/interrupts.ts:54:41
   (call $core/helpers/index/checkBitOnByte
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:55:4
  (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
   ;;@ core/interrupts/interrupts.ts:55:43
   (call $core/helpers/index/checkBitOnByte
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:56:4
  (set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
   ;;@ core/interrupts/interrupts.ts:56:44
   (call $core/helpers/index/checkBitOnByte
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:57:4
  (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
   ;;@ core/interrupts/interrupts.ts:57:44
   (call $core/helpers/index/checkBitOnByte
    (i32.const 4)
    (get_local $0)
   )
  )
  ;;@ core/interrupts/interrupts.ts:59:4
  (set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   (get_local $0)
  )
 )
 (func $core/interrupts/interrupts/initializeInterrupts (; 19 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:92:13
  (call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:92:36
   (i32.const 0)
  )
  ;;@ core/interrupts/interrupts.ts:93:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65535)
   ;;@ core/interrupts/interrupts.ts:93:71
   (get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue)
  )
  ;;@ core/interrupts/interrupts.ts:96:13
  (call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
   ;;@ core/interrupts/interrupts.ts:96:38
   (i32.const 225)
  )
  ;;@ core/interrupts/interrupts.ts:97:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65295)
   ;;@ core/interrupts/interrupts.ts:97:71
   (get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue)
  )
 )
 (func $core/timers/timers/initializeTimers (; 20 ;) (; has Stack IR ;) (type $v)
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
 (func $core/serial/serial/Serial.updateTransferControl (; 21 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/serial/serial.ts:33:4
  (set_global $core/serial/serial/Serial.isShiftClockInternal
   ;;@ core/serial/serial.ts:33:34
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/serial/serial.ts:33:49
    (i32.const 0)
    (get_local $0)
   )
  )
  ;;@ core/serial/serial.ts:34:4
  (set_global $core/serial/serial/Serial.isClockSpeedFast
   ;;@ core/serial/serial.ts:34:30
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/serial/serial.ts:34:45
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/serial/serial.ts:35:4
  (set_global $core/serial/serial/Serial.transferStartFlag
   ;;@ core/serial/serial.ts:35:31
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/serial/serial.ts:35:46
    (i32.const 7)
    (get_local $0)
   )
  )
  (i32.const 1)
 )
 (func $core/serial/serial/initializeSerial (; 22 ;) (; has Stack IR ;) (type $v)
  ;;@ core/serial/serial.ts:44:2
  (set_global $core/serial/serial/Serial.currentCycles
   ;;@ core/serial/serial.ts:44:25
   (i32.const 0)
  )
  ;;@ core/serial/serial.ts:45:2
  (set_global $core/serial/serial/Serial.numberOfBitsTransferred
   ;;@ core/serial/serial.ts:45:35
   (i32.const 0)
  )
  ;;@ core/serial/serial.ts:47:2
  (if
   ;;@ core/serial/serial.ts:47:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/serial/serial.ts:47:22
   (block
    ;;@ core/serial/serial.ts:49:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/serial/serial.ts:49:30
     (i32.const 65282)
     ;;@ core/serial/serial.ts:49:38
     (i32.const 124)
    )
    ;;@ core/serial/serial.ts:50:11
    (drop
     (call $core/serial/serial/Serial.updateTransferControl
      ;;@ core/serial/serial.ts:50:33
      (i32.const 124)
     )
    )
   )
   ;;@ core/serial/serial.ts:51:9
   (block
    ;;@ core/serial/serial.ts:53:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/serial/serial.ts:53:30
     (i32.const 65282)
     ;;@ core/serial/serial.ts:53:38
     (i32.const 126)
    )
    ;;@ core/serial/serial.ts:54:11
    (drop
     (call $core/serial/serial/Serial.updateTransferControl
      ;;@ core/serial/serial.ts:54:33
      (i32.const 126)
     )
    )
   )
  )
 )
 (func $core/core/setHasCoreStarted (; 23 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/core.ts:25:2
  (set_global $core/core/hasStarted
   (i32.and
    (get_local $0)
    (i32.const 1)
   )
  )
 )
 (func $core/cycles/resetCycles (; 24 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cycles.ts:43:2
  (set_global $core/cycles/Cycles.cyclesPerCycleSet
   ;;@ core/cycles.ts:43:29
   (i32.const 2000000000)
  )
  ;;@ core/cycles.ts:44:2
  (set_global $core/cycles/Cycles.cycleSets
   ;;@ core/cycles.ts:44:21
   (i32.const 0)
  )
  ;;@ core/cycles.ts:45:2
  (set_global $core/cycles/Cycles.cycles
   ;;@ core/cycles.ts:45:18
   (i32.const 0)
  )
 )
 (func $core/execute/resetSteps (; 25 ;) (; has Stack IR ;) (type $v)
  ;;@ core/execute.ts:40:2
  (set_global $core/execute/Execute.stepsPerStepSet
   ;;@ core/execute.ts:40:28
   (i32.const 2000000000)
  )
  ;;@ core/execute.ts:41:2
  (set_global $core/execute/Execute.stepSets
   ;;@ core/execute.ts:41:21
   (i32.const 0)
  )
  ;;@ core/execute.ts:42:2
  (set_global $core/execute/Execute.steps
   ;;@ core/execute.ts:42:18
   (i32.const 0)
  )
 )
 (func $core/core/initialize (; 26 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/core.ts:119:6
  (if
   (i32.eqz
    (tee_local $0
     (i32.eq
      ;;@ core/core.ts:116:2
      (tee_local $1
       ;;@ core/core.ts:116:21
       (call $core/memory/load/eightBitLoadFromGBMemory
        ;;@ core/core.ts:116:46
        (i32.const 323)
       )
      )
      ;;@ core/core.ts:119:18
      (i32.const 192)
     )
    )
   )
   (set_local $0
    ;;@ core/core.ts:119:26
    (if (result i32)
     ;;@ core/core.ts:119:27
     (get_global $core/config/Config.useGbcWhenAvailable)
     ;;@ core/core.ts:119:57
     (i32.eq
      (get_local $1)
      ;;@ core/core.ts:119:69
      (i32.const 128)
     )
     (get_global $core/config/Config.useGbcWhenAvailable)
    )
   )
  )
  ;;@ core/core.ts:119:2
  (if
   (get_local $0)
   ;;@ core/core.ts:119:76
   (set_global $core/cpu/cpu/Cpu.GBCEnabled
    ;;@ core/core.ts:120:21
    (i32.const 1)
   )
   ;;@ core/core.ts:121:9
   (set_global $core/cpu/cpu/Cpu.GBCEnabled
    ;;@ core/core.ts:122:21
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:126:2
  (call $core/cpu/cpu/initializeCpu)
  ;;@ core/core.ts:127:2
  (call $core/memory/memory/initializeCartridge)
  ;;@ core/core.ts:128:2
  (call $core/memory/dma/initializeDma)
  ;;@ core/core.ts:129:2
  (call $core/graphics/graphics/initializeGraphics)
  ;;@ core/core.ts:130:2
  (call $core/graphics/palette/initializePalette)
  ;;@ core/core.ts:131:2
  (call $core/sound/sound/initializeSound)
  ;;@ core/core.ts:132:2
  (call $core/interrupts/interrupts/initializeInterrupts)
  ;;@ core/core.ts:133:2
  (call $core/timers/timers/initializeTimers)
  ;;@ core/core.ts:134:2
  (call $core/serial/serial/initializeSerial)
  ;;@ core/core.ts:137:2
  (if
   ;;@ core/core.ts:137:6
   (get_global $core/cpu/cpu/Cpu.GBCEnabled)
   ;;@ core/core.ts:137:22
   (block
    ;;@ core/core.ts:139:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:139:30
     (i32.const 65392)
     ;;@ core/core.ts:139:38
     (i32.const 248)
    )
    ;;@ core/core.ts:140:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:140:30
     (i32.const 65359)
     ;;@ core/core.ts:140:38
     (i32.const 254)
    )
    ;;@ core/core.ts:141:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:141:30
     (i32.const 65357)
     ;;@ core/core.ts:141:38
     (i32.const 126)
    )
    ;;@ core/core.ts:142:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:142:30
     (i32.const 65280)
     ;;@ core/core.ts:142:38
     (i32.const 207)
    )
    ;;@ core/core.ts:144:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:144:30
     (i32.const 65295)
     ;;@ core/core.ts:144:38
     (i32.const 225)
    )
    ;;@ core/core.ts:148:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:148:30
     (i32.const 65388)
     ;;@ core/core.ts:148:38
     (i32.const 254)
    )
    ;;@ core/core.ts:149:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:149:30
     (i32.const 65397)
     ;;@ core/core.ts:149:38
     (i32.const 143)
    )
   )
   ;;@ core/core.ts:150:9
   (block
    ;;@ core/core.ts:151:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:151:30
     (i32.const 65392)
     ;;@ core/core.ts:151:38
     (i32.const 255)
    )
    ;;@ core/core.ts:152:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:152:30
     (i32.const 65359)
     ;;@ core/core.ts:152:38
     (i32.const 255)
    )
    ;;@ core/core.ts:153:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:153:30
     (i32.const 65357)
     ;;@ core/core.ts:153:38
     (i32.const 255)
    )
    ;;@ core/core.ts:154:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:154:30
     (i32.const 65280)
     ;;@ core/core.ts:154:38
     (i32.const 207)
    )
    ;;@ core/core.ts:156:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     ;;@ core/core.ts:156:30
     (i32.const 65295)
     ;;@ core/core.ts:156:38
     (i32.const 225)
    )
   )
  )
  ;;@ core/core.ts:161:2
  (call $core/core/setHasCoreStarted
   ;;@ core/core.ts:161:20
   (i32.const 0)
  )
  ;;@ core/core.ts:164:2
  (call $core/cycles/resetCycles)
  ;;@ core/core.ts:165:2
  (call $core/execute/resetSteps)
 )
 (func $core/core/config (; 27 ;) (; has Stack IR ;) (type $iiiiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32)
  ;;@ core/core.ts:52:2
  (if
   ;;@ core/core.ts:52:6
   (i32.gt_s
    (get_local $0)
    ;;@ core/core.ts:52:22
    (i32.const 0)
   )
   ;;@ core/core.ts:52:25
   (set_global $core/config/Config.enableBootRom
    ;;@ core/core.ts:53:27
    (i32.const 1)
   )
   ;;@ core/core.ts:54:9
   (set_global $core/config/Config.enableBootRom
    ;;@ core/core.ts:55:27
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:58:2
  (if
   ;;@ core/core.ts:58:6
   (i32.gt_s
    (get_local $1)
    ;;@ core/core.ts:58:28
    (i32.const 0)
   )
   ;;@ core/core.ts:58:31
   (set_global $core/config/Config.useGbcWhenAvailable
    ;;@ core/core.ts:59:33
    (i32.const 1)
   )
   ;;@ core/core.ts:60:9
   (set_global $core/config/Config.useGbcWhenAvailable
    ;;@ core/core.ts:61:33
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:64:2
  (if
   ;;@ core/core.ts:64:6
   (i32.gt_s
    (get_local $2)
    ;;@ core/core.ts:64:29
    (i32.const 0)
   )
   ;;@ core/core.ts:64:32
   (set_global $core/config/Config.audioBatchProcessing
    ;;@ core/core.ts:65:34
    (i32.const 1)
   )
   ;;@ core/core.ts:66:9
   (set_global $core/config/Config.audioBatchProcessing
    ;;@ core/core.ts:67:34
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:70:2
  (if
   ;;@ core/core.ts:70:6
   (i32.gt_s
    (get_local $3)
    ;;@ core/core.ts:70:32
    (i32.const 0)
   )
   ;;@ core/core.ts:70:35
   (set_global $core/config/Config.graphicsBatchProcessing
    ;;@ core/core.ts:71:37
    (i32.const 1)
   )
   ;;@ core/core.ts:72:9
   (set_global $core/config/Config.graphicsBatchProcessing
    ;;@ core/core.ts:73:37
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:76:2
  (if
   ;;@ core/core.ts:76:6
   (i32.gt_s
    (get_local $4)
    ;;@ core/core.ts:76:30
    (i32.const 0)
   )
   ;;@ core/core.ts:76:33
   (set_global $core/config/Config.timersBatchProcessing
    ;;@ core/core.ts:77:35
    (i32.const 1)
   )
   ;;@ core/core.ts:78:9
   (set_global $core/config/Config.timersBatchProcessing
    ;;@ core/core.ts:79:35
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:82:2
  (if
   ;;@ core/core.ts:82:6
   (i32.gt_s
    (get_local $5)
    ;;@ core/core.ts:82:41
    (i32.const 0)
   )
   ;;@ core/core.ts:82:44
   (set_global $core/config/Config.graphicsDisableScanlineRendering
    ;;@ core/core.ts:83:46
    (i32.const 1)
   )
   ;;@ core/core.ts:84:9
   (set_global $core/config/Config.graphicsDisableScanlineRendering
    ;;@ core/core.ts:85:46
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:88:2
  (if
   ;;@ core/core.ts:88:6
   (i32.gt_s
    (get_local $6)
    ;;@ core/core.ts:88:31
    (i32.const 0)
   )
   ;;@ core/core.ts:88:34
   (set_global $core/config/Config.audioAccumulateSamples
    ;;@ core/core.ts:89:36
    (i32.const 1)
   )
   ;;@ core/core.ts:90:9
   (set_global $core/config/Config.audioAccumulateSamples
    ;;@ core/core.ts:91:36
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:94:2
  (if
   ;;@ core/core.ts:94:6
   (i32.gt_s
    (get_local $7)
    ;;@ core/core.ts:94:22
    (i32.const 0)
   )
   ;;@ core/core.ts:94:25
   (set_global $core/config/Config.tileRendering
    ;;@ core/core.ts:95:27
    (i32.const 1)
   )
   ;;@ core/core.ts:96:9
   (set_global $core/config/Config.tileRendering
    ;;@ core/core.ts:97:27
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:100:2
  (if
   ;;@ core/core.ts:100:6
   (i32.gt_s
    (get_local $8)
    ;;@ core/core.ts:100:20
    (i32.const 0)
   )
   ;;@ core/core.ts:100:23
   (set_global $core/config/Config.tileCaching
    ;;@ core/core.ts:101:25
    (i32.const 1)
   )
   ;;@ core/core.ts:102:9
   (set_global $core/config/Config.tileCaching
    ;;@ core/core.ts:103:25
    (i32.const 0)
   )
  )
  ;;@ core/core.ts:106:2
  (call $core/core/initialize)
 )
 (func $core/core/hasCoreStarted (; 28 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/core.ts:28:2
  (if
   ;;@ core/core.ts:28:6
   (get_global $core/core/hasStarted)
   (return
    (i32.const 1)
   )
  )
  (i32.const 0)
 )
 (func $core/core/getSaveStateMemoryOffset (; 29 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/core.ts:173:48
  (i32.add
   ;;@ core/core.ts:173:9
   (i32.add
    (get_local $0)
    (i32.const 1024)
   )
   ;;@ core/core.ts:173:43
   (i32.mul
    (get_local $1)
    (i32.const 50)
   )
  )
 )
 (func $core/memory/store/storeBooleanDirectlyToWasmMemory (; 30 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/cpu/cpu/Cpu.saveState (; 31 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cpu/cpu.ts:111:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:111:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:111:39
    (i32.const 0)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:111:65
   (get_global $core/cpu/cpu/Cpu.registerA)
  )
  ;;@ core/cpu/cpu.ts:112:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:112:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:112:39
    (i32.const 1)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:112:65
   (get_global $core/cpu/cpu/Cpu.registerB)
  )
  ;;@ core/cpu/cpu.ts:113:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:113:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:113:39
    (i32.const 2)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:113:65
   (get_global $core/cpu/cpu/Cpu.registerC)
  )
  ;;@ core/cpu/cpu.ts:114:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:114:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:114:39
    (i32.const 3)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:114:65
   (get_global $core/cpu/cpu/Cpu.registerD)
  )
  ;;@ core/cpu/cpu.ts:115:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:115:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:115:39
    (i32.const 4)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:115:65
   (get_global $core/cpu/cpu/Cpu.registerE)
  )
  ;;@ core/cpu/cpu.ts:116:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:116:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:116:39
    (i32.const 5)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:116:65
   (get_global $core/cpu/cpu/Cpu.registerH)
  )
  ;;@ core/cpu/cpu.ts:117:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:117:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:117:39
    (i32.const 6)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:117:65
   (get_global $core/cpu/cpu/Cpu.registerL)
  )
  ;;@ core/cpu/cpu.ts:118:4
  (i32.store8
   ;;@ core/cpu/cpu.ts:118:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:118:39
    (i32.const 7)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:118:65
   (get_global $core/cpu/cpu/Cpu.registerF)
  )
  ;;@ core/cpu/cpu.ts:120:4
  (i32.store16
   ;;@ core/cpu/cpu.ts:120:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:120:40
    (i32.const 8)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:120:66
   (get_global $core/cpu/cpu/Cpu.stackPointer)
  )
  ;;@ core/cpu/cpu.ts:121:4
  (i32.store16
   ;;@ core/cpu/cpu.ts:121:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:121:40
    (i32.const 10)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:121:66
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
  ;;@ core/cpu/cpu.ts:123:4
  (i32.store
   ;;@ core/cpu/cpu.ts:123:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:123:40
    (i32.const 12)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:123:66
   (get_global $core/cpu/cpu/Cpu.currentCycles)
  )
  ;;@ core/cpu/cpu.ts:125:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/cpu/cpu.ts:125:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:125:62
    (i32.const 17)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:125:88
   (get_global $core/cpu/cpu/Cpu.isHaltNormal)
  )
  ;;@ core/cpu/cpu.ts:126:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/cpu/cpu.ts:126:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:126:62
    (i32.const 18)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:126:88
   (get_global $core/cpu/cpu/Cpu.isHaltNoJump)
  )
  ;;@ core/cpu/cpu.ts:127:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/cpu/cpu.ts:127:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:127:62
    (i32.const 19)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:127:88
   (get_global $core/cpu/cpu/Cpu.isHaltBug)
  )
  ;;@ core/cpu/cpu.ts:128:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/cpu/cpu.ts:128:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/cpu/cpu.ts:128:62
    (i32.const 20)
    (i32.const 0)
   )
   ;;@ core/cpu/cpu.ts:128:88
   (get_global $core/cpu/cpu/Cpu.isStopped)
  )
 )
 (func $core/graphics/graphics/Graphics.saveState (; 32 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/graphics.ts:111:4
  (i32.store
   ;;@ core/graphics/graphics.ts:111:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/graphics/graphics.ts:111:40
    (i32.const 0)
    (i32.const 1)
   )
   ;;@ core/graphics/graphics.ts:111:71
   (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
  )
  ;;@ core/graphics/graphics.ts:112:4
  (i32.store8
   ;;@ core/graphics/graphics.ts:112:14
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/graphics/graphics.ts:112:39
    (i32.const 4)
    (i32.const 1)
   )
   ;;@ core/graphics/graphics.ts:112:70
   (get_global $core/graphics/lcd/Lcd.currentLcdMode)
  )
  ;;@ core/graphics/graphics.ts:114:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65348)
   ;;@ core/graphics/graphics.ts:114:71
   (get_global $core/graphics/graphics/Graphics.scanlineRegister)
  )
 )
 (func $core/interrupts/interrupts/Interrupts.saveState (; 33 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:72:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/interrupts/interrupts.ts:72:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/interrupts/interrupts.ts:72:62
    (i32.const 0)
    (i32.const 2)
   )
   ;;@ core/interrupts/interrupts.ts:72:95
   (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
  )
  ;;@ core/interrupts/interrupts.ts:73:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/interrupts/interrupts.ts:73:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/interrupts/interrupts.ts:73:62
    (i32.const 1)
    (i32.const 2)
   )
   ;;@ core/interrupts/interrupts.ts:73:95
   (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay)
  )
 )
 (func $core/joypad/joypad/Joypad.saveState (; 34 ;) (; has Stack IR ;) (type $v)
  (nop)
 )
 (func $core/memory/memory/Memory.saveState (; 35 ;) (; has Stack IR ;) (type $v)
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
 (func $core/timers/timers/Timers.saveState (; 36 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/sound/Sound.saveState (; 37 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel1/Channel1.saveState (; 38 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel2/Channel2.saveState (; 39 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel3/Channel3.saveState (; 40 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:98:4
  (call $core/memory/store/storeBooleanDirectlyToWasmMemory
   ;;@ core/sound/channel3.ts:98:37
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:98:62
    (i32.const 0)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:98:93
   (get_global $core/sound/channel3/Channel3.isEnabled)
  )
  ;;@ core/sound/channel3.ts:99:4
  (i32.store
   ;;@ core/sound/channel3.ts:99:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:99:40
    (i32.const 1)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:99:71
   (get_global $core/sound/channel3/Channel3.frequencyTimer)
  )
  ;;@ core/sound/channel3.ts:100:4
  (i32.store
   ;;@ core/sound/channel3.ts:100:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:100:40
    (i32.const 5)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:100:71
   (get_global $core/sound/channel3/Channel3.lengthCounter)
  )
  ;;@ core/sound/channel3.ts:101:4
  (i32.store16
   ;;@ core/sound/channel3.ts:101:15
   (call $core/core/getSaveStateMemoryOffset
    ;;@ core/sound/channel3.ts:101:40
    (i32.const 9)
    (i32.const 9)
   )
   ;;@ core/sound/channel3.ts:101:71
   (get_global $core/sound/channel3/Channel3.waveTablePosition)
  )
 )
 (func $core/sound/channel4/Channel4.saveState (; 41 ;) (; has Stack IR ;) (type $v)
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
 (func $core/core/saveState (; 42 ;) (; has Stack IR ;) (type $v)
  ;;@ core/core.ts:178:6
  (call $core/cpu/cpu/Cpu.saveState)
  ;;@ core/core.ts:179:11
  (call $core/graphics/graphics/Graphics.saveState)
  ;;@ core/core.ts:180:13
  (call $core/interrupts/interrupts/Interrupts.saveState)
  ;;@ core/core.ts:181:9
  (call $core/joypad/joypad/Joypad.saveState)
  ;;@ core/core.ts:182:9
  (call $core/memory/memory/Memory.saveState)
  ;;@ core/core.ts:183:9
  (call $core/timers/timers/Timers.saveState)
  ;;@ core/core.ts:184:8
  (call $core/sound/sound/Sound.saveState)
  ;;@ core/core.ts:185:11
  (call $core/sound/channel1/Channel1.saveState)
  ;;@ core/core.ts:186:11
  (call $core/sound/channel2/Channel2.saveState)
  ;;@ core/core.ts:187:11
  (call $core/sound/channel3/Channel3.saveState)
  ;;@ core/core.ts:188:11
  (call $core/sound/channel4/Channel4.saveState)
  ;;@ core/core.ts:191:2
  (call $core/core/setHasCoreStarted
   ;;@ core/core.ts:191:20
   (i32.const 0)
  )
 )
 (func $core/memory/load/loadBooleanDirectlyFromWasmMemory (; 43 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/cpu/Cpu.loadState (; 44 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cpu/cpu.ts:134:4
  (set_global $core/cpu/cpu/Cpu.registerA
   ;;@ core/cpu/cpu.ts:134:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:134:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:134:54
     (i32.const 0)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:135:4
  (set_global $core/cpu/cpu/Cpu.registerB
   ;;@ core/cpu/cpu.ts:135:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:135:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:135:54
     (i32.const 1)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:136:4
  (set_global $core/cpu/cpu/Cpu.registerC
   ;;@ core/cpu/cpu.ts:136:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:136:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:136:54
     (i32.const 2)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:137:4
  (set_global $core/cpu/cpu/Cpu.registerD
   ;;@ core/cpu/cpu.ts:137:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:137:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:137:54
     (i32.const 3)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:138:4
  (set_global $core/cpu/cpu/Cpu.registerE
   ;;@ core/cpu/cpu.ts:138:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:138:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:138:54
     (i32.const 4)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:139:4
  (set_global $core/cpu/cpu/Cpu.registerH
   ;;@ core/cpu/cpu.ts:139:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:139:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:139:54
     (i32.const 5)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:140:4
  (set_global $core/cpu/cpu/Cpu.registerL
   ;;@ core/cpu/cpu.ts:140:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:140:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:140:54
     (i32.const 6)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:141:4
  (set_global $core/cpu/cpu/Cpu.registerF
   ;;@ core/cpu/cpu.ts:141:20
   (i32.load8_u
    ;;@ core/cpu/cpu.ts:141:29
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:141:54
     (i32.const 7)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:143:4
  (set_global $core/cpu/cpu/Cpu.stackPointer
   ;;@ core/cpu/cpu.ts:143:23
   (i32.load16_u
    ;;@ core/cpu/cpu.ts:143:33
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:143:58
     (i32.const 8)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:144:4
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/cpu.ts:144:25
   (i32.load16_u
    ;;@ core/cpu/cpu.ts:144:35
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:144:60
     (i32.const 10)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:146:4
  (set_global $core/cpu/cpu/Cpu.currentCycles
   ;;@ core/cpu/cpu.ts:146:24
   (i32.load
    ;;@ core/cpu/cpu.ts:146:34
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:146:59
     (i32.const 12)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:148:4
  (set_global $core/cpu/cpu/Cpu.isHaltNormal
   ;;@ core/cpu/cpu.ts:148:23
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/cpu/cpu.ts:148:57
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:148:82
     (i32.const 17)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:149:4
  (set_global $core/cpu/cpu/Cpu.isHaltNoJump
   ;;@ core/cpu/cpu.ts:149:23
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/cpu/cpu.ts:149:57
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:149:82
     (i32.const 18)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:150:4
  (set_global $core/cpu/cpu/Cpu.isHaltBug
   ;;@ core/cpu/cpu.ts:150:20
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/cpu/cpu.ts:150:54
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:150:79
     (i32.const 19)
     (i32.const 0)
    )
   )
  )
  ;;@ core/cpu/cpu.ts:151:4
  (set_global $core/cpu/cpu/Cpu.isStopped
   ;;@ core/cpu/cpu.ts:151:20
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/cpu/cpu.ts:151:54
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/cpu/cpu.ts:151:79
     (i32.const 20)
     (i32.const 0)
    )
   )
  )
 )
 (func $core/helpers/index/resetBitOnByte (; 45 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/graphics/lcd/resetLcd (; 46 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/graphics/lcd.ts:89:2
  (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   ;;@ core/graphics/lcd.ts:89:34
   (i32.const 0)
  )
  ;;@ core/graphics/lcd.ts:90:2
  (set_global $core/graphics/graphics/Graphics.scanlineRegister
   ;;@ core/graphics/lcd.ts:90:30
   (i32.const 0)
  )
  ;;@ core/graphics/lcd.ts:91:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65348)
   ;;@ core/graphics/lcd.ts:91:69
   (i32.const 0)
  )
  ;;@ core/graphics/lcd.ts:97:2
  (set_local $1
   ;;@ core/graphics/lcd.ts:97:14
   (call $core/helpers/index/resetBitOnByte
    ;;@ core/graphics/lcd.ts:97:29
    (i32.const 0)
    ;;@ core/graphics/lcd.ts:96:14
    (call $core/helpers/index/resetBitOnByte
     ;;@ core/graphics/lcd.ts:96:29
     (i32.const 1)
     ;;@ core/graphics/lcd.ts:95:23
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.const 65345)
     )
    )
   )
  )
  ;;@ core/graphics/lcd.ts:98:2
  (set_global $core/graphics/lcd/Lcd.currentLcdMode
   ;;@ core/graphics/lcd.ts:98:23
   (i32.const 0)
  )
  ;;@ core/graphics/lcd.ts:101:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65345)
   (get_local $1)
  )
  ;;@ core/graphics/lcd.ts:104:2
  (if
   (i32.and
    (get_local $0)
    (i32.const 1)
   )
   ;;@ core/graphics/lcd.ts:104:25
   (block $break|0
    ;;@ core/graphics/lcd.ts:105:9
    (set_local $0
     ;;@ core/graphics/lcd.ts:105:17
     (i32.const 0)
    )
    (loop $repeat|0
     (br_if $break|0
      ;;@ core/graphics/lcd.ts:105:20
      (i32.ge_s
       (get_local $0)
       (i32.const 521216)
      )
     )
     ;;@ core/graphics/lcd.ts:106:6
     (i32.store8
      ;;@ core/graphics/lcd.ts:106:16
      (i32.add
       (get_local $0)
       (i32.const 67584)
      )
      ;;@ core/graphics/lcd.ts:106:46
      (i32.const 255)
     )
     ;;@ core/graphics/lcd.ts:105:46
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
 )
 (func $core/graphics/lcd/Lcd.updateLcdControl (; 47 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/graphics/lcd.ts:64:4
  (set_local $1
   ;;@ core/graphics/lcd.ts:64:24
   (get_global $core/graphics/lcd/Lcd.enabled)
  )
  ;;@ core/graphics/lcd.ts:66:4
  (set_global $core/graphics/lcd/Lcd.enabled
   ;;@ core/graphics/lcd.ts:66:18
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:66:33
    (i32.const 7)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:67:4
  (set_global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
   ;;@ core/graphics/lcd.ts:67:37
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:67:52
    (i32.const 6)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:68:4
  (set_global $core/graphics/lcd/Lcd.windowDisplayEnabled
   ;;@ core/graphics/lcd.ts:68:31
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:68:46
    (i32.const 5)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:69:4
  (set_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect
   ;;@ core/graphics/lcd.ts:69:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:69:48
    (i32.const 4)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:70:4
  (set_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
   ;;@ core/graphics/lcd.ts:70:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:70:48
    (i32.const 3)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:71:4
  (set_global $core/graphics/lcd/Lcd.tallSpriteSize
   ;;@ core/graphics/lcd.ts:71:25
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:71:40
    (i32.const 2)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:72:4
  (set_global $core/graphics/lcd/Lcd.spriteDisplayEnable
   ;;@ core/graphics/lcd.ts:72:30
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:72:45
    (i32.const 1)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:73:4
  (set_global $core/graphics/lcd/Lcd.bgDisplayEnabled
   ;;@ core/graphics/lcd.ts:73:27
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/graphics/lcd.ts:73:42
    (i32.const 0)
    (get_local $0)
   )
  )
  ;;@ core/graphics/lcd.ts:75:4
  (if
   (tee_local $0
    ;;@ core/graphics/lcd.ts:75:8
    (if (result i32)
     (get_local $1)
     ;;@ core/graphics/lcd.ts:75:25
     (i32.eqz
      ;;@ core/graphics/lcd.ts:75:26
      (get_global $core/graphics/lcd/Lcd.enabled)
     )
     (get_local $1)
    )
   )
   ;;@ core/graphics/lcd.ts:75:39
   (call $core/graphics/lcd/resetLcd
    ;;@ core/graphics/lcd.ts:77:15
    (i32.const 1)
   )
  )
  ;;@ core/graphics/lcd.ts:80:8
  (if
   (tee_local $0
    (i32.eqz
     (get_local $1)
    )
   )
   (set_local $0
    ;;@ core/graphics/lcd.ts:80:26
    (get_global $core/graphics/lcd/Lcd.enabled)
   )
  )
  ;;@ core/graphics/lcd.ts:80:4
  (if
   (get_local $0)
   ;;@ core/graphics/lcd.ts:80:39
   (call $core/graphics/lcd/resetLcd
    ;;@ core/graphics/lcd.ts:82:15
    (i32.const 0)
   )
  )
 )
 (func $core/graphics/graphics/Graphics.loadState (; 48 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/graphics.ts:119:4
  (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   ;;@ core/graphics/graphics.ts:119:36
   (i32.load
    ;;@ core/graphics/graphics.ts:119:46
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/graphics/graphics.ts:119:71
     (i32.const 0)
     (i32.const 1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:120:4
  (set_global $core/graphics/lcd/Lcd.currentLcdMode
   ;;@ core/graphics/graphics.ts:120:25
   (i32.load8_u
    ;;@ core/graphics/graphics.ts:120:34
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/graphics/graphics.ts:120:59
     (i32.const 4)
     (i32.const 1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:122:4
  (set_global $core/graphics/graphics/Graphics.scanlineRegister
   ;;@ core/graphics/graphics.ts:122:32
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65348)
   )
  )
  ;;@ core/graphics/graphics.ts:123:8
  (call $core/graphics/lcd/Lcd.updateLcdControl
   ;;@ core/graphics/graphics.ts:123:25
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65344)
   )
  )
 )
 (func $core/interrupts/interrupts/Interrupts.loadState (; 49 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:80:4
  (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
   ;;@ core/interrupts/interrupts.ts:80:39
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/interrupts/interrupts.ts:80:73
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/interrupts/interrupts.ts:80:98
     (i32.const 0)
     (i32.const 2)
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:81:4
  (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
   ;;@ core/interrupts/interrupts.ts:81:44
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/interrupts/interrupts.ts:81:78
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/interrupts/interrupts.ts:81:103
     (i32.const 1)
     (i32.const 2)
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:83:15
  (call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
   ;;@ core/interrupts/interrupts.ts:83:38
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65535)
   )
  )
  ;;@ core/interrupts/interrupts.ts:84:15
  (call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
   ;;@ core/interrupts/interrupts.ts:84:40
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65295)
   )
  )
 )
 (func $core/joypad/joypad/Joypad.updateJoypad (; 50 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/joypad/joypad/Joypad.loadState (; 51 ;) (; has Stack IR ;) (type $v)
  ;;@ core/joypad/joypad.ts:60:11
  (call $core/joypad/joypad/Joypad.updateJoypad
   ;;@ core/joypad/joypad.ts:60:24
   (call $core/memory/load/eightBitLoadFromGBMemory
    (i32.const 65280)
   )
  )
 )
 (func $core/memory/memory/Memory.loadState (; 52 ;) (; has Stack IR ;) (type $v)
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
 (func $core/timers/timers/Timers.loadState (; 53 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/sound/clearAudioBuffer (; 54 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/sound.ts:207:2
  (set_global $core/sound/sound/Sound.audioQueueIndex
   ;;@ core/sound/sound.ts:207:26
   (i32.const 0)
  )
 )
 (func $core/sound/sound/Sound.loadState (; 55 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel1/Channel1.loadState (; 56 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel2/Channel2.loadState (; 57 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel3/Channel3.loadState (; 58 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:106:4
  (set_global $core/sound/channel3/Channel3.isEnabled
   ;;@ core/sound/channel3.ts:106:25
   (call $core/memory/load/loadBooleanDirectlyFromWasmMemory
    ;;@ core/sound/channel3.ts:106:59
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:106:84
     (i32.const 0)
     (i32.const 9)
    )
   )
  )
  ;;@ core/sound/channel3.ts:107:4
  (set_global $core/sound/channel3/Channel3.frequencyTimer
   ;;@ core/sound/channel3.ts:107:30
   (i32.load
    ;;@ core/sound/channel3.ts:107:40
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:107:65
     (i32.const 1)
     (i32.const 9)
    )
   )
  )
  ;;@ core/sound/channel3.ts:108:4
  (set_global $core/sound/channel3/Channel3.lengthCounter
   ;;@ core/sound/channel3.ts:108:29
   (i32.load
    ;;@ core/sound/channel3.ts:108:39
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:108:64
     (i32.const 5)
     (i32.const 9)
    )
   )
  )
  ;;@ core/sound/channel3.ts:109:4
  (set_global $core/sound/channel3/Channel3.waveTablePosition
   ;;@ core/sound/channel3.ts:109:33
   (i32.load16_u
    ;;@ core/sound/channel3.ts:109:43
    (call $core/core/getSaveStateMemoryOffset
     ;;@ core/sound/channel3.ts:109:68
     (i32.const 9)
     (i32.const 9)
    )
   )
  )
 )
 (func $core/sound/channel4/Channel4.loadState (; 59 ;) (; has Stack IR ;) (type $v)
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
 (func $core/core/loadState (; 60 ;) (; has Stack IR ;) (type $v)
  ;;@ core/core.ts:198:6
  (call $core/cpu/cpu/Cpu.loadState)
  ;;@ core/core.ts:199:11
  (call $core/graphics/graphics/Graphics.loadState)
  ;;@ core/core.ts:200:13
  (call $core/interrupts/interrupts/Interrupts.loadState)
  ;;@ core/core.ts:201:9
  (call $core/joypad/joypad/Joypad.loadState)
  ;;@ core/core.ts:202:9
  (call $core/memory/memory/Memory.loadState)
  ;;@ core/core.ts:203:9
  (call $core/timers/timers/Timers.loadState)
  ;;@ core/core.ts:204:8
  (call $core/sound/sound/Sound.loadState)
  ;;@ core/core.ts:205:11
  (call $core/sound/channel1/Channel1.loadState)
  ;;@ core/core.ts:206:11
  (call $core/sound/channel2/Channel2.loadState)
  ;;@ core/core.ts:207:11
  (call $core/sound/channel3/Channel3.loadState)
  ;;@ core/core.ts:208:11
  (call $core/sound/channel4/Channel4.loadState)
  ;;@ core/core.ts:211:2
  (call $core/core/setHasCoreStarted
   ;;@ core/core.ts:211:20
   (i32.const 0)
  )
  ;;@ core/core.ts:214:2
  (call $core/cycles/resetCycles)
  ;;@ core/core.ts:215:2
  (call $core/execute/resetSteps)
 )
 (func $core/execute/getStepsPerStepSet (; 61 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/execute.ts:20:17
  (get_global $core/execute/Execute.stepsPerStepSet)
 )
 (func $core/execute/getStepSets (; 62 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/execute.ts:24:17
  (get_global $core/execute/Execute.stepSets)
 )
 (func $core/execute/getSteps (; 63 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/execute.ts:28:17
  (get_global $core/execute/Execute.steps)
 )
 (func $core/portable/portable/u16Portable (; 64 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/portable/portable.ts:12:17
  (i32.and
   (get_local $0)
   (i32.const 65535)
  )
 )
 (func $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE (; 65 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:40:4
  (if
   ;;@ core/graphics/graphics.ts:40:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   ;;@ core/graphics/graphics.ts:40:28
   (block
    ;;@ core/graphics/graphics.ts:41:6
    (if
     ;;@ core/graphics/graphics.ts:41:10
     (i32.eq
      (get_global $core/graphics/graphics/Graphics.scanlineRegister)
      ;;@ core/graphics/graphics.ts:41:40
      (i32.const 153)
     )
     (return
      (i32.const 8)
     )
    )
    ;;@ core/graphics/graphics.ts:45:13
    (return
     (i32.const 912)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:48:4
  (if
   ;;@ core/graphics/graphics.ts:48:8
   (i32.eq
    (get_global $core/graphics/graphics/Graphics.scanlineRegister)
    ;;@ core/graphics/graphics.ts:48:38
    (i32.const 153)
   )
   (return
    (i32.const 4)
   )
  )
  (i32.const 456)
 )
 (func $core/graphics/graphics/Graphics.batchProcessCycles (; 66 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:30:44
  (call $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE)
 )
 (func $core/graphics/graphics/loadFromVramBank (; 67 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/graphics/graphics.ts:313:32
  (i32.load8_u
   ;;@ core/graphics/graphics.ts:312:28
   (i32.add
    (i32.add
     (get_local $0)
     (i32.const -30720)
    )
    ;;@ core/graphics/graphics.ts:312:105
    (i32.shl
     ;;@ core/graphics/graphics.ts:312:114
     (i32.and
      (get_local $1)
      ;;@ core/graphics/graphics.ts:312:128
      (i32.const 1)
     )
     ;;@ core/graphics/graphics.ts:312:105
     (i32.const 13)
    )
   )
  )
 )
 (func $core/graphics/graphics/getRgbPixelStart (; 68 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/graphics/graphics.ts:299:25
  (i32.mul
   ;;@ core/graphics/graphics.ts:299:9
   (i32.add
    ;;@ core/graphics/graphics.ts:299:10
    (i32.mul
     (get_local $1)
     ;;@ core/graphics/graphics.ts:299:14
     (i32.const 160)
    )
    (get_local $0)
   )
   ;;@ core/graphics/graphics.ts:299:25
   (i32.const 3)
  )
 )
 (func $core/graphics/graphics/setPixelOnFrame (; 69 ;) (; has Stack IR ;) (type $iiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  ;;@ core/graphics/graphics.ts:307:2
  (i32.store8
   ;;@ core/graphics/graphics.ts:307:12
   (i32.add
    (i32.add
     ;;@ core/graphics/graphics.ts:307:29
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
 (func $core/graphics/priority/getPixelStart (; 70 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/graphics/priority/getPriorityforPixel (; 71 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/helpers/index/setBitOnByte (; 72 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/graphics/priority/addPriorityforPixel (; 73 ;) (; has Stack IR ;) (type $iiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
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
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileCache (; 74 ;) (; has Stack IR ;) (type $iiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (result i32)
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
 (func $core/graphics/tiles/getTileDataAddress (; 75 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/graphics/palette/loadPaletteByteFromWasmMemory (; 76 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/helpers/index/concatenateBytes (; 77 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/graphics/palette/getRgbColorFromPalette (; 78 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
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
 (func $core/graphics/palette/getColorComponentFromRgb (; 79 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/graphics/palette/getMonochromeColorFromPalette (; 80 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
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
 (func $core/graphics/tiles/getTilePixelStart (; 81 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
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
 (func $core/graphics/tiles/drawPixelsFromLineOfTile (; 82 ;) (; has Stack IR ;) (type $iiiiiiiiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (param $12 i32) (result i32)
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
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileId (; 83 ;) (; has Stack IR ;) (type $iiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (result i32)
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
 (func $core/graphics/backgroundWindow/drawColorPixelFromTileId (; 84 ;) (; has Stack IR ;) (type $iiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
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
 (func $core/graphics/backgroundWindow/drawMonochromePixelFromTileId (; 85 ;) (; has Stack IR ;) (type $iiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
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
 (func $core/graphics/backgroundWindow/drawBackgroundWindowScanline (; 86 ;) (; has Stack IR ;) (type $iiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
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
 (func $core/graphics/backgroundWindow/renderBackground (; 87 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
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
 (func $core/graphics/backgroundWindow/renderWindow (; 88 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
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
 (func $core/graphics/sprites/renderSprites (; 89 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/graphics/graphics/_drawScanline (; 90 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/graphics/graphics.ts:242:2
  (set_local $2
   (i32.const 34816)
  )
  ;;@ core/graphics/graphics.ts:243:2
  (if
   ;;@ core/graphics/graphics.ts:243:6
   (get_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect)
   ;;@ core/graphics/graphics.ts:243:34
   (set_local $2
    (i32.const 32768)
   )
  )
  ;;@ core/graphics/graphics.ts:254:2
  (if
   (tee_local $1
    ;;@ core/graphics/graphics.ts:254:6
    (if (result i32)
     (get_global $core/cpu/cpu/Cpu.GBCEnabled)
     (get_global $core/cpu/cpu/Cpu.GBCEnabled)
     ;;@ core/graphics/graphics.ts:254:24
     (get_global $core/graphics/lcd/Lcd.bgDisplayEnabled)
    )
   )
   ;;@ core/graphics/graphics.ts:254:46
   (block
    ;;@ core/graphics/graphics.ts:256:4
    (set_local $1
     (i32.const 38912)
    )
    ;;@ core/graphics/graphics.ts:257:4
    (if
     ;;@ core/graphics/graphics.ts:257:8
     (get_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect)
     ;;@ core/graphics/graphics.ts:257:36
     (set_local $1
      (i32.const 39936)
     )
    )
    ;;@ core/graphics/graphics.ts:262:4
    (call $core/graphics/backgroundWindow/renderBackground
     (get_local $0)
     (get_local $2)
     (get_local $1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:267:2
  (if
   ;;@ core/graphics/graphics.ts:267:6
   (get_global $core/graphics/lcd/Lcd.windowDisplayEnabled)
   ;;@ core/graphics/graphics.ts:267:32
   (block
    ;;@ core/graphics/graphics.ts:269:4
    (set_local $1
     (i32.const 38912)
    )
    ;;@ core/graphics/graphics.ts:270:4
    (if
     ;;@ core/graphics/graphics.ts:270:8
     (get_global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect)
     ;;@ core/graphics/graphics.ts:270:40
     (set_local $1
      (i32.const 39936)
     )
    )
    ;;@ core/graphics/graphics.ts:275:4
    (call $core/graphics/backgroundWindow/renderWindow
     (get_local $0)
     (get_local $2)
     (get_local $1)
    )
   )
  )
  ;;@ core/graphics/graphics.ts:278:2
  (if
   ;;@ core/graphics/graphics.ts:278:6
   (get_global $core/graphics/lcd/Lcd.spriteDisplayEnable)
   ;;@ core/graphics/graphics.ts:278:31
   (call $core/graphics/sprites/renderSprites
    (get_local $0)
    ;;@ core/graphics/graphics.ts:280:36
    (get_global $core/graphics/lcd/Lcd.tallSpriteSize)
   )
  )
 )
 (func $core/graphics/graphics/_renderEntireFrame (; 91 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/graphics/graphics.ts:289:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/graphics/graphics.ts:289:22
     (i32.gt_u
      (get_local $0)
      ;;@ core/graphics/graphics.ts:289:27
      (i32.const 144)
     )
    )
    ;;@ core/graphics/graphics.ts:290:4
    (call $core/graphics/graphics/_drawScanline
     ;;@ core/graphics/graphics.ts:290:18
     (i32.and
      (get_local $0)
      (i32.const 255)
     )
    )
    ;;@ core/graphics/graphics.ts:289:32
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
 (func $core/graphics/priority/clearPriorityMap (; 92 ;) (; has Stack IR ;) (type $v)
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
 (func $core/graphics/tiles/resetTileCache (; 93 ;) (; has Stack IR ;) (type $v)
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
 (func $core/graphics/graphics/Graphics.MIN_CYCLES_SPRITES_LCD_MODE (; 94 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:56:4
  (if
   ;;@ core/graphics/graphics.ts:56:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 752)
   )
  )
  (i32.const 376)
 )
 (func $core/graphics/graphics/Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE (; 95 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/graphics/graphics.ts:64:4
  (if
   ;;@ core/graphics/graphics.ts:64:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 498)
   )
  )
  (i32.const 249)
 )
 (func $core/interrupts/interrupts/_requestInterrupt (; 96 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/interrupts/interrupts.ts:215:2
  (set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   ;;@ core/interrupts/interrupts.ts:213:2
   (tee_local $1
    ;;@ core/interrupts/interrupts.ts:213:21
    (call $core/helpers/index/setBitOnByte
     (get_local $0)
     ;;@ core/interrupts/interrupts.ts:210:25
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.const 65295)
     )
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:217:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65295)
   (get_local $1)
  )
 )
 (func $core/interrupts/interrupts/requestLcdInterrupt (; 97 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:236:2
  (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
   ;;@ core/interrupts/interrupts.ts:236:39
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:237:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 1)
  )
 )
 (func $core/sound/sound/Sound.batchProcessCycles (; 98 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/sound/sound/Sound.maxFrameSequenceCycles (; 99 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/sound/channel1/Channel1.updateLength (; 100 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel2/Channel2.updateLength (; 101 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel3/Channel3.updateLength (; 102 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/sound/channel3.ts:269:8
  (if
   (tee_local $0
    (i32.gt_s
     (get_global $core/sound/channel3/Channel3.lengthCounter)
     ;;@ core/sound/channel3.ts:269:33
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel3.ts:269:38
    (get_global $core/sound/channel3/Channel3.NRx4LengthEnabled)
   )
  )
  ;;@ core/sound/channel3.ts:269:4
  (if
   (get_local $0)
   ;;@ core/sound/channel3.ts:269:66
   (set_global $core/sound/channel3/Channel3.lengthCounter
    (i32.sub
     ;;@ core/sound/channel3.ts:270:6
     (get_global $core/sound/channel3/Channel3.lengthCounter)
     ;;@ core/sound/channel3.ts:270:32
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/channel3.ts:273:4
  (if
   (i32.eqz
    ;;@ core/sound/channel3.ts:273:8
    (get_global $core/sound/channel3/Channel3.lengthCounter)
   )
   ;;@ core/sound/channel3.ts:273:38
   (set_global $core/sound/channel3/Channel3.isEnabled
    ;;@ core/sound/channel3.ts:274:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateLength (; 103 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel1/getNewFrequencyFromSweep (; 104 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/sound/channel1/Channel1.setFrequency (; 105 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel1/calculateSweepAndCheckOverflow (; 106 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel1/Channel1.updateSweep (; 107 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel1/Channel1.updateEnvelope (; 108 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel2/Channel2.updateEnvelope (; 109 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel4/Channel4.updateEnvelope (; 110 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/sound/updateFrameSequencer (; 111 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/sound.ts:262:2
  (set_global $core/sound/sound/Sound.frameSequenceCycleCounter
   (i32.add
    (get_global $core/sound/sound/Sound.frameSequenceCycleCounter)
    (get_local $0)
   )
  )
  ;;@ core/sound/sound.ts:263:2
  (if
   ;;@ core/sound/sound.ts:263:6
   (i32.ge_s
    (get_global $core/sound/sound/Sound.frameSequenceCycleCounter)
    ;;@ core/sound/sound.ts:263:47
    (call $core/sound/sound/Sound.maxFrameSequenceCycles)
   )
   ;;@ core/sound/sound.ts:263:73
   (block
    ;;@ core/sound/sound.ts:266:4
    (set_global $core/sound/sound/Sound.frameSequenceCycleCounter
     (i32.sub
      (get_global $core/sound/sound/Sound.frameSequenceCycleCounter)
      ;;@ core/sound/sound.ts:266:45
      (call $core/sound/sound/Sound.maxFrameSequenceCycles)
     )
    )
    ;;@ core/sound/sound.ts:270:4
    (block $break|0
     (block $case4|0
      (block $case3|0
       (block $case2|0
        (block $case1|0
         (if
          (tee_local $1
           ;;@ core/sound/sound.ts:270:12
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
         ;;@ core/sound/sound.ts:273:17
         (call $core/sound/channel1/Channel1.updateLength)
         ;;@ core/sound/sound.ts:274:17
         (call $core/sound/channel2/Channel2.updateLength)
         ;;@ core/sound/sound.ts:275:17
         (call $core/sound/channel3/Channel3.updateLength)
         ;;@ core/sound/sound.ts:276:17
         (call $core/sound/channel4/Channel4.updateLength)
         ;;@ core/sound/sound.ts:277:8
         (br $break|0)
        )
        ;;@ core/sound/sound.ts:281:17
        (call $core/sound/channel1/Channel1.updateLength)
        ;;@ core/sound/sound.ts:282:17
        (call $core/sound/channel2/Channel2.updateLength)
        ;;@ core/sound/sound.ts:283:17
        (call $core/sound/channel3/Channel3.updateLength)
        ;;@ core/sound/sound.ts:284:17
        (call $core/sound/channel4/Channel4.updateLength)
        ;;@ core/sound/sound.ts:286:17
        (call $core/sound/channel1/Channel1.updateSweep)
        ;;@ core/sound/sound.ts:287:8
        (br $break|0)
       )
       ;;@ core/sound/sound.ts:291:17
       (call $core/sound/channel1/Channel1.updateLength)
       ;;@ core/sound/sound.ts:292:17
       (call $core/sound/channel2/Channel2.updateLength)
       ;;@ core/sound/sound.ts:293:17
       (call $core/sound/channel3/Channel3.updateLength)
       ;;@ core/sound/sound.ts:294:17
       (call $core/sound/channel4/Channel4.updateLength)
       ;;@ core/sound/sound.ts:295:8
       (br $break|0)
      )
      ;;@ core/sound/sound.ts:299:17
      (call $core/sound/channel1/Channel1.updateLength)
      ;;@ core/sound/sound.ts:300:17
      (call $core/sound/channel2/Channel2.updateLength)
      ;;@ core/sound/sound.ts:301:17
      (call $core/sound/channel3/Channel3.updateLength)
      ;;@ core/sound/sound.ts:302:17
      (call $core/sound/channel4/Channel4.updateLength)
      ;;@ core/sound/sound.ts:304:17
      (call $core/sound/channel1/Channel1.updateSweep)
      ;;@ core/sound/sound.ts:305:8
      (br $break|0)
     )
     ;;@ core/sound/sound.ts:308:17
     (call $core/sound/channel1/Channel1.updateEnvelope)
     ;;@ core/sound/sound.ts:309:17
     (call $core/sound/channel2/Channel2.updateEnvelope)
     ;;@ core/sound/sound.ts:310:17
     (call $core/sound/channel4/Channel4.updateEnvelope)
    )
    ;;@ core/sound/sound.ts:315:4
    (set_global $core/sound/sound/Sound.frameSequencer
     (i32.add
      (get_global $core/sound/sound/Sound.frameSequencer)
      ;;@ core/sound/sound.ts:315:28
      (i32.const 1)
     )
    )
    ;;@ core/sound/sound.ts:316:4
    (if
     ;;@ core/sound/sound.ts:316:8
     (i32.ge_s
      (get_global $core/sound/sound/Sound.frameSequencer)
      ;;@ core/sound/sound.ts:316:32
      (i32.const 8)
     )
     ;;@ core/sound/sound.ts:316:35
     (set_global $core/sound/sound/Sound.frameSequencer
      ;;@ core/sound/sound.ts:317:29
      (i32.const 0)
     )
    )
    ;;@ core/sound/sound.ts:320:11
    (return
     (i32.const 1)
    )
   )
  )
  (i32.const 0)
 )
 (func $core/sound/channel1/Channel1.willChannelUpdate (; 112 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/sound/accumulator/didChannelDacChange (; 113 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/sound/accumulator.ts:107:2
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
      ;;@ core/sound/accumulator.ts:109:6
      (if
       ;;@ core/sound/accumulator.ts:109:10
       (i32.ne
        (get_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled)
        ;;@ core/sound/accumulator.ts:109:50
        (get_global $core/sound/channel1/Channel1.isDacEnabled)
       )
       ;;@ core/sound/accumulator.ts:109:73
       (block
        ;;@ core/sound/accumulator.ts:110:8
        (set_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
         ;;@ core/sound/accumulator.ts:110:46
         (get_global $core/sound/channel1/Channel1.isDacEnabled)
        )
        ;;@ core/sound/accumulator.ts:111:15
        (return
         (i32.const 1)
        )
       )
      )
      ;;@ core/sound/accumulator.ts:113:13
      (return
       (i32.const 0)
      )
     )
     ;;@ core/sound/accumulator.ts:115:6
     (if
      ;;@ core/sound/accumulator.ts:115:10
      (i32.ne
       (get_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled)
       ;;@ core/sound/accumulator.ts:115:50
       (get_global $core/sound/channel2/Channel2.isDacEnabled)
      )
      ;;@ core/sound/accumulator.ts:115:73
      (block
       ;;@ core/sound/accumulator.ts:116:8
       (set_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
        ;;@ core/sound/accumulator.ts:116:46
        (get_global $core/sound/channel2/Channel2.isDacEnabled)
       )
       ;;@ core/sound/accumulator.ts:117:15
       (return
        (i32.const 1)
       )
      )
     )
     ;;@ core/sound/accumulator.ts:119:13
     (return
      (i32.const 0)
     )
    )
    ;;@ core/sound/accumulator.ts:121:6
    (if
     ;;@ core/sound/accumulator.ts:121:10
     (i32.ne
      (get_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled)
      ;;@ core/sound/accumulator.ts:121:50
      (get_global $core/sound/channel3/Channel3.isDacEnabled)
     )
     ;;@ core/sound/accumulator.ts:121:73
     (block
      ;;@ core/sound/accumulator.ts:122:8
      (set_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
       ;;@ core/sound/accumulator.ts:122:46
       (get_global $core/sound/channel3/Channel3.isDacEnabled)
      )
      ;;@ core/sound/accumulator.ts:123:15
      (return
       (i32.const 1)
      )
     )
    )
    ;;@ core/sound/accumulator.ts:125:13
    (return
     (i32.const 0)
    )
   )
   ;;@ core/sound/accumulator.ts:127:6
   (if
    ;;@ core/sound/accumulator.ts:127:10
    (i32.ne
     (get_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled)
     ;;@ core/sound/accumulator.ts:127:50
     (get_global $core/sound/channel4/Channel4.isDacEnabled)
    )
    ;;@ core/sound/accumulator.ts:127:73
    (block
     ;;@ core/sound/accumulator.ts:128:8
     (set_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
      ;;@ core/sound/accumulator.ts:128:46
      (get_global $core/sound/channel4/Channel4.isDacEnabled)
     )
     ;;@ core/sound/accumulator.ts:129:15
     (return
      (i32.const 1)
     )
    )
   )
   ;;@ core/sound/accumulator.ts:131:13
   (return
    (i32.const 0)
   )
  )
  (i32.const 0)
 )
 (func $core/sound/channel2/Channel2.willChannelUpdate (; 114 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/sound/channel3/Channel3.willChannelUpdate (; 115 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/sound/channel3.ts:258:4
  (set_global $core/sound/channel3/Channel3.cycleCounter
   (i32.add
    (get_global $core/sound/channel3/Channel3.cycleCounter)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel3.ts:261:8
  (if
   (tee_local $0
    (i32.gt_s
     (i32.sub
      (get_global $core/sound/channel3/Channel3.frequencyTimer)
      ;;@ core/sound/channel3.ts:261:34
      (get_global $core/sound/channel3/Channel3.cycleCounter)
     )
     ;;@ core/sound/channel3.ts:261:58
     (i32.const 0)
    )
   )
   (set_local $0
    ;;@ core/sound/channel3.ts:261:63
    (i32.eqz
     ;;@ core/sound/channel3.ts:261:64
     (get_global $core/sound/channel3/Channel3.volumeCodeChanged)
    )
   )
  )
  ;;@ core/sound/channel3.ts:261:4
  (if
   (get_local $0)
   (return
    (i32.const 0)
   )
  )
  (i32.const 1)
 )
 (func $core/sound/channel4/Channel4.willChannelUpdate (; 116 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/sound/channel1/Channel1.resetTimer (; 117 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform (; 118 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/sound/channel1/Channel1.getSample (; 119 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/sound/channel1/Channel1.getSampleFromCycleCounter (; 120 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/sound/channel2/Channel2.resetTimer (; 121 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel2/Channel2.getSample (; 122 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/sound/channel2/Channel2.getSampleFromCycleCounter (; 123 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/sound/channel3/Channel3.resetTimer (; 124 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:132:4
  (set_global $core/sound/channel3/Channel3.frequencyTimer
   ;;@ core/sound/channel3.ts:132:30
   (i32.shl
    (i32.sub
     ;;@ core/sound/channel3.ts:132:31
     (i32.const 2048)
     ;;@ core/sound/channel3.ts:132:38
     (get_global $core/sound/channel3/Channel3.frequency)
    )
    ;;@ core/sound/channel3.ts:132:60
    (i32.const 1)
   )
  )
  ;;@ core/sound/channel3.ts:135:4
  (if
   ;;@ core/sound/channel3.ts:135:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   ;;@ core/sound/channel3.ts:135:28
   (set_global $core/sound/channel3/Channel3.frequencyTimer
    ;;@ core/sound/channel3.ts:136:32
    (i32.shl
     (get_global $core/sound/channel3/Channel3.frequencyTimer)
     ;;@ core/sound/channel3.ts:136:58
     (i32.const 1)
    )
   )
  )
 )
 (func $core/portable/portable/i32Portable (; 125 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (get_local $0)
 )
 (func $core/sound/channel3/Channel3.getSample (; 126 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/sound/channel3.ts:142:4
  (set_global $core/sound/channel3/Channel3.frequencyTimer
   (i32.sub
    (get_global $core/sound/channel3/Channel3.frequencyTimer)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel3.ts:143:4
  (if
   ;;@ core/sound/channel3.ts:143:8
   (i32.le_s
    (get_global $core/sound/channel3/Channel3.frequencyTimer)
    ;;@ core/sound/channel3.ts:143:35
    (i32.const 0)
   )
   ;;@ core/sound/channel3.ts:143:38
   (block
    (set_local $2
     ;;@ core/sound/channel3.ts:145:36
     (get_global $core/sound/channel3/Channel3.frequencyTimer)
    )
    ;;@ core/sound/channel3.ts:150:15
    (call $core/sound/channel3/Channel3.resetTimer)
    ;;@ core/sound/channel3.ts:151:6
    (set_global $core/sound/channel3/Channel3.frequencyTimer
     (i32.sub
      (get_global $core/sound/channel3/Channel3.frequencyTimer)
      ;;@ core/sound/channel3.ts:145:32
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
    ;;@ core/sound/channel3.ts:154:6
    (set_global $core/sound/channel3/Channel3.waveTablePosition
     (i32.add
      (get_global $core/sound/channel3/Channel3.waveTablePosition)
      ;;@ core/sound/channel3.ts:154:36
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel3.ts:155:6
    (if
     ;;@ core/sound/channel3.ts:155:10
     (i32.ge_s
      (get_global $core/sound/channel3/Channel3.waveTablePosition)
      ;;@ core/sound/channel3.ts:155:40
      (i32.const 32)
     )
     ;;@ core/sound/channel3.ts:155:44
     (set_global $core/sound/channel3/Channel3.waveTablePosition
      ;;@ core/sound/channel3.ts:156:37
      (i32.const 0)
     )
    )
   )
  )
  ;;@ core/sound/channel3.ts:161:4
  (set_local $2
   ;;@ core/sound/channel3.ts:161:28
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:162:4
  (set_local $0
   ;;@ core/sound/channel3.ts:162:26
   (get_global $core/sound/channel3/Channel3.volumeCode)
  )
  ;;@ core/sound/channel3.ts:167:4
  (if
   (tee_local $1
    ;;@ core/sound/channel3.ts:167:8
    (if (result i32)
     (get_global $core/sound/channel3/Channel3.isEnabled)
     ;;@ core/sound/channel3.ts:167:30
     (get_global $core/sound/channel3/Channel3.isDacEnabled)
     (get_global $core/sound/channel3/Channel3.isEnabled)
    )
   )
   ;;@ core/sound/channel3.ts:167:53
   (if
    ;;@ core/sound/channel3.ts:169:10
    (get_global $core/sound/channel3/Channel3.volumeCodeChanged)
    ;;@ core/sound/channel3.ts:169:38
    (block
     ;;@ core/sound/channel3.ts:173:8
     (set_global $core/sound/channel3/Channel3.volumeCode
      ;;@ core/sound/channel3.ts:172:8
      (tee_local $0
       ;;@ core/sound/channel3.ts:172:21
       (i32.and
        ;;@ core/sound/channel3.ts:171:21
        (i32.shr_s
         ;;@ core/sound/channel3.ts:170:21
         (call $core/memory/load/eightBitLoadFromGBMemory
          (i32.const 65308)
         )
         ;;@ core/sound/channel3.ts:171:35
         (i32.const 5)
        )
        ;;@ core/sound/channel3.ts:172:34
        (i32.const 15)
       )
      )
     )
     ;;@ core/sound/channel3.ts:174:8
     (set_global $core/sound/channel3/Channel3.volumeCodeChanged
      ;;@ core/sound/channel3.ts:174:37
      (i32.const 0)
     )
    )
   )
   (return
    (i32.const 15)
   )
  )
  ;;@ core/sound/channel3.ts:189:4
  (set_local $1
   ;;@ core/sound/channel3.ts:189:13
   (call $core/memory/load/eightBitLoadFromGBMemory
    ;;@ core/sound/channel3.ts:187:40
    (i32.add
     ;;@ core/sound/channel3.ts:186:34
     (call $core/portable/portable/i32Portable
      ;;@ core/sound/channel3.ts:186:46
      (i32.div_s
       (get_global $core/sound/channel3/Channel3.waveTablePosition)
       ;;@ core/sound/channel3.ts:186:75
       (i32.const 2)
      )
     )
     (i32.const 65328)
    )
   )
  )
  (set_local $1
   ;;@ core/sound/channel3.ts:192:4
   (if (result i32)
    ;;@ core/sound/channel3.ts:192:8
    (i32.rem_s
     (get_global $core/sound/channel3/Channel3.waveTablePosition)
     ;;@ core/sound/channel3.ts:192:37
     (i32.const 2)
    )
    ;;@ core/sound/channel3.ts:198:15
    (i32.and
     (get_local $1)
     ;;@ core/sound/channel3.ts:198:24
     (i32.const 15)
    )
    ;;@ core/sound/channel3.ts:195:15
    (i32.and
     ;;@ core/sound/channel3.ts:194:15
     (i32.shr_s
      (get_local $1)
      ;;@ core/sound/channel3.ts:194:25
      (i32.const 4)
     )
     ;;@ core/sound/channel3.ts:195:24
     (i32.const 15)
    )
   )
  )
  ;;@ core/sound/channel3.ts:204:4
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
          ;;@ core/sound/channel3.ts:208:11
          (i32.const 1)
         )
        )
        (br_if $case2|0
         (i32.eq
          (get_local $0)
          ;;@ core/sound/channel3.ts:212:11
          (i32.const 2)
         )
        )
        (br $case3|0)
       )
      )
      ;;@ core/sound/channel3.ts:206:8
      (set_local $1
       ;;@ core/sound/channel3.ts:206:17
       (i32.shr_s
        (get_local $1)
        ;;@ core/sound/channel3.ts:206:27
        (i32.const 4)
       )
      )
      ;;@ core/sound/channel3.ts:207:8
      (br $break|0)
     )
     ;;@ core/sound/channel3.ts:210:8
     (set_local $2
      ;;@ core/sound/channel3.ts:210:23
      (i32.const 1)
     )
     ;;@ core/sound/channel3.ts:211:8
     (br $break|0)
    )
    ;;@ core/sound/channel3.ts:213:8
    (set_local $1
     ;;@ core/sound/channel3.ts:213:17
     (i32.shr_s
      (get_local $1)
      ;;@ core/sound/channel3.ts:213:27
      (i32.const 1)
     )
    )
    ;;@ core/sound/channel3.ts:214:8
    (set_local $2
     ;;@ core/sound/channel3.ts:214:23
     (i32.const 2)
    )
    ;;@ core/sound/channel3.ts:215:8
    (br $break|0)
   )
   ;;@ core/sound/channel3.ts:217:8
   (set_local $1
    ;;@ core/sound/channel3.ts:217:17
    (i32.shr_s
     (get_local $1)
     ;;@ core/sound/channel3.ts:217:27
     (i32.const 2)
    )
   )
   ;;@ core/sound/channel3.ts:218:8
   (set_local $2
    ;;@ core/sound/channel3.ts:218:23
    (i32.const 4)
   )
  )
  ;;@ core/sound/channel3.ts:230:13
  (i32.add
   (tee_local $1
    ;;@ core/sound/channel3.ts:223:4
    (if (result i32)
     ;;@ core/sound/channel3.ts:223:8
     (i32.gt_s
      (get_local $2)
      ;;@ core/sound/channel3.ts:223:23
      (i32.const 0)
     )
     ;;@ core/sound/channel3.ts:224:15
     (i32.div_s
      (get_local $1)
      (get_local $2)
     )
     ;;@ core/sound/channel3.ts:226:15
     (i32.const 0)
    )
   )
   ;;@ core/sound/channel3.ts:230:22
   (i32.const 15)
  )
 )
 (func $core/sound/channel3/Channel3.getSampleFromCycleCounter (; 127 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  ;;@ core/sound/channel3.ts:125:4
  (set_local $0
   ;;@ core/sound/channel3.ts:125:33
   (get_global $core/sound/channel3/Channel3.cycleCounter)
  )
  ;;@ core/sound/channel3.ts:126:4
  (set_global $core/sound/channel3/Channel3.cycleCounter
   ;;@ core/sound/channel3.ts:126:28
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:127:47
  (call $core/sound/channel3/Channel3.getSample
   (get_local $0)
  )
 )
 (func $core/sound/channel4/Channel4.getNoiseChannelFrequencyPeriod (; 128 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/sound/channel4/Channel4.getSample (; 129 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/sound/channel4/Channel4.getSampleFromCycleCounter (; 130 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/cpu/cpu/Cpu.CLOCK_SPEED (; 131 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/cpu.ts:45:4
  (if
   ;;@ core/cpu/cpu.ts:45:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 8388608)
   )
  )
  (i32.const 4194304)
 )
 (func $core/sound/sound/Sound.maxDownSampleCycles (; 132 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/sound/sound.ts:105:27
  (call $core/cpu/cpu/Cpu.CLOCK_SPEED)
 )
 (func $core/sound/sound/getSampleAsUnsignedByte (; 133 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  ;;@ core/sound/sound.ts:422:2
  (if
   ;;@ core/sound/sound.ts:422:6
   (i32.eq
    (get_local $0)
    ;;@ core/sound/sound.ts:422:17
    (i32.const 60)
   )
   (return
    (i32.const 127)
   )
  )
  ;;@ core/sound/sound.ts:450:20
  (call $core/portable/portable/i32Portable
   ;;@ core/sound/sound.ts:447:20
   (call $core/portable/portable/i32Portable
    ;;@ core/sound/sound.ts:447:32
    (i32.div_s
     (i32.mul
      ;;@ core/sound/sound.ts:437:20
      (i32.add
       ;;@ core/sound/sound.ts:436:20
       (call $core/portable/portable/i32Portable
        ;;@ core/sound/sound.ts:436:32
        (i32.div_s
         ;;@ core/sound/sound.ts:433:20
         (call $core/portable/portable/i32Portable
          ;;@ core/sound/sound.ts:433:32
          (i32.div_s
           (i32.mul
            ;;@ core/sound/sound.ts:430:20
            (i32.mul
             ;;@ core/sound/sound.ts:429:29
             (i32.sub
              (get_local $0)
              ;;@ core/sound/sound.ts:429:38
              (i32.const 60)
             )
             (i32.const 100000)
            )
            (get_local $1)
           )
           ;;@ core/sound/sound.ts:433:66
           (i32.const 8)
          )
         )
         (i32.const 100000)
        )
       )
       ;;@ core/sound/sound.ts:437:38
       (i32.const 60)
      )
      (i32.const 100000)
     )
     ;;@ core/sound/sound.ts:446:24
     (call $core/portable/portable/i32Portable
      (i32.const 47244)
     )
    )
   )
  )
 )
 (func $core/sound/sound/mixChannelSamples (; 134 ;) (; has Stack IR ;) (type $iiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  ;;@ core/sound/sound.ts:345:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
   ;;@ core/sound/sound.ts:345:40
   (i32.const 0)
  )
  (set_local $4
   ;;@ core/sound/sound.ts:353:2
   (if (result i32)
    ;;@ core/sound/sound.ts:353:6
    (get_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput)
    (get_local $0)
    (i32.const 15)
   )
  )
  (set_local $4
   ;;@ core/sound/sound.ts:358:2
   (if (result i32)
    ;;@ core/sound/sound.ts:358:6
    (get_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput)
    (i32.add
     (get_local $4)
     (get_local $1)
    )
    (i32.add
     (get_local $4)
     ;;@ core/sound/sound.ts:361:25
     (i32.const 15)
    )
   )
  )
  (set_local $4
   ;;@ core/sound/sound.ts:363:2
   (if (result i32)
    ;;@ core/sound/sound.ts:363:6
    (get_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput)
    (i32.add
     (get_local $4)
     (get_local $2)
    )
    (i32.add
     (get_local $4)
     ;;@ core/sound/sound.ts:366:25
     (i32.const 15)
    )
   )
  )
  (set_local $4
   ;;@ core/sound/sound.ts:368:2
   (if (result i32)
    ;;@ core/sound/sound.ts:368:6
    (get_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput)
    (i32.add
     (get_local $4)
     (get_local $3)
    )
    (i32.add
     (get_local $4)
     ;;@ core/sound/sound.ts:371:25
     (i32.const 15)
    )
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:376:2
   (if (result i32)
    ;;@ core/sound/sound.ts:376:6
    (get_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput)
    (get_local $0)
    (i32.const 15)
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:381:2
   (if (result i32)
    ;;@ core/sound/sound.ts:381:6
    (get_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput)
    (i32.add
     (get_local $0)
     (get_local $1)
    )
    (i32.add
     (get_local $0)
     ;;@ core/sound/sound.ts:384:26
     (i32.const 15)
    )
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:386:2
   (if (result i32)
    ;;@ core/sound/sound.ts:386:6
    (get_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput)
    (i32.add
     (get_local $0)
     (get_local $2)
    )
    (i32.add
     (get_local $0)
     ;;@ core/sound/sound.ts:389:26
     (i32.const 15)
    )
   )
  )
  (set_local $0
   ;;@ core/sound/sound.ts:391:2
   (if (result i32)
    ;;@ core/sound/sound.ts:391:6
    (get_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput)
    (i32.add
     (get_local $0)
     (get_local $3)
    )
    (i32.add
     (get_local $0)
     ;;@ core/sound/sound.ts:394:26
     (i32.const 15)
    )
   )
  )
  ;;@ core/sound/sound.ts:398:2
  (set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
   ;;@ core/sound/sound.ts:398:41
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:399:2
  (set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
   ;;@ core/sound/sound.ts:399:40
   (i32.const 0)
  )
  ;;@ core/sound/sound.ts:409:2
  (set_local $1
   ;;@ core/sound/sound.ts:409:43
   (call $core/sound/sound/getSampleAsUnsignedByte
    (get_local $4)
    ;;@ core/sound/sound.ts:409:86
    (i32.add
     (get_global $core/sound/sound/Sound.NR50LeftMixerVolume)
     ;;@ core/sound/sound.ts:409:114
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/sound.ts:410:2
  (set_local $0
   ;;@ core/sound/sound.ts:410:44
   (call $core/sound/sound/getSampleAsUnsignedByte
    (get_local $0)
    ;;@ core/sound/sound.ts:410:88
    (i32.add
     (get_global $core/sound/sound/Sound.NR50RightMixerVolume)
     ;;@ core/sound/sound.ts:410:117
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/sound.ts:413:2
  (set_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
   (get_local $1)
  )
  ;;@ core/sound/sound.ts:414:2
  (set_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
   (get_local $0)
  )
  ;;@ core/sound/sound.ts:416:87
  (call $core/helpers/index/concatenateBytes
   (get_local $1)
   (get_local $0)
  )
 )
 (func $core/sound/sound/setLeftAndRightOutputForAudioQueue (; 135 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  ;;@ core/sound/sound.ts:462:2
  (i32.store8
   ;;@ core/sound/sound.ts:458:2
   (tee_local $3
    ;;@ core/sound/sound.ts:458:25
    (i32.add
     ;;@ core/sound/sound.ts:458:49
     (i32.shl
      (get_local $2)
      ;;@ core/sound/sound.ts:458:67
      (i32.const 1)
     )
     (i32.const 588800)
    )
   )
   ;;@ core/sound/sound.ts:462:30
   (i32.add
    (get_local $0)
    ;;@ core/sound/sound.ts:462:48
    (i32.const 1)
   )
  )
  ;;@ core/sound/sound.ts:463:2
  (i32.store8
   ;;@ core/sound/sound.ts:463:12
   (i32.add
    (get_local $3)
    ;;@ core/sound/sound.ts:463:31
    (i32.const 1)
   )
   ;;@ core/sound/sound.ts:463:34
   (i32.add
    (get_local $1)
    ;;@ core/sound/sound.ts:463:53
    (i32.const 1)
   )
  )
 )
 (func $core/sound/accumulator/accumulateSound (; 136 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  ;;@ core/sound/accumulator.ts:46:36
  (if
   (i32.eqz
    (tee_local $1
     ;;@ core/sound/accumulator.ts:46:45
     (call $core/sound/channel1/Channel1.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $1
    ;;@ core/sound/accumulator.ts:46:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 1)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:47:36
  (if
   (i32.eqz
    (tee_local $2
     ;;@ core/sound/accumulator.ts:47:45
     (call $core/sound/channel2/Channel2.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $2
    ;;@ core/sound/accumulator.ts:47:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 2)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:48:36
  (if
   (i32.eqz
    (tee_local $3
     ;;@ core/sound/accumulator.ts:48:45
     (call $core/sound/channel3/Channel3.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $3
    ;;@ core/sound/accumulator.ts:48:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 3)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:49:36
  (if
   (i32.eqz
    (tee_local $4
     ;;@ core/sound/accumulator.ts:49:45
     (call $core/sound/channel4/Channel4.willChannelUpdate
      (get_local $0)
     )
    )
   )
   (set_local $4
    ;;@ core/sound/accumulator.ts:49:82
    (call $core/sound/accumulator/didChannelDacChange
     (i32.const 4)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:51:2
  (if
   (i32.and
    (get_local $1)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:51:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
    ;;@ core/sound/accumulator.ts:52:47
    (call $core/sound/channel1/Channel1.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:54:2
  (if
   (i32.and
    (get_local $2)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:54:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
    ;;@ core/sound/accumulator.ts:55:47
    (call $core/sound/channel2/Channel2.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:57:2
  (if
   (i32.and
    (get_local $3)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:57:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
    ;;@ core/sound/accumulator.ts:58:47
    (call $core/sound/channel3/Channel3.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:60:2
  (if
   (i32.and
    (get_local $4)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:60:26
   (set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
    ;;@ core/sound/accumulator.ts:61:47
    (call $core/sound/channel4/Channel4.getSampleFromCycleCounter)
   )
  )
  ;;@ core/sound/accumulator.ts:65:6
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
  ;;@ core/sound/accumulator.ts:65:2
  (if
   (i32.and
    (get_local $1)
    (i32.const 1)
   )
   ;;@ core/sound/accumulator.ts:65:92
   (set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
    ;;@ core/sound/accumulator.ts:66:42
    (i32.const 1)
   )
  )
  ;;@ core/sound/accumulator.ts:70:2
  (set_global $core/sound/sound/Sound.downSampleCycleCounter
   (i32.add
    (get_global $core/sound/sound/Sound.downSampleCycleCounter)
    ;;@ core/sound/accumulator.ts:70:34
    (i32.mul
     (get_local $0)
     ;;@ core/sound/accumulator.ts:70:51
     (get_global $core/sound/sound/Sound.downSampleCycleMultiplier)
    )
   )
  )
  ;;@ core/sound/accumulator.ts:71:2
  (if
   ;;@ core/sound/accumulator.ts:71:6
   (i32.ge_s
    (get_global $core/sound/sound/Sound.downSampleCycleCounter)
    ;;@ core/sound/accumulator.ts:71:44
    (call $core/sound/sound/Sound.maxDownSampleCycles)
   )
   ;;@ core/sound/accumulator.ts:71:67
   (block
    ;;@ core/sound/accumulator.ts:74:4
    (set_global $core/sound/sound/Sound.downSampleCycleCounter
     (i32.sub
      (get_global $core/sound/sound/Sound.downSampleCycleCounter)
      ;;@ core/sound/accumulator.ts:74:42
      (call $core/sound/sound/Sound.maxDownSampleCycles)
     )
    )
    ;;@ core/sound/accumulator.ts:76:8
    (if
     (i32.eqz
      (tee_local $1
       (if (result i32)
        (get_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples)
        (get_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples)
        ;;@ core/sound/accumulator.ts:76:47
        (get_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged)
       )
      )
     )
     (set_local $1
      ;;@ core/sound/accumulator.ts:76:86
      (get_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged)
     )
    )
    ;;@ core/sound/accumulator.ts:76:4
    (if
     (get_local $1)
     ;;@ core/sound/accumulator.ts:76:124
     (drop
      (call $core/sound/sound/mixChannelSamples
       ;;@ core/sound/accumulator.ts:78:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel1Sample)
       ;;@ core/sound/accumulator.ts:79:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel2Sample)
       ;;@ core/sound/accumulator.ts:80:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel3Sample)
       ;;@ core/sound/accumulator.ts:81:8
       (get_global $core/sound/accumulator/SoundAccumulator.channel4Sample)
      )
     )
    )
    ;;@ core/sound/accumulator.ts:88:4
    (call $core/sound/sound/setLeftAndRightOutputForAudioQueue
     ;;@ core/sound/accumulator.ts:89:6
     (i32.add
      (get_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte)
      ;;@ core/sound/accumulator.ts:89:55
      (i32.const 1)
     )
     ;;@ core/sound/accumulator.ts:90:6
     (i32.add
      (get_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte)
      ;;@ core/sound/accumulator.ts:90:56
      (i32.const 1)
     )
     ;;@ core/sound/accumulator.ts:91:6
     (get_global $core/sound/sound/Sound.audioQueueIndex)
    )
    ;;@ core/sound/accumulator.ts:93:4
    (set_global $core/sound/sound/Sound.audioQueueIndex
     (i32.add
      (get_global $core/sound/sound/Sound.audioQueueIndex)
      ;;@ core/sound/accumulator.ts:93:29
      (i32.const 1)
     )
    )
    ;;@ core/sound/accumulator.ts:98:4
    (set_local $1
     ;;@ core/sound/accumulator.ts:98:24
     (i32.sub
      (call $core/portable/portable/i32Portable
       ;;@ core/sound/accumulator.ts:98:36
       (i32.div_s
        (get_global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize)
        ;;@ core/sound/accumulator.ts:98:71
        (i32.const 2)
       )
      )
      ;;@ core/sound/accumulator.ts:98:76
      (i32.const 1)
     )
    )
    ;;@ core/sound/accumulator.ts:99:4
    (if
     ;;@ core/sound/accumulator.ts:99:8
     (i32.ge_s
      (get_global $core/sound/sound/Sound.audioQueueIndex)
      (get_local $1)
     )
     ;;@ core/sound/accumulator.ts:99:43
     (set_global $core/sound/sound/Sound.audioQueueIndex
      (i32.sub
       ;;@ core/sound/accumulator.ts:100:6
       (get_global $core/sound/sound/Sound.audioQueueIndex)
       ;;@ core/sound/accumulator.ts:100:31
       (i32.const 1)
      )
     )
    )
   )
  )
 )
 (func $core/helpers/index/splitHighByte (; 137 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/helpers/index/splitLowByte (; 138 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/helpers/index.ts:17:23
  (i32.and
   (get_local $0)
   (i32.const 255)
  )
 )
 (func $core/sound/sound/calculateSound (; 139 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  ;;@ core/sound/sound.ts:215:2
  (set_local $1
   ;;@ core/sound/sound.ts:215:28
   (call $core/portable/portable/i32Portable
    ;;@ core/sound/sound.ts:215:49
    (call $core/sound/channel1/Channel1.getSample
     (get_local $0)
    )
   )
  )
  ;;@ core/sound/sound.ts:216:2
  (set_local $2
   ;;@ core/sound/sound.ts:216:28
   (call $core/portable/portable/i32Portable
    ;;@ core/sound/sound.ts:216:49
    (call $core/sound/channel2/Channel2.getSample
     (get_local $0)
    )
   )
  )
  ;;@ core/sound/sound.ts:217:2
  (set_local $3
   ;;@ core/sound/sound.ts:217:28
   (call $core/portable/portable/i32Portable
    ;;@ core/sound/sound.ts:217:49
    (call $core/sound/channel3/Channel3.getSample
     (get_local $0)
    )
   )
  )
  ;;@ core/sound/sound.ts:218:2
  (set_local $4
   ;;@ core/sound/sound.ts:218:28
   (call $core/portable/portable/i32Portable
    ;;@ core/sound/sound.ts:218:49
    (call $core/sound/channel4/Channel4.getSample
     (get_local $0)
    )
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
    (set_local $0
     ;;@ core/sound/sound.ts:251:24
     (i32.sub
      (call $core/portable/portable/i32Portable
       ;;@ core/sound/sound.ts:251:36
       (i32.div_s
        (get_global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize)
        ;;@ core/sound/sound.ts:251:71
        (i32.const 2)
       )
      )
      ;;@ core/sound/sound.ts:251:76
      (i32.const 1)
     )
    )
    ;;@ core/sound/sound.ts:252:4
    (if
     ;;@ core/sound/sound.ts:252:8
     (i32.ge_s
      (get_global $core/sound/sound/Sound.audioQueueIndex)
      (get_local $0)
     )
     ;;@ core/sound/sound.ts:252:43
     (set_global $core/sound/sound/Sound.audioQueueIndex
      (i32.sub
       ;;@ core/sound/sound.ts:253:6
       (get_global $core/sound/sound/Sound.audioQueueIndex)
       ;;@ core/sound/sound.ts:253:31
       (i32.const 1)
      )
     )
    )
   )
  )
 )
 (func $core/sound/sound/updateSound (; 140 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/sound/batchProcessAudio (; 141 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/registers/SoundRegisterReadTraps (; 142 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/joypad/joypad/getJoypadState (; 143 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/memory/readTraps/checkReadTraps (; 144 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/memory/readTraps.ts:20:2
  (if
   ;;@ core/memory/readTraps.ts:20:6
   (i32.lt_s
    (get_local $0)
    (i32.const 32768)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/memory/readTraps.ts:26:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     (i32.const 32768)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:26:36
    (i32.lt_s
     (get_local $0)
     (i32.const 40960)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:26:2
  (if
   (get_local $1)
   (return
    (i32.const -1)
   )
  )
  ;;@ core/memory/readTraps.ts:40:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     (i32.const 57344)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:40:42
    (i32.lt_s
     (get_local $0)
     (i32.const 65024)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:40:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:40:90
   (return
    ;;@ core/memory/readTraps.ts:42:11
    (call $core/memory/load/eightBitLoadFromGBMemory
     ;;@ core/memory/readTraps.ts:42:36
     (i32.add
      (get_local $0)
      ;;@ core/memory/readTraps.ts:42:45
      (i32.const -8192)
     )
    )
   )
  )
  ;;@ core/memory/readTraps.ts:48:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     (i32.const 65024)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:48:57
    (i32.le_s
     (get_local $0)
     (i32.const 65183)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:48:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:48:109
   (block
    ;;@ core/memory/readTraps.ts:51:4
    (if
     ;;@ core/memory/readTraps.ts:51:8
     (i32.lt_s
      (get_global $core/graphics/lcd/Lcd.currentLcdMode)
      ;;@ core/memory/readTraps.ts:51:29
      (i32.const 2)
     )
     (return
      (i32.const 255)
     )
    )
    ;;@ core/memory/readTraps.ts:58:12
    (return
     ;;@ core/memory/readTraps.ts:58:11
     (i32.const -1)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:62:2
  (if
   ;;@ core/memory/readTraps.ts:62:6
   (i32.eq
    (get_local $0)
    (i32.const 65357)
   )
   ;;@ core/memory/readTraps.ts:62:48
   (block
    ;;@ core/memory/readTraps.ts:64:4
    (set_local $1
     ;;@ core/memory/readTraps.ts:64:24
     (i32.const 255)
    )
    ;;@ core/memory/readTraps.ts:67:4
    (if
     ;;@ core/memory/readTraps.ts:67:8
     (i32.eqz
      ;;@ core/memory/readTraps.ts:67:9
      (call $core/helpers/index/checkBitOnByte
       ;;@ core/memory/readTraps.ts:67:24
       (i32.const 0)
       ;;@ core/memory/readTraps.ts:66:42
       (call $core/memory/load/eightBitLoadFromGBMemory
        (i32.const 65357)
       )
      )
     )
     ;;@ core/memory/readTraps.ts:67:56
     (set_local $1
      ;;@ core/memory/readTraps.ts:68:17
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/memory/readTraps.ts:68:32
       (i32.const 0)
       (i32.const 255)
      )
     )
    )
    ;;@ core/memory/readTraps.ts:71:4
    (if
     ;;@ core/memory/readTraps.ts:71:8
     (i32.eqz
      ;;@ core/memory/readTraps.ts:71:9
      (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
     )
     ;;@ core/memory/readTraps.ts:71:29
     (set_local $1
      ;;@ core/memory/readTraps.ts:72:17
      (call $core/helpers/index/resetBitOnByte
       ;;@ core/memory/readTraps.ts:72:32
       (i32.const 7)
       (get_local $1)
      )
     )
    )
    ;;@ core/memory/readTraps.ts:75:11
    (return
     (get_local $1)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:81:2
  (if
   ;;@ core/memory/readTraps.ts:81:6
   (i32.eq
    (get_local $0)
    (i32.const 65348)
   )
   ;;@ core/memory/readTraps.ts:81:58
   (block
    ;;@ core/memory/readTraps.ts:82:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (get_local $0)
     ;;@ core/memory/readTraps.ts:82:38
     (get_global $core/graphics/graphics/Graphics.scanlineRegister)
    )
    ;;@ core/memory/readTraps.ts:83:20
    (return
     ;;@ core/memory/readTraps.ts:83:11
     (get_global $core/graphics/graphics/Graphics.scanlineRegister)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:89:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:89:16
     (i32.const 65296)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:89:26
    (i32.le_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:89:36
     (i32.const 65318)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:89:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:89:44
   (block
    ;;@ core/memory/readTraps.ts:90:4
    (call $core/sound/sound/batchProcessAudio)
    ;;@ core/memory/readTraps.ts:91:40
    (return
     ;;@ core/memory/readTraps.ts:91:11
     (call $core/sound/registers/SoundRegisterReadTraps
      (get_local $0)
     )
    )
   )
  )
  ;;@ core/memory/readTraps.ts:95:6
  (if
   (tee_local $1
    (i32.ge_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:95:16
     (i32.const 65328)
    )
   )
   (set_local $1
    ;;@ core/memory/readTraps.ts:95:26
    (i32.le_s
     (get_local $0)
     ;;@ core/memory/readTraps.ts:95:36
     (i32.const 65343)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:95:2
  (if
   (get_local $1)
   ;;@ core/memory/readTraps.ts:95:44
   (block
    ;;@ core/memory/readTraps.ts:96:4
    (call $core/sound/sound/batchProcessAudio)
    ;;@ core/memory/readTraps.ts:97:12
    (return
     ;;@ core/memory/readTraps.ts:97:11
     (i32.const -1)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:101:2
  (if
   ;;@ core/memory/readTraps.ts:101:6
   (i32.eq
    (get_local $0)
    (i32.const 65284)
   )
   ;;@ core/memory/readTraps.ts:101:55
   (block
    ;;@ core/memory/readTraps.ts:105:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (get_local $0)
     ;;@ core/memory/readTraps.ts:104:4
     (tee_local $1
      ;;@ core/memory/readTraps.ts:104:35
      (call $core/helpers/index/splitHighByte
       ;;@ core/memory/readTraps.ts:104:49
       (get_global $core/timers/timers/Timers.dividerRegister)
      )
     )
    )
    ;;@ core/memory/readTraps.ts:106:11
    (return
     (get_local $1)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:108:2
  (if
   ;;@ core/memory/readTraps.ts:108:6
   (i32.eq
    (get_local $0)
    (i32.const 65285)
   )
   ;;@ core/memory/readTraps.ts:108:52
   (block
    ;;@ core/memory/readTraps.ts:109:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (get_local $0)
     ;;@ core/memory/readTraps.ts:109:38
     (get_global $core/timers/timers/Timers.timerCounter)
    )
    ;;@ core/memory/readTraps.ts:110:18
    (return
     ;;@ core/memory/readTraps.ts:110:11
     (get_global $core/timers/timers/Timers.timerCounter)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:114:2
  (if
   ;;@ core/memory/readTraps.ts:114:6
   (i32.eq
    (get_local $0)
    (i32.const 65295)
   )
   ;;@ core/memory/readTraps.ts:114:60
   (return
    ;;@ core/memory/readTraps.ts:116:11
    (i32.or
     ;;@ core/memory/readTraps.ts:116:18
     (get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue)
     ;;@ core/memory/readTraps.ts:116:11
     (i32.const 224)
    )
   )
  )
  ;;@ core/memory/readTraps.ts:120:2
  (if
   ;;@ core/memory/readTraps.ts:120:6
   (i32.eq
    (get_local $0)
    (i32.const 65280)
   )
   ;;@ core/memory/readTraps.ts:120:54
   (return
    ;;@ core/memory/readTraps.ts:121:11
    (call $core/joypad/joypad/getJoypadState)
   )
  )
  (i32.const -1)
 )
 (func $core/memory/load/eightBitLoadFromGBMemoryWithTraps (; 145 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/memory/banking/handleBanking (; 146 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/sound/channel1/Channel1.updateNRx0 (; 147 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel3/Channel3.updateNRx0 (; 148 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:26:4
  (set_global $core/sound/channel3/Channel3.isDacEnabled
   ;;@ core/sound/channel3.ts:26:28
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel3.ts:26:43
    (i32.const 7)
    (get_local $0)
   )
  )
 )
 (func $core/sound/channel1/Channel1.updateNRx1 (; 149 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel2/Channel2.updateNRx1 (; 150 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel3/Channel3.updateNRx1 (; 151 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:34:4
  (set_global $core/sound/channel3/Channel3.NRx1LengthLoad
   (get_local $0)
  )
  ;;@ core/sound/channel3.ts:41:4
  (set_global $core/sound/channel3/Channel3.lengthCounter
   ;;@ core/sound/channel3.ts:41:29
   (i32.sub
    (i32.const 256)
    ;;@ core/sound/channel3.ts:41:35
    (get_global $core/sound/channel3/Channel3.NRx1LengthLoad)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx1 (; 152 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel1/Channel1.updateNRx2 (; 153 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel2/Channel2.updateNRx2 (; 154 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel3/Channel3.updateNRx2 (; 155 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:49:4
  (set_global $core/sound/channel3/Channel3.NRx2VolumeCode
   ;;@ core/sound/channel3.ts:49:30
   (i32.and
    (i32.shr_s
     (get_local $0)
     ;;@ core/sound/channel3.ts:49:40
     (i32.const 5)
    )
    ;;@ core/sound/channel3.ts:49:45
    (i32.const 15)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx2 (; 156 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel1/Channel1.updateNRx3 (; 157 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel2/Channel2.updateNRx3 (; 158 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel3/Channel3.updateNRx3 (; 159 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:57:4
  (set_global $core/sound/channel3/Channel3.NRx3FrequencyLSB
   (get_local $0)
  )
  ;;@ core/sound/channel3.ts:61:4
  (set_global $core/sound/channel3/Channel3.frequency
   ;;@ core/sound/channel3.ts:60:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel3.ts:60:26
     (get_global $core/sound/channel3/Channel3.NRx4FrequencyMSB)
     ;;@ core/sound/channel3.ts:60:55
     (i32.const 8)
    )
    ;;@ core/sound/channel3.ts:60:60
    (get_global $core/sound/channel3/Channel3.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx3 (; 160 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel1/Channel1.updateNRx4 (; 161 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel1/Channel1.trigger (; 162 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel2/Channel2.updateNRx4 (; 163 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel2/Channel2.trigger (; 164 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/channel3/Channel3.updateNRx4 (; 165 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/sound/channel3.ts:70:4
  (set_global $core/sound/channel3/Channel3.NRx4LengthEnabled
   ;;@ core/sound/channel3.ts:70:33
   (call $core/helpers/index/checkBitOnByte
    ;;@ core/sound/channel3.ts:70:48
    (i32.const 6)
    (get_local $0)
   )
  )
  ;;@ core/sound/channel3.ts:71:4
  (set_global $core/sound/channel3/Channel3.NRx4FrequencyMSB
   ;;@ core/sound/channel3.ts:71:32
   (i32.and
    (get_local $0)
    ;;@ core/sound/channel3.ts:71:40
    (i32.const 7)
   )
  )
  ;;@ core/sound/channel3.ts:75:4
  (set_global $core/sound/channel3/Channel3.frequency
   ;;@ core/sound/channel3.ts:74:25
   (i32.or
    (i32.shl
     ;;@ core/sound/channel3.ts:74:26
     (get_global $core/sound/channel3/Channel3.NRx4FrequencyMSB)
     ;;@ core/sound/channel3.ts:74:55
     (i32.const 8)
    )
    ;;@ core/sound/channel3.ts:74:60
    (get_global $core/sound/channel3/Channel3.NRx3FrequencyLSB)
   )
  )
 )
 (func $core/sound/channel3/Channel3.trigger (; 166 ;) (; has Stack IR ;) (type $v)
  ;;@ core/sound/channel3.ts:236:4
  (set_global $core/sound/channel3/Channel3.isEnabled
   ;;@ core/sound/channel3.ts:236:25
   (i32.const 1)
  )
  ;;@ core/sound/channel3.ts:237:4
  (if
   (i32.eqz
    ;;@ core/sound/channel3.ts:237:8
    (get_global $core/sound/channel3/Channel3.lengthCounter)
   )
   ;;@ core/sound/channel3.ts:237:38
   (set_global $core/sound/channel3/Channel3.lengthCounter
    ;;@ core/sound/channel3.ts:238:31
    (i32.const 256)
   )
  )
  ;;@ core/sound/channel3.ts:243:13
  (call $core/sound/channel3/Channel3.resetTimer)
  ;;@ core/sound/channel3.ts:246:4
  (set_global $core/sound/channel3/Channel3.waveTablePosition
   ;;@ core/sound/channel3.ts:246:33
   (i32.const 0)
  )
  ;;@ core/sound/channel3.ts:249:4
  (if
   ;;@ core/sound/channel3.ts:249:8
   (i32.eqz
    ;;@ core/sound/channel3.ts:249:9
    (get_global $core/sound/channel3/Channel3.isDacEnabled)
   )
   ;;@ core/sound/channel3.ts:249:32
   (set_global $core/sound/channel3/Channel3.isEnabled
    ;;@ core/sound/channel3.ts:250:27
    (i32.const 0)
   )
  )
 )
 (func $core/sound/channel4/Channel4.updateNRx4 (; 167 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/channel4/Channel4.trigger (; 168 ;) (; has Stack IR ;) (type $v)
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
 (func $core/sound/sound/Sound.updateNR50 (; 169 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/sound/Sound.updateNR51 (; 170 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/sound/Sound.updateNR52 (; 171 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/sound/registers/SoundRegisterWriteTraps (; 172 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/graphics/lcd/Lcd.updateLcdStatus (; 173 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/graphics/lcd.ts:35:4
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65345)
   ;;@ core/graphics/lcd.ts:33:12
   (call $core/helpers/index/setBitOnByte
    ;;@ core/graphics/lcd.ts:33:25
    (i32.const 7)
    ;;@ core/graphics/lcd.ts:30:12
    (i32.or
     ;;@ core/graphics/lcd.ts:28:33
     (i32.and
      (get_local $0)
      ;;@ core/graphics/lcd.ts:28:41
      (i32.const 248)
     )
     ;;@ core/graphics/lcd.ts:29:39
     (i32.and
      ;;@ core/graphics/lcd.ts:27:32
      (call $core/memory/load/eightBitLoadFromGBMemory
       (i32.const 65345)
      )
      ;;@ core/graphics/lcd.ts:29:58
      (i32.const 7)
     )
    )
   )
  )
 )
 (func $core/memory/dma/startDmaTransfer (; 174 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/memory/dma/getHdmaSourceFromMemory (; 175 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/memory/dma/getHdmaDestinationFromMemory (; 176 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/memory/dma/startHdmaTransfer (; 177 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/graphics/palette/storePaletteByteInWasmMemory (; 178 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
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
 (func $core/graphics/palette/incrementPaletteIndexIfSet (; 179 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/graphics/palette/writeColorPaletteToMemory (; 180 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/interrupts/interrupts/requestTimerInterrupt (; 181 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:241:2
  (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
   ;;@ core/interrupts/interrupts.ts:241:41
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:242:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 2)
  )
 )
 (func $core/timers/timers/_getTimerCounterMaskBit (; 182 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/timers/timers/_checkDividerRegisterFallingEdgeDetector (; 183 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/timers/timers/_incrementTimerCounter (; 184 ;) (; has Stack IR ;) (type $v)
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
 (func $core/timers/timers/updateTimers (; 185 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/timers/timers/batchProcessTimers (; 186 ;) (; has Stack IR ;) (type $v)
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
 (func $core/timers/timers/Timers.updateDividerRegister (; 187 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/timers/timers/Timers.updateTimerCounter (; 188 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/timers/timers/Timers.updateTimerModulo (; 189 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/timers/timers/Timers.updateTimerControl (; 190 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/memory/writeTraps/checkWriteTraps (; 191 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (block $folding-inner1
   (block $folding-inner0
    ;;@ core/memory/writeTraps.ts:21:2
    (if
     ;;@ core/memory/writeTraps.ts:21:6
     (i32.eq
      (get_local $0)
      (i32.const 65357)
     )
     ;;@ core/memory/writeTraps.ts:21:48
     (block
      ;;@ core/memory/writeTraps.ts:23:4
      (call $core/memory/store/eightBitStoreIntoGBMemory
       (i32.const 65357)
       ;;@ core/memory/writeTraps.ts:23:61
       (i32.and
        (get_local $1)
        ;;@ core/memory/writeTraps.ts:23:69
        (i32.const 1)
       )
      )
      (br $folding-inner1)
     )
    )
    ;;@ core/memory/writeTraps.ts:34:2
    (if
     ;;@ core/memory/writeTraps.ts:34:6
     (i32.lt_s
      (get_local $0)
      (i32.const 32768)
     )
     ;;@ core/memory/writeTraps.ts:34:33
     (block
      ;;@ core/memory/writeTraps.ts:35:4
      (call $core/memory/banking/handleBanking
       (get_local $0)
       (get_local $1)
      )
      (br $folding-inner1)
     )
    )
    ;;@ core/memory/writeTraps.ts:41:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 32768)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:41:36
      (i32.lt_s
       (get_local $0)
       (i32.const 40960)
      )
     )
    )
    (br_if $folding-inner0
     (get_local $2)
    )
    ;;@ core/memory/writeTraps.ts:60:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 57344)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:60:42
      (i32.lt_s
       (get_local $0)
       (i32.const 65024)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:60:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:60:83
     (block
      ;;@ core/memory/writeTraps.ts:62:4
      (call $core/memory/store/eightBitStoreIntoGBMemory
       ;;@ core/memory/writeTraps.ts:61:26
       (i32.add
        (get_local $0)
        ;;@ core/memory/writeTraps.ts:61:35
        (i32.const -8192)
       )
       (get_local $1)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:71:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65024)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:71:50
      (i32.le_s
       (get_local $0)
       (i32.const 65183)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:71:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:71:102
     (block
      (br_if $folding-inner1
       ;;@ core/memory/writeTraps.ts:74:8
       (i32.lt_s
        (get_global $core/graphics/lcd/Lcd.currentLcdMode)
        ;;@ core/memory/writeTraps.ts:74:29
        (i32.const 2)
       )
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:84:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65184)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:84:49
      (i32.le_s
       (get_local $0)
       (i32.const 65279)
      )
     )
    )
    (br_if $folding-inner1
     (get_local $2)
    )
    ;;@ core/memory/writeTraps.ts:89:2
    (if
     ;;@ core/memory/writeTraps.ts:89:6
     (i32.eq
      (get_local $0)
      (i32.const 65282)
     )
     ;;@ core/memory/writeTraps.ts:89:61
     (return
      ;;@ core/memory/writeTraps.ts:91:18
      (call $core/serial/serial/Serial.updateTransferControl
       (get_local $1)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:96:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:96:16
       (i32.const 65296)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:96:26
      (i32.le_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:96:36
       (i32.const 65318)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:96:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:96:44
     (block
      ;;@ core/memory/writeTraps.ts:97:4
      (call $core/sound/sound/batchProcessAudio)
      ;;@ core/memory/writeTraps.ts:98:48
      (return
       ;;@ core/memory/writeTraps.ts:98:11
       (call $core/sound/registers/SoundRegisterWriteTraps
        (get_local $0)
        (get_local $1)
       )
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:103:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:103:16
       (i32.const 65328)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:103:26
      (i32.le_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:103:36
       (i32.const 65343)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:103:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:103:44
     (call $core/sound/sound/batchProcessAudio)
    )
    ;;@ core/memory/writeTraps.ts:108:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65344)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:108:48
      (i32.le_s
       (get_local $0)
       (i32.const 65355)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:108:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:108:90
     (block
      ;;@ core/memory/writeTraps.ts:112:4
      (if
       ;;@ core/memory/writeTraps.ts:112:8
       (i32.eq
        (get_local $0)
        (i32.const 65344)
       )
       ;;@ core/memory/writeTraps.ts:112:49
       (block
        ;;@ core/memory/writeTraps.ts:114:10
        (call $core/graphics/lcd/Lcd.updateLcdControl
         (get_local $1)
        )
        (br $folding-inner0)
       )
      )
      ;;@ core/memory/writeTraps.ts:118:4
      (if
       ;;@ core/memory/writeTraps.ts:118:8
       (i32.eq
        (get_local $0)
        (i32.const 65345)
       )
       ;;@ core/memory/writeTraps.ts:118:48
       (block
        ;;@ core/memory/writeTraps.ts:120:10
        (call $core/graphics/lcd/Lcd.updateLcdStatus
         (get_local $1)
        )
        (br $folding-inner1)
       )
      )
      ;;@ core/memory/writeTraps.ts:125:4
      (if
       ;;@ core/memory/writeTraps.ts:125:8
       (i32.eq
        (get_local $0)
        (i32.const 65348)
       )
       ;;@ core/memory/writeTraps.ts:125:60
       (block
        ;;@ core/memory/writeTraps.ts:126:6
        (set_global $core/graphics/graphics/Graphics.scanlineRegister
         ;;@ core/memory/writeTraps.ts:126:34
         (i32.const 0)
        )
        ;;@ core/memory/writeTraps.ts:127:6
        (call $core/memory/store/eightBitStoreIntoGBMemory
         (get_local $0)
         ;;@ core/memory/writeTraps.ts:127:40
         (i32.const 0)
        )
        (br $folding-inner1)
       )
      )
      ;;@ core/memory/writeTraps.ts:132:4
      (if
       ;;@ core/memory/writeTraps.ts:132:8
       (i32.eq
        (get_local $0)
        (i32.const 65349)
       )
       ;;@ core/memory/writeTraps.ts:132:57
       (block
        ;;@ core/memory/writeTraps.ts:133:6
        (set_global $core/graphics/lcd/Lcd.coincidenceCompare
         (get_local $1)
        )
        (br $folding-inner0)
       )
      )
      ;;@ core/memory/writeTraps.ts:140:4
      (if
       ;;@ core/memory/writeTraps.ts:140:8
       (i32.eq
        (get_local $0)
        (i32.const 65350)
       )
       ;;@ core/memory/writeTraps.ts:140:55
       (block
        ;;@ core/memory/writeTraps.ts:143:6
        (call $core/memory/dma/startDmaTransfer
         (get_local $1)
        )
        (br $folding-inner0)
       )
      )
      ;;@ core/memory/writeTraps.ts:148:4
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
          ;;@ core/memory/writeTraps.ts:150:8
          (set_global $core/graphics/graphics/Graphics.scrollX
           (get_local $1)
          )
          (br $folding-inner0)
         )
         ;;@ core/memory/writeTraps.ts:153:8
         (set_global $core/graphics/graphics/Graphics.scrollY
          (get_local $1)
         )
         (br $folding-inner0)
        )
        ;;@ core/memory/writeTraps.ts:156:8
        (set_global $core/graphics/graphics/Graphics.windowX
         (get_local $1)
        )
        (br $folding-inner0)
       )
       ;;@ core/memory/writeTraps.ts:159:8
       (set_global $core/graphics/graphics/Graphics.windowY
        (get_local $1)
       )
       (br $folding-inner0)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:168:2
    (if
     ;;@ core/memory/writeTraps.ts:168:6
     (i32.eq
      (get_local $0)
      ;;@ core/memory/writeTraps.ts:168:17
      (get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger)
     )
     ;;@ core/memory/writeTraps.ts:168:51
     (block
      ;;@ core/memory/writeTraps.ts:169:4
      (call $core/memory/dma/startHdmaTransfer
       (get_local $1)
      )
      (br $folding-inner1)
     )
    )
    ;;@ core/memory/writeTraps.ts:175:6
    (if
     (i32.eqz
      (tee_local $2
       (i32.eq
        (get_local $0)
        ;;@ core/memory/writeTraps.ts:175:17
        (get_global $core/memory/memory/Memory.memoryLocationGBCWRAMBank)
       )
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:175:53
      (i32.eq
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:175:64
       (get_global $core/memory/memory/Memory.memoryLocationGBCVRAMBank)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:175:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:175:98
     (if
      ;;@ core/memory/writeTraps.ts:176:8
      (get_global $core/memory/memory/Memory.isHblankHdmaActive)
      (block
       ;;@ core/memory/writeTraps.ts:178:8
       (if
        (tee_local $2
         ;;@ core/memory/writeTraps.ts:178:9
         (i32.ge_s
          (get_global $core/memory/memory/Memory.hblankHdmaSource)
          ;;@ core/memory/writeTraps.ts:178:36
          (i32.const 16384)
         )
        )
        (set_local $2
         ;;@ core/memory/writeTraps.ts:178:46
         (i32.le_s
          (get_global $core/memory/memory/Memory.hblankHdmaSource)
          ;;@ core/memory/writeTraps.ts:178:73
          (i32.const 32767)
         )
        )
       )
       ;;@ core/memory/writeTraps.ts:178:8
       (if
        (i32.eqz
         (get_local $2)
        )
        ;;@ core/memory/writeTraps.ts:179:8
        (if
         (tee_local $2
          ;;@ core/memory/writeTraps.ts:179:9
          (i32.ge_s
           (get_global $core/memory/memory/Memory.hblankHdmaSource)
           ;;@ core/memory/writeTraps.ts:179:36
           (i32.const 53248)
          )
         )
         (set_local $2
          ;;@ core/memory/writeTraps.ts:179:46
          (i32.le_s
           (get_global $core/memory/memory/Memory.hblankHdmaSource)
           ;;@ core/memory/writeTraps.ts:179:73
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
    ;;@ core/memory/writeTraps.ts:187:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:187:16
       (get_global $core/graphics/palette/Palette.memoryLocationBackgroundPaletteIndex)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:187:64
      (i32.le_s
       (get_local $0)
       ;;@ core/memory/writeTraps.ts:187:74
       (get_global $core/graphics/palette/Palette.memoryLocationSpritePaletteData)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:187:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:187:115
     (block
      ;;@ core/memory/writeTraps.ts:189:4
      (call $core/graphics/palette/writeColorPaletteToMemory
       (get_local $0)
       (get_local $1)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:194:6
    (if
     (tee_local $2
      (i32.ge_s
       (get_local $0)
       (i32.const 65284)
      )
     )
     (set_local $2
      ;;@ core/memory/writeTraps.ts:194:56
      (i32.le_s
       (get_local $0)
       (i32.const 65287)
      )
     )
    )
    ;;@ core/memory/writeTraps.ts:194:2
    (if
     (get_local $2)
     ;;@ core/memory/writeTraps.ts:194:101
     (block
      ;;@ core/memory/writeTraps.ts:196:4
      (call $core/timers/timers/batchProcessTimers)
      ;;@ core/memory/writeTraps.ts:198:4
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
          ;;@ core/memory/writeTraps.ts:200:15
          (call $core/timers/timers/Timers.updateDividerRegister
           (get_local $1)
          )
          (br $folding-inner1)
         )
         ;;@ core/memory/writeTraps.ts:203:15
         (call $core/timers/timers/Timers.updateTimerCounter
          (get_local $1)
         )
         (br $folding-inner0)
        )
        ;;@ core/memory/writeTraps.ts:206:15
        (call $core/timers/timers/Timers.updateTimerModulo
         (get_local $1)
        )
        (br $folding-inner0)
       )
       ;;@ core/memory/writeTraps.ts:209:15
       (call $core/timers/timers/Timers.updateTimerControl
        (get_local $1)
       )
       (br $folding-inner0)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:217:2
    (if
     ;;@ core/memory/writeTraps.ts:217:6
     (i32.eq
      (get_local $0)
      (i32.const 65280)
     )
     ;;@ core/memory/writeTraps.ts:217:54
     (call $core/joypad/joypad/Joypad.updateJoypad
      (get_local $1)
     )
    )
    ;;@ core/memory/writeTraps.ts:222:2
    (if
     ;;@ core/memory/writeTraps.ts:222:6
     (i32.eq
      (get_local $0)
      (i32.const 65295)
     )
     ;;@ core/memory/writeTraps.ts:222:60
     (block
      ;;@ core/memory/writeTraps.ts:223:15
      (call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
       (get_local $1)
      )
      (br $folding-inner0)
     )
    )
    ;;@ core/memory/writeTraps.ts:226:2
    (if
     ;;@ core/memory/writeTraps.ts:226:6
     (i32.eq
      (get_local $0)
      (i32.const 65535)
     )
     ;;@ core/memory/writeTraps.ts:226:60
     (block
      ;;@ core/memory/writeTraps.ts:227:15
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
  ;;@ core/memory/writeTraps.ts:25:11
  (i32.const 0)
 )
 (func $core/memory/store/eightBitStoreIntoGBMemoryWithTraps (; 192 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/memory/dma/hdmaTransfer (; 193 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
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
 (func $core/memory/dma/updateHblankHdma (; 194 ;) (; has Stack IR ;) (type $v)
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
 (func $core/interrupts/interrupts/requestVBlankInterrupt (; 195 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:231:2
  (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
   ;;@ core/interrupts/interrupts.ts:231:42
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:232:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 0)
  )
 )
 (func $core/graphics/lcd/checkCoincidence (; 196 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  ;;@ core/graphics/lcd.ts:204:2
  (set_local $3
   ;;@ core/graphics/lcd.ts:204:32
   (get_global $core/graphics/lcd/Lcd.coincidenceCompare)
  )
  ;;@ core/graphics/lcd.ts:205:6
  (if
   (i32.eqz
    (tee_local $2
     (i32.eqz
      (get_local $0)
     )
    )
   )
   (set_local $2
    ;;@ core/graphics/lcd.ts:205:24
    (i32.eq
     (get_local $0)
     ;;@ core/graphics/lcd.ts:205:36
     (i32.const 1)
    )
   )
  )
  ;;@ core/graphics/lcd.ts:205:6
  (if
   (get_local $2)
   (set_local $2
    ;;@ core/graphics/lcd.ts:205:42
    (i32.eq
     (get_global $core/graphics/graphics/Graphics.scanlineRegister)
     (get_local $3)
    )
   )
  )
  ;;@ core/graphics/lcd.ts:205:2
  (if
   (get_local $2)
   ;;@ core/graphics/lcd.ts:207:4
   (if
    ;;@ core/graphics/lcd.ts:207:8
    (call $core/helpers/index/checkBitOnByte
     ;;@ core/graphics/lcd.ts:207:23
     (i32.const 6)
     ;;@ core/graphics/lcd.ts:206:4
     (tee_local $1
      ;;@ core/graphics/lcd.ts:206:16
      (call $core/helpers/index/setBitOnByte
       ;;@ core/graphics/lcd.ts:206:29
       (i32.const 2)
       (get_local $1)
      )
     )
    )
    ;;@ core/graphics/lcd.ts:207:38
    (call $core/interrupts/interrupts/requestLcdInterrupt)
   )
   ;;@ core/graphics/lcd.ts:210:9
   (set_local $1
    ;;@ core/graphics/lcd.ts:211:16
    (call $core/helpers/index/resetBitOnByte
     ;;@ core/graphics/lcd.ts:211:31
     (i32.const 2)
     (get_local $1)
    )
   )
  )
  (get_local $1)
 )
 (func $core/graphics/lcd/setLcdStatus (; 197 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/graphics/lcd.ts:114:2
  (if
   ;;@ core/graphics/lcd.ts:114:6
   (i32.eqz
    ;;@ core/graphics/lcd.ts:114:7
    (get_global $core/graphics/lcd/Lcd.enabled)
   )
   (return)
  )
  ;;@ core/graphics/lcd.ts:120:2
  (set_local $1
   ;;@ core/graphics/lcd.ts:120:21
   (get_global $core/graphics/lcd/Lcd.currentLcdMode)
  )
  ;;@ core/graphics/lcd.ts:126:2
  (if
   ;;@ core/graphics/lcd.ts:126:6
   (i32.ge_s
    ;;@ core/graphics/lcd.ts:119:2
    (tee_local $2
     ;;@ core/graphics/lcd.ts:119:30
     (get_global $core/graphics/graphics/Graphics.scanlineRegister)
    )
    ;;@ core/graphics/lcd.ts:126:26
    (i32.const 144)
   )
   ;;@ core/graphics/lcd.ts:126:31
   (set_local $0
    ;;@ core/graphics/lcd.ts:128:17
    (i32.const 1)
   )
   ;;@ core/graphics/lcd.ts:129:9
   (if
    ;;@ core/graphics/lcd.ts:130:8
    (i32.ge_s
     (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
     ;;@ core/graphics/lcd.ts:130:50
     (call $core/graphics/graphics/Graphics.MIN_CYCLES_SPRITES_LCD_MODE)
    )
    ;;@ core/graphics/lcd.ts:130:81
    (set_local $0
     ;;@ core/graphics/lcd.ts:132:19
     (i32.const 2)
    )
    ;;@ core/graphics/lcd.ts:133:11
    (if
     ;;@ core/graphics/lcd.ts:133:15
     (i32.ge_s
      (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
      ;;@ core/graphics/lcd.ts:133:57
      (call $core/graphics/graphics/Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE)
     )
     ;;@ core/graphics/lcd.ts:133:94
     (set_local $0
      ;;@ core/graphics/lcd.ts:135:19
      (i32.const 3)
     )
    )
   )
  )
  ;;@ core/graphics/lcd.ts:139:2
  (if
   ;;@ core/graphics/lcd.ts:139:6
   (i32.ne
    (get_local $1)
    (get_local $0)
   )
   ;;@ core/graphics/lcd.ts:139:30
   (block
    ;;@ core/graphics/lcd.ts:141:4
    (set_local $1
     ;;@ core/graphics/lcd.ts:141:25
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.const 65345)
     )
    )
    ;;@ core/graphics/lcd.ts:144:4
    (set_global $core/graphics/lcd/Lcd.currentLcdMode
     (get_local $0)
    )
    ;;@ core/graphics/lcd.ts:146:4
    (set_local $2
     ;;@ core/graphics/lcd.ts:146:42
     (i32.const 0)
    )
    ;;@ core/graphics/lcd.ts:149:4
    (block $break|0
     (block $case3|0
      (block $case2|0
       (block $case1|0
        (if
         (get_local $0)
         (block
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
        ;;@ core/graphics/lcd.ts:153:8
        (set_local $2
         ;;@ core/graphics/lcd.ts:153:33
         (call $core/helpers/index/checkBitOnByte
          ;;@ core/graphics/lcd.ts:153:48
          (i32.const 3)
          ;;@ core/graphics/lcd.ts:152:8
          (tee_local $1
           ;;@ core/graphics/lcd.ts:152:20
           (call $core/helpers/index/resetBitOnByte
            ;;@ core/graphics/lcd.ts:152:35
            (i32.const 1)
            ;;@ core/graphics/lcd.ts:151:20
            (call $core/helpers/index/resetBitOnByte
             ;;@ core/graphics/lcd.ts:151:35
             (i32.const 0)
             (get_local $1)
            )
           )
          )
         )
        )
        ;;@ core/graphics/lcd.ts:154:8
        (br $break|0)
       )
       ;;@ core/graphics/lcd.ts:158:8
       (set_local $2
        ;;@ core/graphics/lcd.ts:158:33
        (call $core/helpers/index/checkBitOnByte
         ;;@ core/graphics/lcd.ts:158:48
         (i32.const 4)
         ;;@ core/graphics/lcd.ts:157:8
         (tee_local $1
          ;;@ core/graphics/lcd.ts:157:20
          (call $core/helpers/index/setBitOnByte
           ;;@ core/graphics/lcd.ts:157:33
           (i32.const 0)
           ;;@ core/graphics/lcd.ts:156:20
           (call $core/helpers/index/resetBitOnByte
            ;;@ core/graphics/lcd.ts:156:35
            (i32.const 1)
            (get_local $1)
           )
          )
         )
        )
       )
       ;;@ core/graphics/lcd.ts:159:8
       (br $break|0)
      )
      ;;@ core/graphics/lcd.ts:163:8
      (set_local $2
       ;;@ core/graphics/lcd.ts:163:33
       (call $core/helpers/index/checkBitOnByte
        ;;@ core/graphics/lcd.ts:163:48
        (i32.const 5)
        ;;@ core/graphics/lcd.ts:162:8
        (tee_local $1
         ;;@ core/graphics/lcd.ts:162:20
         (call $core/helpers/index/setBitOnByte
          ;;@ core/graphics/lcd.ts:162:33
          (i32.const 1)
          ;;@ core/graphics/lcd.ts:161:20
          (call $core/helpers/index/resetBitOnByte
           ;;@ core/graphics/lcd.ts:161:35
           (i32.const 0)
           (get_local $1)
          )
         )
        )
       )
      )
      ;;@ core/graphics/lcd.ts:164:8
      (br $break|0)
     )
     ;;@ core/graphics/lcd.ts:167:8
     (set_local $1
      ;;@ core/graphics/lcd.ts:167:20
      (call $core/helpers/index/setBitOnByte
       ;;@ core/graphics/lcd.ts:167:33
       (i32.const 1)
       ;;@ core/graphics/lcd.ts:166:20
       (call $core/helpers/index/setBitOnByte
        ;;@ core/graphics/lcd.ts:166:33
        (i32.const 0)
        (get_local $1)
       )
      )
     )
    )
    ;;@ core/graphics/lcd.ts:172:4
    (if
     (get_local $2)
     ;;@ core/graphics/lcd.ts:172:32
     (call $core/interrupts/interrupts/requestLcdInterrupt)
    )
    ;;@ core/graphics/lcd.ts:177:4
    (if
     (i32.eqz
      (get_local $0)
     )
     ;;@ core/graphics/lcd.ts:177:26
     (call $core/memory/dma/updateHblankHdma)
    )
    ;;@ core/graphics/lcd.ts:183:4
    (if
     ;;@ core/graphics/lcd.ts:183:8
     (i32.eq
      (get_local $0)
      ;;@ core/graphics/lcd.ts:183:23
      (i32.const 1)
     )
     ;;@ core/graphics/lcd.ts:183:26
     (call $core/interrupts/interrupts/requestVBlankInterrupt)
    )
    ;;@ core/graphics/lcd.ts:191:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (i32.const 65345)
     ;;@ core/graphics/lcd.ts:188:16
     (call $core/graphics/lcd/checkCoincidence
      (get_local $0)
      (get_local $1)
     )
    )
   )
   ;;@ core/graphics/lcd.ts:192:9
   (if
    ;;@ core/graphics/lcd.ts:192:13
    (i32.eq
     (get_local $2)
     ;;@ core/graphics/lcd.ts:192:34
     (i32.const 153)
    )
    ;;@ core/graphics/lcd.ts:197:4
    (call $core/memory/store/eightBitStoreIntoGBMemory
     (i32.const 65345)
     ;;@ core/graphics/lcd.ts:196:16
     (call $core/graphics/lcd/checkCoincidence
      (get_local $0)
      ;;@ core/graphics/lcd.ts:195:25
      (call $core/memory/load/eightBitLoadFromGBMemory
       (i32.const 65345)
      )
     )
    )
   )
  )
 )
 (func $core/graphics/graphics/updateGraphics (; 198 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/graphics/graphics.ts:184:2
  (if
   ;;@ core/graphics/graphics.ts:184:6
   (get_global $core/graphics/lcd/Lcd.enabled)
   ;;@ core/graphics/graphics.ts:184:19
   (block
    ;;@ core/graphics/graphics.ts:185:4
    (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
     (i32.add
      (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
      (get_local $0)
     )
    )
    (loop $continue|0
     (if
      ;;@ core/graphics/graphics.ts:187:11
      (i32.ge_s
       (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
       ;;@ core/graphics/graphics.ts:187:53
       (call $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE)
      )
      (block
       ;;@ core/graphics/graphics.ts:190:6
       (set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
        (i32.sub
         (get_global $core/graphics/graphics/Graphics.scanlineCycleCounter)
         ;;@ core/graphics/graphics.ts:190:48
         (call $core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE)
        )
       )
       ;;@ core/graphics/graphics.ts:197:6
       (if
        ;;@ core/graphics/graphics.ts:197:10
        (i32.eq
         ;;@ core/graphics/graphics.ts:194:6
         (tee_local $1
          ;;@ core/graphics/graphics.ts:194:34
          (get_global $core/graphics/graphics/Graphics.scanlineRegister)
         )
         ;;@ core/graphics/graphics.ts:197:31
         (i32.const 144)
        )
        ;;@ core/graphics/graphics.ts:197:36
        (block
         ;;@ core/graphics/graphics.ts:199:8
         (if
          ;;@ core/graphics/graphics.ts:199:13
          (get_global $core/config/Config.graphicsDisableScanlineRendering)
          ;;@ core/graphics/graphics.ts:201:15
          (call $core/graphics/graphics/_renderEntireFrame)
          ;;@ core/graphics/graphics.ts:199:54
          (call $core/graphics/graphics/_drawScanline
           (get_local $1)
          )
         )
         ;;@ core/graphics/graphics.ts:206:8
         (call $core/graphics/priority/clearPriorityMap)
         ;;@ core/graphics/graphics.ts:209:8
         (call $core/graphics/tiles/resetTileCache)
        )
        ;;@ core/graphics/graphics.ts:210:13
        (if
         ;;@ core/graphics/graphics.ts:210:17
         (i32.lt_s
          (get_local $1)
          ;;@ core/graphics/graphics.ts:210:36
          (i32.const 144)
         )
         ;;@ core/graphics/graphics.ts:210:41
         (if
          ;;@ core/graphics/graphics.ts:212:12
          (i32.eqz
           ;;@ core/graphics/graphics.ts:212:13
           (get_global $core/config/Config.graphicsDisableScanlineRendering)
          )
          ;;@ core/graphics/graphics.ts:212:54
          (call $core/graphics/graphics/_drawScanline
           (get_local $1)
          )
         )
        )
       )
       ;;@ core/graphics/graphics.ts:228:6
       (set_global $core/graphics/graphics/Graphics.scanlineRegister
        (tee_local $1
         ;;@ core/graphics/graphics.ts:219:6
         (if (result i32)
          ;;@ core/graphics/graphics.ts:219:10
          (i32.gt_s
           (get_local $1)
           ;;@ core/graphics/graphics.ts:219:29
           (i32.const 153)
          )
          ;;@ core/graphics/graphics.ts:222:27
          (i32.const 0)
          (i32.add
           (get_local $1)
           ;;@ core/graphics/graphics.ts:224:28
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
  ;;@ core/graphics/graphics.ts:236:2
  (call $core/graphics/lcd/setLcdStatus)
 )
 (func $core/graphics/graphics/batchProcessGraphics (; 199 ;) (; has Stack IR ;) (type $v)
  ;;@ core/graphics/graphics.ts:132:2
  (if
   ;;@ core/graphics/graphics.ts:132:6
   (i32.lt_s
    (get_global $core/graphics/graphics/Graphics.currentCycles)
    ;;@ core/graphics/graphics.ts:132:40
    (call $core/graphics/graphics/Graphics.batchProcessCycles)
   )
   (return)
  )
  (loop $continue|0
   (if
    ;;@ core/graphics/graphics.ts:136:9
    (i32.ge_s
     (get_global $core/graphics/graphics/Graphics.currentCycles)
     ;;@ core/graphics/graphics.ts:136:44
     (call $core/graphics/graphics/Graphics.batchProcessCycles)
    )
    (block
     ;;@ core/graphics/graphics.ts:137:4
     (call $core/graphics/graphics/updateGraphics
      ;;@ core/graphics/graphics.ts:137:28
      (call $core/graphics/graphics/Graphics.batchProcessCycles)
     )
     ;;@ core/graphics/graphics.ts:138:4
     (set_global $core/graphics/graphics/Graphics.currentCycles
      ;;@ core/graphics/graphics.ts:138:29
      (i32.sub
       (get_global $core/graphics/graphics/Graphics.currentCycles)
       ;;@ core/graphics/graphics.ts:138:63
       (call $core/graphics/graphics/Graphics.batchProcessCycles)
      )
     )
     (br $continue|0)
    )
   )
  )
 )
 (func $core/serial/serial/_getFallingEdgeMaskBit (; 200 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/serial/serial.ts:117:2
  (if
   ;;@ core/serial/serial.ts:117:6
   (get_global $core/serial/serial/Serial.isClockSpeedFast)
   (return
    (i32.const 2)
   )
  )
  (i32.const 7)
 )
 (func $core/serial/serial/_checkFallingEdgeDetector (; 201 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  ;;@ core/serial/serial.ts:106:6
  (if
   (tee_local $0
    (call $core/helpers/index/checkBitOnByte
     ;;@ core/serial/serial.ts:102:2
     (tee_local $2
      ;;@ core/serial/serial.ts:102:16
      (call $core/serial/serial/_getFallingEdgeMaskBit)
     )
     (get_local $0)
    )
   )
   (set_local $0
    ;;@ core/serial/serial.ts:106:44
    (i32.eqz
     ;;@ core/serial/serial.ts:106:45
     (call $core/helpers/index/checkBitOnByte
      (get_local $2)
      (get_local $1)
     )
    )
   )
  )
  ;;@ core/serial/serial.ts:106:2
  (if
   (get_local $0)
   (return
    (i32.const 1)
   )
  )
  (i32.const 0)
 )
 (func $core/interrupts/interrupts/requestSerialInterrupt (; 202 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:251:2
  (set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
   ;;@ core/interrupts/interrupts.ts:251:42
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:252:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 3)
  )
 )
 (func $core/serial/serial/updateSerial (; 203 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  ;;@ core/serial/serial.ts:63:2
  (if
   ;;@ core/serial/serial.ts:63:6
   (i32.eqz
    ;;@ core/serial/serial.ts:63:7
    (get_global $core/serial/serial/Serial.transferStartFlag)
   )
   (return)
  )
  (loop $continue|0
   (if
    ;;@ core/serial/serial.ts:69:9
    (i32.lt_s
     (get_local $1)
     (get_local $0)
    )
    (block
     ;;@ core/serial/serial.ts:70:4
     (set_local $2
      ;;@ core/serial/serial.ts:70:25
      (get_global $core/serial/serial/Serial.currentCycles)
     )
     ;;@ core/serial/serial.ts:71:4
     (set_local $1
      (i32.add
       (get_local $1)
       ;;@ core/serial/serial.ts:71:23
       (i32.const 4)
      )
     )
     ;;@ core/serial/serial.ts:72:4
     (set_global $core/serial/serial/Serial.currentCycles
      (i32.add
       (get_global $core/serial/serial/Serial.currentCycles)
       ;;@ core/serial/serial.ts:72:28
       (i32.const 4)
      )
     )
     ;;@ core/serial/serial.ts:74:4
     (if
      ;;@ core/serial/serial.ts:74:8
      (i32.gt_s
       (get_global $core/serial/serial/Serial.currentCycles)
       ;;@ core/serial/serial.ts:74:31
       (i32.const 65535)
      )
      ;;@ core/serial/serial.ts:74:39
      (set_global $core/serial/serial/Serial.currentCycles
       (i32.sub
        ;;@ core/serial/serial.ts:75:6
        (get_global $core/serial/serial/Serial.currentCycles)
        ;;@ core/serial/serial.ts:75:30
        (i32.const 65536)
       )
      )
     )
     ;;@ core/serial/serial.ts:78:4
     (if
      ;;@ core/serial/serial.ts:78:8
      (call $core/serial/serial/_checkFallingEdgeDetector
       (get_local $2)
       ;;@ core/serial/serial.ts:78:45
       (get_global $core/serial/serial/Serial.currentCycles)
      )
      ;;@ core/serial/serial.ts:78:68
      (block
       ;;@ core/serial/serial.ts:84:6
       (call $core/memory/store/eightBitStoreIntoGBMemory
        (i32.const 65281)
        ;;@ core/serial/serial.ts:83:21
        (i32.and
         ;;@ core/serial/serial.ts:82:21
         (i32.add
          (i32.shl
           ;;@ core/serial/serial.ts:81:30
           (call $core/memory/load/eightBitLoadFromGBMemory
            (i32.const 65281)
           )
           ;;@ core/serial/serial.ts:82:38
           (i32.const 1)
          )
          ;;@ core/serial/serial.ts:82:43
          (i32.const 1)
         )
         ;;@ core/serial/serial.ts:83:36
         (i32.const 255)
        )
       )
       ;;@ core/serial/serial.ts:85:6
       (set_global $core/serial/serial/Serial.numberOfBitsTransferred
        (i32.add
         (get_global $core/serial/serial/Serial.numberOfBitsTransferred)
         ;;@ core/serial/serial.ts:85:40
         (i32.const 1)
        )
       )
       ;;@ core/serial/serial.ts:87:6
       (if
        ;;@ core/serial/serial.ts:87:10
        (i32.eq
         (get_global $core/serial/serial/Serial.numberOfBitsTransferred)
         ;;@ core/serial/serial.ts:87:45
         (i32.const 8)
        )
        ;;@ core/serial/serial.ts:87:48
        (block
         ;;@ core/serial/serial.ts:88:8
         (set_global $core/serial/serial/Serial.numberOfBitsTransferred
          ;;@ core/serial/serial.ts:88:41
          (i32.const 0)
         )
         ;;@ core/serial/serial.ts:89:8
         (call $core/interrupts/interrupts/requestSerialInterrupt)
         ;;@ core/serial/serial.ts:93:8
         (call $core/memory/store/eightBitStoreIntoGBMemory
          (i32.const 65282)
          ;;@ core/serial/serial.ts:93:78
          (call $core/helpers/index/resetBitOnByte
           ;;@ core/serial/serial.ts:93:93
           (i32.const 7)
           ;;@ core/serial/serial.ts:92:30
           (call $core/memory/load/eightBitLoadFromGBMemory
            (i32.const 65282)
           )
          )
         )
         ;;@ core/serial/serial.ts:94:8
         (set_global $core/serial/serial/Serial.transferStartFlag
          ;;@ core/serial/serial.ts:94:35
          (i32.const 0)
         )
        )
       )
      )
     )
     (br $continue|0)
    )
   )
  )
 )
 (func $core/cycles/trackCyclesRan (; 204 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cycles.ts:35:2
  (set_global $core/cycles/Cycles.cycles
   (i32.add
    (get_global $core/cycles/Cycles.cycles)
    (get_local $0)
   )
  )
  ;;@ core/cycles.ts:36:2
  (if
   ;;@ core/cycles.ts:36:6
   (i32.ge_s
    (get_global $core/cycles/Cycles.cycles)
    ;;@ core/cycles.ts:36:23
    (get_global $core/cycles/Cycles.cyclesPerCycleSet)
   )
   ;;@ core/cycles.ts:36:49
   (block
    ;;@ core/cycles.ts:37:4
    (set_global $core/cycles/Cycles.cycleSets
     (i32.add
      (get_global $core/cycles/Cycles.cycleSets)
      ;;@ core/cycles.ts:37:24
      (i32.const 1)
     )
    )
    ;;@ core/cycles.ts:38:4
    (set_global $core/cycles/Cycles.cycles
     (i32.sub
      (get_global $core/cycles/Cycles.cycles)
      ;;@ core/cycles.ts:38:21
      (get_global $core/cycles/Cycles.cyclesPerCycleSet)
     )
    )
   )
  )
 )
 (func $core/cycles/syncCycles (; 205 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cycles.ts:51:2
  (if
   ;;@ core/cycles.ts:51:6
   (i32.gt_s
    (get_global $core/memory/memory/Memory.DMACycles)
    ;;@ core/cycles.ts:51:25
    (i32.const 0)
   )
   ;;@ core/cycles.ts:51:28
   (block
    ;;@ core/cycles.ts:52:4
    (set_local $0
     (i32.add
      (get_local $0)
      ;;@ core/cycles.ts:52:22
      (get_global $core/memory/memory/Memory.DMACycles)
     )
    )
    ;;@ core/cycles.ts:53:4
    (set_global $core/memory/memory/Memory.DMACycles
     ;;@ core/cycles.ts:53:23
     (i32.const 0)
    )
   )
  )
  ;;@ core/cycles.ts:57:2
  (set_global $core/cpu/cpu/Cpu.currentCycles
   (i32.add
    (get_global $core/cpu/cpu/Cpu.currentCycles)
    (get_local $0)
   )
  )
  ;;@ core/cycles.ts:60:2
  (if
   ;;@ core/cycles.ts:60:6
   (i32.eqz
    ;;@ core/cycles.ts:60:7
    (get_global $core/cpu/cpu/Cpu.isStopped)
   )
   ;;@ core/cycles.ts:60:22
   (block
    ;;@ core/cycles.ts:61:4
    (if
     ;;@ core/cycles.ts:61:8
     (get_global $core/config/Config.graphicsBatchProcessing)
     ;;@ core/cycles.ts:61:40
     (block
      ;;@ core/cycles.ts:64:6
      (set_global $core/graphics/graphics/Graphics.currentCycles
       (i32.add
        (get_global $core/graphics/graphics/Graphics.currentCycles)
        (get_local $0)
       )
      )
      ;;@ core/cycles.ts:65:6
      (call $core/graphics/graphics/batchProcessGraphics)
     )
     ;;@ core/cycles.ts:66:11
     (call $core/graphics/graphics/updateGraphics
      (get_local $0)
     )
    )
    ;;@ core/cycles.ts:70:4
    (if
     ;;@ core/cycles.ts:70:8
     (get_global $core/config/Config.audioBatchProcessing)
     ;;@ core/cycles.ts:70:37
     (set_global $core/sound/sound/Sound.currentCycles
      (i32.add
       ;;@ core/cycles.ts:71:6
       (get_global $core/sound/sound/Sound.currentCycles)
       (get_local $0)
      )
     )
     ;;@ core/cycles.ts:72:11
     (call $core/sound/sound/updateSound
      (get_local $0)
     )
    )
    ;;@ core/cycles.ts:76:4
    (call $core/serial/serial/updateSerial
     (get_local $0)
    )
   )
  )
  ;;@ core/cycles.ts:79:2
  (if
   ;;@ core/cycles.ts:79:6
   (get_global $core/config/Config.timersBatchProcessing)
   ;;@ core/cycles.ts:79:36
   (block
    ;;@ core/cycles.ts:81:4
    (set_global $core/timers/timers/Timers.currentCycles
     (i32.add
      (get_global $core/timers/timers/Timers.currentCycles)
      (get_local $0)
     )
    )
    ;;@ core/cycles.ts:82:4
    (call $core/timers/timers/batchProcessTimers)
   )
   ;;@ core/cycles.ts:83:9
   (call $core/timers/timers/updateTimers
    (get_local $0)
   )
  )
  ;;@ core/cycles.ts:87:2
  (call $core/cycles/trackCyclesRan
   (get_local $0)
  )
 )
 (func $core/cpu/opcodes/getDataByteTwo (; 206 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/opcodes.ts:164:2
  (call $core/cycles/syncCycles
   ;;@ core/cpu/opcodes.ts:164:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:165:73
  (call $core/memory/load/eightBitLoadFromGBMemory
   ;;@ core/cpu/opcodes.ts:165:38
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:165:50
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:165:71
     (i32.const 1)
    )
   )
  )
 )
 (func $core/cpu/opcodes/getDataByteOne (; 207 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/opcodes.ts:159:2
  (call $core/cycles/syncCycles
   ;;@ core/cpu/opcodes.ts:159:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:160:56
  (call $core/memory/load/eightBitLoadFromGBMemory
   ;;@ core/cpu/opcodes.ts:160:38
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
 )
 (func $core/cpu/opcodes/getConcatenatedDataByte (; 208 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/opcodes.ts:170:65
  (call $core/helpers/index/concatenateBytes
   ;;@ core/cpu/opcodes.ts:170:31
   (i32.and
    (call $core/cpu/opcodes/getDataByteTwo)
    (i32.const 255)
   )
   ;;@ core/cpu/opcodes.ts:170:49
   (i32.and
    (call $core/cpu/opcodes/getDataByteOne)
    (i32.const 255)
   )
  )
 )
 (func $core/cpu/opcodes/eightBitStoreSyncCycles (; 209 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/cpu/opcodes.ts:142:2
  (call $core/cycles/syncCycles
   ;;@ core/cpu/opcodes.ts:142:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:143:2
  (call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
   (get_local $0)
   (get_local $1)
  )
 )
 (func $core/cpu/flags/setFlagBit (; 210 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/cpu/flags/setHalfCarryFlag (; 211 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:28:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:28:13
    (i32.const 5)
    (get_local $0)
   )
  )
 )
 (func $core/cpu/flags/checkAndSetEightBitHalfCarryFlag (; 212 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/cpu/flags/setZeroFlag (; 213 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:20:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:20:13
    (i32.const 7)
    (get_local $0)
   )
  )
 )
 (func $core/cpu/flags/setSubtractFlag (; 214 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:24:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:24:13
    (i32.const 6)
    (get_local $0)
   )
  )
 )
 (func $core/cpu/flags/setCarryFlag (; 215 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/cpu/flags.ts:32:2
  (drop
   (call $core/cpu/flags/setFlagBit
    ;;@ core/cpu/flags.ts:32:13
    (i32.const 4)
    (get_local $0)
   )
  )
 )
 (func $core/helpers/index/rotateByteLeft (; 216 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps (; 217 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/cpu/opcodes/sixteenBitStoreSyncCycles (; 218 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
  ;;@ core/cpu/opcodes.ts:153:2
  (call $core/cycles/syncCycles
   ;;@ core/cpu/opcodes.ts:153:13
   (i32.const 8)
  )
  ;;@ core/cpu/opcodes.ts:154:2
  (call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
   (get_local $0)
   (get_local $1)
  )
 )
 (func $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow (; 219 ;) (; has Stack IR ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
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
 (func $core/cpu/opcodes/eightBitLoadSyncCycles (; 220 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/cpu/opcodes.ts:137:2
  (call $core/cycles/syncCycles
   ;;@ core/cpu/opcodes.ts:137:13
   (i32.const 4)
  )
  ;;@ core/cpu/opcodes.ts:138:60
  (call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
   (get_local $0)
  )
 )
 (func $core/helpers/index/rotateByteRight (; 221 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/opcodes/handleOpcode0x (; 222 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                      ;;@ core/cpu/opcodes.ts:187:6
                      (set_global $core/cpu/cpu/Cpu.registerB
                       (i32.and
                        ;;@ core/cpu/opcodes.ts:187:22
                        (call $core/helpers/index/splitHighByte
                         ;;@ core/cpu/opcodes.ts:185:6
                         (tee_local $0
                          ;;@ core/cpu/opcodes.ts:185:38
                          (i32.and
                           (call $core/cpu/opcodes/getConcatenatedDataByte)
                           (i32.const 65535)
                          )
                         )
                        )
                        (i32.const 255)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:188:6
                      (set_global $core/cpu/cpu/Cpu.registerC
                       (i32.and
                        ;;@ core/cpu/opcodes.ts:188:22
                        (call $core/helpers/index/splitLowByte
                         (get_local $0)
                        )
                        (i32.const 255)
                       )
                      )
                      (br $folding-inner1)
                     )
                     ;;@ core/cpu/opcodes.ts:198:6
                     (call $core/cpu/opcodes/eightBitStoreSyncCycles
                      ;;@ core/cpu/opcodes.ts:198:30
                      (call $core/helpers/index/concatenateBytes
                       ;;@ core/cpu/opcodes.ts:198:47
                       (get_global $core/cpu/cpu/Cpu.registerB)
                       ;;@ core/cpu/opcodes.ts:198:62
                       (get_global $core/cpu/cpu/Cpu.registerC)
                      )
                      ;;@ core/cpu/opcodes.ts:198:78
                      (get_global $core/cpu/cpu/Cpu.registerA)
                     )
                     (br $folding-inner4)
                    )
                    ;;@ core/cpu/opcodes.ts:206:6
                    (set_global $core/cpu/cpu/Cpu.registerB
                     (i32.and
                      ;;@ core/cpu/opcodes.ts:206:22
                      (call $core/helpers/index/splitHighByte
                       (tee_local $0
                        ;;@ core/cpu/opcodes.ts:206:40
                        (i32.and
                         (i32.add
                          ;;@ core/cpu/opcodes.ts:204:29
                          (call $core/helpers/index/concatenateBytes
                           ;;@ core/cpu/opcodes.ts:204:51
                           (get_global $core/cpu/cpu/Cpu.registerB)
                           ;;@ core/cpu/opcodes.ts:204:66
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
                   ;;@ core/cpu/opcodes.ts:213:6
                   (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                    ;;@ core/cpu/opcodes.ts:213:39
                    (get_global $core/cpu/cpu/Cpu.registerB)
                    ;;@ core/cpu/opcodes.ts:213:54
                    (i32.const 1)
                   )
                   ;;@ core/cpu/opcodes.ts:214:6
                   (set_global $core/cpu/cpu/Cpu.registerB
                    ;;@ core/cpu/opcodes.ts:214:22
                    (call $core/helpers/index/splitLowByte
                     ;;@ core/cpu/opcodes.ts:214:33
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.registerB)
                      ;;@ core/cpu/opcodes.ts:214:49
                      (i32.const 1)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:215:6
                   (if
                    ;;@ core/cpu/opcodes.ts:215:10
                    (get_global $core/cpu/cpu/Cpu.registerB)
                    ;;@ core/cpu/opcodes.ts:217:13
                    (call $core/cpu/flags/setZeroFlag
                     ;;@ core/cpu/opcodes.ts:218:20
                     (i32.const 0)
                    )
                    ;;@ core/cpu/opcodes.ts:215:31
                    (call $core/cpu/flags/setZeroFlag
                     ;;@ core/cpu/opcodes.ts:216:20
                     (i32.const 1)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:220:6
                   (call $core/cpu/flags/setSubtractFlag
                    ;;@ core/cpu/opcodes.ts:220:22
                    (i32.const 0)
                   )
                   (br $folding-inner4)
                  )
                  ;;@ core/cpu/opcodes.ts:226:6
                  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   ;;@ core/cpu/opcodes.ts:226:39
                   (get_global $core/cpu/cpu/Cpu.registerB)
                   ;;@ core/cpu/opcodes.ts:226:54
                   (i32.const -1)
                  )
                  ;;@ core/cpu/opcodes.ts:227:6
                  (set_global $core/cpu/cpu/Cpu.registerB
                   ;;@ core/cpu/opcodes.ts:227:22
                   (call $core/helpers/index/splitLowByte
                    ;;@ core/cpu/opcodes.ts:227:33
                    (i32.sub
                     (get_global $core/cpu/cpu/Cpu.registerB)
                     ;;@ core/cpu/opcodes.ts:227:49
                     (i32.const 1)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:228:6
                  (if
                   ;;@ core/cpu/opcodes.ts:228:10
                   (get_global $core/cpu/cpu/Cpu.registerB)
                   ;;@ core/cpu/opcodes.ts:230:13
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:231:20
                    (i32.const 0)
                   )
                   ;;@ core/cpu/opcodes.ts:228:31
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:229:20
                    (i32.const 1)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:233:6
                  (call $core/cpu/flags/setSubtractFlag
                   ;;@ core/cpu/opcodes.ts:233:22
                   (i32.const 1)
                  )
                  (br $folding-inner4)
                 )
                 ;;@ core/cpu/opcodes.ts:240:6
                 (set_global $core/cpu/cpu/Cpu.registerB
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:240:22
                   (call $core/cpu/opcodes/getDataByteOne)
                   (i32.const 255)
                  )
                 )
                 (br $folding-inner3)
                )
                ;;@ core/cpu/opcodes.ts:249:6
                (if
                 ;;@ core/cpu/opcodes.ts:249:10
                 (i32.eq
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:249:11
                   (get_global $core/cpu/cpu/Cpu.registerA)
                   ;;@ core/cpu/opcodes.ts:249:27
                   (i32.const 128)
                  )
                  ;;@ core/cpu/opcodes.ts:249:37
                  (i32.const 128)
                 )
                 ;;@ core/cpu/opcodes.ts:249:43
                 (call $core/cpu/flags/setCarryFlag
                  ;;@ core/cpu/opcodes.ts:250:21
                  (i32.const 1)
                 )
                 ;;@ core/cpu/opcodes.ts:251:13
                 (call $core/cpu/flags/setCarryFlag
                  ;;@ core/cpu/opcodes.ts:252:21
                  (i32.const 0)
                 )
                )
                ;;@ core/cpu/opcodes.ts:254:6
                (set_global $core/cpu/cpu/Cpu.registerA
                 ;;@ core/cpu/opcodes.ts:254:22
                 (call $core/helpers/index/rotateByteLeft
                  ;;@ core/cpu/opcodes.ts:254:37
                  (get_global $core/cpu/cpu/Cpu.registerA)
                 )
                )
                (br $folding-inner2)
               )
               ;;@ core/cpu/opcodes.ts:266:6
               (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                ;;@ core/cpu/opcodes.ts:266:32
                (i32.and
                 (call $core/cpu/opcodes/getConcatenatedDataByte)
                 (i32.const 65535)
                )
                ;;@ core/cpu/opcodes.ts:266:59
                (get_global $core/cpu/cpu/Cpu.stackPointer)
               )
               (br $folding-inner1)
              )
              ;;@ core/cpu/opcodes.ts:276:6
              (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
               ;;@ core/cpu/opcodes.ts:274:6
               (tee_local $0
                ;;@ core/cpu/opcodes.ts:274:28
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:274:50
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:274:65
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               ;;@ core/cpu/opcodes.ts:276:61
               (i32.and
                ;;@ core/cpu/opcodes.ts:275:6
                (tee_local $1
                 ;;@ core/cpu/opcodes.ts:275:29
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:275:51
                  (get_global $core/cpu/cpu/Cpu.registerB)
                  ;;@ core/cpu/opcodes.ts:275:66
                  (get_global $core/cpu/cpu/Cpu.registerC)
                 )
                )
                (i32.const 65535)
               )
               ;;@ core/cpu/opcodes.ts:276:79
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:278:6
              (set_global $core/cpu/cpu/Cpu.registerH
               (i32.and
                ;;@ core/cpu/opcodes.ts:278:22
                (call $core/helpers/index/splitHighByte
                 ;;@ core/cpu/opcodes.ts:277:6
                 (tee_local $0
                  ;;@ core/cpu/opcodes.ts:277:24
                  (call $core/portable/portable/u16Portable
                   ;;@ core/cpu/opcodes.ts:277:36
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
              ;;@ core/cpu/opcodes.ts:279:6
              (set_global $core/cpu/cpu/Cpu.registerL
               (i32.and
                ;;@ core/cpu/opcodes.ts:279:22
                (call $core/helpers/index/splitLowByte
                 (get_local $0)
                )
                (i32.const 255)
               )
              )
              ;;@ core/cpu/opcodes.ts:280:6
              (call $core/cpu/flags/setSubtractFlag
               ;;@ core/cpu/opcodes.ts:280:22
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:281:13
              (return
               (i32.const 8)
              )
             )
             ;;@ core/cpu/opcodes.ts:287:6
             (set_global $core/cpu/cpu/Cpu.registerA
              (i32.and
               ;;@ core/cpu/opcodes.ts:287:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:287:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:287:66
                 (get_global $core/cpu/cpu/Cpu.registerB)
                 ;;@ core/cpu/opcodes.ts:287:81
                 (get_global $core/cpu/cpu/Cpu.registerC)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner4)
            )
            ;;@ core/cpu/opcodes.ts:295:6
            (set_global $core/cpu/cpu/Cpu.registerB
             (i32.and
              ;;@ core/cpu/opcodes.ts:295:22
              (call $core/helpers/index/splitHighByte
               ;;@ core/cpu/opcodes.ts:294:6
               (tee_local $0
                ;;@ core/cpu/opcodes.ts:294:20
                (call $core/portable/portable/u16Portable
                 ;;@ core/cpu/opcodes.ts:294:32
                 (i32.sub
                  ;;@ core/cpu/opcodes.ts:293:29
                  (call $core/helpers/index/concatenateBytes
                   ;;@ core/cpu/opcodes.ts:293:51
                   (get_global $core/cpu/cpu/Cpu.registerB)
                   ;;@ core/cpu/opcodes.ts:293:66
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  ;;@ core/cpu/opcodes.ts:294:46
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
           ;;@ core/cpu/opcodes.ts:302:6
           (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
            ;;@ core/cpu/opcodes.ts:302:39
            (get_global $core/cpu/cpu/Cpu.registerC)
            ;;@ core/cpu/opcodes.ts:302:54
            (i32.const 1)
           )
           ;;@ core/cpu/opcodes.ts:303:6
           (set_global $core/cpu/cpu/Cpu.registerC
            ;;@ core/cpu/opcodes.ts:303:22
            (call $core/helpers/index/splitLowByte
             ;;@ core/cpu/opcodes.ts:303:33
             (i32.add
              (get_global $core/cpu/cpu/Cpu.registerC)
              ;;@ core/cpu/opcodes.ts:303:49
              (i32.const 1)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:304:6
           (if
            ;;@ core/cpu/opcodes.ts:304:10
            (get_global $core/cpu/cpu/Cpu.registerC)
            ;;@ core/cpu/opcodes.ts:306:13
            (call $core/cpu/flags/setZeroFlag
             ;;@ core/cpu/opcodes.ts:307:20
             (i32.const 0)
            )
            ;;@ core/cpu/opcodes.ts:304:31
            (call $core/cpu/flags/setZeroFlag
             ;;@ core/cpu/opcodes.ts:305:20
             (i32.const 1)
            )
           )
           ;;@ core/cpu/opcodes.ts:309:6
           (call $core/cpu/flags/setSubtractFlag
            ;;@ core/cpu/opcodes.ts:309:22
            (i32.const 0)
           )
           (br $folding-inner4)
          )
          ;;@ core/cpu/opcodes.ts:315:6
          (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           ;;@ core/cpu/opcodes.ts:315:39
           (get_global $core/cpu/cpu/Cpu.registerC)
           ;;@ core/cpu/opcodes.ts:315:54
           (i32.const -1)
          )
          ;;@ core/cpu/opcodes.ts:316:6
          (set_global $core/cpu/cpu/Cpu.registerC
           ;;@ core/cpu/opcodes.ts:316:22
           (call $core/helpers/index/splitLowByte
            ;;@ core/cpu/opcodes.ts:316:33
            (i32.sub
             (get_global $core/cpu/cpu/Cpu.registerC)
             ;;@ core/cpu/opcodes.ts:316:49
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:317:6
          (if
           ;;@ core/cpu/opcodes.ts:317:10
           (get_global $core/cpu/cpu/Cpu.registerC)
           ;;@ core/cpu/opcodes.ts:319:13
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:320:20
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:317:31
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:318:20
            (i32.const 1)
           )
          )
          ;;@ core/cpu/opcodes.ts:322:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:322:22
           (i32.const 1)
          )
          (br $folding-inner4)
         )
         ;;@ core/cpu/opcodes.ts:329:6
         (set_global $core/cpu/cpu/Cpu.registerC
          (i32.and
           ;;@ core/cpu/opcodes.ts:329:22
           (call $core/cpu/opcodes/getDataByteOne)
           (i32.const 255)
          )
         )
         (br $folding-inner3)
        )
        ;;@ core/cpu/opcodes.ts:338:6
        (if
         ;;@ core/cpu/opcodes.ts:338:10
         (i32.gt_u
          (i32.and
           ;;@ core/cpu/opcodes.ts:338:11
           (get_global $core/cpu/cpu/Cpu.registerA)
           ;;@ core/cpu/opcodes.ts:338:27
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:338:35
          (i32.const 0)
         )
         ;;@ core/cpu/opcodes.ts:338:38
         (call $core/cpu/flags/setCarryFlag
          ;;@ core/cpu/opcodes.ts:339:21
          (i32.const 1)
         )
         ;;@ core/cpu/opcodes.ts:340:13
         (call $core/cpu/flags/setCarryFlag
          ;;@ core/cpu/opcodes.ts:341:21
          (i32.const 0)
         )
        )
        ;;@ core/cpu/opcodes.ts:343:6
        (set_global $core/cpu/cpu/Cpu.registerA
         ;;@ core/cpu/opcodes.ts:343:22
         (call $core/helpers/index/rotateByteRight
          ;;@ core/cpu/opcodes.ts:343:38
          (get_global $core/cpu/cpu/Cpu.registerA)
         )
        )
        (br $folding-inner2)
       )
       (return
        (i32.const -1)
       )
      )
      ;;@ core/cpu/opcodes.ts:207:6
      (set_global $core/cpu/cpu/Cpu.registerC
       (i32.and
        ;;@ core/cpu/opcodes.ts:207:22
        (call $core/helpers/index/splitLowByte
         (get_local $0)
        )
        (i32.const 255)
       )
      )
      ;;@ core/cpu/opcodes.ts:208:13
      (return
       (i32.const 8)
      )
     )
     ;;@ core/cpu/opcodes.ts:189:6
     (set_global $core/cpu/cpu/Cpu.programCounter
      ;;@ core/cpu/opcodes.ts:189:27
      (call $core/portable/portable/u16Portable
       ;;@ core/cpu/opcodes.ts:189:39
       (i32.add
        (get_global $core/cpu/cpu/Cpu.programCounter)
        ;;@ core/cpu/opcodes.ts:189:60
        (i32.const 2)
       )
      )
     )
     (br $folding-inner4)
    )
    ;;@ core/cpu/opcodes.ts:256:6
    (call $core/cpu/flags/setZeroFlag
     ;;@ core/cpu/opcodes.ts:256:18
     (i32.const 0)
    )
    ;;@ core/cpu/opcodes.ts:257:6
    (call $core/cpu/flags/setSubtractFlag
     ;;@ core/cpu/opcodes.ts:257:22
     (i32.const 0)
    )
    ;;@ core/cpu/opcodes.ts:258:6
    (call $core/cpu/flags/setHalfCarryFlag
     ;;@ core/cpu/opcodes.ts:258:23
     (i32.const 0)
    )
    (br $folding-inner4)
   )
   ;;@ core/cpu/opcodes.ts:241:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:241:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:241:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:241:60
      (i32.const 1)
     )
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:179:13
  (i32.const 4)
 )
 (func $core/cpu/flags/getCarryFlag (; 223 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/helpers/index/rotateByteLeftThroughCarry (; 224 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/portable/portable/i8Portable (; 225 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/relativeJump (; 226 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/helpers/index/rotateByteRightThroughCarry (; 227 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/opcodes/handleOpcode1x (; 228 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                        ;;@ core/cpu/opcodes.ts:355:9
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
                      ;;@ core/cpu/opcodes.ts:363:6
                      (if
                       ;;@ core/cpu/opcodes.ts:363:10
                       (get_global $core/cpu/cpu/Cpu.GBCEnabled)
                       ;;@ core/cpu/opcodes.ts:366:8
                       (if
                        ;;@ core/cpu/opcodes.ts:366:12
                        (call $core/helpers/index/checkBitOnByte
                         ;;@ core/cpu/opcodes.ts:366:27
                         (i32.const 0)
                         ;;@ core/cpu/opcodes.ts:365:8
                         (tee_local $0
                          ;;@ core/cpu/opcodes.ts:365:31
                          (i32.and
                           (call $core/cpu/opcodes/eightBitLoadSyncCycles
                            (i32.const 65357)
                           )
                           (i32.const 255)
                          )
                         )
                        )
                        ;;@ core/cpu/opcodes.ts:366:44
                        (block
                         ;;@ core/cpu/opcodes.ts:381:10
                         (call $core/cpu/opcodes/eightBitStoreSyncCycles
                          (i32.const 65357)
                          (tee_local $0
                           ;;@ core/cpu/opcodes.ts:371:10
                           (if (result i32)
                            ;;@ core/cpu/opcodes.ts:371:15
                            (call $core/helpers/index/checkBitOnByte
                             ;;@ core/cpu/opcodes.ts:371:30
                             (i32.const 7)
                             ;;@ core/cpu/opcodes.ts:368:10
                             (tee_local $0
                              ;;@ core/cpu/opcodes.ts:368:24
                              (call $core/helpers/index/resetBitOnByte
                               ;;@ core/cpu/opcodes.ts:368:39
                               (i32.const 0)
                               (get_local $0)
                              )
                             )
                            )
                            ;;@ core/cpu/opcodes.ts:374:17
                            (block (result i32)
                             ;;@ core/cpu/opcodes.ts:375:12
                             (set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
                              ;;@ core/cpu/opcodes.ts:375:33
                              (i32.const 0)
                             )
                             ;;@ core/cpu/opcodes.ts:376:26
                             (call $core/helpers/index/resetBitOnByte
                              ;;@ core/cpu/opcodes.ts:376:41
                              (i32.const 7)
                              (get_local $0)
                             )
                            )
                            ;;@ core/cpu/opcodes.ts:371:47
                            (block (result i32)
                             ;;@ core/cpu/opcodes.ts:372:12
                             (set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
                              ;;@ core/cpu/opcodes.ts:372:33
                              (i32.const 1)
                             )
                             ;;@ core/cpu/opcodes.ts:373:26
                             (call $core/helpers/index/setBitOnByte
                              ;;@ core/cpu/opcodes.ts:373:39
                              (i32.const 7)
                              (get_local $0)
                             )
                            )
                           )
                          )
                         )
                         ;;@ core/cpu/opcodes.ts:385:17
                         (return
                          (i32.const 68)
                         )
                        )
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:390:6
                      (set_global $core/cpu/cpu/Cpu.isStopped
                       ;;@ core/cpu/opcodes.ts:390:22
                       (i32.const 1)
                      )
                      (br $folding-inner2)
                     )
                     ;;@ core/cpu/opcodes.ts:400:6
                     (set_global $core/cpu/cpu/Cpu.registerD
                      (i32.and
                       ;;@ core/cpu/opcodes.ts:400:22
                       (call $core/helpers/index/splitHighByte
                        ;;@ core/cpu/opcodes.ts:398:6
                        (tee_local $0
                         ;;@ core/cpu/opcodes.ts:398:38
                         (i32.and
                          (call $core/cpu/opcodes/getConcatenatedDataByte)
                          (i32.const 65535)
                         )
                        )
                       )
                       (i32.const 255)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:401:6
                     (set_global $core/cpu/cpu/Cpu.registerE
                      (i32.and
                       ;;@ core/cpu/opcodes.ts:401:22
                       (call $core/helpers/index/splitLowByte
                        (get_local $0)
                       )
                       (i32.const 255)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:402:6
                     (set_global $core/cpu/cpu/Cpu.programCounter
                      ;;@ core/cpu/opcodes.ts:402:27
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:402:39
                       (i32.add
                        (get_global $core/cpu/cpu/Cpu.programCounter)
                        ;;@ core/cpu/opcodes.ts:402:60
                        (i32.const 2)
                       )
                      )
                     )
                     (br $folding-inner3)
                    )
                    ;;@ core/cpu/opcodes.ts:409:6
                    (call $core/cpu/opcodes/eightBitStoreSyncCycles
                     ;;@ core/cpu/opcodes.ts:409:30
                     (call $core/helpers/index/concatenateBytes
                      ;;@ core/cpu/opcodes.ts:409:47
                      (get_global $core/cpu/cpu/Cpu.registerD)
                      ;;@ core/cpu/opcodes.ts:409:62
                      (get_global $core/cpu/cpu/Cpu.registerE)
                     )
                     ;;@ core/cpu/opcodes.ts:409:78
                     (get_global $core/cpu/cpu/Cpu.registerA)
                    )
                    (br $folding-inner3)
                   )
                   ;;@ core/cpu/opcodes.ts:416:6
                   (set_global $core/cpu/cpu/Cpu.registerD
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:416:22
                     (call $core/helpers/index/splitHighByte
                      ;;@ core/cpu/opcodes.ts:415:6
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:415:20
                       (call $core/portable/portable/u16Portable
                        ;;@ core/cpu/opcodes.ts:415:32
                        (i32.add
                         ;;@ core/cpu/opcodes.ts:414:24
                         (call $core/helpers/index/concatenateBytes
                          ;;@ core/cpu/opcodes.ts:414:46
                          (get_global $core/cpu/cpu/Cpu.registerD)
                          ;;@ core/cpu/opcodes.ts:414:61
                          (get_global $core/cpu/cpu/Cpu.registerE)
                         )
                         ;;@ core/cpu/opcodes.ts:415:46
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
                  ;;@ core/cpu/opcodes.ts:423:6
                  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   ;;@ core/cpu/opcodes.ts:423:39
                   (get_global $core/cpu/cpu/Cpu.registerD)
                   ;;@ core/cpu/opcodes.ts:423:54
                   (i32.const 1)
                  )
                  ;;@ core/cpu/opcodes.ts:424:6
                  (set_global $core/cpu/cpu/Cpu.registerD
                   ;;@ core/cpu/opcodes.ts:424:22
                   (call $core/helpers/index/splitLowByte
                    ;;@ core/cpu/opcodes.ts:424:33
                    (i32.add
                     (get_global $core/cpu/cpu/Cpu.registerD)
                     ;;@ core/cpu/opcodes.ts:424:49
                     (i32.const 1)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:425:6
                  (if
                   ;;@ core/cpu/opcodes.ts:425:10
                   (get_global $core/cpu/cpu/Cpu.registerD)
                   ;;@ core/cpu/opcodes.ts:427:13
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:428:20
                    (i32.const 0)
                   )
                   ;;@ core/cpu/opcodes.ts:425:31
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:426:20
                    (i32.const 1)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:430:6
                  (call $core/cpu/flags/setSubtractFlag
                   ;;@ core/cpu/opcodes.ts:430:22
                   (i32.const 0)
                  )
                  (br $folding-inner3)
                 )
                 ;;@ core/cpu/opcodes.ts:436:6
                 (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  ;;@ core/cpu/opcodes.ts:436:39
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:436:54
                  (i32.const -1)
                 )
                 ;;@ core/cpu/opcodes.ts:437:6
                 (set_global $core/cpu/cpu/Cpu.registerD
                  ;;@ core/cpu/opcodes.ts:437:22
                  (call $core/helpers/index/splitLowByte
                   ;;@ core/cpu/opcodes.ts:437:33
                   (i32.sub
                    (get_global $core/cpu/cpu/Cpu.registerD)
                    ;;@ core/cpu/opcodes.ts:437:49
                    (i32.const 1)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:438:6
                 (if
                  ;;@ core/cpu/opcodes.ts:438:10
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:440:13
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:441:20
                   (i32.const 0)
                  )
                  ;;@ core/cpu/opcodes.ts:438:31
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:439:20
                   (i32.const 1)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:443:6
                 (call $core/cpu/flags/setSubtractFlag
                  ;;@ core/cpu/opcodes.ts:443:22
                  (i32.const 1)
                 )
                 (br $folding-inner3)
                )
                ;;@ core/cpu/opcodes.ts:450:6
                (set_global $core/cpu/cpu/Cpu.registerD
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:450:22
                  (call $core/cpu/opcodes/getDataByteOne)
                  (i32.const 255)
                 )
                )
                (br $folding-inner2)
               )
               ;;@ core/cpu/opcodes.ts:459:6
               (set_local $0
                ;;@ core/cpu/opcodes.ts:459:23
                (i32.const 0)
               )
               ;;@ core/cpu/opcodes.ts:460:6
               (if
                ;;@ core/cpu/opcodes.ts:460:10
                (i32.eq
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:460:11
                  (get_global $core/cpu/cpu/Cpu.registerA)
                  ;;@ core/cpu/opcodes.ts:460:27
                  (i32.const 128)
                 )
                 ;;@ core/cpu/opcodes.ts:460:37
                 (i32.const 128)
                )
                ;;@ core/cpu/opcodes.ts:460:43
                (set_local $0
                 ;;@ core/cpu/opcodes.ts:461:21
                 (i32.const 1)
                )
               )
               ;;@ core/cpu/opcodes.ts:463:6
               (set_global $core/cpu/cpu/Cpu.registerA
                ;;@ core/cpu/opcodes.ts:463:22
                (call $core/helpers/index/rotateByteLeftThroughCarry
                 ;;@ core/cpu/opcodes.ts:463:49
                 (get_global $core/cpu/cpu/Cpu.registerA)
                )
               )
               (br $folding-inner1)
              )
              ;;@ core/cpu/opcodes.ts:482:6
              (call $core/cpu/instructions/relativeJump
               ;;@ core/cpu/opcodes.ts:482:19
               (call $core/cpu/opcodes/getDataByteOne)
              )
              ;;@ core/cpu/opcodes.ts:483:13
              (return
               (i32.const 8)
              )
             )
             ;;@ core/cpu/opcodes.ts:491:6
             (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
              ;;@ core/cpu/opcodes.ts:489:6
              (tee_local $0
               ;;@ core/cpu/opcodes.ts:489:28
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:489:50
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:489:65
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
              ;;@ core/cpu/opcodes.ts:491:61
              (i32.and
               ;;@ core/cpu/opcodes.ts:490:6
               (tee_local $1
                ;;@ core/cpu/opcodes.ts:490:29
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:490:51
                 (get_global $core/cpu/cpu/Cpu.registerD)
                 ;;@ core/cpu/opcodes.ts:490:66
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
               )
               (i32.const 65535)
              )
              ;;@ core/cpu/opcodes.ts:491:79
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:493:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:493:22
               (call $core/helpers/index/splitHighByte
                ;;@ core/cpu/opcodes.ts:492:6
                (tee_local $0
                 ;;@ core/cpu/opcodes.ts:492:24
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:492:36
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
             ;;@ core/cpu/opcodes.ts:494:6
             (set_global $core/cpu/cpu/Cpu.registerL
              (i32.and
               ;;@ core/cpu/opcodes.ts:494:22
               (call $core/helpers/index/splitLowByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:495:6
             (call $core/cpu/flags/setSubtractFlag
              ;;@ core/cpu/opcodes.ts:495:22
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:496:13
             (return
              (i32.const 8)
             )
            )
            ;;@ core/cpu/opcodes.ts:502:6
            (set_global $core/cpu/cpu/Cpu.registerA
             (i32.and
              ;;@ core/cpu/opcodes.ts:502:22
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:502:49
               (i32.and
                ;;@ core/cpu/opcodes.ts:500:29
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:500:51
                 (get_global $core/cpu/cpu/Cpu.registerD)
                 ;;@ core/cpu/opcodes.ts:500:66
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
           ;;@ core/cpu/opcodes.ts:509:6
           (set_global $core/cpu/cpu/Cpu.registerD
            (i32.and
             ;;@ core/cpu/opcodes.ts:509:22
             (call $core/helpers/index/splitHighByte
              ;;@ core/cpu/opcodes.ts:508:6
              (tee_local $0
               ;;@ core/cpu/opcodes.ts:508:20
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:508:32
                (i32.sub
                 ;;@ core/cpu/opcodes.ts:507:29
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:507:51
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:507:66
                  (get_global $core/cpu/cpu/Cpu.registerE)
                 )
                 ;;@ core/cpu/opcodes.ts:508:46
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
          ;;@ core/cpu/opcodes.ts:516:6
          (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           ;;@ core/cpu/opcodes.ts:516:39
           (get_global $core/cpu/cpu/Cpu.registerE)
           ;;@ core/cpu/opcodes.ts:516:54
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:517:6
          (set_global $core/cpu/cpu/Cpu.registerE
           ;;@ core/cpu/opcodes.ts:517:22
           (call $core/helpers/index/splitLowByte
            ;;@ core/cpu/opcodes.ts:517:33
            (i32.add
             (get_global $core/cpu/cpu/Cpu.registerE)
             ;;@ core/cpu/opcodes.ts:517:49
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:518:6
          (if
           ;;@ core/cpu/opcodes.ts:518:10
           (get_global $core/cpu/cpu/Cpu.registerE)
           ;;@ core/cpu/opcodes.ts:520:13
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:521:20
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:518:31
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:519:20
            (i32.const 1)
           )
          )
          ;;@ core/cpu/opcodes.ts:523:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:523:22
           (i32.const 0)
          )
          (br $folding-inner3)
         )
         ;;@ core/cpu/opcodes.ts:529:6
         (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          ;;@ core/cpu/opcodes.ts:529:39
          (get_global $core/cpu/cpu/Cpu.registerE)
          ;;@ core/cpu/opcodes.ts:529:54
          (i32.const -1)
         )
         ;;@ core/cpu/opcodes.ts:530:6
         (set_global $core/cpu/cpu/Cpu.registerE
          ;;@ core/cpu/opcodes.ts:530:22
          (call $core/helpers/index/splitLowByte
           ;;@ core/cpu/opcodes.ts:530:33
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.registerE)
            ;;@ core/cpu/opcodes.ts:530:49
            (i32.const 1)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:531:6
         (if
          ;;@ core/cpu/opcodes.ts:531:10
          (get_global $core/cpu/cpu/Cpu.registerE)
          ;;@ core/cpu/opcodes.ts:533:13
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:534:20
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:531:31
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:532:20
           (i32.const 1)
          )
         )
         ;;@ core/cpu/opcodes.ts:536:6
         (call $core/cpu/flags/setSubtractFlag
          ;;@ core/cpu/opcodes.ts:536:22
          (i32.const 1)
         )
         (br $folding-inner3)
        )
        ;;@ core/cpu/opcodes.ts:543:6
        (set_global $core/cpu/cpu/Cpu.registerE
         (i32.and
          ;;@ core/cpu/opcodes.ts:543:22
          (call $core/cpu/opcodes/getDataByteOne)
          (i32.const 255)
         )
        )
        (br $folding-inner2)
       )
       ;;@ core/cpu/opcodes.ts:552:6
       (set_local $0
        ;;@ core/cpu/opcodes.ts:552:22
        (i32.const 0)
       )
       ;;@ core/cpu/opcodes.ts:553:6
       (if
        ;;@ core/cpu/opcodes.ts:553:10
        (i32.eq
         (i32.and
          ;;@ core/cpu/opcodes.ts:553:11
          (get_global $core/cpu/cpu/Cpu.registerA)
          ;;@ core/cpu/opcodes.ts:553:27
          (i32.const 1)
         )
         ;;@ core/cpu/opcodes.ts:553:37
         (i32.const 1)
        )
        ;;@ core/cpu/opcodes.ts:553:43
        (set_local $0
         ;;@ core/cpu/opcodes.ts:554:20
         (i32.const 1)
        )
       )
       ;;@ core/cpu/opcodes.ts:556:6
       (set_global $core/cpu/cpu/Cpu.registerA
        ;;@ core/cpu/opcodes.ts:556:22
        (call $core/helpers/index/rotateByteRightThroughCarry
         ;;@ core/cpu/opcodes.ts:556:50
         (get_global $core/cpu/cpu/Cpu.registerA)
        )
       )
       (br $folding-inner1)
      )
      (return
       (i32.const -1)
      )
     )
     ;;@ core/cpu/opcodes.ts:417:6
     (set_global $core/cpu/cpu/Cpu.registerE
      (i32.and
       ;;@ core/cpu/opcodes.ts:417:22
       (call $core/helpers/index/splitLowByte
        (get_local $0)
       )
       (i32.const 255)
      )
     )
     ;;@ core/cpu/opcodes.ts:418:13
     (return
      (i32.const 8)
     )
    )
    ;;@ core/cpu/opcodes.ts:465:6
    (if
     (get_local $0)
     ;;@ core/cpu/opcodes.ts:465:22
     (call $core/cpu/flags/setCarryFlag
      ;;@ core/cpu/opcodes.ts:466:21
      (i32.const 1)
     )
     ;;@ core/cpu/opcodes.ts:467:13
     (call $core/cpu/flags/setCarryFlag
      ;;@ core/cpu/opcodes.ts:468:21
      (i32.const 0)
     )
    )
    ;;@ core/cpu/opcodes.ts:471:6
    (call $core/cpu/flags/setZeroFlag
     ;;@ core/cpu/opcodes.ts:471:18
     (i32.const 0)
    )
    ;;@ core/cpu/opcodes.ts:472:6
    (call $core/cpu/flags/setSubtractFlag
     ;;@ core/cpu/opcodes.ts:472:22
     (i32.const 0)
    )
    ;;@ core/cpu/opcodes.ts:473:6
    (call $core/cpu/flags/setHalfCarryFlag
     ;;@ core/cpu/opcodes.ts:473:23
     (i32.const 0)
    )
    (br $folding-inner3)
   )
   ;;@ core/cpu/opcodes.ts:391:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:391:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:391:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:391:60
      (i32.const 1)
     )
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:403:13
  (i32.const 4)
 )
 (func $core/cpu/flags/getZeroFlag (; 229 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/cpu/flags/getHalfCarryFlag (; 230 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/cpu/flags/getSubtractFlag (; 231 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/cpu/opcodes/handleOpcode2x (; 232 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                      ;;@ core/cpu/opcodes.ts:575:9
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
                    ;;@ core/cpu/opcodes.ts:580:6
                    (if
                     ;;@ core/cpu/opcodes.ts:580:10
                     (call $core/cpu/flags/getZeroFlag)
                     ;;@ core/cpu/opcodes.ts:584:13
                     (set_global $core/cpu/cpu/Cpu.programCounter
                      ;;@ core/cpu/opcodes.ts:585:29
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:585:41
                       (i32.add
                        (get_global $core/cpu/cpu/Cpu.programCounter)
                        ;;@ core/cpu/opcodes.ts:585:62
                        (i32.const 1)
                       )
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:580:31
                     (call $core/cpu/instructions/relativeJump
                      ;;@ core/cpu/opcodes.ts:582:21
                      (call $core/cpu/opcodes/getDataByteOne)
                     )
                    )
                    ;;@ core/cpu/opcodes.ts:587:13
                    (return
                     (i32.const 8)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:593:6
                   (set_global $core/cpu/cpu/Cpu.registerH
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:593:22
                     (call $core/helpers/index/splitHighByte
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:593:40
                       (i32.and
                        ;;@ core/cpu/opcodes.ts:592:31
                        (call $core/cpu/opcodes/getConcatenatedDataByte)
                        (i32.const 65535)
                       )
                      )
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:594:6
                   (set_global $core/cpu/cpu/Cpu.registerL
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:594:22
                     (call $core/helpers/index/splitLowByte
                      (get_local $0)
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:595:6
                   (set_global $core/cpu/cpu/Cpu.programCounter
                    ;;@ core/cpu/opcodes.ts:595:27
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:595:39
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.programCounter)
                      ;;@ core/cpu/opcodes.ts:595:60
                      (i32.const 2)
                     )
                    )
                   )
                   (br $folding-inner1)
                  )
                  ;;@ core/cpu/opcodes.ts:602:6
                  (call $core/cpu/opcodes/eightBitStoreSyncCycles
                   ;;@ core/cpu/opcodes.ts:602:30
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:600:6
                    (tee_local $0
                     ;;@ core/cpu/opcodes.ts:600:29
                     (call $core/helpers/index/concatenateBytes
                      ;;@ core/cpu/opcodes.ts:600:51
                      (get_global $core/cpu/cpu/Cpu.registerH)
                      ;;@ core/cpu/opcodes.ts:600:66
                      (get_global $core/cpu/cpu/Cpu.registerL)
                     )
                    )
                    (i32.const 65535)
                   )
                   ;;@ core/cpu/opcodes.ts:602:43
                   (get_global $core/cpu/cpu/Cpu.registerA)
                  )
                  ;;@ core/cpu/opcodes.ts:604:6
                  (set_global $core/cpu/cpu/Cpu.registerH
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:604:22
                    (call $core/helpers/index/splitHighByte
                     ;;@ core/cpu/opcodes.ts:603:6
                     (tee_local $0
                      ;;@ core/cpu/opcodes.ts:603:20
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:603:32
                       (i32.add
                        (get_local $0)
                        ;;@ core/cpu/opcodes.ts:603:46
                        (i32.const 1)
                       )
                      )
                     )
                    )
                    (i32.const 255)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:605:6
                  (set_global $core/cpu/cpu/Cpu.registerL
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:605:22
                    (call $core/helpers/index/splitLowByte
                     (get_local $0)
                    )
                    (i32.const 255)
                   )
                  )
                  (br $folding-inner1)
                 )
                 ;;@ core/cpu/opcodes.ts:612:6
                 (set_global $core/cpu/cpu/Cpu.registerH
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:612:22
                   (call $core/helpers/index/splitHighByte
                    ;;@ core/cpu/opcodes.ts:611:6
                    (tee_local $0
                     ;;@ core/cpu/opcodes.ts:611:20
                     (call $core/portable/portable/u16Portable
                      ;;@ core/cpu/opcodes.ts:611:32
                      (i32.add
                       ;;@ core/cpu/opcodes.ts:610:24
                       (call $core/helpers/index/concatenateBytes
                        ;;@ core/cpu/opcodes.ts:610:46
                        (get_global $core/cpu/cpu/Cpu.registerH)
                        ;;@ core/cpu/opcodes.ts:610:61
                        (get_global $core/cpu/cpu/Cpu.registerL)
                       )
                       ;;@ core/cpu/opcodes.ts:611:46
                       (i32.const 1)
                      )
                     )
                    )
                   )
                   (i32.const 255)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:613:6
                 (set_global $core/cpu/cpu/Cpu.registerL
                  (i32.and
                   ;;@ core/cpu/opcodes.ts:613:22
                   (call $core/helpers/index/splitLowByte
                    (get_local $0)
                   )
                   (i32.const 255)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:614:13
                 (return
                  (i32.const 8)
                 )
                )
                ;;@ core/cpu/opcodes.ts:619:6
                (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                 ;;@ core/cpu/opcodes.ts:619:39
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:619:54
                 (i32.const 1)
                )
                ;;@ core/cpu/opcodes.ts:620:6
                (set_global $core/cpu/cpu/Cpu.registerH
                 ;;@ core/cpu/opcodes.ts:620:22
                 (call $core/helpers/index/splitLowByte
                  ;;@ core/cpu/opcodes.ts:620:33
                  (i32.add
                   (get_global $core/cpu/cpu/Cpu.registerH)
                   ;;@ core/cpu/opcodes.ts:620:49
                   (i32.const 1)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:621:6
                (if
                 ;;@ core/cpu/opcodes.ts:621:10
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:623:13
                 (call $core/cpu/flags/setZeroFlag
                  ;;@ core/cpu/opcodes.ts:624:20
                  (i32.const 0)
                 )
                 ;;@ core/cpu/opcodes.ts:621:31
                 (call $core/cpu/flags/setZeroFlag
                  ;;@ core/cpu/opcodes.ts:622:20
                  (i32.const 1)
                 )
                )
                ;;@ core/cpu/opcodes.ts:626:6
                (call $core/cpu/flags/setSubtractFlag
                 ;;@ core/cpu/opcodes.ts:626:22
                 (i32.const 0)
                )
                (br $folding-inner1)
               )
               ;;@ core/cpu/opcodes.ts:632:6
               (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                ;;@ core/cpu/opcodes.ts:632:39
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:632:54
                (i32.const -1)
               )
               ;;@ core/cpu/opcodes.ts:633:6
               (set_global $core/cpu/cpu/Cpu.registerH
                ;;@ core/cpu/opcodes.ts:633:22
                (call $core/helpers/index/splitLowByte
                 ;;@ core/cpu/opcodes.ts:633:33
                 (i32.sub
                  (get_global $core/cpu/cpu/Cpu.registerH)
                  ;;@ core/cpu/opcodes.ts:633:49
                  (i32.const 1)
                 )
                )
               )
               ;;@ core/cpu/opcodes.ts:634:6
               (if
                ;;@ core/cpu/opcodes.ts:634:10
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:636:13
                (call $core/cpu/flags/setZeroFlag
                 ;;@ core/cpu/opcodes.ts:637:20
                 (i32.const 0)
                )
                ;;@ core/cpu/opcodes.ts:634:31
                (call $core/cpu/flags/setZeroFlag
                 ;;@ core/cpu/opcodes.ts:635:20
                 (i32.const 1)
                )
               )
               ;;@ core/cpu/opcodes.ts:639:6
               (call $core/cpu/flags/setSubtractFlag
                ;;@ core/cpu/opcodes.ts:639:22
                (i32.const 1)
               )
               (br $folding-inner1)
              )
              ;;@ core/cpu/opcodes.ts:646:6
              (set_global $core/cpu/cpu/Cpu.registerH
               (i32.and
                ;;@ core/cpu/opcodes.ts:646:22
                (call $core/cpu/opcodes/getDataByteOne)
                (i32.const 255)
               )
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:656:6
             (if
              ;;@ core/cpu/opcodes.ts:656:10
              (i32.gt_u
               (call $core/cpu/flags/getHalfCarryFlag)
               ;;@ core/cpu/opcodes.ts:656:31
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:656:34
              (set_local $1
               (i32.const 6)
              )
             )
             ;;@ core/cpu/opcodes.ts:659:6
             (if
              ;;@ core/cpu/opcodes.ts:659:10
              (i32.gt_u
               (call $core/cpu/flags/getCarryFlag)
               ;;@ core/cpu/opcodes.ts:659:27
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:659:30
              (set_local $1
               ;;@ core/cpu/opcodes.ts:660:21
               (i32.or
                (get_local $1)
                ;;@ core/cpu/opcodes.ts:660:34
                (i32.const 96)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:676:6
             (if
              (tee_local $0
               ;;@ core/cpu/opcodes.ts:663:6
               (if (result i32)
                ;;@ core/cpu/opcodes.ts:663:10
                (i32.gt_u
                 (call $core/cpu/flags/getSubtractFlag)
                 ;;@ core/cpu/opcodes.ts:663:30
                 (i32.const 0)
                )
                ;;@ core/cpu/opcodes.ts:664:27
                (call $core/helpers/index/splitLowByte
                 ;;@ core/cpu/opcodes.ts:664:38
                 (i32.sub
                  (get_global $core/cpu/cpu/Cpu.registerA)
                  (get_local $1)
                 )
                )
                ;;@ core/cpu/opcodes.ts:665:13
                (block (result i32)
                 ;;@ core/cpu/opcodes.ts:666:8
                 (if
                  ;;@ core/cpu/opcodes.ts:666:12
                  (i32.gt_u
                   (i32.and
                    ;;@ core/cpu/opcodes.ts:666:13
                    (get_global $core/cpu/cpu/Cpu.registerA)
                    ;;@ core/cpu/opcodes.ts:666:29
                    (i32.const 15)
                   )
                   ;;@ core/cpu/opcodes.ts:666:37
                   (i32.const 9)
                  )
                  ;;@ core/cpu/opcodes.ts:666:43
                  (set_local $1
                   ;;@ core/cpu/opcodes.ts:667:23
                   (i32.or
                    (get_local $1)
                    ;;@ core/cpu/opcodes.ts:667:36
                    (i32.const 6)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:669:8
                 (if
                  ;;@ core/cpu/opcodes.ts:669:12
                  (i32.gt_u
                   (get_global $core/cpu/cpu/Cpu.registerA)
                   ;;@ core/cpu/opcodes.ts:669:28
                   (i32.const 153)
                  )
                  ;;@ core/cpu/opcodes.ts:669:34
                  (set_local $1
                   ;;@ core/cpu/opcodes.ts:670:23
                   (i32.or
                    (get_local $1)
                    ;;@ core/cpu/opcodes.ts:670:36
                    (i32.const 96)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:672:27
                 (call $core/helpers/index/splitLowByte
                  ;;@ core/cpu/opcodes.ts:672:38
                  (i32.add
                   (get_global $core/cpu/cpu/Cpu.registerA)
                   (get_local $1)
                  )
                 )
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:678:13
              (call $core/cpu/flags/setZeroFlag
               ;;@ core/cpu/opcodes.ts:679:20
               (i32.const 0)
              )
              ;;@ core/cpu/opcodes.ts:676:34
              (call $core/cpu/flags/setZeroFlag
               ;;@ core/cpu/opcodes.ts:677:20
               (i32.const 1)
              )
             )
             ;;@ core/cpu/opcodes.ts:681:6
             (if
              ;;@ core/cpu/opcodes.ts:681:10
              (i32.and
               (get_local $1)
               ;;@ core/cpu/opcodes.ts:681:24
               (i32.const 96)
              )
              ;;@ core/cpu/opcodes.ts:681:37
              (call $core/cpu/flags/setCarryFlag
               ;;@ core/cpu/opcodes.ts:682:21
               (i32.const 1)
              )
              ;;@ core/cpu/opcodes.ts:683:13
              (call $core/cpu/flags/setCarryFlag
               ;;@ core/cpu/opcodes.ts:684:21
               (i32.const 0)
              )
             )
             ;;@ core/cpu/opcodes.ts:686:6
             (call $core/cpu/flags/setHalfCarryFlag
              ;;@ core/cpu/opcodes.ts:686:23
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:688:6
             (set_global $core/cpu/cpu/Cpu.registerA
              (get_local $0)
             )
             (br $folding-inner1)
            )
            ;;@ core/cpu/opcodes.ts:693:6
            (if
             ;;@ core/cpu/opcodes.ts:693:10
             (i32.gt_u
              (call $core/cpu/flags/getZeroFlag)
              ;;@ core/cpu/opcodes.ts:693:26
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:693:29
             (call $core/cpu/instructions/relativeJump
              ;;@ core/cpu/opcodes.ts:695:21
              (call $core/cpu/opcodes/getDataByteOne)
             )
             ;;@ core/cpu/opcodes.ts:697:13
             (set_global $core/cpu/cpu/Cpu.programCounter
              ;;@ core/cpu/opcodes.ts:698:29
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:698:41
               (i32.add
                (get_global $core/cpu/cpu/Cpu.programCounter)
                ;;@ core/cpu/opcodes.ts:698:62
                (i32.const 1)
               )
              )
             )
            )
            ;;@ core/cpu/opcodes.ts:700:13
            (return
             (i32.const 8)
            )
           )
           ;;@ core/cpu/opcodes.ts:706:6
           (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
            ;;@ core/cpu/opcodes.ts:705:6
            (tee_local $1
             ;;@ core/cpu/opcodes.ts:705:29
             (call $core/helpers/index/concatenateBytes
              ;;@ core/cpu/opcodes.ts:705:51
              (get_global $core/cpu/cpu/Cpu.registerH)
              ;;@ core/cpu/opcodes.ts:705:66
              (get_global $core/cpu/cpu/Cpu.registerL)
             )
            )
            ;;@ core/cpu/opcodes.ts:706:57
            (i32.and
             (get_local $1)
             (i32.const 65535)
            )
            ;;@ core/cpu/opcodes.ts:706:70
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:708:6
           (set_global $core/cpu/cpu/Cpu.registerH
            (i32.and
             ;;@ core/cpu/opcodes.ts:708:22
             (call $core/helpers/index/splitHighByte
              ;;@ core/cpu/opcodes.ts:707:6
              (tee_local $1
               ;;@ core/cpu/opcodes.ts:707:20
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:707:32
                (i32.shl
                 (get_local $1)
                 ;;@ core/cpu/opcodes.ts:707:46
                 (i32.const 1)
                )
               )
              )
             )
             (i32.const 255)
            )
           )
           ;;@ core/cpu/opcodes.ts:709:6
           (set_global $core/cpu/cpu/Cpu.registerL
            (i32.and
             ;;@ core/cpu/opcodes.ts:709:22
             (call $core/helpers/index/splitLowByte
              (get_local $1)
             )
             (i32.const 255)
            )
           )
           ;;@ core/cpu/opcodes.ts:710:6
           (call $core/cpu/flags/setSubtractFlag
            ;;@ core/cpu/opcodes.ts:710:22
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:711:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:717:6
          (set_global $core/cpu/cpu/Cpu.registerA
           (i32.and
            ;;@ core/cpu/opcodes.ts:717:22
            (call $core/cpu/opcodes/eightBitLoadSyncCycles
             ;;@ core/cpu/opcodes.ts:717:49
             (i32.and
              ;;@ core/cpu/opcodes.ts:715:6
              (tee_local $1
               ;;@ core/cpu/opcodes.ts:715:29
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:715:51
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:715:66
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
              (i32.const 65535)
             )
            )
            (i32.const 255)
           )
          )
          ;;@ core/cpu/opcodes.ts:719:6
          (set_global $core/cpu/cpu/Cpu.registerH
           (i32.and
            ;;@ core/cpu/opcodes.ts:719:22
            (call $core/helpers/index/splitHighByte
             ;;@ core/cpu/opcodes.ts:718:6
             (tee_local $1
              ;;@ core/cpu/opcodes.ts:718:20
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:718:32
               (i32.add
                (get_local $1)
                ;;@ core/cpu/opcodes.ts:718:46
                (i32.const 1)
               )
              )
             )
            )
            (i32.const 255)
           )
          )
          ;;@ core/cpu/opcodes.ts:720:6
          (set_global $core/cpu/cpu/Cpu.registerL
           (i32.and
            ;;@ core/cpu/opcodes.ts:720:22
            (call $core/helpers/index/splitLowByte
             (get_local $1)
            )
            (i32.const 255)
           )
          )
          (br $folding-inner1)
         )
         ;;@ core/cpu/opcodes.ts:727:6
         (set_global $core/cpu/cpu/Cpu.registerH
          (i32.and
           ;;@ core/cpu/opcodes.ts:727:22
           (call $core/helpers/index/splitHighByte
            ;;@ core/cpu/opcodes.ts:726:6
            (tee_local $1
             ;;@ core/cpu/opcodes.ts:726:20
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:726:32
              (i32.sub
               ;;@ core/cpu/opcodes.ts:725:24
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:725:46
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:725:61
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
               ;;@ core/cpu/opcodes.ts:726:46
               (i32.const 1)
              )
             )
            )
           )
           (i32.const 255)
          )
         )
         ;;@ core/cpu/opcodes.ts:728:6
         (set_global $core/cpu/cpu/Cpu.registerL
          (i32.and
           ;;@ core/cpu/opcodes.ts:728:22
           (call $core/helpers/index/splitLowByte
            (get_local $1)
           )
           (i32.const 255)
          )
         )
         ;;@ core/cpu/opcodes.ts:729:13
         (return
          (i32.const 8)
         )
        )
        ;;@ core/cpu/opcodes.ts:734:6
        (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
         ;;@ core/cpu/opcodes.ts:734:39
         (get_global $core/cpu/cpu/Cpu.registerL)
         ;;@ core/cpu/opcodes.ts:734:54
         (i32.const 1)
        )
        ;;@ core/cpu/opcodes.ts:735:6
        (set_global $core/cpu/cpu/Cpu.registerL
         ;;@ core/cpu/opcodes.ts:735:22
         (call $core/helpers/index/splitLowByte
          ;;@ core/cpu/opcodes.ts:735:33
          (i32.add
           (get_global $core/cpu/cpu/Cpu.registerL)
           ;;@ core/cpu/opcodes.ts:735:49
           (i32.const 1)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:736:6
        (if
         ;;@ core/cpu/opcodes.ts:736:10
         (get_global $core/cpu/cpu/Cpu.registerL)
         ;;@ core/cpu/opcodes.ts:738:13
         (call $core/cpu/flags/setZeroFlag
          ;;@ core/cpu/opcodes.ts:739:20
          (i32.const 0)
         )
         ;;@ core/cpu/opcodes.ts:736:31
         (call $core/cpu/flags/setZeroFlag
          ;;@ core/cpu/opcodes.ts:737:20
          (i32.const 1)
         )
        )
        ;;@ core/cpu/opcodes.ts:741:6
        (call $core/cpu/flags/setSubtractFlag
         ;;@ core/cpu/opcodes.ts:741:22
         (i32.const 0)
        )
        (br $folding-inner1)
       )
       ;;@ core/cpu/opcodes.ts:747:6
       (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
        ;;@ core/cpu/opcodes.ts:747:39
        (get_global $core/cpu/cpu/Cpu.registerL)
        ;;@ core/cpu/opcodes.ts:747:54
        (i32.const -1)
       )
       ;;@ core/cpu/opcodes.ts:748:6
       (set_global $core/cpu/cpu/Cpu.registerL
        ;;@ core/cpu/opcodes.ts:748:22
        (call $core/helpers/index/splitLowByte
         ;;@ core/cpu/opcodes.ts:748:33
         (i32.sub
          (get_global $core/cpu/cpu/Cpu.registerL)
          ;;@ core/cpu/opcodes.ts:748:49
          (i32.const 1)
         )
        )
       )
       ;;@ core/cpu/opcodes.ts:749:6
       (if
        ;;@ core/cpu/opcodes.ts:749:10
        (get_global $core/cpu/cpu/Cpu.registerL)
        ;;@ core/cpu/opcodes.ts:751:13
        (call $core/cpu/flags/setZeroFlag
         ;;@ core/cpu/opcodes.ts:752:20
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:749:31
        (call $core/cpu/flags/setZeroFlag
         ;;@ core/cpu/opcodes.ts:750:20
         (i32.const 1)
        )
       )
       ;;@ core/cpu/opcodes.ts:754:6
       (call $core/cpu/flags/setSubtractFlag
        ;;@ core/cpu/opcodes.ts:754:22
        (i32.const 1)
       )
       (br $folding-inner1)
      )
      ;;@ core/cpu/opcodes.ts:760:6
      (set_global $core/cpu/cpu/Cpu.registerL
       (i32.and
        ;;@ core/cpu/opcodes.ts:760:22
        (call $core/cpu/opcodes/getDataByteOne)
        (i32.const 255)
       )
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:767:6
     (set_global $core/cpu/cpu/Cpu.registerA
      (i32.and
       ;;@ core/cpu/opcodes.ts:767:22
       (i32.xor
        ;;@ core/cpu/opcodes.ts:767:23
        (get_global $core/cpu/cpu/Cpu.registerA)
        (i32.const -1)
       )
       (i32.const 255)
      )
     )
     ;;@ core/cpu/opcodes.ts:768:6
     (call $core/cpu/flags/setSubtractFlag
      ;;@ core/cpu/opcodes.ts:768:22
      (i32.const 1)
     )
     ;;@ core/cpu/opcodes.ts:769:6
     (call $core/cpu/flags/setHalfCarryFlag
      ;;@ core/cpu/opcodes.ts:769:23
      (i32.const 1)
     )
     (br $folding-inner1)
    )
    (return
     (i32.const -1)
    )
   )
   ;;@ core/cpu/opcodes.ts:647:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:647:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:647:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:647:60
      (i32.const 1)
     )
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:596:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode3x (; 233 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                        ;;@ core/cpu/opcodes.ts:777:9
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
                      ;;@ core/cpu/opcodes.ts:780:6
                      (if
                       ;;@ core/cpu/opcodes.ts:780:10
                       (call $core/cpu/flags/getCarryFlag)
                       ;;@ core/cpu/opcodes.ts:784:13
                       (set_global $core/cpu/cpu/Cpu.programCounter
                        ;;@ core/cpu/opcodes.ts:785:29
                        (call $core/portable/portable/u16Portable
                         ;;@ core/cpu/opcodes.ts:785:41
                         (i32.add
                          (get_global $core/cpu/cpu/Cpu.programCounter)
                          ;;@ core/cpu/opcodes.ts:785:62
                          (i32.const 1)
                         )
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:780:32
                       (call $core/cpu/instructions/relativeJump
                        ;;@ core/cpu/opcodes.ts:782:21
                        (call $core/cpu/opcodes/getDataByteOne)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:787:13
                      (return
                       (i32.const 8)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:792:6
                     (set_global $core/cpu/cpu/Cpu.stackPointer
                      (i32.and
                       ;;@ core/cpu/opcodes.ts:792:25
                       (call $core/cpu/opcodes/getConcatenatedDataByte)
                       (i32.const 65535)
                      )
                     )
                     ;;@ core/cpu/opcodes.ts:793:6
                     (set_global $core/cpu/cpu/Cpu.programCounter
                      ;;@ core/cpu/opcodes.ts:793:27
                      (call $core/portable/portable/u16Portable
                       ;;@ core/cpu/opcodes.ts:793:39
                       (i32.add
                        (get_global $core/cpu/cpu/Cpu.programCounter)
                        ;;@ core/cpu/opcodes.ts:793:60
                        (i32.const 2)
                       )
                      )
                     )
                     (br $folding-inner3)
                    )
                    ;;@ core/cpu/opcodes.ts:800:6
                    (call $core/cpu/opcodes/eightBitStoreSyncCycles
                     ;;@ core/cpu/opcodes.ts:800:30
                     (i32.and
                      ;;@ core/cpu/opcodes.ts:798:6
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:798:29
                       (call $core/helpers/index/concatenateBytes
                        ;;@ core/cpu/opcodes.ts:798:51
                        (get_global $core/cpu/cpu/Cpu.registerH)
                        ;;@ core/cpu/opcodes.ts:798:66
                        (get_global $core/cpu/cpu/Cpu.registerL)
                       )
                      )
                      (i32.const 65535)
                     )
                     ;;@ core/cpu/opcodes.ts:800:43
                     (get_global $core/cpu/cpu/Cpu.registerA)
                    )
                    (br $folding-inner1)
                   )
                   ;;@ core/cpu/opcodes.ts:808:6
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:808:25
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:808:37
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:808:56
                      (i32.const 1)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:809:13
                   (return
                    (i32.const 8)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:821:6
                  (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   ;;@ core/cpu/opcodes.ts:816:6
                   (tee_local $1
                    ;;@ core/cpu/opcodes.ts:816:27
                    (call $core/cpu/opcodes/eightBitLoadSyncCycles
                     ;;@ core/cpu/opcodes.ts:816:54
                     (i32.and
                      ;;@ core/cpu/opcodes.ts:814:6
                      (tee_local $0
                       ;;@ core/cpu/opcodes.ts:814:29
                       (call $core/helpers/index/concatenateBytes
                        ;;@ core/cpu/opcodes.ts:814:51
                        (get_global $core/cpu/cpu/Cpu.registerH)
                        ;;@ core/cpu/opcodes.ts:814:66
                        (get_global $core/cpu/cpu/Cpu.registerL)
                       )
                      )
                      (i32.const 65535)
                     )
                    )
                   )
                   (i32.const 1)
                  )
                  ;;@ core/cpu/opcodes.ts:824:6
                  (if
                   ;;@ core/cpu/opcodes.ts:822:6
                   (tee_local $1
                    ;;@ core/cpu/opcodes.ts:822:19
                    (call $core/helpers/index/splitLowByte
                     ;;@ core/cpu/opcodes.ts:822:30
                     (i32.add
                      (get_local $1)
                      (i32.const 1)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:826:13
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:827:20
                    (i32.const 0)
                   )
                   ;;@ core/cpu/opcodes.ts:824:28
                   (call $core/cpu/flags/setZeroFlag
                    ;;@ core/cpu/opcodes.ts:825:20
                    (i32.const 1)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:829:6
                  (call $core/cpu/flags/setSubtractFlag
                   ;;@ core/cpu/opcodes.ts:829:22
                   (i32.const 0)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:842:6
                 (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  ;;@ core/cpu/opcodes.ts:839:6
                  (tee_local $1
                   ;;@ core/cpu/opcodes.ts:839:27
                   (call $core/cpu/opcodes/eightBitLoadSyncCycles
                    ;;@ core/cpu/opcodes.ts:839:54
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:837:6
                     (tee_local $0
                      ;;@ core/cpu/opcodes.ts:837:29
                      (call $core/helpers/index/concatenateBytes
                       ;;@ core/cpu/opcodes.ts:837:51
                       (get_global $core/cpu/cpu/Cpu.registerH)
                       ;;@ core/cpu/opcodes.ts:837:66
                       (get_global $core/cpu/cpu/Cpu.registerL)
                      )
                     )
                     (i32.const 65535)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:842:55
                  (i32.const -1)
                 )
                 ;;@ core/cpu/opcodes.ts:844:6
                 (if
                  ;;@ core/cpu/opcodes.ts:843:6
                  (tee_local $1
                   ;;@ core/cpu/opcodes.ts:843:19
                   (call $core/helpers/index/splitLowByte
                    ;;@ core/cpu/opcodes.ts:843:30
                    (i32.sub
                     (get_local $1)
                     ;;@ core/cpu/opcodes.ts:843:43
                     (i32.const 1)
                    )
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:846:13
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:847:20
                   (i32.const 0)
                  )
                  ;;@ core/cpu/opcodes.ts:844:28
                  (call $core/cpu/flags/setZeroFlag
                   ;;@ core/cpu/opcodes.ts:845:20
                   (i32.const 1)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:849:6
                 (call $core/cpu/flags/setSubtractFlag
                  ;;@ core/cpu/opcodes.ts:849:22
                  (i32.const 1)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:857:6
                (call $core/cpu/opcodes/eightBitStoreSyncCycles
                 ;;@ core/cpu/opcodes.ts:857:30
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:857:35
                  (call $core/helpers/index/concatenateBytes
                   ;;@ core/cpu/opcodes.ts:857:52
                   (get_global $core/cpu/cpu/Cpu.registerH)
                   ;;@ core/cpu/opcodes.ts:857:67
                   (get_global $core/cpu/cpu/Cpu.registerL)
                  )
                  (i32.const 65535)
                 )
                 ;;@ core/cpu/opcodes.ts:857:83
                 (i32.and
                  (call $core/cpu/opcodes/getDataByteOne)
                  (i32.const 255)
                 )
                )
                (br $folding-inner2)
               )
               ;;@ core/cpu/opcodes.ts:865:6
               (call $core/cpu/flags/setSubtractFlag
                ;;@ core/cpu/opcodes.ts:865:22
                (i32.const 0)
               )
               ;;@ core/cpu/opcodes.ts:866:6
               (call $core/cpu/flags/setHalfCarryFlag
                ;;@ core/cpu/opcodes.ts:866:23
                (i32.const 0)
               )
               ;;@ core/cpu/opcodes.ts:867:6
               (call $core/cpu/flags/setCarryFlag
                ;;@ core/cpu/opcodes.ts:867:19
                (i32.const 1)
               )
               (br $folding-inner3)
              )
              ;;@ core/cpu/opcodes.ts:872:6
              (if
               ;;@ core/cpu/opcodes.ts:872:10
               (i32.eq
                (call $core/cpu/flags/getCarryFlag)
                ;;@ core/cpu/opcodes.ts:872:29
                (i32.const 1)
               )
               ;;@ core/cpu/opcodes.ts:872:32
               (call $core/cpu/instructions/relativeJump
                ;;@ core/cpu/opcodes.ts:874:21
                (call $core/cpu/opcodes/getDataByteOne)
               )
               ;;@ core/cpu/opcodes.ts:876:13
               (set_global $core/cpu/cpu/Cpu.programCounter
                ;;@ core/cpu/opcodes.ts:877:29
                (call $core/portable/portable/u16Portable
                 ;;@ core/cpu/opcodes.ts:877:41
                 (i32.add
                  (get_global $core/cpu/cpu/Cpu.programCounter)
                  ;;@ core/cpu/opcodes.ts:877:62
                  (i32.const 1)
                 )
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:879:13
              (return
               (i32.const 8)
              )
             )
             ;;@ core/cpu/opcodes.ts:885:6
             (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
              ;;@ core/cpu/opcodes.ts:884:6
              (tee_local $1
               ;;@ core/cpu/opcodes.ts:884:29
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:884:51
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:884:66
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
              ;;@ core/cpu/opcodes.ts:885:62
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:885:80
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:887:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:887:22
               (call $core/helpers/index/splitHighByte
                ;;@ core/cpu/opcodes.ts:886:6
                (tee_local $0
                 ;;@ core/cpu/opcodes.ts:886:24
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:886:36
                  (i32.add
                   (get_local $1)
                   ;;@ core/cpu/opcodes.ts:886:56
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                  )
                 )
                )
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:888:6
             (set_global $core/cpu/cpu/Cpu.registerL
              (i32.and
               ;;@ core/cpu/opcodes.ts:888:22
               (call $core/helpers/index/splitLowByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:889:6
             (call $core/cpu/flags/setSubtractFlag
              ;;@ core/cpu/opcodes.ts:889:22
              (i32.const 0)
             )
             ;;@ core/cpu/opcodes.ts:890:13
             (return
              (i32.const 8)
             )
            )
            ;;@ core/cpu/opcodes.ts:896:6
            (set_global $core/cpu/cpu/Cpu.registerA
             (i32.and
              ;;@ core/cpu/opcodes.ts:896:22
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:896:49
               (i32.and
                ;;@ core/cpu/opcodes.ts:894:6
                (tee_local $0
                 ;;@ core/cpu/opcodes.ts:894:29
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:894:51
                  (get_global $core/cpu/cpu/Cpu.registerH)
                  ;;@ core/cpu/opcodes.ts:894:66
                  (get_global $core/cpu/cpu/Cpu.registerL)
                 )
                )
                (i32.const 65535)
               )
              )
              (i32.const 255)
             )
            )
            (br $folding-inner1)
           )
           ;;@ core/cpu/opcodes.ts:904:6
           (set_global $core/cpu/cpu/Cpu.stackPointer
            ;;@ core/cpu/opcodes.ts:904:25
            (call $core/portable/portable/u16Portable
             ;;@ core/cpu/opcodes.ts:904:37
             (i32.sub
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:904:56
              (i32.const 1)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:905:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:910:6
          (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           ;;@ core/cpu/opcodes.ts:910:39
           (get_global $core/cpu/cpu/Cpu.registerA)
           ;;@ core/cpu/opcodes.ts:910:54
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:911:6
          (set_global $core/cpu/cpu/Cpu.registerA
           ;;@ core/cpu/opcodes.ts:911:22
           (call $core/helpers/index/splitLowByte
            ;;@ core/cpu/opcodes.ts:911:33
            (i32.add
             (get_global $core/cpu/cpu/Cpu.registerA)
             ;;@ core/cpu/opcodes.ts:911:49
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:912:6
          (if
           ;;@ core/cpu/opcodes.ts:912:10
           (get_global $core/cpu/cpu/Cpu.registerA)
           ;;@ core/cpu/opcodes.ts:914:13
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:915:20
            (i32.const 0)
           )
           ;;@ core/cpu/opcodes.ts:912:31
           (call $core/cpu/flags/setZeroFlag
            ;;@ core/cpu/opcodes.ts:913:20
            (i32.const 1)
           )
          )
          ;;@ core/cpu/opcodes.ts:917:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:917:22
           (i32.const 0)
          )
          (br $folding-inner3)
         )
         ;;@ core/cpu/opcodes.ts:923:6
         (call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          ;;@ core/cpu/opcodes.ts:923:39
          (get_global $core/cpu/cpu/Cpu.registerA)
          ;;@ core/cpu/opcodes.ts:923:54
          (i32.const -1)
         )
         ;;@ core/cpu/opcodes.ts:924:6
         (set_global $core/cpu/cpu/Cpu.registerA
          ;;@ core/cpu/opcodes.ts:924:22
          (call $core/helpers/index/splitLowByte
           ;;@ core/cpu/opcodes.ts:924:33
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.registerA)
            ;;@ core/cpu/opcodes.ts:924:49
            (i32.const 1)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:925:6
         (if
          ;;@ core/cpu/opcodes.ts:925:10
          (get_global $core/cpu/cpu/Cpu.registerA)
          ;;@ core/cpu/opcodes.ts:927:13
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:928:20
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:925:31
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:926:20
           (i32.const 1)
          )
         )
         ;;@ core/cpu/opcodes.ts:930:6
         (call $core/cpu/flags/setSubtractFlag
          ;;@ core/cpu/opcodes.ts:930:22
          (i32.const 1)
         )
         (br $folding-inner3)
        )
        ;;@ core/cpu/opcodes.ts:936:6
        (set_global $core/cpu/cpu/Cpu.registerA
         (i32.and
          ;;@ core/cpu/opcodes.ts:936:22
          (call $core/cpu/opcodes/getDataByteOne)
          (i32.const 255)
         )
        )
        (br $folding-inner2)
       )
       ;;@ core/cpu/opcodes.ts:943:6
       (call $core/cpu/flags/setSubtractFlag
        ;;@ core/cpu/opcodes.ts:943:22
        (i32.const 0)
       )
       ;;@ core/cpu/opcodes.ts:944:6
       (call $core/cpu/flags/setHalfCarryFlag
        ;;@ core/cpu/opcodes.ts:944:23
        (i32.const 0)
       )
       ;;@ core/cpu/opcodes.ts:945:6
       (if
        ;;@ core/cpu/opcodes.ts:945:10
        (i32.gt_u
         (call $core/cpu/flags/getCarryFlag)
         ;;@ core/cpu/opcodes.ts:945:27
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:945:30
        (call $core/cpu/flags/setCarryFlag
         ;;@ core/cpu/opcodes.ts:946:21
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:947:13
        (call $core/cpu/flags/setCarryFlag
         ;;@ core/cpu/opcodes.ts:948:21
         (i32.const 1)
        )
       )
       (br $folding-inner3)
      )
      (return
       (i32.const -1)
      )
     )
     ;;@ core/cpu/opcodes.ts:831:6
     (call $core/cpu/opcodes/eightBitStoreSyncCycles
      ;;@ core/cpu/opcodes.ts:831:30
      (i32.and
       (get_local $0)
       (i32.const 65535)
      )
      (get_local $1)
     )
     (br $folding-inner3)
    )
    ;;@ core/cpu/opcodes.ts:802:6
    (set_global $core/cpu/cpu/Cpu.registerH
     (i32.and
      ;;@ core/cpu/opcodes.ts:802:22
      (call $core/helpers/index/splitHighByte
       ;;@ core/cpu/opcodes.ts:801:6
       (tee_local $0
        ;;@ core/cpu/opcodes.ts:801:20
        (call $core/portable/portable/u16Portable
         ;;@ core/cpu/opcodes.ts:801:32
         (i32.sub
          (get_local $0)
          ;;@ core/cpu/opcodes.ts:801:46
          (i32.const 1)
         )
        )
       )
      )
      (i32.const 255)
     )
    )
    ;;@ core/cpu/opcodes.ts:803:6
    (set_global $core/cpu/cpu/Cpu.registerL
     (i32.and
      ;;@ core/cpu/opcodes.ts:803:22
      (call $core/helpers/index/splitLowByte
       (get_local $0)
      )
      (i32.const 255)
     )
    )
    (br $folding-inner3)
   )
   ;;@ core/cpu/opcodes.ts:858:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:858:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:858:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:858:60
      (i32.const 1)
     )
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:794:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode4x (; 234 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:957:9
                     (i32.const 64)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:962:9
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
                  ;;@ core/cpu/opcodes.ts:965:6
                  (set_global $core/cpu/cpu/Cpu.registerB
                   ;;@ core/cpu/opcodes.ts:965:22
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:970:6
                 (set_global $core/cpu/cpu/Cpu.registerB
                  ;;@ core/cpu/opcodes.ts:970:22
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:975:6
                (set_global $core/cpu/cpu/Cpu.registerB
                 ;;@ core/cpu/opcodes.ts:975:22
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:980:6
               (set_global $core/cpu/cpu/Cpu.registerB
                ;;@ core/cpu/opcodes.ts:980:22
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:985:6
              (set_global $core/cpu/cpu/Cpu.registerB
               ;;@ core/cpu/opcodes.ts:985:22
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:991:6
             (set_global $core/cpu/cpu/Cpu.registerB
              (i32.and
               ;;@ core/cpu/opcodes.ts:991:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:991:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:991:66
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:991:81
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:996:6
            (set_global $core/cpu/cpu/Cpu.registerB
             ;;@ core/cpu/opcodes.ts:996:22
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1001:6
           (set_global $core/cpu/cpu/Cpu.registerC
            ;;@ core/cpu/opcodes.ts:1001:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1011:6
         (set_global $core/cpu/cpu/Cpu.registerC
          ;;@ core/cpu/opcodes.ts:1011:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1016:6
        (set_global $core/cpu/cpu/Cpu.registerC
         ;;@ core/cpu/opcodes.ts:1016:22
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1021:6
       (set_global $core/cpu/cpu/Cpu.registerC
        ;;@ core/cpu/opcodes.ts:1021:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1026:6
      (set_global $core/cpu/cpu/Cpu.registerC
       ;;@ core/cpu/opcodes.ts:1026:22
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1032:6
     (set_global $core/cpu/cpu/Cpu.registerC
      (i32.and
       ;;@ core/cpu/opcodes.ts:1032:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1032:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1032:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1032:81
         (get_global $core/cpu/cpu/Cpu.registerL)
        )
       )
       (i32.const 255)
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1037:6
    (set_global $core/cpu/cpu/Cpu.registerC
     ;;@ core/cpu/opcodes.ts:1037:22
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:961:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode5x (; 235 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:1045:9
                     (i32.const 80)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:1050:9
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
                   ;;@ core/cpu/opcodes.ts:1048:6
                   (set_global $core/cpu/cpu/Cpu.registerD
                    ;;@ core/cpu/opcodes.ts:1048:22
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1053:6
                  (set_global $core/cpu/cpu/Cpu.registerD
                   ;;@ core/cpu/opcodes.ts:1053:22
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1063:6
                (set_global $core/cpu/cpu/Cpu.registerD
                 ;;@ core/cpu/opcodes.ts:1063:22
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1068:6
               (set_global $core/cpu/cpu/Cpu.registerD
                ;;@ core/cpu/opcodes.ts:1068:22
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1073:6
              (set_global $core/cpu/cpu/Cpu.registerD
               ;;@ core/cpu/opcodes.ts:1073:22
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1079:6
             (set_global $core/cpu/cpu/Cpu.registerD
              (i32.and
               ;;@ core/cpu/opcodes.ts:1079:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:1079:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:1079:66
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:1079:81
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1084:6
            (set_global $core/cpu/cpu/Cpu.registerD
             ;;@ core/cpu/opcodes.ts:1084:22
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1089:6
           (set_global $core/cpu/cpu/Cpu.registerE
            ;;@ core/cpu/opcodes.ts:1089:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1094:6
          (set_global $core/cpu/cpu/Cpu.registerE
           ;;@ core/cpu/opcodes.ts:1094:22
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1099:6
         (set_global $core/cpu/cpu/Cpu.registerE
          ;;@ core/cpu/opcodes.ts:1099:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1109:6
       (set_global $core/cpu/cpu/Cpu.registerE
        ;;@ core/cpu/opcodes.ts:1109:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1114:6
      (set_global $core/cpu/cpu/Cpu.registerE
       ;;@ core/cpu/opcodes.ts:1114:22
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1120:6
     (set_global $core/cpu/cpu/Cpu.registerE
      (i32.and
       ;;@ core/cpu/opcodes.ts:1120:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1120:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1120:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1120:81
         (get_global $core/cpu/cpu/Cpu.registerL)
        )
       )
       (i32.const 255)
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1125:6
    (set_global $core/cpu/cpu/Cpu.registerE
     ;;@ core/cpu/opcodes.ts:1125:22
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1049:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcode6x (; 236 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:1133:9
                     (i32.const 96)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:1138:9
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
                   ;;@ core/cpu/opcodes.ts:1136:6
                   (set_global $core/cpu/cpu/Cpu.registerH
                    ;;@ core/cpu/opcodes.ts:1136:22
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1141:6
                  (set_global $core/cpu/cpu/Cpu.registerH
                   ;;@ core/cpu/opcodes.ts:1141:22
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1146:6
                 (set_global $core/cpu/cpu/Cpu.registerH
                  ;;@ core/cpu/opcodes.ts:1146:22
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1151:6
                (set_global $core/cpu/cpu/Cpu.registerH
                 ;;@ core/cpu/opcodes.ts:1151:22
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1161:6
              (set_global $core/cpu/cpu/Cpu.registerH
               ;;@ core/cpu/opcodes.ts:1161:22
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1167:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:1167:22
               (call $core/cpu/opcodes/eightBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:1167:49
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:1167:66
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:1167:81
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
               )
               (i32.const 255)
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1172:6
            (set_global $core/cpu/cpu/Cpu.registerH
             ;;@ core/cpu/opcodes.ts:1172:22
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1177:6
           (set_global $core/cpu/cpu/Cpu.registerL
            ;;@ core/cpu/opcodes.ts:1177:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1182:6
          (set_global $core/cpu/cpu/Cpu.registerL
           ;;@ core/cpu/opcodes.ts:1182:22
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1187:6
         (set_global $core/cpu/cpu/Cpu.registerL
          ;;@ core/cpu/opcodes.ts:1187:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1192:6
        (set_global $core/cpu/cpu/Cpu.registerL
         ;;@ core/cpu/opcodes.ts:1192:22
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1197:6
       (set_global $core/cpu/cpu/Cpu.registerL
        ;;@ core/cpu/opcodes.ts:1197:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1208:6
     (set_global $core/cpu/cpu/Cpu.registerL
      (i32.and
       ;;@ core/cpu/opcodes.ts:1208:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1208:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1208:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1208:81
         (get_global $core/cpu/cpu/Cpu.registerL)
        )
       )
       (i32.const 255)
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1213:6
    (set_global $core/cpu/cpu/Cpu.registerL
     ;;@ core/cpu/opcodes.ts:1213:22
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1137:13
  (i32.const 4)
 )
 (func $core/cpu/cpu/Cpu.enableHalt (; 237 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cpu/cpu.ts:75:4
  (if
   ;;@ core/cpu/cpu.ts:75:8
   (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
   ;;@ core/cpu/cpu.ts:75:42
   (block
    ;;@ core/cpu/cpu.ts:76:6
    (set_global $core/cpu/cpu/Cpu.isHaltNormal
     ;;@ core/cpu/cpu.ts:76:25
     (i32.const 1)
    )
    ;;@ core/cpu/cpu.ts:77:6
    (return)
   )
  )
  ;;@ core/cpu/cpu.ts:82:4
  (if
   (i32.eqz
    ;;@ core/cpu/cpu.ts:80:29
    (i32.and
     (i32.and
      (get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue)
      ;;@ core/cpu/cpu.ts:80:65
      (get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue)
     )
     ;;@ core/cpu/cpu.ts:80:103
     (i32.const 31)
    )
   )
   ;;@ core/cpu/cpu.ts:82:29
   (block
    ;;@ core/cpu/cpu.ts:83:6
    (set_global $core/cpu/cpu/Cpu.isHaltNoJump
     ;;@ core/cpu/cpu.ts:83:25
     (i32.const 1)
    )
    ;;@ core/cpu/cpu.ts:84:6
    (return)
   )
  )
  ;;@ core/cpu/cpu.ts:87:4
  (set_global $core/cpu/cpu/Cpu.isHaltBug
   ;;@ core/cpu/cpu.ts:87:20
   (i32.const 1)
  )
 )
 (func $core/cpu/opcodes/handleOpcode7x (; 238 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:1221:9
                     (i32.const 112)
                    )
                    (block
                     (br_if $case1|0
                      (i32.eq
                       (tee_local $1
                        (get_local $0)
                       )
                       ;;@ core/cpu/opcodes.ts:1227:9
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
                   ;;@ core/cpu/opcodes.ts:1225:6
                   (call $core/cpu/opcodes/eightBitStoreSyncCycles
                    ;;@ core/cpu/opcodes.ts:1225:30
                    (call $core/helpers/index/concatenateBytes
                     ;;@ core/cpu/opcodes.ts:1225:47
                     (get_global $core/cpu/cpu/Cpu.registerH)
                     ;;@ core/cpu/opcodes.ts:1225:62
                     (get_global $core/cpu/cpu/Cpu.registerL)
                    )
                    ;;@ core/cpu/opcodes.ts:1225:78
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1231:6
                  (call $core/cpu/opcodes/eightBitStoreSyncCycles
                   ;;@ core/cpu/opcodes.ts:1231:30
                   (call $core/helpers/index/concatenateBytes
                    ;;@ core/cpu/opcodes.ts:1231:47
                    (get_global $core/cpu/cpu/Cpu.registerH)
                    ;;@ core/cpu/opcodes.ts:1231:62
                    (get_global $core/cpu/cpu/Cpu.registerL)
                   )
                   ;;@ core/cpu/opcodes.ts:1231:78
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1237:6
                 (call $core/cpu/opcodes/eightBitStoreSyncCycles
                  ;;@ core/cpu/opcodes.ts:1237:30
                  (call $core/helpers/index/concatenateBytes
                   ;;@ core/cpu/opcodes.ts:1237:47
                   (get_global $core/cpu/cpu/Cpu.registerH)
                   ;;@ core/cpu/opcodes.ts:1237:62
                   (get_global $core/cpu/cpu/Cpu.registerL)
                  )
                  ;;@ core/cpu/opcodes.ts:1237:78
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1243:6
                (call $core/cpu/opcodes/eightBitStoreSyncCycles
                 ;;@ core/cpu/opcodes.ts:1243:30
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:1243:47
                  (get_global $core/cpu/cpu/Cpu.registerH)
                  ;;@ core/cpu/opcodes.ts:1243:62
                  (get_global $core/cpu/cpu/Cpu.registerL)
                 )
                 ;;@ core/cpu/opcodes.ts:1243:78
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1249:6
               (call $core/cpu/opcodes/eightBitStoreSyncCycles
                ;;@ core/cpu/opcodes.ts:1249:30
                (call $core/helpers/index/concatenateBytes
                 ;;@ core/cpu/opcodes.ts:1249:47
                 (get_global $core/cpu/cpu/Cpu.registerH)
                 ;;@ core/cpu/opcodes.ts:1249:62
                 (get_global $core/cpu/cpu/Cpu.registerL)
                )
                ;;@ core/cpu/opcodes.ts:1249:78
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1255:6
              (call $core/cpu/opcodes/eightBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:1255:30
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1255:47
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1255:62
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
               ;;@ core/cpu/opcodes.ts:1255:78
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1266:6
             (if
              ;;@ core/cpu/opcodes.ts:1266:10
              (i32.eqz
               ;;@ core/cpu/opcodes.ts:1266:11
               (get_global $core/memory/memory/Memory.isHblankHdmaActive)
              )
              ;;@ core/cpu/opcodes.ts:1266:38
              (call $core/cpu/cpu/Cpu.enableHalt)
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1274:6
            (call $core/cpu/opcodes/eightBitStoreSyncCycles
             ;;@ core/cpu/opcodes.ts:1274:30
             (call $core/helpers/index/concatenateBytes
              ;;@ core/cpu/opcodes.ts:1274:47
              (get_global $core/cpu/cpu/Cpu.registerH)
              ;;@ core/cpu/opcodes.ts:1274:62
              (get_global $core/cpu/cpu/Cpu.registerL)
             )
             ;;@ core/cpu/opcodes.ts:1274:78
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1279:6
           (set_global $core/cpu/cpu/Cpu.registerA
            ;;@ core/cpu/opcodes.ts:1279:22
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1284:6
          (set_global $core/cpu/cpu/Cpu.registerA
           ;;@ core/cpu/opcodes.ts:1284:22
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1289:6
         (set_global $core/cpu/cpu/Cpu.registerA
          ;;@ core/cpu/opcodes.ts:1289:22
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1294:6
        (set_global $core/cpu/cpu/Cpu.registerA
         ;;@ core/cpu/opcodes.ts:1294:22
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1299:6
       (set_global $core/cpu/cpu/Cpu.registerA
        ;;@ core/cpu/opcodes.ts:1299:22
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1304:6
      (set_global $core/cpu/cpu/Cpu.registerA
       ;;@ core/cpu/opcodes.ts:1304:22
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1311:6
     (set_global $core/cpu/cpu/Cpu.registerA
      (i32.and
       ;;@ core/cpu/opcodes.ts:1311:22
       (call $core/cpu/opcodes/eightBitLoadSyncCycles
        ;;@ core/cpu/opcodes.ts:1311:49
        (call $core/helpers/index/concatenateBytes
         ;;@ core/cpu/opcodes.ts:1311:66
         (get_global $core/cpu/cpu/Cpu.registerH)
         ;;@ core/cpu/opcodes.ts:1311:81
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
  ;;@ core/cpu/opcodes.ts:1226:13
  (i32.const 4)
 )
 (func $core/cpu/flags/checkAndSetEightBitCarryFlag (; 239 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/cpu/instructions/addARegister (; 240 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/instructions/addAThroughCarryRegister (; 241 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/opcodes/handleOpcode8x (; 242 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:1324:9
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
                   ;;@ core/cpu/opcodes.ts:1328:6
                   (call $core/cpu/instructions/addARegister
                    ;;@ core/cpu/opcodes.ts:1328:19
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1334:6
                  (call $core/cpu/instructions/addARegister
                   ;;@ core/cpu/opcodes.ts:1334:19
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1340:6
                 (call $core/cpu/instructions/addARegister
                  ;;@ core/cpu/opcodes.ts:1340:19
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1346:6
                (call $core/cpu/instructions/addARegister
                 ;;@ core/cpu/opcodes.ts:1346:19
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1352:6
               (call $core/cpu/instructions/addARegister
                ;;@ core/cpu/opcodes.ts:1352:19
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1358:6
              (call $core/cpu/instructions/addARegister
               ;;@ core/cpu/opcodes.ts:1358:19
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1366:6
             (call $core/cpu/instructions/addARegister
              ;;@ core/cpu/opcodes.ts:1365:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1365:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1365:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1365:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1372:6
            (call $core/cpu/instructions/addARegister
             ;;@ core/cpu/opcodes.ts:1372:19
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1378:6
           (call $core/cpu/instructions/addAThroughCarryRegister
            ;;@ core/cpu/opcodes.ts:1378:31
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1384:6
          (call $core/cpu/instructions/addAThroughCarryRegister
           ;;@ core/cpu/opcodes.ts:1384:31
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1390:6
         (call $core/cpu/instructions/addAThroughCarryRegister
          ;;@ core/cpu/opcodes.ts:1390:31
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1396:6
        (call $core/cpu/instructions/addAThroughCarryRegister
         ;;@ core/cpu/opcodes.ts:1396:31
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1402:6
       (call $core/cpu/instructions/addAThroughCarryRegister
        ;;@ core/cpu/opcodes.ts:1402:31
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1408:6
      (call $core/cpu/instructions/addAThroughCarryRegister
       ;;@ core/cpu/opcodes.ts:1408:31
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1416:6
     (call $core/cpu/instructions/addAThroughCarryRegister
      ;;@ core/cpu/opcodes.ts:1415:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1415:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1415:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1415:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1422:6
    (call $core/cpu/instructions/addAThroughCarryRegister
     ;;@ core/cpu/opcodes.ts:1422:31
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1329:13
  (i32.const 4)
 )
 (func $core/cpu/instructions/subARegister (; 243 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/instructions/subAThroughCarryRegister (; 244 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/opcodes/handleOpcode9x (; 245 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:1430:9
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
                   ;;@ core/cpu/opcodes.ts:1434:6
                   (call $core/cpu/instructions/subARegister
                    ;;@ core/cpu/opcodes.ts:1434:19
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1440:6
                  (call $core/cpu/instructions/subARegister
                   ;;@ core/cpu/opcodes.ts:1440:19
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1446:6
                 (call $core/cpu/instructions/subARegister
                  ;;@ core/cpu/opcodes.ts:1446:19
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1452:6
                (call $core/cpu/instructions/subARegister
                 ;;@ core/cpu/opcodes.ts:1452:19
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1458:6
               (call $core/cpu/instructions/subARegister
                ;;@ core/cpu/opcodes.ts:1458:19
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1464:6
              (call $core/cpu/instructions/subARegister
               ;;@ core/cpu/opcodes.ts:1464:19
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1472:6
             (call $core/cpu/instructions/subARegister
              ;;@ core/cpu/opcodes.ts:1471:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1471:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1471:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1471:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1478:6
            (call $core/cpu/instructions/subARegister
             ;;@ core/cpu/opcodes.ts:1478:19
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1484:6
           (call $core/cpu/instructions/subAThroughCarryRegister
            ;;@ core/cpu/opcodes.ts:1484:31
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1490:6
          (call $core/cpu/instructions/subAThroughCarryRegister
           ;;@ core/cpu/opcodes.ts:1490:31
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1496:6
         (call $core/cpu/instructions/subAThroughCarryRegister
          ;;@ core/cpu/opcodes.ts:1496:31
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1502:6
        (call $core/cpu/instructions/subAThroughCarryRegister
         ;;@ core/cpu/opcodes.ts:1502:31
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1508:6
       (call $core/cpu/instructions/subAThroughCarryRegister
        ;;@ core/cpu/opcodes.ts:1508:31
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1514:6
      (call $core/cpu/instructions/subAThroughCarryRegister
       ;;@ core/cpu/opcodes.ts:1514:31
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1522:6
     (call $core/cpu/instructions/subAThroughCarryRegister
      ;;@ core/cpu/opcodes.ts:1521:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1521:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1521:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1521:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1528:6
    (call $core/cpu/instructions/subAThroughCarryRegister
     ;;@ core/cpu/opcodes.ts:1528:31
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1435:13
  (i32.const 4)
 )
 (func $core/cpu/instructions/andARegister (; 246 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/instructions/xorARegister (; 247 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/opcodes/handleOpcodeAx (; 248 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:1536:9
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
                   ;;@ core/cpu/opcodes.ts:1540:6
                   (call $core/cpu/instructions/andARegister
                    ;;@ core/cpu/opcodes.ts:1540:19
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1546:6
                  (call $core/cpu/instructions/andARegister
                   ;;@ core/cpu/opcodes.ts:1546:19
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1552:6
                 (call $core/cpu/instructions/andARegister
                  ;;@ core/cpu/opcodes.ts:1552:19
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1558:6
                (call $core/cpu/instructions/andARegister
                 ;;@ core/cpu/opcodes.ts:1558:19
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1564:6
               (call $core/cpu/instructions/andARegister
                ;;@ core/cpu/opcodes.ts:1564:19
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1570:6
              (call $core/cpu/instructions/andARegister
               ;;@ core/cpu/opcodes.ts:1570:19
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1578:6
             (call $core/cpu/instructions/andARegister
              ;;@ core/cpu/opcodes.ts:1577:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1577:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1577:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1577:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1585:6
            (call $core/cpu/instructions/andARegister
             ;;@ core/cpu/opcodes.ts:1585:19
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1591:6
           (call $core/cpu/instructions/xorARegister
            ;;@ core/cpu/opcodes.ts:1591:19
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1597:6
          (call $core/cpu/instructions/xorARegister
           ;;@ core/cpu/opcodes.ts:1597:19
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1603:6
         (call $core/cpu/instructions/xorARegister
          ;;@ core/cpu/opcodes.ts:1603:19
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1609:6
        (call $core/cpu/instructions/xorARegister
         ;;@ core/cpu/opcodes.ts:1609:19
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1615:6
       (call $core/cpu/instructions/xorARegister
        ;;@ core/cpu/opcodes.ts:1615:19
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1621:6
      (call $core/cpu/instructions/xorARegister
       ;;@ core/cpu/opcodes.ts:1621:19
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1629:6
     (call $core/cpu/instructions/xorARegister
      ;;@ core/cpu/opcodes.ts:1628:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1628:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1628:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1628:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1635:6
    (call $core/cpu/instructions/xorARegister
     ;;@ core/cpu/opcodes.ts:1635:19
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1541:13
  (i32.const 4)
 )
 (func $core/cpu/instructions/orARegister (; 249 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/instructions/cpARegister (; 250 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/cpu/opcodes/handleOpcodeBx (; 251 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                     ;;@ core/cpu/opcodes.ts:1643:9
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
                   ;;@ core/cpu/opcodes.ts:1647:6
                   (call $core/cpu/instructions/orARegister
                    ;;@ core/cpu/opcodes.ts:1647:18
                    (get_global $core/cpu/cpu/Cpu.registerB)
                   )
                   (br $folding-inner0)
                  )
                  ;;@ core/cpu/opcodes.ts:1653:6
                  (call $core/cpu/instructions/orARegister
                   ;;@ core/cpu/opcodes.ts:1653:18
                   (get_global $core/cpu/cpu/Cpu.registerC)
                  )
                  (br $folding-inner0)
                 )
                 ;;@ core/cpu/opcodes.ts:1659:6
                 (call $core/cpu/instructions/orARegister
                  ;;@ core/cpu/opcodes.ts:1659:18
                  (get_global $core/cpu/cpu/Cpu.registerD)
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:1665:6
                (call $core/cpu/instructions/orARegister
                 ;;@ core/cpu/opcodes.ts:1665:18
                 (get_global $core/cpu/cpu/Cpu.registerE)
                )
                (br $folding-inner0)
               )
               ;;@ core/cpu/opcodes.ts:1671:6
               (call $core/cpu/instructions/orARegister
                ;;@ core/cpu/opcodes.ts:1671:18
                (get_global $core/cpu/cpu/Cpu.registerH)
               )
               (br $folding-inner0)
              )
              ;;@ core/cpu/opcodes.ts:1677:6
              (call $core/cpu/instructions/orARegister
               ;;@ core/cpu/opcodes.ts:1677:18
               (get_global $core/cpu/cpu/Cpu.registerL)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:1685:6
             (call $core/cpu/instructions/orARegister
              ;;@ core/cpu/opcodes.ts:1684:27
              (call $core/cpu/opcodes/eightBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1684:54
               (call $core/helpers/index/concatenateBytes
                ;;@ core/cpu/opcodes.ts:1684:71
                (get_global $core/cpu/cpu/Cpu.registerH)
                ;;@ core/cpu/opcodes.ts:1684:86
                (get_global $core/cpu/cpu/Cpu.registerL)
               )
              )
             )
             (br $folding-inner0)
            )
            ;;@ core/cpu/opcodes.ts:1691:6
            (call $core/cpu/instructions/orARegister
             ;;@ core/cpu/opcodes.ts:1691:18
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:1697:6
           (call $core/cpu/instructions/cpARegister
            ;;@ core/cpu/opcodes.ts:1697:18
            (get_global $core/cpu/cpu/Cpu.registerB)
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1703:6
          (call $core/cpu/instructions/cpARegister
           ;;@ core/cpu/opcodes.ts:1703:18
           (get_global $core/cpu/cpu/Cpu.registerC)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:1709:6
         (call $core/cpu/instructions/cpARegister
          ;;@ core/cpu/opcodes.ts:1709:18
          (get_global $core/cpu/cpu/Cpu.registerD)
         )
         (br $folding-inner0)
        )
        ;;@ core/cpu/opcodes.ts:1715:6
        (call $core/cpu/instructions/cpARegister
         ;;@ core/cpu/opcodes.ts:1715:18
         (get_global $core/cpu/cpu/Cpu.registerE)
        )
        (br $folding-inner0)
       )
       ;;@ core/cpu/opcodes.ts:1721:6
       (call $core/cpu/instructions/cpARegister
        ;;@ core/cpu/opcodes.ts:1721:18
        (get_global $core/cpu/cpu/Cpu.registerH)
       )
       (br $folding-inner0)
      )
      ;;@ core/cpu/opcodes.ts:1727:6
      (call $core/cpu/instructions/cpARegister
       ;;@ core/cpu/opcodes.ts:1727:18
       (get_global $core/cpu/cpu/Cpu.registerL)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:1735:6
     (call $core/cpu/instructions/cpARegister
      ;;@ core/cpu/opcodes.ts:1734:27
      (call $core/cpu/opcodes/eightBitLoadSyncCycles
       ;;@ core/cpu/opcodes.ts:1734:54
       (call $core/helpers/index/concatenateBytes
        ;;@ core/cpu/opcodes.ts:1734:71
        (get_global $core/cpu/cpu/Cpu.registerH)
        ;;@ core/cpu/opcodes.ts:1734:86
        (get_global $core/cpu/cpu/Cpu.registerL)
       )
      )
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:1741:6
    (call $core/cpu/instructions/cpARegister
     ;;@ core/cpu/opcodes.ts:1741:18
     (get_global $core/cpu/cpu/Cpu.registerA)
    )
    (br $folding-inner0)
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:1648:13
  (i32.const 4)
 )
 (func $core/memory/load/sixteenBitLoadFromGBMemory (; 252 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/opcodes/sixteenBitLoadSyncCycles (; 253 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/cpu/opcodes.ts:147:2
  (call $core/cycles/syncCycles
   ;;@ core/cpu/opcodes.ts:147:13
   (i32.const 8)
  )
  ;;@ core/cpu/opcodes.ts:149:54
  (call $core/memory/load/sixteenBitLoadFromGBMemory
   (get_local $0)
  )
 )
 (func $core/cpu/instructions/rotateRegisterLeft (; 254 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/rotateRegisterRight (; 255 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/rotateRegisterLeftThroughCarry (; 256 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/rotateRegisterRightThroughCarry (; 257 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/shiftLeftRegister (; 258 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/shiftRightArithmeticRegister (; 259 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/swapNibblesOnRegister (; 260 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/shiftRightLogicalRegister (; 261 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/instructions/testBitOnRegister (; 262 ;) (; has Stack IR ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
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
 (func $core/cpu/instructions/setBitOnRegister (; 263 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
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
 (func $core/cpu/cbOpcodes/handleCbOpcode (; 264 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/cpu/opcodes/handleOpcodeCx (; 265 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                          ;;@ core/cpu/opcodes.ts:1749:9
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
                         ;;@ core/cpu/opcodes.ts:1752:10
                         (call $core/cpu/flags/getZeroFlag)
                        )
                        (br $folding-inner4)
                       )
                       ;;@ core/cpu/opcodes.ts:1764:6
                       (set_local $1
                        ;;@ core/cpu/opcodes.ts:1764:29
                        (i32.and
                         (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                          ;;@ core/cpu/opcodes.ts:1764:54
                          (get_global $core/cpu/cpu/Cpu.stackPointer)
                         )
                         (i32.const 65535)
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1765:6
                       (set_global $core/cpu/cpu/Cpu.stackPointer
                        ;;@ core/cpu/opcodes.ts:1765:25
                        (call $core/portable/portable/u16Portable
                         ;;@ core/cpu/opcodes.ts:1765:37
                         (i32.add
                          (get_global $core/cpu/cpu/Cpu.stackPointer)
                          ;;@ core/cpu/opcodes.ts:1765:56
                          (i32.const 2)
                         )
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1766:6
                       (set_global $core/cpu/cpu/Cpu.registerB
                        (i32.and
                         ;;@ core/cpu/opcodes.ts:1766:22
                         (call $core/helpers/index/splitHighByte
                          (get_local $1)
                         )
                         (i32.const 255)
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1767:6
                       (set_global $core/cpu/cpu/Cpu.registerC
                        (i32.and
                         ;;@ core/cpu/opcodes.ts:1767:22
                         (call $core/helpers/index/splitLowByte
                          (get_local $1)
                         )
                         (i32.const 255)
                        )
                       )
                       ;;@ core/cpu/opcodes.ts:1768:13
                       (return
                        (i32.const 4)
                       )
                      )
                      ;;@ core/cpu/opcodes.ts:1772:6
                      (if
                       ;;@ core/cpu/opcodes.ts:1772:10
                       (call $core/cpu/flags/getZeroFlag)
                       (br $folding-inner3)
                       (br $folding-inner1)
                      )
                     )
                     (br $folding-inner1)
                    )
                    ;;@ core/cpu/opcodes.ts:1789:6
                    (if
                     ;;@ core/cpu/opcodes.ts:1789:10
                     (call $core/cpu/flags/getZeroFlag)
                     (br $folding-inner3)
                     (br $folding-inner0)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1803:6
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:1803:25
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:1803:37
                     (i32.sub
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:1803:56
                      (i32.const 2)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1805:6
                   (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                    ;;@ core/cpu/opcodes.ts:1805:32
                    (get_global $core/cpu/cpu/Cpu.stackPointer)
                    ;;@ core/cpu/opcodes.ts:1805:50
                    (call $core/helpers/index/concatenateBytes
                     ;;@ core/cpu/opcodes.ts:1805:67
                     (get_global $core/cpu/cpu/Cpu.registerB)
                     ;;@ core/cpu/opcodes.ts:1805:82
                     (get_global $core/cpu/cpu/Cpu.registerC)
                    )
                   )
                   (br $folding-inner2)
                  )
                  ;;@ core/cpu/opcodes.ts:1812:6
                  (call $core/cpu/instructions/addARegister
                   ;;@ core/cpu/opcodes.ts:1812:19
                   (call $core/cpu/opcodes/getDataByteOne)
                  )
                  (br $folding-inner5)
                 )
                 ;;@ core/cpu/opcodes.ts:1818:6
                 (set_global $core/cpu/cpu/Cpu.stackPointer
                  ;;@ core/cpu/opcodes.ts:1818:25
                  (call $core/portable/portable/u16Portable
                   ;;@ core/cpu/opcodes.ts:1818:37
                   (i32.sub
                    (get_global $core/cpu/cpu/Cpu.stackPointer)
                    ;;@ core/cpu/opcodes.ts:1818:56
                    (i32.const 2)
                   )
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:1820:6
                 (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                  ;;@ core/cpu/opcodes.ts:1820:32
                  (get_global $core/cpu/cpu/Cpu.stackPointer)
                  ;;@ core/cpu/opcodes.ts:1820:50
                  (get_global $core/cpu/cpu/Cpu.programCounter)
                 )
                 ;;@ core/cpu/opcodes.ts:1821:6
                 (set_global $core/cpu/cpu/Cpu.programCounter
                  ;;@ core/cpu/opcodes.ts:1821:27
                  (i32.const 0)
                 )
                 (br $folding-inner2)
                )
                (br_if $folding-inner2
                 ;;@ core/cpu/opcodes.ts:1826:10
                 (i32.ne
                  (call $core/cpu/flags/getZeroFlag)
                  ;;@ core/cpu/opcodes.ts:1826:28
                  (i32.const 1)
                 )
                )
                (br $folding-inner4)
               )
               ;;@ core/cpu/opcodes.ts:1838:6
               (set_global $core/cpu/cpu/Cpu.programCounter
                (i32.and
                 ;;@ core/cpu/opcodes.ts:1838:27
                 (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                  ;;@ core/cpu/opcodes.ts:1838:57
                  (get_global $core/cpu/cpu/Cpu.stackPointer)
                 )
                 (i32.const 65535)
                )
               )
               ;;@ core/cpu/opcodes.ts:1839:6
               (set_global $core/cpu/cpu/Cpu.stackPointer
                ;;@ core/cpu/opcodes.ts:1839:25
                (call $core/portable/portable/u16Portable
                 ;;@ core/cpu/opcodes.ts:1839:37
                 (i32.add
                  (get_global $core/cpu/cpu/Cpu.stackPointer)
                  ;;@ core/cpu/opcodes.ts:1839:56
                  (i32.const 2)
                 )
                )
               )
               (br $folding-inner2)
              )
              ;;@ core/cpu/opcodes.ts:1844:6
              (if
               ;;@ core/cpu/opcodes.ts:1844:10
               (i32.eq
                (call $core/cpu/flags/getZeroFlag)
                ;;@ core/cpu/opcodes.ts:1844:28
                (i32.const 1)
               )
               (br $folding-inner1)
               (br $folding-inner3)
              )
             )
             ;;@ core/cpu/opcodes.ts:1856:6
             (set_local $1
              ;;@ core/cpu/opcodes.ts:1856:26
              (call $core/cpu/cbOpcodes/handleCbOpcode
               ;;@ core/cpu/opcodes.ts:1856:41
               (i32.and
                (call $core/cpu/opcodes/getDataByteOne)
                (i32.const 255)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:1857:6
             (set_global $core/cpu/cpu/Cpu.programCounter
              ;;@ core/cpu/opcodes.ts:1857:27
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:1857:39
               (i32.add
                (get_global $core/cpu/cpu/Cpu.programCounter)
                ;;@ core/cpu/opcodes.ts:1857:60
                (i32.const 1)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:1858:13
             (return
              (get_local $1)
             )
            )
            ;;@ core/cpu/opcodes.ts:1862:6
            (if
             ;;@ core/cpu/opcodes.ts:1862:10
             (i32.eq
              (call $core/cpu/flags/getZeroFlag)
              ;;@ core/cpu/opcodes.ts:1862:28
              (i32.const 1)
             )
             ;;@ core/cpu/opcodes.ts:1862:31
             (block
              ;;@ core/cpu/opcodes.ts:1863:8
              (set_global $core/cpu/cpu/Cpu.stackPointer
               ;;@ core/cpu/opcodes.ts:1863:27
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:1863:39
                (i32.sub
                 (get_global $core/cpu/cpu/Cpu.stackPointer)
                 ;;@ core/cpu/opcodes.ts:1863:58
                 (i32.const 2)
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:1865:8
              (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:1865:34
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:1865:52
               (i32.and
                (i32.add
                 (get_global $core/cpu/cpu/Cpu.programCounter)
                 ;;@ core/cpu/opcodes.ts:1865:73
                 (i32.const 2)
                )
                (i32.const 65535)
               )
              )
              (br $folding-inner1)
             )
             (br $folding-inner3)
            )
           )
           (br $folding-inner0)
          )
          ;;@ core/cpu/opcodes.ts:1887:6
          (call $core/cpu/instructions/addAThroughCarryRegister
           ;;@ core/cpu/opcodes.ts:1887:31
           (call $core/cpu/opcodes/getDataByteOne)
          )
          (br $folding-inner5)
         )
         ;;@ core/cpu/opcodes.ts:1893:6
         (set_global $core/cpu/cpu/Cpu.stackPointer
          ;;@ core/cpu/opcodes.ts:1893:25
          (call $core/portable/portable/u16Portable
           ;;@ core/cpu/opcodes.ts:1893:37
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.stackPointer)
            ;;@ core/cpu/opcodes.ts:1893:56
            (i32.const 2)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:1895:6
         (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
          ;;@ core/cpu/opcodes.ts:1895:32
          (get_global $core/cpu/cpu/Cpu.stackPointer)
          ;;@ core/cpu/opcodes.ts:1895:50
          (get_global $core/cpu/cpu/Cpu.programCounter)
         )
         ;;@ core/cpu/opcodes.ts:1896:6
         (set_global $core/cpu/cpu/Cpu.programCounter
          ;;@ core/cpu/opcodes.ts:1896:27
          (i32.const 8)
         )
         (br $folding-inner2)
        )
        (return
         (i32.const -1)
        )
       )
       ;;@ core/cpu/opcodes.ts:1790:8
       (set_global $core/cpu/cpu/Cpu.stackPointer
        ;;@ core/cpu/opcodes.ts:1790:27
        (call $core/portable/portable/u16Portable
         ;;@ core/cpu/opcodes.ts:1790:39
         (i32.sub
          (get_global $core/cpu/cpu/Cpu.stackPointer)
          ;;@ core/cpu/opcodes.ts:1790:58
          (i32.const 2)
         )
        )
       )
       ;;@ core/cpu/opcodes.ts:1792:8
       (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
        ;;@ core/cpu/opcodes.ts:1792:34
        (get_global $core/cpu/cpu/Cpu.stackPointer)
        ;;@ core/cpu/opcodes.ts:1792:52
        (call $core/portable/portable/u16Portable
         ;;@ core/cpu/opcodes.ts:1792:64
         (i32.add
          (get_global $core/cpu/cpu/Cpu.programCounter)
          ;;@ core/cpu/opcodes.ts:1792:85
          (i32.const 2)
         )
        )
       )
      )
      ;;@ core/cpu/opcodes.ts:1774:8
      (set_global $core/cpu/cpu/Cpu.programCounter
       (i32.and
        ;;@ core/cpu/opcodes.ts:1774:29
        (call $core/cpu/opcodes/getConcatenatedDataByte)
        (i32.const 65535)
       )
      )
     )
     (return
      (i32.const 8)
     )
    )
    ;;@ core/cpu/opcodes.ts:1777:8
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/cpu/opcodes.ts:1777:29
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:1777:41
      (i32.add
       (get_global $core/cpu/cpu/Cpu.programCounter)
       ;;@ core/cpu/opcodes.ts:1777:62
       (i32.const 2)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:1778:15
    (return
     (i32.const 12)
    )
   )
   ;;@ core/cpu/opcodes.ts:1754:8
   (set_global $core/cpu/cpu/Cpu.programCounter
    (i32.and
     ;;@ core/cpu/opcodes.ts:1754:29
     (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
      ;;@ core/cpu/opcodes.ts:1754:59
      (get_global $core/cpu/cpu/Cpu.stackPointer)
     )
     (i32.const 65535)
    )
   )
   ;;@ core/cpu/opcodes.ts:1755:8
   (set_global $core/cpu/cpu/Cpu.stackPointer
    ;;@ core/cpu/opcodes.ts:1755:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:1755:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.stackPointer)
      ;;@ core/cpu/opcodes.ts:1755:58
      (i32.const 2)
     )
    )
   )
   ;;@ core/cpu/opcodes.ts:1756:15
   (return
    (i32.const 12)
   )
  )
  ;;@ core/cpu/opcodes.ts:1813:6
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/opcodes.ts:1813:27
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:1813:39
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:1813:60
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:1814:13
  (i32.const 4)
 )
 (func $core/interrupts/interrupts/setInterrupts (; 266 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/interrupts/interrupts.ts:223:2
  (if
   (i32.and
    (get_local $0)
    (i32.const 1)
   )
   ;;@ core/interrupts/interrupts.ts:223:13
   (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
    ;;@ core/interrupts/interrupts.ts:224:44
    (i32.const 1)
   )
   ;;@ core/interrupts/interrupts.ts:225:9
   (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
    ;;@ core/interrupts/interrupts.ts:226:39
    (i32.const 0)
   )
  )
 )
 (func $core/cpu/opcodes/handleOpcodeDx (; 267 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                      ;;@ core/cpu/opcodes.ts:1904:9
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
                     ;;@ core/cpu/opcodes.ts:1907:10
                     (call $core/cpu/flags/getCarryFlag)
                    )
                    (br $folding-inner3)
                   )
                   ;;@ core/cpu/opcodes.ts:1919:6
                   (set_local $1
                    ;;@ core/cpu/opcodes.ts:1919:29
                    (i32.and
                     (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                      ;;@ core/cpu/opcodes.ts:1919:54
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                     )
                     (i32.const 65535)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1920:6
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:1920:25
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:1920:37
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:1920:56
                      (i32.const 2)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1921:6
                   (set_global $core/cpu/cpu/Cpu.registerD
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:1921:22
                     (call $core/helpers/index/splitHighByte
                      (get_local $1)
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1922:6
                   (set_global $core/cpu/cpu/Cpu.registerE
                    (i32.and
                     ;;@ core/cpu/opcodes.ts:1922:22
                     (call $core/helpers/index/splitLowByte
                      (get_local $1)
                     )
                     (i32.const 255)
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1923:13
                   (return
                    (i32.const 4)
                   )
                  )
                  ;;@ core/cpu/opcodes.ts:1927:6
                  (if
                   ;;@ core/cpu/opcodes.ts:1927:10
                   (call $core/cpu/flags/getCarryFlag)
                   (br $folding-inner2)
                   (br $folding-inner0)
                  )
                 )
                 ;;@ core/cpu/opcodes.ts:1939:6
                 (if
                  ;;@ core/cpu/opcodes.ts:1939:10
                  (call $core/cpu/flags/getCarryFlag)
                  (br $folding-inner2)
                  ;;@ core/cpu/opcodes.ts:1939:32
                  (block
                   ;;@ core/cpu/opcodes.ts:1940:8
                   (set_global $core/cpu/cpu/Cpu.stackPointer
                    ;;@ core/cpu/opcodes.ts:1940:27
                    (call $core/portable/portable/u16Portable
                     ;;@ core/cpu/opcodes.ts:1940:39
                     (i32.sub
                      (get_global $core/cpu/cpu/Cpu.stackPointer)
                      ;;@ core/cpu/opcodes.ts:1940:58
                      (i32.const 2)
                     )
                    )
                   )
                   ;;@ core/cpu/opcodes.ts:1942:8
                   (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                    ;;@ core/cpu/opcodes.ts:1942:34
                    (get_global $core/cpu/cpu/Cpu.stackPointer)
                    ;;@ core/cpu/opcodes.ts:1942:52
                    (i32.and
                     (i32.add
                      (get_global $core/cpu/cpu/Cpu.programCounter)
                      ;;@ core/cpu/opcodes.ts:1942:73
                      (i32.const 2)
                     )
                     (i32.const 65535)
                    )
                   )
                   (br $folding-inner0)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:1953:6
                (set_global $core/cpu/cpu/Cpu.stackPointer
                 ;;@ core/cpu/opcodes.ts:1953:25
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:1953:37
                  (i32.sub
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                   ;;@ core/cpu/opcodes.ts:1953:56
                   (i32.const 2)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:1955:6
                (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                 ;;@ core/cpu/opcodes.ts:1955:32
                 (get_global $core/cpu/cpu/Cpu.stackPointer)
                 ;;@ core/cpu/opcodes.ts:1955:50
                 (call $core/helpers/index/concatenateBytes
                  ;;@ core/cpu/opcodes.ts:1955:67
                  (get_global $core/cpu/cpu/Cpu.registerD)
                  ;;@ core/cpu/opcodes.ts:1955:82
                  (get_global $core/cpu/cpu/Cpu.registerE)
                 )
                )
                (br $folding-inner1)
               )
               ;;@ core/cpu/opcodes.ts:1962:6
               (call $core/cpu/instructions/subARegister
                ;;@ core/cpu/opcodes.ts:1962:19
                (call $core/cpu/opcodes/getDataByteOne)
               )
               (br $folding-inner4)
              )
              ;;@ core/cpu/opcodes.ts:1968:6
              (set_global $core/cpu/cpu/Cpu.stackPointer
               ;;@ core/cpu/opcodes.ts:1968:25
               (call $core/portable/portable/u16Portable
                ;;@ core/cpu/opcodes.ts:1968:37
                (i32.sub
                 (get_global $core/cpu/cpu/Cpu.stackPointer)
                 ;;@ core/cpu/opcodes.ts:1968:56
                 (i32.const 2)
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:1970:6
              (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:1970:32
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:1970:50
               (get_global $core/cpu/cpu/Cpu.programCounter)
              )
              ;;@ core/cpu/opcodes.ts:1971:6
              (set_global $core/cpu/cpu/Cpu.programCounter
               ;;@ core/cpu/opcodes.ts:1971:27
               (i32.const 16)
              )
              (br $folding-inner1)
             )
             (br_if $folding-inner1
              ;;@ core/cpu/opcodes.ts:1976:10
              (i32.ne
               (call $core/cpu/flags/getCarryFlag)
               ;;@ core/cpu/opcodes.ts:1976:29
               (i32.const 1)
              )
             )
             (br $folding-inner3)
            )
            ;;@ core/cpu/opcodes.ts:1989:6
            (set_global $core/cpu/cpu/Cpu.programCounter
             (i32.and
              ;;@ core/cpu/opcodes.ts:1989:27
              (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
               ;;@ core/cpu/opcodes.ts:1989:57
               (get_global $core/cpu/cpu/Cpu.stackPointer)
              )
              (i32.const 65535)
             )
            )
            ;;@ core/cpu/opcodes.ts:1991:6
            (call $core/interrupts/interrupts/setInterrupts
             ;;@ core/cpu/opcodes.ts:1991:20
             (i32.const 1)
            )
            ;;@ core/cpu/opcodes.ts:1992:6
            (set_global $core/cpu/cpu/Cpu.stackPointer
             ;;@ core/cpu/opcodes.ts:1992:25
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:1992:37
              (i32.add
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:1992:56
               (i32.const 2)
              )
             )
            )
            (br $folding-inner1)
           )
           ;;@ core/cpu/opcodes.ts:1997:6
           (if
            ;;@ core/cpu/opcodes.ts:1997:10
            (i32.eq
             (call $core/cpu/flags/getCarryFlag)
             ;;@ core/cpu/opcodes.ts:1997:29
             (i32.const 1)
            )
            (br $folding-inner0)
            (br $folding-inner2)
           )
          )
          ;;@ core/cpu/opcodes.ts:2009:6
          (if
           ;;@ core/cpu/opcodes.ts:2009:10
           (i32.eq
            (call $core/cpu/flags/getCarryFlag)
            ;;@ core/cpu/opcodes.ts:2009:29
            (i32.const 1)
           )
           ;;@ core/cpu/opcodes.ts:2009:32
           (block
            ;;@ core/cpu/opcodes.ts:2010:8
            (set_global $core/cpu/cpu/Cpu.stackPointer
             ;;@ core/cpu/opcodes.ts:2010:27
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:2010:39
              (i32.sub
               (get_global $core/cpu/cpu/Cpu.stackPointer)
               ;;@ core/cpu/opcodes.ts:2010:58
               (i32.const 2)
              )
             )
            )
            ;;@ core/cpu/opcodes.ts:2012:8
            (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
             ;;@ core/cpu/opcodes.ts:2012:34
             (get_global $core/cpu/cpu/Cpu.stackPointer)
             ;;@ core/cpu/opcodes.ts:2012:52
             (call $core/portable/portable/u16Portable
              ;;@ core/cpu/opcodes.ts:2012:64
              (i32.add
               (get_global $core/cpu/cpu/Cpu.programCounter)
               ;;@ core/cpu/opcodes.ts:2012:85
               (i32.const 2)
              )
             )
            )
            (br $folding-inner0)
           )
           (br $folding-inner2)
          )
         )
         ;;@ core/cpu/opcodes.ts:2026:6
         (call $core/cpu/instructions/subAThroughCarryRegister
          ;;@ core/cpu/opcodes.ts:2026:31
          (call $core/cpu/opcodes/getDataByteOne)
         )
         (br $folding-inner4)
        )
        ;;@ core/cpu/opcodes.ts:2032:6
        (set_global $core/cpu/cpu/Cpu.stackPointer
         ;;@ core/cpu/opcodes.ts:2032:25
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2032:37
          (i32.sub
           (get_global $core/cpu/cpu/Cpu.stackPointer)
           ;;@ core/cpu/opcodes.ts:2032:56
           (i32.const 2)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:2034:6
        (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
         ;;@ core/cpu/opcodes.ts:2034:32
         (get_global $core/cpu/cpu/Cpu.stackPointer)
         ;;@ core/cpu/opcodes.ts:2034:50
         (get_global $core/cpu/cpu/Cpu.programCounter)
        )
        ;;@ core/cpu/opcodes.ts:2035:6
        (set_global $core/cpu/cpu/Cpu.programCounter
         ;;@ core/cpu/opcodes.ts:2035:27
         (i32.const 24)
        )
        (br $folding-inner1)
       )
       (return
        (i32.const -1)
       )
      )
      ;;@ core/cpu/opcodes.ts:1929:8
      (set_global $core/cpu/cpu/Cpu.programCounter
       (i32.and
        ;;@ core/cpu/opcodes.ts:1929:29
        (call $core/cpu/opcodes/getConcatenatedDataByte)
        (i32.const 65535)
       )
      )
     )
     (return
      (i32.const 8)
     )
    )
    ;;@ core/cpu/opcodes.ts:1932:8
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/cpu/opcodes.ts:1932:29
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:1932:41
      (i32.add
       (get_global $core/cpu/cpu/Cpu.programCounter)
       ;;@ core/cpu/opcodes.ts:1932:62
       (i32.const 2)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:1933:15
    (return
     (i32.const 12)
    )
   )
   ;;@ core/cpu/opcodes.ts:1909:8
   (set_global $core/cpu/cpu/Cpu.programCounter
    (i32.and
     ;;@ core/cpu/opcodes.ts:1909:29
     (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
      ;;@ core/cpu/opcodes.ts:1909:59
      (get_global $core/cpu/cpu/Cpu.stackPointer)
     )
     (i32.const 65535)
    )
   )
   ;;@ core/cpu/opcodes.ts:1910:8
   (set_global $core/cpu/cpu/Cpu.stackPointer
    ;;@ core/cpu/opcodes.ts:1910:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:1910:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.stackPointer)
      ;;@ core/cpu/opcodes.ts:1910:58
      (i32.const 2)
     )
    )
   )
   ;;@ core/cpu/opcodes.ts:1911:15
   (return
    (i32.const 12)
   )
  )
  ;;@ core/cpu/opcodes.ts:1963:6
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/opcodes.ts:1963:27
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:1963:39
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:1963:60
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:1964:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcodeEx (; 268 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                ;;@ core/cpu/opcodes.ts:2043:9
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
              ;;@ core/cpu/opcodes.ts:2051:6
              (call $core/cpu/opcodes/eightBitStoreSyncCycles
               ;;@ core/cpu/opcodes.ts:2051:30
               (i32.add
                ;;@ core/cpu/opcodes.ts:2049:34
                (i32.and
                 (call $core/cpu/opcodes/getDataByteOne)
                 (i32.const 255)
                )
                ;;@ core/cpu/opcodes.ts:2051:30
                (i32.const 65280)
               )
               ;;@ core/cpu/opcodes.ts:2051:57
               (get_global $core/cpu/cpu/Cpu.registerA)
              )
              (br $folding-inner0)
             )
             ;;@ core/cpu/opcodes.ts:2058:6
             (set_local $0
              ;;@ core/cpu/opcodes.ts:2058:29
              (i32.and
               (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                ;;@ core/cpu/opcodes.ts:2058:54
                (get_global $core/cpu/cpu/Cpu.stackPointer)
               )
               (i32.const 65535)
              )
             )
             ;;@ core/cpu/opcodes.ts:2059:6
             (set_global $core/cpu/cpu/Cpu.stackPointer
              ;;@ core/cpu/opcodes.ts:2059:25
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:2059:37
               (i32.add
                (get_global $core/cpu/cpu/Cpu.stackPointer)
                ;;@ core/cpu/opcodes.ts:2059:56
                (i32.const 2)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:2060:6
             (set_global $core/cpu/cpu/Cpu.registerH
              (i32.and
               ;;@ core/cpu/opcodes.ts:2060:22
               (call $core/helpers/index/splitHighByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:2061:6
             (set_global $core/cpu/cpu/Cpu.registerL
              (i32.and
               ;;@ core/cpu/opcodes.ts:2061:22
               (call $core/helpers/index/splitLowByte
                (get_local $0)
               )
               (i32.const 255)
              )
             )
             ;;@ core/cpu/opcodes.ts:2062:13
             (return
              (i32.const 4)
             )
            )
            ;;@ core/cpu/opcodes.ts:2072:6
            (call $core/cpu/opcodes/eightBitStoreSyncCycles
             ;;@ core/cpu/opcodes.ts:2072:30
             (i32.add
              ;;@ core/cpu/opcodes.ts:2072:39
              (get_global $core/cpu/cpu/Cpu.registerC)
              ;;@ core/cpu/opcodes.ts:2072:30
              (i32.const 65280)
             )
             ;;@ core/cpu/opcodes.ts:2072:59
             (get_global $core/cpu/cpu/Cpu.registerA)
            )
            ;;@ core/cpu/opcodes.ts:2073:13
            (return
             (i32.const 4)
            )
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
            (call $core/helpers/index/concatenateBytes
             ;;@ core/cpu/opcodes.ts:2080:67
             (get_global $core/cpu/cpu/Cpu.registerH)
             ;;@ core/cpu/opcodes.ts:2080:82
             (get_global $core/cpu/cpu/Cpu.registerL)
            )
           )
           ;;@ core/cpu/opcodes.ts:2081:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:2087:6
          (call $core/cpu/instructions/andARegister
           ;;@ core/cpu/opcodes.ts:2087:19
           (call $core/cpu/opcodes/getDataByteOne)
          )
          (br $folding-inner0)
         )
         ;;@ core/cpu/opcodes.ts:2093:6
         (set_global $core/cpu/cpu/Cpu.stackPointer
          ;;@ core/cpu/opcodes.ts:2093:25
          (call $core/portable/portable/u16Portable
           ;;@ core/cpu/opcodes.ts:2093:37
           (i32.sub
            (get_global $core/cpu/cpu/Cpu.stackPointer)
            ;;@ core/cpu/opcodes.ts:2093:56
            (i32.const 2)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:2095:6
         (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
          ;;@ core/cpu/opcodes.ts:2095:32
          (get_global $core/cpu/cpu/Cpu.stackPointer)
          ;;@ core/cpu/opcodes.ts:2095:50
          (get_global $core/cpu/cpu/Cpu.programCounter)
         )
         ;;@ core/cpu/opcodes.ts:2096:6
         (set_global $core/cpu/cpu/Cpu.programCounter
          ;;@ core/cpu/opcodes.ts:2096:27
          (i32.const 32)
         )
         ;;@ core/cpu/opcodes.ts:2097:13
         (return
          (i32.const 8)
         )
        )
        ;;@ core/cpu/opcodes.ts:2104:6
        (set_local $0
         ;;@ core/cpu/opcodes.ts:2104:34
         (call $core/portable/portable/i8Portable
          ;;@ core/cpu/opcodes.ts:2104:45
          (call $core/cpu/opcodes/getDataByteOne)
         )
        )
        ;;@ core/cpu/opcodes.ts:2106:6
        (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
         ;;@ core/cpu/opcodes.ts:2106:44
         (get_global $core/cpu/cpu/Cpu.stackPointer)
         (tee_local $0
          ;;@ core/cpu/opcodes.ts:2106:62
          (i32.shr_s
           (i32.shl
            (get_local $0)
            (i32.const 24)
           )
           (i32.const 24)
          )
         )
         ;;@ core/cpu/opcodes.ts:2106:81
         (i32.const 1)
        )
        ;;@ core/cpu/opcodes.ts:2107:6
        (set_global $core/cpu/cpu/Cpu.stackPointer
         ;;@ core/cpu/opcodes.ts:2107:25
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2107:37
          (i32.add
           (get_global $core/cpu/cpu/Cpu.stackPointer)
           (get_local $0)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:2108:6
        (call $core/cpu/flags/setZeroFlag
         ;;@ core/cpu/opcodes.ts:2108:18
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:2109:6
        (call $core/cpu/flags/setSubtractFlag
         ;;@ core/cpu/opcodes.ts:2109:22
         (i32.const 0)
        )
        ;;@ core/cpu/opcodes.ts:2110:6
        (set_global $core/cpu/cpu/Cpu.programCounter
         ;;@ core/cpu/opcodes.ts:2110:27
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2110:39
          (i32.add
           (get_global $core/cpu/cpu/Cpu.programCounter)
           ;;@ core/cpu/opcodes.ts:2110:60
           (i32.const 1)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:2111:13
        (return
         (i32.const 12)
        )
       )
       ;;@ core/cpu/opcodes.ts:2115:6
       (set_global $core/cpu/cpu/Cpu.programCounter
        (i32.and
         ;;@ core/cpu/opcodes.ts:2115:27
         (call $core/helpers/index/concatenateBytes
          ;;@ core/cpu/opcodes.ts:2115:49
          (get_global $core/cpu/cpu/Cpu.registerH)
          ;;@ core/cpu/opcodes.ts:2115:64
          (get_global $core/cpu/cpu/Cpu.registerL)
         )
         (i32.const 65535)
        )
       )
       ;;@ core/cpu/opcodes.ts:2116:13
       (return
        (i32.const 4)
       )
      )
      ;;@ core/cpu/opcodes.ts:2121:6
      (call $core/cpu/opcodes/eightBitStoreSyncCycles
       ;;@ core/cpu/opcodes.ts:2121:30
       (i32.and
        (call $core/cpu/opcodes/getConcatenatedDataByte)
        (i32.const 65535)
       )
       ;;@ core/cpu/opcodes.ts:2121:57
       (get_global $core/cpu/cpu/Cpu.registerA)
      )
      ;;@ core/cpu/opcodes.ts:2122:6
      (set_global $core/cpu/cpu/Cpu.programCounter
       ;;@ core/cpu/opcodes.ts:2122:27
       (call $core/portable/portable/u16Portable
        ;;@ core/cpu/opcodes.ts:2122:39
        (i32.add
         (get_global $core/cpu/cpu/Cpu.programCounter)
         ;;@ core/cpu/opcodes.ts:2122:60
         (i32.const 2)
        )
       )
      )
      ;;@ core/cpu/opcodes.ts:2123:13
      (return
       (i32.const 4)
      )
     )
     ;;@ core/cpu/opcodes.ts:2130:6
     (call $core/cpu/instructions/xorARegister
      ;;@ core/cpu/opcodes.ts:2130:19
      (call $core/cpu/opcodes/getDataByteOne)
     )
     (br $folding-inner0)
    )
    ;;@ core/cpu/opcodes.ts:2136:6
    (set_global $core/cpu/cpu/Cpu.stackPointer
     ;;@ core/cpu/opcodes.ts:2136:25
     (call $core/portable/portable/u16Portable
      ;;@ core/cpu/opcodes.ts:2136:37
      (i32.sub
       (get_global $core/cpu/cpu/Cpu.stackPointer)
       ;;@ core/cpu/opcodes.ts:2136:56
       (i32.const 2)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:2138:6
    (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
     ;;@ core/cpu/opcodes.ts:2138:32
     (get_global $core/cpu/cpu/Cpu.stackPointer)
     ;;@ core/cpu/opcodes.ts:2138:50
     (get_global $core/cpu/cpu/Cpu.programCounter)
    )
    ;;@ core/cpu/opcodes.ts:2139:6
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/cpu/opcodes.ts:2139:27
     (i32.const 40)
    )
    ;;@ core/cpu/opcodes.ts:2140:13
    (return
     (i32.const 8)
    )
   )
   (return
    (i32.const -1)
   )
  )
  ;;@ core/cpu/opcodes.ts:2052:6
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/cpu/opcodes.ts:2052:27
   (call $core/portable/portable/u16Portable
    ;;@ core/cpu/opcodes.ts:2052:39
    (i32.add
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/cpu/opcodes.ts:2052:60
     (i32.const 1)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:2053:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/handleOpcodeFx (; 269 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
                   ;;@ core/cpu/opcodes.ts:2147:9
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
                 ;;@ core/cpu/opcodes.ts:2153:6
                 (set_global $core/cpu/cpu/Cpu.registerA
                  ;;@ core/cpu/opcodes.ts:2153:22
                  (call $core/helpers/index/splitLowByte
                   ;;@ core/cpu/opcodes.ts:2153:33
                   (call $core/cpu/opcodes/eightBitLoadSyncCycles
                    ;;@ core/cpu/opcodes.ts:2153:60
                    (i32.add
                     ;;@ core/cpu/opcodes.ts:2151:34
                     (i32.and
                      (call $core/cpu/opcodes/getDataByteOne)
                      (i32.const 255)
                     )
                     ;;@ core/cpu/opcodes.ts:2153:60
                     (i32.const 65280)
                    )
                   )
                  )
                 )
                 (br $folding-inner0)
                )
                ;;@ core/cpu/opcodes.ts:2161:6
                (set_local $0
                 ;;@ core/cpu/opcodes.ts:2161:29
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:2161:34
                  (call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                   ;;@ core/cpu/opcodes.ts:2161:59
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                  )
                  (i32.const 65535)
                 )
                )
                ;;@ core/cpu/opcodes.ts:2162:6
                (set_global $core/cpu/cpu/Cpu.stackPointer
                 ;;@ core/cpu/opcodes.ts:2162:25
                 (call $core/portable/portable/u16Portable
                  ;;@ core/cpu/opcodes.ts:2162:37
                  (i32.add
                   (get_global $core/cpu/cpu/Cpu.stackPointer)
                   ;;@ core/cpu/opcodes.ts:2162:56
                   (i32.const 2)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:2163:6
                (set_global $core/cpu/cpu/Cpu.registerA
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:2163:22
                  (call $core/helpers/index/splitHighByte
                   (get_local $0)
                  )
                  (i32.const 255)
                 )
                )
                ;;@ core/cpu/opcodes.ts:2164:6
                (set_global $core/cpu/cpu/Cpu.registerF
                 (i32.and
                  ;;@ core/cpu/opcodes.ts:2164:22
                  (call $core/helpers/index/splitLowByte
                   (get_local $0)
                  )
                  (i32.const 255)
                 )
                )
                (br $folding-inner1)
               )
               ;;@ core/cpu/opcodes.ts:2170:6
               (set_global $core/cpu/cpu/Cpu.registerA
                ;;@ core/cpu/opcodes.ts:2170:22
                (call $core/helpers/index/splitLowByte
                 ;;@ core/cpu/opcodes.ts:2170:33
                 (call $core/cpu/opcodes/eightBitLoadSyncCycles
                  ;;@ core/cpu/opcodes.ts:2170:60
                  (i32.add
                   ;;@ core/cpu/opcodes.ts:2170:69
                   (get_global $core/cpu/cpu/Cpu.registerC)
                   ;;@ core/cpu/opcodes.ts:2170:60
                   (i32.const 65280)
                  )
                 )
                )
               )
               (br $folding-inner1)
              )
              ;;@ core/cpu/opcodes.ts:2175:6
              (call $core/interrupts/interrupts/setInterrupts
               ;;@ core/cpu/opcodes.ts:2175:20
               (i32.const 0)
              )
              (br $folding-inner1)
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
              (call $core/helpers/index/concatenateBytes
               ;;@ core/cpu/opcodes.ts:2183:67
               (get_global $core/cpu/cpu/Cpu.registerA)
               ;;@ core/cpu/opcodes.ts:2183:82
               (get_global $core/cpu/cpu/Cpu.registerF)
              )
             )
             ;;@ core/cpu/opcodes.ts:2184:13
             (return
              (i32.const 8)
             )
            )
            ;;@ core/cpu/opcodes.ts:2190:6
            (call $core/cpu/instructions/orARegister
             ;;@ core/cpu/opcodes.ts:2190:18
             (call $core/cpu/opcodes/getDataByteOne)
            )
            (br $folding-inner0)
           )
           ;;@ core/cpu/opcodes.ts:2196:6
           (set_global $core/cpu/cpu/Cpu.stackPointer
            ;;@ core/cpu/opcodes.ts:2196:25
            (call $core/portable/portable/u16Portable
             ;;@ core/cpu/opcodes.ts:2196:37
             (i32.sub
              (get_global $core/cpu/cpu/Cpu.stackPointer)
              ;;@ core/cpu/opcodes.ts:2196:56
              (i32.const 2)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:2198:6
           (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
            ;;@ core/cpu/opcodes.ts:2198:32
            (get_global $core/cpu/cpu/Cpu.stackPointer)
            ;;@ core/cpu/opcodes.ts:2198:50
            (get_global $core/cpu/cpu/Cpu.programCounter)
           )
           ;;@ core/cpu/opcodes.ts:2199:6
           (set_global $core/cpu/cpu/Cpu.programCounter
            ;;@ core/cpu/opcodes.ts:2199:27
            (i32.const 48)
           )
           ;;@ core/cpu/opcodes.ts:2200:13
           (return
            (i32.const 8)
           )
          )
          ;;@ core/cpu/opcodes.ts:2207:6
          (set_local $0
           ;;@ core/cpu/opcodes.ts:2207:34
           (call $core/portable/portable/i8Portable
            ;;@ core/cpu/opcodes.ts:2207:45
            (call $core/cpu/opcodes/getDataByteOne)
           )
          )
          ;;@ core/cpu/opcodes.ts:2210:6
          (call $core/cpu/flags/setZeroFlag
           ;;@ core/cpu/opcodes.ts:2210:18
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:2211:6
          (call $core/cpu/flags/setSubtractFlag
           ;;@ core/cpu/opcodes.ts:2211:22
           (i32.const 0)
          )
          ;;@ core/cpu/opcodes.ts:2212:6
          (call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
           ;;@ core/cpu/opcodes.ts:2212:44
           (get_global $core/cpu/cpu/Cpu.stackPointer)
           (tee_local $0
            ;;@ core/cpu/opcodes.ts:2212:62
            (i32.shr_s
             (i32.shl
              (get_local $0)
              (i32.const 24)
             )
             (i32.const 24)
            )
           )
           ;;@ core/cpu/opcodes.ts:2212:81
           (i32.const 1)
          )
          ;;@ core/cpu/opcodes.ts:2214:6
          (set_global $core/cpu/cpu/Cpu.registerH
           (i32.and
            ;;@ core/cpu/opcodes.ts:2214:22
            (call $core/helpers/index/splitHighByte
             ;;@ core/cpu/opcodes.ts:2213:6
             (tee_local $0
              ;;@ core/cpu/opcodes.ts:2213:23
              (call $core/portable/portable/u16Portable
               ;;@ core/cpu/opcodes.ts:2213:35
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
          ;;@ core/cpu/opcodes.ts:2215:6
          (set_global $core/cpu/cpu/Cpu.registerL
           (i32.and
            ;;@ core/cpu/opcodes.ts:2215:22
            (call $core/helpers/index/splitLowByte
             (get_local $0)
            )
            (i32.const 255)
           )
          )
          ;;@ core/cpu/opcodes.ts:2216:6
          (set_global $core/cpu/cpu/Cpu.programCounter
           ;;@ core/cpu/opcodes.ts:2216:27
           (call $core/portable/portable/u16Portable
            ;;@ core/cpu/opcodes.ts:2216:39
            (i32.add
             (get_global $core/cpu/cpu/Cpu.programCounter)
             ;;@ core/cpu/opcodes.ts:2216:60
             (i32.const 1)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:2217:13
          (return
           (i32.const 8)
          )
         )
         ;;@ core/cpu/opcodes.ts:2221:6
         (set_global $core/cpu/cpu/Cpu.stackPointer
          (i32.and
           ;;@ core/cpu/opcodes.ts:2221:25
           (call $core/helpers/index/concatenateBytes
            ;;@ core/cpu/opcodes.ts:2221:47
            (get_global $core/cpu/cpu/Cpu.registerH)
            ;;@ core/cpu/opcodes.ts:2221:62
            (get_global $core/cpu/cpu/Cpu.registerL)
           )
           (i32.const 65535)
          )
         )
         ;;@ core/cpu/opcodes.ts:2222:13
         (return
          (i32.const 8)
         )
        )
        ;;@ core/cpu/opcodes.ts:2227:6
        (set_global $core/cpu/cpu/Cpu.registerA
         (i32.and
          ;;@ core/cpu/opcodes.ts:2227:22
          (call $core/cpu/opcodes/eightBitLoadSyncCycles
           ;;@ core/cpu/opcodes.ts:2227:49
           (i32.and
            (call $core/cpu/opcodes/getConcatenatedDataByte)
            (i32.const 65535)
           )
          )
          (i32.const 255)
         )
        )
        ;;@ core/cpu/opcodes.ts:2228:6
        (set_global $core/cpu/cpu/Cpu.programCounter
         ;;@ core/cpu/opcodes.ts:2228:27
         (call $core/portable/portable/u16Portable
          ;;@ core/cpu/opcodes.ts:2228:39
          (i32.add
           (get_global $core/cpu/cpu/Cpu.programCounter)
           ;;@ core/cpu/opcodes.ts:2228:60
           (i32.const 2)
          )
         )
        )
        (br $folding-inner1)
       )
       ;;@ core/cpu/opcodes.ts:2233:6
       (call $core/interrupts/interrupts/setInterrupts
        ;;@ core/cpu/opcodes.ts:2233:20
        (i32.const 1)
       )
       (br $folding-inner1)
      )
      ;;@ core/cpu/opcodes.ts:2241:6
      (call $core/cpu/instructions/cpARegister
       ;;@ core/cpu/opcodes.ts:2241:18
       (call $core/cpu/opcodes/getDataByteOne)
      )
      (br $folding-inner0)
     )
     ;;@ core/cpu/opcodes.ts:2247:6
     (set_global $core/cpu/cpu/Cpu.stackPointer
      ;;@ core/cpu/opcodes.ts:2247:25
      (call $core/portable/portable/u16Portable
       ;;@ core/cpu/opcodes.ts:2247:37
       (i32.sub
        (get_global $core/cpu/cpu/Cpu.stackPointer)
        ;;@ core/cpu/opcodes.ts:2247:56
        (i32.const 2)
       )
      )
     )
     ;;@ core/cpu/opcodes.ts:2249:6
     (call $core/cpu/opcodes/sixteenBitStoreSyncCycles
      ;;@ core/cpu/opcodes.ts:2249:32
      (get_global $core/cpu/cpu/Cpu.stackPointer)
      ;;@ core/cpu/opcodes.ts:2249:50
      (get_global $core/cpu/cpu/Cpu.programCounter)
     )
     ;;@ core/cpu/opcodes.ts:2250:6
     (set_global $core/cpu/cpu/Cpu.programCounter
      ;;@ core/cpu/opcodes.ts:2250:27
      (i32.const 56)
     )
     ;;@ core/cpu/opcodes.ts:2251:13
     (return
      (i32.const 8)
     )
    )
    (return
     (i32.const -1)
    )
   )
   ;;@ core/cpu/opcodes.ts:2154:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:2154:27
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:2154:39
     (i32.add
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:2154:60
      (i32.const 1)
     )
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:2165:13
  (i32.const 4)
 )
 (func $core/cpu/opcodes/executeOpcode (; 270 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
  ;;@ core/cpu/opcodes.ts:74:2
  (if
   ;;@ core/cpu/opcodes.ts:74:6
   (get_global $core/cpu/cpu/Cpu.isHaltBug)
   ;;@ core/cpu/opcodes.ts:74:21
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/cpu/opcodes.ts:84:25
    (call $core/portable/portable/u16Portable
     ;;@ core/cpu/opcodes.ts:84:37
     (i32.sub
      (get_global $core/cpu/cpu/Cpu.programCounter)
      ;;@ core/cpu/opcodes.ts:84:58
      (i32.const 1)
     )
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
                  ;;@ core/cpu/opcodes.ts:90:2
                  (tee_local $1
                   ;;@ core/cpu/opcodes.ts:90:21
                   (i32.shr_s
                    ;;@ core/cpu/opcodes.ts:89:30
                    (i32.and
                     (get_local $0)
                     ;;@ core/cpu/opcodes.ts:89:39
                     (i32.const 240)
                    )
                    ;;@ core/cpu/opcodes.ts:90:41
                    (i32.const 4)
                   )
                  )
                  (block
                   (br_if $case1|0
                    (i32.eq
                     (get_local $1)
                     ;;@ core/cpu/opcodes.ts:102:9
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
                 ;;@ core/cpu/opcodes.ts:101:34
                 (return
                  ;;@ core/cpu/opcodes.ts:101:13
                  (call $core/cpu/opcodes/handleOpcode0x
                   (get_local $0)
                  )
                 )
                )
                ;;@ core/cpu/opcodes.ts:103:34
                (return
                 ;;@ core/cpu/opcodes.ts:103:13
                 (call $core/cpu/opcodes/handleOpcode1x
                  (get_local $0)
                 )
                )
               )
               ;;@ core/cpu/opcodes.ts:105:34
               (return
                ;;@ core/cpu/opcodes.ts:105:13
                (call $core/cpu/opcodes/handleOpcode2x
                 (get_local $0)
                )
               )
              )
              ;;@ core/cpu/opcodes.ts:107:34
              (return
               ;;@ core/cpu/opcodes.ts:107:13
               (call $core/cpu/opcodes/handleOpcode3x
                (get_local $0)
               )
              )
             )
             ;;@ core/cpu/opcodes.ts:109:34
             (return
              ;;@ core/cpu/opcodes.ts:109:13
              (call $core/cpu/opcodes/handleOpcode4x
               (get_local $0)
              )
             )
            )
            ;;@ core/cpu/opcodes.ts:111:34
            (return
             ;;@ core/cpu/opcodes.ts:111:13
             (call $core/cpu/opcodes/handleOpcode5x
              (get_local $0)
             )
            )
           )
           ;;@ core/cpu/opcodes.ts:113:34
           (return
            ;;@ core/cpu/opcodes.ts:113:13
            (call $core/cpu/opcodes/handleOpcode6x
             (get_local $0)
            )
           )
          )
          ;;@ core/cpu/opcodes.ts:115:34
          (return
           ;;@ core/cpu/opcodes.ts:115:13
           (call $core/cpu/opcodes/handleOpcode7x
            (get_local $0)
           )
          )
         )
         ;;@ core/cpu/opcodes.ts:117:34
         (return
          ;;@ core/cpu/opcodes.ts:117:13
          (call $core/cpu/opcodes/handleOpcode8x
           (get_local $0)
          )
         )
        )
        ;;@ core/cpu/opcodes.ts:119:34
        (return
         ;;@ core/cpu/opcodes.ts:119:13
         (call $core/cpu/opcodes/handleOpcode9x
          (get_local $0)
         )
        )
       )
       ;;@ core/cpu/opcodes.ts:121:34
       (return
        ;;@ core/cpu/opcodes.ts:121:13
        (call $core/cpu/opcodes/handleOpcodeAx
         (get_local $0)
        )
       )
      )
      ;;@ core/cpu/opcodes.ts:123:34
      (return
       ;;@ core/cpu/opcodes.ts:123:13
       (call $core/cpu/opcodes/handleOpcodeBx
        (get_local $0)
       )
      )
     )
     ;;@ core/cpu/opcodes.ts:125:34
     (return
      ;;@ core/cpu/opcodes.ts:125:13
      (call $core/cpu/opcodes/handleOpcodeCx
       (get_local $0)
      )
     )
    )
    ;;@ core/cpu/opcodes.ts:127:34
    (return
     ;;@ core/cpu/opcodes.ts:127:13
     (call $core/cpu/opcodes/handleOpcodeDx
      (get_local $0)
     )
    )
   )
   ;;@ core/cpu/opcodes.ts:129:34
   (return
    ;;@ core/cpu/opcodes.ts:129:13
    (call $core/cpu/opcodes/handleOpcodeEx
     (get_local $0)
    )
   )
  )
  ;;@ core/cpu/opcodes.ts:131:13
  (call $core/cpu/opcodes/handleOpcodeFx
   (get_local $0)
  )
 )
 (func $core/cpu/cpu/Cpu.exitHaltAndStop (; 271 ;) (; has Stack IR ;) (type $v)
  ;;@ core/cpu/cpu.ts:91:4
  (set_global $core/cpu/cpu/Cpu.isHaltNoJump
   ;;@ core/cpu/cpu.ts:91:23
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:92:4
  (set_global $core/cpu/cpu/Cpu.isHaltNormal
   ;;@ core/cpu/cpu.ts:92:23
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:93:4
  (set_global $core/cpu/cpu/Cpu.isHaltBug
   ;;@ core/cpu/cpu.ts:93:20
   (i32.const 0)
  )
  ;;@ core/cpu/cpu.ts:94:4
  (set_global $core/cpu/cpu/Cpu.isStopped
   ;;@ core/cpu/cpu.ts:94:20
   (i32.const 0)
  )
 )
 (func $core/cpu/cpu/Cpu.isHalted (; 272 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/cpu.ts:98:4
  (if
   ;;@ core/cpu/cpu.ts:98:8
   (if (result i32)
    (get_global $core/cpu/cpu/Cpu.isHaltNormal)
    (get_global $core/cpu/cpu/Cpu.isHaltNormal)
    ;;@ core/cpu/cpu.ts:98:28
    (get_global $core/cpu/cpu/Cpu.isHaltNoJump)
   )
   (return
    (i32.const 1)
   )
  )
  (i32.const 0)
 )
 (func $core/memory/store/sixteenBitStoreIntoGBMemory (; 273 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/interrupts/interrupts/_handleInterrupt (; 274 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (local $1 i32)
  ;;@ core/interrupts/interrupts.ts:163:2
  (call $core/interrupts/interrupts/setInterrupts
   ;;@ core/interrupts/interrupts.ts:163:16
   (i32.const 0)
  )
  ;;@ core/interrupts/interrupts.ts:168:2
  (set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   ;;@ core/interrupts/interrupts.ts:167:2
   (tee_local $1
    ;;@ core/interrupts/interrupts.ts:167:21
    (call $core/helpers/index/resetBitOnByte
     (get_local $0)
     ;;@ core/interrupts/interrupts.ts:166:25
     (call $core/memory/load/eightBitLoadFromGBMemory
      (i32.const 65295)
     )
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:169:2
  (call $core/memory/store/eightBitStoreIntoGBMemory
   (i32.const 65295)
   (get_local $1)
  )
  ;;@ core/interrupts/interrupts.ts:173:2
  (set_global $core/cpu/cpu/Cpu.stackPointer
   (i32.and
    ;;@ core/interrupts/interrupts.ts:173:21
    (i32.sub
     (get_global $core/cpu/cpu/Cpu.stackPointer)
     ;;@ core/interrupts/interrupts.ts:173:40
     (i32.const 2)
    )
    (i32.const 65535)
   )
  )
  (drop
   ;;@ core/interrupts/interrupts.ts:174:10
   (call $core/cpu/cpu/Cpu.isHalted)
  )
  ;;@ core/interrupts/interrupts.ts:174:22
  (call $core/memory/store/sixteenBitStoreIntoGBMemory
   ;;@ core/interrupts/interrupts.ts:177:32
   (get_global $core/cpu/cpu/Cpu.stackPointer)
   ;;@ core/interrupts/interrupts.ts:177:50
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
  ;;@ core/interrupts/interrupts.ts:185:2
  (block $break|0
   (block $case4|0
    (block $case3|0
     (block $case2|0
      (block $case1|0
       (if
        (get_local $0)
        (block
         (br_if $case1|0
          (i32.eq
           (get_local $0)
           (i32.const 1)
          )
         )
         (block $tablify|0
          (br_table $case2|0 $case3|0 $case4|0 $tablify|0
           (i32.sub
            (get_local $0)
            (i32.const 2)
           )
          )
         )
         (br $break|0)
        )
       )
       ;;@ core/interrupts/interrupts.ts:187:6
       (set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
        ;;@ core/interrupts/interrupts.ts:187:46
        (i32.const 0)
       )
       ;;@ core/interrupts/interrupts.ts:188:6
       (set_global $core/cpu/cpu/Cpu.programCounter
        ;;@ core/interrupts/interrupts.ts:188:27
        (i32.const 64)
       )
       ;;@ core/interrupts/interrupts.ts:189:6
       (br $break|0)
      )
      ;;@ core/interrupts/interrupts.ts:191:6
      (set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
       ;;@ core/interrupts/interrupts.ts:191:43
       (i32.const 0)
      )
      ;;@ core/interrupts/interrupts.ts:192:6
      (set_global $core/cpu/cpu/Cpu.programCounter
       ;;@ core/interrupts/interrupts.ts:192:27
       (i32.const 72)
      )
      ;;@ core/interrupts/interrupts.ts:193:6
      (br $break|0)
     )
     ;;@ core/interrupts/interrupts.ts:195:6
     (set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
      ;;@ core/interrupts/interrupts.ts:195:45
      (i32.const 0)
     )
     ;;@ core/interrupts/interrupts.ts:196:6
     (set_global $core/cpu/cpu/Cpu.programCounter
      ;;@ core/interrupts/interrupts.ts:196:27
      (i32.const 80)
     )
     ;;@ core/interrupts/interrupts.ts:197:6
     (br $break|0)
    )
    ;;@ core/interrupts/interrupts.ts:199:6
    (set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
     ;;@ core/interrupts/interrupts.ts:199:46
     (i32.const 0)
    )
    ;;@ core/interrupts/interrupts.ts:200:6
    (set_global $core/cpu/cpu/Cpu.programCounter
     ;;@ core/interrupts/interrupts.ts:200:27
     (i32.const 88)
    )
    ;;@ core/interrupts/interrupts.ts:201:6
    (br $break|0)
   )
   ;;@ core/interrupts/interrupts.ts:203:6
   (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
    ;;@ core/interrupts/interrupts.ts:203:46
    (i32.const 0)
   )
   ;;@ core/interrupts/interrupts.ts:204:6
   (set_global $core/cpu/cpu/Cpu.programCounter
    ;;@ core/interrupts/interrupts.ts:204:27
    (i32.const 96)
   )
  )
 )
 (func $core/interrupts/interrupts/checkInterrupts (; 275 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/interrupts/interrupts.ts:103:2
  (if
   ;;@ core/interrupts/interrupts.ts:103:6
   (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay)
   ;;@ core/interrupts/interrupts.ts:103:45
   (block
    ;;@ core/interrupts/interrupts.ts:104:4
    (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
     ;;@ core/interrupts/interrupts.ts:104:39
     (i32.const 1)
    )
    ;;@ core/interrupts/interrupts.ts:105:4
    (set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
     ;;@ core/interrupts/interrupts.ts:105:44
     (i32.const 0)
    )
   )
  )
  ;;@ core/interrupts/interrupts.ts:111:2
  (if
   ;;@ core/interrupts/interrupts.ts:111:6
   (i32.gt_s
    ;;@ core/interrupts/interrupts.ts:109:51
    (i32.and
     (i32.and
      (get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue)
      ;;@ core/interrupts/interrupts.ts:109:87
      (get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue)
     )
     ;;@ core/interrupts/interrupts.ts:109:125
     (i32.const 31)
    )
    ;;@ core/interrupts/interrupts.ts:111:46
    (i32.const 0)
   )
   ;;@ core/interrupts/interrupts.ts:111:49
   (block
    ;;@ core/interrupts/interrupts.ts:119:4
    (if
     (tee_local $0
      ;;@ core/interrupts/interrupts.ts:119:8
      (if (result i32)
       (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
       ;;@ core/interrupts/interrupts.ts:119:44
       (i32.eqz
        ;;@ core/interrupts/interrupts.ts:119:45
        (get_global $core/cpu/cpu/Cpu.isHaltNoJump)
       )
       (get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch)
      )
     )
     ;;@ core/interrupts/interrupts.ts:119:63
     (if
      (tee_local $0
       ;;@ core/interrupts/interrupts.ts:120:10
       (if (result i32)
        (get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled)
        ;;@ core/interrupts/interrupts.ts:120:49
        (get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested)
        (get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled)
       )
      )
      ;;@ core/interrupts/interrupts.ts:120:88
      (block
       ;;@ core/interrupts/interrupts.ts:121:8
       (call $core/interrupts/interrupts/_handleInterrupt
        (i32.const 0)
       )
       ;;@ core/interrupts/interrupts.ts:122:8
       (set_local $1
        ;;@ core/interrupts/interrupts.ts:122:30
        (i32.const 1)
       )
      )
      ;;@ core/interrupts/interrupts.ts:123:13
      (if
       (tee_local $0
        ;;@ core/interrupts/interrupts.ts:123:17
        (if (result i32)
         (get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled)
         ;;@ core/interrupts/interrupts.ts:123:53
         (get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested)
         (get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled)
        )
       )
       ;;@ core/interrupts/interrupts.ts:123:89
       (block
        ;;@ core/interrupts/interrupts.ts:124:8
        (call $core/interrupts/interrupts/_handleInterrupt
         (i32.const 1)
        )
        ;;@ core/interrupts/interrupts.ts:125:8
        (set_local $1
         ;;@ core/interrupts/interrupts.ts:125:30
         (i32.const 1)
        )
       )
       ;;@ core/interrupts/interrupts.ts:126:13
       (if
        (tee_local $0
         ;;@ core/interrupts/interrupts.ts:126:17
         (if (result i32)
          (get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled)
          ;;@ core/interrupts/interrupts.ts:126:55
          (get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested)
          (get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled)
         )
        )
        ;;@ core/interrupts/interrupts.ts:126:93
        (block
         ;;@ core/interrupts/interrupts.ts:127:8
         (call $core/interrupts/interrupts/_handleInterrupt
          (i32.const 2)
         )
         ;;@ core/interrupts/interrupts.ts:128:8
         (set_local $1
          ;;@ core/interrupts/interrupts.ts:128:30
          (i32.const 1)
         )
        )
        ;;@ core/interrupts/interrupts.ts:129:13
        (if
         (tee_local $0
          ;;@ core/interrupts/interrupts.ts:129:17
          (if (result i32)
           (get_global $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled)
           ;;@ core/interrupts/interrupts.ts:129:56
           (get_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested)
           (get_global $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled)
          )
         )
         ;;@ core/interrupts/interrupts.ts:129:95
         (block
          ;;@ core/interrupts/interrupts.ts:130:8
          (call $core/interrupts/interrupts/_handleInterrupt
           (i32.const 3)
          )
          ;;@ core/interrupts/interrupts.ts:131:8
          (set_local $1
           ;;@ core/interrupts/interrupts.ts:131:30
           (i32.const 1)
          )
         )
         ;;@ core/interrupts/interrupts.ts:132:13
         (if
          (tee_local $0
           ;;@ core/interrupts/interrupts.ts:132:17
           (if (result i32)
            (get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled)
            ;;@ core/interrupts/interrupts.ts:132:56
            (get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested)
            (get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled)
           )
          )
          ;;@ core/interrupts/interrupts.ts:132:95
          (block
           ;;@ core/interrupts/interrupts.ts:133:8
           (call $core/interrupts/interrupts/_handleInterrupt
            (i32.const 4)
           )
           ;;@ core/interrupts/interrupts.ts:134:8
           (set_local $1
            ;;@ core/interrupts/interrupts.ts:134:30
            (i32.const 1)
           )
          )
         )
        )
       )
      )
     )
    )
    ;;@ core/interrupts/interrupts.ts:138:4
    (set_local $0
     ;;@ core/interrupts/interrupts.ts:138:37
     (i32.const 0)
    )
    ;;@ core/interrupts/interrupts.ts:139:4
    (if
     (get_local $1)
     ;;@ core/interrupts/interrupts.ts:139:29
     (block
      ;;@ core/interrupts/interrupts.ts:141:6
      (set_local $0
       ;;@ core/interrupts/interrupts.ts:141:30
       (i32.const 20)
      )
      ;;@ core/interrupts/interrupts.ts:142:6
      (if
       ;;@ core/interrupts/interrupts.ts:142:14
       (call $core/cpu/cpu/Cpu.isHalted)
       ;;@ core/interrupts/interrupts.ts:142:26
       (block
        ;;@ core/interrupts/interrupts.ts:146:12
        (call $core/cpu/cpu/Cpu.exitHaltAndStop)
        ;;@ core/interrupts/interrupts.ts:147:8
        (set_local $0
         (i32.const 24)
        )
       )
      )
     )
    )
    ;;@ core/interrupts/interrupts.ts:151:4
    (if
     ;;@ core/interrupts/interrupts.ts:151:12
     (call $core/cpu/cpu/Cpu.isHalted)
     ;;@ core/interrupts/interrupts.ts:151:24
     (call $core/cpu/cpu/Cpu.exitHaltAndStop)
    )
    ;;@ core/interrupts/interrupts.ts:155:11
    (return
     (get_local $0)
    )
   )
  )
  (i32.const 0)
 )
 (func $core/execute/trackStepsRan (; 276 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/execute.ts:32:2
  (set_global $core/execute/Execute.steps
   (i32.add
    (get_global $core/execute/Execute.steps)
    (get_local $0)
   )
  )
  ;;@ core/execute.ts:33:2
  (if
   ;;@ core/execute.ts:33:6
   (i32.ge_s
    (get_global $core/execute/Execute.steps)
    ;;@ core/execute.ts:33:23
    (get_global $core/execute/Execute.stepsPerStepSet)
   )
   ;;@ core/execute.ts:33:48
   (block
    ;;@ core/execute.ts:34:4
    (set_global $core/execute/Execute.stepSets
     (i32.add
      (get_global $core/execute/Execute.stepSets)
      ;;@ core/execute.ts:34:24
      (i32.const 1)
     )
    )
    ;;@ core/execute.ts:35:4
    (set_global $core/execute/Execute.steps
     (i32.sub
      (get_global $core/execute/Execute.steps)
      ;;@ core/execute.ts:35:21
      (get_global $core/execute/Execute.stepsPerStepSet)
     )
    )
   )
  )
 )
 (func $core/execute/executeStep (; 277 ;) (; has Stack IR ;) (type $i) (result i32)
  (local $0 i32)
  (local $1 i32)
  ;;@ core/execute.ts:166:2
  (call $core/core/setHasCoreStarted
   ;;@ core/execute.ts:166:20
   (i32.const 1)
  )
  ;;@ core/execute.ts:169:2
  (if
   ;;@ core/execute.ts:169:6
   (get_global $core/cpu/cpu/Cpu.isHaltBug)
   ;;@ core/execute.ts:169:21
   (block
    ;;@ core/execute.ts:183:4
    (call $core/cycles/syncCycles
     ;;@ core/execute.ts:182:29
     (call $core/cpu/opcodes/executeOpcode
      ;;@ core/execute.ts:180:29
      (i32.and
       ;;@ core/execute.ts:180:33
       (call $core/memory/load/eightBitLoadFromGBMemory
        ;;@ core/execute.ts:180:58
        (get_global $core/cpu/cpu/Cpu.programCounter)
       )
       (i32.const 255)
      )
     )
    )
    ;;@ core/execute.ts:184:8
    (call $core/cpu/cpu/Cpu.exitHaltAndStop)
   )
  )
  ;;@ core/execute.ts:190:2
  (if
   ;;@ core/execute.ts:190:6
   (i32.gt_s
    ;;@ core/execute.ts:189:2
    (tee_local $1
     ;;@ core/execute.ts:189:29
     (call $core/interrupts/interrupts/checkInterrupts)
    )
    ;;@ core/execute.ts:190:24
    (i32.const 0)
   )
   ;;@ core/execute.ts:190:27
   (call $core/cycles/syncCycles
    (get_local $1)
   )
  )
  ;;@ core/execute.ts:196:2
  (set_local $0
   ;;@ core/execute.ts:196:28
   (i32.const 4)
  )
  ;;@ core/execute.ts:201:6
  (if
   (tee_local $1
    (i32.eqz
     ;;@ core/execute.ts:201:11
     (call $core/cpu/cpu/Cpu.isHalted)
    )
   )
   (set_local $1
    ;;@ core/execute.ts:201:25
    (i32.eqz
     ;;@ core/execute.ts:201:26
     (get_global $core/cpu/cpu/Cpu.isStopped)
    )
   )
  )
  ;;@ core/execute.ts:201:2
  (if
   (get_local $1)
   ;;@ core/execute.ts:203:4
   (set_local $0
    ;;@ core/execute.ts:203:21
    (call $core/cpu/opcodes/executeOpcode
     ;;@ core/execute.ts:202:13
     (i32.and
      ;;@ core/execute.ts:202:17
      (call $core/memory/load/eightBitLoadFromGBMemory
       ;;@ core/execute.ts:202:42
       (get_global $core/cpu/cpu/Cpu.programCounter)
      )
      (i32.const 255)
     )
    )
   )
  )
  ;;@ core/execute.ts:207:2
  (set_global $core/cpu/cpu/Cpu.registerF
   ;;@ core/execute.ts:207:18
   (i32.and
    (get_global $core/cpu/cpu/Cpu.registerF)
    ;;@ core/execute.ts:207:34
    (i32.const 240)
   )
  )
  ;;@ core/execute.ts:210:2
  (if
   ;;@ core/execute.ts:210:6
   (i32.le_s
    (get_local $0)
    ;;@ core/execute.ts:210:24
    (i32.const 0)
   )
   ;;@ core/execute.ts:210:27
   (return
    (get_local $0)
   )
  )
  ;;@ core/execute.ts:215:2
  (call $core/cycles/syncCycles
   (get_local $0)
  )
  ;;@ core/execute.ts:218:2
  (call $core/execute/trackStepsRan
   ;;@ core/execute.ts:218:16
   (i32.const 1)
  )
  (get_local $0)
 )
 (func $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME (; 278 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cpu/cpu.ts:56:4
  (if
   ;;@ core/cpu/cpu.ts:56:8
   (get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed)
   (return
    (i32.const 140448)
   )
  )
  (i32.const 70224)
 )
 (func $core/sound/sound/getNumberOfSamplesInAudioBuffer (; 279 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/sound/sound.ts:202:15
  (get_global $core/sound/sound/Sound.audioQueueIndex)
 )
 (func $core/execute/executeUntilCondition (; 280 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  ;;@ core/execute.ts:108:2
  (set_local $3
   ;;@ core/execute.ts:108:29
   (i32.const 1024)
  )
  ;;@ core/execute.ts:110:2
  (if
   ;;@ core/execute.ts:110:6
   (i32.gt_s
    (get_local $1)
    ;;@ core/execute.ts:110:23
    (i32.const 0)
   )
   ;;@ core/execute.ts:110:26
   (set_local $3
    (get_local $1)
   )
   ;;@ core/execute.ts:112:9
   (if
    ;;@ core/execute.ts:112:13
    (i32.lt_s
     (get_local $1)
     ;;@ core/execute.ts:112:30
     (i32.const 0)
    )
    ;;@ core/execute.ts:112:33
    (set_local $3
     ;;@ core/execute.ts:113:22
     (i32.const -1)
    )
   )
  )
  ;;@ core/execute.ts:117:2
  (set_local $1
   ;;@ core/execute.ts:117:32
   (i32.const 0)
  )
  (loop $continue|0
   ;;@ core/execute.ts:121:9
   (if
    (tee_local $0
     (i32.eqz
      (get_local $6)
     )
    )
    (set_local $0
     ;;@ core/execute.ts:121:28
     (i32.eqz
      (get_local $1)
     )
    )
   )
   ;;@ core/execute.ts:121:9
   (if
    (get_local $0)
    (set_local $0
     ;;@ core/execute.ts:121:47
     (i32.eqz
      (get_local $4)
     )
    )
   )
   ;;@ core/execute.ts:121:9
   (if
    (get_local $0)
    (set_local $0
     ;;@ core/execute.ts:121:72
     (i32.eqz
      (get_local $5)
     )
    )
   )
   (if
    (get_local $0)
    (block
     ;;@ core/execute.ts:125:4
     (if
      ;;@ core/execute.ts:125:8
      (i32.lt_s
       ;;@ core/execute.ts:122:21
       (call $core/execute/executeStep)
       ;;@ core/execute.ts:125:25
       (i32.const 0)
      )
      ;;@ core/execute.ts:125:28
      (set_local $6
       ;;@ core/execute.ts:126:23
       (i32.const 1)
      )
      ;;@ core/execute.ts:127:11
      (if
       ;;@ core/execute.ts:127:15
       (i32.ge_s
        (get_global $core/cpu/cpu/Cpu.currentCycles)
        ;;@ core/execute.ts:127:40
        (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
       )
       ;;@ core/execute.ts:127:64
       (set_local $1
        ;;@ core/execute.ts:128:23
        (i32.const 1)
       )
       (block
        ;;@ core/execute.ts:129:15
        (if
         (tee_local $0
          (i32.gt_s
           (get_local $3)
           ;;@ core/execute.ts:129:33
           (i32.const -1)
          )
         )
         (set_local $0
          ;;@ core/execute.ts:129:39
          (i32.ge_s
           (call $core/sound/sound/getNumberOfSamplesInAudioBuffer)
           (get_local $3)
          )
         )
        )
        ;;@ core/execute.ts:129:11
        (if
         (get_local $0)
         ;;@ core/execute.ts:129:93
         (set_local $4
          ;;@ core/execute.ts:130:29
          (i32.const 1)
         )
         (block
          ;;@ core/execute.ts:131:15
          (if
           (tee_local $0
            (i32.gt_s
             (get_local $2)
             ;;@ core/execute.ts:131:28
             (i32.const -1)
            )
           )
           (set_local $0
            ;;@ core/execute.ts:131:34
            (i32.eq
             (get_global $core/cpu/cpu/Cpu.programCounter)
             (get_local $2)
            )
           )
          )
          ;;@ core/execute.ts:131:11
          (if
           (get_local $0)
           ;;@ core/execute.ts:131:69
           (set_local $5
            ;;@ core/execute.ts:132:28
            (i32.const 1)
           )
          )
         )
        )
       )
      )
     )
     (br $continue|0)
    )
   )
  )
  ;;@ core/execute.ts:137:2
  (if
   (get_local $1)
   ;;@ core/execute.ts:137:22
   (block
    ;;@ core/execute.ts:141:4
    (set_global $core/cpu/cpu/Cpu.currentCycles
     (i32.sub
      (get_global $core/cpu/cpu/Cpu.currentCycles)
      ;;@ core/execute.ts:141:29
      (call $core/cpu/cpu/Cpu.MAX_CYCLES_PER_FRAME)
     )
    )
    ;;@ core/execute.ts:143:11
    (return
     (i32.const 0)
    )
   )
  )
  ;;@ core/execute.ts:146:2
  (if
   (get_local $4)
   (return
    (i32.const 1)
   )
  )
  ;;@ core/execute.ts:150:2
  (if
   (get_local $5)
   (return
    (i32.const 2)
   )
  )
  ;;@ core/execute.ts:158:2
  (set_global $core/cpu/cpu/Cpu.programCounter
   ;;@ core/execute.ts:158:23
   (call $core/portable/portable/u16Portable
    ;;@ core/execute.ts:158:35
    (i32.sub
     (get_global $core/cpu/cpu/Cpu.programCounter)
     ;;@ core/execute.ts:158:56
     (i32.const 1)
    )
   )
  )
  (i32.const -1)
 )
 (func $core/execute/executeFrame (; 281 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/execute.ts:71:43
  (call $core/execute/executeUntilCondition
   ;;@ core/execute.ts:71:31
   (i32.const 1)
   ;;@ core/execute.ts:71:37
   (i32.const -1)
   ;;@ core/execute.ts:71:41
   (i32.const -1)
  )
 )
 (func $core/execute/executeMultipleFrames (; 282 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (loop $continue|0
   ;;@ core/execute.ts:53:9
   (if
    (tee_local $3
     (i32.lt_s
      (get_local $2)
      (get_local $0)
     )
    )
    (set_local $3
     ;;@ core/execute.ts:53:39
     (i32.ge_s
      (get_local $1)
      ;;@ core/execute.ts:53:56
      (i32.const 0)
     )
    )
   )
   (if
    (get_local $3)
    (block
     ;;@ core/execute.ts:54:4
     (set_local $1
      ;;@ core/execute.ts:54:20
      (call $core/execute/executeFrame)
     )
     ;;@ core/execute.ts:55:4
     (set_local $2
      (i32.add
       (get_local $2)
       ;;@ core/execute.ts:55:17
       (i32.const 1)
      )
     )
     (br $continue|0)
    )
   )
  )
  ;;@ core/execute.ts:58:2
  (if
   ;;@ core/execute.ts:58:6
   (i32.lt_s
    (get_local $1)
    ;;@ core/execute.ts:58:22
    (i32.const 0)
   )
   ;;@ core/execute.ts:58:25
   (return
    (get_local $1)
   )
  )
  (i32.const 0)
 )
 (func $core/execute/executeFrameAndCheckAudio (; 283 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  ;;@ core/execute.ts:80:55
  (call $core/execute/executeUntilCondition
   ;;@ core/execute.ts:80:31
   (i32.const 1)
   (get_local $0)
   ;;@ core/execute.ts:80:53
   (i32.const -1)
  )
 )
 (func $core/execute/executeFrameUntilBreakpoint (; 284 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  ;;@ core/execute.ts:92:2
  (if
   ;;@ core/execute.ts:92:6
   (i32.eq
    ;;@ core/execute.ts:89:2
    (tee_local $1
     ;;@ core/execute.ts:89:22
     (call $core/execute/executeUntilCondition
      ;;@ core/execute.ts:89:44
      (i32.const 1)
      ;;@ core/execute.ts:89:50
      (i32.const -1)
      (get_local $0)
     )
    )
    ;;@ core/execute.ts:92:19
    (i32.const 2)
   )
   (return
    (i32.const 1)
   )
  )
  (get_local $1)
 )
 (func $core/cycles/getCyclesPerCycleSet (; 285 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cycles.ts:23:16
  (get_global $core/cycles/Cycles.cyclesPerCycleSet)
 )
 (func $core/cycles/getCycleSets (; 286 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cycles.ts:27:16
  (get_global $core/cycles/Cycles.cycleSets)
 )
 (func $core/cycles/getCycles (; 287 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/cycles.ts:31:16
  (get_global $core/cycles/Cycles.cycles)
 )
 (func $core/joypad/joypad/_getJoypadButtonStateFromButtonId (; 288 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
 (func $core/joypad/joypad/_setJoypadButtonStateFromButtonId (; 289 ;) (; has Stack IR ;) (type $iiv) (param $0 i32) (param $1 i32)
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
 (func $core/interrupts/interrupts/requestJoypadInterrupt (; 290 ;) (; has Stack IR ;) (type $v)
  ;;@ core/interrupts/interrupts.ts:246:2
  (set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
   ;;@ core/interrupts/interrupts.ts:246:42
   (i32.const 1)
  )
  ;;@ core/interrupts/interrupts.ts:247:2
  (call $core/interrupts/interrupts/_requestInterrupt
   (i32.const 4)
  )
 )
 (func $core/joypad/joypad/_pressJoypadButton (; 291 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/joypad/joypad/_releaseJoypadButton (; 292 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  ;;@ core/joypad/joypad.ts:229:2
  (call $core/joypad/joypad/_setJoypadButtonStateFromButtonId
   (get_local $0)
   ;;@ core/joypad/joypad.ts:229:46
   (i32.const 0)
  )
 )
 (func $core/joypad/joypad/setJoypadState (; 293 ;) (; has Stack IR ;) (type $iiiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32)
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
 (func $core/debug/debug-cpu/getRegisterA (; 294 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:6:13
  (get_global $core/cpu/cpu/Cpu.registerA)
 )
 (func $core/debug/debug-cpu/getRegisterB (; 295 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:10:13
  (get_global $core/cpu/cpu/Cpu.registerB)
 )
 (func $core/debug/debug-cpu/getRegisterC (; 296 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:14:13
  (get_global $core/cpu/cpu/Cpu.registerC)
 )
 (func $core/debug/debug-cpu/getRegisterD (; 297 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:18:13
  (get_global $core/cpu/cpu/Cpu.registerD)
 )
 (func $core/debug/debug-cpu/getRegisterE (; 298 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:22:13
  (get_global $core/cpu/cpu/Cpu.registerE)
 )
 (func $core/debug/debug-cpu/getRegisterH (; 299 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:26:13
  (get_global $core/cpu/cpu/Cpu.registerH)
 )
 (func $core/debug/debug-cpu/getRegisterL (; 300 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:30:13
  (get_global $core/cpu/cpu/Cpu.registerL)
 )
 (func $core/debug/debug-cpu/getRegisterF (; 301 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:34:13
  (get_global $core/cpu/cpu/Cpu.registerF)
 )
 (func $core/debug/debug-cpu/getProgramCounter (; 302 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:38:13
  (get_global $core/cpu/cpu/Cpu.programCounter)
 )
 (func $core/debug/debug-cpu/getStackPointer (; 303 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:42:13
  (get_global $core/cpu/cpu/Cpu.stackPointer)
 )
 (func $core/debug/debug-cpu/getOpcodeAtProgramCounter (; 304 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-cpu.ts:46:56
  (call $core/memory/load/eightBitLoadFromGBMemory
   ;;@ core/debug/debug-cpu.ts:46:38
   (get_global $core/cpu/cpu/Cpu.programCounter)
  )
 )
 (func $core/debug/debug-graphics/getLY (; 305 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-graphics.ts:19:18
  (get_global $core/graphics/graphics/Graphics.scanlineRegister)
 )
 (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory (; 306 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
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
 (func $core/debug/debug-graphics/drawTileDataToWasmMemory (; 307 ;) (; has Stack IR ;) (type $v)
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
        ;;@ core/debug/debug-graphics.ts:213:8
        (drop
         (call $core/graphics/tiles/drawPixelsFromLineOfTile
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
          ;;@ core/debug/debug-graphics.ts:225:10
          (i32.const 0)
          ;;@ core/debug/debug-graphics.ts:226:10
          (i32.const -1)
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
 (func $core/debug/debug-timer/getDIV (; 308 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-timer.ts:5:16
  (get_global $core/timers/timers/Timers.dividerRegister)
 )
 (func $core/debug/debug-timer/getTIMA (; 309 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-timer.ts:9:16
  (get_global $core/timers/timers/Timers.timerCounter)
 )
 (func $core/debug/debug-timer/getTMA (; 310 ;) (; has Stack IR ;) (type $i) (result i32)
  ;;@ core/debug/debug-timer.ts:13:16
  (get_global $core/timers/timers/Timers.timerModulo)
 )
 (func $core/debug/debug-timer/getTAC (; 311 ;) (; has Stack IR ;) (type $i) (result i32)
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
 (func $core/debug/debug-memory/updateDebugGBMemory (; 312 ;) (; has Stack IR ;) (type $v)
  (local $0 i32)
  ;;@ core/debug/debug-memory.ts:7:2
  (block $break|0
   (loop $repeat|0
    (br_if $break|0
     ;;@ core/debug/debug-memory.ts:7:23
     (i32.gt_s
      (get_local $0)
      (i32.const 65535)
     )
    )
    ;;@ core/debug/debug-memory.ts:8:4
    (i32.store8
     ;;@ core/debug/debug-memory.ts:8:14
     (i32.add
      (get_local $0)
      (i32.const 9109504)
     )
     ;;@ core/debug/debug-memory.ts:8:49
     (call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
      (get_local $0)
     )
    )
    ;;@ core/debug/debug-memory.ts:7:55
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
 (func $start (; 313 ;) (; has Stack IR ;) (type $v)
  ;;@ core/core.ts:18:0
  (if
   ;;@ core/core.ts:18:4
   (i32.lt_s
    ;;@ core/core.ts:18:11
    (current_memory)
    (i32.const 140)
   )
   ;;@ core/core.ts:18:40
   (drop
    (grow_memory
     ;;@ core/core.ts:19:14
     (i32.sub
      (i32.const 140)
      ;;@ core/core.ts:19:42
      (current_memory)
     )
    )
   )
  )
 )
 (func $core/execute/executeFrameAndCheckAudio|trampoline (; 314 ;) (; has Stack IR ;) (type $ii) (param $0 i32) (result i32)
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
    ;;@ core/execute.ts:79:64
    (i32.const 0)
   )
  )
  (call $core/execute/executeFrameAndCheckAudio
   (get_local $0)
  )
 )
 (func $~setargc (; 315 ;) (; has Stack IR ;) (type $iv) (param $0 i32)
  (set_global $~argc
   (get_local $0)
  )
 )
 (func $core/execute/executeUntilCondition|trampoline (; 316 ;) (; has Stack IR ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (block $3of3
   (block $2of3
    (block $1of3
     (block $0of3
      (block $outOfRange
       (br_table $0of3 $1of3 $2of3 $3of3 $outOfRange
        (get_global $~argc)
       )
      )
      (unreachable)
     )
     (set_local $0
      ;;@ core/execute.ts:105:72
      (i32.const 1)
     )
    )
    (set_local $1
     ;;@ core/execute.ts:105:100
     (i32.const -1)
    )
   )
   (set_local $2
    ;;@ core/execute.ts:105:122
    (i32.const -1)
   )
  )
  (call $core/execute/executeUntilCondition
   (get_local $0)
   (get_local $1)
   (get_local $2)
  )
 )
)
