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
| noPerformanceOptions                         | 3337.7465           |
| tileRendering                                | 3319.5330000000004  |
| tileCaching                                  | 3567.2385000000004  |
| tileRendering, tileCaching                   | 3359.1450000000004  |
| audioBatchProcessing                         | 2032.035            |
| audioAccumulateSamples                       | 2682.5820000000003  |
| audioBatchProcessing, audioAccumulateSamples | 1995.4805000000001  |
| timersBatchProcessing                        | 3333.443            |
| graphicsBatchProcessing                      | 3027.2965000000004  |
| graphicsDisableScanlineRendering             | 3317.316            |

## tobutobugirl.gb

| Performance Option(s)                        | Time (milliseconds) |
| -------------------------------------------- | ------------------- |
| noPerformanceOptions                         | 2338.932            |
| tileRendering                                | 2307.2475000000004  |
| tileCaching                                  | 2600.7969999999996  |
| tileRendering, tileCaching                   | 2378.237            |
| audioBatchProcessing                         | 1695.4825           |
| audioAccumulateSamples                       | 1942.0710000000001  |
| audioBatchProcessing, audioAccumulateSamples | 1690.106            |
| timersBatchProcessing                        | 2364.5575           |
| graphicsBatchProcessing                      | 2132.6435           |
| graphicsDisableScanlineRendering             | 2312.4674999999997  |
