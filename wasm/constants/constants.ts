// Centralized file for all constants, and make them publicly available
// This is used in place of static readonly constants

export class Constants {
  // CPU

  // Save state slot
  static readonly cpuSaveStateSlot: u16 = 0;

  // Memory Location for the GBC Speed switch
  static readonly memoryLocationSpeedSwitch: u16 = 0xFF4D;
}
