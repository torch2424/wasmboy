# wasmBoy
Gameboy Emulator written in Web Assembly using [AssemblyScript](https://github.com/AssemblyScript/assemblyscript), Debugger/Shell in Preact

![WasmBoy Alpha Screenshot](./docs/alphaScreenshot.png)

---
# THIS IS A WIP
---

# Features

* Passes all of Blargg's Cpu Tests

* Can render a good amount of games, but with MANY graphical glitches.

* Joypad emulation with keyboard, and gamepad support

* Debugger that can be updated with a button click, or hard coded to do stuff like breakpoints

# Tests

### Blargg's CPU Tests

![Passing Blargg Cpu tests](./docs/blarggCpuTest.png)

# Screenshots

![Tetris with some graphical bugs probably](./docs/brokenTetris.png)

# Roadmap

The project doe quality and performance also depends on the [AssemblyScript Roadmap](https://github.com/AssemblyScript/assemblyscript/wiki/Status-and-Roadmap).

The Wasmboy library is being recorded at [Issue #3](https://github.com/torch2424/wasmBoy/issues/3)

# Resources

* [awesome gbdev](https://github.com/avivace/awesome-gbdev) for reference material, and getting help from the awesome discord community

* [node-gameboy](https://github.com/nakardo/node-gameboy) and [gomeboycolor](https://github.com/djhworld/gomeboycolor) for comparison for when I'm **REALLY** stuck.

* [Codeslinger's Guide for General HOW-TO](http://www.codeslinger.co.uk/pages/projects/gameboy.html)

* [tomek's Retrospective for General Roadmap](http://blog.rekawek.eu/2017/02/09/coffee-gb/)

* [Awesome Wiki on the Gamelad project](https://github.com/Dooskington/GameLad/wiki)

* [Opcode Table](http://pastraiser.com/cpu/gameboy/gameboy_opcodes.html)

* [Opcode Instructions](https://rednex.github.io/rgbds/gbz80.7.html)

* [Spreadsheet of Game that Do or Do Not Rom Bank](https://docs.google.com/spreadsheets/d/1cOS__xEj8bBT7cqEDgJcYStKuFAS8mMA4uErx9kA40M/edit#gid=1827536881)

* [How Does Digital Audio Even?](https://www.youtube.com/watch?v=1RIA9U5oXro)

* [Sound Emulation - GhostSonit's reply](https://www.reddit.com/r/EmuDev/comments/5gkwi5/gb_apu_sound_emulation/)

* [Gameboy Sound Hardware](http://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware)

* [Gameboy Sound Operation](https://gist.github.com/drhelius/3652407)

### Random Things I've Learned:

* It's better to code an emulator by abstracting assembly commands into functions, rather than by Opcode operation

* Gameboy Opcodes are difficult till about 0x40

* All kinds of stuff, I tend to comment a lot so read those :)

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

# Building With Rollup

**Rollup config based off of: https://github.com/rollup/rollup-starter-lib** and using https://github.com/rollup/rollup-plugin-babel#configuring-babel

Note: preact cli has it's own .babel rc that will conflict with one in the project root directory. thus the babel configuration for rollup is defined in the package.json

### Special Thanks

* [awesome gb-dev communitty](https://github.com/avivace/awesome-gbdev), too many rad dudes to name!

* [dcodeIO for building and fixing bugs with AssemblyScript](https://github.com/AssemblyScript/assemblyscript). And for being awesome!

* [r/emudev](https://www.reddit.com/r/EmuDev/), especially to [binjimint](https://www.reddit.com/r/EmuDev/comments/7y2bux/gameboy_gb_graphical_bugs_game_writes_zeroes_into/dudlj3w/) for helping me find that bug not even Blargg's cpu tests could find.
