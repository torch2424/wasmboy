(module
 (type $FUNCSIG$iii (func (param i32 i32) (result i32)))
 (type $FUNCSIG$v (func))
 (type $FUNCSIG$iiii (func (param i32 i32 i32) (result i32)))
 (type $FUNCSIG$viiii (func (param i32 i32 i32 i32)))
 (type $FUNCSIG$vii (func (param i32 i32)))
 (type $FUNCSIG$ii (func (param i32) (result i32)))
 (type $FUNCSIG$vi (func (param i32)))
 (type $FUNCSIG$viii (func (param i32 i32 i32)))
 (type $FUNCSIG$viiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $FUNCSIG$i (func (result i32)))
 (type $FUNCSIG$viiiiii (func (param i32 i32 i32 i32 i32 i32)))
 (type $FUNCSIG$iiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $FUNCSIG$viiiiiii (func (param i32 i32 i32 i32 i32 i32 i32)))
 (type $FUNCSIG$iiiii (func (param i32 i32 i32 i32) (result i32)))
 (type $FUNCSIG$viiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $FUNCSIG$iiiiii (func (param i32 i32 i32 i32 i32) (result i32)))
 (type $FUNCSIG$iiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (memory $0 1)
 (data (i32.const 8) "\1e\00\00\00\01\00\00\00\01\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data (i32.const 56) "(\00\00\00\01\00\00\00\01\00\00\00(\00\00\00a\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data (i32.const 112) "\1e\00\00\00\01\00\00\00\01\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00p\00u\00r\00e\00.\00t\00s")
 (data (i32.const 160) "$\00\00\00\01\00\00\00\01\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e")
 (data (i32.const 216) "\14\00\00\00\01\00\00\00\01\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s")
 (data (i32.const 256) "\03\00\00\00\10\00\00\00\00\00\00\00\10\00\00\00\00\00\00\00\10")
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/collectLock (mut i32) (i32.const 0))
 (global $~lib/rt/pure/ROOTS (mut i32) (i32.const 0))
 (global $~lib/rt/pure/CUR (mut i32) (i32.const 0))
 (global $~lib/rt/pure/END (mut i32) (i32.const 0))
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
 (global $core/sound/sound/Sound.downSampleCycleCounter (mut i32) (i32.const 0))
 (global $core/sound/sound/Sound.frameSequencer (mut i32) (i32.const 0))
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
 (global $core/timers/timers/Timers.timerModulo (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerEnabled (mut i32) (i32.const 0))
 (global $core/timers/timers/Timers.timerInputClock (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.currentCycles (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.numberOfBitsTransferred (mut i32) (i32.const 0))
 (global $core/serial/serial/Serial.isShiftClockInternal (mut i32) (i32.const 0))
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
 (global $~lib/rt/__rtti_base i32 (i32.const 256))
 (global $~lib/argc (mut i32) (i32.const 0))
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
 (export "__setargc" (func $~lib/setargc))
 (export "executeFrameAndCheckAudio" (func $core/execute/executeFrameAndCheckAudio|trampoline))
 (export "executeUntilCondition" (func $core/execute/executeUntilCondition|trampoline))
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
 (export "drawBackgroundMapToWasmMemory" (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory))
 (export "drawTileDataToWasmMemory" (func $core/debug/debug-graphics/drawTileDataToWasmMemory))
 (export "drawOamToWasmMemory" (func $core/debug/debug-graphics/drawOamToWasmMemory))
 (export "getDIV" (func $core/debug/debug-timer/getDIV))
 (export "getTIMA" (func $core/debug/debug-timer/getTIMA))
 (export "getTMA" (func $core/debug/debug-timer/getTMA))
 (export "getTAC" (func $core/debug/debug-timer/getTAC))
 (export "updateDebugGBMemory" (func $core/debug/debug-memory/updateDebugGBMemory))
 (start $start)
 (func $~lib/rt/tlsf/removeBlock (; 1 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.load
  local.tee $3
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 277
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const -4
  i32.and
  local.tee $2
  i32.const 16
  i32.ge_u
  if (result i32)
   local.get $2
   i32.const 1073741808
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 279
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $2
   i32.const 4
   i32.shr_u
   local.set $2
   i32.const 0
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
  end
  local.tee $3
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $2
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 292
   i32.const 13
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
  local.get $3
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  local.get $0
  i32.add
  i32.load offset=96
  local.get $1
  i32.eq
  if
   local.get $3
   i32.const 4
   i32.shl
   local.get $2
   i32.add
   i32.const 2
   i32.shl
   local.get $0
   i32.add
   local.get $4
   i32.store offset=96
   local.get $4
   i32.eqz
   if
    local.get $3
    i32.const 2
    i32.shl
    local.get $0
    i32.add
    local.get $3
    i32.const 2
    i32.shl
    local.get $0
    i32.add
    i32.load offset=4
    i32.const 1
    local.get $2
    i32.shl
    i32.const -1
    i32.xor
    i32.and
    local.tee $1
    i32.store offset=4
    local.get $1
    i32.eqz
    if
     local.get $0
     local.get $0
     i32.load
     i32.const 1
     local.get $3
     i32.shl
     i32.const -1
     i32.xor
     i32.and
     i32.store
    end
   end
  end
 )
 (func $~lib/rt/tlsf/insertBlock (; 2 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  local.get $1
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 205
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load
  local.tee $3
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 207
   i32.const 13
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
  local.tee $4
  i32.load
  local.tee $5
  i32.const 1
  i32.and
  if
   local.get $3
   i32.const -4
   i32.and
   i32.const 16
   i32.add
   local.get $5
   i32.const -4
   i32.and
   i32.add
   local.tee $2
   i32.const 1073741808
   i32.lt_u
   if
    local.get $0
    local.get $4
    call $~lib/rt/tlsf/removeBlock
    local.get $1
    local.get $3
    i32.const 3
    i32.and
    local.get $2
    i32.or
    local.tee $3
    i32.store
    local.get $1
    i32.const 16
    i32.add
    local.get $1
    i32.load
    i32.const -4
    i32.and
    i32.add
    local.tee $4
    i32.load
    local.set $5
   end
  end
  local.get $3
  i32.const 2
  i32.and
  if
   local.get $1
   i32.const 4
   i32.sub
   i32.load
   local.tee $2
   i32.load
   local.tee $6
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 0
    i32.const 24
    i32.const 228
    i32.const 15
    call $~lib/builtins/abort
    unreachable
   end
   local.get $6
   i32.const -4
   i32.and
   i32.const 16
   i32.add
   local.get $3
   i32.const -4
   i32.and
   i32.add
   local.tee $7
   i32.const 1073741808
   i32.lt_u
   if (result i32)
    local.get $0
    local.get $2
    call $~lib/rt/tlsf/removeBlock
    local.get $2
    local.get $6
    i32.const 3
    i32.and
    local.get $7
    i32.or
    local.tee $3
    i32.store
    local.get $2
   else
    local.get $1
   end
   local.set $1
  end
  local.get $4
  local.get $5
  i32.const 2
  i32.or
  i32.store
  local.get $3
  i32.const -4
  i32.and
  local.tee $2
  i32.const 16
  i32.ge_u
  if (result i32)
   local.get $2
   i32.const 1073741808
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 243
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $1
  i32.const 16
  i32.add
  local.get $2
  i32.add
  i32.ne
  if
   i32.const 0
   i32.const 24
   i32.const 244
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  i32.const 4
  i32.sub
  local.get $1
  i32.store
  local.get $2
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $2
   i32.const 4
   i32.shr_u
   local.set $4
   i32.const 0
  else
   local.get $2
   i32.const 31
   local.get $2
   i32.clz
   i32.sub
   local.tee $2
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $4
   local.get $2
   i32.const 7
   i32.sub
  end
  local.tee $3
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $4
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 260
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const 4
  i32.shl
  local.get $4
  i32.add
  i32.const 2
  i32.shl
  local.get $0
  i32.add
  i32.load offset=96
  local.set $2
  local.get $1
  i32.const 0
  i32.store offset=16
  local.get $1
  local.get $2
  i32.store offset=20
  local.get $2
  if
   local.get $2
   local.get $1
   i32.store offset=16
  end
  local.get $3
  i32.const 4
  i32.shl
  local.get $4
  i32.add
  i32.const 2
  i32.shl
  local.get $0
  i32.add
  local.get $1
  i32.store offset=96
  local.get $0
  local.get $0
  i32.load
  i32.const 1
  local.get $3
  i32.shl
  i32.or
  i32.store
  local.get $3
  i32.const 2
  i32.shl
  local.get $0
  i32.add
  local.get $3
  i32.const 2
  i32.shl
  local.get $0
  i32.add
  i32.load offset=4
  i32.const 1
  local.get $4
  i32.shl
  i32.or
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/addMemory (; 3 ;) (type $FUNCSIG$viii) (param $0 i32) (param $1 i32) (param $2 i32)
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
   i32.const 24
   i32.const 386
   i32.const 4
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
    i32.const 24
    i32.const 396
    i32.const 15
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   i32.const 16
   i32.sub
   local.get $3
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
    i32.const 24
    i32.const 408
    i32.const 4
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
 (func $~lib/rt/tlsf/initializeRoot (; 4 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
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
  i32.const 288
  i32.const 0
  i32.store
  i32.const 1856
  i32.const 0
  i32.store
  i32.const 0
  local.set $0
  loop $loop|0
   block $break|0
    local.get $0
    i32.const 23
    i32.ge_u
    br_if $break|0
    local.get $0
    i32.const 2
    i32.shl
    i32.const 288
    i32.add
    i32.const 0
    i32.store offset=4
    i32.const 0
    local.set $1
    loop $loop|1
     block $break|1
      local.get $1
      i32.const 16
      i32.ge_u
      br_if $break|1
      local.get $0
      i32.const 4
      i32.shl
      local.get $1
      i32.add
      i32.const 2
      i32.shl
      i32.const 288
      i32.add
      i32.const 0
      i32.store offset=96
      local.get $1
      i32.const 1
      i32.add
      local.set $1
      br $loop|1
     end
    end
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $loop|0
   end
  end
  i32.const 288
  i32.const 1872
  memory.size
  i32.const 16
  i32.shl
  call $~lib/rt/tlsf/addMemory
  i32.const 288
  global.set $~lib/rt/tlsf/ROOT
 )
 (func $~lib/rt/tlsf/prepareSize (; 5 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  i32.const 1073741808
  i32.ge_u
  if
   i32.const 72
   i32.const 24
   i32.const 457
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 15
  i32.add
  i32.const -16
  i32.and
  local.tee $0
  i32.const 16
  local.get $0
  i32.const 16
  i32.gt_u
  select
 )
 (func $~lib/rt/tlsf/searchBlock (; 6 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $1
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $1
   i32.const 4
   i32.shr_u
   local.set $1
   i32.const 0
  else
   local.get $1
   i32.const 536870904
   i32.lt_u
   if
    i32.const 1
    i32.const 27
    local.get $1
    i32.clz
    i32.sub
    i32.shl
    local.get $1
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
  end
  local.tee $2
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $1
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 338
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  i32.const 2
  i32.shl
  local.get $0
  i32.add
  i32.load offset=4
  i32.const -1
  local.get $1
  i32.shl
  i32.and
  local.tee $1
  if (result i32)
   local.get $1
   i32.ctz
   local.get $2
   i32.const 4
   i32.shl
   i32.add
   i32.const 2
   i32.shl
   local.get $0
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
    local.get $1
    i32.ctz
    local.tee $1
    i32.const 2
    i32.shl
    local.get $0
    i32.add
    i32.load offset=4
    local.tee $2
    i32.eqz
    if
     i32.const 0
     i32.const 24
     i32.const 351
     i32.const 17
     call $~lib/builtins/abort
     unreachable
    end
    local.get $2
    i32.ctz
    local.get $1
    i32.const 4
    i32.shl
    i32.add
    i32.const 2
    i32.shl
    local.get $0
    i32.add
    i32.load offset=96
   else
    i32.const 0
   end
  end
 )
 (func $~lib/rt/pure/markGray (; 7 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  local.get $0
  i32.load offset=4
  local.tee $1
  i32.const 1879048192
  i32.and
  i32.const 268435456
  i32.ne
  if
   local.get $0
   local.get $1
   i32.const -1879048193
   i32.and
   i32.const 268435456
   i32.or
   i32.store offset=4
   local.get $0
   i32.const 16
   i32.add
   i32.const 2
   call $~lib/rt/__visit_members
  end
 )
 (func $~lib/rt/tlsf/freeBlock (; 8 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $1
  i32.load
  local.tee $2
  i32.const 1
  i32.and
  if
   i32.const 0
   i32.const 24
   i32.const 563
   i32.const 2
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $2
  i32.const 1
  i32.or
  i32.store
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/pure/scanBlack (; 9 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  local.get $0
  i32.load offset=4
  i32.const -1879048193
  i32.and
  i32.store offset=4
  local.get $0
  i32.const 16
  i32.add
  i32.const 4
  call $~lib/rt/__visit_members
 )
 (func $~lib/rt/pure/scan (; 10 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  local.get $0
  i32.load offset=4
  local.tee $1
  i32.const 1879048192
  i32.and
  i32.const 268435456
  i32.eq
  if
   local.get $1
   i32.const 268435455
   i32.and
   i32.const 0
   i32.gt_u
   if
    local.get $0
    call $~lib/rt/pure/scanBlack
   else
    local.get $0
    local.get $1
    i32.const -1879048193
    i32.and
    i32.const 536870912
    i32.or
    i32.store offset=4
    local.get $0
    i32.const 16
    i32.add
    i32.const 3
    call $~lib/rt/__visit_members
   end
  end
 )
 (func $~lib/rt/pure/collectWhite (; 11 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  local.get $0
  i32.load offset=4
  local.tee $1
  i32.const 1879048192
  i32.and
  i32.const 536870912
  i32.eq
  if (result i32)
   local.get $1
   i32.const -2147483648
   i32.and
   i32.eqz
  else
   i32.const 0
  end
  if
   local.get $0
   local.get $1
   i32.const -1879048193
   i32.and
   i32.store offset=4
   local.get $0
   i32.const 16
   i32.add
   i32.const 5
   call $~lib/rt/__visit_members
   global.get $~lib/rt/tlsf/ROOT
   local.get $0
   call $~lib/rt/tlsf/freeBlock
  end
 )
 (func $~lib/rt/pure/__collect (; 12 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $~lib/rt/pure/ROOTS
  local.tee $5
  local.tee $2
  local.set $3
  global.get $~lib/rt/pure/CUR
  local.set $0
  loop $loop|0
   block $break|0
    local.get $3
    local.get $0
    i32.ge_u
    br_if $break|0
    local.get $3
    i32.load
    local.tee $4
    i32.load offset=4
    local.tee $1
    i32.const 1879048192
    i32.and
    i32.const 805306368
    i32.eq
    if (result i32)
     local.get $1
     i32.const 268435455
     i32.and
     i32.const 0
     i32.gt_u
    else
     i32.const 0
    end
    if
     local.get $4
     call $~lib/rt/pure/markGray
     local.get $2
     local.get $4
     i32.store
     local.get $2
     i32.const 4
     i32.add
     local.set $2
    else
     i32.const 0
     local.get $1
     i32.const 268435455
     i32.and
     i32.eqz
     local.get $1
     i32.const 1879048192
     i32.and
     select
     if
      global.get $~lib/rt/tlsf/ROOT
      local.get $4
      call $~lib/rt/tlsf/freeBlock
     else
      local.get $4
      local.get $1
      i32.const 2147483647
      i32.and
      i32.store offset=4
     end
    end
    local.get $3
    i32.const 4
    i32.add
    local.set $3
    br $loop|0
   end
  end
  local.get $2
  global.set $~lib/rt/pure/CUR
  local.get $5
  local.set $0
  loop $loop|1
   block $break|1
    local.get $0
    local.get $2
    i32.ge_u
    br_if $break|1
    local.get $0
    i32.load
    call $~lib/rt/pure/scan
    local.get $0
    i32.const 4
    i32.add
    local.set $0
    br $loop|1
   end
  end
  local.get $5
  local.set $0
  loop $loop|2
   block $break|2
    local.get $0
    local.get $2
    i32.ge_u
    br_if $break|2
    local.get $0
    i32.load
    local.tee $1
    local.get $1
    i32.load offset=4
    i32.const 2147483647
    i32.and
    i32.store offset=4
    local.get $1
    call $~lib/rt/pure/collectWhite
    local.get $0
    i32.const 4
    i32.add
    local.set $0
    br $loop|2
   end
  end
  local.get $5
  global.set $~lib/rt/pure/CUR
 )
 (func $~lib/rt/tlsf/growMemory (; 13 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  memory.size
  local.tee $2
  local.get $1
  i32.const 536870904
  i32.lt_u
  if (result i32)
   i32.const 1
   i32.const 27
   local.get $1
   i32.clz
   i32.sub
   i32.shl
   i32.const 1
   i32.sub
   local.get $1
   i32.add
  else
   local.get $1
  end
  i32.const 16
  local.get $0
  i32.load offset=1568
  local.get $2
  i32.const 16
  i32.shl
  i32.const 16
  i32.sub
  i32.ne
  i32.shl
  i32.add
  i32.const 65535
  i32.add
  i32.const -65536
  i32.and
  i32.const 16
  i32.shr_u
  local.tee $1
  local.get $2
  local.get $1
  i32.gt_s
  select
  memory.grow
  i32.const 0
  i32.lt_s
  if
   local.get $1
   memory.grow
   i32.const 0
   i32.lt_s
   if
    unreachable
   end
  end
  local.get $0
  local.get $2
  i32.const 16
  i32.shl
  memory.size
  i32.const 16
  i32.shl
  call $~lib/rt/tlsf/addMemory
 )
 (func $~lib/rt/tlsf/prepareBlock (; 14 ;) (type $FUNCSIG$viii) (param $0 i32) (param $1 i32) (param $2 i32)
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
   i32.const 24
   i32.const 365
   i32.const 13
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
   local.get $3
   i32.const 2
   i32.and
   local.get $2
   i32.or
   i32.store
   local.get $1
   i32.const 16
   i32.add
   local.get $2
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
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.get $1
   i32.const 16
   i32.add
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
 (func $~lib/rt/tlsf/allocateBlock (; 15 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  global.get $~lib/rt/tlsf/collectLock
  if
   i32.const 0
   i32.const 24
   i32.const 486
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/prepareSize
  local.tee $3
  call $~lib/rt/tlsf/searchBlock
  local.tee $2
  i32.eqz
  if
   i32.const 1
   global.set $~lib/rt/tlsf/collectLock
   call $~lib/rt/pure/__collect
   i32.const 0
   global.set $~lib/rt/tlsf/collectLock
   local.get $0
   local.get $3
   call $~lib/rt/tlsf/searchBlock
   local.tee $2
   i32.eqz
   if
    local.get $0
    local.get $3
    call $~lib/rt/tlsf/growMemory
    local.get $0
    local.get $3
    call $~lib/rt/tlsf/searchBlock
    local.tee $2
    i32.eqz
    if
     i32.const 0
     i32.const 24
     i32.const 498
     i32.const 19
     call $~lib/builtins/abort
     unreachable
    end
   end
  end
  local.get $2
  i32.load
  i32.const -4
  i32.and
  local.get $3
  i32.lt_u
  if
   i32.const 0
   i32.const 24
   i32.const 506
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  i32.const 0
  i32.store offset=4
  local.get $2
  local.get $1
  i32.store offset=12
  local.get $0
  local.get $2
  call $~lib/rt/tlsf/removeBlock
  local.get $0
  local.get $2
  local.get $3
  call $~lib/rt/tlsf/prepareBlock
  local.get $2
 )
 (func $~lib/rt/tlsf/__alloc (; 16 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  global.get $~lib/rt/tlsf/ROOT
  local.tee $2
  if (result i32)
   local.get $2
  else
   call $~lib/rt/tlsf/initializeRoot
   global.get $~lib/rt/tlsf/ROOT
  end
  local.get $0
  call $~lib/rt/tlsf/allocateBlock
  local.tee $0
  local.get $1
  i32.store offset=8
  local.get $0
  i32.const 16
  i32.add
 )
 (func $~lib/rt/pure/increment (; 17 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  local.get $0
  i32.load offset=4
  local.tee $1
  i32.const -268435456
  i32.and
  local.get $1
  i32.const 1
  i32.add
  i32.const -268435456
  i32.and
  i32.ne
  if
   i32.const 0
   i32.const 128
   i32.const 104
   i32.const 2
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $1
  i32.const 1
  i32.add
  i32.store offset=4
  local.get $0
  i32.load
  i32.const 1
  i32.and
  if
   i32.const 0
   i32.const 128
   i32.const 107
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $~lib/rt/pure/__retain (; 18 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  i32.const 284
  i32.gt_u
  if
   local.get $0
   i32.const 16
   i32.sub
   call $~lib/rt/pure/increment
  end
  local.get $0
 )
 (func $~lib/rt/__typeinfo (; 19 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  i32.const 256
  i32.load
  i32.gt_u
  if
   i32.const 176
   i32.const 232
   i32.const 22
   i32.const 27
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 3
  i32.shl
  i32.const 260
  i32.add
  i32.load
 )
 (func $~lib/util/memory/memcpy (; 20 ;) (type $FUNCSIG$viii) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  loop $continue|0
   local.get $1
   i32.const 3
   i32.and
   i32.const 0
   local.get $2
   select
   if
    local.get $0
    local.tee $3
    i32.const 1
    i32.add
    local.set $0
    local.get $1
    local.tee $4
    i32.const 1
    i32.add
    local.set $1
    local.get $3
    local.get $4
    i32.load8_u
    i32.store8
    local.get $2
    i32.const 1
    i32.sub
    local.set $2
    br $continue|0
   end
  end
  local.get $0
  i32.const 3
  i32.and
  i32.eqz
  if
   loop $continue|1
    local.get $2
    i32.const 16
    i32.lt_u
    i32.eqz
    if
     local.get $0
     local.get $1
     i32.load
     i32.store
     local.get $0
     i32.const 4
     i32.add
     local.get $1
     i32.const 4
     i32.add
     i32.load
     i32.store
     local.get $0
     i32.const 8
     i32.add
     local.get $1
     i32.const 8
     i32.add
     i32.load
     i32.store
     local.get $0
     i32.const 12
     i32.add
     local.get $1
     i32.const 12
     i32.add
     i32.load
     i32.store
     local.get $1
     i32.const 16
     i32.add
     local.set $1
     local.get $0
     i32.const 16
     i32.add
     local.set $0
     local.get $2
     i32.const 16
     i32.sub
     local.set $2
     br $continue|1
    end
   end
   local.get $2
   i32.const 8
   i32.and
   if
    local.get $0
    local.get $1
    i32.load
    i32.store
    local.get $0
    i32.const 4
    i32.add
    local.get $1
    i32.const 4
    i32.add
    i32.load
    i32.store
    local.get $1
    i32.const 8
    i32.add
    local.set $1
    local.get $0
    i32.const 8
    i32.add
    local.set $0
   end
   local.get $2
   i32.const 4
   i32.and
   if
    local.get $0
    local.get $1
    i32.load
    i32.store
    local.get $1
    i32.const 4
    i32.add
    local.set $1
    local.get $0
    i32.const 4
    i32.add
    local.set $0
   end
   local.get $2
   i32.const 2
   i32.and
   if
    local.get $0
    local.get $1
    i32.load16_u
    i32.store16
    local.get $1
    i32.const 2
    i32.add
    local.set $1
    local.get $0
    i32.const 2
    i32.add
    local.set $0
   end
   local.get $2
   i32.const 1
   i32.and
   if
    local.get $0
    local.get $1
    i32.load8_u
    i32.store8
   end
   return
  end
  local.get $2
  i32.const 32
  i32.ge_u
  if
   block $break|2
    block $case2|2
     block $case1|2
      local.get $0
      i32.const 3
      i32.and
      local.tee $3
      i32.const 1
      i32.ne
      if
       local.get $3
       i32.const 2
       i32.eq
       br_if $case1|2
       local.get $3
       i32.const 3
       i32.eq
       br_if $case2|2
       br $break|2
      end
      local.get $1
      i32.load
      local.set $5
      local.get $0
      local.get $1
      i32.load8_u
      i32.store8
      local.get $0
      i32.const 1
      i32.add
      local.tee $0
      local.get $1
      i32.const 1
      i32.add
      local.tee $1
      i32.load8_u
      i32.store8
      local.get $0
      i32.const 1
      i32.add
      local.tee $3
      i32.const 1
      i32.add
      local.set $0
      local.get $1
      i32.const 1
      i32.add
      local.tee $4
      i32.const 1
      i32.add
      local.set $1
      local.get $3
      local.get $4
      i32.load8_u
      i32.store8
      local.get $2
      i32.const 3
      i32.sub
      local.set $2
      loop $continue|3
       local.get $2
       i32.const 17
       i32.lt_u
       i32.eqz
       if
        local.get $0
        local.get $1
        i32.const 1
        i32.add
        i32.load
        local.tee $3
        i32.const 8
        i32.shl
        local.get $5
        i32.const 24
        i32.shr_u
        i32.or
        i32.store
        local.get $0
        i32.const 4
        i32.add
        local.get $3
        i32.const 24
        i32.shr_u
        local.get $1
        i32.const 5
        i32.add
        i32.load
        local.tee $3
        i32.const 8
        i32.shl
        i32.or
        i32.store
        local.get $0
        i32.const 8
        i32.add
        local.get $3
        i32.const 24
        i32.shr_u
        local.get $1
        i32.const 9
        i32.add
        i32.load
        local.tee $3
        i32.const 8
        i32.shl
        i32.or
        i32.store
        local.get $0
        i32.const 12
        i32.add
        local.get $1
        i32.const 13
        i32.add
        i32.load
        local.tee $5
        i32.const 8
        i32.shl
        local.get $3
        i32.const 24
        i32.shr_u
        i32.or
        i32.store
        local.get $1
        i32.const 16
        i32.add
        local.set $1
        local.get $0
        i32.const 16
        i32.add
        local.set $0
        local.get $2
        i32.const 16
        i32.sub
        local.set $2
        br $continue|3
       end
      end
      br $break|2
     end
     local.get $1
     i32.load
     local.set $5
     local.get $0
     local.get $1
     i32.load8_u
     i32.store8
     local.get $0
     i32.const 1
     i32.add
     local.tee $3
     i32.const 1
     i32.add
     local.set $0
     local.get $1
     i32.const 1
     i32.add
     local.tee $4
     i32.const 1
     i32.add
     local.set $1
     local.get $3
     local.get $4
     i32.load8_u
     i32.store8
     local.get $2
     i32.const 2
     i32.sub
     local.set $2
     loop $continue|4
      local.get $2
      i32.const 18
      i32.lt_u
      i32.eqz
      if
       local.get $0
       local.get $1
       i32.const 2
       i32.add
       i32.load
       local.tee $3
       i32.const 16
       i32.shl
       local.get $5
       i32.const 16
       i32.shr_u
       i32.or
       i32.store
       local.get $0
       i32.const 4
       i32.add
       local.get $3
       i32.const 16
       i32.shr_u
       local.get $1
       i32.const 6
       i32.add
       i32.load
       local.tee $3
       i32.const 16
       i32.shl
       i32.or
       i32.store
       local.get $0
       i32.const 8
       i32.add
       local.get $3
       i32.const 16
       i32.shr_u
       local.get $1
       i32.const 10
       i32.add
       i32.load
       local.tee $3
       i32.const 16
       i32.shl
       i32.or
       i32.store
       local.get $0
       i32.const 12
       i32.add
       local.get $1
       i32.const 14
       i32.add
       i32.load
       local.tee $5
       i32.const 16
       i32.shl
       local.get $3
       i32.const 16
       i32.shr_u
       i32.or
       i32.store
       local.get $1
       i32.const 16
       i32.add
       local.set $1
       local.get $0
       i32.const 16
       i32.add
       local.set $0
       local.get $2
       i32.const 16
       i32.sub
       local.set $2
       br $continue|4
      end
     end
     br $break|2
    end
    local.get $1
    i32.load
    local.set $5
    local.get $0
    local.tee $3
    i32.const 1
    i32.add
    local.set $0
    local.get $1
    local.tee $4
    i32.const 1
    i32.add
    local.set $1
    local.get $3
    local.get $4
    i32.load8_u
    i32.store8
    local.get $2
    i32.const 1
    i32.sub
    local.set $2
    loop $continue|5
     local.get $2
     i32.const 19
     i32.lt_u
     i32.eqz
     if
      local.get $0
      local.get $1
      i32.const 3
      i32.add
      i32.load
      local.tee $3
      i32.const 24
      i32.shl
      local.get $5
      i32.const 8
      i32.shr_u
      i32.or
      i32.store
      local.get $0
      i32.const 4
      i32.add
      local.get $3
      i32.const 8
      i32.shr_u
      local.get $1
      i32.const 7
      i32.add
      i32.load
      local.tee $3
      i32.const 24
      i32.shl
      i32.or
      i32.store
      local.get $0
      i32.const 8
      i32.add
      local.get $3
      i32.const 8
      i32.shr_u
      local.get $1
      i32.const 11
      i32.add
      i32.load
      local.tee $3
      i32.const 24
      i32.shl
      i32.or
      i32.store
      local.get $0
      i32.const 12
      i32.add
      local.get $1
      i32.const 15
      i32.add
      i32.load
      local.tee $5
      i32.const 24
      i32.shl
      local.get $3
      i32.const 8
      i32.shr_u
      i32.or
      i32.store
      local.get $1
      i32.const 16
      i32.add
      local.set $1
      local.get $0
      i32.const 16
      i32.add
      local.set $0
      local.get $2
      i32.const 16
      i32.sub
      local.set $2
      br $continue|5
     end
    end
   end
  end
  local.get $2
  i32.const 16
  i32.and
  if
   local.get $0
   local.get $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $3
   i32.const 1
   i32.add
   local.set $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $4
   i32.const 1
   i32.add
   local.set $1
   local.get $3
   local.get $4
   i32.load8_u
   i32.store8
  end
  local.get $2
  i32.const 8
  i32.and
  if
   local.get $0
   local.get $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $3
   i32.const 1
   i32.add
   local.set $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $4
   i32.const 1
   i32.add
   local.set $1
   local.get $3
   local.get $4
   i32.load8_u
   i32.store8
  end
  local.get $2
  i32.const 4
  i32.and
  if
   local.get $0
   local.get $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $3
   i32.const 1
   i32.add
   local.set $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $4
   i32.const 1
   i32.add
   local.set $1
   local.get $3
   local.get $4
   i32.load8_u
   i32.store8
  end
  local.get $2
  i32.const 2
  i32.and
  if
   local.get $0
   local.get $1
   i32.load8_u
   i32.store8
   local.get $0
   i32.const 1
   i32.add
   local.tee $3
   i32.const 1
   i32.add
   local.set $0
   local.get $1
   i32.const 1
   i32.add
   local.tee $4
   i32.const 1
   i32.add
   local.set $1
   local.get $3
   local.get $4
   i32.load8_u
   i32.store8
  end
  local.get $2
  i32.const 1
  i32.and
  if
   local.get $0
   local.get $1
   i32.load8_u
   i32.store8
  end
 )
 (func $~lib/memory/memory.copy (; 21 ;) (type $FUNCSIG$viii) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  block $~lib/util/memory/memmove|inlined.0
   local.get $2
   local.set $3
   local.get $0
   local.get $1
   i32.eq
   br_if $~lib/util/memory/memmove|inlined.0
   i32.const 1
   local.get $0
   local.get $3
   i32.add
   local.get $1
   i32.le_u
   local.get $1
   local.get $3
   i32.add
   local.get $0
   i32.le_u
   select
   if
    local.get $0
    local.get $1
    local.get $3
    call $~lib/util/memory/memcpy
    br $~lib/util/memory/memmove|inlined.0
   end
   local.get $0
   local.get $1
   i32.lt_u
   if
    local.get $1
    i32.const 7
    i32.and
    local.get $0
    i32.const 7
    i32.and
    i32.eq
    if
     loop $continue|0
      local.get $0
      i32.const 7
      i32.and
      if
       local.get $3
       i32.eqz
       br_if $~lib/util/memory/memmove|inlined.0
       local.get $3
       i32.const 1
       i32.sub
       local.set $3
       local.get $0
       local.tee $2
       i32.const 1
       i32.add
       local.set $0
       local.get $1
       local.tee $4
       i32.const 1
       i32.add
       local.set $1
       local.get $2
       local.get $4
       i32.load8_u
       i32.store8
       br $continue|0
      end
     end
     loop $continue|1
      local.get $3
      i32.const 8
      i32.lt_u
      i32.eqz
      if
       local.get $0
       local.get $1
       i64.load
       i64.store
       local.get $3
       i32.const 8
       i32.sub
       local.set $3
       local.get $0
       i32.const 8
       i32.add
       local.set $0
       local.get $1
       i32.const 8
       i32.add
       local.set $1
       br $continue|1
      end
     end
    end
    loop $continue|2
     local.get $3
     if
      local.get $0
      local.tee $2
      i32.const 1
      i32.add
      local.set $0
      local.get $1
      local.tee $4
      i32.const 1
      i32.add
      local.set $1
      local.get $2
      local.get $4
      i32.load8_u
      i32.store8
      local.get $3
      i32.const 1
      i32.sub
      local.set $3
      br $continue|2
     end
    end
   else
    local.get $1
    i32.const 7
    i32.and
    local.get $0
    i32.const 7
    i32.and
    i32.eq
    if
     loop $continue|3
      local.get $0
      local.get $3
      i32.add
      i32.const 7
      i32.and
      if
       local.get $3
       i32.eqz
       br_if $~lib/util/memory/memmove|inlined.0
       local.get $0
       local.get $3
       i32.const 1
       i32.sub
       local.tee $3
       i32.add
       local.get $1
       local.get $3
       i32.add
       i32.load8_u
       i32.store8
       br $continue|3
      end
     end
     loop $continue|4
      local.get $3
      i32.const 8
      i32.lt_u
      i32.eqz
      if
       local.get $0
       local.get $3
       i32.const 8
       i32.sub
       local.tee $3
       i32.add
       local.get $1
       local.get $3
       i32.add
       i64.load
       i64.store
       br $continue|4
      end
     end
    end
    loop $continue|5
     local.get $3
     if
      local.get $0
      local.get $3
      i32.const 1
      i32.sub
      local.tee $3
      i32.add
      local.get $1
      local.get $3
      i32.add
      i32.load8_u
      i32.store8
      br $continue|5
     end
    end
   end
  end
 )
 (func $~lib/rt/tlsf/__free (; 22 ;) (type $FUNCSIG$vi) (param $0 i32)
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 593
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 15
  i32.and
  i32.eqz
  i32.const 0
  local.get $0
  select
  i32.eqz
  if
   i32.const 0
   i32.const 24
   i32.const 594
   i32.const 2
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/tlsf/ROOT
  local.get $0
  i32.const 16
  i32.sub
  call $~lib/rt/tlsf/freeBlock
 )
 (func $~lib/rt/pure/growRoots (; 23 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $~lib/rt/pure/CUR
  global.get $~lib/rt/pure/ROOTS
  local.tee $1
  i32.sub
  local.tee $2
  i32.const 1
  i32.shl
  local.tee $0
  i32.const 256
  local.get $0
  i32.const 256
  i32.gt_u
  select
  local.tee $3
  i32.const 0
  call $~lib/rt/tlsf/__alloc
  local.tee $0
  local.get $1
  local.get $2
  call $~lib/memory/memory.copy
  local.get $1
  if
   local.get $1
   call $~lib/rt/tlsf/__free
  end
  local.get $0
  global.set $~lib/rt/pure/ROOTS
  local.get $0
  local.get $2
  i32.add
  global.set $~lib/rt/pure/CUR
  local.get $0
  local.get $3
  i32.add
  global.set $~lib/rt/pure/END
 )
 (func $~lib/rt/pure/appendRoot (; 24 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  global.get $~lib/rt/pure/CUR
  local.tee $1
  global.get $~lib/rt/pure/END
  i32.ge_u
  if
   call $~lib/rt/pure/growRoots
   global.get $~lib/rt/pure/CUR
   local.set $1
  end
  local.get $1
  local.get $0
  i32.store
  local.get $1
  i32.const 4
  i32.add
  global.set $~lib/rt/pure/CUR
 )
 (func $~lib/rt/pure/decrement (; 25 ;) (type $FUNCSIG$vi) (param $0 i32)
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
   i32.const 128
   i32.const 115
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 1
  i32.eq
  if
   local.get $0
   i32.const 16
   i32.add
   i32.const 1
   call $~lib/rt/__visit_members
   local.get $2
   i32.const -2147483648
   i32.and
   if
    local.get $0
    i32.const -2147483648
    i32.store offset=4
   else
    global.get $~lib/rt/tlsf/ROOT
    local.get $0
    call $~lib/rt/tlsf/freeBlock
   end
  else
   local.get $1
   i32.const 0
   i32.le_u
   if
    i32.const 0
    i32.const 128
    i32.const 124
    i32.const 15
    call $~lib/builtins/abort
    unreachable
   end
   local.get $0
   i32.load offset=8
   call $~lib/rt/__typeinfo
   i32.const 16
   i32.and
   if
    local.get $0
    local.get $1
    i32.const 1
    i32.sub
    local.get $2
    i32.const -268435456
    i32.and
    i32.or
    i32.store offset=4
   else
    local.get $0
    local.get $1
    i32.const 1
    i32.sub
    i32.const -1342177280
    i32.or
    i32.store offset=4
    local.get $2
    i32.const -2147483648
    i32.and
    i32.eqz
    if
     local.get $0
     call $~lib/rt/pure/appendRoot
    end
   end
  end
 )
 (func $~lib/rt/pure/__release (; 26 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  i32.const 284
  i32.gt_u
  if
   local.get $0
   i32.const 16
   i32.sub
   call $~lib/rt/pure/decrement
  end
 )
 (func $start:core/graphics/colors (; 27 ;) (type $FUNCSIG$v)
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
 )
 (func $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset (; 28 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner0
   block $case14|0
    block $case13|0
     block $case12|0
      block $case11|0
       block $case9|0
        block $case7|0
         block $case3|0
          local.get $0
          i32.const 12
          i32.shr_s
          local.tee $1
          if
           local.get $1
           i32.const 1
           i32.eq
           br_if $case3|0
           block $tablify|0
            local.get $1
            i32.const 2
            i32.sub
            br_table $case3|0 $case3|0 $case7|0 $case7|0 $case7|0 $case7|0 $case9|0 $case9|0 $case11|0 $case11|0 $case12|0 $case13|0 $tablify|0
           end
           br $case14|0
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
        i32.const 1
        global.get $core/memory/memory/Memory.currentRomBank
        local.tee $0
        i32.const 0
        local.get $0
        i32.eqz
        global.get $core/memory/memory/Memory.isMBC5
        select
        select
        i32.const 14
        i32.shl
        i32.add
        i32.const 1316480
        i32.add
        return
       end
       local.get $0
       i32.const -30720
       i32.add
       global.get $core/cpu/cpu/Cpu.GBCEnabled
       if (result i32)
        i32.const 65359
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
    i32.const 0
    local.set $1
    global.get $core/cpu/cpu/Cpu.GBCEnabled
    if
     i32.const 65392
     call $core/memory/load/eightBitLoadFromGBMemory
     i32.const 7
     i32.and
     local.set $1
    end
    local.get $1
    i32.const 1
    i32.lt_s
    if (result i32)
     i32.const 1
    else
     local.get $1
    end
    i32.const 12
    i32.shl
    local.get $0
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
 (func $core/memory/load/eightBitLoadFromGBMemory (; 29 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  i32.load8_u
 )
 (func $core/cpu/cpu/initializeCpu (; 30 ;) (type $FUNCSIG$v)
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
 (func $core/memory/store/eightBitStoreIntoGBMemory (; 31 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  local.get $0
  call $core/memory/memoryMap/getWasmBoyOffsetFromGameBoyOffset
  local.get $1
  i32.store8
 )
 (func $core/memory/memory/initializeCartridge (; 32 ;) (type $FUNCSIG$v)
  (local $0 i32)
  i32.const 0
  global.set $core/memory/memory/Memory.isRamBankingEnabled
  i32.const 1
  global.set $core/memory/memory/Memory.isMBC1RomModeEnabled
  i32.const 327
  call $core/memory/load/eightBitLoadFromGBMemory
  local.tee $0
  i32.eqz
  global.set $core/memory/memory/Memory.isRomOnly
  local.get $0
  i32.const 3
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 1
  i32.ge_s
  select
  global.set $core/memory/memory/Memory.isMBC1
  local.get $0
  i32.const 6
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 5
  i32.ge_s
  select
  global.set $core/memory/memory/Memory.isMBC2
  local.get $0
  i32.const 19
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 15
  i32.ge_s
  select
  global.set $core/memory/memory/Memory.isMBC3
  local.get $0
  i32.const 30
  i32.le_s
  i32.const 0
  local.get $0
  i32.const 25
  i32.ge_s
  select
  global.set $core/memory/memory/Memory.isMBC5
  i32.const 1
  global.set $core/memory/memory/Memory.currentRomBank
  i32.const 0
  global.set $core/memory/memory/Memory.currentRamBank
  i32.const 65359
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65392
  i32.const 1
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/memory/dma/initializeDma (; 33 ;) (type $FUNCSIG$v)
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
 (func $core/graphics/colors/setManualColorizationPalette (; 34 ;) (type $FUNCSIG$vi) (param $0 i32)
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
               local.get $0
               if
                local.get $0
                i32.const 1
                i32.eq
                br_if $case1|0
                block $tablify|0
                 local.get $0
                 i32.const 2
                 i32.sub
                 br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $tablify|0
                end
                br $break|0
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
 (func $core/graphics/colors/setHashColorizationPalette (; 35 ;) (type $FUNCSIG$vi) (param $0 i32)
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
 (func $core/graphics/colors/initializeColors (; 36 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  i32.const 0
  call $core/graphics/colors/setManualColorizationPalette
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   return
  end
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   global.get $core/cpu/cpu/Cpu.GBCEnabled
   i32.eqz
   if
    return
   end
  end
  i32.const 308
  local.set $0
  loop $loop|0
   block $break|0
    local.get $0
    i32.const 323
    i32.gt_s
    br_if $break|0
    local.get $0
    call $core/memory/load/eightBitLoadFromGBMemory
    local.get $1
    i32.add
    local.set $1
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $loop|0
   end
  end
  local.get $1
  i32.const 255
  i32.and
  call $core/graphics/colors/setHashColorizationPalette
 )
 (func $core/graphics/graphics/initializeGraphics (; 37 ;) (type $FUNCSIG$v)
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
   i32.const 129
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65348
   i32.const 144
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65351
   i32.const 252
   call $core/memory/store/eightBitStoreIntoGBMemory
  else
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
  i32.const 144
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 65344
  i32.const 144
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65359
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65392
  i32.const 1
  call $core/memory/store/eightBitStoreIntoGBMemory
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   global.get $core/cpu/cpu/Cpu.GBCEnabled
   if
    i32.const 0
    global.set $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 65344
    i32.const 0
    call $core/memory/store/eightBitStoreIntoGBMemory
    i32.const 65345
    i32.const 128
    call $core/memory/store/eightBitStoreIntoGBMemory
    i32.const 65348
    i32.const 0
    call $core/memory/store/eightBitStoreIntoGBMemory
   else
    i32.const 0
    global.set $core/graphics/graphics/Graphics.scanlineRegister
    i32.const 65344
    i32.const 0
    call $core/memory/store/eightBitStoreIntoGBMemory
    i32.const 65345
    i32.const 132
    call $core/memory/store/eightBitStoreIntoGBMemory
   end
  end
  call $core/graphics/colors/initializeColors
 )
 (func $core/graphics/palette/initializePalette (; 38 ;) (type $FUNCSIG$v)
  global.get $core/cpu/cpu/Cpu.GBCEnabled
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
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  i32.const 0
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  select
  if
   i32.const 65385
   i32.const 32
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65387
   i32.const 138
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/sound/channel1/Channel1.initialize (; 39 ;) (type $FUNCSIG$v)
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
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   i32.const 65297
   i32.const 63
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65298
   i32.const 0
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65299
   i32.const 0
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 65300
   i32.const 184
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/sound/channel2/Channel2.initialize (; 40 ;) (type $FUNCSIG$v)
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
 (func $core/sound/channel3/Channel3.initialize (; 41 ;) (type $FUNCSIG$v)
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
  global.set $core/sound/channel3/Channel3.volumeCodeChanged
 )
 (func $core/sound/channel4/Channel4.initialize (; 42 ;) (type $FUNCSIG$v)
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
 (func $core/sound/sound/Sound.updateNR51 (; 43 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  i32.const 128
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnLeftOutput
  local.get $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnLeftOutput
  local.get $0
  i32.const 32
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnLeftOutput
  local.get $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnLeftOutput
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  local.get $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel3EnabledOnRightOutput
  local.get $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel2EnabledOnRightOutput
  local.get $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/sound/Sound.NR51IsChannel1EnabledOnRightOutput
 )
 (func $core/sound/accumulator/initializeSoundAccumulator (; 44 ;) (type $FUNCSIG$v)
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
 (func $core/sound/sound/initializeSound (; 45 ;) (type $FUNCSIG$v)
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
  call $core/sound/channel1/Channel1.initialize
  call $core/sound/channel2/Channel2.initialize
  call $core/sound/channel3/Channel3.initialize
  call $core/sound/channel4/Channel4.initialize
  i32.const 65316
  i32.const 119
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 7
  global.set $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.const 7
  global.set $core/sound/sound/Sound.NR50RightMixerVolume
  i32.const 65317
  i32.const 243
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 243
  call $core/sound/sound/Sound.updateNR51
  i32.const 65318
  i32.const 241
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 1
  global.set $core/sound/sound/Sound.NR52IsSoundEnabled
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   i32.const 65316
   i32.const 0
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 0
   global.set $core/sound/sound/Sound.NR50LeftMixerVolume
   i32.const 0
   global.set $core/sound/sound/Sound.NR50RightMixerVolume
   i32.const 65317
   i32.const 0
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 0
   call $core/sound/sound/Sound.updateNR51
   i32.const 65318
   i32.const 112
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 0
   global.set $core/sound/sound/Sound.NR52IsSoundEnabled
  end
  call $core/sound/accumulator/initializeSoundAccumulator
 )
 (func $core/interrupts/interrupts/Interrupts.updateInterruptEnabled (; 46 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptEnabled
  local.get $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptEnabled
  local.get $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptEnabled
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptEnabled
  local.get $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptEnabled
  local.get $0
  global.set $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
 )
 (func $core/interrupts/interrupts/Interrupts.updateInterruptRequested (; 47 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
  local.get $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
  local.get $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isTimerInterruptRequested
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isSerialInterruptRequested
  local.get $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  global.set $core/interrupts/interrupts/Interrupts.isJoypadInterruptRequested
  local.get $0
  global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
 )
 (func $core/timers/timers/initializeTimers (; 48 ;) (type $FUNCSIG$v)
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
   i32.const 30
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 7840
   global.set $core/timers/timers/Timers.dividerRegister
  else
   i32.const 65284
   i32.const 171
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 43980
   global.set $core/timers/timers/Timers.dividerRegister
  end
  i32.const 65287
  i32.const 248
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 248
  global.set $core/timers/timers/Timers.timerInputClock
  global.get $core/cpu/cpu/Cpu.BootROMEnabled
  if
   global.get $core/cpu/cpu/Cpu.GBCEnabled
   i32.eqz
   if
    i32.const 65284
    i32.const 0
    call $core/memory/store/eightBitStoreIntoGBMemory
    i32.const 4
    global.set $core/timers/timers/Timers.dividerRegister
   end
  end
 )
 (func $core/serial/serial/initializeSerial (; 49 ;) (type $FUNCSIG$v)
  i32.const 0
  global.set $core/serial/serial/Serial.currentCycles
  i32.const 0
  global.set $core/serial/serial/Serial.numberOfBitsTransferred
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   i32.const 65282
   i32.const 124
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 0
   global.set $core/serial/serial/Serial.isShiftClockInternal
   i32.const 0
   global.set $core/serial/serial/Serial.isClockSpeedFast
   i32.const 0
   global.set $core/serial/serial/Serial.transferStartFlag
  else
   i32.const 65282
   i32.const 126
   call $core/memory/store/eightBitStoreIntoGBMemory
   i32.const 0
   global.set $core/serial/serial/Serial.isShiftClockInternal
   i32.const 1
   global.set $core/serial/serial/Serial.isClockSpeedFast
   i32.const 0
   global.set $core/serial/serial/Serial.transferStartFlag
  end
 )
 (func $core/core/initializeVarious (; 50 ;) (type $FUNCSIG$v)
  global.get $core/cpu/cpu/Cpu.GBCEnabled
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
 )
 (func $core/core/initialize (; 51 ;) (type $FUNCSIG$v)
  (local $0 i32)
  i32.const 323
  call $core/memory/load/eightBitLoadFromGBMemory
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
  call $core/memory/memory/initializeCartridge
  call $core/memory/dma/initializeDma
  call $core/graphics/graphics/initializeGraphics
  call $core/graphics/palette/initializePalette
  call $core/sound/sound/initializeSound
  i32.const 0
  call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
  i32.const 65535
  global.get $core/interrupts/interrupts/Interrupts.interruptsEnabledValue
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 225
  call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
  i32.const 65295
  global.get $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  call $core/memory/store/eightBitStoreIntoGBMemory
  call $core/timers/timers/initializeTimers
  call $core/serial/serial/initializeSerial
  call $core/core/initializeVarious
 )
 (func $core/core/config (; 52 ;) (type $FUNCSIG$viiiiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32)
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
 (func $core/core/hasCoreStarted (; 53 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/core/hasStarted
 )
 (func $core/cpu/cpu/Cpu.saveState (; 54 ;) (type $FUNCSIG$v)
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
 )
 (func $core/memory/memory/Memory.saveState (; 55 ;) (type $FUNCSIG$v)
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
 )
 (func $core/timers/timers/Timers.saveState (; 56 ;) (type $FUNCSIG$v)
  i32.const 1274
  global.get $core/timers/timers/Timers.currentCycles
  i32.store
  i32.const 1278
  global.get $core/timers/timers/Timers.dividerRegister
  i32.store
  i32.const 1282
  global.get $core/timers/timers/Timers.timerCounterOverflowDelay
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1285
  global.get $core/timers/timers/Timers.timerCounterWasReset
  i32.const 0
  i32.ne
  i32.store8
  i32.const 65285
  global.get $core/timers/timers/Timers.timerCounter
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/sound/channel1/Channel1.saveState (; 57 ;) (type $FUNCSIG$v)
  i32.const 1374
  global.get $core/sound/channel1/Channel1.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1375
  global.get $core/sound/channel1/Channel1.frequencyTimer
  i32.store
  i32.const 1379
  global.get $core/sound/channel1/Channel1.envelopeCounter
  i32.store
  i32.const 1383
  global.get $core/sound/channel1/Channel1.lengthCounter
  i32.store
  i32.const 1388
  global.get $core/sound/channel1/Channel1.volume
  i32.store
  i32.const 1393
  global.get $core/sound/channel1/Channel1.dutyCycle
  i32.store8
  i32.const 1394
  global.get $core/sound/channel1/Channel1.waveFormPositionOnDuty
  i32.store8
  i32.const 1399
  global.get $core/sound/channel1/Channel1.isSweepEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1400
  global.get $core/sound/channel1/Channel1.sweepCounter
  i32.store
  i32.const 1405
  global.get $core/sound/channel1/Channel1.sweepShadowFrequency
  i32.store16
  i32.const 1407
  global.get $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
  i32.const 0
  i32.ne
  i32.store8
 )
 (func $core/sound/channel2/Channel2.saveState (; 58 ;) (type $FUNCSIG$v)
  i32.const 1424
  global.get $core/sound/channel2/Channel2.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1425
  global.get $core/sound/channel2/Channel2.frequencyTimer
  i32.store
  i32.const 1429
  global.get $core/sound/channel2/Channel2.envelopeCounter
  i32.store
  i32.const 1433
  global.get $core/sound/channel2/Channel2.lengthCounter
  i32.store
  i32.const 1438
  global.get $core/sound/channel2/Channel2.volume
  i32.store
  i32.const 1443
  global.get $core/sound/channel2/Channel2.dutyCycle
  i32.store8
  i32.const 1444
  global.get $core/sound/channel2/Channel2.waveFormPositionOnDuty
  i32.store8
  i32.const 1445
  global.get $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
  i32.const 0
  i32.ne
  i32.store8
 )
 (func $core/sound/channel4/Channel4.saveState (; 59 ;) (type $FUNCSIG$v)
  i32.const 1524
  global.get $core/sound/channel4/Channel4.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1525
  global.get $core/sound/channel4/Channel4.frequencyTimer
  i32.store
  i32.const 1529
  global.get $core/sound/channel4/Channel4.envelopeCounter
  i32.store
  i32.const 1533
  global.get $core/sound/channel4/Channel4.lengthCounter
  i32.store
  i32.const 1538
  global.get $core/sound/channel4/Channel4.volume
  i32.store
  i32.const 1543
  global.get $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  i32.store16
  i32.const 1545
  global.get $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
  i32.const 0
  i32.ne
  i32.store8
 )
 (func $core/core/saveState (; 60 ;) (type $FUNCSIG$v)
  call $core/cpu/cpu/Cpu.saveState
  i32.const 1074
  global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.store
  i32.const 1078
  global.get $core/graphics/lcd/Lcd.currentLcdMode
  i32.store8
  i32.const 65348
  global.get $core/graphics/graphics/Graphics.scanlineRegister
  call $core/memory/store/eightBitStoreIntoGBMemory
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
  call $core/memory/memory/Memory.saveState
  call $core/timers/timers/Timers.saveState
  i32.const 1324
  global.get $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.store
  i32.const 1328
  global.get $core/sound/sound/Sound.downSampleCycleCounter
  i32.store8
  i32.const 1329
  global.get $core/sound/sound/Sound.frameSequencer
  i32.store8
  call $core/sound/channel1/Channel1.saveState
  call $core/sound/channel2/Channel2.saveState
  i32.const 1474
  global.get $core/sound/channel3/Channel3.isEnabled
  i32.const 0
  i32.ne
  i32.store8
  i32.const 1475
  global.get $core/sound/channel3/Channel3.frequencyTimer
  i32.store
  i32.const 1479
  global.get $core/sound/channel3/Channel3.lengthCounter
  i32.store
  i32.const 1483
  global.get $core/sound/channel3/Channel3.waveTablePosition
  i32.store16
  call $core/sound/channel4/Channel4.saveState
  i32.const 0
  global.set $core/core/hasStarted
 )
 (func $core/cpu/cpu/Cpu.loadState (; 61 ;) (type $FUNCSIG$v)
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
  i32.gt_s
  global.set $core/cpu/cpu/Cpu.isHaltNormal
  i32.const 1042
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/cpu/cpu/Cpu.isHaltNoJump
  i32.const 1043
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/cpu/cpu/Cpu.isHaltBug
  i32.const 1044
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/cpu/cpu/Cpu.isStopped
  i32.const 1045
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/cpu/cpu/Cpu.BootROMEnabled
  i32.const 1046
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/cpu/cpu/Cpu.GBCEnabled
  i32.const 1047
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/cpu/cpu/Cpu.GBCDoubleSpeed
 )
 (func $core/graphics/lcd/resetLcd (; 62 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.const 0
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 65348
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65345
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const -4
  i32.and
  local.set $1
  i32.const 0
  global.set $core/graphics/lcd/Lcd.currentLcdMode
  i32.const 65345
  local.get $1
  call $core/memory/store/eightBitStoreIntoGBMemory
  local.get $0
  if
   block $break|0
    i32.const 0
    local.set $0
    loop $loop|0
     local.get $0
     i32.const 93184
     i32.ge_s
     br_if $break|0
     local.get $0
     i32.const 91264
     i32.add
     i32.const 255
     i32.store8
     local.get $0
     i32.const 1
     i32.add
     local.set $0
     br $loop|0
    end
    unreachable
   end
  end
 )
 (func $core/graphics/lcd/Lcd.updateLcdControl (; 63 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  global.get $core/graphics/lcd/Lcd.enabled
  local.set $1
  local.get $0
  i32.const 128
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.enabled
  local.get $0
  i32.const 64
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
  local.get $0
  i32.const 32
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.windowDisplayEnabled
  local.get $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
  local.get $0
  i32.const 4
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.tallSpriteSize
  local.get $0
  i32.const 2
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.spriteDisplayEnable
  local.get $0
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
  global.set $core/graphics/lcd/Lcd.bgDisplayEnabled
  global.get $core/graphics/lcd/Lcd.enabled
  i32.eqz
  i32.const 0
  local.get $1
  select
  if
   i32.const 1
   call $core/graphics/lcd/resetLcd
  end
  i32.const 0
  global.get $core/graphics/lcd/Lcd.enabled
  local.get $1
  select
  if
   i32.const 0
   call $core/graphics/lcd/resetLcd
  end
 )
 (func $core/interrupts/interrupts/Interrupts.loadState (; 64 ;) (type $FUNCSIG$v)
  i32.const 1124
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  i32.const 1125
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitchDelay
  i32.const 65535
  call $core/memory/load/eightBitLoadFromGBMemory
  call $core/interrupts/interrupts/Interrupts.updateInterruptEnabled
  i32.const 65295
  call $core/memory/load/eightBitLoadFromGBMemory
  call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
 )
 (func $core/memory/memory/Memory.loadState (; 65 ;) (type $FUNCSIG$v)
  i32.const 1224
  i32.load16_u
  global.set $core/memory/memory/Memory.currentRomBank
  i32.const 1226
  i32.load16_u
  global.set $core/memory/memory/Memory.currentRamBank
  i32.const 1228
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/memory/memory/Memory.isRamBankingEnabled
  i32.const 1229
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/memory/memory/Memory.isMBC1RomModeEnabled
  i32.const 1230
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/memory/memory/Memory.isRomOnly
  i32.const 1231
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/memory/memory/Memory.isMBC1
  i32.const 1232
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/memory/memory/Memory.isMBC2
  i32.const 1233
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/memory/memory/Memory.isMBC3
  i32.const 1234
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/memory/memory/Memory.isMBC5
 )
 (func $core/timers/timers/Timers.loadState (; 66 ;) (type $FUNCSIG$v)
  i32.const 1274
  i32.load
  global.set $core/timers/timers/Timers.currentCycles
  i32.const 1278
  i32.load
  global.set $core/timers/timers/Timers.dividerRegister
  i32.const 1282
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/timers/timers/Timers.timerCounterOverflowDelay
  i32.const 1285
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/timers/timers/Timers.timerCounterWasReset
  i32.const 65285
  call $core/memory/load/eightBitLoadFromGBMemory
  global.set $core/timers/timers/Timers.timerCounter
  i32.const 65286
  call $core/memory/load/eightBitLoadFromGBMemory
  global.set $core/timers/timers/Timers.timerModulo
  i32.const 65287
  call $core/memory/load/eightBitLoadFromGBMemory
  global.set $core/timers/timers/Timers.timerInputClock
 )
 (func $core/sound/sound/clearAudioBuffer (; 67 ;) (type $FUNCSIG$v)
  i32.const 0
  global.set $core/sound/sound/Sound.audioQueueIndex
 )
 (func $core/sound/channel1/Channel1.loadState (; 68 ;) (type $FUNCSIG$v)
  i32.const 1374
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel1/Channel1.isEnabled
  i32.const 1375
  i32.load
  global.set $core/sound/channel1/Channel1.frequencyTimer
  i32.const 1379
  i32.load
  global.set $core/sound/channel1/Channel1.envelopeCounter
  i32.const 1383
  i32.load
  global.set $core/sound/channel1/Channel1.lengthCounter
  i32.const 1388
  i32.load
  global.set $core/sound/channel1/Channel1.volume
  i32.const 1393
  i32.load8_u
  global.set $core/sound/channel1/Channel1.dutyCycle
  i32.const 1394
  i32.load8_u
  global.set $core/sound/channel1/Channel1.waveFormPositionOnDuty
  i32.const 1399
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel1/Channel1.isSweepEnabled
  i32.const 1400
  i32.load
  global.set $core/sound/channel1/Channel1.sweepCounter
  i32.const 1405
  i32.load16_u
  global.set $core/sound/channel1/Channel1.sweepShadowFrequency
  i32.const 1407
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
 )
 (func $core/sound/channel2/Channel2.loadState (; 69 ;) (type $FUNCSIG$v)
  i32.const 1424
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel2/Channel2.isEnabled
  i32.const 1425
  i32.load
  global.set $core/sound/channel2/Channel2.frequencyTimer
  i32.const 1429
  i32.load
  global.set $core/sound/channel2/Channel2.envelopeCounter
  i32.const 1433
  i32.load
  global.set $core/sound/channel2/Channel2.lengthCounter
  i32.const 1438
  i32.load
  global.set $core/sound/channel2/Channel2.volume
  i32.const 1443
  i32.load8_u
  global.set $core/sound/channel2/Channel2.dutyCycle
  i32.const 1444
  i32.load8_u
  global.set $core/sound/channel2/Channel2.waveFormPositionOnDuty
  i32.const 1457
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
 )
 (func $core/sound/channel4/Channel4.loadState (; 70 ;) (type $FUNCSIG$v)
  i32.const 1524
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel4/Channel4.isEnabled
  i32.const 1525
  i32.load
  global.set $core/sound/channel4/Channel4.frequencyTimer
  i32.const 1529
  i32.load
  global.set $core/sound/channel4/Channel4.envelopeCounter
  i32.const 1533
  i32.load
  global.set $core/sound/channel4/Channel4.lengthCounter
  i32.const 1538
  i32.load
  global.set $core/sound/channel4/Channel4.volume
  i32.const 1543
  i32.load16_u
  global.set $core/sound/channel4/Channel4.linearFeedbackShiftRegister
  i32.const 1545
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
 )
 (func $core/core/loadState (; 71 ;) (type $FUNCSIG$v)
  (local $0 i32)
  call $core/cpu/cpu/Cpu.loadState
  i32.const 1074
  i32.load
  global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
  i32.const 1078
  i32.load8_u
  global.set $core/graphics/lcd/Lcd.currentLcdMode
  i32.const 65348
  call $core/memory/load/eightBitLoadFromGBMemory
  global.set $core/graphics/graphics/Graphics.scanlineRegister
  i32.const 65344
  call $core/memory/load/eightBitLoadFromGBMemory
  call $core/graphics/lcd/Lcd.updateLcdControl
  call $core/interrupts/interrupts/Interrupts.loadState
  i32.const 65280
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 255
  i32.xor
  global.set $core/joypad/joypad/Joypad.joypadRegisterFlipped
  global.get $core/joypad/joypad/Joypad.joypadRegisterFlipped
  local.tee $0
  i32.const 16
  i32.and
  i32.const 0
  i32.ne
  global.set $core/joypad/joypad/Joypad.isDpadType
  local.get $0
  i32.const 32
  i32.and
  i32.const 0
  i32.ne
  global.set $core/joypad/joypad/Joypad.isButtonType
  call $core/memory/memory/Memory.loadState
  call $core/timers/timers/Timers.loadState
  i32.const 1324
  i32.load
  global.set $core/sound/sound/Sound.frameSequenceCycleCounter
  i32.const 1328
  i32.load8_u
  global.set $core/sound/sound/Sound.downSampleCycleCounter
  i32.const 1329
  i32.load8_u
  global.set $core/sound/sound/Sound.frameSequencer
  i32.const 0
  global.set $core/sound/sound/Sound.audioQueueIndex
  call $core/sound/channel1/Channel1.loadState
  call $core/sound/channel2/Channel2.loadState
  i32.const 1474
  i32.load8_u
  i32.const 0
  i32.gt_s
  global.set $core/sound/channel3/Channel3.isEnabled
  i32.const 1475
  i32.load
  global.set $core/sound/channel3/Channel3.frequencyTimer
  i32.const 1479
  i32.load
  global.set $core/sound/channel3/Channel3.lengthCounter
  i32.const 1483
  i32.load16_u
  global.set $core/sound/channel3/Channel3.waveTablePosition
  call $core/sound/channel4/Channel4.loadState
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
 (func $core/core/isGBC (; 72 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.GBCEnabled
 )
 (func $core/execute/getStepsPerStepSet (; 73 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/execute/Execute.stepsPerStepSet
 )
 (func $core/execute/getStepSets (; 74 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/execute/Execute.stepSets
 )
 (func $core/execute/getSteps (; 75 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/execute/Execute.steps
 )
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileCache (; 76 ;) (type $FUNCSIG$iiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (result i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  global.get $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
  local.tee $5
  local.get $0
  i32.eq
  i32.const 0
  global.get $core/graphics/tiles/TileCache.tileId
  local.get $4
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
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 32
   i32.and
   i32.const 0
   i32.ne
   local.set $8
   local.get $3
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 32
   i32.and
   i32.const 0
   i32.ne
   local.set $9
   i32.const 0
   local.set $3
   loop $loop|0
    local.get $3
    i32.const 8
    i32.lt_s
    if
     i32.const 7
     local.get $3
     i32.sub
     local.get $3
     local.get $8
     local.get $9
     i32.ne
     select
     local.tee $7
     local.get $0
     i32.add
     local.tee $3
     i32.const 160
     i32.le_s
     if
      local.get $1
      i32.const 160
      i32.mul
      local.get $3
      i32.add
      i32.const 3
      i32.mul
      i32.const 91264
      i32.add
      local.tee $4
      i32.load8_u
      local.set $10
      local.get $4
      local.get $10
      i32.store8
      local.get $1
      i32.const 160
      i32.mul
      local.get $3
      i32.add
      i32.const 3
      i32.mul
      i32.const 91265
      i32.add
      local.get $4
      i32.load8_u offset=1
      i32.store8
      local.get $1
      i32.const 160
      i32.mul
      local.get $3
      i32.add
      i32.const 3
      i32.mul
      i32.const 91266
      i32.add
      local.get $4
      i32.load8_u offset=2
      i32.store8
      local.get $1
      i32.const 160
      i32.mul
      local.get $3
      i32.add
      i32.const 67712
      i32.add
      local.get $0
      i32.const 0
      local.get $7
      i32.sub
      i32.sub
      local.get $1
      i32.const 160
      i32.mul
      i32.add
      i32.const 67704
      i32.add
      i32.load8_u
      local.tee $3
      i32.const 3
      i32.and
      local.tee $4
      i32.const 4
      i32.or
      local.get $4
      local.get $3
      i32.const 4
      i32.and
      select
      i32.store8
      local.get $6
      i32.const 1
      i32.add
      local.set $6
     end
     local.get $7
     i32.const 1
     i32.add
     local.set $3
     br $loop|0
    end
   end
  else
   local.get $4
   global.set $core/graphics/tiles/TileCache.tileId
  end
  local.get $0
  local.get $5
  i32.ge_s
  if
   local.get $0
   i32.const 8
   i32.add
   local.tee $1
   local.get $2
   i32.const 7
   i32.and
   local.tee $2
   i32.add
   local.get $1
   local.get $0
   local.get $2
   i32.lt_s
   select
   local.set $5
  end
  local.get $5
  global.set $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
  local.get $6
 )
 (func $core/graphics/tiles/getTileDataAddress (; 77 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  i32.const 34816
  i32.eq
  if
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
   local.set $1
  end
  local.get $1
  i32.const 4
  i32.shl
  local.get $0
  i32.add
 )
 (func $core/graphics/palette/getRgbColorFromPalette (; 78 ;) (type $FUNCSIG$iiii) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  local.get $0
  i32.const 3
  i32.shl
  local.get $1
  i32.const 1
  i32.shl
  i32.add
  local.tee $0
  i32.const 1
  i32.add
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
  local.set $1
  local.get $0
  i32.const 63
  i32.and
  local.tee $0
  i32.const -64
  i32.sub
  local.get $0
  local.get $2
  select
  i32.const 67584
  i32.add
  i32.load8_u
  local.get $1
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/graphics/palette/getColorizedGbHexColorFromPalette (; 79 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  local.get $1
  call $core/memory/load/eightBitLoadFromGBMemory
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
    local.get $0
    i32.eqz
    br_if $break|0
    block $case3|0
     block $case2|0
      block $case1|0
       block $tablify|0
        local.get $0
        i32.const 1
        i32.sub
        br_table $case1|0 $case2|0 $case3|0 $tablify|0
       end
       br $break|0
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
     local.get $0
     i32.eqz
     br_if $break|1
     block $case3|1
      block $case2|1
       block $case1|1
        block $tablify|00
         local.get $0
         i32.const 1
         i32.sub
         br_table $case1|1 $case2|1 $case3|1 $tablify|00
        end
        br $break|1
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
     local.get $0
     i32.eqz
     br_if $break|2
     block $case3|2
      block $case2|2
       block $case1|2
        block $tablify|01
         local.get $0
         i32.const 1
         i32.sub
         br_table $case1|2 $case2|2 $case3|2 $tablify|01
        end
        br $break|2
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
 (func $core/graphics/tiles/drawPixelsFromLineOfTile (; 80 ;) (type $FUNCSIG$iiiiiiiiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (param $12 i32) (result i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  local.get $1
  local.get $0
  call $core/graphics/tiles/getTileDataAddress
  local.get $5
  i32.const 1
  i32.shl
  i32.add
  local.tee $0
  i32.const -30720
  i32.add
  local.get $2
  i32.const 1
  i32.and
  i32.const 13
  i32.shl
  local.tee $1
  i32.add
  i32.load8_u
  local.set $17
  local.get $0
  i32.const -30719
  i32.add
  local.get $1
  i32.add
  i32.load8_u
  local.set $18
  local.get $3
  local.set $0
  loop $loop|0
   local.get $0
   local.get $4
   i32.le_s
   if
    local.get $0
    local.get $3
    i32.sub
    local.get $6
    i32.add
    local.tee $14
    local.get $8
    i32.lt_s
    if
     i32.const 0
     local.set $5
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
     local.tee $1
     i32.shl
     local.get $18
     i32.and
     if
      i32.const 2
      local.set $5
     end
     local.get $5
     i32.const 1
     i32.add
     local.get $5
     i32.const 1
     local.get $1
     i32.shl
     local.get $17
     i32.and
     select
     local.set $2
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
      local.tee $5
      if
       local.get $12
       i32.const 7
       i32.and
       local.set $1
      end
      local.get $1
      local.get $2
      local.get $5
      call $core/graphics/palette/getRgbColorFromPalette
      local.tee $5
      i32.const 31
      i32.and
      i32.const 3
      i32.shl
      local.set $1
      local.get $5
      i32.const 992
      i32.and
      i32.const 5
      i32.shr_s
      i32.const 3
      i32.shl
      local.set $15
      local.get $5
      i32.const 31744
      i32.and
      i32.const 10
      i32.shr_s
      i32.const 3
      i32.shl
     else
      local.get $2
      i32.const 65351
      local.get $10
      local.get $10
      i32.const 0
      i32.le_s
      select
      local.tee $10
      call $core/graphics/palette/getColorizedGbHexColorFromPalette
      local.tee $5
      i32.const 16711680
      i32.and
      i32.const 16
      i32.shr_s
      local.set $1
      local.get $5
      i32.const 65280
      i32.and
      i32.const 8
      i32.shr_s
      local.set $15
      local.get $5
      i32.const 255
      i32.and
     end
     local.set $5
     local.get $7
     local.get $8
     i32.mul
     local.get $14
     i32.add
     i32.const 3
     i32.mul
     local.get $9
     i32.add
     local.tee $16
     local.get $1
     i32.store8
     local.get $16
     i32.const 1
     i32.add
     local.get $15
     i32.store8
     local.get $16
     i32.const 2
     i32.add
     local.get $5
     i32.store8
     local.get $7
     i32.const 160
     i32.mul
     local.get $14
     i32.add
     i32.const 67712
     i32.add
     local.get $2
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
    br $loop|0
   end
  end
  local.get $13
 )
 (func $core/graphics/backgroundWindow/drawLineOfTileFromTileId (; 81 ;) (type $FUNCSIG$iiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (result i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $3
  i32.const 7
  i32.and
  local.set $3
  i32.const 0
  local.get $2
  local.get $2
  i32.const 3
  i32.shr_s
  i32.const 3
  i32.shl
  i32.sub
  local.get $0
  select
  local.set $7
  i32.const 160
  local.get $0
  i32.sub
  i32.const 7
  local.get $0
  i32.const 8
  i32.add
  i32.const 160
  i32.gt_s
  select
  local.set $8
  i32.const -1
  local.set $2
  global.get $core/cpu/cpu/Cpu.GBCEnabled
  if
   local.get $4
   i32.const -22528
   i32.add
   i32.load8_u
   local.tee $2
   i32.const 8
   i32.and
   i32.const 0
   i32.ne
   local.set $9
   local.get $2
   i32.const 64
   i32.and
   if
    i32.const 7
    local.get $3
    i32.sub
    local.set $3
   end
  end
  local.get $6
  local.get $5
  local.get $9
  local.get $7
  local.get $8
  local.get $3
  local.get $0
  local.get $1
  i32.const 160
  i32.const 91264
  i32.const 0
  local.get $2
  i32.const -1
  call $core/graphics/tiles/drawPixelsFromLineOfTile
 )
 (func $core/graphics/backgroundWindow/drawColorPixelFromTileId (; 82 ;) (type $FUNCSIG$viiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  local.get $3
  i32.const 7
  i32.and
  local.set $3
  local.get $5
  local.get $6
  call $core/graphics/tiles/getTileDataAddress
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
  local.tee $5
  i32.const -30720
  i32.add
  local.get $4
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  local.tee $6
  i32.const 13
  i32.shl
  i32.add
  i32.load8_u
  local.set $7
  local.get $2
  i32.const 7
  i32.and
  local.set $3
  i32.const 0
  local.set $2
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 91264
  i32.add
  local.get $4
  i32.const 7
  i32.and
  local.get $5
  i32.const -30719
  i32.add
  local.get $6
  i32.const 1
  i32.and
  i32.const 13
  i32.shl
  i32.add
  i32.load8_u
  i32.const 1
  local.get $3
  i32.const 7
  local.get $3
  i32.sub
  local.get $4
  i32.const 32
  i32.and
  select
  local.tee $3
  i32.shl
  i32.and
  if
   i32.const 2
   local.set $2
  end
  local.get $2
  i32.const 1
  i32.add
  local.get $2
  i32.const 1
  local.get $3
  i32.shl
  local.get $7
  i32.and
  select
  local.tee $3
  i32.const 0
  call $core/graphics/palette/getRgbColorFromPalette
  local.tee $2
  i32.const 31
  i32.and
  i32.const 3
  i32.shl
  i32.store8
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 91265
  i32.add
  local.get $2
  i32.const 992
  i32.and
  i32.const 5
  i32.shr_s
  i32.const 3
  i32.shl
  i32.store8
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 91266
  i32.add
  local.get $2
  i32.const 31744
  i32.and
  i32.const 10
  i32.shr_s
  i32.const 3
  i32.shl
  i32.store8
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
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
 (func $core/graphics/backgroundWindow/drawMonochromePixelFromTileId (; 83 ;) (type $FUNCSIG$viiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  local.get $4
  local.get $5
  call $core/graphics/tiles/getTileDataAddress
  local.get $3
  i32.const 7
  i32.and
  i32.const 1
  i32.shl
  i32.add
  local.tee $4
  i32.const -30720
  i32.add
  i32.load8_u
  local.set $5
  i32.const 0
  local.set $3
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 91264
  i32.add
  local.get $4
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
  if
   i32.const 2
   local.set $3
  end
  local.get $3
  i32.const 1
  i32.add
  local.get $3
  i32.const 1
  local.get $2
  i32.shl
  local.get $5
  i32.and
  select
  local.tee $3
  i32.const 65351
  call $core/graphics/palette/getColorizedGbHexColorFromPalette
  local.tee $2
  i32.const 16711680
  i32.and
  i32.const 16
  i32.shr_s
  i32.store8
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 91265
  i32.add
  local.get $2
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_s
  i32.store8
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
  i32.const 3
  i32.mul
  i32.const 91266
  i32.add
  local.get $2
  i32.store8
  local.get $1
  i32.const 160
  i32.mul
  local.get $0
  i32.add
  i32.const 67712
  i32.add
  local.get $3
  i32.const 3
  i32.and
  i32.store8
 )
 (func $core/graphics/backgroundWindow/drawBackgroundWindowScanline (; 84 ;) (type $FUNCSIG$viiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  local.get $3
  i32.const 3
  i32.shr_s
  local.set $10
  loop $loop|0
   local.get $4
   i32.const 160
   i32.lt_s
   if
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
    local.get $10
    i32.const 5
    i32.shl
    local.get $2
    i32.add
    local.get $6
    i32.const 3
    i32.shr_s
    i32.add
    local.tee $8
    i32.const -30720
    i32.add
    i32.load8_u
    local.set $7
    i32.const 0
    local.set $9
    global.get $core/config/Config.tileCaching
    if
     local.get $4
     local.get $0
     local.get $6
     local.get $8
     local.get $7
     call $core/graphics/backgroundWindow/drawLineOfTileFromTileCache
     local.tee $11
     i32.const 0
     i32.gt_s
     if
      i32.const 1
      local.set $9
      local.get $11
      i32.const 1
      i32.sub
      local.get $4
      i32.add
      local.set $4
     end
    end
    local.get $9
    i32.eqz
    i32.const 0
    global.get $core/config/Config.tileRendering
    select
    if
     local.get $4
     local.get $0
     local.get $6
     local.get $3
     local.get $8
     local.get $1
     local.get $7
     call $core/graphics/backgroundWindow/drawLineOfTileFromTileId
     local.tee $6
     i32.const 0
     i32.gt_s
     if
      local.get $6
      i32.const 1
      i32.sub
      local.get $4
      i32.add
      local.set $4
     end
    else
     local.get $9
     i32.eqz
     if
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      if
       local.get $4
       local.get $0
       local.get $6
       local.get $3
       local.get $8
       local.get $1
       local.get $7
       call $core/graphics/backgroundWindow/drawColorPixelFromTileId
      else
       local.get $4
       local.get $0
       local.get $6
       local.get $3
       local.get $1
       local.get $7
       call $core/graphics/backgroundWindow/drawMonochromePixelFromTileId
      end
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $loop|0
   end
  end
 )
 (func $core/graphics/backgroundWindow/renderWindow (; 85 ;) (type $FUNCSIG$viii) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $core/graphics/graphics/Graphics.windowX
  local.set $3
  local.get $0
  global.get $core/graphics/graphics/Graphics.windowY
  local.tee $4
  i32.lt_s
  if
   return
  end
  i32.const 0
  local.get $3
  i32.const 7
  i32.sub
  local.tee $3
  i32.sub
  local.set $5
  local.get $0
  local.get $1
  local.get $2
  local.get $0
  local.get $4
  i32.sub
  local.get $3
  local.get $5
  call $core/graphics/backgroundWindow/drawBackgroundWindowScanline
 )
 (func $core/graphics/sprites/renderSprites (; 86 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
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
   local.set $6
   loop $loop|0
    local.get $6
    i32.const 0
    i32.lt_s
    br_if $break|0
    local.get $6
    i32.const 2
    i32.shl
    local.tee $5
    i32.const 65024
    i32.add
    local.tee $3
    call $core/memory/load/eightBitLoadFromGBMemory
    local.get $3
    i32.const 1
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemory
    local.set $7
    local.get $3
    i32.const 2
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemory
    local.set $3
    i32.const 16
    i32.sub
    local.set $4
    local.get $7
    i32.const 8
    i32.sub
    local.set $11
    i32.const 8
    local.set $2
    local.get $1
    if
     i32.const 16
     local.set $2
     local.get $3
     local.get $3
     i32.const 1
     i32.and
     i32.sub
     local.set $3
    end
    local.get $0
    local.get $2
    local.get $4
    i32.add
    i32.lt_s
    i32.const 0
    local.get $0
    local.get $4
    i32.ge_s
    select
    if
     local.get $5
     i32.const 65027
     i32.add
     call $core/memory/load/eightBitLoadFromGBMemory
     local.tee $5
     i32.const 128
     i32.and
     i32.const 0
     i32.ne
     local.set $12
     local.get $5
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     local.set $13
     i32.const 32768
     local.get $3
     call $core/graphics/tiles/getTileDataAddress
     local.get $2
     local.get $0
     local.get $4
     i32.sub
     local.tee $3
     i32.sub
     i32.const 1
     i32.sub
     local.get $3
     local.get $5
     i32.const 64
     i32.and
     select
     i32.const 1
     i32.shl
     i32.add
     local.tee $3
     i32.const -30720
     i32.add
     local.get $5
     i32.const 8
     i32.and
     i32.const 0
     i32.ne
     global.get $core/cpu/cpu/Cpu.GBCEnabled
     local.tee $2
     local.get $2
     select
     i32.const 1
     i32.and
     i32.const 13
     i32.shl
     local.tee $2
     i32.add
     i32.load8_u
     local.set $14
     local.get $3
     i32.const -30719
     i32.add
     local.get $2
     i32.add
     i32.load8_u
     local.set $15
     i32.const 7
     local.set $3
     loop $loop|1
      local.get $3
      i32.const 0
      i32.ge_s
      if
       i32.const 0
       local.set $2
       i32.const 1
       i32.const 0
       local.get $3
       i32.const 7
       i32.sub
       i32.sub
       local.get $3
       local.get $13
       select
       local.tee $4
       i32.shl
       local.get $15
       i32.and
       if
        i32.const 2
        local.set $2
       end
       local.get $2
       i32.const 1
       i32.add
       local.get $2
       i32.const 1
       local.get $4
       i32.shl
       local.get $14
       i32.and
       select
       local.tee $4
       if
        i32.const 7
        local.get $3
        i32.sub
        local.get $11
        i32.add
        local.tee $2
        i32.const 0
        i32.ge_s
        if (result i32)
         local.get $2
         i32.const 160
         i32.le_s
        else
         i32.const 0
        end
        if
         i32.const 0
         local.set $7
         i32.const 0
         local.set $10
         global.get $core/graphics/lcd/Lcd.bgDisplayEnabled
         i32.eqz
         global.get $core/cpu/cpu/Cpu.GBCEnabled
         local.tee $8
         local.get $8
         select
         local.tee $8
         i32.eqz
         if
          local.get $0
          i32.const 160
          i32.mul
          local.get $2
          i32.add
          i32.const 67712
          i32.add
          i32.load8_u
          local.tee $9
          local.set $16
          local.get $9
          i32.const 3
          i32.and
          local.tee $9
          i32.const 0
          i32.gt_u
          i32.const 0
          local.get $12
          select
          if
           i32.const 1
           local.set $7
          else
           i32.const 1
           i32.const 0
           local.get $9
           i32.const 0
           i32.gt_u
           i32.const 0
           local.get $16
           i32.const 4
           i32.and
           i32.const 0
           global.get $core/cpu/cpu/Cpu.GBCEnabled
           select
           select
           select
           local.set $10
          end
         end
         i32.const 1
         i32.const 0
         local.get $10
         i32.eqz
         local.get $7
         select
         local.get $8
         select
         if
          global.get $core/cpu/cpu/Cpu.GBCEnabled
          if
           local.get $0
           i32.const 160
           i32.mul
           local.get $2
           i32.add
           i32.const 3
           i32.mul
           i32.const 91264
           i32.add
           local.get $5
           i32.const 7
           i32.and
           local.get $4
           i32.const 1
           call $core/graphics/palette/getRgbColorFromPalette
           local.tee $4
           i32.const 31
           i32.and
           i32.const 3
           i32.shl
           i32.store8
           local.get $0
           i32.const 160
           i32.mul
           local.get $2
           i32.add
           i32.const 3
           i32.mul
           i32.const 91265
           i32.add
           local.get $4
           i32.const 992
           i32.and
           i32.const 5
           i32.shr_s
           i32.const 3
           i32.shl
           i32.store8
           local.get $0
           i32.const 160
           i32.mul
           local.get $2
           i32.add
           i32.const 3
           i32.mul
           i32.const 91266
           i32.add
           local.get $4
           i32.const 31744
           i32.and
           i32.const 10
           i32.shr_s
           i32.const 3
           i32.shl
           i32.store8
          else
           local.get $0
           i32.const 160
           i32.mul
           local.get $2
           i32.add
           i32.const 3
           i32.mul
           i32.const 91264
           i32.add
           local.get $4
           i32.const 65353
           i32.const 65352
           local.get $5
           i32.const 16
           i32.and
           select
           call $core/graphics/palette/getColorizedGbHexColorFromPalette
           local.tee $4
           i32.const 16711680
           i32.and
           i32.const 16
           i32.shr_s
           i32.store8
           local.get $0
           i32.const 160
           i32.mul
           local.get $2
           i32.add
           i32.const 3
           i32.mul
           i32.const 91265
           i32.add
           local.get $4
           i32.const 65280
           i32.and
           i32.const 8
           i32.shr_s
           i32.store8
           local.get $0
           i32.const 160
           i32.mul
           local.get $2
           i32.add
           i32.const 3
           i32.mul
           i32.const 91266
           i32.add
           local.get $4
           i32.store8
          end
         end
        end
       end
       local.get $3
       i32.const 1
       i32.sub
       local.set $3
       br $loop|1
      end
     end
    end
    local.get $6
    i32.const 1
    i32.sub
    local.set $6
    br $loop|0
   end
   unreachable
  end
 )
 (func $core/graphics/graphics/_drawScanline (; 87 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
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
   global.get $core/graphics/graphics/Graphics.scrollY
   local.get $0
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
   local.get $1
   i32.const 39936
   i32.const 38912
   global.get $core/graphics/lcd/Lcd.windowTileMapDisplaySelect
   select
   call $core/graphics/backgroundWindow/renderWindow
  end
  global.get $core/graphics/lcd/Lcd.spriteDisplayEnable
  if
   local.get $0
   global.get $core/graphics/lcd/Lcd.tallSpriteSize
   call $core/graphics/sprites/renderSprites
  end
 )
 (func $core/graphics/graphics/_renderEntireFrame (; 88 ;) (type $FUNCSIG$v)
  (local $0 i32)
  block $break|0
   loop $loop|0
    local.get $0
    i32.const 144
    i32.gt_s
    br_if $break|0
    local.get $0
    i32.const 255
    i32.and
    call $core/graphics/graphics/_drawScanline
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $loop|0
   end
   unreachable
  end
 )
 (func $core/graphics/priority/clearPriorityMap (; 89 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  loop $loop|0
   local.get $1
   i32.const 144
   i32.ge_s
   i32.eqz
   if
    i32.const 0
    local.set $0
    loop $loop|1
     local.get $0
     i32.const 160
     i32.lt_s
     if
      local.get $1
      i32.const 160
      i32.mul
      local.get $0
      i32.add
      i32.const 67712
      i32.add
      i32.const 0
      i32.store8
      local.get $0
      i32.const 1
      i32.add
      local.set $0
      br $loop|1
     end
    end
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $loop|0
   end
  end
 )
 (func $core/interrupts/interrupts/_requestInterrupt (; 90 ;) (type $FUNCSIG$vi) (param $0 i32)
  i32.const 65295
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 1
  local.get $0
  i32.shl
  i32.or
  local.tee $0
  global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 65295
  local.get $0
  call $core/memory/store/eightBitStoreIntoGBMemory
 )
 (func $core/interrupts/interrupts/requestLcdInterrupt (; 91 ;) (type $FUNCSIG$v)
  i32.const 1
  global.set $core/interrupts/interrupts/Interrupts.isLcdInterruptRequested
  i32.const 1
  call $core/interrupts/interrupts/_requestInterrupt
 )
 (func $core/sound/channel2/Channel2.updateLength (; 92 ;) (type $FUNCSIG$v)
  (local $0 i32)
  global.get $core/sound/channel2/Channel2.lengthCounter
  local.tee $0
  i32.const 0
  i32.gt_s
  if (result i32)
   global.get $core/sound/channel2/Channel2.NRx4LengthEnabled
  else
   i32.const 0
  end
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
 )
 (func $core/sound/channel3/Channel3.updateLength (; 93 ;) (type $FUNCSIG$v)
  (local $0 i32)
  global.get $core/sound/channel3/Channel3.lengthCounter
  local.tee $0
  i32.const 0
  i32.gt_s
  if (result i32)
   global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
  else
   i32.const 0
  end
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
 )
 (func $core/sound/channel4/Channel4.updateLength (; 94 ;) (type $FUNCSIG$v)
  (local $0 i32)
  global.get $core/sound/channel4/Channel4.lengthCounter
  local.tee $0
  i32.const 0
  i32.gt_s
  if (result i32)
   global.get $core/sound/channel4/Channel4.NRx4LengthEnabled
  else
   i32.const 0
  end
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
 )
 (func $core/sound/channel1/Channel1.setFrequency (; 95 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  global.set $core/sound/channel1/Channel1.sweepShadowFrequency
  i32.const 65300
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 248
  i32.and
  local.set $1
  i32.const 65299
  local.get $0
  i32.const 255
  i32.and
  local.tee $2
  call $core/memory/store/eightBitStoreIntoGBMemory
  i32.const 65300
  local.get $1
  local.get $0
  i32.const 8
  i32.shr_s
  i32.const 7
  i32.and
  local.tee $0
  i32.or
  call $core/memory/store/eightBitStoreIntoGBMemory
  local.get $2
  global.set $core/sound/channel1/Channel1.NRx3FrequencyLSB
  local.get $0
  global.set $core/sound/channel1/Channel1.NRx4FrequencyMSB
  global.get $core/sound/channel1/Channel1.NRx3FrequencyLSB
  global.get $core/sound/channel1/Channel1.NRx4FrequencyMSB
  i32.const 8
  i32.shl
  i32.or
  global.set $core/sound/channel1/Channel1.frequency
 )
 (func $core/sound/channel1/Channel1.updateSweep (; 96 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
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
     call $core/sound/channel1/Channel1.setFrequency
     block $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow0 (result i32)
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
      br_if $__inlined_func$core/sound/channel1/didCalculatedSweepOverflow0
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
 (func $core/sound/channel1/Channel1.updateEnvelope (; 97 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  global.get $core/sound/channel1/Channel1.envelopeCounter
  i32.const 1
  i32.sub
  local.tee $1
  i32.const 0
  i32.le_s
  if
   global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
   if
    global.get $core/sound/channel1/Channel1.NRx2EnvelopePeriod
    local.tee $1
    if (result i32)
     global.get $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
    else
     i32.const 0
    end
    if
     global.get $core/sound/channel1/Channel1.volume
     local.set $0
     local.get $0
     i32.const 1
     i32.add
     local.get $0
     i32.const 1
     i32.sub
     global.get $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
     select
     i32.const 15
     i32.and
     local.tee $0
     i32.const 15
     i32.lt_s
     if
      local.get $0
      global.set $core/sound/channel1/Channel1.volume
     else
      i32.const 0
      global.set $core/sound/channel1/Channel1.isEnvelopeAutomaticUpdating
     end
    end
   else
    i32.const 8
    local.set $1
   end
  end
  local.get $1
  global.set $core/sound/channel1/Channel1.envelopeCounter
 )
 (func $core/sound/channel2/Channel2.updateEnvelope (; 98 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  global.get $core/sound/channel2/Channel2.envelopeCounter
  i32.const 1
  i32.sub
  local.tee $1
  i32.const 0
  i32.le_s
  if
   global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
   if
    global.get $core/sound/channel2/Channel2.NRx2EnvelopePeriod
    local.tee $1
    if (result i32)
     global.get $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
    else
     i32.const 0
    end
    if
     global.get $core/sound/channel2/Channel2.volume
     local.set $0
     local.get $0
     i32.const 1
     i32.add
     local.get $0
     i32.const 1
     i32.sub
     global.get $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
     select
     i32.const 15
     i32.and
     local.tee $0
     i32.const 15
     i32.lt_s
     if
      local.get $0
      global.set $core/sound/channel2/Channel2.volume
     else
      i32.const 0
      global.set $core/sound/channel2/Channel2.isEnvelopeAutomaticUpdating
     end
    end
   else
    i32.const 8
    local.set $1
   end
  end
  local.get $1
  global.set $core/sound/channel2/Channel2.envelopeCounter
 )
 (func $core/sound/channel4/Channel4.updateEnvelope (; 99 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  global.get $core/sound/channel4/Channel4.envelopeCounter
  i32.const 1
  i32.sub
  local.tee $1
  i32.const 0
  i32.le_s
  if
   global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
   if
    global.get $core/sound/channel4/Channel4.NRx2EnvelopePeriod
    local.tee $1
    if (result i32)
     global.get $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
    else
     i32.const 0
    end
    if
     global.get $core/sound/channel4/Channel4.volume
     local.set $0
     local.get $0
     i32.const 1
     i32.add
     local.get $0
     i32.const 1
     i32.sub
     global.get $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
     select
     i32.const 15
     i32.and
     local.tee $0
     i32.const 15
     i32.lt_s
     if
      local.get $0
      global.set $core/sound/channel4/Channel4.volume
     else
      i32.const 0
      global.set $core/sound/channel4/Channel4.isEnvelopeAutomaticUpdating
     end
    end
   else
    i32.const 8
    local.set $1
   end
  end
  local.get $1
  global.set $core/sound/channel4/Channel4.envelopeCounter
 )
 (func $core/sound/sound/updateFrameSequencer (; 100 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 8192
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  local.tee $1
  local.set $2
  global.get $core/sound/sound/Sound.frameSequenceCycleCounter
  local.get $0
  i32.add
  local.tee $0
  local.get $1
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
        global.get $core/sound/sound/Sound.frameSequencer
        i32.const 1
        i32.add
        i32.const 7
        i32.and
        local.tee $0
        if
         local.get $0
         i32.const 2
         i32.eq
         br_if $case1|0
         block $tablify|0
          local.get $0
          i32.const 4
          i32.sub
          br_table $case2|0 $tablify|0 $case3|0 $case4|0 $tablify|0
         end
         br $break|0
        end
        global.get $core/sound/channel1/Channel1.lengthCounter
        local.tee $1
        i32.const 0
        i32.gt_s
        if (result i32)
         global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
        else
         i32.const 0
        end
        if
         local.get $1
         i32.const 1
         i32.sub
         local.tee $1
         i32.eqz
         if
          i32.const 0
          global.set $core/sound/channel1/Channel1.isEnabled
         end
        end
        local.get $1
        global.set $core/sound/channel1/Channel1.lengthCounter
        call $core/sound/channel2/Channel2.updateLength
        call $core/sound/channel3/Channel3.updateLength
        call $core/sound/channel4/Channel4.updateLength
        br $break|0
       end
       global.get $core/sound/channel1/Channel1.lengthCounter
       local.tee $1
       i32.const 0
       i32.gt_s
       if (result i32)
        global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
       else
        i32.const 0
       end
       if
        local.get $1
        i32.const 1
        i32.sub
        local.tee $1
        i32.eqz
        if
         i32.const 0
         global.set $core/sound/channel1/Channel1.isEnabled
        end
       end
       local.get $1
       global.set $core/sound/channel1/Channel1.lengthCounter
       call $core/sound/channel2/Channel2.updateLength
       call $core/sound/channel3/Channel3.updateLength
       call $core/sound/channel4/Channel4.updateLength
       call $core/sound/channel1/Channel1.updateSweep
       br $break|0
      end
      global.get $core/sound/channel1/Channel1.lengthCounter
      local.tee $1
      i32.const 0
      i32.gt_s
      if (result i32)
       global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
      else
       i32.const 0
      end
      if
       local.get $1
       i32.const 1
       i32.sub
       local.tee $1
       i32.eqz
       if
        i32.const 0
        global.set $core/sound/channel1/Channel1.isEnabled
       end
      end
      local.get $1
      global.set $core/sound/channel1/Channel1.lengthCounter
      call $core/sound/channel2/Channel2.updateLength
      call $core/sound/channel3/Channel3.updateLength
      call $core/sound/channel4/Channel4.updateLength
      br $break|0
     end
     global.get $core/sound/channel1/Channel1.lengthCounter
     local.tee $1
     i32.const 0
     i32.gt_s
     if (result i32)
      global.get $core/sound/channel1/Channel1.NRx4LengthEnabled
     else
      i32.const 0
     end
     if
      local.get $1
      i32.const 1
      i32.sub
      local.tee $1
      i32.eqz
      if
       i32.const 0
       global.set $core/sound/channel1/Channel1.isEnabled
      end
     end
     local.get $1
     global.set $core/sound/channel1/Channel1.lengthCounter
     call $core/sound/channel2/Channel2.updateLength
     call $core/sound/channel3/Channel3.updateLength
     call $core/sound/channel4/Channel4.updateLength
     call $core/sound/channel1/Channel1.updateSweep
     br $break|0
    end
    call $core/sound/channel1/Channel1.updateEnvelope
    call $core/sound/channel2/Channel2.updateEnvelope
    call $core/sound/channel4/Channel4.updateEnvelope
   end
   local.get $0
   global.set $core/sound/sound/Sound.frameSequencer
   i32.const 1
   return
  else
   local.get $0
   global.set $core/sound/sound/Sound.frameSequenceCycleCounter
  end
  i32.const 0
 )
 (func $core/sound/accumulator/didChannelDacChange (; 101 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      local.get $0
      i32.const 1
      i32.ne
      if
       block $tablify|0
        local.get $0
        i32.const 2
        i32.sub
        br_table $case1|0 $case2|0 $case3|0 $tablify|0
       end
       br $break|0
      end
      global.get $core/sound/channel1/Channel1.isDacEnabled
      local.tee $0
      global.get $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
      i32.ne
      local.get $0
      global.set $core/sound/accumulator/SoundAccumulator.channel1DacEnabled
      return
     end
     global.get $core/sound/channel2/Channel2.isDacEnabled
     local.tee $0
     global.get $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
     i32.ne
     local.get $0
     global.set $core/sound/accumulator/SoundAccumulator.channel2DacEnabled
     return
    end
    global.get $core/sound/channel3/Channel3.isDacEnabled
    local.tee $0
    global.get $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
    i32.ne
    local.get $0
    global.set $core/sound/accumulator/SoundAccumulator.channel3DacEnabled
    return
   end
   global.get $core/sound/channel4/Channel4.isDacEnabled
   local.tee $0
   global.get $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
   i32.ne
   local.get $0
   global.set $core/sound/accumulator/SoundAccumulator.channel4DacEnabled
   return
  end
  i32.const 0
 )
 (func $core/sound/duty/isDutyCycleClockPositiveOrNegativeForWaveform (; 102 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  block $case3|0
   block $case2|0
    block $case1|0
     local.get $0
     i32.const 1
     i32.ne
     if
      local.get $0
      i32.const 2
      i32.eq
      br_if $case1|0
      local.get $0
      i32.const 3
      i32.eq
      br_if $case2|0
      br $case3|0
     end
     i32.const 1
     local.get $1
     i32.shl
     i32.const 129
     i32.and
     i32.const 0
     i32.ne
     return
    end
    i32.const 1
    local.get $1
    i32.shl
    i32.const 135
    i32.and
    i32.const 0
    i32.ne
    return
   end
   i32.const 1
   local.get $1
   i32.shl
   i32.const 126
   i32.and
   i32.const 0
   i32.ne
   return
  end
  i32.const 1
  local.get $1
  i32.shl
  i32.const 1
  i32.and
  i32.const 0
  i32.ne
 )
 (func $core/sound/channel1/Channel1.getSample (; 103 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/sound/channel1/Channel1.frequencyTimer
  local.get $0
  i32.sub
  local.set $0
  loop $continue|0
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
    br $continue|0
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
  global.get $core/sound/channel1/Channel1.NRx1Duty
  global.get $core/sound/channel1/Channel1.waveFormPositionOnDuty
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
 (func $core/sound/channel2/Channel2.getSample (; 104 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/sound/channel2/Channel2.frequencyTimer
  local.get $0
  i32.sub
  local.set $0
  loop $continue|0
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
    br $continue|0
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
  global.get $core/sound/channel2/Channel2.NRx1Duty
  global.get $core/sound/channel2/Channel2.waveFormPositionOnDuty
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
 (func $core/sound/channel3/readCurrentSampleByteFromWaveRam (; 105 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/sound/channel3/Channel3.waveTablePosition
  i32.const 1
  i32.shr_s
  i32.const 65328
  i32.add
  call $core/memory/load/eightBitLoadFromGBMemory
 )
 (func $core/sound/channel3/advanceWavePositionAndSampleBuffer (; 106 ;) (type $FUNCSIG$v)
  (local $0 i32)
  global.get $core/sound/channel3/Channel3.waveTablePosition
  i32.const 1
  i32.add
  local.set $0
  loop $continue|0
   local.get $0
   i32.const 32
   i32.lt_s
   i32.eqz
   if
    local.get $0
    i32.const 32
    i32.sub
    local.set $0
    br $continue|0
   end
  end
  local.get $0
  global.set $core/sound/channel3/Channel3.waveTablePosition
  call $core/sound/channel3/readCurrentSampleByteFromWaveRam
  global.set $core/sound/channel3/Channel3.sampleBuffer
 )
 (func $core/sound/channel3/Channel3.getSample (; 107 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
  local.set $2
  global.get $core/sound/channel3/Channel3.volumeCodeChanged
  if
   i32.const 65308
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 5
   i32.shr_s
   i32.const 15
   i32.and
   local.tee $2
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
  local.set $1
  block $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      local.get $2
      if
       local.get $2
       i32.const 1
       i32.eq
       br_if $case1|0
       local.get $2
       i32.const 2
       i32.eq
       br_if $case2|0
       br $case3|0
      end
      local.get $1
      i32.const 4
      i32.shr_s
      local.set $1
      br $break|0
     end
     i32.const 1
     local.set $3
     br $break|0
    end
    local.get $1
    i32.const 1
    i32.shr_s
    local.set $1
    i32.const 2
    local.set $3
    br $break|0
   end
   local.get $1
   i32.const 2
   i32.shr_s
   local.set $1
   i32.const 4
   local.set $3
  end
  local.get $3
  i32.const 0
  i32.gt_s
  if (result i32)
   local.get $1
   local.get $3
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
  loop $continue|1
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
    local.tee $2
    local.get $0
    local.get $2
    i32.add
    i32.xor
    i32.sub
    local.set $0
    call $core/sound/channel3/advanceWavePositionAndSampleBuffer
    br $continue|1
   end
  end
  local.get $0
  global.set $core/sound/channel3/Channel3.frequencyTimer
 )
 (func $core/sound/channel4/Channel4.getSample (; 108 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
 (func $core/sound/sound/getSampleAsUnsignedByte (; 109 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  i32.const 60
  i32.eq
  if
   i32.const 127
   return
  end
  local.get $0
  i32.const 60
  i32.sub
  i32.const 100000
  i32.mul
  local.get $1
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
 )
 (func $core/sound/sound/mixChannelSamples (; 110 ;) (type $FUNCSIG$iiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.mixerVolumeChanged
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
  local.set $1
  local.get $3
  i32.const 15
  global.get $core/sound/sound/Sound.NR51IsChannel4EnabledOnRightOutput
  select
  local.set $3
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.mixerEnabledChanged
  i32.const 0
  global.set $core/sound/accumulator/SoundAccumulator.needToRemixSamples
  global.get $core/sound/sound/Sound.NR50LeftMixerVolume
  i32.const 1
  i32.add
  call $core/sound/sound/getSampleAsUnsignedByte
  local.set $0
  local.get $1
  local.get $3
  i32.add
  global.get $core/sound/sound/Sound.NR50RightMixerVolume
  i32.const 1
  i32.add
  call $core/sound/sound/getSampleAsUnsignedByte
  local.set $1
  local.get $0
  global.set $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
  local.get $1
  global.set $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
  local.get $1
  i32.const 255
  i32.and
  local.get $0
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/sound/accumulator/accumulateSound (; 111 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $core/sound/channel1/Channel1.cycleCounter
  local.get $0
  i32.add
  local.tee $2
  global.set $core/sound/channel1/Channel1.cycleCounter
  global.get $core/sound/channel1/Channel1.frequencyTimer
  local.get $2
  i32.sub
  i32.const 0
  i32.le_s
  local.tee $2
  i32.eqz
  if
   i32.const 1
   call $core/sound/accumulator/didChannelDacChange
   local.set $2
  end
  global.get $core/sound/channel2/Channel2.cycleCounter
  local.get $0
  i32.add
  local.tee $1
  global.set $core/sound/channel2/Channel2.cycleCounter
  global.get $core/sound/channel2/Channel2.frequencyTimer
  local.get $1
  i32.sub
  i32.const 0
  i32.le_s
  local.tee $1
  i32.eqz
  if
   i32.const 2
   call $core/sound/accumulator/didChannelDacChange
   local.set $1
  end
  global.get $core/sound/channel3/Channel3.cycleCounter
  local.get $0
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
   i32.const 3
   call $core/sound/accumulator/didChannelDacChange
   local.set $4
  end
  global.get $core/sound/channel4/Channel4.cycleCounter
  local.get $0
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
   i32.const 4
   call $core/sound/accumulator/didChannelDacChange
   local.set $5
  end
  local.get $2
  if
   global.get $core/sound/channel1/Channel1.cycleCounter
   i32.const 0
   global.set $core/sound/channel1/Channel1.cycleCounter
   call $core/sound/channel1/Channel1.getSample
   global.set $core/sound/accumulator/SoundAccumulator.channel1Sample
  end
  local.get $1
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
  local.get $1
  local.get $2
  select
  select
  select
  if
   i32.const 1
   global.set $core/sound/accumulator/SoundAccumulator.needToRemixSamples
  end
  i32.const 4194304
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  i32.const 44100
  i32.div_s
  local.tee $2
  local.set $1
  global.get $core/sound/sound/Sound.downSampleCycleCounter
  local.get $0
  i32.add
  local.tee $0
  local.get $2
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
   local.tee $2
   i32.const 1
   i32.shl
   i32.const 1068160
   i32.add
   local.tee $1
   global.get $core/sound/accumulator/SoundAccumulator.leftChannelSampleUnsignedByte
   i32.const 2
   i32.add
   i32.store8
   local.get $1
   i32.const 1
   i32.add
   global.get $core/sound/accumulator/SoundAccumulator.rightChannelSampleUnsignedByte
   i32.const 2
   i32.add
   i32.store8
   local.get $2
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
 (func $core/sound/sound/calculateSound (; 112 ;) (type $FUNCSIG$vi) (param $0 i32)
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
  global.get $core/sound/sound/Sound.downSampleCycleCounter
  local.get $0
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
   i32.shr_s
   i32.const 2
   i32.add
   i32.store8
   local.get $6
   i32.const 1
   i32.add
   local.get $3
   i32.const 255
   i32.and
   i32.const 2
   i32.add
   i32.store8
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
    i32.shr_s
    i32.const 2
    i32.add
    i32.store8
    local.get $3
    i32.const 1
    i32.add
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8
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
    i32.shr_s
    i32.const 2
    i32.add
    i32.store8
    local.get $2
    i32.const 1
    i32.add
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8
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
    i32.shr_s
    i32.const 2
    i32.add
    i32.store8
    local.get $2
    i32.const 1
    i32.add
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8
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
    i32.shr_s
    i32.const 2
    i32.add
    i32.store8
    local.get $2
    i32.const 1
    i32.add
    local.get $1
    i32.const 255
    i32.and
    i32.const 2
    i32.add
    i32.store8
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
 (func $core/sound/sound/updateSound (; 113 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
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
 )
 (func $core/sound/sound/batchProcessAudio (; 114 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  i32.const 87
  global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
  i32.shl
  local.set $1
  global.get $core/sound/sound/Sound.currentCycles
  local.set $0
  loop $continue|0
   local.get $0
   local.get $1
   i32.ge_s
   if
    local.get $1
    call $core/sound/sound/updateSound
    local.get $0
    local.get $1
    i32.sub
    local.set $0
    br $continue|0
   end
  end
  local.get $0
  global.set $core/sound/sound/Sound.currentCycles
 )
 (func $core/sound/registers/SoundRegisterReadTraps (; 115 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                         local.get $0
                         i32.const 65296
                         i32.ne
                         if
                          local.get $0
                          i32.const 65301
                          i32.eq
                          br_if $case1|0
                          block $tablify|0
                           local.get $0
                           i32.const 65297
                           i32.sub
                           br_table $case5|0 $case10|0 $case15|0 $case19|0 $tablify|0 $case6|0 $case11|0 $case16|0 $case20|0 $case2|0 $case7|0 $case12|0 $case17|0 $case21|0 $case3|0 $case8|0 $case13|0 $case18|0 $case22|0 $case4|0 $case9|0 $case14|0 $tablify|0
                          end
                          br $break|0
                         end
                         i32.const 65296
                         call $core/memory/load/eightBitLoadFromGBMemory
                         i32.const 128
                         i32.or
                         return
                        end
                        i32.const 65301
                        call $core/memory/load/eightBitLoadFromGBMemory
                        i32.const 255
                        i32.or
                        return
                       end
                       i32.const 65306
                       call $core/memory/load/eightBitLoadFromGBMemory
                       i32.const 127
                       i32.or
                       return
                      end
                      i32.const 65311
                      call $core/memory/load/eightBitLoadFromGBMemory
                      i32.const 255
                      i32.or
                      return
                     end
                     i32.const 65316
                     call $core/memory/load/eightBitLoadFromGBMemory
                     return
                    end
                    i32.const 65297
                    call $core/memory/load/eightBitLoadFromGBMemory
                    i32.const 63
                    i32.or
                    return
                   end
                   i32.const 65302
                   call $core/memory/load/eightBitLoadFromGBMemory
                   i32.const 63
                   i32.or
                   return
                  end
                  i32.const 65307
                  call $core/memory/load/eightBitLoadFromGBMemory
                  i32.const 255
                  i32.or
                  return
                 end
                 i32.const 65312
                 call $core/memory/load/eightBitLoadFromGBMemory
                 i32.const 255
                 i32.or
                 return
                end
                i32.const 65317
                call $core/memory/load/eightBitLoadFromGBMemory
                return
               end
               i32.const 65298
               call $core/memory/load/eightBitLoadFromGBMemory
               return
              end
              i32.const 65303
              call $core/memory/load/eightBitLoadFromGBMemory
              return
             end
             i32.const 65308
             call $core/memory/load/eightBitLoadFromGBMemory
             i32.const 159
             i32.or
             return
            end
            i32.const 65313
            call $core/memory/load/eightBitLoadFromGBMemory
            return
           end
           i32.const 128
           i32.const 0
           global.get $core/sound/sound/Sound.NR52IsSoundEnabled
           select
           local.set $0
           local.get $0
           i32.const 1
           i32.or
           local.get $0
           i32.const -2
           i32.and
           global.get $core/sound/channel1/Channel1.isEnabled
           select
           local.set $0
           local.get $0
           i32.const 2
           i32.or
           local.get $0
           i32.const -3
           i32.and
           global.get $core/sound/channel2/Channel2.isEnabled
           select
           local.set $0
           local.get $0
           i32.const 4
           i32.or
           local.get $0
           i32.const -5
           i32.and
           global.get $core/sound/channel3/Channel3.isEnabled
           select
           local.set $0
           local.get $0
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
          call $core/memory/load/eightBitLoadFromGBMemory
          i32.const 255
          i32.or
          return
         end
         i32.const 65304
         call $core/memory/load/eightBitLoadFromGBMemory
         i32.const 255
         i32.or
         return
        end
        i32.const 65309
        call $core/memory/load/eightBitLoadFromGBMemory
        i32.const 255
        i32.or
        return
       end
       i32.const 65314
       call $core/memory/load/eightBitLoadFromGBMemory
       return
      end
      i32.const 65300
      call $core/memory/load/eightBitLoadFromGBMemory
      i32.const 191
      i32.or
      return
     end
     i32.const 65305
     call $core/memory/load/eightBitLoadFromGBMemory
     i32.const 191
     i32.or
     return
    end
    i32.const 65310
    call $core/memory/load/eightBitLoadFromGBMemory
    i32.const 191
    i32.or
    return
   end
   i32.const 65315
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 191
   i32.or
   return
  end
  i32.const -1
 )
 (func $core/joypad/joypad/getJoypadState (; 116 ;) (type $FUNCSIG$i) (result i32)
  (local $0 i32)
  global.get $core/joypad/joypad/Joypad.joypadRegisterFlipped
  local.set $0
  global.get $core/joypad/joypad/Joypad.isDpadType
  if
   local.get $0
   i32.const -5
   i32.and
   local.get $0
   i32.const 4
   i32.or
   global.get $core/joypad/joypad/Joypad.up
   select
   local.set $0
   local.get $0
   i32.const -2
   i32.and
   local.get $0
   i32.const 1
   i32.or
   global.get $core/joypad/joypad/Joypad.right
   select
   local.set $0
   local.get $0
   i32.const -9
   i32.and
   local.get $0
   i32.const 8
   i32.or
   global.get $core/joypad/joypad/Joypad.down
   select
   local.set $0
   local.get $0
   i32.const -3
   i32.and
   local.get $0
   i32.const 2
   i32.or
   global.get $core/joypad/joypad/Joypad.left
   select
   local.set $0
  else
   global.get $core/joypad/joypad/Joypad.isButtonType
   if
    local.get $0
    i32.const -2
    i32.and
    local.get $0
    i32.const 1
    i32.or
    global.get $core/joypad/joypad/Joypad.a
    select
    local.set $0
    local.get $0
    i32.const -3
    i32.and
    local.get $0
    i32.const 2
    i32.or
    global.get $core/joypad/joypad/Joypad.b
    select
    local.set $0
    local.get $0
    i32.const -5
    i32.and
    local.get $0
    i32.const 4
    i32.or
    global.get $core/joypad/joypad/Joypad.select
    select
    local.set $0
    local.get $0
    i32.const -9
    i32.and
    local.get $0
    i32.const 8
    i32.or
    global.get $core/joypad/joypad/Joypad.start
    select
    local.set $0
   end
  end
  local.get $0
  i32.const 240
  i32.or
 )
 (func $core/memory/readTraps/checkReadTraps (; 117 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
   call $core/memory/load/eightBitLoadFromGBMemory
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
   i32.const 255
   local.set $0
   i32.const 65357
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 254
    local.set $0
   end
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.eqz
   if
    local.get $0
    i32.const -129
    i32.and
    local.set $0
   end
   local.get $0
   return
  end
  local.get $0
  i32.const 65348
  i32.eq
  if
   local.get $0
   global.get $core/graphics/graphics/Graphics.scanlineRegister
   call $core/memory/store/eightBitStoreIntoGBMemory
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
    call $core/sound/channel3/readCurrentSampleByteFromWaveRam
    return
   end
   i32.const -1
   return
  end
  local.get $0
  i32.const 65284
  i32.eq
  if
   local.get $0
   global.get $core/timers/timers/Timers.dividerRegister
   i32.const 65280
   i32.and
   i32.const 8
   i32.shr_s
   local.tee $0
   call $core/memory/store/eightBitStoreIntoGBMemory
   local.get $0
   return
  end
  local.get $0
  i32.const 65285
  i32.eq
  if
   local.get $0
   global.get $core/timers/timers/Timers.timerCounter
   call $core/memory/store/eightBitStoreIntoGBMemory
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
 (func $core/memory/load/eightBitLoadFromGBMemoryWithTraps (; 118 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/debug/breakpoints/Breakpoints.readGbMemory
  local.get $0
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
   call $core/memory/load/eightBitLoadFromGBMemory
  else
   local.get $1
   i32.const 255
   i32.and
  end
 )
 (func $core/memory/banking/handleBanking (; 119 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
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
   local.get $2
   if (result i32)
    local.get $1
    i32.const 16
    i32.and
    i32.eqz
   else
    i32.const 0
   end
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
    global.get $core/memory/memory/Memory.isMBC5
    local.tee $4
    if (result i32)
     local.get $0
     i32.const 12287
     i32.le_s
    else
     i32.const 1
    end
    if
     local.get $1
     i32.const 15
     i32.and
     global.get $core/memory/memory/Memory.currentRomBank
     local.get $2
     select
     local.set $0
     local.get $3
     if (result i32)
      local.get $1
      i32.const 31
      i32.and
      local.set $1
      local.get $0
      i32.const 224
      i32.and
     else
      global.get $core/memory/memory/Memory.isMBC3
      if (result i32)
       local.get $1
       i32.const 127
       i32.and
       local.set $1
       local.get $0
       i32.const 128
       i32.and
      else
       i32.const 0
       local.get $0
       local.get $4
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
 (func $core/sound/channel1/Channel1.updateNRx0 (; 120 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  global.get $core/sound/channel1/Channel1.NRx0Negate
  local.set $1
  local.get $0
  i32.const 112
  i32.and
  i32.const 4
  i32.shr_s
  global.set $core/sound/channel1/Channel1.NRx0SweepPeriod
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel1/Channel1.NRx0Negate
  local.get $0
  i32.const 7
  i32.and
  global.set $core/sound/channel1/Channel1.NRx0SweepShift
  i32.const 0
  global.get $core/sound/channel1/Channel1.sweepNegateShouldDisableChannelOnClear
  global.get $core/sound/channel1/Channel1.NRx0Negate
  select
  i32.const 0
  local.get $1
  select
  if
   i32.const 0
   global.set $core/sound/channel1/Channel1.isEnabled
  end
 )
 (func $core/sound/channel1/Channel1.updateNRx2 (; 121 ;) (type $FUNCSIG$vi) (param $0 i32)
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
   local.get $0
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
  local.get $0
  i32.const 4
  i32.shr_s
  i32.const 15
  i32.and
  global.set $core/sound/channel1/Channel1.NRx2StartingVolume
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel1/Channel1.NRx2EnvelopeAddMode
  local.get $0
  i32.const 7
  i32.and
  global.set $core/sound/channel1/Channel1.NRx2EnvelopePeriod
  local.get $0
  i32.const 248
  i32.and
  i32.const 0
  i32.gt_s
  local.tee $0
  global.set $core/sound/channel1/Channel1.isDacEnabled
  local.get $0
  i32.eqz
  if
   i32.const 0
   global.set $core/sound/channel1/Channel1.isEnabled
  end
 )
 (func $core/sound/channel2/Channel2.updateNRx2 (; 122 ;) (type $FUNCSIG$vi) (param $0 i32)
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
   local.get $0
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
  local.get $0
  i32.const 4
  i32.shr_s
  i32.const 15
  i32.and
  global.set $core/sound/channel2/Channel2.NRx2StartingVolume
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel2/Channel2.NRx2EnvelopeAddMode
  local.get $0
  i32.const 7
  i32.and
  global.set $core/sound/channel2/Channel2.NRx2EnvelopePeriod
  local.get $0
  i32.const 248
  i32.and
  i32.const 0
  i32.gt_s
  local.tee $0
  global.set $core/sound/channel2/Channel2.isDacEnabled
  local.get $0
  i32.eqz
  if
   local.get $0
   global.set $core/sound/channel2/Channel2.isEnabled
  end
 )
 (func $core/sound/channel4/Channel4.updateNRx2 (; 123 ;) (type $FUNCSIG$vi) (param $0 i32)
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
   local.get $0
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
  local.get $0
  i32.const 4
  i32.shr_s
  i32.const 15
  i32.and
  global.set $core/sound/channel4/Channel4.NRx2StartingVolume
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel4/Channel4.NRx2EnvelopeAddMode
  local.get $0
  i32.const 7
  i32.and
  global.set $core/sound/channel4/Channel4.NRx2EnvelopePeriod
  local.get $0
  i32.const 248
  i32.and
  i32.const 0
  i32.gt_s
  local.tee $0
  global.set $core/sound/channel4/Channel4.isDacEnabled
  local.get $0
  i32.eqz
  if
   local.get $0
   global.set $core/sound/channel4/Channel4.isEnabled
  end
 )
 (func $core/sound/channel4/Channel4.updateNRx3 (; 124 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  i32.const 4
  i32.shr_s
  global.set $core/sound/channel4/Channel4.NRx3ClockShift
  local.get $0
  i32.const 8
  i32.and
  i32.const 0
  i32.ne
  global.set $core/sound/channel4/Channel4.NRx3WidthMode
  local.get $0
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
  if
   i32.const 1
   local.set $0
  end
  local.get $0
  i32.const 3
  i32.shl
  global.set $core/sound/channel4/Channel4.divisor
 )
 (func $core/sound/channel1/Channel1.trigger (; 125 ;) (type $FUNCSIG$v)
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
 (func $core/sound/channel1/Channel1.updateNRx4 (; 126 ;) (type $FUNCSIG$vi) (param $0 i32)
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
  global.get $core/sound/sound/Sound.frameSequencer
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  local.set $2
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
  local.get $2
  i32.eqz
  if
   i32.const 0
   local.get $1
   global.get $core/sound/channel1/Channel1.lengthCounter
   i32.const 0
   i32.le_s
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
 (func $core/sound/channel2/Channel2.trigger (; 127 ;) (type $FUNCSIG$v)
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
 )
 (func $core/sound/channel2/Channel2.updateNRx4 (; 128 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  i32.const 7
  i32.and
  local.tee $1
  global.set $core/sound/channel2/Channel2.NRx4FrequencyMSB
  global.get $core/sound/channel2/Channel2.NRx3FrequencyLSB
  local.get $1
  i32.const 8
  i32.shl
  i32.or
  global.set $core/sound/channel2/Channel2.frequency
  global.get $core/sound/sound/Sound.frameSequencer
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
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
   i32.const 0
   local.get $1
   global.get $core/sound/channel2/Channel2.lengthCounter
   i32.const 0
   i32.le_s
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
   call $core/sound/channel2/Channel2.trigger
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
 (func $core/sound/channel3/Channel3.trigger (; 129 ;) (type $FUNCSIG$v)
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
 )
 (func $core/sound/channel3/Channel3.updateNRx4 (; 130 ;) (type $FUNCSIG$vi) (param $0 i32)
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
  i32.const 1
  i32.eq
  local.tee $1
  i32.eqz
  if
   i32.const 0
   i32.const 0
   local.get $0
   i32.const 64
   i32.and
   global.get $core/sound/channel3/Channel3.NRx4LengthEnabled
   select
   global.get $core/sound/channel3/Channel3.lengthCounter
   i32.const 0
   i32.le_s
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
   call $core/sound/channel3/Channel3.trigger
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
 (func $core/sound/channel4/Channel4.trigger (; 131 ;) (type $FUNCSIG$v)
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
 )
 (func $core/sound/channel4/Channel4.updateNRx4 (; 132 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/sound/sound/Sound.frameSequencer
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  local.set $2
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
  local.get $2
  i32.eqz
  if
   i32.const 0
   local.get $1
   global.get $core/sound/channel4/Channel4.lengthCounter
   i32.const 0
   i32.le_s
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
   call $core/sound/channel4/Channel4.trigger
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
 (func $core/sound/registers/SoundRegisterWriteTraps (; 133 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
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
                        local.get $0
                        i32.const 65296
                        i32.ne
                        if
                         local.get $0
                         i32.const 65306
                         i32.eq
                         br_if $case1|0
                         block $tablify|0
                          local.get $0
                          i32.const 65297
                          i32.sub
                          br_table $case2|0 $case6|0 $case10|0 $case14|0 $tablify|0 $case3|0 $case7|0 $case11|0 $case15|0 $tablify|0 $case4|0 $case8|0 $case12|0 $case16|0 $tablify|0 $case5|0 $case9|0 $case13|0 $case17|0 $case18|0 $case19|0 $case20|0 $tablify|0
                         end
                         br $break|0
                        end
                        local.get $1
                        call $core/sound/channel1/Channel1.updateNRx0
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
                  local.get $1
                  call $core/sound/channel1/Channel1.updateNRx2
                  br $folding-inner0
                 end
                 local.get $1
                 call $core/sound/channel2/Channel2.updateNRx2
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
               local.get $1
               call $core/sound/channel4/Channel4.updateNRx2
               br $folding-inner0
              end
              local.get $1
              global.set $core/sound/channel1/Channel1.NRx3FrequencyLSB
              global.get $core/sound/channel1/Channel1.NRx4FrequencyMSB
              i32.const 8
              i32.shl
              local.get $1
              i32.or
              global.set $core/sound/channel1/Channel1.frequency
              br $folding-inner0
             end
             local.get $1
             global.set $core/sound/channel2/Channel2.NRx3FrequencyLSB
             global.get $core/sound/channel2/Channel2.NRx4FrequencyMSB
             i32.const 8
             i32.shl
             local.get $1
             i32.or
             global.set $core/sound/channel2/Channel2.frequency
             br $folding-inner0
            end
            local.get $1
            global.set $core/sound/channel3/Channel3.NRx3FrequencyLSB
            global.get $core/sound/channel3/Channel3.NRx4FrequencyMSB
            i32.const 8
            i32.shl
            local.get $1
            i32.or
            global.set $core/sound/channel3/Channel3.frequency
            br $folding-inner0
           end
           local.get $1
           call $core/sound/channel4/Channel4.updateNRx3
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
     call $core/sound/sound/Sound.updateNR51
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
     block $break|1
      i32.const 65296
      local.set $0
      loop $loop|1
       local.get $0
       i32.const 65318
       i32.ge_s
       br_if $break|1
       local.get $0
       i32.const 0
       call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
       local.get $0
       i32.const 1
       i32.add
       local.set $0
       br $loop|1
      end
      unreachable
     end
    end
    local.get $1
    i32.const 128
    i32.and
    i32.const 0
    i32.ne
    global.set $core/sound/sound/Sound.NR52IsSoundEnabled
    br $folding-inner0
   end
   i32.const 1
   return
  end
  i32.const 1
 )
 (func $core/memory/dma/startDmaTransfer (; 134 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  local.get $0
  i32.const 8
  i32.shl
  local.set $1
  i32.const 0
  local.set $0
  loop $loop|0
   block $break|0
    local.get $0
    i32.const 159
    i32.gt_s
    br_if $break|0
    local.get $0
    i32.const 65024
    i32.add
    local.get $0
    local.get $1
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemory
    call $core/memory/store/eightBitStoreIntoGBMemory
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $loop|0
   end
  end
  i32.const 644
  global.set $core/memory/memory/Memory.DMACycles
 )
 (func $core/memory/dma/getHdmaSourceFromMemory (; 135 ;) (type $FUNCSIG$i) (result i32)
  (local $0 i32)
  i32.const 65361
  call $core/memory/load/eightBitLoadFromGBMemory
  local.set $0
  i32.const 65362
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 255
  i32.and
  local.get $0
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
  i32.const 65520
  i32.and
 )
 (func $core/memory/dma/getHdmaDestinationFromMemory (; 136 ;) (type $FUNCSIG$i) (result i32)
  (local $0 i32)
  i32.const 65363
  call $core/memory/load/eightBitLoadFromGBMemory
  local.set $0
  i32.const 65364
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 255
  i32.and
  local.get $0
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
 (func $core/memory/dma/startHdmaTransfer (; 137 ;) (type $FUNCSIG$vi) (param $0 i32)
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
   i32.const 65365
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 128
   i32.or
   call $core/memory/store/eightBitStoreIntoGBMemory
   return
  end
  call $core/memory/dma/getHdmaSourceFromMemory
  local.set $1
  call $core/memory/dma/getHdmaDestinationFromMemory
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
   local.get $0
   i32.const -129
   i32.and
   call $core/memory/store/eightBitStoreIntoGBMemory
  else
   local.get $1
   local.get $2
   local.get $3
   call $core/memory/dma/hdmaTransfer
   i32.const 65365
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/graphics/palette/writeColorPaletteToMemory (; 138 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  i32.const 1
  i32.const 65387
  local.tee $3
  local.get $0
  i32.eq
  local.get $0
  i32.const 65385
  i32.eq
  select
  if
   local.get $0
   i32.const 1
   i32.sub
   local.tee $4
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const -65
   i32.and
   local.tee $2
   i32.const 63
   i32.and
   local.tee $5
   i32.const -64
   i32.sub
   local.get $5
   local.get $0
   local.get $3
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
    local.get $4
    local.get $2
    i32.const 1
    i32.add
    i32.const 128
    i32.or
    call $core/memory/store/eightBitStoreIntoGBMemory
   end
  end
 )
 (func $core/timers/timers/_getTimerCounterMaskBit (; 139 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  block $break|0
   block $case3|0
    block $case2|0
     block $case1|0
      local.get $0
      if
       block $tablify|0
        local.get $0
        i32.const 1
        i32.sub
        br_table $case1|0 $case2|0 $case3|0 $tablify|0
       end
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
 (func $core/timers/timers/_checkDividerRegisterFallingEdgeDetector (; 140 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  i32.const 1
  global.get $core/timers/timers/Timers.timerInputClock
  call $core/timers/timers/_getTimerCounterMaskBit
  local.tee $0
  i32.shl
  i32.and
  if (result i32)
   i32.const 1
   local.get $0
   i32.shl
   local.get $1
   i32.and
   i32.eqz
  else
   i32.const 0
  end
 )
 (func $core/timers/timers/updateTimers (; 141 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  loop $continue|0
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
     local.get $3
     call $core/timers/timers/_checkDividerRegisterFallingEdgeDetector
     if
      global.get $core/timers/timers/Timers.timerCounter
      i32.const 1
      i32.add
      local.tee $1
      i32.const 255
      i32.gt_s
      if
       i32.const 1
       global.set $core/timers/timers/Timers.timerCounterOverflowDelay
       i32.const 0
       local.set $1
      end
      local.get $1
      global.set $core/timers/timers/Timers.timerCounter
     end
    end
    br $continue|0
   end
  end
 )
 (func $core/timers/timers/batchProcessTimers (; 142 ;) (type $FUNCSIG$v)
  global.get $core/timers/timers/Timers.currentCycles
  call $core/timers/timers/updateTimers
  i32.const 0
  global.set $core/timers/timers/Timers.currentCycles
 )
 (func $core/timers/timers/Timers.updateDividerRegister (; 143 ;) (type $FUNCSIG$v)
  (local $0 i32)
  global.get $core/timers/timers/Timers.dividerRegister
  local.set $0
  i32.const 0
  global.set $core/timers/timers/Timers.dividerRegister
  i32.const 65284
  i32.const 0
  call $core/memory/store/eightBitStoreIntoGBMemory
  global.get $core/timers/timers/Timers.timerEnabled
  if (result i32)
   local.get $0
   i32.const 0
   call $core/timers/timers/_checkDividerRegisterFallingEdgeDetector
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
   if
    i32.const 1
    global.set $core/timers/timers/Timers.timerCounterOverflowDelay
    i32.const 0
    local.set $0
   end
   local.get $0
   global.set $core/timers/timers/Timers.timerCounter
  end
 )
 (func $core/timers/timers/Timers.updateTimerControl (; 144 ;) (type $FUNCSIG$vi) (param $0 i32)
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
  local.set $2
  i32.eqz
  if
   global.get $core/timers/timers/Timers.timerInputClock
   call $core/timers/timers/_getTimerCounterMaskBit
   local.set $1
   local.get $2
   call $core/timers/timers/_getTimerCounterMaskBit
   local.set $3
   global.get $core/timers/timers/Timers.dividerRegister
   local.set $0
   global.get $core/timers/timers/Timers.timerEnabled
   if (result i32)
    i32.const 1
    local.get $1
    i32.shl
    local.get $0
    i32.and
   else
    i32.const 1
    local.get $3
    i32.shl
    local.get $0
    i32.and
    i32.const 0
    i32.const 1
    local.get $1
    i32.shl
    local.get $0
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
    if
     i32.const 1
     global.set $core/timers/timers/Timers.timerCounterOverflowDelay
     i32.const 0
     local.set $0
    end
    local.get $0
    global.set $core/timers/timers/Timers.timerCounter
   end
  end
  local.get $2
  global.set $core/timers/timers/Timers.timerInputClock
 )
 (func $core/memory/writeTraps/checkWriteTraps (; 145 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  block $folding-inner1
   block $folding-inner0
    local.get $0
    i32.const 65357
    i32.eq
    if
     i32.const 65357
     local.get $1
     i32.const 1
     i32.and
     call $core/memory/store/eightBitStoreIntoGBMemory
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
     local.get $1
     call $core/memory/store/eightBitStoreIntoGBMemory
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
     i32.const 1
     i32.and
     i32.const 0
     i32.ne
     global.set $core/serial/serial/Serial.isShiftClockInternal
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
      local.get $1
      call $core/memory/store/eightBitStoreIntoGBMemory
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
      local.get $1
      call $core/graphics/lcd/Lcd.updateLcdControl
      br $folding-inner1
     end
     local.get $0
     i32.const 65345
     i32.eq
     if
      i32.const 65345
      local.get $1
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
     local.get $0
     i32.const 65348
     i32.eq
     if
      i32.const 0
      global.set $core/graphics/graphics/Graphics.scanlineRegister
      local.get $0
      i32.const 0
      call $core/memory/store/eightBitStoreIntoGBMemory
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
      local.get $1
      call $core/memory/dma/startDmaTransfer
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
      i32.const 16384
      i32.ge_s
      if (result i32)
       local.get $2
       i32.const 32767
       i32.le_s
      else
       i32.const 0
      end
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
     local.get $0
     local.get $1
     call $core/graphics/palette/writeColorPaletteToMemory
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
     call $core/timers/timers/batchProcessTimers
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
         call $core/timers/timers/Timers.updateDividerRegister
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
     call $core/interrupts/interrupts/Interrupts.updateInterruptRequested
     br $folding-inner1
    end
    local.get $0
    i32.const 65535
    i32.eq
    if
     local.get $1
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
 (func $core/memory/store/eightBitStoreIntoGBMemoryWithTraps (; 146 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  global.get $core/debug/breakpoints/Breakpoints.writeGbMemory
  local.get $0
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
   local.get $1
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/memory/dma/hdmaTransfer (; 147 ;) (type $FUNCSIG$viii) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  loop $loop|0
   block $break|0
    local.get $3
    local.get $2
    i32.ge_s
    br_if $break|0
    local.get $0
    local.get $3
    i32.add
    call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
    local.set $5
    local.get $1
    local.get $3
    i32.add
    local.set $4
    loop $continue|1
     local.get $4
     i32.const 40959
     i32.le_s
     i32.eqz
     if
      local.get $4
      i32.const -8192
      i32.add
      local.set $4
      br $continue|1
     end
    end
    local.get $4
    local.get $5
    call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $loop|0
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
 (func $core/memory/dma/updateHblankHdma (; 148 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  global.get $core/memory/memory/Memory.isHblankHdmaActive
  i32.eqz
  if
   return
  end
  i32.const 16
  local.set $0
  global.get $core/memory/memory/Memory.hblankHdmaSource
  global.get $core/memory/memory/Memory.hblankHdmaDestination
  global.get $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  local.tee $1
  i32.const 16
  i32.lt_s
  if
   local.get $1
   local.set $0
  end
  local.get $0
  call $core/memory/dma/hdmaTransfer
  global.get $core/memory/memory/Memory.hblankHdmaSource
  local.get $0
  i32.add
  global.set $core/memory/memory/Memory.hblankHdmaSource
  global.get $core/memory/memory/Memory.hblankHdmaDestination
  local.get $0
  i32.add
  global.set $core/memory/memory/Memory.hblankHdmaDestination
  local.get $1
  local.get $0
  i32.sub
  local.tee $0
  global.set $core/memory/memory/Memory.hblankHdmaTransferLengthRemaining
  i32.const 65365
  local.set $1
  local.get $0
  i32.const 0
  i32.le_s
  if
   i32.const 0
   global.set $core/memory/memory/Memory.isHblankHdmaActive
   local.get $1
   i32.const 255
   call $core/memory/store/eightBitStoreIntoGBMemory
  else
   local.get $1
   local.get $0
   i32.const 4
   i32.shr_s
   i32.const 1
   i32.sub
   i32.const -129
   i32.and
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/graphics/lcd/checkCoincidence (; 149 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
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
    call $core/interrupts/interrupts/requestLcdInterrupt
   end
  else
   local.get $1
   i32.const -5
   i32.and
   local.set $1
  end
  local.get $1
 )
 (func $core/graphics/lcd/setLcdStatus (; 150 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  global.get $core/graphics/lcd/Lcd.enabled
  i32.eqz
  if
   return
  end
  global.get $core/graphics/lcd/Lcd.currentLcdMode
  global.get $core/graphics/graphics/Graphics.scanlineRegister
  local.tee $2
  i32.const 144
  i32.ge_s
  if (result i32)
   i32.const 1
  else
   i32.const 376
   global.get $core/cpu/cpu/Cpu.GBCDoubleSpeed
   i32.shl
   local.tee $1
   local.set $3
   global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
   local.tee $4
   local.get $1
   i32.ge_s
   if (result i32)
    i32.const 2
   else
    i32.const 3
    i32.const 0
    local.get $4
    local.get $3
    i32.ge_s
    select
   end
  end
  local.tee $1
  i32.ne
  if
   i32.const 65345
   call $core/memory/load/eightBitLoadFromGBMemory
   local.set $0
   local.get $1
   global.set $core/graphics/lcd/Lcd.currentLcdMode
   i32.const 0
   local.set $2
   block $break|0
    block $case3|0
     block $case2|0
      block $case1|0
       local.get $1
       if
        local.get $1
        i32.const 1
        i32.sub
        br_table $case1|0 $case2|0 $case3|0 $break|0
       end
       local.get $0
       i32.const -4
       i32.and
       local.tee $0
       i32.const 8
       i32.and
       i32.const 0
       i32.ne
       local.set $2
       br $break|0
      end
      local.get $0
      i32.const -3
      i32.and
      i32.const 1
      i32.or
      local.tee $0
      i32.const 16
      i32.and
      i32.const 0
      i32.ne
      local.set $2
      br $break|0
     end
     local.get $0
     i32.const -2
     i32.and
     i32.const 2
     i32.or
     local.tee $0
     i32.const 32
     i32.and
     i32.const 0
     i32.ne
     local.set $2
     br $break|0
    end
    local.get $0
    i32.const 3
    i32.or
    local.set $0
   end
   local.get $2
   if
    call $core/interrupts/interrupts/requestLcdInterrupt
   end
   local.get $1
   i32.eqz
   if
    call $core/memory/dma/updateHblankHdma
   end
   local.get $1
   i32.const 1
   i32.eq
   if
    i32.const 1
    global.set $core/interrupts/interrupts/Interrupts.isVBlankInterruptRequested
    i32.const 0
    call $core/interrupts/interrupts/_requestInterrupt
   end
   i32.const 65345
   local.get $1
   local.get $0
   call $core/graphics/lcd/checkCoincidence
   call $core/memory/store/eightBitStoreIntoGBMemory
  else
   local.get $2
   i32.const 153
   i32.eq
   if
    i32.const 65345
    local.get $1
    i32.const 65345
    call $core/memory/load/eightBitLoadFromGBMemory
    call $core/graphics/lcd/checkCoincidence
    call $core/memory/store/eightBitStoreIntoGBMemory
   end
  end
 )
 (func $core/graphics/graphics/updateGraphics (; 151 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  global.get $core/graphics/lcd/Lcd.enabled
  if
   global.get $core/graphics/graphics/Graphics.scanlineCycleCounter
   local.get $0
   i32.add
   global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
   global.get $core/config/Config.graphicsDisableScanlineRendering
   local.set $1
   loop $continue|0
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
     i32.const 153
     i32.eq
     select
     i32.sub
     global.set $core/graphics/graphics/Graphics.scanlineCycleCounter
     global.get $core/graphics/graphics/Graphics.scanlineRegister
     local.tee $0
     i32.const 144
     i32.eq
     if
      local.get $1
      if
       call $core/graphics/graphics/_renderEntireFrame
      else
       local.get $0
       call $core/graphics/graphics/_drawScanline
      end
      call $core/graphics/priority/clearPriorityMap
      i32.const -1
      global.set $core/graphics/tiles/TileCache.tileId
      i32.const -1
      global.set $core/graphics/tiles/TileCache.nextXIndexToPerformCacheCheck
     else
      local.get $0
      i32.const 144
      i32.lt_s
      if
       local.get $1
       i32.eqz
       if
        local.get $0
        call $core/graphics/graphics/_drawScanline
       end
      end
     end
     i32.const 0
     local.get $0
     i32.const 1
     i32.add
     local.get $0
     i32.const 153
     i32.gt_s
     select
     global.set $core/graphics/graphics/Graphics.scanlineRegister
     br $continue|0
    end
   end
  end
  call $core/graphics/lcd/setLcdStatus
 )
 (func $core/graphics/graphics/batchProcessGraphics (; 152 ;) (type $FUNCSIG$v)
  (local $0 i32)
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
  local.set $0
  loop $continue|0
   global.get $core/graphics/graphics/Graphics.currentCycles
   local.get $0
   i32.ge_s
   if
    local.get $0
    call $core/graphics/graphics/updateGraphics
    global.get $core/graphics/graphics/Graphics.currentCycles
    local.get $0
    i32.sub
    global.set $core/graphics/graphics/Graphics.currentCycles
    br $continue|0
   end
  end
 )
 (func $core/serial/serial/updateSerial (; 153 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $core/serial/serial/Serial.transferStartFlag
  i32.eqz
  if
   return
  end
  loop $continue|0
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
     i32.const 1
     local.get $2
     i32.shl
     local.get $1
     i32.and
     i32.eqz
    else
     i32.const 0
    end
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
      i32.const 65282
      call $core/memory/load/eightBitLoadFromGBMemory
      i32.const -129
      i32.and
      call $core/memory/store/eightBitStoreIntoGBMemory
      i32.const 0
      global.set $core/serial/serial/Serial.transferStartFlag
     else
      local.get $1
      global.set $core/serial/serial/Serial.numberOfBitsTransferred
     end
    end
    br $continue|0
   end
  end
 )
 (func $core/cycles/syncCycles (; 154 ;) (type $FUNCSIG$vi) (param $0 i32)
  global.get $core/memory/memory/Memory.DMACycles
  i32.const 0
  i32.gt_s
  if
   global.get $core/memory/memory/Memory.DMACycles
   local.get $0
   i32.add
   local.set $0
   i32.const 0
   global.set $core/memory/memory/Memory.DMACycles
  end
  global.get $core/cpu/cpu/Cpu.currentCycles
  local.get $0
  i32.add
  global.set $core/cpu/cpu/Cpu.currentCycles
  global.get $core/cpu/cpu/Cpu.isStopped
  i32.eqz
  if
   global.get $core/config/Config.graphicsBatchProcessing
   if
    global.get $core/graphics/graphics/Graphics.currentCycles
    local.get $0
    i32.add
    global.set $core/graphics/graphics/Graphics.currentCycles
    call $core/graphics/graphics/batchProcessGraphics
   else
    local.get $0
    call $core/graphics/graphics/updateGraphics
   end
   global.get $core/config/Config.audioBatchProcessing
   if
    global.get $core/sound/sound/Sound.currentCycles
    local.get $0
    i32.add
    global.set $core/sound/sound/Sound.currentCycles
    call $core/sound/sound/batchProcessAudio
   else
    local.get $0
    call $core/sound/sound/updateSound
   end
   local.get $0
   call $core/serial/serial/updateSerial
  end
  global.get $core/config/Config.timersBatchProcessing
  if
   global.get $core/timers/timers/Timers.currentCycles
   local.get $0
   i32.add
   global.set $core/timers/timers/Timers.currentCycles
   call $core/timers/timers/batchProcessTimers
  else
   local.get $0
   call $core/timers/timers/updateTimers
  end
  global.get $core/cycles/Cycles.cycles
  local.get $0
  i32.add
  local.tee $0
  global.get $core/cycles/Cycles.cyclesPerCycleSet
  i32.ge_s
  if
   global.get $core/cycles/Cycles.cycleSets
   i32.const 1
   i32.add
   global.set $core/cycles/Cycles.cycleSets
   local.get $0
   global.get $core/cycles/Cycles.cyclesPerCycleSet
   i32.sub
   local.set $0
  end
  local.get $0
  global.set $core/cycles/Cycles.cycles
 )
 (func $core/cpu/opcodes/getDataByteOne (; 155 ;) (type $FUNCSIG$i) (result i32)
  i32.const 4
  call $core/cycles/syncCycles
  global.get $core/cpu/cpu/Cpu.programCounter
  call $core/memory/load/eightBitLoadFromGBMemory
 )
 (func $core/cpu/opcodes/getConcatenatedDataByte (; 156 ;) (type $FUNCSIG$i) (result i32)
  (local $0 i32)
  i32.const 4
  call $core/cycles/syncCycles
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  call $core/memory/load/eightBitLoadFromGBMemory
  local.set $0
  call $core/cpu/opcodes/getDataByteOne
  i32.const 255
  i32.and
  local.get $0
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/cpu/opcodes/eightBitStoreSyncCycles (; 157 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  i32.const 4
  call $core/cycles/syncCycles
  local.get $0
  local.get $1
  call $core/memory/store/eightBitStoreIntoGBMemoryWithTraps
 )
 (func $core/cpu/flags/setFlagBit (; 158 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  i32.const 1
  local.get $0
  i32.shl
  i32.const 255
  i32.and
  local.set $0
  local.get $1
  i32.const 0
  i32.gt_s
  if
   global.get $core/cpu/cpu/Cpu.registerF
   local.get $0
   i32.or
   i32.const 255
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  else
   global.get $core/cpu/cpu/Cpu.registerF
   local.get $0
   i32.const 255
   i32.xor
   i32.and
   global.set $core/cpu/cpu/Cpu.registerF
  end
 )
 (func $core/cpu/flags/setHalfCarryFlag (; 159 ;) (type $FUNCSIG$vi) (param $0 i32)
  i32.const 5
  local.get $0
  call $core/cpu/flags/setFlagBit
 )
 (func $core/cpu/flags/checkAndSetEightBitHalfCarryFlag (; 160 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $1
  i32.const 0
  i32.ge_s
  if
   local.get $0
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
   call $core/cpu/flags/setHalfCarryFlag
  else
   local.get $1
   i32.const 31
   i32.shr_s
   local.tee $2
   local.get $1
   local.get $2
   i32.add
   i32.xor
   i32.const 15
   i32.and
   local.get $0
   i32.const 15
   i32.and
   i32.gt_u
   call $core/cpu/flags/setHalfCarryFlag
  end
 )
 (func $core/cpu/flags/setZeroFlag (; 161 ;) (type $FUNCSIG$vi) (param $0 i32)
  i32.const 7
  local.get $0
  call $core/cpu/flags/setFlagBit
 )
 (func $core/cpu/flags/setSubtractFlag (; 162 ;) (type $FUNCSIG$vi) (param $0 i32)
  i32.const 6
  local.get $0
  call $core/cpu/flags/setFlagBit
 )
 (func $core/cpu/flags/setCarryFlag (; 163 ;) (type $FUNCSIG$vi) (param $0 i32)
  i32.const 4
  local.get $0
  call $core/cpu/flags/setFlagBit
 )
 (func $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps (; 164 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  local.get $1
  i32.const 65280
  i32.and
  i32.const 8
  i32.shr_s
  local.set $2
  local.get $1
  i32.const 255
  i32.and
  local.tee $1
  local.set $3
  local.get $0
  local.get $1
  call $core/memory/writeTraps/checkWriteTraps
  if
   local.get $0
   local.get $3
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
  local.get $0
  i32.const 1
  i32.add
  local.tee $0
  local.get $2
  call $core/memory/writeTraps/checkWriteTraps
  if
   local.get $0
   local.get $2
   call $core/memory/store/eightBitStoreIntoGBMemory
  end
 )
 (func $core/cpu/opcodes/sixteenBitStoreSyncCycles (; 165 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  i32.const 8
  call $core/cycles/syncCycles
  local.get $0
  local.get $1
  call $core/memory/store/sixteenBitStoreIntoGBMemoryWithTraps
 )
 (func $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow (; 166 ;) (type $FUNCSIG$viii) (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $2
  if
   local.get $0
   i32.const 65535
   i32.and
   local.tee $0
   local.get $1
   i32.add
   local.get $0
   local.get $1
   i32.xor
   i32.xor
   local.tee $0
   i32.const 16
   i32.and
   i32.const 0
   i32.ne
   call $core/cpu/flags/setHalfCarryFlag
   local.get $0
   i32.const 256
   i32.and
   i32.const 0
   i32.ne
   call $core/cpu/flags/setCarryFlag
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
   call $core/cpu/flags/setCarryFlag
   local.get $0
   local.get $1
   i32.xor
   local.get $2
   i32.xor
   i32.const 4096
   i32.and
   i32.const 0
   i32.ne
   call $core/cpu/flags/setHalfCarryFlag
  end
 )
 (func $core/cpu/opcodes/eightBitLoadSyncCycles (; 167 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  i32.const 4
  call $core/cycles/syncCycles
  local.get $0
  call $core/memory/load/eightBitLoadFromGBMemoryWithTraps
 )
 (func $core/cpu/opcodes/handleOpcode0x (; 168 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  block $folding-inner6
   block $folding-inner5
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
                         if
                          local.get $0
                          i32.const 1
                          i32.eq
                          br_if $case1|0
                          block $tablify|0
                           local.get $0
                           i32.const 2
                           i32.sub
                           br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                          end
                          br $break|0
                         end
                         br $folding-inner5
                        end
                        call $core/cpu/opcodes/getConcatenatedDataByte
                        i32.const 65535
                        i32.and
                        local.tee $0
                        i32.const 65280
                        i32.and
                        i32.const 8
                        i32.shr_s
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
                       call $core/cpu/opcodes/eightBitStoreSyncCycles
                       br $folding-inner5
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
                      local.tee $0
                      i32.const 65280
                      i32.and
                      i32.const 8
                      i32.shr_s
                      global.set $core/cpu/cpu/Cpu.registerB
                      br $folding-inner6
                     end
                     global.get $core/cpu/cpu/Cpu.registerB
                     local.tee $0
                     i32.const 1
                     call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                     local.get $0
                     i32.const 1
                     i32.add
                     i32.const 255
                     i32.and
                     local.tee $0
                     global.set $core/cpu/cpu/Cpu.registerB
                     br $folding-inner1
                    end
                    global.get $core/cpu/cpu/Cpu.registerB
                    local.tee $0
                    i32.const -1
                    call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                    local.get $0
                    i32.const 1
                    i32.sub
                    i32.const 255
                    i32.and
                    local.tee $0
                    global.set $core/cpu/cpu/Cpu.registerB
                    br $folding-inner2
                   end
                   call $core/cpu/opcodes/getDataByteOne
                   i32.const 255
                   i32.and
                   global.set $core/cpu/cpu/Cpu.registerB
                   br $folding-inner3
                  end
                  global.get $core/cpu/cpu/Cpu.registerA
                  local.tee $0
                  i32.const 128
                  i32.and
                  i32.const 128
                  i32.eq
                  call $core/cpu/flags/setCarryFlag
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
                  br $folding-inner4
                 end
                 call $core/cpu/opcodes/getConcatenatedDataByte
                 i32.const 65535
                 i32.and
                 global.get $core/cpu/cpu/Cpu.stackPointer
                 call $core/cpu/opcodes/sixteenBitStoreSyncCycles
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
                i32.shr_s
                global.set $core/cpu/cpu/Cpu.registerH
                local.get $0
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerL
                i32.const 0
                call $core/cpu/flags/setSubtractFlag
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
               call $core/cpu/opcodes/eightBitLoadSyncCycles
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerA
               br $folding-inner5
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
              local.tee $0
              i32.const 65280
              i32.and
              i32.const 8
              i32.shr_s
              global.set $core/cpu/cpu/Cpu.registerB
              br $folding-inner6
             end
             global.get $core/cpu/cpu/Cpu.registerC
             local.tee $0
             i32.const 1
             call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
             local.get $0
             i32.const 1
             i32.add
             i32.const 255
             i32.and
             local.tee $0
             global.set $core/cpu/cpu/Cpu.registerC
             br $folding-inner1
            end
            global.get $core/cpu/cpu/Cpu.registerC
            local.tee $0
            i32.const -1
            call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
            local.get $0
            i32.const 1
            i32.sub
            i32.const 255
            i32.and
            local.tee $0
            global.set $core/cpu/cpu/Cpu.registerC
            br $folding-inner2
           end
           call $core/cpu/opcodes/getDataByteOne
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerC
           br $folding-inner3
          end
          global.get $core/cpu/cpu/Cpu.registerA
          local.tee $0
          i32.const 1
          i32.and
          i32.const 0
          i32.gt_u
          call $core/cpu/flags/setCarryFlag
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
          br $folding-inner4
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
        br $folding-inner5
       end
       local.get $0
       i32.eqz
       call $core/cpu/flags/setZeroFlag
       i32.const 0
       call $core/cpu/flags/setSubtractFlag
       br $folding-inner5
      end
      local.get $0
      i32.eqz
      call $core/cpu/flags/setZeroFlag
      i32.const 1
      call $core/cpu/flags/setSubtractFlag
      br $folding-inner5
     end
     global.get $core/cpu/cpu/Cpu.programCounter
     i32.const 1
     i32.add
     i32.const 65535
     i32.and
     global.set $core/cpu/cpu/Cpu.programCounter
     br $folding-inner5
    end
    i32.const 0
    call $core/cpu/flags/setZeroFlag
    i32.const 0
    call $core/cpu/flags/setSubtractFlag
    i32.const 0
    call $core/cpu/flags/setHalfCarryFlag
   end
   i32.const 4
   return
  end
  local.get $0
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerC
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcode1x (; 169 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                      local.get $0
                      i32.const 16
                      i32.ne
                      if
                       local.get $0
                       i32.const 17
                       i32.eq
                       br_if $case1|0
                       block $tablify|0
                        local.get $0
                        i32.const 18
                        i32.sub
                        br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                       end
                       br $break|0
                      end
                      global.get $core/cpu/cpu/Cpu.GBCEnabled
                      if
                       i32.const 65357
                       call $core/cpu/opcodes/eightBitLoadSyncCycles
                       i32.const 255
                       i32.and
                       local.tee $0
                       i32.const 1
                       i32.and
                       if
                        i32.const 65357
                        local.get $0
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
                        call $core/cpu/opcodes/eightBitStoreSyncCycles
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
                     i32.shr_s
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
                    call $core/cpu/opcodes/eightBitStoreSyncCycles
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
                   local.tee $0
                   i32.const 65280
                   i32.and
                   i32.const 8
                   i32.shr_s
                   global.set $core/cpu/cpu/Cpu.registerD
                   br $folding-inner3
                  end
                  global.get $core/cpu/cpu/Cpu.registerD
                  local.tee $0
                  i32.const 1
                  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                  local.get $0
                  i32.const 1
                  i32.add
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerD
                  global.get $core/cpu/cpu/Cpu.registerD
                  i32.eqz
                  call $core/cpu/flags/setZeroFlag
                  i32.const 0
                  call $core/cpu/flags/setSubtractFlag
                  br $folding-inner2
                 end
                 global.get $core/cpu/cpu/Cpu.registerD
                 local.tee $0
                 i32.const -1
                 call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                 local.get $0
                 i32.const 1
                 i32.sub
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerD
                 global.get $core/cpu/cpu/Cpu.registerD
                 i32.eqz
                 call $core/cpu/flags/setZeroFlag
                 i32.const 1
                 call $core/cpu/flags/setSubtractFlag
                 br $folding-inner2
                end
                call $core/cpu/opcodes/getDataByteOne
                i32.const 255
                i32.and
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
              call $core/cpu/opcodes/getDataByteOne
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
             i32.shr_s
             global.set $core/cpu/cpu/Cpu.registerH
             local.get $0
             i32.const 255
             i32.and
             global.set $core/cpu/cpu/Cpu.registerL
             i32.const 0
             call $core/cpu/flags/setSubtractFlag
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
            call $core/cpu/opcodes/eightBitLoadSyncCycles
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
           local.tee $0
           i32.const 65280
           i32.and
           i32.const 8
           i32.shr_s
           global.set $core/cpu/cpu/Cpu.registerD
           br $folding-inner3
          end
          global.get $core/cpu/cpu/Cpu.registerE
          local.tee $0
          i32.const 1
          call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
          local.get $0
          i32.const 1
          i32.add
          i32.const 255
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.registerE
          local.get $0
          i32.eqz
          call $core/cpu/flags/setZeroFlag
          i32.const 0
          call $core/cpu/flags/setSubtractFlag
          br $folding-inner2
         end
         global.get $core/cpu/cpu/Cpu.registerE
         local.tee $0
         i32.const -1
         call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
         local.get $0
         i32.const 1
         i32.sub
         i32.const 255
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.registerE
         local.get $0
         i32.eqz
         call $core/cpu/flags/setZeroFlag
         i32.const 1
         call $core/cpu/flags/setSubtractFlag
         br $folding-inner2
        end
        call $core/cpu/opcodes/getDataByteOne
        i32.const 255
        i32.and
        global.set $core/cpu/cpu/Cpu.registerE
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerA
       local.tee $1
       i32.const 1
       i32.and
       i32.const 1
       i32.eq
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
    call $core/cpu/flags/setCarryFlag
    i32.const 0
    call $core/cpu/flags/setZeroFlag
    i32.const 0
    call $core/cpu/flags/setSubtractFlag
    i32.const 0
    call $core/cpu/flags/setHalfCarryFlag
   end
   i32.const 4
   return
  end
  local.get $0
  i32.const 255
  i32.and
  global.set $core/cpu/cpu/Cpu.registerE
  i32.const 8
 )
 (func $core/cpu/opcodes/handleOpcode2x (; 170 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  block $folding-inner5
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
                        i32.const 32
                        i32.ne
                        if
                         local.get $0
                         i32.const 33
                         i32.eq
                         br_if $case1|0
                         block $tablify|0
                          local.get $0
                          i32.const 34
                          i32.sub
                          br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                         end
                         br $break|0
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
                         call $core/cpu/opcodes/getDataByteOne
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
                       i32.shr_s
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
                       br $folding-inner5
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
                      global.get $core/cpu/cpu/Cpu.registerA
                      call $core/cpu/opcodes/eightBitStoreSyncCycles
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
                     local.tee $0
                     i32.const 65280
                     i32.and
                     i32.const 8
                     i32.shr_s
                     global.set $core/cpu/cpu/Cpu.registerH
                     br $folding-inner0
                    end
                    global.get $core/cpu/cpu/Cpu.registerH
                    local.tee $0
                    i32.const 1
                    call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                    local.get $0
                    i32.const 1
                    i32.add
                    i32.const 255
                    i32.and
                    local.tee $0
                    global.set $core/cpu/cpu/Cpu.registerH
                    br $folding-inner2
                   end
                   global.get $core/cpu/cpu/Cpu.registerH
                   local.tee $0
                   i32.const -1
                   call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                   local.get $0
                   i32.const 1
                   i32.sub
                   i32.const 255
                   i32.and
                   local.tee $0
                   global.set $core/cpu/cpu/Cpu.registerH
                   br $folding-inner3
                  end
                  call $core/cpu/opcodes/getDataByteOne
                  i32.const 255
                  i32.and
                  global.set $core/cpu/cpu/Cpu.registerH
                  br $folding-inner4
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
                 local.set $0
                 global.get $core/cpu/cpu/Cpu.registerA
                 local.set $1
                 local.get $2
                 i32.const 6
                 i32.shr_u
                 i32.const 1
                 i32.and
                 i32.const 0
                 i32.gt_u
                 if (result i32)
                  local.get $1
                  local.get $0
                  i32.sub
                  i32.const 255
                  i32.and
                 else
                  local.get $1
                  local.get $0
                  i32.const 6
                  i32.or
                  local.get $0
                  local.get $1
                  i32.const 15
                  i32.and
                  i32.const 9
                  i32.gt_u
                  select
                  local.tee $0
                  i32.const 96
                  i32.or
                  local.get $0
                  local.get $1
                  i32.const 153
                  i32.gt_u
                  select
                  local.tee $0
                  i32.add
                  i32.const 255
                  i32.and
                 end
                 local.tee $1
                 i32.eqz
                 call $core/cpu/flags/setZeroFlag
                 local.get $0
                 i32.const 96
                 i32.and
                 i32.const 0
                 i32.ne
                 call $core/cpu/flags/setCarryFlag
                 i32.const 0
                 call $core/cpu/flags/setHalfCarryFlag
                 local.get $1
                 global.set $core/cpu/cpu/Cpu.registerA
                 br $folding-inner5
                end
                global.get $core/cpu/cpu/Cpu.registerF
                i32.const 7
                i32.shr_u
                i32.const 1
                i32.and
                i32.const 0
                i32.gt_u
                if
                 call $core/cpu/opcodes/getDataByteOne
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
               i32.const 65535
               i32.and
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
               i32.shr_s
               global.set $core/cpu/cpu/Cpu.registerH
               local.get $0
               i32.const 255
               i32.and
               global.set $core/cpu/cpu/Cpu.registerL
               i32.const 0
               call $core/cpu/flags/setSubtractFlag
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
              call $core/cpu/opcodes/eightBitLoadSyncCycles
              i32.const 255
              i32.and
              global.set $core/cpu/cpu/Cpu.registerA
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
             local.tee $0
             i32.const 65280
             i32.and
             i32.const 8
             i32.shr_s
             global.set $core/cpu/cpu/Cpu.registerH
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerL
            local.tee $0
            i32.const 1
            call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
            local.get $0
            i32.const 1
            i32.add
            i32.const 255
            i32.and
            local.tee $0
            global.set $core/cpu/cpu/Cpu.registerL
            br $folding-inner2
           end
           global.get $core/cpu/cpu/Cpu.registerL
           local.tee $0
           i32.const -1
           call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
           local.get $0
           i32.const 1
           i32.sub
           i32.const 255
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.registerL
           br $folding-inner3
          end
          call $core/cpu/opcodes/getDataByteOne
          i32.const 255
          i32.and
          global.set $core/cpu/cpu/Cpu.registerL
          br $folding-inner4
         end
         global.get $core/cpu/cpu/Cpu.registerA
         i32.const -1
         i32.xor
         i32.const 255
         i32.and
         global.set $core/cpu/cpu/Cpu.registerA
         i32.const 1
         call $core/cpu/flags/setSubtractFlag
         i32.const 1
         call $core/cpu/flags/setHalfCarryFlag
         br $folding-inner5
        end
        i32.const -1
        return
       end
       local.get $0
       i32.const 255
       i32.and
       global.set $core/cpu/cpu/Cpu.registerL
       i32.const 8
       return
      end
      local.get $0
      i32.const 1
      i32.add
      i32.const 65535
      i32.and
      local.tee $0
      i32.const 65280
      i32.and
      i32.const 8
      i32.shr_s
      global.set $core/cpu/cpu/Cpu.registerH
      local.get $0
      i32.const 255
      i32.and
      global.set $core/cpu/cpu/Cpu.registerL
      br $folding-inner5
     end
     local.get $0
     i32.eqz
     call $core/cpu/flags/setZeroFlag
     i32.const 0
     call $core/cpu/flags/setSubtractFlag
     br $folding-inner5
    end
    local.get $0
    i32.eqz
    call $core/cpu/flags/setZeroFlag
    i32.const 1
    call $core/cpu/flags/setSubtractFlag
    br $folding-inner5
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
 (func $core/cpu/opcodes/handleOpcode3x (; 171 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
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
                     i32.const 48
                     i32.ne
                     if
                      local.get $0
                      i32.const 49
                      i32.eq
                      br_if $case1|0
                      block $tablify|0
                       local.get $0
                       i32.const 50
                       i32.sub
                       br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                      end
                      br $break|0
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
                      call $core/cpu/opcodes/getDataByteOne
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
                    br $folding-inner2
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
                   global.get $core/cpu/cpu/Cpu.registerA
                   call $core/cpu/opcodes/eightBitStoreSyncCycles
                   br $folding-inner0
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
                 local.tee $0
                 call $core/cpu/opcodes/eightBitLoadSyncCycles
                 local.tee $1
                 i32.const 1
                 call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                 local.get $1
                 i32.const 1
                 i32.add
                 i32.const 255
                 i32.and
                 local.tee $1
                 i32.eqz
                 call $core/cpu/flags/setZeroFlag
                 i32.const 0
                 call $core/cpu/flags/setSubtractFlag
                 local.get $0
                 local.get $1
                 call $core/cpu/opcodes/eightBitStoreSyncCycles
                 br $folding-inner2
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
                call $core/cpu/opcodes/eightBitLoadSyncCycles
                local.tee $1
                i32.const -1
                call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
                local.get $1
                i32.const 1
                i32.sub
                i32.const 255
                i32.and
                local.tee $1
                i32.eqz
                call $core/cpu/flags/setZeroFlag
                i32.const 1
                call $core/cpu/flags/setSubtractFlag
                local.get $0
                local.get $1
                call $core/cpu/opcodes/eightBitStoreSyncCycles
                br $folding-inner2
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
               call $core/cpu/opcodes/getDataByteOne
               i32.const 255
               i32.and
               call $core/cpu/opcodes/eightBitStoreSyncCycles
               br $folding-inner1
              end
              i32.const 0
              call $core/cpu/flags/setSubtractFlag
              i32.const 0
              call $core/cpu/flags/setHalfCarryFlag
              i32.const 1
              call $core/cpu/flags/setCarryFlag
              br $folding-inner2
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 4
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 1
             i32.eq
             if
              call $core/cpu/opcodes/getDataByteOne
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
            global.get $core/cpu/cpu/Cpu.stackPointer
            local.get $0
            i32.add
            i32.const 65535
            i32.and
            local.tee $0
            i32.const 65280
            i32.and
            i32.const 8
            i32.shr_s
            global.set $core/cpu/cpu/Cpu.registerH
            local.get $0
            i32.const 255
            i32.and
            global.set $core/cpu/cpu/Cpu.registerL
            i32.const 0
            call $core/cpu/flags/setSubtractFlag
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
           call $core/cpu/opcodes/eightBitLoadSyncCycles
           i32.const 255
           i32.and
           global.set $core/cpu/cpu/Cpu.registerA
           br $folding-inner0
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
         i32.const 1
         call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
         local.get $0
         i32.const 1
         i32.add
         i32.const 255
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.registerA
         local.get $0
         i32.eqz
         call $core/cpu/flags/setZeroFlag
         i32.const 0
         call $core/cpu/flags/setSubtractFlag
         br $folding-inner2
        end
        global.get $core/cpu/cpu/Cpu.registerA
        local.tee $0
        i32.const -1
        call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
        local.get $0
        i32.const 1
        i32.sub
        i32.const 255
        i32.and
        local.tee $0
        global.set $core/cpu/cpu/Cpu.registerA
        local.get $0
        i32.eqz
        call $core/cpu/flags/setZeroFlag
        i32.const 1
        call $core/cpu/flags/setSubtractFlag
        br $folding-inner2
       end
       call $core/cpu/opcodes/getDataByteOne
       i32.const 255
       i32.and
       global.set $core/cpu/cpu/Cpu.registerA
       br $folding-inner1
      end
      i32.const 0
      call $core/cpu/flags/setSubtractFlag
      i32.const 0
      call $core/cpu/flags/setHalfCarryFlag
      global.get $core/cpu/cpu/Cpu.registerF
      i32.const 4
      i32.shr_u
      i32.const 1
      i32.and
      i32.const 0
      i32.le_u
      call $core/cpu/flags/setCarryFlag
      br $folding-inner2
     end
     i32.const -1
     return
    end
    local.get $0
    i32.const 1
    i32.sub
    i32.const 65535
    i32.and
    local.tee $0
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_s
    global.set $core/cpu/cpu/Cpu.registerH
    local.get $0
    i32.const 255
    i32.and
    global.set $core/cpu/cpu/Cpu.registerL
    br $folding-inner2
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
 (func $core/cpu/opcodes/handleOpcode4x (; 172 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                  i32.const 64
                  i32.ne
                  if
                   local.get $0
                   i32.const 65
                   i32.eq
                   br_if $case1|0
                   block $tablify|0
                    local.get $0
                    i32.const 66
                    i32.sub
                    br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $folding-inner0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                   end
                   br $break|0
                  end
                  br $folding-inner0
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
            call $core/cpu/opcodes/eightBitLoadSyncCycles
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
     call $core/cpu/opcodes/eightBitLoadSyncCycles
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
 (func $core/cpu/opcodes/handleOpcode5x (; 173 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                 local.get $0
                 i32.const 80
                 i32.ne
                 if
                  local.get $0
                  i32.const 81
                  i32.eq
                  br_if $case1|0
                  block $tablify|0
                   local.get $0
                   i32.const 82
                   i32.sub
                   br_table $folding-inner0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $folding-inner0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                  end
                  br $break|0
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
            call $core/cpu/opcodes/eightBitLoadSyncCycles
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
     call $core/cpu/opcodes/eightBitLoadSyncCycles
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
 (func $core/cpu/opcodes/handleOpcode6x (; 174 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                 local.get $0
                 i32.const 96
                 i32.ne
                 if
                  local.get $0
                  i32.const 97
                  i32.eq
                  br_if $case1|0
                  block $tablify|0
                   local.get $0
                   i32.const 98
                   i32.sub
                   br_table $case2|0 $case3|0 $folding-inner0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $folding-inner0 $case14|0 $case15|0 $tablify|0
                  end
                  br $break|0
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
            call $core/cpu/opcodes/eightBitLoadSyncCycles
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
     call $core/cpu/opcodes/eightBitLoadSyncCycles
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
 (func $core/cpu/opcodes/handleOpcode7x (; 175 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                  local.get $0
                  i32.const 112
                  i32.ne
                  if
                   local.get $0
                   i32.const 113
                   i32.eq
                   br_if $case1|0
                   block $tablify|0
                    local.get $0
                    i32.const 114
                    i32.sub
                    br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $folding-inner0 $tablify|0
                   end
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
                  global.get $core/cpu/cpu/Cpu.registerB
                  call $core/cpu/opcodes/eightBitStoreSyncCycles
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
                 call $core/cpu/opcodes/eightBitStoreSyncCycles
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
                call $core/cpu/opcodes/eightBitStoreSyncCycles
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
               call $core/cpu/opcodes/eightBitStoreSyncCycles
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
              global.get $core/cpu/cpu/Cpu.registerH
              call $core/cpu/opcodes/eightBitStoreSyncCycles
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
             global.get $core/cpu/cpu/Cpu.registerL
             call $core/cpu/opcodes/eightBitStoreSyncCycles
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
           call $core/cpu/opcodes/eightBitStoreSyncCycles
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
    call $core/cpu/opcodes/eightBitLoadSyncCycles
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
 (func $core/cpu/flags/checkAndSetEightBitCarryFlag (; 176 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $1
  i32.const 0
  i32.ge_s
  if
   local.get $0
   i32.const 255
   i32.and
   local.get $0
   local.get $1
   i32.add
   i32.const 255
   i32.and
   i32.gt_u
   call $core/cpu/flags/setCarryFlag
  else
   local.get $1
   i32.const 31
   i32.shr_s
   local.tee $2
   local.get $1
   local.get $2
   i32.add
   i32.xor
   local.get $0
   i32.const 255
   i32.and
   i32.gt_s
   call $core/cpu/flags/setCarryFlag
  end
 )
 (func $core/cpu/instructions/addARegister (; 177 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $1
  local.get $0
  i32.const 255
  i32.and
  local.tee $2
  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
  local.get $1
  local.get $2
  call $core/cpu/flags/checkAndSetEightBitCarryFlag
  local.get $0
  local.get $1
  i32.add
  i32.const 255
  i32.and
  local.tee $0
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/instructions/addAThroughCarryRegister (; 178 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $1
  local.get $0
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
  call $core/cpu/flags/setHalfCarryFlag
  local.get $0
  i32.const 255
  i32.and
  local.get $1
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
  call $core/cpu/flags/setCarryFlag
  local.get $2
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $2
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/opcodes/handleOpcode8x (; 179 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                   i32.const 128
                   i32.ne
                   if
                    local.get $0
                    i32.const 129
                    i32.eq
                    br_if $case1|0
                    block $tablify|0
                     local.get $0
                     i32.const 130
                     i32.sub
                     br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                    end
                    br $break|0
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
             call $core/cpu/opcodes/eightBitLoadSyncCycles
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
     call $core/cpu/opcodes/eightBitLoadSyncCycles
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
 (func $core/cpu/instructions/subARegister (; 180 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $1
  local.get $0
  i32.const 255
  i32.and
  i32.const -1
  i32.mul
  local.tee $2
  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
  local.get $1
  local.get $2
  call $core/cpu/flags/checkAndSetEightBitCarryFlag
  local.get $1
  local.get $0
  i32.sub
  i32.const 255
  i32.and
  local.tee $0
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 1
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/instructions/subAThroughCarryRegister (; 181 ;) (type $FUNCSIG$vi) (param $0 i32)
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
  call $core/cpu/flags/setHalfCarryFlag
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
  call $core/cpu/flags/setCarryFlag
  local.get $2
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $2
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 1
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/opcodes/handleOpcode9x (; 182 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                   i32.const 144
                   i32.ne
                   if
                    local.get $0
                    i32.const 145
                    i32.eq
                    br_if $case1|0
                    block $tablify|0
                     local.get $0
                     i32.const 146
                     i32.sub
                     br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                    end
                    br $break|0
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
             call $core/cpu/opcodes/eightBitLoadSyncCycles
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
     call $core/cpu/opcodes/eightBitLoadSyncCycles
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
 (func $core/cpu/instructions/andARegister (; 183 ;) (type $FUNCSIG$vi) (param $0 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.and
  local.tee $0
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 1
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
 )
 (func $core/cpu/instructions/xorARegister (; 184 ;) (type $FUNCSIG$vi) (param $0 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.xor
  i32.const 255
  i32.and
  local.tee $0
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
 )
 (func $core/cpu/opcodes/handleOpcodeAx (; 185 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                   i32.const 160
                   i32.ne
                   if
                    local.get $0
                    i32.const 161
                    i32.eq
                    br_if $case1|0
                    block $tablify|0
                     local.get $0
                     i32.const 162
                     i32.sub
                     br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                    end
                    br $break|0
                   end
                   global.get $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/andARegister
                   br $folding-inner0
                  end
                  global.get $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/andARegister
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/andARegister
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/andARegister
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/andARegister
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/andARegister
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
             call $core/cpu/opcodes/eightBitLoadSyncCycles
             call $core/cpu/instructions/andARegister
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/andARegister
            br $folding-inner0
           end
           global.get $core/cpu/cpu/Cpu.registerB
           call $core/cpu/instructions/xorARegister
           br $folding-inner0
          end
          global.get $core/cpu/cpu/Cpu.registerC
          call $core/cpu/instructions/xorARegister
          br $folding-inner0
         end
         global.get $core/cpu/cpu/Cpu.registerD
         call $core/cpu/instructions/xorARegister
         br $folding-inner0
        end
        global.get $core/cpu/cpu/Cpu.registerE
        call $core/cpu/instructions/xorARegister
        br $folding-inner0
       end
       global.get $core/cpu/cpu/Cpu.registerH
       call $core/cpu/instructions/xorARegister
       br $folding-inner0
      end
      global.get $core/cpu/cpu/Cpu.registerL
      call $core/cpu/instructions/xorARegister
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
     call $core/cpu/opcodes/eightBitLoadSyncCycles
     call $core/cpu/instructions/xorARegister
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.registerA
    call $core/cpu/instructions/xorARegister
    br $folding-inner0
   end
   i32.const -1
   return
  end
  i32.const 4
 )
 (func $core/cpu/instructions/orARegister (; 186 ;) (type $FUNCSIG$vi) (param $0 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.or
  i32.const 255
  i32.and
  local.tee $0
  global.set $core/cpu/cpu/Cpu.registerA
  local.get $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
 )
 (func $core/cpu/instructions/cpARegister (; 187 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  global.get $core/cpu/cpu/Cpu.registerA
  local.tee $1
  local.get $0
  i32.const 255
  i32.and
  i32.const -1
  i32.mul
  local.tee $0
  call $core/cpu/flags/checkAndSetEightBitHalfCarryFlag
  local.get $1
  local.get $0
  call $core/cpu/flags/checkAndSetEightBitCarryFlag
  local.get $0
  local.get $1
  i32.add
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 1
  call $core/cpu/flags/setSubtractFlag
 )
 (func $core/cpu/opcodes/handleOpcodeBx (; 188 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                   i32.const 176
                   i32.ne
                   if
                    local.get $0
                    i32.const 177
                    i32.eq
                    br_if $case1|0
                    block $tablify|0
                     local.get $0
                     i32.const 178
                     i32.sub
                     br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0 $tablify|0
                    end
                    br $break|0
                   end
                   global.get $core/cpu/cpu/Cpu.registerB
                   call $core/cpu/instructions/orARegister
                   br $folding-inner0
                  end
                  global.get $core/cpu/cpu/Cpu.registerC
                  call $core/cpu/instructions/orARegister
                  br $folding-inner0
                 end
                 global.get $core/cpu/cpu/Cpu.registerD
                 call $core/cpu/instructions/orARegister
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.registerE
                call $core/cpu/instructions/orARegister
                br $folding-inner0
               end
               global.get $core/cpu/cpu/Cpu.registerH
               call $core/cpu/instructions/orARegister
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.registerL
              call $core/cpu/instructions/orARegister
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
             call $core/cpu/opcodes/eightBitLoadSyncCycles
             call $core/cpu/instructions/orARegister
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.registerA
            call $core/cpu/instructions/orARegister
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
     call $core/cpu/opcodes/eightBitLoadSyncCycles
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
 (func $core/memory/load/sixteenBitLoadFromGBMemory (; 189 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  call $core/memory/readTraps/checkReadTraps
  local.tee $1
  i32.const -1
  i32.eq
  if (result i32)
   local.get $0
   call $core/memory/load/eightBitLoadFromGBMemory
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
   call $core/memory/load/eightBitLoadFromGBMemory
  else
   local.get $0
  end
  i32.const 255
  i32.and
  i32.const 8
  i32.shl
  i32.or
 )
 (func $core/cpu/opcodes/sixteenBitLoadSyncCycles (; 190 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  i32.const 8
  call $core/cycles/syncCycles
  local.get $0
  call $core/memory/load/sixteenBitLoadFromGBMemory
 )
 (func $core/cpu/instructions/rotateRegisterLeft (; 191 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  call $core/cpu/flags/setCarryFlag
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
  local.tee $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  local.get $0
 )
 (func $core/cpu/instructions/rotateRegisterRight (; 192 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  i32.const 1
  i32.and
  i32.const 0
  i32.gt_u
  call $core/cpu/flags/setCarryFlag
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
  local.tee $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  local.get $0
 )
 (func $core/cpu/instructions/rotateRegisterLeftThroughCarry (; 193 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  local.get $0
  i32.const 1
  i32.shl
  i32.or
  i32.const 255
  i32.and
  local.set $1
  local.get $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  call $core/cpu/flags/setCarryFlag
  local.get $1
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  local.get $1
 )
 (func $core/cpu/instructions/rotateRegisterRightThroughCarry (; 194 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 4
  i32.shr_u
  i32.const 1
  i32.and
  i32.const 7
  i32.shl
  local.get $0
  i32.const 255
  i32.and
  i32.const 1
  i32.shr_u
  i32.or
  local.set $1
  local.get $0
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  call $core/cpu/flags/setCarryFlag
  local.get $1
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  local.get $1
 )
 (func $core/cpu/instructions/shiftLeftRegister (; 195 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  call $core/cpu/flags/setCarryFlag
  local.get $0
  i32.const 1
  i32.shl
  i32.const 255
  i32.and
  local.tee $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  local.get $0
 )
 (func $core/cpu/instructions/shiftRightArithmeticRegister (; 196 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  i32.const 255
  i32.and
  i32.const 1
  i32.shr_u
  local.tee $1
  i32.const 128
  i32.or
  local.get $1
  local.get $0
  i32.const 128
  i32.and
  i32.const 128
  i32.eq
  select
  local.tee $1
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  local.get $0
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  call $core/cpu/flags/setCarryFlag
  local.get $1
 )
 (func $core/cpu/instructions/swapNibblesOnRegister (; 197 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  local.get $0
  i32.const 15
  i32.and
  i32.const 4
  i32.shl
  local.get $0
  i32.const 240
  i32.and
  i32.const 4
  i32.shr_u
  i32.or
  local.tee $0
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  i32.const 0
  call $core/cpu/flags/setCarryFlag
  local.get $0
 )
 (func $core/cpu/instructions/shiftRightLogicalRegister (; 198 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  i32.const 255
  i32.and
  i32.const 1
  i32.shr_u
  local.tee $1
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 0
  call $core/cpu/flags/setHalfCarryFlag
  local.get $0
  i32.const 1
  i32.and
  i32.const 1
  i32.eq
  call $core/cpu/flags/setCarryFlag
  local.get $1
 )
 (func $core/cpu/instructions/testBitOnRegister (; 199 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  i32.const 1
  local.get $0
  i32.shl
  local.get $1
  i32.and
  i32.const 255
  i32.and
  i32.eqz
  call $core/cpu/flags/setZeroFlag
  i32.const 0
  call $core/cpu/flags/setSubtractFlag
  i32.const 1
  call $core/cpu/flags/setHalfCarryFlag
  local.get $1
 )
 (func $core/cpu/cbOpcodes/handleCbOpcode (; 200 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
          local.get $0
          i32.const 7
          i32.and
          local.tee $4
          if
           local.get $4
           i32.const 1
           i32.eq
           br_if $case1|0
           block $tablify|0
            local.get $4
            i32.const 2
            i32.sub
            br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
           end
           br $break|0
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
    call $core/cpu/opcodes/eightBitLoadSyncCycles
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
                  local.get $0
                  i32.const 240
                  i32.and
                  i32.const 4
                  i32.shr_s
                  local.tee $5
                  if
                   local.get $5
                   i32.const 1
                   i32.eq
                   br_if $case1|1
                   block $tablify|00
                    local.get $5
                    i32.const 2
                    i32.sub
                    br_table $case2|1 $case3|1 $case4|1 $case5|1 $case6|1 $case7|1 $case8|1 $case9|1 $case10|1 $case11|1 $case12|1 $case13|1 $case14|1 $case15|1 $tablify|00
                   end
                   br $break|1
                  end
                  local.get $0
                  i32.const 7
                  i32.le_s
                  if (result i32)
                   local.get $1
                   call $core/cpu/instructions/rotateRegisterLeft
                   local.set $2
                   i32.const 1
                  else
                   local.get $0
                   i32.const 15
                   i32.le_s
                   if (result i32)
                    local.get $1
                    call $core/cpu/instructions/rotateRegisterRight
                    local.set $2
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
                  local.get $1
                  call $core/cpu/instructions/rotateRegisterLeftThroughCarry
                  local.set $2
                  i32.const 1
                 else
                  local.get $0
                  i32.const 31
                  i32.le_s
                  if (result i32)
                   local.get $1
                   call $core/cpu/instructions/rotateRegisterRightThroughCarry
                   local.set $2
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
                 call $core/cpu/instructions/shiftLeftRegister
                 local.set $2
                 i32.const 1
                else
                 local.get $0
                 i32.const 47
                 i32.le_s
                 if (result i32)
                  local.get $1
                  call $core/cpu/instructions/shiftRightArithmeticRegister
                  local.set $2
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
                call $core/cpu/instructions/swapNibblesOnRegister
                local.set $2
                i32.const 1
               else
                local.get $0
                i32.const 63
                i32.le_s
                if (result i32)
                 local.get $1
                 call $core/cpu/instructions/shiftRightLogicalRegister
                 local.set $2
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
               i32.const 0
               local.get $1
               call $core/cpu/instructions/testBitOnRegister
               local.set $2
               i32.const 1
              else
               local.get $0
               i32.const 79
               i32.le_s
               if (result i32)
                i32.const 1
                local.get $1
                call $core/cpu/instructions/testBitOnRegister
                local.set $2
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
              i32.const 2
              local.get $1
              call $core/cpu/instructions/testBitOnRegister
              local.set $2
              i32.const 1
             else
              local.get $0
              i32.const 95
              i32.le_s
              if (result i32)
               i32.const 3
               local.get $1
               call $core/cpu/instructions/testBitOnRegister
               local.set $2
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
             i32.const 4
             local.get $1
             call $core/cpu/instructions/testBitOnRegister
             local.set $2
             i32.const 1
            else
             local.get $0
             i32.const 111
             i32.le_s
             if (result i32)
              i32.const 5
              local.get $1
              call $core/cpu/instructions/testBitOnRegister
              local.set $2
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
            i32.const 6
            local.get $1
            call $core/cpu/instructions/testBitOnRegister
            local.set $2
            i32.const 1
           else
            local.get $0
            i32.const 127
            i32.le_s
            if (result i32)
             i32.const 7
             local.get $1
             call $core/cpu/instructions/testBitOnRegister
             local.set $2
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
           local.get $1
           i32.const -2
           i32.and
           local.set $2
           i32.const 1
          else
           local.get $0
           i32.const 143
           i32.le_s
           if (result i32)
            local.get $1
            i32.const -3
            i32.and
            local.set $2
            i32.const 1
           else
            i32.const 0
           end
          end
          local.set $3
          br $break|1
         end
         local.get $0
         i32.const 151
         i32.le_s
         if (result i32)
          local.get $1
          i32.const -5
          i32.and
          local.set $2
          i32.const 1
         else
          local.get $0
          i32.const 159
          i32.le_s
          if (result i32)
           local.get $1
           i32.const -9
           i32.and
           local.set $2
           i32.const 1
          else
           i32.const 0
          end
         end
         local.set $3
         br $break|1
        end
        local.get $0
        i32.const 167
        i32.le_s
        if (result i32)
         local.get $1
         i32.const -17
         i32.and
         local.set $2
         i32.const 1
        else
         local.get $0
         i32.const 175
         i32.le_s
         if (result i32)
          local.get $1
          i32.const -33
          i32.and
          local.set $2
          i32.const 1
         else
          i32.const 0
         end
        end
        local.set $3
        br $break|1
       end
       local.get $0
       i32.const 183
       i32.le_s
       if (result i32)
        local.get $1
        i32.const -65
        i32.and
        local.set $2
        i32.const 1
       else
        local.get $0
        i32.const 191
        i32.le_s
        if (result i32)
         local.get $1
         i32.const -129
         i32.and
         local.set $2
         i32.const 1
        else
         i32.const 0
        end
       end
       local.set $3
       br $break|1
      end
      local.get $0
      i32.const 199
      i32.le_s
      if (result i32)
       local.get $1
       i32.const 1
       i32.or
       local.set $2
       i32.const 1
      else
       local.get $0
       i32.const 207
       i32.le_s
       if (result i32)
        local.get $1
        i32.const 2
        i32.or
        local.set $2
        i32.const 1
       else
        i32.const 0
       end
      end
      local.set $3
      br $break|1
     end
     local.get $0
     i32.const 215
     i32.le_s
     if (result i32)
      local.get $1
      i32.const 4
      i32.or
      local.set $2
      i32.const 1
     else
      local.get $0
      i32.const 223
      i32.le_s
      if (result i32)
       local.get $1
       i32.const 8
       i32.or
       local.set $2
       i32.const 1
      else
       i32.const 0
      end
     end
     local.set $3
     br $break|1
    end
    local.get $0
    i32.const 231
    i32.le_s
    if (result i32)
     local.get $1
     i32.const 16
     i32.or
     local.set $2
     i32.const 1
    else
     local.get $0
     i32.const 239
     i32.le_s
     if (result i32)
      local.get $1
      i32.const 32
      i32.or
      local.set $2
      i32.const 1
     else
      i32.const 0
     end
    end
    local.set $3
    br $break|1
   end
   local.get $0
   i32.const 247
   i32.le_s
   if (result i32)
    local.get $1
    i32.const 64
    i32.or
    local.set $2
    i32.const 1
   else
    local.get $0
    i32.const 255
    i32.le_s
    if (result i32)
     local.get $1
     i32.const 128
     i32.or
     local.set $2
     i32.const 1
    else
     i32.const 0
    end
   end
   local.set $3
  end
  block $break|2
   block $case7|2
    block $case6|2
     block $case5|2
      block $case4|2
       block $case3|2
        block $case2|2
         block $case1|2
          local.get $4
          if
           local.get $4
           i32.const 1
           i32.eq
           br_if $case1|2
           block $tablify|01
            local.get $4
            i32.const 2
            i32.sub
            br_table $case2|2 $case3|2 $case4|2 $case5|2 $case6|2 $case7|2 $tablify|01
           end
           br $break|2
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
    local.get $5
    i32.const 7
    i32.gt_s
    local.get $5
    i32.const 4
    i32.lt_s
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
     local.get $2
     call $core/cpu/opcodes/eightBitStoreSyncCycles
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
 (func $core/cpu/opcodes/handleOpcodeCx (; 201 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                      local.get $0
                      i32.const 192
                      i32.ne
                      if
                       local.get $0
                       i32.const 193
                       i32.eq
                       br_if $case1|0
                       block $tablify|0
                        local.get $0
                        i32.const 194
                        i32.sub
                        br_table $case2|0 $folding-inner2 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $folding-inner1 $case14|0 $case15|0 $tablify|0
                       end
                       br $break|0
                      end
                      global.get $core/cpu/cpu/Cpu.registerF
                      i32.const 7
                      i32.shr_u
                      i32.const 1
                      i32.and
                      br_if $folding-inner3
                      br $folding-inner0
                     end
                     global.get $core/cpu/cpu/Cpu.stackPointer
                     call $core/cpu/opcodes/sixteenBitLoadSyncCycles
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
                     i32.shr_s
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
                    br_if $folding-inner5
                    br $folding-inner2
                   end
                   global.get $core/cpu/cpu/Cpu.registerF
                   i32.const 7
                   i32.shr_u
                   i32.const 1
                   i32.and
                   br_if $folding-inner5
                   br $folding-inner1
                  end
                  global.get $core/cpu/cpu/Cpu.stackPointer
                  i32.const 2
                  i32.sub
                  i32.const 65535
                  i32.and
                  local.tee $0
                  global.set $core/cpu/cpu/Cpu.stackPointer
                  local.get $0
                  global.get $core/cpu/cpu/Cpu.registerC
                  i32.const 255
                  i32.and
                  global.get $core/cpu/cpu/Cpu.registerB
                  i32.const 255
                  i32.and
                  i32.const 8
                  i32.shl
                  i32.or
                  call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                  br $folding-inner3
                 end
                 call $core/cpu/opcodes/getDataByteOne
                 call $core/cpu/instructions/addARegister
                 br $folding-inner4
                end
                global.get $core/cpu/cpu/Cpu.stackPointer
                i32.const 2
                i32.sub
                i32.const 65535
                i32.and
                local.tee $0
                global.set $core/cpu/cpu/Cpu.stackPointer
                local.get $0
                global.get $core/cpu/cpu/Cpu.programCounter
                call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                i32.const 0
                global.set $core/cpu/cpu/Cpu.programCounter
                br $folding-inner3
               end
               global.get $core/cpu/cpu/Cpu.registerF
               i32.const 7
               i32.shr_u
               i32.const 1
               i32.and
               i32.const 1
               i32.ne
               br_if $folding-inner3
               br $folding-inner0
              end
              global.get $core/cpu/cpu/Cpu.stackPointer
              local.tee $0
              call $core/cpu/opcodes/sixteenBitLoadSyncCycles
              i32.const 65535
              i32.and
              global.set $core/cpu/cpu/Cpu.programCounter
              local.get $0
              i32.const 2
              i32.add
              i32.const 65535
              i32.and
              global.set $core/cpu/cpu/Cpu.stackPointer
              br $folding-inner3
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 7
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 1
             i32.eq
             br_if $folding-inner2
             br $folding-inner5
            end
            call $core/cpu/opcodes/getDataByteOne
            i32.const 255
            i32.and
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
           i32.const 1
           i32.ne
           br_if $folding-inner5
           global.get $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.stackPointer
           local.get $0
           global.get $core/cpu/cpu/Cpu.programCounter
           i32.const 2
           i32.add
           i32.const 65535
           i32.and
           call $core/cpu/opcodes/sixteenBitStoreSyncCycles
           br $folding-inner2
          end
          call $core/cpu/opcodes/getDataByteOne
          call $core/cpu/instructions/addAThroughCarryRegister
          br $folding-inner4
         end
         global.get $core/cpu/cpu/Cpu.stackPointer
         i32.const 2
         i32.sub
         i32.const 65535
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.stackPointer
         local.get $0
         global.get $core/cpu/cpu/Cpu.programCounter
         call $core/cpu/opcodes/sixteenBitStoreSyncCycles
         i32.const 8
         global.set $core/cpu/cpu/Cpu.programCounter
         br $folding-inner3
        end
        i32.const -1
        return
       end
       global.get $core/cpu/cpu/Cpu.stackPointer
       local.tee $0
       call $core/cpu/opcodes/sixteenBitLoadSyncCycles
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
       return
      end
      global.get $core/cpu/cpu/Cpu.stackPointer
      i32.const 2
      i32.sub
      i32.const 65535
      i32.and
      local.tee $0
      global.set $core/cpu/cpu/Cpu.stackPointer
      local.get $0
      global.get $core/cpu/cpu/Cpu.programCounter
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      call $core/cpu/opcodes/sixteenBitStoreSyncCycles
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
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 2
  i32.add
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.programCounter
  i32.const 12
 )
 (func $core/cpu/opcodes/handleOpcodeDx (; 202 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                    local.get $0
                    i32.const 208
                    i32.ne
                    if
                     local.get $0
                     i32.const 209
                     i32.eq
                     br_if $case1|0
                     block $tablify|0
                      local.get $0
                      i32.const 210
                      i32.sub
                      br_table $case2|0 $tablify|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $tablify|0 $case10|0 $tablify|0 $case11|0 $case12|0 $tablify|0
                     end
                     br $break|0
                    end
                    global.get $core/cpu/cpu/Cpu.registerF
                    i32.const 4
                    i32.shr_u
                    i32.const 1
                    i32.and
                    br_if $folding-inner2
                    br $folding-inner0
                   end
                   global.get $core/cpu/cpu/Cpu.stackPointer
                   local.tee $1
                   call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                   i32.const 65535
                   i32.and
                   local.set $0
                   local.get $1
                   i32.const 2
                   i32.add
                   i32.const 65535
                   i32.and
                   global.set $core/cpu/cpu/Cpu.stackPointer
                   local.get $0
                   i32.const 65280
                   i32.and
                   i32.const 8
                   i32.shr_s
                   global.set $core/cpu/cpu/Cpu.registerD
                   local.get $0
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
                  br_if $folding-inner4
                  br $folding-inner1
                 end
                 global.get $core/cpu/cpu/Cpu.registerF
                 i32.const 4
                 i32.shr_u
                 i32.const 1
                 i32.and
                 br_if $folding-inner4
                 global.get $core/cpu/cpu/Cpu.stackPointer
                 i32.const 2
                 i32.sub
                 i32.const 65535
                 i32.and
                 local.tee $0
                 global.set $core/cpu/cpu/Cpu.stackPointer
                 local.get $0
                 global.get $core/cpu/cpu/Cpu.programCounter
                 i32.const 2
                 i32.add
                 i32.const 65535
                 i32.and
                 call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                 br $folding-inner1
                end
                global.get $core/cpu/cpu/Cpu.stackPointer
                i32.const 2
                i32.sub
                i32.const 65535
                i32.and
                local.tee $0
                global.set $core/cpu/cpu/Cpu.stackPointer
                local.get $0
                global.get $core/cpu/cpu/Cpu.registerE
                i32.const 255
                i32.and
                global.get $core/cpu/cpu/Cpu.registerD
                i32.const 255
                i32.and
                i32.const 8
                i32.shl
                i32.or
                call $core/cpu/opcodes/sixteenBitStoreSyncCycles
                br $folding-inner2
               end
               call $core/cpu/opcodes/getDataByteOne
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
              local.get $0
              global.get $core/cpu/cpu/Cpu.programCounter
              call $core/cpu/opcodes/sixteenBitStoreSyncCycles
              i32.const 16
              global.set $core/cpu/cpu/Cpu.programCounter
              br $folding-inner2
             end
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 4
             i32.shr_u
             i32.const 1
             i32.and
             i32.const 1
             i32.ne
             br_if $folding-inner2
             br $folding-inner0
            end
            global.get $core/cpu/cpu/Cpu.stackPointer
            local.tee $0
            call $core/cpu/opcodes/sixteenBitLoadSyncCycles
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
           i32.const 1
           i32.eq
           br_if $folding-inner1
           br $folding-inner4
          end
          global.get $core/cpu/cpu/Cpu.registerF
          i32.const 4
          i32.shr_u
          i32.const 1
          i32.and
          i32.const 1
          i32.ne
          br_if $folding-inner4
          global.get $core/cpu/cpu/Cpu.stackPointer
          i32.const 2
          i32.sub
          i32.const 65535
          i32.and
          local.tee $0
          global.set $core/cpu/cpu/Cpu.stackPointer
          local.get $0
          global.get $core/cpu/cpu/Cpu.programCounter
          i32.const 2
          i32.add
          i32.const 65535
          i32.and
          call $core/cpu/opcodes/sixteenBitStoreSyncCycles
          br $folding-inner1
         end
         call $core/cpu/opcodes/getDataByteOne
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
        local.get $0
        global.get $core/cpu/cpu/Cpu.programCounter
        call $core/cpu/opcodes/sixteenBitStoreSyncCycles
        i32.const 24
        global.set $core/cpu/cpu/Cpu.programCounter
        br $folding-inner2
       end
       i32.const -1
       return
      end
      global.get $core/cpu/cpu/Cpu.stackPointer
      local.tee $0
      call $core/cpu/opcodes/sixteenBitLoadSyncCycles
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
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 2
  i32.add
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.programCounter
  i32.const 12
 )
 (func $core/cpu/opcodes/handleOpcodeEx (; 203 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
              local.get $0
              i32.const 224
              i32.ne
              if
               local.get $0
               i32.const 225
               i32.eq
               br_if $case1|0
               block $tablify|0
                local.get $0
                i32.const 226
                i32.sub
                br_table $case2|0 $tablify|0 $tablify|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $tablify|0 $tablify|0 $tablify|0 $case9|0 $case10|0 $tablify|0
               end
               br $break|0
              end
              call $core/cpu/opcodes/getDataByteOne
              i32.const 255
              i32.and
              i32.const 65280
              i32.add
              global.get $core/cpu/cpu/Cpu.registerA
              call $core/cpu/opcodes/eightBitStoreSyncCycles
              br $folding-inner0
             end
             global.get $core/cpu/cpu/Cpu.stackPointer
             local.tee $1
             call $core/cpu/opcodes/sixteenBitLoadSyncCycles
             i32.const 65535
             i32.and
             local.set $0
             local.get $1
             i32.const 2
             i32.add
             i32.const 65535
             i32.and
             global.set $core/cpu/cpu/Cpu.stackPointer
             local.get $0
             i32.const 65280
             i32.and
             i32.const 8
             i32.shr_s
             global.set $core/cpu/cpu/Cpu.registerH
             local.get $0
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
            call $core/cpu/opcodes/eightBitStoreSyncCycles
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
           local.get $0
           global.get $core/cpu/cpu/Cpu.registerL
           i32.const 255
           i32.and
           global.get $core/cpu/cpu/Cpu.registerH
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
         global.get $core/cpu/cpu/Cpu.stackPointer
         i32.const 2
         i32.sub
         i32.const 65535
         i32.and
         local.tee $0
         global.set $core/cpu/cpu/Cpu.stackPointer
         local.get $0
         global.get $core/cpu/cpu/Cpu.programCounter
         call $core/cpu/opcodes/sixteenBitStoreSyncCycles
         i32.const 32
         global.set $core/cpu/cpu/Cpu.programCounter
         i32.const 8
         return
        end
        call $core/cpu/opcodes/getDataByteOne
        i32.const 24
        i32.shl
        i32.const 24
        i32.shr_s
        local.set $0
        global.get $core/cpu/cpu/Cpu.stackPointer
        local.get $0
        i32.const 1
        call $core/cpu/flags/checkAndSetSixteenBitFlagsAddOverflow
        global.get $core/cpu/cpu/Cpu.stackPointer
        local.get $0
        i32.add
        i32.const 65535
        i32.and
        global.set $core/cpu/cpu/Cpu.stackPointer
        i32.const 0
        call $core/cpu/flags/setZeroFlag
        i32.const 0
        call $core/cpu/flags/setSubtractFlag
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
      call $core/cpu/opcodes/eightBitStoreSyncCycles
      global.get $core/cpu/cpu/Cpu.programCounter
      i32.const 2
      i32.add
      i32.const 65535
      i32.and
      global.set $core/cpu/cpu/Cpu.programCounter
      i32.const 4
      return
     end
     call $core/cpu/opcodes/getDataByteOne
     call $core/cpu/instructions/xorARegister
     br $folding-inner0
    end
    global.get $core/cpu/cpu/Cpu.stackPointer
    i32.const 2
    i32.sub
    i32.const 65535
    i32.and
    local.tee $0
    global.set $core/cpu/cpu/Cpu.stackPointer
    local.get $0
    global.get $core/cpu/cpu/Cpu.programCounter
    call $core/cpu/opcodes/sixteenBitStoreSyncCycles
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
 (func $core/cpu/opcodes/handleOpcodeFx (; 204 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
                 local.get $0
                 i32.const 240
                 i32.ne
                 if
                  local.get $0
                  i32.const 241
                  i32.eq
                  br_if $case1|0
                  block $tablify|0
                   local.get $0
                   i32.const 242
                   i32.sub
                   br_table $case2|0 $case3|0 $tablify|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $tablify|0 $tablify|0 $case11|0 $case12|0 $tablify|0
                  end
                  br $break|0
                 end
                 call $core/cpu/opcodes/getDataByteOne
                 i32.const 255
                 i32.and
                 i32.const 65280
                 i32.add
                 call $core/cpu/opcodes/eightBitLoadSyncCycles
                 i32.const 255
                 i32.and
                 global.set $core/cpu/cpu/Cpu.registerA
                 br $folding-inner0
                end
                global.get $core/cpu/cpu/Cpu.stackPointer
                local.tee $1
                call $core/cpu/opcodes/sixteenBitLoadSyncCycles
                i32.const 65535
                i32.and
                local.set $0
                local.get $1
                i32.const 2
                i32.add
                i32.const 65535
                i32.and
                global.set $core/cpu/cpu/Cpu.stackPointer
                local.get $0
                i32.const 65280
                i32.and
                i32.const 8
                i32.shr_s
                global.set $core/cpu/cpu/Cpu.registerA
                local.get $0
                i32.const 255
                i32.and
                global.set $core/cpu/cpu/Cpu.registerF
                br $folding-inner1
               end
               global.get $core/cpu/cpu/Cpu.registerC
               i32.const 65280
               i32.add
               call $core/cpu/opcodes/eightBitLoadSyncCycles
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
             local.get $0
             global.get $core/cpu/cpu/Cpu.registerF
             i32.const 255
             i32.and
             global.get $core/cpu/cpu/Cpu.registerA
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
           global.get $core/cpu/cpu/Cpu.stackPointer
           i32.const 2
           i32.sub
           i32.const 65535
           i32.and
           local.tee $0
           global.set $core/cpu/cpu/Cpu.stackPointer
           local.get $0
           global.get $core/cpu/cpu/Cpu.programCounter
           call $core/cpu/opcodes/sixteenBitStoreSyncCycles
           i32.const 48
           global.set $core/cpu/cpu/Cpu.programCounter
           i32.const 8
           return
          end
          call $core/cpu/opcodes/getDataByteOne
          i32.const 24
          i32.shl
          i32.const 24
          i32.shr_s
          local.set $0
          global.get $core/cpu/cpu/Cpu.stackPointer
          local.set $1
          i32.const 0
          call $core/cpu/flags/setZeroFlag
          i32.const 0
          call $core/cpu/flags/setSubtractFlag
          local.get $1
          local.get $0
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
          i32.shr_s
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
        call $core/cpu/opcodes/eightBitLoadSyncCycles
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
      call $core/cpu/opcodes/getDataByteOne
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
     local.get $0
     global.get $core/cpu/cpu/Cpu.programCounter
     call $core/cpu/opcodes/sixteenBitStoreSyncCycles
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
 (func $core/cpu/opcodes/executeOpcode (; 205 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $core/cpu/cpu/Cpu.programCounter
  i32.const 1
  i32.add
  i32.const 65535
  i32.and
  local.set $1
  global.get $core/cpu/cpu/Cpu.isHaltBug
  if
   local.get $1
   i32.const 1
   i32.sub
   i32.const 65535
   i32.and
   local.set $1
  end
  local.get $1
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
                 local.get $0
                 i32.const 240
                 i32.and
                 i32.const 4
                 i32.shr_s
                 local.tee $1
                 if
                  local.get $1
                  i32.const 1
                  i32.sub
                  br_table $case1|0 $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $case8|0 $case9|0 $case10|0 $case11|0 $case12|0 $case13|0 $case14|0 $case15|0
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
 (func $core/interrupts/interrupts/_handleInterrupt (; 206 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 0
  global.set $core/interrupts/interrupts/Interrupts.masterInterruptSwitch
  i32.const 65295
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 1
  local.get $0
  i32.shl
  i32.const -1
  i32.xor
  i32.and
  local.tee $1
  global.set $core/interrupts/interrupts/Interrupts.interruptsRequestedValue
  i32.const 65295
  local.get $1
  call $core/memory/store/eightBitStoreIntoGBMemory
  global.get $core/cpu/cpu/Cpu.stackPointer
  i32.const 2
  i32.sub
  i32.const 65535
  i32.and
  global.set $core/cpu/cpu/Cpu.stackPointer
  global.get $core/cpu/cpu/Cpu.stackPointer
  local.tee $1
  global.get $core/cpu/cpu/Cpu.programCounter
  local.tee $2
  i32.const 255
  i32.and
  call $core/memory/store/eightBitStoreIntoGBMemory
  local.get $1
  i32.const 1
  i32.add
  local.get $2
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
       local.get $0
       if
        local.get $0
        i32.const 1
        i32.eq
        br_if $case1|0
        block $tablify|0
         local.get $0
         i32.const 2
         i32.sub
         br_table $case2|0 $case3|0 $case4|0 $tablify|0
        end
        br $break|0
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
 (func $core/interrupts/interrupts/checkInterrupts (; 207 ;) (type $FUNCSIG$i) (result i32)
  (local $0 i32)
  (local $1 i32)
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
  i32.gt_s
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
   if
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
    local.set $0
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
   local.get $0
   return
  end
  i32.const 0
 )
 (func $core/execute/executeStep (; 208 ;) (type $FUNCSIG$i) (result i32)
  (local $0 i32)
  (local $1 i32)
  i32.const 1
  global.set $core/core/hasStarted
  global.get $core/cpu/cpu/Cpu.isHaltBug
  if
   global.get $core/cpu/cpu/Cpu.programCounter
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 255
   i32.and
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
  local.tee $0
  i32.const 0
  i32.gt_s
  if
   local.get $0
   call $core/cycles/syncCycles
  end
  i32.const 4
  local.set $0
  i32.const 0
  global.get $core/cpu/cpu/Cpu.isStopped
  i32.eqz
  i32.const 1
  global.get $core/cpu/cpu/Cpu.isHaltNoJump
  global.get $core/cpu/cpu/Cpu.isHaltNormal
  select
  select
  if
   global.get $core/cpu/cpu/Cpu.programCounter
   call $core/memory/load/eightBitLoadFromGBMemory
   i32.const 255
   i32.and
   call $core/cpu/opcodes/executeOpcode
   local.set $0
  end
  global.get $core/cpu/cpu/Cpu.registerF
  i32.const 240
  i32.and
  global.set $core/cpu/cpu/Cpu.registerF
  local.get $0
  i32.const 0
  i32.le_s
  if
   local.get $0
   return
  end
  local.get $0
  call $core/cycles/syncCycles
  global.get $core/execute/Execute.steps
  i32.const 1
  i32.add
  local.tee $1
  global.get $core/execute/Execute.stepsPerStepSet
  i32.ge_s
  if (result i32)
   global.get $core/execute/Execute.stepSets
   i32.const 1
   i32.add
   global.set $core/execute/Execute.stepSets
   local.get $1
   global.get $core/execute/Execute.stepsPerStepSet
   i32.sub
  else
   local.get $1
  end
  global.set $core/execute/Execute.steps
  global.get $core/cpu/cpu/Cpu.programCounter
  global.get $core/debug/breakpoints/Breakpoints.programCounter
  i32.eq
  if
   i32.const 1
   global.set $core/debug/breakpoints/Breakpoints.reachedBreakpoint
  end
  local.get $0
 )
 (func $core/sound/sound/getNumberOfSamplesInAudioBuffer (; 209 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/sound/sound/Sound.audioQueueIndex
 )
 (func $core/execute/executeUntilCondition (; 210 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
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
  local.set $2
  i32.const 0
  local.set $0
  loop $continue|0
   global.get $core/debug/breakpoints/Breakpoints.reachedBreakpoint
   i32.eqz
   i32.const 0
   local.get $1
   i32.eqz
   i32.const 0
   i32.const 0
   local.get $0
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
      local.set $0
     else
      i32.const 1
      local.get $1
      global.get $core/sound/sound/Sound.audioQueueIndex
      local.get $2
      i32.ge_s
      i32.const 0
      local.get $2
      i32.const -1
      i32.gt_s
      select
      select
      local.set $1
     end
    end
    br $continue|0
   end
  end
  local.get $0
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
 (func $core/execute/executeFrame (; 211 ;) (type $FUNCSIG$i) (result i32)
  i32.const -1
  call $core/execute/executeUntilCondition
 )
 (func $core/execute/executeMultipleFrames (; 212 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  loop $continue|0
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
    br $continue|0
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
 (func $core/cycles/getCyclesPerCycleSet (; 213 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cycles/Cycles.cyclesPerCycleSet
 )
 (func $core/cycles/getCycleSets (; 214 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cycles/Cycles.cycleSets
 )
 (func $core/cycles/getCycles (; 215 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cycles/Cycles.cycles
 )
 (func $core/joypad/joypad/_getJoypadButtonStateFromButtonId (; 216 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  block $case8|0
   block $case7|0
    block $case6|0
     block $case5|0
      block $case4|0
       block $case3|0
        block $case2|0
         block $case1|0
          local.get $0
          if
           local.get $0
           i32.const 1
           i32.eq
           br_if $case1|0
           block $tablify|0
            local.get $0
            i32.const 2
            i32.sub
            br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
           end
           br $case8|0
          end
          global.get $core/joypad/joypad/Joypad.up
          return
         end
         global.get $core/joypad/joypad/Joypad.right
         return
        end
        global.get $core/joypad/joypad/Joypad.down
        return
       end
       global.get $core/joypad/joypad/Joypad.left
       return
      end
      global.get $core/joypad/joypad/Joypad.a
      return
     end
     global.get $core/joypad/joypad/Joypad.b
     return
    end
    global.get $core/joypad/joypad/Joypad.select
    return
   end
   global.get $core/joypad/joypad/Joypad.start
   return
  end
  i32.const 0
 )
 (func $core/joypad/joypad/_setJoypadButtonStateFromButtonId (; 217 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  block $break|0
   block $case7|0
    block $case6|0
     block $case5|0
      block $case4|0
       block $case3|0
        block $case2|0
         block $case1|0
          local.get $0
          if
           local.get $0
           i32.const 1
           i32.eq
           br_if $case1|0
           block $tablify|0
            local.get $0
            i32.const 2
            i32.sub
            br_table $case2|0 $case3|0 $case4|0 $case5|0 $case6|0 $case7|0 $tablify|0
           end
           br $break|0
          end
          local.get $1
          i32.const 0
          i32.ne
          global.set $core/joypad/joypad/Joypad.up
          br $break|0
         end
         local.get $1
         i32.const 0
         i32.ne
         global.set $core/joypad/joypad/Joypad.right
         br $break|0
        end
        local.get $1
        i32.const 0
        i32.ne
        global.set $core/joypad/joypad/Joypad.down
        br $break|0
       end
       local.get $1
       i32.const 0
       i32.ne
       global.set $core/joypad/joypad/Joypad.left
       br $break|0
      end
      local.get $1
      i32.const 0
      i32.ne
      global.set $core/joypad/joypad/Joypad.a
      br $break|0
     end
     local.get $1
     i32.const 0
     i32.ne
     global.set $core/joypad/joypad/Joypad.b
     br $break|0
    end
    local.get $1
    i32.const 0
    i32.ne
    global.set $core/joypad/joypad/Joypad.select
    br $break|0
   end
   local.get $1
   i32.const 0
   i32.ne
   global.set $core/joypad/joypad/Joypad.start
  end
 )
 (func $core/joypad/joypad/_pressJoypadButton (; 218 ;) (type $FUNCSIG$vi) (param $0 i32)
  (local $1 i32)
  i32.const 0
  global.set $core/cpu/cpu/Cpu.isStopped
  local.get $0
  call $core/joypad/joypad/_getJoypadButtonStateFromButtonId
  i32.eqz
  if
   i32.const 1
   local.set $1
  end
  local.get $0
  i32.const 1
  call $core/joypad/joypad/_setJoypadButtonStateFromButtonId
  local.get $1
  if
   i32.const 1
   i32.const 1
   i32.const 0
   i32.const 1
   i32.const 0
   local.get $0
   i32.const 3
   i32.le_s
   select
   local.tee $0
   i32.const 0
   global.get $core/joypad/joypad/Joypad.isDpadType
   select
   select
   local.get $0
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
 (func $core/joypad/joypad/_releaseJoypadButton (; 219 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  i32.const 0
  call $core/joypad/joypad/_setJoypadButtonStateFromButtonId
 )
 (func $core/joypad/joypad/setJoypadState (; 220 ;) (type $FUNCSIG$viiiiiiii) (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32)
  local.get $0
  i32.const 0
  i32.gt_s
  if
   i32.const 0
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 0
   call $core/joypad/joypad/_releaseJoypadButton
  end
  local.get $1
  i32.const 0
  i32.gt_s
  if
   i32.const 1
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 1
   call $core/joypad/joypad/_releaseJoypadButton
  end
  local.get $2
  i32.const 0
  i32.gt_s
  if
   i32.const 2
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 2
   call $core/joypad/joypad/_releaseJoypadButton
  end
  local.get $3
  i32.const 0
  i32.gt_s
  if
   i32.const 3
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 3
   call $core/joypad/joypad/_releaseJoypadButton
  end
  local.get $4
  i32.const 0
  i32.gt_s
  if
   i32.const 4
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 4
   call $core/joypad/joypad/_releaseJoypadButton
  end
  local.get $5
  i32.const 0
  i32.gt_s
  if
   i32.const 5
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 5
   call $core/joypad/joypad/_releaseJoypadButton
  end
  local.get $6
  i32.const 0
  i32.gt_s
  if
   i32.const 6
   call $core/joypad/joypad/_pressJoypadButton
  else
   i32.const 6
   call $core/joypad/joypad/_releaseJoypadButton
  end
  local.get $7
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
 (func $core/debug/breakpoints/setProgramCounterBreakpoint (; 221 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  global.set $core/debug/breakpoints/Breakpoints.programCounter
 )
 (func $core/debug/breakpoints/resetProgramCounterBreakpoint (; 222 ;) (type $FUNCSIG$v)
  i32.const -1
  global.set $core/debug/breakpoints/Breakpoints.programCounter
 )
 (func $core/debug/breakpoints/setReadGbMemoryBreakpoint (; 223 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  global.set $core/debug/breakpoints/Breakpoints.readGbMemory
 )
 (func $core/debug/breakpoints/resetReadGbMemoryBreakpoint (; 224 ;) (type $FUNCSIG$v)
  i32.const -1
  global.set $core/debug/breakpoints/Breakpoints.readGbMemory
 )
 (func $core/debug/breakpoints/setWriteGbMemoryBreakpoint (; 225 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  global.set $core/debug/breakpoints/Breakpoints.writeGbMemory
 )
 (func $core/debug/breakpoints/resetWriteGbMemoryBreakpoint (; 226 ;) (type $FUNCSIG$v)
  i32.const -1
  global.set $core/debug/breakpoints/Breakpoints.writeGbMemory
 )
 (func $core/debug/debug-cpu/getRegisterA (; 227 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerA
 )
 (func $core/debug/debug-cpu/getRegisterB (; 228 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerB
 )
 (func $core/debug/debug-cpu/getRegisterC (; 229 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerC
 )
 (func $core/debug/debug-cpu/getRegisterD (; 230 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerD
 )
 (func $core/debug/debug-cpu/getRegisterE (; 231 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerE
 )
 (func $core/debug/debug-cpu/getRegisterH (; 232 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerH
 )
 (func $core/debug/debug-cpu/getRegisterL (; 233 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerL
 )
 (func $core/debug/debug-cpu/getRegisterF (; 234 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.registerF
 )
 (func $core/debug/debug-cpu/getProgramCounter (; 235 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.programCounter
 )
 (func $core/debug/debug-cpu/getStackPointer (; 236 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.stackPointer
 )
 (func $core/debug/debug-cpu/getOpcodeAtProgramCounter (; 237 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/cpu/cpu/Cpu.programCounter
  call $core/memory/load/eightBitLoadFromGBMemory
  i32.const 255
  i32.and
 )
 (func $core/debug/debug-graphics/getLY (; 238 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/graphics/graphics/Graphics.scanlineRegister
 )
 (func $core/debug/debug-graphics/drawBackgroundMapToWasmMemory (; 239 ;) (type $FUNCSIG$vi) (param $0 i32)
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
  global.get $core/graphics/lcd/Lcd.bgWindowTileDataSelect
  select
  local.set $8
  i32.const 39936
  i32.const 38912
  global.get $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
  select
  local.set $9
  loop $loop|0
   local.get $5
   i32.const 256
   i32.lt_s
   if
    i32.const 0
    local.set $4
    loop $loop|1
     local.get $4
     i32.const 256
     i32.lt_s
     if
      local.get $8
      local.get $5
      i32.const 3
      i32.shr_s
      i32.const 5
      i32.shl
      local.get $9
      i32.add
      local.get $4
      i32.const 3
      i32.shr_s
      i32.add
      local.tee $2
      i32.const -30720
      i32.add
      i32.load8_u
      call $core/graphics/tiles/getTileDataAddress
      local.set $6
      local.get $5
      i32.const 8
      i32.rem_s
      local.set $1
      i32.const 7
      local.get $4
      i32.const 8
      i32.rem_s
      i32.sub
      local.set $7
      i32.const 0
      local.set $3
      local.get $0
      i32.const 0
      i32.gt_s
      i32.const 0
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      select
      if
       local.get $2
       i32.const -22528
       i32.add
       i32.load8_u
       local.set $3
      end
      local.get $3
      i32.const 64
      i32.and
      if
       i32.const 7
       local.get $1
       i32.sub
       local.set $1
      end
      i32.const 0
      local.set $2
      local.get $1
      i32.const 1
      i32.shl
      local.get $6
      i32.add
      local.tee $6
      i32.const -30720
      i32.add
      i32.const 1
      i32.const 0
      local.get $3
      i32.const 8
      i32.and
      select
      local.tee $2
      i32.const 13
      i32.shl
      i32.add
      i32.load8_u
      local.set $10
      i32.const 0
      local.set $1
      local.get $6
      i32.const -30719
      i32.add
      local.get $2
      i32.const 13
      i32.shl
      i32.add
      i32.load8_u
      i32.const 1
      local.get $7
      i32.shl
      i32.and
      if
       i32.const 2
       local.set $1
      end
      local.get $1
      i32.const 1
      i32.add
      local.get $1
      i32.const 1
      local.get $7
      i32.shl
      local.get $10
      i32.and
      select
      local.set $1
      local.get $5
      i32.const 8
      i32.shl
      local.get $4
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
       local.get $3
       i32.const 7
       i32.and
       local.get $1
       i32.const 0
       call $core/graphics/palette/getRgbColorFromPalette
       local.tee $1
       i32.const 31
       i32.and
       i32.const 3
       i32.shl
       i32.store8
       local.get $2
       i32.const 1
       i32.add
       local.get $1
       i32.const 992
       i32.and
       i32.const 5
       i32.shr_s
       i32.const 3
       i32.shl
       i32.store8
       local.get $2
       i32.const 2
       i32.add
       local.get $1
       i32.const 31744
       i32.and
       i32.const 10
       i32.shr_s
       i32.const 3
       i32.shl
       i32.store8
      else
       local.get $2
       i32.const 184448
       i32.add
       local.tee $3
       local.get $1
       i32.const 65351
       call $core/graphics/palette/getColorizedGbHexColorFromPalette
       local.tee $1
       i32.const 16711680
       i32.and
       i32.const 16
       i32.shr_s
       i32.store8
       local.get $3
       i32.const 1
       i32.add
       local.get $1
       i32.const 65280
       i32.and
       i32.const 8
       i32.shr_s
       i32.store8
       local.get $3
       i32.const 2
       i32.add
       local.get $1
       i32.store8
      end
      local.get $4
      i32.const 1
      i32.add
      local.set $4
      br $loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $loop|0
   end
  end
 )
 (func $core/debug/debug-graphics/drawTileDataToWasmMemory (; 240 ;) (type $FUNCSIG$v)
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
  (local $11 i32)
  loop $loop|0
   local.get $4
   i32.const 23
   i32.ge_s
   i32.eqz
   if
    i32.const 0
    local.set $3
    loop $loop|1
     local.get $3
     i32.const 31
     i32.lt_s
     if
      i32.const 1
      i32.const 0
      local.get $3
      i32.const 15
      i32.gt_s
      local.tee $7
      select
      local.set $9
      local.get $4
      i32.const 15
      i32.sub
      local.get $4
      local.get $4
      i32.const 15
      i32.gt_s
      local.tee $0
      select
      i32.const 4
      i32.shl
      local.tee $5
      local.get $3
      i32.const 15
      i32.sub
      i32.add
      local.get $3
      local.get $5
      i32.add
      local.get $7
      select
      local.set $8
      i32.const 34816
      i32.const 32768
      local.get $0
      select
      local.set $10
      i32.const 65351
      local.set $7
      i32.const -1
      local.set $6
      i32.const -1
      local.set $5
      i32.const 0
      local.set $1
      loop $loop|2
       local.get $1
       i32.const 8
       i32.lt_s
       if
        i32.const 0
        local.set $0
        loop $loop|3
         local.get $0
         i32.const 5
         i32.lt_s
         if
          local.get $0
          i32.const 3
          i32.shl
          local.get $1
          i32.add
          i32.const 2
          i32.shl
          local.tee $2
          i32.const 65026
          i32.add
          call $core/memory/load/eightBitLoadFromGBMemory
          local.get $8
          i32.eq
          if
           local.get $2
           i32.const 65027
           i32.add
           call $core/memory/load/eightBitLoadFromGBMemory
           local.set $2
           i32.const 1
           i32.const 0
           local.get $2
           i32.const 8
           i32.and
           i32.const 0
           global.get $core/cpu/cpu/Cpu.GBCEnabled
           select
           select
           local.get $9
           i32.eq
           if
            i32.const 8
            local.set $1
            i32.const 5
            local.set $0
            local.get $2
            local.tee $5
            i32.const 16
            i32.and
            if (result i32)
             i32.const 65353
            else
             i32.const 65352
            end
            local.set $7
           end
          end
          local.get $0
          i32.const 1
          i32.add
          local.set $0
          br $loop|3
         end
        end
        local.get $1
        i32.const 1
        i32.add
        local.set $1
        br $loop|2
       end
      end
      local.get $5
      i32.const 0
      i32.lt_s
      i32.const 0
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      select
      if
       i32.const 39936
       i32.const 38912
       global.get $core/graphics/lcd/Lcd.bgTileMapDisplaySelect
       select
       local.set $11
       i32.const -1
       local.set $0
       i32.const 0
       local.set $2
       loop $loop|4
        local.get $2
        i32.const 32
        i32.lt_s
        if
         i32.const 0
         local.set $1
         loop $loop|5
          local.get $1
          i32.const 32
          i32.lt_s
          if
           local.get $1
           i32.const 5
           i32.shl
           local.get $11
           i32.add
           local.get $2
           i32.add
           local.tee $6
           i32.const -30720
           i32.add
           i32.load8_u
           local.get $8
           i32.eq
           if
            i32.const 32
            local.set $2
            i32.const 32
            local.set $1
            local.get $6
            local.set $0
           end
           local.get $1
           i32.const 1
           i32.add
           local.set $1
           br $loop|5
          end
         end
         local.get $2
         i32.const 1
         i32.add
         local.set $2
         br $loop|4
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
       local.set $6
      end
      i32.const 0
      local.set $0
      loop $loop|6
       local.get $0
       i32.const 8
       i32.lt_s
       if
        local.get $8
        local.get $10
        local.get $9
        i32.const 0
        i32.const 7
        local.get $0
        local.get $3
        i32.const 3
        i32.shl
        local.get $4
        i32.const 3
        i32.shl
        local.get $0
        i32.add
        i32.const 248
        i32.const 381056
        local.get $7
        local.get $6
        local.get $5
        call $core/graphics/tiles/drawPixelsFromLineOfTile
        drop
        local.get $0
        i32.const 1
        i32.add
        local.set $0
        br $loop|6
       end
      end
      local.get $3
      i32.const 1
      i32.add
      local.set $3
      br $loop|1
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $loop|0
   end
  end
 )
 (func $core/debug/debug-graphics/drawOamToWasmMemory (; 241 ;) (type $FUNCSIG$v)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  loop $loop|0
   local.get $4
   i32.const 8
   i32.ge_s
   i32.eqz
   if
    i32.const 0
    local.set $1
    loop $loop|1
     local.get $1
     i32.const 5
     i32.lt_s
     if
      local.get $1
      i32.const 3
      i32.shl
      local.get $4
      i32.add
      i32.const 2
      i32.shl
      local.tee $0
      i32.const 65024
      i32.add
      call $core/memory/load/eightBitLoadFromGBMemory
      drop
      local.get $0
      i32.const 65025
      i32.add
      call $core/memory/load/eightBitLoadFromGBMemory
      drop
      local.get $0
      i32.const 65026
      i32.add
      call $core/memory/load/eightBitLoadFromGBMemory
      local.set $2
      i32.const 1
      local.set $5
      global.get $core/graphics/lcd/Lcd.tallSpriteSize
      if
       local.get $2
       i32.const 2
       i32.rem_s
       i32.const 1
       i32.eq
       if
        local.get $2
        i32.const 1
        i32.sub
        local.set $2
       end
       i32.const 2
       local.set $5
      end
      local.get $0
      i32.const 65027
      i32.add
      call $core/memory/load/eightBitLoadFromGBMemory
      local.set $6
      i32.const 0
      local.set $7
      i32.const 1
      i32.const 0
      local.get $6
      i32.const 8
      i32.and
      i32.const 0
      global.get $core/cpu/cpu/Cpu.GBCEnabled
      select
      select
      local.set $7
      i32.const 65352
      local.set $8
      i32.const 65353
      i32.const 65352
      local.get $6
      i32.const 16
      i32.and
      select
      local.set $8
      i32.const 0
      local.set $0
      loop $loop|2
       local.get $0
       local.get $5
       i32.lt_s
       if
        i32.const 0
        local.set $3
        loop $loop|3
         local.get $3
         i32.const 8
         i32.lt_s
         if
          local.get $0
          local.get $2
          i32.add
          i32.const 32768
          local.get $7
          i32.const 0
          i32.const 7
          local.get $3
          local.get $4
          i32.const 3
          i32.shl
          local.get $1
          i32.const 4
          i32.shl
          local.get $3
          i32.add
          local.get $0
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
          br $loop|3
         end
        end
        local.get $0
        i32.const 1
        i32.add
        local.set $0
        br $loop|2
       end
      end
      local.get $1
      i32.const 1
      i32.add
      local.set $1
      br $loop|1
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $loop|0
   end
  end
 )
 (func $core/debug/debug-timer/getDIV (; 242 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/timers/timers/Timers.dividerRegister
 )
 (func $core/debug/debug-timer/getTIMA (; 243 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/timers/timers/Timers.timerCounter
 )
 (func $core/debug/debug-timer/getTMA (; 244 ;) (type $FUNCSIG$i) (result i32)
  global.get $core/timers/timers/Timers.timerModulo
 )
 (func $core/debug/debug-timer/getTAC (; 245 ;) (type $FUNCSIG$i) (result i32)
  (local $0 i32)
  global.get $core/timers/timers/Timers.timerInputClock
  local.set $0
  global.get $core/timers/timers/Timers.timerEnabled
  if
   local.get $0
   i32.const 4
   i32.or
   local.set $0
  end
  local.get $0
 )
 (func $core/debug/debug-memory/updateDebugGBMemory (; 246 ;) (type $FUNCSIG$v)
  (local $0 i32)
  loop $loop|0
   block $break|0
    local.get $0
    i32.const 65535
    i32.ge_s
    br_if $break|0
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
    br $loop|0
   end
  end
  i32.const 0
  global.set $core/debug/breakpoints/Breakpoints.reachedBreakpoint
 )
 (func $start (; 247 ;) (type $FUNCSIG$v)
  call $start:core/graphics/colors
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
 (func $~lib/rt/pure/__visit (; 248 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  local.get $0
  i32.const 284
  i32.lt_u
  if
   return
  end
  local.get $0
  i32.const 16
  i32.sub
  local.set $0
  block $break|0
   block $case5|0
    block $case4|0
     block $case3|0
      block $case2|0
       block $case1|0
        local.get $1
        i32.const 1
        i32.ne
        if
         local.get $1
         i32.const 2
         i32.eq
         br_if $case1|0
         block $tablify|0
          local.get $1
          i32.const 3
          i32.sub
          br_table $case2|0 $case3|0 $case4|0 $tablify|0
         end
         br $case5|0
        end
        local.get $0
        call $~lib/rt/pure/decrement
        br $break|0
       end
       local.get $0
       i32.load offset=4
       i32.const 268435455
       i32.and
       i32.const 0
       i32.le_u
       if
        i32.const 0
        i32.const 128
        i32.const 75
        i32.const 17
        call $~lib/builtins/abort
        unreachable
       end
       local.get $0
       local.get $0
       i32.load offset=4
       i32.const 1
       i32.sub
       i32.store offset=4
       local.get $0
       call $~lib/rt/pure/markGray
       br $break|0
      end
      local.get $0
      call $~lib/rt/pure/scan
      br $break|0
     end
     local.get $0
     i32.load offset=4
     local.tee $1
     i32.const -268435456
     i32.and
     local.get $1
     i32.const 1
     i32.add
     i32.const -268435456
     i32.and
     i32.ne
     if
      i32.const 0
      i32.const 128
      i32.const 86
      i32.const 6
      call $~lib/builtins/abort
      unreachable
     end
     local.get $0
     local.get $1
     i32.const 1
     i32.add
     i32.store offset=4
     local.get $1
     i32.const 1879048192
     i32.and
     if
      local.get $0
      call $~lib/rt/pure/scanBlack
     end
     br $break|0
    end
    local.get $0
    call $~lib/rt/pure/collectWhite
    br $break|0
   end
   i32.const 0
   i32.const 128
   i32.const 97
   i32.const 24
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $~lib/rt/__visit_members (; 249 ;) (type $FUNCSIG$vii) (param $0 i32) (param $1 i32)
  block $switch$1$default
   block $switch$1$case$4
    block $switch$1$case$2
     local.get $0
     i32.const 8
     i32.sub
     i32.load
     br_table $switch$1$case$2 $switch$1$case$2 $switch$1$case$4 $switch$1$default
    end
    return
   end
   local.get $0
   i32.load
   local.tee $0
   if
    local.get $0
    local.get $1
    call $~lib/rt/pure/__visit
   end
   return
  end
  unreachable
 )
 (func $null (; 250 ;) (type $FUNCSIG$v)
  nop
 )
 (func $core/execute/executeFrameAndCheckAudio|trampoline (; 251 ;) (type $FUNCSIG$ii) (param $0 i32) (result i32)
  block $1of1
   block $0of1
    block $outOfRange
     global.get $~lib/argc
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
 (func $~lib/setargc (; 252 ;) (type $FUNCSIG$vi) (param $0 i32)
  local.get $0
  global.set $~lib/argc
 )
 (func $core/execute/executeUntilCondition|trampoline (; 253 ;) (type $FUNCSIG$iii) (param $0 i32) (param $1 i32) (result i32)
  block $2of2
   block $1of2
    block $0of2
     block $outOfRange
      global.get $~lib/argc
      br_table $0of2 $1of2 $2of2 $outOfRange
     end
     unreachable
    end
    i32.const 1
    local.set $0
   end
   i32.const -1
   local.set $1
  end
  local.get $1
  call $core/execute/executeUntilCondition
 )
)
