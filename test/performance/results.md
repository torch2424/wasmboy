
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
| noPerformanceOptions                         | 5400.696            |
| tileRendering                                | 3531.708            |
| tileCaching                                  | 4720.581            |
| tileRendering, tileCaching                   | 3680.2619999999997  |
| audioBatchProcessing                         | 4905.786            |
| audioAccumulateSamples                       | 2688.924            |
| audioBatchProcessing, audioAccumulateSamples | 5055.957            |
| timersBatchProcessing                        | 2718.4725           |
| graphicsBatchProcessing                      | 5553.813            |
| graphicsDisableScanlineRendering             | 3395.663            | 

 ## tobutobugirl.gb 

 | Performance Option(s)                        | Time (milliseconds) |
| -------------------------------------------- | ------------------- |
| noPerformanceOptions                         | 6567.361            |
| tileRendering                                | 5854.744            |
| tileCaching                                  | 4856.6145           |
| tileRendering, tileCaching                   | 5959.099            |
| audioBatchProcessing                         | 4959.751            |
| audioAccumulateSamples                       | 3832.6414999999997  |
| audioBatchProcessing, audioAccumulateSamples | 5421.531000000001   |
| timersBatchProcessing                        | 3825.849            |
| graphicsBatchProcessing                      | 5611.0650000000005  |
| graphicsDisableScanlineRendering             | 5431.6235           | 
