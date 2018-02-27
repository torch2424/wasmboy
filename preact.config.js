/**
 * Function that mutates original webpack config.
 * Supports asynchronous changes when promise is returned.
 *
 * @param {object} config - original webpack config.
 * @param {object} env - options passed to CLI.
 * @param {WebpackConfigHelpers} helpers - object with useful helpers when working with config.
 **/
export default function (config, env, helpers) {
  // Add a wasm loader
  // https://github.com/developit/preact-cli/issues/464
  config.module.loaders.push({test: /\.wasm$/, loader: ['wasm-loader']});
  config.resolve.extensions.push(".wasm");
}
