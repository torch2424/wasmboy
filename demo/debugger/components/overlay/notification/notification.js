// Component to show text notifications

import { h, Component } from 'preact';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';
import './notification.css';

export default class Notification extends Component {
  constructor() {
    super();

    this.state.visible = undefined;
    this.state.hideTimeout = false;

    Pubx.subscribe(PUBX_KEYS.NOTIFICATION, newState => {
      this.close();

      this.setState({
        ...newState,
        visible: 'notification--show',
        hideTimeout: setTimeout(() => {
          this.close();
        }, newState.timeout)
      });
    });
  }

  close() {
    if (this.state.hideTimeout) {
      clearTimeout(this.state.hideTimeout);
    }

    this.setState({
      visible: undefined
    });
  }

  render() {
    return (
      <div className={`notification ${this.state.visible}`}>
        <div class="notification__close">
          <button class="remove-default-button" onClick={() => this.close()}>
            X
          </button>
        </div>
        <div class="notification__text">{this.state.text}</div>
      </div>
    );
  }
}
