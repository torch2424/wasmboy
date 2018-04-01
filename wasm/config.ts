export class Config {

  // Batch Processing
  static audioBatchProcessing: boolean = false;
  static graphicsBatchProcessing: boolean = false;
  static timersBatchProcessing: boolean = false;

  // Scanline Rendering
  static graphicsDisableScanlineRendering: boolean = false;

  // Acumulate Sound Samples
  static audioAccumulateSamples: boolean = false;
}

export function config(audioBatchProcessing: i32 = 0,
  graphicsBatchProcessing: i32 = 0,
  timersBatchProcessing: i32 = 0,
  graphicsDisableScanlineRendering: i32 = 0,
  audioAccumulateSamples: i32 = 0): void {
  if(audioBatchProcessing > 0) {
    Config.audioBatchProcessing = true;
  }
  if(graphicsBatchProcessing > 0) {
    Config.graphicsBatchProcessing = true;
  }
  if(timersBatchProcessing > 0) {
    Config.timersBatchProcessing = true;
  }
  if(graphicsDisableScanlineRendering > 0) {
    Config.graphicsDisableScanlineRendering = true
  }
  if(audioAccumulateSamples > 0) {
    Config.audioAccumulateSamples = true;
  }
}
