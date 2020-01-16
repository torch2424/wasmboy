# wasmerboy

A port of [WasmBoy](https://github.com/torch2424/wasmboy) to [Wasmer](https://wasmer.io/), using Wasmer's experimental [I/O Devices](https://github.com/wasmerio/io-devices-lib/tree/master/assemblyscript) and [as-wasi](https://github.com/jedisct1/as-wasi). 🔌 Deployed to [WAPM](http://wapm.io/). 📦

![Gif of running WasmerBoy](./assets/wasmerboy.gif)

## Usage

Install WasmerBoy from WAPM:

`wapm install -g torch2424/wasmerboy`.

Run WasmerBoy by pre-opening a directory, and a rom in that directory:

`wasmerboy --dir=tobutobugirl tobutobugirl/tobutobugirl.gb`

## Contributing and License

This follows the same contribution and license guidlines as [WasmBoy](https://github.com/torch2424/wasmboy).
