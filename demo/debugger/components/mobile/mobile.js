// Base Component to handle showing mobile UIs

import { h, Component } from 'preact';
import { WasmBoy } from '../../wasmboy';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';

import Touchpad from './touchpad/touchpad';

import './mobile.css';

export default class Mobile extends Component {
  constructor() {
    super();

    Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => this.setState(newState));
    Pubx.subscribe(PUBX_KEYS.LOADING, newState => {
      if (newState.controlLoading) {
        this.base.classList.add('control-loading');
      } else {
        this.base.classList.remove('control-loading');
      }
    });
  }

  componentDidMount() {
    // Update our state of mobile
    // This will assign our canvas
    Pubx.get(PUBX_KEYS.MOBILE).update();
  }

  render() {
    let wasmboyInfo = '';
    if (!WasmBoy.isLoadedAndStarted()) {
      wasmboyInfo = (
        <div class="mobile-container__info-container__info">
          <h1>WasmBoy Mobile Demo</h1>

          {/*VaporBoy Plug*/}
          <div>
            <b>
              Try{' '}
              <a href="https://vaporboy.net/" target="_blank">
                VaporBoy
              </a>{' '}
              for a full featured, GB / GBC Emulator Progressive Web App.
            </b>
          </div>

          {/* Github Repo */}
          <div>
            <a href="https://github.com/torch2424/wasmBoy" target="_blank">
              Fork Me on Github
            </a>
          </div>

          {/*Lib Version*/}
          <div>WasmBoy Lib Version: {WasmBoy.getVersion()}</div>

          {/* Info */}
          <h3>Introduction</h3>
          <div>
            Hello! Welcome to the WasmBoy Mobile Demo! WasmBoy is a Game Boy / Game Boy Color Emulation Library, written for Web Assembly
            using{' '}
            <a href="https://github.com/AssemblyScript/assemblyscript" target="_blank">
              AssemblyScript
            </a>
            . 🚀 This application is written in{' '}
            <a href="https://preactjs.com/" target="_blank">
              Preact
            </a>{' '}
            ⚛️. This website also happens to be the Wasmboy Debugger. However, the debugger is only available on desktop, due to UX issues.
            <br />
            <br />
            Since this is a demo, this is only meant for "checking it out", and this is lacking some features that would, normally be
            present that the lib does support (such as save states), for a full-featured GB / GBC emulator built with WasmBoy, try{' '}
            <a href="https://vaporboy.net/" target="_blank">
              VaporBoy
            </a>
            . Also, since this is meant for mobile, some of the WasmBoy configuration options are set to improve performance, but at the
            expense of less accuracy.
          </div>

          {/* Getting Started */}
          <h3>Getting Started</h3>
          <div>
            To try a ROM / Game, click the 📁 button, to open the ROM loader. To Play/Pause emulation, click the ⏯️ button. For more
            information on WasmBoy, click the ℹ️ button. To reload this demo, click the ♻️ button.
          </div>
        </div>
      );
    }

    return (
      <div class="mobile-container">
        <div class="donut" />
        <div class="mobile-container__canvas-container">
          <canvas id="mobile-container__wasmboy-canvas" class="pixel-canvas" />
        </div>
        <div class="mobile-container__info-container">{wasmboyInfo}</div>
        <Touchpad />
      </div>
    );
  }
}
