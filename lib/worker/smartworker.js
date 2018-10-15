// Smarter workers.
// Workers with ids, pub sub, etc...
// https://medium.com/dailyjs/threads-in-node-10-5-0-a-practical-intro-3b85a0a3c953

/*ROLLUP_REPLACE_NODE
const { Worker } = require('worker_threads');
ROLLUP_REPLACE_NODE*/

const generateId = () => {
  return Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(2, 10);
};

export default class SmartWorker {
  constructor(workerUrl, id) {
    this.id = generateId();
    if (id) {
      this.id = id;
    }
    this.messageListeners = [];

    /*ROLLUP_REPLACE_BROWSER

    this.worker = new Worker(workerUrl);
    this.worker.onmessage = this._onMessageHandler.bind(this);


    ROLLUP_REPLACE_BROWSER*/

    /*ROLLUP_REPLACE_NODE

    // Split by Comma, to remove the file header from the base 64 string
    const workerAsString = Buffer.from(workerUrl.split(',')[1], 'base64').toString('utf8');
    this.worker = new Worker(workerAsString, {
      eval: true
    });
    this.worker.on('message', this._onMessageHandler.bind(this))

    ROLLUP_REPLACE_NODE*/
  }

  postMessage(message) {
    this.worker.postMessage(message);
  }

  postMessageWithContext(message) {
    this.worker.postMessage({
      id: this.id,
      message: message
    });
  }

  postMessageAndWaitForResponse(message) {
    return new Promise(resolve => {
      this.addMessageListener(resolve, true);
      this.worker.postMessage(message);
    });
  }

  addMessageListener(callback, shouldListenOnce) {
    this.messageListeners.push({
      id: generateId(),
      callback: callback,
      shouldListenOnce
    });
  }

  removeMessageListener(id) {
    let messageListenerIndex;
    this.messageListeners.some((messageListener, index) => {
      if (messageListener.id === id) {
        messageListenerIndex = index;
        return true;
      }

      return false;
    });

    if (messageListenerIndex !== undefined) {
      this.messageListeners.splice(messageListenerIndex, 1);
    }
  }

  _onMessageHandler(message) {
    this.messageListeners.forEach(messageListener => {
      messageListener.callback(message);
      if (messageListener.shouldListenOnce) {
        this.removeMessageListener(messageListener.id);
      }
    });
  }
}
