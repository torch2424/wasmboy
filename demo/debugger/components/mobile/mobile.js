// Base Component to handle showing mobile UIs

import { h, Component } from 'preact';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';

import Touchpad from './touchpad/touchpad';

import './mobile.css';

export default class Mobile extends Component {
  constructor() {
    super();

    Pubx.subscribe(PUBX_KEYS.MOBILE, newState => this.setState(newState));

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
    return (
      <div class="mobile-container">
        <div class="mobile-container__canvas-container">
          <canvas id="mobile-container__wasmboy-canvas" class="pixel-canvas" />
        </div>
        <Touchpad />
      </div>
    );
  }
}
