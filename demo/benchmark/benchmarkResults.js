import { h, Component } from 'preact';

import Chart from 'chart.js';
import stats from 'stats-lite';

import { sendAnalyticsEvent } from './analytics';
import { getChartConfig } from './benchmarkChart';

let timesVsFramesChart = undefined;
let fpsVsFramesChart = undefined;
let generalStatsTable = [];

export default class BenchmarkRunner extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.renderCharts(this.props.WasmBoyCoreObjects);
    this.generateTable(this.props.WasmBoyCoreObjects);
  }

  componentWillReceiveProps(newProps) {
    if (newProps.running()) {
      return;
    }

    if (
      newProps.WasmBoyCoreObjects &&
      newProps.WasmBoyCoreObjects[0].resultTimes &&
      newProps.WasmBoyCoreObjects[0].resultTimes.length > 0
    ) {
      sendAnalyticsEvent('render_results');
    }

    this.generateTable(newProps.WasmBoyCoreObjects);
    this.renderCharts(newProps.WasmBoyCoreObjects);
  }

  // Function to return an array with a response from a callback for
  // Each core object
  getInfoFromCoreObjects(WasmBoyCoreObjects, callback) {
    const responses = [];
    WasmBoyCoreObjects.forEach(coreObject => {
      responses.push(callback(coreObject));
    });
    return responses;
  }

  generateTable(coreObjects) {
    if (!coreObjects || coreObjects.length <= 0) {
      return <table />;
    }

    const WasmBoyCoreObjects = [];
    coreObjects.forEach(coreObject => {
      if (coreObject.resultTimes && coreObject.resultTimes.length > 0) {
        WasmBoyCoreObjects.push(coreObject);
      }
    });

    if (WasmBoyCoreObjects.length === 0) {
      return <table />;
    }

    generalStatsTable = (
      <table class="table is-bordered is-striped is-narrow is-fullwidth">
        <thead>
          <tr>
            <th>Statistic</th>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <th>{`${coreObject.label} (${coreObject.subLabel})`}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Used Frame Times</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{coreObject.resultTimes.length}</td>;
            })}
          </tr>
          <tr>
            <td>Fastest Frame Time</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              const sortedTimes = [...coreObject.resultTimes];
              sortedTimes.sort((a, b) => {
                if (a < b) return -1;
                if (a > b) return 1;
                return;
              });
              return <td>{sortedTimes[0]}</td>;
            })}
          </tr>
          <tr>
            <td>Slowest Frame Time</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              const sortedTimes = [...coreObject.resultTimes];
              sortedTimes.sort((a, b) => {
                if (a < b) return -1;
                if (a > b) return 1;
                return;
              });
              return <td>{sortedTimes[sortedTimes.length - 1]}</td>;
            })}
          </tr>
          <tr>
            <td>Sum</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.sum(coreObject.resultTimes)}</td>;
            })}
          </tr>
          <tr>
            <td>Mean</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.mean(coreObject.resultTimes)}</td>;
            })}
          </tr>
          <tr>
            <td>Median</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.median(coreObject.resultTimes)}</td>;
            })}
          </tr>
          <tr>
            <td>Mode</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.mode(coreObject.resultTimes)}</td>;
            })}
          </tr>
          <tr>
            <td>Variance</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.variance(coreObject.resultTimes)}</td>;
            })}
          </tr>
          <tr>
            <td>Standard Deviation</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.stdev(coreObject.resultTimes)}</td>;
            })}
          </tr>
          <tr>
            <td>Sample Variance</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.sampleVariance(coreObject.resultTimes)}</td>;
            })}
          </tr>
          <tr>
            <td>Sample Standard Deviation</td>
            {this.getInfoFromCoreObjects(WasmBoyCoreObjects, coreObject => {
              return <td>{stats.sampleStdev(coreObject.resultTimes)}</td>;
            })}
          </tr>
        </tbody>
      </table>
    );

    this.setState({
      ...this.state
    });
  }

  getCoreObjectWithDataField(WasmBoyCoreObjects) {
    const response = [];

    WasmBoyCoreObjects.forEach(coreObject => {
      response.push({
        ...coreObject
      });
    });

    response.forEach(coreObject => {
      coreObject.data = [];
    });

    return response;
  }

  renderCharts(WasmBoyCoreObjects) {
    if (!WasmBoyCoreObjects || WasmBoyCoreObjects <= 0) {
      return;
    }

    const timesNumberLabels = [];
    for (let i = 0; i < WasmBoyCoreObjects[0].resultTimes.length; i++) {
      timesNumberLabels.push(i + 1);
    }

    const timesVsFramesCoreObjects = this.getCoreObjectWithDataField(WasmBoyCoreObjects);

    const timesVsFramesContext = document.getElementById('times-vs-frames-chart').getContext('2d');

    // Get our times as points
    timesVsFramesCoreObjects.forEach(coreObject => {
      coreObject.resultTimes.forEach((time, index) => {
        coreObject.data.push({
          x: index + 1,
          y: time
        });
      });
    });

    if (timesVsFramesChart) {
      timesVsFramesChart.destroy();
    }
    timesVsFramesChart = new Chart(
      timesVsFramesContext,
      getChartConfig(
        `Time to Run per Frame (Downsampled, Lower is Better)`,
        'Frame Number',
        'Time in Microseconds',
        false,
        60,
        timesNumberLabels,
        timesVsFramesCoreObjects
      )
    );

    const framesPerSet = 30;

    const framesPerSetCoreObjects = this.getCoreObjectWithDataField(WasmBoyCoreObjects);

    // Get an FPs By averaging every 60 frames.
    framesPerSetCoreObjects.forEach(coreObject => {
      let counter = 0;
      while (counter + framesPerSet < coreObject.resultTimes.length) {
        const timesAsFps = coreObject.resultTimes.slice(counter, counter + framesPerSet).map(x => Math.floor(1000000 / x));

        let mode = stats.mode(timesAsFps);

        if (typeof mode !== 'number') {
          mode = Array.from(mode)[0];
        }

        coreObject.data.push(mode);

        counter += framesPerSet;
      }
    });

    const fpsNumberLabels = [];
    for (let i = 0; i < framesPerSetCoreObjects[0].data.length; i++) {
      fpsNumberLabels.push(i + 1);
    }

    const fpsVsFramesCoreObjects = this.getCoreObjectWithDataField(WasmBoyCoreObjects);
    const fpsVsFramesContext = document.getElementById('fps-vs-frames-chart').getContext('2d');

    // Get our times as points
    framesPerSetCoreObjects.forEach((coreObject, coreObjectIndex) => {
      coreObject.data.forEach((fps, index) => {
        fpsVsFramesCoreObjects[coreObjectIndex].data.push({
          x: index + 1,
          y: fps
        });
      });
    });

    if (fpsVsFramesChart) {
      fpsVsFramesChart.destroy();
    }
    fpsVsFramesChart = new Chart(
      fpsVsFramesContext,
      getChartConfig(
        'Average Frames per Second per Frame Set (Downsampled, Higher is Better)',
        `Frame Set (${framesPerSet} Frames Per Set)`,
        'Average Frames Per Second',
        true,
        60,
        fpsNumberLabels,
        fpsVsFramesCoreObjects
      )
    );
  }

  render() {
    const shouldDisable = this.props.WasmBoyCoreObjects.some(coreObject => {
      if (!coreObject.resultTimes || coreObject.resultTimes.length <= 0) {
        return true;
      }

      return false;
    });

    return (
      <section class="results">
        <div>
          <button
            class="button"
            onClick={() => {
              this.props.WasmBoyCoreObjects.forEach(coreObject => {
                console.log(`${coreObject.label} (${coreObject.subLabel}) times:`, coreObject.resultTimes);
              });
            }}
            disabled={!this.props || this.props.running() || shouldDisable}
          >
            Log Frame Execution Times to Console
          </button>
        </div>

        <div>
          <h1>General Statistics of Times (In Microseconds)</h1>
          <div class="wasmboy-benchmark__stats-table">{generalStatsTable}</div>
        </div>

        <div>
          <h1>Frame Times Visualization</h1>
          <div class="wasmboy-benchmark__chart-container">
            <canvas id="times-vs-frames-chart" />
          </div>
          <div class="wasmboy-benchmark__chart-container">
            <canvas id="fps-vs-frames-chart" />
          </div>
        </div>
      </section>
    );
  }
}
