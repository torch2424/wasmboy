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

    if (!pluginObject.name) {
      throw new Error('Added plugin must have a "name" property');
    }

    // Add the plugin to our plugin container
    const id = this.pluginIdCounter;
    this.plugins[this.pluginIdCounter] = pluginObject;
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

    Object.keys(this.plugins).forEach(pluginKey => {
      const plugin = this.plugins[pluginKey];

      if (plugin[hookId]) {
        try {
          // Get our arguments except the hook.
          // Need to use a for loop here because arguments
          // is not an array. So no forEach. And can't spread since
          // We want to keep original object references.
          const params = [];
          for (let i = 1; i < arguments.length; i++) {
            params[i - 1] = arguments[i];
          }
          plugin[hookId].apply(null, params);
        } catch (e) {
          console.error(`There was an error running the '${hookId}' hook, on the ${plugin.name} plugin.`);
          console.error(e);
        }
      }
    });
  }
}

export const WasmBoyPlugins = new WasmBoyPluginsService();
