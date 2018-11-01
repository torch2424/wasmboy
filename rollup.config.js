// Rollup config to export the correct componation of bundles
import libBundles from './rollup.lib';
import workerBundles from './rollup.worker';
import coreTsBundles from './rollup.core';

let exports;
if (process.env.TS) {
  exports = [...coreTsBundles, ...workerBundles, ...libBundles];
} else {
  exports = [...workerBundles, ...libBundles];
}

export default exports;
