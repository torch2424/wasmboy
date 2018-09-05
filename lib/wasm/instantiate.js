// Modules
import fetch from 'unfetch';
import Promise from 'promise-polyfill';
import wasmModuleUrl from '../../dist/core/index.untouched.wasm';
import { getPerformanceTimestamp } from '../common/common';

// Perofrmance timestamps for logging
const performanceTimestamps = {};

// Log throttling for our core
let logRequest = undefined;

// Our wasm instance and memory after instantiation
let wasmInstance = undefined;
let wasmByteMemory = undefined;

// Function to instantiate our wasm Module, wrapped in a promise
export const instantiateWasm = () => {
  return new Promise((resolve, reject) => {
    // Get our wasm instance from our wasmModule

    // Declare our Wasm Import Object
    const wasmImportObject = {
      env: {
        log: (message, arg0, arg1, arg2, arg3, arg4, arg5) => {
          // Grab our string
          var len = new Uint32Array(wasmInstance.exports.memory.buffer, message, 1)[0];
          var str = String.fromCharCode.apply(null, new Uint16Array(wasmInstance.exports.memory.buffer, message + 4, len));
          if (arg0 !== -9999) str = str.replace('$0', arg0);
          if (arg1 !== -9999) str = str.replace('$1', arg1);
          if (arg2 !== -9999) str = str.replace('$2', arg2);
          if (arg3 !== -9999) str = str.replace('$3', arg3);
          if (arg4 !== -9999) str = str.replace('$4', arg4);
          if (arg5 !== -9999) str = str.replace('$5', arg5);

          console.log('[WasmBoy] ' + str);
        },
        hexLog: (arg0, arg1, arg2, arg3, arg4, arg5) => {
          if (!logRequest) {
            // Grab our arguments, and log as hex
            let logString = '[WasmBoy]';
            if (arg0 !== -9999) logString += ` 0x${arg0.toString(16)} `;
            if (arg1 !== -9999) logString += ` 0x${arg1.toString(16)} `;
            if (arg2 !== -9999) logString += ` 0x${arg2.toString(16)} `;
            if (arg3 !== -9999) logString += ` 0x${arg3.toString(16)} `;
            if (arg4 !== -9999) logString += ` 0x${arg4.toString(16)} `;
            if (arg5 !== -9999) logString += ` 0x${arg5.toString(16)} `;

            // Uncomment to unthrottle
            //console.log(logString);

            // Comment the lines below to disable throttle
            logRequest = true;
            setTimeout(() => {
              console.log(logString);
              logRequest = false;
            }, Math.floor(Math.random() * 500));
          }
        },
        performanceTimestamp: (id, value) => {
          if (id === -9999) {
            id = 0;
          }

          if (value === -9999) {
            value = 0;
          }

          if (!performanceTimestamps[id]) {
            performanceTimestamps[id] = {};
            performanceTimestamps[id].throttle = false;
            performanceTimestamps[id].totalTime = 0;
            performanceTimestamps[id].value = 0;
          }
          if (!performanceTimestamps[id].throttle) {
            if (performanceTimestamps[id].timestamp) {
              // sleep a millisecond for hopefully more accurate times
              let endTime = getPerformanceTimestamp();
              let timeDifference = endTime - performanceTimestamps[id].timestamp;
              performanceTimestamps[id].throttle = true;
              performanceTimestamps[id].totalTime += timeDifference;
              console.log(
                `[WasmBoy] Performance Timestamp. ID: ${id}, Time: ${timeDifference}, value difference: ${value -
                  performanceTimestamps[id].value}, total time: ${performanceTimestamps[id].totalTime}`
              );
              performanceTimestamps[id].timestamp = false;
              setTimeout(() => {
                performanceTimestamps[id].throttle = false;
              }, 100);
            } else {
              performanceTimestamps[id].timestamp = getPerformanceTimestamp();
              performanceTimestamps[id].value = value;
            }
          }
        }
      }
    };

    let instantiateWasmPromise = undefined;

    // Safari does not support .instantiateStreaming()
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/instantiateStreaming
    if (WebAssembly.instantiateStreaming) {
      instantiateWasmPromise = WebAssembly.instantiateStreaming(fetch(wasmModuleUrl), wasmImportObject);
    } else {
      const fetchAndInstantiateTask = async () => {
        const wasmArrayBuffer = await fetch(wasmModuleUrl).then(response => response.arrayBuffer());
        return WebAssembly.instantiate(wasmArrayBuffer, wasmImportObject);
      };
      instantiateWasmPromise = fetchAndInstantiateTask();
    }

    instantiateWasmPromise
      .then(instantiatedWasm => {
        // NOTE: Memory growing is now done in the wasm itself

        // Cache our wasmInstance and byte memory
        wasmInstance = instantiatedWasm.instance;
        wasmByteMemory = new Uint8Array(wasmInstance.exports.memory.buffer);

        // Resolve our instance and byte memory
        resolve({
          instance: wasmInstance,
          byteMemory: wasmByteMemory
        });
      })
      .catch(error => {
        reject(error);
      });
  });
};
