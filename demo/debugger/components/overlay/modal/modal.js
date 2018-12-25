// Component to overlay components in full page view

import { h, Component } from 'preact';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';
import './modal.css';

export default class Modal extends Component {
  constructor() {
    super();

    this.state.visible = undefined;

    Pubx.subscribe(PUBX_KEYS.MODAL, newState => this.setState(newState));
  }

  render() {
    return (
      <div className={`modal ${this.state.visible}`}>
        <div class="modal__mask" />
        <div class="modal__content">{this.state.component}</div>
      </div>
    );
  }
}
