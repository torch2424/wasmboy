// Imports
import { postMessage } from '../../../worker/workerapi';
import { getSmartWorkerMessage } from '../../../worker/smartworker';
import { WORKER_MESSAGE_TYPE, MEMORY_TYPE } from '../../../worker/constants';

export function transferGraphics(libWorker) {
  const graphicsFrameEndIndex = libWorker.WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION + libWorker.WASMBOY_CURRENT_FRAME_SIZE;
  const graphicsFrameBuffer = libWorker.wasmByteMemory.slice(libWorker.WASMBOY_CURRENT_FRAME_OUTPUT_LOCATION, graphicsFrameEndIndex).buffer;
  //libWorker.graphicsWorkerPort.postMessage(graphicsFrameBuffer, [graphicsFrameBuffer]);
  libWorker.graphicsWorkerPort.postMessage(
    getSmartWorkerMessage({
      type: WORKER_MESSAGE_TYPE.UPDATED,
      graphicsFrameBuffer
    }),
    [graphicsFrameBuffer]
  );
}
