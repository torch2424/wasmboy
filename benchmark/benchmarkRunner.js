import { h, Component } from 'preact';

import microseconds from 'microseconds';
import stats from 'stats-lite';

import { WasmBoyGraphics } from '../lib/graphics/graphics';
import { getImageDataFromGraphicsFrameBuffer } from '../lib/graphics/worker/imageData';

let wasmTimes = [];
let tsTimes = [];

const coreBenchmark = async (Core, times, loopCallback) => {
  let currentCycles = 0;
  const maxCycles = 2000;

  const coreCycle = () => {
    const start = microseconds.now();
    Core.instance.exports.executeFrame();
    times.push(microseconds.since(start));
    if (loopCallback) {
      loopCallback(Core, times);
    }
  };

  await new Promise(resolve => {
    const cycleLoop = resolve => {
      coreCycle();
      currentCycles++;

      if (currentCycles >= maxCycles) {
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

  componentDidMount() {
    // Set up our WasmBoy Graphics
    WasmBoyGraphics.initialize(document.getElementById('wasmboy-output-canvas'));
  }

  runBenchmark() {
    this.setState(
      {
        ...this.state,
        running: true
      },
      () => {
        wasmTimes = [];
        tsTimes = [];

        const benchmarkTask = async () => {
          await coreBenchmark(this.props.WasmBoyWasmCore, wasmTimes, Core => {
            outputFrame(Core, this.props.WasmBoyTsCore);
            document.getElementById('wasm-run-state').innerHTML = `Wasm Frames Run: ${wasmTimes.length}`;
          });
          await coreBenchmark(this.props.WasmBoyTsCore, tsTimes, Core => {
            outputFrame(Core, this.props.WasmBoyTsCore);
            document.getElementById('ts-run-state').innerHTML = `TS Frames Run: ${tsTimes.length}`;
          });
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

    this.setState(
      {
        ...this.state,
        running: false
      },
      () => {
        document.getElementById('wasm-run-state').innerHTML = `Wasm Frames Run: ${wasmTimes.length}`;
        document.getElementById('ts-run-state').innerHTML = `TS Frames Run: ${tsTimes.length}`;
      }
    );
  }

  render() {
    if (!this.props) {
      return <div />;
    }

    return (
      <div>
        <div class="button is-success" disabled={!this.props.ready || this.state.running} onClick={() => this.runBenchmark()}>
          Run
        </div>
        <div id="wasm-run-state" />
        <div id="ts-run-state" />
        <canvas id="wasmboy-output-canvas" />
      </div>
    );
  }
}
