// Import object for our core js wrapper

// Log throttling for our core
// The same log can't be output more than once every half second
let logRequest = {};
let logThrottleLength = 100;

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
      if (!logRequest[arg0]) {
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
        logRequest[arg0] = true;
        setTimeout(() => {
          console.log(logString);
          logRequest[arg0] = false;
        }, logThrottleLength);
      }
    }
  }
};

export default wasmImportObject;
