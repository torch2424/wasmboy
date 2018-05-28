# Tobu Tobu Girl ![MIT License](https://img.shields.io/badge/license-MIT%20License-blue.svg) ![CC BY 4.0](https://img.shields.io/badge/license-CC%20BY%204.0-blue.svg) ![Game Boy](https://img.shields.io/badge/platform-Game%20Boy-blue.svg)

An arcade platformer for the Game Boy.

More info at: http://tangramgames.dk/tobutobugirl/.

Note: The makefiles are currently a mess and dependencies are not handled properly. Many changes will require a `make clean` before recompiling. I will try to fix this soon.

Compilation has only been tested on Linux using GBDK 2.96a.

## Playing the game

In order to play the game you will need to either flash the game to a Game Boy flash cart or use a Game Boy emulator. The binaries are provided through [itch.io](https://tangramgames.itch.io/tobutobugirl).

## Compilation

### Install GBDK

Install GBDK version 2.96a. Make sure the `lcc` compiler is in your PATH and the `GBDKDIR` environment variable is set up correctly.

### Install imgtogb

Download and compile [imgtogb](https://github.com/SimonLarsen/imgtogb) and add it to your PATH. Alternatively you can change the `IMGTOGB` variable in the [Makefile](Makefile) to point to the imgtogb binary.

### Compiling the rom

Clone the Tobu Tobu Girl repository using the `--recursive` flag to clone the [mmlgb](https://github.com/SimonLarsen/mmlgb) submodule as well.

```
git clone --recursive https://github.com/SimonLarsen/tobutobugirl
cd tobutobugirl
```

Download the `MMLGB.jar` file and place it in the root folder.

```
wget https://github.com/SimonLarsen/mmlgb/releases/download/v0.1/MMLGB.jar
```

Then compile rom file with `make`.

```
make
```

If all went well, a rom file `tobu.gb` will be created in the project root.

## License

The source code for Tobu Tobu Girl is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

All assets (images, text, sound and music) are licensed under the [Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/).
