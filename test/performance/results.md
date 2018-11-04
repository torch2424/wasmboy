# WasmBoy Performance Options Table

This is a Auto-generated file to give users some understanding of expected performance gains of each performance option.

**NOTE:** this is not a representation of emulator speed, but rather an easy way to determine for users and developers how much speed a performance option offers.

'noPerformanceOptions' represents what the emulator runs as when no options are toggled on while running the emulator.

This currently runs 1250 frames of each rom, and averages the results of 2 iterations of running the number of frames.

The Options passed into the emulator on each run are:

```
{
    "headless": true,
    "gameboySpeed": 100,
    "isGbcEnabled": true
}
```

## back-to-color.gbc

| Performance Option(s)                        | Time (milliseconds) |
| -------------------------------------------- | ------------------- |
| noPerformanceOptions                         | 8065.242            |
| tileRendering                                | 7417.2625           |
| tileCaching                                  | 9734.302            |
| tileRendering, tileCaching                   | 6628.726500000001   |
| audioBatchProcessing                         | 4188.3705           |
| audioAccumulateSamples                       | 6066.9095           |
| audioBatchProcessing, audioAccumulateSamples | 4136.645            |
| timersBatchProcessing                        | 6399.095            |
| graphicsBatchProcessing                      | 6153.2845           |
| graphicsDisableScanlineRendering             | 6466.1720000000005  |

## tobutobugirl.gb

| Performance Option(s)                        | Time (milliseconds) |
| -------------------------------------------- | ------------------- |
| noPerformanceOptions                         | 4235.565            |
| tileRendering                                | 3403.8779999999997  |
| tileCaching                                  | 4494.6925           |
| tileRendering, tileCaching                   | 3444.9385           |
| audioBatchProcessing                         | 3311.665            |
| audioAccumulateSamples                       | 4026.5254999999997  |
| audioBatchProcessing, audioAccumulateSamples | 3295.882            |
| timersBatchProcessing                        | 4211.6050000000005  |
| graphicsBatchProcessing                      | 4053.669            |
| graphicsDisableScanlineRendering             | 4306.104            |
