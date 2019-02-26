export class Config {
  // Boot Rom
  static enableBootRom: boolean = false;

  // GBC Options
  static useGbcWhenAvailable: boolean = true;

  // Batch Processing
  static audioBatchProcessing: boolean = false;
  static graphicsBatchProcessing: boolean = false;
  static timersBatchProcessing: boolean = false;

  // Scanline Rendering
  static graphicsDisableScanlineRendering: boolean = false;

  // Acumulate Sound Samples
  static audioAccumulateSamples: boolean = false;

  // Tile Rednering
  static tileRendering: boolean = false;
  static tileCaching: boolean = false;

  // Audio Debugging
  static enableAudioDebugging: boolean = false;
}
