import { h, Component } from 'preact';
import Portal from 'preact-portal';

import './wasmboyFilePicker.css';

// Import some functions from our lib
import { sendAnalyticsEvent } from './analytics';
import { fetchROMAsByteArray } from '../../lib/wasmboy/fetchrom.js';

// Import our open source roms
import { getOpenSourceROMElements } from 'shared-gb/openSourceROMs/preactComponents';
import 'shared-gb/openSourceROMs/preactComponents.css';

export default class LoadROMSelector extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ROM: 'Please load a ROM...',
      showROMs: false,
      loading: false
    };
  }

  componentDidMount() {
    this.openSourceROMElements = getOpenSourceROMElements(this.loadOpenSourceROM.bind(this));
  }

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513
  loadLocalFile(event) {
    this.loadROMIntoCores(event.target.files[0], event.target.files[0].name);
    sendAnalyticsEvent('load_local_rom');
  }

  loadOpenSourceROM(openSourceROM) {
    this.loadROMIntoCores(openSourceROM.url, openSourceROM.title);
    sendAnalyticsEvent('load_open_source_rom');
  }

  loadROMIntoCores(ROMUrl, title) {
    this.setState({
      ...this.state,
      ROM: title,
      showROMs: false,
      loading: true
    });

    const coreObjects = this.props.WasmBoyCoreObjects;

    const loadROMTask = async () => {
      // Fetch the rom
      const ROMObject = await fetchROMAsByteArray(ROMUrl);

      // Our config params
      const configParams = [
        0, // enableBootRom
        1, // useGbcWhenAvailable
        1, // audioBatchProcessing
        0, // graphicsBatchProcessing
        0, // timersBatchProcessing
        0, // graphicsDisableScanlineRendering
        1, // audioAccumulateSamples
        0, // tileRendering
        1, // tileCaching
        0 // enableAudioDebugging
      ];

      // Clear Wasm memory
      // https://docs.google.com/spreadsheets/d/17xrEzJk5-sCB9J2mMJcVnzhbE-XH_NvczVSQH9OHvRk/edit?usp=sharing
      coreObjects.forEach(coreObject => {
        // Reset the byte memory to zero at all indexes
        coreObject.core.byteMemory.fill(0);

        // Set the ROM in byte memory
        // Not using .set to avoid source is too large error
        for (let i = 0; i < ROMObject.ROM.length; i++) {
          const byteMemoryLocation = coreObject.core.instance.exports.CARTRIDGE_ROM_LOCATION + i;
          coreObject.core.byteMemory[byteMemoryLocation] = ROMObject.ROM[i];
        }

        // Config the core
        coreObject.core.instance.exports.config.apply(this, configParams);
      });

      this.props.ROMLoaded();

      this.setState({
        ...this.state,
        loading: false
      });
    };
    // Wrap in a set timeout to avoid setState weirdness
    setTimeout(() => {
      loadROMTask();
    });
  }

  render() {
    return (
      <section class="load-rom">
        <h2>Current ROM: {this.state.ROM}</h2>
        {this.state.loading ? (
          <div class="donut" />
        ) : (
          <div class="load-rom__load-buttons">
            {/* Upload ROM from device */}
            <div class="file">
              <label class="file-label">
                <input
                  class="file-input"
                  type="file"
                  accept=".gb, .gbc, .zip"
                  name="resume"
                  onChange={event => {
                    this.loadLocalFile(event);
                  }}
                />
                <span class="file-cta">
                  <span class="file-icon">
                    {/* Material file svg https://material.io/icons/#ic_insert_drive_file */}
                    <svg fill="#020202" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z" />
                      <path d="M0 0h24v24H0z" fill="none" />
                    </svg>
                  </span>
                  <span class="file-label">Upload from Device</span>
                </span>
              </label>
            </div>

            {/* Open Source ROMs Button */}
            <a class="button is-normal is-light file-button" onClick={() => this.setState({ ...this.state, showROMs: true })}>
              <span class="icon">
                {/* Material open lock svg https://material.io/tools/icons/static/icons/baseline-lock_open-24px.svg */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" />
                </svg>
              </span>
              <span>Open Source ROMs (Play Now)</span>
            </a>
          </div>
        )}

        {/*Open Source ROMs Modal*/}
        {this.state.showROMs ? (
          <Portal into="body">
            <div class="modal is-active">
              <div class="modal-background">
                <div class="modal-content">
                  <h1>Load Open Source ROM</h1>
                  <div class="open-source-ROM-container">{this.openSourceROMElements}</div>
                </div>
                <button class="modal-close is-large" aria-label="close" onClick={() => this.setState({ ...this.state, showROMs: false })} />
              </div>
            </div>
          </Portal>
        ) : null}
      </section>
    );
  }
}
