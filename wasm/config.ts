export class Config {

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
}

export function config(audioBatchProcessing: i32 = 0,
  graphicsBatchProcessing: i32 = 0,
  timersBatchProcessing: i32 = 0,
  graphicsDisableScanlineRendering: i32 = 0,
  audioAccumulateSamples: i32 = 0,
  tileRendering: i32 = 0): void {

  if(audioBatchProcessing > 0) {
    Config.audioBatchProcessing = true;
  } else {
    Config.audioBatchProcessing = false;
  }

  if(graphicsBatchProcessing > 0) {
    Config.graphicsBatchProcessing = true;
  } else {
    Config.graphicsBatchProcessing = false;
  }

  if(timersBatchProcessing > 0) {
    Config.timersBatchProcessing = true;
  } else {
    Config.timersBatchProcessing = false;
  }

  if(graphicsDisableScanlineRendering > 0) {
    Config.graphicsDisableScanlineRendering = true;
  } else {
    Config.graphicsDisableScanlineRendering = false;
  }

  if(audioAccumulateSamples > 0) {
    Config.audioAccumulateSamples = true;
  } else {
    Config.audioAccumulateSamples = false;
  }

  if(tileRendering > 0) {
    Config.tileRendering = true;
  } else {
    Config.tileRendering = false;
  }
}
