// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyController } from '../controller/controller';
import { WasmBoyMemory } from '../memory/memory';

// Import our worker urls
// Only one of the wasmboylib imports will be used. Rollup/Babel handles which one
import wasmboyLibWasmWorkerUrl from '../../dist/worker/wasmboy.wasm.worker.js';
import wasmboyLibTsWorkerUrl from '../../dist/worker/wasmboy.ts.worker.js';
import wasmboyGraphicsWorkerUrl from '../../dist/worker/graphics.worker.js';
import wasmboyAudioWorkerUrl from '../../dist/worker/audio.worker.js';
import wasmboyControllerWorkerUrl from '../../dist/worker/controller.worker.js';
import wasmboyMemoryWorkerUrl from '../../dist/worker/memory.worker.js';

// Import our Smart Worker Interface
import { SmartWorker } from './smartworker';
import { WORKER_MESSAGE_TYPE, WORKER_ID } from './constants';

/*ROLLUP_REPLACE_NODE
const { MessageChannel } = require('worker_threads');
ROLLUP_REPLACE_NODE*/

export const instantiateWorkers = async () => {
  // Create our workers
  let libWorkerUrl;
  libWorkerUrl = wasmboyLibWasmWorkerUrl;
  libWorkerUrl = wasmboyLibTsWorkerUrl;

  const libWorker = new SmartWorker(libWorkerUrl, WORKER_ID.LIB);
  const graphicsWorker = new SmartWorker(wasmboyGraphicsWorkerUrl, WORKER_ID.GRAPHICS);
  const audioWorker = new SmartWorker(wasmboyAudioWorkerUrl, WORKER_ID.AUDIO);
  const controllerWorker = new SmartWorker(wasmboyControllerWorkerUrl, WORKER_ID.CONTROLLER);
  const memoryWorker = new SmartWorker(wasmboyMemoryWorkerUrl, WORKER_ID.MEMORY);
  // Create an array of promises for when each worker is ready
  const workerReadyPromises = [];

  // Add our workers to an array,
  const childWorkers = [graphicsWorker, audioWorker, controllerWorker, memoryWorker];

  // Create a messaging channel between our main lib worker,
  // And all of the children workers
  childWorkers.forEach(childWorker => {
    // Create our message channel
    // https://stackoverflow.com/questions/14191394/web-workers-communication-using-messagechannel-html5
    const messageChannel = new MessageChannel();

    const workerReadyPromise = new Promise(resolve => {
      // Our resolve function
      let messagesReceived = 0;
      const tryResolveWorkerReady = () => {
        messagesReceived++;
        if (messagesReceived >= 2) {
          resolve();
        }
      };

      // Post our connect messages
      libWorker
        .postMessage(
          {
            type: WORKER_MESSAGE_TYPE.CONNECT,
            workerId: childWorker.id,
            ports: [messageChannel.port1]
          },
          [messageChannel.port1]
        )
        .then(() => {
          tryResolveWorkerReady();
        });
      childWorker
        .postMessage(
          {
            type: WORKER_MESSAGE_TYPE.CONNECT,
            workerId: libWorker.id,
            ports: [messageChannel.port2]
          },
          [messageChannel.port2]
        )
        .then(() => {
          tryResolveWorkerReady();
        });
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

  // Return the main worker for the main lib
  return libWorker;
};
