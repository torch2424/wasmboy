// Rollup config to export the correct componation of bundles
import libBundles from './rollup.lib';
import workerBundles from './rollup.worker';
import coreTsBundles from './rollup.core';
import getCoreBundles from './rollup.getcore';

let exports = [...getCoreBundles, ...workerBundles, ...libBundles];
if (process.env.TS) {
  exports = [...coreTsBundles, ...exports];
}

export default exports;
