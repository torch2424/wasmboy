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

  close() {
    if (!this.state.blockClosing) {
      Pubx.get(PUBX_KEYS.MODAL).closeModal();
    }
  }

  render() {
    let ModalContent = () => <div />;
    if (this.state.component) {
      ModalContent = this.state.component;
    }

    return (
      <div className={`modal ${this.state.visible}`}>
        <div class="modal__mask" onClick={() => this.close()} />
        <div class="modal__container">
          <div class="modal__container__title-bar">
            <button class="modal__container__title-bar__close remove-default-button" onClick={() => this.close()}>
              {this.state.blockClosing ? '' : 'X'}
            </button>
          </div>
          <div class="modal__container__component">
            <ModalContent />
          </div>
        </div>
      </div>
    );
  }
}
