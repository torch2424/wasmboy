
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
| noPerformanceOptions             | 5458.0195           |
| tileRendering                    | 4897.6865           |
| tileCaching                      | 4795.406            |
| audioBatchProcessing             | 2698.0910000000003  |
| timersBatchProcessing            | 4804.1044999999995  |
| audioAccumulateSamples           | 4528.1245           |
| graphicsBatchProcessing          | 4444.3835           |
| graphicsDisableScanlineRendering | 4853.2985           | 

 ## tobutobugirl.gb 

 | Performance Option               | Time (milliseconds) |
| -------------------------------- | ------------------- |
| noPerformanceOptions             | 2840.8675           |
| tileRendering                    | 2845.0335           |
| tileCaching                      | 2776.5635           |
| audioBatchProcessing             | 1986.751            |
| timersBatchProcessing            | 2734.7195           |
| audioAccumulateSamples           | 2613.41             |
| graphicsBatchProcessing          | 2638.9984999999997  |
| graphicsDisableScanlineRendering | 2766.915            | 
