import { h, render, Component } from 'preact';

import 'bulma/css/bulma.css';
import '../debugger/style.css';
import './index.css';

import valoo from 'valoo';
import browserDetect from 'browser-detect';

import packageJson from '../../package.json';

// Import our cores
import getWasmBoyWasmCore from '../../dist/core/getWasmBoyWasmCore.esm';
import getWasmBoyTsCore from '../../dist/core/getWasmBoyTsCore.esm';

import LoadROMSelector from './loadrom';
import BenchmarkRunner from './benchmarkRunner';
import BenchmarkResults from './benchmarkResults';

let wasmboyWasmCore = undefined;
let wasmboyTsCore = undefined;

class WasmBoyBenchmarkApp extends Component {
  constructor() {
    super();

    const browserInfo = browserDetect();

    // Create ur valoo variables with dummy callbacks so they update
    const dummyCallback = v => {};

    const running = valoo(false);
    const wasmTimes = valoo([]);
    const tsTimes = valoo([]);
    running.on(() => this.setState({ ...this.state }));
    wasmTimes.on(dummyCallback);
    tsTimes.on(dummyCallback);

    this.state = {
      ready: false,
      loading: false,
      running,
      browserInfo: {
        ...browserInfo
      },
      results: {
        wasmTimes,
        tsTimes
      }
    };
  }

  componentDidMount() {
    // Instantiate our cores
    const instantiateCoresTask = async () => {
      wasmboyWasmCore = await getWasmBoyWasmCore();
      wasmboyTsCore = await getWasmBoyTsCore();

      console.log('WasmBoy Wasm Core:', wasmboyWasmCore);
      console.log('WasmBoy TS Core:', wasmboyTsCore);

      this.setState({
        ...this.state,
        loading: false
      });
    };
    instantiateCoresTask();

    this.setState({
      ...this.state,
      loading: true
    });
  }

  render() {
    return (
      <div class="wasmboy-benchmark">
        <h1 class="wasmboy-benchmark__title">WasmBoy Benchmarking</h1>

        <div class="wasmboy-benchmark__link">
          <a href="https://github.com/torch2424/wasmBoy" target="_blank">
            Fork Me on Github
          </a>
        </div>

        <table class="table is-bordered is-striped is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Current Enviroment</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Browser</td>
              <td>
                {this.state.browserInfo.name.charAt(0).toUpperCase() + this.state.browserInfo.name.slice(1)}{' '}
                {this.state.browserInfo.version}
              </td>
            </tr>
            <tr>
              <td>Operating System</td>
              <td>{this.state.browserInfo.os}</td>
            </tr>
            <tr>
              <td>WasmBoy Lib Version</td>
              <td>{packageJson.version}</td>
            </tr>
          </tbody>
        </table>

        {this.state.loading ? (
          <div class="donut-center">
            <div class="donut" />
          </div>
        ) : (
          <main>
            <hr />
            <h1>Setup</h1>
            <hr />

            <LoadROMSelector
              WasmBoyWasmCore={wasmboyWasmCore}
              WasmBoyTsCore={wasmboyTsCore}
              ROMLoaded={() => this.setState({ ...this.state, ready: true })}
            />

            <hr />
            <h1>Runner</h1>
            <hr />

            <BenchmarkRunner
              WasmBoyWasmCore={wasmboyWasmCore}
              WasmBoyTsCore={wasmboyTsCore}
              WasmTimes={this.state.results.wasmTimes}
              TsTimes={this.state.results.tsTimes}
              ready={this.state.ready}
              running={this.state.running}
            />

            <hr />
            <h1>Results</h1>
            <hr />

            <BenchmarkResults WasmTimes={this.state.results.wasmTimes} TsTimes={this.state.results.tsTimes} running={this.state.running} />
          </main>
        )}
      </div>
    );
  }
}

render(<WasmBoyBenchmarkApp />, document.body);
