# wasmBoy
Gameboy Emulator written in Web Assembly, Shell in Preact

using [awesome gbdev](https://github.com/avivace/awesome-gbdev) for reference material.

shout out: https://github.com/djhworld/gomeboycolor/blob/master/src/cpu/cpu.go

https://github.com/nakardo/node-gameboy/blob/master/lib/cpu/opcodes.js

http://pastraiser.com/cpu/gameboy/gameboy_opcodes.html

https://rednex.github.io/rgbds/gbz80.7.html

**Notes:**

Assembly script does not support Imports or exports outside of function exports

This all hugely depends on: https://github.com/AssemblyScript/assemblyscript/wiki/Status-and-Roadmap

### Things I've Learned:

* It's better to code an emulator by abstracting assembly commands into functions, rather than by Opcode operation

* Gameboy Opcodes are difficult till about 0x40

### CLI Commands

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# Watch wasm/ folder for changes, and rebuild on changes
npm run wasm:watch

# build for production with minification
npm run build

# Build the wasm into a wasm module
npm run wasm:build

# test the production build locally
npm run serve
```

For detailed explanation on how things work, checkout the [CLI Readme](https://github.com/developit/preact-cli/blob/master/README.md).
