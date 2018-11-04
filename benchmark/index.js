import { h, render, Component } from 'preact';

import '../debugger/style.css';
import 'bulma/css/bulma.css';

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

    this.state = {
      ready: false,
      loading: false
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

        {this.state.loading ? (
          <div class="donut" />
        ) : (
          <div>
            <h2>Select a ROM</h2>
            <LoadROMSelector
              WasmBoyWasmCore={wasmboyWasmCore}
              WasmBoyTsCore={wasmboyTsCore}
              ROMLoaded={() => this.setState({ ...this.state, ready: true })}
            />
            <BenchmarkRunner WasmBoyWasmCore={wasmboyWasmCore} WasmBoyTsCore={wasmboyTsCore} ready={this.state.ready} />
          </div>
        )}
      </div>
    );
  }
}

render(<WasmBoyBenchmarkApp />, document.body);
