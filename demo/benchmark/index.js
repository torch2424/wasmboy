import { h, render, Component } from 'preact';

import 'bulma/css/bulma.css';
import './style.css';
import './index.css';

import valoo from 'valoo';
import browserDetect from 'browser-detect';

import packageJson from '../../package.json';

// Import our cores
import getWasmBoyWasmCore from '../../dist/core/getWasmBoyWasmCore.esm';
import getWasmBoyTsCore from '../../dist/core/getWasmBoyTsCore.esm';
import getWasmBoyTsClosureCore from '../../dist/core/getWasmBoyTsCore.closure.esm';
import getBinjgbCore from './binjgb/0.1.3/getcore';
import getGameBoyOnlineCore from './gameboyOnline/getcore';

import LoadROMSelector from './loadrom';
import BenchmarkRunner from './benchmarkRunner';
import BenchmarkResults from './benchmarkResults';

let WasmBoyCoreObjects = [];
let OtherCoreObjects = [];
let CoreObjects = [];

// Create our valoo variables with dummy callbacks so they update
const dummyCallback = v => {};

class WasmBoyBenchmarkApp extends Component {
  constructor() {
    super();

    const browserInfo = browserDetect();

    const running = valoo(false);
    running.on(() => this.setState({ ...this.state }));

    this.state = {
      ready: false,
      loading: false,
      otherGBEmulators: false,
      running,
      browserInfo: {
        ...browserInfo
      }
    };
  }

  componentDidMount() {
    // Instantiate our cores
    const instantiateCoresTask = async () => {
      // Get our cores
      let wasmboyWasmCore = await getWasmBoyWasmCore();
      let wasmboyTsCore = await getWasmBoyTsCore();
      let wasmboyTsClosureCore = await getWasmBoyTsClosureCore();
      let binjgbCore = await getBinjgbCore();
      let gameboyOnlineCore = await getGameBoyOnlineCore();

      console.log('WasmBoy Wasm Core:', wasmboyWasmCore);
      console.log('WasmBoy TS Core:', wasmboyTsCore);
      console.log('WasmBoy TS Closure Core:', wasmboyTsClosureCore);
      console.log('Binjgb Core:', binjgbCore);
      console.log('GameBoy Online Core:', gameboyOnlineCore);

      // Set up our times
      const wasmTimes = valoo([]);
      const tsTimes = valoo([]);
      const tsClosureTimes = valoo([]);
      const binjgbTimes = valoo([]);
      const gameboyOnlineTimes = valoo([]);

      wasmTimes.on(dummyCallback);
      tsTimes.on(dummyCallback);
      tsClosureTimes.on(dummyCallback);
      binjgbTimes.on(dummyCallback);
      gameboyOnlineTimes.on(dummyCallback);

      WasmBoyCoreObjects = [
        {
          label: 'WasmBoy',
          subLabel: 'Web Assembly, Assemblyscript',
          canvasId: 'wasm-canvas',
          color: '#6447f4',
          core: wasmboyWasmCore,
          times: wasmTimes,
          resultTimes: [],
          timesStartIndexes: [],
          data: []
        },
        {
          label: 'WasmBoy',
          subLabel: 'Typescript',
          canvasId: 'ts-canvas',
          color: '#f7a800',
          core: wasmboyTsCore,
          times: tsTimes,
          resultTimes: [],
          timesStartIndexes: [],
          data: []
        },
        {
          label: 'WasmBoy',
          subLabel: 'Typescript, Closure Compiled',
          canvasId: 'closure-canvas',
          color: '#009588',
          core: wasmboyTsClosureCore,
          times: tsClosureTimes,
          resultTimes: [],
          timesStartIndexes: [],
          data: []
        }
      ];
      OtherCoreObjects = [
        {
          label: 'Binjgb',
          subLabel: 'Web Assembly, Emscripten',
          canvasId: 'binjgb-canvas',
          color: '#4fffc2',
          core: binjgbCore,
          times: binjgbTimes,
          resultTimes: [],
          timesStartIndexes: [],
          data: []
        },
        {
          label: 'GameBoy Online',
          subLabel: 'Javascript',
          canvasId: 'gameboy-online-canvas',
          color: '#c83232',
          core: gameboyOnlineCore,
          times: gameboyOnlineTimes,
          resultTimes: [],
          timesStartIndexes: [],
          data: []
        }
      ];

      CoreObjects = [...WasmBoyCoreObjects];

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

        <div class="wasmboy-benchmark__link">
          <a
            href="https://medium.com/@torch2424/webassembly-is-fast-a-real-world-benchmark-of-webassembly-vs-es6-d85a23f8e193"
            target="_blank"
          >
            In-Depth Article and Results
          </a>
        </div>

        <div class="wasmboy-benchmark__notices">
          WasmBoy is{' '}
          <a href="https://github.com/torch2424/wasmboy/blob/master/test/performance/results.md" target="_blank">
            configured
          </a>{' '}
          with: audioBatchProcessing, audioAccumulateSamples, tileCaching
        </div>

        <div class="wasmboy-benchmark__notices">Source is not minified, to allow easy analysis of the bundle.</div>

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

            <label class="wasmboy-benchmark__other-gb">
              Enable Other Online GameBoy Emulators (
              <a href="https://github.com/binji/binjgb" target="_blank">
                Binjgb
              </a>
              ,{' '}
              <a href="https://github.com/taisel/GameBoy-Online" target="_blank">
                GameBoy Online
              </a>
              ):
              <input
                name="otherGBEmulators"
                type="checkbox"
                checked={this.state.otherGBEmulators}
                onChange={event => {
                  const shouldEnableOtherCoreObjects = event.target.checked;
                  if (shouldEnableOtherCoreObjects) {
                    CoreObjects = [...WasmBoyCoreObjects, ...OtherCoreObjects];
                  } else {
                    CoreObjects = [...WasmBoyCoreObjects];
                  }

                  this.setState({
                    otherGBEmulators: event.target.checked
                  });
                }}
              />
            </label>

            <LoadROMSelector WasmBoyCoreObjects={CoreObjects} ROMLoaded={() => this.setState({ ...this.state, ready: true })} />

            <hr />
            <h1>Runner</h1>
            <hr />

            <BenchmarkRunner WasmBoyCoreObjects={CoreObjects} ready={this.state.ready} running={this.state.running} />

            <hr />
            <h1>Results</h1>
            <hr />

            <BenchmarkResults WasmBoyCoreObjects={CoreObjects} running={this.state.running} />
          </main>
        )}
      </div>
    );
  }
}

render(<WasmBoyBenchmarkApp />, document.body);
