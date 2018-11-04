import { h, render, Component } from 'preact';

import '../debugger/style.css';
import 'bulma/css/bulma.css';

import browserDetect from 'browser-detect';

// Import our cores
import getWasmBoyWasmCore from '../dist/core/getWasmBoyWasmCore.esm';
import getWasmBoyTsCore from '../dist/core/getWasmBoyTsCore.esm';

import LoadROMSelector from './loadrom';
import BenchmarkRunner from './benchmarkRunner';

let wasmboyWasmCore = undefined;
let wasmboyTsCore = undefined;

class WasmBoyBenchmarkApp extends Component {
  constructor() {
    super();

    const browserInfo = browserDetect();

    this.state = {
      ready: false,
      loading: false,
      browserInfo: {
        ...browserInfo
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
      <div>
        <h1>WasmBoy Benchmarking</h1>

        <table>
          <tr>
            <th>Current Device</th>
          </tr>
          <tr>
            <td>Browser</td>
            <td>
              {this.state.browserInfo.name} {this.state.browserInfo.version}
            </td>
          </tr>
          <tr>
            <td>Operating System</td>
            <td>{this.state.browserInfo.os}</td>
          </tr>
        </table>

        {this.state.loading ? (
          <div class="donut" />
        ) : (
          <main>
            <LoadROMSelector
              WasmBoyWasmCore={wasmboyWasmCore}
              WasmBoyTsCore={wasmboyTsCore}
              ROMLoaded={() => this.setState({ ...this.state, ready: true })}
            />
            <BenchmarkRunner WasmBoyWasmCore={wasmboyWasmCore} WasmBoyTsCore={wasmboyTsCore} ready={this.state.ready} />
          </main>
        )}
      </div>
    );
  }
}

render(<WasmBoyBenchmarkApp />, document.body);
