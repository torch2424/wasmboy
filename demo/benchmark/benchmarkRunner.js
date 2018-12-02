import { h, Component } from 'preact';

import microseconds from 'microseconds';
import stats from 'stats-lite';

import { WasmBoyGraphics } from '../../lib/graphics/graphics';
import { getImageDataFromGraphicsFrameBuffer } from '../../lib/graphics/worker/imageData';

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
    const time = microseconds.since(start);
    times([...times(), time]);
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

const outputFrame = Core => {
  // Get the graphics frame output
  const graphicsFrameEndIndex = Core.instance.exports.FRAME_LOCATION + Core.instance.exports.FRAME_SIZE;
  const graphicsFrameBuffer = Core.byteMemory.slice(Core.instance.exports.FRAME_LOCATION, graphicsFrameEndIndex);

  WasmBoyGraphics.imageDataArray = getImageDataFromGraphicsFrameBuffer(graphicsFrameBuffer);
  WasmBoyGraphics.imageDataArrayChanged = true;
  WasmBoyGraphics.renderFrame();
};

export default class BenchmarkRunner extends Component {
  constructor(props) {
    super(props);
    this.state = {
      cyclesToRun: 2500
    };
  }

  componentDidMount() {}

  runBenchmark() {
    this.props.running(true);

    const asyncLoopCallback = async Core => {
      outputFrame(Core);

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
      for (let i = 0; i < this.props.WasmBoyCoreObjects.length; i++) {
        let coreObject = this.props.WasmBoyCoreObjects[i];
        WasmBoyGraphics.initialize(document.getElementById(coreObject.canvasId));
        await coreBenchmark(coreObject.core, coreObject.times, this.state.cyclesToRun, asyncLoopCallback);
      }

      this.benchmarkComplete();
    };
    benchmarkTask();
  }

  benchmarkComplete() {
    this.props.running(false);
  }

  render() {
    if (!this.props) {
      return <div />;
    }

    // Get our runner output element for each core
    const wasmboyCoreOutputElements = [];
    this.props.WasmBoyCoreObjects.forEach(coreObject => {
      wasmboyCoreOutputElements.push(
        <div>
          <h1>
            {coreObject.label} ({coreObject.subLabel})
          </h1>
          <h1>
            {coreObject.label} Frames Run: {coreObject.times().length}
          </h1>
          <h1>
            Current {coreObject.label} FPS Average: {coreObject.times().length > 0 ? averageFpsFromTimes(coreObject.times()) : 0}
          </h1>
          <canvas id={coreObject.canvasId} />
        </div>
      );
    });

    return (
      <section class="runner">
        <div class="runner__frames-to-run">
          <label>
            <div>Frames to run:</div>
            <input
              class="input"
              type="number"
              min="0"
              value={this.state.cyclesToRun}
              disabled={!this.props.ready || this.props.running()}
              onChange={event => {
                this.setState({ ...this.state, cyclesToRun: event.target.value });
              }}
            />
            <button class="button is-success" disabled={!this.props.ready || this.props.running()} onClick={() => this.runBenchmark()}>
              Run
            </button>
          </label>
        </div>

        <div class="runner__output">{wasmboyCoreOutputElements}</div>
      </section>
    );
  }
}
