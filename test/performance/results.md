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
| noPerformanceOptions                         | 6808.7535           |
| tileRendering                                | 5809.0125           |
| tileCaching                                  | 7116.554            |
| tileRendering, tileCaching                   | 6576.772            |
| audioBatchProcessing                         | 4203.1665           |
| audioAccumulateSamples                       | 6016.2685           |
| audioBatchProcessing, audioAccumulateSamples | 4169.6335           |
| timersBatchProcessing                        | 6699.092000000001   |
| graphicsBatchProcessing                      | 6171.495999999999   |
| graphicsDisableScanlineRendering             | 6589.4305           |

## tobutobugirl.gb

| Performance Option(s)                        | Time (milliseconds) |
| -------------------------------------------- | ------------------- |
| noPerformanceOptions                         | 4873.3815           |
| tileRendering                                | 4072.447            |
| tileCaching                                  | 5075.5244999999995  |
| tileRendering, tileCaching                   | 4022.361            |
| audioBatchProcessing                         | 3656.92             |
| audioAccumulateSamples                       | 4616.6135           |
| audioBatchProcessing, audioAccumulateSamples | 3668.356            |
| timersBatchProcessing                        | 4881.475            |
| graphicsBatchProcessing                      | 4607.8585           |
| graphicsDisableScanlineRendering             | 4852.513            |
