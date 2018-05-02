
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

 | Performance Option               | Time (milliseconds) |
| -------------------------------- | ------------------- |
| noPerformanceOptions             | 5814.246999999999   |
| tileRendering                    | 3808.9565000000002  |
| tileCaching                      | 5161.335499999999   |
| audioBatchProcessing             | 3881.295            |
| timersBatchProcessing            | 3427.3734999999997  |
| audioAccumulateSamples           | 3716.7855           |
| graphicsBatchProcessing          | 5372.4965           |
| graphicsDisableScanlineRendering | 3688.5005           | 

 ## tobutobugirl.gb 

 | Performance Option               | Time (milliseconds) |
| -------------------------------- | ------------------- |
| noPerformanceOptions             | 6147.995            |
| tileRendering                    | 6138.721            |
| tileCaching                      | 5141.4685           |
| audioBatchProcessing             | 6393.4775           |
| timersBatchProcessing            | 4045.6400000000003  |
| audioAccumulateSamples           | 6087.7195           |
| graphicsBatchProcessing          | 5759.7065           |
| graphicsDisableScanlineRendering | 5721.539000000001   | 
