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
 (type $iiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32)))
 (type $iiiii (func (param i32 i32 i32 i32) (result i32)))
 (type $iiiiiiiiv (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $FUNCSIG$iiiiii (func (param i32 i32 i32 i32 i32) (result i32)))
 (type $FUNCSIG$iiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $FUNCSIG$v (func))
 (type $FUNCSIG$iii (func (param i32 i32) (result i32)))
 (memory $0 0)
 (table $0 1 anyfunc)
 (elem (i32.const 0) $null)
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
 (export "memory" (memory $0))
 (export "table" (table $0))
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
 (func $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset (; 0 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $case14|0
   block $case13|0
    block $case12|0
     block $case11|0
      block $case9|0
       block $case7|0
        block $case3|0
         get_local $0
         i32.const 12
         i32.shr_s
         tee_local $1
         i32.eqz
         br_if $case3|0
         block $tablify|0
          get_local $1
          i32.const 1
          i32.sub
          br_table $case3|0 $case3|0 $case3|0 $case7|0 $case7|0 $case7|0 $case7|0 $case9|0 $case9|0 $case11|0 $case11|0 $case12|0 $case13|0 $tablify|0
         end
         br $case14|0
        end
        get_local $0
        i32.const 850944
        i32.add
        return
       end
       get_local $0
       i32.const 1
       get_global $core/memory/memory/Memory.currentRomBank
       tee_local $0
       get_global $core/memory/memory/Memory.isMBC5
       i32.eqz
       tee_local $1
       if (result i32)
        get_local $0
        i32.eqz
       else        
        get_local $1
       end
       select
       i32.const 14
       i32.shl
       i32.add
       i32.const 834560
       i32.add
       return
      end
      get_local $0
      i32.const -30720
      i32.add
      get_global $core/cpu/cpu/Cpu.GBCEnabled
      if (result i32)
       get_global $core/memory/memory/Memory.memoryLocationGBCVRAMBank
       call $core/memory/load/eightBitLoadFromGBMemory
       i32.const 1
       i32.and
      else       
       i32.const 0
      end
      i32.const 13
      i32.shl
      i32.add
      return
     end
     get_local $0
     get_global $core/memory/memory/Memory.currentRamBank
     i32.const 13
     i32.shl
     i32.add
     i32.const 678912
     i32.add
     return
    end
    get_local $0
    i32.const -30720
    i32.add
    return
   end
   i32.const 0
   set_local $1
   block (result i32)
    get_global $core/cpu/cpu/Cpu.GBCEnabled
    if
     get_global $core/memory/memory/Memory.memoryLocationGBCWRAMBank
     call $core/memory/load/eightBitLoadFromGBMemory
     i32.const 7
     i32.and
     set_local $1
    end
    get_local $1
    i32.const 1
    i32.lt_s
   end
   if
    i32.const 1
    set_local $1
   end
   get_local $1
   i32.const 12
   i32.shl
   get_local $0
   i32.add
   i32.const -34816
   i32.add
   return
  end
  get_local $0
  i32.const -6144
  i32.add
 )
 (func $core/memory/load/eightBitLoadFromGBMemory (; 1 ;) (type $ii) (param $0 i32) (result i32)
  get_local $0
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
 )
 (func $core/cpu/cpu/initializeCpu (; 2 ;) (type $v)
  i32.const 0
  set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerA
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerB
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerC
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerD
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerE
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerH
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerL
  i32.const 0
  set_global $core/cpu/cpu/Cpu.registerF
  i32.const 0
  set_global $core/cpu/cpu/Cpu.stackPointer
  i32.const 0
  set_global $core/cpu/cpu/Cpu.programCounter
  i32.const 0
  set_global $core/cpu/cpu/Cpu.currentCycles
  i32.const 0
  set_global $core/cpu/cpu/Cpu.isHaltNormal
  i32.const 0
  set_global $core/cpu/cpu/Cpu.isHaltNoJump
  i32.const 0
  set_global $core/cpu/cpu/Cpu.isHaltBug
  i32.const 0
  set_global $core/cpu/cpu/Cpu.isStopped
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 17
   set_global $core/cpu/cpu/Cpu.registerA
   i32.const 128
   set_global $core/cpu/cpu/Cpu.registerF
   i32.const 0
   set_global $core/cpu/cpu/Cpu.registerB
   i32.const 0
   set_global $core/cpu/cpu/Cpu.registerC
   i32.const 255
   set_global $core/cpu/cpu/Cpu.registerD
   i32.const 86
   set_global $core/cpu/cpu/Cpu.registerE
   i32.const 0
   set_global $core/cpu/cpu/Cpu.registerH
   i32.const 13
   set_global $core/cpu/cpu/Cpu.registerL
  else   
   i32.const 1
   set_global $core/cpu/cpu/Cpu.registerA
   i32.const 176
   set_global $core/cpu/cpu/Cpu.registerF
   i32.const 0
   set_global $core/cpu/cpu/Cpu.registerB
   i32.const 19
   set_global $core/cpu/cpu/Cpu.registerC
   i32.const 0
   set_global $core/cpu/cpu/Cpu.registerD
   i32.const 216
   set_global $core/cpu/cpu/Cpu.registerE
   i32.const 1
   set_global $core/cpu/cpu/Cpu.registerH
   i32.const 77
   set_global $core/cpu/cpu/Cpu.registerL
  end
  i32.const 256
  set_global $core/cpu/cpu/Cpu.programCounter
  i32.const 65534
  set_global $core/cpu/cpu/Cpu.stackPointer
 )
 (func $core/memory/memory/initializeCartridge (; 3 ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  i32.const 0
  set_global $core/memory/memory/Memory.isRamBankingEnabled
  i32.const 1
  set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
  i32.const 327
  call $core/memory/load/eightBitLoadFromGBMemory
  set_local $1
  i32.const 0
  set_global $core/memory/memory/Memory.isRomOnly
  i32.const 0
  set_global $core/memory/memory/Memory.isMBC1
  i32.const 0
  set_global $core/memory/memory/Memory.isMBC2
  i32.const 0
  set_global $core/memory/memory/Memory.isMBC3
  i32.const 0
  set_global $core/memory/memory/Memory.isMBC5
  get_local $1
  if
   get_local $1
   i32.const 1
   i32.ge_s
   tee_local $0
   if
    get_local $1
    i32.const 3
    i32.le_s
    set_local $0
   end
   get_local $0
   if
    i32.const 1
    set_global $core/memory/memory/Memory.isMBC1
   else    
    get_local $1
    i32.const 5
    i32.ge_s
    tee_local $0
    if
     get_local $1
     i32.const 6
     i32.le_s
     set_local $0
    end
    get_local $0
    if
     i32.const 1
     set_global $core/memory/memory/Memory.isMBC2
    else     
     get_local $1
     i32.const 15
     i32.ge_s
     tee_local $0
     if
      get_local $1
      i32.const 19
      i32.le_s
      set_local $0
     end
     get_local $0
     if
      i32.const 1
      set_global $core/memory/memory/Memory.isMBC3
     else      
      get_local $1
      i32.const 25
      i32.ge_s
      tee_local $0
      if
       get_local $1
       i32.const 30
       i32.le_s
       set_local $0
      end
      get_local $0
      if
       i32.const 1
       set_global $core/memory/memory/Memory.isMBC5
      end
     end
    end
   end
  else   
   i32.const 1
   set_global $core/memory/memory/Memory.isRomOnly
  end
  i32.const 1
  set_global $core/memory/memory/Memory.currentRomBank
  i32.const 0
  set_global $core/memory/memory/Memory.currentRamBank
 )
 (func $core/memory/store/eightBitStoreIntoGBMemory (; 4 ;) (type $iiv) (param $0 i32) (param $1 i32)
  get_local $0
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  get_local $1
  i32.store8
 )
 (func $core/memory/dma/initializeDma (; 5 ;) (type $v)
  i32.const 65361
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65362
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65363
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65364
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65365
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/graphics/graphics/initializeGraphics (; 6 ;) (type $v)
  i32.const 0
  set_global $core/graphics/graphics/Graphics.currentCycles
  i32.const 0
  set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.const 0
  set_global $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 0
  set_global $core/graphics/graphics/Graphics.scrollX
  i32.const 0
  set_global $core/graphics/graphics/Graphics.scrollY
  i32.const 0
  set_global $core/graphics/graphics/Graphics.windowX
  i32.const 0
  set_global $core/graphics/graphics/Graphics.windowY
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 144
   set_global $core/graphics/graphics/Graphics.scanlineRegister
   i32.const 65344
   i32.const 145
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65345
   i32.const 129
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65348
   i32.const 144
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65351
   i32.const 252
   call $core/memory/store/eightBitStoreIntoGBMemory
  else   
   i32.const 144
   set_global $core/graphics/graphics/Graphics.scanlineRegister
   i32.const 65344
   i32.const 145
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65345
   i32.const 133
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65350
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65351
   i32.const 252
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65352
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65353
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
  i32.const 65359
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65392
  i32.const 1
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/graphics/palette/initializePalette (; 7 ;) (type $v)
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65384
   i32.const 192
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65385
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65386
   i32.const 193
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65387
   i32.const 13
   call $core/memory/store/eightBitStoreIntoGBMemory
  else   
   i32.const 65384
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65385
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65386
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65387
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/sound/channel1/Channel1.initialize (; 8 ;) (type $v)
  i32.const 65296
  i32.const 128
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65297
  i32.const 191
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65298
  i32.const 243
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65299
  i32.const 193
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65300
  i32.const 191
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/sound/channel2/Channel2.initialize (; 9 ;) (type $v)
  i32.const 65301
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65302
  i32.const 63
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65303
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65304
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65305
  i32.const 184
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/sound/channel3/Channel3.initialize (; 10 ;) (type $v)
  i32.const 65306
  i32.const 127
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65307
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65308
  i32.const 159
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65309
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65310
  i32.const 184
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 1
  set_global $core/sound/channel3/Channel3.volumeCodeChanged
 )
 (func $core/sound/channel4/Channel4.initialize (; 11 ;) (type $v)
  i32.const 65311
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65312
  i32.const 255
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65313
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65314
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65315
  i32.const 191
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/sound/accumulator/initializeSoundAccumulator (; 12 ;) (type $v)
  i32.const 15
  set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
  i32.const 15
  set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
  i32.const 15
  set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
  i32.const 15
  set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
  i32.const 127
  set_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
  i32.const 127
  set_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
  i32.const 1
  set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
  i32.const 1
  set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
 )
 (func $core/sound/sound/initializeSound (; 13 ;) (type $v)
  i32.const 0
  set_global $core/sound/sound/Sound.currentCycles
  i32.const 0
  set_global $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.const 0
  set_global $core/sound/sound/Sound.NR50RightMixerVolume
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  i32.const 1
  set_global $core/sound/sound/Sound.NR52IsSoundEnabled
  i32.const 0
  set_global $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.const 0
  set_global $core/sound/sound/Sound.downSampleCycleCounter
  i32.const 0
  set_global $core/sound/sound/Sound.frameSequencer
  i32.const 0
  set_global $core/sound/sound/Sound.audioQueueIndex
  call $core/sound/channel1/Channel1.initialize
  call $core/sound/channel2/Channel2.initialize
  call $core/sound/channel3/Channel3.initialize
  call $core/sound/channel4/Channel4.initialize
  i32.const 65316
  i32.const 119
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65317
  i32.const 243
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65318
  i32.const 241
  call $core/memory/store/eightBitStoreIntoGBMemory
  call $core/sound/accumulator/initializeSoundAccumulator
 )
 (func $core/interrupts/interrupts/Interrupts.updateInterruptEnabled (; 14 ;) (type $iv) (param $0 i32)
  get_local $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
  get_local $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
  get_local $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
  get_local $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
  get_local $0
  set_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
 )
 (func $core/interrupts/interrupts/Interrupts.updateInterruptRequested (; 15 ;) (type $iv) (param $0 i32)
  get_local $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
  get_local $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
  get_local $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
  get_local $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
  get_local $0
  set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
 )
 (func $core/timers/timers/initializeTimers (; 16 ;) (type $v)
  i32.const 0
  set_global $core/timers/timers/Timers.currentCycles
  i32.const 0
  set_global $core/timers/timers/Timers.dividerRegister
  i32.const 0
  set_global $core/timers/timers/Timers.timerCounter
  i32.const 0
  set_global $core/timers/timers/Timers.timerModulo
  i32.const 0
  set_global $core/timers/timers/Timers.timerEnabled
  i32.const 0
  set_global $core/timers/timers/Timers.timerInputClock
  i32.const 0
  set_global $core/timers/timers/Timers.timerCounterOverflowDelay
  i32.const 0
  set_global $core/timers/timers/Timers.timerCounterWasReset
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65284
   i32.const 30
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 7840
   set_global $core/timers/timers/Timers.dividerRegister
  else   
   i32.const 65284
   i32.const 171
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 43980
   set_global $core/timers/timers/Timers.dividerRegister
  end
  i32.const 65287
  i32.const 248
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 248
  set_global $core/timers/timers/Timers.timerInputClock
 )
 (func $core/serial/serial/initializeSerial (; 17 ;) (type $v)
  i32.const 0
  set_global $core/serial/serial/Serial.currentCycles
  i32.const 0
  set_global $core/serial/serial/Serial.numberOfBitsTransferred
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65282
   i32.const 124
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 0
   set_global $core/serial/serial/Serial.isShiftClockInternal
   i32.const 0
   set_global $core/serial/serial/Serial.isClockSpeedFast
   i32.const 0
   set_global $core/serial/serial/Serial.transferStartFlag
  else   
   i32.const 65282
   i32.const 126
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 0
   set_global $core/serial/serial/Serial.isShiftClockInternal
   i32.const 1
   set_global $core/serial/serial/Serial.isClockSpeedFast
   i32.const 0
   set_global $core/serial/serial/Serial.transferStartFlag
  end
 )
 (func $core/core/initialize (; 18 ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  i32.const 323
  call $core/memory/load/eightBitLoadFromGBMemory
  tee_local $1
  i32.const 192
  i32.eq
  tee_local $0
  if (result i32)
   get_local $0
  else   
   get_local $1
   i32.const 128
   i32.eq
   get_global $core/config/Config.useGbcWhenAvailable
   tee_local $0
   get_local $0
   select
  end
  if
   i32.const 1
   set_global $core/cpu/cpu/Cpu.GBCEnabled
  else   
   i32.const 0
   set_global $core/cpu/cpu/Cpu.GBCEnabled
  end
  call $core/cpu/cpu/initializeCpu
  call $core/memory/memory/initializeCartridge
  call $core/memory/dma/initializeDma
  call $core/graphics/graphics/initializeGraphics
  call $core/graphics/palette/initializePalette
  call $core/sound/sound/initializeSound
  i32.const 0
  call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
  i32.const 65535
  get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 225
  call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
  i32.const 65295
  get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  call $core/memory/store/eightBitStoreIntoGBMemory
  call $core/timers/timers/initializeTimers
  call $core/serial/serial/initializeSerial
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65392
   i32.const 248
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65359
   i32.const 254
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65357
   i32.const 126
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65280
   i32.const 207
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65295
   i32.const 225
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65388
   i32.const 254
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65397
   i32.const 143
   call $core/memory/store/eightBitStoreIntoGBMemory
  else   
   i32.const 65392
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65359
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65357
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65280
   i32.const 207
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65295
   i32.const 225
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
  i32.const 0
  set_global $core/core/hasStarted
  i32.const 2000000000
  set_global $core/cycles/Cycles.cyclesPerCycleSet
  i32.const 0
  set_global $core/cycles/Cycles.cycleSets
  i32.const 0
  set_global $core/cycles/Cycles.cycles
  i32.const 2000000000
  set_global $core/execute/Execute.stepsPerStepSet
  i32.const 0
  set_global $core/execute/Execute.stepSets
  i32.const 0
  set_global $core/execute/Execute.steps
 )
 (func $core/core/config (; 19 ;) (type $iiiiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32)
  get_local $0
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.enableBootRom
  else   
   i32.const 0
   set_global $core/config/Config.enableBootRom
  end
  get_local $1
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.useGbcWhenAvailable
  else   
   i32.const 0
   set_global $core/config/Config.useGbcWhenAvailable
  end
  get_local $2
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.audioBatchProcessing
  else   
   i32.const 0
   set_global $core/config/Config.audioBatchProcessing
  end
  get_local $3
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.graphicsBatchProcessing
  else   
   i32.const 0
   set_global $core/config/Config.graphicsBatchProcessing
  end
  get_local $4
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.timersBatchProcessing
  else   
   i32.const 0
   set_global $core/config/Config.timersBatchProcessing
  end
  get_local $5
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.graphicsDisableScanlineRendering
  else   
   i32.const 0
   set_global $core/config/Config.graphicsDisableScanlineRendering
  end
  get_local $6
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.audioAccumulateSamples
  else   
   i32.const 0
   set_global $core/config/Config.audioAccumulateSamples
  end
  get_local $7
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.tileRendering
  else   
   i32.const 0
   set_global $core/config/Config.tileRendering
  end
  get_local $8
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   set_global $core/config/Config.tileCaching
  else   
   i32.const 0
   set_global $core/config/Config.tileCaching
  end
  call $core/core/initialize
 )
 (func $core/core/hasCoreStarted (; 20 ;) (type $i) (result i32)
  get_global $core/core/hasStarted
  if
   i32.const 1
   return
  end
  i32.const 0
 )
 (func $core/cpu/cpu/Cpu.saveState (; 21 ;) (type $v)
  i32.const 1024
  get_global $core/cpu/cpu/Cpu.registerA
  i32.store8
  i32.const 1025
  get_global $core/cpu/cpu/Cpu.registerB
  i32.store8
  i32.const 1026
  get_global $core/cpu/cpu/Cpu.registerC
  i32.store8
  i32.const 1027
  get_global $core/cpu/cpu/Cpu.registerD
  i32.store8
  i32.const 1028
  get_global $core/cpu/cpu/Cpu.registerE
  i32.store8
  i32.const 1029
  get_global $core/cpu/cpu/Cpu.registerH
  i32.store8
  i32.const 1030
  get_global $core/cpu/cpu/Cpu.registerL
  i32.store8
  i32.const 1031
  get_global $core/cpu/cpu/Cpu.registerF
  i32.store8
  i32.const 1032
  get_global $core/cpu/cpu/Cpu.stackPointer
  i32.store16
  i32.const 1034
  get_global $core/cpu/cpu/Cpu.programCounter
  i32.store16
  i32.const 1036
  get_global $core/cpu/cpu/Cpu.currentCycles
  i32.store
  get_global $core/cpu/cpu/Cpu.isHaltNormal
  if
   i32.const 1041
   i32.const 1
   i32.store8
  else   
   i32.const 1041
   i32.const 0
   i32.store8
  end
  get_global $core/cpu/cpu/Cpu.isHaltNoJump
  if
   i32.const 1042
   i32.const 1
   i32.store8
  else   
   i32.const 1042
   i32.const 0
   i32.store8
  end
  get_global $core/cpu/cpu/Cpu.isHaltBug
  if
   i32.const 1043
   i32.const 1
   i32.store8
  else   
   i32.const 1043
   i32.const 0
   i32.store8
  end
  get_global $core/cpu/cpu/Cpu.isStopped
  if
   i32.const 1044
   i32.const 1
   i32.store8
  else   
   i32.const 1044
   i32.const 0
   i32.store8
  end
 )
 (func $core/memory/memory/Memory.saveState (; 22 ;) (type $v)
  i32.const 1224
  get_global $core/memory/memory/Memory.currentRomBank
  i32.store16
  i32.const 1226
  get_global $core/memory/memory/Memory.currentRamBank
  i32.store16
  get_global $core/memory/memory/Memory.isRamBankingEnabled
  if
   i32.const 1228
   i32.const 1
   i32.store8
  else   
   i32.const 1228
   i32.const 0
   i32.store8
  end
  get_global $core/memory/memory/Memory.isMBC1RomModeEnabled
  if
   i32.const 1229
   i32.const 1
   i32.store8
  else   
   i32.const 1229
   i32.const 0
   i32.store8
  end
  get_global $core/memory/memory/Memory.isRomOnly
  if
   i32.const 1230
   i32.const 1
   i32.store8
  else   
   i32.const 1230
   i32.const 0
   i32.store8
  end
  get_global $core/memory/memory/Memory.isMBC1
  if
   i32.const 1231
   i32.const 1
   i32.store8
  else   
   i32.const 1231
   i32.const 0
   i32.store8
  end
  get_global $core/memory/memory/Memory.isMBC2
  if
   i32.const 1232
   i32.const 1
   i32.store8
  else   
   i32.const 1232
   i32.const 0
   i32.store8
  end
  get_global $core/memory/memory/Memory.isMBC3
  if
   i32.const 1233
   i32.const 1
   i32.store8
  else   
   i32.const 1233
   i32.const 0
   i32.store8
  end
  get_global $core/memory/memory/Memory.isMBC5
  if
   i32.const 1234
   i32.const 1
   i32.store8
  else   
   i32.const 1234
   i32.const 0
   i32.store8
  end
 )
 (func $core/timers/timers/Timers.saveState (; 23 ;) (type $v)
  i32.const 1274
  get_global $core/timers/timers/Timers.currentCycles
  i32.store
  i32.const 1278
  get_global $core/timers/timers/Timers.dividerRegister
  i32.store
  get_global $core/timers/timers/Timers.timerCounterOverflowDelay
  if
   i32.const 1282
   i32.const 1
   i32.store8
  else   
   i32.const 1282
   i32.const 0
   i32.store8
  end
  get_global $core/timers/timers/Timers.timerCounterWasReset
  if
   i32.const 1285
   i32.const 1
   i32.store8
  else   
   i32.const 1285
   i32.const 0
   i32.store8
  end
  i32.const 65285
  get_global $core/timers/timers/Timers.timerCounter
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/sound/channel1/Channel1.saveState (; 24 ;) (type $v)
  get_global $core/sound/channel1/Channel1.isEnabled
  if
   i32.const 1374
   i32.const 1
   i32.store8
  else   
   i32.const 1374
   i32.const 0
   i32.store8
  end
  i32.const 1375
  get_global $core/sound/channel1/Channel1.frequencyTimer
  i32.store
  i32.const 1379
  get_global $core/sound/channel1/Channel1.envelopeCounter
  i32.store
  i32.const 1383
  get_global $core/sound/channel1/Channel1.lengthCounter
  i32.store
  i32.const 1388
  get_global $core/sound/channel1/Channel1.volume
  i32.store
  i32.const 1393
  get_global $core/sound/channel1/Channel1.dutyCycle
  i32.store8
  i32.const 1394
  get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
  i32.store8
  get_global $core/sound/channel1/Channel1.isSweepEnabled
  if
   i32.const 1399
   i32.const 1
   i32.store8
  else   
   i32.const 1399
   i32.const 0
   i32.store8
  end
  i32.const 1400
  get_global $core/sound/channel1/Channel1.sweepCounter
  i32.store
  i32.const 1405
  get_global $core/sound/channel1/Channel1.sweepShadowFrequency
  i32.store16
 )
 (func $core/sound/channel2/Channel2.saveState (; 25 ;) (type $v)
  get_global $core/sound/channel2/Channel2.isEnabled
  if
   i32.const 1424
   i32.const 1
   i32.store8
  else   
   i32.const 1424
   i32.const 0
   i32.store8
  end
  i32.const 1425
  get_global $core/sound/channel2/Channel2.frequencyTimer
  i32.store
  i32.const 1429
  get_global $core/sound/channel2/Channel2.envelopeCounter
  i32.store
  i32.const 1433
  get_global $core/sound/channel2/Channel2.lengthCounter
  i32.store
  i32.const 1438
  get_global $core/sound/channel2/Channel2.volume
  i32.store
  i32.const 1443
  get_global $core/sound/channel2/Channel2.dutyCycle
  i32.store8
  i32.const 1444
  get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
  i32.store8
 )
 (func $core/sound/channel4/Channel4.saveState (; 26 ;) (type $v)
  get_global $core/sound/channel4/Channel4.isEnabled
  if
   i32.const 1524
   i32.const 1
   i32.store8
  else   
   i32.const 1524
   i32.const 0
   i32.store8
  end
  i32.const 1525
  get_global $core/sound/channel4/Channel4.frequencyTimer
  i32.store
  i32.const 1529
  get_global $core/sound/channel4/Channel4.envelopeCounter
  i32.store
  i32.const 1533
  get_global $core/sound/channel4/Channel4.lengthCounter
  i32.store
  i32.const 1538
  get_global $core/sound/channel4/Channel4.volume
  i32.store
  i32.const 1543
  get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  i32.store16
 )
 (func $core/core/saveState (; 27 ;) (type $v)
  call $core/cpu/cpu/Cpu.saveState
  i32.const 1074
  get_global $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.store
  i32.const 1078
  get_global $core/graphics/lcd/Lcd.currentLcdMode
  i32.store8
  i32.const 65348
  get_global $core/graphics/graphics/Graphics.scanlineRegister
  call $core/memory/store/eightBitStoreIntoGBMemory
  get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  if
   i32.const 1124
   i32.const 1
   i32.store8
  else   
   i32.const 1124
   i32.const 0
   i32.store8
  end
  get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  if
   i32.const 1125
   i32.const 1
   i32.store8
  else   
   i32.const 1125
   i32.const 0
   i32.store8
  end
  call $core/memory/memory/Memory.saveState
  call $core/timers/timers/Timers.saveState
  i32.const 1324
  get_global $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.store
  i32.const 1328
  get_global $core/sound/sound/Sound.downSampleCycleCounter
  i32.store8
  i32.const 1329
  get_global $core/sound/sound/Sound.frameSequencer
  i32.store8
  call $core/sound/channel1/Channel1.saveState
  call $core/sound/channel2/Channel2.saveState
  get_global $core/sound/channel3/Channel3.isEnabled
  if
   i32.const 1474
   i32.const 1
   i32.store8
  else   
   i32.const 1474
   i32.const 0
   i32.store8
  end
  i32.const 1475
  get_global $core/sound/channel3/Channel3.frequencyTimer
  i32.store
  i32.const 1479
  get_global $core/sound/channel3/Channel3.lengthCounter
  i32.store
  i32.const 1483
  get_global $core/sound/channel3/Channel3.waveTablePosition
  i32.store16
  call $core/sound/channel4/Channel4.saveState
  i32.const 0
  set_global $core/core/hasStarted
 )
 (func $core/cpu/cpu/Cpu.loadState (; 28 ;) (type $v)
  i32.const 1024
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerA
  i32.const 1025
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerB
  i32.const 1026
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerC
  i32.const 1027
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerD
  i32.const 1028
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerE
  i32.const 1029
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerH
  i32.const 1030
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerL
  i32.const 1031
  i32.load8_u
  set_global $core/cpu/cpu/Cpu.registerF
  i32.const 1032
  i32.load16_u
  set_global $core/cpu/cpu/Cpu.stackPointer
  i32.const 1034
  i32.load16_u
  set_global $core/cpu/cpu/Cpu.programCounter
  i32.const 1036
  i32.load
  set_global $core/cpu/cpu/Cpu.currentCycles
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1041
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/cpu/cpu/Cpu.isHaltNormal
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory11 (result i32)
   i32.const 1
   i32.const 1042
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory11
   drop
   i32.const 0
  end
  set_global $core/cpu/cpu/Cpu.isHaltNoJump
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory13 (result i32)
   i32.const 1
   i32.const 1043
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory13
   drop
   i32.const 0
  end
  set_global $core/cpu/cpu/Cpu.isHaltBug
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory15 (result i32)
   i32.const 1
   i32.const 1044
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory15
   drop
   i32.const 0
  end
  set_global $core/cpu/cpu/Cpu.isStopped
 )
 (func $core/graphics/lcd/resetLcd (; 29 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  i32.const 0
  set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.const 0
  set_global $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 65348
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65345
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const -4
  i32.and
  set_local $1
  i32.const 0
  set_global $core/graphics/lcd/Lcd.currentLcdMode
  i32.const 65345
  get_local $1
  call $core/memory/store/eightBitStoreIntoGBMemory
  get_local $0
  if
   block $break|0
    i32.const 0
    set_local $0
    loop $repeat|0
     get_local $0
     i32.const 521216
     i32.ge_s
     br_if $break|0
     get_local $0
     i32.const 67584
     i32.add
     i32.const 255
     i32.store8
     get_local $0
     i32.const 1
     i32.add
     set_local $0
     br $repeat|0
     unreachable
    end
    unreachable
   end
  end
 )
 (func $core/graphics/lcd/Lcd.updateLcdControl (; 30 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_global $core/graphics/lcd/Lcd.enabled
  set_local $1
  get_local $0
  i32.const 128
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.enabled
  get_local $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
  get_local $0
  i32.const 32
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.windowDisplayEnabled
  get_local $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
  get_local $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.tallSpriteSize
  get_local $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.spriteDisplayEnable
  get_local $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  set_global $core/graphics/lcd/Lcd.bgDisplayEnabled
  get_global $core/graphics/lcd/Lcd.enabled
  i32.eqz
  get_local $1
  get_local $1
  select
  if
   i32.const 1
   call $core/graphics/lcd/resetLcd
  end
  get_local $1
  i32.eqz
  tee_local $0
  if (result i32)
   get_global $core/graphics/lcd/Lcd.enabled
  else   
   get_local $0
  end
  if
   i32.const 0
   call $core/graphics/lcd/resetLcd
  end
 )
 (func $core/interrupts/interrupts/Interrupts.loadState (; 31 ;) (type $v)
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1124
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory0 (result i32)
   i32.const 1
   i32.const 1125
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory0
   drop
   i32.const 0
  end
  set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  i32.const 65535
  call $core/memory/load/eightBitLoadFromGBMemory
  call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
  i32.const 65295
  call $core/memory/load/eightBitLoadFromGBMemory
  call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
 )
 (func $core/memory/memory/Memory.loadState (; 32 ;) (type $v)
  i32.const 1224
  i32.load16_u
  set_global $core/memory/memory/Memory.currentRomBank
  i32.const 1226
  i32.load16_u
  set_global $core/memory/memory/Memory.currentRamBank
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1228
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/memory/memory/Memory.isRamBankingEnabled
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory2 (result i32)
   i32.const 1
   i32.const 1229
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory2
   drop
   i32.const 0
  end
  set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory4 (result i32)
   i32.const 1
   i32.const 1230
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory4
   drop
   i32.const 0
  end
  set_global $core/memory/memory/Memory.isRomOnly
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory6 (result i32)
   i32.const 1
   i32.const 1231
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory6
   drop
   i32.const 0
  end
  set_global $core/memory/memory/Memory.isMBC1
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory8 (result i32)
   i32.const 1
   i32.const 1232
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory8
   drop
   i32.const 0
  end
  set_global $core/memory/memory/Memory.isMBC2
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory10 (result i32)
   i32.const 1
   i32.const 1233
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory10
   drop
   i32.const 0
  end
  set_global $core/memory/memory/Memory.isMBC3
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory12 (result i32)
   i32.const 1
   i32.const 1234
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory12
   drop
   i32.const 0
  end
  set_global $core/memory/memory/Memory.isMBC5
 )
 (func $core/timers/timers/Timers.loadState (; 33 ;) (type $v)
  i32.const 1274
  i32.load
  set_global $core/timers/timers/Timers.currentCycles
  i32.const 1278
  i32.load
  set_global $core/timers/timers/Timers.dividerRegister
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1282
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/timers/timers/Timers.timerCounterOverflowDelay
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory2 (result i32)
   i32.const 1
   i32.const 1285
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory2
   drop
   i32.const 0
  end
  set_global $core/timers/timers/Timers.timerCounterWasReset
  i32.const 65285
  call $core/memory/load/eightBitLoadFromGBMemory
  set_global $core/timers/timers/Timers.timerCounter
  i32.const 65286
  call $core/memory/load/eightBitLoadFromGBMemory
  set_global $core/timers/timers/Timers.timerModulo
  i32.const 65287
  call $core/memory/load/eightBitLoadFromGBMemory
  set_global $core/timers/timers/Timers.timerInputClock
 )
 (func $core/sound/sound/clearAudioBuffer (; 34 ;) (type $v)
  i32.const 0
  set_global $core/sound/sound/Sound.audioQueueIndex
 )
 (func $core/sound/channel1/Channel1.loadState (; 35 ;) (type $v)
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1374
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/sound/channel1/Channel1.isEnabled
  i32.const 1375
  i32.load
  set_global $core/sound/channel1/Channel1.frequencyTimer
  i32.const 1379
  i32.load
  set_global $core/sound/channel1/Channel1.envelopeCounter
  i32.const 1383
  i32.load
  set_global $core/sound/channel1/Channel1.lengthCounter
  i32.const 1388
  i32.load
  set_global $core/sound/channel1/Channel1.volume
  i32.const 1393
  i32.load8_u
  set_global $core/sound/channel1/Channel1.dutyCycle
  i32.const 1394
  i32.load8_u
  set_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory6 (result i32)
   i32.const 1
   i32.const 1399
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory6
   drop
   i32.const 0
  end
  set_global $core/sound/channel1/Channel1.isSweepEnabled
  i32.const 1400
  i32.load
  set_global $core/sound/channel1/Channel1.sweepCounter
  i32.const 1405
  i32.load16_u
  set_global $core/sound/channel1/Channel1.sweepShadowFrequency
 )
 (func $core/sound/channel2/Channel2.loadState (; 36 ;) (type $v)
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1424
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/sound/channel2/Channel2.isEnabled
  i32.const 1425
  i32.load
  set_global $core/sound/channel2/Channel2.frequencyTimer
  i32.const 1429
  i32.load
  set_global $core/sound/channel2/Channel2.envelopeCounter
  i32.const 1433
  i32.load
  set_global $core/sound/channel2/Channel2.lengthCounter
  i32.const 1438
  i32.load
  set_global $core/sound/channel2/Channel2.volume
  i32.const 1443
  i32.load8_u
  set_global $core/sound/channel2/Channel2.dutyCycle
  i32.const 1444
  i32.load8_u
  set_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
 )
 (func $core/sound/channel4/Channel4.loadState (; 37 ;) (type $v)
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1524
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/sound/channel4/Channel4.isEnabled
  i32.const 1525
  i32.load
  set_global $core/sound/channel4/Channel4.frequencyTimer
  i32.const 1529
  i32.load
  set_global $core/sound/channel4/Channel4.envelopeCounter
  i32.const 1533
  i32.load
  set_global $core/sound/channel4/Channel4.lengthCounter
  i32.const 1538
  i32.load
  set_global $core/sound/channel4/Channel4.volume
  i32.const 1543
  i32.load16_u
  set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
 )
 (func $core/core/loadState (; 38 ;) (type $v)
  (local $0 i32)
  call $core/cpu/cpu/Cpu.loadState
  i32.const 1074
  i32.load
  set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.const 1078
  i32.load8_u
  set_global $core/graphics/lcd/Lcd.currentLcdMode
  i32.const 65348
  call $core/memory/load/eightBitLoadFromGBMemory
  set_global $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 65344
  call $core/memory/load/eightBitLoadFromGBMemory
  call $core/graphics/lcd/Lcd.updateLcdControl
  call $core/interrupts/interrupts/Interrupts.loadState
  i32.const 65280
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 255
  i32.xor
  set_global $core/joypad/joypad/Joypad.joypadRegisterFlipped
  get_global $core/joypad/joypad/Joypad.joypadRegisterFlipped
  tee_local $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  set_global $core/joypad/joypad/Joypad.isDpadType
  get_local $0
  i32.const 32
  i32.and
  i32.const 0
  i32.ne
  set_global $core/joypad/joypad/Joypad.isButtonType
  call $core/memory/memory/Memory.loadState
  call $core/timers/timers/Timers.loadState
  i32.const 1324
  i32.load
  set_global $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.const 1328
  i32.load8_u
  set_global $core/sound/sound/Sound.downSampleCycleCounter
  i32.const 1329
  i32.load8_u
  set_global $core/sound/sound/Sound.frameSequencer
  i32.const 0
  set_global $core/sound/sound/Sound.audioQueueIndex
  call $core/sound/channel1/Channel1.loadState
  call $core/sound/channel2/Channel2.loadState
  block $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory (result i32)
   i32.const 1
   i32.const 1474
   i32.load8_u
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/memory/load/loadBooleanDirectlyFromWasmMemory
   drop
   i32.const 0
  end
  set_global $core/sound/channel3/Channel3.isEnabled
  i32.const 1475
  i32.load
  set_global $core/sound/channel3/Channel3.frequencyTimer
  i32.const 1479
  i32.load
  set_global $core/sound/channel3/Channel3.lengthCounter
  i32.const 1483
  i32.load16_u
  set_global $core/sound/channel3/Channel3.waveTablePosition
  call $core/sound/channel4/Channel4.loadState
  i32.const 0
  set_global $core/core/hasStarted
  i32.const 2000000000
  set_global $core/cycles/Cycles.cyclesPerCycleSet
  i32.const 0
  set_global $core/cycles/Cycles.cycleSets
  i32.const 0
  set_global $core/cycles/Cycles.cycles
  i32.const 2000000000
  set_global $core/execute/Execute.stepsPerStepSet
  i32.const 0
  set_global $core/execute/Execute.stepSets
  i32.const 0
  set_global $core/execute/Execute.steps
 )
 (func $core/execute/getStepsPerStepSet (; 39 ;) (type $i) (result i32)
  get_global $core/execute/Execute.stepsPerStepSet
 )
 (func $core/execute/getStepSets (; 40 ;) (type $i) (result i32)
  get_global $core/execute/Execute.stepSets
 )
 (func $core/execute/getSteps (; 41 ;) (type $i) (result i32)
  get_global $core/execute/Execute.steps
 )
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileCache (; 42 ;) (type $FUNCSIG$iiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (result i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  block (result i32)
   block (result i32)
    get_local $1
    i32.const 0
    i32.gt_s
    tee_local $5
    if
     get_local $0
     i32.const 8
     i32.gt_s
     set_local $5
    end
    get_local $5
   end
   if
    get_global $core/graphics/tiles/TileCache.tileId
    get_local $4
    i32.eq
    set_local $5
   end
   get_local $5
  end
  if (result i32)
   get_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
   get_local $0
   i32.eq
  else   
   get_local $5
  end
  if
   i32.const 0
   set_local $5
   i32.const 0
   set_local $4
   get_local $3
   i32.const 1
   i32.sub
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 32
   i32.and
   if
    i32.const 1
    set_local $5
   end
   get_local $3
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 32
   i32.and
   if
    i32.const 1
    set_local $4
   end
   i32.const 0
   set_local $3
   loop $repeat|0
    get_local $3
    i32.const 8
    i32.lt_s
    if
     i32.const 7
     get_local $3
     i32.sub
     get_local $3
     get_local $4
     get_local $5
     i32.ne
     select
     tee_local $3
     get_local $0
     i32.add
     i32.const 160
     i32.le_s
     if
      get_local $0
      i32.const 8
      get_local $3
      i32.sub
      i32.sub
      set_local $7
      get_local $0
      get_local $3
      i32.add
      get_local $1
      i32.const 160
      i32.mul
      i32.add
      i32.const 3
      i32.mul
      i32.const 93184
      i32.add
      set_local $9
      i32.const 0
      set_local $6
      loop $repeat|1
       get_local $6
       i32.const 3
       i32.lt_s
       if
        get_local $0
        get_local $3
        i32.add
        get_local $1
        i32.const 160
        i32.mul
        i32.add
        i32.const 3
        i32.mul
        i32.const 93184
        i32.add
        get_local $6
        i32.add
        get_local $6
        get_local $9
        i32.add
        i32.load8_u
        i32.store8
        get_local $6
        i32.const 1
        i32.add
        set_local $6
        br $repeat|1
       end
      end
      get_local $0
      get_local $3
      i32.add
      get_local $1
      i32.const 160
      i32.mul
      i32.add
      i32.const 69632
      i32.add
      get_local $1
      i32.const 160
      i32.mul
      get_local $7
      i32.add
      i32.const 69632
      i32.add
      i32.load8_u
      tee_local $6
      i32.const 3
      i32.and
      tee_local $7
      i32.const 4
      i32.or
      get_local $7
      get_local $6
      i32.const 4
      i32.and
      select
      i32.store8
      get_local $8
      i32.const 1
      i32.add
      set_local $8
     end
     get_local $3
     i32.const 1
     i32.add
     set_local $3
     br $repeat|0
    end
   end
  else   
   get_local $4
   set_global $core/graphics/tiles/TileCache.tileId
  end
  get_local $0
  get_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
  i32.ge_s
  if
   get_local $0
   i32.const 8
   i32.add
   set_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
   get_local $0
   get_local $2
   i32.const 8
   i32.rem_s
   tee_local $4
   i32.lt_s
   if
    get_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
    get_local $4
    i32.add
    set_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
   end
  end
  get_local $8
 )
 (func $core/graphics/tiles/getTileDataAddress (; 43 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  get_local $0
  i32.const 34816
  i32.eq
  if
   get_local $1
   i32.const 128
   i32.add
   set_local $2
   get_local $1
   i32.const 128
   i32.and
   if
    get_local $1
    i32.const 128
    i32.sub
    set_local $2
   end
   get_local $2
   i32.const 4
   i32.shl
   get_local $0
   i32.add
   return
  end
  get_local $1
  i32.const 4
  i32.shl
  get_local $0
  i32.add
 )
 (func $core/graphics/palette/getRgbColorFromPalette (; 44 ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  get_local $0
  i32.const 3
  i32.shl
  get_local $1
  i32.const 1
  i32.shl
  i32.add
  tee_local $0
  i32.const 1
  i32.add
  i32.const 63
  i32.and
  tee_local $1
  i32.const -64
  i32.sub
  get_local $1
  get_local $2
  select
  i32.const 67584
  i32.add
  i32.load8_u
  set_local $1
  get_local $0
  i32.const 63
  i32.and
  tee_local $0
  i32.const -64
  i32.sub
  get_local $0
  get_local $2
  select
  i32.const 67584
  i32.add
  i32.load8_u
  get_local $1
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/graphics/palette/getMonochromeColorFromPalette (; 45 ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  get_local $2
  i32.eqz
  if
   get_local $1
   call $core/memory/load/eightBitLoadFromGBMemory
   get_local $0
   i32.const 1
   i32.shl
   i32.shr_s
   i32.const 3
   i32.and
   set_local $0
  end
  i32.const 242
  set_local $1
  block $break|0
   get_local $0
   i32.eqz
   br_if $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      block $tablify|0
       get_local $0
       i32.const 1
       i32.sub
       br_table $case1|0 $case2|0 $case3|0 $tablify|0
      end
      br $break|0
     end
     i32.const 160
     set_local $1
     br $break|0
    end
    i32.const 88
    set_local $1
    br $break|0
   end
   i32.const 8
   set_local $1
  end
  get_local $1
 )
 (func $core/graphics/tiles/drawPixelsFromLineOfTile (; 46 ;) (type $FUNCSIG$iiiiiiiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (result i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  get_local $1
  get_local $0
  call $core/graphics/tiles/getTileDataAddress
  get_local $5
  i32.const 1
  i32.shl
  i32.add
  tee_local $0
  i32.const -30720
  i32.add
  get_local $2
  i32.const 1
  i32.and
  i32.const 13
  i32.shl
  tee_local $1
  i32.add
  i32.load8_u
  set_local $17
  get_local $0
  i32.const -30719
  i32.add
  get_local $1
  i32.add
  i32.load8_u
  set_local $18
  get_local $3
  set_local $0
  loop $repeat|0
   get_local $0
   get_local $4
   i32.le_s
   if
    get_local $0
    get_local $3
    i32.sub
    get_local $6
    i32.add
    tee_local $13
    get_local $8
    i32.lt_s
    if
     i32.const 7
     get_local $0
     i32.sub
     set_local $5
     get_local $11
     i32.const 0
     i32.lt_s
     tee_local $2
     if (result i32)
      get_local $2
     else      
      get_local $11
      i32.const 32
      i32.and
      i32.eqz
     end
     set_local $1
     i32.const 0
     set_local $2
     block (result i32)
      i32.const 1
      get_local $5
      get_local $0
      get_local $1
      select
      tee_local $1
      i32.shl
      get_local $18
      i32.and
      if
       i32.const 2
       set_local $2
      end
      get_local $2
      i32.const 1
      i32.add
     end
     get_local $2
     i32.const 1
     get_local $1
     i32.shl
     get_local $17
     i32.and
     select
     set_local $2
     get_local $11
     i32.const 0
     i32.ge_s
     if (result i32)
      get_local $11
      i32.const 7
      i32.and
      get_local $2
      i32.const 0
      call $core/graphics/palette/getRgbColorFromPalette
      tee_local $5
      i32.const 31
      i32.and
      i32.const 3
      i32.shl
      set_local $14
      get_local $5
      i32.const 992
      i32.and
      i32.const 5
      i32.shr_s
      i32.const 3
      i32.shl
      set_local $1
      get_local $5
      i32.const 31744
      i32.and
      i32.const 10
      i32.shr_s
      i32.const 3
      i32.shl
     else      
      get_local $2
      i32.const 65351
      get_local $15
      get_local $15
      i32.const 0
      i32.le_s
      select
      tee_local $15
      get_local $10
      call $core/graphics/palette/getMonochromeColorFromPalette
      tee_local $5
      set_local $14
      get_local $5
      tee_local $1
     end
     set_local $5
     get_local $7
     get_local $8
     i32.mul
     get_local $13
     i32.add
     i32.const 3
     i32.mul
     get_local $9
     i32.add
     tee_local $16
     get_local $14
     i32.store8
     get_local $16
     i32.const 1
     i32.add
     get_local $1
     i32.store8
     get_local $16
     i32.const 2
     i32.add
     get_local $5
     i32.store8
     get_local $7
     i32.const 160
     i32.mul
     get_local $13
     i32.add
     i32.const 69632
     i32.add
     get_local $2
     i32.const 3
     i32.and
     tee_local $1
     i32.const 4
     i32.or
     get_local $1
     get_local $11
     i32.const 128
     i32.and
     i32.const 0
     i32.ne
     i32.const 0
     get_local $11
     i32.const 0
     i32.ge_s
     select
     select
     i32.store8
     get_local $12
     i32.const 1
     i32.add
     set_local $12
    end
    get_local $0
    i32.const 1
    i32.add
    set_local $0
    br $repeat|0
   end
  end
  get_local $12
 )
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileId (; 47 ;) (type $iiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (result i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  get_local $3
  i32.const 8
  i32.rem_s
  set_local $3
  get_local $0
  i32.eqz
  if
   get_local $2
   get_local $2
   i32.const 8
   i32.div_s
   i32.const 3
   i32.shl
   i32.sub
   set_local $7
  end
  i32.const 160
  get_local $0
  i32.sub
  i32.const 7
  get_local $0
  i32.const 8
  i32.add
  i32.const 160
  i32.gt_s
  select
  set_local $9
  i32.const -1
  set_local $2
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  if
   get_local $4
   i32.const -22528
   i32.add
   i32.load8_u
   tee_local $2
   i32.const 8
   i32.and
   if
    i32.const 1
    set_local $8
   end
   get_local $2
   i32.const 64
   i32.and
   if
    i32.const 7
    get_local $3
    i32.sub
    set_local $3
   end
  end
  get_local $6
  get_local $5
  get_local $8
  get_local $7
  get_local $9
  get_local $3
  get_local $0
  get_local $1
  i32.const 160
  i32.const 93184
  i32.const 0
  get_local $2
  call $core/graphics/tiles/drawPixelsFromLineOfTile
 )
 (func $core/graphics/backgroundWindow/drawColorPixelFromTileId (; 48 ;) (type $iiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  get_local $5
  get_local $6
  call $core/graphics/tiles/getTileDataAddress
  set_local $6
  get_local $3
  i32.const 8
  i32.rem_s
  set_local $3
  get_local $4
  i32.const -22528
  i32.add
  i32.load8_u
  tee_local $4
  i32.const 64
  i32.and
  if (result i32)
   i32.const 7
   get_local $3
   i32.sub
  else   
   get_local $3
  end
  i32.const 1
  i32.shl
  get_local $6
  i32.add
  tee_local $3
  i32.const -30720
  i32.add
  i32.const 1
  i32.const 0
  get_local $4
  i32.const 8
  i32.and
  select
  i32.const 1
  i32.and
  i32.const 13
  i32.shl
  tee_local $5
  i32.add
  i32.load8_u
  set_local $6
  get_local $3
  i32.const -30719
  i32.add
  get_local $5
  i32.add
  i32.load8_u
  set_local $5
  get_local $2
  i32.const 8
  i32.rem_s
  set_local $3
  i32.const 0
  set_local $2
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 93184
  i32.add
  get_local $4
  i32.const 7
  i32.and
  block (result i32)
   i32.const 1
   get_local $3
   i32.const 7
   get_local $3
   i32.sub
   get_local $4
   i32.const 32
   i32.and
   select
   tee_local $3
   i32.shl
   get_local $5
   i32.and
   if
    i32.const 2
    set_local $2
   end
   get_local $2
   i32.const 1
   i32.add
  end
  get_local $2
  i32.const 1
  get_local $3
  i32.shl
  get_local $6
  i32.and
  select
  tee_local $2
  i32.const 0
  call $core/graphics/palette/getRgbColorFromPalette
  tee_local $3
  i32.const 31
  i32.and
  i32.const 3
  i32.shl
  i32.store8
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 93185
  i32.add
  get_local $3
  i32.const 992
  i32.and
  i32.const 5
  i32.shr_s
  i32.const 3
  i32.shl
  i32.store8
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 93186
  i32.add
  get_local $3
  i32.const 31744
  i32.and
  i32.const 10
  i32.shr_s
  i32.const 3
  i32.shl
  i32.store8
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 69632
  i32.add
  get_local $2
  i32.const 3
  i32.and
  tee_local $0
  i32.const 4
  i32.or
  get_local $0
  get_local $4
  i32.const 128
  i32.and
  select
  i32.store8
 )
 (func $core/graphics/backgroundWindow/drawMonochromePixelFromTileId (; 49 ;) (type $iiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  get_local $4
  get_local $5
  call $core/graphics/tiles/getTileDataAddress
  get_local $3
  i32.const 8
  i32.rem_s
  i32.const 1
  i32.shl
  i32.add
  tee_local $4
  i32.const -30720
  i32.add
  i32.load8_u
  set_local $5
  i32.const 0
  set_local $3
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 93184
  i32.add
  block (result i32)
   get_local $4
   i32.const -30719
   i32.add
   i32.load8_u
   i32.const 1
   i32.const 7
   get_local $2
   i32.const 8
   i32.rem_s
   i32.sub
   tee_local $2
   i32.shl
   i32.and
   if
    i32.const 2
    set_local $3
   end
   get_local $3
   i32.const 1
   i32.add
  end
  get_local $3
  i32.const 1
  get_local $2
  i32.shl
  get_local $5
  i32.and
  select
  tee_local $3
  i32.const 65351
  i32.const 0
  call $core/graphics/palette/getMonochromeColorFromPalette
  tee_local $2
  i32.store8
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 93185
  i32.add
  get_local $2
  i32.store8
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 93186
  i32.add
  get_local $2
  i32.store8
  get_local $1
  i32.const 160
  i32.mul
  get_local $0
  i32.add
  i32.const 69632
  i32.add
  get_local $3
  i32.const 3
  i32.and
  i32.store8
 )
 (func $core/graphics/backgroundWindow/drawBackgroundWindowScanline (; 50 ;) (type $iiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  get_local $3
  i32.const 3
  i32.shr_s
  set_local $11
  loop $repeat|0
   get_local $4
   i32.const 160
   i32.lt_s
   if
    get_local $4
    get_local $5
    i32.add
    tee_local $6
    i32.const 256
    i32.ge_s
    if
     get_local $6
     i32.const 256
     i32.sub
     set_local $6
    end
    get_local $11
    i32.const 5
    i32.shl
    get_local $2
    i32.add
    get_local $6
    i32.const 3
    i32.shr_s
    i32.add
    tee_local $9
    i32.const -30720
    i32.add
    i32.load8_u
    set_local $8
    i32.const 0
    set_local $10
    get_global $core/config/Config.tileCaching
    if
     get_local $4
     get_local $0
     get_local $6
     get_local $9
     get_local $8
     call $core/graphics/backgroundWindow/drawLineOfTileFromTileCache
     tee_local $7
     i32.const 0
     i32.gt_s
     if
      i32.const 1
      set_local $10
      get_local $7
      i32.const 1
      i32.sub
      get_local $4
      i32.add
      set_local $4
     end
    end
    get_local $10
    i32.eqz
    get_global $core/config/Config.tileRendering
    tee_local $7
    get_local $7
    select
    if
     get_local $4
     get_local $0
     get_local $6
     get_local $3
     get_local $9
     get_local $1
     get_local $8
     call $core/graphics/backgroundWindow/drawLineOfTileFromTileId
     tee_local $7
     i32.const 0
     i32.gt_s
     if
      get_local $7
      i32.const 1
      i32.sub
      get_local $4
      i32.add
      set_local $4
     end
    else     
     get_local $10
     i32.eqz
     if
      get_global $core/cpu/cpu/Cpu.GBCEnabled
      if
       get_local $4
       get_local $0
       get_local $6
       get_local $3
       get_local $9
       get_local $1
       get_local $8
       call $core/graphics/backgroundWindow/drawColorPixelFromTileId
      else       
       get_local $4
       get_local $0
       get_local $6
       get_local $3
       get_local $1
       get_local $8
       call $core/graphics/backgroundWindow/drawMonochromePixelFromTileId
      end
     end
    end
    get_local $4
    i32.const 1
    i32.add
    set_local $4
    br $repeat|0
   end
  end
 )
 (func $core/graphics/backgroundWindow/renderBackground (; 51 ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  get_global $core/graphics/graphics/Graphics.scrollX
  set_local $3
  get_local $0
  get_local $1
  get_local $2
  get_global $core/graphics/graphics/Graphics.scrollY
  get_local $0
  i32.add
  tee_local $0
  i32.const 256
  i32.ge_s
  if (result i32)
   get_local $0
   i32.const 256
   i32.sub
  else   
   get_local $0
  end
  i32.const 0
  get_local $3
  call $core/graphics/backgroundWindow/drawBackgroundWindowScanline
 )
 (func $core/graphics/backgroundWindow/renderWindow (; 52 ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  get_global $core/graphics/graphics/Graphics.windowX
  set_local $3
  get_local $0
  get_global $core/graphics/graphics/Graphics.windowY
  tee_local $4
  i32.lt_s
  if
   return
  end
  get_local $3
  i32.const 7
  i32.sub
  tee_local $3
  i32.const -1
  i32.mul
  set_local $5
  get_local $0
  get_local $1
  get_local $2
  get_local $0
  get_local $4
  i32.sub
  get_local $3
  get_local $5
  call $core/graphics/backgroundWindow/drawBackgroundWindowScanline
 )
 (func $core/graphics/sprites/renderSprites (; 53 ;) (type $iiv) (param $0 i32) (param $1 i32)
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
  block $break|0
   i32.const 39
   set_local $9
   loop $repeat|0
    get_local $9
    i32.const 0
    i32.lt_s
    br_if $break|0
    get_local $9
    i32.const 2
    i32.shl
    tee_local $4
    i32.const 65024
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemory
    set_local $2
    get_local $4
    i32.const 65025
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemory
    set_local $10
    get_local $4
    i32.const 65026
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemory
    set_local $3
    get_local $2
    i32.const 16
    i32.sub
    set_local $2
    get_local $10
    i32.const 8
    i32.sub
    set_local $10
    i32.const 8
    set_local $5
    get_local $1
    if
     i32.const 16
     set_local $5
     get_local $3
     i32.const 2
     i32.rem_s
     i32.const 1
     i32.eq
     if (result i32)
      get_local $3
      i32.const 1
      i32.sub
     else      
      get_local $3
     end
     set_local $3
    end
    get_local $0
    get_local $2
    i32.ge_s
    tee_local $6
    if
     get_local $0
     get_local $2
     get_local $5
     i32.add
     i32.lt_s
     set_local $6
    end
    get_local $6
    if
     get_local $4
     i32.const 65027
     i32.add
     call $core/memory/load/eightBitLoadFromGBMemory
     tee_local $6
     i32.const 128
     i32.and
     i32.const 0
     i32.ne
     set_local $11
     get_local $6
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     set_local $14
     i32.const 32768
     get_local $3
     call $core/graphics/tiles/getTileDataAddress
     get_local $0
     get_local $2
     i32.sub
     tee_local $2
     get_local $5
     i32.sub
     i32.const -1
     i32.mul
     i32.const 1
     i32.sub
     get_local $2
     get_local $6
     i32.const 64
     i32.and
     select
     i32.const 1
     i32.shl
     i32.add
     tee_local $3
     i32.const -30720
     i32.add
     i32.const 1
     i32.const 0
     get_local $6
     i32.const 8
     i32.and
     i32.const 0
     i32.ne
     get_global $core/cpu/cpu/Cpu.GBCEnabled
     tee_local $2
     get_local $2
     select
     select
     i32.const 1
     i32.and
     i32.const 13
     i32.shl
     tee_local $2
     i32.add
     i32.load8_u
     set_local $15
     get_local $3
     i32.const -30719
     i32.add
     get_local $2
     i32.add
     i32.load8_u
     set_local $16
     i32.const 7
     set_local $5
     loop $repeat|1
      get_local $5
      i32.const 0
      i32.ge_s
      if
       i32.const 0
       set_local $8
       block (result i32)
        i32.const 1
        get_local $5
        tee_local $2
        i32.const 7
        i32.sub
        i32.const -1
        i32.mul
        get_local $2
        get_local $14
        select
        tee_local $2
        i32.shl
        get_local $16
        i32.and
        if
         i32.const 2
         set_local $8
        end
        get_local $8
        i32.const 1
        i32.add
       end
       get_local $8
       i32.const 1
       get_local $2
       i32.shl
       get_local $15
       i32.and
       select
       tee_local $8
       if
        i32.const 7
        get_local $5
        i32.sub
        get_local $10
        i32.add
        tee_local $7
        i32.const 0
        i32.ge_s
        tee_local $2
        if
         get_local $7
         i32.const 160
         i32.le_s
         set_local $2
        end
        get_local $2
        if
         i32.const 0
         set_local $12
         i32.const 0
         set_local $13
         i32.const 1
         i32.const 0
         get_global $core/graphics/lcd/Lcd.bgDisplayEnabled
         i32.eqz
         get_global $core/cpu/cpu/Cpu.GBCEnabled
         tee_local $3
         get_local $3
         select
         select
         tee_local $2
         i32.eqz
         if
          get_local $0
          i32.const 160
          i32.mul
          get_local $7
          i32.add
          i32.const 69632
          i32.add
          i32.load8_u
          tee_local $3
          i32.const 3
          i32.and
          tee_local $4
          i32.const 0
          i32.gt_s
          get_local $11
          get_local $11
          select
          if
           i32.const 1
           set_local $12
          else           
           get_local $3
           i32.const 4
           i32.and
           i32.const 0
           i32.ne
           get_global $core/cpu/cpu/Cpu.GBCEnabled
           tee_local $3
           get_local $3
           select
           tee_local $3
           if
            get_local $4
            i32.const 0
            i32.gt_s
            set_local $3
           end
           i32.const 1
           i32.const 0
           get_local $3
           select
           set_local $13
          end
         end
         get_local $2
         i32.eqz
         if
          get_local $12
          i32.eqz
          tee_local $4
          if (result i32)
           get_local $13
           i32.eqz
          else           
           get_local $4
          end
          set_local $2
         end
         get_local $2
         if
          get_global $core/cpu/cpu/Cpu.GBCEnabled
          if
           get_local $0
           i32.const 160
           i32.mul
           get_local $7
           i32.add
           i32.const 3
           i32.mul
           i32.const 93184
           i32.add
           get_local $6
           i32.const 7
           i32.and
           get_local $8
           i32.const 1
           call $core/graphics/palette/getRgbColorFromPalette
           tee_local $4
           i32.const 31
           i32.and
           i32.const 3
           i32.shl
           i32.store8
           get_local $0
           i32.const 160
           i32.mul
           get_local $7
           i32.add
           i32.const 3
           i32.mul
           i32.const 93185
           i32.add
           get_local $4
           i32.const 992
           i32.and
           i32.const 5
           i32.shr_s
           i32.const 3
           i32.shl
           i32.store8
           get_local $0
           i32.const 160
           i32.mul
           get_local $7
           i32.add
           i32.const 3
           i32.mul
           i32.const 93186
           i32.add
           get_local $4
           i32.const 31744
           i32.and
           i32.const 10
           i32.shr_s
           i32.const 3
           i32.shl
           i32.store8
          else           
           get_local $0
           i32.const 160
           i32.mul
           get_local $7
           i32.add
           i32.const 3
           i32.mul
           i32.const 93184
           i32.add
           get_local $8
           i32.const 65353
           i32.const 65352
           get_local $6
           i32.const 16
           i32.and
           select
           i32.const 0
           call $core/graphics/palette/getMonochromeColorFromPalette
           tee_local $3
           i32.store8
           get_local $0
           i32.const 160
           i32.mul
           get_local $7
           i32.add
           i32.const 3
           i32.mul
           i32.const 93185
           i32.add
           get_local $3
           i32.store8
           get_local $0
           i32.const 160
           i32.mul
           get_local $7
           i32.add
           i32.const 3
           i32.mul
           i32.const 93186
           i32.add
           get_local $3
           i32.store8
          end
         end
        end
       end
       get_local $5
       i32.const 1
       i32.sub
       set_local $5
       br $repeat|1
      end
     end
    end
    get_local $9
    i32.const 1
    i32.sub
    set_local $9
    br $repeat|0
    unreachable
   end
   unreachable
  end
 )
 (func $core/graphics/graphics/_drawScanline (; 54 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 34816
  set_local $1
  i32.const 32768
  i32.const 34816
  get_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  select
  set_local $1
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  get_global $core/graphics/lcd/Lcd.bgDisplayEnabled
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  select
  if
   i32.const 38912
   set_local $2
   get_local $0
   get_local $1
   i32.const 39936
   i32.const 38912
   get_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
   select
   call $core/graphics/backgroundWindow/renderBackground
  end
  get_global $core/graphics/lcd/Lcd.windowDisplayEnabled
  if
   i32.const 38912
   set_local $2
   get_local $0
   get_local $1
   i32.const 39936
   i32.const 38912
   get_global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
   select
   call $core/graphics/backgroundWindow/renderWindow
  end
  get_global $core/graphics/lcd/Lcd.spriteDisplayEnable
  if
   get_local $0
   get_global $core/graphics/lcd/Lcd.tallSpriteSize
   call $core/graphics/sprites/renderSprites
  end
 )
 (func $core/graphics/graphics/_renderEntireFrame (; 55 ;) (type $v)
  (local $0 i32)
  block $break|0
   loop $repeat|0
    get_local $0
    i32.const 144
    i32.gt_u
    br_if $break|0
    get_local $0
    i32.const 255
    i32.and
    call $core/graphics/graphics/_drawScanline
    get_local $0
    i32.const 1
    i32.add
    set_local $0
    br $repeat|0
    unreachable
   end
   unreachable
  end
 )
 (func $core/graphics/priority/clearPriorityMap (; 56 ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  loop $repeat|0
   get_local $1
   i32.const 144
   i32.ge_s
   i32.eqz
   if
    i32.const 0
    set_local $0
    loop $repeat|1
     get_local $0
     i32.const 160
     i32.lt_s
     if
      get_local $1
      i32.const 160
      i32.mul
      get_local $0
      i32.add
      i32.const 69632
      i32.add
      i32.const 0
      i32.store8
      get_local $0
      i32.const 1
      i32.add
      set_local $0
      br $repeat|1
     end
    end
    get_local $1
    i32.const 1
    i32.add
    set_local $1
    br $repeat|0
   end
  end
 )
 (func $core/interrupts/interrupts/_requestInterrupt (; 57 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  i32.const 65295
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 1
  get_local $0
  i32.shl
  i32.or
  tee_local $1
  set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 65295
  get_local $1
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/interrupts/interrupts/requestLcdInterrupt (; 58 ;) (type $v)
  i32.const 1
  set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
  i32.const 1
  call $core/interrupts/interrupts/_requestInterrupt
 )
 (func $core/sound/channel1/Channel1.setFrequency (; 59 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 65300
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 248
  i32.and
  set_local $1
  i32.const 65299
  get_local $0
  i32.const 255
  i32.and
  tee_local $2
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65300
  get_local $1
  get_local $0
  i32.const 8
  i32.shr_s
  tee_local $0
  i32.or
  call $core/memory/store/eightBitStoreIntoGBMemory
  get_local $2
  set_global $core/sound/channel1/Channel1.NRx3FrequencyLSB
  get_local $0
  set_global $core/sound/channel1/Channel1.NRx4FrequencyMSB
  get_global $core/sound/channel1/Channel1.NRx3FrequencyLSB
  get_global $core/sound/channel1/Channel1.NRx4FrequencyMSB
  i32.const 8
  i32.shl
  i32.or
  set_global $core/sound/channel1/Channel1.frequency
 )
 (func $core/sound/channel1/calculateSweepAndCheckOverflow (; 60 ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  get_global $core/sound/channel1/Channel1.sweepShadowFrequency
  tee_local $1
  get_global $core/sound/channel1/Channel1.NRx0SweepShift
  i32.shr_s
  set_local $0
  get_local $1
  get_local $0
  i32.sub
  get_local $0
  get_local $1
  i32.add
  get_global $core/sound/channel1/Channel1.NRx0Negate
  select
  tee_local $0
  i32.const 2047
  i32.le_s
  tee_local $1
  if (result i32)
   get_global $core/sound/channel1/Channel1.NRx0SweepShift
   i32.const 0
   i32.gt_s
  else   
   get_local $1
  end
  if
   get_local $0
   set_global $core/sound/channel1/Channel1.sweepShadowFrequency
   get_local $0
   call $core/sound/channel1/Channel1.setFrequency
   get_global $core/sound/channel1/Channel1.sweepShadowFrequency
   tee_local $1
   get_global $core/sound/channel1/Channel1.NRx0SweepShift
   i32.shr_s
   set_local $0
   get_local $1
   get_local $0
   i32.sub
   get_local $0
   get_local $1
   i32.add
   get_global $core/sound/channel1/Channel1.NRx0Negate
   select
   set_local $0
  end
  get_local $0
  i32.const 2047
  i32.gt_s
  if
   i32.const 0
   set_global $core/sound/channel1/Channel1.isEnabled
  end
 )
 (func $core/sound/channel1/Channel1.updateSweep (; 61 ;) (type $v)
  get_global $core/sound/channel1/Channel1.sweepCounter
  i32.const 1
  i32.sub
  set_global $core/sound/channel1/Channel1.sweepCounter
  get_global $core/sound/channel1/Channel1.sweepCounter
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel1/Channel1.NRx0SweepPeriod
   set_global $core/sound/channel1/Channel1.sweepCounter
   get_global $core/sound/channel1/Channel1.NRx0SweepPeriod
   i32.const 0
   i32.gt_s
   get_global $core/sound/channel1/Channel1.isSweepEnabled
   get_global $core/sound/channel1/Channel1.isSweepEnabled
   select
   if
    call $core/sound/channel1/calculateSweepAndCheckOverflow
   end
  end
 )
 (func $core/sound/channel1/Channel1.updateEnvelope (; 62 ;) (type $v)
  (local $0 i32)
  get_global $core/sound/channel1/Channel1.envelopeCounter
  i32.const 1
  i32.sub
  set_global $core/sound/channel1/Channel1.envelopeCounter
  get_global $core/sound/channel1/Channel1.envelopeCounter
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel1/Channel1.NRx2EnvelopePeriod
   set_global $core/sound/channel1/Channel1.envelopeCounter
   get_global $core/sound/channel1/Channel1.envelopeCounter
   if
    get_global $core/sound/channel1/Channel1.volume
    i32.const 15
    i32.lt_s
    get_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
    get_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
    select
    if
     get_global $core/sound/channel1/Channel1.volume
     i32.const 1
     i32.add
     set_global $core/sound/channel1/Channel1.volume
    else     
     get_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
     i32.eqz
     tee_local $0
     if
      get_global $core/sound/channel1/Channel1.volume
      i32.const 0
      i32.gt_s
      set_local $0
     end
     get_local $0
     if
      get_global $core/sound/channel1/Channel1.volume
      i32.const 1
      i32.sub
      set_global $core/sound/channel1/Channel1.volume
     end
    end
   end
  end
 )
 (func $core/sound/channel2/Channel2.updateEnvelope (; 63 ;) (type $v)
  (local $0 i32)
  get_global $core/sound/channel2/Channel2.envelopeCounter
  i32.const 1
  i32.sub
  set_global $core/sound/channel2/Channel2.envelopeCounter
  get_global $core/sound/channel2/Channel2.envelopeCounter
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel2/Channel2.NRx2EnvelopePeriod
   set_global $core/sound/channel2/Channel2.envelopeCounter
   get_global $core/sound/channel2/Channel2.envelopeCounter
   if
    get_global $core/sound/channel2/Channel2.volume
    i32.const 15
    i32.lt_s
    get_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
    get_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
    select
    if
     get_global $core/sound/channel2/Channel2.volume
     i32.const 1
     i32.add
     set_global $core/sound/channel2/Channel2.volume
    else     
     get_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
     i32.eqz
     tee_local $0
     if
      get_global $core/sound/channel2/Channel2.volume
      i32.const 0
      i32.gt_s
      set_local $0
     end
     get_local $0
     if
      get_global $core/sound/channel2/Channel2.volume
      i32.const 1
      i32.sub
      set_global $core/sound/channel2/Channel2.volume
     end
    end
   end
  end
 )
 (func $core/sound/channel4/Channel4.updateEnvelope (; 64 ;) (type $v)
  (local $0 i32)
  get_global $core/sound/channel4/Channel4.envelopeCounter
  i32.const 1
  i32.sub
  set_global $core/sound/channel4/Channel4.envelopeCounter
  get_global $core/sound/channel4/Channel4.envelopeCounter
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel4/Channel4.NRx2EnvelopePeriod
   set_global $core/sound/channel4/Channel4.envelopeCounter
   get_global $core/sound/channel4/Channel4.envelopeCounter
   if
    get_global $core/sound/channel4/Channel4.volume
    i32.const 15
    i32.lt_s
    get_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
    get_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
    select
    if
     get_global $core/sound/channel4/Channel4.volume
     i32.const 1
     i32.add
     set_global $core/sound/channel4/Channel4.volume
    else     
     get_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
     i32.eqz
     tee_local $0
     if
      get_global $core/sound/channel4/Channel4.volume
      i32.const 0
      i32.gt_s
      set_local $0
     end
     get_local $0
     if
      get_global $core/sound/channel4/Channel4.volume
      i32.const 1
      i32.sub
      set_global $core/sound/channel4/Channel4.volume
     end
    end
   end
  end
 )
 (func $core/sound/sound/updateFrameSequencer (; 65 ;) (type $ii) (param $0 i32) (result i32)
  get_global $core/sound/sound/Sound.frameSequenceCycleCounter
  get_local $0
  i32.add
  set_global $core/sound/sound/Sound.frameSequenceCycleCounter
  get_global $core/sound/sound/Sound.frameSequenceCycleCounter
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  if (result i32)
   i32.const 16384
  else   
   i32.const 8192
  end
  i32.ge_s
  if
   get_global $core/sound/sound/Sound.frameSequenceCycleCounter
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if (result i32)
    i32.const 16384
   else    
    i32.const 8192
   end
   i32.sub
   set_global $core/sound/sound/Sound.frameSequenceCycleCounter
   block $break|0
    block $case4|0
     block $case3|0
      block $case2|0
       block $case1|0
        get_global $core/sound/sound/Sound.frameSequencer
        tee_local $0
        if
         get_local $0
         i32.const 2
         i32.sub
         br_table $case1|0 $break|0 $case2|0 $break|0 $case3|0 $case4|0 $break|0
        end
        get_global $core/sound/channel1/Channel1.lengthCounter
        i32.const 0
        i32.gt_s
        tee_local $0
        if (result i32)
         get_global $core/sound/channel1/Channel1.NRx4LengthEnabled
        else         
         get_local $0
        end
        if
         get_global $core/sound/channel1/Channel1.lengthCounter
         i32.const 1
         i32.sub
         set_global $core/sound/channel1/Channel1.lengthCounter
        end
        get_global $core/sound/channel1/Channel1.lengthCounter
        i32.eqz
        if
         i32.const 0
         set_global $core/sound/channel1/Channel1.isEnabled
        end
        get_global $core/sound/channel2/Channel2.lengthCounter
        i32.const 0
        i32.gt_s
        tee_local $0
        if (result i32)
         get_global $core/sound/channel2/Channel2.NRx4LengthEnabled
        else         
         get_local $0
        end
        if
         get_global $core/sound/channel2/Channel2.lengthCounter
         i32.const 1
         i32.sub
         set_global $core/sound/channel2/Channel2.lengthCounter
        end
        get_global $core/sound/channel2/Channel2.lengthCounter
        i32.eqz
        if
         i32.const 0
         set_global $core/sound/channel2/Channel2.isEnabled
        end
        get_global $core/sound/channel3/Channel3.lengthCounter
        i32.const 0
        i32.gt_s
        tee_local $0
        if (result i32)
         get_global $core/sound/channel3/Channel3.NRx4LengthEnabled
        else         
         get_local $0
        end
        if
         get_global $core/sound/channel3/Channel3.lengthCounter
         i32.const 1
         i32.sub
         set_global $core/sound/channel3/Channel3.lengthCounter
        end
        get_global $core/sound/channel3/Channel3.lengthCounter
        i32.eqz
        if
         i32.const 0
         set_global $core/sound/channel3/Channel3.isEnabled
        end
        get_global $core/sound/channel4/Channel4.lengthCounter
        i32.const 0
        i32.gt_s
        tee_local $0
        if (result i32)
         get_global $core/sound/channel4/Channel4.NRx4LengthEnabled
        else         
         get_local $0
        end
        if
         get_global $core/sound/channel4/Channel4.lengthCounter
         i32.const 1
         i32.sub
         set_global $core/sound/channel4/Channel4.lengthCounter
        end
        get_global $core/sound/channel4/Channel4.lengthCounter
        i32.eqz
        if
         i32.const 0
         set_global $core/sound/channel4/Channel4.isEnabled
        end
        br $break|0
       end
       get_global $core/sound/channel1/Channel1.lengthCounter
       i32.const 0
       i32.gt_s
       tee_local $0
       if (result i32)
        get_global $core/sound/channel1/Channel1.NRx4LengthEnabled
       else        
        get_local $0
       end
       if
        get_global $core/sound/channel1/Channel1.lengthCounter
        i32.const 1
        i32.sub
        set_global $core/sound/channel1/Channel1.lengthCounter
       end
       get_global $core/sound/channel1/Channel1.lengthCounter
       i32.eqz
       if
        i32.const 0
        set_global $core/sound/channel1/Channel1.isEnabled
       end
       get_global $core/sound/channel2/Channel2.lengthCounter
       i32.const 0
       i32.gt_s
       tee_local $0
       if (result i32)
        get_global $core/sound/channel2/Channel2.NRx4LengthEnabled
       else        
        get_local $0
       end
       if
        get_global $core/sound/channel2/Channel2.lengthCounter
        i32.const 1
        i32.sub
        set_global $core/sound/channel2/Channel2.lengthCounter
       end
       get_global $core/sound/channel2/Channel2.lengthCounter
       i32.eqz
       if
        i32.const 0
        set_global $core/sound/channel2/Channel2.isEnabled
       end
       get_global $core/sound/channel3/Channel3.lengthCounter
       i32.const 0
       i32.gt_s
       tee_local $0
       if (result i32)
        get_global $core/sound/channel3/Channel3.NRx4LengthEnabled
       else        
        get_local $0
       end
       if
        get_global $core/sound/channel3/Channel3.lengthCounter
        i32.const 1
        i32.sub
        set_global $core/sound/channel3/Channel3.lengthCounter
       end
       get_global $core/sound/channel3/Channel3.lengthCounter
       i32.eqz
       if
        i32.const 0
        set_global $core/sound/channel3/Channel3.isEnabled
       end
       get_global $core/sound/channel4/Channel4.lengthCounter
       i32.const 0
       i32.gt_s
       tee_local $0
       if (result i32)
        get_global $core/sound/channel4/Channel4.NRx4LengthEnabled
       else        
        get_local $0
       end
       if
        get_global $core/sound/channel4/Channel4.lengthCounter
        i32.const 1
        i32.sub
        set_global $core/sound/channel4/Channel4.lengthCounter
       end
       get_global $core/sound/channel4/Channel4.lengthCounter
       i32.eqz
       if
        i32.const 0
        set_global $core/sound/channel4/Channel4.isEnabled
       end
       call $core/sound/channel1/Channel1.updateSweep
       br $break|0
      end
      get_global $core/sound/channel1/Channel1.lengthCounter
      i32.const 0
      i32.gt_s
      tee_local $0
      if (result i32)
       get_global $core/sound/channel1/Channel1.NRx4LengthEnabled
      else       
       get_local $0
      end
      if
       get_global $core/sound/channel1/Channel1.lengthCounter
       i32.const 1
       i32.sub
       set_global $core/sound/channel1/Channel1.lengthCounter
      end
      get_global $core/sound/channel1/Channel1.lengthCounter
      i32.eqz
      if
       i32.const 0
       set_global $core/sound/channel1/Channel1.isEnabled
      end
      get_global $core/sound/channel2/Channel2.lengthCounter
      i32.const 0
      i32.gt_s
      tee_local $0
      if (result i32)
       get_global $core/sound/channel2/Channel2.NRx4LengthEnabled
      else       
       get_local $0
      end
      if
       get_global $core/sound/channel2/Channel2.lengthCounter
       i32.const 1
       i32.sub
       set_global $core/sound/channel2/Channel2.lengthCounter
      end
      get_global $core/sound/channel2/Channel2.lengthCounter
      i32.eqz
      if
       i32.const 0
       set_global $core/sound/channel2/Channel2.isEnabled
      end
      get_global $core/sound/channel3/Channel3.lengthCounter
      i32.const 0
      i32.gt_s
      tee_local $0
      if (result i32)
       get_global $core/sound/channel3/Channel3.NRx4LengthEnabled
      else       
       get_local $0
      end
      if
       get_global $core/sound/channel3/Channel3.lengthCounter
       i32.const 1
       i32.sub
       set_global $core/sound/channel3/Channel3.lengthCounter
      end
      get_global $core/sound/channel3/Channel3.lengthCounter
      i32.eqz
      if
       i32.const 0
       set_global $core/sound/channel3/Channel3.isEnabled
      end
      get_global $core/sound/channel4/Channel4.lengthCounter
      i32.const 0
      i32.gt_s
      tee_local $0
      if (result i32)
       get_global $core/sound/channel4/Channel4.NRx4LengthEnabled
      else       
       get_local $0
      end
      if
       get_global $core/sound/channel4/Channel4.lengthCounter
       i32.const 1
       i32.sub
       set_global $core/sound/channel4/Channel4.lengthCounter
      end
      get_global $core/sound/channel4/Channel4.lengthCounter
      i32.eqz
      if
       i32.const 0
       set_global $core/sound/channel4/Channel4.isEnabled
      end
      br $break|0
     end
     get_global $core/sound/channel1/Channel1.lengthCounter
     i32.const 0
     i32.gt_s
     tee_local $0
     if (result i32)
      get_global $core/sound/channel1/Channel1.NRx4LengthEnabled
     else      
      get_local $0
     end
     if
      get_global $core/sound/channel1/Channel1.lengthCounter
      i32.const 1
      i32.sub
      set_global $core/sound/channel1/Channel1.lengthCounter
     end
     get_global $core/sound/channel1/Channel1.lengthCounter
     i32.eqz
     if
      i32.const 0
      set_global $core/sound/channel1/Channel1.isEnabled
     end
     get_global $core/sound/channel2/Channel2.lengthCounter
     i32.const 0
     i32.gt_s
     tee_local $0
     if (result i32)
      get_global $core/sound/channel2/Channel2.NRx4LengthEnabled
     else      
      get_local $0
     end
     if
      get_global $core/sound/channel2/Channel2.lengthCounter
      i32.const 1
      i32.sub
      set_global $core/sound/channel2/Channel2.lengthCounter
     end
     get_global $core/sound/channel2/Channel2.lengthCounter
     i32.eqz
     if
      i32.const 0
      set_global $core/sound/channel2/Channel2.isEnabled
     end
     get_global $core/sound/channel3/Channel3.lengthCounter
     i32.const 0
     i32.gt_s
     tee_local $0
     if (result i32)
      get_global $core/sound/channel3/Channel3.NRx4LengthEnabled
     else      
      get_local $0
     end
     if
      get_global $core/sound/channel3/Channel3.lengthCounter
      i32.const 1
      i32.sub
      set_global $core/sound/channel3/Channel3.lengthCounter
     end
     get_global $core/sound/channel3/Channel3.lengthCounter
     i32.eqz
     if
      i32.const 0
      set_global $core/sound/channel3/Channel3.isEnabled
     end
     get_global $core/sound/channel4/Channel4.lengthCounter
     i32.const 0
     i32.gt_s
     tee_local $0
     if (result i32)
      get_global $core/sound/channel4/Channel4.NRx4LengthEnabled
     else      
      get_local $0
     end
     if
      get_global $core/sound/channel4/Channel4.lengthCounter
      i32.const 1
      i32.sub
      set_global $core/sound/channel4/Channel4.lengthCounter
     end
     get_global $core/sound/channel4/Channel4.lengthCounter
     i32.eqz
     if
      i32.const 0
      set_global $core/sound/channel4/Channel4.isEnabled
     end
     call $core/sound/channel1/Channel1.updateSweep
     br $break|0
    end
    call $core/sound/channel1/Channel1.updateEnvelope
    call $core/sound/channel2/Channel2.updateEnvelope
    call $core/sound/channel4/Channel4.updateEnvelope
   end
   get_global $core/sound/sound/Sound.frameSequencer
   i32.const 1
   i32.add
   set_global $core/sound/sound/Sound.frameSequencer
   get_global $core/sound/sound/Sound.frameSequencer
   i32.const 8
   i32.ge_s
   if
    i32.const 0
    set_global $core/sound/sound/Sound.frameSequencer
   end
   i32.const 1
   return
  end
  i32.const 0
 )
 (func $core/sound/accumulator/didChannelDacChange (; 66 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      get_local $0
      i32.const 1
      i32.ne
      if
       get_local $0
       tee_local $1
       i32.const 2
       i32.eq
       br_if $case1|0
       get_local $1
       i32.const 3
       i32.eq
       br_if $case2|0
       get_local $1
       i32.const 4
       i32.eq
       br_if $case3|0
       br $break|0
      end
      get_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
      get_global $core/sound/channel1/Channel1.isDacEnabled
      i32.ne
      if
       get_global $core/sound/channel1/Channel1.isDacEnabled
       set_global $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
       i32.const 1
       return
      end
      i32.const 0
      return
     end
     get_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
     get_global $core/sound/channel2/Channel2.isDacEnabled
     i32.ne
     if
      get_global $core/sound/channel2/Channel2.isDacEnabled
      set_global $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
      i32.const 1
      return
     end
     i32.const 0
     return
    end
    get_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
    get_global $core/sound/channel3/Channel3.isDacEnabled
    i32.ne
    if
     get_global $core/sound/channel3/Channel3.isDacEnabled
     set_global $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
     i32.const 1
     return
    end
    i32.const 0
    return
   end
   get_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
   get_global $core/sound/channel4/Channel4.isDacEnabled
   i32.ne
   if
    get_global $core/sound/channel4/Channel4.isDacEnabled
    set_global $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
    i32.const 1
    return
   end
   i32.const 0
   return
  end
  i32.const 0
 )
 (func $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform (; 67 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  block $case3|0
   block $case2|0
    block $case1|0
     get_local $0
     i32.const 1
     i32.ne
     if
      get_local $0
      i32.const 2
      i32.eq
      br_if $case1|0
      get_local $0
      i32.const 3
      i32.eq
      br_if $case2|0
      br $case3|0
     end
     i32.const 1
     get_local $1
     i32.shl
     i32.const 129
     i32.and
     i32.const 0
     i32.ne
     return
    end
    i32.const 1
    get_local $1
    i32.shl
    i32.const 135
    i32.and
    i32.const 0
    i32.ne
    return
   end
   i32.const 1
   get_local $1
   i32.shl
   i32.const 126
   i32.and
   i32.const 0
   i32.ne
   return
  end
  i32.const 1
  get_local $1
  i32.shl
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
 )
 (func $core/sound/channel1/Channel1.getSample (; 68 ;) (type $ii) (param $0 i32) (result i32)
  get_global $core/sound/channel1/Channel1.frequencyTimer
  get_local $0
  i32.sub
  set_global $core/sound/channel1/Channel1.frequencyTimer
  get_global $core/sound/channel1/Channel1.frequencyTimer
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel1/Channel1.frequencyTimer
   set_local $0
   i32.const 2048
   get_global $core/sound/channel1/Channel1.frequency
   i32.sub
   i32.const 2
   i32.shl
   set_global $core/sound/channel1/Channel1.frequencyTimer
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if
    get_global $core/sound/channel1/Channel1.frequencyTimer
    i32.const 1
    i32.shl
    set_global $core/sound/channel1/Channel1.frequencyTimer
   end
   get_global $core/sound/channel1/Channel1.frequencyTimer
   get_local $0
   i32.const 0
   get_local $0
   i32.sub
   get_local $0
   i32.const 0
   i32.gt_s
   select
   i32.sub
   set_global $core/sound/channel1/Channel1.frequencyTimer
   get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
   i32.const 1
   i32.add
   set_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
   get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
   i32.const 8
   i32.ge_s
   if
    i32.const 0
    set_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
   end
  end
  get_global $core/sound/channel1/Channel1.isDacEnabled
  get_global $core/sound/channel1/Channel1.isEnabled
  tee_local $0
  get_local $0
  select
  if (result i32)
   get_global $core/sound/channel1/Channel1.volume
  else   
   i32.const 15
   return
  end
  get_global $core/sound/channel1/Channel1.NRx1Duty
  get_global $core/sound/channel1/Channel1.waveFormPositionOnDuty
  call $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
  if (result i32)
   i32.const 1
  else   
   i32.const -1
  end
  i32.mul
  i32.const 15
  i32.add
 )
 (func $core/sound/channel2/Channel2.getSample (; 69 ;) (type $ii) (param $0 i32) (result i32)
  get_global $core/sound/channel2/Channel2.frequencyTimer
  get_local $0
  i32.sub
  set_global $core/sound/channel2/Channel2.frequencyTimer
  get_global $core/sound/channel2/Channel2.frequencyTimer
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel2/Channel2.frequencyTimer
   set_local $0
   i32.const 2048
   get_global $core/sound/channel2/Channel2.frequency
   i32.sub
   i32.const 2
   i32.shl
   set_global $core/sound/channel2/Channel2.frequencyTimer
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if
    get_global $core/sound/channel2/Channel2.frequencyTimer
    i32.const 1
    i32.shl
    set_global $core/sound/channel2/Channel2.frequencyTimer
   end
   get_global $core/sound/channel2/Channel2.frequencyTimer
   get_local $0
   i32.const 0
   get_local $0
   i32.sub
   get_local $0
   i32.const 0
   i32.gt_s
   select
   i32.sub
   set_global $core/sound/channel2/Channel2.frequencyTimer
   get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
   i32.const 1
   i32.add
   set_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
   get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
   i32.const 8
   i32.ge_s
   if
    i32.const 0
    set_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
   end
  end
  get_global $core/sound/channel2/Channel2.isDacEnabled
  get_global $core/sound/channel2/Channel2.isEnabled
  tee_local $0
  get_local $0
  select
  if (result i32)
   get_global $core/sound/channel2/Channel2.volume
  else   
   i32.const 15
   return
  end
  get_global $core/sound/channel2/Channel2.NRx1Duty
  get_global $core/sound/channel2/Channel2.waveFormPositionOnDuty
  call $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
  if (result i32)
   i32.const 1
  else   
   i32.const -1
  end
  i32.mul
  i32.const 15
  i32.add
 )
 (func $core/sound/channel3/Channel3.getSample (; 70 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  get_global $core/sound/channel3/Channel3.frequencyTimer
  get_local $0
  i32.sub
  set_global $core/sound/channel3/Channel3.frequencyTimer
  get_global $core/sound/channel3/Channel3.frequencyTimer
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel3/Channel3.frequencyTimer
   set_local $2
   i32.const 2048
   get_global $core/sound/channel3/Channel3.frequency
   i32.sub
   i32.const 1
   i32.shl
   set_global $core/sound/channel3/Channel3.frequencyTimer
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if
    get_global $core/sound/channel3/Channel3.frequencyTimer
    i32.const 1
    i32.shl
    set_global $core/sound/channel3/Channel3.frequencyTimer
   end
   get_global $core/sound/channel3/Channel3.frequencyTimer
   get_local $2
   i32.const 0
   get_local $2
   i32.sub
   get_local $2
   i32.const 0
   i32.gt_s
   select
   i32.sub
   set_global $core/sound/channel3/Channel3.frequencyTimer
   get_global $core/sound/channel3/Channel3.waveTablePosition
   i32.const 1
   i32.add
   set_global $core/sound/channel3/Channel3.waveTablePosition
   get_global $core/sound/channel3/Channel3.waveTablePosition
   i32.const 32
   i32.ge_s
   if
    i32.const 0
    set_global $core/sound/channel3/Channel3.waveTablePosition
   end
  end
  i32.const 0
  set_local $2
  get_global $core/sound/channel3/Channel3.volumeCode
  set_local $0
  get_global $core/sound/channel3/Channel3.isDacEnabled
  get_global $core/sound/channel3/Channel3.isEnabled
  tee_local $1
  get_local $1
  select
  if
   get_global $core/sound/channel3/Channel3.volumeCodeChanged
   if
    i32.const 65308
    call $core/memory/load/eightBitLoadFromGBMemory
    i32.const 5
    i32.shr_s
    i32.const 15
    i32.and
    tee_local $0
    set_global $core/sound/channel3/Channel3.volumeCode
    i32.const 0
    set_global $core/sound/channel3/Channel3.volumeCodeChanged
   end
  else   
   i32.const 15
   return
  end
  get_global $core/sound/channel3/Channel3.waveTablePosition
  i32.const 2
  i32.div_s
  i32.const 65328
  i32.add
  call $core/memory/load/eightBitLoadFromGBMemory
  set_local $1
  get_global $core/sound/channel3/Channel3.waveTablePosition
  i32.const 2
  i32.rem_s
  if (result i32)
   get_local $1
   i32.const 15
   i32.and
  else   
   get_local $1
   i32.const 4
   i32.shr_s
   i32.const 15
   i32.and
  end
  set_local $1
  block $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      get_local $0
      if
       get_local $0
       i32.const 1
       i32.eq
       br_if $case1|0
       get_local $0
       i32.const 2
       i32.eq
       br_if $case2|0
       br $case3|0
      end
      get_local $1
      i32.const 4
      i32.shr_s
      set_local $1
      br $break|0
     end
     i32.const 1
     set_local $2
     br $break|0
    end
    get_local $1
    i32.const 1
    i32.shr_s
    set_local $1
    i32.const 2
    set_local $2
    br $break|0
   end
   get_local $1
   i32.const 2
   i32.shr_s
   set_local $1
   i32.const 4
   set_local $2
  end
  get_local $2
  i32.const 0
  i32.gt_s
  if (result i32)
   get_local $1
   get_local $2
   i32.div_s
  else   
   i32.const 0
  end
  i32.const 15
  i32.add
 )
 (func $core/sound/channel4/Channel4.getSample (; 71 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  get_global $core/sound/channel4/Channel4.frequencyTimer
  get_local $0
  i32.sub
  set_global $core/sound/channel4/Channel4.frequencyTimer
  get_global $core/sound/channel4/Channel4.frequencyTimer
  i32.const 0
  i32.le_s
  if
   get_global $core/sound/channel4/Channel4.frequencyTimer
   set_local $0
   get_global $core/sound/channel4/Channel4.divisor
   get_global $core/sound/channel4/Channel4.NRx3ClockShift
   i32.shl
   tee_local $1
   i32.const 1
   i32.shl
   get_local $1
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   select
   set_global $core/sound/channel4/Channel4.frequencyTimer
   get_global $core/sound/channel4/Channel4.frequencyTimer
   get_local $0
   i32.const 0
   get_local $0
   i32.sub
   get_local $0
   i32.const 0
   i32.gt_s
   select
   i32.sub
   set_global $core/sound/channel4/Channel4.frequencyTimer
   get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   tee_local $0
   i32.const 1
   i32.and
   set_local $1
   get_local $0
   i32.const 1
   i32.shr_s
   tee_local $0
   set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   get_local $1
   get_local $0
   i32.const 1
   i32.and
   i32.xor
   tee_local $1
   i32.const 14
   i32.shl
   i32.or
   set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   get_global $core/sound/channel4/Channel4.NRx3WidthMode
   if
    get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
    i32.const -65
    i32.and
    set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
    get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
    get_local $1
    i32.const 6
    i32.shl
    i32.or
    set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   end
  end
  get_global $core/sound/channel4/Channel4.isDacEnabled
  get_global $core/sound/channel4/Channel4.isEnabled
  tee_local $0
  get_local $0
  select
  if (result i32)
   get_global $core/sound/channel4/Channel4.volume
  else   
   i32.const 15
   return
  end
  i32.const -1
  i32.const 1
  get_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  i32.const 1
  i32.and
  select
  i32.mul
  i32.const 15
  i32.add
 )
 (func $core/sound/sound/getSampleAsUnsignedByte (; 72 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  get_local $0
  i32.const 60
  i32.eq
  if
   i32.const 127
   return
  end
  get_local $0
  i32.const 60
  i32.sub
  i32.const 100000
  i32.mul
  get_local $1
  i32.mul
  i32.const 8
  i32.div_s
  i32.const 100000
  i32.div_s
  i32.const 60
  i32.add
  i32.const 100000
  i32.mul
  i32.const 47244
  i32.div_s
 )
 (func $core/sound/sound/mixChannelSamples (; 73 ;) (type $iiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
  get_local $0
  i32.const 15
  get_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  select
  tee_local $4
  get_local $1
  i32.add
  get_local $4
  i32.const 15
  i32.add
  get_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  select
  tee_local $4
  get_local $2
  i32.add
  get_local $4
  i32.const 15
  i32.add
  get_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  select
  set_local $4
  get_local $3
  get_local $2
  get_local $1
  get_local $0
  i32.const 15
  get_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
  select
  tee_local $0
  i32.add
  get_local $0
  i32.const 15
  i32.add
  get_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  select
  tee_local $0
  i32.add
  get_local $0
  i32.const 15
  i32.add
  get_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  select
  tee_local $0
  i32.add
  get_local $0
  i32.const 15
  i32.add
  get_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  select
  set_local $0
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
  i32.const 0
  set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
  get_local $3
  get_local $4
  i32.add
  get_local $4
  i32.const 15
  i32.add
  get_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  select
  get_global $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.const 1
  i32.add
  call $core/sound/sound/getSampleAsUnsignedByte
  set_local $1
  get_local $0
  get_global $core/sound/sound/Sound.NR50RightMixerVolume
  i32.const 1
  i32.add
  call $core/sound/sound/getSampleAsUnsignedByte
  set_local $0
  get_local $1
  set_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
  get_local $0
  set_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
  get_local $0
  i32.const 255
  i32.and
  get_local $1
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/sound/accumulator/accumulateSound (; 74 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  block $__inlined_func$core/sound/channel1/Channel1.willChannelUpdate (result i32)
   get_global $core/sound/channel1/Channel1.cycleCounter
   get_local $0
   i32.add
   set_global $core/sound/channel1/Channel1.cycleCounter
   i32.const 0
   get_global $core/sound/channel1/Channel1.frequencyTimer
   get_global $core/sound/channel1/Channel1.cycleCounter
   i32.sub
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/sound/channel1/Channel1.willChannelUpdate
   drop
   i32.const 1
  end
  tee_local $1
  i32.eqz
  if
   i32.const 1
   call $core/sound/accumulator/didChannelDacChange
   set_local $1
  end
  block $__inlined_func$core/sound/channel2/Channel2.willChannelUpdate (result i32)
   get_global $core/sound/channel2/Channel2.cycleCounter
   get_local $0
   i32.add
   set_global $core/sound/channel2/Channel2.cycleCounter
   i32.const 0
   get_global $core/sound/channel2/Channel2.frequencyTimer
   get_global $core/sound/channel2/Channel2.cycleCounter
   i32.sub
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/sound/channel2/Channel2.willChannelUpdate
   drop
   i32.const 1
  end
  tee_local $4
  i32.eqz
  if
   i32.const 2
   call $core/sound/accumulator/didChannelDacChange
   set_local $4
  end
  block $__inlined_func$core/sound/channel3/Channel3.willChannelUpdate (result i32)
   get_global $core/sound/channel3/Channel3.cycleCounter
   get_local $0
   i32.add
   set_global $core/sound/channel3/Channel3.cycleCounter
   get_global $core/sound/channel3/Channel3.frequencyTimer
   get_global $core/sound/channel3/Channel3.cycleCounter
   i32.sub
   i32.const 0
   i32.gt_s
   tee_local $2
   if
    get_global $core/sound/channel3/Channel3.volumeCodeChanged
    i32.eqz
    set_local $2
   end
   i32.const 0
   get_local $2
   br_if $__inlined_func$core/sound/channel3/Channel3.willChannelUpdate
   drop
   i32.const 1
  end
  tee_local $2
  i32.eqz
  if
   i32.const 3
   call $core/sound/accumulator/didChannelDacChange
   set_local $2
  end
  block $__inlined_func$core/sound/channel4/Channel4.willChannelUpdate (result i32)
   get_global $core/sound/channel4/Channel4.cycleCounter
   get_local $0
   i32.add
   set_global $core/sound/channel4/Channel4.cycleCounter
   i32.const 0
   get_global $core/sound/channel4/Channel4.frequencyTimer
   get_global $core/sound/channel4/Channel4.cycleCounter
   i32.sub
   i32.const 0
   i32.gt_s
   br_if $__inlined_func$core/sound/channel4/Channel4.willChannelUpdate
   drop
   i32.const 1
  end
  tee_local $5
  i32.eqz
  if
   i32.const 4
   call $core/sound/accumulator/didChannelDacChange
   set_local $5
  end
  get_local $1
  if
   get_global $core/sound/channel1/Channel1.cycleCounter
   set_local $3
   i32.const 0
   set_global $core/sound/channel1/Channel1.cycleCounter
   get_local $3
   call $core/sound/channel1/Channel1.getSample
   set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
  end
  get_local $4
  if
   get_global $core/sound/channel2/Channel2.cycleCounter
   set_local $3
   i32.const 0
   set_global $core/sound/channel2/Channel2.cycleCounter
   get_local $3
   call $core/sound/channel2/Channel2.getSample
   set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
  end
  get_local $2
  if
   get_global $core/sound/channel3/Channel3.cycleCounter
   set_local $3
   i32.const 0
   set_global $core/sound/channel3/Channel3.cycleCounter
   get_local $3
   call $core/sound/channel3/Channel3.getSample
   set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
  end
  get_local $5
  if
   get_global $core/sound/channel4/Channel4.cycleCounter
   set_local $3
   i32.const 0
   set_global $core/sound/channel4/Channel4.cycleCounter
   get_local $3
   call $core/sound/channel4/Channel4.getSample
   set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
  end
  block (result i32)
   get_local $1
   get_local $4
   get_local $1
   select
   tee_local $1
   i32.eqz
   if
    get_local $2
    set_local $1
   end
   get_local $1
   i32.eqz
  end
  if
   get_local $5
   set_local $1
  end
  get_local $1
  if
   i32.const 1
   set_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
  end
  get_global $core/sound/sound/Sound.downSampleCycleCounter
  get_global $core/sound/sound/Sound.downSampleCycleMultiplier
  get_local $0
  i32.mul
  i32.add
  set_global $core/sound/sound/Sound.downSampleCycleCounter
  get_global $core/sound/sound/Sound.downSampleCycleCounter
  i32.const 8388608
  i32.const 4194304
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  select
  i32.ge_s
  if
   get_global $core/sound/sound/Sound.downSampleCycleCounter
   i32.const 8388608
   i32.const 4194304
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   select
   i32.sub
   set_global $core/sound/sound/Sound.downSampleCycleCounter
   get_global $core/sound/accumulator/SoundAccumulator.needToRemixSamples
   tee_local $0
   get_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
   get_local $0
   select
   tee_local $1
   i32.eqz
   if
    get_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
    set_local $1
   end
   get_local $1
   if
    get_global $core/sound/accumulator/SoundAccumulator.channel1Sample
    get_global $core/sound/accumulator/SoundAccumulator.channel2Sample
    get_global $core/sound/accumulator/SoundAccumulator.channel3Sample
    get_global $core/sound/accumulator/SoundAccumulator.channel4Sample
    call $core/sound/sound/mixChannelSamples
    drop
   end
   get_global $core/sound/sound/Sound.audioQueueIndex
   tee_local $1
   i32.const 1
   i32.shl
   i32.const 588800
   i32.add
   tee_local $0
   get_global $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
   i32.const 2
   i32.add
   i32.store8
   get_local $0
   i32.const 1
   i32.add
   get_global $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
   i32.const 2
   i32.add
   i32.store8
   get_local $1
   i32.const 1
   i32.add
   set_global $core/sound/sound/Sound.audioQueueIndex
   get_global $core/sound/sound/Sound.audioQueueIndex
   get_global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize
   i32.const 2
   i32.div_s
   i32.const 1
   i32.sub
   i32.ge_s
   if
    get_global $core/sound/sound/Sound.audioQueueIndex
    i32.const 1
    i32.sub
    set_global $core/sound/sound/Sound.audioQueueIndex
   end
  end
 )
 (func $core/sound/sound/calculateSound (; 75 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  get_local $0
  call $core/sound/channel1/Channel1.getSample
  set_local $1
  get_local $0
  call $core/sound/channel2/Channel2.getSample
  set_local $2
  get_local $0
  call $core/sound/channel3/Channel3.getSample
  set_local $3
  get_local $0
  call $core/sound/channel4/Channel4.getSample
  set_local $4
  get_local $1
  set_global $core/sound/accumulator/SoundAccumulator.channel1Sample
  get_local $2
  set_global $core/sound/accumulator/SoundAccumulator.channel2Sample
  get_local $3
  set_global $core/sound/accumulator/SoundAccumulator.channel3Sample
  get_local $4
  set_global $core/sound/accumulator/SoundAccumulator.channel4Sample
  get_global $core/sound/sound/Sound.downSampleCycleCounter
  get_global $core/sound/sound/Sound.downSampleCycleMultiplier
  get_local $0
  i32.mul
  i32.add
  set_global $core/sound/sound/Sound.downSampleCycleCounter
  get_global $core/sound/sound/Sound.downSampleCycleCounter
  i32.const 8388608
  i32.const 4194304
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  select
  i32.ge_s
  if
   get_global $core/sound/sound/Sound.downSampleCycleCounter
   i32.const 8388608
   i32.const 4194304
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   select
   i32.sub
   set_global $core/sound/sound/Sound.downSampleCycleCounter
   get_local $1
   get_local $2
   get_local $3
   get_local $4
   call $core/sound/sound/mixChannelSamples
   set_local $0
   get_global $core/sound/sound/Sound.audioQueueIndex
   tee_local $1
   i32.const 1
   i32.shl
   i32.const 588800
   i32.add
   tee_local $2
   get_local $0
   i32.const 65280
   i32.and
   i32.const 8
   i32.shr_s
   i32.const 2
   i32.add
   i32.store8
   get_local $2
   i32.const 1
   i32.add
   get_local $0
   i32.const 255
   i32.and
   i32.const 2
   i32.add
   i32.store8
   get_local $1
   i32.const 1
   i32.add
   set_global $core/sound/sound/Sound.audioQueueIndex
   get_global $core/sound/sound/Sound.audioQueueIndex
   get_global $core/sound/sound/Sound.wasmBoyMemoryMaxBufferSize
   i32.const 2
   i32.div_s
   i32.const 1
   i32.sub
   i32.ge_s
   if
    get_global $core/sound/sound/Sound.audioQueueIndex
    i32.const 1
    i32.sub
    set_global $core/sound/sound/Sound.audioQueueIndex
   end
  end
 )
 (func $core/sound/sound/updateSound (; 76 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_local $0
  call $core/sound/sound/updateFrameSequencer
  set_local $1
  get_local $1
  i32.eqz
  get_global $core/config/Config.audioAccumulateSamples
  get_global $core/config/Config.audioAccumulateSamples
  select
  if
   get_local $0
   call $core/sound/accumulator/accumulateSound
  else   
   get_local $0
   call $core/sound/sound/calculateSound
  end
 )
 (func $core/sound/sound/batchProcessAudio (; 77 ;) (type $v)
  get_global $core/sound/sound/Sound.currentCycles
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  if (result i32)
   i32.const 174
  else   
   i32.const 87
  end
  i32.lt_s
  if
   return
  end
  loop $continue|0
   get_global $core/sound/sound/Sound.currentCycles
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if (result i32)
    i32.const 174
   else    
    i32.const 87
   end
   i32.ge_s
   if
    get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
    if (result i32)
     i32.const 174
    else     
     i32.const 87
    end
    call $core/sound/sound/updateSound
    get_global $core/sound/sound/Sound.currentCycles
    get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
    if (result i32)
     i32.const 174
    else     
     i32.const 87
    end
    i32.sub
    set_global $core/sound/sound/Sound.currentCycles
    br $continue|0
   end
  end
 )
 (func $core/sound/registers/SoundRegisterReadTraps (; 78 ;) (type $ii) (param $0 i32) (result i32)
  get_local $0
  i32.const 65318
  i32.eq
  if
   i32.const 65318
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 128
   i32.and
   set_local $0
   get_local $0
   i32.const 112
   i32.or
   return
  end
  i32.const -1
 )
 (func $core/joypad/joypad/getJoypadState (; 79 ;) (type $i) (result i32)
  (local $0 i32)
  get_global $core/joypad/joypad/Joypad.joypadRegisterFlipped
  set_local $0
  get_global $core/joypad/joypad/Joypad.isDpadType
  if
   get_local $0
   i32.const -5
   i32.and
   get_local $0
   i32.const 4
   i32.or
   get_global $core/joypad/joypad/Joypad.up
   select
   set_local $0
   get_local $0
   i32.const -2
   i32.and
   get_local $0
   i32.const 1
   i32.or
   get_global $core/joypad/joypad/Joypad.right
   select
   set_local $0
   get_local $0
   i32.const -9
   i32.and
   get_local $0
   i32.const 8
   i32.or
   get_global $core/joypad/joypad/Joypad.down
   select
   set_local $0
   get_local $0
   i32.const -3
   i32.and
   get_local $0
   i32.const 2
   i32.or
   get_global $core/joypad/joypad/Joypad.left
   select
   set_local $0
  else   
   get_global $core/joypad/joypad/Joypad.isButtonType
   if
    get_local $0
    i32.const -2
    i32.and
    get_local $0
    i32.const 1
    i32.or
    get_global $core/joypad/joypad/Joypad.a
    select
    set_local $0
    get_local $0
    i32.const -3
    i32.and
    get_local $0
    i32.const 2
    i32.or
    get_global $core/joypad/joypad/Joypad.b
    select
    set_local $0
    get_local $0
    i32.const -5
    i32.and
    get_local $0
    i32.const 4
    i32.or
    get_global $core/joypad/joypad/Joypad.select
    select
    set_local $0
    get_local $0
    i32.const -9
    i32.and
    get_local $0
    i32.const 8
    i32.or
    get_global $core/joypad/joypad/Joypad.start
    select
    set_local $0
   end
  end
  get_local $0
  i32.const 240
  i32.or
 )
 (func $core/memory/readTraps/checkReadTraps (; 80 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  get_local $0
  i32.const 32768
  i32.lt_s
  if
   i32.const -1
   return
  end
  get_local $0
  i32.const 32768
  i32.ge_s
  tee_local $1
  if (result i32)
   get_local $0
   i32.const 40960
   i32.lt_s
  else   
   get_local $1
  end
  if
   i32.const -1
   return
  end
  get_local $0
  i32.const 57344
  i32.ge_s
  tee_local $1
  if (result i32)
   get_local $0
   i32.const 65024
   i32.lt_s
  else   
   get_local $1
  end
  if
   get_local $0
   i32.const -8192
   i32.add
   call $core/memory/load/eightBitLoadFromGBMemory
   return
  end
  get_local $0
  i32.const 65024
  i32.ge_s
  tee_local $1
  if (result i32)
   get_local $0
   i32.const 65183
   i32.le_s
  else   
   get_local $1
  end
  if
   get_global $core/graphics/lcd/Lcd.currentLcdMode
   i32.const 2
   i32.lt_s
   if
    i32.const 255
    return
   end
   i32.const -1
   return
  end
  get_local $0
  i32.const 65357
  i32.eq
  if
   i32.const 255
   set_local $1
   i32.const 65357
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 254
    set_local $1
   end
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.eqz
   if
    get_local $1
    i32.const -129
    i32.and
    set_local $1
   end
   get_local $1
   return
  end
  get_local $0
  i32.const 65348
  i32.eq
  if
   get_local $0
   get_global $core/graphics/graphics/Graphics.scanlineRegister
   call $core/memory/store/eightBitStoreIntoGBMemory
   get_global $core/graphics/graphics/Graphics.scanlineRegister
   return
  end
  get_local $0
  i32.const 65296
  i32.ge_s
  tee_local $1
  if (result i32)
   get_local $0
   i32.const 65318
   i32.le_s
  else   
   get_local $1
  end
  if
   call $core/sound/sound/batchProcessAudio
   get_local $0
   call $core/sound/registers/SoundRegisterReadTraps
   return
  end
  get_local $0
  i32.const 65328
  i32.ge_s
  tee_local $1
  if (result i32)
   get_local $0
   i32.const 65343
   i32.le_s
  else   
   get_local $1
  end
  if
   call $core/sound/sound/batchProcessAudio
   i32.const -1
   return
  end
  get_local $0
  i32.const 65284
  i32.eq
  if
   get_local $0
   get_global $core/timers/timers/Timers.dividerRegister
   i32.const 65280
   i32.and
   i32.const 8
   i32.shr_s
   tee_local $1
   call $core/memory/store/eightBitStoreIntoGBMemory
   get_local $1
   return
  end
  get_local $0
  i32.const 65285
  i32.eq
  if
   get_local $0
   get_global $core/timers/timers/Timers.timerCounter
   call $core/memory/store/eightBitStoreIntoGBMemory
   get_global $core/timers/timers/Timers.timerCounter
   return
  end
  get_local $0
  i32.const 65295
  i32.eq
  if
   get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   i32.const 224
   i32.or
   return
  end
  get_local $0
  i32.const 65280
  i32.eq
  if
   call $core/joypad/joypad/getJoypadState
   return
  end
  i32.const -1
 )
 (func $core/memory/load/eightBitLoadFromGBMemoryWithTraps (; 81 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  get_local $0
  call $core/memory/readTraps/checkReadTraps
  tee_local $1
  i32.const -1
  i32.eq
  if
   get_local $0
   call $core/memory/load/eightBitLoadFromGBMemory
   return
  end
  get_local $1
  i32.const 255
  i32.and
 )
 (func $core/memory/banking/handleBanking (; 82 ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  get_global $core/memory/memory/Memory.isRomOnly
  if
   return
  end
  get_local $0
  i32.const 8191
  i32.le_s
  if
   get_global $core/memory/memory/Memory.isMBC2
   if (result i32)
    get_local $1
    i32.const 16
    i32.and
    i32.eqz
   else    
    get_global $core/memory/memory/Memory.isMBC2
   end
   i32.eqz
   if
    get_local $1
    i32.const 15
    i32.and
    tee_local $2
    if
     get_local $2
     i32.const 10
     i32.eq
     if
      i32.const 1
      set_global $core/memory/memory/Memory.isRamBankingEnabled
     end
    else     
     i32.const 0
     set_global $core/memory/memory/Memory.isRamBankingEnabled
    end
   end
  else   
   get_local $0
   i32.const 16383
   i32.le_s
   if
    get_global $core/memory/memory/Memory.isMBC5
    i32.eqz
    tee_local $2
    if (result i32)
     get_local $2
    else     
     get_local $0
     i32.const 12287
     i32.le_s
    end
    if
     get_global $core/memory/memory/Memory.isMBC2
     if
      get_local $1
      i32.const 15
      i32.and
      set_global $core/memory/memory/Memory.currentRomBank
     end
     get_local $1
     set_local $2
     get_global $core/memory/memory/Memory.isMBC1
     if
      get_local $2
      i32.const 31
      i32.and
      set_local $2
      get_global $core/memory/memory/Memory.currentRomBank
      i32.const 224
      i32.and
      set_global $core/memory/memory/Memory.currentRomBank
     else      
      get_global $core/memory/memory/Memory.isMBC3
      if
       get_local $2
       i32.const 127
       i32.and
       set_local $2
       get_global $core/memory/memory/Memory.currentRomBank
       i32.const 128
       i32.and
       set_global $core/memory/memory/Memory.currentRomBank
      else       
       get_global $core/memory/memory/Memory.isMBC5
       if
        i32.const 0
        set_global $core/memory/memory/Memory.currentRomBank
       end
      end
     end
     get_global $core/memory/memory/Memory.currentRomBank
     get_local $2
     i32.or
     set_global $core/memory/memory/Memory.currentRomBank
    else     
     get_global $core/memory/memory/Memory.currentRomBank
     i32.const 255
     i32.and
     i32.const 1
     i32.const 0
     get_local $1
     i32.const 0
     i32.gt_s
     select
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     set_global $core/memory/memory/Memory.currentRomBank
    end
   else    
    get_global $core/memory/memory/Memory.isMBC2
    i32.eqz
    tee_local $2
    if (result i32)
     get_local $0
     i32.const 24575
     i32.le_s
    else     
     get_local $2
    end
    if
     get_global $core/memory/memory/Memory.isMBC1RomModeEnabled
     get_global $core/memory/memory/Memory.isMBC1
     tee_local $0
     get_local $0
     select
     if
      get_global $core/memory/memory/Memory.currentRomBank
      i32.const 31
      i32.and
      set_global $core/memory/memory/Memory.currentRomBank
      get_global $core/memory/memory/Memory.currentRomBank
      get_local $1
      i32.const 224
      i32.and
      i32.or
      set_global $core/memory/memory/Memory.currentRomBank
      return
     end
     get_local $1
     i32.const 15
     i32.and
     get_local $1
     i32.const 3
     i32.and
     get_global $core/memory/memory/Memory.isMBC5
     select
     set_global $core/memory/memory/Memory.currentRamBank
    else     
     get_global $core/memory/memory/Memory.isMBC2
     i32.eqz
     tee_local $2
     if (result i32)
      get_local $0
      i32.const 32767
      i32.le_s
     else      
      get_local $2
     end
     if
      get_global $core/memory/memory/Memory.isMBC1
      if
       get_local $1
       i32.const 1
       i32.and
       if
        i32.const 1
        set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
       else        
        i32.const 0
        set_global $core/memory/memory/Memory.isMBC1RomModeEnabled
       end
      end
     end
    end
   end
  end
 )
 (func $core/sound/channel1/Channel1.updateNRx2 (; 83 ;) (type $iv) (param $0 i32)
  get_local $0
  i32.const 4
  i32.shr_s
  i32.const 15
  i32.and
  set_global $core/sound/channel1/Channel1.NRx2StartingVolume
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
  get_local $0
  i32.const 7
  i32.and
  set_global $core/sound/channel1/Channel1.NRx2EnvelopePeriod
  get_local $0
  i32.const 248
  i32.and
  i32.const 0
  i32.gt_s
  set_global $core/sound/channel1/Channel1.isDacEnabled
 )
 (func $core/sound/channel2/Channel2.updateNRx2 (; 84 ;) (type $iv) (param $0 i32)
  get_local $0
  i32.const 4
  i32.shr_s
  i32.const 15
  i32.and
  set_global $core/sound/channel2/Channel2.NRx2StartingVolume
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
  get_local $0
  i32.const 7
  i32.and
  set_global $core/sound/channel2/Channel2.NRx2EnvelopePeriod
  get_local $0
  i32.const 248
  i32.and
  i32.const 0
  i32.gt_s
  set_global $core/sound/channel2/Channel2.isDacEnabled
 )
 (func $core/sound/channel4/Channel4.updateNRx2 (; 85 ;) (type $iv) (param $0 i32)
  get_local $0
  i32.const 4
  i32.shr_s
  i32.const 15
  i32.and
  set_global $core/sound/channel4/Channel4.NRx2StartingVolume
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
  get_local $0
  i32.const 7
  i32.and
  set_global $core/sound/channel4/Channel4.NRx2EnvelopePeriod
  get_local $0
  i32.const 248
  i32.and
  i32.const 0
  i32.gt_s
  set_global $core/sound/channel4/Channel4.isDacEnabled
 )
 (func $core/sound/channel4/Channel4.updateNRx3 (; 86 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_local $0
  i32.const 4
  i32.shr_s
  set_global $core/sound/channel4/Channel4.NRx3ClockShift
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/channel4/Channel4.NRx3WidthMode
  get_local $0
  i32.const 7
  i32.and
  set_global $core/sound/channel4/Channel4.NRx3DivisorCode
  block $break|0
   block $case7|0
    block $case6|0
     block $case5|0
      block $case4|0
       block $case3|0
        block $case2|0
         block $case1|0
          get_global $core/sound/channel4/Channel4.NRx3DivisorCode
          tee_local $1
          if
           get_local $1
           i32.const 1
           i32.sub
           br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $break|0
          end
          i32.const 8
          set_global $core/sound/channel4/Channel4.divisor
          return
         end
         i32.const 16
         set_global $core/sound/channel4/Channel4.divisor
         return
        end
        i32.const 32
        set_global $core/sound/channel4/Channel4.divisor
        return
       end
       i32.const 48
       set_global $core/sound/channel4/Channel4.divisor
       return
      end
      i32.const 64
      set_global $core/sound/channel4/Channel4.divisor
      return
     end
     i32.const 80
     set_global $core/sound/channel4/Channel4.divisor
     return
    end
    i32.const 96
    set_global $core/sound/channel4/Channel4.divisor
    return
   end
   i32.const 112
   set_global $core/sound/channel4/Channel4.divisor
  end
 )
 (func $core/sound/channel1/Channel1.trigger (; 87 ;) (type $v)
  (local $0 i32)
  i32.const 1
  set_global $core/sound/channel1/Channel1.isEnabled
  get_global $core/sound/channel1/Channel1.lengthCounter
  i32.eqz
  if
   i32.const 64
   set_global $core/sound/channel1/Channel1.lengthCounter
  end
  i32.const 2048
  get_global $core/sound/channel1/Channel1.frequency
  i32.sub
  i32.const 2
  i32.shl
  set_global $core/sound/channel1/Channel1.frequencyTimer
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  if
   get_global $core/sound/channel1/Channel1.frequencyTimer
   i32.const 1
   i32.shl
   set_global $core/sound/channel1/Channel1.frequencyTimer
  end
  get_global $core/sound/channel1/Channel1.NRx2EnvelopePeriod
  set_global $core/sound/channel1/Channel1.envelopeCounter
  get_global $core/sound/channel1/Channel1.NRx2StartingVolume
  set_global $core/sound/channel1/Channel1.volume
  get_global $core/sound/channel1/Channel1.frequency
  set_global $core/sound/channel1/Channel1.sweepShadowFrequency
  get_global $core/sound/channel1/Channel1.NRx0SweepPeriod
  tee_local $0
  set_global $core/sound/channel1/Channel1.sweepCounter
  get_local $0
  i32.const 0
  i32.gt_s
  tee_local $0
  if (result i32)
   get_global $core/sound/channel1/Channel1.NRx0SweepShift
   i32.const 0
   i32.gt_s
  else   
   get_local $0
  end
  if
   i32.const 1
   set_global $core/sound/channel1/Channel1.isSweepEnabled
  else   
   i32.const 0
   set_global $core/sound/channel1/Channel1.isSweepEnabled
  end
  get_global $core/sound/channel1/Channel1.NRx0SweepShift
  i32.const 0
  i32.gt_s
  if
   call $core/sound/channel1/calculateSweepAndCheckOverflow
  end
  get_global $core/sound/channel1/Channel1.isDacEnabled
  i32.eqz
  if
   i32.const 0
   set_global $core/sound/channel1/Channel1.isEnabled
  end
 )
 (func $core/sound/channel2/Channel2.trigger (; 88 ;) (type $v)
  i32.const 1
  set_global $core/sound/channel2/Channel2.isEnabled
  get_global $core/sound/channel2/Channel2.lengthCounter
  i32.eqz
  if
   i32.const 64
   set_global $core/sound/channel2/Channel2.lengthCounter
  end
  i32.const 2048
  get_global $core/sound/channel2/Channel2.frequency
  i32.sub
  i32.const 2
  i32.shl
  set_global $core/sound/channel2/Channel2.frequencyTimer
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  if
   get_global $core/sound/channel2/Channel2.frequencyTimer
   i32.const 1
   i32.shl
   set_global $core/sound/channel2/Channel2.frequencyTimer
  end
  get_global $core/sound/channel2/Channel2.NRx2EnvelopePeriod
  set_global $core/sound/channel2/Channel2.envelopeCounter
  get_global $core/sound/channel2/Channel2.NRx2StartingVolume
  set_global $core/sound/channel2/Channel2.volume
  get_global $core/sound/channel2/Channel2.isDacEnabled
  i32.eqz
  if
   i32.const 0
   set_global $core/sound/channel2/Channel2.isEnabled
  end
 )
 (func $core/sound/channel3/Channel3.trigger (; 89 ;) (type $v)
  i32.const 1
  set_global $core/sound/channel3/Channel3.isEnabled
  get_global $core/sound/channel3/Channel3.lengthCounter
  i32.eqz
  if
   i32.const 256
   set_global $core/sound/channel3/Channel3.lengthCounter
  end
  i32.const 2048
  get_global $core/sound/channel3/Channel3.frequency
  i32.sub
  i32.const 1
  i32.shl
  set_global $core/sound/channel3/Channel3.frequencyTimer
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  if
   get_global $core/sound/channel3/Channel3.frequencyTimer
   i32.const 1
   i32.shl
   set_global $core/sound/channel3/Channel3.frequencyTimer
  end
  i32.const 0
  set_global $core/sound/channel3/Channel3.waveTablePosition
  get_global $core/sound/channel3/Channel3.isDacEnabled
  i32.eqz
  if
   i32.const 0
   set_global $core/sound/channel3/Channel3.isEnabled
  end
 )
 (func $core/sound/channel4/Channel4.trigger (; 90 ;) (type $v)
  (local $0 i32)
  i32.const 1
  set_global $core/sound/channel4/Channel4.isEnabled
  get_global $core/sound/channel4/Channel4.lengthCounter
  i32.eqz
  if
   i32.const 64
   set_global $core/sound/channel4/Channel4.lengthCounter
  end
  get_global $core/sound/channel4/Channel4.divisor
  get_global $core/sound/channel4/Channel4.NRx3ClockShift
  i32.shl
  tee_local $0
  i32.const 1
  i32.shl
  get_local $0
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  select
  set_global $core/sound/channel4/Channel4.frequencyTimer
  get_global $core/sound/channel4/Channel4.NRx2EnvelopePeriod
  set_global $core/sound/channel4/Channel4.envelopeCounter
  get_global $core/sound/channel4/Channel4.NRx2StartingVolume
  set_global $core/sound/channel4/Channel4.volume
  i32.const 32767
  set_global $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  get_global $core/sound/channel4/Channel4.isDacEnabled
  i32.eqz
  if
   i32.const 0
   set_global $core/sound/channel4/Channel4.isEnabled
  end
 )
 (func $core/sound/sound/Sound.updateNR51 (; 91 ;) (type $iv) (param $0 i32)
  get_local $0
  i32.const 128
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  get_local $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  get_local $0
  i32.const 32
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  get_local $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  get_local $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  get_local $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  get_local $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  get_local $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  set_global $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
 )
 (func $core/sound/registers/SoundRegisterWriteTraps (; 92 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  get_local $0
  i32.const 65318
  i32.ne
  tee_local $2
  if
   get_global $core/sound/sound/Sound.NR52IsSoundEnabled
   i32.eqz
   set_local $2
  end
  get_local $2
  if
   i32.const 0
   return
  end
  block $folding-inner0
   block $break|0
    block $case20|0
     block $case19|0
      block $case18|0
       block $case17|0
        block $case16|0
         block $case15|0
          block $case14|0
           block $case13|0
            block $case12|0
             block $case11|0
              block $case10|0
               block $case9|0
                block $case8|0
                 block $case7|0
                  block $case6|0
                   block $case5|0
                    block $case4|0
                     block $case3|0
                      block $case2|0
                       block $case1|0
                        get_local $0
                        tee_local $2
                        i32.const 65296
                        i32.ne
                        if
                         get_local $2
                         i32.const 65297
                         i32.sub
                         br_table $case2|0 $case6|0 $case10|0 $case14|0 $break|0 $case3|0 $case7|0 $case11|0 $case15|0 $case1|0 $case4|0 $case8|0 $case12|0 $case16|0 $break|0 $case5|0 $case9|0 $case13|0 $case17|0 $case18|0 $case19|0 $case20|0 $break|0
                        end
                        get_local $1
                        i32.const 112
                        i32.and
                        i32.const 4
                        i32.shr_s
                        set_global $core/sound/channel1/Channel1.NRx0SweepPeriod
                        get_local $1
                        i32.const 8
                        i32.and
                        i32.const 0
                        i32.ne
                        set_global $core/sound/channel1/Channel1.NRx0Negate
                        get_local $1
                        i32.const 7
                        i32.and
                        set_global $core/sound/channel1/Channel1.NRx0SweepShift
                        br $folding-inner0
                       end
                       get_local $1
                       i32.const 128
                       i32.and
                       i32.const 0
                       i32.ne
                       set_global $core/sound/channel3/Channel3.isDacEnabled
                       br $folding-inner0
                      end
                      get_local $1
                      i32.const 6
                      i32.shr_s
                      i32.const 3
                      i32.and
                      set_global $core/sound/channel1/Channel1.NRx1Duty
                      get_local $1
                      i32.const 63
                      i32.and
                      set_global $core/sound/channel1/Channel1.NRx1LengthLoad
                      i32.const 64
                      get_global $core/sound/channel1/Channel1.NRx1LengthLoad
                      i32.sub
                      set_global $core/sound/channel1/Channel1.lengthCounter
                      br $folding-inner0
                     end
                     get_local $1
                     i32.const 6
                     i32.shr_s
                     i32.const 3
                     i32.and
                     set_global $core/sound/channel2/Channel2.NRx1Duty
                     get_local $1
                     i32.const 63
                     i32.and
                     set_global $core/sound/channel2/Channel2.NRx1LengthLoad
                     i32.const 64
                     get_global $core/sound/channel2/Channel2.NRx1LengthLoad
                     i32.sub
                     set_global $core/sound/channel2/Channel2.lengthCounter
                     br $folding-inner0
                    end
                    get_local $1
                    set_global $core/sound/channel3/Channel3.NRx1LengthLoad
                    i32.const 256
                    get_global $core/sound/channel3/Channel3.NRx1LengthLoad
                    i32.sub
                    set_global $core/sound/channel3/Channel3.lengthCounter
                    br $folding-inner0
                   end
                   get_local $1
                   i32.const 63
                   i32.and
                   set_global $core/sound/channel4/Channel4.NRx1LengthLoad
                   i32.const 64
                   get_global $core/sound/channel4/Channel4.NRx1LengthLoad
                   i32.sub
                   set_global $core/sound/channel4/Channel4.lengthCounter
                   br $folding-inner0
                  end
                  get_local $1
                  call $core/sound/channel1/Channel1.updateNRx2
                  br $folding-inner0
                 end
                 get_local $1
                 call $core/sound/channel2/Channel2.updateNRx2
                 br $folding-inner0
                end
                i32.const 1
                set_global $core/sound/channel3/Channel3.volumeCodeChanged
                get_local $1
                i32.const 5
                i32.shr_s
                i32.const 15
                i32.and
                set_global $core/sound/channel3/Channel3.NRx2VolumeCode
                br $folding-inner0
               end
               get_local $1
               call $core/sound/channel4/Channel4.updateNRx2
               br $folding-inner0
              end
              get_local $1
              set_global $core/sound/channel1/Channel1.NRx3FrequencyLSB
              get_global $core/sound/channel1/Channel1.NRx3FrequencyLSB
              get_global $core/sound/channel1/Channel1.NRx4FrequencyMSB
              i32.const 8
              i32.shl
              i32.or
              set_global $core/sound/channel1/Channel1.frequency
              br $folding-inner0
             end
             get_local $1
             set_global $core/sound/channel2/Channel2.NRx3FrequencyLSB
             get_global $core/sound/channel2/Channel2.NRx3FrequencyLSB
             get_global $core/sound/channel2/Channel2.NRx4FrequencyMSB
             i32.const 8
             i32.shl
             i32.or
             set_global $core/sound/channel2/Channel2.frequency
             br $folding-inner0
            end
            get_local $1
            set_global $core/sound/channel3/Channel3.NRx3FrequencyLSB
            get_global $core/sound/channel3/Channel3.NRx3FrequencyLSB
            get_global $core/sound/channel3/Channel3.NRx4FrequencyMSB
            i32.const 8
            i32.shl
            i32.or
            set_global $core/sound/channel3/Channel3.frequency
            br $folding-inner0
           end
           get_local $1
           call $core/sound/channel4/Channel4.updateNRx3
           br $folding-inner0
          end
          get_local $1
          i32.const 128
          i32.and
          if
           get_local $1
           i32.const 64
           i32.and
           i32.const 0
           i32.ne
           set_global $core/sound/channel1/Channel1.NRx4LengthEnabled
           get_local $1
           i32.const 7
           i32.and
           set_global $core/sound/channel1/Channel1.NRx4FrequencyMSB
           get_global $core/sound/channel1/Channel1.NRx3FrequencyLSB
           get_global $core/sound/channel1/Channel1.NRx4FrequencyMSB
           i32.const 8
           i32.shl
           i32.or
           set_global $core/sound/channel1/Channel1.frequency
           call $core/sound/channel1/Channel1.trigger
          end
          br $folding-inner0
         end
         get_local $1
         i32.const 128
         i32.and
         if
          get_local $1
          i32.const 64
          i32.and
          i32.const 0
          i32.ne
          set_global $core/sound/channel2/Channel2.NRx4LengthEnabled
          get_local $1
          i32.const 7
          i32.and
          set_global $core/sound/channel2/Channel2.NRx4FrequencyMSB
          get_global $core/sound/channel2/Channel2.NRx3FrequencyLSB
          get_global $core/sound/channel2/Channel2.NRx4FrequencyMSB
          i32.const 8
          i32.shl
          i32.or
          set_global $core/sound/channel2/Channel2.frequency
          call $core/sound/channel2/Channel2.trigger
         end
         br $folding-inner0
        end
        get_local $1
        i32.const 128
        i32.and
        if
         get_local $1
         i32.const 64
         i32.and
         i32.const 0
         i32.ne
         set_global $core/sound/channel3/Channel3.NRx4LengthEnabled
         get_local $1
         i32.const 7
         i32.and
         set_global $core/sound/channel3/Channel3.NRx4FrequencyMSB
         get_global $core/sound/channel3/Channel3.NRx3FrequencyLSB
         get_global $core/sound/channel3/Channel3.NRx4FrequencyMSB
         i32.const 8
         i32.shl
         i32.or
         set_global $core/sound/channel3/Channel3.frequency
         call $core/sound/channel3/Channel3.trigger
        end
        br $folding-inner0
       end
       get_local $1
       i32.const 128
       i32.and
       if
        get_local $1
        i32.const 64
        i32.and
        i32.const 0
        i32.ne
        set_global $core/sound/channel4/Channel4.NRx4LengthEnabled
        call $core/sound/channel4/Channel4.trigger
       end
       br $folding-inner0
      end
      get_local $1
      i32.const 4
      i32.shr_s
      i32.const 7
      i32.and
      set_global $core/sound/sound/Sound.NR50LeftMixerVolume
      get_local $1
      i32.const 7
      i32.and
      set_global $core/sound/sound/Sound.NR50RightMixerVolume
      i32.const 1
      set_global $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
      br $folding-inner0
     end
     get_local $1
     call $core/sound/sound/Sound.updateNR51
     i32.const 1
     set_global $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
     br $folding-inner0
    end
    get_local $1
    i32.const 128
    i32.and
    i32.const 0
    i32.ne
    set_global $core/sound/sound/Sound.NR52IsSoundEnabled
    get_local $1
    i32.const 128
    i32.and
    i32.eqz
    if
     block $break|1
      i32.const 65296
      set_local $2
      loop $repeat|1
       get_local $2
       i32.const 65318
       i32.ge_s
       br_if $break|1
       get_local $2
       i32.const 0
       call $core/memory/store/eightBitStoreIntoGBMemory
       get_local $2
       i32.const 1
       i32.add
       set_local $2
       br $repeat|1
       unreachable
      end
      unreachable
     end
    end
    br $folding-inner0
   end
   i32.const 1
   return
  end
  i32.const 1
 )
 (func $core/memory/dma/startDmaTransfer (; 93 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_local $0
  i32.const 8
  i32.shl
  set_local $1
  i32.const 0
  set_local $0
  loop $repeat|0
   block $break|0
    get_local $0
    i32.const 159
    i32.gt_s
    br_if $break|0
    get_local $0
    i32.const 65024
    i32.add
    get_local $0
    get_local $1
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemory
    call $core/memory/store/eightBitStoreIntoGBMemory
    get_local $0
    i32.const 1
    i32.add
    set_local $0
    br $repeat|0
   end
  end
  i32.const 644
  set_global $core/memory/memory/Memory.DMACycles
 )
 (func $core/memory/dma/getHdmaSourceFromMemory (; 94 ;) (type $i) (result i32)
  (local $0 i32)
  get_global $core/memory/memory/Memory.memoryLocationHdmaSourceHigh
  call $core/memory/load/eightBitLoadFromGBMemory
  set_local $0
  get_global $core/memory/memory/Memory.memoryLocationHdmaSourceLow
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 255
  i32.and
  get_local $0
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
  i32.const 65520
  i32.and
 )
 (func $core/memory/dma/getHdmaDestinationFromMemory (; 95 ;) (type $i) (result i32)
  (local $0 i32)
  get_global $core/memory/memory/Memory.memoryLocationHdmaDestinationHigh
  call $core/memory/load/eightBitLoadFromGBMemory
  set_local $0
  get_global $core/memory/memory/Memory.memoryLocationHdmaDestinationLow
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 255
  i32.and
  get_local $0
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
  i32.const 8176
  i32.and
  i32.const 32768
  i32.add
 )
 (func $core/memory/dma/startHdmaTransfer (; 96 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  get_global $core/cpu/cpu/Cpu.GBCEnabled
  i32.eqz
  if
   return
  end
  get_local $0
  i32.const 128
  i32.and
  i32.eqz
  get_global $core/memory/memory/Memory.isHblankHdmaActive
  get_global $core/memory/memory/Memory.isHblankHdmaActive
  select
  if
   i32.const 0
   set_global $core/memory/memory/Memory.isHblankHdmaActive
   get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 128
   i32.or
   set_local $0
   get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger
   get_local $0
   call $core/memory/store/eightBitStoreIntoGBMemory
   return
  end
  call $core/memory/dma/getHdmaSourceFromMemory
  set_local $1
  call $core/memory/dma/getHdmaDestinationFromMemory
  set_local $2
  get_local $0
  i32.const -129
  i32.and
  i32.const 1
  i32.add
  i32.const 4
  i32.shl
  set_local $3
  get_local $0
  i32.const 128
  i32.and
  if
   i32.const 1
   set_global $core/memory/memory/Memory.isHblankHdmaActive
   get_local $3
   set_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
   get_local $1
   set_global $core/memory/memory/Memory.hblankHdmaSource
   get_local $2
   set_global $core/memory/memory/Memory.hblankHdmaDestination
   get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger
   get_local $0
   i32.const -129
   i32.and
   call $core/memory/store/eightBitStoreIntoGBMemory
  else   
   get_local $1
   get_local $2
   get_local $3
   call $core/memory/dma/hdmaTransfer
   get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/graphics/palette/writeColorPaletteToMemory (; 97 ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  get_global $core/graphics/palette/Palette.memoryLocationBackgroundPaletteData
  get_local $0
  i32.eq
  tee_local $2
  i32.eqz
  if
   get_global $core/graphics/palette/Palette.memoryLocationSpritePaletteData
   get_local $0
   i32.eq
   set_local $2
  end
  get_local $2
  if
   get_local $0
   i32.const 1
   i32.sub
   tee_local $3
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const -65
   i32.and
   tee_local $2
   i32.const 63
   i32.and
   tee_local $4
   i32.const -64
   i32.sub
   get_local $4
   i32.const 1
   i32.const 0
   get_global $core/graphics/palette/Palette.memoryLocationSpritePaletteData
   get_local $0
   i32.eq
   select
   select
   i32.const 67584
   i32.add
   get_local $1
   i32.store8
   get_local $2
   i32.const 128
   i32.and
   if
    get_local $3
    get_local $2
    i32.const 1
    i32.add
    i32.const 128
    i32.or
    call $core/memory/store/eightBitStoreIntoGBMemory
   end
  end
 )
 (func $core/timers/timers/_getTimerCounterMaskBit (; 98 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      get_local $0
      if
       get_local $0
       tee_local $1
       i32.const 1
       i32.eq
       br_if $case1|0
       get_local $1
       i32.const 2
       i32.eq
       br_if $case2|0
       get_local $1
       i32.const 3
       i32.eq
       br_if $case3|0
       br $break|0
      end
      i32.const 9
      return
     end
     i32.const 3
     return
    end
    i32.const 5
    return
   end
   i32.const 7
   return
  end
  i32.const 0
 )
 (func $core/timers/timers/_checkDividerRegisterFallingEdgeDetector (; 99 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  i32.const 1
  get_global $core/timers/timers/Timers.timerInputClock
  call $core/timers/timers/_getTimerCounterMaskBit
  tee_local $2
  i32.shl
  get_local $0
  i32.and
  i32.const 0
  i32.ne
  tee_local $0
  if (result i32)
   i32.const 1
   get_local $2
   i32.shl
   get_local $1
   i32.and
   i32.eqz
  else   
   get_local $0
  end
  if
   i32.const 1
   return
  end
  i32.const 0
 )
 (func $core/timers/timers/updateTimers (; 100 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  loop $continue|0
   get_local $1
   get_local $0
   i32.lt_s
   if
    get_local $1
    i32.const 4
    i32.add
    set_local $1
    get_global $core/timers/timers/Timers.dividerRegister
    tee_local $2
    i32.const 4
    i32.add
    set_global $core/timers/timers/Timers.dividerRegister
    get_global $core/timers/timers/Timers.dividerRegister
    i32.const 65535
    i32.gt_s
    if
     get_global $core/timers/timers/Timers.dividerRegister
     i32.const 65536
     i32.sub
     set_global $core/timers/timers/Timers.dividerRegister
    end
    get_global $core/timers/timers/Timers.timerEnabled
    if
     get_global $core/timers/timers/Timers.timerCounterOverflowDelay
     if
      get_global $core/timers/timers/Timers.timerModulo
      set_global $core/timers/timers/Timers.timerCounter
      i32.const 1
      set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
      i32.const 2
      call $core/interrupts/interrupts/_requestInterrupt
      i32.const 0
      set_global $core/timers/timers/Timers.timerCounterOverflowDelay
      i32.const 1
      set_global $core/timers/timers/Timers.timerCounterWasReset
     else      
      get_global $core/timers/timers/Timers.timerCounterWasReset
      if
       i32.const 0
       set_global $core/timers/timers/Timers.timerCounterWasReset
      end
     end
     get_local $2
     get_global $core/timers/timers/Timers.dividerRegister
     call $core/timers/timers/_checkDividerRegisterFallingEdgeDetector
     if
      get_global $core/timers/timers/Timers.timerCounter
      i32.const 1
      i32.add
      set_global $core/timers/timers/Timers.timerCounter
      get_global $core/timers/timers/Timers.timerCounter
      i32.const 255
      i32.gt_s
      if
       i32.const 1
       set_global $core/timers/timers/Timers.timerCounterOverflowDelay
       i32.const 0
       set_global $core/timers/timers/Timers.timerCounter
      end
     end
    end
    br $continue|0
   end
  end
 )
 (func $core/timers/timers/batchProcessTimers (; 101 ;) (type $v)
  get_global $core/timers/timers/Timers.currentCycles
  call $core/timers/timers/updateTimers
  i32.const 0
  set_global $core/timers/timers/Timers.currentCycles
 )
 (func $core/timers/timers/Timers.updateDividerRegister (; 102 ;) (type $FUNCSIG$v)
  (local $0 i32)
  get_global $core/timers/timers/Timers.dividerRegister
  set_local $0
  i32.const 0
  set_global $core/timers/timers/Timers.dividerRegister
  i32.const 65284
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  get_global $core/timers/timers/Timers.timerEnabled
  if (result i32)
   get_local $0
   get_global $core/timers/timers/Timers.dividerRegister
   call $core/timers/timers/_checkDividerRegisterFallingEdgeDetector
  else   
   get_global $core/timers/timers/Timers.timerEnabled
  end
  if
   get_global $core/timers/timers/Timers.timerCounter
   i32.const 1
   i32.add
   set_global $core/timers/timers/Timers.timerCounter
   get_global $core/timers/timers/Timers.timerCounter
   i32.const 255
   i32.gt_s
   if
    i32.const 1
    set_global $core/timers/timers/Timers.timerCounterOverflowDelay
    i32.const 0
    set_global $core/timers/timers/Timers.timerCounter
   end
  end
 )
 (func $core/timers/timers/Timers.updateTimerControl (; 103 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  get_global $core/timers/timers/Timers.timerEnabled
  set_local $1
  get_local $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  set_global $core/timers/timers/Timers.timerEnabled
  get_local $0
  i32.const 3
  i32.and
  set_local $2
  get_local $1
  i32.eqz
  if
   get_global $core/timers/timers/Timers.timerInputClock
   call $core/timers/timers/_getTimerCounterMaskBit
   set_local $0
   get_local $2
   call $core/timers/timers/_getTimerCounterMaskBit
   set_local $1
   get_global $core/timers/timers/Timers.timerEnabled
   if (result i32)
    get_global $core/timers/timers/Timers.dividerRegister
    i32.const 1
    get_local $0
    i32.shl
    i32.and
   else    
    get_global $core/timers/timers/Timers.dividerRegister
    i32.const 1
    get_local $0
    i32.shl
    i32.and
    i32.const 0
    i32.ne
    tee_local $0
    if (result i32)
     get_global $core/timers/timers/Timers.dividerRegister
     i32.const 1
     get_local $1
     i32.shl
     i32.and
    else     
     get_local $0
    end
   end
   if
    get_global $core/timers/timers/Timers.timerCounter
    i32.const 1
    i32.add
    set_global $core/timers/timers/Timers.timerCounter
    get_global $core/timers/timers/Timers.timerCounter
    i32.const 255
    i32.gt_s
    if
     i32.const 1
     set_global $core/timers/timers/Timers.timerCounterOverflowDelay
     i32.const 0
     set_global $core/timers/timers/Timers.timerCounter
    end
   end
  end
  get_local $2
  set_global $core/timers/timers/Timers.timerInputClock
 )
 (func $core/memory/writeTraps/checkWriteTraps (; 104 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  block $folding-inner1
   block $folding-inner0
    get_local $0
    i32.const 65357
    i32.eq
    if
     i32.const 65357
     get_local $1
     i32.const 1
     i32.and
     call $core/memory/store/eightBitStoreIntoGBMemory
     br $folding-inner0
    end
    get_local $0
    i32.const 32768
    i32.lt_s
    if
     get_local $0
     get_local $1
     call $core/memory/banking/handleBanking
     br $folding-inner0
    end
    get_local $0
    i32.const 32768
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 40960
     i32.lt_s
     set_local $2
    end
    get_local $2
    br_if $folding-inner1
    get_local $0
    i32.const 57344
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 65024
     i32.lt_s
     set_local $2
    end
    get_local $2
    if
     get_local $0
     i32.const -8192
     i32.add
     get_local $1
     call $core/memory/store/eightBitStoreIntoGBMemory
     br $folding-inner1
    end
    get_local $0
    i32.const 65024
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 65183
     i32.le_s
     set_local $2
    end
    get_local $2
    if
     get_global $core/graphics/lcd/Lcd.currentLcdMode
     i32.const 2
     i32.lt_s
     br_if $folding-inner0
     br $folding-inner1
    end
    get_local $0
    i32.const 65184
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 65279
     i32.le_s
     set_local $2
    end
    get_local $2
    br_if $folding-inner0
    get_local $0
    i32.const 65282
    i32.eq
    if
     get_local $1
     i32.const 1
     i32.and
     i32.const 0
     i32.ne
     set_global $core/serial/serial/Serial.isShiftClockInternal
     get_local $1
     i32.const 2
     i32.and
     i32.const 0
     i32.ne
     set_global $core/serial/serial/Serial.isClockSpeedFast
     get_local $1
     i32.const 128
     i32.and
     i32.const 0
     i32.ne
     set_global $core/serial/serial/Serial.transferStartFlag
     i32.const 1
     return
    end
    get_local $0
    i32.const 65296
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 65318
     i32.le_s
     set_local $2
    end
    get_local $2
    if
     call $core/sound/sound/batchProcessAudio
     get_local $0
     get_local $1
     call $core/sound/registers/SoundRegisterWriteTraps
     return
    end
    get_local $0
    i32.const 65328
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 65343
     i32.le_s
     set_local $2
    end
    get_local $2
    if
     call $core/sound/sound/batchProcessAudio
    end
    get_local $0
    i32.const 65344
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 65355
     i32.le_s
     set_local $2
    end
    get_local $2
    if
     get_local $0
     i32.const 65344
     i32.eq
     if
      get_local $1
      call $core/graphics/lcd/Lcd.updateLcdControl
      br $folding-inner1
     end
     get_local $0
     i32.const 65345
     i32.eq
     if
      i32.const 65345
      get_local $1
      i32.const 248
      i32.and
      i32.const 65345
      call $core/memory/load/eightBitLoadFromGBMemory
      i32.const 7
      i32.and
      i32.or
      i32.const 128
      i32.or
      call $core/memory/store/eightBitStoreIntoGBMemory
      br $folding-inner0
     end
     get_local $0
     i32.const 65348
     i32.eq
     if
      i32.const 0
      set_global $core/graphics/graphics/Graphics.scanlineRegister
      get_local $0
      i32.const 0
      call $core/memory/store/eightBitStoreIntoGBMemory
      br $folding-inner0
     end
     get_local $0
     i32.const 65349
     i32.eq
     if
      get_local $1
      set_global $core/graphics/lcd/Lcd.coincidenceCompare
      br $folding-inner1
     end
     get_local $0
     i32.const 65350
     i32.eq
     if
      get_local $1
      call $core/memory/dma/startDmaTransfer
      br $folding-inner1
     end
     block $break|0
      block $case3|0
       block $case2|0
        block $case1|0
         get_local $0
         tee_local $2
         i32.const 65347
         i32.ne
         if
          get_local $2
          i32.const 65346
          i32.sub
          br_table $case1|0 $break|0 $break|0 $break|0 $break|0 $break|0 $break|0 $break|0 $case3|0 $case2|0 $break|0
         end
         get_local $1
         set_global $core/graphics/graphics/Graphics.scrollX
         br $folding-inner1
        end
        get_local $1
        set_global $core/graphics/graphics/Graphics.scrollY
        br $folding-inner1
       end
       get_local $1
       set_global $core/graphics/graphics/Graphics.windowX
       br $folding-inner1
      end
      get_local $1
      set_global $core/graphics/graphics/Graphics.windowY
      br $folding-inner1
     end
     br $folding-inner1
    end
    get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger
    get_local $0
    i32.eq
    if
     get_local $1
     call $core/memory/dma/startHdmaTransfer
     br $folding-inner0
    end
    get_global $core/memory/memory/Memory.memoryLocationGBCWRAMBank
    get_local $0
    i32.eq
    tee_local $2
    i32.eqz
    if
     get_global $core/memory/memory/Memory.memoryLocationGBCVRAMBank
     get_local $0
     i32.eq
     set_local $2
    end
    get_local $2
    if
     get_global $core/memory/memory/Memory.isHblankHdmaActive
     if
      block (result i32)
       get_global $core/memory/memory/Memory.hblankHdmaSource
       i32.const 16384
       i32.ge_s
       tee_local $2
       if
        get_global $core/memory/memory/Memory.hblankHdmaSource
        i32.const 32767
        i32.le_s
        set_local $2
       end
       get_local $2
       i32.eqz
      end
      if
       get_global $core/memory/memory/Memory.hblankHdmaSource
       i32.const 53248
       i32.ge_s
       tee_local $2
       if
        get_global $core/memory/memory/Memory.hblankHdmaSource
        i32.const 57343
        i32.le_s
        set_local $2
       end
      end
      get_local $2
      br_if $folding-inner0
     end
    end
    get_local $0
    get_global $core/graphics/palette/Palette.memoryLocationBackgroundPaletteIndex
    i32.ge_s
    tee_local $2
    if
     get_local $0
     get_global $core/graphics/palette/Palette.memoryLocationSpritePaletteData
     i32.le_s
     set_local $2
    end
    get_local $2
    if
     get_local $0
     get_local $1
     call $core/graphics/palette/writeColorPaletteToMemory
     br $folding-inner1
    end
    get_local $0
    i32.const 65284
    i32.ge_s
    tee_local $2
    if
     get_local $0
     i32.const 65287
     i32.le_s
     set_local $2
    end
    get_local $2
    if
     call $core/timers/timers/batchProcessTimers
     block $break|1
      block $case3|1
       block $case2|1
        block $case1|1
         get_local $0
         tee_local $2
         i32.const 65284
         i32.ne
         if
          get_local $2
          i32.const 65285
          i32.sub
          br_table $case1|1 $case2|1 $case3|1 $break|1
         end
         call $core/timers/timers/Timers.updateDividerRegister
         br $folding-inner0
        end
        block $__inlined_func$core/timers/timers/Timers.updateTimerCounter
         get_global $core/timers/timers/Timers.timerEnabled
         if
          get_global $core/timers/timers/Timers.timerCounterWasReset
          br_if $__inlined_func$core/timers/timers/Timers.updateTimerCounter
          get_global $core/timers/timers/Timers.timerCounterOverflowDelay
          if
           i32.const 0
           set_global $core/timers/timers/Timers.timerCounterOverflowDelay
          end
         end
         get_local $1
         set_global $core/timers/timers/Timers.timerCounter
        end
        br $folding-inner1
       end
       get_local $1
       set_global $core/timers/timers/Timers.timerModulo
       get_global $core/timers/timers/Timers.timerCounterWasReset
       get_global $core/timers/timers/Timers.timerEnabled
       tee_local $0
       get_local $0
       select
       if
        get_global $core/timers/timers/Timers.timerModulo
        set_global $core/timers/timers/Timers.timerCounter
        i32.const 0
        set_global $core/timers/timers/Timers.timerCounterWasReset
       end
       br $folding-inner1
      end
      get_local $1
      call $core/timers/timers/Timers.updateTimerControl
      br $folding-inner1
     end
     br $folding-inner1
    end
    get_local $0
    i32.const 65280
    i32.eq
    if
     get_local $1
     i32.const 255
     i32.xor
     set_global $core/joypad/joypad/Joypad.joypadRegisterFlipped
     get_global $core/joypad/joypad/Joypad.joypadRegisterFlipped
     tee_local $2
     i32.const 16
     i32.and
     i32.const 0
     i32.ne
     set_global $core/joypad/joypad/Joypad.isDpadType
     get_local $2
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     set_global $core/joypad/joypad/Joypad.isButtonType
    end
    get_local $0
    i32.const 65295
    i32.eq
    if
     get_local $1
     call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
     br $folding-inner1
    end
    get_local $0
    i32.const 65535
    i32.eq
    if
     get_local $1
     call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
     br $folding-inner1
    end
    i32.const 1
    return
   end
   i32.const 0
   return
  end
  i32.const 1
 )
 (func $core/memory/store/eightBitStoreIntoGBMemoryWithTraps (; 105 ;) (type $iiv) (param $0 i32) (param $1 i32)
  get_local $0
  get_local $1
  call $core/memory/writeTraps/checkWriteTraps
  if
   get_local $0
   get_local $1
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/memory/dma/hdmaTransfer (; 106 ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  loop $repeat|0
   block $break|0
    get_local $3
    get_local $2
    i32.ge_s
    br_if $break|0
    get_local $0
    get_local $3
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
    set_local $5
    get_local $1
    get_local $3
    i32.add
    set_local $4
    loop $continue|1
     get_local $4
     i32.const 40959
     i32.gt_s
     if
      get_local $4
      i32.const -8192
      i32.add
      set_local $4
      br $continue|1
     end
    end
    get_local $4
    get_local $5
    call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
    get_local $3
    i32.const 1
    i32.add
    set_local $3
    br $repeat|0
   end
  end
  i32.const 32
  set_local $3
  get_global $core/memory/memory/Memory.DMACycles
  get_local $2
  i32.const 16
  i32.div_s
  i32.const 64
  i32.const 32
  get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
  select
  i32.mul
  i32.add
  set_global $core/memory/memory/Memory.DMACycles
 )
 (func $core/memory/dma/updateHblankHdma (; 107 ;) (type $v)
  (local $0 i32)
  get_global $core/memory/memory/Memory.isHblankHdmaActive
  i32.eqz
  if
   return
  end
  get_global $core/memory/memory/Memory.hblankHdmaSource
  get_global $core/memory/memory/Memory.hblankHdmaDestination
  get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  tee_local $0
  i32.const 16
  get_local $0
  i32.const 16
  i32.lt_s
  select
  tee_local $0
  call $core/memory/dma/hdmaTransfer
  get_global $core/memory/memory/Memory.hblankHdmaSource
  get_local $0
  i32.add
  set_global $core/memory/memory/Memory.hblankHdmaSource
  get_global $core/memory/memory/Memory.hblankHdmaDestination
  get_local $0
  i32.add
  set_global $core/memory/memory/Memory.hblankHdmaDestination
  get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  get_local $0
  i32.sub
  set_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  i32.const 0
  i32.le_s
  if
   i32.const 0
   set_global $core/memory/memory/Memory.isHblankHdmaActive
   get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
  else   
   get_global $core/memory/memory/Memory.memoryLocationHdmaTrigger
   get_global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
   i32.const 16
   i32.div_s
   i32.const 1
   i32.sub
   i32.const -129
   i32.and
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/graphics/lcd/checkCoincidence (; 108 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  get_global $core/graphics/lcd/Lcd.coincidenceCompare
  set_local $3
  block (result i32)
   get_local $0
   i32.eqz
   tee_local $2
   i32.eqz
   if
    get_local $0
    i32.const 1
    i32.eq
    set_local $2
   end
   get_local $2
  end
  if (result i32)
   get_global $core/graphics/graphics/Graphics.scanlineRegister
   get_local $3
   i32.eq
  else   
   get_local $2
  end
  if
   get_local $1
   i32.const 4
   i32.or
   tee_local $1
   i32.const 64
   i32.and
   if
    call $core/interrupts/interrupts/requestLcdInterrupt
   end
  else   
   get_local $1
   i32.const -5
   i32.and
   set_local $1
  end
  get_local $1
 )
 (func $core/graphics/lcd/setLcdStatus (; 109 ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  get_global $core/graphics/lcd/Lcd.enabled
  i32.eqz
  if
   return
  end
  get_global $core/graphics/lcd/Lcd.currentLcdMode
  set_local $0
  get_local $0
  get_global $core/graphics/graphics/Graphics.scanlineRegister
  tee_local $2
  i32.const 144
  i32.ge_s
  if (result i32)
   i32.const 1
  else   
   get_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if (result i32)
    i32.const 752
   else    
    i32.const 376
   end
   i32.ge_s
   if (result i32)
    i32.const 2
   else    
    i32.const 3
    i32.const 0
    get_global $core/graphics/graphics/Graphics.scanlineCycleCounter
    get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
    if (result i32)
     i32.const 498
    else     
     i32.const 249
    end
    i32.ge_s
    select
   end
  end
  tee_local $1
  i32.ne
  if
   i32.const 65345
   call $core/memory/load/eightBitLoadFromGBMemory
   set_local $0
   get_local $1
   set_global $core/graphics/lcd/Lcd.currentLcdMode
   i32.const 0
   set_local $2
   block $break|0
    block $case3|0
     block $case2|0
      block $case1|0
       get_local $1
       if
        get_local $1
        i32.const 1
        i32.sub
        br_table $case1|0 $case2|0 $case3|0 $break|0
       end
       get_local $0
       i32.const -4
       i32.and
       tee_local $0
       i32.const 8
       i32.and
       i32.const 0
       i32.ne
       set_local $2
       br $break|0
      end
      get_local $0
      i32.const -3
      i32.and
      i32.const 1
      i32.or
      tee_local $0
      i32.const 16
      i32.and
      i32.const 0
      i32.ne
      set_local $2
      br $break|0
     end
     get_local $0
     i32.const -2
     i32.and
     i32.const 2
     i32.or
     tee_local $0
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     set_local $2
     br $break|0
    end
    get_local $0
    i32.const 3
    i32.or
    set_local $0
   end
   get_local $2
   if
    call $core/interrupts/interrupts/requestLcdInterrupt
   end
   get_local $1
   i32.eqz
   if
    call $core/memory/dma/updateHblankHdma
   end
   get_local $1
   i32.const 1
   i32.eq
   if
    i32.const 1
    set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
    i32.const 0
    call $core/interrupts/interrupts/_requestInterrupt
   end
   i32.const 65345
   get_local $1
   get_local $0
   call $core/graphics/lcd/checkCoincidence
   call $core/memory/store/eightBitStoreIntoGBMemory
  else   
   get_local $2
   i32.const 153
   i32.eq
   if
    i32.const 65345
    get_local $1
    i32.const 65345
    call $core/memory/load/eightBitLoadFromGBMemory
    call $core/graphics/lcd/checkCoincidence
    call $core/memory/store/eightBitStoreIntoGBMemory
   end
  end
 )
 (func $core/graphics/graphics/updateGraphics (; 110 ;) (type $iv) (param $0 i32)
  get_global $core/graphics/lcd/Lcd.enabled
  if
   get_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   get_local $0
   i32.add
   set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
   loop $continue|0
    get_global $core/graphics/graphics/Graphics.scanlineCycleCounter
    block $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE (result i32)
     get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
     if
      i32.const 8
      get_global $core/graphics/graphics/Graphics.scanlineRegister
      i32.const 153
      i32.eq
      br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE
      drop
      i32.const 912
      br $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE
     end
     i32.const 4
     get_global $core/graphics/graphics/Graphics.scanlineRegister
     i32.const 153
     i32.eq
     br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE
     drop
     i32.const 456
    end
    i32.ge_s
    if
     get_global $core/graphics/graphics/Graphics.scanlineCycleCounter
     block $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE0 (result i32)
      get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
      if
       i32.const 8
       get_global $core/graphics/graphics/Graphics.scanlineRegister
       i32.const 153
       i32.eq
       br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE0
       drop
       i32.const 912
       br $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE0
      end
      i32.const 4
      get_global $core/graphics/graphics/Graphics.scanlineRegister
      i32.const 153
      i32.eq
      br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE0
      drop
      i32.const 456
     end
     i32.sub
     set_global $core/graphics/graphics/Graphics.scanlineCycleCounter
     get_global $core/graphics/graphics/Graphics.scanlineRegister
     tee_local $0
     i32.const 144
     i32.eq
     if
      get_global $core/config/Config.graphicsDisableScanlineRendering
      if
       call $core/graphics/graphics/_renderEntireFrame
      else       
       get_local $0
       call $core/graphics/graphics/_drawScanline
      end
      call $core/graphics/priority/clearPriorityMap
      i32.const -1
      set_global $core/graphics/tiles/TileCache.tileId
      i32.const -1
      set_global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
     else      
      get_local $0
      i32.const 144
      i32.lt_s
      if
       get_global $core/config/Config.graphicsDisableScanlineRendering
       i32.eqz
       if
        get_local $0
        call $core/graphics/graphics/_drawScanline
       end
      end
     end
     i32.const 0
     get_local $0
     i32.const 1
     i32.add
     get_local $0
     i32.const 153
     i32.gt_s
     select
     set_global $core/graphics/graphics/Graphics.scanlineRegister
     br $continue|0
    end
   end
  end
  call $core/graphics/lcd/setLcdStatus
 )
 (func $core/graphics/graphics/batchProcessGraphics (; 111 ;) (type $v)
  get_global $core/graphics/graphics/Graphics.currentCycles
  block $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE (result i32)
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if
    i32.const 8
    get_global $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 153
    i32.eq
    br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE
    drop
    i32.const 912
    br $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE
   end
   i32.const 4
   get_global $core/graphics/graphics/Graphics.scanlineRegister
   i32.const 153
   i32.eq
   br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE
   drop
   i32.const 456
  end
  i32.lt_s
  if
   return
  end
  loop $continue|0
   get_global $core/graphics/graphics/Graphics.currentCycles
   block $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE1 (result i32)
    get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
    if
     i32.const 8
     get_global $core/graphics/graphics/Graphics.scanlineRegister
     i32.const 153
     i32.eq
     br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE1
     drop
     i32.const 912
     br $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE1
    end
    i32.const 4
    get_global $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 153
    i32.eq
    br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE1
    drop
    i32.const 456
   end
   i32.ge_s
   if
    block $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE3 (result i32)
     get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
     if
      i32.const 8
      get_global $core/graphics/graphics/Graphics.scanlineRegister
      i32.const 153
      i32.eq
      br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE3
      drop
      i32.const 912
      br $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE3
     end
     i32.const 4
     get_global $core/graphics/graphics/Graphics.scanlineRegister
     i32.const 153
     i32.eq
     br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE3
     drop
     i32.const 456
    end
    call $core/graphics/graphics/updateGraphics
    get_global $core/graphics/graphics/Graphics.currentCycles
    block $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE5 (result i32)
     get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
     if
      i32.const 8
      get_global $core/graphics/graphics/Graphics.scanlineRegister
      i32.const 153
      i32.eq
      br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE5
      drop
      i32.const 912
      br $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE5
     end
     i32.const 4
     get_global $core/graphics/graphics/Graphics.scanlineRegister
     i32.const 153
     i32.eq
     br_if $__inlined_func$core/graphics/graphics/Graphics.MAX_CYCLES_PER_SCANLINE5
     drop
     i32.const 456
    end
    i32.sub
    set_global $core/graphics/graphics/Graphics.currentCycles
    br $continue|0
   end
  end
 )
 (func $core/serial/serial/_checkFallingEdgeDetector (; 112 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  i32.const 1
  get_global $core/serial/serial/Serial.isClockSpeedFast
  if (result i32)
   i32.const 2
  else   
   i32.const 7
  end
  tee_local $2
  i32.shl
  get_local $0
  i32.and
  i32.const 0
  i32.ne
  tee_local $0
  if (result i32)
   i32.const 1
   get_local $2
   i32.shl
   get_local $1
   i32.and
   i32.eqz
  else   
   get_local $0
  end
  if
   i32.const 1
   return
  end
  i32.const 0
 )
 (func $core/serial/serial/updateSerial (; 113 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  get_global $core/serial/serial/Serial.transferStartFlag
  i32.eqz
  if
   return
  end
  loop $continue|0
   get_local $1
   get_local $0
   i32.lt_s
   if
    get_local $1
    i32.const 4
    i32.add
    set_local $1
    get_global $core/serial/serial/Serial.currentCycles
    tee_local $2
    i32.const 4
    i32.add
    set_global $core/serial/serial/Serial.currentCycles
    get_global $core/serial/serial/Serial.currentCycles
    i32.const 65535
    i32.gt_s
    if
     get_global $core/serial/serial/Serial.currentCycles
     i32.const 65536
     i32.sub
     set_global $core/serial/serial/Serial.currentCycles
    end
    get_local $2
    get_global $core/serial/serial/Serial.currentCycles
    call $core/serial/serial/_checkFallingEdgeDetector
    if
     i32.const 65281
     i32.const 65281
     call $core/memory/load/eightBitLoadFromGBMemory
     i32.const 1
     i32.shl
     i32.const 1
     i32.add
     i32.const 255
     i32.and
     call $core/memory/store/eightBitStoreIntoGBMemory
     get_global $core/serial/serial/Serial.numberOfBitsTransferred
     i32.const 1
     i32.add
     set_global $core/serial/serial/Serial.numberOfBitsTransferred
     get_global $core/serial/serial/Serial.numberOfBitsTransferred
     i32.const 8
     i32.eq
     if
      i32.const 0
      set_global $core/serial/serial/Serial.numberOfBitsTransferred
      i32.const 1
      set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
      i32.const 3
      call $core/interrupts/interrupts/_requestInterrupt
      i32.const 65282
      i32.const 65282
      call $core/memory/load/eightBitLoadFromGBMemory
      i32.const -129
      i32.and
      call $core/memory/store/eightBitStoreIntoGBMemory
      i32.const 0
      set_global $core/serial/serial/Serial.transferStartFlag
     end
    end
    br $continue|0
   end
  end
 )
 (func $core/cycles/syncCycles (; 114 ;) (type $iv) (param $0 i32)
  get_global $core/memory/memory/Memory.DMACycles
  i32.const 0
  i32.gt_s
  if
   get_global $core/memory/memory/Memory.DMACycles
   get_local $0
   i32.add
   set_local $0
   i32.const 0
   set_global $core/memory/memory/Memory.DMACycles
  end
  get_global $core/cpu/cpu/Cpu.currentCycles
  get_local $0
  i32.add
  set_global $core/cpu/cpu/Cpu.currentCycles
  get_global $core/cpu/cpu/Cpu.isStopped
  i32.eqz
  if
   get_global $core/config/Config.graphicsBatchProcessing
   if
    get_global $core/graphics/graphics/Graphics.currentCycles
    get_local $0
    i32.add
    set_global $core/graphics/graphics/Graphics.currentCycles
    call $core/graphics/graphics/batchProcessGraphics
   else    
    get_local $0
    call $core/graphics/graphics/updateGraphics
   end
   get_global $core/config/Config.audioBatchProcessing
   if
    get_global $core/sound/sound/Sound.currentCycles
    get_local $0
    i32.add
    set_global $core/sound/sound/Sound.currentCycles
   else    
    get_local $0
    call $core/sound/sound/updateSound
   end
   get_local $0
   call $core/serial/serial/updateSerial
  end
  get_global $core/config/Config.timersBatchProcessing
  if
   get_global $core/timers/timers/Timers.currentCycles
   get_local $0
   i32.add
   set_global $core/timers/timers/Timers.currentCycles
   call $core/timers/timers/batchProcessTimers
  else   
   get_local $0
   call $core/timers/timers/updateTimers
  end
  get_global $core/cycles/Cycles.cycles
  get_local $0
  i32.add
  set_global $core/cycles/Cycles.cycles
  get_global $core/cycles/Cycles.cycles
  get_global $core/cycles/Cycles.cyclesPerCycleSet
  i32.ge_s
  if
   get_global $core/cycles/Cycles.cycleSets
   i32.const 1
   i32.add
   set_global $core/cycles/Cycles.cycleSets
   get_global $core/cycles/Cycles.cycles
   get_global $core/cycles/Cycles.cyclesPerCycleSet
   i32.sub
   set_global $core/cycles/Cycles.cycles
  end
 )
 (func $core/cpu/opcodes/getDataByteOne (; 115 ;) (type $i) (result i32)
  i32.const 4
  call $core/cycles/syncCycles
  get_global $core/cpu/cpu/Cpu.programCounter
  call $core/memory/load/eightBitLoadFromGBMemory
 )
 (func $core/cpu/opcodes/getConcatenatedDataByte (; 116 ;) (type $i) (result i32)
  (local $0 i32)
  i32.const 4
  call $core/cycles/syncCycles
  get_global $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  call $core/memory/load/eightBitLoadFromGBMemory
  set_local $0
  call $core/cpu/opcodes/getDataByteOne
  i32.const 255
  i32.and
  get_local $0
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/cpu/opcodes/eightBitStoreSyncCycles (; 117 ;) (type $iiv) (param $0 i32) (param $1 i32)
  i32.const 4
  call $core/cycles/syncCycles
  get_local $0
  get_local $1
  call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
 )
 (func $core/cpu/flags/setFlagBit (; 118 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  i32.const 1
  get_local $0
  i32.shl
  i32.const 255
  i32.and
  set_local $2
  get_local $1
  i32.const 0
  i32.gt_s
  if
   get_global $core/cpu/cpu/Cpu.registerF
   get_local $2
   i32.or
   i32.const 255
   i32.and
   set_global $core/cpu/cpu/Cpu.registerF
  else   
   get_global $core/cpu/cpu/Cpu.registerF
   get_local $2
   i32.const 255
   i32.xor
   i32.and
   set_global $core/cpu/cpu/Cpu.registerF
  end
  get_global $core/cpu/cpu/Cpu.registerF
 )
 (func $core/cpu/flags/setHalfCarryFlag (; 119 ;) (type $iv) (param $0 i32)
  i32.const 5
  get_local $0
  call $core/cpu/flags/setFlagBit
  drop
 )
 (func $core/cpu/flags/checkAndSetEightBitHalfCarryFlag (; 120 ;) (type $iiv) (param $0 i32) (param $1 i32)
  get_local $1
  i32.const 0
  i32.ge_s
  if
   get_local $0
   i32.const 15
   i32.and
   get_local $1
   i32.const 15
   i32.and
   i32.add
   i32.const 16
   i32.and
   if
    i32.const 1
    call $core/cpu/flags/setHalfCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setHalfCarryFlag
   end
  else   
   get_local $1
   i32.const 0
   get_local $1
   i32.sub
   get_local $1
   i32.const 0
   i32.gt_s
   select
   i32.const 15
   i32.and
   get_local $0
   i32.const 15
   i32.and
   i32.gt_u
   if
    i32.const 1
    call $core/cpu/flags/setHalfCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setHalfCarryFlag
   end
  end
 )
 (func $core/cpu/flags/setZeroFlag (; 121 ;) (type $iv) (param $0 i32)
  i32.const 7
  get_local $0
  call $core/cpu/flags/setFlagBit
  drop
 )
 (func $core/cpu/flags/setSubtractFlag (; 122 ;) (type $iv) (param $0 i32)
  i32.const 6
  get_local $0
  call $core/cpu/flags/setFlagBit
  drop
 )
 (func $core/cpu/flags/setCarryFlag (; 123 ;) (type $iv) (param $0 i32)
  i32.const 4
  get_local $0
  call $core/cpu/flags/setFlagBit
  drop
 )
 (func $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps (; 124 ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  get_local $1
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_s
  set_local $2
  get_local $0
  i32.const 1
  i32.add
  set_local $3
  get_local $0
  get_local $1
  i32.const 255
  i32.and
  tee_local $1
  call $core/memory/writeTraps/checkWriteTraps
  if
   get_local $0
   get_local $1
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
  get_local $3
  get_local $2
  call $core/memory/writeTraps/checkWriteTraps
  if
   get_local $3
   get_local $2
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/cpu/opcodes/sixteenBitStoreSyncCycles (; 125 ;) (type $iiv) (param $0 i32) (param $1 i32)
  i32.const 8
  call $core/cycles/syncCycles
  get_local $0
  get_local $1
  call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
 )
 (func $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow (; 126 ;) (type $iiiv) (param $0 i32) (param $1 i32) (param $2 i32)
  get_local $2
  if
   get_local $1
   get_local $0
   i32.const 65535
   i32.and
   tee_local $0
   i32.add
   get_local $0
   get_local $1
   i32.xor
   i32.xor
   tee_local $2
   i32.const 16
   i32.and
   if
    i32.const 1
    call $core/cpu/flags/setHalfCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setHalfCarryFlag
   end
   get_local $2
   i32.const 256
   i32.and
   if
    i32.const 1
    call $core/cpu/flags/setCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setCarryFlag
   end
  else   
   get_local $0
   get_local $1
   i32.add
   i32.const 65535
   i32.and
   tee_local $2
   get_local $0
   i32.const 65535
   i32.and
   i32.lt_u
   if
    i32.const 1
    call $core/cpu/flags/setCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setCarryFlag
   end
   get_local $0
   get_local $1
   i32.xor
   get_local $2
   i32.xor
   i32.const 4096
   i32.and
   if
    i32.const 1
    call $core/cpu/flags/setHalfCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setHalfCarryFlag
   end
  end
 )
 (func $core/cpu/opcodes/eightBitLoadSyncCycles (; 127 ;) (type $ii) (param $0 i32) (result i32)
  i32.const 4
  call $core/cycles/syncCycles
  get_local $0
  call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
 )
 (func $core/cpu/opcodes/handleOpcode0x (; 128 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner4
   block $folding-inner3
    block $folding-inner2
     block $folding-inner1
      block $folding-inner0
       block $break|0
        block $case15|0
         block $case14|0
          block $case13|0
           block $case12|0
            block $case11|0
             block $case10|0
              block $case9|0
               block $case8|0
                block $case7|0
                 block $case6|0
                  block $case5|0
                   block $case4|0
                    block $case3|0
                     block $case2|0
                      block $case1|0
                       get_local $0
                       if
                        get_local $0
                        i32.const 1
                        i32.sub
                        br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                       end
                       br $folding-inner3
                      end
                      call $core/cpu/opcodes/getConcatenatedDataByte
                      i32.const 65535
                      i32.and
                      tee_local $0
                      i32.const 65280
                      i32.and
                      i32.const 8
                      i32.shr_s
                      set_global $core/cpu/cpu/Cpu.registerB
                      get_local $0
                      i32.const 255
                      i32.and
                      set_global $core/cpu/cpu/Cpu.registerC
                      br $folding-inner2
                     end
                     get_global $core/cpu/cpu/Cpu.registerC
                     i32.const 255
                     i32.and
                     get_global $core/cpu/cpu/Cpu.registerB
                     i32.const 255
                     i32.and
                     i32.const 8
                     i32.shl
                     i32.or
                     get_global $core/cpu/cpu/Cpu.registerA
                     call $core/cpu/opcodes/eightBitStoreSyncCycles
                     br $folding-inner3
                    end
                    get_global $core/cpu/cpu/Cpu.registerC
                    i32.const 255
                    i32.and
                    get_global $core/cpu/cpu/Cpu.registerB
                    i32.const 255
                    i32.and
                    i32.const 8
                    i32.shl
                    i32.or
                    i32.const 1
                    i32.add
                    i32.const 65535
                    i32.and
                    tee_local $0
                    i32.const 65280
                    i32.and
                    i32.const 8
                    i32.shr_s
                    set_global $core/cpu/cpu/Cpu.registerB
                    br $folding-inner4
                   end
                   get_global $core/cpu/cpu/Cpu.registerB
                   i32.const 1
                   call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   get_global $core/cpu/cpu/Cpu.registerB
                   i32.const 1
                   i32.add
                   i32.const 255
                   i32.and
                   set_global $core/cpu/cpu/Cpu.registerB
                   get_global $core/cpu/cpu/Cpu.registerB
                   if
                    i32.const 0
                    call $core/cpu/flags/setZeroFlag
                   else                    
                    i32.const 1
                    call $core/cpu/flags/setZeroFlag
                   end
                   i32.const 0
                   call $core/cpu/flags/setSubtractFlag
                   br $folding-inner3
                  end
                  get_global $core/cpu/cpu/Cpu.registerB
                  i32.const -1
                  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  get_global $core/cpu/cpu/Cpu.registerB
                  i32.const 1
                  i32.sub
                  i32.const 255
                  i32.and
                  set_global $core/cpu/cpu/Cpu.registerB
                  get_global $core/cpu/cpu/Cpu.registerB
                  if
                   i32.const 0
                   call $core/cpu/flags/setZeroFlag
                  else                   
                   i32.const 1
                   call $core/cpu/flags/setZeroFlag
                  end
                  i32.const 1
                  call $core/cpu/flags/setSubtractFlag
                  br $folding-inner3
                 end
                 call $core/cpu/opcodes/getDataByteOne
                 i32.const 255
                 i32.and
                 set_global $core/cpu/cpu/Cpu.registerB
                 br $folding-inner1
                end
                get_global $core/cpu/cpu/Cpu.registerA
                i32.const 128
                i32.and
                i32.const 128
                i32.eq
                if
                 i32.const 1
                 call $core/cpu/flags/setCarryFlag
                else                 
                 i32.const 0
                 call $core/cpu/flags/setCarryFlag
                end
                get_global $core/cpu/cpu/Cpu.registerA
                tee_local $0
                i32.const 1
                i32.shl
                get_local $0
                i32.const 255
                i32.and
                i32.const 7
                i32.shr_u
                i32.or
                i32.const 255
                i32.and
                set_global $core/cpu/cpu/Cpu.registerA
                br $folding-inner0
               end
               call $core/cpu/opcodes/getConcatenatedDataByte
               i32.const 65535
               i32.and
               get_global $core/cpu/cpu/Cpu.stackPointer
               call $core/cpu/opcodes/sixteenBitStoreSyncCycles
               br $folding-inner2
              end
              get_global $core/cpu/cpu/Cpu.registerL
              i32.const 255
              i32.and
              get_global $core/cpu/cpu/Cpu.registerH
              i32.const 255
              i32.and
              i32.const 8
              i32.shl
              i32.or
              tee_local $0
              get_global $core/cpu/cpu/Cpu.registerC
              i32.const 255
              i32.and
              get_global $core/cpu/cpu/Cpu.registerB
              i32.const 255
              i32.and
              i32.const 8
              i32.shl
              i32.or
              tee_local $1
              i32.const 0
              call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
              get_local $0
              get_local $1
              i32.add
              i32.const 65535
              i32.and
              tee_local $0
              i32.const 65280
              i32.and
              i32.const 8
              i32.shr_s
              set_global $core/cpu/cpu/Cpu.registerH
              get_local $0
              i32.const 255
              i32.and
              set_global $core/cpu/cpu/Cpu.registerL
              i32.const 0
              call $core/cpu/flags/setSubtractFlag
              i32.const 8
              return
             end
             get_global $core/cpu/cpu/Cpu.registerC
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerB
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             call $core/cpu/opcodes/eightBitLoadSyncCycles
             i32.const 255
             i32.and
             set_global $core/cpu/cpu/Cpu.registerA
             br $folding-inner3
            end
            get_global $core/cpu/cpu/Cpu.registerC
            i32.const 255
            i32.and
            get_global $core/cpu/cpu/Cpu.registerB
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            i32.const 1
            i32.sub
            i32.const 65535
            i32.and
            tee_local $0
            i32.const 65280
            i32.and
            i32.const 8
            i32.shr_s
            set_global $core/cpu/cpu/Cpu.registerB
            br $folding-inner4
           end
           get_global $core/cpu/cpu/Cpu.registerC
           i32.const 1
           call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           get_global $core/cpu/cpu/Cpu.registerC
           i32.const 1
           i32.add
           i32.const 255
           i32.and
           set_global $core/cpu/cpu/Cpu.registerC
           get_global $core/cpu/cpu/Cpu.registerC
           if
            i32.const 0
            call $core/cpu/flags/setZeroFlag
           else            
            i32.const 1
            call $core/cpu/flags/setZeroFlag
           end
           i32.const 0
           call $core/cpu/flags/setSubtractFlag
           br $folding-inner3
          end
          get_global $core/cpu/cpu/Cpu.registerC
          i32.const -1
          call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          get_global $core/cpu/cpu/Cpu.registerC
          i32.const 1
          i32.sub
          i32.const 255
          i32.and
          set_global $core/cpu/cpu/Cpu.registerC
          get_global $core/cpu/cpu/Cpu.registerC
          if
           i32.const 0
           call $core/cpu/flags/setZeroFlag
          else           
           i32.const 1
           call $core/cpu/flags/setZeroFlag
          end
          i32.const 1
          call $core/cpu/flags/setSubtractFlag
          br $folding-inner3
         end
         call $core/cpu/opcodes/getDataByteOne
         i32.const 255
         i32.and
         set_global $core/cpu/cpu/Cpu.registerC
         br $folding-inner1
        end
        get_global $core/cpu/cpu/Cpu.registerA
        i32.const 1
        i32.and
        i32.const 0
        i32.gt_u
        if
         i32.const 1
         call $core/cpu/flags/setCarryFlag
        else         
         i32.const 0
         call $core/cpu/flags/setCarryFlag
        end
        get_global $core/cpu/cpu/Cpu.registerA
        tee_local $0
        i32.const 7
        i32.shl
        get_local $0
        i32.const 255
        i32.and
        i32.const 1
        i32.shr_u
        i32.or
        i32.const 255
        i32.and
        set_global $core/cpu/cpu/Cpu.registerA
        br $folding-inner0
       end
       i32.const -1
       return
      end
      i32.const 0
      call $core/cpu/flags/setZeroFlag
      i32.const 0
      call $core/cpu/flags/setSubtractFlag
      i32.const 0
      call $core/cpu/flags/setHalfCarryFlag
      br $folding-inner3
     end
     get_global $core/cpu/cpu/Cpu.programCounter
     i32.const 1
     i32.add
     i32.const 65535
     i32.and
     set_global $core/cpu/cpu/Cpu.programCounter
     br $folding-inner3
    end
    get_global $core/cpu/cpu/Cpu.programCounter
    i32.const 2
    i32.add
    i32.const 65535
    i32.and
    set_global $core/cpu/cpu/Cpu.programCounter
   end
   i32.const 4
   return
  end
  get_local $0
  i32.const 255
  i32.and
  set_global $core/cpu/cpu/Cpu.registerC
  i32.const 8
 )
 (func $core/portable/portable/i8Portable (; 129 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  get_local $0
  i32.const 24
  i32.shl
  i32.const 24
  i32.shr_s
  tee_local $1
  i32.const 128
  i32.and
  if
   i32.const 256
   get_local $0
   i32.const 24
   i32.shl
   i32.const 24
   i32.shr_s
   i32.sub
   i32.const -1
   i32.mul
   set_local $1
  end
  get_local $1
 )
 (func $core/cpu/instructions/relativeJump (; 130 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_local $0
  call $core/portable/portable/i8Portable
  set_local $1
  get_global $core/cpu/cpu/Cpu.programCounter
  get_local $1
  i32.const 24
  i32.shl
  i32.const 24
  i32.shr_s
  i32.add
  i32.const 65535
  i32.and
  set_global $core/cpu/cpu/Cpu.programCounter
  get_global $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  set_global $core/cpu/cpu/Cpu.programCounter
 )
 (func $core/cpu/opcodes/handleOpcode1x (; 131 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner3
   block $folding-inner2
    block $folding-inner1
     block $folding-inner0
      block $break|0
       block $case15|0
        block $case14|0
         block $case13|0
          block $case12|0
           block $case11|0
            block $case10|0
             block $case9|0
              block $case8|0
               block $case7|0
                block $case6|0
                 block $case5|0
                  block $case4|0
                   block $case3|0
                    block $case2|0
                     block $case1|0
                      get_local $0
                      i32.const 16
                      i32.ne
                      if
                       get_local $0
                       i32.const 17
                       i32.sub
                       br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                      end
                      get_global $core/cpu/cpu/Cpu.GBCEnabled
                      if
                       i32.const 65357
                       call $core/cpu/opcodes/eightBitLoadSyncCycles
                       i32.const 255
                       i32.and
                       tee_local $0
                       i32.const 1
                       i32.and
                       if
                        i32.const 65357
                        get_local $0
                        i32.const -2
                        i32.and
                        tee_local $0
                        i32.const 128
                        i32.and
                        if (result i32)
                         i32.const 0
                         set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
                         get_local $0
                         i32.const -129
                         i32.and
                        else                         
                         i32.const 1
                         set_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
                         get_local $0
                         i32.const 128
                         i32.or
                        end
                        call $core/cpu/opcodes/eightBitStoreSyncCycles
                        i32.const 68
                        return
                       end
                      end
                      i32.const 1
                      set_global $core/cpu/cpu/Cpu.isStopped
                      br $folding-inner1
                     end
                     call $core/cpu/opcodes/getConcatenatedDataByte
                     i32.const 65535
                     i32.and
                     tee_local $0
                     i32.const 65280
                     i32.and
                     i32.const 8
                     i32.shr_s
                     set_global $core/cpu/cpu/Cpu.registerD
                     get_local $0
                     i32.const 255
                     i32.and
                     set_global $core/cpu/cpu/Cpu.registerE
                     get_global $core/cpu/cpu/Cpu.programCounter
                     i32.const 2
                     i32.add
                     i32.const 65535
                     i32.and
                     set_global $core/cpu/cpu/Cpu.programCounter
                     br $folding-inner2
                    end
                    get_global $core/cpu/cpu/Cpu.registerE
                    i32.const 255
                    i32.and
                    get_global $core/cpu/cpu/Cpu.registerD
                    i32.const 255
                    i32.and
                    i32.const 8
                    i32.shl
                    i32.or
                    get_global $core/cpu/cpu/Cpu.registerA
                    call $core/cpu/opcodes/eightBitStoreSyncCycles
                    br $folding-inner2
                   end
                   get_global $core/cpu/cpu/Cpu.registerE
                   i32.const 255
                   i32.and
                   get_global $core/cpu/cpu/Cpu.registerD
                   i32.const 255
                   i32.and
                   i32.const 8
                   i32.shl
                   i32.or
                   i32.const 1
                   i32.add
                   i32.const 65535
                   i32.and
                   tee_local $0
                   i32.const 65280
                   i32.and
                   i32.const 8
                   i32.shr_s
                   set_global $core/cpu/cpu/Cpu.registerD
                   br $folding-inner3
                  end
                  get_global $core/cpu/cpu/Cpu.registerD
                  i32.const 1
                  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  get_global $core/cpu/cpu/Cpu.registerD
                  i32.const 1
                  i32.add
                  i32.const 255
                  i32.and
                  set_global $core/cpu/cpu/Cpu.registerD
                  get_global $core/cpu/cpu/Cpu.registerD
                  if
                   i32.const 0
                   call $core/cpu/flags/setZeroFlag
                  else                   
                   i32.const 1
                   call $core/cpu/flags/setZeroFlag
                  end
                  i32.const 0
                  call $core/cpu/flags/setSubtractFlag
                  br $folding-inner2
                 end
                 get_global $core/cpu/cpu/Cpu.registerD
                 i32.const -1
                 call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                 get_global $core/cpu/cpu/Cpu.registerD
                 i32.const 1
                 i32.sub
                 i32.const 255
                 i32.and
                 set_global $core/cpu/cpu/Cpu.registerD
                 get_global $core/cpu/cpu/Cpu.registerD
                 if
                  i32.const 0
                  call $core/cpu/flags/setZeroFlag
                 else                  
                  i32.const 1
                  call $core/cpu/flags/setZeroFlag
                 end
                 i32.const 1
                 call $core/cpu/flags/setSubtractFlag
                 br $folding-inner2
                end
                call $core/cpu/opcodes/getDataByteOne
                i32.const 255
                i32.and
                set_global $core/cpu/cpu/Cpu.registerD
                br $folding-inner1
               end
               i32.const 1
               i32.const 0
               get_global $core/cpu/cpu/Cpu.registerA
               tee_local $1
               i32.const 128
               i32.and
               i32.const 128
               i32.eq
               select
               set_local $0
               get_global $core/cpu/cpu/Cpu.registerF
               i32.const 4
               i32.shr_u
               i32.const 1
               i32.and
               get_local $1
               i32.const 1
               i32.shl
               i32.or
               i32.const 255
               i32.and
               set_global $core/cpu/cpu/Cpu.registerA
               br $folding-inner0
              end
              call $core/cpu/opcodes/getDataByteOne
              call $core/cpu/instructions/relativeJump
              i32.const 8
              return
             end
             get_global $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             tee_local $0
             get_global $core/cpu/cpu/Cpu.registerE
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerD
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             tee_local $1
             i32.const 0
             call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
             get_local $0
             get_local $1
             i32.add
             i32.const 65535
             i32.and
             tee_local $0
             i32.const 65280
             i32.and
             i32.const 8
             i32.shr_s
             set_global $core/cpu/cpu/Cpu.registerH
             get_local $0
             i32.const 255
             i32.and
             set_global $core/cpu/cpu/Cpu.registerL
             i32.const 0
             call $core/cpu/flags/setSubtractFlag
             i32.const 8
             return
            end
            get_global $core/cpu/cpu/Cpu.registerE
            i32.const 255
            i32.and
            get_global $core/cpu/cpu/Cpu.registerD
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            call $core/cpu/opcodes/eightBitLoadSyncCycles
            i32.const 255
            i32.and
            set_global $core/cpu/cpu/Cpu.registerA
            br $folding-inner2
           end
           get_global $core/cpu/cpu/Cpu.registerE
           i32.const 255
           i32.and
           get_global $core/cpu/cpu/Cpu.registerD
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           i32.const 1
           i32.sub
           i32.const 65535
           i32.and
           tee_local $0
           i32.const 65280
           i32.and
           i32.const 8
           i32.shr_s
           set_global $core/cpu/cpu/Cpu.registerD
           br $folding-inner3
          end
          get_global $core/cpu/cpu/Cpu.registerE
          i32.const 1
          call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          get_global $core/cpu/cpu/Cpu.registerE
          i32.const 1
          i32.add
          i32.const 255
          i32.and
          set_global $core/cpu/cpu/Cpu.registerE
          get_global $core/cpu/cpu/Cpu.registerE
          if
           i32.const 0
           call $core/cpu/flags/setZeroFlag
          else           
           i32.const 1
           call $core/cpu/flags/setZeroFlag
          end
          i32.const 0
          call $core/cpu/flags/setSubtractFlag
          br $folding-inner2
         end
         get_global $core/cpu/cpu/Cpu.registerE
         i32.const -1
         call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
         get_global $core/cpu/cpu/Cpu.registerE
         i32.const 1
         i32.sub
         i32.const 255
         i32.and
         set_global $core/cpu/cpu/Cpu.registerE
         get_global $core/cpu/cpu/Cpu.registerE
         if
          i32.const 0
          call $core/cpu/flags/setZeroFlag
         else          
          i32.const 1
          call $core/cpu/flags/setZeroFlag
         end
         i32.const 1
         call $core/cpu/flags/setSubtractFlag
         br $folding-inner2
        end
        call $core/cpu/opcodes/getDataByteOne
        i32.const 255
        i32.and
        set_global $core/cpu/cpu/Cpu.registerE
        br $folding-inner1
       end
       i32.const 1
       i32.const 0
       get_global $core/cpu/cpu/Cpu.registerA
       tee_local $1
       i32.const 1
       i32.and
       i32.const 1
       i32.eq
       select
       set_local $0
       get_global $core/cpu/cpu/Cpu.registerF
       i32.const 4
       i32.shr_u
       i32.const 1
       i32.and
       i32.const 7
       i32.shl
       get_local $1
       i32.const 255
       i32.and
       i32.const 1
       i32.shr_u
       i32.or
       set_global $core/cpu/cpu/Cpu.registerA
       br $folding-inner0
      end
      i32.const -1
      return
     end
     get_local $0
     if
      i32.const 1
      call $core/cpu/flags/setCarryFlag
     else      
      i32.const 0
      call $core/cpu/flags/setCarryFlag
     end
     i32.const 0
     call $core/cpu/flags/setZeroFlag
     i32.const 0
     call $core/cpu/flags/setSubtractFlag
     i32.const 0
     call $core/cpu/flags/setHalfCarryFlag
     br $folding-inner2
    end
    get_global $core/cpu/cpu/Cpu.programCounter
    i32.const 1
    i32.add
    i32.const 65535
    i32.and
    set_global $core/cpu/cpu/Cpu.programCounter
   end
   i32.const 4
   return
  end
  get_local $0
  i32.const 255
  i32.and
  set_global $core/cpu/cpu/Cpu.registerE
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcode2x (; 132 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner1
   block $folding-inner0
    block $break|0
     block $case15|0
      block $case14|0
       block $case13|0
        block $case12|0
         block $case11|0
          block $case10|0
           block $case9|0
            block $case8|0
             block $case7|0
              block $case6|0
               block $case5|0
                block $case4|0
                 block $case3|0
                  block $case2|0
                   block $case1|0
                    get_local $0
                    i32.const 32
                    i32.ne
                    if
                     get_local $0
                     i32.const 33
                     i32.sub
                     br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                    end
                    get_global $core/cpu/cpu/Cpu.registerF
                    i32.const 7
                    i32.shr_u
                    i32.const 1
                    i32.and
                    if
                     get_global $core/cpu/cpu/Cpu.programCounter
                     i32.const 1
                     i32.add
                     i32.const 65535
                     i32.and
                     set_global $core/cpu/cpu/Cpu.programCounter
                    else                     
                     call $core/cpu/opcodes/getDataByteOne
                     call $core/cpu/instructions/relativeJump
                    end
                    i32.const 8
                    return
                   end
                   call $core/cpu/opcodes/getConcatenatedDataByte
                   i32.const 65535
                   i32.and
                   tee_local $0
                   i32.const 65280
                   i32.and
                   i32.const 8
                   i32.shr_s
                   set_global $core/cpu/cpu/Cpu.registerH
                   get_local $0
                   i32.const 255
                   i32.and
                   set_global $core/cpu/cpu/Cpu.registerL
                   get_global $core/cpu/cpu/Cpu.programCounter
                   i32.const 2
                   i32.add
                   i32.const 65535
                   i32.and
                   set_global $core/cpu/cpu/Cpu.programCounter
                   br $folding-inner1
                  end
                  get_global $core/cpu/cpu/Cpu.registerL
                  i32.const 255
                  i32.and
                  get_global $core/cpu/cpu/Cpu.registerH
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  tee_local $0
                  get_global $core/cpu/cpu/Cpu.registerA
                  call $core/cpu/opcodes/eightBitStoreSyncCycles
                  get_local $0
                  i32.const 1
                  i32.add
                  i32.const 65535
                  i32.and
                  tee_local $0
                  i32.const 65280
                  i32.and
                  i32.const 8
                  i32.shr_s
                  set_global $core/cpu/cpu/Cpu.registerH
                  get_local $0
                  i32.const 255
                  i32.and
                  set_global $core/cpu/cpu/Cpu.registerL
                  br $folding-inner1
                 end
                 get_global $core/cpu/cpu/Cpu.registerL
                 i32.const 255
                 i32.and
                 get_global $core/cpu/cpu/Cpu.registerH
                 i32.const 255
                 i32.and
                 i32.const 8
                 i32.shl
                 i32.or
                 i32.const 1
                 i32.add
                 i32.const 65535
                 i32.and
                 tee_local $0
                 i32.const 65280
                 i32.and
                 i32.const 8
                 i32.shr_s
                 set_global $core/cpu/cpu/Cpu.registerH
                 get_local $0
                 i32.const 255
                 i32.and
                 set_global $core/cpu/cpu/Cpu.registerL
                 i32.const 8
                 return
                end
                get_global $core/cpu/cpu/Cpu.registerH
                i32.const 1
                call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                get_global $core/cpu/cpu/Cpu.registerH
                i32.const 1
                i32.add
                i32.const 255
                i32.and
                set_global $core/cpu/cpu/Cpu.registerH
                get_global $core/cpu/cpu/Cpu.registerH
                if
                 i32.const 0
                 call $core/cpu/flags/setZeroFlag
                else                 
                 i32.const 1
                 call $core/cpu/flags/setZeroFlag
                end
                i32.const 0
                call $core/cpu/flags/setSubtractFlag
                br $folding-inner1
               end
               get_global $core/cpu/cpu/Cpu.registerH
               i32.const -1
               call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
               get_global $core/cpu/cpu/Cpu.registerH
               i32.const 1
               i32.sub
               i32.const 255
               i32.and
               set_global $core/cpu/cpu/Cpu.registerH
               get_global $core/cpu/cpu/Cpu.registerH
               if
                i32.const 0
                call $core/cpu/flags/setZeroFlag
               else                
                i32.const 1
                call $core/cpu/flags/setZeroFlag
               end
               i32.const 1
               call $core/cpu/flags/setSubtractFlag
               br $folding-inner1
              end
              call $core/cpu/opcodes/getDataByteOne
              i32.const 255
              i32.and
              set_global $core/cpu/cpu/Cpu.registerH
              br $folding-inner0
             end
             i32.const 6
             i32.const 0
             get_global $core/cpu/cpu/Cpu.registerF
             i32.const 5
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 0
             i32.gt_u
             select
             set_local $1
             get_local $1
             i32.const 96
             i32.or
             get_local $1
             get_global $core/cpu/cpu/Cpu.registerF
             i32.const 4
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 0
             i32.gt_u
             select
             set_local $1
             get_global $core/cpu/cpu/Cpu.registerF
             i32.const 6
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 0
             i32.gt_u
             if (result i32)
              get_global $core/cpu/cpu/Cpu.registerA
              get_local $1
              i32.sub
              i32.const 255
              i32.and
             else              
              get_local $1
              i32.const 6
              i32.or
              get_local $1
              get_global $core/cpu/cpu/Cpu.registerA
              tee_local $0
              i32.const 15
              i32.and
              i32.const 9
              i32.gt_u
              select
              tee_local $1
              i32.const 96
              i32.or
              get_local $1
              get_local $0
              i32.const 153
              i32.gt_u
              select
              tee_local $1
              get_local $0
              i32.add
              i32.const 255
              i32.and
             end
             tee_local $0
             if
              i32.const 0
              call $core/cpu/flags/setZeroFlag
             else              
              i32.const 1
              call $core/cpu/flags/setZeroFlag
             end
             get_local $1
             i32.const 96
             i32.and
             if
              i32.const 1
              call $core/cpu/flags/setCarryFlag
             else              
              i32.const 0
              call $core/cpu/flags/setCarryFlag
             end
             i32.const 0
             call $core/cpu/flags/setHalfCarryFlag
             get_local $0
             set_global $core/cpu/cpu/Cpu.registerA
             br $folding-inner1
            end
            get_global $core/cpu/cpu/Cpu.registerF
            i32.const 7
            i32.shr_u
            i32.const 1
            i32.and
            i32.const 0
            i32.gt_u
            if
             call $core/cpu/opcodes/getDataByteOne
             call $core/cpu/instructions/relativeJump
            else             
             get_global $core/cpu/cpu/Cpu.programCounter
             i32.const 1
             i32.add
             i32.const 65535
             i32.and
             set_global $core/cpu/cpu/Cpu.programCounter
            end
            i32.const 8
            return
           end
           get_global $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           get_global $core/cpu/cpu/Cpu.registerH
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           tee_local $1
           get_local $1
           i32.const 65535
           i32.and
           i32.const 0
           call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
           get_local $1
           i32.const 1
           i32.shl
           i32.const 65535
           i32.and
           tee_local $1
           i32.const 65280
           i32.and
           i32.const 8
           i32.shr_s
           set_global $core/cpu/cpu/Cpu.registerH
           get_local $1
           i32.const 255
           i32.and
           set_global $core/cpu/cpu/Cpu.registerL
           i32.const 0
           call $core/cpu/flags/setSubtractFlag
           i32.const 8
           return
          end
          get_global $core/cpu/cpu/Cpu.registerL
          i32.const 255
          i32.and
          get_global $core/cpu/cpu/Cpu.registerH
          i32.const 255
          i32.and
          i32.const 8
          i32.shl
          i32.or
          tee_local $1
          call $core/cpu/opcodes/eightBitLoadSyncCycles
          i32.const 255
          i32.and
          set_global $core/cpu/cpu/Cpu.registerA
          get_local $1
          i32.const 1
          i32.add
          i32.const 65535
          i32.and
          tee_local $1
          i32.const 65280
          i32.and
          i32.const 8
          i32.shr_s
          set_global $core/cpu/cpu/Cpu.registerH
          get_local $1
          i32.const 255
          i32.and
          set_global $core/cpu/cpu/Cpu.registerL
          br $folding-inner1
         end
         get_global $core/cpu/cpu/Cpu.registerL
         i32.const 255
         i32.and
         get_global $core/cpu/cpu/Cpu.registerH
         i32.const 255
         i32.and
         i32.const 8
         i32.shl
         i32.or
         i32.const 1
         i32.sub
         i32.const 65535
         i32.and
         tee_local $1
         i32.const 65280
         i32.and
         i32.const 8
         i32.shr_s
         set_global $core/cpu/cpu/Cpu.registerH
         get_local $1
         i32.const 255
         i32.and
         set_global $core/cpu/cpu/Cpu.registerL
         i32.const 8
         return
        end
        get_global $core/cpu/cpu/Cpu.registerL
        i32.const 1
        call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
        get_global $core/cpu/cpu/Cpu.registerL
        i32.const 1
        i32.add
        i32.const 255
        i32.and
        set_global $core/cpu/cpu/Cpu.registerL
        get_global $core/cpu/cpu/Cpu.registerL
        if
         i32.const 0
         call $core/cpu/flags/setZeroFlag
        else         
         i32.const 1
         call $core/cpu/flags/setZeroFlag
        end
        i32.const 0
        call $core/cpu/flags/setSubtractFlag
        br $folding-inner1
       end
       get_global $core/cpu/cpu/Cpu.registerL
       i32.const -1
       call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
       get_global $core/cpu/cpu/Cpu.registerL
       i32.const 1
       i32.sub
       i32.const 255
       i32.and
       set_global $core/cpu/cpu/Cpu.registerL
       get_global $core/cpu/cpu/Cpu.registerL
       if
        i32.const 0
        call $core/cpu/flags/setZeroFlag
       else        
        i32.const 1
        call $core/cpu/flags/setZeroFlag
       end
       i32.const 1
       call $core/cpu/flags/setSubtractFlag
       br $folding-inner1
      end
      call $core/cpu/opcodes/getDataByteOne
      i32.const 255
      i32.and
      set_global $core/cpu/cpu/Cpu.registerL
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerA
     i32.const -1
     i32.xor
     i32.const 255
     i32.and
     set_global $core/cpu/cpu/Cpu.registerA
     i32.const 1
     call $core/cpu/flags/setSubtractFlag
     i32.const 1
     call $core/cpu/flags/setHalfCarryFlag
     br $folding-inner1
    end
    i32.const -1
    return
   end
   get_global $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.add
   i32.const 65535
   i32.and
   set_global $core/cpu/cpu/Cpu.programCounter
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode3x (; 133 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner3
   block $folding-inner2
    block $folding-inner1
     block $folding-inner0
      block $break|0
       block $case15|0
        block $case14|0
         block $case13|0
          block $case12|0
           block $case11|0
            block $case10|0
             block $case9|0
              block $case8|0
               block $case7|0
                block $case6|0
                 block $case5|0
                  block $case4|0
                   block $case3|0
                    block $case2|0
                     block $case1|0
                      get_local $0
                      i32.const 48
                      i32.ne
                      if
                       get_local $0
                       i32.const 49
                       i32.sub
                       br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                      end
                      get_global $core/cpu/cpu/Cpu.registerF
                      i32.const 4
                      i32.shr_u
                      i32.const 1
                      i32.and
                      if
                       get_global $core/cpu/cpu/Cpu.programCounter
                       i32.const 1
                       i32.add
                       i32.const 65535
                       i32.and
                       set_global $core/cpu/cpu/Cpu.programCounter
                      else                       
                       call $core/cpu/opcodes/getDataByteOne
                       call $core/cpu/instructions/relativeJump
                      end
                      i32.const 8
                      return
                     end
                     call $core/cpu/opcodes/getConcatenatedDataByte
                     i32.const 65535
                     i32.and
                     set_global $core/cpu/cpu/Cpu.stackPointer
                     get_global $core/cpu/cpu/Cpu.programCounter
                     i32.const 2
                     i32.add
                     i32.const 65535
                     i32.and
                     set_global $core/cpu/cpu/Cpu.programCounter
                     br $folding-inner3
                    end
                    get_global $core/cpu/cpu/Cpu.registerL
                    i32.const 255
                    i32.and
                    get_global $core/cpu/cpu/Cpu.registerH
                    i32.const 255
                    i32.and
                    i32.const 8
                    i32.shl
                    i32.or
                    tee_local $0
                    get_global $core/cpu/cpu/Cpu.registerA
                    call $core/cpu/opcodes/eightBitStoreSyncCycles
                    br $folding-inner0
                   end
                   get_global $core/cpu/cpu/Cpu.stackPointer
                   i32.const 1
                   i32.add
                   i32.const 65535
                   i32.and
                   set_global $core/cpu/cpu/Cpu.stackPointer
                   i32.const 8
                   return
                  end
                  get_global $core/cpu/cpu/Cpu.registerL
                  i32.const 255
                  i32.and
                  get_global $core/cpu/cpu/Cpu.registerH
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  tee_local $0
                  call $core/cpu/opcodes/eightBitLoadSyncCycles
                  tee_local $1
                  i32.const 1
                  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  get_local $1
                  i32.const 1
                  i32.add
                  i32.const 255
                  i32.and
                  tee_local $1
                  if
                   i32.const 0
                   call $core/cpu/flags/setZeroFlag
                  else                   
                   i32.const 1
                   call $core/cpu/flags/setZeroFlag
                  end
                  i32.const 0
                  call $core/cpu/flags/setSubtractFlag
                  br $folding-inner1
                 end
                 get_global $core/cpu/cpu/Cpu.registerL
                 i32.const 255
                 i32.and
                 get_global $core/cpu/cpu/Cpu.registerH
                 i32.const 255
                 i32.and
                 i32.const 8
                 i32.shl
                 i32.or
                 tee_local $0
                 call $core/cpu/opcodes/eightBitLoadSyncCycles
                 tee_local $1
                 i32.const -1
                 call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                 get_local $1
                 i32.const 1
                 i32.sub
                 i32.const 255
                 i32.and
                 tee_local $1
                 if
                  i32.const 0
                  call $core/cpu/flags/setZeroFlag
                 else                  
                  i32.const 1
                  call $core/cpu/flags/setZeroFlag
                 end
                 i32.const 1
                 call $core/cpu/flags/setSubtractFlag
                 br $folding-inner1
                end
                get_global $core/cpu/cpu/Cpu.registerL
                i32.const 255
                i32.and
                get_global $core/cpu/cpu/Cpu.registerH
                i32.const 255
                i32.and
                i32.const 8
                i32.shl
                i32.or
                call $core/cpu/opcodes/getDataByteOne
                i32.const 255
                i32.and
                call $core/cpu/opcodes/eightBitStoreSyncCycles
                br $folding-inner2
               end
               i32.const 0
               call $core/cpu/flags/setSubtractFlag
               i32.const 0
               call $core/cpu/flags/setHalfCarryFlag
               i32.const 1
               call $core/cpu/flags/setCarryFlag
               br $folding-inner3
              end
              get_global $core/cpu/cpu/Cpu.registerF
              i32.const 4
              i32.shr_u
              i32.const 1
              i32.and
              i32.const 1
              i32.eq
              if
               call $core/cpu/opcodes/getDataByteOne
               call $core/cpu/instructions/relativeJump
              else               
               get_global $core/cpu/cpu/Cpu.programCounter
               i32.const 1
               i32.add
               i32.const 65535
               i32.and
               set_global $core/cpu/cpu/Cpu.programCounter
              end
              i32.const 8
              return
             end
             get_global $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             tee_local $1
             get_global $core/cpu/cpu/Cpu.stackPointer
             i32.const 0
             call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
             get_global $core/cpu/cpu/Cpu.stackPointer
             get_local $1
             i32.add
             i32.const 65535
             i32.and
             tee_local $0
             i32.const 65280
             i32.and
             i32.const 8
             i32.shr_s
             set_global $core/cpu/cpu/Cpu.registerH
             get_local $0
             i32.const 255
             i32.and
             set_global $core/cpu/cpu/Cpu.registerL
             i32.const 0
             call $core/cpu/flags/setSubtractFlag
             i32.const 8
             return
            end
            get_global $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            get_global $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            tee_local $0
            call $core/cpu/opcodes/eightBitLoadSyncCycles
            i32.const 255
            i32.and
            set_global $core/cpu/cpu/Cpu.registerA
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.stackPointer
           i32.const 1
           i32.sub
           i32.const 65535
           i32.and
           set_global $core/cpu/cpu/Cpu.stackPointer
           i32.const 8
           return
          end
          get_global $core/cpu/cpu/Cpu.registerA
          i32.const 1
          call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          get_global $core/cpu/cpu/Cpu.registerA
          i32.const 1
          i32.add
          i32.const 255
          i32.and
          set_global $core/cpu/cpu/Cpu.registerA
          get_global $core/cpu/cpu/Cpu.registerA
          if
           i32.const 0
           call $core/cpu/flags/setZeroFlag
          else           
           i32.const 1
           call $core/cpu/flags/setZeroFlag
          end
          i32.const 0
          call $core/cpu/flags/setSubtractFlag
          br $folding-inner3
         end
         get_global $core/cpu/cpu/Cpu.registerA
         i32.const -1
         call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
         get_global $core/cpu/cpu/Cpu.registerA
         i32.const 1
         i32.sub
         i32.const 255
         i32.and
         set_global $core/cpu/cpu/Cpu.registerA
         get_global $core/cpu/cpu/Cpu.registerA
         if
          i32.const 0
          call $core/cpu/flags/setZeroFlag
         else          
          i32.const 1
          call $core/cpu/flags/setZeroFlag
         end
         i32.const 1
         call $core/cpu/flags/setSubtractFlag
         br $folding-inner3
        end
        call $core/cpu/opcodes/getDataByteOne
        i32.const 255
        i32.and
        set_global $core/cpu/cpu/Cpu.registerA
        br $folding-inner2
       end
       i32.const 0
       call $core/cpu/flags/setSubtractFlag
       i32.const 0
       call $core/cpu/flags/setHalfCarryFlag
       get_global $core/cpu/cpu/Cpu.registerF
       i32.const 4
       i32.shr_u
       i32.const 1
       i32.and
       i32.const 0
       i32.gt_u
       if
        i32.const 0
        call $core/cpu/flags/setCarryFlag
       else        
        i32.const 1
        call $core/cpu/flags/setCarryFlag
       end
       br $folding-inner3
      end
      i32.const -1
      return
     end
     get_local $0
     i32.const 1
     i32.sub
     i32.const 65535
     i32.and
     tee_local $0
     i32.const 65280
     i32.and
     i32.const 8
     i32.shr_s
     set_global $core/cpu/cpu/Cpu.registerH
     get_local $0
     i32.const 255
     i32.and
     set_global $core/cpu/cpu/Cpu.registerL
     br $folding-inner3
    end
    get_local $0
    i32.const 65535
    i32.and
    get_local $1
    call $core/cpu/opcodes/eightBitStoreSyncCycles
    br $folding-inner3
   end
   get_global $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.add
   i32.const 65535
   i32.and
   set_global $core/cpu/cpu/Cpu.programCounter
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode4x (; 134 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner0
   block $break|0
    block $case15|0
     block $case14|0
      block $case13|0
       block $case12|0
        block $case11|0
         block $case10|0
          block $case8|0
           block $case7|0
            block $case6|0
             block $case5|0
              block $case4|0
               block $case3|0
                block $case2|0
                 block $case1|0
                  get_local $0
                  i32.const 64
                  i32.ne
                  if
                   get_local $0
                   i32.const 65
                   i32.eq
                   br_if $case1|0
                   block $tablify|0
                    get_local $0
                    i32.const 66
                    i32.sub
                    br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $folding-inner0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                   end
                   br $break|0
                  end
                  br $folding-inner0
                 end
                 get_global $core/cpu/cpu/Cpu.registerC
                 set_global $core/cpu/cpu/Cpu.registerB
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerD
                set_global $core/cpu/cpu/Cpu.registerB
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerE
               set_global $core/cpu/cpu/Cpu.registerB
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerH
              set_global $core/cpu/cpu/Cpu.registerB
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             set_global $core/cpu/cpu/Cpu.registerB
             br $folding-inner0
            end
            get_global $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            get_global $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            call $core/cpu/opcodes/eightBitLoadSyncCycles
            i32.const 255
            i32.and
            set_global $core/cpu/cpu/Cpu.registerB
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerA
           set_global $core/cpu/cpu/Cpu.registerB
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerB
          set_global $core/cpu/cpu/Cpu.registerC
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerD
         set_global $core/cpu/cpu/Cpu.registerC
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerE
        set_global $core/cpu/cpu/Cpu.registerC
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerH
       set_global $core/cpu/cpu/Cpu.registerC
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerL
      set_global $core/cpu/cpu/Cpu.registerC
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     i32.const 255
     i32.and
     set_global $core/cpu/cpu/Cpu.registerC
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerA
    set_global $core/cpu/cpu/Cpu.registerC
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode5x (; 135 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner0
   block $break|0
    block $case15|0
     block $case14|0
      block $case13|0
       block $case12|0
        block $case10|0
         block $case9|0
          block $case8|0
           block $case7|0
            block $case6|0
             block $case5|0
              block $case4|0
               block $case3|0
                block $case1|0
                 get_local $0
                 i32.const 80
                 i32.ne
                 if
                  get_local $0
                  i32.const 81
                  i32.eq
                  br_if $case1|0
                  block $tablify|0
                   get_local $0
                   i32.const 82
                   i32.sub
                   br_table $folding-inner0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $folding-inner0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                  end
                  br $break|0
                 end
                 get_global $core/cpu/cpu/Cpu.registerB
                 set_global $core/cpu/cpu/Cpu.registerD
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerC
                set_global $core/cpu/cpu/Cpu.registerD
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerE
               set_global $core/cpu/cpu/Cpu.registerD
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerH
              set_global $core/cpu/cpu/Cpu.registerD
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             set_global $core/cpu/cpu/Cpu.registerD
             br $folding-inner0
            end
            get_global $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            get_global $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            call $core/cpu/opcodes/eightBitLoadSyncCycles
            i32.const 255
            i32.and
            set_global $core/cpu/cpu/Cpu.registerD
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerA
           set_global $core/cpu/cpu/Cpu.registerD
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerB
          set_global $core/cpu/cpu/Cpu.registerE
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerC
         set_global $core/cpu/cpu/Cpu.registerE
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerD
        set_global $core/cpu/cpu/Cpu.registerE
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerH
       set_global $core/cpu/cpu/Cpu.registerE
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerL
      set_global $core/cpu/cpu/Cpu.registerE
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     i32.const 255
     i32.and
     set_global $core/cpu/cpu/Cpu.registerE
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerA
    set_global $core/cpu/cpu/Cpu.registerE
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode6x (; 136 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner0
   block $break|0
    block $case15|0
     block $case14|0
      block $case12|0
       block $case11|0
        block $case10|0
         block $case9|0
          block $case8|0
           block $case7|0
            block $case6|0
             block $case5|0
              block $case3|0
               block $case2|0
                block $case1|0
                 get_local $0
                 i32.const 96
                 i32.ne
                 if
                  get_local $0
                  i32.const 97
                  i32.eq
                  br_if $case1|0
                  block $tablify|0
                   get_local $0
                   i32.const 98
                   i32.sub
                   br_table $case2|0 $case3|0 $folding-inner0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $folding-inner0 $case14|0 $case15|0 $tablify|0
                  end
                  br $break|0
                 end
                 get_global $core/cpu/cpu/Cpu.registerB
                 set_global $core/cpu/cpu/Cpu.registerH
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerC
                set_global $core/cpu/cpu/Cpu.registerH
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerD
               set_global $core/cpu/cpu/Cpu.registerH
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerE
              set_global $core/cpu/cpu/Cpu.registerH
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             set_global $core/cpu/cpu/Cpu.registerH
             br $folding-inner0
            end
            get_global $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            get_global $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            call $core/cpu/opcodes/eightBitLoadSyncCycles
            i32.const 255
            i32.and
            set_global $core/cpu/cpu/Cpu.registerH
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerA
           set_global $core/cpu/cpu/Cpu.registerH
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerB
          set_global $core/cpu/cpu/Cpu.registerL
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerC
         set_global $core/cpu/cpu/Cpu.registerL
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerD
        set_global $core/cpu/cpu/Cpu.registerL
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerE
       set_global $core/cpu/cpu/Cpu.registerL
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerH
      set_global $core/cpu/cpu/Cpu.registerL
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     i32.const 255
     i32.and
     set_global $core/cpu/cpu/Cpu.registerL
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerA
    set_global $core/cpu/cpu/Cpu.registerL
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode7x (; 137 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner0
   block $break|0
    block $case14|0
     block $case13|0
      block $case12|0
       block $case11|0
        block $case10|0
         block $case9|0
          block $case8|0
           block $case7|0
            block $case6|0
             block $case5|0
              block $case4|0
               block $case3|0
                block $case2|0
                 block $case1|0
                  get_local $0
                  i32.const 112
                  i32.ne
                  if
                   get_local $0
                   i32.const 113
                   i32.eq
                   br_if $case1|0
                   block $tablify|0
                    get_local $0
                    i32.const 114
                    i32.sub
                    br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $folding-inner0 $tablify|0
                   end
                   br $break|0
                  end
                  get_global $core/cpu/cpu/Cpu.registerL
                  i32.const 255
                  i32.and
                  get_global $core/cpu/cpu/Cpu.registerH
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  get_global $core/cpu/cpu/Cpu.registerB
                  call $core/cpu/opcodes/eightBitStoreSyncCycles
                  br $folding-inner0
                 end
                 get_global $core/cpu/cpu/Cpu.registerL
                 i32.const 255
                 i32.and
                 get_global $core/cpu/cpu/Cpu.registerH
                 i32.const 255
                 i32.and
                 i32.const 8
                 i32.shl
                 i32.or
                 get_global $core/cpu/cpu/Cpu.registerC
                 call $core/cpu/opcodes/eightBitStoreSyncCycles
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerL
                i32.const 255
                i32.and
                get_global $core/cpu/cpu/Cpu.registerH
                i32.const 255
                i32.and
                i32.const 8
                i32.shl
                i32.or
                get_global $core/cpu/cpu/Cpu.registerD
                call $core/cpu/opcodes/eightBitStoreSyncCycles
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerL
               i32.const 255
               i32.and
               get_global $core/cpu/cpu/Cpu.registerH
               i32.const 255
               i32.and
               i32.const 8
               i32.shl
               i32.or
               get_global $core/cpu/cpu/Cpu.registerE
               call $core/cpu/opcodes/eightBitStoreSyncCycles
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerL
              i32.const 255
              i32.and
              get_global $core/cpu/cpu/Cpu.registerH
              i32.const 255
              i32.and
              i32.const 8
              i32.shl
              i32.or
              get_global $core/cpu/cpu/Cpu.registerH
              call $core/cpu/opcodes/eightBitStoreSyncCycles
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             get_global $core/cpu/cpu/Cpu.registerL
             call $core/cpu/opcodes/eightBitStoreSyncCycles
             br $folding-inner0
            end
            get_global $core/memory/memory/Memory.isHblankHdmaActive
            i32.eqz
            if
             block $__inlined_func$core/cpu/cpu/Cpu.enableHalt
              get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
              if
               i32.const 1
               set_global $core/cpu/cpu/Cpu.isHaltNormal
               br $__inlined_func$core/cpu/cpu/Cpu.enableHalt
              end
              get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
              get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
              i32.and
              i32.const 31
              i32.and
              i32.eqz
              if
               i32.const 1
               set_global $core/cpu/cpu/Cpu.isHaltNoJump
               br $__inlined_func$core/cpu/cpu/Cpu.enableHalt
              end
              i32.const 1
              set_global $core/cpu/cpu/Cpu.isHaltBug
             end
            end
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           get_global $core/cpu/cpu/Cpu.registerH
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           get_global $core/cpu/cpu/Cpu.registerA
           call $core/cpu/opcodes/eightBitStoreSyncCycles
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerB
          set_global $core/cpu/cpu/Cpu.registerA
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerC
         set_global $core/cpu/cpu/Cpu.registerA
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerD
        set_global $core/cpu/cpu/Cpu.registerA
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerE
       set_global $core/cpu/cpu/Cpu.registerA
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerH
      set_global $core/cpu/cpu/Cpu.registerA
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     set_global $core/cpu/cpu/Cpu.registerA
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerL
    i32.const 255
    i32.and
    get_global $core/cpu/cpu/Cpu.registerH
    i32.const 255
    i32.and
    i32.const 8
    i32.shl
    i32.or
    call $core/cpu/opcodes/eightBitLoadSyncCycles
    i32.const 255
    i32.and
    set_global $core/cpu/cpu/Cpu.registerA
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/flags/checkAndSetEightBitCarryFlag (; 138 ;) (type $iiv) (param $0 i32) (param $1 i32)
  get_local $1
  i32.const 0
  i32.ge_s
  if
   get_local $0
   i32.const 255
   i32.and
   get_local $0
   get_local $1
   i32.add
   i32.const 255
   i32.and
   i32.gt_u
   if
    i32.const 1
    call $core/cpu/flags/setCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setCarryFlag
   end
  else   
   get_local $1
   i32.const 0
   get_local $1
   i32.sub
   get_local $1
   i32.const 0
   i32.gt_s
   select
   get_local $0
   i32.const 255
   i32.and
   i32.gt_s
   if
    i32.const 1
    call $core/cpu/flags/setCarryFlag
   else    
    i32.const 0
    call $core/cpu/flags/setCarryFlag
   end
  end
 )
 (func $core/cpu/instructions/addARegister (; 139 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.const 255
  i32.and
  tee_local $1
  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $1
  call $core/cpu/flags/checkAndSetEightBitCarryFlag
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.add
  i32.const 255
  i32.and
  set_global $core/cpu/cpu/Cpu.registerA
  get_global $core/cpu/cpu/Cpu.registerA
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/instructions/addAThroughCarryRegister (; 140 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.add
  get_global $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.add
  i32.const 255
  i32.and
  tee_local $1
  set_local $2
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.xor
  get_local $1
  i32.xor
  i32.const 16
  i32.and
  if
   i32.const 1
   call $core/cpu/flags/setHalfCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setHalfCarryFlag
  end
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.const 255
  i32.and
  i32.add
  get_global $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.add
  i32.const 256
  i32.and
  i32.const 0
  i32.gt_u
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $2
  set_global $core/cpu/cpu/Cpu.registerA
  get_global $core/cpu/cpu/Cpu.registerA
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/opcodes/handleOpcode8x (; 141 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner0
   block $break|0
    block $case15|0
     block $case14|0
      block $case13|0
       block $case12|0
        block $case11|0
         block $case10|0
          block $case9|0
           block $case8|0
            block $case7|0
             block $case6|0
              block $case5|0
               block $case4|0
                block $case3|0
                 block $case2|0
                  block $case1|0
                   get_local $0
                   tee_local $1
                   i32.const 128
                   i32.ne
                   if
                    get_local $1
                    i32.const 129
                    i32.sub
                    br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   get_global $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/addARegister
                   br $folding-inner0
                  end
                  get_global $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/addARegister
                  br $folding-inner0
                 end
                 get_global $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/addARegister
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/addARegister
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/addARegister
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/addARegister
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             call $core/cpu/opcodes/eightBitLoadSyncCycles
             call $core/cpu/instructions/addARegister
             br $folding-inner0
            end
            get_global $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/addARegister
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/addAThroughCarryRegister
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/addAThroughCarryRegister
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/addAThroughCarryRegister
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/addAThroughCarryRegister
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/addAThroughCarryRegister
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/addAThroughCarryRegister
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     call $core/cpu/instructions/addAThroughCarryRegister
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/addAThroughCarryRegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/instructions/subARegister (; 142 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.const 255
  i32.and
  i32.const -1
  i32.mul
  tee_local $1
  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $1
  call $core/cpu/flags/checkAndSetEightBitCarryFlag
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.sub
  i32.const 255
  i32.and
  set_global $core/cpu/cpu/Cpu.registerA
  get_global $core/cpu/cpu/Cpu.registerA
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 1
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/instructions/subAThroughCarryRegister (; 143 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.sub
  get_global $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.sub
  i32.const 255
  i32.and
  tee_local $1
  set_local $2
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.xor
  get_local $1
  i32.xor
  i32.const 16
  i32.and
  if
   i32.const 1
   call $core/cpu/flags/setHalfCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setHalfCarryFlag
  end
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.const 255
  i32.and
  i32.sub
  get_global $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.sub
  i32.const 256
  i32.and
  i32.const 0
  i32.gt_u
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $2
  set_global $core/cpu/cpu/Cpu.registerA
  get_global $core/cpu/cpu/Cpu.registerA
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 1
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/opcodes/handleOpcode9x (; 144 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner0
   block $break|0
    block $case15|0
     block $case14|0
      block $case13|0
       block $case12|0
        block $case11|0
         block $case10|0
          block $case9|0
           block $case8|0
            block $case7|0
             block $case6|0
              block $case5|0
               block $case4|0
                block $case3|0
                 block $case2|0
                  block $case1|0
                   get_local $0
                   tee_local $1
                   i32.const 144
                   i32.ne
                   if
                    get_local $1
                    i32.const 145
                    i32.sub
                    br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   get_global $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/subARegister
                   br $folding-inner0
                  end
                  get_global $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/subARegister
                  br $folding-inner0
                 end
                 get_global $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/subARegister
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/subARegister
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/subARegister
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/subARegister
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             call $core/cpu/opcodes/eightBitLoadSyncCycles
             call $core/cpu/instructions/subARegister
             br $folding-inner0
            end
            get_global $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/subARegister
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/subAThroughCarryRegister
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/subAThroughCarryRegister
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/subAThroughCarryRegister
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/subAThroughCarryRegister
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/subAThroughCarryRegister
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/subAThroughCarryRegister
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     call $core/cpu/instructions/subAThroughCarryRegister
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/subAThroughCarryRegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/instructions/andARegister (; 145 ;) (type $iv) (param $0 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.and
  set_global $core/cpu/cpu/Cpu.registerA
  get_global $core/cpu/cpu/Cpu.registerA
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 1
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
 )
 (func $core/cpu/instructions/xorARegister (; 146 ;) (type $iv) (param $0 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.xor
  i32.const 255
  i32.and
  set_global $core/cpu/cpu/Cpu.registerA
  get_global $core/cpu/cpu/Cpu.registerA
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
 )
 (func $core/cpu/opcodes/handleOpcodeAx (; 147 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner0
   block $break|0
    block $case15|0
     block $case14|0
      block $case13|0
       block $case12|0
        block $case11|0
         block $case10|0
          block $case9|0
           block $case8|0
            block $case7|0
             block $case6|0
              block $case5|0
               block $case4|0
                block $case3|0
                 block $case2|0
                  block $case1|0
                   get_local $0
                   tee_local $1
                   i32.const 160
                   i32.ne
                   if
                    get_local $1
                    i32.const 161
                    i32.sub
                    br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   get_global $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/andARegister
                   br $folding-inner0
                  end
                  get_global $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/andARegister
                  br $folding-inner0
                 end
                 get_global $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/andARegister
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/andARegister
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/andARegister
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/andARegister
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             call $core/cpu/opcodes/eightBitLoadSyncCycles
             call $core/cpu/instructions/andARegister
             br $folding-inner0
            end
            get_global $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/andARegister
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/xorARegister
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/xorARegister
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/xorARegister
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/xorARegister
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/xorARegister
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/xorARegister
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     call $core/cpu/instructions/xorARegister
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/xorARegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/instructions/orARegister (; 148 ;) (type $iv) (param $0 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.or
  i32.const 255
  i32.and
  set_global $core/cpu/cpu/Cpu.registerA
  get_global $core/cpu/cpu/Cpu.registerA
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
 )
 (func $core/cpu/instructions/cpARegister (; 149 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $0
  i32.const 255
  i32.and
  i32.const -1
  i32.mul
  tee_local $1
  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $1
  call $core/cpu/flags/checkAndSetEightBitCarryFlag
  get_global $core/cpu/cpu/Cpu.registerA
  get_local $1
  i32.add
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 1
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/opcodes/handleOpcodeBx (; 150 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner0
   block $break|0
    block $case15|0
     block $case14|0
      block $case13|0
       block $case12|0
        block $case11|0
         block $case10|0
          block $case9|0
           block $case8|0
            block $case7|0
             block $case6|0
              block $case5|0
               block $case4|0
                block $case3|0
                 block $case2|0
                  block $case1|0
                   get_local $0
                   tee_local $1
                   i32.const 176
                   i32.ne
                   if
                    get_local $1
                    i32.const 177
                    i32.sub
                    br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   get_global $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/orARegister
                   br $folding-inner0
                  end
                  get_global $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/orARegister
                  br $folding-inner0
                 end
                 get_global $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/orARegister
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/orARegister
                br $folding-inner0
               end
               get_global $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/orARegister
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/orARegister
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             call $core/cpu/opcodes/eightBitLoadSyncCycles
             call $core/cpu/instructions/orARegister
             br $folding-inner0
            end
            get_global $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/orARegister
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/cpARegister
           br $folding-inner0
          end
          get_global $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/cpARegister
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/cpARegister
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/cpARegister
        br $folding-inner0
       end
       get_global $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/cpARegister
       br $folding-inner0
      end
      get_global $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/cpARegister
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     call $core/cpu/instructions/cpARegister
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/cpARegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/memory/load/sixteenBitLoadFromGBMemory (; 151 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  get_local $0
  call $core/memory/readTraps/checkReadTraps
  tee_local $1
  i32.const -1
  i32.eq
  if (result i32)
   get_local $0
   call $core/memory/load/eightBitLoadFromGBMemory
  else   
   get_local $1
  end
  i32.const 255
  i32.and
  get_local $0
  i32.const 1
  i32.add
  tee_local $1
  call $core/memory/readTraps/checkReadTraps
  tee_local $0
  i32.const -1
  i32.eq
  if (result i32)
   get_local $1
   call $core/memory/load/eightBitLoadFromGBMemory
  else   
   get_local $0
  end
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/cpu/opcodes/sixteenBitLoadSyncCycles (; 152 ;) (type $ii) (param $0 i32) (result i32)
  i32.const 8
  call $core/cycles/syncCycles
  get_local $0
  call $core/memory/load/sixteenBitLoadFromGBMemory
 )
 (func $core/cpu/instructions/rotateRegisterLeft (; 153 ;) (type $ii) (param $0 i32) (result i32)
  get_local $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $0
  i32.const 1
  i32.shl
  get_local $0
  i32.const 255
  i32.and
  i32.const 7
  i32.shr_u
  i32.or
  i32.const 255
  i32.and
  tee_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  get_local $0
 )
 (func $core/cpu/instructions/rotateRegisterRight (; 154 ;) (type $ii) (param $0 i32) (result i32)
  get_local $0
  i32.const 1
  i32.and
  i32.const 0
  i32.gt_u
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $0
  i32.const 7
  i32.shl
  get_local $0
  i32.const 255
  i32.and
  i32.const 1
  i32.shr_u
  i32.or
  i32.const 255
  i32.and
  tee_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  get_local $0
 )
 (func $core/cpu/instructions/rotateRegisterLeftThroughCarry (; 155 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  i32.const 1
  i32.const 0
  get_local $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  select
  set_local $1
  get_global $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  get_local $0
  i32.const 1
  i32.shl
  i32.or
  i32.const 255
  i32.and
  set_local $0
  get_local $1
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  get_local $0
 )
 (func $core/cpu/instructions/rotateRegisterRightThroughCarry (; 156 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  i32.const 1
  i32.const 0
  get_local $0
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  select
  set_local $1
  get_global $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.const 7
  i32.shl
  get_local $0
  i32.const 255
  i32.and
  i32.const 1
  i32.shr_u
  i32.or
  set_local $0
  get_local $1
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  get_local $0
 )
 (func $core/cpu/instructions/shiftLeftRegister (; 157 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  i32.const 1
  i32.const 0
  get_local $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  select
  set_local $1
  get_local $0
  i32.const 1
  i32.shl
  i32.const 255
  i32.and
  set_local $0
  get_local $1
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  get_local $0
 )
 (func $core/cpu/instructions/shiftRightArithmeticRegister (; 158 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 1
  i32.const 0
  get_local $0
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  select
  set_local $1
  i32.const 1
  i32.const 0
  get_local $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  select
  set_local $2
  get_local $0
  i32.const 255
  i32.and
  i32.const 1
  i32.shr_u
  tee_local $0
  i32.const 128
  i32.or
  get_local $0
  get_local $2
  select
  tee_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  get_local $1
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $0
 )
 (func $core/cpu/instructions/swapNibblesOnRegister (; 159 ;) (type $ii) (param $0 i32) (result i32)
  get_local $0
  i32.const 15
  i32.and
  i32.const 4
  i32.shl
  get_local $0
  i32.const 240
  i32.and
  i32.const 4
  i32.shr_u
  i32.or
  tee_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
  get_local $0
 )
 (func $core/cpu/instructions/shiftRightLogicalRegister (; 160 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  i32.const 1
  i32.const 0
  get_local $0
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  select
  set_local $1
  get_local $0
  i32.const 255
  i32.and
  i32.const 1
  i32.shr_u
  tee_local $0
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  get_local $1
  if
   i32.const 1
   call $core/cpu/flags/setCarryFlag
  else   
   i32.const 0
   call $core/cpu/flags/setCarryFlag
  end
  get_local $0
 )
 (func $core/cpu/instructions/testBitOnRegister (; 161 ;) (type $iii) (param $0 i32) (param $1 i32) (result i32)
  i32.const 1
  get_local $0
  i32.shl
  get_local $1
  i32.and
  i32.const 255
  i32.and
  if
   i32.const 0
   call $core/cpu/flags/setZeroFlag
  else   
   i32.const 1
   call $core/cpu/flags/setZeroFlag
  end
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 1
  call $core/cpu/flags/setHalfCarryFlag
  get_local $1
 )
 (func $core/cpu/cbOpcodes/handleCbOpcode (; 162 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  block $break|0
   block $case7|0
    block $case6|0
     block $case5|0
      block $case4|0
       block $case3|0
        block $case2|0
         block $case1|0
          get_local $0
          i32.const 8
          i32.rem_s
          tee_local $6
          tee_local $5
          if
           get_local $5
           i32.const 1
           i32.sub
           br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $break|0
          end
          get_global $core/cpu/cpu/Cpu.registerB
          set_local $1
          br $break|0
         end
         get_global $core/cpu/cpu/Cpu.registerC
         set_local $1
         br $break|0
        end
        get_global $core/cpu/cpu/Cpu.registerD
        set_local $1
        br $break|0
       end
       get_global $core/cpu/cpu/Cpu.registerE
       set_local $1
       br $break|0
      end
      get_global $core/cpu/cpu/Cpu.registerH
      set_local $1
      br $break|0
     end
     get_global $core/cpu/cpu/Cpu.registerL
     set_local $1
     br $break|0
    end
    get_global $core/cpu/cpu/Cpu.registerL
    i32.const 255
    i32.and
    get_global $core/cpu/cpu/Cpu.registerH
    i32.const 255
    i32.and
    i32.const 8
    i32.shl
    i32.or
    call $core/cpu/opcodes/eightBitLoadSyncCycles
    set_local $1
    br $break|0
   end
   get_global $core/cpu/cpu/Cpu.registerA
   set_local $1
  end
  block $break|1
   block $case15|1
    block $case14|1
     block $case13|1
      block $case12|1
       block $case11|1
        block $case10|1
         block $case9|1
          block $case8|1
           block $case7|1
            block $case6|1
             block $case5|1
              block $case4|1
               block $case3|1
                block $case2|1
                 block $case1|1
                  get_local $0
                  i32.const 240
                  i32.and
                  i32.const 4
                  i32.shr_s
                  tee_local $5
                  tee_local $4
                  if
                   get_local $4
                   i32.const 1
                   i32.sub
                   br_table $case1|1 $case2|1 $case3|1 $case4|1 $case5|1 $case6|1 $case7|1 $case8|1 $case9|1 $case10|1 $case11|1 $case12|1 $case13|1 $case14|1 $case15|1 $break|1
                  end
                  get_local $0
                  i32.const 7
                  i32.le_s
                  if (result i32)
                   i32.const 1
                   set_local $2
                   get_local $1
                   call $core/cpu/instructions/rotateRegisterLeft
                  else                   
                   get_local $0
                   i32.const 15
                   i32.le_s
                   if (result i32)
                    i32.const 1
                    set_local $2
                    get_local $1
                    call $core/cpu/instructions/rotateRegisterRight
                   else                    
                    i32.const 0
                   end
                  end
                  set_local $3
                  br $break|1
                 end
                 get_local $0
                 i32.const 23
                 i32.le_s
                 if (result i32)
                  i32.const 1
                  set_local $2
                  get_local $1
                  call $core/cpu/instructions/rotateRegisterLeftThroughCarry
                 else                  
                  get_local $0
                  i32.const 31
                  i32.le_s
                  if (result i32)
                   i32.const 1
                   set_local $2
                   get_local $1
                   call $core/cpu/instructions/rotateRegisterRightThroughCarry
                  else                   
                   i32.const 0
                  end
                 end
                 set_local $3
                 br $break|1
                end
                get_local $0
                i32.const 39
                i32.le_s
                if (result i32)
                 i32.const 1
                 set_local $2
                 get_local $1
                 call $core/cpu/instructions/shiftLeftRegister
                else                 
                 get_local $0
                 i32.const 47
                 i32.le_s
                 if (result i32)
                  i32.const 1
                  set_local $2
                  get_local $1
                  call $core/cpu/instructions/shiftRightArithmeticRegister
                 else                  
                  i32.const 0
                 end
                end
                set_local $3
                br $break|1
               end
               get_local $0
               i32.const 55
               i32.le_s
               if (result i32)
                i32.const 1
                set_local $2
                get_local $1
                call $core/cpu/instructions/swapNibblesOnRegister
               else                
                get_local $0
                i32.const 63
                i32.le_s
                if (result i32)
                 i32.const 1
                 set_local $2
                 get_local $1
                 call $core/cpu/instructions/shiftRightLogicalRegister
                else                 
                 i32.const 0
                end
               end
               set_local $3
               br $break|1
              end
              get_local $0
              i32.const 71
              i32.le_s
              if (result i32)
               i32.const 1
               set_local $2
               i32.const 0
               get_local $1
               call $core/cpu/instructions/testBitOnRegister
              else               
               get_local $0
               i32.const 79
               i32.le_s
               if (result i32)
                i32.const 1
                set_local $2
                i32.const 1
                get_local $1
                call $core/cpu/instructions/testBitOnRegister
               else                
                i32.const 0
               end
              end
              set_local $3
              br $break|1
             end
             get_local $0
             i32.const 87
             i32.le_s
             if (result i32)
              i32.const 1
              set_local $2
              i32.const 2
              get_local $1
              call $core/cpu/instructions/testBitOnRegister
             else              
              get_local $0
              i32.const 95
              i32.le_s
              if (result i32)
               i32.const 1
               set_local $2
               i32.const 3
               get_local $1
               call $core/cpu/instructions/testBitOnRegister
              else               
               i32.const 0
              end
             end
             set_local $3
             br $break|1
            end
            get_local $0
            i32.const 103
            i32.le_s
            if (result i32)
             i32.const 1
             set_local $2
             i32.const 4
             get_local $1
             call $core/cpu/instructions/testBitOnRegister
            else             
             get_local $0
             i32.const 111
             i32.le_s
             if (result i32)
              i32.const 1
              set_local $2
              i32.const 5
              get_local $1
              call $core/cpu/instructions/testBitOnRegister
             else              
              i32.const 0
             end
            end
            set_local $3
            br $break|1
           end
           get_local $0
           i32.const 119
           i32.le_s
           if (result i32)
            i32.const 1
            set_local $2
            i32.const 6
            get_local $1
            call $core/cpu/instructions/testBitOnRegister
           else            
            get_local $0
            i32.const 127
            i32.le_s
            if (result i32)
             i32.const 1
             set_local $2
             i32.const 7
             get_local $1
             call $core/cpu/instructions/testBitOnRegister
            else             
             i32.const 0
            end
           end
           set_local $3
           br $break|1
          end
          get_local $0
          i32.const 135
          i32.le_s
          if (result i32)
           i32.const 1
           set_local $2
           get_local $1
           i32.const -2
           i32.and
          else           
           get_local $0
           i32.const 143
           i32.le_s
           if (result i32)
            i32.const 1
            set_local $2
            get_local $1
            i32.const -3
            i32.and
           else            
            i32.const 0
           end
          end
          set_local $3
          br $break|1
         end
         get_local $0
         i32.const 151
         i32.le_s
         if (result i32)
          i32.const 1
          set_local $2
          get_local $1
          i32.const -5
          i32.and
         else          
          get_local $0
          i32.const 159
          i32.le_s
          if (result i32)
           i32.const 1
           set_local $2
           get_local $1
           i32.const -9
           i32.and
          else           
           i32.const 0
          end
         end
         set_local $3
         br $break|1
        end
        get_local $0
        i32.const 167
        i32.le_s
        if (result i32)
         i32.const 1
         set_local $2
         get_local $1
         i32.const -17
         i32.and
        else         
         get_local $0
         i32.const 175
         i32.le_s
         if (result i32)
          i32.const 1
          set_local $2
          get_local $1
          i32.const -33
          i32.and
         else          
          i32.const 0
         end
        end
        set_local $3
        br $break|1
       end
       get_local $0
       i32.const 183
       i32.le_s
       if (result i32)
        i32.const 1
        set_local $2
        get_local $1
        i32.const -65
        i32.and
       else        
        get_local $0
        i32.const 191
        i32.le_s
        if (result i32)
         i32.const 1
         set_local $2
         get_local $1
         i32.const -129
         i32.and
        else         
         i32.const 0
        end
       end
       set_local $3
       br $break|1
      end
      get_local $0
      i32.const 199
      i32.le_s
      if (result i32)
       i32.const 1
       set_local $2
       get_local $1
       i32.const 1
       i32.or
      else       
       get_local $0
       i32.const 207
       i32.le_s
       if (result i32)
        i32.const 1
        set_local $2
        get_local $1
        i32.const 2
        i32.or
       else        
        i32.const 0
       end
      end
      set_local $3
      br $break|1
     end
     get_local $0
     i32.const 215
     i32.le_s
     if (result i32)
      i32.const 1
      set_local $2
      get_local $1
      i32.const 4
      i32.or
     else      
      get_local $0
      i32.const 223
      i32.le_s
      if (result i32)
       i32.const 1
       set_local $2
       get_local $1
       i32.const 8
       i32.or
      else       
       i32.const 0
      end
     end
     set_local $3
     br $break|1
    end
    get_local $0
    i32.const 231
    i32.le_s
    if (result i32)
     i32.const 1
     set_local $2
     get_local $1
     i32.const 16
     i32.or
    else     
     get_local $0
     i32.const 239
     i32.le_s
     if (result i32)
      i32.const 1
      set_local $2
      get_local $1
      i32.const 32
      i32.or
     else      
      i32.const 0
     end
    end
    set_local $3
    br $break|1
   end
   get_local $0
   i32.const 247
   i32.le_s
   if (result i32)
    i32.const 1
    set_local $2
    get_local $1
    i32.const 64
    i32.or
   else    
    get_local $0
    i32.const 255
    i32.le_s
    if (result i32)
     i32.const 1
     set_local $2
     get_local $1
     i32.const 128
     i32.or
    else     
     i32.const 0
    end
   end
   set_local $3
  end
  block $break|2
   block $case7|2
    block $case6|2
     block $case5|2
      block $case4|2
       block $case3|2
        block $case2|2
         block $case1|2
          get_local $6
          tee_local $4
          if
           get_local $4
           i32.const 1
           i32.sub
           br_table $case1|2 $case2|2 $case3|2 $case4|2 $case5|2 $case6|2 $case7|2 $break|2
          end
          get_local $3
          set_global $core/cpu/cpu/Cpu.registerB
          br $break|2
         end
         get_local $3
         set_global $core/cpu/cpu/Cpu.registerC
         br $break|2
        end
        get_local $3
        set_global $core/cpu/cpu/Cpu.registerD
        br $break|2
       end
       get_local $3
       set_global $core/cpu/cpu/Cpu.registerE
       br $break|2
      end
      get_local $3
      set_global $core/cpu/cpu/Cpu.registerH
      br $break|2
     end
     get_local $3
     set_global $core/cpu/cpu/Cpu.registerL
     br $break|2
    end
    get_local $5
    i32.const 4
    i32.lt_s
    tee_local $4
    if (result i32)
     get_local $4
    else     
     get_local $5
     i32.const 7
     i32.gt_s
    end
    if
     get_global $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     get_global $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     get_local $3
     call $core/cpu/opcodes/eightBitStoreSyncCycles
    end
    br $break|2
   end
   get_local $3
   set_global $core/cpu/cpu/Cpu.registerA
  end
  i32.const 4
  i32.const -1
  get_local $2
  select
 )
 (func $core/cpu/opcodes/handleOpcodeCx (; 163 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner5
   block $folding-inner4
    block $folding-inner3
     block $folding-inner2
      block $folding-inner1
       block $folding-inner0
        block $break|0
         block $case15|0
          block $case14|0
           block $case12|0
            block $case11|0
             block $case10|0
              block $case9|0
               block $case8|0
                block $case7|0
                 block $case6|0
                  block $case5|0
                   block $case4|0
                    block $case2|0
                     block $case1|0
                      get_local $0
                      i32.const 192
                      i32.ne
                      if
                       get_local $0
                       i32.const 193
                       i32.sub
                       br_table $case1|0 $case2|0 $folding-inner4 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $folding-inner3 $case14|0 $case15|0 $break|0
                      end
                      get_global $core/cpu/cpu/Cpu.registerF
                      i32.const 7
                      i32.shr_u
                      i32.const 1
                      i32.and
                      br_if $folding-inner5
                      br $folding-inner1
                     end
                     get_global $core/cpu/cpu/Cpu.stackPointer
                     call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                     i32.const 65535
                     i32.and
                     set_local $0
                     get_global $core/cpu/cpu/Cpu.stackPointer
                     i32.const 2
                     i32.add
                     i32.const 65535
                     i32.and
                     set_global $core/cpu/cpu/Cpu.stackPointer
                     get_local $0
                     i32.const 65280
                     i32.and
                     i32.const 8
                     i32.shr_s
                     set_global $core/cpu/cpu/Cpu.registerB
                     get_local $0
                     i32.const 255
                     i32.and
                     set_global $core/cpu/cpu/Cpu.registerC
                     i32.const 4
                     return
                    end
                    get_global $core/cpu/cpu/Cpu.registerF
                    i32.const 7
                    i32.shr_u
                    i32.const 1
                    i32.and
                    br_if $folding-inner2
                    br $folding-inner4
                   end
                   get_global $core/cpu/cpu/Cpu.registerF
                   i32.const 7
                   i32.shr_u
                   i32.const 1
                   i32.and
                   br_if $folding-inner2
                   br $folding-inner3
                  end
                  get_global $core/cpu/cpu/Cpu.stackPointer
                  i32.const 2
                  i32.sub
                  i32.const 65535
                  i32.and
                  set_global $core/cpu/cpu/Cpu.stackPointer
                  get_global $core/cpu/cpu/Cpu.stackPointer
                  get_global $core/cpu/cpu/Cpu.registerC
                  i32.const 255
                  i32.and
                  get_global $core/cpu/cpu/Cpu.registerB
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                  br $folding-inner5
                 end
                 call $core/cpu/opcodes/getDataByteOne
                 call $core/cpu/instructions/addARegister
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.stackPointer
                i32.const 2
                i32.sub
                i32.const 65535
                i32.and
                set_global $core/cpu/cpu/Cpu.stackPointer
                get_global $core/cpu/cpu/Cpu.stackPointer
                get_global $core/cpu/cpu/Cpu.programCounter
                call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                i32.const 0
                set_global $core/cpu/cpu/Cpu.programCounter
                br $folding-inner5
               end
               get_global $core/cpu/cpu/Cpu.registerF
               i32.const 7
               i32.shr_u
               i32.const 1
               i32.and
               i32.const 1
               i32.ne
               br_if $folding-inner5
               br $folding-inner1
              end
              get_global $core/cpu/cpu/Cpu.stackPointer
              call $core/cpu/opcodes/sixteenBitLoadSyncCycles
              i32.const 65535
              i32.and
              set_global $core/cpu/cpu/Cpu.programCounter
              get_global $core/cpu/cpu/Cpu.stackPointer
              i32.const 2
              i32.add
              i32.const 65535
              i32.and
              set_global $core/cpu/cpu/Cpu.stackPointer
              br $folding-inner5
             end
             get_global $core/cpu/cpu/Cpu.registerF
             i32.const 7
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 1
             i32.eq
             br_if $folding-inner4
             br $folding-inner2
            end
            call $core/cpu/opcodes/getDataByteOne
            i32.const 255
            i32.and
            call $core/cpu/cbOpcodes/handleCbOpcode
            set_local $0
            get_global $core/cpu/cpu/Cpu.programCounter
            i32.const 1
            i32.add
            i32.const 65535
            i32.and
            set_global $core/cpu/cpu/Cpu.programCounter
            get_local $0
            return
           end
           get_global $core/cpu/cpu/Cpu.registerF
           i32.const 7
           i32.shr_u
           i32.const 1
           i32.and
           i32.const 1
           i32.ne
           br_if $folding-inner2
           get_global $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           set_global $core/cpu/cpu/Cpu.stackPointer
           get_global $core/cpu/cpu/Cpu.stackPointer
           get_global $core/cpu/cpu/Cpu.programCounter
           i32.const 2
           i32.add
           i32.const 65535
           i32.and
           call $core/cpu/opcodes/sixteenBitStoreSyncCycles
           br $folding-inner4
          end
          call $core/cpu/opcodes/getDataByteOne
          call $core/cpu/instructions/addAThroughCarryRegister
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.stackPointer
         i32.const 2
         i32.sub
         i32.const 65535
         i32.and
         set_global $core/cpu/cpu/Cpu.stackPointer
         get_global $core/cpu/cpu/Cpu.stackPointer
         get_global $core/cpu/cpu/Cpu.programCounter
         call $core/cpu/opcodes/sixteenBitStoreSyncCycles
         i32.const 8
         set_global $core/cpu/cpu/Cpu.programCounter
         br $folding-inner5
        end
        i32.const -1
        return
       end
       get_global $core/cpu/cpu/Cpu.programCounter
       i32.const 1
       i32.add
       i32.const 65535
       i32.and
       set_global $core/cpu/cpu/Cpu.programCounter
       i32.const 4
       return
      end
      get_global $core/cpu/cpu/Cpu.stackPointer
      call $core/cpu/opcodes/sixteenBitLoadSyncCycles
      i32.const 65535
      i32.and
      set_global $core/cpu/cpu/Cpu.programCounter
      get_global $core/cpu/cpu/Cpu.stackPointer
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      set_global $core/cpu/cpu/Cpu.stackPointer
      i32.const 12
      return
     end
     get_global $core/cpu/cpu/Cpu.programCounter
     i32.const 2
     i32.add
     i32.const 65535
     i32.and
     set_global $core/cpu/cpu/Cpu.programCounter
     i32.const 12
     return
    end
    get_global $core/cpu/cpu/Cpu.stackPointer
    i32.const 2
    i32.sub
    i32.const 65535
    i32.and
    set_global $core/cpu/cpu/Cpu.stackPointer
    get_global $core/cpu/cpu/Cpu.stackPointer
    get_global $core/cpu/cpu/Cpu.programCounter
    i32.const 2
    i32.add
    i32.const 65535
    i32.and
    call $core/cpu/opcodes/sixteenBitStoreSyncCycles
   end
   call $core/cpu/opcodes/getConcatenatedDataByte
   i32.const 65535
   i32.and
   set_global $core/cpu/cpu/Cpu.programCounter
  end
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcodeDx (; 164 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner4
   block $folding-inner3
    block $folding-inner2
     block $folding-inner1
      block $folding-inner0
       block $break|0
        block $case12|0
         block $case11|0
          block $case10|0
           block $case9|0
            block $case8|0
             block $case7|0
              block $case6|0
               block $case5|0
                block $case4|0
                 block $case3|0
                  block $case2|0
                   block $case1|0
                    get_local $0
                    i32.const 208
                    i32.ne
                    if
                     get_local $0
                     i32.const 209
                     i32.sub
                     br_table $case1|0 $case2|0 $break|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $break|0 $case10|0 $break|0 $case11|0 $case12|0 $break|0
                    end
                    get_global $core/cpu/cpu/Cpu.registerF
                    i32.const 4
                    i32.shr_u
                    i32.const 1
                    i32.and
                    br_if $folding-inner4
                    br $folding-inner1
                   end
                   get_global $core/cpu/cpu/Cpu.stackPointer
                   call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                   i32.const 65535
                   i32.and
                   set_local $0
                   get_global $core/cpu/cpu/Cpu.stackPointer
                   i32.const 2
                   i32.add
                   i32.const 65535
                   i32.and
                   set_global $core/cpu/cpu/Cpu.stackPointer
                   get_local $0
                   i32.const 65280
                   i32.and
                   i32.const 8
                   i32.shr_s
                   set_global $core/cpu/cpu/Cpu.registerD
                   get_local $0
                   i32.const 255
                   i32.and
                   set_global $core/cpu/cpu/Cpu.registerE
                   i32.const 4
                   return
                  end
                  get_global $core/cpu/cpu/Cpu.registerF
                  i32.const 4
                  i32.shr_u
                  i32.const 1
                  i32.and
                  br_if $folding-inner2
                  br $folding-inner3
                 end
                 get_global $core/cpu/cpu/Cpu.registerF
                 i32.const 4
                 i32.shr_u
                 i32.const 1
                 i32.and
                 br_if $folding-inner2
                 get_global $core/cpu/cpu/Cpu.stackPointer
                 i32.const 2
                 i32.sub
                 i32.const 65535
                 i32.and
                 set_global $core/cpu/cpu/Cpu.stackPointer
                 get_global $core/cpu/cpu/Cpu.stackPointer
                 get_global $core/cpu/cpu/Cpu.programCounter
                 i32.const 2
                 i32.add
                 i32.const 65535
                 i32.and
                 call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                 br $folding-inner3
                end
                get_global $core/cpu/cpu/Cpu.stackPointer
                i32.const 2
                i32.sub
                i32.const 65535
                i32.and
                set_global $core/cpu/cpu/Cpu.stackPointer
                get_global $core/cpu/cpu/Cpu.stackPointer
                get_global $core/cpu/cpu/Cpu.registerE
                i32.const 255
                i32.and
                get_global $core/cpu/cpu/Cpu.registerD
                i32.const 255
                i32.and
                i32.const 8
                i32.shl
                i32.or
                call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                br $folding-inner4
               end
               call $core/cpu/opcodes/getDataByteOne
               call $core/cpu/instructions/subARegister
               br $folding-inner0
              end
              get_global $core/cpu/cpu/Cpu.stackPointer
              i32.const 2
              i32.sub
              i32.const 65535
              i32.and
              set_global $core/cpu/cpu/Cpu.stackPointer
              get_global $core/cpu/cpu/Cpu.stackPointer
              get_global $core/cpu/cpu/Cpu.programCounter
              call $core/cpu/opcodes/sixteenBitStoreSyncCycles
              i32.const 16
              set_global $core/cpu/cpu/Cpu.programCounter
              br $folding-inner4
             end
             get_global $core/cpu/cpu/Cpu.registerF
             i32.const 4
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 1
             i32.ne
             br_if $folding-inner4
             br $folding-inner1
            end
            get_global $core/cpu/cpu/Cpu.stackPointer
            call $core/cpu/opcodes/sixteenBitLoadSyncCycles
            i32.const 65535
            i32.and
            set_global $core/cpu/cpu/Cpu.programCounter
            i32.const 1
            set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
            get_global $core/cpu/cpu/Cpu.stackPointer
            i32.const 2
            i32.add
            i32.const 65535
            i32.and
            set_global $core/cpu/cpu/Cpu.stackPointer
            br $folding-inner4
           end
           get_global $core/cpu/cpu/Cpu.registerF
           i32.const 4
           i32.shr_u
           i32.const 1
           i32.and
           i32.const 1
           i32.eq
           br_if $folding-inner3
           br $folding-inner2
          end
          get_global $core/cpu/cpu/Cpu.registerF
          i32.const 4
          i32.shr_u
          i32.const 1
          i32.and
          i32.const 1
          i32.ne
          br_if $folding-inner2
          get_global $core/cpu/cpu/Cpu.stackPointer
          i32.const 2
          i32.sub
          i32.const 65535
          i32.and
          set_global $core/cpu/cpu/Cpu.stackPointer
          get_global $core/cpu/cpu/Cpu.stackPointer
          get_global $core/cpu/cpu/Cpu.programCounter
          i32.const 2
          i32.add
          i32.const 65535
          i32.and
          call $core/cpu/opcodes/sixteenBitStoreSyncCycles
          br $folding-inner3
         end
         call $core/cpu/opcodes/getDataByteOne
         call $core/cpu/instructions/subAThroughCarryRegister
         br $folding-inner0
        end
        get_global $core/cpu/cpu/Cpu.stackPointer
        i32.const 2
        i32.sub
        i32.const 65535
        i32.and
        set_global $core/cpu/cpu/Cpu.stackPointer
        get_global $core/cpu/cpu/Cpu.stackPointer
        get_global $core/cpu/cpu/Cpu.programCounter
        call $core/cpu/opcodes/sixteenBitStoreSyncCycles
        i32.const 24
        set_global $core/cpu/cpu/Cpu.programCounter
        br $folding-inner4
       end
       i32.const -1
       return
      end
      get_global $core/cpu/cpu/Cpu.programCounter
      i32.const 1
      i32.add
      i32.const 65535
      i32.and
      set_global $core/cpu/cpu/Cpu.programCounter
      i32.const 4
      return
     end
     get_global $core/cpu/cpu/Cpu.stackPointer
     call $core/cpu/opcodes/sixteenBitLoadSyncCycles
     i32.const 65535
     i32.and
     set_global $core/cpu/cpu/Cpu.programCounter
     get_global $core/cpu/cpu/Cpu.stackPointer
     i32.const 2
     i32.add
     i32.const 65535
     i32.and
     set_global $core/cpu/cpu/Cpu.stackPointer
     i32.const 12
     return
    end
    get_global $core/cpu/cpu/Cpu.programCounter
    i32.const 2
    i32.add
    i32.const 65535
    i32.and
    set_global $core/cpu/cpu/Cpu.programCounter
    i32.const 12
    return
   end
   call $core/cpu/opcodes/getConcatenatedDataByte
   i32.const 65535
   i32.and
   set_global $core/cpu/cpu/Cpu.programCounter
  end
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcodeEx (; 165 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner0
   block $break|0
    block $case10|0
     block $case9|0
      block $case8|0
       block $case7|0
        block $case6|0
         block $case5|0
          block $case4|0
           block $case3|0
            block $case2|0
             block $case1|0
              get_local $0
              i32.const 224
              i32.ne
              if
               get_local $0
               i32.const 225
               i32.sub
               br_table $case1|0 $case2|0 $break|0 $break|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $break|0 $break|0 $break|0 $case9|0 $case10|0 $break|0
              end
              call $core/cpu/opcodes/getDataByteOne
              i32.const 255
              i32.and
              i32.const 65280
              i32.add
              get_global $core/cpu/cpu/Cpu.registerA
              call $core/cpu/opcodes/eightBitStoreSyncCycles
              br $folding-inner0
             end
             get_global $core/cpu/cpu/Cpu.stackPointer
             call $core/cpu/opcodes/sixteenBitLoadSyncCycles
             i32.const 65535
             i32.and
             set_local $0
             get_global $core/cpu/cpu/Cpu.stackPointer
             i32.const 2
             i32.add
             i32.const 65535
             i32.and
             set_global $core/cpu/cpu/Cpu.stackPointer
             get_local $0
             i32.const 65280
             i32.and
             i32.const 8
             i32.shr_s
             set_global $core/cpu/cpu/Cpu.registerH
             get_local $0
             i32.const 255
             i32.and
             set_global $core/cpu/cpu/Cpu.registerL
             i32.const 4
             return
            end
            get_global $core/cpu/cpu/Cpu.registerC
            i32.const 65280
            i32.add
            get_global $core/cpu/cpu/Cpu.registerA
            call $core/cpu/opcodes/eightBitStoreSyncCycles
            i32.const 4
            return
           end
           get_global $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           set_global $core/cpu/cpu/Cpu.stackPointer
           get_global $core/cpu/cpu/Cpu.stackPointer
           get_global $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           get_global $core/cpu/cpu/Cpu.registerH
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           call $core/cpu/opcodes/sixteenBitStoreSyncCycles
           i32.const 8
           return
          end
          call $core/cpu/opcodes/getDataByteOne
          call $core/cpu/instructions/andARegister
          br $folding-inner0
         end
         get_global $core/cpu/cpu/Cpu.stackPointer
         i32.const 2
         i32.sub
         i32.const 65535
         i32.and
         set_global $core/cpu/cpu/Cpu.stackPointer
         get_global $core/cpu/cpu/Cpu.stackPointer
         get_global $core/cpu/cpu/Cpu.programCounter
         call $core/cpu/opcodes/sixteenBitStoreSyncCycles
         i32.const 32
         set_global $core/cpu/cpu/Cpu.programCounter
         i32.const 8
         return
        end
        call $core/cpu/opcodes/getDataByteOne
        call $core/portable/portable/i8Portable
        i32.const 24
        i32.shl
        i32.const 24
        i32.shr_s
        set_local $0
        get_global $core/cpu/cpu/Cpu.stackPointer
        get_local $0
        i32.const 1
        call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
        get_global $core/cpu/cpu/Cpu.stackPointer
        get_local $0
        i32.add
        i32.const 65535
        i32.and
        set_global $core/cpu/cpu/Cpu.stackPointer
        i32.const 0
        call $core/cpu/flags/setZeroFlag
        i32.const 0
        call $core/cpu/flags/setSubtractFlag
        get_global $core/cpu/cpu/Cpu.programCounter
        i32.const 1
        i32.add
        i32.const 65535
        i32.and
        set_global $core/cpu/cpu/Cpu.programCounter
        i32.const 12
        return
       end
       get_global $core/cpu/cpu/Cpu.registerL
       i32.const 255
       i32.and
       get_global $core/cpu/cpu/Cpu.registerH
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       set_global $core/cpu/cpu/Cpu.programCounter
       i32.const 4
       return
      end
      call $core/cpu/opcodes/getConcatenatedDataByte
      i32.const 65535
      i32.and
      get_global $core/cpu/cpu/Cpu.registerA
      call $core/cpu/opcodes/eightBitStoreSyncCycles
      get_global $core/cpu/cpu/Cpu.programCounter
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      set_global $core/cpu/cpu/Cpu.programCounter
      i32.const 4
      return
     end
     call $core/cpu/opcodes/getDataByteOne
     call $core/cpu/instructions/xorARegister
     br $folding-inner0
    end
    get_global $core/cpu/cpu/Cpu.stackPointer
    i32.const 2
    i32.sub
    i32.const 65535
    i32.and
    set_global $core/cpu/cpu/Cpu.stackPointer
    get_global $core/cpu/cpu/Cpu.stackPointer
    get_global $core/cpu/cpu/Cpu.programCounter
    call $core/cpu/opcodes/sixteenBitStoreSyncCycles
    i32.const 40
    set_global $core/cpu/cpu/Cpu.programCounter
    i32.const 8
    return
   end
   i32.const -1
   return
  end
  get_global $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  set_global $core/cpu/cpu/Cpu.programCounter
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcodeFx (; 166 ;) (type $ii) (param $0 i32) (result i32)
  block $folding-inner1
   block $folding-inner0
    block $break|0
     block $case12|0
      block $case11|0
       block $case10|0
        block $case9|0
         block $case8|0
          block $case7|0
           block $case6|0
            block $case5|0
             block $case4|0
              block $case3|0
               block $case2|0
                block $case1|0
                 get_local $0
                 i32.const 240
                 i32.ne
                 if
                  get_local $0
                  i32.const 241
                  i32.sub
                  br_table $case1|0 $case2|0 $case3|0 $break|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $break|0 $break|0 $case11|0 $case12|0 $break|0
                 end
                 call $core/cpu/opcodes/getDataByteOne
                 i32.const 255
                 i32.and
                 i32.const 65280
                 i32.add
                 call $core/cpu/opcodes/eightBitLoadSyncCycles
                 i32.const 255
                 i32.and
                 set_global $core/cpu/cpu/Cpu.registerA
                 br $folding-inner0
                end
                get_global $core/cpu/cpu/Cpu.stackPointer
                call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                i32.const 65535
                i32.and
                set_local $0
                get_global $core/cpu/cpu/Cpu.stackPointer
                i32.const 2
                i32.add
                i32.const 65535
                i32.and
                set_global $core/cpu/cpu/Cpu.stackPointer
                get_local $0
                i32.const 65280
                i32.and
                i32.const 8
                i32.shr_s
                set_global $core/cpu/cpu/Cpu.registerA
                get_local $0
                i32.const 255
                i32.and
                set_global $core/cpu/cpu/Cpu.registerF
                br $folding-inner1
               end
               get_global $core/cpu/cpu/Cpu.registerC
               i32.const 65280
               i32.add
               call $core/cpu/opcodes/eightBitLoadSyncCycles
               i32.const 255
               i32.and
               set_global $core/cpu/cpu/Cpu.registerA
               br $folding-inner1
              end
              i32.const 0
              set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
              br $folding-inner1
             end
             get_global $core/cpu/cpu/Cpu.stackPointer
             i32.const 2
             i32.sub
             i32.const 65535
             i32.and
             set_global $core/cpu/cpu/Cpu.stackPointer
             get_global $core/cpu/cpu/Cpu.stackPointer
             get_global $core/cpu/cpu/Cpu.registerF
             i32.const 255
             i32.and
             get_global $core/cpu/cpu/Cpu.registerA
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             call $core/cpu/opcodes/sixteenBitStoreSyncCycles
             i32.const 8
             return
            end
            call $core/cpu/opcodes/getDataByteOne
            call $core/cpu/instructions/orARegister
            br $folding-inner0
           end
           get_global $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           set_global $core/cpu/cpu/Cpu.stackPointer
           get_global $core/cpu/cpu/Cpu.stackPointer
           get_global $core/cpu/cpu/Cpu.programCounter
           call $core/cpu/opcodes/sixteenBitStoreSyncCycles
           i32.const 48
           set_global $core/cpu/cpu/Cpu.programCounter
           i32.const 8
           return
          end
          call $core/cpu/opcodes/getDataByteOne
          call $core/portable/portable/i8Portable
          set_local $0
          i32.const 0
          call $core/cpu/flags/setZeroFlag
          i32.const 0
          call $core/cpu/flags/setSubtractFlag
          get_global $core/cpu/cpu/Cpu.stackPointer
          get_local $0
          i32.const 24
          i32.shl
          i32.const 24
          i32.shr_s
          tee_local $0
          i32.const 1
          call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
          get_global $core/cpu/cpu/Cpu.stackPointer
          get_local $0
          i32.add
          i32.const 65535
          i32.and
          tee_local $0
          i32.const 65280
          i32.and
          i32.const 8
          i32.shr_s
          set_global $core/cpu/cpu/Cpu.registerH
          get_local $0
          i32.const 255
          i32.and
          set_global $core/cpu/cpu/Cpu.registerL
          get_global $core/cpu/cpu/Cpu.programCounter
          i32.const 1
          i32.add
          i32.const 65535
          i32.and
          set_global $core/cpu/cpu/Cpu.programCounter
          i32.const 8
          return
         end
         get_global $core/cpu/cpu/Cpu.registerL
         i32.const 255
         i32.and
         get_global $core/cpu/cpu/Cpu.registerH
         i32.const 255
         i32.and
         i32.const 8
         i32.shl
         i32.or
         set_global $core/cpu/cpu/Cpu.stackPointer
         i32.const 8
         return
        end
        call $core/cpu/opcodes/getConcatenatedDataByte
        i32.const 65535
        i32.and
        call $core/cpu/opcodes/eightBitLoadSyncCycles
        i32.const 255
        i32.and
        set_global $core/cpu/cpu/Cpu.registerA
        get_global $core/cpu/cpu/Cpu.programCounter
        i32.const 2
        i32.add
        i32.const 65535
        i32.and
        set_global $core/cpu/cpu/Cpu.programCounter
        br $folding-inner1
       end
       i32.const 1
       set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
       br $folding-inner1
      end
      call $core/cpu/opcodes/getDataByteOne
      call $core/cpu/instructions/cpARegister
      br $folding-inner0
     end
     get_global $core/cpu/cpu/Cpu.stackPointer
     i32.const 2
     i32.sub
     i32.const 65535
     i32.and
     set_global $core/cpu/cpu/Cpu.stackPointer
     get_global $core/cpu/cpu/Cpu.stackPointer
     get_global $core/cpu/cpu/Cpu.programCounter
     call $core/cpu/opcodes/sixteenBitStoreSyncCycles
     i32.const 56
     set_global $core/cpu/cpu/Cpu.programCounter
     i32.const 8
     return
    end
    i32.const -1
    return
   end
   get_global $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.add
   i32.const 65535
   i32.and
   set_global $core/cpu/cpu/Cpu.programCounter
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/executeOpcode (; 167 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  get_global $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  set_global $core/cpu/cpu/Cpu.programCounter
  get_global $core/cpu/cpu/Cpu.isHaltBug
  if
   get_global $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.sub
   i32.const 65535
   i32.and
   set_global $core/cpu/cpu/Cpu.programCounter
  end
  block $case15|0
   block $case14|0
    block $case13|0
     block $case12|0
      block $case11|0
       block $case10|0
        block $case9|0
         block $case8|0
          block $case7|0
           block $case6|0
            block $case5|0
             block $case4|0
              block $case3|0
               block $case2|0
                block $case1|0
                 get_local $0
                 i32.const 240
                 i32.and
                 i32.const 4
                 i32.shr_s
                 tee_local $1
                 if
                  get_local $1
                  i32.const 1
                  i32.eq
                  br_if $case1|0
                  block $tablify|0
                   get_local $1
                   i32.const 2
                   i32.sub
                   br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $tablify|0
                  end
                  br $case15|0
                 end
                 get_local $0
                 call $core/cpu/opcodes/handleOpcode0x
                 return
                end
                get_local $0
                call $core/cpu/opcodes/handleOpcode1x
                return
               end
               get_local $0
               call $core/cpu/opcodes/handleOpcode2x
               return
              end
              get_local $0
              call $core/cpu/opcodes/handleOpcode3x
              return
             end
             get_local $0
             call $core/cpu/opcodes/handleOpcode4x
             return
            end
            get_local $0
            call $core/cpu/opcodes/handleOpcode5x
            return
           end
           get_local $0
           call $core/cpu/opcodes/handleOpcode6x
           return
          end
          get_local $0
          call $core/cpu/opcodes/handleOpcode7x
          return
         end
         get_local $0
         call $core/cpu/opcodes/handleOpcode8x
         return
        end
        get_local $0
        call $core/cpu/opcodes/handleOpcode9x
        return
       end
       get_local $0
       call $core/cpu/opcodes/handleOpcodeAx
       return
      end
      get_local $0
      call $core/cpu/opcodes/handleOpcodeBx
      return
     end
     get_local $0
     call $core/cpu/opcodes/handleOpcodeCx
     return
    end
    get_local $0
    call $core/cpu/opcodes/handleOpcodeDx
    return
   end
   get_local $0
   call $core/cpu/opcodes/handleOpcodeEx
   return
  end
  get_local $0
  call $core/cpu/opcodes/handleOpcodeFx
 )
 (func $core/interrupts/interrupts/_handleInterrupt (; 168 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 0
  set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  i32.const 65295
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 1
  get_local $0
  i32.shl
  i32.const -1
  i32.xor
  i32.and
  tee_local $1
  set_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 65295
  get_local $1
  call $core/memory/store/eightBitStoreIntoGBMemory
  get_global $core/cpu/cpu/Cpu.stackPointer
  i32.const 2
  i32.sub
  i32.const 65535
  i32.and
  set_global $core/cpu/cpu/Cpu.stackPointer
  block $__inlined_func$core/cpu/cpu/Cpu.isHalted
   get_global $core/cpu/cpu/Cpu.isHaltNormal
   tee_local $1
   get_global $core/cpu/cpu/Cpu.isHaltNoJump
   get_local $1
   select
   br_if $__inlined_func$core/cpu/cpu/Cpu.isHalted
  end
  get_global $core/cpu/cpu/Cpu.stackPointer
  tee_local $1
  get_global $core/cpu/cpu/Cpu.programCounter
  tee_local $2
  i32.const 255
  i32.and
  call $core/memory/store/eightBitStoreIntoGBMemory
  get_local $1
  i32.const 1
  i32.add
  get_local $2
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_s
  call $core/memory/store/eightBitStoreIntoGBMemory
  block $break|0
   block $case4|0
    block $case3|0
     block $case2|0
      block $case1|0
       get_local $0
       if
        get_local $0
        i32.const 1
        i32.eq
        br_if $case1|0
        block $tablify|0
         get_local $0
         i32.const 2
         i32.sub
         br_table $case2|0 $case3|0 $case4|0 $tablify|0
        end
        br $break|0
       end
       i32.const 0
       set_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
       i32.const 64
       set_global $core/cpu/cpu/Cpu.programCounter
       br $break|0
      end
      i32.const 0
      set_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
      i32.const 72
      set_global $core/cpu/cpu/Cpu.programCounter
      br $break|0
     end
     i32.const 0
     set_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
     i32.const 80
     set_global $core/cpu/cpu/Cpu.programCounter
     br $break|0
    end
    i32.const 0
    set_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
    i32.const 88
    set_global $core/cpu/cpu/Cpu.programCounter
    br $break|0
   end
   i32.const 0
   set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
   i32.const 96
   set_global $core/cpu/cpu/Cpu.programCounter
  end
 )
 (func $core/interrupts/interrupts/checkInterrupts (; 169 ;) (type $i) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  if
   i32.const 1
   set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
   i32.const 0
   set_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  end
  get_global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
  get_global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.and
  i32.const 31
  i32.and
  i32.const 0
  i32.gt_s
  if
   get_global $core/cpu/cpu/Cpu.isHaltNoJump
   i32.eqz
   get_global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
   tee_local $2
   get_local $2
   select
   if (result i32)
    get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
    get_global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
    tee_local $0
    get_local $0
    select
    if (result i32)
     i32.const 0
     call $core/interrupts/interrupts/_handleInterrupt
     i32.const 1
    else     
     get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
     get_global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
     tee_local $0
     get_local $0
     select
     if (result i32)
      i32.const 1
      call $core/interrupts/interrupts/_handleInterrupt
      i32.const 1
     else      
      get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
      get_global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
      tee_local $0
      get_local $0
      select
      if (result i32)
       i32.const 2
       call $core/interrupts/interrupts/_handleInterrupt
       i32.const 1
      else       
       get_global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
       get_global $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
       tee_local $0
       get_local $0
       select
       if (result i32)
        i32.const 3
        call $core/interrupts/interrupts/_handleInterrupt
        i32.const 1
       else        
        get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
        get_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
        tee_local $0
        get_local $0
        select
        if (result i32)
         i32.const 4
         call $core/interrupts/interrupts/_handleInterrupt
         i32.const 1
        else         
         i32.const 0
        end
       end
      end
     end
    end
   else    
    i32.const 0
   end
   if
    block $__inlined_func$core/cpu/cpu/Cpu.isHalted (result i32)
     i32.const 1
     get_global $core/cpu/cpu/Cpu.isHaltNormal
     tee_local $0
     get_global $core/cpu/cpu/Cpu.isHaltNoJump
     get_local $0
     select
     br_if $__inlined_func$core/cpu/cpu/Cpu.isHalted
     drop
     i32.const 0
    end
    if (result i32)
     i32.const 0
     set_global $core/cpu/cpu/Cpu.isHaltNoJump
     i32.const 0
     set_global $core/cpu/cpu/Cpu.isHaltNormal
     i32.const 0
     set_global $core/cpu/cpu/Cpu.isHaltBug
     i32.const 0
     set_global $core/cpu/cpu/Cpu.isStopped
     i32.const 24
    else     
     i32.const 20
    end
    set_local $1
   end
   block $__inlined_func$core/cpu/cpu/Cpu.isHalted0 (result i32)
    i32.const 1
    get_global $core/cpu/cpu/Cpu.isHaltNormal
    tee_local $0
    get_global $core/cpu/cpu/Cpu.isHaltNoJump
    get_local $0
    select
    br_if $__inlined_func$core/cpu/cpu/Cpu.isHalted0
    drop
    i32.const 0
   end
   if
    i32.const 0
    set_global $core/cpu/cpu/Cpu.isHaltNoJump
    i32.const 0
    set_global $core/cpu/cpu/Cpu.isHaltNormal
    i32.const 0
    set_global $core/cpu/cpu/Cpu.isHaltBug
    i32.const 0
    set_global $core/cpu/cpu/Cpu.isStopped
   end
   get_local $1
   return
  end
  i32.const 0
 )
 (func $core/execute/executeStep (; 170 ;) (type $i) (result i32)
  (local $0 i32)
  (local $1 i32)
  i32.const 1
  set_global $core/core/hasStarted
  get_global $core/cpu/cpu/Cpu.isHaltBug
  if
   get_global $core/cpu/cpu/Cpu.programCounter
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 255
   i32.and
   call $core/cpu/opcodes/executeOpcode
   call $core/cycles/syncCycles
   i32.const 0
   set_global $core/cpu/cpu/Cpu.isHaltNoJump
   i32.const 0
   set_global $core/cpu/cpu/Cpu.isHaltNormal
   i32.const 0
   set_global $core/cpu/cpu/Cpu.isHaltBug
   i32.const 0
   set_global $core/cpu/cpu/Cpu.isStopped
  end
  call $core/interrupts/interrupts/checkInterrupts
  tee_local $1
  i32.const 0
  i32.gt_s
  if
   get_local $1
   call $core/cycles/syncCycles
  end
  i32.const 4
  set_local $0
  block $__inlined_func$core/cpu/cpu/Cpu.isHalted (result i32)
   i32.const 1
   get_global $core/cpu/cpu/Cpu.isHaltNormal
   tee_local $1
   get_global $core/cpu/cpu/Cpu.isHaltNoJump
   get_local $1
   select
   br_if $__inlined_func$core/cpu/cpu/Cpu.isHalted
   drop
   i32.const 0
  end
  i32.eqz
  tee_local $1
  if (result i32)
   get_global $core/cpu/cpu/Cpu.isStopped
   i32.eqz
  else   
   get_local $1
  end
  if
   get_global $core/cpu/cpu/Cpu.programCounter
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 255
   i32.and
   call $core/cpu/opcodes/executeOpcode
   set_local $0
  end
  get_global $core/cpu/cpu/Cpu.registerF
  i32.const 240
  i32.and
  set_global $core/cpu/cpu/Cpu.registerF
  get_local $0
  i32.const 0
  i32.le_s
  if
   get_local $0
   return
  end
  get_local $0
  call $core/cycles/syncCycles
  get_global $core/execute/Execute.steps
  i32.const 1
  i32.add
  set_global $core/execute/Execute.steps
  get_global $core/execute/Execute.steps
  get_global $core/execute/Execute.stepsPerStepSet
  i32.ge_s
  if
   get_global $core/execute/Execute.stepSets
   i32.const 1
   i32.add
   set_global $core/execute/Execute.stepSets
   get_global $core/execute/Execute.steps
   get_global $core/execute/Execute.stepsPerStepSet
   i32.sub
   set_global $core/execute/Execute.steps
  end
  get_local $0
 )
 (func $core/sound/sound/getNumberOfSamplesInAudioBuffer (; 171 ;) (type $i) (result i32)
  get_global $core/sound/sound/Sound.audioQueueIndex
 )
 (func $core/execute/executeUntilCondition (; 172 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  get_local $0
  i32.const -1
  i32.const 1024
  get_local $0
  i32.const 0
  i32.lt_s
  select
  get_local $0
  i32.const 0
  i32.gt_s
  select
  set_local $4
  i32.const 0
  set_local $0
  loop $continue|0
   block (result i32)
    block (result i32)
     get_local $6
     i32.eqz
     tee_local $2
     if
      get_local $0
      i32.eqz
      set_local $2
     end
     get_local $2
    end
    if
     get_local $5
     i32.eqz
     set_local $2
    end
    get_local $2
   end
   if
    get_local $3
    i32.eqz
    set_local $2
   end
   get_local $2
   if
    call $core/execute/executeStep
    i32.const 0
    i32.lt_s
    if
     i32.const 1
     set_local $6
    else     
     get_global $core/cpu/cpu/Cpu.currentCycles
     get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
     if (result i32)
      i32.const 140448
     else      
      i32.const 70224
     end
     i32.ge_s
     if
      i32.const 1
      set_local $0
     else      
      get_local $4
      i32.const -1
      i32.gt_s
      tee_local $2
      if
       get_global $core/sound/sound/Sound.audioQueueIndex
       get_local $4
       i32.ge_s
       set_local $2
      end
      get_local $2
      if
       i32.const 1
       set_local $5
      else       
       get_local $1
       i32.const -1
       i32.gt_s
       tee_local $2
       if
        get_global $core/cpu/cpu/Cpu.programCounter
        get_local $1
        i32.eq
        set_local $2
       end
       i32.const 1
       get_local $3
       get_local $2
       select
       set_local $3
      end
     end
    end
    br $continue|0
   end
  end
  get_local $0
  if
   get_global $core/cpu/cpu/Cpu.currentCycles
   get_global $core/cpu/cpu/Cpu.GBCDoubleSpeed
   if (result i32)
    i32.const 140448
   else    
    i32.const 70224
   end
   i32.sub
   set_global $core/cpu/cpu/Cpu.currentCycles
   i32.const 0
   return
  end
  get_local $5
  if
   i32.const 1
   return
  end
  get_local $3
  if
   i32.const 2
   return
  end
  get_global $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.sub
  i32.const 65535
  i32.and
  set_global $core/cpu/cpu/Cpu.programCounter
  i32.const -1
 )
 (func $core/execute/executeFrame (; 173 ;) (type $i) (result i32)
  i32.const -1
  i32.const -1
  call $core/execute/executeUntilCondition
 )
 (func $core/execute/executeMultipleFrames (; 174 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  loop $continue|0
   get_local $2
   get_local $0
   i32.lt_s
   tee_local $3
   if
    get_local $1
    i32.const 0
    i32.ge_s
    set_local $3
   end
   get_local $3
   if
    call $core/execute/executeFrame
    set_local $1
    get_local $2
    i32.const 1
    i32.add
    set_local $2
    br $continue|0
   end
  end
  get_local $1
  i32.const 0
  i32.lt_s
  if
   get_local $1
   return
  end
  i32.const 0
 )
 (func $core/execute/executeFrameUntilBreakpoint (; 175 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  i32.const -1
  get_local $0
  call $core/execute/executeUntilCondition
  tee_local $1
  i32.const 2
  i32.eq
  if
   i32.const 1
   return
  end
  get_local $1
 )
 (func $core/cycles/getCyclesPerCycleSet (; 176 ;) (type $i) (result i32)
  get_global $core/cycles/Cycles.cyclesPerCycleSet
 )
 (func $core/cycles/getCycleSets (; 177 ;) (type $i) (result i32)
  get_global $core/cycles/Cycles.cycleSets
 )
 (func $core/cycles/getCycles (; 178 ;) (type $i) (result i32)
  get_global $core/cycles/Cycles.cycles
 )
 (func $core/joypad/joypad/_getJoypadButtonStateFromButtonId (; 179 ;) (type $ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $case8|0
   block $case7|0
    block $case6|0
     block $case5|0
      block $case4|0
       block $case3|0
        block $case2|0
         block $case1|0
          get_local $0
          if
           get_local $0
           tee_local $1
           i32.const 1
           i32.eq
           br_if $case1|0
           block $tablify|0
            get_local $1
            i32.const 2
            i32.sub
            br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
           end
           br $case8|0
          end
          get_global $core/joypad/joypad/Joypad.up
          return
         end
         get_global $core/joypad/joypad/Joypad.right
         return
        end
        get_global $core/joypad/joypad/Joypad.down
        return
       end
       get_global $core/joypad/joypad/Joypad.left
       return
      end
      get_global $core/joypad/joypad/Joypad.a
      return
     end
     get_global $core/joypad/joypad/Joypad.b
     return
    end
    get_global $core/joypad/joypad/Joypad.select
    return
   end
   get_global $core/joypad/joypad/Joypad.start
   return
  end
  i32.const 0
 )
 (func $core/joypad/joypad/_setJoypadButtonStateFromButtonId (; 180 ;) (type $iiv) (param $0 i32) (param $1 i32)
  (local $2 i32)
  block $break|0
   block $case7|0
    block $case6|0
     block $case5|0
      block $case4|0
       block $case3|0
        block $case2|0
         block $case1|0
          get_local $0
          if
           get_local $0
           tee_local $2
           i32.const 1
           i32.eq
           br_if $case1|0
           block $tablify|0
            get_local $2
            i32.const 2
            i32.sub
            br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
           end
           br $break|0
          end
          get_local $1
          i32.const 0
          i32.ne
          set_global $core/joypad/joypad/Joypad.up
          br $break|0
         end
         get_local $1
         i32.const 0
         i32.ne
         set_global $core/joypad/joypad/Joypad.right
         br $break|0
        end
        get_local $1
        i32.const 0
        i32.ne
        set_global $core/joypad/joypad/Joypad.down
        br $break|0
       end
       get_local $1
       i32.const 0
       i32.ne
       set_global $core/joypad/joypad/Joypad.left
       br $break|0
      end
      get_local $1
      i32.const 0
      i32.ne
      set_global $core/joypad/joypad/Joypad.a
      br $break|0
     end
     get_local $1
     i32.const 0
     i32.ne
     set_global $core/joypad/joypad/Joypad.b
     br $break|0
    end
    get_local $1
    i32.const 0
    i32.ne
    set_global $core/joypad/joypad/Joypad.select
    br $break|0
   end
   get_local $1
   i32.const 0
   i32.ne
   set_global $core/joypad/joypad/Joypad.start
  end
 )
 (func $core/joypad/joypad/_pressJoypadButton (; 181 ;) (type $iv) (param $0 i32)
  (local $1 i32)
  i32.const 0
  set_global $core/cpu/cpu/Cpu.isStopped
  get_local $0
  call $core/joypad/joypad/_getJoypadButtonStateFromButtonId
  i32.eqz
  if
   i32.const 1
   set_local $1
  end
  get_local $0
  i32.const 1
  call $core/joypad/joypad/_setJoypadButtonStateFromButtonId
  get_local $1
  if
   i32.const 1
   i32.const 1
   i32.const 0
   i32.const 1
   i32.const 0
   get_local $0
   i32.const 3
   i32.le_s
   select
   tee_local $1
   get_global $core/joypad/joypad/Joypad.isDpadType
   tee_local $0
   get_local $0
   select
   select
   get_local $1
   i32.eqz
   get_global $core/joypad/joypad/Joypad.isButtonType
   tee_local $0
   get_local $0
   select
   select
   if
    i32.const 1
    set_global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
    i32.const 4
    call $core/interrupts/interrupts/_requestInterrupt
   end
  end
 )
 (func $core/joypad/joypad/_releaseJoypadButton (; 182 ;) (type $iv) (param $0 i32)
  get_local $0
  i32.const 0
  call $core/joypad/joypad/_setJoypadButtonStateFromButtonId
 )
 (func $core/joypad/joypad/setJoypadState (; 183 ;) (type $iiiiiiiiv) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32)
  get_local $0
  i32.const 0
  i32.gt_s
  if
   i32.const 0
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 0
   call $core/joypad/joypad/_releaseJoypadButton
  end
  get_local $1
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 1
   call $core/joypad/joypad/_releaseJoypadButton
  end
  get_local $2
  i32.const 0
  i32.gt_s
  if
   i32.const 2
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 2
   call $core/joypad/joypad/_releaseJoypadButton
  end
  get_local $3
  i32.const 0
  i32.gt_s
  if
   i32.const 3
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 3
   call $core/joypad/joypad/_releaseJoypadButton
  end
  get_local $4
  i32.const 0
  i32.gt_s
  if
   i32.const 4
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 4
   call $core/joypad/joypad/_releaseJoypadButton
  end
  get_local $5
  i32.const 0
  i32.gt_s
  if
   i32.const 5
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 5
   call $core/joypad/joypad/_releaseJoypadButton
  end
  get_local $6
  i32.const 0
  i32.gt_s
  if
   i32.const 6
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 6
   call $core/joypad/joypad/_releaseJoypadButton
  end
  get_local $7
  i32.const 0
  i32.gt_s
  if
   i32.const 7
   call $core/joypad/joypad/_pressJoypadButton
  else   
   i32.const 7
   call $core/joypad/joypad/_releaseJoypadButton
  end
 )
 (func $core/debug/debug-cpu/getRegisterA (; 184 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerA
 )
 (func $core/debug/debug-cpu/getRegisterB (; 185 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerB
 )
 (func $core/debug/debug-cpu/getRegisterC (; 186 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerC
 )
 (func $core/debug/debug-cpu/getRegisterD (; 187 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerD
 )
 (func $core/debug/debug-cpu/getRegisterE (; 188 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerE
 )
 (func $core/debug/debug-cpu/getRegisterH (; 189 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerH
 )
 (func $core/debug/debug-cpu/getRegisterL (; 190 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerL
 )
 (func $core/debug/debug-cpu/getRegisterF (; 191 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.registerF
 )
 (func $core/debug/debug-cpu/getProgramCounter (; 192 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.programCounter
 )
 (func $core/debug/debug-cpu/getStackPointer (; 193 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.stackPointer
 )
 (func $core/debug/debug-cpu/getOpcodeAtProgramCounter (; 194 ;) (type $i) (result i32)
  get_global $core/cpu/cpu/Cpu.programCounter
  call $core/memory/load/eightBitLoadFromGBMemory
 )
 (func $core/debug/debug-graphics/getLY (; 195 ;) (type $i) (result i32)
  get_global $core/graphics/graphics/Graphics.scanlineRegister
 )
 (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory (; 196 ;) (type $iv) (param $0 i32)
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
  i32.const 32768
  i32.const 34816
  get_global $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  select
  set_local $9
  i32.const 39936
  i32.const 38912
  get_global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
  select
  set_local $10
  loop $repeat|0
   get_local $5
   i32.const 256
   i32.lt_s
   if
    i32.const 0
    set_local $4
    loop $repeat|1
     get_local $4
     i32.const 256
     i32.lt_s
     if
      get_local $9
      get_local $5
      i32.const 3
      i32.shr_s
      i32.const 5
      i32.shl
      get_local $10
      i32.add
      get_local $4
      i32.const 3
      i32.shr_s
      i32.add
      tee_local $3
      i32.const -30720
      i32.add
      i32.load8_u
      call $core/graphics/tiles/getTileDataAddress
      set_local $8
      get_local $5
      i32.const 8
      i32.rem_s
      set_local $1
      i32.const 7
      get_local $4
      i32.const 8
      i32.rem_s
      i32.sub
      set_local $6
      i32.const 0
      set_local $2
      block (result i32)
       get_local $0
       i32.const 0
       i32.gt_s
       get_global $core/cpu/cpu/Cpu.GBCEnabled
       tee_local $7
       get_local $7
       select
       if
        get_local $3
        i32.const -22528
        i32.add
        i32.load8_u
        set_local $2
       end
       get_local $2
       i32.const 64
       i32.and
      end
      if
       i32.const 7
       get_local $1
       i32.sub
       set_local $1
      end
      i32.const 0
      set_local $7
      get_local $1
      i32.const 1
      i32.shl
      get_local $8
      i32.add
      tee_local $3
      i32.const -30720
      i32.add
      i32.const 1
      i32.const 0
      get_local $2
      i32.const 8
      i32.and
      select
      tee_local $7
      i32.const 1
      i32.and
      i32.const 13
      i32.shl
      i32.add
      i32.load8_u
      set_local $8
      i32.const 0
      set_local $1
      get_local $3
      i32.const -30719
      i32.add
      get_local $7
      i32.const 1
      i32.and
      i32.const 13
      i32.shl
      i32.add
      i32.load8_u
      i32.const 1
      get_local $6
      i32.shl
      i32.and
      if
       i32.const 2
       set_local $1
      end
      get_local $1
      i32.const 1
      i32.add
      get_local $1
      i32.const 1
      get_local $6
      i32.shl
      get_local $8
      i32.and
      select
      set_local $1
      get_local $5
      i32.const 8
      i32.shl
      get_local $4
      i32.add
      i32.const 3
      i32.mul
      set_local $6
      get_local $0
      i32.const 0
      i32.gt_s
      get_global $core/cpu/cpu/Cpu.GBCEnabled
      tee_local $3
      get_local $3
      select
      if
       get_local $2
       i32.const 7
       i32.and
       get_local $1
       i32.const 0
       call $core/graphics/palette/getRgbColorFromPalette
       tee_local $1
       i32.const 31
       i32.and
       i32.const 3
       i32.shl
       set_local $3
       get_local $6
       i32.const 232448
       i32.add
       tee_local $2
       get_local $3
       i32.store8
       get_local $2
       i32.const 1
       i32.add
       get_local $1
       i32.const 992
       i32.and
       i32.const 5
       i32.shr_s
       i32.const 3
       i32.shl
       i32.store8
       get_local $2
       i32.const 2
       i32.add
       get_local $1
       i32.const 31744
       i32.and
       i32.const 10
       i32.shr_s
       i32.const 3
       i32.shl
       i32.store8
      else       
       get_local $1
       i32.const 65351
       i32.const 0
       call $core/graphics/palette/getMonochromeColorFromPalette
       set_local $2
       i32.const 0
       set_local $1
       loop $repeat|2
        get_local $1
        i32.const 3
        i32.lt_s
        if
         get_local $6
         i32.const 232448
         i32.add
         get_local $1
         i32.add
         get_local $2
         i32.store8
         get_local $1
         i32.const 1
         i32.add
         set_local $1
         br $repeat|2
        end
       end
      end
      get_local $4
      i32.const 1
      i32.add
      set_local $4
      br $repeat|1
     end
    end
    get_local $5
    i32.const 1
    i32.add
    set_local $5
    br $repeat|0
   end
  end
 )
 (func $core/debug/debug-graphics/drawTileDataToWasmMemory (; 197 ;) (type $v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  block $break|0
   loop $repeat|0
    get_local $1
    i32.const 23
    i32.ge_s
    br_if $break|0
    i32.const 0
    set_local $0
    loop $repeat|1
     block $break|1
      get_local $0
      i32.const 31
      i32.ge_s
      br_if $break|1
      i32.const 0
      set_local $4
      i32.const 1
      i32.const 0
      get_local $0
      i32.const 15
      i32.gt_s
      select
      set_local $4
      get_local $1
      set_local $2
      get_local $2
      i32.const 15
      i32.sub
      get_local $2
      get_local $1
      i32.const 15
      i32.gt_s
      select
      i32.const 4
      i32.shl
      set_local $2
      get_local $0
      i32.const 15
      i32.sub
      get_local $2
      i32.add
      get_local $0
      get_local $2
      i32.add
      get_local $0
      i32.const 15
      i32.gt_s
      select
      set_local $2
      i32.const 32768
      set_local $5
      i32.const 34816
      i32.const 32768
      get_local $1
      i32.const 15
      i32.gt_s
      select
      set_local $5
      i32.const 0
      set_local $3
      loop $repeat|2
       block $break|2
        get_local $3
        i32.const 8
        i32.ge_s
        br_if $break|2
        get_local $2
        get_local $5
        get_local $4
        i32.const 0
        i32.const 7
        get_local $3
        get_local $0
        i32.const 3
        i32.shl
        get_local $1
        i32.const 3
        i32.shl
        get_local $3
        i32.add
        i32.const 248
        i32.const 429056
        i32.const 1
        i32.const -1
        call $core/graphics/tiles/drawPixelsFromLineOfTile
        drop
        get_local $3
        i32.const 1
        i32.add
        set_local $3
        br $repeat|2
       end
      end
      get_local $0
      i32.const 1
      i32.add
      set_local $0
      br $repeat|1
     end
    end
    get_local $1
    i32.const 1
    i32.add
    set_local $1
    br $repeat|0
    unreachable
   end
   unreachable
  end
 )
 (func $core/debug/debug-timer/getDIV (; 198 ;) (type $i) (result i32)
  get_global $core/timers/timers/Timers.dividerRegister
 )
 (func $core/debug/debug-timer/getTIMA (; 199 ;) (type $i) (result i32)
  get_global $core/timers/timers/Timers.timerCounter
 )
 (func $core/debug/debug-timer/getTMA (; 200 ;) (type $i) (result i32)
  get_global $core/timers/timers/Timers.timerModulo
 )
 (func $core/debug/debug-timer/getTAC (; 201 ;) (type $i) (result i32)
  (local $0 i32)
  get_global $core/timers/timers/Timers.timerInputClock
  set_local $0
  get_global $core/timers/timers/Timers.timerEnabled
  if
   get_local $0
   i32.const 4
   i32.or
   set_local $0
  end
  get_local $0
 )
 (func $core/debug/debug-memory/updateDebugGBMemory (; 202 ;) (type $v)
  (local $0 i32)
  block $break|0
   loop $repeat|0
    get_local $0
    i32.const 65535
    i32.gt_s
    br_if $break|0
    get_local $0
    i32.const 9109504
    i32.add
    get_local $0
    call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
    i32.store8
    get_local $0
    i32.const 1
    i32.add
    set_local $0
    br $repeat|0
    unreachable
   end
   unreachable
  end
 )
 (func $start (; 203 ;) (type $v)
  current_memory
  i32.const 140
  i32.lt_s
  if
   i32.const 140
   current_memory
   i32.sub
   grow_memory
   drop
  end
 )
 (func $null (; 204 ;) (type $v)
  nop
 )
 (func $core/execute/executeFrameAndCheckAudio|trampoline (; 205 ;) (type $ii) (param $0 i32) (result i32)
  block $1of1
   block $0of1
    block $outOfRange
     get_global $~argc
     br_table $0of1 $1of1 $outOfRange
    end
    unreachable
   end
   i32.const 0
   set_local $0
  end
  get_local $0
  i32.const -1
  call $core/execute/executeUntilCondition
 )
 (func $~setargc (; 206 ;) (type $iv) (param $0 i32)
  get_local $0
  set_global $~argc
 )
 (func $core/execute/executeUntilCondition|trampoline (; 207 ;) (type $iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  block $3of3
   block $2of3
    block $1of3
     block $0of3
      block $outOfRange
       get_global $~argc
       br_table $0of3 $1of3 $2of3 $3of3 $outOfRange
      end
      unreachable
     end
     i32.const 1
     set_local $0
    end
    i32.const -1
    set_local $1
   end
   i32.const -1
   set_local $2
  end
  get_local $1
  get_local $2
  call $core/execute/executeUntilCondition
 )
)
