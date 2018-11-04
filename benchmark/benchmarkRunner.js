import { h, Component } from 'preact';

import microseconds from 'microseconds';
import stats from 'stats-lite';

import { WasmBoyGraphics } from '../lib/graphics/graphics';
import { getImageDataFromGraphicsFrameBuffer } from '../lib/graphics/worker/imageData';
import BenchmarkResults from './benchmarkResults';

let wasmTimes = [];
let tsTimes = [];

const maxCycles = 2000;

const toSeconds = microSeconds => {
  return microSeconds / 1000000;
};

const averageFpsFromTimes = frameTimes => {
  if (frameTimes.length <= 0) {
    return 0;
  }
  return Math.floor(1000000 / stats.mean(frameTimes));
};

const coreBenchmark = async (Core, times, cyclesToRun, asyncLoopCallback) => {
  let currentCycles = 0;

  const coreCycle = async () => {
    const start = microseconds.now();
    Core.instance.exports.executeFrame();
    times.push(microseconds.since(start));
    if (asyncLoopCallback) {
      await asyncLoopCallback(Core, times);
    }
  };

  await new Promise(resolve => {
    const cycleLoop = async resolve => {
      await coreCycle();
      currentCycles++;

      if (currentCycles >= cyclesToRun) {
        resolve();
      } else {
        setTimeout(() => {
          cycleLoop(resolve);
        });
      }
    };
    cycleLoop(resolve);
  });
};

const outputFrame = (Core, WasmBoyTsCore) => {
  // Get the graphics frame output
  const graphicsFrameEndIndex = WasmBoyTsCore.instance.exports.FRAME_LOCATION + WasmBoyTsCore.instance.exports.FRAME_SIZE;
  const graphicsFrameBuffer = Core.byteMemory.slice(WasmBoyTsCore.instance.exports.FRAME_LOCATION, graphicsFrameEndIndex);

  WasmBoyGraphics.imageDataArray = getImageDataFromGraphicsFrameBuffer(graphicsFrameBuffer);
  WasmBoyGraphics.imageDataArrayChanged = true;
  WasmBoyGraphics.renderFrame();
};

export default class BenchmarkRunner extends Component {
  constructor(props) {
    super(props);
    this.state = {
      running: false
    };
  }

  componentDidMount() {}

  runBenchmark() {
    this.setState(
      {
        ...this.state,
        running: true
      },
      () => {
        const asyncLoopCallback = async Core => {
          outputFrame(Core, this.props.WasmBoyTsCore);

          await new Promise(resolve => {
            this.setState(
              {
                ...this.state
              },
              () => resolve()
            );
          });
        };

        const benchmarkTask = async () => {
          WasmBoyGraphics.initialize(document.getElementById('wasm-canvas'));
          await coreBenchmark(this.props.WasmBoyWasmCore, wasmTimes, maxCycles, asyncLoopCallback);

          WasmBoyGraphics.initialize(document.getElementById('ts-canvas'));
          await coreBenchmark(this.props.WasmBoyTsCore, tsTimes, maxCycles, asyncLoopCallback);

          this.benchmarkComplete();
        };
        benchmarkTask();
      }
    );
  }

  benchmarkComplete() {
    console.log('wasm times', wasmTimes);
    console.log('ts times', tsTimes);

    console.log('wasm mean', stats.mean(wasmTimes), 'sum', stats.sum(wasmTimes));
    console.log('ts mean', stats.mean(tsTimes), 'sum', stats.sum(tsTimes));

    this.setState({
      ...this.state,
      running: false
    });
  }

  render() {
    if (!this.props) {
      return <div />;
    }

    return (
      <div class="runner">
        <div class="button is-success" disabled={!this.props.ready || this.state.running} onClick={() => this.runBenchmark()}>
          Run
        </div>

        <div class="runner__output">
          <div>
            <div>Wasm Frames Run: {wasmTimes.length}</div>
            <div>Current Wasm FPS Average: {wasmTimes.length > 0 ? averageFpsFromTimes(wasmTimes) : 0}</div>
            <canvas id="wasm-canvas" />
          </div>
          <div>
            <div>Ts Frames Run: {tsTimes.length}</div>
            <div>Curren Ts FPS Average: {wasmTimes.length > 0 ? averageFpsFromTimes(tsTimes) : 0}</div>
            <canvas id="ts-canvas" />
          </div>
        </div>

        <BenchmarkResults WasmTimes={wasmTimes} TsTimes={tsTimes} isRunning={this.state.running} />
      </div>
    );
  }
}
