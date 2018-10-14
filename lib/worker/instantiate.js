// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyController } from '../controller/controller';
import { WasmBoyMemory } from '../memory/memory';

// Import our worker urls
import wasmboyLibWorkerUrl from '../wasmboy/worker/wasmboy.worker.js';
import wasmboyGraphicsWorkerUrl from '../graphics/worker/graphics.worker.js';
import wasmboyAudioWorkerUrl from '../audio/worker/audio.worker.js';
import wasmboyControllerWorkerUrl from '../controller/worker/controller.worker.js';
import wasmboyMemoryWorkerUrl from '../memory/worker/memory.worker.js';

export const instatiateWorkers = async () => {
  // Create our message channel
  // https://stackoverflow.com/questions/14191394/web-workers-communication-using-messagechannel-html5
  const messageChannel = new MessageChannel();

  // Create our workers
  const libWorker = new Worker(wasmboyLibWorkerUrl);
  const graphicsWorker = new Worker(wasmboyGraphicsWorkerUrl);
  const audioWorker = new Worker(wasmboyAudioWorkerUrl);
  const controllerWorker = new Worker(wasmboyControllerWorkerUrl);
  const memoryWorker = new Worker(wasmboyMemoryWorkerUrl);

  // Create an array of promises for when each worker is ready
  const workerReadyPromises = [];

  // Add our workers to an array,
  // Main worker must be first
  const workers = [libWorker, graphicsWorker, audioWorker, controllerWorker, memoryWorker];

  // Set our message ports,
  // and prepare our ready promises for our workers
  workers.forEach((worker, index) => {
    const workerReadyPromise = new Promise(resolve => {
      let channelPort;
      if (index <= 0) {
        channelPort = messageChannel.port1;
      } else {
        channelPort = messageChannel.port2;
      }

      // Set up our ready resolver
      worker.onmessage = () => {
        worker.onmessage = () => {};
        console.log('Ready!');
        resolve();
        return;
      };

      // Send our connect message to initialize the worker
      worker.postMessage(
        {
          command: 'connect'
        },
        [channelPort]
      );
    });

    workerReadyPromises.push(workerReadyPromise);
  });

  // Wait for all workers to be ready
  await Promise.all(workerReadyPromises);

  // Finally, pass the ready workers to all of our children lib
  WasmBoyGraphics.setWorker(graphicsWorker);
  WasmBoyAudio.setWorker(audioWorker);
  WasmBoyController.setWorker(controllerWorker);
  WasmBoyMemory.setWorker(memoryWorker);

  // Return the messagechannel and the main worker for the main lib
  return {
    messageChannel,
    worker: libWorker
  };
};
