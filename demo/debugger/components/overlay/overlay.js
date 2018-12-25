// Base Component to handle all overlaying elements
// Such as Modals, and Notifications

import { h, Component } from 'preact';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../pubx.config';
import './overlay.css';

import Notification from './notification/notification';
import Modal from './modal/modal';

export default class Overlay extends Component {
  constructor() {
    super();

    Pubx.subscribe(PUBX_KEYS.OVERLAY, newState => this.setState(newState));
  }

  render() {
    return (
      <div class="overlay">
        <Modal />
        <Notification />
      </div>
    );
  }
}
