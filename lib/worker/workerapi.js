// Isomorphic worker api to be imported by web workers
// https://medium.com/dailyjs/threads-in-node-10-5-0-a-practical-intro-3b85a0a3c953

// Initilize some of our isomorphic values
import { isInBrowser } from './util';

let parentPort;
if (!isInBrowser) {
  parentPort = require('worker_threads').parentPort;
}

// https://nodejs.org/api/worker_threads.html#worker_threads_worker_postmessage_value_transferlist
// https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
export function postMessage(message, transferArray) {
  // Can't bind parentPort.postMessage, so we need to kinda copy code here :p
  if (isInBrowser) {
    self.postMessage(message, transferArray);
  } else {
    parentPort.postMessage(message, transferArray);
  }
}

// https://nodejs.org/api/worker_threads.html#worker_threads_worker_parentport
// https://developer.mozilla.org/en-US/docs/Web/API/Worker/onmessage
export function onMessage(callback, port) {
  if (!callback) {
    console.error('workerapi: No callback was provided to onMessage!');
  }

  // If we passed a port, use that
  if (port) {
    if (isInBrowser) {
      // We are in the browser
      port.onmessage = callback;
    } else {
      // We are in Node
      port.on('message', callback);
    }
    return;
  }

  if (isInBrowser) {
    // We are in the browser
    self.onmessage = callback;
  } else {
    // We are in Node
    parentPort.on('message', callback);
  }
}
