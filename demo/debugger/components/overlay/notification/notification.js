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
      if (this.state.hideTimeout) {
        clearTimeout(this.state.hideTimeout);
      }

      this.setState({
        ...newState,
        visible: 'notification--show',
        hideTimeout: setTimeout(() => {
          this.setState({
            visible: undefined
          });
        }, newState.timeout)
      });
    });
  }

  render() {
    return <div className={`notification ${this.state.visible}`}>{this.state.text}</div>;
  }
}
