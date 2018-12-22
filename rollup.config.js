// Rollup config to export the correct componation of bundles
import libBundles from './rollup.lib';
import workerBundles from './rollup.worker';
import coreTsBundles from './rollup.core';
import getCoreBundles from './rollup.getcore';
import benchmarkBundles from './rollup.benchmark';
import ampBundles from './rollup.amp';

let exports = [];

if (!process.env.SKIP_LIB) {
  exports = [...getCoreBundles, ...workerBundles, ...libBundles];

  // Add TS Bundles
  if (process.env.TS) {
    exports = [...coreTsBundles, ...exports];
  }
}

if (process.env.BENCHMARK) {
  exports = [...exports, ...benchmarkBundles];
}

if (process.env.AMP) {
  exports = [...exports, ...ampBundles];
}

export default exports;
