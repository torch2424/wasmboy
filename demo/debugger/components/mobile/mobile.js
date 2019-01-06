// Base Component to handle showing mobile UIs

import { h, Component } from 'preact';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';
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

  render() {
    return <div class="mobile-container" />;
  }
}
