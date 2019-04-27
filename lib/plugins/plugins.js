// API For adding plugins for WasmBoy
// Should follow the Rollup Plugin API
// https://rollupjs.org/guide/en#plugins

// Plugins have the following supported hooks
// And properties
const WASMBOY_PLUGIN = {
  name: 'wasmboy-plugin REQUIRED',
  graphics: rgbaArray => {},
  audio: masterAudioNode => {},
  saveState: saveStateObject => {},
  setCanvas: canvasElement => {},
  breakpoint: () => {},
  ready: () => {},
  play: () => {},
  pause: () => {},
  loadedAndStarted: () => {}
};

class WasmBoyPluginsService {
  constructor() {
    this.plugins = {};
    this.pluginIdCounter = 0;
  }

  addPlugin(pluginObject) {
    // Verify the plugin
    if (!pluginObject && typeof pluginObject !== 'object') {
      throw new Error('Invalid Plugin Object');
    }

    // Add the plugin to our plugin container
    this.plugins[pluginIdCounter] = pluginObject;
    this.pluginIdCounter++;

    // Return a function to remove the plugin
    return () => {
      this.removePlugin(id);
    };
  }

  removePlugin(id) {
    delete this.plugins[id];
  }

  runHook(hookId) {
    if (!WASMBOY_PLUGIN[hookId] || typeof WASMBOY_PLUGIN[hookId] !== 'function') {
      throw new Error('No such hook as ' + hookId);
    }

    this.plugins.forEach(plugin => {
      if (plugin[hookId]) {
        try {
          const params = [...arguments];
          params.shift();
          plugin[hookId].apply(params);
        } catch (e) {
          console.error(`There was an error running ${hookId} on ${plugin.name}`);
          console.error(e);
        }
      }
    });
  }
}

export const WasmBoyPlugins = new WasmBoyPluginsService();
