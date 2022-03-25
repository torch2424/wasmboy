(module
 (type $none_=>_i32 (func (result i32)))
 (type $i32_=>_i32 (func (param i32) (result i32)))
 (type $i32_=>_none (func (param i32)))
 (type $none_=>_none (func))
 (type $i32_i32_=>_i32 (func (param i32 i32) (result i32)))
 (type $i32_i32_=>_none (func (param i32 i32)))
 (type $i32_i32_i32_=>_none (func (param i32 i32 i32)))
 (type $i32_i32_i32_i32_i32_i32_=>_none (func (param i32 i32 i32 i32 i32 i32)))
 (type $i32_i32_i32_i32_=>_none (func (param i32 i32 i32 i32)))
 (type $i32_i32_i32_i32_i32_i32_i32_=>_none (func (param i32 i32 i32 i32 i32 i32 i32)))
 (type $i32_i32_i32_i32_i32_i32_i32_i32_=>_none (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $i32_i32_i32_i32_i32_i32_i32_i32_i32_i32_=>_none (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $i32_i32_i32_=>_i32 (func (param i32 i32 i32) (result i32)))
 (type $i32_i32_i32_i32_=>_i32 (func (param i32 i32 i32 i32) (result i32)))
 (type $i32_i32_i32_i32_i32_=>_i32 (func (param i32 i32 i32 i32 i32) (result i32)))
 (type $i32_i32_i32_i32_i32_i32_i32_i32_i32_i32_i32_i32_i32_=>_i32 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (memory $0 1)
 (data (i32.const 1024) "\1e\00\00\00\01\00\00\00\01\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data (i32.const 1072) "(\00\00\00\01\00\00\00\01\00\00\00(\00\00\00a\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data (i32.const 1136) "\1e\00\00\00\01\00\00\00\01\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00p\00u\00r\00e\00.\00t\00s")
 (data (i32.const 1184) "\03\00\00\00 \00\00\00\00\00\00\00 \00\00\00\00\00\00\00 ")
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/collectLock (mut i32) (i32.const 0))
 (global $core/constants/ASSEMBLYSCRIPT_MEMORY_LOCATION i32 (i32.const 0))
 (global $core/constants/ASSEMBLYSCRIPT_MEMORY_SIZE i32 (i32.const 1024))
 (global $core/constants/WASMBOY_STATE_LOCATION i32 (i32.const 1024))
 (global $core/constants/WASMBOY_STATE_SIZE i32 (i32.const 1024))
 (global $core/constants/VIDEO_RAM_LOCATION i32 (i32.const 2048))
 (global $core/constants/VIDEO_RAM_SIZE i32 (i32.const 16384))
 (global $core/constants/WORK_RAM_LOCATION i32 (i32.const 18432))
 (global $core/constants/WORK_RAM_SIZE i32 (i32.const 32768))
 (global $core/constants/OTHER_GAMEBOY_INTERNAL_MEMORY_LOCATION i32 (i32.const 51200))
 (global $core/constants/OTHER_GAMEBOY_INTERNAL_MEMORY_SIZE i32 (i32.const 16384))
 (global $core/constants/GAMEBOY_INTERNAL_MEMORY_LOCATION i32 (i32.const 2048))
 (global $core/constants/GAMEBOY_INTERNAL_MEMORY_SIZE i32 (i32.const 65536))
 (global $core/constants/GBC_PALETTE_LOCATION i32 (i32.const 67584))
 (global $core/constants/GBC_PALETTE_SIZE i32 (i32.const 128))
 (global $core/constants/BG_PRIORITY_MAP_LOCATION i32 (i32.const 67712))
 (global $core/constants/BG_PRIORITY_MAP_SIZE i32 (i32.const 23552))
 (global $core/constants/FRAME_LOCATION i32 (i32.const 91264))
 (global $core/constants/FRAME_SIZE i32 (i32.const 93184))
 (global $core/constants/BACKGROUND_MAP_LOCATION i32 (i32.const 184448))
 (global $core/constants/BACKGROUND_MAP_SIZE i32 (i32.const 196608))
 (global $core/constants/TILE_DATA_LOCATION i32 (i32.const 381056))
 (global $core/constants/TILE_DATA_SIZE i32 (i32.const 147456))
 (global $core/constants/OAM_TILES_LOCATION i32 (i32.const 528512))
 (global $core/constants/OAM_TILES_SIZE i32 (i32.const 15360))
 (global $core/constants/GRAPHICS_OUTPUT_LOCATION i32 (i32.const 67584))
 (global $core/constants/GRAPHICS_OUTPUT_SIZE i32 (i32.const 476288))
 (global $core/constants/CHANNEL_1_BUFFER_LOCATION i32 (i32.const 543872))
 (global $core/constants/CHANNEL_1_BUFFER_SIZE i32 (i32.const 131072))
 (global $core/constants/CHANNEL_2_BUFFER_LOCATION i32 (i32.const 674944))
 (global $core/constants/CHANNEL_2_BUFFER_SIZE i32 (i32.const 131072))
 (global $core/constants/CHANNEL_3_BUFFER_LOCATION i32 (i32.const 806016))
 (global $core/constants/CHANNEL_3_BUFFER_SIZE i32 (i32.const 131072))
 (global $core/constants/CHANNEL_4_BUFFER_LOCATION i32 (i32.const 937088))
 (global $core/constants/CHANNEL_4_BUFFER_SIZE i32 (i32.const 131072))
 (global $core/constants/AUDIO_BUFFER_LOCATION i32 (i32.const 1068160))
 (global $core/constants/AUDIO_BUFFER_SIZE i32 (i32.const 131072))
 (global $core/constants/CARTRIDGE_RAM_LOCATION i32 (i32.const 1199232))
 (global $core/constants/CARTRIDGE_RAM_SIZE i32 (i32.const 131072))
 (global $core/constants/BOOT_ROM_LOCATION i32 (i32.const 1330304))
 (global $core/constants/BOOT_ROM_SIZE i32 (i32.const 2560))
 (global $core/constants/CARTRIDGE_ROM_LOCATION i32 (i32.const 1332864))
 (global $core/constants/CARTRIDGE_ROM_SIZE i32 (i32.const 8258560))
 (global $core/constants/DEBUG_GAMEBOY_MEMORY_LOCATION i32 (i32.const 9591424))
 (global $core/constants/DEBUG_GAMEBOY_MEMORY_SIZE i32 (i32.const 65535))
 (global $core/constants/WASMBOY_MEMORY_LOCATION i32 (i32.const 0))
 (global $core/constants/WASMBOY_MEMORY_SIZE i32 (i32.const 9656960))
 (global $core/constants/WASMBOY_WASM_PAGES i32 (i32.const 148))
 (global $core/config/Config.enableBootRom (mut i32) (i32.const 0))
 (global $core/config/Config.useGbcWhenAvailable (mut i32) (i32.const 1))
 (global $core/config/Config.audioBatchProcessing (mut i32) (i32.const 0))
 (global $core/config/Config.graphicsBatchProcessing (mut i32) (i32.const 0))
 (global $core/config/Config.timersBatchProcessing (mut i32) (i32.const 0))
 (global $core/config/Config.graphicsDisableScanlineRendering (mut i32) (i32.const 0))
 (global $core/config/Config.audioAccumulateSamples (mut i32) (i32.const 0))
 (global $core/config/Config.tileRendering (mut i32) (i32.const 0))
 (global $core/config/Config.tileCaching (mut i32) (i32.const 0))
 (global $core/config/Config.enableAudioDebugging (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.bgWhite (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.bgLightGrey (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.bgDarkGrey (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.bgBlack (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj0White (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj0LightGrey (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj0DarkGrey (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj0Black (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj1White (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj1LightGrey (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj1DarkGrey (mut i32) (i32.const 0))
 (global $core/graphics/colors/Colors.obj1Black (mut i32) (i32.const 0))
 (global $core/graphics/tiles/TileCache.tileId (mut i32) (i32.const -1))
 (global $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck (mut i32) (i32.const -1))
 (global $core/sound/channel1/Channel1.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0SweepPeriod (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0Negate (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx0SweepShift (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx1Duty (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2StartingVolume (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx3FrequencyLSB (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.NRx4FrequencyMSB (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.volume (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.dutyCycle (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.waveFormPositionOnDuty (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.isSweepEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.sweepCounter (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.sweepShadowFrequency (mut i32) (i32.const 0))
 (global $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx1Duty (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2StartingVolume (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx3FrequencyLSB (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.NRx4FrequencyMSB (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.volume (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.dutyCycle (mut i32) (i32.const 0))
 (global $core/sound/channel2/Channel2.waveFormPositionOnDuty (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx2VolumeCode (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx3FrequencyLSB (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.NRx4FrequencyMSB (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.frequency (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.waveTablePosition (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.volumeCode (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.volumeCodeChanged (mut i32) (i32.const 0))
 (global $core/sound/channel3/Channel3.sampleBuffer (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.cycleCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx1LengthLoad (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2StartingVolume (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2EnvelopeAddMode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx2EnvelopePeriod (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3ClockShift (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3WidthMode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx3DivisorCode (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.NRx4LengthEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.isEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.isDacEnabled (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.frequencyTimer (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.envelopeCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.lengthCounter (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.volume (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.divisor (mut i32) (i32.const 0))
 (global $core/sound/channel4/Channel4.linearFeedbackShiftRegister (mut i32) (i32.const 0))
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
 (global $core/sound/sound/Sound.frameSequencer (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.downSampleCycleCounter (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.audioQueueIndex (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.masterInterruptSwitch (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.interruptsEnabledValue (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.interruptsRequestedValue (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested (mut i32) (i32.const 0))
 (global $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.currentCycles (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.dividerRegister (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounter (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounterOverflowDelay (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounterWasReset (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerCounterMask (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerModulo (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerEnabled (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerInputClock (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.currentCycles (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.numberOfBitsTransferred (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.isClockSpeedFast (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.transferStartFlag (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.up (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.down (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.left (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.right (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.a (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.b (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.select (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.start (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.joypadRegisterFlipped (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.isDpadType (mut i32) (i32.const 0))
 (global $core/joypad/joypad/Joypad.isButtonType (mut i32) (i32.const 0))
 (global $core/debug/breakpoints/Breakpoints.programCounter (mut i32) (i32.const -1))
 (global $core/debug/breakpoints/Breakpoints.readGbMemory (mut i32) (i32.const -1))
 (global $core/debug/breakpoints/Breakpoints.writeGbMemory (mut i32) (i32.const -1))
 (global $core/debug/breakpoints/Breakpoints.reachedBreakpoint (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.currentLcdMode (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.coincidenceCompare (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.enabled (mut i32) (i32.const 1))
 (global $core/graphics/lcd/Lcd.windowTileMapDisplaySelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.windowDisplayEnabled (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgWindowTileDataSelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgTileMapDisplaySelect (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.tallSpriteSize (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.spriteDisplayEnable (mut i32) (i32.const 0))
 (global $core/graphics/lcd/Lcd.bgDisplayEnabled (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.currentCycles (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scanlineCycleCounter (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scanlineRegister (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scrollX (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.scrollY (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.windowX (mut i32) (i32.const 0))
 (global $core/graphics/graphics/Graphics.windowY (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.currentRomBank (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.currentRamBank (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isRamBankingEnabled (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC1RomModeEnabled (mut i32) (i32.const 1))
 (global $core/memory/memory/Memory.isRomOnly (mut i32) (i32.const 1))
 (global $core/memory/memory/Memory.isMBC1 (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC2 (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC3 (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isMBC5 (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.DMACycles (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.isHblankHdmaActive (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaSource (mut i32) (i32.const 0))
 (global $core/memory/memory/Memory.hblankHdmaDestination (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.BootROMEnabled (mut i32) (i32.const 0))
 (global $core/cpu/cpu/Cpu.GBCEnabled (mut i32) (i32.const 0))
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
 (global $core/cycles/Cycles.cyclesPerCycleSet (mut i32) (i32.const 2000000000))
 (global $core/cycles/Cycles.cycleSets (mut i32) (i32.const 0))
 (global $core/cycles/Cycles.cycles (mut i32) (i32.const 0))
 (global $core/execute/Execute.stepsPerStepSet (mut i32) (i32.const 2000000000))
 (global $core/execute/Execute.stepSets (mut i32) (i32.const 0))
 (global $core/execute/Execute.steps (mut i32) (i32.const 0))
 (global $core/core/hasStarted (mut i32) (i32.const 0))
 (global $~lib/rt/__rtti_base i32 (i32.const 1184))
 (global $~argumentsLength (mut i32) (i32.const 0))
 (export "memory" (memory $0))
 (export "__alloc" (func $~lib/rt/tlsf/__alloc))
 (export "__retain" (func $~lib/rt/pure/__retain))
 (export "__release" (func $~lib/rt/pure/__release))
 (export "__collect" (func $~lib/rt/pure/__collect))
 (export "__rtti_base" (global $~lib/rt/__rtti_base))
 (export "config" (func $core/core/config))
 (export "hasCoreStarted" (func $core/core/hasCoreStarted))
 (export "saveState" (func $core/core/saveState))
 (export "loadState" (func $core/core/loadState))
 (export "isGBC" (func $core/core/isGBC))
 (export "getStepsPerStepSet" (func $core/execute/getStepsPerStepSet))
 (export "getStepSets" (func $core/execute/getStepSets))
 (export "getSteps" (func $core/execute/getSteps))
 (export "executeMultipleFrames" (func $core/execute/executeMultipleFrames))
 (export "executeFrame" (func $core/execute/executeFrame))
 (export "executeFrameAndCheckAudio" (func $core/execute/executeFrameAndCheckAudio@varargs))
 (export "executeUntilCondition" (func $core/execute/executeUntilCondition@varargs))
 (export "executeStep" (func $core/execute/executeStep))
 (export "getCyclesPerCycleSet" (func $core/cycles/getCyclesPerCycleSet))
 (export "getCycleSets" (func $core/cycles/getCycleSets))
 (export "getCycles" (func $core/cycles/getCycles))
 (export "setJoypadState" (func $core/joypad/joypad/setJoypadState))
 (export "getNumberOfSamplesInAudioBuffer" (func $core/sound/sound/getNumberOfSamplesInAudioBuffer))
 (export "clearAudioBuffer" (func $core/sound/sound/clearAudioBuffer))
 (export "setManualColorizationPalette" (func $core/graphics/colors/setManualColorizationPalette))
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
 (export "CHANNEL_1_BUFFER_LOCATION" (global $core/constants/CHANNEL_1_BUFFER_LOCATION))
 (export "CHANNEL_1_BUFFER_SIZE" (global $core/constants/CHANNEL_1_BUFFER_SIZE))
 (export "CHANNEL_2_BUFFER_LOCATION" (global $core/constants/CHANNEL_2_BUFFER_LOCATION))
 (export "CHANNEL_2_BUFFER_SIZE" (global $core/constants/CHANNEL_2_BUFFER_SIZE))
 (export "CHANNEL_3_BUFFER_LOCATION" (global $core/constants/CHANNEL_3_BUFFER_LOCATION))
 (export "CHANNEL_3_BUFFER_SIZE" (global $core/constants/CHANNEL_3_BUFFER_SIZE))
 (export "CHANNEL_4_BUFFER_LOCATION" (global $core/constants/CHANNEL_4_BUFFER_LOCATION))
 (export "CHANNEL_4_BUFFER_SIZE" (global $core/constants/CHANNEL_4_BUFFER_SIZE))
 (export "CARTRIDGE_RAM_LOCATION" (global $core/constants/CARTRIDGE_RAM_LOCATION))
 (export "CARTRIDGE_RAM_SIZE" (global $core/constants/CARTRIDGE_RAM_SIZE))
 (export "BOOT_ROM_LOCATION" (global $core/constants/BOOT_ROM_LOCATION))
 (export "BOOT_ROM_SIZE" (global $core/constants/BOOT_ROM_SIZE))
 (export "CARTRIDGE_ROM_LOCATION" (global $core/constants/CARTRIDGE_ROM_LOCATION))
 (export "CARTRIDGE_ROM_SIZE" (global $core/constants/CARTRIDGE_ROM_SIZE))
 (export "DEBUG_GAMEBOY_MEMORY_LOCATION" (global $core/constants/DEBUG_GAMEBOY_MEMORY_LOCATION))
 (export "DEBUG_GAMEBOY_MEMORY_SIZE" (global $core/constants/DEBUG_GAMEBOY_MEMORY_SIZE))
 (export "getWasmBoyOffsetFromGameBoyOffset" (func $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset))
 (export "setProgramCounterBreakpoint" (func $core/debug/breakpoints/setProgramCounterBreakpoint))
 (export "resetProgramCounterBreakpoint" (func $core/debug/breakpoints/resetProgramCounterBreakpoint))
 (export "setReadGbMemoryBreakpoint" (func $core/debug/breakpoints/setReadGbMemoryBreakpoint))
 (export "resetReadGbMemoryBreakpoint" (func $core/debug/breakpoints/resetReadGbMemoryBreakpoint))
 (export "setWriteGbMemoryBreakpoint" (func $core/debug/breakpoints/setWriteGbMemoryBreakpoint))
 (export "resetWriteGbMemoryBreakpoint" (func $core/debug/breakpoints/resetWriteGbMemoryBreakpoint))
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
 (export "getScrollX" (func $core/debug/debug-graphics/getScrollX))
 (export "getScrollY" (func $core/debug/debug-graphics/getScrollY))
 (export "getWindowX" (func $core/debug/debug-graphics/getWindowX))
 (export "getWindowY" (func $core/debug/debug-graphics/getWindowY))
 (export "drawBackgroundMapToWasmMemory" (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory))
 (export "drawTileDataToWasmMemory" (func $core/debug/debug-graphics/drawTileDataToWasmMemory))
 (export "drawOamToWasmMemory" (func $core/debug/debug-graphics/drawOamToWasmMemory))
 (export "getDIV" (func $core/debug/debug-timer/getDIV))
 (export "getTIMA" (func $core/debug/debug-timer/getTIMA))
 (export "getTMA" (func $core/debug/debug-timer/getTMA))
 (export "getTAC" (func $core/debug/debug-timer/getTAC))
 (export "updateDebugGBMemory" (func $core/debug/debug-memory/updateDebugGBMemory))
 (export "__setArgumentsLength" (func $~setArgumentsLength))
 (start $~start)
 (func $~lib/rt/tlsf/removeBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.load
  local.tee $2
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 277
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  i32.const -4
  i32.and
  local.tee $2
  i32.const 1073741808
  i32.lt_u
  i32.const 0
  local.get $2
  i32.const 16
  i32.ge_u
  select
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 279
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  i32.const 256
  i32.lt_u
  if
   local.get $2
   i32.const 4
   i32.shr_u
   local.set $2
  else
   local.get $2
   i32.const 31
   local.get $2
   i32.clz
   i32.sub
   local.tee $3
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $2
   local.get $3
   i32.const 7
   i32.sub
   local.set $3
  end
  local.get $2
  i32.const 16
  i32.lt_u
  i32.const 0
  local.get $3
  i32.const 23
  i32.lt_u
  select
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 292
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load offset=20
  local.set $4
  local.get $1
  i32.load offset=16
  local.tee $5
  if
   local.get $5
   local.get $4
   i32.store offset=20
  end
  local.get $4
  if
   local.get $4
   local.get $5
   i32.store offset=16
  end
  local.get $1
  local.get $0
  local.get $2
  local.get $3
  i32.const 4
  i32.shl
  i32.add
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=96
  i32.eq
  if
   local.get $0
   local.get $2
   local.get $3
   i32.const 4
   i32.shl
   i32.add
   i32.const 2
   i32.shl
   i32.add
   local.get $4
   i32.store offset=96
   local.get $4
   i32.eqz
   if
    local.get $0
    local.get $3
    i32.const 2
    i32.shl
    i32.add
    local.tee $4
    i32.load offset=4
    i32.const -2
    local.get $2
    i32.rotl
    i32.and
    local.set $1
    local.get $4
    local.get $1
    i32.store offset=4
    local.get $1
    i32.eqz
    if
     local.get $0
     local.get $0
     i32.load
     i32.const -2
     local.get $3
     i32.rotl
     i32.and
     i32.store
    end
   end
  end
 )
 (func $~lib/rt/tlsf/insertBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  local.get $1
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 205
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load
  local.tee $4
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 207
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 16
  i32.add
  local.get $1
  i32.load
  i32.const -4
  i32.and
  i32.add
  local.tee $5
  i32.load
  local.tee $2
  i32.const 1
  i32.and
  if
   local.get $4
   i32.const -4
   i32.and
   i32.const 16
   i32.add
   local.get $2
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.const 1073741808
   i32.lt_u
   if
    local.get $0
    local.get $5
    call $~lib/rt/tlsf/removeBlock
    local.get $1
    local.get $3
    local.get $4
    i32.const 3
    i32.and
    i32.or
    local.tee $4
    i32.store
    local.get $1
    i32.const 16
    i32.add
    local.get $1
    i32.load
    i32.const -4
    i32.and
    i32.add
    local.tee $5
    i32.load
    local.set $2
   end
  end
  local.get $4
  i32.const 2
  i32.and
  if
   local.get $1
   i32.const 4
   i32.sub
   i32.load
   local.tee $3
   i32.load
   local.tee $7
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 0
    i32.const 1040
    i32.const 228
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $7
   i32.const -4
   i32.and
   i32.const 16
   i32.add
   local.get $4
   i32.const -4
   i32.and
   i32.add
   local.tee $8
   i32.const 1073741808
   i32.lt_u
   if (result i32)
    local.get $0
    local.get $3
    call $~lib/rt/tlsf/removeBlock
    local.get $3
    local.get $8
    local.get $7
    i32.const 3
    i32.and
    i32.or
    local.tee $4
    i32.store
    local.get $3
   else
    local.get $1
   end
   local.set $1
  end
  local.get $5
  local.get $2
  i32.const 2
  i32.or
  i32.store
  local.get $4
  i32.const -4
  i32.and
  local.tee $3
  i32.const 1073741808
  i32.lt_u
  i32.const 0
  local.get $3
  i32.const 16
  i32.ge_u
  select
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 243
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $5
  local.get $3
  local.get $1
  i32.const 16
  i32.add
  i32.add
  i32.ne
  if
   i32.const 0
   i32.const 1040
   i32.const 244
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $5
  i32.const 4
  i32.sub
  local.get $1
  i32.store
  local.get $3
  i32.const 256
  i32.lt_u
  if
   local.get $3
   i32.const 4
   i32.shr_u
   local.set $3
  else
   local.get $3
   i32.const 31
   local.get $3
   i32.clz
   i32.sub
   local.tee $4
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $3
   local.get $4
   i32.const 7
   i32.sub
   local.set $6
  end
  local.get $3
  i32.const 16
  i32.lt_u
  i32.const 0
  local.get $6
  i32.const 23
  i32.lt_u
  select
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 260
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $3
  local.get $6
  i32.const 4
  i32.shl
  i32.add
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=96
  local.set $4
  local.get $1
  i32.const 0
  i32.store offset=16
  local.get $1
  local.get $4
  i32.store offset=20
  local.get $4
  if
   local.get $4
   local.get $1
   i32.store offset=16
  end
  local.get $0
  local.get $3
  local.get $6
  i32.const 4
  i32.shl
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.get $1
  i32.store offset=96
  local.get $0
  local.get $0
  i32.load
  i32.const 1
  local.get $6
  i32.shl
  i32.or
  i32.store
  local.get $0
  local.get $6
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  i32.load offset=4
  i32.const 1
  local.get $3
  i32.shl
  i32.or
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/addMemory (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  local.get $2
  i32.const 15
  i32.and
  i32.eqz
  i32.const 0
  local.get $1
  i32.const 15
  i32.and
  i32.eqz
  i32.const 0
  local.get $1
  local.get $2
  i32.le_u
  select
  select
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 386
   i32.const 5
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load offset=1568
  local.tee $3
  if
   local.get $1
   local.get $3
   i32.const 16
   i32.add
   i32.lt_u
   if
    i32.const 0
    i32.const 1040
    i32.const 396
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $3
   local.get $1
   i32.const 16
   i32.sub
   i32.eq
   if
    local.get $3
    i32.load
    local.set $4
    local.get $1
    i32.const 16
    i32.sub
    local.set $1
   end
  else
   local.get $1
   local.get $0
   i32.const 1572
   i32.add
   i32.lt_u
   if
    i32.const 0
    i32.const 1040
    i32.const 408
    i32.const 5
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $2
  local.get $1
  i32.sub
  local.tee $2
  i32.const 48
  i32.lt_u
  if
   return
  end
  local.get $1
  local.get $4
  i32.const 2
  i32.and
  local.get $2
  i32.const 32
  i32.sub
  i32.const 1
  i32.or
  i32.or
  i32.store
  local.get $1
  i32.const 0
  i32.store offset=16
  local.get $1
  i32.const 0
  i32.store offset=20
  local.get $1
  local.get $2
  i32.add
  i32.const 16
  i32.sub
  local.tee $2
  i32.const 2
  i32.store
  local.get $0
  local.get $2
  i32.store offset=1568
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/tlsf/maybeInitialize (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/rt/tlsf/ROOT
  local.tee $2
  i32.eqz
  if
   i32.const 1
   memory.size
   local.tee $0
   i32.gt_s
   if (result i32)
    i32.const 1
    local.get $0
    i32.sub
    memory.grow
    i32.const 0
    i32.lt_s
   else
    i32.const 0
   end
   if
    unreachable
   end
   i32.const 1216
   local.set $2
   i32.const 1216
   i32.const 0
   i32.store
   i32.const 2784
   i32.const 0
   i32.store
   loop $for-loop|0
    local.get $1
    i32.const 23
    i32.lt_u
    if
     local.get $1
     i32.const 2
     i32.shl
     i32.const 1216
     i32.add
     i32.const 0
     i32.store offset=4
     i32.const 0
     local.set $0
     loop $for-loop|1
      local.get $0
      i32.const 16
      i32.lt_u
      if
       local.get $0
       local.get $1
       i32.const 4
       i32.shl
       i32.add
       i32.const 2
       i32.shl
       i32.const 1216
       i32.add
       i32.const 0
       i32.store offset=96
       local.get $0
       i32.const 1
       i32.add
       local.set $0
       br $for-loop|1
      end
     end
     local.get $1
     i32.const 1
     i32.add
     local.set $1
     br $for-loop|0
    end
   end
   i32.const 1216
   i32.const 2800
   memory.size
   i32.const 16
   i32.shl
   call $~lib/rt/tlsf/addMemory
   i32.const 1216
   global.set $~lib/rt/tlsf/ROOT
  end
  local.get $2
 )
 (func $~lib/rt/tlsf/searchBlock (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $1
  i32.const 256
  i32.lt_u
  if
   local.get $1
   i32.const 4
   i32.shr_u
   local.set $1
  else
   local.get $1
   i32.const 536870904
   i32.lt_u
   if
    local.get $1
    i32.const 1
    i32.const 27
    local.get $1
    i32.clz
    i32.sub
    i32.shl
    i32.add
    i32.const 1
    i32.sub
    local.set $1
   end
   local.get $1
   i32.const 31
   local.get $1
   i32.clz
   i32.sub
   local.tee $2
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $1
   local.get $2
   i32.const 7
   i32.sub
   local.set $2
  end
  local.get $1
  i32.const 16
  i32.lt_u
  i32.const 0
  local.get $2
  i32.const 23
  i32.lt_u
  select
  i32.eqz
  if
   i32.const 0
   i32.const 1040
   i32.const 338
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=4
  i32.const -1
  local.get $1
  i32.shl
  i32.and
  local.tee $1
  if (result i32)
   local.get $0
   local.get $1
   i32.ctz
   local.get $2
   i32.const 4
   i32.shl
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
  else
   local.get $0
   i32.load
   i32.const -1
   local.get $2
   i32.const 1
   i32.add
   i32.shl
   i32.and
   local.tee $1
   if (result i32)
    local.get $0
    local.get $1
    i32.ctz
    local.tee $1
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=4
    local.tee $2
    i32.eqz
    if
     i32.const 0
     i32.const 1040
     i32.const 351
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    local.get $2
    i32.ctz
    local.get $1
    i32.const 4
    i32.shl
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=96
   else
    i32.const 0
   end
  end
 )
 (func $~lib/rt/tlsf/prepareBlock (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  local.get $1
  i32.load
  local.set $3
  local.get $2
  i32.const 15
  i32.and
  if
   i32.const 0
   i32.const 1040
   i32.const 365
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const -4
  i32.and
  local.get $2
  i32.sub
  local.tee $4
  i32.const 32
  i32.ge_u
  if
   local.get $1
   local.get $2
   local.get $3
   i32.const 2
   i32.and
   i32.or
   i32.store
   local.get $2
   local.get $1
   i32.const 16
   i32.add
   i32.add
   local.tee $1
   local.get $4
   i32.const 16
   i32.sub
   i32.const 1
   i32.or
   i32.store
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $1
   local.get $3
   i32.const -2
   i32.and
   i32.store
   local.get $1
   i32.const 16
   i32.add
   local.tee $0
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.get $0
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   i32.load
   i32.const -3
   i32.and
   i32.store
  end
 )
 (func $~lib/rt/tlsf/allocateBlock (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $~lib/rt/tlsf/collectLock
  if
   i32.const 0
   i32.const 1040
   i32.const 500
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.tee $3
  i32.const 1073741808
  i32.ge_u
  if
   i32.const 1088
   i32.const 1040
   i32.const 461
   i32.const 30
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $3
  i32.const 15
  i32.add
  i32.const -16
  i32.and
  local.tee $1
  i32.const 16
  local.get $1
  i32.const 16
  i32.gt_u
  select
  local.tee $1
  call $~lib/rt/tlsf/searchBlock
  local.tee $4
  i32.eqz
  if
   i32.const 1
   global.set $~lib/rt/tlsf/collectLock
   i32.const 0
   global.set $~lib/rt/tlsf/collectLock
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/searchBlock
   local.tee $4
   i32.eqz
   if
    local.get $1
    i32.const 536870904
    i32.lt_u
    if (result i32)
     local.get $1
     i32.const 1
     i32.const 27
     local.get $1
     i32.clz
     i32.sub
     i32.shl
     i32.const 1
     i32.sub
     i32.add
    else
     local.get $1
    end
    i32.const 16
    memory.size
    local.tee $4
    i32.const 16
    i32.shl
    i32.const 16
    i32.sub
    local.get $0
    i32.load offset=1568
    i32.ne
    i32.shl
    i32.add
    i32.const 65535
    i32.add
    i32.const -65536
    i32.and
    i32.const 16
    i32.shr_u
    local.set $5
    local.get $4
    local.get $5
    local.get $4
    local.get $5
    i32.gt_s
    select
    memory.grow
    i32.const 0
    i32.lt_s
    if
     local.get $5
     memory.grow
     i32.const 0
     i32.lt_s
     if
      unreachable
     end
    end
    local.get $0
    local.get $4
    i32.const 16
    i32.shl
    memory.size
    i32.const 16
    i32.shl
    call $~lib/rt/tlsf/addMemory
    local.get $0
    local.get $1
    call $~lib/rt/tlsf/searchBlock
    local.tee $4
    i32.eqz
    if
     i32.const 0
     i32.const 1040
     i32.const 512
     i32.const 20
     call $~lib/builtins/abort
     unreachable
    end
   end
  end
  local.get $4
  i32.load
  i32.const -4
  i32.and
  local.get $1
  i32.lt_u
  if
   i32.const 0
   i32.const 1040
   i32.const 520
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  i32.const 0
  i32.store offset=4
  local.get $4
  local.get $2
  i32.store offset=8
  local.get $4
  local.get $3
  i32.store offset=12
  local.get $0
  local.get $4
  call $~lib/rt/tlsf/removeBlock
  local.get $0
  local.get $4
  local.get $1
  call $~lib/rt/tlsf/prepareBlock
  local.get $4
 )
 (func $~lib/rt/tlsf/__alloc (param $0 i32) (param $1 i32) (result i32)
  call $~lib/rt/tlsf/maybeInitialize
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/allocateBlock
  i32.const 16
  i32.add
 )
 (func $~lib/rt/pure/__retain (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  i32.const 1212
  i32.gt_u
  if
   local.get $0
   i32.const 16
   i32.sub
   local.tee $1
   i32.load offset=4
   local.tee $2
   i32.const -268435456
   i32.and
   local.get $2
   i32.const 1
   i32.add
   i32.const -268435456
   i32.and
   i32.ne
   if
    i32.const 0
    i32.const 1152
    i32.const 109
    i32.const 3
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   local.get $2
   i32.const 1
   i32.add
   i32.store offset=4
   local.get $1
   i32.load
   i32.const 1
   i32.and
   if
    i32.const 0
    i32.const 1152
    i32.const 112
    i32.const 14
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $0
 )
 (func $~lib/rt/pure/__release (param $0 i32)
  local.get $0
  i32.const 1212
  i32.gt_u
  if
   local.get $0
   i32.const 16
   i32.sub
   call $~lib/rt/pure/decrement
  end
 )
 (func $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner0
   block $case14|0
    block $case13|0
     block $case12|0
      block $case11|0
       block $case9|0
        block $case7|0
         block $case3|0
          block $case0|0
           local.get $0
           i32.const 12
           i32.shr_s
           br_table $case0|0 $case3|0 $case3|0 $case3|0 $case7|0 $case7|0 $case7|0 $case7|0 $case9|0 $case9|0 $case11|0 $case11|0 $case12|0 $case13|0 $case14|0
          end
          global.get $core/cpu/cpu/Cpu.BootROMEnabled
          if
           global.get $core/cpu/cpu/Cpu.GBCEnabled
           if
            local.get $0
            i32.const 256
            i32.lt_s
            br_if $folding-inner0
            local.get $0
            i32.const 2304
            i32.lt_s
            i32.const 0
            local.get $0
            i32.const 511
            i32.gt_s
            select
            br_if $folding-inner0
           else
            i32.const 0
            local.get $0
            i32.const 256
            i32.lt_s
            global.get $core/cpu/cpu/Cpu.GBCEnabled
            select
            br_if $folding-inner0
           end
          end
         end
         local.get $0
         i32.const 1332864
         i32.add
         return
        end
        local.get $0
        i32.const 16384
        i32.sub
        i32.const 0
        global.get $core/memory/memory/Memory.currentRomBank
        local.tee $0
        i32.eqz
        global.get $core/memory/memory/Memory.isMBC5
        select
        if (result i32)
         i32.const 1
        else
         local.get $0
        end
        i32.const 14
        i32.shl
        i32.add
        i32.const 1332864
        i32.add
        return
       end
       local.get $0
       i32.const -30720
       i32.add
       global.get $core/cpu/cpu/Cpu.GBCEnabled
       if (result i32)
        i32.const 65359
        call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
        i32.load8_u
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
      local.get $0
      global.get $core/memory/memory/Memory.currentRamBank
      i32.const 13
      i32.shl
      i32.add
      i32.const 1158272
      i32.add
      return
     end
     local.get $0
     i32.const -30720
     i32.add
     return
    end
    local.get $0
    i32.const 1
    global.get $core/cpu/cpu/Cpu.GBCEnabled
    if (result i32)
     i32.const 65392
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     i32.load8_u
     i32.const 7
     i32.and
    else
     i32.const 0
    end
    local.tee $1
    local.get $1
    i32.const 1
    i32.lt_u
    select
    i32.const 12
    i32.shl
    i32.add
    i32.const -34816
    i32.add
    return
   end
   local.get $0
   i32.const -6144
   i32.add
   return
  end
  local.get $0
  i32.const 1330304
  i32.add
 )
 (func $core/cpu/cpu/initializeCpu
  i32.const 0
  global.set $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerA
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerB
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerC
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerD
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerE
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerH
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerL
  i32.const 0
  global.set $core/cpu/cpu/Cpu.registerF
  i32.const 0
  global.set $core/cpu/cpu/Cpu.stackPointer
  i32.const 0
  global.set $core/cpu/cpu/Cpu.programCounter
  i32.const 0
  global.set $core/cpu/cpu/Cpu.currentCycles
  i32.const 0
  global.set $core/cpu/cpu/Cpu.isHaltNormal
  i32.const 0
  global.set $core/cpu/cpu/Cpu.isHaltNoJump
  i32.const 0
  global.set $core/cpu/cpu/Cpu.isHaltBug
  i32.const 0
  global.set $core/cpu/cpu/Cpu.isStopped
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   return
  end
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 17
   global.set $core/cpu/cpu/Cpu.registerA
   i32.const 128
   global.set $core/cpu/cpu/Cpu.registerF
   i32.const 0
   global.set $core/cpu/cpu/Cpu.registerB
   i32.const 0
   global.set $core/cpu/cpu/Cpu.registerC
   i32.const 255
   global.set $core/cpu/cpu/Cpu.registerD
   i32.const 86
   global.set $core/cpu/cpu/Cpu.registerE
   i32.const 0
   global.set $core/cpu/cpu/Cpu.registerH
   i32.const 13
   global.set $core/cpu/cpu/Cpu.registerL
  else
   i32.const 1
   global.set $core/cpu/cpu/Cpu.registerA
   i32.const 176
   global.set $core/cpu/cpu/Cpu.registerF
   i32.const 0
   global.set $core/cpu/cpu/Cpu.registerB
   i32.const 19
   global.set $core/cpu/cpu/Cpu.registerC
   i32.const 0
   global.set $core/cpu/cpu/Cpu.registerD
   i32.const 216
   global.set $core/cpu/cpu/Cpu.registerE
   i32.const 1
   global.set $core/cpu/cpu/Cpu.registerH
   i32.const 77
   global.set $core/cpu/cpu/Cpu.registerL
  end
  i32.const 256
  global.set $core/cpu/cpu/Cpu.programCounter
  i32.const 65534
  global.set $core/cpu/cpu/Cpu.stackPointer
 )
 (func $core/graphics/colors/setManualColorizationPalette (param $0 i32)
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
               block $case0|0
                local.get $0
                br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $break|0
               end
               i32.const 15921906
               global.set $core/graphics/colors/Colors.bgWhite
               i32.const 10526880
               global.set $core/graphics/colors/Colors.bgLightGrey
               i32.const 5789784
               global.set $core/graphics/colors/Colors.bgDarkGrey
               i32.const 526344
               global.set $core/graphics/colors/Colors.bgBlack
               i32.const 15921906
               global.set $core/graphics/colors/Colors.obj0White
               i32.const 10526880
               global.set $core/graphics/colors/Colors.obj0LightGrey
               i32.const 5789784
               global.set $core/graphics/colors/Colors.obj0DarkGrey
               i32.const 526344
               global.set $core/graphics/colors/Colors.obj0Black
               i32.const 15921906
               global.set $core/graphics/colors/Colors.obj1White
               i32.const 10526880
               global.set $core/graphics/colors/Colors.obj1LightGrey
               i32.const 5789784
               global.set $core/graphics/colors/Colors.obj1DarkGrey
               i32.const 526344
               global.set $core/graphics/colors/Colors.obj1Black
               br $break|0
              end
              i32.const 16777215
              global.set $core/graphics/colors/Colors.bgWhite
              i32.const 16756067
              global.set $core/graphics/colors/Colors.bgLightGrey
              i32.const 8663296
              global.set $core/graphics/colors/Colors.bgDarkGrey
              i32.const 0
              global.set $core/graphics/colors/Colors.bgBlack
              i32.const 16777215
              global.set $core/graphics/colors/Colors.obj0White
              i32.const 16756067
              global.set $core/graphics/colors/Colors.obj0LightGrey
              i32.const 8663296
              global.set $core/graphics/colors/Colors.obj0DarkGrey
              i32.const 0
              global.set $core/graphics/colors/Colors.obj0Black
              i32.const 16777215
              global.set $core/graphics/colors/Colors.obj1White
              i32.const 16756067
              global.set $core/graphics/colors/Colors.obj1LightGrey
              i32.const 8663296
              global.set $core/graphics/colors/Colors.obj1DarkGrey
              i32.const 0
              global.set $core/graphics/colors/Colors.obj1Black
              br $break|0
             end
             i32.const 16777215
             global.set $core/graphics/colors/Colors.bgWhite
             i32.const 16745604
             global.set $core/graphics/colors/Colors.bgLightGrey
             i32.const 9714234
             global.set $core/graphics/colors/Colors.bgDarkGrey
             i32.const 0
             global.set $core/graphics/colors/Colors.bgBlack
             i32.const 16777215
             global.set $core/graphics/colors/Colors.obj0White
             i32.const 8126257
             global.set $core/graphics/colors/Colors.obj0LightGrey
             i32.const 33792
             global.set $core/graphics/colors/Colors.obj0DarkGrey
             i32.const 0
             global.set $core/graphics/colors/Colors.obj0Black
             i32.const 16777215
             global.set $core/graphics/colors/Colors.obj1White
             i32.const 6530559
             global.set $core/graphics/colors/Colors.obj1LightGrey
             i32.const 255
             global.set $core/graphics/colors/Colors.obj1DarkGrey
             i32.const 0
             global.set $core/graphics/colors/Colors.obj1Black
             br $break|0
            end
            i32.const 16770757
            global.set $core/graphics/colors/Colors.bgWhite
            i32.const 13540484
            global.set $core/graphics/colors/Colors.bgLightGrey
            i32.const 8678185
            global.set $core/graphics/colors/Colors.bgDarkGrey
            i32.const 5910792
            global.set $core/graphics/colors/Colors.bgBlack
            i32.const 16777215
            global.set $core/graphics/colors/Colors.obj0White
            i32.const 16756067
            global.set $core/graphics/colors/Colors.obj0LightGrey
            i32.const 8663296
            global.set $core/graphics/colors/Colors.obj0DarkGrey
            i32.const 0
            global.set $core/graphics/colors/Colors.obj0Black
            i32.const 16777215
            global.set $core/graphics/colors/Colors.obj1White
            i32.const 16756067
            global.set $core/graphics/colors/Colors.obj1LightGrey
            i32.const 8663296
            global.set $core/graphics/colors/Colors.obj1DarkGrey
            i32.const 0
            global.set $core/graphics/colors/Colors.obj1Black
            br $break|0
           end
           i32.const 16777215
           global.set $core/graphics/colors/Colors.bgWhite
           i32.const 5439232
           global.set $core/graphics/colors/Colors.bgLightGrey
           i32.const 16728576
           global.set $core/graphics/colors/Colors.bgDarkGrey
           i32.const 0
           global.set $core/graphics/colors/Colors.bgBlack
           i32.const 16777215
           global.set $core/graphics/colors/Colors.obj0White
           i32.const 5439232
           global.set $core/graphics/colors/Colors.obj0LightGrey
           i32.const 16728576
           global.set $core/graphics/colors/Colors.obj0DarkGrey
           i32.const 0
           global.set $core/graphics/colors/Colors.obj0Black
           i32.const 16777215
           global.set $core/graphics/colors/Colors.obj1White
           i32.const 5439232
           global.set $core/graphics/colors/Colors.obj1LightGrey
           i32.const 16728576
           global.set $core/graphics/colors/Colors.obj1DarkGrey
           i32.const 0
           global.set $core/graphics/colors/Colors.obj1Black
           br $break|0
          end
          i32.const 16777215
          global.set $core/graphics/colors/Colors.bgWhite
          i32.const 8126257
          global.set $core/graphics/colors/Colors.bgLightGrey
          i32.const 25541
          global.set $core/graphics/colors/Colors.bgDarkGrey
          i32.const 0
          global.set $core/graphics/colors/Colors.bgBlack
          i32.const 16777215
          global.set $core/graphics/colors/Colors.obj0White
          i32.const 16745604
          global.set $core/graphics/colors/Colors.obj0LightGrey
          i32.const 9714234
          global.set $core/graphics/colors/Colors.obj0DarkGrey
          i32.const 0
          global.set $core/graphics/colors/Colors.obj0Black
          i32.const 16777215
          global.set $core/graphics/colors/Colors.obj1White
          i32.const 16745604
          global.set $core/graphics/colors/Colors.obj1LightGrey
          i32.const 9714234
          global.set $core/graphics/colors/Colors.obj1DarkGrey
          i32.const 0
          global.set $core/graphics/colors/Colors.obj1Black
          br $break|0
         end
         i32.const 0
         global.set $core/graphics/colors/Colors.bgWhite
         i32.const 33924
         global.set $core/graphics/colors/Colors.bgLightGrey
         i32.const 16768512
         global.set $core/graphics/colors/Colors.bgDarkGrey
         i32.const 16777215
         global.set $core/graphics/colors/Colors.bgBlack
         i32.const 0
         global.set $core/graphics/colors/Colors.obj0White
         i32.const 33924
         global.set $core/graphics/colors/Colors.obj0LightGrey
         i32.const 16768512
         global.set $core/graphics/colors/Colors.obj0DarkGrey
         i32.const 16777215
         global.set $core/graphics/colors/Colors.obj0Black
         i32.const 0
         global.set $core/graphics/colors/Colors.obj1White
         i32.const 33924
         global.set $core/graphics/colors/Colors.obj1LightGrey
         i32.const 16768512
         global.set $core/graphics/colors/Colors.obj1DarkGrey
         i32.const 16777215
         global.set $core/graphics/colors/Colors.obj1Black
         br $break|0
        end
        i32.const 16777125
        global.set $core/graphics/colors/Colors.bgWhite
        i32.const 16749716
        global.set $core/graphics/colors/Colors.bgLightGrey
        i32.const 9737471
        global.set $core/graphics/colors/Colors.bgDarkGrey
        i32.const 0
        global.set $core/graphics/colors/Colors.bgBlack
        i32.const 16777125
        global.set $core/graphics/colors/Colors.obj0White
        i32.const 16749716
        global.set $core/graphics/colors/Colors.obj0LightGrey
        i32.const 9737471
        global.set $core/graphics/colors/Colors.obj0DarkGrey
        i32.const 0
        global.set $core/graphics/colors/Colors.obj0Black
        i32.const 16777125
        global.set $core/graphics/colors/Colors.obj1White
        i32.const 16749716
        global.set $core/graphics/colors/Colors.obj1LightGrey
        i32.const 9737471
        global.set $core/graphics/colors/Colors.obj1DarkGrey
        i32.const 0
        global.set $core/graphics/colors/Colors.obj1Black
        br $break|0
       end
       i32.const 16777215
       global.set $core/graphics/colors/Colors.bgWhite
       i32.const 16776960
       global.set $core/graphics/colors/Colors.bgLightGrey
       i32.const 16711680
       global.set $core/graphics/colors/Colors.bgDarkGrey
       i32.const 0
       global.set $core/graphics/colors/Colors.bgBlack
       i32.const 16777215
       global.set $core/graphics/colors/Colors.obj0White
       i32.const 16776960
       global.set $core/graphics/colors/Colors.obj0LightGrey
       i32.const 16711680
       global.set $core/graphics/colors/Colors.obj0DarkGrey
       i32.const 0
       global.set $core/graphics/colors/Colors.obj0Black
       i32.const 16777215
       global.set $core/graphics/colors/Colors.obj1White
       i32.const 16776960
       global.set $core/graphics/colors/Colors.obj1LightGrey
       i32.const 16711680
       global.set $core/graphics/colors/Colors.obj1DarkGrey
       i32.const 0
       global.set $core/graphics/colors/Colors.obj1Black
       br $break|0
      end
      i32.const 16777215
      global.set $core/graphics/colors/Colors.bgWhite
      i32.const 16776960
      global.set $core/graphics/colors/Colors.bgLightGrey
      i32.const 8079872
      global.set $core/graphics/colors/Colors.bgDarkGrey
      i32.const 0
      global.set $core/graphics/colors/Colors.bgBlack
      i32.const 16777215
      global.set $core/graphics/colors/Colors.obj0White
      i32.const 6530559
      global.set $core/graphics/colors/Colors.obj0LightGrey
      i32.const 255
      global.set $core/graphics/colors/Colors.obj0DarkGrey
      i32.const 0
      global.set $core/graphics/colors/Colors.obj0Black
      i32.const 16777215
      global.set $core/graphics/colors/Colors.obj1White
      i32.const 8126257
      global.set $core/graphics/colors/Colors.obj1LightGrey
      i32.const 33792
      global.set $core/graphics/colors/Colors.obj1DarkGrey
      i32.const 0
      global.set $core/graphics/colors/Colors.obj1Black
      br $break|0
     end
     i32.const 16777215
     global.set $core/graphics/colors/Colors.bgWhite
     i32.const 6530559
     global.set $core/graphics/colors/Colors.bgLightGrey
     i32.const 255
     global.set $core/graphics/colors/Colors.bgDarkGrey
     i32.const 0
     global.set $core/graphics/colors/Colors.bgBlack
     i32.const 16777215
     global.set $core/graphics/colors/Colors.obj0White
     i32.const 16745604
     global.set $core/graphics/colors/Colors.obj0LightGrey
     i32.const 9714234
     global.set $core/graphics/colors/Colors.obj0DarkGrey
     i32.const 0
     global.set $core/graphics/colors/Colors.obj0Black
     i32.const 16777215
     global.set $core/graphics/colors/Colors.obj1White
     i32.const 8126257
     global.set $core/graphics/colors/Colors.obj1LightGrey
     i32.const 33792
     global.set $core/graphics/colors/Colors.obj1DarkGrey
     i32.const 0
     global.set $core/graphics/colors/Colors.obj1Black
     br $break|0
    end
    i32.const 16777215
    global.set $core/graphics/colors/Colors.bgWhite
    i32.const 9211102
    global.set $core/graphics/colors/Colors.bgLightGrey
    i32.const 5395084
    global.set $core/graphics/colors/Colors.bgDarkGrey
    i32.const 0
    global.set $core/graphics/colors/Colors.bgBlack
    i32.const 16777215
    global.set $core/graphics/colors/Colors.obj0White
    i32.const 16745604
    global.set $core/graphics/colors/Colors.obj0LightGrey
    i32.const 9714234
    global.set $core/graphics/colors/Colors.obj0DarkGrey
    i32.const 0
    global.set $core/graphics/colors/Colors.obj0Black
    i32.const 16777215
    global.set $core/graphics/colors/Colors.obj1White
    i32.const 16756067
    global.set $core/graphics/colors/Colors.obj1LightGrey
    i32.const 8663296
    global.set $core/graphics/colors/Colors.obj1DarkGrey
    i32.const 0
    global.set $core/graphics/colors/Colors.obj1Black
    br $break|0
   end
   i32.const 16777215
   global.set $core/graphics/colors/Colors.bgWhite
   i32.const 10855845
   global.set $core/graphics/colors/Colors.bgLightGrey
   i32.const 5395026
   global.set $core/graphics/colors/Colors.bgDarkGrey
   i32.const 0
   global.set $core/graphics/colors/Colors.bgBlack
   i32.const 16777215
   global.set $core/graphics/colors/Colors.obj0White
   i32.const 10855845
   global.set $core/graphics/colors/Colors.obj0LightGrey
   i32.const 5395026
   global.set $core/graphics/colors/Colors.obj0DarkGrey
   i32.const 0
   global.set $core/graphics/colors/Colors.obj0Black
   i32.const 16777215
   global.set $core/graphics/colors/Colors.obj1White
   i32.const 10855845
   global.set $core/graphics/colors/Colors.obj1LightGrey
   i32.const 5395026
   global.set $core/graphics/colors/Colors.obj1DarkGrey
   i32.const 0
   global.set $core/graphics/colors/Colors.obj1Black
  end
 )
 (func $core/graphics/colors/setHashColorizationPalette (param $0 i32)
  block $break|0
   block $case19|0
    block $case18|0
     block $case17|0
      block $case16|0
       block $case15|0
        block $case11|0
         block $case7|0
          block $case5|0
           block $case3|0
            block $case2|0
             block $case1|0
              local.get $0
              i32.const 136
              i32.ne
              if
               local.get $0
               i32.const 97
               i32.eq
               br_if $case1|0
               local.get $0
               i32.const 20
               i32.eq
               br_if $case2|0
               local.get $0
               i32.const 70
               i32.eq
               br_if $case3|0
               local.get $0
               i32.const 89
               i32.eq
               br_if $case5|0
               local.get $0
               i32.const 198
               i32.eq
               br_if $case5|0
               local.get $0
               i32.const 134
               i32.eq
               br_if $case7|0
               local.get $0
               i32.const 168
               i32.eq
               br_if $case7|0
               local.get $0
               i32.const 191
               i32.eq
               br_if $case11|0
               local.get $0
               i32.const 206
               i32.eq
               br_if $case11|0
               local.get $0
               i32.const 209
               i32.eq
               br_if $case11|0
               local.get $0
               i32.const 240
               i32.eq
               br_if $case11|0
               local.get $0
               i32.const 39
               i32.eq
               br_if $case15|0
               local.get $0
               i32.const 73
               i32.eq
               br_if $case15|0
               local.get $0
               i32.const 92
               i32.eq
               br_if $case15|0
               local.get $0
               i32.const 179
               i32.eq
               br_if $case15|0
               local.get $0
               i32.const 201
               i32.eq
               br_if $case16|0
               local.get $0
               i32.const 112
               i32.eq
               br_if $case17|0
               local.get $0
               i32.const 70
               i32.eq
               br_if $case18|0
               local.get $0
               i32.const 211
               i32.eq
               br_if $case19|0
               br $break|0
              end
              i32.const 10853631
              global.set $core/graphics/colors/Colors.bgWhite
              i32.const 16776960
              global.set $core/graphics/colors/Colors.bgLightGrey
              i32.const 25344
              global.set $core/graphics/colors/Colors.bgDarkGrey
              i32.const 0
              global.set $core/graphics/colors/Colors.bgBlack
              i32.const 10853631
              global.set $core/graphics/colors/Colors.obj0White
              i32.const 16776960
              global.set $core/graphics/colors/Colors.obj0LightGrey
              i32.const 25344
              global.set $core/graphics/colors/Colors.obj0DarkGrey
              i32.const 0
              global.set $core/graphics/colors/Colors.obj0Black
              i32.const 10853631
              global.set $core/graphics/colors/Colors.obj1White
              i32.const 16776960
              global.set $core/graphics/colors/Colors.obj1LightGrey
              i32.const 25344
              global.set $core/graphics/colors/Colors.obj1DarkGrey
              i32.const 0
              global.set $core/graphics/colors/Colors.obj1Black
              br $break|0
             end
             i32.const 16777215
             global.set $core/graphics/colors/Colors.bgWhite
             i32.const 6530559
             global.set $core/graphics/colors/Colors.bgLightGrey
             i32.const 255
             global.set $core/graphics/colors/Colors.bgDarkGrey
             i32.const 0
             global.set $core/graphics/colors/Colors.bgBlack
             i32.const 16777215
             global.set $core/graphics/colors/Colors.obj0White
             i32.const 16745604
             global.set $core/graphics/colors/Colors.obj0LightGrey
             i32.const 9714234
             global.set $core/graphics/colors/Colors.obj0DarkGrey
             i32.const 0
             global.set $core/graphics/colors/Colors.obj0Black
             i32.const 16777215
             global.set $core/graphics/colors/Colors.obj1White
             i32.const 6530559
             global.set $core/graphics/colors/Colors.obj1LightGrey
             i32.const 255
             global.set $core/graphics/colors/Colors.obj1DarkGrey
             i32.const 0
             global.set $core/graphics/colors/Colors.obj1Black
             br $break|0
            end
            i32.const 16777215
            global.set $core/graphics/colors/Colors.bgWhite
            i32.const 16745604
            global.set $core/graphics/colors/Colors.bgLightGrey
            i32.const 9714234
            global.set $core/graphics/colors/Colors.bgDarkGrey
            i32.const 0
            global.set $core/graphics/colors/Colors.bgBlack
            i32.const 16777215
            global.set $core/graphics/colors/Colors.obj0White
            i32.const 8126257
            global.set $core/graphics/colors/Colors.obj0LightGrey
            i32.const 33792
            global.set $core/graphics/colors/Colors.obj0DarkGrey
            i32.const 0
            global.set $core/graphics/colors/Colors.obj0Black
            i32.const 16777215
            global.set $core/graphics/colors/Colors.obj1White
            i32.const 16745604
            global.set $core/graphics/colors/Colors.obj1LightGrey
            i32.const 9714234
            global.set $core/graphics/colors/Colors.obj1DarkGrey
            i32.const 0
            global.set $core/graphics/colors/Colors.obj1Black
            br $break|0
           end
           i32.const 11908607
           global.set $core/graphics/colors/Colors.bgWhite
           i32.const 16777108
           global.set $core/graphics/colors/Colors.bgLightGrey
           i32.const 11360834
           global.set $core/graphics/colors/Colors.bgDarkGrey
           i32.const 0
           global.set $core/graphics/colors/Colors.bgBlack
           i32.const 0
           global.set $core/graphics/colors/Colors.obj0White
           i32.const 16777215
           global.set $core/graphics/colors/Colors.obj0LightGrey
           i32.const 16745604
           global.set $core/graphics/colors/Colors.obj0DarkGrey
           i32.const 9714234
           global.set $core/graphics/colors/Colors.obj0Black
           i32.const 0
           global.set $core/graphics/colors/Colors.obj1White
           i32.const 16777215
           global.set $core/graphics/colors/Colors.obj1LightGrey
           i32.const 16745604
           global.set $core/graphics/colors/Colors.obj1DarkGrey
           i32.const 9714234
           global.set $core/graphics/colors/Colors.obj1Black
           br $break|0
          end
          i32.const 16777215
          global.set $core/graphics/colors/Colors.bgWhite
          i32.const 11382148
          global.set $core/graphics/colors/Colors.bgLightGrey
          i32.const 4354939
          global.set $core/graphics/colors/Colors.bgDarkGrey
          i32.const 0
          global.set $core/graphics/colors/Colors.bgBlack
          i32.const 16777215
          global.set $core/graphics/colors/Colors.obj0White
          i32.const 16741120
          global.set $core/graphics/colors/Colors.obj0LightGrey
          i32.const 9716224
          global.set $core/graphics/colors/Colors.obj0DarkGrey
          i32.const 0
          global.set $core/graphics/colors/Colors.obj0Black
          i32.const 16777215
          global.set $core/graphics/colors/Colors.obj1White
          i32.const 5946879
          global.set $core/graphics/colors/Colors.obj1LightGrey
          i32.const 16711680
          global.set $core/graphics/colors/Colors.obj1DarkGrey
          i32.const 255
          global.set $core/graphics/colors/Colors.obj1Black
          br $break|0
         end
         i32.const 16777116
         global.set $core/graphics/colors/Colors.bgWhite
         i32.const 9745919
         global.set $core/graphics/colors/Colors.bgLightGrey
         i32.const 6526067
         global.set $core/graphics/colors/Colors.bgDarkGrey
         i32.const 14906
         global.set $core/graphics/colors/Colors.bgBlack
         i32.const 16762178
         global.set $core/graphics/colors/Colors.obj0White
         i32.const 16766464
         global.set $core/graphics/colors/Colors.obj0LightGrey
         i32.const 9714176
         global.set $core/graphics/colors/Colors.obj0DarkGrey
         i32.const 4849664
         global.set $core/graphics/colors/Colors.obj0Black
         i32.const 16777215
         global.set $core/graphics/colors/Colors.obj1White
         i32.const 16745604
         global.set $core/graphics/colors/Colors.obj1LightGrey
         i32.const 9714234
         global.set $core/graphics/colors/Colors.obj1DarkGrey
         i32.const 0
         global.set $core/graphics/colors/Colors.obj1Black
         br $break|0
        end
        i32.const 7077632
        global.set $core/graphics/colors/Colors.bgWhite
        i32.const 16777215
        global.set $core/graphics/colors/Colors.bgLightGrey
        i32.const 16732746
        global.set $core/graphics/colors/Colors.bgDarkGrey
        i32.const 0
        global.set $core/graphics/colors/Colors.bgBlack
        i32.const 16777215
        global.set $core/graphics/colors/Colors.obj0White
        i32.const 16777215
        global.set $core/graphics/colors/Colors.obj0LightGrey
        i32.const 6530559
        global.set $core/graphics/colors/Colors.obj0DarkGrey
        i32.const 255
        global.set $core/graphics/colors/Colors.obj0Black
        i32.const 16777215
        global.set $core/graphics/colors/Colors.obj1White
        i32.const 16756067
        global.set $core/graphics/colors/Colors.obj1LightGrey
        i32.const 8663296
        global.set $core/graphics/colors/Colors.obj1DarkGrey
        i32.const 0
        global.set $core/graphics/colors/Colors.obj1Black
        br $break|0
       end
       i32.const 10853631
       global.set $core/graphics/colors/Colors.bgWhite
       i32.const 16776960
       global.set $core/graphics/colors/Colors.bgLightGrey
       i32.const 25344
       global.set $core/graphics/colors/Colors.bgDarkGrey
       i32.const 0
       global.set $core/graphics/colors/Colors.bgBlack
       i32.const 16737106
       global.set $core/graphics/colors/Colors.obj0White
       i32.const 14024704
       global.set $core/graphics/colors/Colors.obj0LightGrey
       i32.const 6488064
       global.set $core/graphics/colors/Colors.obj0DarkGrey
       i32.const 0
       global.set $core/graphics/colors/Colors.obj0Black
       i32.const 255
       global.set $core/graphics/colors/Colors.obj1White
       i32.const 16777215
       global.set $core/graphics/colors/Colors.obj1LightGrey
       i32.const 16777083
       global.set $core/graphics/colors/Colors.obj1DarkGrey
       i32.const 34047
       global.set $core/graphics/colors/Colors.obj1Black
       br $break|0
      end
      i32.const 16777166
      global.set $core/graphics/colors/Colors.bgWhite
      i32.const 6549487
      global.set $core/graphics/colors/Colors.bgLightGrey
      i32.const 10257457
      global.set $core/graphics/colors/Colors.bgDarkGrey
      i32.const 5921370
      global.set $core/graphics/colors/Colors.bgBlack
      i32.const 16777215
      global.set $core/graphics/colors/Colors.obj0White
      i32.const 16741120
      global.set $core/graphics/colors/Colors.obj0LightGrey
      i32.const 9716224
      global.set $core/graphics/colors/Colors.obj0DarkGrey
      i32.const 0
      global.set $core/graphics/colors/Colors.obj0Black
      i32.const 16777215
      global.set $core/graphics/colors/Colors.obj1White
      i32.const 6530559
      global.set $core/graphics/colors/Colors.obj1LightGrey
      i32.const 255
      global.set $core/graphics/colors/Colors.obj1DarkGrey
      i32.const 0
      global.set $core/graphics/colors/Colors.obj1Black
      br $break|0
     end
     i32.const 16777215
     global.set $core/graphics/colors/Colors.bgWhite
     i32.const 16745604
     global.set $core/graphics/colors/Colors.bgLightGrey
     i32.const 9714234
     global.set $core/graphics/colors/Colors.bgDarkGrey
     i32.const 0
     global.set $core/graphics/colors/Colors.bgBlack
     i32.const 16777215
     global.set $core/graphics/colors/Colors.obj0White
     i32.const 65280
     global.set $core/graphics/colors/Colors.obj0LightGrey
     i32.const 3245056
     global.set $core/graphics/colors/Colors.obj0DarkGrey
     i32.const 18944
     global.set $core/graphics/colors/Colors.obj0Black
     i32.const 16777215
     global.set $core/graphics/colors/Colors.obj1White
     i32.const 6530559
     global.set $core/graphics/colors/Colors.obj1LightGrey
     i32.const 255
     global.set $core/graphics/colors/Colors.obj1DarkGrey
     i32.const 0
     global.set $core/graphics/colors/Colors.obj1Black
     br $break|0
    end
    i32.const 16777215
    global.set $core/graphics/colors/Colors.bgWhite
    i32.const 6530559
    global.set $core/graphics/colors/Colors.bgLightGrey
    i32.const 255
    global.set $core/graphics/colors/Colors.bgDarkGrey
    i32.const 0
    global.set $core/graphics/colors/Colors.bgBlack
    i32.const 16776960
    global.set $core/graphics/colors/Colors.obj0White
    i32.const 16711680
    global.set $core/graphics/colors/Colors.obj0LightGrey
    i32.const 6488064
    global.set $core/graphics/colors/Colors.obj0DarkGrey
    i32.const 0
    global.set $core/graphics/colors/Colors.obj0Black
    i32.const 16777215
    global.set $core/graphics/colors/Colors.obj1White
    i32.const 8126257
    global.set $core/graphics/colors/Colors.obj1LightGrey
    i32.const 33792
    global.set $core/graphics/colors/Colors.obj1DarkGrey
    i32.const 0
    global.set $core/graphics/colors/Colors.obj1Black
    br $break|0
   end
   i32.const 16777215
   global.set $core/graphics/colors/Colors.bgWhite
   i32.const 11382148
   global.set $core/graphics/colors/Colors.bgLightGrey
   i32.const 4354939
   global.set $core/graphics/colors/Colors.bgDarkGrey
   i32.const 0
   global.set $core/graphics/colors/Colors.bgBlack
   i32.const 16777215
   global.set $core/graphics/colors/Colors.obj0White
   i32.const 16756067
   global.set $core/graphics/colors/Colors.obj0LightGrey
   i32.const 16756067
   global.set $core/graphics/colors/Colors.obj0DarkGrey
   i32.const 0
   global.set $core/graphics/colors/Colors.obj0Black
   i32.const 16777215
   global.set $core/graphics/colors/Colors.obj1White
   i32.const 6530559
   global.set $core/graphics/colors/Colors.obj1LightGrey
   i32.const 255
   global.set $core/graphics/colors/Colors.obj1DarkGrey
   i32.const 0
   global.set $core/graphics/colors/Colors.obj1Black
  end
 )
 (func $core/graphics/graphics/initializeGraphics
  (local $0 i32)
  (local $1 i32)
  i32.const 0
  global.set $core/graphics/graphics/Graphics.currentCycles
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scrollX
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scrollY
  i32.const 0
  global.set $core/graphics/graphics/Graphics.windowX
  i32.const 0
  global.set $core/graphics/graphics/Graphics.windowY
  i32.const 144
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65345
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 129
   i32.store8
   i32.const 65348
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 144
   i32.store8
   i32.const 65351
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 252
   i32.store8
  else
   i32.const 65345
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 133
   i32.store8
   i32.const 65350
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65351
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 252
   i32.store8
   i32.const 65352
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65353
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
  end
  i32.const 144
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 65344
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 145
  i32.store8
  i32.const 65359
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65392
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 1
  i32.store8
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   global.get $core/cpu/cpu/Cpu.GBCEnabled
   if
    i32.const 0
    global.set $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 65344
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.const 0
    i32.store8
    i32.const 65345
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.const 128
    i32.store8
    i32.const 65348
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.const 0
    i32.store8
   else
    i32.const 0
    global.set $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 65344
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.const 0
    i32.store8
    i32.const 65345
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.const 132
    i32.store8
   end
  end
  i32.const 0
  call $core/graphics/colors/setManualColorizationPalette
  block $__inlined_func$core/graphics/colors/initializeColors
   global.get $core/cpu/cpu/Cpu.GBCEnabled
   br_if $__inlined_func$core/graphics/colors/initializeColors
   i32.const 0
   global.get $core/cpu/cpu/Cpu.BootROMEnabled
   global.get $core/cpu/cpu/Cpu.GBCEnabled
   select
   br_if $__inlined_func$core/graphics/colors/initializeColors
   i32.const 308
   local.set $0
   loop $for-loop|0
    local.get $0
    i32.const 323
    i32.le_s
    if
     local.get $1
     local.get $0
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     i32.load8_u
     i32.add
     local.set $1
     local.get $0
     i32.const 1
     i32.add
     local.set $0
     br $for-loop|0
    end
   end
   local.get $1
   i32.const 255
   i32.and
   call $core/graphics/colors/setHashColorizationPalette
  end
 )
 (func $core/sound/sound/initializeSound
  i32.const 0
  global.set $core/sound/sound/Sound.currentCycles
  i32.const 0
  global.set $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.const 0
  global.set $core/sound/sound/Sound.NR50RightMixerVolume
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR52IsSoundEnabled
  i32.const 0
  global.set $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.const 0
  global.set $core/sound/sound/Sound.downSampleCycleCounter
  i32.const 0
  global.set $core/sound/sound/Sound.frameSequencer
  i32.const 0
  global.set $core/sound/sound/Sound.audioQueueIndex
  i32.const 65296
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 128
  i32.store8
  i32.const 65297
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 191
  i32.store8
  i32.const 65298
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 243
  i32.store8
  i32.const 65299
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 193
  i32.store8
  i32.const 65300
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 191
  i32.store8
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   i32.const 65297
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 63
   i32.store8
   i32.const 65298
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 0
   i32.store8
   i32.const 65299
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 0
   i32.store8
   i32.const 65300
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 184
   i32.store8
  end
  i32.const 65301
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65302
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 63
  i32.store8
  i32.const 65303
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65304
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65305
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 184
  i32.store8
  i32.const 65306
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 127
  i32.store8
  i32.const 65307
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65308
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 159
  i32.store8
  i32.const 65309
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65310
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 184
  i32.store8
  i32.const 1
  global.set $core/sound/channel3/Channel3.volumeCodeChanged
  i32.const 65311
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65312
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65313
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65314
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65315
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 191
  i32.store8
  i32.const 65316
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 119
  i32.store8
  i32.const 7
  global.set $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.const 7
  global.set $core/sound/sound/Sound.NR50RightMixerVolume
  i32.const 65317
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 243
  i32.store8
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  i32.const 0
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  i32.const 0
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  i32.const 1
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
  i32.const 65318
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 241
  i32.store8
  i32.const 1
  global.set $core/sound/sound/Sound.NR52IsSoundEnabled
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   i32.const 65316
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 0
   i32.store8
   i32.const 0
   global.set $core/sound/sound/Sound.NR50LeftMixerVolume
   i32.const 0
   global.set $core/sound/sound/Sound.NR50RightMixerVolume
   i32.const 65317
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 0
   i32.store8
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
   i32.const 0
   global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
   i32.const 65318
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 112
   i32.store8
   i32.const 0
   global.set $core/sound/sound/Sound.NR52IsSoundEnabled
  end
  i32.const 15
  global.set $core/sound/accumulator/SoundAccumulator.channel1Sample
  i32.const 15
  global.set $core/sound/accumulator/SoundAccumulator.channel2Sample
  i32.const 15
  global.set $core/sound/accumulator/SoundAccumulator.channel3Sample
  i32.const 15
  global.set $core/sound/accumulator/SoundAccumulator.channel4Sample
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
  i32.const 127
  global.set $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
  i32.const 127
  global.set $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
  i32.const 1
  global.set $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
  i32.const 1
  global.set $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.needToRemixSamples
 )
 (func $core/core/initialize
  (local $0 i32)
  i32.const 323
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  local.tee $0
  i32.const 192
  i32.eq
  if (result i32)
   i32.const 1
  else
   local.get $0
   i32.const 128
   i32.eq
   i32.const 0
   global.get $core/config/Config.useGbcWhenAvailable
   select
  end
  if
   i32.const 1
   global.set $core/cpu/cpu/Cpu.GBCEnabled
  else
   i32.const 0
   global.set $core/cpu/cpu/Cpu.GBCEnabled
  end
  i32.const 0
  global.set $core/core/hasStarted
  i32.const 2000000000
  global.set $core/cycles/Cycles.cyclesPerCycleSet
  i32.const 0
  global.set $core/cycles/Cycles.cycleSets
  i32.const 0
  global.set $core/cycles/Cycles.cycles
  i32.const 2000000000
  global.set $core/execute/Execute.stepsPerStepSet
  i32.const 0
  global.set $core/execute/Execute.stepSets
  i32.const 0
  global.set $core/execute/Execute.steps
  global.get $core/config/Config.enableBootRom
  if
   i32.const 1
   global.set $core/cpu/cpu/Cpu.BootROMEnabled
  else
   i32.const 0
   global.set $core/cpu/cpu/Cpu.BootROMEnabled
  end
  call $core/cpu/cpu/initializeCpu
  i32.const 0
  global.set $core/memory/memory/Memory.isRamBankingEnabled
  i32.const 1
  global.set $core/memory/memory/Memory.isMBC1RomModeEnabled
  i32.const 327
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  local.tee $0
  i32.eqz
  global.set $core/memory/memory/Memory.isRomOnly
  local.get $0
  i32.const 3
  i32.le_u
  i32.const 0
  local.get $0
  i32.const 1
  i32.ge_u
  select
  global.set $core/memory/memory/Memory.isMBC1
  local.get $0
  i32.const 6
  i32.le_u
  i32.const 0
  local.get $0
  i32.const 5
  i32.ge_u
  select
  global.set $core/memory/memory/Memory.isMBC2
  local.get $0
  i32.const 19
  i32.le_u
  i32.const 0
  local.get $0
  i32.const 15
  i32.ge_u
  select
  global.set $core/memory/memory/Memory.isMBC3
  local.get $0
  i32.const 30
  i32.le_u
  i32.const 0
  local.get $0
  i32.const 25
  i32.ge_u
  select
  global.set $core/memory/memory/Memory.isMBC5
  i32.const 1
  global.set $core/memory/memory/Memory.currentRomBank
  i32.const 0
  global.set $core/memory/memory/Memory.currentRamBank
  i32.const 65359
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65392
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 1
  i32.store8
  i32.const 65361
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65362
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65363
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65364
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  i32.const 65365
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 255
  i32.store8
  call $core/graphics/graphics/initializeGraphics
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65384
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 192
   i32.store8
   i32.const 65385
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65386
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 193
   i32.store8
   i32.const 65387
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 13
   i32.store8
  else
   i32.const 65384
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65385
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65386
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65387
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
  end
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  i32.const 0
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  select
  if
   i32.const 65385
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 32
   i32.store8
   i32.const 65387
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 138
   i32.store8
  end
  call $core/sound/sound/initializeSound
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
  i32.const 65535
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 1
  global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
  i32.const 225
  global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 65295
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 225
  i32.store8
  i32.const 0
  global.set $core/timers/timers/Timers.currentCycles
  i32.const 0
  global.set $core/timers/timers/Timers.dividerRegister
  i32.const 0
  global.set $core/timers/timers/Timers.timerCounter
  i32.const 0
  global.set $core/timers/timers/Timers.timerModulo
  i32.const 0
  global.set $core/timers/timers/Timers.timerEnabled
  i32.const 0
  global.set $core/timers/timers/Timers.timerInputClock
  i32.const 0
  global.set $core/timers/timers/Timers.timerCounterOverflowDelay
  i32.const 0
  global.set $core/timers/timers/Timers.timerCounterWasReset
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65284
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 30
   i32.store8
   i32.const 7840
   global.set $core/timers/timers/Timers.dividerRegister
  else
   i32.const 65284
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 171
   i32.store8
   i32.const 43980
   global.set $core/timers/timers/Timers.dividerRegister
  end
  i32.const 65287
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 248
  i32.store8
  i32.const 248
  global.set $core/timers/timers/Timers.timerInputClock
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   global.get $core/cpu/cpu/Cpu.GBCEnabled
   i32.eqz
   if
    i32.const 65284
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.const 0
    i32.store8
    i32.const 4
    global.set $core/timers/timers/Timers.dividerRegister
   end
  end
  i32.const 0
  global.set $core/serial/serial/Serial.currentCycles
  i32.const 0
  global.set $core/serial/serial/Serial.numberOfBitsTransferred
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65282
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 124
   i32.store8
   i32.const 0
   global.set $core/serial/serial/Serial.isClockSpeedFast
  else
   i32.const 65282
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 126
   i32.store8
   i32.const 1
   global.set $core/serial/serial/Serial.isClockSpeedFast
  end
  i32.const 0
  global.set $core/serial/serial/Serial.transferStartFlag
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65392
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 248
   i32.store8
   i32.const 65359
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 254
   i32.store8
   i32.const 65357
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 126
   i32.store8
   i32.const 65280
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 207
   i32.store8
   i32.const 65295
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 225
   i32.store8
   i32.const 65388
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 254
   i32.store8
   i32.const 65397
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 143
   i32.store8
  else
   i32.const 65392
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65359
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65357
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
   i32.const 65280
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 207
   i32.store8
   i32.const 65295
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 225
   i32.store8
  end
 )
 (func $core/core/config (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32)
  local.get $0
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.enableBootRom
  local.get $1
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.useGbcWhenAvailable
  local.get $2
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.audioBatchProcessing
  local.get $3
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.graphicsBatchProcessing
  local.get $4
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.timersBatchProcessing
  local.get $5
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.graphicsDisableScanlineRendering
  local.get $6
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.audioAccumulateSamples
  local.get $7
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.tileRendering
  local.get $8
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.tileCaching
  local.get $9
  i32.const 0
  i32.gt_s
  global.set $core/config/Config.enableAudioDebugging
  call $core/core/initialize
 )
 (func $core/core/hasCoreStarted (result i32)
  global.get $core/core/hasStarted
 )
 (func $core/sound/sound/Sound.saveState
  i32.const 1324
  global.get $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.store
  i32.const 1328
  global.get $core/sound/sound/Sound.NR50RightMixerVolume
  i32.store
  i32.const 1332
  global.get $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1333
  global.get $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1334
  global.get $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1335
  global.get $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1336
  global.get $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1337
  global.get $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1338
  global.get $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1339
  global.get $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1340
  global.get $core/sound/sound/Sound.NR52IsSoundEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1341
  global.get $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.store
  i32.const 1346
  global.get $core/sound/sound/Sound.frameSequencer
  i32.store8
  i32.const 1347
  global.get $core/sound/sound/Sound.downSampleCycleCounter
  i32.store8
  i32.const 1348
  global.get $core/sound/accumulator/SoundAccumulator.channel1Sample
  i32.store8
  i32.const 1349
  global.get $core/sound/accumulator/SoundAccumulator.channel2Sample
  i32.store8
  i32.const 1350
  global.get $core/sound/accumulator/SoundAccumulator.channel3Sample
  i32.store8
  i32.const 1351
  global.get $core/sound/accumulator/SoundAccumulator.channel4Sample
  i32.store8
  i32.const 1352
  global.get $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1353
  global.get $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1354
  global.get $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1355
  global.get $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1356
  global.get $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
  i32.store8
  i32.const 1357
  global.get $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
  i32.store8
  i32.const 1358
  global.get $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1359
  global.get $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
  i32.const 0
  i32.ne
  i32.store8
 )
 (func $core/sound/channel1/Channel1.saveState
  i32.const 1374
  global.get $core/sound/channel1/Channel1.cycleCounter
  i32.store
  i32.const 1378
  global.get $core/sound/channel1/Channel1.NRx0SweepPeriod
  i32.store8
  i32.const 1379
  global.get $core/sound/channel1/Channel1.NRx0Negate
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1380
  global.get $core/sound/channel1/Channel1.NRx0SweepShift
  i32.store8
  i32.const 1381
  global.get $core/sound/channel1/Channel1.NRx1Duty
  i32.store8
  i32.const 1383
  global.get $core/sound/channel1/Channel1.NRx1LengthLoad
  i32.store16
  i32.const 1384
  global.get $core/sound/channel1/Channel1.NRx2StartingVolume
  i32.store8
  i32.const 1385
  global.get $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1386
  global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
  i32.store8
  i32.const 1387
  global.get $core/sound/channel1/Channel1.NRx3FrequencyLSB
  i32.store8
  i32.const 1388
  global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1389
  global.get $core/sound/channel1/Channel1.NRx4FrequencyMSB
  i32.store8
  i32.const 1390
  global.get $core/sound/channel1/Channel1.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1391
  global.get $core/sound/channel1/Channel1.isDacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1392
  global.get $core/sound/channel1/Channel1.frequency
  i32.store
  i32.const 1396
  global.get $core/sound/channel1/Channel1.frequencyTimer
  i32.store
  i32.const 1400
  global.get $core/sound/channel1/Channel1.envelopeCounter
  i32.store
  i32.const 1404
  global.get $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1405
  global.get $core/sound/channel1/Channel1.lengthCounter
  i32.store
  i32.const 1409
  global.get $core/sound/channel1/Channel1.volume
  i32.store
  i32.const 1413
  global.get $core/sound/channel1/Channel1.dutyCycle
  i32.store8
  i32.const 1414
  global.get $core/sound/channel1/Channel1.waveFormPositionOnDuty
  i32.store8
  i32.const 1415
  global.get $core/sound/channel1/Channel1.isSweepEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1416
  global.get $core/sound/channel1/Channel1.sweepCounter
  i32.store
  i32.const 1420
  global.get $core/sound/channel1/Channel1.sweepShadowFrequency
  i32.store16
  i32.const 1423
  global.get $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
  i32.const 0
  i32.ne
  i32.store8
 )
 (func $core/core/saveState
  i32.const 1024
  global.get $core/cpu/cpu/Cpu.registerA
  i32.store8
  i32.const 1025
  global.get $core/cpu/cpu/Cpu.registerB
  i32.store8
  i32.const 1026
  global.get $core/cpu/cpu/Cpu.registerC
  i32.store8
  i32.const 1027
  global.get $core/cpu/cpu/Cpu.registerD
  i32.store8
  i32.const 1028
  global.get $core/cpu/cpu/Cpu.registerE
  i32.store8
  i32.const 1029
  global.get $core/cpu/cpu/Cpu.registerH
  i32.store8
  i32.const 1030
  global.get $core/cpu/cpu/Cpu.registerL
  i32.store8
  i32.const 1031
  global.get $core/cpu/cpu/Cpu.registerF
  i32.store8
  i32.const 1032
  global.get $core/cpu/cpu/Cpu.stackPointer
  i32.store16
  i32.const 1034
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.store16
  i32.const 1036
  global.get $core/cpu/cpu/Cpu.currentCycles
  i32.store
  i32.const 1041
  global.get $core/cpu/cpu/Cpu.isHaltNormal
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1042
  global.get $core/cpu/cpu/Cpu.isHaltNoJump
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1043
  global.get $core/cpu/cpu/Cpu.isHaltBug
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1044
  global.get $core/cpu/cpu/Cpu.isStopped
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1045
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1046
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1047
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1074
  global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.store
  i32.const 1078
  global.get $core/graphics/graphics/Graphics.scanlineRegister
  i32.store8
  i32.const 1079
  global.get $core/graphics/graphics/Graphics.scrollX
  i32.store8
  i32.const 1080
  global.get $core/graphics/graphics/Graphics.scrollY
  i32.store8
  i32.const 1081
  global.get $core/graphics/graphics/Graphics.windowX
  i32.store8
  i32.const 1082
  global.get $core/graphics/graphics/Graphics.windowY
  i32.store8
  i32.const 1083
  global.get $core/graphics/lcd/Lcd.currentLcdMode
  i32.store8
  i32.const 1084
  global.get $core/graphics/lcd/Lcd.coincidenceCompare
  i32.store8
  i32.const 1085
  global.get $core/graphics/lcd/Lcd.enabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1086
  global.get $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1087
  global.get $core/graphics/lcd/Lcd.windowDisplayEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1088
  global.get $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1089
  global.get $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1090
  global.get $core/graphics/lcd/Lcd.tallSpriteSize
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1091
  global.get $core/graphics/lcd/Lcd.spriteDisplayEnable
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1092
  global.get $core/graphics/lcd/Lcd.bgDisplayEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1124
  global.get $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1125
  global.get $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1140
  global.get $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
  i32.store8
  i32.const 1141
  global.get $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1142
  global.get $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1143
  global.get $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1144
  global.get $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1145
  global.get $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1156
  global.get $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.store8
  i32.const 1157
  global.get $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1158
  global.get $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1159
  global.get $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1160
  global.get $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1161
  global.get $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1174
  global.get $core/joypad/joypad/Joypad.joypadRegisterFlipped
  i32.store
  i32.const 1175
  global.get $core/joypad/joypad/Joypad.isDpadType
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1176
  global.get $core/joypad/joypad/Joypad.isButtonType
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1224
  global.get $core/memory/memory/Memory.currentRomBank
  i32.store16
  i32.const 1226
  global.get $core/memory/memory/Memory.currentRamBank
  i32.store16
  i32.const 1228
  global.get $core/memory/memory/Memory.isRamBankingEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1229
  global.get $core/memory/memory/Memory.isMBC1RomModeEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1230
  global.get $core/memory/memory/Memory.isRomOnly
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1231
  global.get $core/memory/memory/Memory.isMBC1
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1232
  global.get $core/memory/memory/Memory.isMBC2
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1233
  global.get $core/memory/memory/Memory.isMBC3
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1234
  global.get $core/memory/memory/Memory.isMBC5
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1235
  global.get $core/memory/memory/Memory.DMACycles
  i32.store
  i32.const 1239
  global.get $core/memory/memory/Memory.isHblankHdmaActive
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1240
  global.get $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  i32.store
  i32.const 1244
  global.get $core/memory/memory/Memory.hblankHdmaSource
  i32.store
  i32.const 1248
  global.get $core/memory/memory/Memory.hblankHdmaDestination
  i32.store
  i32.const 1274
  global.get $core/timers/timers/Timers.currentCycles
  i32.store
  i32.const 1278
  global.get $core/timers/timers/Timers.dividerRegister
  i32.store
  i32.const 1282
  global.get $core/timers/timers/Timers.timerCounter
  i32.store
  i32.const 1286
  global.get $core/timers/timers/Timers.timerCounterOverflowDelay
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1287
  global.get $core/timers/timers/Timers.timerCounterWasReset
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1288
  global.get $core/timers/timers/Timers.timerCounterMask
  i32.store
  i32.const 1292
  global.get $core/timers/timers/Timers.timerModulo
  i32.store
  i32.const 1296
  global.get $core/timers/timers/Timers.timerEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1297
  global.get $core/timers/timers/Timers.timerInputClock
  i32.store
  call $core/sound/sound/Sound.saveState
  call $core/sound/channel1/Channel1.saveState
  i32.const 1424
  global.get $core/sound/channel2/Channel2.cycleCounter
  i32.store
  i32.const 1431
  global.get $core/sound/channel2/Channel2.NRx1Duty
  i32.store8
  i32.const 1432
  global.get $core/sound/channel2/Channel2.NRx1LengthLoad
  i32.store16
  i32.const 1434
  global.get $core/sound/channel2/Channel2.NRx2StartingVolume
  i32.store8
  i32.const 1435
  global.get $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1436
  global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
  i32.store8
  i32.const 1437
  global.get $core/sound/channel2/Channel2.NRx3FrequencyLSB
  i32.store8
  i32.const 1438
  global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1439
  global.get $core/sound/channel2/Channel2.NRx4FrequencyMSB
  i32.store8
  i32.const 1440
  global.get $core/sound/channel2/Channel2.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1441
  global.get $core/sound/channel2/Channel2.isDacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1442
  global.get $core/sound/channel2/Channel2.frequency
  i32.store
  i32.const 1446
  global.get $core/sound/channel2/Channel2.frequencyTimer
  i32.store
  i32.const 1450
  global.get $core/sound/channel2/Channel2.envelopeCounter
  i32.store
  i32.const 1454
  global.get $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1455
  global.get $core/sound/channel2/Channel2.lengthCounter
  i32.store
  i32.const 1459
  global.get $core/sound/channel2/Channel2.volume
  i32.store
  i32.const 1463
  global.get $core/sound/channel2/Channel2.dutyCycle
  i32.store8
  i32.const 1464
  global.get $core/sound/channel2/Channel2.waveFormPositionOnDuty
  i32.store8
  i32.const 1474
  global.get $core/sound/channel3/Channel3.cycleCounter
  i32.store
  i32.const 1482
  global.get $core/sound/channel3/Channel3.NRx1LengthLoad
  i32.store16
  i32.const 1484
  global.get $core/sound/channel3/Channel3.NRx2VolumeCode
  i32.store8
  i32.const 1486
  global.get $core/sound/channel3/Channel3.NRx3FrequencyLSB
  i32.store8
  i32.const 1487
  global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1488
  global.get $core/sound/channel3/Channel3.NRx4FrequencyMSB
  i32.store8
  i32.const 1489
  global.get $core/sound/channel3/Channel3.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1490
  global.get $core/sound/channel3/Channel3.isDacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1491
  global.get $core/sound/channel3/Channel3.frequency
  i32.store
  i32.const 1495
  global.get $core/sound/channel3/Channel3.frequencyTimer
  i32.store
  i32.const 1499
  global.get $core/sound/channel3/Channel3.lengthCounter
  i32.store
  i32.const 1507
  global.get $core/sound/channel3/Channel3.waveTablePosition
  i32.store
  i32.const 1511
  global.get $core/sound/channel3/Channel3.volumeCode
  i32.store8
  i32.const 1512
  global.get $core/sound/channel3/Channel3.volumeCodeChanged
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1513
  global.get $core/sound/channel3/Channel3.sampleBuffer
  i32.store
  i32.const 1524
  global.get $core/sound/channel4/Channel4.cycleCounter
  i32.store
  i32.const 1528
  global.get $core/sound/channel4/Channel4.NRx1LengthLoad
  i32.store16
  i32.const 1530
  global.get $core/sound/channel4/Channel4.NRx2StartingVolume
  i32.store8
  i32.const 1531
  global.get $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1532
  global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
  i32.store8
  i32.const 1533
  global.get $core/sound/channel4/Channel4.NRx3ClockShift
  i32.store8
  i32.const 1534
  global.get $core/sound/channel4/Channel4.NRx3WidthMode
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1535
  global.get $core/sound/channel4/Channel4.NRx3DivisorCode
  i32.store8
  i32.const 1537
  global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1539
  global.get $core/sound/channel4/Channel4.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1540
  global.get $core/sound/channel4/Channel4.isDacEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1545
  global.get $core/sound/channel4/Channel4.frequencyTimer
  i32.store
  i32.const 1549
  global.get $core/sound/channel4/Channel4.envelopeCounter
  i32.store
  i32.const 1553
  global.get $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1554
  global.get $core/sound/channel4/Channel4.lengthCounter
  i32.store
  i32.const 1558
  global.get $core/sound/channel4/Channel4.volume
  i32.store
  i32.const 1562
  global.get $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  i32.store16
  i32.const 0
  global.set $core/core/hasStarted
 )
 (func $core/sound/sound/clearAudioBuffer
  i32.const 0
  global.set $core/sound/sound/Sound.audioQueueIndex
 )
 (func $core/sound/sound/Sound.loadState
  i32.const 1324
  i32.load
  global.set $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.const 1328
  i32.load
  global.set $core/sound/sound/Sound.NR50RightMixerVolume
  i32.const 1332
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  i32.const 1333
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  i32.const 1334
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  i32.const 1335
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  i32.const 1336
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
  i32.const 1337
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  i32.const 1338
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  i32.const 1339
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  i32.const 1340
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/sound/Sound.NR52IsSoundEnabled
  i32.const 1341
  i32.load
  global.set $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.const 1346
  i32.load8_u
  global.set $core/sound/sound/Sound.frameSequencer
  i32.const 1347
  i32.load8_u
  global.set $core/sound/sound/Sound.downSampleCycleCounter
  i32.const 1348
  i32.load8_u
  global.set $core/sound/accumulator/SoundAccumulator.channel1Sample
  i32.const 1349
  i32.load8_u
  global.set $core/sound/accumulator/SoundAccumulator.channel2Sample
  i32.const 1350
  i32.load8_u
  global.set $core/sound/accumulator/SoundAccumulator.channel3Sample
  i32.const 1351
  i32.load8_u
  global.set $core/sound/accumulator/SoundAccumulator.channel4Sample
  i32.const 1352
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
  i32.const 1353
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
  i32.const 1354
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
  i32.const 1355
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
  i32.const 1356
  i32.load8_u
  global.set $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
  i32.const 1357
  i32.load8_u
  global.set $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
  i32.const 1358
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
  i32.const 1359
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
  i32.const 0
  global.set $core/sound/sound/Sound.audioQueueIndex
 )
 (func $core/sound/channel1/Channel1.loadState
  global.get $core/sound/channel1/Channel1.cycleCounter
  i32.const 50
  i32.mul
  i32.const 1024
  i32.add
  i32.load
  global.set $core/sound/channel1/Channel1.cycleCounter
  i32.const 1378
  i32.load8_u
  global.set $core/sound/channel1/Channel1.NRx0SweepPeriod
  i32.const 1379
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.NRx0Negate
  i32.const 1380
  i32.load8_u
  global.set $core/sound/channel1/Channel1.NRx0SweepShift
  i32.const 1381
  i32.load8_u
  global.set $core/sound/channel1/Channel1.NRx1Duty
  i32.const 1383
  i32.load16_u
  global.set $core/sound/channel1/Channel1.NRx1LengthLoad
  i32.const 1384
  i32.load8_u
  global.set $core/sound/channel1/Channel1.NRx2StartingVolume
  i32.const 1385
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
  i32.const 1386
  i32.load8_u
  global.set $core/sound/channel1/Channel1.NRx2EnvelopePeriod
  i32.const 1387
  i32.load8_u
  global.set $core/sound/channel1/Channel1.NRx3FrequencyLSB
  i32.const 1388
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.NRx4LengthEnabled
  i32.const 1389
  i32.load8_u
  global.set $core/sound/channel1/Channel1.NRx4FrequencyMSB
  i32.const 1390
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.isEnabled
  i32.const 1391
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.isDacEnabled
  i32.const 1392
  i32.load
  global.set $core/sound/channel1/Channel1.frequency
  i32.const 1396
  i32.load
  global.set $core/sound/channel1/Channel1.frequencyTimer
  i32.const 1400
  i32.load
  global.set $core/sound/channel1/Channel1.envelopeCounter
  i32.const 1404
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
  i32.const 1405
  i32.load
  global.set $core/sound/channel1/Channel1.lengthCounter
  i32.const 1409
  i32.load
  global.set $core/sound/channel1/Channel1.volume
  i32.const 1413
  i32.load8_u
  global.set $core/sound/channel1/Channel1.dutyCycle
  i32.const 1414
  i32.load8_u
  global.set $core/sound/channel1/Channel1.waveFormPositionOnDuty
  i32.const 1415
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.isSweepEnabled
  i32.const 1416
  i32.load8_u
  global.set $core/sound/channel1/Channel1.sweepCounter
  i32.const 1420
  i32.load8_u
  global.set $core/sound/channel1/Channel1.sweepShadowFrequency
  i32.const 1423
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
 )
 (func $core/sound/channel2/Channel2.loadState
  global.get $core/sound/channel2/Channel2.cycleCounter
  i32.const 50
  i32.mul
  i32.const 1024
  i32.add
  i32.load
  global.set $core/sound/channel2/Channel2.cycleCounter
  i32.const 1431
  i32.load8_u
  global.set $core/sound/channel2/Channel2.NRx1Duty
  i32.const 1432
  i32.load16_u
  global.set $core/sound/channel2/Channel2.NRx1LengthLoad
  i32.const 1434
  i32.load8_u
  global.set $core/sound/channel2/Channel2.NRx2StartingVolume
  i32.const 1435
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
  i32.const 1436
  i32.load8_u
  global.set $core/sound/channel2/Channel2.NRx2EnvelopePeriod
  i32.const 1437
  i32.load8_u
  global.set $core/sound/channel2/Channel2.NRx3FrequencyLSB
  i32.const 1438
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel2/Channel2.NRx4LengthEnabled
  i32.const 1439
  i32.load8_u
  global.set $core/sound/channel2/Channel2.NRx4FrequencyMSB
  i32.const 1440
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel2/Channel2.isEnabled
  i32.const 1441
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel2/Channel2.isDacEnabled
  i32.const 1442
  i32.load
  global.set $core/sound/channel2/Channel2.frequency
  i32.const 1446
  i32.load
  global.set $core/sound/channel2/Channel2.frequencyTimer
  i32.const 1450
  i32.load
  global.set $core/sound/channel2/Channel2.envelopeCounter
  i32.const 1454
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
  i32.const 1455
  i32.load
  global.set $core/sound/channel2/Channel2.lengthCounter
  i32.const 1459
  i32.load
  global.set $core/sound/channel2/Channel2.volume
  i32.const 1463
  i32.load8_u
  global.set $core/sound/channel2/Channel2.dutyCycle
  i32.const 1464
  i32.load8_u
  global.set $core/sound/channel2/Channel2.waveFormPositionOnDuty
 )
 (func $core/core/loadState
  i32.const 1024
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerA
  i32.const 1025
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerB
  i32.const 1026
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerC
  i32.const 1027
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerD
  i32.const 1028
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerE
  i32.const 1029
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerH
  i32.const 1030
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerL
  i32.const 1031
  i32.load8_u
  global.set $core/cpu/cpu/Cpu.registerF
  i32.const 1032
  i32.load16_u
  global.set $core/cpu/cpu/Cpu.stackPointer
  i32.const 1034
  i32.load16_u
  global.set $core/cpu/cpu/Cpu.programCounter
  i32.const 1036
  i32.load
  global.set $core/cpu/cpu/Cpu.currentCycles
  i32.const 1041
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/cpu/cpu/Cpu.isHaltNormal
  i32.const 1042
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/cpu/cpu/Cpu.isHaltNoJump
  i32.const 1043
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/cpu/cpu/Cpu.isHaltBug
  i32.const 1044
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/cpu/cpu/Cpu.isStopped
  i32.const 1045
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/cpu/cpu/Cpu.BootROMEnabled
  i32.const 1046
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/cpu/cpu/Cpu.GBCEnabled
  i32.const 1047
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.const 1074
  i32.load
  global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
  global.get $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 50
  i32.mul
  i32.const 1028
  i32.add
  i32.load8_u
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 1079
  i32.load8_u
  global.set $core/graphics/graphics/Graphics.scrollX
  i32.const 1080
  i32.load8_u
  global.set $core/graphics/graphics/Graphics.scrollY
  i32.const 1081
  i32.load8_u
  global.set $core/graphics/graphics/Graphics.windowX
  i32.const 1082
  i32.load8_u
  global.set $core/graphics/graphics/Graphics.windowY
  i32.const 1083
  i32.load8_u
  global.set $core/graphics/lcd/Lcd.currentLcdMode
  i32.const 1084
  i32.load8_u
  global.set $core/graphics/lcd/Lcd.coincidenceCompare
  i32.const 1085
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.enabled
  i32.const 1086
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
  i32.const 1087
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.windowDisplayEnabled
  i32.const 1088
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  i32.const 1089
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
  i32.const 1090
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.tallSpriteSize
  i32.const 1091
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.spriteDisplayEnable
  i32.const 1092
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/graphics/lcd/Lcd.bgDisplayEnabled
  i32.const 1124
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  i32.const 1125
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  i32.const 1140
  i32.load8_u
  global.set $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
  i32.const 1141
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
  i32.const 1142
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
  i32.const 1143
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
  i32.const 1144
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
  i32.const 1145
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
  i32.const 1156
  i32.load8_u
  global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 1157
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
  i32.const 1158
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
  i32.const 1159
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
  i32.const 1160
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
  i32.const 1161
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
  i32.const 1174
  i32.load
  global.set $core/joypad/joypad/Joypad.joypadRegisterFlipped
  i32.const 1175
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/joypad/joypad/Joypad.isDpadType
  i32.const 1176
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/joypad/joypad/Joypad.isButtonType
  i32.const 1224
  i32.load16_u
  global.set $core/memory/memory/Memory.currentRomBank
  i32.const 1226
  i32.load16_u
  global.set $core/memory/memory/Memory.currentRamBank
  i32.const 1228
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isRamBankingEnabled
  i32.const 1229
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isMBC1RomModeEnabled
  i32.const 1230
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isRomOnly
  i32.const 1231
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isMBC1
  i32.const 1232
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isMBC2
  i32.const 1233
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isMBC3
  i32.const 1234
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isMBC5
  i32.const 1235
  i32.load
  global.set $core/memory/memory/Memory.DMACycles
  i32.const 1239
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/memory/memory/Memory.isHblankHdmaActive
  i32.const 1240
  i32.load
  global.set $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  i32.const 1244
  i32.load
  global.set $core/memory/memory/Memory.hblankHdmaSource
  i32.const 1248
  i32.load
  global.set $core/memory/memory/Memory.hblankHdmaDestination
  i32.const 1274
  i32.load
  global.set $core/timers/timers/Timers.currentCycles
  i32.const 1278
  i32.load
  global.set $core/timers/timers/Timers.dividerRegister
  i32.const 1282
  i32.load
  global.set $core/timers/timers/Timers.timerCounter
  i32.const 1286
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/timers/timers/Timers.timerCounterOverflowDelay
  i32.const 1287
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/timers/timers/Timers.timerCounterWasReset
  i32.const 1288
  i32.load
  global.set $core/timers/timers/Timers.timerCounterMask
  i32.const 1292
  i32.load
  global.set $core/timers/timers/Timers.timerModulo
  i32.const 1296
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/timers/timers/Timers.timerEnabled
  i32.const 1297
  i32.load
  global.set $core/timers/timers/Timers.timerInputClock
  call $core/sound/sound/Sound.loadState
  call $core/sound/channel1/Channel1.loadState
  call $core/sound/channel2/Channel2.loadState
  global.get $core/sound/channel3/Channel3.cycleCounter
  i32.const 50
  i32.mul
  i32.const 1024
  i32.add
  i32.load
  global.set $core/sound/channel3/Channel3.cycleCounter
  i32.const 1482
  i32.load16_u
  global.set $core/sound/channel3/Channel3.NRx1LengthLoad
  i32.const 1484
  i32.load8_u
  global.set $core/sound/channel3/Channel3.NRx2VolumeCode
  i32.const 1486
  i32.load8_u
  global.set $core/sound/channel3/Channel3.NRx3FrequencyLSB
  i32.const 1487
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel3/Channel3.NRx4LengthEnabled
  i32.const 1488
  i32.load8_u
  global.set $core/sound/channel3/Channel3.NRx4FrequencyMSB
  i32.const 1489
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel3/Channel3.isEnabled
  i32.const 1490
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel3/Channel3.isDacEnabled
  i32.const 1491
  i32.load
  global.set $core/sound/channel3/Channel3.frequency
  i32.const 1495
  i32.load
  global.set $core/sound/channel3/Channel3.frequencyTimer
  i32.const 1499
  i32.load
  global.set $core/sound/channel3/Channel3.lengthCounter
  i32.const 1507
  i32.load
  global.set $core/sound/channel3/Channel3.waveTablePosition
  i32.const 1511
  i32.load
  global.set $core/sound/channel3/Channel3.volumeCode
  i32.const 1512
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel3/Channel3.volumeCodeChanged
  i32.const 1513
  i32.load
  global.set $core/sound/channel3/Channel3.sampleBuffer
  global.get $core/sound/channel4/Channel4.cycleCounter
  i32.const 50
  i32.mul
  i32.const 1024
  i32.add
  i32.load
  global.set $core/sound/channel4/Channel4.cycleCounter
  i32.const 1528
  i32.load8_u
  global.set $core/sound/channel4/Channel4.NRx1LengthLoad
  i32.const 1530
  i32.load8_u
  global.set $core/sound/channel4/Channel4.NRx2StartingVolume
  i32.const 1531
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
  i32.const 1532
  i32.load8_u
  global.set $core/sound/channel4/Channel4.NRx2EnvelopePeriod
  i32.const 1533
  i32.load8_u
  global.set $core/sound/channel4/Channel4.NRx3ClockShift
  i32.const 1534
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel4/Channel4.NRx3WidthMode
  i32.const 1535
  i32.load8_u
  global.set $core/sound/channel4/Channel4.NRx3DivisorCode
  i32.const 1537
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel4/Channel4.NRx4LengthEnabled
  i32.const 1539
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel4/Channel4.isEnabled
  i32.const 1540
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel4/Channel4.isDacEnabled
  i32.const 1545
  i32.load
  global.set $core/sound/channel4/Channel4.frequencyTimer
  i32.const 1549
  i32.load
  global.set $core/sound/channel4/Channel4.envelopeCounter
  i32.const 1553
  i32.load8_u
  i32.const 0
  i32.gt_u
  global.set $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
  i32.const 1554
  i32.load
  global.set $core/sound/channel4/Channel4.lengthCounter
  i32.const 1558
  i32.load
  global.set $core/sound/channel4/Channel4.volume
  i32.const 1562
  i32.load16_u
  global.set $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  i32.const 0
  global.set $core/core/hasStarted
  i32.const 2000000000
  global.set $core/cycles/Cycles.cyclesPerCycleSet
  i32.const 0
  global.set $core/cycles/Cycles.cycleSets
  i32.const 0
  global.set $core/cycles/Cycles.cycles
  i32.const 2000000000
  global.set $core/execute/Execute.stepsPerStepSet
  i32.const 0
  global.set $core/execute/Execute.stepSets
  i32.const 0
  global.set $core/execute/Execute.steps
 )
 (func $core/core/isGBC (result i32)
  global.get $core/cpu/cpu/Cpu.GBCEnabled
 )
 (func $core/execute/getStepsPerStepSet (result i32)
  global.get $core/execute/Execute.stepsPerStepSet
 )
 (func $core/execute/getStepSets (result i32)
  global.get $core/execute/Execute.stepSets
 )
 (func $core/execute/getSteps (result i32)
  global.get $core/execute/Execute.steps
 )
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileCache (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (result i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  local.get $0
  global.get $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
  local.tee $7
  i32.eq
  i32.const 0
  local.get $4
  global.get $core/graphics/tiles/TileCache.tileId
  i32.eq
  i32.const 0
  local.get $0
  i32.const 8
  i32.gt_s
  i32.const 0
  local.get $1
  i32.const 0
  i32.gt_s
  select
  select
  select
  if
   local.get $3
   i32.const 1
   i32.sub
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   i32.const 32
   i32.and
   i32.const 0
   i32.ne
   local.set $8
   local.get $3
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   i32.const 32
   i32.and
   i32.const 0
   i32.ne
   local.set $9
   loop $for-loop|0
    local.get $6
    i32.const 8
    i32.lt_s
    if
     local.get $0
     i32.const 7
     local.get $6
     i32.sub
     local.get $6
     local.get $8
     local.get $9
     i32.ne
     select
     local.tee $4
     i32.add
     local.tee $3
     i32.const 160
     i32.le_s
     if
      local.get $3
      local.get $1
      i32.const 160
      i32.mul
      local.tee $10
      i32.add
      local.tee $11
      i32.const 3
      i32.mul
      local.tee $6
      i32.const 91264
      i32.add
      local.tee $3
      local.get $3
      i32.load8_u
      i32.store8
      local.get $6
      i32.const 91265
      i32.add
      local.get $3
      i32.load8_u offset=1
      i32.store8
      local.get $6
      i32.const 91266
      i32.add
      local.get $3
      i32.load8_u offset=2
      i32.store8
      local.get $11
      i32.const 67712
      i32.add
      local.get $10
      local.get $0
      i32.const 0
      local.get $4
      i32.sub
      i32.sub
      i32.add
      i32.const 67704
      i32.add
      i32.load8_u
      local.tee $3
      i32.const 3
      i32.and
      local.tee $6
      i32.const 4
      i32.or
      local.get $6
      local.get $3
      i32.const 4
      i32.and
      select
      i32.store8
      local.get $5
      i32.const 1
      i32.add
      local.set $5
     end
     local.get $4
     i32.const 1
     i32.add
     local.set $6
     br $for-loop|0
    end
   end
  else
   local.get $4
   global.set $core/graphics/tiles/TileCache.tileId
  end
  local.get $0
  local.get $7
  i32.ge_s
  if (result i32)
   local.get $0
   i32.const 8
   i32.add
   local.set $1
   local.get $0
   local.get $2
   i32.const 7
   i32.and
   local.tee $0
   i32.lt_s
   if (result i32)
    local.get $0
    local.get $1
    i32.add
   else
    local.get $1
   end
  else
   local.get $7
  end
  global.set $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
  local.get $5
 )
 (func $core/graphics/palette/getColorizedGbHexColorFromPalette (param $0 i32) (param $1 i32) (result i32)
  local.get $1
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  local.get $0
  i32.const 1
  i32.shl
  i32.shr_s
  i32.const 3
  i32.and
  local.set $0
  local.get $1
  i32.const 65352
  i32.eq
  if
   global.get $core/graphics/colors/Colors.obj0White
   local.set $1
   block $break|0
    block $case3|0
     block $case2|0
      block $case1|0
       local.get $0
       i32.const 1
       i32.sub
       br_table $case1|0 $case2|0 $case3|0 $break|0
      end
      global.get $core/graphics/colors/Colors.obj0LightGrey
      local.set $1
      br $break|0
     end
     global.get $core/graphics/colors/Colors.obj0DarkGrey
     local.set $1
     br $break|0
    end
    global.get $core/graphics/colors/Colors.obj0Black
    local.set $1
   end
  else
   local.get $1
   i32.const 65353
   i32.eq
   if
    global.get $core/graphics/colors/Colors.obj1White
    local.set $1
    block $break|1
     block $case3|1
      block $case2|1
       block $case1|1
        local.get $0
        i32.const 1
        i32.sub
        br_table $case1|1 $case2|1 $case3|1 $break|1
       end
       global.get $core/graphics/colors/Colors.obj1LightGrey
       local.set $1
       br $break|1
      end
      global.get $core/graphics/colors/Colors.obj1DarkGrey
      local.set $1
      br $break|1
     end
     global.get $core/graphics/colors/Colors.obj1Black
     local.set $1
    end
   else
    global.get $core/graphics/colors/Colors.bgWhite
    local.set $1
    block $break|2
     block $case3|2
      block $case2|2
       block $case1|2
        local.get $0
        i32.const 1
        i32.sub
        br_table $case1|2 $case2|2 $case3|2 $break|2
       end
       global.get $core/graphics/colors/Colors.bgLightGrey
       local.set $1
       br $break|2
      end
      global.get $core/graphics/colors/Colors.bgDarkGrey
      local.set $1
      br $break|2
     end
     global.get $core/graphics/colors/Colors.bgBlack
     local.set $1
    end
   end
  end
  local.get $1
 )
 (func $core/graphics/tiles/drawPixelsFromLineOfTile (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (param $12 i32) (result i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  local.get $2
  i32.const 1
  i32.and
  i32.const 13
  i32.shl
  local.tee $15
  local.get $1
  local.tee $2
  i32.const 34816
  i32.eq
  if (result i32)
   local.get $0
   i32.const 128
   i32.sub
   local.get $0
   i32.const 128
   i32.add
   local.get $0
   i32.const 128
   i32.and
   select
  else
   local.get $0
  end
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  local.get $5
  i32.const 1
  i32.shl
  i32.add
  local.tee $0
  i32.const -30720
  i32.add
  i32.add
  i32.load8_u
  local.set $17
  local.get $15
  local.get $0
  i32.const -30719
  i32.add
  i32.add
  i32.load8_u
  local.set $18
  local.get $3
  local.set $0
  loop $for-loop|0
   local.get $0
   local.get $4
   i32.le_s
   if
    local.get $6
    local.get $0
    local.get $3
    i32.sub
    i32.add
    local.tee $15
    local.get $8
    i32.lt_s
    if
     local.get $18
     i32.const 1
     i32.const 7
     local.get $0
     i32.sub
     local.get $0
     i32.const 1
     local.get $11
     i32.const 32
     i32.and
     i32.eqz
     local.get $11
     i32.const 0
     i32.lt_s
     select
     select
     local.tee $2
     i32.shl
     i32.and
     if (result i32)
      i32.const 2
     else
      i32.const 0
     end
     local.tee $1
     i32.const 1
     i32.add
     local.get $1
     local.get $17
     i32.const 1
     local.get $2
     i32.shl
     i32.and
     select
     local.set $5
     global.get $core/cpu/cpu/Cpu.GBCEnabled
     if (result i32)
      i32.const 1
      local.get $12
      i32.const 0
      i32.ge_s
      local.get $11
      i32.const 0
      i32.ge_s
      select
     else
      i32.const 0
     end
     if (result i32)
      local.get $11
      i32.const 7
      i32.and
      local.set $1
      local.get $12
      i32.const 0
      i32.ge_s
      local.tee $2
      if (result i32)
       local.get $12
       i32.const 7
       i32.and
      else
       local.get $1
      end
      i32.const 3
      i32.shl
      local.get $5
      i32.const 1
      i32.shl
      i32.add
      local.tee $1
      i32.const 1
      i32.add
      i32.const 63
      i32.and
      local.tee $14
      i32.const -64
      i32.sub
      local.get $14
      local.get $2
      select
      i32.const 67584
      i32.add
      i32.load8_u
      i32.const 8
      i32.shl
      local.get $1
      i32.const 63
      i32.and
      local.tee $1
      i32.const -64
      i32.sub
      local.get $1
      local.get $2
      select
      i32.const 67584
      i32.add
      i32.load8_u
      i32.or
      local.tee $1
      i32.const 31
      i32.and
      i32.const 3
      i32.shl
      local.set $14
      local.get $1
      i32.const 992
      i32.and
      i32.const 5
      i32.shr_u
      i32.const 3
      i32.shl
      local.set $2
      local.get $1
      i32.const 31744
      i32.and
      i32.const 10
      i32.shr_u
      i32.const 3
      i32.shl
     else
      local.get $5
      i32.const 65351
      local.get $10
      local.get $10
      i32.const 0
      i32.le_s
      select
      local.tee $10
      call $core/graphics/palette/getColorizedGbHexColorFromPalette
      local.tee $1
      i32.const 16711680
      i32.and
      i32.const 16
      i32.shr_u
      local.set $14
      local.get $1
      i32.const 65280
      i32.and
      i32.const 8
      i32.shr_u
      local.set $2
      local.get $1
      i32.const 255
      i32.and
     end
     local.set $1
     local.get $9
     local.get $15
     local.get $7
     local.get $8
     i32.mul
     i32.add
     i32.const 3
     i32.mul
     i32.add
     local.tee $16
     local.get $14
     i32.store8
     local.get $16
     local.get $2
     i32.store8 offset=1
     local.get $16
     local.get $1
     i32.store8 offset=2
     local.get $15
     local.get $7
     i32.const 160
     i32.mul
     i32.add
     i32.const 67712
     i32.add
     local.get $5
     i32.const 3
     i32.and
     local.tee $1
     i32.const 4
     i32.or
     local.get $1
     local.get $11
     i32.const 128
     i32.and
     i32.const 0
     local.get $11
     i32.const 0
     i32.ge_s
     select
     select
     i32.store8
     local.get $13
     i32.const 1
     i32.add
     local.set $13
    end
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|0
   end
  end
  local.get $13
 )
 (func $core/graphics/backgroundWindow/drawColorPixelFromTileId (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  local.get $3
  i32.const 7
  i32.and
  local.set $3
  local.get $5
  local.get $5
  i32.const 34816
  i32.eq
  if (result i32)
   local.get $6
   i32.const 128
   i32.sub
   local.get $6
   i32.const 128
   i32.add
   local.get $6
   i32.const 128
   i32.and
   select
  else
   local.get $6
  end
  i32.const 4
  i32.shl
  i32.add
  local.get $4
  i32.const -22528
  i32.add
  i32.load8_u
  local.tee $4
  i32.const 64
  i32.and
  if (result i32)
   i32.const 7
   local.get $3
   i32.sub
  else
   local.get $3
  end
  i32.const 1
  i32.shl
  i32.add
  local.tee $3
  i32.const -30720
  i32.add
  local.get $4
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  local.tee $5
  i32.const 13
  i32.shl
  i32.add
  i32.load8_u
  local.set $6
  local.get $0
  local.get $1
  i32.const 160
  i32.mul
  i32.add
  i32.const 3
  i32.mul
  i32.const 91264
  i32.add
  local.get $4
  i32.const 7
  i32.and
  i32.const 3
  i32.shl
  local.get $3
  i32.const -30719
  i32.add
  local.get $5
  i32.const 1
  i32.and
  i32.const 13
  i32.shl
  i32.add
  i32.load8_u
  i32.const 1
  local.get $2
  i32.const 7
  i32.and
  local.tee $2
  i32.const 7
  local.get $2
  i32.sub
  local.get $4
  i32.const 32
  i32.and
  select
  local.tee $3
  i32.shl
  i32.and
  if (result i32)
   i32.const 2
  else
   i32.const 0
  end
  local.tee $2
  i32.const 1
  i32.add
  local.get $2
  local.get $6
  i32.const 1
  local.get $3
  i32.shl
  i32.and
  select
  local.tee $3
  i32.const 1
  i32.shl
  i32.add
  local.tee $2
  i32.const 1
  i32.add
  i32.const 63
  i32.and
  i32.const 67584
  i32.add
  i32.load8_u
  i32.const 8
  i32.shl
  local.get $2
  i32.const 63
  i32.and
  i32.const 67584
  i32.add
  i32.load8_u
  i32.or
  local.tee $2
  i32.const 31
  i32.and
  i32.const 3
  i32.shl
  i32.store8
  local.get $0
  local.get $1
  i32.const 160
  i32.mul
  i32.add
  local.tee $0
  i32.const 3
  i32.mul
  local.tee $1
  i32.const 91265
  i32.add
  local.get $2
  i32.const 992
  i32.and
  i32.const 5
  i32.shr_u
  i32.const 3
  i32.shl
  i32.store8
  local.get $1
  i32.const 91266
  i32.add
  local.get $2
  i32.const 31744
  i32.and
  i32.const 10
  i32.shr_u
  i32.const 3
  i32.shl
  i32.store8
  local.get $0
  i32.const 67712
  i32.add
  local.get $3
  i32.const 3
  i32.and
  local.tee $0
  i32.const 4
  i32.or
  local.get $0
  local.get $4
  i32.const 128
  i32.and
  select
  i32.store8
 )
 (func $core/graphics/backgroundWindow/drawMonochromePixelFromTileId (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  local.get $4
  local.get $4
  i32.const 34816
  i32.eq
  if (result i32)
   local.get $5
   i32.const 128
   i32.sub
   local.get $5
   i32.const 128
   i32.add
   local.get $5
   i32.const 128
   i32.and
   select
  else
   local.get $5
  end
  i32.const 4
  i32.shl
  i32.add
  local.get $3
  i32.const 7
  i32.and
  i32.const 1
  i32.shl
  i32.add
  local.tee $3
  i32.const -30720
  i32.add
  i32.load8_u
  local.set $4
  local.get $0
  local.get $1
  i32.const 160
  i32.mul
  i32.add
  local.tee $5
  i32.const 3
  i32.mul
  local.tee $1
  i32.const 91264
  i32.add
  local.get $3
  i32.const -30719
  i32.add
  i32.load8_u
  i32.const 1
  i32.const 7
  local.get $2
  i32.const 7
  i32.and
  i32.sub
  local.tee $2
  i32.shl
  i32.and
  if (result i32)
   i32.const 2
  else
   i32.const 0
  end
  local.tee $0
  i32.const 1
  i32.add
  local.get $0
  local.get $4
  i32.const 1
  local.get $2
  i32.shl
  i32.and
  select
  i32.const 255
  i32.and
  local.tee $2
  i32.const 65351
  call $core/graphics/palette/getColorizedGbHexColorFromPalette
  local.tee $0
  i32.const 16711680
  i32.and
  i32.const 16
  i32.shr_u
  i32.store8
  local.get $1
  i32.const 91265
  i32.add
  local.get $0
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_u
  i32.store8
  local.get $1
  i32.const 91266
  i32.add
  local.get $0
  i32.store8
  local.get $5
  i32.const 67712
  i32.add
  local.get $2
  i32.const 3
  i32.and
  i32.store8
 )
 (func $core/graphics/backgroundWindow/drawBackgroundWindowScanline (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  local.get $3
  i32.const 3
  i32.shr_s
  local.set $11
  loop $for-loop|0
   local.get $4
   i32.const 160
   i32.lt_s
   if
    local.get $2
    local.get $11
    i32.const 5
    i32.shl
    i32.add
    local.get $4
    local.get $5
    i32.add
    local.tee $6
    i32.const 256
    i32.ge_s
    if
     local.get $6
     i32.const 256
     i32.sub
     local.set $6
    end
    local.get $6
    i32.const 3
    i32.shr_s
    i32.add
    local.tee $10
    i32.const -30720
    i32.add
    i32.load8_u
    local.set $8
    i32.const 0
    local.set $7
    global.get $core/config/Config.tileCaching
    if
     local.get $4
     local.get $0
     local.get $6
     local.get $10
     local.get $8
     call $core/graphics/backgroundWindow/drawLineOfTileFromTileCache
     local.tee $9
     i32.const 0
     i32.gt_s
     if
      i32.const 1
      local.set $7
      local.get $4
      local.get $9
      i32.const 1
      i32.sub
      i32.add
      local.set $4
     end
    end
    local.get $7
    i32.eqz
    i32.const 0
    global.get $core/config/Config.tileRendering
    select
    if
     i32.const 0
     local.set $9
     local.get $3
     i32.const 7
     i32.and
     local.set $7
     i32.const 0
     local.get $6
     local.get $6
     i32.const 3
     i32.shr_s
     i32.const 3
     i32.shl
     i32.sub
     local.get $4
     select
     local.set $12
     i32.const -1
     local.set $6
     global.get $core/cpu/cpu/Cpu.GBCEnabled
     if
      local.get $10
      i32.const -22528
      i32.add
      i32.load8_u
      local.tee $6
      i32.const 8
      i32.and
      i32.const 0
      i32.ne
      local.set $9
      i32.const 7
      local.get $7
      i32.sub
      local.get $7
      local.get $6
      i32.const 64
      i32.and
      select
      local.set $7
     end
     local.get $4
     local.get $8
     local.get $1
     local.get $9
     local.get $12
     i32.const 160
     local.get $4
     i32.sub
     i32.const 7
     local.get $4
     i32.const 8
     i32.add
     i32.const 160
     i32.gt_s
     select
     local.get $7
     local.get $4
     local.get $0
     i32.const 160
     i32.const 91264
     i32.const 0
     local.get $6
     i32.const -1
     call $core/graphics/tiles/drawPixelsFromLineOfTile
     local.tee $6
     i32.const 1
     i32.sub
     i32.add
     local.get $4
     local.get $6
     i32.const 0
     i32.gt_s
     select
     local.set $4
    else
     local.get $7
     i32.eqz
     if
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      if
       local.get $4
       local.get $0
       local.get $6
       local.get $3
       local.get $10
       local.get $1
       local.get $8
       call $core/graphics/backgroundWindow/drawColorPixelFromTileId
      else
       local.get $4
       local.get $0
       local.get $6
       local.get $3
       local.get $1
       local.get $8
       call $core/graphics/backgroundWindow/drawMonochromePixelFromTileId
      end
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
 )
 (func $core/graphics/sprites/renderSprites (param $0 i32) (param $1 i32)
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
  i32.const 39
  local.set $7
  loop $for-loop|0
   local.get $7
   i32.const 0
   i32.ge_s
   if
    local.get $7
    i32.const 2
    i32.shl
    local.tee $5
    i32.const 65024
    i32.add
    local.tee $2
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.load8_u
    local.set $3
    local.get $2
    i32.const 1
    i32.add
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.load8_u
    local.get $2
    i32.const 2
    i32.add
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.load8_u
    local.set $4
    i32.const 8
    i32.sub
    local.set $10
    local.get $0
    local.get $3
    i32.const 16
    i32.sub
    local.tee $3
    local.get $1
    if (result i32)
     local.get $4
     local.get $4
     i32.const 1
     i32.and
     i32.sub
     local.set $4
     i32.const 16
    else
     i32.const 8
    end
    local.tee $2
    i32.add
    i32.lt_s
    i32.const 0
    local.get $0
    local.get $3
    i32.ge_s
    select
    if
     local.get $5
     i32.const 65027
     i32.add
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     i32.load8_u
     local.tee $6
     i32.const 128
     i32.and
     i32.const 0
     i32.ne
     local.set $11
     local.get $6
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     local.set $12
     local.get $6
     i32.const 8
     i32.and
     i32.const 0
     i32.ne
     global.get $core/cpu/cpu/Cpu.GBCEnabled
     local.tee $5
     local.get $5
     select
     i32.const 1
     i32.and
     i32.const 13
     i32.shl
     local.tee $5
     local.get $4
     i32.const 4
     i32.shl
     i32.const 32768
     i32.add
     local.get $2
     local.get $0
     local.get $3
     i32.sub
     local.tee $2
     i32.sub
     i32.const 1
     i32.sub
     local.get $2
     local.get $6
     i32.const 64
     i32.and
     select
     i32.const 1
     i32.shl
     i32.add
     local.tee $2
     i32.const -30720
     i32.add
     i32.add
     i32.load8_u
     local.set $13
     local.get $5
     local.get $2
     i32.const -30719
     i32.add
     i32.add
     i32.load8_u
     local.set $14
     i32.const 7
     local.set $4
     loop $for-loop|1
      local.get $4
      i32.const 0
      i32.ge_s
      if
       local.get $14
       i32.const 1
       i32.const 0
       local.get $4
       i32.const 7
       i32.sub
       i32.sub
       local.get $4
       local.get $12
       select
       local.tee $3
       i32.shl
       i32.and
       if (result i32)
        i32.const 2
       else
        i32.const 0
       end
       local.tee $2
       i32.const 1
       i32.add
       local.get $2
       local.get $13
       i32.const 1
       local.get $3
       i32.shl
       i32.and
       select
       local.tee $3
       if
        local.get $10
        i32.const 7
        local.get $4
        i32.sub
        i32.add
        local.tee $2
        i32.const 160
        i32.le_s
        i32.const 0
        local.get $2
        i32.const 0
        i32.ge_s
        select
        if
         i32.const 0
         local.set $5
         i32.const 0
         local.set $8
         global.get $core/graphics/lcd/Lcd.bgDisplayEnabled
         i32.eqz
         global.get $core/cpu/cpu/Cpu.GBCEnabled
         local.tee $9
         local.get $9
         select
         local.tee $9
         i32.eqz
         if
          local.get $2
          local.get $0
          i32.const 160
          i32.mul
          i32.add
          i32.const 67712
          i32.add
          i32.load8_u
          local.tee $15
          i32.const 3
          i32.and
          local.tee $16
          i32.const 0
          i32.gt_u
          i32.const 0
          local.get $11
          select
          if
           i32.const 1
           local.set $5
          else
           local.get $16
           i32.const 0
           i32.gt_u
           i32.const 0
           local.get $15
           i32.const 4
           i32.and
           i32.const 0
           global.get $core/cpu/cpu/Cpu.GBCEnabled
           select
           select
           i32.eqz
           i32.eqz
           local.set $8
          end
         end
         i32.const 1
         i32.const 0
         local.get $8
         i32.eqz
         local.get $5
         select
         local.get $9
         select
         if
          global.get $core/cpu/cpu/Cpu.GBCEnabled
          if
           local.get $2
           local.get $0
           i32.const 160
           i32.mul
           i32.add
           i32.const 3
           i32.mul
           local.tee $2
           i32.const 91264
           i32.add
           local.get $6
           i32.const 7
           i32.and
           i32.const 3
           i32.shl
           local.get $3
           i32.const 1
           i32.shl
           i32.add
           local.tee $3
           i32.const 1
           i32.add
           i32.const 63
           i32.and
           i32.const 67648
           i32.add
           i32.load8_u
           i32.const 8
           i32.shl
           local.get $3
           i32.const 63
           i32.and
           i32.const 67648
           i32.add
           i32.load8_u
           i32.or
           local.tee $3
           i32.const 31
           i32.and
           i32.const 3
           i32.shl
           i32.store8
           local.get $2
           i32.const 91265
           i32.add
           local.get $3
           i32.const 992
           i32.and
           i32.const 5
           i32.shr_u
           i32.const 3
           i32.shl
           i32.store8
           local.get $2
           i32.const 91266
           i32.add
           local.get $3
           i32.const 31744
           i32.and
           i32.const 10
           i32.shr_u
           i32.const 3
           i32.shl
           i32.store8
          else
           local.get $2
           local.get $0
           i32.const 160
           i32.mul
           i32.add
           i32.const 3
           i32.mul
           local.tee $2
           i32.const 91264
           i32.add
           local.get $3
           i32.const 65353
           i32.const 65352
           local.get $6
           i32.const 16
           i32.and
           select
           call $core/graphics/palette/getColorizedGbHexColorFromPalette
           local.tee $3
           i32.const 16711680
           i32.and
           i32.const 16
           i32.shr_u
           i32.store8
           local.get $2
           i32.const 91265
           i32.add
           local.get $3
           i32.const 65280
           i32.and
           i32.const 8
           i32.shr_u
           i32.store8
           local.get $2
           i32.const 91266
           i32.add
           local.get $3
           i32.store8
          end
         end
        end
       end
       local.get $4
       i32.const 1
       i32.sub
       local.set $4
       br $for-loop|1
      end
     end
    end
    local.get $7
    i32.const 1
    i32.sub
    local.set $7
    br $for-loop|0
   end
  end
 )
 (func $core/graphics/graphics/_drawScanline (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 32768
  i32.const 34816
  global.get $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  select
  local.set $1
  i32.const 1
  global.get $core/graphics/lcd/Lcd.bgDisplayEnabled
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  select
  if
   local.get $0
   local.get $1
   i32.const 39936
   i32.const 38912
   global.get $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
   select
   local.get $0
   global.get $core/graphics/graphics/Graphics.scrollY
   i32.add
   i32.const 255
   i32.and
   i32.const 0
   global.get $core/graphics/graphics/Graphics.scrollX
   call $core/graphics/backgroundWindow/drawBackgroundWindowScanline
  end
  global.get $core/graphics/lcd/Lcd.windowDisplayEnabled
  if
   local.get $0
   global.get $core/graphics/graphics/Graphics.windowY
   local.tee $2
   i32.ge_s
   if
    local.get $0
    local.get $1
    i32.const 39936
    i32.const 38912
    global.get $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
    select
    local.get $0
    local.get $2
    i32.sub
    global.get $core/graphics/graphics/Graphics.windowX
    i32.const 7
    i32.sub
    local.tee $1
    i32.const 0
    local.get $1
    i32.sub
    call $core/graphics/backgroundWindow/drawBackgroundWindowScanline
   end
  end
  global.get $core/graphics/lcd/Lcd.spriteDisplayEnable
  if
   local.get $0
   global.get $core/graphics/lcd/Lcd.tallSpriteSize
   call $core/graphics/sprites/renderSprites
  end
 )
 (func $core/interrupts/interrupts/_requestInterrupt (param $0 i32)
  i32.const 65295
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.const 1
  local.get $0
  i32.shl
  i32.or
  local.tee $0
  global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 65295
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  local.get $0
  i32.store8
 )
 (func $core/sound/channel1/Channel1.updateSweep
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/sound/channel1/Channel1.isSweepEnabled
  i32.eqz
  i32.const 1
  global.get $core/sound/channel1/Channel1.isEnabled
  select
  if
   return
  end
  global.get $core/sound/channel1/Channel1.sweepCounter
  i32.const 1
  i32.sub
  local.tee $0
  i32.const 0
  i32.le_s
  if
   global.get $core/sound/channel1/Channel1.NRx0SweepPeriod
   if
    global.get $core/sound/channel1/Channel1.NRx0SweepPeriod
    global.set $core/sound/channel1/Channel1.sweepCounter
    block $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow (result i32)
     global.get $core/sound/channel1/Channel1.sweepShadowFrequency
     local.tee $1
     global.get $core/sound/channel1/Channel1.NRx0SweepShift
     i32.shr_s
     local.set $0
     i32.const 1
     global.get $core/sound/channel1/Channel1.NRx0Negate
     if (result i32)
      i32.const 1
      global.set $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
      local.get $1
      local.get $0
      i32.sub
     else
      local.get $0
      local.get $1
      i32.add
     end
     local.tee $0
     i32.const 2047
     i32.gt_s
     br_if $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow
     drop
     i32.const 0
    end
    if
     i32.const 0
     global.set $core/sound/channel1/Channel1.isEnabled
    end
    global.get $core/sound/channel1/Channel1.NRx0SweepShift
    i32.const 0
    i32.gt_s
    if
     local.get $0
     global.set $core/sound/channel1/Channel1.sweepShadowFrequency
     local.get $0
     i32.const 8
     i32.shr_s
     i32.const 7
     i32.and
     local.tee $2
     i32.const 65300
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     i32.load8_u
     i32.const 248
     i32.and
     i32.or
     local.set $1
     i32.const 65299
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     local.get $0
     i32.const 255
     i32.and
     local.tee $0
     i32.store8
     i32.const 65300
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     local.get $1
     i32.store8
     local.get $0
     global.set $core/sound/channel1/Channel1.NRx3FrequencyLSB
     local.get $2
     global.set $core/sound/channel1/Channel1.NRx4FrequencyMSB
     global.get $core/sound/channel1/Channel1.NRx3FrequencyLSB
     global.get $core/sound/channel1/Channel1.NRx4FrequencyMSB
     i32.const 8
     i32.shl
     i32.or
     global.set $core/sound/channel1/Channel1.frequency
     block $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow1 (result i32)
      global.get $core/sound/channel1/Channel1.sweepShadowFrequency
      local.tee $1
      global.get $core/sound/channel1/Channel1.NRx0SweepShift
      i32.shr_s
      local.set $0
      i32.const 1
      global.get $core/sound/channel1/Channel1.NRx0Negate
      if (result i32)
       i32.const 1
       global.set $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
       local.get $1
       local.get $0
       i32.sub
      else
       local.get $0
       local.get $1
       i32.add
      end
      i32.const 2047
      i32.gt_s
      br_if $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow1
      drop
      i32.const 0
     end
     if
      i32.const 0
      global.set $core/sound/channel1/Channel1.isEnabled
     end
    end
   else
    i32.const 8
    global.set $core/sound/channel1/Channel1.sweepCounter
   end
  else
   local.get $0
   global.set $core/sound/channel1/Channel1.sweepCounter
  end
 )
 (func $core/sound/sound/updateFrameSequencer (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  global.get $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.add
  local.tee $0
  i32.const 8192
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  local.tee $2
  i32.ge_s
  if
   local.get $0
   local.get $2
   i32.sub
   global.set $core/sound/sound/Sound.frameSequenceCycleCounter
   block $break|0
    block $case4|0
     block $case3|0
      block $case2|0
       block $case1|0
        block $case0|0
         global.get $core/sound/sound/Sound.frameSequencer
         i32.const 1
         i32.add
         i32.const 7
         i32.and
         local.tee $2
         br_table $case0|0 $break|0 $case1|0 $break|0 $case2|0 $break|0 $case3|0 $case4|0 $break|0
        end
        global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
        i32.const 0
        global.get $core/sound/channel1/Channel1.lengthCounter
        local.tee $0
        i32.const 0
        i32.gt_s
        select
        if
         local.get $0
         i32.const 1
         i32.sub
         local.tee $0
         i32.eqz
         if
          i32.const 0
          global.set $core/sound/channel1/Channel1.isEnabled
         end
        end
        local.get $0
        global.set $core/sound/channel1/Channel1.lengthCounter
        global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
        i32.const 0
        global.get $core/sound/channel2/Channel2.lengthCounter
        local.tee $0
        i32.const 0
        i32.gt_s
        select
        if
         local.get $0
         i32.const 1
         i32.sub
         local.set $0
        end
        local.get $0
        i32.eqz
        if
         i32.const 0
         global.set $core/sound/channel2/Channel2.isEnabled
        end
        local.get $0
        global.set $core/sound/channel2/Channel2.lengthCounter
        global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
        i32.const 0
        global.get $core/sound/channel3/Channel3.lengthCounter
        local.tee $0
        i32.const 0
        i32.gt_s
        select
        if
         local.get $0
         i32.const 1
         i32.sub
         local.set $0
        end
        local.get $0
        i32.eqz
        if
         i32.const 0
         global.set $core/sound/channel3/Channel3.isEnabled
        end
        local.get $0
        global.set $core/sound/channel3/Channel3.lengthCounter
        global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
        i32.const 0
        global.get $core/sound/channel4/Channel4.lengthCounter
        local.tee $0
        i32.const 0
        i32.gt_s
        select
        if
         local.get $0
         i32.const 1
         i32.sub
         local.set $0
        end
        local.get $0
        i32.eqz
        if
         i32.const 0
         global.set $core/sound/channel4/Channel4.isEnabled
        end
        local.get $0
        global.set $core/sound/channel4/Channel4.lengthCounter
        br $break|0
       end
       global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
       i32.const 0
       global.get $core/sound/channel1/Channel1.lengthCounter
       local.tee $0
       i32.const 0
       i32.gt_s
       select
       if
        local.get $0
        i32.const 1
        i32.sub
        local.tee $0
        i32.eqz
        if
         i32.const 0
         global.set $core/sound/channel1/Channel1.isEnabled
        end
       end
       local.get $0
       global.set $core/sound/channel1/Channel1.lengthCounter
       global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
       i32.const 0
       global.get $core/sound/channel2/Channel2.lengthCounter
       local.tee $0
       i32.const 0
       i32.gt_s
       select
       if
        local.get $0
        i32.const 1
        i32.sub
        local.set $0
       end
       local.get $0
       i32.eqz
       if
        i32.const 0
        global.set $core/sound/channel2/Channel2.isEnabled
       end
       local.get $0
       global.set $core/sound/channel2/Channel2.lengthCounter
       global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
       i32.const 0
       global.get $core/sound/channel3/Channel3.lengthCounter
       local.tee $0
       i32.const 0
       i32.gt_s
       select
       if
        local.get $0
        i32.const 1
        i32.sub
        local.set $0
       end
       local.get $0
       i32.eqz
       if
        i32.const 0
        global.set $core/sound/channel3/Channel3.isEnabled
       end
       local.get $0
       global.set $core/sound/channel3/Channel3.lengthCounter
       global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
       i32.const 0
       global.get $core/sound/channel4/Channel4.lengthCounter
       local.tee $0
       i32.const 0
       i32.gt_s
       select
       if
        local.get $0
        i32.const 1
        i32.sub
        local.set $0
       end
       local.get $0
       i32.eqz
       if
        i32.const 0
        global.set $core/sound/channel4/Channel4.isEnabled
       end
       local.get $0
       global.set $core/sound/channel4/Channel4.lengthCounter
       call $core/sound/channel1/Channel1.updateSweep
       br $break|0
      end
      global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
      i32.const 0
      global.get $core/sound/channel1/Channel1.lengthCounter
      local.tee $0
      i32.const 0
      i32.gt_s
      select
      if
       local.get $0
       i32.const 1
       i32.sub
       local.tee $0
       i32.eqz
       if
        i32.const 0
        global.set $core/sound/channel1/Channel1.isEnabled
       end
      end
      local.get $0
      global.set $core/sound/channel1/Channel1.lengthCounter
      global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
      i32.const 0
      global.get $core/sound/channel2/Channel2.lengthCounter
      local.tee $0
      i32.const 0
      i32.gt_s
      select
      if
       local.get $0
       i32.const 1
       i32.sub
       local.set $0
      end
      local.get $0
      i32.eqz
      if
       i32.const 0
       global.set $core/sound/channel2/Channel2.isEnabled
      end
      local.get $0
      global.set $core/sound/channel2/Channel2.lengthCounter
      global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
      i32.const 0
      global.get $core/sound/channel3/Channel3.lengthCounter
      local.tee $0
      i32.const 0
      i32.gt_s
      select
      if
       local.get $0
       i32.const 1
       i32.sub
       local.set $0
      end
      local.get $0
      i32.eqz
      if
       i32.const 0
       global.set $core/sound/channel3/Channel3.isEnabled
      end
      local.get $0
      global.set $core/sound/channel3/Channel3.lengthCounter
      global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
      i32.const 0
      global.get $core/sound/channel4/Channel4.lengthCounter
      local.tee $0
      i32.const 0
      i32.gt_s
      select
      if
       local.get $0
       i32.const 1
       i32.sub
       local.set $0
      end
      local.get $0
      i32.eqz
      if
       i32.const 0
       global.set $core/sound/channel4/Channel4.isEnabled
      end
      local.get $0
      global.set $core/sound/channel4/Channel4.lengthCounter
      br $break|0
     end
     global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
     i32.const 0
     global.get $core/sound/channel1/Channel1.lengthCounter
     local.tee $0
     i32.const 0
     i32.gt_s
     select
     if
      local.get $0
      i32.const 1
      i32.sub
      local.tee $0
      i32.eqz
      if
       i32.const 0
       global.set $core/sound/channel1/Channel1.isEnabled
      end
     end
     local.get $0
     global.set $core/sound/channel1/Channel1.lengthCounter
     global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
     i32.const 0
     global.get $core/sound/channel2/Channel2.lengthCounter
     local.tee $0
     i32.const 0
     i32.gt_s
     select
     if
      local.get $0
      i32.const 1
      i32.sub
      local.set $0
     end
     local.get $0
     i32.eqz
     if
      i32.const 0
      global.set $core/sound/channel2/Channel2.isEnabled
     end
     local.get $0
     global.set $core/sound/channel2/Channel2.lengthCounter
     global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
     i32.const 0
     global.get $core/sound/channel3/Channel3.lengthCounter
     local.tee $0
     i32.const 0
     i32.gt_s
     select
     if
      local.get $0
      i32.const 1
      i32.sub
      local.set $0
     end
     local.get $0
     i32.eqz
     if
      i32.const 0
      global.set $core/sound/channel3/Channel3.isEnabled
     end
     local.get $0
     global.set $core/sound/channel3/Channel3.lengthCounter
     global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
     i32.const 0
     global.get $core/sound/channel4/Channel4.lengthCounter
     local.tee $0
     i32.const 0
     i32.gt_s
     select
     if
      local.get $0
      i32.const 1
      i32.sub
      local.set $0
     end
     local.get $0
     i32.eqz
     if
      i32.const 0
      global.set $core/sound/channel4/Channel4.isEnabled
     end
     local.get $0
     global.set $core/sound/channel4/Channel4.lengthCounter
     call $core/sound/channel1/Channel1.updateSweep
     br $break|0
    end
    global.get $core/sound/channel1/Channel1.envelopeCounter
    i32.const 1
    i32.sub
    local.tee $0
    i32.const 0
    i32.le_s
    if
     global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
     if
      global.get $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
      i32.const 0
      global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
      local.tee $0
      select
      if
       global.get $core/sound/channel1/Channel1.volume
       local.tee $1
       i32.const 1
       i32.add
       local.get $1
       i32.const 1
       i32.sub
       global.get $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
       select
       i32.const 15
       i32.and
       local.tee $1
       i32.const 15
       i32.lt_u
       if
        local.get $1
        global.set $core/sound/channel1/Channel1.volume
       else
        i32.const 0
        global.set $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
       end
      end
     else
      i32.const 8
      local.set $0
     end
    end
    local.get $0
    global.set $core/sound/channel1/Channel1.envelopeCounter
    global.get $core/sound/channel2/Channel2.envelopeCounter
    i32.const 1
    i32.sub
    local.tee $0
    i32.const 0
    i32.le_s
    if
     global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
     if
      global.get $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
      i32.const 0
      global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
      local.tee $0
      select
      if
       global.get $core/sound/channel2/Channel2.volume
       local.tee $1
       i32.const 1
       i32.add
       local.get $1
       i32.const 1
       i32.sub
       global.get $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
       select
       i32.const 15
       i32.and
       local.tee $1
       i32.const 15
       i32.lt_u
       if
        local.get $1
        global.set $core/sound/channel2/Channel2.volume
       else
        i32.const 0
        global.set $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
       end
      end
     else
      i32.const 8
      local.set $0
     end
    end
    local.get $0
    global.set $core/sound/channel2/Channel2.envelopeCounter
    global.get $core/sound/channel4/Channel4.envelopeCounter
    i32.const 1
    i32.sub
    local.tee $0
    i32.const 0
    i32.le_s
    if
     global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
     if
      global.get $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
      i32.const 0
      global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
      local.tee $0
      select
      if
       global.get $core/sound/channel4/Channel4.volume
       local.tee $1
       i32.const 1
       i32.add
       local.get $1
       i32.const 1
       i32.sub
       global.get $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
       select
       i32.const 15
       i32.and
       local.tee $1
       i32.const 15
       i32.lt_u
       if
        local.get $1
        global.set $core/sound/channel4/Channel4.volume
       else
        i32.const 0
        global.set $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
       end
      end
     else
      i32.const 8
      local.set $0
     end
    end
    local.get $0
    global.set $core/sound/channel4/Channel4.envelopeCounter
   end
   local.get $2
   global.set $core/sound/sound/Sound.frameSequencer
   i32.const 1
   return
  else
   local.get $0
   global.set $core/sound/sound/Sound.frameSequenceCycleCounter
  end
  i32.const 0
 )
 (func $core/sound/channel1/Channel1.getSample (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/sound/channel1/Channel1.frequencyTimer
  local.get $0
  i32.sub
  local.set $0
  loop $while-continue|0
   local.get $0
   i32.const 0
   i32.le_s
   if
    i32.const 2048
    global.get $core/sound/channel1/Channel1.frequency
    i32.sub
    i32.const 2
    i32.shl
    local.tee $1
    i32.const 2
    i32.shl
    local.get $1
    global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
    select
    global.set $core/sound/channel1/Channel1.frequencyTimer
    global.get $core/sound/channel1/Channel1.frequencyTimer
    local.get $0
    i32.const 31
    i32.shr_s
    local.tee $1
    local.get $0
    local.get $1
    i32.add
    i32.xor
    i32.sub
    local.set $0
    global.get $core/sound/channel1/Channel1.waveFormPositionOnDuty
    i32.const 1
    i32.add
    i32.const 7
    i32.and
    global.set $core/sound/channel1/Channel1.waveFormPositionOnDuty
    br $while-continue|0
   end
  end
  local.get $0
  global.set $core/sound/channel1/Channel1.frequencyTimer
  global.get $core/sound/channel1/Channel1.isDacEnabled
  i32.const 0
  global.get $core/sound/channel1/Channel1.isEnabled
  select
  if (result i32)
   global.get $core/sound/channel1/Channel1.volume
   i32.const 15
   i32.and
  else
   i32.const 15
   return
  end
  local.set $0
  block $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform (result i32)
   global.get $core/sound/channel1/Channel1.waveFormPositionOnDuty
   local.set $1
   block $case3|0
    block $case2|0
     block $case1|0
      block $case0|0
       global.get $core/sound/channel1/Channel1.NRx1Duty
       i32.const 1
       i32.sub
       br_table $case0|0 $case1|0 $case2|0 $case3|0
      end
      i32.const 1
      local.get $1
      i32.shl
      i32.const 129
      i32.and
      i32.const 0
      i32.ne
      br $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
     end
     i32.const 1
     local.get $1
     i32.shl
     i32.const 135
     i32.and
     i32.const 0
     i32.ne
     br $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
    end
    i32.const 1
    local.get $1
    i32.shl
    i32.const 126
    i32.and
    i32.const 0
    i32.ne
    br $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
   end
   i32.const 1
   local.get $1
   i32.shl
   i32.const 1
   i32.and
  end
  if (result i32)
   i32.const 1
  else
   i32.const -1
  end
  local.get $0
  i32.mul
  i32.const 15
  i32.add
 )
 (func $core/sound/channel2/Channel2.getSample (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/sound/channel2/Channel2.frequencyTimer
  local.get $0
  i32.sub
  local.set $0
  loop $while-continue|0
   local.get $0
   i32.const 0
   i32.le_s
   if
    i32.const 2048
    global.get $core/sound/channel2/Channel2.frequency
    i32.sub
    i32.const 2
    i32.shl
    global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
    i32.shl
    global.set $core/sound/channel2/Channel2.frequencyTimer
    global.get $core/sound/channel2/Channel2.frequencyTimer
    local.get $0
    i32.const 31
    i32.shr_s
    local.tee $1
    local.get $0
    local.get $1
    i32.add
    i32.xor
    i32.sub
    local.set $0
    global.get $core/sound/channel2/Channel2.waveFormPositionOnDuty
    i32.const 1
    i32.add
    i32.const 7
    i32.and
    global.set $core/sound/channel2/Channel2.waveFormPositionOnDuty
    br $while-continue|0
   end
  end
  local.get $0
  global.set $core/sound/channel2/Channel2.frequencyTimer
  global.get $core/sound/channel2/Channel2.isDacEnabled
  i32.const 0
  global.get $core/sound/channel2/Channel2.isEnabled
  select
  if (result i32)
   global.get $core/sound/channel2/Channel2.volume
   i32.const 15
   i32.and
  else
   i32.const 15
   return
  end
  local.set $0
  block $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform (result i32)
   global.get $core/sound/channel2/Channel2.waveFormPositionOnDuty
   local.set $1
   block $case3|0
    block $case2|0
     block $case1|0
      block $case0|0
       global.get $core/sound/channel2/Channel2.NRx1Duty
       i32.const 1
       i32.sub
       br_table $case0|0 $case1|0 $case2|0 $case3|0
      end
      i32.const 1
      local.get $1
      i32.shl
      i32.const 129
      i32.and
      i32.const 0
      i32.ne
      br $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
     end
     i32.const 1
     local.get $1
     i32.shl
     i32.const 135
     i32.and
     i32.const 0
     i32.ne
     br $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
    end
    i32.const 1
    local.get $1
    i32.shl
    i32.const 126
    i32.and
    i32.const 0
    i32.ne
    br $__inlined_func$core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform
   end
   i32.const 1
   local.get $1
   i32.shl
   i32.const 1
   i32.and
  end
  if (result i32)
   i32.const 1
  else
   i32.const -1
  end
  local.get $0
  i32.mul
  i32.const 15
  i32.add
 )
 (func $core/sound/channel3/Channel3.getSample (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/sound/channel3/Channel3.isDacEnabled
  i32.eqz
  i32.const 1
  global.get $core/sound/channel3/Channel3.isEnabled
  select
  if
   i32.const 15
   return
  end
  global.get $core/sound/channel3/Channel3.volumeCode
  local.set $3
  global.get $core/sound/channel3/Channel3.volumeCodeChanged
  if
   i32.const 65308
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   i32.const 5
   i32.shr_u
   local.tee $3
   global.set $core/sound/channel3/Channel3.volumeCode
   i32.const 0
   global.set $core/sound/channel3/Channel3.volumeCodeChanged
  end
  global.get $core/sound/channel3/Channel3.sampleBuffer
  global.get $core/sound/channel3/Channel3.waveTablePosition
  i32.const 1
  i32.and
  i32.eqz
  i32.const 2
  i32.shl
  i32.shr_s
  i32.const 15
  i32.and
  local.set $2
  block $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      block $case0|0
       local.get $3
       br_table $case0|0 $case1|0 $case2|0 $case3|0
      end
      local.get $2
      i32.const 4
      i32.shr_s
      local.set $2
      br $break|0
     end
     i32.const 1
     local.set $1
     br $break|0
    end
    local.get $2
    i32.const 1
    i32.shr_s
    local.set $2
    i32.const 2
    local.set $1
    br $break|0
   end
   local.get $2
   i32.const 2
   i32.shr_s
   local.set $2
   i32.const 4
   local.set $1
  end
  local.get $1
  i32.const 0
  i32.gt_u
  if (result i32)
   local.get $2
   local.get $1
   i32.div_s
  else
   i32.const 0
  end
  i32.const 15
  i32.add
  global.get $core/sound/channel3/Channel3.frequencyTimer
  local.get $0
  i32.sub
  local.set $0
  loop $while-continue|1
   local.get $0
   i32.const 0
   i32.le_s
   if
    i32.const 2048
    global.get $core/sound/channel3/Channel3.frequency
    i32.sub
    i32.const 1
    i32.shl
    global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
    i32.shl
    global.set $core/sound/channel3/Channel3.frequencyTimer
    global.get $core/sound/channel3/Channel3.frequencyTimer
    local.get $0
    i32.const 31
    i32.shr_s
    local.tee $1
    local.get $0
    local.get $1
    i32.add
    i32.xor
    i32.sub
    local.set $0
    global.get $core/sound/channel3/Channel3.waveTablePosition
    i32.const 1
    i32.add
    local.set $1
    loop $while-continue|0
     local.get $1
     i32.const 32
     i32.ge_s
     if
      local.get $1
      i32.const 32
      i32.sub
      local.set $1
      br $while-continue|0
     end
    end
    local.get $1
    global.set $core/sound/channel3/Channel3.waveTablePosition
    global.get $core/sound/channel3/Channel3.waveTablePosition
    i32.const 1
    i32.shr_s
    i32.const 65328
    i32.add
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.load8_u
    global.set $core/sound/channel3/Channel3.sampleBuffer
    br $while-continue|1
   end
  end
  local.get $0
  global.set $core/sound/channel3/Channel3.frequencyTimer
 )
 (func $core/sound/channel4/Channel4.getSample (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/sound/channel4/Channel4.frequencyTimer
  local.get $0
  i32.sub
  local.tee $0
  i32.const 0
  i32.le_s
  if
   global.get $core/sound/channel4/Channel4.divisor
   global.get $core/sound/channel4/Channel4.NRx3ClockShift
   i32.shl
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   local.get $0
   i32.const 31
   i32.shr_s
   local.tee $1
   local.get $0
   local.get $1
   i32.add
   i32.xor
   i32.sub
   local.set $0
   global.get $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   local.tee $1
   i32.const 1
   i32.shr_s
   local.tee $2
   local.get $1
   i32.const 1
   i32.and
   local.get $2
   i32.const 1
   i32.and
   i32.xor
   local.tee $1
   i32.const 14
   i32.shl
   i32.or
   local.tee $2
   i32.const -65
   i32.and
   local.get $1
   i32.const 6
   i32.shl
   i32.or
   local.get $2
   global.get $core/sound/channel4/Channel4.NRx3WidthMode
   select
   global.set $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  end
  i32.const 0
  local.get $0
  local.get $0
  i32.const 0
  i32.lt_s
  select
  global.set $core/sound/channel4/Channel4.frequencyTimer
  global.get $core/sound/channel4/Channel4.isDacEnabled
  i32.const 0
  global.get $core/sound/channel4/Channel4.isEnabled
  select
  if (result i32)
   global.get $core/sound/channel4/Channel4.volume
   i32.const 15
   i32.and
  else
   i32.const 15
   return
  end
  i32.const -1
  i32.const 1
  global.get $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  i32.const 1
  i32.and
  select
  i32.mul
  i32.const 15
  i32.add
 )
 (func $core/sound/sound/mixChannelSamples (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
  local.get $0
  i32.const 15
  global.get $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
  select
  local.get $1
  i32.const 15
  global.get $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  select
  i32.add
  local.get $2
  i32.const 15
  global.get $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  select
  i32.add
  local.get $3
  i32.const 15
  global.get $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  select
  i32.add
  local.set $4
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.needToRemixSamples
  block $__inlined_func$core/sound/sound/getSampleAsUnsignedByte (result i32)
   i32.const 127
   local.get $0
   i32.const 15
   global.get $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
   select
   local.get $1
   i32.const 15
   global.get $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
   select
   i32.add
   local.get $2
   i32.const 15
   global.get $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
   select
   i32.add
   local.get $3
   i32.const 15
   global.get $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
   select
   i32.add
   local.tee $0
   i32.const 60
   i32.eq
   br_if $__inlined_func$core/sound/sound/getSampleAsUnsignedByte
   drop
   global.get $core/sound/sound/Sound.NR50LeftMixerVolume
   i32.const 1
   i32.add
   local.get $0
   i32.const 60
   i32.sub
   i32.const 100000
   i32.mul
   i32.mul
   i32.const 3
   i32.shr_s
   i32.const 100000
   i32.div_s
   i32.const 60
   i32.add
   i32.const 100000
   i32.mul
   i32.const 47244
   i32.div_s
  end
  local.set $2
  block $__inlined_func$core/sound/sound/getSampleAsUnsignedByte0 (result i32)
   global.get $core/sound/sound/Sound.NR50RightMixerVolume
   i32.const 1
   i32.add
   i32.const 127
   local.get $4
   i32.const 60
   i32.eq
   br_if $__inlined_func$core/sound/sound/getSampleAsUnsignedByte0
   drop
   local.get $4
   i32.const 60
   i32.sub
   i32.const 100000
   i32.mul
   i32.mul
   i32.const 3
   i32.shr_s
   i32.const 100000
   i32.div_s
   i32.const 60
   i32.add
   i32.const 100000
   i32.mul
   i32.const 47244
   i32.div_s
  end
  local.set $0
  local.get $2
  global.set $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
  local.get $0
  global.set $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
  local.get $0
  i32.const 255
  i32.and
  local.get $2
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/sound/accumulator/accumulateSound (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $0
  global.get $core/sound/channel1/Channel1.cycleCounter
  i32.add
  local.tee $1
  global.set $core/sound/channel1/Channel1.cycleCounter
  global.get $core/sound/channel1/Channel1.frequencyTimer
  local.get $1
  i32.sub
  i32.const 0
  i32.le_s
  local.tee $1
  i32.eqz
  if
   global.get $core/sound/channel1/Channel1.isDacEnabled
   local.tee $2
   global.get $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
   i32.ne
   local.set $1
   local.get $2
   global.set $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
  end
  local.get $0
  global.get $core/sound/channel2/Channel2.cycleCounter
  i32.add
  local.tee $2
  global.set $core/sound/channel2/Channel2.cycleCounter
  global.get $core/sound/channel2/Channel2.frequencyTimer
  local.get $2
  i32.sub
  i32.const 0
  i32.le_s
  local.tee $2
  i32.eqz
  if
   global.get $core/sound/channel2/Channel2.isDacEnabled
   local.tee $4
   global.get $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
   i32.ne
   local.set $2
   local.get $4
   global.set $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
  end
  local.get $0
  global.get $core/sound/channel3/Channel3.cycleCounter
  i32.add
  global.set $core/sound/channel3/Channel3.cycleCounter
  i32.const 0
  global.get $core/sound/channel3/Channel3.frequencyTimer
  global.get $core/sound/channel3/Channel3.cycleCounter
  i32.sub
  i32.const 0
  i32.gt_s
  global.get $core/sound/channel3/Channel3.volumeCodeChanged
  select
  i32.eqz
  local.tee $4
  i32.eqz
  if
   global.get $core/sound/channel3/Channel3.isDacEnabled
   local.tee $5
   global.get $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
   i32.ne
   local.set $4
   local.get $5
   global.set $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
  end
  local.get $0
  global.get $core/sound/channel4/Channel4.cycleCounter
  i32.add
  global.set $core/sound/channel4/Channel4.cycleCounter
  global.get $core/sound/channel4/Channel4.frequencyTimer
  global.get $core/sound/channel4/Channel4.cycleCounter
  i32.sub
  i32.const 0
  i32.le_s
  local.tee $5
  i32.eqz
  if
   global.get $core/sound/channel4/Channel4.isDacEnabled
   local.tee $3
   global.get $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
   i32.ne
   local.set $5
   local.get $3
   global.set $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
  end
  local.get $1
  if
   global.get $core/sound/channel1/Channel1.cycleCounter
   i32.const 0
   global.set $core/sound/channel1/Channel1.cycleCounter
   call $core/sound/channel1/Channel1.getSample
   global.set $core/sound/accumulator/SoundAccumulator.channel1Sample
  end
  local.get $2
  if
   global.get $core/sound/channel2/Channel2.cycleCounter
   i32.const 0
   global.set $core/sound/channel2/Channel2.cycleCounter
   call $core/sound/channel2/Channel2.getSample
   global.set $core/sound/accumulator/SoundAccumulator.channel2Sample
  end
  local.get $4
  if
   global.get $core/sound/channel3/Channel3.cycleCounter
   i32.const 0
   global.set $core/sound/channel3/Channel3.cycleCounter
   call $core/sound/channel3/Channel3.getSample
   global.set $core/sound/accumulator/SoundAccumulator.channel3Sample
  end
  local.get $5
  if
   global.get $core/sound/channel4/Channel4.cycleCounter
   i32.const 0
   global.set $core/sound/channel4/Channel4.cycleCounter
   call $core/sound/channel4/Channel4.getSample
   global.set $core/sound/accumulator/SoundAccumulator.channel4Sample
  end
  i32.const 1
  local.get $5
  i32.const 1
  local.get $4
  i32.const 1
  local.get $2
  local.get $1
  select
  select
  select
  if
   i32.const 1
   global.set $core/sound/accumulator/SoundAccumulator.needToRemixSamples
  end
  local.get $0
  global.get $core/sound/sound/Sound.downSampleCycleCounter
  i32.add
  local.tee $0
  i32.const 4194304
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  i32.const 44100
  i32.div_s
  local.tee $1
  i32.ge_s
  if
   local.get $0
   local.get $1
   i32.sub
   local.set $0
   i32.const 1
   global.get $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
   i32.const 1
   global.get $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
   global.get $core/sound/accumulator/SoundAccumulator.needToRemixSamples
   select
   select
   if
    global.get $core/sound/accumulator/SoundAccumulator.channel1Sample
    global.get $core/sound/accumulator/SoundAccumulator.channel2Sample
    global.get $core/sound/accumulator/SoundAccumulator.channel3Sample
    global.get $core/sound/accumulator/SoundAccumulator.channel4Sample
    call $core/sound/sound/mixChannelSamples
    drop
   else
    local.get $0
    global.set $core/sound/sound/Sound.downSampleCycleCounter
   end
   global.get $core/sound/sound/Sound.audioQueueIndex
   local.tee $1
   i32.const 1
   i32.shl
   i32.const 1068160
   i32.add
   local.tee $2
   global.get $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
   i32.const 2
   i32.add
   i32.store8
   local.get $2
   global.get $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
   i32.const 2
   i32.add
   i32.store8 offset=1
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.const 65535
   i32.ge_s
   if (result i32)
    local.get $1
    i32.const 1
    i32.sub
   else
    local.get $1
   end
   global.set $core/sound/sound/Sound.audioQueueIndex
  end
  local.get $0
  global.set $core/sound/sound/Sound.downSampleCycleCounter
 )
 (func $core/sound/sound/calculateSound (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $0
  call $core/sound/channel1/Channel1.getSample
  local.set $1
  local.get $0
  call $core/sound/channel2/Channel2.getSample
  local.set $2
  local.get $0
  call $core/sound/channel3/Channel3.getSample
  local.set $4
  local.get $0
  call $core/sound/channel4/Channel4.getSample
  local.set $5
  local.get $1
  global.set $core/sound/accumulator/SoundAccumulator.channel1Sample
  local.get $2
  global.set $core/sound/accumulator/SoundAccumulator.channel2Sample
  local.get $4
  global.set $core/sound/accumulator/SoundAccumulator.channel3Sample
  local.get $5
  global.set $core/sound/accumulator/SoundAccumulator.channel4Sample
  local.get $0
  global.get $core/sound/sound/Sound.downSampleCycleCounter
  i32.add
  local.tee $0
  i32.const 4194304
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  i32.const 44100
  i32.div_s
  i32.ge_s
  if
   local.get $0
   i32.const 4194304
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   i32.const 44100
   i32.div_s
   i32.sub
   local.set $0
   local.get $1
   local.get $2
   local.get $4
   local.get $5
   call $core/sound/sound/mixChannelSamples
   local.set $3
   global.get $core/sound/sound/Sound.audioQueueIndex
   i32.const 1
   i32.shl
   i32.const 1068160
   i32.add
   local.tee $6
   local.get $3
   i32.const 65280
   i32.and
   i32.const 8
   i32.shr_u
   i32.const 2
   i32.add
   i32.store8
   local.get $6
   local.get $3
   i32.const 255
   i32.and
   i32.const 2
   i32.add
   i32.store8 offset=1
   global.get $core/config/Config.enableAudioDebugging
   if
    local.get $1
    i32.const 15
    i32.const 15
    i32.const 15
    call $core/sound/sound/mixChannelSamples
    local.set $1
    global.get $core/sound/sound/Sound.audioQueueIndex
    i32.const 1
    i32.shl
    i32.const 543872
    i32.add
    local.tee $3
    local.get $1
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_u
    i32.const 2
    i32.add
    i32.store8
    local.get $3
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8 offset=1
    i32.const 15
    local.get $2
    i32.const 15
    i32.const 15
    call $core/sound/sound/mixChannelSamples
    local.set $1
    global.get $core/sound/sound/Sound.audioQueueIndex
    i32.const 1
    i32.shl
    i32.const 674944
    i32.add
    local.tee $2
    local.get $1
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_u
    i32.const 2
    i32.add
    i32.store8
    local.get $2
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8 offset=1
    i32.const 15
    i32.const 15
    local.get $4
    i32.const 15
    call $core/sound/sound/mixChannelSamples
    local.set $1
    global.get $core/sound/sound/Sound.audioQueueIndex
    i32.const 1
    i32.shl
    i32.const 806016
    i32.add
    local.tee $2
    local.get $1
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_u
    i32.const 2
    i32.add
    i32.store8
    local.get $2
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8 offset=1
    i32.const 15
    i32.const 15
    i32.const 15
    local.get $5
    call $core/sound/sound/mixChannelSamples
    local.set $1
    global.get $core/sound/sound/Sound.audioQueueIndex
    i32.const 1
    i32.shl
    i32.const 937088
    i32.add
    local.tee $2
    local.get $1
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_u
    i32.const 2
    i32.add
    i32.store8
    local.get $2
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8 offset=1
   end
   global.get $core/sound/sound/Sound.audioQueueIndex
   i32.const 1
   i32.add
   local.tee $1
   i32.const 65535
   i32.ge_s
   if (result i32)
    local.get $1
    i32.const 1
    i32.sub
   else
    local.get $1
   end
   global.set $core/sound/sound/Sound.audioQueueIndex
  end
  local.get $0
  global.set $core/sound/sound/Sound.downSampleCycleCounter
 )
 (func $core/sound/sound/batchProcessAudio
  (local $0 i32)
  (local $1 i32)
  i32.const 87
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  local.set $0
  global.get $core/sound/sound/Sound.currentCycles
  local.set $1
  loop $while-continue|0
   local.get $1
   local.get $0
   i32.ge_s
   if
    local.get $0
    call $core/sound/sound/updateFrameSequencer
    i32.eqz
    i32.const 0
    global.get $core/config/Config.audioAccumulateSamples
    select
    if
     local.get $0
     call $core/sound/accumulator/accumulateSound
    else
     local.get $0
     call $core/sound/sound/calculateSound
    end
    local.get $1
    local.get $0
    i32.sub
    local.set $1
    br $while-continue|0
   end
  end
  local.get $1
  global.set $core/sound/sound/Sound.currentCycles
 )
 (func $core/sound/registers/SoundRegisterReadTraps (param $0 i32) (result i32)
  block $break|0
   block $case22|0
    block $case21|0
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
                         block $case0|0
                          local.get $0
                          i32.const 65296
                          i32.sub
                          br_table $case0|0 $case5|0 $case10|0 $case15|0 $case19|0 $case1|0 $case6|0 $case11|0 $case16|0 $case20|0 $case2|0 $case7|0 $case12|0 $case17|0 $case21|0 $case3|0 $case8|0 $case13|0 $case18|0 $case22|0 $case4|0 $case9|0 $case14|0 $break|0
                         end
                         i32.const 65296
                         call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                         i32.load8_u
                         i32.const 128
                         i32.or
                         return
                        end
                        i32.const 65301
                        call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                        i32.load8_u
                        i32.const 255
                        i32.or
                        return
                       end
                       i32.const 65306
                       call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                       i32.load8_u
                       i32.const 127
                       i32.or
                       return
                      end
                      i32.const 65311
                      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                      i32.load8_u
                      i32.const 255
                      i32.or
                      return
                     end
                     i32.const 65316
                     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                     i32.load8_u
                     return
                    end
                    i32.const 65297
                    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                    i32.load8_u
                    i32.const 63
                    i32.or
                    return
                   end
                   i32.const 65302
                   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                   i32.load8_u
                   i32.const 63
                   i32.or
                   return
                  end
                  i32.const 65307
                  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                  i32.load8_u
                  i32.const 255
                  i32.or
                  return
                 end
                 i32.const 65312
                 call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                 i32.load8_u
                 i32.const 255
                 i32.or
                 return
                end
                i32.const 65317
                call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                i32.load8_u
                return
               end
               i32.const 65298
               call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
               i32.load8_u
               return
              end
              i32.const 65303
              call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
              i32.load8_u
              return
             end
             i32.const 65308
             call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
             i32.load8_u
             i32.const 159
             i32.or
             return
            end
            i32.const 65313
            call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
            i32.load8_u
            return
           end
           i32.const 128
           i32.const 0
           global.get $core/sound/sound/Sound.NR52IsSoundEnabled
           select
           local.tee $0
           i32.const 1
           i32.or
           local.get $0
           i32.const -2
           i32.and
           global.get $core/sound/channel1/Channel1.isEnabled
           select
           local.tee $0
           i32.const 2
           i32.or
           local.get $0
           i32.const -3
           i32.and
           global.get $core/sound/channel2/Channel2.isEnabled
           select
           local.tee $0
           i32.const 4
           i32.or
           local.get $0
           i32.const -5
           i32.and
           global.get $core/sound/channel3/Channel3.isEnabled
           select
           local.tee $0
           i32.const 8
           i32.or
           local.get $0
           i32.const -9
           i32.and
           global.get $core/sound/channel4/Channel4.isEnabled
           select
           i32.const 112
           i32.or
           return
          end
          i32.const 65299
          call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
          i32.load8_u
          i32.const 255
          i32.or
          return
         end
         i32.const 65304
         call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
         i32.load8_u
         i32.const 255
         i32.or
         return
        end
        i32.const 65309
        call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
        i32.load8_u
        i32.const 255
        i32.or
        return
       end
       i32.const 65314
       call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
       i32.load8_u
       return
      end
      i32.const 65300
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      i32.const 191
      i32.or
      return
     end
     i32.const 65305
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     i32.load8_u
     i32.const 191
     i32.or
     return
    end
    i32.const 65310
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.load8_u
    i32.const 191
    i32.or
    return
   end
   i32.const 65315
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   i32.const 191
   i32.or
   return
  end
  i32.const -1
 )
 (func $core/joypad/joypad/getJoypadState (result i32)
  (local $0 i32)
  global.get $core/joypad/joypad/Joypad.joypadRegisterFlipped
  local.set $0
  global.get $core/joypad/joypad/Joypad.isDpadType
  if (result i32)
   local.get $0
   i32.const -5
   i32.and
   local.get $0
   i32.const 4
   i32.or
   global.get $core/joypad/joypad/Joypad.up
   select
   local.tee $0
   i32.const -2
   i32.and
   local.get $0
   i32.const 1
   i32.or
   global.get $core/joypad/joypad/Joypad.right
   select
   local.tee $0
   i32.const -9
   i32.and
   local.get $0
   i32.const 8
   i32.or
   global.get $core/joypad/joypad/Joypad.down
   select
   local.tee $0
   i32.const -3
   i32.and
   local.get $0
   i32.const 2
   i32.or
   global.get $core/joypad/joypad/Joypad.left
   select
  else
   global.get $core/joypad/joypad/Joypad.isButtonType
   if (result i32)
    local.get $0
    i32.const -2
    i32.and
    local.get $0
    i32.const 1
    i32.or
    global.get $core/joypad/joypad/Joypad.a
    select
    local.tee $0
    i32.const -3
    i32.and
    local.get $0
    i32.const 2
    i32.or
    global.get $core/joypad/joypad/Joypad.b
    select
    local.tee $0
    i32.const -5
    i32.and
    local.get $0
    i32.const 4
    i32.or
    global.get $core/joypad/joypad/Joypad.select
    select
    local.tee $0
    i32.const -9
    i32.and
    local.get $0
    i32.const 8
    i32.or
    global.get $core/joypad/joypad/Joypad.start
    select
   else
    local.get $0
   end
  end
  i32.const 240
  i32.or
 )
 (func $core/memory/readTraps/checkReadTraps (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  i32.const 32768
  i32.lt_s
  if
   i32.const -1
   return
  end
  local.get $0
  i32.const 40960
  i32.lt_s
  i32.const 0
  local.get $0
  i32.const 32768
  i32.ge_s
  select
  if
   i32.const -1
   return
  end
  local.get $0
  i32.const 65024
  i32.lt_s
  i32.const 0
  local.get $0
  i32.const 57344
  i32.ge_s
  select
  if
   local.get $0
   i32.const -8192
   i32.add
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   return
  end
  local.get $0
  i32.const 65183
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 65024
  i32.ge_s
  select
  if
   i32.const 255
   i32.const -1
   global.get $core/graphics/lcd/Lcd.currentLcdMode
   i32.const 2
   i32.lt_s
   select
   return
  end
  local.get $0
  i32.const 65357
  i32.eq
  if
   i32.const 65357
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   i32.const 1
   i32.and
   if (result i32)
    i32.const 255
   else
    i32.const 254
   end
   local.tee $0
   local.get $0
   i32.const -129
   i32.and
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   select
   return
  end
  local.get $0
  i32.const 65348
  i32.eq
  if
   global.get $core/graphics/graphics/Graphics.scanlineRegister
   local.set $1
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $1
   i32.store8
   global.get $core/graphics/graphics/Graphics.scanlineRegister
   return
  end
  local.get $0
  i32.const 65318
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 65296
  i32.ge_s
  select
  if
   call $core/sound/sound/batchProcessAudio
   local.get $0
   call $core/sound/registers/SoundRegisterReadTraps
   return
  end
  local.get $0
  i32.const 65327
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 65319
  i32.ge_s
  select
  if
   i32.const 255
   return
  end
  local.get $0
  i32.const 65343
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 65328
  i32.ge_s
  select
  if
   call $core/sound/sound/batchProcessAudio
   global.get $core/sound/channel3/Channel3.isEnabled
   if
    global.get $core/sound/channel3/Channel3.waveTablePosition
    i32.const 1
    i32.shr_s
    i32.const 65328
    i32.add
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.load8_u
    return
   end
   i32.const -1
   return
  end
  local.get $0
  i32.const 65284
  i32.eq
  if
   global.get $core/timers/timers/Timers.dividerRegister
   i32.const 65280
   i32.and
   i32.const 8
   i32.shr_u
   local.set $1
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $1
   i32.store8
   local.get $1
   return
  end
  local.get $0
  i32.const 65285
  i32.eq
  if
   global.get $core/timers/timers/Timers.timerCounter
   local.set $1
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $1
   i32.store8
   global.get $core/timers/timers/Timers.timerCounter
   return
  end
  local.get $0
  i32.const 65295
  i32.eq
  if
   global.get $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
   i32.const 224
   i32.or
   return
  end
  local.get $0
  i32.const 65280
  i32.eq
  if
   call $core/joypad/joypad/getJoypadState
   return
  end
  i32.const -1
 )
 (func $core/memory/load/eightBitLoadFromGBMemoryWithTraps (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  global.get $core/debug/breakpoints/Breakpoints.readGbMemory
  i32.eq
  if
   i32.const 1
   global.set $core/debug/breakpoints/Breakpoints.reachedBreakpoint
  end
  local.get $0
  call $core/memory/readTraps/checkReadTraps
  local.tee $1
  i32.const -1
  i32.eq
  if (result i32)
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
  else
   local.get $1
   i32.const 255
   i32.and
  end
 )
 (func $core/memory/banking/handleBanking (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/memory/memory/Memory.isRomOnly
  if
   return
  end
  global.get $core/memory/memory/Memory.isMBC1
  local.set $3
  global.get $core/memory/memory/Memory.isMBC2
  local.set $2
  local.get $0
  i32.const 8191
  i32.le_s
  if
   local.get $1
   i32.const 16
   i32.and
   i32.eqz
   i32.const 0
   local.get $2
   select
   i32.eqz
   if
    local.get $1
    i32.const 15
    i32.and
    local.tee $0
    if
     local.get $0
     i32.const 10
     i32.eq
     if
      i32.const 1
      global.set $core/memory/memory/Memory.isRamBankingEnabled
     end
    else
     i32.const 0
     global.set $core/memory/memory/Memory.isRamBankingEnabled
    end
   end
  else
   local.get $0
   i32.const 16383
   i32.le_s
   if
    local.get $0
    i32.const 12287
    i32.le_s
    i32.const 1
    global.get $core/memory/memory/Memory.isMBC5
    local.tee $0
    select
    if
     local.get $1
     i32.const 15
     i32.and
     global.get $core/memory/memory/Memory.currentRomBank
     local.get $2
     select
     local.set $2
     local.get $3
     if (result i32)
      local.get $1
      i32.const 31
      i32.and
      local.set $1
      local.get $2
      i32.const 224
      i32.and
     else
      global.get $core/memory/memory/Memory.isMBC3
      if (result i32)
       local.get $1
       i32.const 127
       i32.and
       local.set $1
       local.get $2
       i32.const 128
       i32.and
      else
       i32.const 0
       local.get $2
       local.get $0
       select
      end
     end
     local.get $1
     i32.or
     global.set $core/memory/memory/Memory.currentRomBank
    else
     global.get $core/memory/memory/Memory.currentRomBank
     i32.const 255
     i32.and
     local.get $1
     i32.const 0
     i32.gt_s
     i32.const 8
     i32.shl
     i32.or
     global.set $core/memory/memory/Memory.currentRomBank
    end
   else
    i32.const 0
    local.get $0
    i32.const 24575
    i32.le_s
    local.get $2
    select
    if
     global.get $core/memory/memory/Memory.isMBC1RomModeEnabled
     i32.const 0
     local.get $3
     select
     if
      global.get $core/memory/memory/Memory.currentRomBank
      i32.const 31
      i32.and
      local.get $1
      i32.const 224
      i32.and
      i32.or
      global.set $core/memory/memory/Memory.currentRomBank
      return
     end
     local.get $1
     i32.const 15
     i32.and
     local.get $1
     i32.const 3
     i32.and
     global.get $core/memory/memory/Memory.isMBC5
     select
     global.set $core/memory/memory/Memory.currentRamBank
    else
     i32.const 0
     local.get $0
     i32.const 32767
     i32.le_s
     local.get $2
     select
     if
      local.get $3
      if
       local.get $1
       i32.const 1
       i32.and
       i32.const 0
       i32.ne
       global.set $core/memory/memory/Memory.isMBC1RomModeEnabled
      end
     end
    end
   end
  end
 )
 (func $core/sound/channel1/Channel1.trigger
  (local $0 i32)
  (local $1 i32)
  i32.const 1
  global.set $core/sound/channel1/Channel1.isEnabled
  global.get $core/sound/channel1/Channel1.lengthCounter
  i32.eqz
  if
   i32.const 64
   global.set $core/sound/channel1/Channel1.lengthCounter
  end
  i32.const 2048
  global.get $core/sound/channel1/Channel1.frequency
  i32.sub
  i32.const 2
  i32.shl
  local.tee $0
  i32.const 2
  i32.shl
  local.get $0
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  select
  global.set $core/sound/channel1/Channel1.frequencyTimer
  global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
  if
   global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
   global.set $core/sound/channel1/Channel1.envelopeCounter
  else
   i32.const 8
   global.set $core/sound/channel1/Channel1.envelopeCounter
  end
  i32.const 1
  global.set $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
  global.get $core/sound/channel1/Channel1.NRx2StartingVolume
  global.set $core/sound/channel1/Channel1.volume
  global.get $core/sound/channel1/Channel1.frequency
  global.set $core/sound/channel1/Channel1.sweepShadowFrequency
  global.get $core/sound/channel1/Channel1.NRx0SweepPeriod
  if
   global.get $core/sound/channel1/Channel1.NRx0SweepPeriod
   global.set $core/sound/channel1/Channel1.sweepCounter
  else
   i32.const 8
   global.set $core/sound/channel1/Channel1.sweepCounter
  end
  i32.const 1
  global.get $core/sound/channel1/Channel1.NRx0SweepShift
  i32.const 0
  i32.gt_s
  local.tee $0
  global.get $core/sound/channel1/Channel1.NRx0SweepPeriod
  i32.const 0
  i32.gt_s
  select
  global.set $core/sound/channel1/Channel1.isSweepEnabled
  i32.const 0
  global.set $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
  local.get $0
  if (result i32)
   block $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow (result i32)
    global.get $core/sound/channel1/Channel1.sweepShadowFrequency
    local.tee $0
    global.get $core/sound/channel1/Channel1.NRx0SweepShift
    i32.shr_s
    local.set $1
    i32.const 1
    global.get $core/sound/channel1/Channel1.NRx0Negate
    if (result i32)
     i32.const 1
     global.set $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
     local.get $0
     local.get $1
     i32.sub
    else
     local.get $0
     local.get $1
     i32.add
    end
    i32.const 2047
    i32.gt_s
    br_if $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow
    drop
    i32.const 0
   end
  else
   i32.const 0
  end
  if
   i32.const 0
   global.set $core/sound/channel1/Channel1.isEnabled
  end
  global.get $core/sound/channel1/Channel1.isDacEnabled
  i32.eqz
  if
   i32.const 0
   global.set $core/sound/channel1/Channel1.isEnabled
  end
 )
 (func $core/sound/channel1/Channel1.updateNRx4 (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  i32.const 7
  i32.and
  local.tee $1
  global.set $core/sound/channel1/Channel1.NRx4FrequencyMSB
  global.get $core/sound/channel1/Channel1.NRx3FrequencyLSB
  local.get $1
  i32.const 8
  i32.shl
  i32.or
  global.set $core/sound/channel1/Channel1.frequency
  global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
  i32.eqz
  local.tee $1
  if
   local.get $0
   i32.const 64
   i32.and
   i32.const 0
   i32.ne
   local.set $1
  end
  global.get $core/sound/sound/Sound.frameSequencer
  i32.const 1
  i32.and
  local.tee $2
  i32.eqz
  if
   local.get $1
   i32.const 0
   global.get $core/sound/channel1/Channel1.lengthCounter
   i32.const 0
   i32.gt_s
   select
   if
    global.get $core/sound/channel1/Channel1.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel1/Channel1.lengthCounter
    i32.const 0
    global.get $core/sound/channel1/Channel1.lengthCounter
    i32.eqz
    local.get $0
    i32.const 128
    i32.and
    select
    if
     i32.const 0
     global.set $core/sound/channel1/Channel1.isEnabled
    end
   end
  end
  local.get $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel1/Channel1.NRx4LengthEnabled
  local.get $0
  i32.const 128
  i32.and
  if
   call $core/sound/channel1/Channel1.trigger
   global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
   i32.const 0
   i32.const 0
   global.get $core/sound/channel1/Channel1.lengthCounter
   i32.const 64
   i32.eq
   local.get $2
   select
   select
   if
    global.get $core/sound/channel1/Channel1.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel1/Channel1.lengthCounter
   end
  end
 )
 (func $core/sound/channel2/Channel2.updateNRx4 (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  i32.const 7
  i32.and
  local.tee $2
  global.set $core/sound/channel2/Channel2.NRx4FrequencyMSB
  global.get $core/sound/channel2/Channel2.NRx3FrequencyLSB
  local.get $2
  i32.const 8
  i32.shl
  i32.or
  global.set $core/sound/channel2/Channel2.frequency
  global.get $core/sound/sound/Sound.frameSequencer
  i32.const 1
  i32.and
  local.set $2
  global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
  i32.eqz
  local.tee $1
  if
   local.get $0
   i32.const 64
   i32.and
   i32.const 0
   i32.ne
   local.set $1
  end
  local.get $2
  i32.eqz
  if
   local.get $1
   i32.const 0
   global.get $core/sound/channel2/Channel2.lengthCounter
   i32.const 0
   i32.gt_s
   select
   if
    global.get $core/sound/channel2/Channel2.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel2/Channel2.lengthCounter
    i32.const 0
    global.get $core/sound/channel2/Channel2.lengthCounter
    i32.eqz
    local.get $0
    i32.const 128
    i32.and
    select
    if
     i32.const 0
     global.set $core/sound/channel2/Channel2.isEnabled
    end
   end
  end
  local.get $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel2/Channel2.NRx4LengthEnabled
  local.get $0
  i32.const 128
  i32.and
  if
   i32.const 1
   global.set $core/sound/channel2/Channel2.isEnabled
   global.get $core/sound/channel2/Channel2.lengthCounter
   i32.eqz
   if
    i32.const 64
    global.set $core/sound/channel2/Channel2.lengthCounter
   end
   i32.const 2048
   global.get $core/sound/channel2/Channel2.frequency
   i32.sub
   i32.const 2
   i32.shl
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   global.set $core/sound/channel2/Channel2.frequencyTimer
   global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
   if
    global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
    global.set $core/sound/channel2/Channel2.envelopeCounter
   else
    i32.const 8
    global.set $core/sound/channel2/Channel2.envelopeCounter
   end
   i32.const 1
   global.set $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
   global.get $core/sound/channel2/Channel2.NRx2StartingVolume
   global.set $core/sound/channel2/Channel2.volume
   global.get $core/sound/channel2/Channel2.isDacEnabled
   i32.eqz
   if
    i32.const 0
    global.set $core/sound/channel2/Channel2.isEnabled
   end
   global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
   i32.const 0
   i32.const 0
   global.get $core/sound/channel2/Channel2.lengthCounter
   i32.const 64
   i32.eq
   local.get $2
   select
   select
   if
    global.get $core/sound/channel2/Channel2.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel2/Channel2.lengthCounter
   end
  end
 )
 (func $core/sound/channel3/Channel3.updateNRx4 (param $0 i32)
  (local $1 i32)
  local.get $0
  i32.const 7
  i32.and
  local.tee $1
  global.set $core/sound/channel3/Channel3.NRx4FrequencyMSB
  global.get $core/sound/channel3/Channel3.NRx3FrequencyLSB
  local.get $1
  i32.const 8
  i32.shl
  i32.or
  global.set $core/sound/channel3/Channel3.frequency
  global.get $core/sound/sound/Sound.frameSequencer
  i32.const 1
  i32.and
  local.tee $1
  i32.eqz
  if
   i32.const 0
   local.get $0
   i32.const 64
   i32.and
   global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
   select
   i32.const 0
   global.get $core/sound/channel3/Channel3.lengthCounter
   i32.const 0
   i32.gt_s
   select
   if
    global.get $core/sound/channel3/Channel3.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel3/Channel3.lengthCounter
    i32.const 0
    global.get $core/sound/channel3/Channel3.lengthCounter
    i32.eqz
    local.get $0
    i32.const 128
    i32.and
    select
    if
     i32.const 0
     global.set $core/sound/channel3/Channel3.isEnabled
    end
   end
  end
  local.get $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel3/Channel3.NRx4LengthEnabled
  local.get $0
  i32.const 128
  i32.and
  if
   i32.const 1
   global.set $core/sound/channel3/Channel3.isEnabled
   global.get $core/sound/channel3/Channel3.lengthCounter
   i32.eqz
   if
    i32.const 256
    global.set $core/sound/channel3/Channel3.lengthCounter
   end
   i32.const 2048
   global.get $core/sound/channel3/Channel3.frequency
   i32.sub
   i32.const 1
   i32.shl
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   global.set $core/sound/channel3/Channel3.frequencyTimer
   global.get $core/sound/channel3/Channel3.frequencyTimer
   i32.const 6
   i32.add
   global.set $core/sound/channel3/Channel3.frequencyTimer
   i32.const 0
   global.set $core/sound/channel3/Channel3.waveTablePosition
   global.get $core/sound/channel3/Channel3.isDacEnabled
   i32.eqz
   if
    i32.const 0
    global.set $core/sound/channel3/Channel3.isEnabled
   end
   global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
   i32.const 0
   i32.const 0
   global.get $core/sound/channel3/Channel3.lengthCounter
   i32.const 256
   i32.eq
   local.get $1
   select
   select
   if
    global.get $core/sound/channel3/Channel3.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel3/Channel3.lengthCounter
   end
  end
 )
 (func $core/sound/channel4/Channel4.updateNRx4 (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
  i32.eqz
  local.tee $1
  if
   local.get $0
   i32.const 64
   i32.and
   i32.const 0
   i32.ne
   local.set $1
  end
  global.get $core/sound/sound/Sound.frameSequencer
  i32.const 1
  i32.and
  local.tee $2
  i32.eqz
  if
   local.get $1
   i32.const 0
   global.get $core/sound/channel4/Channel4.lengthCounter
   i32.const 0
   i32.gt_s
   select
   if
    global.get $core/sound/channel4/Channel4.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel4/Channel4.lengthCounter
    i32.const 0
    global.get $core/sound/channel4/Channel4.lengthCounter
    i32.eqz
    local.get $0
    i32.const 128
    i32.and
    select
    if
     i32.const 0
     global.set $core/sound/channel4/Channel4.isEnabled
    end
   end
  end
  local.get $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel4/Channel4.NRx4LengthEnabled
  local.get $0
  i32.const 128
  i32.and
  if
   i32.const 1
   global.set $core/sound/channel4/Channel4.isEnabled
   global.get $core/sound/channel4/Channel4.lengthCounter
   i32.eqz
   if
    i32.const 64
    global.set $core/sound/channel4/Channel4.lengthCounter
   end
   global.get $core/sound/channel4/Channel4.divisor
   global.get $core/sound/channel4/Channel4.NRx3ClockShift
   i32.shl
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   global.set $core/sound/channel4/Channel4.frequencyTimer
   global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
   if
    global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
    global.set $core/sound/channel4/Channel4.envelopeCounter
   else
    i32.const 8
    global.set $core/sound/channel4/Channel4.envelopeCounter
   end
   i32.const 1
   global.set $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
   global.get $core/sound/channel4/Channel4.NRx2StartingVolume
   global.set $core/sound/channel4/Channel4.volume
   i32.const 32767
   global.set $core/sound/channel4/Channel4.linearFeedbackShiftRegister
   global.get $core/sound/channel4/Channel4.isDacEnabled
   i32.eqz
   if
    i32.const 0
    global.set $core/sound/channel4/Channel4.isEnabled
   end
   global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
   i32.const 0
   i32.const 0
   global.get $core/sound/channel4/Channel4.lengthCounter
   i32.const 64
   i32.eq
   local.get $2
   select
   select
   if
    global.get $core/sound/channel4/Channel4.lengthCounter
    i32.const 1
    i32.sub
    global.set $core/sound/channel4/Channel4.lengthCounter
   end
  end
 )
 (func $core/sound/registers/SoundRegisterWriteTraps (param $0 i32) (param $1 i32) (result i32)
  global.get $core/sound/sound/Sound.NR52IsSoundEnabled
  i32.eqz
  i32.const 0
  local.get $0
  i32.const 65318
  i32.ne
  select
  if
   i32.const 0
   return
  end
  block $folding-inner0
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
                       block $case0|0
                        local.get $0
                        i32.const 65296
                        i32.sub
                        br_table $case0|0 $case2|0 $case6|0 $case10|0 $case14|0 $folding-inner0 $case3|0 $case7|0 $case11|0 $case15|0 $case1|0 $case4|0 $case8|0 $case12|0 $case16|0 $folding-inner0 $case5|0 $case9|0 $case13|0 $case17|0 $case18|0 $case19|0 $case20|0 $folding-inner0
                       end
                       global.get $core/sound/channel1/Channel1.NRx0Negate
                       local.set $0
                       local.get $1
                       i32.const 112
                       i32.and
                       i32.const 4
                       i32.shr_u
                       global.set $core/sound/channel1/Channel1.NRx0SweepPeriod
                       local.get $1
                       i32.const 8
                       i32.and
                       i32.const 0
                       i32.ne
                       global.set $core/sound/channel1/Channel1.NRx0Negate
                       local.get $1
                       i32.const 7
                       i32.and
                       global.set $core/sound/channel1/Channel1.NRx0SweepShift
                       global.get $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
                       i32.const 0
                       global.get $core/sound/channel1/Channel1.NRx0Negate
                       i32.eqz
                       i32.const 0
                       local.get $0
                       select
                       select
                       if
                        i32.const 0
                        global.set $core/sound/channel1/Channel1.isEnabled
                       end
                       br $folding-inner0
                      end
                      i32.const 0
                      local.get $1
                      i32.const 128
                      i32.and
                      i32.const 0
                      i32.ne
                      local.tee $0
                      global.get $core/sound/channel3/Channel3.isDacEnabled
                      select
                      if
                       i32.const 0
                       global.set $core/sound/channel3/Channel3.sampleBuffer
                      end
                      local.get $0
                      global.set $core/sound/channel3/Channel3.isDacEnabled
                      local.get $0
                      i32.eqz
                      if
                       local.get $0
                       global.set $core/sound/channel3/Channel3.isEnabled
                      end
                      br $folding-inner0
                     end
                     local.get $1
                     i32.const 6
                     i32.shr_s
                     i32.const 3
                     i32.and
                     global.set $core/sound/channel1/Channel1.NRx1Duty
                     local.get $1
                     i32.const 63
                     i32.and
                     global.set $core/sound/channel1/Channel1.NRx1LengthLoad
                     i32.const 64
                     global.get $core/sound/channel1/Channel1.NRx1LengthLoad
                     i32.sub
                     global.set $core/sound/channel1/Channel1.lengthCounter
                     br $folding-inner0
                    end
                    local.get $1
                    i32.const 6
                    i32.shr_s
                    i32.const 3
                    i32.and
                    global.set $core/sound/channel2/Channel2.NRx1Duty
                    local.get $1
                    i32.const 63
                    i32.and
                    global.set $core/sound/channel2/Channel2.NRx1LengthLoad
                    i32.const 64
                    global.get $core/sound/channel2/Channel2.NRx1LengthLoad
                    i32.sub
                    global.set $core/sound/channel2/Channel2.lengthCounter
                    br $folding-inner0
                   end
                   local.get $1
                   global.set $core/sound/channel3/Channel3.NRx1LengthLoad
                   i32.const 256
                   global.get $core/sound/channel3/Channel3.NRx1LengthLoad
                   i32.sub
                   global.set $core/sound/channel3/Channel3.lengthCounter
                   br $folding-inner0
                  end
                  local.get $1
                  i32.const 63
                  i32.and
                  global.set $core/sound/channel4/Channel4.NRx1LengthLoad
                  i32.const 64
                  global.get $core/sound/channel4/Channel4.NRx1LengthLoad
                  i32.sub
                  global.set $core/sound/channel4/Channel4.lengthCounter
                  br $folding-inner0
                 end
                 global.get $core/sound/channel1/Channel1.isEnabled
                 if
                  i32.const 0
                  global.get $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
                  global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
                  select
                  if
                   global.get $core/sound/channel1/Channel1.volume
                   i32.const 1
                   i32.add
                   i32.const 15
                   i32.and
                   global.set $core/sound/channel1/Channel1.volume
                  end
                  global.get $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
                  local.get $1
                  i32.const 8
                  i32.and
                  i32.const 0
                  i32.ne
                  i32.ne
                  if
                   i32.const 16
                   global.get $core/sound/channel1/Channel1.volume
                   i32.sub
                   i32.const 15
                   i32.and
                   global.set $core/sound/channel1/Channel1.volume
                  end
                 end
                 local.get $1
                 i32.const 4
                 i32.shr_s
                 i32.const 15
                 i32.and
                 global.set $core/sound/channel1/Channel1.NRx2StartingVolume
                 local.get $1
                 i32.const 8
                 i32.and
                 i32.const 0
                 i32.ne
                 global.set $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
                 local.get $1
                 i32.const 7
                 i32.and
                 global.set $core/sound/channel1/Channel1.NRx2EnvelopePeriod
                 local.get $1
                 i32.const 248
                 i32.and
                 i32.const 0
                 i32.gt_u
                 local.tee $0
                 global.set $core/sound/channel1/Channel1.isDacEnabled
                 local.get $0
                 i32.eqz
                 if
                  i32.const 0
                  global.set $core/sound/channel1/Channel1.isEnabled
                 end
                 br $folding-inner0
                end
                global.get $core/sound/channel2/Channel2.isEnabled
                if
                 i32.const 0
                 global.get $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
                 global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
                 select
                 if
                  global.get $core/sound/channel2/Channel2.volume
                  i32.const 1
                  i32.add
                  i32.const 15
                  i32.and
                  global.set $core/sound/channel2/Channel2.volume
                 end
                 global.get $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
                 local.get $1
                 i32.const 8
                 i32.and
                 i32.const 0
                 i32.ne
                 i32.ne
                 if
                  i32.const 16
                  global.get $core/sound/channel2/Channel2.volume
                  i32.sub
                  i32.const 15
                  i32.and
                  global.set $core/sound/channel2/Channel2.volume
                 end
                end
                local.get $1
                i32.const 4
                i32.shr_s
                i32.const 15
                i32.and
                global.set $core/sound/channel2/Channel2.NRx2StartingVolume
                local.get $1
                i32.const 8
                i32.and
                i32.const 0
                i32.ne
                global.set $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
                local.get $1
                i32.const 7
                i32.and
                global.set $core/sound/channel2/Channel2.NRx2EnvelopePeriod
                local.get $1
                i32.const 248
                i32.and
                i32.const 0
                i32.gt_u
                local.tee $0
                global.set $core/sound/channel2/Channel2.isDacEnabled
                local.get $0
                i32.eqz
                if
                 local.get $0
                 global.set $core/sound/channel2/Channel2.isEnabled
                end
                br $folding-inner0
               end
               i32.const 1
               global.set $core/sound/channel3/Channel3.volumeCodeChanged
               local.get $1
               i32.const 5
               i32.shr_s
               i32.const 15
               i32.and
               global.set $core/sound/channel3/Channel3.NRx2VolumeCode
               br $folding-inner0
              end
              global.get $core/sound/channel4/Channel4.isEnabled
              if
               i32.const 0
               global.get $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
               global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
               select
               if
                global.get $core/sound/channel4/Channel4.volume
                i32.const 1
                i32.add
                i32.const 15
                i32.and
                global.set $core/sound/channel4/Channel4.volume
               end
               global.get $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
               local.get $1
               i32.const 8
               i32.and
               i32.const 0
               i32.ne
               i32.ne
               if
                i32.const 16
                global.get $core/sound/channel4/Channel4.volume
                i32.sub
                i32.const 15
                i32.and
                global.set $core/sound/channel4/Channel4.volume
               end
              end
              local.get $1
              i32.const 4
              i32.shr_s
              i32.const 15
              i32.and
              global.set $core/sound/channel4/Channel4.NRx2StartingVolume
              local.get $1
              i32.const 8
              i32.and
              i32.const 0
              i32.ne
              global.set $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
              local.get $1
              i32.const 7
              i32.and
              global.set $core/sound/channel4/Channel4.NRx2EnvelopePeriod
              local.get $1
              i32.const 248
              i32.and
              i32.const 0
              i32.gt_u
              local.tee $0
              global.set $core/sound/channel4/Channel4.isDacEnabled
              local.get $0
              i32.eqz
              if
               local.get $0
               global.set $core/sound/channel4/Channel4.isEnabled
              end
              br $folding-inner0
             end
             local.get $1
             global.set $core/sound/channel1/Channel1.NRx3FrequencyLSB
             local.get $1
             global.get $core/sound/channel1/Channel1.NRx4FrequencyMSB
             i32.const 8
             i32.shl
             i32.or
             global.set $core/sound/channel1/Channel1.frequency
             br $folding-inner0
            end
            local.get $1
            global.set $core/sound/channel2/Channel2.NRx3FrequencyLSB
            local.get $1
            global.get $core/sound/channel2/Channel2.NRx4FrequencyMSB
            i32.const 8
            i32.shl
            i32.or
            global.set $core/sound/channel2/Channel2.frequency
            br $folding-inner0
           end
           local.get $1
           global.set $core/sound/channel3/Channel3.NRx3FrequencyLSB
           local.get $1
           global.get $core/sound/channel3/Channel3.NRx4FrequencyMSB
           i32.const 8
           i32.shl
           i32.or
           global.set $core/sound/channel3/Channel3.frequency
           br $folding-inner0
          end
          local.get $1
          i32.const 4
          i32.shr_s
          global.set $core/sound/channel4/Channel4.NRx3ClockShift
          local.get $1
          i32.const 8
          i32.and
          i32.const 0
          i32.ne
          global.set $core/sound/channel4/Channel4.NRx3WidthMode
          local.get $1
          i32.const 7
          i32.and
          local.tee $0
          global.set $core/sound/channel4/Channel4.NRx3DivisorCode
          local.get $0
          i32.const 1
          i32.shl
          local.tee $0
          i32.const 1
          i32.lt_s
          if (result i32)
           i32.const 1
          else
           local.get $0
          end
          i32.const 3
          i32.shl
          global.set $core/sound/channel4/Channel4.divisor
          br $folding-inner0
         end
         local.get $1
         call $core/sound/channel1/Channel1.updateNRx4
         br $folding-inner0
        end
        local.get $1
        call $core/sound/channel2/Channel2.updateNRx4
        br $folding-inner0
       end
       local.get $1
       call $core/sound/channel3/Channel3.updateNRx4
       br $folding-inner0
      end
      local.get $1
      call $core/sound/channel4/Channel4.updateNRx4
      br $folding-inner0
     end
     local.get $1
     i32.const 4
     i32.shr_s
     i32.const 7
     i32.and
     global.set $core/sound/sound/Sound.NR50LeftMixerVolume
     local.get $1
     i32.const 7
     i32.and
     global.set $core/sound/sound/Sound.NR50RightMixerVolume
     i32.const 1
     global.set $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
     br $folding-inner0
    end
    local.get $1
    i32.const 128
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
    local.get $1
    i32.const 64
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
    local.get $1
    i32.const 32
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
    local.get $1
    i32.const 16
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
    local.get $1
    i32.const 8
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
    local.get $1
    i32.const 4
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
    local.get $1
    i32.const 2
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
    local.get $1
    i32.const 1
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
    i32.const 1
    global.set $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
    br $folding-inner0
   end
   global.get $core/sound/sound/Sound.NR52IsSoundEnabled
   local.tee $0
   if (result i32)
    i32.const 0
   else
    local.get $1
    i32.const 128
    i32.and
   end
   if
    i32.const 7
    global.set $core/sound/sound/Sound.frameSequencer
    i32.const 0
    global.set $core/sound/channel1/Channel1.waveFormPositionOnDuty
    i32.const 0
    global.set $core/sound/channel2/Channel2.waveFormPositionOnDuty
   end
   local.get $1
   i32.const 128
   i32.and
   i32.eqz
   i32.const 0
   local.get $0
   select
   if
    i32.const 65296
    local.set $0
    loop $for-loop|1
     local.get $0
     i32.const 65318
     i32.lt_s
     if
      local.get $0
      i32.const 0
      call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
      local.get $0
      i32.const 1
      i32.add
      local.set $0
      br $for-loop|1
     end
    end
   end
   local.get $1
   i32.const 128
   i32.and
   i32.const 0
   i32.ne
   global.set $core/sound/sound/Sound.NR52IsSoundEnabled
  end
  i32.const 1
 )
 (func $core/graphics/lcd/resetLcd (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 65348
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.const 0
  i32.store8
  i32.const 65345
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.const -4
  i32.and
  local.set $2
  i32.const 0
  global.set $core/graphics/lcd/Lcd.currentLcdMode
  i32.const 65345
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  local.get $2
  i32.store8
  local.get $0
  if
   loop $for-loop|0
    local.get $1
    i32.const 93184
    i32.lt_s
    if
     local.get $1
     i32.const 91264
     i32.add
     i32.const 255
     i32.store8
     local.get $1
     i32.const 1
     i32.add
     local.set $1
     br $for-loop|0
    end
   end
  end
 )
 (func $core/memory/dma/startHdmaTransfer (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  i32.eqz
  if
   return
  end
  local.get $0
  i32.const 128
  i32.and
  i32.eqz
  i32.const 0
  global.get $core/memory/memory/Memory.isHblankHdmaActive
  select
  if
   i32.const 0
   global.set $core/memory/memory/Memory.isHblankHdmaActive
   i32.const 65365
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   i32.const 128
   i32.or
   local.set $0
   i32.const 65365
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $0
   i32.store8
   return
  end
  i32.const 65361
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.const 8
  i32.shl
  i32.const 65362
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.or
  i32.const 65520
  i32.and
  local.set $1
  i32.const 65363
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.const 8
  i32.shl
  i32.const 65364
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.or
  i32.const 8176
  i32.and
  i32.const 32768
  i32.add
  local.set $2
  local.get $0
  i32.const -129
  i32.and
  i32.const 1
  i32.add
  i32.const 4
  i32.shl
  local.set $3
  local.get $0
  i32.const 128
  i32.and
  if
   i32.const 1
   global.set $core/memory/memory/Memory.isHblankHdmaActive
   local.get $3
   global.set $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
   local.get $1
   global.set $core/memory/memory/Memory.hblankHdmaSource
   local.get $2
   global.set $core/memory/memory/Memory.hblankHdmaDestination
   i32.const 65365
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $0
   i32.const -129
   i32.and
   i32.store8
  else
   local.get $1
   local.get $2
   local.get $3
   call $core/memory/dma/hdmaTransfer
   i32.const 65365
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.const 255
   i32.store8
  end
 )
 (func $core/timers/timers/updateTimers (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  loop $while-continue|0
   local.get $2
   local.get $0
   i32.lt_s
   if
    local.get $2
    i32.const 4
    i32.add
    local.set $2
    global.get $core/timers/timers/Timers.dividerRegister
    local.tee $1
    i32.const 4
    i32.add
    i32.const 65535
    i32.and
    local.tee $3
    global.set $core/timers/timers/Timers.dividerRegister
    global.get $core/timers/timers/Timers.timerEnabled
    if
     global.get $core/timers/timers/Timers.timerCounterWasReset
     local.set $4
     global.get $core/timers/timers/Timers.timerCounterOverflowDelay
     if
      global.get $core/timers/timers/Timers.timerModulo
      global.set $core/timers/timers/Timers.timerCounter
      i32.const 1
      global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
      i32.const 2
      call $core/interrupts/interrupts/_requestInterrupt
      i32.const 0
      global.set $core/timers/timers/Timers.timerCounterOverflowDelay
      i32.const 1
      global.set $core/timers/timers/Timers.timerCounterWasReset
     else
      local.get $4
      if
       i32.const 0
       global.set $core/timers/timers/Timers.timerCounterWasReset
      end
     end
     local.get $1
     i32.const 1
     block $__inlined_func$core/timers/timers/_getTimerCounterMaskBit (result i32)
      block $break|0
       block $case3|0
        block $case2|0
         block $case1|0
          block $case0|0
           global.get $core/timers/timers/Timers.timerInputClock
           br_table $case0|0 $case1|0 $case2|0 $case3|0 $break|0
          end
          i32.const 9
          br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
         end
         i32.const 3
         br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
        end
        i32.const 5
        br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
       end
       i32.const 7
       br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
      end
      i32.const 0
     end
     local.tee $1
     i32.shl
     i32.and
     if (result i32)
      local.get $3
      i32.const 1
      local.get $1
      i32.shl
      i32.and
      i32.eqz
     else
      i32.const 0
     end
     if
      global.get $core/timers/timers/Timers.timerCounter
      i32.const 1
      i32.add
      local.tee $1
      i32.const 255
      i32.gt_s
      if (result i32)
       i32.const 1
       global.set $core/timers/timers/Timers.timerCounterOverflowDelay
       i32.const 0
      else
       local.get $1
      end
      global.set $core/timers/timers/Timers.timerCounter
     end
    end
    br $while-continue|0
   end
  end
 )
 (func $core/timers/timers/Timers.updateTimerControl (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/timers/timers/Timers.timerEnabled
  local.get $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  global.set $core/timers/timers/Timers.timerEnabled
  local.get $0
  i32.const 3
  i32.and
  local.set $3
  i32.eqz
  if
   block $__inlined_func$core/timers/timers/_getTimerCounterMaskBit (result i32)
    block $break|0
     block $case3|0
      block $case2|0
       block $case1|0
        block $case0|0
         global.get $core/timers/timers/Timers.timerInputClock
         br_table $case0|0 $case1|0 $case2|0 $case3|0 $break|0
        end
        i32.const 9
        br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
       end
       i32.const 3
       br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
      end
      i32.const 5
      br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
     end
     i32.const 7
     br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
    end
    i32.const 0
   end
   local.set $1
   block $__inlined_func$core/timers/timers/_getTimerCounterMaskBit0 (result i32)
    block $break|01
     block $case3|02
      block $case2|03
       block $case1|04
        block $case0|05
         local.get $3
         br_table $case0|05 $case1|04 $case2|03 $case3|02 $break|01
        end
        i32.const 9
        br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit0
       end
       i32.const 3
       br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit0
      end
      i32.const 5
      br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit0
     end
     i32.const 7
     br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit0
    end
    i32.const 0
   end
   local.set $0
   global.get $core/timers/timers/Timers.dividerRegister
   local.set $2
   global.get $core/timers/timers/Timers.timerEnabled
   if (result i32)
    local.get $2
    i32.const 1
    local.get $1
    i32.shl
    i32.and
   else
    local.get $2
    i32.const 1
    local.get $0
    i32.shl
    i32.and
    i32.const 0
    local.get $2
    i32.const 1
    local.get $1
    i32.shl
    i32.and
    select
   end
   if
    global.get $core/timers/timers/Timers.timerCounter
    i32.const 1
    i32.add
    local.tee $0
    i32.const 255
    i32.gt_s
    if (result i32)
     i32.const 1
     global.set $core/timers/timers/Timers.timerCounterOverflowDelay
     i32.const 0
    else
     local.get $0
    end
    global.set $core/timers/timers/Timers.timerCounter
   end
  end
  local.get $3
  global.set $core/timers/timers/Timers.timerInputClock
 )
 (func $core/memory/writeTraps/checkWriteTraps (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  block $folding-inner1
   block $folding-inner0
    local.get $0
    i32.const 65357
    i32.eq
    if
     i32.const 65357
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     local.get $1
     i32.const 1
     i32.and
     i32.store8
     br $folding-inner0
    end
    local.get $0
    i32.const 65360
    i32.eq
    i32.const 0
    global.get $core/cpu/cpu/Cpu.BootROMEnabled
    select
    if
     i32.const 0
     global.set $core/cpu/cpu/Cpu.BootROMEnabled
     i32.const 255
     global.set $core/cpu/cpu/Cpu.programCounter
     br $folding-inner1
    end
    local.get $0
    i32.const 32768
    i32.lt_s
    if
     local.get $0
     local.get $1
     call $core/memory/banking/handleBanking
     br $folding-inner0
    end
    local.get $0
    i32.const 40960
    i32.lt_s
    i32.const 0
    local.get $0
    i32.const 32768
    i32.ge_s
    select
    br_if $folding-inner1
    local.get $0
    i32.const 65024
    i32.lt_s
    i32.const 0
    local.get $0
    i32.const 57344
    i32.ge_s
    select
    if
     local.get $0
     i32.const -8192
     i32.add
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     local.get $1
     i32.store8
     br $folding-inner1
    end
    local.get $0
    i32.const 65183
    i32.le_s
    i32.const 0
    local.get $0
    i32.const 65024
    i32.ge_s
    select
    if
     global.get $core/graphics/lcd/Lcd.currentLcdMode
     i32.const 2
     i32.ge_s
     return
    end
    local.get $0
    i32.const 65279
    i32.le_s
    i32.const 0
    local.get $0
    i32.const 65184
    i32.ge_s
    select
    br_if $folding-inner0
    local.get $0
    i32.const 65282
    i32.eq
    if
     local.get $1
     i32.const 2
     i32.and
     i32.const 0
     i32.ne
     global.set $core/serial/serial/Serial.isClockSpeedFast
     local.get $1
     i32.const 128
     i32.and
     i32.const 0
     i32.ne
     global.set $core/serial/serial/Serial.transferStartFlag
     i32.const 1
     return
    end
    local.get $0
    i32.const 65318
    i32.le_s
    i32.const 0
    local.get $0
    i32.const 65296
    i32.ge_s
    select
    if
     call $core/sound/sound/batchProcessAudio
     local.get $0
     local.get $1
     call $core/sound/registers/SoundRegisterWriteTraps
     return
    end
    local.get $0
    i32.const 65343
    i32.le_s
    i32.const 0
    local.get $0
    i32.const 65328
    i32.ge_s
    select
    if
     call $core/sound/sound/batchProcessAudio
     global.get $core/sound/channel3/Channel3.isEnabled
     if
      global.get $core/sound/channel3/Channel3.waveTablePosition
      i32.const 1
      i32.shr_s
      i32.const 65328
      i32.add
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      local.get $1
      i32.store8
      br $folding-inner0
     end
     br $folding-inner1
    end
    local.get $0
    i32.const 65355
    i32.le_s
    i32.const 0
    local.get $0
    i32.const 65344
    i32.ge_s
    select
    if
     local.get $0
     i32.const 65344
     i32.eq
     if
      global.get $core/graphics/lcd/Lcd.enabled
      local.set $0
      local.get $1
      i32.const 128
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.enabled
      local.get $1
      i32.const 64
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
      local.get $1
      i32.const 32
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.windowDisplayEnabled
      local.get $1
      i32.const 16
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.bgWindowTileDataSelect
      local.get $1
      i32.const 8
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
      local.get $1
      i32.const 4
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.tallSpriteSize
      local.get $1
      i32.const 2
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.spriteDisplayEnable
      local.get $1
      i32.const 1
      i32.and
      i32.const 0
      i32.ne
      global.set $core/graphics/lcd/Lcd.bgDisplayEnabled
      global.get $core/graphics/lcd/Lcd.enabled
      i32.eqz
      i32.const 0
      local.get $0
      select
      if
       i32.const 1
       call $core/graphics/lcd/resetLcd
      end
      i32.const 0
      global.get $core/graphics/lcd/Lcd.enabled
      local.get $0
      select
      if
       i32.const 0
       call $core/graphics/lcd/resetLcd
      end
      br $folding-inner1
     end
     local.get $0
     i32.const 65345
     i32.eq
     if
      local.get $1
      i32.const 248
      i32.and
      i32.const 65345
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      i32.const 7
      i32.and
      i32.or
      i32.const 128
      i32.or
      local.set $0
      i32.const 65345
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      local.get $0
      i32.store8
      br $folding-inner0
     end
     local.get $0
     i32.const 65348
     i32.eq
     if
      i32.const 0
      global.set $core/graphics/graphics/Graphics.scanlineRegister
      local.get $0
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.const 0
      i32.store8
      br $folding-inner0
     end
     local.get $0
     i32.const 65349
     i32.eq
     if
      local.get $1
      global.set $core/graphics/lcd/Lcd.coincidenceCompare
      br $folding-inner1
     end
     local.get $0
     i32.const 65350
     i32.eq
     if
      i32.const 0
      local.set $0
      local.get $1
      i32.const 8
      i32.shl
      local.set $1
      loop $for-loop|0
       local.get $0
       i32.const 159
       i32.le_s
       if
        local.get $0
        local.get $1
        i32.add
        call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
        i32.load8_u
        local.set $2
        local.get $0
        i32.const 65024
        i32.add
        call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
        local.get $2
        i32.store8
        local.get $0
        i32.const 1
        i32.add
        local.set $0
        br $for-loop|0
       end
      end
      i32.const 644
      global.set $core/memory/memory/Memory.DMACycles
      br $folding-inner1
     end
     block $break|0
      block $case3|0
       block $case2|0
        block $case1|0
         local.get $0
         i32.const 65347
         i32.ne
         if
          local.get $0
          i32.const 65346
          i32.sub
          br_table $case1|0 $break|0 $break|0 $break|0 $break|0 $break|0 $break|0 $break|0 $case3|0 $case2|0 $break|0
         end
         local.get $1
         global.set $core/graphics/graphics/Graphics.scrollX
         br $folding-inner1
        end
        local.get $1
        global.set $core/graphics/graphics/Graphics.scrollY
        br $folding-inner1
       end
       local.get $1
       global.set $core/graphics/graphics/Graphics.windowX
       br $folding-inner1
      end
      local.get $1
      global.set $core/graphics/graphics/Graphics.windowY
      br $folding-inner1
     end
     br $folding-inner1
    end
    local.get $0
    i32.const 65365
    i32.eq
    if
     local.get $1
     call $core/memory/dma/startHdmaTransfer
     br $folding-inner0
    end
    i32.const 1
    local.get $0
    i32.const 65359
    i32.eq
    local.get $0
    i32.const 65392
    i32.eq
    select
    if
     global.get $core/memory/memory/Memory.isHblankHdmaActive
     if
      global.get $core/memory/memory/Memory.hblankHdmaSource
      local.tee $2
      i32.const 32767
      i32.le_s
      i32.const 0
      local.get $2
      i32.const 16384
      i32.ge_s
      select
      if (result i32)
       i32.const 1
      else
       local.get $2
       i32.const 57343
       i32.le_s
       i32.const 0
       local.get $2
       i32.const 53248
       i32.ge_s
       select
      end
      br_if $folding-inner0
     end
    end
    local.get $0
    i32.const 65387
    i32.le_s
    i32.const 0
    local.get $0
    i32.const 65384
    i32.ge_s
    select
    if
     i32.const 1
     local.get $0
     i32.const 65387
     i32.eq
     local.get $0
     i32.const 65385
     i32.eq
     select
     if
      local.get $0
      i32.const 1
      i32.sub
      local.tee $3
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      i32.const -65
      i32.and
      local.tee $2
      i32.const 63
      i32.and
      local.tee $4
      i32.const -64
      i32.sub
      local.get $4
      local.get $0
      i32.const 65387
      i32.eq
      select
      i32.const 67584
      i32.add
      local.get $1
      i32.store8
      local.get $2
      i32.const 128
      i32.and
      if
       local.get $3
       call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
       local.get $2
       i32.const 1
       i32.add
       i32.const 128
       i32.or
       i32.store8
      end
     end
     br $folding-inner1
    end
    local.get $0
    i32.const 65287
    i32.le_s
    i32.const 0
    local.get $0
    i32.const 65284
    i32.ge_s
    select
    if
     global.get $core/timers/timers/Timers.currentCycles
     call $core/timers/timers/updateTimers
     i32.const 0
     global.set $core/timers/timers/Timers.currentCycles
     block $break|1
      block $case3|1
       block $case2|1
        block $case1|1
         local.get $0
         i32.const 65284
         i32.ne
         if
          local.get $0
          i32.const 65285
          i32.sub
          br_table $case1|1 $case2|1 $case3|1 $break|1
         end
         global.get $core/timers/timers/Timers.dividerRegister
         local.set $0
         i32.const 0
         global.set $core/timers/timers/Timers.dividerRegister
         i32.const 65284
         call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
         i32.const 0
         i32.store8
         global.get $core/timers/timers/Timers.timerEnabled
         if (result i32)
          local.get $0
          i32.const 1
          block $__inlined_func$core/timers/timers/_getTimerCounterMaskBit (result i32)
           block $break|00
            block $case3|01
             block $case2|02
              block $case1|03
               block $case0|0
                global.get $core/timers/timers/Timers.timerInputClock
                br_table $case0|0 $case1|03 $case2|02 $case3|01 $break|00
               end
               i32.const 9
               br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
              end
              i32.const 3
              br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
             end
             i32.const 5
             br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
            end
            i32.const 7
            br $__inlined_func$core/timers/timers/_getTimerCounterMaskBit
           end
           i32.const 0
          end
          i32.shl
          i32.and
         else
          i32.const 0
         end
         if
          global.get $core/timers/timers/Timers.timerCounter
          i32.const 1
          i32.add
          local.tee $0
          i32.const 255
          i32.gt_s
          if (result i32)
           i32.const 1
           global.set $core/timers/timers/Timers.timerCounterOverflowDelay
           i32.const 0
          else
           local.get $0
          end
          global.set $core/timers/timers/Timers.timerCounter
         end
         br $folding-inner0
        end
        block $__inlined_func$core/timers/timers/Timers.updateTimerCounter
         global.get $core/timers/timers/Timers.timerEnabled
         if
          global.get $core/timers/timers/Timers.timerCounterWasReset
          br_if $__inlined_func$core/timers/timers/Timers.updateTimerCounter
          global.get $core/timers/timers/Timers.timerCounterOverflowDelay
          if
           i32.const 0
           global.set $core/timers/timers/Timers.timerCounterOverflowDelay
          end
         end
         local.get $1
         global.set $core/timers/timers/Timers.timerCounter
        end
        br $folding-inner1
       end
       local.get $1
       global.set $core/timers/timers/Timers.timerModulo
       global.get $core/timers/timers/Timers.timerCounterWasReset
       i32.const 0
       global.get $core/timers/timers/Timers.timerEnabled
       select
       if
        local.get $1
        global.set $core/timers/timers/Timers.timerCounter
        i32.const 0
        global.set $core/timers/timers/Timers.timerCounterWasReset
       end
       br $folding-inner1
      end
      local.get $1
      call $core/timers/timers/Timers.updateTimerControl
      br $folding-inner1
     end
     br $folding-inner1
    end
    local.get $0
    i32.const 65280
    i32.eq
    if
     local.get $1
     i32.const 255
     i32.xor
     global.set $core/joypad/joypad/Joypad.joypadRegisterFlipped
     global.get $core/joypad/joypad/Joypad.joypadRegisterFlipped
     local.tee $2
     i32.const 16
     i32.and
     i32.const 0
     i32.ne
     global.set $core/joypad/joypad/Joypad.isDpadType
     local.get $2
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     global.set $core/joypad/joypad/Joypad.isButtonType
    end
    local.get $0
    i32.const 65295
    i32.eq
    if
     local.get $1
     i32.const 1
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
     local.get $1
     i32.const 2
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
     local.get $1
     i32.const 4
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
     local.get $1
     i32.const 8
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
     local.get $1
     i32.const 16
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
     local.get $1
     global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
     br $folding-inner1
    end
    local.get $0
    i32.const 65535
    i32.eq
    if
     local.get $1
     i32.const 1
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
     local.get $1
     i32.const 2
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
     local.get $1
     i32.const 4
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
     local.get $1
     i32.const 8
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
     local.get $1
     i32.const 16
     i32.and
     i32.const 0
     i32.ne
     global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
     local.get $1
     global.set $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
     br $folding-inner1
    end
    br $folding-inner1
   end
   i32.const 0
   return
  end
  i32.const 1
 )
 (func $core/memory/store/eightBitStoreIntoGBMemoryWithTraps (param $0 i32) (param $1 i32)
  local.get $0
  global.get $core/debug/breakpoints/Breakpoints.writeGbMemory
  i32.eq
  if
   i32.const 1
   global.set $core/debug/breakpoints/Breakpoints.reachedBreakpoint
  end
  local.get $0
  local.get $1
  call $core/memory/writeTraps/checkWriteTraps
  if
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $1
   i32.store8
  end
 )
 (func $core/memory/dma/hdmaTransfer (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  loop $for-loop|0
   local.get $3
   local.get $2
   i32.lt_s
   if
    local.get $0
    local.get $3
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
    local.set $5
    local.get $1
    local.get $3
    i32.add
    local.set $4
    loop $while-continue|1
     local.get $4
     i32.const 40959
     i32.gt_s
     if
      local.get $4
      i32.const -8192
      i32.add
      local.set $4
      br $while-continue|1
     end
    end
    local.get $4
    local.get $5
    call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|0
   end
  end
  global.get $core/memory/memory/Memory.DMACycles
  i32.const 32
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  local.get $2
  i32.const 4
  i32.shr_s
  i32.mul
  i32.add
  global.set $core/memory/memory/Memory.DMACycles
 )
 (func $core/graphics/lcd/checkCoincidence (param $0 i32) (param $1 i32) (result i32)
  global.get $core/graphics/graphics/Graphics.scanlineRegister
  global.get $core/graphics/lcd/Lcd.coincidenceCompare
  i32.eq
  i32.const 0
  local.get $0
  i32.const 1
  i32.eq
  i32.const 1
  local.get $0
  select
  select
  if
   local.get $1
   i32.const 4
   i32.or
   local.tee $1
   i32.const 64
   i32.and
   if
    i32.const 1
    global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
    i32.const 1
    call $core/interrupts/interrupts/_requestInterrupt
   end
  else
   local.get $1
   i32.const -5
   i32.and
   local.set $1
  end
  local.get $1
 )
 (func $core/graphics/lcd/setLcdStatus
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/graphics/lcd/Lcd.enabled
  i32.eqz
  if
   return
  end
  global.get $core/graphics/graphics/Graphics.scanlineRegister
  local.tee $2
  i32.const 144
  i32.ge_s
  if (result i32)
   i32.const 1
  else
   global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
   local.tee $0
   i32.const 376
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   local.tee $1
   i32.ge_s
   if (result i32)
    i32.const 2
   else
    i32.const 3
    i32.const 0
    local.get $0
    local.get $1
    i32.ge_s
    select
   end
  end
  local.tee $0
  global.get $core/graphics/lcd/Lcd.currentLcdMode
  i32.ne
  if
   i32.const 65345
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   local.set $3
   local.get $0
   global.set $core/graphics/lcd/Lcd.currentLcdMode
   i32.const 0
   local.set $1
   block $break|0
    block $case3|0
     block $case2|0
      block $case1|0
       local.get $0
       local.tee $2
       if
        local.get $2
        i32.const 1
        i32.sub
        br_table $case1|0 $case2|0 $case3|0 $break|0
       end
       local.get $3
       i32.const -4
       i32.and
       local.tee $3
       i32.const 8
       i32.and
       i32.const 0
       i32.ne
       local.set $1
       br $break|0
      end
      local.get $3
      i32.const -3
      i32.and
      i32.const 1
      i32.or
      local.tee $3
      i32.const 16
      i32.and
      i32.const 0
      i32.ne
      local.set $1
      br $break|0
     end
     local.get $3
     i32.const -2
     i32.and
     i32.const 2
     i32.or
     local.tee $3
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     local.set $1
     br $break|0
    end
    local.get $3
    i32.const 3
    i32.or
    local.set $3
   end
   local.get $1
   if
    i32.const 1
    global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
    i32.const 1
    call $core/interrupts/interrupts/_requestInterrupt
   end
   local.get $2
   i32.eqz
   if
    global.get $core/memory/memory/Memory.isHblankHdmaActive
    if
     global.get $core/memory/memory/Memory.hblankHdmaSource
     global.get $core/memory/memory/Memory.hblankHdmaDestination
     global.get $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
     local.tee $1
     i32.const 16
     i32.lt_s
     if (result i32)
      local.get $1
     else
      i32.const 16
     end
     local.tee $0
     call $core/memory/dma/hdmaTransfer
     local.get $0
     global.get $core/memory/memory/Memory.hblankHdmaSource
     i32.add
     global.set $core/memory/memory/Memory.hblankHdmaSource
     local.get $0
     global.get $core/memory/memory/Memory.hblankHdmaDestination
     i32.add
     global.set $core/memory/memory/Memory.hblankHdmaDestination
     local.get $1
     local.get $0
     i32.sub
     local.tee $0
     global.set $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
     local.get $0
     i32.const 0
     i32.le_s
     if
      i32.const 0
      global.set $core/memory/memory/Memory.isHblankHdmaActive
      i32.const 65365
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.const 255
      i32.store8
     else
      i32.const 65365
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      local.get $0
      i32.const 4
      i32.shr_s
      i32.const 1
      i32.sub
      i32.const -129
      i32.and
      i32.store8
     end
    end
   end
   local.get $2
   i32.const 1
   i32.eq
   if
    i32.const 1
    global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
    i32.const 0
    call $core/interrupts/interrupts/_requestInterrupt
   end
   local.get $2
   local.get $3
   call $core/graphics/lcd/checkCoincidence
   local.set $0
   i32.const 65345
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $0
   i32.store8
  else
   local.get $2
   i32.const 153
   i32.eq
   if
    local.get $0
    i32.const 65345
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    i32.load8_u
    call $core/graphics/lcd/checkCoincidence
    local.set $0
    i32.const 65345
    call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
    local.get $0
    i32.store8
   end
  end
 )
 (func $core/graphics/graphics/updateGraphics (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/graphics/lcd/Lcd.enabled
  if
   local.get $0
   global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
   i32.add
   global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
   global.get $core/config/Config.graphicsDisableScanlineRendering
   local.set $3
   loop $while-continue|0
    global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
    i32.const 4
    global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
    local.tee $0
    i32.shl
    i32.const 456
    local.get $0
    i32.shl
    global.get $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 153
    i32.eq
    select
    i32.ge_s
    if
     global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
     i32.const 4
     global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
     local.tee $0
     i32.shl
     i32.const 456
     local.get $0
     i32.shl
     global.get $core/graphics/graphics/Graphics.scanlineRegister
     local.tee $1
     i32.const 153
     i32.eq
     select
     i32.sub
     global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
     local.get $1
     i32.const 144
     i32.eq
     if
      local.get $3
      if
       i32.const 0
       local.set $0
       loop $for-loop|0
        local.get $0
        i32.const 144
        i32.le_s
        if
         local.get $0
         i32.const 255
         i32.and
         call $core/graphics/graphics/_drawScanline
         local.get $0
         i32.const 1
         i32.add
         local.set $0
         br $for-loop|0
        end
       end
      else
       local.get $1
       call $core/graphics/graphics/_drawScanline
      end
      i32.const 0
      local.set $0
      loop $for-loop|00
       local.get $0
       i32.const 144
       i32.lt_s
       if
        i32.const 0
        local.set $2
        loop $for-loop|1
         local.get $2
         i32.const 160
         i32.lt_s
         if
          local.get $2
          local.get $0
          i32.const 160
          i32.mul
          i32.add
          i32.const 67712
          i32.add
          i32.const 0
          i32.store8
          local.get $2
          i32.const 1
          i32.add
          local.set $2
          br $for-loop|1
         end
        end
        local.get $0
        i32.const 1
        i32.add
        local.set $0
        br $for-loop|00
       end
      end
      i32.const -1
      global.set $core/graphics/tiles/TileCache.tileId
      i32.const -1
      global.set $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
     else
      local.get $1
      i32.const 144
      i32.lt_s
      if
       local.get $3
       i32.eqz
       if
        local.get $1
        call $core/graphics/graphics/_drawScanline
       end
      end
     end
     i32.const 0
     local.get $1
     i32.const 1
     i32.add
     local.get $1
     i32.const 153
     i32.gt_s
     select
     global.set $core/graphics/graphics/Graphics.scanlineRegister
     br $while-continue|0
    end
   end
  end
  call $core/graphics/lcd/setLcdStatus
 )
 (func $core/serial/serial/updateSerial (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/serial/serial/Serial.transferStartFlag
  i32.eqz
  if
   return
  end
  loop $while-continue|0
   local.get $3
   local.get $0
   i32.lt_s
   if
    local.get $3
    i32.const 4
    i32.add
    local.set $3
    global.get $core/serial/serial/Serial.currentCycles
    local.tee $2
    i32.const 4
    i32.add
    local.tee $1
    i32.const 65535
    i32.gt_s
    if
     local.get $1
     i32.const 65536
     i32.sub
     local.set $1
    end
    local.get $1
    global.set $core/serial/serial/Serial.currentCycles
    local.get $2
    i32.const 1
    i32.const 2
    i32.const 7
    global.get $core/serial/serial/Serial.isClockSpeedFast
    select
    local.tee $2
    i32.shl
    i32.and
    if (result i32)
     local.get $1
     i32.const 1
     local.get $2
     i32.shl
     i32.and
     i32.eqz
    else
     i32.const 0
    end
    if
     i32.const 65281
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     i32.load8_u
     i32.const 1
     i32.shl
     i32.const 1
     i32.add
     i32.const 255
     i32.and
     local.set $1
     i32.const 65281
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     local.get $1
     i32.store8
     global.get $core/serial/serial/Serial.numberOfBitsTransferred
     i32.const 1
     i32.add
     local.tee $1
     i32.const 8
     i32.eq
     if
      i32.const 0
      global.set $core/serial/serial/Serial.numberOfBitsTransferred
      i32.const 1
      global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
      i32.const 3
      call $core/interrupts/interrupts/_requestInterrupt
      i32.const 65282
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      i32.const -129
      i32.and
      local.set $1
      i32.const 65282
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      local.get $1
      i32.store8
      i32.const 0
      global.set $core/serial/serial/Serial.transferStartFlag
     else
      local.get $1
      global.set $core/serial/serial/Serial.numberOfBitsTransferred
     end
    end
    br $while-continue|0
   end
  end
 )
 (func $core/cycles/syncCycles (param $0 i32)
  (local $1 i32)
  global.get $core/memory/memory/Memory.DMACycles
  i32.const 0
  i32.gt_s
  if
   local.get $0
   global.get $core/memory/memory/Memory.DMACycles
   i32.add
   local.set $0
   i32.const 0
   global.set $core/memory/memory/Memory.DMACycles
  end
  local.get $0
  global.get $core/cpu/cpu/Cpu.currentCycles
  i32.add
  global.set $core/cpu/cpu/Cpu.currentCycles
  global.get $core/cpu/cpu/Cpu.isStopped
  i32.eqz
  if
   global.get $core/config/Config.graphicsBatchProcessing
   if
    local.get $0
    global.get $core/graphics/graphics/Graphics.currentCycles
    i32.add
    global.set $core/graphics/graphics/Graphics.currentCycles
    i32.const 4
    global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
    local.tee $1
    i32.shl
    i32.const 456
    local.get $1
    i32.shl
    global.get $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 153
    i32.eq
    select
    local.set $1
    loop $while-continue|0
     global.get $core/graphics/graphics/Graphics.currentCycles
     local.get $1
     i32.ge_s
     if
      local.get $1
      call $core/graphics/graphics/updateGraphics
      global.get $core/graphics/graphics/Graphics.currentCycles
      local.get $1
      i32.sub
      global.set $core/graphics/graphics/Graphics.currentCycles
      br $while-continue|0
     end
    end
   else
    local.get $0
    call $core/graphics/graphics/updateGraphics
   end
   global.get $core/config/Config.audioBatchProcessing
   if
    local.get $0
    global.get $core/sound/sound/Sound.currentCycles
    i32.add
    global.set $core/sound/sound/Sound.currentCycles
    call $core/sound/sound/batchProcessAudio
   else
    local.get $0
    call $core/sound/sound/updateFrameSequencer
    i32.eqz
    i32.const 0
    global.get $core/config/Config.audioAccumulateSamples
    select
    if
     local.get $0
     call $core/sound/accumulator/accumulateSound
    else
     local.get $0
     call $core/sound/sound/calculateSound
    end
   end
   local.get $0
   call $core/serial/serial/updateSerial
  end
  global.get $core/config/Config.timersBatchProcessing
  if
   local.get $0
   global.get $core/timers/timers/Timers.currentCycles
   i32.add
   global.set $core/timers/timers/Timers.currentCycles
   global.get $core/timers/timers/Timers.currentCycles
   call $core/timers/timers/updateTimers
   i32.const 0
   global.set $core/timers/timers/Timers.currentCycles
  else
   local.get $0
   call $core/timers/timers/updateTimers
  end
  local.get $0
  global.get $core/cycles/Cycles.cycles
  i32.add
  local.tee $0
  global.get $core/cycles/Cycles.cyclesPerCycleSet
  i32.ge_s
  if (result i32)
   global.get $core/cycles/Cycles.cycleSets
   i32.const 1
   i32.add
   global.set $core/cycles/Cycles.cycleSets
   local.get $0
   global.get $core/cycles/Cycles.cyclesPerCycleSet
   i32.sub
  else
   local.get $0
  end
  global.set $core/cycles/Cycles.cycles
 )
 (func $core/cpu/opcodes/getConcatenatedDataByte (result i32)
  (local $0 i32)
  i32.const 4
  call $core/cycles/syncCycles
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.const 8
  i32.shl
  i32.const 4
  call $core/cycles/syncCycles
  global.get $core/cpu/cpu/Cpu.programCounter
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.or
 )
 (func $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $1
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_u
  local.set $2
  local.get $0
  local.get $1
  i32.const 255
  i32.and
  local.tee $1
  call $core/memory/writeTraps/checkWriteTraps
  if
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $1
   i32.store8
  end
  local.get $0
  i32.const 1
  i32.add
  local.tee $0
  local.get $2
  call $core/memory/writeTraps/checkWriteTraps
  if
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   local.get $2
   i32.store8
  end
 )
 (func $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $2
  if
   local.get $1
   local.get $0
   i32.const 65535
   i32.and
   local.tee $0
   i32.xor
   local.get $0
   local.get $1
   i32.add
   i32.xor
   local.tee $0
   i32.const 16
   i32.and
   i32.const 0
   i32.ne
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
   local.get $0
   i32.const 256
   i32.and
   i32.const 0
   i32.ne
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  else
   local.get $0
   local.get $1
   i32.add
   i32.const 65535
   i32.and
   local.tee $2
   local.get $0
   i32.const 65535
   i32.and
   i32.lt_u
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
   local.get $2
   local.get $0
   local.get $1
   i32.xor
   i32.xor
   i32.const 4096
   i32.and
   i32.const 0
   i32.ne
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  end
 )
 (func $core/cpu/opcodes/handleOpcode0x (param $0 i32) (result i32)
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
                       local.get $0
                       br_table $folding-inner3 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                      end
                      call $core/cpu/opcodes/getConcatenatedDataByte
                      i32.const 65535
                      i32.and
                      local.tee $0
                      i32.const 65280
                      i32.and
                      i32.const 8
                      i32.shr_u
                      global.set $core/cpu/cpu/Cpu.registerB
                      local.get $0
                      i32.const 255
                      i32.and
                      global.set $core/cpu/cpu/Cpu.registerC
                      br $folding-inner0
                     end
                     global.get $core/cpu/cpu/Cpu.registerC
                     i32.const 255
                     i32.and
                     global.get $core/cpu/cpu/Cpu.registerB
                     i32.const 255
                     i32.and
                     i32.const 8
                     i32.shl
                     i32.or
                     global.get $core/cpu/cpu/Cpu.registerA
                     i32.const 4
                     call $core/cycles/syncCycles
                     call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                     br $folding-inner3
                    end
                    global.get $core/cpu/cpu/Cpu.registerC
                    i32.const 255
                    i32.and
                    global.get $core/cpu/cpu/Cpu.registerB
                    i32.const 255
                    i32.and
                    i32.const 8
                    i32.shl
                    i32.or
                    i32.const 1
                    i32.add
                    i32.const 65535
                    i32.and
                    local.set $0
                    br $folding-inner4
                   end
                   global.get $core/cpu/cpu/Cpu.registerB
                   local.tee $0
                   i32.const 15
                   i32.and
                   i32.const 1
                   i32.add
                   i32.const 16
                   i32.and
                   i32.const 0
                   i32.ne
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 32
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 223
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   local.get $0
                   i32.const 1
                   i32.add
                   i32.const 255
                   i32.and
                   local.tee $0
                   global.set $core/cpu/cpu/Cpu.registerB
                   local.get $0
                   i32.eqz
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 128
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 127
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 191
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   br $folding-inner3
                  end
                  i32.const 1
                  global.get $core/cpu/cpu/Cpu.registerB
                  local.tee $0
                  i32.const 15
                  i32.and
                  i32.gt_u
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 32
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 223
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  local.get $0
                  i32.const 1
                  i32.sub
                  i32.const 255
                  i32.and
                  local.tee $0
                  global.set $core/cpu/cpu/Cpu.registerB
                  local.get $0
                  i32.eqz
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 128
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 127
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 64
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  br $folding-inner3
                 end
                 i32.const 4
                 call $core/cycles/syncCycles
                 global.get $core/cpu/cpu/Cpu.programCounter
                 call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                 i32.load8_u
                 global.set $core/cpu/cpu/Cpu.registerB
                 br $folding-inner1
                end
                global.get $core/cpu/cpu/Cpu.registerA
                local.tee $0
                i32.const 128
                i32.and
                i32.const 128
                i32.eq
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 16
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 239
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                local.get $0
                i32.const 1
                i32.shl
                local.get $0
                i32.const 255
                i32.and
                i32.const 7
                i32.shr_u
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerA
                br $folding-inner2
               end
               call $core/cpu/opcodes/getConcatenatedDataByte
               i32.const 65535
               i32.and
               global.get $core/cpu/cpu/Cpu.stackPointer
               i32.const 8
               call $core/cycles/syncCycles
               call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              i32.const 255
              i32.and
              global.get $core/cpu/cpu/Cpu.registerH
              i32.const 255
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.tee $0
              global.get $core/cpu/cpu/Cpu.registerC
              i32.const 255
              i32.and
              global.get $core/cpu/cpu/Cpu.registerB
              i32.const 255
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.tee $1
              i32.const 0
              call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
              local.get $0
              local.get $1
              i32.add
              i32.const 65535
              i32.and
              local.tee $0
              i32.const 65280
              i32.and
              i32.const 8
              i32.shr_u
              global.set $core/cpu/cpu/Cpu.registerH
              local.get $0
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerL
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 191
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              i32.const 8
              return
             end
             global.get $core/cpu/cpu/Cpu.registerC
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerB
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             i32.const 4
             call $core/cycles/syncCycles
             call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerA
             br $folding-inner3
            end
            global.get $core/cpu/cpu/Cpu.registerC
            i32.const 255
            i32.and
            global.get $core/cpu/cpu/Cpu.registerB
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            i32.const 1
            i32.sub
            i32.const 65535
            i32.and
            local.set $0
            br $folding-inner4
           end
           global.get $core/cpu/cpu/Cpu.registerC
           local.tee $0
           i32.const 15
           i32.and
           i32.const 1
           i32.add
           i32.const 16
           i32.and
           i32.const 0
           i32.ne
           i32.const 0
           i32.gt_u
           if
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 32
            i32.or
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
           else
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 223
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
           end
           local.get $0
           i32.const 1
           i32.add
           i32.const 255
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.registerC
           local.get $0
           i32.eqz
           i32.const 0
           i32.gt_u
           if
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 128
            i32.or
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
           else
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 127
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
           end
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 191
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
           br $folding-inner3
          end
          i32.const 1
          global.get $core/cpu/cpu/Cpu.registerC
          local.tee $0
          i32.const 15
          i32.and
          i32.gt_u
          i32.const 0
          i32.gt_u
          if
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 32
           i32.or
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          else
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 223
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          end
          local.get $0
          i32.const 1
          i32.sub
          i32.const 255
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.registerC
          local.get $0
          i32.eqz
          i32.const 0
          i32.gt_u
          if
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 128
           i32.or
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          else
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 127
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          end
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 64
          i32.or
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          br $folding-inner3
         end
         i32.const 4
         call $core/cycles/syncCycles
         global.get $core/cpu/cpu/Cpu.programCounter
         call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
         i32.load8_u
         global.set $core/cpu/cpu/Cpu.registerC
         br $folding-inner1
        end
        global.get $core/cpu/cpu/Cpu.registerA
        local.tee $0
        i32.const 1
        i32.and
        i32.const 0
        i32.gt_u
        i32.const 0
        i32.gt_u
        if
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 16
         i32.or
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        else
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 239
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        end
        local.get $0
        i32.const 7
        i32.shl
        local.get $0
        i32.const 255
        i32.and
        i32.const 1
        i32.shr_u
        i32.or
        i32.const 255
        i32.and
        global.set $core/cpu/cpu/Cpu.registerA
        br $folding-inner2
       end
       i32.const -1
       return
      end
      global.get $core/cpu/cpu/Cpu.programCounter
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      global.set $core/cpu/cpu/Cpu.programCounter
      br $folding-inner3
     end
     global.get $core/cpu/cpu/Cpu.programCounter
     i32.const 1
     i32.add
     i32.const 65535
     i32.and
     global.set $core/cpu/cpu/Cpu.programCounter
     br $folding-inner3
    end
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 127
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 191
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
   i32.const 4
   return
  end
  local.get $0
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_u
  global.set $core/cpu/cpu/Cpu.registerB
  local.get $0
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerC
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcode1x (param $0 i32) (result i32)
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
                      block $case0|0
                       local.get $0
                       i32.const 16
                       i32.sub
                       br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                      end
                      global.get $core/cpu/cpu/Cpu.GBCEnabled
                      if
                       i32.const 4
                       call $core/cycles/syncCycles
                       i32.const 65357
                       call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
                       i32.const 255
                       i32.and
                       local.tee $0
                       local.set $1
                       local.get $0
                       i32.const 1
                       i32.and
                       if
                        local.get $1
                        i32.const -2
                        i32.and
                        local.tee $0
                        i32.const 128
                        i32.and
                        if (result i32)
                         i32.const 0
                         global.set $core/cpu/cpu/Cpu.GBCDoubleSpeed
                         local.get $0
                         i32.const -129
                         i32.and
                        else
                         i32.const 1
                         global.set $core/cpu/cpu/Cpu.GBCDoubleSpeed
                         local.get $0
                         i32.const 128
                         i32.or
                        end
                        local.set $0
                        i32.const 4
                        call $core/cycles/syncCycles
                        i32.const 65357
                        local.get $0
                        call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                        i32.const 68
                        return
                       end
                      end
                      i32.const 1
                      global.set $core/cpu/cpu/Cpu.isStopped
                      br $folding-inner0
                     end
                     call $core/cpu/opcodes/getConcatenatedDataByte
                     i32.const 65535
                     i32.and
                     local.tee $0
                     i32.const 65280
                     i32.and
                     i32.const 8
                     i32.shr_u
                     global.set $core/cpu/cpu/Cpu.registerD
                     local.get $0
                     i32.const 255
                     i32.and
                     global.set $core/cpu/cpu/Cpu.registerE
                     global.get $core/cpu/cpu/Cpu.programCounter
                     i32.const 2
                     i32.add
                     i32.const 65535
                     i32.and
                     global.set $core/cpu/cpu/Cpu.programCounter
                     br $folding-inner2
                    end
                    global.get $core/cpu/cpu/Cpu.registerE
                    i32.const 255
                    i32.and
                    global.get $core/cpu/cpu/Cpu.registerD
                    i32.const 255
                    i32.and
                    i32.const 8
                    i32.shl
                    i32.or
                    global.get $core/cpu/cpu/Cpu.registerA
                    i32.const 4
                    call $core/cycles/syncCycles
                    call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                    br $folding-inner2
                   end
                   global.get $core/cpu/cpu/Cpu.registerE
                   i32.const 255
                   i32.and
                   global.get $core/cpu/cpu/Cpu.registerD
                   i32.const 255
                   i32.and
                   i32.const 8
                   i32.shl
                   i32.or
                   i32.const 1
                   i32.add
                   i32.const 65535
                   i32.and
                   local.set $0
                   br $folding-inner3
                  end
                  global.get $core/cpu/cpu/Cpu.registerD
                  local.tee $0
                  i32.const 15
                  i32.and
                  i32.const 1
                  i32.add
                  i32.const 16
                  i32.and
                  i32.const 0
                  i32.ne
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 32
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 223
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  local.get $0
                  i32.const 1
                  i32.add
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerD
                  global.get $core/cpu/cpu/Cpu.registerD
                  i32.eqz
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 128
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 127
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 191
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  br $folding-inner2
                 end
                 i32.const 1
                 global.get $core/cpu/cpu/Cpu.registerD
                 local.tee $0
                 i32.const 15
                 i32.and
                 i32.gt_u
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 32
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 223
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 local.get $0
                 i32.const 1
                 i32.sub
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerD
                 global.get $core/cpu/cpu/Cpu.registerD
                 i32.eqz
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 128
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 127
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 64
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 br $folding-inner2
                end
                i32.const 4
                call $core/cycles/syncCycles
                global.get $core/cpu/cpu/Cpu.programCounter
                call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                i32.load8_u
                global.set $core/cpu/cpu/Cpu.registerD
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerA
               local.tee $1
               i32.const 128
               i32.and
               i32.const 128
               i32.eq
               local.set $0
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 4
               i32.shr_u
               i32.const 1
               i32.and
               local.get $1
               i32.const 1
               i32.shl
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerA
               br $folding-inner1
              end
              i32.const 4
              call $core/cycles/syncCycles
              global.get $core/cpu/cpu/Cpu.programCounter
              call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
              i32.load8_u
              local.set $0
              global.get $core/cpu/cpu/Cpu.programCounter
              local.get $0
              i32.const 24
              i32.shl
              i32.const 24
              i32.shr_s
              i32.add
              i32.const 65535
              i32.and
              i32.const 1
              i32.add
              i32.const 65535
              i32.and
              global.set $core/cpu/cpu/Cpu.programCounter
              i32.const 8
              return
             end
             global.get $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             local.tee $0
             global.get $core/cpu/cpu/Cpu.registerE
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerD
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             local.tee $1
             i32.const 0
             call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
             local.get $0
             local.get $1
             i32.add
             i32.const 65535
             i32.and
             local.tee $0
             i32.const 65280
             i32.and
             i32.const 8
             i32.shr_u
             global.set $core/cpu/cpu/Cpu.registerH
             local.get $0
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerL
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 191
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             i32.const 8
             return
            end
            global.get $core/cpu/cpu/Cpu.registerE
            i32.const 255
            i32.and
            global.get $core/cpu/cpu/Cpu.registerD
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            i32.const 4
            call $core/cycles/syncCycles
            call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerA
            br $folding-inner2
           end
           global.get $core/cpu/cpu/Cpu.registerE
           i32.const 255
           i32.and
           global.get $core/cpu/cpu/Cpu.registerD
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           i32.const 1
           i32.sub
           i32.const 65535
           i32.and
           local.set $0
           br $folding-inner3
          end
          global.get $core/cpu/cpu/Cpu.registerE
          local.tee $0
          i32.const 15
          i32.and
          i32.const 1
          i32.add
          i32.const 16
          i32.and
          i32.const 0
          i32.ne
          i32.const 0
          i32.gt_u
          if
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 32
           i32.or
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          else
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 223
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          end
          local.get $0
          i32.const 1
          i32.add
          i32.const 255
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.registerE
          local.get $0
          i32.eqz
          i32.const 0
          i32.gt_u
          if
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 128
           i32.or
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          else
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 127
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          end
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 191
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          br $folding-inner2
         end
         i32.const 1
         global.get $core/cpu/cpu/Cpu.registerE
         local.tee $0
         i32.const 15
         i32.and
         i32.gt_u
         i32.const 0
         i32.gt_u
         if
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 32
          i32.or
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         else
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 223
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         end
         local.get $0
         i32.const 1
         i32.sub
         i32.const 255
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.registerE
         local.get $0
         i32.eqz
         i32.const 0
         i32.gt_u
         if
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 128
          i32.or
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         else
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 127
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         end
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 64
         i32.or
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
         br $folding-inner2
        end
        i32.const 4
        call $core/cycles/syncCycles
        global.get $core/cpu/cpu/Cpu.programCounter
        call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
        i32.load8_u
        global.set $core/cpu/cpu/Cpu.registerE
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerA
       local.tee $1
       i32.const 1
       i32.and
       local.set $0
       global.get $core/cpu/cpu/Cpu.registerF
       i32.const 4
       i32.shr_u
       i32.const 1
       i32.and
       i32.const 7
       i32.shl
       local.get $1
       i32.const 255
       i32.and
       i32.const 1
       i32.shr_u
       i32.or
       global.set $core/cpu/cpu/Cpu.registerA
       br $folding-inner1
      end
      i32.const -1
      return
     end
     global.get $core/cpu/cpu/Cpu.programCounter
     i32.const 1
     i32.add
     i32.const 65535
     i32.and
     global.set $core/cpu/cpu/Cpu.programCounter
     br $folding-inner2
    end
    local.get $0
    i32.const 0
    i32.gt_s
    if
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 16
     i32.or
     i32.const 255
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
    else
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 239
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
    end
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 127
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 191
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
   i32.const 4
   return
  end
  local.get $0
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_u
  global.set $core/cpu/cpu/Cpu.registerD
  local.get $0
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerE
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcode2x (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
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
                     block $case0|0
                      local.get $0
                      i32.const 32
                      i32.sub
                      br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                     end
                     global.get $core/cpu/cpu/Cpu.registerF
                     i32.const 7
                     i32.shr_u
                     i32.const 1
                     i32.and
                     if
                      global.get $core/cpu/cpu/Cpu.programCounter
                      i32.const 1
                      i32.add
                      i32.const 65535
                      i32.and
                      global.set $core/cpu/cpu/Cpu.programCounter
                     else
                      i32.const 4
                      call $core/cycles/syncCycles
                      global.get $core/cpu/cpu/Cpu.programCounter
                      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                      i32.load8_u
                      local.set $0
                      global.get $core/cpu/cpu/Cpu.programCounter
                      local.get $0
                      i32.const 24
                      i32.shl
                      i32.const 24
                      i32.shr_s
                      i32.add
                      i32.const 65535
                      i32.and
                      i32.const 1
                      i32.add
                      i32.const 65535
                      i32.and
                      global.set $core/cpu/cpu/Cpu.programCounter
                     end
                     i32.const 8
                     return
                    end
                    call $core/cpu/opcodes/getConcatenatedDataByte
                    i32.const 65535
                    i32.and
                    local.tee $0
                    i32.const 65280
                    i32.and
                    i32.const 8
                    i32.shr_u
                    global.set $core/cpu/cpu/Cpu.registerH
                    local.get $0
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerL
                    global.get $core/cpu/cpu/Cpu.programCounter
                    i32.const 2
                    i32.add
                    i32.const 65535
                    i32.and
                    global.set $core/cpu/cpu/Cpu.programCounter
                    br $folding-inner1
                   end
                   global.get $core/cpu/cpu/Cpu.registerL
                   i32.const 255
                   i32.and
                   global.get $core/cpu/cpu/Cpu.registerH
                   i32.const 255
                   i32.and
                   i32.const 8
                   i32.shl
                   i32.or
                   local.set $0
                   global.get $core/cpu/cpu/Cpu.registerA
                   local.set $1
                   i32.const 4
                   call $core/cycles/syncCycles
                   local.get $0
                   local.get $1
                   call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                   local.get $0
                   i32.const 1
                   i32.add
                   i32.const 65535
                   i32.and
                   local.tee $0
                   i32.const 65280
                   i32.and
                   i32.const 8
                   i32.shr_u
                   global.set $core/cpu/cpu/Cpu.registerH
                   local.get $0
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerL
                   br $folding-inner1
                  end
                  global.get $core/cpu/cpu/Cpu.registerL
                  i32.const 255
                  i32.and
                  global.get $core/cpu/cpu/Cpu.registerH
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  i32.const 1
                  i32.add
                  i32.const 65535
                  i32.and
                  local.set $0
                  br $folding-inner2
                 end
                 global.get $core/cpu/cpu/Cpu.registerH
                 local.tee $0
                 i32.const 15
                 i32.and
                 i32.const 1
                 i32.add
                 i32.const 16
                 i32.and
                 i32.const 0
                 i32.ne
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 32
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 223
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 local.get $0
                 i32.const 1
                 i32.add
                 i32.const 255
                 i32.and
                 local.tee $0
                 global.set $core/cpu/cpu/Cpu.registerH
                 local.get $0
                 i32.eqz
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 128
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 127
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 191
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 br $folding-inner1
                end
                i32.const 1
                global.get $core/cpu/cpu/Cpu.registerH
                local.tee $0
                i32.const 15
                i32.and
                i32.gt_u
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 32
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 223
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                local.get $0
                i32.const 1
                i32.sub
                i32.const 255
                i32.and
                local.tee $0
                global.set $core/cpu/cpu/Cpu.registerH
                local.get $0
                i32.eqz
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 128
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 127
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 64
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                br $folding-inner1
               end
               i32.const 4
               call $core/cycles/syncCycles
               global.get $core/cpu/cpu/Cpu.programCounter
               call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
               i32.load8_u
               global.set $core/cpu/cpu/Cpu.registerH
               br $folding-inner0
              end
              i32.const 6
              i32.const 0
              global.get $core/cpu/cpu/Cpu.registerF
              local.tee $2
              i32.const 5
              i32.shr_u
              i32.const 1
              i32.and
              i32.const 0
              i32.gt_u
              select
              local.tee $0
              i32.const 96
              i32.or
              local.get $0
              local.get $2
              i32.const 4
              i32.shr_u
              i32.const 1
              i32.and
              i32.const 0
              i32.gt_u
              select
              local.set $1
              global.get $core/cpu/cpu/Cpu.registerA
              local.set $0
              local.get $2
              i32.const 6
              i32.shr_u
              i32.const 1
              i32.and
              i32.const 0
              i32.gt_u
              if (result i32)
               local.get $0
               local.get $1
               i32.sub
               i32.const 255
               i32.and
              else
               local.get $1
               i32.const 6
               i32.or
               local.get $1
               local.get $0
               i32.const 15
               i32.and
               i32.const 9
               i32.gt_u
               select
               local.tee $1
               i32.const 96
               i32.or
               local.get $1
               local.get $0
               i32.const 153
               i32.gt_u
               select
               local.tee $1
               local.get $0
               i32.add
               i32.const 255
               i32.and
              end
              local.tee $0
              i32.eqz
              i32.const 0
              i32.gt_u
              if
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 128
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              else
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 127
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              end
              local.get $1
              i32.const 96
              i32.and
              i32.const 0
              i32.ne
              i32.const 0
              i32.gt_u
              if
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 16
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              else
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 239
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              end
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 223
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              local.get $0
              global.set $core/cpu/cpu/Cpu.registerA
              br $folding-inner1
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 7
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 0
             i32.gt_u
             if
              i32.const 4
              call $core/cycles/syncCycles
              global.get $core/cpu/cpu/Cpu.programCounter
              call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
              i32.load8_u
              local.set $0
              global.get $core/cpu/cpu/Cpu.programCounter
              local.get $0
              i32.const 24
              i32.shl
              i32.const 24
              i32.shr_s
              i32.add
              i32.const 65535
              i32.and
              i32.const 1
              i32.add
              i32.const 65535
              i32.and
              global.set $core/cpu/cpu/Cpu.programCounter
             else
              global.get $core/cpu/cpu/Cpu.programCounter
              i32.const 1
              i32.add
              i32.const 65535
              i32.and
              global.set $core/cpu/cpu/Cpu.programCounter
             end
             i32.const 8
             return
            end
            global.get $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            global.get $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            local.tee $0
            local.get $0
            i32.const 0
            call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
            local.get $0
            i32.const 1
            i32.shl
            i32.const 65535
            i32.and
            local.tee $0
            i32.const 65280
            i32.and
            i32.const 8
            i32.shr_u
            global.set $core/cpu/cpu/Cpu.registerH
            local.get $0
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerL
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 191
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            i32.const 8
            return
           end
           global.get $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           global.get $core/cpu/cpu/Cpu.registerH
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           local.set $0
           i32.const 4
           call $core/cycles/syncCycles
           local.get $0
           call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerA
           local.get $0
           i32.const 1
           i32.add
           i32.const 65535
           i32.and
           local.tee $0
           i32.const 65280
           i32.and
           i32.const 8
           i32.shr_u
           global.set $core/cpu/cpu/Cpu.registerH
           local.get $0
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerL
           br $folding-inner1
          end
          global.get $core/cpu/cpu/Cpu.registerL
          i32.const 255
          i32.and
          global.get $core/cpu/cpu/Cpu.registerH
          i32.const 255
          i32.and
          i32.const 8
          i32.shl
          i32.or
          i32.const 1
          i32.sub
          i32.const 65535
          i32.and
          local.set $0
          br $folding-inner2
         end
         global.get $core/cpu/cpu/Cpu.registerL
         local.tee $0
         i32.const 15
         i32.and
         i32.const 1
         i32.add
         i32.const 16
         i32.and
         i32.const 0
         i32.ne
         i32.const 0
         i32.gt_u
         if
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 32
          i32.or
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         else
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 223
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         end
         local.get $0
         i32.const 1
         i32.add
         i32.const 255
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.registerL
         local.get $0
         i32.eqz
         i32.const 0
         i32.gt_u
         if
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 128
          i32.or
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         else
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 127
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         end
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 191
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
         br $folding-inner1
        end
        i32.const 1
        global.get $core/cpu/cpu/Cpu.registerL
        local.tee $0
        i32.const 15
        i32.and
        i32.gt_u
        i32.const 0
        i32.gt_u
        if
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 32
         i32.or
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        else
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 223
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        end
        local.get $0
        i32.const 1
        i32.sub
        i32.const 255
        i32.and
        local.tee $0
        global.set $core/cpu/cpu/Cpu.registerL
        local.get $0
        i32.eqz
        i32.const 0
        i32.gt_u
        if
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 128
         i32.or
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        else
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 127
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        end
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 64
        i32.or
        i32.const 255
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
        br $folding-inner1
       end
       i32.const 4
       call $core/cycles/syncCycles
       global.get $core/cpu/cpu/Cpu.programCounter
       call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
       i32.load8_u
       global.set $core/cpu/cpu/Cpu.registerL
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerA
      i32.const -1
      i32.xor
      i32.const 255
      i32.and
      global.set $core/cpu/cpu/Cpu.registerA
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 64
      i32.or
      i32.const 255
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 32
      i32.or
      i32.const 255
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
      br $folding-inner1
     end
     i32.const -1
     return
    end
    global.get $core/cpu/cpu/Cpu.programCounter
    i32.const 1
    i32.add
    i32.const 65535
    i32.and
    global.set $core/cpu/cpu/Cpu.programCounter
   end
   i32.const 4
   return
  end
  local.get $0
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_u
  global.set $core/cpu/cpu/Cpu.registerH
  local.get $0
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerL
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcode3x (param $0 i32) (result i32)
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
                    block $case0|0
                     local.get $0
                     i32.const 48
                     i32.sub
                     br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                    end
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 4
                    i32.shr_u
                    i32.const 1
                    i32.and
                    if
                     global.get $core/cpu/cpu/Cpu.programCounter
                     i32.const 1
                     i32.add
                     i32.const 65535
                     i32.and
                     global.set $core/cpu/cpu/Cpu.programCounter
                    else
                     i32.const 4
                     call $core/cycles/syncCycles
                     global.get $core/cpu/cpu/Cpu.programCounter
                     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                     i32.load8_u
                     local.set $0
                     global.get $core/cpu/cpu/Cpu.programCounter
                     local.get $0
                     i32.const 24
                     i32.shl
                     i32.const 24
                     i32.shr_s
                     i32.add
                     i32.const 65535
                     i32.and
                     i32.const 1
                     i32.add
                     i32.const 65535
                     i32.and
                     global.set $core/cpu/cpu/Cpu.programCounter
                    end
                    i32.const 8
                    return
                   end
                   call $core/cpu/opcodes/getConcatenatedDataByte
                   i32.const 65535
                   i32.and
                   global.set $core/cpu/cpu/Cpu.stackPointer
                   global.get $core/cpu/cpu/Cpu.programCounter
                   i32.const 2
                   i32.add
                   i32.const 65535
                   i32.and
                   global.set $core/cpu/cpu/Cpu.programCounter
                   br $folding-inner1
                  end
                  global.get $core/cpu/cpu/Cpu.registerL
                  i32.const 255
                  i32.and
                  global.get $core/cpu/cpu/Cpu.registerH
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  local.set $0
                  global.get $core/cpu/cpu/Cpu.registerA
                  local.set $1
                  i32.const 4
                  call $core/cycles/syncCycles
                  local.get $0
                  local.get $1
                  call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                  local.get $0
                  i32.const 1
                  i32.sub
                  i32.const 65535
                  i32.and
                  local.tee $0
                  i32.const 65280
                  i32.and
                  i32.const 8
                  i32.shr_u
                  global.set $core/cpu/cpu/Cpu.registerH
                  local.get $0
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerL
                  br $folding-inner1
                 end
                 global.get $core/cpu/cpu/Cpu.stackPointer
                 i32.const 1
                 i32.add
                 i32.const 65535
                 i32.and
                 global.set $core/cpu/cpu/Cpu.stackPointer
                 i32.const 8
                 return
                end
                global.get $core/cpu/cpu/Cpu.registerL
                i32.const 255
                i32.and
                global.get $core/cpu/cpu/Cpu.registerH
                i32.const 255
                i32.and
                i32.const 8
                i32.shl
                i32.or
                i32.const 4
                call $core/cycles/syncCycles
                i32.const 65535
                i32.and
                local.tee $0
                call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
                local.tee $1
                i32.const 15
                i32.and
                i32.const 1
                i32.add
                i32.const 16
                i32.and
                i32.const 0
                i32.ne
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 32
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 223
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                local.get $1
                i32.const 1
                i32.add
                i32.const 255
                i32.and
                local.tee $1
                i32.eqz
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 128
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 127
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 191
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                i32.const 4
                call $core/cycles/syncCycles
                local.get $0
                local.get $1
                call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                br $folding-inner1
               end
               global.get $core/cpu/cpu/Cpu.registerL
               i32.const 255
               i32.and
               global.get $core/cpu/cpu/Cpu.registerH
               i32.const 255
               i32.and
               i32.const 8
               i32.shl
               i32.or
               local.set $0
               i32.const 4
               call $core/cycles/syncCycles
               i32.const 1
               local.get $0
               i32.const 65535
               i32.and
               local.tee $0
               call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
               local.tee $1
               i32.const 15
               i32.and
               i32.gt_u
               i32.const 0
               i32.gt_u
               if
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 32
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               else
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 223
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               end
               local.get $1
               i32.const 1
               i32.sub
               i32.const 255
               i32.and
               local.tee $1
               i32.eqz
               i32.const 0
               i32.gt_u
               if
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 128
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               else
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 127
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               end
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 64
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               i32.const 4
               call $core/cycles/syncCycles
               local.get $0
               local.get $1
               call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
               br $folding-inner1
              end
              global.get $core/cpu/cpu/Cpu.registerL
              i32.const 255
              i32.and
              global.get $core/cpu/cpu/Cpu.registerH
              i32.const 255
              i32.and
              i32.const 8
              i32.shl
              i32.or
              i32.const 4
              call $core/cycles/syncCycles
              global.get $core/cpu/cpu/Cpu.programCounter
              call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
              i32.load8_u
              local.set $1
              i32.const 4
              call $core/cycles/syncCycles
              i32.const 65535
              i32.and
              local.get $1
              i32.const 255
              i32.and
              call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 191
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 223
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 16
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             br $folding-inner1
            end
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 4
            i32.shr_u
            i32.const 1
            i32.and
            if
             i32.const 4
             call $core/cycles/syncCycles
             global.get $core/cpu/cpu/Cpu.programCounter
             call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
             i32.load8_u
             local.set $0
             global.get $core/cpu/cpu/Cpu.programCounter
             local.get $0
             i32.const 24
             i32.shl
             i32.const 24
             i32.shr_s
             i32.add
             i32.const 65535
             i32.and
             i32.const 1
             i32.add
             i32.const 65535
             i32.and
             global.set $core/cpu/cpu/Cpu.programCounter
            else
             global.get $core/cpu/cpu/Cpu.programCounter
             i32.const 1
             i32.add
             i32.const 65535
             i32.and
             global.set $core/cpu/cpu/Cpu.programCounter
            end
            i32.const 8
            return
           end
           global.get $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           global.get $core/cpu/cpu/Cpu.registerH
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           local.tee $0
           global.get $core/cpu/cpu/Cpu.stackPointer
           i32.const 0
           call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
           local.get $0
           global.get $core/cpu/cpu/Cpu.stackPointer
           i32.add
           i32.const 65535
           i32.and
           local.tee $0
           i32.const 65280
           i32.and
           i32.const 8
           i32.shr_u
           global.set $core/cpu/cpu/Cpu.registerH
           local.get $0
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerL
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 191
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
           i32.const 8
           return
          end
          global.get $core/cpu/cpu/Cpu.registerL
          i32.const 255
          i32.and
          global.get $core/cpu/cpu/Cpu.registerH
          i32.const 255
          i32.and
          i32.const 8
          i32.shl
          i32.or
          local.set $0
          i32.const 4
          call $core/cycles/syncCycles
          local.get $0
          call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerA
          local.get $0
          i32.const 1
          i32.sub
          i32.const 65535
          i32.and
          local.tee $0
          i32.const 65280
          i32.and
          i32.const 8
          i32.shr_u
          global.set $core/cpu/cpu/Cpu.registerH
          local.get $0
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerL
          br $folding-inner1
         end
         global.get $core/cpu/cpu/Cpu.stackPointer
         i32.const 1
         i32.sub
         i32.const 65535
         i32.and
         global.set $core/cpu/cpu/Cpu.stackPointer
         i32.const 8
         return
        end
        global.get $core/cpu/cpu/Cpu.registerA
        local.tee $0
        i32.const 15
        i32.and
        i32.const 1
        i32.add
        i32.const 16
        i32.and
        i32.const 0
        i32.ne
        i32.const 0
        i32.gt_u
        if
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 32
         i32.or
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        else
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 223
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        end
        local.get $0
        i32.const 1
        i32.add
        i32.const 255
        i32.and
        local.tee $0
        global.set $core/cpu/cpu/Cpu.registerA
        local.get $0
        i32.eqz
        i32.const 0
        i32.gt_u
        if
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 128
         i32.or
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        else
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 127
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        end
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 191
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
        br $folding-inner1
       end
       i32.const 1
       global.get $core/cpu/cpu/Cpu.registerA
       local.tee $0
       i32.const 15
       i32.and
       i32.gt_u
       i32.const 0
       i32.gt_u
       if
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 32
        i32.or
        i32.const 255
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
       else
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 223
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
       end
       local.get $0
       i32.const 1
       i32.sub
       i32.const 255
       i32.and
       local.tee $0
       global.set $core/cpu/cpu/Cpu.registerA
       local.get $0
       i32.eqz
       i32.const 0
       i32.gt_u
       if
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 128
        i32.or
        i32.const 255
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
       else
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 127
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
       end
       global.get $core/cpu/cpu/Cpu.registerF
       i32.const 64
       i32.or
       i32.const 255
       i32.and
       global.set $core/cpu/cpu/Cpu.registerF
       br $folding-inner1
      end
      i32.const 4
      call $core/cycles/syncCycles
      global.get $core/cpu/cpu/Cpu.programCounter
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      global.set $core/cpu/cpu/Cpu.registerA
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 191
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 223
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 4
     i32.shr_u
     i32.const 1
     i32.and
     i32.const 0
     i32.le_u
     i32.const 0
     i32.gt_u
     if
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 16
      i32.or
      i32.const 255
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
     else
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 239
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
     end
     br $folding-inner1
    end
    i32.const -1
    return
   end
   global.get $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.add
   i32.const 65535
   i32.and
   global.set $core/cpu/cpu/Cpu.programCounter
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode4x (param $0 i32) (result i32)
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
                  local.get $0
                  i32.const -64
                  i32.add
                  br_table $folding-inner0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $folding-inner0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                 end
                 global.get $core/cpu/cpu/Cpu.registerC
                 global.set $core/cpu/cpu/Cpu.registerB
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerD
                global.set $core/cpu/cpu/Cpu.registerB
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerE
               global.set $core/cpu/cpu/Cpu.registerB
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerH
              global.set $core/cpu/cpu/Cpu.registerB
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             global.set $core/cpu/cpu/Cpu.registerB
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            global.get $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            i32.const 4
            call $core/cycles/syncCycles
            call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerB
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerA
           global.set $core/cpu/cpu/Cpu.registerB
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerB
          global.set $core/cpu/cpu/Cpu.registerC
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerD
         global.set $core/cpu/cpu/Cpu.registerC
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerE
        global.set $core/cpu/cpu/Cpu.registerC
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerH
       global.set $core/cpu/cpu/Cpu.registerC
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerL
      global.set $core/cpu/cpu/Cpu.registerC
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
     i32.const 255
     i32.and
     global.set $core/cpu/cpu/Cpu.registerC
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerA
    global.set $core/cpu/cpu/Cpu.registerC
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode5x (param $0 i32) (result i32)
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
                 block $case0|0
                  local.get $0
                  i32.const 80
                  i32.sub
                  br_table $case0|0 $case1|0 $folding-inner0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $folding-inner0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                 end
                 global.get $core/cpu/cpu/Cpu.registerB
                 global.set $core/cpu/cpu/Cpu.registerD
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerC
                global.set $core/cpu/cpu/Cpu.registerD
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerE
               global.set $core/cpu/cpu/Cpu.registerD
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerH
              global.set $core/cpu/cpu/Cpu.registerD
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             global.set $core/cpu/cpu/Cpu.registerD
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            global.get $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            i32.const 4
            call $core/cycles/syncCycles
            call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerD
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerA
           global.set $core/cpu/cpu/Cpu.registerD
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerB
          global.set $core/cpu/cpu/Cpu.registerE
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerC
         global.set $core/cpu/cpu/Cpu.registerE
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerD
        global.set $core/cpu/cpu/Cpu.registerE
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerH
       global.set $core/cpu/cpu/Cpu.registerE
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerL
      global.set $core/cpu/cpu/Cpu.registerE
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
     i32.const 255
     i32.and
     global.set $core/cpu/cpu/Cpu.registerE
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerA
    global.set $core/cpu/cpu/Cpu.registerE
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode6x (param $0 i32) (result i32)
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
                 block $case0|0
                  local.get $0
                  i32.const 96
                  i32.sub
                  br_table $case0|0 $case1|0 $case2|0 $case3|0 $folding-inner0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $folding-inner0 $case14|0 $case15|0 $break|0
                 end
                 global.get $core/cpu/cpu/Cpu.registerB
                 global.set $core/cpu/cpu/Cpu.registerH
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerC
                global.set $core/cpu/cpu/Cpu.registerH
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerD
               global.set $core/cpu/cpu/Cpu.registerH
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerE
              global.set $core/cpu/cpu/Cpu.registerH
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             global.set $core/cpu/cpu/Cpu.registerH
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerL
            i32.const 255
            i32.and
            global.get $core/cpu/cpu/Cpu.registerH
            i32.const 255
            i32.and
            i32.const 8
            i32.shl
            i32.or
            i32.const 4
            call $core/cycles/syncCycles
            call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerH
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerA
           global.set $core/cpu/cpu/Cpu.registerH
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerB
          global.set $core/cpu/cpu/Cpu.registerL
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerC
         global.set $core/cpu/cpu/Cpu.registerL
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerD
        global.set $core/cpu/cpu/Cpu.registerL
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerE
       global.set $core/cpu/cpu/Cpu.registerL
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerH
      global.set $core/cpu/cpu/Cpu.registerL
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
     i32.const 255
     i32.and
     global.set $core/cpu/cpu/Cpu.registerL
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerA
    global.set $core/cpu/cpu/Cpu.registerL
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcode7x (param $0 i32) (result i32)
  (local $1 i32)
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
                  block $case0|0
                   local.get $0
                   i32.const 112
                   i32.sub
                   br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $folding-inner0 $break|0
                  end
                  global.get $core/cpu/cpu/Cpu.registerL
                  i32.const 255
                  i32.and
                  global.get $core/cpu/cpu/Cpu.registerH
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  global.get $core/cpu/cpu/Cpu.registerB
                  i32.const 4
                  call $core/cycles/syncCycles
                  call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerL
                 i32.const 255
                 i32.and
                 global.get $core/cpu/cpu/Cpu.registerH
                 i32.const 255
                 i32.and
                 i32.const 8
                 i32.shl
                 i32.or
                 global.get $core/cpu/cpu/Cpu.registerC
                 i32.const 4
                 call $core/cycles/syncCycles
                 call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerL
                i32.const 255
                i32.and
                global.get $core/cpu/cpu/Cpu.registerH
                i32.const 255
                i32.and
                i32.const 8
                i32.shl
                i32.or
                global.get $core/cpu/cpu/Cpu.registerD
                i32.const 4
                call $core/cycles/syncCycles
                call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerL
               i32.const 255
               i32.and
               global.get $core/cpu/cpu/Cpu.registerH
               i32.const 255
               i32.and
               i32.const 8
               i32.shl
               i32.or
               global.get $core/cpu/cpu/Cpu.registerE
               i32.const 4
               call $core/cycles/syncCycles
               call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              i32.const 255
              i32.and
              global.get $core/cpu/cpu/Cpu.registerH
              local.tee $0
              i32.const 255
              i32.and
              i32.const 8
              i32.shl
              i32.or
              i32.const 4
              call $core/cycles/syncCycles
              local.get $0
              call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             local.tee $0
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             i32.const 4
             call $core/cycles/syncCycles
             local.get $0
             call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
             br $folding-inner0
            end
            global.get $core/memory/memory/Memory.isHblankHdmaActive
            i32.eqz
            if
             block $__inlined_func$core/cpu/cpu/Cpu.enableHalt
              global.get $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
              if
               i32.const 1
               global.set $core/cpu/cpu/Cpu.isHaltNormal
               br $__inlined_func$core/cpu/cpu/Cpu.enableHalt
              end
              global.get $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
              global.get $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
              i32.and
              i32.const 31
              i32.and
              i32.eqz
              if
               i32.const 1
               global.set $core/cpu/cpu/Cpu.isHaltNoJump
               br $__inlined_func$core/cpu/cpu/Cpu.enableHalt
              end
              i32.const 1
              global.set $core/cpu/cpu/Cpu.isHaltBug
             end
            end
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           global.get $core/cpu/cpu/Cpu.registerH
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           global.get $core/cpu/cpu/Cpu.registerA
           i32.const 4
           call $core/cycles/syncCycles
           call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerB
          global.set $core/cpu/cpu/Cpu.registerA
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerC
         global.set $core/cpu/cpu/Cpu.registerA
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerD
        global.set $core/cpu/cpu/Cpu.registerA
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerE
       global.set $core/cpu/cpu/Cpu.registerA
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerH
      global.set $core/cpu/cpu/Cpu.registerA
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     global.set $core/cpu/cpu/Cpu.registerA
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerL
    i32.const 255
    i32.and
    global.get $core/cpu/cpu/Cpu.registerH
    i32.const 255
    i32.and
    i32.const 8
    i32.shl
    i32.or
    i32.const 4
    call $core/cycles/syncCycles
    call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerA
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/instructions/addARegister (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $3
  local.set $4
  local.get $0
  i32.const 255
  i32.and
  local.tee $1
  local.set $2
  local.get $1
  i32.const 0
  i32.ge_u
  if
   local.get $4
   i32.const 15
   i32.and
   local.get $2
   i32.const 15
   i32.and
   i32.add
   i32.const 16
   i32.and
   i32.const 0
   i32.ne
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  else
   local.get $2
   i32.const 31
   i32.shr_u
   local.tee $5
   local.get $2
   local.get $5
   i32.add
   i32.xor
   i32.const 15
   i32.and
   local.get $4
   i32.const 15
   i32.and
   i32.gt_u
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  end
  local.get $1
  i32.const 0
  i32.ge_u
  if
   local.get $3
   i32.const 255
   i32.and
   local.get $1
   local.get $3
   i32.add
   i32.const 255
   i32.and
   i32.gt_u
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  else
   local.get $1
   i32.const 31
   i32.shr_u
   local.tee $2
   local.get $1
   local.get $2
   i32.add
   i32.xor
   local.get $3
   i32.const 255
   i32.and
   i32.gt_s
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  end
  local.get $0
  local.get $3
  i32.add
  i32.const 255
  i32.and
  local.tee $0
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.eqz
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 128
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 127
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 191
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
 )
 (func $core/cpu/instructions/addAThroughCarryRegister (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $1
  i32.add
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.add
  i32.const 255
  i32.and
  local.tee $2
  local.get $0
  local.get $1
  i32.xor
  i32.xor
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 32
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 223
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  local.get $1
  local.get $0
  i32.const 255
  i32.and
  i32.add
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.add
  i32.const 256
  i32.and
  i32.const 0
  i32.gt_u
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 16
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 239
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  local.get $2
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $2
  i32.eqz
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 128
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 127
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 191
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
 )
 (func $core/cpu/opcodes/handleOpcode8x (param $0 i32) (result i32)
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
                   block $case0|0
                    local.get $0
                    i32.const 128
                    i32.sub
                    br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   global.get $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/addARegister
                   br $folding-inner0
                  end
                  global.get $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/addARegister
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/addARegister
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/addARegister
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/addARegister
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/addARegister
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             i32.const 4
             call $core/cycles/syncCycles
             call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
             call $core/cpu/instructions/addARegister
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/addARegister
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/addAThroughCarryRegister
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/addAThroughCarryRegister
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/addAThroughCarryRegister
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/addAThroughCarryRegister
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/addAThroughCarryRegister
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/addAThroughCarryRegister
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
     call $core/cpu/instructions/addAThroughCarryRegister
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/addAThroughCarryRegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/instructions/subARegister (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $3
  local.set $4
  i32.const 0
  local.get $0
  i32.const 255
  i32.and
  i32.sub
  local.tee $1
  local.set $2
  local.get $1
  i32.const 0
  i32.ge_s
  if
   local.get $4
   i32.const 15
   i32.and
   local.get $2
   i32.const 15
   i32.and
   i32.add
   i32.const 16
   i32.and
   i32.const 0
   i32.ne
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  else
   local.get $2
   i32.const 31
   i32.shr_s
   local.tee $5
   local.get $2
   local.get $5
   i32.add
   i32.xor
   i32.const 15
   i32.and
   local.get $4
   i32.const 15
   i32.and
   i32.gt_u
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  end
  local.get $1
  i32.const 0
  i32.ge_s
  if
   local.get $3
   i32.const 255
   i32.and
   local.get $1
   local.get $3
   i32.add
   i32.const 255
   i32.and
   i32.gt_u
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  else
   local.get $1
   i32.const 31
   i32.shr_s
   local.tee $2
   local.get $1
   local.get $2
   i32.add
   i32.xor
   local.get $3
   i32.const 255
   i32.and
   i32.gt_s
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  end
  local.get $3
  local.get $0
  i32.sub
  i32.const 255
  i32.and
  local.tee $0
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.eqz
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 128
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 127
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 64
  i32.or
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
 )
 (func $core/cpu/instructions/subAThroughCarryRegister (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $1
  local.get $0
  i32.sub
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.sub
  i32.const 255
  i32.and
  local.tee $2
  local.get $0
  local.get $1
  i32.xor
  i32.xor
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 32
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 223
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  local.get $1
  local.get $0
  i32.const 255
  i32.and
  i32.sub
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.sub
  i32.const 256
  i32.and
  i32.const 0
  i32.gt_u
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 16
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 239
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  local.get $2
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $2
  i32.eqz
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 128
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 127
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 64
  i32.or
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
 )
 (func $core/cpu/opcodes/handleOpcode9x (param $0 i32) (result i32)
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
                   block $case0|0
                    local.get $0
                    i32.const 144
                    i32.sub
                    br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   global.get $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/subARegister
                   br $folding-inner0
                  end
                  global.get $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/subARegister
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/subARegister
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/subARegister
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/subARegister
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/subARegister
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             i32.const 4
             call $core/cycles/syncCycles
             call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
             call $core/cpu/instructions/subARegister
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/subARegister
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/subAThroughCarryRegister
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/subAThroughCarryRegister
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/subAThroughCarryRegister
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/subAThroughCarryRegister
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/subAThroughCarryRegister
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/subAThroughCarryRegister
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
     call $core/cpu/instructions/subAThroughCarryRegister
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/subAThroughCarryRegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcodeAx (param $0 i32) (result i32)
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
                   block $case0|0
                    local.get $0
                    i32.const 160
                    i32.sub
                    br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   global.get $core/cpu/cpu/Cpu.registerB
                   global.get $core/cpu/cpu/Cpu.registerA
                   i32.and
                   local.tee $0
                   global.set $core/cpu/cpu/Cpu.registerA
                   local.get $0
                   i32.eqz
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 128
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 127
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 191
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 32
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   br $folding-inner0
                  end
                  global.get $core/cpu/cpu/Cpu.registerC
                  global.get $core/cpu/cpu/Cpu.registerA
                  i32.and
                  local.tee $0
                  global.set $core/cpu/cpu/Cpu.registerA
                  local.get $0
                  i32.eqz
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 128
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 127
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 191
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 32
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerD
                 global.get $core/cpu/cpu/Cpu.registerA
                 i32.and
                 local.tee $0
                 global.set $core/cpu/cpu/Cpu.registerA
                 local.get $0
                 i32.eqz
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 128
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 127
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 191
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 32
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerE
                global.get $core/cpu/cpu/Cpu.registerA
                i32.and
                local.tee $0
                global.set $core/cpu/cpu/Cpu.registerA
                local.get $0
                i32.eqz
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 128
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 127
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 191
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 32
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerH
               global.get $core/cpu/cpu/Cpu.registerA
               i32.and
               local.tee $0
               global.set $core/cpu/cpu/Cpu.registerA
               local.get $0
               i32.eqz
               i32.const 0
               i32.gt_u
               if
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 128
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               else
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 127
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               end
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 191
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 32
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              global.get $core/cpu/cpu/Cpu.registerA
              i32.and
              local.tee $0
              global.set $core/cpu/cpu/Cpu.registerA
              local.get $0
              i32.eqz
              i32.const 0
              i32.gt_u
              if
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 128
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              else
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 127
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              end
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 191
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 32
              i32.or
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             i32.const 4
             call $core/cycles/syncCycles
             call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
             global.get $core/cpu/cpu/Cpu.registerA
             i32.and
             local.tee $0
             global.set $core/cpu/cpu/Cpu.registerA
             local.get $0
             i32.eqz
             i32.const 0
             i32.gt_u
             if
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 128
              i32.or
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             else
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 127
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 191
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 32
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerA
            local.tee $0
            global.set $core/cpu/cpu/Cpu.registerA
            local.get $0
            i32.eqz
            i32.const 0
            i32.gt_u
            if
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 128
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            else
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 127
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            end
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 191
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 32
            i32.or
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerB
           global.get $core/cpu/cpu/Cpu.registerA
           i32.xor
           i32.const 255
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.registerA
           local.get $0
           i32.eqz
           i32.const 0
           i32.gt_u
           if
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 128
            i32.or
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
           else
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 127
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
           end
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 191
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 223
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerC
          global.get $core/cpu/cpu/Cpu.registerA
          i32.xor
          i32.const 255
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.registerA
          local.get $0
          i32.eqz
          i32.const 0
          i32.gt_u
          if
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 128
           i32.or
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          else
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 127
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          end
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 191
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 223
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerD
         global.get $core/cpu/cpu/Cpu.registerA
         i32.xor
         i32.const 255
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.registerA
         local.get $0
         i32.eqz
         i32.const 0
         i32.gt_u
         if
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 128
          i32.or
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         else
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 127
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
         end
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 191
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 223
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerE
        global.get $core/cpu/cpu/Cpu.registerA
        i32.xor
        i32.const 255
        i32.and
        local.tee $0
        global.set $core/cpu/cpu/Cpu.registerA
        local.get $0
        i32.eqz
        i32.const 0
        i32.gt_u
        if
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 128
         i32.or
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        else
         global.get $core/cpu/cpu/Cpu.registerF
         i32.const 127
         i32.and
         global.set $core/cpu/cpu/Cpu.registerF
        end
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 191
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 223
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerH
       global.get $core/cpu/cpu/Cpu.registerA
       i32.xor
       i32.const 255
       i32.and
       local.tee $0
       global.set $core/cpu/cpu/Cpu.registerA
       local.get $0
       i32.eqz
       i32.const 0
       i32.gt_u
       if
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 128
        i32.or
        i32.const 255
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
       else
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 127
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
       end
       global.get $core/cpu/cpu/Cpu.registerF
       i32.const 191
       i32.and
       global.set $core/cpu/cpu/Cpu.registerF
       global.get $core/cpu/cpu/Cpu.registerF
       i32.const 223
       i32.and
       global.set $core/cpu/cpu/Cpu.registerF
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerL
      global.get $core/cpu/cpu/Cpu.registerA
      i32.xor
      i32.const 255
      i32.and
      local.tee $0
      global.set $core/cpu/cpu/Cpu.registerA
      local.get $0
      i32.eqz
      i32.const 0
      i32.gt_u
      if
       global.get $core/cpu/cpu/Cpu.registerF
       i32.const 128
       i32.or
       i32.const 255
       i32.and
       global.set $core/cpu/cpu/Cpu.registerF
      else
       global.get $core/cpu/cpu/Cpu.registerF
       i32.const 127
       i32.and
       global.set $core/cpu/cpu/Cpu.registerF
      end
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 191
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 223
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
     global.get $core/cpu/cpu/Cpu.registerA
     i32.xor
     i32.const 255
     i32.and
     local.tee $0
     global.set $core/cpu/cpu/Cpu.registerA
     local.get $0
     i32.eqz
     i32.const 0
     i32.gt_u
     if
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 128
      i32.or
      i32.const 255
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
     else
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 127
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
     end
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 191
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 223
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
     br $folding-inner0
    end
    i32.const 0
    global.set $core/cpu/cpu/Cpu.registerA
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 128
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 191
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
    br $folding-inner0
   end
   i32.const -1
   return
  end
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 239
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
  i32.const 4
 )
 (func $core/cpu/instructions/cpARegister (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $2
  local.set $3
  i32.const 0
  local.get $0
  i32.const 255
  i32.and
  i32.sub
  local.tee $0
  local.set $1
  local.get $0
  i32.const 0
  i32.ge_s
  if
   local.get $3
   i32.const 15
   i32.and
   local.get $1
   i32.const 15
   i32.and
   i32.add
   i32.const 16
   i32.and
   i32.const 0
   i32.ne
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  else
   local.get $1
   i32.const 31
   i32.shr_s
   local.tee $4
   local.get $1
   local.get $4
   i32.add
   i32.xor
   i32.const 15
   i32.and
   local.get $3
   i32.const 15
   i32.and
   i32.gt_u
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 32
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 223
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  end
  local.get $0
  i32.const 0
  i32.ge_s
  if
   local.get $2
   i32.const 255
   i32.and
   local.get $0
   local.get $2
   i32.add
   i32.const 255
   i32.and
   i32.gt_u
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  else
   local.get $0
   i32.const 31
   i32.shr_s
   local.tee $1
   local.get $0
   local.get $1
   i32.add
   i32.xor
   local.get $2
   i32.const 255
   i32.and
   i32.gt_s
   i32.const 0
   i32.gt_u
   if
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 16
    i32.or
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   else
    global.get $core/cpu/cpu/Cpu.registerF
    i32.const 239
    i32.and
    global.set $core/cpu/cpu/Cpu.registerF
   end
  end
  local.get $0
  local.get $2
  i32.add
  i32.eqz
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 128
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   i32.const 127
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 64
  i32.or
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
 )
 (func $core/cpu/opcodes/handleOpcodeBx (param $0 i32) (result i32)
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
                   block $case0|0
                    local.get $0
                    i32.const 176
                    i32.sub
                    br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                   end
                   global.get $core/cpu/cpu/Cpu.registerB
                   global.get $core/cpu/cpu/Cpu.registerA
                   i32.or
                   i32.const 255
                   i32.and
                   local.tee $0
                   global.set $core/cpu/cpu/Cpu.registerA
                   local.get $0
                   i32.eqz
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 128
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 127
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 191
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 223
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 239
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   br $folding-inner0
                  end
                  global.get $core/cpu/cpu/Cpu.registerC
                  global.get $core/cpu/cpu/Cpu.registerA
                  i32.or
                  i32.const 255
                  i32.and
                  local.tee $0
                  global.set $core/cpu/cpu/Cpu.registerA
                  local.get $0
                  i32.eqz
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 128
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 127
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 191
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 223
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 239
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerD
                 global.get $core/cpu/cpu/Cpu.registerA
                 i32.or
                 i32.const 255
                 i32.and
                 local.tee $0
                 global.set $core/cpu/cpu/Cpu.registerA
                 local.get $0
                 i32.eqz
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 128
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 127
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 191
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 223
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 239
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerE
                global.get $core/cpu/cpu/Cpu.registerA
                i32.or
                i32.const 255
                i32.and
                local.tee $0
                global.set $core/cpu/cpu/Cpu.registerA
                local.get $0
                i32.eqz
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 128
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 127
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 191
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 223
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 239
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerH
               global.get $core/cpu/cpu/Cpu.registerA
               i32.or
               i32.const 255
               i32.and
               local.tee $0
               global.set $core/cpu/cpu/Cpu.registerA
               local.get $0
               i32.eqz
               i32.const 0
               i32.gt_u
               if
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 128
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               else
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 127
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               end
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 191
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 223
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 239
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              global.get $core/cpu/cpu/Cpu.registerA
              i32.or
              i32.const 255
              i32.and
              local.tee $0
              global.set $core/cpu/cpu/Cpu.registerA
              local.get $0
              i32.eqz
              i32.const 0
              i32.gt_u
              if
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 128
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              else
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 127
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              end
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 191
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 223
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 239
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.registerL
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerH
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             i32.const 4
             call $core/cycles/syncCycles
             call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
             global.get $core/cpu/cpu/Cpu.registerA
             i32.or
             i32.const 255
             i32.and
             local.tee $0
             global.set $core/cpu/cpu/Cpu.registerA
             local.get $0
             i32.eqz
             i32.const 0
             i32.gt_u
             if
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 128
              i32.or
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             else
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 127
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 191
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 223
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 239
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerA
            i32.const 255
            i32.and
            local.tee $0
            global.set $core/cpu/cpu/Cpu.registerA
            local.get $0
            i32.eqz
            i32.const 0
            i32.gt_u
            if
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 128
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            else
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 127
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            end
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 191
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 223
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 239
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/cpARegister
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/cpARegister
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/cpARegister
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/cpARegister
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/cpARegister
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/cpARegister
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
     call $core/cpu/instructions/cpARegister
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/cpARegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/memory/load/sixteenBitLoadFromGBMemory (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  call $core/memory/readTraps/checkReadTraps
  local.tee $1
  i32.const -1
  i32.eq
  if (result i32)
   local.get $0
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
  else
   local.get $1
  end
  i32.const 255
  i32.and
  local.get $0
  i32.const 1
  i32.add
  local.tee $1
  call $core/memory/readTraps/checkReadTraps
  local.tee $0
  i32.const -1
  i32.eq
  if (result i32)
   local.get $1
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
  else
   local.get $0
  end
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/cpu/cbOpcodes/handleCbOpcode (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  block $break|0
   block $case7|0
    block $case6|0
     block $case5|0
      block $case4|0
       block $case3|0
        block $case2|0
         block $case1|0
          block $case0|0
           local.get $0
           i32.const 7
           i32.and
           local.tee $5
           br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $break|0
          end
          global.get $core/cpu/cpu/Cpu.registerB
          local.set $1
          br $break|0
         end
         global.get $core/cpu/cpu/Cpu.registerC
         local.set $1
         br $break|0
        end
        global.get $core/cpu/cpu/Cpu.registerD
        local.set $1
        br $break|0
       end
       global.get $core/cpu/cpu/Cpu.registerE
       local.set $1
       br $break|0
      end
      global.get $core/cpu/cpu/Cpu.registerH
      local.set $1
      br $break|0
     end
     global.get $core/cpu/cpu/Cpu.registerL
     local.set $1
     br $break|0
    end
    global.get $core/cpu/cpu/Cpu.registerL
    i32.const 255
    i32.and
    global.get $core/cpu/cpu/Cpu.registerH
    i32.const 255
    i32.and
    i32.const 8
    i32.shl
    i32.or
    i32.const 4
    call $core/cycles/syncCycles
    call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
    local.set $1
    br $break|0
   end
   global.get $core/cpu/cpu/Cpu.registerA
   local.set $1
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
                  block $case0|1
                   local.get $0
                   i32.const 240
                   i32.and
                   i32.const 4
                   i32.shr_u
                   local.tee $4
                   br_table $case0|1 $case1|1 $case2|1 $case3|1 $case4|1 $case5|1 $case6|1 $case7|1 $case8|1 $case9|1 $case10|1 $case11|1 $case12|1 $case13|1 $case14|1 $case15|1 $break|1
                  end
                  local.get $0
                  i32.const 7
                  i32.le_s
                  if (result i32)
                   local.get $1
                   i32.const 128
                   i32.and
                   i32.const 128
                   i32.eq
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 16
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 239
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   local.get $1
                   i32.const 1
                   i32.shl
                   local.get $1
                   i32.const 255
                   i32.and
                   i32.const 7
                   i32.shr_u
                   i32.or
                   i32.const 255
                   i32.and
                   local.tee $2
                   i32.eqz
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 128
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 127
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 191
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 223
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   i32.const 1
                  else
                   local.get $0
                   i32.const 15
                   i32.le_s
                   if (result i32)
                    local.get $1
                    i32.const 1
                    i32.and
                    i32.const 0
                    i32.gt_u
                    i32.const 0
                    i32.gt_u
                    if
                     global.get $core/cpu/cpu/Cpu.registerF
                     i32.const 16
                     i32.or
                     i32.const 255
                     i32.and
                     global.set $core/cpu/cpu/Cpu.registerF
                    else
                     global.get $core/cpu/cpu/Cpu.registerF
                     i32.const 239
                     i32.and
                     global.set $core/cpu/cpu/Cpu.registerF
                    end
                    local.get $1
                    i32.const 7
                    i32.shl
                    local.get $1
                    i32.const 255
                    i32.and
                    i32.const 1
                    i32.shr_u
                    i32.or
                    i32.const 255
                    i32.and
                    local.tee $2
                    i32.eqz
                    i32.const 0
                    i32.gt_u
                    if
                     global.get $core/cpu/cpu/Cpu.registerF
                     i32.const 128
                     i32.or
                     i32.const 255
                     i32.and
                     global.set $core/cpu/cpu/Cpu.registerF
                    else
                     global.get $core/cpu/cpu/Cpu.registerF
                     i32.const 127
                     i32.and
                     global.set $core/cpu/cpu/Cpu.registerF
                    end
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 191
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 223
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                    i32.const 1
                   else
                    i32.const 0
                   end
                  end
                  local.set $3
                  br $break|1
                 end
                 local.get $0
                 i32.const 23
                 i32.le_s
                 if (result i32)
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 4
                  i32.shr_u
                  i32.const 1
                  i32.and
                  local.get $1
                  i32.const 1
                  i32.shl
                  i32.or
                  i32.const 255
                  i32.and
                  local.set $2
                  local.get $1
                  i32.const 128
                  i32.and
                  i32.const 128
                  i32.eq
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 16
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 239
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  local.get $2
                  i32.eqz
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 128
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 127
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 191
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 223
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  i32.const 1
                 else
                  local.get $0
                  i32.const 31
                  i32.le_s
                  if (result i32)
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 4
                   i32.shr_u
                   i32.const 1
                   i32.and
                   i32.const 7
                   i32.shl
                   local.get $1
                   i32.const 255
                   i32.and
                   i32.const 1
                   i32.shr_u
                   i32.or
                   local.set $2
                   local.get $1
                   i32.const 1
                   i32.and
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 16
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 239
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   local.get $2
                   i32.eqz
                   i32.const 0
                   i32.gt_u
                   if
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 128
                    i32.or
                    i32.const 255
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   else
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 127
                    i32.and
                    global.set $core/cpu/cpu/Cpu.registerF
                   end
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 191
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 223
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                   i32.const 1
                  else
                   i32.const 0
                  end
                 end
                 local.set $3
                 br $break|1
                end
                local.get $0
                i32.const 39
                i32.le_s
                if (result i32)
                 local.get $1
                 i32.const 1
                 i32.shl
                 i32.const 255
                 i32.and
                 local.set $2
                 local.get $1
                 i32.const 128
                 i32.and
                 i32.const 128
                 i32.eq
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 16
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 239
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 local.get $2
                 i32.eqz
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 128
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 127
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 191
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 223
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 i32.const 1
                else
                 local.get $0
                 i32.const 47
                 i32.le_s
                 if (result i32)
                  local.get $1
                  i32.const 1
                  i32.and
                  local.get $1
                  i32.const 255
                  i32.and
                  i32.const 1
                  i32.shr_u
                  local.tee $2
                  i32.const 128
                  i32.or
                  local.get $2
                  local.get $1
                  i32.const 128
                  i32.and
                  i32.const 128
                  i32.eq
                  select
                  local.tee $2
                  i32.const 255
                  i32.and
                  i32.eqz
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 128
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 127
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 191
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 223
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                  i32.const 0
                  i32.gt_u
                  if
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 16
                   i32.or
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  else
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 239
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerF
                  end
                  i32.const 1
                 else
                  i32.const 0
                 end
                end
                local.set $3
                br $break|1
               end
               local.get $0
               i32.const 55
               i32.le_s
               if (result i32)
                local.get $1
                i32.const 15
                i32.and
                i32.const 4
                i32.shl
                local.get $1
                i32.const 240
                i32.and
                i32.const 4
                i32.shr_u
                i32.or
                local.tee $2
                i32.eqz
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 128
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 127
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 191
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 223
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 239
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                i32.const 1
               else
                local.get $0
                i32.const 63
                i32.le_s
                if (result i32)
                 local.get $1
                 i32.const 255
                 i32.and
                 i32.const 1
                 i32.shr_u
                 local.tee $2
                 i32.eqz
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 128
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 127
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 191
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 223
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                 local.get $1
                 i32.const 1
                 i32.and
                 i32.const 0
                 i32.gt_u
                 if
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 16
                  i32.or
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 else
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 239
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerF
                 end
                 i32.const 1
                else
                 i32.const 0
                end
               end
               local.set $3
               br $break|1
              end
              local.get $0
              i32.const 71
              i32.le_s
              if (result i32)
               local.get $1
               local.tee $2
               i32.const 1
               i32.and
               i32.eqz
               i32.const 0
               i32.gt_u
               if
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 128
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               else
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 127
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               end
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 191
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 32
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               i32.const 1
              else
               local.get $0
               i32.const 79
               i32.le_s
               if (result i32)
                local.get $1
                local.tee $2
                i32.const 2
                i32.and
                i32.eqz
                i32.const 0
                i32.gt_u
                if
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 128
                 i32.or
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                else
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 127
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerF
                end
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 191
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 32
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                i32.const 1
               else
                i32.const 0
               end
              end
              local.set $3
              br $break|1
             end
             local.get $0
             i32.const 87
             i32.le_s
             if (result i32)
              local.get $1
              local.tee $2
              i32.const 4
              i32.and
              i32.eqz
              i32.const 0
              i32.gt_u
              if
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 128
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              else
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 127
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              end
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 191
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 32
              i32.or
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              i32.const 1
             else
              local.get $0
              i32.const 95
              i32.le_s
              if (result i32)
               local.get $1
               local.tee $2
               i32.const 8
               i32.and
               i32.eqz
               i32.const 0
               i32.gt_u
               if
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 128
                i32.or
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               else
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 127
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
               end
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 191
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 32
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
               i32.const 1
              else
               i32.const 0
              end
             end
             local.set $3
             br $break|1
            end
            local.get $0
            i32.const 103
            i32.le_s
            if (result i32)
             local.get $1
             local.tee $2
             i32.const 16
             i32.and
             i32.eqz
             i32.const 0
             i32.gt_u
             if
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 128
              i32.or
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             else
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 127
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 191
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 32
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             i32.const 1
            else
             local.get $0
             i32.const 111
             i32.le_s
             if (result i32)
              local.get $1
              local.tee $2
              i32.const 32
              i32.and
              i32.eqz
              i32.const 0
              i32.gt_u
              if
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 128
               i32.or
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              else
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 127
               i32.and
               global.set $core/cpu/cpu/Cpu.registerF
              end
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 191
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 32
              i32.or
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
              i32.const 1
             else
              i32.const 0
             end
            end
            local.set $3
            br $break|1
           end
           local.get $0
           i32.const 119
           i32.le_s
           if (result i32)
            local.get $1
            local.tee $2
            i32.const 64
            i32.and
            i32.eqz
            i32.const 0
            i32.gt_u
            if
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 128
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            else
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 127
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            end
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 191
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 32
            i32.or
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            i32.const 1
           else
            local.get $0
            i32.const 127
            i32.le_s
            if (result i32)
             local.get $1
             local.tee $2
             i32.const 128
             i32.and
             i32.eqz
             i32.const 0
             i32.gt_u
             if
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 128
              i32.or
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             else
              global.get $core/cpu/cpu/Cpu.registerF
              i32.const 127
              i32.and
              global.set $core/cpu/cpu/Cpu.registerF
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 191
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 32
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
             i32.const 1
            else
             i32.const 0
            end
           end
           local.set $3
           br $break|1
          end
          local.get $0
          i32.const 135
          i32.le_s
          if (result i32)
           i32.const 1
           local.set $3
           local.get $1
           i32.const -2
           i32.and
          else
           local.get $0
           i32.const 143
           i32.le_s
           if (result i32)
            i32.const 1
            local.set $3
            local.get $1
            i32.const -3
            i32.and
           else
            i32.const 0
           end
          end
          local.set $2
          br $break|1
         end
         local.get $0
         i32.const 151
         i32.le_s
         if (result i32)
          i32.const 1
          local.set $3
          local.get $1
          i32.const -5
          i32.and
         else
          local.get $0
          i32.const 159
          i32.le_s
          if (result i32)
           i32.const 1
           local.set $3
           local.get $1
           i32.const -9
           i32.and
          else
           i32.const 0
          end
         end
         local.set $2
         br $break|1
        end
        local.get $0
        i32.const 167
        i32.le_s
        if (result i32)
         i32.const 1
         local.set $3
         local.get $1
         i32.const -17
         i32.and
        else
         local.get $0
         i32.const 175
         i32.le_s
         if (result i32)
          i32.const 1
          local.set $3
          local.get $1
          i32.const -33
          i32.and
         else
          i32.const 0
         end
        end
        local.set $2
        br $break|1
       end
       local.get $0
       i32.const 183
       i32.le_s
       if (result i32)
        i32.const 1
        local.set $3
        local.get $1
        i32.const -65
        i32.and
       else
        local.get $0
        i32.const 191
        i32.le_s
        if (result i32)
         i32.const 1
         local.set $3
         local.get $1
         i32.const -129
         i32.and
        else
         i32.const 0
        end
       end
       local.set $2
       br $break|1
      end
      local.get $0
      i32.const 199
      i32.le_s
      if (result i32)
       i32.const 1
       local.set $3
       local.get $1
       i32.const 1
       i32.or
      else
       local.get $0
       i32.const 207
       i32.le_s
       if (result i32)
        i32.const 1
        local.set $3
        local.get $1
        i32.const 2
        i32.or
       else
        i32.const 0
       end
      end
      local.set $2
      br $break|1
     end
     local.get $0
     i32.const 215
     i32.le_s
     if (result i32)
      i32.const 1
      local.set $3
      local.get $1
      i32.const 4
      i32.or
     else
      local.get $0
      i32.const 223
      i32.le_s
      if (result i32)
       i32.const 1
       local.set $3
       local.get $1
       i32.const 8
       i32.or
      else
       i32.const 0
      end
     end
     local.set $2
     br $break|1
    end
    local.get $0
    i32.const 231
    i32.le_s
    if (result i32)
     i32.const 1
     local.set $3
     local.get $1
     i32.const 16
     i32.or
    else
     local.get $0
     i32.const 239
     i32.le_s
     if (result i32)
      i32.const 1
      local.set $3
      local.get $1
      i32.const 32
      i32.or
     else
      i32.const 0
     end
    end
    local.set $2
    br $break|1
   end
   local.get $0
   i32.const 247
   i32.le_s
   if (result i32)
    i32.const 1
    local.set $3
    local.get $1
    i32.const 64
    i32.or
   else
    local.get $0
    i32.const 255
    i32.le_s
    if (result i32)
     i32.const 1
     local.set $3
     local.get $1
     i32.const 128
     i32.or
    else
     i32.const 0
    end
   end
   local.set $2
  end
  block $break|2
   block $case7|2
    block $case6|2
     block $case5|2
      block $case4|2
       block $case3|2
        block $case2|2
         block $case1|2
          block $case0|2
           local.get $5
           br_table $case0|2 $case1|2 $case2|2 $case3|2 $case4|2 $case5|2 $case6|2 $case7|2 $break|2
          end
          local.get $2
          global.set $core/cpu/cpu/Cpu.registerB
          br $break|2
         end
         local.get $2
         global.set $core/cpu/cpu/Cpu.registerC
         br $break|2
        end
        local.get $2
        global.set $core/cpu/cpu/Cpu.registerD
        br $break|2
       end
       local.get $2
       global.set $core/cpu/cpu/Cpu.registerE
       br $break|2
      end
      local.get $2
      global.set $core/cpu/cpu/Cpu.registerH
      br $break|2
     end
     local.get $2
     global.set $core/cpu/cpu/Cpu.registerL
     br $break|2
    end
    i32.const 1
    local.get $4
    i32.const 7
    i32.gt_u
    local.get $4
    i32.const 4
    i32.lt_u
    select
    if
     global.get $core/cpu/cpu/Cpu.registerL
     i32.const 255
     i32.and
     global.get $core/cpu/cpu/Cpu.registerH
     i32.const 255
     i32.and
     i32.const 8
     i32.shl
     i32.or
     i32.const 4
     call $core/cycles/syncCycles
     local.get $2
     call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
    end
    br $break|2
   end
   local.get $2
   global.set $core/cpu/cpu/Cpu.registerA
  end
  i32.const 4
  i32.const -1
  local.get $3
  select
 )
 (func $core/cpu/opcodes/handleOpcodeCx (param $0 i32) (result i32)
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
                    block $case2|0
                     block $case1|0
                      block $case0|0
                       local.get $0
                       i32.const 192
                       i32.sub
                       br_table $case0|0 $case1|0 $case2|0 $folding-inner1 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $break|0
                      end
                      global.get $core/cpu/cpu/Cpu.registerF
                      i32.const 7
                      i32.shr_u
                      i32.const 1
                      i32.and
                      br_if $folding-inner2
                      br $folding-inner4
                     end
                     global.get $core/cpu/cpu/Cpu.stackPointer
                     i32.const 8
                     call $core/cycles/syncCycles
                     call $core/memory/load/sixteenBitLoadFromGBMemory
                     i32.const 65535
                     i32.and
                     local.set $0
                     global.get $core/cpu/cpu/Cpu.stackPointer
                     i32.const 2
                     i32.add
                     i32.const 65535
                     i32.and
                     global.set $core/cpu/cpu/Cpu.stackPointer
                     local.get $0
                     i32.const 65280
                     i32.and
                     i32.const 8
                     i32.shr_u
                     global.set $core/cpu/cpu/Cpu.registerB
                     local.get $0
                     i32.const 255
                     i32.and
                     global.set $core/cpu/cpu/Cpu.registerC
                     i32.const 4
                     return
                    end
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 7
                    i32.shr_u
                    i32.const 1
                    i32.and
                    i32.eqz
                    br_if $folding-inner1
                    br $folding-inner0
                   end
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 7
                   i32.shr_u
                   i32.const 1
                   i32.and
                   br_if $folding-inner0
                   global.get $core/cpu/cpu/Cpu.stackPointer
                   i32.const 2
                   i32.sub
                   i32.const 65535
                   i32.and
                   local.tee $0
                   global.set $core/cpu/cpu/Cpu.stackPointer
                   global.get $core/cpu/cpu/Cpu.programCounter
                   i32.const 2
                   i32.add
                   i32.const 65535
                   i32.and
                   local.set $1
                   i32.const 8
                   call $core/cycles/syncCycles
                   local.get $0
                   local.get $1
                   call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
                   br $folding-inner1
                  end
                  global.get $core/cpu/cpu/Cpu.stackPointer
                  i32.const 2
                  i32.sub
                  i32.const 65535
                  i32.and
                  local.tee $0
                  global.set $core/cpu/cpu/Cpu.stackPointer
                  global.get $core/cpu/cpu/Cpu.registerC
                  i32.const 255
                  i32.and
                  global.get $core/cpu/cpu/Cpu.registerB
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  local.set $1
                  i32.const 8
                  call $core/cycles/syncCycles
                  local.get $0
                  local.get $1
                  call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
                  br $folding-inner2
                 end
                 i32.const 4
                 call $core/cycles/syncCycles
                 global.get $core/cpu/cpu/Cpu.programCounter
                 call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                 i32.load8_u
                 call $core/cpu/instructions/addARegister
                 br $folding-inner3
                end
                global.get $core/cpu/cpu/Cpu.stackPointer
                i32.const 2
                i32.sub
                i32.const 65535
                i32.and
                local.tee $0
                global.set $core/cpu/cpu/Cpu.stackPointer
                global.get $core/cpu/cpu/Cpu.programCounter
                local.set $1
                i32.const 8
                call $core/cycles/syncCycles
                local.get $0
                local.get $1
                call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
                i32.const 0
                global.set $core/cpu/cpu/Cpu.programCounter
                br $folding-inner2
               end
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 7
               i32.shr_u
               i32.const 1
               i32.and
               i32.eqz
               br_if $folding-inner2
               br $folding-inner4
              end
              global.get $core/cpu/cpu/Cpu.stackPointer
              local.set $0
              i32.const 8
              call $core/cycles/syncCycles
              local.get $0
              call $core/memory/load/sixteenBitLoadFromGBMemory
              i32.const 65535
              i32.and
              global.set $core/cpu/cpu/Cpu.programCounter
              local.get $0
              i32.const 2
              i32.add
              i32.const 65535
              i32.and
              global.set $core/cpu/cpu/Cpu.stackPointer
              br $folding-inner2
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 7
             i32.shr_u
             i32.const 1
             i32.and
             br_if $folding-inner1
             br $folding-inner0
            end
            i32.const 4
            call $core/cycles/syncCycles
            global.get $core/cpu/cpu/Cpu.programCounter
            call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
            i32.load8_u
            call $core/cpu/cbOpcodes/handleCbOpcode
            global.get $core/cpu/cpu/Cpu.programCounter
            i32.const 1
            i32.add
            i32.const 65535
            i32.and
            global.set $core/cpu/cpu/Cpu.programCounter
            return
           end
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 7
           i32.shr_u
           i32.const 1
           i32.and
           i32.eqz
           br_if $folding-inner0
           global.get $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.stackPointer
           global.get $core/cpu/cpu/Cpu.programCounter
           i32.const 2
           i32.add
           i32.const 65535
           i32.and
           local.set $1
           i32.const 8
           call $core/cycles/syncCycles
           local.get $0
           local.get $1
           call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
           br $folding-inner1
          end
          global.get $core/cpu/cpu/Cpu.stackPointer
          i32.const 2
          i32.sub
          i32.const 65535
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.stackPointer
          global.get $core/cpu/cpu/Cpu.programCounter
          i32.const 2
          i32.add
          i32.const 65535
          i32.and
          local.set $1
          i32.const 8
          call $core/cycles/syncCycles
          local.get $0
          local.get $1
          call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
          br $folding-inner1
         end
         i32.const 4
         call $core/cycles/syncCycles
         global.get $core/cpu/cpu/Cpu.programCounter
         call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
         i32.load8_u
         call $core/cpu/instructions/addAThroughCarryRegister
         br $folding-inner3
        end
        global.get $core/cpu/cpu/Cpu.stackPointer
        i32.const 2
        i32.sub
        i32.const 65535
        i32.and
        local.tee $0
        global.set $core/cpu/cpu/Cpu.stackPointer
        global.get $core/cpu/cpu/Cpu.programCounter
        local.set $1
        i32.const 8
        call $core/cycles/syncCycles
        local.get $0
        local.get $1
        call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
        i32.const 8
        global.set $core/cpu/cpu/Cpu.programCounter
        br $folding-inner2
       end
       i32.const -1
       return
      end
      global.get $core/cpu/cpu/Cpu.programCounter
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      global.set $core/cpu/cpu/Cpu.programCounter
      i32.const 12
      return
     end
     call $core/cpu/opcodes/getConcatenatedDataByte
     i32.const 65535
     i32.and
     global.set $core/cpu/cpu/Cpu.programCounter
    end
    i32.const 8
    return
   end
   global.get $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.add
   i32.const 65535
   i32.and
   global.set $core/cpu/cpu/Cpu.programCounter
   i32.const 4
   return
  end
  global.get $core/cpu/cpu/Cpu.stackPointer
  local.set $0
  i32.const 8
  call $core/cycles/syncCycles
  local.get $0
  call $core/memory/load/sixteenBitLoadFromGBMemory
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.programCounter
  local.get $0
  i32.const 2
  i32.add
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.stackPointer
  i32.const 12
 )
 (func $core/cpu/opcodes/handleOpcodeDx (param $0 i32) (result i32)
  (local $1 i32)
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
                    block $case0|0
                     local.get $0
                     i32.const 208
                     i32.sub
                     br_table $case0|0 $case1|0 $case2|0 $break|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $break|0 $case10|0 $break|0 $case11|0 $case12|0 $break|0
                    end
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 4
                    i32.shr_u
                    i32.const 1
                    i32.and
                    br_if $folding-inner2
                    br $folding-inner4
                   end
                   global.get $core/cpu/cpu/Cpu.stackPointer
                   local.set $0
                   i32.const 8
                   call $core/cycles/syncCycles
                   local.get $0
                   call $core/memory/load/sixteenBitLoadFromGBMemory
                   i32.const 65535
                   i32.and
                   local.set $1
                   local.get $0
                   i32.const 2
                   i32.add
                   i32.const 65535
                   i32.and
                   global.set $core/cpu/cpu/Cpu.stackPointer
                   local.get $1
                   i32.const 65280
                   i32.and
                   i32.const 8
                   i32.shr_u
                   global.set $core/cpu/cpu/Cpu.registerD
                   local.get $1
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerE
                   i32.const 4
                   return
                  end
                  global.get $core/cpu/cpu/Cpu.registerF
                  i32.const 4
                  i32.shr_u
                  i32.const 1
                  i32.and
                  i32.eqz
                  br_if $folding-inner1
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 4
                 i32.shr_u
                 i32.const 1
                 i32.and
                 br_if $folding-inner0
                 global.get $core/cpu/cpu/Cpu.stackPointer
                 i32.const 2
                 i32.sub
                 i32.const 65535
                 i32.and
                 local.tee $0
                 global.set $core/cpu/cpu/Cpu.stackPointer
                 global.get $core/cpu/cpu/Cpu.programCounter
                 i32.const 2
                 i32.add
                 i32.const 65535
                 i32.and
                 local.set $1
                 i32.const 8
                 call $core/cycles/syncCycles
                 local.get $0
                 local.get $1
                 call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
                 br $folding-inner1
                end
                global.get $core/cpu/cpu/Cpu.stackPointer
                i32.const 2
                i32.sub
                i32.const 65535
                i32.and
                local.tee $0
                global.set $core/cpu/cpu/Cpu.stackPointer
                global.get $core/cpu/cpu/Cpu.registerE
                i32.const 255
                i32.and
                global.get $core/cpu/cpu/Cpu.registerD
                i32.const 255
                i32.and
                i32.const 8
                i32.shl
                i32.or
                local.set $1
                i32.const 8
                call $core/cycles/syncCycles
                local.get $0
                local.get $1
                call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
                br $folding-inner2
               end
               i32.const 4
               call $core/cycles/syncCycles
               global.get $core/cpu/cpu/Cpu.programCounter
               call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
               i32.load8_u
               call $core/cpu/instructions/subARegister
               br $folding-inner3
              end
              global.get $core/cpu/cpu/Cpu.stackPointer
              i32.const 2
              i32.sub
              i32.const 65535
              i32.and
              local.tee $0
              global.set $core/cpu/cpu/Cpu.stackPointer
              global.get $core/cpu/cpu/Cpu.programCounter
              local.set $1
              i32.const 8
              call $core/cycles/syncCycles
              local.get $0
              local.get $1
              call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
              i32.const 16
              global.set $core/cpu/cpu/Cpu.programCounter
              br $folding-inner2
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 4
             i32.shr_u
             i32.const 1
             i32.and
             i32.eqz
             br_if $folding-inner2
             br $folding-inner4
            end
            global.get $core/cpu/cpu/Cpu.stackPointer
            local.set $0
            i32.const 8
            call $core/cycles/syncCycles
            local.get $0
            call $core/memory/load/sixteenBitLoadFromGBMemory
            i32.const 65535
            i32.and
            global.set $core/cpu/cpu/Cpu.programCounter
            i32.const 1
            global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
            local.get $0
            i32.const 2
            i32.add
            i32.const 65535
            i32.and
            global.set $core/cpu/cpu/Cpu.stackPointer
            br $folding-inner2
           end
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 4
           i32.shr_u
           i32.const 1
           i32.and
           br_if $folding-inner1
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 4
          i32.shr_u
          i32.const 1
          i32.and
          i32.eqz
          br_if $folding-inner0
          global.get $core/cpu/cpu/Cpu.stackPointer
          i32.const 2
          i32.sub
          i32.const 65535
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.stackPointer
          global.get $core/cpu/cpu/Cpu.programCounter
          i32.const 2
          i32.add
          i32.const 65535
          i32.and
          local.set $1
          i32.const 8
          call $core/cycles/syncCycles
          local.get $0
          local.get $1
          call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
          br $folding-inner1
         end
         i32.const 4
         call $core/cycles/syncCycles
         global.get $core/cpu/cpu/Cpu.programCounter
         call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
         i32.load8_u
         call $core/cpu/instructions/subAThroughCarryRegister
         br $folding-inner3
        end
        global.get $core/cpu/cpu/Cpu.stackPointer
        i32.const 2
        i32.sub
        i32.const 65535
        i32.and
        local.tee $0
        global.set $core/cpu/cpu/Cpu.stackPointer
        global.get $core/cpu/cpu/Cpu.programCounter
        local.set $1
        i32.const 8
        call $core/cycles/syncCycles
        local.get $0
        local.get $1
        call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
        i32.const 24
        global.set $core/cpu/cpu/Cpu.programCounter
        br $folding-inner2
       end
       i32.const -1
       return
      end
      global.get $core/cpu/cpu/Cpu.programCounter
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      global.set $core/cpu/cpu/Cpu.programCounter
      i32.const 12
      return
     end
     call $core/cpu/opcodes/getConcatenatedDataByte
     i32.const 65535
     i32.and
     global.set $core/cpu/cpu/Cpu.programCounter
    end
    i32.const 8
    return
   end
   global.get $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.add
   i32.const 65535
   i32.and
   global.set $core/cpu/cpu/Cpu.programCounter
   i32.const 4
   return
  end
  global.get $core/cpu/cpu/Cpu.stackPointer
  local.set $0
  i32.const 8
  call $core/cycles/syncCycles
  local.get $0
  call $core/memory/load/sixteenBitLoadFromGBMemory
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.programCounter
  local.get $0
  i32.const 2
  i32.add
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.stackPointer
  i32.const 12
 )
 (func $core/cpu/opcodes/handleOpcodeEx (param $0 i32) (result i32)
  (local $1 i32)
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
              block $case0|0
               local.get $0
               i32.const 224
               i32.sub
               br_table $case0|0 $case1|0 $case2|0 $break|0 $break|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $break|0 $break|0 $break|0 $case9|0 $case10|0 $break|0
              end
              i32.const 4
              call $core/cycles/syncCycles
              global.get $core/cpu/cpu/Cpu.programCounter
              call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
              i32.load8_u
              global.get $core/cpu/cpu/Cpu.registerA
              local.set $1
              i32.const 4
              call $core/cycles/syncCycles
              i32.const 255
              i32.and
              i32.const 65280
              i32.add
              local.get $1
              call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.stackPointer
             local.set $0
             i32.const 8
             call $core/cycles/syncCycles
             local.get $0
             call $core/memory/load/sixteenBitLoadFromGBMemory
             i32.const 65535
             i32.and
             local.set $1
             local.get $0
             i32.const 2
             i32.add
             i32.const 65535
             i32.and
             global.set $core/cpu/cpu/Cpu.stackPointer
             local.get $1
             i32.const 65280
             i32.and
             i32.const 8
             i32.shr_u
             global.set $core/cpu/cpu/Cpu.registerH
             local.get $1
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerL
             i32.const 4
             return
            end
            global.get $core/cpu/cpu/Cpu.registerC
            i32.const 65280
            i32.add
            global.get $core/cpu/cpu/Cpu.registerA
            i32.const 4
            call $core/cycles/syncCycles
            call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
            i32.const 4
            return
           end
           global.get $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.stackPointer
           global.get $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           global.get $core/cpu/cpu/Cpu.registerH
           i32.const 255
           i32.and
           i32.const 8
           i32.shl
           i32.or
           local.set $1
           i32.const 8
           call $core/cycles/syncCycles
           local.get $0
           local.get $1
           call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
           i32.const 8
           return
          end
          i32.const 4
          call $core/cycles/syncCycles
          global.get $core/cpu/cpu/Cpu.programCounter
          call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
          i32.load8_u
          global.get $core/cpu/cpu/Cpu.registerA
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.registerA
          local.get $0
          i32.eqz
          i32.const 0
          i32.gt_u
          if
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 128
           i32.or
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          else
           global.get $core/cpu/cpu/Cpu.registerF
           i32.const 127
           i32.and
           global.set $core/cpu/cpu/Cpu.registerF
          end
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 191
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 32
          i32.or
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 239
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.stackPointer
         i32.const 2
         i32.sub
         i32.const 65535
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.stackPointer
         global.get $core/cpu/cpu/Cpu.programCounter
         local.set $1
         i32.const 8
         call $core/cycles/syncCycles
         local.get $0
         local.get $1
         call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
         i32.const 32
         global.set $core/cpu/cpu/Cpu.programCounter
         i32.const 8
         return
        end
        i32.const 4
        call $core/cycles/syncCycles
        global.get $core/cpu/cpu/Cpu.programCounter
        call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
        i32.load8_s
        local.set $0
        global.get $core/cpu/cpu/Cpu.stackPointer
        local.get $0
        i32.const 1
        call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
        local.get $0
        global.get $core/cpu/cpu/Cpu.stackPointer
        i32.add
        i32.const 65535
        i32.and
        global.set $core/cpu/cpu/Cpu.stackPointer
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 127
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
        global.get $core/cpu/cpu/Cpu.registerF
        i32.const 191
        i32.and
        global.set $core/cpu/cpu/Cpu.registerF
        global.get $core/cpu/cpu/Cpu.programCounter
        i32.const 1
        i32.add
        i32.const 65535
        i32.and
        global.set $core/cpu/cpu/Cpu.programCounter
        i32.const 12
        return
       end
       global.get $core/cpu/cpu/Cpu.registerL
       i32.const 255
       i32.and
       global.get $core/cpu/cpu/Cpu.registerH
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       global.set $core/cpu/cpu/Cpu.programCounter
       i32.const 4
       return
      end
      call $core/cpu/opcodes/getConcatenatedDataByte
      i32.const 65535
      i32.and
      global.get $core/cpu/cpu/Cpu.registerA
      i32.const 4
      call $core/cycles/syncCycles
      call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
      global.get $core/cpu/cpu/Cpu.programCounter
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      global.set $core/cpu/cpu/Cpu.programCounter
      i32.const 4
      return
     end
     i32.const 4
     call $core/cycles/syncCycles
     global.get $core/cpu/cpu/Cpu.programCounter
     call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
     i32.load8_u
     global.get $core/cpu/cpu/Cpu.registerA
     i32.xor
     i32.const 255
     i32.and
     local.tee $0
     global.set $core/cpu/cpu/Cpu.registerA
     local.get $0
     i32.eqz
     i32.const 0
     i32.gt_u
     if
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 128
      i32.or
      i32.const 255
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
     else
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 127
      i32.and
      global.set $core/cpu/cpu/Cpu.registerF
     end
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 191
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 223
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
     global.get $core/cpu/cpu/Cpu.registerF
     i32.const 239
     i32.and
     global.set $core/cpu/cpu/Cpu.registerF
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.stackPointer
    i32.const 2
    i32.sub
    i32.const 65535
    i32.and
    local.tee $0
    global.set $core/cpu/cpu/Cpu.stackPointer
    global.get $core/cpu/cpu/Cpu.programCounter
    local.set $1
    i32.const 8
    call $core/cycles/syncCycles
    local.get $0
    local.get $1
    call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
    i32.const 40
    global.set $core/cpu/cpu/Cpu.programCounter
    i32.const 8
    return
   end
   i32.const -1
   return
  end
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.programCounter
  i32.const 4
 )
 (func $core/cpu/opcodes/handleOpcodeFx (param $0 i32) (result i32)
  (local $1 i32)
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
                 block $case0|0
                  local.get $0
                  i32.const 240
                  i32.sub
                  br_table $case0|0 $case1|0 $case2|0 $case3|0 $break|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $break|0 $break|0 $case11|0 $case12|0 $break|0
                 end
                 i32.const 4
                 call $core/cycles/syncCycles
                 global.get $core/cpu/cpu/Cpu.programCounter
                 call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
                 i32.load8_u
                 i32.const 4
                 call $core/cycles/syncCycles
                 i32.const 255
                 i32.and
                 i32.const 65280
                 i32.add
                 call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerA
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.stackPointer
                local.set $0
                i32.const 8
                call $core/cycles/syncCycles
                local.get $0
                call $core/memory/load/sixteenBitLoadFromGBMemory
                i32.const 65535
                i32.and
                local.set $1
                local.get $0
                i32.const 2
                i32.add
                i32.const 65535
                i32.and
                global.set $core/cpu/cpu/Cpu.stackPointer
                local.get $1
                i32.const 65280
                i32.and
                i32.const 8
                i32.shr_u
                global.set $core/cpu/cpu/Cpu.registerA
                local.get $1
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                br $folding-inner1
               end
               global.get $core/cpu/cpu/Cpu.registerC
               i32.const 65280
               i32.add
               i32.const 4
               call $core/cycles/syncCycles
               call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerA
               br $folding-inner1
              end
              i32.const 0
              global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
              br $folding-inner1
             end
             global.get $core/cpu/cpu/Cpu.stackPointer
             i32.const 2
             i32.sub
             i32.const 65535
             i32.and
             local.tee $0
             global.set $core/cpu/cpu/Cpu.stackPointer
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerA
             i32.const 255
             i32.and
             i32.const 8
             i32.shl
             i32.or
             local.set $1
             i32.const 8
             call $core/cycles/syncCycles
             local.get $0
             local.get $1
             call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
             i32.const 8
             return
            end
            i32.const 4
            call $core/cycles/syncCycles
            global.get $core/cpu/cpu/Cpu.programCounter
            call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
            i32.load8_u
            global.get $core/cpu/cpu/Cpu.registerA
            i32.or
            i32.const 255
            i32.and
            local.tee $0
            global.set $core/cpu/cpu/Cpu.registerA
            local.get $0
            i32.eqz
            i32.const 0
            i32.gt_u
            if
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 128
             i32.or
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            else
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 127
             i32.and
             global.set $core/cpu/cpu/Cpu.registerF
            end
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 191
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 223
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            global.get $core/cpu/cpu/Cpu.registerF
            i32.const 239
            i32.and
            global.set $core/cpu/cpu/Cpu.registerF
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.stackPointer
           global.get $core/cpu/cpu/Cpu.programCounter
           local.set $1
           i32.const 8
           call $core/cycles/syncCycles
           local.get $0
           local.get $1
           call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
           i32.const 48
           global.set $core/cpu/cpu/Cpu.programCounter
           i32.const 8
           return
          end
          i32.const 4
          call $core/cycles/syncCycles
          global.get $core/cpu/cpu/Cpu.programCounter
          call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
          i32.load8_u
          local.set $0
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 127
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 191
          i32.and
          global.set $core/cpu/cpu/Cpu.registerF
          global.get $core/cpu/cpu/Cpu.stackPointer
          local.tee $1
          local.get $0
          i32.const 24
          i32.shl
          i32.const 24
          i32.shr_s
          local.tee $0
          i32.const 1
          call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
          local.get $0
          local.get $1
          i32.add
          i32.const 65535
          i32.and
          local.tee $0
          i32.const 65280
          i32.and
          i32.const 8
          i32.shr_u
          global.set $core/cpu/cpu/Cpu.registerH
          local.get $0
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerL
          global.get $core/cpu/cpu/Cpu.programCounter
          i32.const 1
          i32.add
          i32.const 65535
          i32.and
          global.set $core/cpu/cpu/Cpu.programCounter
          i32.const 8
          return
         end
         global.get $core/cpu/cpu/Cpu.registerL
         i32.const 255
         i32.and
         global.get $core/cpu/cpu/Cpu.registerH
         i32.const 255
         i32.and
         i32.const 8
         i32.shl
         i32.or
         global.set $core/cpu/cpu/Cpu.stackPointer
         i32.const 8
         return
        end
        call $core/cpu/opcodes/getConcatenatedDataByte
        i32.const 65535
        i32.and
        i32.const 4
        call $core/cycles/syncCycles
        call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
        i32.const 255
        i32.and
        global.set $core/cpu/cpu/Cpu.registerA
        global.get $core/cpu/cpu/Cpu.programCounter
        i32.const 2
        i32.add
        i32.const 65535
        i32.and
        global.set $core/cpu/cpu/Cpu.programCounter
        br $folding-inner1
       end
       i32.const 1
       global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
       br $folding-inner1
      end
      i32.const 4
      call $core/cycles/syncCycles
      global.get $core/cpu/cpu/Cpu.programCounter
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      call $core/cpu/instructions/cpARegister
      br $folding-inner0
     end
     global.get $core/cpu/cpu/Cpu.stackPointer
     i32.const 2
     i32.sub
     i32.const 65535
     i32.and
     local.tee $0
     global.set $core/cpu/cpu/Cpu.stackPointer
     global.get $core/cpu/cpu/Cpu.programCounter
     local.set $1
     i32.const 8
     call $core/cycles/syncCycles
     local.get $0
     local.get $1
     call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
     i32.const 56
     global.set $core/cpu/cpu/Cpu.programCounter
     i32.const 8
     return
    end
    i32.const -1
    return
   end
   global.get $core/cpu/cpu/Cpu.programCounter
   i32.const 1
   i32.add
   i32.const 65535
   i32.and
   global.set $core/cpu/cpu/Cpu.programCounter
  end
  i32.const 4
 )
 (func $core/cpu/opcodes/executeOpcode (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  local.tee $1
  i32.const 1
  i32.sub
  i32.const 65535
  i32.and
  local.get $1
  global.get $core/cpu/cpu/Cpu.isHaltBug
  select
  global.set $core/cpu/cpu/Cpu.programCounter
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
                 block $case0|0
                  local.get $0
                  i32.const 240
                  i32.and
                  i32.const 4
                  i32.shr_u
                  br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0
                 end
                 local.get $0
                 call $core/cpu/opcodes/handleOpcode0x
                 return
                end
                local.get $0
                call $core/cpu/opcodes/handleOpcode1x
                return
               end
               local.get $0
               call $core/cpu/opcodes/handleOpcode2x
               return
              end
              local.get $0
              call $core/cpu/opcodes/handleOpcode3x
              return
             end
             local.get $0
             call $core/cpu/opcodes/handleOpcode4x
             return
            end
            local.get $0
            call $core/cpu/opcodes/handleOpcode5x
            return
           end
           local.get $0
           call $core/cpu/opcodes/handleOpcode6x
           return
          end
          local.get $0
          call $core/cpu/opcodes/handleOpcode7x
          return
         end
         local.get $0
         call $core/cpu/opcodes/handleOpcode8x
         return
        end
        local.get $0
        call $core/cpu/opcodes/handleOpcode9x
        return
       end
       local.get $0
       call $core/cpu/opcodes/handleOpcodeAx
       return
      end
      local.get $0
      call $core/cpu/opcodes/handleOpcodeBx
      return
     end
     local.get $0
     call $core/cpu/opcodes/handleOpcodeCx
     return
    end
    local.get $0
    call $core/cpu/opcodes/handleOpcodeDx
    return
   end
   local.get $0
   call $core/cpu/opcodes/handleOpcodeEx
   return
  end
  local.get $0
  call $core/cpu/opcodes/handleOpcodeFx
 )
 (func $core/interrupts/interrupts/_handleInterrupt (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  i32.const 65295
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
  i32.const -2
  local.get $0
  i32.rotl
  i32.and
  local.tee $1
  global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 65295
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  local.get $1
  i32.store8
  global.get $core/cpu/cpu/Cpu.stackPointer
  i32.const 2
  i32.sub
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.stackPointer
  global.get $core/cpu/cpu/Cpu.programCounter
  local.set $1
  global.get $core/cpu/cpu/Cpu.stackPointer
  local.tee $2
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  local.get $1
  i32.store8
  local.get $2
  i32.const 1
  i32.add
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  local.get $1
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_u
  i32.store8
  block $break|0
   block $case4|0
    block $case3|0
     block $case2|0
      block $case1|0
       block $case0|0
        local.get $0
        br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $break|0
       end
       i32.const 0
       global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
       i32.const 64
       global.set $core/cpu/cpu/Cpu.programCounter
       br $break|0
      end
      i32.const 0
      global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
      i32.const 72
      global.set $core/cpu/cpu/Cpu.programCounter
      br $break|0
     end
     i32.const 0
     global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
     i32.const 80
     global.set $core/cpu/cpu/Cpu.programCounter
     br $break|0
    end
    i32.const 0
    global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
    i32.const 88
    global.set $core/cpu/cpu/Cpu.programCounter
    br $break|0
   end
   i32.const 0
   global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
   i32.const 96
   global.set $core/cpu/cpu/Cpu.programCounter
  end
 )
 (func $core/interrupts/interrupts/checkInterrupts (result i32)
  (local $0 i32)
  global.get $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  if
   i32.const 1
   global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
   i32.const 0
   global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  end
  global.get $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
  global.get $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.and
  i32.const 31
  i32.and
  i32.const 0
  i32.gt_u
  if
   global.get $core/cpu/cpu/Cpu.isHaltNoJump
   i32.eqz
   i32.const 0
   global.get $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
   select
   if (result i32)
    global.get $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
    i32.const 0
    global.get $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
    select
    if (result i32)
     i32.const 0
     call $core/interrupts/interrupts/_handleInterrupt
     i32.const 1
    else
     global.get $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
     i32.const 0
     global.get $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
     select
     if (result i32)
      i32.const 1
      call $core/interrupts/interrupts/_handleInterrupt
      i32.const 1
     else
      global.get $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
      i32.const 0
      global.get $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
      select
      if (result i32)
       i32.const 2
       call $core/interrupts/interrupts/_handleInterrupt
       i32.const 1
      else
       global.get $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
       i32.const 0
       global.get $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
       select
       if (result i32)
        i32.const 3
        call $core/interrupts/interrupts/_handleInterrupt
        i32.const 1
       else
        global.get $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
        i32.const 0
        global.get $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
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
   if (result i32)
    i32.const 1
    global.get $core/cpu/cpu/Cpu.isHaltNoJump
    global.get $core/cpu/cpu/Cpu.isHaltNormal
    select
    if (result i32)
     i32.const 0
     global.set $core/cpu/cpu/Cpu.isHaltNoJump
     i32.const 0
     global.set $core/cpu/cpu/Cpu.isHaltNormal
     i32.const 0
     global.set $core/cpu/cpu/Cpu.isHaltBug
     i32.const 0
     global.set $core/cpu/cpu/Cpu.isStopped
     i32.const 24
    else
     i32.const 20
    end
   else
    i32.const 0
   end
   i32.const 1
   global.get $core/cpu/cpu/Cpu.isHaltNoJump
   global.get $core/cpu/cpu/Cpu.isHaltNormal
   select
   if
    i32.const 0
    global.set $core/cpu/cpu/Cpu.isHaltNoJump
    i32.const 0
    global.set $core/cpu/cpu/Cpu.isHaltNormal
    i32.const 0
    global.set $core/cpu/cpu/Cpu.isHaltBug
    i32.const 0
    global.set $core/cpu/cpu/Cpu.isStopped
   end
   return
  end
  i32.const 0
 )
 (func $core/execute/executeStep (result i32)
  (local $0 i32)
  (local $1 i32)
  i32.const 1
  global.set $core/core/hasStarted
  global.get $core/cpu/cpu/Cpu.isHaltBug
  if
   global.get $core/cpu/cpu/Cpu.programCounter
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   call $core/cpu/opcodes/executeOpcode
   call $core/cycles/syncCycles
   i32.const 0
   global.set $core/cpu/cpu/Cpu.isHaltNoJump
   i32.const 0
   global.set $core/cpu/cpu/Cpu.isHaltNormal
   i32.const 0
   global.set $core/cpu/cpu/Cpu.isHaltBug
   i32.const 0
   global.set $core/cpu/cpu/Cpu.isStopped
  end
  call $core/interrupts/interrupts/checkInterrupts
  local.tee $1
  i32.const 0
  i32.gt_s
  if
   local.get $1
   call $core/cycles/syncCycles
  end
  i32.const 0
  global.get $core/cpu/cpu/Cpu.isStopped
  i32.eqz
  i32.const 1
  global.get $core/cpu/cpu/Cpu.isHaltNoJump
  global.get $core/cpu/cpu/Cpu.isHaltNormal
  select
  select
  if (result i32)
   global.get $core/cpu/cpu/Cpu.programCounter
   call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
   i32.load8_u
   call $core/cpu/opcodes/executeOpcode
  else
   i32.const 4
  end
  local.set $1
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 240
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
  local.get $1
  i32.const 0
  i32.le_s
  if
   local.get $1
   return
  end
  local.get $1
  call $core/cycles/syncCycles
  global.get $core/execute/Execute.steps
  i32.const 1
  i32.add
  local.tee $0
  global.get $core/execute/Execute.stepsPerStepSet
  i32.ge_s
  if (result i32)
   global.get $core/execute/Execute.stepSets
   i32.const 1
   i32.add
   global.set $core/execute/Execute.stepSets
   local.get $0
   global.get $core/execute/Execute.stepsPerStepSet
   i32.sub
  else
   local.get $0
  end
  global.set $core/execute/Execute.steps
  global.get $core/cpu/cpu/Cpu.programCounter
  global.get $core/debug/breakpoints/Breakpoints.programCounter
  i32.eq
  if
   i32.const 1
   global.set $core/debug/breakpoints/Breakpoints.reachedBreakpoint
  end
  local.get $1
 )
 (func $core/sound/sound/getNumberOfSamplesInAudioBuffer (result i32)
  global.get $core/sound/sound/Sound.audioQueueIndex
 )
 (func $core/execute/executeUntilCondition (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  i32.const -1
  i32.const 1024
  local.get $0
  i32.const 0
  i32.lt_s
  select
  local.get $0
  i32.const 0
  i32.gt_s
  select
  local.set $0
  loop $while-continue|0
   global.get $core/debug/breakpoints/Breakpoints.reachedBreakpoint
   i32.eqz
   i32.const 0
   local.get $1
   i32.eqz
   i32.const 0
   i32.const 0
   local.get $2
   i32.eqz
   local.get $3
   select
   select
   select
   if
    call $core/execute/executeStep
    i32.const 0
    i32.lt_s
    if
     i32.const 1
     local.set $3
    else
     global.get $core/cpu/cpu/Cpu.currentCycles
     i32.const 70224
     global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
     i32.shl
     i32.ge_s
     if
      i32.const 1
      local.set $2
     else
      i32.const 1
      local.get $1
      global.get $core/sound/sound/Sound.audioQueueIndex
      local.get $0
      i32.ge_s
      i32.const 0
      local.get $0
      i32.const -1
      i32.gt_s
      select
      select
      local.set $1
     end
    end
    br $while-continue|0
   end
  end
  local.get $2
  if
   global.get $core/cpu/cpu/Cpu.currentCycles
   i32.const 70224
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   i32.sub
   global.set $core/cpu/cpu/Cpu.currentCycles
   i32.const 0
   return
  end
  local.get $1
  if
   i32.const 1
   return
  end
  global.get $core/debug/breakpoints/Breakpoints.reachedBreakpoint
  if
   i32.const 0
   global.set $core/debug/breakpoints/Breakpoints.reachedBreakpoint
   i32.const 2
   return
  end
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.sub
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.programCounter
  i32.const -1
 )
 (func $core/execute/executeFrame (result i32)
  i32.const -1
  call $core/execute/executeUntilCondition
 )
 (func $core/execute/executeMultipleFrames (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  loop $while-continue|0
   local.get $1
   i32.const 0
   i32.ge_s
   i32.const 0
   local.get $2
   local.get $0
   i32.lt_s
   select
   if
    i32.const -1
    call $core/execute/executeUntilCondition
    local.set $1
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $while-continue|0
   end
  end
  local.get $1
  i32.const 0
  i32.lt_s
  if
   local.get $1
   return
  end
  i32.const 0
 )
 (func $core/cycles/getCyclesPerCycleSet (result i32)
  global.get $core/cycles/Cycles.cyclesPerCycleSet
 )
 (func $core/cycles/getCycleSets (result i32)
  global.get $core/cycles/Cycles.cycleSets
 )
 (func $core/cycles/getCycles (result i32)
  global.get $core/cycles/Cycles.cycles
 )
 (func $core/joypad/joypad/_pressJoypadButton (param $0 i32)
  (local $1 i32)
  i32.const 0
  global.set $core/cpu/cpu/Cpu.isStopped
  block $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId (result i32)
   block $case8|0
    block $case7|0
     block $case6|0
      block $case5|0
       block $case4|0
        block $case3|0
         block $case2|0
          block $case1|0
           block $case0|0
            local.get $0
            br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0
           end
           global.get $core/joypad/joypad/Joypad.up
           br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
          end
          global.get $core/joypad/joypad/Joypad.right
          br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
         end
         global.get $core/joypad/joypad/Joypad.down
         br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
        end
        global.get $core/joypad/joypad/Joypad.left
        br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
       end
       global.get $core/joypad/joypad/Joypad.a
       br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
      end
      global.get $core/joypad/joypad/Joypad.b
      br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
     end
     global.get $core/joypad/joypad/Joypad.select
     br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
    end
    global.get $core/joypad/joypad/Joypad.start
    br $__inlined_func$core/joypad/joypad/_getJoypadButtonStateFromButtonId
   end
   i32.const 0
  end
  i32.eqz
  block $break|0
   block $case7|00
    block $case6|01
     block $case5|02
      block $case4|03
       block $case3|04
        block $case2|05
         block $case1|06
          block $case0|07
           local.get $0
           br_table $case0|07 $case1|06 $case2|05 $case3|04 $case4|03 $case5|02 $case6|01 $case7|00 $break|0
          end
          i32.const 1
          global.set $core/joypad/joypad/Joypad.up
          br $break|0
         end
         i32.const 1
         global.set $core/joypad/joypad/Joypad.right
         br $break|0
        end
        i32.const 1
        global.set $core/joypad/joypad/Joypad.down
        br $break|0
       end
       i32.const 1
       global.set $core/joypad/joypad/Joypad.left
       br $break|0
      end
      i32.const 1
      global.set $core/joypad/joypad/Joypad.a
      br $break|0
     end
     i32.const 1
     global.set $core/joypad/joypad/Joypad.b
     br $break|0
    end
    i32.const 1
    global.set $core/joypad/joypad/Joypad.select
    br $break|0
   end
   i32.const 1
   global.set $core/joypad/joypad/Joypad.start
  end
  if
   i32.const 1
   local.get $0
   i32.const 3
   i32.le_s
   local.tee $1
   i32.const 0
   global.get $core/joypad/joypad/Joypad.isDpadType
   select
   if (result i32)
    i32.const 1
   else
    i32.const 0
   end
   local.get $1
   i32.eqz
   i32.const 0
   global.get $core/joypad/joypad/Joypad.isButtonType
   select
   select
   if
    i32.const 1
    global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
    i32.const 4
    call $core/interrupts/interrupts/_requestInterrupt
   end
  end
 )
 (func $core/joypad/joypad/setJoypadState (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32)
  local.get $0
  i32.const 0
  i32.gt_s
  if
   i32.const 0
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.up
  end
  local.get $1
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.right
  end
  local.get $2
  i32.const 0
  i32.gt_s
  if
   i32.const 2
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.down
  end
  local.get $3
  i32.const 0
  i32.gt_s
  if
   i32.const 3
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.left
  end
  local.get $4
  i32.const 0
  i32.gt_s
  if
   i32.const 4
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.a
  end
  local.get $5
  i32.const 0
  i32.gt_s
  if
   i32.const 5
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.b
  end
  local.get $6
  i32.const 0
  i32.gt_s
  if
   i32.const 6
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.select
  end
  local.get $7
  i32.const 0
  i32.gt_s
  if
   i32.const 7
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   global.set $core/joypad/joypad/Joypad.start
  end
 )
 (func $core/debug/breakpoints/setProgramCounterBreakpoint (param $0 i32)
  local.get $0
  global.set $core/debug/breakpoints/Breakpoints.programCounter
 )
 (func $core/debug/breakpoints/resetProgramCounterBreakpoint
  i32.const -1
  global.set $core/debug/breakpoints/Breakpoints.programCounter
 )
 (func $core/debug/breakpoints/setReadGbMemoryBreakpoint (param $0 i32)
  local.get $0
  global.set $core/debug/breakpoints/Breakpoints.readGbMemory
 )
 (func $core/debug/breakpoints/resetReadGbMemoryBreakpoint
  i32.const -1
  global.set $core/debug/breakpoints/Breakpoints.readGbMemory
 )
 (func $core/debug/breakpoints/setWriteGbMemoryBreakpoint (param $0 i32)
  local.get $0
  global.set $core/debug/breakpoints/Breakpoints.writeGbMemory
 )
 (func $core/debug/breakpoints/resetWriteGbMemoryBreakpoint
  i32.const -1
  global.set $core/debug/breakpoints/Breakpoints.writeGbMemory
 )
 (func $core/debug/debug-cpu/getRegisterA (result i32)
  global.get $core/cpu/cpu/Cpu.registerA
 )
 (func $core/debug/debug-cpu/getRegisterB (result i32)
  global.get $core/cpu/cpu/Cpu.registerB
 )
 (func $core/debug/debug-cpu/getRegisterC (result i32)
  global.get $core/cpu/cpu/Cpu.registerC
 )
 (func $core/debug/debug-cpu/getRegisterD (result i32)
  global.get $core/cpu/cpu/Cpu.registerD
 )
 (func $core/debug/debug-cpu/getRegisterE (result i32)
  global.get $core/cpu/cpu/Cpu.registerE
 )
 (func $core/debug/debug-cpu/getRegisterH (result i32)
  global.get $core/cpu/cpu/Cpu.registerH
 )
 (func $core/debug/debug-cpu/getRegisterL (result i32)
  global.get $core/cpu/cpu/Cpu.registerL
 )
 (func $core/debug/debug-cpu/getRegisterF (result i32)
  global.get $core/cpu/cpu/Cpu.registerF
 )
 (func $core/debug/debug-cpu/getProgramCounter (result i32)
  global.get $core/cpu/cpu/Cpu.programCounter
 )
 (func $core/debug/debug-cpu/getStackPointer (result i32)
  global.get $core/cpu/cpu/Cpu.stackPointer
 )
 (func $core/debug/debug-cpu/getOpcodeAtProgramCounter (result i32)
  global.get $core/cpu/cpu/Cpu.programCounter
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
 )
 (func $core/debug/debug-graphics/getLY (result i32)
  global.get $core/graphics/graphics/Graphics.scanlineRegister
 )
 (func $core/debug/debug-graphics/getScrollX (result i32)
  global.get $core/graphics/graphics/Graphics.scrollX
 )
 (func $core/debug/debug-graphics/getScrollY (result i32)
  global.get $core/graphics/graphics/Graphics.scrollY
 )
 (func $core/debug/debug-graphics/getWindowX (result i32)
  global.get $core/graphics/graphics/Graphics.windowX
 )
 (func $core/debug/debug-graphics/getWindowY (result i32)
  global.get $core/graphics/graphics/Graphics.windowY
 )
 (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  i32.const 32768
  i32.const 34816
  global.get $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  select
  local.set $4
  i32.const 39936
  i32.const 38912
  global.get $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
  select
  local.set $9
  loop $for-loop|0
   local.get $6
   i32.const 256
   i32.lt_s
   if
    i32.const 0
    local.set $5
    loop $for-loop|1
     local.get $5
     i32.const 256
     i32.lt_s
     if
      local.get $9
      local.get $6
      i32.const 3
      i32.shr_s
      i32.const 5
      i32.shl
      i32.add
      local.get $5
      i32.const 3
      i32.shr_s
      i32.add
      local.tee $7
      i32.const -30720
      i32.add
      i32.load8_u
      local.set $1
      local.get $6
      i32.const 8
      i32.rem_s
      local.set $2
      i32.const 7
      local.get $5
      i32.const 8
      i32.rem_s
      i32.sub
      local.set $8
      local.get $4
      local.get $4
      i32.const 34816
      i32.eq
      if (result i32)
       local.get $1
       i32.const 128
       i32.sub
       local.get $1
       i32.const 128
       i32.add
       local.get $1
       i32.const 128
       i32.and
       select
      else
       local.get $1
      end
      i32.const 4
      i32.shl
      i32.add
      local.set $3
      local.get $0
      i32.const 0
      i32.gt_s
      i32.const 0
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      select
      if (result i32)
       local.get $7
       i32.const -22528
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.tee $1
      i32.const 64
      i32.and
      if
       i32.const 7
       local.get $2
       i32.sub
       local.set $2
      end
      local.get $1
      i32.const 8
      i32.and
      i32.eqz
      i32.eqz
      i32.const 13
      i32.shl
      local.tee $7
      local.get $3
      local.get $2
      i32.const 1
      i32.shl
      i32.add
      local.tee $3
      i32.const -30720
      i32.add
      i32.add
      i32.load8_u
      local.set $2
      local.get $7
      local.get $3
      i32.const -30719
      i32.add
      i32.add
      i32.load8_u
      i32.const 1
      local.get $8
      i32.shl
      i32.and
      if (result i32)
       i32.const 2
      else
       i32.const 0
      end
      local.tee $3
      i32.const 1
      i32.add
      local.get $3
      local.get $2
      i32.const 1
      local.get $8
      i32.shl
      i32.and
      select
      local.set $3
      local.get $5
      local.get $6
      i32.const 8
      i32.shl
      i32.add
      i32.const 3
      i32.mul
      local.set $2
      local.get $0
      i32.const 0
      i32.gt_s
      i32.const 0
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      select
      if
       local.get $2
       i32.const 184448
       i32.add
       local.tee $2
       local.get $1
       i32.const 7
       i32.and
       i32.const 3
       i32.shl
       local.get $3
       i32.const 1
       i32.shl
       i32.add
       local.tee $1
       i32.const 1
       i32.add
       i32.const 63
       i32.and
       i32.const 67584
       i32.add
       i32.load8_u
       i32.const 8
       i32.shl
       local.get $1
       i32.const 63
       i32.and
       i32.const 67584
       i32.add
       i32.load8_u
       i32.or
       local.tee $1
       i32.const 31
       i32.and
       i32.const 3
       i32.shl
       i32.store8
       local.get $2
       local.get $1
       i32.const 992
       i32.and
       i32.const 5
       i32.shr_u
       i32.const 3
       i32.shl
       i32.store8 offset=1
       local.get $2
       local.get $1
       i32.const 31744
       i32.and
       i32.const 10
       i32.shr_u
       i32.const 3
       i32.shl
       i32.store8 offset=2
      else
       local.get $2
       i32.const 184448
       i32.add
       local.tee $1
       local.get $3
       i32.const 65351
       call $core/graphics/palette/getColorizedGbHexColorFromPalette
       local.tee $3
       i32.const 16711680
       i32.and
       i32.const 16
       i32.shr_u
       i32.store8
       local.get $1
       local.get $3
       i32.const 65280
       i32.and
       i32.const 8
       i32.shr_u
       i32.store8 offset=1
       local.get $1
       local.get $3
       i32.store8 offset=2
      end
      local.get $5
      i32.const 1
      i32.add
      local.set $5
      br $for-loop|1
     end
    end
    local.get $6
    i32.const 1
    i32.add
    local.set $6
    br $for-loop|0
   end
  end
 )
 (func $core/debug/debug-graphics/drawTileDataToWasmMemory
  (local $0 i32)
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
  loop $for-loop|0
   local.get $2
   i32.const 23
   i32.lt_s
   if
    i32.const 0
    local.set $5
    loop $for-loop|1
     local.get $5
     i32.const 31
     i32.lt_s
     if
      local.get $5
      i32.const 15
      i32.gt_s
      local.set $9
      local.get $2
      local.tee $1
      i32.const 15
      i32.gt_s
      if (result i32)
       local.get $1
       i32.const 15
       i32.sub
      else
       local.get $1
      end
      i32.const 4
      i32.shl
      local.tee $1
      local.get $5
      i32.const 15
      i32.sub
      i32.add
      local.get $1
      local.get $5
      i32.add
      local.get $5
      i32.const 15
      i32.gt_s
      select
      local.set $7
      i32.const 65351
      local.set $10
      i32.const -1
      local.set $3
      i32.const 0
      local.set $0
      loop $for-loop|2
       local.get $0
       i32.const 8
       i32.lt_s
       if
        i32.const 0
        local.set $4
        loop $for-loop|3
         local.get $4
         i32.const 5
         i32.lt_s
         if
          local.get $7
          local.get $0
          local.get $4
          i32.const 3
          i32.shl
          i32.add
          i32.const 2
          i32.shl
          local.tee $1
          i32.const 65026
          i32.add
          call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
          i32.load8_u
          i32.eq
          if
           local.get $9
           local.get $1
           i32.const 65027
           i32.add
           call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
           i32.load8_u
           local.tee $1
           i32.const 8
           i32.and
           i32.const 0
           global.get $core/cpu/cpu/Cpu.GBCEnabled
           select
           i32.eqz
           i32.eqz
           i32.eq
           if
            i32.const 5
            local.set $4
            i32.const 65353
            i32.const 65352
            local.get $1
            local.tee $3
            i32.const 16
            i32.and
            select
            local.set $10
            i32.const 8
            local.set $0
           end
          end
          local.get $4
          i32.const 1
          i32.add
          local.set $4
          br $for-loop|3
         end
        end
        local.get $0
        i32.const 1
        i32.add
        local.set $0
        br $for-loop|2
       end
      end
      local.get $3
      i32.const 0
      i32.lt_s
      i32.const 0
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      select
      if (result i32)
       i32.const 39936
       i32.const 38912
       global.get $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
       select
       local.set $8
       i32.const -1
       local.set $0
       i32.const 0
       local.set $4
       loop $for-loop|4
        local.get $4
        i32.const 32
        i32.lt_s
        if
         i32.const 0
         local.set $6
         loop $for-loop|5
          local.get $6
          i32.const 32
          i32.lt_s
          if
           local.get $7
           local.get $4
           local.get $8
           local.get $6
           i32.const 5
           i32.shl
           i32.add
           i32.add
           local.tee $1
           i32.const -30720
           i32.add
           i32.load8_u
           i32.eq
           if
            i32.const 32
            local.set $4
            i32.const 32
            local.set $6
            local.get $1
            local.set $0
           end
           local.get $6
           i32.const 1
           i32.add
           local.set $6
           br $for-loop|5
          end
         end
         local.get $4
         i32.const 1
         i32.add
         local.set $4
         br $for-loop|4
        end
       end
       local.get $0
       i32.const 0
       i32.ge_s
       if (result i32)
        local.get $0
        i32.const -22528
        i32.add
        i32.load8_u
       else
        i32.const -1
       end
      else
       i32.const -1
      end
      local.set $1
      i32.const 34816
      i32.const 32768
      local.get $2
      i32.const 15
      i32.gt_s
      select
      local.set $8
      i32.const 0
      local.set $0
      loop $for-loop|6
       local.get $0
       i32.const 8
       i32.lt_s
       if
        local.get $7
        local.get $8
        local.get $9
        i32.const 0
        i32.const 7
        local.get $0
        local.get $5
        i32.const 3
        i32.shl
        local.get $0
        local.get $2
        i32.const 3
        i32.shl
        i32.add
        i32.const 248
        i32.const 381056
        local.get $10
        local.get $1
        local.get $3
        call $core/graphics/tiles/drawPixelsFromLineOfTile
        drop
        local.get $0
        i32.const 1
        i32.add
        local.set $0
        br $for-loop|6
       end
      end
      local.get $5
      i32.const 1
      i32.add
      local.set $5
      br $for-loop|1
     end
    end
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
 )
 (func $core/debug/debug-graphics/drawOamToWasmMemory
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  loop $for-loop|0
   local.get $4
   i32.const 8
   i32.lt_s
   if
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $2
     i32.const 5
     i32.lt_s
     if
      local.get $4
      local.get $2
      i32.const 3
      i32.shl
      i32.add
      i32.const 2
      i32.shl
      local.tee $1
      i32.const 65024
      i32.add
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      drop
      local.get $1
      i32.const 65025
      i32.add
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      drop
      local.get $1
      i32.const 65026
      i32.add
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      local.set $0
      i32.const 1
      local.set $5
      global.get $core/graphics/lcd/Lcd.tallSpriteSize
      if
       i32.const 2
       local.set $5
       local.get $0
       i32.const 2
       i32.rem_s
       i32.const 1
       i32.eq
       if (result i32)
        local.get $0
        i32.const 1
        i32.sub
       else
        local.get $0
       end
       local.set $0
      end
      local.get $1
      i32.const 65027
      i32.add
      call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
      i32.load8_u
      local.tee $6
      i32.const 8
      i32.and
      i32.const 0
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      select
      i32.eqz
      i32.eqz
      local.set $7
      i32.const 65353
      i32.const 65352
      local.get $6
      i32.const 16
      i32.and
      select
      local.set $8
      i32.const 0
      local.set $1
      loop $for-loop|2
       local.get $1
       local.get $5
       i32.lt_s
       if
        i32.const 0
        local.set $3
        loop $for-loop|3
         local.get $3
         i32.const 8
         i32.lt_s
         if
          local.get $0
          local.get $1
          i32.add
          i32.const 32768
          local.get $7
          i32.const 0
          i32.const 7
          local.get $3
          local.get $4
          i32.const 3
          i32.shl
          local.get $3
          local.get $2
          i32.const 4
          i32.shl
          i32.add
          local.get $1
          i32.const 3
          i32.shl
          i32.add
          i32.const 64
          i32.const 528512
          local.get $8
          i32.const -1
          local.get $6
          call $core/graphics/tiles/drawPixelsFromLineOfTile
          drop
          local.get $3
          i32.const 1
          i32.add
          local.set $3
          br $for-loop|3
         end
        end
        local.get $1
        i32.const 1
        i32.add
        local.set $1
        br $for-loop|2
       end
      end
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
 )
 (func $core/debug/debug-timer/getDIV (result i32)
  global.get $core/timers/timers/Timers.dividerRegister
 )
 (func $core/debug/debug-timer/getTIMA (result i32)
  global.get $core/timers/timers/Timers.timerCounter
 )
 (func $core/debug/debug-timer/getTMA (result i32)
  global.get $core/timers/timers/Timers.timerModulo
 )
 (func $core/debug/debug-timer/getTAC (result i32)
  (local $0 i32)
  global.get $core/timers/timers/Timers.timerInputClock
  local.tee $0
  i32.const 4
  i32.or
  local.get $0
  global.get $core/timers/timers/Timers.timerEnabled
  select
 )
 (func $core/debug/debug-memory/updateDebugGBMemory
  (local $0 i32)
  loop $for-loop|0
   local.get $0
   i32.const 65535
   i32.lt_s
   if
    local.get $0
    i32.const 9591424
    i32.add
    local.get $0
    call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
    i32.store8
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|0
   end
  end
  i32.const 0
  global.set $core/debug/breakpoints/Breakpoints.reachedBreakpoint
 )
 (func $~start
  i32.const 15921906
  global.set $core/graphics/colors/Colors.bgWhite
  i32.const 10526880
  global.set $core/graphics/colors/Colors.bgLightGrey
  i32.const 5789784
  global.set $core/graphics/colors/Colors.bgDarkGrey
  i32.const 526344
  global.set $core/graphics/colors/Colors.bgBlack
  i32.const 15921906
  global.set $core/graphics/colors/Colors.obj0White
  i32.const 10526880
  global.set $core/graphics/colors/Colors.obj0LightGrey
  i32.const 5789784
  global.set $core/graphics/colors/Colors.obj0DarkGrey
  i32.const 526344
  global.set $core/graphics/colors/Colors.obj0Black
  i32.const 15921906
  global.set $core/graphics/colors/Colors.obj1White
  i32.const 10526880
  global.set $core/graphics/colors/Colors.obj1LightGrey
  i32.const 5789784
  global.set $core/graphics/colors/Colors.obj1DarkGrey
  i32.const 526344
  global.set $core/graphics/colors/Colors.obj1Black
  memory.size
  i32.const 148
  i32.lt_s
  if
   i32.const 148
   memory.size
   i32.sub
   memory.grow
   drop
  end
 )
 (func $~lib/rt/pure/__collect
  nop
 )
 (func $~lib/rt/pure/decrement (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  i32.load offset=4
  local.tee $2
  i32.const 268435455
  i32.and
  local.set $1
  local.get $0
  i32.load
  i32.const 1
  i32.and
  if
   i32.const 0
   i32.const 1152
   i32.const 122
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 1
  i32.eq
  if
   block $__inlined_func$~lib/rt/__visit_members
    block $switch$1$default
     block $switch$1$case$4
      local.get $0
      i32.load offset=8
      br_table $__inlined_func$~lib/rt/__visit_members $__inlined_func$~lib/rt/__visit_members $switch$1$case$4 $switch$1$default
     end
     local.get $0
     i32.load offset=16
     local.tee $1
     if
      local.get $1
      i32.const 1212
      i32.ge_u
      if
       local.get $1
       i32.const 16
       i32.sub
       call $~lib/rt/pure/decrement
      end
     end
     br $__inlined_func$~lib/rt/__visit_members
    end
    unreachable
   end
   local.get $2
   i32.const -2147483648
   i32.and
   if
    i32.const 0
    i32.const 1152
    i32.const 126
    i32.const 18
    call $~lib/builtins/abort
    unreachable
   end
   local.get $0
   local.get $0
   i32.load
   i32.const 1
   i32.or
   i32.store
   global.get $~lib/rt/tlsf/ROOT
   local.get $0
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $1
   i32.const 0
   i32.le_u
   if
    i32.const 0
    i32.const 1152
    i32.const 136
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $0
   local.get $1
   i32.const 1
   i32.sub
   local.get $2
   i32.const -268435456
   i32.and
   i32.or
   i32.store offset=4
  end
 )
 (func $core/execute/executeFrameAndCheckAudio@varargs (param $0 i32) (result i32)
  block $1of1
   block $0of1
    block $outOfRange
     global.get $~argumentsLength
     br_table $0of1 $1of1 $outOfRange
    end
    unreachable
   end
   i32.const 0
   local.set $0
  end
  local.get $0
  call $core/execute/executeUntilCondition
 )
 (func $core/execute/executeUntilCondition@varargs (param $0 i32) (param $1 i32) (result i32)
  block $2of2
   block $1of2
    block $outOfRange
     global.get $~argumentsLength
     br_table $1of2 $1of2 $2of2 $outOfRange
    end
    unreachable
   end
   i32.const -1
   local.set $1
  end
  local.get $1
  call $core/execute/executeUntilCondition
 )
 (func $~setArgumentsLength (param $0 i32)
  local.get $0
  global.set $~argumentsLength
 )
)
