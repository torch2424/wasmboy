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
| noPerformanceOptions                         | 6728.951            |
| tileRendering                                | 6257.8305           |
| tileCaching                                  | 7124.955            |
| tileRendering, tileCaching                   | 6335.224            |
| audioBatchProcessing                         | 5087.030000000001   |
| audioAccumulateSamples                       | 6950.9355           |
| audioBatchProcessing, audioAccumulateSamples | 4759.665            |
| timersBatchProcessing                        | 8493.6705           |
| graphicsBatchProcessing                      | 7857.561            |
| graphicsDisableScanlineRendering             | 7471.084            |

## tobutobugirl.gb

| Performance Option(s)                        | Time (milliseconds) |
| -------------------------------------------- | ------------------- |
| noPerformanceOptions                         | 5458.086            |
| tileRendering                                | 4033.121            |
| tileCaching                                  | 4709.412            |
| tileRendering, tileCaching                   | 5005.8595000000005  |
| audioBatchProcessing                         | 3574.4855           |
| audioAccumulateSamples                       | 4301.1195           |
| audioBatchProcessing, audioAccumulateSamples | 4121.4895           |
| timersBatchProcessing                        | 6274.267            |
| graphicsBatchProcessing                      | 4408.202499999999   |
| graphicsDisableScanlineRendering             | 4407.103            |
