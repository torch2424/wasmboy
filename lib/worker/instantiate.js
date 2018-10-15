// WasmBoy Modules
import { WasmBoyGraphics } from '../graphics/graphics';
import { WasmBoyAudio } from '../audio/audio';
import { WasmBoyController } from '../controller/controller';
import { WasmBoyMemory } from '../memory/memory';

// Import our worker urls
import wasmboyLibWorkerUrl from '../../dist/wasmboy/worker/wasmboy.worker.js';
import wasmboyGraphicsWorkerUrl from '../../dist/graphics/worker/graphics.worker.js';
import wasmboyAudioWorkerUrl from '../../dist/audio/worker/audio.worker.js';
import wasmboyControllerWorkerUrl from '../../dist/controller/worker/controller.worker.js';
import wasmboyMemoryWorkerUrl from '../../dist/memory/worker/memory.worker.js';

// Import our Smart Worker Interface
import SmartWorker from './smartworker';

/*ROLLUP_REPLACE_NODE
const { MessageChannel } = require('worker_threads');
ROLLUP_REPLACE_NODE*/

export const instantiateWorkers = async () => {
  // Create our workers
  const libWorker = new SmartWorker(wasmboyLibWorkerUrl, 'LIB_WORKER');
  const graphicsWorker = new SmartWorker(wasmboyGraphicsWorkerUrl, 'GRAPHICS_WORKER');
  const audioWorker = new SmartWorker(wasmboyAudioWorkerUrl, 'AUDIO_WORKER');
  const controllerWorker = new SmartWorker(wasmboyControllerWorkerUrl, 'CONTROLLER_WORKER');
  const memoryWorker = new SmartWorker(wasmboyMemoryWorkerUrl, 'MEMORY_WORKER');

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

      // Prepare our message listeners
      libWorker.addMessageListener(() => {
        console.log('Lib Worker Connected!');
        tryResolveWorkerReady();
      }, true);
      childWorker.addMessageListener(() => {
        console.log('Child Worker Connected!', childWorker);
        tryResolveWorkerReady();
      }, true);

      // Post our connect messages
      libWorker.postMessage(
        {
          command: 'connect',
          workerId: childWorker.id
        },
        [messageChannel.port1]
      );
      childWorker.postMessage(
        {
          command: 'connect',
          workerId: libWorker.id
        },
        [messageChannel.port2]
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

  // Return the main worker for the main lib
  return libWorker;
};
