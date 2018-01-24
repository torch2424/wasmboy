# wasmBoy
Gameboy Emulator written in Web Assembly, Shell in Preact

using [awesome gbdev](https://github.com/avivace/awesome-gbdev) for reference material.

**Notes:**

Assembly script does not support Imports or exports outside of function exports

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
