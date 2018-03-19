export class Config {
  static audioBatchProcessing: boolean = false;
  static graphicsBatchProcessing: boolean = false;
  static timersBatchProcessing: boolean = false;
}

export function config(audioBatchProcessing: i32 = 0,
  graphicsBatchProcessing: i32 = 0, timersBatchProcessing: i32 = 0): void {
  if(audioBatchProcessing > 0) {
    Config.audioBatchProcessing = true;
  }
  if(graphicsBatchProcessing > 0) {
    Config.graphicsBatchProcessing = true;
  }
  if(timersBatchProcessing > 0) {
    Config.timersBatchProcessing = true;
  }
}
