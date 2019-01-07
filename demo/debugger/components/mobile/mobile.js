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

    window.addEventListener('resize', () => {
      Pubx.get(PUBX_KEYS.MOBILE).update();
    });

    window.addEventListener('orientationchange', () => {
      Pubx.get(PUBX_KEYS.MOBILE).update();
    });

    Pubx.get(PUBX_KEYS.MOBILE).update();
  }

  componentDidMount() {}

  render() {
    let wasmboyInfo = '';
    if (!WasmBoy.isLoadedAndStarted()) {
      wasmboyInfo = (
        <div class="mobile-container__info-container__info">
          <h1>Yo!</h1>
        </div>
      );
    }

    return (
      <div class="mobile-container">
        <div class="mobile-container__canvas-container">
          <canvas id="mobile-container__wasmboy-canvas" class="pixel-canvas" />
        </div>
        <div class="mobile-container__info-container">{wasmboyInfo}</div>
        <Touchpad />
      </div>
    );
  }
}
