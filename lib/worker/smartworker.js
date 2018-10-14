// Smarter workers.
// Workers with ids, pub sub, etc...

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
    this.worker = new Worker(workerUrl);
    this.messageListeners = [];

    this.worker.onmessage = message => {
      this.messageListeners.forEach(messageListener => {
        messageListener.callback(message);
        if (messageListener.shouldListenOnce) {
          this.removeMessageListener(messageListener.id);
        }
      });
    };
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
}
