// Functions to update Channel 1 & 2 Square waves
import {
  Sound
} from './sound';
import {
  getChannelFrequency,
  setChannelFrequency,
  isChannelLengthEnabled,
  getChannelEnvelopePeriod,
  getChannelEnvelopeAddMode,
  getChannelDuty,
  getChannelLength,
  getChannelStartingVolume,
  isChannelDacEnabled
} from './register';
import {
  eightBitLoadFromGBMemory
} from '../memory/index';
import {
  checkBitOnByte,
  hexLog
} from '../helpers/index';

export class Square {

  // Channel Enabled flags
  static channel1IsEnabled: boolean = true;
  static channel2IsEnabled: boolean = false;

  // Channel Frequency timers
  static channel1FrequencyTimer: i32 = 0x00;
  static channel2FrequencyTimer: i32 = 0x00;

  // Sweep Counter
  static channel1SweepCounter: u16 = 0x00;
  // Sweep Shadow Frequency
  static channel1SweepShadowFrequency: u16 = 0x00;

  // Envelope Counter
  static channel1EnvelopeCounter: u8 = 0x00;
  static channel2EnvelopeCounter: u8 = 0x00;

  // Length Counters
  static channel1LengthCounter: u8 = 0;
  static channel2LengthCounter: u8 = 0;

  // Current Duty Cycle
  static channel1DutyCycleClock: u8 = 0;
  static channel2DutyCycleClock: u8 = 0;

  // Current Volume
  static channel1CurrentVolume: u8 = 0;
  static channel2CurrentVolume: u8 = 0;
}

export function updateSquareChannel(channelNumber: i8, numberOfCycles: u8): i8 {

  // Channel 1
  if(channelNumber === 1) {
    // Decrement our channel timer
    Square.channel1FrequencyTimer -= <i32>numberOfCycles;
    if(Square.channel1FrequencyTimer <= 0) {
      // Reset our timer
      // A square channel's frequency timer period is set to (2048-frequency)*4.
      // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
      Square.channel1FrequencyTimer = (2048 - getChannelFrequency(1)) * 4;
      // Also increment our duty cycle
      // What is duty? https://en.wikipedia.org/wiki/Duty_cycle
      // Duty cycle for square wave: http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
      Square.channel1DutyCycleClock += 1;
      if (Square.channel1DutyCycleClock >= 8) {
        Square.channel1DutyCycleClock = 0;
      }
    }

    // Get our ourput volume, set to zero for silence
    let outputVolume: u8 = 0;

    // Finally to set our output volume, the channel must be enabled,
    // Our channel DAC must be enabled, and we must be in an active state
    // Of our duty cycle
    if(Square.channel1IsEnabled &&
    isChannelDacEnabled(1)) {
      // TODO: Get the actual volume
        outputVolume = 7;
    }

    // Get the current sampleValue
    let squareSample: i8 = 1;
    if (!isDutyCycleClockPositiveOrNegativeForWaveform(1, Square.channel1DutyCycleClock)) {
      squareSample = squareSample * -1;
    }

    //hexLog(5, 77, squareSample, Square.channel1DutyCycleClock, numberOfCycles, Square.channel1FrequencyTimer);

    return squareSample * <i8>outputVolume;

  } else {
    // Channel 2
    // See above for explanation of what's going on

    // TODO:
    return 0;
  }
}

// Function called on trigger events
export function triggerSquareChannel(channelNumber: i8): void {

  //http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Trigger_Event

  // Channel 1
  if(channelNumber === 1) {
    Square.channel1IsEnabled = true;
    if(getChannelLength(1) === 0) {
      Square.channel1LengthCounter = 64;
    }

    // Reset our timer
    // A square channel's frequency timer period is set to (2048-frequency)*4.
    // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
    Square.channel1FrequencyTimer = (2048 - getChannelFrequency(1)) * 4;

    Square.channel1EnvelopeCounter = getChannelEnvelopePeriod(1);

    Square.channel1CurrentVolume = getChannelStartingVolume(1);

    // Handle Channel Sweep
    // Getting period and things here, as frequency sweep is specific to the channel 1 square wave
    let sweepRegister: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR10);
    // Get bits 4-6
    let sweepPeriod: u8 = sweepRegister & 0x70;
    // Get bits 0-2
    let sweepShift: u8 = sweepRegister & 0x07;

    // Reset back to the sweep period
    Square.channel1SweepCounter = sweepPeriod;
    Square.channel1SweepShadowFrequency = getChannelFrequency(1);
    // If the sweep shift is non-zero, frequency calculation and the overflow check are performed immediately.
    if(sweepShift > 0) {
        calculateSweepAndCheckOverflow();
    }

    // Finally if DAC is off, channel is still disabled
    if(!isChannelDacEnabled(1)) {
      Square.channel1IsEnabled = false;
    }
  } else {
    // Channel 2

    Square.channel2IsEnabled = true;
    if(getChannelLength(2) === 0) {
      Square.channel2LengthCounter = 64;
    }

    // Reset our timer
    // A square channel's frequency timer period is set to (2048-frequency)*4.
    // Four duty cycles are available, each waveform taking 8 frequency timer clocks to cycle through:
    Square.channel2FrequencyTimer = (2048 - getChannelFrequency(2)) * 4;

    Square.channel2EnvelopeCounter = getChannelEnvelopePeriod(2);

    Square.channel2CurrentVolume = getChannelStartingVolume(2);

    // Finally if DAC is off, channel is still disabled
    if(!isChannelDacEnabled(2)) {
      Square.channel2IsEnabled = false;
    }
  }
}

export function updateSquareChannelSweep(): void {
  // Obscure behavior
  // TODO: The volume envelope and sweep timers treat a period of 0 as 8.
  // Decrement the sweep counter
  Square.channel1SweepCounter -= 1;

  if (Square.channel1SweepCounter <= 0) {

    // Getting period and things here, as frequency sweep is specific to the channel 1 square wave
    let sweepRegister: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR10);
    // Get bits 4-6
    let sweepPeriod: u8 = sweepRegister & 0x70;

    // Reset back to the sweep period
    Square.channel1SweepCounter = sweepPeriod;

    // Calculate our sweep
    calculateSweepAndCheckOverflow();
  }
}

function calculateSweepAndCheckOverflow(): void {
  if(isSweepEnabled()) {

    // Getting period and things here, as frequency sweep is specific to the channel 1 square wave
    let sweepRegister: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR10);
    // Get bits 0-2
    let sweepShift: u8 = sweepRegister & 0x07;

    let newFrequency: u16 = getNewFrequencyFromSweep();
    // 7FF is the highest value of the frequency: 111 1111 1111
    if (newFrequency <= 0x7FF && sweepShift > 0) {
      setChannelFrequency(1, newFrequency);
      // Re calculate the new frequency
      newFrequency = getNewFrequencyFromSweep();
    }

    // Next check if the new Frequency is above 0x7FF
    // if So, disable our sweep
    if (newFrequency > 0x7FF) {
      Square.channel1IsEnabled = false;
    }
  }
}

// The internal enabled flag is set if either the sweep period or shift
// are non-zero, cleared otherwise.
function isSweepEnabled(): boolean {
  let sweepRegister: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR10);
  // Get bits 4-6
  let sweepPeriod: u8 = sweepRegister & 0x70;
  // Get bits 0-2
  let sweepShift: u8 = sweepRegister & 0x07;

  if ((sweepPeriod !== 0 || sweepShift !== 0) || getChannelFrequency(1) > 0x7FF) {
    return true;
  } else {
    return false;
  }
}

// Function to determing a new sweep in the current context
function getNewFrequencyFromSweep(): u16 {

  // Get our sweep register info
  let sweepRegister: u8 = eightBitLoadFromGBMemory(Sound.memoryLocationNR10);
  // Get bits 4-6
  let sweepPeriod: u8 = sweepRegister & 0x70;
  // Get bits 0-2
  let sweepShift: u8 = sweepRegister & 0x07;

  // Start our new frequency, by making it equal to the "shadow frequency"
  let newFrequency: u16 = Square.channel1SweepShadowFrequency;
  newFrequency = (newFrequency >> sweepShift);

  // Check for sweep negation
  if (checkBitOnByte(3, sweepRegister)) {
    newFrequency = Square.channel1SweepShadowFrequency - newFrequency;
  } else {
    newFrequency = Square.channel1SweepShadowFrequency + newFrequency;
  }

  return newFrequency;
}

export function updateSquareChannelsLengths(): void {
  // Channel 1
  if(Square.channel1LengthCounter > 0 && isChannelLengthEnabled(1)) {
    Square.channel1LengthCounter -= 1;

    if (Square.channel1LengthCounter === 0) {
      // Disable the Channel
      Square.channel1IsEnabled = false;
    }
  }

  // Channel 2
  if(Square.channel2LengthCounter > 0 && isChannelLengthEnabled(2)) {
    Square.channel2LengthCounter -= 1;

    if (Square.channel2LengthCounter === 0) {
      // Disabled the Channel
      Square.channel2IsEnabled = false;
    }
  }
}

export function updateSquareChannelsEnvelopes(): void {

  // Obscure behavior
  // TODO: The volume envelope and sweep timers treat a period of 0 as 8.

  // Channel 1
  Square.channel1EnvelopeCounter -= 1;
  if (Square.channel1EnvelopeCounter <= 0) {

    Square.channel1EnvelopeCounter = getChannelEnvelopePeriod(1);

    if(getChannelEnvelopeAddMode(1) && Square.channel1CurrentVolume < 15) {
      Square.channel1CurrentVolume += 1;
    } else if (!getChannelEnvelopeAddMode(1) && Square.channel1CurrentVolume > 0) {
      Square.channel1CurrentVolume -= 1;
    }
  }

  // Channel 2
  Square.channel2EnvelopeCounter -= 1;
  if (Square.channel2EnvelopeCounter <= 0) {

    Square.channel2EnvelopeCounter = getChannelEnvelopePeriod(2);

    if(getChannelEnvelopeAddMode(2) && Square.channel2CurrentVolume < 15) {
      Square.channel2CurrentVolume += 1;
    } else if (getChannelEnvelopeAddMode(2) && Square.channel2CurrentVolume > 0) {
      Square.channel2CurrentVolume -= 1;
    }
  }
}

// Since there are no 2d arrays, we will use a byte to represent duty cycles (wave form from percentages)
function isDutyCycleClockPositiveOrNegativeForWaveform(channelNumber: i8, dutyCycleClock: u8): boolean {
  // Get our current Duty
  let duty: u8 = getChannelDuty(channelNumber);

  // Get our Wave Form According to the Duty
  // Default to a duty of 1
  // http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware#Square_Wave
  // 0000 0001
  let waveform: u8 = 0x01;
  if (duty === 0x01) {
    // 1000 0001
    waveform = 0x81;
  } else if (duty === 0x02) {
    // 1000 0111
    waveform = 0x87;
  } else if (duty === 0x03) {
    // 0111 1110
    waveform = 0x7E;
  }

  // Finally check if our duty cycle is an active bit on our byte
  return checkBitOnByte(dutyCycleClock, waveform);
}
