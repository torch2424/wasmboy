import { h, Component } from 'preact';

import Chart from 'chart.js';
import browserDetect from 'browser-detect';
import stats from 'stats-lite';

import { getChartConfig } from './benchmarkChart';

let timesVsFramesChart = undefined;
let fpsVsFramesChart = undefined;
let generalStatsTable = [];

export default class BenchmarkRunner extends Component {
  constructor(props) {
    super(props);
    console.log(browserDetect());
  }

  componentDidMount() {
    this.renderCharts([], []);
  }

  componentWillReceiveProps(newProps) {
    if (newProps.WasmTimes && newProps.TsTimes && !newProps.isRunning) {
      this.generateTable(newProps.WasmTimes, newProps.TsTimes);
      this.renderCharts(newProps.WasmTimes, newProps.TsTimes);
    }
  }

  generateTable(wasmTimes, tsTimes) {
    generalStatsTable = (
      <table>
        <tr>
          <th>Statistic</th>
          <th>Wasm</th>
          <th>Ts</th>
        </tr>
        <tr>
          <td>Sum</td>
          <td>{stats.sum(wasmTimes)}</td>
          <td>{stats.sum(tsTimes)}</td>
        </tr>
        <tr>
          <td>Mean</td>
          <td>{stats.mean(wasmTimes)}</td>
          <td>{stats.mean(tsTimes)}</td>
        </tr>
        <tr>
          <td>Median</td>
          <td>{stats.median(wasmTimes)}</td>
          <td>{stats.median(tsTimes)}</td>
        </tr>
        <tr>
          <td>Mode</td>
          <td>{stats.mode(wasmTimes)}</td>
          <td>{stats.mode(tsTimes)}</td>
        </tr>
        <tr>
          <td>Variance</td>
          <td>{stats.variance(wasmTimes)}</td>
          <td>{stats.variance(tsTimes)}</td>
        </tr>
        <tr>
          <td>Standard Deviation</td>
          <td>{stats.stdev(wasmTimes)}</td>
          <td>{stats.stdev(tsTimes)}</td>
        </tr>
        <tr>
          <td>Sample Variance</td>
          <td>{stats.sampleVariance(wasmTimes)}</td>
          <td>{stats.sampleVariance(tsTimes)}</td>
        </tr>
        <tr>
          <td>Sample Standard Deviation</td>
          <td>{stats.sampleStdev(wasmTimes)}</td>
          <td>{stats.sampleStdev(tsTimes)}</td>
        </tr>
      </table>
    );

    this.setState({
      ...this.state
    });
  }

  renderCharts(wasmTimes, tsTimes) {
    const timesNumberLabels = [];
    for (let i = 0; i < wasmTimes.length; i++) {
      timesNumberLabels.push(i + 1);
    }

    const timesVsFramesContext = document.getElementById('times-vs-frames-chart').getContext('2d');

    // Get our times as points
    let wasmTimesVsFrames = [];
    wasmTimes.forEach((wasmTime, index) => {
      wasmTimesVsFrames.push({
        x: index + 1,
        y: wasmTime
      });
    });

    // Get our times as points
    let tsTimesVsFrames = [];
    tsTimes.forEach((tsTime, index) => {
      tsTimesVsFrames.push({
        x: index + 1,
        y: tsTime
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
        wasmTimesVsFrames,
        tsTimesVsFrames
      )
    );

    const framesPerSet = 30;
    const wasmFps = [];
    const tsFps = [];

    // Get an FPs By averaging every 60 frames.
    let counter = 0;
    while (counter + framesPerSet < wasmTimes.length) {
      const wasmTimesAsFps = wasmTimes.slice(counter, counter + framesPerSet).map(x => Math.floor(1000000 / x));
      const tsTimesAsFps = tsTimes.slice(counter, counter + framesPerSet).map(x => Math.floor(1000000 / x));

      let wasmMode = stats.mode(wasmTimesAsFps);
      let tsMode = stats.mode(tsTimesAsFps);

      if (typeof wasmMode !== 'number') {
        wasmMode = Array.from(wasmMode)[0];
      }
      if (typeof tsMode !== 'number') {
        tsMode = Array.from(tsMode)[0];
      }

      wasmFps.push(wasmMode);
      tsFps.push(tsMode);

      counter = counter + framesPerSet;
    }

    const fpsNumberLabels = [];
    for (let i = 0; i < wasmFps.length; i++) {
      fpsNumberLabels.push(i + 1);
    }

    const fpsVsFramesContext = document.getElementById('fps-vs-frames-chart').getContext('2d');

    // Get our times as points
    let wasmFpsVsFrames = [];
    wasmFps.forEach((fps, index) => {
      wasmFpsVsFrames.push({
        x: index + 1,
        y: fps
      });
    });

    // Get our times as points
    let tsFpsVsFrames = [];
    tsFps.forEach((fps, index) => {
      tsFpsVsFrames.push({
        x: index + 1,
        y: fps
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
        wasmFpsVsFrames,
        tsFpsVsFrames
      )
    );
  }

  render() {
    return (
      <div>
        <div>
          General Statistics of Times (In Microseconds):
          {generalStatsTable}
        </div>
        <div>
          <canvas id="times-vs-frames-chart" />
          <canvas id="fps-vs-frames-chart" />
        </div>
      </div>
    );
  }
}
